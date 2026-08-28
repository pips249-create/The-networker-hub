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

  /** Coming-soon / building domains — map click opens the market preview gate. */
  var MARKET_PREVIEW_URLS = {
    '372': 'https://www.thenetworkerireland.com',
    '840': 'https://www.thenetworkerusa.com',
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
    activeModal: null,
    labelItems: [],
    projection: null,
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

  function isCoarsePointer() {
    return window.matchMedia('(hover: none), (pointer: coarse)').matches;
  }

  function popupActionText(meta) {
    if (meta.live) {
      return isCoarsePointer() ? 'Tap to explore →' : 'Click to explore →';
    }
    if (meta.url) {
      return isCoarsePointer() ? 'Tap to open preview →' : 'Open market preview →';
    }
    if (meta.building) {
      return isCoarsePointer()
        ? 'Tap to tell us about your group →'
        : 'Tell us about your group →';
    }
    if (meta.unavailable) {
      return 'We don\u2019t operate in this region';
    }
    return isCoarsePointer()
      ? 'Tap to register interest →'
      : 'Register your interest →';
  }

  function clearActiveLabels() {
    if (els.labels) {
      els.labels.querySelectorAll('.intl-map-label.is-active').forEach(function (node) {
        node.classList.remove('is-active');
      });
    }
  }

  function hideCountryPopup() {
    if (!els.popup) return;
    els.popup.hidden = true;
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
    if (!els.popup || !els.canvas) return;

    var canvasRect = els.canvas.getBoundingClientRect();
    var popupWidth = els.popup.offsetWidth || 220;
    var popupHeight = els.popup.offsetHeight || 140;
    var centerX;
    var centerY;
    var placeBelow;
    var x;
    var y;

    if (path) {
      var pathRect = path.getBoundingClientRect();
      centerX = pathRect.left + pathRect.width / 2 - canvasRect.left;
      centerY = pathRect.top + pathRect.height / 2 - canvasRect.top;
      placeBelow = centerY - popupHeight - 20 < 8;
      x = Math.max(
        16 + popupWidth / 2,
        Math.min(canvasRect.width - 16 - popupWidth / 2, centerX)
      );
      y = placeBelow
        ? Math.min(canvasRect.height - 8, centerY + pathRect.height / 2 + 8)
        : Math.max(8 + popupHeight, centerY - pathRect.height / 2);
    } else {
      var activeLabel =
        els.labels && els.labels.querySelector('.intl-map-label.is-active');
      if (!activeLabel) return;
      var labelRect = activeLabel.getBoundingClientRect();
      centerX = labelRect.left + labelRect.width / 2 - canvasRect.left;
      centerY = labelRect.bottom - canvasRect.top + 14;
      placeBelow = true;
      x = Math.max(
        16 + popupWidth / 2,
        Math.min(canvasRect.width - 16 - popupWidth / 2, centerX)
      );
      y = Math.min(canvasRect.height - 8, centerY + popupHeight);
    }

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
    clearActiveLabels();
  }

  function selectCountry(path, meta, options) {
    options = options || {};
    clearHover();
    if (path) path.classList.add('is-hovered');
    showCountryPopup(path, meta);
    if (els.labels) {
      els.labels.querySelectorAll('.intl-map-label').forEach(function (node) {
        node.classList.toggle('is-active', node.getAttribute('data-country-id') === meta.numericId);
      });
    }
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
    if (meta.url) {
      window.location.href = meta.url;
      return;
    }
    if (meta.building) {
      openBuildingModal(meta);
      return;
    }
    openInterestModal(meta);
  }

  function closeActiveModal() {
    if (state.activeModal === 'building') closeBuildingModal();
    else if (state.activeModal === 'interest') closeInterestModal();
  }

  function openInterestModal(meta) {
    state.selectedCountry = meta;
    state.selectedIntent = 'attend';
    state.activeModal = 'interest';
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
      button.innerHTML =
        '<span class="intl-country-result-name">' +
        meta.name +
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
          var id = button.getAttribute('data-country-id');
          var meta = state.countries.find(function (country) {
            return country.numericId === id;
          });
          trackIntl('intl_featured_click', {
            country: (meta && meta.iso2) || id || 'unknown',
            status: (meta && meta.status) || 'unknown',
          });
          if (meta) handleCountryAction(meta);
        });
      });
    }
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

  function bindCountryPath(path, meta) {
    path.setAttribute('data-country-id', meta.numericId);
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
      if (els.labels) {
        els.labels.querySelectorAll('.intl-map-label.is-active').forEach(function (node) {
          if (node.getAttribute('data-country-id') === meta.numericId) {
            node.classList.remove('is-active');
          }
        });
      }
    }

    path.addEventListener('mouseenter', onEnter);
    path.addEventListener('mouseleave', onLeave);
    path.addEventListener('focus', function () {
      selectCountry(path, meta, { arm: false });
    });
    path.addEventListener('blur', onLeave);
    path.addEventListener('click', function (event) {
      event.preventDefault();
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

  function viewBoxToCanvasPoint(x, y) {
    if (!els.svg || !els.canvas) return null;
    var svgRect = els.svg.getBoundingClientRect();
    var canvasRect = els.canvas.getBoundingClientRect();
    if (!svgRect.width || !svgRect.height) return null;
    var scale = Math.min(svgRect.width / 960, svgRect.height / 500);
    var offsetX = (svgRect.width - 960 * scale) / 2;
    var offsetY = (svgRect.height - 500 * scale) / 2;
    return {
      x: svgRect.left - canvasRect.left + offsetX + x * scale,
      y: svgRect.top - canvasRect.top + offsetY + y * scale,
    };
  }

  function shortLabelName(meta) {
    if (meta.iso2 === 'GB') return 'UK';
    if (meta.iso2 === 'IE') return 'Ireland';
    if (meta.iso2 === 'US') return 'USA';
    return meta.name;
  }

  function positionMapLabels() {
    if (!state.labelItems.length) return;
    state.labelItems.forEach(function (item) {
      var point = viewBoxToCanvasPoint(item.x, item.y);
      if (!point) return;
      item.el.style.left = point.x + 'px';
      item.el.style.top = point.y + 'px';
    });
  }

  function renderMapLabels(projection, features) {
    if (!els.labels) return;
    els.labels.innerHTML = '';
    state.labelItems = [];

    var spotlight = state.countries.filter(function (meta) {
      return meta.live || meta.building;
    });

    spotlight.forEach(function (meta) {
      var feature = featureByNumericId(features, meta.numericId);
      if (!feature) return;
      var centroid = window.d3.geoCentroid(feature);
      var projected = projection(centroid);
      if (!projected) return;

      // Nudge UK label so it sits above the islands clearly.
      var x = projected[0];
      var y = projected[1];
      if (meta.iso2 === 'GB') {
        x += 8;
        y -= 14;
      } else if (meta.iso2 === 'US') {
        x -= 18;
        y += 8;
      } else if (meta.iso2 === 'AU') {
        y += 6;
      } else if (meta.iso2 === 'CA') {
        y += 10;
      }

      var button = document.createElement('button');
      button.type = 'button';
      button.className =
        'intl-map-label intl-map-label--' + (meta.live ? 'live' : 'building');
      button.setAttribute('data-country-id', meta.numericId);
      button.setAttribute(
        'aria-label',
        meta.name + countryStatusLabel(meta)
      );
      button.innerHTML =
        '<span class="intl-map-label-name">' +
        shortLabelName(meta) +
        '</span>' +
        '<span class="intl-map-label-status">' +
        (meta.live ? 'Live' : 'Building') +
        '</span>';

      function labelPath() {
        return (
          els.svg &&
          els.svg.querySelector(
            '.intl-country[data-country-id="' + meta.numericId + '"]'
          )
        );
      }

      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        onCountryActivate(labelPath(), meta);
      });

      button.addEventListener('mouseenter', function () {
        if (isCoarsePointer()) return;
        selectCountry(labelPath(), meta, { arm: false });
      });

      button.addEventListener('mouseleave', function () {
        if (isCoarsePointer()) return;
        var path = labelPath();
        if (path) path.classList.remove('is-hovered');
        hideCountryPopup();
        button.classList.remove('is-active');
      });

      els.labels.appendChild(button);
      state.labelItems.push({ el: button, x: x, y: y, meta: meta });
    });

    positionMapLabels();
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

  function isNarrowViewport() {
    return window.matchMedia('(max-width: 720px)').matches;
  }

  function buildProjection(world) {
    var land = window.topojson.feature(world, world.objects.countries);
    var projection = window.d3.geoNaturalEarth1().fitSize([960, 500], land);

    // On phones the wide world map letterboxes and looks tiny — zoom in
    // so continents fill more of the screen (edges of ocean crop slightly).
    if (isNarrowViewport()) {
      var scale = projection.scale();
      var translate = projection.translate();
      projection.scale(scale * 1.55).translate([translate[0], translate[1] + 18]);
    }

    return projection;
  }

  function renderMap(world) {
    var projection = buildProjection(world);
    var pathGen = window.d3.geoPath(projection);
    var features = window.topojson.feature(world, world.objects.countries).features;

    state.countries = features.map(countryMeta);
    populateCountryFinder();

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
    renderMapLabels(projection, features);

    els.loading.hidden = true;
    state.mapReady = true;
    if (els.mapWrap) els.mapWrap.classList.add('is-ready');
    pulseLiveCountries();
    pulseBuildingCountries();
  }

  function initModal() {
    document.querySelectorAll('[data-intl-modal-close]').forEach(function (node) {
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
        els.success.hidden = false;
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

    if (!name) {
      els.buildingError.textContent = 'Enter your name.';
      els.buildingError.hidden = false;
      return;
    }
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
    initFooter();
    els.canvas = byId('intl-map-canvas');
    els.mapWrap = byId('intl-map-wrap');
    els.svg = byId('intl-map-svg');
    els.loading = byId('intl-map-loading');
    els.labels = byId('intl-map-labels');
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

    initModal();
    initLearnMorePanel();
    initCountryFinder();
    loadHubStats();

    window.addEventListener('resize', function () {
      positionMapLabels();
      var hovered = els.svg && els.svg.querySelector('.intl-country.is-hovered');
      if (hovered) positionCountryPopup(hovered);
    });

    if (els.canvas) {
      els.canvas.addEventListener('click', function (event) {
        if (!isCoarsePointer()) return;
        if (event.target.closest('.intl-country, .intl-map-label, .intl-country-popup')) {
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
