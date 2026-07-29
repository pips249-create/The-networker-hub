/**
 * Organiser monthly group updates — draft, preview, send.
 */
(function (global) {
  var state = {
    organiserId: '',
    updateId: '',
    bootstrap: null,
    creditPacks: [],
    bound: false,
    autosaveTimer: null,
    dirty: false,
    switchingGroup: false,
    saveGeneration: 0,
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
      page: document.getElementById('org-social-email') || document.getElementById('org-social-panel-email'),
      allowance: document.getElementById('ogu-allowance'),
      status: document.getElementById('ogu-status'),
      form: document.getElementById('ogu-form'),
      group: document.getElementById('ogu-group'),
      audienceSlice: document.getElementById('ogu-audience-slice'),
      audienceHint: document.getElementById('ogu-audience-hint'),
      replyHint: document.getElementById('ogu-reply-hint'),
      subject: document.getElementById('ogu-subject'),
      note: document.getElementById('ogu-note'),
      recap: document.getElementById('ogu-recap'),
      includeEvents: document.getElementById('ogu-include-events'),
      includeGreeting: document.getElementById('ogu-include-greeting'),
      includeStats: document.getElementById('ogu-include-stats'),
      statsHint: document.getElementById('ogu-stats-hint'),
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
      report: document.getElementById('ogu-report'),
    };
  }

  function friendlyError(err) {
    var msg = String((err && err.message) || '');
    if (/schema cache|does not exist|organiser_group_updates|PGRST/i.test(msg)) {
      return 'Monthly updates are still being set up. Please try again shortly.';
    }
    return msg || 'Something went wrong. Please try again.';
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
      includeGreeting: !!(e.includeGreeting && e.includeGreeting.checked),
      includeMonthStats: !!(e.includeStats && e.includeStats.checked),
      includeUpcomingEvents: !!(e.includeEvents && e.includeEvents.checked),
      eventIds: eventIds,
      audienceSlice: (e.audienceSlice && e.audienceSlice.value) || 'all',
      spotlightName: (e.spotlightName && e.spotlightName.value) || '',
      spotlightCompany: (e.spotlightCompany && e.spotlightCompany.value) || '',
      spotlightText: (e.spotlightText && e.spotlightText.value) || '',
      spotlightLinkedin: (e.spotlightLinkedin && e.spotlightLinkedin.value) || '',
      memberAsk: (e.ask && e.ask.value) || '',
      volunteerCta: (e.volunteer && e.volunteer.value) || '',
      includeSocialLinks: !!(e.includeSocials && e.includeSocials.checked),
    };
  }

  function renderAudienceHint() {
    var e = els();
    if (!e.audienceHint) return;
    var slices = (state.bootstrap && state.bootstrap.audienceSlices) || [];
    var selected = (e.audienceSlice && e.audienceSlice.value) || 'all';
    var match = slices.find(function (s) {
      return String(s.id) === String(selected);
    });
    if (!match) {
      e.audienceHint.textContent = '';
      return;
    }
    e.audienceHint.textContent =
      (match.count || 0) +
      ' people in this slice' +
      (match.blurb ? ' · ' + match.blurb : '');
  }

  function renderReplyHint(replyTo) {
    var el = els().replyHint;
    if (!el) return;
    var addr = String(replyTo || '').trim();
    if (addr) {
      el.textContent =
        'Replies go to ' + addr + ' — attendees can write you back from the round-up.';
    } else {
      el.textContent =
        'Add a contact email on your organiser page so replies reach you (not just the Hub).';
    }
  }

  function renderMonthStatsHint(stats) {
    var el = els().statsHint;
    if (!el) return;
    if (!stats || !(stats.eventsHosted || stats.uniqueGuests || stats.bookings || stats.rating)) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    var bits = [];
    if (stats.eventsHosted) bits.push(stats.eventsHosted + ' event' + (stats.eventsHosted === 1 ? '' : 's'));
    if (stats.uniqueGuests) bits.push(stats.uniqueGuests + ' guest' + (stats.uniqueGuests === 1 ? '' : 's'));
    else if (stats.bookings) bits.push(stats.bookings + ' booking' + (stats.bookings === 1 ? '' : 's'));
    if (stats.rating != null) bits.push(stats.rating + ' Hub rating');
    el.hidden = false;
    el.textContent =
      'This month so far: ' + bits.join(' · ') + ' — included automatically when the stats module is on.';
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
      'Free remaining for this page: <strong>' +
        allowance.freeRemaining +
        '</strong> · Extra credits: <strong>' +
        allowance.extraCredits +
        '</strong>'
    );
    bits.push(
      'Audience estimate: <strong>' +
        (function () {
          var e = els();
          var selected = (e.audienceSlice && e.audienceSlice.value) || 'all';
          var slices = (state.bootstrap && state.bootstrap.audienceSlices) || [];
          var match = slices.find(function (s) {
            return String(s.id) === String(selected);
          });
          if (match) return match.count || 0;
          return recipientEstimate || 0;
        })() +
        '</strong> in the selected slice'
    );
    if (!allowance.canSend) {
      bits.push(
        allowance.blockedReason === 'hard_cap'
          ? 'You’ve hit this page’s send limit for the month. Unused credits roll into next month.'
          : 'This page’s free send is used. Buy an extra credit to send again this month (max ' +
              allowance.hardCapPerMonth +
              ').'
      );
    } else if (allowance.freeRemaining > 0) {
      bits.push('Each organiser page gets its own free monthly update.');
    } else if (allowance.extraCredits > 0) {
      bits.push('Your next send will use 1 extra credit.');
    }

    var packs = (state.bootstrap && state.bootstrap.creditPacks) || state.creditPacks || [];
    if (packs.length && state.organiserId) {
      bits.push(
        '<span class="ogu-credit-buy-label">Buy extra sends</span> ' +
          packs
            .map(function (p) {
              return (
                '<button type="button" class="org-btn org-btn-outline org-btn-sm ogu-buy-credits" data-pack-id="' +
                String(p.id) +
                '">' +
                (p.label || p.id + ' credit') +
                ' · ' +
                (p.amountLabel || '') +
                '</button>'
              );
            })
            .join(' ')
      );
    }

    el.innerHTML = bits.map(function (b) {
      return '<p>' + b + '</p>';
    }).join('');
    var sendBtn = els().send;
    if (sendBtn) sendBtn.disabled = !allowance.canSend;
  }

  async function buyCredits(packId) {
    if (!state.organiserId) {
      setStatus('Choose an organiser page first.', 'error');
      return;
    }
    setStatus('Opening secure checkout…');
    var res = await api('/api/organiser/group-update-credits-checkout', {
      method: 'POST',
      body: JSON.stringify({
        organiserId: state.organiserId,
        packId: packId,
      }),
    });
    if (!res.ok || !res.data || !res.data.ok || !res.data.url) {
      throw new Error((res.data && (res.data.message || res.data.error)) || 'Checkout failed');
    }
    window.location.href = res.data.url;
  }

  async function completeCreditsPurchase(sessionId) {
    var sid = String(sessionId || '').trim();
    if (!sid) return;
    setStatus('Confirming your credit purchase…');
    var res = await api('/api/organiser/group-update-credits-complete', {
      method: 'POST',
      body: JSON.stringify({ sessionId: sid }),
    });
    if (!res.ok || !res.data || !res.data.ok) {
      throw new Error((res.data && (res.data.message || res.data.error)) || 'Could not confirm purchase');
    }
    var added =
      (res.data.result && res.data.result.creditsAdded) ||
      (res.data.result && res.data.result.alreadyApplied ? 'your' : '');
    setStatus(
      added
        ? 'Payment received — ' +
            (res.data.result.alreadyApplied ? 'credits already on this page.' : added + ' credit(s) added.')
        : 'Payment received — credits updated.',
      'ok'
    );
    try {
      var url = new URL(window.location.href);
      url.searchParams.delete('credits_session');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch (e) {
      /* ignore */
    }
    await loadBootstrap();
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
          var status = String(u.status || '');
          var isDraft = status === 'draft';
          var canReport = status === 'sent' || status === 'queued' || status === 'sending';
          var meta = isDraft
            ? 'Draft · click to open'
            : canReport
              ? status + (u.sent_count ? ' · ' + u.sent_count + ' sent' : '') + ' · view report'
              : status + (u.sent_count ? ' · ' + u.sent_count + ' sent' : '');
          var tag =
            isDraft || canReport
              ? 'button type="button" class="ogu-history-open" data-update-id="' +
                u.id +
                '"' +
                (canReport ? ' data-report="1"' : '')
              : 'div class="ogu-history-item"';
          var close = isDraft || canReport ? 'button' : 'div';
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

  function renderReport(report) {
    var el = els().report;
    if (!el) return;
    if (!report) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    var links =
      report.topLinks && report.topLinks.length
        ? '<ul class="ogu-report-links">' +
          report.topLinks
            .map(function (l) {
              return (
                '<li><span>' +
                l.clicks +
                ' clicks</span> · <a href="' +
                String(l.url || '#').replace(/"/g, '') +
                '" target="_blank" rel="noopener">' +
                String(l.url || '').replace(/^https?:\/\//, '').slice(0, 48) +
                '</a></li>'
              );
            })
            .join('') +
          '</ul>'
        : '<p class="org-group-update-hint">No link clicks yet.</p>';
    el.hidden = false;
    el.innerHTML =
      '<h3 class="org-section-title">Engagement report</h3>' +
      '<p class="org-group-update-hint">' +
      (report.subject || 'Update') +
      '</p>' +
      '<dl class="ogu-report-stats">' +
      '<div><dt>Sent</dt><dd>' +
      report.sent +
      '</dd></div>' +
      '<div><dt>Opened</dt><dd>' +
      report.opened +
      ' <span>(' +
      report.openRate +
      '%)</span></dd></div>' +
      '<div><dt>Clicked</dt><dd>' +
      report.clicked +
      ' <span>(' +
      report.clickRate +
      '%)</span></dd></div>' +
      '<div><dt>Booked after</dt><dd>' +
      report.bookingsAfter +
      '</dd></div>' +
      '</dl>' +
      '<p class="org-group-update-hint">Booked after = unique recipients who booked one of your Hub events after this send.</p>' +
      links;
  }

  async function loadReport(updateId) {
    if (!state.organiserId || !updateId) return;
    setStatus('Loading engagement report…');
    var res = await api(
      '/api/organiser/group-updates?action=report&organiserId=' +
        encodeURIComponent(state.organiserId) +
        '&id=' +
        encodeURIComponent(updateId)
    );
    if (!res.ok || !res.data || !res.data.ok) {
      throw new Error((res.data && (res.data.message || res.data.error)) || 'Could not load report');
    }
    renderReport(res.data.report);
    setStatus('Engagement report updated.', 'ok');
  }

  function subjectMatchesGroup(subject, orgName) {
    var sub = String(subject || '').trim().toLowerCase();
    var name = String(orgName || '').trim().toLowerCase();
    if (!sub || !name) return false;
    return sub.indexOf(name) !== -1;
  }

  function applyDefaultSubject(defaults, orgName) {
    var e = els();
    if (!e.subject) return;
    var next =
      (defaults && defaults.subject) ||
      (orgName ? String(orgName).trim() + ' update' : '');
    if (next) e.subject.value = next;
  }

  function clearComposer() {
    var e = els();
    state.updateId = '';
    state.dirty = false;
    if (e.subject) e.subject.value = '';
    if (e.note) e.note.value = '';
    if (e.recap) e.recap.value = '';
    if (e.includeEvents) e.includeEvents.checked = true;
    if (e.includeGreeting) e.includeGreeting.checked = true;
    if (e.includeStats) e.includeStats.checked = true;
    if (e.spotlightName) e.spotlightName.value = '';
    if (e.spotlightCompany) e.spotlightCompany.value = '';
    if (e.spotlightText) e.spotlightText.value = '';
    if (e.spotlightLinkedin) e.spotlightLinkedin.value = '';
    if (e.ask) e.ask.value = '';
    if (e.volunteer) e.volunteer.value = '';
    if (e.includeSocials) e.includeSocials.checked = true;
    if (e.audienceSlice) e.audienceSlice.value = 'all';
    if (e.previewBody) e.previewBody.innerHTML = '';
    renderReport(null);
    renderEvents((state.bootstrap && state.bootstrap.events) || [], []);
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
    if (e.includeGreeting) e.includeGreeting.checked = c.includeGreeting !== false;
    if (e.includeStats) e.includeStats.checked = c.includeMonthStats !== false;
    if (e.audienceSlice) e.audienceSlice.value = c.audienceSlice || 'all';
    if (e.spotlightName) e.spotlightName.value = c.spotlightName || '';
    if (e.spotlightCompany) e.spotlightCompany.value = c.spotlightCompany || '';
    if (e.spotlightText) e.spotlightText.value = c.spotlightText || '';
    if (e.spotlightLinkedin) e.spotlightLinkedin.value = c.spotlightLinkedin || '';
    if (e.ask) e.ask.value = c.memberAsk || '';
    if (e.volunteer) e.volunteer.value = c.volunteerCta || '';
    if (e.includeSocials) e.includeSocials.checked = c.includeSocialLinks !== false;
    renderAudienceHint();
    renderEvents((state.bootstrap && state.bootstrap.events) || [], c.eventIds || []);
    state.dirty = false;
  }

  function openUpdateFromHistory(updateId, asReport) {
    var updates = (state.bootstrap && state.bootstrap.updates) || [];
    var found = updates.find(function (u) {
      return String(u.id) === String(updateId);
    });
    if (!found) {
      setStatus('Could not open that update.', 'error');
      return;
    }
    if (asReport || (found.status !== 'draft' && found.status !== 'cancelled')) {
      loadReport(found.id).catch(function (err) {
        setStatus(friendlyError(err) || 'Could not load report.', 'error');
      });
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
            setStatus(friendlyError(err) || 'Could not auto-save draft.', 'error');
          }
        });
    }, 1200);
  }

  async function switchOrganiserPage(nextId) {
    var id = String(nextId || '').trim();
    if (!id || id === String(state.organiserId)) return;
    cancelAutosave();
    state.switchingGroup = true;
    state.saveGeneration = (state.saveGeneration || 0) + 1;
    state.dirty = false;
    state.organiserId = id;
    state.updateId = '';
    clearComposer();
    try {
      await loadBootstrap();
    } finally {
      state.switchingGroup = false;
      if (state.dirty) scheduleAutosave();
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
    state.creditPacks = res.data.creditPacks || state.creditPacks || [];
    renderAllowance(res.data.allowance, res.data.recipientEstimate);
    renderMonthStatsHint(res.data.monthStats);
    renderReplyHint(res.data.replyTo);
    renderAudienceHint();
    renderEvents(res.data.events || [], []);
    renderHistory(res.data.updates || []);
    renderReport(null);
    var updates = res.data.updates || [];
    var remembered = recalledDraftId(state.organiserId);
    var draft =
      updates.find(function (u) {
        return u.status === 'draft' && String(u.id) === String(remembered);
      }) ||
      updates.find(function (u) {
        return u.status === 'draft';
      });
    var orgName =
      (res.data.allowance && res.data.allowance.organiserName) ||
      (res.data.group && res.data.group.name) ||
      '';
    if (draft) {
      fillFromUpdate(draft);
      // Always keep the subject aligned to this organiser page when switching.
      if (!subjectMatchesGroup(e.subject && e.subject.value, orgName)) {
        applyDefaultSubject(res.data.defaults, orgName);
        state.dirty = true;
      }
      setStatus(
        'Loaded your saved draft for ' +
          ((res.data.allowance && res.data.allowance.periodLabel) || 'this month') +
          '.',
        'ok'
      );
    } else {
      clearComposer();
      applyDefaultSubject(res.data.defaults, orgName);
      setStatus(
        (res.data.recipientEstimate || 0) +
          ' people who booked via the Hub can receive this update.',
        'ok'
      );
    }
  }

  async function saveDraft(options) {
    options = options || {};
    if (state.switchingGroup) return null;
    var organiserIdAtStart = String(state.organiserId || '');
    var updateIdAtStart = String(state.updateId || '');
    var generationAtStart = state.saveGeneration || 0;
    var e = els();
    if (e.save && !options.silent) {
      e.save.disabled = true;
      e.save.textContent = 'Saving…';
    }
    try {
      var subjectValue = e.subject ? e.subject.value : '';
      var contentValue = readContent();
      if (state.switchingGroup || String(state.organiserId || '') !== organiserIdAtStart) {
        return null;
      }
      var res = await api('/api/organiser/group-updates', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save',
          organiserId: organiserIdAtStart,
          id: updateIdAtStart || undefined,
          subject: subjectValue,
          content: contentValue,
        }),
      });
      if (state.switchingGroup || (state.saveGeneration || 0) !== generationAtStart) {
        return null;
      }
      if (String(state.organiserId || '') !== organiserIdAtStart) {
        return null;
      }
      if (!res.ok || !res.data || !res.data.ok) {
        throw new Error((res.data && (res.data.message || res.data.error)) || 'Save failed');
      }
      state.updateId = res.data.update && res.data.update.id;
      rememberDraftId(organiserIdAtStart, state.updateId);
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
          setStatus(friendlyError(err) || 'Could not switch organiser page.', 'error');
        });
      });
    }
    if (e.history) {
      e.history.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-update-id]');
        if (!btn) return;
        openUpdateFromHistory(btn.getAttribute('data-update-id'), btn.getAttribute('data-report') === '1');
      });
    }
    if (e.audienceSlice) {
      e.audienceSlice.addEventListener('change', function () {
        renderAudienceHint();
        if (state.bootstrap && state.bootstrap.allowance) {
          renderAllowance(state.bootstrap.allowance, state.bootstrap.recipientEstimate);
        }
        scheduleAutosave();
      });
    }
    var allowanceEl = els().allowance;
    if (allowanceEl) {
      allowanceEl.addEventListener('click', function (ev) {
        var btn = ev.target.closest('.ogu-buy-credits');
        if (!btn) return;
        buyCredits(btn.getAttribute('data-pack-id')).catch(function (err) {
          setStatus(friendlyError(err) || 'Could not open checkout.', 'error');
        });
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
          setStatus(friendlyError(err) || 'Save failed', 'error');
        });
      });
    }
    if (e.preview) {
      e.preview.addEventListener('click', function () {
        preview().catch(function (err) {
          setStatus(friendlyError(err) || 'Preview failed', 'error');
        });
      });
    }
    if (e.send) {
      e.send.addEventListener('click', function () {
        sendUpdate().catch(function (err) {
          setStatus(friendlyError(err) || 'Send failed', 'error');
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
    var pendingSession = '';
    try {
      pendingSession = new URLSearchParams(window.location.search).get('credits_session') || '';
    } catch (e) {
      pendingSession = '';
    }
    await loadBootstrap();
    if (pendingSession) {
      await completeCreditsPurchase(pendingSession).catch(function (err) {
        setStatus(friendlyError(err) || 'Payment received, but credits need a moment to appear — refresh shortly.', 'error');
      });
    }
  }

  global.HubOrganiserGroupUpdates = {
    init: init,
    refresh: loadBootstrap,
    syncGroups: syncGroupOptions,
  };
})(typeof window !== 'undefined' ? window : global);
