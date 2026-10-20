#!/usr/bin/env node
/**
 * Glasgow pass 5: listing-backed missing events from the Oct/Nov coverage audit.
 * No cadence guesses. No claim emails. Skips claimed/paying organisers.
 *
 *   node scripts/import-glasgow-pass5-missing-listings.js
 *   node scripts/import-glasgow-pass5-missing-listings.js --apply
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

const CHAMBER_ID = '5b79f98e-3a41-44b8-b612-f84baa763d75';

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

async function ensureGroup(sb, spec) {
  if (spec.preferExistingId) {
    const { data } = await sb
      .from('organisers')
      .select('id, listing_status')
      .eq('id', spec.preferExistingId)
      .maybeSingle();
    if (data) return data.id;
  }
  if (spec.slug) {
    const { data } = await sb.from('organisers').select('id, listing_status').eq('slug', spec.slug).maybeSingle();
    if (data) {
      if (String(data.listing_status || '').toLowerCase() !== 'published' && APPLY) {
        if (!(await isClaimedOrPayingOrganiser(sb, data.id))) {
          await sb.from('organisers').update({ listing_status: 'published' }).eq('id', data.id);
        }
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
  if (byName) return byName.id;
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
  const photoUrl =
    spec.imageUrl || (spec.bookingUrl ? await fetchOg(spec.bookingUrl) : '') || '';
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

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }
  const sb = getSupabaseAdmin();
  console.log(APPLY ? 'APPLY mode' : 'DRY-RUN — pass --apply to write');
  console.log('Glasgow pass 5: listing-backed missing events only');

  console.log('\n1) Organiser shells');
  const goRadioId = await ensureGroup(sb, {
    key: 'goRadio',
    name: 'Go Radio',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.co.uk/o/go-radio-18507952259',
    description: 'Go Radio Business Show events — dinners and networking with Scotland’s business leaders.',
  });
  const gulsId = await ensureGroup(sb, {
    key: 'guls',
    name: 'Glasgow University Law Society',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.com/o/glasgow-university-law-society-34083158973',
    description: 'GULS — student law society hosting Bubbles and Truffles and careers networking with leading firms.',
  });
  const westEndId = await ensureGroup(sb, {
    key: 'westEndBusinessConnect',
    name: 'The West End Business Connect',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.co.uk/o/the-west-end-business-connect-102445939621',
    description:
      'Supportive West End Glasgow morning networking for local business owners and professionals at Broomhill Hyndland Parish Church.',
  });
  const lsId = await ensureGroup(sb, {
    key: 'lsConnections',
    name: 'LS Connections - Networking',
    email: 'info@lsconnectionsnetworking.com',
    website: 'https://www.eventbrite.co.uk/o/ls-connections-networking-69788492583',
    description:
      'Structured Tuesday morning networking at Malmaison Glasgow for solo professionals and SME owners.',
  });
  const nakeId = await ensureGroup(sb, {
    key: 'nakeStudios',
    name: 'Nake Studios',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.co.uk/o/nake-studios-boluwaji-apanisile-87019037973',
    description: 'Nake Studios — Cultural Architects gatherings exploring culture, influence and economic power.',
  });
  const afrosocialId = await ensureGroup(sb, {
    key: 'afrosocial',
    name: 'Afrosocial UK',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.fatsoma.com/e/6wrqt1r4/glasgow-mixer-black-history-month-edition',
    description:
      'Afrosocial — community-led professional mixers for Black entrepreneurs, creatives and leaders across the UK.',
  });
  const wesId = await ensureGroup(sb, {
    key: 'wes',
    name: "Women's Enterprise Scotland",
    email: 'info@wescotland.co.uk',
    website: 'https://www.wescotland.co.uk/awards2026',
    description: 'Women’s Enterprise Scotland — awards and support celebrating women-led businesses across Scotland.',
  });
  const designPopId = await ensureGroup(sb, {
    key: 'designPopUp',
    name: 'DesignPopUp / Il Salotto',
    email: 'info@designpopup.com',
    website: 'https://www.designpopup.com/educationaldays',
    description:
      'DesignPopUp at Il Salotto — architecture and design community CPDs, Sustainability Day and Parmesan & Prosecco networking.',
  });
  const smallBizId = await ensureGroup(sb, {
    key: 'smallBizBigChat',
    name: 'Small Biz Big Chat Glasgow',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.smallbizcommunity.co.uk/about',
    description:
      'Small Biz Big Chat — supportive co-working and networking for female, non-binary and gender-fluid founders in Glasgow.',
  });
  const konpasuId = await ensureGroup(sb, {
    key: 'konpasu',
    name: 'Konpasu Community Glasgow',
    email: 'Wendy@konpasu.co.uk',
    website: 'https://konpasu.co.uk/business-networking-glasgow/',
    description:
      'Formerly LinkedIn Local Glasgow — monthly conversation-led networking at The Alchemist, George Square (3rd Tuesday).',
  });
  const coWomenId = await ensureGroup(sb, {
    key: 'coWomen',
    slug: 'co-women',
    name: 'Co-Women',
    email: 'jo@co-women.org',
    website: 'https://www.co-women.org/',
    description: 'Multi-award-winning women’s networking community — Chai & Chatter sessions.',
  });

  console.log('\n1b) Logos from listing pages');
  for (const row of [
    { id: goRadioId, label: 'Go Radio', url: 'https://www.eventbrite.co.uk/e/an-evening-with-hunter-haughey-tickets-1997724941076' },
    { id: gulsId, label: 'GULS', url: 'https://www.eventbrite.com/e/bubbles-and-truffles-2026-tickets-2002947008420' },
    {
      id: westEndId,
      label: 'West End Business Connect',
      url: 'https://www.eventbrite.co.uk/e/business-networking-tickets-2000611522920',
    },
    {
      id: lsId,
      label: 'LS Connections',
      url: 'https://www.eventbrite.co.uk/e/glasgow-ls-connections-networking-tuesday-morning-business-networking-tickets-1448964123699',
    },
    {
      id: nakeId,
      label: 'Nake Studios',
      url: 'https://www.eventbrite.co.uk/e/the-cultural-architects-2026-beyond-representation-tickets-2002342439137',
    },
    {
      id: wesId,
      label: 'WES',
      url: 'https://events.bookitbee.com/womens-enterprise-scotland/womens-enterprise-scotland-awards-2026/',
    },
    {
      id: smallBizId,
      label: 'Small Biz Big Chat',
      url: 'https://www.eventbrite.co.uk/e/glasgow-co-working-for-female-founders-small-biz-big-chat-nov26-tickets-2002800778041',
    },
    {
      id: konpasuId,
      label: 'Konpasu',
      url: 'https://www.eventbrite.co.uk/e/konpasu-community-glasgow-online-connections-become-real-conversations-tickets-1984971684743',
    },
  ]) {
    await setLogoIfEmpty(sb, row.id, await fetchOg(row.url), row.label);
  }

  console.log('\n2) Listing-backed events');
  const events = [
    {
      organiserId: goRadioId,
      title: 'An Evening with Hunter & Haughey',
      titleMatch: 'An Evening with Hunter',
      date: '2026-10-20T18:00:00+01:00',
      endDate: '2026-10-20T21:30:00+01:00',
      venue: 'Barclays Hampden',
      addressLine1: 'Letherby Drive',
      city: 'Glasgow',
      postcode: 'G42 9BA',
      bookingUrl: 'https://www.eventbrite.co.uk/e/an-evening-with-hunter-haughey-tickets-1997724941076',
      priceLabel: 'From £80',
      eventType: 'Dinner',
      description:
        'Go Radio dinner with Sir Tom Hunter and Lord Willie Haughey at Barclays Hampden, in association with Arnold Clark Leasing — welcome drink, two-course meal, interview, Q&A and networking.',
    },
    {
      organiserId: gulsId,
      title: 'Bubbles and Truffles 2026',
      titleMatch: 'Bubbles and Truffles',
      date: '2026-10-21T18:30:00+01:00',
      endDate: '2026-10-21T21:00:00+01:00',
      venue: 'Glasgow University Union',
      addressLine1: '32 University Avenue',
      city: 'Glasgow',
      postcode: 'G12 8LX',
      bookingUrl: 'https://www.eventbrite.com/e/bubbles-and-truffles-2026-tickets-2002947008420',
      priceLabel: '£8',
      description:
        'Glasgow University Law Society evening of networking and presentations with leading law firms at Glasgow University Union.',
    },
    {
      organiserId: westEndId,
      title: 'West End Business Connect — Business Networking',
      titleMatch: 'West End Business Connect',
      date: '2026-10-22T08:00:00+01:00',
      endDate: '2026-10-22T09:30:00+01:00',
      venue: 'Broomhill Hyndland Parish Church of Scotland',
      addressLine1: '64-66 Randolph Road',
      city: 'Glasgow',
      postcode: 'G11 7JL',
      bookingUrl: 'https://www.eventbrite.co.uk/e/business-networking-tickets-2000611522920',
      priceLabel: 'From £7.50',
      description:
        'The West End Business Connect morning networking — supportive session for local business owners and professionals in Glasgow’s West End.',
    },
    {
      organiserId: nakeId,
      title: 'The Cultural Architects 2026: Beyond Representation',
      titleMatch: 'The Cultural Architects 2026',
      date: '2026-10-24T11:00:00+01:00',
      endDate: '2026-10-24T14:00:00+01:00',
      venue: 'Glasgow Grosvenor Hotel',
      addressLine1: '1-9 Grosvenor Terrace',
      city: 'Glasgow',
      postcode: 'G12 0TA',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/the-cultural-architects-2026-beyond-representation-tickets-2002342439137',
      priceLabel: 'Free',
      description:
        'Black History Month gathering exploring culture, influence and economic power — panel, audience Q&A and networking at the Glasgow Grosvenor Hotel.',
    },
    {
      organiserId: lsId,
      title: 'Glasgow LS Connections Networking - Tuesday Morning Business Networking',
      titleMatch: 'Glasgow LS Connections Networking',
      date: '2026-10-27T10:00:00+00:00',
      endDate: '2026-10-27T12:00:00+00:00',
      venue: 'Malmaison Glasgow',
      addressLine1: '278 West George Street',
      city: 'Glasgow',
      postcode: 'G2 4LL',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/glasgow-ls-connections-networking-tuesday-morning-business-networking-tickets-1448964123699',
      priceLabel: 'From £5',
      description:
        'LS Connections structured Tuesday morning networking at Malmaison Glasgow — member showcases, guest speakers and connections for solo professionals and SMEs.',
    },
    {
      organiserId: afrosocialId,
      title: 'Glasgow Mixer — Black History Month Edition',
      titleMatch: 'Glasgow Mixer — Black History Month',
      date: '2026-10-29T18:30:00+00:00',
      endDate: '2026-10-29T21:00:00+00:00',
      venue: 'Barclays Eagle Labs Glasgow',
      addressLine1: 'BECO Building, 58 Kingston Street',
      city: 'Glasgow',
      postcode: 'G5 8BP',
      bookingUrl: 'https://www.fatsoma.com/e/6wrqt1r4/glasgow-mixer-black-history-month-edition',
      priceLabel: 'Free',
      description:
        'Afrosocial mixer in partnership with Barclays Eagle Labs — evening for Black professionals, creatives, entrepreneurs and community builders during Black History Month.',
    },
    {
      organiserId: wesId,
      title: "Women's Enterprise Scotland Awards 2026",
      titleMatch: "Women's Enterprise Scotland Awards",
      date: '2026-10-29T18:30:00+00:00',
      endDate: '2026-10-29T23:00:00+00:00',
      venue: 'voco Grand Central Glasgow',
      addressLine1: '99 Gordon Street',
      city: 'Glasgow',
      postcode: 'G1 3SF',
      bookingUrl:
        'https://events.bookitbee.com/womens-enterprise-scotland/womens-enterprise-scotland-awards-2026/',
      priceLabel: 'From £114',
      eventType: 'Awards',
      description:
        'Women’s Enterprise Scotland Awards 2026 — drinks reception, three-course dinner and awards celebrating women-led businesses across Scotland.',
    },
    {
      organiserId: designPopId,
      title: 'Autumn Parmesan and Prosecco Party',
      titleMatch: 'Autumn Parmesan and Prosecco',
      date: '2026-10-29T18:00:00+00:00',
      endDate: '2026-10-29T20:30:00+00:00',
      venue: 'Il Salotto',
      addressLine1: '20 Bell Street',
      city: 'Glasgow',
      postcode: 'G1 1LG',
      bookingUrl: 'https://www.designpopup.com/educationaldays',
      priceLabel: 'Free',
      description:
        'DesignPopUp Autumn Parmesan and Prosecco Party at Il Salotto — free networking evening following Sustainability Day for Scotland’s architecture and design community.',
    },
    {
      organiserId: coWomenId,
      title: 'Glasgow Chai & Chatter: A Co-Women Networking Event',
      titleMatch: 'Glasgow Chai & Chatter',
      date: '2026-10-30T10:00:00+00:00',
      endDate: '2026-10-30T11:30:00+00:00',
      venue: 'Rose & Grants Cafe',
      addressLine1: '27 Trongate',
      city: 'Glasgow',
      postcode: 'G1 5EZ',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/glasgow-chai-chatter-a-co-women-networking-event-tickets-2000008086024',
      priceLabel: 'From £17',
      description:
        'Co-Women Chai & Chatter — relaxed women’s networking with 60-second ask-and-give introductions and peer tips at Rose & Grants Cafe.',
    },
    {
      organiserId: smallBizId,
      title: "Glasgow Co-working for Female Founders | Small Biz Big Chat (Nov'26)",
      titleMatch: 'Glasgow Co-working for Female Founders',
      date: '2026-11-02T10:30:00+00:00',
      endDate: '2026-11-02T13:30:00+00:00',
      venue: "Nest. Glasgow's Family Wellbeing Centre",
      addressLine1: '117 Brook Street',
      city: 'Glasgow',
      postcode: 'G40 3AP',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/glasgow-co-working-for-female-founders-small-biz-big-chat-nov26-tickets-2002800778041',
      priceLabel: '£10',
      description:
        'Small Biz Big Chat co-working for female, non-binary and gender-fluid founders at Nest — introductions, optional troubleshooting clinic and low-key networking. Limited to 14 places.',
    },
    {
      organiserId: konpasuId,
      title: 'Konpasu Community Glasgow - Online Connections Become Real Conversations',
      titleMatch: 'Konpasu Community Glasgow',
      date: '2026-10-20T09:30:00+01:00',
      endDate: '2026-10-20T11:30:00+01:00',
      venue: 'The Alchemist Glasgow',
      addressLine1: 'George Square, Unit 2',
      city: 'Glasgow',
      postcode: 'G2 1EH',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/konpasu-community-glasgow-online-connections-become-real-conversations-tickets-1984971684743',
      priceLabel: '£10',
      description:
        'Konpasu Community Glasgow (formerly LinkedIn Local) — conversation-led morning networking at The Alchemist, George Square. No pitches; real conversations for freelancers, consultants and business owners.',
    },
    {
      organiserId: konpasuId,
      title: 'Konpasu Community Glasgow - Online Connections Become Real Conversations',
      titleMatch: 'Konpasu Community Glasgow',
      date: '2026-11-17T09:30:00+00:00',
      endDate: '2026-11-17T11:30:00+00:00',
      venue: 'The Alchemist Glasgow',
      addressLine1: 'George Square, Unit 2',
      city: 'Glasgow',
      postcode: 'G2 1EH',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/konpasu-community-glasgow-online-connections-become-real-conversations-tickets-1984971684743',
      priceLabel: '£10',
      description:
        'Konpasu Community Glasgow (formerly LinkedIn Local) — third-Tuesday conversation-led networking at The Alchemist, George Square. Booked via the organiser’s multi-date Eventbrite series.',
    },
    {
      organiserId: CHAMBER_ID,
      title: 'Spring Speed Networking Lunch',
      titleMatch: 'Spring Speed Networking Lunch',
      date: '2027-04-22T12:00:00+01:00',
      endDate: '2027-04-22T14:30:00+01:00',
      venue: 'Glasgow City Centre',
      addressLine1: 'Glasgow',
      city: 'Glasgow',
      postcode: 'G2 1DY',
      bookingUrl: 'https://www.glasgowchamberofcommerce.com/events/',
      priceLabel: 'From £40',
      description:
        'Glasgow Chamber Spring Speed Networking Lunch — two-course lunch and a glass of wine with structured introductions in the city centre. Member rate from £40; non-member from £70. Book via the Chamber portal.',
    },
  ];

  for (const spec of events) {
    await publishOne(sb, spec.organiserId, spec);
  }

  console.log('\nDone.', APPLY ? 'Review /networking/glasgow' : 'Re-run with --apply to write.');
  console.log(
    'Note: Strive Nov 11 already listed as Multi-Vertical. Eventbrite directory page is not a listing.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
