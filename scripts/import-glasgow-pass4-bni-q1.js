#!/usr/bin/env node
/**
 * Glasgow pass 4: organiser logos, BNI chapter dates, Q1 2027 networking.
 *
 * Run after import-glasgow-coverage-gaps.js (or alone — idempotent).
 *
 *   node scripts/import-glasgow-pass4-bni-q1.js
 *   node scripts/import-glasgow-pass4-bni-q1.js --apply
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

const ORGS = {
  evolution: 'f973cbcc-1ae0-43ea-ad36-7103a6b3414d',
  nexus: 'b282c28b-2589-4129-b614-f854763a232f',
  infinity: '22133fd7-526a-443a-8415-97b5860b48db',
  enterprise: 'e7463240-eab0-47a3-b21d-72cfb56195c1',
  chamber: '5b79f98e-3a41-44b8-b612-f84baa763d75',
  hustle: null, // resolve by slug
  foundersCoffee: '2f62af72-76b7-487f-be04-1e33719adc85',
  accelerator: null,
  bipc: null,
  coWomen: null,
  eightBn: null,
  b2b: '520fc5c4-d16b-422d-abe2-2d453da30ff9',
  pdn: null,
};

/** Logos for shells that still show without one (and BNI chapters). */
const ORGANISER_LOGOS = [
  { id: ORGS.nexus, photoUrl: BNI_LOGO, name: 'BNI Nexus Glasgow' },
  { id: ORGS.evolution, photoUrl: BNI_LOGO, name: 'BNI Evolution Glasgow' },
  { id: ORGS.enterprise, photoUrl: BNI_CDN_LOGO, name: 'Enterprise BNI' },
  {
    id: ORGS.infinity,
    photoUrl: 'https://bni-infinity.co.uk/wp-content/uploads/2021/12/bni-infinity-logo.png',
    name: 'Infinity BNI',
  },
  {
    slug: 'scottish-construction-summit',
    photoUrl: 'https://www.scottishconstructionsummit.com/assets/SCS-2026-social.jpg',
  },
  {
    slug: 'bipc-glasgow',
    photoUrl: 'https://www.glasgowlife.org.uk/static/img/logo-gl-colour.svg',
  },
  {
    slug: 'glasgow-royal-bank-accelerator',
    photoUrl:
      'https://www.natwestgroup.com/content/dam/natwestgroup_com/natwestgroup/images/logos/rbs-logo.svg',
  },
];

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
    city: resolvedCity || city || 'Glasgow',
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
      }) || 'glasgow',
  };
}

async function resolveOrgId(sb, { id, slug }) {
  if (id) return id;
  if (!slug) return null;
  const { data } = await sb.from('organisers').select('id, photo_url, name').eq('slug', slug).maybeSingle();
  return data;
}

