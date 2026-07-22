/**
 * Organiser payout requests, eligibility, and fee breakdown.
 */
const { getSupabaseAdmin } = require('./supabase');
const { resolveOrganiserAccess } = require('./supabase-organiser-access');
const { isStripeConnectEnabled } = require('./stripe-connect');
const {
  registrationTicketRevenue,
  registrationBookingFee,
} = require('./booking-fees');
const { formatTicketsSoldLabel } = require('./tickets-sold-label');

const PAYOUT_STATUS_LABELS = {
  pending_review: 'Pending review',
  approved: 'Approved',
  paid: 'Paid',
  held: 'Held',
};

const MIN_PAYOUT_NET = 1.0;
const SETTLEMENT_DAYS = 7;

function formatGbp(amount) {
  const n = Number(amount) || 0;
  return '£' + n.toFixed(2);
}

function isEventArchived(ev) {
  return String(ev.status || ev.listingStatus || '').toLowerCase() === 'archived';
}

function eventSettlementAnchor(ev) {
  return ev.endDate || ev.ends_at || ev.date || ev.starts_at || null;
}

function getEarliestPayoutDate(ev) {
  const anchor = eventSettlementAnchor(ev);
  if (!anchor) return null;
  const d = new Date(anchor);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + SETTLEMENT_DAYS);
  return d;
}

function isSettlementComplete(ev) {
  const earliest = getEarliestPayoutDate(ev);
  if (!earliest) return false;
  return new Date() >= earliest;
}

function isCountableRegistration(row) {
  const payment = String(row.payment_status || '').trim();
  if (payment === 'Refunded') return false;
  if (row?.cancelled_at) return false;
  if (String(row.application_status || '').trim() === 'Denied') return false;
  return payment === 'Paid' || payment === 'Free' || payment === 'Pending';
}

/** Normalise mapped or raw event rows for refund-policy helpers. */
function eventRowForRefundChecks(ev) {
  if (!ev) return null;
  return {
    status: ev.status || ev.listingStatus,
    starts_at: ev.starts_at || ev.date || null,
    refund_policy: ev.refund_policy || ev.refundPolicy || null,
    refund_cutoff_days: ev.refund_cutoff_days ?? ev.refundCutoffDays ?? null,
    refund_policy_details: ev.refund_policy_details || ev.refundPolicyDetails || null,
    payout_held: ev.payout_held ?? ev.payoutHeld ?? false,
  };
}

function buildRevenueContext(ev, eventCancellation) {
  return {
    eventRow: eventRowForRefundChecks(ev),
    eventCancellation: eventCancellation || null,
  };
}

function mapLatestCancellationsByEvent(cancellations) {
  const byEvent = {};
  (cancellations || []).forEach((row) => {
    if (!row?.event_id || byEvent[row.event_id]) return;
    byEvent[row.event_id] = row;
  });
  return byEvent;
}

/**
 * Paid ticket revenue still owed back to attendees — exclude from organiser revenue totals.
 */
function isRevenueCountableRegistration(registration, context) {
  const payment = String(registration?.payment_status || '').trim();
  if (payment !== 'Paid') return false;
  if (registration?.refund_email_sent_at) return false;

  const eventRow = context?.eventRow || null;
  if (eventRow && String(eventRow.status || '').toLowerCase() === 'cancelled') {
    return false;
  }

  if (registration?.cancelled_at) {
    if (!eventRow) return false;
    const { deriveRefundStatusForCancelledRegistration } = require('./cancellation-email-sections');
    const refundStatus = deriveRefundStatusForCancelledRegistration(eventRow, registration);
    if (refundStatus === 'pending' || refundStatus === 'completed') return false;
  }

  return true;
}

function registrationTicketQty(row) {
  return Math.max(1, Number(row.quantity) || 1);
}

function summarizeRegistrationSales(registrations) {
  let ticketsSold = 0;
  (registrations || []).forEach((row) => {
    if (!isCountableRegistration(row)) return;
    ticketsSold += registrationTicketQty(row);
  });
  return { ticketsSold };
}

