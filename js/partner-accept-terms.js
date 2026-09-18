/**
 * Referral Partner Terms acceptance — /partners/accept-terms
 */
(function () {
  var form = document.getElementById('partner-accept-form');
  if (!form) return;

  var statusEl = document.getElementById('partner-accept-status');
  var codeEl = document.getElementById('partner-accept-code');
  var emailEl = document.getElementById('partner-accept-email');
  var agreeEl = document.getElementById('partner-accept-agree');
  var submitBtn = form.querySelector('[type="submit"]');

  try {
    var params = new URLSearchParams(window.location.search || '');
    var ref = String(params.get('ref') || params.get('code') || '')
      .trim()
      .toUpperCase();
    if (ref && codeEl) codeEl.value = ref;
  } catch (e) {}

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.hidden = !message;
    statusEl.textContent = message || '';
    statusEl.classList.toggle('partner-enquire-status--error', Boolean(isError));
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var code = String(codeEl && codeEl.value ? codeEl.value : '')
      .trim()
      .toUpperCase();
    var email = String(emailEl && emailEl.value ? emailEl.value : '').trim();
    var agreed = agreeEl && agreeEl.checked;

    if (!code || !email || !agreed) {
      setStatus('Enter your code and email, and tick the agreement box.', true);
      return;
    }

    setStatus('Saving…', false);
    if (submitBtn) submitBtn.disabled = true;

    fetch('/api/partner-terms', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code, email: email, agreedToTerms: true }),
    })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            return { ok: res.ok, data: data || {} };
          });
      })
      .then(function (result) {
        if (!result.ok || !result.data.ok) {
          setStatus(
            result.data.message ||
              'Could not record acceptance. Check your code and email, or email partnerships@thenetworkeruk.com.',
            true
          );
          return;
        }
        setStatus('Terms accepted — opening your partner workspace…', false);
        var hub =
          result.data.hubUrl ||
          'https://www.thenetworkeruk.com/partners/earnings?ref=' + encodeURIComponent(code);
        window.location.assign(hub);
      })
      .catch(function () {
        setStatus('Could not reach the server. Please try again in a moment.', true);
      })
      .finally(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
  });
})();
