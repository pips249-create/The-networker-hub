#!/usr/bin/env node
/**
 * Manchester coverage: listing-backed events + unclaimed organiser shells only.
 * No cadence guesses. No claim emails. Skips claimed/paying organisers.
 * Does not invent dates for existing hub clubs (HUSTLE, PDN, Colony, Pro 5, etc.).
 *
 *   node scripts/import-manchester-coverage.js
 *   node scripts/import-manchester-coverage.js --apply
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
const { createEvent } = require('../api/_lib/supabase-organiser-events');
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

async function isClaimedOrPayingOrganiser(sb, organiserId) {
  if (!organiserId || String(organiserId).startsWith('dry-run:')) return false;
  const { data, error } = await sb
    .from('organisers')
    .select(
      'id, name, ownership_claim_status, stripe_account_id, supabase_user_id, organiser_account_id'
    )
    .eq('id', organiserId)
    .maybeSingle();
  if (error || !data) return true;
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
    city: resolvedCity || city || 'Manchester',
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
      }) || 'manchester',
  };
}

async function ensureGroup(sb, spec) {
  // Prefer existing organisers — never create a second shell for the same group.
  if (spec.preferExistingId) {
    const { data } = await sb
      .from('organisers')
      .select('id, name, listing_status')
      .eq('id', spec.preferExistingId)
      .maybeSingle();
    if (data) {
      console.log(`  · reuse existing ${data.name} (${data.id})`);
      return data.id;
    }
  }
  const slugs = [spec.slug, ...(spec.slugAliases || [])].filter(Boolean);
  for (const slug of slugs) {
    const { data } = await sb.from('organisers').select('id, name').eq('slug', slug).maybeSingle();
    if (data) {
      console.log(`  · reuse by slug ${slug} → ${data.name}`);
      return data.id;
    }
  }
  const names = [spec.name, ...(spec.nameAliases || [])].filter(Boolean);
  for (const name of names) {
    const { data: byName } = await sb
      .from('organisers')
      .select('id, name')
      .ilike('name', name)
      .limit(1)
      .maybeSingle();
    if (byName) {
      console.log(`  · reuse by name → ${byName.name} (${byName.id})`);
      return byName.id;
    }
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

async function applyLinkOut(sb, eventId, bookingUrl, priceLabel) {
  const url = normalizeExternalBookingUrl(preferEventbriteCheckoutUrl(bookingUrl));
  const label = normalizeExternalPriceLabel(priceLabel);
  if (!url || !label) return;
  if (!APPLY) {
    console.log(`    · would Link Out: ${label}`);
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

async function publishOne(sb, organiserId, spec) {
  const day = String(spec.date).slice(0, 10);
  const titleMatch = spec.titleMatch || spec.title.slice(0, 28);
  if (await isClaimedOrPayingOrganiser(sb, organiserId)) {
    console.log(`  · skip claimed/paying — ${spec.title}`);
    return;
  }
  if (await dateExists(sb, organiserId, titleMatch, day)) {
    console.log(`  · skip exists: ${spec.title} @ ${day}`);
    return;
  }
  const geo = await enrichGeo(spec);
  const photoUrl = spec.imageUrl || (spec.bookingUrl ? await fetchOg(spec.bookingUrl) : '') || '';
  if (!APPLY) {
    console.log(`  · would publish: ${spec.title} | ${day} | ${spec.priceLabel || ''}`);
    return;
  }
  const ev = await createEvent({
    title: spec.title,
    groupId: organiserId,
    type: spec.eventType || 'Meeting',
    eventFormat: 'In person',
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
  console.log(`  · published: ${spec.title} @ ${day}`);
}

async function setLogoIfEmpty(sb, organiserId, photoUrl, label) {
  if (!organiserId || String(organiserId).startsWith('dry-run:') || !photoUrl) return;
  if (await isClaimedOrPayingOrganiser(sb, organiserId)) return;
  const { data } = await sb.from('organisers').select('photo_url').eq('id', organiserId).maybeSingle();
  if (data?.photo_url && String(data.photo_url).trim()) return;
  if (!APPLY) {
    console.log(`  · would set logo: ${label}`);
    return;
  }
  await sb.from('organisers').update({ photo_url: photoUrl }).eq('id', organiserId);
  console.log(`  · logo set: ${label}`);
}

/** Only dates with a public booking / organiser listing page. */
const VERIFIED = [
  {
    orgKey: 'propertyNexus',
    title: 'Property Nexus - Manchester Property Networking Event October 2026',
    titleMatch: 'Property Nexus - Manchester Property Networking',
    date: '2026-10-21T18:00:00+01:00',
    endDate: '2026-10-21T20:30:00+01:00',
    venue: 'Be At One Manchester',
    addressLine1: '80 Deansgate',
    city: 'Manchester',
    postcode: 'M3 2ER',
    bookingUrl:
      'https://www.eventbrite.co.uk/e/property-nexus-manchester-property-networking-event-october-2026-tickets-1997058007259',
    priceLabel: 'Tickets available',
    description:
      'Property Nexus Manchester property networking at Be At One Deansgate — informal meetup for property, construction and built-environment professionals. No sales presentations.',
  },
  {
    orgKey: 'gmChamber',
    title: 'GM Innovation Expo 2026',
    titleMatch: 'GM Innovation Expo 2026',
    date: '2026-10-21T09:30:00+01:00',
    endDate: '2026-10-21T15:30:00+01:00',
    venue: 'Manchester Central Convention Complex',
    addressLine1: 'Windmill Street',
    city: 'Manchester',
    postcode: 'M2 3GX',
    bookingUrl: 'https://www.gmchamber.co.uk/events/gm-innovation-expo-2026',
    priceLabel: 'Free',
    eventType: 'Conference',
    description:
      'Greater Manchester Innovation Expo at Manchester Central — showcases, demos, speakers and structured networking for SMEs, start-ups, investors and support organisations. Free to attend.',
  },
  {
    orgKey: 'natwestAccelerator',
    title: 'She Scales: Female Founders Hormones & Productivity',
    titleMatch: 'She Scales: Female Founders',
    date: '2026-10-21T10:00:00+01:00',
    endDate: '2026-10-21T11:30:00+01:00',
    venue: 'NatWest Accelerator Manchester Hub',
    addressLine1: '1 Spinningfields Square',
    city: 'Manchester',
    postcode: 'M3 3AP',
    bookingUrl:
      'https://www.eventbrite.co.uk/e/she-scales-female-founders-hormones-productivity-tickets-1992819766567',
    priceLabel: 'Free',
    description:
      'She Scales female founders connection and co-working morning at NatWest Accelerator Manchester — community, speaker insight and optional co-working for the day.',
  },
  {
    orgKey: 'bniCityCentre',
    title: 'BNI business referral networking - city centre',
    titleMatch: 'BNI business referral networking - city centre',
    date: '2026-10-21T10:15:00+01:00',
    endDate: '2026-10-21T12:45:00+01:00',
    venue: 'Fountain House',
    addressLine1: '14 Albert Square',
    city: 'Manchester',
    postcode: 'M2 5PE',
    bookingUrl:
      'https://www.eventbrite.co.uk/e/bni-business-referral-networking-city-centre-tickets-1987735581633',
    priceLabel: '£25',
    attendanceMode: 'membership_meeting',
    description:
      'BNI city-centre referral networking at Fountain House, Albert Square — buffet lunch included. Visitors welcome via Eventbrite (one member per category).',
  },
  {
    orgKey: 'zouk',
    title: 'Zouk Connect: October Manchester Business Networking Lunch',
    titleMatch: 'Zouk Connect: October Manchester',
    date: '2026-10-22T12:00:00+01:00',
    endDate: '2026-10-22T14:00:00+01:00',
    venue: 'Zouk Tea Bar & Grill',
    addressLine1: 'Unit 5, The Quadrangle, Chester Street',
    city: 'Manchester',
    postcode: 'M1 5QS',
    bookingUrl:
      'https://www.eventbrite.co.uk/e/zouk-connect-october-manchester-business-networking-lunch-tickets-2000602099735',
    priceLabel: '£20',
    description:
      'Zouk Connect October networking lunch on the private mezzanine — introductions, guest insight and banquet-style lunch for Greater Manchester business owners and professionals.',
  },
  {
    orgKey: 'bniLegends',
    title: 'Business Networking in Manchester - BNI Legends',
    titleMatch: 'Business Networking in Manchester - BNI Legends',
    date: '2026-10-22T10:00:00+01:00',
    endDate: '2026-10-22T13:00:00+01:00',
    venue: 'Campfield',
    addressLine1: 'Lower Byrom Street',
    city: 'Manchester',
    postcode: 'M3 4FP',
    bookingUrl: 'https://www.eventbrite.co.uk/e/business-networking-in-manchester-bni-legends-tickets-910055108327',
    priceLabel: '£15',
    attendanceMode: 'membership_meeting',
    description:
      'BNI Legends Manchester visitor meeting at Campfield — structured referral networking with refreshments and lunch included (£15).',
  },
  {
    orgKey: 'ipxnw',
    title: 'IPxNW Autumn Networking Dinner',
    titleMatch: 'IPxNW Autumn Networking Dinner',
    date: '2026-10-22T19:00:00+01:00',
    endDate: '2026-10-22T21:00:00+01:00',
    venue: 'Browns Manchester',
    addressLine1: '1 York Street',
    city: 'Manchester',
    postcode: 'M2 2AW',
    bookingUrl: 'https://www.eventbrite.co.uk/e/ipxnw-autumn-networking-dinner-tickets-2000962325179',
    priceLabel: 'Tickets available',
    eventType: 'Dinner',
    description:
      'IPxNW Autumn Networking Dinner at Browns Manchester — three-course dinner for North West IP professionals (trade mark and patent attorneys, solicitors and barristers). Organised with Shoosmiths.',
  },
  {
    orgKey: 'troubleClub',
    title: 'Networking Breakfast: How to Make More Money',
    titleMatch: 'Networking Breakfast: How to Make More Money',
    date: '2026-10-22T08:30:00+01:00',
    endDate: '2026-10-22T10:00:00+01:00',
    venue: 'Caravan Manchester',
    addressLine1: '6 Goods Yard Street',
    city: 'Manchester',
    postcode: 'M3 3BG',
    bookingUrl:
      'https://www.eventbrite.co.uk/e/networking-breakfast-how-to-make-more-money-tickets-2003461247523',
    priceLabel: 'Tickets available',
    description:
      'The Trouble Club networking breakfast at Caravan Manchester — women’s networking with breakfast, prompt-led conversation and attendee LinkedIn list.',
  },
  {
    orgKey: 'ssasNw',
    title: 'Ask The Expert Event - SSAS North West November Networking',
    titleMatch: 'Ask The Expert Event - SSAS North West',
    date: '2026-11-04T18:00:00+00:00',
    endDate: '2026-11-04T21:00:00+00:00',
    venue: 'DoubleTree by Hilton Manchester - Piccadilly',
    addressLine1: 'One Piccadilly Place, 1 Auburn Street',
    city: 'Manchester',
    postcode: 'M1 3DG',
    bookingUrl:
      'https://www.eventbrite.co.uk/e/ask-the-expert-event-ssas-north-west-november-networking-tickets-2002938028561',
    priceLabel: 'Tickets available',
    description:
      'SSAS North West Ask The Expert evening at DoubleTree Piccadilly — property, SSAS, AI/crypto and investing experts plus open mic and networking for business owners.',
  },
  {
    orgKey: 'mbh',
    title: 'Women in Business Networking Brunch at Piccolino, Manchester',
    titleMatch: 'Women in Business Networking Brunch at Piccolino',
    date: '2026-11-10T10:00:00+00:00',
    endDate: '2026-11-10T12:30:00+00:00',
    venue: 'Piccolino Caffé Grande',
    addressLine1: '8 Clarence Street',
    city: 'Manchester',
    postcode: 'M2 4DW',
    bookingUrl:
      'https://www.eventbrite.co.uk/e/women-in-business-networking-brunch-at-piccolino-manchester-tickets-1988626811325',
    priceLabel: 'Tickets available',
    description:
      'MBH Women in Business Networking Brunch at Piccolino — guest speakers, brunch and open networking for female founders, freelancers and professionals.',
  },
  {
    orgKey: 'femaleFounderUk',
    title: 'Female Founder UK Manchester Meet Up',
    titleMatch: 'Female Founder UK Manchester Meet Up',
    date: '2026-11-13T10:30:00+00:00',
    endDate: '2026-11-13T13:30:00+00:00',
    venue: 'NatWest Accelerator Manchester',
    addressLine1: 'Spinningfields',
    city: 'Manchester',
    postcode: 'M3 3AP',
    bookingUrl:
      'https://www.eventbrite.co.uk/e/female-founder-uk-manchester-meet-up-tickets-1984571268086',
    priceLabel: '£10',
    description:
      'Female Founder UK Manchester meetup at NatWest Accelerator Spinningfields — panel, Q&A and networking for women building businesses at every stage.',
  },
  {
    orgKey: 'zouk',
    title: 'Zouk Connect: November Manchester Business Networking Lunch',
    titleMatch: 'Zouk Connect: November Manchester',
    date: '2026-11-19T12:00:00+00:00',
    endDate: '2026-11-19T14:00:00+00:00',
    venue: 'Zouk Tea Bar & Grill',
    addressLine1: 'Unit 5, The Quadrangle, Chester Street',
    city: 'Manchester',
    postcode: 'M1 5QS',
    bookingUrl: 'https://shop.zoukteabar.co.uk/products/zouk-connect-november-networking-lunch',
    priceLabel: '£20',
    description:
      'Zouk Connect November networking lunch — £20 including banquet-style lunch, introductions and guest insight on the private mezzanine.',
  },
  {
    orgKey: 'greenEconomy',
    title: 'Green Economy Networking Manchester',
    titleMatch: 'Green Economy Networking Manchester',
    date: '2026-11-20T09:30:00+00:00',
    endDate: '2026-11-20T12:30:00+00:00',
    venue: 'Bridge5Mill',
    addressLine1: '22A Beswick Street',
    city: 'Manchester',
    postcode: 'M4 7HR',
    bookingUrl: 'https://www.eventbrite.co.uk/e/green-economy-networking-manchester-tickets-2000177301151',
    priceLabel: 'Tickets available',
    description:
      'Green Economy Networking Manchester at Bridge5Mill — connections and short presentations for green technologies and environmental services businesses.',
  },
];

