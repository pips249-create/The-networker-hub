#!/usr/bin/env node
/**
 * North London Meetup coverage gaps (curated Link Out import).
 *
 * Criteria (The Networker UK):
 *  - UK business / professional networking (meetings, founder nights, sector networking)
 *  - Not social walks, dating, hobby-only, or pure lecture nights without networking
 *  - Organiser page first (create or match), then events
 *  - Link Out to the real book URL (Meetup page and/or Eventbrite checkout)
 *
 * Missing organiser email:
 *  - Use hi@thenetworkeruk.com as a staff placeholder
 *  - Create published with no claim/invite email (same as Glasgow / Brighton)
 *  - Do not invent personal organiser emails
 *
 * Source tag (admin):
 *  - events.airtable_id = meetup-coverage:<group-slug>:<YYYY-MM-DD>
 *  - Lets Command Centre show a "Meetup coverage" badge and keeps imports idempotent
 *
 * Usage:
 *   node scripts/import-north-london-meetup-coverage.js            # dry-run
 *   node scripts/import-north-london-meetup-coverage.js --apply    # write to Supabase
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
const { createGroup } = require('../api/_lib/supabase-organiser');
const { assignUniqueOrganiserSlug } = require('../api/_lib/organiser-slug');
const { createEvent, createEventsForOccurrences, resolveSeriesGroupId } =
  require('../api/_lib/supabase-organiser-events');
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
const STAFF_PLACEHOLDER_EMAIL = 'hi@thenetworkeruk.com';
const SOURCE_PREFIX = 'meetup-coverage';

/** Criteria checklist — only curated rows that pass these go in NEW_GROUPS / buildEventSpecs. */
const CRITERIA = {
  region: 'North London (Colindale / NW9, Euston NW1 branded North London, Barnet corridor)',
  include: [
    'Business owners, founders, professionals networking',
    'Structured or open networking with introductions',
    'In-person UK meetings',
  ],
  exclude: [
    'Social walks / pub socials without business purpose',
    'Dating / make-friends speed socials',
    'Hobby or leisure meetups',
    'Central London Networx-style nights (covered separately)',
  ],
};

const NEW_GROUPS = [
  {
    key: 'entrepreneursInNorthLondon',
    name: 'Entrepreneurs in North London',
    email: STAFF_PLACEHOLDER_EMAIL,
    website: 'https://www.meetup.com/northlondonentrepreneurs/',
    description:
      'Monthly networking evenings for entrepreneurs, business owners, professionals and community leaders across Colindale and North / North West London — speed networking, short introductions, then open conversation.',
    photoUrl: 'https://secure.meetupstatic.com/photos/event/7/2/6/8/600_536729288.jpeg',
    meetupSlug: 'northlondonentrepreneurs',
  },
  {
    key: 'techieBrunchClub',
    name: 'The Techie Brunch Club',
    email: STAFF_PLACEHOLDER_EMAIL,
    website: 'https://www.meetup.com/the-techie-brunch-club/',
    description:
      'In-person tech and founder networking across London — North London Tech Community Days bring developers, designers, engineers and entrepreneurs together to meet collaborators and mentors.',
    photoUrl: 'https://secure.meetupstatic.com/photos/event/c/1/7/4/600_532309524.jpeg',
    meetupSlug: 'the-techie-brunch-club',
  },
];

function sourceId(meetupSlug, ymd) {
  return SOURCE_PREFIX + ':' + String(meetupSlug || 'group').trim() + ':' + String(ymd || '').trim();
}

function bookingBlurb(url, priceNote, { linkOut } = {}) {
  const lines = [];
  if (priceNote) lines.push(priceNote);
  if (url && !linkOut) lines.push('Book / reserve: ' + url);
  return lines.join('\n\n');
}

function priceLabelFromSpec(spec) {
  if (spec.priceLabel) return normalizeExternalPriceLabel(spec.priceLabel);
  const note = String(spec.priceNote || '');
  if (/\bfree\b/i.test(note) && !/£\d/.test(note)) return 'Free';
  const from = note.match(/From\s*£[\d,.]+/i);
  if (from) return normalizeExternalPriceLabel(from[0]);
  const pound = note.match(/£[\d,.]+/);
  if (pound) return normalizeExternalPriceLabel(pound[0]);
  return 'Tickets available';
}

