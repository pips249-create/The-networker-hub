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
    if (intent === 'organiser' || intent === 'organiser-claim') return true;
    var next = getNextParam();
    if (!next) return false;
    try {
      var path = /^https?:\/\//i.test(next) ? new URL(next).pathname : next.split('?')[0];
      return /^\/organiser(\/|$)/.test(path);
    } catch (e) {
      return /^\/organiser(\/|$)/.test(next.split('?')[0]);
    }
  }

  function isNetworkerAuthIntentFromPage() {
    var intent = getIntentParam();
    if (intent === 'networker') return true;
    var next = getNextParam();
    if (!next) return false;
    try {
      var path = /^https?:\/\//i.test(next) ? new URL(next).pathname : next.split('?')[0];
      return /^\/account(\/|$)/.test(path);
    } catch (e) {
      return /^\/account(\/|$)/.test(next.split('?')[0]);
    }
  }

  function isOrganiserNextPath(next) {
    if (!next) return false;
    try {
      var path = /^https?:\/\//i.test(next) ? new URL(next).pathname : next.split('?')[0];
      return /^\/organiser(\/|$)/.test(path);
    } catch (e) {
      return /^\/organiser(\/|$)/.test(next.split('?')[0]);
    }
  }

  function updateAuthLinks() {
    if (createAccountLink) {
      createAccountLink.setAttribute('href', withNextParam('/register'));
    }
    if (registerSignInLink) {
      registerSignInLink.setAttribute('href', withNextParam('/login'));
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

    var registerTitle = document.querySelector('#register-form') && document.querySelector('.auth-card--wizard h1');
    if (registerTitle) {
      registerTitle.textContent = 'Create your organiser account';
    }

    var registerLede = document.querySelector('#register-form') && document.querySelector('.auth-lede');
    if (registerLede) {
      registerLede.textContent =
        'Step 1 of 2 — create your account to list events and manage your group. We enable organiser access automatically; confirm your email before publishing.';
    }

    var registerProof = document.getElementById('auth-platform-proof');
    if (registerProof) registerProof.hidden = true;

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
        'Use the email address your group listing is linked to on the Hub — when it matches, you\u2019ll get a claim prompt on your dashboard. If you are new here, create a free account below instead.';
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

    var registerProof = document.getElementById('auth-platform-proof');
    if (registerProof) registerProof.hidden = true;

    var panelProof = document.getElementById('auth-panel-proof');
    if (panelProof) {
      panelProof.textContent = '27,000+ Events listed last year \u00b7 UK-wide directory';
      panelProof.hidden = false;
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
    if (calloutText) {
      if (loginForm) {
        calloutText.textContent =
          'Step 1 of 2 — sign in with the email linked to your group. When it matches, a claim prompt appears on your organiser dashboard.';
      } else if (registerForm) {
        calloutText.textContent =
          'Step 1 of 2 — create an account with the email linked to your group. When it matches, a claim prompt appears on your organiser dashboard.';
      }
    }

    var calloutNote = document.getElementById('auth-intent-callout-note');
    if (calloutNote) {
      calloutNote.innerHTML =
        'Email changed? Email <a href="mailto:catherine@thenetworkerhub.com">catherine@thenetworkerhub.com</a> with your group name and we\u2019ll help.';
    }

    var audienceToggle = document.getElementById('auth-audience-toggle');
    if (audienceToggle) audienceToggle.hidden = true;

    var audienceNote = document.getElementById('login-audience-note');
    if (audienceNote) audienceNote.hidden = true;
  }

  function initLoginAudienceToggle() {
    if (!loginForm) return;
    if (getIntentParam() === 'organiser-claim') return;

    var params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === '1') {
      var checkoutToggle = document.getElementById('auth-audience-toggle');
      if (checkoutToggle) checkoutToggle.hidden = true;
      var checkoutNote = document.getElementById('login-audience-note');
      if (checkoutNote) checkoutNote.hidden = true;
      return;
    }

    var toggle = document.getElementById('auth-audience-toggle');
    var networkerBtn = document.getElementById('auth-audience-networker');
    var organiserBtn = document.getElementById('auth-audience-organiser');
    if (!toggle || !networkerBtn || !organiserBtn) return;

    var heroStop = null;

    var LOGIN_AUDIENCE = {
      neutral: {
        kicker: 'The Networker Hub',
        titleHtml: 'Your Hub account',
        lede: 'One login for browsing events, managing bookings, and opening your organiser workspace.',
        points: [
          'Browse & book UK networking events',
          'My Hub dashboard, alerts & saved listings',
          'List events & manage your group when you\u2019re ready',
          'Compare & enquire on Business Opportunities',
        ],
        ctaText: 'See what\u2019s included for networkers \u2192',
        ctaHref: '/for-attendees',
        formLede: 'Welcome back \u2014 use the email and password for your Hub account. Same login for My Hub and your organiser workspace.',
        createLead: 'New to The Networker Hub?',
        createBtn: 'Create a free account',
        createHint: '17,000+ networkers last year \u00b7 free to join',
        panelProof: '27,000+ Events listed \u00b7 17,000+ networkers last year',
        showNote: true,
        rotate: null,
      },
      networker: {
        kicker: 'For networkers',
        titleHtml: 'Find your next <span class="auth-panel-accent" id="login-hero-word">event</span>',
        lede: 'Stop wasting time searching for your next event, business opportunities, or organisers \u2014 they can all be found on your Networker Hub.',
        points: [
          'Browse & book UK networking events',
          'Compare & enquire on Business Opportunities',
          'Discover organisers & read reviews',
          'My Hub dashboard & smart alerts',
          'Guest visits & member rates when signed in',
        ],
        ctaText: 'See what\u2019s included for networkers \u2192',
        ctaHref: '/for-attendees',
        formLede: 'Sign in to open My Hub \u2014 saved events, bookings, alerts, and member rates.',
        createLead: 'New to The Networker Hub?',
        createBtn: 'Create a free account',
        createHint: '17,000+ networkers last year \u00b7 free to join',
        panelProof: '27,000+ Events listed \u00b7 17,000+ networkers last year',
        showNote: true,
        rotate: ['event', 'Business Opportunity', 'organiser'],
      },
      organiser: {
        kicker: 'For organisers',
        titleHtml: 'Find your next <span class="auth-panel-accent" id="login-hero-word">attendees</span>',
        lede: 'Ticketing and discovery for UK networking groups \u2014 from weekly breakfasts to annual conferences.',
        points: [
          'List events & sell tickets with guest-visit tools',
          'Manage bookings, visits & attendee exports',
          'Reach members browsing events on the Hub',
          'Keep 100% of ticket price \u00b7 free to list',
          'Claim your page if your group is already listed',
        ],
        ctaText: 'See what\u2019s included for organisers \u2192',
        ctaHref: '/for-organisers',
        formLede: 'Sign in to open your organiser workspace \u2014 list events, manage attendees, and reach members browsing the Hub.',
        createLead: 'No organiser account yet?',
        createBtn: 'Create a free organiser account',
        createHint: '27,000+ Events listed last year \u00b7 free to list',
        panelProof: '17,000+ people used the directory last year \u00b7 27,000+ Events listed',
        showNote: false,
        rotate: ['attendees', 'bookings', 'discovery'],
      },
    };

    function detectInitialAudience() {
      if (isOrganiserAuthIntentFromPage()) return 'organiser';
      if (isNetworkerAuthIntentFromPage()) return 'networker';
      return 'neutral';
    }

    function stopHeroRotation() {
      if (typeof heroStop === 'function') {
        heroStop();
        heroStop = null;
      }
    }

    function startHeroRotation(words) {
      stopHeroRotation();
      if (!words || !words.length || !window.HubFindYourNextRotate) return;
      var wordEl = document.getElementById('login-hero-word');
      if (!wordEl) return;
      heroStop = window.HubFindYourNextRotate(wordEl, words, 3000);
    }

    function renderPoints(el, points) {
      if (!el || !points) return;
      el.innerHTML = points.map(function (point) {
        return '<li>' + point + '</li>';
      }).join('');
    }

    function syncAudienceUrl(audience) {
      var urlParams = new URLSearchParams(window.location.search);
      var next = urlParams.get('next') || '';

      if (audience === 'organiser') {
        urlParams.set('intent', 'organiser');
        if (!isOrganiserNextPath(next)) {
          urlParams.set('next', '/organiser/');
        }
      } else {
        urlParams.delete('intent');
        if (isOrganiserNextPath(next)) {
          urlParams.delete('next');
        }
      }

      var query = urlParams.toString();
      var nextUrl = window.location.pathname + (query ? '?' + query : '');
      window.history.replaceState(null, '', nextUrl);
      updateAuthLinks();
    }

    function setToggleState(audience) {
      var isOrganiser = audience === 'organiser';
      networkerBtn.classList.toggle('is-active', !isOrganiser);
      organiserBtn.classList.toggle('is-active', isOrganiser);
      networkerBtn.setAttribute('aria-selected', isOrganiser ? 'false' : 'true');
      organiserBtn.setAttribute('aria-selected', isOrganiser ? 'true' : 'false');
    }

    function applyAudience(audience, options) {
      options = options || {};
      var content = LOGIN_AUDIENCE[audience] || LOGIN_AUDIENCE.neutral;
      var panelKicker = document.getElementById('auth-panel-kicker');
      var panelTitle = document.getElementById('auth-panel-title');
      var panelLede = document.getElementById('auth-panel-lede');
      var panelPoints = document.getElementById('auth-panel-points');
      var panelCta = document.getElementById('auth-panel-cta');
      var loginLede = document.getElementById('login-form-lede');
      var createLead = document.getElementById('login-create-account-lead');
      var createBtn = document.getElementById('login-create-account');
      var createHint = document.getElementById('login-create-account-hint');
      var audienceNote = document.getElementById('login-audience-note');
      var panelProof = document.getElementById('auth-panel-proof');

      if (panelKicker) panelKicker.textContent = content.kicker;
      if (panelTitle) panelTitle.innerHTML = content.titleHtml;
      if (panelLede) panelLede.textContent = content.lede;
      if (panelProof) {
        panelProof.textContent = content.panelProof || '';
        panelProof.hidden = !content.panelProof;
      }
      renderPoints(panelPoints, content.points);
      if (panelCta) {
        panelCta.textContent = content.ctaText;
        panelCta.setAttribute('href', content.ctaHref);
      }
      if (loginLede) loginLede.textContent = content.formLede;
      if (createLead) createLead.textContent = content.createLead;
      if (createBtn) createBtn.textContent = content.createBtn;
      if (createHint) createHint.textContent = content.createHint;
      if (audienceNote) audienceNote.hidden = !content.showNote;

      setToggleState(audience === 'organiser' ? 'organiser' : 'networker');
      startHeroRotation(content.rotate);

      if (options.syncUrl !== false) {
        syncAudienceUrl(audience === 'organiser' ? 'organiser' : 'networker');
      }
    }

    function onAudienceSelect(audience) {
      if (audience === 'organiser') {
        applyAudience('organiser');
        return;
      }
      var initial = detectInitialAudience();
      applyAudience(initial === 'networker' ? 'networker' : 'neutral');
    }

    networkerBtn.addEventListener('click', function () {
      onAudienceSelect('networker');
    });

    organiserBtn.addEventListener('click', function () {
      onAudienceSelect('organiser');
    });

    var initialAudience = detectInitialAudience();
    applyAudience(initialAudience, { syncUrl: false });
    if (initialAudience === 'organiser') {
      syncAudienceUrl('organiser');
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

  applyCheckoutContext();
  applyOrganiserIntentContext();
  applyOrganiserClaimContext();
  initLoginAudienceToggle();
  maybeRedirectAuthenticatedClaimEntry();
})();
