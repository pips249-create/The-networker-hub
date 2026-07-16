/**
 * Curated regional directory landing pages.
 *
 * Slugs are deliberately allow-listed so arbitrary thin SEO pages cannot be
 * generated. Keep the browser labels in js/networking-regions.js in sync.
 */
const NETWORKING_REGIONS = {
  'central-london': {
    name: 'Central London',
    location: 'Central London',
    areaType: 'London area',
    outcodes: ['E1', 'EC1', 'EC2', 'EC3', 'EC4', 'N1', 'NW1', 'SE1', 'SW1', 'W1', 'WC1', 'WC2'],
  },
  'north-london': {
    name: 'North London',
    location: 'North London',
    areaType: 'London area',
    outcodes: [
      'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10', 'N11', 'N12',
      'N13', 'N14', 'N15', 'N16', 'N17', 'N18', 'N19', 'N20', 'N21', 'N22',
      'NW2', 'NW3', 'NW4', 'NW5', 'NW6', 'NW7', 'NW8', 'NW9', 'NW10', 'NW11',
    ],
  },
  'south-london': {
    name: 'South London',
    location: 'South London',
    areaType: 'London area',
    outcodes: [
      'SE2', 'SE3', 'SE4', 'SE5', 'SE6', 'SE7', 'SE8', 'SE9', 'SE10', 'SE11',
      'SE12', 'SE13', 'SE14', 'SE15', 'SE16', 'SE17', 'SE18', 'SE19', 'SE20',
      'SE21', 'SE22', 'SE23', 'SE24', 'SE25', 'SE26', 'SE27', 'SE28',
      'SW2', 'SW3', 'SW4', 'SW5', 'SW6', 'SW7', 'SW8', 'SW9', 'SW10', 'SW11',
      'SW12', 'SW13', 'SW14', 'SW15', 'SW16', 'SW17', 'SW18', 'SW19', 'SW20',
      'CR0', 'CR2', 'CR3', 'CR4', 'CR5', 'CR6', 'CR7', 'CR8', 'CR9',
      'BR1', 'BR2', 'BR3', 'BR4', 'BR5', 'BR6', 'BR7', 'BR8',
      'SM1', 'SM2', 'SM3', 'SM4', 'SM5', 'SM6',
      'KT1', 'KT2', 'KT3', 'KT4', 'KT5', 'KT6',
      'DA1', 'DA5', 'DA6', 'DA7', 'DA8', 'DA14', 'DA15', 'DA16', 'DA17', 'DA18',
    ],
  },
  'east-london': {
    name: 'East London',
    location: 'East London',
    areaType: 'London area',
    outcodes: [
      'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11',
      'E12', 'E13', 'E14', 'E15', 'E16', 'E17', 'E18', 'E20',
    ],
  },
  'west-london': {
    name: 'West London',
    location: 'West London',
    areaType: 'London area',
    outcodes: ['W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12', 'W13', 'W14'],
  },
  manchester: { name: 'Manchester', location: 'Manchester', areaType: 'city' },
  birmingham: { name: 'Birmingham', location: 'Birmingham', areaType: 'city' },
  glasgow: { name: 'Glasgow', location: 'Glasgow', areaType: 'city' },
  edinburgh: { name: 'Edinburgh', location: 'Edinburgh', areaType: 'city' },
  leeds: { name: 'Leeds', location: 'Leeds', areaType: 'city' },
  liverpool: { name: 'Liverpool', location: 'Liverpool', areaType: 'city' },
  newcastle: { name: 'Newcastle', location: 'Newcastle', areaType: 'city' },
  bristol: { name: 'Bristol', location: 'Bristol', areaType: 'city' },
  sheffield: { name: 'Sheffield', location: 'Sheffield', areaType: 'city' },
  nottingham: { name: 'Nottingham', location: 'Nottingham', areaType: 'city' },
  cardiff: { name: 'Cardiff', location: 'Cardiff', areaType: 'city' },
  brighton: { name: 'Brighton', location: 'Brighton', areaType: 'city' },
  cambridge: { name: 'Cambridge', location: 'Cambridge', areaType: 'city' },
  oxford: { name: 'Oxford', location: 'Oxford', areaType: 'city' },
  chester: { name: 'Chester', location: 'Chester', areaType: 'city' },
  belfast: { name: 'Belfast', location: 'Belfast', areaType: 'city' },
  reading: { name: 'Reading', location: 'Reading', areaType: 'city' },
  leicester: { name: 'Leicester', location: 'Leicester', areaType: 'city' },
  bournemouth: { name: 'Bournemouth', location: 'Bournemouth', areaType: 'city' },
};

const NETWORKING_REGION_SLUGS = Object.keys(NETWORKING_REGIONS);

function getNetworkingRegion(slug) {
  const key = String(slug || '').trim().toLowerCase();
  const region = NETWORKING_REGIONS[key];
  if (!region) return null;
  return {
    slug: key,
    path: '/networking/' + key,
    ...region,
  };
}

module.exports = {
  NETWORKING_REGIONS,
  NETWORKING_REGION_SLUGS,
  getNetworkingRegion,
};
