/**
 * Preview waitlist signup — posts to /api/auth/site-access (intent: waitlist).
 * Bind any form with data-preview-waitlist (optional data-source for analytics).
 */
(function () {
  function showAlert(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className =
      'preview-waitlist-alert preview-waitlist-alert--' + (type || 'error');
    el.hidden = !text;
  }

  function parseResponse(res, text) {
    var data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = {};
      }
    }
    return { ok: res.ok, status: res.status, data: data };
  }

  function friendlyError(result) {
    if (result.data && result.data.message) return result.data.message;
    if (result.status === 429) return 'Too many attempts. Please try again shortly.';
    if (result.status) return 'Request failed. Please try again shortly.';
    return 'Something went wrong. Please try again.';
  }

  function bindForm(form) {
    if (!form || form.getAttribute('data-preview-waitlist-bound') === '1') return;
    form.setAttribute('data-preview-waitlist-bound', '1');

    var msg = form.querySelector('[data-preview-waitlist-message]');
    var emailInput = form.querySelector('input[type="email"]');
    var honeypot = form.querySelector('[data-preview-waitlist-honeypot]');
    var btn = form.querySelector('[type="submit"]');
    var source = form.getAttribute('data-source') || 'about';
    try {
      var params = new URLSearchParams(window.location.search);
      var campaign = String(params.get('utm_campaign') || '').trim().toLowerCase();
      var content = String(params.get('utm_content') || '').trim().toLowerCase();
      if (campaign) {
        source = (source + '_' + campaign.replace(/[^a-z0-9_-]/g, '').slice(0, 24)).slice(0, 40);
      } else if (content) {
        source = (source + '_' + content.replace(/[^a-z0-9_-]/g, '').slice(0, 24)).slice(0, 40);
      }
    } catch (err) {
      /* keep default source */
    }

    var getTurnstileToken = function () {
      return Promise.resolve('');
    };
    if (window.HUB_turnstile && typeof window.HUB_turnstile.bindForm === 'function') {
      window.HUB_turnstile.bindForm(form).then(function (fn) {
        if (typeof fn === 'function') getTurnstileToken = fn;
      });
    }

    function unlock() {
      if (btn) btn.disabled = false;
    }
    unlock();
    window.addEventListener('pageshow', unlock);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = emailInput ? emailInput.value.trim() : '';
      if (!email) {
        showAlert(msg, 'Please enter your email address.', 'error');
        return;
      }

      if (btn) btn.disabled = true;
      showAlert(msg, 'Saving your place…', 'success');

      getTurnstileToken()
        .then(function (token) {
          var body = {
            intent: 'waitlist',
            email: email,
            website: honeypot ? honeypot.value : '',
            source: source,
          };
          if (token) body.turnstileToken = token;
          return fetch('/api/auth/site-access', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
        })
        .then(function (res) {
          return res.text().then(function (text) {
            return parseResponse(res, text);
          });
        })
        .then(function (result) {
          if (!result.ok) {
            showAlert(msg, friendlyError(result), 'error');
            unlock();
            return;
          }
          showAlert(
            msg,
            result.data.message ||
              'Thanks — you are on the list. We will email you before launch.',
            'success'
          );
          form.reset();
          unlock();
        })
        .catch(function () {
          showAlert(msg, 'Could not reach the server. Try again shortly.', 'error');
          unlock();
        });
    });
  }

  function init() {
    var forms = document.querySelectorAll('form[data-preview-waitlist]');
    Array.prototype.forEach.call(forms, bindForm);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
