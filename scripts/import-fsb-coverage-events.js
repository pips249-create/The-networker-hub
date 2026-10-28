#!/usr/bin/env node
/**
 * FSB (Federation of Small Businesses) coverage — link upcoming Connect events
 * to the correct regional organiser pages with Link Out to FSB / Eventbrite booking.
 *
 * - Does NOT create new FSB organisers (uses existing Hub pages).
 * - Idempotent via airtable_id = fsb-coverage:<region>:<YYYY-MM-DD>
 * - Organiser first is already satisfied (pages exist); this pass only adds events.
 *
 * Usage:
 *   node scripts/import-fsb-coverage-events.js            # dry-run
 *   node scripts/import-fsb-coverage-events.js --apply    # write to Supabase
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in local.env / env.
 */
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { createEvent, resolveSeriesGroupId } = require('../api/_lib/supabase-organiser-events');
const { deriveLocationFields, resolveRegionSlug, parseOutcode } = require('../api/_lib/uk-outcode');
const { geocodeUkPostcode } = require('../api/_lib/postcode-geocode');
const { normalizeEventPhotoUrl, eventImageDbValue } = require('../api/_lib/event-image');
const {
  CHECKOUT_LINK_OUT,
  preferEventbriteCheckoutUrl,
  normalizeExternalBookingUrl,
  normalizeExternalPriceLabel,
} = require('../api/_lib/connected-booking-util');

const APPLY = process.argv.includes('--apply');
const SOURCE_PREFIX = 'fsb-coverage';

/** Existing FSB organiser pages on the Hub. */
const ORG = {
  greaterLondon: '0e57f4c3-2d9a-4fe6-add2-7e0f91a0040d',
  eastOfEngland: '27db9afc-a761-4e7a-a351-09cd713a3455',
  wales: '28c31e5d-8d74-42ff-bc36-eeaea0851144',
  scotland: '3ac0176b-b903-46df-9801-26bd702fc78b',
  northWest: 'fc6d66f6-7267-4a31-8b0c-257bb3c0673c',
  yorkshire: '57e873dc-96f4-4aa7-b0f0-29643045d4bf',
  brighton: '3d71a28a-62cc-4158-ac0f-00803b1f8abf',
};

function sourceId(regionKey, ymd) {
  return SOURCE_PREFIX + ':' + regionKey + ':' + ymd;
}

function priceLabelFromSpec(spec) {
  if (spec.priceLabel) return normalizeExternalPriceLabel(spec.priceLabel);
  return 'Tickets available';
}

function linkOutUrlFromSpec(spec) {
  const raw = String(spec.bookingUrl || '').trim();
  if (!raw) return '';
  return normalizeExternalBookingUrl(preferEventbriteCheckoutUrl(raw)) || '';
}

async function applyLinkOut(sb, eventId, spec) {
  const url = linkOutUrlFromSpec(spec);
  const priceLabel = priceLabelFromSpec(spec);
  if (!url || !priceLabel) {
    console.log(`  · skip Link Out on ${eventId} — need booking URL + price label`);
    return;
  }
  if (!APPLY) {
    console.log(`  · would Link Out ${eventId}: ${priceLabel} → ${url.slice(0, 90)}`);
    return;
  }
  const patch = {
    checkout_mode: CHECKOUT_LINK_OUT,
    external_booking_url: url,
    external_price_label: priceLabel,
    ticket_sales_enabled: true,
  };
  if (spec.sourceId) patch.airtable_id = spec.sourceId;
  const { error } = await sb.from('events').update(patch).eq('id', eventId);
  if (error) console.warn('    Link Out patch failed', eventId, error.message);
  else console.log(`  · Link Out set: ${priceLabel}`);
}

function fetchText(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const lib = String(url).startsWith('http://') ? http : https;
    const req = lib.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TheNetworkerUK/1.0; +https://www.thenetworkeruk.com)',
          Accept: 'text/html,application/xhtml+xml',
        },
        timeout: 25000,
      },
      (res) => {
        const code = res.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(code) && res.headers.location && redirectsLeft > 0) {
          const next = new URL(res.headers.location, url).toString();
          res.resume();
          fetchText(next, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout fetching ' + url));
    });
  });
}