function enrichTicketsWithSales(tickets, registrations, revenueContextByEventId) {
  const soldByTicket = new Map();
  const revenueByTicket = new Map();
  (registrations || []).forEach((row) => {
    if (!row.ticket_id || !isCountableRegistration(row)) return;
    const q = registrationTicketQty(row);
    soldByTicket.set(row.ticket_id, (soldByTicket.get(row.ticket_id) || 0) + q);
    const revenueContext = (revenueContextByEventId && revenueContextByEventId[row.event_id]) || {};
    if (isRevenueCountableRegistration(row, revenueContext)) {
      revenueByTicket.set(
        row.ticket_id,
        (revenueByTicket.get(row.ticket_id) || 0) + registrationTicketRevenue(row)
      );
    }
  });

  return (tickets || []).map((t) => {
    const sold = soldByTicket.get(t.id) || 0;
    const revenue = Math.round((revenueByTicket.get(t.id) || 0) * 100) / 100;
    return {
      ...t,
      ticketsSold: sold,
      revenueNum: revenue,
      revenueDisplay: formatGbp(revenue),
    };
  });
}

function calculatePayoutBreakdown(registrations, revenueContext) {
  let amount_gross = 0;
  let booking_fee_collected = 0;
  const intentIds = [];
  (registrations || []).forEach((row) => {
    if (!isRevenueCountableRegistration(row, revenueContext || {})) return;
    amount_gross += registrationTicketRevenue(row);
    booking_fee_collected += registrationBookingFee(row);
    if (row.stripe_payment_intent_id) intentIds.push(row.stripe_payment_intent_id);
  });
  const total_transactions = new Set(intentIds).size;

  return {
    amount_gross: Math.round(amount_gross * 100) / 100,
    stripe_fee: 0,
    platform_fee: 0,
    booking_fee_collected: Math.round(booking_fee_collected * 100) / 100,
    amount_net: Math.round(amount_gross * 100) / 100,
    total_transactions,
  };
}

function rowToPayout(row) {
  if (!row) return null;
  const amountNet = row.amount_net != null ? Number(row.amount_net) : null;
  return {
    id: row.id,
    eventId: row.event_id,
    organiserAccountId: row.organiser_account_id || null,
    status: row.status || 'pending_review',
    statusLabel: PAYOUT_STATUS_LABELS[row.status] || row.status,
    amount: amountNet != null ? amountNet : row.amount != null ? Number(row.amount) : null,
    amountGross: row.amount_gross != null ? Number(row.amount_gross) : null,
    stripeFee: row.stripe_fee != null ? Number(row.stripe_fee) : null,
    platformFee: row.platform_fee != null ? Number(row.platform_fee) : null,
    amountNet,
    totalTransactions: row.total_transactions != null ? Number(row.total_transactions) : null,
    requestedAt: row.requested_at || row.created_at || null,
    createdAt: row.created_at || null,
  };
}

const REGISTRATION_QUERY_CHUNK = 100;

function isMissingRelationError(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return /does not exist|could not find the table|relation .* does not exist/.test(msg);
}

async function listPayoutsForEvents(eventIds) {
  if (!eventIds.length) return [];
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('organiser_payouts')
    .select('*')
    .in('event_id', eventIds)
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw new Error(error.message);
  }
  return (data || []).map(rowToPayout);
}

async function listCancellationsForEvents(eventIds) {
  const ids = (eventIds || []).filter(Boolean);
  if (!ids.length) return [];
  const sb = getSupabaseAdmin();
  const rows = [];
  for (let i = 0; i < ids.length; i += REGISTRATION_QUERY_CHUNK) {
    const chunk = ids.slice(i, i + REGISTRATION_QUERY_CHUNK);
    const { data, error } = await sb
      .from('event_cancellations')
      .select('*')
      .in('event_id', chunk)
      .order('created_at', { ascending: false });
    if (error) {
      if (isMissingRelationError(error)) return rows;
      throw new Error(error.message);
    }
    if (data?.length) rows.push(...data);
  }
  return rows;
}

