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
    selectedCountry: null,
    mapReady: false,
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
    var iso2 = ISO_NUMERIC_TO_ALPHA2[numericId] || '';
    var live = LIVE_HUBS[numericId] || null;
    return {
      numericId: numericId,
      iso2: live ? live.iso2 : iso2,
      name: live ? live.name : name,
      live: Boolean(live),
      url: live ? live.url : '',
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

  function setHint(text, isLive) {
    if (!els.hint) return;
    els.hint.textContent = text;
    els.hint.classList.toggle('is-live', Boolean(isLive));
  }

  function clearHover() {
    if (!els.svg) return;
    els.svg.querySelectorAll('.intl-country.is-hovered').forEach(function (node) {
      node.classList.remove('is-hovered');
    });
  }

  function handleCountryAction(meta) {
    if (!meta) return;
    if (meta.live && meta.url) {
      window.location.href = meta.url;
      return;
    }
    openInterestModal(meta);
  }

  function openInterestModal(meta) {
    state.selectedCountry = meta;
    state.selectedIntent = 'attend';
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
    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    els.email.focus();
  }

  function closeInterestModal() {
    els.modal.hidden = true;
    document.body.style.overflow = '';
    state.selectedCountry = null;
  }

  function populateMobileSelect() {
    if (!els.select) return;
    var sorted = state.countries.slice().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
    sorted.forEach(function (meta) {
      var option = document.createElement('option');
      option.value = meta.numericId;
      var suffix = meta.live ? ' (live)' : '';
      option.textContent = meta.name + suffix;
      els.select.appendChild(option);
    });
  }

  function bindCountryPath(path, meta) {
    path.setAttribute('data-country-id', meta.numericId);
    path.setAttribute('tabindex', '0');
    path.setAttribute('role', 'button');
    path.setAttribute('aria-label', meta.name + (meta.live ? ' — live' : ' — coming soon'));

    function onEnter() {
      clearHover();
      path.classList.add('is-hovered');
      setHint(meta.live ? meta.name + ' — live' : meta.name, meta.live);
    }

    function onLeave() {
      path.classList.remove('is-hovered');
      setHint('Hover or tap a country on the map', false);
    }

    path.addEventListener('mouseenter', onEnter);
    path.addEventListener('mouseleave', onLeave);
    path.addEventListener('focus', onEnter);
    path.addEventListener('blur', onLeave);
    path.addEventListener('click', function () {
      handleCountryAction(meta);
    });
    path.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleCountryAction(meta);
      }
    });
  }

  function renderMap(world) {
    var projection = window.d3.geoNaturalEarth1().fitSize([960, 500], window.topojson.feature(world, world.objects.countries));
    var pathGen = window.d3.geoPath(projection);
    var features = window.topojson.feature(world, world.objects.countries).features;

    state.countries = features.map(countryMeta);
    populateMobileSelect();

    features.forEach(function (feature) {
      var meta = countryMeta(feature);
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathGen(feature));
      path.classList.add('intl-country');
      path.classList.add(meta.live ? 'intl-country--live' : 'intl-country--soon');
      bindCountryPath(path, meta);
      els.svg.appendChild(path);
    });

    els.loading.hidden = true;
    state.mapReady = true;
  }

  function initModal() {
    els.modal.querySelectorAll('[data-intl-modal-close]').forEach(function (node) {
      node.addEventListener('click', closeInterestModal);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !els.modal.hidden) closeInterestModal();
    });

    els.intentButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.selectedIntent = btn.getAttribute('data-intent') || 'attend';
        els.intentButtons.forEach(function (other) {
          other.classList.toggle('is-selected', other === btn);
        });
      });
    });

    els.form.addEventListener('submit', function (event) {
      event.preventDefault();
      submitInterest();
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
        els.form.hidden = true;
        els.success.hidden = false;
      })
      .catch(function (err) {
        els.error.textContent = err.message || 'Something went wrong. Please try again.';
        els.error.hidden = false;
        els.submit.disabled = false;
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

  function initScrollHero() {
    var journey = byId('intl-journey');
    var hero = byId('intl-hero-float');
    if (!journey || !hero) return;

    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      journey.classList.add('is-map-focused');
      return;
    }

    var ticking = false;

    function update() {
      ticking = false;
      var range = Math.max(journey.offsetHeight - window.innerHeight, 1);
      var progress = Math.min(1, Math.max(0, window.scrollY / (range * 0.72)));
      var fade = 1 - progress;
      hero.style.opacity = String(fade);
      hero.style.transform =
        'translateX(-50%) translateY(' + (-progress * 88) + 'px) scale(' + (1 - progress * 0.06) + ')';
      journey.classList.toggle('is-map-focused', progress > 0.45);
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  function init() {
    els.hint = byId('intl-map-hint');
    els.svg = byId('intl-map-svg');
    els.loading = byId('intl-map-loading');
    els.mobilePicker = byId('intl-mobile-picker');
    els.select = byId('intl-country-select');
    els.modal = byId('intl-interest-modal');
    els.modalCountry = byId('intl-modal-country');
    els.modalLede = byId('intl-modal-lede');
    els.intentButtons = Array.prototype.slice.call(document.querySelectorAll('.intl-intent-btn'));
    els.form = byId('intl-interest-form');
    els.email = byId('intl-interest-email');
    els.error = byId('intl-interest-error');
    els.success = byId('intl-interest-success');
    els.submit = byId('intl-interest-submit');

    initModal();
    initScrollHero();

    if (els.select) {
      els.select.addEventListener('change', function () {
        var id = els.select.value;
        if (!id) return;
        var meta = state.countries.find(function (c) { return c.numericId === id; });
        if (meta) handleCountryAction(meta);
        els.select.value = '';
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
