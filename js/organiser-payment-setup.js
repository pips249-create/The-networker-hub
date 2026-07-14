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
      String(returnPath || '/organiser/#events-revenue').trim() ||
        '/organiser/#events-revenue'
    );
    // Absolute path so this works from both organiser/index.html and event-tickets.html (incl. iframe).
    return '/organiser/payment-setup?' + qs.toString();
  }

  function startSetup(groupId, returnPath) {
    const gid = String(groupId || '').trim();
    if (!gid) {
      alert('No organiser profile found.');
      return false;
    }
    const href = launcherHref(gid, returnPath);
    // Always keep the dashboard/tickets page — never navigate this tab to Stripe.
    // Do not use windowFeatures "noopener" here: Chrome returns null even when the
    // tab opens, which used to trigger a same-tab fallback and leave the workspace.
    if (openUrlInNewTab(href)) return true;
    alert(
      'Your browser blocked the new tab. Allow pop-ups for this site, then click Add bank details again.'
    );
    return false;
  }

  function openUrlInNewTab(url, existingTab) {
    if (!url) return false;
    if (existingTab) {
      try {
        existingTab.location.href = url;
        existingTab.focus();
        return true;
      } catch {
        /* fall through */
      }
    }
    // Prefer a real <a target="_blank"> click: reliable with user gestures, and
    // avoids Chrome returning null from window.open(..., "noopener") even when
    // a tab did open (which led to double opens or same-tab fallbacks).
    try {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      return true;
    } catch {
      /* fall through */
    }
    try {
      const tab = global.open(url, '_blank');
      if (tab) {
        try {
          tab.opener = null;
        } catch {
          /* ignore */
        }
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  function openStripeOnboarding(url) {
    // Legacy helper — prefer launcherHref/startSetup for new flows.
    if (!url) return false;
    try {
      if (global.top && global.top !== global.self && global.top.HubOrganiserPaymentSetup) {
        return global.top.HubOrganiserPaymentSetup.openUrlInNewTab(url);
      }
    } catch {
      /* ignore */
    }
    return openUrlInNewTab(url);
  }

  function multiProfileNoteHtml(state, options) {
    const opts = options || {};
    const total = (state?.groups || []).length;
    if (total < 2) return '';
    const ready = (state?.groups || []).filter(function (g) {
      return g.stripeConnectReady;
    });
    if (ready.length) {
      const sourceName = ready[0]?.name ? esc(ready[0].name) : 'your connected page';
      const reuseHint = opts.showReuseButton
        ? 'If they all pay into the same bank account, click <strong>Use same bank details</strong> above instead of repeating Stripe for every page. '
        : 'If they all pay into the same bank account, use <strong>Use same bank details</strong> instead of repeating Stripe for every page. ';
      return (
        '<p class="hub-payment-setup-note hub-payment-setup-note--info">' +
        '<strong>More than one organiser page?</strong> Each page needs payment setup before paid tickets can go live. ' +
        reuseHint +
        'Already connected on <strong>' +
        sourceName +
        '</strong>.' +
        '</p>'
      );
    }
    return (
      '<p class="hub-payment-setup-note hub-payment-setup-note--info">' +
      '<strong>More than one organiser page?</strong> Each page needs its own Stripe setup so payouts go to the right place. ' +
      'If every event should pay into the same bank account, you can list them under one organiser page instead of creating several.' +
      '</p>'
    );
  }

  function readySourceGroup(state) {
    return (
      (state?.groups || []).find(function (g) {
        return g.stripeConnectReady;
      }) || null
    );
  }

  function reuseBankDetailsButtonHtml(group, sourceGroup, buttonClass) {
    if (!sourceGroup || !group || String(sourceGroup.id) === String(group.id)) return '';
    return (
      '<button type="button" class="' +
      esc(buttonClass || 'hub-payment-setup-btn org-btn org-btn-secondary') +
      '" data-payment-link="' +
      esc(group.id || '') +
      '" data-payment-link-source="' +
      esc(sourceGroup.id) +
      '">Use same bank details</button>'
    );
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
    const sourceGroup = readySourceGroup(opts.state);
    const primaryBtnClass = opts.buttonClass || 'hub-payment-setup-btn org-btn org-btn-primary';
    const reuseBtn = reuseBankDetailsButtonHtml(
      group,
      sourceGroup,
      'hub-payment-setup-btn org-btn org-btn-secondary' + (compact ? ' org-btn-sm' : '')
    );
    const showReuseButton = Boolean(reuseBtn);

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
      '<div class="hub-payment-setup-actions">' +
      reuseBtn +
      '<a class="' +
      esc(primaryBtnClass) +
      '" href="' +
      esc(href) +
      '" target="_blank" rel="noopener noreferrer" data-payment-setup="' +
      esc(group?.id || '') +
      '">Add bank details' +
      (group?.name ? ' for ' + groupName : '') +
      '</a>' +
      '</div>' +
      '<p class="hub-payment-setup-note">Opens in a new tab — return here when finished. Free events do not need bank details.</p>' +
      multiProfileNoteHtml(opts.state, { showReuseButton: showReuseButton }) +
      '</div></div>'
    );
  }

  function checklistHtml(state, options) {
    const opts = options || {};
    const pending = state?.pendingGroups || [];
    const compact = Boolean(opts.compact);
    const title = opts.title || 'Add bank details to sell paid tickets';
    const lead =
      opts.lead ||
      pending.length +
        ' organiser page' +
        (pending.length === 1 ? '' : 's') +
        ' still need payment setup before you can sell paid tickets.';
    const buttonClass = opts.buttonClass || 'hub-payment-setup-btn org-btn org-btn-primary org-btn-sm';
    const sourceGroup = readySourceGroup(state);

    const items = pending
      .map(function (group) {
        const name = group?.name ? esc(group.name) : 'Untitled page';
        const href = launcherHref(group?.id, opts.returnPath);
        const linkBtn = reuseBankDetailsButtonHtml(
          group,
          sourceGroup,
          'hub-payment-setup-btn org-btn org-btn-secondary org-btn-sm'
        );
        return (
          '<li class="hub-payment-setup-checklist-item">' +
          '<span class="hub-payment-setup-checklist-name">' +
          name +
          '</span>' +
          '<div class="hub-payment-setup-checklist-actions">' +
          linkBtn +
          '<a class="' +
          esc(buttonClass) +
          '" href="' +
          esc(href) +
          '" target="_blank" rel="noopener noreferrer" data-payment-setup="' +
          esc(group?.id || '') +
          '">Add bank details</a>' +
          '</div>' +
          '</li>'
        );
      })
      .join('');

    const showReuseButton = Boolean(sourceGroup);

    return (
      '<div class="hub-payment-setup-card hub-payment-setup-card--checklist' +
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
      '<ul class="hub-payment-setup-checklist">' +
      items +
      '</ul>' +
      '<p class="hub-payment-setup-note">Opens Stripe in a new tab — return here when finished. Free events do not need bank details.</p>' +
      multiProfileNoteHtml(state, { showReuseButton: showReuseButton }) +
      '</div></div>'
    );
  }

  function bindCard(root, options) {
    if (!root || root.dataset.paymentBound === '1') return;
    root.dataset.paymentBound = '1';
    const opts = options || {};
    root.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-payment-link]');
      if (!btn || !root.contains(btn)) return;
      e.preventDefault();
      const groupId = btn.getAttribute('data-payment-link');
      const sourceGroupId = btn.getAttribute('data-payment-link-source');
      linkSetup(groupId, sourceGroupId, opts);
    });
  }

  async function linkSetup(groupId, sourceGroupId, options) {
    const opts = options || {};
    const gid = String(groupId || '').trim();
    const sourceId = String(sourceGroupId || '').trim();
    if (!gid || !sourceId) {
      alert('Could not link bank details.');
      return false;
    }
    const btn = document.querySelector('[data-payment-link="' + gid + '"]');
    if (btn) {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
    }
    try {
      const res = await fetch('/api/organiser/stripe-connect', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link',
          groupId: gid,
          sourceGroupId: sourceId,
        }),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || !data.ok) {
        alert(data.message || data.error || 'Could not reuse bank details.');
        return false;
      }
      global.dispatchEvent(
        new CustomEvent('hub-payment-setup-linked', {
          detail: { groupId: gid, sourceGroupId: sourceId },
        })
      );
      if (typeof opts.onLinked === 'function') {
        await opts.onLinked(data);
      }
      return true;
    } catch {
      alert('Could not reuse bank details. Please try again.');
      return false;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      }
    }
  }

  function renderInto(container, state, group, options) {
    if (!container) return false;
    const opts = options || {};
    const pending = state?.pendingGroups || [];
    const targetGroup = group || state?.primaryGroup || null;
    const needsAnySetup = Boolean(state?.enabled && pending.length);
    const needsTargetSetup = groupNeedsSetup(state, targetGroup);
    const forceShow = Boolean(
      opts.showWhenNotReady && state?.enabled && pending.length && !opts.singleGroupOnly
    );

    if (!needsAnySetup && !forceShow) {
      container.hidden = true;
      container.innerHTML = '';
      return false;
    }

    // Event tickets: show setup for the event's organiser page only.
    if (opts.singleGroupOnly && !needsTargetSetup) {
      container.hidden = true;
      container.innerHTML = '';
      return false;
    }

    container.hidden = false;
    const renderOpts = { ...opts, state: state };
    if (!opts.singleGroupOnly && pending.length > 1) {
      container.innerHTML = checklistHtml(state, renderOpts);
    } else {
      container.innerHTML = cardHtml(targetGroup, renderOpts);
    }
    bindCard(container, { ...opts, onLinked: opts.onLinked });
    return true;
  }

  async function openDashboard(groupId, options) {
    const opts = options || {};
    const gid = String(groupId || '').trim();
    if (!gid) {
      if (typeof opts.onNeedsSetup === 'function') {
        opts.onNeedsSetup('Add bank details before opening the Stripe dashboard.');
      } else {
        global.dispatchEvent(
          new CustomEvent('hub-payment-setup-needed', {
            detail: { message: 'Add bank details before opening the Stripe dashboard.' },
          })
        );
      }
      return false;
    }

    let tab = opts.tab || null;
    if (!tab) {
      try {
        // Do not pass "noopener" in windowFeatures — Chrome may return null.
        tab = global.open('about:blank', '_blank');
        if (tab) {
          try {
            tab.opener = null;
          } catch {
            /* ignore */
          }
        }
      } catch {
        tab = null;
      }
    }

    try {
      const res = await fetch(
        '/api/organiser/stripe-connect?groupId=' + encodeURIComponent(gid) + '&action=dashboard',
        { credentials: 'include', cache: 'no-store' }
      );
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || !data.ok || !data.url) {
        if (tab) {
          try {
            tab.close();
          } catch {
            /* ignore */
          }
        }
        const needsSetup =
          data.error === 'stripe_connect_required' ||
          /bank details/i.test(String(data.message || ''));
        if (needsSetup) {
          if (typeof opts.onNeedsSetup === 'function') {
            opts.onNeedsSetup(data.message || 'Add bank details before opening the Stripe dashboard.');
          } else {
            global.dispatchEvent(
              new CustomEvent('hub-payment-setup-needed', {
                detail: {
                  message: data.message || 'Add bank details before opening the Stripe dashboard.',
                  groupId: gid,
                },
              })
            );
          }
        } else {
          alert(data.message || data.error || 'Could not open Stripe dashboard.');
        }
        return false;
      }
      if (tab) {
        openUrlInNewTab(data.url, tab);
        return true;
      }
      return openUrlInNewTab(data.url);
    } catch {
      if (tab) {
        try {
          tab.close();
        } catch {
          /* ignore */
        }
      }
      alert('Could not open Stripe dashboard. Please try again.');
      return false;
    }
  }

  global.HubOrganiserPaymentSetup = {
    fetchState: fetchState,
    groupForEvent: groupForEvent,
    groupNeedsSetup: groupNeedsSetup,
    startSetup: startSetup,
    linkSetup: linkSetup,
    openDashboard: openDashboard,
    openUrlInNewTab: openUrlInNewTab,
    openStripeOnboarding: openStripeOnboarding,
    launcherHref: launcherHref,
    cardHtml: cardHtml,
    checklistHtml: checklistHtml,
    bindCard: bindCard,
    renderInto: renderInto,
  };
})(window);
