const FEATURED_PLANS = {
  '1week': { label: '1 week', days: 7, amountPence: 1500, displayPrice: '£15.00' },
  '4weeks': { label: '4 weeks', days: 28, amountPence: 5500, displayPrice: '£55.00' },
  '2months': { label: '2 months', days: 60, amountPence: 10000, displayPrice: '£100.00' },
};

function normalizePlanId(planId) {
  const key = String(planId || '').trim().toLowerCase();
  return FEATURED_PLANS[key] ? key : '';
}

function isEventCurrentlyFeatured(row) {
  if (!row || !row.featured) return false;
  if (!row.featured_until) return true;
  const until = new Date(row.featured_until);
  return !Number.isNaN(until.getTime()) && until > new Date();
}

function computeFeaturedUntil(currentUntil, planDays) {
  const now = Date.now();
  let base = now;
  if (currentUntil) {
    const existing = new Date(currentUntil).getTime();
    if (!Number.isNaN(existing) && existing > now) base = existing;
  }
  return new Date(base + planDays * 24 * 60 * 60 * 1000).toISOString();
}

module.exports = {
  FEATURED_PLANS,
  normalizePlanId,
  isEventCurrentlyFeatured,
  computeFeaturedUntil,
};
