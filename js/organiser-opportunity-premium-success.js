/**
 * Confirm premium opportunity checkout after Stripe redirect.
 */
(function () {
  var params = new URLSearchParams(location.search);
  var sessionId = params.get('session_id') || '';
  var id = params.get('id') || '';
  var title = params.get('title') || '';

  var lede = document.getElementById('oe-premium-success-lede');
  var status = document.getElementById('oe-premium-success-status');
  var actions = document.getElementById('oe-premium-success-actions');
  var viewListing = document.getElementById('oe-premium-view-listing');
  var viewYours = document.getElementById('oe-premium-view-yours');

  function showReady() {
    if (lede) {
      lede.textContent = title
        ? '"' + title + '" is now a premium listing on The Networker UK.'
        : 'Your opportunity is now a premium listing on The Networker UK.';
    }
    if (status) status.textContent = 'Featured placement is active. Thank you for subscribing.';
    if (actions) actions.hidden = false;
  }

  function showError(msg) {
    if (lede) lede.textContent = 'We received your payment — finishing setup…';
    if (status) status.textContent = msg;
    if (actions) actions.hidden = false;
  }

  if (viewYours && id) {
    viewYours.href = '/opportunities/' + encodeURIComponent(id);
  }

  async function confirmPremium() {
    if (!sessionId) {
      showReady();
      return;
    }

    try {
      var res = await fetch('/api/organiser/opportunity-premium-complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId }),
      });
      var data = {};
      try {
        data = await res.json();
      } catch (e) {
        data = {};
      }

      if (res.ok && data.ok) {
        showReady();
        return;
      }

      showError(
        'Your payment went through — premium placement may take a minute to appear. Refresh the directory shortly.'
      );
    } catch (e) {
      showError(
        'Your payment went through — premium placement may take a minute to appear. Refresh the directory shortly.'
      );
    }
  }

  confirmPremium();
})();
