(function () {
  var VAT_RATE = 0.2;
  var MONTHLY_GBP = 600;

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

  var root = document.getElementById('opportunity-page-partner-checkout');
  if (!root) return;

  var quoteEl = document.getElementById('opportunity-page-partner-quote');
  var emailEl = document.getElementById('opportunity-page-partner-email');
  var submitBtn = document.getElementById('opportunity-page-partner-submit');
  var statusEl = document.getElementById('opportunity-page-partner-status');
  var availableCountEl = document.getElementById('opportunity-page-partner-available-count');
  var bookedSummaryEl = document.getElementById('opportunity-page-partner-booked-summary');
  var bookedSummaryTextEl = document.getElementById('opportunity-page-partner-booked-summary-text');
  var fullNoteEl = document.getElementById('opportunity-page-partner-full-note');
  var termOptionsEl = document.getElementById('opportunity-page-partner-term-options');

  var state = {
    available: 0,
    max: 3,
    taken: 0,
    pricing: null,
  };

  function selectedTerm() {
    if (!termOptionsEl) return 'monthly';
    var checked = termOptionsEl.querySelector('input[name="opportunity-page-partner-term"]:checked');
    return checked ? String(checked.value || 'monthly') : 'monthly';
  }

  function isPrepaidTerm(term) {
    return term === '1' || term === '3' || term === '6' || term === '12' || term === 'yearly';
  }

  function prepaidDiscountPercent(termMonths) {
    if (termMonths === 3) return 5;
    if (termMonths === 6) return 10;
    if (termMonths === 12) return 15;
    return 0;
  }

  function setStatus(message, kind) {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.classList.remove('is-ok', 'is-error');
    if (kind === 'ok') statusEl.classList.add('is-ok');
    if (kind === 'error') statusEl.classList.add('is-error');
  }

  function readJsonResponse(res) {
    return res.json().then(function (data) {
      return { ok: res.ok, status: res.status, data: data };
    });
  }

  function updateAvailabilityUi() {
    if (availableCountEl) {
      availableCountEl.textContent =
        state.available + ' of ' + state.max + ' slot' + (state.max === 1 ? '' : 's') + ' open';
    }
    if (bookedSummaryEl && bookedSummaryTextEl) {
      if (state.taken > 0) {
        bookedSummaryEl.hidden = false;
        bookedSummaryTextEl.textContent =
          state.taken +
          ' of ' +
          state.max +
          ' Page Partner slot' +
          (state.taken === 1 ? '' : 's') +
          ' currently reserved or live.';
      } else {
        bookedSummaryEl.hidden = true;
        bookedSummaryTextEl.textContent = '';
      }
    }
    if (fullNoteEl) {
      fullNoteEl.hidden = state.available > 0;
    }
  }

  function updateQuote() {
    var term = selectedTerm();
    var prepaid = isPrepaidTerm(term);
    var months = prepaid ? parseInt(term === 'yearly' ? '12' : term, 10) : 1;
    var listNet = MONTHLY_GBP * months;
    var discountPct = prepaid ? prepaidDiscountPercent(months) : 0;
    var net = listNet * (1 - discountPct / 100);
    var priced = priceWithVat(net);

    if (!quoteEl) return;
    if (state.available < 1) {
      quoteEl.innerHTML =
        '<p class="city-partner-quote-empty">No Opportunity Page Partner slots are open right now.</p>';
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    var lines = [];
    lines.push(
      '<p class="city-partner-quote-line"><strong>1 Page Partner slot</strong> · ' +
        (prepaid
          ? months + ' month' + (months === 1 ? '' : 's') + ' prepaid'
          : 'monthly') +
        '</p>'
    );
    if (discountPct > 0) {
      lines.push(
        '<p class="city-partner-quote-line city-partner-quote-discount">' +
          discountPct +
          '% prepaid discount applied (was ' +
          formatGbp(listNet) +
          ')</p>'
      );
    }
    lines.push(
      '<p class="city-partner-quote-total"><strong>' +
        formatGbp(priced.net) +
        '</strong> + VAT ' +
        formatGbp(priced.vat) +
        ' = <strong>' +
        formatGbp(priced.gross) +
        '</strong>' +
        (prepaid ? '' : ' / month') +
        '</p>'
    );
    quoteEl.innerHTML = lines.join('');

    var email = emailEl ? String(emailEl.value || '').trim() : '';
    if (submitBtn) {
      submitBtn.disabled = !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
  }

  function loadAvailability() {
    return fetch('/api/opportunity-page-partner')
      .then(readJsonResponse)
      .then(function (result) {
        if (!result.ok || !result.data || !result.data.ok) {
          throw new Error(
            (result.data && (result.data.message || result.data.error)) ||
              'Could not load availability'
          );
        }
        state.available = Number(result.data.available) || 0;
        state.max = Number(result.data.max) || 3;
        state.taken = Number(result.data.taken) || 0;
        state.pricing = result.data.pricing || null;
        if (state.pricing && state.pricing.singleMonthlyGbp) {
          MONTHLY_GBP = Number(state.pricing.singleMonthlyGbp) || MONTHLY_GBP;
        }
        updateAvailabilityUi();
        updateQuote();
      })
      .catch(function (err) {
        setStatus(err.message || 'Could not load slot availability.', 'error');
        if (submitBtn) submitBtn.disabled = true;
      });
  }

  if (termOptionsEl) {
    termOptionsEl.querySelectorAll('input[name="opportunity-page-partner-term"]').forEach(function (input) {
      input.addEventListener('change', updateQuote);
    });
  }
  if (emailEl) {
    emailEl.addEventListener('input', updateQuote);
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', function () {
      var email = emailEl ? String(emailEl.value || '').trim() : '';
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus('Enter a valid work email to continue.', 'error');
        return;
      }
      if (state.available < 1) {
        setStatus('No slots are available right now.', 'error');
        return;
      }

      submitBtn.disabled = true;
      setStatus('Creating secure checkout…');
      fetch('/api/opportunity-page-partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          term: selectedTerm(),
        }),
      })
        .then(readJsonResponse)
        .then(function (result) {
          if (!result.ok || !result.data || !result.data.ok || !result.data.checkoutUrl) {
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
    var pkg = document.getElementById('ad-pkg-opportunities-mini');
    if (pkg && pkg.scrollIntoView) pkg.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function focusPackage() {
    var oppTab = document.getElementById('ad-tab-opportunities');
    if (oppTab && !oppTab.classList.contains('is-active')) {
      oppTab.click();
      window.setTimeout(scrollToPackage, 180);
      return;
    }
    scrollToPackage();
  }

  var params = new URLSearchParams(window.location.search);
  var returnState = params.get('opportunity-page-partner');
  if (returnState === 'success') {
    var sessionId = params.get('session_id');
    if (sessionId) {
      setStatus('Confirming your payment…');
      fetch(
        '/api/opportunity-page-partner?action=verify&session_id=' + encodeURIComponent(sessionId)
      )
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
              'Payment received, but your slot could not be reserved automatically. Email rosie@thenetworkeruk.com with your Stripe receipt and we will activate your Page Partner slot straight away.',
              'error'
            );
            focusPackage();
            return;
          }
          setStatus(
            'Thanks — payment confirmed. Your Page Partner slot is reserved and we have emailed next steps. Send logo and link to rosie@thenetworkeruk.com and we will publish once creative is approved.',
            'ok'
          );
          focusPackage();
          loadAvailability();
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
        'Thanks — payment received. Your Page Partner slot is reserved. Send logo and link to rosie@thenetworkeruk.com and we will publish once creative is approved.',
        'ok'
      );
      focusPackage();
    }
  } else if (returnState === 'cancelled') {
    setStatus('Checkout cancelled — a slot is still available if open.', '');
    focusPackage();
  }

  loadAvailability();
})();
