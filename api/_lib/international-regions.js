/**
 * International market tiers + country→region mapping.
 *
 * Tiers:
 * - live: full local hub (own domain)
 * - building_page: dedicated SEO / intake URL on International
 * - map_only: no dedicated URL — register via world map (country still stored)
 *
 * Regional hubs (e.g. /south-america) are reserved for when a cluster is ready
 * to launch — do not create thin per-country pages for small markets.
 */

const MARKET_TIERS = {
  GB: { tier: 'live', url: 'https://www.thenetworkeruk.com' },
  IE: { tier: 'building_page', url: '/ireland' },
  US: { tier: 'building_page', url: '/united-states' },
};

/** Regions used for demand roll-ups. Order = display priority. */
const REGIONS = [
  {
    id: 'uk_ireland',
    name: 'UK & Ireland',
    blurb: 'United Kingdom is live; Ireland is building.',
    codes: ['GB', 'IE'],
    /** Spotlight markets already listed individually — skip duplicate Markets row. */
    marketsList: false,
  },
  {
    id: 'north_america',
    name: 'North America',
    blurb: 'United States is building; Canada and Mexico register via the map.',
    codes: ['US', 'CA', 'MX'],
    marketsList: true,
    /** US has its own Markets row — only show regional roll-up for CA/MX spillover. */
    excludeFromMarketsTotal: ['US'],
  },
  {
    id: 'central_america_caribbean',
    name: 'Central America & Caribbean',
    blurb: 'Register interest for your country on the map — no separate page yet.',
    codes: [
      'BZ', 'CR', 'SV', 'GT', 'HN', 'NI', 'PA', 'CU', 'DO', 'HT', 'JM', 'TT', 'BB',
      'BS', 'AG', 'DM', 'GD', 'KN', 'LC', 'VC', 'PR', 'AW', 'CW', 'SX', 'BQ',
    ],
    marketsList: true,
  },
  {
    id: 'south_america',
    name: 'South America',
    blurb: 'Register interest for your country on the map — no separate page yet.',
    codes: ['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PY', 'PE', 'SR', 'UY', 'VE', 'GF'],
    marketsList: true,
  },
  {
    id: 'western_europe',
    name: 'Western Europe',
    blurb: 'Register interest for your country on the map — no separate page yet.',
    codes: [
      'AT', 'BE', 'FR', 'DE', 'LI', 'LU', 'MC', 'NL', 'PT', 'ES', 'CH', 'AD', 'SM', 'VA',
    ],
    marketsList: true,
  },
  {
    id: 'northern_europe',
    name: 'Northern Europe',
    blurb: 'Nordics and Baltics — register interest on the map.',
    codes: ['DK', 'EE', 'FI', 'IS', 'LV', 'LT', 'NO', 'SE', 'FO'],
    marketsList: true,
  },
  {
    id: 'central_eastern_europe',
    name: 'Central & Eastern Europe',
    blurb: 'Register interest for your country on the map — no separate page yet.',
    codes: [
      'AL', 'BA', 'BG', 'HR', 'CZ', 'GR', 'HU', 'XK', 'MK', 'MD', 'ME', 'PL', 'RO',
      'RS', 'SK', 'SI', 'UA', 'CY', 'MT', 'IT',
    ],
    marketsList: true,
  },
  {
    id: 'middle_east',
    name: 'Middle East',
    blurb: 'Register interest for your country on the map — no separate page yet.',
    codes: ['AE', 'BH', 'IL', 'JO', 'KW', 'LB', 'OM', 'PS', 'QA', 'SA', 'TR', 'YE', 'IQ'],
    marketsList: true,
  },
  {
    id: 'africa',
    name: 'Africa',
    blurb: 'Register interest for your country on the map — no separate page yet.',
    codes: [
      'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CM', 'CV', 'CF', 'TD', 'KM', 'CG', 'CD',
      'CI', 'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE',
      'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG',
      'RW', 'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG',
      'ZM', 'ZW', 'EH',
    ],
    marketsList: true,
  },
  {
    id: 'asia_pacific',
    name: 'Asia-Pacific',
    blurb: 'Register interest for your country on the map — no separate page yet.',
    codes: [
      'AF', 'AM', 'AZ', 'BD', 'BT', 'BN', 'KH', 'CN', 'GE', 'HK', 'IN', 'ID', 'JP',
      'KZ', 'KG', 'LA', 'MO', 'MY', 'MV', 'MN', 'MM', 'NP', 'KP', 'PK', 'PH', 'SG',
      'KR', 'LK', 'TW', 'TJ', 'TH', 'TL', 'TM', 'UZ', 'VN', 'AU', 'NZ', 'FJ', 'PG',
      'SB', 'VU', 'NC', 'PF', 'WS', 'TO', 'TV', 'KI', 'MH', 'FM', 'PW', 'NR', 'NU',
      'CK', 'TK', 'WF', 'GU', 'MP', 'AS', 'PN', 'NF',
    ],
    marketsList: true,
  },
];

const COUNTRY_TO_REGION = {};
REGIONS.forEach(function (region) {
  region.codes.forEach(function (code) {
    COUNTRY_TO_REGION[code] = region.id;
  });
});

function normalizeCountryCode(code) {
  return String(code || '').trim().toUpperCase();
}

function regionForCountry(code) {
  const id = COUNTRY_TO_REGION[normalizeCountryCode(code)];
  if (!id) return null;
  return REGIONS.find(function (r) {
    return r.id === id;
  }) || null;
}

function marketTierForCountry(code) {
  const row = MARKET_TIERS[normalizeCountryCode(code)];
  return (row && row.tier) || 'map_only';
}

/**
 * @param {Record<string, { total: number, interest?: number, groups?: number }>} countries
 * @param {number} threshold
 */
function buildRegionAggregates(countries, threshold) {
  const thresholdN = Number(threshold) || 5;
  return REGIONS.map(function (region) {
    let interest = 0;
    let groups = 0;
    let total = 0;
    let marketsTotal = 0;
    const countryBreakdown = [];

    region.codes.forEach(function (code) {
      const row = countries[code];
      if (!row || !row.total) return;
      interest += row.interest || 0;
      groups += row.groups || 0;
      total += row.total || 0;
      const excluded =
        region.excludeFromMarketsTotal &&
        region.excludeFromMarketsTotal.indexOf(code) !== -1;
      if (!excluded) marketsTotal += row.total || 0;
      countryBreakdown.push({
        code: code,
        total: row.total,
      });
    });

    countryBreakdown.sort(function (a, b) {
      return b.total - a.total;
    });

    const displayTotal =
      region.excludeFromMarketsTotal && region.excludeFromMarketsTotal.length
        ? marketsTotal
        : total;

    return {
      id: region.id,
      name: region.name,
      blurb: region.blurb,
      marketsList: Boolean(region.marketsList),
      interest: interest,
      groups: groups,
      total: total,
      /** Total shown in Markets list (may exclude dedicated building pages). */
      listTotal: displayTotal,
      display: displayTotal >= thresholdN,
      countries: countryBreakdown,
    };
  });
}

module.exports = {
  MARKET_TIERS,
  REGIONS,
  COUNTRY_TO_REGION,
  regionForCountry,
  marketTierForCountry,
  buildRegionAggregates,
  normalizeCountryCode,
};
