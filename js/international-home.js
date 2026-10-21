/**
 * The Networker International — world map landing.
 * Live hubs redirect out; other countries open an interest modal.
 */
(function () {
  var LIVE_HUBS = {
    '826': {
      iso2: 'GB',
      name: 'United Kingdom',
      url: 'https://www.thenetworkeruk.com',
    },
  };

  /** ISO numeric ids (3 digits) for markets actively being built out. */
  var BUILDING_HUBS = {
    '372': { iso2: 'IE', name: 'Ireland' },
    '840': { iso2: 'US', name: 'United States' },
  };

  /**
   * Building markets with a dedicated International URL.
   * Everything else is map-only (interest modal) — no thin per-country pages.
   * Regional hubs (e.g. /south-america) only when a cluster is ready to launch.
   */
  var MARKET_PREVIEW_URLS = {
    '372': '/ireland',
    '840': '/united-states',
  };

  /**
   * Markets we do not plan to serve — no waitlist, no click-through.
   * Sanctions / severe regulatory barriers from a UK company perspective.
   */
  var UNAVAILABLE_MARKETS = {
    '112': { iso2: 'BY', name: 'Belarus' },
    '364': { iso2: 'IR', name: 'Iran' },
    '408': { iso2: 'KP', name: 'North Korea' },
    '643': { iso2: 'RU', name: 'Russia' },
    '760': { iso2: 'SY', name: 'Syria' },
  };

  /** Fallback when region seed / map data is not ready (keep in sync with popular markets). */
  var EVENT_COUNTRY_FALLBACK = [
    { iso2: 'AE', name: 'United Arab Emirates' },
    { iso2: 'AU', name: 'Australia' },
    { iso2: 'BE', name: 'Belgium' },
    { iso2: 'BR', name: 'Brazil' },
    { iso2: 'CA', name: 'Canada' },
    { iso2: 'CH', name: 'Switzerland' },
    { iso2: 'DE', name: 'Germany' },
    { iso2: 'DK', name: 'Denmark' },
    { iso2: 'ES', name: 'Spain' },
    { iso2: 'FR', name: 'France' },
    { iso2: 'IE', name: 'Ireland' },
    { iso2: 'IN', name: 'India' },
    { iso2: 'IT', name: 'Italy' },
    { iso2: 'JP', name: 'Japan' },
    { iso2: 'MX', name: 'Mexico' },
    { iso2: 'NL', name: 'Netherlands' },
    { iso2: 'NO', name: 'Norway' },
    { iso2: 'NZ', name: 'New Zealand' },
    { iso2: 'PT', name: 'Portugal' },
    { iso2: 'SE', name: 'Sweden' },
    { iso2: 'SG', name: 'Singapore' },
    { iso2: 'US', name: 'United States' },
    { iso2: 'ZA', name: 'South Africa' },
  ];

  var searchTrackTimer = null;
  var lastSearchTracked = '';

  function trackIntl(name, data) {
    try {
      if (window.HubAnalytics && typeof window.HubAnalytics.track === 'function') {
        window.HubAnalytics.track(name, data);
      }
    } catch (e) {
      /* analytics optional */
    }
  }

  function trackSearchQuery(raw) {
    var q = String(raw || '').trim().toLowerCase();
    if (q.length < 2) return;
    if (q === lastSearchTracked) return;
    clearTimeout(searchTrackTimer);
    searchTrackTimer = setTimeout(function () {
      lastSearchTracked = q;
      trackIntl('intl_search', { query: q.slice(0, 40), length: q.length });
    }, 600);
  }

  var ISO_NUMERIC_TO_ALPHA2 = {
    '004': 'AF', '008': 'AL', '012': 'DZ', '016': 'AS', '020': 'AD', '024': 'AO', '028': 'AG', '031': 'AZ',
    '032': 'AR', '036': 'AU', '040': 'AT', '044': 'BS', '048': 'BH', '050': 'BD', '051': 'AM', '052': 'BB',
    '056': 'BE', '064': 'BT', '068': 'BO', '070': 'BA', '072': 'BW', '076': 'BR', '084': 'BZ', '090': 'SB',
    '092': 'VG', '096': 'BN', '100': 'BG', '104': 'MM', '108': 'BI', '112': 'BY', '116': 'KH', '120': 'CM',
    '124': 'CA', '132': 'CV', '140': 'CF', '144': 'LK', '148': 'TD', '152': 'CL', '156': 'CN', '158': 'TW',
    '170': 'CO', '174': 'KM', '178': 'CG', '180': 'CD', '188': 'CR', '191': 'HR', '192': 'CU', '196': 'CY',
    '203': 'CZ', '204': 'BJ', '208': 'DK', '212': 'DM', '214': 'DO', '218': 'EC', '222': 'SV', '226': 'GQ',
    '231': 'ET', '232': 'ER', '233': 'EE', '234': 'FO', '238': 'FK', '242': 'FJ', '246': 'FI', '250': 'FR',
    '254': 'GF', '258': 'PF', '262': 'DJ', '266': 'GA', '268': 'GE', '270': 'GM', '275': 'PS', '276': 'DE',
    '288': 'GH', '296': 'KI', '300': 'GR', '304': 'GL', '308': 'GD', '312': 'GP', '316': 'GU', '320': 'GT',
    '324': 'GN', '328': 'GY', '332': 'HT', '336': 'VA', '340': 'HN', '344': 'HK', '348': 'HU', '352': 'IS',
    '356': 'IN', '360': 'ID', '364': 'IR', '368': 'IQ', '372': 'IE', '376': 'IL', '380': 'IT', '384': 'CI',
    '388': 'JM', '392': 'JP', '398': 'KZ', '400': 'JO', '404': 'KE', '408': 'KP', '410': 'KR', '414': 'KW',
    '417': 'KG', '418': 'LA', '422': 'LB', '426': 'LS', '428': 'LV', '430': 'LR', '434': 'LY', '438': 'LI',
    '440': 'LT', '442': 'LU', '446': 'MO', '450': 'MG', '454': 'MW', '458': 'MY', '462': 'MV', '466': 'ML',
    '470': 'MT', '474': 'MQ', '478': 'MR', '480': 'MU', '484': 'MX', '492': 'MC', '496': 'MN', '498': 'MD',
    '499': 'ME', '504': 'MA', '508': 'MZ', '512': 'OM', '516': 'NA', '520': 'NR', '524': 'NP', '528': 'NL',
    '531': 'CW', '533': 'AW', '534': 'SX', '535': 'BQ', '540': 'NC', '548': 'VU', '554': 'NZ', '558': 'NI',
    '562': 'NE', '566': 'NG', '570': 'NU', '574': 'NF', '578': 'NO', '580': 'MP', '583': 'FM', '584': 'MH',
    '585': 'PW', '586': 'PK', '591': 'PA', '598': 'PG', '600': 'PY', '604': 'PE', '608': 'PH', '612': 'PN',
    '616': 'PL', '620': 'PT', '624': 'GW', '626': 'TL', '630': 'PR', '634': 'QA', '638': 'RE', '642': 'RO',
    '643': 'RU', '646': 'RW', '652': 'BL', '654': 'SH', '659': 'KN', '660': 'AI', '662': 'LC', '663': 'MF',
    '666': 'PM', '670': 'VC', '674': 'SM', '678': 'ST', '682': 'SA', '686': 'SN', '688': 'RS', '690': 'SC',
    '694': 'SL', '702': 'SG', '703': 'SK', '704': 'VN', '705': 'SI', '706': 'SO', '710': 'ZA', '716': 'ZW',
    '724': 'ES', '728': 'SS', '729': 'SD', '732': 'EH', '740': 'SR', '744': 'SJ', '748': 'SZ', '752': 'SE',
    '756': 'CH', '760': 'SY', '762': 'TJ', '764': 'TH', '768': 'TG', '772': 'TK', '776': 'TO', '780': 'TT',
    '784': 'AE', '788': 'TN', '792': 'TR', '795': 'TM', '796': 'TC', '798': 'TV', '800': 'UG', '804': 'UA',
    '807': 'MK', '818': 'EG', '826': 'GB', '831': 'GG', '832': 'JE', '833': 'IM', '834': 'TZ', '840': 'US',
    '850': 'VI', '854': 'BF', '858': 'UY', '860': 'UZ', '862': 'VE', '876': 'WF', '882': 'WS', '887': 'YE',
    '894': 'ZM',
  };

  var state = {
    countries: [],
    selectedIntent: 'attend',
    selectedOrgType: 'networking_group',
    selectedCountry: null,
    mapReady: false,
    hubStats: {},
    interestStats: {},
    regionStats: [],
    countryToRegion: {},
    regionMeta: {},
    activeModal: null,
    events: [],
    eventsFilter: '',
    browseContext: null,
  };

  var els = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function padNumericId(id) {
    var raw = String(id || '').trim();
    if (!raw) return '';
    return raw.length >= 3 ? raw : ('000' + raw).slice(-3);
  }

  function countryMeta(feature) {
    var numericId = padNumericId(feature.id);
    var name = feature.properties && feature.properties.name ? String(feature.properties.name) : 'Unknown';
    var live = LIVE_HUBS[numericId] || null;
    var building = !live && (BUILDING_HUBS[numericId] || null);
    var unavailable = !live && !building && (UNAVAILABLE_MARKETS[numericId] || null);
    var iso2 =
      (live && live.iso2) ||
      (building && building.iso2) ||
      (unavailable && unavailable.iso2) ||
      ISO_NUMERIC_TO_ALPHA2[numericId] ||
      '';
    var displayName =
      (live && live.name) ||
      (building && building.name) ||
      (unavailable && unavailable.name) ||
      name;
    var status = live ? 'live' : building ? 'building' : unavailable ? 'unavailable' : 'soon';
    return {
      numericId: numericId,
      iso2: iso2,
      name: displayName,
      status: status,
      live: status === 'live',
      building: status === 'building',
      unavailable: status === 'unavailable',
      url: (live && live.url) || MARKET_PREVIEW_URLS[numericId] || '',
    };
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', function () { resolve(); });
        existing.addEventListener('error', reject);
        return;
      }
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = function () {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function formatCount(value) {
    if (value == null || value === '') return null;
    var n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n.toLocaleString('en-GB');
  }

  function interestRowFor(meta) {
    if (!meta || !meta.iso2 || !state.interestStats) return null;
    return state.interestStats[String(meta.iso2).toUpperCase()] || null;
  }

  function formatInterestDemand(total) {
    var n = Number(total);
    if (!Number.isFinite(n) || n < 1) return '';
    return (
      n.toLocaleString('en-GB') +
      (n === 1 ? ' person has registered interest' : ' people have registered interest')
    );
  }

  function formatMarketsDemand(total) {
    var n = Number(total);
    if (!Number.isFinite(n) || n < 1) return '';
    return (
      n.toLocaleString('en-GB') +
      (n === 1 ? ' person already registered interest' : ' people already registered interest')
    );
  }

  function seedRegionMaps() {
    var seed = window.INTL_REGION_SEED;
    if (!Array.isArray(seed) || !seed.length) return;
    if (!Object.keys(state.countryToRegion || {}).length) {
      state.countryToRegion = {};
      seed.forEach(function (region) {
        if (!region || !region.id || !Array.isArray(region.codes)) return;
        region.codes.forEach(function (code) {
          if (code) state.countryToRegion[String(code).toUpperCase()] = region.id;
        });
      });
    }
    seed.forEach(function (region) {
      if (!region || !region.id) return;
      if (!state.regionMeta[region.id]) state.regionMeta[region.id] = region;
    });
  }

  function regionMetaForCountry(iso2) {
    seedRegionMaps();
    var code = String(iso2 || '').toUpperCase();
    var regionId = state.countryToRegion[code];
    if (!regionId) return null;
    var fromStats = (state.regionStats || []).find(function (r) {
      return r.id === regionId;
    });
    if (fromStats) return fromStats;
    return state.regionMeta[regionId] || null;
  }

  function formatPopupDemand(meta) {
    if (!meta || meta.live) return '';
    var demandRow = interestRowFor(meta);
    var countryTotal = demandRow && demandRow.total >= 1 ? demandRow.total : 0;
    var region = regionMetaForCountry(meta.iso2);
    var regionTotal = region && region.total >= 1 ? region.total : 0;

    if (countryTotal >= 1 && regionTotal > countryTotal && region && region.name) {
      return (
        formatInterestDemand(countryTotal) +
        ' · ' +
        regionTotal.toLocaleString('en-GB') +
        ' across ' +
        region.name
      );
    }
    if (countryTotal >= 1) return formatInterestDemand(countryTotal);
    if (regionTotal >= 1 && region && region.name) {
      return (
        regionTotal.toLocaleString('en-GB') +
        ' people have registered interest across ' +
        region.name
      );
    }
    return '';
  }

  function isCoarsePointer() {
    return window.matchMedia('(hover: none), (pointer: coarse)').matches;
  }

  function popupActionText(meta) {
    if (meta.unavailable) {
      return 'We don\u2019t operate in this region';
    }
    if (meta.live) {
      return isCoarsePointer() ? 'Tap to open UK →' : 'Open UK →';
    }
    if (meta.url) {
      return isCoarsePointer() ? 'Tap to open market →' : 'Open market page →';
    }
    var region = regionMetaForCountry(meta.iso2);
    if (region && region.name) {
      return isCoarsePointer()
        ? 'Tap to browse ' + region.name + ' →'
        : 'Browse ' + region.name + ' →';
    }
    return isCoarsePointer() ? 'Tap to browse events →' : 'Browse events →';
  }

  function hideCountryPopup() {
    if (!els.popup) return;
    els.popup.hidden = true;
    if (els.popupDemand) {
      els.popupDemand.textContent = '';
      els.popupDemand.hidden = true;
    }
    els.popup.classList.remove(
      'is-visible',
      'is-below',
      'intl-country-popup--live',
      'intl-country-popup--building',
      'intl-country-popup--soon',
      'intl-country-popup--unavailable'
    );
  }

  function positionCountryPopup(path) {
    if (!els.popup || !els.canvas || !path) return;

    var canvasRect = els.canvas.getBoundingClientRect();
    var popupWidth = els.popup.offsetWidth || 220;
    var popupHeight = els.popup.offsetHeight || 140;
    var pathRect = path.getBoundingClientRect();
    var centerX = pathRect.left + pathRect.width / 2 - canvasRect.left;
    var centerY = pathRect.top + pathRect.height / 2 - canvasRect.top;
    var placeBelow = centerY - popupHeight - 20 < 8;
    var x = Math.max(
      16 + popupWidth / 2,
      Math.min(canvasRect.width - 16 - popupWidth / 2, centerX)
    );
    var y = placeBelow
      ? Math.min(canvasRect.height - 8, centerY + pathRect.height / 2 + 8)
      : Math.max(8 + popupHeight, centerY - pathRect.height / 2);

    els.popup.style.left = x + 'px';
    els.popup.style.top = y + 'px';
    els.popup.classList.toggle('is-below', placeBelow);
  }

  function showCountryPopup(path, meta) {
    if (!els.popup) return;

    var stats = null;
    if (meta.live && meta.iso2) {
      stats = state.hubStats[meta.iso2] || null;
    }
    var hasStats = Boolean(meta.live && stats && stats.events != null);

    els.popup.classList.remove(
      'intl-country-popup--live',
      'intl-country-popup--building',
      'intl-country-popup--soon',
      'intl-country-popup--unavailable'
    );
    els.popup.classList.add('intl-country-popup--' + meta.status);

    if (meta.live) {
      els.popupKicker.textContent = 'Live';
    } else if (meta.building) {
      els.popupKicker.textContent = 'Building';
    } else if (meta.unavailable) {
      els.popupKicker.textContent = 'Not available';
    } else {
      els.popupKicker.textContent = 'Coming soon';
    }
    els.popupAction.textContent = popupActionText(meta);

    els.popupName.textContent = meta.name;

    if (els.popupDemand) {
      var demandCopy = formatPopupDemand(meta);
      if (demandCopy) {
        els.popupDemand.textContent = demandCopy;
        els.popupDemand.hidden = false;
      } else {
        els.popupDemand.textContent = '';
        els.popupDemand.hidden = true;
      }
    }

    if (hasStats) {
      els.popupStats.hidden = false;
      els.popupEvents.textContent = formatCount(stats.events);
      els.popupOrganisers.textContent = formatCount(stats.organisers);
      els.popupOpportunities.textContent = formatCount(stats.opportunities);
    } else {
      els.popupStats.hidden = true;
      els.popupEvents.textContent = '';
      els.popupOrganisers.textContent = '';
      els.popupOpportunities.textContent = '';
    }

    els.popup.hidden = false;
    window.requestAnimationFrame(function () {
      positionCountryPopup(path);
      els.popup.classList.add('is-visible');
    });
  }

  function loadHubStats() {
    return fetch('/api/international-hub-stats?country=GB')
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok && data.countryCode) {
          state.hubStats[data.countryCode] = {
            events: data.events,
            organisers: data.organisers,
            opportunities: data.opportunities,
          };
          var hovered = els.svg && els.svg.querySelector('.intl-country.is-hovered');
          if (hovered) {
            var id = hovered.getAttribute('data-country-id');
            var meta = state.countries.find(function (c) { return c.numericId === id; });
            if (meta) showCountryPopup(hovered, meta);
          }
        }
      })
      .catch(function () {});
  }

  function clearHover() {
    if (!els.svg) return;
    els.svg.querySelectorAll('.intl-country.is-hovered').forEach(function (node) {
      node.classList.remove('is-hovered');
    });
    hideCountryPopup();
  }

  function selectCountry(path, meta, options) {
    options = options || {};
    clearHover();
    if (path) path.classList.add('is-hovered');
    showCountryPopup(path, meta);
  }

  function onCountryActivate(path, meta) {
    if (!meta) return;

    if (meta.unavailable) {
      selectCountry(path, meta, { arm: false });
      return;
    }

    if (isCoarsePointer()) {
      handleCountryAction(meta);
      return;
    }

    handleCountryAction(meta);
  }

  function handleCountryAction(meta) {
    if (!meta || meta.unavailable) return;
    clearHover();
    // Live / building markets with a dedicated page (UK, Ireland, US) — go there.
    // Map-only / lower-demand markets share a regional browse drawer (e.g. Brazil → South America).
    if (meta.url) {
      trackIntl('intl_market_open', {
        country: meta.iso2 || '',
        status: meta.status || '',
        url: meta.url,
      });
      window.location.href = meta.url;
      return;
    }
    var region = regionMetaForCountry(meta.iso2);
    if (region && region.id) {
      openRegionBrowse(region, { fromCountry: meta });
      return;
    }
    openCountryBrowse(meta);
  }

  function closeActiveModal() {
    if (state.activeModal === 'browse') closeBrowsePanel();
    else if (state.activeModal === 'building') closeBuildingModal();
    else if (state.activeModal === 'interest') closeInterestModal();
    else if (state.activeModal === 'event') closeEventModal();
  }

  function statusLabel(meta) {
    if (!meta) return 'Events';
    if (meta.live) return 'Live';
    if (meta.building) return 'Building';
    return 'Coming soon';
  }

  function renderBrowseEventCard(row, options) {
    options = options || {};
    var place =
      escapeHtml(row.city || '') +
      (row.countryName ? ', ' + escapeHtml(row.countryName) : '');
    var countryChip =
      options.showCountry && row.countryName
        ? '<span class="intl-browse-card-country">' + escapeHtml(row.countryName) + '</span>'
        : '';
    var organiser = '';
    if (row.organiserName) {
      organiser = row.organiserWebsite
        ? '<p class="intl-browse-card-organiser"><a href="' +
          escapeAttr(row.organiserWebsite) +
          '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(row.organiserName) +
          '</a></p>'
        : '<p class="intl-browse-card-organiser">' + escapeHtml(row.organiserName) + '</p>';
    }
    var media = row.imageUrl
      ? '<div class="intl-browse-card-media"><img src="' +
        escapeAttr(row.imageUrl) +
        '" alt="" loading="lazy" decoding="async"></div>'
      : '';
    return (
      '<li class="intl-browse-card">' +
      media +
      '<div class="intl-browse-card-body">' +
      '<div class="intl-browse-card-top">' +
      '<span class="intl-browse-card-date">' +
      escapeHtml(formatEventDateRange(row)) +
      '</span>' +
      countryChip +
      '</div>' +
      '<h3 class="intl-browse-card-title">' +
      escapeHtml(row.title || 'Event') +
      '</h3>' +
      '<p class="intl-browse-card-place">' +
      place +
      '</p>' +
      organiser +
      '<a class="intl-browse-card-cta" href="' +
      escapeAttr(row.externalUrl || '#') +
      '" target="_blank" rel="noopener noreferrer">Open booking page →</a>' +
      '</div></li>'
    );
  }

  function browseActionsHtml(context) {
    var bits = [];
    if (context.kind === 'country' && context.meta) {
      var meta = context.meta;
      if (meta.live && meta.url) {
        bits.push(
          '<a class="intl-browse-btn intl-browse-btn--primary" href="https://www.thenetworkeruk.com/events/" rel="noopener noreferrer">Browse UK events</a>'
        );
        bits.push(
          '<a class="intl-browse-btn" href="' +
            escapeAttr(meta.url) +
            '" rel="noopener noreferrer">Open UK home</a>'
        );
      } else {
        if (meta.url) {
          bits.push(
            '<a class="intl-browse-btn" href="' +
              escapeAttr(meta.url) +
              '">Open market page</a>'
          );
        }
        if (meta.building) {
          bits.push(
            '<button type="button" class="intl-browse-btn" data-intl-browse-action="building">List a group</button>'
          );
        } else {
          bits.push(
            '<button type="button" class="intl-browse-btn" data-intl-browse-action="interest">Register interest</button>'
          );
        }
        bits.push(
          '<button type="button" class="intl-browse-btn intl-browse-btn--primary" data-intl-browse-action="add-event">Add an event</button>'
        );
      }
    } else {
      bits.push(
        '<button type="button" class="intl-browse-btn intl-browse-btn--primary" data-intl-browse-action="add-event">Add an event</button>'
      );
      bits.push(
        '<button type="button" class="intl-browse-btn" data-intl-browse-action="interest-region">Register interest</button>'
      );
    }
    return bits.join('');
  }

  function bindBrowseActions() {
    if (!els.browseActions) return;
    els.browseActions.querySelectorAll('[data-intl-browse-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-intl-browse-action');
        var context = state.browseContext;
        if (action === 'add-event') {
          var prefill = null;
          if (context && context.kind === 'country' && context.meta && !context.meta.live) {
            prefill = context.meta;
          } else if (context && context.kind === 'region' && context.fromCountry) {
            prefill = context.fromCountry;
          }
          closeBrowsePanel();
          openEventModal(prefill);
          return;
        }
        if (action === 'building' && context && context.meta) {
          closeBrowsePanel();
          openBuildingModal(context.meta);
          return;
        }
        if (action === 'interest' && context && context.meta) {
          closeBrowsePanel();
          openInterestModal(context.meta);
          return;
        }
        if (action === 'interest-region') {
          var fromCountry =
            context && context.kind === 'region' ? context.fromCountry || null : null;
          closeBrowsePanel();
          if (fromCountry) openInterestModal(fromCountry);
          else focusCountrySearch();
        }
      });
    });
  }

  function paintBrowseList(events, options) {
    options = options || {};
    if (!els.browseList || !els.browseStatus) return;
    if (!events.length) {
      els.browseStatus.hidden = false;
      els.browseStatus.textContent = options.emptyMessage || 'No upcoming link-out events here yet.';
      els.browseList.innerHTML = '';
      return;
    }
    els.browseStatus.hidden = true;
    els.browseList.innerHTML = events
      .map(function (row) {
        return renderBrowseEventCard(row, { showCountry: Boolean(options.showCountry) });
      })
      .join('');
  }

  function fetchBrowseEvents(countryCodes) {
    var codes = (countryCodes || []).filter(Boolean);
    var query = codes.length ? '?countries=' + encodeURIComponent(codes.join(',')) : '';
    return fetch('/api/international-event-listings' + query)
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        return data && Array.isArray(data.events) ? data.events : [];
      });
  }

  function openBrowseShell(context) {
    state.browseContext = context;
    state.activeModal = 'browse';
    if (els.eventModal) els.eventModal.hidden = true;
    if (els.buildingModal) els.buildingModal.hidden = true;
    if (els.modal) els.modal.hidden = true;
    if (els.browseKicker) els.browseKicker.textContent = context.kicker || 'Events';
    if (els.browseTitle) els.browseTitle.textContent = context.title || 'Events';
    if (els.browseLede) els.browseLede.textContent = context.lede || '';
    if (els.browseActions) {
      els.browseActions.innerHTML = browseActionsHtml(context);
      bindBrowseActions();
    }
    if (els.browseStatus) {
      els.browseStatus.hidden = false;
      els.browseStatus.textContent = 'Loading events…';
    }
    if (els.browseList) els.browseList.innerHTML = '';
    if (els.browsePanel) els.browsePanel.hidden = false;
    document.body.style.overflow = 'hidden';
    if (els.browseClose) els.browseClose.focus();
  }

  function closeBrowsePanel() {
    if (els.browsePanel) els.browsePanel.hidden = true;
    document.body.style.overflow = '';
    state.browseContext = null;
    if (state.activeModal === 'browse') state.activeModal = null;
  }

  function openCountryBrowse(meta) {
    if (!meta || meta.unavailable) return;
    trackIntl('intl_browse_open', { kind: 'country', country: meta.iso2 || '' });
    var lede;
    if (meta.live) {
      lede =
        'The UK platform is live — browse the full directory there. Link-out listings on International are for markets we are still building.';
    } else if (meta.building) {
      lede =
        'We are building here. Browse link-out events below, list your group, or add an event for review.';
    } else {
      lede =
        'Browse upcoming link-out networking events in ' +
        meta.name +
        ', then book on the organiser’s site.';
    }
    openBrowseShell({
      kind: 'country',
      meta: meta,
      kicker: statusLabel(meta),
      title: meta.name,
      lede: lede,
      countryCodes: meta.iso2 && meta.iso2 !== 'GB' ? [meta.iso2] : [],
    });

    if (meta.live) {
      paintBrowseList([], {
        emptyMessage:
          'UK events live on The Networker UK — use Browse UK events above for the full directory.',
      });
      return;
    }

    fetchBrowseEvents([meta.iso2])
      .then(function (events) {
        if (!state.browseContext || state.browseContext.kind !== 'country') return;
        if (!state.browseContext.meta || state.browseContext.meta.iso2 !== meta.iso2) return;
        paintBrowseList(events, {
          emptyMessage:
            'No upcoming link-out events in ' +
            meta.name +
            ' yet — add one, or register interest while we build.',
        });
      })
      .catch(function () {
        if (els.browseStatus) {
          els.browseStatus.hidden = false;
          els.browseStatus.textContent = 'Could not load events right now.';
        }
      });
  }

  function openRegionBrowse(region, options) {
    if (!region || !region.id) return;
    options = options || {};
    var fromCountry = options.fromCountry || null;
    var codes = Array.isArray(region.codes) ? region.codes.slice() : [];
    if (!codes.length && Array.isArray(region.countries)) {
      codes = region.countries.map(function (row) {
        return row && row.code;
      }).filter(Boolean);
    }
    trackIntl('intl_browse_open', {
      kind: 'region',
      region: region.id,
      country: (fromCountry && fromCountry.iso2) || '',
    });
    var singleCountry =
      codes.length === 1 &&
      (!fromCountry ||
        !fromCountry.iso2 ||
        String(fromCountry.iso2).toUpperCase() === String(codes[0]).toUpperCase());
    var sameName =
      fromCountry &&
      fromCountry.name &&
      String(fromCountry.name).toLowerCase() === String(region.name || '').toLowerCase();
    var lede;
    if (singleCountry || sameName) {
      lede =
        'Browse upcoming link-out networking events in ' +
        (fromCountry && fromCountry.name ? fromCountry.name : region.name) +
        ', then book on the organiser’s site.';
    } else if (fromCountry && fromCountry.name) {
      lede =
        fromCountry.name +
        ' is part of ' +
        region.name +
        ' — browse link-out networking events across the region, then book on the organiser’s site.';
    } else {
      lede =
        region.blurb ||
        'Browse upcoming link-out networking events across this region, then book on the organiser’s site.';
    }
    openBrowseShell({
      kind: 'region',
      region: region,
      fromCountry: fromCountry,
      kicker: singleCountry || sameName ? 'Country' : 'Region',
      title: region.name,
      lede: lede,
      countryCodes: codes,
    });
    fetchBrowseEvents(codes)
      .then(function (events) {
        if (!state.browseContext || state.browseContext.kind !== 'region') return;
        if (!state.browseContext.region || state.browseContext.region.id !== region.id) return;
        paintBrowseList(events, {
          showCountry: !(singleCountry || sameName),
          emptyMessage:
            'No upcoming link-out events across ' +
            region.name +
            ' yet — add one from your country.',
        });
      })
      .catch(function () {
        if (els.browseStatus) {
          els.browseStatus.hidden = false;
          els.browseStatus.textContent = 'Could not load events right now.';
        }
      });
  }

  function eventCountryOptions() {
    var fromSeed =
      typeof window.INTL_EVENT_COUNTRY_OPTIONS === 'function'
        ? window.INTL_EVENT_COUNTRY_OPTIONS()
        : [];
    var fromMap = state.countries
      .filter(function (meta) {
        return meta && meta.iso2 && !meta.unavailable && meta.iso2 !== 'GB';
      })
      .map(function (meta) {
        return { iso2: meta.iso2, name: meta.name };
      });
    var byCode = {};
    EVENT_COUNTRY_FALLBACK.concat(fromSeed, fromMap).forEach(function (row) {
      if (!row || !row.iso2 || row.iso2 === 'GB') return;
      byCode[row.iso2] = { iso2: row.iso2, name: row.name };
    });
    return Object.keys(byCode)
      .map(function (code) {
        return byCode[code];
      })
      .sort(function (a, b) {
        return a.name.localeCompare(b.name, 'en-GB');
      });
  }

  function fillEventCountrySelects() {
    var options = eventCountryOptions();
    var selects = [els.eventCountry, els.eventsFilter];
    selects.forEach(function (select) {
      if (!select) return;
      var previous = select.value || '';
      var isFilter = select === els.eventsFilter;
      var html = isFilter
        ? '<option value="">All countries</option>'
        : '<option value="">Select a country</option>';
      options.forEach(function (meta) {
        html +=
          '<option value="' +
          meta.iso2 +
          '">' +
          meta.name +
          '</option>';
      });
      select.innerHTML = html;
      if (previous && Array.prototype.some.call(select.options, function (opt) {
        return opt.value === previous;
      })) {
        select.value = previous;
      }
    });
  }

  function formatEventDate(iso) {
    if (!iso) return '';
    try {
      return new Date(String(iso) + 'T00:00:00').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      return String(iso);
    }
  }

  function formatEventLocalTime(raw) {
    var value = String(raw || '').trim();
    if (!value) return '';
    var match = value.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return '';
    var hours = Number(match[1]);
    var minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return '';
    var suffix = hours >= 12 ? 'pm' : 'am';
    var hour12 = hours % 12;
    if (hour12 === 0) hour12 = 12;
    return hour12 + ':' + String(minutes).padStart(2, '0') + suffix;
  }

  function formatEventDateRange(row) {
    var start = formatEventDate(row.startsOn);
    var time = formatEventLocalTime(row.startsAtLocal);
    if (time) start = start + ' · ' + time;
    if (!row.endsOn || row.endsOn === row.startsOn) return start;
    return start + ' – ' + formatEventDate(row.endsOn);
  }

  function updateEventsRailNav() {
    if (!els.eventsRail || !els.eventsRailPrev || !els.eventsRailNext) return;
    var maxScroll = Math.max(0, els.eventsRail.scrollWidth - els.eventsRail.clientWidth - 2);
    var left = els.eventsRail.scrollLeft;
    els.eventsRailPrev.disabled = left <= 2;
    els.eventsRailNext.disabled = left >= maxScroll;
  }

  function renderEventsList() {
    if (!els.eventsList || !els.eventsStatus) return;
    var filter = String(state.eventsFilter || '').toUpperCase();
    var rows = state.events.filter(function (row) {
      if (!filter) return true;
      return String(row.countryCode || '').toUpperCase() === filter;
    });

    if (!state.events.length) {
      els.eventsStatus.hidden = false;
      els.eventsStatus.textContent =
        'No upcoming link-out events yet — be the first to add one.';
      els.eventsList.innerHTML = '';
      if (els.eventsRailWrap) els.eventsRailWrap.hidden = true;
      return;
    }

    if (!rows.length) {
      els.eventsStatus.hidden = false;
      els.eventsStatus.textContent = 'No upcoming events in that country yet.';
      els.eventsList.innerHTML = '';
      if (els.eventsRailWrap) els.eventsRailWrap.hidden = true;
      return;
    }

    els.eventsStatus.hidden = true;
    if (els.eventsRailWrap) els.eventsRailWrap.hidden = false;
    els.eventsList.innerHTML = rows
      .map(function (row) {
        var organiser = '';
        if (row.organiserName) {
          organiser = row.organiserWebsite
            ? '<p class="intl-events-item-organiser"><a href="' +
              escapeAttr(row.organiserWebsite) +
              '" target="_blank" rel="noopener noreferrer">' +
              escapeHtml(row.organiserName) +
              '</a></p>'
            : '<p class="intl-events-item-organiser">' +
              escapeHtml(row.organiserName) +
              '</p>';
        }
        var countryChip = row.countryName
          ? '<span class="intl-events-item-country">' + escapeHtml(row.countryName) + '</span>'
          : '';
        var media = row.imageUrl
          ? '<div class="intl-events-item-media"><img src="' +
            escapeAttr(row.imageUrl) +
            '" alt="" loading="lazy" decoding="async"></div>'
          : '<div class="intl-events-item-media intl-events-item-media--empty" aria-hidden="true">Event</div>';
        return (
          '<li class="intl-events-item">' +
          media +
          '<div class="intl-events-item-body">' +
          '<div class="intl-events-item-meta">' +
          '<span>' +
          escapeHtml(formatEventDateRange(row)) +
          '</span>' +
          countryChip +
          '</div>' +
          '<h3 class="intl-events-item-title">' +
          escapeHtml(row.title || 'Event') +
          '</h3>' +
          '<p class="intl-events-item-place">' +
          escapeHtml((row.city || '') + (row.countryName ? ', ' + row.countryName : '')) +
          '</p>' +
          organiser +
          '<a class="intl-events-item-link" href="' +
          escapeAttr(row.externalUrl || '#') +
          '" target="_blank" rel="noopener noreferrer">Open booking page →</a>' +
          '</div></li>'
        );
      })
      .join('');
    if (els.eventsRail) els.eventsRail.scrollLeft = 0;
    window.requestAnimationFrame(updateEventsRailNav);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, '&#39;');
  }

  function loadEvents() {
    if (!els.eventsStatus || !els.eventsList) return Promise.resolve();
    els.eventsStatus.hidden = false;
    els.eventsStatus.textContent = 'Loading events…';
    return fetch('/api/international-event-listings')
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        state.events = data && Array.isArray(data.events) ? data.events : [];
        renderEventsList();
      })
      .catch(function () {
        els.eventsStatus.hidden = false;
        els.eventsStatus.textContent = 'Could not load events right now.';
        els.eventsList.innerHTML = '';
      });
  }

  function openEventModal(prefillCountry) {
    state.activeModal = 'event';
    if (els.browsePanel) els.browsePanel.hidden = true;
    if (els.interestModal) els.interestModal.hidden = true;
    if (els.buildingModal) els.buildingModal.hidden = true;
    fillEventCountrySelects();
    if (els.eventForm) {
      els.eventForm.hidden = false;
      els.eventForm.reset();
    }
    if (els.eventSuccess) els.eventSuccess.hidden = true;
    if (els.eventError) {
      els.eventError.hidden = true;
      els.eventError.textContent = '';
    }
    if (els.eventSubmit) els.eventSubmit.disabled = false;
    if (prefillCountry && prefillCountry.iso2 && els.eventCountry) {
      els.eventCountry.value = prefillCountry.iso2;
    }
    if (els.eventModal) els.eventModal.hidden = false;
    document.body.style.overflow = 'hidden';
    if (els.eventTitleField) els.eventTitleField.focus();
  }

  function closeEventModal() {
    if (els.eventModal) els.eventModal.hidden = true;
    document.body.style.overflow = '';
    if (state.activeModal === 'event') state.activeModal = null;
  }

  function openInterestModal(meta) {
    state.selectedCountry = meta;
    state.selectedIntent = 'attend';
    state.activeModal = 'interest';
    if (els.browsePanel) els.browsePanel.hidden = true;
    els.modalCountry.textContent = meta.name;
    els.modalLede.textContent =
      'The Networker isn\u2019t live in ' +
      meta.name +
      ' yet. Tell us if you\u2019d like to attend events or list a networking group when we launch.';
    els.intentButtons.forEach(function (btn) {
      btn.classList.toggle('is-selected', btn.getAttribute('data-intent') === 'attend');
    });
    els.form.hidden = false;
    els.success.hidden = true;
    els.error.hidden = true;
    els.error.textContent = '';
    els.email.value = '';
    els.submit.disabled = false;
    if (els.eventModal) els.eventModal.hidden = true;
    els.buildingModal.hidden = true;
    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    els.email.focus();
  }

  function closeInterestModal() {
    els.modal.hidden = true;
    document.body.style.overflow = '';
    state.selectedCountry = null;
    if (state.activeModal === 'interest') state.activeModal = null;
  }

  function openBuildingModal(meta) {
    state.selectedCountry = meta;
    state.selectedOrgType = 'networking_group';
    state.activeModal = 'building';
    if (els.browsePanel) els.browsePanel.hidden = true;
    els.buildingCountry.textContent = meta.name;
    els.buildingLede.textContent =
      'We\u2019re building The Networker in ' +
      meta.name +
      '. Tell us about your networking group or training organisation and we\u2019ll be in touch.';
    els.orgButtons.forEach(function (btn) {
      btn.classList.toggle('is-selected', btn.getAttribute('data-org-type') === 'networking_group');
    });
    els.buildingForm.hidden = false;
    els.buildingSuccess.hidden = true;
    els.buildingError.hidden = true;
    els.buildingError.textContent = '';
    els.buildingForm.reset();
    els.buildingSubmit.disabled = false;
    if (els.eventModal) els.eventModal.hidden = true;
    els.modal.hidden = true;
    els.buildingModal.hidden = false;
    document.body.style.overflow = 'hidden';
    els.buildingName.focus();
  }

  function closeBuildingModal() {
    els.buildingModal.hidden = true;
    document.body.style.overflow = '';
    state.selectedCountry = null;
    if (state.activeModal === 'building') state.activeModal = null;
  }

  function featuredRank(meta) {
    if (meta.numericId === '826') return 0;
    if (meta.numericId === '372') return 1;
    if (meta.numericId === '840') return 2;
    if (meta.live) return 3;
    if (meta.building) return 4;
    return 5;
  }

  function searchableCountries() {
    return state.countries
      .filter(function (meta) {
        return !meta.unavailable;
      })
      .slice()
      .sort(function (a, b) {
        var rankDiff = featuredRank(a) - featuredRank(b);
        if (rankDiff !== 0) return rankDiff;
        return a.name.localeCompare(b.name);
      });
  }

  function statusBadge(meta) {
    if (meta.live) return 'Live';
    if (meta.building) return 'Building';
    return 'Coming soon';
  }

  function renderCountryResults(query, container, options) {
    if (!container) return;
    options = options || {};
    var normalized = String(query || '').trim().toLowerCase();
    var matches = searchableCountries().filter(function (meta) {
      if (!normalized) return meta.live || meta.building;
      return meta.name.toLowerCase().indexOf(normalized) !== -1;
    });

    container.innerHTML = '';

    if (options.hideWhenEmpty && !normalized) {
      container.hidden = true;
      return;
    }

    container.hidden = false;

    if (!matches.length) {
      var empty = document.createElement('p');
      empty.className = 'intl-country-results-empty';
      empty.textContent = 'No matching countries yet. Try another search.';
      container.appendChild(empty);
      return;
    }

    matches.slice(0, normalized ? 10 : 6).forEach(function (meta) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'intl-country-result intl-country-result--' + meta.status;
      button.setAttribute('role', 'option');
      var demandRow = !meta.live ? interestRowFor(meta) : null;
      var demandHtml =
        demandRow && demandRow.total >= 1
          ? '<span class="intl-country-result-demand">' +
            formatCount(demandRow.total) +
            ' registered</span>'
          : '';
      var region = !meta.live && !meta.building ? regionMetaForCountry(meta.iso2) : null;
      var regionHtml =
        region && region.name
          ? '<span class="intl-country-result-region">' + region.name + '</span>'
          : '';
      button.innerHTML =
        '<span class="intl-country-result-copy">' +
        '<span class="intl-country-result-name">' +
        meta.name +
        '</span>' +
        regionHtml +
        demandHtml +
        '</span>' +
        '<span class="intl-country-result-status">' +
        statusBadge(meta) +
        '</span>';
      button.addEventListener('click', function () {
        handleCountryAction(meta);
        if (els.headerResults) els.headerResults.hidden = true;
      });
      container.appendChild(button);
    });
  }

  function initCountryFinder() {
    if (els.search) {
      els.search.addEventListener('input', function () {
        renderCountryResults(els.search.value, els.results);
        trackSearchQuery(els.search.value);
      });
    }

    if (els.headerSearch) {
      els.headerSearch.addEventListener('input', function () {
        renderCountryResults(els.headerSearch.value, els.headerResults, { hideWhenEmpty: true });
        trackSearchQuery(els.headerSearch.value);
      });
      els.headerSearch.addEventListener('focus', function () {
        if (els.headerSearch.value) {
          renderCountryResults(els.headerSearch.value, els.headerResults, { hideWhenEmpty: true });
        }
      });
      document.addEventListener('click', function (event) {
        if (!els.headerFinder) return;
        if (!els.headerFinder.contains(event.target)) {
          els.headerResults.hidden = true;
        }
      });
    }

    if (els.featuredButtons.length) {
      els.featuredButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          var href = button.getAttribute('href') || '';
          var id = button.getAttribute('data-country-id');
          var meta = id
            ? state.countries.find(function (country) {
                return country.numericId === id;
              })
            : null;
          trackIntl('intl_featured_click', {
            country: (meta && meta.iso2) || href || id || 'unknown',
            status: (meta && meta.status) || 'link',
          });
          // Anchor CTAs navigate to country landings / UK — do not intercept.
          if (href) return;
          if (meta) handleCountryAction(meta);
        });
      });
    }
  }

  function focusCountrySearch() {
    var target = null;
    if (els.search && window.matchMedia('(max-width: 860px)').matches) {
      target = els.search;
      if (els.mobilePicker) {
        els.mobilePicker.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else if (els.headerSearch) {
      target = els.headerSearch;
    } else if (els.search) {
      target = els.search;
      if (els.mobilePicker) {
        els.mobilePicker.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    if (!target) return;
    window.setTimeout(function () {
      target.focus();
      if (typeof target.select === 'function') target.select();
    }, 250);
  }

  function initEventCtas() {
    function onAdd() {
      trackIntl('intl_home_cta_click', { cta: 'add_event' });
      openEventModal();
    }
    var introBtn = byId('intl-add-event-btn');
    var sectionBtn = byId('intl-events-add-btn');
    if (introBtn) introBtn.addEventListener('click', onAdd);
    if (sectionBtn) sectionBtn.addEventListener('click', onAdd);
    if (els.eventsFilter) {
      els.eventsFilter.addEventListener('change', function () {
        state.eventsFilter = String(els.eventsFilter.value || '').toUpperCase();
        renderEventsList();
      });
    }
    function scrollEventsRail(dir) {
      if (!els.eventsRail) return;
      var step = Math.max(240, Math.round(els.eventsRail.clientWidth * 0.85));
      els.eventsRail.scrollBy({ left: dir * step, behavior: 'smooth' });
    }
    if (els.eventsRailPrev) {
      els.eventsRailPrev.addEventListener('click', function () {
        scrollEventsRail(-1);
      });
    }
    if (els.eventsRailNext) {
      els.eventsRailNext.addEventListener('click', function () {
        scrollEventsRail(1);
      });
    }
    if (els.eventsRail) {
      els.eventsRail.addEventListener('scroll', updateEventsRailNav, { passive: true });
      window.addEventListener('resize', updateEventsRailNav);
    }
  }

  function submitEventListing() {
    var title = String(els.eventTitleField.value || '').trim();
    var startsOn = String(els.eventStarts.value || '').trim();
    var endsOn = String(els.eventEnds.value || '').trim();
    var city = String(els.eventCity.value || '').trim();
    var countryCode = String(els.eventCountry.value || '').trim().toUpperCase();
    var countryName = '';
    if (els.eventCountry && els.eventCountry.selectedIndex >= 0) {
      countryName = String(els.eventCountry.options[els.eventCountry.selectedIndex].text || '').trim();
    }
    var startsAtLocal = els.eventTime ? String(els.eventTime.value || '').trim() : '';
    var organiserName = String(els.eventOrganiser.value || '').trim();
    var organiserWebsite = String(els.eventOrganiserWebsite.value || '').trim();
    var externalUrl = String(els.eventUrl.value || '').trim();
    var imageUrl = els.eventImage ? String(els.eventImage.value || '').trim() : '';
    var contactName = String(els.eventContact.value || '').trim();
    var email = String(els.eventEmail.value || '').trim();
    var honeypot = els.eventForm.querySelector('[name="website_hp"]');

    if (!title) {
      els.eventError.textContent = 'Enter the event title.';
      els.eventError.hidden = false;
      return;
    }
    if (!startsOn) {
      els.eventError.textContent = 'Enter a start date.';
      els.eventError.hidden = false;
      return;
    }
    if (!city) {
      els.eventError.textContent = 'Enter the city.';
      els.eventError.hidden = false;
      return;
    }
    if (!countryCode) {
      els.eventError.textContent = 'Choose a country.';
      els.eventError.hidden = false;
      return;
    }
    if (!organiserName) {
      els.eventError.textContent = 'Enter the organiser or group name.';
      els.eventError.hidden = false;
      return;
    }
    if (!externalUrl) {
      els.eventError.textContent = 'Enter a booking or info URL.';
      els.eventError.hidden = false;
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      els.eventError.textContent = 'Enter a valid email address.';
      els.eventError.hidden = false;
      return;
    }

    els.eventError.hidden = true;
    els.eventSubmit.disabled = true;

    fetch('/api/international-event-listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        startsOn: startsOn,
        endsOn: endsOn || undefined,
        startsAtLocal: startsAtLocal || undefined,
        city: city,
        countryCode: countryCode,
        countryName: countryName,
        organiserName: organiserName,
        organiserWebsite: organiserWebsite || undefined,
        externalUrl: externalUrl,
        imageUrl: imageUrl || undefined,
        name: contactName || undefined,
        email: email,
        website_hp: honeypot ? String(honeypot.value || '') : '',
        source: 'international_events_section',
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data.ok) {
          throw new Error((result.data && result.data.message) || 'Could not save your event.');
        }
        trackIntl('intl_event_submit', { country: countryCode });
        els.eventForm.hidden = true;
        els.eventSuccess.hidden = false;
      })
      .catch(function (err) {
        els.eventError.textContent = err.message || 'Something went wrong. Please try again.';
        els.eventError.hidden = false;
        els.eventSubmit.disabled = false;
      });
  }

  function initRegisterInterestCta() {
    var btn = byId('intl-register-interest-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      trackIntl('intl_home_cta_click', { cta: 'register_interest' });
      focusCountrySearch();
    });
  }

  function renderRegionMarkets() {
    var host = byId('intl-markets-regions');
    if (!host) return;
    host.innerHTML = '';

    var regions = (state.regionStats || [])
      .filter(function (region) {
        return region.marketsList && region.display && region.listTotal >= 1;
      })
      .slice()
      .sort(function (a, b) {
        return (b.listTotal || 0) - (a.listTotal || 0);
      });

    if (!regions.length) {
      var empty = document.createElement('li');
      empty.className = 'intl-markets-region intl-markets-region--empty';
      empty.innerHTML =
        '<span class="intl-markets-name">Other countries</span>' +
        '<span class="intl-markets-status intl-markets-status--soon">Coming soon</span>' +
        '<p>Use the map or search above to register interest for your country. Small markets share a region until we launch a local hub.</p>';
      host.appendChild(empty);
      return;
    }

    regions.forEach(function (region) {
      var item = document.createElement('li');
      item.className = 'intl-markets-region';
      item.innerHTML =
        '<button type="button" class="intl-markets-region-btn" data-intl-region-id="' +
        escapeAttr(region.id) +
        '">' +
        '<div class="intl-markets-region-head">' +
        '<span class="intl-markets-name">' +
        escapeHtml(region.name) +
        '</span>' +
        '<span class="intl-markets-status intl-markets-status--soon">Browse events</span>' +
        '</div>' +
        '<p>' +
        escapeHtml(
          region.blurb ||
            'Register interest for your country on the map — no separate page yet.'
        ) +
        '</p>' +
        '<p class="intl-markets-demand">' +
        escapeHtml(formatMarketsDemand(region.listTotal) + ' across this region') +
        '</p>' +
        '</button>';
      host.appendChild(item);
    });

    host.querySelectorAll('[data-intl-region-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-intl-region-id');
        var region =
          (state.regionStats || []).find(function (row) {
            return row.id === id;
          }) ||
          state.regionMeta[id] ||
          null;
        if (region) openRegionBrowse(region);
      });
    });
  }

  function loadInterestDemand() {
    return fetch('/api/international-interest-stats')
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok || !data.countries) return;
        state.interestStats = data.countries;
        state.regionStats = Array.isArray(data.regions) ? data.regions : [];
        state.countryToRegion = data.countryToRegion || {};
        state.regionMeta = {};
        (data.regionMeta || state.regionStats).forEach(function (row) {
          if (!row || !row.id) return;
          state.regionMeta[row.id] = row;
        });

        document.querySelectorAll('[data-demand-country]').forEach(function (node) {
          var code = String(node.getAttribute('data-demand-country') || '')
            .trim()
            .toUpperCase();
          var row = data.countries[code];
          if (!row || !row.display) return;
          node.textContent = formatMarketsDemand(row.total);
          node.hidden = false;
        });

        renderRegionMarkets();

        if (els.results) renderCountryResults(els.search ? els.search.value : '', els.results);
        if (els.headerSearch && els.headerResults) {
          renderCountryResults(els.headerSearch.value, els.headerResults, { hideWhenEmpty: true });
        }

        var hovered = els.svg && els.svg.querySelector('.intl-country.is-hovered');
        if (hovered) {
          var id = hovered.getAttribute('data-country-id');
          var meta = state.countries.find(function (c) {
            return c.numericId === id;
          });
          if (meta) showCountryPopup(hovered, meta);
        }
      })
      .catch(function () {});
  }

  function initLearnMorePanel() {
    var toggle = byId('intl-learn-toggle');
    var panel = byId('intl-learn-panel');
    if (!toggle || !panel) return;
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      var next = !open;
      toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
      panel.hidden = !next;
    });
  }

  function populateCountryFinder() {
    var sorted = state.countries
      .filter(function (meta) {
        return !meta.unavailable;
      })
      .slice()
      .sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
    if (els.search) {
      els.search.setAttribute('aria-label', 'Search for your country');
    }
    if (sorted.length) renderCountryResults('', els.results);
  }

  function countryStatusLabel(meta) {
    if (meta.live) return ' — live';
    if (meta.building) return ' — building';
    if (meta.unavailable) return ' — not available';
    return ' — coming soon';
  }

  function metaForCountryPath(path) {
    if (!path) return null;
    var id = path.getAttribute('data-country-id');
    if (!id) return null;
    return (
      state.countries.find(function (country) {
        return country.numericId === id;
      }) || null
    );
  }

  function countryPathFromPoint(clientX, clientY) {
    function matchAt(x, y) {
      var stack = document.elementsFromPoint(x, y) || [];
      for (var i = 0; i < stack.length; i++) {
        var node = stack[i];
        if (node && node.classList && node.classList.contains('intl-country')) {
          return node;
        }
      }
      return null;
    }

    var direct = matchAt(clientX, clientY);
    if (direct) return direct;

    // Soften near-misses (thin islands, automation clicks, arc glow edges).
    var deltas = [0, -3, 3, -6, 6, -10, 10, -14, 14];
    for (var yi = 0; yi < deltas.length; yi++) {
      for (var xi = 0; xi < deltas.length; xi++) {
        if (!xi && !yi) continue;
        var hit = matchAt(clientX + deltas[xi], clientY + deltas[yi]);
        if (hit) return hit;
      }
    }
    return null;
  }

  function bindCountryPath(path, meta) {
    path.setAttribute('data-country-id', meta.numericId);
    if (meta.iso2) path.setAttribute('data-country-iso2', meta.iso2);
    if (!meta.unavailable) {
      path.setAttribute('tabindex', '0');
      path.setAttribute('role', 'button');
    } else {
      path.removeAttribute('tabindex');
      path.setAttribute('role', 'img');
    }
    path.setAttribute('aria-label', meta.name + countryStatusLabel(meta));

    function onEnter() {
      if (isCoarsePointer()) return;
      selectCountry(path, meta, { arm: false });
    }

    function onLeave() {
      if (isCoarsePointer()) return;
      path.classList.remove('is-hovered');
      hideCountryPopup();
    }

    path.addEventListener('mouseenter', onEnter);
    path.addEventListener('mouseleave', onLeave);
    path.addEventListener('focus', function () {
      selectCountry(path, meta, { arm: false });
    });
    path.addEventListener('blur', onLeave);
    path.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      onCountryActivate(path, meta);
    });
    path.addEventListener('keydown', function (event) {
      if (meta.unavailable) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleCountryAction(meta);
      }
    });
  }

  function bindMapClickFallback() {
    if (!els.svg || els.svg.dataset.intlClickBound === '1') return;
    els.svg.dataset.intlClickBound = '1';
    els.svg.addEventListener('click', function (event) {
      if (event.defaultPrevented) return;
      var path = countryPathFromPoint(event.clientX, event.clientY);
      if (!path) return;
      var meta = metaForCountryPath(path);
      if (!meta) return;
      event.preventDefault();
      onCountryActivate(path, meta);
    });
  }

  function featureByNumericId(features, numericId) {
    return features.find(function (feature) {
      return padNumericId(feature.id) === numericId;
    });
  }

  function arcPath(projection, fromFeature, toFeature) {
    var from = projection(window.d3.geoCentroid(fromFeature));
    var to = projection(window.d3.geoCentroid(toFeature));
    if (!from || !to) return '';
    var mx = (from[0] + to[0]) / 2;
    var my = (from[1] + to[1]) / 2 - Math.abs(to[0] - from[0]) * 0.14 - 28;
    return 'M' + from[0] + ',' + from[1] + ' Q' + mx + ',' + my + ' ' + to[0] + ',' + to[1];
  }

  function ensureMapDefs() {
    if (!els.svg || els.svg.querySelector('#intl-arc-live')) return;

    var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    var liveGrad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    liveGrad.setAttribute('id', 'intl-arc-live');
    liveGrad.setAttribute('gradientUnits', 'userSpaceOnUse');
    liveGrad.setAttribute('x1', '0');
    liveGrad.setAttribute('y1', '0');
    liveGrad.setAttribute('x2', '960');
    liveGrad.setAttribute('y2', '500');
    liveGrad.innerHTML =
      '<stop offset="0%" stop-color="#b189b8" stop-opacity="0.15"></stop>' +
      '<stop offset="45%" stop-color="#b189b8" stop-opacity="0.85"></stop>' +
      '<stop offset="100%" stop-color="#b8956a" stop-opacity="0.35"></stop>';

    var buildingGrad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    buildingGrad.setAttribute('id', 'intl-arc-building');
    buildingGrad.setAttribute('gradientUnits', 'userSpaceOnUse');
    buildingGrad.setAttribute('x1', '0');
    buildingGrad.setAttribute('y1', '0');
    buildingGrad.setAttribute('x2', '960');
    buildingGrad.setAttribute('y2', '500');
    buildingGrad.innerHTML =
      '<stop offset="0%" stop-color="#b8956a" stop-opacity="0.2"></stop>' +
      '<stop offset="50%" stop-color="#c9ad7a" stop-opacity="0.75"></stop>' +
      '<stop offset="100%" stop-color="#b8956a" stop-opacity="0.25"></stop>';

    defs.appendChild(liveGrad);
    defs.appendChild(buildingGrad);
    els.svg.insertBefore(defs, els.svg.firstChild);
  }

  function renderNetworkArcs(projection, features) {
    if (!els.svg) return;

    var hubFeature = featureByNumericId(features, '826');
    if (!hubFeature) return;

    var arcsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    arcsGroup.setAttribute('class', 'intl-map-arcs');
    arcsGroup.setAttribute('aria-hidden', 'true');

    var links = [
      { to: '372', className: 'intl-map-arc--building' },
      { to: '840', className: 'intl-map-arc--building' },
    ];

    links.forEach(function (link) {
      var target = featureByNumericId(features, link.to);
      if (!target) return;
      var d = arcPath(projection, hubFeature, target);
      if (!d) return;

      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.classList.add('intl-map-arc');
      path.classList.add(link.className);
      arcsGroup.appendChild(path);
    });

    if (arcsGroup.childNodes.length) {
      els.svg.insertBefore(arcsGroup, els.svg.firstChild.nextSibling);
    }
  }

  function pulseCountries(selector, pulseClass, glowClass) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (els.svg) {
        els.svg.querySelectorAll(selector).forEach(function (path) {
          path.classList.add(glowClass);
        });
      }
      return;
    }

    var paths = els.svg ? els.svg.querySelectorAll(selector) : [];
    paths.forEach(function (path) {
      path.classList.add(pulseClass);
      path.addEventListener('animationend', function onEnd() {
        path.classList.remove(pulseClass);
        path.classList.add(glowClass);
        path.removeEventListener('animationend', onEnd);
      });
    });
  }

  function pulseLiveCountries() {
    pulseCountries('.intl-country--live', 'is-intro-pulse', 'is-active-glow');
  }

  function pulseBuildingCountries() {
    pulseCountries('.intl-country--building', 'is-intro-pulse', 'is-active-glow');
  }

  function buildProjection(world) {
    var land = window.topojson.feature(world, world.objects.countries);
    // Always fit the full world into the SVG viewBox so no countries are
    // cropped on narrow phones (a prior mobile zoom clipped Americas / Asia).
    return window.d3.geoNaturalEarth1().fitSize([960, 500], land);
  }

  function renderMap(world) {
    var projection = buildProjection(world);
    var pathGen = window.d3.geoPath(projection);
    var features = window.topojson.feature(world, world.objects.countries).features;

    state.countries = features.map(countryMeta);
    populateCountryFinder();
    fillEventCountrySelects();

    ensureMapDefs();

    var countriesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    countriesGroup.setAttribute('id', 'intl-map-countries');

    features.forEach(function (feature) {
      var meta = countryMeta(feature);
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathGen(feature));
      path.classList.add('intl-country');
      if (meta.live) path.classList.add('intl-country--live');
      else if (meta.building) path.classList.add('intl-country--building');
      else if (meta.unavailable) path.classList.add('intl-country--unavailable');
      else path.classList.add('intl-country--soon');
      bindCountryPath(path, meta);
      countriesGroup.appendChild(path);
    });

    els.svg.appendChild(countriesGroup);
    renderNetworkArcs(projection, features);
    bindMapClickFallback();

    els.loading.hidden = true;
    state.mapReady = true;
    if (els.mapWrap) els.mapWrap.classList.add('is-ready');
    pulseLiveCountries();
    pulseBuildingCountries();
  }

  function initModal() {
    document.querySelectorAll('[data-intl-modal-close], [data-intl-browse-close]').forEach(function (node) {
      node.addEventListener('click', closeActiveModal);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && state.activeModal) closeActiveModal();
    });

    els.intentButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.selectedIntent = btn.getAttribute('data-intent') || 'attend';
        els.intentButtons.forEach(function (other) {
          other.classList.toggle('is-selected', other === btn);
        });
      });
    });

    els.orgButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.selectedOrgType = btn.getAttribute('data-org-type') || 'networking_group';
        els.orgButtons.forEach(function (other) {
          other.classList.toggle('is-selected', other === btn);
        });
      });
    });

    els.form.addEventListener('submit', function (event) {
      event.preventDefault();
      submitInterest();
    });

    els.buildingForm.addEventListener('submit', function (event) {
      event.preventDefault();
      submitBuildingIntake();
    });

    if (els.eventForm) {
      els.eventForm.addEventListener('submit', function (event) {
        event.preventDefault();
        submitEventListing();
      });
    }
  }

  function submitInterest() {
    if (!state.selectedCountry) return;
    var email = String(els.email.value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      els.error.textContent = 'Enter a valid email address.';
      els.error.hidden = false;
      return;
    }

    els.error.hidden = true;
    els.submit.disabled = true;

    fetch('/api/international-interest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        countryCode: state.selectedCountry.iso2,
        countryName: state.selectedCountry.name,
        intent: state.selectedIntent,
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data.ok) {
          throw new Error((result.data && result.data.message) || 'Could not save your interest.');
        }
        trackIntl('intl_interest_submit', {
          country: state.selectedCountry.iso2,
          intent: state.selectedIntent,
        });
        els.form.hidden = true;
        if (els.success) {
          els.success.innerHTML =
            'You\u2019re on the list for ' +
            state.selectedCountry.name +
            '. We\u2019ll email you when we launch. Meanwhile, preview the live UK site at <a href="https://www.thenetworkeruk.com" rel="noopener noreferrer">thenetworkeruk.com</a>.';
          els.success.hidden = false;
        }
      })
      .catch(function (err) {
        els.error.textContent = err.message || 'Something went wrong. Please try again.';
        els.error.hidden = false;
        els.submit.disabled = false;
      });
  }

  function submitBuildingIntake() {
    if (!state.selectedCountry) return;

    var name = String(els.buildingName.value || '').trim();
    var email = String(els.buildingEmail.value || '').trim();
    var group = String(els.buildingGroup.value || '').trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      els.buildingError.textContent = 'Enter a valid email address.';
      els.buildingError.hidden = false;
      return;
    }
    if (!group) {
      els.buildingError.textContent = 'Enter your group or organisation name.';
      els.buildingError.hidden = false;
      return;
    }

    els.buildingError.hidden = true;
    els.buildingSubmit.disabled = true;

    fetch('/api/international-group-intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        email: email,
        phone: String(els.buildingPhone.value || '').trim(),
        group: group,
        website: String(els.buildingWebsite.value || '').trim(),
        description: String(els.buildingDescription.value || '').trim(),
        orgType: state.selectedOrgType,
        countryCode: state.selectedCountry.iso2,
        countryName: state.selectedCountry.name,
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data.ok) {
          throw new Error((result.data && result.data.message) || 'Could not save your details.');
        }
        trackIntl('intl_building_submit', {
          country: state.selectedCountry.iso2,
          orgType: state.selectedOrgType,
        });
        els.buildingForm.hidden = true;
        els.buildingSuccess.hidden = false;
      })
      .catch(function (err) {
        els.buildingError.textContent = err.message || 'Something went wrong. Please try again.';
        els.buildingError.hidden = false;
        els.buildingSubmit.disabled = false;
      });
  }

  function initMap() {
    return Promise.all([
      loadScript('https://unpkg.com/topojson-client@3'),
      loadScript('https://unpkg.com/d3@7'),
    ])
      .then(function () {
        return fetch('/data/countries-110m.json');
      })
      .then(function (res) {
        if (!res.ok) throw new Error('Map data failed to load');
        return res.json();
      })
      .then(renderMap)
      .catch(function () {
        if (els.loading) {
          els.loading.textContent = 'Could not load the map. Use the country list below.';
        }
      });
  }

  function initFooter() {
    var yearEl = document.getElementById('intl-footer-year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
    var cookieBtn = document.getElementById('intl-footer-cookie-settings');
    if (cookieBtn) {
      cookieBtn.addEventListener('click', function () {
        if (window.HubCookieConsent && window.HubCookieConsent.openSettings) {
          window.HubCookieConsent.openSettings();
        }
      });
    }
  }

  function init() {
    seedRegionMaps();
    initFooter();
    els.canvas = byId('intl-map-canvas');
    els.mapWrap = byId('intl-map-wrap');
    els.svg = byId('intl-map-svg');
    els.loading = byId('intl-map-loading');
    els.mobilePicker = byId('intl-mobile-picker');
    els.search = byId('intl-country-search');
    els.results = byId('intl-country-results');
    els.headerFinder = byId('intl-header-finder');
    els.headerSearch = byId('intl-header-search');
    els.headerResults = byId('intl-header-results');
    els.featuredButtons = Array.prototype.slice.call(
      document.querySelectorAll('.intl-featured-country, .intl-featured-country')
    );
    els.popup = byId('intl-country-popup');
    els.popupKicker = byId('intl-popup-kicker');
    els.popupName = byId('intl-popup-name');
    els.popupDemand = byId('intl-popup-demand');
    els.popupStats = byId('intl-popup-stats');
    els.popupEvents = byId('intl-popup-events');
    els.popupOrganisers = byId('intl-popup-organisers');
    els.popupOpportunities = byId('intl-popup-opportunities');
    els.popupAction = byId('intl-popup-action');
    els.modal = byId('intl-interest-modal');
    els.modalCountry = byId('intl-modal-country');
    els.modalLede = byId('intl-modal-lede');
    els.intentButtons = Array.prototype.slice.call(document.querySelectorAll('.intl-intent-btn'));
    els.form = byId('intl-interest-form');
    els.email = byId('intl-interest-email');
    els.error = byId('intl-interest-error');
    els.success = byId('intl-interest-success');
    els.submit = byId('intl-interest-submit');
    els.buildingModal = byId('intl-building-modal');
    els.buildingCountry = byId('intl-building-country');
    els.buildingLede = byId('intl-building-lede');
    els.orgButtons = Array.prototype.slice.call(document.querySelectorAll('.intl-org-btn'));
    els.buildingForm = byId('intl-building-form');
    els.buildingName = byId('intl-building-name');
    els.buildingEmail = byId('intl-building-email');
    els.buildingPhone = byId('intl-building-phone');
    els.buildingGroup = byId('intl-building-group');
    els.buildingWebsite = byId('intl-building-website');
    els.buildingDescription = byId('intl-building-description');
    els.buildingError = byId('intl-building-error');
    els.buildingSuccess = byId('intl-building-success');
    els.buildingSubmit = byId('intl-building-submit');
    els.eventModal = byId('intl-event-modal');
    els.eventForm = byId('intl-event-form');
    els.eventTitleField = byId('intl-event-name-field');
    els.eventStarts = byId('intl-event-starts');
    els.eventTime = byId('intl-event-time');
    els.eventEnds = byId('intl-event-ends');
    els.eventCity = byId('intl-event-city');
    els.eventCountry = byId('intl-event-country');
    els.eventOrganiser = byId('intl-event-organiser');
    els.eventOrganiserWebsite = byId('intl-event-organiser-website');
    els.eventUrl = byId('intl-event-url');
    els.eventImage = byId('intl-event-image');
    els.eventContact = byId('intl-event-contact');
    els.eventEmail = byId('intl-event-email');
    els.eventError = byId('intl-event-error');
    els.eventSuccess = byId('intl-event-success');
    els.eventSubmit = byId('intl-event-submit');
    els.eventsList = byId('intl-events-list');
    els.eventsStatus = byId('intl-events-status');
    els.eventsFilter = byId('intl-events-country-filter');
    els.eventsRailWrap = byId('intl-events-rail-wrap');
    els.eventsRail = byId('intl-events-rail');
    els.eventsRailPrev = byId('intl-events-rail-prev');
    els.eventsRailNext = byId('intl-events-rail-next');
    els.interestModal = byId('intl-interest-modal');
    els.browsePanel = byId('intl-browse-panel');
    els.browseKicker = byId('intl-browse-kicker');
    els.browseTitle = byId('intl-browse-title');
    els.browseLede = byId('intl-browse-lede');
    els.browseActions = byId('intl-browse-actions');
    els.browseStatus = byId('intl-browse-status');
    els.browseList = byId('intl-browse-list');
    els.browseClose = document.querySelector('#intl-browse-panel .intl-browse-close');

    initModal();
    initLearnMorePanel();
    initRegisterInterestCta();
    initEventCtas();
    fillEventCountrySelects();
    initCountryFinder();
    loadHubStats();
    loadInterestDemand();
    loadEvents();

    window.addEventListener('resize', function () {
      var hovered = els.svg && els.svg.querySelector('.intl-country.is-hovered');
      if (hovered) positionCountryPopup(hovered);
    });

    if (els.canvas) {
      els.canvas.addEventListener('click', function (event) {
        if (!isCoarsePointer()) return;
        if (event.target.closest('.intl-country, .intl-country-popup')) {
          return;
        }
        clearHover();
      });
    }

    initMap();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
