/**
 * My events — Eventbrite connect as a series-style dropdown:
 * Connect → events list expands → Import on each row.
 */
(function () {
  'use strict';

  var expanded = false;
  var connected = false;
  var loading = false;
  var importingIds = {};

  function qs(id) {
    return document.getElementById(id);
  }

  function patchProviders(body) {
    return fetch('/api/organiser/connected-booking-providers', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.json().then(function (data) {
        return { ok: r.ok, status: r.status, data: data || {} };
      });
    });
  }

  function setMsg(text, kind) {
    var el = qs('org-eb-msg');
    if (!el) return;
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'org-eb-msg';
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.className = 'org-eb-msg' + (kind ? ' org-eb-msg--' + kind : '');
  }

  function formatWhen(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_e) {
      return '';
    }
  }

  function organiserPages() {
    var sel = qs('filter-events-group');
    var pages = [];
    if (sel) {
      Array.prototype.forEach.call(sel.options || [], function (opt) {
        var id = String(opt.value || '').trim();
        if (!id || id === 'all') return;
        pages.push({ id: id, name: String(opt.textContent || '').trim() || id });
      });
    }
    return pages;
  }

  function selectedGroupId() {
    var sel = qs('org-eb-group');
    if (sel && sel.value) return String(sel.value).trim();
    var pages = organiserPages();
    return pages.length ? pages[0].id : '';
  }

  function fillGroupSelect(preferredId) {
    var sel = qs('org-eb-group');
    if (!sel) return;
    var pages = organiserPages();
    var prev = preferredId || sel.value || '';
    sel.innerHTML = '';
    if (!pages.length) {
      var empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'Create an organiser page first';
      sel.appendChild(empty);
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    pages.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
    if (prev && pages.some(function (p) { return p.id === prev; })) {
      sel.value = prev;
    }
  }

  function setExpanded(next) {
    expanded = Boolean(next);
    var root = qs('org-eb-panel');
    var panel = qs('org-eb-dropdown');
    var trigger = qs('org-eb-trigger');
    if (root) root.classList.toggle('is-expanded', expanded);
    if (panel) panel.hidden = !expanded;
    if (trigger) {
      trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      var chev = trigger.querySelector('.org-eb-chev');
      if (chev) chev.textContent = expanded ? '▾' : '▸';
    }
  }

  function setConnectedUi(isConnected) {
    connected = Boolean(isConnected);
    var pill = qs('org-eb-status');
    var connectBtn = qs('org-eb-connect');
    var refreshBtn = qs('org-eb-refresh');
    var dedupeBtn = qs('org-eb-dedupe');
    var tokenWrap = qs('org-eb-token-wrap');
    var label = qs('org-eb-trigger-label');
    if (pill) {
      pill.textContent = connected ? 'Connected' : 'Not connected';
      pill.classList.toggle('org-eb-status--ready', connected);
    }
    if (connectBtn) {
      connectBtn.hidden = false;
      connectBtn.textContent = connected ? 'Reconnect' : 'Connect Eventbrite';
      connectBtn.classList.toggle('org-btn-primary', !connected);
      connectBtn.classList.toggle('org-btn-outline', connected);
    }
    if (refreshBtn) refreshBtn.hidden = !connected;
    if (dedupeBtn) dedupeBtn.hidden = !connected;
    if (tokenWrap) tokenWrap.hidden = connected;
    if (label) {
      label.textContent = connected ? 'Eventbrite events' : 'Connect Eventbrite';
    }
  }

  function renderEvents(events) {
    var list = qs('org-eb-event-list');
    var empty = qs('org-eb-empty');
    if (!list) return;
    list.innerHTML = '';
    var rows = Array.isArray(events) ? events : [];
    if (empty) empty.hidden = rows.length > 0;
    rows.forEach(function (evt) {
      var li = document.createElement('li');
      li.className = 'org-eb-event';
      var meta = [formatWhen(evt.start), evt.venue || (evt.online ? 'Online' : '')]
        .filter(Boolean)
        .join(' · ');
      var already = Boolean(evt.alreadyLinked);
      li.innerHTML =
        '<div class="org-eb-event-copy">' +
        '<strong></strong>' +
        '<span class="org-eb-event-meta"></span>' +
        '</div>' +
        '<button type="button" class="org-btn org-btn-sm org-btn-outline org-eb-import-btn"></button>';
      li.querySelector('strong').textContent = evt.title || 'Eventbrite event';
      li.querySelector('.org-eb-event-meta').textContent =
        meta || (already ? 'Already on The Networker UK' : '');
      var btn = li.querySelector('button');
      var extId = String(evt.id || '');
      var inFlight = Boolean(importingIds[extId]);
      btn.textContent = already ? 'Already linked' : inFlight ? 'Importing…' : 'Import';
      btn.disabled = already || inFlight;
      if (!already) {
        btn.addEventListener('click', function () {
          importEvent(extId, btn);
        });
      }
      list.appendChild(li);
    });
  }

  function refreshEvents() {
    if (loading) return Promise.resolve();
    loading = true;
    setMsg('Loading Eventbrite events…');
    return patchProviders({ action: 'list_eventbrite_events' })
      .then(function (res) {
        loading = false;
        if (!res.ok) {
          setMsg(res.data.message || res.data.error || 'Could not load Eventbrite events.', 'error');
          return;
        }
        setConnectedUi(true);
        setExpanded(true);
        renderEvents(res.data.events || []);
        setMsg(
          (res.data.events || []).length
            ? 'Pick an event and click Import.'
            : 'No live Eventbrite events found for this account.',
          'ok'
        );
      })
      .catch(function () {
        loading = false;
        setMsg('Could not load Eventbrite events.', 'error');
      });
  }

  function importEvent(externalEventId, btn) {
    var groupId = selectedGroupId();
    if (!groupId) {
      setMsg('Choose an organiser page first (or create one under Organiser pages).', 'error');
      return;
    }
    if (!externalEventId) return;
    if (importingIds[externalEventId]) return;
    importingIds[externalEventId] = true;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Importing…';
    }
    setMsg('Importing…');
    patchProviders({
      action: 'create_from_eventbrite',
      groupId: groupId,
      externalEventId: externalEventId,
    })
      .then(function (res) {
        if (!res.ok) {
          delete importingIds[externalEventId];
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'Import';
          }
          setMsg(res.data.message || res.data.error || 'Could not import that event.', 'error');
          return;
        }
        if (res.data.alreadyLinked) {
          setMsg(res.data.message || 'Already linked on The Networker UK.', 'ok');
          refreshEvents();
          return;
        }
        var eventId = String(res.data.eventId || '').trim();
        var published = Boolean(res.data.published);
        setMsg(
          res.data.message ||
            (published
              ? 'Imported and published.'
              : 'Imported as a draft.'),
          'ok'
        );
        if (typeof window.refreshOrganiserEvents === 'function') {
          try {
            window.refreshOrganiserEvents();
          } catch (_e) {
            /* ignore */
          }
        }
        if (!eventId) {
          refreshEvents();
          return;
        }
        if (published) {
          window.location.href = '/organiser/event-edit?id=' + encodeURIComponent(eventId);
          return;
        }
        window.location.href =
          '/organiser/event-connected-setup?eventId=' +
          encodeURIComponent(eventId) +
          '&provider=eventbrite';
      })
      .catch(function () {
        delete importingIds[externalEventId];
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Import';
        }
        setMsg('Could not import that event.', 'error');
      });
  }

  function dedupeImports() {
    setMsg('Checking for duplicate Eventbrite imports…');
    return patchProviders({ action: 'dedupe_eventbrite_imports' })
      .then(function (res) {
        if (!res.ok) {
          setMsg(res.data.message || res.data.error || 'Could not clean duplicates.', 'error');
          return;
        }
        var n = Number(res.data.unpublished) || 0;
        setMsg(
          res.data.message ||
            (n ? 'Unpublished ' + n + ' duplicate listing' + (n === 1 ? '' : 's') + '.' : 'No duplicates found.'),
          'ok'
        );
        if (typeof window.refreshOrganiserEvents === 'function') {
          try {
            window.refreshOrganiserEvents();
          } catch (_e) {
            /* ignore */
          }
        }
      })
      .catch(function () {
        setMsg('Could not clean duplicates.', 'error');
      });
  }

  function startOAuth() {
    var groupId = selectedGroupId();
    if (!groupId) {
      setMsg('Create an organiser page first, then connect Eventbrite.', 'error');
      setExpanded(true);
      return;
    }
    var btn = qs('org-eb-connect');
    if (btn) btn.disabled = true;
    setMsg('Opening Eventbrite…');
    patchProviders({
      action: 'start_eventbrite_oauth',
      groupId: groupId,
      returnPath: '/organiser/#events-list',
    })
      .then(function (res) {
        if (btn) btn.disabled = false;
        if (!res.ok) {
          setExpanded(true);
          var tokenInput = qs('org-eb-token');
          if (tokenInput && tokenInput.focus) {
            try {
              tokenInput.focus();
            } catch (_e) {
              /* ignore */
            }
          }
          setMsg(
            res.data.message ||
              res.data.error ||
              'OAuth unavailable — paste a private token below, then Connect.',
            'error'
          );
          return;
        }
        if (res.data.authorizeUrl) {
          window.location.href = res.data.authorizeUrl;
          return;
        }
        setMsg('Could not start Eventbrite connect.', 'error');
      })
      .catch(function () {
        if (btn) btn.disabled = false;
        setMsg('Could not start Eventbrite connect.', 'error');
      });
  }

  function saveToken() {
    var input = qs('org-eb-token');
    var token = input ? String(input.value || '').trim() : '';
    if (!token) {
      setMsg('Paste your Eventbrite private token first.', 'error');
      return;
    }
    var groupId = selectedGroupId();
    var btn = qs('org-eb-save-token');
    if (btn) btn.disabled = true;
    setMsg('Connecting…');
    patchProviders({
      action: 'save_eventbrite_private_token',
      token: token,
      groupId: groupId,
    })
      .then(function (res) {
        if (btn) btn.disabled = false;
        if (!res.ok) {
          setMsg(res.data.message || res.data.error || 'Could not save token.', 'error');
          return;
        }
        if (input) input.value = '';
        setConnectedUi(true);
        setExpanded(true);
        var sync = res.data.orgSync || {};
        var created = Number(sync.created) || 0;
        setMsg(
          created
            ? 'Connected. Imported ' + created + ' event' + (created === 1 ? '' : 's') + '.'
            : 'Connected. Loading your Eventbrite events…',
          'ok'
        );
        return refreshEvents();
      })
      .catch(function () {
        if (btn) btn.disabled = false;
        setMsg('Could not save token.', 'error');
      });
  }

  function consumeOAuthReturnParams() {
    try {
      var params = new URLSearchParams(window.location.search);
      var status = String(params.get('eb_oauth') || '').trim();
      if (!status) return null;
      var imported = Number(params.get('eb_imported') || 0) || 0;
      var published = Number(params.get('eb_published') || 0) || 0;
      var error = String(params.get('eb_error') || '').trim();
      params.delete('eb_oauth');
      params.delete('eb_imported');
      params.delete('eb_published');
      params.delete('eb_webhook');
      params.delete('eb_attendees');
      params.delete('eb_error');
      var next =
        window.location.pathname +
        (params.toString() ? '?' + params.toString() : '') +
        (window.location.hash || '#events-list');
      window.history.replaceState({}, '', next);
      return { status: status, imported: imported, published: published, error: error };
    } catch (_e) {
      return null;
    }
  }

  function loadConnectionState() {
    return fetch('/api/organiser/connected-booking-providers', {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.ok) return { connected: false, oauthAvailable: false };
        var eb = (data.providers || []).find(function (p) {
          return p && p.id === 'eventbrite';
        });
        var isOn = Boolean(eb && eb.eventbriteApiTokenConfigured);
        var oauthAvailable = Boolean(
          (data.eventbriteOAuth && data.eventbriteOAuth.available) ||
            (eb && eb.eventbriteOAuthAvailable)
        );
        return { connected: isOn, oauthAvailable: oauthAvailable };
      })
      .catch(function () {
        return { connected: false, oauthAvailable: false };
      });
  }

  function onTriggerClick() {
    fillGroupSelect(selectedGroupId());
    if (!connected) {
      setExpanded(true);
      startOAuth();
      return;
    }
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    refreshEvents();
  }

  function init() {
    var root = qs('org-eb-panel');
    if (!root || root.dataset.bound === '1') return;
    root.dataset.bound = '1';

    fillGroupSelect();

    var trigger = qs('org-eb-trigger');
    if (trigger) trigger.addEventListener('click', onTriggerClick);

    var connectBtn = qs('org-eb-connect');
    if (connectBtn) {
      connectBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        fillGroupSelect(selectedGroupId());
        startOAuth();
      });
    }

    var refreshBtn = qs('org-eb-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        refreshEvents();
      });
    }

    var dedupeBtn = qs('org-eb-dedupe');
    if (dedupeBtn && !dedupeBtn.dataset.bound) {
      dedupeBtn.dataset.bound = '1';
      dedupeBtn.addEventListener('click', function () {
        dedupeImports();
      });
    }

    var saveBtn = qs('org-eb-save-token');
    if (saveBtn) saveBtn.addEventListener('click', saveToken);

    document.addEventListener('org:groups-loaded', function () {
      fillGroupSelect(selectedGroupId());
    });

    var gotoEvents = qs('ge-eb-goto-events');
    if (gotoEvents && !gotoEvents.dataset.bound) {
      gotoEvents.dataset.bound = '1';
      gotoEvents.addEventListener('click', function () {
        setTimeout(function () {
          setExpanded(true);
          if (connected) refreshEvents();
        }, 200);
      });
    }

    var oauthReturn = consumeOAuthReturnParams();
    loadConnectionState().then(function (state) {
      setConnectedUi(state.connected);
      if (oauthReturn) {
        if (oauthReturn.status === 'connected') {
          setConnectedUi(true);
          setExpanded(true);
          setMsg(
            oauthReturn.imported
              ? 'Eventbrite connected. Imported ' +
                  oauthReturn.imported +
                  ' event' +
                  (oauthReturn.imported === 1 ? '' : 's') +
                  (oauthReturn.published
                    ? ' (' + oauthReturn.published + ' published).'
                    : '.')
              : 'Eventbrite connected. Loading your events…',
            'ok'
          );
          refreshEvents();
          return;
        }
        setExpanded(true);
        if (oauthReturn.status === 'denied') {
          setMsg('Eventbrite connection was cancelled.', 'error');
        } else if (oauthReturn.status === 'not_configured') {
          setMsg('OAuth not configured — paste a private token below.', 'error');
        } else {
          setMsg(
            'Could not connect Eventbrite' +
              (oauthReturn.error ? ' (' + oauthReturn.error + ')' : '') +
              '.',
            'error'
          );
        }
        return;
      }
      if (state.connected && /events-list/i.test(window.location.hash || '')) {
        /* stay collapsed until they open it — like a series row */
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.HubEventbriteEventsPanel = {
    init: init,
    refresh: refreshEvents,
    expand: function () {
      setExpanded(true);
      if (connected) refreshEvents();
    },
  };
})();
