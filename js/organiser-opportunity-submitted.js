/**
 * Post-submit upsell — optional £50/month premium listing via Stripe Checkout.
 */
(function () {
  var params = new URLSearchParams(location.search);
  var id = params.get('id') || '';
  var title = params.get('title') || '';
  var premiumCancelled = params.get('premium') === 'cancelled';

  var lede = document.getElementById('oe-success-lede');
  var viewListing = document.getElementById('oe-view-listing');
  var skipPremium = document.getElementById('oe-skip-premium');
  var addAnother = document.getElementById('oe-add-another');
  var premiumYes = document.getElementById('oe-premium-yes');
  var premiumError = document.getElementById('oe-premium-error');

  function listingUrl() {
    if (!id) return '../opportunities/index.html';
    return '../opportunities/opportunity.html?id=' + encodeURIComponent(id);
  }

  if (lede && title) {
    lede.textContent =
      'Thanks — "' + title + '" is now live in the business opportunities directory.';
  }

  if (skipPremium) skipPremium.href = listingUrl();
  if (viewListing && id) {
    viewListing.href = listingUrl();
    viewListing.textContent = 'View your listing';
  }

  if (premiumCancelled && premiumError) {
    premiumError.hidden = false;
    premiumError.textContent =
      'Checkout was cancelled — your standard listing is still live. You can upgrade any time.';
  }

  async function startPremiumCheckout() {
    if (!id) {
      if (premiumError) {
        premiumError.hidden = false;
        premiumError.textContent = 'Missing listing id — refresh the page or open your listing from the dashboard.';
      }
      return;
    }

    if (premiumYes) {
      premiumYes.disabled = true;
      premiumYes.textContent = 'Opening secure checkout…';
    }
    if (premiumError) premiumError.hidden = true;

    try {
      var res = await fetch('/api/organiser/opportunity-premium-checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: id }),
      });
      var data = {};
      try {
        data = await res.json();
      } catch (e) {
        data = {};
      }

      if (res.ok && data.ok && data.url) {
        location.href = data.url;
        return;
      }

      var msg =
        data.error === 'stripe_not_configured'
          ? 'Premium checkout is not configured yet — your listing is still live.'
          : data.message || data.error || 'Could not start checkout. Your listing is still live.';
      if (premiumError) {
        premiumError.hidden = false;
        premiumError.textContent = msg;
      }
    } catch (e) {
      if (premiumError) {
        premiumError.hidden = false;
        premiumError.textContent = 'Could not reach checkout. Your listing is still live.';
      }
    }

    if (premiumYes) {
      premiumYes.disabled = false;
      premiumYes.textContent = 'Yes — upgrade to premium';
    }
  }

  if (premiumYes) premiumYes.addEventListener('click', startPremiumCheckout);
})();
