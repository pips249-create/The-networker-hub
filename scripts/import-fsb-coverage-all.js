#!/usr/bin/env node
/**
 * Import ALL upcoming FSB Connect events from a scraped calendar dump
 * (/tmp/fsb-all-parsed.json) onto the closest Hub FSB organiser, Link Out.
 *
 *   node scripts/import-fsb-coverage-all.js --from /tmp/fsb-all-parsed.json
 *   node scripts/import-fsb-coverage-all.js --from /tmp/fsb-all-parsed.json --apply
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { createEvent, resolveSeriesGroupId } = require('../api/_lib/supabase-organiser-events');
const { deriveLocationFields, resolveRegionSlug, parseOutcode } = require('../api/_lib/uk-outcode');
const { geocodeUkPostcode } = require('../api/_lib/postcode-geocode');
const { eventImageDbValue } = require('../api/_lib/event-image');
const {
  CHECKOUT_LINK_OUT,
  normalizeExternalBookingUrl,
  normalizeExternalPriceLabel,
} = require('../api/_lib/connected-booking-util');

const APPLY = process.argv.includes('--apply');
const fromIdx = process.argv.indexOf('--from');
const FROM = fromIdx >= 0 ? process.argv[fromIdx + 1] : '/tmp/fsb-all-parsed.json';

const ORG = {
  greaterLondon: '0e57f4c3-2d9a-4fe6-add2-7e0f91a0040d',
  eastOfEngland: '27db9afc-a761-4e7a-a351-09cd713a3455',
  wales: '28c31e5d-8d74-42ff-bc36-eeaea0851144',
  scotland: '3ac0176b-b903-46df-9801-26bd702fc78b',
  northWest: 'fc6d66f6-7267-4a31-8b0c-257bb3c0673c',
  yorkshire: '57e873dc-96f4-4aa7-b0f0-29643045d4bf',
  brighton: '3d71a28a-62cc-4158-ac0f-00803b1f8abf',
  thamesValley: '50e88d9f-1372-4a66-b28b-eda952258300',
  northernIreland: '787ebc37-a34b-4dbe-a0a8-dddbbbe2d4d6',
  eastMidlands: 'f736a3ab-4534-4beb-a583-d4b1b13ef9ad',
  /** Catch-all national FSB page for regions without a dedicated Hub organiser */
  national: '2a5fdb5e-c494-47da-aa29-569cfeb22921',
};

const IMG = {
  cowork: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&auto=format&fit=crop',
  networking: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop',
  meeting: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop',
  online: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&auto=format&fit=crop',
  coast: 'https://images.unsplash.com/photo-1621349473076-bf700a533713?w=1200&auto=format&fit=crop',
  city: 'https://images.unsplash.com/photo-1715523535328-d534f33f93d3?w=1200&auto=format&fit=crop',
  glasgow: 'https://images.unsplash.com/photo-1621519604512-85ea63c15ca2?w=1200&auto=format&fit=crop',
  library: 'https://images.unsplash.com/photo-1771139576882-95890e299938?w=1200&auto=format&fit=crop',
};

/** Manual price overrides where the calendar card has no price prefix. */
const PRICE_OVERRIDES = {
  'fsb-connect-knutsford-with-colony-networking-nov-3aJ8PzVDV': 'Tickets available',
  'fsb-connect-network-altrincham-with-colony-networking-nov-3aJ8PzoMb': 'Tickets available',
  'fsb-connect-kent-with-property-powwow-3aJ8Pzp5l': 'Tickets available',
  'stepping-out-with-fsb-connect-gravesend-3aJ8Pzdvp': 'Tickets available',
  'fsb-connect-with-mid-sussex-momentum-burgess-hill-nov-3aJ8PzmZJ': 'Tickets available',
  'fsb-connect-with-mid-sussex-momentum-burgess-hill-dec-3aJ8Pzmav': 'Tickets available',
  'fsb-connect-lincolnshire-women-in-enterprise-forum-inspiring-others-dec-3aJ8PzOK5': 'Tickets available',
};

