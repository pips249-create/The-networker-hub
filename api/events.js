/**
 * Vercel serverless: proxy Airtable Events table (keeps API key server-side).
 *
 * Env (Vercel → Settings → Environment Variables):
 *   AIRTABLE_API_KEY
 *   AIRTABLE_BASE_ID
 *   AIRTABLE_EVENTS_TABLE  (default: Events)
 */

const { cleanEnvVal, parseAirtableError } = require('./lib/auth');

const FIELD_MAP = {
  title: ['Title', 'Name', 'Event Title'],
  description: ['Description', 'Short Description', 'Summary'],
  date: [
    'Date',
    'Event Date',
    'Start Date',
    'Start',
    'When',
    'Event Start',
    'Meeting Date',
    'Event date',
    'Start date',
    'Date of event',
    'Event Date & Time',
    'Start Date/Time',
    'Date/Time',
    'Day',
  ],
  time: ['Time', 'Start Time', 'Event Time', 'Start time', 'From'],
  price: ['Price', 'Ticket Price'],
  location: ['Location', 'City', 'Venue'],
  postcode: ['Postcode', 'Postal Code', 'ZIP', 'Zip Code'],
  venue: ['Venue', 'Venue Name', 'Address'],
  industry: ['Industry'],
  format: ['Meeting Format', 'Format'],
  type: ['Type', 'Event Type', 'Meeting Type'],
  latitude: ['Latitude', 'Lat'],
  longitude: ['Longitude', 'Lng', 'Long'],
  featured: ['Featured', 'Premium', 'Premium Spotlight'],
  photo: ['Photo', 'Image', 'Cover', 'Photos', 'Picture', 'Event Photo', 'Event Image'],
  organiser: ['Organiser', 'Host', 'Organizer'],
  rating: ['Rating', 'Average Rating', 'Stars'],
  reviews: ['Reviews', 'Review Count', 'Number of Reviews'],
};

function getFieldCI(fields, name) {
  if (!fields || !name) return undefined;
  if (fields[name] !== undefined) return fields[name];
  const lower = String(name).toLowerCase();
  const key = fieldKeys(fields).find((k) => k.toLowerCase() === lower);
  return key !== undefined ? fields[key] : undefined;
}

function pick(fields, keys) {
  for (const key of keys) {
    const v = getFieldCI(fields, key);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

function fieldKeys(fields) {
  return Object.keys(fields || {});
}

/** Match Airtable columns when names differ from our defaults (e.g. "Event date", "Start date/time"). */
function discoverField(fields, aliases, options = {}) {
  const hit = pick(fields, aliases);
  if (hit !== null && hit !== undefined && hit !== '') return hit;

  const namePattern = options.namePattern || /./;
  const excludePattern =
    options.excludePattern ||
    /created|modified|updated|expir|token|password|hash|sold|review|rating|count/i;

  for (const key of fieldKeys(fields)) {
    if (excludePattern.test(key)) continue;
    if (!namePattern.test(key)) continue;
    const v = fields[key];
    if (v !== undefined && v !== null && v !== '') return v;
  }

  if (options.valueTest) {
    for (const key of fieldKeys(fields)) {
      if (excludePattern.test(key)) continue;
      const v = fields[key];
      if (options.valueTest(v)) return v;
    }
  }

  return null;
}

function looksLikeDateValue(v) {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'object') {
    if (v.iso) return true;
    if (Array.isArray(v) && v[0]) return looksLikeDateValue(v[0]);
    return false;
  }
  const s = String(v).trim();
  if (s.length < 6) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
  if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(s)) return true;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

function discoverDateField(fields) {
  return discoverField(
    fields,
    FIELD_MAP.date,
    {
      namePattern: /date|when|start|begins?|scheduled|held\s*on|event\s*day/i,
      excludePattern:
        /created|modified|updated|expir|token|end\s*date|closing|deadline|sold|review|rating/i,
      valueTest: looksLikeDateValue,
    }
  );
}

function discoverTimeField(fields) {
  return discoverField(fields, FIELD_MAP.time, {
    namePattern: /time|start\s*time|from|doors/i,
    excludePattern: /created|modified|updated|expir|token|date|sold|review/i,
  });
}

function attachmentUrl(field) {
  if (!field) return null;
  if (Array.isArray(field) && field[0]) {
    const file = field[0];
    return (
      file.thumbnails?.large?.url ||
      file.thumbnails?.full?.url ||
      file.url ||
      null
    );
  }
  if (typeof field === 'string' && field.startsWith('http')) return field;
  return null;
}

function typeSlugFromRaw(raw) {
  return (
    String(raw || 'meeting')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'meeting'
  );
}

function parseTypeCategory(raw) {
  const s = String(raw || 'meeting').toLowerCase();
  if (s.includes('award')) return 'awards';
  if (s.includes('exhibit')) return 'exhibition';
  if (s.includes('conference')) return 'conference';
  if (s.includes('meeting') || s.includes('network') || s.includes('mixer')) return 'meeting';
  return 'meeting';
}

/** Legacy bucket for tabs: meeting vs exhibition */
function slugifyType(raw) {
  const cat = parseTypeCategory(raw);
  if (cat === 'exhibition' || cat === 'conference') return 'exhibition';
  return 'meeting';
}

function normalizePrice(raw) {
  if (raw === null || raw === undefined || raw === '') return { display: 'Free', priceKey: 'free' };
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!n || String(raw).toLowerCase().includes('free')) {
    return { display: 'Free', priceKey: 'free' };
  }
  const num = Number.isFinite(n) ? n : parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  if (!num) return { display: String(raw), priceKey: 'paid' };
  return { display: `£${num % 1 === 0 ? num.toFixed(0) : num.toFixed(2)}`, priceKey: 'paid' };
}

