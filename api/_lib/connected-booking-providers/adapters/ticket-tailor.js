const { dig, normalizeEmail, normalizeOrderId } = require('./_util');

function normalizeTicketTailorWebhook(body) {
  if (!body || typeof body !== 'object') return null;

  const root = body.payload || body.data || body;
  const externalEventId = String(
    root.event_id ||
      root.eventId ||
      dig(root, [['event', 'id']]) ||
      dig(body, [['event', 'id']]) ||
      ''
  ).trim();

  const orderId = String(
    root.id || root.order_id || root.orderId || body.id || ''
  ).trim();

  const email = normalizeEmail(
    root.email || dig(root, [['buyer', 'email']]) || dig(root, [['customer', 'email']])
  );

  const name = String(
    root.name || dig(root, [['buyer', 'name']]) || dig(root, [['customer', 'name']]) || ''
  ).trim();

  const quantity = Number(root.quantity ?? root.ticket_count ?? 1);
  const amountPaid = Number(root.total ?? root.amount_paid ?? root.amountPaid ?? 0);

  if (!externalEventId || !orderId || !email) {
    return {
      partial: true,
      externalEventId: externalEventId || null,
      orderId: orderId || null,
      email: email || null,
      reason: 'missing_fields',
      provider: 'ticket_tailor',
    };
  }

  const statusRaw = String(root.status || body.type || '').toLowerCase();
  let status = 'confirmed';
  if (/cancel|refund/.test(statusRaw)) status = 'cancelled';

  return {
    externalEventId,
    orderId: normalizeOrderId('ticket_tailor', orderId),
    email,
    name: name || null,
    quantity: Number.isFinite(quantity) ? quantity : 1,
    amountPaid: Number.isFinite(amountPaid) ? amountPaid : 0,
    status,
    provider: 'ticket_tailor',
  };
}

module.exports = { normalizeTicketTailorWebhook };
