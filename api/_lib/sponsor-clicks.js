/**
 * First-party sponsor performance metrics — clicks, page impressions, email logo sends.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const {
  EVENT_PAGE_CAROUSEL_SLOT,
  ORGANISER_PAGE_CAROUSEL_SLOT,
  OPPORTUNITY_PAGE_CAROUSEL_SLOT,
  parseCarouselBody,
  normalizeCarouselAd,
} = require('./event-page-carousel');
const { HOME_PARTNERS_SLOT, parsePartnersBody } = require('./home-partners');

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
    return new URL(p, 'https://thenetworkeruk.com').pathname.slice(0, MAX_PATH);
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

const SLOT_LOGO_PRIORITY = [
  'events_sponsor_hub',
  'sponsor_hub',
  'booking_email_sponsor',
  'organisers_sponsor_hub',
  'opportunities_sponsor_hub',
  'home_partners',
];

function companyExactFilter(filter) {
  return cleanText(filter, MAX_COMPANY).replace(/%/g, '');
}

/** @deprecated use companyExactFilter — fuzzy match mixed brands in reports */
function companyIlike(filter) {
  return '%' + companyExactFilter(filter) + '%';
}

const PAGE_CAROUSEL_SLOTS = [
  EVENT_PAGE_CAROUSEL_SLOT,
  ORGANISER_PAGE_CAROUSEL_SLOT,
  OPPORTUNITY_PAGE_CAROUSEL_SLOT,
];

const PLACEMENT_SURFACE_LABELS = {
  events_sponsor_hub: 'Events directory hero',
  sponsor_hub: 'Events directory hero',
  events_hero: 'Events directory hero',
  organisers_sponsor_hub: 'Organisers directory hero',
  organisers_hero: 'Organisers directory hero',
  opportunities_sponsor_hub: 'Opportunities directory hero',
  opportunities_hero: 'Opportunities directory hero',
  events_page_partner: 'Event detail pages',
  organisers_page_partner: 'Organiser detail pages',
  opportunities_page_partner: 'Opportunity detail pages',
  event_page_carousel_ads: 'Event detail pages',
  organiser_page_carousel_ads: 'Organiser detail pages',
  opportunity_page_carousel_ads: 'Opportunity detail pages',
  opportunity_page_sidebar_ad: 'Opportunity sidebar',
  home_partners: 'Home page partners strip',
  booking_email_sponsor: 'Booking confirmation emails',
  email_mini_sponsor: 'Page Partner emails',
  events_email_mini: 'Event Page Partner emails',
  organisers_email_mini: 'Organiser Page Partner emails',
  opportunities_email_mini: 'Opportunity Page Partner emails',
  email2_launch: 'Launch emails',
  sponsor_sidebar: 'Sidebar sponsor',
  city_partner: 'City partner placement',
};

function surfaceLabelForPlacement(placement) {
  const key = normalizePlacement(placement);
  if (PLACEMENT_SURFACE_LABELS[key]) return PLACEMENT_SURFACE_LABELS[key];
  return key.replace(/_/g, ' ');
}

function pagePartnerPlacementForSlot(slot) {
  const s = String(slot || '').toLowerCase();
  if (s === ORGANISER_PAGE_CAROUSEL_SLOT || /organiser_page/.test(s)) {
    return 'organisers_page_partner';
  }
  if (s === OPPORTUNITY_PAGE_CAROUSEL_SLOT || /opportunity_page/.test(s)) {
    return 'opportunities_page_partner';
  }
  if (s === EVENT_PAGE_CAROUSEL_SLOT || /event_page/.test(s)) {
    return 'events_page_partner';
  }
  return normalizePlacement(slot);
}

