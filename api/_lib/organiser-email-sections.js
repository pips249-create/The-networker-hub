function wrapSponsorRow(sponsorInner) {
  const inner = String(sponsorInner || '').trim();
  if (!inner) return '';
  if (/^<tr[\s>]/i.test(inner)) return inner;
  return '<tr><td>' + inner + '</td></tr>';
}

function attendeeInitial(name) {
  const text = String(name || '').trim();
  if (!text) return '?';
  return text.charAt(0).toUpperCase();
}

const { escapeHtml } = require('./event-refund-policy');
const { isRefundEligibleForCancellation } = require('./cancellation-email-sections');

function buildOrganiserRefundIssuedRow(amountPaid) {
  const amount = String(amountPaid || '').trim() || 'the ticket price';
  return (
    '<tr><td class="mobile-pad" style="padding:0 48px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0fdf4;border-radius:14px;border:1px solid #86efac;">' +
    '<tr><td style="padding:22px 24px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Refund</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;margin:0 0 10px;line-height:1.35;">Refund issued automatically</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.65;margin:0;">' +
    'A refund of <strong style="color:#4a4446;">' +
    escapeHtml(amount) +
    '</strong> was issued to the attendee under your event policy. It will be debited from your connected Stripe account.</p>' +
    '</td></tr></table></td></tr>'
  );
}

function buildOrganiserRefundRequiredRow(amountPaid, stripeDashboardUrl) {
  const amount = String(amountPaid || '').trim() || 'the ticket price';
  const dashboardUrl = String(stripeDashboardUrl || '').trim();
  const dashboardCta = dashboardUrl
    ? '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0 0;">' +
      '<tr><td style="background:#1c2040;border-radius:999px;">' +
      '<a href="' +
      escapeHtml(dashboardUrl) +
      '" style="display:inline-block;padding:12px 24px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Open Stripe dashboard to refund &rarr;</a>' +
      '</td></tr></table>' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;font-weight:400;color:#635c5e;line-height:1.55;margin:12px 0 0;">Find the payment using the booking reference above, then issue a full refund to the attendee.</p>'
    : '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;font-weight:400;color:#635c5e;line-height:1.55;margin:12px 0 0;">Open <strong>Revenue</strong> in your organiser dashboard and use <strong>Open Stripe dashboard</strong> to find this payment and issue a refund.</p>';
  return (
    '<tr><td class="mobile-pad" style="padding:0 48px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff8e6;border-radius:14px;border:1px solid #f0c674;">' +
    '<tr><td style="padding:22px 24px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#b7791f;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Action required</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;margin:0 0 10px;line-height:1.35;">Refund required</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.65;margin:0;">' +
    'This cancellation is eligible for a refund under your event policy. Please issue a refund of <strong style="color:#4a4446;">' +
    escapeHtml(amount) +
    '</strong> to the attendee from your Stripe Express account.</p>' +
    dashboardCta +
    '</td></tr></table></td></tr>'
  );
}

function buildOrganiserNoRefundRow() {
  return (
    '<tr><td class="mobile-pad" style="padding:0 48px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0;">' +
    '<tr><td style="padding:22px 24px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Refund</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;margin:0 0 10px;line-height:1.35;">No refund due</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.65;margin:0;">' +
    'This cancellation falls outside your refund window or was a free booking. No refund action is needed.</p>' +
    '</td></tr></table></td></tr>'
  );
}

function enrichOrganiserBookingCancelledVars(vars, sponsorSection) {
  const input = enrichOrganiserRegistrationVars(vars, sponsorSection);
  const eventRow = input._event_row;
  const registration = input._registration;
  const paid =
    Number(registration?.amount_paid) > 0 &&
    ['Paid', 'Refunded'].includes(String(registration?.payment_status || '').trim());
  const refundEligible =
    paid &&
    eventRow &&
    isRefundEligibleForCancellation(eventRow, registration, registration?.cancelled_at);
  const refundAutoIssued =
    refundEligible && String(registration?.payment_status || '').trim() === 'Refunded';

  return {
    ...input,
    cancellation_time: String(input.cancellation_time || input.booking_time || '').trim(),
    refund_action_row: refundAutoIssued
      ? buildOrganiserRefundIssuedRow(input.amount_paid)
      : refundEligible
        ? buildOrganiserRefundRequiredRow(input.amount_paid, input.stripe_express_url)
        : paid
          ? buildOrganiserNoRefundRow()
          : '',
  };
}

function enrichOrganiserRegistrationVars(vars, sponsorSection) {
  const input = vars && typeof vars === 'object' ? vars : {};
  const attendeeName = String(input.attendee_name || input.user_name || '').trim() || 'Guest';
  const attendeeEmail = String(input.attendee_email || input.user_email || '').trim();
  const sponsorRow = wrapSponsorRow(sponsorSection);

  return {
    ...input,
    attendee_name: attendeeName,
    attendee_email: attendeeEmail,
    attendee_initial: String(input.attendee_initial || '').trim() || attendeeInitial(attendeeName),
    booking_time: String(input.booking_time || input.booked_at || '').trim(),
    user_name: attendeeName,
    user_email: attendeeEmail,
    sponsor_row: sponsorRow,
    sponsor_section: sponsorRow,
  };
}

const ORGANISER_SECTION_PLACEHOLDERS = ['sponsor_row', 'sponsor_section', 'refund_action_row'];

function stripUnresolvedOrganiserPlaceholders(html) {
  let out = String(html || '');
  for (const key of ORGANISER_SECTION_PLACEHOLDERS) {
    const re = new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}', 'g');
    out = out.replace(re, '');
  }
  return out;
}

module.exports = {
  enrichOrganiserRegistrationVars,
  enrichOrganiserBookingCancelledVars,
  stripUnresolvedOrganiserPlaceholders,
  attendeeInitial,
  ORGANISER_SECTION_PLACEHOLDERS,
};
