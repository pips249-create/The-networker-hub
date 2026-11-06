/**
 * London Business Show stand join: inline quick signup for TINA + mark the show
 * as attended (stand check-in — not a ticket purchase).
 *
 * Show-floor path only asks for name, email, company, location and password.
 * Full TINA “who you want to meet” stays for the 24h finish-profile email.
 */
(function () {
  'use strict';

  var EVENT_SLUG = 'the-business-show-london';
  var JOIN_PATH =
    '/lbs-tina-join?utm_source=the_business_show_london&utm_medium=leaflet&utm_campaign=tina_lbs';

  var statusEl = document.getElementById('lbs-join-status');
  var actionEl = document.getElementById('lbs-join-action');
  var formEl = document.getElementById('lbs-signup-form');
  var submitBtn = document.getElementById('lbs-submit');
  var signInLink = document.getElementById('lbs-signin-link');
  var getTurnstileToken = function () {
    return Promise.resolve('');
  };

  function setStatus(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.dataset.kind = kind || '';
  }

  function setAction(html) {
    if (!actionEl) return;
    actionEl.hidden = !html;
    actionEl.innerHTML = html || '';
  }

  function showForm(show) {
    if (!formEl) return;
    formEl.hidden = !show;
  }

  function fetchSession() {
    return fetch('/api/auth/session', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        return res.json().catch(function () {
          return {};
        });
      })
      .then(function (data) {
        return data && data.user ? data.user : null;
      })
      .catch(function () {
        return null;
      });
  }

  function markAttended() {
    return fetch('/api/auth/lbs-stand-attend', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ source: 'leaflet_qr' }),
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok || !data || !data.ok) {
          var err = new Error((data && (data.message || data.error)) || 'attend_failed');
          err.code = data && data.error;
          throw err;
        }
        return data;
      });
    });
  }

  function showSignedOut() {
    showForm(true);
    setAction('');
    setStatus('Fill in the boxes below — takes about a minute on the show floor.');
    if (signInLink) {
      signInLink.href = '/login?next=' + encodeURIComponent(JOIN_PATH);
    }
  }

  function showSuccess(already) {
    showForm(false);
    setStatus(
      already
        ? 'You’re already recorded for The Business Show London. You’re done for now on the stand.'
        : 'You’re in — The Business Show London is recorded on your account as attended. You’re done for now on the stand.',
      'ok'
    );
    setAction(
      '<p class="lbs-note">That’s everything needed on the stand. We’ll email you to confirm your address, and again tomorrow if your TINA profile still needs a finish.</p>' +
        '<a class="lbs-btn lbs-btn-primary" href="/events/">Browse events</a>'
    );
  }

  function humanError(err) {
    var code = err && err.code ? String(err.code) : '';
    var msg = err && err.message ? String(err.message) : '';
    if (code === 'already_going' || code === 'already_registered' || /already/i.test(msg)) {
      return 'You’re already marked as having attended The Business Show London.';
    }
    if (code === 'no_free_ticket') {
      return 'Show check-in isn’t open on this listing yet. You can still finish your TINA profile later.';
    }
    if (code === 'event_not_found') {
      return 'We couldn’t find the show listing. Your free profile is still created.';
    }
    return 'We couldn’t record attendance automatically. You can add the show from Events I’ve attended later.';
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function bindSignupForm() {
    if (!formEl) return;

    if (window.HUB_turnstile && typeof window.HUB_turnstile.bindForm === 'function') {
      window.HUB_turnstile.bindForm(formEl).then(function (fn) {
        if (typeof fn === 'function') getTurnstileToken = fn;
      });
    }

    formEl.addEventListener('submit', function (e) {
      e.preventDefault();

      var name = val('lbs-name');
      var email = val('lbs-email');
      var company = val('lbs-company');
      var location = val('lbs-location');
      var password = document.getElementById('lbs-password')
        ? document.getElementById('lbs-password').value
        : '';
      var password2 = document.getElementById('lbs-password2')
        ? document.getElementById('lbs-password2').value
        : '';
      var termsEl = document.getElementById('lbs-terms');

      if (!name) {
        setStatus('Please enter your full name.', 'error');
        return;
      }
      if (!email) {
        setStatus('Please enter your email.', 'error');
        return;
      }
      if (!company) {
        setStatus('Please enter your company.', 'error');
        return;
      }
      if (!location) {
        setStatus('Please enter your location (city or town).', 'error');
        return;
      }
      if (password !== password2) {
        setStatus('Passwords do not match.', 'error');
        return;
      }
      if (password.length < 10) {
        setStatus('Password must be at least 10 characters.', 'error');
        return;
      }
      if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        setStatus('Password must include at least one letter and one number.', 'error');
        return;
      }
      if (termsEl && !termsEl.checked) {
        setStatus('Please agree to the Terms & conditions and Privacy policy.', 'error');
        return;
      }
      var discoverableEl = document.getElementById('lbs-discoverable');
      var discoverable = Boolean(discoverableEl && discoverableEl.checked);

      if (submitBtn) submitBtn.disabled = true;
      setStatus('Creating your account…');

      getTurnstileToken()
        .then(function (token) {
          var payload = {
            email: email,
            password: password,
            name: name,
            company: company,
            location: location,
            next: JOIN_PATH,
            intent: 'attendee',
            marketingOptIn: false,
            hubertOptIn: true,
            discoverable: discoverable,
            termsAccepted: true,
            utmCampaign: 'tina_lbs',
            utmSource: 'the_business_show_london',
            signupSource: 'tina_lbs',
          };
          if (token) payload.turnstileToken = token;
          return fetch('/api/auth/register', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload),
          });
        })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            setStatus((result.data && result.data.message) || 'Could not create account.', 'error');
            if (submitBtn) submitBtn.disabled = false;
            return;
          }

          // Stay on the stand flow: session is set, record attendance now.
          // Email confirm is deferred (code already emailed when available).
          setStatus('Account created — recording that you attended…', 'ok');
          return markAttended()
            .then(function (data) {
              showSuccess(Boolean(data && data.already));
            })
            .catch(function (err) {
              var code = err && err.code ? String(err.code) : '';
              var msg = err && err.message ? String(err.message) : '';
              if (
                code === 'already_registered' ||
                code === 'already_going' ||
                code === 'exists' ||
                /already/i.test(msg)
              ) {
                showSuccess(true);
                return;
              }
              setStatus(
                (result.data && result.data.message) || humanError(err),
                'warn'
              );
              setAction('<a class="lbs-btn lbs-btn-primary" href="/events/">Browse events</a>');
            });
        })
        .catch(function () {
          setStatus('Could not reach the server. Try again shortly.', 'error');
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  function run() {
    // Form stays visible by default for signed-out show-floor visitors.
    // Only hide it once we know they already have a session.
    setStatus('Checking your account…');
    setAction('');
    bindSignupForm();

    fetchSession()
      .then(function (user) {
        if (!user) {
          showSignedOut();
          return null;
        }

        showForm(false);
        setStatus('Recording that you attended The Business Show London…');
        return markAttended()
          .then(function (data) {
            showSuccess(Boolean(data && data.already));
          })
          .catch(function (err) {
            var code = err && err.code ? String(err.code) : '';
            var msg = err && err.message ? String(err.message) : '';
            if (
              code === 'already_registered' ||
              code === 'already_going' ||
              code === 'exists' ||
              /already/i.test(msg)
            ) {
              showSuccess(true);
              return;
            }
            setStatus(humanError(err), 'warn');
            setAction(
              '<a class="lbs-btn lbs-btn-primary" href="/events/">Browse events</a>' +
                '<a class="lbs-btn lbs-btn-secondary" href="/events/' +
                EVENT_SLUG +
                '">View event</a>'
            );
          });
      })
      .catch(function () {
        showSignedOut();
        setStatus(
          'Something went wrong checking your session. You can still create your free profile below.',
          'warn'
        );
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
