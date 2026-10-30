/**
 * Public Matchmaker teaser — Home + Events browse.
 * Hidden for everyone except admins until HUBERT_MATCHMAKER_PUBLIC is true
 * (same launch flag as dashboard Meet people).
 *
 * Submit never runs a public people search. Signed-in eligible users go to
 * Meet people; everyone else is sent to register/sign-in.
 */
(function () {
  'use strict';

  /** Keep in sync with js/hubert-matchmaker.js */
  var HUBERT_MATCHMAKER_PUBLIC = false;

  function isMatchmakerPublic() {
    return HUBERT_MATCHMAKER_PUBLIC === true;
  }

  function canSeeTeaser(sessionOrUser) {
    if (isMatchmakerPublic()) return true;
    var user = sessionOrUser && sessionOrUser.user ? sessionOrUser.user : sessionOrUser;
    return Boolean(user && user.role === 'admin');
  }

  function canUseMatchmaker(sessionOrUser) {
    return canSeeTeaser(sessionOrUser);
  }

  function meetUrl(query) {
    var q = String(query || '').trim();
    var base = '/account/#meet';
    if (!q) return base;
    return base + '?q=' + encodeURIComponent(q.slice(0, 240));
  }

  function registerUrl(query) {
    var next = meetUrl(query);
    return (
      '/register?intent=attendee&utm_source=hubert&utm_medium=teaser&utm_campaign=matchmaker&next=' +
      encodeURIComponent(next)
    );
  }

  function loginUrl(query) {
    var next = meetUrl(query);
    return '/login?next=' + encodeURIComponent(next);
  }

  function fetchSession() {
    return fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
      .then(function (res) {
        return res.json().catch(function () {
          return {};
        });
      })
      .catch(function () {
        return {};
      });
  }

  function bindRoot(root, session) {
    if (!root) return;
    var form = root.querySelector('[data-hmm-teaser-form]');
    var input = root.querySelector('[data-hmm-teaser-query]');
    var gate = root.querySelector('[data-hmm-teaser-gate]');
    var signedIn = Boolean(session && session.user);
    var eligible = canUseMatchmaker(session);

    root.hidden = !canSeeTeaser(session);
    if (root.hidden) return;

    if (gate) {
      if (isMatchmakerPublic() && !signedIn) {
        gate.hidden = false;
        gate.textContent = 'Create a free account to see matches and request intros.';
      } else if (!isMatchmakerPublic()) {
        gate.hidden = false;
        gate.textContent = 'Admin preview — Matchmaker is not public yet.';
      } else {
        gate.hidden = true;
        gate.textContent = '';
      }
    }

    if (!form || form.dataset.hmmBound === '1') return;
    form.dataset.hmmBound = '1';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input ? String(input.value || '').trim() : '';
      if (signedIn && eligible) {
        window.location.href = meetUrl(q);
        return;
      }
      if (signedIn && !eligible) {
        window.location.href = '/account/';
        return;
      }
      window.location.href = registerUrl(q);
    });
  }

  function init() {
    var roots = document.querySelectorAll('[data-hmm-teaser]');
    if (!roots.length) return;

    // Before session: stay hidden when gated so members never flash the teaser.
    if (!isMatchmakerPublic()) {
      roots.forEach(function (root) {
        root.hidden = true;
      });
    }

    fetchSession().then(function (data) {
      var session = data && data.user ? data : { user: data && data.ok === false ? null : data };
      if (data && data.user) session = data;
      roots.forEach(function (root) {
        bindRoot(root, session);
      });
    });
  }

  window.HubHubertMatchmakerTeaser = {
    isMatchmakerPublic: isMatchmakerPublic,
    canSeeTeaser: canSeeTeaser,
    meetUrl: meetUrl,
    registerUrl: registerUrl,
    loginUrl: loginUrl,
    init: init,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
