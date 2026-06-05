/**
 * UK postcode geocoding via postcodes.io (no API key required).
 */
async function geocodeUkPostcode(postcode) {
  const pc = String(postcode || '')
    .trim()
    .replace(/\s+/g, '');
  if (!pc) return null;

  try {
    const res = await fetch('https://api.postcodes.io/postcodes/' + encodeURIComponent(pc));
    if (!res.ok) return null;
    const data = await res.json();
    const result = data && data.result;
    if (!result) return null;
    return {
      latitude: result.latitude != null ? Number(result.latitude) : null,
      longitude: result.longitude != null ? Number(result.longitude) : null,
      city: result.admin_district || result.parish || result.region || '',
      outcode: result.outcode || '',
    };
  } catch {
    return null;
  }
}

module.exports = { geocodeUkPostcode };
