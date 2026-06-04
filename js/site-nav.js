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

  window.HubModeSwitch = {
    html: function (hubView) {
      var isOrg = hubView === 'organiser';
      return (
        '<div class="hub-mode-switch" role="group" aria-label="Switch between attendee and organiser">' +
        '<button type="button" class="hub-mode-btn' +
        (!isOrg ? ' is-active' : '') +
        '" data-hub-mode="attendee">Attendee</button>' +
        '<button type="button" class="hub-mode-btn' +
        (isOrg ? ' is-active' : '') +
        '" data-hub-mode="organiser">Organiser</button>' +
        '</div>'
      );
    },
    bind: function (container, root) {
      bindSwitch(container, root || '');
    },
  };
})();

/**
 * Shared site navigation — same bar on every page.
 * Shows Admin / Organiser dashboard links when signed in with the right role.
 */
(function () {
  var script = document.currentScript;
  var root = (script && script.getAttribute('data-root')) || '';
  var page = (script && script.getAttribute('data-page')) || '';

  var mount = document.getElementById('hub-site-nav');
  if (!mount) return;

  if (!document.querySelector('link[rel="icon"]')) {
    var icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/png';
    icon.href = (script && script.getAttribute('data-root') || '') + 'assets/favicon.png';
    document.head.appendChild(icon);
  }

  var scrollBound = false;

  function href(path) {
    return root + path;
  }

  function link(path, label, key, extraClass) {
    var isActive =
      page === key || (key === 'browse' && (page === 'events' || page === 'browse'));
    var active = isActive ? ' aria-current="page"' : '';
    var cls = extraClass ? ' class="' + extraClass + '"' : '';
    return '<a href="' + href(path) + '"' + cls + active + '>' + label + '</a>';
  }

  function organiserNavLink(user) {
    if (user) {
      return link('organiser/index.html', 'Organiser dashboard', 'organiser', 'nav-organiser');
    }
    return link(
      'login.html?next=/organiser/index.html',
      'Organiser dashboard',
      'organiser',
      'nav-organiser'
    );
  }

  function buildNavLinks(user) {
    var html = '';
    html += link('index.html#discover', 'Discover', 'home');
    html += organiserNavLink(user);
    html += link('index.html#academy', 'Academy', 'academy', 'nav-hide-mobile');
    html += link('index.html#for-you', 'For you', 'for-you', 'nav-hide-mobile');
    html += link('about.html', 'About us', 'about', 'nav-hide-mobile');
    html += link('faq.html', 'FAQ', 'faq', 'nav-hide-mobile');
    if (user && user.role === 'admin') {
      html += link('admin/index.html', 'Command Center', 'admin', 'nav-admin');
    }
    if (user) {
      var hubView = user.hubView || 'attendee';
      var showHubToggle = user.canToggleHubMode !== false && user.role === 'client';
      if (showHubToggle && window.HubModeSwitch) {
        html += window.HubModeSwitch.html(hubView);
      }
      html += '<button type="button" class="nav-signout" id="nav-signout">Sign out</button>';
    } else {
      html += link('login.html', 'Sign in', 'auth');
    }
    html += link('events/index.html', 'Browse events', 'browse', 'nav-cta');
    return html;
  }

  function renderNav(user) {
    mount.innerHTML =
      '<header class="site-nav on-light" id="site-nav">' +
      '<a class="nav-logo" href="' +
      href('index.html') +
      '" aria-label="The Networker Hub home">' +
      '<img src="' +
      href('assets/logo-original.png') +
      '" alt="The Networker Hub" width="200" height="97">' +
      '</a>' +
      '<nav class="nav-links" aria-label="Main">' +
      buildNavLinks(user) +
      '</nav>' +
      '</header>';

    var nav = document.getElementById('site-nav');
    if (!nav) return;

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

    var signOut = document.getElementById('nav-signout');
    if (signOut) {
      signOut.addEventListener('click', function () {
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
  } else {
    document.body.classList.add('has-site-nav');
  }

  renderNav(null);

  fetch('/api/auth/session', { credentials: 'include' })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (data.ok && data.user) {
        data.user.hubView = data.hubView || 'attendee';
        data.user.organiserProfiles = data.organiserProfiles || 0;
        data.user.canToggleHubMode = data.canToggleHubMode === true;
        renderNav(data.user);
      }
    })
    .catch(function () {
      /* keep default nav */
    });
})();
