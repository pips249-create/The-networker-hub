/**
 * Full UK county / area list for member home-base selection (onboarding + profile).
 * Separate from curated /networking/:county pages — profile slugs need not have directory landings.
 *
 * Browser copy: js/uk-profile-counties.js (run scripts/sync-uk-profile-counties.js).
 */
function slugifyCountyName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** @type {{ nation: string, names: string[] }[]} */
const UK_PROFILE_COUNTY_GROUPS = [
  {
    nation: 'England',
    names: [
      'Bedfordshire',
      'Berkshire',
      'Bristol',
      'Buckinghamshire',
      'Cambridgeshire',
      'Cheshire',
      'Cornwall',
      'County Durham',
      'Cumbria',
      'Derbyshire',
      'Devon',
      'Dorset',
      'East Riding of Yorkshire',
      'East Sussex',
      'Essex',
      'Gloucestershire',
      'Greater Manchester',
      'Hampshire',
      'Herefordshire',
      'Hertfordshire',
      'Isle of Wight',
      'Kent',
      'Lancashire',
      'Leicestershire',
      'Lincolnshire',
      'Merseyside',
      'Norfolk',
      'North Yorkshire',
      'Northamptonshire',
      'Northumberland',
      'Nottinghamshire',
      'Oxfordshire',
      'Rutland',
      'Shropshire',
      'Somerset',
      'South Yorkshire',
      'Staffordshire',
      'Suffolk',
      'Surrey',
      'Sussex',
      'Tyne and Wear',
      'Warwickshire',
      'West Midlands',
      'West Sussex',
      'West Yorkshire',
      'Wiltshire',
      'Worcestershire',
    ],
  },
  {
    nation: 'Scotland',
    names: [
      'Aberdeen City',
      'Aberdeenshire',
      'Angus',
      'Argyll and Bute',
      'Clackmannanshire',
      'Dumfries and Galloway',
      'Dundee City',
      'East Ayrshire',
      'East Dunbartonshire',
      'East Lothian',
      'East Renfrewshire',
      'Edinburgh',
      'Falkirk',
      'Fife',
      'Glasgow City',
      'Highland',
      'Inverclyde',
      'Midlothian',
      'Moray',
      'Na h-Eileanan Siar',
      'North Ayrshire',
      'North Lanarkshire',
      'Orkney Islands',
      'Perth and Kinross',
      'Renfrewshire',
      'Scottish Borders',
      'Shetland Islands',
      'South Ayrshire',
      'South Lanarkshire',
      'Stirling',
      'West Dunbartonshire',
      'West Lothian',
    ],
  },
  {
    nation: 'Wales',
    names: [
      'Blaenau Gwent',
      'Bridgend',
      'Caerphilly',
      'Cardiff',
      'Carmarthenshire',
      'Ceredigion',
      'Conwy',
      'Denbighshire',
      'Flintshire',
      'Gwynedd',
      'Isle of Anglesey',
      'Merthyr Tydfil',
      'Monmouthshire',
      'Neath Port Talbot',
      'Newport',
      'Pembrokeshire',
      'Powys',
      'Rhondda Cynon Taf',
      'Swansea',
      'Torfaen',
      'Vale of Glamorgan',
      'Wrexham',
    ],
  },
  {
    nation: 'Northern Ireland',
    names: ['County Antrim', 'County Armagh', 'County Down', 'County Fermanagh', 'County Londonderry', 'County Tyrone'],
  },
];

function buildProfileCountyMap() {
  /** @type {Record<string, { name: string, nation: string, areaType: 'county' }>} */
  const out = {};
  UK_PROFILE_COUNTY_GROUPS.forEach((group) => {
    group.names.forEach((name) => {
      const slug = slugifyCountyName(name);
      if (!slug) return;
      out[slug] = { name, nation: group.nation, areaType: 'county' };
    });
  });
  return out;
}

const UK_PROFILE_COUNTIES = buildProfileCountyMap();
const UK_PROFILE_COUNTY_SLUGS = Object.keys(UK_PROFILE_COUNTIES);

function getProfileCounty(slug) {
  const key = String(slug || '').trim().toLowerCase();
  const row = UK_PROFILE_COUNTIES[key];
  if (!row) return null;
  return { slug: key, ...row };
}

module.exports = {
  UK_PROFILE_COUNTY_GROUPS,
  UK_PROFILE_COUNTIES,
  UK_PROFILE_COUNTY_SLUGS,
  getProfileCounty,
  slugifyCountyName,
};
