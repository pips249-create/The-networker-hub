(function () {
  function getNextParam() {
    var params = new URLSearchParams(window.location.search);
    var next = params.get('next') || '/';
    if (!next.startsWith('/') || next.startsWith('//')) return '/';
    return next;
  }

  function showAlert(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = 'site-access-alert site-access-alert--' + (type || 'error');
    el.hidden = !text;
    if (text) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function parseResponse(res, text) {
    var data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = {};
      }
    }
    return { ok: res.ok, status: res.status, data: data, text: text };
  }

  function friendlyError(result) {
    if (result.data && result.data.message) return result.data.message;
    if (result.data && result.data.error === 'invalid_password') {
      return 'Incorrect preview password. Please try again.';
    }
    if (result.data && result.data.error === 'site_private') {
      return 'Preview access is temporarily unavailable. Try again in a moment.';
    }
    if (result.status === 404) {
      return 'Preview service not found — the latest deploy may still be building.';
    }
    if (result.data && result.data.error) return String(result.data.error).replace(/_/g, ' ');
    if (result.text && result.text.indexOf('NOT_FOUND') !== -1) {
      return 'Preview service not found — the latest deploy may still be building.';
    }
    return 'Something went wrong. Please try again.';
  }

  function postSiteAccess(body) {
    return fetch('/api/site-access', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.text().then(function (text) {
        return parseResponse(res, text);
      });
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
      if (!email) {
        showAlert(waitlistMsg, 'Please enter your email address.', 'error');
        return;
      }

      waitlistBtn.disabled = true;
      showAlert(waitlistMsg, 'Saving your place…', 'success');

      postSiteAccess({
        intent: 'waitlist',
        email: email,
        website: honeypot ? honeypot.value : '',
      })
        .then(function (result) {
          if (!result.ok) {
            showAlert(waitlistMsg, friendlyError(result), 'error');
            waitlistBtn.disabled = false;
            return;
          }
          showAlert(
            waitlistMsg,
            result.data.message || 'Thanks — you are on the preview list.',
            'success'
          );
          waitlistForm.reset();
          waitlistBtn.disabled = false;
        })
        .catch(function () {
          showAlert(waitlistMsg, 'Could not reach the server. Try again shortly.', 'error');
          waitlistBtn.disabled = false;
        });
    });
  }

  var accessForm = document.getElementById('site-access-form');
  if (!accessForm) return;

  var msg = document.getElementById('site-access-message');
  var btn = document.getElementById('site-access-submit');
  var passwordInput = document.getElementById('site-access-password');
  var toggle = accessForm.querySelector('.site-access-password-toggle');

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

    if (!password) {
      showAlert(msg, 'Please enter the preview password.', 'error');
      return;
    }

    btn.disabled = true;
    showAlert(msg, 'Checking password…', 'success');

    postSiteAccess({ password: password, next: next })
      .then(function (result) {
        if (!result.ok) {
          showAlert(msg, friendlyError(result), 'error');
          btn.disabled = false;
          return;
        }
        showAlert(msg, 'Access granted — opening the site…', 'success');
        window.location.replace(result.data.redirect || next || '/');
      })
      .catch(function () {
        showAlert(msg, 'Could not reach the server. Try again shortly.', 'error');
        btn.disabled = false;
      });
  });
})();
