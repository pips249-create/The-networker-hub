(function () {
  var VAT_RATE = 0.2;

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function formatGbp(amount) {
    var n = Number(amount);
    if (!Number.isFinite(n)) return '£0';
    return '£' + (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2));
  }

  function priceWithVat(netAmount) {
    var net = Number(netAmount);
    if (!Number.isFinite(net)) net = 0;
    var vat = net * VAT_RATE;
    return {
      net: net,
      vat: vat,
      gross: net + vat,
    };
  }

  var root = document.getElementById('city-partner-checkout');
  if (!root) return;

  var cityListEl = document.getElementById('city-partner-city-list');
  var quoteEl = document.getElementById('city-partner-quote');
  var durationEl = document.getElementById('city-partner-duration');
  var submitBtn = document.getElementById('city-partner-submit');
  var statusEl = document.getElementById('city-partner-status');
  var launchNoteEl = document.getElementById('city-partner-launch-note');
  var availableListEl = document.getElementById('city-partner-available-list');

  var state = {
    cities: [],
    pricing: null,
    isLaunch: true,
    launchEnds: '2026-12-01T00:00:00.000Z',
  };

  function setStatus(text, tone) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.className =
      'city-partner-status' +
      (tone === 'error' ? ' city-partner-status--error' : tone === 'ok' ? ' city-partner-status--ok' : '');
  }

  function readJsonResponse(res) {
    return res.text().then(function (text) {
      var data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        if (res.status === 403) {
          throw new Error('Enter the site preview password, then try again.');
        }
        if (res.status === 404) {
          throw new Error('Checkout service is temporarily unavailable — refresh the page in a minute.');
        }
        throw new Error('Checkout service returned an unexpected response (HTTP ' + res.status + ').');
      }
      return { ok: res.ok, data: data };
    });
  }

  function selectedSlugs() {
    if (!cityListEl) return [];
    return Array.prototype.map
      .call(cityListEl.querySelectorAll('input[type="checkbox"]:checked'), function (input) {
        return input.value;
      })
      .filter(Boolean);
  }

  function selectedMonths() {
    var months = durationEl ? Number(durationEl.value) : 0;
    return [1, 3, 6, 12].indexOf(months) !== -1 ? months : 0;
  }

  function updateQuote() {
    var slugs = selectedSlugs();
    var months = selectedMonths();
    if (!quoteEl) return;

    if (!slugs.length) {
      quoteEl.innerHTML =
        '<p class="city-partner-quote-empty">Select one or more available cities to see the monthly price (+ VAT).</p>';
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    var count = slugs.length;
    var bundles = Math.floor(count / 3);
    var singles = count % 3;
    var pricing = state.pricing || { singleMonthlyGbp: 29, bundle3MonthlyGbp: 75 };
    var monthlyNet = bundles * pricing.bundle3MonthlyGbp + singles * pricing.singleMonthlyGbp;
    var priced = priceWithVat(monthlyNet);
    var parts = [];
    if (bundles) parts.push(bundles + ' × 3-city pack (' + formatGbp(pricing.bundle3MonthlyGbp) + ' + VAT)');
    if (singles) parts.push(singles + ' × single city (' + formatGbp(pricing.singleMonthlyGbp) + ' + VAT)');

    quoteEl.innerHTML =
      '<p class="city-partner-quote-total"><strong>' +
      formatGbp(priced.net) +
      '</strong> <span>per month + VAT</span></p>' +
      '<p class="city-partner-quote-vat">VAT (20%): ' +
      formatGbp(priced.vat) +
      ' · <strong>' +
      formatGbp(priced.gross) +
      ' incl. VAT</strong> per month</p>' +
      '<p class="city-partner-quote-breakdown">' +
      esc(parts.join(' + ')) +
      '</p>' +
      '<p class="city-partner-quote-cities">' +
      count +
      ' ' +
      (count === 1 ? 'city' : 'cities') +
      ' selected</p>';

    if (submitBtn) submitBtn.disabled = !months;
  }

  function renderCities(cities) {
    if (!cityListEl) return;
    var available = (cities || []).filter(function (city) {
      return city.available;
    });
    if (!available.length) {
      cityListEl.innerHTML =
        '<p class="city-partner-empty">All city slots are currently live. Email <a href="mailto:rosie@thenetworkerhub.com?subject=City%20Partner%20waitlist">rosie@thenetworkerhub.com</a> to join the waitlist.</p>';
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    cityListEl.innerHTML = available
      .map(function (city) {
        return (
          '<label class="city-partner-city">' +
          '<input type="checkbox" name="city-partner-city" value="' +
          esc(city.slug) +
          '">' +
          '<span>' +
          esc(city.name) +
          '</span>' +
          '</label>'
        );
      })
      .join('');

    cityListEl.querySelectorAll('input[type="checkbox"]').forEach(function (input) {
      input.addEventListener('change', updateQuote);
    });
    updateQuote();
  }

  function renderAvailableList(cities) {
    if (!availableListEl) return;
    var available = (cities || []).filter(function (city) {
      return city.available;
    });
    if (!available.length) {
      availableListEl.textContent = 'No cities available right now — join the waitlist.';
      return;
    }
    availableListEl.textContent = available.map(function (city) {
      return city.name;
    }).join(', ');
  }

  function loadAvailability() {
    setStatus('Loading available cities…');
    return fetch('/api/city-partner')
      .then(readJsonResponse)
      .then(function (result) {
        var data = result.data;
        if (!result.ok || !data || !data.ok) {
          throw new Error(
            (data && (data.message || data.error)) || 'Could not load cities'
          );
        }
        state.cities = data.cities || [];
        state.pricing = data.pricing || null;
        state.isLaunch = data.isLaunch !== false;
        state.launchEnds = data.launchEnds || state.launchEnds;

        if (launchNoteEl && state.isLaunch) {
          var end = new Date(state.launchEnds);
          var label = end.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          });
          launchNoteEl.innerHTML =
            '<strong>Launch offer until ' +
            esc(label) +
            ':</strong> ' +
            esc(state.pricing.singleLabel) +
            '/month + VAT per city or ' +
            esc(state.pricing.bundle3Label) +
            '/month + VAT for any 3 cities. Thereafter ' +
            esc(state.pricing.regularSingleLabel) +
            '/city + VAT and ' +
            esc(state.pricing.regularBundle3Label) +
            '/3-city pack + VAT.';
          launchNoteEl.hidden = false;
        } else if (launchNoteEl) {
          launchNoteEl.hidden = true;
        }

        renderCities(state.cities);
        renderAvailableList(state.cities);
        setStatus('');
      })
      .catch(function (err) {
        setStatus(err.message || 'Could not load available cities', 'error');
      });
  }

  if (durationEl) durationEl.addEventListener('change', updateQuote);

  if (submitBtn) {
    submitBtn.addEventListener('click', function () {
      var slugs = selectedSlugs();
      var months = selectedMonths();
      if (!slugs.length) {
        setStatus('Select at least one city.', 'error');
        return;
      }
      if (!months) {
        setStatus('Choose how many months you would like.', 'error');
        if (durationEl) durationEl.focus();
        return;
      }

      var selected = state.cities.filter(function (city) {
        return slugs.indexOf(city.slug) !== -1;
      });
      var count = slugs.length;
      var bundles = Math.floor(count / 3);
      var singles = count % 3;
      var pricing = state.pricing || { singleMonthlyGbp: 29, bundle3MonthlyGbp: 75 };
      var monthlyNet = bundles * pricing.bundle3MonthlyGbp + singles * pricing.singleMonthlyGbp;
      var priced = priceWithVat(monthlyNet);
      var names = selected.map(function (city) {
        return city.name;
      });
      var subject = 'City Partner application — ' + names.join(', ');
      var body = [
        'Hello Rosie,',
        '',
        'I would like to apply for City Partner placement.',
        '',
        'Selected cities: ' + names.join(', '),
        'Requested duration: ' + months + ' ' + (months === 1 ? 'month' : 'months'),
        'Monthly price (ex VAT): ' + formatGbp(priced.net),
        'VAT (20%): ' + formatGbp(priced.vat),
        'Monthly price (incl. VAT): ' + formatGbp(priced.gross),
        '',
        'Organisation:',
        'Website:',
        'What we would like to promote:',
        '',
        'I understand that applications are reviewed before payment and that the cities are not reserved until approved.',
      ].join('\n');

      setStatus('Opening your email app…');
      window.location.href =
        'mailto:rosie@thenetworkerhub.com?subject=' +
        encodeURIComponent(subject) +
        '&body=' +
        encodeURIComponent(body);
    });
  }

  function scrollToCityPartnerPackage() {
    var pkg = document.getElementById('city-partner-package');
    if (!pkg || !pkg.scrollIntoView) return;
    pkg.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function focusCityPartnerPackage() {
    var eventsTab = document.getElementById('ad-tab-events');
    if (eventsTab && !eventsTab.classList.contains('is-active')) {
      eventsTab.click();
      window.setTimeout(scrollToCityPartnerPackage, 180);
      return;
    }
    scrollToCityPartnerPackage();
  }

  var params = new URLSearchParams(window.location.search);
  var returnState = params.get('city-partner');
  if (returnState === 'success') {
    setStatus(
      'Thanks — your City Partner subscription is processing. We will publish your logo and CTA once creative is confirmed.',
      'ok'
    );
    focusCityPartnerPackage();
  } else if (returnState === 'cancelled') {
    setStatus('Checkout cancelled — your cities are still available.', '');
    focusCityPartnerPackage();
  }

  loadAvailability();
})();
