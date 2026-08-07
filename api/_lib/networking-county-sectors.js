/**
 * Curated UK county outcode sectors for /networking/:county landings.
 * Boundaries are approximate (postcode areas ≠ ceremonial counties).
 * Keep browser copy in sync: js/postcode-outcode.js REGION_SECTORS.
 */
const NETWORKING_COUNTY_SECTORS = {
  cheshire: [
    'CH1', 'CH2', 'CH3', 'CH4', 'CH5', 'CH6', 'CH7', 'CH8',
    'CW1', 'CW2', 'CW3', 'CW4', 'CW5', 'CW6', 'CW7', 'CW8', 'CW9', 'CW10', 'CW11', 'CW12',
    'WA1', 'WA2', 'WA3', 'WA4', 'WA5', 'WA6', 'WA7', 'WA8', 'WA9', 'WA10', 'WA11', 'WA12',
    'WA13', 'WA14', 'WA15', 'WA16',
    'SK9', 'SK10', 'SK11', 'SK12',
  ],
  surrey: [
    'GU1', 'GU2', 'GU3', 'GU4', 'GU5', 'GU6', 'GU7', 'GU8', 'GU9', 'GU10',
    'GU11', 'GU12', 'GU13', 'GU14', 'GU15', 'GU16', 'GU17', 'GU18', 'GU19', 'GU20',
    'GU21', 'GU22', 'GU23', 'GU24', 'GU25', 'GU26', 'GU27',
    'RH1', 'RH2', 'RH3', 'RH4', 'RH5', 'RH6', 'RH7', 'RH8', 'RH9', 'RH10',
    'RH11', 'RH12', 'RH13', 'RH14', 'RH15', 'RH16', 'RH17', 'RH18', 'RH19', 'RH20',
    'KT10', 'KT11', 'KT12', 'KT13', 'KT14', 'KT15', 'KT16', 'KT17', 'KT18', 'KT19',
    'KT20', 'KT21', 'KT22', 'KT23', 'KT24',
    'SM7',
  ],
  kent: [
    'CT1', 'CT2', 'CT3', 'CT4', 'CT5', 'CT6', 'CT7', 'CT8', 'CT9', 'CT10',
    'CT11', 'CT12', 'CT13', 'CT14', 'CT15', 'CT16', 'CT17', 'CT18', 'CT19', 'CT20', 'CT21',
    'ME1', 'ME2', 'ME3', 'ME4', 'ME5', 'ME6', 'ME7', 'ME8', 'ME9', 'ME10',
    'ME11', 'ME12', 'ME13', 'ME14', 'ME15', 'ME16', 'ME17', 'ME18', 'ME19', 'ME20',
    'TN1', 'TN2', 'TN3', 'TN4', 'TN5', 'TN6', 'TN7', 'TN8', 'TN9', 'TN10',
    'TN11', 'TN12', 'TN13', 'TN14', 'TN15', 'TN16', 'TN17', 'TN18', 'TN19', 'TN20',
    'TN21', 'TN22', 'TN23', 'TN24', 'TN25', 'TN26', 'TN27', 'TN28', 'TN29', 'TN30',
    'TN31', 'TN32', 'TN33', 'TN34', 'TN35', 'TN36', 'TN37', 'TN38', 'TN39', 'TN40',
    'DA2', 'DA3', 'DA4', 'DA9', 'DA10', 'DA11', 'DA12', 'DA13',
  ],
  hampshire: [
    'SO14', 'SO15', 'SO16', 'SO17', 'SO18', 'SO19', 'SO20', 'SO21', 'SO22', 'SO23',
    'SO24', 'SO30', 'SO31', 'SO32', 'SO40', 'SO41', 'SO42', 'SO43', 'SO45', 'SO50',
    'SO51', 'SO52', 'SO53',
    'PO1', 'PO2', 'PO3', 'PO4', 'PO5', 'PO6', 'PO7', 'PO8', 'PO9', 'PO10',
    'PO11', 'PO12', 'PO13', 'PO14', 'PO15', 'PO16', 'PO17',
    'GU30', 'GU31', 'GU32', 'GU33', 'GU34', 'GU35',
  ],
  lancashire: [
    'PR1', 'PR2', 'PR3', 'PR4', 'PR5', 'PR6', 'PR7', 'PR8', 'PR9', 'PR11',
    'PR25', 'PR26',
    'BB1', 'BB2', 'BB3', 'BB4', 'BB5', 'BB6', 'BB7', 'BB8', 'BB9', 'BB10',
    'BB11', 'BB12',
    'FY1', 'FY2', 'FY3', 'FY4', 'FY5', 'FY6', 'FY7', 'FY8',
    'LA1', 'LA2', 'LA3', 'LA4', 'LA5', 'LA6',
    'WN1', 'WN2', 'WN3', 'WN4', 'WN5', 'WN6', 'WN7', 'WN8',
  ],
  essex: [
    'CM0', 'CM1', 'CM2', 'CM3', 'CM4', 'CM5', 'CM6', 'CM7', 'CM8', 'CM9',
    'CM11', 'CM12', 'CM13', 'CM14', 'CM15', 'CM16', 'CM17', 'CM18', 'CM19', 'CM20',
    'CM21', 'CM22', 'CM23', 'CM24',
    'CO1', 'CO2', 'CO3', 'CO4', 'CO5', 'CO6', 'CO7', 'CO8', 'CO9', 'CO10',
    'CO11', 'CO12', 'CO13', 'CO14', 'CO15', 'CO16',
    'SS0', 'SS1', 'SS2', 'SS3', 'SS4', 'SS5', 'SS6', 'SS7', 'SS8', 'SS9',
    'SS11', 'SS12', 'SS13', 'SS14', 'SS15', 'SS16', 'SS17',
  ],
  hertfordshire: [
    'AL1', 'AL2', 'AL3', 'AL4', 'AL5', 'AL6', 'AL7', 'AL8', 'AL9', 'AL10',
    'SG1', 'SG2', 'SG3', 'SG4', 'SG5', 'SG6', 'SG7', 'SG8', 'SG9', 'SG10',
    'SG11', 'SG12', 'SG13', 'SG14', 'SG15', 'SG16', 'SG17', 'SG18', 'SG19',
    'WD3', 'WD4', 'WD5', 'WD6', 'WD7', 'WD17', 'WD18', 'WD19', 'WD23', 'WD24', 'WD25',
    'EN6', 'EN7', 'EN8', 'EN9', 'EN10', 'EN11',
    'HP1', 'HP2', 'HP3', 'HP4', 'HP5',
  ],
  berkshire: [
    'RG1', 'RG2', 'RG4', 'RG5', 'RG6', 'RG7', 'RG8', 'RG9', 'RG10',
    'RG12', 'RG14', 'RG17', 'RG18', 'RG19', 'RG20', 'RG21', 'RG22', 'RG23', 'RG24',
    'RG25', 'RG26', 'RG27', 'RG28', 'RG29', 'RG30', 'RG31', 'RG40', 'RG41', 'RG42',
    'SL0', 'SL1', 'SL2', 'SL3', 'SL4', 'SL5', 'SL6', 'SL7', 'SL8', 'SL9',
  ],
  oxfordshire: [
    'OX1', 'OX2', 'OX3', 'OX4', 'OX5', 'OX7', 'OX9', 'OX10', 'OX11', 'OX12', 'OX13',
    'OX14', 'OX15', 'OX16', 'OX17', 'OX18', 'OX20', 'OX25', 'OX26', 'OX27', 'OX28',
    'OX29', 'OX33', 'OX39', 'OX44', 'OX49',
  ],
  buckinghamshire: [
    'HP6', 'HP7', 'HP8', 'HP9', 'HP10', 'HP11', 'HP12', 'HP13', 'HP14', 'HP15',
    'HP16', 'HP17', 'HP18', 'HP19', 'HP20', 'HP21', 'HP22', 'HP23', 'HP27',
    'MK1', 'MK2', 'MK3', 'MK4', 'MK5', 'MK6', 'MK7', 'MK8', 'MK9', 'MK10',
    'MK11', 'MK12', 'MK13', 'MK14', 'MK15', 'MK16', 'MK17', 'MK18', 'MK19',
  ],
  cambridgeshire: [
    'CB1', 'CB2', 'CB3', 'CB4', 'CB5', 'CB6', 'CB7', 'CB8', 'CB9', 'CB10', 'CB11',
    'CB21', 'CB22', 'CB23', 'CB24', 'CB25',
    'PE1', 'PE2', 'PE3', 'PE4', 'PE5', 'PE6', 'PE7', 'PE8',
    'PE13', 'PE14', 'PE15', 'PE16', 'PE19', 'PE26', 'PE27', 'PE28', 'PE29',
  ],
  sussex: [
    'BN1', 'BN2', 'BN3', 'BN5', 'BN6', 'BN7', 'BN8', 'BN9', 'BN10', 'BN11',
    'BN12', 'BN13', 'BN14', 'BN15', 'BN16', 'BN17', 'BN18', 'BN20', 'BN21',
    'BN22', 'BN23', 'BN24', 'BN25', 'BN26', 'BN27', 'BN41', 'BN42', 'BN43',
    'BN44', 'BN45',
    'PO18', 'PO19', 'PO20', 'PO21', 'PO22',
  ],
};

