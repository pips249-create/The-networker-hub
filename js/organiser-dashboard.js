/**
 * Organiser dashboard — groups, events, ticket types (Supabase via /api/organiser/*).
 */
(function () {
  const ORG_PAGE_SIZE = 10;
  const EVENTS_FETCH_SIZE = 100;
  const DESCRIPTION_MAX_WORDS = 500;
  const listPages = { groups: 1, events: 1, tickets: 1, attendees: 1, cancellations: 1, reviews: 1, revenue: 1 };
  let eventsSubRoute = 'events-list';
  let businessSubRoute = 'business-listings';
  const expandedSeriesKeys = new Set();
  let eventsGroupingPromise = null;
  let bootstrapReady = false;
  let membershipsRosterLoadedFor = '';
  let attendeesLoadingPromise = null;
  let teamLoadingPromise = null;
  let eventsLoadingPromise = null;
  let eventsLoadGen = 0;
  let reviewsLoadingPromise = null;

  const filters = {
    eventsStatus: 'all',
    eventsType: 'all',
    eventsSearch: '',
    eventsHideArchived: true,
    eventsHideUnpublished: false,
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
    membershipsGroup: '',
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
    eventsEnrichment: 'none',
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
    teamActivityItems: [],
    teamActivityLoaded: false,
    teamMax: 100,
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
    pendingClaimOpportunities: [],
    organiserAccess: false,
    organiserEmailVerified: false,
    dashboardScope: null,
  };

  let groupClaimRejectMode = false;
  let groupClaimSubmitInFlight = false;
  let opportunityClaimRejectMode = false;

  function isClaimOnboardIntent() {
    try {
      return new URLSearchParams(window.location.search).get('onboard') === 'claim';
    } catch (e) {
      return false;
    }
  }

  function hasClaimOnboardMismatch() {
    if (!isClaimOnboardIntent() || state.adminView) return false;
    return !(state.pendingClaimGroups || []).length && !state.groups.length;
  }

  function claimOnboardMismatchNotice() {
    const email = esc(state.user?.email || 'your account email');
    return {
      id: 'claim-email-mismatch',
      type: 'warning',
      title: 'No organiser page matched this email',
      text:
        'We could not link <strong>' +
        email +
        '</strong> to an existing group listing. If your contact email has changed, find your group in the directory and use <strong>Request access</strong> on its profile page — do not create a duplicate organiser page.',
      actions:
        '<a class="org-btn org-btn-gold org-btn-sm" href="/events/?mode=organisers">Find your group</a>' +
        ' <a class="org-btn org-btn-outline org-btn-sm" href="/guides/claim-your-organiser-page">Claim guide</a>',
    };
  }

  function applyClaimMismatchGettingStarted(panel) {
    if (!panel) return;
    const mismatch = hasClaimOnboardMismatch();
    panel.classList.toggle('is-claim-mismatch', mismatch);

    const groupStep = panel.querySelector('[data-getting-step="group"]');
    if (!groupStep) return;

    const titleEl = groupStep.querySelector('strong');
    const descEl = groupStep.querySelector('span');
    const createBtn = groupStep.querySelector('[data-org-getting-action="group"]');
    let findLink = groupStep.querySelector('[data-org-getting-find-group]');

    if (mismatch) {
      if (titleEl) titleEl.textContent = 'Find your existing listing';
      if (descEl) {
        descEl.innerHTML =
          'Your email did not match a listing on file. After you sign in, open your group in <a href="/events/?mode=organisers" class="org-getting-started-link">Browse organisers</a> and tap <strong>Request access</strong> — we will verify you and send a claim link. Only create a new page if your group is not listed yet. (Public browsing opens 1 September.)';
      }
      if (createBtn) createBtn.hidden = true;
      if (!findLink) {
        findLink = document.createElement('a');
        findLink.className = 'org-btn org-btn-gold org-btn-sm';
        findLink.setAttribute('data-org-getting-find-group', '1');
        findLink.href = '/events/?mode=organisers';
        findLink.textContent = 'Find your group';
        groupStep.appendChild(findLink);
      } else {
        findLink.hidden = false;
      }
      return;
    }

    panel.classList.remove('is-claim-mismatch');
    if (titleEl) titleEl.textContent = 'Create your organiser page';
    if (descEl) {
      descEl.innerHTML =
        'Your public page on the hub. <a href="/events/#organisers" class="org-getting-started-link">Search existing groups</a> first (available once you are signed in — public browsing opens 1 September). If yours is already listed, open it and request access instead of creating a duplicate.';
    }
    if (createBtn) createBtn.hidden = false;
    if (findLink) findLink.hidden = true;
  }

  const ORGANISER_SCOPE_COOKIE = 'hub_organiser_scope';
  const signin = document.getElementById('org-signin');
  const shell = document.getElementById('org-shell');
  const alertEl = document.getElementById('org-dashboard-alert');

  function setOrganiserScopeCookie(mode) {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    const maxAge = 60 * 60 * 24 * 90;
    if (mode === 'all') {
      document.cookie =
        ORGANISER_SCOPE_COOKIE + '=all; path=/; max-age=' + maxAge + '; SameSite=Lax' + secure;
    } else if (mode === 'my') {
      document.cookie =
        ORGANISER_SCOPE_COOKIE + '=my; path=/; max-age=' + maxAge + '; SameSite=Lax' + secure;
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

  /** Matches deriveListingStatus date anchor in supabase-organiser-events.js */
  function eventOccurrenceHasEnded(ev) {
    const startRaw = eventOccurrenceRaw(ev);
    const endRaw = eventEndRaw(ev);
    const startMs = startRaw ? new Date(startRaw).getTime() : NaN;
    const endMs = endRaw ? new Date(endRaw).getTime() : NaN;
    const startOk = !Number.isNaN(startMs);
    const endOk = !Number.isNaN(endMs);
    let anchorMs = null;
    if (endOk && startOk && endMs - startMs >= 0 && endMs - startMs <= 36 * 60 * 60 * 1000) {
      anchorMs = endMs;
    } else if (startOk) {
      anchorMs = startMs;
    } else if (endOk) {
      anchorMs = endMs;
    }
    return anchorMs != null && anchorMs <= Date.now();
  }

  function summaryToEventRow(summary) {
    if (!summary || !summary.id) return null;
    const orgId = summary.organiserId || summary.organiserGroupId || '';
    const statusKey = String(summary.statusKey || 'draft').toLowerCase();
    const promotable =
      statusKey === 'live' ||
      statusKey === 'upcoming' ||
      statusKey === 'archived' ||
      statusKey === 'published';
    return {
      id: summary.id,
      title: summary.title || 'Untitled event',
      date: summary.date || null,
      endDate: summary.endDate || null,
      organiserGroupId: orgId,
      organiserId: orgId,
      status: promotable ? 'published' : statusKey || 'draft',
      statusKey: summary.statusKey || 'draft',
      statusLabel: summary.statusLabel || 'Draft',
      attendanceMode: summary.attendanceMode || 'tickets',
      seriesGroupId: summary.seriesGroupId || null,
      ticketsSoldLabel: '…',
      revenueDisplay: '…',
      revenueNum: 0,
      _fromSummary: true,
    };
  }

  function eventsSourceList() {
    if (state.eventsLoaded && state.events.length) return state.events;
    if (state.eventSummaries && state.eventSummaries.length) {
      return state.eventSummaries.map(summaryToEventRow).filter(Boolean);
    }
    return state.events || [];
  }

  function eventsNeedFullEnrichment() {
    return eventsSubRoute === 'events-revenue';
  }

  function eventsBootstrapQuery(extra, wantFull) {
    const full = wantFull != null ? wantFull : eventsNeedFullEnrichment();
    let qs =
      '/api/organiser/bootstrap?eventsOnly=1&eventsLimit=' + EVENTS_FETCH_SIZE + '&eventsOffset=0';
    if (!full) qs += '&eventsLite=1';
    if (extra) qs += extra;
    return qs;
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
    if (state.opportunitiesLoaded) renderOpportunityRoiInsights();
    updateBusinessTabCounts();
    renderOpportunityInsightsEmpty();
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

  function partnerBadgeEmbedHtml(profileUrl, groupName) {
    const origin = location.origin || 'https://www.thenetworkerhub.com';
    const badgeSrc = origin + '/assets/partner-badge.svg?v=20260806logo';
    const alt = (groupName || 'Our group') + ' on The Networker Hub';
    return (
      '<a href="' +
      profileUrl +
      '" target="_blank" rel="noopener noreferrer" title="' +
      alt.replace(/"/g, '&quot;') +
      '">' +
      '<img src="' +
      badgeSrc +
      '" alt="' +
      alt.replace(/"/g, '&quot;') +
      '" width="220" height="88" style="border:0;display:inline-block;" />' +
      '</a>'
    );
  }

  function buildPartnerBadgeCardHtml(g) {
    const profileUrl = groupPublicProfileAbsUrl(g.id, g.slug);
    const embed = partnerBadgeEmbedHtml(profileUrl, g.name);
    const origin = location.origin || 'https://www.thenetworkerhub.com';
    return (
      '<article class="org-partner-badge-card">' +
      '<div class="org-partner-badge-card-head">' +
      '<div><h3 class="org-partner-badge-card-name">' +
      esc(g.name || 'Your group') +
      '</h3>' +
      '<p class="org-partner-badge-meta">Hub partner badge · links to your public profile</p></div>' +
      '<div class="hub-partner-badge-preview">' +
      '<img src="' +
      esc(origin + '/assets/partner-badge.svg?v=20260806logo') +
      '" alt="" width="220" height="88" /></div></div>' +
      '<label for="partner-badge-code-' +
      esc(g.id) +
      '" class="org-partner-badge-meta">Embed code</label>' +
      '<textarea readonly class="org-partner-badge-code" id="partner-badge-code-' +
      esc(g.id) +
      '" rows="4">' +
      esc(embed) +
      '</textarea>' +
      '<div class="org-partner-badge-actions">' +
      '<button type="button" class="org-btn org-btn-gold org-btn-sm" data-copy-partner-embed="' +
      esc(embed) +
      '">Copy embed code</button>' +
      '<button type="button" class="org-btn org-btn-outline org-btn-sm" data-copy-link="' +
      esc(profileUrl) +
      '">Copy profile link</button>' +
      '<a class="org-btn org-btn-outline org-btn-sm" href="' +
      esc(groupPublicProfileUrl(g.id, g.slug)) +
      '" target="_blank" rel="noopener noreferrer">View public profile</a>' +
      '</div></article>'
    );
  }

  function renderOrganiserPartnerBadge() {
    const root = document.getElementById('org-partner-badge-cards');
    if (!root) return;
    const groups = (state.groups || []).filter(function (g) {
      return g && g.id;
    });
    if (!groups.length) {
      root.innerHTML =
        '<p class="org-section-sub">Publish a group profile first — then your website badge will appear here.</p>';
      return;
    }
    root.innerHTML = groups.map(buildPartnerBadgeCardHtml).join('');
    root.querySelectorAll('[data-copy-partner-embed]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        copyOrganiserText(btn.getAttribute('data-copy-partner-embed') || '', btn);
      });
    });
    bindRankingShareActions(root);
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
    const value = String(text || '');
    const done = function () {
      if (!btn) return;
      const prev = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(function () {
        btn.textContent = prev;
      }, 2000);
    };
    const afterCopy = function () {
      done();
      if (window.HubCatalogueOpen !== true && publicListingLinkNeedsLaunchNote(value)) {
        showOrganiserAlert(
          'Link copied. Public event and opportunity pages open for everyone on 1 September — until then, cold traffic may see the waitlist page.',
          false
        );
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(afterCopy).catch(function () {
        window.prompt('Copy this text:', value);
        afterCopy();
      });
    } else {
      window.prompt('Copy this text:', value);
      afterCopy();
    }
  }

  function publicListingLinkNeedsLaunchNote(url) {
    if (!(Date.now() < Date.parse('2026-09-01T00:00:00+01:00'))) return false;
    try {
      const path = new URL(url, location.origin).pathname.replace(/\/$/, '') || '/';
      if (path.indexOf('/organisers/') === 0) return false;
      if (path.indexOf('/events/organiser') === 0) return false;
      if (path.indexOf('/events/') === 0) return true;
      if (path.indexOf('/opportunities/') === 0) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function rankingBadgeImageUrl(tier, periodLabel, extras) {
    const origin = location.origin || 'https://www.thenetworkerhub.com';
    const opts = extras && typeof extras === 'object' ? extras : {};
    const params = new URLSearchParams();
    const t = String(tier || 'top50').toLowerCase();
    params.set('tier', t === 'top10' || t === 'top25' || t === 'top50' ? t : 'top50');
    if (periodLabel) params.set('period', String(periodLabel).trim());
    const name = String(opts.name || opts.groupName || '').trim();
    if (name) params.set('name', name.slice(0, 80));
    if (opts.organiserId) params.set('organiserId', String(opts.organiserId).trim());
    if (opts.demo) params.set('demo', '1');
    params.set('v', '7');
    return origin.replace(/\/$/, '') + '/api/ranking-badge?' + params.toString();
  }

  function rankingBadgeShareUrl(groupId, slug) {
    const origin = location.origin || 'https://www.thenetworkerhub.com';
    const params = new URLSearchParams();
    if (groupId) params.set('id', String(groupId));
    if (slug) params.set('slug', String(slug));
    return origin.replace(/\/$/, '') + '/rankings/badge?' + params.toString();
  }

  function rankingBadgeEmbedHtml(g, row) {
    const origin = (location.origin || 'https://www.thenetworkerhub.com').replace(/\/$/, '');
    const profileUrl = groupPublicProfileAbsUrl(g.id, g.slug);
    const rankingsUrl = origin + '/rankings';
    const tier = String(row.tier || 'top50').toLowerCase();
    const periodLabel = row.periodLabel || '';
    const alt =
      (g.name || 'Our group') +
      ' — ' +
      (row.cardLabel || rankingBadgeText(row) || 'Top ranking') +
      ' on The Networker Hub';
    const imgSrc = rankingBadgeImageUrl(tier, periodLabel, {
      name: g.name,
      organiserId: g.id,
    });
    return (
      '<a href="' +
      profileUrl +
      '" target="_blank" rel="noopener noreferrer" title="' +
      alt.replace(/"/g, '&quot;') +
      '">' +
      '<img src="' +
      imgSrc +
      '" alt="' +
      alt.replace(/"/g, '&quot;') +
      '" width="420" height="152" style="border:0;display:inline-block;max-width:100%;height:auto;" />' +
      '</a><br />' +
      '<a href="' +
      rankingsUrl +
      '" target="_blank" rel="noopener noreferrer" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#64748b;text-decoration:underline;">' +
      'See the monthly leaderboard on The Networker Hub</a>'
    );
  }

  function buildRankingShareCardHtml(g, row) {
    const shareText = rankingShareText(g.name, { ...row, id: g.id, slug: g.slug || row.slug });
    const profileUrl = groupPublicProfileAbsUrl(g.id, g.slug);
    const embed = rankingBadgeEmbedHtml(g, row);
    const badgeShareUrl = rankingBadgeShareUrl(g.id, g.slug);
    const imgPreview = rankingBadgeImageUrl(row.tier, row.periodLabel, {
      name: g.name,
      organiserId: g.id,
    });
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
      '<div class="org-ranking-embed">' +
      '<p class="org-ranking-share-preview-label">Ranking award badge</p>' +
      '<div class="org-ranking-embed-preview"><img src="' +
      esc(imgPreview) +
      '" alt="" width="420" height="152" /></div>' +
      '<label class="org-partner-badge-meta" for="ranking-embed-' +
      esc(g.id) +
      '">Embed code — links to your profile + the leaderboard</label>' +
      '<textarea readonly class="org-partner-badge-code" id="ranking-embed-' +
      esc(g.id) +
      '" rows="4">' +
      esc(embed) +
      '</textarea>' +
      '</div>' +
      '<div class="org-ranking-share-preview">' +
      '<p class="org-ranking-share-preview-label">Your social post will look like this</p>' +
      '<div class="org-ranking-share-preview-card" role="group" aria-label="Social post preview">' +
      '<p class="org-ranking-share-preview-text">' +
      esc(shareText) +
      '</p></div></div>' +
      '<div class="org-ranking-share-actions">' +
      '<button type="button" class="org-btn org-btn-gold org-btn-sm" data-copy-ranking-embed="' +
      esc(embed) +
      '">Copy embed code</button>' +
      '<button type="button" class="org-btn org-btn-outline org-btn-sm" data-download-ranking-png="' +
      esc(imgPreview) +
      '" data-download-name="' +
      esc((g.name || 'group').replace(/[^\w\-]+/g, '-').slice(0, 40) + '-ranking-badge.png') +
      '">Download PNG</button>' +
      '<button type="button" class="org-btn org-btn-outline org-btn-sm" data-copy-share="' +
      esc(shareText) +
      '">Copy post text</button>' +
      '<button type="button" class="org-btn org-btn-outline org-btn-sm" data-copy-link="' +
      esc(profileUrl) +
      '">Copy profile link</button>' +
      '<a class="org-btn org-btn-outline org-btn-sm" href="' +
      esc(badgeShareUrl) +
      '" target="_blank" rel="noopener noreferrer">Open share page</a>' +
      '<a class="org-btn org-btn-outline org-btn-sm" href="#social" data-org-route="social">Make a LinkedIn picture</a>' +
      '</div>' +
      (row.badgeImpressions != null
        ? '<p class="org-ranking-share-meta">Award badge loads this month: <strong>' +
          esc(String(row.badgeImpressions)) +
          '</strong></p>'
        : '') +
      '</article>'
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
    root.querySelectorAll('[data-copy-ranking-embed]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        copyOrganiserText(btn.getAttribute('data-copy-ranking-embed') || '', btn);
      });
    });
    root.querySelectorAll('[data-download-ranking-png]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var url = btn.getAttribute('data-download-ranking-png') || '';
        var name = btn.getAttribute('data-download-name') || 'ranking-badge.png';
        var prev = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Preparing…';
        var done = function () {
          btn.disabled = false;
          btn.textContent = prev;
        };
        ensureRankingsAssets()
          .then(function () {
            if (window.HubRankingBadgePng && HubRankingBadgePng.download) {
              return HubRankingBadgePng.download(url, name).then(function () {
                btn.textContent = 'Downloaded';
                setTimeout(done, 1400);
              });
            }
            window.open(url, '_blank', 'noopener');
            done();
          })
          .catch(function () {
            btn.textContent = 'Failed';
            setTimeout(done, 1600);
          });
      });
    });
  }

  const RANKING_PANEL_COLLAPSE_KEYS = {
    overview: 'hub_org_ranking_panel_overview_collapsed_v1',
    events: 'hub_org_ranking_panel_events_collapsed_v1',
    featuredUpgrade: 'hub_org_featured_upgrade_collapsed_v1',
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
    const badgeLine = document.getElementById('org-social-ranking-badge');
    if (badgeLine) {
      badgeLine.textContent = summaryText ? 'Your badge this month: ' + summaryText : '';
      badgeLine.hidden = !summaryText;
    }
  }

  function updateSocialRankingNav(hasRanking) {
    const navRanking = document.getElementById('org-social-tab-ranking');
    if (!navRanking) return;
    // Always show Top groups under Promote; badge tools appear when ranked.
    navRanking.hidden = false;
    navRanking.classList.toggle('has-badge', Boolean(hasRanking));
  }

  function renderOrganiserRankingShare() {
    ensureRankingsAssets().catch(function () {
      /* non-fatal — badges still render with CSS classes once stylesheet arrives */
    });
    const shareRoot = document.getElementById('org-ranking-share-events');
    const cardsEl = document.getElementById('org-ranking-share-cards');
    const examplesEl = document.getElementById('org-ranking-tier-examples');
    const groupsMount = document.getElementById('org-ranking-share-groups-mount');

    const periodLabel =
      (bestGroupRanking() && bestGroupRanking().periodLabel) ||
      new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    if (examplesEl) {
      examplesEl.innerHTML = [
        { tier: 'top10', sample: 'Top 10' },
        { tier: 'top25', sample: 'Top 25' },
        { tier: 'top50', sample: 'Top 50' },
      ]
        .map(function (item) {
          return (
            '<div class="org-ranking-tier-example">' +
            '<span class="org-ranking-tier-example-label">' +
            esc(item.sample) +
            '</span>' +
            '<img class="org-ranking-tier-example-img" src="' +
            esc(rankingBadgeImageUrl(item.tier, periodLabel, { name: 'Your networking group', demo: true })) +
            '" alt="' +
            esc(item.sample + ' award badge · ' + periodLabel) +
            '" width="420" height="152" loading="lazy" />' +
            '</div>'
          );
        })
        .join('');
    }

    const ranked = (state.groups || [])
      .filter(function (g) {
        const key = String((g && (g.statusKey || g.status || g.statusRaw)) || '')
          .trim()
          .toLowerCase();
        if (/unpublish/.test(key)) return false;
        if (key === 'draft' || /pending|hidden|inactive/.test(key)) return false;
        return true;
      })
      .map(function (g) {
        const row = state.groupRankings?.[g.id];
        if (!row?.label) return null;
        return { group: g, row: { ...row, id: g.id } };
      })
      .filter(Boolean);

    function paintRankingCards(withImpressions) {
      const cardsHtml = ranked.length
        ? ranked
            .map(function (item) {
              const row = { ...item.row };
              if (withImpressions && withImpressions[item.group.id] != null) {
                row.badgeImpressions = withImpressions[item.group.id];
              }
              return buildRankingShareCardHtml(item.group, row);
            })
            .join('')
        : '';

      const summaryText = ranked.length ? rankingBadgeText(ranked[0].row) : '';
      updateRankingPanelSummaries(summaryText);
      updateSocialRankingNav(ranked.length > 0);

      if (shareRoot) {
        if (cardsEl) cardsEl.innerHTML = cardsHtml;
        bindRankingShareActions(shareRoot);
      }

      if (groupsMount) {
        if (ranked.length) {
          groupsMount.innerHTML =
            '<section class="org-ranking-share org-ranking-share--board">' +
            '<h2 class="org-section-title">Your award badge</h2>' +
            '<p class="org-section-sub">Embed this on your website — it links to your Hub profile and this month&rsquo;s Top groups list.</p>' +
            '<div class="org-ranking-share-cards">' +
            cardsHtml +
            '</div></section>';
          bindRankingShareActions(groupsMount);
        } else {
          groupsMount.innerHTML =
            '<section class="org-ranking-share org-ranking-share--board org-ranking-share--empty">' +
            '<h2 class="org-section-title">Your award badge</h2>' +
            '<p class="org-section-sub">When your group lands in the Top 10, 25 or 50, your website award badge and embed code appear here.</p>' +
            '<div class="org-ranking-tier-examples org-ranking-tier-examples--board">' +
            [
              { tier: 'top10', sample: 'Top 10' },
              { tier: 'top25', sample: 'Top 25' },
              { tier: 'top50', sample: 'Top 50' },
            ]
              .map(function (item) {
                return (
                  '<div class="org-ranking-tier-example">' +
                  '<img class="org-ranking-tier-example-img" src="' +
                  esc(rankingBadgeImageUrl(item.tier, periodLabel, { name: 'Your networking group', demo: true })) +
                  '" alt="' +
                  esc(item.sample + ' award badge example') +
                  '" width="420" height="152" loading="lazy" />' +
                  '</div>'
                );
              })
              .join('') +
            '</div></section>';
        }
      }
    }

    paintRankingCards(null);
    renderRankingShoutoutPrefs();

    if (ranked.length) {
      const ids = ranked.map(function (item) {
        return item.group.id;
      });
      fetch('/api/rankings?impressions=' + encodeURIComponent(ids.join(',')), {
        credentials: 'same-origin',
        cache: 'no-store',
      })
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          if (data && data.badgeImpressions) paintRankingCards(data.badgeImpressions);
        })
        .catch(function () {
          /* ignore */
        });
    }
  }

  function renderRankingShoutoutPrefs() {
    const list = document.getElementById('org-ranking-prefs-list');
    if (!list) return;
    const groups = state.groups || [];
    if (!groups.length) {
      list.innerHTML = '<p class="org-section-sub">Create a group to choose public naming preferences.</p>';
      return;
    }
    list.innerHTML = groups
      .map(function (g) {
        const optedIn = g.rankingShoutoutOptIn !== false;
        return (
          '<div class="org-ranking-pref-row" data-group-id="' +
          esc(g.id) +
          '">' +
          '<span>' +
          esc(g.name || 'Group') +
          '</span>' +
          '<label>' +
          '<input type="checkbox" data-ranking-shoutout="' +
          esc(g.id) +
          '"' +
          (optedIn ? ' checked' : '') +
          ' />' +
          ' Show on Top groups / LinkedIn shout-outs' +
          '</label>' +
          '<span class="org-ranking-pref-status" data-ranking-shoutout-status="' +
          esc(g.id) +
          '"></span>' +
          '</div>'
        );
      })
      .join('');

    list.querySelectorAll('[data-ranking-shoutout]').forEach(function (input) {
      if (input.getAttribute('data-bound') === '1') return;
      input.setAttribute('data-bound', '1');
      input.addEventListener('change', async function () {
        const groupId = input.getAttribute('data-ranking-shoutout');
        const status = list.querySelector('[data-ranking-shoutout-status="' + groupId + '"]');
        if (status) status.textContent = 'Saving…';
        input.disabled = true;
        const { ok, data } = await api('/api/organiser/groups', {
          method: 'PATCH',
          body: JSON.stringify({
            id: groupId,
            rankingShoutoutOptIn: Boolean(input.checked),
          }),
        });
        input.disabled = false;
        if (!ok) {
          input.checked = !input.checked;
          if (status) status.textContent = data.message || data.error || 'Could not save';
          return;
        }
        const idx = state.groups.findIndex(function (g) {
          return g.id === groupId;
        });
        if (idx >= 0) {
          state.groups[idx] = {
            ...state.groups[idx],
            ...(data.group || {}),
            rankingShoutoutOptIn: Boolean(input.checked),
          };
        }
        if (status) {
          status.textContent = 'Saved';
          setTimeout(function () {
            status.textContent = '';
          }, 1600);
        }
      });
    });
  }

  const FEATURED_LISTING_PRICE = '£55.00';
  const FEATURED_UPGRADE_QUEUE_KEY = 'hub_featured_upgrade_queue';
  let featuredSpotlightSlots = null;
  let featuredQuoteCache = Object.create(null);

  function eventIsLiveForFeatured(ev) {
    const status = String(ev?.status || ev?.listingStatus || '').toLowerCase();
    const approved = String(ev?.approvalStatus || ev?.statusRaw || '').toLowerCase() === 'approved';
    return status === 'published' && approved;
  }

  function eventIsUpcomingForFeatured(ev) {
    if (!ev?.date) return true;
    if (window.HubEventTimezone && typeof window.HubEventTimezone.isEventStarted === 'function') {
      return !window.HubEventTimezone.isEventStarted(ev);
    }
    const startTs = new Date(ev.date).getTime();
    return !Number.isNaN(startTs) && startTs > Date.now();
  }

  function eventIsEligibleForFeaturedUpgrade(ev) {
    return eventIsLiveForFeatured(ev) && eventIsUpcomingForFeatured(ev);
  }

  function featuredUpgradeDurationNote(ev) {
    if (!ev?.date) return '';
    const cacheKey = String(ev.id || '') + ':1month';
    const cached = featuredQuoteCache[cacheKey];
    if (cached && cached.pricingNote) return cached.pricingNote;
    if (!window.HubOrganiserFeaturedDuration) return '';
    return window.HubOrganiserFeaturedDuration.checkoutDurationNote({
      planId: '1month',
      eventStartIso: ev.date,
      currentUntil: ev.featuredUntil || null,
    });
  }

  async function fetchFeaturedQuote(eventId) {
    const cacheKey = String(eventId || '') + ':1month';
    if (featuredQuoteCache[cacheKey]) return featuredQuoteCache[cacheKey];
    const res = await fetch(
      '/api/organiser/event-featured-quote?eventId=' +
        encodeURIComponent(eventId) +
        '&planId=1month',
      { credentials: 'include', cache: 'no-store' }
    );
    const data = await res.json().catch(function () {
      return {};
    });
    if (res.ok && data.ok && data.quote) {
      featuredQuoteCache[cacheKey] = data.quote;
      return data.quote;
    }
    return null;
  }

  function eventFeaturedMeta(ev) {
    if (!ev?.featured) return { label: '', tone: 'muted' };
    const raw = ev.featuredUntil;
    if (!raw) return { label: 'Featured', tone: 'ok' };
    const until = new Date(raw);
    if (Number.isNaN(until.getTime())) return { label: 'Featured', tone: 'ok' };
    const label = formatDateShort(raw);
    if (until.getTime() < Date.now()) return { label: 'Featured ended ' + label, tone: 'muted' };
    const daysLeft = Math.ceil((until.getTime() - Date.now()) / 86400000);
    if (daysLeft <= 14) return { label: 'Featured until ' + label + ' (' + daysLeft + 'd)', tone: 'warn' };
    return { label: 'Featured until ' + label, tone: 'ok' };
  }

  function liveEventsForFeaturedUpgrade() {
    return (state.events || [])
      .filter(eventIsEligibleForFeaturedUpgrade)
      .slice()
      .sort(function (a, b) {
        const aTs = a.date ? new Date(a.date).getTime() : 0;
        const bTs = b.date ? new Date(b.date).getTime() : 0;
        if (aTs !== bTs) return bTs - aTs;
        return String(a.title || '').localeCompare(String(b.title || ''));
      });
  }

  function featuredUpgradeEventDisabled(ev) {
    if (!featuredSpotlightSlots || !featuredSpotlightSlots.full) return false;
    return !ev.featured;
  }

  function selectedFeaturedUpgradePlanId() {
    return '1month';
  }

  function updateFeaturedUpgradeHeaderSummary(eventCount) {
    const el = document.getElementById('org-featured-upgrade-status');
    if (!el) return;
    const slots = featuredSpotlightSlots;
    if (!state.eventsLoaded) {
      el.textContent = '';
      el.hidden = true;
      return;
    }
    el.hidden = false;
    if (!eventCount) {
      el.textContent =
        'Publish an upcoming live event first, then return here to add Premium Spotlight.';
      return;
    }
    let text =
      eventCount +
      (eventCount === 1 ? ' upcoming live event ready to upgrade' : ' upcoming live events ready to upgrade');
    if (slots && slots.full) {
      text += ' · Spotlight carousel is full — try again later';
    } else if (slots && slots.available > 0 && slots.available <= 3) {
      text += ' · Only ' + slots.available + ' spotlight place' + (slots.available === 1 ? '' : 's') + ' left';
    }
    el.textContent = text;
  }

  function filterFeaturedUpgradeEvents(root, query) {
    const list = root?.querySelector('#org-featured-upgrade-events');
    if (!list) return;
    const needle = String(query || '')
      .trim()
      .toLowerCase();
    let visible = 0;
    list.querySelectorAll('.org-featured-upgrade-event').forEach(function (label) {
      const haystack = (label.getAttribute('data-search') || label.textContent || '').toLowerCase();
      const show = !needle || haystack.indexOf(needle) !== -1;
      label.hidden = !show;
      if (show) visible += 1;
    });
    const empty = root.querySelector('#org-featured-upgrade-events-empty');
    if (empty) empty.hidden = visible > 0 || !needle;
  }

  function selectedFeaturedUpgradeEventIds(root) {
    if (!root) return [];
    return Array.from(root.querySelectorAll('.org-featured-upgrade-event-input:checked'))
      .map(function (input) {
        return input.value;
      })
      .filter(Boolean);
  }

  function updateFeaturedUpgradeSummary(root) {
    const summary = root?.querySelector('#org-featured-upgrade-summary');
    const btn = root?.querySelector('#org-featured-upgrade-submit');
    const ids = selectedFeaturedUpgradeEventIds(root);
    const planId = '1month';
    const newFeaturedCount = ids.filter(function (id) {
      const ev = (state.events || []).find(function (row) {
        return row.id === id;
      });
      return ev && !ev.featured;
    }).length;
    const slots = featuredSpotlightSlots;
    let blocked = false;
    if (slots && slots.full && newFeaturedCount > 0) blocked = true;
    if (slots && !slots.full && newFeaturedCount > slots.available) blocked = true;

    root?.querySelectorAll('.org-featured-upgrade-event').forEach(function (label) {
      const input = label.querySelector('.org-featured-upgrade-event-input');
      const noteEl = label.querySelector('.org-featured-upgrade-event-duration');
      if (!input || !noteEl) return;
      const ev = (state.events || []).find(function (row) {
        return row.id === input.value;
      });
      if (!ev) return;
      noteEl.hidden = true;
      noteEl.textContent = '';
      fetchFeaturedQuote(ev.id)
        .then(function (quote) {
          if (!quote || !quote.pricingNote) return;
          noteEl.textContent = quote.pricingNote;
          noteEl.hidden = false;
        })
        .catch(function () {
          /* non-fatal */
        });
    });

    if (summary) {
      if (!ids.length) {
        summary.textContent =
          'Tick one or more events above to continue. One-time from ' +
          FEATURED_LISTING_PRICE +
          ' per event (adjusted if your event is sooner).';
      } else if (ids.length === 1) {
        summary.textContent = '1 event selected — loading price…';
        fetchFeaturedQuote(ids[0])
          .then(function (quote) {
            if (!summary) return;
            if (quote) {
              summary.textContent =
                '1 event selected — ' + quote.displayPrice + ' one-time. ' + quote.pricingNote;
            } else {
              summary.textContent = '1 event selected — payment opens on the next screen.';
            }
          })
          .catch(function () {
            if (summary) summary.textContent = '1 event selected — payment opens on the next screen.';
          });
      } else {
        summary.textContent =
          ids.length +
          ' events selected — you pay separately for each one. One-time price covers up to 30 days, or until the event if sooner.';
      }
    }
    if (btn) {
      btn.disabled = !ids.length || blocked;
      btn.textContent =
        ids.length > 1
          ? 'Continue to payment (' + ids.length + ' events)'
          : ids.length === 1
            ? 'Continue to payment'
            : 'Continue to payment';
    }
  }

  async function loadFeaturedSpotlightSlots() {
    try {
      const res = await fetch('/api/hub-listings?meta=featured-slots', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.featuredSlots) featuredSpotlightSlots = data.featuredSlots;
    } catch (e) {
      /* non-fatal */
    }
  }

  function featuredUpgradeSlotStatusHtml() {
    const slots = featuredSpotlightSlots;
    if (!slots) return '';
    if (slots.full) {
      return (
        '<p class="org-featured-upgrade-slot-status" role="status">' +
        'All ' +
        esc(String(slots.max || 12)) +
        ' featured spotlight places are taken right now. You can still extend events you already feature — try again later for new placements.</p>'
      );
    }
    if (slots.available > 0 && slots.available <= 3) {
      return (
        '<p class="org-featured-upgrade-slot-status" role="status">' +
        (slots.available === 1
          ? 'Only 1 featured spotlight place left right now.'
          : 'Only ' + esc(String(slots.available)) + ' featured spotlight places left right now.') +
        '</p>'
      );
    }
    return '';
  }

  function bindFeaturedUpgradeUi(root) {
    if (!root || root.dataset.featuredBound === '1') return;
    root.dataset.featuredBound = '1';

    root.addEventListener('change', function (e) {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.matches('.org-featured-upgrade-event-input')) {
        updateFeaturedUpgradeSummary(root);
      }
    });

    root.addEventListener('input', function (e) {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.matches('#org-featured-upgrade-events-search')) {
        filterFeaturedUpgradeEvents(root, target.value);
      }
    });

    root.addEventListener('click', function (e) {
      if (e.target.closest('#org-featured-upgrade-submit')) {
        e.preventDefault();
        startFeaturedUpgradeCheckout(root);
        return;
      }

      const selectAll = e.target.closest('#org-featured-upgrade-select-all');
      if (selectAll) {
        e.preventDefault();
        root.querySelectorAll('.org-featured-upgrade-event:not([hidden]) .org-featured-upgrade-event-input:not(:disabled)').forEach(function (input) {
          input.checked = true;
        });
        updateFeaturedUpgradeSummary(root);
        return;
      }

      const label = e.target.closest('.org-featured-upgrade-event');
      if (label && label.classList.contains('is-disabled')) {
        e.preventDefault();
      }
    });
  }

  function writeFeaturedUpgradeQueue(planId, eventIds) {
    if (!eventIds || eventIds.length < 2) {
      try {
        sessionStorage.removeItem(FEATURED_UPGRADE_QUEUE_KEY);
      } catch (e) {
        /* ignore */
      }
      return;
    }
    try {
      sessionStorage.setItem(
        FEATURED_UPGRADE_QUEUE_KEY,
        JSON.stringify({
          planId: planId || '1month',
          remaining: eventIds.slice(1),
          returnTo: 'social',
        })
      );
    } catch (e) {
      /* ignore private mode */
    }
  }

  async function startFeaturedUpgradeCheckout(root) {
    const errorEl = root?.querySelector('#org-featured-upgrade-error');
    const submit = root?.querySelector('#org-featured-upgrade-submit');
    const planId = selectedFeaturedUpgradePlanId();
    const eventIds = selectedFeaturedUpgradeEventIds(root);
    if (!eventIds.length) return;

    const newFeaturedCount = eventIds.filter(function (id) {
      const ev = (state.events || []).find(function (row) {
        return row.id === id;
      });
      return ev && !ev.featured;
    }).length;
    const slots = featuredSpotlightSlots;
    if (slots && slots.full && newFeaturedCount > 0) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent =
          'All featured spotlight places are taken. Extend an event you already feature, or try again when a slot opens.';
      }
      return;
    }
    if (slots && newFeaturedCount > slots.available) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent =
          'Only ' +
          slots.available +
          ' spotlight place' +
          (slots.available === 1 ? ' is' : 's are') +
          ' available — deselect some events or try again later.';
      }
      return;
    }

    if (errorEl) errorEl.hidden = true;
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Opening secure checkout…';
    }

    writeFeaturedUpgradeQueue(planId, eventIds);

    try {
      const res = await fetch('/api/organiser/event-featured-checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: eventIds[0],
          planId: planId,
          returnTo: 'social',
        }),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (res.ok && data.ok && data.url) {
        location.href = data.url;
        return;
      }
      try {
        sessionStorage.removeItem(FEATURED_UPGRADE_QUEUE_KEY);
      } catch (e) {
        /* ignore */
      }
      const msg =
        data.error === 'stripe_not_configured'
          ? 'Stripe is not configured for checkout yet. Your events stay live.'
          : data.error === 'event_already_started'
            ? data.message ||
              'That event has already started — featured placement only runs while it appears on the events browse page.'
          : data.error === 'featured_slots_full'
            ? data.message ||
              'All featured spotlight places are currently taken. Try again when a slot opens.'
            : data.message || data.error || 'Could not start checkout.';
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = msg;
      }
    } catch (e) {
      try {
        sessionStorage.removeItem(FEATURED_UPGRADE_QUEUE_KEY);
      } catch (err) {
        /* ignore */
      }
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = 'Could not reach checkout. Try again in a moment.';
      }
    }

    if (submit) {
      submit.disabled = false;
      updateFeaturedUpgradeSummary(root);
    }
  }

  function renderFeaturedUpgradePanel() {
    const root = document.getElementById('org-featured-upgrade-root');
    if (!root || !isSocialPageActive()) return;

    if (!state.eventsLoaded) {
      updateFeaturedUpgradeHeaderSummary(0);
      root.innerHTML = '<p class="org-featured-upgrade-loading">Loading your events…</p>';
      ensureEventsLoaded().then(function () {
        renderFeaturedUpgradePanel();
      });
      return;
    }

    const liveEvents = liveEventsForFeaturedUpgrade();

    if (!liveEvents.length) {
      updateFeaturedUpgradeHeaderSummary(0);
      root.innerHTML =
        featuredUpgradeSlotStatusHtml() +
        '<p class="org-featured-upgrade-empty">No upcoming live events yet. Publish an event with a future date first, then return here to upgrade it.</p>' +
        '<p class="org-section-sub"><a class="org-inline-link" href="#events-list" data-org-route="events-list">Go to My events</a></p>';
      return;
    }

    const showEventSearch = liveEvents.length > 5;
    const eventsHtml = liveEvents
      .map(function (ev) {
        const disabled = featuredUpgradeEventDisabled(ev);
        const meta = eventFeaturedMeta(ev);
        const dateLabel = ev.date ? formatDateShort(ev.date) : 'Date TBC';
        const typeLabel = ev.type ? String(ev.type) : 'Event';
        const durationNote = featuredUpgradeDurationNote(ev);
        const searchText = [ev.title, typeLabel, dateLabel, meta.label].filter(Boolean).join(' ');
        return (
          '<label class="org-featured-upgrade-event' +
          (disabled ? ' is-disabled' : '') +
          '" data-search="' +
          esc(searchText) +
          '">' +
          '<input class="org-featured-upgrade-event-input" type="checkbox" value="' +
          esc(ev.id) +
          '"' +
          (disabled ? ' disabled' : '') +
          ' />' +
          '<span class="org-featured-upgrade-event-body">' +
          '<span class="org-featured-upgrade-event-row">' +
          '<span class="org-featured-upgrade-event-title">' +
          esc(ev.title || 'Untitled event') +
          '</span>' +
          '<span class="org-featured-upgrade-event-meta">' +
          esc(typeLabel + ' · ' + dateLabel) +
          '</span>' +
          (meta.label
            ? '<span class="org-featured-upgrade-event-badge">' + esc(meta.label) + '</span>'
            : '') +
          '</span>' +
          (durationNote
            ? '<span class="org-featured-upgrade-event-meta org-featured-upgrade-event-duration">' +
              esc(durationNote) +
              '</span>'
            : '<span class="org-featured-upgrade-event-meta org-featured-upgrade-event-duration" hidden></span>') +
          (disabled ? '<span class="org-featured-upgrade-event-meta org-featured-upgrade-event-warn">Spotlight full — try again later</span>' : '') +
          '</span></label>'
        );
      })
      .join('');

    root.innerHTML =
      featuredUpgradeSlotStatusHtml() +
      '<div class="org-featured-upgrade-events-head">' +
      '<p class="org-featured-upgrade-events-title">Tick the events you want more people to see <span class="org-featured-upgrade-events-count">(' +
      liveEvents.length +
      ' live)</span></p>' +
      '<button type="button" class="org-featured-upgrade-select-all" id="org-featured-upgrade-select-all">Tick all</button>' +
      '</div>' +
      (showEventSearch
        ? '<input type="search" class="org-featured-upgrade-events-search" id="org-featured-upgrade-events-search" placeholder="Search by title, type or date…" aria-label="Search events to upgrade" />'
        : '') +
      '<div class="org-featured-upgrade-events" id="org-featured-upgrade-events">' +
      eventsHtml +
      '</div>' +
      '<p class="org-featured-upgrade-events-empty" id="org-featured-upgrade-events-empty" hidden role="status">No events match your search.</p>' +
      '<p class="org-featured-upgrade-note" id="org-featured-upgrade-error" hidden role="alert"></p>' +
      '<div class="org-featured-upgrade-actions">' +
      '<button type="button" class="org-btn org-btn-gold" id="org-featured-upgrade-submit" disabled>Continue to payment</button>' +
      '<p class="org-featured-upgrade-summary" id="org-featured-upgrade-summary">Tick one or more events above to continue.</p>' +
      '</div>' +
      '<p class="org-featured-upgrade-policy">One-time Premium Spotlight — runs until your event starts, or up to 30 days, whichever is sooner. Not a subscription.</p>';

    bindFeaturedUpgradeUi(root);
    updateFeaturedUpgradeSummary(root);
    updateFeaturedUpgradeHeaderSummary(liveEvents.length);
    maybePrefetchEvents();
  }

  function ensureFeaturedUpgradePanelReady() {
    if (featuredSpotlightSlots !== null) {
      renderFeaturedUpgradePanel();
      return Promise.resolve();
    }
    return loadFeaturedSpotlightSlots().then(function () {
      renderFeaturedUpgradePanel();
    });
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
  const deferredAssetPromises = {};
  const LINKEDIN_POST_BUILDER_SRC = '../js/organiser-linkedin-post-builder.js?v=20260730pages2';
  const MEMBER_ROSTER_SRC = '../js/organiser-member-roster.js?v=20260806expired1';
  const MEMBER_ROSTER_CSS = '../css/organiser-member-roster.css?v=20260806expired1';
  const EVENT_EDIT_CSS = '../css/organiser-event-edit.css?v=20260729brand';
  const RANKINGS_PAGE_CSS = '../css/rankings-page.css?v=20260807rank';
  const RANKING_BADGE_CSS = '../css/hub-ranking-badge.css?v=20260728lb2';
  const RANKINGS_JS = '../js/rankings.js?v=20260807rank';
  const RANKING_BADGE_PNG_JS = '../js/ranking-badge-png.js?v=20260728png';
  const EVENT_CONNECTIONS_JS = '../js/organiser-event-connections.js?v=20260807comm5';
  const GROUP_UPDATES_JS = '../js/organiser-group-updates.js?v=20260807comm5';

  function loadStylesheetOnce(href) {
    if (!href) return Promise.resolve();
    if (deferredAssetPromises[href]) return deferredAssetPromises[href];
    deferredAssetPromises[href] = new Promise(function (resolve) {
      if (document.querySelector('link[data-hub-deferred="' + href + '"]')) {
        resolve();
        return;
      }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-hub-deferred', href);
      link.onload = function () {
        resolve();
      };
      link.onerror = function () {
        resolve();
      };
      document.head.appendChild(link);
    });
    return deferredAssetPromises[href];
  }

  function loadScriptOnce(src) {
    if (!src) return Promise.resolve();
    if (deferredAssetPromises[src]) return deferredAssetPromises[src];
    deferredAssetPromises[src] = new Promise(function (resolve, reject) {
      const existing = document.querySelector('script[data-hub-deferred="' + src + '"]');
      if (existing) {
        if (existing.dataset.hubLoaded === '1') {
          resolve();
          return;
        }
        existing.addEventListener('load', function () {
          resolve();
        });
        existing.addEventListener('error', function () {
          reject(new Error('Failed to load ' + src));
        });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.setAttribute('data-hub-deferred', src);
      script.onload = function () {
        script.dataset.hubLoaded = '1';
        resolve();
      };
      script.onerror = function () {
        reject(new Error('Failed to load ' + src));
      };
      document.body.appendChild(script);
    });
    return deferredAssetPromises[src];
  }

  function ensureLinkedInPostBuilderAssets() {
    if (window.HubLinkedInPostBuilder) return Promise.resolve();
    return loadScriptOnce(LINKEDIN_POST_BUILDER_SRC);
  }

  function ensureMemberRosterAssets() {
    const cssReady = Promise.all([
      loadStylesheetOnce(MEMBER_ROSTER_CSS),
      loadStylesheetOnce(EVENT_EDIT_CSS),
    ]);
    if (window.OrganiserMemberRoster) return cssReady.then(function () {});
    return Promise.all([cssReady, loadScriptOnce(MEMBER_ROSTER_SRC)]).then(function () {});
  }

  function ensureEventEditCss() {
    return loadStylesheetOnce(EVENT_EDIT_CSS);
  }

  function ensureRankingsAssets() {
    const cssReady = Promise.all([
      loadStylesheetOnce(RANKINGS_PAGE_CSS),
      loadStylesheetOnce(RANKING_BADGE_CSS),
    ]);
    const scripts = [];
    if (!window.HubRankings) scripts.push(loadScriptOnce(RANKINGS_JS));
    if (!window.HubRankingBadgePng) scripts.push(loadScriptOnce(RANKING_BADGE_PNG_JS));
    return Promise.all([cssReady].concat(scripts)).then(function () {});
  }

  function ensureEventConnectionsAssets() {
    if (window.HubOrganiserEventConnections) return Promise.resolve();
    return loadScriptOnce(EVENT_CONNECTIONS_JS);
  }

  function ensureGroupUpdatesAssets() {
    if (window.HubOrganiserGroupUpdates) return Promise.resolve();
    return loadScriptOnce(GROUP_UPDATES_JS);
  }

  const SOCIAL_TAB_STORAGE_KEY = 'hub_org_social_tab_v1';
  let socialTabsBound = false;

  function socialHashForTab(tabId) {
    const tab = String(tabId || 'linkedin').toLowerCase();
    if (tab === 'spotlight') return 'social-spotlight';
    if (tab === 'ranking') return 'social-ranking';
    if (tab === 'partner') return 'social-partner';
    if (tab === 'brand') return 'social-brand';
    if (tab === 'reach') return 'social-reach';
    return 'social';
  }

  function isCommunicateRoute(route) {
    const r = String(route || '').toLowerCase();
    return (
      r === 'communicate' ||
      r === 'social-communicate' ||
      r === 'social-email' ||
      r === 'email' ||
      r === 'email-who-attended' ||
      r === 'attendee-email' ||
      r === 'connections-email' ||
      r === 'group-updates' ||
      r === 'monthly-updates'
    );
  }

  function isAttendeeListEmailRoute(route) {
    return isCommunicateRoute(route);
  }

  function isSocialRoute(route) {
    const r = String(route || '').toLowerCase();
    return (
      r === 'social' ||
      r === 'promote' ||
      r === 'social-linkedin' ||
      r === 'social-spotlight' ||
      r === 'event-spotlight' ||
      r === 'social-ranking' ||
      r === 'ranking-badge' ||
      r === 'review-badge' ||
      r === 'ranking-embed' ||
      r === 'social-partner' ||
      r === 'partner' ||
      r === 'website-badge' ||
      r === 'social-brand' ||
      r === 'brand' ||
      r === 'brand-kit' ||
      r === 'social-reach' ||
      r === 'reach'
    );
  }

  function socialTabFromRoute(route) {
    const r = String(route || '').toLowerCase();
    if (r === 'social-spotlight' || r === 'event-spotlight') return 'spotlight';
    if (
      r === 'social-ranking' ||
      r === 'ranking-badge' ||
      r === 'review-badge' ||
      r === 'ranking-embed' ||
      r === 'leaderboard' ||
      r === 'rankings'
    ) {
      return 'ranking';
    }
    if (r === 'social-partner' || r === 'partner' || r === 'website-badge') return 'partner';
    if (r === 'social-brand' || r === 'brand' || r === 'brand-kit') return 'brand';
    if (
      r === 'social-reach' ||
      r === 'reach' ||
      r === 'visibility' ||
      r === 'grow-visibility'
    ) {
      return 'reach';
    }
    if (r === 'social-linkedin') return 'linkedin';
    return '';
  }

  function storedSocialTab() {
    try {
      const stored = sessionStorage.getItem(SOCIAL_TAB_STORAGE_KEY);
      if (
        stored === 'spotlight' ||
        stored === 'ranking' ||
        stored === 'linkedin' ||
        stored === 'partner' ||
        stored === 'brand' ||
        stored === 'reach'
      ) {
        return stored;
      }
    } catch {
      /* ignore */
    }
    return '';
  }

  function syncSocialHash(tabId) {
    const nextHash = socialHashForTab(tabId);
    const url = new URL(window.location.href);
    if ((url.hash || '').replace(/^#/, '') === nextHash) return;
    url.hash = '#' + nextHash;
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  function setSocialTab(tabId, options) {
    options = options || {};
    const tab = String(tabId || 'linkedin').toLowerCase();
    const tabs = document.querySelectorAll('[data-social-tab]');
    const panels = document.querySelectorAll('[data-social-panel]');
    const hint = document.getElementById('org-social-tab-hint');
    const routeLoadToken =
      bootstrapReady &&
      !options.skipRouteLoading &&
      !isDashboardBootLoading() &&
      isSocialPageActive()
        ? beginOrgRouteLoading('Loading…')
        : null;
    const routeLoadTasks = [];

    tabs.forEach(function (btn) {
      const id = btn.getAttribute('data-social-tab');
      const on = id === tab && !btn.hidden;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
    });

    panels.forEach(function (panel) {
      const id = panel.getAttribute('data-social-panel');
      const on = id === tab;
      panel.classList.toggle('is-active', on);
      panel.hidden = !on;
    });

    if (hint) {
      // Tip points people toward LinkedIn — hide when they are already there or on a focused tool.
      hint.hidden =
        tab === 'linkedin' ||
        tab === 'spotlight' ||
        tab === 'ranking' ||
        tab === 'partner' ||
        tab === 'reach';
    }

    var socialPage = document.getElementById('org-page-social');
    if (socialPage) {
      // Rails stay visible together; mode classes are no longer required for layout.
      socialPage.classList.remove('org-promote--hub', 'org-promote--reach');
    }

    if (tab === 'spotlight') ensureFeaturedUpgradePanelReady();
    if (tab === 'linkedin') {
      routeLoadTasks.push(
        Promise.resolve()
          .then(function () {
            return ensureLinkedInPostBuilder({ force: true });
          })
          .then(function () {
            renderBrandKitNudge();
          })
          .catch(function () {
            return null;
          })
      );
    }
    if (tab === 'ranking') {
      renderOrganiserRankingShare();
      ensurePromoteLeaderboardReady();
    }
    if (tab === 'partner') renderOrganiserPartnerBadge();
    if (tab === 'brand') ensureBrandKitPanelReady();
    if (tab === 'reach') ensurePromoteReachReady();

    if (!options.skipStore) {
      try {
        sessionStorage.setItem(SOCIAL_TAB_STORAGE_KEY, tab);
      } catch {
        /* ignore */
      }
    }

    if (!options.skipHash) {
      syncSocialHash(tab);
    }

    settleOrgRouteLoading(routeLoadToken, routeLoadTasks);
  }

  function socialTabFromHash() {
    const hash = String(location.hash || '')
      .replace(/^#/, '')
      .toLowerCase();
    if (!hash) return '';
    if (hash.includes('spotlight') || hash.includes('featured')) return 'spotlight';
    if (hash.includes('ranking') || hash.includes('review-badge') || hash.includes('ranking-embed'))
      return 'ranking';
    if (hash.includes('partner') || hash.includes('website-badge')) return 'partner';
    if (hash.includes('brand') || hash.includes('colour') || hash.includes('color')) return 'brand';
    if (hash.includes('reach') || hash === 'visibility' || hash === 'grow-visibility') return 'reach';
    if (hash.includes('linkedin') || hash === 'social' || hash === 'promote') return 'linkedin';
    return '';
  }

  function initSocialPageTabs(preferredTab) {
    if (!socialTabsBound) {
      socialTabsBound = true;
      document.querySelectorAll('[data-social-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          setSocialTab(btn.getAttribute('data-social-tab'));
        });
      });
    }

    let tab = preferredTab || socialTabFromHash() || storedSocialTab() || 'linkedin';
    setSocialTab(tab, { skipStore: !preferredTab, skipHash: true, skipRouteLoading: true });
  }

  function isSocialPageActive() {
    return Boolean(document.querySelector('[data-org-page="social"].is-active'));
  }

  function ensureLinkedInPostBuilder(options) {
    options = options || {};
    const root = document.getElementById('org-post-builder-root');
    if (!root) return;
    if (!window.HubLinkedInPostBuilder) {
      ensureLinkedInPostBuilderAssets()
        .then(function () {
          ensureLinkedInPostBuilder(options);
        })
        .catch(function () {
          /* non-fatal */
        });
      return;
    }
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
          // Lean bootstrap leaves state.events empty and fills eventSummaries —
          // use the same source as the Events list so Promote sees live events.
          return eventsSourceList();
        },
        getEventsReady: function () {
          return Boolean(
            state.eventsLoaded ||
              (state.eventSummaries && state.eventSummaries.length) ||
              (state.events && state.events.length)
          );
        },
      });
    } else if (options.force || isSocialPageActive()) {
      if (linkedInPostBuilder.refreshGroups) linkedInPostBuilder.refreshGroups();
      if (linkedInPostBuilder.refreshOpportunities) linkedInPostBuilder.refreshOpportunities();
      if (linkedInPostBuilder.refreshEvents) linkedInPostBuilder.refreshEvents();
    }
    // Warm full event rows (photos, etc.) after first paint — summaries cover the picker immediately.
    ensureEventsLoaded().then(function (ok) {
      if (!ok || !linkedInPostBuilder || !linkedInPostBuilder.refreshEvents) return;
      linkedInPostBuilder.refreshEvents();
    });
    // Business opportunity captions need listings — load them when Promote opens.
    loadOpportunitiesList().catch(function () {
      /* non-fatal */
    });
  }

  function ensureAttendeeEmailPanelReady(preferredEventId) {
    ensureEventConnectionsAssets()
      .then(function () {
        if (window.HubOrganiserEventConnections && window.HubOrganiserEventConnections.init) {
          var events =
            (state.events && state.events.length ? state.events : null) ||
            state.eventSummaries ||
            [];
          window.HubOrganiserEventConnections.init({
            groups: state.groups || [],
            events: events,
            eventId: preferredEventId || filters.attendeesEvent || '',
          });
        }
      })
      .catch(function () {
        /* non-fatal */
      });
    ensureGroupUpdatesAssets()
      .then(function () {
        if (window.HubOrganiserGroupUpdates && window.HubOrganiserGroupUpdates.init) {
          window.HubOrganiserGroupUpdates.init({ groups: state.groups || [] });
        }
      })
      .catch(function () {
        /* non-fatal */
      });
  }

  function setAttendeeEmailPanelVisible(show) {
    if (show) setRoute('communicate');
  }

  function openAttendeeEmailForEvent(eventId) {
    if (eventId && eventId !== 'all') {
      filters.attendeesEvent = eventId;
    }
    setRoute('communicate');
    ensureEventsLoaded()
      .catch(function () {
        return false;
      })
      .then(function () {
        const eid = eventId && eventId !== 'all' ? eventId : filters.attendeesEvent;
        ensureAttendeeEmailPanelReady(eid && eid !== 'all' ? eid : '');
        const panel = document.getElementById('org-attendee-email-panel');
        if (panel && panel.scrollIntoView) {
          panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
  }

  var brandKitBound = false;
  var brandKitSuggestedColors = [];
  var brandKitPendingImport = null;
  var brandKitHydratedGroupId = null;

  function normalizeBrandHex(value, fallback) {
    var v = String(value || '')
      .trim()
      .toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(v)) {
      v =
        '#' +
        v
          .slice(1)
          .split('')
          .map(function (c) {
            return c + c;
          })
          .join('');
    }
    if (/^#[0-9a-f]{6}$/.test(v)) return v;
    return fallback || '';
  }

  function brandKitEls() {
    return {
      form: document.getElementById('org-brand-kit-form'),
      groupWrap: document.getElementById('org-brand-group-wrap'),
      group: document.getElementById('org-brand-group'),
      website: document.getElementById('org-brand-website'),
      importBtn: document.getElementById('org-brand-import'),
      status: document.getElementById('org-brand-status'),
      review: document.getElementById('org-brand-import-review'),
      reviewList: document.getElementById('org-brand-import-review-list'),
      reviewApply: document.getElementById('org-brand-import-apply'),
      reviewDismiss: document.getElementById('org-brand-import-dismiss'),
      suggestions: document.getElementById('org-brand-color-suggestions'),
      primary: document.getElementById('org-brand-primary'),
      primaryHex: document.getElementById('org-brand-primary-hex'),
      secondary: document.getElementById('org-brand-secondary'),
      secondaryHex: document.getElementById('org-brand-secondary-hex'),
      accent: document.getElementById('org-brand-accent'),
      accentHex: document.getElementById('org-brand-accent-hex'),
      preview: document.getElementById('org-brand-preview'),
      instagram: document.getElementById('org-brand-instagram'),
      facebook: document.getElementById('org-brand-facebook'),
      linkedin: document.getElementById('org-brand-linkedin'),
      x: document.getElementById('org-brand-x'),
      save: document.getElementById('org-brand-save'),
      useLinkedIn: document.getElementById('org-brand-use-linkedin'),
      clear: document.getElementById('org-brand-clear-colors'),
      nudge: document.getElementById('org-brand-kit-nudge'),
      nudgeShare: document.getElementById('org-brand-kit-nudge-share'),
      contrast: document.getElementById('org-brand-contrast'),
      profileText: document.getElementById('org-brand-profile-text'),
      profileLogo: document.getElementById('org-brand-profile-logo'),
      profileLogoPh: document.getElementById('org-brand-profile-logo-ph'),
      openOrganiser: document.getElementById('org-brand-open-organiser'),
    };
  }

  function brandKitRelativeLuminance(hex) {
    var h = normalizeBrandHex(hex, '');
    if (!h) return 0.5;
    var r = parseInt(h.slice(1, 3), 16) / 255;
    var g = parseInt(h.slice(3, 5), 16) / 255;
    var b = parseInt(h.slice(5, 7), 16) / 255;
    var lin = function (c) {
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function brandKitContrastRatio(a, b) {
    var l1 = brandKitRelativeLuminance(a);
    var l2 = brandKitRelativeLuminance(b);
    var light = Math.max(l1, l2);
    var dark = Math.min(l1, l2);
    return (light + 0.05) / (dark + 0.05);
  }

  function updateBrandContrastCheck() {
    var els = brandKitEls();
    if (!els.contrast) return;
    var colors = readBrandColors();
    if (!colors.primary || !colors.accent) {
      els.contrast.hidden = true;
      els.contrast.textContent = '';
      return;
    }
    var ratio = brandKitContrastRatio(colors.primary, colors.accent);
    // Only nudge when accent nearly disappears on the primary — organisers
    // don’t need WCAG ratios or a “looks good” message every time.
    if (ratio < 1.4) {
      els.contrast.hidden = false;
      els.contrast.classList.remove('is-ok');
      els.contrast.textContent =
        'That accent colour is very close to your primary — headlines on LinkedIn pictures may be hard to see. Try a lighter or darker accent.';
      return;
    }
    els.contrast.hidden = true;
    els.contrast.textContent = '';
  }

  function brandKitCompleteness(group) {
    var g = group || currentBrandKitGroup() || {};
    var checks = [
      { id: 'logo', ok: Boolean(g.imageUrl), label: 'logo' },
      { id: 'website', ok: Boolean(g.website), label: 'website' },
      { id: 'colour', ok: Boolean(g.brandPrimaryColor), label: 'brand colours' },
      {
        id: 'social',
        ok: Boolean(g.instagramUrl || g.facebookUrl || g.linkedinUrl || g.xUrl),
        label: 'a social link',
      },
      {
        id: 'linkedin',
        ok: Boolean(g.linkedinUrl),
        label: 'LinkedIn (for tagging)',
      },
    ];
    var done = checks.filter(function (c) {
      return c.ok;
    }).length;
    var missing = checks
      .filter(function (c) {
        return !c.ok;
      })
      .map(function (c) {
        return c.label;
      });
    return { done: done, total: checks.length, missing: missing, checks: checks };
  }

  function renderBrandKitNudge() {
    var els = brandKitEls();
    var group = currentBrandKitGroup();
    var info = brandKitCompleteness(group);
    var html = '';
    if (!group) {
      html = '';
    } else if (info.done >= info.total) {
      html =
        '<strong>Colours &amp; type complete (' +
        info.done +
        '/' +
        info.total +
        ').</strong> Your LinkedIn posts can use your colours, and we can tag you when we share.';
    } else {
      html =
        '<strong>Colours &amp; type ' +
        info.done +
        '/' +
        info.total +
        '.</strong> Add ' +
        info.missing.slice(0, 2).join(' and ') +
        (info.missing.length > 2 ? '…' : '') +
        ' so posts look like your group.';
    }

    [els.nudge, els.nudgeShare].forEach(function (el, idx) {
      if (!el) return;
      if (!html || (idx === 1 && info.done >= info.total)) {
        el.hidden = true;
        el.innerHTML = '';
        return;
      }
      if (idx === 1 && info.done < info.total) {
        el.hidden = false;
        el.innerHTML =
          html +
          ' <button type="button" class="org-brand-kit-nudge-link" data-brand-open-kit>Add colours &amp; logo</button>';
        return;
      }
      el.hidden = false;
      el.innerHTML = html;
    });
  }

  function renderBrandProfileSummary() {
    var els = brandKitEls();
    var group = currentBrandKitGroup();
    if (!els.profileText) return;

    if (els.profileLogo && els.profileLogoPh) {
      if (group && group.imageUrl) {
        els.profileLogo.src = group.imageUrl;
        els.profileLogo.alt = (group.name || 'Organiser') + ' logo';
        els.profileLogo.hidden = false;
        els.profileLogoPh.hidden = true;
      } else {
        els.profileLogo.removeAttribute('src');
        els.profileLogo.alt = '';
        els.profileLogo.hidden = true;
        els.profileLogoPh.hidden = false;
        els.profileLogoPh.textContent = group ? 'Add logo' : 'No page';
      }
    }

    if (!group) {
      els.profileText.textContent =
        'Create an organiser page first, then add your logo, website and social links there.';
      return;
    }
    var parts = [];
    parts.push(group.imageUrl ? 'Logo added' : 'No logo yet');
    parts.push(group.website ? 'Website set' : 'No website yet');
    var socialCount = [group.instagramUrl, group.facebookUrl, group.linkedinUrl, group.xUrl].filter(
      Boolean
    ).length;
    parts.push(
      socialCount
        ? socialCount + ' social link' + (socialCount === 1 ? '' : 's')
        : 'No social links yet'
    );
    els.profileText.innerHTML =
      '<strong>' +
      esc(group.name || 'Your organiser page') +
      '</strong> — ' +
      esc(parts.join(' · ')) +
      '. Edit these once on your organiser page; LinkedIn posts pick them up automatically.';
  }

  function openBrandKitOrganiserPage() {
    var group = currentBrandKitGroup();
    if (!group || !group.id) {
      openGroupEditorDrawer('', { focusBrand: true });
      return;
    }
    openGroupEditorDrawer(group, { focusBrand: true });
  }

  function openBrandKitFromNudge() {
    setSocialTab('brand');
    var panel = document.getElementById('org-social-panel-brand');
    if (panel && panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function useBrandKitOnLinkedIn() {
    var group = currentBrandKitGroup();
    ensureLinkedInPostBuilder({ force: true });
    setSocialTab('linkedin');
    if (linkedInPostBuilder && linkedInPostBuilder.useBrandBackground) {
      linkedInPostBuilder.useBrandBackground(group && group.id);
    }
    setBrandKitStatus('Opened LinkedIn post with your brand colours selected.', 'ok');
  }

  function setBrandKitStatus(msg, kind) {
    var el = brandKitEls().status;
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('is-error', kind === 'error');
    el.classList.toggle('is-ok', kind === 'ok');
  }

  function syncBrandColorPair(colorEl, hexEl, value) {
    var hex = normalizeBrandHex(value, colorEl ? colorEl.value : '#000000');
    if (colorEl && hex) colorEl.value = hex;
    if (hexEl) hexEl.value = hex || '';
  }

  function readBrandColors() {
    var els = brandKitEls();
    return {
      primary: normalizeBrandHex(els.primaryHex && els.primaryHex.value, els.primary && els.primary.value),
      secondary: normalizeBrandHex(
        els.secondaryHex && els.secondaryHex.value,
        els.secondary && els.secondary.value
      ),
      accent: normalizeBrandHex(els.accentHex && els.accentHex.value, els.accent && els.accent.value),
    };
  }

  function updateBrandPreview() {
    var els = brandKitEls();
    var colors = readBrandColors();
    if (!els.preview) return;
    els.preview.style.setProperty('--org-brand-primary', colors.primary || '#0d1f3c');
    els.preview.style.setProperty('--org-brand-secondary', colors.secondary || '#f7f1e8');
    els.preview.style.setProperty('--org-brand-accent', colors.accent || '#c9961f');
    updateBrandContrastCheck();
  }

  function renderBrandColorSuggestions(colors) {
    var els = brandKitEls();
    brandKitSuggestedColors = (colors || [])
      .map(function (c) {
        return normalizeBrandHex(c, '');
      })
      .filter(Boolean);
    if (!els.suggestions) return;
    if (!brandKitSuggestedColors.length) {
      els.suggestions.hidden = true;
      els.suggestions.innerHTML = '';
      return;
    }
    els.suggestions.hidden = false;
    els.suggestions.innerHTML = brandKitSuggestedColors
      .map(function (hex, idx) {
        return (
          '<button type="button" class="org-brand-kit-suggest" data-brand-suggest="' +
          idx +
          '" title="Use ' +
          hex +
          '" style="background:' +
          hex +
          '" aria-label="Use colour ' +
          hex +
          '"></button>'
        );
      })
      .join('');
  }

  function rgbPartsToHex(r, g, b) {
    function part(v) {
      var h = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return h.length === 1 ? '0' + h : h;
    }
    return '#' + part(r) + part(g) + part(b);
  }

  function sampleLogoPaletteFromImage(img) {
    try {
      var canvas = document.createElement('canvas');
      var size = 48;
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext('2d');
      if (!ctx) return [];
      ctx.drawImage(img, 0, 0, size, size);
      var data = ctx.getImageData(0, 0, size, size).data;
      var buckets = {};
      var allR = 0;
      var allG = 0;
      var allB = 0;
      var allN = 0;
      for (var i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 40) continue;
        var pr = data[i];
        var pg = data[i + 1];
        var pb = data[i + 2];
        allR += pr;
        allG += pg;
        allB += pb;
        allN++;
        var mx = Math.max(pr, pg, pb);
        var mn = Math.min(pr, pg, pb);
        if (mx > 245 && mn > 235) continue;
        if (mx < 28) continue;
        if (mx - mn < 28) continue;
        var key =
          Math.round(pr / 24) + ',' + Math.round(pg / 24) + ',' + Math.round(pb / 24);
        if (!buckets[key]) buckets[key] = { r: 0, g: 0, b: 0, n: 0 };
        buckets[key].r += pr;
        buckets[key].g += pg;
        buckets[key].b += pb;
        buckets[key].n += 1;
      }
      var ranked = Object.keys(buckets)
        .map(function (k) {
          var b = buckets[k];
          return {
            hex: rgbPartsToHex(b.r / b.n, b.g / b.n, b.b / b.n),
            n: b.n,
          };
        })
        .sort(function (a, b) {
          return b.n - a.n;
        });
      var out = ranked.map(function (x) {
        return x.hex;
      });
      if (!out.length && allN > 0) {
        out.push(rgbPartsToHex(allR / allN, allG / allN, allB / allN));
      }
      return out.slice(0, 4);
    } catch (e) {
      return [];
    }
  }

  function loadImageForBrandSample(src) {
    return new Promise(function (resolve) {
      if (!src) {
        resolve(null);
        return;
      }
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = src;
    });
  }

  async function sampleLogoColorsForGroup(group, importedLogoUrl) {
    var urls = [];
    if (group && group.id && group.imageUrl) {
      urls.push('/api/organiser/logo-proxy?groupId=' + encodeURIComponent(group.id));
    }
    if (importedLogoUrl) urls.push(importedLogoUrl);
    if (group && group.imageUrl) urls.push(group.imageUrl);
    for (var i = 0; i < urls.length; i++) {
      var img = await loadImageForBrandSample(urls[i]);
      if (!img) continue;
      var colors = sampleLogoPaletteFromImage(img);
      if (colors.length) return colors;
    }
    return [];
  }

  function mergeBrandColorLists() {
    var seen = {};
    var out = [];
    for (var i = 0; i < arguments.length; i++) {
      (arguments[i] || []).forEach(function (c) {
        var hex = normalizeBrandHex(c, '');
        if (!hex || seen[hex]) return;
        seen[hex] = true;
        out.push(hex);
      });
    }
    return out.slice(0, 8);
  }

  function fieldHasValue(value) {
    return Boolean(String(value || '').trim());
  }

  function currentBrandFieldSnapshot(group) {
    var els = brandKitEls();
    var g = group || {};
    return {
      website: g.website || (els.website && els.website.value) || '',
      // Only treat colours as "already set" when saved on the group — form pickers always have a default.
      brandPrimaryColor: g.brandPrimaryColor || '',
      brandSecondaryColor: g.brandSecondaryColor || '',
      brandAccentColor: g.brandAccentColor || '',
      instagramUrl: g.instagramUrl || (els.instagram && els.instagram.value) || '',
      facebookUrl: g.facebookUrl || (els.facebook && els.facebook.value) || '',
      linkedinUrl: g.linkedinUrl || (els.linkedin && els.linkedin.value) || '',
      xUrl: g.xUrl || (els.x && els.x.value) || '',
    };
  }

  function hideBrandImportReview() {
    var els = brandKitEls();
    brandKitPendingImport = null;
    if (els.review) els.review.hidden = true;
    if (els.reviewList) els.reviewList.innerHTML = '';
  }

  function showBrandImportReview(importData, existing) {
    var els = brandKitEls();
    if (!els.review || !els.reviewList) return;
    var items = [];
    function pushItem(key, label, value, isColor) {
      if (!fieldHasValue(value)) return;
      var already = fieldHasValue(existing[key]);
      items.push({
        key: key,
        label: label,
        value: value,
        isColor: Boolean(isColor),
        already: already,
        checked: !already,
      });
    }
    pushItem('brandPrimaryColor', 'Primary colour', importData.brandPrimaryColor, true);
    pushItem('brandSecondaryColor', 'Secondary colour', importData.brandSecondaryColor, true);
    pushItem('brandAccentColor', 'Accent colour', importData.brandAccentColor, true);
    pushItem('instagramUrl', 'Instagram', importData.instagramUrl);
    pushItem('facebookUrl', 'Facebook', importData.facebookUrl);
    pushItem('linkedinUrl', 'LinkedIn', importData.linkedinUrl);
    pushItem('xUrl', 'X (Twitter)', importData.xUrl);
    pushItem('website', 'Website URL', importData.url || importData.website);

    brandKitPendingImport = {
      data: importData,
      items: items,
      colors: importData.colors || [],
    };

    if (!items.length) {
      hideBrandImportReview();
      setBrandKitStatus(
        'We couldn’t find colours or social links to import. Enter them by hand, or try another URL.',
        'error'
      );
      return;
    }

    els.reviewList.innerHTML = items
      .map(function (item, idx) {
        var preview = item.isColor
          ? '<span class="org-brand-kit-review-swatch" style="background:' +
            item.value +
            '"></span>' +
            item.value
          : item.value;
        return (
          '<label class="org-brand-kit-review-item">' +
          '<input type="checkbox" data-brand-import-idx="' +
          idx +
          '"' +
          (item.checked ? ' checked' : '') +
          ' />' +
          '<span>' +
          '<strong>' +
          item.label +
          '</strong>' +
          '<span>' +
          preview +
          '</span>' +
          (item.already
            ? '<span class="org-brand-kit-review-note">Already set — tick to replace</span>'
            : '') +
          '</span>' +
          '</label>'
        );
      })
      .join('');
    els.review.hidden = false;
    renderBrandColorSuggestions(importData.colors || []);
    setBrandKitStatus(
      'Found ' +
        items.length +
        ' item' +
        (items.length === 1 ? '' : 's') +
        '. Tick what you want, then Apply & save.',
      'ok'
    );
    requestAnimationFrame(function () {
      if (els.reviewApply && els.reviewApply.scrollIntoView) {
        els.reviewApply.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (els.review && els.review.scrollIntoView) {
        els.review.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  async function applyBrandImportSelection() {
    var els = brandKitEls();
    if (!brandKitPendingImport || !els.reviewList) return;
    var selected = {};
    els.reviewList.querySelectorAll('[data-brand-import-idx]').forEach(function (input) {
      if (!input.checked) return;
      var item = brandKitPendingImport.items[Number(input.getAttribute('data-brand-import-idx'))];
      if (item) selected[item.key] = item.value;
    });
    if (!Object.keys(selected).length) {
      setBrandKitStatus('Tick at least one item to apply.', 'error');
      return;
    }
    if (selected.website && els.website) els.website.value = selected.website;
    if (selected.brandPrimaryColor) {
      syncBrandColorPair(els.primary, els.primaryHex, selected.brandPrimaryColor);
    }
    if (selected.brandSecondaryColor) {
      syncBrandColorPair(els.secondary, els.secondaryHex, selected.brandSecondaryColor);
    }
    if (selected.brandAccentColor) {
      syncBrandColorPair(els.accent, els.accentHex, selected.brandAccentColor);
    }
    if (selected.instagramUrl && els.instagram) els.instagram.value = selected.instagramUrl;
    if (selected.facebookUrl && els.facebook) els.facebook.value = selected.facebookUrl;
    if (selected.linkedinUrl && els.linkedin) els.linkedin.value = selected.linkedinUrl;
    if (selected.xUrl && els.x) els.x.value = selected.xUrl;
    renderBrandColorSuggestions(brandKitPendingImport.colors || []);
    updateBrandPreview();
    hideBrandImportReview();
    if (els.reviewApply) {
      els.reviewApply.disabled = true;
      els.reviewApply.textContent = 'Saving…';
    }
    setBrandKitStatus('Saving to your organiser page…');
    try {
      await saveBrandKit();
    } finally {
      if (els.reviewApply) {
        els.reviewApply.disabled = false;
        els.reviewApply.textContent = 'Apply & save';
      }
    }
  }

  function preferBrandOnLinkedIn(groupId) {
    ensureLinkedInPostBuilder({ force: true });
    if (linkedInPostBuilder && linkedInPostBuilder.useBrandBackground) {
      linkedInPostBuilder.useBrandBackground(groupId);
    }
  }

  function currentBrandKitGroup() {
    var els = brandKitEls();
    var groups = state.groups || [];
    if (!groups.length) return null;
    var id = els.group && els.group.value;
    return (
      groups.find(function (g) {
        return String(g.id) === String(id);
      }) || groups[0]
    );
  }

  function fillBrandKitForm(group) {
    var els = brandKitEls();
    if (!els.form) return;
    var g = group || currentBrandKitGroup() || {};
    if (els.website) els.website.value = g.website || '';
    syncBrandColorPair(els.primary, els.primaryHex, g.brandPrimaryColor || '#0d1f3c');
    syncBrandColorPair(els.secondary, els.secondaryHex, g.brandSecondaryColor || '#f7f1e8');
    syncBrandColorPair(els.accent, els.accentHex, g.brandAccentColor || '#c9961f');
    var typeStyle = resolveBrandTypeStyle(g);
    document.querySelectorAll('input[name="org-brand-type"]').forEach(function (input) {
      input.checked = input.value === typeStyle;
      var option = input.closest('.org-brand-type-option');
      if (option) option.classList.toggle('is-selected', input.checked);
    });
    if (els.instagram) els.instagram.value = g.instagramUrl || '';
    if (els.facebook) els.facebook.value = g.facebookUrl || '';
    if (els.linkedin) els.linkedin.value = g.linkedinUrl || '';
    if (els.x) els.x.value = g.xUrl || '';
    updateBrandPreview();
    renderBrandKitNudge();
    renderBrandProfileSummary();
    if (els.useLinkedIn) {
      els.useLinkedIn.hidden = !g.brandPrimaryColor;
    }
  }

  function syncBrandKitGroupOptions() {
    var els = brandKitEls();
    if (!els.group) return;
    var groups = state.groups || [];
    var prev = els.group.value;
    els.group.innerHTML = '';
    if (els.groupWrap) els.groupWrap.hidden = groups.length < 2;
    if (!groups.length) {
      var empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'Create an organiser page first';
      els.group.appendChild(empty);
      return;
    }
    groups.forEach(function (g, idx) {
      var opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name || 'Organiser page';
      els.group.appendChild(opt);
      if (!prev && idx === 0) els.group.value = g.id;
    });
    if (
      prev &&
      groups.some(function (g) {
        return String(g.id) === String(prev);
      })
    ) {
      els.group.value = prev;
    } else {
      els.group.value = groups[0].id;
    }
  }

  async function importBrandKitFromWebsite() {
    var els = brandKitEls();
    var url = String((els.website && els.website.value) || '').trim();
    if (!url) {
      setBrandKitStatus('Enter your website URL first.', 'error');
      if (els.website) els.website.focus();
      return;
    }
    if (els.importBtn) {
      els.importBtn.disabled = true;
      els.importBtn.textContent = 'Importing…';
    }
    hideBrandImportReview();
    setBrandKitStatus('Reading your website…');
    try {
      var res = await api('/api/organiser/website-brand', {
        method: 'POST',
        body: JSON.stringify({ url: url }),
      });
      if (!res.ok || !res.data || !res.data.ok) {
        throw new Error((res.data && (res.data.message || res.data.error)) || 'Import failed');
      }
      var data = res.data;
      var group = currentBrandKitGroup();
      setBrandKitStatus('Sampling colours from your logo…');
      var logoColors = await sampleLogoColorsForGroup(group, data.logoUrl || '');
      var mergedColors = mergeBrandColorLists(logoColors, data.colors || []);
      if (logoColors[0] && !data.brandPrimaryColor) {
        data.brandPrimaryColor = logoColors[0];
      }
      if (logoColors[1] && !data.brandAccentColor) {
        data.brandAccentColor = logoColors[1];
      }
      if (logoColors[2] && !data.brandSecondaryColor) {
        data.brandSecondaryColor = logoColors[2];
      }
      if (!data.brandPrimaryColor && mergedColors[0]) data.brandPrimaryColor = mergedColors[0];
      if (!data.brandAccentColor && mergedColors[1]) data.brandAccentColor = mergedColors[1];
      if (!data.brandSecondaryColor && mergedColors[2]) data.brandSecondaryColor = mergedColors[2];
      data.colors = mergedColors;
      if (logoColors.length) {
        data.message =
          (data.message ? data.message + ' ' : '') +
          'Also sampled ' +
          logoColors.length +
          ' colour' +
          (logoColors.length === 1 ? '' : 's') +
          ' from your logo.';
      }
      showBrandImportReview(data, currentBrandFieldSnapshot(group));
    } catch (e) {
      setBrandKitStatus(e.message || 'Could not read that website.', 'error');
    } finally {
      if (els.importBtn) {
        els.importBtn.disabled = false;
        els.importBtn.textContent = 'Import from website';
      }
    }
  }

  function readBrandTypeStyle() {
    var checked = document.querySelector('input[name="org-brand-type"]:checked');
    var value = checked ? String(checked.value || '').toLowerCase() : 'classic';
    if (
      value === 'editorial' ||
      value === 'modern' ||
      value === 'bold' ||
      value === 'friendly'
    ) {
      return value;
    }
    return 'classic';
  }

  function rememberBrandTypeStyle(groupId, style) {
    if (!groupId) return;
    try {
      localStorage.setItem('hub_brand_type_style:' + groupId, style || 'classic');
    } catch (e) {
      /* ignore */
    }
  }

  function rememberedBrandTypeStyle(groupId) {
    if (!groupId) return '';
    try {
      return String(localStorage.getItem('hub_brand_type_style:' + groupId) || '').toLowerCase();
    } catch (e) {
      return '';
    }
  }

  function resolveBrandTypeStyle(group) {
    var g = group || {};
    var fromGroup = String(g.brandTypeStyle || g.brand_type_style || '').toLowerCase();
    if (
      fromGroup === 'editorial' ||
      fromGroup === 'modern' ||
      fromGroup === 'bold' ||
      fromGroup === 'friendly' ||
      fromGroup === 'classic'
    ) {
      return fromGroup;
    }
    var remembered = rememberedBrandTypeStyle(g.id);
    if (
      remembered === 'editorial' ||
      remembered === 'modern' ||
      remembered === 'bold' ||
      remembered === 'friendly' ||
      remembered === 'classic'
    ) {
      return remembered;
    }
    return 'classic';
  }

  async function saveBrandKit(ev) {
    if (ev) ev.preventDefault();
    var els = brandKitEls();
    var group = currentBrandKitGroup();
    if (!group || !group.id) {
      setBrandKitStatus('Create an organiser page first.', 'error');
      return;
    }
    var colors = readBrandColors();
    var typeStyle = readBrandTypeStyle();
    if (els.save) {
      els.save.disabled = true;
      els.save.textContent = 'Saving…';
    }
    setBrandKitStatus('Saving colours & type…');
    try {
      var res = await api('/api/organiser/groups', {
        method: 'PATCH',
        body: JSON.stringify({
          id: group.id,
          website: els.website ? els.website.value.trim() : undefined,
          brandPrimaryColor: colors.primary || '',
          brandSecondaryColor: colors.secondary || '',
          brandAccentColor: colors.accent || '',
          brandTypeStyle: typeStyle,
          instagramUrl: els.instagram ? els.instagram.value.trim() : '',
          facebookUrl: els.facebook ? els.facebook.value.trim() : '',
          linkedinUrl: els.linkedin ? els.linkedin.value.trim() : '',
          xUrl: els.x ? els.x.value.trim() : '',
        }),
      });
      if (!res.ok || !res.data || !res.data.ok) {
        throw new Error((res.data && (res.data.message || res.data.error)) || 'Save failed');
      }
      var updated = res.data.group || {};
      var idx = state.groups.findIndex(function (g) {
        return g.id === group.id;
      });
      if (idx >= 0) {
        state.groups[idx] = { ...state.groups[idx], ...updated, brandTypeStyle: typeStyle };
      }
      rememberBrandTypeStyle(group.id, typeStyle);
      fillBrandKitForm(state.groups[idx] || updated);
      preferBrandOnLinkedIn(group.id);
      renderBrandKitNudge();
      renderBrandProfileSummary();
      if (els.useLinkedIn) els.useLinkedIn.hidden = !readBrandColors().primary;
      if (linkedInPostBuilder && linkedInPostBuilder.refreshGroups) {
        linkedInPostBuilder.refreshGroups();
      }
      setBrandKitStatus(
        'Colours and type saved. LinkedIn posts will use Your brand by default.',
        'ok'
      );
    } catch (e) {
      // Type column may be missing until migration 220 — still keep the local choice.
      rememberBrandTypeStyle(group.id, typeStyle);
      var gi = (state.groups || []).findIndex(function (g) {
        return g.id === group.id;
      });
      if (gi >= 0) state.groups[gi].brandTypeStyle = typeStyle;
      setBrandKitStatus(e.message || 'Could not save colours.', 'error');
    } finally {
      if (els.save) {
        els.save.disabled = false;
        els.save.textContent = 'Save colours & type';
      }
    }
  }

  function bindBrandKitPanel() {
    if (brandKitBound) return;
    var els = brandKitEls();
    if (!els.form) return;
    brandKitBound = true;

    els.form.addEventListener('submit', saveBrandKit);
    if (els.importBtn) els.importBtn.addEventListener('click', importBrandKitFromWebsite);
    if (els.reviewApply) els.reviewApply.addEventListener('click', applyBrandImportSelection);
    if (els.reviewDismiss) els.reviewDismiss.addEventListener('click', hideBrandImportReview);
    if (els.useLinkedIn) els.useLinkedIn.addEventListener('click', useBrandKitOnLinkedIn);
    if (els.openOrganiser) els.openOrganiser.addEventListener('click', openBrandKitOrganiserPage);
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-brand-open-kit]');
      if (btn) {
        e.preventDefault();
        openBrandKitFromNudge();
      }
      var editOrg = e.target.closest('[data-brand-open-organiser]');
      if (editOrg) {
        e.preventDefault();
        openBrandKitOrganiserPage();
      }
    });
    if (els.group) {
      els.group.addEventListener('change', function () {
        brandKitHydratedGroupId = els.group.value || null;
        fillBrandKitForm(currentBrandKitGroup());
        renderBrandColorSuggestions([]);
        hideBrandImportReview();
        setBrandKitStatus('');
      });
    }
    if (els.clear) {
      els.clear.addEventListener('click', function () {
        syncBrandColorPair(els.primary, els.primaryHex, '#0d1f3c');
        syncBrandColorPair(els.secondary, els.secondaryHex, '#f7f1e8');
        syncBrandColorPair(els.accent, els.accentHex, '#c9961f');
        renderBrandColorSuggestions([]);
        updateBrandPreview();
        setBrandKitStatus('Colours reset to defaults — save to apply.', 'ok');
      });
    }
    if (els.suggestions) {
      els.suggestions.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-brand-suggest]');
        if (!btn) return;
        var hex = brandKitSuggestedColors[Number(btn.getAttribute('data-brand-suggest'))];
        if (!hex) return;
        syncBrandColorPair(els.primary, els.primaryHex, hex);
        updateBrandPreview();
      });
    }

    function wireColorInputs(colorEl, hexEl) {
      if (colorEl) {
        colorEl.addEventListener('input', function () {
          if (hexEl) hexEl.value = colorEl.value;
          updateBrandPreview();
        });
      }
      if (hexEl) {
        hexEl.addEventListener('change', function () {
          var hex = normalizeBrandHex(hexEl.value, '');
          if (hex) {
            hexEl.value = hex;
            if (colorEl) colorEl.value = hex;
            updateBrandPreview();
          }
        });
      }
    }
    wireColorInputs(els.primary, els.primaryHex);
    wireColorInputs(els.secondary, els.secondaryHex);
    wireColorInputs(els.accent, els.accentHex);

    document.querySelectorAll('input[name="org-brand-type"]').forEach(function (input) {
      input.addEventListener('change', function () {
        try {
          document.querySelectorAll('.org-brand-type-option').forEach(function (opt) {
            var radio = opt.querySelector('input[name="org-brand-type"]');
            opt.classList.toggle('is-selected', Boolean(radio && radio.checked));
          });
          var group = currentBrandKitGroup();
          var style = readBrandTypeStyle();
          if (group && group.id) {
            rememberBrandTypeStyle(group.id, style);
            group.brandTypeStyle = style;
            var gi = (state.groups || []).findIndex(function (g) {
              return g.id === group.id;
            });
            if (gi >= 0) state.groups[gi].brandTypeStyle = style;
          }
          if (linkedInPostBuilder && typeof linkedInPostBuilder.refresh === 'function') {
            linkedInPostBuilder.refresh();
          }
          setBrandKitStatus('Type style selected — save to keep it on your organiser page.', 'ok');
        } catch (err) {
          console.warn('brand type change failed', err);
          setBrandKitStatus('Could not preview that type style. Try Save colours & type.', 'error');
        }
      });
    });
  }

  function ensureBrandKitPanelReady() {
    bindBrandKitPanel();
    syncBrandKitGroupOptions();
    var group = currentBrandKitGroup();
    var groupId = group && group.id != null ? String(group.id) : '';
    // Only hydrate once per organiser page. Re-running fill on every tab click
    // was wiping imported colours before the organiser could save.
    if (brandKitHydratedGroupId !== groupId) {
      brandKitHydratedGroupId = groupId;
      fillBrandKitForm(group);
    } else {
      renderBrandKitNudge();
      renderBrandProfileSummary();
      updateBrandContrastCheck();
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

    const hasRanking = Boolean(best);
    updateSocialRankingNav(hasRanking);
    if (hasRanking) {
      updateRankingPanelSummaries(rankingBadgeText(best));
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
    renderVisibilityHubMeta();
  }

  function renderVisibilityHubMeta() {
    const eventsMeta = document.getElementById('org-visibility-events-meta');
    const oppMeta = document.getElementById('org-visibility-opp-meta');
    // Optional: only present if a Feature-event meta node exists elsewhere.
    if (eventsMeta) {
      const eligible = liveEventsForFeaturedUpgrade();
      const featuredCount = (state.events || []).filter(function (ev) {
        return ev && ev.featured && eventIsEligibleForFeaturedUpgrade(ev);
      }).length;
      if (!state.eventsLoaded) {
        eventsMeta.textContent = 'Show your event first when people browse upcoming events on the hub.';
      } else if (!eligible.length) {
        eventsMeta.textContent = 'Publish an upcoming event first, then come back here to feature it.';
      } else if (featuredCount > 0) {
        eventsMeta.textContent =
          'You have ' +
          eligible.length +
          ' upcoming event' +
          (eligible.length === 1 ? '' : 's') +
          ' · ' +
          featuredCount +
          ' already featured at the top';
      } else {
        eventsMeta.textContent =
          'You have ' +
          eligible.length +
          ' upcoming event' +
          (eligible.length === 1 ? '' : 's') +
          ' — pick one to show at the top of the events page';
      }
    }
    if (oppMeta) {
      const liveListings = (state.opportunities || []).filter(function (o) {
        const status = String(o.status || o.listingStatus || '').toLowerCase();
        return status === 'published' || status === 'live';
      });
      const premiumCount = liveListings.filter(function (o) {
        return o && (o.featured || opportunityPremiumMeta(o).tone !== 'muted');
      }).length;
      if (!state.opportunitiesLoaded) {
        oppMeta.textContent = 'Show your listing first when people browse business opportunities on the hub.';
      } else if (!liveListings.length) {
        oppMeta.textContent = 'Publish a business opportunity first, then come back here to feature it.';
      } else if (premiumCount > 0) {
        oppMeta.textContent =
          'You have ' +
          liveListings.length +
          ' live listing' +
          (liveListings.length === 1 ? '' : 's') +
          ' · ' +
          premiumCount +
          ' already featured at the top';
      } else {
        oppMeta.textContent =
          'You have ' +
          liveListings.length +
          ' live listing' +
          (liveListings.length === 1 ? '' : 's') +
          ' — pick one to show at the top of the opportunities page';
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
  const GROUP_CONTINUE_KEY = 'hub_group_continue_to_event';

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

  function applyPendingGroupContinue() {
    try {
      const groupId = sessionStorage.getItem(GROUP_CONTINUE_KEY);
      if (!groupId) return;
      sessionStorage.removeItem(GROUP_CONTINUE_KEY);
      if (window.HubFlowTour) window.HubFlowTour.markEventTourPending();
      requestAnimationFrame(function () {
        openNewEventEditorDrawer({ groupId: groupId });
      });
    } catch {
      /* ignore */
    }
  }

  function handleGroupContinueToEvent(saved) {
    const groupId =
      (saved && saved.id) || (state.groups.length ? state.groups[0].id : '');
    closeGroupEditorDrawer();
    if (window.HubFlowTour) window.HubFlowTour.markEventTourPending();
    openNewEventEditorDrawer({ groupId: groupId });
  }

  function continueAfterClaimProfileSave(saved) {
    closeGroupEditorDrawer();
    trackClaimFunnel('profile_saved', (saved && (saved.slug || saved.name || saved.id)) || '');
    if ((state.pendingClaimGroups || []).length > 0) {
      renderGroupClaimModal();
      return;
    }
    if ((state.pendingClaimOpportunities || []).length > 0) {
      renderOpportunityClaimModal();
      return;
    }
    const launch = window.HubOrganiserLaunchSetup;
    const item = launch && launch.nextItem ? launch.nextItem(launchSetupInput()) : null;
    if (item) {
      openLaunchSetupItem(item);
      return;
    }
    showReadyForEventPrompt();
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

  function embedBootstrapPayload() {
    return {
      type: 'hub-event-drawer-bootstrap',
      groups: state.groups || [],
      events: state.events || [],
    };
  }

  function refreshEmbedBootstrapCache() {
    cacheBootstrapForEmbed({ groups: state.groups, events: state.events });
  }

  function sendEmbedBootstrapToFrame(frame) {
    if (!frame || !frame.contentWindow) return;
    try {
      frame.contentWindow.postMessage(embedBootstrapPayload(), window.location.origin);
    } catch {
      /* ignore */
    }
  }

  function prefetchEventsInBackground() {
    if (state.eventsFullyLoaded || state.eventsLoading || !state.eventsHasMore) return;
    if (!document.querySelector('[data-org-page="events"].is-active')) return;
    ensureAllEventsForGrouping()
      .then(function () {
        updateMyEventsTabCounts();
        renderOverviewEvents();
        if (eventsSubRoute === 'events-list') renderEvents();
        else if (eventsSubRoute === 'events-revenue') renderRevenue();
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

  async function apiWithTimeout(path, options, timeoutMs) {
    const ms = timeoutMs || 30000;
    if (typeof AbortController === 'undefined') {
      return api(path, options);
    }
    const controller = new AbortController();
    const timer = setTimeout(function () {
      controller.abort();
    }, ms);
    try {
      return await api(path, { ...(options || {}), signal: controller.signal });
    } catch (e) {
      if (e && e.name === 'AbortError') {
        throw new Error('Request timed out — please refresh and try again');
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
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

  function formatRelativeAge(raw) {
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    const ms = Date.now() - d.getTime();
    if (ms < 0) return 'just now';
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    if (days === 1) return '1 day ago';
    if (days < 14) return days + ' days ago';
    return formatDateShort(raw);
  }

  function showOpportunityLoadError(message) {
    const el = document.getElementById('org-opp-load-error');
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    el.innerHTML = '<p>' + esc(message) + '</p>';
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
    return /online|virtual/.test(fmt);
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
        if (hasClaimOnboardMismatch()) {
          notices.push(claimOnboardMismatchNotice());
        } else {
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
            ? 'A member sent a message about one of your business opportunities. Reply from your workspace while the lead is still warm.'
            : 'Members have sent new messages about your business opportunities. Review and reply from Enquiries received.',
        actions:
          '<button type="button" class="org-btn org-btn-gold org-btn-sm" data-org-route="business-enquiries">View enquiries</button>',
      });
    }

    const groupsWithFreeUsed = new Set();
    (state.events || []).forEach(function (ev) {
      if (!ev || !ev.connectionsEmailSentAt) return;
      const gid = String(ev.organiserGroupId || ev.organiserId || ev.organiser_id || '');
      if (gid) groupsWithFreeUsed.add(gid);
    });
    const roundUpReady = (state.events || []).filter(function (ev) {
      if (!ev || !ev.id) return false;
      const gid = String(ev.organiserGroupId || ev.organiserId || ev.organiser_id || '');
      if (gid && groupsWithFreeUsed.has(gid)) return false;
      const startMs = new Date(ev.date || ev.startsAt || ev.starts_at || 0).getTime();
      if (!Number.isFinite(startMs) || startMs > Date.now()) return false;
      return eventEffectiveTicketsSold(ev) >= 2;
    });
    if (roundUpReady.length) {
      const first = roundUpReady[0];
      notices.push({
        id: 'attendee-roundup',
        type: 'action',
        title:
          roundUpReady.length === 1
            ? 'Ready to send who attended?'
            : roundUpReady.length + ' events ready for an Attendee round-up',
        text:
          roundUpReady.length === 1
            ? '“' +
              esc(first.title || 'Your event') +
              '” has finished and has guests who can reconnect. You still have your free Attendee round-up for this organiser page.'
            : 'Past events still have no Attendee round-up. You get one free send per organiser page — open Communicate when you’re ready.',
        actions:
          '<button type="button" class="org-btn org-btn-gold org-btn-sm" data-org-route="communicate" data-send-attendee-email="' +
          esc(first.id) +
          '">Open Communicate</button>',
      });
    }

    const unrepliedReviews = unrepliedReviewsList();
    if (unrepliedReviews.length) {
      const firstReview = unrepliedReviews[0];
      const preview = unrepliedReviews
        .slice(0, 3)
        .map(function (r) {
          return (
            '<button type="button" class="org-notice-chip" data-org-route="events-reviews">' +
            esc(r.authorName || 'Guest') +
            ' · ' +
            esc(r.eventTitle || 'Event') +
            '</button>'
          );
        })
        .join('');
      const more =
        unrepliedReviews.length > 3
          ? '<span class="org-notice-chip-more">+' +
            String(unrepliedReviews.length - 3) +
            ' more</span>'
          : '';
      notices.push({
        id: 'reviews-reply',
        type: 'action',
        title:
          unrepliedReviews.length === 1
            ? 'A review is waiting for your reply'
            : unrepliedReviews.length + ' reviews are waiting for your reply',
        text:
          unrepliedReviews.length === 1
            ? '<strong>' +
              esc(firstReview.authorName || 'Someone') +
              '</strong> left feedback on <strong>' +
              esc(firstReview.eventTitle || 'your event') +
              '</strong>. A short public reply helps future guests trust your group.'
            : 'Attendees have left feedback you have not replied to yet. Responding publicly builds trust for future bookings.',
        actions:
          '<div class="org-notice-chips">' +
          preview +
          more +
          '</div><button type="button" class="org-btn org-btn-gold org-btn-sm" data-org-route="events-reviews">Open reviews</button>',
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
    const moreBadge = document.getElementById('org-more-notifications-badge');
    const count = organiserNoticeBadgeCount(notices);
    if (badge) {
      badge.hidden = count < 1;
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.setAttribute('aria-hidden', count < 1 ? 'true' : 'false');
    }
    if (moreBadge) {
      moreBadge.hidden = count < 1;
      moreBadge.textContent = count > 99 ? '99+' : count > 1 ? String(count) : 'New';
    }
    if (navBtn) {
      navBtn.setAttribute(
        'aria-label',
        count > 0 ? 'Notifications, ' + count + ' need action' : 'Notifications'
      );
    }
    refreshOrgBottomMoreCount(count);
  }

  let notificationsPanelBound = false;
  let notificationsPanelOpen = false;

  function openNotificationsPanel() {
    const panel = document.getElementById('org-notifications-panel');
    const navBtn = document.getElementById('org-notifications-nav');
    if (!panel) return;
    refreshPendingApplicationsSummary().finally(function () {
      renderOrganiserNotices();
    });
    ensureReviewsLoaded()
      .catch(function () {
        return false;
      })
      .finally(function () {
        renderOrganiserNotices();
      });
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
    const panel = document.getElementById('org-notifications-panel');
    if (panel && panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }
    document.getElementById('org-notifications-nav')?.addEventListener('click', function () {
      if (notificationsPanelOpen) closeNotificationsPanel();
      else openNotificationsPanel();
    });
    document.getElementById('org-notifications-close')?.addEventListener('click', closeNotificationsPanel);
    document.getElementById('org-notifications-backdrop')?.addEventListener('click', closeNotificationsPanel);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && notificationsPanelOpen) closeNotificationsPanel();
      else if (e.key === 'Escape' && moreSheetOpen) closeOrgMoreSheet();
    });
  }

  let moreSheetBound = false;
  let moreSheetOpen = false;

  function openOrgMoreSheet() {
    const sheet = document.getElementById('org-more-sheet');
    const btn = document.getElementById('org-bottom-more-btn');
    if (!sheet) return;
    closeNotificationsPanel();
    sheet.hidden = false;
    sheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('org-more-sheet-open');
    moreSheetOpen = true;
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }

  function closeOrgMoreSheet() {
    const sheet = document.getElementById('org-more-sheet');
    const btn = document.getElementById('org-bottom-more-btn');
    if (!sheet) return;
    sheet.hidden = true;
    sheet.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('org-more-sheet-open');
    moreSheetOpen = false;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function bindOrgMoreSheetOnce() {
    if (moreSheetBound) return;
    moreSheetBound = true;
    const sheet = document.getElementById('org-more-sheet');
    if (sheet && sheet.parentElement !== document.body) {
      document.body.appendChild(sheet);
    }
    const bottomNav = document.querySelector('.org-bottom-nav');
    if (bottomNav && bottomNav.parentElement !== document.body) {
      document.body.appendChild(bottomNav);
    }
    document.getElementById('org-bottom-more-btn')?.addEventListener('click', function () {
      if (moreSheetOpen) closeOrgMoreSheet();
      else openOrgMoreSheet();
    });
    document.getElementById('org-more-sheet-close')?.addEventListener('click', closeOrgMoreSheet);
    document.getElementById('org-more-sheet-backdrop')?.addEventListener('click', closeOrgMoreSheet);
    document.getElementById('org-more-notifications')?.addEventListener('click', function () {
      closeOrgMoreSheet();
      openNotificationsPanel();
    });
    document.querySelectorAll('#org-more-sheet [data-org-route]').forEach(function (el) {
      el.addEventListener('click', function () {
        closeOrgMoreSheet();
      });
    });
    document.querySelectorAll('.org-bottom-nav-link[data-org-route]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        closeOrgMoreSheet();
        const route = el.getAttribute('data-org-route') || 'dashboard';
        setRoute(route);
        if (route === 'dashboard' || route === 'team' || route === 'groups') refresh();
      });
    });
  }

  function setOrgBottomCount(id, n) {
    const el = document.getElementById(id);
    if (!el) return;
    if (n < 1) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = n > 99 ? '99+' : String(n);
  }

  function refreshOrgBottomEventsCount() {
    const apps = pendingApplicationsCount();
    const reviews = unrepliedReviewsList().length;
    let payment = 0;
    try {
      if (state.canManagePayments && paymentSetupStateFromDashboard().needsSetup) payment = 1;
    } catch (_) {
      /* ignore if payment helpers not ready */
    }
    setOrgBottomCount('org-bottom-events-count', apps + reviews + payment);
  }

  function refreshOrgBottomBusinessCount() {
    setOrgBottomCount('org-bottom-business-count', Number(state.opportunityEnquiriesNewCount) || 0);
  }

  function refreshOrgBottomMoreCount(noticeCount) {
    let notif = typeof noticeCount === 'number' ? noticeCount : 0;
    if (typeof noticeCount !== 'number') {
      const badge = document.getElementById('org-notifications-count');
      if (badge && !badge.hidden) {
        const parsed = parseInt(badge.textContent, 10);
        notif = Number.isFinite(parsed) ? parsed : badge.textContent ? 1 : 0;
      }
    }
    const teamPending = (state.teamMembers || []).filter(function (m) {
      return String(m.status || '').toLowerCase() === 'pending';
    }).length;
    setOrgBottomCount('org-bottom-more-count', notif + teamPending);
  }

  function renderOrganiserNotices() {
    const root = document.getElementById('org-notices');
    const emptyEl = document.getElementById('org-notifications-empty');
    const subEl = document.getElementById('org-notifications-sub');
    const notices = buildOrganiserNotices();

    updateNotificationsNavBadge(notices);
    updateReviewsReplyBadge();

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
        const emailEvent = btn.getAttribute('data-send-attendee-email');
        closeNotificationsPanel();
        if (emailEvent) {
          openAttendeeEmailForEvent(emailEvent);
          return;
        }
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

    const seriesGroupId = String(ev.seriesGroupId || '').trim();
    if (seriesGroupId) {
      return 'sg:' + seriesGroupId;
    }
    if (String(ev.duplicatedFromEventId || '').trim()) {
      return 'dup:' + String(ev.id || '');
    }
    const pattern = String(ev.recurrencePattern || '').trim().toLowerCase();
    const endDate = String(ev.recurrenceEndDate || '').trim().slice(0, 10);
    if (pattern && endDate) {
      return 'rec:' + groupId + '\0' + title + '\0' + pattern + '\0' + endDate;
    }
    const sameTitlePeers = allEvents.filter(function (peer) {
      if (eventOrganiserGroupId(peer) !== groupId) return false;
      if (String(peer.title || '').trim().toLowerCase() !== title) return false;
      if (String(peer.seriesGroupId || '').trim()) return false;
      if (String(peer.duplicatedFromEventId || '').trim()) return false;
      return true;
    });
    if (sameTitlePeers.length > 1) {
      return titleSeriesBucketKey(ev);
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
    const listing = String(ev.listingStatus || '').toLowerCase();
    const label = String(ev.statusLabel || '').trim().toLowerCase();
    return (
      st === 'cancelled' ||
      key === 'cancelled' ||
      listing === 'cancelled' ||
      label === 'cancelled'
    );
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

  function eventCanPromote(ev) {
    const resolved = resolveEventRecord(ev);
    if (!resolved || !resolved.id || isEventCancelled(resolved)) return false;
    if (isEventDraftListing(resolved)) return false;
    const key = String(resolved.statusKey || '').toLowerCase();
    const st = String(resolved.status || resolved.listingStatus || '').toLowerCase();
    return key === 'live' || st === 'published' || st === 'live';
  }

  function eventPromoteActionHtml(ev) {
    if (!eventCanPromote(ev)) return '';
    return (
      '<button type="button" class="org-action-item" data-promote-event="' +
      esc(ev.id) +
      '"><span class="org-action-icon">📣</span><span class="org-action-text"><strong>LinkedIn post</strong><span>Free picture and ready-made caption</span></span></button>'
    );
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

  function eventOrganiserConnectReady(ev) {
    const gid = ev && (ev.organiserId || ev.organiser_id);
    if (!gid) return false;
    const group = (state.groups || []).find(function (g) {
      return String(g.id) === String(gid);
    });
    return Boolean(group && group.stripeConnectReady);
  }

  function usesConnectPayoutFlow() {
    return Boolean(state.stripeConnectEnabled);
  }

  function renderRevenueConnectCopy() {
    const connect = usesConnectPayoutFlow();
    const readyLabel = document.getElementById('rev-stat-ready-label');
    const paidLabel = document.getElementById('rev-stat-paid-label');
    const payoutColLabel = document.getElementById('rev-payout-col-label');
    const payoutTip = document.getElementById('rev-payout-col-tip');
    const payoutInfo = document.getElementById('org-revenue-info-payout');
    const modalLead = document.getElementById('modal-payout-lead');

    if (readyLabel) {
      readyLabel.textContent = connect ? 'Events with sales' : 'Ready to request';
    }
    if (paidLabel) {
      paidLabel.textContent = connect ? 'Legacy payouts paid' : 'Paid out';
    }
    if (payoutColLabel) {
      payoutColLabel.textContent = connect ? 'Stripe status' : 'Payout';
    }
    if (payoutTip) {
      payoutTip.title = connect
        ? 'With Stripe Connect, ticket payments land in your connected account at checkout. Open Stripe Express to view balance, refunds, and bank payouts.'
        : 'Shows whether a payout was requested or paid. After an event ends and is archived, use Request payout when the net amount is above £1. If refunds are still processing, use Retry automatic refunds.';
    }
    if (payoutInfo) {
      payoutInfo.innerHTML = connect
        ? '<strong>Stripe Connect:</strong> paid ticket revenue goes to your connected Stripe account when attendees checkout — not to the Hub. Use <strong>Open Stripe dashboard</strong> above to view balance, issue refunds, and manage bank payouts. The column here shows legacy Hub payout requests (if any) or <strong>In Stripe</strong> for ticket sales.'
        : '<strong>Payout column:</strong> shows whether a payout was requested or paid. After an event ends it is archived automatically — then you can use <strong>Request payout</strong> when the net amount is above £1. If refunds are still processing, use <strong>Retry automatic refunds</strong>.';
    }
    if (modalLead) {
      modalLead.textContent = connect
        ? 'Manual Hub payouts are not used with Stripe Connect. Ticket revenue is already in your connected Stripe account.'
        : 'Request a manual Hub payout after your event is archived and the 7-day settlement period has passed.';
    }
  }

  function payoutStatusBadgeHtml(ev) {
    const key = ev.payoutStatusKey || (ev.payoutHeld ? 'held' : null);
    const label = ev.payoutStatusLabel || (ev.payoutHeld ? 'Held' : '—');
    if (key && label !== '—') {
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
    if (
      usesConnectPayoutFlow() &&
      eventOrganiserConnectReady(ev) &&
      (Number(ev.revenueNum) || 0) > 0 &&
      !ev.payoutHeld &&
      String(ev.statusKey || ev.status || '').toLowerCase() !== 'cancelled'
    ) {
      return '<span class="org-badge org-badge-green">In Stripe</span>';
    }
    return '<span class="org-payout-muted">—</span>';
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
    if (!usesConnectPayoutFlow() && ev.canRequestPayout && state.canManagePayments !== false) {
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
    const n = rating == null || rating === '' ? NaN : Number(rating);
    // Hub ratings are 1–5; 0 / null means no reviews yet — don't show a gold “0.0”.
    if (!Number.isFinite(n) || n <= 0) {
      return '<span class="org-rating org-rating--empty">No reviews</span>';
    }
    let tier = 'mid';
    if (n >= 4.5) tier = 'high';
    else if (n < 3.5) tier = 'low';
    return (
      '<span class="org-rating org-rating--' +
      tier +
      '" title="' +
      esc(n.toFixed(1)) +
      ' out of 5">' +
      '<span class="org-rating-star" aria-hidden="true">★</span> ' +
      esc(n.toFixed(1)) +
      '</span>'
    );
  }

  function unrepliedReviewsList() {
    return (state.reviews || []).filter(function (r) {
      return r && r.id && !String(r.reply || '').trim();
    });
  }

  function updateReviewsReplyBadge() {
    const unreplied = unrepliedReviewsList().length;
    const tabBadge = document.getElementById('org-events-tab-reviews-badge');
    if (tabBadge) {
      tabBadge.hidden = unreplied < 1;
      tabBadge.textContent = unreplied > 99 ? '99+' : unreplied > 1 ? String(unreplied) : 'Reply';
    }
    const navBadge = document.getElementById('org-pending-reviews-nav-badge');
    if (navBadge) {
      navBadge.hidden = unreplied < 1;
      // Same cue as the Reviews tab — “New” is too vague next to My events.
      navBadge.textContent = unreplied > 99 ? '99+' : unreplied > 1 ? String(unreplied) : 'Reply';
    }
    refreshOrgBottomEventsCount();
  }

  function actionMenuHtml(kind, id, title, item) {
    if (kind === 'group') {
      const statusKey = item && item.statusKey;
      const unpublishDisabled = statusKey === 'unpublished' || statusKey === 'draft';
      const blockingRegs = !unpublishDisabled ? publishedEventsWithRegistrationsForGroup(id) : [];
      const blockedByRegs = blockingRegs.length > 0;
      const unpublishBtn =
        unpublishDisabled || blockedByRegs
          ? '<button type="button" class="org-action-item danger" disabled><span class="org-action-icon">⊘</span><span class="org-action-text"><strong>Unpublish</strong><span>' +
            (statusKey === 'unpublished'
              ? 'Already unpublished'
              : statusKey === 'draft'
                ? 'Publish first to list on site'
                : blockingRegs.length === 1
                  ? 'Unpublish the event with registrations first'
                  : 'Unpublish events with registrations first') +
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
        '<a class="org-action-item" href="' +
        esc(groupPublicProfileUrl(id, item && item.slug)) +
        '" target="_blank" rel="noopener noreferrer"><span class="org-action-icon">↗</span><span class="org-action-text"><strong>View public profile</strong><span>See your group page and ranking badge</span></span></a>' +
        '<button type="button" class="org-action-item" data-org-goto-memberships="' +
        esc(id) +
        '"><span class="org-action-icon">👥</span><span class="org-action-text"><strong>Membership</strong><span>Upload members for members-only tickets</span></span></button>' +
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
      eventUnpublishActionHtml(ev) +
      '</div></div>'
    );
  }

  function eventUnpublishActionHtml(ev) {
    const id = ev && ev.id;
    if (!id) return '';
    const statusKey = String(ev.statusKey || ev.status || ev.listingStatus || '').toLowerCase();
    if (statusKey === 'unpublished') {
      return (
        '<button type="button" class="org-action-item" data-republish-event="' +
        esc(id) +
        '"><span class="org-action-icon">↻</span><span class="org-action-text"><strong>Republish</strong><span>List on the hub again</span></span></button>'
      );
    }
    if (statusKey === 'draft' || statusKey === 'cancelled' || statusKey === 'archived') {
      return (
        '<button type="button" class="org-action-item danger" disabled><span class="org-action-icon">⊘</span><span class="org-action-text"><strong>Unpublish</strong><span>Publish first to list on site</span></span></button>'
      );
    }
    return (
      '<button type="button" class="org-action-item danger" data-unpublish-event="' +
      esc(id) +
      '"><span class="org-action-icon">⊘</span><span class="org-action-text"><strong>Unpublish</strong><span>Hide from directory</span></span></button>'
    );
  }

  function eventIsCategoryExclusivity(ev) {
    if (!ev) return false;
    const mode = String(ev.attendanceMode || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    if (mode === 'category_exclusivity' || mode === 'osop') return true;
    if (ev.seriesEvents && ev.seriesEvents.length) {
      if (ev.seriesEvents.some((child) => eventIsCategoryExclusivity(child))) return true;
    }
    const ids = [ev.id]
      .concat(ev.seriesEventIds || [])
      .filter(Boolean);
    return ids.some((id) => Boolean(eventApplicationTicket(id)));
  }

  function eventIsPublishedListing(ev) {
    if (!ev) return false;
    const status = String(ev.status || '').toLowerCase();
    const key = String(ev.statusKey || '').toLowerCase();
    if (status === 'published' || status === 'live') return true;
    return key === 'live' || key === 'upcoming' || key === 'published' || key === 'archived';
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
      ev.alumniFastPassEnabled && eventIsPublishedListing(ev)
        ? '<button type="button" class="org-action-item" data-send-alumni-invites="' +
          esc(id) +
          '"><span class="org-action-icon">🎓</span><span class="org-action-text"><strong>Invite previous attendees</strong><span>Email past attendees a locked ticket link</span></span></button>'
        : '';
    const ceMemberItem =
      eventIsCategoryExclusivity(ev) && eventIsPublishedListing(ev)
        ? '<button type="button" class="org-action-item" data-send-ce-member-invites="' +
          esc(id) +
          '"><span class="org-action-icon">👥</span><span class="org-action-text"><strong>Invite members</strong><span>Email your Membership list — they book without applying</span></span></button>'
        : '';
    const connectionsItem =
      '<button type="button" class="org-action-item" data-send-attendee-email="' +
      esc(id) +
      '"><span class="org-action-icon">✉</span><span class="org-action-text"><strong>Attendee round-up</strong><span>Email who attended so guests can reconnect</span></span></button>';
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
      ceMemberItem +
      connectionsItem +
      '<button type="button" class="org-action-item" data-manage-tickets="' +
      esc(id) +
      '"><span class="org-action-icon">🎟️</span><span class="org-action-text"><strong>Ticket types</strong><span>Edit tiers and publish</span></span></button>' +
      eventPromoteActionHtml(ev) +
      '<button type="button" class="org-action-item" data-duplicate-event="' +
      esc(id) +
      '"><span class="org-action-icon">⧉</span><span class="org-action-text"><strong>Duplicate event</strong><span>Draft copy — add new dates &amp; publish</span></span></button>' +
      '<button type="button" class="org-action-item" data-org-goto-sub="events-revenue" data-filter-event="' +
      esc(id) +
      '"><span class="org-action-icon">£</span><span class="org-action-text"><strong>Revenue &amp; payout</strong><span>Request payout when eligible</span></span></button>' +
      alumniItem +
      cancelItem +
      deleteItem +
      eventUnpublishActionHtml(ev) +
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
    const hashRaw = (location.hash.replace('#', '') || '').trim();
    const hashParts = hashRaw.split('?');
    const hashRoute = String(hashParts[0] || '').toLowerCase();
    const hashParams = new URLSearchParams(hashParts[1] || '');
    const panel = String(params.get('panel') || '').trim().toLowerCase();
    const eventId = String(
      params.get('eventId') ||
        params.get('event_id') ||
        hashParams.get('eventId') ||
        hashParams.get('event_id') ||
        ''
    ).trim();
    // Prefer ?membershipGroup=…; also accept legacy #memberships?membershipGroup=…
    const membershipGroup = String(
      params.get('membershipGroup') ||
        params.get('membership_group') ||
        hashParams.get('membershipGroup') ||
        hashParams.get('membership_group') ||
        params.get('id') ||
        ''
    ).trim();
    const applications = String(
      params.get('applications') || hashParams.get('applications') || ''
    )
      .trim()
      .toLowerCase();
    const route = panel || hashRoute || '';
    return {
      route,
      eventId,
      membershipGroup,
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
    const { route, eventId, membershipGroup, pendingOnly } = parseDeepLinkFromUrl();
    if (eventId) {
      filters.attendeesEvent = eventId;
      filters.ticketsEvent = eventId;
      filters.cancellationsEvent = eventId;
    }
    if (membershipGroup) {
      filters.membershipsGroup = membershipGroup;
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
    if (filters.membershipsGroup) {
      setRoute('memberships');
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
    // Land on Overview so the checklist stays visible behind the explainer modal.
    setRoute('dashboard', { skipEventsGuard: true });
    openNeedsOrganiserPageModal();
  }

  function isOrganiserTourOpen() {
    return Boolean(
      document.body.classList.contains('org-onboard-active') ||
        (window.HubOrganiserOnboarding &&
          window.HubOrganiserOnboarding.isTourOpen &&
          window.HubOrganiserOnboarding.isTourOpen())
    );
  }

  function enforceEventsOrganiserGate() {
    if (!bootstrapReady || !needsOrganiserPageFirst() || isOrganiserTourOpen()) return;
    const onEventsPage = Boolean(document.querySelector('[data-org-page="events"].is-active'));
    if (onEventsPage || isEventsRoute(eventsSubRoute)) {
      redirectEventsToOrganiserSetup();
    }
  }

  function parseRoute() {
    const hashRaw = (location.hash.replace('#', '') || 'dashboard').trim();
    const hash = hashRaw.split('?')[0].toLowerCase();
    if (hash === 'business-list') return { page: 'business-list', sub: null };
    if (hash === 'opportunity-enquiries' || hash === 'business-enquiries') {
      return { page: 'business-overview', sub: 'business-enquiries' };
    }
    if (hash === 'business-insights') return { page: 'business-overview', sub: 'business-insights' };
    if (hash === 'business-guide') return { page: 'business-overview', sub: 'business-guide' };
    if (hash === 'business-overview' || hash === 'business-listings') {
      return { page: 'business-overview', sub: 'business-listings' };
    }
    if (hash === 'events-overview') return { page: 'events', sub: 'events-list' };
    if (hash === 'tickets') return { page: 'events', sub: 'events-tickets' };
    if (hash.startsWith('events-')) return { page: 'events', sub: hash };
    if (hash === 'events') return { page: 'events', sub: 'events-list' };
    if (isCommunicateRoute(hash)) {
      return { page: 'communicate', sub: null, openAttendeeEmail: true };
    }
    if (hash === 'academy' || hash.startsWith('academy-') || hash === 'training-overview') {
      return { page: 'dashboard', sub: null };
    }
    if (hash === 'team') return { page: 'team', sub: null };
    if (hash === 'member-lists' || hash === 'memberships') return { page: 'memberships', sub: null };
    if (hash === 'visibility' || hash === 'grow-visibility') {
      return { page: 'visibility', sub: null };
    }
    if (hash === 'leaderboard' || hash === 'rankings') {
      return { page: 'leaderboard', sub: null };
    }
    if (isSocialRoute(hash)) {
      const socialTab = socialTabFromRoute(hash);
      return {
        page: socialTab === 'spotlight' ? 'social-spotlight' : 'social',
        sub: null,
      };
    }
    return { page: hash, sub: null };
  }

  function setEventsSub(sub, options) {
    options = options || {};
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
      'events-tickets': ['Tickets', 'Overview of ticket tiers. Open an event → Set up tickets for members-only rates, Category Exclusivity, and guest visits.'],
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
        usesConnectPayoutFlow()
          ? 'Ticket sales per event. Paid tickets are collected in your connected Stripe account — open Stripe Express for balance and bank payouts.'
          : 'Ticket sales and payout status per event. Request a payout after an event has finished and been archived.',
      ],
    };
    const t = titles[eventsSubRoute] || titles['events-list'];
    const titleEl = document.getElementById('my-events-title');
    const subEl = document.getElementById('my-events-sub');
    if (titleEl) titleEl.textContent = t[0];
    if (subEl) subEl.textContent = t[1];

    if (!bootstrapReady) return Promise.resolve();

    if (eventsSubRoute === 'events-attendees') {
      fillAttendeesEventFilter();
      return ensureAttendeesLoaded().then(() => renderAttendees());
    }
    if (eventsSubRoute === 'events-cancellations') {
      fillCancellationsEventFilter();
      return loadCancellationsAll().then(() => {
        renderCancellations();
        updateMyEventsTabCounts();
      });
    }
    if (eventsSubRoute === 'events-reviews') {
      return ensureReviewsLoaded().then(() => renderReviews());
    }
    renderEventsPanel(eventsSubRoute);
    return ensureEventsLoaded().then(function () {
      renderEventsPanel(eventsSubRoute);
      maybePrefetchEvents();
    });
  }

  function invalidateEventsLoad() {
    eventsLoadGen += 1;
    eventsLoadingPromise = null;
    state.eventsLoading = false;
  }

  function ensureEventsLoaded(options) {
    const opts = options || {};
    const force = Boolean(opts.force);
    const wantFull = opts.full != null ? Boolean(opts.full) : eventsNeedFullEnrichment();
    if (
      state.eventsLoaded &&
      !force &&
      (wantFull ? state.eventsEnrichment === 'full' : state.eventsEnrichment !== 'none')
    ) {
      return Promise.resolve(true);
    }
    if (eventsLoadingPromise && !force) return eventsLoadingPromise;

    const loadGen = ++eventsLoadGen;
    state.eventsLoading = true;
    eventsLoadingPromise = api(eventsBootstrapQuery('', wantFull))
      .then(({ ok, data }) => {
        if (loadGen !== eventsLoadGen) return false;
        if (!ok) throw new Error(data.message || data.error || 'Could not load events');
        state.events = data.events || [];
        state.upcomingEvents = data.upcomingEvents || [];
        state.tickets = data.tickets || [];
        if (data.groups && data.groups.length) {
          state.groups = dedupeGroupsById(data.groups);
        }
        state.eventsTotal = data.eventsPagination?.total ?? state.events.length;
        state.eventsChunkOffset = data.eventsPagination?.offset ?? 0;
        state.eventsHasMore = Boolean(data.eventsPagination?.hasMore);
        state.eventsFullyLoaded = !state.eventsHasMore;
        state.eventsLoaded = true;
        state.eventsEnrichment = wantFull ? 'full' : 'lite';
        listPages.events = 1;
        listPages.tickets = 1;
        listPages.revenue = 1;
        renderStats();
        fillMyEventsFilters();
        fillEventSelect(document.getElementById('ticket-event'));
        if (document.querySelector('[data-org-page="groups"].is-active')) {
          renderGroups();
        }
        return true;
      })
      .catch((err) => {
        if (loadGen !== eventsLoadGen) return false;
        showOrganiserAlert(err.message || 'Could not load events', true);
        return false;
      })
      .finally(() => {
        if (loadGen === eventsLoadGen) {
          state.eventsLoading = false;
          eventsLoadingPromise = null;
        }
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
        renderOrganiserNotices();
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

  function eventsVisibleCount() {
    return eventsSourceList().filter(function (ev) {
      if (filters.eventsHideArchived !== false && eventRowIsArchived(ev)) return false;
      if (filters.eventsHideUnpublished && eventRowIsUnpublished(ev)) return false;
      return true;
    }).length;
  }

  function updateMyEventsTabCounts() {
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('tab-count-events', String(eventsVisibleCount()));
    set('tab-count-tickets', String(state.tickets.length));
    set('tab-count-reviews', String(state.reviews.length));
    updateReviewsReplyBadge();
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
      screeningIndustry: row.screeningIndustry || '',
      screeningJobTitle: row.screeningJobTitle || '',
    }));
  }

  let pendingApplicationsRefreshPromise = null;

  async function refreshPendingApplicationsSummary() {
    if (state.attendeesLoaded) {
      updatePendingApplicationsUi();
      return true;
    }
    if (pendingApplicationsRefreshPromise) return pendingApplicationsRefreshPromise;
    pendingApplicationsRefreshPromise = (async function () {
      try {
        const { ok, data } = await api('/api/organiser/attendees?view=pending-summary');
        if (!ok || !data) return false;
        const pending = data.pendingApplications || {};
        state.pendingApplicationsCount = Number(pending.count) || 0;
        state.pendingApplicationsPreview = pending.preview || [];
        updatePendingApplicationsUi();
        return true;
      } catch {
        return false;
      } finally {
        pendingApplicationsRefreshPromise = null;
      }
    })();
    return pendingApplicationsRefreshPromise;
  }

  function updatePendingApplicationsUi() {
    const badge = document.getElementById('org-pending-applications-nav-badge');
    const count = pendingApplicationsCount();
    if (badge) {
      badge.hidden = count < 1;
      badge.textContent = count > 99 ? '99+' : count > 1 ? String(count) : 'Review';
    }
    const tabBadge = document.getElementById('org-events-tab-applications-badge');
    if (tabBadge) {
      tabBadge.hidden = count < 1;
      tabBadge.textContent = count > 99 ? '99+' : count > 1 ? String(count) : 'Review';
    }
    refreshOrgBottomEventsCount();
    renderPendingApplicationsBanner();
    renderOrganiserNotices();
    renderHubPortalMeta();
  }

  function updatePendingApplicationsNavBadge() {
    updatePendingApplicationsUi();
  }

  function renderPendingApplicationsBanner() {
    const banner = document.getElementById('attendees-pending-banner');
    if (!banner) return;
    if (filters.attendeesView === 'archive') {
      banner.hidden = true;
      return;
    }
    const pending = pendingApplicationsList().filter((a) => {
      if (filters.attendeesEvent === 'all') return true;
      return a.eventId === filters.attendeesEvent;
    });
    if (!pending.length) {
      banner.hidden = true;
      banner.innerHTML = '';
      return;
    }
    const cards = pending
      .slice(0, 8)
      .map((a) => {
        const industry = String(a.screeningIndustry || '').trim();
        const jobTitle = String(a.screeningJobTitle || '').trim();
        const answers =
          industry || jobTitle
            ? '<div class="org-pending-app-card-answers">' +
              (industry
                ? '<span><strong>Industry</strong>' + esc(industry) + '</span>'
                : '') +
              (jobTitle
                ? '<span><strong>Job title</strong>' + esc(jobTitle) + '</span>'
                : '') +
              '</div>'
            : '';
        const actions = state.attendeesLoaded
          ? attendeeActionsHtml(a)
          : '<button type="button" class="org-applications-banner-cta" data-org-route="events-attendees" data-attendees-pending="1">Open to approve or decline</button>';
        return (
          '<div class="org-pending-app-card" data-pending-app="' +
          esc(a.id) +
          '">' +
          '<div class="org-pending-app-card-meta">' +
          '<span class="org-pending-app-card-name">' +
          esc(a.name || 'Applicant') +
          '</span>' +
          '<span class="org-pending-app-card-event">' +
          esc(a.eventTitle || 'Event') +
          '</span>' +
          '</div>' +
          answers +
          actions +
          '</div>'
        );
      })
      .join('');
    const more =
      pending.length > 8
        ? '<p>+' + String(pending.length - 8) + ' more applications waiting for a decision.</p>'
        : '';
    banner.innerHTML =
      '<p><strong>' +
      (pending.length === 1
        ? '1 Category Exclusivity application needs your decision'
        : pending.length + ' Category Exclusivity applications need your decision') +
      '</strong> — approve or decline below. Approved guests then get a payment link.</p>' +
      '<div class="org-pending-apps-list">' +
      cards +
      '</div>' +
      more;
    banner.hidden = false;
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
    if (n === 1) return '1st booking';
    return n + ' bookings';
  }

  function attendeeGroupRelationshipLabel(a) {
    const rel = String(a.groupRelationship || '').trim();
    if (rel === 'returning') return 'Returning';
    if (rel === 'new') return 'New to your group';
    return '';
  }

  function attendeeGroupRelationshipBadgeHtml(a) {
    const memberBadge = a.isRosterMember
      ? '<span class="org-badge org-badge-member" title="On your membership">Member</span>'
      : '';
    const n = attendeeVisitCount(a);
    if (n == null) {
      return memberBadge || '<span class="org-attendee-rel-unknown">—</span>';
    }
    const rel = String(a.groupRelationship || '').trim();
    const label = n === 1 ? '1st booking' : n + ' bookings';
    const cls = rel === 'new' ? 'org-badge-new' : 'org-badge-returning';
    const hint =
      a.isRosterMember
        ? ' title="Membership · ' +
          (n === 1 ? 'first event booking' : n + ' event bookings') +
          ' with your organiser page"'
        : rel === 'returning' && n > 1
          ? ' title="Including this booking — ' + n + ' Hub bookings with your organiser page"'
          : rel === 'new'
            ? ' title="First Hub booking with your organiser page"'
            : '';
    const visitBadge =
      '<span class="org-badge org-badge-visit ' +
      cls +
      '"' +
      hint +
      '>' +
      esc(label) +
      '</span>';
    return memberBadge
      ? '<span class="org-attendee-rel-stack">' + memberBadge + visitBadge + '</span>'
      : visitBadge;
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
      '<span class="org-attendees-summary-note">Event bookings register — membership is separate. Members on your membership still appear here when they book.</span>';
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
        a.screeningIndustry || a.rosterIndustry || a.businessSector || '',
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
    const industry = String(
      a.screeningIndustry || a.rosterIndustry || a.businessSector || ''
    ).trim();
    const jobTitle = String(a.screeningJobTitle || a.jobTitle || '').trim();
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

  function attendeeEventPublicUrl(a) {
    const eventId = String(a?.eventId || '').trim();
    const fromState = (state.events || []).find(function (ev) {
      return String(ev.id) === eventId;
    });
    const slug = String((fromState && fromState.slug) || a?.eventSlug || '').trim();
    if (slug) return '/events/' + encodeURIComponent(slug);
    if (eventId) return '/events/event?id=' + encodeURIComponent(eventId);
    return '/events/';
  }

  function attendeeActionsHtml(a) {
    if (String(a.applicationStatus || '') === 'Pending') {
      return (
        '<div class="org-application-review org-application-review--pending" data-review-id="' +
        esc(a.id) +
        '">' +
        '<div class="org-application-review-main">' +
        '<div class="org-application-review-copy">' +
        '<p class="org-application-review-label">Review application</p>' +
        '<p class="org-application-review-hint">Check industry and job title match your event rules, then approve or decline.</p>' +
        '</div>' +
        '<div class="org-application-review-buttons">' +
        '<button type="button" class="org-application-approve-btn" data-approve-application="' +
        esc(a.id) +
        '"><span class="org-application-btn-icon" aria-hidden="true">✓</span>Approve</button>' +
        '<button type="button" class="org-application-deny-btn" data-show-deny-form="' +
        esc(a.id) +
        '"><span class="org-application-btn-icon" aria-hidden="true">✕</span>Decline</button>' +
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
    const liveUrl = attendeeEventPublicUrl(a);
    return (
      '<a class="org-inline-link org-attendee-live-link" href="' +
      esc(liveUrl) +
      '" target="_blank" rel="noopener">View live</a>'
    );
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
    const connectionsBtn = document.getElementById('btn-email-attendee-list');
    if (connectionsBtn) {
      const eventId = String(filters.attendeesEvent || 'all');
      connectionsBtn.hidden = !eventId || eventId === 'all';
    }
    if (!body) return;
    renderAttendeesFilterNote();
    renderAttendeesArchiveNav();
    renderPendingApplicationsBanner();
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
      const isPendingApp = String(a.applicationStatus || '') === 'Pending';
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
        (isPendingApp
          ? '<span class="org-application-review-inline-hint">Approve or decline below</span>'
          : attendeeActionsHtml(a)) +
        '</td>';
      body.appendChild(tr);
      if (isPendingApp) {
        const reviewTr = document.createElement('tr');
        reviewTr.className = 'org-attendee-row-pending-review';
        reviewTr.innerHTML =
          '<td colspan="11" data-label="Review">' +
          '<div class="org-application-review-bar">' +
          attendeeActionsHtml(a) +
          '</div></td>';
        body.appendChild(reviewTr);
      }
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
        '<td class="org-td-name" data-label="Name">' +
        esc(row.name) +
        '</td><td data-label="Email">' +
        esc(row.email || '—') +
        '</td><td class="org-booking-ref" data-label="Booking ref">' +
        esc(bookingRef) +
        '</td><td data-label="Event">' +
        esc(eventLabelForRow(row)) +
        '</td><td data-label="Ticket">' +
        esc(row.ticketName) +
        '</td><td data-label="Paid">' +
        esc(row.amountDisplay || '—') +
        '</td><td data-label="Cancelled">' +
        esc(formatDateShort(row.cancelledAt)) +
        '</td><td data-label="Refund"><span class="' +
        refundClass +
        '">' +
        esc(row.refundLabel || '—') +
        '</span></td><td class="org-td-actions" data-label="Action">' +
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
    if (isEventCancelled(ev)) return true;
    const key = String(ev.statusKey || ev.status || ev.listingStatus || '').toLowerCase();
    if (key === 'archived') return true;
    return eventOccurrenceHasEnded(ev);
  }

  function eventRowIsUnpublished(ev) {
    if (!ev) return false;
    if (ev.isSeries && ev.seriesEvents && ev.seriesEvents.length) {
      return ev.seriesEvents.every(function (child) {
        return eventRowIsUnpublished(child);
      });
    }
    const key = String(ev.statusKey || ev.status || ev.listingStatus || '').toLowerCase();
    return key === 'unpublished';
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
    let list = eventsSourceList().slice();
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
    if (filters.eventsHideUnpublished) {
      list = list.filter((ev) => !eventRowIsUnpublished(ev));
    }
    list = groupEventsIntoSeries(list);
    if (filters.eventsHideArchived) {
      list = list.filter((ev) => !eventRowIsArchived(ev));
    }
    if (filters.eventsHideUnpublished) {
      list = list.filter((ev) => !eventRowIsUnpublished(ev));
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
          const liteQs = eventsNeedFullEnrichment() ? '' : '&eventsLite=1';
          const { ok, data } = await api(
            '/api/organiser/bootstrap?eventsOnly=1&eventsLimit=' +
              EVENTS_FETCH_SIZE +
              '&eventsOffset=' +
              offset +
              '&eventsTotal=' +
              String(state.eventsTotal || 0) +
              liteQs
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
  let eventDrawerLoadingShowRaf = null;
  let eventDrawerLoadingHideTimer = null;
  let eventDrawerCreateFlow = false;
  let eventDrawerProgressStep = '';
  let eventDrawerBackEventId = '';
  let eventDrawerBackTarget = '';

  function setEventDrawerBackButton(show, eventId, target) {
    const backBtn = document.getElementById('org-event-drawer-back');
    eventDrawerBackEventId = show && eventId ? String(eventId) : '';
    eventDrawerBackTarget = show && target ? String(target) : '';
    if (!backBtn) return;
    backBtn.hidden = !eventDrawerBackEventId;
    if (eventDrawerBackTarget === 'location') {
      backBtn.textContent = '← Location & access';
    } else if (eventDrawerBackTarget === 'details') {
      backBtn.textContent = '← Event details';
    } else {
      backBtn.textContent = '← Event details';
    }
  }

  function goBackFromEventDrawer() {
    if (!eventDrawerBackEventId) return;
    if (eventDrawerBackTarget === 'location') {
      openEventLocationDrawer(eventDrawerBackEventId, { fromTickets: true });
      return;
    }
    openEventEditorDrawer(eventDrawerBackEventId, { fromLocation: true });
  }

  const EVENT_DRAWER_PROGRESS_STEPS = [
    { id: 'details', label: 'Event details' },
    { id: 'location', label: 'Location & access' },
    { id: 'tickets', label: 'Set up tickets' },
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
      if (eventDrawerLoadingHideTimer) {
        clearTimeout(eventDrawerLoadingHideTimer);
        eventDrawerLoadingHideTimer = null;
      }
      if (on) {
        loading.hidden = false;
        loading.setAttribute('aria-hidden', 'false');
        loading.setAttribute('aria-busy', 'true');
        if (eventDrawerLoadingShowRaf) {
          cancelAnimationFrame(eventDrawerLoadingShowRaf);
        }
        eventDrawerLoadingShowRaf = requestAnimationFrame(function () {
          eventDrawerLoadingShowRaf = null;
          loading.classList.add('is-visible');
        });
      } else {
        if (eventDrawerLoadingShowRaf) {
          cancelAnimationFrame(eventDrawerLoadingShowRaf);
          eventDrawerLoadingShowRaf = null;
        }
        loading.classList.remove('is-visible');
        loading.setAttribute('aria-busy', 'false');
        eventDrawerLoadingHideTimer = setTimeout(function () {
          if (!loading.classList.contains('is-visible')) {
            loading.hidden = true;
            loading.setAttribute('aria-hidden', 'true');
          }
          eventDrawerLoadingHideTimer = null;
        }, 220);
      }
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
    eventDrawerProgressStep = '';
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
    refreshEmbedBootstrapCache();
    frame.onload = function () {
      sendEmbedBootstrapToFrame(frame);
      setTimeout(function () {
        sendEmbedBootstrapToFrame(frame);
      }, 120);
      setTimeout(function () {
        setEventDrawerLoading(false);
      }, 600);
    };
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
      mount.replaceChildren();
      return;
    }

    const currentIndex = EVENT_DRAWER_PROGRESS_STEPS.findIndex(function (s) {
      return s.id === stepId;
    });
    if (currentIndex < 0) {
      mount.hidden = true;
      mount.replaceChildren();
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
    const cancelRow = document.getElementById('org-event-drawer-cancel');
    if (drawerUi && drawerUi.progressStep) {
      eventDrawerProgressStep = drawerUi.progressStep;
    }
    const progressStep = eventDrawerCreateFlow && eventDrawerProgressStep ? eventDrawerProgressStep : null;
    renderEventDrawerProgress(progressStep);

    if (progressStep || !ev || !ev.id) {
      if (cancelRow) cancelRow.hidden = true;
      return;
    }
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

  function eventLocationFrameUrl(opts) {
    const frameParams = new URLSearchParams();
    frameParams.set('embed', '1');
    if (opts && opts.editId) {
      frameParams.set('id', opts.editId);
      if (opts.seriesEdit) frameParams.set('seriesEdit', '1');
      if (opts.seriesDate) frameParams.set('seriesDate', '1');
    }
    return '/organiser/event-location?' + frameParams.toString();
  }

  function openEventLocationDrawer(eventOrId, drawerOpts) {
    drawerOpts = drawerOpts || {};
    const drawer = document.getElementById('org-event-drawer');
    const frame = document.getElementById('org-event-drawer-frame');
    const titleEl = document.getElementById('org-event-drawer-title');
    const editId =
      typeof eventOrId === 'object' && eventOrId && eventOrId.id
        ? eventOrId.id
        : eventOrId || '';

    if (!drawer || !frame) {
      if (editId) {
        location.href = '/organiser/event-location?id=' + encodeURIComponent(editId);
      }
      return;
    }

    const ev =
      typeof eventOrId === 'object' && eventOrId && eventOrId.title
        ? eventOrId
        : findEventById(editId);
    const drawerTitle = ev && ev.title ? 'Location: ' + ev.title : 'Location & access';
    const frameOpts = { editId: editId };
    if (drawerOpts.seriesEdit) frameOpts.seriesEdit = true;
    if (drawerOpts.seriesDate) frameOpts.seriesDate = true;
    const frameUrl = eventLocationFrameUrl(frameOpts);
    setEventDrawerBackButton(true, editId, 'details');
    openEventDrawerFrame(frameUrl, drawerTitle, null, { progressStep: 'location' });
  }

  function openEventTicketsDrawer(eventIds, title) {
    const label = title ? 'Tickets: ' + title : 'Set up tickets';
    const drawerUi = eventDrawerCreateFlow ? { progressStep: 'tickets' } : null;
    const backId = Array.isArray(eventIds) && eventIds.length ? eventIds[0] : '';
    setEventDrawerBackButton(Boolean(backId), backId, 'location');
    openEventDrawerFrame(eventTicketsFrameUrl(eventIds), label, null, drawerUi);
  }

  function openEventEditorDrawer(eventOrId, drawerOpts) {
    drawerOpts = drawerOpts || {};
    ensureEventEditCss().catch(function () {
      /* non-fatal */
    });
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
      if (!drawerOpts.fromTickets && !drawerOpts.fromLocation) {
        eventDrawerCreateFlow = false;
      }
      const ev =
        typeof eventOrId === 'object' && eventOrId && eventOrId.title
          ? eventOrId
          : findEventById(editId);
      if (!ev || !ev.id) {
        if ((drawerOpts.fromTickets || drawerOpts.fromLocation) && editId) {
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
        eventDrawerCreateFlow && (drawerOpts.fromTickets || drawerOpts.fromLocation)
          ? { progressStep: 'details' }
          : null;
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
    const confirmBtn = document.getElementById('btn-event-delete-confirm');
    if (confirmBtn) confirmBtn.disabled = false;
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

  function removeEventFromClientState(eventId) {
    const id = String(eventId || '').trim();
    if (!id) return;
    const keepEvent = function (ev) {
      return ev && String(ev.id) !== id;
    };
    state.events = (state.events || []).filter(keepEvent);
    state.upcomingEvents = (state.upcomingEvents || []).filter(keepEvent);
    state.eventSummaries = (state.eventSummaries || []).filter(keepEvent);
    state.tickets = (state.tickets || []).filter(function (t) {
      return t && String(t.eventId) !== id;
    });
    if (state.eventsTotal > 0) state.eventsTotal -= 1;
  }

  async function refreshEventsWorkspaceAfterMutation(options) {
    const opts = options || {};
    closeAllActionMenus();
    endOrgRouteLoading({ gen: orgRouteLoadGen, startedAt: 0 });
    try {
      await loadBootstrap({ silent: true });
    } catch (err) {
      showOrganiserAlert(
        (err && err.message) || 'Could not refresh the workspace. Try reloading the page.',
        true
      );
    }
    pruneStaleEventFilters();
    await ensureEventsLoaded({ force: true });
    if (document.querySelector('[data-org-page="events"].is-active')) {
      renderMyEventsHub();
    } else {
      renderAll();
    }
    setRoute(opts.route || 'events-list', { skipRouteLoading: true });
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
    removeEventFromClientState(eventId);
    if (document.querySelector('[data-org-page="events"].is-active')) {
      renderMyEventsHub();
    }
    await refreshEventsWorkspaceAfterMutation({ route: 'events-list' });
    if (confirmBtn) confirmBtn.disabled = false;
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

  function openGroupEditorDrawer(groupOrId, options) {
    options = options || {};
    const drawer = document.getElementById('org-group-drawer');
    const onboardLaunch = Boolean(options.onboardLaunch);
    const onboardReview = Boolean(options.onboardReview || options.onboardLaunch);
    if (!drawer || !window.HubGroupEdit) {
      const id =
        typeof groupOrId === 'object' && groupOrId && groupOrId.id
          ? groupOrId.id
          : groupOrId || '';
      if (onboardLaunch || onboardReview) {
        location.href = id
          ? (window.HubOrganiserLaunchSetup && window.HubOrganiserLaunchSetup.profileEditUrl
              ? window.HubOrganiserLaunchSetup.profileEditUrl(id)
              : '/organiser/group-edit?id=' + encodeURIComponent(id) + '&onboard=launch')
          : '/organiser/group-edit';
        return;
      }
      location.href = id
        ? '/organiser/group-edit?id=' +
          encodeURIComponent(id) +
          (options.focusBrand ? '#ge-brand-fields' : '')
        : '/organiser/group-edit';
      return;
    }

    closeAllActionMenus();
    hideGroupClaimModal();
    hideOpportunityClaimModal();
    const editId =
      typeof groupOrId === 'object' && groupOrId && groupOrId.id
        ? groupOrId.id
        : groupOrId || '';

    const refreshAfterSave = async function () {
      brandKitHydratedGroupId = null;
      await loadBootstrap({ silent: true, skipClaimUi: true });
      renderAll();
      if (isSocialPageActive()) ensureBrandKitPanelReady();
    };

    if (!groupEditReady) {
      window.HubGroupEdit.init({
        root: drawer,
        embedded: true,
        onClose: closeGroupEditorDrawer,
        onSaved: refreshAfterSave,
        onContinue: async function (saved) {
          await refreshAfterSave();
          requestAnimationFrame(function () {
            handleGroupContinueToEvent(saved);
          });
        },
      });
      groupEditReady = true;
    }

    window.HubGroupEdit.open({
      editId,
      embedded: true,
      onboardLaunch: onboardLaunch,
      onboardReview: onboardReview,
      focusBrand: Boolean(options.focusBrand),
      onClose: closeGroupEditorDrawer,
      onSaved: refreshAfterSave,
      onContinue: async function (saved) {
        await refreshAfterSave();
        requestAnimationFrame(function () {
          if (onboardLaunch || onboardReview) {
            continueAfterClaimProfileSave(saved);
            return;
          }
          handleGroupContinueToEvent(saved);
        });
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
    return paginateList(list, page);
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

  function publishedEventsWithRegistrationsForGroup(groupId) {
    const gid = String(groupId || '').trim();
    if (!gid) return [];
    return (state.events || []).filter(function (ev) {
      if (String(eventOrganiserGroupId(ev) || '').trim() !== gid) return false;
      if (!eventIsPublishedListing(ev)) return false;
      if (isEventCancelled(ev)) return false;
      if (Boolean(ev.locked)) return true;
      return eventEffectiveTicketsSold(ev) > 0;
    });
  }

  async function confirmUnpublishGroup(groupId) {
    if (!groupId) return;
    const g = findGroupById(groupId);
    const label = g && g.name ? g.name : 'this group';
    const blocking = publishedEventsWithRegistrationsForGroup(groupId);
    if (blocking.length) {
      const firstTitle = String(blocking[0].title || 'an event').trim();
      window.alert(
        blocking.length === 1
          ? '"' +
              firstTitle +
              '" still has registrations. Unpublish that event first, then unpublish this group.'
          : 'This group has ' +
              blocking.length +
              ' live events with registrations. Unpublish those events first, then unpublish this group.'
      );
      return;
    }
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

  async function confirmUnpublishEvent(eventId) {
    if (!eventId) return;
    const ev = (state.events || []).find((e) => e.id === eventId) || { id: eventId };
    const label = ev.title || 'this event';
    const ok = window.confirm(
      'Unpublish "' +
        label +
        '"?\n\n' +
        'This event will be removed from Browse events immediately. Existing bookings stay in your dashboard.'
    );
    if (!ok) return;

    const res = await api('/api/organiser/events', {
      method: 'POST',
      body: JSON.stringify({ action: 'unpublish', id: eventId }),
    });
    if (!res.ok) {
      window.alert(res.data.message || res.data.error || 'Could not unpublish this event.');
      return;
    }
    await loadBootstrap();
    renderAll();
  }

  async function confirmRepublishEvent(eventId) {
    if (!eventId) return;
    const ev = (state.events || []).find((e) => e.id === eventId) || { id: eventId };
    const label = ev.title || 'this event';
    const ok = window.confirm(
      'Republish "' +
        label +
        '"?\n\n' +
        'This event will appear on Browse events again and ticket sales will resume if tiers are still on sale.'
    );
    if (!ok) return;

    const res = await api('/api/organiser/events', {
      method: 'POST',
      body: JSON.stringify({ action: 'republish', id: eventId }),
    });
    if (!res.ok) {
      window.alert(res.data.message || res.data.error || 'Could not republish this event.');
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
      m.style.maxHeight = '';
      m.style.overflowY = '';
      m.style.webkitOverflowScrolling = '';
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
    menu.style.overflowY = 'auto';
    menu.style.webkitOverflowScrolling = 'touch';

    const pad = 12;
    const maxH = Math.min(window.innerHeight - pad * 2, 420);
    menu.style.maxHeight = maxH + 'px';

    const rect = toggle.getBoundingClientRect();
    const menuW = Math.min(menu.offsetWidth || 260, window.innerWidth - pad * 2);
    // Use capped height so positioning keeps the menu on-screen and scrollable.
    const menuH = Math.min(menu.scrollHeight || 200, maxH);

    let top = rect.bottom + 6;
    let left = rect.right - menuW;
    if (top + menuH > window.innerHeight - pad) {
      const above = rect.top - menuH - 6;
      if (above >= pad) top = above;
      else top = pad;
    }
    if (left < pad) left = pad;
    if (left + menuW > window.innerWidth - pad) {
      left = window.innerWidth - menuW - pad;
    }
    // Re-clamp height to whatever space remains below the chosen top.
    const availBelow = window.innerHeight - top - pad;
    menu.style.maxHeight = Math.max(160, Math.min(maxH, availBelow)) + 'px';

    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
    menu.style.right = 'auto';
    menu.style.bottom = 'auto';
    menu.style.visibility = '';
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

    const unpublishEventBtn = e.target.closest('[data-unpublish-event]');
    if (unpublishEventBtn && !unpublishEventBtn.disabled) {
      e.preventDefault();
      e.stopPropagation();
      closeAllActionMenus();
      confirmUnpublishEvent(unpublishEventBtn.getAttribute('data-unpublish-event'));
      return true;
    }

    const republishEventBtn = e.target.closest('[data-republish-event]');
    if (republishEventBtn && !republishEventBtn.disabled) {
      e.preventDefault();
      e.stopPropagation();
      closeAllActionMenus();
      confirmRepublishEvent(republishEventBtn.getAttribute('data-republish-event'));
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

    const promoteEventBtn = e.target.closest('[data-promote-event]');
    if (promoteEventBtn && !promoteEventBtn.disabled) {
      e.preventDefault();
      e.stopPropagation();
      closeAllActionMenus();
      const eid = promoteEventBtn.getAttribute('data-promote-event');
      if (eid) {
        setRoute('social');
        ensureLinkedInPostBuilder({ force: true });
        if (linkedInPostBuilder && linkedInPostBuilder.prefillEvent) {
          linkedInPostBuilder.prefillEvent(eid);
        }
        showOrganiserAlert('LinkedIn post ready — pick a picture style, then copy and share.', false);
      }
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

    const ceMemberInvitesBtn = e.target.closest('[data-send-ce-member-invites]');
    if (ceMemberInvitesBtn && !ceMemberInvitesBtn.disabled) {
      e.preventDefault();
      e.stopPropagation();
      closeAllActionMenus();
      const eid = ceMemberInvitesBtn.getAttribute('data-send-ce-member-invites');
      if (eid) openCeMemberInvitesModal(eid);
      return true;
    }

    const connectionsEmailBtn = e.target.closest('[data-send-attendee-email]');
    if (connectionsEmailBtn && !connectionsEmailBtn.disabled) {
      e.preventDefault();
      e.stopPropagation();
      closeAllActionMenus();
      const eid = connectionsEmailBtn.getAttribute('data-send-attendee-email');
      if (eid) openAttendeeEmailForEvent(eid);
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

    const membershipsBtn = e.target.closest('[data-org-goto-memberships]');
    if (membershipsBtn && !membershipsBtn.disabled) {
      e.preventDefault();
      e.stopPropagation();
      closeAllActionMenus();
      const groupId = membershipsBtn.getAttribute('data-org-goto-memberships');
      if (groupId) filters.membershipsGroup = groupId;
      setRoute('memberships');
      return true;
    }

    return false;
  }

  let pendingPayoutEventId = null;
  let pendingAlumniInviteEventId = null;
  let pendingCeMemberInviteEventId = null;
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

  function closeCeMemberInvitesModal() {
    pendingCeMemberInviteEventId = null;
    const modal = document.getElementById('modal-ce-member-invites');
    if (modal) modal.hidden = true;
    const errEl = document.getElementById('modal-ce-member-invites-error');
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    const sendBtn = document.getElementById('modal-ce-member-invites-send');
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send member invites';
    }
  }

  async function openCeMemberInvitesModal(eventId) {
    pendingCeMemberInviteEventId = eventId;
    const modal = document.getElementById('modal-ce-member-invites');
    const titleEl = document.getElementById('modal-ce-member-invites-event');
    const statsEl = document.getElementById('modal-ce-member-invites-stats');
    const errEl = document.getElementById('modal-ce-member-invites-error');
    const sendBtn = document.getElementById('modal-ce-member-invites-send');
    if (!modal) return;

    const ev = findEventById(eventId);
    if (titleEl) titleEl.textContent = ev ? ev.title : 'Event';
    if (statsEl) {
      statsEl.hidden = false;
      statsEl.textContent = 'Loading membership list…';
    }
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    if (sendBtn) sendBtn.disabled = true;
    openModal('modal-ce-member-invites');

    const { ok, data } = await api(
      '/api/organiser/ce-member-invites?eventId=' + encodeURIComponent(eventId)
    );
    if (!ok) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = data.message || data.error || 'Could not load member invite preview';
      }
      if (statsEl) statsEl.hidden = true;
      return;
    }

    const count = Number(data.activeMemberCount) || 0;
    const price =
      data.ticket && data.ticket.price != null ? Number(data.ticket.price) : null;
    const priceLabel =
      price != null && Number.isFinite(price)
        ? price > 0
          ? '£' + price.toFixed(2)
          : 'Free'
        : '';
    const already = data.stats || {};
    if (statsEl) {
      statsEl.hidden = false;
      statsEl.textContent =
        count === 0
          ? 'No active members on your Membership list yet. Add people under Memberships, then return here.'
          : count +
            ' active member' +
            (count === 1 ? '' : 's') +
            ' can be invited' +
            (priceLabel ? ' · seat ' + priceLabel : '') +
            (already.sent || already.redeemed
              ? ' · already invited: ' +
                ((already.sent || 0) + (already.redeemed || 0))
              : '');
    }
    if (sendBtn) sendBtn.disabled = count === 0;
  }

  async function submitCeMemberInvites() {
    if (!pendingCeMemberInviteEventId) return;
    const errEl = document.getElementById('modal-ce-member-invites-error');
    const sendBtn = document.getElementById('modal-ce-member-invites-send');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending…';
    }
    const { ok, data } = await api('/api/organiser/ce-member-invites', {
      method: 'POST',
      body: JSON.stringify({ eventId: pendingCeMemberInviteEventId }),
    });
    if (!ok) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = data.message || data.error || 'Could not send member invites';
      }
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send member invites';
      }
      return;
    }
    closeModals();
    showOrganiserAlert(data.message || 'Member invites sent.', false);
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
            ? 'Click Add bank details above to connect Stripe — it opens in a new tab.'
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
          'Ticket payments go to your connected account at checkout. Issue refunds, view balance, and manage bank payouts in Stripe Express.';
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
          'Required before you can sell paid tickets or open the Stripe dashboard. Opens Stripe in a new tab.';
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
      const revenueTabBadge = document.getElementById('org-events-tab-revenue-badge');
      if (revenueTabBadge) revenueTabBadge.hidden = true;
      const legacyBanner = document.getElementById('stripe-connect-banner');
      if (legacyBanner) {
        legacyBanner.hidden = true;
        legacyBanner.innerHTML = '';
      }
      refreshOrgBottomEventsCount();
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
    const revenueTabBadge = document.getElementById('org-events-tab-revenue-badge');
    if (revenueTabBadge) {
      revenueTabBadge.hidden = !setupState.needsSetup;
      revenueTabBadge.textContent = navBadge ? navBadge.textContent : 'Setup';
    }
    refreshOrgBottomEventsCount();

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
      const dashPay = document.getElementById('org-payment-setup-dashboard');
      if (
        dashPay &&
        ((state.pendingClaimGroups || []).length > 0 || isLaunchSetupInProgress())
      ) {
        dashPay.hidden = true;
        dashPay.innerHTML = '';
      } else {
        payment.renderInto(dashPay, setupState, group, {
          returnPath: '/organiser/#dashboard',
          compact: true,
          title: 'Add bank details to receive payouts',
          lead: 'Connect Stripe so ticket revenue can reach you after each event.',
        });
      }
    }

    renderRevenueStripeBar();
    renderRevenueConnectCopy();
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
    if ((state.pendingClaimOpportunities || []).length > 0 && !state.organiserAccess) return;
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

  function dedupeGroupsById(groups) {
    const seen = new Set();
    const out = [];
    (groups || []).forEach(function (g) {
      if (!g || !g.id || seen.has(g.id)) return;
      seen.add(g.id);
      out.push(g);
    });
    return out;
  }

  function normalizeGroupDisplayKey(g) {
    const slug = String((g && g.slug) || '')
      .trim()
      .toLowerCase();
    if (slug) return slug;
    return String((g && g.name) || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function groupMembershipPriority(g) {
    const summary = (g && g.rosterSummary) || {};
    const active = Number(summary.active) || 0;
    const events = Number(g.eventsListed) || 0;
    const created = g.createdAt ? new Date(g.createdAt).getTime() : 0;
    return active * 10000 + events * 100 + created / 1e6;
  }

  /** One chooser row per slug/name — keeps the group with the most members/events. */
  function dedupeGroupsForMembership(groups) {
    const byKey = new Map();
    dedupeGroupsById(groups).forEach(function (g) {
      const key = normalizeGroupDisplayKey(g) || g.id;
      const prev = byKey.get(key);
      if (!prev || groupMembershipPriority(g) > groupMembershipPriority(prev)) {
        byKey.set(key, g);
      }
    });
    return [...byKey.values()];
  }

  function memberListGroups(preferredId) {
    const list = dedupeGroupsForMembership(state.groups);
    const wanted = String(preferredId || filters.membershipsGroup || '').trim();
    if (wanted && !list.some(function (g) { return g.id === wanted; })) {
      const raw = findGroupById(wanted);
      if (raw) list.push(raw);
    }
    return list;
  }

  function memberRosterUrl(groupId) {
    const id = encodeURIComponent(groupId);
    return '/organiser/?membershipGroup=' + id + '#memberships';
  }

  function maybeRedirectToSingleMemberList() {
    return false;
  }

  function membershipsRosterAppearsPainted() {
    if (
      window.OrganiserMemberRoster &&
      typeof window.OrganiserMemberRoster.appearsPainted === 'function'
    ) {
      return window.OrganiserMemberRoster.appearsPainted();
    }
    const tbody = document.getElementById('omr-body');
    const empty = document.getElementById('omr-empty');
    return Boolean(tbody && (tbody.children.length > 0 || (empty && !empty.hidden)));
  }

  function membershipsRosterLoading() {
    const hint = document.getElementById('omr-load-hint');
    return Boolean(hint && !hint.hidden);
  }

  function membershipSummaryLine(g) {
    const summary = g && g.rosterSummary ? g.rosterSummary : null;
    if (!summary || !summary.active) {
      return 'No members yet — upload for members-only tickets';
    }
    const parts = [summary.active + (summary.active === 1 ? ' member' : ' members')];
    if (summary.unclaimed > 0) {
      parts.push(summary.unclaimed + ' not signed up');
    }
    if (summary.expiringSoon > 0) {
      parts.push(summary.expiringSoon + ' expiring soon');
    }
    return parts.join(' · ');
  }

  function membershipGroupOptionLabel(g) {
    return g.name || 'Organiser page';
  }

  function preferredMembershipGroupId(groups, preferredId) {
    const list = (groups || []).slice().sort(function (a, b) {
      return groupMembershipPriority(b) - groupMembershipPriority(a);
    });
    if (!list.length) return '';
    const wanted = String(preferredId || '').trim();
    if (wanted) {
      const match = list.find(function (g) {
        return g.id === wanted;
      });
      // Honour an explicit deep-link / switcher choice even when the roster is empty.
      if (match) return match.id;
    }
    return list[0].id;
  }

  function fillMembershipsGroupFilter() {
    const sel = document.getElementById('filter-memberships-group');
    if (!sel) return;
    const groups = memberListGroups()
      .slice()
      .sort(function (a, b) {
        return groupMembershipPriority(b) - groupMembershipPriority(a);
      });
    const prev = filters.membershipsGroup || sel.value || '';
    if (!groups.length) {
      sel.replaceChildren();
      filters.membershipsGroup = '';
      return;
    }
    const nextId = preferredMembershipGroupId(groups, prev);
    const options = groups.map(function (g) {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = membershipGroupOptionLabel(g);
      return opt;
    });
    sel.replaceChildren(...options);
    filters.membershipsGroup = nextId;
    sel.value = nextId;
    updateMembershipPageCard(nextId);
  }

  function updateMembershipPageCard(groupId, summaryOverride) {
    const card = document.getElementById('memberships-page-card');
    const nameEl = document.getElementById('memberships-page-name');
    const metaEl = document.getElementById('memberships-page-meta');
    const avatarEl = document.getElementById('memberships-page-avatar');
    const viewEl = document.getElementById('memberships-page-view');
    const editEl = document.getElementById('memberships-page-edit');
    const sel = document.getElementById('filter-memberships-group');
    if (!card) return;

    const g = findGroupById(groupId);
    if (!g) {
      card.hidden = true;
      return;
    }

    const groups = memberListGroups();
    const multi = groups.length > 1;
    card.hidden = false;

    if (nameEl) {
      nameEl.textContent = g.name || 'Organiser page';
      nameEl.hidden = multi;
    }
    if (sel) sel.hidden = !multi;

    if (metaEl) {
      metaEl.textContent = membershipSummaryLine(
        summaryOverride ? { rosterSummary: summaryOverride } : g
      );
    }

    if (avatarEl) {
      if (g.imageUrl) {
        avatarEl.innerHTML =
          '<img src="' + esc(g.imageUrl) + '" alt="" loading="lazy" decoding="async">';
        avatarEl.classList.add('has-image');
      } else {
        avatarEl.textContent = groupInitial(g.name);
        avatarEl.classList.remove('has-image');
      }
    }

    if (viewEl) {
      viewEl.href = groupPublicProfileUrl(g.id, g.slug);
      viewEl.hidden = g.statusKey === 'draft';
    }
    if (editEl) {
      editEl.setAttribute('data-edit-group', g.id);
      editEl.disabled = !g.id;
    }
  }

  window.updateMembershipPageCard = updateMembershipPageCard;

  function updateMembershipNetworkSummary() {
    const el = document.getElementById('memberships-network-summary');
    if (!el) return;
    const groups = memberListGroups();
    if (!state.canManageTeam || groups.length < 2) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    let totalMembers = 0;
    let chaptersWithMembers = 0;
    groups.forEach(function (g) {
      const active = Number(g.rosterSummary && g.rosterSummary.active) || 0;
      if (active > 0) {
        totalMembers += active;
        chaptersWithMembers += 1;
      }
    });
    let revenueLine = '';
    if (hasComputedWorkspaceSummary()) {
      revenueLine =
        ' · ' + formatGbpAmount(state.workspaceSummary.totalRevenue) + ' ticket revenue (all pages)';
    }
    el.hidden = false;
    el.textContent =
      'HQ network: ' +
      groups.length +
      ' organiser pages · ' +
      totalMembers +
      ' members across ' +
      chaptersWithMembers +
      ' chapter' +
      (chaptersWithMembers === 1 ? '' : 's') +
      revenueLine;
  }

  function updateMembershipGroupMeta(groupId) {
    /* Summary now shown under Member register heading (omr-count). */
  }

  function syncMembershipGroupUrl() {
    const url = new URL(window.location.href);
    if (filters.membershipsGroup) {
      url.searchParams.set('membershipGroup', filters.membershipsGroup);
    } else {
      url.searchParams.delete('membershipGroup');
      url.searchParams.delete('membership_group');
    }
    const next = url.pathname + url.search + url.hash;
    if (window.location.pathname + window.location.search + window.location.hash !== next) {
      history.replaceState(null, '', next);
    }
  }

  function setMembershipsPageLoading(on, label) {
    const loading = document.getElementById('member-lists-loading');
    const workspace = document.getElementById('memberships-workspace');
    const empty = document.getElementById('member-lists-empty');
    if (loading) {
      loading.hidden = !on;
      loading.setAttribute('aria-busy', on ? 'true' : 'false');
      const labelEl = loading.querySelector('span');
      if (labelEl && label) labelEl.textContent = label;
    }
    if (on) {
      if (empty) empty.hidden = true;
      if (workspace) workspace.hidden = true;
    }
  }

  function renderMembershipsPage() {
    const workspace = document.getElementById('memberships-workspace');
    const empty = document.getElementById('member-lists-empty');
    if (!workspace) return;

    if (!bootstrapReady) {
      setMembershipsPageLoading(true, 'Loading membership…');
      return;
    }

    const groups = memberListGroups();
    if (!groups.length) {
      setMembershipsPageLoading(false);
      if (empty) empty.hidden = false;
      workspace.hidden = true;
      filters.membershipsGroup = '';
      return;
    }

    if (empty) empty.hidden = true;

    const groupId = filters.membershipsGroup;
    const needsRosterLoad =
      groupId &&
      (membershipsRosterLoadedFor !== groupId || !membershipsRosterAppearsPainted());

    if (needsRosterLoad) {
      setMembershipsPageLoading(true, 'Loading membership…');
    } else {
      setMembershipsPageLoading(false);
      workspace.hidden = false;
    }

    fillMembershipsGroupFilter();
    updateMembershipNetworkSummary();
    updateMembershipPageCard(filters.membershipsGroup);
    syncMembershipGroupUrl();

    const sel = document.getElementById('filter-memberships-group');
    if (sel && sel.dataset.membershipsBound !== '1') {
      sel.dataset.membershipsBound = '1';
      sel.addEventListener('change', function () {
        filters.membershipsGroup = sel.value || '';
        membershipsRosterLoadedFor = '';
        updateMembershipPageCard(filters.membershipsGroup);
        syncMembershipGroupUrl();
        setMembershipsPageLoading(true, 'Loading membership…');
        ensureMemberRosterAssets()
          .then(function () {
            workspace.hidden = false;
            setMembershipsPageLoading(false);
            if (window.OrganiserMemberRoster && typeof window.OrganiserMemberRoster.setLoading === 'function') {
              window.OrganiserMemberRoster.setLoading(true);
            }
            if (window.OrganiserMemberRoster && typeof window.OrganiserMemberRoster.loadForGroup === 'function') {
              return window.OrganiserMemberRoster.loadForGroup(filters.membershipsGroup);
            }
          })
          .then(function () {
            if (filters.membershipsGroup && membershipsRosterAppearsPainted()) {
              membershipsRosterLoadedFor = filters.membershipsGroup;
            }
          })
          .catch(function (err) {
            membershipsRosterLoadedFor = '';
            setMembershipsPageLoading(false);
            workspace.hidden = false;
            showOrganiserAlert(err.message || 'Could not load membership', true);
          });
      });
    }

    ensureMemberRosterAssets()
      .then(function () {
        const roster = window.OrganiserMemberRoster;
        if (!roster) return;
        if (filters.membershipsGroup !== groupId) return;
        workspace.hidden = false;
        setMembershipsPageLoading(false);
        const selectedGroup = findGroupById(groupId);
        if (
          selectedGroup &&
          selectedGroup.rosterSummary &&
          typeof roster.setGroupRosterSummary === 'function'
        ) {
          roster.setGroupRosterSummary(groupId, selectedGroup.rosterSummary);
        }
        if (typeof roster.bindControls === 'function') roster.bindControls();
        if (groupId && typeof roster.setActiveGroupId === 'function') roster.setActiveGroupId(groupId);

        const shouldLoad =
          typeof roster.loadForGroup === 'function' &&
          groupId &&
          (membershipsRosterLoadedFor !== groupId ||
            !membershipsRosterAppearsPainted() ||
            (typeof roster.getActiveGroupId === 'function' && roster.getActiveGroupId() !== groupId));

        if (shouldLoad) {
          if (typeof roster.setLoading === 'function') roster.setLoading(true);
          return roster.loadForGroup(groupId).then(function () {
            if (groupId === filters.membershipsGroup && membershipsRosterAppearsPainted()) {
              membershipsRosterLoadedFor = groupId;
            }
          });
        }
        if (typeof roster.clearStuckLoading === 'function') roster.clearStuckLoading();
      })
      .catch(function (err) {
        membershipsRosterLoadedFor = '';
        setMembershipsPageLoading(false);
        workspace.hidden = false;
        showOrganiserAlert(err.message || 'Could not load membership', true);
      });
  }

  async function navigateToMemberships() {
    if (!bootstrapReady) {
      try {
        await loadBootstrap({ silent: true });
      } catch (e) {
        showOrganiserAlert('Could not load organiser pages. Please try again.', true);
        return;
      }
    }
    if (maybeRedirectToSingleMemberList()) return;
    const groups = memberListGroups();
    if (!groups.length) {
      setRoute('groups');
      showOrganiserAlert(
        'Create an organiser page first, then open <strong>Membership</strong> from that row.',
        false
      );
      return;
    }
    setRoute('memberships');
  }

  function sidebarRouteForPage(page, sub) {
    if (page === 'events-overview') return 'events-list';
    if (page === 'business-overview') return 'business-overview';
    if (page === 'business-list') return 'business-list';
    if (page === 'events') {
      return 'events-list';
    }
    // Grow visibility + Top groups live under Promote now.
    if (page === 'visibility' || page === 'leaderboard' || page === 'social') return 'social';
    if (page === 'communicate') return 'communicate';
    return page;
  }

  function syncSidebarNavHighlight(page, sub) {
    let activeRoute = sidebarRouteForPage(page, sub);
    if (page === 'social') {
      activeRoute = 'social';
    }
    document.querySelectorAll('.hub-side-nav-link[data-org-route]').forEach((a) => {
      const isActive = a.getAttribute('data-org-route') === activeRoute;
      a.classList.toggle('is-active', isActive);
      if (isActive) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    let bottomPrimary = 'more';
    if (page === 'dashboard' || activeRoute === 'dashboard') bottomPrimary = 'dashboard';
    else if (
      page === 'events' ||
      activeRoute === 'events-list' ||
      String(activeRoute || '').indexOf('events-') === 0
    ) {
      bottomPrimary = 'events-list';
    } else if (
      page === 'business-overview' ||
      page === 'business-list' ||
      activeRoute === 'business-overview' ||
      activeRoute === 'business-list' ||
      String(activeRoute || '').indexOf('business-') === 0
    ) {
      bottomPrimary = 'business-overview';
    }

    document.querySelectorAll('.org-bottom-nav-link[data-org-route]').forEach((a) => {
      const isActive = a.getAttribute('data-org-route') === bottomPrimary;
      a.classList.toggle('is-active', isActive);
      if (isActive) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    const moreBtn = document.getElementById('org-bottom-more-btn');
    if (moreBtn) {
      moreBtn.classList.toggle('is-active', bottomPrimary === 'more');
    }
    document.querySelectorAll('.org-more-sheet-link[data-org-route]').forEach((a) => {
      a.classList.toggle('is-active', a.getAttribute('data-org-route') === activeRoute);
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

  function syncBusinessTabHighlights(sub, enabled) {
    const activeSub = sub || 'business-listings';
    document.querySelectorAll('[data-business-tab]').forEach((tab) => {
      const isActive = Boolean(enabled) && tab.getAttribute('data-business-tab') === activeSub;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.tabIndex = isActive ? 0 : -1;
    });
  }

  function businessSubHash(sub) {
    const route = sub || businessSubRoute || 'business-listings';
    if (route === 'business-listings') return 'business-overview';
    return route;
  }

  function updateBusinessTabCounts() {
    const listingsEl = document.getElementById('tab-count-opp-listings');
    const newBadge = document.getElementById('tab-badge-opp-enquiries-new');
    const liveListings = (state.opportunities || []).filter(function (o) {
      const status = String(o.status || o.listingStatus || '').toLowerCase();
      return status === 'published' || status === 'live';
    }).length;
    if (listingsEl) listingsEl.textContent = String(liveListings);
    const newCount = Number(state.opportunityEnquiriesNewCount) || 0;
    if (newBadge) {
      newBadge.hidden = newCount < 1;
      newBadge.textContent = String(newCount);
    }
  }

  function renderOpportunityInsightsEmpty() {
    const empty = document.getElementById('org-opp-insights-empty');
    if (!empty) return;
    const list = state.opportunities || [];
    if (!list.length) {
      empty.hidden = false;
      return;
    }
    const roi = document.getElementById('org-opp-roi-insights');
    const compare = document.getElementById('org-opp-compare');
    const coaching = document.getElementById('org-opp-coaching');
    const anyVisible = [roi, compare, coaching].some(function (el) {
      return el && !el.hidden;
    });
    empty.hidden = anyVisible;
  }

  function setBusinessSub(sub, options) {
    options = options || {};
    businessSubRoute = sub || 'business-listings';
    document.querySelectorAll('[data-business-panel]').forEach((panel) => {
      const isActive = panel.getAttribute('data-business-panel') === businessSubRoute;
      panel.classList.toggle('is-active', isActive);
      if (isActive) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
      panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
    syncBusinessTabHighlights(businessSubRoute, true);
    syncSidebarNavHighlight('business-overview', businessSubRoute);
    const titles = {
      'business-listings': [
        'My business opportunities',
        'Listings you publish on the hub — edit, renew, or promote each one.',
      ],
      'business-enquiries': [
        'Enquiries received',
        'Messages from members — reply here or via your email app.',
      ],
      'business-insights': [
        'Performance insights',
        'ROI, comparisons between listings, and tips to turn views into enquiries.',
      ],
      'business-guide': [
        'How business opportunities work',
        'Steps, pricing, and what to expect before you publish your first listing.',
      ],
    };
    const t = titles[businessSubRoute] || titles['business-listings'];
    const titleEl = document.getElementById('org-business-title');
    const subEl = document.getElementById('org-business-sub');
    if (titleEl) titleEl.textContent = t[0];
    if (subEl) subEl.textContent = t[1];
    const summary = document.getElementById('org-business-hub-summary');
    if (summary) summary.hidden = businessSubRoute === 'business-guide';

    if (!bootstrapReady) return Promise.resolve();

    if (businessSubRoute === 'business-enquiries') {
      return loadOpportunityEnquiries().then(function () {
        renderOpportunityEnquiries();
      });
    }
    if (businessSubRoute === 'business-listings') {
      return loadOpportunitiesList().then(function () {
        renderOpportunitiesList();
      });
    }
    if (businessSubRoute === 'business-insights') {
      return loadOpportunitiesList().then(function () {
        renderOpportunityRoiInsights();
        renderOpportunityCompare();
        renderOpportunityCoaching();
        renderOpportunityInsightsEmpty();
      });
    }
    return Promise.resolve();
  }

  function updateSharedEventFilterNotes() {
    const active = eventsFiltersActive();
    document.querySelectorAll('.org-filter-linked-note').forEach((el) => {
      el.classList.toggle('is-active', active);
    });
  }

  function ensurePromotePanelsFolded() {
    const reach = document.getElementById('org-social-panel-reach');
    const vis = document.getElementById('org-page-visibility');
    if (reach && vis && !reach.dataset.folded) {
      reach.textContent = '';
      while (vis.firstChild) {
        reach.appendChild(vis.firstChild);
      }
      reach.dataset.folded = '1';
      vis.hidden = true;
      vis.setAttribute('aria-hidden', 'true');
    }

    const ranking = document.getElementById('org-social-panel-ranking');
    const board = document.getElementById('org-page-leaderboard');
    if (ranking && board && !ranking.dataset.folded) {
      const mount = document.createElement('div');
      mount.className = 'org-promote-leaderboard-fold org-page--leaderboard';
      mount.id = 'org-promote-leaderboard-fold';
      while (board.firstChild) {
        mount.appendChild(board.firstChild);
      }
      ranking.appendChild(mount);
      ranking.dataset.folded = '1';
      board.hidden = true;
      board.setAttribute('aria-hidden', 'true');
      // Badge share cards already live in the ranking panel — hide the folded duplicate mount.
      const dupShare = document.getElementById('org-ranking-share-groups-mount');
      if (dupShare) {
        dupShare.hidden = true;
        dupShare.setAttribute('aria-hidden', 'true');
      }
    }
  }

  function ensurePromoteLeaderboardReady() {
    ensurePromotePanelsFolded();
    ensureRankingsAssets()
      .then(function () {
        if (window.HubRankings) {
          if (typeof window.HubRankings.setMyGroupIds === 'function') {
            window.HubRankings.setMyGroupIds(
              (state.groups || []).map(function (g) {
                return g.id;
              })
            );
          }
          if (typeof window.HubRankings.ensure === 'function') {
            window.HubRankings.ensure();
          }
        }
      })
      .catch(function () {
        /* non-fatal */
      });
  }

  function ensurePromoteReachReady() {
    ensurePromotePanelsFolded();
    renderVisibilityHubMeta();
    if (!state.eventsLoaded || !state.opportunitiesLoaded) {
      requestAnimationFrame(function () {
        if (!state.eventsLoaded) refresh();
        if (!state.opportunitiesLoaded) {
          loadOpportunitiesList().then(function () {
            renderVisibilityHubMeta();
          });
        }
        loadFeaturedSpotlightSlots().then(function () {
          renderVisibilityHubMeta();
        });
      });
    }
  }

  function setRoute(route, options) {
    options = options || {};
    if (isAttendeeListEmailRoute(route)) {
      options.openAttendeeEmail = true;
      route = 'communicate';
    }
    closeNotificationsPanel();
    closeOrgMoreSheet();
    if (
      bootstrapReady &&
      !options.skipEventsGuard &&
      !isOrganiserTourOpen() &&
      needsOrganiserPageFirst() &&
      isEventsRoute(route)
    ) {
      redirectEventsToOrganiserSetup();
      return;
    }
    let page = route || 'dashboard';
    if (page === 'member-lists') page = 'memberships';
    let sub = null;
    let businessSub = null;
    if (
      route === 'business-listings' ||
      route === 'business-enquiries' ||
      route === 'business-insights' ||
      route === 'business-guide'
    ) {
      page = 'business-overview';
      businessSub = route;
    } else if (route === 'opportunity-enquiries') {
      page = 'business-overview';
      businessSub = 'business-enquiries';
    } else if (route === 'business-overview') {
      page = 'business-overview';
      businessSub = 'business-listings';
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
    } else if (route === 'visibility' || route === 'grow-visibility') {
      page = 'social';
    } else if (route === 'leaderboard' || route === 'rankings') {
      page = 'social';
    } else if (isSocialRoute(route)) {
      page = 'social';
    }

    if (page === 'social') {
      ensurePromotePanelsFolded();
    }

    const fromRoute = page === 'social' ? socialTabFromRoute(route) : '';
    const fromHash = page === 'social' ? socialTabFromHash() : '';
    const socialTabPreferred = fromRoute || fromHash || '';
    const resolvedEventsSub = page === 'events' ? sub || eventsSubRoute || 'events-list' : null;
    const resolvedBusinessSub =
      page === 'business-overview' ? businessSub || businessSubRoute || 'business-listings' : null;
    const routeKey =
      page === 'events'
        ? 'events:' + resolvedEventsSub
        : page === 'business-overview'
          ? 'business:' + resolvedBusinessSub
          : page === 'social'
            ? 'social:' + (socialTabPreferred || storedSocialTab() || 'linkedin')
            : String(page || 'dashboard');
    const routeChanged = routeKey !== lastOrgRouteLoadKey;
    lastOrgRouteLoadKey = routeKey;
    const shouldShowRouteLoading =
      bootstrapReady &&
      !options.skipRouteLoading &&
      !isDashboardBootLoading() &&
      (routeChanged || options.forceRouteLoading);
    const routeLoadToken = shouldShowRouteLoading
      ? beginOrgRouteLoading(
          orgRouteLoadingLabel(page, resolvedEventsSub, resolvedBusinessSub)
        )
      : null;
    const routeLoadTasks = [];

    document.querySelectorAll('[data-org-page]').forEach((p) => {
      p.classList.toggle('is-active', p.getAttribute('data-org-page') === page);
    });

    if (page === 'events') {
      routeLoadTasks.push(setEventsSub(resolvedEventsSub));
    } else if (page === 'business-overview') {
      routeLoadTasks.push(setBusinessSub(resolvedBusinessSub));
    } else {
      syncSidebarNavHighlight(page, sub);
      syncEventsTabHighlights(null, false);
      syncBusinessTabHighlights(null, false);
    }
    if (page === 'communicate' || options.openAttendeeEmail) {
      routeLoadTasks.push(
        new Promise(function (resolve) {
          requestAnimationFrame(function () {
            try {
              ensureAttendeeEmailPanelReady(
                filters.attendeesEvent !== 'all' ? filters.attendeesEvent : ''
              );
            } catch (e) {
              /* ignore */
            }
            resolve();
          });
        })
      );
    }
    if (page === 'social') {
      // Sidebar "Promote" (#social / #promote) always opens LinkedIn — don't restore a stored tab.
      const barePromote =
        !fromRoute &&
        (route === 'social' || route === 'promote' || route === '') &&
        (!fromHash || fromHash === 'linkedin');
      const tabToOpen = barePromote ? 'linkedin' : socialTabPreferred || undefined;
      initSocialPageTabs(tabToOpen);
      if (barePromote || tabToOpen === 'linkedin') {
        try {
          sessionStorage.setItem(SOCIAL_TAB_STORAGE_KEY, 'linkedin');
        } catch {
          /* ignore */
        }
      }
      // Canonicalise legacy deep links so guides and shares match the tab.
      if (fromRoute === 'reach' || fromRoute === 'ranking') {
        syncSocialHash(fromRoute);
      }
      renderOrganiserRankingShare();
      ensureFeaturedUpgradePanelReady();
      if (tabToOpen === 'ranking' || socialTabPreferred === 'ranking') {
        ensurePromoteLeaderboardReady();
      }
      if (tabToOpen === 'reach' || socialTabPreferred === 'reach') {
        ensurePromoteReachReady();
      }
      routeLoadTasks.push(
        new Promise(function (resolve) {
          requestAnimationFrame(function () {
            Promise.resolve()
              .then(function () {
                return ensureLinkedInPostBuilder({ force: true });
              })
              .then(function () {
                return loadOpportunitiesList();
              })
              .then(function () {
                if (linkedInPostBuilder && linkedInPostBuilder.refreshOpportunities) {
                  linkedInPostBuilder.refreshOpportunities();
                }
              })
              .catch(function () {
                return null;
              })
              .then(resolve);
          });
        })
      );
    }
    if (page === 'team') {
      routeLoadTasks.push(
        ensureTeamLoaded().then(function () {
          renderTeam();
          updateGettingStartedPanel();
          updateTeamNavBadge();
        })
      );
    }
    if (page === 'business-overview') {
      routeLoadTasks.push(
        new Promise(function (resolve) {
          requestAnimationFrame(function () {
            Promise.resolve(loadOpportunityPremiumSlots())
              .catch(function () {
                return null;
              })
              .then(resolve);
          });
        })
      );
    }
    if (page === 'business-list') {
      routeLoadTasks.push(
        new Promise(function (resolve) {
          requestAnimationFrame(function () {
            Promise.resolve(loadOpportunityEnquiries())
              .then(function () {
                return loadOpportunityPremiumSlots();
              })
              .then(function () {
                return loadOpportunitiesList();
              })
              .then(function () {
                renderOpportunityPerformance();
                updateBusinessListPageHead();
              })
              .catch(function () {
                return null;
              })
              .then(resolve);
          });
        })
      );
    }
    if (page === 'memberships') {
      if (bootstrapReady && maybeRedirectToSingleMemberList()) {
        settleOrgRouteLoading(routeLoadToken, routeLoadTasks);
        return;
      }
      renderMembershipsPage();
      if (bootstrapReady) {
        routeLoadTasks.push(
          new Promise(function (resolve) {
            requestAnimationFrame(function () {
              if (document.querySelector('[data-org-page="memberships"].is-active')) {
                renderMembershipsPage();
              }
              resolve();
            });
          })
        );
      }
    }
    if (page === 'groups') {
      routeLoadTasks.push(
        Promise.resolve()
          .then(function () {
            if (typeof renderGroups === 'function') renderGroups();
          })
          .catch(function () {
            return null;
          })
      );
    }

    // Route lives in the hash only (/organiser/#events-list). Do not also write ?panel=
    // — that produced clunky URLs like /organiser/?panel=events-list#events-list.
    // Still accept ?panel= when reading (parseDeepLinkFromUrl) for old bookmarks.
    const hash =
      page === 'events'
        ? sub || 'events-list'
        : page === 'business-overview'
          ? businessSubHash(businessSub || businessSubRoute)
          : page === 'business-list'
            ? 'business-list'
            : page === 'social'
              ? socialHashForTab(
                  socialTabPreferred || socialTabFromHash() || storedSocialTab() || 'linkedin'
                )
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
    if (page === 'memberships' && filters.membershipsGroup) {
      url.searchParams.set('membershipGroup', filters.membershipsGroup);
    } else if (page !== 'memberships') {
      url.searchParams.delete('membershipGroup');
      url.searchParams.delete('membership_group');
    }
    url.hash = hash ? '#' + hash : '';
    const nextUrl = url.pathname + url.search + url.hash;
    if (window.location.pathname + window.location.search + window.location.hash !== nextUrl) {
      history.replaceState(null, '', nextUrl);
    }

    settleOrgRouteLoading(routeLoadToken, routeLoadTasks);
  }

  window.orgDashSetRoute = setRoute;

  function updateTeamNavBadge() {
    const badge = document.getElementById('org-team-nav-badge');
    const moreBadge = document.getElementById('org-more-team-badge');
    const pendingCount = (state.teamMembers || []).filter(
      (m) => String(m.status || '').toLowerCase() === 'pending'
    ).length;
    const label = pendingCount > 99 ? '99+' : pendingCount > 1 ? String(pendingCount) : 'Invite';
    if (badge) {
      badge.hidden = pendingCount < 1;
      badge.textContent = label;
    }
    if (moreBadge) {
      moreBadge.hidden = pendingCount < 1;
      moreBadge.textContent = label;
    }
    refreshOrgBottomMoreCount();
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
    pendingOpportunityEnquiry = null;
    const duplicateConfirmBtn = document.getElementById('btn-event-duplicate-confirm');
    if (duplicateConfirmBtn) duplicateConfirmBtn.disabled = false;
    const groupDuplicateConfirmBtn = document.getElementById('btn-group-duplicate-confirm');
    if (groupDuplicateConfirmBtn) groupDuplicateConfirmBtn.disabled = false;
    const deleteConfirmBtn = document.getElementById('btn-event-delete-confirm');
    if (deleteConfirmBtn) deleteConfirmBtn.disabled = false;
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
    clearEventScopedClientState(eventId);
    await refreshEventsWorkspaceAfterMutation({ route: 'events-list' });
  }

  function revenuePayoutMetrics() {
    let readyToRequest = 0;
    let paidOut = 0;
    let onHold = 0;
    (state.events || []).forEach(function (ev) {
      if (usesConnectPayoutFlow()) {
        if ((Number(ev.revenueNum) || 0) > 0) readyToRequest++;
      } else if (ev.canRequestPayout) {
        readyToRequest++;
      }
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
        '<button type="button" class="org-btn org-btn-sm org-btn-outline org-member-list-link" data-org-goto-memberships="' +
        esc(g.id) +
        '">Membership</button> ' +
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

    const sold = eventEffectiveTicketsSold(ev);
    const capacity = Number(ev.ticketsCapacity) || 0;
    const soldLabel = formatTicketsSoldLabel(sold, capacity);
    const revenueNum = Number(ev.revenueNum) || 0;
    const revClass = revenueNum > 0 ? 'org-revenue' : 'org-revenue muted';

    tr.innerHTML =
      '<td class="org-td-thumb" data-label="">' +
      thumbHtml(ev) +
      '</td><td class="org-td-name" data-label="Event">' +
      eventTitleCellHtml(ev) +
      '</td><td data-label="Date">' +
      esc(formatEventDateCell(ev)) +
      '</td><td data-label="Time">' +
      esc(formatTimeRange(ev.date, ev.endDate)) +
      '</td><td data-label="Tickets sold">' +
      esc(soldLabel || ev.ticketsSoldLabel || '0') +
      '</td><td class="' +
      revClass +
      '" data-label="Revenue">' +
      esc(ev.revenueDisplay || formatGbpAmount(revenueNum) || '£0') +
      '</td><td data-label="Status">' +
      statusBadgeHtml(ev.statusKey || 'draft', ev.statusLabel || 'Draft') +
      '</td><td class="org-td-actions" data-label="Actions">' +
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
      '<td class="org-td-thumb" data-label="">' +
      thumbHtml(ev) +
      '</td><td class="org-td-name" data-label="Event">' +
      eventTitleCellHtml(ev) +
      (ev.needsRefundConfirmation
        ? '<p class="org-payout-held-note">Payout on hold — refunds processing</p>'
        : '') +
      '</td><td data-label="Tickets sold">' +
      esc(ev.ticketsSoldLabel || '0') +
      '</td><td class="org-revenue" data-label="Revenue">' +
      eventRevenueCellHtml(ev) +
      '</td><td class="org-payout-col" data-label="Payout">' +
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
    const hideUnpublishedEl = document.getElementById('filter-events-hide-unpublished');
    const revStatusEl = document.getElementById('filter-revenue-status');
    const revSearchEl = document.getElementById('filter-revenue-search');
    const revHideArchivedEl = document.getElementById('filter-revenue-hide-archived');
    const revHideUnpublishedEl = document.getElementById('filter-revenue-hide-unpublished');
    if (statusEl) statusEl.value = filters.eventsStatus;
    if (searchEl) searchEl.value = filters.eventsSearch;
    if (hideArchivedEl) hideArchivedEl.checked = filters.eventsHideArchived !== false;
    if (hideUnpublishedEl) hideUnpublishedEl.checked = Boolean(filters.eventsHideUnpublished);
    if (revStatusEl) revStatusEl.value = filters.eventsStatus;
    if (revSearchEl) revSearchEl.value = filters.eventsSearch;
    if (revHideArchivedEl) revHideArchivedEl.checked = filters.eventsHideArchived !== false;
    if (revHideUnpublishedEl) revHideUnpublishedEl.checked = Boolean(filters.eventsHideUnpublished);
    updateSharedEventFilterNotes();
  }

  function renderEvents() {
    const body = document.getElementById('events-body');
    const empty = document.getElementById('events-empty');
    if (!body) return;

    const list = filteredEventsList();
    body.innerHTML = '';

    if (!list.length) {
      const hasEvents = eventsSourceList().length > 0;
      setOrgEmpty(empty, {
        show: true,
        title: hasEvents ? 'No matching events' : 'No events yet',
        text: hasEvents
          ? 'Try adjusting your filters or search.'
          : 'Create your organiser page first, then list your first event.',
        hideActions: hasEvents,
      });
      updatePaginationNav('events', { totalPages: 1, start: 0, end: 0, total: 0, page: 1 });
      maybePrefetchEvents();
      updateLinkedInShareNudge();
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
    maybePrefetchEvents();
    updateLinkedInShareNudge();
  }

  function updateLinkedInShareNudge() {
    const nudge = document.getElementById('org-events-linkedin-nudge');
    if (!nudge) return;
    const hasLive = (state.events || []).some(function (ev) {
      return eventCanPromote(ev);
    });
    const shared =
      window.HubCommsPack &&
      typeof window.HubCommsPack.isEventShareDone === 'function' &&
      window.HubCommsPack.isEventShareDone();
    nudge.hidden = !hasLive || shared;
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
        '<td data-label="Ticket ref" style="font-family:monospace;font-size:11px">' +
        esc(ref) +
        '</td><td data-label="Event">' +
        esc(ev ? ev.title : '—') +
        '</td><td data-label="Ticket type"><span class="org-badge ' +
        tierBadge +
        '">' +
        esc(t.name) +
        '</span></td><td class="org-revenue" data-label="Price">' +
        (t.price === '' || t.price === '0' ? 'Free' : '£' + esc(t.price)) +
        '</td><td data-label="Sold">' +
        esc(String(t.ticketsSold != null ? t.ticketsSold : 0)) +
        '</td><td data-label="Qty available">' +
        esc(t.quantityAvailable != null ? String(t.quantityAvailable) : '—') +
        '</td><td data-label="Status">' +
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
      renderOrganiserNotices();
      updateMyEventsTabCounts();
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
    renderRevenueConnectCopy();

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
      maybePrefetchEvents();
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
    maybePrefetchEvents();
  }

  function renderMyEventsHub(sub) {
    renderEventsPanel(sub || eventsSubRoute);
  }

  function teamRoleLabel(role) {
    return role === 'owner' ? 'Owner' : 'Team member';
  }

  function teamRoleBadgeHtml(role) {
    const label = teamRoleLabel(role);
    const cls = role === 'owner' ? 'org-badge-purple' : 'org-badge-blue';
    return '<span class="org-badge ' + cls + '">' + esc(label) + '</span>';
  }

  function teamStatusBadgeHtml(status) {
    const label = teamStatusLabel(status);
    const cls = status === 'active' ? 'org-badge-green' : 'org-badge-gold';
    return '<span class="org-badge ' + cls + '">' + esc(label) + '</span>';
  }

  function teamStatusLabel(status) {
    return status === 'active' ? 'Active' : 'Pending';
  }

  function teamGroupAccessLabel(member) {
    if (!member || member.role === 'owner' || member.isAccountOwner || member.allGroups) {
      return 'All organiser pages';
    }
    const ids = member.groupIds || [];
    if (!ids.length) return 'No pages assigned';
    const names = ids.map(function (id) {
      const g = state.groups.find(function (x) {
        return x.id === id;
      });
      return g && g.name ? g.name : 'Organiser page';
    });
    return names.join(', ');
  }

  function teamGroupAccessHtml(member) {
    if (!member || member.role === 'owner' || member.isAccountOwner || member.allGroups) {
      return '<span class="org-team-access-pill org-team-access-pill--all">All pages</span>';
    }
    const ids = member.groupIds || [];
    if (!ids.length) {
      return '<span class="org-team-access-pill org-team-access-pill--none">None assigned</span>';
    }
    const names = ids.map(function (id) {
      const g = state.groups.find(function (x) {
        return x.id === id;
      });
      const name = g && g.name ? g.name : 'Organiser page';
      return (
        '<span class="org-team-access-pill" title="' +
        attrEsc(name) +
        '">' +
        esc(name) +
        '</span>'
      );
    });
    return '<div class="org-team-access-pills">' + names.join('') + '</div>';
  }

  function teamEmailCellHtml(member) {
    const email = esc(member.email || '—');
    const isSelf =
      state.user &&
      state.user.email &&
      String(state.user.email).toLowerCase() === String(member.email || '').toLowerCase();
    const pending = member.status === 'pending';
    let meta = '';
    if (isSelf) meta = '<span class="org-team-email-meta">You</span>';
    else if (pending) meta = '<span class="org-team-email-meta org-team-email-meta--pending">Invite sent</span>';
    return (
      '<div class="org-team-email-cell"><span class="org-team-email">' +
      email +
      '</span>' +
      (meta ? meta : '') +
      '</div>'
    );
  }

  function teamSummaryMetrics(members) {
    const list = members || state.teamMembers || [];
    let active = 0;
    let pending = 0;
    list.forEach(function (m) {
      if (m.role === 'owner' || m.isAccountOwner) return;
      if (m.status === 'pending') pending += 1;
      else if (m.status === 'active') active += 1;
    });
    const max = Math.max(0, Number(state.teamMax) || 100);
    const count = Math.max(0, Number(state.teamCount) || 0);
    const remaining = Number.isFinite(state.teamSlotsRemaining)
      ? Math.max(0, state.teamSlotsRemaining)
      : Math.max(0, max - count);
    return { active, pending, remaining, max, count };
  }

  function renderTeamSummaryStats(members) {
    const metrics = teamSummaryMetrics(members);
    const set = function (id, val) {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };
    set('team-stat-active', metrics.active);
    set('team-stat-pending', metrics.pending);
    set('team-stat-slots', metrics.remaining);

    const tableSub = document.getElementById('team-table-sub');
    if (tableSub && state.canManageTeam) {
      const totalPeople = (members || state.teamMembers || []).length;
      if (totalPeople > 0) {
        tableSub.textContent =
          metrics.count +
          ' on this account · ' +
          metrics.remaining +
          ' invite' +
          (metrics.remaining === 1 ? '' : 's') +
          ' remaining';
        tableSub.hidden = false;
      } else {
        tableSub.hidden = true;
      }
    } else if (tableSub) {
      tableSub.hidden = true;
    }
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
      empty.textContent = 'Create an organiser page first, then assign access.';
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
      const name = document.createElement('span');
      name.textContent = g.name || 'Group';
      label.appendChild(input);
      label.appendChild(name);
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
    state.teamMax = Number(data.teamMax) || 100;
    state.teamCount = Number(data.teamCount) || 0;
    state.teamSlotsRemaining = Number(data.teamSlotsRemaining);
    if (!Number.isFinite(state.teamSlotsRemaining)) {
      state.teamSlotsRemaining = Math.max(0, state.teamMax - state.teamCount);
    }
    return true;
  }

  function updateTeamLimitUi() {
    const modalNote = document.getElementById('modal-team-limit-note');
    const inviteBtn = document.getElementById('btn-invite-team');
    const inviteEmptyBtn = document.getElementById('btn-invite-team-empty');
    const capBanner = document.getElementById('team-cap-banner');
    const atCap = state.canManageTeam && state.teamSlotsRemaining <= 0;
    const metrics = teamSummaryMetrics();

    renderTeamSummaryStats();

    if (capBanner) {
      capBanner.hidden = !(state.canManageTeam && atCap);
    }
    if (modalNote) {
      modalNote.textContent =
        metrics.count +
        ' on this account · ' +
        metrics.remaining +
        ' invite' +
        (metrics.remaining === 1 ? '' : 's') +
        ' left. They become Active when they sign in with that email.';
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

  function teamActivityRoleLabel(role) {
    const r = String(role || '').toLowerCase();
    if (r === 'owner') return 'Owner';
    if (r === 'team' || r === 'editor') return 'Team member';
    if (r === 'admin') return 'Hub support';
    if (r === 'system') return 'System';
    return 'Unknown';
  }

  function renderTeamActivityItems(items) {
    if (!items || !items.length) {
      return '<p class="org-team-activity-empty">No activity recorded yet. Edits to events, organiser pages, and team access will show here.</p>';
    }
    return (
      '<ul class="org-team-activity-list">' +
      items
        .map(function (item) {
          const when = item.createdAt
            ? formatRelativeAge(item.createdAt) || formatDate(item.createdAt)
            : '—';
          const whenExact = item.createdAt ? formatDate(item.createdAt) : '';
          const roleLabel = teamActivityRoleLabel(item.actorRole);
          const who =
            String(item.actorRole || '').toLowerCase() === 'admin'
              ? roleLabel
              : (item.actorEmail || 'Unknown user') + ' · ' + roleLabel;
          return (
            '<li class="org-team-activity-item">' +
            '<p class="org-team-activity-summary">' +
            esc(item.summary || item.action || 'Change') +
            '</p>' +
            '<p class="org-team-activity-meta"' +
            (whenExact ? ' title="' + esc(whenExact) + '"' : '') +
            '>' +
            esc(who) +
            ' · ' +
            esc(when) +
            '</p></li>'
          );
        })
        .join('') +
      '</ul>'
    );
  }

  async function loadTeamActivity(options) {
    const force = Boolean(options && options.force);
    const panel = document.getElementById('org-team-activity');
    const body = document.getElementById('org-team-activity-body');
    if (!panel || !body) return;
    if (!state.canManageTeam) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    if (state.teamActivityLoaded && !force) {
      body.innerHTML = renderTeamActivityItems(state.teamActivityItems || []);
      return;
    }
    body.innerHTML = '<p class="org-team-activity-loading">Loading activity…</p>';
    const refreshBtn = document.getElementById('btn-team-activity-refresh');
    if (refreshBtn) refreshBtn.disabled = true;
    try {
      const { ok, data } = await api('/api/organiser/activity?limit=40');
      if (refreshBtn) refreshBtn.disabled = false;
      if (!ok || !data || data.ok === false) {
        body.innerHTML =
          '<p class="org-team-activity-error">' +
          esc((data && (data.message || data.error)) || 'Could not load activity.') +
          '</p>';
        return;
      }
      if (data.unavailable) {
        body.innerHTML =
          '<p class="org-team-activity-empty">' +
          esc(data.message || 'Activity history is not available yet.') +
          '</p>';
        return;
      }
      state.teamActivityItems = data.items || [];
      state.teamActivityLoaded = true;
      body.innerHTML = renderTeamActivityItems(state.teamActivityItems);
    } catch (err) {
      if (refreshBtn) refreshBtn.disabled = false;
      body.innerHTML =
        '<p class="org-team-activity-error">' +
        esc((err && err.message) || 'Could not load activity.') +
        '</p>';
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
    const memberNote = document.getElementById('team-member-note');
    if (memberNote) {
      memberNote.hidden = state.organiserRole !== 'editor';
    }
    const ownerPanel = document.getElementById('org-team-owner-panel');
    if (ownerPanel) {
      ownerPanel.hidden = !state.canManageTeam;
    }
    const permissionsPanel = document.getElementById('org-team-permissions');
    if (permissionsPanel) {
      permissionsPanel.hidden = !state.canManageTeam;
    }
    const activityPanel = document.getElementById('org-team-activity');
    if (activityPanel) {
      activityPanel.hidden = !state.canManageTeam;
    }
    if (state.canManageTeam) {
      loadTeamActivity();
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
      if (isOwner) tr.classList.add('org-team-row--owner');
      if (m.status === 'pending') tr.classList.add('org-team-row--pending');
      const actions = [];
      if (!isOwner && state.canManageTeam) {
        actions.push(
          '<button type="button" class="org-btn org-btn-outline org-btn-sm" data-team-groups="' +
            esc(m.id) +
            '">Edit access</button>'
        );
        if (m.status === 'pending') {
          actions.push(
            '<button type="button" class="org-btn org-btn-outline org-btn-sm" data-team-resend="' +
              esc(m.id) +
              '">Resend</button>'
          );
        }
        actions.push(
          '<button type="button" class="org-btn org-btn-outline org-btn-sm org-btn-danger-text" data-team-remove="' +
            esc(m.id) +
            '">Remove</button>'
        );
      }
      tr.innerHTML =
        '<td>' +
        teamEmailCellHtml(m) +
        '</td><td>' +
        teamRoleBadgeHtml(m.role) +
        '</td><td class="org-team-group-access">' +
        teamGroupAccessHtml(m) +
        '</td><td>' +
        teamStatusBadgeHtml(m.status) +
        '</td><td class="org-td-actions">' +
        (actions.length
          ? '<div class="org-team-actions">' + actions.join('') + '</div>'
          : '<span class="org-team-actions-empty">—</span>') +
        '</td>';
      body.appendChild(tr);
    });
    renderTeamSummaryStats(list);
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
          'You can invite up to ' + state.teamMax + ' team members. Remove someone before inviting another.',
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
          alert('Select at least one organiser page, or choose All organiser pages.');
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
        state.teamActivityLoaded = false;
        renderTeam();
        updateGettingStartedPanel();
        showOrganiserAlert(data.message || (data.emailSent === false ? 'Invite saved but email not sent.' : 'Invite sent.'), data.emailSent === false);
      });
    }
    const activityRefresh = document.getElementById('btn-team-activity-refresh');
    if (activityRefresh) {
      activityRefresh.addEventListener('click', function () {
        loadTeamActivity({ force: true });
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
            state.teamActivityLoaded = false;
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
          alert('Select at least one organiser page, or choose All organiser pages.');
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
          alert(data.message || data.error || 'Could not update organiser page access');
          return;
        }
        closeModals();
        await loadTeamMembers({ force: true });
        state.teamActivityLoaded = false;
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
      setOrganiserScopeCookie('all');
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
    window.hubPendingOpportunityClaims = (state.pendingClaimOpportunities || []).length > 0;
  }

  function gettingStartedProgress() {
    const hasGroup = state.groups.length > 0;
    const hasEvent = hasListedEvents();
    const hasShared =
      window.HubCommsPack &&
      typeof window.HubCommsPack.isEventShareDone === 'function' &&
      window.HubCommsPack.isEventShareDone();
    const hasMembership = (state.groups || []).some(function (g) {
      return g && g.rosterSummary && Number(g.rosterSummary.active) > 0;
    });
    const hasTeam = (state.teamMembers || []).some(function (m) {
      return m.role === 'editor' || (m.status === 'pending' && !m.isAccountOwner);
    });
    return { hasGroup, hasEvent, hasShared, hasMembership, hasTeam };
  }

  function firstLiveEventForShare() {
    const events = (state.events || []).concat(state.upcomingEvents || []);
    return (
      events.find(function (ev) {
        const status = String(ev.status || ev.listingStatus || '').toLowerCase();
        return status === 'published' || status === 'live';
      }) || events[0] ||
      null
    );
  }

  function openShareEventFlow() {
    const ev = firstLiveEventForShare();
    if (ev && ev.id) {
      location.href =
        '/organiser/event-published?ids=' + encodeURIComponent(ev.id) + '&published=1';
      return;
    }
    if (window.orgDashSetRoute) window.orgDashSetRoute('social');
  }

  window.orgDashOpenShareEvent = openShareEventFlow;
  window.orgDashUpdateGettingStarted = updateGettingStartedPanel;

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

    if ((state.pendingClaimGroups || []).length > 0 || (state.pendingClaimOpportunities || []).length > 0) {
      panel.hidden = true;
      updateSetupResumeBanner();
      return;
    }

    const progress = gettingStartedProgress();
    const coreDone = progress.hasGroup && progress.hasEvent && progress.hasShared;
    const requiredSteps = [progress.hasGroup, progress.hasEvent, progress.hasShared];
    const requiredDone = requiredSteps.filter(Boolean).length;

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

    applyClaimMismatchGettingStarted(panel);

    const titleEl = panel.querySelector('.org-getting-started-title');
    if (titleEl) {
      if (hasClaimOnboardMismatch()) {
        titleEl.textContent = 'Claim your existing listing first';
      } else if (requiredDone === 0) titleEl.textContent = "Here's what to do first";
      else titleEl.textContent = "Here's what's next";
    }
    panel.classList.remove('is-complete');

    const progressHint = document.getElementById('org-getting-started-progress');
    if (progressHint) {
      const remaining = 3 - requiredDone;
      progressHint.textContent =
        requiredDone === 0
          ? '3 steps to get your workspace ready.'
          : remaining === 1
            ? '1 step left on your setup checklist.'
            : remaining + ' steps left on your setup checklist.';
    }

    const stepDone = {
      group: progress.hasGroup,
      membership: progress.hasMembership,
      event: progress.hasEvent,
      share: progress.hasShared,
      team: progress.hasTeam,
    };
    let nextMarked = false;

    panel.querySelectorAll('[data-getting-step]').forEach(function (li) {
      const key = li.getAttribute('data-getting-step');
      const done = Boolean(stepDone[key]);
      li.classList.toggle('is-done', done);
      li.classList.toggle('is-next', !done && !nextMarked);
      if (key === 'share') {
        li.hidden = !progress.hasEvent || done;
      } else {
        li.hidden = done;
      }
      if (!done && !nextMarked && !(key === 'share' && (!progress.hasEvent || done))) nextMarked = true;

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
    syncOverviewSetupQuietMode();
  }

  function updateSetupResumeBanner() {
    const banner = document.getElementById('org-setup-resume');
    if (!banner || state.adminView) {
      syncOverviewSetupQuietMode();
      return;
    }

    const onboarding = window.HubOrganiserOnboarding;
    if (onboarding && onboarding.isResumeDismissed && onboarding.isResumeDismissed()) {
      banner.hidden = true;
      syncOverviewSetupQuietMode();
      return;
    }

    if ((state.pendingClaimGroups || []).length > 0) {
      banner.hidden = true;
      syncOverviewSetupQuietMode();
      return;
    }

    if (isLaunchSetupInProgress()) {
      const built = window.HubOrganiserLaunchSetup.buildQueue(launchSetupInput());
      const profilesLeft = (built.queue || []).filter(function (q) {
        return q.kind === 'profile';
      }).length;
      const eventsLeft = (built.queue || []).filter(function (q) {
        return q.kind === 'event';
      }).length;
      const titleEl = document.getElementById('org-setup-resume-title');
      const bodyEl = document.getElementById('org-setup-resume-body');
      if (profilesLeft) {
        if (titleEl) {
          titleEl.textContent =
            profilesLeft > 1
              ? 'Review your organiser pages (' + profilesLeft + ' left)'
              : 'Review your organiser page';
        }
        if (bodyEl) {
          bodyEl.textContent =
            'Confirm logo, description, and details for each page — then we will take you to your events.';
        }
      } else {
        if (titleEl) {
          titleEl.textContent =
            eventsLeft > 1
              ? 'Review your events & tickets (' + eventsLeft + ' left)'
              : 'Review your event & tickets';
        }
        if (bodyEl) {
          bodyEl.textContent =
            'Check the listing we prepared, set tickets, and publish. Public ticket buying opens 1 September.';
        }
      }
      banner.hidden = false;
      syncOverviewSetupQuietMode();
      return;
    }

    const progress = gettingStartedProgress();
    if (progress.hasGroup && progress.hasEvent && progress.hasShared) {
      banner.hidden = true;
      syncOverviewSetupQuietMode();
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
      syncOverviewSetupQuietMode();
      return;
    }

    const titleEl = document.getElementById('org-setup-resume-title');
    const bodyEl = document.getElementById('org-setup-resume-body');
    if (!progress.hasGroup) {
      if (titleEl) titleEl.textContent = hasClaimOnboardMismatch() ? 'Find your existing listing' : 'Step 1 of 3 — organiser page';
      if (bodyEl) {
        bodyEl.textContent = hasClaimOnboardMismatch()
          ? 'Your email did not match a listing — find your group and request access instead of creating a duplicate page.'
          : 'Create or claim your organiser page to get started on the hub.';
      }
    } else if (needsOrganiserProfileReview()) {
      if (titleEl) titleEl.textContent = 'Step 1 of 3 — check your organiser page';
      if (bodyEl) {
        bodyEl.textContent =
          'Confirm your organiser page details before you list your first event.';
      }
    } else if (!progress.hasEvent) {
      if (titleEl) titleEl.textContent = 'Step 2 of 3 — list an event';
      if (bodyEl) {
        bodyEl.textContent = 'Your organiser page is ready — publish your first meeting, exhibition, or conference.';
      }
    } else {
      if (titleEl) titleEl.textContent = 'Step 3 of 3 — share your event';
      if (bodyEl) {
        bodyEl.textContent = 'Your event is live — copy the ready-made post and picture to spread the word.';
      }
    }

    banner.hidden = false;
    syncOverviewSetupQuietMode();
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
        if (isLaunchSetupInProgress() && window.HubOrganiserLaunchSetup) {
          const item = window.HubOrganiserLaunchSetup.nextItem(launchSetupInput());
          if (item) {
            openLaunchSetupItem(item);
            return;
          }
        }
        const progress = gettingStartedProgress();
        if (!progress.hasGroup) {
          window.location.href = '/organiser/group-edit';
          return;
        }
        if (needsOrganiserProfileReview()) {
          window.location.href = organiserProfileReviewUrl();
          return;
        }
        if (!progress.hasEvent) {
          if (window.HubFlowTour) window.HubFlowTour.markEventTourPending();
          const groupId = state.groups.length ? state.groups[0].id : '';
          openNewEventEditorDrawer({ groupId: groupId });
          return;
        }
        openShareEventFlow();
      });
    }
  }

  window.orgDashUpdateSetupResume = updateSetupResumeBanner;
  window.orgDashOpenClaimModal = function () {
    if ((state.pendingClaimGroups || []).length > 0) {
      renderGroupClaimModal();
      return;
    }
    if ((state.pendingClaimOpportunities || []).length > 0) {
      renderOpportunityClaimModal();
    }
  };

  window.orgDashHandleClaimOnboardMismatch = function () {
    if (!hasClaimOnboardMismatch()) return;
    renderAll();
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
    const oppModal = document.getElementById('org-opportunity-claim');
    if (!oppModal || oppModal.hidden) {
      document.body.classList.remove('org-group-claim-active');
    }
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

  function needsOrganiserProfileReview() {
    if (!(state.groups || []).length) return false;
    const launch = window.HubOrganiserLaunchSetup;
    if (launch && launch.buildQueue) {
      const built = launch.buildQueue(launchSetupInput());
      if (
        (built.queue || []).some(function (q) {
          return q.kind === 'profile';
        })
      ) {
        return true;
      }
    }
    const onboarding = window.HubOrganiserOnboarding;
    return Boolean(
      onboarding && onboarding.isProfileReviewDone && !onboarding.isProfileReviewDone()
    );
  }

  function organiserProfileReviewUrl() {
    const groups = groupsForLaunchSetup();
    const group = groups[0] || state.groups[0];
    if (!group || !group.id) return '/organiser/#groups';
    if (window.HubOrganiserLaunchSetup && window.HubOrganiserLaunchSetup.profileEditUrl) {
      return window.HubOrganiserLaunchSetup.profileEditUrl(group.id);
    }
    return '/organiser/group-edit?id=' + encodeURIComponent(group.id) + '&onboard=review';
  }

  var CLAIM_REVIEW_ORDER_KEY = 'hub_claim_review_order_v1';
  var CLAIM_FOCUS_KEY = 'hub_claim_focus_v1';

  function trackClaimFunnel(step, detail) {
    try {
      if (window.HubAnalytics && typeof window.HubAnalytics.track === 'function') {
        window.HubAnalytics.track('organiser_claim_funnel', {
          step: String(step || '').slice(0, 40),
          detail: String(detail || '').slice(0, 80),
        });
      }
    } catch (e) {
      /* ignore */
    }
  }

  function readClaimFocus() {
    try {
      const raw = sessionStorage.getItem(CLAIM_FOCUS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function sortPendingClaimGroups(list) {
    const rows = Array.isArray(list) ? list.slice() : [];
    if (rows.length < 2) return rows;
    const focus = readClaimFocus();
    const focusSlug = String((focus && focus.slug) || '')
      .trim()
      .toLowerCase();
    const focusId = String((focus && focus.id) || '').trim();
    if (!focusSlug && !focusId) {
      return rows.sort(function (a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
    }
    return rows.sort(function (a, b) {
      const aHit =
        (focusId && String(a.id) === focusId) ||
        (focusSlug && String(a.slug || '').toLowerCase() === focusSlug);
      const bHit =
        (focusId && String(b.id) === focusId) ||
        (focusSlug && String(b.slug || '').toLowerCase() === focusSlug);
      if (aHit && !bHit) return -1;
      if (!aHit && bHit) return 1;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }

  function rememberClaimedGroupOrder(groupId) {
    const id = String(groupId || '').trim();
    if (!id) return;
    try {
      const order = JSON.parse(sessionStorage.getItem(CLAIM_REVIEW_ORDER_KEY) || '[]');
      if (order.indexOf(id) === -1) order.push(id);
      sessionStorage.setItem(CLAIM_REVIEW_ORDER_KEY, JSON.stringify(order));
    } catch (e) {
      /* ignore */
    }
  }

  function groupsForLaunchSetup() {
    const groups = (state.groups || []).slice();
    let order = [];
    try {
      order = JSON.parse(sessionStorage.getItem(CLAIM_REVIEW_ORDER_KEY) || '[]');
    } catch (e) {
      order = [];
    }
    if (!order.length) {
      const focus = readClaimFocus();
      const focusId = String((focus && focus.id) || '').trim();
      const focusSlug = String((focus && focus.slug) || '')
        .trim()
        .toLowerCase();
      if (focusId || focusSlug) {
        groups.sort(function (a, b) {
          const aHit =
            (focusId && String(a.id) === focusId) ||
            (focusSlug && String(a.slug || '').toLowerCase() === focusSlug);
          const bHit =
            (focusId && String(b.id) === focusId) ||
            (focusSlug && String(b.slug || '').toLowerCase() === focusSlug);
          if (aHit && !bHit) return -1;
          if (!aHit && bHit) return 1;
          return 0;
        });
      }
      return groups;
    }
    groups.sort(function (a, b) {
      const ia = order.indexOf(String(a && a.id));
      const ib = order.indexOf(String(b && b.id));
      if (ia < 0 && ib < 0) return 0;
      if (ia < 0) return 1;
      if (ib < 0) return -1;
      return ia - ib;
    });
    return groups;
  }

  function isLaunchSetupInProgress() {
    const launch = window.HubOrganiserLaunchSetup;
    if (!launch || !launch.buildQueue) return false;
    try {
      const built = launch.buildQueue(launchSetupInput());
      return Boolean(!built.stored.dismissed && (built.queue || []).length);
    } catch (e) {
      return false;
    }
  }

  function syncOverviewSetupQuietMode() {
    const quiet =
      !state.adminView &&
      ((state.pendingClaimGroups || []).length > 0 ||
        (state.pendingClaimOpportunities || []).length > 0 ||
        isLaunchSetupInProgress());
    document.body.classList.toggle('org-claim-setup-active', quiet);
    const portals = document.querySelector('.org-hub-portals');
    if (portals) portals.hidden = quiet;
  }

  function continueOnboardingAfterClaim() {
    if (state.adminView) return;
    if ((state.pendingClaimGroups || []).length > 0) return;
    if ((state.pendingClaimOpportunities || []).length > 0) return;

    const groupIds = groupsForLaunchSetup()
      .map(function (g) {
        return g && g.id;
      })
      .filter(Boolean);

    if (window.HubOrganiserOnboarding) {
      if (window.HubOrganiserOnboarding.clearProfileReviewDone) {
        window.HubOrganiserOnboarding.clearProfileReviewDone();
      }
      if (window.HubOrganiserOnboarding.clearReadyEventDismissed) {
        window.HubOrganiserOnboarding.clearReadyEventDismissed();
      }
      if (window.HubOrganiserOnboarding.clearResumeDismissed) {
        window.HubOrganiserOnboarding.clearResumeDismissed();
      }
    }
    if (window.HubOrganiserLaunchSetup && window.HubOrganiserLaunchSetup.prepareClaimOnboarding) {
      window.HubOrganiserLaunchSetup.prepareClaimOnboarding(groupIds);
    } else if (window.HubOrganiserLaunchSetup && window.HubOrganiserLaunchSetup.unlockProfilesForReview) {
      window.HubOrganiserLaunchSetup.unlockProfilesForReview(groupIds);
    } else if (window.HubOrganiserLaunchSetup && window.HubOrganiserLaunchSetup.clearDismissed) {
      window.HubOrganiserLaunchSetup.clearDismissed();
    }

    updateSetupResumeBanner();

    const launch = window.HubOrganiserLaunchSetup;
    const item = launch && launch.nextItem ? launch.nextItem(launchSetupInput()) : null;
    if (item) {
      openLaunchSetupItem(item);
      return;
    }
    if (needsOrganiserProfileReview()) {
      location.href = organiserProfileReviewUrl();
      return;
    }
    showReadyForEventPrompt();
  }

  function launchSetupInput() {
    const fromSource = eventsSourceList();
    const extra = state.upcomingEvents || [];
    const seen = {};
    const events = [];
    fromSource.concat(extra).forEach(function (ev) {
      if (!ev) return;
      const id = String(ev.id || '');
      if (id && seen[id]) return;
      if (id) seen[id] = true;
      events.push(ev);
    });
    return {
      groups: groupsForLaunchSetup(),
      events: events,
      tickets: state.tickets || [],
      groupEventsIntoSeries: groupEventsIntoSeries,
    };
  }

  function hideLaunchSetupModal() {
    const modal = document.getElementById('org-launch-setup');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }
    const ready = document.getElementById('org-ready-event');
    const claim = document.getElementById('org-group-claim');
    if ((!ready || ready.hidden) && (!claim || claim.hidden)) {
      document.body.classList.remove('org-group-claim-active');
    }
  }

  function openLaunchSetupItem(item) {
    if (!item) return;
    hideLaunchSetupModal();
    trackClaimFunnel(
      item.kind === 'profile' ? 'open_profile_review' : 'open_event_review',
      item.title || item.id || ''
    );
    if (item.kind === 'profile') {
      openGroupEditorDrawer(item.id, {
        onboardLaunch: true,
        onboardReview: true,
      });
      return;
    }
    if (item.kind === 'event' && item.family && item.family.primary) {
      const ids = (item.family.events || [])
        .map(function (e) {
          return e.id;
        })
        .filter(Boolean);
      try {
        sessionStorage.setItem(
          'hub_event_series',
          JSON.stringify({
            title: item.family.title,
            eventIds: ids,
            events: (item.family.events || []).map(function (e) {
              return { id: e.id, date: e.date || e.startsAt || e.starts_at || '' };
            }),
            launchSetup: true,
            familyKey: item.family.key,
          })
        );
      } catch (e) {
        /* ignore */
      }
      const primaryId = item.family.primary.id;
      location.href =
        '/organiser/event-edit?id=' +
        encodeURIComponent(primaryId) +
        '&onboard=launch' +
        (ids.length > 1 ? '&seriesEdit=1' : '');
    }
  }

  function showLaunchSetupPrompt() {
    const modal = document.getElementById('org-launch-setup');
    const launch = window.HubOrganiserLaunchSetup;
    if (!modal || !launch || state.adminView) return false;

    const built = launch.buildQueue(launchSetupInput());
    if (built.stored.dismissed || !built.queue.length) {
      hideLaunchSetupModal();
      return false;
    }

    const item = built.queue[0];
    const profilesLeft = built.queue.filter(function (q) {
      return q.kind === 'profile';
    }).length;
    const eventsLeft = built.queue.filter(function (q) {
      return q.kind === 'event';
    }).length;

    hideReadyForEventModal();
    hideGroupClaimModal();

    const kicker = document.getElementById('org-launch-setup-kicker');
    const titleEl = document.getElementById('org-launch-setup-title');
    const introEl = document.getElementById('org-launch-setup-intro');
    const labelEl = document.getElementById('org-launch-setup-item-label');
    const metaEl = document.getElementById('org-launch-setup-item-meta');
    const queueEl = document.getElementById('org-launch-setup-queue');

    if (kicker) {
      kicker.textContent =
        built.queue.length === 1
          ? 'Almost there — 1 step left'
          : 'Finish setup · ' + built.queue.length + ' steps left';
    }
    if (titleEl) {
      titleEl.textContent =
        item.kind === 'profile' ? 'Review your organiser page' : 'Review your event & tickets';
    }
    if (introEl) {
      if (item.kind === 'profile') {
        introEl.textContent =
          (state.groups || []).length > 1
            ? 'You have more than one organiser page. Review each in turn — logo, description, and complimentary guest visits (not always imported). Public ticket buying opens 1 September.'
            : 'Confirm your profile now. Set complimentary guest visits (0–3) if you offer trial nights. Public ticket buying opens 1 September — until then, get everything ready in the workspace.';
      } else if (item.isSeries) {
        introEl.textContent =
          'This is a recurring series (' +
          item.dateCount +
          ' dates). You review shared details and tickets once — every date uses the same setup. Publish now so you are ready; attendees buy on the public site from 1 September. Paid tickets need Connect before card payments work.';
      } else if (eventsLeft > 1) {
        introEl.textContent =
          'You have several seeded listings. Finish this one (details → tickets → review → publish), then we will take you to the next. Public sales open 1 September.';
      } else {
        introEl.textContent =
          'Check the listing we prepared, set tickets, then publish. Attendees cannot buy on the public site until 1 September — get set now. Paid tickets need bank payouts connected first.';
      }
    }
    if (labelEl) labelEl.textContent = item.title;
    if (metaEl) {
      metaEl.textContent =
        item.indexHint +
        (item.kind === 'profile' && item.thin ? ' · needs photo or description' : '');
    }
    if (queueEl) {
      const bits = [];
      if (profilesLeft) bits.push(profilesLeft + ' page' + (profilesLeft === 1 ? '' : 's'));
      if (eventsLeft) bits.push(eventsLeft + ' event' + (eventsLeft === 1 ? '' : 's') + ' / series');
      queueEl.textContent = bits.length ? 'Still to do: ' + bits.join(', ') + '.' : '';
    }

    const goBtn = document.getElementById('org-launch-setup-go');
    if (goBtn) {
      goBtn.textContent =
        item.kind === 'profile' ? 'Review profile →' : 'Open event setup →';
    }

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('org-group-claim-active');
    modal.dataset.launchItemKind = item.kind;
    modal.dataset.launchItemId = item.id;
    return true;
  }

  function bindLaunchSetupUi() {
    const laterBtn = document.getElementById('org-launch-setup-later');
    const goBtn = document.getElementById('org-launch-setup-go');
    if (laterBtn) {
      laterBtn.addEventListener('click', function () {
        hideLaunchSetupModal();
        if (window.HubOrganiserLaunchSetup) window.HubOrganiserLaunchSetup.dismiss();
        updateGettingStartedVisibility();
      });
    }
    if (goBtn) {
      goBtn.addEventListener('click', function () {
        const launch = window.HubOrganiserLaunchSetup;
        if (!launch) return;
        const item = launch.nextItem(launchSetupInput());
        if (!item) {
          hideLaunchSetupModal();
          return;
        }
        openLaunchSetupItem(item);
      });
    }
  }

  function afterTourOnboardingStep() {
    if (state.adminView) return;
    if ((state.pendingClaimGroups || []).length > 0) {
      renderGroupClaimModal();
      return;
    }
    if ((state.pendingClaimOpportunities || []).length > 0) {
      renderOpportunityClaimModal();
      return;
    }
    continueOnboardingAfterClaim();
  }

  function showReadyForEventPrompt() {
    const modal = document.getElementById('org-ready-event');
    if (!modal || state.adminView) return;
    if (window.HubOrganiserLaunchSetup) {
      const progress = window.HubOrganiserLaunchSetup.progressSummary(launchSetupInput());
      if (!progress.dismissed && progress.remaining > 0) return;
    }
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

    const group = state.groups[0];
    const kickerEl = modal.querySelector('.org-group-claim-kicker');
    const titleEl = document.getElementById('org-ready-event-title');
    const introEl = document.getElementById('org-ready-event-intro');
    if (kickerEl) kickerEl.textContent = 'Step 2 of 2 — your first event';
    if (titleEl) {
      titleEl.textContent = group && group.name ? group.name + ' is yours — list your first event?' : 'Ready to add an event?';
    }
    if (introEl) {
      introEl.textContent =
        'Your organiser page is confirmed. List your first meeting, exhibition, or conference — we will walk you through the format and details.';
    }
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
          ? 'Exclusive invite — profile 1 of ' + list.length
          : 'Exclusive organiser invite';
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
      acceptBtn.textContent = groupClaimRejectMode ? 'Back' : 'Yes — set up this page';
    }
    if (rejectBtn) {
      rejectBtn.disabled = false;
      rejectBtn.textContent = groupClaimRejectMode ? 'Confirm — not my group' : 'No, this isn\'t mine';
      rejectBtn.classList.toggle('org-btn-danger', groupClaimRejectMode);
      rejectBtn.classList.toggle('org-btn-outline', !groupClaimRejectMode);
    }

    hideReadyForEventModal();
    hideOpportunityClaimModal();
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('org-group-claim-active');

    const introEl = document.getElementById('org-group-claim-intro');
    if (introEl) {
      introEl.textContent =
        'You have early access to the organiser workspace before we open to the public on 1 September. Confirm you manage this page, then use the full tools — events, LinkedIn, emails, memberships. Attendees cannot buy tickets on the public site until launch day.';
    }
  }

  async function submitGroupClaimAction(action) {
    if (groupClaimSubmitInFlight) return;
    const list = state.pendingClaimGroups || [];
    const group = list[0];
    const errEl = document.getElementById('org-group-claim-error');
    const acceptBtn = document.getElementById('org-group-claim-accept');
    const rejectBtn = document.getElementById('org-group-claim-reject');
    const notesEl = document.getElementById('org-group-claim-notes');
    if (!group) return;

    groupClaimSubmitInFlight = true;
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

      if (action === 'claim' && data.group && data.group.id) {
        rememberClaimedGroupOrder(data.group.id);
        trackClaimFunnel(
          'claim_accepted',
          data.group.slug || data.group.name || data.group.id
        );

        // Open THIS page in the half-page drawer. Do not reload claim modals first —
        // loadBootstrap used to race and steal the first click.
        hideGroupClaimModal();
        document.body.classList.remove('org-group-claim-active');

        if (window.HubOrganiserOnboarding && window.HubOrganiserOnboarding.clearProfileReviewDone) {
          window.HubOrganiserOnboarding.clearProfileReviewDone();
        }
        if (window.HubOrganiserLaunchSetup && window.HubOrganiserLaunchSetup.prepareClaimOnboarding) {
          window.HubOrganiserLaunchSetup.prepareClaimOnboarding([data.group.id]);
        }

        openGroupEditorDrawer(data.group, {
          onboardLaunch: true,
          onboardReview: true,
        });

        loadBootstrap({ silent: true, skipClaimUi: true })
          .then(function () {
            updateSetupResumeBanner();
            updateGettingStartedPanel();
            syncOverviewSetupQuietMode();
          })
          .catch(function () {
            /* non-fatal — drawer already open */
          });
        return;
      }

      if (state.pendingClaimGroups.length) {
        renderGroupClaimModal();
        return;
      }

      hideGroupClaimModal();
      if ((state.pendingClaimOpportunities || []).length) {
        renderOpportunityClaimModal();
        return;
      }

      if (action === 'reject') {
        await loadBootstrap();
        showOrganiserAlert(data.message || 'Profile removed from your dashboard. The Hub team has been notified.', false);
        return;
      }

      await loadBootstrap();
    } catch (e) {
      if (errEl) {
        errEl.textContent = e.message || 'Something went wrong. Please try again.';
        errEl.hidden = false;
      }
      if (acceptBtn) acceptBtn.disabled = false;
      if (rejectBtn) rejectBtn.disabled = false;
    } finally {
      groupClaimSubmitInFlight = false;
    }
  }

  function hideOpportunityClaimModal() {
    const modal = document.getElementById('org-opportunity-claim');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }
    if (!(state.pendingClaimGroups || []).length) {
      document.body.classList.remove('org-group-claim-active');
    }
    opportunityClaimRejectMode = false;
  }

  function renderOpportunityClaimModal() {
    const modal = document.getElementById('org-opportunity-claim');
    const list = state.pendingClaimOpportunities || [];
    syncPendingClaimFlag();
    updateGettingStartedVisibility();

    if (!modal || !list.length || state.adminView || shouldDeferGroupClaimModal()) {
      if (modal) hideOpportunityClaimModal();
      return;
    }

    const opportunity = list[0];
    const kicker = document.getElementById('org-opportunity-claim-kicker');
    const nameEl = document.getElementById('org-opportunity-claim-name');
    const hostEl = document.getElementById('org-opportunity-claim-host');
    const descEl = document.getElementById('org-opportunity-claim-desc');
    const avatarEl = document.getElementById('org-opportunity-claim-avatar');
    const notesWrap = document.getElementById('org-opportunity-claim-notes-wrap');
    const errEl = document.getElementById('org-opportunity-claim-error');
    const acceptBtn = document.getElementById('org-opportunity-claim-accept');
    const rejectBtn = document.getElementById('org-opportunity-claim-reject');

    if (kicker) {
      kicker.textContent =
        list.length > 1
          ? 'Listing 1 of ' + list.length + ' — confirm ownership'
          : 'Confirm your listing';
    }
    if (nameEl) nameEl.textContent = opportunity.title || 'Business opportunity';
    if (hostEl) {
      hostEl.textContent =
        (opportunity.host ? opportunity.host + ' · ' : '') +
        (opportunity.ownerEmail || state.user?.email || '');
    }
    if (descEl) {
      const desc = String(opportunity.desc || opportunity.description || '').trim();
      descEl.textContent = desc || 'Review the listing details after you claim it.';
      descEl.hidden = false;
    }
    if (avatarEl) {
      if (opportunity.logoUrl || opportunity.imageUrl) {
        avatarEl.innerHTML =
          '<img src="' +
          esc(opportunity.logoUrl || opportunity.imageUrl) +
          '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">';
      } else {
        avatarEl.textContent = String(opportunity.host || opportunity.title || 'O').slice(0, 1).toUpperCase();
      }
    }
    if (notesWrap) notesWrap.hidden = !opportunityClaimRejectMode;
    if (errEl) errEl.hidden = true;
    if (acceptBtn) {
      acceptBtn.disabled = false;
      acceptBtn.textContent = opportunityClaimRejectMode ? 'Back' : 'Yes, this is my listing';
    }
    if (rejectBtn) {
      rejectBtn.disabled = false;
      rejectBtn.textContent = opportunityClaimRejectMode
        ? 'Confirm — not my listing'
        : 'No, this isn\'t mine';
      rejectBtn.classList.toggle('org-btn-danger', opportunityClaimRejectMode);
      rejectBtn.classList.toggle('org-btn-outline', !opportunityClaimRejectMode);
    }

    hideReadyForEventModal();
    hideGroupClaimModal();
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('org-group-claim-active');
  }

  async function submitOpportunityClaimAction(action) {
    const list = state.pendingClaimOpportunities || [];
    const opportunity = list[0];
    const errEl = document.getElementById('org-opportunity-claim-error');
    const acceptBtn = document.getElementById('org-opportunity-claim-accept');
    const rejectBtn = document.getElementById('org-opportunity-claim-reject');
    const notesEl = document.getElementById('org-opportunity-claim-notes');
    if (!opportunity) return;

    if (errEl) errEl.hidden = true;
    if (acceptBtn) acceptBtn.disabled = true;
    if (rejectBtn) rejectBtn.disabled = true;

    try {
      const body = { opportunityId: opportunity.id, action: action };
      if (action === 'reject' && notesEl && notesEl.value.trim()) {
        body.notes = notesEl.value.trim();
      }
      const { ok, data } = await api('/api/organiser/opportunity-claims', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!ok) throw new Error(data.message || data.error || 'claim_action_failed');

      state.pendingClaimOpportunities = list.filter((o) => o.id !== opportunity.id);
      opportunityClaimRejectMode = false;
      if (notesEl) notesEl.value = '';

      if (state.pendingClaimOpportunities.length) {
        renderOpportunityClaimModal();
        return;
      }

      hideOpportunityClaimModal();
      await loadBootstrap();
      if (action === 'claim') {
        showOrganiserAlert(
          data.message || 'Listing claimed — open My business opportunities to manage it.',
          false
        );
        setRoute('business-overview', { skipEventsGuard: true });
      } else if (action === 'reject') {
        showOrganiserAlert(
          data.message || 'Listing removed from your dashboard. The Hub team has been notified.',
          false
        );
      }
      updateSetupResumeBanner();
      updateGettingStartedPanel();
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

    const oppAcceptBtn = document.getElementById('org-opportunity-claim-accept');
    const oppRejectBtn = document.getElementById('org-opportunity-claim-reject');
    if (oppAcceptBtn) {
      oppAcceptBtn.addEventListener('click', function () {
        if (opportunityClaimRejectMode) {
          opportunityClaimRejectMode = false;
          renderOpportunityClaimModal();
          return;
        }
        submitOpportunityClaimAction('claim');
      });
    }
    if (oppRejectBtn) {
      oppRejectBtn.addEventListener('click', function () {
        if (!opportunityClaimRejectMode) {
          opportunityClaimRejectMode = true;
          renderOpportunityClaimModal();
          return;
        }
        submitOpportunityClaimAction('reject');
      });
    }
  }

  function opportunityEnquiryNewCount(enquiries) {
    return (enquiries || []).filter((e) => String(e.status || '').toLowerCase() === 'new').length;
  }

  const OPPORTUNITY_LISTING_MONTHLY_INC_VAT_PENCE = 3000;
  const OPPORTUNITY_PREMIUM_MONTHLY_PENCE = 5500;
  const OPPORTUNITY_LISTING_MIN_MONTHS = 3;
  const BUSINESS_INTRO_COLLAPSE_KEY = 'hub_org_business_intro_collapsed_v1';
  const OPPORTUNITY_ENQUIRY_TEMPLATES = {
    thanks:
      'Hi {{name}},\n\nThank you for your enquiry about "{{title}}".\n\n',
    call:
      'Hi {{name}},\n\nThanks for getting in touch about "{{title}}". I would love to arrange a quick call — what times work for you this week?\n\n',
    info:
      'Hi {{name}},\n\nThank you for your interest in "{{title}}". Here is a bit more information:\n\n[Add details]\n\n',
  };
  let opportunityEnquiryFilterId = null;
  let businessIntroPanelBound = false;
  let opportunityPremiumSlots = null;
  let pendingOpportunityEnquiry = null;
  let opportunityEnquiryReplyBound = false;
  let premiumWaitlistOn = false;

  function formatPenceGbp(pence) {
    const pounds = pence / 100;
    if (pence % 100 === 0) return '£' + String(Math.round(pounds));
    return '£' + pounds.toFixed(2);
  }

  function opportunityListingSpendPence(opportunity) {
    const months = Number(opportunity?.listingMonths);
    if (Number.isFinite(months) && months > 0) {
      return months * OPPORTUNITY_LISTING_MONTHLY_INC_VAT_PENCE;
    }
    const paid = opportunity?.listingPaidAt ? new Date(opportunity.listingPaidAt) : null;
    const expires = opportunity?.listingExpiresAt ? new Date(opportunity.listingExpiresAt) : null;
    if (paid && !Number.isNaN(paid.getTime()) && expires && !Number.isNaN(expires.getTime())) {
      const ms = Math.max(expires.getTime() - paid.getTime(), 0);
      const estMonths = Math.max(
        OPPORTUNITY_LISTING_MIN_MONTHS,
        Math.round(ms / (30 * 86400000))
      );
      return estMonths * OPPORTUNITY_LISTING_MONTHLY_INC_VAT_PENCE;
    }
    return OPPORTUNITY_LISTING_MIN_MONTHS * OPPORTUNITY_LISTING_MONTHLY_INC_VAT_PENCE;
  }

  function opportunityPremiumMonthsEstimate(opportunity) {
    if (!opportunity?.featured && !opportunity?.featuredUntil) return 0;
    const until = opportunity.featuredUntil ? new Date(opportunity.featuredUntil) : null;
    if (!until || Number.isNaN(until.getTime())) return opportunity.featured ? 1 : 0;
    const now = Date.now();
    if (opportunity.featured && until.getTime() > now) {
      const remaining = Math.ceil((until.getTime() - now) / (30 * 86400000));
      return Math.max(1, remaining + 1);
    }
    if (until.getTime() <= now) return 1;
    return 1;
  }

  function opportunityPremiumSpendPence(opportunity) {
    return opportunityPremiumMonthsEstimate(opportunity) * OPPORTUNITY_PREMIUM_MONTHLY_PENCE;
  }

  function opportunityTotalSpendPence(opportunity) {
    return opportunityListingSpendPence(opportunity) + opportunityPremiumSpendPence(opportunity);
  }

  function opportunityCostPerEnquiryPence(opportunity, enquiryCount) {
    const count = Math.max(0, Number(enquiryCount) || 0);
    if (!count) return null;
    return Math.round(opportunityTotalSpendPence(opportunity) / count);
  }

  function opportunityPremiumBadgeHtml(opportunity) {
    const meta = opportunityPremiumMeta(opportunity);
    if (meta.tone === 'muted') return '';
    const cls =
      meta.tone === 'warn'
        ? 'org-opp-premium-badge is-warn'
        : meta.tone === 'ok'
          ? 'org-opp-premium-badge is-active'
          : 'org-opp-premium-badge';
    return (
      '<span class="' +
      cls +
      '" title="Premium spotlight placement">Spotlight · ' +
      esc(meta.label) +
      '</span>'
    );
  }

  function opportunityPremiumCellHtml(opportunity) {
    const meta = opportunityPremiumMeta(opportunity);
    if (meta.tone !== 'muted') {
      const cls =
        meta.tone === 'warn'
          ? 'org-opp-premium is-warn'
          : meta.tone === 'ok'
            ? 'org-opp-premium is-active'
            : 'org-opp-premium';
      return '<span class="' + cls + '">' + esc(meta.label) + '</span>';
    }
    if (opportunityCanUpgradePremium(opportunity)) {
      const slots = opportunityPremiumSlots;
      if (slots && slots.full) {
        if (premiumWaitlistOn) {
          return '<span class="org-opp-premium-upsell-muted">Waitlisted</span>';
        }
        return (
          '<button type="button" class="org-opp-premium-upsell-link" data-opp-waitlist="' +
          esc(opportunity.id) +
          '">Join waitlist</button>'
        );
      }
      return (
        '<button type="button" class="org-opp-premium-upsell-link" data-opp-premium-upgrade="' +
        esc(opportunity.id) +
        '">Add spotlight</button>'
      );
    }
    return '<span class="muted">—</span>';
  }

  function opportunityRoiFootnoteHtml(opportunity, enquiryCount) {
    const per = opportunityCostPerEnquiryPence(opportunity, enquiryCount);
    if (!per) return '';
    const saves = opportunitySaveCount(opportunity);
    const parts = [
      '<span class="org-opp-roi-metric" title="Estimated from listing and premium spend">' +
        esc(formatPenceGbp(per)) +
        ' per enquiry</span>',
    ];
    if (opportunityPremiumSpendPence(opportunity) > 0) {
      parts.push(
        '<span class="org-opp-roi-metric org-opp-roi-metric--muted">includes premium</span>'
      );
    }
    if (saves > 0 && enquiryCount > 0) {
      const rate = Math.round((enquiryCount / saves) * 100);
      parts.push(
        '<span class="org-opp-roi-metric org-opp-roi-metric--muted">' +
          esc(String(rate)) +
          '% of savers enquired</span>'
      );
    }
    return '<p class="org-opp-listing-card-roi">' + parts.join('') + '</p>';
  }

  function renderOpportunityRoiInsights() {
    const mount = document.getElementById('org-opp-roi-insights');
    if (!mount) return;
    const listings = state.opportunities || [];
    if (!listings.length) {
      mount.hidden = true;
      mount.replaceChildren();
      renderOpportunityInsightsEmpty();
      return;
    }
    let totalSpend = 0;
    let totalEnquiries = 0;
    let totalSaves = 0;
    let totalViews = 0;
    let hasPremiumSpend = false;
    listings.forEach(function (o) {
      const enquiries = opportunityEnquiriesForListing(o.id);
      totalSpend += opportunityTotalSpendPence(o);
      if (opportunityPremiumSpendPence(o) > 0) hasPremiumSpend = true;
      totalEnquiries += enquiries.length;
      totalSaves += opportunitySaveCount(o);
      totalViews += opportunityViewCount(o);
    });
    if (!totalEnquiries) {
      mount.hidden = true;
      mount.replaceChildren();
      renderOpportunityInsightsEmpty();
      return;
    }
    const avgPerEnquiry = Math.round(totalSpend / totalEnquiries);
    const saveRate =
      totalSaves > 0 ? Math.round((totalEnquiries / totalSaves) * 100) : null;
    mount.hidden = false;
    mount.innerHTML =
      '<p><strong>Business opportunities ROI:</strong> ' +
      esc(formatPenceGbp(avgPerEnquiry)) +
      ' average cost per enquiry across your business opportunities' +
      (hasPremiumSpend ? ' (listing + premium spend)' : '') +
      (totalViews ? '; ' + esc(String(totalViews)) + ' directory views recorded' : '') +
      '.' +
      (saveRate != null
        ? ' ' + esc(String(saveRate)) + '% of members who saved a business opportunity also enquired.'
        : '') +
      '</p>';
    renderOpportunityInsightsEmpty();
  }

  function opportunityPublicUrl(opportunity) {
    if (!opportunity) return '/opportunities/';
    if (opportunity.slug) return '/opportunities/' + encodeURIComponent(opportunity.slug);
    if (opportunity.id) return '/opportunities/' + encodeURIComponent(opportunity.id);
    return '/opportunities/';
  }

  function opportunityViewCount(opportunity) {
    return Math.max(0, Number(opportunity && opportunity.viewCount) || 0);
  }

  function opportunityEnquiriesRespondedCount(opportunityId) {
    return (opportunityEnquiriesForListing(opportunityId) || []).filter(function (e) {
      return String(e.status || '').toLowerCase() === 'responded';
    }).length;
  }

  function opportunityFunnelHtml(opportunity, enquiryCount) {
    const views = opportunityViewCount(opportunity);
    const saves = opportunitySaveCount(opportunity);
    const responded = opportunityEnquiriesRespondedCount(opportunity.id);
    const parts = [];
    if (views > 0) parts.push(esc(String(views)) + ' views');
    if (saves > 0) parts.push(esc(String(saves)) + ' saves');
    parts.push(esc(String(enquiryCount)) + ' enquiries');
    parts.push(esc(String(responded)) + ' responded');
    return (
      '<p class="org-opp-listing-card-funnel" title="Views → saves → enquiries → responses">' +
      parts.join(' → ') +
      '</p>'
    );
  }

  function opportunityCoachingMessage(opportunity, enquiryCount) {
    const views = opportunityViewCount(opportunity);
    const saves = opportunitySaveCount(opportunity);
    const st = String(opportunity?.status || '').toLowerCase();
    if (st !== 'published' && st !== 'live') return '';
    if (enquiryCount > 0) return '';
    if (saves > 0) {
      return 'Members are saving this business opportunity — sharpen your description or try premium spotlight to convert interest into enquiries.';
    }
    if (views > 0) {
      return 'Your business opportunity is getting views — share the public link or promote it on LinkedIn to turn traffic into enquiries.';
    }
    return 'Your business opportunity is live — copy the public link and share it with your network to get your first enquiries.';
  }

  function renderOpportunityCoaching() {
    const mount = document.getElementById('org-opp-coaching');
    if (!mount) return;
    const list = (state.opportunities || []).filter(function (o) {
      const st = String(o.status || '').toLowerCase();
      return st === 'published' || st === 'live';
    });
    const tips = list
      .map(function (o) {
        const enquiries = opportunityEnquiriesForListing(o.id);
        const msg = opportunityCoachingMessage(o, enquiries.length);
        if (!msg) return null;
        return (
          '<li><strong>' +
          esc(o.title || 'Business opportunity') +
          ':</strong> ' +
          esc(msg) +
          '</li>'
        );
      })
      .filter(Boolean);
    if (!tips.length) {
      mount.hidden = true;
      mount.innerHTML = '';
      renderOpportunityInsightsEmpty();
      return;
    }
    mount.hidden = false;
    mount.innerHTML =
      '<div class="org-opp-coaching-inner">' +
      '<h3 class="org-opp-coaching-title">Tips to get more enquiries</h3>' +
      '<ul class="org-opp-coaching-list">' +
      tips.join('') +
      '</ul></div>';
    renderOpportunityInsightsEmpty();
  }

  function renderOpportunityCompare() {
    const mount = document.getElementById('org-opp-compare');
    if (!mount) return;
    const list = (state.opportunities || []).slice();
    if (list.length < 2) {
      mount.hidden = true;
      mount.innerHTML = '';
      renderOpportunityInsightsEmpty();
      return;
    }
    const ranked = list
      .map(function (o) {
        const enquiries = opportunityEnquiriesForListing(o.id);
        const per =
          enquiries.length > 0 ? opportunityCostPerEnquiryPence(o, enquiries.length) : null;
        return {
          title: o.title || 'Untitled',
          enquiries: enquiries.length,
          saves: opportunitySaveCount(o),
          views: opportunityViewCount(o),
          per: per,
        };
      })
      .sort(function (a, b) {
        return b.enquiries - a.enquiries || b.saves - a.saves || b.views - a.views;
      });
    const best = ranked[0];
    mount.hidden = false;
    mount.innerHTML =
      '<p><strong>Best performer:</strong> ' +
      esc(best.title) +
      ' — ' +
      esc(String(best.enquiries)) +
      ' enquiries' +
      (best.per != null ? ', ' + esc(formatPenceGbp(best.per)) + ' per enquiry' : '') +
      (best.views ? ', ' + esc(String(best.views)) + ' views' : '') +
      '.</p>';
    renderOpportunityInsightsEmpty();
  }

  function opportunityRenewButtonHtml(opportunity) {
    const meta = opportunityExpiryMeta(opportunity);
    if (meta.tone !== 'warn' && meta.tone !== 'danger') return '';
    return (
      '<button type="button" class="org-btn org-btn-gold org-btn-sm" data-opp-renew="' +
      esc(opportunity.id) +
      '" data-opp-renew-months="3">Renew 3 months</button>'
    );
  }

  async function startOpportunityListingRenew(opportunityId, months, triggerBtn) {
    if (!opportunityId) return;
    const btn = triggerBtn || null;
    const termMonths = Math.max(3, Number(months) || 3);
    const prevLabel = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Opening checkout…';
    }
    try {
      const { ok, data } = await api('/api/organiser/opportunity-listing-checkout', {
        method: 'POST',
        body: JSON.stringify({ opportunityId: opportunityId, months: termMonths }),
      });
      if (ok && data.ok && data.url) {
        location.href = data.url;
        return;
      }
      window.alert(data.message || data.error || 'Could not start renewal checkout.');
    } catch {
      window.alert('Could not reach checkout. Try again in a moment.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prevLabel || 'Renew 3 months';
      }
    }
  }

  async function loadPremiumWaitlistStatus() {
    try {
      const { ok, data } = await api('/api/organiser/opportunity-premium-waitlist');
      if (ok) premiumWaitlistOn = Boolean(data.onWaitlist);
    } catch {
      premiumWaitlistOn = false;
    }
  }

  async function joinPremiumWaitlist(opportunityId, triggerBtn) {
    const btn = triggerBtn || null;
    const prevLabel = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Joining…';
    }
    try {
      const { ok, data } = await api('/api/organiser/opportunity-premium-waitlist', {
        method: 'POST',
        body: JSON.stringify({ opportunityId: opportunityId || null }),
      });
      if (!ok) throw new Error(data.message || data.error || 'waitlist_failed');
      premiumWaitlistOn = true;
      if (btn) btn.textContent = 'On waitlist ✓';
      else renderOpportunitiesList();
    } catch (e) {
      window.alert((e && e.message) || 'Could not join the waitlist.');
      if (btn) btn.textContent = prevLabel;
    } finally {
      if (btn) btn.disabled = premiumWaitlistOn;
    }
  }

  function scrollToSocialLinkedIn() {
    setRoute('social');
    setSocialTab('linkedin');
    requestAnimationFrame(function () {
      const el = document.getElementById('org-social-panel-linkedin');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function handleBusinessRenewUrlParam() {
    try {
      const params = new URLSearchParams(window.location.search);
      const renewId = params.get('renew');
      if (!renewId) return;
      const match = (state.opportunities || []).find(function (o) {
        return String(o.id) === String(renewId);
      });
      if (match) {
        requestAnimationFrame(function () {
          const row = document.querySelector('[data-opp-renew="' + renewId + '"]');
          if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    } catch {
      /* ignore */
    }
  }

  function opportunityCanUpgradePremium(opportunity) {
    const status = String(opportunity?.status || '').toLowerCase();
    if (status !== 'published' && status !== 'live') return false;
    return opportunityPremiumMeta(opportunity).tone === 'muted';
  }

  function opportunityPremiumUpsellHtml(opportunity) {
    if (!opportunityCanUpgradePremium(opportunity)) return '';
    const slots = opportunityPremiumSlots;
    if (slots && slots.full) {
      if (premiumWaitlistOn) {
        return (
          '<button type="button" class="org-btn org-btn-outline org-btn-sm org-opp-premium-upsell" disabled>On spotlight waitlist</button>'
        );
      }
      return (
        '<button type="button" class="org-btn org-btn-outline org-btn-sm org-opp-premium-waitlist" data-opp-waitlist="' +
        esc(opportunity.id) +
        '">Notify when slot opens</button>'
      );
    }
    const slotHint =
      slots && slots.available > 0 && slots.available <= 3
        ? ' title="Only ' +
          esc(String(slots.available)) +
          ' spotlight ' +
          (slots.available === 1 ? 'place' : 'places') +
          ' left"'
        : '';
    return (
      '<button type="button" class="org-btn org-btn-outline org-btn-sm org-opp-premium-upsell"' +
      slotHint +
      ' data-opp-premium-upgrade="' +
      esc(opportunity.id) +
      '">Upgrade to spotlight</button>'
    );
  }

  async function loadOpportunityPremiumSlots() {
    try {
      const res = await fetch('/api/opportunities?meta=premium-slots', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.premiumSlots) {
        opportunityPremiumSlots = data.premiumSlots;
        if (state.opportunitiesLoaded) renderOpportunitiesList();
      }
      await loadPremiumWaitlistStatus();
    } catch {
      /* ignore */
    }
  }

  async function startOpportunityPremiumCheckout(opportunityId, triggerBtn) {
    if (!opportunityId) return;
    const btn = triggerBtn || null;
    const prevLabel = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Opening checkout…';
    }
    try {
      const { ok, data } = await api('/api/organiser/opportunity-premium-checkout', {
        method: 'POST',
        body: JSON.stringify({ opportunityId: opportunityId }),
      });
      if (ok && data.ok && data.url) {
        location.href = data.url;
        return;
      }
      const msg =
        data.error === 'premium_slots_full'
          ? data.message || 'All spotlight places are taken — try again later.'
          : data.message || data.error || 'Could not start checkout.';
      window.alert(msg);
    } catch {
      window.alert('Could not reach checkout. Try again in a moment.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prevLabel || 'Upgrade to spotlight';
      }
    }
  }

  function fillEnquiryReplyTemplate(enquiry, templateKey) {
    let body = OPPORTUNITY_ENQUIRY_TEMPLATES[templateKey] || OPPORTUNITY_ENQUIRY_TEMPLATES.thanks;
    body = body
      .replace(/\{\{name\}\}/g, enquiry.enquirerName || 'there')
      .replace(/\{\{title\}\}/g, enquiry.opportunityTitle || 'our business opportunity');
    return body;
  }

  function buildEnquiryReplyMailto(enquiry, body) {
    const subject = 'Re: ' + (enquiry.opportunityTitle || 'your enquiry');
    return (
      'mailto:' +
      encodeURIComponent(enquiry.enquirerEmail || '') +
      '?subject=' +
      encodeURIComponent(subject) +
      '&body=' +
      encodeURIComponent(body || '')
    );
  }

  function openOpportunityEnquiryReplyModal(enquiry) {
    pendingOpportunityEnquiry = enquiry;
    const modal = document.getElementById('modal-opp-enquiry-reply');
    const sub = document.getElementById('modal-opp-enquiry-reply-sub');
    const to = document.getElementById('modal-opp-enquiry-reply-to');
    const msg = document.getElementById('modal-opp-enquiry-reply-message');
    const template = document.getElementById('modal-opp-enquiry-reply-template');
    const err = document.getElementById('modal-opp-enquiry-reply-error');
    if (!modal || !msg) return;
    if (sub) {
      sub.textContent =
        'Reply to ' +
        (enquiry.enquirerName || 'member') +
        ' about "' +
        (enquiry.opportunityTitle || 'your business opportunity') +
        '"';
    }
    if (to) to.textContent = enquiry.enquirerEmail || '—';
    if (template) template.value = 'thanks';
    msg.value = fillEnquiryReplyTemplate(enquiry, 'thanks');
    if (err) err.hidden = true;
    modal.hidden = false;
    modal.removeAttribute('hidden');
    modal.classList.add('is-open');
    msg.focus();
  }

  function bindOpportunityEnquiryReplyModal() {
    if (opportunityEnquiryReplyBound) return;
    const template = document.getElementById('modal-opp-enquiry-reply-template');
    const msg = document.getElementById('modal-opp-enquiry-reply-message');
    const sendBtn = document.getElementById('modal-opp-enquiry-reply-send');
    const copyBtn = document.getElementById('modal-opp-enquiry-reply-copy');
    if (!sendBtn && !copyBtn && !(template && msg)) return;
    opportunityEnquiryReplyBound = true;

    if (template && msg) {
      template.addEventListener('change', function () {
        if (!pendingOpportunityEnquiry) return;
        msg.value = fillEnquiryReplyTemplate(pendingOpportunityEnquiry, template.value);
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', async function () {
        if (!pendingOpportunityEnquiry) return;
        const body = msg ? msg.value.trim() : '';
        const err = document.getElementById('modal-opp-enquiry-reply-error');
        if (!body) {
          if (err) {
            err.hidden = false;
            err.textContent = 'Add a message before sending.';
          }
          return;
        }
        const enquiry = pendingOpportunityEnquiry;
        sendBtn.disabled = true;
        try {
          await markOpportunityEnquiryResponded(enquiry.id);
          renderStats();
          window.location.href = buildEnquiryReplyMailto(enquiry, body);
          closeModals();
        } catch (e) {
          if (err) {
            err.hidden = false;
            err.textContent =
              (e && e.message) || 'Could not update enquiry status. Try again or use your email app directly.';
          }
        } finally {
          sendBtn.disabled = false;
        }
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        const body = msg ? msg.value : '';
        if (!body) return;
        copyOrganiserText(body, copyBtn);
      });
    }
  }

  function opportunityEnquiryFilterLabel(opportunityId) {
    const match = (state.opportunities || []).find(function (o) {
      return String(o.id) === String(opportunityId);
    });
    return match?.title || 'Business opportunity';
  }

  function renderOpportunityEnquiryFilter() {
    const mount = document.getElementById('org-opp-enquiries-filter');
    if (!mount) return;
    if (!opportunityEnquiryFilterId) {
      mount.hidden = true;
      mount.replaceChildren();
      return;
    }
    mount.hidden = false;
    mount.innerHTML =
      '<span class="org-opp-enquiries-filter-label">Showing enquiries for</span> ' +
      '<span class="org-opp-enquiries-filter-chip">' +
      esc(opportunityEnquiryFilterLabel(opportunityEnquiryFilterId)) +
      '<button type="button" class="org-opp-enquiries-filter-clear" data-opp-enquiry-filter-clear aria-label="Clear enquiry filter">×</button>' +
      '</span>';
  }

  function bindBusinessIntroPanel() {
    if (businessIntroPanelBound) return;
    const toggle = document.getElementById('org-business-intro-toggle');
    const body = document.getElementById('org-business-intro-body');
    if (!toggle || !body) return;
    businessIntroPanelBound = true;

    function applyCollapsed(collapsed) {
      body.hidden = collapsed;
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      const chev = toggle.querySelector('.org-business-intro-chev');
      if (chev) chev.textContent = collapsed ? 'Show' : 'Hide';
    }

    toggle.addEventListener('click', function () {
      const collapsed = !body.hidden;
      applyCollapsed(collapsed);
      try {
        localStorage.setItem(BUSINESS_INTRO_COLLAPSE_KEY, collapsed ? '1' : '0');
      } catch {
        /* ignore */
      }
    });

    window.__applyBusinessIntroCollapsed = applyCollapsed;
  }

  function updateBusinessIntroPanel() {
    const head = document.getElementById('org-business-intro-head');
    const body = document.getElementById('org-business-intro-body');
    if (!body) return;
    bindBusinessIntroPanel();
    const hasListings = hasOpportunityListings();
    if (head) head.hidden = !hasListings;
    if (!hasListings) {
      body.hidden = false;
      return;
    }
    let collapsed = true;
    try {
      const stored = localStorage.getItem(BUSINESS_INTRO_COLLAPSE_KEY);
      if (stored === '0') collapsed = false;
    } catch {
      collapsed = true;
    }
    if (window.__applyBusinessIntroCollapsed) window.__applyBusinessIntroCollapsed(collapsed);
  }

  function updateOpportunityEnquiryUi() {
    const newCount = Number(state.opportunityEnquiriesNewCount) || 0;
    const navBadge = document.getElementById('org-opp-enquiry-nav-badge');

    if (navBadge) {
      navBadge.hidden = newCount < 1;
      navBadge.textContent = newCount > 99 ? '99+' : newCount > 1 ? String(newCount) : 'Reply';
    }
    refreshOrgBottomBusinessCount();
    updateBusinessTabCounts();
    renderOrganiserNotices();
  }

  function renderOpportunityEnquiries() {
    const body = document.getElementById('opp-enquiries-body');
    const empty = document.getElementById('opp-enquiries-empty');
    if (!body) return;

    let list = state.opportunityEnquiries || [];
    if (opportunityEnquiryFilterId) {
      list = list.filter(function (e) {
        return String(e.opportunityId || '') === String(opportunityEnquiryFilterId);
      });
    }
    renderOpportunityEnquiryFilter();
    body.innerHTML = '';
    if (!list.length) {
      setOrgEmpty(empty, {
        show: true,
        title: opportunityEnquiryFilterId ? 'No enquiries for this business opportunity' : undefined,
        text: opportunityEnquiryFilterId
          ? 'Try clearing the filter to see all enquiries.'
          : undefined,
        hideActions: Boolean(opportunityEnquiryFilterId),
      });
      updateOpportunityEnquiryUi();
      return;
    }
    setOrgEmpty(empty, { show: false });

    list.forEach((enquiry) => {
      const tr = document.createElement('tr');
      const status = String(enquiry.status || 'new').toLowerCase();
      const statusKey =
        status === 'responded' ? 'live' : status === 'read' ? 'archived' : 'upcoming';
      const age = formatRelativeAge(enquiry.createdAt);
      const ageMs = enquiry.createdAt ? Date.now() - new Date(enquiry.createdAt).getTime() : 0;
      if (status === 'new' && ageMs > 86400000) tr.className = 'org-enquiry-row is-stale';
      tr.innerHTML =
        '<td data-label="Received">' +
        esc(formatDate(enquiry.createdAt)) +
        (age ? '<br><span class="org-payout-muted">' + esc(age) + '</span>' : '') +
        '</td><td class="org-td-name" data-label="Listing">' +
        esc(enquiry.opportunityTitle || 'Business opportunity') +
        '</td><td data-label="From">' +
        esc(enquiry.enquirerName || '—') +
        '<br><span class="org-payout-muted">' +
        esc(enquiry.enquirerEmail || '') +
        '</span></td><td class="org-enquiry-message" data-label="Message">' +
        esc(enquiry.message || '') +
        '</td><td data-label="Status">' +
        statusBadgeHtml(statusKey, enquiryStatusLabel(status)) +
        '</td><td class="org-td-actions org-td-actions--wrap" data-label="Actions">' +
        '<button type="button" class="org-btn org-btn-gold org-btn-sm" data-opp-enquiry-reply-open="' +
        esc(enquiry.id) +
        '">Reply</button> ' +
        (status === 'new'
          ? '<button type="button" class="org-btn org-btn-outline org-btn-sm" data-opp-enquiry-read="' +
            esc(enquiry.id) +
            '">Mark read</button>'
          : '') +
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

  function scrollToBusinessEnquiries(opportunityId) {
    if (opportunityId) opportunityEnquiryFilterId = String(opportunityId);
    else opportunityEnquiryFilterId = null;
    setRoute('business-enquiries');
  }

  function updateBusinessListPageHead() {
    const titleEl = document.getElementById('org-business-list-title');
    const leadEl = document.getElementById('org-business-list-lead');
    if (!titleEl || !leadEl) return;
    if (hasOpportunityListings()) {
      titleEl.textContent = 'Your business opportunities';
      leadEl.textContent =
        'See how your business opportunities are performing, then add another franchise, partnership, or side hustle when you are ready.';
    } else {
      titleEl.textContent = 'List a business opportunity';
      leadEl.textContent =
        'See how business opportunities work, what they cost, and start promoting a franchise, partnership, or side hustle on the hub.';
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
    const renewUrl =
      opportunity && opportunity.id
        ? '/organiser/opportunity-edit?id=' + encodeURIComponent(opportunity.id)
        : '';
    const renewLink =
      (meta.tone === 'warn' || meta.tone === 'danger') && renewUrl
        ? ' <a class="org-opp-renew-link" href="' + esc(renewUrl) + '">Renew</a>'
        : '';
    return '<span class="' + cls + '">' + esc(meta.label) + '</span>' + renewLink;
  }

  function renderOpportunityExpiryBanner() {
    const mount = document.getElementById('org-opp-expiry-banner');
    if (!mount) return;
    const expiring = (state.opportunities || []).filter(function (o) {
      const meta = opportunityExpiryMeta(o);
      return meta.tone === 'warn' || meta.tone === 'danger';
    });
    if (!expiring.length) {
      mount.hidden = true;
      mount.replaceChildren();
      return;
    }
    const first = expiring[0];
    const copy =
      expiring.length === 1
        ? 'Your business opportunity <strong>' + esc(first.title || 'Untitled') + '</strong> expires soon.'
        : expiring.length + ' of your business opportunities expire soon.';
    mount.hidden = false;
    mount.innerHTML =
      '<div class="org-inline-banner org-inline-banner--warn">' +
      '<p>' +
      copy +
      ' Renew to stay visible on the business opportunities directory.</p>' +
      (first.id
        ? '<button type="button" class="org-btn org-btn-gold org-btn-sm" data-opp-renew="' +
          esc(first.id) +
          '" data-opp-renew-months="3">Renew 3 months</button>'
        : '') +
      '</div>';
  }

  function opportunitySaveCount(o) {
    return Math.max(0, Number(o && o.saveCount) || 0);
  }

  function opportunitySaveCountHtml(o) {
    const n = opportunitySaveCount(o);
    if (!n) return '<span class="muted">0</span>';
    return (
      '<span class="org-opp-save-count" title="Members who saved this business opportunity — anonymous">' +
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
      updateBusinessIntroPanel();
      return;
    }
    wrap.hidden = false;
    mount.innerHTML = '';
    list.forEach((o) => {
      const st = opportunityStatusForBadge(o);
      const enquiries = opportunityEnquiriesForListing(o.id);
      const newCount = enquiries.filter((e) => String(e.status || '').toLowerCase() === 'new').length;
      const expiry = opportunityExpiryMeta(o);
      const premiumBadge = opportunityPremiumBadgeHtml(o);
      const editUrl = '/organiser/opportunity-edit?id=' + encodeURIComponent(o.id);
      const viewUrl = opportunityPublicUrl(o);
      const publicUrl = window.location.origin + viewUrl;
      const card = document.createElement('article');
      card.className = 'org-opp-listing-card';
      card.innerHTML =
        '<header class="org-opp-listing-card-head">' +
        '<h3 class="org-opp-listing-card-title"><a href="' +
        esc(editUrl) +
        '">' +
        esc(o.title || 'Untitled') +
        '</a></h3>' +
        '<span class="org-opp-listing-card-badges">' +
        statusBadgeHtml(st.key, st.label) +
        (premiumBadge ? ' ' + premiumBadge : '') +
        '</span>' +
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
        '<div class="org-stat gold"><div class="org-stat-label">Expires</div><div class="org-stat-value org-stat-value--text' +
        (expiry.tone === 'danger' ? ' is-danger' : expiry.tone === 'warn' ? ' is-warn' : '') +
        '">' +
        esc(expiry.label) +
        '</div></div>' +
        '</div>' +
        opportunityFunnelHtml(o, enquiries.length) +
        opportunityRoiFootnoteHtml(o, enquiries.length) +
        '<div class="org-opp-listing-card-actions">' +
        '<a class="org-btn org-btn-outline org-btn-sm" href="' +
        esc(editUrl) +
        '">Edit</a> ' +
        '<a class="org-btn org-btn-outline org-btn-sm" href="' +
        esc(viewUrl) +
        '" target="_blank" rel="noopener">View live</a> ' +
        '<button type="button" class="org-btn org-btn-outline org-btn-sm" data-copy-link="' +
        esc(publicUrl) +
        '">Copy link</button> ' +
        '<button type="button" class="org-btn org-btn-outline org-btn-sm" data-opp-promote-social="1">Promote</button> ' +
        (enquiries.length
          ? '<button type="button" class="org-btn org-btn-gold org-btn-sm" data-opp-enquiry-filter="' +
            esc(o.id) +
            '">View enquiries</button> '
          : '') +
        opportunityRenewButtonHtml(o) +
        ' ' +
        opportunityPremiumUpsellHtml(o) +
        '</div>';
      mount.appendChild(card);
    });
    updateBusinessListPageHead();
    updateBusinessIntroPanel();
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
      renderOpportunityExpiryBanner();
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
        '<td class="org-td-name" data-label="Title"><a class="org-td-name-click" href="' +
        esc(editUrl) +
        '">' +
        esc(o.title || 'Untitled') +
        '</a></td><td data-label="Status">' +
        statusBadgeHtml(st.key, st.label) +
        '</td><td data-label="Premium">' +
        opportunityPremiumCellHtml(o) +
        '</td><td data-label="Views">' +
        (opportunityViewCount(o)
          ? esc(String(opportunityViewCount(o)))
          : '<span class="muted">0</span>') +
        '</td><td data-label="Enquiries">' +
        (enquiries.length
          ? '<button type="button" class="org-opp-enquiry-count-link" data-opp-enquiry-filter="' +
            esc(o.id) +
            '">' +
            esc(String(enquiries.length)) +
            '</button>'
          : '<span class="muted">0</span>') +
        '</td><td data-label="New">' +
        (newCount
          ? '<span class="org-opp-new-count">' + esc(String(newCount)) + '</span>'
          : '<span class="muted">0</span>') +
        '</td><td data-label="Saved">' +
        opportunitySaveCountHtml(o) +
        '</td><td data-label="Expires">' +
        opportunityExpiryCellHtml(o) +
        '</td><td class="org-td-actions" data-label="Actions">' +
        '<a class="org-btn org-btn-outline org-btn-sm" href="' +
        esc(editUrl) +
        '">Edit</a> ' +
        '<a class="org-btn org-btn-outline org-btn-sm" href="' +
        esc(viewUrl) +
        '" target="_blank" rel="noopener">View</a> ' +
        '<button type="button" class="org-btn org-btn-outline org-btn-sm" data-copy-link="' +
        esc(window.location.origin + opportunityPublicUrl(o)) +
        '">Copy link</button> ' +
        opportunityRenewButtonHtml(o) +
        ' ' +
        opportunityPremiumUpsellHtml(o) +
        '</td>';
      body.appendChild(tr);
    });
    renderOpportunityExpiryBanner();
    renderOpportunityPerformance();
    renderOpportunityRoiInsights();
    renderOpportunityCompare();
    renderOpportunityCoaching();
    updateBusinessTabCounts();
    handleBusinessRenewUrlParam();
  }

  async function loadOpportunitiesList() {
    if (state.opportunitiesLoaded) {
      renderOpportunitiesList();
      updateBusinessListPageHead();
      return;
    }
    try {
      const { ok, data } = await api('/api/organiser/opportunities');
      if (!ok) throw new Error(data.message || data.error || 'load_failed');
      state.opportunities = data.opportunities || [];
      state.opportunitiesLoaded = true;
      showOpportunityLoadError('');
      renderStats();
      renderOpportunitiesList();
      if (linkedInPostBuilder && linkedInPostBuilder.refreshOpportunities) {
        linkedInPostBuilder.refreshOpportunities();
      }
    } catch (e) {
      showOpportunityLoadError(
        'Could not load your business opportunities. Refresh the page or try again in a moment.'
      );
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
      showOpportunityLoadError('');
    } catch (e) {
      state.opportunityEnquiries = [];
      state.opportunityEnquiriesNewCount = 0;
      showOpportunityLoadError('Could not load enquiries. Refresh the page or try again in a moment.');
    } finally {
      if (hint) hint.hidden = true;
      renderHubPortalMeta();
      renderOrganiserNotices();
      renderOpportunityEnquiries();
      renderOpportunitiesList();
    }
  }

  async function markOpportunityEnquiryRead(enquiryId) {
    const { ok, data } = await api('/api/organiser/opportunity-enquiries', {
      method: 'PATCH',
      body: JSON.stringify({ id: enquiryId, status: 'read' }),
    });
    if (!ok) throw new Error(data.message || data.error || 'enquiry_update_failed');
    const enquiry = data.enquiry;
    if (!enquiry) throw new Error('enquiry_update_failed');
    const idx = state.opportunityEnquiries.findIndex((e) => e.id === enquiry.id);
    if (idx >= 0) state.opportunityEnquiries[idx] = enquiry;
    state.opportunityEnquiriesNewCount = opportunityEnquiryNewCount(state.opportunityEnquiries);
    renderOpportunityEnquiries();
    renderOpportunitiesList();
    updateOpportunityEnquiryUi();
    renderStats();
  }

  async function markOpportunityEnquiryResponded(enquiryId) {
    const { ok, data } = await api('/api/organiser/opportunity-enquiries', {
      method: 'PATCH',
      body: JSON.stringify({ id: enquiryId, status: 'responded' }),
    });
    if (!ok) {
      throw new Error(data.message || data.error || 'enquiry_update_failed');
    }
    const enquiry = data.enquiry;
    if (!enquiry) {
      throw new Error('enquiry_update_failed');
    }
    const idx = state.opportunityEnquiries.findIndex((e) => e.id === enquiry.id);
    if (idx >= 0) state.opportunityEnquiries[idx] = enquiry;
    state.opportunityEnquiriesNewCount = opportunityEnquiryNewCount(state.opportunityEnquiries);
    renderOpportunityEnquiries();
    renderOpportunitiesList();
    updateOpportunityEnquiryUi();
  }

  function renderAll() {
    renderStats();
    renderOrganiserNotices();
    renderGroups();
    if (document.querySelector('[data-org-page="memberships"].is-active')) renderMembershipsPage();
    if (document.querySelector('[data-org-page="team"].is-active')) renderTeam();
    if (document.querySelector('[data-org-page="events"].is-active') && state.eventsLoaded) {
      renderMyEventsHub();
      fillEventSelect(document.getElementById('ticket-event'));
    }
    updateOpportunityEnquiryUi();
    updateGettingStartedPanel();
    if (state.opportunitiesLoaded) renderOpportunitiesList();
    renderRevenueConnectCopy();
    if (document.querySelector('[data-org-page="business-overview"].is-active') && state.opportunitiesLoaded) {
      if (businessSubRoute === 'business-enquiries') renderOpportunityEnquiries();
      else if (businessSubRoute === 'business-insights') {
        renderOpportunityRoiInsights();
        renderOpportunityCompare();
        renderOpportunityCoaching();
        renderOpportunityInsightsEmpty();
      }
    }
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

  let orgRouteLoadGen = 0;
  let lastOrgRouteLoadKey = '';

  function orgRouteLoadingLabel(page, sub, businessSub) {
    if (page === 'events') {
      const labels = {
        'events-list': 'Loading events…',
        'events-tickets': 'Loading tickets…',
        'events-attendees': 'Loading attendees…',
        'events-cancellations': 'Loading cancellations…',
        'events-reviews': 'Loading reviews…',
        'events-revenue': 'Loading revenue…',
      };
      return labels[sub] || 'Loading events…';
    }
    if (page === 'business-overview') {
      const labels = {
        'business-listings': 'Loading business opportunities…',
        'business-enquiries': 'Loading enquiries…',
        'business-insights': 'Loading insights…',
        'business-guide': 'Loading guide…',
      };
      return labels[businessSub] || 'Loading…';
    }
    if (page === 'communicate') return 'Loading Communicate…';
    if (page === 'social' || page === 'social-spotlight') return 'Loading Promote…';
    if (page === 'memberships') return 'Loading memberships…';
    if (page === 'groups') return 'Loading organiser pages…';
    if (page === 'team') return 'Loading team…';
    if (page === 'business-list') return 'Loading listing form…';
    if (page === 'dashboard') return 'Loading overview…';
    return 'Loading…';
  }

  function beginOrgRouteLoading(message) {
    const gen = ++orgRouteLoadGen;
    const el = document.getElementById('org-route-loading');
    const main = document.getElementById('org-main');
    if (el) {
      const title = el.querySelector('.org-route-loading-title');
      if (title) title.textContent = message || 'Loading…';
      el.hidden = false;
      el.setAttribute('aria-hidden', 'false');
      el.setAttribute('aria-busy', 'true');
    }
    if (main) main.classList.add('is-route-loading');
    return { gen: gen, startedAt: performance.now() };
  }

  function endOrgRouteLoading(token) {
    if (!token || token.gen !== orgRouteLoadGen) return;
    const el = document.getElementById('org-route-loading');
    const main = document.getElementById('org-main');
    if (el) {
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('aria-busy', 'false');
    }
    if (main) main.classList.remove('is-route-loading');
  }

  function settleOrgRouteLoading(token, tasks) {
    if (!token) return;
    const list = (Array.isArray(tasks) ? tasks : []).filter(Boolean);
    Promise.all(
      list.map(function (task) {
        return Promise.resolve(task).catch(function () {
          return null;
        });
      })
    ).then(function () {
      const minMs = 280;
      const elapsed = performance.now() - (token.startedAt || 0);
      const wait = Math.max(0, minMs - elapsed);
      window.setTimeout(function () {
        endOrgRouteLoading(token);
      }, wait);
    });
  }

  function isDashboardBootLoading() {
    const el = document.getElementById('org-dash-loading');
    return Boolean(el && !el.hidden && el.classList.contains('is-active'));
  }

  async function loadBootstrap(options) {
    const silent = Boolean(options && options.silent);
    const skipClaimUi = Boolean(options && options.skipClaimUi);
    const prefetch = options && options.prefetch;
    if (!silent) setDashboardLoading(true);
    let postReady = null;
    try {
    const { ok, data } = await (prefetch || apiWithTimeout('/api/organiser/bootstrap', {}, 30000));
    if (!ok) throw new Error(data.message || data.error || 'load_failed');
    cacheBootstrapForEmbed(data);
    state.groups = dedupeGroupsById(data.groups || []);
    state.pendingClaimGroups = sortPendingClaimGroups(data.pendingClaimGroups || []);
    state.pendingClaimOpportunities = data.pendingClaimOpportunities || [];
    state.events = data.events || [];
    state.upcomingEvents = data.upcomingEvents || [];
    state.eventsTotal = data.eventsPagination?.total ?? state.events.length;
    state.eventsChunkOffset = data.eventsPagination?.offset ?? 0;
    state.eventsHasMore = Boolean(data.eventsPagination?.hasMore);
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
    if (
      !state.events.length &&
      state.eventSummaries.length &&
      data.eventsPagination?.total == null
    ) {
      state.eventsHasMore = state.eventSummaries.length > EVENTS_FETCH_SIZE;
    }
    state.eventsFullyLoaded = !state.eventsHasMore;
    invalidateEventsLoad();
    state.eventsLoaded = false;
    state.eventsEnrichment = 'none';
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
      // Persist the faster default so refreshes stay on personal scope.
      try {
        if (!/(?:^|; )hub_organiser_scope=/.test(document.cookie)) {
          setOrganiserScopeCookie('my');
        }
      } catch {
        /* ignore */
      }
    } else if (data.groupsError) {
      state.dashboardScope = { kind: 'groups_error', message: data.groupsError };
    } else if (!state.groups.length && !state.pendingClaimGroups.length && !(state.pendingClaimOpportunities || []).length) {
      state.dashboardScope = { kind: 'onboarding' };
    } else {
      state.dashboardScope = null;
    }

    if (!silent) showOrganiserAlert(null);
    showOrganiserEmailVerifyBanner();

    applyPendingGroupSave();
    pruneStaleEventFilters();
    bootstrapReady = true;
    renderAll();
    if (!document.querySelector('[data-org-page="events"].is-active')) {
      renderStripeConnectBanner();
    }
    postReady = function () {
      syncPendingClaimFlag();
      if (!skipClaimUi) {
        renderGroupClaimModal();
        renderOpportunityClaimModal();
        if (window.HubOrganiserOnboarding && window.HubOrganiserOnboarding.initAfterDashboardReady) {
          window.HubOrganiserOnboarding.initAfterDashboardReady();
        }
      } else {
        updateGettingStartedPanel();
        updateSetupResumeBanner();
        syncOverviewSetupQuietMode();
      }
      updateTeamNavBadge();
      refreshPendingApplicationsSummary();
      enforceEventsOrganiserGate();
      if (document.querySelector('[data-org-page="events"].is-active')) {
        setEventsSub(eventsSubRoute);
      }
      if (parseRoute().page === 'memberships' || parseRoute().page === 'member-lists') {
        maybeRedirectToSingleMemberList();
      }
      if (parseRoute().page === 'communicate' || parseRoute().openAttendeeEmail) {
        ensureAttendeeEmailPanelReady(filters.attendeesEvent !== 'all' ? filters.attendeesEvent : '');
      }
      // Warm editor CSS after first paint so group/event drawers open without a flash.
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(function () {
          ensureEventEditCss();
        }, { timeout: 4000 });
      } else {
        setTimeout(function () {
          ensureEventEditCss();
        }, 1800);
      }
    };
    } catch (e) {
      if (!silent) {
        showOrganiserAlert('Could not load dashboard: ' + esc(e.message || 'load_failed'), true);
      }
      throw e;
    } finally {
      if (!silent) setDashboardLoading(false);
    }
    if (postReady) {
      if (silent) postReady();
      else requestAnimationFrame(postReady);
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

  function bindMobileFilterTogglesOnce() {
    if (window.__hubOrgMobileFiltersBound) return;
    window.__hubOrgMobileFiltersBound = true;

    function wrapFilterBars() {
      if (!window.matchMedia || !window.matchMedia('(max-width: 768px)').matches) return;
      document.querySelectorAll('.org-sub-page .org-filter-bar').forEach(function (bar) {
        if (bar.dataset.mobileFilterBound) return;
        if (bar.closest('.org-mobile-filters')) {
          bar.dataset.mobileFilterBound = '1';
          return;
        }
        bar.dataset.mobileFilterBound = '1';
        const wrap = document.createElement('div');
        wrap.className = 'org-mobile-filters';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'org-btn org-btn-outline org-btn-sm org-mobile-filters-toggle';
        btn.textContent = 'Filters';
        btn.setAttribute('aria-expanded', 'false');
        const parent = bar.parentNode;
        if (!parent) return;
        parent.insertBefore(wrap, bar);
        wrap.appendChild(btn);
        wrap.appendChild(bar);
        bar.classList.add('org-filter-bar--collapsible');
        bar.hidden = true;
        btn.addEventListener('click', function () {
          const open = bar.hidden;
          bar.hidden = !open;
          btn.setAttribute('aria-expanded', open ? 'true' : 'false');
          btn.textContent = open ? 'Hide filters' : 'Filters';
        });
      });
    }

    wrapFilterBars();
    window.addEventListener('resize', function () {
      wrapFilterBars();
    });
  }

  function bindUi() {
    bindNotificationsPanelOnce();
    bindOrgMoreSheetOnce();
    bindScopeButtonOnce();
    bindMobileFilterTogglesOnce();

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

    bindOpportunityEnquiryReplyModal();

    document.getElementById('btn-needs-organiser-page-create')?.addEventListener('click', () => {
      closeModals();
      openGroupEditorDrawer();
    });
    document.getElementById('btn-needs-organiser-page-search')?.addEventListener('click', () => {
      closeModals();
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

    document.querySelectorAll('.org-add-menu-item[href="/organiser/event-edit"]').forEach((el) => {
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

    document.querySelectorAll('[data-business-tab]').forEach((tab) => {
      tab.addEventListener('click', () => {
        const route = tab.getAttribute('data-business-tab');
        if (route) setRoute(route);
      });
    });

    document.querySelectorAll('[data-business-tab-link]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-business-tab-link');
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
          setRoute('business-enquiries');
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
        updateMyEventsTabCounts();
        renderEvents();
        if (eventsSubRoute === 'events-revenue') renderRevenue();
      });
    }

    const hideUnpublishedEl = document.getElementById('filter-events-hide-unpublished');
    if (hideUnpublishedEl) {
      hideUnpublishedEl.checked = Boolean(filters.eventsHideUnpublished);
      hideUnpublishedEl.addEventListener('change', () => {
        filters.eventsHideUnpublished = hideUnpublishedEl.checked;
        listPages.events = 1;
        listPages.revenue = 1;
        updateMyEventsTabCounts();
        syncSharedEventFiltersUi();
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
        updateMyEventsTabCounts();
        renderRevenue();
        if (eventsSubRoute === 'events-list') renderEvents();
      });
    }

    const revHideUnpublishedEl = document.getElementById('filter-revenue-hide-unpublished');
    if (revHideUnpublishedEl) {
      revHideUnpublishedEl.checked = Boolean(filters.eventsHideUnpublished);
      revHideUnpublishedEl.addEventListener('change', () => {
        filters.eventsHideUnpublished = revHideUnpublishedEl.checked;
        listPages.events = 1;
        listPages.revenue = 1;
        updateMyEventsTabCounts();
        syncSharedEventFiltersUi();
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
    const btnEmailAttendeeList = document.getElementById('btn-email-attendee-list');
    if (btnEmailAttendeeList) {
      btnEmailAttendeeList.addEventListener('click', function () {
        const eventId = String(filters.attendeesEvent || 'all');
        if (!eventId || eventId === 'all') {
          showOrganiserAlert('Pick a single event first, then open Attendee round-up.', true);
          return;
        }
        openAttendeeEmailForEvent(eventId);
      });
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

        const enquiryReplyOpen = e.target.closest('[data-opp-enquiry-reply-open]');
        if (enquiryReplyOpen) {
          e.preventDefault();
          const enquiryId = enquiryReplyOpen.getAttribute('data-opp-enquiry-reply-open');
          const enquiry = (state.opportunityEnquiries || []).find(function (item) {
            return String(item.id) === String(enquiryId);
          });
          if (enquiry) openOpportunityEnquiryReplyModal(enquiry);
          return;
        }

        const premiumUpgradeBtn = e.target.closest('[data-opp-premium-upgrade]');
        if (premiumUpgradeBtn) {
          e.preventDefault();
          startOpportunityPremiumCheckout(
            premiumUpgradeBtn.getAttribute('data-opp-premium-upgrade'),
            premiumUpgradeBtn
          );
          return;
        }

        const renewBtn = e.target.closest('[data-opp-renew]');
        if (renewBtn) {
          e.preventDefault();
          startOpportunityListingRenew(
            renewBtn.getAttribute('data-opp-renew'),
            Number(renewBtn.getAttribute('data-opp-renew-months')) || 3,
            renewBtn
          );
          return;
        }

        const waitlistBtn = e.target.closest('[data-opp-waitlist]');
        if (waitlistBtn) {
          e.preventDefault();
          joinPremiumWaitlist(waitlistBtn.getAttribute('data-opp-waitlist'), waitlistBtn);
          return;
        }

        const enquiryReadBtn = e.target.closest('[data-opp-enquiry-read]');
        if (enquiryReadBtn) {
          e.preventDefault();
          markOpportunityEnquiryRead(enquiryReadBtn.getAttribute('data-opp-enquiry-read')).catch(
            function () {
              window.alert('Could not mark enquiry as read.');
            }
          );
          return;
        }

        const promoteBtn = e.target.closest('[data-opp-promote-social]');
        if (promoteBtn) {
          e.preventDefault();
          scrollToSocialLinkedIn();
          return;
        }

        const enquiryFilterBtn = e.target.closest('[data-opp-enquiry-filter]');
        if (enquiryFilterBtn) {
          e.preventDefault();
          scrollToBusinessEnquiries(enquiryFilterBtn.getAttribute('data-opp-enquiry-filter'));
          return;
        }

        const enquiryFilterClear = e.target.closest('[data-opp-enquiry-filter-clear]');
        if (enquiryFilterClear) {
          e.preventDefault();
          scrollToBusinessEnquiries(null);
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

    document.querySelectorAll('[data-org-memberships-nav], [data-org-member-lists-nav]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigateToMemberships();
      });
    });

    document.querySelectorAll('[data-org-route]').forEach((el) => {
      if (el.hasAttribute('data-org-memberships-nav') || el.hasAttribute('data-org-member-lists-nav')) return;
      if (el.classList.contains('org-bottom-nav-link')) return;
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
        r.page === 'memberships' ||
        r.page === 'member-lists' ||
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
      if (listKey === 'events') renderEvents();
      else if (listKey === 'groups') renderGroups();
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
      eventDrawerBack.addEventListener('click', goBackFromEventDrawer);
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
      if (e.data && e.data.type === 'hub-event-drawer-bootstrap-request') {
        const frame = document.getElementById('org-event-drawer-frame');
        if (frame && e.source === frame.contentWindow) {
          refreshEmbedBootstrapCache();
          try {
            e.source.postMessage(embedBootstrapPayload(), window.location.origin);
          } catch {
            sendEmbedBootstrapToFrame(frame);
          }
        }
        return;
      }
      if (e.data && e.data.type === 'hub-event-cancel-request') {
        const cancelId = e.data.eventId || '';
        if (cancelId) openCancelEventModal(cancelId);
        return;
      }
      if (e.data && e.data.type === 'hub-event-saved') {
        closeEventEditorDrawer();
        showOrganiserAlert(
          e.data.draft ? 'Event changes saved.' : 'Event saved.',
          false
        );
        loadBootstrap().then(renderAll);
        return;
      }
      if (e.data && e.data.type === 'hub-event-drawer-ready') {
        setEventDrawerLoading(false);
        if (e.data.progressStep && eventDrawerCreateFlow) {
          eventDrawerProgressStep = e.data.progressStep;
          renderEventDrawerProgress(eventDrawerProgressStep);
        }
        return;
      }
      if (e.data && e.data.type === 'hub-payment-setup-linked') {
        // Tickets drawer linked bank details in an iframe — CustomEvents stay in-frame.
        window.dispatchEvent(
          new CustomEvent('hub-payment-setup-linked', {
            detail: {
              groupId: e.data.groupId,
              sourceGroupId: e.data.sourceGroupId,
              status: e.data.status,
            },
          })
        );
        return;
      }
      if (e.data && e.data.type === 'hub-event-drawer-busy') {
        setEventDrawerLoading(Boolean(e.data.busy), e.data.message || '');
        if (e.data.progressStep && eventDrawerCreateFlow) {
          eventDrawerProgressStep = e.data.progressStep;
          renderEventDrawerProgress(eventDrawerProgressStep);
        }
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
      if (e.data && e.data.type === 'hub-event-goto-location') {
        const ids = Array.isArray(e.data.eventIds) ? e.data.eventIds : [];
        if (ids.length) openEventLocationDrawer(ids[0], { eventIds: ids, title: e.data.title || '' });
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
          const publishedIds = publishedEventIds.length
            ? publishedEventIds.join(',')
            : publishedEventId;
          const publishedTitle = e.data.title ? String(e.data.title) : '';
          const publishedImage = e.data.imageUrl ? String(e.data.imageUrl) : '';
          try {
            sessionStorage.setItem(
              'hub_event_published_preview',
              JSON.stringify({
                ids: publishedIds,
                title: publishedTitle,
                image: publishedImage,
              })
            );
          } catch {
            /* ignore */
          }
          const qs = new URLSearchParams();
          qs.set('ids', publishedIds);
          qs.set('published', '1');
          if (publishedTitle) qs.set('title', publishedTitle);
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
        if (editId) openEventEditorDrawer(editId, { fromLocation: true });
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
        if (!pendingCancelRefundRequired) return;
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
    const loadingSafety = window.setTimeout(function () {
      setDashboardLoading(false);
      showOrganiserAlert(
        'Dashboard is taking longer than expected. Try refreshing the page.',
        true
      );
    }, 45000);
    try {
      state.user = user;
      if (signin) signin.hidden = true;
      if (shell) shell.hidden = false;
      const payoutSubmit = document.getElementById('btn-payout-submit');
      if (payoutSubmit) {
        payoutSubmit.addEventListener('click', submitPayoutRequest);
      }
      const alumniSendBtn = document.getElementById('modal-alumni-invites-send');
      if (alumniSendBtn) {
        alumniSendBtn.addEventListener('click', submitAlumniInvites);
      }
      const ceMemberSendBtn = document.getElementById('modal-ce-member-invites-send');
      if (ceMemberSendBtn) {
        ceMemberSendBtn.addEventListener('click', submitCeMemberInvites);
      }

      // Start bootstrap while binding the large DOM — overlaps network with CPU work.
      const bootstrapPrefetch = apiWithTimeout('/api/organiser/bootstrap', {}, 30000);
      bindForms();
      bindTeamUi();
      bindOnboardingPipeline();
      bindGroupClaimUi();
      bindSetupResumeUi();
      bindLaunchSetupUi();
      bindReadyEventUi();
      bindUi();
      const initial = resolveInitialRoute();
      setRoute(initial.sub || initial.page);
      await loadBootstrap({ silent: true, prefetch: bootstrapPrefetch });
      applyPendingGroupContinue();
      try {
        const bootParams = new URLSearchParams(window.location.search);
        if (bootParams.get('onboard') === 'launch' && window.HubOrganiserLaunchSetup) {
          window.HubOrganiserLaunchSetup.clearDismissed();
          if ((state.pendingClaimGroups || []).length > 0) {
            renderGroupClaimModal();
          } else if ((state.pendingClaimOpportunities || []).length > 0) {
            renderOpportunityClaimModal();
          } else {
            const nextLaunch = window.HubOrganiserLaunchSetup.nextItem(launchSetupInput());
            if (nextLaunch) {
              openLaunchSetupItem(nextLaunch);
            } else {
              showReadyForEventPrompt();
            }
          }
          if (window.history.replaceState) {
            const url = new URL(window.location.href);
            url.searchParams.delete('onboard');
            window.history.replaceState({}, '', url.pathname + url.search + url.hash);
          }
        }
      } catch (e) {
        /* ignore */
      }
      api('/api/auth/hub-mode', {
        method: 'POST',
        body: JSON.stringify({ mode: 'organiser' }),
      })
        .then(function (hubMode) {
          if (!hubMode.ok && hubMode.data && hubMode.data.redirect) {
            window.location.href = hubMode.data.redirect;
          }
        })
        .catch(function () {
          /* non-fatal for cookie set */
        });
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
          'Your event is live. We opened a LinkedIn post draft in Promote.',
          false
        );
      }
      if (new URLSearchParams(window.location.search).get('featured') === 'cancelled') {
        const url = new URL(window.location.href);
        url.searchParams.delete('featured');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
        setRoute('social');
        showOrganiserAlert(
          'Checkout was cancelled — your events stay live. You can upgrade any time from Promote & social.',
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
        await loadBootstrap({ silent: true });
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
    } finally {
      window.clearTimeout(loadingSafety);
      setDashboardLoading(false);
    }
  }

  const sessionFetcher =
    typeof window.hubFetchSession === 'function'
      ? window.hubFetchSession
      : function () {
          return fetch('/api/auth/session', { credentials: 'include' }).then(function (res) {
            return res.json();
          });
        };

  sessionFetcher()
    .then((data) => {
      if (!data.ok || !data.user) {
        setDashboardLoading(false);
        if (signin) signin.hidden = false;
        return;
      }
      const hasAccess =
        data.organiserUiVisible || data.user.role === 'admin';
      if (!hasAccess) {
        setDashboardLoading(false);
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
