/**
 * Confirm featured event checkout after Stripe redirect.
 */
(function () {
  var params = new URLSearchParams(location.search);
  var sessionId = params.get('session_id') || '';
  var id = params.get('id') || '';
  var title = params.get('title') || '';
  var plan = params.get('plan') || '';
  var returnSocial = params.get('return') === 'social';

  var lede = document.getElementById('ep-featured-success-lede');
  var status = document.getElementById('ep-featured-success-status');
  var actions = document.getElementById('ep-featured-success-actions');
  var viewEvents = document.getElementById('ep-featured-view-events');
  var backSocial = document.getElementById('ep-featured-back-social');
  var continueQueue = document.getElementById('ep-featured-continue-queue');

  var FEATURED_UPGRADE_QUEUE_KEY = 'hub_featured_upgrade_queue';

  function readUpgradeQueue() {
    try {
      var raw = sessionStorage.getItem(FEATURED_UPGRADE_QUEUE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.remaining)) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeUpgradeQueue(queue) {
    try {
      if (!queue || !queue.remaining || !queue.remaining.length) {
        sessionStorage.removeItem(FEATURED_UPGRADE_QUEUE_KEY);
        return;
      }
      sessionStorage.setItem(FEATURED_UPGRADE_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      /* ignore private mode */
    }
  }

  function removeCurrentFromQueue() {
    var queue = readUpgradeQueue();
    if (!queue) return null;
    queue.remaining = (queue.remaining || []).filter(function (eventId) {
      return String(eventId) !== String(id);
    });
    writeUpgradeQueue(queue);
    return queue;
  }

  function showReady(featuredUntil, cappedByEvent) {
    if (lede) {
      lede.textContent = title
        ? '"' + title + '" is now a featured listing on The Networker Hub.'
        : 'Your event is now a featured listing on The Networker Hub.';
    }
    if (status) {
      if (window.HubOrganiserFeaturedDuration) {
        status.textContent = window.HubOrganiserFeaturedDuration.successStatusText({
          planId: plan,
          featuredUntil: featuredUntil,
          cappedByEvent: cappedByEvent,
        });
      } else if (featuredUntil) {
        status.textContent =
          'Premium spotlight placement is active. Featured until ' +
          new Date(featuredUntil).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }) +
          '. Thank you!';
      } else {
        status.textContent = 'Premium spotlight placement is now active. Thank you!';
      }
    }
    if (actions) actions.hidden = false;
    if (backSocial) backSocial.hidden = !returnSocial;

    var queue = removeCurrentFromQueue();
    if (continueQueue && queue && queue.remaining.length) {
      continueQueue.hidden = false;
      continueQueue.textContent =
        queue.remaining.length === 1
          ? 'Continue with next event (1 remaining)'
          : 'Continue with next event (' + queue.remaining.length + ' remaining)';
    }
  }

  function showError(msg) {
    if (lede) lede.textContent = 'We received your payment — finishing setup…';
    if (status) status.textContent = msg;
    if (actions) actions.hidden = false;
    if (backSocial) backSocial.hidden = !returnSocial;
  }

  if (viewEvents && id) {
    viewEvents.href = '../events/event?id=' + encodeURIComponent(id);
    viewEvents.textContent = 'View your listing';
  }

  async function startNextQueuedCheckout() {
    var queue = readUpgradeQueue();
    if (!queue || !queue.remaining || !queue.remaining.length) {
      location.href = '/organiser/#social';
      return;
    }
    var nextId = queue.remaining[0];
    if (continueQueue) {
      continueQueue.disabled = true;
      continueQueue.textContent = 'Opening secure checkout…';
    }
    try {
      var res = await fetch('/api/organiser/event-featured-checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: nextId,
          planId: queue.planId || '1month',
          returnTo: 'social',
        }),
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
        data.error === 'featured_slots_full'
          ? data.message ||
            'All featured spotlight places are currently taken. Return to Promote & social to try again later.'
          : data.message || data.error || 'Could not start checkout for the next event.';
      if (status) status.textContent = msg;
      if (continueQueue) {
        continueQueue.disabled = false;
        continueQueue.textContent = 'Try next event again';
      }
    } catch (e) {
      if (status) status.textContent = 'Could not reach checkout. Return to Promote & social to try again.';
      if (continueQueue) {
        continueQueue.disabled = false;
        continueQueue.textContent = 'Try next event again';
      }
    }
  }

  if (continueQueue) {
    continueQueue.addEventListener('click', startNextQueuedCheckout);
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
        var cappedByEvent =
          data.result && typeof data.result.cappedByEvent === 'boolean'
            ? data.result.cappedByEvent
            : null;
        showReady(until, cappedByEvent);
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