async function applyOrganiserLogos(sb) {
  console.log('\n1) Organiser logos');
  // Prefer real listing images where we can fetch them
  const dynamic = [
    {
      slug: 'co-women',
      fetch: 'https://www.eventbrite.co.uk/e/glasgow-chai-chatter-a-co-women-networking-event-tickets-2002937777811',
    },
    {
      slug: 'barbells-business-cards-networking',
      fetch:
        'https://www.eventbrite.co.uk/e/barbells-business-cards-health-business-networking-event-tickets-1984302369804',
    },
    {
      slug: '8-business-networking',
      fetch: 'https://www.eventbrite.co.uk/e/8-business-networking-coffee-morning-nov-tickets-2003195399364',
    },
    {
      slug: 'founders-coffee-club-glasgow',
      fetch:
        'https://www.eventbrite.com/e/glasgow-networking-events-for-founders-founders-coffee-club-tickets-2002710497008',
    },
    {
      slug: 'scottish-property-podcast',
      fetch:
        'https://www.eventbrite.co.uk/e/scottish-property-podcast-networking-event-glasgow-4th-november-2026-tickets-2003403552957',
    },
    {
      slug: 'dunbartonshire-chamber-of-commerce',
      fetch:
        'https://www.eventbrite.co.uk/e/dcc-business-breakfast-meeting-november-19th-tickets-1998891924555',
    },
  ];

  const jobs = [...ORGANISER_LOGOS];
  for (const row of dynamic) {
    try {
      const html = await fetchText(row.fetch);
      const img = extractOgImage(html);
      if (img && !/favicon|pfavico|\.ico(\?|$)/i.test(img)) {
        jobs.push({ slug: row.slug, photoUrl: img });
      }
    } catch (e) {
      console.warn('  · logo fetch failed', row.slug, e.message || e);
    }
  }

  for (const job of jobs) {
    let orgId = job.id;
    let current = null;
    if (orgId) {
      const { data: row } = await sb
        .from('organisers')
        .select('id, photo_url, name')
        .eq('id', orgId)
        .maybeSingle();
      if (!row) {
        console.log(`  · skip logo — no org id ${orgId}`);
        continue;
      }
      current = row.photo_url;
    } else if (job.slug) {
      const row = await resolveOrgId(sb, { slug: job.slug });
      if (!row) {
        console.log(`  · skip logo — no org ${job.slug}`);
        continue;
      }
      orgId = row.id;
      current = row.photo_url;
    } else {
      continue;
    }
    if (current && String(current).trim()) {
      console.log(`  · keep existing logo: ${job.slug || job.name || orgId}`);
      continue;
    }
    if (!APPLY) {
      console.log(`  · would set logo: ${job.slug || job.name || orgId}`);
      continue;
    }
    const { error } = await sb.from('organisers').update({ photo_url: job.photoUrl }).eq('id', orgId);
    if (error) console.warn('    logo update failed', orgId, error.message);
    else console.log(`  · logo set: ${job.slug || job.name || orgId}`);
  }
}

