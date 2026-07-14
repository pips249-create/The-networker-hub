/**
 * Accent colours and skyline marks for regional directory intro strips.
 * Prefer extracted Networker city silhouettes (PNG); SVG fallbacks for cities without a source.
 * Keep in sync with api/_lib/networking-region-themes.js and middleware.js.
 */
(function () {
  function sky(paths) {
    return (
      '<svg class="networking-region-skyline-svg" viewBox="0 0 200 72" fill="currentColor" aria-hidden="true">' +
      paths +
      '</svg>'
    );
  }

  var PNG = {
    london: '/assets/region-skylines/london.png',
    manchester: '/assets/region-skylines/manchester.png',
    leeds: '/assets/region-skylines/leeds.png',
    birmingham: '/assets/region-skylines/birmingham.png',
    edinburgh: '/assets/region-skylines/edinburgh.png',
  };

  /* Glasgow: Finnieston Crane + Armadillo + spire */
  var GLASGOW = sky(
    '<path d="M6 68V46h10v22H6z"/><path d="M10 46V14h5v32H10z"/><path d="M15 18h48v5H15z"/><path d="M58 18v16h5V18h-5z"/><path d="M54 34h14v4H54z"/>' +
      '<path d="M78 68c0-10 8-18 18-18s18 8 18 18H78z"/><path d="M94 50c0-9 6-16 14-16s14 7 14 16H94z" opacity=".85"/><path d="M110 50c0-7 5-13 11-13s11 6 11 13h-22z" opacity=".7"/>' +
      '<path d="M148 68V22h9l5-14 5 14h9v46h-28z"/><path d="M180 68V34h14v34h-14z" opacity=".85"/>'
  );

  /* Bristol: Clifton Suspension Bridge + Cabot */
  var BRISTOL = sky(
    '<path d="M10 54c30-30 74-30 104 0" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>' +
      '<path d="M16 68V26h12v42H16zm92 0V26h12v42h-12z"/><path d="M18 26h8l3-10 3 10h8v5H18v-5z"/><path d="M110 26h8l3-10 3 10h8v5h-22v-5z"/>' +
      '<path d="M28 50h80v4H28z" opacity=".85"/><path d="M42 50c10-16 28-24 46-24" fill="none" stroke="currentColor" stroke-width="1.8" opacity=".5"/>' +
      '<path d="M144 68V16h14v52h-14z"/><path d="M148 16h6l5-12 5 12h6v7h-22v-7z"/><path d="M170 68V32h14v36h-14zm18 0V40h12v28h-12z" opacity=".85"/>'
  );

  /* Chester: walls + cathedral + Eastgate clock */
  var CHESTER = sky(
    '<path d="M2 62h196v6H2z" opacity=".35"/><path d="M6 62V48h7v-5h7v5h7v-5h7v5h7v14H6z"/>' +
      '<path d="M54 68V22h12v-10h5V6l7-6 7 6v6h5v10h12v46H54z"/><path d="M70 6h4V1h4v5h4l-6-5-6 5z"/><path d="M60 22h32v5H60zm0 12h32v4H60z" opacity=".4"/>' +
      '<path d="M112 68V26h18v42h-18z"/><path d="M116 26h10l4-10h3l4 10h10v10H116V26z"/><circle cx="127" cy="42" r="4" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
      '<path d="M146 62V48h6v-4h6v4h6v-4h6v4h6v14h-30z"/><path d="M176 68V30h14v38h-14zm18 0V38h10v30h-10z" opacity=".85"/>'
  );

  var THEMES = {
    'central-london': {
      accent: '#1c2040',
      tagline: 'From the City to Westminster and the West End.',
      skylineImage: PNG.london,
    },
    'north-london': {
      accent: '#2563eb',
      tagline: 'From Camden and Islington to Hampstead and Highgate.',
      skylineImage: PNG.london,
    },
    'south-london': {
      accent: '#0d9488',
      tagline: 'From South Bank and Brixton to Croydon and Greenwich.',
      skylineImage: PNG.london,
    },
    'east-london': {
      accent: '#dc2626',
      tagline: 'From Shoreditch and Canary Wharf to Stratford and the docks.',
      skylineImage: PNG.london,
    },
    'west-london': {
      accent: '#7c3aed',
      tagline: 'From Kensington and Notting Hill to Hammersmith and Heathrow corridor.',
      skylineImage: PNG.london,
    },
    manchester: {
      accent: '#2d6a4f',
      tagline: 'From the Northern Quarter to Salford Quays and beyond.',
      skylineImage: PNG.manchester,
    },
    birmingham: {
      accent: '#b8860b',
      tagline: 'From Digbeth and the Jewellery Quarter to the wider Midlands.',
      skylineImage: PNG.birmingham,
    },
    glasgow: {
      accent: '#0e7490',
      tagline: 'Connect with entrepreneurs across the Clyde and the city centre.',
      skyline: GLASGOW,
    },
    edinburgh: {
      accent: '#9d174d',
      tagline: 'From the Old Town and New Town to Leith and the wider Lothians.',
      skylineImage: PNG.edinburgh,
    },
    leeds: {
      accent: '#b91c1c',
      tagline: 'From the city centre to the wider West Yorkshire business community.',
      skylineImage: PNG.leeds,
    },
    bristol: {
      accent: '#115e59',
      tagline: 'From Temple Meads and the Harbourside to Clifton and beyond.',
      skyline: BRISTOL,
    },
    chester: {
      accent: '#c2410c',
      tagline: 'From the city walls and Rows to the wider Cheshire business network.',
      skyline: CHESTER,
    },
  };

  window.HUB_NETWORKING_REGION_THEMES = THEMES;
})();
