/**
 * Self-serve Events directory carousel booking on /advertising.
 */
(function () {
  var form = document.getElementById('directory-carousel-form');
  if (!form) return;

  var statusEl = document.getElementById('directory-carousel-status');
  var submitBtn = document.getElementById('directory-carousel-submit');
  var logoInput = document.getElementById('directory-carousel-logo');
  var getTurnstileToken = function () {
    return Promise.resolve('');
  };

  function setStatus(text, tone) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.className =
      'city-partner-status' +
      (tone === 'error' ? ' is-error' : tone === 'ok' ? ' is-ok' : '');
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ''));
      };
      reader.onerror = function () {
        reject(new Error('Could not read that logo file.'));
      };
      reader.readAsDataURL(file);
    });
  }

  if (window.HUB_turnstile && typeof window.HUB_turnstile.bindForm === 'function') {
    window.HUB_turnstile.bindForm(form).then(function (fn) {
      if (typeof fn === 'function') getTurnstileToken = fn;
    });
  }

  var params = new URLSearchParams(window.location.search || '');
  if (params.get('directory_carousel') === 'success') {
    setStatus('Payment received — your logo card is going live on the events directory. Thank you.', 'ok');
  } else if (params.get('directory_carousel') === 'cancel') {
    setStatus('Checkout cancelled. Your card was not charged.', 'error');
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var company = String((document.getElementById('directory-carousel-company') || {}).value || '').trim();
    var email = String((document.getElementById('directory-carousel-email') || {}).value || '').trim();
    var ctaUrl = String((document.getElementById('directory-carousel-cta-url') || {}).value || '').trim();
    var ctaLabel = String((document.getElementById('directory-carousel-cta-label') || {}).value || '').trim();
    var file = logoInput && logoInput.files && logoInput.files[0];

    if (!company || !email || !ctaUrl) {
      setStatus('Fill in company name, email, and website link.', 'error');
      return;
    }
    if (!file) {
      setStatus('Choose a logo file to upload (PNG or JPG under 2MB).', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setStatus('Logo must be under 2MB.', 'error');
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    setStatus('Uploading logo and opening secure checkout…');

    Promise.resolve(getTurnstileToken())
      .then(function (token) {
        return readFileAsDataUrl(file).then(function (dataUrl) {
          return { token: token, dataUrl: dataUrl };
        });
      })
      .then(function (prep) {
        return fetch('/api/advertising?route=directory-carousel-checkout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyName: company,
            email: email,
            ctaUrl: ctaUrl,
            ctaLabel: ctaLabel || 'Find out more',
            logoBase64: prep.dataUrl,
            logoMime: file.type || 'image/png',
            logoFilename: file.name || 'logo.png',
            turnstileToken: prep.token || '',
          }),
        });
      })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data || !result.data.url) {
          throw new Error(
            (result.data && result.data.message) ||
              'Could not start checkout. Email rosie@thenetworkeruk.com.'
          );
        }
        window.location.href = result.data.url;
      })
      .catch(function (err) {
        setStatus((err && err.message) || 'Could not start checkout.', 'error');
        if (submitBtn) submitBtn.disabled = false;
      });
  });
})();
