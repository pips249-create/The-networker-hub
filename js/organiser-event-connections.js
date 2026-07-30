/**
 * Organiser event connections email — pick an event, preview attendees, send list.
 */
(function (global) {
  'use strict';

  var state = {
    groups: [],
    events: [],
    preview: null,
    sending: false,
    bound: false,
  };

  function els() {
    return {
      status: document.getElementById('oec-status'),
      group: document.getElementById('oec-group'),
      groupWrap: document.getElementById('oec-group-wrap'),
      event: document.getElementById('oec-event'),
      subject: document.getElementById('oec-subject'),
      note: document.getElementById('oec-note'),
      previewBtn: document.getElementById('oec-preview'),
      sendBtn: document.getElementById('oec-send'),
      previewBody: document.getElementById('oec-preview-body'),
      count: document.getElementById('oec-count'),
    };
  }

  function setStatus(msg, kind) {
    var el = els().status;
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('is-error', kind === 'error');
    el.classList.toggle('is-ok', kind === 'ok');
  }

  function api(path, opts) {
    var options = opts || {};
    return fetch(path, {
      method: options.method || 'GET',
      credentials: 'include',
      headers: options.body
        ? { 'Content-Type': 'application/json', Accept: 'application/json' }
        : { Accept: 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined,
    }).then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, status: res.status, data: data || {} };
      });
    });
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function eventLabel(ev) {
    var title = String(ev.title || 'Event').trim();
    var when = '';
    if (ev.startsAt || ev.starts_at || ev.date) {
      try {
        when = new Date(ev.startsAt || ev.starts_at || ev.date).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      } catch (e) {
        when = '';
      }
    }
    return when ? title + ' · ' + when : title;
  }

  function eventsForSelectedGroup() {
    var e = els();
    var groupId = e.group ? String(e.group.value || '').trim() : '';
    var list = state.events || [];
    if (!groupId || list.length <= 1) return list;
    return list.filter(function (ev) {
      return (
        String(ev.organiserGroupId || ev.organiserId || ev.organiser_id || ev.groupId || '') ===
        groupId
      );
    });
  }

  function fillGroups() {
    var e = els();
    if (!e.group) return;
    var groups = state.groups || [];
    if (groups.length <= 1) {
      if (e.groupWrap) e.groupWrap.hidden = true;
      if (groups[0]) e.group.value = groups[0].id;
      return;
    }
    if (e.groupWrap) e.groupWrap.hidden = false;
    var current = e.group.value;
    e.group.innerHTML = groups
      .map(function (g) {
        return (
          '<option value="' +
          esc(g.id) +
          '">' +
          esc(g.name || 'Organiser page') +
          '</option>'
        );
      })
      .join('');
    if (current && groups.some(function (g) { return g.id === current; })) {
      e.group.value = current;
    }
  }

  function fillEvents() {
    var e = els();
    if (!e.event) return;
    var list = eventsForSelectedGroup().slice().sort(function (a, b) {
      var ta = new Date(a.startsAt || a.starts_at || a.date || 0).getTime();
      var tb = new Date(b.startsAt || b.starts_at || b.date || 0).getTime();
      return tb - ta;
    });
    var current = e.event.value;
    if (!list.length) {
      e.event.innerHTML = '<option value="">No events yet</option>';
      return;
    }
    e.event.innerHTML =
      '<option value="">Choose an event…</option>' +
      list
        .map(function (ev) {
          return (
            '<option value="' + esc(ev.id) + '">' + esc(eventLabel(ev)) + '</option>'
          );
        })
        .join('');
    if (current && list.some(function (ev) { return ev.id === current; })) {
      e.event.value = current;
    }
  }

  function renderPreview(preview) {
    var e = els();
    state.preview = preview || null;
    if (e.count) {
      e.count.textContent = preview
        ? preview.attendeeCount +
          ' confirmed attendee' +
          (preview.attendeeCount === 1 ? '' : 's')
        : '';
    }
    if (!e.previewBody) return;
    if (!preview) {
      e.previewBody.innerHTML =
        '<p class="org-group-update-hint">Pick an event and preview to see who will be listed.</p>';
      return;
    }
    if (e.subject && !String(e.subject.value || '').trim()) {
      e.subject.value = preview.defaultSubject || '';
    }
    var last =
      preview.lastSentAt
        ? '<p class="org-group-update-hint">Last sent ' +
          esc(new Date(preview.lastSentAt).toLocaleString('en-GB')) +
          (preview.lastSentCount
            ? ' to ' + preview.lastSentCount + ' people'
            : '') +
          '.</p>'
        : '';
    var rows = (preview.attendees || [])
      .map(function (a) {
        var meta = [a.jobTitle, a.company].filter(Boolean).join(' · ');
        return (
          '<li class="oec-preview-row">' +
          '<strong>' +
          esc(a.name) +
          '</strong>' +
          (meta ? '<span>' + esc(meta) + '</span>' : '') +
          '<a href="mailto:' +
          esc(a.email) +
          '">' +
          esc(a.email) +
          '</a></li>'
        );
      })
      .join('');
    e.previewBody.innerHTML =
      '<p class="org-group-update-hint">' +
      esc(preview.eventTitle) +
      (preview.eventDate ? ' · ' + esc(preview.eventDate) : '') +
      '</p>' +
      last +
      (rows
        ? '<ul class="oec-preview-list">' + rows + '</ul>'
        : '<p class="org-group-update-hint">No confirmed attendees yet.</p>');
  }

  async function loadPreview() {
    var e = els();
    var eventId = e.event ? String(e.event.value || '').trim() : '';
    if (!eventId) {
      setStatus('Choose an event first.', 'error');
      return null;
    }
    setStatus('Loading attendees…');
    var res = await api('/api/organiser/event-connections?eventId=' + encodeURIComponent(eventId));
    if (!res.ok) {
      setStatus(res.data.message || res.data.error || 'Could not load attendees.', 'error');
      renderPreview(null);
      return null;
    }
    renderPreview(res.data);
    setStatus(
      res.data.attendeeCount +
        ' confirmed attendee' +
        (res.data.attendeeCount === 1 ? '' : 's') +
        ' will receive the list (minus themselves).',
      'ok'
    );
    return res.data;
  }

  async function send(force) {
    var e = els();
    if (state.sending) return;
    var eventId = e.event ? String(e.event.value || '').trim() : '';
    if (!eventId) {
      setStatus('Choose an event first.', 'error');
      return;
    }
    var preview = state.preview;
    if (!preview || preview.eventId !== eventId) {
      preview = await loadPreview();
      if (!preview) return;
    }
    if (preview.attendeeCount < 2) {
      setStatus('You need at least two confirmed attendees to share a list.', 'error');
      return;
    }
    var already = Boolean(preview.lastSentAt);
    var confirmMsg = already
      ? 'A connections email was already sent for this event. Send again to all confirmed attendees?'
      : 'Email the attendee list (names + emails) to all ' +
        preview.attendeeCount +
        ' confirmed attendees for this event?';
    if (!global.confirm(confirmMsg)) return;

    state.sending = true;
    if (e.sendBtn) e.sendBtn.disabled = true;
    setStatus('Sending…');
    try {
      var res = await api('/api/organiser/event-connections', {
        method: 'POST',
        body: {
          eventId: eventId,
          subject: e.subject ? e.subject.value : '',
          organiserNote: e.note ? e.note.value : '',
          force: Boolean(force || already),
        },
      });
      if (!res.ok) {
        if (res.status === 409 && res.data.error === 'already_sent') {
          if (global.confirm((res.data.message || 'Already sent.') + ' Send again?')) {
            state.sending = false;
            if (e.sendBtn) e.sendBtn.disabled = false;
            return send(true);
          }
          setStatus('Send cancelled.', 'error');
          return;
        }
        setStatus(res.data.message || res.data.error || 'Send failed.', 'error');
        return;
      }
      setStatus(res.data.message || 'Sent.', 'ok');
      await loadPreview();
    } finally {
      state.sending = false;
      if (e.sendBtn) e.sendBtn.disabled = false;
    }
  }

  function bind() {
    if (state.bound) return;
    state.bound = true;
    var e = els();
    if (e.group) {
      e.group.addEventListener('change', function () {
        fillEvents();
        renderPreview(null);
        setStatus('');
      });
    }
    if (e.event) {
      e.event.addEventListener('change', function () {
        renderPreview(null);
        setStatus('');
        if (e.event.value) loadPreview().catch(function () {});
      });
    }
    if (e.previewBtn) {
      e.previewBtn.addEventListener('click', function () {
        loadPreview().catch(function (err) {
          setStatus(err.message || 'Preview failed.', 'error');
        });
      });
    }
    if (e.sendBtn) {
      e.sendBtn.addEventListener('click', function () {
        send(false).catch(function (err) {
          setStatus(err.message || 'Send failed.', 'error');
        });
      });
    }
  }

  function init(opts) {
    opts = opts || {};
    state.groups = opts.groups || state.groups || [];
    state.events = opts.events || state.events || [];
    bind();
    fillGroups();
    fillEvents();
    if (opts.eventId) {
      var e = els();
      if (e.event) {
        e.event.value = opts.eventId;
        loadPreview().catch(function () {});
      }
    }
  }

  global.HubOrganiserEventConnections = {
    init: init,
    openForEvent: function (eventId, opts) {
      init(Object.assign({}, opts || {}, { eventId: eventId }));
      loadPreview().catch(function () {});
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
