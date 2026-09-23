const { isUuid } = require('./uuid');
const {
  connectedBookingAllowedForOrganiserAccountId,
  verifyWebhookSignature,
  loadOrganiserAccountForOrganiserId,
  isConnectedPlanActive,
  logExternalSync,
} = require('./connected-booking');
const { createRegistrationFromExternalBooking } = require('./external-booking-registrations');

async function ingestConnectedBookingRegistration({
  sb,
  account,
  eventId,
  body,
  logPayload,
  providerLabel,
}) {
  if (!account?.id) {
    const e = new Error('unknown_account');
    e.status = 401;
    throw e;
  }

  const accountAllowed = await connectedBookingAllowedForOrganiserAccountId(sb, account.id);
  if (!accountAllowed) {
    const e = new Error('connected_booking_disabled');
    e.status = 403;
    throw e;
  }

  if (!isConnectedPlanActive(account)) {
    const e = new Error('connected_booking_inactive');
    e.status = 403;
    throw e;
  }

  if (!isUuid(eventId)) {
    const e = new Error('invalid_event_id');
    e.status = 400;
    throw e;
  }

  const evOwn = await sb.from('events').select('organiser_id').eq('id', eventId).maybeSingle();
  if (evOwn.error) throw new Error(evOwn.message);
  const ownerAccount = await loadOrganiserAccountForOrganiserId(sb, evOwn.data?.organiser_id);
  if (!ownerAccount || ownerAccount.id !== account.id) {
    const e = new Error('event_not_on_account');
    e.status = 403;
    throw e;
  }

  const result = await createRegistrationFromExternalBooking({
    eventId,
    orderId: body.orderId || body.order_id,
    email: body.email,
    name: body.name,
    quantity: body.quantity ?? body.qty,
    amountPaid: body.amountPaid ?? body.amount_paid,
    paymentStatus: body.paymentStatus || body.payment_status,
    status: body.status,
  });

  await logExternalSync(sb, {
    organiser_account_id: account.id,
    organiser_id: evOwn.data?.organiser_id || null,
    event_id: eventId,
    external_order_id: String(body.orderId || body.order_id || ''),
    outcome: result.action === 'duplicate' ? 'duplicate' : 'accepted',
    http_status: 200,
    message: providerLabel ? providerLabel + ':' + result.action : result.action,
    payload: logPayload || { email: body.email, status: body.status },
  });

  return result;
}

async function ingestWithHmac({ sb, account, eventId, body, raw, signature }) {
  const secret = String(account.connected_booking_webhook_secret || '').trim();
  if (!secret || !verifyWebhookSignature(secret, raw, signature)) {
    await logExternalSync(sb, {
      organiser_account_id: account?.id || null,
      event_id: eventId || null,
      outcome: 'rejected',
      http_status: 401,
      message: 'invalid_signature',
      external_order_id: String(body?.orderId || body?.order_id || ''),
      payload: { eventId },
    });
    const e = new Error('invalid_signature');
    e.status = 401;
    throw e;
  }

  return ingestConnectedBookingRegistration({
    sb,
    account,
    eventId,
    body,
    logPayload: { email: body.email, status: body.status },
    providerLabel: 'custom',
  });
}

module.exports = {
  ingestConnectedBookingRegistration,
  ingestWithHmac,
};
