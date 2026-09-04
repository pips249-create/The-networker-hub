/**
 * County Sponsor placements on Events county hubs (/networking/:county).
 * Logo + link only — website placement, not included in hub emails.
 * Slot prefix: networking_county_partner_*
 */
const { NETWORKING_REGIONS } = require('./networking-regions');
const { isPublishableSponsorBlock } = require('./cms-sponsor-fields');
const { applyPrepaidTermDiscount } = require('./sponsorship-term-discounts');

const COUNTY_PARTNER_SLOT_PREFIX = 'networking_county_partner_';
const LAUNCH_END_ISO = '2026-12-01T00:00:00.000Z';
const COUNTY_PARTNER_VAT_RATE = 0.2;
const COUNTY_PARTNER_PREPAID_TERMS = [6, 12];
const COUNTY_PARTNER_PREPAID_TERMS_LEGACY = [1, 3, 6, 12];

const LAUNCH_PRICING = {
  singleMonthlyPence: 4900,
  singleLabel: '£49',
};

const REGULAR_PRICING = {
  singleMonthlyPence: 9900,
  singleLabel: '£99',
};

function normalizeCountyPartnerTerm(value) {
  const raw = String(value == null ? '' : value).trim().toLowerCase();
  if (!raw || raw === 'monthly' || raw === 'month' || raw === 'rolling' || raw === '0') {
    return { billingMode: 'monthly', termMonths: null };
  }
  if (raw === 'yearly' || raw === 'year' || raw === 'annual' || raw === 'annually') {
    return { billingMode: 'prepaid', termMonths: 12 };
  }
  const n = parseInt(raw, 10);
  if (COUNTY_PARTNER_PREPAID_TERMS_LEGACY.includes(n)) {
    return { billingMode: 'prepaid', termMonths: n };
  }
  return { billingMode: 'monthly', termMonths: null };
}

function isOfferedCountyPartnerCheckoutTerm(term) {
  const normalized = normalizeCountyPartnerTerm(term);
  if (normalized.billingMode === 'monthly') return true;
  return COUNTY_PARTNER_PREPAID_TERMS.includes(normalized.termMonths);
}

function addMonthsUtc(baseDate, months) {
  const d = new Date(baseDate);
  const m = Math.max(0, Math.floor(Number(months) || 0));
  d.setUTCMonth(d.getUTCMonth() + m);
  return d;
}

function isPrepaidCountyPartnerHoldId(subscriptionId) {
  return String(subscriptionId || '')
    .trim()
    .toLowerCase()
    .startsWith('prepaid:');
}

function countyPartnerSlotKey(slug) {
  return COUNTY_PARTNER_SLOT_PREFIX + String(slug || '').trim().toLowerCase();
}

function parseCountyPartnerSlot(slot) {
  const key = String(slot || '').trim();
  if (!key.startsWith(COUNTY_PARTNER_SLOT_PREFIX)) return null;
  const slug = key.slice(COUNTY_PARTNER_SLOT_PREFIX.length);
  const region = NETWORKING_REGIONS[slug];
  if (!region || region.areaType !== 'county') return null;
  return { slug, slot: key, region };
}

function isCountyPartnerSlot(slot) {
  return Boolean(parseCountyPartnerSlot(slot));
}

