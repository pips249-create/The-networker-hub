#!/usr/bin/env node
/**
 * Bournemouth / BCP coverage: unclaimed organiser shells + listing-backed dates
 * only (no cadence guesses). Claim/invite emails stay off.
 * Never writes events for claimed/paying organisers (TOP, ticketed clubs, etc.).
 * --apply also removes previously invented projected dates (see PROJECTED_REMOVE).
 *
 *   node scripts/import-bournemouth-coverage.js
 *   node scripts/import-bournemouth-coverage.js --apply
 *
 * Hub filter outcodes: BH1–BH12, BH23. Listings in BH15/BH18/BH22 may sit on
 * organiser pages but outside /networking/bournemouth.
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

const BNI_LOGO =
  'https://uztgzbjrmjbonfniyqcu.supabase.co/storage/v1/object/public/organiser-assets/organisers/bulk/1780850310450-ruf56lv5.png';
const BNI_CDN_LOGO = 'https://cdn.bniconnectglobal.com/new_template/assets/appicon/socialmedia.png';

/**
 * Never invent dates for claimed / paying organisers (e.g. TOP Networking).
 * They own their calendar; coverage imports only fill unclaimed shells.
 */
async function isClaimedOrPayingOrganiser(sb, organiserId) {
  if (!organiserId || String(organiserId).startsWith('dry-run:')) return false;
  const { data, error } = await sb
    .from('organisers')
    .select(
      'id, name, ownership_claim_status, stripe_account_id, supabase_user_id, organiser_account_id'
    )
    .eq('id', organiserId)
    .maybeSingle();
  if (error || !data) return true; // fail closed
  const claim = String(data.ownership_claim_status || '').toLowerCase();
  if (claim === 'claimed' || claim === 'disputed') return true;
  if (String(data.stripe_account_id || '').trim()) return true;
  if (String(data.supabase_user_id || '').trim()) return true;
  if (String(data.organiser_account_id || '').trim()) return true;
  return false;
}

function fetchText(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const lib = String(url).startsWith('http://') ? http : https;
    const req = lib.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TheNetworkerUK/1.0)',
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
      reject(new Error('timeout'));
    });
  });
}

