(function () {
  var embed = window.HubOrganiserEmbedBootstrap || {};

  function initEmbedDrawerNav() {
    if (typeof embed.applyEmbedDrawerBodyClass === 'function') {
      embed.applyEmbedDrawerBodyClass();
    }
    var isEmbed =
      typeof embed.isEmbedDrawer === 'function' ? embed.isEmbedDrawer() : false;
    if (!isEmbed) return;
    var backBtn = document.getElementById('cb-embed-back-tickets');
    var ids =
      typeof embed.eventIdsFromSearch === 'function' ? embed.eventIdsFromSearch() : [];
    if (backBtn && ids.length) {
      backBtn.hidden = false;
      backBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (
          typeof embed.notifyParent === 'function' &&
          embed.notifyParent('hub-event-goto-tickets', {
            eventIds: ids,
            title: '',
          })
        ) {
          return;
        }
        location.href =
          '/organiser/event-tickets?ids=' +
          encodeURIComponent(ids.join(',')) +
          '&embed=1';
      });
    }
  }

  initEmbedDrawerNav();

  if (location.hash === '#cb-slots-panel') {
    location.replace('/organiser/#groups');
  }

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
  var authStatus = document.getElementById('cb-auth-status');

  if (signinHint) signinHint.hidden = true;

  function setAuthStatus(msg, kind) {
    if (!authStatus) return;
    authStatus.hidden = !msg;
    authStatus.textContent = msg || '';
    authStatus.className =
      'ee-hint cb-auth-status' +
      (kind === 'error' ? ' ee-alert-warn' : kind === 'ok' ? ' ee-alert-ok' : '');
  }

  function loginNextUrl() {
    return '/login?next=' + encodeURIComponent('/organiser/connected-booking') + '&intent=organiser';
  }

  function friendlyApiError(data) {
    if (!data) return 'Something went wrong. Try again or email hi@thenetworkeruk.com.';
    if (data.message) return data.message;
    if (data.error === 'connected_booking_failed') {
      return 'Connected could not load (server error). Check Supabase migrations 292 and 298, then redeploy.';
    }
    if (data.error === 'stripe_checkout_failed' || data.error === 'stripe_not_configured') {
      return data.message || 'Checkout is temporarily unavailable. Email hi@thenetworkeruk.com.';
    }
    if (data.error) return String(data.error);
    return 'Something went wrong. Try again or email hi@thenetworkeruk.com.';
  }

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

  var devDetails = document.getElementById('cb-webhook-docs');
  function openDeveloperDocs() {
    if (devDetails) devDetails.open = true;
  }
  if (devDetails) {
    devDetails.addEventListener('toggle', function () {
      devDetails.classList.toggle('is-open', devDetails.open);
    });
    if (location.hash === '#cb-webhook-docs') openDeveloperDocs();
    window.addEventListener('hashchange', function () {
      if (location.hash === '#cb-webhook-docs') openDeveloperDocs();
    });
  }

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
        if (res.status === 401) {
          location.href = loginNextUrl();
          return;
        }
        if (res.status === 403 && res.data && res.data.error === 'preview_restricted') {
          window.alert(res.data.message || 'This account cannot subscribe yet.');
          return;
        }
        window.alert(friendlyApiError(res.data));
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
        window.alert(friendlyApiError(res.data));
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

  function applyPricingLabels(pricing) {
    if (!pricing) return;
    Object.keys(pricing).forEach(function (planKey) {
      var row = pricing[planKey];
      if (!row || row.monthlyExVat == null) return;
      var card = document.querySelector('.cb-plan-card[data-cb-plan="' + planKey + '"]');
      if (!card) return;
      var amountEl = card.querySelector('.cb-plan-card-amount');
      if (amountEl) amountEl.textContent = '£' + row.monthlyExVat;
    });
  }

  function applyBillingUi(data) {
    var billing = data.billing || {};
    var canSubscribe = billing.canSubscribe !== false && billing.stripeCheckoutConfigured !== false;
    var signedIn = data.ok === true;

    applyPricingLabels(data.pricing);

    document.querySelectorAll('.cb-subscribe-btn').forEach(function (btn) {
      var plan = btn.getAttribute('data-cb-plan');
      if (!signedIn) {
        btn.disabled = false;
        btn.textContent = 'Subscribe';
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

    document.querySelectorAll('.cb-plan-card[data-cb-plan]').forEach(function (card) {
      card.classList.toggle(
        'cb-plan-card--current',
        signedIn && data.plan === card.getAttribute('data-cb-plan')
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
          'Your plan is active. Use Manage billing to update your card or cancel. Assign organiser pages in your workspace, then set up your webhook secret below.';
      } else {
        billingTip.textContent = 'Choose a plan above. Payment is handled securely by Stripe (+ 20% VAT).';
      }
    }
  }

  function handleConnectedApi(res) {
    var data = res.data || {};

    if (res.status === 503 && data.error === 'connected_booking_schema_missing') {
      setAuthStatus(data.message || 'Database migration required (292).', 'error');
      applyBillingUi({ ok: false });
      return;
    }

    if (res.status === 403 && data.error === 'preview_restricted') {
      setAuthStatus(
        (data.message || 'Preview access only.') +
          (data.signedInAs ? ' Signed in as ' + data.signedInAs + '.' : ''),
        'error'
      );
      applyBillingUi({ ok: false });
      return;
    }

    if (res.status === 401) {
      setAuthStatus('Session expired — sign in again to subscribe or manage your webhook.', 'error');
      if (signinHint) signinHint.hidden = false;
      applyBillingUi({ ok: false });
      return;
    }

    if (!data.ok && data.error === 'organiser_account_not_found') {
      setAuthStatus(
        data.message ||
          'No organiser account for this login. Open My Events first, then return here.',
        'error'
      );
      applyBillingUi({ ok: false });
      return;
    }

    if (!data.ok) {
      setAuthStatus(friendlyApiError(data), 'error');
      applyBillingUi({ ok: false });
      return;
    }

    if (data.schemaWarning) {
      setAuthStatus(data.schemaWarning, 'error');
    } else if (data.pilotGrant && data.pilotGrant.message) {
      setAuthStatus(data.pilotGrant.message, 'ok');
    } else {
      setAuthStatus('');
    }
    applyBillingUi(data);
    if (signinHint) signinHint.hidden = true;
    if (adminPanel) adminPanel.hidden = false;

    var workspaceHint = document.getElementById('cb-slots-workspace-hint');
    if (workspaceHint) {
      var slots = data.slots || {};
      workspaceHint.hidden = !(
        data.active &&
        slots.needsAssignment &&
        !slots.schemaMissing
      );
    }

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
  }

  fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
    .then(function (r) {
      return r.json();
    })
    .then(function (sessionData) {
      if (!sessionData || !sessionData.ok || !sessionData.user) {
        setAuthStatus('Sign in with your organiser account to subscribe and manage webhooks.', 'error');
        if (signinHint) signinHint.hidden = false;
        applyBillingUi({ ok: false });
        return;
      }

      setAuthStatus('Loading your Connected booking account…');

      return fetch('/api/organiser/connected-booking', { credentials: 'include', cache: 'no-store' })
        .then(function (r) {
          return r.json().then(function (data) {
            return { status: r.status, data: data };
          });
        })
        .then(function (res) {
          handleConnectedApi(res);
        });
    })
    .catch(function () {
      setAuthStatus('Could not verify your session. Refresh the page or sign in again.', 'error');
      if (signinHint) signinHint.hidden = false;
    });
})();
