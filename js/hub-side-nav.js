/**
 * Expandable dashboard sidebar — toggle panels; optional single-link navigation.
 */
(function () {
  function bindSideNav(root) {
    if (!root || root.dataset.sideNavBound) return;
    root.dataset.sideNavBound = '1';

    root.querySelectorAll('.hub-side-nav-trigger').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.hub-side-nav-item');
        if (!item) return;
        var panel = item.querySelector('.hub-side-nav-panel');
        var links = panel ? panel.querySelectorAll('.hub-side-nav-link') : [];

        if (links.length === 1) {
          links[0].click();
          if (!item.classList.contains('is-open')) {
            item.classList.add('is-open');
            btn.setAttribute('aria-expanded', 'true');
          }
          return;
        }

        var open = item.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });

    root.querySelectorAll('.hub-side-nav-item').forEach(function (item) {
      if (item.classList.contains('is-open')) {
        var btn = item.querySelector('.hub-side-nav-trigger');
        if (btn) btn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  window.HubSideNav = {
    bind: bindSideNav,
    openGroupForLink: function (link) {
      var item = link && link.closest('.hub-side-nav-item');
      if (!item) return;
      item.classList.add('is-open');
      var btn = item.querySelector('.hub-side-nav-trigger');
      if (btn) btn.setAttribute('aria-expanded', 'true');
    },
    syncActiveGroup: function (root) {
      if (!root) return;
      root.querySelectorAll('.hub-side-nav-item').forEach(function (item) {
        var active = item.querySelector('.hub-side-nav-link.is-active');
        item.classList.toggle('is-active-group', !!active);
        if (active) {
          item.classList.add('is-open');
          var btn = item.querySelector('.hub-side-nav-trigger');
          if (btn) btn.setAttribute('aria-expanded', 'true');
        }
      });
    },
  };

  document.querySelectorAll('.hub-side-nav').forEach(bindSideNav);
})();
