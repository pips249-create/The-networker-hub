const { escapeHtml, formatMultilineHtml } = require('./event-refund-policy');
const { wrapSponsorRow, resolveSponsorSection } = require('./booking-email-sections');

function buildRemovalDetailsRow(details) {
  const text = String(details || '').trim();
  if (!text) return '';
  return (
    '<tr><td class="mobile-pad" style="padding:0 40px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#1c2040;border-radius:16px;">' +
    '<tr><td style="padding:24px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Additional details</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;line-height:1.65;color:#ffffff;margin:0;">' +
    formatMultilineHtml(text) +
    '</p></td></tr></table></td></tr>'
  );
}

function buildRefundNoticeRow(paidBookings, refundsConfirmed) {
  const count = Math.max(0, Number(paidBookings) || 0);
  if (count < 1) return '';
  const headline = refundsConfirmed
    ? count === 1
      ? '1 paying attendee has been refunded automatically'
      : count + ' paying attendees have been refunded automatically'
    : count === 1
      ? '1 paying attendee will receive an automatic refund'
      : count + ' paying attendees will receive automatic refunds';
  return (
    '<tr><td class="mobile-pad" style="padding:0 40px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0fdf4;border-radius:14px;border:1px solid #86efac;">' +
    '<tr><td style="padding:22px 24px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Attendee refunds</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;margin:0 0 10px;line-height:1.35;">' +
    escapeHtml(headline) +
    '</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.65;margin:0;">' +
    'Refunds go to each attendee\'s original payment method. Allow 5–10 business days. Booking fees shown at checkout are included.</p>' +
    '</td></tr></table></td></tr>'
  );
}

function enrichEventRemovedByHubVars(vars, sponsorSection) {
  const input = vars && typeof vars === 'object' ? vars : {};
  const sponsorRow = wrapSponsorRow(resolveSponsorSection(input, sponsorSection));
  const paidBookings = Math.max(0, Number(input.paid_bookings) || 0);
  const refundsConfirmed = Boolean(String(input.refunds_confirmed || '').trim());

  return {
    ...input,
    removal_reason: String(input.removal_reason || '').trim() || 'Hub policy',
    removal_details_row: buildRemovalDetailsRow(input.removal_details),
    refund_notice_row: buildRefundNoticeRow(paidBookings, refundsConfirmed),
    sponsor_row: sponsorRow,
    sponsor_section: sponsorRow,
  };
}

const EVENT_REMOVED_SECTION_PLACEHOLDERS = [
  'removal_details_row',
  'refund_notice_row',
  'sponsor_row',
  'mini_sponsors_row',
  'sponsor_section',
];

module.exports = {
  enrichEventRemovedByHubVars,
  stripEventRemovedByHubPlaceholders: (html) => {
    let out = String(html || '');
    for (const key of EVENT_REMOVED_SECTION_PLACEHOLDERS) {
      const re = new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}', 'g');
      out = out.replace(re, '');
    }
    return out;
  },
};
