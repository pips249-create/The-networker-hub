/**
 * Confirm business opportunity listing payment after Stripe redirect.
 */
(function () {
  var params = new URLSearchParams(location.search);
  var sessionId = params.get('session_id') || '';
  var id = params.get('id') || '';
  var title = params.get('title') || '';
  var months = params.get('months') || '';

  var lede = document.getElementById('oe-listing-success-lede');
  var status = document.getElementById('oe-listing-success-status');
  var actions = document.getElementById('oe-listing-success-actions');
  var viewDirectory = document.getElementById('oe-listing-view-directory');
  var viewYours = document.getElementById('oe-listing-view-yours');
  var editLink = document.getElementById('oe-listing-edit');

  function listingUrl() {
    if (!id) return '../opportunities/index.html';
    return '../opportunities/opportunity.html?id=' + encodeURIComponent(id);
  }

  function showReady(opportunity) {
    var term = months ? months + ' month' + (months === '1' ? '' : 's') : 'your chosen term';
    if (lede) {
      lede.textContent = title
        ? '"' + title + '" is now live in the business opportunities directory.'
        : 'Your opportunity is now live in the business opportunities directory.';
    }
    if (status) {
      var expiry = opportunity && opportunity.listingExpiresAt;
      status.textContent = expiry
        ? 'Paid for ' + term + '. Listing active until ' + new Date(expiry).toLocaleDateString('en-GB') + '.'
        : 'Thank you — your listing fee has been received.';
    }
    if (actions) actions.hidden = false;
  }

  function showError(msg) {
    if (lede) lede.textContent = 'We received your payment — finishing setup…';
    if (status) status.textContent = msg;
    if (actions) actions.hidden = false;
  }

  if (viewYours && id) viewYours.href = listingUrl();
  if (editLink && id) editLink.href = 'opportunity-edit.html?id=' + encodeURIComponent(id);
  if (viewDirectory) viewDirectory.href = '../opportunities/index.html';

  async function confirmListing() {
    if (!sessionId) {
      showReady();
      return;
    }

    try {
      var res = await fetch('/api/organiser/opportunity-listing-complete', {
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
        showReady(data.opportunity);
        return;
      }

      showError(
        'Your payment went through — your listing may take a minute to appear. Refresh the directory shortly.'
      );
    } catch (e) {
      showError(
        'Your payment went through — your listing may take a minute to appear. Refresh the directory shortly.'
      );
    }
  }

  confirmListing();
})();
