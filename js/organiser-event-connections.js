/**
 * Organiser event connections email — pick an event, preview guests, send list.
 */
(function (global) {
  'use strict';

  var state = {
    groups: [],
    events: [],
    preview: null,
    omittedEmails: {},
    sending: false,
    bound: false,
    engagementPollTimer: null,
    creditPacks: [],
  };

  function els() {
    return {
      status: document.getElementById('oec-status'),
      usage: document.getElementById('oec-usage'),
      group: document.getElementById('oec-group'),
      groupWrap: document.getElementById('oec-group-wrap'),
      event: document.getElementById('oec-event'),
      details: document.getElementById('oec-details'),
      engagement: document.getElementById('oec-engagement'),
      engagementStats: document.getElementById('oec-engagement-stats'),
      engagementRefresh: document.getElementById('oec-engagement-refresh'),
      subject: document.getElementById('oec-subject'),
      fromName: document.getElementById('oec-from-name'),
      note: document.getElementById('oec-note'),
      omitWrap: document.getElementById('oec-omit-wrap'),
      omitHint: document.getElementById('oec-omit-hint'),
      omitList: document.getElementById('oec-omit-list'),
      previewBtn: document.getElementById('oec-preview'),
      sendBtn: document.getElementById('oec-send'),
      previewBody: document.getElementById('oec-preview-body'),
      count: document.getElementById('oec-count'),
      modeRadios: document.querySelectorAll('input[name="oec-list-kind"]'),
    };
  }

  function selectedListKind() {
    var radios = els().modeRadios;
    for (var i = 0; i < radios.length; i++) {
      if (radios[i].checked) return String(radios[i].value || 'attended');
    }
    return 'attended';
  }

  function setListKind(kind) {
    var value = kind === 'going' ? 'going' : 'attended';
    var radios = els().modeRadios;
    for (var i = 0; i < radios.length; i++) {
      radios[i].checked = String(radios[i].value) === value;
      var option = radios[i].closest('.org-attendee-email-mode-option');
      if (option) {
        var allowed =
          !state.preview ||
          !state.preview.allowedListKinds ||
          state.preview.allowedListKinds.indexOf(String(radios[i].value)) !== -1;
        radios[i].disabled = !allowed;
        option.classList.toggle('is-disabled', !allowed);
      }
    }
  }

  function setStatus(msg, kind) {
    var el = els().status;
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('is-error', kind === 'error');
    el.classList.toggle('is-ok', kind === 'ok');
  }

  function selectedGroupId() {
    var e = els();
    if (e.group && String(e.group.value || '').trim()) return String(e.group.value).trim();
    var groups = state.groups || [];
    if (groups.length === 1 && groups[0] && groups[0].id) return String(groups[0].id);
    return '';
  }

  function selectedGroupName() {
    var id = selectedGroupId();
    var groups = state.groups || [];
    for (var i = 0; i < groups.length; i++) {
      if (String(groups[i].id) === id) return String(groups[i].name || 'this organiser page').trim();
    }
    return 'this organiser page';
  }

  function allowanceFromEvents(groupId) {
    var list = state.events || [];
    var latest = null;
    list.forEach(function (ev) {
      var evGroup = String(
        ev.organiserGroupId || ev.organiserId || ev.organiser_id || ev.groupId || ''
      );
      if (groupId && evGroup && evGroup !== groupId) return;
      var at = ev.connectionsEmailSentAt || ev.connections_email_sent_at || null;
      if (!at) return;
      var ms = new Date(at).getTime();
      if (!Number.isFinite(ms)) return;
      if (!latest || ms > latest.ms) {
        latest = {
          ms: ms,
          lastSentAt: at,
          lastSentCount: Number(ev.connectionsEmailSentCount || ev.connections_email_sent_count) || 0,
          lastSentEventId: ev.id || null,
        };
      }
    });
    if (!latest) {
      return { freeAllowanceUsed: false, lastSentAt: null, lastSentCount: 0, lastSentEventId: null };
    }
    return {
      freeAllowanceUsed: true,
      lastSentAt: latest.lastSentAt,
      lastSentCount: latest.lastSentCount,
      lastSentEventId: latest.lastSentEventId,
    };
  }

  function setUsage(preview) {
    var el = els().usage;
    if (!el) return;
    var freeUsed = Boolean(
      preview
        ? preview.freeAllowanceUsed
        : allowanceFromEvents(selectedGroupId()).freeAllowanceUsed
    );
    var last =
      preview && (preview.lastSentAt || preview.freeAllowanceUsed)
        ? {
            lastSentAt: preview.lastSentAt || null,
            lastSentCount: Number(preview.lastSentCount) || 0,
          }
        : allowanceFromEvents(selectedGroupId());
    var extraCredits =
      preview && preview.extraCredits != null
        ? Number(preview.extraCredits) || 0
        : state.preview && state.preview.extraCredits != null
          ? Number(state.preview.extraCredits) || 0
          : 0;
    var packs =
      (preview && preview.creditPacks) ||
      state.creditPacks ||
      (state.preview && state.preview.creditPacks) ||
      [];
    if (packs.length) state.creditPacks = packs;
    var pageName = selectedGroupName();
    var canSend = preview && preview.canSend != null ? Boolean(preview.canSend) : !freeUsed || extraCredits > 0;
    var nextBillable = (preview && preview.nextBillable) || (freeUsed ? (extraCredits > 0 ? 'extra' : 'none') : 'free');

    el.hidden = false;
    el.classList.toggle('is-used', freeUsed && extraCredits < 1);
    el.classList.toggle('has-credits', freeUsed && extraCredits > 0);

    var bits = [];
    if (!freeUsed) {
      bits.push(
        'Free send still available for <strong>' +
          esc(pageName) +
          '</strong> — one Attendee round-up included.'
      );
    } else {
      var when = '';
      try {
        when = last.lastSentAt ? new Date(last.lastSentAt).toLocaleString('en-GB') : '';
      } catch (e) {
        when = String(last.lastSentAt || '');
      }
      bits.push(
        'Free send used for <strong>' +
          esc(pageName) +
          '</strong>' +
          (when ? ' · Last sent ' + esc(when) : '') +
          (last.lastSentCount ? ' to ' + esc(last.lastSentCount) + ' people' : '') +
          '.'
      );
      bits.push(
        'Extra credits: <strong>' +
          esc(extraCredits) +
          '</strong>' +
          (nextBillable === 'extra' ? ' — your next send uses 1 credit.' : '')
      );
    }

    if (packs.length && selectedGroupId()) {
      bits.push(
        '<span class="oec-credit-buy-label">Buy extra sends</span> ' +
          packs
            .map(function (p) {
              return (
                '<button type="button" class="org-btn org-btn-outline org-btn-sm oec-buy-credits" data-pack-id="' +
                esc(p.id) +
                '">' +
                esc(p.label || p.id + ' credit') +
                ' · ' +
                esc(p.amountLabel || '') +
                '</button>'
              );
            })
            .join(' ')
      );
    } else if (freeUsed && !canSend) {
      bits.push('Extra sends are a paid add-on — packs appear here once checkout is ready.');
    }

    el.innerHTML = bits.map(function (b) {
      return '<p>' + b + '</p>';
    }).join('');

    var sendBtn = els().sendBtn;
    if (sendBtn && !state.sending) {
      var hasEvent = Boolean(els().event && String(els().event.value || '').trim());
      sendBtn.disabled = !hasEvent || !canSend;
    }
  }

  async function buyCredits(packId) {
    var organiserId = selectedGroupId();
    if (!organiserId) {
      setStatus('Choose an organiser page first.', 'error');
      return;
    }
    setStatus('Opening secure checkout…');
    var res = await api('/api/organiser/connections-credits-checkout', {
      method: 'POST',
      body: {
        organiserId: organiserId,
        packId: packId,
      },
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
    var res = await api('/api/organiser/connections-credits-complete', {
      method: 'POST',
      body: { sessionId: sid },
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
            (res.data.result.alreadyApplied
              ? 'credits already on this page.'
              : added + ' credit(s) added.')
        : 'Payment received — credits updated.',
      'ok'
    );
    try {
      var url = new URL(window.location.href);
      url.searchParams.delete('connections_credits_session');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch (e) {
      /* ignore */
    }
    if (els().event && els().event.value) {
      await loadPreview();
    } else if (res.data.allowance) {
      setUsage(
        Object.assign({}, state.preview || {}, {
          freeAllowanceUsed: res.data.allowance.freeAllowanceUsed,
          lastSentAt: res.data.allowance.lastSentAt,
          lastSentCount: res.data.allowance.lastSentCount,
          extraCredits: res.data.allowance.extraCredits,
          canSend: res.data.allowance.canSend,
          nextBillable: res.data.allowance.nextBillable,
          creditPacks: res.data.allowance.creditPacks || state.creditPacks,
        })
      );
    }
  }

  function syncFormReadyState() {
    var e = els();
    var hasEvent = Boolean(e.event && String(e.event.value || '').trim());
    if (e.details) e.details.classList.toggle('is-waiting', !hasEvent);
    if (e.previewBtn) e.previewBtn.disabled = !hasEvent;
    if (e.sendBtn && !state.sending) e.sendBtn.disabled = !hasEvent;
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
    var startMs = NaN;
    if (ev.startsAt || ev.starts_at || ev.date) {
      try {
        startMs = new Date(ev.startsAt || ev.starts_at || ev.date).getTime();
        when = new Date(ev.startsAt || ev.starts_at || ev.date).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      } catch (e) {
        when = '';
      }
    }
    var timing = '';
    if (Number.isFinite(startMs)) {
      timing = startMs > Date.now() ? 'Upcoming' : 'Past';
    }
    var parts = [];
    if (timing) parts.push(timing);
    parts.push(title);
    if (when) parts.push(when);
    return parts.join(' · ');
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
    syncFormReadyState();
    setUsage(state.preview && String(state.preview.eventId || '') === String(e.event.value || '')
      ? state.preview
      : null);
  }

  function defaultFromName(preview) {
    var e = els();
    if (!e.fromName || String(e.fromName.value || '').trim()) return;
    if (preview && preview.organiserName) {
      e.fromName.value = preview.organiserName;
    }
  }

  function includedAttendees(preview) {
    var list = (preview && preview.attendees) || [];
    return list.filter(function (a) {
      return !state.omittedEmails[String(a.email || '').toLowerCase()];
    });
  }

  function excludedEmailList(preview) {
    var list = (preview && preview.attendees) || [];
    return list
      .filter(function (a) {
        return state.omittedEmails[String(a.email || '').toLowerCase()];
      })
      .map(function (a) {
        return String(a.email || '').toLowerCase();
      });
  }

  function renderOmitList(preview) {
    var e = els();
    if (!e.omitWrap || !e.omitList) return;
    if (!preview || !(preview.attendees || []).length) {
      e.omitWrap.hidden = true;
      e.omitList.innerHTML = '';
      return;
    }
    e.omitWrap.hidden = false;
    if (e.omitHint) {
      e.omitHint.textContent =
        preview.listKind === 'attended'
          ? 'Untick anyone who did not attend — they are left off this email and marked as did not attend (no review email).'
          : 'Untick anyone who should be left out of the email and the shared list.';
    }
    e.omitList.innerHTML = (preview.attendees || [])
      .map(function (a) {
        var email = String(a.email || '').toLowerCase();
        var checked = !state.omittedEmails[email];
        var meta = [a.jobTitle, a.company].filter(Boolean).join(' · ');
        return (
          '<label class="org-attendee-email-omit-item">' +
          '<input type="checkbox" data-oec-omit-email="' +
          esc(email) +
          '"' +
          (checked ? ' checked' : '') +
          ' />' +
          '<span><strong>' +
          esc(a.name) +
          '</strong>' +
          (meta ? '<em>' + esc(meta) + '</em>' : '') +
          '<i>' +
          esc(a.email) +
          '</i></span></label>'
        );
      })
      .join('');
  }

  function updateCountLabel(preview) {
    var e = els();
    if (!e.count || !preview) {
      if (e.count) e.count.textContent = '';
      return;
    }
    var included = includedAttendees(preview);
    var omitted = (preview.attendees || []).length - included.length;
    e.count.textContent =
      included.length +
      ' guest' +
      (included.length === 1 ? '' : 's') +
      ' included' +
      (omitted ? ' · ' + omitted + ' omitted' : '') +
      ' — each receives the list minus themselves';
  }

  function renderEngagement(preview) {
    var e = els();
    if (!e.engagement || !e.engagementStats) return;
    var eng = preview && preview.engagement;
    if (!eng || !eng.hasSend) {
      e.engagement.hidden = true;
      e.engagementStats.innerHTML = '';
      if (e.engagementRefresh) e.engagementRefresh.hidden = true;
      return;
    }
    e.engagement.hidden = false;
    if (e.engagementRefresh) e.engagementRefresh.hidden = false;
    var when = '';
    try {
      when = eng.sentAt ? new Date(eng.sentAt).toLocaleString('en-GB') : '';
    } catch (err) {
      when = String(eng.sentAt || '');
    }
    e.engagementStats.innerHTML =
      '<div><dt>Sent</dt><dd>' +
      esc(eng.sent) +
      (when ? '<span>' + esc(when) + '</span>' : '') +
      '</dd></div>' +
      '<div><dt>Opened</dt><dd>' +
      esc(eng.opened) +
      '<span>' +
      esc(eng.openRate) +
      '%</span></dd></div>' +
      '<div><dt>Clicked</dt><dd>' +
      esc(eng.clicked) +
      '<span>' +
      esc(eng.clickRate) +
      '%</span></dd></div>';
  }

  function scheduleEngagementPoll() {
    if (state.engagementPollTimer) {
      clearTimeout(state.engagementPollTimer);
      state.engagementPollTimer = null;
    }
    var tries = 0;
    function tick() {
      tries += 1;
      var e = els();
      if (!e.event || !e.event.value) return;
      loadPreview()
        .catch(function () {})
        .finally(function () {
          if (tries < 4) {
            state.engagementPollTimer = setTimeout(tick, 20000);
          }
        });
    }
    state.engagementPollTimer = setTimeout(tick, 15000);
  }

  function renderPreview(preview) {
    var e = els();
    state.preview = preview || null;
    setUsage(preview);
    syncFormReadyState();
    renderEngagement(preview);
    if (preview) setListKind(preview.listKind || selectedListKind());
    renderOmitList(preview);
    updateCountLabel(preview);
    if (!e.previewBody) return;
    if (!preview) {
      e.previewBody.innerHTML =
        '<p class="org-attendee-email-hint">Pick an event to preview the round-up your guests will receive.</p>';
      return;
    }
    if (e.subject) {
      e.subject.value = preview.defaultSubject || e.subject.value || '';
      e.subject.placeholder =
        preview.listKind === 'going' ? 'Who’s going — your event title' : 'Who attended — your event title';
    }
    defaultFromName(preview);
    var fromText = e.fromName ? String(e.fromName.value || '').trim() : '';
    var noteText = e.note ? String(e.note.value || '').trim() : '';
    var logoHtml = preview.organiserLogoUrl
      ? '<img class="org-attendee-email-mock-logo" src="' +
        esc(preview.organiserLogoUrl) +
        '" alt="' +
        esc(preview.organiserName || 'Organiser logo') +
        '" />'
      : '';
    var noteHtml =
      '<div class="org-attendee-email-mock-note">' +
      logoHtml +
      '<strong>From ' +
      esc(fromText || preview.organiserName || 'your group') +
      '</strong>' +
      (noteText ? '<p>' + esc(noteText) + '</p>' : '<p>Shared so guests can keep networking.</p>') +
      '</div>';
    var last = preview.lastSentAt
      ? '<p class="org-attendee-email-mock-sent">Free send used · Last sent ' +
        esc(new Date(preview.lastSentAt).toLocaleString('en-GB')) +
        (preview.lastSentCount ? ' · ' + preview.lastSentCount + ' people' : '') +
        '</p>'
      : '';
    var included = includedAttendees(preview);
    var rows = included
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
    var title =
      preview.copyHeadline ||
      (preview.listKind === 'going' ? 'Who’s going ' : 'Who attended ') +
        (preview.eventTitle || '');
    e.previewBody.innerHTML =
      '<p class="org-attendee-email-mock-kicker">' +
      esc(preview.copyKicker || (preview.listKind === 'going' ? 'Who’s going' : 'Attendee round-up')) +
      '</p>' +
      '<h4 class="org-attendee-email-mock-title">' +
      esc(title) +
      '</h4>' +
      '<p class="org-attendee-email-mock-lede">' +
      (preview.eventDate ? esc(preview.eventDate) + ' · ' : '') +
      (preview.listKind === 'going'
        ? 'Before the event — confirmed bookings only.'
        : 'After the event has started — reconnect guests who came.') +
      '</p>' +
      noteHtml +
      '<div class="org-attendee-email-mock-meta">' +
      '<span class="org-attendee-email-mock-count">' +
      included.length +
      ' guest' +
      (included.length === 1 ? '' : 's') +
      '</span>' +
      last +
      '</div>' +
      (rows
        ? '<ul class="oec-preview-list">' + rows + '</ul>'
        : '<p class="org-attendee-email-hint">No guests included yet.</p>');
  }

  function refreshNoteInPreview() {
    if (state.preview) renderPreview(state.preview);
  }

  function eventById(eventId) {
    var id = String(eventId || '');
    for (var i = 0; i < (state.events || []).length; i++) {
      if (String(state.events[i].id) === id) return state.events[i];
    }
    return null;
  }

  function syncModeForSelectedEvent() {
    var e = els();
    var eventId = e.event ? String(e.event.value || '').trim() : '';
    if (!eventId) return;
    var ev = eventById(eventId);
    if (!ev) return;
    var startMs = new Date(ev.startsAt || ev.starts_at || ev.date || 0).getTime();
    if (!Number.isFinite(startMs)) return;
    setListKind(startMs > Date.now() ? 'going' : 'attended');
  }

  async function loadPreview() {
    var e = els();
    var eventId = e.event ? String(e.event.value || '').trim() : '';
    if (!eventId) {
      setStatus('Pick an event to continue.');
      renderPreview(null);
      syncFormReadyState();
      return null;
    }
    syncModeForSelectedEvent();
    var listKind = selectedListKind();
    setStatus('Loading guests…');
    var res = await api(
      '/api/organiser/event-connections?eventId=' +
        encodeURIComponent(eventId) +
        '&listKind=' +
        encodeURIComponent(listKind)
    );
    if (!res.ok) {
      setStatus(res.data.message || res.data.error || 'Could not load guests.', 'error');
      state.omittedEmails = {};
      renderPreview(null);
      return null;
    }
    if (res.data.listKind && res.data.listKind !== listKind) {
      setListKind(res.data.listKind);
    }
    // Keep omit choices only for emails still on this list.
    var nextOmit = {};
    (res.data.attendees || []).forEach(function (a) {
      var email = String(a.email || '').toLowerCase();
      if (email && state.omittedEmails[email]) nextOmit[email] = true;
    });
    state.omittedEmails = nextOmit;
    renderPreview(res.data);
    if (res.data.timingError && res.data.timingError.message) {
      setStatus(res.data.timingError.message, 'error');
    } else {
      var included = includedAttendees(res.data);
      setStatus(
        included.length +
          ' guest' +
          (included.length === 1 ? '' : 's') +
          ' will receive the list (minus themselves). ' +
          (res.data.listKind === 'attended'
            ? 'Untick anyone who did not attend — they skip the review email too.'
            : 'Untick anyone you want to omit.'),
        'ok'
      );
    }
    return res.data;
  }

  async function send() {
    var e = els();
    if (state.sending) return;
    var eventId = e.event ? String(e.event.value || '').trim() : '';
    if (!eventId) {
      setStatus('Pick an event to continue.');
      syncFormReadyState();
      return;
    }
    var listKind = selectedListKind();
    var preview = state.preview;
    if (!preview || preview.eventId !== eventId || preview.listKind !== listKind) {
      preview = await loadPreview();
      if (!preview) return;
    }
    if (preview.timingError && preview.timingError.message) {
      setStatus(preview.timingError.message, 'error');
      return;
    }
    if (preview.canSend === false) {
      setStatus(
        preview.blockedReason === 'credits_not_ready'
          ? 'Extra credits aren’t available yet — try again shortly.'
          : 'Your free send is used. Buy an extra send above to email another guest list.',
        'error'
      );
      return;
    }
    var included = includedAttendees(preview);
    if (included.length < 2) {
      setStatus('Include at least two guests in the round-up.', 'error');
      return;
    }
    var label = listKind === 'going' ? 'who’s going list' : 'attendee round-up';
    var omitted = excludedEmailList(preview).length;
    var billable = preview.nextBillable === 'extra' ? ' Uses 1 extra send credit.' : ' Uses your one free send for this organiser page.';
    var noShowNote =
      listKind === 'attended' && omitted
        ? ' Omitted guests will be marked as did not attend and will not get a review email.'
        : '';
    var confirmMsg =
      'Send the ' +
      label +
      ' to ' +
      included.length +
      ' guest' +
      (included.length === 1 ? '' : 's') +
      (omitted ? ' (' + omitted + ' omitted)' : '') +
      '?' +
      noShowNote +
      billable;
    if (!global.confirm(confirmMsg)) return;

    state.sending = true;
    if (e.sendBtn) e.sendBtn.disabled = true;
    setStatus('Sending…');
    try {
      var res = await api('/api/organiser/event-connections', {
        method: 'POST',
        body: {
          eventId: eventId,
          listKind: listKind,
          subject: e.subject ? e.subject.value : '',
          fromName: e.fromName ? e.fromName.value : '',
          organiserNote: e.note ? e.note.value : '',
          excludeEmails: excludedEmailList(preview),
        },
      });
      if (!res.ok) {
        setStatus(res.data.message || res.data.error || 'Send failed.', 'error');
        if (res.status === 402) setUsage(preview);
        return;
      }
      setStatus(res.data.message || 'Sent.', 'ok');
      var sentEv = eventById(eventId);
      if (sentEv) {
        sentEv.connectionsEmailSentAt = new Date().toISOString();
        sentEv.connections_email_sent_at = sentEv.connectionsEmailSentAt;
        sentEv.connectionsEmailSentCount = included.length;
        sentEv.connections_email_sent_count = included.length;
      }
      await loadPreview();
      scheduleEngagementPoll();
      var engEl = els().engagement;
      if (engEl && engEl.scrollIntoView) {
        engEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } finally {
      state.sending = false;
      syncFormReadyState();
    }
  }

  function bind() {
    if (state.bound) return;
    state.bound = true;
    var e = els();
    if (e.group) {
      e.group.addEventListener('change', function () {
        fillEvents();
        state.omittedEmails = {};
        renderPreview(null);
        setStatus('Pick an event to continue.');
        setUsage(null);
        syncFormReadyState();
      });
    }
    if (e.event) {
      e.event.addEventListener('change', function () {
        state.omittedEmails = {};
        renderPreview(null);
        setStatus('');
        syncFormReadyState();
        if (e.event.value) loadPreview().catch(function () {});
        else {
          setStatus('Pick an event to continue.');
          setUsage(null);
        }
      });
    }
    if (e.modeRadios && e.modeRadios.length) {
      Array.prototype.forEach.call(e.modeRadios, function (radio) {
        radio.addEventListener('change', function () {
          if (e.subject) e.subject.value = '';
          if (e.event && e.event.value) {
            loadPreview().catch(function () {});
          } else {
            renderPreview(null);
          }
        });
      });
    }
    if (e.omitList) {
      e.omitList.addEventListener('change', function (ev) {
        var input = ev.target && ev.target.closest ? ev.target.closest('[data-oec-omit-email]') : null;
        if (!input) return;
        var email = String(input.getAttribute('data-oec-omit-email') || '').toLowerCase();
        if (!email) return;
        if (input.checked) delete state.omittedEmails[email];
        else state.omittedEmails[email] = true;
        if (state.preview) renderPreview(state.preview);
      });
    }
    if (e.note) {
      e.note.addEventListener('input', refreshNoteInPreview);
    }
    if (e.fromName) {
      e.fromName.addEventListener('input', refreshNoteInPreview);
    }
    if (e.previewBtn) {
      e.previewBtn.addEventListener('click', function () {
        loadPreview().catch(function (err) {
          setStatus(err.message || 'Preview failed.', 'error');
        });
      });
    }
    if (e.engagementRefresh) {
      e.engagementRefresh.addEventListener('click', function () {
        loadPreview()
          .then(function () {
            setStatus('Tracking stats refreshed.', 'ok');
          })
          .catch(function (err) {
            setStatus(err.message || 'Could not refresh stats.', 'error');
          });
      });
    }
    if (e.usage) {
      e.usage.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('.oec-buy-credits') : null;
        if (!btn) return;
        buyCredits(btn.getAttribute('data-pack-id')).catch(function (err) {
          setStatus(err.message || 'Checkout failed.', 'error');
        });
      });
    }
    if (e.sendBtn) {
      e.sendBtn.addEventListener('click', function () {
        send().catch(function (err) {
          setStatus(err.message || 'Send failed.', 'error');
        });
      });
    }

    // Communicate tool tabs are owned by organiser-dashboard.js (preventDefault + setRoute).
  }

  function init(opts) {
    opts = opts || {};
    state.groups = opts.groups || state.groups || [];
    state.events = opts.events || state.events || [];
    bind();
    fillGroups();
    fillEvents();
    setUsage(null);
    syncFormReadyState();

    var pendingSession = '';
    try {
      pendingSession =
        new URLSearchParams(window.location.search).get('connections_credits_session') || '';
    } catch (err) {
      pendingSession = '';
    }
    if (pendingSession) {
      completeCreditsPurchase(pendingSession).catch(function (err) {
        setStatus(
          (err && err.message) ||
            'Payment received, but credits need a moment to appear — refresh shortly.',
          'error'
        );
      });
    }

    if (opts.eventId) {
      var e = els();
      if (e.event) {
        e.event.value = opts.eventId;
        syncFormReadyState();
        loadPreview().catch(function () {});
      }
    } else {
      setStatus('Pick an event to continue.');
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
