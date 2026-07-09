const fs = require('fs');
const path = require('path');

let cachedCanonicalHtml = null;

function getCanonicalBookingCancelledHtml() {
  if (cachedCanonicalHtml) return cachedCanonicalHtml;
  const filePath = path.join(__dirname, '../../email-templates/booking-cancelled.html');
  cachedCanonicalHtml = fs.readFileSync(filePath, 'utf8');
  return cachedCanonicalHtml;
}

function isStaleBookingCancelledTemplate(bodyHtml) {
  const body = String(bodyHtml || '');
  if (!body.includes('Your booking has been cancelled')) return true;
  if (!body.includes('{{refund_eligible_row}}')) return true;
  if (!body.includes('{{no_refund_row}}')) return true;
  return false;
}

function resolveBookingCancelledBody(dbBodyHtml) {
  if (isStaleBookingCancelledTemplate(dbBodyHtml)) {
    return {
      bodyHtml: getCanonicalBookingCancelledHtml(),
      source: 'file',
    };
  }
  return {
    bodyHtml: String(dbBodyHtml || ''),
    source: 'database',
  };
}

module.exports = {
  getCanonicalBookingCancelledHtml,
  isStaleBookingCancelledTemplate,
  resolveBookingCancelledBody,
};