function upsertBrandEntry(map, name, entry) {
  const company = cleanText(name, MAX_COMPANY);
  if (!company) return;
  const key = company.toLowerCase();
  const score =
    (entry.active === false ? 0 : 4) +
    (entry.logoUrl ? 2 : 0) +
    (entry.placements && entry.placements.length ? entry.placements.length : 0);
  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      company,
      score,
      logoUrl: entry.logoUrl || null,
      logoBandDark: entry.logoBandDark === true,
      slot: entry.slot || null,
      directory: entry.directory || directoryFromSlot(entry.slot) || '',
      placements: Array.isArray(entry.placements) ? entry.placements.slice() : [],
      active: entry.active !== false,
    });
    return;
  }
  existing.score = Math.max(existing.score, score);
  if (entry.logoUrl && !existing.logoUrl) existing.logoUrl = entry.logoUrl;
  if (entry.logoBandDark) existing.logoBandDark = true;
  if (entry.slot && !existing.slot) existing.slot = entry.slot;
  if (entry.directory && !existing.directory) existing.directory = entry.directory;
  if (entry.active !== false) existing.active = true;
  const placements = Array.isArray(entry.placements) ? entry.placements : [];
  placements.forEach(function (p) {
    if (p && existing.placements.indexOf(p) === -1) existing.placements.push(p);
  });
}

async function collectBrandCatalog(sb) {
  const map = new Map();
  const { data, error } = await sb
    .from('cms_blocks')
    .select('slot, company_name, logo_url, image_url, active, logo_band_dark, body, sponsor_available_from')
    .limit(400);

  if (error) return map;

  const now = new Date();
  for (const row of data || []) {
    const slot = String(row.slot || '').trim();
    const placementEnded =
      row.sponsor_available_from &&
      !Number.isNaN(new Date(row.sponsor_available_from).getTime()) &&
      new Date(row.sponsor_available_from).getTime() <= now.getTime();
    const rowActive = row.active !== false && !placementEnded;

    const topName = cleanText(row.company_name, MAX_COMPANY);
    if (topName) {
      upsertBrandEntry(map, topName, {
        logoUrl: String(row.logo_url || row.image_url || '').trim() || null,
        logoBandDark: row.logo_band_dark === true,
        slot,
        directory: directoryFromSlot(slot),
        placements: slot ? [normalizePlacement(slot)] : [],
        active: rowActive,
      });
    }

    if (slot === HOME_PARTNERS_SLOT) {
      parsePartnersBody(row.body).forEach(function (partner, index) {
        const ad = partner || {};
        if (ad.active === false) return;
        const name = cleanText(ad.company_name || ad.companyName, MAX_COMPANY);
        if (!name) return;
        upsertBrandEntry(map, name, {
          logoUrl: String(ad.logo_url || ad.logoUrl || '').trim() || null,
          logoBandDark: ad.logo_band_dark === true || ad.logoBandDark === true,
          slot: HOME_PARTNERS_SLOT,
          directory: 'events',
          placements: ['home_partners'],
          active: rowActive,
        });
      });
      continue;
    }

    if (PAGE_CAROUSEL_SLOTS.indexOf(slot) !== -1) {
      parseCarouselBody(row.body).forEach(function (adRaw, index) {
        const ad = normalizeCarouselAd(adRaw, index, slot);
        if (ad.active === false) return;
        if (ad.ends_at) {
          const ends = new Date(ad.ends_at);
          if (!Number.isNaN(ends.getTime()) && ends.getTime() <= now.getTime()) return;
        }
        const name = cleanText(ad.company_name, MAX_COMPANY);
        if (!name) return;
        const trackPlacement = pagePartnerPlacementForSlot(slot);
        upsertBrandEntry(map, name, {
          logoUrl: String(ad.logo_url || '').trim() || null,
          logoBandDark: ad.logo_band_dark === true,
          slot,
          directory: directoryFromSlot(slot) || directoryFromSlot(trackPlacement),
          placements: [trackPlacement, normalizePlacement(slot)],
          active: rowActive,
        });
      });
    }
  }

  return map;
}

