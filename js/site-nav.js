/**
 * Attendee ↔ organiser mode toggle (cookie hub_view).
 */
(function () {
  var isEmbedDrawer = false;
  try {
    isEmbedDrawer =
      new URLSearchParams(window.location.search).get('embed') === '1' ||
      window.self !== window.top;
  } catch (e) {
    isEmbedDrawer = false;
  }

  if (isEmbedDrawer) {
    var navMount = document.getElementById('hub-site-nav');
    if (navMount) navMount.hidden = true;
    window.hubFetchSession = function () {
      return Promise.resolve({ ok: true });
    };
    window.hubFetchProfile = function () {
      return Promise.resolve({ ok: false, profile: null });
    };
    window.hubProbeCatalogueAccess = function () {
      window.HubCatalogueOpen = true;
      return Promise.resolve(true);
    };
    return;
  }
  function bindSwitch(container, root) {
    if (!container || container.dataset.hubModeBound) return;
    container.dataset.hubModeBound = '1';
    container.querySelectorAll('[data-hub-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var mode = btn.getAttribute('data-hub-mode');
        if (!mode || btn.classList.contains('is-active')) return;
        btn.disabled = true;
        fetch('/api/auth/hub-mode', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: mode }),
        })
          .then(function (res) {
            return res.json();
          })
          .then(function (data) {
            if (data && data.redirect) {
              window.location.href =
                data.redirect.charAt(0) === '/'
                  ? data.redirect
                  : (root || '') + data.redirect;
            } else {
              btn.disabled = false;
            }
          })
          .catch(function () {
            btn.disabled = false;
          });
      });
    });
  }

  function switchHubMode(mode, root) {
    return fetch('/api/auth/hub-mode', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: mode }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.redirect) {
          window.location.href =
            data.redirect.charAt(0) === '/' ? data.redirect : (root || '') + data.redirect;
        }
        return data;
      });
  }

  window.HubModeSwitch = {
    html: function (hubView) {
      var isOrg = hubView === 'organiser';
      return (
        '<div class="hub-mode-switch" role="group" aria-label="Switch between My account and organiser workspace">' +
        '<button type="button" class="hub-mode-btn' +
        (!isOrg ? ' is-active' : '') +
        '" data-hub-mode="attendee">My account</button>' +
        '<button type="button" class="hub-mode-btn' +
        (isOrg ? ' is-active' : '') +
        '" data-hub-mode="organiser">Organiser workspace</button>' +
        '</div>'
      );
    },
    bind: function (container, root) {
      bindSwitch(container, root || '');
    },
    switchTo: switchHubMode,
  };
})();

/**
 * Shared site navigation — same bar on every page.
 * NAV_BUILD=20260709h — transparent nav logo (from logo-nav.png).
 */
