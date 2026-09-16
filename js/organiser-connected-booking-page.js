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
  var checkoutBanner = document.getElementById('cb-checkout-banner');
  var billingTip = document.getElementById('cb-billing-tip');

  function showCheckoutBanner() {
    var params = new URLSearchParams(location.search);
    var checkout = params.get('checkout');
    if (!checkoutBanner || !checkout) return;
    if (checkout === 'success') {
      checkoutBanner.hidden = false;
      checkoutBanner.textContent =
        'Thank you — your subscription is being activated. Refresh this page in a moment, then generate your webhook secret below.';
    } else if (checkout === 'cancel') {
      checkoutBanner.hidden = false;
      checkoutBanner.classList.remove('ee-alert-ok');
      checkoutBanner.classList.add('ee-alert-warn');
      checkoutBanner.textContent = 'Checkout was cancelled. You can choose a plan again when you are ready.';
    }
  }
  showCheckoutBanner();

  function postBillingAction(action, plan) {
    var body = { action: action };
    if (plan) body.plan = plan;
    return fetch('/api/organiser/connected-booking', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().then(function (data) {
        return { status: r.status, data: data };
      });
    });
  }

  function startCheckout(plan, btn) {
    if (btn) btn.disabled = true;
    postBillingAction('create_checkout', plan)
      .then(function (res) {
        if (res.data && res.data.url) {
          location.href = res.data.url;
          return;
        }
        if (res.status === 401 || res.status === 403) {
          location.href = '/login?next=' + encodeURIComponent('/organiser/connected-booking');
          return;
        }
        var msg =
          (res.data && res.data.error) ||
          'Could not start checkout. Try again or email hi@thenetworkeruk.com.';
        window.alert(msg);
      })
      .catch(function () {
        window.alert('Could not start checkout. Check your connection and try again.');
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function openBillingPortal(btn) {
    if (btn) btn.disabled = true;
    postBillingAction('billing_portal')
      .then(function (res) {
        if (res.data && res.data.url) {
          location.href = res.data.url;
          return;
        }
        window.alert((res.data && res.data.error) || 'Billing portal is not available yet.');
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  document.querySelectorAll('.cb-subscribe-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var plan = btn.getAttribute('data-cb-plan');
      startCheckout(plan, btn);
    });
  });

  var manageBilling = document.getElementById('cb-manage-billing');
  var manageBillingPanel = document.getElementById('cb-manage-billing-panel');
  [manageBilling, manageBillingPanel].forEach(function (el) {
    if (!el) return;
    el.addEventListener('click', function () {
      openBillingPortal(el);
    });
  });

  function applyBillingUi(data) {
    var billing = data.billing || {};
    var canSubscribe = billing.canSubscribe !== false && billing.stripeCheckoutConfigured !== false;
    var signedIn = data.ok === true;

    document.querySelectorAll('.cb-subscribe-btn').forEach(function (btn) {
      var plan = btn.getAttribute('data-cb-plan');
      if (!signedIn) {
        btn.textContent = 'Sign in to subscribe';
        return;
      }
      if (!billing.stripeCheckoutConfigured) {
        btn.disabled = true;
        btn.textContent = 'Checkout unavailable';
        return;
      }
      if (data.active && data.plan === plan) {
        btn.disabled = true;
        btn.textContent = 'Current plan';
      } else if (data.active && !canSubscribe) {
        btn.disabled = true;
        btn.textContent = 'Subscribed';
      } else {
        btn.disabled = false;
        btn.textContent = 'Subscribe';
      }
    });

    document.querySelectorAll('.cb-compare-plan-col[data-cb-plan]').forEach(function (col) {
      col.classList.toggle(
        'cb-compare-plan-col--current',
        signedIn && data.plan === col.getAttribute('data-cb-plan')
      );
    });

    var showPortal = signedIn && billing.canManageBilling;
    if (manageBilling) manageBilling.hidden = !showPortal;
    if (manageBillingPanel) manageBillingPanel.hidden = !showPortal;

    if (billingTip && signedIn) {
      if (!billing.stripeCheckoutConfigured) {
        billingTip.textContent =
          'Online checkout is not configured yet — contact hi@thenetworkeruk.com to subscribe.';
      } else if (data.active) {
        billingTip.textContent =
          'Your plan is active. Use Manage billing to update your card or cancel. Then set up your webhook secret.';
      } else {
        billingTip.textContent = 'Choose a plan above. Payment is handled securely by Stripe (+ 20% VAT).';
      }
    }
  }

  fetch('/api/organiser/connected-booking', { credentials: 'include' })
    .then(function (r) {
      return r.json().then(function (data) {
        return { status: r.status, data: data };
      });
    })
    .then(function (res) {
      if (res.status === 404 || (res.data && res.data.error === 'not_found')) {
        location.replace('/organiser/');
        return;
      }
      var data = res.data || {};
      applyBillingUi(data);
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
          (data.active ? 'Active' : data.status || 'Inactive') +
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
      if (rotateBtn && !rotateBtn.dataset.bound) {
        rotateBtn.dataset.bound = '1';
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
