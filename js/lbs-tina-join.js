/**
 * London Business Show stand join: free account for TINA + mark the show as attended
 * (stand check-in — not a ticket purchase).
 */
(function () {
  'use strict';

  var EVENT_SLUG = 'the-business-show-london';
  var JOIN_PATH =
    '/lbs-tina-join?utm_source=the_business_show_london&utm_medium=leaflet&utm_campaign=tina_lbs';

  var statusEl = document.getElementById('lbs-join-status');
  var actionEl = document.getElementById('lbs-join-action');

  function setStatus(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.dataset.kind = kind || '';
  }

  function setAction(html) {
    if (!actionEl) return;
    actionEl.innerHTML = html || '';
  }

  function registerHref() {
    return (
      '/register?intent=attendee&utm_source=the_business_show_london&utm_medium=leaflet&utm_campaign=tina_lbs&next=' +
      encodeURIComponent(JOIN_PATH)
    );
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
    setStatus(
      'Create your free Networker UK profile for TINA. We’ll also record that you visited The Business Show London.'
    );
    setAction(
      '<a class="lbs-btn lbs-btn-primary" href="' +
        registerHref() +
        '">Create free profile</a>' +
        '<a class="lbs-btn lbs-btn-secondary" href="/login?next=' +
        encodeURIComponent(JOIN_PATH) +
        '">Sign in</a>'
    );
  }

  function showSuccess(already) {
    setStatus(
      already
        ? 'You’re already recorded for The Business Show London. Next, finish your TINA profile.'
        : 'You’re in — The Business Show London is recorded on your account as attended. Next, finish your TINA profile.',
      'ok'
    );
    setAction(
      '<a class="lbs-btn lbs-btn-primary" href="/account/#meet">Open TINA profile</a>' +
        '<a class="lbs-btn lbs-btn-secondary" href="/account/#tickets">View my tickets</a>'
    );
  }

  function humanError(err) {
    var code = err && err.code ? String(err.code) : '';
    var msg = err && err.message ? String(err.message) : '';
    if (code === 'already_going' || code === 'already_registered' || /already/i.test(msg)) {
      return 'You’re already marked as having attended The Business Show London.';
    }
    if (code === 'no_free_ticket') {
      return 'Show check-in isn’t open on this listing yet. You can still finish your TINA profile.';
    }
    if (code === 'event_not_found') {
      return 'We couldn’t find the show listing. You can still create your free profile for TINA.';
    }
    return 'We couldn’t record attendance automatically. Create or open your profile — you can add the show from Events I’ve attended later.';
  }

  function run() {
    setStatus('Checking your account…');
    setAction('');

    fetchSession()
      .then(function (user) {
        if (!user) {
          showSignedOut();
          return null;
        }

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
              '<a class="lbs-btn lbs-btn-primary" href="/account/#meet">Open TINA profile</a>' +
                '<a class="lbs-btn lbs-btn-secondary" href="/events/' +
                EVENT_SLUG +
                '">View event</a>'
            );
          });
      })
      .catch(function () {
        setStatus(
          'Something went wrong checking your session. You can still create your free profile for TINA.',
          'warn'
        );
        setAction(
          '<a class="lbs-btn lbs-btn-primary" href="' +
            registerHref() +
            '">Create free profile</a>' +
            '<a class="lbs-btn lbs-btn-secondary" href="/events/' +
            EVENT_SLUG +
            '">View event</a>'
        );
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
