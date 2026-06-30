/**
 * Simple “add bank details” flow for paid ticket sales (Stripe Connect).
 */
(function (global) {
  function esc(value) {
    const d = document.createElement('div');
    d.textContent = value == null ? '' : String(value);
    return d.innerHTML;
  }

  async function fetchState() {
    try {
      const res = await fetch('/api/organiser/bootstrap', { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      if (!data.ok) {
        return {
          enabled: false,
          groups: [],
          pendingGroups: [],
          needsSetup: false,
          primaryGroup: null,
        };
      }
      const enabled = Boolean(data.stripeConnectEnabled);
      const groups = Array.isArray(data.groups) ? data.groups : [];
      const pendingGroups = groups.filter(function (g) {
        return enabled && !g.stripeConnectReady;
      });
      return {
        enabled: enabled,
        groups: groups,
        pendingGroups: pendingGroups,
        needsSetup: enabled && pendingGroups.length > 0,
        primaryGroup: pendingGroups[0] || groups[0] || null,
      };
    } catch {
      return {
        enabled: false,
        groups: [],
        pendingGroups: [],
        needsSetup: false,
        primaryGroup: null,
      };
    }
  }

  function groupForEvent(state, groupId) {
    if (!state || !groupId) return state?.primaryGroup || null;
    return (
      (state.groups || []).find(function (g) {
        return String(g.id) === String(groupId);
      }) ||
      state.primaryGroup ||
      null
    );
  }

  function groupNeedsSetup(state, group) {
    if (!state?.enabled || !group) return false;
    return !group.stripeConnectReady;
  }

  function appendStripeReturnFlag(path) {
    const base = String(path || global.location.pathname + global.location.search + global.location.hash);
    if (base.includes('stripe_connect=')) return base;
    return base + (base.includes('?') ? '&' : '?') + 'stripe_connect=return';
  }

  async function startSetup(groupId, returnPath) {
    const gid = String(groupId || '').trim();
    if (!gid) {
      alert('No organiser profile found.');
      return false;
    }
    const res = await fetch('/api/organiser/stripe-connect', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: gid,
        returnPath: appendStripeReturnFlag(
          returnPath || global.location.pathname + global.location.search + global.location.hash
        ),
      }),
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (!res.ok || !data.url) {
      alert(data.message || data.error || 'Could not start bank details setup. Try again in a moment.');
      return false;
    }
    global.location.href = data.url;
    return true;
  }

  function cardHtml(group, options) {
    const opts = options || {};
    const compact = Boolean(opts.compact);
    const groupName = group?.name ? esc(group.name) : 'your group';
    const title = opts.title || 'Add bank details to sell paid tickets';
    const lead =
      opts.lead ||
      'You receive the full ticket price. Stripe collects your UK bank details securely — we never see them.';
    const steps = compact
      ? ''
      : '<ol class="hub-payment-setup-steps">' +
        '<li><strong>Add bank details</strong> — about 5 minutes on Stripe</li>' +
        '<li><strong>Return here</strong> and publish your paid tickets</li>' +
        '</ol>';

    return (
      '<div class="hub-payment-setup-card' +
      (compact ? ' hub-payment-setup-card--compact' : '') +
      '" role="status">' +
      '<div class="hub-payment-setup-icon" aria-hidden="true">🏦</div>' +
      '<div class="hub-payment-setup-body">' +
      '<h2 class="hub-payment-setup-title">' +
      esc(title) +
      '</h2>' +
      '<p class="hub-payment-setup-lead">' +
      esc(lead) +
      '</p>' +
      steps +
      '<button type="button" class="' +
      esc(opts.buttonClass || 'hub-payment-setup-btn org-btn org-btn-primary') +
      '" data-payment-setup="' +
      esc(group?.id || '') +
      '">Add bank details' +
      (group?.name ? ' for ' + groupName : '') +
      '</button>' +
      '<p class="hub-payment-setup-note">Free events do not need bank details.</p>' +
      '</div></div>'
    );
  }

  function bindCard(root, returnPath) {
    if (!root) return;
    root.querySelectorAll('[data-payment-setup]').forEach(function (btn) {
      if (btn.dataset.paymentSetupBound === '1') return;
      btn.dataset.paymentSetupBound = '1';
      btn.addEventListener('click', function () {
        startSetup(btn.getAttribute('data-payment-setup'), returnPath);
      });
    });
  }

  function renderInto(container, state, group, options) {
    if (!container) return false;
    if (!state?.enabled || !groupNeedsSetup(state, group)) {
      container.hidden = true;
      container.innerHTML = '';
      return false;
    }
    container.hidden = false;
    container.innerHTML = cardHtml(group, options);
    bindCard(container, options?.returnPath);
    return true;
  }

  global.HubOrganiserPaymentSetup = {
    fetchState: fetchState,
    groupForEvent: groupForEvent,
    groupNeedsSetup: groupNeedsSetup,
    startSetup: startSetup,
    cardHtml: cardHtml,
    bindCard: bindCard,
    renderInto: renderInto,
  };
})(window);
