/**
 * Shared navigation for "add group profile" / "list event" CTAs.
 * Requires a group profile before creating an event.
 */
(function (global) {
  var scriptEl = document.currentScript;
  var root = (scriptEl && scriptEl.getAttribute('data-root')) || '../';
  var GROUP_STORAGE_KEY = 'hub_event_group_id';
  var BROWSE_RETURN_KEY = 'hub_browse_return';
  var PRIMER_SKIP_KEY = 'hub_list_event_primer_skip';
  var primerContinueHandler = null;

  function path(relative) {
    if (!relative) return root;
    if (/^https?:\/\//i.test(relative) || relative.charAt(0) === '/') return relative;
    return root + relative.replace(/^\.\//, '');
  }

  var CLAIM_PROFILE_LOGIN =
    '/login?next=' + encodeURIComponent('/organiser/?onboard=claim') + '&intent=organiser-claim';

  function loginUrl(nextPath) {
    var next = nextPath || '/organiser/';
    var pathOnly = next.split('?')[0];
    var intent =
      /^\/organiser(\/|$)/.test(pathOnly) || String(next).indexOf('/organiser/') >= 0
        ? '&intent=organiser'
        : '';
    return path('/login?next=' + encodeURIComponent(next) + intent);
  }

  async function fetchSession() {
    var res = await fetch('/api/auth/session', { credentials: 'include' });
    return res.json();
  }

  function hasGroupProfile(sessionData) {
    if (!sessionData || !sessionData.ok || !sessionData.user) return false;
    if (Number(sessionData.organiserProfiles) > 0) return true;
    return sessionData.canOrganise === true && sessionData.user.role === 'admin';
  }

  function organiserWorkspaceReady(sessionData) {
    if (!sessionData || !sessionData.ok || !sessionData.user) return false;
    if (sessionData.user.role === 'admin') return true;
    if ((sessionData.pendingClaimCount || 0) > 0) return true;
    return sessionData.organiserUiVisible === true;
  }

  async function restoreOrganiserUiIfHidden(sessionData) {
    if (!sessionData.organiserAccess || sessionData.organiserUiVisible) return sessionData;
    try {
      var res = await fetch('/api/auth/organiser-access', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'show-ui' }),
      });
      var data = await res.json();
      if (data.ok && data.needsEnable) return sessionData;
      if (data.ok) return fetchSession();
    } catch (e) {
      /* fall through */
    }
    return sessionData;
  }

  async function ensureOrganiserAccess(nextPath) {
    var data = await fetchSession();
    if (!data.ok || !data.user) {
      global.location.href = loginUrl(nextPath || '/organiser/enable');
      return null;
    }
    data = await restoreOrganiserUiIfHidden(data);
    if (!organiserWorkspaceReady(data)) {
      global.location.href = path('/organiser/enable');
      return null;
    }
    return data;
  }

  function isEventsBrowsePage() {
    var p = String(global.location.pathname || '');
    return (
      /\/events\/?(index\.html)?$/i.test(p) ||
      p.endsWith('/events/') ||
      /^\/networking\/[^/]+\/?$/i.test(p)
    );
  }

  function saveBrowseReturn() {
    if (!isEventsBrowsePage()) return;
    try {
      global.sessionStorage.setItem(
        BROWSE_RETURN_KEY,
        global.location.pathname + global.location.search
      );
    } catch (e) {
      /* ignore */
    }
  }

  function getBrowseReturnPath() {
    try {
      return global.sessionStorage.getItem(BROWSE_RETURN_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function clearBrowseReturn() {
    try {
      global.sessionStorage.removeItem(BROWSE_RETURN_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function applyBrowseReturnBack(linkEl, fallbackHref, fallbackLabel) {
    if (!linkEl) return;
    var stored = getBrowseReturnPath();
    if (stored) {
      linkEl.href = path(stored);
      linkEl.textContent = '← Back to browse';
      return;
    }
    linkEl.href = fallbackHref || '/organiser/#events-list';
    linkEl.textContent = fallbackLabel || '← Back to My Events';
  }

  function shouldShowListEventPrimer() {
    if (!isEventsBrowsePage()) return false;
    if (document.getElementById('events-list-primer')) {
      try {
        if (global.sessionStorage.getItem(PRIMER_SKIP_KEY) === '1') return false;
      } catch (e) {
        /* ignore */
      }
      return true;
    }
    return false;
  }

  function updateListEventPrimerSteps(sessionData) {
    var signedIn = Boolean(sessionData && sessionData.ok && sessionData.user);
    var hasGroup = hasGroupProfile(sessionData);
    document.querySelectorAll('.events-list-primer-step').forEach(function (step, index) {
      var key = step.getAttribute('data-primer-step');
      var done = false;
      if (key === 'account') done = signedIn;
      if (key === 'group') done = hasGroup;
      step.classList.toggle('is-done', done);
      var marker = step.querySelector('.events-list-primer-step-marker');
      if (marker) marker.textContent = done ? '✓' : String(index + 1);
    });
    var goBtn = document.getElementById('events-list-primer-go');
    if (goBtn) {
      goBtn.textContent = hasGroup ? 'Continue to event wizard →' : 'Get started →';
    }
  }

  function closeListEventPrimer() {
    var modal = document.getElementById('events-list-primer');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('events-list-primer-open');
    var dismiss = document.getElementById('events-list-primer-dismiss');
    if (dismiss && dismiss.checked) {
      try {
        global.sessionStorage.setItem(PRIMER_SKIP_KEY, '1');
      } catch (e) {
        /* ignore */
      }
    }
    primerContinueHandler = null;
  }

  function openListEventPrimer(sessionData, onContinue) {
    var modal = document.getElementById('events-list-primer');
    if (!modal) {
      onContinue();
      return;
    }
    primerContinueHandler = onContinue;
    updateListEventPrimerSteps(sessionData);
    modal.hidden = false;
    document.body.classList.add('events-list-primer-open');
    var goBtn = document.getElementById('events-list-primer-go');
    if (goBtn) goBtn.focus();
  }

  function bindListEventPrimer() {
    var modal = document.getElementById('events-list-primer');
    if (!modal || modal.dataset.primerBound) return;
    modal.dataset.primerBound = '1';
    modal.querySelectorAll('[data-list-primer-close]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        closeListEventPrimer();
      });
    });
    var goBtn = document.getElementById('events-list-primer-go');
    if (goBtn) {
      goBtn.addEventListener('click', function (e) {
        e.preventDefault();
        var next = primerContinueHandler;
        closeListEventPrimer();
        if (typeof next === 'function') next();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) closeListEventPrimer();
    });
  }

  async function goToClaimProfile() {
    saveBrowseReturn();
    var data = await fetchSession();
    if (data.ok && data.user) {
      global.location.href = path('/organiser/?onboard=claim');
      return;
    }
    global.location.href = path(CLAIM_PROFILE_LOGIN);
  }

  async function goToGroupProfile(options) {
    options = options || {};
    saveBrowseReturn();
    var data = await ensureOrganiserAccess('/organiser/group-edit');
    if (!data) return;
    try {
      sessionStorage.removeItem(GROUP_STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
    global.location.href = path('/organiser/group-edit');
  }

  function continueGoToAddEvent(data) {
    if (!data.ok || !data.user) {
      global.location.href = loginUrl('/organiser/event-edit');
      return;
    }
    if (!hasGroupProfile(data)) {
      global.location.href = path('/organiser/group-edit');
      return;
    }
    try {
      sessionStorage.removeItem(GROUP_STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
    global.location.href = path('/organiser/event-edit');
  }

  async function goToAddEvent(options) {
    options = options || {};
    saveBrowseReturn();
    var data = await ensureOrganiserAccess('/organiser/event-edit');
    if (!data) return;
    if (hasGroupProfile(data)) {
      continueGoToAddEvent(data);
      return;
    }
    if (shouldShowListEventPrimer()) {
      openListEventPrimer(data, function () {
        continueGoToAddEvent(data);
      });
      return;
    }
    continueGoToAddEvent(data);
  }

  async function goToAddOpportunity(options) {
    options = options || {};
    saveBrowseReturn();
    var loggedIn = await requireLogin('/organiser/opportunity-edit');
    if (!loggedIn) return;
    global.location.href = path('/organiser/opportunity-edit');
  }

  async function ensureOpportunityDashboardAccess(nextPath) {
    var data = await fetchSession();
    if (!data.ok || !data.user) {
      global.location.href = loginUrl(nextPath || '/organiser/#business-overview');
      return null;
    }
    data = await restoreOrganiserUiIfHidden(data);
    if (!organiserWorkspaceReady(data)) {
      global.location.href = path('/organiser/enable');
      return null;
    }
    try {
      await fetch('/api/auth/hub-mode', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'organiser' }),
      });
    } catch (e) {
      /* non-fatal */
    }
    return data;
  }

  async function goToBusinessOpportunities() {
    saveBrowseReturn();
    var data = await ensureOpportunityDashboardAccess('/organiser/#business-overview');
    if (!data) return;
    global.location.href = path('/organiser/#business-overview');
  }

  function isLiveListingStatus(status) {
    var st = String(status || '').toLowerCase();
    return st === 'published' || st === 'live' || st === 'approved';
  }

  function isCurrentlyFeaturedListing(item) {
    if (!item || !item.featured) return false;
    var until = item.featuredUntil || item.featured_until;
    if (!until) return true;
    return new Date(until).getTime() > Date.now();
  }

  function isBoostableEvent(ev) {
    if (!ev || !ev.id) return false;
    if (!isLiveListingStatus(ev.listingStatus || ev.status)) return false;
    var approval = String(ev.approvalStatus || ev.statusRaw || '').toLowerCase();
    if (approval && approval !== 'approved' && !/publish|live/.test(approval)) return false;
    return !isCurrentlyFeaturedListing(ev);
  }

  function isBoostableOpportunity(opp) {
    if (!opp || !opp.id) return false;
    if (!isLiveListingStatus(opp.listingStatus || opp.status)) return false;
    return !isCurrentlyFeaturedListing(opp);
  }

  async function goToBoostEvent() {
    saveBrowseReturn();
    var data = await ensureOrganiserAccess('/organiser/event-published');
    if (!data) return;

    try {
      var res = await fetch('/api/organiser/events', { credentials: 'include' });
      var payload = await res.json();
      if (res.ok && payload.ok) {
        var boostable = (payload.events || []).filter(isBoostableEvent);
        if (boostable.length === 1) {
          global.location.href =
            path('/organiser/event-published?ids=' + encodeURIComponent(boostable[0].id));
          return;
        }
        if (boostable.length > 1) {
          global.location.href = path('/organiser/#events-list');
          return;
        }
      }
    } catch (e) {
      /* fall through to list flow */
    }

    await goToAddEvent();
  }

  async function goToBoostOpportunity() {
    var data = await ensureOrganiserAccess('/organiser/opportunity-submitted');
    if (!data) return;

    try {
      var res = await fetch('/api/organiser/opportunities', { credentials: 'include' });
      var payload = await res.json();
      if (res.ok && payload.ok) {
        var boostable = (payload.opportunities || []).filter(isBoostableOpportunity);
        if (boostable.length === 1) {
          var opp = boostable[0];
          var qs =
            'id=' +
            encodeURIComponent(opp.id) +
            (opp.title ? '&title=' + encodeURIComponent(opp.title) : '');
          global.location.href = path('/organiser/opportunity-submitted?' + qs);
          return;
        }
        if (boostable.length > 1) {
          global.location.href = path('/organiser/#business-list');
          return;
        }
      }
    } catch (e) {
      /* fall through to list flow */
    }

    global.location.href = path('/opportunities/list');
  }

  function spotlightBoostCardHtml(kind) {
    var isEvent = kind === 'event';
    var title = isEvent ? 'Boost your event here' : 'Boost your listing here';
    var line1 = isEvent
      ? 'Premium Spotlight carousel on the events directory'
      : 'Premium Spotlight on business opportunities';
    var line2 = isEvent ? 'List or feature your event' : 'List or upgrade to premium';
    var action = isEvent ? 'boost-event' : 'boost-opportunity';

    return (
      '<article class="premium-card premium-card--boost-cta" data-hub-spotlight-boost="' +
      action +
      '">' +
      '<a class="premium-card-link" href="' +
      path(isEvent ? '/organiser/' : '/opportunities/list') +
      '" data-hub-action="' +
      action +
      '">' +
      '<div class="premium-card-media" aria-hidden="true">' +
      '<div class="premium-card-bg premium-card-bg--boost">' +
      '<span class="premium-card-boost-icon" aria-hidden="true">★</span>' +
      '</div>' +
      '<div class="premium-card-overlay"></div></div>' +
      '<div class="premium-card-top">' +
      '<span class="premium-badge">Premium</span>' +
      '<span class="premium-price">£55/mo</span></div>' +
      '<div class="premium-card-body">' +
      '<h3 class="premium-card-title">' +
      title +
      '</h3>' +
      '<div class="premium-card-meta">' +
      '<p class="premium-meta-row"><span>' +
      line1 +
      '</span></p>' +
      '<p class="premium-meta-row premium-meta-row--cta"><span>' +
      line2 +
      ' →</span></p>' +
      '</div></div></a></article>'
    );
  }

  function bindSpotlightBoost(scope) {
    var rootEl = scope && scope.querySelectorAll ? scope : document;
    rootEl.querySelectorAll('[data-hub-action="boost-event"]').forEach(function (el) {
      if (el.dataset.boostBound) return;
      el.dataset.boostBound = '1';
      el.addEventListener('click', function (e) {
        e.preventDefault();
        goToBoostEvent();
      });
    });
    rootEl.querySelectorAll('[data-hub-action="boost-opportunity"]').forEach(function (el) {
      if (el.dataset.boostBound) return;
      el.dataset.boostBound = '1';
      el.addEventListener('click', function (e) {
        e.preventDefault();
        goToBoostOpportunity();
      });
    });
  }

  function bindActions(scope) {
    var rootEl = scope && scope.querySelectorAll ? scope : document;
    rootEl.querySelectorAll('[data-hub-action="add-group"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        goToGroupProfile();
      });
    });
    rootEl.querySelectorAll('[data-hub-action="add-event"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        goToAddEvent();
      });
    });
    rootEl.querySelectorAll('[data-hub-action="add-opportunity"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        goToAddOpportunity();
      });
    });
  }

  /** Redirect to login when anonymous. Returns true if signed in. */
  async function requireLogin(nextPath) {
    var data = await fetchSession();
    if (data.ok && data.user) return true;
    global.location.href = loginUrl(nextPath || global.location.pathname + global.location.search);
    return false;
  }

  /** Call on event-format.html — redirect if no group profile. */
  async function requireGroupProfileForEventFlow() {
    var data = await fetchSession();
    if (!data.ok || !data.user) {
      global.location.href = loginUrl('/organiser/event-edit');
      return false;
    }
    if (!hasGroupProfile(data)) {
      global.location.href = path('/organiser/group-edit');
      return false;
    }
    return true;
  }

  global.HubOrganiserActions = {
    GROUP_STORAGE_KEY: GROUP_STORAGE_KEY,
    BROWSE_RETURN_KEY: BROWSE_RETURN_KEY,
    CLAIM_PROFILE_LOGIN: CLAIM_PROFILE_LOGIN,
    goToClaimProfile: goToClaimProfile,
    goToGroupProfile: goToGroupProfile,
    goToAddEvent: goToAddEvent,
    goToAddOpportunity: goToAddOpportunity,
    goToBusinessOpportunities: goToBusinessOpportunities,
    ensureOpportunityDashboardAccess: ensureOpportunityDashboardAccess,
    goToBoostEvent: goToBoostEvent,
    goToBoostOpportunity: goToBoostOpportunity,
    spotlightBoostCardHtml: spotlightBoostCardHtml,
    bindSpotlightBoost: bindSpotlightBoost,
    bindActions: bindActions,
    requireGroupProfileForEventFlow: requireGroupProfileForEventFlow,
    requireLogin: requireLogin,
    hasGroupProfile: hasGroupProfile,
    fetchSession: fetchSession,
    saveBrowseReturn: saveBrowseReturn,
    getBrowseReturnPath: getBrowseReturnPath,
    clearBrowseReturn: clearBrowseReturn,
    applyBrowseReturnBack: applyBrowseReturnBack,
  };

  function init() {
    bindListEventPrimer();
    bindActions(document);
    bindSpotlightBoost(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
