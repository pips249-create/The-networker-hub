/**
 * Resolve organiser workspace auth before deferred dashboard JS loads.
 * Avoids flashing the sign-in card while session is still being checked.
 */
(function () {
  var RESOLVED_KEY = '__hubOrganiserAuth';
  var signin = document.getElementById('org-signin');
  var shell = document.getElementById('org-shell');
  var loading = document.getElementById('org-dash-loading');

  function setLoading(on) {
    if (!loading) return;
    loading.hidden = !on;
    loading.classList.toggle('is-active', on);
    loading.setAttribute('aria-hidden', on ? 'false' : 'true');
    loading.setAttribute('aria-busy', on ? 'true' : 'false');
    document.body.classList.toggle('hub-is-page-loading', on);
  }

  function signinHref() {
    return (
      '../login?next=' +
      encodeURIComponent('/organiser/' + (window.location.hash || '#business-overview')) +
      '&intent=organiser'
    );
  }

  function updateSigninLink() {
    var signinLink = signin && signin.querySelector('a.org-btn-primary');
    if (signinLink) signinLink.href = signinHref();
  }

  function fetchSession() {
    var prefetch = window.hubSessionPrefetchPromise;
    if (prefetch && typeof prefetch.then === 'function') {
      return prefetch.then(function (data) {
        if (data && data.ok && data.user) return data;
        return fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' }).then(
          function (res) {
            return res.json();
          }
        );
      });
    }
    return fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' }).then(
      function (res) {
        return res.json();
      }
    );
  }

  function resolveAuth(data) {
    window[RESOLVED_KEY] = data || { ok: false };

    if (data && data.ok && data.user) {
      var hasAccess =
        data.organiserUiVisible || data.user.role === 'admin' || data.impersonating;
      if (!hasAccess) {
        if (data.organiserAccess && !data.organiserUiVisible) {
          window.location.replace('../account/settings#organiser-workspace');
          return;
        }
        window.location.replace('/organiser/enable');
        return;
      }
      if (signin) signin.hidden = true;
      if (shell) shell.hidden = false;
      setLoading(true);
      return;
    }

    setLoading(false);
    if (shell) shell.hidden = true;
    if (signin) signin.hidden = false;
    updateSigninLink();
  }

  if (signin) signin.hidden = true;
  updateSigninLink();
  setLoading(true);

  fetchSession()
    .then(resolveAuth)
    .catch(function () {
      resolveAuth({ ok: false });
    });
})();
