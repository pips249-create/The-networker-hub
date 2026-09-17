/**
 * Connected booking — plan slots on Organiser pages + Connected booking settings.
 * Loads lazily (Organiser pages route or Connected settings page), not on My Events.
 */
(function () {
  var ORG_MOUNT = 'org-connected-billing-banner';
  var CB_MOUNT = 'cb-connected-billing-banner';
  var COLLAPSE_KEY = 'hub_connected_billing_banner_collapsed_v1';

  function mountEl(id) {
    return document.getElementById(id);
  }

  function isOrganiserGroupsActive() {
    var page = document.getElementById('org-page-groups');
    return Boolean(page && page.classList.contains('is-active'));
  }

  function shouldSelfFetch() {
    if (mountEl(CB_MOUNT)) return true;
    if (mountEl(ORG_MOUNT) && isOrganiserGroupsActive()) return true;
    return false;
  }

  function planLabel(plan) {
    if (!plan) return 'Connected';
    return String(plan).charAt(0).toUpperCase() + String(plan).slice(1);
  }

  function upgradePlan(current) {
    var p = String(current || '').toLowerCase();
    if (p === 'starter') return 'growth';
    if (p === 'growth') return 'scale';
    return 'scale';
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function assignedNames(payload) {
    var slots = payload && payload.slots;
    if (!slots || !Array.isArray(slots.accountOrganisers)) return [];
    var ids = new Set((slots.assignedOrganiserIds || []).map(String));
    return slots.accountOrganisers.filter(function (o) {
      return ids.has(String(o.id));
    });
  }

  function isCollapsed() {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function setCollapsed(collapsed) {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch (e) {
      /* ignore */
    }
  }

  function bindCollapse(root) {
    if (!root) return;
    var btn = root.querySelector('[data-connected-banner-toggle]');
    var panel = root.querySelector('[data-connected-banner-panel]');
    if (!btn || !panel) return;

    function apply(collapsed) {
      root.classList.toggle('is-collapsed', collapsed);
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      panel.hidden = collapsed;
      var label = btn.querySelector('.org-connected-billing-banner-toggle-label');
      if (label) label.textContent = collapsed ? 'Show' : 'Hide';
    }

    apply(isCollapsed());
    btn.addEventListener('click', function () {
      var next = !root.classList.contains('is-collapsed');
      setCollapsed(next);
      apply(next);
    });
  }

  function renderBanner(payload, groupTotal) {
    var orgEl = mountEl(ORG_MOUNT);
    var cbEl = mountEl(CB_MOUNT);
    var targets = [orgEl, cbEl].filter(Boolean);
    targets.forEach(function (el) {
      el.hidden = true;
      el.innerHTML = '';
      el.className = 'org-connected-billing-banner';
    });
    if (!targets.length) return;

    var billing = payload || {};
    if (!billing.ok || !billing.active) return;

    var limit = billing.groupLimit;
    var published = Number(billing.groupCount) || 0;
    var total = Number(groupTotal);
    if (total == null || Number.isNaN(total)) {
      var orgs = billing.slots && billing.slots.accountOrganisers;
      total = Array.isArray(orgs) ? orgs.length : 0;
    }
    if (limit == null) return;

    var assigned = assignedNames(billing);
    var needsPick = Boolean(billing.slots && billing.slots.needsAssignment);
    var overPublished = published > limit;
    var overPages = total > limit;
    var show =
      assigned.length > 0 || needsPick || overPublished || overPages || billing.active;
    if (!show) return;

    var plan = planLabel(billing.plan);
    var limitLabel = limit === 1 ? '1 organiser page' : limit + ' organiser pages';
    var assignedTitle =
      assigned.length === 0
        ? needsPick
          ? plan + ' plan — choose which organiser ' + (limit === 1 ? 'page uses' : 'pages use') + ' Connected'
          : plan + ' plan — ' + limitLabel + ' on Connected booking'
        : plan +
          ' plan — Connected on ' +
          assigned.length +
          ' of ' +
          limit +
          ' slot' +
          (limit === 1 ? '' : 's') +
          (total > limit ? ' (' + total + ' organiser pages on your account)' : '');

    var assignedBlock = '';
    if (assigned.length) {
      assignedBlock =
        '<p class="org-connected-billing-banner-assigned"><strong>Connected booking is on:</strong> ' +
        assigned
          .map(function (o) {
            return '<span class="org-connected-billing-banner-page">' + esc(o.name) + '</span>';
          })
          .join(', ') +
        '. Look for the <span class="org-badge org-badge-teal org-connected-slot-badge">Connected</span> badge in the table below.</p>';
    } else if (needsPick) {
      assignedBlock =
        '<p class="org-connected-billing-banner-assigned">Pick which organiser ' +
        (limit === 1 ? 'page' : 'pages') +
        ' should use your subscription — only those pages can publish Connected checkout events.</p>';
    }

    var warnBits = [];
    if (overPages) {
      warnBits.push(
        'Your plan includes ' +
          limitLabel +
          ' on Connected booking, but you have ' +
          total +
          ' organiser pages on this account.'
      );
    }
    if (overPublished) {
      warnBits.push(
        'You have ' + published + ' published organiser pages; your plan allows ' + limit + ' published on the hub.'
      );
    }

    var body =
      (warnBits.length ? warnBits.join(' ') + ' ' : '') +
      'Connected billing uses <strong>slots</strong> on organiser pages (not one event at a time). ' +
      'Unpublish organiser pages you do not need on the hub, reassign slots on Connected booking, or upgrade for more. ' +
      'Only need a booking link on one event? Use <strong>Link-out listing (£9.99 + VAT per event)</strong> — hub button to your site, no webhook, no attendee list or verified reviews on The Networker UK.';

    var warn = overPublished || overPages || needsPick;
    var html =
      '<div class="org-connected-billing-banner-inner">' +
      '<div class="org-connected-billing-banner-head">' +
      '<p id="org-connected-billing-banner-title" class="org-connected-billing-banner-title">' +
      '<strong>' +
      esc(assignedTitle) +
      '</strong></p>' +
      '<button type="button" class="org-connected-billing-banner-toggle" data-connected-banner-toggle aria-expanded="true">' +
      '<span class="org-connected-billing-banner-toggle-label">Hide</span>' +
      '</button></div>' +
      '<div class="org-connected-billing-banner-panel" data-connected-banner-panel>' +
      assignedBlock +
      '<p class="org-connected-billing-banner-body">' +
      body +
      '</p>' +
      '<p class="org-connected-billing-banner-actions">' +
      '<a class="org-btn org-btn-gold org-btn-sm" href="/organiser/connected-booking">' +
      (needsPick ? 'Choose organiser pages' : 'Manage Connected plan') +
      '</a> ' +
      '<a class="org-btn org-btn-outline org-btn-sm" href="/organiser/booking-options#link-out">Link-out £9.99 / event</a> ' +
      '<a class="org-btn org-btn-outline org-btn-sm" href="/organiser/#groups">Organiser pages</a>' +
      '</p></div></div>';

    targets.forEach(function (el) {
      el.innerHTML = html;
      el.hidden = false;
      el.className =
        'org-connected-billing-banner' + (warn ? ' org-connected-billing-banner--warn' : ' org-connected-billing-banner--info');
      bindCollapse(el);
    });
  }

  function loadFromApi() {
    if (!shouldSelfFetch()) return;

    Promise.all([
      fetch('/api/organiser/bootstrap?groupsOnly=1', { credentials: 'include', cache: 'no-store' })
        .then(function (r) {
          return r.json();
        })
        .catch(function () {
          return { groups: [] };
        }),
      fetch('/api/organiser/connected-booking', { credentials: 'include', cache: 'no-store' })
        .then(function (r) {
          return r.json().then(function (data) {
            return { status: r.status, data: data };
          });
        })
        .catch(function () {
          return { status: 0, data: null };
        }),
    ]).then(function (results) {
      var groups = (results[0] && results[0].groups) || [];
      var res = results[1] || {};
      if (res.status === 403 || res.status === 404) return;
      renderBanner(res.data || {}, groups.length);
    });
  }

  window.addEventListener('hub-organiser-connected-booking', function (e) {
    if (!mountEl(ORG_MOUNT) && !mountEl(CB_MOUNT)) return;
    var detail = (e && e.detail) || {};
    var total =
      detail.groupTotal != null
        ? detail.groupTotal
        : detail.slots && detail.slots.accountOrganisers
          ? detail.slots.accountOrganisers.length
          : stateGroupTotal();
    renderBanner(detail, total);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (shouldSelfFetch()) loadFromApi();
    });
  } else if (shouldSelfFetch()) {
    loadFromApi();
  }
})();
