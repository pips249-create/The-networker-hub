/**
 * Hubert Matchmaker — attendee dashboard Meet people UI.
 * Phase 1 build: admin-only until HUBERT_MATCHMAKER_PUBLIC is flipped.
 * Matching / seed / intro email wire up in later slices; this ships the search shell.
 */
(function () {
  'use strict';

  /** Flip to true (plus deploy) when Matchmaker is ready for all members. */
  var HUBERT_MATCHMAKER_PUBLIC = false;
  var MAX_SHORTLIST = 5;

  function isMatchmakerPublic() {
    return HUBERT_MATCHMAKER_PUBLIC === true;
  }

  function canUseMatchmaker(sessionOrUser) {
    if (isMatchmakerPublic()) return true;
    var user = sessionOrUser && sessionOrUser.user ? sessionOrUser.user : sessionOrUser;
    return Boolean(user && user.role === 'admin');
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  /** Display form for shortlist: first name + surname initial. */
  function shortDisplayName(fullName) {
    var parts = String(fullName || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return 'Member';
    if (parts.length === 1) return parts[0];
    var initial = parts[parts.length - 1].charAt(0).toUpperCase();
    return parts[0] + ' ' + initial + '.';
  }

  function stubShortlist(query) {
    var q = String(query || '').trim() || 'your ask';
    return [
      {
        id: 'stub-1',
        fullName: 'Alex Morgan',
        role: 'Founder',
        company: 'Northbridge Labs',
        industry: 'SaaS',
        lookingFor: 'Clients',
        why: 'Tagged Founder · SaaS — close to “' + q.slice(0, 40) + '”',
        nextEvent: {
          title: 'Manchester Founders Breakfast',
          dateLabel: '12 Nov 2026',
        },
        onHub: true,
      },
      {
        id: 'stub-2',
        fullName: 'Priya Shah',
        role: 'Investor',
        company: 'Harbour Capital',
        industry: 'Finance',
        lookingFor: 'Founders',
        why: 'Looking to meet founders',
        nextEvent: {
          title: 'Women In Business Network · King’s Cross',
          dateLabel: '18 Nov 2026',
        },
        onHub: true,
      },
      {
        id: 'stub-3',
        fullName: 'James Okafor',
        role: 'Service provider',
        company: 'Okafor Advisory',
        industry: 'Professional services',
        lookingFor: 'Clients',
        why: 'Service provider in professional services',
        nextEvent: null,
        onHub: false,
      },
      {
        id: 'stub-4',
        fullName: 'Sam Taylor',
        role: 'Recruiter',
        company: 'Taylor Talent',
        industry: 'HR',
        lookingFor: 'Clients',
        why: 'Recruiter · HR',
        nextEvent: {
          title: 'The Business Show London',
          dateLabel: '11 Nov 2026',
        },
        onHub: true,
      },
      {
        id: 'stub-5',
        fullName: 'Jordan Lee',
        role: 'Founder',
        company: 'Lee & Co',
        industry: 'Marketing',
        lookingFor: 'Suppliers',
        why: 'Founder looking for suppliers',
        nextEvent: null,
        onHub: false,
      },
      {
        id: 'stub-6',
        fullName: 'Hidden Extra',
        role: 'Should not show',
        company: 'Cap test',
        industry: 'Other',
        lookingFor: 'Anyone',
        why: 'Over the max-5 cap',
        nextEvent: null,
        onHub: true,
      },
    ].slice(0, MAX_SHORTLIST);
  }

  function renderCard(person) {
    var eventHtml = '';
    if (person.nextEvent && person.nextEvent.title) {
      eventHtml =
        '<div class="hmm-card-event">' +
        '<p class="hmm-card-event-kicker">Upcoming event</p>' +
        '<p class="hmm-card-event-title">' +
        esc(person.nextEvent.title) +
        '</p>' +
        (person.nextEvent.dateLabel
          ? '<p class="hmm-card-event-date">' + esc(person.nextEvent.dateLabel) + '</p>'
          : '') +
        '</div>';
    }

    var status = person.onHub
      ? '<span class="hmm-card-status hmm-card-status--member">On the Hub</span>'
      : '<span class="hmm-card-status hmm-card-status--invite">Hubert can invite them to join</span>';

    return (
      '<article class="hmm-card" data-hmm-id="' +
      esc(person.id) +
      '" role="listitem">' +
      '<div class="hmm-card-top">' +
      '<div class="hmm-card-identity">' +
      '<h3 class="hmm-card-name">' +
      esc(shortDisplayName(person.fullName)) +
      '</h3>' +
      '<p class="hmm-card-meta">' +
      esc([person.role, person.company].filter(Boolean).join(' · ')) +
      '</p>' +
      status +
      '</div>' +
      '<button type="button" class="ad-btn ad-btn-primary hmm-card-cta" data-hmm-request="' +
      esc(person.id) +
      '" disabled title="Intro requests come in the next build slice">Request intro</button>' +
      '</div>' +
      eventHtml +
      '<p class="hmm-card-why">' +
      esc(person.why || '') +
      '</p>' +
      '</article>'
    );
  }

  function setResults(state, people, query) {
    var results = state.els.results;
    var empty = state.els.empty;
    var preview = state.els.previewNote;
    if (!results) return;

    var list = Array.isArray(people) ? people.slice(0, MAX_SHORTLIST) : [];
    if (!list.length) {
      results.innerHTML = '';
      results.hidden = true;
      if (empty) empty.hidden = false;
      if (preview) preview.hidden = true;
      return;
    }

    if (empty) empty.hidden = true;
    if (preview) {
      preview.hidden = false;
      preview.textContent =
        'Admin preview — showing up to ' +
        MAX_SHORTLIST +
        ' sample matches for “' +
        String(query || '').trim() +
        '”. Real back-of-house matching and intro email come next. Names use first name + initial only.';
    }
    results.innerHTML = list.map(renderCard).join('');
    results.hidden = false;
  }

  function runSearch(state) {
    var input = state.els.input;
    var query = input ? String(input.value || '').trim() : '';
    var err = state.els.error;
    if (err) {
      err.hidden = true;
      err.textContent = '';
    }
    if (!query) {
      if (err) {
        err.textContent = 'Tell Hubert who you would like to meet.';
        err.hidden = false;
      }
      setResults(state, [], '');
      return;
    }
    setResults(state, stubShortlist(query), query);
  }

  function bind(state) {
    var form = state.els.form;
    if (!form || form.dataset.hmmBound === '1') return;
    form.dataset.hmmBound = '1';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      runSearch(state);
    });
  }

  function cacheEls(root) {
    return {
      root: root,
      form: root.querySelector('[data-hmm-form]'),
      input: root.querySelector('[data-hmm-query]'),
      error: root.querySelector('[data-hmm-error]'),
      results: root.querySelector('[data-hmm-results]'),
      empty: root.querySelector('[data-hmm-empty]'),
      previewNote: root.querySelector('[data-hmm-preview]'),
      adminBadge: root.querySelector('[data-hmm-admin-badge]'),
    };
  }

  var state = {
    ready: false,
    visible: false,
    els: {},
  };

  function setNavVisibility(visible) {
    document.querySelectorAll('[data-hmm-nav]').forEach(function (el) {
      el.hidden = !visible;
    });
  }

  function init(options) {
    var root = document.getElementById('ad-page-meet');
    if (!root) return { visible: false };

    var session = options && options.session;
    var visible = canUseMatchmaker(session);
    state.visible = visible;
    state.els = cacheEls(root);
    setNavVisibility(visible);

    if (!visible) {
      return { visible: false };
    }

    if (state.els.adminBadge) {
      state.els.adminBadge.hidden = isMatchmakerPublic();
    }
    bind(state);
    state.ready = true;
    return { visible: true };
  }

  function render() {
    if (!state.ready || !state.visible) return;
    /* Shell is interactive via form submit; nothing extra to paint yet. */
  }

  window.HubHubertMatchmaker = {
    MAX_SHORTLIST: MAX_SHORTLIST,
    isMatchmakerPublic: isMatchmakerPublic,
    canUseMatchmaker: canUseMatchmaker,
    shortDisplayName: shortDisplayName,
    init: init,
    render: render,
    /** Test helper */
    _stubShortlist: stubShortlist,
  };
})();
