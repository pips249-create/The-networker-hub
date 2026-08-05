const {
  isOnlineEvent,
  buildRefundPolicySection,
  buildEventLocationRow,
  buildEventOnlineRow,
  escapeHtml,
} = require('./event-refund-policy');
const {
  formatBookingReference,
  formatBookedAt,
  formatTicketQuantity,
  buildPaymentSummaryRow,
} = require('./booking-payment-summary');
const {
  siteBase,
  browseEventsUrl,
  opportunitiesBrowseUrl,
  hubAccountUrl,
  hubPaymentUrl,
  legalPolicyUrl,
  contactUrl,
  supportEmail,
} = require('./hub-email-urls');

const META_CELL =
  'padding:0 0 10px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.5;';

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
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Join online</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:400;color:#635c5e;line-height:1.6;margin:0 0 14px;">Use the link below when the event starts.</p>' +
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">' +
    '<tr><td style="background:#9a7aa8;border-radius:999px;">' +
    '<a href="' +
    safeUrl +
    '" style="display:inline-block;padding:12px 32px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Join online &rarr;</a>' +
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

function resolveSponsorSection(vars, dbSection) {
  const input = vars && typeof vars === 'object' ? vars : {};
  const fromDb = String(dbSection || '').trim();
  if (fromDb) return fromDb;
  return String(input.sponsor_row || input.sponsor_section || '').trim();
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

  const bookingReference =
    String(input.booking_reference || '').trim() ||
    formatBookingReference(input.registration_id);
  const bookedAt =
    String(input.booked_at || '').trim() || formatBookedAt(input.booked_at_iso);
  const ticketQuantityLabel =
    String(input.ticket_quantity_label || '').trim() ||
    formatTicketQuantity(input.ticket_quantity, input.ticket_name);
  const site = siteBase(input.site_url);
  const resolvedHubAccountUrl = String(input.hub_account_url || '').trim() || hubAccountUrl(site);
  const resolvedHubPaymentUrl =
    String(input.hub_payment_url || '').trim() || hubPaymentUrl(site, input.registration_id);

  const paymentInput = {
    ...input,
    booking_reference: bookingReference,
    booked_at: bookedAt,
    ticket_quantity_label: ticketQuantityLabel,
    hub_account_url: resolvedHubAccountUrl,
    hub_payment_url: resolvedHubPaymentUrl,
  };

  const eventMetaRows = buildEventMetaRows(input, online);
  const paymentSummaryRow = buildPaymentSummaryRow(paymentInput);
  const meetingLinkRow = buildMeetingLinkRow(meetingLink, online);
  const refundPolicyRow = buildRefundPolicyRow(input);
  const sponsorRow = wrapSponsorRow(resolveSponsorSection(input, sponsorSection));
  const eventLocationRow = buildEventLocationRow(input.event_location, online);
  const eventOnlineRow = buildEventOnlineRow(online);

  const enriched = {
    ...input,
    meeting_type: input.meeting_type || (online ? 'Online' : 'In person'),
    event_location: online ? '' : String(input.event_location || '').trim(),
    booking_reference: bookingReference,
    booked_at: bookedAt,
    ticket_quantity_label: ticketQuantityLabel,
    hub_account_url: resolvedHubAccountUrl,
    hub_payment_url: resolvedHubPaymentUrl,
    browse_events_url: String(input.browse_events_url || '').trim() || browseEventsUrl(site),
    contact_url: String(input.contact_url || '').trim() || contactUrl(site),
    privacy_url: String(input.privacy_url || '').trim() || legalPolicyUrl(site, 'privacy'),
    terms_url: String(input.terms_url || '').trim() || legalPolicyUrl(site, 'terms'),
    refunds_url: String(input.refunds_url || '').trim() || legalPolicyUrl(site, 'refunds'),
    payment_summary_row: paymentSummaryRow,
    event_meta_rows: eventMetaRows,
    meeting_link_row: meetingLinkRow,
    refund_policy_row: refundPolicyRow,
    sponsor_row: sponsorRow,
    sponsor_section: sponsorRow,
    mini_sponsors_row: String(input.mini_sponsors_row || '').trim(),
    // Legacy keys (migration 055) — populated so older DB templates still render
    event_location_row: eventLocationRow,
    event_online_row: eventOnlineRow,
    meeting_link_section: meetingLinkRow,
    refund_policy_section: refundPolicyRow,
  };

  return enriched;
}

