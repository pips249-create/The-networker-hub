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
  if (!body.includes('application-received-layout-v4-purple')) return true;
  if (!body.includes('Your application has been received')) return true;
  if (!body.includes('{{price_if_approved}}')) return true;
  if (!body.includes('{{logo_footer_url}}')) return true;
  if (body.includes('background:#1c2040') || body.includes('background:#4a4446')) return true;
  if (body.includes('Payouts are processed')) return true;
  if (body.includes('hi@thenetworkeruk.com')) return true;
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
