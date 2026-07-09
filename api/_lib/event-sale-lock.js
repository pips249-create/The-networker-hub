const LOCK_REASON_FIRST_REGISTRATION = 'first_registration';

function isActiveRegistration(row) {
  if (!row) return false;
  if (row.cancelled_at) return false;
  const payment = String(row.payment_status || '').trim();
  if (payment === 'Refunded') return false;
  if (String(row.application_status || '').trim() === 'Denied') return false;
  return true;
}

/**
 * Lock an event after the first booking (paid, free, or application).
 * Idempotent — no-op when already locked.
 */
async function lockEventOnFirstSale(sb, eventId) {
  const id = String(eventId || '').trim();
  if (!id) return { locked: false, newlyLocked: false };

  const { data, error } = await sb
    .from('events')
    .update({
      locked: true,
      locked_reason: LOCK_REASON_FIRST_REGISTRATION,
      locked_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('locked', false)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return { locked: true, newlyLocked: Boolean(data?.id) };
}

async function loadLockedOrActiveSaleEvents(sb, eventIds) {
  const ids = [...new Set((eventIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return [];

  const { data: events, error: evErr } = await sb
    .from('events')
    .select('id, title, locked')
    .in('id', ids);
  if (evErr) throw new Error(evErr.message);

  const lockedIds = new Set((events || []).filter((e) => e.locked).map((e) => e.id));
  const needRegCheck = ids.filter((id) => !lockedIds.has(id));
  const activeSaleIds = new Set(lockedIds);

  if (needRegCheck.length) {
    const { data: regs, error: regErr } = await sb
      .from('registrations')
      .select('event_id, cancelled_at, payment_status, application_status')
      .in('event_id', needRegCheck);
    if (regErr) throw new Error(regErr.message);
    (regs || []).forEach((row) => {
      if (isActiveRegistration(row)) activeSaleIds.add(row.event_id);
    });
  }

  return (events || []).filter((e) => activeSaleIds.has(e.id));
}

function ticketSalesBlockedMessage(blocked) {
  if (!blocked.length) return '';
  const title = String(blocked[0].title || '').trim();
  if (blocked.length === 1 && title) {
    return `“${title}” has ticket sales — cancel the event instead of changing ticket types or refund terms.`;
  }
  if (blocked.length === 1) {
    return 'This event has ticket sales — cancel the event instead of changing ticket types or refund terms.';
  }
  return `${blocked.length} events in this series have ticket sales — cancel those dates instead of changing ticket types.`;
}

async function assertTicketsEditableForEvents(sb, eventIds) {
  const blocked = await loadLockedOrActiveSaleEvents(sb, eventIds);
  if (!blocked.length) return;

  const e = new Error(ticketSalesBlockedMessage(blocked));
  e.status = 409;
  e.code = 'event_has_ticket_sales';
  e.eventIds = blocked.map((ev) => ev.id);
  throw e;
}

module.exports = {
  LOCK_REASON_FIRST_REGISTRATION,
  isActiveRegistration,
  lockEventOnFirstSale,
  loadLockedOrActiveSaleEvents,
  assertTicketsEditableForEvents,
  ticketSalesBlockedMessage,
};
