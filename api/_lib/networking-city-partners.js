/**
 * City Partner placements on Events regional landing pages (/networking/:region).
 * Logo + CTA only — website placement, not included in hub emails.
 * County Sponsor uses networking_county_partner_* on Events county hubs.
 */
const { NETWORKING_REGIONS } = require('./networking-regions');
const { isPublishableSponsorBlock } = require('./cms-sponsor-fields');
const { applyPrepaidTermDiscount } = require('./sponsorship-term-discounts');

const CITY_PARTNER_SLOT_PREFIX = 'networking_city_partner_';
const LAUNCH_END_ISO = '2026-12-01T00:00:00.000Z';
const CITY_PARTNER_VAT_RATE = 0.2;
/** Prepaid fixed terms offered alongside rolling monthly. */
const CITY_PARTNER_PREPAID_TERMS = [1, 3, 6, 12];

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

/**
 * @param {unknown} value — 'monthly' | 1 | 3 | 6 | '1' | …
 * @returns {{ billingMode: 'monthly'|'prepaid', termMonths: number|null }}
 */
function normalizeCityPartnerTerm(value) {
  const raw = String(value == null ? '' : value).trim().toLowerCase();
  if (!raw || raw === 'monthly' || raw === 'month' || raw === 'rolling' || raw === '0') {
    return { billingMode: 'monthly', termMonths: null };
  }
  if (raw === 'yearly' || raw === 'year' || raw === 'annual' || raw === 'annually') {
    return { billingMode: 'prepaid', termMonths: 12 };
  }
  const n = parseInt(raw, 10);
  if (CITY_PARTNER_PREPAID_TERMS.includes(n)) {
    return { billingMode: 'prepaid', termMonths: n };
  }
  return { billingMode: 'monthly', termMonths: null };
}

function addMonthsUtc(baseDate, months) {
  const d = new Date(baseDate);
  const m = Math.max(0, Math.floor(Number(months) || 0));
  d.setUTCMonth(d.getUTCMonth() + m);
  return d;
}

function isPrepaidCityPartnerHoldId(subscriptionId) {
  return String(subscriptionId || '')
    .trim()
    .toLowerCase()
    .startsWith('prepaid:');
}

function cityPartnerSlotKey(slug) {
  return CITY_PARTNER_SLOT_PREFIX + String(slug || '').trim().toLowerCase();
}

function parseCityPartnerSlot(slot) {
  const key = String(slot || '').trim();
  if (!key.startsWith(CITY_PARTNER_SLOT_PREFIX)) return null;
  const slug = key.slice(CITY_PARTNER_SLOT_PREFIX.length);
  const region = NETWORKING_REGIONS[slug];
  if (!region || region.areaType === 'county') return null;
  return { slug, slot: key, region };
}

function isCityPartnerSlot(slot) {
  return Boolean(parseCityPartnerSlot(slot));
}

function listCityPartnerRegions() {
  return Object.keys(NETWORKING_REGIONS)
    .filter((slug) => NETWORKING_REGIONS[slug].areaType !== 'county')
    .map((slug) => ({
      slug,
      name: NETWORKING_REGIONS[slug].name,
      slot: cityPartnerSlotKey(slug),
      path: '/networking/' + slug,
    }));
}

