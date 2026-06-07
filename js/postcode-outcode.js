/**
 * UK postcode outcode matching — fast filter without radial distance math.
 * User types e.g. M1 or SW1A; events match same or adjacent city outcode sectors.
 */
(function () {
  var UK_OUTCODE_RE = /\b([A-Z]{1,2}\d{1,2}[A-Z]?)/i;

  /** Sector = letters + leading digit(s) before optional trailing letter (SW1A → SW1, M14 → M1). */
  function parseOutcode(raw) {
    if (!raw) return '';
    var s = String(raw).trim().toUpperCase().replace(/\s+/g, '');
    var m = s.match(UK_OUTCODE_RE);
    if (m) return m[1];
    var compact = s.replace(/[^A-Z0-9]/g, '');
    m = compact.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/);
    return m ? m[1] : '';
  }

  function sectorOf(outcode) {
    if (!outcode) return '';
    var m = outcode.match(/^([A-Z]{1,2})(\d)/);
    if (!m) return outcode;
    return m[1] + m[2];
  }

  /** Same city / region — adjacent outcode sectors for filtering. */
  var REGION_SECTORS = {
    manchester: [
      'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9',
      'M11', 'M12', 'M13', 'M14', 'M15', 'M16', 'M17', 'M18', 'M19',
      'M20', 'M21', 'M22', 'M23', 'M24', 'M25', 'M26', 'M27', 'M28', 'M29',
      'M30', 'M31', 'M32', 'M33', 'M34', 'M35', 'M38', 'M40', 'M41', 'M43',
      'M44', 'M45', 'M46', 'M50', 'M60', 'M90',
    ],
    london: [
      'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15', 'E16', 'E17', 'E18', 'E20',
      'EC1', 'EC2', 'EC3', 'EC4',
      'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10', 'N11', 'N12', 'N13', 'N14', 'N15', 'N16', 'N17', 'N18', 'N19', 'N20', 'N21', 'N22',
      'NW1', 'NW2', 'NW3', 'NW4', 'NW5', 'NW6', 'NW7', 'NW8', 'NW9', 'NW10', 'NW11',
      'SE1', 'SE2', 'SE3', 'SE4', 'SE5', 'SE6', 'SE7', 'SE8', 'SE9', 'SE10', 'SE11', 'SE12', 'SE13', 'SE14', 'SE15', 'SE16', 'SE17', 'SE18', 'SE19', 'SE20', 'SE21', 'SE22', 'SE23', 'SE24', 'SE25', 'SE26', 'SE27', 'SE28',
      'SW1', 'SW2', 'SW3', 'SW4', 'SW5', 'SW6', 'SW7', 'SW8', 'SW9', 'SW10', 'SW11', 'SW12', 'SW13', 'SW14', 'SW15', 'SW16', 'SW17', 'SW18', 'SW19', 'SW20',
      'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12', 'W13', 'W14',
      'WC1', 'WC2',
    ],
    birmingham: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19', 'B20', 'B21', 'B23', 'B24', 'B25', 'B26', 'B27', 'B28', 'B29', 'B30', 'B31', 'B32', 'B33', 'B34', 'B35', 'B36', 'B37', 'B38', 'B40', 'B42', 'B43', 'B44', 'B45', 'B46', 'B47', 'B48', 'B49', 'B50', 'B60', 'B61', 'B62', 'B63', 'B64', 'B65', 'B66', 'B67', 'B68', 'B69', 'B70', 'B71', 'B72', 'B73', 'B74', 'B75', 'B76', 'B77', 'B78', 'B79', 'B80', 'B90', 'B91', 'B92', 'B93', 'B94', 'B95', 'B96', 'B97', 'B98'],
    leeds: ['LS1', 'LS2', 'LS3', 'LS4', 'LS5', 'LS6', 'LS7', 'LS8', 'LS9', 'LS10', 'LS11', 'LS12', 'LS13', 'LS14', 'LS15', 'LS16', 'LS17', 'LS18', 'LS19', 'LS20', 'LS21', 'LS22', 'LS23', 'LS24', 'LS25', 'LS26', 'LS27', 'LS28', 'LS29'],
    liverpool: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10', 'L11', 'L12', 'L13', 'L14', 'L15', 'L16', 'L17', 'L18', 'L19', 'L20', 'L21', 'L22', 'L23', 'L24', 'L25', 'L26', 'L27', 'L28', 'L29', 'L30', 'L31', 'L32', 'L33', 'L34', 'L35', 'L36', 'L37', 'L38', 'L39', 'L40'],
    bristol: ['BS1', 'BS2', 'BS3', 'BS4', 'BS5', 'BS6', 'BS7', 'BS8', 'BS9', 'BS10', 'BS11', 'BS13', 'BS14', 'BS15', 'BS16', 'BS20', 'BS21', 'BS22', 'BS23', 'BS24', 'BS25', 'BS26', 'BS27', 'BS28', 'BS29', 'BS30', 'BS31', 'BS32', 'BS34', 'BS35', 'BS36', 'BS37', 'BS39', 'BS40', 'BS41', 'BS48', 'BS49'],
    edinburgh: ['EH1', 'EH2', 'EH3', 'EH4', 'EH5', 'EH6', 'EH7', 'EH8', 'EH9', 'EH10', 'EH11', 'EH12', 'EH13', 'EH14', 'EH15', 'EH16', 'EH17', 'EH18', 'EH19', 'EH20', 'EH21', 'EH22', 'EH23', 'EH24', 'EH25', 'EH26', 'EH27', 'EH28', 'EH29', 'EH30', 'EH31', 'EH32', 'EH33', 'EH34', 'EH35', 'EH36', 'EH37', 'EH38', 'EH39', 'EH40', 'EH41', 'EH42', 'EH43', 'EH44', 'EH45', 'EH46', 'EH47', 'EH48', 'EH49', 'EH51', 'EH52', 'EH53', 'EH54', 'EH55'],
    glasgow: ['G1', 'G2', 'G3', 'G4', 'G5', 'G11', 'G12', 'G13', 'G14', 'G15', 'G20', 'G21', 'G22', 'G23', 'G31', 'G32', 'G33', 'G34', 'G40', 'G41', 'G42', 'G43', 'G44', 'G45', 'G46', 'G51', 'G52', 'G53', 'G60', 'G61', 'G62', 'G63', 'G64', 'G65', 'G66', 'G67', 'G68', 'G69', 'G71', 'G72', 'G73', 'G74', 'G76', 'G77', 'G78', 'G81', 'G82', 'G83', 'G84'],
    cambridge: ['CB1', 'CB2', 'CB3', 'CB4', 'CB5', 'CB6', 'CB7', 'CB8', 'CB9', 'CB10', 'CB11', 'CB21', 'CB22', 'CB23', 'CB24', 'CB25'],
    oxford: ['OX1', 'OX2', 'OX3', 'OX4', 'OX5', 'OX7', 'OX9', 'OX10', 'OX11', 'OX12', 'OX13', 'OX14', 'OX15', 'OX16', 'OX17', 'OX18', 'OX20', 'OX25', 'OX26', 'OX27', 'OX28', 'OX29', 'OX33', 'OX39', 'OX44', 'OX49'],
  };

  var sectorSetCache = {};

  function sectorsForRegion(regionKey) {
    return REGION_SECTORS[regionKey] || [];
  }

  function findRegionForSector(sec) {
    var keys = Object.keys(REGION_SECTORS);
    for (var i = 0; i < keys.length; i++) {
      var list = REGION_SECTORS[keys[i]];
      for (var j = 0; j < list.length; j++) {
        if (list[j] === sec || list[j].indexOf(sec) === 0 || sec.indexOf(list[j]) === 0) {
          return keys[i];
        }
      }
    }
    return null;
  }

  function allowedSectors(userOutcode) {
    var oc = parseOutcode(userOutcode);
    if (!oc) return null;
    var sec = sectorOf(oc);
    if (sectorSetCache[sec]) return sectorSetCache[sec];

    var allowed = {};
    allowed[sec] = true;
    allowed[oc] = true;

    var region = findRegionForSector(sec);
    if (region) {
      sectorsForRegion(region).forEach(function (s) {
        allowed[s] = true;
      });
    }

    sectorSetCache[sec] = allowed;
    return allowed;
  }

  window.hubParseOutcode = parseOutcode;

  var CITY_ALIASES = {
    manchester: 'manchester',
    mcr: 'manchester',
    london: 'london',
    birmingham: 'birmingham',
    bham: 'birmingham',
    leeds: 'leeds',
    liverpool: 'liverpool',
    bristol: 'bristol',
    edinburgh: 'edinburgh',
    glasgow: 'glasgow',
    cambridge: 'cambridge',
    oxford: 'oxford',
  };

  function normalizeLocationText(raw) {
    if (!raw) return '';
    return String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function cityRegionFromInput(raw) {
    var norm = normalizeLocationText(raw);
    if (!norm) return null;
    if (CITY_ALIASES[norm]) return CITY_ALIASES[norm];
    if (REGION_SECTORS[norm]) return norm;
    var keys = Object.keys(REGION_SECTORS);
    for (var i = 0; i < keys.length; i++) {
      if (norm === keys[i] || norm.indexOf(keys[i]) !== -1) return keys[i];
    }
    return null;
  }

  function eventLocationHaystack(ev) {
    return [ev.city, ev.locationShort, ev.location, ev.venue, ev.postcode]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  function matchesCityRegion(region, ev) {
    var hay = eventLocationHaystack(ev);
    if (hay.indexOf(region) !== -1) return true;
    var allowed = {};
    sectorsForRegion(region).forEach(function (s) {
      allowed[s] = true;
    });
    var eventOc = window.hubEventOutcode(ev);
    if (!eventOc) return false;
    var eventSec = sectorOf(eventOc);
    return !!(allowed[eventOc] || allowed[eventSec]);
  }

  window.hubEventOutcode = function (ev) {
    if (ev.outcode) return ev.outcode;
    var pc = ev.postcode || '';
    var fromLoc = [ev.location, ev.venue].join(' ');
    return parseOutcode(pc) || parseOutcode(fromLoc);
  };

  /** True if event matches user postcode, outcode, or city filter. */
  window.hubMatchOutcode = function (userInput, ev) {
    var raw = String(userInput || '').trim();
    if (!raw) return true;

    var oc = parseOutcode(raw);
    if (oc) {
      var allowed = allowedSectors(raw);
      if (!allowed) return true;
      var eventOc = window.hubEventOutcode(ev);
      if (!eventOc) return false;
      var eventSec = sectorOf(eventOc);
      return !!(allowed[eventOc] || allowed[eventSec]);
    }

    var region = cityRegionFromInput(raw);
    if (region) return matchesCityRegion(region, ev);

    var norm = normalizeLocationText(raw);
    if (norm.length >= 3) {
      return eventLocationHaystack(ev).indexOf(norm) !== -1;
    }

    return true;
  };

  window.hubOutcodeLabel = function (userInput) {
    var raw = String(userInput || '').trim();
    if (!raw) return '';
    var oc = parseOutcode(raw);
    if (oc) {
      var region = findRegionForSector(sectorOf(oc));
      return region ? oc + ' (' + region.replace(/^\w/, function (c) { return c.toUpperCase(); }) + ' area)' : oc;
    }
    var cityRegion = cityRegionFromInput(raw);
    if (cityRegion) {
      return cityRegion.replace(/^\w/, function (c) { return c.toUpperCase(); });
    }
    return raw;
  };
})();
