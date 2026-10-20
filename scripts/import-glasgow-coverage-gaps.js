#!/usr/bin/env node
/**
 * Fill Glasgow directory gaps (coverage check + follow-up passes).
 *
 * Workflow (matches Command Centre):
 *  - Existing published groups → add events only (no invite email).
 *  - New groups → create as published with send_invite OFF, then add events.
 *    (Plain "Create group" leaves listing_status=draft, which hides events.)
 *  - Event cover images: fetch the listing’s own image (Eventbrite og:image /
 *    cdn.evbuc, or page og:image). Never rely on Unsplash stock fallbacks.
 *  - Link Out: set checkout_mode=external_link + booking URL + price label so
 *    the public CTA goes to Eventbrite/Chamber/IoD/FSB (not hub tickets).
 *    Applied via service-role patch after create (directory seeding; no claim email).
 *
 * Usage:
 *   node scripts/import-glasgow-coverage-gaps.js            # dry-run
 *   node scripts/import-glasgow-coverage-gaps.js --apply    # write to Supabase
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

/** Existing organisers — do not recreate; do not email. */
const EXISTING = {
  b2bMixer: '520fc5c4-d16b-422d-abe2-2d453da30ff9',
  glasgowGirlsClub: '373cdaaf-39a5-4800-b3a6-dbdcfa1b7681',
  scottishNationalNetwork: 'b1c7f012-682f-482a-b5d9-d219c5592a57',
  striveNetworking: '71af2e2a-8b85-4e67-9c80-4707e7b19829',
  infinityBniGlasgow: '22133fd7-526a-443a-8415-97b5860b48db',
  scottishConstructionSummit: '0d130517-1437-462c-b6d8-feab63bd8485',
  foundersCoffeeClubGlasgow: '2f62af72-76b7-487f-be04-1e33719adc85',
  bniNexusGlasgow: 'b282c28b-2589-4129-b614-f854763a232f',
  theBusinessConnection: 'e4cec2d2-aed0-48bd-ba42-e64ffd3b8102',
  swib: '41772b77-dd4e-46a9-9a44-a61844e49784',
  chamberGlasgow: '5b79f98e-3a41-44b8-b612-f84baa763d75',
  fsbScotland: '3ac0176b-b903-46df-9801-26bd702fc78b',
  businessGateway: '8c5df762-fe25-47e3-ae87-c7704aa915c8',
};

const B2B_MIXER_GLASGOW_ID = '5a2dae36-3cd8-47eb-a760-691545ac090b';

const NEW_GROUPS = [
  {
    key: 'scottishConstructionSummit',
    preferExistingId: EXISTING.scottishConstructionSummit,
    name: 'Scottish Construction Summit',
    email: 'raymond@scottishnews.com',
    website: 'https://www.scottishconstructionsummit.com/',
    description:
      'Scotland’s gathering for construction professionals — exhibition, speakers and networking at the SEC Glasgow.',
  },
  {
    key: 'foundersCoffeeClubGlasgow',
    preferExistingId: EXISTING.foundersCoffeeClubGlasgow,
    name: 'Founders Coffee Club Glasgow',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.com/o/founders-coffee-club',
    description:
      'Monthly coffee meetup for founders, freelancers and small business owners in Glasgow — no pitches, real conversations.',
  },
  {
    key: 'bniNexusGlasgow',
    preferExistingId: EXISTING.bniNexusGlasgow,
    name: 'BNI Nexus Glasgow',
    email: 'hi@thenetworkeruk.com',
    website: 'https://bninexus.com/',
    description:
      'Weekly BNI chapter meeting in Bellahouston — local business owners exchanging referrals every Friday morning.',
  },
  {
    key: 'bipcGlasgow',
    name: 'BIPC Glasgow',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.glasgowlife.org.uk/libraries/business-and-ip-centre-glasgow',
    description:
      'Business & IP Centre Glasgow at the Mitchell Library — free support, workshops and networking for start-ups and growing businesses.',
  },
  {
    key: 'glasgowRoyalBankAccelerator',
    name: 'Glasgow Royal Bank Accelerator',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.business.bankofscotland.co.uk/',
    description:
      'Royal Bank Accelerator Glasgow hub — founder programmes, She Scales women’s sessions and co-working community.',
  },
  {
    key: 'coWomen',
    name: 'Co-Women',
    email: 'jo@co-women.org',
    website: 'https://www.co-women.org/',
    description:
      'Multi-award-winning women’s networking community — relaxed Chai & Chatter sessions focused on ask-and-give connections.',
  },
  {
    key: 'barbellsBusinessCards',
    name: 'Barbells & Business Cards Networking',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.co.uk/o/barbells-business-cards-networking-118178636031',
    description:
      'Networking that brings health, sports and fitness professionals together with business owners and entrepreneurs.',
  },
  {
    key: 'eightBusinessNetworking',
    name: '8 Business Networking',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.co.uk/o/colin-mckeand-31130127117',
    description:
      'Friendly, productive Glasgow morning networking community — popular coffee meetings with free first visits.',
  },
  {
    key: 'iodGlasgowWest',
    name: 'The Institute of Directors - Glasgow & West of Scotland',
    email: 'donna.bell@iod.com',
    website: 'https://www.iod.com/',
    description:
      'IoD Glasgow & West of Scotland — monthly breakfast networking and director community events.',
  },
  {
    key: 'dunbartonshireChamber',
    name: 'Dunbartonshire Chamber of Commerce',
    email: 'admin@dunbartonshirechamber.co.uk',
    website: 'https://www.dunbartonshirechamber.co.uk/',
    description:
      'Dunbartonshire Chamber of Commerce — business breakfasts and networking for members across West Dunbartonshire and beyond.',
  },
  {
    key: 'scottishPropertyPodcast',
    name: 'Scottish Property Podcast',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.co.uk/o/scottish-property-podcast',
    description:
      'Networking events for Scotland’s property investor community, linked with the Scottish Property Podcast.',
  },
];

