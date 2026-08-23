const { escapeHtml, formatMultilineHtml } = require('./event-refund-policy');
const { wrapSponsorRow, resolveSponsorSection } = require('./booking-email-sections');

function buildWarningDetailsRow(details) {
  const text = String(details || '').trim();
  if (!text) return '';
  return (
    '<tr><td class="mobile-pad" style="padding:0 40px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#1c2040;border-radius:16px;">' +
    '<tr><td style="padding:24px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Details</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;line-height:1.65;color:#ffffff;margin:0;">' +
    formatMultilineHtml(text) +
    '</p></td></tr></table></td></tr>'
  );
}

function buildSuspensionNoticeRow(willSuspend, warningCount, warningLimit) {
  if (!willSuspend) return '';
  return (
    '<tr><td class="mobile-pad" style="padding:0 40px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fde8e6;border-radius:14px;border:1px solid #f5b7b1;">' +
    '<tr><td style="padding:22px 24px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#c0392b;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Account suspended</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;margin:0 0 10px;line-height:1.35;">This was warning ' +
    escapeHtml(String(warningCount)) +
    ' of ' +
    escapeHtml(String(warningLimit)) +
    '</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.65;margin:0;">Your organiser profile and live events have been removed from The Networker UK. Contact hello@thenetworkeruk.com to appeal.</p>' +
    '</td></tr></table></td></tr>'
  );
}

function enrichOrganiserHubWarningVars(vars, sponsorSection) {
  const input = vars && typeof vars === 'object' ? vars : {};
  const sponsorRow = wrapSponsorRow(resolveSponsorSection(input, sponsorSection));
  const warningCount = Math.max(1, Number(input.warning_count) || 1);
  const warningLimit = Math.max(1, Number(input.warning_limit) || 3);
  const willSuspend = Boolean(String(input.will_suspend || '').trim());

  return {
    ...input,
    warning_details_row: buildWarningDetailsRow(input.warning_details),
    suspension_notice_row: buildSuspensionNoticeRow(willSuspend, warningCount, warningLimit),
    sponsor_row: sponsorRow,
    sponsor_section: sponsorRow,
  };
}

function enrichOrganiserHubSuspendedVars(vars, sponsorSection) {
  const input = vars && typeof vars === 'object' ? vars : {};
  const sponsorRow = wrapSponsorRow(resolveSponsorSection(input, sponsorSection));
  return {
    ...input,
    suspension_details_row: buildWarningDetailsRow(input.suspension_details),
    sponsor_row: sponsorRow,
    sponsor_section: sponsorRow,
  };
}

const HUB_MODERATION_PLACEHOLDERS = [
  'warning_details_row',
  'suspension_notice_row',
  'suspension_details_row',
  'sponsor_row',
  'mini_sponsors_row',
  'sponsor_section',
];

module.exports = {
  enrichOrganiserHubWarningVars,
  enrichOrganiserHubSuspendedVars,
  stripOrganiserHubModerationPlaceholders: (html) => {
    let out = String(html || '');
    for (const key of HUB_MODERATION_PLACEHOLDERS) {
      const re = new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}', 'g');
      out = out.replace(re, '');
    }
    return out;
  },
};
