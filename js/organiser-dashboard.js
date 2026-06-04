/**
 * Organiser dashboard — groups, events, ticket types (Airtable via /api/organiser/*).
 */
(function () {
  const state = {
    user: null,
    groups: [],
    events: [],
    upcomingEvents: [],
    tickets: [],
    groupsError: null,
    airtable: null,
  };

  const signin = document.getElementById('org-signin');
  const shell = document.getElementById('org-shell');
  const alertEl = document.getElementById('org-airtable-alert');

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
    const safeId = esc(id);
    const eventUrl = '../events/event.html?id=' + encodeURIComponent(id);
    if (kind === 'group') {
      return (
        '<div class="org-action-wrap">' +
        '<button type="button" class="org-action-btn" data-org-action-toggle aria-expanded="false">Actions <span class="chev">▾</span></button>' +
        '<div class="org-action-menu" role="menu">' +
        '<button type="button" class="org-action-item" data-org-goto-view="groups"><span class="org-action-icon">✎</span><span class="org-action-text"><strong>Edit profile</strong><span>Update organiser page details</span></span></button>' +
        '<button type="button" class="org-action-item" data-org-goto-view="events"><span class="org-action-icon">★</span><span class="org-action-text"><strong>Reviews</strong><span>View feedback for this group</span></span></button>' +
        '<button type="button" class="org-action-item danger" disabled><span class="org-action-icon">⊘</span><span class="org-action-text"><strong>Unpublish</strong><span>Coming soon</span></span></button>' +
        '</div></div>'
      );
    }
    return (
      '<div class="org-action-wrap">' +
      '<button type="button" class="org-action-btn" data-org-action-toggle aria-expanded="false">Actions <span class="chev">▾</span></button>' +
      '<div class="org-action-menu" role="menu">' +
      '<a class="org-action-item" href="' +
      eventUrl +
      '" target="_blank" rel="noopener"><span class="org-action-icon">✎</span><span class="org-action-text"><strong>Edit event</strong><span>Update details, times &amp; tickets</span></span></a>' +
      '<button type="button" class="org-action-item" data-org-goto-view="tickets"><span class="org-action-icon">👥</span><span class="org-action-text"><strong>See attendees</strong><span>View ticket types for this event</span></span></button>' +
      '<button type="button" class="org-action-item" disabled><span class="org-action-icon">◎</span><span class="org-action-text"><strong>Promote</strong><span>Coming soon</span></span></button>' +
      '<button type="button" class="org-action-item danger" disabled><span class="org-action-icon">⊘</span><span class="org-action-text"><strong>Unpublish</strong><span>Hide from directory</span></span></button>' +
      '</div></div>'
    );
  }

  function closeAllActionMenus() {
    document.querySelectorAll('.org-action-menu.is-open').forEach((m) => m.classList.remove('is-open'));
    document.querySelectorAll('[data-org-action-toggle][aria-expanded="true"]').forEach((b) => {
      b.setAttribute('aria-expanded', 'false');
    });
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
    const r = route || 'dashboard';
    document.querySelectorAll('[data-org-route]').forEach((a) => {
      a.classList.toggle('is-active', a.getAttribute('data-org-route') === r);
    });
    document.querySelectorAll('[data-org-page]').forEach((p) => {
      p.classList.toggle('is-active', p.getAttribute('data-org-page') === r);
    });
    if (location.hash.replace('#', '') !== r) {
      history.replaceState(null, '', '#' + r);
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
        '</td><td class="org-td-name"><strong>' +
        esc(g.name) +
        '</strong></td><td>' +
        esc(String(g.eventsListed != null ? g.eventsListed : 0)) +
        '</td><td class="org-revenue">' +
        esc(g.revenueDisplay || '£0') +
        '</td><td>' +
        ratingHtml(g.rating) +
        '</td><td>' +
        statusBadgeHtml(g.statusKey || 'draft', g.statusLabel || 'Draft') +
        '</td><td>' +
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
      const eventUrl = '../events/event.html?id=' + encodeURIComponent(ev.id);
      tr.innerHTML =
        '<td>' +
        thumbHtml(ev) +
        '</td><td class="org-td-name"><a href="' +
        eventUrl +
        '">' +
        esc(ev.title) +
        '</a></td><td>' +
        esc(formatDateShort(ev.date)) +
        '</td><td>' +
        esc(formatTimeRange(ev.date, ev.endDate)) +
        '</td><td>' +
        esc(ev.ticketsSoldLabel || '0') +
        '</td><td class="org-revenue">' +
        esc(ev.revenueDisplay || '£0') +
        '</td><td>' +
        statusBadgeHtml(ev.statusKey || 'upcoming', ev.statusLabel || 'Upcoming') +
        '</td><td>' +
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
      return;
    }
    if (empty) empty.hidden = true;
    state.groups.forEach((g) => {
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
        '</td><td><strong>' +
        esc(g.name) +
        '</strong></td><td>' +
        esc(g.location || '—') +
        '</td><td>' +
        site +
        '</td><td>' +
        esc(g.description || '—') +
        '</td>';
      body.appendChild(tr);
    });
  }

  function renderEvents() {
    const body = document.getElementById('events-body');
    const empty = document.getElementById('events-empty');
    if (!body) return;

    function fillRow(ev) {
      const tr = document.createElement('tr');
      const preview =
        '<a class="org-btn org-btn-outline" style="font-size:11px;padding:4px 10px" href="../events/event.html?id=' +
        encodeURIComponent(ev.id) +
        '" target="_blank" rel="noopener">View</a>';
      tr.innerHTML =
        '<td><strong>' +
        esc(ev.title) +
        '</strong></td><td>' +
        esc(formatDate(ev.date)) +
        '</td><td>' +
        esc(ev.type || '—') +
        '</td><td>' +
        esc(groupNameById(ev.organiserGroupId)) +
        '</td><td>' +
        preview +
        '</td>';
      return tr;
    }

    body.innerHTML = '';
    if (!state.events.length) {
      if (empty) empty.hidden = false;
    } else {
      if (empty) empty.hidden = true;
      state.events.forEach((ev) => body.appendChild(fillRow(ev)));
    }
  }

  function renderTickets() {
    const body = document.getElementById('tickets-body');
    const empty = document.getElementById('tickets-empty');
    if (!body) return;
    body.innerHTML = '';
    if (!state.tickets.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    state.tickets.forEach((t) => {
      const ev = state.events.find((e) => e.id === t.eventId);
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td><strong>' +
        esc(t.name) +
        '</strong></td><td>' +
        esc(ev ? ev.title : t.eventId) +
        '</td><td>' +
        (t.price === '' || t.price === '0' ? 'Free' : '£' + esc(t.price)) +
        '</td><td><span class="org-badge org-badge-green">' +
        esc(t.status || 'Available') +
        '</span></td>';
      body.appendChild(tr);
    });
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

  function renderAll() {
    renderOverviewGroups();
    renderOverviewEvents();
    renderGroups();
    renderEvents();
    renderTickets();
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
    state.groupsError = data.groupsError;
    state.airtable = data.airtable;
    state.adminView = data.adminView;

    if (data.adminView) {
      showAirtableAlert(
        '<strong>Admin view</strong> — showing all organiser profiles, events, and ticket types across the platform.',
        false
      );
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
      const organiserGroupId = document.getElementById('event-group').value;
      const title = document.getElementById('event-title').value.trim();
      const dateInput = document.getElementById('event-date').value;
      const type = document.getElementById('event-type').value;
      const description = document.getElementById('event-description').value.trim();
      let date = '';
      if (dateInput) {
        date = new Date(dateInput).toISOString();
      }
      const btn = e.submitter;
      if (btn) btn.disabled = true;
      const { ok, data } = await api('/api/organiser/events', {
        method: 'POST',
        body: JSON.stringify({
          organiserGroupId,
          title,
          date,
          type,
          description,
        }),
      });
      if (btn) btn.disabled = false;
      if (!ok) {
        alert(data.message || data.error || 'Could not create event');
        return;
      }
      closeModals();
      document.getElementById('form-event').reset();
      await refresh();
      setRoute('events');
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
      setRoute('tickets');
    });
  }

  function bindUi() {
    document.querySelectorAll('[data-org-modal-close]').forEach((el) => {
      el.addEventListener('click', closeModals);
    });

    document.getElementById('btn-new-group').addEventListener('click', () => {
      document.getElementById('modal-group-email').textContent = state.user.email;
      resetGroupLogoPicker();
      openModal('modal-group');
    });

    document.getElementById('btn-new-event').addEventListener('click', () => {
      if (!state.groups.length) {
        alert('Create an organiser profile first.');
        setRoute('groups');
        return;
      }
      fillGroupSelect(document.getElementById('event-group'));
      openModal('modal-event');
    });

    document.getElementById('btn-new-ticket').addEventListener('click', () => {
      if (!state.events.length) {
        alert('Create an event first.');
        setRoute('events');
        return;
      }
      fillEventSelect(document.getElementById('ticket-event'));
      openModal('modal-ticket');
    });

    document.querySelectorAll('[data-org-goto]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-org-goto');
        setRoute(route);
        if (route === 'groups') document.getElementById('btn-new-group').click();
        if (route === 'events') document.getElementById('btn-new-event').click();
        if (route === 'tickets') document.getElementById('btn-new-ticket').click();
      });
    });

    document.querySelectorAll('[data-org-goto-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setRoute(btn.getAttribute('data-org-goto-view') || 'dashboard');
      });
    });

    document.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-org-action-toggle]');
      if (toggle) {
        e.stopPropagation();
        const wrap = toggle.closest('.org-action-wrap');
        const menu = wrap && wrap.querySelector('.org-action-menu');
        const wasOpen = menu && menu.classList.contains('is-open');
        closeAllActionMenus();
        if (menu && !wasOpen) {
          menu.classList.add('is-open');
          toggle.setAttribute('aria-expanded', 'true');
        }
        return;
      }
      if (!e.target.closest('.org-action-wrap')) closeAllActionMenus();
    });

    document.querySelectorAll('[data-org-route]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        setRoute(a.getAttribute('data-org-route') || 'dashboard');
      });
    });

    window.addEventListener('hashchange', () => {
      setRoute(location.hash.replace('#', '') || 'dashboard');
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
    document.getElementById('org-welcome-name').textContent =
      'Welcome' + (user.name ? ', ' + user.name : '');
    document.getElementById('org-welcome-email').textContent = user.email;
    if (signin) signin.hidden = true;
    shell.hidden = false;
    bindForms();
    bindUi();
    setRoute(location.hash.replace('#', '') || 'dashboard');
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
