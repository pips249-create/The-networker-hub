/**
 * Public monthly organiser ranking leaderboard.
 */
(function () {
  var PREVIEW_ENTRIES = [
    {
      rank: 1,
      tier: 'top10',
      label: 'Top 10 networking group on the Hub',
      cardLabel: 'Top 10 · July 2026',
      rating: 5.0,
      reviewCount: 28,
      reviewRate: 0.56,
      organiser: { name: 'Harbour City Connectors', photoUrl: null, profilePath: '/events/?mode=organisers' },
    },
    {
      rank: 2,
      tier: 'top10',
      label: 'Top 10 networking group on the Hub',
      cardLabel: 'Top 10 · July 2026',
      rating: 4.9,
      reviewCount: 41,
      reviewRate: 0.48,
      organiser: { name: 'Northbridge Breakfast Club', photoUrl: null, profilePath: '/events/?mode=organisers' },
    },
    {
      rank: 3,
      tier: 'top10',
      label: 'Top 10 networking group on the Hub',
      cardLabel: 'Top 10 · July 2026',
      rating: 4.9,
      reviewCount: 19,
      reviewRate: 0.63,
      organiser: { name: 'Riverside Women in Business', photoUrl: null, profilePath: '/events/?mode=organisers' },
    },
    {
      rank: 8,
      tier: 'top10',
      label: 'Top 10 networking group on the Hub',
      cardLabel: 'Top 10 · July 2026',
      rating: 4.8,
      reviewCount: 22,
      reviewRate: 0.44,
      organiser: { name: 'Midlands Founders Circle', photoUrl: null, profilePath: '/events/?mode=organisers' },
    },
    {
      rank: 14,
      tier: 'top25',
      label: 'Top 25 networking group on the Hub',
      cardLabel: 'Top 25 · July 2026',
      rating: 4.7,
      reviewCount: 16,
      reviewRate: 0.4,
      organiser: { name: 'Canal Side Professionals', photoUrl: null, profilePath: '/events/?mode=organisers' },
    },
    {
      rank: 22,
      tier: 'top25',
      label: 'Top 25 networking group on the Hub',
      cardLabel: 'Top 25 · July 2026',
      rating: 4.6,
      reviewCount: 12,
      reviewRate: 0.5,
      organiser: { name: 'Summit Sector Meetups', photoUrl: null, profilePath: '/events/?mode=organisers' },
    },
    {
      rank: 31,
      tier: 'top50',
      label: 'Top 50 networking group on the Hub',
      cardLabel: 'Top 50 · July 2026',
      rating: 4.5,
      reviewCount: 9,
      reviewRate: 0.36,
      organiser: { name: 'Eastgate Evening Network', photoUrl: null, profilePath: '/events/?mode=organisers' },
    },
    {
      rank: 47,
      tier: 'top50',
      label: 'Top 50 networking group on the Hub',
      cardLabel: 'Top 50 · July 2026',
      rating: 4.4,
      reviewCount: 7,
      reviewRate: 0.47,
      organiser: { name: 'Coastal Creatives Hub', photoUrl: null, profilePath: '/events/?mode=organisers' },
    },
  ];

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

  function rowHtml(entry, options) {
    options = options || {};
    var org = entry.organiser || {};
    var path = options.preview
      ? '#'
      : org.profilePath || (org.id ? '/events/organiser?id=' + encodeURIComponent(org.id) : '#');
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
        '" alt="" width="50" height="50" loading="lazy">'
      : '<span class="rankings-avatar rankings-avatar--placeholder" aria-hidden="true">' +
        esc(initials(org.name)) +
        '</span>';

    var tag = !options.preview && path && path !== '#' ? 'a' : 'div';
    var hrefAttr = tag === 'a' ? ' href="' + esc(path) + '"' : '';
    var previewAttr = options.preview ? ' aria-disabled="true"' : '';

    return (
      '<' +
      tag +
      ' class="rankings-row' +
      (tier === 'top10' ? ' rankings-row--top10' : '') +
      '" data-tier="' +
      esc(tier) +
      '"' +
      hrefAttr +
      previewAttr +
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

  function setPreviewMode(isPreview) {
    document.body.classList.toggle('is-preview', !!isPreview);
    var note = document.getElementById('rankings-preview-note');
    if (note) note.hidden = !isPreview;
  }

  function paintPreview() {
    var status = document.getElementById('rankings-status');
    var list = document.getElementById('rankings-list');
    var period = document.getElementById('rankings-period');
    if (!list) return;

    if (period) {
      period.hidden = false;
      period.textContent = 'Preview · July 2026 · sample groups';
    }
    setPreviewMode(true);
    list.innerHTML = PREVIEW_ENTRIES.map(function (entry) {
      return rowHtml(entry, { preview: true });
    }).join('');
    list.hidden = false;
    if (status) status.hidden = true;
    setFilter('all');
  }

  function paint(data) {
    var status = document.getElementById('rankings-status');
    var list = document.getElementById('rankings-list');
    var period = document.getElementById('rankings-period');
    if (!status || !list) return;

    if (!data || data.ok === false) {
      paintPreview();
      return;
    }

    var snap = data.snapshot;
    var entries = data.entries || [];

    if (!entries.length) {
      paintPreview();
      return;
    }

    setPreviewMode(false);
    if (period) {
      if (snap && snap.period_label) {
        period.hidden = false;
        period.textContent =
          snap.period_label +
          (snap.total_ranked ? ' · ' + snap.total_ranked + ' rated groups this period' : '');
      } else {
        period.hidden = true;
      }
    }

    list.innerHTML = entries.map(function (entry) {
      return rowHtml(entry);
    }).join('');
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
      paintPreview();
    });
})();
