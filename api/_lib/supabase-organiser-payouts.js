/**
 * Organiser payout requests, eligibility, and fee breakdown.
 */
const { getSupabaseAdmin } = require('./supabase');
const { resolveOrganiserAccess } = require('./supabase-organiser-access');

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
  if (String(row.application_status || '').trim() === 'Denied') return false;
  return payment === 'Paid' || payment === 'Free' || payment === 'Pending';
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

function enrichTicketsWithSales(tickets, registrations) {
  const soldByTicket = new Map();
  const revenueByTicket = new Map();
  (registrations || []).forEach((row) => {
    if (!row.ticket_id || !isCountableRegistration(row)) return;
    const q = registrationTicketQty(row);
    soldByTicket.set(row.ticket_id, (soldByTicket.get(row.ticket_id) || 0) + q);
    if (String(row.payment_status || '').trim() === 'Paid') {
      revenueByTicket.set(
        row.ticket_id,
        (revenueByTicket.get(row.ticket_id) || 0) + Number(row.amount_paid || 0)
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

function calculatePayoutBreakdown(registrations) {
  const paid = (registrations || []).filter((r) => r.payment_status === 'Paid');
  const amount_gross = paid.reduce((sum, r) => sum + Number(r.amount_paid || 0), 0);
  const intentIds = paid.map((r) => r.stripe_payment_intent_id).filter(Boolean);
  const total_transactions = new Set(intentIds).size;
  const stripe_fee = amount_gross * 0.015 + 0.2 * total_transactions;
  const platform_fee = amount_gross * 0.03;
  const amount_net = amount_gross - stripe_fee - platform_fee;

  return {
    amount_gross: Math.round(amount_gross * 100) / 100,
    stripe_fee: Math.round(stripe_fee * 100) / 100,
    platform_fee: Math.round(platform_fee * 100) / 100,
    amount_net: Math.round(amount_net * 100) / 100,
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
  if (!eventIds.length) return [];
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('event_cancellations')
    .select('*')
    .in('event_id', eventIds)
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw new Error(error.message);
  }
  return data || [];
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

function evaluatePayoutEligibility(ev, payout, cancellation, breakdown) {
  const payoutHeld = Boolean(ev.payoutHeld);
  const cancelled = String(ev.status || '').toLowerCase() === 'cancelled';
  const archived = isEventArchived(ev);
  const settlementComplete = isSettlementComplete(ev);
  const earliestPayoutDate = getEarliestPayoutDate(ev);
  const pendingPayout =
    payout && (payout.status === 'pending_review' || payout.status === 'approved');
  const aboveMinimum = breakdown.amount_net > MIN_PAYOUT_NET;

  const canRequestPayout =
    archived &&
    !cancelled &&
    !payoutHeld &&
    !pendingPayout &&
    settlementComplete &&
    aboveMinimum;

  let ineligibleReason = null;
  if (!archived) {
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

  return events.map((ev) => {
    const regs = regsByEvent[ev.id] || [];
    const breakdown = calculatePayoutBreakdown(regs);
    const { ticketsSold } = summarizeRegistrationSales(regs);
    const capacity = Number(ev.ticketsCapacity) || 0;
    const withSales = {
      ...ev,
      ticketsSold,
      revenueNum: breakdown.amount_gross,
      revenueDisplay: formatGbp(breakdown.amount_gross),
      ticketsSoldLabel:
        capacity > 0
          ? `${ticketsSold} / ${capacity}`
          : ticketsSold > 0
            ? String(ticketsSold)
            : '0',
    };
    return enrichEventPayoutFields(
      withSales,
      payoutsByEvent[ev.id] || null,
      cancellationsByEvent[ev.id] || null,
      breakdown
    );
  });
}

async function enrichOrganiserWorkspaceSales(events, tickets) {
  const enrichedEvents = await enrichEventsWithPayoutData(events);
  const eventIds = enrichedEvents.map((e) => e.id).filter(Boolean);
  const registrations = await listRegistrationsForEvents(eventIds);
  const enrichedTickets = enrichTicketsWithSales(tickets, registrations);
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
      let query = sb.from('events').select('id, organiser_id');
      if (chunk.length === 1) query = query.eq('organiser_id', chunk[0]);
      else query = query.in('organiser_id', chunk);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (data?.length) events.push(...data);
    }
  }

  const eventOrganiser = new Map(events.map((row) => [row.id, row.organiser_id]));
  const eventIds = events.map((row) => row.id).filter(Boolean);
  const registrations = await listRegistrationsForEvents(eventIds);

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
    if (String(row.payment_status || '').trim() === 'Paid') {
      const amount = Number(row.amount_paid || 0);
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
  };
}

/** Sales totals from registrations only — safe when payout tables are missing. */
async function enrichEventsWithRegistrationSales(events) {
  const ids = (events || []).map((e) => e.id).filter(Boolean);
  if (!ids.length) return events || [];
  const registrations = await listRegistrationsForEvents(ids);
  const regsByEvent = {};
  registrations.forEach((row) => {
    if (!regsByEvent[row.event_id]) regsByEvent[row.event_id] = [];
    regsByEvent[row.event_id].push(row);
  });

  return (events || []).map((ev) => {
    const regs = regsByEvent[ev.id] || [];
    const breakdown = calculatePayoutBreakdown(regs);
    const { ticketsSold } = summarizeRegistrationSales(regs);
    const capacity = Number(ev.ticketsCapacity) || 0;
    return {
      ...ev,
      ticketsSold,
      revenueNum: breakdown.amount_gross,
      revenueDisplay: formatGbp(breakdown.amount_gross),
      ticketsSoldLabel:
        capacity > 0
          ? `${ticketsSold} / ${capacity}`
          : ticketsSold > 0
            ? String(ticketsSold)
            : '0',
    };
  });
}

async function getPayoutPreview(session, eventId) {
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

  const breakdown = calculatePayoutBreakdown(regs || []);
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

  const { data: cancelRows } = await sb
    .from('event_cancellations')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(1);
  const cancellation = cancelRows && cancelRows[0] ? cancelRows[0] : null;

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
  rowToPayout,
  PAYOUT_STATUS_LABELS,
  isEventArchived,
  getEarliestPayoutDate,
  isSettlementComplete,
  MIN_PAYOUT_NET,
  SETTLEMENT_DAYS,
};
