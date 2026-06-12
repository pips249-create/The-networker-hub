/**
 * Confirm featured event checkout after Stripe redirect.
 */
(function () {
  var params = new URLSearchParams(location.search);
  var sessionId = params.get('session_id') || '';
  var id = params.get('id') || '';
  var title = params.get('title') || '';
  var plan = params.get('plan') || '';

  var lede = document.getElementById('ep-featured-success-lede');
  var status = document.getElementById('ep-featured-success-status');
  var actions = document.getElementById('ep-featured-success-actions');
  var viewEvents = document.getElementById('ep-featured-view-events');

  var planLabels = {
    '1week': '1 week',
    '1month': '1 month',
    '4weeks': '1 month',
    '2months': '2 months',
  };

  function showReady(featuredUntil) {
    var planLabel = planLabels[plan] || 'your chosen period';
    if (lede) {
      lede.textContent = title
        ? '"' + title + '" is now a featured listing on The Networker Hub.'
        : 'Your event is now a featured listing on The Networker Hub.';
    }
    var expiryNote = featuredUntil
      ? ' Featured until ' +
        new Date(featuredUntil).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }) +
        '.'
      : '';
    if (status) {
      status.textContent =
        'Premium spotlight placement is active for ' + planLabel + '.' + expiryNote + ' Thank you!';
    }
    if (actions) actions.hidden = false;
  }

  function showError(msg) {
    if (lede) lede.textContent = 'We received your payment — finishing setup…';
    if (status) status.textContent = msg;
    if (actions) actions.hidden = false;
  }

  if (viewEvents && id) {
    viewEvents.href = '../events/event.html?id=' + encodeURIComponent(id);
    viewEvents.textContent = 'View your listing';
  }

  async function confirmFeatured() {
    if (!sessionId) {
      showReady();
      return;
    }

    try {
      var res = await fetch('/api/organiser/event-featured-complete', {
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
        var until =
          (data.result && data.result.featuredUntil) ||
          (data.event && data.event.featuredUntil) ||
          null;
        showReady(until);
        return;
      }

      showError(
        data.message ||
          'Payment received — featured placement may take a moment to appear. Refresh the events page shortly.'
      );
    } catch (e) {
      showError(
        'Payment received — featured placement may take a moment to appear. Refresh the events page shortly.'
      );
    }
  }

  confirmFeatured();
})();
