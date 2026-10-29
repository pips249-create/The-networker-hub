/**
 * Organiser page — connect Eventbrite (OAuth primary) and import events onto this page.
 * Works on standalone /organiser/group-edit and the workspace Edit drawer.
 */
(function () {
  'use strict';

  var activeGroupId = '';

  function qs(id) {
    return document.getElementById(id);
  }

  function groupIdFromPage() {
    if (activeGroupId) return activeGroupId;
    try {
      var params = new URLSearchParams(window.location.search);
      var fromQuery = String(params.get('id') || params.get('groupId') || '').trim();
      if (fromQuery) return fromQuery;
    } catch (_e) {
      /* ignore */
    }
    var card = qs('ge-booking-card');
    if (card) {
      var fromAttr = String(card.getAttribute('data-group-id') || '').trim();
      if (fromAttr) return fromAttr;
    }
    return '';
  }

  function setMsg(text, kind) {
    var el = qs('ge-eb-msg');
    if (!el) return;
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'ge-booking-msg';
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.className = 'ge-booking-msg' + (kind ? ' ge-booking-msg--' + kind : '');
  }

  function setConnectedPill(connected) {
    var pill = qs('ge-eb-status-pill');
    if (!pill) return;
    pill.textContent = connected ? 'Connected' : 'Not connected';
    pill.classList.toggle('ge-booking-status--ready', Boolean(connected));
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

  function showConnectedControls(connected) {
    var refresh = qs('ge-eb-refresh');
    var sync = qs('ge-eb-sync');
    var importWrap = qs('ge-eb-import');
    if (refresh) refresh.hidden = !connected;
    if (sync) sync.hidden = !connected;
    if (importWrap) importWrap.hidden = !connected;
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
        window.location.hash;
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
        var connected = Boolean(eb && eb.eventbriteApiTokenConfigured);
        var oauthAvailable = Boolean(
          (data.eventbriteOAuth && data.eventbriteOAuth.available) ||
            (eb && eb.eventbriteOAuthAvailable)
        );
        setConnectedPill(connected);
        showConnectedControls(connected);
        var oauthBtn = qs('ge-eb-oauth');
        if (oauthBtn) {
          oauthBtn.textContent = connected ? 'Reconnect Eventbrite' : 'Connect with Eventbrite';
          if (!oauthAvailable && !connected) {
            oauthBtn.title =
              'OAuth app credentials are not configured yet — use a private token below, or ask an admin to set EVENTBRITE_CLIENT_ID / SECRET.';
          }
        }
        return {
          connected: connected,
          oauthAvailable: oauthAvailable,
          authMethod: eb && eb.eventbriteAuthMethod,
        };
      })
      .catch(function () {
        return { connected: false, oauthAvailable: false };
      });
  }

  function renderEvents(events) {
    var list = qs('ge-eb-event-list');
    var empty = qs('ge-eb-empty');
    if (!list) return;
    list.innerHTML = '';
    var rows = Array.isArray(events) ? events : [];
    if (empty) empty.hidden = rows.length > 0;
    rows.forEach(function (evt) {
      var li = document.createElement('li');
      li.className = 'ge-eb-event';
      var meta = [formatWhen(evt.start), evt.venue || (evt.online ? 'Online' : '')]
        .filter(Boolean)
        .join(' · ');
      var already = Boolean(evt.alreadyLinked);
      li.innerHTML =
        '<div class="ge-eb-event-copy">' +
        '<strong></strong>' +
        '<span class="ge-eb-event-meta"></span>' +
        '</div>' +
        '<button type="button" class="ee-btn ee-btn-outline ge-eb-import-btn"></button>';
      li.querySelector('strong').textContent = evt.title || 'Eventbrite event';
      li.querySelector('.ge-eb-event-meta').textContent =
        meta || (already ? 'Already on The Networker UK' : '');
      var btn = li.querySelector('button');
      btn.textContent = already ? 'Already linked' : 'Import & publish';
      btn.disabled = already;
      if (!already) {
        btn.addEventListener('click', function () {
          importEvent(String(evt.id || ''), btn);
        });
      }
      list.appendChild(li);
    });
  }

  function refreshEvents() {
    var refresh = qs('ge-eb-refresh');
    if (refresh) refresh.disabled = true;
    setMsg('Loading Eventbrite events…');
    return patchProviders({ action: 'list_eventbrite_events' })
      .then(function (res) {
        if (refresh) refresh.disabled = false;
        if (!res.ok) {
          setMsg(res.data.message || res.data.error || 'Could not load Eventbrite events.', 'error');
          return;
        }
        var importWrap = qs('ge-eb-import');
        if (importWrap) importWrap.hidden = false;
        renderEvents(res.data.events || []);
        setMsg(
          (res.data.events || []).length
            ? 'Live Eventbrite events for this account. New ones also import automatically after connect.'
            : 'No live Eventbrite events found for this account.',
          'ok'
        );
      })
      .catch(function () {
        if (refresh) refresh.disabled = false;
        setMsg('Could not load Eventbrite events.', 'error');
      });
  }

  function syncNewEvents() {
    var groupId = groupIdFromPage();
    if (!groupId) {
      setMsg('Save this organiser page first, then sync Eventbrite events.', 'error');
      return;
    }
    var btn = qs('ge-eb-sync');
    if (btn) btn.disabled = true;
    setMsg('Importing new Eventbrite events…');
    return patchProviders({
      action: 'sync_eventbrite_org_events',
      groupId: groupId,
    })
      .then(function (res) {
        if (btn) btn.disabled = false;
        if (!res.ok) {
          setMsg(res.data.message || res.data.error || 'Could not sync Eventbrite events.', 'error');
          return;
        }
        var sync = res.data.orgSync || {};
        var created = Number(sync.created) || 0;
        var published = Number(sync.published) || 0;
        setMsg(
          created
            ? 'Imported ' +
                created +
                ' event' +
                (created === 1 ? '' : 's') +
                (published ? ' (' + published + ' published).' : ' as draft(s).')
            : 'No new Eventbrite events to import.',
          'ok'
        );
        return refreshEvents();
      })
      .catch(function () {
        if (btn) btn.disabled = false;
        setMsg('Could not sync Eventbrite events.', 'error');
      });
  }

  function importEvent(externalEventId, btn) {
    var groupId = groupIdFromPage();
    if (!groupId) {
      setMsg('Save this organiser page first, then import Eventbrite events.', 'error');
      return;
    }
    if (!externalEventId) return;
    if (btn) btn.disabled = true;
    setMsg('Importing…');
    patchProviders({
      action: 'create_from_eventbrite',
      groupId: groupId,
      externalEventId: externalEventId,
    })
      .then(function (res) {
        if (btn) btn.disabled = false;
        if (!res.ok) {
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
              ? 'Imported and published on The Networker UK.'
              : 'Imported as a draft on The Networker UK.'),
          'ok'
        );
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
        if (btn) btn.disabled = false;
        setMsg('Could not import that event.', 'error');
      });
  }

  function startOAuth() {
    var groupId = groupIdFromPage();
    if (!groupId) {
      setMsg('Save this organiser page first, then connect Eventbrite.', 'error');
      return;
    }
    var btn = qs('ge-eb-oauth');
    if (btn) btn.disabled = true;
    setMsg('Opening Eventbrite…');
    patchProviders({
      action: 'start_eventbrite_oauth',
      groupId: groupId,
      returnPath: '/organiser/group-edit?id=' + encodeURIComponent(groupId),
    })
      .then(function (res) {
        if (btn) btn.disabled = false;
        if (!res.ok) {
          var tokenInput = qs('ge-eb-token');
          if (tokenInput && tokenInput.focus) {
            try {
              tokenInput.focus();
              if (tokenInput.scrollIntoView) tokenInput.scrollIntoView({ block: 'nearest' });
            } catch (_e) {
              /* ignore */
            }
          }
          setMsg(
            res.data.message ||
              res.data.error ||
              'Eventbrite OAuth is not available. Use a private token below.',
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

  function saveConnection() {
    var input = qs('ge-eb-token');
    var token = input ? String(input.value || '').trim() : '';
    if (!token) {
      setMsg('Paste your Eventbrite private token first.', 'error');
      return;
    }
    var groupId = groupIdFromPage();
    var btn = qs('ge-eb-save');
    if (btn) btn.disabled = true;
    setMsg('Saving connection…');
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
        setConnectedPill(true);
        showConnectedControls(true);
        var sync = res.data.orgSync || {};
        var created = Number(sync.created) || 0;
        setMsg(
          created
            ? 'Connected. Imported ' + created + ' Eventbrite event' + (created === 1 ? '' : 's') + '.'
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

  function init(options) {
    var card = qs('ge-booking-card');
    if (!card) return;
    options = options || {};
    activeGroupId = String(options.groupId || options.editId || options.id || '').trim();
    if (!activeGroupId) {
      try {
        var params = new URLSearchParams(window.location.search);
        activeGroupId = String(params.get('id') || params.get('groupId') || '').trim();
      } catch (_e) {
        activeGroupId = '';
      }
    }
    var groupId = groupIdFromPage();
    if (groupId) card.setAttribute('data-group-id', groupId);
    else card.removeAttribute('data-group-id');
    // Show once the organiser page exists (edit mode). New pages save first.
    card.hidden = !groupId;
    if (!groupId) {
      setMsg('');
      showConnectedControls(false);
      setConnectedPill(false);
      return;
    }

    var oauthBtn = qs('ge-eb-oauth');
    if (oauthBtn && !oauthBtn.dataset.bound) {
      oauthBtn.dataset.bound = '1';
      oauthBtn.addEventListener('click', startOAuth);
    }
    var saveBtn = qs('ge-eb-save');
    if (saveBtn && !saveBtn.dataset.bound) {
      saveBtn.dataset.bound = '1';
      saveBtn.addEventListener('click', saveConnection);
    }
    var refreshBtn = qs('ge-eb-refresh');
    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.dataset.bound = '1';
      refreshBtn.addEventListener('click', refreshEvents);
    }
    var syncBtn = qs('ge-eb-sync');
    if (syncBtn && !syncBtn.dataset.bound) {
      syncBtn.dataset.bound = '1';
      syncBtn.addEventListener('click', syncNewEvents);
    }

    var oauthReturn = consumeOAuthReturnParams();
    loadConnectionState().then(function (state) {
      if (oauthReturn) {
        if (oauthReturn.status === 'connected') {
          setConnectedPill(true);
          showConnectedControls(true);
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
        if (oauthReturn.status === 'denied') {
          setMsg('Eventbrite connection was cancelled.', 'error');
        } else if (oauthReturn.status === 'not_configured') {
          var tokenEl = qs('ge-eb-token');
          if (tokenEl && tokenEl.focus) {
            try {
              tokenEl.focus();
              if (tokenEl.scrollIntoView) tokenEl.scrollIntoView({ block: 'nearest' });
            } catch (_e2) {
              /* ignore */
            }
          }
          setMsg(
            'Eventbrite OAuth is not configured on this environment. Use a private token below.',
            'error'
          );
        } else {
          setMsg(
            'Could not connect Eventbrite' +
              (oauthReturn.error ? ' (' + oauthReturn.error + ')' : '') +
              '.',
            'error'
          );
        }
      }
      if (state.connected) refreshEvents();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
    });
  } else {
    init();
  }

  window.HubGroupBookingConnect = {
    init: init,
    refreshEvents: refreshEvents,
    syncNewEvents: syncNewEvents,
  };
})();
