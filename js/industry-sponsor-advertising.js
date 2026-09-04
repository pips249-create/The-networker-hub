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

  var root = document.getElementById('industry-sponsor-checkout');
  if (!root) return;

  var industryListEl = document.getElementById('industry-sponsor-industry-list');
  var quoteEl = document.getElementById('industry-sponsor-quote');
  var emailEl = document.getElementById('industry-sponsor-email');
  var submitBtn = document.getElementById('industry-sponsor-submit');
  var statusEl = document.getElementById('industry-sponsor-status');
  var launchNoteEl = document.getElementById('industry-sponsor-launch-note');
  var availableCountCheckoutEl = document.getElementById('industry-sponsor-available-count-checkout');
  var availablePanelEl = document.getElementById('industry-sponsor-available-panel');
  var bookedSummaryEl = document.getElementById('industry-sponsor-booked-summary');
  var bookedSummaryListEl = document.getElementById('industry-sponsor-booked-summary-list');
  var bookedWrapEl = document.getElementById('industry-sponsor-booked-wrap');
  var bookedListEl = document.getElementById('industry-sponsor-booked-list');
  var termOptionsEl = document.getElementById('industry-sponsor-term-options');

  var state = {
    industries: [],
    pricing: null,
    isLaunch: true,
    launchEnds: '2026-12-01T00:00:00.000Z',
  };

  function selectedTerm() {
    if (!termOptionsEl) return 'monthly';
    var checked = termOptionsEl.querySelector('input[name="industry-sponsor-term"]:checked');
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

  function bookedStatusText(industry) {
    if (industry.availableFrom) {
      return '(CLAIMED) — Opens again from ' + formatAvailableFrom(industry.availableFrom) + '.';
    }
    return '(CLAIMED) — Enquire to join the waitlist.';
  }

  function industryIconHtml(slug) {
    var icons = window.HUB_INDUSTRY_ICONS;
    if (!icons || !icons.iconForIndustry) return '';
    var mark = icons.iconForIndustry(slug);
    if (!mark || !mark.chip) return '';
    return (
      '<span class="industry-sponsor-icon" aria-hidden="true"' +
      (mark.label ? ' title="' + esc(mark.label) + '"' : '') +
      '>' +
      mark.chip +
      '</span>'
    );
  }

  function bookedCardHtml(industry) {
    return (
      '<li class="city-partner-booked-item">' +
      '<span class="city-partner-booked-name">' +
      industryIconHtml(industry.slug) +
      '<span class="city-partner-claimed-dot" aria-hidden="true"></span>' +
      '<span class="city-partner-booked-copy">' +
      '<span class="city-partner-booked-heading">' +
      '<strong>' +
      esc(String(industry.name || '').toUpperCase()) +
      ':</strong> ' +
      esc(bookedStatusText(industry)) +
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
    if (!industryListEl) return [];
    return Array.prototype.map
      .call(industryListEl.querySelectorAll('input[type="checkbox"]:checked'), function (input) {
        return input.value;
      })
      .filter(Boolean);
  }

  function updateQuote() {
    var slugs = selectedSlugs();
    if (!quoteEl) return;

    if (!slugs.length) {
      quoteEl.innerHTML =
        '<p class="city-partner-quote-empty">Select one or more available industries to see the price (+ VAT).</p>';
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
      ' × industry (' +
      formatGbp(pricing.singleMonthlyGbp) +
      ' + VAT)' +
      (prepaid ? ' × ' + termMonths + (discountPct ? ' − ' + discountPct + '%' : '') : '') +
      '</p>' +
      '<p class="city-partner-quote-cities">' +
      count +
      ' ' +
      (count === 1 ? 'industry' : 'industries') +
      ' selected' +
      (prepaid ? '' : ' · renews monthly until you cancel') +
      '</p>';

    if (submitBtn) submitBtn.disabled = !slugs.length;
  }

  function renderIndustries(industries) {
    if (!industryListEl) return;
    var sorted = sortByName(industries || []);
    var available = sorted.filter(function (industry) {
      return industry.available;
    });

    if (!sorted.length) {
      industryListEl.innerHTML =
        '<p class="city-partner-empty">No industries are configured yet — check back soon.</p>';
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    if (!available.length) {
      industryListEl.innerHTML =
        '<p class="city-partner-empty">No industries are open for checkout right now. Claimed industries are listed below.</p>';
    } else {
      industryListEl.innerHTML = '';
    }

    industryListEl.innerHTML += available
      .map(function (industry) {
        return (
          '<label class="city-partner-city industry-sponsor-city">' +
          '<input type="checkbox" name="industry-sponsor-industry" value="' +
          esc(industry.slug) +
          '">' +
          industryIconHtml(industry.slug) +
          '<span>' +
          esc(industry.name) +
          '</span>' +
          '</label>'
        );
      })
      .join('');

    industryListEl.querySelectorAll('input[type="checkbox"]').forEach(function (input) {
      input.addEventListener('change', updateQuote);
    });
    updateQuote();
  }

  function formatAvailableCount(count) {
    if (!count) return 'None open';
    return count + ' available';
  }

  function renderAvailableList(industries) {
    var available = sortByName(
      (industries || []).filter(function (industry) {
        return industry.available;
      })
    );
    if (availableCountCheckoutEl) availableCountCheckoutEl.textContent = formatAvailableCount(available.length);
    if (availablePanelEl) {
      availablePanelEl.hidden = !(industries || []).length;
      if (available.length) availablePanelEl.open = true;
    }
  }

  function renderBooked(industries) {
    var booked = sortByName(
      (industries || []).filter(function (industry) {
        return industry.booked;
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
    setStatus('Loading available industries…');
    return fetch('/api/industry-sponsor')
      .then(readJsonResponse)
      .then(function (result) {
        var data = result.data;
        if (!result.ok || !data || !data.ok) {
          throw new Error((data && (data.message || data.error)) || 'Could not load industries');
        }
        state.industries = data.industries || data.cities || [];
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
          var endEl = document.getElementById('industry-sponsor-launch-end');
          var endFootEl = document.getElementById('industry-sponsor-launch-end-foot');
          if (endEl) endEl.textContent = label;
          if (endFootEl) endFootEl.textContent = label;
          launchNoteEl.hidden = false;
        } else if (launchNoteEl) {
          launchNoteEl.hidden = true;
        }

        renderIndustries(state.industries);
        renderAvailableList(state.industries);
        renderBooked(state.industries);
        setStatus('');
      })
      .catch(function (err) {
        setStatus(err.message || 'Could not load available industries', 'error');
      });
  }

  if (termOptionsEl) {
    termOptionsEl.querySelectorAll('input[name="industry-sponsor-term"]').forEach(function (input) {
      input.addEventListener('change', updateQuote);
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', function () {
      var slugs = selectedSlugs();
      var email = emailEl ? String(emailEl.value || '').trim() : '';
      var term = selectedTerm();
      if (!slugs.length) {
        setStatus('Select at least one industry.', 'error');
        return;
      }
      if (!email) {
        setStatus('Enter your work email to continue.', 'error');
        if (emailEl) emailEl.focus();
        return;
      }

      submitBtn.disabled = true;
      setStatus('Redirecting to secure checkout…');

      fetch('/api/industry-sponsor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, industries: slugs, termMonths: term }),
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
    var pkg = document.getElementById('industry-sponsor-package');
    if (pkg && pkg.scrollIntoView) pkg.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function focusPackage() {
    var eventsTab = document.getElementById('ad-tab-opportunities');
    if (eventsTab && !eventsTab.classList.contains('is-active')) {
      eventsTab.click();
      window.setTimeout(scrollToPackage, 180);
      return;
    }
    scrollToPackage();
  }

  var params = new URLSearchParams(window.location.search);
  var returnState = params.get('industry-sponsor');
  if (returnState === 'success') {
    var sessionId = params.get('session_id');
    if (sessionId) {
      setStatus('Confirming your payment…');
      fetch('/api/industry-sponsor?action=verify&session_id=' + encodeURIComponent(sessionId))
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
              'Payment received, but your industry could not be reserved automatically. Email rosie@thenetworkeruk.com with your Stripe receipt and we will activate your industries straight away.',
              'error'
            );
            focusPackage();
            return;
          }
          setStatus(
            'Thanks — payment confirmed. Your industries are reserved and we have emailed next steps. Send logo and link to rosie@thenetworkeruk.com and we will publish once creative is approved.',
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
        'Thanks — payment received. Your industries are reserved. Send logo and link to rosie@thenetworkeruk.com and we will publish once creative is approved.',
        'ok'
      );
      focusPackage();
    }
  } else if (returnState === 'cancelled') {
    setStatus('Checkout cancelled — selected industries are still available if open.', '');
    focusPackage();
  }

  loadAvailability();
})();
