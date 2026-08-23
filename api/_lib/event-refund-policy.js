function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeEventRefundRow(row) {
  const input = row && typeof row === 'object' ? row : {};
  const policy = String(input.refund_policy || input.refundPolicy || '').trim();
  const details = String(input.refund_policy_details || input.refundPolicyDetails || '').trim();
  const cutoffRaw = input.refund_cutoff_days ?? input.refundCutoffDays;
  const cutoff =
    cutoffRaw != null && Number.isFinite(Number(cutoffRaw)) ? Math.max(0, Number(cutoffRaw)) : null;
  return {
    refund_policy: policy,
    refund_policy_details: details,
    refund_cutoff_days: cutoff,
  };
}

function formatMultilineHtml(text) {
  return escapeHtml(text).replace(/\r?\n/g, '<br>');
}

function inferMeetingType(row) {
  const fmt = String(row?.meeting_type || '').trim();
  if (fmt) return fmt;
  if (String(row?.meeting_link || '').trim()) return 'Online';
  if (row?.venue || row?.postcode || row?.city || row?.location_label) return 'In person';
  return 'In person';
}

function isOnlineEvent(row, meetingLink) {
  const fmt = String(row?.meeting_type || '').trim().toLowerCase();
  if (fmt.includes('online')) return true;
  if (fmt.includes('person') || fmt === 'in person') return false;
  const link = String(meetingLink || row?.meeting_link || '').trim();
  if (link) return true;
  return false;
}

function effectiveRefundCutoffDays(eventRow) {
  const normalized = normalizeEventRefundRow(eventRow);
  const policy = normalized.refund_policy;
  if (policy !== 'full_refund') return null;
  if (normalized.refund_cutoff_days != null) return normalized.refund_cutoff_days;
  return 7;
}

const VALID_REFUND_POLICIES = new Set(['full_refund', 'partial_refund', 'no_refunds', 'custom']);

function hasValidRefundPolicy(eventRow) {
  const normalized = normalizeEventRefundRow(eventRow);
  const policy = normalized.refund_policy;
  if (!VALID_REFUND_POLICIES.has(policy)) return false;
  if ((policy === 'partial_refund' || policy === 'custom') && !normalized.refund_policy_details) {
    return false;
  }
  return true;
}

function assertRefundPolicyForPaidCheckout(eventRow) {
  if (!hasValidRefundPolicy(eventRow)) {
    const err = new Error(
      'Paid bookings are not available until the organiser sets a refund policy on this event.'
    );
    err.status = 400;
    err.code = 'refund_policy_required';
    throw err;
  }
  const ev = eventRow && typeof eventRow === 'object' ? eventRow : {};
  if (!ev.refund_terms_agreed && !ev.refund_terms_agreed_at) {
    const err = new Error(
      'Paid bookings are not available until the organiser confirms refund responsibilities.'
    );
    err.status = 400;
    err.code = 'refund_terms_required';
    throw err;
  }
}

function validateRefundPublishPayload(refundPayload) {
  const policy = String(refundPayload?.refundPolicy || '').trim();
  if (!VALID_REFUND_POLICIES.has(policy)) {
    return { ok: false, code: 'refund_policy_required', message: 'Select a refund policy before publishing.' };
  }
  if (policy === 'partial_refund') {
    return {
      ok: false,
      code: 'partial_refund_not_supported',
      message: 'Partial refunds are no longer available. Choose a full refund, no-refund, or custom policy.',
    };
  }
  const details = String(refundPayload?.refundPolicyDetails || '').trim();
  if (policy === 'custom' && !details) {
    return {
      ok: false,
      code: 'refund_policy_details_required',
      message: 'Describe your custom refund policy before publishing.',
    };
  }
  if (!refundPayload?.refundTermsAgreed) {
    return {
      ok: false,
      code: 'refund_terms_required',
      message: 'Confirm you understand refunds are your responsibility under Stripe Connect.',
    };
  }
  return { ok: true };
}

function fullRefundPresetLabel(cutoffDays) {
  const n = Number(cutoffDays);
  if (n === 2 || n === 1) return 'Flexible refunds';
  if (n === 7) return 'Standard refunds';
  if (n === 14 || n === 3) return 'Strict refunds (B2B)';
  return 'Full refunds available';
}