(function () {
  var NAV_BUILD = '20260828nav1';
  var LOGO_SRC = '/assets/logo-nav-transparent.png?v=20260823uk3';
  var SESSION_KEY = 'hub_nav_session_v1';
  var SESSION_TTL_MS = 5 * 60 * 1000;
  var ORG_TODO_BADGE_KEY = 'hub_org_todo_badge_v1';
  var ADMIN_ATTENTION_BADGE_KEY = 'hub_admin_attention_badge_v1';
  var CATALOGUE_CACHE_KEY = 'hub_catalogue_open_v1';
  /** Keep in sync with js/hub-soft-launch.js — used before that script loads. */
  var PUBLIC_BROWSE_OPENS_AT_MS = Date.parse('2026-08-25T00:00:00+01:00');
  var orgTodoListenerBound = false;
  var adminAttentionListenerBound = false;
  var script = document.currentScript;
  var root = (script && script.getAttribute('data-root')) || '';
  var page = (script && script.getAttribute('data-page')) || '';

  function isPublicBrowseDateOpen() {
    if (window.HubSoftLaunch && typeof window.HubSoftLaunch.isPublicBrowseOpen === 'function') {
      return window.HubSoftLaunch.isPublicBrowseOpen();
    }
    return Date.now() >= PUBLIC_BROWSE_OPENS_AT_MS;
  }

  function readCatalogueCache() {
    try {
      var raw = sessionStorage.getItem(CATALOGUE_CACHE_KEY);
      if (raw === '1') return true;
      if (raw === '0') return false;
    } catch (e) {
      /* ignore */
    }
    return null;
  }

  function writeCatalogueCache(open) {
    try {
      sessionStorage.setItem(CATALOGUE_CACHE_KEY, open ? '1' : '0');
    } catch (e) {
      /* ignore */
    }
  }

  /** Prefer last known open state, then public-browse date — avoids Contact/early-access flash. */
  function guessCatalogueOpen() {
    var cached = readCatalogueCache();
    if (cached !== null) return cached;
    return isPublicBrowseDateOpen();
  }

  /** Soft-launch /peek mini-site — closed nav bubble (no catalogue, no sign-in unlock). */
  function isPeekPath() {
    var p = String(window.location.pathname || '').toLowerCase();
    return p === '/peek' || p.indexOf('/peek/') === 0;
  }

  /** Soft-launch /peek mini-site only — marketing pages follow real catalogue state. */
  function forceEarlyAccessChrome() {
    return isPeekPath();
  }

  function peekNavLinks(pending) {
    var html = '';
    html += link('/peek/for-organisers', 'For organisers', 'peek-for-organisers');
    html += link('/peek/for-networkers', 'For networkers', 'peek-for-networkers');
    html += link('/peek/about-us', 'About us', 'peek-about-us');
    if (pending) {
      html +=
        '<span class="nav-auth-pending" aria-hidden="true">' +
        '<span class="nav-auth-pending-pill nav-auth-pending-pill--short"></span>' +
        '<span class="nav-auth-pending-pill"></span>' +
        '</span>';
      return html;
    }
    html += link('/peek/about-us#updates', 'Get updates', 'peek-updates', 'nav-signin');
    return html;
  }

  function peekMobileLinks(pending) {
    var html = '';
    html += link('/peek/for-organisers', 'For organisers', 'peek-for-organisers', 'nav-mobile-item');
    html += link('/peek/for-networkers', 'For networkers', 'peek-for-networkers', 'nav-mobile-item');
    html += link('/peek/about-us', 'About us', 'peek-about-us', 'nav-mobile-item');
    if (!pending) {
      html += link(
        '/peek/about-us#updates',
        'Get updates',
        'peek-updates',
        'nav-mobile-item nav-mobile-signin'
      );
    }
    return html;
  }

  if (!window.__hubComplianceAssets && !document.querySelector('script[data-hub-compliance-bootstrap]')) {
    if (window.HubComplianceBootstrap && typeof window.HubComplianceBootstrap.load === 'function') {
      window.HubComplianceBootstrap.load(root);
    } else {
      var complianceScript = document.createElement('script');
      complianceScript.src = root + 'js/hub-compliance-bootstrap.js?v=20260901cmp2';
      complianceScript.setAttribute('data-root', root);
      complianceScript.setAttribute('data-hub-compliance-bootstrap', '1');
      document.head.appendChild(complianceScript);
    }
  }

  function mountBrowseWeekBannerWhenReady() {
    function run() {
      if (window.HubSoftLaunch && typeof window.HubSoftLaunch.mountBrowseWeekBanner === 'function') {
        window.HubSoftLaunch.mountBrowseWeekBanner({ beforeEl: mount });
      }
    }
    if (window.HubSoftLaunch && typeof window.HubSoftLaunch.mountBrowseWeekBanner === 'function') {
      run();
      return;
    }
    var path = 'js/hub-soft-launch.js?v=20260827nudgepause';
    var existing = document.querySelector('script[data-hub-soft-launch="1"]');
    if (existing) {
      existing.addEventListener('load', run);
      return;
    }
    var s = document.createElement('script');
    s.src = root + path;
    s.defer = true;
    s.setAttribute('data-hub-soft-launch', '1');
    s.addEventListener('load', run);
    document.head.appendChild(s);
  }

  var mount = document.getElementById('hub-site-nav');
  /** null = unknown; false = waitlist gate (hide public catalogue); true = browse open */
  var catalogueOpen = null;
  var lastNavUser = null;
  var lastNavPending = false;
  if (!mount) return;

  if (!document.querySelector('link[rel="icon"]')) {
    var rootPrefix = script && script.getAttribute('data-root') || '/';
    if (rootPrefix && rootPrefix.charAt(rootPrefix.length - 1) !== '/') rootPrefix += '/';
    [
      { rel: 'icon', href: rootPrefix + 'favicon.ico?v=20260722fav2', sizes: 'any' },
      { rel: 'icon', href: rootPrefix + 'assets/favicon.svg?v=20260722fav2', type: 'image/svg+xml' },
      { rel: 'icon', href: rootPrefix + 'assets/favicon-32.png?v=20260722fav2', type: 'image/png', sizes: '32x32' },
      { rel: 'apple-touch-icon', href: rootPrefix + 'assets/apple-touch-icon.png?v=20260722fav2' },
    ].forEach(function (attrs) {
      var link = document.createElement('link');
      Object.keys(attrs).forEach(function (key) { link[key] = attrs[key]; });
      document.head.appendChild(link);
    });
  }

  var scrollBound = false;

  function href(path) {
    if (!path) return root || '/';
    if (path.charAt(0) === '/' || /^(https?:|mailto:|tel:)/i.test(path)) return path;
    return root + path;
  }

  function signOutRedirectUrl() {
    var path = String(window.location.pathname || '').toLowerCase();
    if (
      document.body.classList.contains('hub-page-organiser') ||
      path.indexOf('/organiser') === 0 ||
      path.indexOf('/for-organisers') === 0
    ) {
      return (
        '/login?intent=organiser-claim&next=' + encodeURIComponent('/organiser/?onboard=claim')
      );
    }
    return '/login';
  }

  function isLinkActive(key) {
    if (key === 'peek-hub') {
      return page === 'peek-hub' || /\/peek\/?$/.test(String(window.location.pathname || ''));
    }
    if (key === 'peek-about-us') {
      return page === 'peek-about-us' || /\/peek\/about-us/.test(String(window.location.pathname || ''));
    }
    if (key === 'peek-for-organisers') {
      return (
        page === 'peek-for-organisers' ||
        /\/peek\/for-organisers/.test(String(window.location.pathname || ''))
      );
    }
    if (key === 'peek-for-networkers') {
      return (
        page === 'peek-for-networkers' ||
        /\/peek\/for-networkers/.test(String(window.location.pathname || ''))
      );
    }
    if (key === 'opportunities') {
      return (
        page === 'opportunities' ||
        /\/organiser\/opportunity-edit/.test(String(window.location.pathname || ''))
      );
    }
    if (key === 'events') {
      if (page !== 'events') return false;
      try {
        var params = new URLSearchParams(window.location.search);
        if (params.get('mode') === 'organisers') return false;
        if (window.location.pathname.indexOf('/organisers/') !== -1) return false;
      } catch (e) {
        /* ignore */
      }
      return true;
    }
    if (key === 'organisers') {
      if (page === 'organisers') return true;
      if (page !== 'events') return false;
      try {
        var browseParams = new URLSearchParams(window.location.search);
        if (browseParams.get('mode') === 'organisers') return true;
        if (window.location.pathname.indexOf('/organisers/') !== -1) return true;
      } catch (e) {
        /* ignore */
      }
      return false;
    }
    if (key === 'rankings') {
      return page === 'rankings' || window.location.pathname.indexOf('/rankings') === 0;
    }
    if (key === 'for-networkers') {
      return (
        page === 'for-networkers' ||
        page === 'for-attendees' ||
        /\/for-(networkers|attendees)(?:\.html)?\/?$/.test(
          String(window.location.pathname || '').toLowerCase()
        )
      );
    }
    return page === key;
  }

  function link(path, label, key, extraClass) {
    var isActive = isLinkActive(key);
    var active = isActive ? ' aria-current="page"' : '';
    var cls = extraClass ? ' class="' + extraClass + '"' : '';
    return '<a href="' + href(path) + '"' + cls + active + '>' + label + '</a>';
  }

  function showListEventCta(user) {
    // Same top-bar CTA for every visitor and signed-in account.
    return true;
  }

  function listEventCta(user, extraClass) {
    var canSelfServe = !!(user && user.organiserUiVisible);
    var path = canSelfServe ? '/organiser/event-edit' : '/add-your-event';
    var loc = String(window.location.pathname || '').toLowerCase();
    var isActive = canSelfServe
      ? loc.indexOf('/organiser/event-edit') !== -1
      : page === 'add-your-event' || loc.indexOf('/add-your-event') !== -1;
    var active = isActive ? ' aria-current="page"' : '';
    var cls = 'nav-organiser' + (extraClass ? ' ' + extraClass : '');
    return (
      '<a href="' +
      href(path) +
      '" class="' +
      cls +
      '"' +
      active +
      '>List your event</a>'
    );
  }

  function myHubDropdownHtml(user) {
    var hubActive =
      page === 'organiser' ||
      page === 'account' ||
      page === 'settings' ||
      page === 'admin' ||
      page === 'contact';
    var organiserActive = page === 'organiser' ? ' aria-current="page"' : '';
    var accountActive = page === 'account' ? ' aria-current="page"' : '';
    var settingsActive = page === 'settings' ? ' aria-current="page"' : '';
    var adminActive = page === 'admin' ? ' aria-current="page"' : '';
    var contactActive = page === 'contact' ? ' aria-current="page"' : '';
    var showOrganiserLink = user && user.organiserUiVisible;
    var organiserItem = '';
    if (showOrganiserLink) {
      organiserItem =
        '<a role="menuitem" class="nav-dropdown-item nav-organiser-in-menu nav-org-workspace" href="' +
        href('/organiser/') +
        '"' +
        organiserActive +
        '>Organiser workspace</a>';
    }
    var adminItem = '';
    if (user && user.role === 'admin') {
      adminItem =
        '<a role="menuitem" class="nav-dropdown-item nav-admin-cc" href="' +
        href('/admin/') +
        '"' +
        adminActive +
        '>Command Center</a>';
    }
    return (
      '<div class="nav-dropdown" id="nav-my-hub">' +
      '<button type="button" class="nav-dropdown-toggle' +
      (hubActive ? ' is-active' : '') +
      '" id="nav-my-hub-toggle" aria-expanded="false" aria-haspopup="true" aria-controls="nav-my-hub-menu">' +
      'My account <span class="nav-dropdown-chev" aria-hidden="true">▾</span></button>' +
      '<div class="nav-dropdown-menu" id="nav-my-hub-menu" role="menu" hidden>' +
      '<a role="menuitem" class="nav-dropdown-item" href="' +
      href('/account/') +
      '"' +
      accountActive +
      '>Overview</a>' +
      organiserItem +
      '<a role="menuitem" class="nav-dropdown-item" href="' +
      href('/account/settings') +
      '"' +
      settingsActive +
      '>Profile &amp; preferences</a>' +
      '<a role="menuitem" class="nav-dropdown-item" href="' +
      href('/contact') +
      '"' +
      contactActive +
      '>Contact us</a>' +
      adminItem +
      '<button type="button" role="menuitem" class="nav-dropdown-item nav-dropdown-signout" id="nav-signout">Sign out</button>' +
      '</div></div>'
    );
  }

  function readCachedUser() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.user || !parsed.ts) return null;
      if (Date.now() - parsed.ts > SESSION_TTL_MS) return null;
      return parsed.user;
    } catch (e) {
      return null;
    }
  }

  function cacheUser(user) {
    try {
      if (!user) {
        sessionStorage.removeItem(SESSION_KEY);
        clearOrgTodoBadge();
        clearAdminAttentionBadge();
        return;
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ts: Date.now(), user: user }));
    } catch (e) {
      /* ignore quota / private mode */
    }
  }

  function clearOrgTodoBadge() {
    try {
      localStorage.removeItem(ORG_TODO_BADGE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function clearAdminAttentionBadge() {
    try {
      localStorage.removeItem(ADMIN_ATTENTION_BADGE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function readOrgTodoCount(user) {
    if (!user || !user.organiserUiVisible) return 0;
    /* Workspace To-do already has its own badge while on organiser pages. */
    if (page === 'organiser') return 0;
    try {
      var raw = localStorage.getItem(ORG_TODO_BADGE_KEY);
      if (!raw) return 0;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return 0;
      var userId = String(user.sub || user.email || '').trim();
      if (userId && parsed.userId && String(parsed.userId) !== userId) return 0;
      var count = Math.max(0, Number(parsed.count) || 0);
      return count > 0 ? count : 0;
    } catch (e) {
      return 0;
    }
  }

  function readAdminAttentionCount(user) {
    if (!user || user.role !== 'admin') return 0;
    /* Command Center already shows its own badges while on admin pages. */
    if (page === 'admin') return 0;
    try {
      var raw = localStorage.getItem(ADMIN_ATTENTION_BADGE_KEY);
      if (!raw) return 0;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return 0;
      var userId = String(user.sub || user.email || '').trim();
      if (userId && parsed.userId && String(parsed.userId) !== userId) return 0;
      var count = Math.max(0, Number(parsed.count) || 0);
      return count > 0 ? count : 0;
    } catch (e) {
      return 0;
    }
  }

  function applyAccountAttention(user) {
    if (!mount) return;
    var u = user || lastNavUser;
    var orgCount = readOrgTodoCount(u);
    var adminCount = readAdminAttentionCount(u);
    var total = orgCount + adminCount;
    var show = total > 0;
    var parts = [];
    if (orgCount > 0) {
      parts.push(
        orgCount === 1
          ? '1 organiser to-do needs attention'
          : orgCount + ' organiser to-dos need attention'
      );
    }
    if (adminCount > 0) {
      parts.push(
        adminCount === 1
          ? '1 Command Center item needs attention'
          : adminCount + ' Command Center items need attention'
      );
    }
    var labelSuffix = parts.length ? ', ' + parts.join('; ') : '';

    function setAttention(el, baseLabel, keepLabelWhenClear, forceShow) {
      if (!el) return;
      var on = forceShow == null ? show : !!forceShow;
      el.classList.toggle('has-attention', on);
      if (!baseLabel) return;
      if (on) {
        el.setAttribute('aria-label', baseLabel + labelSuffix);
      } else if (keepLabelWhenClear) {
        el.setAttribute('aria-label', baseLabel);
      } else {
        el.removeAttribute('aria-label');
      }
    }

    setAttention(document.getElementById('nav-my-hub-toggle'), 'My account', false);
    setAttention(document.getElementById('nav-menu-toggle'), 'Open menu', true);
    mount.querySelectorAll('.nav-org-workspace').forEach(function (el) {
      setAttention(el, 'Organiser workspace', false, orgCount > 0);
    });
    mount.querySelectorAll('.nav-admin-cc').forEach(function (el) {
      var adminSuffix =
        adminCount > 0
          ? ', ' +
            (adminCount === 1
              ? '1 item needs attention'
              : adminCount + ' items need attention')
          : '';
      el.classList.toggle('has-attention', adminCount > 0);
      if (adminCount > 0) {
        el.setAttribute('aria-label', 'Command Center' + adminSuffix);
      } else {
        el.removeAttribute('aria-label');
      }
    });
  }

  function applyOrgTodoAttention(user) {
    applyAccountAttention(user);
  }

  function bindOrgTodoListener() {
    if (orgTodoListenerBound) return;
    orgTodoListenerBound = true;
    window.addEventListener('hub:org-todo-count', function () {
      applyAccountAttention(lastNavUser);
    });
  }

  function bindAdminAttentionListener() {
    if (adminAttentionListenerBound) return;
    adminAttentionListenerBound = true;
    window.addEventListener('hub:admin-attention-count', function () {
      applyAccountAttention(lastNavUser);
    });
  }

  function persistAdminAttentionFromNav(count, user) {
    var safe = Math.max(0, Number(count) || 0);
    var userId = String((user && (user.sub || user.email)) || '').trim();
    try {
      localStorage.setItem(
        ADMIN_ATTENTION_BADGE_KEY,
        JSON.stringify({ count: safe, userId: userId, ts: Date.now() })
      );
    } catch (e) {
      /* ignore */
    }
    try {
      window.dispatchEvent(
        new CustomEvent('hub:admin-attention-count', {
          detail: { count: safe, userId: userId },
        })
      );
    } catch (e2) {
      /* ignore */
    }
  }

  function refreshAdminAttentionBadge(user) {
    if (!user || user.role !== 'admin' || page === 'admin') return;
    fetch('/api/admin/metrics?light=1', { credentials: 'include', cache: 'no-store' })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || data.error || data.configured === false) return;
        var counts = data.actionCounts || {};
        var total =
          Number(data.notificationCount) ||
          (Number(counts.openListingReports) || 0) +
            (Number(counts.openReviewReports) || 0) +
            (Number(counts.spamReviews) || 0) +
            (Number(counts.pendingOpportunities) || 0) +
            (Number(counts.openClaimDisputes) || 0) +
            (Number(counts.openOrganiserClaimRequests) || 0) +
            (Number(counts.openComplaints) || 0) +
            (Number(counts.pendingPayouts) || 0) +
            (Number(counts.openEventRequests) || 0) +
            (Number(counts.incompleteOrganisers) || 0);
        persistAdminAttentionFromNav(total, user);
        applyAccountAttention(user);
      })
      .catch(function () {
        /* ignore — keep cached badge */
      });
  }

  function isMoreNavActive() {
    return (
      isLinkActive('organisers') ||
      isLinkActive('rankings') ||
      isLinkActive('faq') ||
      isLinkActive('contact')
    );
  }

  function moreNavDropdownHtml(opts) {
    var early = opts && opts.earlyAccess;
    var organiserActive = isLinkActive('organisers') ? ' aria-current="page"' : '';
    var rankingsActive = isLinkActive('rankings') ? ' aria-current="page"' : '';
    var faqActive = isLinkActive('faq') ? ' aria-current="page"' : '';
    var contactActive = isLinkActive('contact') ? ' aria-current="page"' : '';
    var guidesActive = isLinkActive('guides') ? ' aria-current="page"' : '';
    var items = '';
    if (early) {
      items +=
        '<a role="menuitem" class="nav-dropdown-item" href="' +
        href('/for-organisers') +
        '">For organisers</a>';
    } else {
      items +=
        '<a role="menuitem" class="nav-dropdown-item" href="' +
        href('/events/?mode=organisers') +
        '"' +
        organiserActive +
        '>Organisers</a>' +
        '<a role="menuitem" class="nav-dropdown-item" href="' +
        href('/rankings') +
        '"' +
        rankingsActive +
        '>Top groups</a>';
    }
    if (!early) {
      items +=
        '<a role="menuitem" class="nav-dropdown-item" href="' +
        href('/faq') +
        '"' +
        faqActive +
        '>Help</a>';
    }
    items +=
      '<a role="menuitem" class="nav-dropdown-item" href="' +
      href('/contact') +
      '"' +
      contactActive +
      '>Contact</a>' +
      '<a role="menuitem" class="nav-dropdown-item" href="https://www.thenetworkerinternational.com/" rel="noopener noreferrer">International</a>';
    return (
      '<div class="nav-dropdown nav-more-dropdown" id="nav-more">' +
      '<button type="button" class="nav-dropdown-toggle' +
      (isMoreNavActive() ? ' is-active' : '') +
      '" id="nav-more-toggle" aria-expanded="false" aria-haspopup="true" aria-controls="nav-more-menu">' +
      'More <span class="nav-dropdown-chev" aria-hidden="true">▾</span></button>' +
      '<div class="nav-dropdown-menu" id="nav-more-menu" role="menu" hidden>' +
      items +
      '</div></div>'
    );
  }

  function buildNavLinks(user, pending) {
    if (isPeekPath()) {
      return peekNavLinks(pending && !user);
    }
    var early = catalogueOpen === false;
    var html = '';
    if (user && !early) {
      html += link('/', 'Home', 'home');
    }
    if (early) {
      // Soft launch: only destinations they can actually open (no catalogue browse).
      if (user && user.organiserUiVisible) {
        html += link('/organiser/', 'Organiser workspace', 'organiser', 'nav-org-workspace');
      } else {
        html += link('/for-organisers', 'For organisers', 'for-organisers');
      }
      html += link('/contact', 'Contact', 'contact');
    } else {
      html += link('/events/', 'Events', 'events');
      html += link('/opportunities/', 'Opportunities', 'opportunities');
      if (!user) {
        html += link('/for-organisers', 'For organisers', 'for-organisers');
      }
      if (user) {
        html += link('/events/?mode=organisers', 'Organisers', 'organisers');
        html += link('/faq', 'Help', 'faq');
      }
    }
    if (pending && !user) {
      html +=
        '<span class="nav-auth-pending" aria-hidden="true">' +
        '<span class="nav-auth-pending-pill nav-auth-pending-pill--short"></span>' +
        '<span class="nav-auth-pending-pill"></span>' +
        '<span class="nav-auth-pending-pill nav-auth-pending-pill--short"></span>' +
        '</span>';
      return html;
    }
    if (!user && !early) {
      html += moreNavDropdownHtml({ earlyAccess: false });
    }
    var actions = '';
    if (showListEventCta(user) && catalogueOpen !== false) {
      actions += listEventCta(user);
    }
    if (user) {
      actions += myHubDropdownHtml(user);
    } else if (early) {
      actions +=
        '<span class="nav-auth">' +
        link('/login', 'Sign in', 'auth', 'nav-signin') +
        '</span>';
    } else {
      /* Sign in (quiet) then Join free (primary) — reads as one auth cluster */
      actions +=
        '<span class="nav-auth">' +
        link('/login', 'Sign in', 'auth', 'nav-signin') +
        link('/register', 'Join free', 'auth', 'nav-register') +
        '</span>';
    }
    if (actions) {
      html += '<div class="nav-actions">' + actions + '</div>';
    }
    return html;
  }

  var MOBILE_DRAWER_CITIES = [
    { slug: 'central-london', name: 'Central London' },
    { slug: 'manchester', name: 'Manchester' },
    { slug: 'birmingham', name: 'Birmingham' },
    { slug: 'bristol', name: 'Bristol' },
    { slug: 'leeds', name: 'Leeds' },
    { slug: 'edinburgh', name: 'Edinburgh' },
    { slug: 'glasgow', name: 'Glasgow' },
    { slug: 'liverpool', name: 'Liverpool' },
  ];

  function buildMobileDrawerCities() {
    var html = '<p class="nav-mobile-section-label">Browse by city</p>';
    html += '<div class="nav-mobile-cities" role="list">';
    MOBILE_DRAWER_CITIES.forEach(function (city) {
      html +=
        '<a class="nav-mobile-city" href="/networking/' +
        encodeURIComponent(city.slug) +
        '" role="listitem">' +
        city.name +
        '</a>';
    });
    html += '</div>';
    return html;
  }

  function buildMobileDrawerLinks(user, pending) {
    if (isPeekPath()) {
      var peekHtml = '<p class="nav-mobile-section-label">Sneak peek</p>';
      peekHtml += peekMobileLinks(pending && !user);
      return peekHtml;
    }
    var early = catalogueOpen === false;
    var html = '';
    if (user && !early) {
      html += link('/', 'Home', 'home', 'nav-mobile-item');
    }
    if (early) {
      html += '<p class="nav-mobile-section-label">Explore</p>';
      if (user && user.organiserUiVisible) {
        html += link(
          '/organiser/',
          'Organiser workspace',
          'organiser',
          'nav-mobile-item nav-org-workspace'
        );
      } else {
        html += link('/for-organisers', 'For organisers', 'for-organisers', 'nav-mobile-item');
      }
      html += link('/contact', 'Contact', 'contact', 'nav-mobile-item');
      html += link('/legal-policies', 'Legal', 'legal', 'nav-mobile-item');
      html +=
        '<a class="nav-mobile-item" href="https://www.thenetworkerinternational.com/" rel="noopener noreferrer">International</a>';
    } else {
      html += '<p class="nav-mobile-section-label">Browse</p>';
      html += link('/events/', 'Events', 'events', 'nav-mobile-item');
      html += link('/opportunities/', 'Opportunities', 'opportunities', 'nav-mobile-item');
      html += link('/events/?mode=organisers', 'Organisers', 'organisers', 'nav-mobile-item');
      html += link('/for-organisers', 'For organisers', 'for-organisers', 'nav-mobile-item');
      html += link('/rankings', 'Top groups', 'rankings', 'nav-mobile-item');
      html += buildMobileDrawerCities();
      html += '<p class="nav-mobile-section-label">Help &amp; info</p>';
      html += link('/faq', 'Help', 'faq', 'nav-mobile-item');
      html += link('/contact', 'Contact', 'contact', 'nav-mobile-item');
      html +=
        '<a class="nav-mobile-item" href="https://www.thenetworkerinternational.com/" rel="noopener noreferrer">International</a>';
    }
    if (pending && !user) {
      html +=
        '<span class="nav-mobile-auth-pending" aria-hidden="true">' +
        '<span class="nav-auth-pending-pill"></span>' +
        '<span class="nav-auth-pending-pill"></span>' +
        '</span>';
      return html;
    }
    if (showListEventCta(user) && catalogueOpen !== false) {
      html += listEventCta(user, 'nav-mobile-item nav-mobile-list-event');
    }
    if (user) {
      // Same mobile account section for everyone; optional links only when relevant.
      html += '<p class="nav-mobile-account-label">My account</p>';
      html += link('/account/', 'My account', 'account', 'nav-mobile-item');
      if (user.organiserUiVisible) {
        html += link(
          '/organiser/',
          'Organiser workspace',
          'organiser',
          'nav-mobile-item nav-org-workspace'
        );
      }
      html += link('/account/settings', 'Profile & preferences', 'settings', 'nav-mobile-item');
      html += link('/contact', 'Contact us', 'contact', 'nav-mobile-item');
      if (user.role === 'admin') {
        html += link('/admin/', 'Command Center', 'admin', 'nav-mobile-item nav-admin-cc');
      }
      html +=
        '<button type="button" class="nav-mobile-item nav-mobile-signout" id="nav-mobile-signout">Sign out</button>';
    } else if (early) {
      html += link('/login', 'Sign in', 'auth', 'nav-mobile-item nav-mobile-signin');
    } else {
      html += '<div class="nav-mobile-auth">';
      html += link('/login', 'Sign in', 'auth', 'nav-mobile-item nav-mobile-signin');
      html += link('/register', 'Join free', 'auth', 'nav-mobile-item nav-mobile-register');
      html += '</div>';
    }
    return html;
  }

  function bindMobileMenu(nav) {
    var toggle = document.getElementById('nav-menu-toggle');
    var drawer = document.getElementById('nav-mobile-drawer');
    var backdrop = document.getElementById('nav-mobile-backdrop');
    var closeBtn = document.getElementById('nav-mobile-close');
    if (!toggle || !drawer || !backdrop) return;
    if (toggle.dataset.bound) return;
    toggle.dataset.bound = '1';

    function setDrawerInert(isInert) {
      if ('inert' in drawer) {
        drawer.inert = isInert;
      }
    }

    function getSkipLink() {
      return mount.querySelector('.skip-to-content');
    }

    function setSkipLinkTabbable(isTabbable) {
      var skip = getSkipLink();
      if (!skip) return;
      if (isTabbable) {
        if (skip.dataset.navMenuTabindex === '') skip.removeAttribute('tabindex');
        else if (skip.dataset.navMenuTabindex) skip.setAttribute('tabindex', skip.dataset.navMenuTabindex);
        skip.removeAttribute('data-nav-menu-tabindex');
      } else {
        skip.setAttribute('data-nav-menu-tabindex', skip.getAttribute('tabindex') || '');
        skip.setAttribute('tabindex', '-1');
      }
    }

    function setPageBehindMenuInert(isInert) {
      var siteNav = document.getElementById('site-nav');
      if (siteNav && 'inert' in siteNav) siteNav.inert = isInert;

      Array.from(document.body.children).forEach(function (child) {
        if (child === mount) return;
        if ('inert' in child) child.inert = isInert;
      });
    }

    function getDrawerFocusables() {
      var selector =
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.from(drawer.querySelectorAll(selector)).filter(function (el) {
        return !el.hidden && el.getAttribute('aria-hidden') !== 'true';
      });
    }

    function trapDrawerFocus(e) {
      if (e.key !== 'Tab' || !drawer.classList.contains('is-open')) return;
      var focusables = getDrawerFocusables();
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    function openMenu() {
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');
      nav.classList.add('is-menu-open');
      drawer.hidden = false;
      setDrawerInert(false);
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      backdrop.hidden = false;
      document.body.classList.add('nav-menu-open');
      setSkipLinkTabbable(false);
      setPageBehindMenuInert(true);
      window.requestAnimationFrame(function () {
        if (closeBtn) closeBtn.focus();
      });
    }

    function closeMenu() {
      var focusInDrawer = drawer.contains(document.activeElement);
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      nav.classList.remove('is-menu-open');
      drawer.classList.remove('is-open');
      // Move focus out before aria-hidden so assistive tech is not blocked.
      if (focusInDrawer) toggle.focus();
      drawer.setAttribute('aria-hidden', 'true');
      setDrawerInert(true);
      backdrop.hidden = true;
      document.body.classList.remove('nav-menu-open');
      setSkipLinkTabbable(true);
      setPageBehindMenuInert(false);
      window.setTimeout(function () {
        if (!drawer.classList.contains('is-open')) drawer.hidden = true;
      }, 260);
    }

    // Closed drawer starts aria-hidden; keep it inert so focus cannot land inside.
    setDrawerInert(true);

    toggle.addEventListener('click', function () {
      if (drawer.classList.contains('is-open')) closeMenu();
      else openMenu();
    });
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    backdrop.addEventListener('click', closeMenu);
    drawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeMenu);
    });
    document.addEventListener('keydown', function (e) {
      if (!drawer.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeMenu();
      else trapDrawerFocus(e);
    });

    var mobileSignOut = document.getElementById('nav-mobile-signout');
    if (mobileSignOut) {
      mobileSignOut.addEventListener('click', function () {
        closeMenu();
        cacheUser(null);
        fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
          .catch(function () {
            /* Network failures (e.g. Safari "Load failed") are fine — redirect anyway. */
          })
          .finally(function () {
            window.location.href = href(signOutRedirectUrl());
          });
      });
    }

    var mobileMode = drawer.querySelector('.hub-mode-switch');
    if (mobileMode && window.HubModeSwitch) {
      window.HubModeSwitch.bind(mobileMode, root);
    }
  }

  function bindNavDropdown(nav, wrapId, toggleId, menuId) {
    var wrap = nav.querySelector('#' + wrapId);
    if (!wrap || wrap.dataset.bound) return;
    wrap.dataset.bound = '1';

    var toggle = wrap.querySelector('#' + toggleId);
    var menu = wrap.querySelector('#' + menuId);
    if (!toggle || !menu) return;

    function closeMenu() {
      toggle.setAttribute('aria-expanded', 'false');
      menu.hidden = true;
      wrap.classList.remove('is-open');
    }

    function openMenu() {
      toggle.setAttribute('aria-expanded', 'true');
      menu.hidden = false;
      wrap.classList.add('is-open');
    }

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      if (menu.hidden) openMenu();
      else closeMenu();
    });

    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) closeMenu();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });
  }

  function bindMyHubDropdown(nav) {
    bindNavDropdown(nav, 'nav-my-hub', 'nav-my-hub-toggle', 'nav-my-hub-menu');
  }

  function bindMoreDropdown(nav) {
    bindNavDropdown(nav, 'nav-more', 'nav-more-toggle', 'nav-more-menu');
  }

  function bindListEventCta() {
    mount.querySelectorAll('a.nav-organiser').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var dashBtn = document.getElementById('btn-new-event');
        if (dashBtn) {
          e.preventDefault();
          dashBtn.click();
          return;
        }
        if (
          lastNavUser &&
          lastNavUser.organiserUiVisible &&
          window.HubOrganiserActions &&
          typeof window.HubOrganiserActions.goToAddEvent === 'function'
        ) {
          e.preventDefault();
          window.HubOrganiserActions.goToAddEvent();
        }
      });
    });
  }

  function renderImpersonationBanner(sessionData) {
    var existing = document.getElementById('hub-impersonation-banner');
    if (existing) existing.remove();
    if (!sessionData || !sessionData.impersonating || !sessionData.user) return;

    var banner = document.createElement('div');
    banner.id = 'hub-impersonation-banner';
    banner.className = 'hub-impersonation-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML =
      'You are viewing the site as <strong>' +
      (sessionData.user.email || 'this user') +
      '</strong> (admin: ' +
      (sessionData.impersonatorEmail || 'you') +
      '). ' +
      '<button type="button" class="hub-impersonation-stop" id="hub-stop-impersonating">Stop impersonating</button>';

    if (mount.parentNode) {
      mount.parentNode.insertBefore(banner, mount.nextSibling);
    }

    var stopBtn = document.getElementById('hub-stop-impersonating');
    if (stopBtn) {
      stopBtn.addEventListener('click', function () {
        stopBtn.disabled = true;
        fetch('/api/auth/stop-impersonate', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
          .then(function (res) {
            return res.json();
          })
          .then(function (data) {
            cacheUser(null);
            window.location.href = href(String(data.redirect || '/admin/'));
          })
          .catch(function () {
            stopBtn.disabled = false;
          });
      });
    }
  }

  function applySessionData(data) {
    if (data.ok && data.user) {
      data.user.hubView = data.hubView || 'attendee';
      data.user.organiserProfiles = data.organiserProfiles || 0;
      data.user.organiserAccess = data.organiserAccess === true;
      data.user.organiserUiVisible = data.organiserUiVisible === true;
      data.user.organiserEmailVerified = data.organiserEmailVerified === true;
      data.user.pendingClaimCount = data.pendingClaimCount || 0;
      data.user.canToggleHubMode = data.canToggleHubMode === true;
      cacheUser(data.user);
      renderNav(data.user, false);
      renderImpersonationBanner(data);
      return;
    }
    cacheUser(null);
    renderNav(null, false);
    renderImpersonationBanner(null);
  }

  function findMainSkipTarget() {
    return (
      document.querySelector('main[id]') ||
      document.querySelector('main') ||
      document.getElementById('org-main') ||
      document.querySelector('.ad-main') ||
      document.querySelector('[role="main"]')
    );
  }

  function ensureMainSkipTarget() {
    var mainEl = findMainSkipTarget();
    if (mainEl) {
      if (!mainEl.id) mainEl.id = 'hub-main-content';
      if (!mainEl.hasAttribute('tabindex')) mainEl.setAttribute('tabindex', '-1');
    }
    var skip = document.querySelector('.skip-to-content');
    if (!skip || !mainEl || !mainEl.id) return;
    skip.setAttribute('href', '#' + mainEl.id);
    if (skip.dataset.skipBound === '1') return;
    skip.dataset.skipBound = '1';
    skip.addEventListener('click', function () {
      window.setTimeout(function () {
        try {
          mainEl.focus({ preventScroll: false });
        } catch (err) {
          /* ignore */
        }
      }, 0);
    });
  }

  function renderNav(user, pending) {
    lastNavUser = user || null;
    lastNavPending = Boolean(pending);
    var early = catalogueOpen === false;
    var homeHref = isPeekPath() ? href('/peek') : early ? href('/for-organisers') : href('/');
    var pendingClass = pending ? ' is-session-pending' : '';
    mount.innerHTML =
      '<a class="skip-to-content" href="#hub-main-content">Skip to main content</a>' +
      '<header class="site-nav on-light' +
      pendingClass +
      '" id="site-nav">' +
      '<a class="nav-logo" href="' +
      homeHref +
      '" aria-label="The Networker UK home">' +
      '<img src="' +
      href(LOGO_SRC) +
      '" alt="The Networker UK" width="550" height="255">' +
      '</a>' +
      '<nav class="nav-links" aria-label="Main">' +
      buildNavLinks(user, pending) +
      '</nav>' +
      '<button type="button" class="nav-menu-toggle" id="nav-menu-toggle" aria-expanded="false" aria-controls="nav-mobile-drawer" aria-label="Open menu">' +
      '<span class="nav-menu-bar"></span><span class="nav-menu-bar"></span><span class="nav-menu-bar"></span>' +
      '</button>' +
      '</header>' +
      '<div class="nav-mobile-backdrop" id="nav-mobile-backdrop" hidden></div>' +
      '<aside class="nav-mobile-drawer" id="nav-mobile-drawer" aria-hidden="true" hidden>' +
      '<div class="nav-mobile-drawer-head"><span>Menu</span>' +
      '<button type="button" class="nav-mobile-close" id="nav-mobile-close" aria-label="Close menu">×</button></div>' +
      '<nav class="nav-mobile-links" aria-label="Mobile menu">' +
      buildMobileDrawerLinks(user, pending) +
      '</nav></aside>';

    var nav = document.getElementById('site-nav');
    if (!nav) return;

    bindMobileMenu(nav);

    if (!scrollBound) {
      function updateNav() {
        nav.classList.toggle('is-scrolled', window.scrollY > 24);
      }
      updateNav();
      window.addEventListener('scroll', updateNav, { passive: true });
      scrollBound = true;
    }

    var modeSwitch = nav.querySelector('.hub-mode-switch');
    if (modeSwitch && window.HubModeSwitch) {
      window.HubModeSwitch.bind(modeSwitch, root);
    }

    bindMyHubDropdown(nav);
    bindMoreDropdown(nav);
    bindListEventCta();
    bindOrgTodoListener();
    bindAdminAttentionListener();
    applyAccountAttention(user);
    refreshAdminAttentionBadge(user);

    var signOut = document.getElementById('nav-signout');
    if (signOut) {
      signOut.addEventListener('click', function () {
        cacheUser(null);
        fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
          .catch(function () {
            /* Network failures (e.g. Safari "Load failed") are fine — redirect anyway. */
          })
          .finally(function () {
            window.location.href = href(signOutRedirectUrl());
          });
      });
    }

    ensureMainSkipTarget();
  }

  if (page === 'home') {
    document.body.classList.add('hub-page-home');
  } else if (page === 'admin') {
    document.body.classList.add('hub-page-admin');
  } else if (page === 'organiser') {
    document.body.classList.add('hub-page-organiser');
  } else if (page === 'account' || page === 'settings') {
    document.body.classList.add('hub-page-account');
  } else {
    document.body.classList.add('has-site-nav');
  }

  var cachedUser = readCachedUser();
  // Prefer full public nav once browse is open (or last probe was open). Only fall back
  // to early-access chrome when the catalogue is known closed — avoids a Contact flash.
  catalogueOpen = guessCatalogueOpen();
  if (cachedUser) {
    renderNav(cachedUser, false);
  } else {
    renderNav(null, true);
  }

  var catalogueProbePromise = null;
  var profilePromise = null;

  function applyCatalogueOpen(open, opts) {
    var persist = !opts || opts.persist !== false;
    var prev = catalogueOpen;
    catalogueOpen = open === true;
    window.HubCatalogueOpen = catalogueOpen;
    if (persist) writeCatalogueCache(catalogueOpen);
    try {
      window.dispatchEvent(new CustomEvent('hub-catalogue-access', { detail: { open: catalogueOpen } }));
    } catch (e) {
      /* ignore */
    }
    if (prev !== catalogueOpen) {
      renderNav(lastNavUser, lastNavPending && !lastNavUser);
    }
    return catalogueOpen;
  }

  /**
   * Shared catalogue-open probe (nav / footer / auth). Dedupes in-flight requests.
   * Uses ?probe=1 so the API skips the browse query.
   */
  function probeCatalogueAccess(force) {
    if (forceEarlyAccessChrome()) {
      catalogueProbePromise = null;
      // Peek mini-site uses early chrome for this view only — do not poison session cache.
      applyCatalogueOpen(false, { persist: false });
      return Promise.resolve(false);
    }
    if (!force && catalogueProbePromise) return catalogueProbePromise;
    catalogueProbePromise = fetch('/api/events?probe=1', { credentials: 'include', cache: 'no-store' })
      .then(function (res) {
        // Soft-launch claim sessions get 403 on browse/probe; preview cookie / admin get 200.
        if (res.status !== 200) return false;
        return res
          .json()
          .then(function (data) {
            return !(data && data.open === false);
          })
          .catch(function () {
            return isPublicBrowseDateOpen();
          });
      })
      .catch(function () {
        // Network blip: keep public browse open after launch rather than flashing early nav.
        return isPublicBrowseDateOpen();
      })
      .then(function (open) {
        return applyCatalogueOpen(open);
      });
    return catalogueProbePromise;
  }

  window.hubProbeCatalogueAccess = probeCatalogueAccess;
  probeCatalogueAccess();

  var sessionPromise = null;
  window.hubFetchSession = function (force) {
    if (force) sessionPromise = null;
    if (!sessionPromise) {
      if (!force && window.hubSessionPrefetchPromise) {
        sessionPromise = window.hubSessionPrefetchPromise.catch(function () {
          sessionPromise = null;
          return { ok: false };
        });
      } else {
        sessionPromise = fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
          .then(function (res) {
            return res.json();
          })
          .catch(function () {
            sessionPromise = null;
            return { ok: false };
          });
      }
    }
    return sessionPromise;
  };

  window.hubFetchProfile = function (force) {
    if (!force && profilePromise) return profilePromise;
    profilePromise = window
      .hubFetchSession()
      .then(function (session) {
        if (!session || !session.ok) return { ok: false, profile: null };
        return fetch('/api/auth/profile', { credentials: 'include' })
          .then(function (res) {
            return res.json();
          })
          .then(function (data) {
            if (data && data.ok && data.profile) {
              window.hubProfileLocation = String(data.profile.location || '').trim();
            }
            return data && typeof data === 'object' ? data : { ok: false, profile: null };
          });
      })
      .catch(function () {
        profilePromise = null;
        return { ok: false, profile: null };
      });
    return profilePromise;
  };

  window.hubFetchSession()
    .then(function (data) {
      applySessionData(data);
      // Session can unlock the gate — re-check only while still closed.
      if (!catalogueOpen) probeCatalogueAccess(true);
    })
    .catch(function () {
      if (!cachedUser) {
        renderNav(null, false);
        renderImpersonationBanner(null);
      }
    });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureMainSkipTarget);
  } else {
    ensureMainSkipTarget();
  }

  mountBrowseWeekBannerWhenReady();
})();
