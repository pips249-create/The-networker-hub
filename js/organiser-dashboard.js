/**
 * Organiser dashboard — groups, events, ticket types (Airtable via /api/organiser/*).
 */
(function () {
  const state = {
    user: null,
    groups: [],
    events: [],
    tickets: [],
    groupsError: null,
    airtable: null,
  };

  const gate = document.getElementById('org-gate');
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
  }

  function renderStats() {
    document.getElementById('stat-groups').textContent = String(state.groups.length);
    document.getElementById('stat-events').textContent = String(state.events.length);
    document.getElementById('stat-tickets').textContent = String(state.tickets.length);
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
      tr.innerHTML =
        '<td><strong>' +
        esc(g.name) +
        '</strong></td><td>' +
        esc(g.description || '—') +
        '</td><td>' +
        esc(g.ownerEmail) +
        '</td>';
      body.appendChild(tr);
    });
  }

  function renderEvents() {
    const body = document.getElementById('events-body');
    const dashBody = document.getElementById('dash-events-body');
    const empty = document.getElementById('events-empty');
    const dashEmpty = document.getElementById('dash-events-empty');

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

    if (body) {
      body.innerHTML = '';
      if (!state.events.length) {
        if (empty) empty.hidden = false;
      } else {
        if (empty) empty.hidden = true;
        state.events.forEach((ev) => body.appendChild(fillRow(ev)));
      }
    }

    if (dashBody) {
      dashBody.innerHTML = '';
      const slice = state.events.slice(0, 5);
      if (!slice.length) {
        if (dashEmpty) dashEmpty.hidden = false;
      } else {
        if (dashEmpty) dashEmpty.hidden = true;
        slice.forEach((ev) => {
          const tr = document.createElement('tr');
          tr.innerHTML =
            '<td><strong>' +
            esc(ev.title) +
            '</strong></td><td>' +
            esc(formatDate(ev.date)) +
            '</td><td>' +
            esc(ev.type || '—') +
            '</td><td>' +
            esc(groupNameById(ev.organiserGroupId)) +
            '</td>';
          dashBody.appendChild(tr);
        });
      }
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
    renderStats();
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

  function bindForms() {
    document.getElementById('form-group').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('group-name').value.trim();
      const description = document.getElementById('group-description').value.trim();
      const btn = e.submitter;
      if (btn) btn.disabled = true;
      const { ok, data } = await api('/api/organiser/groups', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });
      if (btn) btn.disabled = false;
      if (!ok) {
        alert(data.message || data.error || 'Could not create group');
        return;
      }
      closeModals();
      document.getElementById('form-group').reset();
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
    gate.hidden = true;
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
        gate.innerHTML =
          '<p class="org-section-sub">Sign in to manage organiser profiles, events, and tickets. Use <strong>Attendee</strong> mode in the nav to browse and book events.</p>' +
          '<p style="margin-top:12px"><a class="org-btn org-btn-primary" href="../login.html?next=/organiser/index.html">Sign in</a></p>';
        return;
      }
      boot(data.user);
    })
    .catch(() => {
      document.getElementById('org-gate-msg').textContent = 'Could not verify session.';
    });
})();
