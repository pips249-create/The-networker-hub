const fs = require('fs');
const path = require('path');

let cachedCanonicalHtml = null;

function getCanonicalApplicationReceivedHtml() {
  if (cachedCanonicalHtml) return cachedCanonicalHtml;
  const filePath = path.join(__dirname, '../../email-templates/application-received.html');
  cachedCanonicalHtml = fs.readFileSync(filePath, 'utf8');
  return cachedCanonicalHtml;
}

function isStaleApplicationReceivedTemplate(bodyHtml) {
  const body = String(bodyHtml || '');
  if (!body.includes('Your application has been received')) return true;
  if (!body.includes('{{price_if_approved}}')) return true;
  if (body.includes('hello@the-networker.co.uk')) return true;
  if (body.includes('Need help?') && !body.includes('{{support_email}}')) return true;
  return false;
}

function resolveApplicationReceivedBody(dbBodyHtml) {
  if (isStaleApplicationReceivedTemplate(dbBodyHtml)) {
    return {
      bodyHtml: getCanonicalApplicationReceivedHtml(),
      source: 'file',
    };
  }
  return {
    bodyHtml: String(dbBodyHtml || ''),
    source: 'database',
  };
}

module.exports = {
  getCanonicalApplicationReceivedHtml,
  resolveApplicationReceivedBody,
};