function extractOgImage(html) {
  if (!html) return '';
  let m = html.match(/property=["']og:image["']\s+content=["']([^"']+)/i);
  if (!m) m = html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);
  let raw = m ? m[1].replace(/&amp;/g, '&') : '';
  return normalizeEventPhotoUrl(raw) || raw;
}

async function fetchOg(url) {
  try {
    return extractOgImage(await fetchText(url));
  } catch {
    return '';
  }
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
  return {
    venue: venue || '',
    addressLine1: addressLine1 || '',
    city: resolvedCity || city || 'Bournemouth',
    postcode: postcode || '',
    location: locationLabel,
    outcode,
    lat,
    lng,
    regionSlug:
      resolveRegionSlug({
        outcode,
        postcode,
        city: resolvedCity || city,
        location: locationLabel,
      }) || 'bournemouth',
  };
}

async function ensureGroup(sb, spec) {
  if (spec.preferExistingId) {
    const { data } = await sb
      .from('organisers')
      .select('id, listing_status')
      .eq('id', spec.preferExistingId)
      .maybeSingle();
    if (data) {
      if (await isClaimedOrPayingOrganiser(sb, data.id)) {
        console.log(`  · reuse claimed/paying ${spec.name} (read-only — no event writes)`);
        return data.id;
      }
      if (String(data.listing_status || '').toLowerCase() !== 'published' && APPLY) {
        await sb.from('organisers').update({ listing_status: 'published' }).eq('id', data.id);
      }
      return data.id;
    }
  }
  const { data: byName } = await sb
    .from('organisers')
    .select('id, listing_status')
    .ilike('name', spec.name)
    .limit(1)
    .maybeSingle();
  if (byName) {
    if (await isClaimedOrPayingOrganiser(sb, byName.id)) {
      console.log(`  · found claimed/paying ${spec.name} (read-only — no event writes)`);
      return byName.id;
    }
    if (String(byName.listing_status || '').toLowerCase() !== 'published' && APPLY) {
      await sb.from('organisers').update({ listing_status: 'published' }).eq('id', byName.id);
    }
    return byName.id;
  }
  if (!APPLY) {
    console.log(`  · would create group ${spec.name}`);
    return `dry-run:${spec.key}`;
  }
  const created = await createGroup({
    name: spec.name,
    contactEmail: spec.email,
    email: spec.email,
    description: spec.description,
    website: spec.website,
    listingStatus: 'published',
    verificationStatus: 'Pending',
  });
  try {
    await assignUniqueOrganiserSlug(sb, created.id, spec.name);
  } catch (_) {
    /* ignore */
  }
  if (spec.photoUrl) {
    await sb.from('organisers').update({ photo_url: spec.photoUrl }).eq('id', created.id);
  }
  console.log(`  · created ${spec.name}`);
  return created.id;
}

async function applyLinkOut(sb, eventId, bookingUrl, priceLabel) {
  const url = normalizeExternalBookingUrl(preferEventbriteCheckoutUrl(bookingUrl));
  const label = normalizeExternalPriceLabel(priceLabel);
  if (!url || !label) return;
  if (!APPLY) {
    console.log(`    · would Link Out ${eventId}: ${label}`);
    return;
  }
  const { error } = await sb
    .from('events')
    .update({
      checkout_mode: CHECKOUT_LINK_OUT,
      external_booking_url: url,
      external_price_label: label,
      ticket_sales_enabled: true,
    })
    .eq('id', eventId);
  if (error) console.warn('    Link Out failed', eventId, error.message);
}

async function dateExists(sb, organiserId, titlePrefix, day) {
  if (String(organiserId).startsWith('dry-run:')) return false;
  const start = day + 'T00:00:00.000Z';
  const end = day + 'T23:59:59.999Z';
  const { data, error } = await sb
    .from('events')
    .select('id')
    .eq('organiser_id', organiserId)
    .ilike('title', titlePrefix + '%')
    .gte('starts_at', start)
    .lte('starts_at', end)
    .limit(1);
  if (error) throw new Error(error.message);
  return Boolean(data && data[0]);
}

function eachWeekday(fromIsoDate, toIsoDate, weekday /* 0=Sun … 5=Fri */) {
  const out = [];
  const d = new Date(fromIsoDate + 'T12:00:00Z');
  const end = new Date(toIsoDate + 'T12:00:00Z');
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

/**
 * Dates previously invented from monthly cadence (not each backed by a listing).
 * Removed on --apply so the hub only keeps listing-backed rows.
 */
const PROJECTED_REMOVE = [
  // Property Wave — keep 2026-11-04 only
  { titleMatch: 'Property Wave Networking Event', days: ['2026-12-02', '2027-01-06', '2027-02-03', '2027-03-03'] },
  // Ladies Who Latte — keep 2026-11-10 only
  {
    titleMatch: 'Bournemouth Ladies Who Latte',
    days: ['2026-12-08', '2027-01-12', '2027-02-09', '2027-03-09'],
  },
  // BCP — keep 2026-11-11 + 2026-12-02 only
  {
    titleMatch: 'BCP Business Network Bournemouth',
    days: ['2027-01-13', '2027-02-10', '2027-03-10'],
  },
  // BH Banter Q1 seeds (never listing-backed)
  { titleMatch: 'BH Banter', days: ['2027-01-20', '2027-02-17', '2027-03-17'] },
];

async function removeProjectedDates(sb) {
  console.log('\n0) Remove previously projected (non-listing-backed) dates');
  for (const spec of PROJECTED_REMOVE) {
    for (const day of spec.days) {
      const start = day + 'T00:00:00.000Z';
      const end = day + 'T23:59:59.999Z';
      const { data, error } = await sb
        .from('events')
        .select('id, title, starts_at, organiser_id')
        .ilike('title', spec.titleMatch + '%')
        .gte('starts_at', start)
        .lte('starts_at', end);
      if (error) {
        console.warn('  · lookup failed', spec.titleMatch, day, error.message);
        continue;
      }
      if (!data || !data.length) {
        console.log(`  · none: ${spec.titleMatch} @ ${day}`);
        continue;
      }
      for (const row of data) {
        if (await isClaimedOrPayingOrganiser(sb, row.organiser_id)) {
          console.log(`  · skip delete (claimed/paying): ${row.title} @ ${day}`);
          continue;
        }
        if (!APPLY) {
          console.log(`  · would delete: ${row.title} @ ${day} (${row.id})`);
          continue;
        }
        const { error: delErr } = await sb.from('events').delete().eq('id', row.id);
        if (delErr) console.warn('  · delete failed', row.id, delErr.message);
        else console.log(`  · deleted: ${row.title} @ ${day}`);
      }
    }
  }
}

async function publishOne(sb, organiserId, spec, seriesGroupId) {
  const day = String(spec.date).slice(0, 10);
  const titleMatch = spec.titleMatch || spec.title.slice(0, 28);
  if (await isClaimedOrPayingOrganiser(sb, organiserId)) {
    console.log(`  · skip claimed/paying organiser — not writing: ${spec.title}`);
    return;
  }
  if (await dateExists(sb, organiserId, titleMatch, day)) {
    console.log(`  · skip exists: ${spec.title} @ ${day}`);
    return;
  }
  const geo = await enrichGeo(spec);
  const photoUrl =
    spec.imageUrl || (spec.bookingUrl ? await fetchOg(spec.bookingUrl) : '') || spec.fallbackImage || '';
  if (!APPLY) {
    console.log(`  · would publish: ${spec.title} | ${day} | ${spec.priceLabel || ''}`);
    return;
  }
  const ev = await createEvent({
    title: spec.title,
    groupId: organiserId,
    type: spec.eventType || 'Meeting',
    eventFormat: spec.eventFormat || 'In person',
    listingStatus: 'published',
    description: spec.description,
    venue: geo.venue,
    addressLine1: geo.addressLine1,
    city: geo.city,
    postcode: geo.postcode,
    attendanceMode: spec.attendanceMode || 'tickets',
    seriesGroupId: seriesGroupId || undefined,
    date: spec.date,
    endDate: spec.endDate,
    photoUrl: photoUrl || undefined,
  });
  const patch = {
    city: geo.city,
    postcode: geo.postcode,
    outcode: geo.outcode,
    venue: geo.venue,
    address: geo.addressLine1,
    location_label: geo.location || geo.city,
    region_slug: geo.regionSlug,
    status: 'published',
    approval_status: 'Approved',
  };
  if (photoUrl) patch.image_url = eventImageDbValue(photoUrl);
  if (geo.lat != null) patch.latitude = geo.lat;
  if (geo.lng != null) patch.longitude = geo.lng;
  if (seriesGroupId) patch.series_group_id = seriesGroupId;
  await sb.from('events').update(patch).eq('id', ev.id);
  if (spec.bookingUrl) await applyLinkOut(sb, ev.id, spec.bookingUrl, spec.priceLabel || 'Tickets available');
  console.log(`  · published: ${spec.title} @ ${day}`);
}

async function extendSeries(sb, spec) {
  console.log(`\n· ${spec.name}`);
  if (await isClaimedOrPayingOrganiser(sb, spec.organiserId)) {
    console.log('  · skip — organiser is claimed/paying (they manage their own dates)');
    return;
  }
  const days = spec.days || [];
  const geo = await enrichGeo(spec);
  let seriesGroupId = spec.seriesGroupId || null;
  if (!seriesGroupId) {
    const { data: existing } = await sb
      .from('events')
      .select('id, series_group_id, image_url')
      .eq('organiser_id', spec.organiserId)
      .ilike('title', spec.titleMatch + '%')
      .order('starts_at', { ascending: false })
      .limit(1);
    if (existing && existing[0]) {
      seriesGroupId = existing[0].series_group_id || resolveSeriesGroupId(null, 2);
    } else {
      seriesGroupId = resolveSeriesGroupId(null, 2);
    }
  }
  const photoUrl =
    spec.imageUrl ||
    (spec.bookingUrl ? normalizeEventPhotoUrl(await fetchOg(spec.bookingUrl)) : '') ||
    spec.fallbackImage ||
    '';

  let created = 0;
  let skipped = 0;
  for (const day of days) {
    if (await dateExists(sb, spec.organiserId, spec.titleMatch, day)) {
      skipped++;
      continue;
    }
    const starts = `${day}T${spec.startTime || '07:00:00'}${spec.tzSuffix || '+00:00'}`;
    const ends = `${day}T${spec.endTime || '09:00:00'}${spec.tzSuffix || '+00:00'}`;
    if (!APPLY) {
      console.log(`  · would add ${day}`);
      created++;
      continue;
    }
    const ev = await createEvent({
      title: spec.title,
      groupId: spec.organiserId,
      type: 'Meeting',
      eventFormat: 'In person',
      listingStatus: 'published',
      description: spec.description,
      venue: geo.venue,
      addressLine1: geo.addressLine1,
      city: geo.city,
      postcode: geo.postcode,
      attendanceMode: spec.attendanceMode || 'membership_meeting',
      seriesGroupId,
      date: starts,
      endDate: ends,
      photoUrl: photoUrl || undefined,
    });
    const patch = {
      city: geo.city,
      postcode: geo.postcode,
      outcode: geo.outcode,
      venue: geo.venue,
      address: geo.addressLine1,
      location_label: geo.location || geo.city,
      region_slug: geo.regionSlug,
      status: 'published',
      approval_status: 'Approved',
      series_group_id: seriesGroupId,
      image_url: eventImageDbValue(photoUrl) || null,
    };
    if (geo.lat != null) patch.latitude = geo.lat;
    if (geo.lng != null) patch.longitude = geo.lng;
    await sb.from('events').update(patch).eq('id', ev.id);
    if (spec.bookingUrl) await applyLinkOut(sb, ev.id, spec.bookingUrl, spec.priceLabel || 'Enquire for price');
    created++;
  }
  console.log(`  · added ${created}, already had ${skipped}`);
}

async function setLogoIfEmpty(sb, organiserId, photoUrl, label) {
  if (!organiserId || String(organiserId).startsWith('dry-run:') || !photoUrl) return;
  if (await isClaimedOrPayingOrganiser(sb, organiserId)) {
    console.log(`  · skip logo — claimed/paying: ${label}`);
    return;
  }
  const { data } = await sb.from('organisers').select('photo_url').eq('id', organiserId).maybeSingle();
  if (data?.photo_url && String(data.photo_url).trim()) {
    console.log(`  · keep logo: ${label}`);
    return;
  }
  if (!APPLY) {
    console.log(`  · would set logo: ${label}`);
    return;
  }
  await sb.from('organisers').update({ photo_url: photoUrl }).eq('id', organiserId);
  console.log(`  · logo set: ${label}`);
}

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }
  const sb = getSupabaseAdmin();
  console.log(APPLY ? 'APPLY mode' : 'DRY-RUN — pass --apply to write');
  console.log('Bournemouth coverage: listing-backed dates only');

  await removeProjectedDates(sb);

  console.log('\n1) Organiser shells (published, no claim email)');
  const shorelineId = await ensureGroup(sb, {
    key: 'bniShoreline',
    name: 'BNI Shoreline Bournemouth',
    email: 'hi@thenetworkeruk.com',
    website: 'https://bnidorset.co.uk/en-GB/find_a_chapter',
    photoUrl: BNI_LOGO,
    description:
      'BNI Shoreline — weekly referral networking for Bournemouth business owners at the Carlton Hotel, East Overcliff.',
  });
  const prioryId = await ensureGroup(sb, {
    key: 'bniPriory',
    name: 'BNI Priory (Christchurch)',
    email: 'hi@thenetworkeruk.com',
    website: 'https://bnidorset.co.uk/dorset-priory,-christchurch/en-GB/index',
    photoUrl: BNI_CDN_LOGO,
    description:
      'Award-winning BNI Priory chapter — Thursday breakfast networking at Chapel Gate / BU Sports Campus, Parley, serving Christchurch and Bournemouth.',
  });
  const bcpId = await ensureGroup(sb, {
    key: 'bcpBusinessNetwork',
    name: 'BCP Business Network',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.co.uk/o/bcp-business-network-111440665021',
    description:
      'Inclusive monthly brunch networking and afternoon business showcase for Bournemouth, Christchurch, Poole and surrounding areas.',
  });
  const propertyWaveId = await ensureGroup(sb, {
    key: 'propertyWave',
    name: 'Property Wave Investments',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.co.uk/o/nic-scudamore-property-wave-investments',
    description:
      'Monthly informal property investor meetup in Southbourne — relaxed conversations, no pitches.',
  });
  const ladiesId = await ensureGroup(sb, {
    key: 'ladiesWhoLatte',
    name: 'Bournemouth Ladies Who Latte',
    email: 'karen@beakes.co.uk',
    website: 'https://www.eventbrite.co.uk/o/karen-beake-34083158973',
    description:
      'Free monthly women’s business networking — structured introductions and supportive connections at Iford Golf Centre.',
  });
  const dbaId = await ensureGroup(sb, {
    key: 'dorsetBusinessAngels',
    name: 'Dorset Business Angels',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.dorsetbusinessangels.co.uk/',
    description:
      'Angel investor network helping early-stage southern England businesses raise equity capital through pitch and networking evenings.',
  });
  const dorsetChamberId = await ensureGroup(sb, {
    key: 'dorsetChamber',
    name: 'Dorset Chamber',
    email: 'contact@dorsetchamber.co.uk',
    website: 'https://dorsetchamber.co.uk/events/',
    description:
      'Dorset Chamber of Commerce & Industry — networking lunches, toolkits and member events across Dorset.',
  });
  const giantPeachId = await ensureGroup(sb, {
    key: 'giantPeach',
    name: 'Giant Peach',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.co.uk/o/giant-peach-45703125883',
    description: 'Bournemouth digital agency hosting growth talks and networking evenings for local business owners.',
  });

  // Pull Eventbrite OG logos where empty
  console.log('\n1b) Organiser logos');
  const logoFetches = [
    {
      id: bcpId,
      label: 'BCP Business Network',
      url: 'https://www.eventbrite.co.uk/e/bcp-business-network-bournemouth-brunch-showcase-tickets-1369659210569',
    },
    {
      id: propertyWaveId,
      label: 'Property Wave',
      url: 'https://www.eventbrite.co.uk/e/property-wave-networking-event-4th-november-2026-tickets-2003548145437',
    },
    {
      id: ladiesId,
      label: 'Ladies Who Latte',
      url: 'https://www.eventbrite.co.uk/e/bournemouth-ladies-who-latte-november-2026-tickets-2003398754605',
    },
    {
      id: dbaId,
      label: 'Dorset Business Angels',
      url: 'https://www.eventbrite.co.uk/e/dorset-business-angels-pitch-presentation-event-november-2026-tickets-1835111330389',
    },
    {
      id: giantPeachId,
      label: 'Giant Peach',
      url: 'https://www.eventbrite.co.uk/e/breaking-through-the-growth-plateau-tickets-2003309353203',
    },
  ];
  for (const row of logoFetches) {
    const img = await fetchOg(row.url);
    await setLogoIfEmpty(sb, row.id, img || null, row.label);
  }
  await setLogoIfEmpty(sb, shorelineId, BNI_LOGO, 'BNI Shoreline');
  await setLogoIfEmpty(sb, prioryId, BNI_CDN_LOGO, 'BNI Priory');

  console.log('\n2) BNI chapters — standing weekly meetings (chapter schedule, not one-off tickets)');
  // Shoreline Eventbrite is multi-date; Priory publishes as weekly Thursday chapter.
  // Cap at end of 2026 so we do not invent a long Q1 2027 runway without listings.
  await extendSeries(sb, {
    name: 'BNI Shoreline Bournemouth',
    organiserId: shorelineId,
    title: 'BNI Shoreline Bournemouth Weekly Networking Meeting',
    titleMatch: 'BNI Shoreline Bournemouth',
    days: eachWeekday('2026-10-21', '2026-12-29', 2), // Tuesdays
    startTime: '09:30:00',
    endTime: '11:00:00',
    venue: 'Carlton Hotel',
    addressLine1: 'East Overcliff, Grove Road',
    city: 'Bournemouth',
    postcode: 'BH1 3DN',
    bookingUrl: 'https://www.eventbrite.co.uk/e/bni-shoreline-networking-event-tickets-1983949189432',
    priceLabel: 'Enquire for price',
    fallbackImage: BNI_LOGO,
    attendanceMode: 'membership_meeting',
    description:
      'Weekly Tuesday BNI Shoreline meeting — Bournemouth business owners building referral relationships at the Carlton Hotel, East Overcliff. Visitors welcome; arrange via the chapter / Eventbrite.',
  });

  await extendSeries(sb, {
    name: 'BNI Priory (Christchurch)',
    organiserId: prioryId,
    title: 'BNI Priory Christchurch Weekly Business Networking Meeting',
    titleMatch: 'BNI Priory Christchurch',
    days: eachWeekday('2026-10-23', '2026-12-31', 4), // Thursdays
    startTime: '06:45:00',
    endTime: '08:30:00',
    venue: 'Chapel Gate / BU Sports Campus',
    addressLine1: 'Parley Lane, East Parley',
    city: 'Christchurch',
    postcode: 'BH23 6BL',
    bookingUrl: 'https://bnidorset.co.uk/dorset-priory,-christchurch/en-GB/index',
    priceLabel: 'Enquire for price',
    fallbackImage: BNI_CDN_LOGO,
    attendanceMode: 'membership_meeting',
    description:
      'Weekly Thursday BNI Priory breakfast meeting at Chapel Gate (BU Sports Campus), Parley — serving Christchurch, Bournemouth and East Dorset. One member per category; visitors arrange via the chapter.',
  });

  console.log('\n3) Listing-backed one-offs only (no cadence guesses)');
  // Intentionally NOT extending TOP / Fore / PPN / Christchurch Chamber.

  await publishOne(sb, bcpId, {
    title: 'BCP Business Network Bournemouth, Brunch & Showcase',
    titleMatch: 'BCP Business Network Bournemouth',
    date: '2026-11-11T09:30:00+00:00',
    endDate: '2026-11-11T15:30:00+00:00',
    venue: 'The Village Hotel',
    addressLine1: 'Deansleigh Road',
    city: 'Bournemouth',
    postcode: 'BH7 7DZ',
    bookingUrl:
      'https://www.eventbrite.co.uk/e/bcp-business-network-bournemouth-brunch-showcase-tickets-1369659210569',
    priceLabel: 'From £13',
    description:
      'BCP Business Network monthly brunch and afternoon business showcase at Village Hotel Bournemouth — structured networking for BCP-area professionals.',
  });

  await publishOne(sb, bcpId, {
    title: 'BCP Festive Brunch with Mini Showcase',
    titleMatch: 'BCP Festive Brunch',
    date: '2026-12-02T09:00:00+00:00',
    endDate: '2026-12-02T15:30:00+00:00',
    venue: 'The Village Hotel',
    addressLine1: 'Deansleigh Road',
    city: 'Bournemouth',
    postcode: 'BH7 7DZ',
    bookingUrl: 'https://www.eventbrite.co.uk/o/bcp-business-network-111440665021',
    priceLabel: 'From £22',
    description:
      'BCP Festive Brunch with Mini Showcase at Village Hotel Bournemouth — festive networking brunch for BCP-area professionals.',
  });

  await publishOne(sb, propertyWaveId, {
    title: 'Property Wave Networking Event - 4th November 2026',
    titleMatch: 'Property Wave Networking Event',
    date: '2026-11-04T19:30:00+00:00',
    endDate: '2026-11-04T21:30:00+00:00',
    venue: 'Brewhouse and Kitchen (Malthouse)',
    addressLine1: '147 Parkwood Road, Southbourne',
    city: 'Bournemouth',
    postcode: 'BH5 2BW',
    bookingUrl:
      'https://www.eventbrite.co.uk/e/property-wave-networking-event-4th-november-2026-tickets-2003548145437',
    priceLabel: '£5',
    description:
      'Property Wave meetup — informal property investor networking at Brewhouse and Kitchen, Southbourne. £5 on the door.',
  });

  await publishOne(sb, ladiesId, {
    title: 'Bournemouth Ladies Who Latte - November 2026',
    titleMatch: 'Bournemouth Ladies Who Latte',
    date: '2026-11-10T10:00:00+00:00',
    endDate: '2026-11-10T12:00:00+00:00',
    venue: 'Iford Golf Centre (Christchurch Golf Club)',
    addressLine1: 'Riverside Avenue',
    city: 'Bournemouth',
    postcode: 'BH7 7ES',
    bookingUrl:
      'https://www.eventbrite.co.uk/e/bournemouth-ladies-who-latte-november-2026-tickets-2003398754605',
    priceLabel: 'Free',
    description:
      'Free women’s business networking — structured introductions at Iford Golf Centre. Ticket required.',
  });

  await publishOne(sb, dbaId, {
    title: 'Dorset Business Angels Pitch Presentation Event - November 2026',
    titleMatch: 'Dorset Business Angels Pitch Presentation Event',
    date: '2026-11-16T17:00:00+00:00',
    endDate: '2026-11-16T21:30:00+00:00',
    venue: 'The Bournemouth Carlton Hotel',
    addressLine1: 'Grove Road, Eastcliff',
    city: 'Bournemouth',
    postcode: 'BH1 3DN',
    bookingUrl:
      'https://www.eventbrite.co.uk/e/dorset-business-angels-pitch-presentation-event-november-2026-tickets-1835111330389',
    priceLabel: 'Tickets available',
    eventType: 'Pitch',
    description:
      'Dorset Business Angels pitch evening — networking from 17:00 then five early-stage founders pitch to investors at the Carlton Hotel, Bournemouth.',
  });

  await publishOne(sb, giantPeachId, {
    title: 'Breaking Through the Growth Plateau',
    titleMatch: 'Breaking Through the Growth Plateau',
    date: '2026-11-12T16:00:00+00:00',
    endDate: '2026-11-12T19:00:00+00:00',
    venue: 'The NICI Bournemouth',
    addressLine1: 'West Hill Road',
    city: 'Bournemouth',
    postcode: 'BH2 5EJ',
    bookingUrl: 'https://www.eventbrite.co.uk/e/breaking-through-the-growth-plateau-tickets-2003309353203',
    priceLabel: 'Tickets available',
    eventType: 'Workshop',
    description:
      'Giant Peach growth evening at The NICI — three speakers on breaking through a business growth plateau, plus networking for local founders and owners.',
  });

  await publishOne(sb, dorsetChamberId, {
    title: 'Dorset Chamber Christmas Lunch 2026',
    titleMatch: 'Dorset Chamber Christmas Lunch',
    date: '2026-12-11T12:00:00+00:00',
    endDate: '2026-12-11T16:00:00+00:00',
    venue: 'Hilton Bournemouth',
    addressLine1: 'Terrace Road',
    city: 'Bournemouth',
    postcode: 'BH2 5EL',
    bookingUrl: 'https://dorsetchamber.co.uk/events/',
    priceLabel: 'From £75',
    description:
      'Dorset Chamber Christmas Lunch at Hilton Bournemouth — three-course lunch, networking and festive celebration with the Dorset business community.',
  });

  // BH Banter — monthly-ish evenings; seed Q1 at Collingwood (Chamber’s regular venue)
  for (const day of ['2027-01-20', '2027-02-17', '2027-03-17']) {
    await publishOne(sb, bournemouthChamberId, {
      title: 'BH Banter — Bournemouth Chamber Networking Evening',
      titleMatch: 'BH Banter',
      date: `${day}T17:30:00+00:00`,
      endDate: `${day}T19:30:00+00:00`,
      venue: 'Hotel Collingwood',
      addressLine1: '11-13 Priory Road',
      city: 'Bournemouth',
      postcode: 'BH2 5DF',
      bookingUrl: 'https://bournemouthchamber.org.uk/events/',
      priceLabel: 'From £5',
      description:
        'Bournemouth Chamber BH Banter — informal evening networking for local businesses. Confirm the exact date and venue on the Chamber events page.',
    });
  }

  console.log('\nDone.', APPLY ? 'Review /networking/bournemouth' : 'Re-run with --apply to write.');
  console.log(
    'Note: Dorset Chamber Broadstone (BH18) / EDBN Ferndown (BH22) sit outside the BH1–12/BH23 hub filter — omitted from this pass.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