/** Prefer these live IDs/slugs on re-run so we never create duplicate shells. */
const ORG_SPECS = {
  propertyNexus: {
    key: 'propertyNexus',
    preferExistingId: '05e3883b-b0e5-48dc-90b7-2a1e4d0960f3',
    slug: 'property-nexus',
    name: 'Property Nexus',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.co.uk/o/property-nexus-85527918003',
    description: 'UK property networking events connecting built-environment professionals across major cities.',
  },
  gmChamber: {
    key: 'gmChamber',
    preferExistingId: '04ec9151-6c0b-4cdb-b667-f28342ab4b0f',
    slug: 'greater-manchester-chamber-of-commerce',
    name: 'Greater Manchester Chamber of Commerce',
    nameAliases: ['GM Chamber', 'Greater Manchester Chamber'],
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.gmchamber.co.uk/events',
    description: 'Greater Manchester Chamber — networking, training and flagship events for regional business.',
  },
  natwestAccelerator: {
    key: 'natwestAccelerator',
    preferExistingId: 'f51ddef0-76b6-41a8-962d-76b467a0e2c6',
    slug: 'natwest-accelerator-manchester',
    name: 'NatWest Accelerator Manchester',
    nameAliases: ['Manchester NatWest Accelerator'],
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.co.uk/o/manchester-natwest-accelerator-45703125883',
    description: 'NatWest Accelerator Manchester hub — founder programmes, She Scales and co-working community.',
  },
  bniCityCentre: {
    key: 'bniCityCentre',
    preferExistingId: '4dc57863-c781-45ec-974f-b3e1c63ced97',
    slug: 'bni-manchester-city-centre-graphene',
    name: 'BNI Manchester City Centre (Graphene)',
    nameAliases: ['BNI Manchester City Centre', 'Graphene Mcr'],
    email: 'hi@thenetworkeruk.com',
    website:
      'https://www.eventbrite.co.uk/e/bni-business-referral-networking-city-centre-tickets-1987735581633',
    description: 'BNI chapter meeting at Fountain House, Albert Square — weekly referral networking for Manchester city-centre businesses.',
  },
  zouk: {
    key: 'zouk',
    preferExistingId: '6506d964-bd2c-4727-8569-b3344666c7a4',
    slug: 'zouk-tea-bar-grill',
    name: 'Zouk Tea Bar & Grill',
    nameAliases: ['Zouk Connect', 'Zouk Tea Bar and Grill'],
    email: 'hi@thenetworkeruk.com',
    website: 'https://zoukteabar.co.uk/blog/zouk-connect/business-networking-manchester-zouk-connect',
    description: 'Zouk Connect — monthly Manchester business networking lunches on the private mezzanine.',
  },
  bniLegends: {
    key: 'bniLegends',
    preferExistingId: '84ca71f8-39ae-40a5-9573-60f3fe0d2948',
    slug: 'bni-legends-manchester',
    name: 'BNI Legends Manchester',
    nameAliases: ['BNI Legends', 'BNI Manchester'],
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.co.uk/o/bni-manchester-13377164225',
    description: 'BNI Legends — Manchester BNI chapter hosting visitor networking meetings at Campfield.',
  },
  ipxnw: {
    key: 'ipxnw',
    preferExistingId: 'a0a0e7b9-5229-4228-94cf-d88d60a1ae03',
    slug: 'ipxnw',
    name: 'IPxNW',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.co.uk/e/ipxnw-autumn-networking-dinner-tickets-2000962325179',
    description: 'IPxNW — network for intellectual property professionals across the North West.',
  },
  troubleClub: {
    key: 'troubleClub',
    preferExistingId: '7345bd44-3066-4721-ac50-6a9e5ff5f390',
    slug: 'the-trouble-club',
    name: 'The Trouble Club',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.co.uk/o/the-trouble-club-18507952259',
    description: 'The Trouble Club — women’s networking breakfasts and conversation-led events.',
  },
  ssasNw: {
    key: 'ssasNw',
    preferExistingId: 'a7581989-021b-4ee7-86f8-abfaa6368402',
    slug: 'ssas-north-west',
    name: 'SSAS North West',
    email: 'hi@thenetworkeruk.com',
    website:
      'https://www.eventbrite.co.uk/e/ask-the-expert-event-ssas-north-west-november-networking-tickets-2002938028561',
    description: 'SSAS North West — networking and expert sessions for business owners using SSAS pensions.',
  },
  mbh: {
    key: 'mbh',
    preferExistingId: '7359599a-fc4c-4220-90c6-df499efac065',
    slug: 'mbh-manchester-s-b2b-business-hub',
    name: "MBH Manchester's B2B Business Hub",
    nameAliases: ['MBH', "Manchester's B2B Business Hub"],
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.co.uk/o/mbh-manchesters-b2b-business-hub-85527918003',
    description: 'MBH — North West B2B networking including Women in Business brunch events.',
  },
  femaleFounderUk: {
    key: 'femaleFounderUk',
    preferExistingId: '9ccba776-9e47-4427-9331-cfc52fd29770',
    slug: 'female-founder-uk',
    name: 'Female Founder UK',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.co.uk/o/female-founder-uk-118178636031',
    description: 'Female Founder UK — national meetups for women building businesses across Britain.',
  },
  greenEconomy: {
    key: 'greenEconomy',
    preferExistingId: 'aaa31d93-c222-450f-95c5-c3a9fd07ce9c',
    slug: 'green-economy',
    name: 'Green Economy',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.co.uk/o/green-economy-31130127117',
    description: 'Green Economy — networking for green technologies and environmental services businesses.',
  },
};

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }
  const sb = getSupabaseAdmin();
  console.log(APPLY ? 'APPLY mode' : 'DRY-RUN — pass --apply to write');
  console.log('Manchester coverage: listing-backed dates only (no invented series)');

  console.log('\n1) Organiser shells');
  const orgIds = {};
  for (const [key, spec] of Object.entries(ORG_SPECS)) {
    orgIds[key] = await ensureGroup(sb, spec);
  }

  console.log('\n1b) Logos from listing pages');
  for (const row of VERIFIED) {
    const img = await fetchOg(row.bookingUrl);
    await setLogoIfEmpty(sb, orgIds[row.orgKey], img, ORG_SPECS[row.orgKey].name);
  }

  console.log('\n2) Verified events');
  for (const spec of VERIFIED) {
    await publishOne(sb, orgIds[spec.orgKey], spec);
  }

  console.log('\nDone.', APPLY ? 'Review /networking/manchester' : 'Re-run with --apply to write.');
  console.log('Did not extend existing hub clubs (HUSTLE, PDN, Colony, Pro 5, etc.).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