function eachFriday(fromIsoDate, toIsoDate) {
  const out = [];
  const d = new Date(fromIsoDate + 'T12:00:00Z');
  const end = new Date(toIsoDate + 'T12:00:00Z');
  // move to Friday (5)
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

function firstFridayOfMonth(year, monthIndex0) {
  const d = new Date(Date.UTC(year, monthIndex0, 1, 12));
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
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

async function extendWeeklyChapter(sb, spec) {
  console.log(`\n· ${spec.name}`);
  const fridays = eachFriday(spec.from, spec.to);
  const geo = await enrichGeo(spec);
  let seriesGroupId = null;
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
  const photoUrl =
    (existing && existing[0] && existing[0].image_url) ||
    (spec.bookingUrl ? normalizeEventPhotoUrl(await fetchOg(spec.bookingUrl)) : '') ||
    BNI_LOGO;

  let created = 0;
  let skipped = 0;
  for (const day of fridays) {
    if (await dateExists(sb, spec.organiserId, spec.titleMatch, day)) {
      skipped++;
      continue;
    }
    // Friday 06:45 Europe/London ≈ 06:45Z in winter, 05:45Z in summer — store as +00/+01 simply:
    const starts = `${day}T06:45:00${spec.tzSuffix || '+00:00'}`;
    const ends = `${day}T08:30:00${spec.tzSuffix || '+00:00'}`;
    if (!APPLY) {
      console.log(`  · would add ${day}`);
      created++;
      continue;
    }
    const ev = await createEvent({
      title: spec.title,
      groupId: spec.organiserId,
      type: 'Meeting',
      eventFormat: spec.eventFormat || 'In person',
      listingStatus: 'published',
      description: spec.description,
      venue: geo.venue,
      addressLine1: geo.addressLine1,
      city: geo.city,
      postcode: geo.postcode,
      attendanceMode: 'membership_meeting',
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
      image_url: eventImageDbValue(photoUrl) || null,
    };
    if (geo.lat != null) patch.latitude = geo.lat;
    if (geo.lng != null) patch.longitude = geo.lng;
    await sb.from('events').update(patch).eq('id', ev.id);
    if (spec.bookingUrl) await applyLinkOut(sb, ev.id, spec.bookingUrl, spec.priceLabel || 'Enquire for price');
    created++;
  }
  console.log(`  · added ${created}, already had ${skipped} (through ${spec.to})`);

  // Refresh venue on existing Evolution rows still at Hampden if requested
  if (APPLY && spec.forceVenuePatch) {
    const { error } = await sb
      .from('events')
      .update({
        venue: geo.venue,
        address: geo.addressLine1,
        postcode: geo.postcode,
        outcode: geo.outcode,
        city: geo.city,
        location_label: `${geo.venue}, ${geo.city}`,
        region_slug: geo.regionSlug,
        latitude: geo.lat,
        longitude: geo.lng,
      })
      .eq('organiser_id', spec.organiserId)
      .ilike('title', spec.titleMatch + '%')
      .gte('starts_at', new Date().toISOString());
    if (error) console.warn('  · venue patch failed', error.message);
    else console.log('  · refreshed venue on upcoming dates');
  }
}

async function fetchOg(url) {
  try {
    return extractOgImage(await fetchText(url));
  } catch {
    return '';
  }
}

async function publishOne(sb, organiserId, spec) {
  const day = String(spec.date).slice(0, 10);
  if (await dateExists(sb, organiserId, spec.titleMatch || spec.title.slice(0, 24), day)) {
    console.log(`  · skip exists: ${spec.title} @ ${day}`);
    return;
  }
  const geo = await enrichGeo(spec);
  const photoUrl =
    spec.imageUrl || (spec.bookingUrl ? await fetchOg(spec.bookingUrl) : '') || '';
  if (!APPLY) {
    console.log(`  · would publish: ${spec.title} | ${day} | Link Out ${spec.priceLabel || ''}`);
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
  await sb.from('events').update(patch).eq('id', ev.id);
  if (spec.bookingUrl) await applyLinkOut(sb, ev.id, spec.bookingUrl, spec.priceLabel || 'Tickets available');
  console.log(`  · published: ${spec.title}`);
}

async function ensureGroup(sb, spec) {
  const { data: byName } = await sb
    .from('organisers')
    .select('id, listing_status')
    .ilike('name', spec.name)
    .limit(1)
    .maybeSingle();
  if (byName) {
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
  console.log(`  · created ${spec.name}`);
  return created.id;
}

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }
  const sb = getSupabaseAdmin();
  console.log(APPLY ? 'APPLY mode' : 'DRY-RUN — pass --apply to write');
  console.log('Pass 4: logos + BNI series + Q1 2027');

  await applyOrganiserLogos(sb);

  console.log('\n2) BNI weekly / monthly chapters');
  // Nexus — every Friday through end of March 2027
  await extendWeeklyChapter(sb, {
    name: 'BNI Nexus Glasgow',
    organiserId: ORGS.nexus,
    title: 'BNI Nexus Glasgow Weekly Business Networking Meeting',
    titleMatch: 'BNI Nexus Glasgow',
    from: '2026-10-23',
    to: '2027-03-26',
    venue: 'Prince & Princess of Wales Hospice',
    addressLine1: '20 Dumbreck Road, Bellahouston',
    city: 'Glasgow',
    postcode: 'G41 5BW',
    bookingUrl: 'https://www.eventbrite.co.uk/e/bni-nexus-networking-friday-tickets-1981021963019',
    priceLabel: 'Enquire for price',
    description:
      'Weekly Friday BNI Nexus Glasgow meeting — local business owners building referral relationships. One member per business category. Visitors welcome (arrange via the chapter).',
  });

  // Evolution — Nuffield Finnieston (moved from Hampden)
  await extendWeeklyChapter(sb, {
    name: 'BNI Evolution Glasgow',
    organiserId: ORGS.evolution,
    title: 'Evolution BNI (Glasgow)',
    titleMatch: 'Evolution BNI',
    from: '2026-10-23',
    to: '2027-03-26',
    venue: 'Nuffield Health Glasgow Finnieston',
    addressLine1: 'Finnieston',
    city: 'Glasgow',
    postcode: 'G3 8EP',
    bookingUrl: 'https://www.bni.com/',
    priceLabel: 'Enquire for price',
    forceVenuePatch: true,
    description:
      'Weekly Friday Evolution BNI Glasgow chapter meeting — 50+ members exchanging referrals over breakfast. Visitors welcome; contact the chapter to arrange a visit.',
  });

  // Enterprise — weekly; visitor via regional site (exact room via find-a-chapter)
  await extendWeeklyChapter(sb, {
    name: 'Enterprise BNI Glasgow & South Lanarkshire',
    organiserId: ORGS.enterprise,
    title: 'Enterprise BNI (Glasgow & South Lanarkshire)',
    titleMatch: 'Enterprise BNI (Glasgow',
    from: '2026-10-23',
    to: '2027-03-26',
    venue: 'Glasgow & South Lanarkshire',
    addressLine1: 'Glasgow',
    city: 'Glasgow',
    postcode: 'G1 1DU',
    bookingUrl: 'https://bniglasgowsl.com/en-GB/find_a_chapter',
    priceLabel: 'Enquire for price',
    description:
      'Enterprise BNI chapter serving Glasgow & South Lanarkshire — weekly referral networking. Use the regional find-a-chapter page to confirm venue and book a visitor place (Charlie Robertson / bniglasgowsl.com).',
  });

  // Infinity — hybrid: list first-Friday in-person mornings at Glasgow Airport hotel
  console.log('\n· Infinity BNI (first Friday in person)');
  const infinityDays = [
    firstFridayOfMonth(2026, 10), // Nov
    firstFridayOfMonth(2026, 11), // Dec
    firstFridayOfMonth(2027, 0),
    firstFridayOfMonth(2027, 1),
    firstFridayOfMonth(2027, 2),
  ].filter((d) => d >= '2026-10-20');
  for (const day of infinityDays) {
    await publishOne(sb, ORGS.infinity, {
      title: 'Infinity BNI Scotland West — In-Person Meeting',
      titleMatch: 'Infinity BNI Scotland West',
      date: `${day}T06:45:00+00:00`,
      endDate: `${day}T08:30:00+00:00`,
      venue: 'Courtyard by Marriott Glasgow Airport',
      addressLine1: 'Marchburn Drive',
      city: 'Glasgow',
      postcode: 'PA3 2ST',
      bookingUrl: 'https://bni-infinity.co.uk/',
      priceLabel: 'Enquire for price',
      attendanceMode: 'membership_meeting',
      eventFormat: 'In person',
      description:
        'BNI Infinity Scotland West hybrid chapter — in-person meeting on the first Friday of the month at Courtyard by Marriott Glasgow Airport (weekly meetings also run on Zoom). Visitors: contact the chapter first.',
    });
  }

  // Sunrise — North Lanarkshire (Newhouse / Motherwell); draws Glasgow visitors
  const sunriseId = await ensureGroup(sb, {
    key: 'bniSunrise',
    name: 'BNI Sunrise (North Lanarkshire)',
    email: 'hi@thenetworkeruk.com',
    website: 'https://bninetworkscotland.co.uk/bni-chapters/sunrise/',
    description:
      'BNI Sunrise chapter in North Lanarkshire — Friday breakfast networking welcoming businesses from Lanarkshire, Glasgow and beyond.',
  });
  await extendWeeklyChapter(sb, {
    name: 'BNI Sunrise (North Lanarkshire)',
    organiserId: sunriseId,
    title: 'BNI Sunrise (North Lanarkshire) Weekly Business Networking Meeting',
    titleMatch: 'BNI Sunrise',
    from: '2026-10-23',
    to: '2027-03-26',
    venue: 'Alona Hotel',
    addressLine1: 'Strathclyde Country Park',
    city: 'Motherwell',
    postcode: 'ML1 3RT',
    bookingUrl: 'https://bninetworkscotland.co.uk/bni-chapters/sunrise/',
    priceLabel: 'Enquire for price',
    description:
      'Weekly Friday BNI Sunrise meeting — North Lanarkshire chapter open to visitors from Lanarkshire, Glasgow and surrounding areas. Arrange a visit via the chapter page (venue confirmed as Alona Hotel / Newhouse area).',
  });
  if (APPLY && !String(sunriseId).startsWith('dry-run:')) {
    const { data: sunriseRow } = await sb
      .from('organisers')
      .select('photo_url')
      .eq('id', sunriseId)
      .maybeSingle();
    if (!sunriseRow?.photo_url) {
      await sb.from('organisers').update({ photo_url: BNI_CDN_LOGO }).eq('id', sunriseId);
    }
  }

  console.log('\n3) Q1 2027 networking / workshops');
  // Resolve slugs for newer orgs
  const accel = await resolveOrgId(sb, { slug: 'glasgow-royal-bank-accelerator' });
  const familyBizId = await ensureGroup(sb, {
    key: 'familyBusinessUnited',
    name: 'Family Business United',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.familybusinessunited.com/',
    description:
      'UK family-business community hosting insight events, panels and networking for owners and next-gen leaders.',
  });
  const connexionId = await ensureGroup(sb, {
    key: 'connexionCareerCollective',
    name: 'Connexion Career Collective',
    email: 'hi@thenetworkeruk.com',
    website: 'https://connexioncareercollective.com/',
    description:
      'Community for women and allies — regional networking lunches, facilitated conversation and career support.',
  });
  const hustle = await resolveOrgId(sb, { slug: 'hustle-entrepreneur-networking' });
  const pdn = await resolveOrgId(sb, { slug: 'property-deal-network-uk' });

  const q1 = [
    {
      organiserId: ORGS.chamber,
      title: 'January Speed Networking Lunch',
      titleMatch: 'January Speed Networking Lunch',
      date: '2027-01-28T12:00:00+00:00',
      endDate: '2027-01-28T14:30:00+00:00',
      venue: 'Glasgow City Centre',
      addressLine1: 'Glasgow',
      city: 'Glasgow',
      postcode: 'G2 1DY',
      bookingUrl: 'https://www.glasgowchamberofcommerce.com/events/',
      priceLabel: 'Enquire for price',
      description:
        'Glasgow Chamber January speed networking lunch — two-course lunch, a glass of wine and structured introductions in the city centre.',
    },
    {
      organiserId: ORGS.chamber,
      title: "International Women's Day Networking Lunch at One Devonshire Gardens by Hotel du Vin",
      titleMatch: "International Women's Day Networking Lunch",
      date: '2027-03-05T12:00:00+00:00',
      endDate: '2027-03-05T14:30:00+00:00',
      venue: 'One Devonshire Gardens by Hotel du Vin',
      addressLine1: '1 Devonshire Gardens',
      city: 'Glasgow',
      postcode: 'G12 0UX',
      bookingUrl: 'https://www.glasgowchamberofcommerce.com/events/',
      priceLabel: 'From £70',
      description:
        'Glasgow Chamber International Women’s Day networking lunch — two-course lunch and a glass of wine at One Devonshire Gardens.',
    },
    {
      organiserId: hustle && hustle.id,
      title: 'HUSTLE Glasgow Entrepreneur Networking Event',
      titleMatch: 'HUSTLE Glasgow Entrepreneur Networking Event',
      date: '2027-01-28T17:00:00+00:00',
      endDate: '2027-01-28T20:00:00+00:00',
      venue: "Waxy O'Connor's Glasgow",
      addressLine1: '44 West George Street',
      city: 'Glasgow',
      postcode: 'G2 1DH',
      bookingUrl: 'https://www.fatsoma.com/e/w0epyta3/hustle-glasgow-entrepreneur-networking-event',
      priceLabel: 'Free',
      description:
        'HUSTLE Glasgow — high-energy entrepreneur networking at Waxy O’Connor’s. Free to attend; buy a drink at the bar. Smart wear, 18+.',
    },
    {
      organiserId: familyBizId,
      title: 'Scottish Family Business Insights',
      titleMatch: 'Scottish Family Business Insights',
      date: '2027-02-11T08:30:00+00:00',
      endDate: '2027-02-11T11:00:00+00:00',
      venue: 'The Beacon, Barclays Glasgow Campus',
      addressLine1: '4 Clyde Place',
      city: 'Glasgow',
      postcode: 'G5 8DP',
      bookingUrl: 'https://www.eventbrite.co.uk/e/scottish-family-business-insights-tickets-1997689501074',
      priceLabel: 'Tickets available',
      description:
        'Family Business United insight morning — panel with leading Scottish female family-business owners, breakfast and networking overlooking the Clyde.',
    },
    {
      organiserId: connexionId,
      title: 'Glasgow | Regional Networking Lunch',
      titleMatch: 'Glasgow | Regional Networking Lunch',
      date: '2027-02-10T12:00:00+00:00',
      endDate: '2027-02-10T14:30:00+00:00',
      venue: 'Glasgow',
      addressLine1: 'Glasgow',
      city: 'Glasgow',
      postcode: 'G2 1DY',
      bookingUrl: 'https://connexioncareercollective.com/events/glasgownetworkingevent-1-1',
      priceLabel: 'From £7.50',
      description:
        'Connexion Career Collective regional networking lunch for women and allies — facilitated conversation, structured networking and community updates.',
    },
    {
      organiserId: accel && accel.id,
      title: 'Social Event: She Scales - Female Founders Get-Together and Co-Working Day',
      titleMatch: 'Social Event: She Scales',
      date: '2027-03-27T09:30:00+00:00',
      endDate: '2027-03-27T11:30:00+00:00',
      venue: 'Royal Bank Accelerator Glasgow',
      addressLine1: '110 Queen Street, 4th Floor',
      city: 'Glasgow',
      postcode: 'G1 3BX',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/social-event-she-scales-female-founders-get-together-and-co-working-day-tickets-1978882206951',
      priceLabel: 'Tickets available',
      description:
        'She Scales female founders get-together — coffee, roundtable chat, community and co-working at the Royal Bank Accelerator Glasgow.',
    },
  ];

  // Founders Coffee Club — 3rd Fridays Jan–Mar 2027
  const foundersFridays = ['2027-01-15', '2027-02-19', '2027-03-19'];
  for (const day of foundersFridays) {
    q1.push({
      organiserId: ORGS.foundersCoffee,
      title: `Glasgow Networking Events for Founders | Founders Coffee Club`,
      titleMatch: 'Founders Coffee Club',
      date: `${day}T11:00:00+00:00`,
      endDate: `${day}T12:00:00+00:00`,
      venue: 'Clockwise Glasgow',
      addressLine1: '77 Renfrew Street',
      city: 'Glasgow',
      postcode: 'G2 3BZ',
      bookingUrl:
        'https://www.eventbrite.com/e/glasgow-networking-events-for-founders-founders-coffee-club-tickets-2002710497008',
      priceLabel: '£15',
      description:
        'Founders Coffee Club Glasgow — no pitches, host-led introductions at Clockwise. Monthly on the 3rd Friday.',
    });
  }

  // PDN / B2B — 4th Thursdays Jan–Mar (skip if already present)
  const fourthThursdays = ['2027-01-28', '2027-02-25', '2027-03-25'];
  for (const day of fourthThursdays) {
    if (pdn && pdn.id) {
      q1.push({
        organiserId: pdn.id,
        title: 'Property Deal Network Glasgow - PDN - Property Investor Networking Event',
        titleMatch: 'Property Deal Network Glasgow',
        date: `${day}T19:00:00+00:00`,
        endDate: `${day}T22:00:00+00:00`,
        venue: "Waxy O'Connor's Glasgow",
        addressLine1: '44 West George Street',
        city: 'Glasgow',
        postcode: 'G2 1DH',
        bookingUrl:
          'https://www.eventbrite.co.uk/e/property-deal-network-glasgow-pdn-property-investor-networking-event-tickets-2001772049085',
        priceLabel: 'Free',
        description:
          'Free monthly PDN Glasgow meetup for property investors at Waxy O’Connor’s — deals, capital and JV conversations. Over 25s; buy a drink at the bar.',
      });
    }
    q1.push({
      organiserId: ORGS.b2b,
      title: 'B2B Mixer Glasgow - 100% networking event - making referrals',
      titleMatch: 'B2B Mixer Glasgow',
      date: `${day}T17:00:00+00:00`,
      endDate: `${day}T20:00:00+00:00`,
      venue: "Waxy O'Connor's Glasgow",
      addressLine1: '44 West George Street',
      city: 'Glasgow',
      postcode: 'G2 1DH',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/b2b-mixer-glasgow-100-networking-event-making-referrals-tickets-2000394304213',
      priceLabel: 'Tickets available',
      description:
        'Monthly B2B Mixer Glasgow — 100% networking for referral-minded business owners at Waxy O’Connor’s.',
    });
  }

  for (const spec of q1) {
    if (!spec.organiserId || String(spec.organiserId).startsWith('dry-run:')) {
      console.log(`  · skip ${spec.title} — missing organiser`);
      continue;
    }
    await publishOne(sb, spec.organiserId, spec);
  }

  console.log('\nDone.', APPLY ? 'Review /networking/glasgow' : 'Re-run with --apply to write.');
  console.log(
    'Note: Infinity (PA3) and Sunrise (ML1) sit outside the G-outcode Glasgow filter — listed for Glasgow-area search / organiser pages.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
