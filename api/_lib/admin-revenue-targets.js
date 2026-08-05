/**
 * Command Centre revenue targets — Jul 2026 → 1 Sep 2027.
 * Combines auto-tracked Stripe/registration revenue with manual sponsorship deals.
 */
const { registrationHubPlatformFee } = require('./booking-fees');
const { calculateOpportunityListingTotals } = require('./opportunity-listing-pricing');
const { FEATURED_PLANS } = require('./event-featured-plans');
const { isTestRegistration, isTestFixtureText } = require('./test-fixture-filters');

const PERIOD_START = '2026-07-03T00:00:00.000Z';
const PERIOD_END = '2027-09-01T00:00:00.000Z';
const PREMIUM_OPPORTUNITY_MONTHLY_GBP = 55;

const TARGET_CATEGORIES = [
  {
    id: 'events',
    label: 'Events advertising',
    description: 'Main sponsorship, premium listings & mini sponsors',
    target: 42500,
  },
  {
    id: 'opportunities',
    label: 'Business opportunities',
    description: 'Individual listings, main sponsorship, premium listings & mini sponsors',
    target: 48000,
  },
  {
    id: 'ticket_sales',
    label: 'Ticket sales (booking fees)',
    description: 'Hub platform cut on paid event tickets and organiser memberships (Stripe excluded)',
    target: 2500,
  },
  {
    id: 'browse_organisers',
    label: 'Browse organisers page',
    description: 'Main sponsorship, premium listings & mini sponsors',
    target: 10000,
  },
  {
    id: 'awards',
    label: 'Awards',
    description: 'TBC',
    target: 5000,
  },
];

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function parseMs(iso) {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function inPeriod(iso, startMs, endMs) {
  const t = parseMs(iso);
  if (t == null) return false;
  return t >= startMs && t < endMs;
}

function overlapDays(startA, endA, startB, endB) {
  const start = Math.max(startA, startB);
  const end = Math.min(endA, endB);
  if (end <= start) return 0;
  return (end - start) / 86400000;
}

function premiumOpportunityRevenueInPeriod(row, startMs, endMs) {
  if (String(row.package_tier || '').toLowerCase() !== 'premium' && !row.featured) return 0;
  const untilMs = parseMs(row.featured_until);
  if (!untilMs || untilMs <= startMs) return 0;

  const paidMs = parseMs(row.listing_paid_at) || parseMs(row.published_at) || parseMs(row.created_at);
  if (!paidMs) return 0;

  const windowStart = Math.max(startMs, paidMs);
  const windowEnd = Math.min(endMs, untilMs, Date.now());
  if (windowEnd <= windowStart) return 0;

  const months = Math.max(1, Math.ceil(overlapDays(windowStart, windowEnd, startMs, endMs) / 30));
  return round2(months * PREMIUM_OPPORTUNITY_MONTHLY_GBP);
}

function buildPeriodMeta(now = new Date()) {
  const startMs = parseMs(PERIOD_START);
  const endMs = parseMs(PERIOD_END);
  const nowMs = now.getTime();
  const daysTotal = Math.max(1, (endMs - startMs) / 86400000);
  const daysElapsed = Math.max(0, Math.min(daysTotal, (nowMs - startMs) / 86400000));
  const daysRemaining = Math.max(0, (endMs - nowMs) / 86400000);
  const monthsRemaining = round2(daysRemaining / 30.44);

  return {
    start: PERIOD_START,
    end: PERIOD_END,
    label: '3 Jul 2026 – 1 Sep 2027',
    daysTotal: Math.round(daysTotal),
    daysElapsed: Math.round(daysElapsed),
    daysRemaining: Math.round(daysRemaining),
    monthsRemaining,
    progressPct: round2((daysElapsed / daysTotal) * 100),
  };
}

function forecastAmount(actual, period) {
  if (!period.daysElapsed) return 0;
  return round2((actual / period.daysElapsed) * period.daysTotal);
}

function monthlyPaceNeeded(target, actual, monthsRemaining) {
  const remaining = Math.max(0, target - actual);
  if (!monthsRemaining) return remaining;
  return round2(remaining / monthsRemaining);
}

function onTrackStatus(actual, target, forecast) {
  if (actual >= target) return 'achieved';
  if (forecast >= target * 0.95) return 'on_track';
  if (forecast >= target * 0.7) return 'at_risk';
  return 'behind';
}

function statusLabel(status) {
  if (status === 'achieved') return 'On target';
  if (status === 'on_track') return 'On track';
  if (status === 'at_risk') return 'At risk';
  return 'Behind pace';
}

function addBreakdown(map, categoryId, item) {
  if (!map.has(categoryId)) map.set(categoryId, []);
  map.get(categoryId).push(item);
}

async function fetchAutoRevenue(sb, startMs, endMs) {
  const breakdown = new Map();
  TARGET_CATEGORIES.forEach((c) => breakdown.set(c.id, []));

  const [regsRes, oppsRes, eventsRes] = await Promise.all([
    sb
      .from('registrations')
      .select(
        'id, created_at, payment_status, amount_paid, quantity, events(title), attendees(name, email), organisers(name)'
      )
      .eq('payment_status', 'Paid')
      .gte('created_at', new Date(startMs).toISOString())
      .lt('created_at', new Date(endMs).toISOString()),
    sb
      .from('business_opportunities')
      .select(
        'id, title, listing_months, listing_paid_at, listing_expires_at, featured, featured_until, package_tier, published_at, created_at'
      )
      .not('listing_paid_at', 'is', null),
    sb
      .from('events')
      .select('id, title, featured_plan, featured_paid_at, featured_amount_gbp')
      .not('featured_paid_at', 'is', null),
  ]);

  if (regsRes.error) throw new Error(regsRes.error.message);
  if (oppsRes.error) throw new Error(oppsRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  (regsRes.data || []).forEach((reg) => {
    if (!inPeriod(reg.created_at, startMs, endMs)) return;
    if (isTestRegistration(reg)) return;
    const fee = registrationHubPlatformFee(reg);
    if (fee <= 0) return;
    addBreakdown(breakdown, 'ticket_sales', {
      type: 'auto',
      source: 'Hub platform fee — ' + String(reg.events?.title || 'registration').trim(),
      amount: fee,
      recordedAt: reg.created_at,
    });
  });

  (oppsRes.data || []).forEach((row) => {
    if (isTestFixtureText(row.title)) return;
    if (inPeriod(row.listing_paid_at, startMs, endMs)) {
      const months = row.listing_months || 3;
      const totals = calculateOpportunityListingTotals(months);
      const amount = round2(totals.totalPence / 100);
      if (amount > 0) {
        addBreakdown(breakdown, 'opportunities', {
          type: 'auto',
          source: 'Listing fee — ' + String(row.title || 'opportunity').trim(),
          amount,
          recordedAt: row.listing_paid_at,
        });
      }
    }

    const premiumAmount = premiumOpportunityRevenueInPeriod(row, startMs, endMs);
    if (premiumAmount > 0) {
      addBreakdown(breakdown, 'opportunities', {
        type: 'auto',
        source: 'Premium spotlight — ' + String(row.title || 'opportunity').trim(),
        amount: premiumAmount,
        recordedAt: row.listing_paid_at || row.published_at,
      });
    }
  });

  (eventsRes.data || []).forEach((row) => {
    if (isTestFixtureText(row.title)) return;
    if (!inPeriod(row.featured_paid_at, startMs, endMs)) return;
    let amount = Number(row.featured_amount_gbp) || 0;
    if (!amount && row.featured_plan && FEATURED_PLANS[row.featured_plan]) {
      amount = FEATURED_PLANS[row.featured_plan].amountPence / 100;
    }
    if (amount <= 0) return;
    addBreakdown(breakdown, 'events', {
      type: 'auto',
      source: 'Premium spotlight — ' + String(row.title || 'event').trim(),
      amount: round2(amount),
      recordedAt: row.featured_paid_at,
    });
  });

  return breakdown;
}

async function fetchManualDeals(sb, startMs, endMs) {
  const res = await sb
    .from('hub_revenue_deals')
    .select('*')
    .gte('recorded_at', new Date(startMs).toISOString())
    .lt('recorded_at', new Date(endMs).toISOString())
    .order('recorded_at', { ascending: false });
  if (res.error) {
    if (/hub_revenue_deals/i.test(res.error.message)) {
      return { deals: [], tableMissing: true };
    }
    throw new Error(res.error.message);
  }
  return { deals: res.data || [], tableMissing: false };
}

function sumBreakdown(items) {
  return round2((items || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
}

function monthKeyFromMs(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthKeyFromIso(iso) {
  const ms = parseMs(iso);
  return ms == null ? null : monthKeyFromMs(ms);
}

function formatMonthLabel(key) {
  const [year, month] = String(key || '').split('-').map(Number);
  if (!year || !month) return key;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function enumeratePeriodMonths(startMs, endMs) {
  const months = [];
  const cursor = new Date(startMs);
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor.getTime() < endMs) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const key = monthKeyFromMs(cursor.getTime());
    const monthStart = Date.UTC(year, month, 1);
    const monthEnd = Date.UTC(year, month + 1, 0, 23, 59, 59, 999);
    months.push({
      key,
      label: formatMonthLabel(key),
      startMs: Math.max(startMs, monthStart),
      endMs: Math.min(endMs, monthEnd + 1),
    });
    cursor.setUTCMonth(month + 1);
  }
  return months;
}

function monthTargetShare(month, periodTarget, periodStartMs, periodEndMs) {
  const periodDays = Math.max(1, (periodEndMs - periodStartMs) / 86400000);
  const monthDays = Math.max(0, (month.endMs - month.startMs) / 86400000);
  return round2(periodTarget * (monthDays / periodDays));
}

function bucketItemsByMonth(items) {
  const buckets = new Map();
  (items || []).forEach((item) => {
    const key = monthKeyFromIso(item.recordedAt);
    if (!key) return;
    buckets.set(key, round2((buckets.get(key) || 0) + (Number(item.amount) || 0)));
  });
  return buckets;
}

function forecastMonthTotal(actualSoFar, now = new Date()) {
  const day = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  if (!actualSoFar || day <= 0) return round2(actualSoFar || 0);
  return round2((actualSoFar / day) * daysInMonth);
}

function buildMonthlyChartSeries(items, periodTarget, periodStartMs, periodEndMs, now = new Date()) {
  const currentKey = monthKeyFromMs(now.getTime());
  const months = enumeratePeriodMonths(periodStartMs, periodEndMs);
  const buckets = bucketItemsByMonth(items);

  let cumulativeActual = 0;
  let cumulativeTarget = 0;

  const monthly = months.map((month) => {
    const isFuture = month.startMs > now.getTime();
    const isCurrent = month.key === currentKey;
    const actual = isFuture ? 0 : round2(buckets.get(month.key) || 0);
    const targetMonthly = monthTargetShare(month, periodTarget, periodStartMs, periodEndMs);
    const forecast = isCurrent && !isFuture ? forecastMonthTotal(actual, now) : null;

    cumulativeActual = round2(cumulativeActual + (isFuture ? 0 : actual));
    cumulativeTarget = round2(cumulativeTarget + targetMonthly);

    return {
      key: month.key,
      label: month.label,
      isCurrent,
      isFuture,
      actual: isFuture ? null : actual,
      forecast,
      targetMonthly,
      cumulativeActual: isFuture ? null : cumulativeActual,
      cumulativeTarget,
      cumulativeForecast:
        isCurrent && forecast != null
          ? round2(cumulativeActual - actual + forecast)
          : isFuture
            ? null
            : cumulativeActual,
    };
  });

  return { months: monthly, currentKey };
}

function buildChartsFromCategories(categories, periodStartMs, periodEndMs, now = new Date()) {
  const byCategory = {};
  const allItems = [];

  categories.forEach((cat) => {
    const items = cat.breakdown || [];
    allItems.push(...items.map((item) => ({ ...item, categoryId: cat.id })));
    byCategory[cat.id] = buildMonthlyChartSeries(items, cat.target, periodStartMs, periodEndMs, now);
    byCategory[cat.id].label = cat.label;
    byCategory[cat.id].target = cat.target;
  });

  const totalTarget = round2(categories.reduce((sum, cat) => sum + cat.target, 0));
  const overall = buildMonthlyChartSeries(allItems, totalTarget, periodStartMs, periodEndMs, now);
  overall.label = 'All revenue';
  overall.target = totalTarget;

  return { overall, byCategory };
}

function buildAssessment(categories, period, totals) {
  const totalTarget = totals.target;
  const totalForecast = totals.forecast;
  const monthlyNeeded = monthlyPaceNeeded(totalTarget, totals.actual, period.monthsRemaining);
  const monthlyActualPace =
    period.daysElapsed > 0 ? round2((totals.actual / period.daysElapsed) * 30.44) : 0;

  let headline = '';
  if (totals.actual >= totalTarget) {
    headline = 'Overall target already reached for this period.';
  } else if (totalForecast >= totalTarget) {
    headline =
      'At the current run rate you are projected to hit £' +
      totalTarget.toLocaleString('en-GB') +
      ' before September 2027.';
  } else {
    headline =
      'You need roughly £' +
      monthlyNeeded.toLocaleString('en-GB') +
      '/month from here to hit the full £' +
      totalTarget.toLocaleString('en-GB') +
      ' target (currently tracking ~£' +
      monthlyActualPace.toLocaleString('en-GB') +
      '/month).';
  }

  const notes = [
    'Ticket sales (£2,500) is the most modest target — booking fees accrue automatically from paid event tickets and Hub-billed memberships.',
    'Events (£42,500) and opportunities (£48,000) are the stretch goals — they rely on closing directory sponsors and premium packages consistently.',
    'Browse organisers (£10,000) is achievable with one hero sponsor plus mini-sponsor inventory over the period.',
    'Awards (£5,000) is marked TBC — log revenue manually when sponsorship is confirmed.',
  ];

  return {
    headline,
    notes,
    monthlyNeeded,
    monthlyActualPace,
    projectedTotal: totalForecast,
    gapToTarget: round2(Math.max(0, totalTarget - totals.actual)),
  };
}

async function getAdminRevenueTargets(sb) {
  const period = buildPeriodMeta();
  const startMs = parseMs(PERIOD_START);
  const endMs = parseMs(PERIOD_END);

  const [autoBreakdown, manualResult] = await Promise.all([
    fetchAutoRevenue(sb, startMs, endMs),
    fetchManualDeals(sb, startMs, endMs),
  ]);

  const manualByCategory = new Map();
  TARGET_CATEGORIES.forEach((c) => manualByCategory.set(c.id, []));

  (manualResult.deals || []).forEach((deal) => {
    const cat = String(deal.category || '').trim();
    if (!manualByCategory.has(cat)) return;
    const sourceType = String(deal.source_type || 'manual').trim();
    manualByCategory.get(cat).push({
      type: sourceType === 'manual' ? 'manual' : 'stripe',
      id: deal.id,
      source: String(deal.source_label || 'Manual entry').trim(),
      amount: round2(deal.amount_gbp),
      recordedAt: deal.recorded_at,
      notes: String(deal.notes || '').trim(),
      cmsSlot: deal.cms_slot || null,
      stripeInvoiceId: deal.stripe_invoice_id || null,
    });
  });

  const categories = TARGET_CATEGORIES.map((cat) => {
    const autoItems = autoBreakdown.get(cat.id) || [];
    const manualItems = manualByCategory.get(cat.id) || [];
    const items = autoItems.concat(manualItems);
    const actual = sumBreakdown(items);
    const forecast = forecastAmount(actual, period);
    const status = onTrackStatus(actual, cat.target, forecast);

    return {
      ...cat,
      actual,
      progressPct: cat.target ? round2((actual / cat.target) * 100) : 0,
      forecast,
      forecastPct: cat.target ? round2((forecast / cat.target) * 100) : 0,
      status,
      statusLabel: statusLabel(status),
      monthlyNeeded: monthlyPaceNeeded(cat.target, actual, period.monthsRemaining),
      breakdown: items.sort((a, b) => String(b.recordedAt).localeCompare(String(a.recordedAt))),
    };
  });

  const totals = {
    target: round2(TARGET_CATEGORIES.reduce((s, c) => s + c.target, 0)),
    actual: round2(categories.reduce((s, c) => s + c.actual, 0)),
    forecast: round2(categories.reduce((s, c) => s + c.forecast, 0)),
  };
  totals.progressPct = totals.target ? round2((totals.actual / totals.target) * 100) : 0;
  totals.forecastPct = totals.target ? round2((totals.forecast / totals.target) * 100) : 0;
  totals.status = onTrackStatus(totals.actual, totals.target, totals.forecast);
  totals.statusLabel = statusLabel(totals.status);

  const charts = buildChartsFromCategories(categories, startMs, endMs);

  return {
    currency: 'GBP',
    period,
    categories,
    totals,
    charts,
    manualDeals: manualResult.deals || [],
    dealsTableMissing: manualResult.tableMissing,
    assessment: buildAssessment(categories, period, totals),
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  TARGET_CATEGORIES,
  PERIOD_START,
  PERIOD_END,
  getAdminRevenueTargets,
};
