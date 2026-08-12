/**
 * Founding Organiser · 2026 badge asset helpers (email embed + attachment).
 */
const fs = require('fs');
const path = require('path');

const BADGE_FILENAME = 'founding-organiser-badge-2026.png';
const BADGE_DOWNLOAD_NAME = 'Founding-Organiser-2026-badge.png';
/** Bundled with the serverless function (Vercel NFT traces __dirname reads). */
const BADGE_PATH = path.join(__dirname, 'email-assets', BADGE_FILENAME);
/** Public URL copy for <img> embeds in email HTML. */
const PUBLIC_BADGE_PATH = '/assets/' + BADGE_FILENAME;

let cachedBase64 = null;

function foundingBadgePublicUrl(siteUrl) {
  const base = String(siteUrl || 'https://www.thenetworkerhub.com').replace(/\/$/, '');
  return base + '/assets/' + BADGE_FILENAME;
}

function loadFoundingBadgeBase64() {
  if (cachedBase64) return cachedBase64;
  if (!fs.existsSync(BADGE_PATH)) return '';
  cachedBase64 = fs.readFileSync(BADGE_PATH).toString('base64');
  return cachedBase64;
}

function foundingBadgeEmailAttachment() {
  const content = loadFoundingBadgeBase64();
  if (!content) return null;
  return {
    filename: BADGE_DOWNLOAD_NAME,
    content,
    contentType: 'image/png',
  };
}

module.exports = {
  BADGE_FILENAME,
  BADGE_DOWNLOAD_NAME,
  foundingBadgePublicUrl,
  foundingBadgeEmailAttachment,
  loadFoundingBadgeBase64,
};
