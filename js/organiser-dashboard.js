/**
 * Organiser dashboard — groups, events, ticket types (Supabase via /api/organiser/*).
 */
(function () {
  const ORG_PAGE_SIZE = 10;
  const EVENTS_FETCH_SIZE = 100;
  const DESCRIPTION_MAX_WORDS = 500;
  const listPages = { groups: 1, events: 1, tickets: 1, attendees: 1, cancellations: 1, reviews: 1, revenue: 1 };
  let eventsSubRoute = 'events-list';
  const expandedSeriesKeys = new Set();

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
    cancellationsEvent: 'all',
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
    cancellationsAll: [],
    reviews: [],
    groupRankings: {},
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
    opportunities: [],
    opportunitiesLoaded: false,
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

    const editors = (state.teamMembers || []).filter(function (m) {
      return (
        String(m.role || '').toLowerCase() === 'editor' &&
        String(m.status || '').toLowerCase() === 'active'
      );
    }).length;
    set('stat-training-sessions', '0');
    set('stat-training-editors', String(editors));
    set('stat-training-registrations', '0');

    const enquiries = state.opportunityEnquiries || [];
    set('stat-opp-enquiries', String(enquiries.length));
    set('stat-opp-enquiries-new', String(state.opportunityEnquiriesNewCount || 0));
    const liveListings = (state.opportunities || []).filter(function (o) {
      const status = String(o.status || o.listingStatus || '').toLowerCase();
      return status === 'published' || status === 'live';
    }).length;
    set('stat-opp-listings', String(liveListings));

    renderHubPortalMeta();
    renderOrganiserRankingBanner();
    renderOrganiserRankingShare();
  }

  function rankingTierClass(tier) {
    const t = String(tier || '').toLowerCase();
    if (t === 'top10' || t === 'top25' || t === 'top50') return 'hub-ranking-badge--' + t;
    return 'hub-ranking-badge--top50';
  }

  function rankingBadgeText(row) {
    if (!row) return '';
    return row.displayLabel || String(row.label || '').replace(' on the Hub', '') + (row.periodLabel ? ' · ' + row.periodLabel : '');
  }

  function groupPublicProfileUrl(groupId) {
    return '../events/organiser.html?id=' + encodeURIComponent(groupId);
  }

  function rankingShareText(groupName, row) {
    const badge = rankingBadgeText(row);
    const url = groupPublicProfileUrl(row.id);
    const absUrl =
      (location.origin || '') +
      '/events/organiser.html?id=' +
      encodeURIComponent(row.id);
    return (
      'Proud to share that ' +
      (groupName || 'our group') +
      ' is a ' +
      badge +
      ' on The Networker Hub. ⭐ ' +
      absUrl
    );
  }

  function rankingBadgeHtml(row, options) {
    const opts = options || {};
    if (!row?.label && !row?.tier) return '';
    const tier = row.tier || 'top50';
    const lg = opts.large ? ' hub-ranking-badge--lg' : '';
    const extra = opts.extraClass ? ' ' + opts.extraClass : '';
    return (
      '<span class="hub-ranking-badge ' +
      rankingTierClass(tier) +
      lg +
      extra +
      '" title="Ranked #' +
      esc(String(row.rank)) +
      ' of ' +
      esc(String(row.totalRanked)) +
      ' rated groups">★ ' +
      esc(rankingBadgeText(row)) +
      '</span>'
    );
  }

  function copyOrganiserText(text, btn) {
    const done = function () {
      if (!btn) return;
      const prev = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(function () {
        btn.textContent = prev;
      }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        window.prompt('Copy this text:', text);
      });
    } else {
      window.prompt('Copy this text:', text);
      done();
    }
  }

  function buildRankingShareCardHtml(g, row) {
    const shareText = rankingShareText(g.name, row);
    const profileUrl =
      (location.origin || '') + '/events/organiser.html?id=' + encodeURIComponent(g.id);
    return (
      '<article class="org-ranking-share-card">' +
      '<div class="org-ranking-share-card-head">' +
      '<h3 class="org-ranking-share-card-name">' +
      esc(g.name) +
      '</h3>' +
      rankingBadgeHtml(row, { large: true }) +
      '</div>' +
      '<p class="org-ranking-share-meta">Ranked #' +
      esc(String(row.rank)) +
      ' of ' +
      esc(String(row.totalRanked)) +
      ' rated groups · ★ ' +
      esc(Number(row.rating).toFixed(1)) +
      ' from ' +
      esc(String(row.reviewCount)) +
      ' reviews</p>' +
      '<div class="org-ranking-share-preview">' +
      '<p class="org-ranking-share-preview-label">Social post preview</p>' +
      '<div class="org-ranking-share-preview-card" role="group" aria-label="Social post preview">' +
      '<p class="org-ranking-share-preview-text">' +
      esc(shareText) +
      '</p></div></div>' +
      '<div class="org-ranking-share-actions">' +
      '<button type="button" class="org-btn org-btn-gold org-btn-sm" data-copy-share="' +
      esc(shareText) +
      '">Copy social post</button>' +
      '<button type="button" class="org-btn org-btn-outline org-btn-sm" data-copy-link="' +
      esc(profileUrl) +
      '">Copy profile link</button>' +
      '<a class="org-btn org-btn-outline org-btn-sm" href="' +
      esc(groupPublicProfileUrl(g.id)) +
      '" target="_blank" rel="noopener noreferrer">View public profile</a>' +
      '</div></article>'
    );
  }

  function bindRankingShareActions(root) {
    if (!root) return;
    root.querySelectorAll('[data-copy-share]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        copyOrganiserText(btn.getAttribute('data-copy-share') || '', btn);
      });
    });
    root.querySelectorAll('[data-copy-link]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        copyOrganiserText(btn.getAttribute('data-copy-link') || '', btn);
      });
    });
  }

  const RANKING_PANEL_COLLAPSE_KEYS = {
    overview: 'hub_org_ranking_panel_overview_collapsed_v1',
    events: 'hub_org_ranking_panel_events_collapsed_v1',
  };

  const rankingPanelBound = new Set();

  function isRankingPanelCollapsed(storageKey) {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === null) return true;
      return stored === '1';
    } catch {
      return true;
    }
  }

  function setRankingPanelCollapsed(storageKey, collapsed) {
    try {
      localStorage.setItem(storageKey, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  function bindRankingPanel(panelId, storageKey) {
    if (rankingPanelBound.has(panelId)) return;
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const toggle = panel.querySelector('.org-ranking-panel-toggle');
    const body = panel.querySelector('.org-ranking-panel-body');
    const chev = panel.querySelector('.org-ranking-panel-chev');
    if (!toggle || !body) return;

    function applyCollapsed(collapsed) {
      body.hidden = collapsed;
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      if (chev) chev.textContent = collapsed ? 'Show' : 'Hide';
      panel.classList.toggle('is-expanded', !collapsed);
    }

    applyCollapsed(isRankingPanelCollapsed(storageKey));
    toggle.addEventListener('click', function () {
      const collapsed = !body.hidden;
      applyCollapsed(collapsed);
      setRankingPanelCollapsed(storageKey, collapsed);
    });
    rankingPanelBound.add(panelId);
  }

  function updateRankingPanelSummaries(summaryText) {
    ['org-ranking-panel-overview-summary', 'org-ranking-panel-events-summary'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = summaryText ? ' — ' + summaryText : '';
    });
  }

  function renderOrganiserRankingShare() {
    const shareRoot = document.getElementById('org-ranking-share-events');
    const cardsEl = document.getElementById('org-ranking-share-cards');
    const examplesEl = document.getElementById('org-ranking-tier-examples');
    const groupsMount = document.getElementById('org-ranking-share-groups-mount');
    const overviewPanel = document.getElementById('org-ranking-panel-overview');
    const eventsPanel = document.getElementById('org-ranking-panel-events');

    const periodLabel =
      (bestGroupRanking() && bestGroupRanking().periodLabel) ||
      new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    if (examplesEl) {
      examplesEl.innerHTML = [
        { tier: 'top10', sample: 'Top 10 networking group' },
        { tier: 'top25', sample: 'Top 25 networking group' },
        { tier: 'top50', sample: 'Top 50 networking group' },
      ]
        .map(function (item) {
          return (
            '<div class="org-ranking-tier-example">' +
            '<span class="org-ranking-tier-example-label">' +
            esc(item.tier.replace('top', 'Top ')) +
            '</span>' +
            '<span class="hub-ranking-badge hub-ranking-badge--' +
            esc(item.tier) +
            ' hub-ranking-badge--lg">★ ' +
            esc(item.sample + ' · ' + periodLabel) +
            '</span></div>'
          );
        })
        .join('');
    }

    const ranked = (state.groups || [])
      .map(function (g) {
        const row = state.groupRankings?.[g.id];
        if (!row?.label) return null;
        return { group: g, row: { ...row, id: g.id } };
      })
      .filter(Boolean);

    const cardsHtml = ranked.length
      ? ranked
          .map(function (item) {
            return buildRankingShareCardHtml(item.group, item.row);
          })
          .join('')
      : '';

    const summaryText = ranked.length ? rankingBadgeText(ranked[0].row) : '';
    updateRankingPanelSummaries(summaryText);

    if (overviewPanel) overviewPanel.hidden = !ranked.length;
    if (eventsPanel) eventsPanel.hidden = !ranked.length;

    bindRankingPanel('org-ranking-panel-overview', RANKING_PANEL_COLLAPSE_KEYS.overview);
    bindRankingPanel('org-ranking-panel-events', RANKING_PANEL_COLLAPSE_KEYS.events);

    if (shareRoot) {
      if (cardsEl) cardsEl.innerHTML = cardsHtml;
      bindRankingShareActions(shareRoot);
    }

    if (groupsMount) {
      if (ranked.length) {
        groupsMount.innerHTML =
          '<section class="org-ranking-share org-ranking-share--compact">' +
          '<h3 class="org-section-title">Your ranking badges</h3>' +
          '<p class="org-section-sub">Share on social media — open <a href="#events-overview">My events</a> for the full preview.</p>' +
          '<div class="org-ranking-share-cards">' +
          cardsHtml +
          '</div></section>';
        bindRankingShareActions(groupsMount);
      } else {
        groupsMount.innerHTML = '';
      }
    }
  }

  function bestGroupRanking() {
    const rankings = state.groupRankings || {};
    const entries = Object.keys(rankings)
      .map((id) => ({ id, ...rankings[id] }))
      .filter((row) => row.label && row.rank);
    if (!entries.length) return null;
    entries.sort((a, b) => a.rank - b.rank);
    const best = entries[0];
    const group = state.groups.find((g) => g.id === best.id);
    return {
      ...best,
      groupName: group?.name || 'Your group',
    };
  }

  function rankingForGroup(groupId) {
    const key = String(groupId || '').trim();
    if (!key || key === 'all') return bestGroupRanking();
    const row = state.groupRankings?.[key];
    if (!row?.label) return null;
    const group = state.groups.find((g) => g.id === key);
    return { ...row, id: key, groupName: group?.name || 'Your group' };
  }

  function formatTicketsSoldLabel(sold, capacity) {
    const n = Math.max(0, Number(sold) || 0);
    const cap = Number(capacity);
    if (Number.isFinite(cap) && cap > 0) return n + ' / ' + cap;
    if (n > 0) return n + ' sold';
    return '0 / —';
  }

  function groupRankingBadgeHtml(groupId) {
    const row = state.groupRankings?.[groupId];
    if (!row?.label) return '';
    return rankingBadgeHtml(row, { extraClass: 'org-ranking-inline' });
  }

  function renderOrganiserRankingBanner() {
    const best = bestGroupRanking();
    const html = best
      ? '<strong>' +
        esc(best.displayLabel || best.label) +
        '</strong> — <em>' +
        esc(best.groupName) +
        '</em> is ranked #' +
        esc(String(best.rank)) +
        ' of ' +
        esc(String(best.totalRanked)) +
        ' rated groups on the Hub (★ ' +
        esc(Number(best.rating).toFixed(1)) +
        ' from ' +
        esc(String(best.reviewCount)) +
        ' reviews).'
      : '';
    ['org-ranking-banner', 'org-events-ranking-banner'].forEach((id) => {
      const banner = document.getElementById(id);
      if (!banner) return;
      if (!best) {
        banner.hidden = true;
        banner.innerHTML = '';
        return;
      }
      banner.hidden = false;
      banner.innerHTML = html;
    });

    const overviewPanel = document.getElementById('org-ranking-panel-overview');
    const eventsPanel = document.getElementById('org-ranking-panel-events');
    const hasRanking = Boolean(best);
    if (overviewPanel) overviewPanel.hidden = !hasRanking;
    if (eventsPanel) eventsPanel.hidden = !hasRanking;
    if (hasRanking) {
      updateRankingPanelSummaries(rankingBadgeText(best));
      bindRankingPanel('org-ranking-panel-overview', RANKING_PANEL_COLLAPSE_KEYS.overview);
      bindRankingPanel('org-ranking-panel-events', RANKING_PANEL_COLLAPSE_KEYS.events);
    }
  }

  function renderReviewsRankingPill() {
    const pill = document.getElementById('reviews-ranking-pill');
    if (!pill) return;
    const ranking = rankingForGroup(filters.reviewsGroup);
    if (!ranking) {
      pill.hidden = true;
      pill.textContent = '';
      return;
    }
    pill.hidden = false;
    const prefix =
      filters.reviewsGroup !== 'all' ? String(ranking.groupName || 'Your group') + ': ' : '';
    pill.textContent =
      prefix + rankingBadgeText(ranking) + ' (#' + ranking.rank + ' of ' + ranking.totalRanked + ')';
  }

  function renderHubPortalMeta() {
    const eventsEl = document.getElementById('hub-portal-meta-events');
    const trainingEl = document.getElementById('hub-portal-meta-training');
    const businessEl = document.getElementById('hub-portal-meta-business');
    if (eventsEl) {
      const n = state.eventsTotal || state.events.length;
      const rev = totalRevenueDisplay();
      eventsEl.textContent = n + ' event' + (n === 1 ? '' : 's') + ' · ' + rev + ' revenue';
    }
    if (trainingEl) {
      const editors = (state.teamMembers || []).filter(function (m) {
        return (
          String(m.role || '').toLowerCase() === 'editor' &&
          String(m.status || '').toLowerCase() === 'active'
        );
      }).length;
      trainingEl.textContent =
        editors > 0
          ? editors + ' team editor' + (editors === 1 ? '' : 's')
          : 'Workshops coming soon';
    }
    if (businessEl) {
      const newCount = Number(state.opportunityEnquiriesNewCount) || 0;
      const total = (state.opportunityEnquiries || []).length;
      if (newCount > 0) {
        businessEl.textContent = newCount + ' new enquir' + (newCount === 1 ? 'y' : 'ies');
      } else if (total > 0) {
        businessEl.textContent = total + ' enquir' + (total === 1 ? 'y' : 'ies') + ' received';
      } else {
        businessEl.textContent = 'No enquiries yet';
      }
    }
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

  const ORG_BOOTSTRAP_CACHE_KEY = 'hub_org_bootstrap_cache';
  const ORG_BOOTSTRAP_CACHE_MS = 120000;

  function cacheBootstrapForEmbed(data) {
    if (!data) return;
    try {
      sessionStorage.setItem(
        ORG_BOOTSTRAP_CACHE_KEY,
        JSON.stringify({
          at: Date.now(),
          groups: data.groups || [],
          events: data.events || [],
        })
      );
    } catch {
      /* ignore */
    }
  }

  function prefetchEventsInBackground() {
    if (state.eventsFullyLoaded || state.eventsLoading || !state.eventsHasMore) return;
    ensureAllEventsForGrouping()
      .then(function () {
        renderOverviewEvents();
        if (eventsSubRoute === 'events-list') renderEvents();
      })
      .catch(function () {
        /* non-fatal */
      });
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

  function eventIsOnlineFormat(ev) {
    const fmt = String(ev.eventFormat || ev.meetingType || ev.format || '').toLowerCase();
    return /online|virtual|hybrid/.test(fmt);
  }

  function eventIsUpcomingLive(ev) {
    const st = String(ev.statusKey || ev.status || '').toLowerCase();
    if (st === 'cancelled' || st === 'archived' || st === 'draft' || st === 'unpublished') {
      return false;
    }
    const endRaw = ev.endDate || ev.date;
    const end = endRaw ? new Date(endRaw).getTime() : null;
    if (end != null && !Number.isNaN(end) && end < Date.now() - 3600000) return false;
    return true;
  }

  function eventNeedsJoinLink(ev) {
    if (!ev || !eventIsOnlineFormat(ev)) return false;
    if (!eventIsUpcomingLive(ev)) return false;
    return !String(ev.onlineLink || '').trim();
  }

  function collectEventsNeedingJoinLink(events) {
    const out = [];
    const seen = new Set();
    (events || []).forEach((ev) => {
      const consider = (row) => {
        if (!row || !row.id || seen.has(row.id)) return;
        if (!eventNeedsJoinLink(row)) return;
        seen.add(row.id);
        out.push(row);
      };
      consider(ev);
      if (ev.seriesEvents && ev.seriesEvents.length) {
        ev.seriesEvents.forEach(consider);
      }
    });
    return out.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return da - db;
    });
  }

  function joinLinkWarnHtml(ev) {
    if (!eventNeedsJoinLink(ev)) return '';
    return (
      '<span class="org-join-link-warn" title="Add a join link before the event">No join link</span>'
    );
  }

  function renderJoinLinkBanner() {
    const banner = document.getElementById('join-link-banner');
    if (!banner) return;
    const missing = collectEventsNeedingJoinLink(state.events);
    if (!missing.length) {
      banner.hidden = true;
      banner.innerHTML = '';
      return;
    }
    const preview = missing
      .slice(0, 3)
      .map((ev) => {
        const date = formatDateShort(ev.date);
        const dateSuffix =
          date && date !== '—' ? ' <span class="org-join-link-banner-date">(' + esc(date) + ')</span>' : '';
        return (
          '<button type="button" class="org-join-link-banner-link" data-edit-event="' +
          esc(ev.id) +
          '">' +
          esc(ev.title) +
          dateSuffix +
          '</button>'
        );
      })
      .join('');
    const more =
      missing.length > 3
        ? ' <span class="org-join-link-banner-more">+' + String(missing.length - 3) + ' more</span>'
        : '';
    banner.hidden = false;
    banner.innerHTML =
      '<p><strong>Join link needed</strong> — ' +
      (missing.length === 1
        ? 'This online event is missing a meeting link. Ticket holders receive the link by email once you add it.'
        : missing.length +
          ' upcoming online events are missing a meeting link. Ticket holders receive the link by email once you add it.') +
      '</p><p class="org-join-link-banner-events">' +
      preview +
      more +
      '</p>';
    banner.querySelectorAll('[data-edit-event]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit-event');
        if (id) openEventEditorDrawer(state.events.find((e) => e.id === id) || { id });
      });
    });
  }

  function formatBookingReference(registrationId) {
    const raw = String(registrationId || '')
      .replace(/-/g, '')
      .toUpperCase();
    if (raw.length >= 8) return 'HUB-' + raw.slice(0, 8);
    if (raw) return 'HUB-' + raw;
    return '—';
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
      ticketsSoldLabel: formatTicketsSoldLabel(ticketsSold, ticketsCapacity),
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
    if (ev.isSeries && ev.seriesCount > 1) {
      const key = eventSeriesBucketKey(ev);
      const expanded = expandedSeriesKeys.has(key);
      return (
        '<button type="button" class="org-series-toggle' +
        (expanded ? ' is-open' : '') +
        '" data-toggle-series="' +
        esc(key) +
        '" aria-expanded="' +
        (expanded ? 'true' : 'false') +
        '">' +
        '<span class="org-series-chev" aria-hidden="true">' +
        (expanded ? '▾' : '▸') +
        '</span> ' +
        esc(ev.title) +
        '<span class="org-series-badge">' +
        esc(String(ev.seriesCount)) +
        ' dates</span></button>' +
        joinLinkWarnHtml(ev)
      );
    }
    return (
      '<button type="button" class="org-td-name-click" data-edit-event="' +
      esc(ev.id) +
      '">' +
      esc(ev.title) +
      '</button>' +
      joinLinkWarnHtml(ev)
    );
  }

  function eventCanDelete(ev) {
    if (!ev || !ev.id || state.canDeleteEvents === false) return false;
    if (ev.locked) return false;
    if ((Number(ev.ticketsSold) || 0) > 0) return false;
    const st = String(ev.statusKey || ev.status || '').toLowerCase();
    if (st === 'cancelled') return false;
    return true;
  }

  function eventDeleteActionHtml(ev) {
    if (!eventCanDelete(ev)) return '';
    return (
      '<button type="button" class="org-action-item danger" data-delete-event="' +
      esc(ev.id) +
      '"><span class="org-action-icon">🗑</span><span class="org-action-text"><strong>Delete event</strong><span>Remove this listing permanently</span></span></button>'
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
        '<a class="org-action-item" href="../events/organiser.html?id=' +
        esc(id) +
        '" target="_blank" rel="noopener noreferrer"><span class="org-action-icon">↗</span><span class="org-action-text"><strong>View public profile</strong><span>See your group page and ranking badge</span></span></a>' +
        '<button type="button" class="org-action-item" data-add-event-for-group="' +
        esc(id) +
        '"><span class="org-action-icon">📅</span><span class="org-action-text"><strong>Add an event</strong><span>List a new event for this group</span></span></button>' +
        '<button type="button" class="org-action-item" data-duplicate-group="' +
        esc(id) +
        '"><span class="org-action-icon">⧉</span><span class="org-action-text"><strong>Duplicate group</strong><span>Create a draft copy of this profile</span></span></button>' +
        '<button type="button" class="org-action-item" data-org-goto-sub="events-reviews"><span class="org-action-icon">★</span><span class="org-action-text"><strong>Reviews</strong><span>View feedback for this group</span></span></button>' +
        unpublishBtn +
        '</div></div>'
      );
    }
    return eventActionMenuHtml(item || { id: id, title: title });
  }

  function eventActionMenuHtml(evOrId, title) {
    const ev =
      typeof evOrId === 'object' && evOrId
        ? evOrId
        : { id: evOrId, title: title || 'Event' };
    const id = ev.id;
    const shortTitle = String(ev.title || title || 'Event').slice(0, 32);
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
      eventDeleteActionHtml(ev) +
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
      eventDeleteActionHtml(ev) +
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

  function applyAttendeesDeepLinkFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const eventId = String(params.get('eventId') || params.get('event_id') || '').trim();
    if (!eventId) return;
    filters.attendeesEvent = eventId;
    filters.ticketsEvent = eventId;
    filters.cancellationsEvent = eventId;
    const attSel = document.getElementById('filter-attendees-event');
    if (attSel) attSel.value = eventId;
    const ticketSel = document.getElementById('filter-tickets-event');
    if (ticketSel) ticketSel.value = eventId;
    const cancelSel = document.getElementById('filter-cancellations-event');
    if (cancelSel) cancelSel.value = eventId;
  }

  function parseRoute() {
    const hash = (location.hash.replace('#', '') || 'dashboard').toLowerCase();
    if (hash === 'opportunity-enquiries') return { page: 'business-overview', sub: null };
    if (hash === 'events-overview') return { page: 'events-overview', sub: null };
    if (hash === 'training-overview') return { page: 'training-overview', sub: null };
    if (hash === 'business-overview') return { page: 'business-overview', sub: null };
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

  function renderAcademyPreviewGrid(gridId) {
    const grid = document.getElementById(gridId);
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

  function renderAcademyPreview() {
    renderAcademyPreviewGrid('org-academy-preview-grid');
    renderAcademyPreviewGrid('org-academy-preview-grid-hub');
  }

  function setEventsSub(sub) {
    eventsSubRoute = sub || 'events-list';
    document.querySelectorAll('[data-events-panel]').forEach((panel) => {
      panel.classList.toggle('is-active', panel.getAttribute('data-events-panel') === eventsSubRoute);
    });
    const titles = {
      'events-list': ['My Events', 'Manage all your event listings — click any event name to edit.'],
      'events-tickets': ['Tickets', 'All ticket types across your events.'],
      'events-attendees': ['Attendees', 'Registrations and OSOP applications for your events — filter by event and download a CSV.'],
      'events-cancellations': [
        'Cancellations',
        'Bookings attendees cancelled themselves — use the booking reference for Stripe or support, and check whether a refund may be due.',
      ],
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
    } else if (eventsSubRoute === 'events-cancellations') {
      fillCancellationsEventFilter();
      loadCancellationsAll().then(() => renderCancellations());
    } else {
      renderEventsPanel(eventsSubRoute);
    }
  }

  function renderEventsPanel(sub) {
    updateMyEventsTabCounts();
    fillMyEventsFilters();
    renderJoinLinkBanner();
    if (sub === 'events-list') renderEvents();
    else if (sub === 'events-tickets') renderTickets();
    else if (sub === 'events-attendees') renderAttendees();
    else if (sub === 'events-cancellations') renderCancellations();
    else if (sub === 'events-reviews') renderReviews();
    else if (sub === 'events-revenue') renderRevenue();
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

  function pendingApplicationsCount() {
    return state.attendeesAll.filter((a) => String(a.applicationStatus || '') === 'Pending').length;
  }

  function updatePendingApplicationsNavBadge() {
    const badge = document.getElementById('org-pending-applications-nav-badge');
    if (!badge) return;
    const count = pendingApplicationsCount();
    badge.hidden = count < 1;
    badge.textContent = count > 1 ? String(count) + ' pending' : 'New';
  }

  function attendeeStatusLabel(a) {
    const applicationStatus = String(a.applicationStatus || 'Approved').trim();
    if (applicationStatus === 'Pending') return 'Application pending';
    if (applicationStatus === 'Denied') return 'Application denied';
    return 'Confirmed';
  }

  function attendeeStatusBadgeHtml(a) {
    const applicationStatus = String(a.applicationStatus || 'Approved').trim();
    if (applicationStatus === 'Pending') {
      return '<span class="org-badge org-badge-gold">Pending review</span>';
    }
    if (applicationStatus === 'Denied') {
      return '<span class="org-badge org-badge-red">Denied</span>';
    }
    return '<span class="org-badge org-badge-green">Confirmed</span>';
  }

  function attendeePaidDisplay(a) {
    const applicationStatus = String(a.applicationStatus || 'Approved').trim();
    if (applicationStatus === 'Pending') return '—';
    if (applicationStatus === 'Approved' && String(a.paymentStatus || '') === 'Pending') {
      return 'Awaiting payment';
    }
    return esc(a.amountDisplay || a.paymentStatus || '—');
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
      updatePendingApplicationsNavBadge();
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
      'Status',
      'Industry',
      'Job title',
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
        attendeeStatusLabel(a),
        a.screeningIndustry || '',
        a.screeningJobTitle || '',
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

  function attendeeApplicationAnswersHtml(a) {
    const isPending = String(a.applicationStatus || '') === 'Pending';
    const industry = String(a.screeningIndustry || '').trim();
    const jobTitle = String(a.screeningJobTitle || '').trim();
    if (!isPending && !industry && !jobTitle) return '—';
    if (!industry && !jobTitle) {
      return '<span class="org-application-answers-empty">No answers recorded</span>';
    }
    const rows = [];
    if (industry) {
      rows.push(
        '<div class="org-application-answer">' +
          '<span class="org-application-answer-label">Industry</span>' +
          '<span class="org-application-answer-value">' +
          esc(industry) +
          '</span>' +
          '</div>'
      );
    }
    if (jobTitle) {
      rows.push(
        '<div class="org-application-answer">' +
          '<span class="org-application-answer-label">Job title</span>' +
          '<span class="org-application-answer-value">' +
          esc(jobTitle) +
          '</span>' +
          '</div>'
      );
    }
    return '<div class="org-application-answers">' + rows.join('') + '</div>';
  }

  function attendeeActionsHtml(a) {
    if (String(a.applicationStatus || '') !== 'Pending') return '—';
    return (
      '<div class="org-application-review">' +
      '<p class="org-application-review-label">Review application</p>' +
      '<div class="org-application-review-buttons">' +
      '<button type="button" class="org-application-approve-btn" data-approve-application="' +
      esc(a.id) +
      '"><span class="org-application-btn-icon" aria-hidden="true">✓</span>Approve</button>' +
      '<button type="button" class="org-application-deny-btn" data-deny-application="' +
      esc(a.id) +
      '"><span class="org-application-btn-icon" aria-hidden="true">✕</span>Deny</button>' +
      '</div>' +
      '<button type="button" class="org-application-resend-link" data-resend-application-alert="' +
      esc(a.id) +
      '" title="Send yourself an email about this application">Email me a copy</button>' +
      '</div>'
    );
  }

  async function resendApplicationAlert(registrationId) {
    const { ok, data } = await api('/api/organiser/application-decisions', {
      method: 'POST',
      body: JSON.stringify({ registrationId, action: 'resend_alert' }),
    });

    if (!ok || !data.ok) {
      window.alert(data.message || data.error || 'Could not send the application alert email.');
      return;
    }

    window.alert(data.message || 'Application alert email sent.');
  }

  async function reviewApplication(registrationId, action) {
    const attendee = state.attendeesAll.find((row) => row.id === registrationId);
    const name = attendee ? attendee.name : 'this applicant';
    if (action === 'deny') {
      const ok = window.confirm(
        'Deny the application from ' + name + '? They will be notified by email.'
      );
      if (!ok) return;
    }

    const { ok, data } = await api('/api/organiser/application-decisions', {
      method: 'POST',
      body: JSON.stringify({ registrationId, action }),
    });

    if (!ok || !data.ok) {
      window.alert(data.message || data.error || 'Could not update this application.');
      return;
    }

    if (attendee) {
      attendee.applicationStatus = data.applicationStatus || (action === 'approve' ? 'Approved' : 'Denied');
      if (action === 'approve' && String(data.paymentStatus || '') === 'Free') {
        attendee.paymentStatus = 'Free';
        attendee.amountDisplay = 'Free';
      } else if (action === 'approve') {
        attendee.paymentStatus = data.paymentStatus || 'Pending';
        attendee.amountDisplay = 'Awaiting payment';
      }
    }
    updatePendingApplicationsNavBadge();
    renderAttendees();
    window.alert(data.message || (action === 'approve' ? 'Application approved.' : 'Application denied.'));
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
      if (String(a.applicationStatus || '') === 'Pending') {
        tr.className = 'org-attendee-row-pending';
      }
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
        attendeeStatusBadgeHtml(a) +
        '</td><td class="org-td-application-answers">' +
        attendeeApplicationAnswersHtml(a) +
        '</td><td>' +
        attendeePaidDisplay(a) +
        '</td><td>' +
        esc(formatDateShort(a.registeredAt)) +
        '</td><td class="org-td-actions">' +
        attendeeActionsHtml(a) +
        '</td>';
      body.appendChild(tr);
    });
  }

  function filteredCancellationsList() {
    let list = state.cancellationsAll.slice();
    if (filters.cancellationsEvent !== 'all') {
      list = list.filter((row) => row.eventId === filters.cancellationsEvent);
    }
    return list;
  }

  function fillCancellationsEventFilter() {
    const sel = document.getElementById('filter-cancellations-event');
    if (!sel) return;
    sel.innerHTML = '<option value="all">All events</option>';
    allEventOptions().forEach((ev) => {
      const opt = document.createElement('option');
      opt.value = ev.id;
      opt.textContent = ev.title;
      sel.appendChild(opt);
    });
    sel.value = filters.cancellationsEvent;
  }

  async function loadCancellationsAll() {
    const hint = document.getElementById('cancellations-load-hint');
    const empty = document.getElementById('cancellations-empty');
    if (hint) {
      hint.hidden = false;
      hint.textContent = 'Loading cancellations…';
    }
    const { ok, data } = await api('/api/organiser/attendees?eventId=all&view=cancellations');
    if (hint) hint.hidden = true;
    if (ok) {
      state.cancellationsAll = data.cancellations || [];
      return true;
    }
    state.cancellationsAll = [];
    if (empty) {
      empty.hidden = false;
      empty.textContent =
        'Could not load cancellations. ' + (data.message || data.error || 'Please refresh and try again.');
    }
    return false;
  }

  function renderCancellations() {
    const body = document.getElementById('cancellations-body');
    const empty = document.getElementById('cancellations-empty');
    if (!body) return;
    const list = filteredCancellationsList();
    body.innerHTML = '';

    if (!list.length) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = state.cancellationsAll.length
          ? 'No cancellations match this event filter.'
          : 'No attendee cancellations yet. When someone cancels their own booking, it will appear here.';
      }
      updatePaginationNav('cancellations', { totalPages: 1, start: 0, end: 0, total: 0, page: 1 });
      return;
    }
    if (empty) empty.hidden = true;
    const pageInfo = paginateList(list, listPages.cancellations);
    listPages.cancellations = pageInfo.page;
    updatePaginationNav('cancellations', pageInfo);

    pageInfo.items.forEach((row) => {
      const tr = document.createElement('tr');
      const refundClass = row.refundEligible ? 'org-badge org-badge-green' : 'org-badge org-badge-purple';
      const bookingRef = row.bookingReference || formatBookingReference(row.id);
      tr.innerHTML =
        '<td class="org-td-name">' +
        esc(row.name) +
        '</td><td>' +
        esc(row.email || '—') +
        '</td><td class="org-booking-ref">' +
        esc(bookingRef) +
        '</td><td>' +
        esc(row.eventTitle) +
        '</td><td>' +
        esc(row.ticketName) +
        '</td><td>' +
        esc(row.amountDisplay || '—') +
        '</td><td>' +
        esc(formatDateShort(row.cancelledAt)) +
        '</td><td><span class="' +
        refundClass +
        '">' +
        esc(row.refundLabel || '—') +
        '</span></td>';
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
    openEventEditorDrawer(ev);
  }

  function eventEditorFrameUrl(opts) {
    const params = new URLSearchParams();
    params.set('embed', '1');
    if (opts && opts.editId) {
      params.set('id', opts.editId);
    } else {
      params.set('format', (opts && opts.format) || 'in-person');
      if (opts && opts.groupId) params.set('groupId', opts.groupId);
    }
    return 'event-edit.html?' + params.toString();
  }

  function openNewEventEditorDrawer(options) {
    options = options || {};
    let groupId = options.groupId || '';
    if (!groupId && state.groups.length === 1) {
      groupId = state.groups[0].id;
    }
    const format = options.format || 'in-person';
    try {
      if (groupId) sessionStorage.setItem('hub_event_group_id', groupId);
      else sessionStorage.removeItem('hub_event_group_id');
      sessionStorage.setItem('hub_event_format', format);
    } catch (err) {
      /* ignore */
    }
    openEventEditorDrawer(null, { isNew: true, groupId: groupId, format: format });
  }

  function goToNewEventEditor(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!state.groups.length) {
      alert('You must add a group profile first.');
      openGroupEditorDrawer();
      return;
    }
    openNewEventEditorDrawer();
  }

  let eventDrawerLoadTimeout = null;

  function setEventDrawerLoading(on) {
    const wrap = document.getElementById('org-event-drawer-frame-wrap');
    const loading = document.getElementById('org-event-drawer-loading');
    if (wrap) wrap.classList.toggle('is-loading', on);
    if (loading) {
      loading.hidden = !on;
      loading.setAttribute('aria-hidden', on ? 'false' : 'true');
      loading.setAttribute('aria-busy', on ? 'true' : 'false');
    }
    if (!on && eventDrawerLoadTimeout) {
      clearTimeout(eventDrawerLoadTimeout);
      eventDrawerLoadTimeout = null;
    }
  }

  function closeEventEditorDrawer() {
    const drawer = document.getElementById('org-event-drawer');
    const frame = document.getElementById('org-event-drawer-frame');
    if (!drawer) return;
    drawer.classList.remove('is-open');
    document.body.classList.remove('org-event-drawer-open');
    setEventDrawerLoading(false);
    if (frame) frame.removeAttribute('src');
    setTimeout(function () {
      if (!drawer.classList.contains('is-open')) {
        drawer.hidden = true;
        drawer.setAttribute('aria-hidden', 'true');
      }
    }, 280);
  }

  function eventTicketsFrameUrl(eventIds) {
    return (
      'event-tickets.html?ids=' + encodeURIComponent((eventIds || []).join(',')) + '&embed=1'
    );
  }

  function openEventDrawerFrame(frameUrl, titleText) {
    const drawer = document.getElementById('org-event-drawer');
    const frame = document.getElementById('org-event-drawer-frame');
    const titleEl = document.getElementById('org-event-drawer-title');
    if (!drawer || !frame) {
      location.href = frameUrl.replace('&embed=1', '').replace('embed=1&', '').replace('?embed=1', '?');
      return false;
    }

    closeAllActionMenus();
    if (titleEl && titleText) titleEl.textContent = titleText;
    setEventDrawerLoading(true);
    if (eventDrawerLoadTimeout) clearTimeout(eventDrawerLoadTimeout);
    eventDrawerLoadTimeout = setTimeout(function () {
      setEventDrawerLoading(false);
    }, 12000);
    frame.src = frameUrl;

    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(function () {
      drawer.classList.add('is-open');
    });
    document.body.classList.add('org-event-drawer-open');
    return true;
  }

  function openEventTicketsDrawer(eventIds, title) {
    const label = title ? 'Tickets: ' + title : 'Set up tickets';
    openEventDrawerFrame(eventTicketsFrameUrl(eventIds), label);
  }

  function openEventEditorDrawer(eventOrId, drawerOpts) {
    drawerOpts = drawerOpts || {};
    const drawer = document.getElementById('org-event-drawer');
    const frame = document.getElementById('org-event-drawer-frame');
    const titleEl = document.getElementById('org-event-drawer-title');
    const isNew = Boolean(drawerOpts.isNew);
    const editId =
      !isNew && typeof eventOrId === 'object' && eventOrId && eventOrId.id
        ? eventOrId.id
        : !isNew
          ? eventOrId || ''
          : '';

    if (!drawer || !frame) {
      if (isNew) {
        const qs = new URLSearchParams();
        qs.set('format', drawerOpts.format || 'in-person');
        if (drawerOpts.groupId) qs.set('groupId', drawerOpts.groupId);
        location.href = 'event-edit.html?' + qs.toString();
      } else {
        location.href = editId
          ? 'event-edit.html?id=' + encodeURIComponent(editId)
          : 'event-edit.html?format=in-person';
      }
      return;
    }

    let frameUrl;
    let drawerTitle = 'Edit event';
    if (isNew) {
      drawerTitle = 'New event';
      frameUrl = eventEditorFrameUrl({
        groupId: drawerOpts.groupId || '',
        format: drawerOpts.format || 'in-person',
      });
    } else {
      const ev =
        typeof eventOrId === 'object' && eventOrId
          ? eventOrId
          : findEventById(editId) || { id: editId, title: 'Event' };
      drawerTitle = ev.title ? 'Edit: ' + ev.title : 'Edit event';
      frameUrl = eventEditorFrameUrl({ editId: editId });
    }

    openEventDrawerFrame(frameUrl, drawerTitle);
  }

  async function confirmDeleteEvent(eventId) {
    if (!eventId) return;
    const ev = findEventById(eventId);
    const label = ev && ev.title ? ev.title : 'this event';
    if (
      !window.confirm(
        'Delete "' +
          label +
          '" permanently?\n\nThis cannot be undone. Events with ticket sales must be cancelled instead.'
      )
    ) {
      return;
    }
    const res = await api('/api/organiser/events', {
      method: 'DELETE',
      body: JSON.stringify({ id: eventId }),
    });
    if (!res.ok) {
      window.alert(res.data.message || res.data.error || 'Could not delete this event.');
      return;
    }
    showAirtableAlert(res.data.message || 'Event deleted.', false);
    await loadBootstrap();
    renderAll();
    setRoute('events-list');
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

  let groupEditReady = false;

  function closeGroupEditorDrawer() {
    const drawer = document.getElementById('org-group-drawer');
    if (!drawer) return;
    drawer.classList.remove('is-open');
    document.body.classList.remove('org-group-drawer-open');
    setTimeout(function () {
      if (!drawer.classList.contains('is-open')) {
        drawer.hidden = true;
        drawer.setAttribute('aria-hidden', 'true');
      }
    }, 280);
  }

  function openGroupEditorDrawer(groupOrId) {
    const drawer = document.getElementById('org-group-drawer');
    if (!drawer || !window.HubGroupEdit) {
      const id =
        typeof groupOrId === 'object' && groupOrId && groupOrId.id
          ? groupOrId.id
          : groupOrId || '';
      location.href = id ? 'group-edit.html?id=' + encodeURIComponent(id) : 'group-edit.html';
      return;
    }

    closeAllActionMenus();
    const editId =
      typeof groupOrId === 'object' && groupOrId && groupOrId.id
        ? groupOrId.id
        : groupOrId || '';

    if (!groupEditReady) {
      window.HubGroupEdit.init({
        root: drawer,
        embedded: true,
        onClose: closeGroupEditorDrawer,
        onSaved: async function () {
          await loadBootstrap();
          renderAll();
        },
      });
      groupEditReady = true;
    }

    window.HubGroupEdit.open({
      editId,
      embedded: true,
      onClose: closeGroupEditorDrawer,
      onSaved: async function () {
        await loadBootstrap();
        renderAll();
      },
    });

    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(function () {
      drawer.classList.add('is-open');
    });
    document.body.classList.add('org-group-drawer-open');
  }

  function goToGroupEditor(g) {
    openGroupEditorDrawer(g);
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
    const direct = allEvents.find((x) => x.id === id);
    if (direct) return direct;
    const grouped = groupEventsIntoSeries(allEvents);
    for (let i = 0; i < grouped.length; i++) {
      const row = grouped[i];
      if (row.isSeries && row.seriesEvents) {
        const child = row.seriesEvents.find((x) => x.id === id);
        if (child) return child;
      }
    }
    return grouped.find((row) => row.id === id) || null;
  }

  async function confirmDuplicateGroup(groupId) {
    if (!groupId) return;
    const g = findGroupById(groupId);
    const label = g && g.name ? g.name : 'this group';
    if (
      !window.confirm(
        'Create a draft copy of "' +
          label +
          '"?\n\nYou can edit the name and details before publishing.'
      )
    ) {
      return;
    }
    const res = await api('/api/organiser/groups', {
      method: 'POST',
      body: JSON.stringify({ action: 'duplicate', id: groupId }),
    });
    if (!res.ok) {
      window.alert(res.data.message || res.data.error || 'Could not duplicate this group.');
      return;
    }
    showAirtableAlert(res.data.message || 'Group duplicated.', false);
    await loadBootstrap();
    renderAll();
    setRoute('groups');
    if (res.data.group && res.data.group.id) {
      openGroupEditorDrawer(res.data.group.id);
    }
  }

  function goToAddEventForGroup(groupId) {
    if (!groupId) return;
    openNewEventEditorDrawer({ groupId: groupId });
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
      m.style.visibility = '';
      m.style.display = '';
      if (m._actionWrap) {
        m._actionWrap.appendChild(m);
        m._actionWrap = null;
      }
    });
    document.querySelectorAll('[data-org-action-toggle][aria-expanded="true"]').forEach((b) => {
      b.setAttribute('aria-expanded', 'false');
    });
  }

  function getActionMenuPortal() {
    return document.getElementById('org-action-menu-portal') || document.body;
  }

  function openActionMenu(menu, toggle) {
    const wrap = toggle.closest('.org-action-wrap');
    const portal = getActionMenuPortal();
    if (wrap && menu.parentElement !== portal) {
      menu._actionWrap = wrap;
      portal.appendChild(menu);
    }
    menu.classList.add('is-open', 'is-floating');
    toggle.setAttribute('aria-expanded', 'true');
    menu.style.visibility = 'hidden';
    menu.style.display = 'block';
    const rect = toggle.getBoundingClientRect();
    const menuW = menu.offsetWidth || 240;
    const menuH = menu.offsetHeight || 200;
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
    menu.style.bottom = 'auto';
    menu.style.visibility = '';
    requestAnimationFrame(function () {
      if (!menu.classList.contains('is-open')) return;
      const nextRect = toggle.getBoundingClientRect();
      const nextH = menu.offsetHeight || menuH;
      let nextTop = nextRect.bottom + 6;
      if (nextTop + nextH > window.innerHeight - 12) {
        nextTop = Math.max(12, nextRect.top - nextH - 6);
      }
      menu.style.top = nextTop + 'px';
    });
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
      else if (gid) openGroupEditorDrawer(gid);
      return true;
    }

    const toggleSeriesBtn = e.target.closest('[data-toggle-series]');
    if (toggleSeriesBtn) {
      e.preventDefault();
      e.stopPropagation();
      const key = toggleSeriesBtn.getAttribute('data-toggle-series');
      if (key) {
        if (expandedSeriesKeys.has(key)) expandedSeriesKeys.delete(key);
        else expandedSeriesKeys.add(key);
        renderEvents();
      }
      return true;
    }

    const deleteEventBtn = e.target.closest('[data-delete-event]');
    if (deleteEventBtn && !deleteEventBtn.disabled) {
      e.preventDefault();
      e.stopPropagation();
      closeAllActionMenus();
      confirmDeleteEvent(deleteEventBtn.getAttribute('data-delete-event'));
      return true;
    }

    const addEventGroupBtn = e.target.closest('[data-add-event-for-group]');
    if (addEventGroupBtn && !addEventGroupBtn.disabled) {
      e.preventDefault();
      e.stopPropagation();
      closeAllActionMenus();
      goToAddEventForGroup(addEventGroupBtn.getAttribute('data-add-event-for-group'));
      return true;
    }

    const duplicateGroupBtn = e.target.closest('[data-duplicate-group]');
    if (duplicateGroupBtn && !duplicateGroupBtn.disabled) {
      e.preventDefault();
      e.stopPropagation();
      closeAllActionMenus();
      confirmDuplicateGroup(duplicateGroupBtn.getAttribute('data-duplicate-group'));
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
      else if (eid) openEventEditorDrawer(eid);
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
        filters.cancellationsEvent = eventId;
        filters.reviewsGroup = 'all';
        const ticketSel = document.getElementById('filter-tickets-event');
        if (ticketSel) ticketSel.value = eventId;
        const attSel = document.getElementById('filter-attendees-event');
        if (attSel) attSel.value = eventId;
        const cancelSel = document.getElementById('filter-cancellations-event');
        if (cancelSel) cancelSel.value = eventId;
      }
      setRoute(sub || 'events-list');
      if (sub === 'events-tickets') renderTickets();
      if (sub === 'events-attendees') renderAttendees();
      if (sub === 'events-cancellations') renderCancellations();
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
      '<p><strong>Connect Stripe to sell paid tickets</strong> — you receive the full ticket price in your connected account. ' +
      'Attendees pay a booking fee at checkout (4.5% + 20p per ticket), which covers platform and payment processing.</p>' +
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

  function sidebarRouteForPage(page, sub) {
    if (page === 'events-overview') return 'events-list';
    if (page === 'training-overview') return 'academy';
    if (page === 'business-overview') return 'business-overview';
    if (page === 'events') return sub || 'events-list';
    return page;
  }

  function setRoute(route) {
    let page = route || 'dashboard';
    let sub = null;
    if (route === 'opportunity-enquiries' || route === 'business-overview') {
      page = 'business-overview';
    } else if (route === 'events-overview') {
      page = 'events-overview';
    } else if (route === 'training-overview') {
      page = 'training-overview';
    } else if (route && route.startsWith('events-')) {
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

    const activeRoute = sidebarRouteForPage(page, sub);
    document.querySelectorAll('.hub-side-nav-link[data-org-route]').forEach((a) => {
      a.classList.toggle('is-active', a.getAttribute('data-org-route') === activeRoute);
    });
    document.querySelectorAll('[data-org-page]').forEach((p) => {
      p.classList.toggle('is-active', p.getAttribute('data-org-page') === page);
    });

    if (page === 'events') {
      setEventsSub(sub || eventsSubRoute || 'events-list');
    }
    if (page === 'academy' || page === 'training-overview') {
      renderAcademyPreview();
    }
    if (page === 'team') {
      loadTeamMembers().then(function () {
      renderTeam();
      updateGettingStartedPanel();
    });
    }
    if (page === 'business-overview') {
      loadOpportunityEnquiries();
      loadOpportunitiesList();
    }

    const hash =
      page === 'events'
        ? sub || 'events-list'
        : page === 'business-overview'
          ? 'business-overview'
          : page;
    if (location.hash.replace('#', '') !== hash) {
      const url = new URL(window.location.href);
      url.hash = hash;
      history.replaceState(null, '', url.pathname + url.search + url.hash);
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
      goToNewEventEditor();
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
        '</button>' +
        groupRankingBadgeHtml(g.id) +
        '</td><td>' +
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
        '</button>' +
        groupRankingBadgeHtml(g.id) +
        '</td><td>' +
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

  function appendEventTableRow(body, ev, options) {
    const opts = options || {};
    const isChild = Boolean(opts.isChild);
    const tr = document.createElement('tr');
    if (isChild) tr.className = 'org-series-child-row';
    else if (ev.isSeries && ev.seriesCount > 1) tr.className = 'org-series-parent-row';

    const revClass = ev.revenueNum > 0 ? 'org-revenue' : 'org-revenue muted';
    let nameHtml;
    if (isChild) {
      nameHtml =
        '<span class="org-series-child-label" aria-hidden="true">↳</span>' +
        '<button type="button" class="org-td-name-click org-series-child-name" data-edit-event="' +
        esc(ev.id) +
        '">' +
        esc(formatDateShort(ev.date) || 'Date TBC') +
        '</button>';
    } else {
      nameHtml = eventTitleCellHtml(ev);
    }

    tr.innerHTML =
      '<td>' +
      (isChild ? '<span class="org-series-child-thumb" aria-hidden="true"></span>' : thumbHtml(ev)) +
      '</td><td class="org-td-name' +
      (isChild ? ' org-td-name--series-child' : '') +
      '">' +
      nameHtml +
      '</td><td>' +
      esc(isChild ? formatDateShort(ev.date) : formatEventDateCell(ev)) +
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
    return tr;
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
      appendEventTableRow(body, ev);
      if (ev.isSeries && ev.seriesCount > 1 && ev.seriesEvents && ev.seriesEvents.length) {
        const key = eventSeriesBucketKey(ev);
        if (expandedSeriesKeys.has(key)) {
          ev.seriesEvents.forEach((child) => {
            appendEventTableRow(body, child, { isChild: true });
          });
        }
      }
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
    renderReviewsRankingPill();

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
        '</div></div>' +
        (r.body
          ? '<div class="org-review-body">"' + esc(r.body) + '"</div>'
          : '<p class="org-review-body org-review-body--rating-only">Rating only — no written feedback</p>') +
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

  function renderMyEventsHub(sub) {
    renderEventsPanel(sub || eventsSubRoute);
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
        updateGettingStartedPanel();
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
            updateGettingStartedPanel();
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
            updateGettingStartedPanel();
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

  function gettingStartedProgress() {
    const hasGroup = state.groups.length > 0;
    const hasEvent = hasListedEvents();
    const hasTeam = (state.teamMembers || []).some(function (m) {
      return m.role === 'editor' || (m.status === 'pending' && !m.isAccountOwner);
    });
    return { hasGroup, hasEvent, hasTeam };
  }

  function updateGettingStartedPanel() {
    const panel = document.getElementById('org-getting-started');
    if (!panel) return;

    try {
      if (localStorage.getItem('hub_getting_started_dismissed') === '1') {
        panel.hidden = true;
        return;
      }
    } catch (err) {
      /* ignore */
    }

    if ((state.pendingClaimGroups || []).length > 0) {
      panel.hidden = true;
      return;
    }

    const progress = gettingStartedProgress();
    const flags = [progress.hasGroup, progress.hasEvent, progress.hasTeam];
    const doneCount = flags.filter(Boolean).length;
    const allDone = doneCount >= 3;

    panel.hidden = false;

    const titleEl = panel.querySelector('.org-getting-started-title');
    if (titleEl) {
      if (allDone) titleEl.textContent = "You're all set";
      else if (doneCount === 0) titleEl.textContent = "Here's what to do first";
      else titleEl.textContent = "Here's what's next";
    }
    panel.classList.toggle('is-complete', allDone);

    const progressHint = document.getElementById('org-getting-started-progress');
    if (progressHint) {
      if (allDone) {
        progressHint.textContent =
          'Setup complete — you can dismiss this checklist whenever you like.';
      } else {
        const remaining = 3 - doneCount;
        progressHint.textContent =
          doneCount === 0
            ? '3 steps to get your workspace ready.'
            : remaining === 1
              ? '1 step left on your setup checklist.'
              : remaining + ' steps left on your setup checklist.';
      }
    }

    const stepDone = {
      group: progress.hasGroup,
      event: progress.hasEvent,
      team: progress.hasTeam,
    };
    let nextMarked = false;

    panel.querySelectorAll('[data-getting-step]').forEach(function (li) {
      const key = li.getAttribute('data-getting-step');
      const done = Boolean(stepDone[key]);
      li.classList.toggle('is-done', done);
      li.classList.toggle('is-next', !done && !nextMarked);
      if (!done && !nextMarked) nextMarked = true;

      const btn = li.querySelector('[data-org-getting-action]');
      if (btn) btn.hidden = done;

      let badge = li.querySelector('.org-getting-done-badge');
      if (done) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'org-getting-done-badge';
          badge.textContent = 'Done ✓';
          li.appendChild(badge);
        }
      } else if (badge) {
        badge.remove();
      }
    });
  }

  /** @deprecated use updateGettingStartedPanel */
  function updateGettingStartedVisibility() {
    updateGettingStartedPanel();
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
        const groupId = state.groups.length ? state.groups[0].id : '';
        openNewEventEditorDrawer({ groupId: groupId });
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
    const navBadge = document.getElementById('org-opp-enquiry-nav-badge');

    if (navBadge) {
      navBadge.hidden = newCount < 1;
      navBadge.textContent = newCount > 1 ? String(newCount) + ' new' : 'New';
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

  async function loadOpportunitiesList() {
    if (state.opportunitiesLoaded) return;
    try {
      const { ok, data } = await api('/api/organiser/opportunities');
      if (!ok) return;
      state.opportunities = data.opportunities || [];
      state.opportunitiesLoaded = true;
      renderStats();
    } catch {
      /* ignore */
    }
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
    renderOrganiserRankingShare();
    renderOverviewGroups();
    renderOverviewEvents();
    renderGroups();
    renderTeam();
    renderMyEventsHub();
    fillEventSelect(document.getElementById('ticket-event'));
    updateOpportunityEnquiryUi();
    updateGettingStartedPanel();
  }

  function setDashboardLoading(on) {
    const el = document.getElementById('org-dash-loading');
    if (!el) return;
    el.hidden = !on;
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-hidden', on ? 'false' : 'true');
    el.setAttribute('aria-busy', on ? 'true' : 'false');
    document.body.classList.toggle('hub-is-page-loading', on);
  }

  async function loadBootstrap(options) {
    const silent = Boolean(options && options.silent);
    if (!silent) setDashboardLoading(true);
    try {
    const { ok, data } = await api('/api/organiser/bootstrap');
    if (!ok) throw new Error(data.message || data.error || 'load_failed');
    cacheBootstrapForEmbed(data);
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
    state.groupRankings = data.groupRankings || {};
    state.workspaceSummary =
      data.workspaceSummary && data.workspaceSummary.computed ? data.workspaceSummary : null;
    state.eventSummaries = data.eventSummaries || [];
    loadAttendeesAll();
    if (eventsSubRoute === 'events-cancellations') {
      loadCancellationsAll().then(() => renderCancellations());
    }
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
    loadTeamMembers().then(function () {
      renderTeam();
      updateGettingStartedPanel();
    });

    if (data.adminView) {
      showAirtableAlert(
        '<strong>Admin view</strong> — showing all group profiles, events, training sessions, and ticket types across the platform.' +
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
        'Create your first <strong>group profile</strong> (under My events in the sidebar), then add events and ticket types.',
        false
      );
    } else if (!data.adminView) {
      showAirtableAlert(null);
    }

    applyPendingGroupSave();
    renderAll();
    renderGroupClaimModal();
    loadOpportunityEnquiries();
    loadOpportunitiesList();
    updateTeamNavBadge();
    if (window.HubOrganiserOnboarding && window.HubOrganiserOnboarding.initAfterDashboardReady) {
      window.HubOrganiserOnboarding.initAfterDashboardReady();
    }
    prefetchEventsInBackground();
    } finally {
      if (!silent) setDashboardLoading(false);
    }
  }

  async function refresh() {
    await loadBootstrap({ silent: true });
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

  function countWords(text) {
    return String(text || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  function bindGroupDescriptionCounter() {
    const ta = document.getElementById('group-description');
    const counter = document.getElementById('group-description-word-count');
    const maxEl = document.getElementById('group-description-word-max');
    if (maxEl) maxEl.textContent = String(DESCRIPTION_MAX_WORDS);
    if (!ta || !counter) return;
    const update = () => {
      counter.textContent = String(countWords(ta.value));
    };
    ta.addEventListener('input', update);
    update();
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
    bindGroupDescriptionCounter();

    document.getElementById('form-group').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('group-name').value.trim();
      const description = document.getElementById('group-description').value.trim();
      if (countWords(description) > DESCRIPTION_MAX_WORDS) {
        alert('Description must be ' + DESCRIPTION_MAX_WORDS + ' words or fewer.');
        return;
      }
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
    document.querySelectorAll('[data-hub-switch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-hub-switch');
        if (!mode || !window.HubModeSwitch || !window.HubModeSwitch.switchTo) return;
        btn.disabled = true;
        window.HubModeSwitch.switchTo(mode, '../').catch(() => {
          btn.disabled = false;
        });
      });
    });

    document.querySelectorAll('[data-org-modal-close]').forEach((el) => {
      el.addEventListener('click', closeModals);
    });

    function goToNewGroupEditor(e) {
      if (e && e.preventDefault) e.preventDefault();
      openGroupEditorDrawer();
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
        else if (
          route === 'events-tickets' ||
          route === 'events-list' ||
          route === 'events-attendees' ||
          route === 'events-cancellations' ||
          route === 'events-reviews' ||
          route === 'events-revenue'
        ) {
          renderMyEventsHub(route);
        } else if (route === 'team') {
          loadTeamMembers().then(function () {
      renderTeam();
      updateGettingStartedPanel();
    });
        } else if (route === 'academy') {
          renderAcademyPreview();
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

    const cancellationsEventFilter = document.getElementById('filter-cancellations-event');
    if (cancellationsEventFilter) {
      cancellationsEventFilter.addEventListener('change', () => {
        filters.cancellationsEvent = cancellationsEventFilter.value;
        listPages.cancellations = 1;
        renderCancellations();
      });
    }

    const btnDownloadAttendees = document.getElementById('btn-download-attendees-csv');
    if (btnDownloadAttendees) {
      btnDownloadAttendees.addEventListener('click', exportAttendeesCsv);
    }

    const attendeesBody = document.getElementById('attendees-body');
    if (attendeesBody && !attendeesBody.dataset.reviewBound) {
      attendeesBody.dataset.reviewBound = '1';
      attendeesBody.addEventListener('click', (e) => {
        const approveBtn = e.target.closest('[data-approve-application]');
        const denyBtn = e.target.closest('[data-deny-application]');
        const resendBtn = e.target.closest('[data-resend-application-alert]');
        if (approveBtn) {
          reviewApplication(approveBtn.getAttribute('data-approve-application'), 'approve');
          return;
        }
        if (denyBtn) {
          reviewApplication(denyBtn.getAttribute('data-deny-application'), 'deny');
          return;
        }
        if (resendBtn) {
          resendApplicationAlert(resendBtn.getAttribute('data-resend-application-alert'));
        }
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
      if (listKey === 'cancellations') renderCancellations();
      if (listKey === 'revenue') renderRevenue();
      nav.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    document.querySelectorAll('a[href="group-edit.html"]').forEach((link) => {
      link.addEventListener('click', goToNewGroupEditor);
    });

    document.querySelectorAll('[data-org-group-drawer-close]').forEach((el) => {
      el.addEventListener('click', closeGroupEditorDrawer);
    });

    document.querySelectorAll('[data-org-event-drawer-close]').forEach((el) => {
      el.addEventListener('click', closeEventEditorDrawer);
    });

    const eventDrawerHelp = document.getElementById('org-event-drawer-help');
    if (eventDrawerHelp) {
      eventDrawerHelp.addEventListener('click', () => {
        const frame = document.getElementById('org-event-drawer-frame');
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage({ type: 'hub-open-hubert-help' }, window.location.origin);
        }
      });
    }

    window.addEventListener('message', (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data && e.data.type === 'hub-event-saved') {
        closeEventEditorDrawer();
        loadBootstrap().then(renderAll);
        return;
      }
      if (e.data && e.data.type === 'hub-event-drawer-ready') {
        setEventDrawerLoading(false);
        return;
      }
      if (e.data && e.data.type === 'hub-event-goto-tickets') {
        const ids = Array.isArray(e.data.eventIds) ? e.data.eventIds : [];
        if (ids.length) openEventTicketsDrawer(ids, e.data.title || '');
        return;
      }
      if (e.data && e.data.type === 'hub-event-tickets-done') {
        closeEventEditorDrawer();
        loadBootstrap({ silent: true }).then(renderAll);
        setRoute('events-list');
        return;
      }
      if (e.data && e.data.type === 'hub-event-goto-edit') {
        const editId = e.data.eventId || '';
        if (editId) openEventEditorDrawer(editId);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const eventDrawer = document.getElementById('org-event-drawer');
        if (eventDrawer && !eventDrawer.hidden && eventDrawer.classList.contains('is-open')) {
          closeEventEditorDrawer();
          return;
        }
        const drawer = document.getElementById('org-group-drawer');
        if (drawer && !drawer.hidden && drawer.classList.contains('is-open')) {
          closeGroupEditorDrawer();
          return;
        }
        closeModals();
      }
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
    setDashboardLoading(true);
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
    applyAttendeesDeepLinkFromUrl();
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
      setDashboardLoading(false);
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
