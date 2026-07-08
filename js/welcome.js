(function () {
  var WELCOME_DONE_KEY = 'hub_welcome_completed';

  function markWelcomeDone() {
    try {
      localStorage.setItem(WELCOME_DONE_KEY, '1');
    } catch (e) {
      /* ignore */
    }
  }

  function isWelcomeDone() {
    try {
      return localStorage.getItem(WELCOME_DONE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function go(path) {
    markWelcomeDone();
    window.location.href = path;
  }

  async function ensureSignedIn() {
    try {
      var res = await fetch('/api/auth/session', { credentials: 'include' });
      var data = await res.json();
      if (data.ok && data.user) {
        if (isWelcomeDone()) {
          window.location.href = 'events/index.html';
          return null;
        }
        personalizeWelcome(data.user);
        return data;
      }
    } catch (e) {
      /* ignore */
    }
    window.location.href = 'register.html';
    return null;
  }

  function personalizeWelcome(user) {
    var nameEl = document.getElementById('welcome-user-name');
    if (!nameEl || !user) return;
    var name = user.name && String(user.name).trim();
    nameEl.textContent = name || 'there';
  }

  async function goListEvent() {
    if (window.HubOrganiserActions && window.HubOrganiserActions.goToAddEvent) {
      markWelcomeDone();
      await window.HubOrganiserActions.goToAddEvent();
      return;
    }
    go('organiser/event-format.html');
  }

  document.querySelectorAll('[data-welcome-path]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var path = btn.getAttribute('data-welcome-path');
      if (path === 'find-event') go('events/index.html');
      else if (path === 'list-event') goListEvent();
      else if (path === 'find-opportunity') go('opportunities/index.html');
      else if (path === 'list-opportunity') go('opportunities/list.html');
    });
  });

  document.querySelectorAll('.auth-welcome-skip a').forEach(function (link) {
    link.addEventListener('click', markWelcomeDone);
  });

  document.querySelectorAll('.auth-welcome-skip-actions a').forEach(function (link) {
    link.addEventListener('click', markWelcomeDone);
  });

  ensureSignedIn();
})();