const NETWORKING_COUNTY_META = {
  cheshire: {
    name: 'Cheshire',
    location: 'Cheshire',
    areaType: 'county',
    cities: ['chester'],
  },
  surrey: {
    name: 'Surrey',
    location: 'Surrey',
    areaType: 'county',
    cities: [],
  },
  kent: {
    name: 'Kent',
    location: 'Kent',
    areaType: 'county',
    cities: [],
  },
  hampshire: {
    name: 'Hampshire',
    location: 'Hampshire',
    areaType: 'county',
    cities: [],
  },
  lancashire: {
    name: 'Lancashire',
    location: 'Lancashire',
    areaType: 'county',
    cities: [],
  },
  essex: {
    name: 'Essex',
    location: 'Essex',
    areaType: 'county',
    cities: [],
  },
  hertfordshire: {
    name: 'Hertfordshire',
    location: 'Hertfordshire',
    areaType: 'county',
    cities: [],
  },
  berkshire: {
    name: 'Berkshire',
    location: 'Berkshire',
    areaType: 'county',
    cities: ['reading'],
  },
  oxfordshire: {
    name: 'Oxfordshire',
    location: 'Oxfordshire',
    areaType: 'county',
    cities: ['oxford'],
  },
  buckinghamshire: {
    name: 'Buckinghamshire',
    location: 'Buckinghamshire',
    areaType: 'county',
    cities: [],
  },
  cambridgeshire: {
    name: 'Cambridgeshire',
    location: 'Cambridgeshire',
    areaType: 'county',
    cities: ['cambridge'],
  },
  sussex: {
    name: 'Sussex',
    location: 'Sussex',
    areaType: 'county',
    cities: ['brighton'],
  },
};

