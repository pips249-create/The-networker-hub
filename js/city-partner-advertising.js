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
  var emailEl = document.getElementById('city-partner-email');
  var submitBtn = document.getElementById('city-partner-submit');
  var statusEl = document.getElementById('city-partner-status');
  var launchNoteEl = document.getElementById('city-partner-launch-note');
  var availableCountCheckoutEl = document.getElementById('city-partner-available-count-checkout');
  var availablePanelEl = document.getElementById('city-partner-available-panel');
  var bookedSummaryEl = document.getElementById('city-partner-booked-summary');
  var bookedSummaryListEl = document.getElementById('city-partner-booked-summary-list');
  var bookedWrapEl = document.getElementById('city-partner-booked-wrap');
  var bookedListEl = document.getElementById('city-partner-booked-list');

  var state = {
    cities: [],
    pricing: null,
    isLaunch: true,
    launchEnds: '2026-12-01T00:00:00.000Z',
    waitlist: {},
  };

  function formatAvailableFrom(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  function sortCitiesByName(cities) {
    return (cities || []).slice().sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''), 'en-GB', {
        sensitivity: 'base',
      });
    });
  }

  function bookedCitySummaryLabel(city) {
    var name = String(city.name || '').toUpperCase();
    var status = city.availableFrom
      ? '(EXCLUSIVELY CLAIMED) — Waitlist open for re-entry from ' +
        esc(formatAvailableFrom(city.availableFrom)) +
        '.'
      : '(EXCLUSIVELY CLAIMED) — Waitlist open for re-entry.';
    return (
      '<span class="city-partner-claimed-dot" aria-hidden="true"></span>' +
      '<span class="city-partner-exclusivity-text">' +
      '<strong class="city-partner-exclusivity-city">' +
      esc(name) +
      ':</strong> ' +
      status +
      '</span>'
    );
  }

  function bookedCityStatusText(city) {
    if (city.availableFrom) {
      return (
        '(EXCLUSIVELY CLAIMED) — Waitlist open for re-entry from ' +
        formatAvailableFrom(city.availableFrom) +
        '.'
      );
    }
    if (city.live) {
      return '(EXCLUSIVELY CLAIMED) — Waitlist open for re-entry.';
    }
    return '(EXCLUSIVELY CLAIMED) — Waitlist open for re-entry.';
  }

  function cityAvailabilitySuffix(city) {
    if (city.available) return '';
    if (city.availableFrom) return ' (WAITLIST ONLY)';
    return ' (CLAIMED)';
  }

  function isOnWaitlist(slug) {
    return Boolean(state.waitlist && state.waitlist[slug]);
  }

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

  function updateQuote() {
    var slugs = selectedSlugs();
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

    if (submitBtn) submitBtn.disabled = !slugs.length;
  }

  function renderCities(cities) {
    if (!cityListEl) return;
    var sorted = sortCitiesByName(cities || []);
    var available = sorted.filter(function (city) {
      return city.available;
    });

    if (!sorted.length) {
      cityListEl.innerHTML =
        '<p class="city-partner-empty">No cities are configured yet — check back soon.</p>';
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    if (!available.length) {
      cityListEl.innerHTML =
        '<p class="city-partner-empty">No cities are open for checkout right now. Claimed cities are listed below — join the waitlist when a slot is held.</p>';
    } else {
      cityListEl.innerHTML = '';
    }

    cityListEl.innerHTML +=
      sorted
        .map(function (city) {
          if (city.available) {
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
          }
          return (
            '<label class="city-partner-city city-partner-city--unavailable">' +
            '<input type="checkbox" disabled aria-disabled="true">' +
            '<span>' +
            esc(city.name) +
            '<em class="city-partner-city-status">' +
            esc(cityAvailabilitySuffix(city)) +
            '</em></span>' +
            '</label>'
          );
        })
        .join('');

    cityListEl.querySelectorAll('input[type="checkbox"]:not([disabled])').forEach(function (input) {
      input.addEventListener('change', updateQuote);
    });
    updateQuote();
  }

  function formatAvailableCount(count) {
    if (!count) return 'None open';
    return count + ' available';
  }

  function renderAvailableList(cities) {
    var available = sortCitiesByName(
      (cities || []).filter(function (city) {
        return city.available;
      })
    );
    var countLabel = formatAvailableCount(available.length);

    if (availableCountCheckoutEl) availableCountCheckoutEl.textContent = countLabel;
    if (availablePanelEl) {
      availablePanelEl.hidden = !(cities || []).length;
      if (available.length) availablePanelEl.open = true;
    }
  }

  function renderBookedCities(cities) {
    var booked = sortCitiesByName(
      (cities || []).filter(function (city) {
        return city.booked;
      })
    );
    var hasBooked = booked.length > 0;

    if (bookedSummaryEl) bookedSummaryEl.hidden = !hasBooked;
    if (bookedWrapEl) bookedWrapEl.hidden = !hasBooked;

    if (!hasBooked) return;

    if (bookedSummaryListEl) {
      bookedSummaryListEl.innerHTML = booked
        .map(function (city) {
          return '<li class="city-partner-exclusivity-item">' + bookedCitySummaryLabel(city) + '</li>';
        })
        .join('');
    }

    if (bookedListEl) {
      bookedListEl.innerHTML = booked
        .map(function (city) {
          var onWaitlist = isOnWaitlist(city.slug);
          return (
            '<li class="city-partner-booked-item">' +
            '<span class="city-partner-booked-name">' +
            '<span class="city-partner-claimed-dot" aria-hidden="true"></span>' +
            '<span class="city-partner-booked-copy">' +
            '<strong>' +
            esc(String(city.name || '').toUpperCase()) +
            ':</strong> ' +
            esc(bookedCityStatusText(city)) +
            '</span>' +
            '</span>' +
            '<button type="button" class="city-partner-booked-waitlist' +
            (onWaitlist ? ' city-partner-booked-waitlist--joined' : '') +
            '" data-city-waitlist="' +
            esc(city.slug) +
            '"' +
            (onWaitlist ? ' disabled' : '') +
            '>' +
            (onWaitlist ? 'On waitlist ✓' : 'Join waitlist') +
            '</button>' +
            '</li>'
          );
        })
        .join('');

      bookedListEl.querySelectorAll('[data-city-waitlist]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          joinWaitlistForCity(btn.getAttribute('data-city-waitlist'), btn);
        });
      });
    }
  }

  function applyWaitlistStatus(onWaitlist) {
    state.waitlist = {};
    (onWaitlist || []).forEach(function (slug) {
      state.waitlist[slug] = true;
    });
    renderBookedCities(state.cities);
  }

  function refreshWaitlistStatus() {
    var email = emailEl ? String(emailEl.value || '').trim().toLowerCase() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      applyWaitlistStatus([]);
      return Promise.resolve();
    }

    return fetch(
      '/api/city-partner?waitlistEmail=' + encodeURIComponent(email)
    )
      .then(readJsonResponse)
      .then(function (result) {
        var data = result.data;
        if (!result.ok || !data || !data.waitlist) return;
        applyWaitlistStatus(data.waitlist.onWaitlist || []);
      })
      .catch(function () {
        applyWaitlistStatus([]);
      });
  }

  function joinWaitlistForCity(slug, btn) {
    var email = emailEl ? String(emailEl.value || '').trim() : '';
    if (!email) {
      setStatus('Enter your work email above to join the waitlist.', 'error');
      if (emailEl) emailEl.focus();
      return;
    }

    if (btn) btn.disabled = true;
    setStatus('Adding you to the waitlist…');

    fetch('/api/city-partner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'waitlist', email: email, cities: [slug] }),
    })
      .then(readJsonResponse)
      .then(function (result) {
        if (!result.ok || !result.data || result.data.ok === false) {
          throw new Error(
            (result.data && (result.data.message || result.data.error)) ||
              'Could not join the waitlist'
          );
        }
        state.waitlist[slug] = true;
        renderBookedCities(state.cities);
        var city = state.cities.find(function (item) {
          return item.slug === slug;
        });
        setStatus(
          'You’re on the waitlist — we’ll email you when ' +
            (city ? city.name : slug) +
            ' opens.',
          'ok'
        );
      })
      .catch(function (err) {
        if (btn) btn.disabled = false;
        setStatus(err.message || 'Could not join the waitlist', 'error');
      });
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
          var endEl = document.getElementById('city-partner-launch-end');
          var endFootEl = document.getElementById('city-partner-launch-end-foot');
          if (endEl) endEl.textContent = label;
          if (endFootEl) endFootEl.textContent = label;
          launchNoteEl.hidden = false;
        } else if (launchNoteEl) {
          launchNoteEl.hidden = true;
        }

        renderCities(state.cities);
        renderAvailableList(state.cities);
        renderBookedCities(state.cities);
        refreshWaitlistStatus().finally(function () {
          setStatus('');
        });
      })
      .catch(function (err) {
        setStatus(err.message || 'Could not load available cities', 'error');
      });
  }

  if (emailEl) {
    emailEl.addEventListener('change', refreshWaitlistStatus);
    emailEl.addEventListener('blur', refreshWaitlistStatus);
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', function () {
      var slugs = selectedSlugs();
      var email = emailEl ? String(emailEl.value || '').trim() : '';
      if (!slugs.length) {
        setStatus('Select at least one city.', 'error');
        return;
      }
      if (!email) {
        setStatus('Enter your work email to continue.', 'error');
        if (emailEl) emailEl.focus();
        return;
      }

      submitBtn.disabled = true;
      setStatus('Redirecting to secure checkout…');

      fetch('/api/city-partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, cities: slugs }),
      })
        .then(readJsonResponse)
        .then(function (result) {
          if (!result.ok || !result.data || !result.data.checkoutUrl) {
            throw new Error(
              (result.data && (result.data.message || result.data.error)) ||
                'Checkout could not be started'
            );
          }
          window.location.href = result.data.checkoutUrl;
        })
        .catch(function (err) {
          submitBtn.disabled = false;
          updateQuote();
          setStatus(err.message || 'Checkout failed — try again in a moment.', 'error');
        });
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
    var sessionId = params.get('session_id');
    if (sessionId) {
      setStatus('Confirming your payment…');
      fetch(
        '/api/city-partner?action=verify&session_id=' + encodeURIComponent(sessionId)
      )
        .then(readJsonResponse)
        .then(function (result) {
          if (!result.ok || !result.data || !result.data.verified) {
            throw new Error(
              (result.data && (result.data.message || result.data.error)) ||
                'Payment could not be verified'
            );
          }
          setStatus(
            'Thanks — payment confirmed. Your cities are reserved and we have emailed next steps. Send logo and link to rosie@thenetworkerhub.com and we will publish once creative is approved.',
            'ok'
          );
          focusCityPartnerPackage();
        })
        .catch(function (err) {
          setStatus(
            err.message ||
              'Payment received — if this message persists, email rosie@thenetworkerhub.com with your checkout receipt.',
            'error'
          );
          focusCityPartnerPackage();
        });
    } else {
      setStatus(
        'Thanks — payment received. Your cities are reserved. Send logo and link to rosie@thenetworkerhub.com and we will publish your placement once creative is approved.',
        'ok'
      );
      focusCityPartnerPackage();
    }
  } else if (returnState === 'cancelled') {
    setStatus('Checkout cancelled — selected cities are still available if open.', '');
    focusCityPartnerPackage();
  }

  loadAvailability();
})();
