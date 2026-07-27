/**
 * Public monthly organiser ranking leaderboard.
 */
(function () {
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatRate(rate) {
    var n = Number(rate);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 100) + '%';
  }

  function initials(name) {
    var parts = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return 'G';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function rowHtml(entry) {
    var org = entry.organiser || {};
    var path = org.profilePath || (org.id ? '/events/organiser?id=' + encodeURIComponent(org.id) : '#');
    var tier = entry.tier || 'top50';
    var badge =
      entry.cardLabel ||
      entry.displayLabel ||
      String(entry.label || '').replace(' on the Hub', '');
    var rateLabel = formatRate(entry.reviewRate);
    var stats =
      '★ ' +
      Number(entry.rating || 0).toFixed(1) +
      ' · ' +
      esc(String(entry.reviewCount || 0)) +
      ' reviews' +
      (rateLabel ? ' · ' + rateLabel + ' review rate' : '');

    var avatar = org.photoUrl
      ? '<img class="rankings-avatar" src="' +
        esc(org.photoUrl) +
        '" alt="" width="48" height="48" loading="lazy">'
      : '<span class="rankings-avatar rankings-avatar--placeholder" aria-hidden="true">' +
        esc(initials(org.name)) +
        '</span>';

    var tag = path && path !== '#' ? 'a' : 'div';
    var hrefAttr = tag === 'a' ? ' href="' + esc(path) + '"' : '';

    return (
      '<' +
      tag +
      ' class="rankings-row' +
      (tier === 'top10' ? ' rankings-row--top10' : '') +
      '" data-tier="' +
      esc(tier) +
      '"' +
      hrefAttr +
      '>' +
      '<span class="rankings-place">#' +
      esc(String(entry.rank)) +
      '</span>' +
      '<div class="rankings-org">' +
      avatar +
      '<div class="rankings-org-text">' +
      '<p class="rankings-org-name">' +
      esc(org.name || 'Networking group') +
      '</p>' +
      '<p class="rankings-org-stats">' +
      stats +
      '</p>' +
      '</div></div>' +
      '<div class="rankings-side">' +
      '<span class="hub-ranking-badge hub-ranking-badge--' +
      esc(tier) +
      '">★ ' +
      esc(badge) +
      '</span>' +
      '</div>' +
      '</' +
      tag +
      '>'
    );
  }

  function setFilter(tier) {
    var buttons = document.querySelectorAll('.rankings-filter');
    buttons.forEach(function (btn) {
      var active = btn.getAttribute('data-tier') === tier;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    var rows = document.querySelectorAll('#rankings-list .rankings-row');
    var shown = 0;
    rows.forEach(function (row) {
      var rowTier = row.getAttribute('data-tier');
      var match =
        tier === 'all' ||
        (tier === 'top10' && rowTier === 'top10') ||
        (tier === 'top25' && (rowTier === 'top10' || rowTier === 'top25')) ||
        (tier === 'top50' && (rowTier === 'top10' || rowTier === 'top25' || rowTier === 'top50'));
      row.hidden = !match;
      if (match) shown += 1;
    });

    var status = document.getElementById('rankings-status');
    var list = document.getElementById('rankings-list');
    if (!rows.length) return;
    if (status) {
      if (shown === 0) {
        status.hidden = false;
        status.textContent = 'No groups in this tier for the current period.';
      } else {
        status.hidden = true;
      }
    }
    if (list) list.hidden = shown === 0;
  }

  function paint(data) {
    var status = document.getElementById('rankings-status');
    var list = document.getElementById('rankings-list');
    var period = document.getElementById('rankings-period');
    if (!status || !list) return;

    if (!data || data.ok === false) {
      status.hidden = false;
      status.textContent = (data && data.message) || 'Could not load the leaderboard.';
      list.hidden = true;
      return;
    }

    var snap = data.snapshot;
    var entries = data.entries || [];

    if (period) {
      if (snap && snap.period_label) {
        period.hidden = false;
        period.textContent =
          snap.period_label +
          (snap.total_ranked
            ? ' · ' + snap.total_ranked + ' rated groups this period'
            : '');
      } else {
        period.hidden = true;
      }
    }

    if (!entries.length) {
      status.hidden = false;
      status.textContent =
        'No ranking snapshot yet — badges appear once groups have enough reviews.';
      list.hidden = true;
      return;
    }

    list.innerHTML = entries.map(rowHtml).join('');
    list.hidden = false;
    status.hidden = true;
    setFilter('all');
  }

  document.querySelectorAll('.rankings-filter').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setFilter(btn.getAttribute('data-tier') || 'all');
    });
  });

  fetch('/api/rankings', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (res) {
      return res.json();
    })
    .then(paint)
    .catch(function () {
      paint({ ok: false, message: 'Could not load the leaderboard.' });
    });
})();