async function listMetricBrandNames(sb) {
  const names = new Set();
  const tables = [
    ['sponsor_clicks', 'company_name'],
    ['sponsor_impression_daily', 'company_name'],
    ['sponsor_email_send_daily', 'company_name'],
  ];
  await Promise.all(
    tables.map(async function ([table, column]) {
      const res = await sb.from(table).select(column).not(column, 'is', null).limit(500);
      if (res.error) return;
      for (const row of res.data || []) {
        const name = cleanText(row[column], MAX_COMPANY);
        if (name && name !== '(blank)') names.add(name);
      }
    })
  );
  return Array.from(names);
}

function buildBrandSurfaces(companyFilter, catalogEntry, metrics) {
  if (!companyFilter) return [];
  const impressionBy = new Map(
    (metrics.impressionRows || []).map(function (r) {
      return [normalizePlacement(r.placement), Number(r.impressions) || 0];
    })
  );
  const clicksBy = countBy(metrics.clickRows || [], function (r) {
    return r.placement;
  }).reduce(function (acc, row) {
    acc.set(normalizePlacement(row.key), row.count);
    return acc;
  }, new Map());
  const emailsBy = countBy(metrics.emailRows || [], function (r) {
    return r.placement;
  }, function (r) {
    return r.send_count;
  }).reduce(function (acc, row) {
    acc.set(normalizePlacement(row.key), row.count);
    return acc;
  }, new Map());

  const placementKeys = new Set();
  if (catalogEntry && Array.isArray(catalogEntry.placements)) {
    catalogEntry.placements.forEach(function (p) {
      if (p) placementKeys.add(normalizePlacement(p));
    });
  }
  impressionBy.forEach(function (_v, k) {
    placementKeys.add(k);
  });
  clicksBy.forEach(function (_v, k) {
    placementKeys.add(k);
  });
  emailsBy.forEach(function (_v, k) {
    placementKeys.add(k);
  });

  return Array.from(placementKeys)
    .map(function (placement) {
      const pageViews = impressionBy.get(placement) || 0;
      const clicks = clicksBy.get(placement) || 0;
      const emails = emailsBy.get(placement) || 0;
      return {
        placement,
        label: surfaceLabelForPlacement(placement),
        pageViews,
        clicks,
        emails,
        total: pageViews + clicks + emails,
      };
    })
    .filter(function (row) {
      return row.total > 0 || (catalogEntry && catalogEntry.placements.indexOf(row.placement) !== -1);
    })
    .sort(function (a, b) {
      return b.total - a.total || a.label.localeCompare(b.label);
    });
}

/** Which directory pack theme to use (events / organisers / opportunities). */
function directoryFromSlot(slotOrPlacement) {
  const s = String(slotOrPlacement || '').toLowerCase();
  if (!s) return '';
  if (s.indexOf('organiser') !== -1) return 'organisers';
  if (s.indexOf('opportunit') !== -1) return 'opportunities';
  if (
    s.indexOf('event') !== -1 ||
    s === 'sponsor_hub' ||
    s.indexOf('booking_email') !== -1 ||
    s.indexOf('email2') !== -1 ||
    s.indexOf('home_partner') !== -1
  ) {
    return 'events';
  }
  return '';
}

/** Expand report filter keys to concrete placement values (incl. legacy aliases). */
const PLACEMENT_FILTER_GROUPS = {
  events_sponsor_hub: ['events_sponsor_hub', 'events_hero', 'sponsor_hub'],
  organisers_sponsor_hub: ['organisers_sponsor_hub', 'organisers_hero'],
  opportunities_sponsor_hub: ['opportunities_sponsor_hub', 'opportunities_hero'],
  events_page_partner: [
    'events_page_partner',
    'event_page_carousel_ads',
    'events_email_mini',
  ],
  organisers_page_partner: [
    'organisers_page_partner',
    'organiser_page_carousel_ads',
    'organisers_email_mini',
  ],
  opportunities_page_partner: [
    'opportunities_page_partner',
    'opportunity_page_carousel_ads',
    'opportunity_page_sidebar_ad',
    'opportunities_email_mini',
  ],
  page_partners: [
    'page_partners',
    'page_partner_carousel',
    'page_partner',
    'events_page_partner',
    'organisers_page_partner',
    'opportunities_page_partner',
    'event_page_carousel_ads',
    'organiser_page_carousel_ads',
    'opportunity_page_carousel_ads',
    'opportunity_page_sidebar_ad',
    'events_email_mini',
    'organisers_email_mini',
    'opportunities_email_mini',
    'email_mini_sponsor',
  ],
  email_mini_sponsors: [
    'email_mini_sponsor',
    'events_email_mini',
    'organisers_email_mini',
    'opportunities_email_mini',
    'hub_partner_email',
  ],
};

