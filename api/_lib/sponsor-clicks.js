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

  const ranked = data
    .slice()
    .sort((a, b) => scoreLogoCandidate(b, companyFilter) - scoreLogoCandidate(a, companyFilter));
  const preferred = ranked[0];
  let logo = String(preferred.logo_url || preferred.image_url || '').trim();
  let company = String(preferred.company_name || '').trim() || companyFilter;
  let logoBandDark = preferred.logo_band_dark === true;

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

/**
 * @param {Array<{ placement?: string, company?: string, companyName?: string }>} deliveries
 * @param {string} emailSlug
 */
async function recordSponsorEmailSends(deliveries, emailSlug, resendEmailId) {
  if (!isSupabaseConfigured()) {
    return { ok: true, configured: false, skipped: true };
  }

  const list = Array.isArray(deliveries) ? deliveries : [];
  if (!list.length) return { ok: true, skipped: true, reason: 'no_deliveries' };

  const slug = cleanText(emailSlug, MAX_SLUG).toLowerCase().replace(/[^a-z0-9_-]+/g, '_') || '';
  const sb = getSupabaseAdmin();
  const day = utcDayString();
  const seen = new Set();
  const resendId = cleanText(resendEmailId, 120);

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

    if (resendId && company) {
      await sb.from('sponsor_email_dispatch').upsert(
        {
          resend_email_id: resendId,
          company_name: company,
          placement,
          email_slug: slug,
        },
        { onConflict: 'resend_email_id,company_name' }
      );
    }
  }

  return { ok: true, counted: seen.size };
}

async function recordSponsorEmailOpen(companyName) {
  if (!isSupabaseConfigured()) return { ok: true, skipped: true };
  const company = cleanText(companyName, MAX_COMPANY);
  if (!company) return { ok: true, skipped: true };
  const sb = getSupabaseAdmin();
  const { error } = await sb.rpc('bump_sponsor_email_open_daily', {
    p_day: utcDayString(),
    p_company_name: company,
  });
  if (error) {
    if (/bump_sponsor_email_open|sponsor_email_open/i.test(error.message || '')) {
      return { ok: true, skipped: true, reason: 'table_missing' };
    }
    throw new Error(error.message);
  }
  return { ok: true };
}

async function recordSponsorEmailClick(companyName) {
  if (!isSupabaseConfigured()) return { ok: true, skipped: true };
  const company = cleanText(companyName, MAX_COMPANY);
  if (!company) return { ok: true, skipped: true };
  const sb = getSupabaseAdmin();
  const { error } = await sb.rpc('bump_sponsor_email_click_daily', {
    p_day: utcDayString(),
    p_company_name: company,
  });
  if (error) {
    if (/bump_sponsor_email_click|sponsor_email_click/i.test(error.message || '')) {
      return { ok: true, skipped: true, reason: 'table_missing' };
    }
    throw new Error(error.message);
  }
  return { ok: true };
}

