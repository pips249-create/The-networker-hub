/**
 * Hubert Matchmaker — attendee dashboard Meet people UI.
 * Profile setup is open to every signed-in member.
 * Search / intros stay admin-only until HUBERT_MATCHMAKER_PUBLIC is flipped.
 */
(function () {
  'use strict';

  /** Flip to true (plus deploy) when Matchmaker search is ready for all members. */
  var HUBERT_MATCHMAKER_PUBLIC = false;
  var MAX_SHORTLIST = 5;
  var TOPIC_MIN_LEN = 25;
  var HUBERT_ICON = '/assets/hubert-icon.png';

  var mounts = [];
  var visible = false;
  var searchEnabled = false;
  var lastQuery = '';
  var lastMatches = [];
  var pendingByTarget = {};
  var profileReady = false;
  var lastProfile = null;
  var lastSearchQuota = null;
  var pendingSeedQuery = '';
  var seedQueryConsumed = false;

  function isMatchmakerPublic() {
    return HUBERT_MATCHMAKER_PUBLIC === true;
  }

  function sessionUser(sessionOrUser) {
    return sessionOrUser && sessionOrUser.user ? sessionOrUser.user : sessionOrUser;
  }

  /** Meet people nav + profile form — any signed-in member. */
  function canBuildProfile(sessionOrUser) {
    var user = sessionUser(sessionOrUser);
    return Boolean(user && (user.id || user.email || user.role));
  }

  /** Live search / intro requests — public launch or admin preview. */
  function canUseMatchmaker(sessionOrUser) {
    if (isMatchmakerPublic()) return true;
    var user = sessionUser(sessionOrUser);
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
        industry: 'SaaS',
        company: '',
        why: 'Founder · SaaS — close to “' + q.slice(0, 48) + '”',
        nextEvent: { title: 'Manchester Founders Breakfast', dateLabel: '12 Nov 2026' },
        onHub: true,
      },
      {
        id: 'stub-2',
        fullName: 'Priya Shah',
        role: 'Investor',
        industry: 'Venture capital',
        company: '',
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
        industry: 'Professional services',
        company: '',
        why: 'Service provider in professional services',
        nextEvent: null,
        onHub: false,
      },
      {
        id: 'stub-4',
        fullName: 'Sam Taylor',
        role: 'Recruiter',
        industry: 'HR',
        company: '',
        why: 'Recruiter · HR',
        nextEvent: { title: 'The Business Show London', dateLabel: '11 Nov 2026' },
        onHub: true,
      },
      {
        id: 'stub-5',
        fullName: 'Jordan Lee',
        role: 'Founder',
        industry: 'Professional services',
        company: '',
        why: 'Founder looking for suppliers',
        nextEvent: null,
        onHub: false,
      },
      {
        id: 'stub-6',
        fullName: 'Hidden Extra',
        role: 'Should not show',
        industry: 'Cap test',
        company: '',
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
      ? '<span class="hmm-chip hmm-chip--member">Member</span>'
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
      esc([person.role, person.industry || person.company].filter(Boolean).join(' · ')) +
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
      if (m.needsEventPick) {
        return {
          title: 'Which event did you mean?',
          text: 'A few listings look possible — pick the right one and I’ll introduce people from that room only.',
        };
      }
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
            '” on The Networker UK, but nobody’s booked that I can show. Try another session, or ask who you need by role.',
        };
      }
      if (!titles.length) {
        return {
          title: 'I couldn’t match that event',
          text: 'Try the event name as it appears on The Networker UK — or describe who you need (role, city, problem).',
        };
      }
    }
    if (Number(m.candidateCount || 0) === 0) {
      return {
        title: 'No one came back yet',
        text: 'The member pool is still thin for that ask. Try another description, or check back after more people opt in.',
      };
    }
    return {
      title: 'No close matches yet',
      text:
        'Hubert only puts people forward when the ask fits. Try a clearer role or industry (e.g. “marketing managers who buy ads”), or check back as the pool grows.',
    };
  }

  function clearEventPick(mount) {
    var pick = mount && mount.els && mount.els.eventPick;
    if (!pick) return;
    pick.hidden = true;
    pick.innerHTML = '';
  }

  function renderEventPick(mount, query, meta) {
    var pick = mount && mount.els && mount.els.eventPick;
    if (!pick) return;
    var candidates =
      meta && Array.isArray(meta.eventCandidates) ? meta.eventCandidates.filter(Boolean) : [];
    if (!(meta && meta.needsEventPick) || !candidates.length) {
      clearEventPick(mount);
      return;
    }
    pick.hidden = false;
    pick.innerHTML =
      '<p class="hmm-event-pick-kicker">Confirm the event</p>' +
      '<ul class="hmm-event-pick-list">' +
      candidates
        .map(function (ev) {
          var label = String(ev.title || 'Event');
          var date = ev.dateLabel ? ' · ' + String(ev.dateLabel) : '';
          return (
            '<li>' +
            '<button type="button" class="hmm-event-pick-btn" data-hmm-event-id="' +
            esc(ev.id) +
            '">' +
            '<span class="hmm-event-pick-title">' +
            esc(label) +
            '</span>' +
            (date
              ? '<span class="hmm-event-pick-date">' + esc(String(ev.dateLabel)) + '</span>'
              : '') +
            '</button>' +
            '</li>'
          );
        })
        .join('') +
      '</ul>';
    pick.querySelectorAll('[data-hmm-event-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-hmm-event-id');
        runSearch(mount, query, { eventId: id });
      });
    });
  }

  function setResults(mount, people, query, meta) {
    var results = mount.els.results;
    var empty = mount.els.empty;
    var preview = mount.els.previewNote;
    var shell = mount.els.shell;
    if (!results) return;

    var list = Array.isArray(people) ? people.slice(0, MAX_SHORTLIST) : [];
    if (shell) shell.classList.toggle('is-searched', list.length > 0 || Boolean(query) || Boolean(meta && meta.needsEventPick));

    if (!list.length) {
      results.innerHTML = '';
      results.hidden = true;
      if (empty) {
        applyEmptyCopy(empty, meta);
        empty.hidden = !query && !(meta && meta.needsEventPick);
      }
      renderEventPick(mount, query, meta);
      if (preview) preview.hidden = true;
      return;
    }

    clearEventPick(mount);
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
          ' Matched event: ' +
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

  function fetchMatches(query, opts) {
    var payload = { action: 'search', query: query };
    if (opts && opts.eventId) payload.eventId = opts.eventId;
    return fetch('/api/auth/hubert-matchmaker', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
    if (!searchEnabled) {
      if (mount && mount.els.error) {
        mount.els.error.textContent = 'Intro requests open to everyone soon — finish your profile for now.';
        mount.els.error.hidden = false;
      }
      return;
    }
    if (!person || String(person.id || '').indexOf('stub-') === 0) {
      if (mount && mount.els.error) {
        mount.els.error.textContent = 'Run a live search before requesting an intro.';
        mount.els.error.hidden = false;
      }
      return;
    }
    if (!profileReady) {
      focusProfileGate();
      if (mount && mount.els.error) {
        mount.els.error.textContent = 'Finish your Hubert profile before requesting an intro.';
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

  function runSearch(mount, queryOverride, searchOpts) {
    var input = mount.els.input;
    var query =
      queryOverride != null ? String(queryOverride).trim() : input ? String(input.value || '').trim() : '';
    if (input && queryOverride != null) input.value = query;

    var err = mount.els.error;
    if (err) {
      err.hidden = true;
      err.textContent = '';
    }
    if (!searchEnabled) {
      if (mount.mode === 'overview' && typeof mount.onExpand === 'function') {
        mount.onExpand(query || '');
      }
      focusProfileGate(
        'Search opens to everyone soon — save your Hubert profile (headline, who you want to meet, Include me) so you’re ready.'
      );
      if (err) {
        err.textContent = 'Search isn’t open to everyone yet — build your profile above.';
        err.hidden = false;
      }
      return;
    }
    if (!profileReady) {
      if (mount.mode === 'overview' && typeof mount.onExpand === 'function') {
        mount.onExpand(query || '');
      }
      focusProfileGate();
      if (err) {
        err.textContent = 'Finish your Hubert profile before searching.';
        err.hidden = false;
      }
      return;
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
    clearEventPick(mount);
    if (mount.els.previewNote) {
      mount.els.previewNote.hidden = false;
      mount.els.previewNote.textContent = searchOpts && searchOpts.eventId
        ? 'Hubert is loading that room…'
        : 'Hubert is matching…';
    }

    fetchMatches(query, searchOpts)
      .then(function (result) {
        var data = result.data || {};
        if (data.searchQuota) paintSearchQuota(data.searchQuota);
        if (data.ok && Array.isArray(data.matches)) {
          var liveMeta = Object.assign({ source: 'live' }, data.meta || {});
          paintAll(data.matches, query, liveMeta);
        } else if (data && data.error === 'profile_incomplete') {
          if (data.profile) fillProfileForm(data.profile);
          focusProfileGate(data.message);
          paintAll([], query, null);
          if (err) {
            err.textContent = data.message || 'Finish your Hubert profile before searching.';
            err.hidden = false;
          }
        } else if (data && data.error === 'search_quota_exceeded') {
          paintAll([], query, null);
          if (err) {
            err.textContent =
              (data && data.message) || 'You’ve used this week’s searches. Try again next week.';
            err.hidden = false;
          }
          if (mount.els.previewNote) {
            mount.els.previewNote.hidden = true;
            mount.els.previewNote.textContent = '';
          }
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

  function introWho(intro) {
    return intro.displayName || intro.counterpartDisplayName || intro.requesterDisplayName || 'Someone';
  }

  function renderConnectionRow(intro) {
    return (
      '<li class="hmm-intro-row hmm-intro-row--connection" data-intro-id="' +
      esc(intro.id) +
      '">' +
      '<div class="hmm-intro-row-main">' +
      '<strong class="hmm-connection-name">' +
      esc(introWho(intro)) +
      '</strong>' +
      '<span class="hmm-intro-status hmm-intro-status--connected">Connected</span>' +
      '<p class="hmm-intro-topic">' +
      esc(intro.topic || '') +
      '</p>' +
      (intro.eventTitle
        ? '<p class="hmm-intro-event">' + esc(intro.eventTitle) + '</p>'
        : '') +
      '</div>' +
      '<button type="button" class="ad-btn ad-btn-ghost hmm-intro-open" data-hmm-open-thread="' +
      esc(intro.id) +
      '">Open conversation</button>' +
      '</li>'
    );
  }

  function renderWaitingRow(intro) {
    return (
      '<li class="hmm-intro-row hmm-intro-row--waiting" data-intro-id="' +
      esc(intro.id) +
      '">' +
      '<div class="hmm-intro-row-main">' +
      '<strong>' +
      esc(introWho(intro)) +
      '</strong>' +
      '<span class="hmm-intro-status hmm-intro-status--waiting">' +
      esc(intro.statusLabel || 'Waiting to hear back') +
      '</span>' +
      '<p class="hmm-intro-topic">' +
      esc(intro.topic || '') +
      '</p>' +
      '</div>' +
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
      esc(introWho(intro) || 'Introduction') +
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

  function missingReadyLabels(profile) {
    var missing = (profile && profile.matchmakerMissing) || [];
    var labels = [];
    if (missing.indexOf('headline') !== -1) labels.push('a headline');
    if (missing.indexOf('lookingToMeet') !== -1) labels.push('who you want to meet');
    if (missing.indexOf('discoverable') !== -1) labels.push('Include me');
    return labels;
  }

  function applyProfileGate(profile) {
    lastProfile = profile || null;
    profileReady = Boolean(profile && profile.matchmakerReady);
    var canSearch = searchEnabled && profileReady;
    var panel = document.querySelector('[data-hmm-profile-panel]');
    var ask = document.querySelector('[data-hmm-ask-block]');
    var lockNote = document.querySelector('[data-hmm-ask-lock-note]');
    var invite = document.querySelector('[data-hmm-invite-panel]');
    var heroTitle = document.querySelector('[data-hmm-hero-title]');
    var heroSub = document.querySelector('[data-hmm-hero-sub]');
    var saveBtn = document.querySelector('[data-hmm-profile-save]');
    var pageInput = document.querySelector('#hmm-query');
    var pageSubmit = document.querySelector('.hmm-composer-submit');
    var comingSoon = document.querySelector('[data-hmm-search-soon]');

    if (panel) {
      panel.classList.toggle('hmm-setup--gate', !profileReady);
      panel.classList.toggle('hmm-setup--ready', profileReady);
      panel.hidden = false;
    }
    if (ask) {
      // Search UI only for admins / after public launch.
      ask.hidden = !searchEnabled;
      ask.classList.toggle('hmm-ask-block--locked', searchEnabled && !profileReady);
    }
    if (lockNote) {
      if (!searchEnabled) {
        lockNote.hidden = true;
      } else {
        lockNote.hidden = profileReady;
      }
    }
    if (comingSoon) {
      comingSoon.hidden = searchEnabled || !profileReady;
    }
    if (pageInput) pageInput.disabled = !canSearch;
    if (pageSubmit) pageSubmit.disabled = !canSearch;
    if (invite) invite.hidden = !canSearch;
    if (heroTitle) {
      if (!searchEnabled) {
        heroTitle.textContent = profileReady ? 'You’re in Hubert’s pool' : 'Build your Hubert profile';
      } else {
        heroTitle.textContent = profileReady
          ? 'I can introduce you to the people you need'
          : 'Before I introduce you';
      }
    }
    if (heroSub) {
      if (!searchEnabled) {
        heroSub.textContent = profileReady
          ? 'You’re ready for warm intros. When search opens you’ll ask who you want to meet — and others can request an intro to you. Email, phone, and LinkedIn stay private.'
          : 'I’m Hubert. I find people who can help with what you’re working on — customers, investors, hires, mentors — and introduce you only when you both say yes. No email, phone, or LinkedIn ever changes hands. Tell me who you are and who you want to meet so I can put you forward.';
      } else {
        heroSub.textContent = profileReady
          ? 'Customers, investors, hires, your next role — or someone who’s already solved your problem. Tell me what you’re working on.'
          : 'I’m Hubert. I find people who can help with what you’re working on — customers, investors, hires, mentors — and introduce you only when you both say yes. No email, phone, or LinkedIn ever changes hands. Tell me who you are and who you want to meet so I can put you forward.';
      }
    }
    if (saveBtn) {
      if (!searchEnabled) {
        saveBtn.textContent = profileReady ? 'Save profile' : 'Save profile';
      } else {
        saveBtn.textContent = profileReady ? 'Save profile' : 'Save and continue';
      }
    }

    mounts.forEach(function (m) {
      if (!m || !m.els) return;
      if (m.els.input) m.els.input.disabled = !canSearch;
      if (m.els.form) {
        var submit = m.els.form.querySelector('button[type="submit"]');
        if (submit) submit.disabled = !canSearch;
      }
    });
    if (canSearch) maybeSeedQueryFromUrl();
  }

  function confirmStopIncludingMe() {
    return window.confirm(
      'Stop putting you forward for Hubert intros?\n\nSearch will lock until you include yourself again. Contact details still stay private either way.'
    );
  }

  function syncDiscoverableUi(profile) {
    var wrap = document.querySelector('[data-hmm-discoverable-wrap]');
    var disc = document.querySelector('[data-hmm-profile-discoverable]');
    var offBtn = document.querySelector('[data-hmm-discoverable-off]');
    var hint = document.querySelector('[data-hmm-discoverable-hint]');
    var included = Boolean(disc && disc.checked);
    if (wrap) wrap.classList.toggle('is-included', included);
    if (offBtn) offBtn.hidden = !included;
    if (hint) {
      if (included) {
        hint.textContent =
          'You’re included. Use “Stop including me” if you want to opt out — it won’t untick from a casual click.';
      } else if (searchEnabled) {
        hint.textContent =
          'Required to unlock search. Stays off until you tick it. Turning it off needs confirmation.';
      } else {
        hint.textContent =
          'Required to join Hubert’s pool. Stays off until you tick it. Turning it off needs confirmation.';
      }
    }
    void disc;
    void profile;
  }

  function bindDiscoverableGuard() {
    var wrap = document.querySelector('[data-hmm-discoverable-wrap]');
    var disc = document.querySelector('[data-hmm-profile-discoverable]');
    var offBtn = document.querySelector('[data-hmm-discoverable-off]');
    if (!disc || disc.dataset.hmmGuard === '1') return;
    disc.dataset.hmmGuard = '1';

    // Checkbox click fires after the browser toggles `checked`. Opt-in must be
    // allowed; only block a post-toggle untick (route opt-out through Stop).
    disc.addEventListener('click', function (e) {
      if (disc.checked) {
        syncDiscoverableUi(lastProfile);
        return;
      }
      e.preventDefault();
      disc.checked = true;
      if (offBtn) offBtn.focus();
    });

    // keydown runs before the toggle — block Space/Enter only while already included.
    disc.addEventListener('keydown', function (e) {
      if (!disc.checked) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (offBtn) offBtn.focus();
      }
    });

    if (offBtn && offBtn.dataset.hmmBound !== '1') {
      offBtn.dataset.hmmBound = '1';
      offBtn.addEventListener('click', function () {
        if (!disc.checked) return;
        if (!confirmStopIncludingMe()) return;
        disc.checked = false;
        syncDiscoverableUi(lastProfile);
        setProfileStatus(true, 'Saving…');
        offBtn.disabled = true;
        fetch('/api/auth/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ discoverable: false }),
        })
          .then(function (res) {
            return res.json().then(function (data) {
              return { status: res.status, data: data };
            });
          })
          .then(function (result) {
            var data = result.data || {};
            if (!data.ok) {
              disc.checked = true;
              syncDiscoverableUi(lastProfile);
              setProfileStatus(false, (data && data.message) || 'Could not turn inclusion off.');
              return;
            }
            lastProfile = data.profile || lastProfile;
            fillProfileForm(data.profile || { discoverable: false });
            setProfileStatus(
              false,
              'You’re opted out. Tick Include me and save when you want Hubert to put you forward again.'
            );
          })
          .catch(function () {
            disc.checked = true;
            syncDiscoverableUi(lastProfile);
            setProfileStatus(false, 'Could not turn inclusion off — check your connection.');
          })
          .finally(function () {
            offBtn.disabled = false;
          });
      });
    }

    var label = wrap && wrap.querySelector('label[for="hmm-profile-discoverable"]');
    if (label && label.dataset.hmmBound !== '1') {
      label.dataset.hmmBound = '1';
      label.addEventListener('click', function (e) {
        if (!disc.checked) return;
        e.preventDefault();
        if (offBtn) offBtn.focus();
      });
    }

    if (wrap) {
      wrap.addEventListener('change', function () {
        syncDiscoverableUi(lastProfile);
      });
    }
  }

  function fillProfileForm(profile) {
    lastProfile = profile || null;
    var blurb = document.querySelector('[data-hmm-profile-blurb]');
    var looking = document.querySelector('[data-hmm-profile-looking]');
    var disc = document.querySelector('[data-hmm-profile-discoverable]');
    var prefill =
      (profile && (profile.matchmakerBlurb || profile.matchmakerBlurbPrefill || profile.suggestedBlurb)) ||
      '';
    if (blurb) blurb.value = prefill;
    renderLookingChips(
      looking,
      (profile && profile.lookingToMeetOptions) || DEFAULT_LOOKING,
      (profile && profile.lookingToMeet) || []
    );
    // Include me stays opt-in — pre-check only when they already said yes at signup / Enable.
    if (disc) {
      disc.checked = Boolean(
        profile && (profile.discoverable || profile.preferDiscoverable)
      );
    }
    syncDiscoverableUi(profile || {});
    applyProfileGate(profile || {});
    if (profile && profile.matchmakerReady) {
      setProfileStatus(true, 'You’re ready — ask Hubert who you need.');
    } else if (profile && profile.hubertIntrosInterested) {
      setProfileStatus(true, 'Finish your Hubert profile so introductions can start.');
    } else {
      setProfileStatus(true, '');
    }
  }

  function patchHubertOptIn(payload) {
    return fetch('/api/auth/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload || {}),
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = {};
        if (text) {
          try {
            data = JSON.parse(text);
          } catch (err) {
            return { ok: false };
          }
        }
        return data;
      });
    });
  }

  function hideHubertOptInModal() {
    var modal = document.getElementById('ad-hubert-optin-modal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('ad-hubert-optin-modal-open');
  }

  function showHubertOptInModal() {
    var modal = document.getElementById('ad-hubert-optin-modal');
    if (!modal || modal.dataset.shown === '1') return;
    modal.dataset.shown = '1';
    modal.hidden = false;
    document.body.classList.add('ad-hubert-optin-modal-open');
  }

  function goToHubertSetup() {
    try {
      if (window.location.hash !== '#meet') {
        window.location.hash = 'meet';
      }
    } catch (e) {
      /* ignore */
    }
    var panel = document.querySelector('[data-hmm-profile-gate]');
    if (panel && typeof panel.scrollIntoView === 'function') {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    var blurb = document.querySelector('[data-hmm-profile-blurb]');
    if (blurb) blurb.focus();
  }

  function bindHubertOptInModal() {
    var modal = document.getElementById('ad-hubert-optin-modal');
    if (!modal || modal.dataset.bound === '1') return;
    modal.dataset.bound = '1';
    var enableBtn = document.getElementById('ad-hubert-optin-enable');
    var laterBtn = document.getElementById('ad-hubert-optin-later');
    var closeBtn = document.getElementById('ad-hubert-optin-close');
    var backdrop = document.getElementById('ad-hubert-optin-backdrop');

    function dismissPrompt() {
      hideHubertOptInModal();
      patchHubertOptIn({ hubertIntrosPromptDismiss: true }).catch(function () {});
    }

    function enableIntros() {
      hideHubertOptInModal();
      patchHubertOptIn({ hubertIntrosInterest: true })
        .then(function (data) {
          if (data && data.ok && data.profile) fillProfileForm(data.profile);
          else if (lastProfile) {
            lastProfile.hubertIntrosInterested = true;
            lastProfile.preferDiscoverable = true;
            lastProfile.shouldPromptHubertIntros = false;
            fillProfileForm(lastProfile);
          }
          goToHubertSetup();
        })
        .catch(function () {
          goToHubertSetup();
        });
    }

    if (enableBtn) enableBtn.addEventListener('click', enableIntros);
    if (laterBtn) laterBtn.addEventListener('click', dismissPrompt);
    if (closeBtn) closeBtn.addEventListener('click', dismissPrompt);
    if (backdrop) backdrop.addEventListener('click', dismissPrompt);
  }

  function maybeShowHubertOptIn(profile) {
    if (!profile || !profile.shouldPromptHubertIntros) return;
    // Defer slightly so the dashboard paints first.
    setTimeout(function () {
      showHubertOptInModal();
    }, 450);
  }

  function loadMatchmakerProfile() {
    var panel = document.querySelector('[data-hmm-profile-panel]');
    if (!panel) return;
    var looking = document.querySelector('[data-hmm-profile-looking]');
    if (looking && !looking.querySelector('input[type="checkbox"]')) {
      renderLookingChips(looking, DEFAULT_LOOKING, []);
    }
    fetch('/api/auth/profile', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var data = {};
          if (text) {
            try {
              data = JSON.parse(text);
            } catch (err) {
              return { ok: false, status: res.status };
            }
          }
          return data;
        });
      })
      .then(function (data) {
        if (!data || !data.ok) {
          applyProfileGate(null);
          return;
        }
        fillProfileForm(data.profile || {});
        maybeShowHubertOptIn(data.profile || {});
        if (
          data.profile &&
          data.profile.hubertIntrosInterested &&
          !data.profile.matchmakerReady &&
          /hubert=setup|hubert_setup/i.test(window.location.search + window.location.hash)
        ) {
          goToHubertSetup();
        }
      })
      .catch(function () {
        applyProfileGate(null);
      });
  }

  function saveMatchmakerProfile(e) {
    if (e) e.preventDefault();
    var blurbEl = document.querySelector('[data-hmm-profile-blurb]');
    var looking = document.querySelector('[data-hmm-profile-looking]');
    var disc = document.querySelector('[data-hmm-profile-discoverable]');
    var saveBtn = document.querySelector('[data-hmm-profile-save]');
    if (looking && !looking.querySelector('input[type="checkbox"]')) {
      renderLookingChips(looking, DEFAULT_LOOKING, []);
    }
    var payload = {
      matchmakerBlurb: blurbEl ? String(blurbEl.value || '').trim() : '',
      lookingToMeet: selectedLookingFrom(looking),
      discoverable: Boolean(disc && disc.checked),
    };
    if (!payload.matchmakerBlurb) {
      setProfileStatus(false, 'Add a short headline first.');
      if (blurbEl) blurbEl.focus();
      return;
    }
    if (!payload.lookingToMeet.length) {
      setProfileStatus(false, 'Pick at least one option under “Who you want to meet”.');
      return;
    }
    if (!payload.discoverable) {
      setProfileStatus(false, 'Tick “Include me so Hubert can put me forward” to continue.');
      return;
    }
    if (saveBtn) saveBtn.disabled = true;
    setProfileStatus(true, 'Saving…');
    fetch('/api/auth/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var data = {};
          if (text) {
            try {
              data = JSON.parse(text);
            } catch (err) {
              var parseErr = new Error(
                res.status >= 500
                  ? 'Server error saving profile (' + res.status + '). Try again in a moment.'
                  : 'Could not save profile (unexpected response).'
              );
              parseErr.status = res.status;
              throw parseErr;
            }
          }
          return { status: res.status, data: data };
        });
      })
      .then(function (result) {
        var data = result.data || {};
        if (!data.ok) {
          setProfileStatus(
            false,
            (data && data.message) ||
              (result.status === 401
                ? 'Sign in again, then save your Hubert profile.'
                : 'Could not save your profile.')
          );
          return;
        }
        fillProfileForm(data.profile || {});
        if (data.profile && data.profile.matchmakerReady) {
          if (searchEnabled) {
            setProfileStatus(true, 'Profile saved — search is unlocked below.');
            var ask = document.querySelector('[data-hmm-ask-block]');
            if (ask && ask.scrollIntoView) ask.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (document.querySelector('#hmm-query')) document.querySelector('#hmm-query').focus();
          } else {
            setProfileStatus(
              true,
              'Profile saved — you’re in Hubert’s pool. Search opens to everyone soon.'
            );
            var soon = document.querySelector('[data-hmm-search-soon]');
            if (soon && soon.scrollIntoView) soon.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        } else {
          var needed = missingReadyLabels(data.profile || {});
          setProfileStatus(
            false,
            needed.length
              ? 'Saved, but still need ' +
                  needed.join(', ') +
                  (searchEnabled ? ' before search unlocks.' : ' to finish your Hubert profile.')
              : 'Saved, but Hubert couldn’t confirm your profile yet. Pick who you want to meet, tick Include me, and save again.'
          );
        }
      })
      .catch(function (err) {
        setProfileStatus(
          false,
          (err && err.message) || 'Connection issue — check your network and try again.'
        );
      })
      .finally(function () {
        if (saveBtn) saveBtn.disabled = false;
      });
  }

  function focusProfileGate(message) {
    applyProfileGate(lastProfile || {});
    var panel = document.querySelector('[data-hmm-profile-panel]');
    if (panel && panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setProfileStatus(
      false,
      message || 'Finish your Hubert profile first — headline, who you want to meet, and Include me.'
    );
    var blurb = document.querySelector('[data-hmm-profile-blurb]');
    if (blurb) blurb.focus();
  }

  function bindProfilePanel() {
    var looking = document.querySelector('[data-hmm-profile-looking]');
    // Ensure chips exist (HTML ships a static set; refill if the node was emptied).
    if (looking && !looking.querySelector('input[type="checkbox"]')) {
      renderLookingChips(looking, DEFAULT_LOOKING, []);
    }
    bindDiscoverableGuard();
    var form = document.querySelector('[data-hmm-profile-form]');
    if (form && form.dataset.hmmBound !== '1') {
      form.dataset.hmmBound = '1';
      form.addEventListener('submit', saveMatchmakerProfile);
    }
    syncDiscoverableUi(lastProfile);
    applyProfileGate(lastProfile);
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
        if (data.migrationRequired) {
          listEl.hidden = false;
          listEl.innerHTML =
            '<p class="hmm-error" role="status">Intro tracking isn’t live yet — an admin needs to run migration 335, then reload the schema (337/338).</p>';
          return;
        }
        var connections = Array.isArray(data.connections)
          ? data.connections
          : [].concat(data.outbound || [], data.inbound || []).filter(function (r) {
              return r.status === 'accepted';
            });
        var requests = Array.isArray(data.requests)
          ? data.requests
          : (data.outbound || []).filter(function (r) {
              return r.status === 'pending';
            });

        if (!connections.length && !requests.length) {
          listEl.hidden = true;
          listEl.innerHTML = '';
          return;
        }

        requests.forEach(function (intro) {
          if (intro.status === 'pending') {
            lastMatches.forEach(function (p) {
              if (intro.counterpartDisplayName && personLabel(p) === intro.counterpartDisplayName) {
                pendingByTarget[p.id] = intro.id;
              }
            });
          }
        });

        var html = '';
        if (connections.length) {
          html +=
            '<section class="hmm-connections" data-hmm-connections>' +
            '<p class="hmm-connections-kicker">Your connections</p>' +
            '<h3 class="hmm-intros-title">People you’ve both said yes to</h3>' +
            '<p class="hmm-connections-copy">First names only — email, phone, and LinkedIn stay private.</p>' +
            '<ul class="hmm-intros-list hmm-connections-list">' +
            connections.map(renderConnectionRow).join('') +
            '</ul>' +
            '</section>';
        }
        if (requests.length) {
          html +=
            '<section class="hmm-waiting" data-hmm-waiting>' +
            '<h3 class="hmm-intros-title hmm-intros-title--quiet">Waiting to hear back</h3>' +
            '<ul class="hmm-intros-list hmm-waiting-list">' +
            requests.map(renderWaitingRow).join('') +
            '</ul>' +
            '</section>';
        }

        listEl.hidden = false;
        listEl.innerHTML = html;
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
      eventPick: root.querySelector('[data-hmm-event-pick]'),
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
      searchQuota: root.querySelector('[data-hmm-search-quota]'),
    };
  }

  function paintSearchQuota(quota) {
    if (quota && typeof quota === 'object') {
      lastSearchQuota = quota;
    }
    var q = lastSearchQuota;
    mounts.forEach(function (mount) {
      var el = mount.els && mount.els.searchQuota;
      if (!el) return;
      if (!q || !q.enforced) {
        el.hidden = true;
        el.textContent = '';
        return;
      }
      var remaining = Number(q.remaining);
      var cap = Number(q.cap);
      if (!isFinite(remaining) || !isFinite(cap) || cap <= 0) {
        el.hidden = true;
        return;
      }
      var referral = q.referral || null;
      var unlockHint = '';
      if (referral && !referral.unlocked && Number(referral.remainingToUnlock) > 0) {
        unlockHint =
          ' Invite ' +
          referral.remainingToUnlock +
          ' colleague' +
          (referral.remainingToUnlock === 1 ? '' : 's') +
          ' who join to unlock ' +
          (referral.unlockedSearchCap || 10) +
          '/week.';
      } else if (referral && referral.unlocked) {
        unlockHint = ' Unlocked with referrals.';
      }
      el.hidden = false;
      el.textContent =
        (remaining <= 0
          ? 'You’ve used your ' + cap + ' searches this week.'
          : remaining + ' of ' + cap + ' searches left this week.') + unlockHint;
    });
  }

  function refreshSearchQuota() {
    return fetch('/api/auth/hubert-matchmaker', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'search_quota' }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { status: res.status, data: data };
        });
      })
      .then(function (result) {
        var data = result.data || {};
        if (data.ok) {
          paintSearchQuota({
            used: data.used,
            remaining: data.remaining,
            cap: data.cap,
            enforced: data.enforced !== false,
            searchQuotaPerWeek: data.searchQuotaPerWeek,
            unlocked: data.unlocked,
            referral: data.referral || null,
          });
        }
      })
      .catch(function () {
        /* optional enrichment */
      });
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

  function updateAdminBadges() {
    document.querySelectorAll('[data-hmm-admin-badge]').forEach(function (el) {
      if (isMatchmakerPublic()) {
        el.hidden = true;
        return;
      }
      if (searchEnabled) {
        el.hidden = false;
        el.textContent = 'Admin preview — search not visible to other members yet.';
      } else {
        el.hidden = false;
        el.textContent = 'Build your profile now — search opens to everyone soon.';
      }
    });
  }

  function mountRoot(root, mode, hooks) {
    if (!root) return null;
    // Overview strip is search-only; skip for profile-build members.
    if (mode === 'overview' && !searchEnabled) return null;
    var mount = {
      els: cacheEls(root),
      mode: mode || 'page',
      onExpand: hooks && hooks.onExpand,
    };
    updateAdminBadges();
    bind(mount);
    mounts.push(mount);
    return mount;
  }

  function parseMeetQueryFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      var q = params.get('q') || params.get('query');
      if (!q && window.location.hash) {
        var raw = String(window.location.hash || '').replace(/^#/, '');
        var queryPart = raw;
        if (raw.indexOf('meet?') === 0) queryPart = raw.slice(5);
        else if (raw.indexOf('meet&') === 0) queryPart = raw.slice(5);
        else if (raw === 'meet') queryPart = '';
        if (queryPart) {
          var hashParams = new URLSearchParams(queryPart.charAt(0) === '?' ? queryPart.slice(1) : queryPart);
          q = hashParams.get('q') || hashParams.get('query');
        }
      }
      q = String(q || '').trim();
      return q ? q.slice(0, 240) : '';
    } catch (e) {
      return '';
    }
  }

  function maybeSeedQueryFromUrl() {
    if (seedQueryConsumed) return;
    var q = pendingSeedQuery || parseMeetQueryFromUrl();
    if (!q) return;
    pendingSeedQuery = q;
    mounts.forEach(function (m) {
      if (m.els && m.els.input) m.els.input.value = q;
    });
    if (!profileReady || !mounts.length) return;
    seedQueryConsumed = true;
    pendingSeedQuery = '';
    runSearch(mounts[0], q);
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
    visible = canBuildProfile(session);
    searchEnabled = canUseMatchmaker(session);
    setNavVisibility(visible);
    // Overview ask strip is live search — keep admin/public only.
    setOverviewVisibility(searchEnabled);
    updateAdminBadges();

    if (!visible) {
      return { visible: false, searchEnabled: false };
    }

    var meetPage = document.getElementById('ad-page-meet');
    var overview = document.getElementById('ad-overview-hubert-meet');

    mountRoot(meetPage, 'page');
    if (searchEnabled) {
      mountRoot(overview, 'overview', {
        onExpand: function (query) {
          if (options && typeof options.onOverviewSearch === 'function') {
            options.onOverviewSearch(query);
          }
        },
      });
    }

    bindProfilePanel();
    bindHubertOptInModal();
    loadMatchmakerProfile();
    if (searchEnabled) {
      loadMyIntros();
      refreshSearchQuota();
      maybeOpenIntroFromUrl();
      maybeSeedQueryFromUrl();
    }

    if (searchEnabled && lastQuery) {
      mounts.forEach(function (m) {
        if (m.els.input) m.els.input.value = lastQuery;
        setResults(m, lastMatches.length ? lastMatches : stubShortlist(lastQuery), lastQuery, {
          source: lastMatches.length ? 'live' : 'stub',
        });
      });
    }

    return { visible: true, searchEnabled: searchEnabled };
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
    canBuildProfile: canBuildProfile,
    canUseMatchmaker: canUseMatchmaker,
    shortDisplayName: shortDisplayName,
    emptyStateCopy: emptyStateCopy,
    init: init,
    render: render,
    search: search,
    openThread: openThread,
    _stubShortlist: stubShortlist,
    _parseMeetQueryFromUrl: parseMeetQueryFromUrl,
    _parseTargetId: function (id) {
      return /^(member|seed):[0-9a-f-]{36}$/i.test(String(id || ''));
    },
  };
})();
