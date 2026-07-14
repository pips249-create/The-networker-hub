/**
 * Shared regional accent + skyline data for Edge middleware and Node SEO.
 * Keep browser copy in sync: js/networking-region-themes.js
 */
const REGION_THEMES = {
  'central-london': {
    accent: '#1c2040',
    tagline: 'From the City to Westminster and the West End.',
    skyline:
      '<svg class="networking-region-skyline-svg" viewBox="0 0 160 56" fill="currentColor" aria-hidden="true"><path d="M4 52V34h8v18H4zm14 0V22h10v30H18zm18 0V12h8l4 14 4-14h8v40H36zm22 0V28h6v24h-6zm12 0V18h8v34h-8zm14 0V8h10v44H82zm16 0V24h8v28h-8zm12 0V16h6v36h-6zm10 0V30h8v22h-8zm12 0V20h10v32h-10z"/><path d="M128 52V36h4l2-8 2 8h4v16h-12z" opacity=".72"/></svg>',
  },
  'north-london': {
    accent: '#2563eb',
    tagline: 'From Camden and Islington to Hampstead and Highgate.',
    skyline:
      '<svg class="networking-region-skyline-svg" viewBox="0 0 160 56" fill="currentColor" aria-hidden="true"><path d="M6 52V30h12v22H6zm18 0V18h10v34H24zm16 0V26h8v26h-8zm14 0V12h12v40H54zm18 0V22h8v30h-8zm14 0V8h10v44H86zm16 0V28h8v24h-8zm12 0V16h10v36h-10zm10 0V34h8v18h-8z"/><circle cx="142" cy="18" r="6" opacity=".55"/></svg>',
  },
  'south-london': {
    accent: '#0d9488',
    tagline: 'From South Bank and Brixton to Croydon and Greenwich.',
    skyline:
      '<svg class="networking-region-skyline-svg" viewBox="0 0 160 56" fill="currentColor" aria-hidden="true"><path d="M8 52V32h10v20H8zm16 0V20h12v32H24zm18 0V28h8v24h-8zm12 0V14h10v38H54zm16 0V24h8v28h-8zm14 0V10h12v42H84zm16 0V30h8v22h-8zm10 0V18h10v34h-10zm8 0V36h8v16h-8z"/><path d="M138 52V40h6l3-10 3 10h6v12h-18z" opacity=".7"/></svg>',
  },
  'east-london': {
    accent: '#dc2626',
    tagline: 'From Shoreditch and Canary Wharf to Stratford and the docks.',
    skyline:
      '<svg class="networking-region-skyline-svg" viewBox="0 0 160 56" fill="currentColor" aria-hidden="true"><path d="M4 52V24h10v28H4zm16 0V16h8v36h-8zm12 0V28h10v24H32zm14 0V10h12v42H46zm18 0V22h8v30h-8zm14 0V6h10v46H78zm16 0V26h8v26h-8zm12 0V14h10v38h-10zm10 0V32h8v20h-8z"/><path d="M132 52V34h4l2-6 2 6h4v18h-12z" opacity=".75"/></svg>',
  },
  'west-london': {
    accent: '#7c3aed',
    tagline: 'From Kensington and Notting Hill to Hammersmith and Heathrow corridor.',
    skyline:
      '<svg class="networking-region-skyline-svg" viewBox="0 0 160 56" fill="currentColor" aria-hidden="true"><path d="M6 52V30h10v22H6zm16 0V18h8v34h-8zm14 0V26h10v26H36zm16 0V12h8v40h-8zm12 0V22h10v30H64zm14 0V8h10v44H88zm16 0V28h8v24h-8zm10 0V16h10v36h-10zm8 0V34h8v18h-8z"/><path d="M134 52V38h8l4-12 4 12h8v14h-24z" opacity=".68"/></svg>',
  },
  manchester: {
    accent: '#2d6a4f',
    tagline: 'From the Northern Quarter to Salford Quays and beyond.',
    skyline:
      '<svg class="networking-region-skyline-svg" viewBox="0 0 160 56" fill="currentColor" aria-hidden="true"><path d="M10 52V30h14v22H10zm20 0V8h12v44H30zm18 0V22h10v30H48zm16 0V16h8v36h-8zm14 0V28h10v24H78zm16 0V12h8v40h-8zm12 0V24h10v28H106zm14 0V18h8v34h-8zm10 0V32h8v20h-8z"/><path d="M132 52V18h6v34h-6zm10 0V26h6v26h-6z" opacity=".8"/></svg>',
  },
  birmingham: {
    accent: '#b8860b',
    tagline: 'From Digbeth and the Jewellery Quarter to the wider Midlands.',
    skyline:
      '<svg class="networking-region-skyline-svg" viewBox="0 0 160 56" fill="currentColor" aria-hidden="true"><path d="M8 52V28h12v24H8zm18 0V18h10v34H26zm16 0V32h8v20h-8zm12 0V14h14v38H54zm18 0V24h8v28h-8zm14 0V10h10v42H86zm16 0V26h8v26h-8zm10 0V16h10v36h-10z"/><ellipse cx="132" cy="38" rx="14" ry="10" opacity=".72"/><path d="M148 52V30h6v22h-6z" opacity=".85"/></svg>',
  },
  glasgow: {
    accent: '#0e7490',
    tagline: 'Connect with entrepreneurs across the Clyde and the city centre.',
    skyline:
      '<svg class="networking-region-skyline-svg" viewBox="0 0 160 56" fill="currentColor" aria-hidden="true"><path d="M6 52V26h10v26H6zm16 0V14h8v38h-8zm14 0V30h10v22H36zm16 0V18h8v34h-8zm14 0V8h12v44H74zm18 0V24h8v28h-8zm12 0V16h10v36H114zm14 0V28h8v24h-8zm10 0V12h8v40h-8z"/></svg>',
  },
  edinburgh: {
    accent: '#9d174d',
    tagline: 'From the Old Town and New Town to Leith and the wider Lothians.',
    skyline:
      '<svg class="networking-region-skyline-svg" viewBox="0 0 160 56" fill="currentColor" aria-hidden="true"><path d="M12 52V30h8v22h-8zm14 0V12h6v40h-6zm10 0V20h8v32h-8zm12 0V8h10v44H58zm16 0V22h8v30h-8zm14 0V14h6v38h-6zm10 0V26h8v26h-8zm12 0V10h8v42h-8zm10 0V18h6v34h-6z"/><path d="M126 52V24h4l6-12 6 12h4v28h-20z" opacity=".75"/></svg>',
  },
  leeds: {
    accent: '#b91c1c',
    tagline: 'From the city centre to the wider West Yorkshire business community.',
    skyline:
      '<svg class="networking-region-skyline-svg" viewBox="0 0 160 56" fill="currentColor" aria-hidden="true"><path d="M8 52V28h10v24H8zm16 0V16h8v36h-8zm14 0V24h10v28H38zm16 0V12h8v40h-8zm14 0V30h10v22H78zm16 0V18h8v34h-8zm12 0V8h10v44H116zm14 0V26h8v26h-8zm10 0V34h8v18h-8z"/><path d="M138 52V36h6l3-8 3 8h6v16h-18z" opacity=".78"/></svg>',
  },
  bristol: {
    accent: '#115e59',
    tagline: 'From Temple Meads and the Harbourside to Clifton and beyond.',
    skyline:
      '<svg class="networking-region-skyline-svg" viewBox="0 0 160 56" fill="currentColor" aria-hidden="true"><path d="M6 52V30h10v22H6zm16 0V18h8v34h-8zm14 0V26h10v26H36zm16 0V14h8v38h-8zm12 0V32h10v20H72zm14 0V10h10v42H96zm16 0V24h8v28h-8zm10 0V16h10v36h-10z"/><path d="M126 52V40h4v-8l8-10 8 10v8h4v12h-24z" opacity=".72"/></svg>',
  },
  chester: {
    accent: '#c2410c',
    tagline: 'From the city walls and Rows to the wider Cheshire business network.',
    skyline:
      '<svg class="networking-region-skyline-svg" viewBox="0 0 160 56" fill="currentColor" aria-hidden="true"><path d="M10 52V34h8v18h-8zm14 0V20h8v32h-8zm12 0V28h10v24H36zm16 0V14h8v38h-8zm14 0V24h10v28H74zm16 0V12h8v40h-8zm12 0V30h10v22H112zm14 0V18h8v34h-8z"/><path d="M134 52V32h4l4-10 4 10h4v20h-16z" opacity=".76"/><path d="M4 52h152v2H4z" opacity=".35"/></svg>',
  },
};

function getRegionTheme(slug) {
  return REGION_THEMES[String(slug || '').trim().toLowerCase()] || null;
}

module.exports = {
  REGION_THEMES,
  getRegionTheme,
};
