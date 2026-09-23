const { normalizeEmail, normalizeOrderId } = require('./_util');
const { isUuid } = require('../../uuid');

/** Organiser's own checkout / booking page — payload includes TNH event UUID. */
function normalizeOwnSiteWebhook(body) {
  if (!body || typeof body !== 'object') return null;

  const tnhEventId = String(body.eventId || body.event_id || '').trim();
  const orderId = String(
    body.orderId || body.order_id || body.bookingId || body.booking_id || body.id || ''
  ).trim();

  const email = normalizeEmail(body.email || body.buyerEmail || body.buyer_email);
  const name = String(body.name || body.buyerName || body.buyer_name || '').trim() || null;

  const quantity = Number(body.quantity ?? body.qty ?? 1);
  const amountPaid = Number(body.amountPaid ?? body.amount_paid ?? body.amount ?? 0);

  if (!tnhEventId || !isUuid(tnhEventId) || !orderId || !email) {
    return {
      partial: true,
      tnhEventId: tnhEventId || null,
      orderId: orderId || null,
      email: email || null,
      reason: 'missing_fields',
      provider: 'own_site',
    };
  }

  const statusRaw = String(body.status || body.paymentStatus || '').toLowerCase();
  let status = 'confirmed';
  if (/cancel|refund/.test(statusRaw)) status = 'cancelled';

  return {
    tnhEventId,
    externalEventId: tnhEventId,
    orderId: normalizeOrderId('own_site', orderId),
    email,
    name,
    quantity: Number.isFinite(quantity) ? quantity : 1,
    amountPaid: Number.isFinite(amountPaid) ? amountPaid : 0,
    status,
    provider: 'own_site',
  };
}

module.exports = { normalizeOwnSiteWebhook };
