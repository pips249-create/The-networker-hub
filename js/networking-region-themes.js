/**
 * Accent colours and landmark marks for regional directory intro strips.
 * Keep in sync with api/_lib/networking-region-themes.js and middleware.js.
 */
(function () {
  var landmarks = window.HUB_REGION_LANDMARKS;
  if (!landmarks) return;

  function theme(accent, tagline, slug) {
    var mark = landmarks.landmarkForRegion(slug);
    return {
      accent: accent,
      tagline: tagline,
      landmarkKey: mark.key,
      landmarkLabel: mark.label,
      landmarkChip: mark.chip,
      landmark: mark.hero,
    };
  }

  var THEMES = {
    'central-london': theme('#1c2040', 'From the City to Westminster and the West End.', 'central-london'),
    'north-london': theme('#2563eb', 'From Camden and Islington to Hampstead and Highgate.', 'north-london'),
    'south-london': theme('#0d9488', 'From South Bank and Brixton to Croydon and Greenwich.', 'south-london'),
    'east-london': theme('#dc2626', 'From Shoreditch and Canary Wharf to Stratford and the docks.', 'east-london'),
    'west-london': theme('#7c3aed', 'From Kensington and Notting Hill to Hammersmith and Heathrow corridor.', 'west-london'),
    manchester: theme('#2d6a4f', 'From the Northern Quarter to Salford Quays and beyond.', 'manchester'),
    birmingham: theme('#b8860b', 'From Digbeth and the Jewellery Quarter to the wider Midlands.', 'birmingham'),
    glasgow: theme('#0e7490', 'Connect with entrepreneurs across the Clyde and the city centre.', 'glasgow'),
    edinburgh: theme('#9d174d', 'From the Old Town and New Town to Leith and the wider Lothians.', 'edinburgh'),
    leeds: theme('#b91c1c', 'From the city centre to the wider West Yorkshire business community.', 'leeds'),
    liverpool: theme('#0f4c81', 'From the Albert Dock and Baltic Triangle to the wider Merseyside business community.', 'liverpool'),
    newcastle: theme('#1d4ed8', 'From the Quayside and city centre to the wider North East.', 'newcastle'),
    bristol: theme('#115e59', 'From Temple Meads and the Harbourside to Clifton and beyond.', 'bristol'),
    sheffield: theme('#4b5563', 'From the city centre to business communities across South Yorkshire.', 'sheffield'),
    nottingham: theme('#15803d', 'From the Lace Market and city centre to the wider East Midlands.', 'nottingham'),
    cardiff: theme('#7f1d1d', 'From the bay and city centre to business networks across South Wales.', 'cardiff'),
    brighton: theme('#0891b2', 'From the seafront and creative quarter to the wider Sussex coast.', 'brighton'),
    cambridge: theme('#92400e', 'From the science park and city centre to the wider Cambridgeshire network.', 'cambridge'),
    oxford: theme('#1e3a8a', 'From the city centre to business communities across Oxfordshire.', 'oxford'),
    chester: theme('#c2410c', 'From the city walls and Rows to the wider Cheshire business network.', 'chester'),
  };

  window.HUB_NETWORKING_REGION_THEMES = THEMES;
})();
