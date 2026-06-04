/**
 * Vercel serverless: proxy Airtable Events table (keeps API key server-side).
 *
 * Env (Vercel → Settings → Environment Variables):
 *   AIRTABLE_API_KEY
 *   AIRTABLE_BASE_ID
 *   AIRTABLE_EVENTS_TABLE  (default: Events)
 */

const FIELD_MAP = {
  title: ['Title', 'Name', 'Event Title'],
  description: ['Description', 'Short Description', 'Summary'],
  date: ['Date', 'Event Date', 'Start Date'],
  time: ['Time', 'Start Time'],
  price: ['Price', 'Ticket Price'],
  location: ['Location', 'City', 'Venue'],
  industry: ['Industry'],
  format: ['Meeting Format', 'Format'],
  type: ['Type', 'Event Type'],
  featured: ['Featured', 'Premium', 'Premium Spotlight'],
  photo: ['Photo', 'Image', 'Cover', 'Photos', 'Picture', 'Event Photo', 'Event Image'],
  organiser: ['Organiser', 'Host', 'Organizer'],
  rating: ['Rating', 'Average Rating', 'Stars'],
  reviews: ['Reviews', 'Review Count', 'Number of Reviews'],
};

function pick(fields, keys) {
  for (const key of keys) {
    if (fields[key] !== undefined && fields[key] !== null && fields[key] !== '') {
      return fields[key];
    }
  }
  return null;
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

function slugifyType(raw) {
  const s = String(raw || 'meeting').toLowerCase();
  if (s.includes('exhibit') || s.includes('conference')) return 'exhibition';
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

function formatDate(isoOrStr) {
  if (!isoOrStr) return '';
  const d = new Date(isoOrStr);
  if (Number.isNaN(d.getTime())) return String(isoOrStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateShort(isoOrStr) {
  if (!isoOrStr) return '';
  const d = new Date(isoOrStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
}

function parsePriceNum(raw) {
  if (raw === null || raw === undefined || raw === '') return 0;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function buildDateLine(location, dateRaw, time) {
  const parts = [];
  if (location) parts.push(String(location));
  const short = formatDateShort(dateRaw);
  if (short) parts.push(short);
  if (time) {
    const t = String(time).trim();
    parts.push(t.length <= 5 ? t : t.slice(0, 5));
  }
  return parts.join(' · ') || 'Date TBC';
}

function recordToEvent(record) {
  const f = record.fields || {};
  const title = pick(f, FIELD_MAP.title) || 'Untitled event';
  const description = pick(f, FIELD_MAP.description) || '';
  const dateRaw = pick(f, FIELD_MAP.date);
  const time = pick(f, FIELD_MAP.time) || '';
  const location = pick(f, FIELD_MAP.location) || '';
  const industry = pick(f, FIELD_MAP.industry) || '';
  const format = pick(f, FIELD_MAP.format) || '';
  const type = slugifyType(pick(f, FIELD_MAP.type));
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

  const search = [title, description, location, industry, organiser, type]
    .join(' ')
    .toLowerCase();

  return {
    id: record.id,
    title,
    description,
    date: formatDate(dateRaw),
    dateRaw: dateRaw || '',
    time: String(time),
    location,
    industry,
    format,
    type,
    featured,
    price: priceDisplay,
    priceKey,
    priceNum,
    photo,
    organiser,
    rating: Number.isFinite(rating) ? rating : 4,
    reviews: Number.isFinite(reviews) ? reviews : 0,
    dateLine: buildDateLine(location, dateRaw, time),
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

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
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
        return res.status(resp.status).json({
          configured: true,
          error: 'airtable_error',
          detail: err,
          events: [],
        });
      }
      const data = await resp.json();
      all.push(...(data.records || []));
      offset = data.offset;
    } while (offset);

    const events = all.map(recordToEvent);
    return res.status(200).json({ configured: true, events });
  } catch (e) {
    return res.status(500).json({
      configured: true,
      error: 'server_error',
      message: e.message,
      events: [],
    });
  }
};