function listCountyPartnerRegions() {
  return Object.keys(NETWORKING_REGIONS)
    .filter((slug) => NETWORKING_REGIONS[slug].areaType === 'county')
    .map((slug) => ({
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
 * @param {number} cityCount
 * @param {Date} [now]
 * @param {unknown} [term] — monthly | 1 | 3 | 6
 */
function calculateCityPartnerQuote(cityCount, now = new Date(), term = null) {
  const count = Math.max(0, Math.floor(Number(cityCount) || 0));
  const pricing = activePricing(now);
  const bundles = Math.floor(count / 3);
  const singles = count % 3;
  const monthlyPence =
    bundles * pricing.bundle3MonthlyPence + singles * pricing.singleMonthlyPence;
  const { billingMode, termMonths } = normalizeCityPartnerTerm(term);
  const billableMonths = billingMode === 'prepaid' ? termMonths : 1;
  const listSubtotalExVatPence = monthlyPence * billableMonths;
  const discounted =
    billingMode === 'prepaid'
      ? applyPrepaidTermDiscount(listSubtotalExVatPence, termMonths)
      : {
          listPence: listSubtotalExVatPence,
          discountPercent: 0,
          discountPence: 0,
          netPence: listSubtotalExVatPence,
        };
  const subtotalExVatPence = discounted.netPence;
  const vatPence = Math.round(subtotalExVatPence * CITY_PARTNER_VAT_RATE);
  return {
    cityCount: count,
    bundles,
    singles,
    billingMode,
    termMonths,
    monthlyPence,
    monthlyGbp: monthlyPence / 100,
    listSubtotalExVatPence: discounted.listPence,
    discountPercent: discounted.discountPercent,
    discountPence: discounted.discountPence,
    subtotalExVatPence,
    vatPence,
    totalPence: subtotalExVatPence + vatPence,
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
    const region = NETWORKING_REGIONS[slug];
    if (!slug || !region || region.areaType === 'county' || seen.has(slug)) return;
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

function parseAvailableFrom(row) {
  const raw = row?.sponsor_available_from;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function hasActiveCityHold(row, now = new Date()) {
  if (!row) return false;
  if (isPublishableSponsorBlock(row, row.slot)) return true;

  const subscriptionId = String(row.sponsor_subscription_id || '').trim();
  if (!subscriptionId) return false;

  const availableFrom = parseAvailableFrom(row);
  if (!availableFrom) return true;
  return availableFrom.getTime() > now.getTime();
}

function cityPartnerStatus(row, now = new Date()) {
  const availableFrom = parseAvailableFrom(row);
  // Prepaid (and cancelled-sub) terms end at sponsor_available_from — stop showing live creative.
  if (availableFrom && availableFrom.getTime() <= now.getTime()) {
    return 'available';
  }
  if (isPublishableSponsorBlock(row, row?.slot)) return 'live';
  if (!hasActiveCityHold(row, now)) return 'available';

  if (availableFrom && availableFrom.getTime() > now.getTime()) {
    return 'booked_until';
  }
  return 'booked';
}

function cityPartnerAvailabilityFields(row, status, now = new Date()) {
  const availableFrom = parseAvailableFrom(row);
  const availableFromIso =
    availableFrom && availableFrom.getTime() > now.getTime()
      ? availableFrom.toISOString()
      : null;

  return {
    status,
    live: status === 'live',
    available: status === 'available',
    booked: status === 'live' || status === 'booked' || status === 'booked_until',
    availableFrom: availableFromIso,
    sponsorEmail: row?.sponsor_email || null,
  };
}

async function getCityPartnerAvailability(sb) {
  const bySlot = await fetchCityPartnerRows(sb);
  const pricing = activePricing();
  const cities = listCityPartnerRegions().map((region) => {
    const row = bySlot.get(region.slot) || null;
    const status = cityPartnerStatus(row);
    return {
      ...region,
      ...cityPartnerAvailabilityFields(row, status),
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
      vatRate: CITY_PARTNER_VAT_RATE,
      prepaidTerms: CITY_PARTNER_PREPAID_TERMS.slice(),
      bundleNote: 'Every 3 cities automatically use the 3-city pack rate; any remainder is charged per city.',
      termNote:
        'Pay monthly and cancel any time, or prepay 1, 3, 6 or 12 months — 5% off 3 months, 10% off 6 months, 15% off yearly.',
      prepaidDiscounts: { 3: 5, 6: 10, 12: 15 },
    },
    cities,
    availableCities: cities.filter((c) => c.available),
    liveCities: cities.filter((c) => c.live),
    bookedCities: cities.filter((c) => c.booked),
    openingSoonCities: cities.filter((c) => c.status === 'booked_until'),
  };
}

function validateCheckoutCities(slugs, availability, term = null) {
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

  return {
    ok: true,
    cities: normalized,
    quote: calculateCityPartnerQuote(normalized.length, new Date(), term),
  };
}

module.exports = {
  CITY_PARTNER_SLOT_PREFIX,
  LAUNCH_END_ISO,
  LAUNCH_PRICING,
  REGULAR_PRICING,
  CITY_PARTNER_VAT_RATE,
  CITY_PARTNER_PREPAID_TERMS,
  cityPartnerSlotKey,
  parseCityPartnerSlot,
  isCityPartnerSlot,
  listCityPartnerRegions,
  listCountyPartnerRegions,
  isLaunchPricingActive,
  activePricing,
  normalizeCityPartnerTerm,
  addMonthsUtc,
  isPrepaidCityPartnerHoldId,
  calculateCityPartnerQuote,
  normalizeCitySlugs,
  getCityPartnerAvailability,
  validateCheckoutCities,
  cityPartnerStatus,
  cityPartnerAvailabilityFields,
  hasActiveCityHold,
  parseAvailableFrom,
};
