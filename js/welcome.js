(function () {
  var WELCOME_DONE_KEY = 'hub_welcome_completed';

  function markWelcomeDone() {
    try {
      localStorage.setItem(WELCOME_DONE_KEY, '1');
    } catch (e) {
      /* ignore */
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
      if (data.ok && data.user) return data;
    } catch (e) {
      /* ignore */
    }
    window.location.href = 'register.html';
    return null;
  }

  async function goListEvent() {
    if (window.HubOrganiserActions && window.HubOrganiserActions.goToAddEvent) {
      markWelcomeDone();
      await window.HubOrganiserActions.goToAddEvent();
      return;
    }
    go('organiser/event-format.html');
  }

  async function goListWorkshop() {
    markWelcomeDone();
    try {
      localStorage.setItem('hub_organiser_tour_v1', '');
      localStorage.removeItem('hub_organiser_tour_v1');
      localStorage.removeItem('hub_getting_started_dismissed');
    } catch (e) {
      /* ignore */
    }
    window.location.href = 'organiser/index.html?onboard=1#academy';
  }

  document.querySelectorAll('[data-welcome-path]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var path = btn.getAttribute('data-welcome-path');
      if (path === 'find-event') go('events/index.html');
      else if (path === 'list-event') goListEvent();
      else if (path === 'find-workshop') go('training/index.html');
      else if (path === 'list-workshop') goListWorkshop();
    });
  });

  ensureSignedIn();
})();
