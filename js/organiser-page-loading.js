/**
 * Full-page loading overlay for organiser event flows.
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

  global.organiserPageLoading = {
    show: function (message) {
      setPageLoading(true, message);
    },
    hide: function () {
      setPageLoading(false);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
