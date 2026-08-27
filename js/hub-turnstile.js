/**
 * Optional Cloudflare Turnstile widgets for public forms.
 * No-ops when /api/public-config reports turnstile.enabled === false.
 */
(function (global) {
  var scriptLoading = null;
  var cachedConfig = null;

  function loadScript() {
    if (global.turnstile) return Promise.resolve();
    if (scriptLoading) return scriptLoading;
    scriptLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        scriptLoading = null;
        reject(new Error('turnstile_script_failed'));
      };
      document.head.appendChild(s);
    });
    return scriptLoading;
  }

  function fetchConfig() {
    if (cachedConfig) return Promise.resolve(cachedConfig);
    return fetch('/api/public-config', { credentials: 'same-origin' })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        var cfg =
          result.ok && result.data && result.data.turnstile
            ? result.data.turnstile
            : { enabled: false, siteKey: '' };
        cachedConfig = cfg;
        return cfg;
      })
      .catch(function () {
        cachedConfig = { enabled: false, siteKey: '' };
        return cachedConfig;
      });
  }

  function ensureMount(form) {
    if (!form) return null;
    var existing = form.querySelector('[data-hub-turnstile]');
    if (existing) return existing;
    var wrap = document.createElement('div');
    wrap.className = 'hub-turnstile-wrap';
    wrap.setAttribute('data-hub-turnstile', '1');
    var actions =
      form.querySelector('.ei-submit, .ad-enquiry-quick-submit, .ad-enquiry-submit, [type="submit"]') ||
      null;
    if (actions && actions.parentNode) {
      actions.parentNode.insertBefore(wrap, actions);
    } else {
      form.appendChild(wrap);
    }
    return wrap;
  }

  /**
   * Prepare Turnstile on a form. Resolves with a function that returns a fresh token
   * (or '' when Turnstile is disabled).
   */
  function bindForm(form) {
    if (!form) {
      return Promise.resolve(function () {
        return Promise.resolve('');
      });
    }
    if (form.__hubTurnstileReady) return form.__hubTurnstileReady;

    form.__hubTurnstileReady = fetchConfig().then(function (cfg) {
      if (!cfg.enabled || !cfg.siteKey) {
        return function () {
          return Promise.resolve('');
        };
      }

      var mount = ensureMount(form);
      var widgetId = null;
      var lastToken = '';

      return loadScript()
        .then(function () {
          if (!global.turnstile || !mount) {
            return function () {
              return Promise.resolve('');
            };
          }
          widgetId = global.turnstile.render(mount, {
            sitekey: cfg.siteKey,
            theme: 'light',
            callback: function (token) {
              lastToken = String(token || '');
            },
            'expired-callback': function () {
              lastToken = '';
            },
            'error-callback': function () {
              lastToken = '';
            },
          });

          return function getToken() {
            if (lastToken) return Promise.resolve(lastToken);
            if (widgetId != null && global.turnstile && typeof global.turnstile.getResponse === 'function') {
              var fromWidget = String(global.turnstile.getResponse(widgetId) || '');
              if (fromWidget) {
                lastToken = fromWidget;
                return Promise.resolve(fromWidget);
              }
            }
            return Promise.resolve('');
          };
        })
        .catch(function () {
          return function () {
            return Promise.resolve('');
          };
        });
    });

    return form.__hubTurnstileReady;
  }

  global.HUB_turnstile = {
    bindForm: bindForm,
    fetchConfig: fetchConfig,
  };
})(typeof window !== 'undefined' ? window : globalThis);
