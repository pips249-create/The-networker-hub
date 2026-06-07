/**
 * Full-page loading overlay for organiser event flows.
 * Delegates to FactLoader when available (800ms lazy delay + hub facts).
 */
(function (global) {
  function setPageLoading(on, message) {
    const el = document.getElementById('ee-page-loading');
    if (!el) return;
    const label = el.querySelector('.ee-page-loading-label');
    if (label) label.textContent = message || 'Loading';
    el.hidden = !on;
    document.body.classList.toggle('ee-is-loading', !!on);
  }

  function run(message, work) {
    const fn = typeof work === 'function' ? work : function () {
      return work;
    };
    if (global.FactLoader) {
      return global.FactLoader.run(fn);
    }
    setPageLoading(true, message);
    return Promise.resolve().then(fn).finally(function () {
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
