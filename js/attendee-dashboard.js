/**
 * Attendee account dashboard — /api/auth/attendee-dashboard
 */
(function () {
  const PAGE_SIZE = 5;
  const listPages = { upcoming: 1, past: 1 };
  let registrations = [];
  let currentRoute = 'overview';

  const signin = document.getElementById('ad-signin');
  const shell = document.getElementById('ad-shell');

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function formatDateShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatTimeRange(startRaw, endRaw) {
    if (!startRaw) return '—';
    const start = new Date(startRaw);
    if (Number.isNaN(start.getTime())) return '—';
    const fmt = (d) =>
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (endRaw) {
      const end = new Date(endRaw);
      if (!Number.isNaN(end.getTime())) return fmt(start) + '–' + fmt(end);
    }
    return fmt(start);
  }

  function isUpcoming(reg) {
    if (!reg.date) return true;
    const t = new Date(reg.date).getTime();
    return !Number.isNaN(t) && t >= Date.now();
  }

  function upcomingList() {
    return registrations.filter(isUpcoming);
  }

  function pastList() {
    return registrations.filter((r) => !isUpcoming(r));
  }

  function pendingReviewsList() {
    return registrations.filter((r) => r.reviewStatus === 'pending');
  }

  function doneReviewsList() {
    return registrations.filter((r) => r.reviewStatus === 'reviewed');
  }

  function thumbHtml(item) {
    const name = item.title || '?';
    if (item.imageUrl) {
      return (
        '<img class="ad-thumb" src="' +
        esc(item.imageUrl) +
        '" alt="" width="44" height="44" loading="lazy" />'
      );
    }
    const letter = String(name).trim().charAt(0).toUpperCase() || '?';
    return '<div class="ad-thumb-placeholder" aria-hidden="true">' + esc(letter) + '</div>';
  }

  function reviewBadge(status) {
    if (status === 'reviewed') {
      return '<span class="ad-badge ad-badge-green">✓ Reviewed</span>';
    }
    if (status === 'pending') {
      return '<span class="ad-badge ad-badge-red">⚠ Pending</span>';
    }
    return '<span class="ad-badge ad-badge-grey">Upcoming</span>';
  }

  function actionCell(reg) {
    if (reg.reviewStatus === 'pending') {
      return '<button type="button" class="ad-btn ad-btn-gold" disabled title="Coming soon">Leave Review</button>';
    }
    if (reg.reviewStatus === 'reviewed') {
      return '<button type="button" class="ad-btn" disabled>View</button>';
    }
    return '<button type="button" class="ad-btn" disabled>View Ticket</button>';
  }

  function parseRoute() {
    const hash = (location.hash.replace('#', '') || 'overview').toLowerCase();
    const allowed = ['overview', 'upcoming', 'past', 'reviews-pending', 'reviews-done'];
    return allowed.includes(hash) ? hash : 'overview';
  }

  function setRoute(route) {
    currentRoute = route || 'overview';
    document.querySelectorAll('[data-ad-page]').forEach((p) => {
      p.classList.toggle('is-active', p.getAttribute('data-ad-page') === currentRoute);
    });
    document.querySelectorAll('.hub-side-nav-link[data-ad-route]').forEach((a) => {
      a.classList.toggle('is-active', a.getAttribute('data-ad-route') === currentRoute);
    });
    if (location.hash.replace('#', '') !== currentRoute) {
      history.replaceState(null, '', '#' + currentRoute);
    }
  }

  function renderStats(stats) {
    const upcoming = document.getElementById('ad-stat-upcoming');
    const next = document.getElementById('ad-stat-next');
    const reviews = document.getElementById('ad-stat-reviews');
    const pending = document.getElementById('ad-stat-reviews-pending');
    if (upcoming) upcoming.textContent = String(stats.upcomingCount || 0);
    if (next) {
      next.textContent = stats.nextEventDate
        ? 'Next: ' + formatDateShort(stats.nextEventDate)
        : '—';
    }
    if (reviews) reviews.textContent = String(stats.reviewsLeft || 0);
    if (pending) {
      const n = stats.reviewsPending || 0;
      pending.textContent = n ? '⭐ ' + n + ' pending' : '—';
    }
  }

  function updateSideCounts() {
    const set = (id, n) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(n);
    };
    set('ad-side-upcoming', upcomingList().length);
    set('ad-side-past', pastList().length);
    set('ad-side-pending', pendingReviewsList().length);
    set('ad-side-reviewed', doneReviewsList().length);
  }

  function renderPagination(navId, listKey, totalPages) {
    const nav = document.getElementById(navId);
    if (!nav) return;
    const currentPage = listPages[listKey] || 1;
    if (totalPages <= 1) {
      nav.hidden = true;
      return;
    }
    nav.hidden = false;
    let html = '<span class="ad-page-label">Page ' + currentPage + ' of ' + totalPages + '</span>';
    for (let p = 1; p <= totalPages; p++) {
      html +=
        '<button type="button" class="ad-page-btn' +
        (p === currentPage ? ' is-active' : '') +
        '" data-page="' +
        p +
        '" data-list="' +
        listKey +
        '">' +
        p +
        '</button>';
    }
    html +=
      '<button type="button" class="ad-page-btn" data-page="' +
      (currentPage + 1) +
      '" data-list="' +
      listKey +
      '" ' +
      (currentPage >= totalPages ? 'disabled' : '') +
      ' aria-label="Next page">›</button>';
    nav.innerHTML = html;
    nav.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = Number(btn.getAttribute('data-page'));
        const key = btn.getAttribute('data-list');
        if (!p || !key || p < 1 || p > totalPages || p === listPages[key]) return;
        listPages[key] = p;
        renderAllTables();
      });
    });
  }

  function renderEventRows(bodyId, emptyId, navId, listKey, list, fullColumns) {
    const body = document.getElementById(bodyId);
    const empty = document.getElementById(emptyId);
    if (!body) return;

    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    listPages[listKey] = Math.min(listPages[listKey] || 1, totalPages);
    const start = (listPages[listKey] - 1) * PAGE_SIZE;
    const slice = list.slice(start, start + PAGE_SIZE);

    body.innerHTML = '';
    if (!list.length) {
      if (empty) empty.hidden = false;
      renderPagination(navId, listKey, 1);
      return;
    }
    if (empty) empty.hidden = true;

    slice.forEach((reg) => {
      const tr = document.createElement('tr');
      if (fullColumns) {
        tr.innerHTML =
          '<td>' +
          thumbHtml(reg) +
          '</td><td class="ad-td-name">' +
          esc(reg.title) +
          '</td><td>' +
          esc(formatDateShort(reg.date)) +
          '</td><td>' +
          esc(formatTimeRange(reg.date, reg.endDate)) +
          '</td><td>' +
          esc(reg.ticketLabel || '—') +
          '</td><td>' +
          reviewBadge(reg.reviewStatus) +
          '</td><td>' +
          actionCell(reg) +
          '</td>';
      } else {
        tr.innerHTML =
          '<td>' +
          thumbHtml(reg) +
          '</td><td class="ad-td-name">' +
          esc(reg.title) +
          '</td><td>' +
          esc(formatDateShort(reg.date)) +
          '</td><td>' +
          reviewBadge(reg.reviewStatus) +
          '</td><td>' +
          actionCell(reg) +
          '</td>';
      }
      body.appendChild(tr);
    });

    renderPagination(navId, listKey, totalPages);
  }

  function renderAllTables() {
    const up = upcomingList().sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return da - db;
    });
    const past = pastList().sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });
    renderEventRows('ad-upcoming-body', 'ad-upcoming-empty', 'ad-pagination-upcoming', 'upcoming', up, true);
    renderEventRows('ad-past-body', 'ad-past-empty', 'ad-pagination-past', 'past', past, true);
    renderEventRows(
      'ad-reviews-pending-body',
      'ad-reviews-pending-empty',
      null,
      'reviews-pending',
      pendingReviewsList(),
      false
    );
    renderEventRows(
      'ad-reviews-done-body',
      'ad-reviews-done-empty',
      null,
      'reviews-done',
      doneReviewsList(),
      false
    );
    updateSideCounts();
  }

  function renderWelcome(user) {
    const name = (user && user.name && String(user.name).trim()) || '';
    const nameEl = document.getElementById('ad-welcome-name');
    if (nameEl) {
      nameEl.textContent = name ? 'Welcome back, ' + name + ' 👋' : 'Welcome back 👋';
    }
  }

  function bindNav() {
    document.querySelectorAll('.hub-side-nav-link[data-ad-route]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        setRoute(a.getAttribute('data-ad-route') || 'overview');
      });
    });
    window.addEventListener('hashchange', () => setRoute(parseRoute()));
  }

  async function init() {
    bindNav();
    setRoute(parseRoute());

    const sessionRes = await fetch('/api/auth/session', { credentials: 'include' });
    const sessionData = await sessionRes.json();
    if (!sessionData.ok || !sessionData.user) {
      if (signin) signin.hidden = false;
      return;
    }

    if (shell) shell.hidden = false;
    renderWelcome(sessionData.user);

    const res = await fetch('/api/auth/attendee-dashboard', { credentials: 'include' });
    const data = await res.json();
    if (!data.ok) {
      if (signin) {
        signin.hidden = false;
        shell.hidden = true;
      }
      return;
    }

    registrations = data.registrations || [];
    renderStats(data.stats || {});
    renderAllTables();

    const demoNote = document.getElementById('ad-demo-note');
    if (demoNote) demoNote.hidden = !data.isDemo;
  }

  init();
})();
