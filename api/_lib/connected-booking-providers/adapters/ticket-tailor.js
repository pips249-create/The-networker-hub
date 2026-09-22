const { dig, normalizeEmail, normalizeOrderId } = require('./_util');

function ticketTailorOrderFromBody(body) {
  if (!body || typeof body !== 'object') return null;
  const payload = body.payload;
  if (payload && typeof payload === 'object' && String(payload.object || '').toLowerCase() === 'order') {
    return payload;
  }
  if (payload && typeof payload === 'object' && (payload.id || payload.buyer_details)) {
    return payload;
  }
  const data = body.data;
  if (data && typeof data === 'object' && (data.id || data.buyer_details)) {
    return data;
  }
  if (body.id && (body.buyer_details || body.event_summary || body.email)) {
    return body;
  }
  return null;
}

function ticketTailorExternalEventId(order) {
  if (!order || typeof order !== 'object') return '';
  const direct = String(order.event_id || order.eventId || '').trim();
  if (direct) return direct;
  const summary = order.event_summary;
  if (summary && typeof summary === 'object') {
    const fromSummary = String(summary.event_id || summary.id || '').trim();
    if (fromSummary) return fromSummary;
  }
  const tickets = order.issued_tickets;
  if (Array.isArray(tickets) && tickets[0]) {
    const fromTicket = String(tickets[0].event_id || '').trim();
    if (fromTicket) return fromTicket;
  }
  return String(dig(order, [['event', 'id']]) || '').trim();
}

function ticketTailorBuyer(order) {
  const buyer = order && order.buyer_details;
  if (!buyer || typeof buyer !== 'object') {
    return {
      email: normalizeEmail(order?.email || dig(order, [['buyer', 'email']]) || dig(order, [['customer', 'email']])),
      name: String(order?.name || '').trim() || null,
    };
  }
  const email = normalizeEmail(buyer.email);
  const name =
    String(buyer.name || '').trim() ||
    [buyer.first_name, buyer.last_name].filter(Boolean).join(' ').trim() ||
    null;
  return { email, name: name || null };
}

function ticketTailorAmountPaid(order) {
  const currency = order && order.currency;
  const multiplier = Number(currency?.base_multiplier);
  const div = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 100;
  const paidCents = Number(order?.total_paid ?? order?.total ?? order?.amount_paid ?? order?.amountPaid);
  if (!Number.isFinite(paidCents)) return 0;
  return paidCents / div;
}

function ticketTailorQuantity(order) {
  const lineItems = order && order.line_items;
  if (Array.isArray(lineItems) && lineItems.length) {
    let qty = 0;
    for (const row of lineItems) {
      if (!row || typeof row !== 'object') continue;
      if (String(row.type || '').toLowerCase() !== 'ticket') continue;
      qty += Math.max(0, Number(row.quantity) || 0);
    }
    if (qty > 0) return qty;
  }
  const tickets = order && order.issued_tickets;
  if (Array.isArray(tickets) && tickets.length) return tickets.length;
  const raw = Number(order?.quantity ?? order?.ticket_count);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function ticketTailorWebhookEventType(body) {
  return String(body?.event || body?.type || '').trim().toLowerCase();
}

function normalizeTicketTailorWebhook(body) {
  if (!body || typeof body !== 'object') return null;

  const hookType = ticketTailorWebhookEventType(body);
  const order = ticketTailorOrderFromBody(body);
  const root = order || body.payload || body.data || body;

  const externalEventId = ticketTailorExternalEventId(order || root);
  const orderId = String(
    (order && order.id) ||
      root.order_id ||
      root.orderId ||
      (hookType.includes('order') ? '' : root.id) ||
      body.id ||
      ''
  ).trim();

  const buyer = ticketTailorBuyer(order || root);
  const email = buyer.email;
  const name = buyer.name;

  const quantity = ticketTailorQuantity(order || root);
  const amountPaid = ticketTailorAmountPaid(order || root);

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

  const statusRaw = String(
    (order && order.status) || root.status || hookType || ''
  ).toLowerCase();
  let status = 'confirmed';
  if (/cancel|refund|void/.test(statusRaw) || /cancel|refund|void/.test(hookType)) {
    status = 'cancelled';
  } else if (statusRaw === 'pending') {
    status = 'pending';
  }

  return {
    externalEventId,
    orderId: normalizeOrderId('ticket_tailor', orderId),
    email,
    name: name || null,
    quantity,
    amountPaid,
    status,
    provider: 'ticket_tailor',
    webhookEvent: hookType || null,
  };
}

module.exports = {
  normalizeTicketTailorWebhook,
  ticketTailorOrderFromBody,
  ticketTailorExternalEventId,
};
