/**
 * Resolve which URL to show as an opportunity listing cover (card hero / detail banner).
 * Falls back to logo when no dedicated cover is stored.
 */
function isUsableOpportunityMediaUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return false;
  if (/^blob:/i.test(raw)) return false;
  return true;
}

function resolveOpportunityDisplayCover(imageUrl, logoUrl) {
  const image = String(imageUrl || '').trim();
  const logo = String(logoUrl || '').trim();
  if (isUsableOpportunityMediaUrl(image)) {
    return { cover_url: image, cover_is_logo_fallback: false };
  }
  if (isUsableOpportunityMediaUrl(logo)) {
    return { cover_url: logo, cover_is_logo_fallback: true };
  }
  return { cover_url: '', cover_is_logo_fallback: false };
}

module.exports = {
  isUsableOpportunityMediaUrl,
  resolveOpportunityDisplayCover,
};
