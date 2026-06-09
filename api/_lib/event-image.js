/** Event cover image — canonical column is image_url; photo_url is legacy. */
function eventImageUrl(row) {
  if (!row) return '';
  return String(row.image_url || row.photo_url || '').trim();
}

function eventImageDbValue(url) {
  const v = String(url || '').trim();
  return v || null;
}

module.exports = { eventImageUrl, eventImageDbValue };
