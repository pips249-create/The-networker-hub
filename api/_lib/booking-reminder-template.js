const fs = require('fs');
const path = require('path');

let cachedCanonicalHtml = null;

function getCanonicalBookingReminderHtml() {
  if (cachedCanonicalHtml) return cachedCanonicalHtml;
  const filePath = path.join(__dirname, '../../email-templates/booking-reminder-24hr.html');
  cachedCanonicalHtml = fs.readFileSync(filePath, 'utf8');
  return cachedCanonicalHtml;
}

function isStaleBookingReminderTemplate(bodyHtml) {
  const body = String(bodyHtml || '');
  if (!body.includes('24&nbsp;hours') && !body.includes('24 hours')) return true;
  if (!body.includes('{{meeting_link_row}}') && body.includes('meeting_link_section')) return true;
  if (body.startsWith('<p>Hi {{user_name}}')) return true;
  const sponsorMatches = body.match(/\{\{sponsor_row\}\}/g);
  if (sponsorMatches && sponsorMatches.length > 1) return true;
  const sponsorAt = body.indexOf('{{sponsor_row}}');
  const keepBuildingAt = body.indexOf('Keep building');
  if (sponsorAt !== -1 && keepBuildingAt !== -1 && sponsorAt > keepBuildingAt) return true;
  const headerLogoAt = body.indexOf('alt="The Networker Hub" width="180"');
  if (
    sponsorAt !== -1 &&
    headerLogoAt !== -1 &&
    sponsorAt < headerLogoAt
  ) {
    return true;
  }
  if (body.includes('hello@thenetworkerhub.com')) return true;
  if (body.includes('{{logo_url}}" alt="The Networker Hub" width="200"')) return true;
  if (body.includes('The Networker Hub</p>') && body.includes('background:#f5f0e8;padding:28px')) return true;
  return false;
}

function resolveBookingReminderBody(dbBodyHtml) {
  if (isStaleBookingReminderTemplate(dbBodyHtml)) {
    return {
      bodyHtml: getCanonicalBookingReminderHtml(),
      source: 'file',
    };
  }
  return {
    bodyHtml: String(dbBodyHtml || ''),
    source: 'database',
  };
}

module.exports = {
  getCanonicalBookingReminderHtml,
  isStaleBookingReminderTemplate,
  resolveBookingReminderBody,
};
