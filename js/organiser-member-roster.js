(function () {
  const params = new URLSearchParams(location.search);
  const isDashboardEmbed = Boolean(document.getElementById('org-page-memberships'));
  const isStandalonePage = Boolean(document.querySelector('.omr-page')) && !isDashboardEmbed;
  let organiserId = String(params.get('id') || params.get('organiserId') || '').trim();
  const PAGE_SIZE = 25;
  let members = [];
  let rosterTotal = 0;
  let rosterActiveTotal = 0;
  let events = [];
  let lastReports = null;
  let page = 1;
  let controlsBound = false;
  let searchTimer = null;
  let activeLoadPromise = null;
  let activeLoadGroupId = '';
  let reportsLoading = false;
  let activeRegisterTab = 'members';
  let activeReportTab = 'overview';
  let reportsLoadedKey = '';
  let reportsStale = false;
  let reportsSetupEditing = false;
  let groupRosterSummary = null;
  let reportPeriod = 6;
  let billingOffered = false;
  const filters = { search: '', status: 'all' };

  function isLoadInFlight() {
    return Boolean(activeLoadPromise);
  }

  function getActiveGroupId() {
    return String(activeLoadGroupId || organiserId || '').trim();
  }

  function clearStuckLoading() {
    if (rosterAppearsPainted() || !isLoadInFlight()) setRosterLoading(false);
  }

  function setActiveGroupId(groupId) {
    const id = String(groupId || '').trim();
    if (!id) return;
    organiserId = id;
    syncGroupSelect();
  }

  function getOrganiserId() {
    return String(organiserId || '').trim();
  }

  function syncGroupSelect() {
    if (!isDashboardEmbed) return;
    const sel = document.getElementById('filter-memberships-group');
    if (sel && organiserId) sel.value = organiserId;
  }

  function requireOrganiserId() {
    const id = getOrganiserId();
    if (!id) throw new Error('Choose an organiser page first.');
    return id;
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function showAlert(msg, tone) {
    const el = document.getElementById('omr-alert');
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
    el.classList.toggle('ee-alert-error', tone === 'error');
    el.classList.toggle('ee-alert-success', tone === 'success');
    el.classList.toggle('org-alert-error', tone === 'error');
    el.classList.toggle('org-alert-success', tone === 'success');
    if (msg) {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch {
        /* ignore */
      }
    }
  }

  async function api(path, options) {
    const res = await fetch(path, {
      credentials: 'include',
      cache: 'no-store',
      ...(options || {}),
    });
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
    return data;
  }

  function rosterListQuery(offset, limit) {
    const params = new URLSearchParams();
    params.set('limit', String(limit != null ? limit : PAGE_SIZE));
    params.set('offset', String(offset != null ? offset : (page - 1) * PAGE_SIZE));
    if (filters.search.trim()) params.set('search', filters.search.trim());
    if (filters.status && filters.status !== 'all') params.set('filter', filters.status);
    const eventId = selectedEventId();
    if (eventId && (filters.status === 'booked' || filters.status === 'not_booked')) {
      params.set('eventId', eventId);
    }
    return '&' + params.toString();
  }

  function rosterUrl(extra) {
    const id = requireOrganiserId();
    return (
      '/api/organiser/roster?organiserId=' +
      encodeURIComponent(id) +
      (extra || '')
    );
  }

  function selectedEventId() {
    return document.getElementById('omr-event-select')?.value || '';
  }

  function selectedReportsEventId() {
    return document.getElementById('omr-reports-event-select')?.value || '';
  }

  function selectedReportType() {
    const selected = document.querySelector('[data-omr-report-type].is-selected');
    return selected?.dataset.omrReportType || activeReportTab || 'overview';
  }

  function syncReportTypePicker(type) {
    const next = type || activeReportTab || 'overview';
    document.querySelectorAll('[data-omr-report-type]').forEach(function (btn) {
      const active = btn.dataset.omrReportType === next;
      btn.classList.toggle('is-selected', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }

  function setReportType(type) {
    const allowed = ['overview', 'upcoming', 'bookings', 'expiring', 'lapsed', 'engagement'];
    const next = allowed.indexOf(type) >= 0 ? type : 'overview';
    activeReportTab = next;
    syncReportTypePicker(next);
    syncReportsSetupFields();
    markReportsStale();
  }

  function selectedReportPeriod() {
    const raw = Number(document.getElementById('omr-reports-period')?.value || reportPeriod);
    if (raw === 3 || raw === 12) return raw;
    return 6;
  }

  function selectedUpcomingLimit() {
    const raw = Number(document.getElementById('omr-reports-upcoming-limit')?.value || 6);
    return raw === 3 ? 3 : 6;
  }

  function reportsEventLabel(eventId) {
    const id = String(eventId || selectedReportsEventId() || '').trim();
    if (!id) return '';
    const ev = events.find(function (e) {
      return String(e.id) === String(id);
    });
    if (!ev) return 'Selected event';
    const start = ev.startsAt || ev.starts_at || ev.date || '';
    const date = formatShortEventDate(start);
    return (ev.title || 'Event') + (date ? ' · ' + date : '');
  }

  function syncMembersEventFilter() {
    const sel = document.getElementById('omr-event-select');
    if (!sel) return;
    const needsEvent =
      filters.status === 'booked' ||
      filters.status === 'not_booked' ||
      Boolean(sel.value);
    sel.hidden = !needsEvent && activeRegisterTab !== 'members';
    if (needsEvent) sel.hidden = false;
  }

  function syncReportsSetupFields() {
    const type = selectedReportType();
    const eventSel = document.getElementById('omr-reports-event-select');
    const periodSel = document.getElementById('omr-reports-period');
    const upcomingLimitSel = document.getElementById('omr-reports-upcoming-limit');
    const eventHint = document.getElementById('omr-reports-event-hint');
    const needsEvent = type === 'bookings' || type === 'engagement';
    const needsPeriod = type === 'engagement';
    const needsUpcomingLimit = type === 'upcoming';

    syncReportTypePicker(type);

    if (eventSel) eventSel.hidden = !needsEvent;
    if (periodSel) periodSel.hidden = !needsPeriod;
    if (upcomingLimitSel) upcomingLimitSel.hidden = !needsUpcomingLimit;

    if (eventHint) {
      if (type === 'bookings') {
        eventHint.hidden = false;
        eventHint.textContent = 'Required — choose the event to check bookings against.';
      } else if (type === 'engagement') {
        eventHint.hidden = false;
        eventHint.textContent = 'Optional — include new vs returning split for one event.';
      } else {
        eventHint.hidden = true;
        eventHint.textContent = '';
      }
    }

    updateReportsSetupSummary();
  }

  function updateReportsSetupSummary() {
    const el = document.getElementById('omr-reports-setup-summary');
    if (!el) return;
    const type = selectedReportType();
    const eventLabel = reportsEventLabel();
    const period = selectedReportPeriod();

    if (type === 'overview') {
      el.textContent = 'You will get a snapshot of your whole member list.';
      return;
    }
    if (type === 'upcoming') {
      el.textContent =
        'You will see booking rates for your next ' + selectedUpcomingLimit() + ' upcoming events.';
      return;
    }
    if (type === 'expiring') {
      el.textContent = 'You will see members expiring in the next 14 days.';
      return;
    }
    if (type === 'lapsed') {
      el.textContent = 'You will see members whose membership has expired.';
      return;
    }
    if (type === 'bookings') {
      el.textContent = eventLabel
        ? 'You will see who on your list has booked ' + eventLabel + '.'
        : 'Choose an event above, then run the report.';
      return;
    }
    el.textContent =
      'You will see missed-meeting patterns across your last ' +
      period +
      ' meetings' +
      (eventLabel ? ', plus attendance at ' + eventLabel + '.' : '.');
  }

  function markReportsStale() {
    if (!reportsLoadedKey) return;
    reportsStale = true;
    syncReportsPanelState();
  }

  function populateEventSelects() {
    const memberSel = document.getElementById('omr-event-select');
    const reportSel = document.getElementById('omr-reports-event-select');
    if (!memberSel && !reportSel) return;

    const now = Date.now();
    const sorted = events.slice().sort(function (a, b) {
      const aStart = a.startsAt || a.starts_at || a.date || '';
      const bStart = b.startsAt || b.starts_at || b.date || '';
      const aTime = aStart ? new Date(aStart).getTime() : 0;
      const bTime = bStart ? new Date(bStart).getTime() : 0;
      const aUpcoming = aTime >= now;
      const bUpcoming = bTime >= now;
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      if (aUpcoming) return aTime - bTime;
      return bTime - aTime;
    });

    function fillSelect(sel, placeholder) {
      if (!sel) return '';
      const prev = sel.value || '';
      while (sel.options.length > 1) sel.remove(1);
      sorted.forEach(function (ev) {
        const opt = document.createElement('option');
        opt.value = ev.id;
        const start = ev.startsAt || ev.starts_at || ev.date || '';
        const isPast = start && new Date(start).getTime() < now;
        const label = (ev.title || 'Event') + (ev.dateLabel ? ' · ' + ev.dateLabel : '');
        opt.textContent = isPast ? label + ' (past)' : label;
        sel.appendChild(opt);
      });
      if (prev && sorted.some(function (ev) { return String(ev.id) === String(prev); })) {
        sel.value = prev;
      } else {
        sel.value = '';
      }
      if (sel.options[0] && placeholder) sel.options[0].textContent = placeholder;
      return sel.value;
    }

    fillSelect(memberSel, 'All events');
    fillSelect(reportSel, 'Choose an event…');
    syncMembersEventFilter();
    syncEventActionButtons();
    updateReportsSetupSummary();
  }

  function bookedEmailSet() {
    const set = new Set();
    const booked = lastReports && lastReports.bookedForEvent;
    if (!booked) return set;
    (booked.booked || []).forEach(function (m) {
      if (m.email) set.add(String(m.email).toLowerCase());
    });
    return set;
  }

  function isBookedForSelectedEvent(m) {
    const eventId = selectedEventId();
    if (!eventId) return null;
    return isBookedForEvent(m, eventId);
  }

  function memberBookings(m) {
    return (
      m.bookings || {
        total: 0,
        upcoming: [],
        recent: [],
        all: [],
        latest: null,
      }
    );
  }

  function isBookedForEvent(m, eventId) {
    if (!eventId) return null;
    const bookings = memberBookings(m);
    if (bookings.all && bookings.all.length) {
      return bookings.all.some(function (b) {
        return String(b.eventId) === String(eventId);
      });
    }
    if (lastReports && lastReports.bookedForEvent) {
      return bookedEmailSet().has(String(m.email || '').toLowerCase());
    }
    return false;
  }

  function formatShortEventDate(startsAt) {
    if (!startsAt) return '';
    try {
      return new Date(startsAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  }

  function bookingChipTitle(title) {
    const label = String(title || 'Event');
    return label.slice(0, 26) + (label.length > 26 ? '…' : '');
  }

  function rosterAppearsPainted() {
    const body = document.getElementById('omr-body');
    const empty = document.getElementById('omr-empty');
    return Boolean(body && (body.children.length > 0 || (empty && !empty.hidden)));
  }

  function setRosterLoading(on) {
    const hint = document.getElementById('omr-load-hint');
    const wrap = document.getElementById('omr-table-wrap');
    if (hint) {
      hint.hidden = !on;
      hint.setAttribute('aria-busy', on ? 'true' : 'false');
    }
    if (wrap) wrap.classList.toggle('is-roster-loading', on);
  }

  function setReportsLoading(on) {
    reportsLoading = Boolean(on);
    const hint = document.getElementById('omr-reports-loading');
    const wrap = document.getElementById('omr-reports-wrap');
    const runBtn = document.getElementById('omr-run-reports');
    const refreshBtn = document.getElementById('omr-refresh-reports');
    const refreshCompact = document.getElementById('omr-refresh-reports-compact');
    if (hint) {
      hint.hidden = !on;
      hint.setAttribute('aria-busy', on ? 'true' : 'false');
    }
    if (wrap) wrap.classList.toggle('is-reports-loading', on);
    if (runBtn) {
      runBtn.disabled = on;
      runBtn.textContent = on ? 'Running…' : 'Run report';
    }
    if (refreshBtn) refreshBtn.disabled = on;
    if (refreshCompact) refreshCompact.disabled = on;
    if (!on) syncReportsPanelState();
  }

  function rosterSummaryStats() {
    const summary = groupRosterSummary || {};
    const active = Number(summary.active);
    if (Number.isFinite(active) && active >= 0) {
      return {
        active: active,
        unclaimed: Number(summary.unclaimed) || 0,
        expiringSoon: Number(summary.expiringSoon) || 0,
      };
    }
    return {
      active: rosterActiveTotal || 0,
      unclaimed:
        lastReports && lastReports.rosterHealth
          ? Number(lastReports.rosterHealth.unclaimed) || 0
          : 0,
      expiringSoon:
        lastReports && lastReports.rosterHealth
          ? Number(lastReports.rosterHealth.expiringSoon) || 0
          : 0,
    };
  }

  function reportTypeLabel(type) {
    const map = {
      overview: 'Overview',
      upcoming: 'Upcoming events',
      bookings: 'Event bookings',
      expiring: 'Expiring soon',
      lapsed: 'Lapsed members',
      engagement: 'Engagement',
    };
    return map[type] || 'Report';
  }

  function reportsCompactSummaryLine() {
    const type = selectedReportType();
    const base = reportTypeLabel(type);
    const eventLabel = reportsEventLabel();
    if (type === 'upcoming') return base + ' · next ' + selectedUpcomingLimit() + ' events';
    if (type === 'bookings' && eventLabel) return base + ' · ' + eventLabel;
    if (type === 'engagement') {
      return base + ' · last ' + selectedReportPeriod() + ' meetings' + (eventLabel ? ' · ' + eventLabel : '');
    }
    if (type === 'expiring') return base + ' · next 14 days';
    if (type === 'lapsed') return base + ' · expired memberships';
    return base + ' · whole member list';
  }

  function expandReportsSetup() {
    const setup = document.getElementById('omr-reports-setup');
    const compact = document.getElementById('omr-reports-compact');
    if (setup) setup.hidden = false;
    if (compact) compact.hidden = true;
  }

  function collapseReportsSetup() {
    reportsSetupEditing = false;
    const setup = document.getElementById('omr-reports-setup');
    const compact = document.getElementById('omr-reports-compact');
    const summary = document.getElementById('omr-reports-compact-summary');
    if (setup) setup.hidden = true;
    if (compact) compact.hidden = false;
    if (summary) summary.textContent = reportsCompactSummaryLine();
  }

  function reportsCacheKey(eventId, period, upcomingLimit) {
    return (
      getOrganiserId() +
      ':' +
      String(eventId != null ? eventId : selectedReportsEventId() || '') +
      ':' +
      String(period != null ? period : selectedReportPeriod()) +
      ':' +
      String(upcomingLimit != null ? upcomingLimit : selectedUpcomingLimit())
    );
  }

  function syncReportsPanelState() {
    const onReportsTab = activeRegisterTab === 'reports';
    const empty = document.getElementById('omr-reports-empty');
    const wrap = document.getElementById('omr-reports-wrap');
    const results = document.getElementById('omr-reports-results');
    const refreshBtn = document.getElementById('omr-refresh-reports');
    const runBtn = document.getElementById('omr-run-reports');
    const stale = document.getElementById('omr-reports-stale');
    const setup = document.getElementById('omr-reports-setup');
    const compact = document.getElementById('omr-reports-compact');
    const hasLoaded = Boolean(lastReports && reportsLoadedKey);
    const hasMembers = rosterActiveTotal > 0 || rosterTotal > 0;

    if (!onReportsTab) {
      reportsSetupEditing = false;
      if (empty) empty.hidden = true;
      if (wrap) wrap.hidden = true;
      if (results) results.hidden = true;
      if (stale) stale.hidden = true;
      if (compact) compact.hidden = true;
      return;
    }

    if (reportsLoading) return;

    if (!hasMembers) {
      reportsSetupEditing = false;
      if (empty) empty.hidden = false;
      if (wrap) wrap.hidden = true;
      if (results) results.hidden = true;
      if (setup) setup.hidden = true;
      if (compact) compact.hidden = true;
      if (runBtn) runBtn.disabled = true;
      if (refreshBtn) refreshBtn.hidden = true;
      if (stale) stale.hidden = true;
      return;
    }

    if (runBtn) runBtn.disabled = false;
    if (empty) empty.hidden = true;

    if (!hasLoaded || reportsStale || reportsSetupEditing) {
      expandReportsSetup();
      if (!hasLoaded || reportsStale) {
        if (wrap) wrap.hidden = true;
        if (results) results.hidden = true;
        if (refreshBtn) refreshBtn.hidden = !reportsStale;
        if (stale) stale.hidden = !reportsStale;
      } else {
        // Editing settings with a loaded report — keep results visible underneath
        if (wrap) wrap.hidden = false;
        if (results) results.hidden = false;
        if (refreshBtn) refreshBtn.hidden = true;
        if (stale) stale.hidden = true;
      }
      return;
    }

    collapseReportsSetup();
    if (wrap) wrap.hidden = false;
    if (results) results.hidden = false;
    if (refreshBtn) refreshBtn.hidden = true;
    if (stale) stale.hidden = true;
  }

  function setRegisterTab(tab) {
    const next = tab === 'reports' ? 'reports' : 'members';
    activeRegisterTab = next;
    document.querySelectorAll('[data-omr-register-tab]').forEach(function (btn) {
      const active = btn.dataset.omrRegisterTab === next;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.tabIndex = active ? 0 : -1;
    });
    const membersPanel = document.getElementById('omr-panel-members');
    const reportsPanel = document.getElementById('omr-panel-reports');
    if (membersPanel) {
      membersPanel.hidden = next !== 'members';
      membersPanel.classList.toggle('is-active', next === 'members');
    }
    if (reportsPanel) {
      reportsPanel.hidden = next !== 'reports';
      reportsPanel.classList.toggle('is-active', next === 'reports');
    }
    const register = document.querySelector('.omr-register');
    if (register) register.classList.toggle('is-reports-view', next === 'reports');
    const countEl = document.getElementById('omr-count');
    if (countEl) countEl.hidden = next === 'reports';
    syncMembersEventFilter();
    syncReportsSetupFields();
    syncReportsPanelState();
  }

  function setReportTab(tab) {
    const allowed = ['overview', 'upcoming', 'bookings', 'expiring', 'lapsed', 'engagement'];
    activeReportTab = allowed.indexOf(tab) >= 0 ? tab : 'overview';
    syncReportTypePicker(activeReportTab);
    document.querySelectorAll('[data-omr-report-tab]').forEach(function (btn) {
      const active = btn.dataset.omrReportTab === activeReportTab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.tabIndex = active ? 0 : -1;
    });
    // Bookings need an event — open settings so organisers can pick one
    if (activeReportTab === 'bookings' && !selectedReportsEventId() && lastReports && !reportsStale) {
      reportsSetupEditing = true;
      syncReportsSetupFields();
    }
    const summary = document.getElementById('omr-reports-compact-summary');
    const compact = document.getElementById('omr-reports-compact');
    if (summary && compact && !compact.hidden) {
      summary.textContent = reportsCompactSummaryLine();
    }
    renderReports(lastReports);
  }

  async function refreshGroupRosterSummary(groupId) {
    const id = String(groupId || getOrganiserId() || '').trim();
    if (!id) {
      groupRosterSummary = null;
      return;
    }
    try {
      const data = await api('/api/organiser/groups?id=' + encodeURIComponent(id));
      if (getOrganiserId() !== id) return;
      groupRosterSummary =
        data.group && data.group.rosterSummary
          ? data.group.rosterSummary
          : { active: rosterActiveTotal || 0, unclaimed: 0, expiringSoon: 0 };
    } catch {
      groupRosterSummary = {
        active: rosterActiveTotal || 0,
        unclaimed: 0,
        expiringSoon: 0,
      };
    }
    if (typeof window.updateMembershipPageCard === 'function') {
      window.updateMembershipPageCard(id, groupRosterSummary);
    }
  }

  function syncEventActionButtons() {
    const eventId = selectedReportsEventId() || selectedEventId();
    const reportBtn = document.getElementById('omr-download-report');
    const remindBtn = document.getElementById('omr-remind-not-booked');
    document.querySelectorAll('.omr-event-action').forEach(function (el) {
      el.hidden = !eventId;
    });
    if (reportBtn) {
      reportBtn.disabled = !eventId;
      reportBtn.title = eventId ? '' : 'Choose an event first';
    }
    if (remindBtn) {
      remindBtn.disabled = !eventId;
      remindBtn.title = eventId ? '' : 'Choose an event first';
    }
  }

  async function ensureRosterPainted(groupId) {
    if (getOrganiserId() !== groupId) return;
    if (rosterAppearsPainted()) return;
    await fetchRosterPage(page || 1, { showLoader: false });
    if (getOrganiserId() === groupId && !rosterAppearsPainted()) renderRoster();
  }

  function renderBookingsCell(m) {
    const bookings = memberBookings(m);
    const eventId = selectedEventId();

    if (eventId) {
      const booked = isBookedForEvent(m, eventId);
      const ev = events.find(function (e) {
        return String(e.id) === String(eventId);
      });
      const evTitle = ev ? ev.title || 'Event' : 'This event';
      const highlight = booked
        ? '<span class="omr-booking-pill omr-booking-pill-yes" title="' +
          esc(evTitle) +
          '">Booked for this event</span>'
        : '<span class="omr-booking-pill omr-booking-pill-no">Not booked for this event</span>';
      const others = (bookings.upcoming || []).filter(function (b) {
        return String(b.eventId) !== String(eventId);
      });
      let extra = '';
      if (others.length) {
        extra = others
          .slice(0, 2)
          .map(function (b) {
            const date = formatShortEventDate(b.startsAt);
            return (
              '<span class="omr-booking-chip omr-booking-chip-upcoming" title="' +
              esc((b.title || 'Event') + (date ? ' · ' + date : '')) +
              '">' +
              esc(bookingChipTitle(b.title)) +
              '</span>'
            );
          })
          .join('');
        if (others.length > 2) {
          extra += '<span class="omr-booking-more">+' + (others.length - 2) + ' more</span>';
        }
      }
      return (
        '<div class="omr-bookings-cell">' +
        highlight +
        (extra ? '<div class="omr-booking-chips">' + extra + '</div>' : '') +
        '</div>'
      );
    }

    if (!bookings.total) {
      return '<span class="omr-badge-pending">None yet</span>';
    }

    const upcoming = bookings.upcoming || [];
    const chips = upcoming
      .slice(0, 2)
      .map(function (b) {
        const date = formatShortEventDate(b.startsAt);
        return (
          '<span class="omr-booking-chip omr-booking-chip-upcoming" title="' +
          esc((b.title || 'Event') + (date ? ' · ' + date : '')) +
          '">' +
          esc(bookingChipTitle(b.title)) +
          '</span>'
        );
      })
      .join('');
    const pastCount = (bookings.recent || []).length;
    let more = '';
    if (upcoming.length > 2) {
      more = '<span class="omr-booking-more">+' + (upcoming.length - 2) + ' upcoming</span>';
    } else if (!upcoming.length && pastCount) {
      more = '<span class="omr-booking-more">' + pastCount + ' past</span>';
    }
    const summary =
      '<span class="omr-booking-summary">' +
      bookings.total +
      (bookings.total === 1 ? ' event' : ' events') +
      '</span>';
    return (
      '<div class="omr-bookings-cell">' +
      summary +
      (chips || more
        ? '<div class="omr-booking-chips">' + chips + more + '</div>'
        : '') +
      '</div>'
    );
  }

  function memberActionsHtml(m) {
    const items = [
      '<button type="button" class="org-action-item omr-action-edit-name" data-id="' +
        esc(m.id) +
        '" data-email="' +
        esc(m.email) +
        '" data-name="' +
        esc(m.name || '') +
        '"><span class="org-action-icon">✎</span><span class="org-action-text"><strong>Edit name</strong><span>Update display name</span></span></button>',
      '<button type="button" class="org-action-item omr-action-edit-expiry" data-id="' +
        esc(m.id) +
        '" data-email="' +
        esc(m.email) +
        '" data-expires="' +
        esc(m.expiresAt || '') +
        '"><span class="org-action-icon">📅</span><span class="org-action-text"><strong>Edit expiry</strong><span>Change membership end date</span></span></button>',
    ];
    if (!isClaimed(m)) {
      items.push(
        '<button type="button" class="org-action-item omr-action-resend" data-id="' +
          esc(m.id) +
          '" data-email="' +
          esc(m.email) +
          '"><span class="org-action-icon">✉</span><span class="org-action-text"><strong>Resend invite</strong><span>Send Hub sign-up email again</span></span></button>'
      );
    }
    if (billingOffered) {
      items.push(
        '<button type="button" class="org-action-item omr-action-invite-pay" data-id="' +
          esc(m.id) +
          '" data-email="' +
          esc(m.email) +
          '"><span class="org-action-icon">£</span><span class="org-action-text"><strong>Invite to pay</strong><span>Email the Join / renew membership link</span></span></button>'
      );
    }
    items.push(
      '<button type="button" class="org-action-item danger omr-action-remove" data-id="' +
        esc(m.id) +
        '"><span class="org-action-icon">✕</span><span class="org-action-text"><strong>Remove</strong><span>Remove from membership list</span></span></button>'
    );
    const label = String(m.name || m.email || 'Member').slice(0, 36);
    return (
      '<div class="org-action-wrap">' +
      '<button type="button" class="org-action-btn" data-org-action-toggle aria-expanded="false">Actions <span class="chev">▾</span></button>' +
      '<div class="org-action-menu" role="menu">' +
      '<div class="org-action-menu-header">' +
      esc(label) +
      '</div>' +
      items.join('') +
      '</div></div>'
    );
  }

  function closeAllActionMenus() {
    document.querySelectorAll('.org-action-menu.is-open').forEach(function (menu) {
      menu.classList.remove('is-open', 'is-floating');
      menu.style.top = '';
      menu.style.left = '';
      menu.style.right = '';
      menu.style.bottom = '';
      menu.style.visibility = '';
      menu.style.display = '';
      if (menu._actionWrap) {
        menu._actionWrap.appendChild(menu);
        menu._actionWrap = null;
      }
    });
    document.querySelectorAll('[data-org-action-toggle][aria-expanded="true"]').forEach(function (btn) {
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  function getActionMenuPortal() {
    return (
      document.getElementById('org-action-menu-portal') ||
      document.getElementById('omr-action-menu-portal') ||
      document.body
    );
  }

  function openActionMenu(menu, toggle) {
    const wrap = toggle.closest('.org-action-wrap');
    const portal = getActionMenuPortal();
    if (wrap && menu.parentElement !== portal) {
      menu._actionWrap = wrap;
      portal.appendChild(menu);
    }
    menu.classList.add('is-open', 'is-floating');
    toggle.setAttribute('aria-expanded', 'true');
    menu.style.visibility = 'hidden';
    menu.style.display = 'block';
    const rect = toggle.getBoundingClientRect();
    const menuW = menu.offsetWidth || 240;
    const menuH = menu.offsetHeight || 200;
    let top = rect.bottom + 6;
    let left = rect.right - menuW;
    if (top + menuH > window.innerHeight - 12) {
      top = Math.max(12, rect.top - menuH - 6);
    }
    if (left < 12) left = 12;
    if (left + menuW > window.innerWidth - 12) {
      left = window.innerWidth - menuW - 12;
    }
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
    menu.style.right = 'auto';
    menu.style.bottom = 'auto';
    menu.style.visibility = '';
  }

  function isClaimed(m) {
    return Boolean(m.claimedAt || m.attendeeId);
  }

  function syncAddPanel(totalActive) {
    const details = document.getElementById('omr-add-details');
    const importDetails = document.getElementById('omr-import-card');
    if (details && !details.dataset.omrUserOpened) details.open = false;
    if (importDetails && !importDetails.dataset.omrUserOpened) importDetails.open = false;
  }

  function rosterSummaryLine(totalActive) {
    const stats = rosterSummaryStats();
    const count = totalActive || stats.active || 0;
    if (!count) return 'No members yet';
    const parts = [count + (count === 1 ? ' member' : ' members')];
    if (stats.unclaimed > 0) parts.push(stats.unclaimed + ' not signed up');
    if (stats.expiringSoon > 0) parts.push(stats.expiringSoon + ' expiring soon');
    return parts.join(' · ');
  }

  function jumpToAddSection(targetId) {
    const section = document.getElementById('omr-add-section');
    const addDetails = document.getElementById('omr-add-details');
    const importDetails = document.getElementById('omr-import-card');
    if (targetId === 'omr-import-card' && importDetails) {
      if (addDetails) addDetails.open = false;
      importDetails.open = true;
      importDetails.dataset.omrUserOpened = '1';
    }
    if ((targetId === 'omr-add-card' || targetId === 'omr-add-details') && addDetails) {
      if (importDetails) importDetails.open = false;
      addDetails.open = true;
      addDetails.dataset.omrUserOpened = '1';
    }
    const target =
      document.getElementById(targetId) ||
      (targetId === 'omr-add-card' ? addDetails : null);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (target) {
      window.setTimeout(function () {
        target.classList.add('omr-highlight-flash');
        const focusEl = target.querySelector('input, textarea, button');
        if (focusEl && typeof focusEl.focus === 'function') focusEl.focus({ preventScroll: true });
        window.setTimeout(function () {
          target.classList.remove('omr-highlight-flash');
        }, 1400);
      }, 280);
    }
  }

  function syncBulkResend(totalActive) {
    const btn = document.getElementById('omr-bulk-resend');
    if (!btn) return;
    const stats = rosterSummaryStats();
    const unclaimed = Number(stats.unclaimed) || 0;
    btn.hidden = !(totalActive > 0 && unclaimed > 0);
    const label =
      unclaimed === 1
        ? 'Resend invite to 1 not signed up'
        : 'Resend invites to ' + unclaimed + ' not signed up';
    btn.textContent = label;
    const strong = btn.querySelector('.org-action-text strong');
    if (strong) strong.textContent = label;
  }

  async function loadEvents() {
    try {
      const data = await api('/api/organiser/events');
      const now = Date.now();
      events = (data.events || [])
        .filter(function (ev) {
          return String(ev.organiserGroupId || ev.organiserId || '') === getOrganiserId();
        })
        .filter(function (ev) {
          const status = String(ev.status || ev.listingStatus || '').toLowerCase();
          const approval = String(ev.approvalStatus || ev.approval_status || 'Approved');
          return status === 'published' && approval === 'Approved';
        })
        .sort(function (a, b) {
          const aStart = a.startsAt || a.starts_at || a.date || '';
          const bStart = b.startsAt || b.starts_at || b.date || '';
          const aTime = aStart ? new Date(aStart).getTime() : 0;
          const bTime = bStart ? new Date(bStart).getTime() : 0;
          const aUpcoming = aTime >= now;
          const bUpcoming = bTime >= now;
          if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
          if (aUpcoming) return aTime - bTime;
          return bTime - aTime;
        });
      populateEventSelects();

      const memberSel = document.getElementById('omr-event-select');
      if (memberSel && memberSel.dataset.omrBound !== '1') {
        memberSel.dataset.omrBound = '1';
        memberSel.addEventListener('change', function () {
          syncMembersEventFilter();
          syncEventActionButtons();
          if (
            !memberSel.value &&
            (filters.status === 'booked' || filters.status === 'not_booked')
          ) {
            filters.status = 'all';
            const statusSel = document.getElementById('omr-status-filter');
            if (statusSel) statusSel.value = 'all';
          }
          page = 1;
          fetchRosterPage(1).then(function () {
            renderRoster();
          });
        });
      }

      const reportSel = document.getElementById('omr-reports-event-select');
      if (reportSel && reportSel.dataset.omrBound !== '1') {
        reportSel.dataset.omrBound = '1';
        reportSel.addEventListener('change', function () {
          updateReportsSetupSummary();
          markReportsStale();
        });
      }
    } catch {
      /* optional */
    }
  }

  function reportMemberLabel(m) {
    const name = String((m && m.name) || '').trim();
    const email = String((m && m.email) || '').trim();
    if (name && email) return name + ' (' + email + ')';
    return name || email || 'Member';
  }

  function formatMissedMeetingLine(m) {
    const label = reportMemberLabel(m);
    const checked = Number(m.recentEventsChecked) || 0;
    const missed = Number(m.missedCount) || 0;
    if (checked <= 1) return label + ' — didn\u2019t book your last meeting';
    return label + ' — missed ' + missed + ' of ' + checked + ' recent meetings';
  }

  function duplicateMemberConfirm(name, email) {
    const normEmail = String(email || '').trim().toLowerCase();
    const normName = String(name || '').trim().toLowerCase();
    if (!normEmail) return true;
    for (let i = 0; i < members.length; i += 1) {
      const m = members[i];
      if (!m || m.status !== 'active') continue;
      const mEmail = String(m.email || '').trim().toLowerCase();
      const mName = String(m.name || '').trim().toLowerCase();
      if (normName && mName && mName === normName && mEmail !== normEmail) {
        return window.confirm(
          'Someone named "' +
            (String(name || '').trim() || m.name || 'this member') +
            '" is already on your list with a different email (' +
            m.email +
            '). Add this as a separate member anyway?'
        );
      }
    }
    return true;
  }

  function selectedEventLabel() {
    return reportsEventLabel(selectedEventId() || selectedReportsEventId());
  }

  function renderReports(reports) {
    const mount = document.getElementById('omr-reports');
    const wrap = document.getElementById('omr-reports-wrap');
    if (!mount) return;
    if (!reports || activeRegisterTab !== 'reports' || reportsStale) {
      if (wrap) wrap.hidden = true;
      syncReportsPanelState();
      return;
    }

    const h = reports.rosterHealth || {};
    const booked = reports.bookedForEvent;
    const attendance = reports.eventAttendance;
    const missed = reports.missedRecentMeetings;
    const expiry = reports.membershipExpiry || {};
    const lapsed = expiry.lapsed || [];
    const upcoming = reports.upcomingEventBookings;
    let html = '';

    if (activeReportTab === 'overview') {
      html =
        '<div class="omr-report-card omr-report-card--stat">' +
        '<p class="omr-report-kicker">Member list</p>' +
        '<p class="omr-report-stat">' +
        esc(h.totalActive || 0) +
        '<span> active members</span></p>' +
        '<div class="omr-report-metrics">' +
        '<span><strong>' +
        esc(h.claimed || 0) +
        '</strong> signed up</span>' +
        '<span><strong>' +
        esc(h.unclaimed || 0) +
        '</strong> not yet</span>' +
        '<span><strong>' +
        esc(h.expiringSoon || 0) +
        '</strong> expiring soon</span>' +
        '<span><strong>' +
        esc(h.expired || 0) +
        '</strong> lapsed</span>' +
        '</div></div>';
    }

    if (activeReportTab === 'upcoming') {
      if (upcoming && upcoming.events && upcoming.events.length) {
        html =
          '<div class="omr-report-card omr-report-card--stat">' +
          '<p class="omr-report-kicker">Upcoming events</p>' +
          '<p class="omr-report-stat">' +
          esc(upcoming.averageBookedPercent || 0) +
          '<span>% average booked</span></p>' +
          '<p class="omr-report-note">Across your next ' +
          esc(upcoming.events.length) +
          ' event' +
          (upcoming.events.length === 1 ? '' : 's') +
          ', based on ' +
          esc(upcoming.eligibleMemberCount || 0) +
          ' members with active membership.</p></div>';
        upcoming.events.forEach(function (ev) {
          html +=
            '<div class="omr-report-card omr-report-card--upcoming">' +
            '<h3>' +
            esc(ev.title || 'Event') +
            '</h3>' +
            (ev.startsAt ? '<p class="omr-report-event">' + esc(formatShortEventDate(ev.startsAt)) + '</p>' : '') +
            '<p class="omr-report-stat">' +
            esc(ev.bookedCount || 0) +
            ' booked · ' +
            esc(ev.notBookedCount || 0) +
            ' not yet · ' +
            esc(ev.bookedPercent || 0) +
            '%</p>' +
            '<div class="omr-report-progress" aria-hidden="true"><span style="width:' +
            esc(Math.max(0, Math.min(100, Number(ev.bookedPercent) || 0))) +
            '%"></span></div>' +
            '</div>';
        });
      } else {
        html =
          '<div class="omr-report-card omr-report-card--empty"><h3>Upcoming events</h3>' +
          '<p>No live upcoming events yet. Publish an event to track member booking rates here.</p></div>';
      }
    }

    if (activeReportTab === 'bookings') {
      const eventLabel = selectedEventLabel();
      const eventSelected = Boolean(selectedReportsEventId() || selectedEventId());
      if (!eventSelected) {
        html =
          '<div class="omr-report-card omr-report-card--empty"><h3>Event bookings</h3>' +
          '<p>Choose an event above, then run the report to see who has booked.</p></div>';
      } else if (booked) {
        html =
          '<div class="omr-report-card"><h3>Your members — booked for selected event</h3>' +
          (eventLabel ? '<p class="omr-report-event">' + esc(eventLabel) + '</p>' : '') +
          '<p class="omr-report-stat">' +
          esc(booked.bookedCount) +
          ' booked · ' +
          esc(booked.notBookedCount) +
          ' not yet</p>';
        if (booked.notBooked && booked.notBooked.length) {
          html += '<ul>';
          booked.notBooked.slice(0, 12).forEach(function (m) {
            html += '<li>' + esc(reportMemberLabel(m)) + '</li>';
          });
          if (booked.notBooked.length > 12) {
            html += '<li>…and ' + (booked.notBooked.length - 12) + ' more</li>';
          }
          html += '</ul>';
        } else {
          html += '<p class="omr-report-note">Everyone on your membership has booked for this event.</p>';
        }
        html += '</div>';
      } else {
        html =
          '<div class="omr-report-card omr-report-card--empty"><h3>Event bookings</h3>' +
          '<p>No booking data for this event yet.</p></div>';
      }
    }

    if (activeReportTab === 'expiring') {
      if (expiry.within14Days && expiry.within14Days.length) {
        html = '<div class="omr-report-card"><h3>Expiring within 14 days</h3><ul>';
        expiry.within14Days.forEach(function (m) {
          html +=
            '<li>' +
            esc(reportMemberLabel(m)) +
            ' — ' +
            esc(m.expiresAt) +
            '</li>';
        });
        html += '</ul></div>';
      } else {
        html =
          '<div class="omr-report-card omr-report-card--empty"><h3>Expiring within 14 days</h3>' +
          '<p>No memberships expiring in the next 14 days.</p></div>';
      }
    }

    if (activeReportTab === 'lapsed') {
      if (lapsed.length) {
        html = '<div class="omr-report-card"><h3>Lapsed memberships</h3><ul>';
        lapsed.forEach(function (m) {
          html +=
            '<li>' +
            esc(reportMemberLabel(m)) +
            ' — expired ' +
            esc(m.expiresAt) +
            (m.daysSinceExpiry != null ? ' (' + esc(m.daysSinceExpiry) + ' days ago)' : '') +
            '</li>';
        });
        html += '</ul></div>';
      } else {
        html =
          '<div class="omr-report-card omr-report-card--empty"><h3>Lapsed memberships</h3>' +
          '<p>No expired memberships on your list.</p></div>';
      }
    }

    if (activeReportTab === 'engagement') {
      html = '';
      const eventLabel = selectedEventLabel();
      const eventSelected = Boolean(selectedReportsEventId() || selectedEventId());
      if (eventSelected && attendance) {
        html +=
          '<div class="omr-report-card"><h3>Your members at this event</h3>' +
          (eventLabel ? '<p class="omr-report-event">' + esc(eventLabel) + '</p>' : '') +
          '<p>' +
          esc(attendance.newCount) +
          ' new to your group · ' +
          esc(attendance.returningCount) +
          ' returning</p>' +
          '<p class="omr-report-note">Only people on your uploaded member list who booked this event.</p></div>';
      }
      if (missed && missed.members && missed.members.length) {
        html += '<div class="omr-report-card"><h3>Missed recent meetings</h3><ul>';
        missed.members.slice(0, 10).forEach(function (m) {
          html += '<li>' + esc(formatMissedMeetingLine(m)) + '</li>';
        });
        html += '</ul></div>';
      } else if (!html) {
        html =
          '<div class="omr-report-card omr-report-card--empty"><h3>Engagement</h3>' +
          '<p>No missed-meeting patterns to show yet. Choose an event above for attendance split.</p></div>';
      } else if (!missed || !missed.members || !missed.members.length) {
        html +=
          '<div class="omr-report-card omr-report-card--empty"><h3>Missed recent meetings</h3>' +
          '<p>Everyone on your list has booked at least one of your recent meetings.</p></div>';
      }
    }

    mount.innerHTML = html;
    mount.hidden = false;
    if (wrap) wrap.hidden = false;
    syncReportsPanelState();
  }

  async function runReports(options) {
    const force = Boolean(options && options.force);
    const type = selectedReportType();
    const eventId = selectedReportsEventId();
    const period = selectedReportPeriod();
    reportPeriod = period;
    activeReportTab = type;
    setReportTab(type);

    if (type === 'bookings' && !eventId) {
      showAlert('Choose an event for the booking report.', 'error');
      syncReportsSetupFields();
      return null;
    }

    const cacheKey = reportsCacheKey(eventId, period, selectedUpcomingLimit());
    if (!force && lastReports && reportsLoadedKey === cacheKey && !reportsStale) {
      reportsSetupEditing = false;
      renderReports(lastReports);
      syncReportsPanelState();
      return lastReports;
    }
    await loadReports(eventId, period);
    return lastReports;
  }

  async function loadReports(eventId, period) {
    setReportsLoading(true);
    try {
      let qs = '&action=reports';
      if (eventId) qs += '&eventId=' + encodeURIComponent(eventId);
      const recentCount = Math.max(Number(period || selectedReportPeriod()) || 6, 1);
      const upcomingLimit = selectedUpcomingLimit();
      const recent = events
        .slice(0, recentCount)
        .map(function (e) {
          return e.id;
        })
        .join(',');
      if (recent) qs += '&recentEventIds=' + encodeURIComponent(recent);
      qs += '&upcomingLimit=' + encodeURIComponent(String(upcomingLimit));
      const data = await api(rosterUrl(qs));
      lastReports = data.reports || null;
      reportsLoadedKey = reportsCacheKey(eventId, recentCount, upcomingLimit);
      reportsStale = false;
      reportsSetupEditing = false;
      renderReports(data.reports);
    } finally {
      setReportsLoading(false);
    }
  }

  function filteredMembers() {
    const q = filters.search.trim().toLowerCase();
    const eventSelected = Boolean(selectedEventId());
    return members.filter(function (m) {
      if (m.status !== 'active') return false;
      if (filters.status === 'claimed' && !isClaimed(m)) return false;
      if (filters.status === 'unclaimed' && isClaimed(m)) return false;
      if (filters.status === 'expiring' && !m.expiringSoon) return false;
      if (filters.status === 'has_bookings' && !memberBookings(m).total) return false;
      if (filters.status === 'no_bookings' && memberBookings(m).total) return false;
      if (filters.status === 'booked') {
        if (!eventSelected) return false;
        if (!isBookedForSelectedEvent(m)) return false;
      }
      if (filters.status === 'not_booked') {
        if (!eventSelected) return false;
        if (isBookedForSelectedEvent(m) !== false) return false;
      }
      if (q) {
        const hay = ((m.name || '') + ' ' + (m.email || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function csvCell(v) {
    return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  }

  function downloadCsvFile(filename, lines) {
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadTemplateCsv() {
    downloadCsvFile(
      'member-list-template.csv',
      ['email,name,expires', 'jane@example.com,Jane Smith,2026-12-31']
    );
  }

  async function downloadMembersCsv() {
    closeAllActionMenus();
    let rows = [];
    try {
      const data = await api(rosterUrl(rosterListQuery(0, 10000)));
      rows = data.members || [];
    } catch (err) {
      showAlert(err.message, 'error');
      return;
    }
    if (!rows.length) {
      showAlert('No members to download for the current filters.', 'error');
      return;
    }
    const eventId = selectedEventId();
    const header = [
      'Name',
      'Email',
      'Membership expires',
      'Expiring soon',
      'Hub account',
      'Invite sent',
      'Event bookings',
    ];
    if (eventId) header.push('Booked for selected event');
    const lines = [header.map(csvCell).join(',')];
    rows.forEach(function (m) {
      const b = memberBookings(m);
      const bookingLabels = (b.all || [])
        .map(function (x) {
          return x.title || 'Event';
        })
        .join('; ');
      const row = [
        m.name || '',
        m.email,
        m.expiresAt || '',
        m.expiringSoon ? 'Yes' : '',
        isClaimed(m) ? 'Signed up' : 'Not yet',
        m.inviteSentAt ? 'Yes' : 'No',
        bookingLabels || 'None',
      ];
      if (eventId) {
        row.push(isBookedForEvent(m, eventId) ? 'Yes' : 'No');
      }
      lines.push(row.map(csvCell).join(','));
    });
    downloadCsvFile('member-list.csv', lines);
  }

  function downloadReportCsv() {
    closeAllActionMenus();
    const eventId = selectedReportsEventId() || selectedEventId();
    if (!eventId || !lastReports) {
      showAlert('Choose an event first, then download its report.', 'error');
      return;
    }
    const ev = events.find(function (e) {
      return String(e.id) === String(eventId);
    });
    const eventLabel = ev ? ev.title || 'Event' : 'Event';
    const r = lastReports;
    const lines = [];

    lines.push(csvCell('Member report — ' + eventLabel));
    lines.push('');

    const h = r.rosterHealth || {};
    lines.push(csvCell('Membership health'));
    lines.push(['Active members', 'Signed up', 'Not signed up', 'Expiring soon', 'Lapsed'].map(csvCell).join(','));
    lines.push(
      [h.totalActive || 0, h.claimed || 0, h.unclaimed || 0, h.expiringSoon || 0, h.expired || 0]
        .map(csvCell)
        .join(',')
    );
    lines.push('');

    if (r.upcomingEventBookings && (r.upcomingEventBookings.events || []).length) {
      const u = r.upcomingEventBookings;
      lines.push(csvCell('Upcoming event booking rates'));
      lines.push(['Event', 'Date', 'Booked', 'Not booked', 'Booked %'].map(csvCell).join(','));
      u.events.forEach(function (ev) {
        lines.push(
          [
            ev.title || 'Event',
            ev.startsAt || '',
            ev.bookedCount || 0,
            ev.notBookedCount || 0,
            (ev.bookedPercent || 0) + '%',
          ]
            .map(csvCell)
            .join(',')
        );
      });
      lines.push('');
    }

    if (r.bookedForEvent) {
      const b = r.bookedForEvent;
      lines.push(
        csvCell(
          'Bookings for this event (' + b.bookedCount + ' booked, ' + b.notBookedCount + ' not booked)'
        )
      );
      lines.push(['Status', 'Name', 'Email'].map(csvCell).join(','));
      (b.booked || []).forEach(function (m) {
        lines.push(['Booked', m.name || '', m.email].map(csvCell).join(','));
      });
      (b.notBooked || []).forEach(function (m) {
        lines.push(['Not booked', m.name || '', m.email].map(csvCell).join(','));
      });
      lines.push('');
    }

    if (r.eventAttendance) {
      const a = r.eventAttendance;
      lines.push(csvCell('Your members at this event (member list only)'));
      lines.push(['New to your group', 'Returning', 'Member bookings'].map(csvCell).join(','));
      lines.push([a.newCount, a.returningCount, a.totalMemberBookings || a.newCount + a.returningCount].map(csvCell).join(','));
      lines.push('');
    }

    if (r.missedRecentMeetings && (r.missedRecentMeetings.members || []).length) {
      lines.push(csvCell('Members who missed recent meetings'));
      lines.push(['Name', 'Email', 'Missed', 'Meetings checked'].map(csvCell).join(','));
      r.missedRecentMeetings.members.forEach(function (m) {
        lines.push([m.name || '', m.email, m.missedCount, m.recentEventsChecked].map(csvCell).join(','));
      });
      lines.push('');
    }

    const expiry = (r.membershipExpiry && r.membershipExpiry.within14Days) || [];
    if (expiry.length) {
      lines.push(csvCell('Memberships expiring within 14 days'));
      lines.push(['Name', 'Email', 'Expires', 'Days left'].map(csvCell).join(','));
      expiry.forEach(function (m) {
        lines.push([m.name || '', m.email, m.expiresAt || '', m.daysUntilExpiry].map(csvCell).join(','));
      });
      lines.push('');
    }

    const lapsed = (r.membershipExpiry && r.membershipExpiry.lapsed) || [];
    if (lapsed.length) {
      lines.push(csvCell('Lapsed memberships'));
      lines.push(['Name', 'Email', 'Expired', 'Days ago'].map(csvCell).join(','));
      lapsed.forEach(function (m) {
        lines.push([m.name || '', m.email, m.expiresAt || '', m.daysSinceExpiry].map(csvCell).join(','));
      });
    }

    downloadCsvFile('member-report-' + String(eventId).slice(0, 8) + '.csv', lines);
  }

  function renderPagination(total) {
    const nav = document.getElementById('omr-pagination');
    if (!nav) return;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > totalPages) page = totalPages;
    if (total <= PAGE_SIZE) {
      nav.hidden = true;
      nav.innerHTML = '';
      return;
    }
    nav.hidden = false;
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, total);
    nav.innerHTML =
      '<p class="omr-pagination-meta">Showing ' +
      start +
      '–' +
      end +
      ' of ' +
      total +
      '</p>' +
      '<div class="omr-pagination-btns">' +
      '<button type="button" class="ee-btn ee-btn-outline omr-btn-sm" data-omr-page="prev"' +
      (page <= 1 ? ' disabled' : '') +
      '>Previous</button>' +
      '<span class="omr-pagination-page">Page ' +
      page +
      ' of ' +
      totalPages +
      '</span>' +
      '<button type="button" class="ee-btn ee-btn-outline omr-btn-sm" data-omr-page="next"' +
      (page >= totalPages ? ' disabled' : '') +
      '>Next</button>' +
      '</div>';
    nav.querySelectorAll('[data-omr-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.dataset.omrPage === 'prev' && page > 1) {
          fetchRosterPage(page - 1);
        }
        if (btn.dataset.omrPage === 'next') {
          const totalPages = Math.max(1, Math.ceil(rosterTotal / PAGE_SIZE));
          if (page < totalPages) fetchRosterPage(page + 1);
        }
      });
    });
  }

  function renderRoster() {
    const body = document.getElementById('omr-body');
    const empty = document.getElementById('omr-empty');
    const count = document.getElementById('omr-count');
    if (!body) return;
    try {
      closeAllActionMenus();
      body.innerHTML = '';

      const totalActive = rosterActiveTotal;
      syncAddPanel(totalActive);
      syncBulkResend(totalActive);

      const tabCount = document.getElementById('omr-tab-count-members');
      if (tabCount) tabCount.textContent = String(totalActive);

      const rows = members;
      if (count) {
        count.hidden = totalActive === 0 && rosterTotal === 0;
        if (rosterTotal === totalActive) {
          count.textContent = rosterSummaryLine(totalActive);
        } else {
          count.textContent =
            rosterTotal + ' of ' + totalActive + ' members shown';
        }
      }

      if (!rows.length) {
        if (empty) {
          empty.hidden = false;
          const title = empty.querySelector('.org-empty-state-title');
          const text = empty.querySelector('.org-empty-state-text');
          if (totalActive > 0 && title && text) {
            title.textContent = 'No members match these filters';
            text.textContent = 'Try a different search or filter, or clear the event filter.';
          } else if (title && text) {
            title.textContent = 'No members yet';
            text.textContent =
              'Use + Add a member or Import spreadsheet, then add a Members only ticket on your event (Tickets step).';
          }
        }
      renderPagination(rosterTotal);
      syncReportsPanelState();
      return;
    }
    if (empty) empty.hidden = true;

    renderPagination(rosterTotal);
    syncReportsPanelState();

      rows.forEach(function (m) {
        const tr = document.createElement('tr');
        const hub = isClaimed(m)
          ? '<span class="omr-badge-claimed">Signed up</span>'
          : '<span class="omr-badge-pending">Not yet</span>';
        const invite = isClaimed(m)
          ? '<span class="omr-badge-muted" title="Already signed up on the Hub">Not needed</span>'
          : m.inviteSentAt
            ? '<span class="omr-badge-claimed">Sent</span>'
            : '<span class="omr-badge-pending">Not sent</span>';
        const exp = m.expiresAt
          ? m.expiringSoon
            ? '<span class="omr-badge-expiring">' + esc(m.expiresAt) + '</span>'
            : esc(m.expiresAt)
          : '—';
        tr.innerHTML =
          '<td class="org-td-name omr-name-cell" data-label="Name" data-id="' +
          esc(m.id) +
          '"><span class="omr-member-name">' +
          esc(m.name || '—') +
          '</span></td><td data-label="Email">' +
          esc(m.email) +
          '</td><td class="omr-expires-cell" data-label="Expires" data-id="' +
          esc(m.id) +
          '">' +
          exp +
          '</td><td data-label="Hub account">' +
          hub +
          '</td><td data-label="Invite">' +
          invite +
          '</td><td class="omr-bookings-col" data-label="Event bookings">' +
          renderBookingsCell(m) +
          '</td><td class="org-td-actions omr-actions" data-label="Actions">' +
          memberActionsHtml(m) +
          '</td>';
        body.appendChild(tr);
      });
    } catch (err) {
      if (empty) {
        empty.hidden = false;
        const title = empty.querySelector('.org-empty-state-title');
        const text = empty.querySelector('.org-empty-state-text');
        if (title) title.textContent = 'Could not show members';
        if (text) text.textContent = err.message || 'Something went wrong loading the register.';
      }
      showAlert(err.message || 'Could not show members on the register.', 'error');
    }
  }

  function bindMemberActionHandlers() {
    if (document.documentElement.dataset.omrActionBound === '1') return;
    document.documentElement.dataset.omrActionBound = '1';

    document.addEventListener('click', function (e) {
      const toggle = e.target.closest('[data-org-action-toggle]');
      if (toggle && (toggle.closest('#omr-body') || toggle.closest('.omr-more-actions-wrap'))) {
        e.preventDefault();
        e.stopPropagation();
        const wrap = toggle.closest('.org-action-wrap');
        const menu = wrap && wrap.querySelector('.org-action-menu');
        if (!menu) return;
        const wasOpen = menu.classList.contains('is-open');
        closeAllActionMenus();
        if (!wasOpen) openActionMenu(menu, toggle);
        return;
      }

      if (
        !e.target.closest('.org-action-menu') &&
        !e.target.closest('[data-org-action-toggle]')
      ) {
        closeAllActionMenus();
      }

      const removeBtn = e.target.closest('.omr-action-remove');
      if (removeBtn) {
        e.preventDefault();
        e.stopPropagation();
        closeAllActionMenus();
        if (!confirm('Remove this member from the list?')) return;
        (async function () {
          try {
            await api(rosterUrl('&id=' + encodeURIComponent(removeBtn.dataset.id)), {
              method: 'DELETE',
            });
            await refresh();
          } catch (err) {
            showAlert(err.message, 'error');
          }
        })();
        return;
      }

      const resendBtn = e.target.closest('.omr-action-resend');
      if (resendBtn) {
        e.preventDefault();
        e.stopPropagation();
        closeAllActionMenus();
        resendBtn.disabled = true;
        (async function () {
          try {
            await api(rosterUrl(), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                organiserId: getOrganiserId(),
                id: resendBtn.dataset.id,
                email: resendBtn.dataset.email,
                resendInvite: true,
              }),
            });
            showAlert('Invite resent.', 'success');
            await refresh();
          } catch (err) {
            showAlert(err.message, 'error');
          } finally {
            resendBtn.disabled = false;
          }
        })();
        return;
      }

      const invitePayBtn = e.target.closest('.omr-action-invite-pay');
      if (invitePayBtn) {
        e.preventDefault();
        e.stopPropagation();
        closeAllActionMenus();
        invitePayBtn.disabled = true;
        (async function () {
          try {
            await api(rosterUrl(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                organiserId: getOrganiserId(),
                action: 'invite-to-pay',
                id: invitePayBtn.dataset.id,
                email: invitePayBtn.dataset.email,
              }),
            });
            showAlert('Pay invite sent.', 'success');
          } catch (err) {
            showAlert(err.message || 'Could not send pay invite.', 'error');
          } finally {
            invitePayBtn.disabled = false;
          }
        })();
        return;
      }

      const editExpiryBtn = e.target.closest('.omr-action-edit-expiry');
      if (editExpiryBtn) {
        e.preventDefault();
        e.stopPropagation();
        closeAllActionMenus();
        startExpiryEdit(editExpiryBtn.dataset.id, editExpiryBtn.dataset.email, editExpiryBtn.dataset.expires);
        return;
      }

      const editNameBtn = e.target.closest('.omr-action-edit-name');
      if (editNameBtn) {
        e.preventDefault();
        e.stopPropagation();
        closeAllActionMenus();
        startNameEdit(editNameBtn.dataset.id, editNameBtn.dataset.email, editNameBtn.dataset.name);
      }
    });

    window.addEventListener('scroll', closeAllActionMenus, true);
    window.addEventListener('resize', closeAllActionMenus);
  }

  function startNameEdit(memberId, email, currentName) {
    const cell = document.querySelector('.omr-name-cell[data-id="' + memberId + '"]');
    if (!cell || cell.querySelector('input')) return;
    cell.innerHTML =
      '<span class="omr-expiry-edit">' +
      '<input type="text" value="' +
      esc(currentName || '') +
      '" aria-label="Member name" />' +
      '<button type="button" class="ee-btn ee-btn-gold omr-btn-sm omr-name-save">Save</button>' +
      '<button type="button" class="ee-btn ee-btn-outline omr-btn-sm omr-name-cancel">Cancel</button>' +
      '</span>';
    cell.querySelector('.omr-name-cancel').addEventListener('click', function () {
      renderRoster();
    });
    cell.querySelector('.omr-name-save').addEventListener('click', async function () {
      const value = cell.querySelector('input').value.trim();
      try {
        await api(rosterUrl(), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organiserId: getOrganiserId(),
            id: memberId,
            email: email,
            name: value,
          }),
        });
        showAlert('Name updated.', 'success');
        await refresh();
      } catch (e) {
        showAlert(e.message, 'error');
      }
    });
  }

  function startExpiryEdit(memberId, email, currentExpiry) {
    const cell = document.querySelector('.omr-expires-cell[data-id="' + memberId + '"]');
    if (!cell || cell.querySelector('input')) return;
    cell.innerHTML =
      '<span class="omr-expiry-edit">' +
      '<input type="date" value="' +
      esc(currentExpiry || '') +
      '" aria-label="Membership expiry date" />' +
      '<button type="button" class="ee-btn ee-btn-gold omr-btn-sm omr-expiry-save">Save</button>' +
      '<button type="button" class="ee-btn ee-btn-outline omr-btn-sm omr-expiry-cancel">Cancel</button>' +
      '</span>';
    cell.querySelector('.omr-expiry-cancel').addEventListener('click', function () {
      renderRoster();
    });
    cell.querySelector('.omr-expiry-save').addEventListener('click', async function () {
      const value = cell.querySelector('input').value;
      try {
        await api(rosterUrl(), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organiserId: getOrganiserId(),
            id: memberId,
            email: email,
            expiresAt: value,
          }),
        });
        showAlert('Expiry date updated.', 'success');
        await refresh();
      } catch (e) {
        showAlert(e.message, 'error');
      }
    });
  }

  async function bulkResendInvites() {
    closeAllActionMenus();
    const stats = rosterSummaryStats();
    const unclaimed = Number(stats.unclaimed) || 0;
    if (!unclaimed) {
      showAlert('Everyone on the list already has a Hub account.', 'success');
      return;
    }
    if (
      !confirm(
        'Queue invite emails for ' +
          unclaimed +
          ' member' +
          (unclaimed === 1 ? '' : 's') +
          ' who have not signed up yet? They will send gradually over the next 2 hours.'
      )
    ) {
      return;
    }
    const btn = document.getElementById('omr-bulk-resend');
    if (btn) btn.disabled = true;
    try {
      const data = await api(rosterUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organiserId: getOrganiserId(),
          action: 'queue-invites',
        }),
      });
      showAlert(
        'Queued ' +
          (data.queued || 0) +
          ' invite' +
          ((data.queued || 0) === 1 ? '' : 's') +
          ' — sending over the next 2 hours.',
        (data.queued || 0) ? 'success' : 'error'
      );
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function fetchRosterPage(pageNum, options) {
    const groupId = getOrganiserId();
    if (!groupId) return;
    const showLoader = !options || options.showLoader !== false;
    page = Math.max(Number(pageNum) || 1, 1);
    if (showLoader) setRosterLoading(true);
    const path =
      '/api/organiser/roster?organiserId=' +
      encodeURIComponent(groupId) +
      rosterListQuery((page - 1) * PAGE_SIZE, PAGE_SIZE);
    try {
      const data = await api(path);
      if (getOrganiserId() !== groupId) return;
      members = data.members || [];
      rosterTotal = Number(data.total) || members.length;
      rosterActiveTotal = Number(data.totalActive) || rosterTotal;
    } catch (err) {
      if (getOrganiserId() !== groupId) return;
      showAlert(err.message, 'error');
    } finally {
      if (getOrganiserId() === groupId) {
        if (showLoader) setRosterLoading(false);
        renderRoster();
      }
    }
  }

  async function refresh() {
    const groupId = getOrganiserId();
    if (!groupId) return;
    page = 1;
    await fetchRosterPage(1, { showLoader: false });
    if (getOrganiserId() !== groupId) return;
    setRosterLoading(false);
    await refreshGroupRosterSummary(groupId);
    if (getOrganiserId() !== groupId) return;
    renderRoster();
    if (activeRegisterTab === 'reports' && reportsLoadedKey && !reportsStale) {
      runReports({ force: true }).catch(function (err) {
        if (getOrganiserId() === groupId) {
          showAlert(err.message || 'Could not refresh member reports.', 'error');
        }
      });
    } else if (reportsLoadedKey) {
      reportsStale = true;
      syncReportsPanelState();
    }
  }

  function removeDuplicateAddPanels() {
    const panels = document.querySelectorAll('.omr-add-panel');
    for (let i = 1; i < panels.length; i += 1) {
      panels[i].remove();
    }
  }

  function bindControlsOnce() {
    if (controlsBound) return;
    controlsBound = true;

    bindBillingControls();
    removeDuplicateAddPanels();
    bindMemberActionHandlers();

    setRegisterTab('members');
    syncReportsSetupFields();

    document.getElementById('omr-jump-add')?.addEventListener('click', function () {
      jumpToAddSection('omr-add-details');
    });
    document.getElementById('omr-jump-import')?.addEventListener('click', function () {
      const details = document.getElementById('omr-import-card');
      if (details && details.tagName === 'DETAILS') details.open = true;
      jumpToAddSection('omr-import-card');
    });

    document.querySelectorAll('[data-omr-register-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setRegisterTab(btn.dataset.omrRegisterTab || 'members');
      });
    });

    document.querySelectorAll('[data-omr-report-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setReportTab(btn.dataset.omrReportTab || 'overview');
      });
    });

    document.querySelectorAll('[data-omr-report-type]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setReportType(btn.dataset.omrReportType || 'overview');
      });
    });

    document.getElementById('omr-reports-period')?.addEventListener('change', function () {
      reportPeriod = selectedReportPeriod();
      updateReportsSetupSummary();
      markReportsStale();
    });

    document.getElementById('omr-reports-upcoming-limit')?.addEventListener('change', function () {
      updateReportsSetupSummary();
      markReportsStale();
    });

    document.getElementById('omr-run-reports')?.addEventListener('click', function () {
      runReports({ force: reportsStale }).catch(function (err) {
        showAlert(err.message || 'Could not run report.', 'error');
      });
    });

    document.getElementById('omr-refresh-reports')?.addEventListener('click', function () {
      runReports({ force: true }).catch(function (err) {
        showAlert(err.message || 'Could not refresh report.', 'error');
      });
    });

    document.getElementById('omr-refresh-reports-compact')?.addEventListener('click', function () {
      runReports({ force: true }).catch(function (err) {
        showAlert(err.message || 'Could not refresh report.', 'error');
      });
    });

    document.getElementById('omr-reports-edit-settings')?.addEventListener('click', function () {
      reportsSetupEditing = true;
      syncReportsSetupFields();
      syncReportsPanelState();
    });

    document.getElementById('omr-add-details')?.addEventListener('toggle', function (e) {
      if (e.target.open) e.target.dataset.omrUserOpened = '1';
    });
    document.getElementById('omr-import-card')?.addEventListener('toggle', function (e) {
      if (e.target.open) e.target.dataset.omrUserOpened = '1';
    });

    const back = document.getElementById('omr-back');
    if (back) {
      back.href = '/organiser/#memberships';
      back.addEventListener('click', function (e) {
        let cameFromMemberships = false;
        try {
          const ref = document.referrer ? new URL(document.referrer) : null;
          cameFromMemberships =
            !!ref &&
            ref.origin === location.origin &&
            /^\/organiser(\/|$)/.test(ref.pathname) &&
            (ref.hash === '#memberships' || ref.hash === '#member-lists');
        } catch {
          /* fall through */
        }
        if (cameFromMemberships && window.history.length > 1) {
          e.preventDefault();
          window.history.back();
        }
      });
    }

    document.getElementById('omr-search')?.addEventListener('input', function (e) {
      filters.search = e.target.value || '';
      page = 1;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        fetchRosterPage(1);
      }, 300);
    });
    document.getElementById('omr-status-filter')?.addEventListener('change', function (e) {
      filters.status = e.target.value || 'all';
      if (
        (filters.status === 'booked' || filters.status === 'not_booked') &&
        !selectedEventId()
      ) {
        showAlert('Choose an event first to filter by booking status.', 'error');
        filters.status = 'all';
        e.target.value = 'all';
      }
      syncMembersEventFilter();
      page = 1;
      fetchRosterPage(1);
    });
    document.getElementById('omr-download-members')?.addEventListener('click', downloadMembersCsv);
    document.getElementById('omr-download-report')?.addEventListener('click', downloadReportCsv);
    document.getElementById('omr-remind-not-booked')?.addEventListener('click', async function () {
      closeAllActionMenus();
      const eventId = selectedReportsEventId() || selectedEventId();
      if (!eventId || !lastReports || !lastReports.bookedForEvent) {
        showAlert('Choose an event first.', 'error');
        return;
      }
      const count = lastReports.bookedForEvent.notBookedCount || 0;
      if (count < 1) {
        showAlert('Everyone on your membership has booked for this event.', 'success');
        return;
      }
      if (
        !confirm(
          'Queue reminder emails for ' +
            count +
            ' member' +
            (count === 1 ? '' : 's') +
            ' who have not booked yet? They will send gradually over the next 2 hours.'
        )
      ) {
        return;
      }
      const btn = document.getElementById('omr-remind-not-booked');
      if (btn) btn.disabled = true;
      try {
        const data = await api(rosterUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organiserId: getOrganiserId(),
            action: 'remind-not-booked',
            eventId: eventId,
          }),
        });
        showAlert(
          'Queued ' +
            (data.queued || 0) +
            ' reminder' +
            ((data.queued || 0) === 1 ? '' : 's') +
            ' — sending over the next 2 hours.',
          (data.queued || 0) ? 'success' : 'error'
        );
      } catch (err) {
        showAlert(err.message, 'error');
      } finally {
        if (btn) {
          btn.disabled = !selectedEventId();
        }
      }
    });
    document.getElementById('omr-download-template')?.addEventListener('click', downloadTemplateCsv);
    document.getElementById('omr-bulk-resend')?.addEventListener('click', bulkResendInvites);

    document.getElementById('omr-add-form')?.addEventListener('submit', async function (e) {
      e.preventDefault();
      const name = document.getElementById('omr-name')?.value.trim() || '';
      const email = document.getElementById('omr-email')?.value.trim() || '';
      const sendPayInvite =
        billingOffered && document.getElementById('omr-send-pay-invite')?.checked === true;
      if (!duplicateMemberConfirm(name, email)) return;
      try {
        const added = await api(rosterUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organiserId: getOrganiserId(),
            name: name,
            email: email,
            expiresAt: document.getElementById('omr-expires')?.value || null,
            sendInvite: document.getElementById('omr-send-invite')?.checked !== false,
          }),
        });
        if (sendPayInvite) {
          const memberId = added && added.member && added.member.id ? added.member.id : null;
          await api(rosterUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organiserId: getOrganiserId(),
              action: 'invite-to-pay',
              id: memberId,
              email: email,
            }),
          });
        }
        document.getElementById('omr-add-form')?.reset();
        const payBox = document.getElementById('omr-send-pay-invite');
        if (payBox) payBox.checked = false;
        const inviteBox = document.getElementById('omr-send-invite');
        if (inviteBox) inviteBox.checked = true;
        showAlert(sendPayInvite ? 'Member added and pay invite sent.' : 'Member added.', 'success');
        await refresh();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    });

    const csvEl = document.getElementById('omr-csv');
    const fileInput = document.getElementById('omr-file');
    const dropzone = document.getElementById('omr-dropzone');
    const fileNameEl = document.getElementById('omr-file-name');

    function setLoadedFileName(name) {
      if (!fileNameEl) return;
      if (name) {
        fileNameEl.hidden = false;
        fileNameEl.textContent = 'Ready to import: ' + name;
      } else {
        fileNameEl.hidden = true;
        fileNameEl.textContent = '';
      }
    }

    function loadCsvText(text, sourceName) {
      if (csvEl) csvEl.value = text;
      setLoadedFileName(sourceName || '');
      const paste = document.querySelector('.omr-paste-details');
      if (paste && text) paste.open = false;
    }

    function readMemberFile(file) {
      if (!file) return;
      const name = String(file.name || '').toLowerCase();
      const okType =
        name.endsWith('.csv') ||
        name.endsWith('.tsv') ||
        name.endsWith('.txt') ||
        /csv|tab-separated|plain/i.test(file.type || '');
      if (!okType) {
        showAlert('Please upload a CSV file (export from Excel or Google Sheets as CSV).', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = function () {
        let text = String(reader.result || '');
        if (name.endsWith('.tsv')) {
          text = text
            .split(/\r?\n/)
            .map(function (line) {
              return line.split('\t').join(',');
            })
            .join('\n');
        }
        loadCsvText(text, file.name);
        showAlert('File loaded. Click Import members to add them.', 'success');
      };
      reader.onerror = function () {
        showAlert('Could not read that file.', 'error');
      };
      reader.readAsText(file);
    }

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', function () {
        fileInput.click();
      });
      dropzone.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fileInput.click();
        }
      });
      fileInput.addEventListener('change', function () {
        const file = fileInput.files && fileInput.files[0];
        readMemberFile(file);
        fileInput.value = '';
      });
      ['dragenter', 'dragover'].forEach(function (evt) {
        dropzone.addEventListener(evt, function (e) {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('is-dragover');
        });
      });
      ['dragleave', 'drop'].forEach(function (evt) {
        dropzone.addEventListener(evt, function (e) {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('is-dragover');
        });
      });
      dropzone.addEventListener('drop', function (e) {
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        readMemberFile(file);
      });
    }

    document.getElementById('omr-import-btn')?.addEventListener('click', async function () {
      const csv = csvEl?.value || '';
      if (!csv.trim()) {
        showAlert('Upload a CSV spreadsheet or paste CSV text first.', 'error');
        return;
      }
      try {
        const data = await api(rosterUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organiserId: getOrganiserId(),
            csv: csv,
            sendInvites: document.getElementById('omr-csv-send-invites')?.checked === true,
          }),
        });
        const inviteNote =
          data.invitesQueued > 0
            ? ' · ' + data.invitesQueued + ' invites queued (sending over 2 hours)'
            : data.invitesSent > 0
              ? ' · ' + data.invitesSent + ' invites sent'
              : '';
        let msg = 'Imported ' + data.ok + ' of ' + data.total + ' rows' + inviteNote + '.';
        if (data.fail > 0 && data.errors && data.errors.length) {
          msg +=
            ' ' +
            data.fail +
            ' failed: ' +
            data.errors
              .slice(0, 3)
              .map(function (err) {
                return (err.email || 'row') + ' (' + (err.message || 'error') + ')';
              })
              .join('; ');
        }
        showAlert(msg, data.fail && !data.ok ? 'error' : 'success');
        if (csvEl) csvEl.value = '';
        setLoadedFileName('');
        await refresh();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    });
  }

  async function loadBillingPlan() {
    const panel = document.getElementById('omr-billing-panel');
    if (!panel || !isDashboardEmbed) return;
    const id = getOrganiserId();
    if (!id) {
      panel.hidden = true;
      billingOffered = false;
      const payInviteWrap = document.getElementById('omr-send-pay-invite-wrap');
      if (payInviteWrap) payInviteWrap.hidden = true;
      return;
    }
    panel.hidden = false;
    try {
      const data = await api(
        '/api/organiser/membership-plans?organiserId=' + encodeURIComponent(id)
      );
      const plan = data.plan || null;
      const monthly = document.getElementById('omr-billing-monthly');
      const annual = document.getElementById('omr-billing-annual');
      const active = document.getElementById('omr-billing-active');
      if (monthly) {
        monthly.value =
          plan && plan.monthlyAmountPence != null
            ? String((plan.monthlyAmountPence / 100).toFixed(2)).replace(/\.00$/, '')
            : '';
      }
      if (annual) {
        annual.value =
          plan && plan.annualAmountPence != null
            ? String((plan.annualAmountPence / 100).toFixed(2)).replace(/\.00$/, '')
            : '';
      }
      if (active) active.checked = plan ? plan.active !== false && plan.offered : true;
      const vatIncluded = document.getElementById('omr-billing-vat-included');
      const vatAdded = document.getElementById('omr-billing-vat-added');
      const vat = plan && plan.vatTreatment === 'added' ? 'added' : 'included';
      if (vatIncluded) vatIncluded.checked = vat === 'included';
      if (vatAdded) vatAdded.checked = vat === 'added';
      billingOffered = Boolean(plan && plan.offered);
      const payInviteWrap = document.getElementById('omr-send-pay-invite-wrap');
      if (payInviteWrap) payInviteWrap.hidden = !billingOffered;
      try {
        renderRoster();
      } catch {
        /* roster may not be painted yet */
      }
      const connectNote = document.getElementById('omr-billing-connect');
      const connectLink = document.getElementById('omr-billing-connect-link');
      if (data.connectReady === false) {
        if (connectNote) {
          connectNote.hidden = false;
          connectNote.textContent =
            'Add bank details before members can pay you through the Hub.';
        }
        if (connectLink) connectLink.hidden = false;
      } else {
        if (connectNote) connectNote.hidden = true;
        if (connectLink) connectLink.hidden = true;
      }
      updateBillingPreview();
    } catch (e) {
      billingOffered = false;
      const payInviteWrap = document.getElementById('omr-send-pay-invite-wrap');
      if (payInviteWrap) payInviteWrap.hidden = true;
      /* panel stays visible; organiser can still try save */
      updateBillingPreview();
    }
  }

  function updateBillingPreview() {
    const el = document.getElementById('omr-billing-preview');
    if (!el) return;
    const monthly = Number(document.getElementById('omr-billing-monthly')?.value || 0);
    const annual = Number(document.getElementById('omr-billing-annual')?.value || 0);
    const vatAdded = document.getElementById('omr-billing-vat-added')?.checked === true;
    function money(n) {
      return '£' + Number(n).toFixed(2).replace(/\.00$/, '');
    }
    function quote(amount) {
      if (!amount || amount < 1) return null;
      const membershipVat = vatAdded ? Math.round(amount * 0.2 * 100) / 100 : 0;
      const fee = Math.round(amount * 0.03 * 100) / 100;
      const youGet = Math.round((amount + membershipVat) * 100) / 100;
      const memberPays = Math.round((amount + membershipVat + fee) * 100) / 100;
      return { youGet: youGet, memberPays: memberPays, fee: fee, membershipVat: membershipVat };
    }
    const parts = [];
    const m = quote(monthly);
    if (m) {
      parts.push(
        'Monthly: member pays ' +
          money(m.memberPays) +
          ' (you get ' +
          money(m.youGet) +
          '; Hub fee ' +
          money(m.fee) +
          ' incl. VAT)'
      );
    }
    const a = quote(annual);
    if (a) {
      parts.push(
        'Annually: member pays ' +
          money(a.memberPays) +
          ' (you get ' +
          money(a.youGet) +
          '; Hub fee ' +
          money(a.fee) +
          ' incl. VAT)'
      );
    }
    el.textContent = parts.length
      ? parts.join(' · ')
      : 'Enter a monthly and/or annual price. Leave blank to not offer that option.';
  }

  async function saveBillingPlan(e) {
    if (e) e.preventDefault();
    const id = requireOrganiserId();
    const monthlyEl = document.getElementById('omr-billing-monthly');
    const annualEl = document.getElementById('omr-billing-annual');
    const activeEl = document.getElementById('omr-billing-active');
    const monthlyRaw = String(monthlyEl?.value || '').trim();
    const annualRaw = String(annualEl?.value || '').trim();
    const body = {
      organiserId: id,
      active: activeEl ? activeEl.checked : true,
      vatTreatment:
        document.getElementById('omr-billing-vat-added')?.checked === true ? 'added' : 'included',
      monthlyAmountPounds: monthlyRaw === '' ? null : monthlyRaw,
      annualAmountPounds: annualRaw === '' ? null : annualRaw,
      clearMonthly: monthlyRaw === '',
      clearAnnual: annualRaw === '',
    };
    const btn = document.getElementById('omr-billing-save');
    if (btn) btn.disabled = true;
    try {
      await api('/api/organiser/membership-plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      showAlert('Membership prices saved.', 'success');
      await loadBillingPlan();
    } catch (err) {
      showAlert(err.message || 'Could not save membership prices.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function bindBillingControls() {
    const form = document.getElementById('omr-billing-form');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';
    form.addEventListener('submit', saveBillingPlan);
    ['omr-billing-monthly', 'omr-billing-annual'].forEach(function (fid) {
      const el = document.getElementById(fid);
      if (el) el.addEventListener('input', updateBillingPreview);
    });
    document.querySelectorAll('input[name="omr-billing-vat"]').forEach(function (el) {
      el.addEventListener('change', updateBillingPreview);
    });
  }

  async function loadForGroup(groupId) {
    const id = String(groupId || '').trim();
    bindControlsOnce();
    organiserId = id;
    syncGroupSelect();

    if (!id) {
      members = [];
      rosterTotal = 0;
      rosterActiveTotal = 0;
      events = [];
      lastReports = null;
      reportsLoadedKey = '';
      reportsStale = false;
      reportsSetupEditing = false;
      groupRosterSummary = null;
      page = 1;
      setRegisterTab('members');
      renderRoster();
      const billingPanel = document.getElementById('omr-billing-panel');
      if (billingPanel) billingPanel.hidden = true;
      const mount = document.getElementById('omr-reports');
      const wrap = document.getElementById('omr-reports-wrap');
      if (mount) mount.innerHTML = '';
      if (wrap) wrap.hidden = true;
      syncReportsPanelState();
      return;
    }

    if (activeLoadGroupId === id && activeLoadPromise) return activeLoadPromise;

    if (activeLoadGroupId !== id) {
      members = [];
      rosterTotal = 0;
      rosterActiveTotal = 0;
      lastReports = null;
      reportsLoadedKey = '';
      reportsStale = false;
      reportsSetupEditing = false;
      groupRosterSummary = null;
      page = 1;
      setRegisterTab('members');
      renderRoster();
    }

    activeLoadGroupId = id;
    setRosterLoading(true);
    activeLoadPromise = (async function () {
      page = 1;

      try {
        const group = await api('/api/organiser/groups?id=' + encodeURIComponent(id));
        if (getOrganiserId() !== id) return;
        groupRosterSummary =
          group.group && group.group.rosterSummary
            ? group.group.rosterSummary
            : { active: 0, unclaimed: 0, expiringSoon: 0 };
        const title = document.getElementById('omr-title');
        if (title && group.group && group.group.name) {
          title.textContent = 'Membership — ' + group.group.name;
        }
      } catch {
        /* ignore */
      }

      await loadEvents();
      if (getOrganiserId() !== id) return;
      await loadBillingPlan();
      if (getOrganiserId() !== id) return;
      await refresh();
    })().finally(function () {
      if (activeLoadGroupId === id) {
        setRosterLoading(false);
        if (getOrganiserId() === id && !rosterAppearsPainted()) {
          renderRoster();
        }
        activeLoadPromise = null;
      }
      ensureRosterPainted(id);
    });
    return activeLoadPromise;
  }

  async function initStandalone() {
    if (!organiserId) {
      location.replace('/organiser/#memberships');
      return;
    }
    await loadForGroup(organiserId);
  }

  window.OrganiserMemberRoster = {
    loadForGroup: loadForGroup,
    appearsPainted: rosterAppearsPainted,
    setLoading: setRosterLoading,
    bindControls: bindControlsOnce,
    getActiveGroupId: getActiveGroupId,
    isLoadInFlight: isLoadInFlight,
    clearStuckLoading: clearStuckLoading,
    setActiveGroupId: setActiveGroupId,
    setGroupRosterSummary: function (groupId, summary) {
      const id = String(groupId || '').trim();
      if (!id || getOrganiserId() !== id || !summary) return;
      groupRosterSummary = summary;
      if (typeof window.updateMembershipPageCard === 'function') {
        window.updateMembershipPageCard(id, summary);
      }
      if (activeRegisterTab === 'members' || document.getElementById('omr-count')) {
        renderRoster();
      }
    },
  };

  if (isDashboardEmbed) {
    bindControlsOnce();
  }

  if (isStandalonePage) {
    initStandalone().catch(function (e) {
      showAlert(e.message || 'Could not load membership', 'error');
    });
  }
})();
