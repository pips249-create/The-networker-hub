(function () {
  function getNextParam() {
    var params = new URLSearchParams(window.location.search);
    var next = params.get('next') || '/';
    if (!next.startsWith('/') || next.startsWith('//')) return '/';
    return next;
  }

  function showMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className =
      (el.id === 'site-access-message' ? 'auth-message site-access-message ' : 'site-access-message ') +
      'site-access-message--' +
      (type || 'error');
    el.hidden = !text;
  }

  var teamToggle = document.getElementById('team-access-toggle');
  var teamPanel = document.getElementById('team-access-panel');
  if (teamToggle && teamPanel) {
    teamToggle.addEventListener('click', function () {
      var open = teamPanel.hidden;
      teamPanel.hidden = !open;
      teamToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  var waitlistForm = document.getElementById('waitlist-form');
  if (waitlistForm) {
    var waitlistMsg = document.getElementById('waitlist-message');
    var waitlistBtn = document.getElementById('waitlist-submit');
    var waitlistEmail = document.getElementById('waitlist-email');
    var honeypot = document.getElementById('waitlist-website');

    waitlistForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = waitlistEmail.value.trim();

      waitlistBtn.disabled = true;
      showMessage(waitlistMsg, 'Saving…', 'success');

      fetch('/api/site-access', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'waitlist',
          email: email,
          website: honeypot ? honeypot.value : '',
        }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            showMessage(
              waitlistMsg,
              result.data.message || result.data.error || 'Could not save your email.',
              'error'
            );
            waitlistBtn.disabled = false;
            return;
          }
          showMessage(waitlistMsg, result.data.message || 'Thanks — you are on the list.', 'success');
          waitlistForm.reset();
          waitlistBtn.disabled = false;
        })
        .catch(function () {
          showMessage(waitlistMsg, 'Could not reach the server. Try again shortly.', 'error');
          waitlistBtn.disabled = false;
        });
    });
  }

  var accessForm = document.getElementById('site-access-form');
  if (!accessForm) return;

  var msg = document.getElementById('site-access-message');
  var btn = document.getElementById('site-access-submit');
  var passwordInput = document.getElementById('site-access-password');
  var toggle = accessForm.querySelector('.password-toggle');

  if (toggle && passwordInput) {
    toggle.addEventListener('click', function () {
      var show = passwordInput.type === 'password';
      passwordInput.type = show ? 'text' : 'password';
      toggle.textContent = show ? 'Hide' : 'Show';
      toggle.setAttribute('aria-pressed', show ? 'true' : 'false');
      toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  }

  accessForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var password = passwordInput.value;
    var next = getNextParam();

    btn.disabled = true;
    showMessage(msg, 'Checking…', 'success');

    fetch('/api/site-access', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password, next: next }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          showMessage(msg, result.data.message || result.data.error || 'Access denied.', 'error');
          btn.disabled = false;
          return;
        }
        window.location.href = result.data.redirect || next || '/';
      })
      .catch(function () {
        showMessage(msg, 'Could not reach the server. Try again shortly.', 'error');
        btn.disabled = false;
      });
  });
})();