/** Title prefix → booking page used to backfill real cover images (no stock). */
const IMAGE_BACKFILL = [
  {
    titleMatch: 'B2B Mixer Glasgow',
    bookingUrl:
      'https://www.eventbrite.co.uk/e/b2b-mixer-glasgow-100-networking-event-making-referrals-tickets-2000394304213',
    eventId: B2B_MIXER_GLASGOW_ID,
  },
  {
    titleMatch: 'The Connection Games',
    bookingUrl: 'https://www.eventbrite.com/e/the-connection-games-november-tickets-1999383605185',
  },
  {
    titleMatch: 'SNN Business Exchange',
    bookingUrl: 'https://www.eventbrite.co.uk/e/snn-business-exchange-tickets-1992691360501',
  },
  {
    titleMatch: 'Multi-Vertical Business Networking',
    bookingUrl:
      'https://www.eventbrite.co.uk/e/multi-vertical-business-networking-elevating-your-potential-glasgow-tickets-1992706758557',
  },
  {
    titleMatch: 'Scottish Construction Summit',
    bookingUrl: 'https://www.scottishconstructionsummit.com/',
    fallbackImage: 'https://www.scottishconstructionsummit.com/assets/SCS-2026-social.jpg',
  },
  {
    titleMatch: 'Founders Coffee Club',
    bookingUrl:
      'https://www.eventbrite.com/e/glasgow-networking-events-for-founders-founders-coffee-club-tickets-2002710497008',
  },
  {
    titleMatch: 'BNI Nexus Glasgow',
    bookingUrl: 'https://www.eventbrite.co.uk/e/bni-nexus-networking-friday-tickets-1981021963019',
  },
];

