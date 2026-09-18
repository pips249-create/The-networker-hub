const { dig, normalizeEmail, normalizeOrderId } = require('./_util');

function normalizeTryBookingWebhook(body) {
  if (!body || typeof body !== 'object') return null;

  const root = body.data || body.payload || body;
  const externalEventId = String(
    root.event_id ||
      root.eventId ||
      root.EventId ||
      dig(root, [['event', 'id']]) ||
      ''
  ).trim();

  const orderId = String(
    root.booking_id || root.order_id || root.id || root.OrderId || ''
  ).trim();

  const email = normalizeEmail(
    root.email || root.Email || dig(root, [['customer', 'email']]) || dig(root, [['attendee', 'email']])
  );

  const name = String(
    root.name ||
      root.Name ||
      dig(root, [['customer', 'name']]) ||
      dig(root, [['attendee', 'name']]) ||
      ''
  ).trim();

  const quantity = Number(root.quantity ?? root.ticket_count ?? 1);
  const amountPaid = Number(root.amount ?? root.total ?? root.amountPaid ?? 0);

  if (!externalEventId || !orderId || !email) {
    return {
      partial: true,
      externalEventId: externalEventId || null,
      orderId: orderId || null,
      email: email || null,
      reason: 'missing_fields',
      provider: 'trybooking',
    };
  }

  const statusRaw = String(root.status || body.type || '').toLowerCase();
  let status = 'confirmed';
  if (/cancel|refund/.test(statusRaw)) status = 'cancelled';

  return {
    externalEventId,
    orderId: normalizeOrderId('trybooking', orderId),
    email,
    name: name || null,
    quantity: Number.isFinite(quantity) ? quantity : 1,
    amountPaid: Number.isFinite(amountPaid) ? amountPaid : 0,
    status,
    provider: 'trybooking',
  };
}

module.exports = { normalizeTryBookingWebhook };
