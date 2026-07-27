const { isEventStarted } = require('./event-timezone');

const FEATURED_MONTH_DAYS = 30;
const FEATURED_DEFAULT_MONTHLY_PENCE = 5500;
const FEATURED_DEFAULT_MIN_PENCE = 1000;

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

function formatGbp(pence) {
  const n = Number(pence);
  if (!Number.isFinite(n)) return '£0.00';
  return '£' + (n / 100).toFixed(2);
}

const FEATURED_PLANS = {
  '1month': {
    label: '1 month',
    days: FEATURED_MONTH_DAYS,
    amountPence: featuredMonthlyPricePence(),
    displayPrice: formatGbp(featuredMonthlyPricePence()),
  },
  /** @deprecated Legacy plans — checkout UI offers 1 month only; kept for older sessions */
  '1week': { label: '1 week', days: 7, amountPence: 2000, displayPrice: '£20.00' },
  '2months': { label: '2 months', days: 60, amountPence: 10000, displayPrice: '£100.00' },
};

const PLAN_ALIASES = {
  '4weeks': '1month',
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

function calculateFeaturedListingQuote({ currentUntil, planId, eventStartsAt } = {}) {
  const placement = previewFeaturedPlacement({ currentUntil, planId, eventStartsAt });
  const fullPricePence = featuredMonthlyPricePence();
  const minPricePence = featuredMinPricePence();
  const visibleDays = visibleDaysUntilFeaturedEnd(placement.featuredUntil);

  if (!placement.cappedByEvent || fullPricePence <= 0) {
    return {
      ...placement,
      amountPence: fullPricePence,
      displayPrice: formatGbp(fullPricePence),
      pricingMode: fullPricePence > 0 ? 'full_month' : 'dev_free',
      visibleDays: placement.planDays,
      pricingNote:
        fullPricePence > 0
          ? 'Full month — up to 30 days on the browse page.'
          : 'Test checkout — no charge in this environment.',
      lineItemDescription: 'Premium spotlight — up to 1 month on the events browse page',
    };
  }

  const prorated = Math.round((visibleDays / FEATURED_MONTH_DAYS) * fullPricePence);
  const amountPence = Math.min(fullPricePence, Math.max(minPricePence, prorated));

  return {
    ...placement,
    amountPence,
    displayPrice: formatGbp(amountPence),
    pricingMode: 'prorated',
    visibleDays,
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
  FEATURED_PLANS,
  featuredMonthlyPricePence,
  featuredMinPricePence,
  formatGbp,
  normalizePlanId,
  isEventCurrentlyFeatured,
  computeFeaturedUntil,
  previewFeaturedPlacement,
  calculateFeaturedListingQuote,
};
