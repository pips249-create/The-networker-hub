const {
  escapeHtml,
  formatRefundPolicyText,
  formatMultilineHtml,
} = require('./event-refund-policy');
const { wrapSponsorRow, resolveSponsorSection } = require('./booking-email-sections');

function formatAmount(amountPaid) {
  const n = Number(amountPaid);
  if (!Number.isFinite(n) || n <= 0) return 'Free';
  return n % 1 === 0 ? '£' + n.toFixed(0) : '£' + n.toFixed(2);
}

function isPaidRegistration(registration) {
  const status = String(registration?.payment_status || '').trim();
  const amount = Number(registration?.amount_paid);
  return status === 'Paid' && Number.isFinite(amount) && amount > 0;
}

function daysUntilEvent(startsAt) {
  if (!startsAt) return null;
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return null;
  return (start.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
}

function isRefundEligibleForCancellation(eventRow, registration) {
  if (!isPaidRegistration(registration)) return false;
  const policy = String(eventRow?.refund_policy || '').trim();
  if (!policy || policy === 'no_refunds') return false;
  if (policy === 'full_refund') {
    const cutoffDays = eventRow?.refund_cutoff_days;
    const daysLeft = daysUntilEvent(eventRow?.starts_at);
    if (cutoffDays != null && Number.isFinite(Number(cutoffDays)) && daysLeft != null) {
      return daysLeft >= Number(cutoffDays);
    }
    return true;
  }
  return policy === 'partial_refund' || policy === 'custom';
}

function buildRefundStatusLabel(eventRow, registration) {
  if (!isPaidRegistration(registration)) return 'Not applicable';
  if (isRefundEligibleForCancellation(eventRow, registration)) return 'Refund processing';
  return 'No refund due';
}

function buildRefundEligibleRow(amountPaid) {
  const amount = String(amountPaid || '').trim() || 'your ticket price';
  return (
    '<tr><td class="mobile-pad" style="padding:0 48px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0fdf4;border-radius:14px;border:1px solid #86efac;">' +
    '<tr><td style="padding:22px 24px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:2.5px;margin:0 0 6px;">About your refund</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;margin:0 0 10px;line-height:1.35;">Your refund is being processed</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:400;color:#736b6e;line-height:1.65;margin:0;">' +
    'You paid <strong style="color:#4a4446;">' +
    escapeHtml(amount) +
    '</strong>. We are arranging your refund to your original payment method. You will receive a separate confirmation once it has been processed.</p>' +
    '</td></tr></table></td></tr>'
  );
}

function buildNoRefundRow(eventRow) {
  const policyText =
    formatRefundPolicyText(eventRow) ||
    'This cancellation falls outside the organiser refund window. Contact hello@the-networker.co.uk if you need help.';
  return (
    '<tr><td class="mobile-pad" style="padding:0 48px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0;">' +
    '<tr><td style="padding:22px 24px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:2.5px;margin:0 0 6px;">Refund policy</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;margin:0 0 10px;line-height:1.35;">No refund due for this cancellation</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:400;color:#736b6e;line-height:1.65;margin:0;">' +
    formatMultilineHtml(policyText) +
    '</p>' +
    '</td></tr></table></td></tr>'
  );
}

function buildOrganiserMessageRow(message) {
  const text = String(message || '').trim();
  if (!text) return '';
  return (
    '<tr><td class="mobile-pad" style="padding:0 48px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:14px;border:1px solid rgba(194,153,209,0.35);">' +
    '<tr><td style="padding:22px 24px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:2.5px;margin:0 0 6px;">Message from the organiser</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:400;color:#736b6e;line-height:1.65;margin:0;">' +
    formatMultilineHtml(text) +
    '</p>' +
    '</td></tr></table></td></tr>'
  );
}

function buildEventCancelledRefundCopy(registration) {
  const amountPaid = formatAmount(registration?.amount_paid);
  if (!isPaidRegistration(registration)) {
    return {
      refund_headline: 'No payment was taken for this booking',
      refund_details:
        'Your registration has been cancelled. Because this was a free ticket, no refund is needed.',
    };
  }
  return {
    refund_headline: 'A full refund of ' + amountPaid + ' is on its way',
    refund_details:
      'Because this event was cancelled by the organiser, you are entitled to a full refund of the ticket price you paid, including any booking fees shown at checkout.',
  };
}

function enrichBookingCancelledVars(vars, sponsorSection) {
  const input = vars && typeof vars === 'object' ? vars : {};
  const eventRow = input._event_row || {
    refund_policy: input.refund_policy,
    refund_policy_details: input.refund_policy_details,
    refund_cutoff_days: input.refund_cutoff_days,
    starts_at: input.event_starts_at || input.starts_at,
  };
  const registration = input._registration || {
    payment_status: input.payment_status || 'Paid',
    amount_paid: input.amount_paid,
  };
  const eligible = isRefundEligibleForCancellation(eventRow, registration);
  const sponsorRow = wrapSponsorRow(resolveSponsorSection(input, sponsorSection));

  return {
    ...input,
    refund_status: buildRefundStatusLabel(eventRow, registration),
    refund_eligible_row: eligible ? buildRefundEligibleRow(input.amount_paid) : '',
    no_refund_row: eligible ? '' : buildNoRefundRow(eventRow),
    sponsor_row: sponsorRow,
    sponsor_section: sponsorRow,
  };
}

function enrichEventCancelledVars(vars, sponsorSection) {
  const input = vars && typeof vars === 'object' ? vars : {};
  const registration = input._registration || {
    payment_status: input.payment_status || 'Paid',
    amount_paid: input.amount_paid,
  };
  const refundCopy = buildEventCancelledRefundCopy(registration);
  const sponsorRow = wrapSponsorRow(resolveSponsorSection(input, sponsorSection));

  return {
    ...input,
    ...refundCopy,
    organiser_message_row: buildOrganiserMessageRow(input.organiser_message),
    sponsor_row: sponsorRow,
    sponsor_section: sponsorRow,
  };
}

function enrichRefundProcessedVars(vars, sponsorSection) {
  const input = vars && typeof vars === 'object' ? vars : {};
  const sponsorRow = wrapSponsorRow(resolveSponsorSection(input, sponsorSection));
  const refundDate =
    String(input.refund_date || '').trim() ||
    new Date().toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  return {
    ...input,
    refund_amount: String(input.refund_amount || input.amount_paid || '').trim() || '—',
    refund_date: refundDate,
    sponsor_row: sponsorRow,
    sponsor_section: sponsorRow,
  };
}

const BOOKING_CANCELLED_SECTION_PLACEHOLDERS = [
  'refund_eligible_row',
  'no_refund_row',
  'sponsor_row',
  'sponsor_section',
];

const EVENT_CANCELLED_SECTION_PLACEHOLDERS = [
  'organiser_message_row',
  'sponsor_row',
  'sponsor_section',
];

const REFUND_PROCESSED_SECTION_PLACEHOLDERS = ['sponsor_row', 'sponsor_section'];

function stripSectionPlaceholders(html, keys) {
  let out = String(html || '');
  for (const key of keys) {
    const re = new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}', 'g');
    out = out.replace(re, '');
  }
  return out;
}

module.exports = {
  isPaidRegistration,
  isRefundEligibleForCancellation,
  buildRefundStatusLabel,
  buildRefundEligibleRow,
  buildNoRefundRow,
  buildOrganiserMessageRow,
  buildEventCancelledRefundCopy,
  enrichBookingCancelledVars,
  enrichEventCancelledVars,
  enrichRefundProcessedVars,
  stripBookingCancelledPlaceholders: (html) =>
    stripSectionPlaceholders(html, BOOKING_CANCELLED_SECTION_PLACEHOLDERS),
  stripEventCancelledPlaceholders: (html) =>
    stripSectionPlaceholders(html, EVENT_CANCELLED_SECTION_PLACEHOLDERS),
  stripRefundProcessedPlaceholders: (html) =>
    stripSectionPlaceholders(html, REFUND_PROCESSED_SECTION_PLACEHOLDERS),
};
