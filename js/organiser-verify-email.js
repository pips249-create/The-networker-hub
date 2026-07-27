(function () {
  var ledeEl = document.getElementById('verify-email-lede');
  var addressEl = document.getElementById('verify-email-address');
  var statusEl = document.getElementById('verify-email-status');
  var errorEl = document.getElementById('verify-email-error');
  var devEl = document.getElementById('verify-email-dev');
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
    return res.json();
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
        showError(data.message || 'Could not resend confirmation email.');
        return;
      }
      if (data.devVerifyUrl && devEl) {
        devEl.hidden = false;
        devEl.innerHTML =
          'Dev link: <a href="' +
          data.devVerifyUrl.replace(/"/g, '&quot;') +
          '">Confirm email</a>';
      }
      showStatus(data.message || 'Confirmation email sent.', true);
    } catch (e) {
      showError('Could not resend confirmation email.');
    } finally {
      if (resendBtn) resendBtn.disabled = false;
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
      showStatus('Your email is confirmed. You can use all organiser features.', true);
      if (ledeEl) ledeEl.hidden = true;
      if (resendBtn) resendBtn.hidden = true;
      if (continueBtn) continueBtn.hidden = false;
      return;
    }

    var token = params().get('token');
    if (token) {
      if (resendBtn) resendBtn.disabled = true;
      var result = await verifyToken(token);
      if (result.ok && result.verified) {
        showStatus(result.message || 'Email confirmed.', true);
        if (ledeEl) ledeEl.hidden = true;
        if (resendBtn) resendBtn.hidden = true;
        if (continueBtn) continueBtn.hidden = false;
        if (window.history.replaceState) {
          var url = new URL(window.location.href);
          url.searchParams.delete('token');
          url.searchParams.delete('email');
          window.history.replaceState({}, '', url.pathname + url.search);
        }
        return;
      }
      showError(result.message || 'This confirmation link is invalid or expired.');
    }
  }

  if (resendBtn) {
    resendBtn.addEventListener('click', function () {
      resend();
    });
  }

  init();
})();