function slugLocation(loc) {
  if (!loc) return '';
  const s = String(loc).toLowerCase();
  if (s.includes('online')) return 'online';
  const cities = ['london', 'manchester', 'birmingham', 'cambridge', 'leeds', 'bristol', 'edinburgh'];
  for (const c of cities) {
    if (s.includes(c)) return c;
  }
  return s.replace(/[^a-z0-9]+/g, '-').slice(0, 40);
}

function slugIndustry(ind) {
  if (!ind) return '';
  return String(ind).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
}

function slugFormat(fmt) {
  if (!fmt) return '';
  const s = String(fmt).toLowerCase();
  if (s.includes('online') && !s.includes('person')) return 'online';
  if (s.includes('hybrid')) return 'hybrid';
  if (s.includes('person') || s.includes('in-person')) return 'in-person';
  return s.replace(/[^a-z0-9]+/g, '-').slice(0, 20);
}

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

function extractUkPostcode(...parts) {
  for (const part of parts) {
    if (!part) continue;
    const m = String(part).match(UK_POSTCODE_RE);
    if (m) return m[1].replace(/\s+/g, ' ').trim().toUpperCase();
  }
  return '';
}

/** Outcode sector for fast listing filter (e.g. M1, SW1A → SW1). */
function parseOutcode(raw) {
  if (!raw) return '';
  const compact = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  const m = compact.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/);
  return m ? m[1] : '';
}

/** Parse Airtable date values (ISO, US, UK, locale strings). */
function parseAirtableDate(raw) {
  if (raw === null || raw === undefined || raw === '') {
    return { iso: '', ts: null, display: '', short: '' };
  }

  if (typeof raw === 'object' && raw !== null) {
    if (raw.iso) return parseAirtableDate(raw.iso);
    if (Array.isArray(raw) && raw[0]) return parseAirtableDate(raw[0]);
  }

  const s = String(raw).trim();

  const uk = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (uk) {
    let d = parseInt(uk[1], 10);
    let m = parseInt(uk[2], 10) - 1;
    let y = parseInt(uk[3], 10);
    if (y < 100) y += 2000;
    if (d > 12 && m < 12) {
      /* likely DD/MM/YYYY */
    } else if (d <= 12 && m + 1 > 12) {
      const tmp = d;
      d = m + 1;
      m = tmp - 1;
    }
    const dt = new Date(y, m, d, 12, 0, 0, 0);
    if (!Number.isNaN(dt.getTime())) {
      return packDate(dt, s);
    }
  }

  const isoDay = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDay) {
    const dt = new Date(
      parseInt(isoDay[1], 10),
      parseInt(isoDay[2], 10) - 1,
      parseInt(isoDay[3], 10),
      12,
      0,
      0,
      0
    );
    if (!Number.isNaN(dt.getTime())) return packDate(dt, s);
  }

  const isoDateTime = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (isoDateTime) {
    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) return packDate(dt, s);
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return packDate(d, s);

  return { iso: '', ts: null, display: s, short: s };
}

