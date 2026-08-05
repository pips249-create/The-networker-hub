const fs = require('fs');
const path = require('path');

const LAYOUT_MARKER = 'application-email-layout-v3';

function makeResolver(filename) {
  let cached = null;
  function getCanonical() {
    if (cached) return cached;
    cached = fs.readFileSync(path.join(__dirname, '../../email-templates', filename), 'utf8');
    return cached;
  }
  return function resolve(dbBodyHtml) {
    const body = String(dbBodyHtml || '');
    if (!body.includes(LAYOUT_MARKER) || !body.includes('{{logo_footer_url}}')) {
      return { bodyHtml: getCanonical(), source: 'file' };
    }
    return { bodyHtml: body, source: 'database' };
  };
}

module.exports = {
  resolveApplicationApprovedBody: makeResolver('application-approved.html'),
  resolveApplicationDeniedBody: makeResolver('application-denied.html'),
};
