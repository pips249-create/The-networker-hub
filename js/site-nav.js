/**
 * Shared site navigation — same bar on every page.
 * Shows Admin link when signed in with admin role.
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
    var active = page === key ? ' aria-current="page"' : '';
    var cls = extraClass ? ' class="' + extraClass + '"' : '';
    return '<a href="' + href(path) + '"' + cls + active + '>' + label + '</a>';
  }

  function buildNavLinks(user) {
    var html = '';
    html += link('index.html#discover', 'Discover', 'home');
    html += link('events/index.html', 'Events', 'events');
    html += link('index.html#academy', 'Academy', 'academy', 'nav-hide-mobile');
    html += link('index.html#for-you', 'For you', 'for-you', 'nav-hide-mobile');
    if (user && user.role === 'admin') {
      html += link('admin/index.html', 'Admin', 'admin', 'nav-admin');
    }
    if (user) {
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
      href('assets/logo-nav.png') +
      '" alt="The Networker Hub" width="180" height="72">' +
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
        renderNav(data.user);
      }
    })
    .catch(function () {
      /* keep default nav */
    });
})();
