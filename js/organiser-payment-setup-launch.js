/**
 * Top-level Stripe Connect launcher.
 * Opens as a real browser tab, then redirects to Stripe (never inside an iframe).
 */
(function () {
  var statusEl = document.getElementById('payment-setup-status');
  var hintEl = document.getElementById('payment-setup-hint');
  var errorEl = document.getElementById('payment-setup-error');
  var params = new URLSearchParams(window.location.search);
  var groupId = String(params.get('groupId') || '').trim();
  var returnPath = String(params.get('returnPath') || '/organiser/index.html#events-revenue').trim();

  function showError(message) {
    if (statusEl) statusEl.textContent = 'We could not open Stripe yet.';
    if (hintEl) hintEl.hidden = true;
    if (!errorEl) {
      alert(message);
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function appendStripeReturnFlag(path) {
    var base = String(path || '/organiser/index.html#events-revenue');
    if (base.indexOf('stripe_connect=') >= 0) return base;
    var hash = '';
    var hashIdx = base.indexOf('#');
    if (hashIdx >= 0) {
      hash = base.slice(hashIdx);
      base = base.slice(0, hashIdx);
    }
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'stripe_connect=return' + hash;
  }

  if (!groupId) {
    showError('Missing organiser page. Close this tab and try Add bank details again.');
    return;
  }

  if (statusEl) {
    statusEl.textContent = 'Connecting to Stripe…';
  }

  fetch('/api/organiser/stripe-connect', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      groupId: groupId,
      returnPath: appendStripeReturnFlag(returnPath),
    }),
  })
    .then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, status: res.status, data: data || {} };
      });
    })
    .then(function (result) {
      if (!result.ok || !result.data.url) {
        var detail =
          result.data.message ||
          (result.data.error === 'forbidden'
            ? 'You can only add bank details for organiser pages linked to your account.'
            : result.data.error) ||
          'Could not start bank details setup. Try again in a moment.';
        showError(detail);
        return;
      }
      if (statusEl) statusEl.textContent = 'Redirecting to Stripe…';
      if (hintEl) {
        hintEl.textContent =
          'Do not refresh the Stripe page. If it looks blank, close this tab and click Add bank details again — each link works once.';
      }
      window.location.assign(result.data.url);
    })
    .catch(function () {
      showError('Could not reach the server. Check your connection and try again.');
    });
})();
