/**
 * Shared navigation for "add group profile" / "list event" CTAs.
 * Requires a group profile before creating an event.
 */
(function (global) {
  var scriptEl = document.currentScript;
  var root = (scriptEl && scriptEl.getAttribute('data-root')) || '../';
  var GROUP_STORAGE_KEY = 'hub_event_group_id';
  var BROWSE_RETURN_KEY = 'hub_browse_return';
  var PRIMER_SKIP_KEY = 'hub_list_event_primer_skip';
  var primerContinueHandler = null;

  function path(relative) {
    if (!relative) return root;
    if (/^https?:\/\//i.test(relative) || relative.charAt(0) === '/') return relative;
    return root + relative.replace(/^\.\//, '');
  }

  function loginUrl(nextPath) {
    return path('login.html?next=' + encodeURIComponent(nextPath));
  }

  async function fetchSession() {
    var res = await fetch('/api/auth/session', { credentials: 'include' });
    return res.json();
  }

  function hasGroupProfile(sessionData) {
    if (!sessionData || !sessionData.ok || !sessionData.user) return false;
    if (Number(sessionData.organiserProfiles) > 0) return true;
    return sessionData.canOrganise === true && sessionData.user.role === 'admin';
  }

  function isEventsBrowsePage() {
    var p = String(global.location.pathname || '');
    return /\/events\/?(index\.html)?$/i.test(p) || p.endsWith('/events/');
  }

  function saveBrowseReturn() {
    if (!isEventsBrowsePage()) return;
    var hash = global.location.hash || '#events';
    try {
      global.sessionStorage.setItem(BROWSE_RETURN_KEY, 'events/index.html' + hash);
    } catch (e) {
      /* ignore */
    }
  }

  function getBrowseReturnPath() {
    try {
      return global.sessionStorage.getItem(BROWSE_RETURN_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function clearBrowseReturn() {
    try {
      global.sessionStorage.removeItem(BROWSE_RETURN_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function applyBrowseReturnBack(linkEl, fallbackHref, fallbackLabel) {
    if (!linkEl) return;
    var stored = getBrowseReturnPath();
    if (stored) {
      linkEl.href = path(stored);
      linkEl.textContent = '← Back to browse events';
      return;
    }
    linkEl.href = fallbackHref || 'index.html#events-list';
    linkEl.textContent = fallbackLabel || '← Back to My Events';
  }

  function shouldShowListEventPrimer() {
    if (!isEventsBrowsePage()) return false;
    if (document.getElementById('events-list-primer')) {
      try {
        if (global.sessionStorage.getItem(PRIMER_SKIP_KEY) === '1') return false;
      } catch (e) {
        /* ignore */
      }
      return true;
    }
    return false;
  }

  function updateListEventPrimerSteps(sessionData) {
    var signedIn = Boolean(sessionData && sessionData.ok && sessionData.user);
    var hasGroup = hasGroupProfile(sessionData);
    document.querySelectorAll('.events-list-primer-step').forEach(function (step, index) {
      var key = step.getAttribute('data-primer-step');
      var done = false;
      if (key === 'account') done = signedIn;
      if (key === 'group') done = hasGroup;
      step.classList.toggle('is-done', done);
      var marker = step.querySelector('.events-list-primer-step-marker');
      if (marker) marker.textContent = done ? '✓' : String(index + 1);
    });
    var goBtn = document.getElementById('events-list-primer-go');
    if (goBtn) {
      goBtn.textContent = hasGroup ? 'Continue to event wizard →' : 'Get started →';
    }
  }

  function closeListEventPrimer() {
    var modal = document.getElementById('events-list-primer');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('events-list-primer-open');
    var dismiss = document.getElementById('events-list-primer-dismiss');
    if (dismiss && dismiss.checked) {
      try {
        global.sessionStorage.setItem(PRIMER_SKIP_KEY, '1');
      } catch (e) {
        /* ignore */
      }
    }
    primerContinueHandler = null;
  }

  function openListEventPrimer(sessionData, onContinue) {
    var modal = document.getElementById('events-list-primer');
    if (!modal) {
      onContinue();
      return;
    }
    primerContinueHandler = onContinue;
    updateListEventPrimerSteps(sessionData);
    modal.hidden = false;
    document.body.classList.add('events-list-primer-open');
    var goBtn = document.getElementById('events-list-primer-go');
    if (goBtn) goBtn.focus();
  }

  function bindListEventPrimer() {
    var modal = document.getElementById('events-list-primer');
    if (!modal || modal.dataset.primerBound) return;
    modal.dataset.primerBound = '1';
    modal.querySelectorAll('[data-list-primer-close]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        closeListEventPrimer();
      });
    });
    var goBtn = document.getElementById('events-list-primer-go');
    if (goBtn) {
      goBtn.addEventListener('click', function (e) {
        e.preventDefault();
        var next = primerContinueHandler;
        closeListEventPrimer();
        if (typeof next === 'function') next();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) closeListEventPrimer();
    });
  }

  async function goToGroupProfile(options) {
    options = options || {};
    saveBrowseReturn();
    var data = await fetchSession();
    if (!data.ok || !data.user) {
      global.location.href = loginUrl('/organiser/group-edit.html');
      return;
    }
    try {
      sessionStorage.removeItem(GROUP_STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
    global.location.href = path('organiser/group-edit.html');
  }

  function continueGoToAddEvent(data) {
    if (!data.ok || !data.user) {
      global.location.href = loginUrl('/organiser/event-format.html');
      return;
    }
    if (!hasGroupProfile(data)) {
      global.location.href = path('organiser/group-edit.html');
      return;
    }
    try {
      sessionStorage.removeItem(GROUP_STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
    global.location.href = path('organiser/event-format.html');
  }

  async function goToAddEvent(options) {
    options = options || {};
    saveBrowseReturn();
    var data = await fetchSession();
    if (hasGroupProfile(data)) {
      continueGoToAddEvent(data);
      return;
    }
    if (shouldShowListEventPrimer()) {
      openListEventPrimer(data, function () {
        continueGoToAddEvent(data);
      });
      return;
    }
    continueGoToAddEvent(data);
  }

  async function goToAddOpportunity(options) {
    options = options || {};
    var data = await fetchSession();
    if (!data.ok || !data.user) {
      global.location.href = loginUrl('/organiser/opportunity-intro.html');
      return;
    }
    global.location.href = path('organiser/opportunity-intro.html');
  }

  function bindActions(scope) {
    var rootEl = scope && scope.querySelectorAll ? scope : document;
    rootEl.querySelectorAll('[data-hub-action="add-group"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        goToGroupProfile();
      });
    });
    rootEl.querySelectorAll('[data-hub-action="add-event"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        goToAddEvent();
      });
    });
    rootEl.querySelectorAll('[data-hub-action="add-opportunity"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        goToAddOpportunity();
      });
    });
  }

  /** Redirect to login when anonymous. Returns true if signed in. */
  async function requireLogin(nextPath) {
    var data = await fetchSession();
    if (data.ok && data.user) return true;
    global.location.href = loginUrl(nextPath || global.location.pathname + global.location.search);
    return false;
  }

  /** Call on event-format.html — redirect if no group profile. */
  async function requireGroupProfileForEventFlow() {
    var data = await fetchSession();
    if (!data.ok || !data.user) {
      global.location.href = loginUrl('/organiser/event-format.html');
      return false;
    }
    if (!hasGroupProfile(data)) {
      global.location.href = path('organiser/group-edit.html');
      return false;
    }
    return true;
  }

  global.HubOrganiserActions = {
    GROUP_STORAGE_KEY: GROUP_STORAGE_KEY,
    BROWSE_RETURN_KEY: BROWSE_RETURN_KEY,
    goToGroupProfile: goToGroupProfile,
    goToAddEvent: goToAddEvent,
    goToAddOpportunity: goToAddOpportunity,
    bindActions: bindActions,
    requireGroupProfileForEventFlow: requireGroupProfileForEventFlow,
    requireLogin: requireLogin,
    hasGroupProfile: hasGroupProfile,
    fetchSession: fetchSession,
    saveBrowseReturn: saveBrowseReturn,
    getBrowseReturnPath: getBrowseReturnPath,
    clearBrowseReturn: clearBrowseReturn,
    applyBrowseReturnBack: applyBrowseReturnBack,
  };

  function init() {
    bindListEventPrimer();
    bindActions(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
