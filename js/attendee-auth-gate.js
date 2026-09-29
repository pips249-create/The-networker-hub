/**
 * Resolve attendee dashboard auth before deferred dashboard JS loads.
 * The sign-in card used to be in the HTML without hidden, so a slow
 * session check filled the page and looked like a forced sign-in.
 */
(function () {
  var signin = document.getElementById('ad-signin');
  var loading = document.getElementById('ad-dash-loading');

  function setLoading(on) {
    if (!loading) return;
    loading.hidden = !on;
    loading.classList.toggle('is-active', on);
    loading.setAttribute('aria-hidden', on ? 'false' : 'true');
    loading.setAttribute('aria-busy', on ? 'true' : 'false');
    document.body.classList.toggle('hub-is-page-loading', on);
  }

  function signinHref() {
    var next = window.location.pathname + window.location.search + window.location.hash;
    if (!next || next.charAt(0) !== '/') next = '/account/';
    return '../login?next=' + encodeURIComponent(next);
  }

  function showSignedOut() {
    setLoading(false);
    var shell = document.getElementById('ad-shell');
    if (shell) shell.hidden = true;
    if (!signin) return;
    signin.hidden = false;
    var link = signin.querySelector('a.ad-btn-primary');
    if (link) link.href = signinHref();
  }

  function directSession() {
    return fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' }).then(function (res) {
      return res.json();
    });
  }

  function fetchSession() {
    var primary =
      typeof window.hubFetchSession === 'function' ? window.hubFetchSession() : directSession();
    return primary.then(function (data) {
      if (data && data.ok && data.user) return data;
      return directSession().catch(function () {
        return data || { ok: false };
      });
    });
  }

  if (signin) signin.hidden = true;
  setLoading(true);

  window.__hubAttendeeAuthPromise = fetchSession()
    .then(function (data) {
      window.__hubAttendeeAuth = data || { ok: false };
      if (!data || !data.ok || !data.user) showSignedOut();
      return window.__hubAttendeeAuth;
    })
    .catch(function () {
      window.__hubAttendeeAuth = { ok: false };
      showSignedOut();
      return window.__hubAttendeeAuth;
    });
})();
