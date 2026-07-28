const fs = require('fs');
const path = require('path');

let cachedCanonicalHtml = null;

function getCanonicalOrganiserRankingBadgeHtml() {
  if (cachedCanonicalHtml) return cachedCanonicalHtml;
  const filePath = path.join(__dirname, '../../email-templates/organiser-ranking-badge.html');
  cachedCanonicalHtml = fs.readFileSync(filePath, 'utf8');
  return cachedCanonicalHtml;
}

function isStaleOrganiserRankingBadgeTemplate(bodyHtml) {
  const body = String(bodyHtml || '');
  if (!body.includes('organiser-ranking-badge-v4')) return true;
  if (body.startsWith('<p>Hi {{organiser_name}}')) return true;
  return false;
}

function resolveOrganiserRankingBadgeBody(dbBodyHtml) {
  if (isStaleOrganiserRankingBadgeTemplate(dbBodyHtml)) {
    return {
      bodyHtml: getCanonicalOrganiserRankingBadgeHtml(),
      source: 'file',
    };
  }
  return {
    bodyHtml: String(dbBodyHtml || ''),
    source: 'database',
  };
}

module.exports = {
  getCanonicalOrganiserRankingBadgeHtml,
  isStaleOrganiserRankingBadgeTemplate,
  resolveOrganiserRankingBadgeBody,
};
