const { escapeHtml } = require('./event-refund-policy');

function formatBookingReference(registrationId) {
  const raw = String(registrationId || '')
    .replace(/-/g, '')
    .toUpperCase();
  if (raw.length >= 8) return 'HUB-' + raw.slice(0, 8);
  if (raw) return 'HUB-' + raw;
  return '';
}

function formatBookedAt(isoDate) {
  const d = isoDate ? new Date(isoDate) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return date + ' at ' + time;
}

function formatTicketQuantity(quantity, ticketName) {
  const q = parseInt(quantity, 10);
  const count = Number.isFinite(q) && q > 0 ? q : 1;
  const name = String(ticketName || 'Ticket').trim();
  return count + ' \u00d7 ' + name;
}

function isPaidBooking(vars) {
  const status = String(vars.payment_status || '').trim().toLowerCase();
  if (status === 'paid') return true;
  const amount = String(vars.amount_paid || '').trim().toLowerCase();
  if (!amount || amount === 'free') return false;
  const n = Number(String(vars.amount_paid || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0;
}

function summaryLine(label, value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return (
    '<tr><td style="padding:0 0 8px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;line-height:1.5;">' +
    '<span style="color:#635c5e;">' +
    escapeHtml(label) +
    '</span> ' +
    '<span style="color:#4a4446;font-weight:600;">' +
    escapeHtml(text) +
    '</span></td></tr>'
  );
}

function buildPaymentSummaryRow(vars) {
  const ref = String(vars.booking_reference || '').trim();
  if (!ref) return '';

  const site = String(vars.site_url || '').replace(/\/$/, '');
  const paymentUrl =
    String(vars.hub_payment_url || '').trim() ||
    (site && vars.registration_id
      ? site + '/account/?booking=' + encodeURIComponent(String(vars.registration_id)) + '#payments'
      : site
        ? site + '/account/#payments'
        : '');
  const safePaymentUrl = paymentUrl.replace(/"/g, '&quot;');
  const paid = isPaidBooking(vars);

  let rows = '';
  rows += summaryLine('Booking reference:', ref);
  rows += summaryLine('Booked on:', vars.booked_at);
  rows += summaryLine('Tickets:', vars.ticket_quantity_label || formatTicketQuantity(vars.ticket_quantity, vars.ticket_name));
  rows += summaryLine('Total paid:', vars.amount_paid);

  return (
    '<tr><td class="mobile-pad" style="padding:0 48px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:14px;border:1px solid #d9c4e0;">' +
    '<tr><td style="padding:20px 22px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">Payment summary</p>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' +
    rows +
    '</table>' +
    (paymentUrl
      ? '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:14px;">' +
        '<tr><td style="background:#4a4446;border-radius:999px;">' +
        '<a href="' +
        safePaymentUrl +
        '" style="display:inline-block;padding:12px 24px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">View payment details &rarr;</a>' +
        '</td></tr></table>'
      : '') +
    (paid
      ? '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:400;color:#7a7274;line-height:1.5;margin:12px 0 0;">Your card receipt is sent separately by our payment provider.</p>'
      : '') +
    '</td></tr></table></td></tr>'
  );
}

module.exports = {
  formatBookingReference,
  formatBookedAt,
  formatTicketQuantity,
  isPaidBooking,
  buildPaymentSummaryRow,
};
