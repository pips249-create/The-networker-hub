#!/usr/bin/env node
/**
 * Fill Brighton directory gaps (organisers + real upcoming events).
 *
 * Workflow (matches Command Centre / Glasgow import):
 *  - Existing published groups → add events only (no invite email).
 *  - New groups → create as published with send_invite OFF, then add events.
 *  - Event cover images: listing’s own image (Eventbrite og:image / cdn.evbuc /
 *    page og:image). Never rely on Unsplash stock fallbacks.
 *  - Link Out: checkout_mode=external_link + booking URL + price label so the
 *    public CTA goes to Eventbrite / organiser site (not hub tickets).
 *
 * Usage:
 *   node scripts/import-brighton-coverage-gaps.js            # dry-run
 *   node scripts/import-brighton-coverage-gaps.js --apply    # write to Supabase
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
  bbbc: 'a540db71-ef99-460c-bf8a-e28daa55c68e',
  networkMyClub: 'b09f66fb-e02e-4b6b-bb87-2d74bcf8d177',
  coWomen: 'd6c6e213-e67c-48b9-994e-89c067054625',
  betterBusinessNetwork: 'ef6d6534-b622-46e6-8dde-101b85061a31',
  hustle: '8a602220-5fdb-4ee9-8f17-3b1eb8e5d376',
  propertyDealNetwork: 'f8cdb426-f534-45d8-9cc8-192b4ae181b4',
  brittonTime: 'b3651bcc-e30c-4388-b40c-ae392319a205',
  b2bGrowthExpo: '25702edd-8778-440c-8481-a7a89a90880b',
};

const NEW_GROUPS = [
  {
    key: 'brightonChamber',
    name: 'Brighton Chamber',
    email: 'info@brightonchamber.co.uk',
    website: 'https://www.brightonchamber.co.uk/',
    description:
      'Brighton Chamber — monthly Chamber Breakfasts, structured networking, socials and learning events for businesses across Brighton & Hove.',
    photoUrl:
      'https://img.evbuc.com/https%3A%2F%2Fcdn.evbuc.com%2Fimages%2F79617145%2F49666730360%2F2%2Foriginal.jpg?w=512&auto=format%2Ccompress&q=75&sharp=10&s=ac7127e41e857bbd270a0b86cd92d6cf',
  },
  {
    key: 'networkingInBrighton',
    name: 'Networking in Brighton - Women in Business',
    email: 'hi@thenetworkeruk.com',
    website: 'https://networkinginbrighton.co.uk/',
    description:
      'Women’s business lunch and supper club in Brighton — informal networking, short introductions and a meal at The Coal Shed.',
    photoUrl:
      'https://img.evbuc.com/https%3A%2F%2Fcdn.evbuc.com%2Fimages%2F138914953%2F26006394305%2F1%2Foriginal.jpg?w=512&auto=format%2Ccompress&q=75&sharp=10',
  },
  {
    key: 'theBreakfastClubBrighton',
    name: 'The Breakfast Club - Brighton Business Networking',
    email: 'thebreakfastclubinbrighton@gmail.com',
    website: 'https://brightonnetworking.co.uk/',
    description:
      'Weekly Tuesday breakfast networking for Brighton, Hove and surrounding Sussex businesses — member-run with an exclusivity policy. Guests welcome by arrangement.',
    photoUrl:
      'https://img.evbuc.com/https%3A%2F%2Fcdn.evbuc.com%2Fimages%2F1173808556%2F255835283195%2F1%2Foriginal.20250611-112705?w=940&auto=format%2Ccompress&q=75&sharp=10',
  },
  {
    key: 'bniBrightonRocks',
    name: 'BNI Brighton Rocks',
    email: 'hi@thenetworkeruk.com',
    website: 'https://bnisussex.co.uk/',
    description:
      'Brighton BNI chapter — weekly structured referral networking for local business owners (one member per professional category).',
  },
  {
    key: 'bniHoveAlbion',
    name: 'BNI Hove Albion',
    email: 'hi@thenetworkeruk.com',
    website: 'https://bnisussex.co.uk/',
    description:
      'Hove BNI chapter — weekly structured referral networking for local business owners across Brighton & Hove.',
  },
  {
    key: 'bniBrightonPavilion',
    name: 'BNI Brighton Pavilion',
    email: 'hi@thenetworkeruk.com',
    website: 'https://bnisussex.co.uk/sussex-east-pavilion-bni-brighton/en-GB/index',
    description:
      'BNI Brighton Pavilion chapter — weekly referral networking for businesses in Brighton and the surrounding area.',
  },
  {
    key: 'bniCityHove',
    name: 'BNI City (Hove)',
    email: 'hi@thenetworkeruk.com',
    website: 'https://bnisussex.co.uk/',
    description:
      'BNI City chapter meeting in Hove — weekly structured referral networking for local professionals.',
  },
  {
    key: 'fsbConnectBrighton',
    name: 'FSB Connect Brighton',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.fsb.org.uk/',
    description:
      'Federation of Small Businesses Connect Brighton — regular networking at Brighton Marina Yacht Club for members and non-members.',
  },
  {
    key: 'bbbc',
    preferExistingId: EXISTING.bbbc,
    name: 'Big Business Breakfast Club - Brighton',
    email: 'team@bigbusinessbreakfastclub.co.uk',
    website: 'https://www.bigbusinessbreakfastclub.co.uk/',
    description:
      'Sussex-based face-to-face business networking breakfasts with no awkward pitching — third Friday of every month at leading Brighton venues.',
  },
  {
    key: 'networkMyClub',
    preferExistingId: EXISTING.networkMyClub,
    name: 'Network My Club',
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.networkmyclub.co.uk/',
    description:
      'Premium bi-monthly networking lunches for SME directors and decision-makers — including events at the Amex Stadium, Brighton.',
  },
];

/** Title prefix → booking page used to backfill real cover images (no stock). */
const IMAGE_BACKFILL = [
  {
    titleMatch: 'Chamber Breakfast',
    bookingUrl: 'https://www.eventbrite.co.uk/e/chamber-breakfast-october-tickets-1990376885845',
  },
  {
    titleMatch: '12 Minute Conversations',
    bookingUrl: 'https://www.eventbrite.co.uk/e/12-minute-conversations-november-tickets-1999526841609',
  },
  {
    titleMatch: 'Networking in Brighton',
    bookingUrl:
      'https://www.eventbrite.co.uk/e/networking-in-brighton-women-in-business-third-wednesday-tickets-1908724308789',
  },
  {
    titleMatch: 'Brighton Business Networking',
    bookingUrl: 'https://www.eventbrite.co.uk/e/brighton-business-networking-tickets-1979475029098',
  },
  {
    titleMatch: 'Networking Lunch | Amex Stadium',
    bookingUrl: 'https://www.networkmyclub.co.uk/networking-at-the-amex-stadium/',
    fallbackImage:
      'https://www.networkmyclub.co.uk/wp-content/uploads/2024/01/amex-stadium-networking.jpg',
  },
  {
    titleMatch: 'Big Business Breakfast Club',
    bookingUrl: 'https://www.bigbusinessbreakfastclub.co.uk/',
    fallbackImage:
      'https://vibe.filesafe.space/1787079332757693081/attachments/4cd27bf4-22e8-425b-98f7-80143d70e36d.jpg',
  },
];

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
    }) || 'brighton';
  return {
    venue: venue || '',
    addressLine1: addressLine1 || '',
    city: resolvedCity || 'Brighton',
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
      if (APPLY && spec.photoUrl) {
        await sb
          .from('organisers')
          .update({
            listing_status: 'published',
            website: spec.website || undefined,
            description: spec.description || undefined,
            photo_url: spec.photoUrl,
          })
          .eq('id', existing.id);
      }
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
    logoUrl: spec.photoUrl || undefined,
  });
  try {
    await assignUniqueOrganiserSlug(sb, created.id, spec.name);
  } catch (e) {
    console.warn('    slug assign failed:', e.message || e);
  }
  if (spec.photoUrl) {
    await sb.from('organisers').update({ photo_url: spec.photoUrl }).eq('id', created.id);
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
  console.log('\n3) Backfill real listing images (replace missing/weak/stock covers)');
  for (const row of IMAGE_BACKFILL) {
    if (row.eventId) {
      await applyImageToEvent(sb, row.eventId, row.bookingUrl, row.fallbackImage);
      continue;
    }
    const { data, error } = await sb
      .from('events')
      .select('id, title, image_url, city, region_slug')
      .ilike('title', row.titleMatch + '%')
      .or('city.ilike.%Brighton%,city.ilike.%Hove%,region_slug.eq.brighton')
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

function breakfastClubTuesdays() {
  const dates = [
    '2026-10-27',
    '2026-11-03',
    '2026-11-10',
    '2026-11-17',
    '2026-11-24',
    '2026-12-01',
    '2026-12-08',
    '2026-12-15',
    '2026-12-22',
  ];
  return dates.map((d) => ({
    date: `${d}T08:00:00+00:00`,
    endDate: `${d}T09:00:00+00:00`,
  }));
}

function buildEventSpecs(createdMap) {
  return [
    // ── Brighton Chamber (Eventbrite) ──
    {
      organiserId: createdMap.brightonChamber,
      title: 'Chamber Breakfast October',
      titleMatch: 'Chamber Breakfast October',
      eventType: 'Meeting',
      date: '2026-10-23T07:45:00+01:00',
      endDate: '2026-10-23T09:30:00+01:00',
      venue: "Bill's Brighton",
      addressLine1: 'The Depot, 100 North Road',
      city: 'Brighton',
      postcode: 'BN1 1YE',
      bookingUrl: 'https://www.eventbrite.co.uk/e/chamber-breakfast-october-tickets-1990376885845',
      priceLabel: 'From £30',
      priceNote: 'Chamber member from £30 / taster from £36 — book via Eventbrite.',
      description:
        "Brighton Chamber’s monthly breakfast at Bill’s — informal networking, cooked breakfast and a guest speaker. Popular with 50–80 local business people.",
    },
    {
      organiserId: createdMap.brightonChamber,
      title: 'Chamber Breakfast November',
      titleMatch: 'Chamber Breakfast November',
      eventType: 'Meeting',
      date: '2026-11-27T07:45:00+00:00',
      endDate: '2026-11-27T09:30:00+00:00',
      venue: "Bill's Brighton",
      addressLine1: 'The Depot, 100 North Road',
      city: 'Brighton',
      postcode: 'BN1 1YE',
      bookingUrl: 'https://www.eventbrite.co.uk/e/chamber-breakfast-november-tickets-1990376970097',
      priceLabel: 'From £30',
      priceNote: 'Chamber member from £30 / taster from £36 — book via Eventbrite.',
      description:
        "Brighton Chamber’s monthly breakfast at Bill’s — meet local businesses over breakfast with a guest speaker.",
    },
    {
      organiserId: createdMap.brightonChamber,
      title: '12 Minute Conversations: November',
      titleMatch: '12 Minute Conversations',
      eventType: 'Meeting',
      date: '2026-11-10T10:00:00+00:00',
      endDate: '2026-11-10T12:00:00+00:00',
      venue: 'WRAP - Coworking, Meeting Rooms & Offices',
      addressLine1: '83 Queens Road',
      city: 'Brighton and Hove',
      postcode: 'BN1 3XE',
      bookingUrl: 'https://www.eventbrite.co.uk/e/12-minute-conversations-november-tickets-1999526841609',
      priceLabel: 'Tickets available',
      priceNote: 'Book via Eventbrite.',
      description:
        'Brighton Chamber structured networking — small-group conversations that rotate every 12 minutes so you keep meeting new people.',
    },
    {
      organiserId: createdMap.brightonChamber,
      title: 'The Big Debate: Are Brighton businesses resilient enough?',
      titleMatch: 'The Big Debate',
      eventType: 'Meeting',
      date: '2026-11-12T17:30:00+00:00',
      endDate: '2026-11-12T19:30:00+00:00',
      venue: 'PLATF9RM, Hove',
      addressLine1: 'Hove Town Hall, Church Road',
      city: 'Hove',
      postcode: 'BN3 2AF',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/the-big-debate-are-brighton-businesses-resilient-enough-tickets-1989083587555',
      priceLabel: 'Free',
      priceNote: 'Free — book via Eventbrite.',
      description:
        'Brighton Chamber evening debate on business resilience — networking and discussion at PLATF9RM, Hove Town Hall.',
    },
    {
      organiserId: createdMap.brightonChamber,
      title: 'Chamber connections: Brighton x Chichester x Worthing & Adur Chamber',
      titleMatch: 'Chamber connections',
      eventType: 'Meeting',
      date: '2026-11-19T09:30:00+00:00',
      endDate: '2026-11-19T11:00:00+00:00',
      venue: 'Ropetackle Arts Centre',
      addressLine1: 'Little High Street',
      city: 'Shoreham-by-Sea',
      postcode: 'BN43 5EG',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/chamber-connections-brighton-x-chichester-x-worthing-adur-chamber-tickets-1991044523768',
      priceLabel: 'Tickets available',
      priceNote: 'Book via Eventbrite.',
      description:
        'Joint chamber networking connecting Brighton, Chichester and Worthing & Adur members at Ropetackle Arts Centre, Shoreham.',
    },
    {
      organiserId: createdMap.brightonChamber,
      title: 'Leaders Lunch at Wild Flor',
      titleMatch: 'Leaders Lunch at Wild Flor',
      eventType: 'Meeting',
      date: '2026-12-01T12:00:00+00:00',
      endDate: '2026-12-01T14:30:00+00:00',
      venue: 'Wild Flor',
      addressLine1: '42 Church Road',
      city: 'Brighton and Hove',
      postcode: 'BN3 2FN',
      bookingUrl: 'https://www.eventbrite.co.uk/e/leaders-lunch-at-wild-flor-tickets-1994930388494',
      priceLabel: 'Tickets available',
      priceNote: 'Book via Eventbrite.',
      description:
        'Brighton Chamber Leaders Lunch at Wild Flor in Hove — smaller-group networking lunch for local business leaders.',
    },

    // ── Networking in Brighton (women) ──
    {
      organiserId: createdMap.networkingInBrighton,
      title: 'Networking in Brighton - Women in Business - First Wednesday',
      titleMatch: 'Networking in Brighton - Women in Business - First Wednesday',
      eventType: 'Meeting',
      date: '2026-11-04T12:00:00+00:00',
      endDate: '2026-11-04T14:15:00+00:00',
      venue: 'The Coal Shed Brighton',
      addressLine1: '30-31 North Street',
      city: 'Brighton and Hove',
      postcode: 'BN1 1EB',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/networking-in-brighton-women-in-business-first-wednesday-tickets-1908712001979',
      priceLabel: 'From £30',
      priceNote: 'Members and guests from £30 — book via Eventbrite. Guests may attend twice before joining.',
      description:
        'Women’s business lunch networking at The Coal Shed — informal networking, 1-minute introductions, a short talk and lunch with a drink.',
    },
    {
      organiserId: createdMap.networkingInBrighton,
      title: 'Networking in Brighton - Women in Business - Second Tuesday Evening',
      titleMatch: 'Networking in Brighton - Women in Business - Second Tuesday Evening',
      eventType: 'Meeting',
      occurrences: [
        { date: '2026-11-10T17:00:00+00:00', endDate: '2026-11-10T19:15:00+00:00' },
        { date: '2026-12-08T17:00:00+00:00', endDate: '2026-12-08T19:15:00+00:00' },
      ],
      venue: 'The Coal Shed Brighton',
      addressLine1: '30-31 North Street',
      city: 'Brighton and Hove',
      postcode: 'BN1 1EB',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/networking-in-brighton-women-in-business-second-tuesday-evening-tickets-1329774745059',
      priceLabel: 'From £30',
      priceNote: 'Members and guests from £30 — book via Eventbrite.',
      description:
        'Women’s early-evening networking supper at The Coal Shed — introductions, a short development talk, meal and peer discussion.',
    },
    {
      organiserId: createdMap.networkingInBrighton,
      title: 'Networking in Brighton - Women in Business - Third Wednesday',
      titleMatch: 'Networking in Brighton - Women in Business - Third Wednesday',
      eventType: 'Meeting',
      occurrences: [
        { date: '2026-11-18T12:00:00+00:00', endDate: '2026-11-18T14:15:00+00:00' },
        { date: '2026-12-16T12:00:00+00:00', endDate: '2026-12-16T14:15:00+00:00' },
      ],
      venue: 'The Coal Shed Brighton',
      addressLine1: '30-31 North Street',
      city: 'Brighton and Hove',
      postcode: 'BN1 1EB',
      bookingUrl:
        'https://www.eventbrite.co.uk/e/networking-in-brighton-women-in-business-third-wednesday-tickets-1908724308789',
      priceLabel: 'From £30',
      priceNote: 'Members and guests from £30 — book via Eventbrite.',
      description:
        'Women’s business lunch at The Coal Shed — informal networking, presentations, a short talk and lunch with a drink.',
    },

    // ── The Breakfast Club (weekly) ──
    {
      organiserId: createdMap.theBreakfastClubBrighton,
      title: 'Brighton Business Networking — The Breakfast Club',
      titleMatch: 'Brighton Business Networking',
      eventType: 'Meeting',
      attendanceMode: 'membership_meeting',
      occurrences: breakfastClubTuesdays(),
      venue: 'The Townie Fox',
      addressLine1: '1 Woodland Parade, Woodland Drive',
      city: 'Hove',
      postcode: 'BN3 6DR',
      bookingUrl: 'https://www.eventbrite.co.uk/e/brighton-business-networking-tickets-1979475029098',
      priceLabel: 'From £30',
      priceNote:
        'Guest visits by arrangement — £30/month membership covers tea/coffee and toast. Book / request a visit via Eventbrite or brightonnetworking.co.uk.',
      description:
        'Weekly Tuesday breakfast networking for Brighton & Hove businesses at The Townie Fox — member-run with exclusivity by trade. Guests welcome up to two visits.',
    },

    // ── Big Business Breakfast Club ──
    {
      organiserId: createdMap.bbbc || EXISTING.bbbc,
      title: 'Big Business Breakfast Club — November at Queens Hotel',
      titleMatch: 'Big Business Breakfast Club — November',
      eventType: 'Meeting',
      date: '2026-11-20T08:00:00+00:00',
      endDate: '2026-11-20T10:00:00+00:00',
      venue: 'Queens Hotel Brighton',
      addressLine1: "1-3 King's Road",
      city: 'Brighton',
      postcode: 'BN1 1NS',
      bookingUrl: 'https://www.bigbusinessbreakfastclub.co.uk/',
      fallbackImage:
        'https://vibe.filesafe.space/1787079332757693081/attachments/4cd27bf4-22e8-425b-98f7-80143d70e36d.jpg',
      priceLabel: 'From £30',
      priceNote: '£30 + VAT including full English and unlimited drinks — book via the BBBC website.',
      description:
        'Monthly Big Business Breakfast Club — relaxed networking for Brighton, Hove and Sussex business owners with speakers and no hard-sell pitches. Doors from 7:15am.',
    },

    // ── Network My Club Amex ──
    {
      organiserId: createdMap.networkMyClub || EXISTING.networkMyClub,
      title: 'Networking Lunch | Amex Stadium | Brighton',
      titleMatch: 'Networking Lunch | Amex Stadium',
      eventType: 'Meeting',
      date: '2026-11-12T12:00:00+00:00',
      endDate: '2026-11-12T15:00:00+00:00',
      venue: 'Amex Stadium',
      addressLine1: 'Village Way, Falmer',
      city: 'Brighton',
      postcode: 'BN1 9BL',
      bookingUrl: 'https://www.networkmyclub.co.uk/networking-at-the-amex-stadium/',
      priceLabel: 'From £69',
      priceNote: 'Non-members £69 + VAT; members discounted or free — book via Network My Club.',
      description:
        'Premium bi-monthly Network My Club lunch at the Amex Stadium — 100+ SME directors and decision-makers, buffet lunch, guest list in advance, no pitches.',
    },
  ];
}

/** Already-live Brighton listings to convert to Link Out. */
const LINK_OUT_BACKFILL = [
  {
    titleMatch: 'HUSTLE Brighton Entrepreneur Networking',
    bookingUrl: 'https://www.hustleentrepreneur.com/locations/united-kingdom-networking-events/',
    priceLabel: 'Free',
  },
  {
    titleMatch: 'Property Deal Network Brighton',
    bookingUrl: 'https://www.propertydealnetwork.com/locations/united-kingdom-networking-events/',
    priceLabel: 'Free',
  },
  {
    titleMatch: 'Brighton | Better Business Breakfast',
    bookingUrl: 'https://thebetterbusiness.network/',
    priceLabel: 'Enquire for price',
  },
  {
    titleMatch: 'B2BX BRIGHTON',
    bookingUrl: 'https://b2bgrowthexpo.com/',
    priceLabel: 'Enquire for price',
  },
  {
    titleMatch: 'Britton & Time Solicitors - The Breakfast',
    bookingUrl: 'https://www.eventbrite.co.uk/e/the-breakfast-2-november-2026-tickets-1983348848797',
    priceLabel: 'Tickets available',
  },
];

async function backfillLinkOuts(sb) {
  console.log('\n4) Backfill Link Out on existing Brighton listings');
  for (const row of LINK_OUT_BACKFILL) {
    if (row.eventId) {
      await applyLinkOut(sb, row.eventId, row);
      continue;
    }
    const { data, error } = await sb
      .from('events')
      .select('id, title, checkout_mode, external_booking_url, city, region_slug')
      .ilike('title', row.titleMatch + '%')
      .or('city.ilike.%Brighton%,city.ilike.%Hove%,region_slug.eq.brighton')
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

  console.log('\n1) Ensure groups (published, no invite email)');
  const createdMap = {};
  for (const spec of NEW_GROUPS) {
    await ensureNewGroup(sb, spec, createdMap);
  }

  console.log('\n2) Add / refresh Brighton events (+ Link Out)');
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

  console.log('\nDone.', APPLY ? 'Review /networking/brighton' : 'Re-run with --apply to write.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
