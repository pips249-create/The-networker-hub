(function () {
  var ledeEl = document.getElementById('verify-email-lede');
  var addressEl = document.getElementById('verify-email-address');
  var statusEl = document.getElementById('verify-email-status');
  var errorEl = document.getElementById('verify-email-error');
  var devEl = document.getElementById('verify-email-dev');
  var formEl = document.getElementById('verify-email-form');
  var codeEl = document.getElementById('verify-email-code');
  var confirmBtn = document.getElementById('verify-email-confirm');
  var resendBtn = document.getElementById('verify-email-resend');
  var continueBtn = document.getElementById('verify-email-continue');

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
      continueBtn.href = nextHref;
      if (goingToPayments) {
        continueBtn.textContent = 'Continue to bank details →';
      } else if (!goingToOrganiser) {
        continueBtn.textContent = 'Continue →';
      }
    }
    window.setTimeout(function () {
      window.location.href = nextHref;
    }, 900);
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
      if (data.devVerifyCode && codeEl) {
        codeEl.value = String(data.devVerifyCode);
      }
      if (data.verifyCode && codeEl) {
        codeEl.value = String(data.verifyCode);
      }
      if ((data.devVerifyCode || data.devVerifyUrl || data.verifyCode || data.verifyUrl) && devEl) {
        devEl.hidden = false;
        if (data.verifyCode || data.devVerifyCode) {
          devEl.textContent =
            'Confirmation code: ' + String(data.verifyCode || data.devVerifyCode);
        } else {
          devEl.innerHTML =
            'Confirm link: <a href="' +
            String(data.verifyUrl || data.devVerifyUrl).replace(/"/g, '&quot;') +
            '">Open verify page</a>';
        }
      }
      showStatus(
        data.message ||
          (data.emailSent === false
            ? 'Email could not be delivered — use the code shown below.'
            : 'Confirmation code sent. Check inbox and spam/junk.'),
        true
      );
      if (codeEl) codeEl.focus();
    } catch (e) {
      showError('Could not resend confirmation code.');
    } finally {
      if (resendBtn) resendBtn.disabled = false;
    }
  }

  async function submitCode(raw) {
    var code = String(raw || '')
      .replace(/\D/g, '')
      .slice(0, 6);
    showError('');
    if (code.length !== 6) {
      showError('Enter the 6-digit code from your email.');
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

  async function init() {
    var session = await loadSession();
    if (!session.ok || !session.user) {
      var returnTo = window.location.pathname + window.location.search;
      window.location.href = '/login?next=' + encodeURIComponent(returnTo);
      return;
    }

    if (addressEl) addressEl.textContent = session.user.email || 'your email';

    if (session.organiserEmailVerified) {
      showVerifiedUi('Your email is confirmed.');
      return;
    }

    var token = params().get('token') || params().get('code');
    if (token) {
      if (confirmBtn) confirmBtn.disabled = true;
      var result = await verifyToken(token);
      if (result.ok && result.data.verified) {
        if (window.history.replaceState) {
          var url = new URL(window.location.href);
          url.searchParams.delete('token');
          url.searchParams.delete('code');
          url.searchParams.delete('email');
          window.history.replaceState({}, '', url.pathname + url.search);
        }
        showVerifiedUi(result.data.message || 'Email confirmed.');
        return;
      }
      showError(
        (result.data && result.data.message) ||
          'This confirmation code is invalid or expired. Enter a new code below.'
      );
      if (codeEl) {
        var digits = String(token || '')
          .replace(/\D/g, '')
          .slice(0, 6);
        if (digits.length === 6) codeEl.value = digits;
      }
      if (confirmBtn) confirmBtn.disabled = false;
    }

    if (codeEl && !codeEl.value) {
      var prefill = '';
      try {
        prefill = sessionStorage.getItem('hub_verify_email_prefill') || '';
        if (prefill) sessionStorage.removeItem('hub_verify_email_prefill');
      } catch (e) {
        prefill = '';
      }
      prefill = String(prefill)
        .replace(/\D/g, '')
        .slice(0, 6);
      if (prefill.length === 6) {
        codeEl.value = prefill;
        if (devEl) {
          devEl.hidden = false;
          devEl.textContent =
            'Email could not be delivered. Enter this confirmation code: ' + prefill;
        }
      }
    }
    await maybeAutoSendVerificationCode();
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
      codeEl.value = String(codeEl.value || '')
        .replace(/\D/g, '')
        .slice(0, 6);
    });
  }

  if (resendBtn) {
    resendBtn.addEventListener('click', function () {
      resend();
    });
  }

  init();
})();
