/**
 * Browser seed for international region browse (keep in sync with api/_lib/international-regions.js).
 * Generated helper — edit the server module, then re-run if codes change.
 */
window.INTL_REGION_SEED = [
  {
    "id": "uk_ireland",
    "name": "UK & Ireland",
    "blurb": "United Kingdom is live; Ireland is building.",
    "codes": [
      "GB",
      "IE"
    ],
    "marketsList": false
  },
  {
    "id": "north_america",
    "name": "North America",
    "blurb": "United States is building; Canada and Mexico register via the map.",
    "codes": [
      "US",
      "CA",
      "MX"
    ],
    "marketsList": true
  },
  {
    "id": "central_america_caribbean",
    "name": "Central America & Caribbean",
    "blurb": "Register interest for your country on the map — no separate page yet.",
    "codes": [
      "BZ",
      "CR",
      "SV",
      "GT",
      "HN",
      "NI",
      "PA",
      "CU",
      "DO",
      "HT",
      "JM",
      "TT",
      "BB",
      "BS",
      "AG",
      "DM",
      "GD",
      "KN",
      "LC",
      "VC",
      "PR",
      "AW",
      "CW",
      "SX",
      "BQ"
    ],
    "marketsList": true
  },
  {
    "id": "south_america",
    "name": "South America",
    "blurb": "Register interest for your country on the map — no separate page yet.",
    "codes": [
      "AR",
      "BO",
      "BR",
      "CL",
      "CO",
      "EC",
      "GY",
      "PY",
      "PE",
      "SR",
      "UY",
      "VE",
      "GF"
    ],
    "marketsList": true
  },
  {
    "id": "western_europe",
    "name": "Western Europe",
    "blurb": "Register interest for your country on the map — no separate page yet.",
    "codes": [
      "AT",
      "BE",
      "FR",
      "DE",
      "LI",
      "LU",
      "MC",
      "NL",
      "PT",
      "ES",
      "CH",
      "AD",
      "SM",
      "VA"
    ],
    "marketsList": true
  },
  {
    "id": "northern_europe",
    "name": "Northern Europe",
    "blurb": "Nordics and Baltics — register interest on the map.",
    "codes": [
      "DK",
      "EE",
      "FI",
      "IS",
      "LV",
      "LT",
      "NO",
      "SE",
      "FO"
    ],
    "marketsList": true
  },
  {
    "id": "central_eastern_europe",
    "name": "Central & Eastern Europe",
    "blurb": "Register interest for your country on the map — no separate page yet.",
    "codes": [
      "AL",
      "BA",
      "BG",
      "HR",
      "CZ",
      "GR",
      "HU",
      "XK",
      "MK",
      "MD",
      "ME",
      "PL",
      "RO",
      "RS",
      "SK",
      "SI",
      "UA",
      "CY",
      "MT",
      "IT"
    ],
    "marketsList": true
  },
  {
    "id": "middle_east",
    "name": "Middle East",
    "blurb": "Register interest for your country on the map — no separate page yet.",
    "codes": [
      "AE",
      "BH",
      "IL",
      "JO",
      "KW",
      "LB",
      "OM",
      "PS",
      "QA",
      "SA",
      "TR",
      "YE",
      "IQ"
    ],
    "marketsList": true
  },
  {
    "id": "africa",
    "name": "Africa",
    "blurb": "Register interest for your country on the map — no separate page yet.",
    "codes": [
      "DZ",
      "AO",
      "BJ",
      "BW",
      "BF",
      "BI",
      "CM",
      "CV",
      "CF",
      "TD",
      "KM",
      "CG",
      "CD",
      "CI",
      "DJ",
      "EG",
      "GQ",
      "ER",
      "SZ",
      "ET",
      "GA",
      "GM",
      "GH",
      "GN",
      "GW",
      "KE",
      "LS",
      "LR",
      "LY",
      "MG",
      "MW",
      "ML",
      "MR",
      "MU",
      "MA",
      "MZ",
      "NA",
      "NE",
      "NG",
      "RW",
      "ST",
      "SN",
      "SC",
      "SL",
      "SO",
      "ZA",
      "SS",
      "SD",
      "TZ",
      "TG",
      "TN",
      "UG",
      "ZM",
      "ZW",
      "EH"
    ],
    "marketsList": true
  },
  {
    "id": "asia_pacific",
    "name": "Asia-Pacific",
    "blurb": "Register interest for your country on the map — no separate page yet.",
    "codes": [
      "AF",
      "AM",
      "AZ",
      "BD",
      "BT",
      "BN",
      "KH",
      "CN",
      "GE",
      "HK",
      "IN",
      "ID",
      "JP",
      "KZ",
      "KG",
      "LA",
      "MO",
      "MY",
      "MV",
      "MN",
      "MM",
      "NP",
      "KP",
      "PK",
      "PH",
      "SG",
      "KR",
      "LK",
      "TW",
      "TJ",
      "TH",
      "TL",
      "TM",
      "UZ",
      "VN",
      "AU",
      "NZ",
      "FJ",
      "PG",
      "SB",
      "VU",
      "NC",
      "PF",
      "WS",
      "TO",
      "TV",
      "KI",
      "MH",
      "FM",
      "PW",
      "NR",
      "NU",
      "CK",
      "TK",
      "WF",
      "GU",
      "MP",
      "AS",
      "PN",
      "NF"
    ],
    "marketsList": true
  }
];

/**
 * Full country list for international link-out event forms (admin + public).
 * Excludes UK (list on thenetworkeruk.com) and unavailable markets.
 */
window.INTL_EVENT_COUNTRY_OPTIONS = function intlEventCountryOptions() {
  var UNAVAILABLE = { BY: 1, IR: 1, KP: 1, RU: 1, SY: 1 };
  var NAME_OVERRIDES = { XK: 'Kosovo' };
  var displayNames = null;
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
      displayNames = new Intl.DisplayNames(['en-GB'], { type: 'region' });
    }
  } catch (e) {
    displayNames = null;
  }
  var seen = Object.create(null);
  var list = [];
  (window.INTL_REGION_SEED || []).forEach(function (region) {
    (region.codes || []).forEach(function (raw) {
      var code = String(raw || '')
        .trim()
        .toUpperCase();
      if (!code || code === 'GB' || UNAVAILABLE[code] || seen[code]) return;
      seen[code] = true;
      var name =
        NAME_OVERRIDES[code] ||
        (displayNames && displayNames.of(code)) ||
        code;
      list.push({ iso2: code, name: name });
    });
  });
  list.sort(function (a, b) {
    return a.name.localeCompare(b.name, 'en-GB');
  });
  return list;
};
