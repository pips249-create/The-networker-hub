/**
 * Simple “add bank details” flow for paid ticket sales (Stripe Connect).
 * Always launches Stripe via a top-level Hub page in a new tab so Stripe is
 * never embedded in the organiser tickets drawer iframe.
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

  function launcherHref(groupId, returnPath) {
    const qs = new URLSearchParams();
    qs.set('groupId', String(groupId || '').trim());
    qs.set(
      'returnPath',
      String(returnPath || '/organiser/index.html#events-revenue').trim() ||
        '/organiser/index.html#events-revenue'
    );
    // Absolute path so this works from both organiser/index.html and event-tickets.html (incl. iframe).
    return '/organiser/payment-setup.html?' + qs.toString();
  }

  function startSetup(groupId, returnPath) {
    const gid = String(groupId || '').trim();
    if (!gid) {
      alert('No organiser profile found.');
      return false;
    }
    const href = launcherHref(gid, returnPath);
    const tab = global.open(href, '_blank', 'noopener,noreferrer');
    if (!tab) {
      // Last resort: leave the drawer and open launcher top-level.
      try {
        if (global.top && global.top !== global.self) {
          global.top.location.href = href;
          return true;
        }
      } catch {
        /* ignore */
      }
      global.location.href = href;
    }
    return true;
  }

  function openStripeOnboarding(url) {
    // Legacy helper — if given a Stripe URL, bounce via launcher is preferred.
    // Keep a top-level open for callers that already have a URL.
    if (!url) return false;
    try {
      if (global.top && global.top !== global.self) {
        global.top.open(url, '_blank', 'noopener,noreferrer');
        return true;
      }
    } catch {
      /* ignore */
    }
    const tab = global.open(url, '_blank', 'noopener,noreferrer');
    if (tab) return true;
    try {
      global.top.location.href = url;
      return true;
    } catch {
      global.location.href = url;
      return true;
    }
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
    const href = launcherHref(group?.id, opts.returnPath);

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
      '<a class="' +
      esc(opts.buttonClass || 'hub-payment-setup-btn org-btn org-btn-primary') +
      '" href="' +
      esc(href) +
      '" target="_blank" rel="noopener noreferrer" data-payment-setup="' +
      esc(group?.id || '') +
      '">Add bank details' +
      (group?.name ? ' for ' + groupName : '') +
      '</a>' +
      '<p class="hub-payment-setup-note">Opens in a new tab — return here when finished. Free events do not need bank details.</p>' +
      '</div></div>'
    );
  }

  function bindCard(root) {
    // Links already open the launcher in a new tab via target="_blank".
    // No click handler required (avoids iframe / popup-blocker issues).
    if (!root) return;
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

  async function openDashboard(groupId) {
    const gid = String(groupId || '').trim();
    if (!gid) {
      alert('No organiser profile found.');
      return false;
    }
    try {
      const res = await fetch(
        '/api/organiser/stripe-connect?groupId=' + encodeURIComponent(gid) + '&action=dashboard',
        { credentials: 'include', cache: 'no-store' }
      );
      const data = await res.json();
      if (!data.ok || !data.url) {
        alert(data.message || data.error || 'Could not open Stripe dashboard.');
        return false;
      }
      return openStripeOnboarding(data.url);
    } catch {
      alert('Could not open Stripe dashboard. Please try again.');
      return false;
    }
  }

  global.HubOrganiserPaymentSetup = {
    fetchState: fetchState,
    groupForEvent: groupForEvent,
    groupNeedsSetup: groupNeedsSetup,
    startSetup: startSetup,
    openDashboard: openDashboard,
    openStripeOnboarding: openStripeOnboarding,
    launcherHref: launcherHref,
    cardHtml: cardHtml,
    bindCard: bindCard,
    renderInto: renderInto,
  };
})(window);
