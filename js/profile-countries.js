/**
 * Profile country list. GB keeps UK city/postcode matching.
 * Any other code is stored and must not be geocoded as a UK location.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.HubProfileCountries = api;
  } else if (root) {
    root.HubProfileCountries = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var CODES =
    'AD,AE,AF,AG,AI,AL,AM,AO,AR,AS,AT,AU,AW,AZ,BA,BB,BD,BE,BF,BG,BH,BI,BJ,BL,BN,BO,BQ,BR,BS,BT,BW,BY,BZ,CA,CD,CF,CG,CH,CI,CL,CM,CN,CO,CR,CU,CV,CW,CY,CZ,DE,DJ,DK,DM,DO,DZ,EC,EE,EG,EH,ER,ES,ET,FI,FJ,FK,FM,FO,FR,GA,GB,GD,GE,GF,GG,GH,GL,GM,GN,GP,GQ,GR,GT,GU,GW,GY,HK,HN,HR,HT,HU,ID,IE,IL,IM,IN,IQ,IR,IS,IT,JE,JM,JO,JP,KE,KG,KH,KI,KM,KN,KP,KR,KW,KZ,LA,LB,LC,LI,LK,LR,LS,LT,LU,LV,LY,MA,MC,MD,ME,MF,MG,MH,MK,ML,MM,MN,MO,MP,MQ,MR,MT,MU,MV,MW,MX,MY,MZ,NA,NC,NE,NF,NG,NI,NL,NO,NP,NR,NU,NZ,OM,PA,PE,PF,PG,PH,PK,PL,PM,PN,PR,PS,PT,PW,PY,QA,RE,RO,RS,RU,RW,SA,SB,SC,SD,SE,SG,SH,SI,SJ,SK,SL,SM,SN,SO,SR,SS,ST,SV,SX,SY,SZ,TC,TD,TG,TH,TJ,TK,TL,TM,TN,TO,TR,TT,TV,TW,TZ,UA,UG,US,UY,UZ,VA,VC,VE,VG,VI,VN,VU,WF,WS,YE,ZA,ZM,ZW'.split(
      ','
    );

  var CODE_SET = Object.create(null);
  CODES.forEach(function (code) {
    CODE_SET[code] = true;
  });

  var displayNames = null;
  function regionNames() {
    if (displayNames) return displayNames;
    if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
      try {
        displayNames = new Intl.DisplayNames(['en-GB'], { type: 'region' });
      } catch (e) {
        displayNames = null;
      }
    }
    return displayNames;
  }

  function countryName(code) {
    var raw = String(code || '')
      .trim()
      .toUpperCase();
    if (raw === 'UK') raw = 'GB';
    if (!CODE_SET[raw]) return '';
    var names = regionNames();
    var label = names ? names.of(raw) : '';
    return label || raw;
  }

  var nameToCode = null;
  function namesLookup() {
    if (nameToCode) return nameToCode;
    nameToCode = {
      uk: 'GB',
      'united kingdom': 'GB',
      britain: 'GB',
      'great britain': 'GB',
    };
    CODES.forEach(function (code) {
      var label = countryName(code);
      if (label) nameToCode[label.toLocaleLowerCase('en-GB')] = code;
    });
    return nameToCode;
  }

  /** Empty and UK aliases stay GB so existing profiles keep UK matching. */
  function isUkCountryCode(raw) {
    var code = String(raw || '')
      .trim()
      .toUpperCase();
    if (!code) return true;
    return code === 'GB' || code === 'UK';
  }

  function normalizeCountryCode(raw) {
    var trimmed = String(raw == null ? '' : raw).trim();
    if (!trimmed) return 'GB';
    var upper = trimmed.toUpperCase();
    if (upper === 'UK' || upper === 'GB') return 'GB';
    if (CODE_SET[upper]) return upper;
    var fromName = namesLookup()[trimmed.toLocaleLowerCase('en-GB')];
    if (fromName) return fromName;
    var error = new Error('Choose a country from the list.');
    error.status = 400;
    error.code = 'invalid_country';
    throw error;
  }

  function countryOptions() {
    var list = CODES.map(function (code) {
      return { code: code, name: countryName(code) || code };
    });
    list.sort(function (a, b) {
      if (a.code === 'GB') return -1;
      if (b.code === 'GB') return 1;
      return a.name.localeCompare(b.name, 'en-GB');
    });
    return list;
  }

  function placeFromProfile(profile) {
    var location = String((profile && profile.location) || '').trim();
    var raw = profile && (profile.countryCode || profile.country);
    var countryCode = 'GB';
    if (raw != null && String(raw).trim()) {
      try {
        countryCode = normalizeCountryCode(raw);
      } catch (e) {
        countryCode = 'GB';
      }
    }
    return { location: location, countryCode: countryCode };
  }

  function rememberProfilePlace(profile) {
    var place = placeFromProfile(profile);
    if (typeof window !== 'undefined') {
      window.hubProfileLocation = place.location;
      window.hubProfileCountryCode = place.countryCode;
      window.hubProfilePlaceLoaded = true;
    }
    return place;
  }

  return {
    CODES: CODES,
    countryName: countryName,
    countryOptions: countryOptions,
    isUkCountryCode: isUkCountryCode,
    normalizeCountryCode: normalizeCountryCode,
    placeFromProfile: placeFromProfile,
    rememberProfilePlace: rememberProfilePlace,
  };
});