function bookingBlurb(url, priceNote, { linkOut } = {}) {
  const lines = [];
  if (priceNote) lines.push(priceNote);
  // When Link Out is set, the Book CTA carries the URL — skip duplicating it in copy.
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
  if (/enquire|portal|chamber/i.test(note)) return 'Enquire for price';
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
  const { error } = await sb
    .from('events')
    .update({
      checkout_mode: CHECKOUT_LINK_OUT,
      external_booking_url: url,
      external_price_label: priceLabel,
      ticket_sales_enabled: true,
    })
    .eq('id', eventId);
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
  if (!m) m = html.match(/name=["']twitter:image["']\s+content=["']([^"']+)/i);
  let raw = m ? m[1] : '';
  raw = raw.replace(/&amp;/g, '&');
  const normalised = normalizeEventPhotoUrl(raw);
  if (normalised) return normalised;
  const cdn = html.match(/https?:\/\/cdn\.evbuc\.com\/[^\s"'<>]+/i);
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
    }) || 'glasgow';
  return {
    venue: venue || '',
    addressLine1: addressLine1 || '',
    city: resolvedCity || 'Glasgow',
    postcode: postcode || '',
    location: locationLabel,
    outcode,
    lat,
    lng,
    regionSlug,
  };
}

async function ensureNewGroup(sb, spec, createdMap) {
  if (spec.preferExistingId) {
    const { data: existing } = await sb
      .from('organisers')
      .select('id, name, listing_status, slug, email')
      .eq('id', spec.preferExistingId)
      .maybeSingle();
    if (existing) {
      console.log(
        `  · reuse existing ${existing.name} (${existing.id}) instead of creating ${spec.name}`
      );
      createdMap[spec.key] = existing.id;
      return existing.id;
    }
  }

  const { data: byName } = await sb
    .from('organisers')
    .select('id, name, listing_status, slug')
    .ilike('name', spec.name)
    .limit(1)
    .maybeSingle();
  if (byName) {
    console.log(`  · already exists: ${byName.name} (${byName.id})`);
    if (String(byName.listing_status || '').toLowerCase() !== 'published' && APPLY) {
      await sb.from('organisers').update({ listing_status: 'published' }).eq('id', byName.id);
      console.log('    published (no invite email)');
    }
    createdMap[spec.key] = byName.id;
    return byName.id;
  }

  if (!APPLY) {
    console.log(`  · would create published group (no email): ${spec.name} <${spec.email}>`);
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

async function eventExists(sb, organiserId, titlePrefix) {
  if (String(organiserId).startsWith('dry-run:')) return false;
  const { data, error } = await sb
    .from('events')
    .select('id, title, starts_at, image_url, checkout_mode, external_booking_url, external_price_label')
    .eq('organiser_id', organiserId)
    .ilike('title', titlePrefix + '%')
    .gte('starts_at', new Date().toISOString())
    .limit(5);
  if (error) throw new Error(error.message);
  return (data && data[0]) || null;
}

function wantsLinkOut(spec) {
  if (spec.linkOut === false) return false;
  return Boolean(linkOutUrlFromSpec(spec));
}

async function publishEvent(sb, organiserId, spec) {
  const useLinkOut = wantsLinkOut(spec);
  const existing = await eventExists(sb, organiserId, spec.titleMatch || spec.title.slice(0, 24));
  if (existing) {
    console.log(`  · skip (already listed): ${existing.title} @ ${existing.starts_at}`);
    if (isWeakImageUrl(existing.image_url) && (spec.bookingUrl || spec.imageUrl)) {
      await applyImageToEvent(sb, existing.id, spec.bookingUrl, spec.imageUrl);
    }
    if (
      useLinkOut &&
      (String(existing.checkout_mode || '') !== CHECKOUT_LINK_OUT ||
        !String(existing.external_booking_url || '').trim() ||
        !String(existing.external_price_label || '').trim())
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
      `  · would publish: ${spec.title} | ${spec.date || (spec.occurrences || []).length + ' dates'} | ${geo.city} ${geo.postcode} | image=${photoUrl ? 'yes' : 'NO'} | linkOut=${useLinkOut ? priceLabelFromSpec(spec) : 'no'}`
    );
    return null;
  }

  if (String(organiserId).startsWith('dry-run:')) {
    console.log('  · skip create — organiser was dry-run');
    return null;
  }

  const occurrences = (spec.occurrences || [{ date: spec.date, endDate: spec.endDate }]).map(
    (o) => ({
      date: o.date,
      endDate: o.endDate || o.date,
    })
  );
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

  for (const ev of events) {
    const { error } = await sb.from('events').update(patch).eq('id', ev.id);
    if (error) console.warn('    geo/image patch failed', ev.id, error.message);
    if (useLinkOut) await applyLinkOut(sb, ev.id, spec);
  }

  console.log(
    `  · published ${events.length} date(s): ${spec.title}${photoUrl ? ' (with listing image)' : ' (no image found)'}${useLinkOut ? ' + Link Out' : ''}`
  );
  return events[0];
}

async function applyImageToEvent(sb, eventId, bookingUrl, explicitImage) {
  const photoUrl = explicitImage || (await fetchListingImage(bookingUrl));
  if (!photoUrl) {
    console.log(`  · no listing image for ${eventId}`);
    return;
  }
  if (!APPLY) {
    console.log(`  · would set image on ${eventId}: ${photoUrl.slice(0, 90)}…`);
    return;
  }
  const { error } = await sb
    .from('events')
    .update({ image_url: eventImageDbValue(photoUrl) })
    .eq('id', eventId);
  if (error) console.warn('    image patch failed', eventId, error.message);
  else console.log(`  · set listing image on ${eventId}`);
}

async function backfillImages(sb) {
  console.log('\n4) Backfill real listing images (replace missing/weak/stock covers)');
  for (const row of IMAGE_BACKFILL) {
    if (row.eventId) {
      await applyImageToEvent(sb, row.eventId, row.bookingUrl, row.fallbackImage);
      continue;
    }
    const { data, error } = await sb
      .from('events')
      .select('id, title, image_url, city')
      .ilike('title', row.titleMatch + '%')
      .ilike('city', 'Glasgow')
      .gte('starts_at', new Date().toISOString())
      .limit(20);
    if (error) throw new Error(error.message);
    const targets = (data || []).filter((e) => isWeakImageUrl(e.image_url));
    if (!targets.length) {
      console.log(`  · ${row.titleMatch}: already has usable image(s) or not found`);
      continue;
    }
    const photoUrl = await fetchListingImage(row.bookingUrl, row.fallbackImage);
    if (!photoUrl) {
      console.log(`  · ${row.titleMatch}: could not fetch listing image`);
      continue;
    }
    for (const ev of targets) {
      if (!APPLY) {
        console.log(`  · would set image: ${ev.title}`);
        continue;
      }
      const { error: upErr } = await sb
        .from('events')
        .update({ image_url: eventImageDbValue(photoUrl) })
        .eq('id', ev.id);
      if (upErr) console.warn('    failed', ev.id, upErr.message);
      else console.log(`  · set image: ${ev.title}`);
    }
  }
}

async function fixB2bMixerGeo(sb) {
  console.log('\n1) Fix B2B Mixer Glasgow geo fields');
  const geo = await enrichGeo({
    venue: "Waxy O'Connor's Glasgow",
    addressLine1: '44 West George Street',
    city: 'Glasgow',
    postcode: 'G2 1DH',
  });
  if (!APPLY) {
    console.log('  · would set', {
      city: geo.city,
      postcode: geo.postcode,
      outcode: geo.outcode,
      venue: geo.venue,
      lat: geo.lat,
      lng: geo.lng,
      region_slug: geo.regionSlug,
    });
    return;
  }
  const { error } = await sb
    .from('events')
    .update({
      city: geo.city,
      postcode: geo.postcode,
      outcode: geo.outcode,
      venue: geo.venue,
      address: geo.addressLine1,
      location_label: `${geo.venue}, ${geo.city}`,
      region_slug: geo.regionSlug,
      latitude: geo.lat,
      longitude: geo.lng,
    })
    .eq('id', B2B_MIXER_GLASGOW_ID);
  if (error) throw new Error(error.message);
  console.log('  · updated B2B Mixer Glasgow location → G2 1DH');
}

function buildEventSpecs(createdMap) {
  return [
    // ── Pass 1 (idempotent) ──
    {
      organiserId: EXISTING.glasgowGirlsClub,
      title: 'The Connection Games – November',
      titleMatch: 'The Connection Games',
      eventType: 'Meeting',
      date: '2026-11-26T10:00:00+00:00',
      endDate: '2026-11-26T12:00:00+00:00',
      venue: 'GGC HQ / The Clubhouse',
      addressLine1: 'Suite 119, Central Chambers, 91 Hope Street',
      city: 'Glasgow',
      postcode: 'G2 6LL',
      bookingUrl: 'https://www.eventbrite.com/e/the-connection-games-november-tickets-1999383605185',
      priceNote: 'Tickets from £5 + VAT (members) / £10 + VAT (guests) via Eventbrite.',
      description:
        'Monthly gamified networking for women in business at Glasgow Girls Club HQ — creative icebreakers, guided discussions and peer support over morning coffee.',
    },
    {
      organiserId: EXISTING.scottishNationalNetwork,
      title: 'SNN Business Exchange',
      eventType: 'Conference',
      date: '2026-11-12T09:00:00+00:00',
      endDate: '2026-11-12T17:00:00+00:00',
      venue: 'Celtic Park',
      addressLine1: 'Janefield Street',
      city: 'Glasgow',
      postcode: 'G40 3RE',
      bookingUrl: 'https://www.eventbrite.co.uk/e/snn-business-exchange-tickets-1992691360501',
      priceNote: 'Tickets via Eventbrite. Pitch Perfect entry via hello@scottishnationalnetwork.com.',
      description:
        'Full-day Scottish National Network Business Exchange at Celtic Park — structured networking, founder stories, workshops and the £5,000 Pitch Perfect investor-readiness prize.',
    },
    {
      organiserId: EXISTING.striveNetworking,
      title: 'Multi-Vertical Business Networking | Elevating Your Potential - Glasgow',
      titleMatch: 'Multi-Vertical Business Networking',
      eventType: 'Meeting',
      date: '2026-11-11T18:00:00+00:00',
      endDate: '2026-11-11T20:00:00+00:00',
      venue: 'Bunker Bar',
      addressLine1: '193-199 Bath Street',
      city: 'Glasgow',
      postcode: 'G2 4HU',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/multi-vertical-business-networking-elevating-your-potential-glasgow-tickets-1992706758557',
      priceNote: 'Tickets via Eventbrite.',
      description:
        'Strive multi-vertical evening networking at Bunker Bar in Glasgow city centre — for tenured professionals and newcomers.',
    },
    {
      organiserId: createdMap.scottishConstructionSummit || EXISTING.scottishConstructionSummit,
      title: 'Scottish Construction Summit 2026',
      eventType: 'Exhibition',
      date: '2026-10-22T09:30:00+01:00',
      endDate: '2026-10-22T16:00:00+01:00',
      venue: 'SEC Centre, Hall 5',
      addressLine1: 'Exhibition Way',
      city: 'Glasgow',
      postcode: 'G3 8YW',
      bookingUrl: 'https://www.scottishconstructionsummit.com/',
      fallbackImage: 'https://www.scottishconstructionsummit.com/assets/SCS-2026-social.jpg',
      priceNote: 'Free to attend for visitors — register via the summit website.',
      description:
        'Scotland’s largest gathering of construction professionals at the SEC Glasgow — exhibition floor, speakers, Future Talent Hub and networking across the industry.',
    },
    {
      organiserId: createdMap.foundersCoffeeClubGlasgow || EXISTING.foundersCoffeeClubGlasgow,
      title: 'Glasgow Networking Events for Founders | Founders Coffee Club',
      titleMatch: 'Founders Coffee Club',
      eventType: 'Meeting',
      date: '2026-11-20T11:00:00+00:00',
      endDate: '2026-11-20T12:00:00+00:00',
      venue: 'Clockwise Glasgow',
      addressLine1: '77 Renfrew Street',
      city: 'Glasgow',
      postcode: 'G2 3BZ',
      bookingUrl:
        'https://www.eventbrite.com/e/glasgow-networking-events-for-founders-founders-coffee-club-tickets-2002710497008',
      priceNote: 'Tickets £15 (launch £7.50) via Eventbrite. Monthly — 3rd Friday.',
      description:
        'Relaxed founders coffee meetup at Clockwise Glasgow — no pitches, host-led introductions, option to stay and co-work after.',
    },
    {
      organiserId: createdMap.bniNexusGlasgow || EXISTING.bniNexusGlasgow,
      title: 'BNI Nexus Glasgow Weekly Business Networking Meeting',
      titleMatch: 'BNI Nexus Glasgow',
      eventType: 'Meeting',
      attendanceMode: 'membership_meeting',
      occurrences: [
        { date: '2026-10-23T06:45:00+01:00', endDate: '2026-10-23T08:30:00+01:00' },
        { date: '2026-10-30T06:45:00+00:00', endDate: '2026-10-30T08:30:00+00:00' },
        { date: '2026-11-06T06:45:00+00:00', endDate: '2026-11-06T08:30:00+00:00' },
        { date: '2026-11-13T06:45:00+00:00', endDate: '2026-11-13T08:30:00+00:00' },
        { date: '2026-11-20T06:45:00+00:00', endDate: '2026-11-20T08:30:00+00:00' },
        { date: '2026-11-27T06:45:00+00:00', endDate: '2026-11-27T08:30:00+00:00' },
      ],
      venue: 'Prince & Princess of Wales Hospice',
      addressLine1: '20 Dumbreck Road, Bellahouston',
      city: 'Glasgow',
      postcode: 'G41 5BW',
      bookingUrl: 'https://www.eventbrite.co.uk/e/bni-nexus-networking-friday-tickets-1981021963019',
      priceNote: 'Visitor places via the chapter — enquire on the listing / Eventbrite page.',
      description:
        'Weekly Friday BNI Nexus Glasgow meeting — local business owners building referral relationships. One member per business category.',
    },

    // ── Pass 2 ──
    {
      organiserId: createdMap.bipcGlasgow,
      title: 'Networking Coffee Morning with BIPC Glasgow',
      titleMatch: 'Networking Coffee Morning with BIPC',
      eventType: 'Meeting',
      date: '2026-10-30T10:00:00+00:00',
      endDate: '2026-10-30T11:30:00+00:00',
      venue: 'The Mitchell Library',
      addressLine1: 'North Street',
      city: 'Glasgow',
      postcode: 'G3 7DN',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/networking-coffee-morning-with-bipc-glasgow-tickets-2002447561561',
      priceNote: 'Free — breakfast rolls and hot drinks included. Book via Eventbrite.',
      description:
        'Friendly sit-down networking coffee morning with BIPC Glasgow — meet fellow business owners and learn about free Business & IP Centre support.',
    },
    {
      organiserId: createdMap.bipcGlasgow,
      title: 'Start-Up Day 2026',
      titleMatch: 'Start-Up Day 2026',
      eventType: 'Conference',
      date: '2026-11-24T10:00:00+00:00',
      endDate: '2026-11-24T17:30:00+00:00',
      venue: 'The Mitchell Library',
      addressLine1: 'North Street',
      city: 'Glasgow',
      postcode: 'G3 7DN',
      bookingUrl: 'https://www.eventbrite.co.uk/e/start-up-day-2026-tickets-2002513628168',
      priceNote: 'Free — book sessions via Eventbrite.',
      description:
        'Full day at the Mitchell Library for aspiring founders — networking coffee morning, panels, IP workshops, British Library screenings and a networking lunch.',
    },
    {
      organiserId: createdMap.glasgowRoyalBankAccelerator,
      title: 'She Scales x egg: Meet the Founders of Goat Rodeo Goods',
      titleMatch: 'She Scales',
      eventType: 'Meeting',
      date: '2026-11-18T10:00:00+00:00',
      endDate: '2026-11-18T12:00:00+00:00',
      venue: 'Royal Bank Accelerator Glasgow',
      addressLine1: '110 Queen Street, 4th Floor',
      city: 'Glasgow',
      postcode: 'G1 3BX',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/she-scales-female-founders-connection-and-co-working-day-tickets-1999017846190',
      priceNote: 'Book via Eventbrite.',
      description:
        'She Scales female founders session hosted with egg — conversation with the founders of Goat Rodeo Goods, plus connection time for women building businesses.',
    },
    {
      organiserId: createdMap.glasgowRoyalBankAccelerator,
      title: 'She Scales - Female Founders Connection and Co-Working Day',
      titleMatch: 'She Scales - Female Founders Connection',
      eventType: 'Meeting',
      date: '2026-12-11T10:00:00+00:00',
      endDate: '2026-12-11T15:00:00+00:00',
      venue: 'Royal Bank Accelerator Glasgow',
      addressLine1: '110 Queen Street, 4th Floor',
      city: 'Glasgow',
      postcode: 'G1 3BX',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/she-scales-female-founders-connection-and-co-working-day-tickets-1999017907373',
      priceNote: 'Book via Eventbrite.',
      description:
        'Monthly She Scales female founders connection and co-working day — founder spotlights, peer conversation and optional afternoon co-working at the Glasgow Accelerator hub.',
    },
    {
      organiserId: createdMap.eightBusinessNetworking,
      title: '8 Business Networking Coffee Morning NOV',
      titleMatch: '8 Business Networking Coffee Morning',
      eventType: 'Meeting',
      date: '2026-11-18T09:30:00+00:00',
      endDate: '2026-11-18T11:00:00+00:00',
      venue: 'The Alchemist Glasgow',
      addressLine1: 'Unit 2, George Square',
      city: 'Glasgow',
      postcode: 'G2 1EH',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/8-business-networking-coffee-morning-nov-tickets-2003195399364',
      priceNote: 'Free for first-time visitors — book via Eventbrite.',
      description:
        'Popular 8 Business Networking Glasgow morning meeting — friendly, business-focused community coffee networking at The Alchemist.',
    },
    {
      organiserId: createdMap.coWomen,
      title: 'Glasgow Chai & Chatter: A Co-Women Networking Event',
      titleMatch: 'Glasgow Chai & Chatter',
      eventType: 'Meeting',
      date: '2026-11-27T10:00:00+00:00',
      endDate: '2026-11-27T11:30:00+00:00',
      venue: 'Rose & Grants Cafe',
      addressLine1: '27 Trongate',
      city: 'Glasgow',
      postcode: 'G1 5EZ',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/glasgow-chai-chatter-a-co-women-networking-event-tickets-2002937777811',
      priceNote: 'Book via Eventbrite. Last Friday of the month.',
      description:
        'Co-Women Chai & Chatter — relaxed women’s networking with optional 60-second ask-and-give, peer introductions and no pitching pressure.',
    },
    {
      organiserId: createdMap.barbellsBusinessCards,
      title: 'Barbells & Business Cards - Health & Business Networking Event',
      titleMatch: 'Barbells & Business Cards',
      eventType: 'Meeting',
      date: '2026-11-27T09:30:00+00:00',
      endDate: '2026-11-27T11:30:00+00:00',
      venue: 'Hillhead Sports Club',
      addressLine1: '32 Hughenden Road',
      city: 'Glasgow',
      postcode: 'G12 9XP',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/barbells-business-cards-health-business-networking-event-tickets-1984302369804',
      priceNote: 'Book via Eventbrite.',
      description:
        'Networking that connects health, wellbeing and sports professionals with business owners — introductions, collaboration and community at Hillhead Sports Club.',
    },
    {
      organiserId: createdMap.foundersCoffeeClubGlasgow || EXISTING.foundersCoffeeClubGlasgow,
      title: 'Glasgow Networking Events for Founders | Founders Coffee Club (December)',
      titleMatch: 'Founders Coffee Club (December)',
      eventType: 'Meeting',
      date: '2026-12-18T11:00:00+00:00',
      endDate: '2026-12-18T12:00:00+00:00',
      venue: 'Clockwise Glasgow',
      addressLine1: '77 Renfrew Street',
      city: 'Glasgow',
      postcode: 'G2 3BZ',
      bookingUrl:
        'https://www.eventbrite.com/e/glasgow-networking-events-for-founders-founders-coffee-club-tickets-2002712345537',
      priceNote: 'Tickets £15 (launch £7.50) via Eventbrite.',
      description:
        'December Founders Coffee Club at Clockwise Glasgow — no pitches, host-led introductions, option to stay and co-work after.',
    },
    {
      organiserId: EXISTING.swib,
      title: 'December Face-to-Face Coffee Meet up at The Clubhouse',
      titleMatch: 'December Face-to-Face Coffee Meet up',
      eventType: 'Meeting',
      date: '2026-12-01T09:30:00+00:00',
      endDate: '2026-12-01T11:00:00+00:00',
      venue: 'The Clubhouse, Princes Square',
      addressLine1: 'Princes Square, Buchanan Street',
      city: 'Glasgow',
      postcode: 'G1 3JN',
      bookingUrl:
        'https://www.scottishwomeninbusiness.org.uk/events/519-december-face-to-face-coffee-meet-up-at-the-clubhouse/',
      priceNote: 'Open to members and non-members — book via SWIB.',
      description:
        'SWIB December face-to-face coffee meet-up — personal introductions, local connections and complimentary tea or coffee at The Clubhouse.',
    },
    {
      organiserId: EXISTING.chamberGlasgow,
      title: 'Christmas Women\'s Networking Lunch at The Ivy Buchanan Street',
      titleMatch: "Christmas Women's Networking Lunch",
      eventType: 'Meeting',
      date: '2026-12-03T12:00:00+00:00',
      endDate: '2026-12-03T14:30:00+00:00',
      venue: 'The Ivy Buchanan Street',
      addressLine1: 'Buchanan Street',
      city: 'Glasgow',
      postcode: 'G1 2FF',
      bookingUrl: 'https://www.glasgowchamberofcommerce.com/events/',
      priceLabel: 'Enquire for price',
      priceNote: 'Book via Glasgow Chamber portal (member and non-member rates).',
      description:
        'Glasgow Chamber Christmas Women’s Networking Lunch — two-course lunch and a glass of wine at The Ivy Buchanan Street.',
    },
    {
      organiserId: EXISTING.chamberGlasgow,
      title: 'Speed Networking Lunch at Alea Casino',
      titleMatch: 'Speed Networking Lunch at Alea',
      eventType: 'Meeting',
      date: '2026-10-22T12:00:00+01:00',
      endDate: '2026-10-22T14:30:00+01:00',
      venue: 'Alea Casino',
      addressLine1: 'Glasgow',
      city: 'Glasgow',
      postcode: 'G2 3EX',
      bookingUrl: 'https://www.glasgowchamberofcommerce.com/events/',
      priceLabel: 'From £40',
      priceNote: 'Member £40 / non-member £70 — book via Glasgow Chamber portal.',
      description:
        'Glasgow Chamber autumn speed networking lunch — two-course lunch, a glass of wine and structured introductions.',
    },
    {
      organiserId: EXISTING.theBusinessConnection,
      title: 'The Business Connection Pre-Dinner Networking (Glasgow)',
      titleMatch: 'The Business Connection Pre-Dinner',
      eventType: 'Meeting',
      date: '2027-01-28T17:30:00+00:00',
      endDate: '2027-01-28T19:00:00+00:00',
      venue: 'YOTEL Glasgow (Vega Restaurant)',
      addressLine1: '260 Argyle Street',
      city: 'Glasgow',
      postcode: 'G2 8QW',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/the-business-connection-pre-dinner-networking-glasgow-tickets-1993485790663',
      priceLabel: '£7',
      priceNote: '£7 subsidised — drink and small plate included. Book via Eventbrite.',
      description:
        'Relaxed midweek networking for working professionals — light bites, drinks and conversation at YOTEL Glasgow.',
    },

    // ── Pass 3 (IoD / FSB / Business Gateway / Chamber extras) ──
    {
      organiserId: createdMap.iodGlasgowWest,
      title: 'IoD Glasgow & West of Scotland Monthly Breakfast Networking Event',
      titleMatch: 'IoD Glasgow & West of Scotland Monthly Breakfast',
      eventType: 'Meeting',
      date: '2026-10-22T08:30:00+01:00',
      endDate: '2026-10-22T10:30:00+01:00',
      venue: 'VEGA, YOTEL Glasgow',
      addressLine1: '260 Argyle Street',
      city: 'Glasgow',
      postcode: 'G2 8QW',
      bookingUrl:
        'https://www.iod.com/events/iod_glasgow_west_of_scotland_monthly_breakfast_networking_event1088073839/',
      fallbackImage:
        'https://assets-gbr.mkt.dynamics.com/3d10f99b-9259-4f54-b3e8-f7555348045c/digitalassets/images/21f05859-c09f-f111-b8de-7ced8d9a5122?ts=639231752051909304',
      priceLabel: 'Free',
      priceNote: 'Free to attend — breakfast can be purchased at the hotel. Book via IoD.',
      description:
        'Monthly IoD Glasgow & West breakfast networking at YOTEL — meet fellow directors, share issues affecting your business and make new connections.',
    },
    {
      organiserId: EXISTING.fsbScotland,
      title: 'FSB Connect Glasgow - Oct',
      titleMatch: 'FSB Connect Glasgow',
      eventType: 'Meeting',
      date: '2026-10-29T10:00:00+00:00',
      endDate: '2026-10-29T12:00:00+00:00',
      venue: 'FSB Scotland Office',
      addressLine1: '58 Waterloo Street',
      city: 'Glasgow',
      postcode: 'G2 7DA',
      bookingUrl: 'https://events.fsb.org.uk/en/8d2bI2X7/g/fJqTd8nh8e/fsb-connect-glasgow-oct-3aJ8Pziib',
      priceLabel: 'Free',
      priceNote: 'Free for FSB members and non-members — book via FSB events.',
      description:
        'Popular FSB Connect networking for small businesses and the self-employed at the FSB Scotland office — tea, coffee and face-to-face introductions.',
    },
    {
      organiserId: EXISTING.businessGateway,
      title: 'Business Networking Breakfast',
      titleMatch: 'Business Networking Breakfast',
      eventType: 'Meeting',
      date: '2026-10-29T09:30:00+00:00',
      endDate: '2026-10-29T11:00:00+00:00',
      venue: 'Greenlaw Business Centre',
      addressLine1: '6 Greenlaw Way',
      city: 'Glasgow',
      postcode: 'G77 6EF',
      bookingUrl: 'https://www.bgateway.com/events/business-networking-breakfast-32321',
      priceLabel: 'Free',
      priceNote: 'Free — book via Business Gateway.',
      description:
        'Business Gateway breakfast networking — coffee, breakfast rolls and connections with local people and businesses at Greenlaw Business Centre.',
    },
    {
      organiserId: EXISTING.chamberGlasgow,
      title: "Glasgow Talks... with Gavin Birch-Williams, Managing Director of Glasgow Airport",
      titleMatch: 'Glasgow Talks',
      eventType: 'Meeting',
      date: '2026-10-28T10:00:00+00:00',
      endDate: '2026-10-28T12:00:00+00:00',
      venue: 'Glasgow',
      addressLine1: 'Glasgow',
      city: 'Glasgow',
      postcode: 'G2 1DY',
      bookingUrl: 'https://www.glasgowchamberofcommerce.com/events/',
      priceLabel: 'From £35',
      priceNote: 'Member £35 / non-member £60 — book via Glasgow Chamber portal.',
      description:
        'Glasgow Chamber Talks with Gavin Birch-Williams, Managing Director of Glasgow Airport — Cleared for Take-Off: Glasgow Airport’s vision for the next decade, plus networking.',
    },
    {
      organiserId: createdMap.dunbartonshireChamber,
      title: 'DCC Business Breakfast Meeting - November 19th',
      titleMatch: 'DCC Business Breakfast Meeting',
      eventType: 'Meeting',
      date: '2026-11-19T08:30:00+00:00',
      endDate: '2026-11-19T10:00:00+00:00',
      venue: 'Golden Jubilee Conference Hotel',
      addressLine1: 'Beardmore Street, Clydebank',
      city: 'Glasgow',
      postcode: 'G81 4SA',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/dcc-business-breakfast-meeting-november-19th-tickets-1998891924555',
      priceLabel: 'Tickets available',
      priceNote: 'Chamber members discounted — book via Eventbrite (guest pass code GUEST50 for first-time non-members).',
      description:
        'Dunbartonshire Chamber Business Breakfast Club at the Golden Jubilee Hotel, Clydebank — network with local businesses over coffee and a breakfast roll.',
    },
    {
      organiserId: EXISTING.chamberGlasgow,
      title: 'Behind the Scenes Breakfast at Ikea',
      titleMatch: 'Behind the Scenes Breakfast at Ikea',
      eventType: 'Meeting',
      date: '2027-01-21T10:00:00+00:00',
      endDate: '2027-01-21T12:00:00+00:00',
      venue: 'IKEA Glasgow',
      addressLine1: 'Glasgow',
      city: 'Glasgow',
      postcode: 'G51 4ED',
      bookingUrl: 'https://www.glasgowchamberofcommerce.com/events/',
      priceLabel: 'Enquire for price',
      priceNote: 'Book via Glasgow Chamber portal.',
      description:
        'Glasgow Chamber Behind the Scenes breakfast at IKEA Glasgow — an exclusive look behind the operation plus networking over breakfast.',
    },
    {
      organiserId: createdMap.scottishPropertyPodcast,
      title: 'Scottish Property Podcast Networking Event Glasgow - 4th November 2026',
      titleMatch: 'Scottish Property Podcast Networking',
      eventType: 'Meeting',
      date: '2026-11-04T18:00:00+00:00',
      endDate: '2026-11-04T21:00:00+00:00',
      venue: 'Glasgow',
      addressLine1: 'Glasgow',
      city: 'Glasgow',
      postcode: 'G2 1DH',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/scottish-property-podcast-networking-event-glasgow-4th-november-2026-tickets-2003403552957',
      priceLabel: 'Tickets available',
      priceNote: 'Book via Eventbrite.',
      description:
        'Scottish Property Podcast networking evening in Glasgow — meet property investors, developers and professionals from the podcast community.',
    },
  ];
}

/** Already-live Glasgow listings to convert to Link Out (not created by this script). */
const LINK_OUT_BACKFILL = [
  {
    titleMatch: 'HUSTLE Glasgow Entrepreneur Networking',
    bookingUrl:
      'https://www.eventbrite.co.uk/e/hustle-glasgow-entrepreneur-networking-event-tickets-2000154508979',
    priceLabel: 'Free',
  },
  {
    titleMatch: 'Property Deal Network Glasgow',
    bookingUrl:
      'https://www.eventbrite.co.uk/e/property-deal-network-glasgow-pdn-property-investor-networking-event-tickets-2001772049085',
    priceLabel: 'Free',
  },
  {
    titleMatch: 'B2B Mixer Glasgow',
    bookingUrl:
      'https://www.eventbrite.co.uk/e/b2b-mixer-glasgow-100-networking-event-making-referrals-tickets-2000394304213',
    priceLabel: 'Tickets available',
    eventId: B2B_MIXER_GLASGOW_ID,
  },
];

async function backfillLinkOuts(sb) {
  console.log('\n5) Backfill Link Out on existing Glasgow listings');
  for (const row of LINK_OUT_BACKFILL) {
    if (row.linkOut === false) continue;
    if (row.eventId) {
      await applyLinkOut(sb, row.eventId, row);
      continue;
    }
    const { data, error } = await sb
      .from('events')
      .select('id, title, checkout_mode, external_booking_url, city')
      .ilike('title', row.titleMatch + '%')
      .ilike('city', 'Glasgow')
      .gte('starts_at', new Date().toISOString())
      .limit(10);
    if (error) throw new Error(error.message);
    if (!(data || []).length) {
      console.log(`  · ${row.titleMatch}: not found`);
      continue;
    }
    for (const ev of data) {
      await applyLinkOut(sb, ev.id, row);
    }
  }
}

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }
  const sb = getSupabaseAdmin();
  console.log(APPLY ? 'APPLY mode — writing to Supabase' : 'DRY-RUN — pass --apply to write');
  console.log('Images: listing covers from Eventbrite/og:image (no Unsplash stock).');
  console.log('Checkout: Link Out (external_link) where a booking URL is known.');

  await fixB2bMixerGeo(sb);

  console.log('\n2) Ensure groups (published, no invite email)');
  const createdMap = {};
  for (const spec of NEW_GROUPS) {
    await ensureNewGroup(sb, spec, createdMap);
  }

  console.log('\n3) Add / refresh Glasgow events (+ Link Out)');
  for (const spec of buildEventSpecs(createdMap)) {
    const orgId = spec.organiserId;
    if (!orgId) {
      console.log(`  · skip ${spec.title} — missing organiser id`);
      continue;
    }
    await publishEvent(sb, orgId, spec);
  }

  await backfillImages(sb);
  await backfillLinkOuts(sb);

  console.log('\nDone.', APPLY ? 'Review /networking/glasgow' : 'Re-run with --apply to write.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
