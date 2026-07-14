/**
 * Full-page loading overlay for organiser event flows.
 * In the dashboard drawer iframe, also notifies the parent so the drawer chrome
 * shows the same busy state (iframe overlay alone is easy to miss).
 */
(function (global) {
  function isEmbedDrawer() {
    try {
      return (
        document.body.classList.contains('ee-embed-drawer') ||
        new URLSearchParams(location.search).get('embed') === '1' ||
        global.self !== global.top
      );
    } catch {
      return false;
    }
  }

  function notifyParentBusy(on, message) {
    if (!isEmbedDrawer() || !global.parent || global.parent === global) return;
    try {
      global.parent.postMessage(
        {
          type: 'hub-event-drawer-busy',
          busy: Boolean(on),
          message: message || '',
        },
        global.location.origin
      );
    } catch {
      /* ignore */
    }
  }

  function setPageLoading(on, message) {
    const el = document.getElementById('ee-page-loading');
    if (!el) {
      notifyParentBusy(on, message);
      return;
    }
    const label = el.querySelector('.ee-page-loading-label');
    if (label) label.textContent = message || 'Loading';
    el.hidden = !on;
    el.setAttribute('aria-busy', on ? 'true' : 'false');
    document.body.classList.toggle('ee-is-loading', !!on);
    notifyParentBusy(on, message);
  }

  function run(message, work) {
    const fn =
      typeof work === 'function'
        ? work
        : function () {
            return work;
          };
    // Organiser editor pages use a fast overlay — FactLoader's min display time slows wizards.
    if (document.getElementById('ee-page-loading')) {
      setPageLoading(true, message);
      return Promise.resolve()
        .then(fn)
        .finally(function () {
          setPageLoading(false);
        });
    }
    if (global.FactLoader) {
      return global.FactLoader.run(fn);
    }
    setPageLoading(true, message);
    return Promise.resolve()
      .then(fn)
      .finally(function () {
        setPageLoading(false);
      });
  }

  global.organiserPageLoading = {
    show: function (message) {
      setPageLoading(true, message);
    },
    hide: function () {
      setPageLoading(false);
    },
    run: run,
  };
})(typeof window !== 'undefined' ? window : globalThis);
