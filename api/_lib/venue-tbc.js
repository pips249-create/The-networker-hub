/**
 * Venue TBC means we know the city and not the building.
 * The public page shows the city and does not embed a map.
 */

function normalizeLocationText(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isVenueTbcText(raw) {
  const s = normalizeLocationText(raw);
  if (!s) return false;
  if (
    s === 'tbc' ||
    s === 'tba' ||
    s === 'tbd' ||
    s === 'venue tbc' ||
    s === 'location tbc' ||
    s === 'venue tba' ||
    s === 'location tba' ||
    s === 'to be confirmed' ||
    s === 'to be announced'
  ) {
    return true;
  }
  return /\bvenue\s+tbc\b/.test(s) || /\blocation\s+tbc\b/.test(s) || /announced to registrants/.test(s);
}

function cityFromVenueTbcLabel(raw) {
  const original = String(raw || '').trim();
  if (!original || !isVenueTbcText(original)) return '';
  const paren = original.match(/^(.+?)\s*\(\s*venue\s+tbc\b/i);
  if (paren && paren[1].trim() && !isVenueTbcText(paren[1])) return paren[1].trim();
  const parts = original
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !isVenueTbcText(part));
  return parts[0] || '';
}

function venueTbcRequested(body) {
  if (!body || typeof body !== 'object') return false;
  const flag = body.venue_tbc != null ? body.venue_tbc : body.venueTbc;
  if (flag === false || flag === 'false' || flag === 0 || flag === '0') return false;
  if (flag === true || flag === 'true' || flag === 1 || flag === '1') return true;
  return isVenueTbcText(body.venue);
}

/**
 * Collapse a listing to city-only. Clears street, postcode, and any pin.
 */
function applyVenueTbcFields(target, cityHint) {
  const row = target && typeof target === 'object' ? target : {};
  const city =
    String(cityHint || row.city || '').trim() ||
    cityFromVenueTbcLabel(row.venue) ||
    cityFromVenueTbcLabel(row.location_label) ||
    '';
  row.venue = 'Venue TBC';
  row.address = null;
  row.postcode = null;
  row.outcode = null;
  row.latitude = null;
  row.longitude = null;
  row.city = city || null;
  row.location_label = city || 'Venue TBC';
  return row;
}

module.exports = {
  isVenueTbcText,
  cityFromVenueTbcLabel,
  venueTbcRequested,
  applyVenueTbcFields,
};
