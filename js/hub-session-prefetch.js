/**
 * Start /api/auth/session early so organiser workspace and nav can paint without waiting on deferred JS.
 */
(function () {
  window.hubSessionPrefetchPromise = fetch('/api/auth/session', { credentials: 'include' })
    .then(function (res) {
      return res.json();
    })
    .catch(function () {
      return { ok: false };
    });
})();
