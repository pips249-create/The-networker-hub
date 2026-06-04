/**
 * Organiser dashboard — groups, events, ticket types (Airtable via /api/organiser/*).
 */
(function () {
  const ORG_PAGE_SIZE = 10;
  const listPages = { groups: 1, events: 1, tickets: 1, reviews: 1, revenue: 1 };
  let eventsSubRoute = 'events-list';

  const filters = {
    eventsStatus: 'all',
    eventsType: 'all',
    eventsSearch: '',
    ticketsEvent: 'all',
    ticketsType: 'all',
    reviewsGroup: 'all',
  };

  const state = {
    user: null,
    groups: [],
    events: [],
    upcomingEvents: [],
    tickets: [],
    reviews: [],
    groupsError: null,
    airtable: null,
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

  function renderWelcome(user) {
    const name = (user && user.name && String(user.name).trim()) || '';
    const nameEl = document.getElementById('org-welcome-name');
    const subEl = document.getElementById('org-welcome-sub');
    if (nameEl) {
      nameEl.textContent = name ? 'Welcome back, ' + name : 'Welcome back';
    }
    if (subEl) {
      const email = (user && user.email) || (state.user && state.user.email) || '';
      subEl.textContent = email
        ? "Here's your account at a glance — " + email
        : "Here's your account at a glance.";
    }
  }

  function renderStats() {
    const rev = totalRevenueDisplay();
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('stat-groups', String(state.groups.length));
    set('stat-events', String(state.events.length));
    set('stat-tickets', String(state.tickets.length));
    set('stat-revenue', rev);
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function api(path, options) {
    return fetch(path, {
      credentials: 'include',
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
    if (item.imageUrl) {
      return (
        '<img class="org-thumb" src="' +
        esc(item.imageUrl) +
        '" alt="" width="44" height="44" loading="lazy" />'
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
          : 'org-badge-purple';
    return '<span class="org-badge ' + cls + '">' + esc(label) + '</span>';
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

  function actionMenuHtml(kind, id, title) {
    if (kind === 'group') {
      return (
        '<div class="org-action-wrap">' +
        '<button type="button" class="org-action-btn" data-org-action-toggle aria-expanded="false">Actions <span class="chev">▾</span></button>' +
        '<div class="org-action-menu" role="menu">' +
        '<button type="button" class="org-action-item" data-edit-group="' +
        esc(id) +
        '"><span class="org-action-icon">✎</span><span class="org-action-text"><strong>Edit profile</strong><span>Update organiser page details</span></span></button>' +
        '<button type="button" class="org-action-item" data-org-goto-sub="events-reviews"><span class="org-action-icon">★</span><span class="org-action-text"><strong>Reviews</strong><span>View feedback for this group</span></span></button>' +
        '<button type="button" class="org-action-item danger" disabled><span class="org-action-icon">⊘</span><span class="org-action-text"><strong>Unpublish</strong><span>Coming soon</span></span></button>' +
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
      '<button type="button" class="org-action-item" data-org-goto-sub="events-tickets" data-filter-event="' +
      esc(id) +
      '"><span class="org-action-icon">👥</span><span class="org-action-text"><strong>See attendees</strong><span>View ticket types for this event</span></span></button>' +
      '<button type="button" class="org-action-item" data-org-goto-sub="events-reviews" data-filter-event="' +
      esc(id) +
      '"><span class="org-action-icon">★</span><span class="org-action-text"><strong>Reviews</strong><span>Read &amp; reply to reviews</span></span></button>' +
      '<button type="button" class="org-action-item danger" disabled><span class="org-action-icon">⊘</span><span class="org-action-text"><strong>Unpublish</strong><span>Hide from directory</span></span></button>' +
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
    return { page: hash, sub: null };
  }

  function setEventsSub(sub) {
    eventsSubRoute = sub || 'events-list';
    document.querySelectorAll('[data-events-sub]').forEach((tab) => {
      tab.classList.toggle('is-active', tab.getAttribute('data-events-sub') === eventsSubRoute);
    });
    document.querySelectorAll('[data-events-panel]').forEach((panel) => {
      panel.classList.toggle('is-active', panel.getAttribute('data-events-panel') === eventsSubRoute);
    });
    const titles = {
      'events-list': ['My Events', 'Manage all your event listings — click any event name to edit.'],
      'events-tickets': ['Tickets', 'All ticket types across your events.'],
      'events-reviews': ['Reviews', 'Read and reply to attendee feedback.'],
      'events-revenue': ['Revenue', 'Revenue and performance across your listings.'],
    };
    const t = titles[eventsSubRoute] || titles['events-list'];
    const titleEl = document.getElementById('my-events-title');
    const subEl = document.getElementById('my-events-sub');
    if (titleEl) titleEl.textContent = t[0];
    if (subEl) subEl.textContent = t[1];
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

  function filteredEventsList() {
    let list = state.events.slice();
    const q = filters.eventsSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (ev) =>
          String(ev.title || '')
            .toLowerCase()
            .includes(q) ||
          String(ev.type || '')
            .toLowerCase()
            .includes(q)
      );
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

  function openEditEventModal(ev) {
    if (ev && ev.id) {
      goToEventEditor(ev);
      return;
    }
    document.getElementById('modal-event-title').textContent = 'Edit event';
    document.getElementById('modal-event-lead').textContent =
      'Update listing details below, or open the full public page to preview changes.';
    document.getElementById('event-edit-id').value = ev.id;
    document.getElementById('event-title').value = ev.title || '';
    document.getElementById('event-type').value = ev.type || 'Networking Event';
    document.getElementById('event-description').value = ev.description || '';
    if (ev.date) {
      const d = new Date(ev.date);
      if (!Number.isNaN(d.getTime())) {
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
        document.getElementById('event-date').value = local.toISOString().slice(0, 10);
        const pad2 = (n) => String(n).padStart(2, '0');
        const startT = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
        let endT = '12:00';
        if (ev.endDate) {
          const end = new Date(ev.endDate);
          if (!Number.isNaN(end.getTime())) {
            endT = pad2(end.getHours()) + ':' + pad2(end.getMinutes());
          }
        }
        if (window.OrganiserQuarterTime) {
          window.OrganiserQuarterTime.setValues('event-start-time', 'event-end-time', startT, endT);
        }
      }
    } else {
      document.getElementById('event-date').value = '';
    }
    fillGroupSelect(document.getElementById('event-group'));
    const grp = document.getElementById('event-group');
    if (grp && ev.organiserGroupId) grp.value = ev.organiserGroupId;
    const submitBtn = document.getElementById('event-form-submit');
    const openLink = document.getElementById('event-form-open-page');
    if (submitBtn) {
      submitBtn.textContent = 'Save changes';
      submitBtn.disabled = true;
      submitBtn.title = 'Saving from the dashboard is coming soon — use Open full listing';
    }
    if (openLink) {
      openLink.href = '../events/event.html?id=' + encodeURIComponent(ev.id);
      openLink.hidden = false;
    }
    openModal('modal-event');
  }

  function resetEventModalForCreate() {
    document.getElementById('modal-event-title').textContent = 'New event';
    document.getElementById('modal-event-lead').textContent =
      'Choose which organiser group this event belongs to.';
    document.getElementById('event-edit-id').value = '';
    const submitBtn = document.getElementById('event-form-submit');
    const openLink = document.getElementById('event-form-open-page');
    if (submitBtn) {
      submitBtn.textContent = 'Create event';
      submitBtn.disabled = false;
      submitBtn.title = '';
    }
    if (openLink) openLink.hidden = true;
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
        filters.reviewsGroup = 'all';
        const ticketSel = document.getElementById('filter-tickets-event');
        if (ticketSel) ticketSel.value = eventId;
      }
      setRoute(sub || 'events-list');
      if (sub === 'events-tickets') renderTickets();
      if (sub === 'events-reviews') renderReviews();
      return true;
    }

    return false;
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
    }

    document.querySelectorAll('[data-org-route]').forEach((a) => {
      const r = a.getAttribute('data-org-route');
      a.classList.toggle('is-active', r === page);
    });
    document.querySelectorAll('[data-org-page]').forEach((p) => {
      p.classList.toggle('is-active', p.getAttribute('data-org-page') === page);
    });

    if (page === 'events') {
      setEventsSub(sub || eventsSubRoute || 'events-list');
    }

    const hash = page === 'events' ? sub || 'events-list' : page;
    if (location.hash.replace('#', '') !== hash) {
      history.replaceState(null, '', '#' + hash);
    }
  }

  function openModal(id) {
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
    resetGroupLogoPicker();
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
        actionMenuHtml('group', g.id, g.name) +
        '</td>';
      body.appendChild(tr);
    });
  }

  function renderOverviewEvents() {
    const body = document.getElementById('dash-events-body');
    const empty = document.getElementById('dash-events-empty');
    if (!body) return;
    body.innerHTML = '';
    const slice = (state.upcomingEvents.length ? state.upcomingEvents : state.events).slice(0, 6);
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
    if (!state.groups.length) {
      if (empty) empty.hidden = false;
      updatePaginationNav('groups', { totalPages: 1, start: 0, end: 0, total: 0, page: 1 });
      return;
    }
    if (empty) empty.hidden = true;
    const pageInfo = paginateList(state.groups, listPages.groups);
    listPages.groups = pageInfo.page;
    updatePaginationNav('groups', pageInfo);
    pageInfo.items.forEach((g) => {
      const tr = document.createElement('tr');
      const site = g.website
        ? '<a href="' +
          esc(g.website) +
          '" target="_blank" rel="noopener noreferrer">' +
          esc(g.website.replace(/^https?:\/\//i, '').slice(0, 40)) +
          '</a>'
        : '—';
      tr.innerHTML =
        '<td>' +
        thumbHtml(g) +
        '</td><td class="org-td-name"><button type="button" class="org-td-name-click" data-edit-group="' +
        esc(g.id) +
        '">' +
        esc(g.name) +
        '</button></td><td>' +
        esc(g.location || '—') +
        '</td><td>' +
        site +
        '</td><td>' +
        esc(g.description || '—') +
        '</td><td class="org-td-actions">' +
        actionMenuHtml('group', g.id, g.name) +
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
        eventActionMenuHtml(ev.id, ev.title) +
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

  function renderRevenue() {
    const body = document.getElementById('revenue-body');
    if (!body) return;
    const list = state.events.slice();
    body.innerHTML = '';

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
      tr.innerHTML =
        '<td>' +
        thumbHtml(ev) +
        '</td><td class="org-td-name"><button type="button" class="org-td-name-click" data-edit-event="' +
        esc(ev.id) +
        '">' +
        esc(ev.title) +
        '</button></td><td>' +
        esc(ev.ticketsSoldLabel || '0') +
        '</td><td class="org-revenue">' +
        esc(ev.revenueDisplay || '£0') +
        '</td><td>' +
        ratingHtml(ev.rating) +
        '</td><td>' +
        statusBadgeHtml(ev.statusKey || 'draft', ev.statusLabel || 'Draft') +
        '</td>';
      body.appendChild(tr);
    });
  }

  function renderMyEventsHub() {
    updateMyEventsTabCounts();
    fillMyEventsFilters();
    renderEvents();
    renderTickets();
    renderReviews();
    renderRevenue();
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
    renderMyEventsHub();
    fillGroupSelect(document.getElementById('event-group'));
    fillEventSelect(document.getElementById('ticket-event'));
  }

  async function loadBootstrap() {
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
    state.reviews = data.reviews || [];
    state.groupsError = data.groupsError;
    state.airtable = data.airtable;
    state.adminView = data.adminView;
    state.personalScope = data.personalScope;
    state.isAdmin = data.isAdmin;
    if (data.user) {
      state.user = { ...state.user, ...data.user };
      renderWelcome(state.user);
    }

    if (data.adminView) {
      showAirtableAlert(
        '<strong>Admin view</strong> — showing all organiser profiles, events, and ticket types across the platform.' +
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
    } else if (data.groupsError && state.airtable && state.airtable.groups) {
      const g = state.airtable.groups;
      showAirtableAlert(
        '<strong>Set up Airtable table <code>' +
          esc(g.table) +
          '</code></strong> with fields: ' +
          g.requiredFields.map((f) => '<code>' + esc(f) + '</code>').join(', ') +
          '. Then redeploy. Error: ' +
          esc(data.groupsError),
        true
      );
    } else if (!state.groups.length) {
      showAirtableAlert(
        'Create your first <strong>organiser profile</strong> in Airtable (linked to your Users record). Then add events and ticket types.',
        false
      );
    } else if (!data.adminView) {
      showAirtableAlert(null);
    }

    renderAll();
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

    zone.addEventListener('click', () => fileInput.click());
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert('Logo must be under 2MB.');
        fileInput.value = '';
        return;
      }
      groupLogoFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        if (previewImg) previewImg.src = reader.result;
        if (preview) preview.hidden = false;
        if (placeholder) placeholder.hidden = true;
      };
      reader.readAsDataURL(file);
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
      const location = document.getElementById('group-location').value.trim();
      const logoUrl = document.getElementById('group-logo-url').value.trim();
      const payload = { name, description, website, location, logoUrl };

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
      closeModals();
      document.getElementById('form-group').reset();
      resetGroupLogoPicker();
      await refresh();
      setRoute('groups');
    });

    document.getElementById('form-event').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (document.getElementById('event-edit-id').value) {
        alert('In-dashboard save is coming soon. Use “Open full listing” to view your event page.');
        return;
      }
      const organiserGroupId = document.getElementById('event-group').value;
      const title = document.getElementById('event-title').value.trim();
      const dateInput = document.getElementById('event-date').value;
      const type = document.getElementById('event-type').value;
      const description = document.getElementById('event-description').value.trim();
      const QT = window.OrganiserQuarterTime;
      const timeCheck = QT ? QT.validatePair('event-start-time', 'event-end-time') : { ok: true };
      if (!dateInput) {
        alert('Choose an event date.');
        return;
      }
      if (!timeCheck.ok) {
        alert(timeCheck.message);
        return;
      }
      function combineDateAndTime(dateStr, timeStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const rounded = QT ? QT.roundToQuarterHour(timeStr) : timeStr;
        const [hh, mm] = rounded.split(':').map(Number);
        return new Date(y, m - 1, d, hh || 0, mm || 0, 0).toISOString();
      }
      const occurrences = [
        {
          date: combineDateAndTime(dateInput, timeCheck.start),
          endDate: combineDateAndTime(dateInput, timeCheck.end),
        },
      ];
      const btn = e.submitter;
      if (btn) btn.disabled = true;
      const { ok, data } = await api('/api/organiser/events', {
        method: 'POST',
        body: JSON.stringify({
          organiserGroupId,
          title,
          type,
          description,
          occurrences,
        }),
      });
      if (btn) btn.disabled = false;
      if (!ok) {
        alert(data.message || data.error || 'Could not create event');
        return;
      }
      closeModals();
      document.getElementById('form-event').reset();
      resetEventModalForCreate();
      await refresh();
      setRoute('events-list');
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
    if (window.OrganiserQuarterTime) {
      window.OrganiserQuarterTime.initPair('event-start-time', 'event-end-time', {
        start: '10:00',
        end: '12:00',
      });
    }

    document.querySelectorAll('[data-org-modal-close]').forEach((el) => {
      el.addEventListener('click', closeModals);
    });

    function goToNewGroupEditor() {
      location.href = 'group-edit.html';
    }

    function goToNewEventEditor() {
      if (!state.groups.length) {
        alert('Create an organiser profile first.');
        location.href = 'group-edit.html';
        return;
      }
      location.href = 'event-edit.html';
    }

    document.getElementById('btn-new-group').addEventListener('click', goToNewGroupEditor);
    document.querySelectorAll('[data-action="new-group"]').forEach((el) => {
      el.addEventListener('click', goToNewGroupEditor);
    });
    document.getElementById('btn-new-event').addEventListener('click', goToNewEventEditor);
    document.querySelectorAll('[data-action="new-event"]').forEach((el) => {
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
        setRoute(btn.getAttribute('data-org-goto-view') || 'dashboard');
      });
    });

    document.querySelectorAll('[data-events-sub]').forEach((tab) => {
      tab.addEventListener('click', () => {
        setRoute(tab.getAttribute('data-events-sub') || 'events-list');
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

    document.querySelectorAll('[data-org-route]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const page = a.getAttribute('data-org-route') || 'dashboard';
        if (page === 'events') setRoute('events-list');
        else setRoute(page);
      });
    });

    window.addEventListener('hashchange', () => {
      const r = parseRoute();
      setRoute(r.sub || r.page);
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
      if (listKey === 'revenue') renderRevenue();
      nav.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModals();
    });
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
    renderWelcome(user);
    if (signin) signin.hidden = true;
    shell.hidden = false;
    bindForms();
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
