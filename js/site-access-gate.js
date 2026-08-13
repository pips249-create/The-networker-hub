(function () {
  function getNextParam() {
    var params = new URLSearchParams(window.location.search);
    var next = params.get('next') || '/';
    if (!next.startsWith('/') || next.startsWith('//')) return '/';
    return next;
  }

  function showAlert(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = 'site-access-alert site-access-alert--' + (type || 'error');
    el.hidden = !text;
    if (text) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
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
    return { ok: res.ok, status: res.status, data: data, text: text };
  }

  function friendlyError(result) {
    if (result.data && result.data.message) return result.data.message;
    if (result.data && result.data.error === 'invalid_password') {
      return 'Incorrect preview password. Check it matches SITE_ACCESS_PASSWORD in Vercel exactly.';
    }
    if (result.data && result.data.error === 'site_private') {
      return 'Preview access is temporarily unavailable. Try again in a moment.';
    }
    if (result.data && result.data.error === 'cookie_failed') {
      return 'Could not save preview access. Try again shortly.';
    }
    if (result.status === 404 || (result.text && result.text.indexOf('NOT_FOUND') !== -1)) {
      return 'Preview service not found — wait for the latest deploy to finish, then refresh.';
    }
    if (result.data && result.data.error) {
      return String(result.data.error).replace(/_/g, ' ');
    }
    if (result.status) {
      return 'Request failed (HTTP ' + result.status + '). Try again shortly.';
    }
    return 'Something went wrong. Please try again.';
  }

  var SITE_ACCESS_API = '/api/auth/site-access';

  function postSiteAccess(body) {
    return fetch(SITE_ACCESS_API, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.text().then(function (text) {
        return parseResponse(res, text);
      });
    });
  }

  // Visit /site-access?lock=1 to clear preview cookie and show the password form again
  var lockRequested = false;
  var peekToken = '';
  var peekError = false;
  try {
    var params = new URLSearchParams(window.location.search);
    lockRequested = params.get('lock') === '1';
    peekToken = String(params.get('peek') || '').trim();
    peekError = params.get('peek_error') === '1';
  } catch (e) {
    lockRequested = false;
  }
  if (lockRequested) {
    postSiteAccess({ intent: 'lock' }).then(function () {
      var clean = window.location.pathname;
      window.history.replaceState({}, '', clean);
      var teamMsg = document.getElementById('site-access-message');
      showAlert(
        teamMsg,
        'Preview access locked. Enter the team password to unlock the site.',
        'success'
      );
    });
  }

  // co.uk banner soft unlock — opens /peek only (not the full gated Hub)
  if (peekToken && !lockRequested) {
    var peekMsg = document.getElementById('site-access-message');
    showAlert(peekMsg, 'Opening Peek preview…', 'success');
    postSiteAccess({ peek: peekToken, next: '/peek' })
      .then(function (result) {
        if (!result.ok) {
          showAlert(
            peekMsg,
            friendlyError(result) || 'Preview link expired. Join the list or enter the team password.',
            'error'
          );
          try {
            window.history.replaceState({}, '', window.location.pathname);
          } catch (err) {}
          return;
        }
        window.location.replace(result.data.redirect || '/peek');
      })
      .catch(function () {
        window.location.replace(
          '/api/auth/site-access?peek=' +
            encodeURIComponent(peekToken) +
            '&next=' +
            encodeURIComponent('/peek')
        );
      });
  } else if (peekError) {
    showAlert(
      document.getElementById('site-access-message'),
      'That preview link did not work. Join the list below, or enter the team password if you have it.',
      'error'
    );
    try {
      window.history.replaceState({}, '', window.location.pathname);
    } catch (err) {}
  }

  // Interactive organiser and attendee workspace mocks
  (function initDashMocks() {
    var mocks = Array.prototype.slice.call(document.querySelectorAll('.sa-dash-mock'));
    if (!mocks.length) return;

    var reducedMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    mocks.forEach(function (mock) {
      var tabs = Array.prototype.slice.call(mock.querySelectorAll('[data-dash-tab]'));
      var panels = Array.prototype.slice.call(mock.querySelectorAll('[data-dash-panel]'));
      if (!tabs.length || !panels.length) return;

      var order = tabs.map(function (tab) { return tab.getAttribute('data-dash-tab'); });
      var current = 0;
      var autoTimer = null;
      var userTookOver = false;

      function activate(name) {
        current = Math.max(0, order.indexOf(name));
        tabs.forEach(function (tab) {
          var active = tab.getAttribute('data-dash-tab') === name;
          tab.classList.toggle('is-active', active);
          tab.setAttribute('aria-selected', active ? 'true' : 'false');
          if (active && tab.getAttribute('data-dash-bar')) {
            var barLabel = mock.querySelector('[data-dash-bar-label]');
            if (barLabel) barLabel.textContent = tab.getAttribute('data-dash-bar');
          }
        });
        panels.forEach(function (panel) {
          var active = panel.getAttribute('data-dash-panel') === name;
          panel.hidden = !active;
          panel.classList.toggle('is-active', active);
        });
      }

      function stopAuto() {
        userTookOver = true;
        if (autoTimer) {
          window.clearInterval(autoTimer);
          autoTimer = null;
        }
      }

      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          stopAuto();
          activate(tab.getAttribute('data-dash-tab'));
        });
      });

      // Auto-tour each mock when visible; hand over on its first click
      if (!reducedMotion && 'IntersectionObserver' in window) {
        var observer = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (userTookOver) return;
              if (entry.isIntersecting && !autoTimer) {
                autoTimer = window.setInterval(function () {
                  activate(order[(current + 1) % order.length]);
                }, 3500);
              } else if (!entry.isIntersecting && autoTimer) {
                window.clearInterval(autoTimer);
                autoTimer = null;
              }
            });
          },
          { threshold: 0.4 }
        );
        observer.observe(mock);
      }
    });
  })();

  var waitlistForm = document.getElementById('waitlist-form');
  if (waitlistForm) {
    var waitlistMsg = document.getElementById('waitlist-message');
    var waitlistBtn = document.getElementById('waitlist-submit');
    var waitlistEmail = document.getElementById('waitlist-email');
    var honeypot = document.getElementById('waitlist-website');

    function unlockWaitlist() {
      if (waitlistBtn) waitlistBtn.disabled = false;
    }
    unlockWaitlist();
    window.addEventListener('pageshow', unlockWaitlist);

    waitlistForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = waitlistEmail.value.trim();
      if (!email) {
        showAlert(waitlistMsg, 'Please enter your email address.', 'error');
        return;
      }

      if (waitlistBtn) waitlistBtn.disabled = true;
      showAlert(waitlistMsg, 'Saving your place…', 'success');

      postSiteAccess({
        intent: 'waitlist',
        email: email,
        website: honeypot ? honeypot.value : '',
      })
        .then(function (result) {
          if (!result.ok) {
            showAlert(waitlistMsg, friendlyError(result), 'error');
            unlockWaitlist();
            return;
          }
          showAlert(
            waitlistMsg,
            result.data.message || 'Thanks — you are on the preview list.',
            'success'
          );
          waitlistForm.reset();
          unlockWaitlist();
        })
        .catch(function () {
          showAlert(waitlistMsg, 'Could not reach the server. Try again shortly.', 'error');
          unlockWaitlist();
        });
    });
  }

  var accessForm = document.getElementById('site-access-form');
  if (!accessForm) return;

  var msg = document.getElementById('site-access-message');
  var btn = document.getElementById('site-access-submit');
  var passwordInput = document.getElementById('site-access-password');
  var toggle = accessForm.querySelector('.site-access-password-toggle');

  function unlockSubmit() {
    if (btn) btn.disabled = false;
  }

  // Recover if a previous attempt left the button disabled (bfcache / interrupted request)
  unlockSubmit();
  window.addEventListener('pageshow', unlockSubmit);

  if (toggle && passwordInput) {
    toggle.addEventListener('click', function () {
      var show = passwordInput.type === 'password';
      passwordInput.type = show ? 'text' : 'password';
      toggle.textContent = show ? 'Hide' : 'Show';
      toggle.setAttribute('aria-pressed', show ? 'true' : 'false');
      toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  }

  accessForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var password = passwordInput.value.trim();
    var next = getNextParam();

    if (!password) {
      showAlert(msg, 'Please enter the preview password.', 'error');
      unlockSubmit();
      return;
    }

    if (btn) btn.disabled = true;
    showAlert(msg, 'Checking password…', 'success');

    postSiteAccess({ password: password, next: next })
      .then(function (result) {
        if (!result.ok) {
          showAlert(msg, friendlyError(result), 'error');
          unlockSubmit();
          return;
        }
        showAlert(msg, 'Access granted. Opening the site…', 'success');
        window.setTimeout(function () {
          window.location.replace(result.data.redirect || next || '/');
        }, 150);
      })
      .catch(function () {
        showAlert(msg, 'Could not reach the server. Try again shortly.', 'error');
        unlockSubmit();
      });
  });

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function loadFoundingOrganisers() {
    var section = document.getElementById('site-access-founding');
    var grid = document.getElementById('site-access-founding-grid');
    if (!section || !grid) return;

    fetch('/api/founding-organisers?for=gateway', { cache: 'no-store' })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var list = data && data.ok && Array.isArray(data.organisers) ? data.organisers : [];
        if (!list.length) {
          section.hidden = true;
          return;
        }
        section.hidden = false;
        grid.innerHTML = list
          .map(function (org) {
            var name = String(org.name || 'Organiser');
            var initial = name.charAt(0).toUpperCase();
            var darkClass = org.logoBandDark ? ' site-access-founding-card--dark-logo' : '';
            var photo = org.photoUrl
              ? '<img class="site-access-founding-logo" src="' +
                esc(org.photoUrl) +
                '" alt="" loading="lazy" width="44" height="44">'
              : '<span class="site-access-founding-logo site-access-founding-logo-fallback" aria-hidden="true">' +
                esc(initial) +
                '</span>';
            var industry = org.industry
              ? '<p class="site-access-founding-meta">' + esc(org.industry) + '</p>'
              : '';
            var website = org.website
              ? '<a class="site-access-founding-web" href="' +
                esc(org.website) +
                '" target="_blank" rel="noopener noreferrer">Website</a>'
              : '';
            return (
              '<article class="site-access-founding-card' +
              darkClass +
              '">' +
              photo +
              '<div class="site-access-founding-copy">' +
              '<p class="site-access-founding-name">' +
              esc(name) +
              '</p>' +
              industry +
              website +
              '</div></article>'
            );
          })
          .join('');
      })
      .catch(function () {
        section.hidden = true;
      });
  }

  loadFoundingOrganisers();
})();