const LEGACY_PAGE_PARTNER_PLACEMENTS = new Set([
  'page_partner_carousel',
  'page_partner',
]);

function expandPlacementFilter(raw) {
  const key = normalizePlacement(raw);
  if (!key) return [];
  if (PLACEMENT_FILTER_GROUPS[key]) return PLACEMENT_FILTER_GROUPS[key].slice();
  return [key];
}

function pathMatchesPagePartnerDirectory(path, directory) {
  const p = String(path || '').toLowerCase();
  if (!p) return false;
  if (directory === 'organisers') return /organiser/.test(p);
  if (directory === 'opportunities') return /opportunit/.test(p);
  if (directory === 'events') {
    if (/organiser/.test(p) || /opportunit/.test(p)) return false;
    return /\/events\//.test(p) || /event\.html/.test(p) || p === '/events' || p.indexOf('/events?') === 0;
  }
  return false;
}

function isLegacyPagePartnerPlacement(placement) {
  return LEGACY_PAGE_PARTNER_PLACEMENTS.has(normalizePlacement(placement));
}

function placementFilterMeta(raw) {
  // normalizePlacement('') becomes 'sponsor' for write paths — do not treat blank
  // report filters as placement=sponsor or every "All placements" pack reads as zero.
  const cleaned = cleanText(raw, MAX_PLACEMENT);
  if (!cleaned) return { key: '', keys: [], directory: '', includeLegacyByPath: false };
  const key = normalizePlacement(cleaned);
  if (!key) return { key: '', keys: [], directory: '', includeLegacyByPath: false };
  const keys = expandPlacementFilter(key);
  const directory = directoryFromSlot(key);
  const includeLegacyByPath =
    key === 'events_page_partner' ||
    key === 'organisers_page_partner' ||
    key === 'opportunities_page_partner';
  return { key, keys, directory, includeLegacyByPath };
}