/**
 * Build dynamic sections for the 24-hour booking reminder email.
 */
function enrichBookingReminderVars(vars, sponsorSection) {
  const input = vars && typeof vars === 'object' ? vars : {};
  const meetingLink = String(input.meeting_link || '').trim();
  const eventRow = {
    meeting_type: input.meeting_type,
    meeting_link: meetingLink,
    venue: input.event_location,
    location_label: input.event_location,
  };
  const online = isOnlineEvent(eventRow, meetingLink);
  const meetingLinkRow = buildMeetingLinkRow(meetingLink, online);
  const sponsorRow = wrapSponsorRow(resolveSponsorSection(input, sponsorSection));
  const eventLocation = online ? 'Online event' : String(input.event_location || '').trim();

  return {
    ...input,
    meeting_type: input.meeting_type || (online ? 'Online' : 'In person'),
    event_location: eventLocation,
    meeting_link_row: meetingLinkRow,
    sponsor_row: sponsorRow,
    meeting_link_section: meetingLinkRow,
    sponsor_section: sponsorRow,
    mini_sponsors_row: String(input.mini_sponsors_row || '').trim(),
  };
}

const ACCOUNT_WELCOME_SECTION_PLACEHOLDERS = ['sponsor_row', 'sponsor_section', 'mini_sponsors_row'];

function enrichAccountWelcomeVars(vars, sponsorSection) {
  const input = vars && typeof vars === 'object' ? vars : {};
  const site = siteBase(input.site_url);
  const sponsorRow = String(sponsorSection || input.sponsor_row || input.sponsor_section || '').trim();

  return {
    ...input,
    hub_account_url: String(input.hub_account_url || '').trim() || hubAccountUrl(site),
    browse_events_url: String(input.browse_events_url || '').trim() || browseEventsUrl(site),
    opportunities_url: String(input.opportunities_url || '').trim() || opportunitiesBrowseUrl(site),
    contact_url: String(input.contact_url || '').trim() || contactUrl(site),
    privacy_url: String(input.privacy_url || '').trim() || legalPolicyUrl(site, 'privacy'),
    terms_url: String(input.terms_url || '').trim() || legalPolicyUrl(site, 'terms'),
    refunds_url: String(input.refunds_url || '').trim() || legalPolicyUrl(site, 'refunds'),
    support_email: String(input.support_email || '').trim() || supportEmail(),
    sponsor_row: sponsorRow,
    sponsor_section: sponsorRow,
    mini_sponsors_row: String(input.mini_sponsors_row || '').trim(),
  };
}

function stripUnresolvedAccountWelcomePlaceholders(html) {
  let out = String(html || '');
  for (const key of ACCOUNT_WELCOME_SECTION_PLACEHOLDERS) {
    const re = new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}', 'g');
    out = out.replace(re, '');
  }
  return out;
}

const BOOKING_REMINDER_SECTION_PLACEHOLDERS = [
  'meeting_link_row',
  'sponsor_row',
  'mini_sponsors_row',
  'meeting_link_section',
  'sponsor_section',
];

function stripUnresolvedBookingReminderPlaceholders(html) {
  let out = String(html || '');
  for (const key of BOOKING_REMINDER_SECTION_PLACEHOLDERS) {
    const re = new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}', 'g');
    out = out.replace(re, '');
  }
  return out;
}

const BOOKING_SECTION_PLACEHOLDERS = [
  'payment_summary_row',
  'event_meta_rows',
  'meeting_link_row',
  'refund_policy_row',
  'sponsor_row',
  'mini_sponsors_row',
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
  enrichBookingReminderVars,
  enrichAccountWelcomeVars,
  stripUnresolvedBookingPlaceholders,
  stripUnresolvedBookingReminderPlaceholders,
  stripUnresolvedAccountWelcomePlaceholders,
  buildEventMetaRows,
  buildMeetingLinkRow,
  wrapSponsorRow,
  resolveSponsorSection,
  BOOKING_SECTION_PLACEHOLDERS,
  BOOKING_REMINDER_SECTION_PLACEHOLDERS,
};
