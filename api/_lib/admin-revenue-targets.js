/**
 * Command Centre revenue targets — Jul 2026 → 1 Sep 2027.
 * Combines auto-tracked Stripe/registration revenue with manual sponsorship deals.
 */
const { registrationHubPlatformFee } = require('./booking-fees');
const { calculateOpportunityListingTotals } = require('./opportunity-listing-pricing');
const { FEATURED_PLANS } = require('./event-featured-plans');
const { isTestRegistration, isTestFixtureText } = require('./test-fixture-filters');
const { listRefundsPendingEvents } = require('./admin-refunds-pending');

const PERIOD_START = '2026-07-03T00:00:00.000Z';
const PERIOD_END = '2027-09-01T00:00:00.000Z';
const PREMIUM_OPPORTUNITY_MONTHLY_GBP = 55;

function hasPaidOpportunityListing(row) {
  return Boolean(
    String(row?.listing_stripe_session_id || '').trim() ||
      String(row?.listing_stripe_subscription_id || '').trim()
  );
}

function hasPaidOpportunityPremium(row) {
  return Boolean(String(row?.premium_stripe_session_id || '').trim());
}

function isAdminCompedOpportunity(row) {
  const tags = Array.isArray(row?.tags) ? row.tags : [];
  return tags.some(function (tag) {
    return String(tag || '')
      .toLowerCase()
      .includes('admin-test');
  });
}

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
    description:
      'Hub platform cut on paid event tickets and organiser memberships, net of completed refunds (Stripe excluded)',
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
  // Only Stripe-paid premium — admin spotlight grants must not count as revenue.
  if (!hasPaidOpportunityPremium(row)) return 0;
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

function onTrackStatus(actual, target, forecast, period) {
  if (actual >= target) return 'achieved';
  if (forecast >= target * 0.95) return 'on_track';

  // Early in the period, red "Behind pace" is demoralising and rarely useful —
  // prefer constructive labels until there is a meaningful run rate.
  const daysElapsed = Number(period?.daysElapsed) || 0;
  if (daysElapsed < 90) {
    if (actual > 0) return 'building';
    return 'getting_started';
  }

  if (forecast >= target * 0.7) return 'at_risk';
  if (actual > 0) return 'building';
  return 'behind';
}

function statusLabel(status) {
  if (status === 'achieved') return 'On target';
  if (status === 'on_track') return 'On track';
  if (status === 'building') return 'Building momentum';
  if (status === 'getting_started') return 'Getting started';
  if (status === 'at_risk') return 'Needs a push';
  return 'Below pace';
}

function addBreakdown(map, categoryId, item) {
  if (!map.has(categoryId)) map.set(categoryId, []);
  map.get(categoryId).push(item);
}

function refundRecordedAt(reg) {
  return reg?.cancelled_at || reg?.refund_email_sent_at || null;
}

function mergeRegistrationRows(rows) {
  const byId = new Map();
  (rows || []).forEach((row) => {
    if (!row || !row.id) return;
    byId.set(row.id, row);
  });
  return [...byId.values()];
}

async function fetchRegistrationsForRevenue(sb, startMs, endMs) {
  const startIso = new Date(startMs).toISOString();
  const endIso = new Date(endMs).toISOString();
  const cols =
    'id, created_at, cancelled_at, refund_email_sent_at, payment_status, amount_paid, quantity, events(title), attendees(name, email), organisers(name)';

  const [createdRes, cancelledRes, refundEmailRes] = await Promise.all([
    sb
      .from('registrations')
      .select(cols)
      .in('payment_status', ['Paid', 'Refunded'])
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    sb
      .from('registrations')
      .select(cols)
      .eq('payment_status', 'Refunded')
      .not('cancelled_at', 'is', null)
      .gte('cancelled_at', startIso)
      .lt('cancelled_at', endIso),
    sb
      .from('registrations')
      .select(cols)
      .eq('payment_status', 'Refunded')
      .is('cancelled_at', null)
      .not('refund_email_sent_at', 'is', null)
      .gte('refund_email_sent_at', startIso)
      .lt('refund_email_sent_at', endIso),
  ]);

  if (createdRes.error) throw new Error(createdRes.error.message);
  if (cancelledRes.error) throw new Error(cancelledRes.error.message);
  if (refundEmailRes.error) throw new Error(refundEmailRes.error.message);

  return mergeRegistrationRows([
    ...(createdRes.data || []),
    ...(cancelledRes.data || []),
    ...(refundEmailRes.data || []),
  ]);
}