function mapOrganiser(title, venue, slug) {
  const t = `${title} ${venue} ${slug}`.toLowerCase();
  if (/northern.ireland|\bnireland\b|belfast|dungannon|junction/.test(t)) return ORG.northernIreland;
  if (/wales|cardiff|bangor|llandrillo|narberth|pembroke|coleg cambria|west wales|north wales/.test(t))
    return ORG.wales;
  if (
    /glasgow|edinburgh|scotland|glenrothes|ayrshire|moray|shetland|lanarkshire|fife|kirkcaldy|angus|dundee|rosyth|montrose/.test(
      t
    )
  )
    return ORG.scotland;
  if (
    /liverpool|preston|blackpool|chester|knutsford|altrincham|north.west|manchester|wrexham|colony networking - knutsford|colony networking - altrincham/.test(
      t
    )
  )
    return ORG.northWest;
  if (
    /yorkshire|barnsley|bradford|hartlepool|sunderland|sheffield|leeds|north.east|mosborough/.test(t)
  )
    return ORG.yorkshire;
  if (
    /st.albans|ipswich|essex|cambridge|fenland|bedford|attleborough|bury st|king.?s lynn|chelmsford|wisbech|cambourne|norwich|peterborough|hertford/.test(
      t
    )
  )
    return ORG.eastOfEngland;
  if (
    /brighton|eastbourne|hastings|fontwell|mid.sussex|burgess|southampton|reigate|canterbury|ashford|kent |gravesend|eastbourne|surrey networked|hogs.back|weybridge/.test(
      t
    )
  ) {
    if (/brighton|eastbourne|hastings|fontwell|mid.sussex|burgess|southampton/.test(t)) return ORG.brighton;
    if (/weybridge|hogs.back|reigate|surrey/.test(t)) return ORG.thamesValley;
    return ORG.national; // Kent / Gravesend etc.
  }
  if (/bracknell|reading|oxford|thames.valley|maidenhead|slough|high wycombe/.test(t))
    return ORG.thamesValley;
  if (
    /wimbledon|ealing|southwark|central.london|north.london|south.london|croydon|esher|peckham|lambeth|lewisham|finchley|british library|london/.test(
      t
    )
  )
    return ORG.greaterLondon;
  if (
    /east.midlands|nottingham|leicester|derby|lincoln|northampton|rugby|heart.of.england|coventry|online east midlands/.test(
      t
    )
  )
    return ORG.eastMidlands;
  if (/west.midlands|birmingham|shropshire|wolverhampton/.test(t)) return ORG.eastMidlands;
  if (/south.west|bristol|exeter|cornwall|dorset|hampshire|isle.of.wight|poole|salisbury|fontwell/.test(t))
    return ORG.national;
  return ORG.national;
}

function regionKeyForOrg(orgId) {
  const map = {
    [ORG.greaterLondon]: 'greater-london',
    [ORG.eastOfEngland]: 'east-of-england',
    [ORG.wales]: 'wales',
    [ORG.scotland]: 'scotland',
    [ORG.northWest]: 'north-west',
    [ORG.yorkshire]: 'yorkshire',
    [ORG.brighton]: 'brighton',
    [ORG.thamesValley]: 'thames-valley',
    [ORG.northernIreland]: 'northern-ireland',
    [ORG.eastMidlands]: 'east-midlands',
    [ORG.national]: 'national',
  };
  return map[orgId] || 'national';
}

function imageFor(spec) {
  if (spec.online) return IMG.online;
  const t = `${spec.title} ${spec.venue}`.toLowerCase();
  if (/brighton|marina|eastbourne|hastings|fontwell|blackpool|coast|harbour/.test(t)) return IMG.coast;
  if (/glasgow|edinburgh|scotland/.test(t)) return IMG.glasgow;
  if (/british library|central london/.test(t)) return IMG.library;
  if (/liverpool|chester|manchester/.test(t)) return IMG.city;
  if (/online/.test(t)) return IMG.online;
  if (/regus|co-space|pure offices|cowork|collective/.test(t)) return IMG.cowork;
  return IMG.networking;
}

function sourceId(orgId, slug, ymd) {
  const short = String(slug || 'event')
    .replace(/^fsb-connect-?/i, '')
    .replace(/-3aJ8P.+$/i, '')
    .slice(0, 48);
  return `fsb-coverage:${regionKeyForOrg(orgId)}:${short || 'event'}:${ymd}`;
}

