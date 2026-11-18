/**
 * City → nearby county hub(s) for “further afield” links on /networking/:city.
 * Only maps cities onto counties that exist in NETWORKING_COUNTY_SLUGS.
 * Manchester has no Greater Manchester county page — link neighbouring counties.
 */
const CITY_NEARBY_COUNTIES = {
  manchester: ['lancashire', 'cheshire'],
  birmingham: ['warwickshire', 'staffordshire'],
  leeds: ['yorkshire'],
  sheffield: ['yorkshire'],
  liverpool: ['lancashire', 'cheshire'],
  brighton: ['sussex'],
  cambridge: ['cambridgeshire'],
  oxford: ['oxfordshire'],
  chester: ['cheshire'],
  reading: ['berkshire'],
  bournemouth: ['dorset'],
  // London areas intentionally omit a single county link.
};

function getNearbyCountiesForCity(slug) {
  const key = String(slug || '')
    .trim()
    .toLowerCase();
  const list = CITY_NEARBY_COUNTIES[key];
  return Array.isArray(list) ? list.slice() : [];
}

module.exports = {
  CITY_NEARBY_COUNTIES,
  getNearbyCountiesForCity,
};
