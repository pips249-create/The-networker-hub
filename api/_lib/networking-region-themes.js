/**
 * Shared regional accent + landmark data for Edge middleware and Node SEO.
 * Keep browser copy in sync: js/networking-region-themes.js
 *
 * Palette: London shares a navy family; England cities group by macro-region;
 * Scotland uses teal/plum; Wales uses deep red.
 */
const { landmarkForRegion } = require('./region-landmark-icons');

function theme(accent, tagline, slug, accentHero) {
  const mark = landmarkForRegion(slug);
  return {
    accent,
    accentHero: accentHero || accent,
    tagline,
    landmarkKey: mark.key,
    landmarkLabel: mark.label,
    landmarkChip: mark.chip,
    landmark: mark.hero,
  };
}

const REGION_THEMES = {
  online: theme('#2a5580', 'Webinars and virtual meetings you can join from anywhere.', 'online', '#93c5fd'),
  // London family
  'central-london': theme('#1c2040', 'From the City to Westminster and the West End.', 'central-london', '#c5cee8'),
  'north-london': theme('#2e4a8a', 'From Camden and Islington to Hampstead and Highgate.', 'north-london', '#a8c4f0'),
  'south-london': theme('#1a6b6b', 'From South Bank and Brixton to Croydon and Greenwich.', 'south-london', '#7dd4d4'),
  'east-london': theme('#9b3456', 'From Shoreditch and Canary Wharf to Stratford and the docks.', 'east-london', '#e8a8bc'),
  'west-london': theme('#5544a0', 'From Kensington and Notting Hill to Hammersmith and Heathrow corridor.', 'west-london', '#c4b8e8'),
  // North West England
  manchester: theme('#2d6a4f', 'From the Northern Quarter to Salford Quays and beyond.', 'manchester', '#86efac'),
  liverpool: theme('#15608a', 'From the Albert Dock and Baltic Triangle to the wider Merseyside business community.', 'liverpool', '#7dd3fc'),
  leeds: theme('#7a2840', 'From the city centre to the wider West Yorkshire business community.', 'leeds', '#e8aab8'),
  chester: theme('#8f5020', 'From the city walls and Rows to the wider Cheshire business network.', 'chester', '#d4a870'),
  cheshire: theme('#7a4a28', 'From Chester and Crewe to Warrington and the wider Cheshire business network.', 'cheshire', '#d4a870'),
  lancashire: theme('#1e5a6e', 'From Preston and Blackpool to Burnley and business communities across Lancashire.', 'lancashire', '#7dd3fc'),
  // North East England
  newcastle: theme('#1e4d8c', 'From the Quayside and city centre to the wider North East.', 'newcastle', '#93c5fd'),
  // Midlands & Yorkshire
  birmingham: theme('#b8860b', 'From Digbeth and the Jewellery Quarter to the wider Midlands.', 'birmingham', '#fcd34d'),
  nottingham: theme('#287038', 'From the Lace Market and city centre to the wider East Midlands.', 'nottingham', '#86efac'),
  sheffield: theme('#4a5058', 'From the city centre to business communities across South Yorkshire.', 'sheffield', '#d1d5db'),
  // South West England
  bristol: theme('#12695a', 'From Temple Meads and the Harbourside to Clifton and beyond.', 'bristol', '#5eead4'),
  brighton: theme('#07708a', 'From the seafront and creative quarter to the wider Sussex coast.', 'brighton', '#67e8f9'),
  // South East & East Anglia
  cambridge: theme('#7a4e28', 'From the science park and city centre to the wider Cambridgeshire network.', 'cambridge', '#d4a878'),
  oxford: theme('#1c3d72', 'From the city centre to business communities across Oxfordshire.', 'oxford', '#93c5fd'),
  surrey: theme('#2d5a48', 'From Guildford and Woking to Reigate and business communities across Surrey.', 'surrey', '#86efac'),
  kent: theme('#6a3048', 'From Canterbury and Maidstone to Tunbridge Wells and the wider Kent network.', 'kent', '#e8a8bc'),
  hampshire: theme('#1a5870', 'From Southampton and Portsmouth to Winchester and business communities across Hampshire.', 'hampshire', '#7dd3fc'),
  essex: theme('#6a4020', 'From Chelmsford and Colchester to Southend and business communities across Essex.', 'essex', '#d4a870'),
  hertfordshire: theme('#284868', 'From St Albans and Watford to Hertford and business communities across Hertfordshire.', 'hertfordshire', '#93c5fd'),
  berkshire: theme('#5a3850', 'From Reading and Maidenhead to Newbury and business communities across Berkshire.', 'berkshire', '#e8c4d0'),
  // Scotland
  glasgow: theme('#0a7088', 'Connect with entrepreneurs across the Clyde and the city centre.', 'glasgow', '#67e8f9'),
  edinburgh: theme('#6a3068', 'From the Old Town and New Town to Leith and the wider Lothians.', 'edinburgh', '#e0a8d8'),
  // Wales
  cardiff: theme('#8a2432', 'From the bay and city centre to business networks across South Wales.', 'cardiff', '#f0a0a8'),
  // Northern Ireland
  belfast: theme('#1a4a6e', 'From the Cathedral Quarter and Titanic Quarter to business networks across Belfast.', 'belfast', '#93c5fd'),
  // Thames Valley & East Midlands
  reading: theme('#6a4058', 'From the town centre and Thames Valley to business communities across Berkshire.', 'reading', '#e8c4d0'),
  leicester: theme('#285878', 'From the Golden Mile and city centre to the wider Leicestershire network.', 'leicester', '#93c5fd'),
  // Dorset coast
  bournemouth: theme('#0878a0', 'From the seafront and BIC to business communities across Dorset.', 'bournemouth', '#67e8f9'),
};

function getRegionTheme(slug) {
  return REGION_THEMES[String(slug || '').trim().toLowerCase()] || null;
}

module.exports = {
  REGION_THEMES,
  getRegionTheme,
};
