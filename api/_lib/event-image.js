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

function isOrganiserLogoImageUrl(url, organiserLogo) {
  const photo = String(url || '').trim();
  const logo = String(organiserLogo || '').trim();
  if (!photo) return false;
  if (logo && photo === logo) return true;
  if (/\/logo[.\-_/]/i.test(photo) || /\/img\/logo\./i.test(photo)) return true;
  if (/\/assets\/logo/i.test(photo)) return true;
  return false;
}

/**
 * Match browse/event-detail image priority: event photo → series peer photo → organiser logo.
 * Skips organiser-logo URLs when a better series cover exists.
 */
function resolveEventDisplayImage(eventRow, organiserRow, seriesPeerRows) {
  const logo = String(organiserRow?.photo_url || '').trim();
  const candidates = [];

  const own = eventImageUrl(eventRow);
  if (isUsableEventImageUrl(own) && !isOrganiserLogoImageUrl(own, logo)) {
    candidates.push(own);
  }

  for (const peer of seriesPeerRows || []) {
    const peerUrl = eventImageUrl(peer);
    if (
      isUsableEventImageUrl(peerUrl) &&
      !isOrganiserLogoImageUrl(peerUrl, logo) &&
      !candidates.includes(peerUrl)
    ) {
      candidates.push(peerUrl);
    }
  }

  if (candidates.length) return candidates[0];
  if (isUsableEventImageUrl(own)) return own;
  if (isUsableEventImageUrl(logo)) return logo;
  return '';
}

/**
 * Validate a CSS object-position value like "50% 30%". Returns '' when invalid,
 * so callers can fall back to the default (centred) crop.
 */
function normalizeEventImagePosition(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,3})%\s+(\d{1,3})%$/);
  if (!m) return '';
  const x = Math.min(100, Math.max(0, Number(m[1])));
  const y = Math.min(100, Math.max(0, Number(m[2])));
  if (x === 50 && y === 50) return '';
  return x + '% ' + y + '%';
}

module.exports = {
  eventImageUrl,
  eventImageDbValue,
  normalizeEventPhotoUrl,
  isUsableEventImageUrl,
  isOrganiserLogoImageUrl,
  resolveEventDisplayImage,
  normalizeEventImagePosition,
};
