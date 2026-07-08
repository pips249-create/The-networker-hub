(function () {
  var form = document.getElementById('organiser-enable-form');
  var confirmEl = document.getElementById('organiser-enable-confirm');
  var emailEl = document.getElementById('organiser-enable-email');
  var errorEl = document.getElementById('organiser-enable-error');
  var submitBtn = document.getElementById('organiser-enable-submit');

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
  }

  async function loadSession() {
    var res = await fetch('/api/auth/session', { credentials: 'include' });
    return res.json();
  }

  async function init() {
    var data = await loadSession();
    if (!data.ok || !data.user) {
      window.location.href = '../login.html?next=' + encodeURIComponent('/organiser/enable.html');
      return;
    }

    if (emailEl) emailEl.textContent = data.user.email || 'my account';

    if (data.organiserAccess && data.organiserEmailVerified) {
      window.location.href = 'index.html';
      return;
    }
    if (data.organiserAccess && !data.organiserEmailVerified) {
      window.location.href = 'verify-email.html';
      return;
    }
    if ((data.pendingClaimCount || 0) > 0) {
      window.location.href = 'index.html';
      return;
    }
  }

  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      showError('');
      if (!confirmEl || !confirmEl.checked) {
        showError('Please confirm organiser access to continue.');
        return;
      }
      if (submitBtn) submitBtn.disabled = true;

      try {
        var res = await fetch('/api/auth/organiser-access', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'enable', confirm: true }),
        });
        var data = await res.json();
        if (!res.ok || !data.ok) {
          showError(data.message || 'Could not enable organiser access.');
          if (submitBtn) submitBtn.disabled = false;
          return;
        }
        window.location.href = data.redirect || 'verify-email.html';
      } catch (err) {
        showError('Something went wrong. Please try again.');
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  init();
})();
