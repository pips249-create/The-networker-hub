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
  var workspaceConnectedPage = document.getElementById('org-page-connected-booking');
  var checkoutBanner = document.getElementById('cb-checkout-banner');
  var billingTip = document.getElementById('cb-billing-tip');
  var authStatus = document.getElementById('cb-auth-status');
  var hasConnectedUi =
    document.getElementById('cb-sync-log') ||
    adminPanel ||
    document.getElementById('cb-plan-status');

  if (!hasConnectedUi) return;

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
    return '/login?next=' + encodeURIComponent('/organiser/#connected-booking') + '&intent=organiser';
  }

  function friendlyApiError(data) {
    if (!data) return 'Something went wrong. Try again or email hi@thenetworkeruk.com.';
    if (data.message) return data.message;
    if (data.error === 'connected_booking_schema_missing') {
      return (
        data.message ||
        'Database setup incomplete for Connected booking. See hi@thenetworkeruk.com if this persists after running migrations.'
      );
    }
    if (data.error === 'connected_booking_failed') {
      return 'Connected booking request failed. If your plan is already active, run migration 297 for organiser-page slots; otherwise check migrations 292 and 298.';
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

  function activateFreeConnected(btn) {
    if (btn) btn.disabled = true;
    postBillingAction('activate_free')
      .then(function (res) {
        if (res.status === 401) {
          location.href = loginNextUrl();
          return;
        }
        if (!res.data || !res.data.ok) {
          window.alert(friendlyApiError(res.data));
          return;
        }
        setAuthStatus(
          (res.data && res.data.message) ||
            'Connected enabled. Choose a booking system next.',
          'ok'
        );
        return loadConnectedBookingAccount({ silent: true });
      })
      .catch(function () {
        window.alert('Could not enable Connected. Check your connection and try again.');
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  var activateFreeBtn = document.getElementById('cb-activate-free');
  if (activateFreeBtn && !activateFreeBtn.dataset.bound) {
    activateFreeBtn.dataset.bound = '1';
    activateFreeBtn.addEventListener('click', function () {
      activateFreeConnected(activateFreeBtn);
    });
  }

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
    // Pricing permanently removed from organiser Booking system page.
    var pricingCompare = document.getElementById('cb-pricing-compare');
    var pricingSection = document.getElementById('cb-pricing');
    var activateWrap = document.getElementById('cb-activate-wrap');
    var gotoProviders = document.getElementById('cb-goto-providers');
    if (pricingSection) pricingSection.hidden = true;
    if (pricingCompare) pricingCompare.hidden = true;
    if (activateWrap) activateWrap.hidden = true;
    if (gotoProviders) gotoProviders.hidden = true;
    document.querySelectorAll('.cb-subscribe-btn').forEach(function (btn) {
      btn.disabled = true;
      btn.hidden = true;
    });
    if (manageBilling) manageBilling.hidden = true;
    if (manageBillingPanel) manageBillingPanel.hidden = true;
    if (billingTip) billingTip.hidden = true;
    void data;
    void applyPricingLabels;
  }

  function setConnectedNavVisible(show) {
    ['org-nav-connected-booking', 'org-more-connected-booking'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = !show;
    });
    try {
      window.dispatchEvent(
        new CustomEvent('hub-organiser-connected-nav', { detail: { visible: Boolean(show) } })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function showComingSoonPanel(show) {
    var panel = document.getElementById('cb-coming-soon-panel');
    if (panel) panel.hidden = !show;
  }

  function applyComingSoonMode() {
    var linkOutPanel = document.getElementById('cb-link-out-panel');
    var connectedOnly = document.getElementById('cb-connected-only');
    var gotoPricing = document.getElementById('cb-goto-pricing');
    var titleEl = document.getElementById('cb-page-title');
    var leadEl = document.getElementById('cb-page-lead');
    setConnectedNavVisible(true);
    showComingSoonPanel(true);
    if (linkOutPanel) linkOutPanel.hidden = true;
    if (connectedOnly) connectedOnly.hidden = false;
    if (gotoPricing) {
      gotoPricing.hidden = true;
      gotoPricing.setAttribute('aria-hidden', 'true');
    }
    if (titleEl) titleEl.textContent = 'Booking system';
    if (leadEl) {
      leadEl.textContent =
        'Choose where people book — sell on The Networker UK, or connect Eventbrite / your website below.';
    }
    if (adminPanel) adminPanel.hidden = true;
    var providersPanel = document.getElementById('cb-providers-panel');
    if (providersPanel) providersPanel.hidden = false;
    return 'coming_soon';
  }

  function applyWorkspaceMode(data) {
    var linkOutPanel = document.getElementById('cb-link-out-panel');
    var connectedOnly = document.getElementById('cb-connected-only');
    var gotoPricing = document.getElementById('cb-goto-pricing');
    var titleEl = document.getElementById('cb-page-title');
    var leadEl = document.getElementById('cb-page-lead');
    var mode = String((data && data.uiMode) || '').trim();
    if (!mode) {
      if (data && data.linkOutGranted && !data.active) mode = 'link_out';
      else if (data && data.ok) mode = 'connected';
      else mode = 'coming_soon';
    }

    if (mode === 'link_out') {
      setConnectedNavVisible(true);
      showComingSoonPanel(false);
      if (titleEl) titleEl.textContent = 'Link Out';
      if (leadEl) {
        leadEl.innerHTML =
          'Your listings send buyers to <strong>your website</strong>. Redirect only — no attendee sync.';
      }
      if (linkOutPanel) linkOutPanel.hidden = false;
      if (connectedOnly) connectedOnly.hidden = false;
      if (gotoPricing) gotoPricing.hidden = true;
      return mode;
    }

    if (mode === 'connected' && data && data.ok) {
      setConnectedNavVisible(true);
      showComingSoonPanel(false);
      if (titleEl) titleEl.textContent = 'Booking system';
      if (leadEl) {
        leadEl.textContent =
          'Choose where people book — sell on The Networker UK, or connect Eventbrite / your website below.';
      }
      if (linkOutPanel) linkOutPanel.hidden = true;
      if (connectedOnly) connectedOnly.hidden = false;
      if (gotoPricing) {
        gotoPricing.hidden = true;
        gotoPricing.setAttribute('aria-hidden', 'true');
      }
      return mode;
    }

    return applyComingSoonMode();
  }

  function handleConnectedApi(res) {
    var data = res.data || {};

    if (res.status === 503 && data.error === 'connected_booking_schema_missing') {
      setAuthStatus(data.message || 'Database migration required (292).', 'error');
      applyComingSoonMode();
      applyBillingUi({ ok: false });
      return;
    }

    if (res.status === 403 && data.error === 'preview_restricted') {
      applyComingSoonMode();
      setAuthStatus('');
      applyBillingUi({ ok: false });
      return;
    }

    if (res.status === 401) {
      applyComingSoonMode();
      setAuthStatus('Session expired — sign in again to subscribe or manage your webhook.', 'error');
      if (signinHint) signinHint.hidden = false;
      applyBillingUi({ ok: false });
      return;
    }

    if (!data.ok && data.error === 'organiser_account_not_found') {
      applyComingSoonMode();
      setAuthStatus(
        data.message ||
          'No organiser account for this login. Open My Events first, then return here.',
        'error'
      );
      applyBillingUi({ ok: false });
      return;
    }

    if (!data.ok) {
      applyComingSoonMode();
      setAuthStatus(friendlyApiError(data), 'error');
      applyBillingUi({ ok: false });
      return;
    }

    var mode = applyWorkspaceMode(data);
    if (mode === 'coming_soon' || mode === 'hidden') {
      setAuthStatus('');
      applyBillingUi({ ok: false });
      return;
    }
    if (mode === 'link_out') {
      setAuthStatus('Link Out is active on this account — set the booking URL on each event.', 'ok');
      applyBillingUi({ ok: false });
      if (signinHint) signinHint.hidden = true;
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
    var providersPanel = document.getElementById('cb-providers-panel');
    if (providersPanel && workspaceConnectedPage) providersPanel.hidden = false;

    if (data.setup && data.setup.nextStep && !data.setup.readyForConnectedEvents) {
      setAuthStatus('Next: ' + data.setup.nextStep, data.schemaWarning ? 'error' : 'ok');
    }

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

  function loadConnectedBookingAccount(options) {
    var opts = options || {};
    return fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
      .then(function (r) {
        return r.json();
      })
      .then(function (sessionData) {
        if (!sessionData || !sessionData.ok || !sessionData.user) {
          applyComingSoonMode();
          if (!opts.silent) {
            setAuthStatus('');
            if (signinHint) signinHint.hidden = false;
          }
          applyBillingUi({ ok: false });
          return;
        }

        if (!opts.silent) setAuthStatus('Loading your Connected booking account…');

        return fetch('/api/organiser/connected-booking', { credentials: 'include', cache: 'no-store' })
          .then(function (r) {
            return r.json().then(function (data) {
              return { status: r.status, data: data };
            });
          })
          .then(function (res) {
            handleConnectedApi(res);
            if (opts.silent) setAuthStatus('');
          });
      })
      .catch(function () {
        applyComingSoonMode();
        if (!opts.silent) {
          setAuthStatus('Could not verify your session. Refresh the page or sign in again.', 'error');
          if (signinHint) signinHint.hidden = false;
        }
      });
  }

  window.refreshOrganiserConnectedBooking = loadConnectedBookingAccount;

  var gotoPricing = document.getElementById('cb-goto-pricing');
  if (gotoPricing && !gotoPricing.dataset.bound) {
    gotoPricing.dataset.bound = '1';
    gotoPricing.addEventListener('click', function () {
      var el = document.getElementById('cb-pricing');
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  try {
    var scrollTarget = sessionStorage.getItem('cb_workspace_scroll');
    if (scrollTarget) {
      sessionStorage.removeItem('cb_workspace_scroll');
      requestAnimationFrame(function () {
        var el = document.getElementById(scrollTarget);
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  } catch (eScroll) {
    /* ignore */
  }

  loadConnectedBookingAccount();
})();