function resolvePackDirectory({ brand, placementFilter, byPlacement }) {
  const fromPlacement = directoryFromSlot(placementFilter);
  if (fromPlacement) return fromPlacement;
  if (brand && brand.directory) return brand.directory;
  const fromSlot = directoryFromSlot(brand && brand.slot);
  if (fromSlot) return fromSlot;
  const top =
    Array.isArray(byPlacement) && byPlacement[0]
      ? byPlacement[0].placement || byPlacement[0].key
      : '';
  const fromTop = directoryFromSlot(top);
  if (fromTop) return fromTop;
  return 'events';
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

function isEmailClickRow(row) {
  if (!row) return false;
  if (isEmailPlacement(row.placement)) return true;
  const path = String(row.path || '')
    .trim()
    .toLowerCase();
  return path === '/email' || path.startsWith('/email/') || path.startsWith('/email?');
}

function buildExecutiveSummary(summary, previous, brandName) {
  const name = brandName || 'This partner';
  const views = Number(summary.pageVisits) || 0;
  const siteClicks = Number(summary.siteClicks) || 0;
  const totalClicks = Number(summary.clicks) || 0;
  const logoClicks = Number(summary.emailLogoClicks) || 0;
  const emails = Number(summary.emailSends) || 0;
  const siteCtr = views > 0 && siteClicks > 0 ? Math.round((siteClicks / views) * 1000) / 10 : null;
  const parts = [];
  parts.push(
    formatNum(views) +
      ' directory page view' +
      (views === 1 ? '' : 's')
  );
  if (totalClicks > 0) {
    parts.push(
      formatNum(totalClicks) +
        ' outbound click' +
        (totalClicks === 1 ? '' : 's')
    );
  }
  if (siteCtr != null) parts.push(siteCtr + '% site CTR');
  else if (views > 0 && siteClicks === 0) parts.push('site CTR pending hero clicks');
  if (logoClicks > 0) {
    parts.push(
      formatNum(logoClicks) +
        ' logo email click' +
        (logoClicks === 1 ? '' : 's')
    );
  }
  if (emails > 0) {
    parts.push(formatNum(emails) + ' email' + (emails === 1 ? '' : 's') + ' carried their logo');
  }
  let line = name + ': ' + parts.join(' · ') + '.';
  if (previous && previous.summary) {
    const dViews = deltaPct(views, previous.summary.pageVisits);
    const dClicks = deltaPct(totalClicks, previous.summary.clicks);
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
  const filterMeta = placementFilterMeta(placementFilter);
  const placementKeys = filterMeta.keys;
  let clicksReq = sb
    .from('sponsor_clicks')
    .select('id, created_at, placement, company_name, destination_url, path')
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false })
    .limit(REPORT_ROW_CAP);

  if (companyFilter) {
    const exact = companyExactFilter(companyFilter);
    clicksReq = clicksReq.ilike('company_name', exact);
  }
  if (placementKeys.length === 1) {
    clicksReq = clicksReq.eq('placement', placementKeys[0]);
  } else if (placementKeys.length > 1) {
    // Include legacy page-partner rows when we will path-match them client-side.
    const clickKeys = filterMeta.includeLegacyByPath
      ? placementKeys.concat(Array.from(LEGACY_PAGE_PARTNER_PLACEMENTS))
      : placementKeys;
    clicksReq = clicksReq.in('placement', clickKeys);
  }

  let impressionsReq = sb
    .from('sponsor_impression_daily')
    .select('day, placement, company_name, impressions')
    .gte('day', fromDay)
    .lte('day', toDay)
    .limit(REPORT_ROW_CAP);

  if (companyFilter) {
    const exact = companyExactFilter(companyFilter);
    impressionsReq = impressionsReq.ilike('company_name', exact);
  }
  if (placementKeys.length === 1) {
    impressionsReq = impressionsReq.eq('placement', placementKeys[0]);
  } else if (placementKeys.length > 1) {
    impressionsReq = impressionsReq.in('placement', placementKeys);
  }

  let emailsReq = sb
    .from('sponsor_email_send_daily')
    .select('day, placement, company_name, email_slug, send_count')
    .gte('day', fromDay)
    .lte('day', toDay)
    .limit(REPORT_ROW_CAP);

  if (companyFilter) {
    const exact = companyExactFilter(companyFilter);
    emailsReq = emailsReq.ilike('company_name', exact);
  }
  if (placementKeys.length === 1) {
    emailsReq = emailsReq.eq('placement', placementKeys[0]);
  } else if (placementKeys.length > 1) {
    emailsReq = emailsReq.in('placement', placementKeys);
  }

  let opensReq = sb
    .from('sponsor_email_open_daily')
    .select('day, company_name, open_count')
    .gte('day', fromDay)
    .lte('day', toDay)
    .limit(REPORT_ROW_CAP);
  if (companyFilter) {
    const exact = companyExactFilter(companyFilter);
    opensReq = opensReq.ilike('company_name', exact);
  }

  let emailClicksReq = sb
    .from('sponsor_email_click_daily')
    .select('day, company_name, click_count')
    .gte('day', fromDay)
    .lte('day', toDay)
    .limit(REPORT_ROW_CAP);
  if (companyFilter) {
    const exact = companyExactFilter(companyFilter);
    emailClicksReq = emailClicksReq.ilike('company_name', exact);
  }

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

  let clickRows = clicksRes.data || [];
  if (filterMeta.includeLegacyByPath && filterMeta.directory) {
    const exact = new Set(placementKeys);
    clickRows = clickRows.filter(function (row) {
      const place = normalizePlacement(row.placement);
      if (exact.has(place)) return true;
      if (!isLegacyPagePartnerPlacement(place)) return false;
      return pathMatchesPagePartnerDirectory(row.path, filterMeta.directory);
    });
  }

  const impressionRows = impressionsRes.error ? [] : impressionsRes.data || [];
  const emailRows = emailsRes.error ? [] : emailsRes.data || [];
  const openRows = opensRes.error ? [] : opensRes.data || [];
  const emailClickRows = emailClicksRes.error ? [] : emailClicksRes.data || [];

  const pageVisits = impressionRows.reduce((n, r) => n + (Number(r.impressions) || 0), 0);
  const emailSends = emailRows.reduce((n, r) => n + (Number(r.send_count) || 0), 0);
  const clicks = clickRows.length;
  const emailLogoClicks = clickRows.filter((r) => isEmailClickRow(r)).length;
  const siteClicks = clicks - emailLogoClicks;
  const resendOpens = openRows.reduce((n, r) => n + (Number(r.open_count) || 0), 0);
  const resendAnyLinkClicks = emailClickRows.reduce((n, r) => n + (Number(r.click_count) || 0), 0);
  const siteCtr = pageVisits > 0 && siteClicks > 0 ? siteClicks / pageVisits : null;
  const emailCtr = emailSends > 0 && emailLogoClicks > 0 ? emailLogoClicks / emailSends : null;
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
      siteClicks,
      emailLogoClicks,
      emailAnyLinkClicks: resendAnyLinkClicks,
      siteCtr,
      siteCtrPct: siteCtr == null ? null : Math.round(siteCtr * 10000) / 100,
      ctrPct: siteCtr == null ? null : Math.round(siteCtr * 10000) / 100,
      emailClicks: emailLogoClicks,
      emailCtr,
      emailCtrPct: emailCtr == null ? null : Math.round(emailCtr * 10000) / 100,
      emailOpens: resendOpens,
      emailOpenRate: openRate,
      emailOpenRatePct: openRate == null ? null : Math.round(openRate * 10000) / 100,
    },
  };
}

