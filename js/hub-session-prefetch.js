/**
 * Start /api/auth/session early so organiser workspace and nav can paint without waiting on deferred JS.
 */
(function () {
  window.hubSessionPrefetchPromise = fetch('/api/auth/session', {
    credentials: 'include',
    cache: 'no-store',
  })
    .then(function (res) {
      if (!res.ok) return { ok: false, prefetchFailed: true };
      return res.json().then(function (data) {
        return data && typeof data === 'object' ? data : { ok: false, prefetchFailed: true };
      });
    })
    .catch(function () {
      // A dropped first request is not the same as being signed out.
      return { ok: false, prefetchFailed: true };
    });
})();