async function listRegistrationsForEvents(eventIds) {
  const ids = (eventIds || []).filter(Boolean);
  if (!ids.length) return [];
  const sb = getSupabaseAdmin();
  const rows = [];
  for (let i = 0; i < ids.length; i += REGISTRATION_QUERY_CHUNK) {
    const chunk = ids.slice(i, i + REGISTRATION_QUERY_CHUNK);
    const { data, error } = await sb.from('registrations').select('*').in('event_id', chunk);
    if (error) throw new Error(error.message);
    if (data?.length) rows.push(...data);
  }
  return rows;
}

async function archivePastPublishedEvents(groupIds) {
  if (!groupIds.length) return;
  const sb = getSupabaseAdmin();
  const now = new Date();
  const { data, error } = await sb
    .from('events')
    .select('id, starts_at, ends_at, status')
    .in('organiser_id', groupIds)
    .eq('status', 'published');
  if (error) return;

  const ids = (data || [])
    .filter((row) => {
      const anchor = row.ends_at || row.starts_at;
      if (!anchor) return false;
      const d = new Date(anchor);
      return !Number.isNaN(d.getTime()) && d < now;
    })
    .map((row) => row.id);

  if (!ids.length) return;
  await sb.from('events').update({ status: 'archived' }).in('id', ids);
}

async function assertOwnedEvent(sb, session, eventId) {
  const access = await resolveOrganiserAccess(session);
  const groupIds = access.groupIds || [];

  const { data: row, error } = await sb.from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row || !groupIds.includes(row.organiser_id)) {
    const e = new Error('Event not found');
    e.status = 403;
    throw e;
  }
  return { row, access };
}

const CONNECT_PAYOUT_INELIGIBLE =
  'With Stripe Connect, ticket payments go to your connected account at checkout. Open your Stripe dashboard to view balance and bank payouts.';

function evaluatePayoutEligibility(ev, payout, cancellation, breakdown) {
  const payoutHeld = Boolean(ev.payoutHeld);
  const cancelled = String(ev.status || '').toLowerCase() === 'cancelled';
  const archived = isEventArchived(ev);
  const settlementComplete = isSettlementComplete(ev);
  const earliestPayoutDate = getEarliestPayoutDate(ev);
  const pendingPayout =
    payout && (payout.status === 'pending_review' || payout.status === 'approved');
  const aboveMinimum = breakdown.amount_net > MIN_PAYOUT_NET;
  const connectPayoutMode = isStripeConnectEnabled();

  const canRequestPayout =
    !connectPayoutMode &&
    archived &&
    !cancelled &&
    !payoutHeld &&
    !pendingPayout &&
    settlementComplete &&
    aboveMinimum;

  let ineligibleReason = null;
  if (connectPayoutMode) {
    ineligibleReason = CONNECT_PAYOUT_INELIGIBLE;
  } else if (!archived) {
    ineligibleReason = 'Event must be archived before you can request a payout.';
  } else if (!settlementComplete && earliestPayoutDate) {
    ineligibleReason =
      'Settlement period in progress — earliest payout date is ' +
      earliestPayoutDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }) +
      '.';
  } else if (!aboveMinimum) {
    ineligibleReason =
      'Net payout must be greater than £1.00 (your net is ' + formatGbp(breakdown.amount_net) + ').';
  } else if (payoutHeld) {
    ineligibleReason = 'Payout is on hold for this event.';
  } else if (pendingPayout) {
    ineligibleReason = 'A payout request is already pending for this event.';
  } else if (cancelled) {
    ineligibleReason = 'Cancelled events cannot request a payout.';
  }

  return {
    payoutHeld,
    archived,
    cancelled,
    settlementComplete,
    earliestPayoutDate: earliestPayoutDate ? earliestPayoutDate.toISOString() : null,
    aboveMinimum,
    canRequestPayout,
    ineligibleReason,
    pendingPayout: Boolean(pendingPayout),
    connectPayoutMode,
  };
}

