/**
 * Expandable dashboard sidebar — toggle panels; optional single-link navigation.
 * On mobile, the minimal nav becomes a horizontal scroller — keep the active tab in view.
 */
(function () {
  function isMobileTabStrip(root) {
    if (!root || !root.classList.contains('hub-side-nav--minimal')) return false;
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function scrollActiveIntoView(root) {
    if (!isMobileTabStrip(root)) return;
    var active = root.querySelector('.hub-side-nav-link.is-active, .org-notifications-nav.is-panel-open');
    if (!active || typeof active.scrollIntoView !== 'function') return;
    try {
      active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    } catch (e) {
      active.scrollIntoView(false);
    }
  }

  function watchActiveTab(root) {
    if (!root || root.dataset.sideNavActiveWatch) return;
    root.dataset.sideNavActiveWatch = '1';
    if (typeof MutationObserver === 'undefined') return;
    var timer = null;
    var observer = new MutationObserver(function () {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        scrollActiveIntoView(root);
      }, 40);
    });
    observer.observe(root, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

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

    watchActiveTab(root);
    window.requestAnimationFrame(function () {
      scrollActiveIntoView(root);
    });
  }

  window.HubSideNav = {
    bind: bindSideNav,
    scrollActiveIntoView: scrollActiveIntoView,
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
      scrollActiveIntoView(root);
    },
  };

  document.querySelectorAll('.hub-side-nav').forEach(bindSideNav);
})();