function listCountyPartnerRegions() {
  return Object.keys(NETWORKING_REGIONS)
    .filter((slug) => NETWORKING_REGIONS[slug].areaType === 'county')
    .map((slug) => ({
      slug,
      name: NETWORKING_REGIONS[slug].name,
      slot: countyPartnerSlotKey(slug),
      path: '/networking/' + slug,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' }));
}

function isLaunchPricingActive(now = new Date()) {
  return now.getTime() < new Date(LAUNCH_END_ISO).getTime();
}

function activePricing(now = new Date()) {
  return isLaunchPricingActive(now) ? LAUNCH_PRICING : REGULAR_PRICING;
}

function calculateCountyPartnerQuote(countyCount, now = new Date(), term = null) {
  const count = Math.max(0, Math.floor(Number(countyCount) || 0));
  const pricing = activePricing(now);
  const monthlyPence = count * pricing.singleMonthlyPence;
  const { billingMode, termMonths } = normalizeCountyPartnerTerm(term);
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
  const vatPence = Math.round(subtotalExVatPence * COUNTY_PARTNER_VAT_RATE);
  return {
    countyCount: count,
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

function normalizeCountySlugs(input) {
  const raw = Array.isArray(input) ? input : String(input || '').split(/[,\s]+/);
  const out = [];
  const seen = new Set();
  raw.forEach((item) => {
    const slug = String(item || '').trim().toLowerCase();
    const region = NETWORKING_REGIONS[slug];
    if (!slug || !region || region.areaType !== 'county' || seen.has(slug)) return;
    seen.add(slug);
    out.push(slug);
  });
  return out;
}

async function fetchCountyPartnerRows(sb) {
  const slots = listCountyPartnerRegions().map((r) => r.slot);
  const res = await sb.from('cms_blocks').select('*').in('slot', slots);
  if (res.error) throw new Error(res.error.message);
  return new Map((res.data || []).map((row) => [row.slot, row]));
}

function parseAvailableFrom(row) {
  const raw = row?.sponsor_available_from;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function hasActiveCountyHold(row, now = new Date()) {
  if (!row) return false;
  if (isPublishableSponsorBlock(row, row.slot)) return true;

  const subscriptionId = String(row.sponsor_subscription_id || '').trim();
  if (!subscriptionId) return false;

  const availableFrom = parseAvailableFrom(row);
  if (!availableFrom) return true;
  return availableFrom.getTime() > now.getTime();
}

function countyPartnerStatus(row, now = new Date()) {
  const availableFrom = parseAvailableFrom(row);
  if (availableFrom && availableFrom.getTime() <= now.getTime()) {
    return 'available';
  }
  if (isPublishableSponsorBlock(row, row?.slot)) return 'live';
  if (!hasActiveCountyHold(row, now)) return 'available';

  if (availableFrom && availableFrom.getTime() > now.getTime()) {
    return 'booked_until';
  }
  return 'booked';
}

function countyPartnerAvailabilityFields(row, status, now = new Date()) {
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

async function getCountyPartnerAvailability(sb) {
  const bySlot = await fetchCountyPartnerRows(sb);
  const pricing = activePricing();
  const counties = listCountyPartnerRegions().map((region) => {
    const row = bySlot.get(region.slot) || null;
    const status = countyPartnerStatus(row);
    return {
      ...region,
      ...countyPartnerAvailabilityFields(row, status),
    };
  });

  return {
    launchEnds: LAUNCH_END_ISO,
    isLaunch: pricing === LAUNCH_PRICING,
    pricing: {
      singleMonthlyGbp: pricing.singleMonthlyPence / 100,
      singleLabel: pricing.singleLabel,
      regularSingleLabel: REGULAR_PRICING.singleLabel,
      vatRate: COUNTY_PARTNER_VAT_RATE,
      prepaidTerms: COUNTY_PARTNER_PREPAID_TERMS.slice(),
      termNote:
        'Pay monthly and cancel any time, or prepay 6 or 12 months — 10% off 6 months, 15% off yearly.',
      prepaidDiscounts: { 6: 10, 12: 15 },
    },
    counties,
    cities: counties,
    availableCounties: counties.filter((c) => c.available),
    availableCities: counties.filter((c) => c.available),
    liveCounties: counties.filter((c) => c.live),
    bookedCounties: counties.filter((c) => c.booked),
    bookedCities: counties.filter((c) => c.booked),
  };
}

function validateCheckoutCounties(slugs, availability, term = null) {
  const normalized = normalizeCountySlugs(slugs);
  if (!normalized.length) {
    return { ok: false, error: 'no_counties_selected' };
  }
  if (normalized.length > 20) {
    return { ok: false, error: 'too_many_counties' };
  }

  const availableSet = new Set(
    (availability.availableCounties || availability.availableCities || []).map((c) => c.slug)
  );
  const unavailable = normalized.filter((slug) => !availableSet.has(slug));
  if (unavailable.length) {
    return {
      ok: false,
      error: 'counties_unavailable',
      unavailable,
      message: 'One or more counties are no longer available: ' + unavailable.join(', '),
    };
  }

  if (!isOfferedCountyPartnerCheckoutTerm(term)) {
    return {
      ok: false,
      error: 'invalid_term',
      message: 'Choose monthly, 6 months, or yearly.',
    };
  }

  return {
    ok: true,
    counties: normalized,
    cities: normalized,
    quote: calculateCountyPartnerQuote(normalized.length, new Date(), term),
  };
}

module.exports = {
  COUNTY_PARTNER_SLOT_PREFIX,
  LAUNCH_END_ISO,
  LAUNCH_PRICING,
  REGULAR_PRICING,
  COUNTY_PARTNER_VAT_RATE,
  COUNTY_PARTNER_PREPAID_TERMS,
  countyPartnerSlotKey,
  parseCountyPartnerSlot,
  isCountyPartnerSlot,
  listCountyPartnerRegions,
  isLaunchPricingActive,
  activePricing,
  normalizeCountyPartnerTerm,
  isOfferedCountyPartnerCheckoutTerm,
  addMonthsUtc,
  isPrepaidCountyPartnerHoldId,
  calculateCountyPartnerQuote,
  normalizeCountySlugs,
  getCountyPartnerAvailability,
  validateCheckoutCounties,
  countyPartnerStatus,
  countyPartnerAvailabilityFields,
  hasActiveCountyHold,
  parseAvailableFrom,
};