async function resolveCompaniesFromResendEmailId(resendEmailId) {
  const id = cleanText(resendEmailId, 120);
  if (!id || !isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('sponsor_email_dispatch')
    .select('company_name')
    .eq('resend_email_id', id)
    .limit(20);
  if (error || !data || !data.length) return [];
  const out = [];
  const seen = new Set();
  for (const row of data) {
    const name = cleanText(row.company_name, MAX_COMPANY);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** @deprecated use resolveCompaniesFromResendEmailId */
async function resolveCompanyFromResendEmailId(resendEmailId) {
  const list = await resolveCompaniesFromResendEmailId(resendEmailId);
  return list[0] || null;
}

function previousPeriodBounds(fromIso, toIso) {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  const durationMs = Math.max(24 * 60 * 60 * 1000, to.getTime() - from.getTime());
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  return {
    from: prevFrom.toISOString(),
    to: prevTo.toISOString(),
    fromDay: prevFrom.toISOString().slice(0, 10),
    toDay: prevTo.toISOString().slice(0, 10),
  };
}

function deltaPct(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p <= 0) return c > 0 ? 100 : null;
  return Math.round(((c - p) / p) * 1000) / 10;
}

function isEmailPlacement(placement) {
  const p = String(placement || '');
  return /email/i.test(p);
}

function buildExecutiveSummary(summary, previous, brandName) {
  const name = brandName || 'This partner';
  const views = Number(summary.pageVisits) || 0;
  const clicks = Number(summary.clicks) || 0;
  const emails = Number(summary.emailSends) || 0;
  const ctr = views > 0 ? Math.round((clicks / views) * 1000) / 10 : null;
  const parts = [];
  parts.push(
    formatNum(views) +
      ' directory page view' +
      (views === 1 ? '' : 's') +
      ' · ' +
      formatNum(clicks) +
      ' outbound click' +
      (clicks === 1 ? '' : 's')
  );
  if (ctr != null) parts.push(ctr + '% site CTR');
  else parts.push('CTR pending more page views');
  if (emails > 0) {
    parts.push(formatNum(emails) + ' email' + (emails === 1 ? '' : 's') + ' carried their logo');
  }
  let line = name + ': ' + parts.join(' · ') + '.';
  if (previous && previous.summary) {
    const dViews = deltaPct(views, previous.summary.pageVisits);
    const dClicks = deltaPct(clicks, previous.summary.clicks);
    const mom = [];
    if (dViews != null) mom.push((dViews >= 0 ? '+' : '') + dViews + '% page views');
    if (dClicks != null) mom.push((dClicks >= 0 ? '+' : '') + dClicks + '% clicks');
    if (mom.length) line += ' vs prior period: ' + mom.join(', ') + '.';
  }
  return line;
}

function formatNum(n) {
  const num = Number(n) || 0;
  try {
    return num.toLocaleString('en-GB');
  } catch {
    return String(num);
  }
}

async function fetchPeriodMetrics(sb, { from, to, fromDay, toDay, companyFilter, placementFilter }) {
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

  let opensReq = sb
    .from('sponsor_email_open_daily')
    .select('day, company_name, open_count')
    .gte('day', fromDay)
    .lte('day', toDay)
    .limit(REPORT_ROW_CAP);
  if (companyFilter) opensReq = opensReq.ilike('company_name', companyIlike(companyFilter));

  let emailClicksReq = sb
    .from('sponsor_email_click_daily')
    .select('day, company_name, click_count')
    .gte('day', fromDay)
    .lte('day', toDay)
    .limit(REPORT_ROW_CAP);
  if (companyFilter) emailClicksReq = emailClicksReq.ilike('company_name', companyIlike(companyFilter));

  const [clicksRes, impressionsRes, emailsRes, opensRes, emailClicksRes] = await Promise.all([
    clicksReq,
    impressionsReq,
    emailsReq,
    opensReq,
    emailClicksReq,
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
  const openRows = opensRes.error ? [] : opensRes.data || [];
  const emailClickRows = emailClicksRes.error ? [] : emailClicksRes.data || [];

  const pageVisits = impressionRows.reduce((n, r) => n + (Number(r.impressions) || 0), 0);
  const emailSends = emailRows.reduce((n, r) => n + (Number(r.send_count) || 0), 0);
  const clicks = clickRows.length;
  const hubEmailClicks = clickRows.filter((r) => isEmailPlacement(r.placement)).length;
  const resendOpens = openRows.reduce((n, r) => n + (Number(r.open_count) || 0), 0);
  const resendEmailClicks = emailClickRows.reduce((n, r) => n + (Number(r.click_count) || 0), 0);
  const emailClicks = Math.max(hubEmailClicks, resendEmailClicks);
  const ctr = pageVisits > 0 ? clicks / pageVisits : null;
  const emailCtr = emailSends > 0 ? emailClicks / emailSends : null;
  const openRate = emailSends > 0 && resendOpens > 0 ? resendOpens / emailSends : null;

  return {
    clickRows,
    impressionRows,
    emailRows,
    openRows,
    emailClickRows,
    tablesPartial:
      Boolean(impressionsRes.error) ||
      Boolean(emailsRes.error) ||
      Boolean(opensRes.error) ||
      Boolean(emailClicksRes.error),
    emailOpensAvailable: !opensRes.error,
    emailClicksAvailable: !emailClicksRes.error,
    summary: {
      pageVisits,
      emailSends,
      clicks,
      ctr,
      ctrPct: ctr == null ? null : Math.round(ctr * 10000) / 100,
      emailClicks,
      emailCtr,
      emailCtrPct: emailCtr == null ? null : Math.round(emailCtr * 10000) / 100,
      emailOpens: resendOpens,
      emailOpenRate: openRate,
      emailOpenRatePct: openRate == null ? null : Math.round(openRate * 10000) / 100,
    },
  };
}

async function listSponsorBrands() {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('cms_blocks')
    .select('company_name, slot, active, logo_url, image_url')
    .not('company_name', 'is', null)
    .neq('company_name', '')
    .order('company_name', { ascending: true })
    .limit(200);

  if (error) return [];

  const map = new Map();
  for (const row of data || []) {
    const name = cleanText(row.company_name, MAX_COMPANY);
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = map.get(key);
    const score =
      (row.active === false ? 0 : 2) +
      (/sponsor|partner/i.test(String(row.slot || '')) ? 2 : 0) +
      (row.logo_url || row.image_url ? 1 : 0);
    if (!existing || score > existing.score) {
      map.set(key, { company: name, score });
    }
  }

  const brands = Array.from(map.values())
    .map((b) => b.company)
    .sort((a, b) => a.localeCompare(b));

  if (!brands.some((b) => isBarnsgateBrand(b))) {
    brands.unshift('Barnsgate Solutions');
  }
  return brands;
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
  const prev = previousPeriodBounds(from, to);

  const sb = getSupabaseAdmin();

  const [current, previousRaw, brand, brands] = await Promise.all([
    fetchPeriodMetrics(sb, {
      from,
      to,
      fromDay,
      toDay,
      companyFilter,
      placementFilter,
    }),
    prev
      ? fetchPeriodMetrics(sb, {
          from: prev.from,
          to: prev.to,
          fromDay: prev.fromDay,
          toDay: prev.toDay,
          companyFilter,
          placementFilter,
        }).catch(() => null)
      : Promise.resolve(null),
    lookupBrandLogo(sb, companyFilter),
    listSponsorBrands(),
  ]);

  const clickRows = current.clickRows;
  const impressionRows = current.impressionRows;
  const emailRows = current.emailRows;
  const pageVisits = current.summary.pageVisits;
  const emailSends = current.summary.emailSends;
  const clicks = current.summary.clicks;

  const previous = previousRaw
    ? {
        from: prev.from,
        to: prev.to,
        summary: previousRaw.summary,
        deltas: {
          pageVisitsPct: deltaPct(pageVisits, previousRaw.summary.pageVisits),
          clicksPct: deltaPct(clicks, previousRaw.summary.clicks),
          emailSendsPct: deltaPct(emailSends, previousRaw.summary.emailSends),
          emailOpensPct: deltaPct(
            current.summary.emailOpens,
            previousRaw.summary.emailOpens
          ),
        },
      }
    : null;

  const brandName =
    (brand && brand.company) || companyFilter || 'All sponsors';
  const executiveSummary = buildExecutiveSummary(current.summary, previous, brandName);

  return {
    ok: true,
    configured: true,
    from,
    to,
    brand: brand || (companyFilter ? { company: companyFilter, logoUrl: null, slot: null, logoBandDark: false } : null),
    brands,
    hubLogoUrl: '/assets/logo-nav.png',
    contact: {
      name: 'Rosie McGilvray',
      email: 'rosie@thenetworkerhub.com',
      label: 'Questions about this pack?',
    },
    executiveSummary,
    summary: current.summary,
    previous,
    emailEngagement: {
      sends: emailSends,
      opens: current.summary.emailOpens,
      openRatePct: current.summary.emailOpenRatePct,
      clicks: current.summary.emailClicks,
      ctrPct: current.summary.emailCtrPct,
      opensConfigured: current.emailOpensAvailable === true,
      clicksConfigured: current.emailClicksAvailable === true,
      note:
        current.emailOpensAvailable && current.summary.emailOpens > 0
          ? 'Opens and link clicks from Resend · Hub email-placement clicks are included in Email CTR.'
          : current.emailOpensAvailable
            ? 'Resend open tracking is live. Numbers update as sponsored emails are opened and clicked.'
            : 'Email clicks include Hub-tracked email placements. Open rates need the Resend webhook at /api/resend-webhook.',
    },
    tablesPartial: current.tablesPartial,
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
  recordSponsorEmailOpen,
  recordSponsorEmailClick,
  resolveCompaniesFromResendEmailId,
  resolveCompanyFromResendEmailId,
  getSponsorClicksReport,
  listSponsorBrands,
  sanitizeSponsorClickPayload,
  defaultMonthBounds,
};