function extractOgImage(html) {
  if (!html) return '';
  let m = html.match(/property=["']og:image["']\s+content=["']([^"']+)/i);
  if (!m) m = html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);
  let raw = m ? m[1] : '';
  raw = raw.replace(/&amp;/g, '&');
  return normalizeEventPhotoUrl(raw) || '';
}

async function fetchListingImage(bookingUrl, fallbackImage) {
  if (fallbackImage) return normalizeEventPhotoUrl(fallbackImage) || fallbackImage;
  if (!bookingUrl) return '';
  try {
    const html = await fetchText(bookingUrl);
    const img = extractOgImage(html);
    if (img) return img;
  } catch (e) {
    console.warn('    image fetch failed:', bookingUrl, e.message || e);
  }
  return '';
}

async function enrichGeo({ venue, addressLine1, city, postcode }) {
  const derived = deriveLocationFields({ venue, addressLine1, city, postcode });
  const outcode = parseOutcode(postcode) || null;
  let lat = null;
  let lng = null;
  let resolvedCity = city || derived.city || '';
  if (postcode) {
    const geo = await geocodeUkPostcode(postcode);
    if (geo) {
      if (geo.latitude != null) lat = geo.latitude;
      if (geo.longitude != null) lng = geo.longitude;
      if (!resolvedCity && geo.city) resolvedCity = geo.city;
    }
  }
  const locationLabel = derived.location || resolvedCity || venue || '';
  const regionSlug =
    resolveRegionSlug({
      outcode,
      postcode,
      city: resolvedCity,
      location: locationLabel,
    }) || null;
  return {
    venue: venue || '',
    addressLine1: addressLine1 || '',
    city: resolvedCity || city || '',
    postcode: postcode || '',
    location: locationLabel,
    outcode,
    lat,
    lng,
    regionSlug,
  };
}

async function eventExists(sb, organiserId, sourceIdValue, startsAtIso, titlePrefix) {
  if (sourceIdValue) {
    const bySource = await sb
      .from('events')
      .select('id, title, starts_at, checkout_mode, external_booking_url, external_price_label, airtable_id')
      .eq('airtable_id', sourceIdValue)
      .maybeSingle();
    if (!bySource.error && bySource.data) return bySource.data;
  }
  const day = String(startsAtIso || '').slice(0, 10);
  let q = sb
    .from('events')
    .select('id, title, starts_at, checkout_mode, external_booking_url, external_price_label, airtable_id')
    .eq('organiser_id', organiserId)
    .ilike('title', (titlePrefix || '') + '%')
    .limit(10);
  if (day) {
    q = q.gte('starts_at', day + 'T00:00:00.000Z').lt('starts_at', day + 'T23:59:59.999Z');
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data && data[0]) || null;
}

async function ensureOrganiser(sb, id, label) {
  const { data, error } = await sb
    .from('organisers')
    .select('id, name, slug, listing_status')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    console.log(`  · MISSING organiser ${label} (${id}) — skip related events`);
    return null;
  }
  if (APPLY && String(data.listing_status || '').toLowerCase() !== 'published') {
    await sb.from('organisers').update({ listing_status: 'published' }).eq('id', id);
    console.log(`  · published ${data.name}`);
  } else {
    console.log(`  · ok ${data.name} (/organisers/${data.slug})`);
  }
  return data.id;
}

async function publishEvent(sb, spec) {
  const existing = await eventExists(
    sb,
    spec.organiserId,
    spec.sourceId,
    spec.date,
    spec.titleMatch || spec.title.slice(0, 28)
  );
  if (existing) {
    console.log(`  · skip (already listed): ${existing.title} @ ${existing.starts_at}`);
    const needsLink =
      String(existing.checkout_mode || '') !== CHECKOUT_LINK_OUT ||
      !String(existing.external_booking_url || '').trim() ||
      (spec.sourceId && existing.airtable_id !== spec.sourceId);
    if (needsLink) await applyLinkOut(sb, existing.id, spec);
    return existing;
  }

  const geo = await enrichGeo(spec);
  const photoUrl = spec.imageUrl || (await fetchListingImage(spec.bookingUrl)) || '';
  const description = [spec.description, spec.priceNote].filter(Boolean).join('\n\n');

  const base = {
    title: spec.title,
    groupId: spec.organiserId,
    type: 'Meeting',
    eventFormat: spec.online ? 'Online' : 'In person',
    listingStatus: 'published',
    description,
    venue: geo.venue,
    addressLine1: geo.addressLine1,
    city: geo.city,
    postcode: geo.postcode,
    attendanceMode: 'tickets',
    date: spec.date,
    endDate: spec.endDate || spec.date,
    seriesGroupId: resolveSeriesGroupId(null, 1),
  };
  if (photoUrl) base.photoUrl = photoUrl;

  if (!APPLY) {
    console.log(
      `  · would publish: ${spec.title} | ${spec.date.slice(0, 16)} | ${geo.city} ${geo.postcode} | ${priceLabelFromSpec(spec)} | ${spec.sourceId}`
    );
    return null;
  }

  const ev = await createEvent(base);
  const patch = {
    city: geo.city || null,
    postcode: geo.postcode || null,
    outcode: geo.outcode,
    venue: geo.venue || null,
    address: geo.addressLine1 || null,
    location_label: geo.location || geo.city,
    region_slug: geo.regionSlug,
    status: 'published',
    approval_status: 'Approved',
    airtable_id: spec.sourceId,
  };
  if (geo.lat != null) patch.latitude = geo.lat;
  if (geo.lng != null) patch.longitude = geo.lng;
  if (photoUrl) patch.image_url = eventImageDbValue(photoUrl);

  const { error } = await sb.from('events').update(patch).eq('id', ev.id);
  if (error) console.warn('    patch failed', ev.id, error.message);
  await applyLinkOut(sb, ev.id, spec);
  console.log(`  · published: ${spec.title} · ${spec.sourceId}`);
  return ev;
}

function buildEventSpecs() {
  return [
    // —— Greater London ——
    {
      organiserId: ORG.greaterLondon,
      regionKey: 'greater-london',
      title: 'FSB Connect Networking Event, Central London - November',
      titleMatch: 'FSB Connect Networking Event, Central London',
      date: '2026-11-04T11:00:00',
      endDate: '2026-11-04T12:30:00',
      venue: 'The British Library',
      addressLine1: '96 Euston Road',
      city: 'London',
      postcode: 'NW1 2DB',
      description:
        'Monthly Central London FSB Connect at the British Library Business & IP Centre — open informal networking for FSB members and non-members.',
      priceNote: 'Free — book via Eventbrite.',
      priceLabel: 'Free',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/fsb-connect-networking-event-central-london-november-tickets-2002617391527',
      sourceId: sourceId('greater-london', '2026-11-04'),
    },
    {
      organiserId: ORG.greaterLondon,
      regionKey: 'greater-london',
      title: 'FSB Connect Wimbledon - November',
      titleMatch: 'FSB Connect Wimbledon',
      date: '2026-11-10T15:30:00',
      endDate: '2026-11-10T18:30:00',
      venue: '1-2 Wimbledon Bridge',
      addressLine1: 'Wimbledon Bridge',
      city: 'London',
      postcode: 'SW19 7NW',
      description:
        'FSB Connect Wimbledon — local SME networking with FSB membership advisers and Metro Bank support. Free to attend; booking essential.',
      priceNote: 'Free — book via FSB events.',
      priceLabel: 'Free',
      bookingUrl:
        'https://events.fsb.org.uk/en/8d2bI2X7/g/fJqTd8nh8e/fsb-connect-in-wimbledon-nov-3aJ8PzoRR/overview',
      sourceId: sourceId('greater-london', '2026-11-10'),
    },
    // —— East of England (Herts) ——
    {
      organiserId: ORG.eastOfEngland,
      regionKey: 'east-of-england',
      title: 'FSB Connect St Albans - November',
      titleMatch: 'FSB Connect St Albans - November',
      date: '2026-11-03T09:30:00',
      endDate: '2026-11-03T11:30:00',
      venue: 'Co-Space St Albans',
      addressLine1: 'Jubilee Square',
      city: 'St Albans',
      postcode: 'AL1 3TJ',
      description:
        'Morning FSB Connect networking for small businesses around St Albans — informal conversation and local connections.',
      priceNote: 'Free for FSB members · £5 for non-members — book via FSB events.',
      priceLabel: 'From £5',
      bookingUrl:
        'https://events.fsb.org.uk/en/8d2bI2X7/g/fJqTd8nh8e/fsb-connect-st-albans-nov-3aJ8PzWMT',
      sourceId: sourceId('east-of-england', '2026-11-03'),
    },
    {
      organiserId: ORG.eastOfEngland,
      regionKey: 'east-of-england',
      title: 'FSB Connect St Albans - December',
      titleMatch: 'FSB Connect St Albans - December',
      date: '2026-12-01T09:30:00',
      endDate: '2026-12-01T12:00:00',
      venue: 'Co-Space St Albans',
      addressLine1: 'Victoria Street',
      city: 'St Albans',
      postcode: 'AL1 3JJ',
      description:
        'FSB Connect St Albans — structured and informal networking for local businesses at Co-Space.',
      priceNote: 'Free for FSB members · £5 for non-members — book via FSB events.',
      priceLabel: 'From £5',
      bookingUrl:
        'https://events.fsb.org.uk/en/g/fJqTd8nh8e/fsb-connect-st-albans-dec-3aJ8PzWO5/overview',
      sourceId: sourceId('east-of-england', '2026-12-01'),
    },

    // —— Wales ——
    {
      organiserId: ORG.wales,
      regionKey: 'wales',
      title: 'FSB Connect South East Wales - December (Cardiff)',
      titleMatch: 'FSB Connect South East Wales - December',
      date: '2026-12-03T09:00:00',
      endDate: '2026-12-03T11:30:00',
      venue: 'Space2B@The Maltings',
      addressLine1: 'East Tyndall Street',
      city: 'Cardiff',
      postcode: 'CF24 5EA',
      description:
        'FSB Connect South East Wales in Cardiff — introductions, informal networking and small-business support at Space2B.',
      priceNote: 'From £5 — book via FSB events.',
      priceLabel: 'From £5',
      bookingUrl:
        'https://events.fsb.org.uk/en/8d2bI2X7/g/fJqTd8nh8e/fsb-connect-south-east-wales-december-3aJ8PzmXh/overview',
      sourceId: sourceId('wales', '2026-12-03'),
    },
    {
      organiserId: ORG.wales,
      regionKey: 'wales',
      title: 'FSB Connect North Wales - December',
      titleMatch: 'FSB Connect North Wales - December',
      date: '2026-12-16T09:30:00',
      endDate: '2026-12-16T11:00:00',
      venue: 'Coleg Cambria Business School',
      addressLine1: 'Holywell Road, Northop',
      city: 'Mold',
      postcode: 'CH7 6AA',
      description:
        'Monthly FSB Connect North Wales — open to members and non-members for face-to-face small-business networking.',
      priceNote: 'Free — book via FSB events.',
      priceLabel: 'Free',
      bookingUrl:
        'https://events.fsb.org.uk/en/8d2bI2X7/g/fJqTd8nh8e/fsb-connect-in-north-wales-3aJ8Pz9Cz/overview',
      sourceId: sourceId('wales', '2026-12-16'),
    },
    {
      organiserId: ORG.wales,
      regionKey: 'wales',
      title: 'FSB Connect Online in Wales - 10 December',
      titleMatch: 'FSB Connect Online in Wales',
      date: '2026-12-10T13:00:00',
      endDate: '2026-12-10T14:00:00',
      venue: '',
      addressLine1: '',
      city: 'Online',
      postcode: '',
      online: true,
      description: 'Online FSB Connect for Wales — join remotely for networking and updates.',
      priceNote: 'Free — book via FSB events.',
      priceLabel: 'Free',
      bookingUrl:
        'https://events.fsb.org.uk/en/8d2bI2X7/g/fJqTd8nh8e/fsb-connect-online-in-wales-10-december-3aJ8PzndR/overview',
      sourceId: sourceId('wales', '2026-12-10'),
    },

    // —— Scotland (ensure Glasgow Link Out stays correct) ——
    {
      organiserId: ORG.scotland,
      regionKey: 'scotland',
      title: 'FSB Connect Glasgow - Oct',
      titleMatch: 'FSB Connect Glasgow',
      date: '2026-10-29T10:00:00',
      endDate: '2026-10-29T12:00:00',
      venue: 'FSB Scotland Office',
      addressLine1: '58 Waterloo Street',
      city: 'Glasgow',
      postcode: 'G2 7DA',
      description:
        'Popular FSB Connect networking for small businesses and the self-employed at the FSB Scotland office.',
      priceNote: 'Free for FSB members and non-members — book via FSB events.',
      priceLabel: 'Free',
      bookingUrl:
        'https://events.fsb.org.uk/en/8d2bI2X7/g/fJqTd8nh8e/fsb-connect-glasgow-oct-3aJ8Pziib',
      sourceId: sourceId('scotland', '2026-10-29'),
    },

    // —— North West ——
    {
      organiserId: ORG.northWest,
      regionKey: 'north-west',
      title: 'FSB Connect Liverpool - October',
      titleMatch: 'FSB Connect Liverpool - October',
      date: '2026-10-29T17:00:00',
      endDate: '2026-10-29T19:00:00',
      venue: 'The Municipal Hotel & Spa Liverpool - MGallery',
      addressLine1: 'Dale Street',
      city: 'Liverpool',
      postcode: 'L2 2DH',
      description:
        'FSB Connect Liverpool with Colony Networking — evening networking for Merseyside small businesses at the Municipal Hotel.',
      priceNote: 'Book via FSB events.',
      priceLabel: 'Tickets available',
      bookingUrl:
        'https://events.fsb.org.uk/en/8d2bI2X7/g/fJqTd8nh8e/fsb-connect-liverpool-nov-3aJ8PzNFx',
      sourceId: sourceId('north-west', '2026-10-29'),
    },

    // —— Brighton (dedicated Connect organiser page) ——
    {
      organiserId: ORG.brighton,
      regionKey: 'brighton',
      title: 'FSB Connect Brighton - November',
      titleMatch: 'FSB Connect Brighton - November',
      date: '2026-11-12T10:00:00',
      endDate: '2026-11-12T12:00:00',
      venue: 'Brighton Marina Yacht Club',
      addressLine1: 'Brighton Marina',
      city: 'Brighton',
      postcode: 'BN2 5UF',
      description:
        'Monthly FSB Connect Brighton at Brighton Marina Yacht Club — second Thursday networking for members and non-members.',
      priceNote: 'Book via FSB events.',
      priceLabel: 'Tickets available',
      bookingUrl:
        'https://events.fsb.org.uk/en/8d2bI2X7/g/fJqTd8nh8e/fsb-connect-in-brighton-3aJ8P2pgr',
      sourceId: sourceId('brighton', '2026-11-12'),
    },

    // —— Yorkshire ——
    {
      organiserId: ORG.yorkshire,
      regionKey: 'yorkshire',
      title: 'FSB Connect Networking event, Ibis Styles Barnsley - October',
      titleMatch: 'FSB Connect Networking event, Ibis Styles Barnsley',
      date: '2026-10-28T10:00:00',
      endDate: '2026-10-28T12:00:00',
      venue: 'ibis Styles Barnsley',
      addressLine1: 'Whinby Road, Dodworth',
      city: 'Barnsley',
      postcode: 'S75 3TX',
      description:
        'FSB Connect South Yorkshire networking at Ibis Styles Barnsley — welcoming, networking-first session for local small businesses.',
      priceNote: 'Free — book via Eventbrite.',
      priceLabel: 'Free',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/fsb-connect-networking-event-with-ibis-styles-barnsley-october-tickets-2002625798673',
      sourceId: sourceId('yorkshire', '2026-10-28'),
    },
  ];
}

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }
  const sb = getSupabaseAdmin();
  console.log(APPLY ? 'APPLY mode — writing to Supabase' : 'DRY-RUN — pass --apply to write');
  console.log('FSB coverage: map Connect events → existing regional organisers + Link Out booking URLs');
  console.log('Source tag prefix:', SOURCE_PREFIX);

  console.log('\n1) Confirm FSB organiser pages');
  const needed = [
    ['greaterLondon', ORG.greaterLondon, 'FSB Greater London'],
    ['eastOfEngland', ORG.eastOfEngland, 'FSB East of England'],
    ['wales', ORG.wales, 'FSB Wales'],
    ['scotland', ORG.scotland, 'FSB Scotland'],
    ['northWest', ORG.northWest, 'FSB North West'],
    ['yorkshire', ORG.yorkshire, 'FSB Yorkshire'],
    ['brighton', ORG.brighton, 'FSB Connect Brighton'],
  ];
  const ok = new Set();
  for (const [key, id, label] of needed) {
    const found = await ensureOrganiser(sb, id, label);
    if (found) ok.add(id);
  }

  console.log('\n2) Publish / refresh FSB events with Link Out');
  for (const spec of buildEventSpecs()) {
    if (!ok.has(spec.organiserId)) {
      console.log(`  · skip ${spec.title} — organiser missing`);
      continue;
    }
    await publishEvent(sb, spec);
  }

  console.log(
    '\nDone.',
    APPLY
      ? 'Check FSB organiser pages + Command Centre (fsb-coverage tags).'
      : 'Re-run with --apply to write.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
