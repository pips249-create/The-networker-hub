/**
 * Organiser monthly group updates — draft, preview, send.
 */
(function (global) {
  var state = {
    organiserId: '',
    updateId: '',
    bootstrap: null,
    bound: false,
  };

  function api(path, options) {
    return fetch(path, {
      credentials: 'include',
      cache: 'no-store',
      ...(options || {}),
      headers: {
        'Content-Type': 'application/json',
        ...((options && options.headers) || {}),
      },
    }).then(async function (res) {
      var text = await res.text();
      var data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        throw new Error('Invalid server response');
      }
      return { ok: res.ok, status: res.status, data: data };
    });
  }

  function els() {
    return {
      page: document.getElementById('org-page-group-updates'),
      allowance: document.getElementById('ogu-allowance'),
      status: document.getElementById('ogu-status'),
      form: document.getElementById('ogu-form'),
      group: document.getElementById('ogu-group'),
      subject: document.getElementById('ogu-subject'),
      note: document.getElementById('ogu-note'),
      recap: document.getElementById('ogu-recap'),
      includeEvents: document.getElementById('ogu-include-events'),
      events: document.getElementById('ogu-events'),
      spotlightName: document.getElementById('ogu-spotlight-name'),
      spotlightCompany: document.getElementById('ogu-spotlight-company'),
      spotlightText: document.getElementById('ogu-spotlight-text'),
      spotlightLinkedin: document.getElementById('ogu-spotlight-linkedin'),
      ask: document.getElementById('ogu-ask'),
      volunteer: document.getElementById('ogu-volunteer'),
      includeSocials: document.getElementById('ogu-include-socials'),
      save: document.getElementById('ogu-save'),
      preview: document.getElementById('ogu-preview'),
      send: document.getElementById('ogu-send'),
      previewBody: document.getElementById('ogu-preview-body'),
      history: document.getElementById('ogu-history'),
    };
  }

  function setStatus(msg, kind) {
    var el = els().status;
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('is-error', kind === 'error');
    el.classList.toggle('is-ok', kind === 'ok');
  }

  function readContent() {
    var e = els();
    var eventIds = [];
    if (e.events) {
      e.events.querySelectorAll('input[type="checkbox"][data-event-id]:checked').forEach(function (box) {
        eventIds.push(box.getAttribute('data-event-id'));
      });
    }
    return {
      organiserNote: (e.note && e.note.value) || '',
      monthRecap: (e.recap && e.recap.value) || '',
      includeUpcomingEvents: !!(e.includeEvents && e.includeEvents.checked),
      eventIds: eventIds,
      spotlightName: (e.spotlightName && e.spotlightName.value) || '',
      spotlightCompany: (e.spotlightCompany && e.spotlightCompany.value) || '',
      spotlightText: (e.spotlightText && e.spotlightText.value) || '',
      spotlightLinkedin: (e.spotlightLinkedin && e.spotlightLinkedin.value) || '',
      memberAsk: (e.ask && e.ask.value) || '',
      volunteerCta: (e.volunteer && e.volunteer.value) || '',
      includeSocialLinks: !!(e.includeSocials && e.includeSocials.checked),
    };
  }

  function renderAllowance(allowance, recipientEstimate) {
    var el = els().allowance;
    if (!el || !allowance) return;
    var bits = [];
    bits.push(
      '<strong>' +
        (allowance.periodLabel || 'This month') +
        '</strong> — ' +
        allowance.sentThisMonth +
        ' of ' +
        allowance.hardCapPerMonth +
        ' sends used'
    );
    bits.push(
      'Free remaining: <strong>' +
        allowance.freeRemaining +
        '</strong> · Extra credits: <strong>' +
        allowance.extraCredits +
        '</strong>'
    );
    bits.push(
      'Audience estimate: <strong>' +
        (recipientEstimate || 0) +
        '</strong> Hub attendee' +
        ((recipientEstimate || 0) === 1 ? '' : 's')
    );
    if (!allowance.canSend) {
      bits.push(
        allowance.blockedReason === 'hard_cap'
          ? 'You’ve hit this month’s send limit.'
          : 'Free send used. Extra paid sends coming soon — or wait until next month.'
      );
    } else if (allowance.freeRemaining > 0) {
      bits.push('Your free monthly update is ready when you are.');
    }
    el.innerHTML = bits.map(function (b) {
      return '<p>' + b + '</p>';
    }).join('');
    var sendBtn = els().send;
    if (sendBtn) sendBtn.disabled = !allowance.canSend;
  }

  function renderEvents(events, selectedIds) {
    var wrap = els().events;
    if (!wrap) return;
    var selected = selectedIds && selectedIds.length ? selectedIds : null;
    if (!events || !events.length) {
      wrap.innerHTML = '<p class="org-group-update-hint">No upcoming published events yet.</p>';
      return;
    }
    wrap.innerHTML = events
      .map(function (ev, idx) {
        var checked = selected ? selected.indexOf(ev.id) >= 0 : idx < 3;
        var when = ev.startsAt
          ? new Date(ev.startsAt).toLocaleString('en-GB', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '';
        return (
          '<label class="org-group-update-event">' +
          '<input type="checkbox" data-event-id="' +
          ev.id +
          '"' +
          (checked ? ' checked' : '') +
          ' />' +
          '<span><strong>' +
          (ev.title || 'Event') +
          '</strong><br>' +
          when +
          (ev.location ? ' · ' + ev.location : '') +
          '</span></label>'
        );
      })
      .join('');
  }

  function renderHistory(updates) {
    var el = els().history;
    if (!el) return;
    if (!updates || !updates.length) {
      el.innerHTML = '<p class="org-group-update-hint">No updates yet.</p>';
      return;
    }
    el.innerHTML =
      '<ul class="org-group-update-history-list">' +
      updates
        .slice(0, 8)
        .map(function (u) {
          return (
            '<li><strong>' +
            (u.subject || 'Untitled') +
            '</strong><br><span>' +
            (u.status || '') +
            (u.sent_count ? ' · ' + u.sent_count + ' sent' : '') +
            '</span></li>'
          );
        })
        .join('') +
      '</ul>';
  }

  function fillFromUpdate(update) {
    var e = els();
    if (!update) return;
    state.updateId = update.id || '';
    if (e.subject) e.subject.value = update.subject || '';
    var c = update.content || {};
    if (e.note) e.note.value = c.organiserNote || '';
    if (e.recap) e.recap.value = c.monthRecap || '';
    if (e.includeEvents) e.includeEvents.checked = c.includeUpcomingEvents !== false;
    if (e.spotlightName) e.spotlightName.value = c.spotlightName || '';
    if (e.spotlightCompany) e.spotlightCompany.value = c.spotlightCompany || '';
    if (e.spotlightText) e.spotlightText.value = c.spotlightText || '';
    if (e.spotlightLinkedin) e.spotlightLinkedin.value = c.spotlightLinkedin || '';
    if (e.ask) e.ask.value = c.memberAsk || '';
    if (e.volunteer) e.volunteer.value = c.volunteerCta || '';
    if (e.includeSocials) e.includeSocials.checked = c.includeSocialLinks !== false;
    renderEvents((state.bootstrap && state.bootstrap.events) || [], c.eventIds || []);
  }

  function syncGroupOptions(groups) {
    var e = els();
    if (!e.group) return;
    var prev = e.group.value || state.organiserId;
    e.group.innerHTML = '';
    (groups || []).forEach(function (g, idx) {
      var opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name || 'Organiser page';
      e.group.appendChild(opt);
      if (!prev && idx === 0) prev = g.id;
    });
    if (prev) e.group.value = prev;
    state.organiserId = e.group.value || '';
  }

  async function loadBootstrap() {
    var e = els();
    if (!state.organiserId) {
      setStatus('Create an organiser page first.', 'error');
      return;
    }
    setStatus('Loading…');
    var res = await api(
      '/api/organiser/group-updates?organiserId=' + encodeURIComponent(state.organiserId)
    );
    if (!res.ok || !res.data || !res.data.ok) {
      throw new Error((res.data && (res.data.message || res.data.error)) || 'Could not load');
    }
    state.bootstrap = res.data;
    renderAllowance(res.data.allowance, res.data.recipientEstimate);
    renderEvents(res.data.events || [], []);
    renderHistory(res.data.updates || []);
    var draft = (res.data.updates || []).find(function (u) {
      return u.status === 'draft';
    });
    if (draft) {
      fillFromUpdate(draft);
    } else if (e.subject && !e.subject.value) {
      e.subject.value = (res.data.defaults && res.data.defaults.subject) || '';
    }
    setStatus(
      (res.data.recipientEstimate || 0) +
        ' people who booked via the Hub can receive this update.',
      'ok'
    );
  }

  async function saveDraft() {
    var e = els();
    var res = await api('/api/organiser/group-updates', {
      method: 'POST',
      body: JSON.stringify({
        action: 'save',
        organiserId: state.organiserId,
        id: state.updateId || undefined,
        subject: e.subject ? e.subject.value : '',
        content: readContent(),
      }),
    });
    if (!res.ok || !res.data || !res.data.ok) {
      throw new Error((res.data && (res.data.message || res.data.error)) || 'Save failed');
    }
    state.updateId = res.data.update && res.data.update.id;
    if (res.data.allowance) renderAllowance(res.data.allowance, state.bootstrap && state.bootstrap.recipientEstimate);
    setStatus('Draft saved.', 'ok');
    return res.data.update;
  }

  async function preview() {
    var e = els();
    var res = await api('/api/organiser/group-updates', {
      method: 'POST',
      body: JSON.stringify({
        action: 'preview',
        organiserId: state.organiserId,
        subject: e.subject ? e.subject.value : '',
        content: readContent(),
      }),
    });
    if (!res.ok || !res.data || !res.data.ok) {
      throw new Error((res.data && (res.data.message || res.data.error)) || 'Preview failed');
    }
    var p = res.data.preview || {};
    if (e.previewBody) {
      e.previewBody.innerHTML =
        '<div class="ogu-preview-frame">' +
        (p.html ||
          '<p class="org-group-update-hint">Nothing to preview yet — add a note or tick some modules.</p>') +
        '</div>';
    }
    setStatus('Preview updated.', 'ok');
  }

  async function sendUpdate() {
    if (
      !global.confirm(
        'Send this monthly update to Hub attendees for this organiser page? Emails go out over the next couple of hours.'
      )
    ) {
      return;
    }
    await saveDraft();
    var res = await api('/api/organiser/group-updates', {
      method: 'POST',
      body: JSON.stringify({
        action: 'send',
        organiserId: state.organiserId,
        id: state.updateId,
      }),
    });
    if (!res.ok || !res.data || !res.data.ok) {
      throw new Error((res.data && (res.data.message || res.data.error)) || 'Send failed');
    }
    setStatus(res.data.message || 'Queued.', 'ok');
    state.updateId = '';
    await loadBootstrap();
  }

  function bind() {
    if (state.bound) return;
    var e = els();
    if (!e.form) return;
    state.bound = true;
    if (e.group) {
      e.group.addEventListener('change', function () {
        state.organiserId = e.group.value;
        state.updateId = '';
        loadBootstrap().catch(function (err) {
          setStatus(err.message || 'Could not load', 'error');
        });
      });
    }
    if (e.save) {
      e.save.addEventListener('click', function () {
        saveDraft().catch(function (err) {
          setStatus(err.message || 'Save failed', 'error');
        });
      });
    }
    if (e.preview) {
      e.preview.addEventListener('click', function () {
        preview().catch(function (err) {
          setStatus(err.message || 'Preview failed', 'error');
        });
      });
    }
    if (e.send) {
      e.send.addEventListener('click', function () {
        sendUpdate().catch(function (err) {
          setStatus(err.message || 'Send failed', 'error');
        });
      });
    }
  }

  async function init(options) {
    options = options || {};
    bind();
    var groups = options.groups || [];
    syncGroupOptions(groups);
    if (!state.organiserId && groups[0]) state.organiserId = groups[0].id;
    await loadBootstrap();
  }

  global.HubOrganiserGroupUpdates = {
    init: init,
    refresh: loadBootstrap,
  };
})(typeof window !== 'undefined' ? window : global);
