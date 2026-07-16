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
  let eventsGroupingPromise = null;
  let bootstrapReady = false;
  let attendeesLoadingPromise = null;
  let teamLoadingPromise = null;
  let eventsLoadingPromise = null;
  let reviewsLoadingPromise = null;

  const filters = {
    eventsStatus: 'all',
    eventsType: 'all',
    eventsSearch: '',
    eventsHideArchived: true,
    eventsSortColumn: 'date',
    eventsSortDir: 'asc',
    groupsStatus: 'all',
    groupsSearch: '',
    ticketsEvent: 'all',
    ticketsType: 'all',
    ticketsScope: 'current',
    reviewsGroup: 'all',
    attendeesEvent: 'all',
    attendeesSearch: '',
    attendeesStatus: 'all',
    attendeesHideArchived: true,
    attendeesPendingOnly: false,
    attendeesRelationship: 'all',
    attendeesView: 'active',
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
    eventsLoaded: false,
    eventsFullyLoaded: false,
    tickets: [],
    attendeesAll: [],
    attendeesLoaded: false,
    pendingApplicationsCount: 0,
    pendingApplicationsPreview: [],
    cancellationsAll: [],
    reviews: [],
    reviewsLoaded: false,
    groupRankings: {},
    teamMembers: [],
    teamLoaded: false,
    teamMax: 10,
    teamCount: 0,
    teamSlotsRemaining: 10,
    useTeamWorkspace: false,
    workspaceSummary: null,
    eventSummaries: [],
    groupsError: null,
    airtable: null,
    canManageTeam: true,
    canDeleteEvents: true,
    canManagePayments: true,
    canCreateGroups: true,
    organiserRole: 'owner',
    opportunityEnquiries: [],
    opportunityEnquiriesNewCount: 0,
    opportunityEnquiriesLoaded: false,
    opportunities: [],
    opportunitiesLoaded: false,
    pendingClaimGroups: [],
    organiserAccess: false,
    organiserEmailVerified: false,
    dashboardScope: null,
  };

  let groupClaimRejectMode = false;

  const ORGANISER_SCOPE_COOKIE = 'hub_organiser_scope';
  const signin = document.getElementById('org-signin');
  const shell = document.getElementById('org-shell');
  const alertEl = document.getElementById('org-dashboard-alert');

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
    if (!state.eventsLoaded) return '—';
    const sum = state.events.reduce((s, ev) => s + (ev.revenueNum || 0), 0);
    return formatGbpAmount(sum);
  }

  function eventRevenueCellHtml(ev) {
    const amount = ev.revenueDisplay || '£0';
    const sold = Number(ev.ticketsSold) || 0;
    const revenueNum = Number(ev.revenueNum) || 0;
    const refundsPending =
      sold > 0 &&
      revenueNum === 0 &&
      (ev.needsRefundConfirmation ||
        ev.payoutHeld ||
        String(ev.statusKey || ev.status || '').toLowerCase() === 'cancelled');
    if (refundsPending) {
      return (
        esc(amount) +
        '<span class="org-payout-held-note">Refunds on the way — not counted in revenue</span>'
      );
    }
    return esc(amount);
  }

  function eventOccurrenceRaw(ev) {
    if (!ev) return null;
    return ev.date || ev.startsAt || ev.starts_at || ev.eventDate || null;
  }

  function eventEndRaw(ev) {
    if (!ev) return null;
    return ev.endDate || ev.endsAt || ev.ends_at || null;
  }

  function groupNameForEvent(ev) {
    const groupId = ev && (ev.organiserId || ev.organiserGroupId || ev.groupId);
    if (!groupId || !state.groups || !state.groups.length) return '';
    const group = state.groups.find(function (g) {
      return g.id === groupId;
    });
    return group && group.name ? String(group.name).trim() : '';
  }

  function allEventOptions() {
    const eventsById = new Map(
      (state.events || []).map(function (ev) {
        return [ev.id, ev];
      })
    );
    const base =
      state.eventSummaries && state.eventSummaries.length
        ? state.eventSummaries.slice()
        : (state.events || []).map(function (ev) {
            return {
              id: ev.id,
              title: ev.title,
              date: ev.date || null,
              endDate: ev.endDate || null,
              organiserId: ev.organiserId || ev.organiserGroupId || null,
              statusKey: ev.statusKey || ev.status || null,
            };
          });
    const seen = new Set();
    const options = [];
    base.forEach(function (ev) {
      const id = ev && ev.id;
      if (!id || seen.has(id)) return;
      seen.add(id);
      const full = eventsById.get(id);
      options.push({
        id: id,
        title: (full && full.title) || ev.title,
        date: (full && full.date) || ev.date || null,
        endDate: (full && full.endDate) || ev.endDate || null,
        organiserId:
          (full && (full.organiserId || full.organiserGroupId)) ||
          ev.organiserId ||
          null,
        statusKey: (full && (full.statusKey || full.status)) || ev.statusKey || null,
        statusLabel: (full && full.statusLabel) || ev.statusLabel || null,
      });
    });
    return options;
  }

  /** Distinct label for filters/tables when many listings share the same title. */
  function eventFilterOptionLabel(ev, options) {
    const opts = options || {};
    const title = String((ev && ev.title) || 'Untitled event').trim() || 'Untitled event';
    const raw = eventOccurrenceRaw(ev);
    const dateLabel = raw ? formatDateShort(raw) : '';
    const timeLabel = raw ? formatTimeShort(raw) : '';
    const parts = [title];
    if (dateLabel && dateLabel !== '—') {
      parts.push(opts.includeTime && timeLabel ? dateLabel + ', ' + timeLabel : dateLabel);
    } else {
      parts.push('No date');
    }
    if (opts.groupName) parts.push(opts.groupName);
    return parts.join(' · ');
  }

  function eventLabelForRow(row) {
    if (!row) return 'Event';
    if (row.eventDate) {
      return eventFilterOptionLabel({ title: row.eventTitle, date: row.eventDate });
    }
    const match = allEventOptions().find((e) => e.id === row.eventId);
    if (match) {
      return eventFilterOptionLabel({
        title: row.eventTitle || match.title,
        date: match.date,
      });
    }
    return String(row.eventTitle || 'Event').trim();
  }

  function renderStats() {
    const rev = totalRevenueDisplay();
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('stat-events', String(state.eventsTotal || state.events.length));
    set('stat-tickets', state.eventsLoaded || hasComputedWorkspaceSummary() ? String(totalTicketsSold()) : '—');
    set('stat-revenue', rev);

    const enquiries = state.opportunityEnquiries || [];
    set('stat-opp-enquiries', String(enquiries.length));
    set('stat-opp-enquiries-new', String(state.opportunityEnquiriesNewCount || 0));
    const liveListings = (state.opportunities || []).filter(function (o) {
      const status = String(o.status || o.listingStatus || '').toLowerCase();
      return status === 'published' || status === 'live';
    }).length;
    set('stat-opp-listings', String(liveListings));
    set(
      'stat-opp-saves',
      String(
        (state.opportunities || []).reduce(function (sum, o) {
          return sum + (Number(o.saveCount) || 0);
        }, 0)
      )
    );

    renderHubPortalMeta();
    renderOrganiserRankingBanner();
    renderOrganiserRankingShareIfNeeded();
  }

  function renderOrganiserRankingShareIfNeeded() {
    const socialActive = document.querySelector('[data-org-page="social"].is-active');
    const eventsActive = document.querySelector('[data-org-page="events"].is-active');
    if (socialActive || eventsActive) renderOrganiserRankingShare();
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

  function groupPublicProfileUrl(groupId, slug) {
    const s = String(slug || '').trim();
    if (s) return '../organisers/' + encodeURIComponent(s);
    return '../events/organiser?id=' + encodeURIComponent(groupId);
  }

  function groupPublicProfileAbsUrl(groupId, slug) {
    const origin = location.origin || 'https://www.thenetworkerhub.com';
    const s = String(slug || '').trim();
    if (s) return origin + '/organisers/' + encodeURIComponent(s);
    return origin + '/events/organiser?id=' + encodeURIComponent(groupId);
  }

  function rankingShareText(groupName, row) {
    const badge = rankingBadgeText(row);
    const absUrl = groupPublicProfileAbsUrl(row.id, row.slug);
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
    const shareText = rankingShareText(g.name, { ...row, id: g.id, slug: g.slug || row.slug });
    const profileUrl = groupPublicProfileAbsUrl(g.id, g.slug);
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
      esc(groupPublicProfileUrl(g.id, g.slug)) +
      '" target="_blank" rel="noopener noreferrer">View public profile</a>' +
      '<a class="org-btn org-btn-outline org-btn-sm" href="#org-linkedin-posts">Build a LinkedIn post image</a>' +
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
    const el = document.getElementById('org-ranking-panel-events-summary');
    if (!el) return;
    el.textContent = summaryText ? ' — ' + summaryText : '';
  }

  function renderOrganiserRankingShare() {
    const shareRoot = document.getElementById('org-ranking-share-events');
    const cardsEl = document.getElementById('org-ranking-share-cards');
    const examplesEl = document.getElementById('org-ranking-tier-examples');
    const groupsMount = document.getElementById('org-ranking-share-groups-mount');
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

    if (eventsPanel) eventsPanel.hidden = !ranked.length;

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
          '<p class="org-section-sub">Share on social media — open <a href="#events-list">My events</a> for the full preview.</p>' +
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

  let linkedInPostBuilder = null;

  function isSocialPageActive() {
    return Boolean(document.querySelector('[data-org-page="social"].is-active'));
  }

  function ensureLinkedInPostBuilder(options) {
    options = options || {};
    const root = document.getElementById('org-post-builder-root');
    if (!root || !window.HubLinkedInPostBuilder) return;
    if (!options.force && !isSocialPageActive()) return;
    if (!linkedInPostBuilder) {
      linkedInPostBuilder = window.HubLinkedInPostBuilder.init(root, {
        getGroups: function () {
          return state.groups || [];
        },
        getOpportunities: function () {
          return state.opportunities || [];
        },
        getEvents: function () {
          return state.events || [];
        },
      });
    } else if (options.force || isSocialPageActive()) {
      if (linkedInPostBuilder.refreshGroups) linkedInPostBuilder.refreshGroups();
      if (linkedInPostBuilder.refreshOpportunities) linkedInPostBuilder.refreshOpportunities();
      if (linkedInPostBuilder.refreshEvents) linkedInPostBuilder.refreshEvents();
    }
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
    ['org-events-ranking-banner'].forEach((id) => {
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

    const eventsPanel = document.getElementById('org-ranking-panel-events');
    const hasRanking = Boolean(best);
    if (eventsPanel) eventsPanel.hidden = !hasRanking;
    if (hasRanking) {
      updateRankingPanelSummaries(rankingBadgeText(best));
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
    const businessEl = document.getElementById('hub-portal-meta-business');
    if (eventsEl) {
      const n = state.eventsTotal || state.events.length;
      const rev = totalRevenueDisplay();
      const pendingApps = pendingApplicationsCount();
      let text = n + ' event' + (n === 1 ? '' : 's') + ' · ' + rev + ' revenue';
      if (pendingApps > 0) {
        text +=
          ' · ' +
          pendingApps +
          ' application' +
          (pendingApps === 1 ? '' : 's') +
          ' to review';
      }
      eventsEl.textContent = text;
    }
    if (businessEl) {
      if (!state.opportunityEnquiriesLoaded) {
        businessEl.textContent = 'Open to view enquiries';
        return;
      }
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

  function setOrgEmpty(el, options) {
    if (!el) return;
    const opts = options || {};
    const show = Boolean(opts.show);
    el.hidden = !show;
    if (!show) return;
    if (!el.classList.contains('org-empty-state')) {
      if (opts.text != null) el.textContent = opts.text;
      return;
    }
    const titleEl = el.querySelector('.org-empty-state-title');
    const textEl = el.querySelector('.org-empty-state-text');
    const actionsEl = el.querySelector('.org-empty-state-actions');
    if (titleEl && opts.title != null) titleEl.textContent = opts.title;
    if (textEl && opts.text != null) textEl.textContent = opts.text;
    if (actionsEl && opts.hideActions != null) actionsEl.hidden = Boolean(opts.hideActions);
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
  const SERIES_STORAGE_KEY = 'hub_event_series';

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
    if (!document.querySelector('[data-org-page="events"].is-active')) return;
    ensureAllEventsForGrouping()
      .then(function () {
        renderOverviewEvents();
        if (eventsSubRoute === 'events-list') renderEvents();
      })
      .catch(function () {
        /* non-fatal */
      });
  }

  function maybePrefetchEvents() {
    if (!document.querySelector('[data-org-page="events"].is-active')) return;
    prefetchEventsInBackground();
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

  function formatTimeShort(raw) {
    if (!raw) return '';
    if (window.HubEventTimezone && typeof window.HubEventTimezone.formatTime === 'function') {
      return window.HubEventTimezone.formatTime(raw);
    }
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/London',
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

  function buildOrganiserNotices() {
    const notices = [];

    const scope = state.dashboardScope;
    if (scope) {
      if (scope.kind === 'admin') {
        notices.push({
          id: 'scope-admin',
          type: 'info',
          title: "You're viewing the whole platform (admin)",
          text:
            'Every organiser\'s groups, events, and ticket types are visible here. Switch back when you want to work on your own account only.',
          actions:
            '<button type="button" class="org-btn org-btn-primary org-btn-sm" id="btn-scope-my">Show only my organiser data</button>',
        });
      } else if (scope.kind === 'personal_admin') {
        notices.push({
          id: 'scope-personal',
          type: 'info',
          title: 'Your organiser account only',
          text:
            'This workspace shows groups and events linked to <strong>' +
            esc(state.user?.email || 'your account') +
            '</strong> — not the full admin view across all organisers.',
          actions:
            '<button type="button" class="org-btn org-btn-outline org-btn-sm" id="btn-scope-all">View all organisers (admin)</button>',
        });
      } else if (scope.kind === 'groups_error') {
        notices.push({
          id: 'groups-error',
          type: 'error',
          title: 'Could not load your organiser pages',
          text: esc(scope.message || 'Please refresh the page or try again shortly.'),
        });
      } else if (scope.kind === 'onboarding') {
        notices.push({
          id: 'onboarding',
          type: 'info',
          title: 'Set up your organiser workspace',
          text:
            'Start with your <strong>organiser page</strong> — your public page on the hub for your group, business, or brand. Then you can list events, add ticket types, and manage bookings.',
          actions:
            '<a class="org-btn org-btn-gold org-btn-sm" href="/organiser/group-edit">Create organiser page</a>',
        });
      }
    }

    const missingJoin = collectEventsNeedingJoinLink(state.events);
    if (missingJoin.length) {
      const preview = missingJoin
        .slice(0, 3)
        .map((ev) => {
          const date = formatDateShort(ev.date);
          const dateSuffix =
            date && date !== '—' ? ' <span class="org-notice-chip-date">(' + esc(date) + ')</span>' : '';
          return (
            '<button type="button" class="org-notice-chip" data-edit-event="' +
            esc(ev.id) +
            '">' +
            esc(ev.title) +
            dateSuffix +
            '</button>'
          );
        })
        .join('');
      const more =
        missingJoin.length > 3
          ? '<span class="org-notice-chip-more">+' + String(missingJoin.length - 3) + ' more</span>'
          : '';
      const first = missingJoin[0];
      notices.push({
        id: 'join-links',
        type: 'warning',
        title:
          missingJoin.length === 1
            ? 'Add a meeting link before your online event'
            : 'Add meeting links for ' + missingJoin.length + ' online events',
        text:
          missingJoin.length === 1
            ? '“' +
              esc(first.title || 'Your event') +
              '” is online but has no join URL yet. Ticket holders will not receive joining instructions by email until you paste the meeting link in the event editor.'
            : missingJoin.length +
              ' upcoming online events are missing a join URL. Attendees need this link by email before each event starts — open each event below to add it.',
        actions: '<div class="org-notice-chips">' + preview + more + '</div>',
      });
    }

    const pending = pendingApplicationsList();
    const pendingCount = pendingApplicationsCount();
    if (pendingCount) {
      const preview = pending
        .slice(0, 3)
        .map((a) => {
          return (
            '<button type="button" class="org-notice-chip" data-review-application="' +
            esc(a.id) +
            '">' +
            esc(a.name || 'Applicant') +
            ' · ' +
            esc(a.eventTitle || 'Event') +
            '</button>'
          );
        })
        .join('');
      const more =
        pendingCount > 3
          ? '<span class="org-notice-chip-more">+' + String(pendingCount - 3) + ' more</span>'
          : '';
      const first = pending[0];
      notices.push({
        id: 'applications',
        type: 'action',
        title:
          pendingCount === 1
            ? 'Category Exclusivity application needs your decision'
            : pendingCount + ' Category Exclusivity applications need your decision',
        text:
          pendingCount === 1
            ? '<strong>' +
              esc(first.name || 'Someone') +
              '</strong> applied for a seat at <strong>' +
              esc(first.eventTitle || 'your event') +
              '</strong>. Check their industry and job title match your event rules, then approve or decline their seat.'
            : 'People have applied for seats at your Category Exclusivity events. Review each applicant\'s industry and job title, then approve or decline before the event.',
        actions:
          '<div class="org-notice-chips">' +
          preview +
          more +
          '</div><button type="button" class="org-btn org-btn-gold org-btn-sm" data-org-route="events-attendees">Open attendees &amp; applications</button>',
      });
    }

    const refillOps = seatRefillOpportunities();
    if (refillOps.length) {
      const totalArchived = refillOps.reduce((sum, op) => sum + op.archivedCount, 0);
      const totalOpen = refillOps.reduce((sum, op) => sum + op.openSeats, 0);
      notices.push({
        id: 'seat-refill',
        type: 'action',
        title:
          refillOps.length === 1
            ? 'Seat available — archived applications to review'
            : totalOpen + ' seats available across your Category Exclusivity events',
        text:
          refillOps.length === 1
            ? '<strong>' +
              esc(refillOps[0].eventTitle) +
              '</strong> has ' +
              (refillOps[0].openSeats === 1 ? '1 seat' : refillOps[0].openSeats + ' seats') +
              ' open and ' +
              (refillOps[0].archivedCount === 1
                ? '1 archived application'
                : refillOps[0].archivedCount + ' archived applications') +
              ' you can reconsider.'
            : 'You have archived applicants who may fit open seats. Review archived applications in Attendees.',
        actions:
          '<button type="button" class="org-btn org-btn-gold org-btn-sm" data-org-route="events-attendees" data-attendees-archive="1">Review archived applications</button>',
      });
    }

    const paymentState = paymentSetupStateFromDashboard();
    if (paymentState.needsSetup && paymentState.primaryGroup) {
      const groupName = esc(paymentState.primaryGroup.name || 'your group');
      notices.push({
        id: 'payment-setup',
        type: 'action',
        title: 'Complete payment setup to receive payouts',
        text:
          'Stripe Connect is not finished for <strong>' +
          groupName +
          '</strong>. Connect your bank account so ticket revenue can reach you after each event.',
        actions:
          '<button type="button" class="org-btn org-btn-gold org-btn-sm" data-org-route="events-revenue">Open revenue &amp; setup</button>',
      });
    }

    const newEnquiries = Number(state.opportunityEnquiriesNewCount) || 0;
    if (newEnquiries > 0) {
      notices.push({
        id: 'opp-enquiries',
        type: 'action',
        title:
          newEnquiries === 1
            ? '1 new business opportunity enquiry'
            : newEnquiries + ' new business opportunity enquiries',
        text:
          newEnquiries === 1
            ? 'A member sent a message about one of your opportunity listings. Reply from your workspace while the lead is still warm.'
            : 'Members have sent new messages about your opportunity listings. Review and reply from Enquiries received.',
        actions:
          '<button type="button" class="org-btn org-btn-gold org-btn-sm" data-org-route="business-overview">View enquiries</button>',
      });
    }

    return notices;
  }

  function organiserNoticeBadgeCount(notices) {
    return (notices || []).filter(function (n) {
      return n.type === 'action' || n.type === 'warning' || n.type === 'error';
    }).length;
  }

  function updateNotificationsNavBadge(notices) {
    const badge = document.getElementById('org-notifications-count');
    const navBtn = document.getElementById('org-notifications-nav');
    const count = organiserNoticeBadgeCount(notices);
    if (badge) {
      badge.hidden = count < 1;
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.setAttribute('aria-hidden', count < 1 ? 'true' : 'false');
    }
    if (navBtn) {
      navBtn.setAttribute(
        'aria-label',
        count > 0 ? 'Notifications, ' + count + ' need action' : 'Notifications'
      );
    }
  }

  let notificationsPanelBound = false;
  let notificationsPanelOpen = false;

  function openNotificationsPanel() {
    const panel = document.getElementById('org-notifications-panel');
    const navBtn = document.getElementById('org-notifications-nav');
    if (!panel) return;
    renderOrganiserNotices();
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('org-notifications-open');
    notificationsPanelOpen = true;
    if (navBtn) {
      navBtn.setAttribute('aria-expanded', 'true');
      navBtn.classList.add('is-panel-open');
    }
    const closeBtn = document.getElementById('org-notifications-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeNotificationsPanel() {
    const panel = document.getElementById('org-notifications-panel');
    const navBtn = document.getElementById('org-notifications-nav');
    if (!panel) return;
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('org-notifications-open');
    notificationsPanelOpen = false;
    if (navBtn) {
      navBtn.setAttribute('aria-expanded', 'false');
      navBtn.classList.remove('is-panel-open');
    }
  }

  function bindNotificationsPanelOnce() {
    if (notificationsPanelBound) return;
    notificationsPanelBound = true;
    document.getElementById('org-notifications-nav')?.addEventListener('click', function () {
      if (notificationsPanelOpen) closeNotificationsPanel();
      else openNotificationsPanel();
    });
    document.getElementById('org-notifications-close')?.addEventListener('click', closeNotificationsPanel);
    document.getElementById('org-notifications-backdrop')?.addEventListener('click', closeNotificationsPanel);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && notificationsPanelOpen) closeNotificationsPanel();
    });
  }

  function renderOrganiserNotices() {
    const root = document.getElementById('org-notices');
    const emptyEl = document.getElementById('org-notifications-empty');
    const subEl = document.getElementById('org-notifications-sub');
    const notices = buildOrganiserNotices();

    updateNotificationsNavBadge(notices);

    if (!root) return;

    if (!notices.length) {
      root.hidden = true;
      root.innerHTML = '';
      if (emptyEl) emptyEl.hidden = false;
      if (subEl) subEl.textContent = '';
      return;
    }

    const actionItems = organiserNoticeBadgeCount(notices);
    if (subEl) {
      subEl.textContent =
        actionItems > 0
          ? actionItems +
            ' item' +
            (actionItems === 1 ? '' : 's') +
            ' need' +
            (actionItems === 1 ? 's' : '') +
            ' action'
          : notices.length + ' update' + (notices.length === 1 ? '' : 's');
    }
    if (emptyEl) emptyEl.hidden = true;

    root.hidden = false;
    root.innerHTML =
      '<ul class="org-notices-list">' +
      notices
        .map((n) => {
          return (
            '<li class="org-notice org-notice--' +
            esc(n.type) +
            '" data-notice-id="' +
            esc(n.id) +
            '">' +
            '<div class="org-notice-body">' +
            '<h3 class="org-notice-title">' +
            esc(n.title) +
            '</h3>' +
            '<p class="org-notice-text">' +
            n.text +
            '</p>' +
            (n.actions ? '<div class="org-notice-actions">' + n.actions + '</div>' : '') +
            '</div></li>'
          );
        })
        .join('') +
      '</ul>';

    root.querySelectorAll('[data-edit-event]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit-event');
        closeNotificationsPanel();
        if (id) openEventEditorDrawer(state.events.find((e) => e.id === id) || { id });
      });
    });

    root.querySelectorAll('[data-review-application]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const registrationId = btn.getAttribute('data-review-application');
        const row =
          state.attendeesAll.find((a) => a.id === registrationId) ||
          state.pendingApplicationsPreview.find((a) => a.id === registrationId);
        if (row && row.eventId) {
          filters.attendeesEvent = row.eventId;
          filters.attendeesPendingOnly = true;
        }
        closeNotificationsPanel();
        setRoute('events-attendees');
        ensureAttendeesLoaded().then(() => renderAttendees());
      });
    });

    root.querySelectorAll('[data-org-route]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-org-route');
        closeNotificationsPanel();
        if (route === 'events-attendees') {
          if (btn.getAttribute('data-attendees-archive') === '1') {
            filters.attendeesView = 'archive';
            filters.attendeesPendingOnly = false;
          } else {
            filters.attendeesView = 'active';
            filters.attendeesPendingOnly = true;
          }
        }
        setRoute(route);
        if (route === 'events-attendees') ensureAttendeesLoaded().then(() => renderAttendees());
      });
    });
  }

  function renderJoinLinkBanner() {
    renderOrganiserNotices();
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
    if (window.HubEventTimezone && typeof window.HubEventTimezone.formatTimeRange === 'function') {
      const range = window.HubEventTimezone.formatTimeRange(startRaw, endRaw);
      return range || '—';
    }
    const start = new Date(startRaw);
    if (Number.isNaN(start.getTime())) return '—';
    const fmt = (d) =>
      d.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/London',
      });
    if (endRaw) {
      const end = new Date(endRaw);
      if (!Number.isNaN(end.getTime())) return fmt(start) + ' – ' + fmt(end);
    }
    return fmt(start);
  }

  function eventOrganiserGroupId(ev) {
    return String(ev.organiserGroupId || (ev.organiserGroupIds && ev.organiserGroupIds[0]) || '').trim();
  }

  function titleSeriesBucketKey(ev) {
    return 'title:' + eventOrganiserGroupId(ev) + '\0' + String(ev.title || '').trim().toLowerCase();
  }

  /** Match public event page series grouping (title fallback when recurrence is incomplete). */
  function eventSeriesBucketKey(ev, context) {
    const groupId = eventOrganiserGroupId(ev);
    const title = String(ev.title || '').trim().toLowerCase();
    const allEvents = (context && context.allEvents) || state.events || [];
    const sameTitlePeers = allEvents.filter(function (peer) {
      return (
        eventOrganiserGroupId(peer) === groupId &&
        String(peer.title || '').trim().toLowerCase() === title
      );
    });
    if (sameTitlePeers.length > 1) {
      return titleSeriesBucketKey(ev);
    }

    const seriesGroupId = String(ev.seriesGroupId || '').trim();
    if (seriesGroupId) {
      return 'sg:' + seriesGroupId;
    }
    const pattern = String(ev.recurrencePattern || '').trim().toLowerCase();
    const endDate = String(ev.recurrenceEndDate || '').trim().slice(0, 10);
    if (pattern && endDate) {
      return 'rec:' + groupId + '\0' + title + '\0' + pattern + '\0' + endDate;
    }
    return 'solo:' + String(ev.id || '');
  }

  function eventSeriesKeyForRow(ev) {
    const source = (ev && ev.seriesEvents && ev.seriesEvents[0]) || ev;
    return eventSeriesBucketKey(source, { allEvents: state.events });
  }

  function sortEventsByDate(events) {
    return (events || []).slice().sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      if (da !== db) return da - db;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
  }

  function compareEventsBySortColumn(a, b, column, direction) {
    const dir = direction === 'desc' ? -1 : 1;
    let cmp = 0;
    if (column === 'revenue') {
      cmp = (Number(a.revenueNum) || 0) - (Number(b.revenueNum) || 0);
    } else if (column === 'tickets') {
      cmp = (Number(a.ticketsSold) || 0) - (Number(b.ticketsSold) || 0);
    } else {
      const da = a.date ? new Date(a.date).getTime() : Number.POSITIVE_INFINITY;
      const db = b.date ? new Date(b.date).getTime() : Number.POSITIVE_INFINITY;
      cmp = da - db;
    }
    if (cmp !== 0) return cmp * dir;
    return String(a.title || '').localeCompare(String(b.title || ''));
  }

  function sortGroupedEventsList(list) {
    const column = filters.eventsSortColumn || 'date';
    const direction = filters.eventsSortDir || 'asc';
    return (list || []).slice().sort((a, b) => {
      const draftA = String(a.statusKey || '').toLowerCase() === 'draft';
      const draftB = String(b.statusKey || '').toLowerCase() === 'draft';
      if (draftA !== draftB) return draftA ? 1 : -1;
      return compareEventsBySortColumn(a, b, column, direction);
    });
  }

  function sortSeriesMembers(members) {
    const column = filters.eventsSortColumn || 'date';
    const direction = filters.eventsSortDir || 'asc';
    return (members || []).slice().sort((a, b) => {
      return compareEventsBySortColumn(a, b, column, direction);
    });
  }

  function toggleSeriesExpand(key) {
    if (!key) return;
    if (expandedSeriesKeys.has(key)) expandedSeriesKeys.delete(key);
    else expandedSeriesKeys.add(key);
    if (eventsSubRoute === 'events-revenue') renderRevenue();
    else renderEvents();
  }

  function eventsSortLabel() {
    const column = filters.eventsSortColumn || 'date';
    const direction = filters.eventsSortDir || 'asc';
    const names = { date: 'date', revenue: 'revenue', tickets: 'tickets sold' };
    return (names[column] || column) + ' (' + (direction === 'desc' ? 'high to low' : 'low to high') + ')';
  }

  function toggleEventsSort(column) {
    if (filters.eventsSortColumn === column) {
      filters.eventsSortDir = filters.eventsSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      filters.eventsSortColumn = column;
      filters.eventsSortDir = column === 'revenue' || column === 'tickets' ? 'desc' : 'asc';
    }
    listPages.events = 1;
    renderEvents();
  }

  function updateEventsSortHeaders() {
    document.querySelectorAll('[data-events-sort]').forEach(function (btn) {
      const col = btn.getAttribute('data-events-sort');
      const active = filters.eventsSortColumn === col;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-sort', active ? (filters.eventsSortDir === 'asc' ? 'ascending' : 'descending') : 'none');
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
    const all = events || [];
    const buckets = new Map();
    all.forEach((ev) => {
      const key = eventSeriesBucketKey(ev, { allEvents: all });
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(ev);
    });

    const grouped = [];
    buckets.forEach((members, key) => {
      if (members.length > 1 || key.startsWith('rec:') || key.startsWith('sg:')) {
        grouped.push(buildSeriesDisplayRow(members));
      } else {
        grouped.push(members[0]);
      }
    });

    return sortGroupedEventsList(grouped);
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
      const key = eventSeriesKeyForRow(ev);
      const expanded = expandedSeriesKeys.has(key);
      return (
        '<span class="org-series-toggle' +
        (expanded ? ' is-open' : '') +
        '" aria-hidden="true">' +
        '<span class="org-series-chev">' +
        (expanded ? '▾' : '▸') +
        '</span> ' +
        esc(ev.title) +
        '<span class="org-series-badge">' +
        esc(String(ev.seriesCount)) +
        ' dates</span></span>' +
        '<span class="org-series-row-hint">Click row to expand dates — cancel or delete one date at a time</span>' +
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

  function resolveEventRecord(evOrId) {
    if (!evOrId) return null;
    const id = typeof evOrId === 'object' ? evOrId.id : evOrId;
    if (!id) return typeof evOrId === 'object' ? evOrId : null;
    const fresh = state.events.find(function (e) {
      return e.id === id;
    });
    return fresh || (typeof evOrId === 'object' ? evOrId : { id: id });
  }

  function eventSoldCountFromTicketTypes(eventId) {
    if (!eventId || !state.tickets || !state.tickets.length) return 0;
    return state.tickets
      .filter(function (t) {
        return t.eventId === eventId;
      })
      .reduce(function (sum, t) {
        return sum + (Number(t.ticketsSold) || 0);
      }, 0);
  }

  function eventSoldCountFromAttendees(eventId) {
    if (!eventId || !state.attendeesAll || !state.attendeesAll.length) return 0;
    let count = 0;
    state.attendeesAll.forEach(function (row) {
      if (row.eventId !== eventId) return;
      const payment = String(row.paymentStatus || row.status || '').trim();
      if (payment === 'Refunded') return;
      if (String(row.applicationStatus || '') === 'Denied') return;
      if (String(row.applicationStatus || '') === 'Pending') return;
      count += Math.max(1, Number(row.quantity) || 1);
    });
    return count;
  }

  function eventEffectiveTicketsSold(ev) {
    const resolved = resolveEventRecord(ev);
    if (!resolved) return 0;
    return Math.max(
      eventTicketsSoldCount(resolved),
      eventSoldCountFromTicketTypes(resolved.id),
      eventSoldCountFromAttendees(resolved.id)
    );
  }

  function isEventCancelled(ev) {
    if (!ev) return false;
    const st = String(ev.status || '').toLowerCase();
    const key = String(ev.statusKey || '').toLowerCase();
    return st === 'cancelled' || key === 'cancelled';
  }

  function eventTicketsSoldCount(ev) {
    if (!ev) return 0;
    const label = String(ev.ticketsSoldLabel || '').trim();
    if (label) {
      const slash = label.match(/^(\d+)\s*\/\s*(\d+|—|-)/);
      if (slash) return Number(slash[1]) || 0;
      const soldWord = label.match(/^(\d+)\s+sold$/i);
      if (soldWord) return Number(soldWord[1]) || 0;
      if (/^\d+$/.test(label)) return Number(label) || 0;
    }
    const direct = Number(ev.ticketsSold);
    return Number.isFinite(direct) && direct > 0 ? direct : 0;
  }

  function eventCanDelete(ev) {
    const resolved = resolveEventRecord(ev);
    if (!resolved || !resolved.id || state.canDeleteEvents === false) return false;
    if (eventCanCancel(resolved)) return false;
    if (isEventCancelled(resolved)) return false;
    return true;
  }

  function eventIsPublishedListing(ev) {
    if (!ev) return false;
    if (isEventCancelled(ev)) return false;
    const st = String(ev.status || '').toLowerCase();
    const key = String(ev.statusKey || '').toLowerCase();
    const approval = String(ev.approvalStatus || '').toLowerCase();
    return (
      st === 'published' ||
      approval === 'approved' ||
      key === 'live' ||
      key === 'upcoming' ||
      key === 'pending_approval' ||
      key === 'archived'
    );
  }

  function isEventDraftListing(ev) {
    const resolved = resolveEventRecord(ev);
    if (!resolved) return true;
    const key = String(resolved.statusKey || '').toLowerCase();
    const st = String(resolved.status || '').toLowerCase();
    return key === 'draft' || st === 'draft' || key === 'unpublished';
  }

  function eventPaidBookingsFromAttendees(eventId) {
    if (!eventId || !state.attendeesAll || !state.attendeesAll.length) return null;
    let count = 0;
    state.attendeesAll.forEach(function (row) {
      if (row.eventId !== eventId) return;
      if (String(row.applicationStatus || '') === 'Denied') return;
      if (String(row.applicationStatus || '') === 'Pending') return;
      if (String(row.paymentStatus || '').trim() !== 'Paid') return;
      count += Math.max(1, Number(row.quantity) || 1);
    });
    return count;
  }

  /** Refund checkbox only when published/live and there are paid bookings to refund. */
  function cancelRequiresRefundConfirmation(ev, ctx) {
    const resolved = resolveEventRecord(ev);
    if (!resolved || isEventDraftListing(resolved)) return false;
    if (ctx && ctx.paidBookings != null) return Number(ctx.paidBookings) > 0;
    const localPaid = eventPaidBookingsFromAttendees(resolved.id);
    if (localPaid != null) return localPaid > 0;
    return false;
  }

  function eventCanCancel(ev) {
    const resolved = resolveEventRecord(ev);
    if (!resolved || !resolved.id || isEventCancelled(resolved)) return false;
    if (isEventDraftListing(resolved)) return false;
    if (eventEffectiveTicketsSold(resolved) > 0) return true;
    if (resolved.locked) return true;
    return false;
  }

  function eventDeleteActionHtml(ev) {
    if (!eventCanDelete(ev)) return '';
    return (
      '<button type="button" class="org-action-item danger" data-delete-event="' +
      esc(ev.id) +
      '"><span class="org-action-icon">🗑</span><span class="org-action-text"><strong>Delete event</strong><span>Remove this listing permanently</span></span></button>'
    );
  }

  function seriesDateActionsCell(child) {
    const ev = resolveEventRecord(child);
    const parts = [
      '<button type="button" class="org-series-date-btn" data-edit-event="' +
        esc(ev.id) +
        '" data-edit-series-date="1">Edit dates</button>',
    ];
    if (eventCanCancel(ev)) {
      parts.push(
        '<button type="button" class="org-series-date-btn danger" data-cancel-event="' +
          esc(ev.id) +
          '">Cancel</button>'
      );
    } else if (eventCanDelete(ev)) {
      parts.push(
        '<button type="button" class="org-series-date-btn danger" data-delete-event="' +
          esc(ev.id) +
          '">Delete</button>'
      );
    }
    return '<td class="org-series-date-actions">' + parts.join('') + '</td>';
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
          : key === 'pending_approval'
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
          '">Retry automatic refunds</button>'
      );
    }
    if (ev.canRequestPayout && state.canManagePayments !== false) {
      parts.push(
        '<button type="button" class="org-btn org-btn-gold org-btn-sm" data-request-payout="' +
          esc(ev.id) +
          '">Request payout</button>'
      );
    }
    return parts.length ? parts.join(' ') : '';
  }

  function payoutCellHtml(ev) {
    const badge = payoutStatusBadgeHtml(ev);
    const actions = payoutActionsHtml(ev);
    if (!actions) return badge;
    return (
      '<div class="org-payout-cell">' +
      badge +
      '<div class="org-payout-cell-actions">' +
      actions +
      '</div></div>'
    );
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
        '<a class="org-action-item" href="../events/organiser?id=' +
        esc(id) +
        '" target="_blank" rel="noopener noreferrer"><span class="org-action-icon">↗</span><span class="org-action-text"><strong>View public profile</strong><span>See your group page and ranking badge</span></span></a>' +
        '<a class="org-action-item" href="/organiser/member-roster?id=' +
        esc(id) +
        '"><span class="org-action-icon">👥</span><span class="org-action-text"><strong>Member list</strong><span>Upload members for members-only tickets</span></span></a>' +
        '<button type="button" class="org-action-item" data-add-event-for-group="' +
        esc(id) +
        '"><span class="org-action-icon">📅</span><span class="org-action-text"><strong>Add an event</strong><span>List a new event for this group</span></span></button>' +
        (state.canCreateGroups !== false
          ? '<button type="button" class="org-action-item" data-duplicate-group="' +
            esc(id) +
            '"><span class="org-action-icon">⧉</span><span class="org-action-text"><strong>Duplicate group</strong><span>Create a draft copy of this profile</span></span></button>'
          : '') +
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
      '<button type="button" class="org-action-item" data-duplicate-event="' +
      esc(id) +
      '"><span class="org-action-icon">⧉</span><span class="org-action-text"><strong>Duplicate event</strong><span>Draft copy — add new dates &amp; publish</span></span></button>' +
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
    const isSeriesParent = ev.isSeries && ev.seriesCount > 1;
    const cancelItem =
      !isSeriesParent && eventCanCancel(ev)
        ? '<button type="button" class="org-action-item danger" data-cancel-event="' +
          esc(id) +
          '"><span class="org-action-icon">⊘</span><span class="org-action-text"><strong>Cancel this event</strong><span>Cancel a published event with ticket sales</span></span></button>'
        : '';
    const seriesNote = isSeriesParent
      ? '<p class="org-action-menu-note">Expand the row to cancel or delete individual dates.</p>'
      : '';
    const deleteItem = isSeriesParent ? '' : eventDeleteActionHtml(ev);
    const alumniItem =
      ev.alumniFastPassEnabled && String(ev.status || '').toLowerCase() === 'published'
        ? '<button type="button" class="org-action-item" data-send-alumni-invites="' +
          esc(id) +
          '"><span class="org-action-icon">🎓</span><span class="org-action-text"><strong>Invite previous attendees</strong><span>Email past attendees a locked ticket link</span></span></button>'
        : '';
    return (
      '<div class="org-action-wrap">' +
      '<button type="button" class="org-action-btn" data-org-action-toggle aria-expanded="false">Actions <span class="chev">▾</span></button>' +
      '<div class="org-action-menu" role="menu">' +
      '<div class="org-action-menu-header">' +
      esc(shortTitle) +
      (isSeriesParent ? '<span class="org-action-menu-sub">' + esc(String(ev.seriesCount)) + ' dates</span>' : '') +
      '</div>' +
      seriesNote +
      '<button type="button" class="org-action-item" data-edit-event="' +
      esc(id) +
      '"><span class="org-action-icon">✎</span><span class="org-action-text"><strong>Edit event</strong><span>Update details, times &amp; tickets</span></span></button>' +
      '<button type="button" class="org-action-item" data-org-goto-sub="events-attendees" data-filter-event="' +
      esc(id) +
      '"><span class="org-action-icon">👥</span><span class="org-action-text"><strong>See attendees</strong><span>View who registered for this event</span></span></button>' +
      '<button type="button" class="org-action-item" data-manage-tickets="' +
      esc(id) +
      '"><span class="org-action-icon">🎟️</span><span class="org-action-text"><strong>Ticket types</strong><span>Edit tiers and publish</span></span></button>' +
      '<button type="button" class="org-action-item" data-duplicate-event="' +
      esc(id) +
      '"><span class="org-action-icon">⧉</span><span class="org-action-text"><strong>Duplicate event</strong><span>Draft copy — add new dates &amp; publish</span></span></button>' +
      '<button type="button" class="org-action-item" data-org-goto-sub="events-revenue" data-filter-event="' +
      esc(id) +
      '"><span class="org-action-icon">£</span><span class="org-action-text"><strong>Revenue &amp; payout</strong><span>Request payout when eligible</span></span></button>' +
      alumniItem +
      cancelItem +
      deleteItem +
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

  function parseDeepLinkFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const panel = String(params.get('panel') || '').trim().toLowerCase();
    const eventId = String(params.get('eventId') || params.get('event_id') || '').trim();
    const applications = String(params.get('applications') || '').trim().toLowerCase();
    const hash = (location.hash.replace('#', '') || '').toLowerCase();
    const route = panel || hash || '';
    return {
      route,
      eventId,
      pendingOnly: applications === 'pending' || applications === '1' || applications === 'true',
    };
  }


  function clearAttendeesPendingFilter() {
    if (!filters.attendeesPendingOnly) return;
    filters.attendeesPendingOnly = false;
    if (eventsSubRoute === 'events-attendees') {
      setRoute('events-attendees');
    }
    renderAttendeesFilterNote();
    renderAttendees();
  }

  function renderAttendeesFilterNote() {
    const note = document.getElementById('attendees-filter-note');
    if (!note) return;
    note.hidden = !filters.attendeesPendingOnly;
  }

  function maybeClearAttendeesPendingFilter() {
    if (!filters.attendeesPendingOnly) return;
    if (!pendingApplicationsCount()) {
      clearAttendeesPendingFilter();
    }
  }

  function applyAttendeesDeepLinkFromUrl() {
    const { route, eventId, pendingOnly } = parseDeepLinkFromUrl();
    if (eventId) {
      filters.attendeesEvent = eventId;
      filters.ticketsEvent = eventId;
      filters.cancellationsEvent = eventId;
    }
    if (pendingOnly) {
      filters.attendeesPendingOnly = true;
    } else if (route === 'events-attendees' || eventsSubRoute === 'events-attendees') {
      filters.attendeesPendingOnly = false;
    }
    const attSel = document.getElementById('filter-attendees-event');
    if (attSel && eventId) {
      attSel.value = eventId;
      setAttendeesEventFilterValue(eventId, { skipRender: true });
    }
    const ticketSel = document.getElementById('filter-tickets-event');
    if (ticketSel && eventId) ticketSel.value = eventId;
    const cancelSel = document.getElementById('filter-cancellations-event');
    if (cancelSel && eventId) cancelSel.value = eventId;
    return route;
  }

  function resolveInitialRoute() {
    const deepLinkRoute = applyAttendeesDeepLinkFromUrl();
    if (deepLinkRoute && deepLinkRoute.startsWith('events-')) {
      return { page: 'events', sub: deepLinkRoute };
    }
    if (deepLinkRoute === 'events') {
      return { page: 'events', sub: 'events-list' };
    }
    return parseRoute();
  }

  function finishDeepLinkAfterBootstrap() {
    const deepLinkRoute = applyAttendeesDeepLinkFromUrl();
    if (deepLinkRoute && deepLinkRoute.startsWith('events-')) {
      if (needsOrganiserPageFirst()) {
        redirectEventsToOrganiserSetup(deepLinkRoute);
        return;
      }
      setRoute(deepLinkRoute);
      return;
    }
    if (filters.attendeesEvent !== 'all' || filters.attendeesPendingOnly) {
      if (needsOrganiserPageFirst()) {
        redirectEventsToOrganiserSetup('events-attendees');
        return;
      }
      setRoute('events-attendees');
    }
  }

  function needsOrganiserPageFirst() {
    return !state.groups.length && !(state.pendingClaimGroups || []).length;
  }

  function isEventsRoute(route) {
    if (!route) return false;
    const r = String(route).toLowerCase();
    return r === 'events' || r === 'events-overview' || r === 'tickets' || r.startsWith('events-');
  }

  function openNeedsOrganiserPageModal() {
    const modal = document.getElementById('modal-needs-organiser-page');
    if (!modal) {
      openGroupEditorDrawer();
      return;
    }
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
  }

  function redirectEventsToOrganiserSetup() {
    setRoute('groups', { skipEventsGuard: true });
    openNeedsOrganiserPageModal();
  }

  function enforceEventsOrganiserGate() {
    if (!bootstrapReady || !needsOrganiserPageFirst()) return;
    const onEventsPage = Boolean(document.querySelector('[data-org-page="events"].is-active'));
    if (onEventsPage || isEventsRoute(eventsSubRoute)) {
      redirectEventsToOrganiserSetup();
    }
  }

  function parseRoute() {
    const hash = (location.hash.replace('#', '') || 'dashboard').toLowerCase();
    if (hash === 'business-list') return { page: 'business-list', sub: null };
    if (hash === 'opportunity-enquiries') return { page: 'business-overview', sub: null };
    if (hash === 'events-overview') return { page: 'events', sub: 'events-list' };
    if (hash === 'business-overview') return { page: 'business-overview', sub: null };
    if (hash === 'tickets') return { page: 'events', sub: 'events-tickets' };
    if (hash.startsWith('events-')) return { page: 'events', sub: hash };
    if (hash === 'events') return { page: 'events', sub: 'events-list' };
    if (hash === 'academy' || hash.startsWith('academy-') || hash === 'training-overview') {
      return { page: 'dashboard', sub: null };
    }
    if (hash === 'team') return { page: 'team', sub: null };
    return { page: hash, sub: null };
  }

  function setEventsSub(sub) {
    eventsSubRoute = sub || 'events-list';
    document.querySelectorAll('[data-events-panel]').forEach((panel) => {
      const isActive = panel.getAttribute('data-events-panel') === eventsSubRoute;
      panel.classList.toggle('is-active', isActive);
      if (isActive) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
      panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
    syncEventsTabHighlights(eventsSubRoute, true);
    syncSidebarNavHighlight('events', eventsSubRoute);
    const hubSummary = document.getElementById('org-events-hub-summary');
    if (hubSummary) hubSummary.hidden = eventsSubRoute !== 'events-list';
    const titles = {
      'events-list': ['My Events', 'Manage all your event listings — click any event name to edit.'],
      'events-tickets': ['Tickets', 'All ticket types across your events.'],
      'events-attendees': [
        'Attendees',
        'Registrations and Category Exclusivity applications — see who is new to your group vs returning, filter by event, and export a CSV.',
      ],
      'events-cancellations': [
        'Cancellations',
        'Bookings attendees cancelled themselves — use the booking reference for Stripe or support, and check whether a refund may be due.',
      ],
      'events-reviews': ['Reviews', 'Read and reply to attendee feedback.'],
      'events-revenue': [
        'Revenue',
        'Ticket sales and payout status per event. Request a payout after an event has finished and been archived.',
      ],
    };
    const t = titles[eventsSubRoute] || titles['events-list'];
    const titleEl = document.getElementById('my-events-title');
    const subEl = document.getElementById('my-events-sub');
    if (titleEl) titleEl.textContent = t[0];
    if (subEl) subEl.textContent = t[1];

    if (!bootstrapReady) return;

    if (eventsSubRoute === 'events-attendees') {
      fillAttendeesEventFilter();
      ensureAttendeesLoaded().then(() => renderAttendees());
    } else if (eventsSubRoute === 'events-cancellations') {
      fillCancellationsEventFilter();
      loadCancellationsAll()
        .then(() => {
          renderCancellations();
          updateMyEventsTabCounts();
        });
    } else if (eventsSubRoute === 'events-reviews') {
      ensureReviewsLoaded().then(() => renderReviews());
    } else {
      ensureEventsLoaded().then(() => {
        renderEventsPanel(eventsSubRoute);
        maybePrefetchEvents();
      });
    }
  }

  function ensureEventsLoaded(options) {
    const force = Boolean(options && options.force);
    if (state.eventsLoaded && !force) return Promise.resolve(true);
    if (eventsLoadingPromise && !force) return eventsLoadingPromise;

    state.eventsLoading = true;
    eventsLoadingPromise = api(
      '/api/organiser/bootstrap?eventsOnly=1&eventsLimit=' + EVENTS_FETCH_SIZE + '&eventsOffset=0'
    )
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message || data.error || 'Could not load events');
        state.events = data.events || [];
        state.upcomingEvents = data.upcomingEvents || [];
        state.tickets = data.tickets || [];
        state.eventsTotal = data.eventsPagination?.total ?? state.events.length;
        state.eventsChunkOffset = data.eventsPagination?.offset ?? 0;
        state.eventsHasMore = Boolean(data.eventsPagination?.hasMore);
        state.eventsFullyLoaded = !state.eventsHasMore;
        state.eventsLoaded = true;
        listPages.events = 1;
        listPages.tickets = 1;
        listPages.revenue = 1;
        renderStats();
        fillMyEventsFilters();
        fillEventSelect(document.getElementById('ticket-event'));
        return true;
      })
      .catch((err) => {
        showOrganiserAlert(err.message || 'Could not load events', true);
        return false;
      })
      .finally(() => {
        state.eventsLoading = false;
        eventsLoadingPromise = null;
      });
    return eventsLoadingPromise;
  }

  function ensureReviewsLoaded(options) {
    const force = Boolean(options && options.force);
    if (state.reviewsLoaded && !force) return Promise.resolve(true);
    if (reviewsLoadingPromise && !force) return reviewsLoadingPromise;

    reviewsLoadingPromise = api('/api/organiser/reviews')
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message || data.error || 'Could not load reviews');
        state.reviews = data.reviews || [];
        state.groupRankings = data.groupRankings || {};
        state.reviewsLoaded = true;
        listPages.reviews = 1;
        updateMyEventsTabCounts();
        return true;
      })
      .catch((err) => {
        showOrganiserAlert(err.message || 'Could not load reviews', true);
        return false;
      })
      .finally(() => {
        reviewsLoadingPromise = null;
      });
    return reviewsLoadingPromise;
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
  }

  function archivedApplicationsList() {
    return state.attendeesAll.filter(
      (a) =>
        a.isCategoryExclusivityApplication && String(a.applicationStatus || '').trim() === 'Denied'
    );
  }

  function eventApplicationTicket(eventId) {
    return (
      state.tickets.find((t) => {
        if (t.eventId !== eventId) return false;
        const name = String(t.name || '').toLowerCase();
        const type = String(t.ticketType || t.ticket_type || '');
        return /application/i.test(type) || /application to attend/i.test(name);
      }) || null
    );
  }

  function countApprovedApplicationSeats(eventId) {
    let count = 0;
    state.attendeesAll.forEach((row) => {
      if (row.eventId !== eventId) return;
      if (!row.isCategoryExclusivityApplication) return;
      if (String(row.applicationStatus || '').trim() !== 'Approved') return;
      count += Math.max(1, Number(row.quantity) || 1);
    });
    return count;
  }

  function seatRefillOpportunities() {
    const ops = [];
    const seen = new Set();
    state.attendeesAll.forEach((row) => {
      if (!row.isCategoryExclusivityApplication) return;
      if (seen.has(row.eventId)) return;
      seen.add(row.eventId);
      const ticket = eventApplicationTicket(row.eventId);
      if (!ticket || ticket.quantityAvailable == null || ticket.quantityAvailable === '') return;
      const cap = Math.max(0, Number(ticket.quantityAvailable) || 0);
      if (cap <= 0) return;
      const filled = countApprovedApplicationSeats(row.eventId);
      const openSeats = cap - filled;
      if (openSeats <= 0) return;
      const archived = archivedApplicationsList().filter((a) => a.eventId === row.eventId);
      if (!archived.length) return;
      const ev = state.events.find((e) => e.id === row.eventId);
      ops.push({
        eventId: row.eventId,
        eventTitle: ev?.title || row.eventTitle || 'Event',
        openSeats,
        archivedCount: archived.length,
      });
    });
    return ops;
  }

  function setAttendeesView(view) {
    filters.attendeesView = view === 'archive' ? 'archive' : 'active';
    filters.attendeesPendingOnly = false;
    listPages.attendees = 1;
    renderAttendees();
  }

  function renderAttendeesArchiveNav() {
    const link = document.getElementById('btn-attendees-view-archive');
    const archiveNote = document.getElementById('attendees-archive-note');
    const filterNote = document.getElementById('attendees-filter-note');
    const archivedCount = archivedApplicationsList().length;
    if (link) {
      if (filters.attendeesView === 'archive') {
        link.hidden = true;
      } else {
        link.hidden = archivedCount < 1;
        link.textContent =
          archivedCount === 1
            ? 'Archived applications (1)'
            : 'Archived applications (' + String(archivedCount) + ')';
      }
    }
    if (archiveNote) archiveNote.hidden = filters.attendeesView !== 'archive';
    if (filterNote && filters.attendeesView === 'archive') filterNote.hidden = true;
  }

  function renderSeatRefillBanner() {
    const banner = document.getElementById('attendees-seat-refill-banner');
    if (!banner) return;
    if (filters.attendeesView === 'archive') {
      banner.hidden = true;
      return;
    }
    const opportunities = seatRefillOpportunities();
    const filtered =
      filters.attendeesEvent !== 'all'
        ? opportunities.filter((op) => op.eventId === filters.attendeesEvent)
        : opportunities;
    if (!filtered.length) {
      banner.hidden = true;
      return;
    }
    const lines = filtered
      .slice(0, 3)
      .map((op) => {
        const seatLabel = op.openSeats === 1 ? '1 seat' : op.openSeats + ' seats';
        const archiveLabel =
          op.archivedCount === 1 ? '1 archived application' : op.archivedCount + ' archived applications';
        return (
          '<p><strong>' +
          esc(op.eventTitle) +
          '</strong> has ' +
          seatLabel +
          ' available and ' +
          archiveLabel +
          ' you can reconsider.</p>'
        );
      })
      .join('');
    const more =
      filtered.length > 3
        ? '<p>+' + String(filtered.length - 3) + ' more events with open seats.</p>'
        : '';
    banner.innerHTML =
      lines +
      more +
      '<div class="org-applications-banner-actions">' +
      '<button type="button" class="org-applications-banner-cta" id="btn-attendees-seat-refill-archive">Review archived applications</button>' +
      '</div>';
    banner.hidden = false;
    banner.classList.add('org-applications-banner-seat-refill');
  }

  function pendingApplicationsCount() {
    if (state.attendeesLoaded) {
      return pendingApplicationsList().length;
    }
    return Number(state.pendingApplicationsCount) || 0;
  }

  function pendingApplicationsList() {
    if (state.attendeesLoaded) {
      return state.attendeesAll.filter((a) => String(a.applicationStatus || '') === 'Pending');
    }
    return (state.pendingApplicationsPreview || []).map((row) => ({
      id: row.id,
      name: row.name,
      eventTitle: row.eventTitle,
      eventId: row.eventId,
      applicationStatus: 'Pending',
    }));
  }

  function updatePendingApplicationsUi() {
    const badge = document.getElementById('org-pending-applications-nav-badge');
    const count = pendingApplicationsCount();
    if (badge) {
      badge.hidden = count < 1;
      badge.textContent = count > 1 ? String(count) + ' pending' : 'New';
    }
    const tabBadge = document.getElementById('org-events-tab-applications-badge');
    if (tabBadge) {
      tabBadge.hidden = count < 1;
      tabBadge.textContent = count > 1 ? String(count) : 'New';
    }
    renderOrganiserNotices();
    renderHubPortalMeta();
  }

  function updatePendingApplicationsNavBadge() {
    updatePendingApplicationsUi();
  }

  function attendeeVisitCount(a) {
    if (a.visitCount != null && Number.isFinite(Number(a.visitCount))) {
      return Math.max(1, Number(a.visitCount));
    }
    const rel = String(a.groupRelationship || '').trim();
    if (!rel || rel === 'unknown') return null;
    return Math.max(1, (Number(a.priorVisitCount) || 0) + 1);
  }

  function attendeeVisitCountLabel(a) {
    const n = attendeeVisitCount(a);
    if (n == null) return '';
    if (n === 1) return '1st visit';
    return n + ' visits';
  }

  function attendeeGroupRelationshipLabel(a) {
    const rel = String(a.groupRelationship || '').trim();
    if (rel === 'returning') return 'Returning';
    if (rel === 'new') return 'New to your group';
    return '';
  }

  function attendeeGroupRelationshipBadgeHtml(a) {
    const n = attendeeVisitCount(a);
    if (n == null) {
      return '<span class="org-attendee-rel-unknown">—</span>';
    }
    const rel = String(a.groupRelationship || '').trim();
    const label = n === 1 ? '1st visit' : n + ' visits';
    const cls = rel === 'new' ? 'org-badge-new' : 'org-badge-returning';
    const hint =
      rel === 'returning' && n > 1
        ? ' title="Including this booking — ' + n + ' Hub bookings with your organiser page"'
        : rel === 'new'
          ? ' title="First Hub booking with your organiser page"'
          : '';
    return (
      '<span class="org-badge org-badge-visit ' +
      cls +
      '"' +
      hint +
      '>' +
      esc(label) +
      '</span>'
    );
  }

  function attendeeStatusLabel(a) {
    const applicationStatus = String(a.applicationStatus || 'Approved').trim();
    if (applicationStatus === 'Pending') return 'Application pending';
    if (applicationStatus === 'Denied') {
      return filters.attendeesView === 'archive' ? 'Archived' : 'Application denied';
    }
    return 'Confirmed';
  }

  function attendeeStatusBadgeHtml(a) {
    const applicationStatus = String(a.applicationStatus || 'Approved').trim();
    if (filters.attendeesView === 'archive' && applicationStatus === 'Denied') {
      return '<span class="org-badge org-badge-archived">Archived</span>';
    }
    if (applicationStatus === 'Pending') {
      return '<span class="org-badge org-badge-gold">Pending review</span>';
    }
    if (applicationStatus === 'Denied') {
      return '<span class="org-badge org-badge-red">Denied</span>';
    }
    if (a.needsPayment) {
      return '<span class="org-badge org-badge-gold">Approved</span>';
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
    if (filters.attendeesView === 'archive') {
      list = list.filter(
        (a) =>
          a.isCategoryExclusivityApplication && String(a.applicationStatus || '').trim() === 'Denied'
      );
      list.sort((a, b) => {
        const ta = a.applicationDecidedAt || a.registeredAt;
        const tb = b.applicationDecidedAt || b.registeredAt;
        return new Date(ta || 0).getTime() - new Date(tb || 0).getTime();
      });
    } else {
      list = list.filter(
        (a) =>
          !(
            a.isCategoryExclusivityApplication &&
            String(a.applicationStatus || '').trim() === 'Denied'
          )
      );
    }
    if (filters.attendeesHideArchived && filters.attendeesEvent === 'all') {
      const archivedEventIds = new Set(
        allEventOptions()
          .filter((ev) => eventRowIsArchived(ev))
          .map((ev) => ev.id)
      );
      list = list.filter((a) => !archivedEventIds.has(a.eventId));
    }
    if (filters.attendeesEvent !== 'all') {
      list = list.filter((a) => a.eventId === filters.attendeesEvent);
    }
    const search = String(filters.attendeesSearch || '').trim().toLowerCase();
    if (search) {
      list = list.filter((a) =>
        [
          a.name,
          a.email,
          a.company,
          a.jobTitle,
          a.screeningJobTitle,
          a.eventTitle,
          a.ticketName,
          ...(a.guestNames || []),
        ].some((value) => String(value || '').toLowerCase().includes(search))
      );
    }
    if (filters.attendeesStatus === 'pending') {
      list = list.filter((a) => String(a.applicationStatus || '') === 'Pending');
    } else if (filters.attendeesStatus === 'awaiting_payment') {
      list = list.filter(
        (a) => String(a.applicationStatus || 'Approved') === 'Approved' && a.needsPayment
      );
    } else if (filters.attendeesStatus === 'confirmed') {
      list = list.filter(
        (a) =>
          String(a.applicationStatus || 'Approved') === 'Approved' &&
          !a.needsPayment
      );
    }
    if (filters.attendeesPendingOnly) {
      list = list.filter((a) => String(a.applicationStatus || '') === 'Pending');
    }
    if (filters.attendeesRelationship === 'new') {
      list = list.filter((a) => String(a.groupRelationship || '') === 'new');
    } else if (filters.attendeesRelationship === 'returning') {
      list = list.filter((a) => String(a.groupRelationship || '') === 'returning');
    }
    return list;
  }

  function attendeesRelationshipSummary(list) {
    let newCount = 0;
    let returningCount = 0;
    (list || []).forEach((a) => {
      const rel = String(a.groupRelationship || '').trim();
      if (rel === 'new') newCount += 1;
      else if (rel === 'returning') returningCount += 1;
    });
    return { newCount, returningCount, total: (list || []).length };
  }

  function renderAttendeesSummary(list) {
    const el = document.getElementById('attendees-relationship-summary');
    if (!el) return;
    const summary = attendeesRelationshipSummary(list);
    if (!summary.total) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    const parts = [];
    if (summary.newCount) {
      parts.push(
        '<span class="org-attendees-summary-pill org-attendees-summary-pill--new"><strong>' +
          summary.newCount +
          '</strong> new to your group</span>'
      );
    }
    if (summary.returningCount) {
      parts.push(
        '<span class="org-attendees-summary-pill org-attendees-summary-pill--returning"><strong>' +
          summary.returningCount +
          '</strong> returning</span>'
      );
    }
    el.innerHTML =
      parts.join('') +
      '<span class="org-attendees-summary-note">Based on Hub bookings with your organiser page — not annual membership records.</span>';
  }

  function setAttendeesEventFilterValue(eventId, options) {
    const next = eventId || 'all';
    filters.attendeesEvent = next;
    const sel = document.getElementById('filter-attendees-event');
    if (sel) sel.value = next;
    const labelEl = document.getElementById('filter-attendees-event-label');
    if (labelEl) {
      if (next === 'all') {
        labelEl.textContent = 'All events';
      } else {
        const match = attendeesEventPickerOptions().find(function (row) {
          return row.id === next;
        });
        labelEl.textContent = match
          ? match.label + (match.archived ? ' · Archived' : '')
          : 'Selected event';
      }
    }
    if (!(options && options.skipRender)) {
      listPages.attendees = 1;
      renderAttendees();
    }
  }

  function closeAttendeesEventPicker() {
    const panel = document.getElementById('filter-attendees-event-panel');
    const trigger = document.getElementById('filter-attendees-event-trigger');
    const search = document.getElementById('filter-attendees-event-search');
    if (panel) panel.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (search) search.value = '';
  }

  function renderAttendeesEventPickerList(query) {
    const listEl = document.getElementById('filter-attendees-event-list');
    if (!listEl) return;
    const q = String(query || '')
      .trim()
      .toLowerCase();
    const rows = attendeesEventPickerOptions().filter(function (row) {
      return !q || row.searchText.indexOf(q) !== -1;
    });
    const items = [
      {
        id: 'all',
        label: 'All events',
        selected: filters.attendeesEvent === 'all',
      },
    ].concat(
      rows.map(function (row) {
        return {
          id: row.id,
          label: row.label + (row.archived ? ' · Archived' : ''),
          selected: row.id === filters.attendeesEvent,
        };
      })
    );
    if (items.length === 1 && q) {
      listEl.innerHTML =
        '<li class="org-event-picker-empty" role="presentation">No events match “' +
        esc(query) +
        '”</li>';
      return;
    }
    listEl.innerHTML = items
      .map(function (item) {
        return (
          '<li role="option" class="org-event-picker-option' +
          (item.selected ? ' is-selected' : '') +
          '" data-event-id="' +
          esc(item.id) +
          '" aria-selected="' +
          (item.selected ? 'true' : 'false') +
          '">' +
          esc(item.label) +
          '</li>'
        );
      })
      .join('');
  }

  function openAttendeesEventPicker() {
    const panel = document.getElementById('filter-attendees-event-panel');
    const trigger = document.getElementById('filter-attendees-event-trigger');
    const search = document.getElementById('filter-attendees-event-search');
    if (!panel || !trigger) return;
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    renderAttendeesEventPickerList(search ? search.value : '');
    if (search) {
      search.focus();
      search.select();
    }
  }

  function fillAttendeesEventFilter() {
    const sel = document.getElementById('filter-attendees-event');
    if (!sel) return;
    const rows = attendeesEventPickerOptions();
    sel.innerHTML = '<option value="all">All events</option>';
    rows.forEach(function (row) {
      const opt = document.createElement('option');
      opt.value = row.id;
      opt.textContent = row.label + (row.archived ? ' · Archived' : '');
      sel.appendChild(opt);
    });
    if (
      filters.attendeesEvent !== 'all' &&
      !rows.some(function (row) {
        return row.id === filters.attendeesEvent;
      })
    ) {
      filters.attendeesEvent = 'all';
    }
    sel.value = filters.attendeesEvent;
    setAttendeesEventFilterValue(filters.attendeesEvent, { skipRender: true });
    const panel = document.getElementById('filter-attendees-event-panel');
    if (panel && !panel.hidden) {
      const search = document.getElementById('filter-attendees-event-search');
      renderAttendeesEventPickerList(search ? search.value : '');
    }
  }

  function ensureAttendeesLoaded(options) {
    const force = Boolean(options && options.force);
    if (state.attendeesLoaded && !force) return Promise.resolve(true);
    if (attendeesLoadingPromise && !force) return attendeesLoadingPromise;
    attendeesLoadingPromise = loadAttendeesAll({ force }).finally(function () {
      attendeesLoadingPromise = null;
    });
    return attendeesLoadingPromise;
  }

  async function loadAttendeesAll(options) {
    const force = Boolean(options && options.force);
    if (state.attendeesLoaded && !force) return true;
    const hint = document.getElementById('attendees-load-hint');
    const errEl = document.getElementById('attendees-load-error');
    if (hint) hint.hidden = false;
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    try {
      const { ok, data } = await api('/api/organiser/attendees?eventId=all');
      if (ok) {
        state.attendeesAll = data.attendees || [];
        state.attendeesLoaded = true;
        maybeClearAttendeesPendingFilter();
        updateMyEventsTabCounts();
        updatePendingApplicationsNavBadge();
        renderAttendeesFilterNote();
        if (eventsSubRoute === 'events-attendees') {
          renderAttendees();
        }
        if (eventsSubRoute === 'events-list') {
          renderEvents();
        }
      } else if (errEl) {
        errEl.hidden = false;
        errEl.textContent =
          data.message || data.error || 'Could not load attendees. Try refreshing the page.';
        if (eventsSubRoute === 'events-attendees') {
          renderAttendees();
        }
      }
      return ok;
    } catch (err) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = err.message || 'Could not load attendees. Try refreshing the page.';
      }
      return false;
    } finally {
      if (hint) hint.hidden = true;
    }
  }

  function exportAttendeesCsv() {
    const rows = filteredAttendeesList();
    if (!rows.length) {
      alert('No attendees to export for this filter.');
      return;
    }
    const header = [
      'Name',
      'Company',
      'Job title',
      'Visits',
      'Relationship',
      'Other attendees',
      'Email',
      'Phone',
      'Event',
      'Ticket',
      'Quantity',
      'Status',
      'Industry',
      'Dietary requirements',
      'Accessibility requirements',
      'Paid',
      'Registered',
    ];
    const lines = rows.map((a) =>
      [
        a.name,
        a.company || '',
        a.jobTitle || a.screeningJobTitle || '',
        attendeeVisitCountLabel(a),
        attendeeGroupRelationshipLabel(a),
        (a.guestNames || []).join('; '),
        a.email,
        a.phone || '',
        eventLabelForRow(a),
        a.ticketName,
        a.quantity,
        attendeeStatusLabel(a),
        a.screeningIndustry || a.businessSector || '',
        a.dietaryRequirements || '',
        a.accessibilityRequirements || '',
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

  async function exportNameBadgesPdf() {
    if (filters.attendeesView === 'archive') {
      alert('Switch back to attendees to export name badges for confirmed guests.');
      return;
    }
    const confirmed = filteredAttendeesList().filter(function (a) {
      const status = String(a.applicationStatus || 'Approved').trim();
      return status !== 'Pending' && status !== 'Denied';
    });
    if (!confirmed.length) {
      alert('No confirmed attendees to print for this filter.');
      return;
    }
    const eventId = filters.attendeesEvent || 'all';
    const labelFormatEl = document.getElementById('filter-attendees-label-format');
    const labelFormat =
      labelFormatEl && labelFormatEl.value === 'l7163' ? 'l7163' : 'l7160';
    const btn = document.getElementById('btn-download-name-badges');
    const prev = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Building PDF…';
    }
    try {
      const res = await fetch(
        '/api/organiser/attendee-badges-pdf?eventId=' +
          encodeURIComponent(eventId) +
          '&labelFormat=' +
          encodeURIComponent(labelFormat),
        { credentials: 'include' }
      );
      if (!res.ok) {
        const data = await res.json().catch(function () {
          return {};
        });
        throw new Error(data.message || data.error || 'Could not build name badges');
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      const suffix =
        eventId !== 'all' ? '-' + String(eventId).replace(/^rec/, '').slice(0, 8) : '-all-events';
      link.href = URL.createObjectURL(blob);
      link.download = 'name-badges-' + labelFormat + suffix + '.pdf';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      alert(e.message || 'Could not build name badges');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev || '⬇ Export name badges (PDF)';
      }
    }
  }

  function attendeeApplicationAnswersHtml(a) {
    const applicationStatus = String(a.applicationStatus || '').trim();
    const isPending = applicationStatus === 'Pending';
    const isDenied = applicationStatus === 'Denied';
    const industry = String(a.screeningIndustry || '').trim();
    const jobTitle = String(a.screeningJobTitle || '').trim();
    const dietary = String(a.dietaryRequirements || '').trim();
    const accessibility = String(a.accessibilityRequirements || '').trim();
    const denialReason = String(a.applicationDenialReason || '').trim();
    if (!isPending && !isDenied && !industry && !jobTitle && !dietary && !accessibility) return '—';
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
    if (dietary) {
      rows.push(
        '<div class="org-application-answer">' +
          '<span class="org-application-answer-label">Dietary</span>' +
          '<span class="org-application-answer-value">' +
          esc(dietary) +
          '</span>' +
          '</div>'
      );
    }
    if (accessibility) {
      rows.push(
        '<div class="org-application-answer">' +
          '<span class="org-application-answer-label">Accessibility</span>' +
          '<span class="org-application-answer-value">' +
          esc(accessibility) +
          '</span>' +
          '</div>'
      );
    }
    if (isDenied && denialReason) {
      rows.push(
        '<div class="org-application-answer org-application-answer--denial">' +
          '<span class="org-application-answer-label">Denial note sent</span>' +
          '<span class="org-application-answer-value">' +
          esc(denialReason) +
          '</span>' +
          '</div>'
      );
    }
    if (!rows.length) {
      return '<span class="org-application-answers-empty">No answers recorded</span>';
    }
    return '<div class="org-application-answers">' + rows.join('') + '</div>';
  }

  function attendeeActionsHtml(a) {
    if (String(a.applicationStatus || '') === 'Pending') {
      return (
        '<div class="org-application-review" data-review-id="' +
        esc(a.id) +
        '">' +
        '<div class="org-application-review-main">' +
        '<p class="org-application-review-label">Review application</p>' +
        '<div class="org-application-review-buttons">' +
        '<button type="button" class="org-application-approve-btn" data-approve-application="' +
        esc(a.id) +
        '"><span class="org-application-btn-icon" aria-hidden="true">✓</span>Approve</button>' +
        '<button type="button" class="org-application-deny-btn" data-show-deny-form="' +
        esc(a.id) +
        '"><span class="org-application-btn-icon" aria-hidden="true">✕</span>Decline &amp; archive</button>' +
        '</div>' +
        '<button type="button" class="org-application-resend-link" data-resend-application-alert="' +
        esc(a.id) +
        '" title="Send yourself an email about this application">Email me a copy</button>' +
        '</div>' +
        '<div class="org-application-deny-panel" hidden>' +
        '<label class="org-application-deny-label" for="deny-note-' +
        esc(a.id) +
        '">Optional note for the attendee</label>' +
        '<textarea id="deny-note-' +
        esc(a.id) +
        '" class="org-application-deny-note" maxlength="400" rows="3" placeholder="e.g. This session is full for founders in your sector. Try our open networking events instead."></textarea>' +
        '<p class="org-application-deny-hint">Keep this professional and event-related. Leave blank for a standard message. They will move to archived applications and you can reconsider them later if a seat opens.</p>' +
        '<div class="org-application-deny-panel-actions">' +
        '<button type="button" class="org-application-deny-confirm-btn" data-confirm-deny-application="' +
        esc(a.id) +
        '">Send decline &amp; archive</button>' +
        '<button type="button" class="org-application-deny-cancel-btn" data-cancel-deny-application="' +
        esc(a.id) +
        '">Cancel</button>' +
        '</div>' +
        '</div>' +
        '</div>'
      );
    }
    if (a.needsPayment) {
      return (
        '<div class="org-application-review org-application-review--awaiting">' +
        '<p class="org-application-review-label">Awaiting payment</p>' +
        '<p class="org-application-review-hint">The attendee can pay from My Hub.</p>' +
        '<button type="button" class="org-application-resend-approval-btn" data-resend-approval-email="' +
        esc(a.id) +
        '">Resend payment email</button>' +
        '</div>'
      );
    }
    if (
      filters.attendeesView === 'archive' &&
      a.isCategoryExclusivityApplication &&
      String(a.applicationStatus || '') === 'Denied'
    ) {
      return (
        '<div class="org-application-review org-application-review--archive" data-review-id="' +
        esc(a.id) +
        '">' +
        '<p class="org-application-review-label">Archived application</p>' +
        '<p class="org-application-review-hint">Approve now if a seat is open, or move back to pending for another review.</p>' +
        '<div class="org-application-review-buttons">' +
        '<button type="button" class="org-application-approve-btn" data-reconsider-application="' +
        esc(a.id) +
        '" data-reconsider-mode="approve"><span class="org-application-btn-icon" aria-hidden="true">✓</span>Approve now</button>' +
        '<button type="button" class="org-application-reconsider-pending-btn" data-reconsider-application="' +
        esc(a.id) +
        '" data-reconsider-mode="pending">Review again</button>' +
        '</div>' +
        '</div>'
      );
    }
    return '—';
  }

  async function resendApprovalEmail(registrationId) {
    const { ok, data } = await api('/api/organiser/application-decisions', {
      method: 'POST',
      body: JSON.stringify({ registrationId, action: 'resend_approval' }),
    });

    if (!ok || !data.ok) {
      showOrganiserAlert(data.message || data.error || 'Could not resend the approval email.', true);
      alertEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    showOrganiserAlert(data.message || 'Approval email sent.', false);
    alertEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function resendApplicationAlert(registrationId) {
    const { ok, data } = await api('/api/organiser/application-decisions', {
      method: 'POST',
      body: JSON.stringify({ registrationId, action: 'resend_alert' }),
    });

    if (!ok || !data.ok) {
      showOrganiserAlert(data.message || data.error || 'Could not send the application alert email.', true);
      alertEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    showOrganiserAlert(data.message || 'Application alert email sent.', false);
    alertEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function reviewApplication(registrationId, action, denialReason) {
    const attendee = state.attendeesAll.find((row) => row.id === registrationId);
    const name = attendee ? attendee.name : 'this applicant';
    if (action === 'deny' && denialReason === undefined) {
      const ok = window.confirm(
        'Deny the application from ' + name + '? They will be notified by email.'
      );
      if (!ok) return;
    }

    const payload = { registrationId, action };
    if (action === 'deny') {
      payload.denialReason = String(denialReason || '').trim();
    }

    const { ok, data } = await api('/api/organiser/application-decisions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!ok || !data.ok) {
      showOrganiserAlert(data.message || data.error || 'Could not update this application.', true);
      alertEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    if (attendee) {
      attendee.applicationStatus = data.applicationStatus || (action === 'approve' ? 'Approved' : 'Denied');
      if (action === 'deny') {
        attendee.applicationDenialReason =
          String(data.registration?.application_denial_reason || denialReason || '').trim();
        attendee.applicationDecidedAt =
          data.registration?.application_decided_at || new Date().toISOString();
      }
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
    showOrganiserAlert(
      data.message ||
        (action === 'approve' ? 'Application approved.' : 'Application declined and archived.'),
      false
    );
    alertEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function reconsiderApplication(registrationId, mode) {
    const attendee = state.attendeesAll.find((row) => row.id === registrationId);
    const name = attendee ? attendee.name : 'this applicant';
    const reconsiderMode = mode === 'pending' ? 'pending' : 'approve';
    if (reconsiderMode === 'approve') {
      const ok = window.confirm('Approve ' + name + ' from archived applications? They will be notified by email.');
      if (!ok) return;
    }

    const { ok, data } = await api('/api/organiser/application-decisions', {
      method: 'POST',
      body: JSON.stringify({
        registrationId,
        action: 'reconsider',
        reconsiderMode,
      }),
    });

    if (!ok || !data.ok) {
      const message =
        data.error === 'applications_full'
          ? 'No seats available for this event. Approve another attendee first, or increase places on the ticket.'
          : data.message || data.error || 'Could not update this archived application.';
      showOrganiserAlert(message, true);
      alertEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    if (attendee) {
      attendee.applicationStatus = data.applicationStatus || (reconsiderMode === 'approve' ? 'Approved' : 'Pending');
      if (reconsiderMode === 'pending') {
        attendee.applicationDenialReason = '';
        attendee.applicationDecidedAt = '';
      } else if (reconsiderMode === 'approve' && String(data.paymentStatus || '') === 'Free') {
        attendee.paymentStatus = 'Free';
        attendee.amountDisplay = 'Free';
        attendee.applicationDenialReason = '';
      } else if (reconsiderMode === 'approve') {
        attendee.paymentStatus = data.paymentStatus || 'Pending';
        attendee.amountDisplay = 'Awaiting payment';
        attendee.applicationDenialReason = '';
      }
    }
    updatePendingApplicationsNavBadge();
    if (reconsiderMode === 'approve' && filters.attendeesView === 'archive') {
      filters.attendeesView = 'active';
    }
    renderAttendees();
    showOrganiserAlert(
      data.message ||
        (reconsiderMode === 'approve'
          ? 'Application approved from archive.'
          : 'Application moved back to pending review.'),
      false
    );
    alertEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showDenyPanel(registrationId) {
    const review = document.querySelector('[data-review-id="' + registrationId + '"]');
    if (!review) return;
    const main = review.querySelector('.org-application-review-main');
    const panel = review.querySelector('.org-application-deny-panel');
    if (main) main.hidden = true;
    if (panel) {
      panel.hidden = false;
      const textarea = panel.querySelector('.org-application-deny-note');
      if (textarea) textarea.focus();
    }
  }

  function hideDenyPanel(registrationId) {
    const review = document.querySelector('[data-review-id="' + registrationId + '"]');
    if (!review) return;
    const main = review.querySelector('.org-application-review-main');
    const panel = review.querySelector('.org-application-deny-panel');
    if (main) main.hidden = false;
    if (panel) panel.hidden = true;
  }

  function renderAttendees() {
    const body = document.getElementById('attendees-body');
    const empty = document.getElementById('attendees-empty');
    if (!body) return;
    renderAttendeesFilterNote();
    renderAttendeesArchiveNav();
    renderSeatRefillBanner();
    const list = filteredAttendeesList();
    renderAttendeesSummary(list);
    body.innerHTML = '';

    if (!list.length) {
      const hasAttendees = state.attendeesAll.length > 0;
      let title = 'No registrations yet';
      let text = 'Attendees appear here when people book tickets for your events.';
      if (filters.attendeesView === 'archive') {
        title = 'No archived applications';
        text = 'Declined Category Exclusivity applications appear here so you can reconsider them when a seat opens.';
      } else if (hasAttendees) {
        if (filters.attendeesPendingOnly) {
          title = 'No pending applications';
          text = 'No pending applications match this filter.';
        } else if (filters.attendeesRelationship !== 'all') {
          title =
            filters.attendeesRelationship === 'new'
              ? 'No new attendees in this view'
              : 'No returning attendees in this view';
          text = 'Try a different filter or show all attendees.';
        } else {
          title = 'No matching attendees';
          text = 'No attendees match this event filter.';
        }
      }
      setOrgEmpty(empty, { show: true, title, text });
      updatePaginationNav('attendees', { totalPages: 1, start: 0, end: 0, total: 0, page: 1 });
      return;
    }
    setOrgEmpty(empty, { show: false });
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
      } else if (a.needsPayment) {
        tr.className = 'org-attendee-row-awaiting-payment';
      } else if (
        filters.attendeesView === 'archive' &&
        String(a.applicationStatus || '') === 'Denied'
      ) {
        tr.className = 'org-attendee-row-archived';
      }
      const registeredLabel =
        filters.attendeesView === 'archive' && a.applicationDecidedAt
          ? formatDateShort(a.applicationDecidedAt)
          : formatDateShort(a.registeredAt);
      tr.innerHTML =
        '<td class="org-td-name" data-label="Name">' +
        nameCell +
        '</td><td class="org-td-relationship" data-label="Visits">' +
        attendeeGroupRelationshipBadgeHtml(a) +
        '</td><td data-label="Email">' +
        esc(a.email || '—') +
        '</td><td data-label="Event">' +
        esc(eventLabelForRow(a)) +
        '</td><td data-label="Ticket">' +
        esc(a.ticketName) +
        '</td><td data-label="Qty">' +
        esc(String(a.quantity)) +
        '</td><td data-label="Status">' +
        attendeeStatusBadgeHtml(a) +
        '</td><td class="org-td-application-answers" data-label="Application answers">' +
        attendeeApplicationAnswersHtml(a) +
        '</td><td data-label="Paid">' +
        attendeePaidDisplay(a) +
        '</td><td data-label="Registered">' +
        esc(registeredLabel) +
        '</td><td class="org-td-actions" data-label="Actions">' +
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
      opt.textContent = eventFilterOptionLabel(ev);
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
      setOrgEmpty(empty, {
        show: true,
        title: 'Could not load cancellations',
        text: (data.message || data.error || 'Please refresh and try again.') + '.',
      });
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
      const hasRows = state.cancellationsAll.length > 0;
      setOrgEmpty(empty, {
        show: true,
        title: hasRows ? 'No matching cancellations' : 'No cancellations yet',
        text: hasRows
          ? 'No cancellations match this event filter.'
          : 'When someone cancels their own booking, it will appear here.',
      });
      updatePaginationNav('cancellations', { totalPages: 1, start: 0, end: 0, total: 0, page: 1 });
      return;
    }
    setOrgEmpty(empty, { show: false });
    const pageInfo = paginateList(list, listPages.cancellations);
    listPages.cancellations = pageInfo.page;
    updatePaginationNav('cancellations', pageInfo);

    pageInfo.items.forEach((row) => {
      const tr = document.createElement('tr');
      const refundClass =
        row.refundStatus === 'completed'
          ? 'org-badge org-badge-green'
          : row.refundStatus === 'pending'
            ? 'org-badge org-badge-gold'
            : 'org-badge org-badge-purple';
      const bookingRef = row.bookingReference || formatBookingReference(row.id);
      let actionHtml = '—';
      if (row.refundStatus === 'pending' && state.stripeConnectEnabled && row.organiserId) {
        actionHtml =
          '<button type="button" class="org-btn org-btn-sm org-btn-gold" data-stripe-dashboard="' +
          esc(row.organiserId) +
          '" title="Open Stripe Express to issue a refund">Refund in Stripe</button>';
      } else if (row.refundStatus === 'completed') {
        actionHtml = '<span class="org-muted">Refund issued</span>';
      }
      tr.innerHTML =
        '<td class="org-td-name">' +
        esc(row.name) +
        '</td><td>' +
        esc(row.email || '—') +
        '</td><td class="org-booking-ref">' +
        esc(bookingRef) +
        '</td><td>' +
        esc(eventLabelForRow(row)) +
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
        '</span></td><td>' +
        actionHtml +
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

  function eventRowIsArchived(ev) {
    if (!ev) return false;
    if (ev.isSeries && ev.seriesEvents && ev.seriesEvents.length) {
      return ev.seriesEvents.every(function (child) {
        return eventRowIsArchived(child);
      });
    }
    const key = String(ev.statusKey || ev.status || '').toLowerCase();
    if (key === 'archived') return true;
    if (key === 'cancelled') return false;

    const startRaw = eventOccurrenceRaw(ev);
    if (!startRaw) return false;
    const start = new Date(startRaw);
    if (Number.isNaN(start.getTime())) return false;

    const endRaw = eventEndRaw(ev);
    if (endRaw) {
      const end = new Date(endRaw);
      if (!Number.isNaN(end.getTime())) {
        const spanMs = end.getTime() - start.getTime();
        // Trust a normal event end (same day / overnight). Long ends_at often means
        // recurrence or bad data — fall through to the start-day check instead.
        if (spanMs >= 0 && spanMs <= 36 * 60 * 60 * 1000) {
          return end.getTime() <= Date.now();
        }
      }
    }

    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return startDay < today;
  }

  function attendeesEventPickerOptions() {
    const list = allEventOptions().filter(function (ev) {
      return (
        !filters.attendeesHideArchived ||
        !eventRowIsArchived(ev) ||
        ev.id === filters.attendeesEvent
      );
    });
    const titleDateCount = new Map();
    list.forEach(function (ev) {
      const key =
        String(ev.title || '')
          .trim()
          .toLowerCase() +
        '|' +
        formatDateShort(eventOccurrenceRaw(ev) || '');
      titleDateCount.set(key, (titleDateCount.get(key) || 0) + 1);
    });
    return list.map(function (ev) {
      const key =
        String(ev.title || '')
          .trim()
          .toLowerCase() +
        '|' +
        formatDateShort(eventOccurrenceRaw(ev) || '');
      const duplicate = (titleDateCount.get(key) || 0) > 1;
      const groupName = duplicate ? groupNameForEvent(ev) : '';
      let label = eventFilterOptionLabel(ev, {
        includeTime: duplicate,
        groupName: groupName,
      });
      if (duplicate && !groupName) {
        label += ' · #' + String(ev.id).replace(/^rec/, '').slice(-4);
      }
      return {
        id: ev.id,
        ev: ev,
        label: label,
        archived: eventRowIsArchived(ev),
        searchText: (
          String(ev.title || '') +
          ' ' +
          formatDateShort(eventOccurrenceRaw(ev) || '') +
          ' ' +
          groupName +
          ' ' +
          String(ev.id || '')
        ).toLowerCase(),
      };
    });
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
    if (filters.eventsHideArchived) {
      list = list.filter((ev) => !eventRowIsArchived(ev));
    }
    list = groupEventsIntoSeries(list);
    if (filters.eventsHideArchived) {
      list = list.filter((ev) => !eventRowIsArchived(ev));
    }
    return list;
  }

  async function ensureAllEventsForGrouping() {
    if (eventsFiltersActive() || state.eventsFullyLoaded) return;
    if (!state.eventsHasMore) {
      state.eventsFullyLoaded = true;
      return;
    }
    if (eventsGroupingPromise) return eventsGroupingPromise;

    eventsGroupingPromise = (async function () {
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
        eventsGroupingPromise = null;
      }
    })();

    return eventsGroupingPromise;
  }

  function filteredTicketsList() {
    let list = state.tickets.slice();
    if (filters.ticketsEvent !== 'all') {
      list = list.filter((t) => t.eventId === filters.ticketsEvent);
    }
    if (filters.ticketsType !== 'all') {
      list = list.filter((t) => String(t.name || '') === filters.ticketsType);
    }
    if (filters.ticketsScope === 'current') {
      list = list.filter((t) => ticketBelongsToCurrentEvent(t));
    } else if (filters.ticketsScope === 'active') {
      list = list.filter((t) => ticketBelongsToCurrentEvent(t) && ticketTierIsActive(t));
    }
    return list;
  }

  function ticketEventForRow(t) {
    if (!t || !t.eventId) return null;
    return state.events.find((e) => e.id === t.eventId) || null;
  }

  function ticketBelongsToCurrentEvent(t) {
    const ev = ticketEventForRow(t);
    if (!ev) return true;
    if (eventRowIsArchived(ev)) return false;
    const key = String(ev.statusKey || '').toLowerCase();
    return (
      key === 'live' ||
      key === 'upcoming' ||
      key === 'pending_approval' ||
      key === 'pending'
    );
  }

  function ticketTierIsActive(t) {
    const statusLower = String(t?.status || 'Active').trim().toLowerCase();
    return statusLower === 'active';
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
        opt.textContent = eventFilterOptionLabel(ev);
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

    const ticketScopeSel = document.getElementById('filter-tickets-scope');
    if (ticketScopeSel) ticketScopeSel.value = filters.ticketsScope || 'current';

    const reviewGroupSel = document.getElementById('filter-reviews-group');
    if (reviewGroupSel) {
      reviewGroupSel.innerHTML = '<option value="all">All organiser pages</option>';
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
    if (!ev || !ev.id) return '/organiser/event-edit';
    return '/organiser/event-edit?id=' + encodeURIComponent(ev.id);
  }

  function goToEventEditor(ev, editorOpts) {
    openEventEditorDrawer(ev, editorOpts);
  }

  function eventEditorFrameUrl(opts) {
    const frameParams = new URLSearchParams();
    frameParams.set('embed', '1');
    if (opts && opts.editId) {
      frameParams.set('id', opts.editId);
      if (opts.seriesEdit) frameParams.set('seriesEdit', '1');
      if (opts.seriesDate) frameParams.set('seriesDate', '1');
    } else {
      frameParams.set('format', (opts && opts.format) || 'in-person');
      if (opts && opts.groupId) frameParams.set('groupId', opts.groupId);
    }
    return '/organiser/event-edit?' + frameParams.toString();
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
      redirectEventsToOrganiserSetup();
      return;
    }
    openNewEventEditorDrawer();
  }

  let eventDrawerLoadTimeout = null;
  let eventDrawerCreateFlow = false;
  let eventDrawerTicketsBackId = '';

  function setEventDrawerBackButton(show, eventId) {
    const backBtn = document.getElementById('org-event-drawer-back');
    eventDrawerTicketsBackId = show && eventId ? String(eventId) : '';
    if (!backBtn) return;
    backBtn.hidden = !eventDrawerTicketsBackId;
  }

  function goBackFromEventTicketsDrawer() {
    if (!eventDrawerTicketsBackId) return;
    openEventEditorDrawer(eventDrawerTicketsBackId, { fromTickets: true });
  }

  const EVENT_DRAWER_PROGRESS_STEPS = [
    { id: 'format', label: 'Group & format' },
    { id: 'details', label: 'Event details' },
    { id: 'tickets', label: 'Tickets' },
    { id: 'publish', label: 'Publish' },
  ];

  function setEventDrawerLoading(on, message) {
    const wrap = document.getElementById('org-event-drawer-frame-wrap');
    const loading = document.getElementById('org-event-drawer-loading');
    if (wrap) wrap.classList.toggle('is-loading', on);
    if (loading) {
      const textEl = loading.querySelector('.org-event-drawer-loading-text');
      if (textEl) {
        textEl.textContent = on
          ? String(message || '').trim() || 'Loading event…'
          : 'Loading event…';
      }
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
    setEventDrawerBackButton(false);
    eventDrawerCreateFlow = false;
    renderEventDrawerOverview(null);
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
      '/organiser/event-tickets?ids=' + encodeURIComponent((eventIds || []).join(',')) + '&embed=1'
    );
  }

  function openEventDrawerFrame(frameUrl, titleText, eventForOverview, drawerUi) {
    const drawer = document.getElementById('org-event-drawer');
    const frame = document.getElementById('org-event-drawer-frame');
    const titleEl = document.getElementById('org-event-drawer-title');
    if (!drawer || !frame) {
      location.href = frameUrl.replace('&embed=1', '').replace('embed=1&', '').replace('?embed=1', '?');
      return false;
    }

    closeAllActionMenus();
    renderEventDrawerOverview(eventForOverview || null, drawerUi || null);
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

  function renderEventDrawerProgress(stepId) {
    const mount = document.getElementById('org-event-drawer-progress');
    if (!mount) return;
    if (!stepId) {
      mount.hidden = true;
      mount.innerHTML = '';
      return;
    }

    const currentIndex = EVENT_DRAWER_PROGRESS_STEPS.findIndex(function (s) {
      return s.id === stepId;
    });
    if (currentIndex < 0) {
      mount.hidden = true;
      mount.innerHTML = '';
      return;
    }

    const stepNum = currentIndex + 1;
    const total = EVENT_DRAWER_PROGRESS_STEPS.length;
    const remaining = Math.max(0, total - stepNum);
    const currentLabel = EVENT_DRAWER_PROGRESS_STEPS[currentIndex].label;
    const remainingText =
      stepId === 'publish'
        ? 'Listing complete'
        : remaining === 1
          ? '1 step left'
          : remaining + ' steps left';

    const parts = [
      '<nav class="ee-wizard" aria-label="Create event progress">',
      '<p class="ee-wizard-summary">',
      '<span class="ee-wizard-step-count">Step ',
      String(stepNum),
      ' of ',
      String(total),
      '</span>',
      '<span class="ee-wizard-sep" aria-hidden="true">·</span>',
      '<span class="ee-wizard-current">',
      esc(currentLabel),
      '</span>',
      '<span class="ee-wizard-sep" aria-hidden="true">·</span>',
      '<span class="ee-wizard-remaining">',
      esc(remainingText),
      '</span>',
      '</p>',
      '<ol class="ee-wizard-steps">',
    ];

    EVENT_DRAWER_PROGRESS_STEPS.forEach(function (step, i) {
      const isCurrent = step.id === stepId;
      const isDone = i < currentIndex;
      let cls = 'ee-wizard-step';
      if (isCurrent) cls += ' is-current';
      else if (isDone) cls += ' is-done';

      const numContent = isDone ? '✓' : String(i + 1);
      parts.push('<li class="' + cls + '"');
      if (isCurrent) parts.push(' aria-current="step"');
      parts.push('>');
      parts.push(
        '<span class="ee-wizard-link"><span class="ee-wizard-num" aria-hidden="true">' +
          numContent +
          '</span><span class="ee-wizard-label">' +
          esc(step.label) +
          '</span></span>'
      );
      parts.push('</li>');
    });

    parts.push('</ol></nav>');
    mount.innerHTML = parts.join('');
    mount.hidden = false;
  }

  function renderEventDrawerOverview(ev, drawerUi) {
    const wrap = document.getElementById('org-event-drawer-stats');
    const cancelRow = document.getElementById('org-event-drawer-cancel');
    const progressStep = drawerUi && drawerUi.progressStep ? drawerUi.progressStep : null;
    renderEventDrawerProgress(progressStep);

    if (!wrap) return;
    if (progressStep || !ev || !ev.id) {
      wrap.hidden = true;
      if (cancelRow) cancelRow.hidden = true;
      return;
    }
    const ticketsEl = document.getElementById('org-event-drawer-stat-tickets');
    const revenueEl = document.getElementById('org-event-drawer-stat-revenue');
    const statusEl = document.getElementById('org-event-drawer-stat-status');
    if (ticketsEl) {
      ticketsEl.textContent =
        ev.ticketsSoldLabel || formatTicketsSoldLabel(ev.ticketsSold, ev.ticketsCapacity);
    }
    if (revenueEl) {
      revenueEl.textContent = ev.revenueDisplay || formatGbpAmount(ev.revenueNum || 0);
    }
    if (statusEl) {
      statusEl.textContent = ev.statusLabel || ev.statusKey || 'Draft';
    }
    wrap.hidden = false;
    if (cancelRow) {
      const canCancel = eventCanCancel(ev);
      cancelRow.hidden = !canCancel;
      const btn = document.getElementById('org-event-drawer-cancel-btn');
      if (btn) {
        btn.setAttribute('data-cancel-event', ev.id);
        const sold = eventEffectiveTicketsSold(ev);
        btn.textContent =
          sold > 0 ? 'Cancel this date (' + sold + ' sold)' : 'Cancel this event';
      }
    }
  }

  function openEventTicketsDrawer(eventIds, title) {
    const label = title ? 'Tickets: ' + title : 'Set up tickets';
    const drawerUi = eventDrawerCreateFlow ? { progressStep: 'tickets' } : null;
    const backId = Array.isArray(eventIds) && eventIds.length ? eventIds[0] : '';
    setEventDrawerBackButton(Boolean(backId), backId);
    openEventDrawerFrame(eventTicketsFrameUrl(eventIds), label, null, drawerUi);
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
        location.href = '/organiser/event-edit?' + qs.toString();
      } else {
        const qs = new URLSearchParams();
        if (editId) qs.set('id', editId);
        else qs.set('format', 'in-person');
        if (drawerOpts.seriesEdit) qs.set('seriesEdit', '1');
        if (drawerOpts.seriesDate) qs.set('seriesDate', '1');
        location.href = '/organiser/event-edit?' + qs.toString();
      }
      return;
    }

    let frameUrl;
    let drawerTitle = 'Edit event';
    if (isNew) {
      eventDrawerCreateFlow = true;
      drawerTitle = 'New event';
      frameUrl = eventEditorFrameUrl({
        groupId: drawerOpts.groupId || '',
        format: drawerOpts.format || 'in-person',
      });
      setEventDrawerBackButton(false);
      openEventDrawerFrame(frameUrl, drawerTitle, null, { progressStep: 'details' });
      return;
    } else {
      if (!drawerOpts.fromTickets) {
        eventDrawerCreateFlow = false;
      }
      const ev =
        typeof eventOrId === 'object' && eventOrId && eventOrId.title
          ? eventOrId
          : findEventById(editId);
      if (!ev || !ev.id) {
        if (drawerOpts.fromTickets && editId) {
          frameUrl = eventEditorFrameUrl({ editId: editId });
          const drawerUi = eventDrawerCreateFlow ? { progressStep: 'details' } : null;
          setEventDrawerBackButton(false);
          openEventDrawerFrame(frameUrl, 'Edit event', null, drawerUi);
          return;
        }
        showOrganiserAlert(
          'That event is no longer available — it may have been deleted. Check My Events for your current listings.',
          true
        );
        return;
      }
      if (drawerOpts.seriesDate) {
        drawerTitle = 'Edit date in series';
      } else {
        drawerTitle = ev.title ? 'Edit: ' + ev.title : 'Edit event';
      }
      const frameOpts = { editId: editId };
      if (drawerOpts.seriesEdit) frameOpts.seriesEdit = true;
      if (drawerOpts.seriesDate) frameOpts.seriesDate = true;
      if (!drawerOpts.seriesDate && ev.isSeries && ev.seriesCount > 1) {
        frameOpts.seriesEdit = true;
      }
      frameUrl = eventEditorFrameUrl(frameOpts);
      const drawerUi =
        eventDrawerCreateFlow && drawerOpts.fromTickets ? { progressStep: 'details' } : null;
      setEventDrawerBackButton(false);
      openEventDrawerFrame(frameUrl, drawerTitle, drawerUi ? null : ev, drawerUi);
      return;
    }
  }

  let pendingDeleteEventId = null;
  let pendingDuplicateEventId = null;
  let pendingDuplicateGroupId = null;

  function openDeleteEventModal(eventId) {
    if (!eventId) return;
    closeEventEditorDrawer();
    pendingDeleteEventId = eventId;
    const modal = document.getElementById('modal-event-delete');
    const titleEl = document.getElementById('modal-event-delete-name');
    const seriesEl = document.getElementById('modal-event-delete-series');
    const soldEl = document.getElementById('modal-event-delete-sold');
    const ev = findEventById(eventId);
    const label = ev && ev.title ? ev.title : 'this event';
    const dateLabel = ev && ev.date ? formatDateShort(ev.date) : '';
    const sold = eventTicketsSoldCount(ev);
    const isSeriesDate =
      dateLabel &&
      groupEventsIntoSeries(state.events || []).some(function (row) {
        return (
          row.isSeries &&
          row.seriesCount > 1 &&
          row.seriesEvents &&
          row.seriesEvents.some(function (child) {
            return child.id === eventId;
          })
        );
      });

    if (titleEl) {
      titleEl.textContent =
        '"' + label + '"' + (dateLabel ? ' · ' + dateLabel : '');
    }
    if (seriesEl) {
      seriesEl.hidden = !isSeriesDate;
      seriesEl.textContent = isSeriesDate
        ? 'Only this date will be removed. Other dates in the series stay as they are.'
        : '';
    }
    if (soldEl) {
      if (sold > 0) {
        soldEl.hidden = false;
        soldEl.textContent =
          'This date has ' +
          sold +
          ' ticket' +
          (sold === 1 ? '' : 's') +
          ' sold — use Cancel instead of Delete so attendees can be refunded.';
      } else {
        soldEl.hidden = true;
        soldEl.textContent = '';
      }
    }
    if (modal) {
      modal.removeAttribute('hidden');
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.add('is-open');
      document.body.classList.add('org-cancel-modal-open');
    }
  }

  async function submitDeleteEvent() {
    if (!pendingDeleteEventId) return;
    const eventId = pendingDeleteEventId;
    const ev = findEventById(eventId);
    if (eventTicketsSoldCount(ev) > 0) {
      closeModals();
      openCancelEventModal(eventId);
      return;
    }
    const confirmBtn = document.getElementById('btn-event-delete-confirm');
    if (confirmBtn) confirmBtn.disabled = true;
    const res = await api('/api/organiser/events', {
      method: 'DELETE',
      body: JSON.stringify({ id: eventId }),
    });
    if (!res.ok) {
      if (confirmBtn) confirmBtn.disabled = false;
      showOrganiserAlert(res.data.message || res.data.error || 'Could not delete this event.', true);
      return;
    }
    closeModals();
    closeEventEditorDrawer();
    clearEventScopedClientState(eventId);
    await loadBootstrap({ silent: true });
    pruneStaleEventFilters();
    setRoute('events-list');
    showOrganiserAlert(res.data.message || 'Event deleted.', false);
  }

  function confirmDeleteEvent(eventId) {
    openDeleteEventModal(eventId);
  }

  function resolveSeriesPeersForEvent(ev) {
    if (!ev || !ev.id) return { eventIds: [], events: [] };
    const allEvents = state.events.slice();
    (state.upcomingEvents || []).forEach(function (peer) {
      if (peer && peer.id && !allEvents.some(function (e) {
        return e.id === peer.id;
      })) {
        allEvents.push(peer);
      }
    });
    const key = eventSeriesBucketKey(ev, { allEvents: allEvents });
    if (key.indexOf('solo:') === 0) {
      return {
        eventIds: [ev.id],
        events: [
          {
            id: ev.id,
            title: ev.title,
            date: ev.date,
            imageUrl: ev.imageUrl || '',
          },
        ],
      };
    }
    const peers = allEvents.filter(function (peer) {
      return eventSeriesBucketKey(peer, { allEvents: allEvents }) === key;
    });
    const sorted = sortEventsByDate(peers);
    return {
      eventIds: sorted.map(function (item) {
        return item.id;
      }),
      events: sorted.map(function (item) {
        return {
          id: item.id,
          title: item.title,
          date: item.date,
          imageUrl: item.imageUrl || '',
        };
      }),
    };
  }

  function goToEventTickets(ev) {
    if (!ev || !ev.id) return;
    let eventIds;
    let seriesEvents;
    if (ev.isSeries && ev.seriesEventIds && ev.seriesEventIds.length) {
      eventIds = ev.seriesEventIds;
      seriesEvents = ev.seriesEvents || [];
    } else {
      const resolved = resolveSeriesPeersForEvent(ev);
      eventIds = resolved.eventIds.length ? resolved.eventIds : [ev.id];
      seriesEvents =
        resolved.events.length > 0
          ? resolved.events
          : [
              {
                id: ev.id,
                title: ev.title,
                date: ev.date,
                imageUrl: ev.imageUrl || '',
              },
            ];
    }
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
    location.href = '/organiser/event-tickets?ids=' + encodeURIComponent(eventIds.join(','));
  }

  function groupEditorUrl(g) {
    if (!g || !g.id) return '/organiser/group-edit';
    return '/organiser/group-edit?id=' + encodeURIComponent(g.id);
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
      location.href = id ? '/organiser/group-edit?id=' + encodeURIComponent(id) : '/organiser/group-edit';
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

  function eventExistsInState(eventId) {
    const id = String(eventId || '').trim();
    if (!id) return false;
    if (state.events.some((e) => e.id === id)) return true;
    if ((state.upcomingEvents || []).some((e) => e.id === id)) return true;
    if ((state.eventSummaries || []).some((e) => e.id === id)) return true;
    return false;
  }

  function pruneStaleEventFilters() {
    let changed = false;
    ['attendeesEvent', 'ticketsEvent', 'cancellationsEvent'].forEach((key) => {
      if (filters[key] !== 'all' && !eventExistsInState(filters[key])) {
        filters[key] = 'all';
        changed = true;
      }
    });
    if (changed) {
      const url = new URL(window.location.href);
      url.searchParams.delete('eventId');
      url.searchParams.delete('event_id');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    return changed;
  }

  function clearEventScopedClientState(eventId) {
    const id = String(eventId || '').trim();
    if (!id) return;
    if (filters.attendeesEvent === id) filters.attendeesEvent = 'all';
    if (filters.ticketsEvent === id) filters.ticketsEvent = 'all';
    if (filters.cancellationsEvent === id) filters.cancellationsEvent = 'all';
    expandedSeriesKeys.clear();
    try {
      const raw = sessionStorage.getItem(SERIES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const eventIds = (parsed.eventIds || []).filter((eid) => String(eid) !== id);
      const events = (parsed.events || []).filter((ev) => ev && String(ev.id) !== id);
      if (!eventIds.length) {
        sessionStorage.removeItem(SERIES_STORAGE_KEY);
      } else if (
        eventIds.length !== (parsed.eventIds || []).length ||
        events.length !== (parsed.events || []).length
      ) {
        sessionStorage.setItem(
          SERIES_STORAGE_KEY,
          JSON.stringify({ ...parsed, eventIds: eventIds, events: events })
        );
      }
    } catch {
      /* ignore */
    }
  }

  function openDuplicateEventModal(eventId) {
    if (!eventId) return;
    pendingDuplicateEventId = eventId;
    const modal = document.getElementById('modal-event-duplicate');
    const nameEl = document.getElementById('modal-event-duplicate-name');
    const confirmBtn = document.getElementById('btn-event-duplicate-confirm');
    const ev = findEventById(eventId);
    const label = ev && ev.title ? ev.title : 'this event';
    if (nameEl) {
      nameEl.textContent = '“' + label + '”';
    }
    if (confirmBtn) confirmBtn.disabled = false;
    if (modal) {
      modal.removeAttribute('hidden');
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.add('is-open');
      document.body.classList.add('org-cancel-modal-open');
    }
  }

  async function submitDuplicateEvent() {
    if (!pendingDuplicateEventId) return;
    const eventId = pendingDuplicateEventId;
    const confirmBtn = document.getElementById('btn-event-duplicate-confirm');
    if (confirmBtn) confirmBtn.disabled = true;
    const res = await api('/api/organiser/events', {
      method: 'POST',
      body: JSON.stringify({ action: 'duplicate', id: eventId }),
    });
    if (!res.ok) {
      if (confirmBtn) confirmBtn.disabled = false;
      showOrganiserAlert(res.data.message || res.data.error || 'Could not duplicate this event.', true);
      return;
    }
    closeModals();
    showOrganiserAlert(
      res.data.message || 'Event duplicated as a draft — add dates and publish when ready.',
      false
    );
    await loadBootstrap();
    renderAll();
    setRoute('events-list');
    if (res.data.event && res.data.event.id) {
      openEventEditorDrawer(res.data.event);
    }
  }

  function confirmDuplicateEvent(eventId) {
    openDuplicateEventModal(eventId);
  }

  function openDuplicateGroupModal(groupId) {
    if (!groupId) return;
    pendingDuplicateGroupId = groupId;
    const modal = document.getElementById('modal-group-duplicate');
    const nameEl = document.getElementById('modal-group-duplicate-name');
    const confirmBtn = document.getElementById('btn-group-duplicate-confirm');
    const g = findGroupById(groupId);
    const label = g && g.name ? g.name : 'this group';
    if (nameEl) {
      nameEl.textContent = '“' + label + '”';
    }
    if (confirmBtn) confirmBtn.disabled = false;
    if (modal) {
      modal.removeAttribute('hidden');
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.add('is-open');
      document.body.classList.add('org-cancel-modal-open');
    }
  }

  async function submitDuplicateGroup() {
    if (!pendingDuplicateGroupId) return;
    const groupId = pendingDuplicateGroupId;
    const confirmBtn = document.getElementById('btn-group-duplicate-confirm');
    if (confirmBtn) confirmBtn.disabled = true;
    const res = await api('/api/organiser/groups', {
      method: 'POST',
      body: JSON.stringify({ action: 'duplicate', id: groupId }),
    });
    if (!res.ok) {
      if (confirmBtn) confirmBtn.disabled = false;
      showOrganiserAlert(res.data.message || res.data.error || 'Could not duplicate this group.', true);
      return;
    }
    closeModals();
    showOrganiserAlert(res.data.message || 'Group duplicated.', false);
    await loadBootstrap();
    renderAll();
    setRoute('groups');
    if (res.data.group && res.data.group.id) {
      openGroupEditorDrawer(res.data.group.id);
    }
  }

  function confirmDuplicateGroup(groupId) {
    openDuplicateGroupModal(groupId);
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
    const cancelBtn = e.target.closest('[data-cancel-event]');
    if (cancelBtn && !cancelBtn.disabled) {
      e.preventDefault();
      e.stopPropagation();
      closeAllActionMenus();
      const eid = cancelBtn.getAttribute('data-cancel-event');
      if (eid) openCancelEventModal(eid);
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

    const seriesParentRow = e.target.closest('tr.org-series-parent-row');
    if (
      seriesParentRow &&
      !e.target.closest(
        '.org-td-actions, .org-action-wrap, [data-org-action-toggle], .org-series-dates-panel'
      )
    ) {
      e.preventDefault();
      e.stopPropagation();
      toggleSeriesExpand(seriesParentRow.getAttribute('data-series-key'));
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

    const duplicateEventBtn = e.target.closest('[data-duplicate-event]');
    if (duplicateEventBtn && !duplicateEventBtn.disabled) {
      e.preventDefault();
      e.stopPropagation();
      closeAllActionMenus();
      confirmDuplicateEvent(duplicateEventBtn.getAttribute('data-duplicate-event'));
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
      const editorOpts = {};
      if (editEventBtn.getAttribute('data-edit-series-date') === '1') {
        editorOpts.seriesDate = true;
      }
      if (ev) goToEventEditor(ev, editorOpts);
      else if (eid) openEventEditorDrawer(eid, editorOpts);
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
      else if (eid) location.href = '/organiser/event-tickets?ids=' + encodeURIComponent(eid);
      return true;
    }

    const alumniInvitesBtn = e.target.closest('[data-send-alumni-invites]');
    if (alumniInvitesBtn && !alumniInvitesBtn.disabled) {
      e.preventDefault();
      e.stopPropagation();
      closeAllActionMenus();
      const eid = alumniInvitesBtn.getAttribute('data-send-alumni-invites');
      if (eid) openAlumniInvitesModal(eid);
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
        setAttendeesEventFilterValue(eventId, { skipRender: true });
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

    return false;
  }

  let pendingPayoutEventId = null;
  let pendingAlumniInviteEventId = null;
  let pendingCancelEventId = null;
  let pendingCancelRefundRequired = false;

  function syncCancelModalRefundUi(opts) {
    const ev = opts.ev;
    const sold = opts.sold;
    const ctx = opts.ctx || null;
    const isSeriesDate = opts.isSeriesDate;
    const refundRow = document.getElementById('event-cancel-refund-row');
    const ticketsEl = document.getElementById('modal-event-cancel-tickets');
    const warningEl = document.getElementById('modal-event-cancel-warning');
    const refundLabel = document.getElementById('event-cancel-refund-label');
    const confirmBtn = document.getElementById('btn-event-cancel-confirm');
    const checkbox = document.getElementById('event-cancel-refund-confirm');
    const requiresRefund = cancelRequiresRefundConfirmation(ev, ctx);
    pendingCancelRefundRequired = requiresRefund;
    const paidCount =
      ctx && ctx.paidBookings != null ? Number(ctx.paidBookings) : requiresRefund ? sold : 0;

    if (refundRow) refundRow.hidden = !requiresRefund;
    if (checkbox && !requiresRefund) checkbox.checked = false;

    if (ticketsEl) {
      if (requiresRefund) {
        ticketsEl.hidden = false;
        ticketsEl.textContent =
          'You have sold ' +
          paidCount +
          ' paid ticket' +
          (paidCount === 1 ? '' : 's') +
          ' for this event. We will refund every paying attendee automatically when you confirm.';
      } else if (sold > 0) {
        ticketsEl.hidden = false;
        ticketsEl.textContent =
          sold +
          ' registration' +
          (sold === 1 ? '' : 's') +
          ' on this date — all free, so no Stripe refund is required.';
      } else {
        ticketsEl.hidden = false;
        ticketsEl.textContent =
          'No tickets have been sold for this date. It will be removed from your listings.';
      }
    }

    if (warningEl) {
      if (requiresRefund) {
        const base =
          'Cancelling will automatically refund all paying attendees through Stripe. This cannot be undone.';
        warningEl.textContent = isSeriesDate
          ? 'Only this date will be cancelled — other dates in the series stay live. ' + base
          : base;
      } else {
        warningEl.textContent = isSeriesDate
          ? 'Only this date will be cancelled — other dates in the series stay live. No attendee refunds are required.'
          : 'This event will be cancelled and removed from listings. No attendee refunds are required.';
      }
    }

    if (refundLabel) {
      refundLabel.textContent = requiresRefund
        ? 'I understand all ' +
          paidCount +
          ' paying attendee' +
          (paidCount === 1 ? '' : 's') +
          ' will receive an automatic full refund'
        : '';
    }

    if (confirmBtn) confirmBtn.disabled = requiresRefund ? !(checkbox && checkbox.checked) : false;
  }

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

  function closeAlumniInvitesModal() {
    pendingAlumniInviteEventId = null;
    const modal = document.getElementById('modal-alumni-invites');
    if (modal) modal.hidden = true;
    const errEl = document.getElementById('modal-alumni-invites-error');
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    const sendBtn = document.getElementById('modal-alumni-invites-send');
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send invites';
    }
  }

  async function openAlumniInvitesModal(eventId) {
    pendingAlumniInviteEventId = eventId;
    const modal = document.getElementById('modal-alumni-invites');
    const titleEl = document.getElementById('modal-alumni-invites-event');
    const sourceSel = document.getElementById('modal-alumni-source-event');
    const statsEl = document.getElementById('modal-alumni-invites-stats');
    const errEl = document.getElementById('modal-alumni-invites-error');
    const sendBtn = document.getElementById('modal-alumni-invites-send');
    if (!modal || !sourceSel) return;

    const ev = findEventById(eventId);
    if (titleEl) titleEl.textContent = ev ? ev.title : 'Event';
    if (statsEl) statsEl.hidden = true;
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    sourceSel.innerHTML = '<option value="">Loading…</option>';
    if (sendBtn) sendBtn.disabled = true;
    openModal('modal-alumni-invites');

    const { ok, data } = await api(
      '/api/organiser/alumni-invites?eventId=' +
        encodeURIComponent(eventId) +
        '&action=sources'
    );
    if (!ok) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = data.message || data.error || 'Could not load source events';
      }
      sourceSel.innerHTML = '<option value="">No source events available</option>';
      return;
    }

    const sources = Array.isArray(data.sourceEvents) ? data.sourceEvents : [];
    if (!sources.length) {
      sourceSel.innerHTML = '<option value="">No past events with confirmed attendees</option>';
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent =
          'Publish a previous event with confirmed attendees first, then return here to invite previous attendees.';
      }
      return;
    }

    const defaultId =
      data.targetEvent?.alumniSourceEventId ||
      data.targetEvent?.alumni_source_event_id ||
      '';
    sourceSel.innerHTML = sources
      .map(function (row) {
        const label =
          (row.title || 'Event') +
          ' (' +
          (row.confirmedAttendeeCount || 0) +
          ' attendee' +
          (row.confirmedAttendeeCount === 1 ? '' : 's') +
          ')';
        return (
          '<option value="' +
          esc(row.id) +
          '"' +
          (row.id === defaultId ? ' selected' : '') +
          '>' +
          esc(label) +
          '</option>'
        );
      })
      .join('');
    if (sendBtn) sendBtn.disabled = false;

    const statsRes = await api(
      '/api/organiser/alumni-invites?eventId=' + encodeURIComponent(eventId)
    );
    if (statsRes.ok && statsRes.data.stats && statsEl) {
      const s = statsRes.data.stats;
      if (s.total > 0) {
        statsEl.textContent =
          'Invites on this event: ' +
          s.sent +
          ' sent · ' +
          s.redeemed +
          ' redeemed · ' +
          s.pending +
          ' pending';
        statsEl.hidden = false;
      }
    }
  }

  async function submitAlumniInvites() {
    if (!pendingAlumniInviteEventId) return;
    const sourceSel = document.getElementById('modal-alumni-source-event');
    const sourceEventId = sourceSel ? String(sourceSel.value || '').trim() : '';
    const errEl = document.getElementById('modal-alumni-invites-error');
    const sendBtn = document.getElementById('modal-alumni-invites-send');
    if (!sourceEventId) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = 'Choose the source event whose attendees you want to invite.';
      }
      return;
    }
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending…';
    }
    const { ok, data } = await api('/api/organiser/alumni-invites', {
      method: 'POST',
      body: JSON.stringify({
        targetEventId: pendingAlumniInviteEventId,
        sourceEventId,
      }),
    });
    if (!ok) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = data.message || data.error || 'Could not send previous attendee invites';
      }
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send invites';
      }
      return;
    }
    closeModals();
    showOrganiserAlert(data.message || 'Previous attendee invites sent.', false);
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
    showOrganiserAlert(data.message || 'Payout request submitted.', false);
    await refresh();
    setRoute('events-revenue');
  }

  async function requestEventPayout(eventId) {
    await openPayoutModal(eventId);
  }

  async function confirmRefundsForEvent(eventId) {
    if (
      !window.confirm(
        'We will retry any outstanding automatic refunds and verify them in Stripe before clearing your payout hold.\n\nContinue?'
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
    showOrganiserAlert(data.message || 'Refunds verified.', false);
    await refresh();
    setRoute('events-revenue');
  }

  function primaryGroupForStripeConnect() {
    const needsConnect = (state.groups || []).filter(
      (g) => state.stripeConnectEnabled && !g.stripeConnectReady
    );
    return needsConnect[0] || (state.groups || [])[0] || null;
  }

  function groupReadyForStripeDashboard(group) {
    return Boolean(
      group &&
        group.stripeConnectReady &&
        String(group.stripeAccountId || '').trim()
    );
  }

  function focusBankDetailsSetup(message) {
    renderPaymentSetupUi();

    const bar = document.getElementById('org-stripe-dashboard-link');
    const btn = document.getElementById('org-open-stripe-dashboard');
    const setupEl = document.getElementById('org-payment-setup-revenue');
    const setupState = paymentSetupStateFromDashboard();
    const group = setupState.primaryGroup;

    if (bar && !bar.hidden && btn) {
      bar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      showOrganiserAlert(
        message ||
          (btn.dataset.stripeAction === 'setup'
            ? 'Click Add bank details above to connect Stripe — it opens in a new tab and takes about 5 minutes.'
            : btn.dataset.stripeAction === 'create-group'
              ? 'Create an organiser page first, then return here to add bank details.'
              : 'Use the button above to continue with bank details or the Stripe dashboard.'),
        false
      );
      btn.classList.add('org-btn--attention');
      window.setTimeout(function () {
        btn.classList.remove('org-btn--attention');
      }, 2400);
      try {
        btn.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
      return;
    }

    if (setupEl && !setupEl.hidden) {
      setupEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      showOrganiserAlert(
        message ||
          'Add your bank details in the section above before opening the Stripe dashboard.',
        false
      );
      const firstAction = setupEl.querySelector(
        '[data-payment-setup], [data-payment-link], .hub-payment-setup-btn, a.hub-payment-setup-btn'
      );
      if (firstAction && typeof firstAction.focus === 'function') {
        try {
          firstAction.focus({ preventScroll: true });
        } catch {
          /* ignore */
        }
      }
      return;
    }

    if (group) {
      showOrganiserAlert(
        (message ? message + ' ' : '') + 'Opening Stripe bank details setup…',
        false
      );
      startStripeConnectOnboarding(group.id);
      return;
    }

    showOrganiserAlert(
      message ||
        'Create an organiser page first, then add bank details from the Revenue tab.',
      true
    );
    setRoute('groups');
  }

  function renderRevenueStripeBar() {
    const bar = document.getElementById('org-stripe-dashboard-link');
    const btn = document.getElementById('org-open-stripe-dashboard');
    const hint = document.getElementById('org-stripe-dashboard-hint');
    if (!bar || !btn) return;

    if (!state.stripeConnectEnabled) {
      bar.hidden = true;
      return;
    }

    const readyGroup = (state.groups || []).find((g) => groupReadyForStripeDashboard(g));
    const setupState = paymentSetupStateFromDashboard();
    const setupGroup = setupState.primaryGroup;

    bar.hidden = false;

    if (readyGroup) {
      btn.type = 'button';
      btn.textContent = 'Open Stripe dashboard';
      btn.className = 'org-btn org-btn-secondary';
      btn.dataset.stripeAction = 'dashboard';
      btn.setAttribute('data-stripe-dashboard', readyGroup.id);
      btn.removeAttribute('data-stripe-setup');
      if (hint) {
        hint.textContent =
          'Issue refunds, view payouts, and manage ticket payments in Stripe Express.';
      }
    } else if (setupGroup) {
      const label =
        setupState.pendingGroups.length > 1
          ? 'Add bank details'
          : 'Add bank details' + (setupGroup.name ? ' for ' + setupGroup.name : '');
      btn.type = 'button';
      btn.textContent = label;
      btn.className = 'org-btn org-btn-primary';
      btn.dataset.stripeAction = 'setup';
      btn.setAttribute('data-stripe-setup', setupGroup.id);
      btn.removeAttribute('data-stripe-dashboard');
      if (hint) {
        hint.textContent =
          'Required before you can sell paid tickets or open the Stripe dashboard. Opens Stripe in a new tab — about 5 minutes.';
      }
    } else {
      btn.type = 'button';
      btn.textContent = 'Create organiser page';
      btn.className = 'org-btn org-btn-primary';
      btn.dataset.stripeAction = 'create-group';
      btn.removeAttribute('data-stripe-dashboard');
      btn.removeAttribute('data-stripe-setup');
      if (hint) {
        hint.textContent =
          'You need an organiser page before bank details can be added. Create one under Organiser pages, then return here.';
      }
    }
  }

  async function openStripeDashboard(groupId) {
    const gid =
      String(groupId || '').trim() ||
      (state.groups || []).find((g) => groupReadyForStripeDashboard(g))?.id ||
      '';
    const group = (state.groups || []).find((g) => String(g.id) === String(gid));
    if (!gid || !groupReadyForStripeDashboard(group)) {
      focusBankDetailsSetup(
        gid
          ? 'Bank details are not set up for this organiser page yet.'
          : 'Add bank details before opening the Stripe dashboard.'
      );
      return false;
    }

    let tab = null;
    try {
      tab = window.open('about:blank', '_blank');
      if (tab) {
        try {
          tab.opener = null;
        } catch {
          /* ignore */
        }
      }
    } catch {
      tab = null;
    }

    const btn = document.getElementById('org-open-stripe-dashboard');
    if (btn) {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
    }

    try {
      if (window.HubOrganiserPaymentSetup && window.HubOrganiserPaymentSetup.openDashboard) {
        const opened = await window.HubOrganiserPaymentSetup.openDashboard(gid, {
          tab: tab,
          onNeedsSetup: focusBankDetailsSetup,
        });
        return opened;
      }
      const { ok, data } = await api(
        '/api/organiser/stripe-connect?groupId=' + encodeURIComponent(gid) + '&action=dashboard'
      );
      if (!ok || !data.url) {
        if (tab) {
          try {
            tab.close();
          } catch {
            /* ignore */
          }
        }
        if (
          data.error === 'stripe_connect_required' ||
          /bank details/i.test(String(data.message || ''))
        ) {
          focusBankDetailsSetup(
            data.message || 'Add bank details before opening the Stripe dashboard.'
          );
        } else {
          alert(data.message || data.error || 'Could not open Stripe dashboard.');
        }
        return false;
      }
      if (tab) {
        if (window.HubOrganiserPaymentSetup && window.HubOrganiserPaymentSetup.openUrlInNewTab) {
          window.HubOrganiserPaymentSetup.openUrlInNewTab(data.url, tab);
        } else {
          tab.location.href = data.url;
          try {
            tab.focus();
          } catch {
            /* ignore */
          }
        }
      } else if (window.HubOrganiserPaymentSetup && window.HubOrganiserPaymentSetup.openUrlInNewTab) {
        window.HubOrganiserPaymentSetup.openUrlInNewTab(data.url);
      } else {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
      return true;
    } catch {
      if (tab) {
        try {
          tab.close();
        } catch {
          /* ignore */
        }
      }
      alert('Could not open Stripe dashboard. Please try again.');
      return false;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      }
    }
  }

  async function startStripeConnectOnboarding(groupId) {
    const gid = groupId || primaryGroupForStripeConnect()?.id;
    if (!gid) {
      alert('No organiser profile found.');
      return;
    }
    if (window.HubOrganiserPaymentSetup && window.HubOrganiserPaymentSetup.startSetup) {
      window.HubOrganiserPaymentSetup.startSetup(gid, '/organiser/#events-revenue');
      return;
    }
    const href =
      '/organiser/payment-setup?groupId=' +
      encodeURIComponent(gid) +
      '&returnPath=' +
      encodeURIComponent('/organiser/#events-revenue');
    if (window.HubOrganiserPaymentSetup && window.HubOrganiserPaymentSetup.openUrlInNewTab) {
      if (!window.HubOrganiserPaymentSetup.openUrlInNewTab(href)) {
        alert(
          'Your browser blocked the new tab. Allow pop-ups for this site, then click Add bank details again.'
        );
      }
      return;
    }
    const tab = window.open(href, '_blank');
    if (tab) {
      try {
        tab.opener = null;
      } catch {
        /* ignore */
      }
      return;
    }
    alert(
      'Your browser blocked the new tab. Allow pop-ups for this site, then click Add bank details again.'
    );
  }

  function paymentSetupStateFromDashboard() {
    const pendingGroups = (state.groups || []).filter(function (g) {
      return state.stripeConnectEnabled && !g.stripeConnectReady;
    });
    return {
      enabled: Boolean(state.stripeConnectEnabled),
      groups: state.groups || [],
      pendingGroups: pendingGroups,
      needsSetup: Boolean(state.stripeConnectEnabled && pendingGroups.length),
      primaryGroup: pendingGroups[0] || (state.groups || [])[0] || null,
    };
  }

  function renderPaymentSetupUi() {
    const payment = window.HubOrganiserPaymentSetup;
    const setupState = paymentSetupStateFromDashboard();
    const group = setupState.primaryGroup;

    const navBadge = document.getElementById('org-payment-setup-nav-badge');
    if (!state.canManagePayments) {
      ['org-payment-setup-revenue', 'org-payment-setup-overview', 'org-payment-setup-dashboard'].forEach(
        function (id) {
          const el = document.getElementById(id);
          if (el) {
            el.hidden = true;
            el.innerHTML = '';
          }
        }
      );
      if (navBadge) navBadge.hidden = true;
      const legacyBanner = document.getElementById('stripe-connect-banner');
      if (legacyBanner) {
        legacyBanner.hidden = true;
        legacyBanner.innerHTML = '';
      }
      return;
    }

    if (navBadge) {
      navBadge.hidden = !setupState.needsSetup;
      if (setupState.needsSetup && setupState.pendingGroups.length > 1) {
        navBadge.textContent = String(setupState.pendingGroups.length);
      } else {
        navBadge.textContent = 'Setup';
      }
    }

    const legacyBanner = document.getElementById('stripe-connect-banner');
    if (legacyBanner) {
      legacyBanner.hidden = true;
      legacyBanner.innerHTML = '';
    }

    if (payment) {
      const readyGroup = (state.groups || []).find((g) => groupReadyForStripeDashboard(g));
      payment.renderInto(document.getElementById('org-payment-setup-revenue'), setupState, group, {
        returnPath: '/organiser/#events-revenue',
        title: 'Add bank details to get paid for ticket sales',
        showWhenNotReady: Boolean(
          state.stripeConnectEnabled && !readyGroup && setupState.pendingGroups.length
        ),
      });
      payment.renderInto(document.getElementById('org-payment-setup-overview'), setupState, group, {
        returnPath: '/organiser/#events-list',
        compact: true,
        title: 'Add bank details before you sell paid tickets',
      });
      payment.renderInto(document.getElementById('org-payment-setup-dashboard'), setupState, group, {
        returnPath: '/organiser/#dashboard',
        compact: true,
        title: 'Add bank details to receive payouts',
        lead: 'Connect Stripe so ticket revenue can reach you after each event.',
      });
    }

    renderRevenueStripeBar();
    syncRevenueSetupLayout();
  }

  function syncRevenueSetupLayout() {
    const revenuePage = document.getElementById('sub-events-revenue');
    const setupEl = document.getElementById('org-payment-setup-revenue');
    if (!revenuePage) return;
    const setupVisible = Boolean(setupEl && !setupEl.hidden && setupEl.children.length);
    revenuePage.classList.toggle('org-revenue--setup-active', setupVisible);
  }

  function renderStripeConnectBanner() {
    renderPaymentSetupUi();
  }

  function groupNameById(id) {
    const g = state.groups.find((x) => x.id === id);
    return g ? g.name : '—';
  }

  function showOrganiserEmailVerifyBanner() {
    if (state.organiserEmailVerified || state.isAdmin) return;
    if ((state.pendingClaimGroups || []).length > 0 && !state.organiserAccess) return;
    showOrganiserAlert(
      'Confirm your email before publishing events, viewing attendees, or setting up payouts. ' +
        '<a href="/organiser/verify-email">Confirm email</a>',
      false
    );
  }

  function showOrganiserAlert(message, isError) {
    if (!alertEl) return;
    if (!message) {
      alertEl.hidden = true;
      return;
    }
    alertEl.hidden = false;
    alertEl.className = 'org-alert' + (isError ? ' error' : '');
    alertEl.innerHTML = message;
  }

  function navigateToMemberLists() {
    const groups = (state.groups || []).filter((g) => g && g.id);
    if (groups.length === 1) {
      window.location.href =
        '/organiser/member-roster?id=' + encodeURIComponent(groups[0].id);
      return;
    }
    if (!groups.length) {
      setRoute('groups');
      showOrganiserAlert(
        'Create an organiser page first, then open <strong>Member list</strong> from that row.',
        false
      );
      return;
    }
    const mount = document.getElementById('modal-member-lists-choices');
    if (mount) {
      mount.innerHTML = groups
        .map(function (g) {
          return (
            '<a class="org-member-list-chooser-item" href="/organiser/member-roster?id=' +
            encodeURIComponent(g.id) +
            '">' +
            '<span class="org-member-list-chooser-text">' +
            '<strong class="org-member-list-chooser-name">' +
            esc(g.name || 'Organiser page') +
            '</strong>' +
            '<span class="org-member-list-chooser-meta">Members only tickets &amp; invite emails</span>' +
            '</span>' +
            '<span class="org-member-list-chooser-cta">Open list →</span>' +
            '</a>'
          );
        })
        .join('');
    }
    openModal('modal-member-lists');
  }

  function sidebarRouteForPage(page, sub) {
    if (page === 'events-overview') return 'events-list';
    if (page === 'business-overview') return 'business-overview';
    if (page === 'business-list') return 'business-list';
    if (page === 'events') {
      return sub || 'events-list';
    }
    return page;
  }

  function syncSidebarNavHighlight(page, sub) {
    const activeRoute = sidebarRouteForPage(page, sub);
    document.querySelectorAll('.hub-side-nav-link[data-org-route]').forEach((a) => {
      const isActive = a.getAttribute('data-org-route') === activeRoute;
      a.classList.toggle('is-active', isActive);
      if (isActive) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function syncEventsTabHighlights(sub, enabled) {
    const activeSub = sub || 'events-list';
    document.querySelectorAll('[data-events-tab]').forEach((tab) => {
      const isActive = Boolean(enabled) && tab.getAttribute('data-events-tab') === activeSub;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.tabIndex = isActive ? 0 : -1;
    });
  }

  function updateSharedEventFilterNotes() {
    const active = eventsFiltersActive();
    document.querySelectorAll('.org-filter-linked-note').forEach((el) => {
      el.classList.toggle('is-active', active);
    });
  }

  function setRoute(route, options) {
    options = options || {};
    closeNotificationsPanel();
    if (bootstrapReady && !options.skipEventsGuard && needsOrganiserPageFirst() && isEventsRoute(route)) {
      redirectEventsToOrganiserSetup();
      return;
    }
    let page = route || 'dashboard';
    let sub = null;
    if (route === 'opportunity-enquiries' || route === 'business-overview') {
      page = 'business-overview';
    } else if (route === 'events-overview') {
      page = 'events';
      sub = 'events-list';
    } else if (route && route.startsWith('events-')) {
      page = 'events';
      sub = route;
    } else if (route === 'events') {
      page = 'events';
      sub = 'events-list';
    } else if (route === 'tickets') {
      page = 'events';
      sub = 'events-tickets';
    } else if (route === 'team') {
      page = 'team';
    } else if (route === 'social' || route === 'promote') {
      page = 'social';
    }

    document.querySelectorAll('[data-org-page]').forEach((p) => {
      p.classList.toggle('is-active', p.getAttribute('data-org-page') === page);
    });

    if (page === 'events') {
      setEventsSub(sub || eventsSubRoute || 'events-list');
    } else {
      syncSidebarNavHighlight(page, sub);
      syncEventsTabHighlights(null, false);
    }
    if (page === 'social') {
      renderOrganiserRankingShare();
      requestAnimationFrame(function () {
        ensureLinkedInPostBuilder({ force: true });
        loadOpportunitiesList().then(function () {
          if (linkedInPostBuilder && linkedInPostBuilder.refreshOpportunities) {
            linkedInPostBuilder.refreshOpportunities();
          }
        });
      });
    }
    if (page === 'team') {
      ensureTeamLoaded().then(function () {
        renderTeam();
        updateGettingStartedPanel();
        updateTeamNavBadge();
      });
    }
    if (page === 'business-overview') {
      requestAnimationFrame(function () {
        loadOpportunityEnquiries();
        loadOpportunitiesList();
      });
    }
    if (page === 'business-list') {
      requestAnimationFrame(function () {
        loadOpportunityEnquiries();
        loadOpportunitiesList().then(function () {
          renderOpportunityPerformance();
          updateBusinessListPageHead();
        });
      });
    }

    // Route lives in the hash only (/organiser/#events-list). Do not also write ?panel=
    // — that produced clunky URLs like /organiser/?panel=events-list#events-list.
    // Still accept ?panel= when reading (parseDeepLinkFromUrl) for old bookmarks.
    const hash =
      page === 'events'
        ? sub || 'events-list'
        : page === 'business-overview'
          ? 'business-overview'
          : page === 'business-list'
            ? 'business-list'
            : page === 'social'
              ? 'social'
              : page === 'dashboard'
                ? ''
                : page;
    const url = new URL(window.location.href);
    url.searchParams.delete('panel');
    if (filters.attendeesEvent && filters.attendeesEvent !== 'all') {
      url.searchParams.set('eventId', filters.attendeesEvent);
    } else if (!parseDeepLinkFromUrl().eventId) {
      url.searchParams.delete('eventId');
      url.searchParams.delete('event_id');
    }
    if (filters.attendeesPendingOnly && sub === 'events-attendees') {
      url.searchParams.set('applications', 'pending');
    } else {
      url.searchParams.delete('applications');
    }
    url.hash = hash ? '#' + hash : '';
    const nextUrl = url.pathname + url.search + url.hash;
    if (window.location.pathname + window.location.search + window.location.hash !== nextUrl) {
      history.replaceState(null, '', nextUrl);
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
    closeAlumniInvitesModal();
    document.querySelectorAll('.org-modal').forEach((m) => {
      m.setAttribute('hidden', '');
      m.setAttribute('aria-hidden', 'true');
      m.classList.remove('is-open');
    });
    document.body.classList.remove('org-cancel-modal-open');
    pendingPayoutEventId = null;
    pendingAlumniInviteEventId = null;
    pendingCancelEventId = null;
    pendingCancelRefundRequired = false;
    pendingDeleteEventId = null;
    pendingDuplicateEventId = null;
    pendingDuplicateGroupId = null;
    const duplicateConfirmBtn = document.getElementById('btn-event-duplicate-confirm');
    if (duplicateConfirmBtn) duplicateConfirmBtn.disabled = false;
    const groupDuplicateConfirmBtn = document.getElementById('btn-group-duplicate-confirm');
    if (groupDuplicateConfirmBtn) groupDuplicateConfirmBtn.disabled = false;
    const cancelForm = document.getElementById('form-event-cancel');
    if (cancelForm) cancelForm.reset();
    const cancelConfirm = document.getElementById('btn-event-cancel-confirm');
    if (cancelConfirm) cancelConfirm.disabled = true;
    resetGroupLogoPicker();
  }

  function openCancelEventModal(eventId) {
    if (!eventId) return;
    closeEventEditorDrawer();
    pendingCancelEventId = eventId;
    const modal = document.getElementById('modal-event-cancel');
    const titleEl = document.getElementById('modal-event-cancel-name');
    const headingEl = document.getElementById('modal-event-cancel-title');
    const warningEl = document.getElementById('modal-event-cancel-warning');
    const ticketsEl = document.getElementById('modal-event-cancel-tickets');
    const policyEl = document.getElementById('modal-event-cancel-policy');
    const refundLabel = document.getElementById('event-cancel-refund-label');
    const confirmBtn = document.getElementById('btn-event-cancel-confirm');
    const checkbox = document.getElementById('event-cancel-refund-confirm');
    const ev = findEventById(eventId);
    const isSeriesDate =
      ev &&
      ev.date &&
      groupEventsIntoSeries(state.events || []).some(function (row) {
        return (
          row.isSeries &&
          row.seriesCount > 1 &&
          row.seriesEvents &&
          row.seriesEvents.some(function (child) {
            return child.id === eventId;
          })
        );
      });
    const sold = eventEffectiveTicketsSold(ev);
    if (checkbox) checkbox.checked = false;

    if (headingEl) {
      headingEl.textContent = isSeriesDate ? 'Cancel this date' : 'Cancel this event';
    }
    if (titleEl) {
      const dateLine = ev && ev.date ? ' · ' + formatDateShort(ev.date) : '';
      titleEl.textContent = ev && ev.title ? '“' + ev.title + '”' + dateLine : '';
    }
    if (policyEl) {
      policyEl.hidden = false;
      policyEl.textContent =
        'Cancelling more than 3 events in a 12-month period may result in your account being suspended from The Networker Hub.';
    }
    syncCancelModalRefundUi({ ev: ev, sold: sold, isSeriesDate: isSeriesDate });
    if (modal) {
      modal.removeAttribute('hidden');
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.add('is-open');
      document.body.classList.add('org-cancel-modal-open');
      const reasonSelect = document.getElementById('event-cancel-reason');
      if (reasonSelect) {
        setTimeout(function () {
          reasonSelect.focus();
        }, 0);
      }
    }

    api('/api/organiser/cancellations?eventId=' + encodeURIComponent(eventId))
      .then(function (res) {
        if (!res.ok || !res.data) return;
        const ctx = res.data;
        syncCancelModalRefundUi({
          ev: ev,
          sold: Number(ctx.ticketsSold) || sold,
          ctx: ctx,
          isSeriesDate: isSeriesDate,
        });
        const policyEl = document.getElementById('modal-event-cancel-policy');
        if (!policyEl || policyEl.hidden) return;
        const past = Number(ctx.cancellationsPastYear) || 0;
        const limit = Number(ctx.cancellationLimit) || 3;
        let policyText =
          'Cancelling more than ' +
          limit +
          ' events in a 12-month period may result in your account being suspended from The Networker Hub.';
        if (past > 0) {
          policyText +=
            ' You have cancelled ' +
            past +
            ' event' +
            (past === 1 ? '' : 's') +
            ' in the past year' +
            (past >= limit ? ' — further cancellations may lead to suspension.' : '.');
        }
        policyEl.textContent = policyText;
      })
      .catch(function () {
        /* optional context */
      });
  }

  async function submitEventCancellation() {
    if (!pendingCancelEventId) return;
    const reason = document.getElementById('event-cancel-reason')?.value;
    const details = document.getElementById('event-cancel-details')?.value.trim() || '';
    const refundCheckbox = document.getElementById('event-cancel-refund-confirm');
    const refundTermsConfirmed = refundCheckbox ? refundCheckbox.checked : false;
    const confirmBtn = document.getElementById('btn-event-cancel-confirm');
    if (!reason) {
      alert('Select a cancellation reason.');
      return;
    }
    if (pendingCancelRefundRequired && !refundTermsConfirmed) {
      alert('Confirm that paying attendees will receive an automatic refund.');
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
        refundTermsConfirmed: pendingCancelRefundRequired ? refundTermsConfirmed : true,
      }),
    });
    if (!ok) {
      if (confirmBtn) confirmBtn.disabled = false;
      alert(data.message || data.error || 'Could not cancel event');
      return;
    }
    closeModals();
    showOrganiserAlert(data.message || 'Event cancelled.', false);
    await refresh();
    setRoute('events-list');
  }

  function revenuePayoutMetrics() {
    let readyToRequest = 0;
    let paidOut = 0;
    let onHold = 0;
    (state.events || []).forEach(function (ev) {
      if (ev.canRequestPayout) readyToRequest++;
      if (ev.payoutStatusKey === 'paid') paidOut++;
      if (ev.needsRefundConfirmation || ev.payoutHeld || ev.payoutStatusKey === 'held') onHold++;
    });
    return { readyToRequest, paidOut, onHold };
  }

  function renderOverviewGroups() {
    /* merged into main organiser pages list */
  }

  function renderOverviewEvents() {
    /* merged into main events list */
  }

  function renderGroups() {
    const body = document.getElementById('groups-body');
    const empty = document.getElementById('groups-empty');
    if (!body) return;
    body.innerHTML = '';
    const list = filteredGroupsList();
    if (!list.length) {
      const hasGroups = state.groups.length > 0;
      setOrgEmpty(empty, {
        show: true,
        title: hasGroups ? 'No matching organiser pages' : 'No organiser pages yet',
        text: hasGroups
          ? 'Try adjusting your search or status filter.'
          : 'Create your organiser page on the hub before listing events.',
        hideActions: hasGroups,
      });
      updatePaginationNav('groups', { totalPages: 1, start: 0, end: 0, total: 0, page: 1 });
      return;
    }
    setOrgEmpty(empty, { show: false });
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
        '<a href="/organiser/member-roster?id=' +
        esc(g.id) +
        '" class="org-btn org-btn-sm org-btn-outline org-member-list-link">Member list</a> ' +
        actionMenuHtml('group', g.id, g.name, g) +
        '</td>';
      body.appendChild(tr);
    });
  }

  function appendEventTableRow(body, ev, options) {
    const opts = options || {};
    const tr = document.createElement('tr');
    const isSeriesParent = ev.isSeries && ev.seriesCount > 1;
    if (isSeriesParent) {
      const key = eventSeriesKeyForRow(ev);
      const expanded = expandedSeriesKeys.has(key);
      tr.className = 'org-series-parent-row is-expandable';
      tr.setAttribute('data-series-key', key);
      tr.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      tr.setAttribute('title', 'Click to show each date in this series');
      tr.tabIndex = 0;
    }

    const revClass = ev.revenueNum > 0 ? 'org-revenue' : 'org-revenue muted';

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
    return tr;
  }

  function seriesOverviewStatsHtml(children) {
    const dates = children.length;
    let ticketsSold = 0;
    let ticketsCapacity = 0;
    let revenueNum = 0;
    children.forEach(function (child) {
      ticketsSold += Number(child.ticketsSold) || 0;
      ticketsCapacity += Number(child.ticketsCapacity) || 0;
      revenueNum += Number(child.revenueNum) || 0;
    });
    return (
      '<div class="org-series-stats org-stats org-stats--three">' +
      '<div class="org-stat gold"><div class="org-stat-label">Dates</div><div class="org-stat-value">' +
      esc(String(dates)) +
      '</div></div>' +
      '<div class="org-stat green"><div class="org-stat-label">Tickets sold</div><div class="org-stat-value">' +
      esc(formatTicketsSoldLabel(ticketsSold, ticketsCapacity)) +
      '</div></div>' +
      '<div class="org-stat purple"><div class="org-stat-label">Total revenue</div><div class="org-stat-value">' +
      esc(formatGbpAmount(revenueNum)) +
      '</div></div></div>'
    );
  }

  function appendSeriesDetailPanel(body, ev) {
    const key = eventSeriesKeyForRow(ev);
    const children = sortSeriesMembers(ev.seriesEvents || []);
    const tr = document.createElement('tr');
    tr.className = 'org-series-detail-row';
    tr.setAttribute('data-series-detail-for', key);

    const totalRevenue = children.reduce(function (sum, child) {
      return sum + (Number(child.revenueNum) || 0);
    }, 0);
    const sortCol = filters.eventsSortColumn || 'date';
    const highlightTop = sortCol === 'revenue' && filters.eventsSortDir === 'desc';

    const rowsHtml = children
      .map(function (child, index) {
        const revClass = child.revenueNum > 0 ? 'org-revenue' : 'org-revenue muted';
        const topClass =
          highlightTop && index === 0 && (Number(child.revenueNum) || 0) > 0
            ? ' org-series-date-row--top'
            : '';
        return (
          '<tr class="org-series-date-row' +
          topClass +
          '">' +
          '<td>' +
          esc(formatDateShort(child.date) || 'Date TBC') +
          '</td><td>' +
          esc(formatTimeRange(child.date, child.endDate)) +
          '</td><td>' +
          esc(child.ticketsSoldLabel || '0') +
          '</td><td class="' +
          revClass +
          '">' +
          esc(child.revenueDisplay || '£0') +
          '</td><td>' +
          statusBadgeHtml(child.statusKey || 'draft', child.statusLabel || 'Draft') +
          '</td>' +
          seriesDateActionsCell(child) +
          '</tr>'
        );
      })
      .join('');

    tr.innerHTML =
      '<td colspan="8">' +
      '<div class="org-series-dates-panel">' +
      '<div class="org-series-dates-block">' +
      seriesOverviewStatsHtml(children) +
      '<div class="org-series-dates-head">' +
      '<p class="org-series-dates-lede"><strong>' +
      esc(String(children.length)) +
      ' dates</strong> · Total ' +
      esc(formatGbpAmount(totalRevenue)) +
      ' · Sorted by ' +
      esc(eventsSortLabel()) +
      '</p>' +
      '<p class="org-series-dates-hint">Use Edit, Delete, or Cancel on each date — only that occurrence is affected.</p>' +
      '</div>' +
      '<div class="org-series-dates-scroll">' +
      '<table class="org-series-dates-table">' +
      '<thead><tr>' +
      '<th>Date</th><th>Time</th><th>Tickets sold</th><th>Revenue</th><th>Status</th><th>Actions</th>' +
      '</tr></thead><tbody>' +
      rowsHtml +
      '</tbody></table></div></div></div></td>';
    body.appendChild(tr);
  }

  function appendRevenueTableRow(body, ev) {
    const tr = document.createElement('tr');
    const isSeriesParent = ev.isSeries && ev.seriesCount > 1;
    if (isSeriesParent) {
      const key = eventSeriesKeyForRow(ev);
      const expanded = expandedSeriesKeys.has(key);
      tr.className = 'org-series-parent-row is-expandable';
      tr.setAttribute('data-series-key', key);
      tr.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      tr.setAttribute('title', 'Click to show each date in this series');
      tr.tabIndex = 0;
    }
    if (ev.needsRefundConfirmation) tr.classList.add('org-row-payout-held');

    tr.innerHTML =
      '<td>' +
      thumbHtml(ev) +
      '</td><td class="org-td-name">' +
      eventTitleCellHtml(ev) +
      (ev.needsRefundConfirmation
        ? '<p class="org-payout-held-note">Payout on hold — refunds processing</p>'
        : '') +
      '</td><td>' +
      esc(ev.ticketsSoldLabel || '0') +
      '</td><td class="org-revenue">' +
      eventRevenueCellHtml(ev) +
      '</td><td class="org-payout-col">' +
      payoutCellHtml(ev) +
      '</td>';
    body.appendChild(tr);
    return tr;
  }

  function appendRevenueSeriesDetailPanel(body, ev) {
    const key = eventSeriesKeyForRow(ev);
    const children = sortSeriesMembers(ev.seriesEvents || []);
    const tr = document.createElement('tr');
    tr.className = 'org-series-detail-row';
    tr.setAttribute('data-series-detail-for', key);

    const totalRevenue = children.reduce(function (sum, child) {
      return sum + (Number(child.revenueNum) || 0);
    }, 0);

    const rowsHtml = children
      .map(function (child) {
        return (
          '<tr class="org-series-date-row">' +
          '<td>' +
          esc(formatDateShort(child.date) || 'Date TBC') +
          '</td><td>' +
          esc(formatTimeRange(child.date, child.endDate)) +
          '</td><td>' +
          esc(child.ticketsSoldLabel || '0') +
          '</td><td class="org-revenue">' +
          eventRevenueCellHtml(child) +
          '</td><td class="org-payout-col">' +
          payoutCellHtml(child) +
          '</td></tr>'
        );
      })
      .join('');

    tr.innerHTML =
      '<td colspan="6">' +
      '<div class="org-series-dates-panel">' +
      '<div class="org-series-dates-block">' +
      seriesOverviewStatsHtml(children) +
      '<div class="org-series-dates-head">' +
      '<p class="org-series-dates-lede"><strong>' +
      esc(String(children.length)) +
      ' dates</strong> · Total ' +
      esc(formatGbpAmount(totalRevenue)) +
      ' · Sorted by ' +
      esc(eventsSortLabel()) +
      '</p>' +
      '<p class="org-series-dates-hint">Expand each date to view payout status or request a payout for that occurrence.</p>' +
      '</div>' +
      '<div class="org-series-dates-scroll">' +
      '<table class="org-series-dates-table">' +
      '<thead><tr>' +
      '<th>Date</th><th>Time</th><th>Tickets sold</th><th>Revenue</th><th>Payout</th>' +
      '</tr></thead><tbody>' +
      rowsHtml +
      '</tbody></table></div></div></div></td>';
    body.appendChild(tr);
  }

  function syncSharedEventFiltersUi() {
    const statusEl = document.getElementById('filter-events-status');
    const searchEl = document.getElementById('filter-events-search');
    const hideArchivedEl = document.getElementById('filter-events-hide-archived');
    const revStatusEl = document.getElementById('filter-revenue-status');
    const revSearchEl = document.getElementById('filter-revenue-search');
    const revHideArchivedEl = document.getElementById('filter-revenue-hide-archived');
    if (statusEl) statusEl.value = filters.eventsStatus;
    if (searchEl) searchEl.value = filters.eventsSearch;
    if (hideArchivedEl) hideArchivedEl.checked = filters.eventsHideArchived !== false;
    if (revStatusEl) revStatusEl.value = filters.eventsStatus;
    if (revSearchEl) revSearchEl.value = filters.eventsSearch;
    if (revHideArchivedEl) revHideArchivedEl.checked = filters.eventsHideArchived !== false;
    updateSharedEventFilterNotes();
  }

  function renderEvents() {
    const body = document.getElementById('events-body');
    const empty = document.getElementById('events-empty');
    if (!body) return;

    if (!eventsFiltersActive() && !state.eventsFullyLoaded && state.eventsHasMore) {
      body.innerHTML =
        '<tr><td colspan="8" class="org-table-loading">Loading events…</td></tr>';
      if (empty) empty.hidden = true;
      ensureAllEventsForGrouping()
        .then(() => renderEvents())
        .catch((err) => showOrganiserAlert(err.message || 'Could not load events', true));
      return;
    }

    const list = filteredEventsList();
    body.innerHTML = '';

    if (!list.length) {
      const hasEvents = state.events.length > 0;
      setOrgEmpty(empty, {
        show: true,
        title: hasEvents ? 'No matching events' : 'No events yet',
        text: hasEvents
          ? 'Try adjusting your filters or search.'
          : 'Create your organiser page first, then list your first event.',
        hideActions: hasEvents,
      });
      updatePaginationNav('events', { totalPages: 1, start: 0, end: 0, total: 0, page: 1 });
      return;
    }
    setOrgEmpty(empty, { show: false });
    const pageInfo = paginateEventsList(list, listPages.events);
    listPages.events = pageInfo.page;
    updatePaginationNav('events', pageInfo);

    pageInfo.items.forEach((ev) => {
      appendEventTableRow(body, ev);
      if (ev.isSeries && ev.seriesCount > 1 && ev.seriesEvents && ev.seriesEvents.length) {
        const key = eventSeriesKeyForRow(ev);
        if (expandedSeriesKeys.has(key)) {
          appendSeriesDetailPanel(body, ev);
        }
      }
    });
    updateEventsSortHeaders();
    syncSharedEventFiltersUi();
  }

  function renderTickets() {
    const body = document.getElementById('tickets-body');
    const empty = document.getElementById('tickets-empty');
    if (!body) return;
    const list = filteredTicketsList();
    body.innerHTML = '';

    if (!list.length) {
      const hasTickets = state.tickets.length > 0;
      const scopeFiltered = filters.ticketsScope !== 'all';
      setOrgEmpty(empty, {
        show: true,
        title: hasTickets ? 'No matching tickets' : 'No ticket types yet',
        text: hasTickets
          ? scopeFiltered
            ? 'Nothing matches this filter — try All ticket types or pick a specific event.'
            : 'Try choosing a different event or ticket type filter.'
          : 'Add ticket tiers when you create or edit an event.',
        hideActions: hasTickets,
      });
      updatePaginationNav('tickets', { totalPages: 1, start: 0, end: 0, total: 0, page: 1 });
      return;
    }
    setOrgEmpty(empty, { show: false });
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

  function findReviewById(reviewId) {
    const id = String(reviewId || '').trim();
    if (!id) return null;
    for (let i = 0; i < state.reviews.length; i++) {
      if (String(state.reviews[i].id) === id) return state.reviews[i];
    }
    return null;
  }

  function reviewReplyMarkup(r) {
    const hasReply = Boolean(r.reply && String(r.reply).trim());
    const replyText = hasReply ? esc(r.reply) : '';
    const composing = r._composing;
    if (composing) {
      return (
        '<div class="org-review-reply-form" data-review-reply-form="' +
        esc(r.id) +
        '">' +
        '<label class="org-review-reply-label" for="review-reply-' +
        esc(r.id) +
        '">' +
        (hasReply ? 'Edit your reply' : 'Your reply') +
        '</label>' +
        '<textarea id="review-reply-' +
        esc(r.id) +
        '" class="org-review-reply-input" rows="3" maxlength="2000" placeholder="Thank the attendee or add useful context for future guests…">' +
        (hasReply ? esc(r.reply) : '') +
        '</textarea>' +
        '<p class="org-review-reply-hint">Public on your group profile · max 2,000 characters</p>' +
        '<p class="org-review-reply-error" data-review-reply-error="' +
        esc(r.id) +
        '" hidden></p>' +
        '<div class="org-review-reply-actions">' +
        '<button type="button" class="org-btn org-btn-gold org-btn-sm" data-save-review-reply="' +
        esc(r.id) +
        '">Save reply</button>' +
        '<button type="button" class="org-btn org-btn-outline org-btn-sm" data-cancel-review-reply="' +
        esc(r.id) +
        '">Cancel</button>' +
        (hasReply
          ? '<button type="button" class="org-btn org-btn-outline org-btn-sm org-review-reply-clear" data-clear-review-reply="' +
            esc(r.id) +
            '">Remove reply</button>'
          : '') +
        '</div></div>'
      );
    }
    if (hasReply) {
      return (
        '<div class="org-review-reply">' +
        '<div class="org-review-reply-label">Your reply</div>' +
        '<div class="org-review-reply-text">' +
        replyText +
        '</div>' +
        '<button type="button" class="org-btn org-btn-outline org-btn-sm" style="margin-top:8px" data-edit-review-reply="' +
        esc(r.id) +
        '">Edit reply</button></div>'
      );
    }
    return (
      '<button type="button" class="org-btn org-btn-outline org-btn-sm" style="margin-top:8px" data-edit-review-reply="' +
      esc(r.id) +
      '">Reply to this review</button>'
    );
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
      setOrgEmpty(empty, { show: true });
      updatePaginationNav('reviews', { totalPages: 1, start: 0, end: 0, total: 0, page: 1 });
      return;
    }
    setOrgEmpty(empty, { show: false });
    const pageInfo = paginateList(list, listPages.reviews);
    listPages.reviews = pageInfo.page;
    updatePaginationNav('reviews', pageInfo);

    pageInfo.items.forEach((r) => {
      const card = document.createElement('article');
      card.className = 'org-review-card';
      card.setAttribute('data-review-id', r.id);
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
        reviewReplyMarkup(r);
      listEl.appendChild(card);
      if (r.id && window.ReviewReport) {
        window.ReviewReport.addReportButton(card, {
          reviewId: r.id,
          organiserId: r.organiserId || r.groupId || null,
          eventId: r.eventId || null,
          snippet: String(r.body || '').slice(0, 500),
        });
      }
    });
  }

  async function saveReviewReply(reviewId, replyText) {
    const review = findReviewById(reviewId);
    if (!review) return;
    const errEl = document.querySelector('[data-review-reply-error="' + reviewId + '"]');
    const saveBtn = document.querySelector('[data-save-review-reply="' + reviewId + '"]');
    const clearBtn = document.querySelector('[data-clear-review-reply="' + reviewId + '"]');
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    if (saveBtn) saveBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;
    try {
      const { ok, data } = await api('/api/organiser/reviews', {
        method: 'POST',
        body: JSON.stringify({ reviewId, reply: replyText }),
      });
      if (!ok || !data.ok) {
        if (errEl) {
          errEl.textContent = (data && data.message) || 'Could not save reply.';
          errEl.hidden = false;
        } else {
          showOrganiserAlert((data && data.message) || 'Could not save reply.', true);
        }
        return;
      }
      review.reply = data.review && data.review.reply ? data.review.reply : null;
      review._composing = false;
      renderReviews();
      showOrganiserAlert(data.message || 'Reply saved.', false);
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || 'Could not save reply.';
        errEl.hidden = false;
      } else {
        showOrganiserAlert(err.message || 'Could not save reply.', true);
      }
    } finally {
      if (saveBtn) saveBtn.disabled = false;
      if (clearBtn) clearBtn.disabled = false;
    }
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
      '<p><strong>Your payout is on hold</strong> — automatic refunds are being processed in Stripe. If this takes more than a few minutes, click <em>Confirm refunds issued</em> on Revenue to retry. Events: ' +
      names +
      '.</p>';
  }

  function renderRevenue() {
    const body = document.getElementById('revenue-body');
    const empty = document.getElementById('revenue-empty');
    if (!body) return;

    renderStripeConnectBanner();

    if (!eventsFiltersActive() && !state.eventsFullyLoaded && state.eventsHasMore) {
      body.innerHTML =
        '<tr><td colspan="5" class="org-table-loading">Loading revenue…</td></tr>';
      if (empty) empty.hidden = true;
      ensureAllEventsForGrouping()
        .then(() => renderRevenue())
        .catch((err) => showOrganiserAlert(err.message || 'Could not load events', true));
      return;
    }

    const list = filteredEventsList();
    body.innerHTML = '';
    renderPayoutHeldBanner();
    syncSharedEventFiltersUi();

    const setRev = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    const metrics = revenuePayoutMetrics();
    setRev('rev-stat-ready', String(metrics.readyToRequest));
    setRev('rev-stat-paid', String(metrics.paidOut));
    setRev('rev-stat-held', String(metrics.onHold));

    if (!list.length) {
      const hasEvents = state.events.length > 0;
      setOrgEmpty(empty, {
        show: true,
        title: hasEvents ? 'No matching events' : 'No revenue data yet',
        text: hasEvents
          ? 'Try adjusting your filters or search — the same filters apply on the Events tab.'
          : 'Ticket sales and payout status appear here once you list events and sell tickets.',
        hideActions: true,
      });
      updatePaginationNav('revenue', { totalPages: 1, start: 0, end: 0, total: 0, page: 1 });
      return;
    }
    setOrgEmpty(empty, { show: false });

    const pageInfo = paginateList(list, listPages.revenue);
    listPages.revenue = pageInfo.page;
    updatePaginationNav('revenue', pageInfo);

    pageInfo.items.forEach((ev) => {
      appendRevenueTableRow(body, ev);
      if (ev.isSeries && ev.seriesCount > 1 && ev.seriesEvents && ev.seriesEvents.length) {
        const key = eventSeriesKeyForRow(ev);
        if (expandedSeriesKeys.has(key)) {
          appendRevenueSeriesDetailPanel(body, ev);
        }
      }
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

  function teamGroupAccessLabel(member) {
    if (!member || member.role === 'owner' || member.isAccountOwner || member.allGroups) {
      return 'All groups';
    }
    const ids = member.groupIds || [];
    if (!ids.length) return 'No groups assigned';
    const names = ids.map(function (id) {
      const g = state.groups.find(function (x) {
        return x.id === id;
      });
      return g && g.name ? g.name : 'Group';
    });
    return names.join(', ');
  }

  function renderTeamGroupCheckboxes(listEl, selectedIds, options) {
    if (!listEl) return;
    const opts = options || {};
    const selected = new Set((selectedIds || []).map(String));
    listEl.innerHTML = '';
    const groups = state.groups || [];
    if (!groups.length) {
      const empty = document.createElement('p');
      empty.className = 'org-field-hint';
      empty.textContent = 'Create a networking group first, then assign access.';
      listEl.appendChild(empty);
      return;
    }
    groups.forEach(function (g) {
      const label = document.createElement('label');
      label.className = 'org-team-group-option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = opts.inputName || 'team-group';
      input.value = g.id;
      if (selected.has(String(g.id))) input.checked = true;
      label.appendChild(input);
      label.appendChild(document.createTextNode(g.name || 'Group'));
      listEl.appendChild(label);
    });
  }

  function bindTeamGroupPicker(allCheckbox, listEl) {
    if (!allCheckbox || !listEl || allCheckbox.dataset.teamPickerBound === '1') return;
    allCheckbox.dataset.teamPickerBound = '1';
    const sync = function () {
      const all = allCheckbox.checked;
      listEl.hidden = all;
      if (!all) {
        const boxes = listEl.querySelectorAll('input[type="checkbox"]');
        if (
          ![...boxes].some(function (box) {
            return box.checked;
          })
        ) {
          boxes.forEach(function (box) {
            box.checked = true;
          });
        }
      }
    };
    allCheckbox.addEventListener('change', sync);
    sync();
  }

  function readTeamGroupSelection(allCheckbox, listEl) {
    if (!allCheckbox) return { allGroups: true, groupIds: [] };
    if (allCheckbox.checked) return { allGroups: true, groupIds: [] };
    const groupIds = [];
    if (listEl) {
      listEl.querySelectorAll('input[type="checkbox"]:checked').forEach(function (box) {
        if (box.value) groupIds.push(box.value);
      });
    }
    return { allGroups: false, groupIds: groupIds };
  }

  function resetTeamInviteGroupPicker() {
    const allBox = document.getElementById('team-invite-all-groups');
    const listEl = document.getElementById('team-invite-group-list');
    if (allBox) allBox.checked = true;
    renderTeamGroupCheckboxes(listEl, (state.groups || []).map(function (g) {
      return g.id;
    }));
    if (allBox) {
      allBox.checked = true;
      allBox.dispatchEvent(new Event('change'));
    }
  }

  function openTeamGroupsModal(member) {
    if (!member || member.isAccountOwner || member.role === 'owner') return;
    const idInput = document.getElementById('team-groups-member-id');
    const emailEl = document.getElementById('modal-team-groups-email');
    const allBox = document.getElementById('team-groups-all-groups');
    const listEl = document.getElementById('team-groups-group-list');
    if (idInput) idInput.value = member.id || '';
    if (emailEl) emailEl.textContent = member.email || '';
    renderTeamGroupCheckboxes(listEl, member.allGroups ? [] : member.groupIds || []);
    if (allBox) {
      allBox.checked = member.allGroups !== false;
      allBox.dispatchEvent(new Event('change'));
    }
    openModal('modal-team-groups');
  }

  function ensureTeamLoaded(options) {
    const force = Boolean(options && options.force);
    if (state.teamLoaded && !force) return Promise.resolve(true);
    if (teamLoadingPromise && !force) return teamLoadingPromise;
    teamLoadingPromise = loadTeamMembers({ force }).finally(function () {
      teamLoadingPromise = null;
    });
    return teamLoadingPromise;
  }

  async function loadTeamMembers(options) {
    const force = Boolean(options && options.force);
    if (state.teamLoaded && !force) return true;
    const { ok, data } = await api('/api/organiser/team');
    if (!ok) {
      state.teamMembers = [];
      state.teamError =
        data.message ||
        data.error ||
        (data.error === 'team_not_supported' ? 'Team management is not available on this server.' : 'Could not load team members.');
      state.teamLoaded = false;
      return false;
    }
    state.teamError = null;
    state.teamMembers = data.members || [];
    state.teamLoaded = true;
    state.canManageTeam = data.canManageTeam !== false;
    state.canDeleteEvents = data.canDeleteEvents !== false;
    state.canManagePayments = data.canManagePayments !== false;
    state.canCreateGroups = data.canCreateGroups !== false;
    state.organiserRole = data.role || state.organiserRole;
    state.useTeamWorkspace = Boolean(data.useTeamWorkspace);
    state.teamMax = Number(data.teamMax) || 10;
    state.teamCount = Number(data.teamCount) || 0;
    state.teamSlotsRemaining = Number(data.teamSlotsRemaining);
    if (!Number.isFinite(state.teamSlotsRemaining)) {
      state.teamSlotsRemaining = Math.max(0, state.teamMax - state.teamCount);
    }
    return true;
  }

  function updateTeamLimitUi() {
    const note = document.getElementById('team-limit-note');
    const modalNote = document.getElementById('modal-team-limit-note');
    const inviteBtn = document.getElementById('btn-invite-team');
    const inviteEmptyBtn = document.getElementById('btn-invite-team-empty');
    const atCap = state.canManageTeam && state.teamSlotsRemaining <= 0;
    const summary =
      state.canManageTeam && state.teamMax
        ? state.teamCount + ' of ' + state.teamMax + ' editor slots used'
        : '';

    if (note) {
      if (summary) {
        note.textContent = summary + (atCap ? ' — remove someone to invite another editor.' : '');
        note.hidden = false;
      } else {
        note.hidden = true;
      }
    }
    if (modalNote) {
      modalNote.textContent = summary
        ? summary + '. Invites are sent by email; editors become Active when they sign in with that address.'
        : 'Invites are sent by email; editors become Active when they sign in with that address.';
    }
    if (inviteBtn) {
      inviteBtn.disabled = atCap;
      inviteBtn.title = atCap ? 'Team limit reached' : '';
    }
    if (inviteEmptyBtn) {
      inviteEmptyBtn.disabled = atCap;
      inviteEmptyBtn.title = atCap ? 'Team limit reached' : '';
    }
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
      editorNote.hidden = state.organiserRole !== 'editor';
    }
    updateTeamLimitUi();
    if (teamPage) {
      let errEl = teamPage.querySelector('.org-team-error');
      if (state.teamError) {
        if (!errEl) {
          errEl = document.createElement('p');
          errEl.className = 'org-alert error org-team-error';
          const toolbar = teamPage.querySelector('.org-page-head, .org-toolbar');
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
      setOrgEmpty(empty, { show: true, hideActions: !state.canManageTeam });
      updateTeamNavBadge();
      return;
    }
    setOrgEmpty(empty, { show: false });

    list.forEach((m) => {
      const tr = document.createElement('tr');
      const isOwner = m.role === 'owner' || m.isAccountOwner;
      const actions = [];
      if (!isOwner && state.canManageTeam) {
        actions.push(
          '<button type="button" class="org-btn org-btn-outline org-btn-sm" data-team-groups="' +
            esc(m.id) +
            '">Edit groups</button>'
        );
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
        '</td><td class="org-team-group-access">' +
        esc(teamGroupAccessLabel(m)) +
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
    bindTeamGroupPicker(
      document.getElementById('team-invite-all-groups'),
      document.getElementById('team-invite-group-list')
    );
    bindTeamGroupPicker(
      document.getElementById('team-groups-all-groups'),
      document.getElementById('team-groups-group-list')
    );
    const openInvite = () => {
      if (state.teamSlotsRemaining <= 0) {
        showOrganiserAlert(
          'You can invite up to ' + state.teamMax + ' editors. Remove someone to invite another.',
          true
        );
        return;
      }
      updateTeamLimitUi();
      resetTeamInviteGroupPicker();
      openModal('modal-team-invite');
    };
    const inviteBtn = document.getElementById('btn-invite-team');
    if (inviteBtn) {
      inviteBtn.addEventListener('click', openInvite);
    }
    const inviteEmptyBtn = document.getElementById('btn-invite-team-empty');
    if (inviteEmptyBtn) {
      inviteEmptyBtn.addEventListener('click', openInvite);
    }
    const form = document.getElementById('form-team-invite');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('team-invite-email').value.trim();
        const btn = e.submitter;
        const groupSelection = readTeamGroupSelection(
          document.getElementById('team-invite-all-groups'),
          document.getElementById('team-invite-group-list')
        );
        if (!groupSelection.allGroups && !groupSelection.groupIds.length) {
          alert('Select at least one group, or choose All groups.');
          return;
        }
        if (btn) btn.disabled = true;
        const { ok, data } = await api('/api/organiser/team', {
          method: 'POST',
          body: JSON.stringify({
            email,
            role: 'editor',
            allGroups: groupSelection.allGroups,
            groupIds: groupSelection.groupIds,
          }),
        });
        if (btn) btn.disabled = false;
        if (!ok) {
          alert(data.message || data.error || 'Could not send invite');
          return;
        }
        closeModals();
        form.reset();
        await loadTeamMembers({ force: true });
        renderTeam();
        updateGettingStartedPanel();
        showOrganiserAlert(data.message || (data.emailSent === false ? 'Invite saved but email not sent.' : 'Invite sent.'), data.emailSent === false);
      });
    }
    const teamPage = document.getElementById('org-page-team');
    if (teamPage) {
      teamPage.addEventListener('click', async (e) => {
        const editGroups = e.target.closest('[data-team-groups]');
        if (editGroups) {
          const id = editGroups.getAttribute('data-team-groups');
          const member = state.teamMembers.find(function (m) {
            return m.id === id;
          });
          if (member) openTeamGroupsModal(member);
          return;
        }
        const resend = e.target.closest('[data-team-resend]');
        if (resend) {
          const id = resend.getAttribute('data-team-resend');
          const { ok, data } = await api('/api/organiser/team', {
            method: 'POST',
            body: JSON.stringify({ action: 'resend', id }),
          });
          if (!ok) alert(data.message || data.error || 'Could not resend invite');
          else {
            await loadTeamMembers({ force: true });
            renderTeam();
            updateGettingStartedPanel();
            showOrganiserAlert(data.message || (data.emailSent === false ? 'Could not resend email.' : 'Invite resent.'), data.emailSent === false);
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
            await loadTeamMembers({ force: true });
            renderTeam();
            updateGettingStartedPanel();
          }
        }
      });
    }
    const groupsForm = document.getElementById('form-team-groups');
    if (groupsForm) {
      groupsForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const memberId = document.getElementById('team-groups-member-id').value.trim();
        const groupSelection = readTeamGroupSelection(
          document.getElementById('team-groups-all-groups'),
          document.getElementById('team-groups-group-list')
        );
        if (!memberId) return;
        if (!groupSelection.allGroups && !groupSelection.groupIds.length) {
          alert('Select at least one group, or choose All groups.');
          return;
        }
        const btn = e.submitter;
        if (btn) btn.disabled = true;
        const { ok, data } = await api('/api/organiser/team', {
          method: 'PATCH',
          body: JSON.stringify({
            id: memberId,
            allGroups: groupSelection.allGroups,
            groupIds: groupSelection.groupIds,
          }),
        });
        if (btn) btn.disabled = false;
        if (!ok) {
          alert(data.message || data.error || 'Could not update group access');
          return;
        }
        closeModals();
        await loadTeamMembers({ force: true });
        renderTeam();
        showOrganiserAlert(data.message || 'Group access updated.');
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
      opt.textContent = eventFilterOptionLabel(ev);
      select.appendChild(opt);
    });
  }

  function readTicketModalAttendeeExtras() {
    return {
      foodIncluded: Boolean(document.getElementById('ticket-food-included')?.checked),
      collectDietary: Boolean(document.getElementById('ticket-collect-dietary')?.checked),
      collectAccessibility: Boolean(document.getElementById('ticket-collect-access')?.checked),
    };
  }

  function syncTicketModalAttendeeExtras(eventId) {
    const id = String(eventId || document.getElementById('ticket-event')?.value || '').trim();
    const ev = state.events.find((row) => row.id === id);
    const food = document.getElementById('ticket-food-included');
    const dietary = document.getElementById('ticket-collect-dietary');
    const access = document.getElementById('ticket-collect-access');
    if (food) food.checked = Boolean(ev?.foodIncluded);
    if (dietary) dietary.checked = Boolean(ev?.collectDietary);
    if (access) access.checked = Boolean(ev?.collectAccessibility);
  }

  async function saveTicketModalAttendeeExtras(eventId) {
    const id = String(eventId || '').trim();
    if (!id) return { ok: true };
    let ev = state.events.find((row) => row.id === id);
    if (!ev) {
      const res = await api('/api/organiser/events?id=' + encodeURIComponent(id));
      if (!res.ok || !res.data.event) {
        return {
          ok: false,
          message: res.data?.message || res.data?.error || 'Could not load event for booking questions',
        };
      }
      ev = res.data.event;
    }
    const extras = readTicketModalAttendeeExtras();
    const { ok, data } = await api('/api/organiser/events', {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        title: ev.title,
        organiserGroupId: ev.organiserGroupId || ev.organiserGroupIds?.[0] || '',
        type: ev.type,
        description: ev.description,
        location: ev.location,
        venue: ev.venue,
        ...(ev.imageUrl ? { photoUrl: ev.imageUrl } : {}),
        attendeeExtras: extras,
      }),
    });
    if (!ok) {
      return {
        ok: false,
        message: data?.message || data?.error || 'Could not save attendee booking questions',
      };
    }
    const patch = {
      foodIncluded: extras.foodIncluded,
      collectDietary: extras.collectDietary,
      collectAccessibility: extras.collectAccessibility,
    };
    if (ev) Object.assign(ev, patch);
    const stateEv = state.events.find((row) => row.id === id);
    if (stateEv) Object.assign(stateEv, patch);
    return { ok: true };
  }

  let scopeButtonsBound = false;
  function scopeClickHandler(e) {
    if (e.target.id === 'btn-scope-my') {
      setOrganiserScopeCookie('my');
      closeNotificationsPanel();
      refresh();
    }
    if (e.target.id === 'btn-scope-all') {
      setOrganiserScopeCookie('clear');
      closeNotificationsPanel();
      refresh();
    }
  }

  function bindScopeButtonOnce() {
    if (scopeButtonsBound) return;
    scopeButtonsBound = true;
    document.getElementById('org-dashboard-alert')?.addEventListener('click', scopeClickHandler);
    document.getElementById('org-notices')?.addEventListener('click', scopeClickHandler);
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
        updateSetupResumeBanner();
        return;
      }
    } catch (err) {
      /* ignore */
    }

    if ((state.pendingClaimGroups || []).length > 0) {
      panel.hidden = true;
      updateSetupResumeBanner();
      return;
    }

    const progress = gettingStartedProgress();
    const coreDone = progress.hasGroup && progress.hasEvent;
    const requiredDone = [progress.hasGroup, progress.hasEvent].filter(Boolean).length;

    if (coreDone) {
      panel.hidden = true;
      try {
        localStorage.setItem('hub_getting_started_dismissed', '1');
      } catch (e) {
        /* ignore */
      }
      if (window.HubOrganiserOnboarding && window.HubOrganiserOnboarding.markResumeDismissed) {
        window.HubOrganiserOnboarding.markResumeDismissed();
      }
      updateSetupResumeBanner();
      return;
    }

    panel.hidden = false;

    const titleEl = panel.querySelector('.org-getting-started-title');
    if (titleEl) {
      if (requiredDone === 0) titleEl.textContent = "Here's what to do first";
      else titleEl.textContent = "Here's what's next";
    }
    panel.classList.remove('is-complete');

    const progressHint = document.getElementById('org-getting-started-progress');
    if (progressHint) {
      const remaining = 2 - requiredDone;
      progressHint.textContent =
        requiredDone === 0
          ? '2 steps to get your workspace ready.'
          : remaining === 1
            ? '1 step left on your setup checklist.'
            : remaining + ' steps left on your setup checklist.';
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
      li.hidden = done;
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

    updateSetupResumeBanner();
  }

  function updateSetupResumeBanner() {
    const banner = document.getElementById('org-setup-resume');
    if (!banner || state.adminView) return;

    const onboarding = window.HubOrganiserOnboarding;
    if (onboarding && onboarding.isResumeDismissed && onboarding.isResumeDismissed()) {
      banner.hidden = true;
      return;
    }

    if ((state.pendingClaimGroups || []).length > 0) {
      banner.hidden = true;
      return;
    }

    const progress = gettingStartedProgress();
    if (progress.hasGroup && progress.hasEvent) {
      banner.hidden = true;
      return;
    }

    const checklistDismissed = (function () {
      try {
        return localStorage.getItem('hub_getting_started_dismissed') === '1';
      } catch (e) {
        return false;
      }
    })();
    const tourDone = onboarding && onboarding.isTourDone && onboarding.isTourDone();
    const panel = document.getElementById('org-getting-started');
    const checklistVisible = panel && !panel.hidden;

    if (!checklistDismissed && !tourDone && !checklistVisible) {
      banner.hidden = true;
      return;
    }

    const titleEl = document.getElementById('org-setup-resume-title');
    const bodyEl = document.getElementById('org-setup-resume-body');
    if (!progress.hasGroup) {
      if (titleEl) titleEl.textContent = 'Step 1 of 2 — organiser page';
      if (bodyEl) {
        bodyEl.textContent = 'Create or claim your organiser page to get started on the hub.';
      }
    } else {
      if (titleEl) titleEl.textContent = 'Step 2 of 2 — list an event';
      if (bodyEl) {
        bodyEl.textContent = 'Your organiser page is ready — publish your first meeting, exhibition, or conference.';
      }
    }

    banner.hidden = false;
  }

  function bindSetupResumeUi() {
    const dismissBtn = document.getElementById('org-setup-resume-dismiss');
    const goBtn = document.getElementById('org-setup-resume-go');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () {
        if (window.HubOrganiserOnboarding && window.HubOrganiserOnboarding.markResumeDismissed) {
          window.HubOrganiserOnboarding.markResumeDismissed();
        }
        updateSetupResumeBanner();
      });
    }
    if (goBtn) {
      goBtn.addEventListener('click', function () {
        const progress = gettingStartedProgress();
        if (!progress.hasGroup) {
          window.location.href = '/organiser/group-edit';
          return;
        }
        if (window.HubFlowTour) window.HubFlowTour.markEventTourPending();
        const groupId = state.groups.length ? state.groups[0].id : '';
        openNewEventEditorDrawer({ groupId: groupId });
      });
    }
  }

  window.orgDashUpdateSetupResume = updateSetupResumeBanner;
  window.orgDashOpenClaimModal = function () {
    if ((state.pendingClaimGroups || []).length > 0) {
      renderGroupClaimModal();
    }
  };

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
    if (state.events.length || state.eventsTotal) return true;
    if ((state.upcomingEvents || []).length) return true;
    if ((state.eventSummaries || []).length) return true;
    if ((state.tickets || []).length) return true;
    if (totalTicketsSold() > 0) return true;
    return false;
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
          '/organiser/group-edit?id=' + encodeURIComponent(group.id) + '&onboard=review';
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
          ? 'Step 1 of 2 — profile 1 of ' + list.length
          : 'Step 1 of 2 — confirm your group';
    }
    if (nameEl) nameEl.textContent = group.name || 'Organiser page';
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
          '/organiser/group-edit?id=' + encodeURIComponent(data.group.id) + '&onboard=review';
        return;
      }

      await loadBootstrap();
      if (action === 'reject') {
        showOrganiserAlert(data.message || 'Profile removed from your dashboard. The Hub team has been notified.', false);
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
    renderOrganiserNotices();
  }

  function renderOpportunityEnquiries() {
    const body = document.getElementById('opp-enquiries-body');
    const empty = document.getElementById('opp-enquiries-empty');
    if (!body) return;

    const list = state.opportunityEnquiries || [];
    body.innerHTML = '';
    if (!list.length) {
      setOrgEmpty(empty, { show: true });
      updateOpportunityEnquiryUi();
      return;
    }
    setOrgEmpty(empty, { show: false });

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

  function hasOpportunityListings() {
    return (state.opportunities || []).length > 0;
  }

  function goToAddOpportunityListing() {
    const addMenu = document.getElementById('org-add-menu');
    const addToggle = document.getElementById('org-add-toggle');
    if (addMenu) addMenu.hidden = true;
    if (addToggle) addToggle.setAttribute('aria-expanded', 'false');
    if (hasOpportunityListings()) {
      location.href = '/organiser/opportunity-edit';
      return;
    }
    setRoute('business-list');
  }

  function scrollToBusinessEnquiries() {
    setRoute('business-overview');
    requestAnimationFrame(function () {
      const el = document.getElementById('org-opp-enquiries-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function updateBusinessListPageHead() {
    const titleEl = document.getElementById('org-business-list-title');
    const leadEl = document.getElementById('org-business-list-lead');
    if (!titleEl || !leadEl) return;
    if (hasOpportunityListings()) {
      titleEl.textContent = 'My listings';
      leadEl.textContent =
        'See how your listings are performing, then add another franchise, partnership, or side hustle when you are ready.';
    } else {
      titleEl.textContent = 'List a listing';
      leadEl.textContent =
        'See how listing works, what it costs, and start promoting a franchise, partnership, or side hustle on the hub.';
    }
  }

  function opportunityEnquiriesForListing(opportunityId) {
    return (state.opportunityEnquiries || []).filter(
      (e) => String(e.opportunityId || '') === String(opportunityId)
    );
  }

  function opportunityExpiryMeta(opportunity) {
    const raw = opportunity?.listingExpiresAt;
    if (!raw) return { label: '—', tone: 'muted' };
    const expires = new Date(raw);
    if (Number.isNaN(expires.getTime())) return { label: '—', tone: 'muted' };
    const label = formatDateShort(raw);
    if (expires.getTime() < Date.now()) return { label: 'Expired ' + label, tone: 'danger' };
    const daysLeft = Math.ceil((expires.getTime() - Date.now()) / 86400000);
    if (daysLeft <= 14) return { label: label + ' (' + daysLeft + 'd)', tone: 'warn' };
    return { label: label, tone: 'ok' };
  }

  function opportunityPremiumMeta(opportunity) {
    if (!opportunity?.featured) return { label: '—', tone: 'muted' };
    const raw = opportunity.featuredUntil;
    if (!raw) return { label: 'Active', tone: 'ok' };
    const until = new Date(raw);
    if (Number.isNaN(until.getTime())) return { label: 'Active', tone: 'ok' };
    const label = formatDateShort(raw);
    if (until.getTime() < Date.now()) return { label: 'Ended', tone: 'muted' };
    const daysLeft = Math.ceil((until.getTime() - Date.now()) / 86400000);
    if (daysLeft <= 14) return { label: label + ' (' + daysLeft + 'd)', tone: 'warn' };
    return { label: label, tone: 'ok' };
  }

  function opportunityExpiryCellHtml(opportunity) {
    const meta = opportunityExpiryMeta(opportunity);
    if (meta.tone === 'muted') return '<span class="org-opp-expiry muted">' + esc(meta.label) + '</span>';
    const cls =
      meta.tone === 'danger'
        ? 'org-opp-expiry is-danger'
        : meta.tone === 'warn'
          ? 'org-opp-expiry is-warn'
          : 'org-opp-expiry';
    return '<span class="' + cls + '">' + esc(meta.label) + '</span>';
  }

  function opportunitySaveCount(o) {
    return Math.max(0, Number(o && o.saveCount) || 0);
  }

  function opportunitySaveCountHtml(o) {
    const n = opportunitySaveCount(o);
    if (!n) return '<span class="muted">0</span>';
    return (
      '<span class="org-opp-save-count" title="Members who saved this listing — anonymous">' +
      esc(String(n)) +
      '</span>'
    );
  }

  function renderOpportunityPerformance() {
    const wrap = document.getElementById('org-opp-performance-wrap');
    const mount = document.getElementById('org-opp-listing-cards');
    if (!wrap || !mount) return;
    const list = (state.opportunities || []).slice();
    if (!list.length) {
      wrap.hidden = true;
      mount.innerHTML = '';
      updateBusinessListPageHead();
      return;
    }
    wrap.hidden = false;
    mount.innerHTML = '';
    list.forEach((o) => {
      const st = opportunityStatusForBadge(o);
      const enquiries = opportunityEnquiriesForListing(o.id);
      const newCount = enquiries.filter((e) => String(e.status || '').toLowerCase() === 'new').length;
      const expiry = opportunityExpiryMeta(o);
      const editUrl = '/organiser/opportunity-edit?id=' + encodeURIComponent(o.id);
      const viewUrl = o.slug
        ? '/opportunities/' + encodeURIComponent(o.slug)
        : '/opportunities/' + encodeURIComponent(o.id);
      const card = document.createElement('article');
      card.className = 'org-opp-listing-card';
      card.innerHTML =
        '<header class="org-opp-listing-card-head">' +
        '<h3 class="org-opp-listing-card-title"><a href="' +
        esc(editUrl) +
        '">' +
        esc(o.title || 'Untitled') +
        '</a></h3>' +
        statusBadgeHtml(st.key, st.label) +
        '</header>' +
        '<div class="org-stats org-stats--four org-opp-listing-card-stats">' +
        '<div class="org-stat gold"><div class="org-stat-label">Enquiries</div><div class="org-stat-value">' +
        esc(String(enquiries.length)) +
        '</div></div>' +
        '<div class="org-stat green"><div class="org-stat-label">New</div><div class="org-stat-value">' +
        esc(String(newCount)) +
        '</div></div>' +
        '<div class="org-stat purple"><div class="org-stat-label">Member saves</div><div class="org-stat-value">' +
        esc(String(opportunitySaveCount(o))) +
        '</div></div>' +
        '<div class="org-stat gold"><div class="org-stat-label">Listing expires</div><div class="org-stat-value org-stat-value--text' +
        (expiry.tone === 'danger' ? ' is-danger' : expiry.tone === 'warn' ? ' is-warn' : '') +
        '">' +
        esc(expiry.label) +
        '</div></div>' +
        '</div>' +
        '<div class="org-opp-listing-card-actions">' +
        '<a class="org-btn org-btn-outline org-btn-sm" href="' +
        esc(editUrl) +
        '">Edit listing</a> ' +
        '<a class="org-btn org-btn-outline org-btn-sm" href="' +
        esc(viewUrl) +
        '" target="_blank" rel="noopener">View live</a> ' +
        (enquiries.length
          ? '<button type="button" class="org-btn org-btn-gold org-btn-sm" data-org-shortcut="business-overview-enquiries">View enquiries</button>'
          : '') +
        '</div>';
      mount.appendChild(card);
    });
    updateBusinessListPageHead();
  }

  function opportunityStatusForBadge(o) {
    const status = String(o.status || '').toLowerCase();
    if (status === 'published' || status === 'live') return { key: 'live', label: 'Live' };
    if (status === 'draft') return { key: 'draft', label: 'Draft' };
    if (status === 'unpublished') return { key: 'unpublished', label: 'Unpublished' };
    const approval = String(o.approvalStatus || '');
    if (/pending/i.test(approval)) return { key: 'pending_approval', label: approval };
    return { key: 'draft', label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Draft' };
  }

  function renderOpportunitiesList() {
    const body = document.getElementById('opp-listings-body');
    const empty = document.getElementById('opp-listings-empty');
    if (!body) return;
    body.innerHTML = '';
    const list = (state.opportunities || []).slice();
    if (!list.length) {
      setOrgEmpty(empty, { show: true });
      return;
    }
    setOrgEmpty(empty, { show: false });
    list.forEach((o) => {
      const st = opportunityStatusForBadge(o);
      const enquiries = opportunityEnquiriesForListing(o.id);
      const newCount = enquiries.filter((e) => String(e.status || '').toLowerCase() === 'new').length;
      const viewUrl = o.slug
        ? '/opportunities/' + encodeURIComponent(o.slug)
        : '/opportunities/' + encodeURIComponent(o.id);
      const editUrl = '/organiser/opportunity-edit?id=' + encodeURIComponent(o.id);
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="org-td-name"><a class="org-td-name-click" href="' +
        esc(editUrl) +
        '">' +
        esc(o.title || 'Untitled') +
        '</a></td><td>' +
        statusBadgeHtml(st.key, st.label) +
        '</td><td>' +
        esc(String(enquiries.length)) +
        '</td><td>' +
        (newCount
          ? '<span class="org-opp-new-count">' + esc(String(newCount)) + '</span>'
          : '<span class="muted">0</span>') +
        '</td><td>' +
        opportunitySaveCountHtml(o) +
        '</td><td>' +
        opportunityExpiryCellHtml(o) +
        '</td><td class="org-td-actions">' +
        '<a class="org-btn org-btn-outline org-btn-sm" href="' +
        esc(editUrl) +
        '">Edit</a> ' +
        '<a class="org-btn org-btn-outline org-btn-sm" href="' +
        esc(viewUrl) +
        '" target="_blank" rel="noopener">View</a>' +
        '</td>';
      body.appendChild(tr);
    });
    renderOpportunityPerformance();
  }

  async function loadOpportunitiesList() {
    if (state.opportunitiesLoaded) {
      renderOpportunitiesList();
      updateBusinessListPageHead();
      return;
    }
    try {
      const { ok, data } = await api('/api/organiser/opportunities');
      if (!ok) return;
      state.opportunities = data.opportunities || [];
      state.opportunitiesLoaded = true;
      renderStats();
      renderOpportunitiesList();
      if (linkedInPostBuilder && linkedInPostBuilder.refreshOpportunities) {
        linkedInPostBuilder.refreshOpportunities();
      }
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
      state.opportunityEnquiriesLoaded = true;
    } catch (e) {
      state.opportunityEnquiries = [];
      state.opportunityEnquiriesNewCount = 0;
    } finally {
      if (hint) hint.hidden = true;
      renderHubPortalMeta();
      renderOrganiserNotices();
      renderOpportunityEnquiries();
      renderOpportunitiesList();
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
    renderOrganiserNotices();
    renderGroups();
    if (document.querySelector('[data-org-page="team"].is-active')) renderTeam();
    if (document.querySelector('[data-org-page="events"].is-active') && state.eventsLoaded) {
      renderMyEventsHub();
      fillEventSelect(document.getElementById('ticket-event'));
    }
    updateOpportunityEnquiryUi();
    updateGettingStartedPanel();
    if (state.opportunitiesLoaded) renderOpportunitiesList();
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
    state.eventsLoaded = false;
    state.tickets = data.tickets || [];
    listPages.groups = 1;
    listPages.events = 1;
    listPages.tickets = 1;
    listPages.reviews = 1;
    listPages.revenue = 1;
    listPages.attendees = 1;
    state.reviews = data.reviews || [];
    state.reviewsLoaded = false;
    state.groupRankings = data.groupRankings || {};
    state.workspaceSummary =
      data.workspaceSummary && data.workspaceSummary.computed ? data.workspaceSummary : null;
    state.eventSummaries = data.eventSummaries || [];
    state.pendingApplicationsCount = Number(data.pendingApplications?.count) || 0;
    state.pendingApplicationsPreview = data.pendingApplications?.preview || [];
    if (!silent) {
      state.attendeesLoaded = false;
      state.attendeesAll = [];
    }
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
    state.canManagePayments = data.canManagePayments !== false;
    state.canCreateGroups = data.canCreateGroups !== false;
    state.organiserRole = data.organiserRole || 'owner';
    state.useTeamWorkspace = Boolean(data.useTeamWorkspace);
    state.stripeConnectEnabled = Boolean(data.stripeConnectEnabled);
    state.organiserAccess = data.organiserAccess === true;
    state.organiserEmailVerified = data.organiserEmailVerified === true;
    updatePendingApplicationsNavBadge();

    if (data.adminView) {
      state.dashboardScope = { kind: 'admin' };
      bindScopeButtonOnce();
    } else if (data.personalScope && data.isAdmin) {
      state.dashboardScope = { kind: 'personal_admin' };
      bindScopeButtonOnce();
    } else if (data.groupsError) {
      state.dashboardScope = { kind: 'groups_error', message: data.groupsError };
    } else if (!state.groups.length && !state.pendingClaimGroups.length) {
      state.dashboardScope = { kind: 'onboarding' };
    } else {
      state.dashboardScope = null;
    }

    if (!silent) showOrganiserAlert(null);
    showOrganiserEmailVerifyBanner();

    applyPendingGroupSave();
    pruneStaleEventFilters();
    renderAll();
    if (!document.querySelector('[data-org-page="events"].is-active')) {
      renderStripeConnectBanner();
    }
    renderGroupClaimModal();
    updateTeamNavBadge();
    if (window.HubOrganiserOnboarding && window.HubOrganiserOnboarding.initAfterDashboardReady) {
      window.HubOrganiserOnboarding.initAfterDashboardReady();
    }
    bootstrapReady = true;
    enforceEventsOrganiserGate();
    if (document.querySelector('[data-org-page="events"].is-active')) {
      setEventsSub(eventsSubRoute);
    }
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
        showOrganiserAlert(
          esc(data.message || data.error || 'Could not create ticket'),
          true
        );
        alertEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      const extrasResult = await saveTicketModalAttendeeExtras(eventId);
      const extras = readTicketModalAttendeeExtras();
      const eventTitle =
        state.events.find((row) => row.id === eventId)?.title || 'your event';
      const priceNum = Number(price);
      const priceLabel =
        Number.isFinite(priceNum) && priceNum > 0
          ? '£' + (priceNum % 1 === 0 ? priceNum.toFixed(0) : priceNum.toFixed(2))
          : 'Free';
      closeModals();
      document.getElementById('form-ticket').reset();
      await refresh();
      setRoute('events-tickets');
      let message =
        '<strong>Ticket created.</strong> “' +
        esc(name) +
        '” (' +
        esc(priceLabel) +
        ') is now on <strong>' +
        esc(eventTitle) +
        '</strong>.';
      if (extras.collectDietary || extras.collectAccessibility) {
        message += extrasResult.ok
          ? ' Attendees will be asked about dietary or accessibility needs at checkout.'
          : ' Booking questions could not be saved — open the event tickets page and save again.';
      } else if (extras.foodIncluded && extrasResult.ok) {
        message += ' Food and drink is noted on your event listing.';
      }
      showOrganiserAlert(message, !extrasResult.ok);
      alertEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function bindUi() {
    bindNotificationsPanelOnce();
    bindScopeButtonOnce();

    if (!window.__hubPaymentSetupLinkedBound) {
      window.__hubPaymentSetupLinkedBound = true;
      window.addEventListener('hub-payment-setup-linking', function () {
        showOrganiserAlert('Linking bank details from your connected organiser page…', false);
        alertEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      window.addEventListener('hub-payment-setup-link-failed', function (e) {
        showOrganiserAlert(
          (e.detail && e.detail.message) || 'Could not reuse bank details.',
          true
        );
        alertEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      window.addEventListener('hub-payment-setup-linked', function () {
        showOrganiserAlert('Bank details linked — refreshing your workspace…', false);
        loadBootstrap({ silent: true })
          .then(function () {
            renderPaymentSetupUi();
            renderAll();
            showOrganiserAlert(
              'Bank details linked to this organiser page. Paid tickets can go live here.',
              false
            );
            alertEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          })
          .catch(function (err) {
            showOrganiserAlert(
              'Bank details were linked, but the dashboard could not refresh. Reload the page. ' +
                (err && err.message ? '(' + err.message + ')' : ''),
              true
            );
            alertEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          });
      });
      window.addEventListener('hub-payment-setup-needed', function (e) {
        focusBankDetailsSetup(
          (e.detail && e.detail.message) ||
            'Add bank details before opening the Stripe dashboard.'
        );
      });
    }

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

    document.getElementById('btn-needs-organiser-page-create')?.addEventListener('click', () => {
      closeModals();
      openGroupEditorDrawer();
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

    document.querySelectorAll('.org-add-menu-item[href="/organiser/event-format"]').forEach((el) => {
      el.addEventListener('click', goToNewEventEditor);
    });

    const btnNewTicket = document.getElementById('btn-new-ticket');
    const ticketEventSelect = document.getElementById('ticket-event');
    if (ticketEventSelect && !ticketEventSelect.dataset.extrasBound) {
      ticketEventSelect.dataset.extrasBound = '1';
      ticketEventSelect.addEventListener('change', () => {
        syncTicketModalAttendeeExtras(ticketEventSelect.value);
      });
    }
    if (btnNewTicket) {
      btnNewTicket.addEventListener('click', () => {
        if (!state.events.length) {
          alert('Create an event first.');
          setRoute('events-list');
          return;
        }
        fillEventSelect(document.getElementById('ticket-event'));
        syncTicketModalAttendeeExtras();
        openModal('modal-ticket');
      });
    }
    const btnNewTicketEmpty = document.getElementById('btn-new-ticket-empty');
    if (btnNewTicketEmpty && btnNewTicket) {
      btnNewTicketEmpty.addEventListener('click', () => btnNewTicket.click());
    }

    document.querySelectorAll('[data-events-tab]').forEach((tab) => {
      tab.addEventListener('click', () => {
        const route = tab.getAttribute('data-events-tab');
        if (route) setRoute(route);
      });
    });

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
          ensureTeamLoaded().then(function () {
            renderTeam();
            updateGettingStartedPanel();
          });
        } else if (route === 'business-overview-enquiries') {
          scrollToBusinessEnquiries();
        }
      });
    });

    document.querySelectorAll('[data-action="add-opportunity-listing"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        goToAddOpportunityListing();
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
        listPages.revenue = 1;
        renderEvents();
        if (eventsSubRoute === 'events-revenue') renderRevenue();
      });
    });

    ['filter-revenue-status', 'filter-revenue-search'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const evt = id === 'filter-revenue-search' ? 'input' : 'change';
      el.addEventListener(evt, () => {
        if (id === 'filter-revenue-status') filters.eventsStatus = el.value;
        if (id === 'filter-revenue-search') filters.eventsSearch = el.value;
        listPages.events = 1;
        listPages.revenue = 1;
        renderRevenue();
        if (eventsSubRoute === 'events-list') renderEvents();
      });
    });

    document.getElementById('sub-events-list')?.addEventListener('click', (e) => {
      const sortBtn = e.target.closest('[data-events-sort]');
      if (!sortBtn) return;
      e.preventDefault();
      toggleEventsSort(sortBtn.getAttribute('data-events-sort') || 'date');
    });

    const hideArchivedEl = document.getElementById('filter-events-hide-archived');
    if (hideArchivedEl) {
      hideArchivedEl.checked = filters.eventsHideArchived !== false;
      hideArchivedEl.addEventListener('change', () => {
        filters.eventsHideArchived = hideArchivedEl.checked;
        listPages.events = 1;
        listPages.revenue = 1;
        renderEvents();
        if (eventsSubRoute === 'events-revenue') renderRevenue();
      });
    }

    const revHideArchivedEl = document.getElementById('filter-revenue-hide-archived');
    if (revHideArchivedEl) {
      revHideArchivedEl.checked = filters.eventsHideArchived !== false;
      revHideArchivedEl.addEventListener('change', () => {
        filters.eventsHideArchived = revHideArchivedEl.checked;
        listPages.events = 1;
        listPages.revenue = 1;
        renderRevenue();
        if (eventsSubRoute === 'events-list') renderEvents();
      });
    }

    document.getElementById('events-body')?.addEventListener('keydown', (e) => {
      const row = e.target.closest('tr.org-series-parent-row');
      if (!row) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      toggleSeriesExpand(row.getAttribute('data-series-key'));
    });

    document.getElementById('revenue-body')?.addEventListener('keydown', (e) => {
      const row = e.target.closest('tr.org-series-parent-row');
      if (!row) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      toggleSeriesExpand(row.getAttribute('data-series-key'));
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

    ['filter-tickets-scope', 'filter-tickets-event', 'filter-tickets-type'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        if (id === 'filter-tickets-scope') filters.ticketsScope = el.value;
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

    const reviewsList = document.getElementById('reviews-list');
    if (reviewsList) {
      reviewsList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-edit-review-reply]');
        if (editBtn) {
          const review = findReviewById(editBtn.getAttribute('data-edit-review-reply'));
          if (!review) return;
          state.reviews.forEach((row) => {
            row._composing = false;
          });
          review._composing = true;
          renderReviews();
          const input = document.getElementById('review-reply-' + review.id);
          if (input) input.focus();
          return;
        }

        const cancelBtn = e.target.closest('[data-cancel-review-reply]');
        if (cancelBtn) {
          const review = findReviewById(cancelBtn.getAttribute('data-cancel-review-reply'));
          if (!review) return;
          review._composing = false;
          renderReviews();
          return;
        }

        const saveBtn = e.target.closest('[data-save-review-reply]');
        if (saveBtn) {
          const reviewId = saveBtn.getAttribute('data-save-review-reply');
          const input = document.getElementById('review-reply-' + reviewId);
          saveReviewReply(reviewId, input ? input.value : '');
          return;
        }

        const clearBtn = e.target.closest('[data-clear-review-reply]');
        if (clearBtn) {
          const reviewId = clearBtn.getAttribute('data-clear-review-reply');
          const ok = window.confirm('Remove your public reply from this review?');
          if (!ok) return;
          saveReviewReply(reviewId, '');
        }
      });
    }

    const attendeesEventFilter = document.getElementById('filter-attendees-event');
    if (attendeesEventFilter) {
      attendeesEventFilter.addEventListener('change', () => {
        setAttendeesEventFilterValue(attendeesEventFilter.value);
      });
    }

    const attendeesEventTrigger = document.getElementById('filter-attendees-event-trigger');
    const attendeesEventPanel = document.getElementById('filter-attendees-event-panel');
    const attendeesEventSearch = document.getElementById('filter-attendees-event-search');
    const attendeesEventList = document.getElementById('filter-attendees-event-list');
    if (attendeesEventTrigger && attendeesEventPanel) {
      attendeesEventTrigger.addEventListener('click', function (e) {
        e.preventDefault();
        if (attendeesEventPanel.hidden) openAttendeesEventPicker();
        else closeAttendeesEventPicker();
      });
    }
    if (attendeesEventSearch) {
      attendeesEventSearch.addEventListener('input', function () {
        renderAttendeesEventPickerList(attendeesEventSearch.value);
      });
      attendeesEventSearch.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeAttendeesEventPicker();
          if (attendeesEventTrigger) attendeesEventTrigger.focus();
        }
      });
    }
    if (attendeesEventList) {
      attendeesEventList.addEventListener('click', function (e) {
        const option = e.target && e.target.closest('[data-event-id]');
        if (!option) return;
        setAttendeesEventFilterValue(option.getAttribute('data-event-id'));
        closeAttendeesEventPicker();
      });
    }
    document.addEventListener('click', function (e) {
      const picker = document.getElementById('attendees-event-picker');
      if (!picker || !attendeesEventPanel || attendeesEventPanel.hidden) return;
      if (!picker.contains(e.target)) closeAttendeesEventPicker();
    });

    const attendeesSearchFilter = document.getElementById('filter-attendees-search');
    if (attendeesSearchFilter) {
      attendeesSearchFilter.addEventListener('input', () => {
        filters.attendeesSearch = attendeesSearchFilter.value;
        listPages.attendees = 1;
        renderAttendees();
      });
    }

    const attendeesStatusFilter = document.getElementById('filter-attendees-status');
    if (attendeesStatusFilter) {
      attendeesStatusFilter.addEventListener('change', () => {
        filters.attendeesStatus = attendeesStatusFilter.value;
        listPages.attendees = 1;
        renderAttendees();
      });
    }

    const attendeesRelationshipFilter = document.getElementById('filter-attendees-relationship');
    if (attendeesRelationshipFilter) {
      attendeesRelationshipFilter.addEventListener('change', () => {
        filters.attendeesRelationship = attendeesRelationshipFilter.value;
        listPages.attendees = 1;
        renderAttendees();
      });
    }

    const attendeesHideArchivedFilter = document.getElementById(
      'filter-attendees-hide-archived'
    );
    if (attendeesHideArchivedFilter) {
      attendeesHideArchivedFilter.checked = filters.attendeesHideArchived !== false;
      attendeesHideArchivedFilter.addEventListener('change', () => {
        filters.attendeesHideArchived = attendeesHideArchivedFilter.checked;
        const selectedEvent = allEventOptions().find((ev) => ev.id === filters.attendeesEvent);
        if (filters.attendeesHideArchived && eventRowIsArchived(selectedEvent)) {
          filters.attendeesEvent = 'all';
        }
        listPages.attendees = 1;
        fillAttendeesEventFilter();
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
    const btnDownloadBadges = document.getElementById('btn-download-name-badges');
    if (btnDownloadBadges) {
      btnDownloadBadges.addEventListener('click', exportNameBadgesPdf);
    }

    const btnAttendeesShowAll = document.getElementById('btn-attendees-show-all');
    if (btnAttendeesShowAll) {
      btnAttendeesShowAll.addEventListener('click', clearAttendeesPendingFilter);
    }

    const btnAttendeesViewArchive = document.getElementById('btn-attendees-view-archive');
    if (btnAttendeesViewArchive) {
      btnAttendeesViewArchive.addEventListener('click', () => setAttendeesView('archive'));
    }

    const btnAttendeesViewActive = document.getElementById('btn-attendees-view-active');
    if (btnAttendeesViewActive) {
      btnAttendeesViewActive.addEventListener('click', () => setAttendeesView('active'));
    }

    const attendeesPanel = document.getElementById('sub-events-attendees');
    if (attendeesPanel && !attendeesPanel.dataset.seatRefillBound) {
      attendeesPanel.dataset.seatRefillBound = '1';
      attendeesPanel.addEventListener('click', (e) => {
        const refillBtn = e.target.closest('#btn-attendees-seat-refill-archive');
        if (refillBtn) setAttendeesView('archive');
      });
    }

    const attendeesBody = document.getElementById('attendees-body');
    if (attendeesBody && !attendeesBody.dataset.reviewBound) {
      attendeesBody.dataset.reviewBound = '1';
      attendeesBody.addEventListener('click', (e) => {
        const approveBtn = e.target.closest('[data-approve-application]');
        const showDenyBtn = e.target.closest('[data-show-deny-form]');
        const confirmDenyBtn = e.target.closest('[data-confirm-deny-application]');
        const cancelDenyBtn = e.target.closest('[data-cancel-deny-application]');
        const resendBtn = e.target.closest('[data-resend-application-alert]');
        const resendApprovalBtn = e.target.closest('[data-resend-approval-email]');
        const reconsiderBtn = e.target.closest('[data-reconsider-application]');
        if (approveBtn) {
          reviewApplication(approveBtn.getAttribute('data-approve-application'), 'approve');
          return;
        }
        if (showDenyBtn) {
          showDenyPanel(showDenyBtn.getAttribute('data-show-deny-form'));
          return;
        }
        if (confirmDenyBtn) {
          const registrationId = confirmDenyBtn.getAttribute('data-confirm-deny-application');
          const review = document.querySelector('[data-review-id="' + registrationId + '"]');
          const textarea = review ? review.querySelector('.org-application-deny-note') : null;
          reviewApplication(registrationId, 'deny', textarea ? textarea.value : '');
          return;
        }
        if (cancelDenyBtn) {
          hideDenyPanel(cancelDenyBtn.getAttribute('data-cancel-deny-application'));
          return;
        }
        if (resendBtn) {
          resendApplicationAlert(resendBtn.getAttribute('data-resend-application-alert'));
          return;
        }
        if (resendApprovalBtn) {
          resendApprovalEmail(resendApprovalBtn.getAttribute('data-resend-approval-email'));
          return;
        }
        if (reconsiderBtn) {
          reconsiderApplication(
            reconsiderBtn.getAttribute('data-reconsider-application'),
            reconsiderBtn.getAttribute('data-reconsider-mode')
          );
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

        const shortcutBtn = e.target.closest('[data-org-shortcut]');
        if (shortcutBtn) {
          e.preventDefault();
          const route = shortcutBtn.getAttribute('data-org-shortcut');
          if (route === 'business-overview-enquiries') {
            scrollToBusinessEnquiries();
            return;
          }
          if (route) {
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
              ensureTeamLoaded().then(function () {
                renderTeam();
                updateGettingStartedPanel();
              });
            }
          }
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
        const stripeDashboardBtn = e.target.closest('[data-stripe-dashboard]');
        if (stripeDashboardBtn) {
          e.preventDefault();
          e.stopPropagation();
          openStripeDashboard(stripeDashboardBtn.getAttribute('data-stripe-dashboard'));
          return;
        }
        const stripeDashboardIdBtn = e.target.closest('#org-open-stripe-dashboard');
        if (stripeDashboardIdBtn) {
          e.preventDefault();
          e.stopPropagation();
          const action = stripeDashboardIdBtn.dataset.stripeAction || 'dashboard';
          if (action === 'setup') {
            startStripeConnectOnboarding(stripeDashboardIdBtn.getAttribute('data-stripe-setup'));
            return;
          }
          if (action === 'create-group') {
            setRoute('groups');
            showOrganiserAlert(
              'Create an organiser page, then return to Revenue to add bank details.',
              false
            );
            return;
          }
          openStripeDashboard(stripeDashboardIdBtn.getAttribute('data-stripe-dashboard'));
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

    document.querySelectorAll('[data-org-member-lists-nav]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToMemberLists();
      });
    });

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
      applyAttendeesDeepLinkFromUrl();
      const r = parseRoute();
      setRoute(r.sub || r.page);
      if (
        r.page === 'groups' ||
        r.page === 'dashboard' ||
        r.page === 'team' ||
        (r.page === 'events' && (r.sub === 'events-attendees' || r.sub === 'events-cancellations'))
      ) {
        refresh();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !shell || shell.hidden) return;
      if (eventsSubRoute === 'events-attendees') {
        ensureAttendeesLoaded({ force: true });
      } else if (eventsSubRoute === 'events-cancellations') {
        loadCancellationsAll().then(() => renderCancellations());
      }
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
              showOrganiserAlert(err.message || 'Could not load events', true);
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

    document.querySelectorAll('a[href="/organiser/group-edit"]').forEach((link) => {
      link.addEventListener('click', goToNewGroupEditor);
    });

    document.querySelectorAll('[data-org-group-drawer-close]').forEach((el) => {
      el.addEventListener('click', closeGroupEditorDrawer);
    });

    document.querySelectorAll('[data-org-event-drawer-close]').forEach((el) => {
      el.addEventListener('click', closeEventEditorDrawer);
    });

    const eventDrawerBack = document.getElementById('org-event-drawer-back');
    if (eventDrawerBack) {
      eventDrawerBack.addEventListener('click', goBackFromEventTicketsDrawer);
    }

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
      if (e.data && e.data.type === 'hub-event-cancel-request') {
        const cancelId = e.data.eventId || '';
        if (cancelId) openCancelEventModal(cancelId);
        return;
      }
      if (e.data && e.data.type === 'hub-event-saved') {
        closeEventEditorDrawer();
        loadBootstrap().then(renderAll);
        return;
      }
      if (e.data && e.data.type === 'hub-event-drawer-ready') {
        setEventDrawerLoading(false);
        return;
      }
      if (e.data && e.data.type === 'hub-event-drawer-busy') {
        setEventDrawerLoading(Boolean(e.data.busy), e.data.message || '');
        return;
      }
      if (e.data && e.data.type === 'hub-event-not-found') {
        const missingId = e.data.eventId || '';
        closeEventEditorDrawer();
        if (missingId) clearEventScopedClientState(missingId);
        pruneStaleEventFilters();
        loadBootstrap({ silent: true }).then(function () {
          setRoute('events-list');
          showOrganiserAlert(
            'That event is no longer available — it may have been deleted. Check My Events for your current listings.',
            true
          );
        });
        return;
      }
      if (e.data && e.data.type === 'hub-event-goto-tickets') {
        const ids = Array.isArray(e.data.eventIds) ? e.data.eventIds : [];
        if (ids.length) openEventTicketsDrawer(ids, e.data.title || '');
        return;
      }
      if (e.data && e.data.type === 'hub-event-tickets-done') {
        const publishedEventIds = Array.isArray(e.data.eventIds)
          ? e.data.eventIds.filter(Boolean)
          : [];
        const publishedEventId =
          e.data.eventId || publishedEventIds[0] || '';
        closeEventEditorDrawer();
        if (e.data.publishedUrl) {
          location.href = String(e.data.publishedUrl);
          return;
        }
        if (publishedEventId) {
          const qs = new URLSearchParams();
          qs.set('ids', publishedEventIds.length ? publishedEventIds.join(',') : publishedEventId);
          if (e.data.title) qs.set('title', String(e.data.title));
          if (e.data.imageUrl) qs.set('image', String(e.data.imageUrl));
          location.href = '/organiser/event-published?' + qs.toString();
          return;
        }
        loadBootstrap({ silent: true }).then(function () {
          renderAll();
          showOrganiserAlert('Your event is live.', false);
        });
        return;
      }
      if (e.data && e.data.type === 'hub-open-stripe-connect' && e.data.url) {
        // Legacy: older drawer scripts post Stripe URLs. Keep dashboard open.
        const url = String(e.data.url);
        if (window.HubOrganiserPaymentSetup && window.HubOrganiserPaymentSetup.openUrlInNewTab) {
          window.HubOrganiserPaymentSetup.openUrlInNewTab(url);
        } else {
          const stripeTab = window.open(url, '_blank');
          if (stripeTab) {
            try {
              stripeTab.opener = null;
            } catch {
              /* ignore */
            }
          }
        }
        return;
      }
      if (e.data && e.data.type === 'hub-event-goto-edit') {
        const editId = e.data.eventId || '';
        if (editId) openEventEditorDrawer(editId, { fromTickets: true });
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
    const deleteConfirmBtn = document.getElementById('btn-event-delete-confirm');
    if (deleteConfirmBtn) {
      deleteConfirmBtn.addEventListener('click', () => {
        submitDeleteEvent();
      });
    }
    const duplicateConfirmBtn = document.getElementById('btn-event-duplicate-confirm');
    if (duplicateConfirmBtn) {
      duplicateConfirmBtn.addEventListener('click', () => {
        submitDuplicateEvent();
      });
    }
    const groupDuplicateConfirmBtn = document.getElementById('btn-group-duplicate-confirm');
    if (groupDuplicateConfirmBtn) {
      groupDuplicateConfirmBtn.addEventListener('click', () => {
        submitDuplicateGroup();
      });
    }
  }

  async function boot(user) {
    state.user = user;
    setDashboardLoading(true);
    try {
      const hubMode = await api('/api/auth/hub-mode', {
        method: 'POST',
        body: JSON.stringify({ mode: 'organiser' }),
      });
      if (!hubMode.ok && hubMode.data && hubMode.data.redirect) {
        window.location.href = hubMode.data.redirect;
        return;
      }
    } catch {
      /* non-fatal for cookie set; continue if session already allows organiser UI */
    }
    state.user = user;
    if (signin) signin.hidden = true;
    shell.hidden = false;
    const payoutSubmit = document.getElementById('btn-payout-submit');
    if (payoutSubmit) {
      payoutSubmit.addEventListener('click', submitPayoutRequest);
    }
    const alumniSendBtn = document.getElementById('modal-alumni-invites-send');
    if (alumniSendBtn) {
      alumniSendBtn.addEventListener('click', submitAlumniInvites);
    }

    bindForms();
    bindTeamUi();
    bindOnboardingPipeline();
    bindGroupClaimUi();
    bindSetupResumeUi();
    bindReadyEventUi();
    bindUi();
    const initial = resolveInitialRoute();
    setRoute(initial.sub || initial.page);
    try {
      await loadBootstrap();
      let pendingPromoteEventId = '';
      try {
        pendingPromoteEventId = sessionStorage.getItem('hub_promote_event_id') || '';
        if (pendingPromoteEventId) sessionStorage.removeItem('hub_promote_event_id');
      } catch {
        /* ignore private mode */
      }
      if (pendingPromoteEventId) {
        setRoute('social');
        ensureLinkedInPostBuilder({ force: true });
        if (linkedInPostBuilder?.prefillEvent) {
          linkedInPostBuilder.prefillEvent(pendingPromoteEventId);
        }
        showOrganiserAlert(
          'Your event is live. We created a social post draft in Promote & social.',
          false
        );
      }
      finishDeepLinkAfterBootstrap();
      const connectParam = new URLSearchParams(window.location.search).get('stripe_connect');
      if (connectParam && state.stripeConnectEnabled && state.groups.length) {
        const gid =
          primaryGroupForStripeConnect()?.id ||
          state.groups.find((g) => !g.stripeConnectReady)?.id ||
          state.groups[0].id;
        const { ok, data } = await api(
          '/api/organiser/stripe-connect?groupId=' + encodeURIComponent(gid)
        );
        await loadBootstrap();
        if (ok && data && data.ready) {
          showOrganiserAlert('Bank details saved. You can publish paid tickets now.', false);
        } else if (connectParam === 'refresh' || (data && !data.ready)) {
          showOrganiserAlert(
            (data && data.incompleteHint) ||
              'Stripe setup is not finished yet. Open Add bank details again to complete the remaining steps.',
            true
          );
        } else {
          showOrganiserAlert('Bank details updated.', false);
        }
        if (window.history.replaceState) {
          const url = new URL(window.location.href);
          url.searchParams.delete('stripe_connect');
          url.searchParams.delete('panel');
          window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        }
      }
    } catch (e) {
      showOrganiserAlert('Could not load dashboard: ' + esc(e.message), true);
      setDashboardLoading(false);
    }
  }

  fetch('/api/auth/session', { credentials: 'include' })
    .then((res) => res.json())
    .then((data) => {
      if (!data.ok || !data.user) {
        setDashboardLoading(false);
        if (signin) signin.hidden = false;
        return;
      }
      const hasAccess =
        data.organiserUiVisible || data.user.role === 'admin';
      if (!hasAccess) {
        if (data.organiserAccess && !data.organiserUiVisible) {
          window.location.href = '../account/settings#organiser-workspace';
          return;
        }
        window.location.href = '/organiser/enable';
        return;
      }
      state.organiserAccess = data.organiserAccess === true;
      state.organiserEmailVerified = data.organiserEmailVerified === true;
      boot(data.user);
    })
    .catch(() => {
      setDashboardLoading(false);
      if (signin) {
        signin.hidden = false;
        signin.querySelector('.org-section-sub').textContent =
          'Could not verify your session. Please try signing in again.';
      }
    });
})();
