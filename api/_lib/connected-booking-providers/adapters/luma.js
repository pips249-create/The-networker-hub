const { dig, normalizeEmail, normalizeOrderId } = require('./_util');

function normalizeLumaWebhook(body) {
  if (!body || typeof body !== 'object') return null;

  const root = body.data || body.payload || body;
  const externalEventId = String(
    root.event_id ||
      root.eventId ||
      dig(root, [['event', 'id']]) ||
      dig(root, [['event', 'api_id']]) ||
      body.event_id ||
      ''
  ).trim();

  const orderId = String(
    root.registration_id ||
      root.guest_id ||
      root.id ||
      root.order_id ||
      ''
  ).trim();

  const email = normalizeEmail(
    root.email || dig(root, [['user', 'email']]) || dig(root, [['guest', 'email']])
  );

  const name = String(
    root.name || dig(root, [['user', 'name']]) || dig(root, [['guest', 'name']]) || ''
  ).trim();

  if (!externalEventId || !orderId || !email) {
    return {
      partial: true,
      externalEventId: externalEventId || null,
      orderId: orderId || null,
      email: email || null,
      reason: 'missing_fields',
      provider: 'luma',
    };
  }

  const statusRaw = String(root.status || body.type || '').toLowerCase();
  let status = 'confirmed';
  if (/cancel|declin|refund/.test(statusRaw)) status = 'cancelled';

  return {
    externalEventId,
    orderId: normalizeOrderId('luma', orderId),
    email,
    name: name || null,
    quantity: 1,
    amountPaid: Number(root.amount_paid ?? root.amountPaid ?? 0) || 0,
    status,
    provider: 'luma',
  };
}

module.exports = { normalizeLumaWebhook };
