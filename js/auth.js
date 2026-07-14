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
    createAccountLink.setAttribute('href', withNextParam('/register'));
  }

  var registerSignInLink = document.getElementById('register-signin-link');
  if (registerSignInLink) {
    registerSignInLink.setAttribute('href', withNextParam('/login'));
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

  function prefillEmailFromQuery() {
    var params = new URLSearchParams(window.location.search);
    var queryEmail = (params.get('email') || '').trim();
    var emailEl = document.getElementById('email');
    if (queryEmail && emailEl && !emailEl.value) emailEl.value = queryEmail;
  }

  prefillEmailFromQuery();

  var loginForm = document.getElementById('login-form');
  if (loginForm) {
    function submitLogin(email, password, rememberMe, next, totpCode) {
      var msg = document.getElementById('auth-message');
      var btn = document.getElementById('login-submit');
      btn.disabled = true;
      showMessage(msg, totpCode ? 'Verifying code…' : 'Signing in…', 'success');

      var payload = {
        email: email,
        password: password,
        next: next,
        rememberMe: rememberMe,
      };
      if (totpCode) payload.totpCode = totpCode;

      fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.data && result.data.mfaRequired) {
            showMfaStep();
            showMessage(
              msg,
              result.data.message || 'Enter the 6-digit code from your authenticator app.',
              'error'
            );
            btn.disabled = false;
            return;
          }
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
          window.location.href = result.data.redirect || next || '/events/';
        })
        .catch(function () {
          showMessage(msg, 'Could not reach the server. Try again shortly.', 'error');
          btn.disabled = false;
        });
    }

    function showMfaStep() {
      var wrap = document.getElementById('login-mfa-wrap');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'login-mfa-wrap';
        wrap.className = 'auth-field';
        wrap.innerHTML =
          '<label for="login-totp">Authenticator code</label>' +
          '<input type="text" id="login-totp" name="totp" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="6-digit code" />' +
          '<p class="auth-hint">Open your authenticator app and enter the current 6-digit code.</p>';
        var anchor = loginForm.querySelector('.auth-actions') || loginForm.querySelector('button[type="submit"]');
        if (anchor && anchor.parentNode) {
          anchor.parentNode.insertBefore(wrap, anchor);
        } else {
          loginForm.appendChild(wrap);
        }
      }
      wrap.hidden = false;
      var totpEl = document.getElementById('login-totp');
      if (totpEl) totpEl.focus();
    }

    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = document.getElementById('auth-message');
      var email = document.getElementById('email').value.trim();
      var password = document.getElementById('password').value;
      var rememberEl = document.getElementById('remember-me');
      var rememberMe = rememberEl ? rememberEl.checked : false;
      var next = getNextParam();
      var totpEl = document.getElementById('login-totp');
      var totpCode = totpEl && totpEl.closest('#login-mfa-wrap') && !totpEl.closest('#login-mfa-wrap').hidden
        ? totpEl.value.trim()
        : '';
      if (totpEl && totpEl.closest('#login-mfa-wrap') && !totpEl.closest('#login-mfa-wrap').hidden && !totpCode) {
        showMessage(msg, 'Enter your authenticator code.', 'error');
        return;
      }
      submitLogin(email, password, rememberMe, next, totpCode || undefined);
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

      var marketingEl = document.getElementById('register-marketing');

      fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          password: password,
          name: name,
          next: next,
          marketingOptIn: marketingEl ? marketingEl.checked : false,
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
            window.location.href = result.data.redirect || next || '/welcome';
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
            window.location.href = '/login';
          }, 1500);
        })
        .catch(function () {
          showMessage(msg, 'Request failed.', 'error');
          btn.disabled = false;
        });
    });
  }

  function applyCheckoutContext() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('checkout') !== '1') return;

    var title = '';
    try {
      var raw = sessionStorage.getItem('hub_checkout_intent');
      if (raw) {
        var intent = JSON.parse(raw);
        title = intent && intent.eventTitle ? String(intent.eventTitle).trim() : '';
      }
    } catch (e) {
      /* ignore */
    }

    var loginLede = document.querySelector('#login-form') && document.querySelector('.auth-lede');
    if (loginLede) {
      loginLede.textContent = title
        ? 'You were about to get tickets for “' + title + '”. Sign in to pick up where you left off.'
        : 'Sign in to continue with your ticket booking.';
    }

    var registerLede = document.querySelector('#register-form') && document.querySelector('.auth-lede');
    if (registerLede) {
      registerLede.textContent = title
        ? 'Almost there — create a free account to complete your booking for “' + title + '”.'
        : 'Create a free account to complete your ticket booking.';
    }
  }

  function applyOrganiserClaimContext() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('intent') !== 'organiser-claim') return;

    var loginLede = document.querySelector('#login-form') && document.querySelector('.auth-lede');
    if (loginLede) {
      loginLede.textContent =
        'Use the same email address this invitation was sent to. After signing in you can confirm your organiser page and add events.';
    }

    var registerTitle = document.querySelector('#register-form') && document.querySelector('.auth-card--wizard h1');
    if (registerTitle) {
      registerTitle.textContent = 'Create your organiser password';
    }

    var registerLede = document.querySelector('#register-form') && document.querySelector('.auth-lede');
    if (registerLede) {
      registerLede.textContent =
        'Step 1 — create a password for the email this invite was sent to. You will confirm your organiser page and add events next (about 2 minutes).';
    }

    var registerWizard = document.querySelector('.auth-wizard-step.is-current .auth-wizard-label');
    if (registerWizard) {
      registerWizard.textContent = 'Create password';
    }
  }

  applyCheckoutContext();
  applyOrganiserClaimContext();
})();
