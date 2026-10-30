/**
 * Public Matchmaker teaser — Home + Events browse.
 *
 * While HUBERT_MATCHMAKER_PUBLIC is false:
 *   - Teaser is visible to everyone in "build your profile" mode (no live search).
 *   - CTA sends signed-in users to Meet people profile setup; others to register.
 *   - Invite someone else shares a free join link (Web Share / clipboard).
 *
 * When the launch flag flips true:
 *   - Search lookalike returns; real search still requires sign-in.
 */
(function () {
  'use strict';

  /** Keep in sync with js/hubert-matchmaker.js */
  var HUBERT_MATCHMAKER_PUBLIC = false;

  var COPY = {
    profile: {
      title: 'Build your Hubert profile',
      ledeHome:
        'Want warm intros to the right people — without cold LinkedIn or guest-list dumps? Hubert is The Networker UK’s matchmaker: he shortlists members worth meeting (customers, investors, hires, mentors) and only opens an intro when you both say yes. Build your profile now so you’re in the pool when search opens; email, phone, and LinkedIn stay private.',
      ledeEvents:
        'The room is crowded; the right intro isn’t. Hubert shortlists people worth meeting at events and after — customers, investors, hires, mentors — and only introduces you when both sides opt in. Build your profile now so you’re ready; contact details stay private.',
      submit: 'Build your profile',
      invite: 'Invite someone else — free',
      badge: 'Launching soon',
      gateSignedOut: 'Search launches soon — build your profile now so you’re ready for warm intros.',
      gateSignedIn: 'Search launches soon — add a headline, who you want to meet, and Include me so you’re ready.',
      inviteCopied: 'Invite link copied — send it to someone you’d like in the pool.',
      inviteShared: 'Thanks — share Hubert with anyone you’d like to meet.',
    },
    search: {
      titleHome: 'Who do you want to meet?',
      titleEvents: 'Meet people beyond the room',
      ledeHome:
        'Tell Hubert what you’re working on. He shortlists relevant people on The Networker UK and can introduce you privately — email, phone, and LinkedIn stay private.',
      ledeEvents:
        'Looking for someone at an event — or the right intro after? Hubert shortlists relevant members and can introduce you privately. Contact details stay private.',
      submit: 'Try Hubert',
      badge: '',
      gateSignedOut: 'Create a free account to see matches and request intros.',
    },
  };

  function isMatchmakerPublic() {
    return HUBERT_MATCHMAKER_PUBLIC === true;
  }

  /** Profile-build teaser is public; search teaser follows the same launch flag. */
  function canSeeTeaser() {
    return true;
  }

  function canUseMatchmaker(sessionOrUser) {
    if (isMatchmakerPublic()) return true;
    var user = sessionOrUser && sessionOrUser.user ? sessionOrUser.user : sessionOrUser;
    return Boolean(user && user.role === 'admin');
  }

  function meetUrl(query) {
    var q = String(query || '').trim();
    var base = '/account/#meet';
    if (!q || !isMatchmakerPublic()) return base;
    return base + '?q=' + encodeURIComponent(q.slice(0, 240));
  }

  function profileUrl() {
    return '/account/#meet';
  }

  function registerUrl(query) {
    var next = isMatchmakerPublic() ? meetUrl(query) : profileUrl();
    return (
      '/register?intent=attendee&utm_source=hubert&utm_medium=teaser&utm_campaign=matchmaker&next=' +
      encodeURIComponent(next)
    );
  }

  function loginUrl(query) {
    var next = isMatchmakerPublic() ? meetUrl(query) : profileUrl();
    return '/login?next=' + encodeURIComponent(next);
  }

  function inviteShareUrl() {
    var origin = window.location && window.location.origin ? window.location.origin : '';
    return (
      origin +
      '/register?intent=attendee&utm_source=hubert&utm_medium=invite&utm_campaign=matchmaker_launch&next=' +
      encodeURIComponent('/account/#meet')
    );
  }

  function inviteSharePayload() {
    var url = inviteShareUrl();
    return {
      title: 'Hubert on The Networker UK',
      text:
        'Hubert is launching on The Networker UK — warm intros to people worth meeting, free to join. Build your profile before search opens: ' +
        url,
      url: url,
    };
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

  function setInviteStatus(root, message) {
    var status = root.querySelector('[data-hmm-teaser-invite-status]');
    if (!status) return;
    if (!message) {
      status.hidden = true;
      status.textContent = '';
      return;
    }
    status.hidden = false;
    status.textContent = message;
  }

  function shareInvite(root) {
    var payload = inviteSharePayload();
    setInviteStatus(root, '');
    if (navigator.share) {
      return navigator
        .share(payload)
        .then(function () {
          setInviteStatus(root, COPY.profile.inviteShared);
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          return copyInvite(root, payload);
        });
    }
    return copyInvite(root, payload);
  }

  function copyInvite(root, payload) {
    var text = (payload && payload.text) || inviteSharePayload().text;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () {
          setInviteStatus(root, COPY.profile.inviteCopied);
        },
        function () {
          setInviteStatus(root, 'Copy this link: ' + inviteShareUrl());
        }
      );
    }
    setInviteStatus(root, 'Copy this link: ' + inviteShareUrl());
    return Promise.resolve();
  }

  function applyModeCopy(root, searchMode) {
    var title = root.querySelector('[data-hmm-teaser-title]');
    var lede = root.querySelector('[data-hmm-teaser-lede]');
    var submit = root.querySelector('[data-hmm-teaser-submit]');
    var invite = root.querySelector('[data-hmm-teaser-invite]');
    var input = root.querySelector('[data-hmm-teaser-query]');
    var badge = root.querySelector('[data-hmm-teaser-badge]');
    var isEvents = root.classList.contains('hmm-teaser--events');

    if (searchMode) {
      if (title) title.textContent = isEvents ? COPY.search.titleEvents : COPY.search.titleHome;
      if (lede) lede.textContent = isEvents ? COPY.search.ledeEvents : COPY.search.ledeHome;
      if (submit) submit.textContent = COPY.search.submit;
      if (invite) invite.hidden = true;
      if (badge) {
        badge.hidden = true;
        badge.textContent = '';
      }
      if (input) {
        input.hidden = false;
        input.required = false;
        input.removeAttribute('disabled');
      }
      setInviteStatus(root, '');
      root.classList.remove('hmm-teaser--profile');
      root.classList.add('hmm-teaser--search');
    } else {
      if (title) title.textContent = COPY.profile.title;
      if (lede) lede.textContent = isEvents ? COPY.profile.ledeEvents : COPY.profile.ledeHome;
      if (submit) submit.textContent = COPY.profile.submit;
      if (invite) {
        invite.hidden = false;
        invite.textContent = COPY.profile.invite;
      }
      if (badge) {
        badge.hidden = false;
        badge.textContent = COPY.profile.badge;
      }
      if (input) {
        input.hidden = true;
        input.value = '';
        input.removeAttribute('required');
      }
      root.classList.add('hmm-teaser--profile');
      root.classList.remove('hmm-teaser--search');
    }
  }

  function bindRoot(root, session) {
    if (!root) return;
    var form = root.querySelector('[data-hmm-teaser-form]');
    var input = root.querySelector('[data-hmm-teaser-query]');
    var gate = root.querySelector('[data-hmm-teaser-gate]');
    var inviteBtn = root.querySelector('[data-hmm-teaser-invite]');
    var signedIn = Boolean(session && session.user);
    var searchMode = isMatchmakerPublic();
    var eligibleSearch = canUseMatchmaker(session);

    root.hidden = !canSeeTeaser();
    if (root.hidden) return;

    applyModeCopy(root, searchMode);

    if (gate) {
      if (searchMode && !signedIn) {
        gate.hidden = false;
        gate.textContent = COPY.search.gateSignedOut;
      } else if (!searchMode && !signedIn) {
        gate.hidden = false;
        gate.textContent = COPY.profile.gateSignedOut;
      } else if (!searchMode && signedIn) {
        gate.hidden = false;
        gate.textContent = COPY.profile.gateSignedIn;
      } else {
        gate.hidden = true;
        gate.textContent = '';
      }
    }

    if (inviteBtn && inviteBtn.dataset.hmmBound !== '1') {
      inviteBtn.dataset.hmmBound = '1';
      inviteBtn.addEventListener('click', function () {
        shareInvite(root);
      });
    }

    if (!form || form.dataset.hmmBound === '1') return;
    form.dataset.hmmBound = '1';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input && !input.hidden ? String(input.value || '').trim() : '';
      if (!searchMode) {
        if (signedIn) {
          window.location.href = profileUrl();
          return;
        }
        window.location.href = registerUrl();
        return;
      }
      if (signedIn && eligibleSearch) {
        window.location.href = meetUrl(q);
        return;
      }
      if (signedIn && !eligibleSearch) {
        window.location.href = '/account/#meet';
        return;
      }
      window.location.href = registerUrl(q);
    });
  }

  function init() {
    var roots = document.querySelectorAll('[data-hmm-teaser]');
    if (!roots.length) return;

    // Paint profile mode immediately so members never wait on session for copy.
    roots.forEach(function (root) {
      root.hidden = false;
      applyModeCopy(root, isMatchmakerPublic());
    });

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
    canUseMatchmaker: canUseMatchmaker,
    meetUrl: meetUrl,
    profileUrl: profileUrl,
    registerUrl: registerUrl,
    loginUrl: loginUrl,
    inviteShareUrl: inviteShareUrl,
    init: init,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