function enrichEventPayoutFields(ev, payout, cancellation, breakdown) {
  const eligibility = evaluatePayoutEligibility(ev, payout, cancellation, breakdown);

  let payoutStatus = null;
  let payoutStatusLabel = '—';
  let payoutStatusKey = null;

  if (eligibility.payoutHeld) {
    payoutStatus = 'held';
    payoutStatusKey = 'held';
    payoutStatusLabel = 'Held';
  } else if (payout) {
    payoutStatus = payout.status;
    payoutStatusKey = payout.status;
    payoutStatusLabel = payout.statusLabel;
  }

  return {
    ...ev,
    payoutBreakdown: breakdown,
    payoutHeld: eligibility.payoutHeld,
    archived: eligibility.archived,
    cancelled: eligibility.cancelled,
    settlementComplete: eligibility.settlementComplete,
    earliestPayoutDate: eligibility.earliestPayoutDate,
    payoutStatus,
    payoutStatusKey,
    payoutStatusLabel,
    payoutId: payout ? payout.id : null,
    canRequestPayout: eligibility.canRequestPayout,
    payoutIneligibleReason: eligibility.ineligibleReason,
    connectPayoutMode: eligibility.connectPayoutMode,
    cancellationId: cancellation ? cancellation.id : null,
    refundsConfirmedAt: cancellation?.refunds_confirmed_at || null,
    needsRefundConfirmation: eligibility.payoutHeld && !cancellation?.refunds_confirmed_at,
  };
}

async function enrichEventsWithPayoutData(events) {
  const ids = events.map((e) => e.id).filter(Boolean);
  const [payouts, cancellations, registrations] = await Promise.all([
    listPayoutsForEvents(ids),
    listCancellationsForEvents(ids),
    listRegistrationsForEvents(ids),
  ]);

  const payoutsByEvent = {};
  payouts.forEach((p) => {
    if (!payoutsByEvent[p.eventId]) payoutsByEvent[p.eventId] = p;
  });

  const cancellationsByEvent = {};
  cancellations.forEach((c) => {
    if (!cancellationsByEvent[c.event_id]) cancellationsByEvent[c.event_id] = c;
  });

  const regsByEvent = {};
  registrations.forEach((r) => {
    if (!regsByEvent[r.event_id]) regsByEvent[r.event_id] = [];
    regsByEvent[r.event_id].push(r);
  });

  const enrichedEvents = events.map((ev) => {
    const regs = regsByEvent[ev.id] || [];
    const cancellation = cancellationsByEvent[ev.id] || null;
    const revenueContext = buildRevenueContext(ev, cancellation);
    const breakdown = calculatePayoutBreakdown(regs, revenueContext);
    const { ticketsSold } = summarizeRegistrationSales(regs);
    const capacity = Number(ev.ticketsCapacity) || 0;
    const withSales = {
      ...ev,
      ticketsSold,
      revenueNum: breakdown.amount_gross,
      revenueDisplay: formatGbp(breakdown.amount_gross),
      ticketsSoldLabel: formatTicketsSoldLabel(ticketsSold, capacity),
    };
    return enrichEventPayoutFields(
      withSales,
      payoutsByEvent[ev.id] || null,
      cancellation,
      breakdown
    );
  });

  return { events: enrichedEvents, registrations, cancellations };
}

async function enrichOrganiserWorkspaceSales(events, tickets) {
  const payoutData = await enrichEventsWithPayoutData(events);
  const enrichedEvents = payoutData.events;
  const registrations = payoutData.registrations;
  const cancellations = payoutData.cancellations;
  const cancellationsByEvent = mapLatestCancellationsByEvent(cancellations);
  const revenueContextByEventId = {};
  enrichedEvents.forEach((ev) => {
    revenueContextByEventId[ev.id] = buildRevenueContext(ev, cancellationsByEvent[ev.id] || null);
  });
  const enrichedTickets = enrichTicketsWithSales(tickets, registrations, revenueContextByEventId);
  return { events: enrichedEvents, tickets: enrichedTickets };
}

