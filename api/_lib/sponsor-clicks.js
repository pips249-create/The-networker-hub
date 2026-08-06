/**
 * Record + report first-party sponsor / partner outbound clicks.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');

const MAX_PLACEMENT = 64;
const MAX_COMPANY = 120;
const MAX_URL = 500;
const MAX_PATH = 200;
const REPORT_ROW_CAP = 10000;

function cleanText(raw, max) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

function normalizePlacement(raw) {
  return (
    cleanText(raw, MAX_PLACEMENT)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, MAX_PLACEMENT) || 'sponsor'
  );
}

function sanitizeDestinationUrl(raw) {
  const url = cleanText(raw, MAX_URL);
  if (!/^https?:\/\//i.test(url)) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString().slice(0, MAX_URL);
  } catch {
    return '';
  }
}

function sanitizePath(raw) {
  const p = cleanText(raw, MAX_PATH);
  if (!p) return '';
  if (p.startsWith('/')) return p;
  try {
    return new URL(p, 'https://thenetworkerhub.com').pathname.slice(0, MAX_PATH);
  } catch {
    return '';
  }
}

/**
 * Shape a safe insert from a public POST body.
 */
function sanitizeSponsorClickPayload(body) {
  const input = body && typeof body === 'object' ? body : {};
  const placement = normalizePlacement(input.placement || input.slot);
  const companyName = cleanText(input.company || input.companyName || input.brand || '', MAX_COMPANY);
  const destinationUrl = sanitizeDestinationUrl(input.url || input.destinationUrl || input.href);
  const path = sanitizePath(input.path || '');

  if (!placement && !companyName && !destinationUrl) {
    return { ok: false, error: 'no_signal', message: 'Missing placement or destination.' };
  }

  return {
    ok: true,
    row: {
      placement,
      company_name: companyName,
      destination_url: destinationUrl,
      path,
    },
  };
}

async function recordSponsorClick(body) {
  if (!isSupabaseConfigured()) {
    return { ok: true, configured: false, skipped: true };
  }

  const sanitized = sanitizeSponsorClickPayload(body);
  if (!sanitized.ok) return sanitized;

  const sb = getSupabaseAdmin();
  const { error } = await sb.from('sponsor_clicks').insert(sanitized.row);
  if (error) {
    if (/sponsor_clicks/i.test(error.message || '')) {
      const err = new Error('sponsor_clicks_table_missing');
      err.code = 'sponsor_clicks_table_missing';
      throw err;
    }
    throw new Error(error.message);
  }
  return { ok: true };
}

function parseDateBound(raw, endOfDay) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return endOfDay ? s + 'T23:59:59.999Z' : s + 'T00:00:00.000Z';
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function defaultMonthBounds() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const from = new Date(Date.UTC(y, m, 1)).toISOString();
  const to = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)).toISOString();
  return { from, to };
}

function countBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row) || '(blank)';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function getSponsorClicksReport(query) {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'supabase_not_configured' };
  }

  const q = query && typeof query === 'object' ? query : {};
  const defaults = defaultMonthBounds();
  const from = parseDateBound(q.from, false) || defaults.from;
  const to = parseDateBound(q.to, true) || defaults.to;
  const companyFilter = cleanText(q.company || q.brand || '', MAX_COMPANY);
  const placementFilter = q.placement ? normalizePlacement(q.placement) : '';

  const sb = getSupabaseAdmin();
  let req = sb
    .from('sponsor_clicks')
    .select('id, created_at, placement, company_name, destination_url, path')
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false })
    .limit(REPORT_ROW_CAP);

  if (companyFilter) {
    req = req.ilike('company_name', '%' + companyFilter.replace(/%/g, '') + '%');
  }
  if (placementFilter) {
    req = req.eq('placement', placementFilter);
  }

  const { data, error } = await req;
  if (error) {
    if (/sponsor_clicks/i.test(error.message || '')) {
      const err = new Error('sponsor_clicks_table_missing');
      err.code = 'sponsor_clicks_table_missing';
      throw err;
    }
    throw new Error(error.message);
  }

  const rows = data || [];
  const byPlacement = countBy(rows, (r) => r.placement).map((r) => ({
    placement: r.key,
    count: r.count,
  }));
  const byCompany = countBy(rows, (r) => r.company_name).map((r) => ({
    company: r.key,
    count: r.count,
  }));
  const byDay = countBy(rows, (r) => String(r.created_at || '').slice(0, 10))
    .map((r) => ({ day: r.key, count: r.count }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return {
    ok: true,
    configured: true,
    from,
    to,
    total: rows.length,
    truncated: rows.length >= REPORT_ROW_CAP,
    byPlacement,
    byCompany,
    byDay,
    recent: rows.slice(0, 75).map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      placement: r.placement,
      company: r.company_name,
      url: r.destination_url,
      path: r.path,
    })),
  };
}

module.exports = {
  recordSponsorClick,
  getSponsorClicksReport,
  sanitizeSponsorClickPayload,
  defaultMonthBounds,
};
