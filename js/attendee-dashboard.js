/**
 * Attendee account dashboard — /api/auth/attendee-dashboard
 */
(function () {
  const PAGE_SIZE = 5;
  let currentPage = 1;
  let registrations = [];

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

  function sortedRegistrations() {
    const now = Date.now();
    return registrations.slice().sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      const aUp = da >= now;
      const bUp = db >= now;
      if (aUp !== bUp) return aUp ? -1 : 1;
      if (aUp) return da - db;
      return db - da;
    });
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

  function renderPagination(totalPages) {
    const nav = document.getElementById('ad-pagination');
    if (!nav) return;
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
        '">' +
        p +
        '</button>';
    }
    html +=
      '<button type="button" class="ad-page-btn" data-page="' +
      (currentPage + 1) +
      '" ' +
      (currentPage >= totalPages ? 'disabled' : '') +
      ' aria-label="Next page">›</button>';
    nav.innerHTML = html;
    nav.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = Number(btn.getAttribute('data-page'));
        if (!p || p < 1 || p > totalPages || p === currentPage) return;
        currentPage = p;
        renderTable();
      });
    });
  }

  function renderTable() {
    const body = document.getElementById('ad-events-body');
    const empty = document.getElementById('ad-events-empty');
    if (!body) return;

    const list = sortedRegistrations();
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const slice = list.slice(start, start + PAGE_SIZE);

    body.innerHTML = '';
    if (!list.length) {
      if (empty) empty.hidden = false;
      renderPagination(1);
      return;
    }
    if (empty) empty.hidden = true;

    slice.forEach((reg) => {
      const tr = document.createElement('tr');
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
      body.appendChild(tr);
    });

    renderPagination(totalPages);
  }

  function renderWelcome(user) {
    const name = (user && user.name && String(user.name).trim()) || '';
    const nameEl = document.getElementById('ad-welcome-name');
    if (nameEl) {
      nameEl.textContent = name ? 'Welcome back, ' + name + ' 👋' : 'Welcome back 👋';
    }
  }

  async function init() {
    const sessionRes = await fetch('/api/auth/session', { credentials: 'include' });
    const sessionData = await sessionRes.json();
    if (!sessionData.ok || !sessionData.user) {
      if (signin) signin.hidden = false;
      return;
    }

    if (shell) shell.hidden = false;
    renderWelcome(sessionData.user);

    if (sessionData.canOrganise) {
      const orgLink = document.getElementById('ad-link-organiser');
      if (orgLink) orgLink.hidden = false;
    }

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
    renderTable();

    const demoNote = document.getElementById('ad-demo-note');
    if (demoNote) demoNote.hidden = !data.isDemo;
  }

  init();
})();