async function enrichGeo(spec) {
  const derived = deriveLocationFields({
    venue: spec.venue || '',
    addressLine1: '',
    city: spec.online ? 'Online' : spec.city || '',
    postcode: spec.postcode || '',
  });
  const outcode = parseOutcode(spec.postcode) || null;
  let lat = null;
  let lng = null;
  let city = spec.online ? 'Online' : spec.city || derived.city || '';
  if (spec.postcode) {
    const geo = await geocodeUkPostcode(spec.postcode);
    if (geo) {
      if (geo.latitude != null) lat = geo.latitude;
      if (geo.longitude != null) lng = geo.longitude;
      if (!city && geo.city) city = geo.city;
    }
  }
  const location = derived.location || city || spec.venue || '';
  const regionSlug =
    resolveRegionSlug({ outcode, postcode: spec.postcode, city, location }) || null;
  return { city, outcode, lat, lng, location, regionSlug, venue: spec.venue || derived.venue || '' };
}

function guessCity(venue, title) {
  if (!venue) return '';
  // "Regus - Bracknell Arlington Square" / "Bells of Peover, Knutsford"
  const parts = venue.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].replace(/\s*United Kingdom$/i, '').trim();
    if (!/^[A-Z]{1,2}\d/i.test(last)) return last;
  }
  const m = venue.match(/\b(London|Glasgow|Edinburgh|Cardiff|Belfast|Manchester|Liverpool|Birmingham|Leeds|Sheffield|Bristol|Oxford|Reading|Bracknell|Croydon|Ipswich|Cambridge|Chester|Preston|Blackpool|Brighton|Eastbourne|Hastings|Coventry|Rugby|Narberth|Bangor|Mold|Kilmarnock|Glenrothes|Kirkcaldy|Montrose|Elgin|Sunderland|Hartlepool|Bradford|Dungannon|Knutsford|Altrincham|Canterbury|Reigate|Poole|Salisbury|Southampton|Fontwell|Cambourne|Wisbech|Chelmsford|Ealing|Wimbledon|Peckham|Southwark)\b/i);
  if (m) return m[1];
  return '';
}

async function loadExistingIndex(sb) {
  const { data, error } = await sb
    .from('events')
    .select('id,title,status,airtable_id,external_booking_url')
    .or('airtable_id.like.fsb-coverage:%,external_booking_url.ilike.%events.fsb.org.uk%');
  if (error) throw new Error(error.message);
  const bySlug = new Map();
  const bySource = new Map();
  for (const row of data || []) {
    if (row.airtable_id) bySource.set(String(row.airtable_id), row);
    const url = String(row.external_booking_url || '');
    const m = url.match(/\/([a-z0-9-]+)(?:\/overview)?$/i);
    if (m) bySlug.set(m[1].toLowerCase(), row);
  }
  return { bySlug, bySource, rows: data || [] };
}

