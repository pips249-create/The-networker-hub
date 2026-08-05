const { isEventStarted } = require('./event-timezone');
const { applyPrepaidTermDiscount } = require('./sponsorship-term-discounts');

const FEATURED_MONTH_DAYS = 30;
const FEATURED_DEFAULT_MONTHLY_PENCE = 5500;
/** Floor when spotlight inventory is scarce (≤ FEATURED_SCARCE_AVAILABLE_THRESHOLD left). */
const FEATURED_DEFAULT_MIN_PENCE = 1000;
/** Soft floor when slots are open — prefer fill rate over protecting ARPU. */
const FEATURED_DEFAULT_OPEN_MIN_PENCE = 500;
/** Match published-page scarcity copy (warns at 1–3 places left). */
const FEATURED_SCARCE_AVAILABLE_THRESHOLD = 3;

function parseEnvPence(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function featuredMonthlyPricePence() {
  return parseEnvPence('FEATURED_LISTING_MONTHLY_PENCE', FEATURED_DEFAULT_MONTHLY_PENCE);
}

function featuredMinPricePence() {
  return parseEnvPence('FEATURED_LISTING_MIN_PENCE', FEATURED_DEFAULT_MIN_PENCE);
}

function featuredOpenMinPricePence() {
  return parseEnvPence('FEATURED_LISTING_OPEN_MIN_PENCE', FEATURED_DEFAULT_OPEN_MIN_PENCE);
}

/**
 * Pick the prorated floor from remaining spotlight slots.
 * Unknown availability defaults to the scarce (higher) floor.
 * @param {number|null|undefined} slotsAvailable
 */
function featuredMinPricePenceForSlots(slotsAvailable) {
  const scarceMin = featuredMinPricePence();
  const openMin = Math.min(featuredOpenMinPricePence(), scarceMin);
  if (slotsAvailable == null || !Number.isFinite(Number(slotsAvailable))) {
    return scarceMin;
  }
  if (Number(slotsAvailable) <= FEATURED_SCARCE_AVAILABLE_THRESHOLD) {
    return scarceMin;
  }
  return openMin;
}

function formatGbp(pence) {
  const n = Number(pence);
  if (!Number.isFinite(n)) return '£0.00';
  return '£' + (n / 100).toFixed(2);
}

function featuredPlanAmountPence(months) {
  const m = Math.max(1, Math.floor(Number(months) || 1));
  const list = featuredMonthlyPricePence() * m;
  return applyPrepaidTermDiscount(list, m).netPence;
}

function buildFeaturedPlan(months, label) {
  const amountPence = featuredPlanAmountPence(months);
  const discounted = applyPrepaidTermDiscount(featuredMonthlyPricePence() * months, months);
  return {
    label,
    days: FEATURED_MONTH_DAYS * months,
    months,
    amountPence,
    listAmountPence: discounted.listPence,
    discountPercent: discounted.discountPercent,
    displayPrice: formatGbp(amountPence),
  };
}

const FEATURED_PLANS = {
  '1month': buildFeaturedPlan(1, '1 month'),
  '3months': buildFeaturedPlan(3, '3 months'),
  '6months': buildFeaturedPlan(6, '6 months'),
  '12months': buildFeaturedPlan(12, '12 months'),
  /** @deprecated Legacy plans — checkout UI offers 1 / 3 / 6 / 12 months; kept for older sessions */
  '1week': { label: '1 week', days: 7, months: 0, amountPence: 2000, displayPrice: '£20.00', discountPercent: 0 },
  '2months': { label: '2 months', days: 60, months: 2, amountPence: 10000, displayPrice: '£100.00', discountPercent: 0 },
};

const PLAN_ALIASES = {
  '4weeks': '1month',
  yearly: '12months',
  year: '12months',
  annual: '12months',
};

function normalizePlanId(planId) {
  const key = String(planId || '').trim().toLowerCase();
  if (!key) return '1month';
  const resolved = PLAN_ALIASES[key] || key;
  return FEATURED_PLANS[resolved] ? resolved : '1month';
}

function isEventCurrentlyFeatured(row) {
  if (!row || !row.featured) return false;
  if (isEventStarted(row)) return false;
  if (!row.featured_until) return true;
  const until = new Date(row.featured_until);
  return !Number.isNaN(until.getTime()) && until > new Date();
}

function computeFeaturedUntil(currentUntil, planDays, eventStartsAt) {
  const now = Date.now();
  let base = now;
  if (currentUntil) {
    const existing = new Date(currentUntil).getTime();
    if (!Number.isNaN(existing) && existing > now) base = existing;
  }
  let untilMs = base + planDays * 24 * 60 * 60 * 1000;

  const startMs = eventStartsAt ? new Date(eventStartsAt).getTime() : NaN;
  if (Number.isFinite(startMs) && startMs > now && startMs < untilMs) {
    untilMs = startMs;
  }

  return new Date(untilMs).toISOString();
}

function previewFeaturedPlacement({ currentUntil, planId, eventStartsAt } = {}) {
  const resolvedPlanId = normalizePlanId(planId);
  const plan = FEATURED_PLANS[resolvedPlanId];
  const planDays = plan ? plan.days : 30;
  const now = Date.now();
  let base = now;
  if (currentUntil) {
    const existing = new Date(currentUntil).getTime();
    if (!Number.isNaN(existing) && existing > now) base = existing;
  }
  const plannedUntilMs = base + planDays * 24 * 60 * 60 * 1000;
  const featuredUntil = computeFeaturedUntil(currentUntil, planDays, eventStartsAt);
  const startMs = eventStartsAt ? new Date(eventStartsAt).getTime() : NaN;
  const cappedByEvent =
    Number.isFinite(startMs) && startMs > now && startMs < plannedUntilMs;

  return {
    featuredUntil,
    cappedByEvent,
    planId: resolvedPlanId,
    planLabel: plan ? plan.label : '1 month',
    planDays,
  };
}

function visibleDaysUntilFeaturedEnd(featuredUntil, at) {
  const now = at instanceof Date ? at.getTime() : Date.now();
  const untilMs = new Date(featuredUntil).getTime();
  if (Number.isNaN(untilMs) || untilMs <= now) return 1;
  return Math.max(1, Math.ceil((untilMs - now) / 86400000));
}

function calculateFeaturedListingQuote({
  currentUntil,
  planId,
  eventStartsAt,
  slotsAvailable,
} = {}) {
  const placement = previewFeaturedPlacement({ currentUntil, planId, eventStartsAt });
  const plan = FEATURED_PLANS[placement.planId] || FEATURED_PLANS['1month'];
  const fullPricePence = plan.amountPence;
  const minPricePence = featuredMinPricePenceForSlots(slotsAvailable);
  const visibleDays = visibleDaysUntilFeaturedEnd(placement.featuredUntil);
  const planMonths = Math.max(1, Math.round((plan.days || FEATURED_MONTH_DAYS) / FEATURED_MONTH_DAYS));

  if (!placement.cappedByEvent || fullPricePence <= 0) {
    const saveNote =
      plan.discountPercent > 0 ? ' Save ' + plan.discountPercent + '% vs monthly.' : '';
    return {
      ...placement,
      amountPence: fullPricePence,
      displayPrice: formatGbp(fullPricePence),
      pricingMode: fullPricePence > 0 ? 'full_term' : 'dev_free',
      visibleDays: placement.planDays,
      minPricePence,
      discountPercent: plan.discountPercent || 0,
      pricingNote:
        fullPricePence > 0
          ? planMonths === 1
            ? 'Full month — up to 30 days on the browse page.'
            : plan.label +
              ' — up to ' +
              plan.days +
              ' days on the browse page.' +
              saveNote
          : 'Test checkout — no charge in this environment.',
      lineItemDescription:
        planMonths === 1
          ? 'Premium spotlight — up to 1 month on the events browse page'
          : 'Premium spotlight — ' +
            plan.label +
            ' on the events browse page' +
            (plan.discountPercent > 0 ? ' (' + plan.discountPercent + '% off)' : ''),
    };
  }

  const prorated = Math.round((visibleDays / Math.max(1, plan.days)) * fullPricePence);
  const amountPence = Math.min(fullPricePence, Math.max(minPricePence, prorated));

  return {
    ...placement,
    amountPence,
    displayPrice: formatGbp(amountPence),
    pricingMode: 'prorated',
    visibleDays,
    minPricePence,
    pricingNote:
      'Price covers ' +
      visibleDays +
      ' day' +
      (visibleDays === 1 ? '' : 's') +
      ' until your event leaves the browse page (min ' +
      formatGbp(minPricePence) +
      ').',
    lineItemDescription:
      'Premium spotlight — ' +
      visibleDays +
      ' day' +
      (visibleDays === 1 ? '' : 's') +
      ' until your event',
  };
}

module.exports = {
  FEATURED_MONTH_DAYS,
  FEATURED_DEFAULT_MONTHLY_PENCE,
  FEATURED_DEFAULT_MIN_PENCE,
  FEATURED_DEFAULT_OPEN_MIN_PENCE,
  FEATURED_SCARCE_AVAILABLE_THRESHOLD,
  FEATURED_PLANS,
  featuredMonthlyPricePence,
  featuredMinPricePence,
  featuredOpenMinPricePence,
  featuredMinPricePenceForSlots,
  formatGbp,
  normalizePlanId,
  isEventCurrentlyFeatured,
  computeFeaturedUntil,
  previewFeaturedPlacement,
  calculateFeaturedListingQuote,
};
