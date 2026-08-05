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
  if (!body.includes('hub-email-layout-v3-purple')) return true;
  if (!body.includes('Your booking has been cancelled')) return true;
  if (!body.includes('{{refund_eligible_row}}')) return true;
  if (!body.includes('{{no_refund_row}}')) return true;
  if (!body.includes('{{logo_footer_url}}')) return true;
  if (body.includes('background:#4a4446')) return true;
  const sponsorAt = body.indexOf('{{sponsor_row}}');
  const heroAt = body.indexOf('Your booking has been cancelled');
  const waveAt = body.indexOf('viewBox="0 0 600 40"');
  if (sponsorAt === -1) return true;
  if (waveAt !== -1 && sponsorAt > waveAt) return true;
  if (heroAt !== -1 && sponsorAt > heroAt) return true;
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