async function buildOrganiserWorkspaceSummary(groupIds, adminView) {
  const sb = getSupabaseAdmin();
  const ids = groupIds || [];
  if (!ids.length && !adminView) {
    return {
      computed: true,
      totalRevenue: 0,
      totalTicketsSold: 0,
      revenueByGroupId: {},
      ticketsSoldByGroupId: {},
      registrations: [],
      cancellations: [],
      revenueContextByEventId: {},
    };
  }

  const events = [];
  if (adminView) {
    const { data, error } = await sb.from('events').select('id, organiser_id');
    if (error) throw new Error(error.message);
    if (data?.length) events.push(...data);
  } else {
    for (let i = 0; i < ids.length; i += REGISTRATION_QUERY_CHUNK) {
      const chunk = ids.slice(i, i + REGISTRATION_QUERY_CHUNK);
      let query = sb
        .from('events')
        .select(
          'id, organiser_id, status, payout_held, refund_policy, starts_at, refund_cutoff_days, refund_policy_details'
        );
      if (chunk.length === 1) query = query.eq('organiser_id', chunk[0]);
      else query = query.in('organiser_id', chunk);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (data?.length) events.push(...data);
    }
  }

  const eventOrganiser = new Map(events.map((row) => [row.id, row.organiser_id]));
  const eventIds = events.map((row) => row.id).filter(Boolean);
  const [registrations, cancellations] = await Promise.all([
    listRegistrationsForEvents(eventIds),
    listCancellationsForEvents(eventIds),
  ]);
  const cancellationsByEvent = mapLatestCancellationsByEvent(cancellations);
  const revenueContextByEventId = {};
  events.forEach((row) => {
    revenueContextByEventId[row.id] = buildRevenueContext(row, cancellationsByEvent[row.id] || null);
  });

  let totalRevenue = 0;
  let totalTicketsSold = 0;
  const revenueByGroupId = {};
  const ticketsSoldByGroupId = {};

  registrations.forEach((row) => {
    if (!isCountableRegistration(row)) return;
    const groupId = eventOrganiser.get(row.event_id);
    if (!groupId) return;
    const qty = registrationTicketQty(row);
    totalTicketsSold += qty;
    ticketsSoldByGroupId[groupId] = (ticketsSoldByGroupId[groupId] || 0) + qty;
    if (isRevenueCountableRegistration(row, revenueContextByEventId[row.event_id] || {})) {
      const amount = registrationTicketRevenue(row);
      totalRevenue += amount;
      revenueByGroupId[groupId] = (revenueByGroupId[groupId] || 0) + amount;
    }
  });

  totalRevenue = Math.round(totalRevenue * 100) / 100;

  return {
    computed: true,
    totalRevenue,
    totalTicketsSold,
    revenueByGroupId,
    ticketsSoldByGroupId,
    registrations,
    cancellations,
    revenueContextByEventId,
  };
}

/** Sales totals from registrations only — safe when payout tables are missing. */
async function enrichEventsWithRegistrationSales(events) {
  const ids = (events || []).map((e) => e.id).filter(Boolean);
  if (!ids.length) return events || [];
  const [registrations, cancellations] = await Promise.all([
    listRegistrationsForEvents(ids),
    listCancellationsForEvents(ids),
  ]);
  const cancellationsByEvent = mapLatestCancellationsByEvent(cancellations);
  const regsByEvent = {};
  registrations.forEach((row) => {
    if (!regsByEvent[row.event_id]) regsByEvent[row.event_id] = [];
    regsByEvent[row.event_id].push(row);
  });

  return (events || []).map((ev) => {
    const regs = regsByEvent[ev.id] || [];
    const revenueContext = buildRevenueContext(ev, cancellationsByEvent[ev.id] || null);
    const breakdown = calculatePayoutBreakdown(regs, revenueContext);
    const { ticketsSold } = summarizeRegistrationSales(regs);
    const capacity = Number(ev.ticketsCapacity) || 0;
    return {
      ...ev,
      ticketsSold,
      revenueNum: breakdown.amount_gross,
      revenueDisplay: formatGbp(breakdown.amount_gross),
      ticketsSoldLabel: formatTicketsSoldLabel(ticketsSold, capacity),
    };
  });
}

