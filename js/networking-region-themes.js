/**
 * Accent colours and landmark marks for regional directory intro strips.
 * Keep in sync with api/_lib/networking-region-themes.js and middleware.js.
 */
(function () {
  var landmarks = window.HUB_REGION_LANDMARKS;
  if (!landmarks) return;

  function theme(accent, tagline, slug, accentHero) {
    var mark = landmarks.landmarkForRegion(slug);
    return {
      accent: accent,
      accentHero: accentHero || accent,
      tagline: tagline,
      landmarkKey: mark.key,
      landmarkLabel: mark.label,
      landmarkChip: mark.chip,
      landmark: mark.hero,
    };
  }

  var THEMES = {
    online: theme('#2a5580', 'Webinars, virtual meetings, and hybrid sessions you can join from anywhere.', 'online', '#93c5fd'),
    'central-london': theme('#1c2040', 'From the City to Westminster and the West End.', 'central-london', '#c5cee8'),
    'north-london': theme('#2e4a8a', 'From Camden and Islington to Hampstead and Highgate.', 'north-london', '#a8c4f0'),
    'south-london': theme('#1a6b6b', 'From South Bank and Brixton to Croydon and Greenwich.', 'south-london', '#7dd4d4'),
    'east-london': theme('#9b3456', 'From Shoreditch and Canary Wharf to Stratford and the docks.', 'east-london', '#e8a8bc'),
    'west-london': theme('#5544a0', 'From Kensington and Notting Hill to Hammersmith and Heathrow corridor.', 'west-london', '#c4b8e8'),
    manchester: theme('#2d6a4f', 'From the Northern Quarter to Salford Quays and beyond.', 'manchester', '#86efac'),
    liverpool: theme('#15608a', 'From the Albert Dock and Baltic Triangle to the wider Merseyside business community.', 'liverpool', '#7dd3fc'),
    leeds: theme('#7a2840', 'From the city centre to the wider West Yorkshire business community.', 'leeds', '#e8aab8'),
    chester: theme('#8f5020', 'From the city walls and Rows to the wider Cheshire business network.', 'chester', '#d4a870'),
    newcastle: theme('#1e4d8c', 'From the Quayside and city centre to the wider North East.', 'newcastle', '#93c5fd'),
    birmingham: theme('#b8860b', 'From Digbeth and the Jewellery Quarter to the wider Midlands.', 'birmingham', '#fcd34d'),
    nottingham: theme('#287038', 'From the Lace Market and city centre to the wider East Midlands.', 'nottingham', '#86efac'),
    sheffield: theme('#4a5058', 'From the city centre to business communities across South Yorkshire.', 'sheffield', '#d1d5db'),
    bristol: theme('#12695a', 'From Temple Meads and the Harbourside to Clifton and beyond.', 'bristol', '#5eead4'),
    brighton: theme('#07708a', 'From the seafront and creative quarter to the wider Sussex coast.', 'brighton', '#67e8f9'),
    cambridge: theme('#7a4e28', 'From the science park and city centre to the wider Cambridgeshire network.', 'cambridge', '#d4a878'),
    oxford: theme('#1c3d72', 'From the city centre to business communities across Oxfordshire.', 'oxford', '#93c5fd'),
    glasgow: theme('#0a7088', 'Connect with entrepreneurs across the Clyde and the city centre.', 'glasgow', '#67e8f9'),
    edinburgh: theme('#6a3068', 'From the Old Town and New Town to Leith and the wider Lothians.', 'edinburgh', '#e0a8d8'),
    cardiff: theme('#8a2432', 'From the bay and city centre to business networks across South Wales.', 'cardiff', '#f0a0a8'),
    belfast: theme('#1a4a6e', 'From the Cathedral Quarter and Titanic Quarter to business networks across Belfast.', 'belfast', '#93c5fd'),
    reading: theme('#6a4058', 'From the town centre and Thames Valley to business communities across Berkshire.', 'reading', '#e8c4d0'),
    leicester: theme('#285878', 'From the Golden Mile and city centre to the wider Leicestershire network.', 'leicester', '#93c5fd'),
    bournemouth: theme('#0878a0', 'From the seafront and BIC to business communities across Dorset.', 'bournemouth', '#67e8f9'),
  };

  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) {
      h = h
        .split('')
        .map(function (c) {
          return c + c;
        })
        .join('');
    }
    if (h.length !== 6) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  function applyRegionAccentVars(el, themeObj) {
    if (!el || !themeObj || !themeObj.accent) return;
    var rgb = hexToRgb(themeObj.accent);
    if (!rgb) return;
    el.style.setProperty('--region-accent', themeObj.accent);
    el.style.setProperty(
      '--region-accent-soft',
      'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.1)'
    );
    el.style.setProperty(
      '--region-accent-border',
      'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.2)'
    );
    el.style.setProperty('--link-accent', themeObj.accent);
    el.style.setProperty('--chip-accent', themeObj.accent);
  }

  window.HUB_NETWORKING_REGION_THEMES = THEMES;
  window.HUB_applyRegionAccentVars = applyRegionAccentVars;
})();
