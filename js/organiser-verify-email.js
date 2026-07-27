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
    showStatus(message || 'Your email is confirmed. Opening your organiser dashboard…', true);
    if (ledeEl) ledeEl.hidden = true;
    if (formEl) formEl.hidden = true;
    if (resendBtn) resendBtn.hidden = true;
    if (continueBtn) continueBtn.hidden = false;
    window.setTimeout(function () {
      window.location.href = '/organiser/';
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
      if ((data.devVerifyCode || data.devVerifyUrl) && devEl) {
        devEl.hidden = false;
        if (data.devVerifyCode) {
          devEl.textContent = 'Dev code: ' + data.devVerifyCode;
        } else {
          devEl.innerHTML =
            'Dev link: <a href="' +
            String(data.devVerifyUrl).replace(/"/g, '&quot;') +
            '">Open verify page</a>';
        }
      }
      showStatus(data.message || 'Confirmation code sent.', true);
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

  async function init() {
    var session = await loadSession();
    if (!session.ok || !session.user) {
      var returnTo = window.location.pathname + window.location.search;
      window.location.href = '/login?next=' + encodeURIComponent(returnTo);
      return;
    }

    if (!session.organiserAccess && (session.pendingClaimCount || 0) === 0) {
      window.location.href = '/organiser/enable';
      return;
    }

    if (addressEl) addressEl.textContent = session.user.email || 'your email';

    if (session.organiserEmailVerified) {
      showVerifiedUi('Your email is confirmed. You can use all organiser features.');
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
      if (confirmBtn) confirmBtn.disabled = false;
    }

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