function packDate(dt, fallback) {
  const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return {
    iso,
    ts: dt.getTime(),
    display: dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    short: dt.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }),
    raw: fallback,
  };
}

function formatDate(isoOrStr) {
  const p = parseAirtableDate(isoOrStr);
  return p.display || (isoOrStr ? String(isoOrStr) : '');
}

function formatDateShort(isoOrStr) {
  const p = parseAirtableDate(isoOrStr);
  return p.short || '';
}

function parsePriceNum(raw) {
  if (raw === null || raw === undefined || raw === '') return 0;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function buildDateLine(location, parsedDate, time) {
  const parts = [];
  if (location) parts.push(String(location));
  if (parsedDate && parsedDate.short) {
    parts.push(parsedDate.short);
  } else if (parsedDate && parsedDate.display) {
    parts.push(parsedDate.display);
  }
  if (time) {
    const t = String(time).trim();
    const timeOnly = t.match(/(\d{1,2}:\d{2})/);
    parts.push(timeOnly ? timeOnly[1] : t.length <= 8 ? t : t.slice(0, 5));
  }
  return parts.join(' · ') || 'Date TBC';
}

function recordToEvent(record) {
  const f = record.fields || {};
  const title = pick(f, FIELD_MAP.title) || 'Untitled event';
  const description = pick(f, FIELD_MAP.description) || '';
  const dateField = discoverDateField(f);
  const parsedDate = parseAirtableDate(dateField);
  let time = discoverTimeField(f) || '';
  if (!time && dateField && String(dateField).includes('T')) {
    const tm = String(dateField).match(/T(\d{2}:\d{2})/);
    if (tm) time = tm[1];
  }
  const location = pick(f, FIELD_MAP.location) || '';
  const venue = pick(f, FIELD_MAP.venue) || '';
  let postcode = pick(f, FIELD_MAP.postcode) || '';
  if (!postcode) postcode = extractUkPostcode(location, venue);
  const outcode = parseOutcode(postcode) || parseOutcode(location) || parseOutcode(venue);
  const industry = pick(f, FIELD_MAP.industry) || '';
  const format = pick(f, FIELD_MAP.format) || '';
  const typeRaw = pick(f, FIELD_MAP.type) || 'meeting';
  const typeSlug = typeSlugFromRaw(typeRaw);
  const typeCategory = parseTypeCategory(typeRaw);
  const type = slugifyType(typeRaw);
  const latRaw = pick(f, FIELD_MAP.latitude);
  const lngRaw = pick(f, FIELD_MAP.longitude);
  const lat = latRaw != null && latRaw !== '' ? Number(latRaw) : null;
  const lng = lngRaw != null && lngRaw !== '' ? Number(lngRaw) : null;
  const featuredVal = pick(f, FIELD_MAP.featured);
  const featured =
    featuredVal === true ||
    featuredVal === 'Yes' ||
    featuredVal === 'yes' ||
    String(featuredVal).toLowerCase() === 'true' ||
    String(featuredVal).toLowerCase() === 'premium';
  const priceRaw = pick(f, FIELD_MAP.price);
  const { display: priceDisplay, priceKey } = normalizePrice(priceRaw);
  const priceNum = parsePriceNum(priceRaw);
  const photo = attachmentUrl(pick(f, FIELD_MAP.photo));
  const organiser = pick(f, FIELD_MAP.organiser) || '';
  const ratingRaw = pick(f, FIELD_MAP.rating);
  const reviewsRaw = pick(f, FIELD_MAP.reviews);
  const rating = ratingRaw != null && ratingRaw !== '' ? Number(ratingRaw) : 4;
  const reviews = reviewsRaw != null && reviewsRaw !== '' ? Number(reviewsRaw) : 0;

  const search = [
    title,
    description,
    location,
    postcode,
    venue,
    industry,
    organiser,
    typeRaw,
    format,
    typeCategory,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return {
    id: record.id,
    title,
    description,
    date: parsedDate.display || formatDate(dateField),
    dateRaw: parsedDate.iso || (dateField ? String(dateField) : ''),
    dateTs: parsedDate.ts,
    dateFieldRaw: dateField ? String(dateField) : '',
    time: String(time),
    location,
    postcode: String(postcode),
    outcode,
    venue: String(venue),
    industry,
    format,
    type,
    typeRaw: String(typeRaw),
    typeSlug,
    typeCategory,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    featured,
    price: priceDisplay,
    priceKey,
    priceNum,
    photo,
    organiser,
    rating: Number.isFinite(rating) ? rating : 4,
    reviews: Number.isFinite(reviews) ? reviews : 0,
    dateLine: buildDateLine(location, parsedDate, time),
    search,
    locationSlug: slugLocation(location),
    industrySlug: slugIndustry(industry),
    formatSlug: slugFormat(format),
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = cleanEnvVal(process.env.AIRTABLE_API_KEY);
  const baseId = cleanEnvVal(process.env.AIRTABLE_BASE_ID);
  const table = process.env.AIRTABLE_EVENTS_TABLE || 'Events';

  if (!apiKey || !baseId) {
    return res.status(200).json({
      configured: false,
      message:
        'Add AIRTABLE_API_KEY and AIRTABLE_BASE_ID in Vercel → Settings → Environment Variables, then Redeploy.',
      events: [],
      envCheck: {
        hasApiKey: Boolean(apiKey),
        hasBaseId: Boolean(baseId),
        table: table,
      },
      hint: 'After saving variables, open Deployments → ⋯ → Redeploy. Names must match exactly.',
    });
  }

  try {
    const baseUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;
    const recordId = req.query?.id;

    if (recordId) {
      const resp = await fetch(`${baseUrl}/${encodeURIComponent(recordId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!resp.ok) {
        const err = await resp.text();
        return res.status(resp.status).json({
          configured: true,
          error: 'airtable_error',
          detail: err,
          event: null,
        });
      }
      const data = await resp.json();
      return res.status(200).json({ configured: true, event: recordToEvent(data) });
    }

    const view = process.env.AIRTABLE_EVENTS_VIEW;
    const all = [];
    let offset;

    do {
      const q = new URLSearchParams({ pageSize: '100' });
      if (view) q.set('view', view);
      if (offset) q.set('offset', offset);
      const resp = await fetch(`${baseUrl}?${q}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!resp.ok) {
        const err = await resp.text();
        const parsed = parseAirtableError(err);
        return res.status(resp.status).json({
          configured: true,
          error: 'airtable_error',
          airtableType: parsed?.type,
          message:
            parsed?.type === 'AUTHENTICATION_REQUIRED'
              ? 'Airtable rejected your API key. In Vercel, update AIRTABLE_API_KEY with a new pat… token (no quotes), then Redeploy.'
              : parsed?.message || 'Airtable request failed',
          detail: err,
          events: [],
        });
      }
      const data = await resp.json();
      all.push(...(data.records || []));
      offset = data.offset;
    } while (offset);

    const events = all.map(recordToEvent);
    const payload = { configured: true, events };
    if (req.query?.fields === '1' && all[0]) {
      payload.airtableFieldNames = fieldKeys(all[0].fields || {});
    }
    return res.status(200).json(payload);
  } catch (e) {
    return res.status(500).json({
      configured: true,
      error: 'server_error',
      message: e.message,
      events: [],
    });
  }
};
