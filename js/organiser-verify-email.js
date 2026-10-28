(function () {
  var ledeEl = document.getElementById('verify-email-lede');
  var addressEl = document.getElementById('verify-email-address');
  var statusEl = document.getElementById('verify-email-status');
  var errorEl = document.getElementById('verify-email-error');
  var formEl = document.getElementById('verify-email-form');
  var codeEl = document.getElementById('verify-email-code');
  var confirmBtn = document.getElementById('verify-email-confirm');
  var resendBtn = document.getElementById('verify-email-resend');
  var continueBtn = document.getElementById('verify-email-continue');
  var signedIn = false;

  function params() {
    return new URLSearchParams(window.location.search);
  }

  /** Safe same-origin path from ?next= (welcome, organiser, payment-setup, etc.). */
  function continueHref() {
    var raw = String(params().get('next') || '').trim();
    if (!raw) return '/welcome';
    try {
      var url = /^https?:\/\//i.test(raw) ? new URL(raw) : new URL(raw, window.location.origin);
      if (url.origin !== window.location.origin) return '/welcome';
      if (url.pathname === '/login' || url.pathname === '/register') return '/welcome';
      if (!/^\//.test(url.pathname) || /^\/\//.test(url.pathname)) return '/welcome';
      return url.pathname + url.search + url.hash;
    } catch (e) {
      return '/welcome';
    }
  }

  function normalizeCode(raw) {
    return String(raw || '')
      .replace(/\D/g, '')
      .slice(0, 6);
  }

  /** Return path for login that keeps the inbox code + email (even after address-bar scrub). */
  function verifyReturnPath(code) {
    var url = new URL(window.location.href);
    var digits = normalizeCode(code);
    if (digits.length === 6) url.searchParams.set('code', digits);
    else {
      url.searchParams.delete('code');
      url.searchParams.delete('token');
    }
    return url.pathname + url.search + url.hash;
  }

  function loginHref(code) {
    // Always use the clean confirm path in ?next= so login recovery matches
    // production URLs (not …/verify-email.html from a static/dev server).
    var clean = new URL(verifyReturnPath(code), window.location.origin);
    clean.pathname = '/organiser/verify-email';
    var href = '/login?next=' + encodeURIComponent(clean.pathname + clean.search + clean.hash);
    var email = String(params().get('email') || '').trim();
    if (email) href += '&email=' + encodeURIComponent(email);
    return href;
  }

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
  }

  function showStatus(message, ok) {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.hidden = !message;
    statusEl.classList.toggle('is-success', !!ok);
    statusEl.classList.toggle('is-error', !ok);
  }

  function showVerifiedUi(message) {
    var nextHref = continueHref();
    var goingToPayments = nextHref.indexOf('/organiser/payment-setup') === 0;
    var goingToOrganiser = nextHref.indexOf('/organiser') === 0;
    showStatus(
      message ||
        (goingToPayments
          ? 'Your email is confirmed. Opening bank details setup…'
          : goingToOrganiser
            ? 'Your email is confirmed. Opening your organiser dashboard…'
            : 'Your email is confirmed. Continuing…'),
      true
    );
    if (ledeEl) ledeEl.hidden = true;
    if (formEl) formEl.hidden = true;
    if (resendBtn) resendBtn.hidden = true;
    if (continueBtn) {
      continueBtn.hidden = false;
      continueBtn.style.display = '';
      continueBtn.href = nextHref;
      if (goingToPayments) {
        continueBtn.textContent = 'Continue to bank details →';
      } else if (goingToOrganiser) {
        continueBtn.textContent = 'Continue to organiser workspace →';
      } else {
        continueBtn.textContent = 'Continue →';
      }
    }
    window.setTimeout(function () {
      window.location.href = nextHref;
    }, 900);
  }

  function showSignedOutUi(hasCode) {
    signedIn = false;
    if (ledeEl) {
      ledeEl.innerHTML = hasCode
        ? 'Your confirmation code is ready below. Sign in with the same email, then tap <strong>Confirm your email</strong> on the next step to finish.'
        : 'Sign in with the same email, then type the 6-digit code from your inbox and tap Confirm your email. Check spam/junk if it is not there yet.';
    }
    showStatus(
      hasCode
        ? 'Code ready — sign in, then confirm to continue.'
        : 'Sign in first, then enter your confirmation code.',
      true
    );
    if (confirmBtn) confirmBtn.textContent = 'Sign in to confirm →';
    if (resendBtn) resendBtn.hidden = true;
    hideContinueUntilVerified();
  }

  function hideContinueUntilVerified() {
    if (!continueBtn) return;
    continueBtn.hidden = true;
    continueBtn.style.display = 'none';
  }

  function showReadyToConfirmUi(hasCode) {
    if (confirmBtn) confirmBtn.textContent = 'Confirm your email';
    if (resendBtn) resendBtn.hidden = false;
    hideContinueUntilVerified();
    if (hasCode) {
      showStatus('Code ready — tap Confirm your email to finish.', true);
    }
  }

  async function loadSession() {
    var res = await fetch('/api/auth/session', { credentials: 'include' });
    return res.json();
  }

  async function verifyToken(token) {
    var res = await fetch('/api/auth/verify-organiser-email', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token }),
    });
    return res.json().then(function (data) {
      return { ok: res.ok, data: data };
    });
  }

  async function resend() {
    showError('');
    if (resendBtn) resendBtn.disabled = true;
    try {
      var res = await fetch('/api/auth/organiser-access', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend-verification' }),
      });
      var data = await res.json();
      if (!res.ok || !data.ok) {
        showError(data.message || 'Could not resend confirmation code.');
        return;
      }
      showStatus(
        data.message ||
          (data.emailSent === false
            ? 'We could not deliver the email. Check spam/junk, then try Resend code.'
            : 'Confirmation code sent. Check inbox and spam/junk, then enter the code.'),
        data.emailSent !== false
      );
      if (codeEl) codeEl.focus();
    } catch (e) {
      showError('Could not resend confirmation code.');
    } finally {
      if (resendBtn) resendBtn.disabled = false;
    }
  }

  async function submitCode(raw) {
    var code = normalizeCode(raw);
    showError('');
    if (code.length !== 6) {
      showError('Enter the 6-digit code from your email.');
      return;
    }

    if (!signedIn) {
      // Preserve the digits through sign-in; they still tap Confirm after login.
      window.location.href = loginHref(code);
      return;
    }

    if (confirmBtn) confirmBtn.disabled = true;
    try {
      var result = await verifyToken(code);
      if (result.ok && result.data.verified) {
        showVerifiedUi(result.data.message || 'Email confirmed.');
        return;
      }
      showError(
        (result.data && result.data.message) ||
          'That code is invalid or expired. Request a new one and try again.'
      );
    } catch (e) {
      showError('Could not confirm your email. Try again.');
    } finally {
      if (confirmBtn) confirmBtn.disabled = false;
    }
  }

  async function maybeAutoSendVerificationCode() {
    if (params().get('token') || params().get('code')) return;
    try {
      var next = String(params().get('next') || '');
      var fromPayments = next.indexOf('/organiser/payment-setup') !== -1;
      var fromSignup = next.indexOf('/welcome') === 0 || !next;
      var autosentKey = fromPayments
        ? 'hub_verify_email_autosent_payments'
        : fromSignup
          ? 'hub_verify_email_autosent_signup'
          : 'hub_verify_email_autosent';
      if (sessionStorage.getItem(autosentKey)) return;
      var statusRes = await fetch('/api/auth/verify-organiser-email', {
        credentials: 'include',
        cache: 'no-store',
      });
      var statusData = await statusRes.json();
      if (!statusRes.ok || !statusData.ok) return;
      if (statusData.organiserEmailVerified) return;
      // From Stripe setup / signup recovery, always resend once if needed.
      if (!fromPayments && !fromSignup && statusData.hasActiveVerifyCode) return;
      if (statusData.hasActiveVerifyCode && fromSignup) return;
      sessionStorage.setItem(autosentKey, '1');
      await resend();
    } catch (e) {
      /* non-fatal */
    }
  }

  function scrubCodeFromAddressBar() {
    if (!window.history.replaceState) return;
    if (!params().get('token') && !params().get('code')) return;
    var scrub = new URL(window.location.href);
    scrub.searchParams.delete('token');
    scrub.searchParams.delete('code');
    window.history.replaceState({}, '', scrub.pathname + scrub.search + scrub.hash);
  }

  async function init() {
    var urlCode = normalizeCode(params().get('code') || params().get('token') || '');
    var emailFromQuery = String(params().get('email') || '').trim();
    if (addressEl && emailFromQuery) addressEl.textContent = emailFromQuery;
    if (urlCode && codeEl) codeEl.value = urlCode;

    var session;
    try {
      session = await loadSession();
    } catch (e) {
      session = { ok: false };
    }

    // Stay on this page when signed out so the code screen does not flash away.
    // They sign in, return here, type/confirm the code, then continue.
    if (!session.ok || !session.user) {
      showSignedOutUi(urlCode.length === 6);
      if (codeEl) codeEl.focus();
      return;
    }

    signedIn = true;
    if (addressEl) addressEl.textContent = session.user.email || emailFromQuery || 'your email';

    if (session.organiserEmailVerified) {
      scrubCodeFromAddressBar();
      showVerifiedUi('Your email is confirmed.');
      return;
    }

    // Prefill from the inbox CTA (?code= / legacy ?token=) but never auto-submit.
    // People must type or tap Confirm — mail scanners that only GET cannot finish.
    if (urlCode && codeEl) {
      codeEl.value = urlCode;
    }
    scrubCodeFromAddressBar();
    showReadyToConfirmUi(urlCode.length === 6);

    // Do not resend after a prefilled inbox code — a fresh code would invalidate it.
    if (!urlCode) await maybeAutoSendVerificationCode();
    if (codeEl) codeEl.focus();
  }

  if (formEl) {
    formEl.addEventListener('submit', function (e) {
      e.preventDefault();
      submitCode(codeEl && codeEl.value);
    });
  }

  if (codeEl) {
    codeEl.addEventListener('input', function () {
      codeEl.value = normalizeCode(codeEl.value);
    });
  }

  if (resendBtn) {
    resendBtn.addEventListener('click', function () {
      if (!signedIn) {
        window.location.href = loginHref(codeEl && codeEl.value);
        return;
      }
      resend();
    });
  }

  init();
})();
