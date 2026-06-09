/**
 * Legal & policies — sidebar panel switching with hash URLs.
 */
(function () {
  var panels = [
    'overview',
    'privacy',
    'terms',
    'refunds',
    'organisers',
    'cookies',
    'acceptable-use',
    'advertising',
    'accessibility',
    'legal',
  ];

  function showPolicy(id, options) {
    var opts = options || {};
    if (panels.indexOf(id) === -1) id = 'overview';

    panels.forEach(function (p) {
      var panel = document.getElementById('panel-' + p);
      var nav = document.getElementById('nav-' + p);
      if (panel) panel.classList.toggle('is-active', p === id);
      if (nav) nav.classList.toggle('is-active', p === id);
    });

    if (opts.updateHash !== false) {
      var hash = id === 'overview' ? '' : '#' + id;
      if (location.hash !== hash) {
        history.replaceState(null, '', location.pathname + location.search + hash);
      }
    }

    if (!opts.skipScroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function bindNav() {
    document.querySelectorAll('[data-policy]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        var id = el.getAttribute('data-policy');
        if (!id) return;
        if (el.tagName === 'A' && el.getAttribute('href') && el.getAttribute('href').indexOf('#') === 0) {
          e.preventDefault();
        }
        showPolicy(id);
      });
    });
  }

  function initFromHash() {
    var hash = (location.hash || '').replace(/^#/, '');
    if (hash && panels.indexOf(hash) !== -1) {
      showPolicy(hash, { updateHash: false, skipScroll: true });
    }
  }

  window.showPolicy = showPolicy;
  bindNav();
  initFromHash();
  window.addEventListener('hashchange', initFromHash);
})();
