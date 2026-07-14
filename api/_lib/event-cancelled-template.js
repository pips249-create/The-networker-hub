const fs = require('fs');
const path = require('path');

let cachedCanonicalHtml = null;

function getCanonicalEventCancelledHtml() {
  if (cachedCanonicalHtml) return cachedCanonicalHtml;
  const filePath = path.join(__dirname, '../../email-templates/event-cancelled.html');
  cachedCanonicalHtml = fs.readFileSync(filePath, 'utf8');
  return cachedCanonicalHtml;
}

function isStaleEventCancelledTemplate(bodyHtml) {
  const body = String(bodyHtml || '');
  if (!body.includes('This event has been cancelled')) return true;
  const sponsorAt = body.indexOf('{{sponsor_row}}');
  const heroAt = body.indexOf('This event has been cancelled');
  const waveAt = body.indexOf('viewBox="0 0 600 40"');
  if (sponsorAt === -1) return true;
  if (waveAt !== -1 && sponsorAt > waveAt) return true;
  if (heroAt !== -1 && sponsorAt > heroAt) return true;
  return false;
}

function resolveEventCancelledBody(dbBodyHtml) {
  if (isStaleEventCancelledTemplate(dbBodyHtml)) {
    return {
      bodyHtml: getCanonicalEventCancelledHtml(),
      source: 'file',
    };
  }
  return {
    bodyHtml: String(dbBodyHtml || ''),
    source: 'database',
  };
}

module.exports = {
  getCanonicalEventCancelledHtml,
  isStaleEventCancelledTemplate,
  resolveEventCancelledBody,
};
