/**
 * Organiser dashboard — groups, events, ticket types (Supabase via /api/organiser/*).
 */
(function () {
  const ORG_PAGE_SIZE = 10;
  const EVENTS_FETCH_SIZE = 100;
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
    eventsTotal: 0,
    eventsChunkOffset: 0,
    eventsHasMore: false,
    eventsLoading: false,
    eventsFullyLoaded: false,
    tickets: [],
    attendeesAll: [],
    reviews: [],
    teamMembers: [],
    workspaceSummary: null,
    eventSummaries: [],
    groupsError: null,
    airtable: null,
    canManageTeam: true,
    canDeleteEvents: true,
    organiserRole: 'owner',
    opportunityEnquiries: [],
    opportunityEnquiriesNewCount: 0,
    pendingClaimGroups: [],
  };

  let groupClaimRejectMode = false;

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

  function hasComputedWorkspaceSummary() {
    return Boolean(state.workspaceSummary && state.workspaceSummary.computed);
  }

  function totalTicketsSold() {
    if (hasComputedWorkspaceSummary()) {
      return Number(state.workspaceSummary.totalTicketsSold) || 0;
    }
    return state.events.reduce((sum, ev) => sum + (Number(ev.ticketsSold) || 0), 0);
  }

  function formatGbpAmount(amount) {
    const sum = Number(amount) || 0;
    return '£' + (sum % 1 === 0 ? sum.toFixed(0) : sum.toFixed(2));
  }

  function totalRevenueDisplay() {
    if (hasComputedWorkspaceSummary()) {
      return formatGbpAmount(state.workspaceSummary.totalRevenue);
    }
    const sum = state.events.reduce((s, ev) => s + (ev.revenueNum || 0), 0);
    return formatGbpAmount(sum);
  }

  function allEventOptions() {
    if (state.eventSummaries && state.eventSummaries.length) {
      return state.eventSummaries.slice();
    }
    return state.events.map((ev) => ({ id: ev.id, title: ev.title }));
  }

  function renderStats() {
    const rev = totalRevenueDisplay();
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('stat-events', String(state.eventsTotal || state.events.length));
    set('stat-tickets', String(totalTicketsSold()));
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
    }).then(async (res) => {
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        const snippet = String(text || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 120);
        throw new Error(
          res.ok
            ? 'Server returned an invalid response'
            : 'Server error (' +
                res.status +
                ')' +
                (snippet ? ': ' + snippet : '')
        );
      }
      return { ok: res.ok, status: res.status, data };
    });
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

  function eventOrganiserGroupId(ev) {
    return String(ev.organiserGroupId || (ev.organiserGroupIds && ev.organiserGroupIds[0]) || '').trim();
  }

  function eventSeriesBucketKey(ev) {
    const groupId = eventOrganiserGroupId(ev);
    const title = String(ev.title || '').trim().toLowerCase();
    const pattern = String(ev.recurrencePattern || '').trim();
    const endDate = String(ev.recurrenceEndDate || '').trim().slice(0, 10);
    if (pattern && endDate) {
      return 'rec:' + groupId + '\0' + title + '\0' + pattern + '\0' + endDate;
    }
    return 'title:' + groupId + '\0' + title;
  }

  function sortEventsByDate(events) {
    return (events || []).slice().sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      if (da !== db) return da - db;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
  }

  function pickPrimarySeriesEvent(members) {
    const sorted = sortEventsByDate(members);
    const now = Date.now();
    const upcoming = sorted.find((ev) => {
      if (!ev.date) return false;
      const d = new Date(ev.date).getTime();
      return !Number.isNaN(d) && d >= now - 86400000;
    });
    return upcoming || sorted[0];
  }

  function seriesStatusFromMembers(members) {
    const order = { live: 0, upcoming: 1, draft: 2, archived: 3, unpublished: 4, cancelled: 5 };
    let best = members[0];
    members.forEach((ev) => {
      const key = String(ev.statusKey || 'draft').toLowerCase();
      const bestKey = String(best.statusKey || 'draft').toLowerCase();
      if ((order[key] ?? 99) < (order[bestKey] ?? 99)) best = ev;
    });
    return {
      statusKey: best.statusKey || 'draft',
      statusLabel: best.statusLabel || 'Draft',
    };
  }

  function buildSeriesDisplayRow(members) {
    const sorted = sortEventsByDate(members);
    const primary = pickPrimarySeriesEvent(sorted);
    let ticketsSold = 0;
    let ticketsCapacity = 0;
    let revenueNum = 0;
    let needsRefundConfirmation = false;
    let canRequestPayout = false;
    let payoutHeld = false;

    sorted.forEach((ev) => {
      ticketsSold += Number(ev.ticketsSold) || 0;
      ticketsCapacity += Number(ev.ticketsCapacity) || 0;
      revenueNum += Number(ev.revenueNum) || 0;
      if (ev.needsRefundConfirmation) needsRefundConfirmation = true;
      if (ev.canRequestPayout) canRequestPayout = true;
      if (ev.payoutHeld) payoutHeld = true;
    });

    revenueNum = Math.round(revenueNum * 100) / 100;
    const status = seriesStatusFromMembers(sorted);

    return {
      ...primary,
      id: primary.id,
      isSeries: true,
      seriesCount: sorted.length,
      seriesEventIds: sorted.map((m) => m.id),
      seriesEvents: sorted,
      date: sorted[0].date,
      endDate: sorted[sorted.length - 1].date || primary.endDate,
      ticketsSold,
      ticketsCapacity,
      ticketsSoldLabel:
        ticketsCapacity > 0
          ? ticketsSold + ' / ' + ticketsCapacity
          : ticketsSold > 0
            ? String(ticketsSold)
            : '0',
      revenueNum,
      revenueDisplay: formatGbpAmount(revenueNum),
      needsRefundConfirmation,
      canRequestPayout,
      payoutHeld,
      statusKey: status.statusKey,
      statusLabel: status.statusLabel,
    };
  }

  function groupEventsIntoSeries(events) {
    const buckets = new Map();
    (events || []).forEach((ev) => {
      const key = eventSeriesBucketKey(ev);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(ev);
    });

    const grouped = [];
    buckets.forEach((members, key) => {
      if (members.length > 1 || key.startsWith('rec:')) {
        grouped.push(buildSeriesDisplayRow(members));
      } else {
        grouped.push(members[0]);
      }
    });

    return grouped.sort((a, b) => {
      const draftA = String(a.statusKey || '').toLowerCase() === 'draft';
      const draftB = String(b.statusKey || '').toLowerCase() === 'draft';
      if (draftA !== draftB) return draftA ? 1 : -1;
      const da = a.date ? new Date(a.date).getTime() : Number.POSITIVE_INFINITY;
      const db = b.date ? new Date(b.date).getTime() : Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
  }

  function formatEventDateCell(ev) {
    if (ev.isSeries && ev.seriesCount > 1 && ev.seriesEvents && ev.seriesEvents.length) {
      const sorted = sortEventsByDate(ev.seriesEvents);
      const firstStr = formatDateShort(sorted[0].date);
      const lastStr = formatDateShort(sorted[sorted.length - 1].date);
      if (firstStr === lastStr) {
        return firstStr + ' · ' + ev.seriesCount + ' dates';
      }
      return firstStr + ' – ' + lastStr;
    }
    return formatDateShort(ev.date);
  }

  function eventTitleCellHtml(ev) {
    const badge =
      ev.isSeries && ev.seriesCount > 1
        ? '<span class="org-series-badge">' +
          esc(String(ev.seriesCount)) +
          ' dates</span>'
        : '';
    return (
      '<button type="button" class="org-td-name-click" data-edit-event="' +
      esc(ev.id) +
      '">' +
      esc(ev.title) +
      '</button>' +
      badge
    );
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
      '<button type="button" class="org-action-item" data-manage-tickets="' +
      esc(id) +
      '"><span class="org-action-icon">🎟️</span><span class="org-action-text"><strong>Ticket types</strong><span>Edit tiers and publish</span></span></button>' +
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
      '<button type="button" class="org-action-item" data-manage-tickets="' +
      esc(id) +
      '"><span class="org-action-icon">🎟️</span><span class="org-action-text"><strong>Ticket types</strong><span>Edit tiers and publish</span></span></button>' +
      '<button type="button" class="org-action-item" data-org-goto-sub="events-revenue" data-filter-event="' +
      esc(id) +
      '"><span class="org-action-icon">£</span><span class="org-action-text"><strong>Revenue &amp; payout</strong><span>Request payout when eligible</span></span></button>' +
      cancelItem +
      '</div></div>'
    );
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
    set('tab-count-events', String(state.eventsTotal || state.events.length));
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
    allEventOptions().forEach((ev) => {
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
    const header = [
      'Name',
      'Other attendees',
      'Email',
      'Phone',
      'Event',
      'Ticket',
      'Quantity',
      'Paid',
      'Registered',
    ];
    const lines = rows.map((a) =>
      [
        a.name,
        (a.guestNames || []).join('; '),
        a.email,
        a.phone || '',
        a.eventTitle,
        a.ticketName,
        a.quantity,
        a.amountDisplay || a.paymentStatus || '',
        a.registeredAt,
      ]
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
      const guestLabel =
        a.guestNames && a.guestNames.length ? a.guestNames.join(', ') : '';
      const nameCell =
        guestLabel
          ? esc(a.name) + '<span class="org-attendee-guests">+' + esc(guestLabel) + '</span>'
          : esc(a.name);
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="org-td-name">' +
        nameCell +
        '</td><td>' +
        esc(a.email || '—') +
        '</td><td>' +
        esc(a.eventTitle) +
        '</td><td>' +
        esc(a.ticketName) +
        '</td><td>' +
        esc(String(a.quantity)) +
        '</td><td>' +
        esc(a.amountDisplay || a.paymentStatus || '—') +
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
    return groupEventsIntoSeries(list);
  }

  async function ensureAllEventsForGrouping() {
    if (eventsFiltersActive() || state.eventsFullyLoaded || state.eventsLoading) return;
    if (!state.eventsHasMore) {
      state.eventsFullyLoaded = true;
      return;
    }

    state.eventsLoading = true;
    try {
      let offset = state.events.length;
      while (offset < (state.eventsTotal || 0)) {
        const { ok, data } = await api(
          '/api/organiser/bootstrap?eventsOnly=1&eventsLimit=' +
            EVENTS_FETCH_SIZE +
            '&eventsOffset=' +
            offset
        );
        if (!ok) break;
        const chunk = data.events || [];
        if (!chunk.length) break;
        state.events = state.events.concat(chunk);
        offset += chunk.length;
        state.eventsTotal = data.eventsPagination?.total ?? state.events.length;
        state.eventsHasMore = Boolean(data.eventsPagination?.hasMore);
        if (!state.eventsHasMore) break;
      }
      state.eventsFullyLoaded = true;
    } finally {
      state.eventsLoading = false;
    }
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
      allEventOptions().forEach((ev) => {
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

  function goToEventTickets(ev) {
    if (!ev || !ev.id) return;
    const eventIds =
      ev.isSeries && ev.seriesEventIds && ev.seriesEventIds.length ? ev.seriesEventIds : [ev.id];
    const seriesEvents =
      ev.isSeries && ev.seriesEvents && ev.seriesEvents.length
        ? ev.seriesEvents
        : [
            {
              id: ev.id,
              title: ev.title,
              date: ev.date,
              imageUrl: ev.imageUrl || '',
            },
          ];
    try {
      sessionStorage.setItem(
        'hub_event_series',
        JSON.stringify({
          title: ev.title || '',
          organiserGroupId: ev.organiserGroupId || ev.groupId || '',
          eventFormat: ev.eventFormat || ev.format || '',
          eventIds: eventIds,
          imageUrl: ev.imageUrl || '',
          events: seriesEvents.map(function (item) {
            return {
              id: item.id,
              title: item.title,
              date: item.date,
              imageUrl: item.imageUrl || item.photo || '',
            };
          }),
        })
      );
    } catch {
      /* ignore */
    }
    location.href = 'event-tickets.html?ids=' + encodeURIComponent(eventIds.join(','));
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

  function eventsChunkOffsetForUiPage(uiPage) {
    return Math.floor(((uiPage - 1) * ORG_PAGE_SIZE) / EVENTS_FETCH_SIZE) * EVENTS_FETCH_SIZE;
  }

  function eventsFiltersActive() {
    return (
      filters.eventsSearch.trim() !== '' ||
      filters.eventsStatus !== 'all' ||
      filters.eventsType !== 'all'
    );
  }

  async function ensureEventsChunkForUiPage(uiPage) {
    const chunkOffset = eventsChunkOffsetForUiPage(uiPage);
    if (!eventsFiltersActive() && state.eventsChunkOffset === chunkOffset && state.events.length) {
      return;
    }
    if (eventsFiltersActive()) return;

    state.eventsLoading = true;
    try {
      const { ok, data } = await api(
        '/api/organiser/bootstrap?eventsOnly=1&eventsLimit=' +
          EVENTS_FETCH_SIZE +
          '&eventsOffset=' +
          chunkOffset
      );
      if (!ok) throw new Error(data.message || data.error || 'events_load_failed');
      state.events = data.events || [];
      state.eventsChunkOffset = chunkOffset;
      state.eventsTotal = data.eventsPagination?.total ?? state.events.length;
      state.eventsHasMore = Boolean(data.eventsPagination?.hasMore);
      if (Array.isArray(data.tickets)) {
        const byId = new Map(state.tickets.map((t) => [t.id, t]));
        data.tickets.forEach((t) => {
          if (t && t.id) byId.set(t.id, t);
        });
        state.tickets = [...byId.values()];
      }
    } finally {
      state.eventsLoading = false;
    }
  }

  function paginateEventsList(list, page) {
    if (eventsFiltersActive() || state.eventsFullyLoaded) {
      return paginateList(list, page);
    }

    const total = state.eventsTotal || list.length;
    const totalPages = Math.max(1, Math.ceil(total / ORG_PAGE_SIZE));
    const p = Math.min(Math.max(1, page), totalPages);
    const globalStart = (p - 1) * ORG_PAGE_SIZE;
    const localStart = globalStart - state.eventsChunkOffset;
    const localEnd = localStart + ORG_PAGE_SIZE;
    return {
      items: list.slice(localStart, localEnd),
      page: p,
      totalPages,
      total,
      start: total ? globalStart + 1 : 0,
      end: Math.min(globalStart + ORG_PAGE_SIZE, total),
    };
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
    const allEvents = state.events.slice();
    (state.upcomingEvents || []).forEach((ev) => {
      if (ev && ev.id && !allEvents.some((e) => e.id === ev.id)) allEvents.push(ev);
    });
    const grouped = groupEventsIntoSeries(allEvents);
    const seriesRow = grouped.find(
      (row) =>
        row.id === id ||
        (row.isSeries && row.seriesEventIds && row.seriesEventIds.includes(id))
    );
    if (seriesRow && seriesRow.isSeries) return seriesRow;
    return allEvents.find((x) => x.id === id) || null;
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

    const manageTicketsBtn = e.target.closest('[data-manage-tickets]');
    if (manageTicketsBtn && !manageTicketsBtn.disabled) {
      e.preventDefault();
      e.stopPropagation();
      closeAllActionMenus();
      const eid = manageTicketsBtn.getAttribute('data-manage-tickets');
      const ev = findEventById(eid);
      if (ev) goToEventTickets(ev);
      else if (eid) location.href = 'event-tickets.html?ids=' + encodeURIComponent(eid);
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
        'We will verify in Stripe that every paid booking for this event has been fully refunded.\n\n' +
          'Issue any outstanding refunds in your Stripe dashboard first, then continue.'
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
    showAirtableAlert(data.message || 'Refunds verified.', false);
    await refresh();
    setRoute('events-revenue');
  }

  function primaryGroupForStripeConnect() {
    const needsConnect = (state.groups || []).filter(
      (g) => state.stripeConnectEnabled && !g.stripeConnectReady
    );
    return needsConnect[0] || (state.groups || [])[0] || null;
  }

  async function startStripeConnectOnboarding(groupId) {
    const gid = groupId || primaryGroupForStripeConnect()?.id;
    if (!gid) {
      alert('No organiser profile found.');
      return;
    }
    const { ok, data } = await api('/api/organiser/stripe-connect', {
      method: 'POST',
      body: JSON.stringify({
        groupId: gid,
        returnPath: '/organiser/index.html#events-revenue',
      }),
    });
    if (!ok || !data.url) {
      alert(data.message || data.error || 'Could not start Stripe Connect setup');
      return;
    }
    window.location.href = data.url;
  }

  function renderStripeConnectBanner() {
    const banner = document.getElementById('stripe-connect-banner');
    if (!banner || !state.stripeConnectEnabled) {
      if (banner) {
        banner.hidden = true;
        banner.innerHTML = '';
      }
      return;
    }
    const pending = (state.groups || []).filter((g) => !g.stripeConnectReady);
    if (!pending.length) {
      banner.hidden = true;
      banner.innerHTML = '';
      return;
    }
    const group = pending[0];
    banner.hidden = false;
    banner.innerHTML =
      '<p><strong>Connect Stripe to sell paid tickets</strong> — ticket revenue goes to your connected account. ' +
      'The Hub keeps the 3% platform fee and booking fee; Stripe processing is deducted automatically.</p>' +
      '<button type="button" class="org-btn org-btn-primary org-btn-sm" data-stripe-connect="' +
      esc(group.id) +
      '">Connect Stripe for ' +
      esc(group.name || 'your group') +
      '</button>';
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

    if (page === 'opportunity-enquiries') {
      loadOpportunityEnquiries();
    }
  }

  window.orgDashSetRoute = setRoute;

  function updateTeamNavBadge() {
    const badge = document.getElementById('org-team-nav-badge');
    if (!badge) return;
    const pendingCount = (state.teamMembers || []).filter(
      (m) => String(m.status || '').toLowerCase() === 'pending'
    ).length;
    badge.hidden = pendingCount < 1;
    badge.textContent = pendingCount > 1 ? String(pendingCount) + ' new' : 'New';
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
    const grouped = groupEventsIntoSeries(state.events.slice());
    const now = Date.now() - 86400000;
    const upcoming = grouped.filter((ev) => {
      if (ev.isSeries && ev.seriesEvents && ev.seriesEvents.length) {
        return ev.seriesEvents.some((item) => {
          const t = item.date ? new Date(item.date).getTime() : 0;
          return !Number.isNaN(t) && t >= now;
        });
      }
      if (!ev.date) return true;
      const d = new Date(ev.date);
      return !Number.isNaN(d.getTime()) && d.getTime() >= now;
    });
    return upcoming.slice(0, 6);
  }

  function renderOverviewEvents() {
    const body = document.getElementById('dash-events-body');
    const empty = document.getElementById('dash-events-empty');
    if (!body) return;

    if (!state.eventsFullyLoaded && state.eventsHasMore) {
      if (!state.eventsLoading) {
        ensureAllEventsForGrouping()
          .then(() => renderOverviewEvents())
          .catch(() => renderOverviewEvents());
      }
      return;
    }

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
        '</td><td class="org-td-name">' +
        eventTitleCellHtml(ev) +
        '</td><td>' +
        esc(formatEventDateCell(ev)) +
        '</td><td>' +
        esc(formatTimeRange(ev.date, ev.endDate)) +
        '</td><td>' +
        esc(ev.ticketsSoldLabel || '0') +
        '</td><td class="org-revenue">' +
        esc(ev.revenueDisplay || '£0') +
        '</td><td>' +
        statusBadgeHtml(ev.statusKey || 'upcoming', ev.statusLabel || 'Upcoming') +
        '</td><td class="org-td-actions">' +
        eventActionMenuHtmlWithItem(ev) +
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

    if (!eventsFiltersActive() && !state.eventsFullyLoaded && state.eventsHasMore) {
      if (!state.eventsLoading) {
        ensureAllEventsForGrouping()
          .then(() => renderEvents())
          .catch((err) => showAirtableAlert(err.message || 'Could not load events', true));
      }
      body.innerHTML =
        '<tr><td colspan="8" class="org-table-loading">Loading events…</td></tr>';
      if (empty) empty.hidden = true;
      return;
    }

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
    const pageInfo = paginateEventsList(list, listPages.events);
    listPages.events = pageInfo.page;
    updatePaginationNav('events', pageInfo);

    pageInfo.items.forEach((ev) => {
      const tr = document.createElement('tr');
      const revClass =
        ev.revenueNum > 0 ? 'org-revenue' : 'org-revenue muted';
      tr.innerHTML =
        '<td>' +
        thumbHtml(ev) +
        '</td><td class="org-td-name">' +
        eventTitleCellHtml(ev) +
        '</td><td>' +
        esc(formatEventDateCell(ev)) +
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
      const statusLower = String(t.status || '').toLowerCase();
      const statusKey = /sold/i.test(statusLower) ? 'cancelled' : 'live';
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
        esc(String(t.ticketsSold != null ? t.ticketsSold : 0)) +
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
      '<p><strong>Your payout is on hold</strong> — issue refunds in Stripe for all paid bookings, then click <em>Confirm refunds issued</em>. We verify each refund in Stripe before clearing the hold. Events: ' +
      names +
      '.</p>';
  }

  function renderRevenue() {
    const body = document.getElementById('revenue-body');
    if (!body) return;

    if (!eventsFiltersActive() && !state.eventsFullyLoaded && state.eventsHasMore) {
      if (!state.eventsLoading) {
        ensureAllEventsForGrouping()
          .then(() => renderRevenue())
          .catch((err) => showAirtableAlert(err.message || 'Could not load events', true));
      }
      body.innerHTML =
        '<tr><td colspan="8" class="org-table-loading">Loading revenue…</td></tr>';
      return;
    }

    const list = eventsFiltersActive()
      ? filteredEventsList()
      : groupEventsIntoSeries(state.events.slice());
    body.innerHTML = '';
    renderPayoutHeldBanner();
    renderStripeConnectBanner();

    const setRev = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setRev('rev-stat-events', String(state.eventsTotal || state.events.length));
    setRev('rev-stat-tickets', String(totalTicketsSold()));
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
        '</td><td class="org-td-name">' +
        eventTitleCellHtml(ev) +
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
    const editorNote = document.getElementById('team-editor-note');
    if (editorNote) {
      editorNote.hidden = state.canManageTeam || state.organiserRole === 'owner';
    }
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
      updateTeamNavBadge();
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
    updateTeamNavBadge();
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

  function enquiryStatusLabel(status) {
    const s = String(status || 'new').toLowerCase();
    if (s === 'responded') return 'Responded';
    if (s === 'read') return 'Read';
    return 'New';
  }

  function enquiryReplyMailto(enquiry) {
    const subject = 'Re: ' + (enquiry.opportunityTitle || 'your enquiry');
    const body =
      'Hi ' +
      (enquiry.enquirerName || 'there') +
      ',\n\nThank you for your enquiry about "' +
      (enquiry.opportunityTitle || 'our opportunity') +
      '".\n\n';
    return (
      'mailto:' +
      encodeURIComponent(enquiry.enquirerEmail || '') +
      '?subject=' +
      encodeURIComponent(subject) +
      '&body=' +
      encodeURIComponent(body)
    );
  }

  function groupInitial(name) {
    const n = String(name || 'G').trim();
    return n ? n.charAt(0).toUpperCase() : 'G';
  }

  function syncPendingClaimFlag() {
    window.hubPendingGroupClaims = (state.pendingClaimGroups || []).length > 0;
  }

  function updateGettingStartedVisibility() {
    const panel = document.getElementById('org-getting-started');
    if (!panel) return;
    if ((state.pendingClaimGroups || []).length > 0) {
      panel.hidden = true;
      return;
    }
    if (state.groups.length > 0) {
      const firstStep = panel.querySelector('.org-getting-started-list li');
      if (firstStep) {
        firstStep.classList.add('is-done');
        const btn = firstStep.querySelector('[data-org-getting-action="group"]');
        if (btn) btn.hidden = true;
      }
    }
  }

  function shouldDeferGroupClaimModal() {
    return Boolean(
      window.HubOrganiserOnboarding &&
        window.HubOrganiserOnboarding.shouldDeferGroupClaim &&
        window.HubOrganiserOnboarding.shouldDeferGroupClaim()
    );
  }

  function hideGroupClaimModal() {
    const modal = document.getElementById('org-group-claim');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('org-group-claim-active');
    groupClaimRejectMode = false;
  }

  function hideReadyForEventModal() {
    const modal = document.getElementById('org-ready-event');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('org-group-claim-active');
  }

  function hasListedEvents() {
    return Boolean(state.events.length || state.eventsTotal);
  }

  function continueOnboardingAfterClaim() {
    if (state.adminView) return;
    if ((state.pendingClaimGroups || []).length > 0) return;
    const onboarding = window.HubOrganiserOnboarding;
    if (!onboarding) return;

    if (
      state.groups.length > 0 &&
      !onboarding.isProfileReviewDone() &&
      !hasListedEvents()
    ) {
      const group = state.groups[0];
      if (group && group.id) {
        window.location.href =
          'group-edit.html?id=' + encodeURIComponent(group.id) + '&onboard=review';
        return;
      }
    }

    showReadyForEventPrompt();
  }

  function afterTourOnboardingStep() {
    if (state.adminView) return;
    if ((state.pendingClaimGroups || []).length > 0) {
      renderGroupClaimModal();
      return;
    }
    continueOnboardingAfterClaim();
  }

  function showReadyForEventPrompt() {
    const modal = document.getElementById('org-ready-event');
    if (!modal || state.adminView) return;
    if (!state.groups.length || hasListedEvents()) {
      hideReadyForEventModal();
      return;
    }
    const onboarding = window.HubOrganiserOnboarding;
    if (!onboarding || !onboarding.isProfileReviewDone()) return;
    if (onboarding.isReadyEventDismissed && onboarding.isReadyEventDismissed()) return;

    hideGroupClaimModal();
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('org-group-claim-active');
  }

  function renderGroupClaimModal() {
    const modal = document.getElementById('org-group-claim');
    const list = state.pendingClaimGroups || [];
    syncPendingClaimFlag();
    updateGettingStartedVisibility();

    if (!modal || !list.length || state.adminView || shouldDeferGroupClaimModal()) {
      if (modal) hideGroupClaimModal();
      return;
    }

    const group = list[0];
    const kicker = document.getElementById('org-group-claim-kicker');
    const nameEl = document.getElementById('org-group-claim-name');
    const emailEl = document.getElementById('org-group-claim-email');
    const descEl = document.getElementById('org-group-claim-desc');
    const avatarEl = document.getElementById('org-group-claim-avatar');
    const notesWrap = document.getElementById('org-group-claim-notes-wrap');
    const errEl = document.getElementById('org-group-claim-error');
    const acceptBtn = document.getElementById('org-group-claim-accept');
    const rejectBtn = document.getElementById('org-group-claim-reject');

    if (kicker) {
      kicker.textContent =
        list.length > 1
          ? 'Step 2 — profile 1 of ' + list.length
          : 'Step 2 — confirm your group';
    }
    if (nameEl) nameEl.textContent = group.name || 'Group profile';
    if (emailEl) {
      emailEl.textContent = group.contactEmail || group.ownerEmail || state.user?.email || '';
    }
    if (descEl) {
      const desc = String(group.description || '').trim();
      descEl.textContent = desc || 'No description yet — you can complete this after claiming the profile.';
      descEl.hidden = false;
    }
    if (avatarEl) {
      if (group.imageUrl) {
        avatarEl.innerHTML =
          '<img src="' + esc(group.imageUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">';
      } else {
        avatarEl.textContent = groupInitial(group.name);
      }
    }
    if (notesWrap) notesWrap.hidden = !groupClaimRejectMode;
    if (errEl) errEl.hidden = true;
    if (acceptBtn) {
      acceptBtn.disabled = false;
      acceptBtn.textContent = groupClaimRejectMode ? 'Back' : 'Yes, this is my group';
    }
    if (rejectBtn) {
      rejectBtn.disabled = false;
      rejectBtn.textContent = groupClaimRejectMode ? 'Confirm — not my group' : 'No, this isn\'t mine';
      rejectBtn.classList.toggle('org-btn-danger', groupClaimRejectMode);
      rejectBtn.classList.toggle('org-btn-outline', !groupClaimRejectMode);
    }

    hideReadyForEventModal();
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('org-group-claim-active');
  }

  async function submitGroupClaimAction(action) {
    const list = state.pendingClaimGroups || [];
    const group = list[0];
    const errEl = document.getElementById('org-group-claim-error');
    const acceptBtn = document.getElementById('org-group-claim-accept');
    const rejectBtn = document.getElementById('org-group-claim-reject');
    const notesEl = document.getElementById('org-group-claim-notes');
    if (!group) return;

    if (errEl) errEl.hidden = true;
    if (acceptBtn) acceptBtn.disabled = true;
    if (rejectBtn) rejectBtn.disabled = true;

    try {
      const body = { groupId: group.id, action: action };
      if (action === 'reject' && notesEl && notesEl.value.trim()) {
        body.notes = notesEl.value.trim();
      }
      const { ok, data } = await api('/api/organiser/group-claims', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!ok) throw new Error(data.message || data.error || 'claim_action_failed');

      state.pendingClaimGroups = list.filter((g) => g.id !== group.id);
      groupClaimRejectMode = false;
      if (notesEl) notesEl.value = '';

      if (action === 'claim') {
        state.groups = [data.group].concat(state.groups.filter((g) => g.id !== data.group.id));
      }

      if (state.pendingClaimGroups.length) {
        renderGroupClaimModal();
        return;
      }

      if (action === 'claim' && data.group && data.group.id) {
        window.location.href =
          'group-edit.html?id=' + encodeURIComponent(data.group.id) + '&onboard=review';
        return;
      }

      await loadBootstrap();
      if (action === 'reject') {
        showAirtableAlert(data.message || 'Profile removed from your dashboard. The Hub team has been notified.', false);
      }
    } catch (e) {
      if (errEl) {
        errEl.textContent = e.message || 'Something went wrong. Please try again.';
        errEl.hidden = false;
      }
      if (acceptBtn) acceptBtn.disabled = false;
      if (rejectBtn) rejectBtn.disabled = false;
    }
  }

  function bindReadyEventUi() {
    const laterBtn = document.getElementById('org-ready-event-later');
    const goBtn = document.getElementById('org-ready-event-go');
    if (laterBtn) {
      laterBtn.addEventListener('click', function () {
        hideReadyForEventModal();
        if (window.HubOrganiserOnboarding && window.HubOrganiserOnboarding.markReadyEventDismissed) {
          window.HubOrganiserOnboarding.markReadyEventDismissed();
        }
        updateGettingStartedVisibility();
      });
    }
    if (goBtn) {
      goBtn.addEventListener('click', function () {
        hideReadyForEventModal();
        if (window.HubOrganiserOnboarding && window.HubOrganiserOnboarding.markReadyEventDismissed) {
          window.HubOrganiserOnboarding.markReadyEventDismissed();
        }
        if (window.HubFlowTour) window.HubFlowTour.markEventTourPending();
        window.location.href = 'event-format.html';
      });
    }
  }

  function bindOnboardingPipeline() {
    if (!window.HubOrganiserOnboarding || !window.HubOrganiserOnboarding.setAfterTourStep) return;
    window.HubOrganiserOnboarding.setAfterTourStep(afterTourOnboardingStep);
  }

  function bindGroupClaimUi() {
    const acceptBtn = document.getElementById('org-group-claim-accept');
    const rejectBtn = document.getElementById('org-group-claim-reject');
    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        if (groupClaimRejectMode) {
          groupClaimRejectMode = false;
          renderGroupClaimModal();
          return;
        }
        submitGroupClaimAction('claim');
      });
    }
    if (rejectBtn) {
      rejectBtn.addEventListener('click', function () {
        if (!groupClaimRejectMode) {
          groupClaimRejectMode = true;
          renderGroupClaimModal();
          return;
        }
        submitGroupClaimAction('reject');
      });
    }
  }

  function opportunityEnquiryNewCount(enquiries) {
    return (enquiries || []).filter((e) => String(e.status || '').toLowerCase() === 'new').length;
  }

  function updateOpportunityEnquiryUi() {
    const newCount = Number(state.opportunityEnquiriesNewCount) || 0;
    const alert = document.getElementById('org-opp-enquiry-alert');
    const navBadge = document.getElementById('org-opp-enquiry-nav-badge');
    const quickCard = document.getElementById('org-quick-opp-enquiries');
    const quickHint = document.getElementById('org-quick-opp-enquiries-hint');

    if (alert) alert.hidden = newCount < 1;
    if (navBadge) {
      navBadge.hidden = newCount < 1;
      navBadge.textContent = newCount > 1 ? String(newCount) + ' new' : 'New';
    }
    if (quickCard) quickCard.hidden = !state.opportunityEnquiries.length;
    if (quickHint) {
      quickHint.textContent =
        newCount > 0
          ? newCount + ' new enquir' + (newCount === 1 ? 'y' : 'ies') + ' waiting for a reply'
          : 'Messages about your business opportunity listings';
    }
  }

  function renderOpportunityEnquiries() {
    const body = document.getElementById('opp-enquiries-body');
    const empty = document.getElementById('opp-enquiries-empty');
    if (!body) return;

    const list = state.opportunityEnquiries || [];
    body.innerHTML = '';
    if (!list.length) {
      if (empty) empty.hidden = false;
      updateOpportunityEnquiryUi();
      return;
    }
    if (empty) empty.hidden = true;

    list.forEach((enquiry) => {
      const tr = document.createElement('tr');
      const status = String(enquiry.status || 'new').toLowerCase();
      const statusKey =
        status === 'responded' ? 'live' : status === 'read' ? 'archived' : 'upcoming';
      tr.innerHTML =
        '<td>' +
        esc(formatDate(enquiry.createdAt)) +
        '</td><td class="org-td-name">' +
        esc(enquiry.opportunityTitle || 'Listing') +
        '</td><td>' +
        esc(enquiry.enquirerName || '—') +
        '<br><span class="org-payout-muted">' +
        esc(enquiry.enquirerEmail || '') +
        '</span></td><td class="org-enquiry-message">' +
        esc(enquiry.message || '') +
        '</td><td>' +
        statusBadgeHtml(statusKey, enquiryStatusLabel(status)) +
        '</td><td class="org-td-actions">' +
        '<a class="org-btn org-btn-gold org-btn-sm" data-opp-enquiry-reply="' +
        esc(enquiry.id) +
        '" href="' +
        esc(enquiryReplyMailto(enquiry)) +
        '">Respond here</a>' +
        '</td>';
      body.appendChild(tr);
    });
    updateOpportunityEnquiryUi();
  }

  async function loadOpportunityEnquiries() {
    const hint = document.getElementById('opp-enquiries-load-hint');
    if (hint) hint.hidden = false;
    try {
      const { ok, data } = await api('/api/organiser/opportunity-enquiries');
      if (!ok) throw new Error(data.message || data.error || 'load_failed');
      state.opportunityEnquiries = data.enquiries || [];
      state.opportunityEnquiriesNewCount = opportunityEnquiryNewCount(state.opportunityEnquiries);
    } catch (e) {
      state.opportunityEnquiries = [];
      state.opportunityEnquiriesNewCount = 0;
    } finally {
      if (hint) hint.hidden = true;
      renderOpportunityEnquiries();
    }
  }

  async function markOpportunityEnquiryResponded(enquiryId) {
    const { ok, data } = await api('/api/organiser/opportunity-enquiries', {
      method: 'PATCH',
      body: JSON.stringify({ id: enquiryId, status: 'responded' }),
    });
    if (!ok) return;
    const enquiry = data.enquiry;
    if (!enquiry) return;
    const idx = state.opportunityEnquiries.findIndex((e) => e.id === enquiry.id);
    if (idx >= 0) state.opportunityEnquiries[idx] = enquiry;
    state.opportunityEnquiriesNewCount = opportunityEnquiryNewCount(state.opportunityEnquiries);
    renderOpportunityEnquiries();
  }

  function renderAll() {
    renderStats();
    renderOverviewGroups();
    renderOverviewEvents();
    renderGroups();
    renderTeam();
    renderMyEventsHub();
    fillEventSelect(document.getElementById('ticket-event'));
    updateOpportunityEnquiryUi();
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
    state.pendingClaimGroups = data.pendingClaimGroups || [];
    state.events = data.events || [];
    state.upcomingEvents = data.upcomingEvents || [];
    state.eventsTotal = data.eventsPagination?.total ?? state.events.length;
    state.eventsChunkOffset = data.eventsPagination?.offset ?? 0;
    state.eventsHasMore = Boolean(data.eventsPagination?.hasMore);
    state.eventsFullyLoaded = !state.eventsHasMore;
    state.tickets = data.tickets || [];
    listPages.groups = 1;
    listPages.events = 1;
    listPages.tickets = 1;
    listPages.reviews = 1;
    listPages.revenue = 1;
    listPages.attendees = 1;
    state.reviews = data.reviews || [];
    state.workspaceSummary =
      data.workspaceSummary && data.workspaceSummary.computed ? data.workspaceSummary : null;
    state.eventSummaries = data.eventSummaries || [];
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
    state.stripeConnectEnabled = Boolean(data.stripeConnectEnabled);
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
    } else if (!state.groups.length && !state.pendingClaimGroups.length) {
      showAirtableAlert(
        'Create your first <strong>group profile</strong> (Group profiles in the sidebar), then add events and ticket types.',
        false
      );
    } else if (!data.adminView) {
      showAirtableAlert(null);
    }

    applyPendingGroupSave();
    renderAll();
    renderGroupClaimModal();
    loadOpportunityEnquiries();
    updateTeamNavBadge();
    if (window.HubOrganiserOnboarding && window.HubOrganiserOnboarding.initAfterDashboardReady) {
      window.HubOrganiserOnboarding.initAfterDashboardReady();
    }
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
    const qualityHint = document.getElementById('group-logo-quality');
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    if (preview) preview.hidden = true;
    if (placeholder) placeholder.hidden = false;
    if (window.hubClearLogoQualityHint) window.hubClearLogoQualityHint(qualityHint);
  }

  function bindGroupLogoPicker() {
    const zone = document.getElementById('group-logo-zone');
    const fileInput = document.getElementById('group-logo-file');
    const preview = document.getElementById('group-logo-preview');
    const previewImg = document.getElementById('group-logo-preview-img');
    const placeholder = document.getElementById('group-logo-placeholder');
    const clearBtn = document.getElementById('group-logo-clear');
    const qualityHint = document.getElementById('group-logo-quality');
    const urlInput = document.getElementById('group-logo-url');
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
      window.hubBindImageUpload({
        zone,
        fileInput,
        onFile: setGroupLogoFile,
        qualityHintEl: qualityHint,
      });
    }
    if (window.hubBindLogoUrlQualityCheck) {
      window.hubBindLogoUrlQualityCheck(urlInput, qualityHint, function () {
        return Boolean(groupLogoFile);
      });
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
      const logoResolutionWarning = data.logoResolutionWarning || data.group?.logoResolutionWarning;
      closeModals();
      document.getElementById('form-group').reset();
      resetGroupLogoPicker();
      await refresh();
      setRoute('groups');
      if (logoWarning) alert(logoWarning);
      else if (logoResolutionWarning) alert(logoResolutionWarning);
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

        const enquiryReply = e.target.closest('[data-opp-enquiry-reply]');
        if (enquiryReply) {
          const enquiryId = enquiryReply.getAttribute('data-opp-enquiry-reply');
          if (enquiryId) markOpportunityEnquiryResponded(enquiryId);
          return;
        }

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
        const connectBtn = e.target.closest('[data-stripe-connect]');
        if (connectBtn) {
          e.preventDefault();
          startStripeConnectOnboarding(connectBtn.getAttribute('data-stripe-connect'));
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
      if (listKey === 'events') {
        if (eventsFiltersActive() || state.eventsFullyLoaded) {
          renderEvents();
        } else {
          ensureAllEventsForGrouping()
            .then(() => renderEvents())
            .catch((err) => {
              showAirtableAlert(err.message || 'Could not load events', true);
            });
        }
      } else if (listKey === 'groups') renderGroups();
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
    bindOnboardingPipeline();
    bindGroupClaimUi();
    bindReadyEventUi();
    bindUi();
    const initial = parseRoute();
    setRoute(initial.sub || initial.page);
    try {
      await loadBootstrap();
      const connectParam = new URLSearchParams(window.location.search).get('stripe_connect');
      if (connectParam && state.stripeConnectEnabled && state.groups.length) {
        const gid = state.groups[0].id;
        await api('/api/organiser/stripe-connect?groupId=' + encodeURIComponent(gid));
        await loadBootstrap();
        if (connectParam === 'refresh') {
          showAirtableAlert(
            'Stripe setup was interrupted. Click Connect Stripe to continue where you left off.',
            false
          );
        } else {
          showAirtableAlert('Stripe account updated.', false);
        }
        if (window.history.replaceState) {
          const url = new URL(window.location.href);
          url.searchParams.delete('stripe_connect');
          window.history.replaceState({}, '', url.pathname + url.hash);
        }
      }
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
