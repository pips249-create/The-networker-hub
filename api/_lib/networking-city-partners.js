/**
 * City Partner placements on regional landing pages (/networking/:region and /opportunities/networking/:region).
 * Logo + CTA only — website placement, not included in hub emails.
 */
const { NETWORKING_REGIONS } = require('./networking-regions');
const { isPublishableSponsorBlock } = require('./cms-sponsor-fields');

const CITY_PARTNER_SLOT_PREFIX = 'networking_city_partner_';
const LAUNCH_END_ISO = '2026-12-01T00:00:00.000Z';

const LAUNCH_PRICING = {
  singleMonthlyPence: 2900,
  bundle3MonthlyPence: 7500,
  singleLabel: '£29',
  bundle3Label: '£75',
};

const REGULAR_PRICING = {
  singleMonthlyPence: 7900,
  bundle3MonthlyPence: 19900,
  singleLabel: '£79',
  bundle3Label: '£199',
};

function cityPartnerSlotKey(slug) {
  return CITY_PARTNER_SLOT_PREFIX + String(slug || '').trim().toLowerCase();
}

function parseCityPartnerSlot(slot) {
  const key = String(slot || '').trim();
  if (!key.startsWith(CITY_PARTNER_SLOT_PREFIX)) return null;
  const slug = key.slice(CITY_PARTNER_SLOT_PREFIX.length);
  if (!NETWORKING_REGIONS[slug]) return null;
  return { slug, slot: key, region: NETWORKING_REGIONS[slug] };
}

function isCityPartnerSlot(slot) {
  return Boolean(parseCityPartnerSlot(slot));
}

function listCityPartnerRegions() {
  return Object.keys(NETWORKING_REGIONS).map((slug) => ({
    slug,
    name: NETWORKING_REGIONS[slug].name,
    slot: cityPartnerSlotKey(slug),
    path: '/networking/' + slug,
  }));
}

function isLaunchPricingActive(now = new Date()) {
  return now.getTime() < new Date(LAUNCH_END_ISO).getTime();
}

function activePricing(now = new Date()) {
  return isLaunchPricingActive(now) ? LAUNCH_PRICING : REGULAR_PRICING;
}

/**
 * Bundle automation: every 3 cities use one bundle price; remainder use single price.
 * e.g. 5 cities → 1× bundle + 2× single.
 */
function calculateCityPartnerQuote(cityCount, now = new Date()) {
  const count = Math.max(0, Math.floor(Number(cityCount) || 0));
  const pricing = activePricing(now);
  const bundles = Math.floor(count / 3);
  const singles = count % 3;
  const monthlyPence =
    bundles * pricing.bundle3MonthlyPence + singles * pricing.singleMonthlyPence;
  return {
    cityCount: count,
    bundles,
    singles,
    monthlyPence,
    monthlyGbp: monthlyPence / 100,
    pricing,
    isLaunch: isLaunchPricingActive(now),
    launchEnds: LAUNCH_END_ISO,
  };
}

function normalizeCitySlugs(input) {
  const raw = Array.isArray(input) ? input : String(input || '').split(/[,\s]+/);
  const out = [];
  const seen = new Set();
  raw.forEach((item) => {
    const slug = String(item || '').trim().toLowerCase();
    if (!slug || !NETWORKING_REGIONS[slug] || seen.has(slug)) return;
    seen.add(slug);
    out.push(slug);
  });
  return out;
}

async function fetchCityPartnerRows(sb) {
  const slots = listCityPartnerRegions().map((r) => r.slot);
  const res = await sb.from('cms_blocks').select('*').in('slot', slots);
  if (res.error) throw new Error(res.error.message);
  const bySlot = new Map((res.data || []).map((row) => [row.slot, row]));
  return bySlot;
}

function cityPartnerStatus(row) {
  if (isPublishableSponsorBlock(row, row?.slot)) return 'live';
  return 'available';
}

async function getCityPartnerAvailability(sb) {
  const bySlot = await fetchCityPartnerRows(sb);
  const pricing = activePricing();
  const cities = listCityPartnerRegions().map((region) => {
    const row = bySlot.get(region.slot) || null;
    const status = cityPartnerStatus(row);
    return {
      ...region,
      status,
      live: status === 'live',
      available: status === 'available',
    };
  });

  return {
    launchEnds: LAUNCH_END_ISO,
    isLaunch: pricing === LAUNCH_PRICING,
    pricing: {
      singleMonthlyGbp: pricing.singleMonthlyPence / 100,
      bundle3MonthlyGbp: pricing.bundle3MonthlyPence / 100,
      singleLabel: pricing.singleLabel,
      bundle3Label: pricing.bundle3Label,
      regularSingleLabel: REGULAR_PRICING.singleLabel,
      regularBundle3Label: REGULAR_PRICING.bundle3Label,
      bundleNote: 'Every 3 cities automatically use the 3-city pack rate; any remainder is charged per city.',
    },
    cities,
    availableCities: cities.filter((c) => c.available),
    liveCities: cities.filter((c) => c.live),
  };
}

function validateCheckoutCities(slugs, availability) {
  const normalized = normalizeCitySlugs(slugs);
  if (!normalized.length) {
    return { ok: false, error: 'no_cities_selected' };
  }
  if (normalized.length > 20) {
    return { ok: false, error: 'too_many_cities' };
  }

  const availableSet = new Set(
    (availability.availableCities || []).map((c) => c.slug)
  );
  const unavailable = normalized.filter((slug) => !availableSet.has(slug));
  if (unavailable.length) {
    return {
      ok: false,
      error: 'cities_unavailable',
      unavailable,
      message:
        'One or more cities are no longer available: ' + unavailable.join(', '),
    };
  }

  return { ok: true, cities: normalized, quote: calculateCityPartnerQuote(normalized.length) };
}

module.exports = {
  CITY_PARTNER_SLOT_PREFIX,
  LAUNCH_END_ISO,
  LAUNCH_PRICING,
  REGULAR_PRICING,
  cityPartnerSlotKey,
  parseCityPartnerSlot,
  isCityPartnerSlot,
  listCityPartnerRegions,
  isLaunchPricingActive,
  activePricing,
  calculateCityPartnerQuote,
  normalizeCitySlugs,
  getCityPartnerAvailability,
  validateCheckoutCities,
  cityPartnerStatus,
};
