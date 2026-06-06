/**
 * Shared navigation for "add group profile" / "list event" CTAs.
 * Requires a group profile before creating an event.
 */
(function (global) {
  var scriptEl = document.currentScript;
  var root = (scriptEl && scriptEl.getAttribute('data-root')) || '../';
  var GROUP_STORAGE_KEY = 'hub_event_group_id';

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

  async function goToGroupProfile(options) {
    options = options || {};
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

  async function goToAddEvent(options) {
    options = options || {};
    var data = await fetchSession();
    if (!data.ok || !data.user) {
      global.location.href = loginUrl('/organiser/event-format.html');
      return;
    }
    if (!hasGroupProfile(data)) {
      global.alert('You must add a group profile first.');
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
      global.alert('You must add a group profile first.');
      global.location.href = path('organiser/group-edit.html');
      return false;
    }
    return true;
  }

  global.HubOrganiserActions = {
    GROUP_STORAGE_KEY: GROUP_STORAGE_KEY,
    goToGroupProfile: goToGroupProfile,
    goToAddEvent: goToAddEvent,
    bindActions: bindActions,
    requireGroupProfileForEventFlow: requireGroupProfileForEventFlow,
    requireLogin: requireLogin,
    hasGroupProfile: hasGroupProfile,
    fetchSession: fetchSession,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      bindActions(document);
    });
  } else {
    bindActions(document);
  }
})(typeof window !== 'undefined' ? window : globalThis);
