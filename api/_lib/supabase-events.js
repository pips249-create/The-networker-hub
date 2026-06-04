/**
 * Public events API — Supabase (replaces Airtable read path when DATA_PROVIDER=supabase).
 */
const { getSupabaseAdmin, isSupabaseConfigured, supabaseConfig } = require('./supabase');

function parsePriceNum(raw) {
  if (raw == null || raw === '') return 0;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function normalizePrice(priceNum) {
  if (!priceNum || priceNum <= 0) return { display: 'Free', priceKey: 'free' };
  return { display: `£${priceNum.toFixed(2)}`, priceKey: 'paid' };
}

function parseTypeCategory(raw) {
  const s = String(raw || 'meeting').toLowerCase();
  if (s.includes('exhibit')) return 'exhibition';
  if (s.includes('conference')) return 'conference';
  if (s.includes('network') || s.includes('meeting')) return 'meeting';
  return 'meeting';
}

function slugifyType(raw) {
  const cat = parseTypeCategory(raw);
  if (cat === 'exhibition' || cat === 'conference') return 'exhibition';
  return 'meeting';
}

function slugLocation(loc) {
  return String(loc || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function slugIndustry(ind) {
  return String(ind || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function slugFormat(fmt) {
  return String(fmt || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function ukOutcode(postcode) {
  const m = String(postcode || '')
    .trim()
    .toUpperCase()
    .match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/);
  return m ? m[1] : '';
}

function formatDateParts(startsAt) {
  if (!startsAt) return { iso: '', ts: null, display: '', short: '' };
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return { iso: '', ts: null, display: '', short: '' };
  const iso = d.toISOString();
  const display = d.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const short = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return { iso, ts: d.getTime(), display, short };
}

function buildDateLine(location, parsedDate, time) {
  const parts = [parsedDate.short, time, location].filter(Boolean);
  return parts.join(' · ');
}

function ticketRowToTier(row, eventDefaults) {
  const priceNum = parsePriceNum(row.price);
  const { display: price, priceKey } = normalizePrice(priceNum);
  const qty = row.quantity != null ? Math.max(0, Number(row.quantity)) : null;
  const soldOut =
    row.status === 'Sold out' || (qty !== null && !Number.isFinite(qty) ? false : qty <= 0);
  const name = String(row.name || 'Ticket').trim();
  return {
    id: row.id,
    name,
    description: String(row.description || '').trim(),
    price,
    priceKey,
    priceNum,
    soldOut,
    quantityAvailable: qty,
    label: name.slice(0, 48) || 'Ticket',
  };
}

function fallbackTicketTier(event) {
  return {
    id: event.id + '-standard',
    name: 'Standard ticket',
    description: event.priceKey === 'free' ? 'Free admission' : 'Ticket includes full event access',
    price: event.price,
    priceKey: event.priceKey,
    priceNum: event.priceNum,
    soldOut: Boolean(event.isSoldOut),
    quantityAvailable: event.spotsLeft,
    label: 'Standard',
  };
}

function rowToEvent(row, organiser, ticketRows) {
  const title = String(row.title || '').trim();
  let descText = String(row.description || '').trim();
  if (!descText && Array.isArray(row.highlights)) {
    descText = row.highlights.join('\n');
  }
  const typeRaw = row.event_type || 'Networking / Meeting';
  const typeCategory = parseTypeCategory(typeRaw);
  const type = slugifyType(typeRaw);
  const format = String(row.meeting_type || '').trim();
  const location = String(row.location_label || row.city || row.venue || '').trim();
  const postcode = String(row.postcode || '').trim();
  const venue = String(row.venue || '').trim();
  const industry = Array.isArray(row.industries) ? row.industries[0] || '' : '';
  const parsedDate = formatDateParts(row.starts_at);
  const time = parsedDate.display.includes(',')
    ? parsedDate.display.split(',').pop().trim()
    : '';

  const tiers = (ticketRows || [])
    .filter((t) => t.event_id === row.id)
    .map((t) => ticketRowToTier(t, {}));
  tiers.sort((a, b) => {
    if (a.soldOut !== b.soldOut) return a.soldOut ? 1 : -1;
    return a.priceNum - b.priceNum;
  });

  let priceNum = tiers.length ? Math.min(...tiers.map((t) => t.priceNum).filter((n) => n >= 0)) : 0;
  if (!tiers.length) priceNum = 0;
  const { display: price, priceKey } = normalizePrice(priceNum);

  const orgName = organiser ? String(organiser.name || '').trim() : '';
  const spotsLeft = null;
  const isSoldOut = tiers.length > 0 && tiers.every((t) => t.soldOut);

  const ev = {
    id: row.id,
    title,
    description: descText,
    date: parsedDate.display,
    dateRaw: parsedDate.iso,
    dateTs: parsedDate.ts,
    dateFieldRaw: row.starts_at ? String(row.starts_at) : '',
    time,
    location,
    postcode,
    outcode: ukOutcode(postcode),
    venue,
    venueName: venue,
    venueAddress: [row.address, postcode].filter(Boolean).join(', ') || location,
    organiserId: row.organiser_id || (organiser && organiser.id) || '',
    organiserLogo: organiser ? String(organiser.photo_url || '') : '',
    organiserProfile: organiser ? String(organiser.description || '') : '',
    industry: String(industry),
    format,
    type,
    typeRaw: String(typeRaw),
    typeSlug: type,
    typeCategory,
    lat: row.latitude != null ? Number(row.latitude) : null,
    lng: row.longitude != null ? Number(row.longitude) : null,
    featured: Boolean(row.featured),
    price,
    priceKey,
    priceNum,
    photo: String(row.photo_url || ''),
    organiser: orgName,
    rating: Number(row.average_rating) || 0,
    reviews: Number(row.review_count) || 0,
    isApprovalRequired: row.auto_approve === false,
    isSoldOut,
    isSalesClosed: false,
    spotsLeft,
    capacity: null,
    urgency: '',
    dateLine: buildDateLine(location, parsedDate, time),
    meetingType: format || typeRaw,
    search: [title, descText, location, postcode, industry, orgName, typeRaw, format]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    listingStatusRaw: row.approval_status || 'Approved',
    organiserListingStatusRaw: organiser ? organiser.listing_status || '' : '',
    locationSlug: slugLocation(location),
    industrySlug: slugIndustry(industry),
    formatSlug: slugFormat(format),
    tickets: tiers.length ? tiers : [],
  };

  if (!ev.tickets.length) ev.tickets = [fallbackTicketTier(ev)];
  return ev;
}

function isPublicEvent(row, organiser) {
  if (row.approval_status !== 'Approved') return false;
  if (organiser && organiser.listing_status === 'draft') return false;
  if (organiser && organiser.listing_status === 'unpublished') return false;
  return true;
}

function organiserMatch(a, b) {
  if (!a.organiserId || !b.organiserId) return a.organiser === b.organiser && a.organiser;
  return a.organiserId === b.organiserId;
}

async function fetchApprovedEvents(sb) {
  const { data: events, error: evErr } = await sb
    .from('events')
    .select('*')
    .eq('approval_status', 'Approved')
    .order('starts_at', { ascending: true });
  if (evErr) throw new Error(evErr.message);

  const eventIds = (events || []).map((e) => e.id);
  const orgIds = [...new Set((events || []).map((e) => e.organiser_id).filter(Boolean))];

  let tickets = [];
  if (eventIds.length) {
    const { data: tix, error: tixErr } = await sb.from('tickets').select('*').in('event_id', eventIds);
    if (tixErr) throw new Error(tixErr.message);
    tickets = tix || [];
  }

  let organisers = [];
  if (orgIds.length) {
    const { data: orgs, error: orgErr } = await sb.from('organisers').select('*').in('id', orgIds);
    if (orgErr) throw new Error(orgErr.message);
    organisers = orgs || [];
  }

  const orgById = new Map(organisers.map((o) => [o.id, o]));
  return (events || [])
    .map((row) => {
      const org = row.organiser_id ? orgById.get(row.organiser_id) : null;
      if (!isPublicEvent(row, org)) return null;
      return rowToEvent(row, org, tickets);
    })
    .filter(Boolean);
}

async function handle(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=60');

  const cfg = supabaseConfig();
  if (!isSupabaseConfigured()) {
    return res.status(200).json({
      configured: false,
      provider: 'supabase',
      message:
        'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, set DATA_PROVIDER=supabase, then Redeploy.',
      events: [],
      envCheck: {
        hasSupabaseUrl: Boolean(cfg.url),
        hasSupabaseServiceKey: Boolean(cfg.serviceKey),
      },
    });
  }

  try {
    const sb = getSupabaseAdmin();
    const recordId = req.query?.id;

    if (recordId) {
      const { data: row, error } = await sb.from('events').select('*').eq('id', recordId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!row || row.approval_status !== 'Approved') {
        return res.status(404).json({
          configured: true,
          provider: 'supabase',
          error: 'not_found',
          message: 'This event is not published.',
          event: null,
        });
      }

      let organiser = null;
      if (row.organiser_id) {
        const { data: org } = await sb.from('organisers').select('*').eq('id', row.organiser_id).maybeSingle();
        organiser = org;
        if (organiser && !isPublicEvent(row, organiser)) {
          return res.status(404).json({
            configured: true,
            provider: 'supabase',
            error: 'not_found',
            event: null,
          });
        }
      }

      const { data: tickets } = await sb.from('tickets').select('*').eq('event_id', recordId);
      const event = rowToEvent(row, organiser, tickets || []);
      const all = await fetchApprovedEvents(sb);
      const related = all.filter((e) => e.id !== event.id && organiserMatch(e, event)).slice(0, 6);
      return res.status(200).json({ configured: true, provider: 'supabase', event, related });
    }

    const events = await fetchApprovedEvents(sb);
    return res.status(200).json({ configured: true, provider: 'supabase', events });
  } catch (e) {
    return res.status(500).json({
      configured: true,
      provider: 'supabase',
      error: 'server_error',
      message: e.message,
      events: [],
    });
  }
}

module.exports = { handle, rowToEvent, fetchApprovedEvents };
