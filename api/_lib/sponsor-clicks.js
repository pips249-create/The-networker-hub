/**
 * First-party sponsor performance metrics — clicks, page impressions, email logo sends.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');

const MAX_PLACEMENT = 64;
const MAX_COMPANY = 120;
const MAX_URL = 500;
const MAX_PATH = 200;
const MAX_SLUG = 80;
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

function utcDayString(d) {
  const dt = d instanceof Date ? d : new Date();
  if (Number.isNaN(dt.getTime())) return new Date().toISOString().slice(0, 10);
  return dt.toISOString().slice(0, 10);
}

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

function sanitizeImpressionPayload(body) {
  const input = body && typeof body === 'object' ? body : {};
  const placement = normalizePlacement(input.placement || input.slot);
  const companyName = cleanText(input.company || input.companyName || input.brand || '', MAX_COMPANY);
  if (!placement) {
    return { ok: false, error: 'no_signal', message: 'Missing placement.' };
  }
  return { ok: true, placement, companyName };
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

async function recordSponsorImpression(body) {
  if (!isSupabaseConfigured()) {
    return { ok: true, configured: false, skipped: true };
  }

  const sanitized = sanitizeImpressionPayload(body);
  if (!sanitized.ok) return sanitized;

  const sb = getSupabaseAdmin();
  const { error } = await sb.rpc('bump_sponsor_impression_daily', {
    p_day: utcDayString(),
    p_placement: sanitized.placement,
    p_company_name: sanitized.companyName,
  });

  if (error) {
    if (/bump_sponsor_impression|sponsor_impression/i.test(error.message || '')) {
      return { ok: true, skipped: true, reason: 'table_missing' };
    }
    throw new Error(error.message);
  }
  return { ok: true };
}

/**
 * @param {Array<{ placement?: string, company?: string, companyName?: string }>} deliveries
 * @param {string} emailSlug
 */
