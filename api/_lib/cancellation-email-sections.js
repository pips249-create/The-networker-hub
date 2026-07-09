const {
  escapeHtml,
  formatRefundPolicyText,
  formatMultilineHtml,
} = require('./event-refund-policy');
const { wrapSponsorRow, resolveSponsorSection } = require('./booking-email-sections');
const { supportEmail } = require('./hub-email-urls');

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

const { effectiveRefundCutoffDays } = require('./event-refund-policy');

const DEFAULT_FULL_REFUND_CUTOFF_DAYS = 7;

function resolveAsOfDate(asOf) {
  if (!asOf) return new Date();
  const d = asOf instanceof Date ? asOf : new Date(asOf);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function daysUntilEvent(startsAt, asOf) {
  if (!startsAt) return null;
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return null;
  const now = resolveAsOfDate(asOf);
  return (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
}

function effectiveRefundCutoffDaysForPolicy(eventRow) {
  return effectiveRefundCutoffDays(eventRow) ?? DEFAULT_FULL_REFUND_CUTOFF_DAYS;
}

function isWithinFullRefundWindow(eventRow, asOf) {
  const policy = String(eventRow?.refund_policy || '').trim();
  if (policy !== 'full_refund') return false;
  const daysLeft = daysUntilEvent(eventRow?.starts_at, asOf);
  if (daysLeft == null) return false;
  const cutoffDays = effectiveRefundCutoffDaysForPolicy(eventRow);
  return daysLeft >= cutoffDays;
}

function isRefundEligibleForCancellation(eventRow, registration, asOf) {
  if (!isPaidRegistration(registration)) return false;
  const policy = String(eventRow?.refund_policy || '').trim();
  if (!policy || policy === 'no_refunds') return false;
  if (policy === 'full_refund') {
    return isWithinFullRefundWindow(eventRow, asOf);
  }
  return false;
}

function isSelfServiceCancellationAllowed(eventRow, registration, asOf) {
  if (registration?.cancelled_at || String(registration?.payment_status || '').trim() === 'Refunded') {
    return false;
  }
  if (String(registration?.application_status || '').trim() === 'Denied') return false;
  if (String(eventRow?.status || '').toLowerCase() === 'cancelled') return false;

  const startsAt = eventRow?.starts_at ? new Date(eventRow.starts_at) : null;
  const now = resolveAsOfDate(asOf);
  if (startsAt && !Number.isNaN(startsAt.getTime()) && startsAt.getTime() < now.getTime()) {
    return false;
  }

  if (!isPaidRegistration(registration)) return true;

  const policy = String(eventRow?.refund_policy || '').trim();
  if (policy === 'no_refunds') return false;
  if (policy === 'full_refund') return isWithinFullRefundWindow(eventRow, asOf);
  return true;
}

function cancellationBlockedMessage(eventRow) {
  const policy = String(eventRow?.refund_policy || '').trim();
  if (policy === 'no_refunds') {
    return 'This event\'s refund policy does not allow cancellations. Contact the organiser if you need help.';
  }
  if (policy === 'full_refund') {
    const cutoffDays = effectiveRefundCutoffDaysForPolicy(eventRow);
    return (
      'The organiser\'s refund policy only allows cancellations with a refund up to ' +
      cutoffDays +
      ' day' +
      (cutoffDays === 1 ? '' : 's') +
      ' before the event. Contact the organiser if you need help.'
    );
  }
  return 'This booking cannot be cancelled from your account right now.';
}

function isOrganiserCancelledEvent(eventRow) {
  return String(eventRow?.status || '').trim().toLowerCase() === 'cancelled';
}

function wasPaidRegistration(registration) {
  const status = String(registration?.payment_status || '').trim();
  const amount = Number(registration?.amount_paid);
  return (
    Number.isFinite(amount) &&
    amount > 0 &&
    (status === 'Paid' || status === 'Refunded')
  );
}

function deriveRefundStatusForCancelledRegistration(eventRow, registration) {
  if (!registration?.cancelled_at) return null;
  if (!wasPaidRegistration(registration)) return 'none';

  const paymentStatus = String(registration?.payment_status || '').trim();
  if (registration.refund_email_sent_at || paymentStatus === 'Refunded') {
    return 'completed';
  }

  const eligibleAtCancel =
    isOrganiserCancelledEvent(eventRow) ||
    isRefundEligibleForCancellation(eventRow, registration, registration.cancelled_at);
  if (!eligibleAtCancel) return 'none';
  return 'pending';
}

function buildRefundStatusLabel(eventRow, registration) {
  if (!isPaidRegistration(registration)) return 'Not applicable';
  if (isRefundEligibleForCancellation(eventRow, registration)) return 'Refund processing';
  return 'No refund due';
}

function buildRefundIssuedRow(amountPaid) {
  const amount = String(amountPaid || '').trim() || 'your ticket price';
  return (
    '<tr><td class="mobile-pad" style="padding:0 48px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0fdf4;border-radius:14px;border:1px solid #86efac;">' +
    '<tr><td style="padding:22px 24px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">About your refund</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;margin:0 0 10px;line-height:1.35;">Your refund has been issued</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.65;margin:0;">' +
    'A refund of <strong style="color:#4a4446;">' +
    escapeHtml(amount) +
    '</strong> is on its way to your original payment method. Allow 5–10 business days. You will receive a separate email once Stripe confirms it.</p>' +
    '</td></tr></table></td></tr>'
  );
}

function buildRefundEligibleRow(amountPaid) {
  const amount = String(amountPaid || '').trim() || 'your ticket price';
  return (
    '<tr><td class="mobile-pad" style="padding:0 48px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0fdf4;border-radius:14px;border:1px solid #86efac;">' +
    '<tr><td style="padding:22px 24px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">About your refund</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;margin:0 0 10px;line-height:1.35;">Your refund is being processed</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.65;margin:0;">' +
    'You paid <strong style="color:#4a4446;">' +
    escapeHtml(amount) +
    '</strong>. We are arranging your refund to your original payment method. You will receive a separate confirmation once it has been processed.</p>' +
    '</td></tr></table></td></tr>'
  );
}

function buildNoRefundRow(eventRow) {
  const policyText =
    formatRefundPolicyText(eventRow) ||
    'This cancellation falls outside the organiser refund window. Contact ' +
    supportEmail() +
    ' if you need help.';
  return (
    '<tr><td class="mobile-pad" style="padding:0 48px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0;">' +
    '<tr><td style="padding:22px 24px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Refund policy</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;margin:0 0 10px;line-height:1.35;">No refund due for this cancellation</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.65;margin:0;">' +
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
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Message from the organiser</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.65;margin:0;">' +
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
    cancelled_at: input.cancelled_at,
  };
  const paid =
    Number(registration?.amount_paid) > 0 &&
    ['Paid', 'Refunded'].includes(String(registration?.payment_status || '').trim());
  const eligible =
    paid &&
    isRefundEligibleForCancellation(eventRow, registration, registration?.cancelled_at);
  const refundIssued =
    Boolean(input.refund_issued) ||
    (eligible && String(registration?.payment_status || '').trim() === 'Refunded');
  const sponsorRow = wrapSponsorRow(resolveSponsorSection(input, sponsorSection));

  let refundStatus = 'Not applicable';
  if (paid) {
    if (refundIssued) refundStatus = 'Refund issued';
    else if (eligible) refundStatus = 'Refund processing';
    else refundStatus = 'No refund due';
  }

  return {
    ...input,
    refund_status: refundStatus,
    refund_eligible_row: eligible && !refundIssued ? buildRefundEligibleRow(input.amount_paid) : '',
    refund_issued_row: refundIssued ? buildRefundIssuedRow(input.amount_paid) : '',
    no_refund_row: paid && !eligible && !refundIssued ? buildNoRefundRow(eventRow) : '',
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
  'refund_issued_row',
  'no_refund_row',
  'sponsor_row',
  'mini_sponsors_row',
  'sponsor_section',
];

const EVENT_CANCELLED_SECTION_PLACEHOLDERS = [
  'organiser_message_row',
  'sponsor_row',
  'mini_sponsors_row',
  'sponsor_section',
];

const REFUND_PROCESSED_SECTION_PLACEHOLDERS = ['sponsor_row', 'mini_sponsors_row', 'sponsor_section'];

function stripSectionPlaceholders(html, keys) {
  let out = String(html || '');
  for (const key of keys) {
    const re = new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}', 'g');
    out = out.replace(re, '');
  }
  return out;
}

module.exports = {
  DEFAULT_FULL_REFUND_CUTOFF_DAYS,
  effectiveRefundCutoffDaysForPolicy,
  isPaidRegistration,
  wasPaidRegistration,
  daysUntilEvent,
  effectiveRefundCutoffDays,
  isWithinFullRefundWindow,
  isRefundEligibleForCancellation,
  isSelfServiceCancellationAllowed,
  isOrganiserCancelledEvent,
  cancellationBlockedMessage,
  deriveRefundStatusForCancelledRegistration,
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
