const {
  isOnlineEvent,
  buildRefundPolicySection,
  buildEventLocationRow,
  buildEventOnlineRow,
  escapeHtml,
} = require('./event-refund-policy');

const META_CELL =
  'padding:0 0 10px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;color:rgba(255,255,255,0.75);line-height:1.5;';

function metaRow(label, value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return (
    '<tr><td style="' +
    META_CELL +
    '">' +
    '<span style="color:rgba(255,255,255,0.55);">' +
    escapeHtml(label) +
    '</span><br>' +
    '<span style="color:#ffffff;font-weight:600;">' +
    escapeHtml(text) +
    '</span></td></tr>'
  );
}

function buildEventMetaRows(vars, online) {
  let rows = '';
  rows += metaRow('Date', vars.event_date);
  rows += metaRow('Time', vars.event_time);
  if (online) {
    rows += metaRow('Format', 'Online event');
  } else {
    rows += metaRow('Location', vars.event_location);
  }
  return rows;
}

function buildMeetingLinkRow(link, online) {
  const url = String(link || '').trim();
  if (!online || !url) return '';
  const safeUrl = url.replace(/"/g, '&quot;');
  return (
    '<tr><td class="mobile-pad" style="padding:0 48px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:14px;border:1px solid #d9c4e0;">' +
    '<tr><td style="padding:20px 24px;text-align:center;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:11px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:2.5px;margin:0 0 8px;">Join online</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;font-weight:400;color:#736b6e;line-height:1.6;margin:0 0 14px;">Use the link below when the event starts.</p>' +
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">' +
    '<tr><td style="background:#9a7aa8;border-radius:999px;">' +
    '<a href="' +
    safeUrl +
    '" style="display:inline-block;padding:12px 32px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;">Join online &rarr;</a>' +
    '</td></tr></table></td></tr></table></td></tr>'
  );
}

function buildRefundPolicyRow(vars) {
  return buildRefundPolicySection(
    {
      refund_policy: vars.refund_policy,
      refund_policy_details: vars.refund_policy_details,
      refund_cutoff_days: vars.refund_cutoff_days,
    },
    vars.site_url
  );
}

function wrapSponsorRow(sponsorInner) {
  const inner = String(sponsorInner || '').trim();
  if (!inner) return '';
  if (/^<tr[\s>]/i.test(inner)) return inner;
  return '<tr><td>' + inner + '</td></tr>';
}

/**
 * Build all dynamic table rows for the booking confirmation email.
 * Always runs server-side so test sends and production sends match.
 */
function enrichBookingConfirmationVars(vars, sponsorSection) {
  const input = vars && typeof vars === 'object' ? vars : {};
  const meetingLink = String(input.meeting_link || '').trim();
  const eventRow = {
    meeting_type: input.meeting_type,
    meeting_link: meetingLink,
    venue: input.event_location,
    location_label: input.event_location,
  };
  const online = isOnlineEvent(eventRow, meetingLink);

  const eventMetaRows = buildEventMetaRows(input, online);
  const meetingLinkRow = buildMeetingLinkRow(meetingLink, online);
  const refundPolicyRow = buildRefundPolicyRow(input);
  const sponsorRow = wrapSponsorRow(sponsorSection);
  const eventLocationRow = buildEventLocationRow(input.event_location, online);
  const eventOnlineRow = buildEventOnlineRow(online);

  const enriched = {
    ...input,
    meeting_type: input.meeting_type || (online ? 'Online' : 'In person'),
    event_location: online ? '' : String(input.event_location || '').trim(),
    event_meta_rows: eventMetaRows,
    meeting_link_row: meetingLinkRow,
    refund_policy_row: refundPolicyRow,
    sponsor_row: sponsorRow,
    // Legacy keys (migration 055) — populated so older DB templates still render
    event_location_row: eventLocationRow,
    event_online_row: eventOnlineRow,
    meeting_link_section: meetingLinkRow,
    refund_policy_section: refundPolicyRow,
    sponsor_section: sponsorRow,
  };

  return enriched;
}

const BOOKING_SECTION_PLACEHOLDERS = [
  'event_meta_rows',
  'meeting_link_row',
  'refund_policy_row',
  'sponsor_row',
  'event_location_row',
  'event_online_row',
  'meeting_link_section',
  'refund_policy_section',
  'sponsor_section',
];

function stripUnresolvedBookingPlaceholders(html) {
  let out = String(html || '');
  for (const key of BOOKING_SECTION_PLACEHOLDERS) {
    const re = new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}', 'g');
    out = out.replace(re, '');
  }
  return out;
}

module.exports = {
  enrichBookingConfirmationVars,
  stripUnresolvedBookingPlaceholders,
  buildEventMetaRows,
  buildMeetingLinkRow,
  BOOKING_SECTION_PLACEHOLDERS,
};
