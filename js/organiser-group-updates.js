/**
 * Organiser monthly group updates — draft, preview, send.
 */
(function (global) {
  var state = {
    organiserId: '',
    updateId: '',
    bootstrap: null,
    bound: false,
    autosaveTimer: null,
    dirty: false,
    switchingGroup: false,
  };

  function draftStorageKey(organiserId) {
    return 'ogu-draft-id:' + String(organiserId || '');
  }

  function rememberDraftId(organiserId, updateId) {
    try {
      if (organiserId && updateId) {
        sessionStorage.setItem(draftStorageKey(organiserId), String(updateId));
      }
    } catch (e) {
      /* ignore */
    }
  }

  function recalledDraftId(organiserId) {
    try {
      return sessionStorage.getItem(draftStorageKey(organiserId)) || '';
    } catch (e) {
      return '';
    }
  }

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
      el.innerHTML = '<p class="org-group-update-hint">No drafts or sends yet.</p>';
      return;
    }
    el.innerHTML =
      '<ul class="org-group-update-history-list">' +
      updates
        .slice(0, 8)
        .map(function (u) {
          var isDraft = String(u.status || '') === 'draft';
          var meta = isDraft
            ? 'Draft · click to open'
            : String(u.status || '') + (u.sent_count ? ' · ' + u.sent_count + ' sent' : '');
          var tag = isDraft
            ? 'button type="button" class="ogu-history-open" data-update-id="' + u.id + '"'
            : 'div class="ogu-history-item"';
          var close = isDraft ? 'button' : 'div';
          return (
            '<' +
            tag +
            '>' +
            '<strong>' +
            (u.subject || 'Untitled') +
            '</strong><br><span>' +
            meta +
            '</span></' +
            close +
            '>'
          );
        })
        .join('') +
      '</ul>';
  }

  function fillFromUpdate(update) {
    var e = els();
    if (!update) return;
    state.updateId = update.id || '';
    rememberDraftId(state.organiserId, state.updateId);
    if (e.subject) e.subject.value = update.subject || '';
    var c = update.content || {};
    if (typeof c === 'string') {
      try {
        c = JSON.parse(c);
      } catch (err) {
        c = {};
      }
    }
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
    state.dirty = false;
  }

  function openUpdateFromHistory(updateId) {
    var updates = (state.bootstrap && state.bootstrap.updates) || [];
    var found = updates.find(function (u) {
      return String(u.id) === String(updateId);
    });
    if (!found) {
      setStatus('Could not open that draft.', 'error');
      return;
    }
    fillFromUpdate(found);
    setStatus(found.status === 'draft' ? 'Draft opened — keep editing, then save.' : 'Loaded previous update.', 'ok');
    var form = els().form;
    if (form && form.scrollIntoView) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function syncGroupOptions(groups) {
    var e = els();
    if (!e.group) return;
    var list = Array.isArray(groups) ? groups.filter(Boolean) : [];
    var prev = e.group.value || state.organiserId;
    e.group.innerHTML = '';
    e.group.disabled = false;
    e.group.removeAttribute('aria-disabled');
    if (!list.length) {
      var empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'No organiser pages yet';
      e.group.appendChild(empty);
      e.group.disabled = true;
      state.organiserId = '';
      return;
    }
    list.forEach(function (g, idx) {
      var opt = document.createElement('option');
      opt.value = String(g.id);
      opt.textContent = g.name || 'Organiser page';
      e.group.appendChild(opt);
      if (!prev && idx === 0) prev = String(g.id);
    });
    var hasPrev = list.some(function (g) {
      return String(g.id) === String(prev);
    });
    e.group.value = hasPrev ? String(prev) : String(list[0].id);
    state.organiserId = e.group.value || '';
    var wrap = document.getElementById('ogu-group-wrap');
    if (wrap) wrap.hidden = false;
  }

  function cancelAutosave() {
    if (state.autosaveTimer) {
      clearTimeout(state.autosaveTimer);
      state.autosaveTimer = null;
    }
  }

  function scheduleAutosave() {
    if (state.switchingGroup) return;
    state.dirty = true;
    cancelAutosave();
    state.autosaveTimer = setTimeout(function () {
      if (state.switchingGroup || !state.dirty || !state.organiserId) return;
      saveDraft({ silent: true })
        .then(function () {
          if (!state.switchingGroup) setStatus('Draft auto-saved.', 'ok');
        })
        .catch(function (err) {
          if (!state.switchingGroup) {
            setStatus(err.message || 'Could not auto-save draft.', 'error');
          }
        });
    }, 1200);
  }

  async function switchOrganiserPage(nextId) {
    var id = String(nextId || '').trim();
    if (!id || id === String(state.organiserId)) return;
    cancelAutosave();
    state.switchingGroup = true;
    state.dirty = false;
    state.organiserId = id;
    state.updateId = '';
    try {
      await loadBootstrap();
    } finally {
      state.switchingGroup = false;
    }
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
    var updates = res.data.updates || [];
    var remembered = recalledDraftId(state.organiserId);
    var draft =
      updates.find(function (u) {
        return u.status === 'draft' && String(u.id) === String(remembered);
      }) ||
      updates.find(function (u) {
        return u.status === 'draft';
      });
    if (draft) {
      fillFromUpdate(draft);
      setStatus('Loaded your saved draft for ' + ((res.data.allowance && res.data.allowance.periodLabel) || 'this month') + '.', 'ok');
    } else if (e.subject && !e.subject.value) {
      e.subject.value = (res.data.defaults && res.data.defaults.subject) || '';
      setStatus(
        (res.data.recipientEstimate || 0) +
          ' people who booked via the Hub can receive this update.',
        'ok'
      );
    } else {
      setStatus(
        (res.data.recipientEstimate || 0) +
          ' people who booked via the Hub can receive this update.',
        'ok'
      );
    }
  }

  async function saveDraft(options) {
    options = options || {};
    var e = els();
    if (e.save && !options.silent) {
      e.save.disabled = true;
      e.save.textContent = 'Saving…';
    }
    try {
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
      rememberDraftId(state.organiserId, state.updateId);
      state.dirty = false;
      if (res.data.allowance) {
        renderAllowance(res.data.allowance, state.bootstrap && state.bootstrap.recipientEstimate);
      }
      if (state.bootstrap && res.data.update) {
        var list = state.bootstrap.updates || [];
        var idx = list.findIndex(function (u) {
          return String(u.id) === String(state.updateId);
        });
        if (idx >= 0) list[idx] = res.data.update;
        else list.unshift(res.data.update);
        state.bootstrap.updates = list;
        renderHistory(list);
      }
      if (!options.silent) setStatus('Draft saved. You can leave and come back to it.', 'ok');
      return res.data.update;
    } finally {
      if (e.save) {
        e.save.disabled = false;
        e.save.textContent = 'Save draft';
      }
    }
  }

  async function preview() {
    var e = els();
    if (state.switchingGroup) return;
    try {
      await saveDraft({ silent: true });
    } catch (err) {
      /* still allow preview if save fails */
    }
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
    setStatus('Draft saved · preview updated.', 'ok');
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
        switchOrganiserPage(e.group.value).catch(function (err) {
          setStatus(err.message || 'Could not switch organiser page.', 'error');
        });
      });
    }
    if (e.history) {
      e.history.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-update-id]');
        if (!btn) return;
        openUpdateFromHistory(btn.getAttribute('data-update-id'));
      });
    }
    if (e.form) {
      e.form.addEventListener('input', function (ev) {
        if (ev.target && ev.target.id === 'ogu-group') return;
        scheduleAutosave();
      });
      e.form.addEventListener('change', function (ev) {
        if (ev.target && ev.target.id === 'ogu-group') return;
        scheduleAutosave();
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
    if (!state.organiserId) {
      setStatus(
        groups.length
          ? 'Choose an organiser page to start your round-up.'
          : 'Create an organiser page first, then come back here.',
        groups.length ? 'ok' : 'error'
      );
      return;
    }
    await loadBootstrap();
  }

  global.HubOrganiserGroupUpdates = {
    init: init,
    refresh: loadBootstrap,
    syncGroups: syncGroupOptions,
  };
})(typeof window !== 'undefined' ? window : global);