async function fetchPendingRefundExposure(sb) {
  let pendingEvents = [];
  try {
    pendingEvents = await listRefundsPendingEvents(sb, 50);
  } catch (err) {
    return {
      eventCount: 0,
      paidBookings: 0,
      estimatedHubFee: 0,
      events: [],
      warning: err?.message || String(err),
    };
  }

  const eventIds = pendingEvents.map((e) => e.eventId).filter(Boolean);
  if (!eventIds.length) {
    return { eventCount: 0, paidBookings: 0, estimatedHubFee: 0, events: [], warning: null };
  }

  const { data, error } = await sb
    .from('registrations')
    .select(
      'id, event_id, amount_paid, quantity, payment_status, events(title), attendees(name, email), organisers(name)'
    )
    .in('event_id', eventIds)
    .eq('payment_status', 'Paid');
  if (error) throw new Error(error.message);

  let estimatedHubFee = 0;
  let paidBookings = 0;
  (data || []).forEach((reg) => {
    if (isTestRegistration(reg)) return;
    const fee = registrationHubPlatformFee(reg);
    if (fee <= 0) return;
    estimatedHubFee = round2(estimatedHubFee + fee);
    paidBookings += 1;
  });

  return {
    eventCount: pendingEvents.length,
    paidBookings,
    estimatedHubFee,
    events: pendingEvents.slice(0, 8).map((e) => ({
      eventId: e.eventId,
      title: e.title,
      paidBookings: e.paidBookings,
      cancelledAt: e.cancelledAt,
    })),
    warning: null,
  };
}