function fullRefundPresetText(cutoffDays) {
  const n = effectiveRefundCutoffDays({ refund_policy: 'full_refund', refund_cutoff_days: cutoffDays });
  if (n === 2) {
    return 'Full refunds are available up to 48 hours before the event. After that, cancellations are not available from your account.';
  }
  if (n === 1) {
    return 'Full refunds are available up to 24 hours before the event. After that, cancellations are not available from your account.';
  }
  return (
    'Full refunds are available up to ' +
    n +
    ' day' +
    (n === 1 ? '' : 's') +
    ' before the event. After that, cancellations are not available from your account.'
  );
}

function formatRefundPolicyLabel(eventRow) {
  const normalized = normalizeEventRefundRow(eventRow);
  const policy = normalized.refund_policy;
  if (policy === 'full_refund') return fullRefundPresetLabel(normalized.refund_cutoff_days);
  if (policy === 'partial_refund') return 'Partial refunds';
  if (policy === 'no_refunds') return 'Non-refundable';
  if (
    policy === 'custom' &&
    /^100% refund up to 7 days/i.test(normalized.refund_policy_details)
  ) {
    return 'Standard refunds';
  }
  if (policy === 'custom') return 'Refund policy';
  return '';
}

function formatRefundPolicyText(eventRow) {
  const normalized = normalizeEventRefundRow(eventRow);
  const policy = normalized.refund_policy;
  if (!policy) {
    return 'No refund policy has been set for this event. Contact the organiser before booking.';
  }
  if (policy === 'full_refund') {
    return fullRefundPresetText(normalized.refund_cutoff_days);
  }
  if (policy === 'partial_refund') {
    return normalized.refund_policy_details || 'Partial refunds apply — see organiser terms.';
  }
  if (policy === 'no_refunds') {
    return 'No refund is offered if you change your mind or cannot attend. This does not affect your statutory rights if the event is cancelled, materially changed, or not provided as described. The 14-day cooling-off right generally does not apply to leisure events on a specific date.';
  }
  if (policy === 'custom') {
    return normalized.refund_policy_details || 'See organiser refund policy.';
  }
  return 'See organiser refund policy.';
}

function buildRefundPolicySection(eventRow, siteUrl) {
  const normalized = normalizeEventRefundRow(eventRow);
  const policy = normalized.refund_policy;
  if (!policy) return '';
  const label = formatRefundPolicyLabel(normalized);
  const text = formatRefundPolicyText(normalized);
  const site = String(siteUrl || '').replace(/\/$/, '');
  const refundsHref = site
    ? site + '/legal-policies#refunds'
    : 'https://the-networker-hub.vercel.app/legal-policies#refunds';
  return (
    '<tr><td class="mobile-pad" style="padding:0 48px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#faf7f2;border-radius:14px;border:1px solid #d9c4e0;">' +
    '<tr><td style="padding:20px 22px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Refund policy</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;margin:0 0 8px;line-height:1.4;">' +
    escapeHtml(label) +
    '</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.65;margin:0;">' +
    formatMultilineHtml(text) +
    '</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:400;color:#7a7274;line-height:1.5;margin:12px 0 0;">Set by the event organiser. Platform terms: ' +
    '<a href="' +
    escapeHtml(refundsHref) +
    '" style="color:#9a7aa8;text-decoration:none;">Refunds policy</a>.</p>' +
    '</td></tr></table></td></tr>'
  );
}

function buildEventLocationRow(location, isOnline) {
  if (isOnline) return '';
  const loc = String(location || '').trim();
  if (!loc) return '';
  return (
    '<tr><td style="padding:6px 0 0;font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.5;">' +
    '<span style="color:rgba(255,255,255,0.55);">Location</span><br>' +
    '<span style="color:#ffffff;font-weight:600;">' +
    escapeHtml(loc) +
    '</span></td></tr>'
  );
}

function buildEventOnlineRow(isOnline) {
  if (!isOnline) return '';
  return (
    '<tr><td style="padding:6px 0 0;font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.5;">' +
    '<span style="color:rgba(255,255,255,0.55);">Format</span><br>' +
    '<span style="color:#ffffff;font-weight:600;">Online event</span></td></tr>'
  );
}

module.exports = {
  VALID_REFUND_POLICIES,
  escapeHtml,
  formatMultilineHtml,
  normalizeEventRefundRow,
  hasValidRefundPolicy,
  assertRefundPolicyForPaidCheckout,
  validateRefundPublishPayload,
  inferMeetingType,
  isOnlineEvent,
  effectiveRefundCutoffDays,
  formatRefundPolicyLabel,
  formatRefundPolicyText,
  buildRefundPolicySection,
  buildEventLocationRow,
  buildEventOnlineRow,
};