async function publish(sb, raw, index) {
  const organiserId = mapOrganiser(raw.title, raw.venue, raw.slug);
  const ymd = String(raw.dateIso || '').slice(0, 10);
  const sid = sourceId(organiserId, raw.slug, ymd);
  const price =
    PRICE_OVERRIDES[raw.slug] ||
    normalizeExternalPriceLabel(raw.price || 'Tickets available') ||
    'Tickets available';
  const online = Boolean(raw.online);
  const city = online ? 'Online' : guessCity(raw.venue, raw.title);
  const imageUrl = imageFor({ ...raw, online });
  const bookingUrl = normalizeExternalBookingUrl(raw.href);
  const description = online
    ? `${raw.title}. Online FSB Connect networking for small businesses and the self-employed.\n\n${price === 'Free' ? 'Free' : price}. Book via FSB events.`
    : `${raw.title}${raw.venue ? ' at ' + raw.venue : ''}. FSB Connect networking for small businesses and the self-employed.\n\n${price === 'Free' ? 'Free' : price}. Book via FSB events.`;

  const existing =
    index.bySource.get(sid) ||
    index.bySlug.get(String(raw.slug || '').toLowerCase()) ||
    null;

  if (existing) {
    if (!APPLY) {
      console.log(`  · skip exists: ${raw.title.slice(0, 55)}`);
      return { status: 'skip' };
    }
    // Ensure published + Link Out (also resurrects earlier drafts)
    const patch = {
      checkout_mode: CHECKOUT_LINK_OUT,
      external_booking_url: bookingUrl,
      external_price_label: price,
      ticket_sales_enabled: true,
      airtable_id: sid,
      status: 'published',
      approval_status: 'Approved',
      image_url: eventImageDbValue(imageUrl),
      photo_url: null,
      description,
      starts_at: new Date(raw.dateIso).toISOString(),
      ends_at: new Date(raw.endIso || raw.dateIso).toISOString(),
    };
    await sb.from('events').update(patch).eq('id', existing.id);
    console.log(`  · refresh: ${raw.title.slice(0, 55)}`);
    return { status: 'refresh' };
  }

  if (!APPLY) {
    console.log(
      `  · would add [${regionKeyForOrg(organiserId)}] ${price} | ${ymd} | ${raw.title.slice(0, 50)}`
    );
    return { status: 'would' };
  }

  const spec = { venue: raw.venue || '', city, postcode: '', online };
  const geo = await enrichGeo(spec);
  const base = {
    title: raw.title.slice(0, 180),
    groupId: organiserId,
    type: 'Meeting',
    eventFormat: online ? 'Online' : 'In person',
    listingStatus: 'published',
    description,
    venue: raw.venue || '',
    addressLine1: '',
    city: geo.city || city || '',
    postcode: '',
    attendanceMode: 'tickets',
    date: raw.dateIso,
    endDate: raw.endIso || raw.dateIso,
    seriesGroupId: resolveSeriesGroupId(null, 1),
    photoUrl: imageUrl,
  };

  const ev = await createEvent(base);
  const patch = {
    city: geo.city || city || null,
    venue: raw.venue || null,
    location_label: geo.location || city || raw.venue || null,
    region_slug: geo.regionSlug,
    status: 'published',
    approval_status: 'Approved',
    airtable_id: sid,
    checkout_mode: CHECKOUT_LINK_OUT,
    external_booking_url: bookingUrl,
    external_price_label: price,
    ticket_sales_enabled: true,
    image_url: eventImageDbValue(imageUrl),
    photo_url: null,
  };
  if (geo.lat != null) patch.latitude = geo.lat;
  if (geo.lng != null) patch.longitude = geo.lng;
  await sb.from('events').update(patch).eq('id', ev.id);
  index.bySlug.set(String(raw.slug || '').toLowerCase(), ev);
  index.bySource.set(sid, ev);
  console.log(`  · published: ${raw.title.slice(0, 55)}`);
  return { status: 'new' };
}

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Missing Supabase env');
    process.exit(1);
  }
  if (!fs.existsSync(FROM)) {
    console.error('Missing calendar dump:', FROM);
    process.exit(1);
  }
  const dump = JSON.parse(fs.readFileSync(FROM, 'utf8'));
  const list = (dump.active || dump.missing || []).filter((r) => r && !r.cancelled);
  console.log(APPLY ? 'APPLY mode' : 'DRY-RUN');
  console.log(`Processing ${list.length} FSB Connect events from ${FROM}`);

  const sb = getSupabaseAdmin();
  const index = await loadExistingIndex(sb);
  console.log(`Existing Hub FSB-linked events indexed: ${index.rows.length}`);

  const counts = { new: 0, refresh: 0, skip: 0, would: 0, err: 0 };
  for (const raw of list) {
    try {
      const res = await publish(sb, raw, index);
      counts[res.status] = (counts[res.status] || 0) + 1;
    } catch (e) {
      counts.err += 1;
      console.warn('  · ERROR', raw.title, e.message || e);
    }
  }
  console.log('\nSummary', counts);

  if (APPLY) {
    const { count } = await sb
      .from('events')
      .select('id', { count: 'exact', head: true })
      .like('airtable_id', 'fsb-coverage:%')
      .eq('status', 'published')
      .gte('starts_at', '2026-10-28');
    console.log('Published fsb-coverage from now:', count);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
