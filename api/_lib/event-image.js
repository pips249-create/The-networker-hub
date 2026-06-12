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

module.exports = { eventImageUrl, eventImageDbValue, normalizeEventPhotoUrl };
