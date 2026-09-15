(function () {
  var site = location.origin.replace(/\/$/, '');
  var webhookUrl = site + '/api/integrations/booking';

  var urlDisplay = document.getElementById('cb-webhook-url-display');
  if (urlDisplay) {
    urlDisplay.textContent = webhookUrl;
  }

  var sample = {
    eventId: 'YOUR_EVENT_UUID',
    orderId: 'ORDER-12345',
    email: 'buyer@example.com',
    name: 'Alex Smith',
    quantity: 1,
    amountPaid: 15,
    status: 'confirmed',
  };
  var pre = document.getElementById('cb-sample');
  if (pre) {
    pre.textContent = JSON.stringify(sample, null, 2);
  }

  var signinHint = document.getElementById('cb-signin-hint');
  var adminPanel = document.getElementById('cb-admin-panel');

  fetch('/api/organiser/connected-booking', { credentials: 'include' })
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      if (!data.ok) return;
      if (signinHint) signinHint.hidden = true;
      if (adminPanel) adminPanel.hidden = false;

      var statusEl = document.getElementById('cb-plan-status');
      if (statusEl) {
        var planLabel = data.plan ? String(data.plan) : 'none';
        statusEl.textContent =
          'Plan: ' +
          planLabel +
          ' — ' +
          (data.active ? 'Active' : 'Inactive') +
          (data.groupLimit != null
            ? ' · Groups: ' + data.groupCount + ' / ' + data.groupLimit
            : data.plan === 'enterprise'
              ? ' · Groups: unlimited'
              : '');
      }

      var accountWrap = document.getElementById('cb-account-id-wrap');
      var accountEl = document.getElementById('cb-account-id');
      if (data.accountId && accountEl && accountWrap) {
        accountEl.textContent = data.accountId;
        accountWrap.hidden = false;
      }

      var log = document.getElementById('cb-sync-log');
      if (log) {
        log.innerHTML = '';
        var rows = data.recentSync || [];
        if (!rows.length) {
          var empty = document.createElement('li');
          empty.className = 'cb-sync-empty';
          empty.textContent = 'No sync attempts yet.';
          log.appendChild(empty);
        } else {
          rows.forEach(function (row) {
            var li = document.createElement('li');
            li.textContent =
              (row.created_at || '').replace('T', ' ').slice(0, 19) +
              ' — ' +
              row.outcome +
              (row.message ? ' — ' + row.message : '');
            log.appendChild(li);
          });
        }
      }

      var rotateBtn = document.getElementById('cb-rotate-secret');
      if (rotateBtn) {
        rotateBtn.addEventListener('click', function () {
          rotateBtn.disabled = true;
          fetch('/api/organiser/connected-booking', {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'rotate_webhook_secret' }),
          })
            .then(function (r) {
              return r.json();
            })
            .then(function (res) {
              if (res.webhookSecret) {
                var el = document.getElementById('cb-secret-reveal');
                if (el) {
                  el.hidden = false;
                  el.textContent =
                    'Copy this secret now — we cannot show it again: ' + res.webhookSecret;
                }
              }
            })
            .finally(function () {
              rotateBtn.disabled = false;
            });
        });
      }
    })
    .catch(function () {
      /* signed out — sign-in section stays visible */
    });
})();
