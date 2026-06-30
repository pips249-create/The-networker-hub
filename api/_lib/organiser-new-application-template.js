const fs = require('fs');
const path = require('path');

let cachedCanonicalHtml = null;

function getCanonicalOrganiserNewApplicationHtml() {
  if (cachedCanonicalHtml) return cachedCanonicalHtml;
  const filePath = path.join(__dirname, '../../email-templates/organiser-new-application.html');
  cachedCanonicalHtml = fs.readFileSync(filePath, 'utf8');
  return cachedCanonicalHtml;
}

function isStaleOrganiserNewApplicationTemplate(bodyHtml) {
  const body = String(bodyHtml || '');
  if (!body.includes('Someone applied to attend')) return true;
  if (!body.includes('{{screening_industry}}')) return true;
  if (!body.includes('organiser-email-layout-v2')) return true;
  return false;
}

function resolveOrganiserNewApplicationBody(dbBodyHtml) {
  if (isStaleOrganiserNewApplicationTemplate(dbBodyHtml)) {
    return {
      bodyHtml: getCanonicalOrganiserNewApplicationHtml(),
      source: 'file',
    };
  }
  return {
    bodyHtml: String(dbBodyHtml || ''),
    source: 'database',
  };
}

module.exports = {
  getCanonicalOrganiserNewApplicationHtml,
  resolveOrganiserNewApplicationBody,
};