const NETWORKING_COUNTY_SLUGS = Object.keys(NETWORKING_COUNTY_META);

const NETWORKING_COUNTY_ALIASES = {
  cheshire: 'cheshire',
  surrey: 'surrey',
  kent: 'kent',
  hampshire: 'hampshire',
  hants: 'hampshire',
  lancashire: 'lancashire',
  lancs: 'lancashire',
  essex: 'essex',
  hertfordshire: 'hertfordshire',
  herts: 'hertfordshire',
  berkshire: 'berkshire',
  berks: 'berkshire',
  oxfordshire: 'oxfordshire',
  oxon: 'oxfordshire',
  buckinghamshire: 'buckinghamshire',
  bucks: 'buckinghamshire',
  cambridgeshire: 'cambridgeshire',
  cambs: 'cambridgeshire',
  sussex: 'sussex',
  'east sussex': 'sussex',
  'west sussex': 'sussex',
};

function buildNetworkingCountyRegions() {
  const out = {};
  NETWORKING_COUNTY_SLUGS.forEach((slug) => {
    const meta = NETWORKING_COUNTY_META[slug];
    out[slug] = {
      name: meta.name,
      location: meta.location,
      areaType: 'county',
      outcodes: NETWORKING_COUNTY_SECTORS[slug].slice(),
      cities: (meta.cities || []).slice(),
    };
  });
  return out;
}

module.exports = {
  NETWORKING_COUNTY_SECTORS,
  NETWORKING_COUNTY_META,
  NETWORKING_COUNTY_SLUGS,
  NETWORKING_COUNTY_ALIASES,
  buildNetworkingCountyRegions,
};
