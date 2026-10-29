/**
 * Hubert Matchmaker — attendee dashboard Meet people UI.
 * Phase 1 build: admin-only until HUBERT_MATCHMAKER_PUBLIC is flipped.
 */
(function () {
  'use strict';

  /** Flip to true (plus deploy) when Matchmaker is ready for all members. */
  var HUBERT_MATCHMAKER_PUBLIC = false;
  var MAX_SHORTLIST = 5;
  var TOPIC_MIN_LEN = 25;
  var HUBERT_ICON = '/assets/hubert-icon.png';

  var mounts = [];
  var visible = false;
  var lastQuery = '';
  var lastMatches = [];
  var pendingByTarget = {};

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

  function findPerson(id) {
    for (var i = 0; i < lastMatches.length; i++) {
      if (String(lastMatches[i].id) === String(id)) return lastMatches[i];
    }
    return null;
  }

  function renderCard(person) {
    var hasEvent = Boolean(person.nextEvent && person.nextEvent.title);
    var status = person.onHub
      ? '<span class="hmm-chip hmm-chip--member">On the Hub</span>'
      : '<span class="hmm-chip hmm-chip--invite">Hubert can invite them</span>';
    var requested = Boolean(pendingByTarget[person.id]);
    var isStub = String(person.id || '').indexOf('stub-') === 0;

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

    var cta = requested
      ? '<button type="button" class="hmm-match-cta is-sent" disabled>Intro requested</button>'
      : '<button type="button" class="hmm-match-cta" data-hmm-request="' +
        esc(person.id) +
        '"' +
        (isStub ? ' disabled title="Live matches required to request an intro"' : '') +
        '>Request intro</button>';

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
      cta +
      '</div>' +
      '</article>'
    );
  }

  function applyEmptyCopy(emptyEl, meta) {
    if (!emptyEl) return;
    var copy =
      (meta && meta.empty) ||
      emptyStateCopy(meta) || {
        title: 'No one came back yet',
        text: 'Try another way of describing who you need — a bit more context helps.',
      };
    var titleEl = emptyEl.querySelector('.ad-empty-state-title');
    var textEl = emptyEl.querySelector('.ad-empty-state-text');
    if (titleEl) titleEl.textContent = copy.title;
    if (textEl) textEl.textContent = copy.text;
  }

  /** Mirrors api/_lib/hubert-matchmaker-search emptyStateCopy for offline/stub paths. */
  function emptyStateCopy(meta) {
    var m = meta || {};
    if (m.eventQuery) {
      var titles = Array.isArray(m.matchedEvents)
        ? m.matchedEvents
            .map(function (e) {
              return e && e.title;
            })
            .filter(Boolean)
        : [];
      if (titles.length && Number(m.eventAttendeeCount || 0) === 0) {
        return {
          title: 'No bookings I can introduce yet',
          text:
            'I matched “' +
            titles[0] +
            '” on the Hub, but nobody’s booked that I can show. Try another session, or ask who you need by role.',
        };
      }
      if (!titles.length) {
        return {
          title: 'I couldn’t match that Hub event',
          text: 'Try the event name as it appears on The Networker — or describe who you need (role, city, problem).',
        };
      }
    }
    if (Number(m.candidateCount || 0) === 0) {
      return {
        title: 'No one came back yet',
        text: 'The Hub pool is still thin for that ask. Try another description, or check back after more members opt in.',
      };
    }
    return {
      title: 'No one came back yet',
      text: 'Try another way of describing who you need — a bit more context helps.',
    };
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
      if (empty) {
        applyEmptyCopy(empty, meta);
        empty.hidden = !query;
      }
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
      var eventNote = '';
      if (meta && meta.eventQuery && Array.isArray(meta.matchedEvents) && meta.matchedEvents.length) {
        eventNote =
          ' Matched Hub event: ' +
          esc(meta.matchedEvents[0].title || 'event') +
          (meta.matchedEvents[0].dateLabel ? ' (' + esc(meta.matchedEvents[0].dateLabel) + ')' : '') +
          '.';
      }
      preview.innerHTML =
        '<strong>Admin preview</strong> — ' +
        esc(sourceNote) +
        ' (up to ' +
        MAX_SHORTLIST +
        ') for “' +
        esc(String(query || '').trim()) +
        '”.' +
        eventNote +
        ' No contact details are shown. Request intro emails them via Hubert.';
    }
    results.innerHTML = list.map(renderCard).join('');
    results.hidden = false;
    bindRequestButtons(mount);
  }

  function paintAll(people, query, meta) {
    lastMatches = Array.isArray(people) ? people.slice() : [];
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

  function askForTopic(person) {
    var label = personLabel(person);
    var topic = window.prompt(
      'What would you like to discuss with ' + label + '? (at least ' + TOPIC_MIN_LEN + ' characters)',
      ''
    );
    if (topic == null) return null;
    topic = String(topic).replace(/\s+/g, ' ').trim();
    if (topic.length < TOPIC_MIN_LEN) {
      window.alert('Add a bit more detail (at least ' + TOPIC_MIN_LEN + ' characters).');
      return null;
    }
    return topic;
  }

  function requestIntro(person, mount) {
    if (!person || String(person.id || '').indexOf('stub-') === 0) {
      if (mount && mount.els.error) {
        mount.els.error.textContent = 'Run a live search before requesting an intro.';
        mount.els.error.hidden = false;
      }
      return;
    }
    var topic = askForTopic(person);
    if (!topic) return;

    var btn = mount.els.results && mount.els.results.querySelector('[data-hmm-request="' + person.id + '"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending…';
    }

    fetch('/api/auth/hubert-matchmaker', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'request',
        targetId: person.id,
        topic: topic,
        source: mount.mode === 'overview' ? 'overview' : 'search',
        eventId: person.nextEvent && person.nextEvent.eventId ? person.nextEvent.eventId : null,
        eventTitle: person.nextEvent && person.nextEvent.title ? person.nextEvent.title : null,
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { status: res.status, data: data };
        });
      })
      .then(function (result) {
        var data = result.data || {};
        if (data.ok && data.intro) {
          pendingByTarget[person.id] = data.intro.id;
          paintAll(lastMatches, lastQuery, { source: 'live' });
          loadMyIntros();
          if (mount && mount.els.error) {
            mount.els.error.hidden = true;
          }
          return;
        }
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Request intro';
        }
        if (mount && mount.els.error) {
          mount.els.error.textContent =
            (data && data.message) || 'Hubert could not send that intro request just now.';
          mount.els.error.hidden = false;
        }
      })
      .catch(function () {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Request intro';
        }
        if (mount && mount.els.error) {
          mount.els.error.textContent = 'Connection issue — try requesting again.';
          mount.els.error.hidden = false;
        }
      });
  }

  function bindRequestButtons(mount) {
    if (!mount.els.results) return;
    mount.els.results.querySelectorAll('[data-hmm-request]').forEach(function (btn) {
      if (btn.dataset.hmmBound === '1') return;
      btn.dataset.hmmBound = '1';
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-hmm-request');
        var person = findPerson(id);
        if (person) requestIntro(person, mount);
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
          var liveMeta = Object.assign({ source: 'live' }, data.meta || {});
          paintAll(data.matches, query, liveMeta);
        } else if (result.status === 401 || result.status === 403) {
          if (err) {
            err.textContent = (data && data.message) || 'Sign in as an admin to use Hubert Matchmaker.';
            err.hidden = false;
          }
          paintAll([], query, null);
        } else {
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

  function renderIntroRow(intro) {
    var who =
      intro.direction === 'inbound'
        ? intro.requesterDisplayName || 'Someone'
        : intro.counterpartDisplayName || 'Someone';
    var status = String(intro.status || 'pending');
    return (
      '<li class="hmm-intro-row" data-intro-id="' +
      esc(intro.id) +
      '">' +
      '<div class="hmm-intro-row-main">' +
      '<strong>' +
      esc(who) +
      '</strong>' +
      '<span class="hmm-intro-status hmm-intro-status--' +
      esc(status) +
      '">' +
      esc(status) +
      '</span>' +
      '<p class="hmm-intro-topic">' +
      esc(intro.topic || '') +
      '</p>' +
      '</div>' +
      (status === 'accepted'
        ? '<button type="button" class="ad-btn ad-btn-ghost hmm-intro-open" data-hmm-open-thread="' +
          esc(intro.id) +
          '">Open thread</button>'
        : '') +
      '</li>'
    );
  }

  function renderThread(panel, payload) {
    if (!panel) return;
    var messages = (payload && payload.messages) || [];
    var intro = (payload && payload.intro) || {};
    panel.hidden = false;
    panel.innerHTML =
      '<div class="hmm-thread">' +
      '<div class="hmm-thread-head">' +
      '<p class="hmm-thread-kicker">Hubert intro</p>' +
      '<h3 class="hmm-thread-title">' +
      esc(intro.counterpartDisplayName || intro.requesterDisplayName || 'Introduction') +
      '</h3>' +
      '<p class="hmm-thread-topic">' +
      esc(intro.topic || '') +
      '</p>' +
      '</div>' +
      '<ul class="hmm-thread-messages" role="list">' +
      messages
        .map(function (m) {
          var kind = m.senderKind === 'hubert' ? 'hubert' : m.mine ? 'mine' : 'theirs';
          return (
            '<li class="hmm-thread-msg hmm-thread-msg--' +
            kind +
            '">' +
            '<p>' +
            esc(m.body) +
            '</p>' +
            '</li>'
          );
        })
        .join('') +
      '</ul>' +
      '<form class="hmm-thread-compose" data-hmm-thread-form data-intro-id="' +
      esc(intro.id) +
      '">' +
      '<label class="visually-hidden" for="hmm-thread-input">Message</label>' +
      '<textarea id="hmm-thread-input" class="hmm-thread-input" rows="2" maxlength="1000" placeholder="Continue here — no email, phone, or LinkedIn" required></textarea>' +
      '<button type="submit" class="ad-btn ad-btn-primary">Send</button>' +
      '<p class="hmm-thread-note">Contact details stay off this thread.</p>' +
      '</form>' +
      '</div>';

    var form = panel.querySelector('[data-hmm-thread-form]');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var ta = form.querySelector('textarea');
        var body = ta ? String(ta.value || '').trim() : '';
        if (!body) return;
        fetch('/api/auth/hubert-matchmaker', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'post_message', introId: intro.id, body: body }),
        })
          .then(function (res) {
            return res.json();
          })
          .then(function (data) {
            if (data && data.ok) openThread(intro.id);
            else window.alert((data && data.message) || 'Could not send that message.');
          })
          .catch(function () {
            window.alert('Connection issue — try again.');
          });
      });
    }
  }

  function openThread(introId) {
    var panel = document.querySelector('[data-hmm-thread]');
    if (!panel) return;
    panel.hidden = false;
    panel.innerHTML = '<p class="hmm-preview-note">Opening intro thread…</p>';
    fetch('/api/auth/hubert-matchmaker?action=thread&introId=' + encodeURIComponent(introId), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok) renderThread(panel, data);
        else {
          panel.innerHTML =
            '<p class="hmm-error" role="alert">' +
            esc((data && data.message) || 'Could not open that thread.') +
            '</p>';
        }
      })
      .catch(function () {
        panel.innerHTML = '<p class="hmm-error" role="alert">Connection issue loading the thread.</p>';
      });
  }

  var DEFAULT_LOOKING = [
    'Clients',
    'Investors',
    'Co-founders',
    'Hires',
    'Suppliers',
    'Mentors',
    'Partners',
    'Press',
  ];
  var NUDGE_KEY = 'hmm_profile_nudge_dismissed_v1';

  function renderLookingChips(wrap, options, selected) {
    if (!wrap) return;
    var list = Array.isArray(options) && options.length ? options : DEFAULT_LOOKING;
    var selectedSet = {};
    (Array.isArray(selected) ? selected : []).forEach(function (s) {
      selectedSet[String(s).toLowerCase()] = true;
    });
    wrap.innerHTML = list
      .map(function (label) {
        var checked = selectedSet[String(label).toLowerCase()] ? ' checked' : '';
        return (
          '<label class="hmm-profile-chip">' +
          '<input type="checkbox" value="' +
          esc(label) +
          '"' +
          checked +
          ' />' +
          '<span>' +
          esc(label) +
          '</span>' +
          '</label>'
        );
      })
      .join('');
  }

  function selectedLookingFrom(wrap) {
    if (!wrap) return [];
    return Array.prototype.map
      .call(wrap.querySelectorAll('input[type="checkbox"]:checked'), function (el) {
        return el.value;
      })
      .filter(Boolean);
  }

  function setProfileStatus(ok, message) {
    var status = document.querySelector('[data-hmm-profile-status]');
    var err = document.querySelector('[data-hmm-profile-error]');
    if (err) {
      err.hidden = ok || !message;
      err.textContent = ok ? '' : message || '';
    }
    if (status) {
      status.hidden = !ok || !message;
      status.textContent = ok ? message || '' : '';
    }
  }

  function updateProfileNudge(profile) {
    var nudge = document.querySelector('[data-hmm-profile-nudge]');
    if (!nudge) return;
    var dismissed = false;
    try {
      dismissed = window.localStorage.getItem(NUDGE_KEY) === '1';
    } catch (e) {
      dismissed = false;
    }
    var incomplete = !(profile && profile.matchmakerReady);
    nudge.hidden = !incomplete || dismissed;
  }

  function fillProfilePanel(profile) {
    var blurb = document.querySelector('[data-hmm-profile-blurb]');
    var looking = document.querySelector('[data-hmm-profile-looking]');
    var disc = document.querySelector('[data-hmm-profile-discoverable]');
    if (blurb) blurb.value = (profile && profile.matchmakerBlurb) || '';
    renderLookingChips(
      looking,
      (profile && profile.lookingToMeetOptions) || DEFAULT_LOOKING,
      (profile && profile.lookingToMeet) || []
    );
    if (disc) disc.checked = Boolean(profile && profile.discoverable);
    updateProfileNudge(profile || {});
    if (profile && profile.matchmakerReady) {
      setProfileStatus(true, 'You’re ready for Hubert to put you forward.');
    } else {
      setProfileStatus(true, '');
    }
  }

  function loadMatchmakerProfile() {
    var panel = document.querySelector('[data-hmm-profile-panel]');
    if (!panel) return;
    fetch('/api/auth/profile', { credentials: 'include' })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok) return;
        fillProfileForm(data.profile || {});
      })
      .catch(function () {
        /* optional */
      });
  }

  function saveMatchmakerProfile(e) {
    if (e) e.preventDefault();
    var blurbEl = document.querySelector('[data-hmm-profile-blurb]');
    var looking = document.querySelector('[data-hmm-profile-looking]');
    var disc = document.querySelector('[data-hmm-profile-discoverable]');
    var saveBtn = document.querySelector('[data-hmm-profile-save]');
    var payload = {
      matchmakerBlurb: blurbEl ? String(blurbEl.value || '').trim() : '',
      lookingToMeet: selectedLookingFrom(looking),
      discoverable: Boolean(disc && disc.checked),
    };
    if (saveBtn) saveBtn.disabled = true;
    setProfileStatus(true, 'Saving…');
    fetch('/api/auth/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { status: res.status, data: data };
        });
      })
      .then(function (result) {
        var data = result.data || {};
        if (!data.ok) {
          setProfileStatus(false, (data && data.message) || 'Could not save your profile.');
          return;
        }
        fillProfileForm(data.profile || {});
        setProfileStatus(true, 'Profile saved.');
        try {
          if (data.profile && data.profile.matchmakerReady) {
            window.localStorage.setItem(NUDGE_KEY, '1');
          }
        } catch (err) {
          /* ignore */
        }
      })
      .catch(function () {
        setProfileStatus(false, 'Connection issue — try again.');
      })
      .finally(function () {
        if (saveBtn) saveBtn.disabled = false;
      });
  }

  function bindProfilePanel() {
    var form = document.querySelector('[data-hmm-profile-form]');
    if (form && form.dataset.hmmBound !== '1') {
      form.dataset.hmmBound = '1';
      form.addEventListener('submit', saveMatchmakerProfile);
    }
    var openBtn = document.querySelector('[data-hmm-profile-nudge-open]');
    if (openBtn && openBtn.dataset.hmmBound !== '1') {
      openBtn.dataset.hmmBound = '1';
      openBtn.addEventListener('click', function () {
        var panel = document.querySelector('[data-hmm-profile-panel]');
        if (panel && panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        var blurb = document.querySelector('[data-hmm-profile-blurb]');
        if (blurb) blurb.focus();
      });
    }
    var dismissBtn = document.querySelector('[data-hmm-profile-nudge-dismiss]');
    if (dismissBtn && dismissBtn.dataset.hmmBound !== '1') {
      dismissBtn.dataset.hmmBound = '1';
      dismissBtn.addEventListener('click', function () {
        try {
          window.localStorage.setItem(NUDGE_KEY, '1');
        } catch (e) {
          /* ignore */
        }
        var nudge = document.querySelector('[data-hmm-profile-nudge]');
        if (nudge) nudge.hidden = true;
      });
    }
  }

  function loadMyIntros() {
    var listEl = document.querySelector('[data-hmm-intros]');
    if (!listEl) return;
    fetch('/api/auth/hubert-matchmaker?action=list', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok) {
          listEl.hidden = true;
          return;
        }
        var rows = [].concat(data.outbound || [], data.inbound || []);
        if (!rows.length) {
          listEl.hidden = true;
          listEl.innerHTML = '';
          return;
        }
        (data.outbound || []).forEach(function (intro) {
          // Best-effort: mark pending targets if we still have matches painted
          if (intro.status === 'pending') {
            lastMatches.forEach(function (p) {
              if (intro.counterpartDisplayName && personLabel(p) === intro.counterpartDisplayName) {
                pendingByTarget[p.id] = intro.id;
              }
            });
          }
        });
        listEl.hidden = false;
        listEl.innerHTML =
          '<h3 class="hmm-intros-title">My intros</h3>' +
          '<ul class="hmm-intros-list">' +
          rows.map(renderIntroRow).join('') +
          '</ul>';
        listEl.querySelectorAll('[data-hmm-open-thread]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            openThread(btn.getAttribute('data-hmm-open-thread'));
          });
        });
      })
      .catch(function () {
        /* silent — intros panel is optional enrichment */
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
      invitePanel: root.querySelector('[data-hmm-invite-panel]'),
      inviteCta: root.querySelector('[data-hmm-invite]'),
      inviteForm: root.querySelector('[data-hmm-invite-form]'),
      inviteName: root.querySelector('[data-hmm-invite-name]'),
      inviteEmail: root.querySelector('[data-hmm-invite-email]'),
      inviteNote: root.querySelector('[data-hmm-invite-note]'),
      inviteError: root.querySelector('[data-hmm-invite-error]'),
      inviteQuota: root.querySelector('[data-hmm-invite-quota]'),
      inviteCancel: root.querySelector('[data-hmm-invite-cancel]'),
      inviteSubmit: root.querySelector('[data-hmm-invite-submit]'),
      inviteDone: root.querySelector('[data-hmm-invite-done]'),
    };
  }

  function setInviteError(mount, message) {
    var err = mount.els.inviteError;
    if (!err) return;
    if (message) {
      err.textContent = message;
      err.hidden = false;
    } else {
      err.textContent = '';
      err.hidden = true;
    }
  }

  function openInviteForm(mount) {
    if (!mount.els.inviteForm) return;
    if (mount.els.inviteCta) mount.els.inviteCta.hidden = true;
    if (mount.els.inviteDone) {
      mount.els.inviteDone.hidden = true;
      mount.els.inviteDone.textContent = '';
    }
    setInviteError(mount, '');
    mount.els.inviteForm.hidden = false;
    if (mount.els.inviteName) mount.els.inviteName.focus();
    refreshInviteQuota(mount);
  }

  function closeInviteForm(mount) {
    if (!mount.els.inviteForm) return;
    mount.els.inviteForm.hidden = true;
    if (mount.els.inviteCta) mount.els.inviteCta.hidden = false;
    setInviteError(mount, '');
  }

  function refreshInviteQuota(mount) {
    var quotaEl = mount.els.inviteQuota;
    if (!quotaEl) return;
    fetch('/api/auth/hubert-matchmaker', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invite_quota' }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { status: res.status, data: data };
        });
      })
      .then(function (result) {
        var data = result.data || {};
        if (!data.ok) {
          quotaEl.hidden = true;
          return;
        }
        var remaining = Number(data.remaining);
        var cap = Number(data.cap);
        if (!isFinite(remaining) || !isFinite(cap)) {
          quotaEl.hidden = true;
          return;
        }
        quotaEl.hidden = false;
        quotaEl.textContent =
          remaining <= 0
            ? 'You’ve used your ' + cap + ' introductions this week.'
            : remaining + ' of ' + cap + ' introductions left this week.';
      })
      .catch(function () {
        quotaEl.hidden = true;
      });
  }

  function submitInvite(mount) {
    var name = mount.els.inviteName ? String(mount.els.inviteName.value || '').trim() : '';
    var email = mount.els.inviteEmail ? String(mount.els.inviteEmail.value || '').trim() : '';
    var note = mount.els.inviteNote ? String(mount.els.inviteNote.value || '').trim() : '';
    setInviteError(mount, '');
    if (!name || name.length < 2) {
      setInviteError(mount, 'Add their name.');
      return;
    }
    if (!email) {
      setInviteError(mount, 'Add a valid email address.');
      return;
    }

    var submitBtn = mount.els.inviteSubmit;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
    }

    fetch('/api/auth/hubert-matchmaker', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'invite',
        inviteeName: name,
        inviteeEmail: email,
        note: note,
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { status: res.status, data: data };
        });
      })
      .then(function (result) {
        var data = result.data || {};
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send invite';
        }
        if (!data.ok) {
          setInviteError(mount, (data && data.message) || 'Hubert couldn’t send that invite just now.');
          if (data.error === 'quota_exceeded') refreshInviteQuota(mount);
          return;
        }
        if (mount.els.inviteForm) {
          mount.els.inviteForm.reset();
          mount.els.inviteForm.hidden = true;
        }
        if (mount.els.inviteCta) mount.els.inviteCta.hidden = false;
        if (mount.els.inviteDone) {
          mount.els.inviteDone.hidden = false;
          mount.els.inviteDone.textContent =
            'Invite sent to ' +
            (data.inviteeName || name) +
            '. They’ll get an email from Hubert to join The Networker UK.';
        }
        refreshInviteQuota(mount);
      })
      .catch(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send invite';
        }
        setInviteError(mount, 'Hubert couldn’t send that invite just now. Try again shortly.');
      });
  }

  function bindInvite(mount) {
    var panel = mount.els.invitePanel;
    if (!panel || panel.dataset.hmmInviteBound === '1') return;
    panel.dataset.hmmInviteBound = '1';

    if (mount.els.inviteCta) {
      mount.els.inviteCta.addEventListener('click', function () {
        openInviteForm(mount);
      });
    }
    if (mount.els.inviteCancel) {
      mount.els.inviteCancel.addEventListener('click', function () {
        closeInviteForm(mount);
      });
    }
    if (mount.els.inviteForm) {
      mount.els.inviteForm.addEventListener('submit', function (e) {
        e.preventDefault();
        submitInvite(mount);
      });
    }
  }

  function bind(mount) {
    var form = mount.els.form;
    if (form && form.dataset.hmmBound !== '1') {
      form.dataset.hmmBound = '1';
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        runSearch(mount);
      });
    }
    bindInvite(mount);
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

  function maybeOpenIntroFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      var introId = params.get('intro');
      if (!introId && window.location.hash.indexOf('intro=') !== -1) {
        var hashParams = new URLSearchParams(window.location.hash.replace(/^#meet\??/, '').replace(/^#/, ''));
        introId = hashParams.get('intro');
      }
      if (introId) openThread(introId);
    } catch (e) {
      /* ignore */
    }
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
        if (options && typeof options.onOverviewSearch === 'function') {
          options.onOverviewSearch(query);
        }
      },
    });

    bindProfilePanel();
    loadMatchmakerProfile();
    loadMyIntros();
    maybeOpenIntroFromUrl();

    if (lastQuery) {
      mounts.forEach(function (m) {
        if (m.els.input) m.els.input.value = lastQuery;
        setResults(m, lastMatches.length ? lastMatches : stubShortlist(lastQuery), lastQuery, {
          source: lastMatches.length ? 'live' : 'stub',
        });
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
    TOPIC_MIN_LEN: TOPIC_MIN_LEN,
    HUBERT_ICON: HUBERT_ICON,
    isMatchmakerPublic: isMatchmakerPublic,
    canUseMatchmaker: canUseMatchmaker,
    shortDisplayName: shortDisplayName,
    emptyStateCopy: emptyStateCopy,
    init: init,
    render: render,
    search: search,
    openThread: openThread,
    _stubShortlist: stubShortlist,
    _parseTargetId: function (id) {
      return /^(member|seed):[0-9a-f-]{36}$/i.test(String(id || ''));
    },
  };
})();
