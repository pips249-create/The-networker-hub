/**
 * Contact page — team email form (Hubert paused until launch).
 */
(function () {
  var form = document.getElementById('contact-team-only-form');
  if (!form) return;

  var statusEl = document.getElementById('contact-team-only-status');
  var submitBtn = form.querySelector('[type="submit"]');
  var getTurnstileToken = function () {
    return Promise.resolve('');
  };

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.hidden = !message;
    statusEl.textContent = message || '';
    statusEl.classList.toggle('contact-team-status--error', Boolean(isError));
  }

  if (window.HUB_turnstile && typeof window.HUB_turnstile.bindForm === 'function') {
    window.HUB_turnstile.bindForm(form).then(function (fn) {
      getTurnstileToken = fn || getTurnstileToken;
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = String(document.getElementById('contact-team-only-name')?.value || '').trim();
    var email = String(document.getElementById('contact-team-only-email')?.value || '').trim();
    var message = String(document.getElementById('contact-team-only-message')?.value || '').trim();
    if (!name || !email || !message) {
      setStatus('Please fill in your name, email, and message.', true);
      return;
    }

    setStatus('Sending…', false);
    if (submitBtn) submitBtn.disabled = true;

    getTurnstileToken()
      .then(function (token) {
        var payload = { name: name, email: email, message: message };
        if (token) payload.turnstileToken = token;
        return fetch('/api/contact-message', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
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
              (result.data.error === 'site_private'
                ? 'This form is temporarily unavailable. Please email hi@thenetworkeruk.com instead.'
                : null) ||
              'Could not send your message. Please email hi@thenetworkeruk.com instead.',
            true
          );
          return;
        }
        form.reset();
        setStatus(result.data.message || 'Thanks — we have your message.', false);
      })
      .catch(function () {
        setStatus(
          'Could not reach the server. Please email hi@thenetworkeruk.com instead.',
          true
        );
      })
      .finally(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
  });
})();
