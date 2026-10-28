/**
 * Organiser page — connect Eventbrite and import events onto this page.
 */
(function () {
  'use strict';

  function qs(id) {
    return document.getElementById(id);
  }

  function groupIdFromPage() {
    try {
      var params = new URLSearchParams(window.location.search);
      return String(params.get('id') || params.get('groupId') || '').trim();
    } catch (_e) {
      return '';
    }
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

  function loadConnectionState() {
    return fetch('/api/organiser/connected-booking-providers', {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.ok) return false;
        var eb = (data.providers || []).find(function (p) {
          return p && p.id === 'eventbrite';
        });
        var connected = Boolean(eb && eb.eventbriteApiTokenConfigured);
        setConnectedPill(connected);
        var refresh = qs('ge-eb-refresh');
        var importWrap = qs('ge-eb-import');
        if (refresh) refresh.hidden = !connected;
        if (importWrap) importWrap.hidden = !connected;
        return connected;
      })
      .catch(function () {
        return false;
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
      li.querySelector('.ge-eb-event-meta').textContent = meta || (already ? 'Already on The Networker UK' : '');
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
            ? 'Select an event to import onto this organiser page. Complete listings publish automatically.'
            : 'No Eventbrite events found for this account.',
          'ok'
        );
      })
      .catch(function () {
        if (refresh) refresh.disabled = false;
        setMsg('Could not load Eventbrite events.', 'error');
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
          window.location.href =
            '/organiser/event-edit?id=' + encodeURIComponent(eventId);
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

  function saveConnection() {
    var input = qs('ge-eb-token');
    var token = input ? String(input.value || '').trim() : '';
    if (!token) {
      setMsg('Paste your Eventbrite private token first.', 'error');
      return;
    }
    var btn = qs('ge-eb-save');
    if (btn) btn.disabled = true;
    setMsg('Saving connection…');
    patchProviders({ action: 'save_eventbrite_private_token', token: token })
      .then(function (res) {
        if (btn) btn.disabled = false;
        if (!res.ok) {
          setMsg(res.data.message || res.data.error || 'Could not save token.', 'error');
          return;
        }
        if (input) input.value = '';
        setConnectedPill(true);
        var refresh = qs('ge-eb-refresh');
        if (refresh) refresh.hidden = false;
        setMsg('Connected. Loading your Eventbrite events…', 'ok');
        return refreshEvents();
      })
      .catch(function () {
        if (btn) btn.disabled = false;
        setMsg('Could not save token.', 'error');
      });
  }

  function init() {
    var card = qs('ge-booking-card');
    if (!card) return;
    var groupId = groupIdFromPage();
    // Show once the organiser page exists (edit mode). New pages save first.
    card.hidden = !groupId;
    if (!groupId) return;

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

    loadConnectionState().then(function (connected) {
      if (connected) refreshEvents();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.HubGroupBookingConnect = { init: init, refreshEvents: refreshEvents };
})();
