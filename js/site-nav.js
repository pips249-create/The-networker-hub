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
            if (data.ok && data.redirect) {
              window.location.href = data.redirect.charAt(0) === '/' ? data.redirect : (root || '') + data.redirect;
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
        if (data.ok && data.redirect) {
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
        '<div class="hub-mode-switch" role="group" aria-label="Switch between My Hub and organiser workspace">' +
        '<button type="button" class="hub-mode-btn' +
        (!isOrg ? ' is-active' : '') +
        '" data-hub-mode="attendee">My Hub</button>' +
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
  var NAV_BUILD = '20260722b';
  var SESSION_KEY = 'hub_nav_session_v1';
  var SESSION_TTL_MS = 5 * 60 * 1000;
  var script = document.currentScript;
  var root = (script && script.getAttribute('data-root')) || '';
  var page = (script && script.getAttribute('data-page')) || '';

  function loadComplianceAsset(path) {
    var full = root + path;
    if (document.querySelector('[data-hub-compliance="' + path + '"]')) return;
    if (path.indexOf('.css') !== -1) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = full;
      link.setAttribute('data-hub-compliance', path);
      document.head.appendChild(link);
      return;
    }
    var s = document.createElement('script');
    s.src = full;
    s.defer = true;
    s.setAttribute('data-hub-compliance', path);
    document.head.appendChild(s);
  }

  if (!window.__hubComplianceAssets) {
    window.__hubComplianceAssets = true;
    loadComplianceAsset('css/cookie-consent.css?v=20260609');
    loadComplianceAsset('js/hub-analytics.js?v=20260609');
    loadComplianceAsset('js/cookie-consent.js?v=20260714');
  }

  var mount = document.getElementById('hub-site-nav');
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

  function isLinkActive(key) {
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
    return page === key;
  }

  function link(path, label, key, extraClass) {
    var isActive = isLinkActive(key);
    var active = isActive ? ' aria-current="page"' : '';
    var cls = extraClass ? ' class="' + extraClass + '"' : '';
    return '<a href="' + href(path) + '"' + cls + active + '>' + label + '</a>';
  }

  function showListEventCta(user) {
    return !user || !user.organiserUiVisible;
  }

  function listEventCta(extraClass) {
    var isActive = page === 'for-organisers';
    var active = isActive ? ' aria-current="page"' : '';
    var cls = 'nav-organiser' + (extraClass ? ' ' + extraClass : '');
    return (
      '<a href="' +
      href('/for-organisers') +
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
        '<a role="menuitem" class="nav-dropdown-item nav-organiser-in-menu" href="' +
        href('/organiser/') +
        '"' +
        organiserActive +
        '>Organiser workspace</a>';
    }
    var adminItem = '';
    if (user && user.role === 'admin') {
      adminItem =
        '<a role="menuitem" class="nav-dropdown-item" href="' +
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
      organiserItem +
      '<a role="menuitem" class="nav-dropdown-item" href="' +
      href('/account/') +
      '"' +
      accountActive +
      '>My Hub</a>' +
      '<a role="menuitem" class="nav-dropdown-item" href="' +
      href('/account/settings') +
      '"' +
      settingsActive +
      '>Account settings</a>' +
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
        return;
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ts: Date.now(), user: user }));
    } catch (e) {
      /* ignore quota / private mode */
    }
  }

  function isMoreNavActive() {
    return isLinkActive('organisers') || isLinkActive('faq') || isLinkActive('contact');
  }

  function moreNavDropdownHtml() {
    var organiserActive = isLinkActive('organisers') ? ' aria-current="page"' : '';
    var faqActive = isLinkActive('faq') ? ' aria-current="page"' : '';
    var contactActive = isLinkActive('contact') ? ' aria-current="page"' : '';
    return (
      '<div class="nav-dropdown nav-more-dropdown" id="nav-more">' +
      '<button type="button" class="nav-dropdown-toggle' +
      (isMoreNavActive() ? ' is-active' : '') +
      '" id="nav-more-toggle" aria-expanded="false" aria-haspopup="true" aria-controls="nav-more-menu">' +
      'More <span class="nav-dropdown-chev" aria-hidden="true">▾</span></button>' +
      '<div class="nav-dropdown-menu" id="nav-more-menu" role="menu" hidden>' +
      '<a role="menuitem" class="nav-dropdown-item" href="' +
      href('/events/?mode=organisers') +
      '"' +
      organiserActive +
      '>Organisers</a>' +
      '<a role="menuitem" class="nav-dropdown-item" href="' +
      href('/faq') +
      '"' +
      faqActive +
      '>Help</a>' +
      '<a role="menuitem" class="nav-dropdown-item" href="' +
      href('/contact') +
      '"' +
      contactActive +
      '>Contact</a>' +
      '</div></div>'
    );
  }

  function buildNavLinks(user, pending) {
    var html = '';
    if (user) {
      html += link('/', 'Home', 'home');
    }
    html += link('/events/', 'Events', 'events');
    html += link('/opportunities/', 'Opportunities', 'opportunities');
    if (user) {
      html += link('/events/?mode=organisers', 'Organisers', 'organisers');
      html += link('/faq', 'Help', 'faq');
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
    if (!user) {
      html += moreNavDropdownHtml();
    }
    if (showListEventCta(user)) {
      html += listEventCta();
    }
    if (user) {
      var hubView = user.hubView || 'attendee';
      var showHubToggle =
        user.canToggleHubMode === true &&
        user.role === 'client' &&
        user.organiserUiVisible;
      if (showHubToggle && window.HubModeSwitch) {
        html += window.HubModeSwitch.html(hubView);
      }
      html += myHubDropdownHtml(user);
    } else {
      html += link('/login', 'Sign in', 'auth', 'nav-signin');
    }
    return html;
  }

  function buildMobileDrawerLinks(user, pending) {
    var html = '';
    if (user) {
      html += link('/', 'Home', 'home', 'nav-mobile-item');
    }
    html += link('/events/', 'Events', 'events', 'nav-mobile-item');
    html += link('/opportunities/', 'Opportunities', 'opportunities', 'nav-mobile-item');
    if (user) {
      html += link('/events/?mode=organisers', 'Organisers', 'organisers', 'nav-mobile-item');
      html += link('/faq', 'Help', 'faq', 'nav-mobile-item');
    } else {
      html += '<p class="nav-mobile-section-label">Help &amp; info</p>';
      html += link('/events/?mode=organisers', 'Organisers', 'organisers', 'nav-mobile-item');
      html += link('/faq', 'Help', 'faq', 'nav-mobile-item');
      html += link('/contact', 'Contact', 'contact', 'nav-mobile-item');
    }
    if (pending && !user) {
      html +=
        '<span class="nav-mobile-auth-pending" aria-hidden="true">' +
        '<span class="nav-auth-pending-pill"></span>' +
        '<span class="nav-auth-pending-pill"></span>' +
        '</span>';
      return html;
    }
    if (showListEventCta(user)) {
      html += listEventCta('nav-mobile-item nav-mobile-list-event');
    }
    if (user) {
      var hubView = user.hubView || 'attendee';
      var showHubToggle =
        user.canToggleHubMode === true &&
        user.role === 'client' &&
        user.organiserUiVisible;
      if (showHubToggle && window.HubModeSwitch) {
        html +=
          '<div class="nav-mobile-hub-mode">' + window.HubModeSwitch.html(hubView) + '</div>';
      }
      html += '<p class="nav-mobile-account-label">My account</p>';
      html += link('/account/', 'My Hub', 'account', 'nav-mobile-item');
      if (user.organiserUiVisible) {
        html += link('/organiser/', 'Organiser workspace', 'organiser', 'nav-mobile-item');
      }
      html += link('/account/settings', 'Account settings', 'settings', 'nav-mobile-item');
      html += link('/contact', 'Contact us', 'contact', 'nav-mobile-item');
      if (user.role === 'admin') {
        html += link('/admin/', 'Command Center', 'admin', 'nav-mobile-item');
      }
      html +=
        '<button type="button" class="nav-mobile-item nav-mobile-signout" id="nav-mobile-signout">Sign out</button>';
    } else {
      html += link('/login', 'Sign in', 'auth', 'nav-mobile-item nav-mobile-signin');
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
        fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).finally(function () {
          window.location.href = href('/');
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

  function renderImpersonationBanner(sessionData) {
    var existing = document.getElementById('hub-impersonation-banner');
    if (existing) existing.remove();
    if (!sessionData || !sessionData.impersonating || !sessionData.user) return;

    var banner = document.createElement('div');
    banner.id = 'hub-impersonation-banner';
    banner.className = 'hub-impersonation-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML =
      'You are viewing the Hub as <strong>' +
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
    var pendingClass = pending ? ' is-session-pending' : '';
    mount.innerHTML =
      '<a class="skip-to-content" href="#hub-main-content">Skip to main content</a>' +
      '<header class="site-nav on-light' +
      pendingClass +
      '" id="site-nav">' +
      '<a class="nav-logo" href="' +
      href('/') +
      '" aria-label="The Networker Hub home">' +
      '<img src="' +
      href('assets/logo-nav-transparent.png?v=20260709h') +
      '" alt="The Networker Hub" width="714" height="193">' +
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

    var signOut = document.getElementById('nav-signout');
    if (signOut) {
      signOut.addEventListener('click', function () {
        cacheUser(null);
        fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).finally(function () {
          window.location.href = href('/');
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
  if (cachedUser) {
    renderNav(cachedUser, false);
  } else {
    renderNav(null, true);
  }

  var sessionPromise = null;
  window.hubFetchSession = function () {
    if (!sessionPromise) {
      sessionPromise = fetch('/api/auth/session', { credentials: 'include' })
        .then(function (res) {
          return res.json();
        })
        .catch(function () {
          sessionPromise = null;
          return { ok: false };
        });
    }
    return sessionPromise;
  };

  window.hubFetchSession()
    .then(function (data) {
      applySessionData(data);
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
})();
