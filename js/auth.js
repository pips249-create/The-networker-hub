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

  function getIntentParam() {
    var p = new URLSearchParams(window.location.search);
    return p.get('intent') || '';
  }

  function isOrganiserAuthIntentFromPage() {
    var intent = getIntentParam();
    if (intent === 'organiser') return true;
    var next = getNextParam();
    if (!next) return false;
    try {
      var path = /^https?:\/\//i.test(next) ? new URL(next).pathname : next.split('?')[0];
      return /^\/organiser(\/|$)/.test(path);
    } catch (e) {
      return /^\/organiser(\/|$)/.test(next.split('?')[0]);
    }
  }

  function withNextParam(baseUrl) {
    var next = getNextParam();
    var intent = getIntentParam();
    var url = baseUrl;
    if (next) {
      url += (url.indexOf('?') >= 0 ? '&' : '?') + 'next=' + encodeURIComponent(next);
    }
    if (intent) {
      url += (url.indexOf('?') >= 0 ? '&' : '?') + 'intent=' + encodeURIComponent(intent);
    }
    return url;
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
    function submitLogin(email, password, rememberMe, next) {
      var msg = document.getElementById('auth-message');
      var btn = document.getElementById('login-submit');
      btn.disabled = true;
      showMessage(msg, 'Signing in…', 'success');

      var payload = {
        email: email,
        password: password,
        next: next,
        rememberMe: rememberMe,
        intent: getIntentParam(),
      };

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

    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = document.getElementById('email').value.trim();
      var password = document.getElementById('password').value;
      var rememberEl = document.getElementById('remember-me');
      var rememberMe = rememberEl ? rememberEl.checked : false;
      var next = getNextParam();
      submitLogin(email, password, rememberMe, next);
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
          intent: getIntentParam(),
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

  function applyOrganiserIntentContext() {
    if (getIntentParam() === 'organiser-claim') return;
    if (!isOrganiserAuthIntentFromPage()) return;

    var loginLede = document.querySelector('#login-form') && document.querySelector('.auth-lede');
    if (loginLede) {
      loginLede.textContent =
        'Sign in to open your organiser workspace — list events, manage attendees, and reach members browsing the Hub.';
    }

    var registerTitle = document.querySelector('#register-form') && document.querySelector('.auth-card--wizard h1');
    if (registerTitle) {
      registerTitle.textContent = 'Create your organiser account';
    }

    var registerLede = document.querySelector('#register-form') && document.querySelector('.auth-lede');
    if (registerLede) {
      registerLede.textContent =
        'Step 1 of 2 — create your account to list events and manage your group. We enable organiser access automatically; confirm your email before publishing.';
    }

    var registerWizard = document.querySelector('.auth-wizard-step.is-current .auth-wizard-label');
    if (registerWizard) {
      registerWizard.textContent = 'Create organiser account';
    }
  }

  function applyOrganiserClaimContext() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('intent') !== 'organiser-claim') return;

    document.title = loginForm
      ? 'Claim your organiser page – Sign in – The Networker Hub'
      : 'Claim your organiser page – Create account – The Networker Hub';

    var callout = document.getElementById('auth-intent-callout');
    if (callout) callout.hidden = false;

    var loginTitle = document.getElementById('login-form-title');
    if (loginTitle) {
      loginTitle.textContent = 'Sign in to claim your page';
    }

    var loginLede = document.querySelector('#login-form') && document.querySelector('.auth-lede');
    if (loginLede) {
      loginLede.textContent =
        'Use the email address your group listing is linked to on the Hub. If you are new here, create a free account below instead.';
    }

    var panelKicker = document.getElementById('auth-panel-kicker');
    if (panelKicker) panelKicker.textContent = 'For organisers';

    var panelTitle = document.getElementById('auth-panel-title');
    if (panelTitle) panelTitle.textContent = 'Claim your organiser page';

    var panelLede = document.getElementById('auth-panel-lede');
    if (panelLede) {
      panelLede.textContent =
        'Many UK networking groups are already listed from the legacy Networker directory. Sign in to verify ownership and take control of your profile.';
    }

    var panelPoints = document.getElementById('auth-panel-points');
    if (panelPoints) {
      panelPoints.innerHTML =
        '<li>Sign in with your group\u2019s contact email</li>' +
        '<li>Confirm the claim prompt on your organiser dashboard</li>' +
        '<li>Update your logo, description, and contact details</li>' +
        '<li>List your next event and manage bookings</li>';
    }

    var panelCta = document.getElementById('auth-panel-cta');
    if (panelCta) {
      panelCta.textContent = 'Read the full claim guide \u2192';
      panelCta.setAttribute('href', '/guides/claim-your-organiser-page');
    }

    var createLead = document.getElementById('login-create-account-lead');
    if (createLead) createLead.textContent = 'No Hub account yet?';

    var createBtn = document.getElementById('login-create-account');
    if (createBtn) createBtn.textContent = 'Create a free organiser account';

    var createHint = document.getElementById('login-create-account-hint');
    if (createHint) {
      createHint.textContent = 'Use the same email your group listing is linked to';
    }

    var registerTitle = document.getElementById('register-form-title');
    if (registerTitle) {
      registerTitle.textContent = 'Create your organiser account';
    }

    var registerLede = document.querySelector('#register-form') && document.querySelector('.auth-lede');
    if (registerLede) {
      registerLede.textContent =
        'Use the same email address your group listing is linked to on the Hub. After sign-up you will confirm your organiser page (about 2 minutes).';
    }

    var registerWizard = document.querySelector('.auth-wizard-step.is-current .auth-wizard-label');
    if (registerWizard) {
      registerWizard.textContent = 'Create account';
    }

    var wizardStep2 = document.getElementById('auth-wizard-step-2');
    if (wizardStep2) {
      var wizardStep2Label = wizardStep2.querySelector('.auth-wizard-label');
      if (wizardStep2Label) wizardStep2Label.textContent = 'Confirm your page';
    }

    var calloutText = document.getElementById('auth-intent-callout-text');
    if (calloutText && registerForm && !loginForm) {
      calloutText.textContent =
        'Step 1 of 2 — create an account with the email linked to your group. Next you\u2019ll confirm your page in the organiser dashboard.';
    }
  }

  function maybeRedirectAuthenticatedClaimEntry() {
    var params = new URLSearchParams(window.location.search);
    var next = params.get('next') || '';
    var intent = params.get('intent') || '';
    var isClaimEntry = intent === 'organiser-claim' || next.indexOf('onboard=claim') !== -1;
    if (!isClaimEntry) return;

    fetch('/api/auth/session', { credentials: 'include' })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data.ok || !data.user) return;
        window.location.replace(next || '/organiser/?onboard=claim');
      })
      .catch(function () {
        /* stay on auth form */
      });
  }

  function initLoginHeroSlogan() {
    if (getIntentParam() === 'organiser-claim') return;
    var wordEl = document.getElementById('login-hero-word');
    if (!wordEl || !window.HubFindYourNextRotate) return;

    window.HubFindYourNextRotate(wordEl, ['event', 'Business Opp', 'organiser'], 3000);
  }

  applyCheckoutContext();
  applyOrganiserIntentContext();
  applyOrganiserClaimContext();
  maybeRedirectAuthenticatedClaimEntry();
  initLoginHeroSlogan();
})();
