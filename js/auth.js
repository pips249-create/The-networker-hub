(function () {
  document.querySelectorAll('.password-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var wrap = btn.closest('.password-input-wrap');
      var input = wrap && wrap.querySelector('input');
      if (!input) return;
      var visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      btn.setAttribute('aria-pressed', visible ? 'false' : 'true');
      btn.setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
      btn.textContent = visible ? 'Show' : 'Hide';
    });
  });

  function showMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.classList.add('is-visible');
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function getNextParam() {
    var p = new URLSearchParams(window.location.search);
    return p.get('next') || '';
  }

  function withNextParam(baseUrl) {
    var next = getNextParam();
    if (!next) return baseUrl;
    var sep = baseUrl.indexOf('?') >= 0 ? '&' : '?';
    return baseUrl + sep + 'next=' + encodeURIComponent(next);
  }

  var createAccountLink = document.getElementById('login-create-account');
  if (createAccountLink) {
    createAccountLink.setAttribute('href', withNextParam('register.html'));
  }

  var createAccountHero = document.getElementById('login-create-account-hero');
  if (createAccountHero) {
    createAccountHero.setAttribute('href', withNextParam('register.html'));
  }

  var registerSignInLink = document.getElementById('register-signin-link');
  if (registerSignInLink) {
    registerSignInLink.setAttribute('href', withNextParam('login.html'));
  }

  var REMEMBER_KEY = 'hub_remember_me';
  var EMAIL_KEY = 'hub_login_email';

  function restoreLoginPrefs() {
    var rememberEl = document.getElementById('remember-me');
    var emailEl = document.getElementById('email');
    if (!rememberEl || !emailEl) return;
    try {
      var remembered = localStorage.getItem(REMEMBER_KEY) === '1';
      rememberEl.checked = remembered;
      if (remembered) {
        var savedEmail = localStorage.getItem(EMAIL_KEY);
        if (savedEmail && !emailEl.value) emailEl.value = savedEmail;
      }
    } catch {
      /* ignore */
    }
  }

  function persistLoginPrefs(email, rememberMe) {
    try {
      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, '1');
        localStorage.setItem(EMAIL_KEY, email);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
        localStorage.removeItem(EMAIL_KEY);
      }
    } catch {
      /* ignore */
    }
  }

  restoreLoginPrefs();

  var loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = document.getElementById('auth-message');
      var btn = document.getElementById('login-submit');
      var email = document.getElementById('email').value.trim();
      var password = document.getElementById('password').value;
      var rememberEl = document.getElementById('remember-me');
      var rememberMe = rememberEl ? rememberEl.checked : false;
      var next = getNextParam();

      btn.disabled = true;
      showMessage(msg, 'Signing in…', 'success');

      fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          password: password,
          next: next,
          rememberMe: rememberMe,
        }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            var errText = result.data.message || result.data.error || 'Sign in failed.';
            if (/UNAUTHORIZED|authentication token|airtable/i.test(String(errText))) {
              errText =
                'The live site is not on Supabase auth yet. Add Supabase env vars in Vercel, redeploy, or sign in after the latest code is deployed.';
            }
            showMessage(msg, errText, 'error');
            btn.disabled = false;
            return;
          }
          persistLoginPrefs(email, rememberMe);
          window.location.href = result.data.redirect || next || '/events/index.html';
        })
        .catch(function () {
          showMessage(msg, 'Could not reach the server. Try again shortly.', 'error');
          btn.disabled = false;
        });
    });
  }

  var registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = document.getElementById('auth-message');
      var btn = document.getElementById('register-submit');
      var name = document.getElementById('name').value.trim();
      var email = document.getElementById('email').value.trim();
      var password = document.getElementById('password').value;
      var password2 = document.getElementById('password2').value;
      var next = getNextParam();

      if (password !== password2) {
        showMessage(msg, 'Passwords do not match.', 'error');
        return;
      }
      if (password.length < 8) {
        showMessage(msg, 'Password must be at least 8 characters.', 'error');
        return;
      }

      var termsEl = document.getElementById('register-terms');
      if (termsEl && !termsEl.checked) {
        showMessage(msg, 'Please agree to the Terms & conditions and Privacy policy.', 'error');
        return;
      }

      btn.disabled = true;
      showMessage(msg, 'Creating your account…', 'success');

      fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          password: password,
          name: name,
          next: next,
        }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            showMessage(msg, result.data.message || 'Could not create account.', 'error');
            btn.disabled = false;
            return;
          }
          showMessage(msg, result.data.message || 'Account created — taking you in…', 'success');
          setTimeout(function () {
            window.location.href = result.data.redirect || next || '/welcome.html';
          }, 600);
        })
        .catch(function () {
          showMessage(msg, 'Could not reach the server. Try again shortly.', 'error');
          btn.disabled = false;
        });
    });
  }

  var forgotForm = document.getElementById('forgot-form');
  if (forgotForm) {
    forgotForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = document.getElementById('auth-message');
      var dev = document.getElementById('dev-reset');
      var btn = document.getElementById('forgot-submit');
      var email = document.getElementById('email').value.trim();

      btn.disabled = true;

      fetch('/api/auth/forgot-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
      })
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          var type = data.accountFound === false ? 'error' : 'success';
          showMessage(msg, data.message || 'Check your email for a reset link.', type);
          var link = data.resetUrl || data.devResetUrl;
          if (link && dev) {
            dev.hidden = false;
            dev.innerHTML =
              '<strong>Reset link</strong> (valid 1 hour):<br><a href="' +
              link +
              '">' +
              link +
              '</a>';
          } else if (dev) {
            dev.hidden = true;
          }
          btn.disabled = false;
        })
        .catch(function () {
          showMessage(msg, 'Request failed. Try again.', 'error');
          btn.disabled = false;
        });
    });
  }

  var resetForm = document.getElementById('reset-form');
  if (resetForm) {
    resetForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = document.getElementById('auth-message');
      var btn = document.getElementById('reset-submit');
      var params = new URLSearchParams(window.location.search);
      var token = params.get('token');
      var p1 = document.getElementById('password').value;
      var p2 = document.getElementById('password2').value;

      if (!token) {
        showMessage(msg, 'Missing reset token. Request a new link.', 'error');
        return;
      }
      if (p1 !== p2) {
        showMessage(msg, 'Passwords do not match.', 'error');
        return;
      }

      btn.disabled = true;

      fetch('/api/auth/reset-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token, password: p1 }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            showMessage(msg, result.data.message || 'Could not reset password.', 'error');
            btn.disabled = false;
            return;
          }
          showMessage(msg, result.data.message || 'Password updated.', 'success');
          setTimeout(function () {
            window.location.href = 'login.html';
          }, 1500);
        })
        .catch(function () {
          showMessage(msg, 'Request failed.', 'error');
          btn.disabled = false;
        });
    });
  }
})();