async function getPayoutPreview(session, eventId) {
  const access = await resolveOrganiserAccess(session);
  if (!access.canManagePayments) {
    const e = new Error('Only the account owner can request payouts');
    e.status = 403;
    throw e;
  }

  const sb = getSupabaseAdmin();
  const { row } = await assertOwnedEvent(sb, session, eventId);

  if (String(row.status || '').toLowerCase() === 'published') {
    const anchor = row.ends_at || row.starts_at;
    if (anchor && new Date(anchor) < new Date()) {
      await sb.from('events').update({ status: 'archived' }).eq('id', eventId);
      row.status = 'archived';
    }
  }

  const { data: regs, error: regErr } = await sb
    .from('registrations')
    .select('*')
    .eq('event_id', eventId);
  if (regErr) throw new Error(regErr.message);

  const { data: cancelRows } = await sb
    .from('event_cancellations')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(1);
  const cancellation = cancelRows && cancelRows[0] ? cancelRows[0] : null;
  const revenueContext = buildRevenueContext(row, cancellation);
  const breakdown = calculatePayoutBreakdown(regs || [], revenueContext);
  const ev = {
    status: row.status,
    payoutHeld: Boolean(row.payout_held),
    endDate: row.ends_at,
    date: row.starts_at,
  };

  const { data: payoutRows } = await sb
    .from('organiser_payouts')
    .select('*')
    .eq('event_id', eventId)
    .in('status', ['pending_review', 'approved'])
    .limit(1);
  const payout = payoutRows && payoutRows[0] ? rowToPayout(payoutRows[0]) : null;

  const eligibility = evaluatePayoutEligibility(ev, payout, cancellation, breakdown);

  return {
    eventId,
    eventTitle: row.title,
    breakdown,
    breakdownFormatted: {
      amountGross: formatGbp(breakdown.amount_gross),
      stripeFee: formatGbp(breakdown.stripe_fee),
      platformFee: formatGbp(breakdown.platform_fee),
      amountNet: formatGbp(breakdown.amount_net),
    },
    ...eligibility,
  };
}

async function requestPayout(session, eventId) {
  if (isStripeConnectEnabled()) {
    const e = new Error(CONNECT_PAYOUT_INELIGIBLE);
    e.status = 400;
    throw e;
  }

  const preview = await getPayoutPreview(session, eventId);
  if (!preview.canRequestPayout) {
    const e = new Error(preview.ineligibleReason || 'This event is not eligible for payout');
    e.status = 400;
    throw e;
  }

  const access = await resolveOrganiserAccess(session);
  const sb = getSupabaseAdmin();
  const { breakdown } = preview;

  const { data, error: insertErr } = await sb
    .from('organiser_payouts')
    .insert({
      event_id: eventId,
      organiser_account_id: access.accountId || null,
      status: 'pending_review',
      requested_at: new Date().toISOString(),
      amount_gross: breakdown.amount_gross,
      stripe_fee: breakdown.stripe_fee,
      platform_fee: breakdown.platform_fee,
      amount_net: breakdown.amount_net,
      total_transactions: breakdown.total_transactions,
      amount: breakdown.amount_net,
    })
    .select('*')
    .single();
  if (insertErr) throw new Error(insertErr.message);

  try {
    const { sendPayoutRequestedEmail } = require('./lifecycle-emails');
    const { data: eventRow } = await sb
      .from('events')
      .select('id, title, organiser_id')
      .eq('id', eventId)
      .maybeSingle();
    if (eventRow?.organiser_id) {
      await sendPayoutRequestedEmail(sb, {
        payout: data,
        eventRow,
        organiserId: eventRow.organiser_id,
      });
    }
  } catch (emailErr) {
    console.warn('[payout] request confirmation email failed:', emailErr.message || emailErr);
  }

  return { payout: rowToPayout(data), breakdown };
}

module.exports = {
  listPayoutsForEvents,
  listCancellationsForEvents,
  listRegistrationsForEvents,
  archivePastPublishedEvents,
  enrichEventsWithPayoutData,
  enrichOrganiserWorkspaceSales,
  enrichEventsWithRegistrationSales,
  enrichTicketsWithSales,
  summarizeRegistrationSales,
  buildOrganiserWorkspaceSummary,
  enrichEventPayoutFields,
  getPayoutPreview,
  requestPayout,
  calculatePayoutBreakdown,
  isRevenueCountableRegistration,
  buildRevenueContext,
  mapLatestCancellationsByEvent,
  rowToPayout,
  PAYOUT_STATUS_LABELS,
  isEventArchived,
  getEarliestPayoutDate,
  isSettlementComplete,
  MIN_PAYOUT_NET,
  SETTLEMENT_DAYS,
};
