/**
 * Expandable dashboard sidebar — toggle panels; optional single-link navigation.
 * On mobile, the minimal nav becomes a horizontal scroller — keep the active tab in view.
 * Drag-scroll is required: nested overflow-x fails under body/html overflow-x:hidden on iOS.
 */
(function () {
  function isMobileViewport() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function isMobileTabStrip(root) {
    if (!root || !root.classList.contains('hub-side-nav--minimal')) return false;
    return isMobileViewport();
  }

  function scrollPortFor(root) {
    if (!root) return null;
    var wrap = root.closest('.hub-side-nav-scroll');
    if (wrap) return wrap;
    var sidebar = root.closest('.ad-sidebar, .org-sidebar');
    return sidebar || root;
  }

  function scrollActiveIntoView(root) {
    if (!isMobileTabStrip(root)) return;
    var active = root.querySelector(
      '.hub-side-nav-link.is-active, .org-notifications-nav.is-panel-open'
    );
    if (!active) return;
    var port = scrollPortFor(root);
    if (port && typeof port.scrollTo === 'function') {
      var portRect = port.getBoundingClientRect();
      var activeRect = active.getBoundingClientRect();
      var nextLeft =
        port.scrollLeft +
        (activeRect.left - portRect.left) -
        (portRect.width - activeRect.width) / 2;
      try {
        port.scrollTo({ left: Math.max(0, nextLeft), behavior: 'smooth' });
        return;
      } catch (e) {
        port.scrollLeft = Math.max(0, nextLeft);
        return;
      }
    }
    if (typeof active.scrollIntoView === 'function') {
      try {
        active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      } catch (e2) {
        active.scrollIntoView(false);
      }
    }
  }

  function bindDragScroll(port) {
    if (!port || port.dataset.dragScrollBound === '1') return;
    port.dataset.dragScrollBound = '1';

    var pointerId = null;
    var startX = 0;
    var startY = 0;
    var startScroll = 0;
    var dragging = false;
    var moved = false;
    var axis = '';

    function canScroll() {
      return port.scrollWidth > port.clientWidth + 1;
    }

    function onDown(clientX, clientY, id) {
      if (!canScroll()) return false;
      pointerId = id;
      startX = clientX;
      startY = clientY;
      startScroll = port.scrollLeft;
      dragging = true;
      moved = false;
      axis = '';
      return true;
    }

    function onMove(clientX, clientY, ev) {
      if (!dragging) return;
      var dx = clientX - startX;
      var dy = clientY - startY;

      if (!axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
        if (axis === 'y') {
          dragging = false;
          pointerId = null;
          port.classList.remove('is-dragging');
          return;
        }
        port.classList.add('is-dragging');
      }

      if (axis !== 'x') return;
      moved = true;
      port.scrollLeft = startScroll - dx;
      if (ev && ev.cancelable) ev.preventDefault();
    }

    function onUp() {
      if (!dragging && pointerId == null) return;
      pointerId = null;
      dragging = false;
      axis = '';
      port.classList.remove('is-dragging');
      if (moved) {
        port.dataset.dragScrollSuppressClick = '1';
        window.setTimeout(function () {
          delete port.dataset.dragScrollSuppressClick;
        }, 50);
      }
      moved = false;
    }

    if (window.PointerEvent) {
      port.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (!onDown(e.clientX, e.clientY, e.pointerId)) return;
        try {
          port.setPointerCapture(e.pointerId);
        } catch (err) {
          /* ignore */
        }
      });
      port.addEventListener(
        'pointermove',
        function (e) {
          if (pointerId == null || e.pointerId !== pointerId) return;
          onMove(e.clientX, e.clientY, e);
        },
        { passive: false }
      );
      port.addEventListener('pointerup', onUp);
      port.addEventListener('pointercancel', onUp);
      port.addEventListener('lostpointercapture', onUp);
    } else {
      port.addEventListener(
        'touchstart',
        function (e) {
          if (!e.touches || e.touches.length !== 1) return;
          onDown(e.touches[0].clientX, e.touches[0].clientY, 1);
        },
        { passive: true }
      );
      port.addEventListener(
        'touchmove',
        function (e) {
          if (!e.touches || e.touches.length !== 1) return;
          onMove(e.touches[0].clientX, e.touches[0].clientY, e);
        },
        { passive: false }
      );
      port.addEventListener('touchend', onUp);
      port.addEventListener('touchcancel', onUp);
    }

    port.addEventListener(
      'click',
      function (e) {
        if (port.dataset.dragScrollSuppressClick === '1') {
          e.preventDefault();
          e.stopPropagation();
          delete port.dataset.dragScrollSuppressClick;
        }
      },
      true
    );
  }

  function bindMobileScrollPorts(root) {
    bindDragScroll(scrollPortFor(root));
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
    bindMobileScrollPorts(root);
    window.requestAnimationFrame(function () {
      scrollActiveIntoView(root);
      bindMobileScrollPorts(root);
    });
  }

  function bindSavedScopeStrips() {
    document.querySelectorAll('.ad-saved-scope').forEach(bindDragScroll);
  }

  function bindAllScrollPorts() {
    document.querySelectorAll('.hub-side-nav-scroll, .hub-side-nav--minimal').forEach(function (el) {
      if (el.classList.contains('hub-side-nav-scroll')) bindDragScroll(el);
      else bindDragScroll(scrollPortFor(el));
    });
    bindSavedScopeStrips();
  }

  window.HubSideNav = {
    bind: bindSideNav,
    scrollActiveIntoView: scrollActiveIntoView,
    bindAllScrollPorts: bindAllScrollPorts,
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
  bindAllScrollPorts();
  document.addEventListener('DOMContentLoaded', bindAllScrollPorts);
  window.addEventListener('resize', function () {
    window.requestAnimationFrame(bindAllScrollPorts);
  });
})();
