/** Event cover image — canonical column is image_url; photo_url is legacy. */

/**
 * Unwrap proxy URLs (e.g. Eventbrite /_next/image) so browse cards load the real CDN asset.
 */
function normalizeEventPhotoUrl(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';

  try {
    const u = new URL(s);
    const inner = u.searchParams.get('url');
    if (inner && (u.pathname.includes('_next/image') || u.pathname.includes('/image'))) {
      s = decodeURIComponent(inner);
    }
  } catch {
    /* keep original */
  }

  const cdnMatch = s.match(/https?:\/\/cdn\.evbuc\.com\/[^\s"'<>]+/i);
  if (cdnMatch) return cdnMatch[0];

  if (/^https?:\/\//i.test(s)) return s;
  return s;
}

function eventImageUrl(row) {
  if (!row) return '';
  return normalizeEventPhotoUrl(row.image_url || row.photo_url || '');
}

function eventImageDbValue(url) {
  const v = normalizeEventPhotoUrl(url);
  return v || null;
}

function isUsableEventImageUrl(url) {
  const value = String(url || '').trim();
  if (!value) return false;
  if (/event-placeholder/i.test(value)) return false;
  if (/\/assets\/placeholders\//i.test(value)) return false;
  return true;
}

/**
 * Match browse/event-detail image priority: event photo → series peer photo → organiser logo.
 * Skips URLs that are only the organiser logo when a better series cover exists.
 */
function resolveEventDisplayImage(eventRow, organiserRow, seriesPeerRows) {
  const logo = String(organiserRow?.photo_url || '').trim();
  const candidates = [];

  const own = eventImageUrl(eventRow);
  if (isUsableEventImageUrl(own)) candidates.push(own);

  for (const peer of seriesPeerRows || []) {
    const peerUrl = eventImageUrl(peer);
    if (isUsableEventImageUrl(peerUrl) && !candidates.includes(peerUrl)) {
      candidates.push(peerUrl);
    }
  }

  const nonLogo = candidates.find((url) => !logo || url !== logo);
  if (nonLogo) return nonLogo;
  if (isUsableEventImageUrl(own)) return own;
  if (isUsableEventImageUrl(logo)) return logo;
  return '';
}

module.exports = {
  eventImageUrl,
  eventImageDbValue,
  normalizeEventPhotoUrl,
  isUsableEventImageUrl,
  resolveEventDisplayImage,
};
