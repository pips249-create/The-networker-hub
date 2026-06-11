(function () {
  var enrollSecret = '';
  var params = new URLSearchParams(window.location.search);
  var mode = params.get('mode') || 'verify';

  function showMsg(text, isError) {
    var el = document.getElementById('mfa-message');
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
    el.classList.toggle('auth-message--error', !!isError);
    el.classList.toggle('auth-message--ok', !isError && !!text);
  }

  function api(path, body) {
    return fetch(path, {
      method: body ? 'POST' : 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      return res.json().then(function (data) {
        data = data || {};
        if (!res.ok) data.ok = false;
        return data;
      });
    });
  }

  function showEnroll(data) {
    document.getElementById('mfa-title').textContent = 'Set up authenticator';
    document.getElementById('mfa-lead').textContent =
      'Scan or copy this key into your authenticator app. You only need this for Command Centre — organiser and attendee sign-in stays password-only.';
    document.getElementById('mfa-enroll-panel').hidden = false;
    document.getElementById('mfa-verify-panel').hidden = true;
    enrollSecret = data.secret || '';
    document.getElementById('mfa-secret').textContent = enrollSecret;
    var link = document.getElementById('mfa-otpauth-link');
    if (link && data.otpauthUrl) {
      link.href = data.otpauthUrl;
    }
    var codeInput = document.getElementById('mfa-enroll-code');
    if (codeInput) codeInput.focus();
  }

  function showVerify() {
    document.getElementById('mfa-title').textContent = 'Verify your identity';
    document.getElementById('mfa-lead').textContent =
      'Enter the 6-digit code from your authenticator app to open the Command Centre.';
    document.getElementById('mfa-enroll-panel').hidden = true;
    document.getElementById('mfa-verify-panel').hidden = false;
    var codeInput = document.getElementById('mfa-verify-code');
    if (codeInput) codeInput.focus();
  }

  function redirectAfterSuccess(data) {
    window.location.href = data.redirect || 'index.html';
  }

  function bindActions() {
    var enrollBtn = document.getElementById('mfa-enroll-btn');
    if (enrollBtn) {
      enrollBtn.addEventListener('click', function () {
        var code = (document.getElementById('mfa-enroll-code').value || '').trim();
        if (!enrollSecret) {
          showMsg('Setup expired — refresh this page.', true);
          return;
        }
        enrollBtn.disabled = true;
        showMsg('');
        api('/api/auth/admin-mfa', { action: 'enroll-complete', secret: enrollSecret, code: code })
          .then(function (data) {
            if (!data.ok) throw new Error(data.message || data.error || 'Setup failed');
            redirectAfterSuccess(data);
          })
          .catch(function (err) {
            enrollBtn.disabled = false;
            showMsg(err.message || 'Could not complete setup.', true);
          });
      });
    }

    var verifyBtn = document.getElementById('mfa-verify-btn');
    if (verifyBtn) {
      verifyBtn.addEventListener('click', function () {
        var code = (document.getElementById('mfa-verify-code').value || '').trim();
        verifyBtn.disabled = true;
        showMsg('');
        api('/api/auth/admin-mfa', { action: 'verify', code: code })
          .then(function (data) {
            if (!data.ok) throw new Error(data.message || data.error || 'Verification failed');
            redirectAfterSuccess(data);
          })
          .catch(function (err) {
            verifyBtn.disabled = false;
            showMsg(err.message || 'Code not accepted.', true);
          });
      });
    }

    ['mfa-enroll-code', 'mfa-verify-code'].forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (id === 'mfa-enroll-code' && enrollBtn) enrollBtn.click();
          if (id === 'mfa-verify-code' && verifyBtn) verifyBtn.click();
        }
      });
    });
  }

  function init() {
    api('/api/auth/session').then(function (session) {
      if (!session.ok || !session.user || session.user.role !== 'admin') {
        window.location.href = '../login.html?next=' + encodeURIComponent('/admin/mfa.html');
        return;
      }
      if (session.impersonating) {
        showMsg('Stop impersonating before opening Command Centre MFA.', true);
        return;
      }

      return api('/api/auth/admin-mfa').then(function (status) {
        if (!status.ok) {
          showMsg(status.message || 'Could not load MFA status.', true);
          return;
        }
        if (!status.enabled || status.verified) {
          window.location.href = 'index.html';
          return;
        }
        if (status.enrollRequired || mode === 'enroll') {
          return api('/api/auth/admin-mfa', { action: 'enroll-start' }).then(function (data) {
            if (!data.ok) {
              showMsg(data.message || 'Could not start setup.', true);
              return;
            }
            showEnroll(data);
          });
        }
        showVerify();
      });
    });
  }

  bindActions();
  init();
})();
