/**
 * Monthly organiser ranking leaderboard.
 * Works on the public /rankings page and inside the organiser dashboard.
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

  var state = {
    root: null,
    loaded: false,
    loading: false,
    entries: [],
    snapshot: null,
    cityFilter: 'all',
    myGroupIds: [],
  };

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

  function qs(id) {
    if (state.root && state.root.querySelector) {
      var scoped = state.root.querySelector('#' + id);
      if (scoped) return scoped;
    }
    return document.getElementById(id);
  }

  function previewHosts() {
    var hosts = [];
    if (state.root) hosts.push(state.root);
    if (document.body) hosts.push(document.body);
    var page = document.getElementById('org-page-leaderboard');
    if (page) hosts.push(page);
    return hosts;
  }

  function isDashboardMount() {
    return Boolean(
      state.root &&
        (state.root.id === 'org-page-leaderboard' ||
          state.root.classList.contains('org-page--leaderboard') ||
          (state.root.closest && state.root.closest('.org-page--leaderboard')))
    );
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
    var rating = Number(entry.rating || 0).toFixed(1);
    var reviews = String(entry.reviewCount || 0);
    var dashboard = isDashboardMount();
    var cities = Array.isArray(entry.cities) ? entry.cities : [];
    var cityAttr = cities
      .map(function (c) {
        return String(c || '')
          .trim()
          .toLowerCase();
      })
      .filter(Boolean)
      .join('|');

    var avatar = org.photoUrl
      ? '<img class="rankings-avatar" src="' +
        esc(org.photoUrl) +
        '" alt="" width="36" height="36" loading="lazy">'
      : '<span class="rankings-avatar rankings-avatar--placeholder" aria-hidden="true">' +
        esc(initials(org.name)) +
        '</span>';

    var tag = !options.preview && path && path !== '#' ? 'a' : 'div';
    var hrefAttr = tag === 'a' ? ' href="' + esc(path) + '"' : '';
    var previewAttr = options.preview ? ' aria-disabled="true"' : '';
    var mine = state.myGroupIds.indexOf(String(org.id || '')) >= 0;

    var metrics;
    if (dashboard) {
      metrics =
        '<p class="org-leaderboard-metrics-line">' +
        '<span>★ ' +
        esc(rating) +
        '</span>' +
        '<span>' +
        esc(reviews) +
        ' reviews</span>' +
        '<span>' +
        esc(rateLabel || '—') +
        ' review rate</span>' +
        '</p>';
    } else {
      metrics =
        '<p class="rankings-org-stats">' +
        '★ ' +
        esc(rating) +
        ' · ' +
        esc(reviews) +
        ' reviews' +
        (rateLabel ? ' · ' + rateLabel + ' review rate' : '') +
        (cities.length ? ' · ' + esc(cities.slice(0, 2).join(', ')) : '') +
        '</p>';
    }

    return (
      '<' +
      tag +
      ' class="rankings-row' +
      (dashboard ? ' org-leaderboard-row' : '') +
      (tier === 'top10' ? ' rankings-row--top10' : '') +
      (mine ? ' rankings-row--mine' : '') +
      '" data-tier="' +
      esc(tier) +
      '" data-cities="' +
      esc(cityAttr) +
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
      (mine ? ' <span class="rankings-you-pill">You</span>' : '') +
      '</p>' +
      metrics +
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

  function activeTierFilter() {
    var root = state.root || document;
    var active = root.querySelector('.rankings-filter.is-active');
    return (active && active.getAttribute('data-tier')) || 'all';
  }

  function applyRowFilters() {
    var tier = activeTierFilter();
    var city = String(state.cityFilter || 'all').toLowerCase();
    var list = qs('rankings-list');
    var rows = list ? list.querySelectorAll('.rankings-row') : [];
    var shown = 0;
    rows.forEach(function (row) {
      var rowTier = row.getAttribute('data-tier');
      var tierMatch =
        tier === 'all' ||
        (tier === 'top10' && rowTier === 'top10') ||
        (tier === 'top25' && (rowTier === 'top10' || rowTier === 'top25')) ||
        (tier === 'top50' && (rowTier === 'top10' || rowTier === 'top25' || rowTier === 'top50'));
      var cities = String(row.getAttribute('data-cities') || '');
      var cityMatch =
        city === 'all' ||
        cities.split('|').indexOf(city) >= 0 ||
        (city === '__none__' && !cities);
      var match = tierMatch && cityMatch;
      row.hidden = !match;
      if (match) shown += 1;
    });

    var status = qs('rankings-status');
    if (!rows.length) return;
    if (status) {
      if (shown === 0) {
        status.hidden = false;
        status.textContent = 'No groups match these filters for the current period.';
      } else {
        status.hidden = true;
      }
    }
    if (list) list.hidden = shown === 0;
  }

  function setFilter(tier) {
    var root = state.root || document;
    var buttons = root.querySelectorAll('.rankings-filter');
    buttons.forEach(function (btn) {
      var active = btn.getAttribute('data-tier') === tier;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    applyRowFilters();
  }

  function setPreviewMode(isPreview) {
    previewHosts().forEach(function (host) {
      host.classList.toggle('is-preview', !!isPreview);
    });
    var note = qs('rankings-preview-note');
    if (note) note.hidden = !isPreview;
  }

  function paintPreview() {
    var status = qs('rankings-status');
    var list = qs('rankings-list');
    var period = qs('rankings-period');
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

  function paintYourPlace(entries) {
    var card = qs('rankings-your-place');
    if (!card) return;
    var mine = (entries || []).filter(function (entry) {
      return state.myGroupIds.indexOf(String((entry.organiser || {}).id || '')) >= 0;
    });
    if (!mine.length) {
      card.hidden = true;
      card.innerHTML = '';
      return;
    }
    mine.sort(function (a, b) {
      return Number(a.rank) - Number(b.rank);
    });
    var best = mine[0];
    var tier = best.tier || 'top50';
    var nextTarget =
      tier === 'top10'
        ? null
        : tier === 'top25'
          ? { label: 'Top 10', rank: 10 }
          : { label: 'Top 25', rank: 25 };
    var tip;
    if (!nextTarget) {
      tip = 'You’re in the Top 10 — keep collecting reviews this month.';
    } else {
      var gap = Math.max(0, Number(best.rank) - nextTarget.rank);
      tip =
        gap <= 0
          ? 'You’re on the edge of ' + nextTarget.label + ' — every extra review helps.'
          : 'Climb ' +
            gap +
            ' place' +
            (gap === 1 ? '' : 's') +
            ' for ' +
            nextTarget.label +
            ' — ask past attendees for a quick review.';
    }
    card.hidden = false;
    card.innerHTML =
      '<p class="rankings-your-place-kicker">Your place</p>' +
      '<p class="rankings-your-place-rank">#' +
      esc(String(best.rank)) +
      ' · ' +
      esc(best.cardLabel || best.displayLabel || 'Top groups') +
      '</p>' +
      '<p class="rankings-your-place-name">' +
      esc((best.organiser && best.organiser.name) || 'Your group') +
      '</p>' +
      '<p class="rankings-your-place-tip">' +
      esc(tip) +
      '</p>';
  }

  function paintCityFilter(entries) {
    var select = qs('rankings-city-filter');
    if (!select) return;
    var cities = {};
    (entries || []).forEach(function (entry) {
      (entry.cities || []).forEach(function (city) {
        var c = String(city || '').trim();
        if (c) cities[c] = true;
      });
    });
    var list = Object.keys(cities).sort(function (a, b) {
      return a.localeCompare(b);
    });
    var current = state.cityFilter || 'all';
    select.innerHTML =
      '<option value="all">All cities</option>' +
      list
        .map(function (city) {
          return (
            '<option value="' +
            esc(city.toLowerCase()) +
            '">' +
            esc(city) +
            '</option>'
          );
        })
        .join('');
    var hasCurrent = Array.prototype.some.call(select.options, function (o) {
      return o.value === current;
    });
    select.value = hasCurrent ? current : 'all';
    state.cityFilter = select.value;
    select.hidden = list.length < 2;
  }

  function paint(data) {
    var status = qs('rankings-status');
    var list = qs('rankings-list');
    var period = qs('rankings-period');
    if (!status || !list) return;

    if (!data || data.ok === false) {
      paintPreview();
      paintYourPlace([]);
      return;
    }

    var snap = data.snapshot;
    var entries = data.entries || [];
    state.entries = entries;
    state.snapshot = snap;

    if (!entries.length) {
      paintPreview();
      paintYourPlace([]);
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
    paintCityFilter(entries);
    paintYourPlace(entries);
    setFilter('all');
  }

  function bindThemeToggle() {
    var root = state.root || document;
    var btn = qs('rankings-theme-toggle');
    var shell = root.querySelector
      ? root.querySelector('.rankings-board-shell') || document.querySelector('.rankings-board-shell')
      : document.querySelector('.rankings-board-shell');
    var page = document.getElementById('org-page-leaderboard') || document.body;
    if (!btn || btn.getAttribute('data-rankings-bound') === '1') return;
    btn.setAttribute('data-rankings-bound', '1');
    var key = 'hub_rankings_board_theme_v1';
    function apply(theme) {
      var light = theme === 'light';
      if (shell) shell.classList.toggle('rankings-board-shell--light', light);
      if (page) page.classList.toggle('rankings-board--light', light);
      btn.setAttribute('aria-pressed', light ? 'true' : 'false');
      btn.textContent = light ? 'Dusk board' : 'Light board';
      try {
        localStorage.setItem(key, light ? 'light' : 'dusk');
      } catch (e) {
        /* ignore */
      }
    }
    var stored = 'dusk';
    try {
      stored = localStorage.getItem(key) || 'dusk';
    } catch (e) {
      stored = 'dusk';
    }
    apply(stored);
    btn.addEventListener('click', function () {
      var next = shell && shell.classList.contains('rankings-board-shell--light') ? 'dusk' : 'light';
      apply(next);
    });
  }

  function bindCityFilter() {
    var select = qs('rankings-city-filter');
    if (!select || select.getAttribute('data-rankings-bound') === '1') return;
    select.setAttribute('data-rankings-bound', '1');
    select.addEventListener('change', function () {
      state.cityFilter = select.value || 'all';
      applyRowFilters();
    });
  }

  function bindFilters() {
    var root = state.root || document;
    root.querySelectorAll('.rankings-filter').forEach(function (btn) {
      if (btn.getAttribute('data-rankings-bound') === '1') return;
      btn.setAttribute('data-rankings-bound', '1');
      btn.addEventListener('click', function () {
        setFilter(btn.getAttribute('data-tier') || 'all');
      });
    });
    bindCityFilter();
    bindThemeToggle();
  }

  function load() {
    if (state.loading) return Promise.resolve();
    state.loading = true;
    return fetch('/api/rankings', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        paint(data);
        state.loaded = true;
      })
      .catch(function () {
        paintPreview();
        state.loaded = true;
      })
      .finally(function () {
        state.loading = false;
      });
  }

  function init(root) {
    var mount =
      root ||
      document.getElementById('org-page-leaderboard') ||
      document.querySelector('.rankings-main') ||
      document;
    state.root = mount;
    if (!qs('rankings-list')) return;
    bindFilters();
    if (!state.loaded) load();
  }

  function ensure() {
    init(document.getElementById('org-page-leaderboard') || state.root);
    if (!state.loaded) return load();
    return Promise.resolve();
  }

  window.HubRankings = {
    init: init,
    ensure: ensure,
    reload: function () {
      state.loaded = false;
      return load();
    },
    setMyGroupIds: function (ids) {
      state.myGroupIds = (ids || []).map(String).filter(Boolean);
      if (state.entries && state.entries.length) {
        paintYourPlace(state.entries);
        var list = qs('rankings-list');
        if (list && state.entries.length) {
          list.innerHTML = state.entries.map(function (entry) {
            return rowHtml(entry);
          }).join('');
          applyRowFilters();
        }
      }
    },
  };

  // Public page loads immediately; organiser dashboard mounts on #leaderboard.
  if (document.body && document.body.classList.contains('rankings-page') && document.getElementById('rankings-list')) {
    init();
  }
})();
