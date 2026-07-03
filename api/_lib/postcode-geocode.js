/**
 * UK postcode geocoding via postcodes.io (no API key required).
 */
const { parseOutcode, cityRegionFromInput } = require('./uk-outcode');

const REGION_OUTCODE = {
  manchester: 'M1',
  london: 'EC1A',
  birmingham: 'B1',
  leeds: 'LS1',
  liverpool: 'L1',
  bristol: 'BS1',
  edinburgh: 'EH1',
  glasgow: 'G1',
  cambridge: 'CB1',
  oxford: 'OX1',
};

async function geocodeUkOutcode(outcode) {
  const code = String(outcode || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!code) return null;
  try {
    const res = await fetch('https://api.postcodes.io/outcodes/' + encodeURIComponent(code));
    if (!res.ok) return null;
    const data = await res.json();
    const result = data && data.result;
    if (!result) return null;
    return {
      latitude: result.latitude != null ? Number(result.latitude) : null,
      longitude: result.longitude != null ? Number(result.longitude) : null,
      city:
        (Array.isArray(result.admin_district) ? result.admin_district[0] : result.admin_district) ||
        '',
      outcode: result.outcode || code,
    };
  } catch {
    return null;
  }
}

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

/** Resolve a profile location string to coordinates for nearby event emails. */
async function geocodeUkLocation(location) {
  const raw = String(location || '').trim();
  if (!raw) return null;

  const postcode = parseOutcode(raw);
  if (postcode) {
    const fromPostcode = await geocodeUkPostcode(postcode);
    if (fromPostcode?.latitude != null && fromPostcode?.longitude != null) {
      return fromPostcode;
    }
    const fromOutcode = await geocodeUkOutcode(postcode);
    if (fromOutcode?.latitude != null && fromOutcode?.longitude != null) {
      return fromOutcode;
    }
  }

  const region = cityRegionFromInput(raw);
  if (region && REGION_OUTCODE[region]) {
    return geocodeUkOutcode(REGION_OUTCODE[region]);
  }

  return null;
}

module.exports = { geocodeUkPostcode, geocodeUkOutcode, geocodeUkLocation };
