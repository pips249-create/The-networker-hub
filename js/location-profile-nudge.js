/**
 * Soft prompt for signed-in attendees without a profile location.
 * Saves city/postcode to /api/auth/profile — powers Near Me + local emails.
 */
(function (global) {
  var DISMISS_KEY = 'hub_location_nudge_dismissed_at';
  var DISMISS_DAYS = 30;
  var rootAttr = 'data-location-nudge-root';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function daysSince(iso) {
    var t = Date.parse(String(iso || ''));
    if (!Number.isFinite(t)) return Infinity;
    return (Date.now() - t) / (1000 * 60 * 60 * 24);
  }

  function isDismissed() {
    try {
      return daysSince(localStorage.getItem(DISMISS_KEY)) < DISMISS_DAYS;
    } catch (e) {
      return false;
    }
  }

  function markDismissed() {
    try {
      localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    } catch (e) {
      /* ignore */
    }
  }

  function clearDismissed() {
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function fetchSession() {
    if (typeof global.hubFetchSession === 'function') {
      return global.hubFetchSession();
    }
    return fetch('/api/auth/session', { credentials: 'include' })
      .then(function (res) {
        return res.json();
      })
      .catch(function () {
        return null;
      });
  }

  function fetchProfileLocation() {
    if (global.hubProfileLocation) {
      return Promise.resolve(String(global.hubProfileLocation || '').trim());
    }
    if (typeof global.hubLoadProfileLocation === 'function') {
      return global.hubLoadProfileLocation();
    }
    return fetch('/api/auth/profile', { credentials: 'include' })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        var loc =
          data && data.ok && data.profile
            ? String(data.profile.location || '').trim()
            : '';
        global.hubProfileLocation = loc;
        return loc;
      })
      .catch(function () {
        return '';
      });
  }

  function saveLocation(location) {
    return fetch('/api/auth/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: location }),
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok || !data || !data.ok) {
          var err = new Error(
            (data && (data.message || data.error)) || 'Could not save location.'
          );
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  function applyToEventsFilter(location) {
    var input = document.getElementById('postcode');
    if (input && !String(input.value || '').trim()) {
      input.value = location;
      try {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {
        /* ignore */
      }
    }
    if (typeof global.hubRefreshEventsFilters === 'function') {
      try {
        global.hubRefreshEventsFilters();
      } catch (e2) {
        /* ignore */
      }
    }
  }

  function removeNudge(host) {
    if (!host) return;
    var existing = host.querySelector('[' + rootAttr + ']');
    if (existing) existing.remove();
  }

  function mountNudge(host, options) {
    options = options || {};
    if (!host) return null;
    removeNudge(host);

    var settingsHref = options.settingsHref || '/account/settings/';
    var variant = options.variant || 'events';

    var el = document.createElement('aside');
    el.setAttribute(rootAttr, '1');
    el.className =
      'hub-location-nudge' +
      (variant === 'account' ? ' hub-location-nudge--account' : '');
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Add your location');
    el.innerHTML =
      '<div class="hub-location-nudge-inner">' +
      '<div class="hub-location-nudge-copy">' +
      '<p class="hub-location-nudge-kicker">Local picks</p>' +
      '<p class="hub-location-nudge-title">Add your city or postcode</p>' +
      '<p class="hub-location-nudge-lede">We&rsquo;ll show events near you and improve local recommendations. Not shown on your name badge.</p>' +
      '</div>' +
      '<form class="hub-location-nudge-form" novalidate>' +
      '<label class="visually-hidden" for="hub-location-nudge-input">City or postcode</label>' +
      '<input type="text" id="hub-location-nudge-input" class="hub-location-nudge-input" name="location" placeholder="e.g. Manchester or SK9 1AA" autocomplete="postal-code" maxlength="120" required>' +
      '<div class="hub-location-nudge-actions">' +
      '<button type="submit" class="hub-location-nudge-save">Save</button>' +
      '<button type="button" class="hub-location-nudge-dismiss">Not now</button>' +
      '</div>' +
      '<p class="hub-location-nudge-status" role="status" hidden></p>' +
      '<p class="hub-location-nudge-settings"><a href="' +
      esc(settingsHref) +
      '">Edit anytime in Account settings</a></p>' +
      '</form>' +
      '</div>';

    host.insertBefore(el, host.firstChild);

    var form = el.querySelector('.hub-location-nudge-form');
    var input = el.querySelector('#hub-location-nudge-input');
    var statusEl = el.querySelector('.hub-location-nudge-status');
    var dismissBtn = el.querySelector('.hub-location-nudge-dismiss');
    var saveBtn = el.querySelector('.hub-location-nudge-save');

    function setStatus(msg, isError) {
      if (!statusEl) return;
      if (!msg) {
        statusEl.hidden = true;
        statusEl.textContent = '';
        statusEl.classList.remove('is-error');
        return;
      }
      statusEl.hidden = false;
      statusEl.textContent = msg;
      statusEl.classList.toggle('is-error', Boolean(isError));
    }

    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () {
        markDismissed();
        el.remove();
      });
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var location = String((input && input.value) || '').trim();
        if (!location) {
          setStatus('Enter a city or postcode.', true);
          if (input) input.focus();
          return;
        }
        if (saveBtn) saveBtn.disabled = true;
        setStatus('Saving…');
        saveLocation(location)
          .then(function (data) {
            var saved =
              (data.profile && String(data.profile.location || '').trim()) ||
              location;
            global.hubProfileLocation = saved;
            clearDismissed();
            setStatus('Saved — we\'ll use this for Near Me and local picks.');
            applyToEventsFilter(saved);
            if (typeof options.onSaved === 'function') options.onSaved(saved);
            window.setTimeout(function () {
              el.remove();
            }, 1200);
          })
          .catch(function (err) {
            if (saveBtn) saveBtn.disabled = false;
            setStatus(err.message || 'Could not save. Try again.', true);
          });
      });
    }

    return el;
  }

  function shouldShowForSession(session) {
    if (!session || !session.ok || !session.user) return false;
    if (session.impersonating) return false;
    return true;
  }

  function initLocationProfileNudge(host, options) {
    options = options || {};
    if (!host) return Promise.resolve(null);
    if (isDismissed()) return Promise.resolve(null);

    return fetchSession().then(function (session) {
      if (!shouldShowForSession(session)) return null;
      return fetchProfileLocation().then(function (location) {
        if (location) return null;
        return mountNudge(host, options);
      });
    });
  }

  global.HUB_initLocationProfileNudge = initLocationProfileNudge;
  global.HUB_clearLocationNudgeDismiss = clearDismissed;

  function autoInit() {
    var host = document.getElementById('hub-location-nudge-host');
    if (!host || host.getAttribute('data-location-nudge-bound') === '1') return;
    host.setAttribute('data-location-nudge-bound', '1');
    var variant = host.getAttribute('data-variant') || 'events';
    var settingsHref = host.getAttribute('data-settings-href') || '/account/settings/';
    initLocationProfileNudge(host, { variant: variant, settingsHref: settingsHref });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})(typeof window !== 'undefined' ? window : globalThis);
