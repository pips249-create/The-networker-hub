const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { ensureAttendeeId } = require('./supabase-favourites');
const { assertNotBlockedByOrganiser } = require('./organiser-attendee-blocks');
const { isExternalConnectedEvent } = require('./connected-booking');

/**
 * Create or update a registration from an organiser external booking webhook.
 * Idempotent on external_order_id per event.
 */
async function createRegistrationFromExternalBooking(input) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');

  const sb = getSupabaseAdmin();
  const eventId = String(input.eventId || input.event_id || '').trim();
  const externalOrderId = String(input.orderId || input.order_id || input.externalOrderId || '').trim();
  const status = String(input.status || 'confirmed').trim().toLowerCase();

  if (!eventId) throw new Error('missing_event_id');
  if (!externalOrderId) throw new Error('missing_order_id');

  const email = String(input.email || '').trim().toLowerCase();
  if (!email) throw new Error('missing_email');

  const { data: eventRow, error: evErr } = await sb
    .from('events')
    .select('id, organiser_id, checkout_mode, status, approval_status')
    .eq('id', eventId)
    .maybeSingle();
  if (evErr) throw new Error(evErr.message);
  if (!eventRow?.id) {
    const e = new Error('event_not_found');
    e.status = 404;
    throw e;
  }
  if (!isExternalConnectedEvent(eventRow)) {
    const e = new Error('event_not_external_connected');
    e.status = 400;
    throw e;
  }

  const organiserId = eventRow.organiser_id || null;

  const existingRes = await sb
    .from('registrations')
    .select('id, attendee_id, payment_status, cancelled_at')
    .eq('event_id', eventId)
    .eq('external_order_id', externalOrderId)
    .maybeSingle();
  if (existingRes.error) throw new Error(existingRes.error.message);

  if (status === 'cancelled' || status === 'refunded' || status === 'canceled') {
    if (!existingRes.data?.id) {
      return { action: 'ignored', reason: 'no_registration' };
    }
    const patch = {
      payment_status: status === 'refunded' ? 'Refunded' : existingRes.data.payment_status,
      cancelled_at: new Date().toISOString(),
    };
    if (status === 'refunded') patch.payment_status = 'Refunded';
    const upd = await sb.from('registrations').update(patch).eq('id', existingRes.data.id).select('id').single();
    if (upd.error) throw new Error(upd.error.message);
    return { action: 'cancelled', id: existingRes.data.id };
  }

  if (existingRes.data?.id) {
    return { action: 'duplicate', id: existingRes.data.id };
  }

  const name = String(input.name || input.customerName || '').trim() || null;
  const quantity = Math.max(1, Math.min(99, Math.floor(Number(input.quantity ?? input.qty) || 1)));
  const amountPaidRaw = input.amountPaid ?? input.amount_paid;
  const amountPaid =
    amountPaidRaw != null && Number.isFinite(Number(amountPaidRaw)) ? Number(amountPaidRaw) : 0;
  const paymentStatus =
    input.paymentStatus ||
    input.payment_status ||
    (amountPaid > 0 ? 'Paid' : 'Free');

  await assertNotBlockedByOrganiser(sb, {
    organiserId,
    email,
    attendeeId: null,
  });

  const attendeeId = await ensureAttendeeId(sb, { email, name, sub: null });

  const ins = await sb
    .from('registrations')
    .insert({
      attendee_id: attendeeId,
      event_id: eventId,
      organiser_id: organiserId,
      ticket_id: null,
      quantity,
      payment_status: paymentStatus,
      amount_paid: amountPaid,
      application_status: 'Approved',
      booking_source: 'external',
      external_order_id: externalOrderId,
    })
    .select('id, attendee_id, event_id')
    .single();
  if (ins.error) throw new Error(ins.error.message);

  return { action: 'created', id: ins.data.id, registration: ins.data };
}

module.exports = {
  createRegistrationFromExternalBooking,
};