async function recordSponsorEmailSends(deliveries, emailSlug) {
  if (!isSupabaseConfigured()) {
    return { ok: true, configured: false, skipped: true };
  }

  const list = Array.isArray(deliveries) ? deliveries : [];
  if (!list.length) return { ok: true, skipped: true, reason: 'no_deliveries' };

  const slug = cleanText(emailSlug, MAX_SLUG).toLowerCase().replace(/[^a-z0-9_-]+/g, '_') || '';
  const sb = getSupabaseAdmin();
  const day = utcDayString();
  const seen = new Set();

  for (const item of list) {
    const placement = normalizePlacement(item && (item.placement || item.slot));
    const company = cleanText(
      (item && (item.company || item.companyName || item.brand)) || '',
      MAX_COMPANY
    );
    const key = placement + '|' + company.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const { error } = await sb.rpc('bump_sponsor_email_send_daily', {
      p_day: day,
      p_placement: placement,
      p_company_name: company,
      p_email_slug: slug,
    });
    if (error) {
      if (/bump_sponsor_email|sponsor_email_send/i.test(error.message || '')) {
        return { ok: true, skipped: true, reason: 'table_missing' };
      }
      throw new Error(error.message);
    }
  }

  return { ok: true, counted: seen.size };
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

function countBy(rows, keyFn, weightFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row) || '(blank)';
    const w = weightFn ? Number(weightFn(row)) || 0 : 1;
    map.set(key, (map.get(key) || 0) + w);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

const BARNSGATE_PACK_LOGO =
  'https://cdn.prod.website-files.com/66e99a1017187b724a2bc8b8/66e9a2aee48ebc4a38f6add4_BAR%200007%20Solutions%20logo%20various%20final-01.svg';

const SLOT_LOGO_PRIORITY = [
  'events_sponsor_hub',
  'sponsor_hub',
  'booking_email_sponsor',
  'organisers_sponsor_hub',
  'opportunities_sponsor_hub',
  'home_partners',
];

function companyIlike(filter) {
  return '%' + cleanText(filter, MAX_COMPANY).replace(/%/g, '') + '%';
}

function isBarnsgateBrand(name) {
  return /barnsgate/i.test(String(name || ''));
}

function scoreLogoCandidate(row, companyFilter) {
  const slot = String(row.slot || '').trim();
  const activeBoost = row.active === false ? -50 : 20;
  const slotIdx = SLOT_LOGO_PRIORITY.indexOf(slot);
  const slotBoost = slotIdx >= 0 ? 40 - slotIdx : /sponsor|partner/i.test(slot) ? 10 : 0;
  const name = String(row.company_name || '').trim().toLowerCase();
  const filter = String(companyFilter || '').trim().toLowerCase();
  const nameBoost = name === filter ? 15 : name.indexOf(filter) === 0 ? 8 : 0;
  const hasLogo = String(row.logo_url || row.image_url || '').trim() ? 5 : -20;
  return activeBoost + slotBoost + nameBoost + hasLogo;
}

async function lookupBrandLogo(sb, companyFilter) {
  if (!companyFilter) return null;
  const { data, error } = await sb
    .from('cms_blocks')
    .select('company_name, logo_url, image_url, slot, active, logo_band_dark')
    .ilike('company_name', companyIlike(companyFilter))
    .order('updated_at', { ascending: false })
    .limit(12);

  if (error || !data || !data.length) {
    if (isBarnsgateBrand(companyFilter)) {
      return {
        company: 'Barnsgate Solutions',
        logoUrl: BARNSGATE_PACK_LOGO,
        slot: 'events_sponsor_hub',
        logoBandDark: true,
      };
    }
    return null;
  }

  const ranked = data.slice().sort((a, b) => scoreLogoCandidate(b, companyFilter) - scoreLogoCandidate(a, companyFilter));
  const preferred = ranked[0];
  let logo = String(preferred.logo_url || preferred.image_url || '').trim();
  let company = String(preferred.company_name || '').trim() || companyFilter;
  let logoBandDark = preferred.logo_band_dark === true;

  // Light/white SVG wordmarks vanish on a white pack tile — use dark band + known Barnsgate asset.
  if (isBarnsgateBrand(company) || isBarnsgateBrand(companyFilter)) {
    company = company || 'Barnsgate Solutions';
    if (!logo || /\.svg(?:[?#]|$)/i.test(logo) || /website-files\.com/i.test(logo)) {
      logo = BARNSGATE_PACK_LOGO;
    }
    logoBandDark = true;
  }

  if (!company && !logo) return null;
  return {
    company,
    logoUrl: logo || null,
    slot: preferred.slot || null,
    logoBandDark,
  };
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
  const fromDay = from.slice(0, 10);
  const toDay = to.slice(0, 10);

  const sb = getSupabaseAdmin();

  let clicksReq = sb
    .from('sponsor_clicks')
    .select('id, created_at, placement, company_name, destination_url, path')
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false })
    .limit(REPORT_ROW_CAP);

  if (companyFilter) clicksReq = clicksReq.ilike('company_name', companyIlike(companyFilter));
  if (placementFilter) clicksReq = clicksReq.eq('placement', placementFilter);

  let impressionsReq = sb
    .from('sponsor_impression_daily')
    .select('day, placement, company_name, impressions')
    .gte('day', fromDay)
    .lte('day', toDay)
    .limit(REPORT_ROW_CAP);

  if (companyFilter) impressionsReq = impressionsReq.ilike('company_name', companyIlike(companyFilter));
  if (placementFilter) impressionsReq = impressionsReq.eq('placement', placementFilter);

  let emailsReq = sb
    .from('sponsor_email_send_daily')
    .select('day, placement, company_name, email_slug, send_count')
    .gte('day', fromDay)
    .lte('day', toDay)
    .limit(REPORT_ROW_CAP);

  if (companyFilter) emailsReq = emailsReq.ilike('company_name', companyIlike(companyFilter));
  if (placementFilter) emailsReq = emailsReq.eq('placement', placementFilter);

  const [clicksRes, impressionsRes, emailsRes, brand] = await Promise.all([
    clicksReq,
    impressionsReq,
    emailsReq,
    lookupBrandLogo(sb, companyFilter),
  ]);

  if (clicksRes.error) {
    if (/sponsor_clicks/i.test(clicksRes.error.message || '')) {
      const err = new Error('sponsor_clicks_table_missing');
      err.code = 'sponsor_clicks_table_missing';
      throw err;
    }
    throw new Error(clicksRes.error.message);
  }

  const clickRows = clicksRes.data || [];
  const impressionRows = impressionsRes.error ? [] : impressionsRes.data || [];
  const emailRows = emailsRes.error ? [] : emailsRes.data || [];
  const tablesPartial =
    Boolean(impressionsRes.error) || Boolean(emailsRes.error);

  const pageVisits = impressionRows.reduce((n, r) => n + (Number(r.impressions) || 0), 0);
  const emailSends = emailRows.reduce((n, r) => n + (Number(r.send_count) || 0), 0);
  const clicks = clickRows.length;
  const ctr = pageVisits > 0 ? clicks / pageVisits : null;

  return {
    ok: true,
    configured: true,
    from,
    to,
    brand: brand || (companyFilter ? { company: companyFilter, logoUrl: null, slot: null, logoBandDark: false } : null),
    hubLogoUrl: '/assets/logo-nav.png',
    summary: {
      pageVisits,
      emailSends,
      clicks,
      ctr,
      ctrPct: ctr == null ? null : Math.round(ctr * 10000) / 100,
    },
    tablesPartial,
    total: clicks,
    truncated: clickRows.length >= REPORT_ROW_CAP,
    byPlacement: countBy(clickRows, (r) => r.placement).map((r) => ({
      placement: r.key,
      count: r.count,
    })),
    byCompany: countBy(clickRows, (r) => r.company_name).map((r) => ({
      company: r.key,
      count: r.count,
    })),
    byDay: countBy(clickRows, (r) => String(r.created_at || '').slice(0, 10))
      .map((r) => ({ day: r.key, count: r.count }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    impressions: {
      total: pageVisits,
      byPlacement: countBy(
        impressionRows,
        (r) => r.placement,
        (r) => r.impressions
      ).map((r) => ({ placement: r.key, count: r.count })),
      byDay: countBy(
        impressionRows,
        (r) => String(r.day || '').slice(0, 10),
        (r) => r.impressions
      )
        .map((r) => ({ day: r.key, count: r.count }))
        .sort((a, b) => a.day.localeCompare(b.day)),
    },
    emails: {
      total: emailSends,
      byPlacement: countBy(
        emailRows,
        (r) => r.placement,
        (r) => r.send_count
      ).map((r) => ({ placement: r.key, count: r.count })),
      bySlug: countBy(
        emailRows,
        (r) => r.email_slug,
        (r) => r.send_count
      ).map((r) => ({ slug: r.key, count: r.count })),
      byDay: countBy(
        emailRows,
        (r) => String(r.day || '').slice(0, 10),
        (r) => r.send_count
      )
        .map((r) => ({ day: r.key, count: r.count }))
        .sort((a, b) => a.day.localeCompare(b.day)),
    },
    recent: clickRows.slice(0, 75).map((r) => ({
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
  recordSponsorImpression,
  recordSponsorEmailSends,
  getSponsorClicksReport,
  sanitizeSponsorClickPayload,
  defaultMonthBounds,
};