function linkOutUrlFromSpec(spec) {
  const raw = String(spec.bookingUrl || spec.linkOutUrl || '').trim();
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
    console.log(`  · would Link Out ${eventId}: ${priceLabel} → ${url.slice(0, 80)}`);
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
  else console.log(`  · Link Out set: ${priceLabel}${spec.sourceId ? ' · tagged ' + spec.sourceId : ''}`);
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
  if (!m) m = html.match(/name=["']twitter:image["']\s+content=["']([^"']+)/i);
  let raw = m ? m[1] : '';
  raw = raw.replace(/&amp;/g, '&');
  const normalised = normalizeEventPhotoUrl(raw);
  if (normalised) return normalised;
  const cdn = html.match(/https?:\/\/(?:cdn\.evbuc\.com|secure\.meetupstatic\.com)\/[^\s"'<>]+/i);
  return cdn ? normalizeEventPhotoUrl(cdn[0]) : '';
}

function isWeakImageUrl(url) {
  const u = String(url || '').toLowerCase();
  if (!u) return true;
  if (/favicon|pfavico|apple-touch|navBar_titleImage|logo[_-]?only|\.ico(\?|$)/i.test(u)) return true;
  if (/unsplash\.com/i.test(u)) return true;
  if (/event-placeholder|\/assets\/placeholders\//i.test(u)) return true;
  return false;
}

async function fetchListingImage(bookingUrl, fallbackImage) {
  if (fallbackImage && !isWeakImageUrl(fallbackImage)) {
    return normalizeEventPhotoUrl(fallbackImage) || fallbackImage;
  }
  if (!bookingUrl) return '';
  try {
    const html = await fetchText(bookingUrl);
    const img = extractOgImage(html);
    if (img && !isWeakImageUrl(img)) return img;
  } catch (e) {
    console.warn('    image fetch failed:', bookingUrl, e.message || e);
  }
  return fallbackImage && !isWeakImageUrl(fallbackImage)
    ? normalizeEventPhotoUrl(fallbackImage) || fallbackImage
    : '';
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
    }) || 'north-london';
  return {
    venue: venue || '',
    addressLine1: addressLine1 || '',
    city: resolvedCity || 'London',
    postcode: postcode || '',
    location: locationLabel,
    outcode,
    lat,
    lng,
    regionSlug,
  };
}

async function ensureNewGroup(sb, spec, createdMap) {
  const { data: byName } = await sb
    .from('organisers')
    .select('id, name, listing_status, slug, email')
    .ilike('name', spec.name)
    .limit(1)
    .maybeSingle();
  if (byName) {
    console.log(`  · already exists: ${byName.name} (${byName.id})`);
    if (APPLY) {
      const patch = { listing_status: 'published' };
      if (spec.website) patch.website = spec.website;
      if (spec.description) patch.description = spec.description;
      if (spec.photoUrl) patch.photo_url = spec.photoUrl;
      await sb.from('organisers').update(patch).eq('id', byName.id);
      console.log('    published / refreshed (no invite email)');
    }
    createdMap[spec.key] = byName.id;
    return byName.id;
  }

  if (!APPLY) {
    console.log(`  · would create published group (no invite): ${spec.name} <${spec.email}>`);
    createdMap[spec.key] = `dry-run:${spec.key}`;
    return createdMap[spec.key];
  }

  const created = await createGroup({
    name: spec.name,
    contactEmail: spec.email,
    email: spec.email,
    description: spec.description,
    website: spec.website,
    listingStatus: 'published',
    verificationStatus: 'Pending',
    logoUrl: spec.photoUrl || undefined,
  });
  try {
    await assignUniqueOrganiserSlug(sb, created.id, spec.name);
  } catch (e) {
    console.warn('    slug assign failed:', e.message || e);
  }
  console.log(`  · created published group (no invite): ${spec.name} (${created.id})`);
  createdMap[spec.key] = created.id;
  return created.id;
}

async function eventExists(sb, organiserId, titlePrefix, sourceIdValue) {
  if (String(organiserId).startsWith('dry-run:')) return false;
  if (sourceIdValue) {
    const bySource = await sb
      .from('events')
      .select('id, title, starts_at, image_url, checkout_mode, external_booking_url, external_price_label, airtable_id')
      .eq('airtable_id', sourceIdValue)
      .maybeSingle();
    if (!bySource.error && bySource.data) return bySource.data;
  }
  const { data, error } = await sb
    .from('events')
    .select('id, title, starts_at, image_url, checkout_mode, external_booking_url, external_price_label, airtable_id')
    .eq('organiser_id', organiserId)
    .ilike('title', titlePrefix + '%')
    .gte('starts_at', new Date().toISOString())
    .limit(5);
  if (error) throw new Error(error.message);
  return (data && data[0]) || null;
}

function wantsLinkOut(spec) {
  return Boolean(linkOutUrlFromSpec(spec));
}

async function publishEvent(sb, organiserId, spec) {
  const useLinkOut = wantsLinkOut(spec);
  const existing = await eventExists(
    sb,
    organiserId,
    spec.titleMatch || spec.title.slice(0, 28),
    spec.sourceId
  );
  if (existing) {
    console.log(`  · skip (already listed): ${existing.title} @ ${existing.starts_at}`);
    if (
      useLinkOut &&
      (String(existing.checkout_mode || '') !== CHECKOUT_LINK_OUT ||
        !String(existing.external_booking_url || '').trim() ||
        !String(existing.external_price_label || '').trim() ||
        (spec.sourceId && existing.airtable_id !== spec.sourceId))
    ) {
      await applyLinkOut(sb, existing.id, spec);
    }
    return existing;
  }

  const geo = await enrichGeo(spec);
  const description = [spec.description, bookingBlurb(spec.bookingUrl, spec.priceNote, { linkOut: useLinkOut })]
    .filter(Boolean)
    .join('\n\n');
  const photoUrl =
    spec.imageUrl ||
    (await fetchListingImage(spec.bookingUrl, spec.fallbackImage)) ||
    '';

  const base = {
    title: spec.title,
    groupId: organiserId,
    type: spec.eventType || 'Meeting',
    eventFormat: 'In person',
    listingStatus: 'published',
    description,
    venue: geo.venue,
    addressLine1: geo.addressLine1,
    city: geo.city,
    postcode: geo.postcode,
    attendanceMode: spec.attendanceMode || 'tickets',
  };
  if (photoUrl) base.photoUrl = photoUrl;

  if (!APPLY) {
    console.log(
      `  · would publish: ${spec.title} | ${spec.date || (spec.occurrences || []).length + ' dates'} | ${geo.city} ${geo.postcode} | ${spec.sourceId || 'no-source-tag'} | linkOut=${useLinkOut ? priceLabelFromSpec(spec) : 'no'}`
    );
    return null;
  }

  if (String(organiserId).startsWith('dry-run:')) {
    console.log('  · skip create — organiser was dry-run');
    return null;
  }

  const occurrences = (spec.occurrences || [{ date: spec.date, endDate: spec.endDate }]).map((o) => ({
    date: o.date,
    endDate: o.endDate || o.date,
  }));
  const seriesGroupId = resolveSeriesGroupId(null, occurrences.length);
  let events;
  if (occurrences.length === 1) {
    events = [
      await createEvent({
        ...base,
        seriesGroupId,
        date: occurrences[0].date,
        endDate: occurrences[0].endDate,
      }),
    ];
  } else {
    const result = await createEventsForOccurrences(
      { ...base, seriesGroupId },
      occurrences,
      seriesGroupId,
      null
    );
    events = result.events;
  }

  const patch = {
    city: geo.city,
    postcode: geo.postcode || null,
    outcode: geo.outcode,
    venue: geo.venue || null,
    address: geo.addressLine1 || null,
    location_label: geo.location || geo.city,
    region_slug: geo.regionSlug,
    status: 'published',
    approval_status: 'Approved',
  };
  if (geo.lat != null) patch.latitude = geo.lat;
  if (geo.lng != null) patch.longitude = geo.lng;
  if (photoUrl) patch.image_url = eventImageDbValue(photoUrl);
  if (spec.sourceId) patch.airtable_id = spec.sourceId;

  for (const ev of events) {
    const { error } = await sb.from('events').update(patch).eq('id', ev.id);
    if (error) console.warn('    geo/image/source patch failed', ev.id, error.message);
    if (useLinkOut) await applyLinkOut(sb, ev.id, spec);
  }

  console.log(
    `  · published ${events.length} date(s): ${spec.title}${photoUrl ? ' (with listing image)' : ' (no image found)'}${useLinkOut ? ' + Link Out' : ''}${spec.sourceId ? ' · ' + spec.sourceId : ''}`
  );
  return events[0];
}

function buildEventSpecs(createdMap) {
  const einl = createdMap.entrepreneursInNorthLondon;
  const techie = createdMap.techieBrunchClub;

  // First Monday monthly at The Beaufort (organiser skips January 2027).
  const einlDates = [
    { date: '2026-11-02T19:30:00', endDate: '2026-11-02T21:30:00' },
    { date: '2026-12-07T19:30:00', endDate: '2026-12-07T21:30:00' },
    { date: '2027-02-01T19:30:00', endDate: '2027-02-01T21:30:00' },
    { date: '2027-03-01T19:30:00', endDate: '2027-03-01T21:30:00' },
    { date: '2027-04-05T19:30:00', endDate: '2027-04-05T21:30:00' },
    { date: '2027-05-03T19:30:00', endDate: '2027-05-03T21:30:00' },
  ];

  const specs = [];

  for (const o of einlDates) {
    const ymd = o.date.slice(0, 10);
    specs.push({
      organiserId: einl,
      title: 'Network with NW London entrepreneurs, business owners & community leaders',
      titleMatch: 'Network with NW London entrepreneurs',
      eventType: 'Meeting',
      date: o.date,
      endDate: o.endDate,
      venue: 'The Beaufort',
      addressLine1: '2 Heritage Avenue, Grahame Park Way',
      city: 'London',
      postcode: 'NW9 5AA',
      description:
        'Monthly North London networking evening in Colindale for entrepreneurs, business owners, professionals and community leaders. Speed networking and one-minute introductions, then open networking — relationship-building, not hard pitching.',
      priceNote: '£5 advance on Eventbrite · £10 on the door',
      priceLabel: '£5',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/network-with-nw-london-entrepreneurs-business-owners-community-leaders-tickets-2000591906246',
      imageUrl: 'https://secure.meetupstatic.com/photos/event/7/2/6/8/600_536729288.jpeg',
      sourceId: sourceId('northlondonentrepreneurs', ymd),
      meetupUrl: 'https://www.meetup.com/northlondonentrepreneurs/',
      fitsCriteria:
        'Business networking meeting for owners/founders/professionals in North London (Colindale NW9).',
    });
  }

  specs.push({
    organiserId: techie,
    title: 'North London Tech Community Days: December 2026 Networking',
    titleMatch: 'North London Tech Community Days: December 2026',
    eventType: 'Meeting',
    date: '2026-12-05T14:00:00',
    endDate: '2026-12-05T17:00:00',
    venue: 'Exmouth Arms',
    addressLine1: '1 Starcross Street',
    city: 'London',
    postcode: 'NW1 2HR',
    description:
      'North London Tech Community Days — informal networking for people in and around tech (founders, engineers, designers and collaborators). Meet new people, share experience and find mentors or partners over drinks.',
    priceNote: 'Free entry · food and drinks paid at the venue',
    priceLabel: 'Free',
    bookingUrl: 'https://www.meetup.com/the-techie-brunch-club/events/316678627/',
    imageUrl: 'https://secure.meetupstatic.com/photos/event/c/1/7/4/600_532309524.jpeg',
    sourceId: sourceId('the-techie-brunch-club', '2026-12-05'),
    fitsCriteria:
      'Branded North London professional networking (tech + founders); Meeting type, not a social walk.',
  });

  return specs;
}

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }
  const sb = getSupabaseAdmin();
  console.log(APPLY ? 'APPLY mode — writing to Supabase' : 'DRY-RUN — pass --apply to write');
  console.log('Region: North London Meetup coverage (curated; no scrape bot).');
  console.log('Criteria include:', CRITERIA.include.join('; '));
  console.log('Criteria exclude:', CRITERIA.exclude.join('; '));
  console.log('Missing emails →', STAFF_PLACEHOLDER_EMAIL, '(no invite).');
  console.log('Source tag → airtable_id prefix', SOURCE_PREFIX + ':…');

  console.log('\n1) Ensure organiser pages first (published, no invite email)');
  const createdMap = {};
  for (const spec of NEW_GROUPS) {
    await ensureNewGroup(sb, spec, createdMap);
  }

  console.log('\n2) Add North London Meetup-fit events (+ Link Out + source tag)');
  for (const spec of buildEventSpecs(createdMap)) {
    const orgId = spec.organiserId;
    if (!orgId) {
      console.log(`  · skip ${spec.title} — missing organiser id`);
      continue;
    }
    console.log(`  · criteria: ${spec.fitsCriteria}`);
    await publishEvent(sb, orgId, spec);
  }

  console.log(
    '\nDone.',
    APPLY
      ? 'Review Colindale / North London listings in Command Centre (Meetup coverage badge).'
      : 'Re-run with --apply to write.'
  );
  console.log(
    'Skipped (do not fit Meetup+criteria for this pass): social walks, Networx central London, Athena/BNI Eventbrite-only nights without a Meetup listing.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
