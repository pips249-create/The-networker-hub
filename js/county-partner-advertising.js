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
    return { net: net, vat: vat, gross: net + vat };
  }

  var root = document.getElementById('county-partner-checkout');
  if (!root) return;

  var countyListEl = document.getElementById('county-partner-county-list');
  var quoteEl = document.getElementById('county-partner-quote');
  var emailEl = document.getElementById('county-partner-email');
  var submitBtn = document.getElementById('county-partner-submit');
  var statusEl = document.getElementById('county-partner-status');
  var launchNoteEl = document.getElementById('county-partner-launch-note');
  var availableCountCheckoutEl = document.getElementById('county-partner-available-count-checkout');
  var availablePanelEl = document.getElementById('county-partner-available-panel');
  var bookedSummaryEl = document.getElementById('county-partner-booked-summary');
  var bookedSummaryListEl = document.getElementById('county-partner-booked-summary-list');
  var bookedWrapEl = document.getElementById('county-partner-booked-wrap');
  var bookedListEl = document.getElementById('county-partner-booked-list');
  var termOptionsEl = document.getElementById('county-partner-term-options');

  var state = {
    counties: [],
    pricing: null,
    isLaunch: true,
    launchEnds: '2026-12-01T00:00:00.000Z',
  };

  function selectedTerm() {
    if (!termOptionsEl) return 'monthly';
    var checked = termOptionsEl.querySelector('input[name="county-partner-term"]:checked');
    return checked ? String(checked.value || 'monthly') : 'monthly';
  }

  function isPrepaidTerm(term) {
    return term === '6' || term === '12' || term === 'yearly';
  }

  function prepaidDiscountPercent(termMonths) {
    if (termMonths === 6) return 10;
    if (termMonths === 12) return 15;
    return 0;
  }

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

  function sortByName(items) {
    return (items || []).slice().sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''), 'en-GB', {
        sensitivity: 'base',
      });
    });
  }

  function bookedStatusText(county) {
    if (county.availableFrom) {
      return '(CLAIMED) — Opens again from ' + formatAvailableFrom(county.availableFrom) + '.';
    }
    return '(CLAIMED) — Enquire to join the waitlist.';
  }

  function bookedCardHtml(county) {
    return (
      '<li class="city-partner-booked-item">' +
      '<span class="city-partner-booked-name">' +
      '<span class="city-partner-claimed-dot" aria-hidden="true"></span>' +
      '<span class="city-partner-booked-copy">' +
      '<span class="city-partner-booked-heading">' +
      '<strong>' +
      esc(String(county.name || '').toUpperCase()) +
      ':</strong> ' +
      esc(bookedStatusText(county)) +
      '</span></span></span></li>'
    );
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
    if (!countyListEl) return [];
    return Array.prototype.map
      .call(countyListEl.querySelectorAll('input[type="checkbox"]:checked'), function (input) {
        return input.value;
      })
      .filter(Boolean);
  }

  function updateQuote() {
    var slugs = selectedSlugs();
    if (!quoteEl) return;

    if (!slugs.length) {
      quoteEl.innerHTML =
        '<p class="city-partner-quote-empty">Select one or more available counties to see the price (+ VAT).</p>';
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    var count = slugs.length;
    var pricing = state.pricing || { singleMonthlyGbp: 49 };
    var monthlyNet = count * pricing.singleMonthlyGbp;
    var term = selectedTerm();
    var prepaid = isPrepaidTerm(term);
    var termMonths = prepaid ? (term === 'yearly' ? 12 : parseInt(term, 10)) : 1;
    var listNet = monthlyNet * termMonths;
    var discountPct = prepaid ? prepaidDiscountPercent(termMonths) : 0;
    var discountNet = Math.round(listNet * discountPct) / 100;
    var billedNet = Math.round((listNet - discountNet) * 100) / 100;
    var priced = priceWithVat(billedNet);
    var periodLabel = prepaid
      ? termMonths === 12
        ? 'for 1 year (prepaid)'
        : 'for ' + termMonths + ' months (prepaid)'
      : 'per month';
    var totalSuffix = prepaid ? ' total' : ' per month';

    quoteEl.innerHTML =
      '<p class="city-partner-quote-total"><strong>' +
      formatGbp(priced.net) +
      '</strong> <span>' +
      periodLabel +
      ' + VAT</span></p>' +
      (discountPct
        ? '<p class="city-partner-quote-save">Save <strong>' +
          formatGbp(discountNet) +
          '</strong> (' +
          discountPct +
          '%) · was ' +
          formatGbp(listNet) +
          ' + VAT</p>'
        : '') +
      '<p class="city-partner-quote-vat">VAT (20%): ' +
      formatGbp(priced.vat) +
      ' · <strong>' +
      formatGbp(priced.gross) +
      ' incl. VAT</strong>' +
      totalSuffix +
      '</p>' +
      '<p class="city-partner-quote-breakdown">' +
      count +
      ' × county (' +
      formatGbp(pricing.singleMonthlyGbp) +
      ' + VAT)' +
      (prepaid ? ' × ' + termMonths + (discountPct ? ' − ' + discountPct + '%' : '') : '') +
      '</p>' +
      '<p class="city-partner-quote-cities">' +
      count +
      ' ' +
      (count === 1 ? 'county' : 'counties') +
      ' selected' +
      (prepaid ? '' : ' · renews monthly until you cancel') +
      '</p>';

    if (submitBtn) submitBtn.disabled = !slugs.length;
  }

  function renderCounties(counties) {
    if (!countyListEl) return;
    var sorted = sortByName(counties || []);
    var available = sorted.filter(function (county) {
      return county.available;
    });

    if (!sorted.length) {
      countyListEl.innerHTML =
        '<p class="city-partner-empty">No counties are configured yet — check back soon.</p>';
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    if (!available.length) {
      countyListEl.innerHTML =
        '<p class="city-partner-empty">No counties are open for checkout right now. Claimed counties are listed below.</p>';
    } else {
      countyListEl.innerHTML = '';
    }

    countyListEl.innerHTML += available
      .map(function (county) {
        return (
          '<label class="city-partner-city">' +
          '<input type="checkbox" name="county-partner-county" value="' +
          esc(county.slug) +
          '">' +
          '<span>' +
          esc(county.name) +
          '</span>' +
          '</label>'
        );
      })
      .join('');

    countyListEl.querySelectorAll('input[type="checkbox"]').forEach(function (input) {
      input.addEventListener('change', updateQuote);
    });
    updateQuote();
  }

  function formatAvailableCount(count) {
    if (!count) return 'None open';
    return count + ' available';
  }

  function renderAvailableList(counties) {
    var available = sortByName(
      (counties || []).filter(function (county) {
        return county.available;
      })
    );
    if (availableCountCheckoutEl) availableCountCheckoutEl.textContent = formatAvailableCount(available.length);
    if (availablePanelEl) {
      availablePanelEl.hidden = !(counties || []).length;
      if (available.length) availablePanelEl.open = true;
    }
  }

  function renderBooked(counties) {
    var booked = sortByName(
      (counties || []).filter(function (county) {
        return county.booked;
      })
    );
    var hasBooked = booked.length > 0;
    if (bookedSummaryEl) bookedSummaryEl.hidden = !hasBooked;
    if (bookedWrapEl) bookedWrapEl.hidden = !hasBooked;
    if (!hasBooked) return;
    if (bookedSummaryListEl) bookedSummaryListEl.innerHTML = booked.map(bookedCardHtml).join('');
    if (bookedListEl) bookedListEl.innerHTML = booked.map(bookedCardHtml).join('');
  }

  function loadAvailability() {
    setStatus('Loading available counties…');
    return fetch('/api/county-partner')
      .then(readJsonResponse)
      .then(function (result) {
        var data = result.data;
        if (!result.ok || !data || !data.ok) {
          throw new Error((data && (data.message || data.error)) || 'Could not load counties');
        }
        state.counties = data.counties || data.cities || [];
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
          var endEl = document.getElementById('county-partner-launch-end');
          var endFootEl = document.getElementById('county-partner-launch-end-foot');
          if (endEl) endEl.textContent = label;
          if (endFootEl) endFootEl.textContent = label;
          launchNoteEl.hidden = false;
        } else if (launchNoteEl) {
          launchNoteEl.hidden = true;
        }

        renderCounties(state.counties);
        renderAvailableList(state.counties);
        renderBooked(state.counties);
        setStatus('');
      })
      .catch(function (err) {
        setStatus(err.message || 'Could not load available counties', 'error');
      });
  }

  if (termOptionsEl) {
    termOptionsEl.querySelectorAll('input[name="county-partner-term"]').forEach(function (input) {
      input.addEventListener('change', updateQuote);
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', function () {
      var slugs = selectedSlugs();
      var email = emailEl ? String(emailEl.value || '').trim() : '';
      var term = selectedTerm();
      if (!slugs.length) {
        setStatus('Select at least one county.', 'error');
        return;
      }
      if (!email) {
        setStatus('Enter your work email to continue.', 'error');
        if (emailEl) emailEl.focus();
        return;
      }

      submitBtn.disabled = true;
      setStatus('Redirecting to secure checkout…');

      fetch('/api/county-partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, counties: slugs, termMonths: term }),
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

  function scrollToPackage() {
    var pkg = document.getElementById('county-partner-package');
    if (pkg && pkg.scrollIntoView) pkg.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function focusPackage() {
    var eventsTab = document.getElementById('ad-tab-events');
    if (eventsTab && !eventsTab.classList.contains('is-active')) {
      eventsTab.click();
      window.setTimeout(scrollToPackage, 180);
      return;
    }
    scrollToPackage();
  }

  var params = new URLSearchParams(window.location.search);
  var returnState = params.get('county-partner');
  if (returnState === 'success') {
    var sessionId = params.get('session_id');
    if (sessionId) {
      setStatus('Confirming your payment…');
      fetch('/api/county-partner?action=verify&session_id=' + encodeURIComponent(sessionId))
        .then(readJsonResponse)
        .then(function (result) {
          if (!result.ok || !result.data || !result.data.verified) {
            throw new Error(
              (result.data && (result.data.message || result.data.error)) ||
                'Payment could not be verified'
            );
          }
          if (result.data.finalized === false) {
            setStatus(
              'Payment received, but your county could not be reserved automatically. Email rosie@thenetworkeruk.com with your Stripe receipt and we will activate your counties straight away.',
              'error'
            );
            focusPackage();
            return;
          }
          setStatus(
            'Thanks — payment confirmed. Your counties are reserved and we have emailed next steps. Send logo and link to rosie@thenetworkeruk.com and we will publish once creative is approved.',
            'ok'
          );
          focusPackage();
        })
        .catch(function (err) {
          setStatus(
            err.message ||
              'Payment received — if this message persists, email rosie@thenetworkeruk.com with your checkout receipt.',
            'error'
          );
          focusPackage();
        });
    } else {
      setStatus(
        'Thanks — payment received. Your counties are reserved. Send logo and link to rosie@thenetworkeruk.com and we will publish once creative is approved.',
        'ok'
      );
      focusPackage();
    }
  } else if (returnState === 'cancelled') {
    setStatus('Checkout cancelled — selected counties are still available if open.', '');
    focusPackage();
  }

  loadAvailability();
})();
