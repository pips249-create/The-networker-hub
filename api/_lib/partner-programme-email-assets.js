/**
 * Partner programme invite — PNG attachments bundled for Vercel (see email-assets/).
 */
const fs = require('fs');
const path = require('path');

const BADGE_FILENAME = 'networker-uk-partner-badge-light.png';
const BADGE_DOWNLOAD_NAME = 'Networker-UK-Partner-badge-light.png';
const BADGE_PATH = path.join(__dirname, 'email-assets', BADGE_FILENAME);

let cachedBadgeBase64 = null;

function loadPartnerBadgeLightBase64() {
  if (cachedBadgeBase64) return cachedBadgeBase64;
  if (!fs.existsSync(BADGE_PATH)) return '';
  cachedBadgeBase64 = fs.readFileSync(BADGE_PATH).toString('base64');
  return cachedBadgeBase64;
}

/** Resend attachment: Partner badge · light (640×360 PNG). */
function partnerBadgeLightEmailAttachment() {
  const content = loadPartnerBadgeLightBase64();
  if (!content) return null;
  return {
    filename: BADGE_DOWNLOAD_NAME,
    content,
    contentType: 'image/png',
  };
}

function partnerInviteEmailAttachments() {
  const badge = partnerBadgeLightEmailAttachment();
  return badge ? [badge] : [];
}

module.exports = {
  BADGE_FILENAME,
  BADGE_DOWNLOAD_NAME,
  partnerBadgeLightEmailAttachment,
  partnerInviteEmailAttachments,
};
