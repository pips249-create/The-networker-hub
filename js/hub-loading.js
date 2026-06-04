/**
 * Shared page buffer while API data loads.
 * Usage: hubLoading.show('events-load-overlay'); hubLoading.hide('events-load-overlay');
 */
(function (global) {
  const ACTIVE = 'is-active';

  function getEl(idOrEl) {
    if (!idOrEl) return null;
    return typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  }

  function show(idOrEl, options) {
    const el = getEl(idOrEl);
    if (!el) return;
    const opts = options || {};
    if (opts.title) {
      const t = el.querySelector('.hub-page-buffer-title');
      if (t) t.textContent = opts.title;
    }
    if (opts.message) {
      const m = el.querySelector('.hub-page-buffer-message');
      if (m) m.textContent = opts.message;
    }
    el.classList.add(ACTIVE);
    el.hidden = false;
    el.setAttribute('aria-busy', 'true');
    const hostId = el.getAttribute('data-buffer-host');
    if (hostId) {
      const host = document.getElementById(hostId);
      if (host) host.classList.add('is-loading');
    }
  }

  function hide(idOrEl) {
    const el = getEl(idOrEl);
    if (!el) return;
    el.classList.remove(ACTIVE);
    el.hidden = true;
    el.setAttribute('aria-busy', 'false');
    const hostId = el.getAttribute('data-buffer-host');
    if (hostId) {
      const host = document.getElementById(hostId);
      if (host) host.classList.remove('is-loading');
    }
  }

  /** Always clear loader state even if show() was never called. */
  function clear(idOrEl) {
    hide(idOrEl);
  }

  global.hubLoading = { show, hide, clear };
})();
