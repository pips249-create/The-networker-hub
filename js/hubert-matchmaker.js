/**
 * Hubert Matchmaker — attendee dashboard Meet people UI.
 * Phase 1 build: admin-only until HUBERT_MATCHMAKER_PUBLIC is flipped.
 */
(function () {
  'use strict';

  /** Flip to true (plus deploy) when Matchmaker is ready for all members. */
  var HUBERT_MATCHMAKER_PUBLIC = false;
  var MAX_SHORTLIST = 5;
  var HUBERT_ICON = '/assets/hubert-icon.png';

  var mounts = [];
  var visible = false;
  var lastQuery = '';

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
        why: 'Founder · SaaS — close to “' + q.slice(0, 48) + '”',
        nextEvent: { title: 'Manchester Founders Breakfast', dateLabel: '12 Nov 2026' },
        onHub: true,
      },
      {
        id: 'stub-2',
        fullName: 'Priya Shah',
        role: 'Investor',
        company: 'Harbour Capital',
        why: 'Investor looking to meet founders',
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
        why: 'Service provider in professional services',
        nextEvent: null,
        onHub: false,
      },
      {
        id: 'stub-4',
        fullName: 'Sam Taylor',
        role: 'Recruiter',
        company: 'Taylor Talent',
        why: 'Recruiter · HR',
        nextEvent: { title: 'The Business Show London', dateLabel: '11 Nov 2026' },
        onHub: true,
      },
      {
        id: 'stub-5',
        fullName: 'Jordan Lee',
        role: 'Founder',
        company: 'Lee & Co',
        why: 'Founder looking for suppliers',
        nextEvent: null,
        onHub: false,
      },
      {
        id: 'stub-6',
        fullName: 'Hidden Extra',
        role: 'Should not show',
        company: 'Cap test',
        why: 'Over the max-5 cap',
        nextEvent: null,
        onHub: true,
      },
    ].slice(0, MAX_SHORTLIST);
  }

  function personLabel(person) {
    if (person.displayName) return person.displayName;
    return shortDisplayName(person.fullName);
  }

  function renderCard(person) {
    var hasEvent = Boolean(person.nextEvent && person.nextEvent.title);
    var status = person.onHub
      ? '<span class="hmm-chip hmm-chip--member">On the Hub</span>'
      : '<span class="hmm-chip hmm-chip--invite">Hubert can invite them</span>';

    var eventBlock = hasEvent
      ? '<div class="hmm-match-event" aria-label="Upcoming event">' +
        '<span class="hmm-match-event-kicker">Next up</span>' +
        '<span class="hmm-match-event-title">' +
        esc(person.nextEvent.title) +
        '</span>' +
        (person.nextEvent.dateLabel
          ? '<span class="hmm-match-event-date">' + esc(person.nextEvent.dateLabel) + '</span>'
          : '') +
        '</div>'
      : '';

    return (
      '<article class="hmm-match' +
      (hasEvent ? ' hmm-match--has-event' : '') +
      '" data-hmm-id="' +
      esc(person.id) +
      '" role="listitem">' +
      (hasEvent ? eventBlock : '') +
      '<div class="hmm-match-body">' +
      '<div class="hmm-match-who">' +
      '<h3 class="hmm-match-name">' +
      esc(personLabel(person)) +
      '</h3>' +
      '<p class="hmm-match-meta">' +
      esc([person.role, person.company].filter(Boolean).join(' · ')) +
      '</p>' +
      '<div class="hmm-match-chips">' +
      status +
      '</div>' +
      '<p class="hmm-match-why">' +
      esc(person.why || '') +
      '</p>' +
      '</div>' +
      '<button type="button" class="hmm-match-cta" data-hmm-request="' +
      esc(person.id) +
      '" disabled title="Intro requests come in the next build slice">Request intro</button>' +
      '</div>' +
      '</article>'
    );
  }

  function setResults(mount, people, query, meta) {
    var results = mount.els.results;
    var empty = mount.els.empty;
    var preview = mount.els.previewNote;
    var shell = mount.els.shell;
    if (!results) return;

    var list = Array.isArray(people) ? people.slice(0, MAX_SHORTLIST) : [];
    if (shell) shell.classList.toggle('is-searched', list.length > 0 || Boolean(query));

    if (!list.length) {
      results.innerHTML = '';
      results.hidden = true;
      if (empty) empty.hidden = !query;
      if (preview) preview.hidden = true;
      return;
    }

    if (empty) empty.hidden = true;
    if (preview) {
      preview.hidden = false;
      var sourceNote =
        meta && meta.source === 'live'
          ? 'Live back-of-house matches'
          : 'Preview matches';
      preview.innerHTML =
        '<strong>Admin preview</strong> — ' +
        esc(sourceNote) +
        ' (up to ' +
        MAX_SHORTLIST +
        ') for “' +
        esc(String(query || '').trim()) +
        '”. No contact details are shown. Request intro comes next.';
    }
    results.innerHTML = list.map(renderCard).join('');
    results.hidden = false;
  }

  function paintAll(people, query, meta) {
    mounts.forEach(function (m) {
      if (m.els.input) m.els.input.value = query;
      setResults(m, people, query, meta);
    });
  }

  function fetchMatches(query) {
    return fetch('/api/auth/hubert-matchmaker', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'search', query: query }),
    }).then(function (res) {
      return res.json().then(function (data) {
        return { status: res.status, data: data };
      });
    });
  }

  function runSearch(mount, queryOverride) {
    var input = mount.els.input;
    var query =
      queryOverride != null ? String(queryOverride).trim() : input ? String(input.value || '').trim() : '';
    if (input && queryOverride != null) input.value = query;

    var err = mount.els.error;
    if (err) {
      err.hidden = true;
      err.textContent = '';
    }
    if (!query) {
      if (err) {
        err.textContent = 'Tell Hubert who you would like to meet.';
        err.hidden = false;
      }
      paintAll([], '', null);
      return;
    }

    lastQuery = query;
    if (mount.els.previewNote) {
      mount.els.previewNote.hidden = false;
      mount.els.previewNote.textContent = 'Hubert is matching…';
    }

    fetchMatches(query)
      .then(function (result) {
        var data = result.data || {};
        if (data.ok && Array.isArray(data.matches)) {
          paintAll(data.matches, query, { source: 'live' });
        } else if (result.status === 401 || result.status === 403) {
          if (err) {
            err.textContent = (data && data.message) || 'Sign in as an admin to use Hubert Matchmaker.';
            err.hidden = false;
          }
          paintAll([], query, null);
        } else {
          // Offline / peek mock fallback
          paintAll(stubShortlist(query), query, { source: 'stub' });
        }
        if (mount.mode === 'overview' && typeof mount.onExpand === 'function') {
          mount.onExpand(query);
        }
      })
      .catch(function () {
        paintAll(stubShortlist(query), query, { source: 'stub' });
        if (mount.mode === 'overview' && typeof mount.onExpand === 'function') {
          mount.onExpand(query);
        }
      });
  }

  function cacheEls(root) {
    return {
      root: root,
      shell: root.querySelector('[data-hmm-shell]') || root,
      form: root.querySelector('[data-hmm-form]'),
      input: root.querySelector('[data-hmm-query]'),
      error: root.querySelector('[data-hmm-error]'),
      results: root.querySelector('[data-hmm-results]'),
      empty: root.querySelector('[data-hmm-empty]'),
      previewNote: root.querySelector('[data-hmm-preview]'),
      adminBadge: root.querySelector('[data-hmm-admin-badge]'),
    };
  }

  function bind(mount) {
    var form = mount.els.form;
    if (!form || form.dataset.hmmBound === '1') return;
    form.dataset.hmmBound = '1';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      runSearch(mount);
    });
  }

  function setNavVisibility(isVisible) {
    document.querySelectorAll('[data-hmm-nav]').forEach(function (el) {
      el.hidden = !isVisible;
    });
  }

  function setOverviewVisibility(isVisible) {
    var panel = document.getElementById('ad-overview-hubert-meet');
    if (panel) panel.hidden = !isVisible;
  }

  function mountRoot(root, mode, hooks) {
    if (!root) return null;
    var mount = {
      els: cacheEls(root),
      mode: mode || 'page',
      onExpand: hooks && hooks.onExpand,
    };
    if (mount.els.adminBadge) {
      mount.els.adminBadge.hidden = isMatchmakerPublic();
    }
    bind(mount);
    mounts.push(mount);
    return mount;
  }

  function init(options) {
    mounts = [];
    var session = options && options.session;
    visible = canUseMatchmaker(session);
    setNavVisibility(visible);
    setOverviewVisibility(visible);

    if (!visible) {
      return { visible: false };
    }

    var meetPage = document.getElementById('ad-page-meet');
    var overview = document.getElementById('ad-overview-hubert-meet');

    mountRoot(meetPage, 'page');
    mountRoot(overview, 'overview', {
      onExpand: function (query) {
        // Stay on overview with results; dedicated page still available via nav.
        if (options && typeof options.onOverviewSearch === 'function') {
          options.onOverviewSearch(query);
        }
      },
    });

    if (lastQuery) {
      mounts.forEach(function (m) {
        if (m.els.input) m.els.input.value = lastQuery;
        setResults(m, stubShortlist(lastQuery), lastQuery);
      });
    }

    return { visible: true };
  }

  function render() {
    /* Interactive via form submit. */
  }

  function search(query) {
    if (!visible || !mounts.length) return;
    runSearch(mounts[0], query);
  }

  window.HubHubertMatchmaker = {
    MAX_SHORTLIST: MAX_SHORTLIST,
    HUBERT_ICON: HUBERT_ICON,
    isMatchmakerPublic: isMatchmakerPublic,
    canUseMatchmaker: canUseMatchmaker,
    shortDisplayName: shortDisplayName,
    init: init,
    render: render,
    search: search,
    _stubShortlist: stubShortlist,
  };
})();