async function fetchAutoRevenue(sb, startMs, endMs) {
  const breakdown = new Map();
  TARGET_CATEGORIES.forEach((c) => breakdown.set(c.id, []));

  const refunds = {
    completedCount: 0,
    completedHubFee: 0,
    salesCount: 0,
    salesHubFee: 0,
  };

  const [regs, oppsRes, eventsRes, pendingRefunds] = await Promise.all([
    fetchRegistrationsForRevenue(sb, startMs, endMs),
    sb
      .from('business_opportunities')
      .select(
        'id, title, tags, listing_months, listing_paid_at, listing_expires_at, listing_stripe_session_id, listing_stripe_subscription_id, featured, featured_until, package_tier, premium_stripe_session_id, published_at, created_at'
      )
      .not('listing_paid_at', 'is', null),
    sb
      .from('events')
      .select('id, title, featured_plan, featured_paid_at, featured_amount_gbp')
      .not('featured_paid_at', 'is', null),
    fetchPendingRefundExposure(sb),
  ]);

  if (oppsRes.error) throw new Error(oppsRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  regs.forEach((reg) => {
    if (isTestRegistration(reg)) return;
    const fee = registrationHubPlatformFee(reg);
    if (fee <= 0) return;
    const status = String(reg.payment_status || '').trim();
    const eventTitle = String(reg.events?.title || 'registration').trim();

    if (inPeriod(reg.created_at, startMs, endMs) && (status === 'Paid' || status === 'Refunded')) {
      refunds.salesCount += 1;
      refunds.salesHubFee = round2(refunds.salesHubFee + fee);
      addBreakdown(breakdown, 'ticket_sales', {
        type: 'auto',
        kind: 'sale',
        source: 'Hub platform fee — ' + eventTitle,
        amount: fee,
        recordedAt: reg.created_at,
      });
    }

    if (status === 'Refunded') {
      let refundAt = refundRecordedAt(reg);
      // If refund timestamp is missing, reverse in the sale month so net stays honest.
      if (!refundAt && inPeriod(reg.created_at, startMs, endMs)) {
        refundAt = reg.created_at;
      }
      if (refundAt && inPeriod(refundAt, startMs, endMs)) {
        refunds.completedCount += 1;
        refunds.completedHubFee = round2(refunds.completedHubFee + fee);
        addBreakdown(breakdown, 'ticket_sales', {
          type: 'auto',
          kind: 'refund',
          source: 'Refund — Hub platform fee reversed — ' + eventTitle,
          amount: round2(-fee),
          recordedAt: refundAt,
        });
      }
    }
  });

  (oppsRes.data || []).forEach((row) => {
    if (isTestFixtureText(row.title) || isAdminCompedOpportunity(row)) return;

    // Listing fee: only real Stripe checkouts (session or subscription id).
    // Admin comps set listing_paid_at without Stripe ids and must not inflate Sales targets.
    if (hasPaidOpportunityListing(row) && inPeriod(row.listing_paid_at, startMs, endMs)) {
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

  return {
    breakdown,
    refunds: {
      ...refunds,
      netHubFee: round2(refunds.salesHubFee - refunds.completedHubFee),
      pending: pendingRefunds,
    },
  };
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

function buildMonthlyPulse(items, periodStartMs, periodEndMs, now = new Date()) {
  const series = buildMonthlyChartSeries(items || [], 0, periodStartMs, periodEndMs, now);
  const months = (series.months || []).filter((m) => !m.isFuture);
  const current = months.find((m) => m.isCurrent) || months[months.length - 1] || null;
  const currentIdx = current ? months.findIndex((m) => m.key === current.key) : -1;
  const previous = currentIdx > 0 ? months[currentIdx - 1] : null;

  const currentActual = current && current.actual != null ? Number(current.actual) || 0 : 0;
  const previousActual = previous && previous.actual != null ? Number(previous.actual) || 0 : 0;
  const delta = round2(currentActual - previousActual);
  let growthPct = null;
  if (previousActual > 0) growthPct = round2((delta / previousActual) * 100);
  else if (currentActual > 0 && previous) growthPct = 100;

  const recent = months.slice(-6).map((m) => ({
    key: m.key,
    label: m.label,
    actual: m.actual == null ? 0 : Number(m.actual) || 0,
    isCurrent: Boolean(m.isCurrent),
  }));

  return {
    currentMonth: current
      ? { key: current.key, label: current.label, actual: currentActual, forecast: current.forecast }
      : null,
    previousMonth: previous
      ? { key: previous.key, label: previous.label, actual: previousActual }
      : null,
    delta,
    growthPct,
    recent,
  };
}

function buildAssessment(categories, period, totals, monthlyPulse, refunds) {
  const totalTarget = totals.target;
  const totalForecast = totals.forecast;
  const monthlyNeeded = monthlyPaceNeeded(totalTarget, totals.actual, period.monthsRemaining);
  const monthlyActualPace =
    period.daysElapsed > 0 ? round2((totals.actual / period.daysElapsed) * 30.44) : 0;

  const currentLabel = monthlyPulse?.currentMonth?.label || 'This month';
  const previousLabel = monthlyPulse?.previousMonth?.label || 'last month';
  const currentAmount = monthlyPulse?.currentMonth?.actual || 0;
  const previousAmount = monthlyPulse?.previousMonth?.actual || 0;
  const growthPct = monthlyPulse?.growthPct;

  let headline = '';
  if (totals.actual >= totalTarget) {
    headline = 'Overall target already reached for this period — well done.';
  } else if (currentAmount > 0 && previousAmount === 0 && monthlyPulse?.previousMonth) {
    headline =
      'Nice start — £' +
      currentAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
      ' booked in ' +
      currentLabel +
      ' after a quieter ' +
      previousLabel +
      '.';
  } else if (growthPct != null && growthPct > 0) {
    headline =
      currentLabel +
      ' is up ' +
      Math.round(growthPct) +
      '% on ' +
      previousLabel +
      ' (£' +
      currentAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
      ' so far vs £' +
      previousAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
      '). Keep that momentum going.';
  } else if (currentAmount > 0) {
    headline =
      currentLabel +
      ' has brought in £' +
      currentAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
      ' so far — every listing and sponsor deal compounds from here.';
  } else if (period.daysElapsed < 90) {
    headline =
      'Still early days in this target window. Focus on closing the next few deals — monthly comparisons will light up as revenue lands.';
  } else if (totalForecast >= totalTarget) {
    headline =
      'At the current run rate you are projected to hit £' +
      totalTarget.toLocaleString('en-GB') +
      ' before September 2027.';
  } else {
    headline =
      'Aim for roughly £' +
      monthlyNeeded.toLocaleString('en-GB') +
      '/month from here to hit the full £' +
      totalTarget.toLocaleString('en-GB') +
      ' target.';
  }

  const notes = [
    'Compare months side-by-side below — growth month-to-month matters more than the period-long pace this early on.',
    'Ticket sales (£2,500) accrues automatically from paid event tickets and platform-billed memberships, net of completed refunds.',
    'Events (£42,500) and opportunities (£48,000) move fastest when directory sponsors and premium packages close consistently.',
    'Browse organisers (£10,000) is achievable with one hero sponsor plus mini-sponsor inventory over the period.',
    'Awards (£5,000) is marked TBC — log revenue manually when sponsorship is confirmed.',
  ];

  if (refunds && refunds.completedCount > 0) {
    notes.unshift(
      refunds.completedCount +
        ' completed ticket refund' +
        (refunds.completedCount === 1 ? '' : 's') +
        ' reversed £' +
        Number(refunds.completedHubFee || 0).toLocaleString('en-GB', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) +
        ' of Hub platform fee in this period.'
    );
  }

  if (refunds?.pending?.paidBookings > 0) {
    notes.unshift(
      refunds.pending.paidBookings +
        ' paid booking' +
        (refunds.pending.paidBookings === 1 ? '' : 's') +
        ' on cancelled events still await Stripe refund confirmation (~£' +
        Number(refunds.pending.estimatedHubFee || 0).toLocaleString('en-GB', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) +
        ' Hub fee still counted until refunded).'
    );
  }

  return {
    headline,
    notes,
    monthlyNeeded,
    monthlyActualPace,
    projectedTotal: totalForecast,
    gapToTarget: round2(Math.max(0, totalTarget - totals.actual)),
    monthlyPulse: monthlyPulse || null,
  };
}

async function getAdminRevenueTargets(sb) {
  const period = buildPeriodMeta();
  const startMs = parseMs(PERIOD_START);
  const endMs = parseMs(PERIOD_END);

  const [autoResult, manualResult] = await Promise.all([
    fetchAutoRevenue(sb, startMs, endMs),
    fetchManualDeals(sb, startMs, endMs),
  ]);

  const autoBreakdown = autoResult.breakdown;
  const refunds = autoResult.refunds || null;

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
    const status = onTrackStatus(actual, cat.target, forecast, period);

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
  totals.status = onTrackStatus(totals.actual, totals.target, totals.forecast, period);
  totals.statusLabel = statusLabel(totals.status);

  const charts = buildChartsFromCategories(categories, startMs, endMs);
  const allItems = categories.flatMap((cat) => cat.breakdown || []);
  const monthlyPulse = buildMonthlyPulse(allItems, startMs, endMs);

  return {
    currency: 'GBP',
    period,
    categories,
    totals,
    charts,
    monthlyPulse,
    refunds,
    manualDeals: manualResult.deals || [],
    dealsTableMissing: manualResult.tableMissing,
    assessment: buildAssessment(categories, period, totals, monthlyPulse, refunds),
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  TARGET_CATEGORIES,
  PERIOD_START,
  PERIOD_END,
  getAdminRevenueTargets,
};
