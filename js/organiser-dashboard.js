/**
 * Organiser dashboard — groups, events, ticket types (Supabase via /api/organiser/*).
 */
(function () {
  const ORG_PAGE_SIZE = 10;
  const listPages = { groups: 1, events: 1, tickets: 1, attendees: 1, reviews: 1, revenue: 1 };
  let eventsSubRoute = 'events-list';

  const filters = {
    eventsStatus: 'all',
    eventsType: 'all',
    eventsSearch: '',
    groupsStatus: 'all',
    groupsSearch: '',
    ticketsEvent: 'all',
    ticketsType: 'all',
    reviewsGroup: 'all',
    attendeesEvent: 'all',
  };

  const state = {
    user: null,
    groups: [],
    events: [],
    upcomingEvents: [],
    tickets: [],
    attendeesAll: [],
    reviews: [],
    teamMembers: [],
    groupsError: null,
    airtable: null,
    canManageTeam: true,
    canDeleteEvents: true,
    organiserRole: 'owner',
  };

  const ORGANISER_SCOPE_COOKIE = 'hub_organiser_scope';
  const signin = document.getElementById('org-signin');
  const shell = document.getElementById('org-shell');
  const alertEl = document.getElementById('org-airtable-alert');

  function setOrganiserScopeCookie(mode) {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    if (mode === 'my') {
      document.cookie =
        ORGANISER_SCOPE_COOKIE + '=my; path=/; max-age=' + 60 * 60 * 24 * 90 + '; SameSite=Lax' + secure;
    } else {
      document.cookie = ORGANISER_SCOPE_COOKIE + '=; path=/; max-age=0; SameSite=Lax' + secure;
    }
  }

  function renderStats() {
    const rev = totalRevenueDisplay();
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('stat-events', String(state.events.length));
    set('stat-tickets', String(state.tickets.length));
    set('stat-revenue', rev);
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  const GROUP_SAVED_KEY = 'hub_group_last_saved';

  function applyPendingGroupSave() {
    try {
      const raw = sessionStorage.getItem(GROUP_SAVED_KEY);
      if (!raw) return;
      sessionStorage.removeItem(GROUP_SAVED_KEY);
      const parsed = JSON.parse(raw);
      const group = parsed && parsed.group;
      if (!group || !group.id) return;
      const idx = state.groups.findIndex((g) => g.id === group.id);
      if (idx >= 0) {
        state.groups[idx] = { ...state.groups[idx], ...group };
      } else {
        state.groups.unshift(group);
      }
    } catch {
      /* ignore */
    }
  }

  function api(path, options) {
    return fetch(path, {
      credentials: 'include',
      cache: 'no-store',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options && options.headers),
      },
    }).then((res) =>
      res.json().then((data) => ({
        ok: res.ok,
        status: res.status,
        data,
      }))
    );
  }

  function formatDate(raw) {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw).slice(0, 16);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDateShort(raw) {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function formatTimeRange(startRaw, endRaw) {
    if (!startRaw) return '—';
    const start = new Date(startRaw);
    if (Number.isNaN(start.getTime())) return '—';
    const fmt = (d) =>
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (endRaw) {
      const end = new Date(endRaw);
      if (!Number.isNaN(end.getTime())) return fmt(start) + ' – ' + fmt(end);
    }
    return fmt(start);
  }

  function thumbHtml(item) {
    const name = item.name || item.title || '?';
    const imgSrc = item.imageUrl || item.photo || '';
    if (imgSrc && /^https?:\/\//i.test(imgSrc)) {
      return (
        '<img class="org-thumb" src="' +
        esc(imgSrc) +
        '" alt="" width="44" height="44" loading="lazy" referrerpolicy="no-referrer" />'
      );
    }
    const letter = String(name).trim().charAt(0).toUpperCase() || '?';
    return '<div class="org-thumb-placeholder" aria-hidden="true">' + esc(letter) + '</div>';
  }

  function statusBadgeHtml(key, label) {
    const cls =
      key === 'live'
        ? 'org-badge-green'
        : key === 'upcoming'
          ? 'org-badge-gold'
          : key === 'archived'
            ? 'org-badge-blue'
            : key === 'cancelled'
              ? 'org-badge-red'
              : key === 'unpublished'
                ? 'org-badge-red'
                : 'org-badge-purple';
    return '<span class="org-badge ' + cls + '">' + esc(label) + '</span>';
  }

  function payoutStatusBadgeHtml(ev) {
    const key = ev.payoutStatusKey || (ev.payoutHeld ? 'held' : null);
    const label = ev.payoutStatusLabel || (ev.payoutHeld ? 'Held' : '—');
    if (!key || label === '—') return '<span class="org-payout-muted">—</span>';
    const cls =
      key === 'paid'
        ? 'org-badge-green'
        : key === 'approved'
          ? 'org-badge-blue'
          : key === 'pending_review'
            ? 'org-badge-gold'
            : key === 'held'
              ? 'org-badge-red'
              : 'org-badge-purple';
    return '<span class="org-badge ' + cls + '">' + esc(label) + '</span>';
  }

  function payoutActionsHtml(ev) {
    const parts = [];
    if (ev.needsRefundConfirmation) {
      parts.push(
        '<button type="button" class="org-btn org-btn-outline org-btn-sm" data-confirm-refunds="' +
          esc(ev.id) +
          '">Confirm refunds issued</button>'
      );
    }
    if (ev.canRequestPayout) {
      parts.push(
        '<button type="button" class="org-btn org-btn-gold org-btn-sm" data-request-payout="' +
          esc(ev.id) +
          '">Request payout</button>'
      );
    }
    return parts.length ? parts.join(' ') : '—';
  }

  function ratingHtml(rating) {
    if (rating == null || Number.isNaN(Number(rating))) {
      return '<span class="org-rating muted">—</span>';
    }
    return (
      '<span class="org-rating"><span class="org-rating-star" aria-hidden="true">★</span> ' +
      esc(Number(rating).toFixed(1)) +
      '</span>'
    );
  }

  function actionMenuHtml(kind, id, title, item) {
    if (kind === 'group') {
      const statusKey = item && item.statusKey;
      const unpublishDisabled = statusKey === 'unpublished' || statusKey === 'draft';
      const unpublishBtn = unpublishDisabled
        ? '<button type="button" class="org-action-item danger" disabled><span class="org-action-icon">⊘</span><span class="org-action-text"><strong>Unpublish</strong><span>' +
          (statusKey === 'unpublished' ? 'Already unpublished' : 'Publish first to list on site') +
          '</span></span></button>'
        : '<button type="button" class="org-action-item danger" data-unpublish-group="' +
          esc(id) +
          '"><span class="org-action-icon">⊘</span><span class="org-action-text"><strong>Unpublish</strong><span>Remove from public site</span></span></button>';
      return (
        '<div class="org-action-wrap">' +
        '<button type="button" class="org-action-btn" data-org-action-toggle aria-expanded="false">Actions <span class="chev">▾</span></button>' +
        '<div class="org-action-menu" role="menu">' +
        '<button type="button" class="org-action-item" data-edit-group="' +
        esc(id) +
        '"><span class="org-action-icon">✎</span><span class="org-action-text"><strong>Edit profile</strong><span>Update organiser page details</span></span></button>' +
        '<button type="button" class="org-action-item" data-org-goto-sub="events-reviews"><span class="org-action-icon">★</span><span class="org-action-text"><strong>Reviews</strong><span>View feedback for this group</span></span></button>' +
        unpublishBtn +
        '</div></div>'
      );
    }
    return eventActionMenuHtml(id, title);
  }

  function eventActionMenuHtml(id, title) {
    const shortTitle = String(title || 'Event').slice(0, 32);
    return (
      '<div class="org-action-wrap">' +
      '<button type="button" class="org-action-btn" data-org-action-toggle aria-expanded="false">Actions <span class="chev">▾</span></button>' +
      '<div class="org-action-menu" role="menu">' +
      '<div class="org-action-menu-header">' +
      esc(shortTitle) +
      '</div>' +
      '<button type="button" class="org-action-item" data-edit-event="' +
      esc(id) +
      '"><span class="org-action-icon">✎</span><span class="org-action-text"><strong>Edit event</strong><span>Update details, times &amp; tickets</span></span></button>' +
      '<button type="button" class="org-action-item" data-org-goto-sub="events-attendees" data-filter-event="' +
      esc(id) +
      '"><span class="org-action-icon">👥</span><span class="org-action-text"><strong>See attendees</strong><span>View who registered for this event</span></span></button>' +
      '<button type="button" class="org-action-item" data-org-goto-sub="events-tickets" data-filter-event="' +
      esc(id) +
      '"><span class="org-action-icon">🎟️</span><span class="org-action-text"><strong>Ticket types</strong><span>Manage tiers and pricing</span></span></button>' +
      '<button type="button" class="org-action-item" data-org-goto-sub="events-reviews" data-filter-event="' +
      esc(id) +
      '"><span class="org-action-icon">★</span><span class="org-action-text"><strong>Reviews</strong><span>Read &amp; reply to reviews</span></span></button>' +
      '<button type="button" class="org-action-item danger" disabled><span class="org-action-icon">⊘</span><span class="org-action-text"><strong>Unpublish</strong><span>Hide from directory</span></span></button>' +
      '</div></div>'
    );
  }

  function eventActionMenuHtmlWithItem(ev) {
    const id = ev.id;
    const title = ev.title;
    const shortTitle = String(title || 'Event').slice(0, 32);
    const cancelled = String(ev.status || '').toLowerCase() === 'cancelled';
    const published =
      String(ev.status || '').toLowerCase() === 'published' || ev.approvalStatus === 'Approved';
    const cancelItem =
      ev.locked && !cancelled && published
        ? '<button type="button" class="org-action-item danger" data-cancel-event="' +
          esc(id) +
          '"><span class="org-action-icon">⊘</span><span class="org-action-text"><strong>Cancel this event</strong><span>Cancel a published event with ticket sales</span></span></button>'
        : '';
    return (
      '<div class="org-action-wrap">' +
      '<button type="button" class="org-action-btn" data-org-action-toggle aria-expanded="false">Actions <span class="chev">▾</span></button>' +
      '<div class="org-action-menu" role="menu">' +
      '<div class="org-action-menu-header">' +
      esc(shortTitle) +
      '</div>' +
      '<button type="button" class="org-action-item" data-edit-event="' +
      esc(id) +
      '"><span class="org-action-icon">✎</span><span class="org-action-text"><strong>Edit event</strong><span>Update details, times &amp; tickets</span></span></button>' +
      '<button type="button" class="org-action-item" data-org-goto-sub="events-attendees" data-filter-event="' +
      esc(id) +
      '"><span class="org-action-icon">👥</span><span class="org-action-text"><strong>See attendees</strong><span>View who registered for this event</span></span></button>' +
      '<button type="button" class="org-action-item" data-org-goto-sub="events-tickets" data-filter-event="' +
      esc(id) +
      '"><span class="org-action-icon">🎟️</span><span class="org-action-text"><strong>Ticket types</strong><span>Manage tiers and pricing</span></span></button>' +
      '<button type="button" class="org-action-item" data-org-goto-sub="events-revenue" data-filter-event="' +
      esc(id) +
      '"><span class="org-action-icon">£</span><span class="org-action-text"><strong>Revenue &amp; payout</strong><span>Request payout when eligible</span></span></button>' +
      cancelItem +
      '</div></div>'
    );
  }

  function totalRevenueDisplay() {
    const sum = state.events.reduce((s, ev) => s + (ev.revenueNum || 0), 0);
    return '£' + (sum % 1 === 0 ? sum.toFixed(0) : sum.toFixed(2));
  }

  function averageRating() {
    const rated = state.events.filter((e) => e.rating != null && !Number.isNaN(e.rating));
    if (!rated.length) return null;
    return rated.reduce((s, e) => s + e.rating, 0) / rated.length;
  }

  function averageReviewRating() {
    const list = filteredReviewsList();
    const rated = list.filter((r) => r.rating != null && !Number.isNaN(Number(r.rating)));
    if (!rated.length) return null;
    return rated.reduce((s, r) => s + Number(r.rating), 0) / rated.length;
  }

  function parseRoute() {
    const hash = (location.hash.replace('#', '') || 'dashboard').toLowerCase();
    if (hash === 'tickets') return { page: 'events', sub: 'events-tickets' };
    if (hash.startsWith('events-')) return { page: 'events', sub: hash };
    if (hash === 'events') return { page: 'events', sub: 'events-list' };
    if (hash === 'academy' || hash.startsWith('academy-')) return { page: 'academy', sub: null };
    if (hash === 'team') return { page: 'team', sub: null };
    return { page: hash, sub: null };
  }

  const ACADEMY_PREVIEW_SESSIONS = [
    { type: 'WORKSHOP', title: 'Pitch mastery — Workshop', host: 'Apex Events UK' },
    { type: 'SEMINAR', title: 'Executive presence — Seminar', host: 'Meridian Business Group' },
    { type: 'MASTERCLASS', title: 'Negotiation edge — Masterclass', host: 'Catalyst Collective' },
    { type: 'WORKSHOP', title: 'Storytelling for leaders — Workshop', host: 'Summit Path Ltd' },
  ];

  function renderAcademyPreview() {
    const grid = document.getElementById('org-academy-preview-grid');
    if (!grid || grid.dataset.rendered === '1') return;
    grid.dataset.rendered = '1';
    grid.innerHTML = ACADEMY_PREVIEW_SESSIONS.map(
      (s) =>
        '<article class="org-academy-mini-card">' +
        '<div class="org-academy-mini-media"><span class="org-academy-mini-type">' +
        esc(s.type) +
        '</span></div>' +
        '<div class="org-academy-mini-body"><strong>' +
        esc(s.title) +
        '</strong><span>' +
        esc(s.host) +
        '</span></div></article>'
    ).join('');
  }

  function setEventsSub(sub) {
    eventsSubRoute = sub || 'events-list';
    document.querySelectorAll('[data-events-panel]').forEach((panel) => {
      panel.classList.toggle('is-active', panel.getAttribute('data-events-panel') === eventsSubRoute);
    });
    const titles = {
      'events-list': ['My Events', 'Manage all your event listings — click any event name to edit.'],
      'events-tickets': ['Tickets', 'All ticket types across your events.'],
      'events-attendees': ['Attendees', 'Registrations for your events — filter by event and download a CSV.'],
      'events-reviews': ['Reviews', 'Read and reply to attendee feedback.'],
      'events-revenue': ['Revenue', 'Revenue and performance across your listings.'],
    };
    const t = titles[eventsSubRoute] || titles['events-list'];
    const titleEl = document.getElementById('my-events-title');
    const subEl = document.getElementById('my-events-sub');
    if (titleEl) titleEl.textContent = t[0];
    if (subEl) subEl.textContent = t[1];

    if (eventsSubRoute === 'events-attendees') {
      fillAttendeesEventFilter();
      loadAttendeesAll().then(() => renderAttendees());
    }
  }

  function updateMyEventsTabCounts() {
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('tab-count-events', String(state.events.length));
    set('tab-count-tickets', String(state.tickets.length));
    set('tab-count-reviews', String(state.reviews.length));
    set('tab-count-revenue', totalRevenueDisplay());
  }

  function filteredAttendeesList() {
    let list = state.attendeesAll.slice();
    if (filters.attendeesEvent !== 'all') {
      list = list.filter((a) => a.eventId === filters.attendeesEvent);
    }
    return list;
  }

  function fillAttendeesEventFilter() {
    const sel = document.getElementById('filter-attendees-event');
    if (!sel) return;
    sel.innerHTML = '<option value="all">All events</option>';
    state.events.forEach((ev) => {
      const opt = document.createElement('option');
      opt.value = ev.id;
      opt.textContent = ev.title;
      sel.appendChild(opt);
    });
    sel.value = filters.attendeesEvent;
  }

  async function loadAttendeesAll() {
    const hint = document.getElementById('attendees-load-hint');
    if (hint) hint.hidden = false;
    const { ok, data } = await api('/api/organiser/attendees?eventId=all');
    if (hint) hint.hidden = true;
    if (ok) {
      state.attendeesAll = data.attendees || [];
      updateMyEventsTabCounts();
    }
    return ok;
  }

  function exportAttendeesCsv() {
    const rows = filteredAttendeesList();
    if (!rows.length) {
      alert('No attendees to export for this filter.');
      return;
    }
    const header = ['Name', 'Email', 'Phone', 'Event', 'Ticket', 'Quantity', 'Registered'];
    const lines = rows.map((a) =>
      [a.name, a.email, a.phone || '', a.eventTitle, a.ticketName, a.quantity, a.registeredAt]
        .map((c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"')
        .join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    const suffix =
      filters.attendeesEvent !== 'all'
        ? '-' + String(filters.attendeesEvent).replace(/^rec/, '').slice(0, 8)
        : '-all-events';
    link.href = URL.createObjectURL(blob);
    link.download = 'attendees' + suffix + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function renderAttendees() {
    const body = document.getElementById('attendees-body');
    const empty = document.getElementById('attendees-empty');
    if (!body) return;
    const list = filteredAttendeesList();
    body.innerHTML = '';

    if (!list.length) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = state.attendeesAll.length
          ? 'No attendees match this event filter.'
          : 'No registrations yet. Attendees appear here when people book tickets for your events.';
      }
      updatePaginationNav('attendees', { totalPages: 1, start: 0, end: 0, total: 0, page: 1 });
      return;
    }
    if (empty) empty.hidden = true;
    const pageInfo = paginateList(list, listPages.attendees);
    listPages.attendees = pageInfo.page;
    updatePaginationNav('attendees', pageInfo);

    pageInfo.items.forEach((a) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="org-td-name">' +
        esc(a.name) +
        '</td><td>' +
        esc(a.email || '—') +
        '</td><td>' +
        esc(a.eventTitle) +
        '</td><td>' +
        esc(a.ticketName) +
        '</td><td>' +
        esc(String(a.quantity)) +
        '</td><td>' +
        esc(formatDateShort(a.registeredAt)) +
        '</td>';
      body.appendChild(tr);
    });
  }

  function filteredGroupsList() {
    let list = state.groups.slice();
    const q = filters.groupsSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((g) => {
        const hay = [g.name, g.description, g.website, g.location]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (filters.groupsStatus !== 'all') {
      list = list.filter((g) => (g.statusKey || '') === filters.groupsStatus);
    }
    return list;
  }

  function filteredEventsList() {
    let list = state.events.slice();
    const q = filters.eventsSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((ev) => {
        const hay = [
          ev.title,
          ev.type,
          ev.location,
          ev.venue,
          ev.city,
          ev.postcode,
          ev.description,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (filters.eventsStatus !== 'all') {
      list = list.filter((ev) => (ev.statusKey || '') === filters.eventsStatus);
    }
    if (filters.eventsType !== 'all') {
      list = list.filter((ev) => String(ev.type || '') === filters.eventsType);
    }
    return list;
  }

  function filteredTicketsList() {
    let list = state.tickets.slice();
    if (filters.ticketsEvent !== 'all') {
      list = list.filter((t) => t.eventId === filters.ticketsEvent);
    }
    if (filters.ticketsType !== 'all') {
      list = list.filter((t) => String(t.name || '') === filters.ticketsType);
    }
    return list;
  }

  function filteredReviewsList() {
    let list = state.reviews.slice();
    if (filters.reviewsGroup !== 'all') {
      list = list.filter((r) => r.groupId === filters.reviewsGroup);
    }
    return list;
  }

  function fillMyEventsFilters() {
    const typeSel = document.getElementById('filter-events-type');
    if (typeSel) {
      const types = [...new Set(state.events.map((e) => e.type).filter(Boolean))].sort();
      typeSel.innerHTML = '<option value="all">All types</option>';
      types.forEach((t) => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        typeSel.appendChild(opt);
      });
      typeSel.value = filters.eventsType;
    }

    const ticketEventSel = document.getElementById('filter-tickets-event');
    if (ticketEventSel) {
      ticketEventSel.innerHTML = '<option value="all">All events</option>';
      state.events.forEach((ev) => {
        const opt = document.createElement('option');
        opt.value = ev.id;
        opt.textContent = ev.title;
        ticketEventSel.appendChild(opt);
      });
      ticketEventSel.value = filters.ticketsEvent;
    }

    const ticketTypeSel = document.getElementById('filter-tickets-type');
    if (ticketTypeSel) {
      const names = [...new Set(state.tickets.map((t) => t.name).filter(Boolean))].sort();
      ticketTypeSel.innerHTML = '<option value="all">All ticket types</option>';
      names.forEach((n) => {
        const opt = document.createElement('option');
        opt.value = n;
        opt.textContent = n;
        ticketTypeSel.appendChild(opt);
      });
      ticketTypeSel.value = filters.ticketsType;
    }

    const reviewGroupSel = document.getElementById('filter-reviews-group');
    if (reviewGroupSel) {
      reviewGroupSel.innerHTML = '<option value="all">All your groups</option>';
      state.groups.forEach((g) => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.name;
        reviewGroupSel.appendChild(opt);
      });
      reviewGroupSel.value = filters.reviewsGroup;
    }

    fillAttendeesEventFilter();
  }

  function eventEditorUrl(ev) {
    if (!ev || !ev.id) return 'event-edit.html';
    return 'event-edit.html?id=' + encodeURIComponent(ev.id);
  }

  function goToEventEditor(ev) {
    location.href = eventEditorUrl(ev);
  }

  function groupEditorUrl(g) {
    if (!g || !g.id) return 'group-edit.html';
    return 'group-edit.html?id=' + encodeURIComponent(g.id);
  }

  function goToGroupEditor(g) {
    location.href = groupEditorUrl(g);
  }

  function starsReviewHtml(rating) {
    const n = Math.min(5, Math.max(0, Math.round(Number(rating) || 0)));
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += '<span class="org-rating-star' + (i <= n ? '' : ' muted') + '" aria-hidden="true">★</span>';
    }
    return html;
  }

  function paginateList(items, page) {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / ORG_PAGE_SIZE));
    const p = Math.min(Math.max(1, page), totalPages);
    const start = (p - 1) * ORG_PAGE_SIZE;
    return {
      items: items.slice(start, start + ORG_PAGE_SIZE),
      page: p,
      totalPages,
      total,
      start: total ? start + 1 : 0,
      end: Math.min(start + ORG_PAGE_SIZE, total),
    };
  }

  function paginationNavHtml(page, totalPages) {
    if (totalPages <= 1) return '';

    const items = [];
    const maxVisible = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);

    items.push(
      '<button type="button" class="org-page-btn page-prev" data-page="' +
        (page - 1) +
        '" ' +
        (page <= 1 ? 'disabled' : '') +
        ' aria-label="Previous page">‹</button>'
    );

    if (start > 1) {
      items.push('<button type="button" class="org-page-btn" data-page="1">1</button>');
      if (start > 2) items.push('<span class="org-page-ellipsis" aria-hidden="true">…</span>');
    }

    for (let p = start; p <= end; p++) {
      items.push(
        '<button type="button" class="org-page-btn' +
          (p === page ? ' is-active' : '') +
          '" data-page="' +
          p +
          '"' +
          (p === page ? ' aria-current="page"' : '') +
          '>' +
          p +
          '</button>'
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        items.push('<span class="org-page-ellipsis" aria-hidden="true">…</span>');
      }
      items.push(
        '<button type="button" class="org-page-btn" data-page="' + totalPages + '">' + totalPages + '</button>'
      );
    }

    items.push(
      '<button type="button" class="org-page-btn page-next" data-page="' +
        (page + 1) +
        '" ' +
        (page >= totalPages ? 'disabled' : '') +
        ' aria-label="Next page">›</button>'
    );

    return items.join('');
  }

  function updatePaginationNav(listKey, pageInfo) {
    const nav = document.getElementById('pagination-' + listKey);
    if (!nav) return;
    if (pageInfo.totalPages <= 1) {
      nav.hidden = true;
      nav.innerHTML = '';
      return;
    }
    nav.hidden = false;
    const meta =
      '<p class="org-pagination-meta">Showing ' +
      pageInfo.start +
      '–' +
      pageInfo.end +
      ' of ' +
      pageInfo.total +
      '</p>';
    nav.innerHTML = meta + paginationNavHtml(pageInfo.page, pageInfo.totalPages);
  }

  function findGroupById(id) {
    return state.groups.find((x) => x.id === id);
  }

  function findEventById(id) {
    return (
      state.events.find((x) => x.id === id) ||
      (state.upcomingEvents || []).find((x) => x.id === id)
    );
  }

  async function confirmUnpublishGroup(groupId) {
    if (!groupId) return;
    const g = findGroupById(groupId);
    const label = g && g.name ? g.name : 'this group';
    const ok = window.confirm(
      'Unpublish "' +
        label +
        '"?\n\n' +
        'This group will be removed from the public site immediately.\n\n' +
        'After 60 days of being unpublished, this group will be permanently deleted.'
    );
    if (!ok) return;

    const res = await api('/api/organiser/groups', {
      method: 'POST',
      body: JSON.stringify({ action: 'unpublish', id: groupId }),
    });
    if (!res.ok) {
      window.alert(res.data.message || res.data.error || 'Could not unpublish this group.');
      return;
    }
    await loadBootstrap();
    renderAll();
  }

  function closeAllActionMenus() {
    document.querySelectorAll('.org-action-menu.is-open').forEach((m) => {
      m.classList.remove('is-open', 'is-floating');
      m.style.top = '';
      m.style.left = '';
      m.style.right = '';
      m.style.bottom = '';
      if (m._actionWrap) {
        m._actionWrap.appendChild(m);
        m._actionWrap = null;
      }
    });
    document.querySelectorAll('[data-org-action-toggle][aria-expanded="true"]').forEach((b) => {
      b.setAttribute('aria-expanded', 'false');
    });
  }

  function openActionMenu(menu, toggle) {
    const wrap = toggle.closest('.org-action-wrap');
    if (wrap && menu.parentElement !== document.body) {
      menu._actionWrap = wrap;
      document.body.appendChild(menu);
    }
    menu.classList.add('is-open', 'is-floating');
    toggle.setAttribute('aria-expanded', 'true');
    menu.style.visibility = 'hidden';
    menu.style.display = 'block';
    const rect = toggle.getBoundingClientRect();
    const menuW = menu.offsetWidth || 220;
    const menuH = menu.offsetHeight || 180;
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
    menu.style.visibility = '';
  }

  function handleActionMenuChoice(e) {
    const unpublishBtn = e.target.closest('[data-unpublish-group]');
    if (unpublishBtn && !unpublishBtn.disabled) {
      e.preventDefault();
      e.stopPropagation();
      closeAllActionMenus();
      const gid = unpublishBtn.getAttribute('data-unpublish-group');
      confirmUnpublishGroup(gid);
      return true;
    }

    const editGroupBtn = e.target.closest('[data-edit-group]');
    if (editGroupBtn && !editGroupBtn.disabled) {
      e.preventDefault();
      e.stopPropagation();
      closeAllActionMenus();
      const gid = editGroupBtn.getAttribute('data-edit-group');
      const g = findGroupById(gid);
      if (g) goToGroupEditor(g);
      else if (gid) location.href = 'group-edit.html?id=' + encodeURIComponent(gid);
      return true;
    }

    const editEventBtn = e.target.closest('[data-edit-event]');
    if (editEventBtn && !editEventBtn.disabled) {
      e.preventDefault();
      e.stopPropagation();
      closeAllActionMenus();
      const eid = editEventBtn.getAttribute('data-edit-event');
      const ev = findEventById(eid);
      if (ev) goToEventEditor(ev);
      else if (eid) location.href = 'event-edit.html?id=' + encodeURIComponent(eid);
      return true;
    }

    const subBtn = e.target.closest('[data-org-goto-sub]');
    if (subBtn && !subBtn.disabled) {
      e.preventDefault();
      e.stopPropagation();
      closeAllActionMenus();
      const sub = subBtn.getAttribute('data-org-goto-sub');
      const eventId = subBtn.getAttribute('data-filter-event');
      if (eventId) {
        filters.ticketsEvent = eventId;
        filters.attendeesEvent = eventId;
        filters.reviewsGroup = 'all';
        const ticketSel = document.getElementById('filter-tickets-event');
        if (ticketSel) ticketSel.value = eventId;
        const attSel = document.getElementById('filter-attendees-event');
        if (attSel) attSel.value = eventId;
      }
      setRoute(sub || 'events-list');
      if (sub === 'events-tickets') renderTickets();
      if (sub === 'events-attendees') renderAttendees();
      if (sub === 'events-reviews') renderReviews();
      if (sub === 'events-revenue') renderRevenue();
      return true;
    }

    const cancelBtn = e.target.closest('[data-cancel-event]');
    if (cancelBtn && !cancelBtn.disabled) {
      e.preventDefault();
      e.stopPropagation();
      closeAllActionMenus();
      const eid = cancelBtn.getAttribute('data-cancel-event');
      openCancelEventModal(eid);
      return true;
    }

    return false;
  }

  let pendingPayoutEventId = null;
  let pendingCancelEventId = null;

  function closePayoutModal() {
    pendingPayoutEventId = null;
    const modal = document.getElementById('modal-payout');
    if (modal) modal.hidden = true;
    const submitBtn = document.getElementById('btn-payout-submit');
    if (submitBtn) submitBtn.disabled = true;
  }

  async function openPayoutModal(eventId) {
    pendingPayoutEventId = eventId;
    const modal = document.getElementById('modal-payout');
    const breakdownEl = document.getElementById('modal-payout-breakdown');
    const ineligibleEl = document.getElementById('modal-payout-ineligible');
    const submitBtn = document.getElementById('btn-payout-submit');
    const titleEl = document.getElementById('modal-payout-event');
    if (!modal) return;

    if (titleEl) titleEl.textContent = 'Loading payout breakdown…';
    if (breakdownEl) breakdownEl.hidden = true;
    if (ineligibleEl) {
      ineligibleEl.hidden = true;
      ineligibleEl.textContent = '';
    }
    if (submitBtn) submitBtn.disabled = true;
    modal.hidden = false;

    const { ok, data } = await api(
      '/api/organiser/payouts?eventId=' + encodeURIComponent(eventId)
    );
    if (!ok) {
      closePayoutModal();
      alert(data.message || data.error || 'Could not load payout breakdown');
      return;
    }

    const preview = data.preview || {};
    const ev = findEventById(eventId);
    if (titleEl) {
      titleEl.textContent = preview.eventTitle || (ev && ev.title) || 'Event payout';
    }

    const fmt = preview.breakdownFormatted || {};
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('payout-gross', fmt.amountGross || '£0.00');
    set('payout-stripe', '-' + String(fmt.stripeFee || '£0.00').replace(/^-/, ''));
    set('payout-platform', '-' + String(fmt.platformFee || '£0.00').replace(/^-/, ''));
    set('payout-net', fmt.amountNet || '£0.00');

    if (breakdownEl) breakdownEl.hidden = false;

    if (!preview.canRequestPayout && ineligibleEl) {
      ineligibleEl.hidden = false;
      ineligibleEl.textContent =
        preview.ineligibleReason || 'This event is not eligible for a payout request yet.';
    }
    if (submitBtn) submitBtn.disabled = !preview.canRequestPayout;
  }

  async function submitPayoutRequest() {
    if (!pendingPayoutEventId) return;
    const submitBtn = document.getElementById('btn-payout-submit');
    if (submitBtn) submitBtn.disabled = true;
    const eventId = pendingPayoutEventId;
    const { ok, data } = await api('/api/organiser/payouts', {
      method: 'POST',
      body: JSON.stringify({ eventId }),
    });
    if (!ok) {
      if (submitBtn) submitBtn.disabled = false;
      alert(data.message || data.error || 'Could not request payout');
      return;
    }
    closePayoutModal();
    closeModals();
    showAirtableAlert(data.message || 'Payout request submitted.', false);
    await refresh();
    setRoute('events-revenue');
  }

  async function requestEventPayout(eventId) {
    await openPayoutModal(eventId);
  }

  async function confirmRefundsForEvent(eventId) {
    if (
      !window.confirm(
        'Confirm that you have issued refunds to all attendees for this event through your Stripe account?'
      )
    ) {
      return;
    }
    const { ok, data } = await api('/api/organiser/cancellations', {
      method: 'POST',
      body: JSON.stringify({ eventId, action: 'confirm_refunds' }),
    });
    if (!ok) {
      alert(data.message || data.error || 'Could not confirm refunds');
      return;
    }
    showAirtableAlert(data.message || 'Refunds confirmed.', false);
    await refresh();
    setRoute('events-revenue');
  }

  function groupNameById(id) {
    const g = state.groups.find((x) => x.id === id);
    return g ? g.name : '—';
  }

  function showAirtableAlert(message, isError) {
    if (!alertEl) return;
    if (!message) {
      alertEl.hidden = true;
      return;
    }
    alertEl.hidden = false;
    alertEl.className = 'org-alert' + (isError ? ' error' : '');
    alertEl.innerHTML = message;
  }

  function setRoute(route) {
    let page = route || 'dashboard';
    let sub = null;
    if (route && route.startsWith('events-')) {
      page = 'events';
      sub = route;
    } else if (route === 'events') {
      page = 'events';
      sub = 'events-list';
    } else if (route === 'tickets') {
      page = 'events';
      sub = 'events-tickets';
    } else if (route === 'academy' || (route && route.startsWith('academy-'))) {
      page = 'academy';
    } else if (route === 'team') {
      page = 'team';
    }

    const activeRoute = page === 'events' ? sub || 'events-list' : page;
    document.querySelectorAll('.hub-side-nav-link[data-org-route]').forEach((a) => {
      a.classList.toggle('is-active', a.getAttribute('data-org-route') === activeRoute);
    });
    document.querySelectorAll('[data-org-page]').forEach((p) => {
      p.classList.toggle('is-active', p.getAttribute('data-org-page') === page);
    });

    if (page === 'events') {
      setEventsSub(sub || eventsSubRoute || 'events-list');
    }
    if (page === 'academy') {
      renderAcademyPreview();
    }
    if (page === 'team') {
      loadTeamMembers().then(() => renderTeam());
    }

    const hash = page === 'events' ? sub || 'events-list' : page;
    if (location.hash.replace('#', '') !== hash) {
      history.replaceState(null, '', '#' + hash);
    }
  }

  function openModal(id) {
    if (id === 'modal-event') {
      location.href = 'event-format.html';
      return;
    }
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = false;
    el.classList.add('is-open');
  }

  function closeModals() {
    document.querySelectorAll('.org-modal').forEach((m) => {
      m.hidden = true;
      m.classList.remove('is-open');
    });
    pendingPayoutEventId = null;
    pendingCancelEventId = null;
    const cancelForm = document.getElementById('form-event-cancel');
    if (cancelForm) cancelForm.reset();
    const cancelConfirm = document.getElementById('btn-event-cancel-confirm');
    if (cancelConfirm) cancelConfirm.disabled = true;
    resetGroupLogoPicker();
  }

  function openCancelEventModal(eventId) {
    pendingCancelEventId = eventId;
    const modal = document.getElementById('modal-event-cancel');
    const titleEl = document.getElementById('modal-event-cancel-name');
    const confirmBtn = document.getElementById('btn-event-cancel-confirm');
    const checkbox = document.getElementById('event-cancel-refund-confirm');
    const ev = findEventById(eventId);
    if (titleEl) {
      titleEl.textContent = ev && ev.title ? '“' + ev.title + '”' : '';
    }
    if (confirmBtn) confirmBtn.disabled = !(checkbox && checkbox.checked);
    if (modal) {
      modal.hidden = false;
      modal.classList.add('is-open');
    }
  }

  async function submitEventCancellation() {
    if (!pendingCancelEventId) return;
    const reason = document.getElementById('event-cancel-reason')?.value;
    const details = document.getElementById('event-cancel-details')?.value.trim() || '';
    const refundTermsConfirmed = document.getElementById('event-cancel-refund-confirm')?.checked;
    const confirmBtn = document.getElementById('btn-event-cancel-confirm');
    if (!reason) {
      alert('Select a cancellation reason.');
      return;
    }
    if (!refundTermsConfirmed) {
      alert('Confirm you will refund all attendees within 14 days.');
      return;
    }
    if (confirmBtn) confirmBtn.disabled = true;
    const eventId = pendingCancelEventId;
    const { ok, data } = await api('/api/organiser/cancellations', {
      method: 'POST',
      body: JSON.stringify({
        eventId,
        reason,
        details,
        refundTermsConfirmed,
      }),
    });
    if (!ok) {
      if (confirmBtn) confirmBtn.disabled = false;
      alert(data.message || data.error || 'Could not cancel event');
      return;
    }
    closeModals();
    showAirtableAlert(data.message || 'Event cancelled.', false);
    await refresh();
    setRoute('events-list');
  }

  function renderOverviewGroups() {
    const body = document.getElementById('dash-groups-body');
    const empty = document.getElementById('dash-groups-empty');
    if (!body) return;
    body.innerHTML = '';
    const slice = state.groups.slice(0, 6);
    if (!slice.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    slice.forEach((g) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' +
        thumbHtml(g) +
        '</td><td class="org-td-name"><button type="button" class="org-td-name-click" data-edit-group="' +
        esc(g.id) +
        '">' +
        esc(g.name) +
        '</button></td><td>' +
        esc(String(g.eventsListed != null ? g.eventsListed : 0)) +
        '</td><td class="org-revenue">' +
        esc(g.revenueDisplay || '£0') +
        '</td><td>' +
        ratingHtml(g.rating) +
        '</td><td>' +
        statusBadgeHtml(g.statusKey || 'draft', g.statusLabel || 'Draft') +
        '</td><td class="org-td-actions">' +
        actionMenuHtml('group', g.id, g.name, g) +
        '</td>';
      body.appendChild(tr);
    });
  }

  function overviewEventsForDashboard() {
    const list = state.events.slice();
    list.sort((a, b) => {
      const draftA = String(a.statusKey || '').toLowerCase() === 'draft';
      const draftB = String(b.statusKey || '').toLowerCase() === 'draft';
      if (draftA !== draftB) return draftA ? 1 : -1;
      const da = a.date ? new Date(a.date).getTime() : Number.POSITIVE_INFINITY;
      const db = b.date ? new Date(b.date).getTime() : Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
    return list.slice(0, 6);
  }

  function renderOverviewEvents() {
    const body = document.getElementById('dash-events-body');
    const empty = document.getElementById('dash-events-empty');
    if (!body) return;
    body.innerHTML = '';
    const slice = overviewEventsForDashboard();
    if (!slice.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    slice.forEach((ev) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' +
        thumbHtml(ev) +
        '</td><td class="org-td-name"><button type="button" class="org-td-name-click" data-edit-event="' +
        esc(ev.id) +
        '">' +
        esc(ev.title) +
        '</button></td><td>' +
        esc(formatDateShort(ev.date)) +
        '</td><td>' +
        esc(formatTimeRange(ev.date, ev.endDate)) +
        '</td><td>' +
        esc(ev.ticketsSoldLabel || '0') +
        '</td><td class="org-revenue">' +
        esc(ev.revenueDisplay || '£0') +
        '</td><td>' +
        statusBadgeHtml(ev.statusKey || 'upcoming', ev.statusLabel || 'Upcoming') +
        '</td><td class="org-td-actions">' +
        actionMenuHtml('event', ev.id, ev.title) +
        '</td>';
      body.appendChild(tr);
    });
  }

  function renderGroups() {
    const body = document.getElementById('groups-body');
    const empty = document.getElementById('groups-empty');
    if (!body) return;
    body.innerHTML = '';
    const list = filteredGroupsList();
    if (!list.length) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = state.groups.length
          ? 'No groups match your search or filters.'
          : 'No groups yet. Create your first organiser group.';
      }
      updatePaginationNav('groups', { totalPages: 1, start: 0, end: 0, total: 0, page: 1 });
      return;
    }
    if (empty) empty.hidden = true;
    const pageInfo = paginateList(list, listPages.groups);
    listPages.groups = pageInfo.page;
    updatePaginationNav('groups', pageInfo);
    pageInfo.items.forEach((g) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' +
        thumbHtml(g) +
        '</td><td class="org-td-name"><button type="button" class="org-td-name-click" data-edit-group="' +
        esc(g.id) +
        '">' +
        esc(g.name) +
        '</button></td><td>' +
        esc(String(g.eventsListed != null ? g.eventsListed : 0)) +
        '</td><td class="org-revenue">' +
        esc(g.revenueDisplay || '£0') +
        '</td><td>' +
        ratingHtml(g.rating) +
        '</td><td>' +
        statusBadgeHtml(g.statusKey || 'draft', g.statusLabel || 'Draft') +
        '</td><td class="org-td-actions">' +
        actionMenuHtml('group', g.id, g.name, g) +
        '</td>';
      body.appendChild(tr);
    });
  }

  function renderEvents() {
    const body = document.getElementById('events-body');
    const empty = document.getElementById('events-empty');
    if (!body) return;
    const list = filteredEventsList();
    body.innerHTML = '';

    if (!list.length) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = state.events.length
          ? 'No events match your filters.'
          : 'Create a group first, then add an event.';
      }
      updatePaginationNav('events', { totalPages: 1, start: 0, end: 0, total: 0, page: 1 });
      return;
    }
    if (empty) empty.hidden = true;
    const pageInfo = paginateList(list, listPages.events);
    listPages.events = pageInfo.page;
    updatePaginationNav('events', pageInfo);

    pageInfo.items.forEach((ev) => {
      const tr = document.createElement('tr');
      const revClass =
        ev.revenueNum > 0 ? 'org-revenue' : 'org-revenue muted';
      tr.innerHTML =
        '<td>' +
        thumbHtml(ev) +
        '</td><td class="org-td-name"><button type="button" class="org-td-name-click" data-edit-event="' +
        esc(ev.id) +
        '">' +
        esc(ev.title) +
        '</button></td><td>' +
        esc(formatDateShort(ev.date)) +
        '</td><td>' +
        esc(formatTimeRange(ev.date, ev.endDate)) +
        '</td><td>' +
        esc(ev.ticketsSoldLabel || '0') +
        '</td><td class="' +
        revClass +
        '">' +
        esc(ev.revenueDisplay || '£0') +
        '</td><td>' +
        statusBadgeHtml(ev.statusKey || 'draft', ev.statusLabel || 'Draft') +
        '</td><td class="org-td-actions">' +
        eventActionMenuHtmlWithItem(ev) +
        '</td>';
      body.appendChild(tr);
    });
  }

  function renderTickets() {
    const body = document.getElementById('tickets-body');
    const empty = document.getElementById('tickets-empty');
    if (!body) return;
    const list = filteredTicketsList();
    body.innerHTML = '';

    if (!list.length) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = state.tickets.length
          ? 'No ticket types match your filters.'
          : 'No ticket types yet.';
      }
      updatePaginationNav('tickets', { totalPages: 1, start: 0, end: 0, total: 0, page: 1 });
      return;
    }
    if (empty) empty.hidden = true;
    const pageInfo = paginateList(list, listPages.tickets);
    listPages.tickets = pageInfo.page;
    updatePaginationNav('tickets', pageInfo);

    pageInfo.items.forEach((t) => {
      const ev = state.events.find((e) => e.id === t.eventId);
      const ref = 'TNH-' + String(t.id).replace(/^rec/, '').slice(0, 8).toUpperCase();
      const tierBadge =
        /vip/i.test(t.name) ? 'org-badge-ticket-gold' : 'org-badge-ticket-purple';
      const statusKey = /sold/i.test(t.status) ? 'draft' : 'live';
      const statusLabel = t.status || 'Available';
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td style="font-family:monospace;font-size:11px">' +
        esc(ref) +
        '</td><td>' +
        esc(ev ? ev.title : '—') +
        '</td><td><span class="org-badge ' +
        tierBadge +
        '">' +
        esc(t.name) +
        '</span></td><td class="org-revenue">' +
        (t.price === '' || t.price === '0' ? 'Free' : '£' + esc(t.price)) +
        '</td><td>' +
        esc(t.quantityAvailable != null ? String(t.quantityAvailable) : '—') +
        '</td><td>' +
        statusBadgeHtml(statusKey, statusLabel) +
        '</td>';
      body.appendChild(tr);
    });
  }

  function renderReviews() {
    const listEl = document.getElementById('reviews-list');
    const empty = document.getElementById('reviews-empty');
    if (!listEl) return;
    const list = filteredReviewsList();
    listEl.innerHTML = '';

    const avg = averageReviewRating();
    const summary = document.getElementById('reviews-summary');
    if (summary) {
      summary.innerHTML =
        list.length +
        ' review' +
        (list.length === 1 ? '' : 's') +
        (avg != null && list.length
          ? ' · Overall average: <strong class="org-rating">★ ' + avg.toFixed(1) + '</strong>'
          : '');
    }

    if (!list.length) {
      if (empty) empty.hidden = false;
      updatePaginationNav('reviews', { totalPages: 1, start: 0, end: 0, total: 0, page: 1 });
      return;
    }
    if (empty) empty.hidden = true;
    const pageInfo = paginateList(list, listPages.reviews);
    listPages.reviews = pageInfo.page;
    updatePaginationNav('reviews', pageInfo);

    pageInfo.items.forEach((r) => {
      const card = document.createElement('article');
      card.className = 'org-review-card';
      const replyBlock = r.reply
        ? '<div class="org-review-reply"><div class="org-review-reply-label">Your reply</div><div class="org-review-reply-text">' +
          esc(r.reply) +
          '</div></div>'
        : '<button type="button" class="org-btn org-btn-outline" style="font-size:11px;margin-top:8px" disabled>Reply to this review (coming soon)</button>';
      card.innerHTML =
        '<div class="org-review-card-header"><div style="display:flex;align-items:center;gap:10px">' +
        '<div class="org-reviewer-avatar">' +
        esc(r.initials || '?') +
        '</div><div><div class="org-reviewer-name">' +
        esc(r.authorName) +
        '</div><div class="org-reviewer-meta">' +
        esc(r.groupName) +
        ' · ' +
        esc(r.eventTitle) +
        ' · ' +
        esc(formatDateShort(r.date)) +
        '</div></div></div><div class="org-rating">' +
        starsReviewHtml(r.rating) +
        '</div></div><div class="org-review-body">"' +
        esc(r.body) +
        '"</div>' +
        replyBlock;
      listEl.appendChild(card);
    });
  }

  function renderPayoutHeldBanner() {
    const banner = document.getElementById('payout-held-banner');
    if (!banner) return;
    const held = state.events.filter((ev) => ev.needsRefundConfirmation);
    if (!held.length) {
      banner.hidden = true;
      banner.innerHTML = '';
      return;
    }
    banner.hidden = false;
    const names = held.map((ev) => esc(ev.title)).join(', ');
    banner.innerHTML =
      '<p><strong>Your payout is on hold</strong> — please confirm refunds have been issued to all attendees for: ' +
      names +
      '.</p>';
  }

  function renderRevenue() {
    const body = document.getElementById('revenue-body');
    if (!body) return;
    const list = filteredEventsList().length ? filteredEventsList() : state.events.slice();
    body.innerHTML = '';
    renderPayoutHeldBanner();

    const setRev = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setRev('rev-stat-events', String(state.events.length));
    setRev('rev-stat-tickets', String(state.tickets.length));
    setRev('rev-stat-revenue', totalRevenueDisplay());
    const avg = averageRating();
    setRev('rev-stat-rating', avg != null ? '★ ' + avg.toFixed(1) : '—');

    const pageInfo = paginateList(list, listPages.revenue);
    listPages.revenue = pageInfo.page;
    updatePaginationNav('revenue', pageInfo);

    pageInfo.items.forEach((ev) => {
      const tr = document.createElement('tr');
      if (ev.needsRefundConfirmation) tr.classList.add('org-row-payout-held');
      tr.innerHTML =
        '<td>' +
        thumbHtml(ev) +
        '</td><td class="org-td-name"><button type="button" class="org-td-name-click" data-edit-event="' +
        esc(ev.id) +
        '">' +
        esc(ev.title) +
        '</button>' +
        (ev.needsRefundConfirmation
          ? '<p class="org-payout-held-note">Payout on hold — confirm refunds issued</p>'
          : '') +
        '</td><td>' +
        esc(ev.ticketsSoldLabel || '0') +
        '</td><td class="org-revenue">' +
        esc(ev.revenueDisplay || '£0') +
        '</td><td>' +
        ratingHtml(ev.rating) +
        '</td><td>' +
        statusBadgeHtml(ev.statusKey || 'draft', ev.statusLabel || 'Draft') +
        '</td><td>' +
        payoutStatusBadgeHtml(ev) +
        '</td><td class="org-td-actions">' +
        payoutActionsHtml(ev) +
        '</td>';
      body.appendChild(tr);
    });
  }

  function renderMyEventsHub() {
    updateMyEventsTabCounts();
    fillMyEventsFilters();
    renderEvents();
    renderTickets();
    renderAttendees();
    renderReviews();
    renderRevenue();
  }

  function teamRoleLabel(role) {
    return role === 'owner' ? 'Owner' : 'Editor';
  }

  function teamStatusLabel(status) {
    return status === 'active' ? 'Active' : 'Pending';
  }

  async function loadTeamMembers() {
    const { ok, data } = await api('/api/organiser/team');
    if (!ok) {
      state.teamMembers = [];
      state.teamError =
        data.message ||
        data.error ||
        (data.error === 'team_not_supported' ? 'Team management is not available on this server.' : 'Could not load team members.');
      return;
    }
    state.teamError = null;
    state.teamMembers = data.members || [];
    state.canManageTeam = data.canManageTeam !== false;
    state.canDeleteEvents = data.canDeleteEvents !== false;
    state.organiserRole = data.role || state.organiserRole;
  }

  function renderTeam() {
    const body = document.getElementById('team-body');
    const empty = document.getElementById('team-empty');
    const inviteBtn = document.getElementById('btn-invite-team');
    const teamPage = document.getElementById('org-page-team');
    if (!body) return;
    body.innerHTML = '';
    if (inviteBtn) inviteBtn.hidden = !state.canManageTeam;
    if (teamPage) {
      let errEl = teamPage.querySelector('.org-team-error');
      if (state.teamError) {
        if (!errEl) {
          errEl = document.createElement('p');
          errEl.className = 'org-alert error org-team-error';
          const toolbar = teamPage.querySelector('.org-toolbar');
          if (toolbar && toolbar.nextSibling) {
            teamPage.insertBefore(errEl, toolbar.nextSibling);
          } else {
            teamPage.prepend(errEl);
          }
        }
        errEl.textContent = state.teamError;
        errEl.hidden = false;
      } else if (errEl) {
        errEl.hidden = true;
      }
    }

    const list = state.teamMembers.slice();
    if (!list.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    list.forEach((m) => {
      const tr = document.createElement('tr');
      const isOwner = m.role === 'owner' || m.isAccountOwner;
      const actions = [];
      if (!isOwner && state.canManageTeam) {
        if (m.status === 'pending') {
          actions.push(
            '<button type="button" class="org-btn org-btn-outline org-btn-sm" data-team-resend="' +
              esc(m.id) +
              '">Resend invite</button>'
          );
        }
        actions.push(
          '<button type="button" class="org-btn org-btn-outline org-btn-sm" data-team-remove="' +
            esc(m.id) +
            '">Remove</button>'
        );
      }
      tr.innerHTML =
        '<td>' +
        esc(m.email) +
        '</td><td>' +
        esc(teamRoleLabel(m.role)) +
        '</td><td>' +
        esc(teamStatusLabel(m.status)) +
        '</td><td class="org-td-actions">' +
        (actions.join(' ') || '—') +
        '</td>';
      body.appendChild(tr);
    });
  }

  function bindTeamUi() {
    const inviteBtn = document.getElementById('btn-invite-team');
    if (inviteBtn) {
      inviteBtn.addEventListener('click', () => openModal('modal-team-invite'));
    }
    const form = document.getElementById('form-team-invite');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('team-invite-email').value.trim();
        const btn = e.submitter;
        if (btn) btn.disabled = true;
        const { ok, data } = await api('/api/organiser/team', {
          method: 'POST',
          body: JSON.stringify({ email, role: 'editor' }),
        });
        if (btn) btn.disabled = false;
        if (!ok) {
          alert(data.message || data.error || 'Could not send invite');
          return;
        }
        closeModals();
        form.reset();
        await loadTeamMembers();
        renderTeam();
        showAirtableAlert(data.message || 'Invite sent.', false);
      });
    }
    const teamPage = document.getElementById('org-page-team');
    if (teamPage) {
      teamPage.addEventListener('click', async (e) => {
        const resend = e.target.closest('[data-team-resend]');
        if (resend) {
          const id = resend.getAttribute('data-team-resend');
          const { ok, data } = await api('/api/organiser/team', {
            method: 'POST',
            body: JSON.stringify({ action: 'resend', id }),
          });
          if (!ok) alert(data.message || data.error || 'Could not resend invite');
          else {
            await loadTeamMembers();
            renderTeam();
            showAirtableAlert(data.message || 'Invite resent.', false);
          }
          return;
        }
        const remove = e.target.closest('[data-team-remove]');
        if (remove) {
          const id = remove.getAttribute('data-team-remove');
          if (!window.confirm('Remove this team member?')) return;
          const { ok, data } = await api('/api/organiser/team', {
            method: 'DELETE',
            body: JSON.stringify({ id }),
          });
          if (!ok) alert(data.message || data.error || 'Could not remove member');
          else {
            await loadTeamMembers();
            renderTeam();
          }
        }
      });
    }
  }

  function fillGroupSelect(select) {
    if (!select) return;
    select.innerHTML = '';
    if (!state.groups.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Create a group first';
      select.appendChild(opt);
      select.disabled = true;
      return;
    }
    select.disabled = false;
    state.groups.forEach((g) => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      select.appendChild(opt);
    });
  }

  function fillEventSelect(select) {
    if (!select) return;
    select.innerHTML = '';
    if (!state.events.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Create an event first';
      select.appendChild(opt);
      select.disabled = true;
      return;
    }
    select.disabled = false;
    state.events.forEach((ev) => {
      const opt = document.createElement('option');
      opt.value = ev.id;
      opt.textContent = ev.title;
      select.appendChild(opt);
    });
  }

  let scopeButtonsBound = false;
  function bindScopeButtonOnce() {
    if (scopeButtonsBound) return;
    scopeButtonsBound = true;
    document.getElementById('org-airtable-alert')?.addEventListener('click', (e) => {
      if (e.target.id === 'btn-scope-my') {
        setOrganiserScopeCookie('my');
        refresh();
      }
      if (e.target.id === 'btn-scope-all') {
        setOrganiserScopeCookie('clear');
        refresh();
      }
    });
  }

  function renderAll() {
    renderStats();
    renderOverviewGroups();
    renderOverviewEvents();
    renderGroups();
    renderTeam();
    renderMyEventsHub();
    fillEventSelect(document.getElementById('ticket-event'));
  }

  function setDashboardLoading(on) {
    const el = document.getElementById('org-dash-loading');
    if (el) el.hidden = !on;
  }

  async function loadBootstrap() {
    setDashboardLoading(true);
    try {
    const { ok, data } = await api('/api/organiser/bootstrap');
    if (!ok) throw new Error(data.message || data.error || 'load_failed');
    state.groups = data.groups || [];
    state.events = data.events || [];
    state.upcomingEvents = data.upcomingEvents || [];
    state.tickets = data.tickets || [];
    listPages.groups = 1;
    listPages.events = 1;
    listPages.tickets = 1;
    listPages.reviews = 1;
    listPages.revenue = 1;
    listPages.attendees = 1;
    state.reviews = data.reviews || [];
    loadAttendeesAll();
    state.groupsError = data.groupsError;
    state.airtable = data.airtable;
    state.adminView = data.adminView;
    state.personalScope = data.personalScope;
    state.isAdmin = data.isAdmin;
    if (data.user) {
      state.user = { ...state.user, ...data.user };
    }
    state.canManageTeam = data.canManageTeam !== false;
    state.canDeleteEvents = data.canDeleteEvents !== false;
    state.organiserRole = data.organiserRole || 'owner';
    loadTeamMembers().then(() => renderTeam());

    if (data.adminView) {
      showAirtableAlert(
        '<strong>Admin view</strong> — showing all group profiles, events, Academy sessions, and ticket types across the platform.' +
          '<div class="org-scope-actions"><button type="button" class="org-btn org-btn-primary org-btn-sm" id="btn-scope-my">View my organiser data only</button></div>',
        false
      );
      bindScopeButtonOnce();
    } else if (data.personalScope && data.isAdmin) {
      showAirtableAlert(
        '<strong>My organiser view</strong> — showing only groups and events linked to your account (' +
          esc(state.user.email) +
          ').' +
          '<div class="org-scope-actions"><button type="button" class="org-btn org-btn-outline org-btn-sm" id="btn-scope-all">View all (admin)</button></div>',
        false
      );
      bindScopeButtonOnce();
    } else if (data.groupsError) {
      showAirtableAlert(
        '<strong>Could not load group profiles.</strong> ' + esc(data.groupsError),
        true
      );
    } else if (!state.groups.length) {
      showAirtableAlert(
        'Create your first <strong>group profile</strong> (Group profiles in the sidebar), then add events and ticket types.',
        false
      );
    } else if (!data.adminView) {
      showAirtableAlert(null);
    }

    applyPendingGroupSave();
    renderAll();
    } finally {
      setDashboardLoading(false);
    }
  }

  async function refresh() {
    await loadBootstrap();
  }

  let groupLogoFile = null;

  function resetGroupLogoPicker() {
    groupLogoFile = null;
    const fileInput = document.getElementById('group-logo-file');
    const preview = document.getElementById('group-logo-preview');
    const placeholder = document.getElementById('group-logo-placeholder');
    const urlInput = document.getElementById('group-logo-url');
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    if (preview) preview.hidden = true;
    if (placeholder) placeholder.hidden = false;
  }

  function bindGroupLogoPicker() {
    const zone = document.getElementById('group-logo-zone');
    const fileInput = document.getElementById('group-logo-file');
    const preview = document.getElementById('group-logo-preview');
    const previewImg = document.getElementById('group-logo-preview-img');
    const placeholder = document.getElementById('group-logo-placeholder');
    const clearBtn = document.getElementById('group-logo-clear');
    if (!zone || !fileInput) return;

    function setGroupLogoFile(file) {
      groupLogoFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        if (previewImg) previewImg.src = reader.result;
        if (preview) preview.hidden = false;
        if (placeholder) placeholder.hidden = true;
      };
      reader.readAsDataURL(file);
    }

    if (window.hubBindImageUpload) {
      window.hubBindImageUpload({ zone, fileInput, onFile: setGroupLogoFile });
    }
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetGroupLogoPicker();
      });
    }
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('read_failed'));
      reader.readAsDataURL(file);
    });
  }

  function bindForms() {
    bindGroupLogoPicker();

    document.getElementById('form-group').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('group-name').value.trim();
      const description = document.getElementById('group-description').value.trim();
      const website = document.getElementById('group-website').value.trim();
      const logoUrl = document.getElementById('group-logo-url').value.trim();
      const payload = { name, description, website, logoUrl };

      if (groupLogoFile) {
        try {
          payload.logoBase64 = await readFileAsBase64(groupLogoFile);
          payload.logoMime = groupLogoFile.type || 'image/jpeg';
          payload.logoFilename = groupLogoFile.name || 'logo.jpg';
        } catch {
          alert('Could not read the logo file. Try again or use an image URL.');
          return;
        }
      }

      const btn = e.submitter;
      if (btn) btn.disabled = true;
      const { ok, data } = await api('/api/organiser/groups', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (btn) btn.disabled = false;
      if (!ok) {
        alert(data.message || data.error || 'Could not create group');
        return;
      }
      const logoWarning = data.logoWarning || data.group?.logoWarning;
      closeModals();
      document.getElementById('form-group').reset();
      resetGroupLogoPicker();
      await refresh();
      setRoute('groups');
      if (logoWarning) alert(logoWarning);
    });

    document.getElementById('form-ticket').addEventListener('submit', async (e) => {
      e.preventDefault();
      const eventId = document.getElementById('ticket-event').value;
      const name = document.getElementById('ticket-name').value.trim();
      const price = document.getElementById('ticket-price').value;
      const description = document.getElementById('ticket-description').value.trim();
      const status = document.getElementById('ticket-status').value;
      const qty = document.getElementById('ticket-qty').value;
      const btn = e.submitter;
      if (btn) btn.disabled = true;
      const { ok, data } = await api('/api/organiser/tickets', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          name,
          price,
          description,
          status,
          quantityAvailable: qty === '' ? null : Number(qty),
        }),
      });
      if (btn) btn.disabled = false;
      if (!ok) {
        alert(data.message || data.error || 'Could not create ticket');
        return;
      }
      closeModals();
      document.getElementById('form-ticket').reset();
      await refresh();
      setRoute('events-tickets');
    });
  }

  function bindUi() {
    document.querySelectorAll('[data-org-modal-close]').forEach((el) => {
      el.addEventListener('click', closeModals);
    });

    function goToNewGroupEditor() {
      location.href = 'group-edit.html';
    }

    function goToNewEventEditor(e) {
      if (e && e.preventDefault) e.preventDefault();
      if (!state.groups.length) {
        alert('You must add a group profile first.');
        location.href = 'group-edit.html';
        return;
      }
      try {
        sessionStorage.removeItem('hub_event_group_id');
      } catch (err) {
        /* ignore */
      }
      location.href = 'event-format.html';
    }

    const addToggle = document.getElementById('org-add-toggle');
    const addMenu = document.getElementById('org-add-menu');
    const addWrap = document.getElementById('org-add-menu-wrap');
    if (addToggle && addMenu) {
      addToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = !addMenu.hidden;
        addMenu.hidden = open;
        addToggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      });
      addMenu.querySelectorAll('[data-org-route]').forEach((item) => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          addMenu.hidden = true;
          addToggle.setAttribute('aria-expanded', 'false');
          setRoute(item.getAttribute('data-org-route') || 'dashboard');
        });
      });
      document.addEventListener('click', (e) => {
        if (addWrap && !addWrap.contains(e.target)) {
          addMenu.hidden = true;
          addToggle.setAttribute('aria-expanded', 'false');
        }
      });
    }

    document.querySelectorAll('#btn-new-event, [data-action="new-event"]').forEach((el) => {
      el.addEventListener('click', goToNewEventEditor);
    });

    document.querySelectorAll('.org-add-menu-item[href="event-format.html"]').forEach((el) => {
      el.addEventListener('click', goToNewEventEditor);
    });

    const btnNewTicket = document.getElementById('btn-new-ticket');
    if (btnNewTicket) {
      btnNewTicket.addEventListener('click', () => {
        if (!state.events.length) {
          alert('Create an event first.');
          setRoute('events-list');
          return;
        }
        fillEventSelect(document.getElementById('ticket-event'));
        openModal('modal-ticket');
      });
    }

    document.querySelectorAll('[data-org-goto]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-org-goto');
        setRoute(route);
        if (route === 'groups') goToNewGroupEditor();
        if (route === 'events' || route === 'events-list') goToNewEventEditor();
        if (route === 'tickets' || route === 'events-tickets') {
          setRoute('events-tickets');
          document.getElementById('btn-new-ticket')?.click();
        }
      });
    });

    document.querySelectorAll('[data-org-goto-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-org-goto-view') || 'dashboard';
        setRoute(route);
        if (route === 'dashboard' || route === 'groups') refresh();
      });
    });

    document.querySelectorAll('[data-org-shortcut]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-org-shortcut');
        if (!route) return;
        setRoute(route);
        if (route === 'groups') renderGroups();
        else if (route === 'events-reviews') {
          renderMyEventsHub();
          renderReviews();
        } else if (
          route === 'events-tickets' ||
          route === 'events-list' ||
          route === 'events-attendees' ||
          route === 'events-revenue'
        ) {
          renderMyEventsHub();
        } else if (route === 'team') {
          loadTeamMembers().then(() => renderTeam());
        }
      });
    });

    ['filter-events-status', 'filter-events-type', 'filter-events-search'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const evt = id === 'filter-events-search' ? 'input' : 'change';
      el.addEventListener(evt, () => {
        if (id === 'filter-events-status') filters.eventsStatus = el.value;
        if (id === 'filter-events-type') filters.eventsType = el.value;
        if (id === 'filter-events-search') filters.eventsSearch = el.value;
        listPages.events = 1;
        renderEvents();
      });
    });

    ['filter-groups-status', 'filter-groups-search'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const evt = id === 'filter-groups-search' ? 'input' : 'change';
      el.addEventListener(evt, () => {
        if (id === 'filter-groups-status') filters.groupsStatus = el.value;
        if (id === 'filter-groups-search') filters.groupsSearch = el.value;
        listPages.groups = 1;
        renderGroups();
      });
    });

    ['filter-tickets-event', 'filter-tickets-type'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        if (id === 'filter-tickets-event') filters.ticketsEvent = el.value;
        if (id === 'filter-tickets-type') filters.ticketsType = el.value;
        listPages.tickets = 1;
        renderTickets();
      });
    });

    const reviewGroupFilter = document.getElementById('filter-reviews-group');
    if (reviewGroupFilter) {
      reviewGroupFilter.addEventListener('change', () => {
        filters.reviewsGroup = reviewGroupFilter.value;
        listPages.reviews = 1;
        renderReviews();
      });
    }

    const attendeesEventFilter = document.getElementById('filter-attendees-event');
    if (attendeesEventFilter) {
      attendeesEventFilter.addEventListener('change', () => {
        filters.attendeesEvent = attendeesEventFilter.value;
        listPages.attendees = 1;
        renderAttendees();
      });
    }

    const btnDownloadAttendees = document.getElementById('btn-download-attendees-csv');
    if (btnDownloadAttendees) {
      btnDownloadAttendees.addEventListener('click', exportAttendeesCsv);
    }

    const downloadCsv = document.getElementById('btn-download-tickets-csv');
    if (downloadCsv) {
      downloadCsv.addEventListener('click', () => {
        const rows = filteredTicketsList();
        if (!rows.length) {
          alert('No ticket types to export.');
          return;
        }
        const header = ['Ticket ref', 'Event', 'Ticket type', 'Price', 'Qty available', 'Status'];
        const lines = rows.map((t) => {
          const ev = state.events.find((e) => e.id === t.eventId);
          return [
            'TNH-' + String(t.id).replace(/^rec/, '').slice(0, 8),
            ev ? ev.title : '',
            t.name,
            t.price,
            t.quantityAvailable != null ? t.quantityAvailable : '',
            t.status || 'Available',
          ]
            .map((c) => '"' + String(c).replace(/"/g, '""') + '"')
            .join(',');
        });
        const csv = [header.join(','), ...lines].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ticket-types.csv';
        a.click();
        URL.revokeObjectURL(a.href);
      });
    }

    document.addEventListener(
      'click',
      (e) => {
        if (handleActionMenuChoice(e)) return;

        const payoutBtn = e.target.closest('[data-request-payout]');
        if (payoutBtn) {
          e.preventDefault();
          requestEventPayout(payoutBtn.getAttribute('data-request-payout'));
          return;
        }
        const refundsBtn = e.target.closest('[data-confirm-refunds]');
        if (refundsBtn) {
          e.preventDefault();
          confirmRefundsForEvent(refundsBtn.getAttribute('data-confirm-refunds'));
          return;
        }

        const toggle = e.target.closest('[data-org-action-toggle]');
        if (toggle) {
          e.stopPropagation();
        const wrap = toggle.closest('.org-action-wrap');
        let menu = wrap && wrap.querySelector('.org-action-menu');
        if (!menu && wrap && wrap._actionMenuEl) {
          menu = wrap._actionMenuEl;
        }
        if (menu && wrap) wrap._actionMenuEl = menu;
          const wasOpen = menu && menu.classList.contains('is-open');
          closeAllActionMenus();
          if (menu && !wasOpen) {
            openActionMenu(menu, toggle);
          }
          return;
        }

        if (
          !e.target.closest('.org-action-menu') &&
          !e.target.closest('[data-org-action-toggle]')
        ) {
          closeAllActionMenus();
        }
      },
      true
    );

    document.querySelectorAll('[data-org-route]').forEach((el) => {
      if (el.tagName === 'A') {
        const href = el.getAttribute('href');
        if (href && !href.startsWith('#')) return;
      }
      el.addEventListener('click', (e) => {
        if (el.tagName === 'A') {
          const href = el.getAttribute('href');
          if (href && !href.startsWith('#')) return;
        }
        e.preventDefault();
        const route = el.getAttribute('data-org-route') || 'dashboard';
        setRoute(route);
        if (route === 'dashboard' || route === 'team' || route === 'groups') refresh();
      });
    });

    window.addEventListener('hashchange', () => {
      const r = parseRoute();
      setRoute(r.sub || r.page);
      if (r.page === 'groups' || r.page === 'dashboard' || r.page === 'team') refresh();
    });

    window.addEventListener('pageshow', (e) => {
      if (shell && !shell.hidden && (e.persisted || performance.getEntriesByType('navigation')[0]?.type === 'back_forward')) {
        refresh();
      }
    });

    window.addEventListener('scroll', closeAllActionMenus, true);
    window.addEventListener('resize', closeAllActionMenus);

    document.getElementById('org-shell')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.org-page-btn');
      if (!btn || btn.disabled) return;
      const nav = btn.closest('.org-pagination');
      if (!nav) return;
      const listKey = nav.getAttribute('data-list');
      const p = parseInt(btn.getAttribute('data-page'), 10);
      if (!listKey || !p || p === listPages[listKey]) return;
      listPages[listKey] = p;
      if (listKey === 'groups') renderGroups();
      if (listKey === 'events') renderEvents();
      if (listKey === 'tickets') renderTickets();
      if (listKey === 'reviews') renderReviews();
      if (listKey === 'attendees') renderAttendees();
      if (listKey === 'revenue') renderRevenue();
      nav.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModals();
    });

    const cancelRefundCheck = document.getElementById('event-cancel-refund-confirm');
    const cancelConfirmBtn = document.getElementById('btn-event-cancel-confirm');
    if (cancelRefundCheck && cancelConfirmBtn) {
      cancelRefundCheck.addEventListener('change', () => {
        cancelConfirmBtn.disabled = !cancelRefundCheck.checked;
      });
    }
    const cancelForm = document.getElementById('form-event-cancel');
    if (cancelForm) {
      cancelForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitEventCancellation();
      });
    }
  }

  async function boot(user) {
    state.user = user;
    try {
      await api('/api/auth/hub-mode', {
        method: 'POST',
        body: JSON.stringify({ mode: 'organiser' }),
      });
    } catch {
      /* non-fatal */
    }
    state.user = user;
    if (signin) signin.hidden = true;
    shell.hidden = false;
    const payoutSubmit = document.getElementById('btn-payout-submit');
    if (payoutSubmit) {
      payoutSubmit.addEventListener('click', submitPayoutRequest);
    }

    bindForms();
    bindTeamUi();
    bindUi();
    const initial = parseRoute();
    setRoute(initial.sub || initial.page);
    try {
      await loadBootstrap();
    } catch (e) {
      showAirtableAlert('Could not load dashboard: ' + esc(e.message), true);
    }
  }

  fetch('/api/auth/session', { credentials: 'include' })
    .then((res) => res.json())
    .then((data) => {
      if (!data.ok || !data.user) {
        if (signin) signin.hidden = false;
        return;
      }
      boot(data.user);
    })
    .catch(() => {
      if (signin) {
        signin.hidden = false;
        signin.querySelector('.org-section-sub').textContent =
          'Could not verify your session. Please try signing in again.';
      }
    });
})();
