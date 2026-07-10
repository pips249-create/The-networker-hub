/**
 * Attendee ↔ organiser mode toggle (cookie hub_view).
 */
(function () {
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
              window.location.href = root + data.redirect.replace(/^\//, '');
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
          window.location.href = (root || '') + data.redirect.replace(/^\//, '');
        }
        return data;
      });
  }

  window.HubModeSwitch = {
    html: function (hubView) {
      var isOrg = hubView === 'organiser';
      return (
        '<div class="hub-mode-switch" role="group" aria-label="Switch between your tickets and organiser workspace">' +
        '<button type="button" class="hub-mode-btn' +
        (!isOrg ? ' is-active' : '') +
        '" data-hub-mode="attendee">My tickets</button>' +
        '<button type="button" class="hub-mode-btn' +
        (isOrg ? ' is-active' : '') +
        '" data-hub-mode="organiser">Organiser hub</button>' +
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
  var NAV_BUILD = '20260713b';
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
    loadComplianceAsset('js/cookie-consent.js?v=20260609');
  }

  var mount = document.getElementById('hub-site-nav');
  if (!mount) return;

  if (!document.querySelector('link[rel="icon"]')) {
    var icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/png';
    icon.href = (script && script.getAttribute('data-root') || '') + 'assets/hubert-icon.png';
    document.head.appendChild(icon);
  }

  var scrollBound = false;

  function href(path) {
    return root + path;
  }

  function link(path, label, key, extraClass) {
    var isActive = page === key;
    var active = isActive ? ' aria-current="page"' : '';
    var cls = extraClass ? ' class="' + extraClass + '"' : '';
    return '<a href="' + href(path) + '"' + cls + active + '>' + label + '</a>';
  }

  function myHubDropdownHtml(user) {
    var hubActive =
      page === 'organiser' || page === 'account' || page === 'settings' || page === 'admin';
    var organiserActive = page === 'organiser' ? ' aria-current="page"' : '';
    var accountActive = page === 'account' ? ' aria-current="page"' : '';
    var settingsActive = page === 'settings' ? ' aria-current="page"' : '';
    var adminActive = page === 'admin' ? ' aria-current="page"' : '';
    var showOrganiserLink = user && user.organiserUiVisible;
    var organiserItem = '';
    if (showOrganiserLink) {
      organiserItem =
        '<a role="menuitem" class="nav-dropdown-item nav-organiser-in-menu" href="' +
        href('organiser/index.html') +
        '"' +
        organiserActive +
        '>Organiser workspace</a>';
    }
    var adminItem = '';
    if (user && user.role === 'admin') {
      adminItem =
        '<a role="menuitem" class="nav-dropdown-item" href="' +
        href('admin/index.html') +
        '"' +
        adminActive +
        '>Command Center</a>';
    }
    return (
      '<div class="nav-dropdown" id="nav-my-hub">' +
      '<button type="button" class="nav-dropdown-toggle' +
      (hubActive ? ' is-active' : '') +
      '" id="nav-my-hub-toggle" aria-expanded="false" aria-haspopup="true" aria-controls="nav-my-hub-menu">' +
      'My Hub <span class="nav-dropdown-chev" aria-hidden="true">▾</span></button>' +
      '<div class="nav-dropdown-menu" id="nav-my-hub-menu" role="menu" hidden>' +
      organiserItem +
      '<a role="menuitem" class="nav-dropdown-item" href="' +
      href('account/index.html') +
      '"' +
      accountActive +
      '>My tickets &amp; reviews</a>' +
      '<a role="menuitem" class="nav-dropdown-item" href="' +
      href('account/settings.html') +
      '"' +
      settingsActive +
      '>Account settings</a>' +
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

  function buildNavLinks(user, pending) {
    var html = '';
    html += link('/events/', 'Events', 'events');
    html += link('/opportunities/', 'Opportunities', 'opportunities');
    html += link('for-organisers.html', 'For organisers', 'for-organisers');
    html += link('contact.html', 'Contact', 'contact');
    html += link('faq.html', 'Help', 'faq');
    if (pending && !user) {
      html +=
        '<span class="nav-auth-pending" aria-hidden="true">' +
        '<span class="nav-auth-pending-pill"></span>' +
        '<span class="nav-auth-pending-pill nav-auth-pending-pill--short"></span>' +
        '</span>';
      return html;
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
      html += link('login.html', 'Sign in', 'auth');
    }
    return html;
  }

  function buildMobileDrawerLinks(user, pending) {
    var html = '';
    html += link('/events/', 'Events', 'events', 'nav-mobile-item');
    html += link('/opportunities/', 'Opportunities', 'opportunities', 'nav-mobile-item');
    html += link('for-organisers.html', 'For organisers', 'for-organisers', 'nav-mobile-item');
    html += link('contact.html', 'Contact', 'contact', 'nav-mobile-item');
    html += link('faq.html', 'Help', 'faq', 'nav-mobile-item');
    if (pending && !user) {
      html +=
        '<span class="nav-mobile-auth-pending" aria-hidden="true">' +
        '<span class="nav-auth-pending-pill"></span>' +
        '<span class="nav-auth-pending-pill"></span>' +
        '</span>';
      return html;
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
      html += link('account/index.html', 'My tickets &amp; reviews', 'account', 'nav-mobile-item');
      if (user.organiserUiVisible) {
        html += link(
          'organiser/index.html',
          'Organiser workspace',
          'organiser',
          'nav-mobile-item'
        );
      }
      html += link('account/settings.html', 'Account settings', 'settings', 'nav-mobile-item');
      if (user.role === 'admin') {
        html += link('admin/index.html', 'Command Center', 'admin', 'nav-mobile-item');
      }
      html +=
        '<button type="button" class="nav-mobile-item nav-mobile-signout" id="nav-mobile-signout">Sign out</button>';
    } else {
      html += link('login.html', 'Sign in', 'auth', 'nav-mobile-item');
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

    function openMenu() {
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');
      nav.classList.add('is-menu-open');
      drawer.hidden = false;
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      backdrop.hidden = false;
      document.body.classList.add('nav-menu-open');
    }

    function closeMenu() {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      nav.classList.remove('is-menu-open');
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      backdrop.hidden = true;
      document.body.classList.remove('nav-menu-open');
      window.setTimeout(function () {
        if (!drawer.classList.contains('is-open')) drawer.hidden = true;
      }, 260);
    }

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
      if (e.key === 'Escape') closeMenu();
    });

    var mobileSignOut = document.getElementById('nav-mobile-signout');
    if (mobileSignOut) {
      mobileSignOut.addEventListener('click', function () {
        closeMenu();
        cacheUser(null);
        fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).finally(function () {
          window.location.href = href('index.html');
        });
      });
    }

    var mobileMode = drawer.querySelector('.hub-mode-switch');
    if (mobileMode && window.HubModeSwitch) {
      window.HubModeSwitch.bind(mobileMode, root);
    }
  }

  function bindMyHubDropdown(nav) {
    var wrap = nav.querySelector('#nav-my-hub');
    if (!wrap || wrap.dataset.bound) return;
    wrap.dataset.bound = '1';

    var toggle = wrap.querySelector('#nav-my-hub-toggle');
    var menu = wrap.querySelector('#nav-my-hub-menu');
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
            window.location.href = root + String(data.redirect || 'admin/index.html').replace(/^\//, '');
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

  function ensureMainSkipTarget() {
    var mainEl = document.querySelector('main');
    if (mainEl && !mainEl.id) mainEl.id = 'hub-main-content';
    var skip = document.querySelector('.skip-to-content');
    if (skip && mainEl && mainEl.id) skip.setAttribute('href', '#' + mainEl.id);
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

    var signOut = document.getElementById('nav-signout');
    if (signOut) {
      signOut.addEventListener('click', function () {
        cacheUser(null);
        fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).finally(function () {
          window.location.href = href('index.html');
        });
      });
    }
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