async function listSponsorBrands(sb) {
  if (!sb) {
    if (!isSupabaseConfigured()) return [];
    sb = getSupabaseAdmin();
  }
  const [catalog, metricNames] = await Promise.all([
    collectBrandCatalog(sb),
    listMetricBrandNames(sb),
  ]);
  metricNames.forEach(function (name) {
    upsertBrandEntry(catalog, name, { active: true, placements: [] });
  });
  return Array.from(catalog.values())
    .sort(function (a, b) {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.company.localeCompare(b.company);
    })
    .map(function (b) {
      return b.company;
    });
}

async function lookupBrandLogo(sb, companyFilter) {
  if (!companyFilter) return null;
  const exactKey = companyExactFilter(companyFilter).toLowerCase();
  const catalog = await collectBrandCatalog(sb);
  const fromCatalog = catalog.get(exactKey);
  if (fromCatalog) {
    return {
      company: fromCatalog.company,
      logoUrl: fromCatalog.logoUrl || null,
      slot: fromCatalog.slot || null,
      directory: fromCatalog.directory || directoryFromSlot(fromCatalog.slot) || 'events',
      logoBandDark: fromCatalog.logoBandDark === true,
      placements: fromCatalog.placements || [],
    };
  }

  const { data, error } = await sb
    .from('cms_blocks')
    .select('company_name, logo_url, image_url, slot, active, logo_band_dark')
    .ilike('company_name', companyExactFilter(companyFilter))
    .order('updated_at', { ascending: false })
    .limit(12);

  if (error || !data || !data.length) return null;

  const ranked = data
    .slice()
    .sort((a, b) => scoreLogoCandidate(b, companyFilter) - scoreLogoCandidate(a, companyFilter));
  const preferred = ranked[0];
  const logo = String(preferred.logo_url || preferred.image_url || '').trim();
  const company = String(preferred.company_name || '').trim() || companyFilter;
  const logoBandDark = preferred.logo_band_dark === true;
  const slot = String(preferred.slot || '').trim() || null;

  if (!company && !logo) return null;
  return {
    company,
    logoUrl: logo || null,
    slot,
    directory: directoryFromSlot(slot) || 'events',
    logoBandDark,
    placements: slot ? [normalizePlacement(slot)] : [],
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
  const prev = previousPeriodBounds(from, to);

  const sb = getSupabaseAdmin();

  const [catalog, current, previousRaw, brand, brands] = await Promise.all([
    collectBrandCatalog(sb),
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
    listSponsorBrands(sb),
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

  const byPlacement = countBy(clickRows, (r) => r.placement).map((r) => ({
    placement: r.key,
    count: r.count,
  }));
  const directory = resolvePackDirectory({
    brand,
    placementFilter,
    byPlacement,
  });
  const brandOut = brand
    ? Object.assign({}, brand, { directory: brand.directory || directory })
    : companyFilter
      ? {
          company: companyFilter,
          logoUrl: null,
          slot: null,
          directory,
          logoBandDark: false,
          placements: [],
        }
      : null;

  const catalogEntry = companyFilter
    ? catalog.get(companyExactFilter(companyFilter).toLowerCase()) || null
    : null;
  const brandSurfaces = buildBrandSurfaces(companyFilter, catalogEntry, current);

  const logoClicks = current.summary.emailLogoClicks;
  const anyLinkClicks = current.summary.emailAnyLinkClicks;
  const emailEngagementNote = (function () {
    const logoNote =
      'Logo CTR counts taps on the sponsor logo in email (via /api/sponsor-out) — not booking buttons or other links.';
    if (!current.emailOpensAvailable) {
      return logoNote + ' Open rates need the Resend webhook at /api/resend-webhook.';
    }
    if (anyLinkClicks > logoClicks) {
      return (
        logoNote +
        ' Resend logged ' +
        formatNum(anyLinkClicks) +
        ' click' +
        (anyLinkClicks === 1 ? '' : 's') +
        ' on any email link — those are not included in Logo CTR.'
      );
    }
    if (current.summary.emailOpens > 0) {
      return logoNote + ' Opens come from Resend open tracking.';
    }
    return logoNote + ' Opens and logo taps update as sponsored emails go out.';
  })();

  return {
    ok: true,
    configured: true,
    from,
    to,
    directory,
    placementFilter: placementFilter || '',
    brand: brandOut,
    brands,
    brandSurfaces,
    configuredPlacements: catalogEntry ? catalogEntry.placements || [] : [],
    hubLogoUrl: '/assets/logo-nav-transparent.png',
    contact: {
      name: 'Rosie McGilvray',
      email: 'rosie@thenetworkeruk.com',
      label: 'Questions about this pack?',
    },
    executiveSummary,
    summary: current.summary,
    previous,
    emailEngagement: {
      sends: emailSends,
      opens: current.summary.emailOpens,
      openRatePct: current.summary.emailOpenRatePct,
      logoClicks,
      clicks: logoClicks,
      anyLinkClicks,
      ctrPct: current.summary.emailCtrPct,
      logoCtrPct: current.summary.emailCtrPct,
      opensConfigured: current.emailOpensAvailable === true,
      clicksConfigured: current.emailClicksAvailable === true,
      note: emailEngagementNote,
    },
    tablesPartial: current.tablesPartial,
    total: clicks,
    truncated: clickRows.length >= REPORT_ROW_CAP,
    byPlacement,
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
