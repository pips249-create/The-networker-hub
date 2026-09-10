/**
 * Partner Programme — apply / enquire form on /partners.
 */
(function () {
  var form = document.getElementById('partner-enquire-form');
  if (!form) return;

  var statusEl = document.getElementById('partner-enquire-status');
  var submitBtn = form.querySelector('[type="submit"]');
  var getTurnstileToken = function () {
    return Promise.resolve('');
  };

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.hidden = !message;
    statusEl.textContent = message || '';
    statusEl.classList.toggle('partner-enquire-status--error', Boolean(isError));
  }

  if (window.HUB_turnstile && typeof window.HUB_turnstile.bindForm === 'function') {
    window.HUB_turnstile.bindForm(form).then(function (fn) {
      getTurnstileToken = fn || getTurnstileToken;
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = String(document.getElementById('partner-enquire-name')?.value || '').trim();
    var email = String(document.getElementById('partner-enquire-email')?.value || '').trim();
    var organisation = String(
      document.getElementById('partner-enquire-org')?.value || ''
    ).trim();
    var audience = String(
      document.getElementById('partner-enquire-audience')?.value || ''
    ).trim();
    var message = String(
      document.getElementById('partner-enquire-message')?.value || ''
    ).trim();
    var website = String(
      document.getElementById('partner-enquire-website')?.value || ''
    ).trim();

    if (!name || !email || !audience) {
      setStatus('Please fill in your name, email, and who you can introduce.', true);
      return;
    }

    setStatus('Sending…', false);
    if (submitBtn) submitBtn.disabled = true;

    getTurnstileToken()
      .then(function (token) {
        var payload = {
          name: name,
          email: email,
          organisation: organisation,
          audience: audience,
          message: message,
          website: website,
        };
        if (token) payload.turnstileToken = token;
        return fetch('/api/partner-enquire', {
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
              'Could not send your enquiry. Please email partnerships@thenetworkeruk.com instead.',
            true
          );
          return;
        }
        form.reset();
        setStatus(
          result.data.message ||
            'Thanks — we have your enquiry and will reply if we can take this forward.',
          false
        );
      })
      .catch(function () {
        setStatus(
          'Could not reach the server. Please email partnerships@thenetworkeruk.com instead.',
          true
        );
      })
      .finally(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
  });
})();
