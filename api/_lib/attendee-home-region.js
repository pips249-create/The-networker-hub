/**
 * Validate and normalise attendee home base (cities, London areas, full UK counties).
 */
const { getNetworkingRegion } = require('./networking-regions');
const { getProfileCounty } = require('./uk-profile-counties');

function resolveHomeRegion(slug) {
  const key = String(slug || '').trim().toLowerCase();
  if (!key) return null;
  const networking = getNetworkingRegion(key);
  if (networking) return networking;
  const county = getProfileCounty(key);
  if (county) return county;
  return null;
}

function normalizeHomeRegionSlug(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return '';
  return resolveHomeRegion(key) ? key : '';
}

function homeRegionLabel(slug) {
  const region = resolveHomeRegion(slug);
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
