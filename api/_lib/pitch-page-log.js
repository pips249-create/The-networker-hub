/**
 * First-party confidential sales-pitch open logging (/p-tnh-* decks).
 * No cookies / no identity — aggregate Command Centre stats only.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');

const ALLOWED_ACTIONS = new Set(['view', 'pdf_download']);

const PITCH_LABELS = {
  '/p-tnh-barnsgate-ev-m4p8': 'Barnsgate — Events Headline',
  '/p-tnh-vci-ftt-k9w4': 'VC Innovations — FTT Fintech Festival listing',
  '/p-tnh-ev-hub-k7m2': 'Events Headline — sales walkthrough',
  '/p-tnh-org-onboard-x4n7': 'Organiser onboarding pitch',
  '/p-tnh-org-cheats-c8r3': 'Organiser demo cheat sheets',
  '/p-tnh-bmu-onboard-k7m2': 'BMU onboarding pitch',
  '/p-tnh-wibn-onboard-w9m3': 'WIBN onboarding pitch',
  '/p-tnh-intl-overview-i8n2': 'The Networker International overview',
};

function cleanText(value, max) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max || 120);
}

function normalizePath(raw) {
  let p = String(raw || '')
    .trim()
    .split('?')[0]
    .split('#')[0]
    .toLowerCase();
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/\.html$/i, '').replace(/\/+$/, '') || '/';
  return p.slice(0, 120);
}

function isAllowedPitchPath(path) {
  return /^\/p-tnh-[a-z0-9-]+$/.test(path);
}

function labelForPath(path, fallback) {
  if (PITCH_LABELS[path]) return PITCH_LABELS[path];
  const cleaned = cleanText(fallback, 120);
  return cleaned || path;
}

function referrerHost(raw) {
  const s = cleanText(raw, 200);
  if (!s) return '';
  try {
    const u = new URL(s);
    return String(u.hostname || '')
      .toLowerCase()
      .slice(0, 120);
  } catch {
    return s.replace(/^https?:\/\//i, '').split('/')[0].slice(0, 120);
  }
}

function parsePeriod(raw) {
  const p = String(raw || '30d').trim().toLowerCase();
  return p === '7d' || p === '30d' || p === 'ytd' || p === '12m' || p === 'all' ? p : '30d';
}

function sinceIso(period) {
  if (period === 'all') return null;
  if (period === 'ytd') {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
  }
  if (period === '12m') {
    return new Date(Date.now() - 365 * 86400000).toISOString();
  }
  const days = period === '7d' ? 7 : 30;
  return new Date(Date.now() - days * 86400000).toISOString();
}

function isTableMissing(error) {
  return /pitch_page_views|schema cache|does not exist/i.test(String(error?.message || ''));
}

async function recordPitchPageAction(input) {
  if (!isSupabaseConfigured()) {
    return { ok: true, configured: false, skipped: true };
  }

  const path = normalizePath(input.path);
  if (!isAllowedPitchPath(path)) {
    return { ok: false, error: 'invalid_path' };
  }

  const action = String(input.action || 'view')
    .trim()
    .toLowerCase();
  if (!ALLOWED_ACTIONS.has(action)) {
    return { ok: false, error: 'invalid_action' };
  }

  const row = {
    path,
    label: labelForPath(path, input.label),
    action,
    referrer_host: referrerHost(input.referrer || input.referrerHost || input.referrer_host),
  };

  const sb = getSupabaseAdmin();
  const { error } = await sb.from('pitch_page_views').insert(row);
  if (error) {
    if (isTableMissing(error)) {
      const err = new Error(error.message);
      err.code = 'pitch_page_views_table_missing';
      throw err;
    }
    throw new Error(error.message);
  }
  return { ok: true };
}

async function getPitchPageStats(periodRaw) {
  if (!isSupabaseConfigured()) {
    return { configured: false, totals: {}, pages: [] };
  }

  const period = parsePeriod(periodRaw);
  const since = sinceIso(period);
  const sb = getSupabaseAdmin();

  let query = sb
    .from('pitch_page_views')
    .select('path, label, action, referrer_host, created_at')
    .order('created_at', { ascending: false })
    .limit(5000);
  if (since) query = query.gte('created_at', since);

  const { data, error } = await query;
  if (error) {
    if (isTableMissing(error)) {
      return {
        configured: false,
        totals: {},
        pages: [],
        message: 'Apply migration 238_pitch_page_views.sql in Supabase to start collecting pitch opens.',
      };
    }
    throw new Error(error.message);
  }

  const rows = data || [];
  const totals = { view: 0, pdf_download: 0 };
  const byPath = new Map();

  rows.forEach(function (row) {
    const action = String(row.action || 'view');
    if (totals[action] != null) totals[action] += 1;

    const path = normalizePath(row.path);
    if (!path) return;
    let entry = byPath.get(path);
    if (!entry) {
      entry = {
        path,
        label: labelForPath(path, row.label),
        views: 0,
        pdfDownloads: 0,
        lastOpenedAt: null,
        referrerHosts: {},
      };
      byPath.set(path, entry);
    }
    if (row.label && !PITCH_LABELS[path]) {
      entry.label = labelForPath(path, row.label);
    }
    if (action === 'pdf_download') entry.pdfDownloads += 1;
    else entry.views += 1;

    const created = row.created_at || null;
    if (created && (!entry.lastOpenedAt || created > entry.lastOpenedAt)) {
      entry.lastOpenedAt = created;
    }
    const host = cleanText(row.referrer_host, 120);
    if (host) entry.referrerHosts[host] = (entry.referrerHosts[host] || 0) + 1;
  });

  const pages = Array.from(byPath.values())
    .map(function (p) {
      const topReferrers = Object.keys(p.referrerHosts)
        .map(function (host) {
          return { host: host, count: p.referrerHosts[host] };
        })
        .sort(function (a, b) {
          return b.count - a.count;
        })
        .slice(0, 3);
      return {
        path: p.path,
        label: p.label,
        views: p.views,
        pdfDownloads: p.pdfDownloads,
        lastOpenedAt: p.lastOpenedAt,
        topReferrers: topReferrers,
      };
    })
    .sort(function (a, b) {
      return (b.views + b.pdfDownloads) - (a.views + a.pdfDownloads);
    });

  return {
    configured: true,
    period: period,
    totals: totals,
    views: totals.view || 0,
    pdfDownloads: totals.pdf_download || 0,
    uniquePages: pages.length,
    pages: pages,
    sampleSize: rows.length,
  };
}

module.exports = {
  recordPitchPageAction,
  getPitchPageStats,
  normalizePath,
  isAllowedPitchPath,
  PITCH_LABELS,
  ALLOWED_ACTIONS,
};
