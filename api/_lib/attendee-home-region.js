/**
 * Validate and normalise attendee home base against curated networking regions.
 */
const { getNetworkingRegion } = require('./networking-regions');

function normalizeHomeRegionSlug(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return '';
  return getNetworkingRegion(key) ? key : '';
}

function homeRegionLabel(slug) {
  const region = getNetworkingRegion(slug);
  return region ? String(region.name || region.location || '').trim() : '';
}

function hasHomeBase(profileOrAttendee) {
  const slug = normalizeHomeRegionSlug(
    profileOrAttendee?.homeRegionSlug || profileOrAttendee?.home_region_slug
  );
  if (slug) return true;
  const loc = String(profileOrAttendee?.location || '').trim();
  return loc.length >= 2;
}

module.exports = {
  normalizeHomeRegionSlug,
  homeRegionLabel,
  hasHomeBase,
};
