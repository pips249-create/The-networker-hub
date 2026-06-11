const fs = require('fs');
const path = require('path');

let cachedCanonicalHtml = null;

function getCanonicalOrganiserBookingCancelledHtml() {
  if (cachedCanonicalHtml) return cachedCanonicalHtml;
  const filePath = path.join(__dirname, '../../email-templates/organiser-booking-cancelled.html');
  cachedCanonicalHtml = fs.readFileSync(filePath, 'utf8');
  return cachedCanonicalHtml;
}

function isStaleOrganiserBookingCancelledTemplate(bodyHtml) {
  const body = String(bodyHtml || '');
  if (!body.includes('An attendee cancelled their booking')) return true;
  if (!body.includes('{{refund_action_row}}')) return true;
  return false;
}

function resolveOrganiserBookingCancelledBody(dbBodyHtml) {
  if (isStaleOrganiserBookingCancelledTemplate(dbBodyHtml)) {
    return {
      bodyHtml: getCanonicalOrganiserBookingCancelledHtml(),
      source: 'file',
    };
  }
  return {
    bodyHtml: String(dbBodyHtml || ''),
    source: 'database',
  };
}

module.exports = {
  getCanonicalOrganiserBookingCancelledHtml,
  isStaleOrganiserBookingCancelledTemplate,
  resolveOrganiserBookingCancelledBody,
};
