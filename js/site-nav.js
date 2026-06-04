/**
 * Shared site navigation — same bar on every page.
 * Usage: <div id="hub-site-nav"></div>
 *        <script src="…/js/site-nav.js" data-root="../" data-page="events"></script>
 */
(function () {
  var script = document.currentScript;
  var root = (script && script.getAttribute('data-root')) || '';
  var page = (script && script.getAttribute('data-page')) || '';

  var mount = document.getElementById('hub-site-nav');
  if (!mount) return;

  function href(path) {
    return root + path;
  }

  function link(path, label, key, extraClass) {
    var active = page === key ? ' aria-current="page"' : '';
    var cls = extraClass ? ' class="' + extraClass + '"' : '';
    return '<a href="' + href(path) + '"' + cls + active + '>' + label + '</a>';
  }

  mount.innerHTML =
    '<header class="site-nav on-light" id="site-nav">' +
    '<a class="nav-logo" href="' +
    href('index.html') +
    '" aria-label="The Networker Hub home">' +
    '<img src="' +
    href('assets/logo.png') +
    '" alt="The Networker Hub" width="180" height="72">' +
    '</a>' +
    '<nav class="nav-links" aria-label="Main">' +
    link('index.html#discover', 'Discover', 'home') +
    link('events/index.html', 'Events', 'events') +
    link('index.html#academy', 'Academy', 'academy', 'nav-hide-mobile') +
    link('index.html#for-you', 'For you', 'for-you', 'nav-hide-mobile') +
    link('login.html', 'Sign in', 'auth') +
    link('events/index.html', 'Browse events', 'browse', 'nav-cta') +
    '</nav>' +
    '</header>';

  var nav = document.getElementById('site-nav');
  if (!nav) return;

  function updateNav() {
    nav.classList.toggle('is-scrolled', window.scrollY > 24);
  }
  updateNav();
  window.addEventListener('scroll', updateNav, { passive: true });

  if (page === 'home') {
    document.body.classList.add('hub-page-home');
  } else if (page === 'admin') {
    document.body.classList.add('hub-page-admin');
  } else {
    document.body.classList.add('has-site-nav');
  }
})();
