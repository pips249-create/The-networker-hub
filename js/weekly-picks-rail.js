/**
 * Weekly picks email signup on event detail pages.
 * Email first; account create is a soft next step after subscribe.
 * City/region come from the loaded event (hubWeeklyPicksContext).
 */
(function () {
  var DISMISS_KEY = 'hubWeeklyPicksRailDismissed';
  var DONE_KEY = 'hubWeeklyPicksRailDone';

  function el(id) {
    return document.getElementById(id);
  }

  function regionalContext() {
    var fromEvent = window.hubWeeklyPicksContext || null;
    if (fromEvent && (fromEvent.label || fromEvent.location || fromEvent.slug)) {
      return {
        location: String(fromEvent.location || fromEvent.label || '').trim(),
        slug: String(fromEvent.slug || '').trim(),
        label: String(fromEvent.label || fromEvent.location || 'the UK').trim() || 'the UK',
      };
    }
    var regional = window.hubRegionalLanding || null;
    var location = (regional && regional.location) || '';
    var slug = (regional && regional.slug) || '';
    var label = (regional && regional.name) || location || 'the UK';
    return { location: location, slug: slug, label: label };
  }

  function applyCopy() {
    var ctx = regionalContext();
    var kicker = el('weekly-picks-kicker');
    var headline = el('weekly-picks-headline');
    var place = ctx.label && ctx.label !== 'the UK' ? ctx.label : '';
    if (kicker) {
      kicker.textContent = place
        ? 'Weekly picks · Fridays · ' + place
        : 'Weekly picks · Fridays';
    }
    if (headline) {
      headline.textContent = place
        ? 'The rooms worth being in — in ' + place + '.'
        : 'The rooms worth being in, every Friday morning.';
    }
  }

  function setStatus(text, tone) {
    var status = el('weekly-picks-status');
    if (!status) return;
    status.hidden = !text;
    status.textContent = text || '';
    status.className =
      'weekly-picks-rail-status' +
      (tone === 'ok' ? ' is-ok' : tone === 'error' ? ' is-error' : '');
  }

  function showDone(email) {
    var form = el('weekly-picks-form');
    var done = el('weekly-picks-done');
    var account = el('weekly-picks-account-link');
    if (form) form.hidden = true;
    if (done) done.hidden = false;
    if (account && email) {
      var next = window.location.pathname + (window.location.search || '');
      account.href =
        '/register?email=' +
        encodeURIComponent(email) +
        '&marketing=1&next=' +
        encodeURIComponent(next);
    }
    try {
      window.localStorage.setItem(DONE_KEY, '1');
    } catch (e) {
      /* ignore */
    }
  }

  function isDismissed() {
    try {
      return window.localStorage.getItem(DISMISS_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function hideRail() {
    var rail = el('weekly-picks-rail');
    if (rail) rail.hidden = true;
  }

  function maybeHideForSignedIn() {
    return fetch('/api/auth/session', { credentials: 'include' })
      .then(function (res) {
        return res.json().catch(function () {
          return null;
        });
      })
      .then(function (data) {
        if (!data || !data.user) return;
        if (data.user.emailsEnabled === true) {
          hideRail();
        }
      })
      .catch(function () {
        /* keep rail */
      });
  }

  function onSubmit(e) {
    e.preventDefault();
    var form = el('weekly-picks-form');
    var input = el('weekly-picks-email');
    var btn = el('weekly-picks-submit');
    if (!input || !form) return;
    var email = String(input.value || '').trim();
    if (!email) {
      setStatus('Enter your email.', 'error');
      input.focus();
      return;
    }
    var ctx = regionalContext();
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending…';
    }
    setStatus('Saving…');
    fetch('/api/auth/weekly-picks-signup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        location: ctx.location,
        regionSlug: ctx.slug,
        source: 'event_detail',
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (res) {
        if (!res.ok) {
          setStatus((res.data && res.data.message) || 'Could not subscribe.', 'error');
          return;
        }
        setStatus('');
        showDone(email);
      })
      .catch(function () {
        setStatus('Could not subscribe. Try again.', 'error');
      })
      .finally(function () {
        if (!btn) return;
        btn.disabled = false;
        btn.textContent = 'Subscribe';
      });
  }

  function init() {
    var rail = el('weekly-picks-rail');
    if (!rail) return;

    if (isDismissed()) {
      hideRail();
      return;
    }

    try {
      if (window.localStorage.getItem(DONE_KEY) === '1') {
        showDone('');
      }
    } catch (e) {
      /* ignore */
    }

    applyCopy();
    maybeHideForSignedIn();

    var form = el('weekly-picks-form');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', onSubmit);
    }

    var dismiss = el('weekly-picks-dismiss');
    if (dismiss && !dismiss.dataset.bound) {
      dismiss.dataset.bound = '1';
      dismiss.addEventListener('click', function () {
        try {
          window.localStorage.setItem(DISMISS_KEY, '1');
        } catch (e) {
          /* ignore */
        }
        hideRail();
      });
    }

    document.addEventListener('hub:weekly-picks-context', applyCopy);
    document.addEventListener('hub:regional-landing', applyCopy);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
