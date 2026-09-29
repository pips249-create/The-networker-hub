/**
 * Connected booking — plan slots on Organiser pages (workspace). Billing/webhook on Connected page.
 * Loads lazily on the Organiser pages route, not on My Events.
 */
(function () {
  var ORG_MOUNT = 'org-connected-billing-banner';
  var CB_MOUNT = 'cb-connected-billing-banner';
  var EVENTS_QUICKLINK_MOUNT = 'org-connected-events-quicklink';
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
    if (mountEl(EVENTS_QUICKLINK_MOUNT)) return true;
    if (mountEl(ORG_MOUNT) && isOrganiserGroupsActive()) return true;
    return false;
  }

  function renderEventsQuickLink(data) {
    var el = mountEl(EVENTS_QUICKLINK_MOUNT);
    if (!el) return;
    if (!data || !data.ok || !data.featureEnabled) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    if (data.active) {
      el.innerHTML =
        'Using <strong>Connected</strong> (Eventbrite / your checkout)? Manage webhooks, sync log, and billing on ' +
        '<a class="org-inline-link" href="/organiser/#connected-booking">Connected booking</a>. ' +
        'Assign which organiser pages use your plan on ' +
        '<a class="org-inline-link" href="/organiser/#groups">Organiser pages</a>.';
      return;
    }
    el.innerHTML =
      'Sell on Eventbrite or your own site and sync attendees? See ' +
      '<a class="org-inline-link" href="/organiser/#connected-booking">Connected booking</a> ' +
      'or <a class="org-inline-link" href="/organiser/booking-options">how booking options work</a>.';
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

  function publishConnectedBookingState(data, groupTotal) {
    if (!data || !data.ok) return;
    try {
      window.dispatchEvent(
        new CustomEvent('hub-organiser-connected-booking', {
          detail: Object.assign({}, data, {
            groupTotal: groupTotal != null ? groupTotal : undefined,
          }),
        })
      );
    } catch (e) {
      /* ignore */
    }
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

  function bindOrgInlineSlots(root, billing) {
    if (!root || root.id !== ORG_MOUNT) return;
    var list = root.querySelector('[data-org-slots-list]');
    var saveBtn = root.querySelector('[data-org-slots-save]');
    var statusEl = root.querySelector('[data-org-slots-status]');
    if (!list || !saveBtn) return;

    var slots = billing.slots || {};
    var limit = billing.groupLimit;
    var selection = (slots.assignedOrganiserIds || []).slice();

    list.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var id = cb.getAttribute('data-org-id');
        if (cb.checked) {
          if (selection.indexOf(id) < 0) selection.push(id);
          if (limit != null && selection.length > limit) {
            selection = selection.slice(-limit);
            list.querySelectorAll('input[type=checkbox]').forEach(function (other) {
              var oid = other.getAttribute('data-org-id');
              other.checked = selection.indexOf(oid) >= 0;
            });
          }
        } else {
          selection = selection.filter(function (x) {
            return x !== id;
          });
        }
      });
    });

    saveBtn.addEventListener('click', function () {
      if (!selection.length) {
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.className = 'ee-hint ee-alert-warn';
          statusEl.textContent = 'Select at least one organiser page.';
        }
        return;
      }
      saveBtn.disabled = true;
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.className = 'ee-hint';
        statusEl.textContent = 'Saving…';
      }
      fetch('/api/organiser/connected-booking', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign_connected_slots',
          organiserIds: selection,
        }),
      })
        .then(function (r) {
          return r.json().then(function (body) {
            return { ok: r.ok, body: body };
          });
        })
        .then(function (res) {
          saveBtn.disabled = false;
          if (!res.ok) {
            if (statusEl) {
              statusEl.className = 'ee-hint ee-alert-warn';
              var errMsg = res.body.message || res.body.error || 'Could not save.';
              if (
                res.body.error === 'connected_booking_schema_missing' ||
                /297_connected_booking|connected_booking_slot_assigned_at/i.test(errMsg)
              ) {
                errMsg =
                  'Run Supabase migration 297_connected_booking_organiser_slots.sql (organiser-page slots). Migrations 292/298 alone are not enough for Save assignment.';
              } else if (res.body.error === 'connected_booking_failed' && res.body.message) {
                errMsg = res.body.message;
              }
              statusEl.textContent = errMsg;
            }
            return;
          }
          return fetch('/api/organiser/connected-booking', { credentials: 'include', cache: 'no-store' })
            .then(function (r) {
              return r.json();
            })
            .then(function (fresh) {
              if (statusEl) {
                statusEl.className = 'ee-hint ee-alert-ok';
                statusEl.textContent = 'Saved. Connected booking is assigned — check the Connected column below.';
              }
              var total =
                (billing.slots && billing.slots.accountOrganisers && billing.slots.accountOrganisers.length) ||
                undefined;
              publishConnectedBookingState(fresh, total);
              renderBanner(fresh, total);
            });
        })
        .catch(function () {
          saveBtn.disabled = false;
          if (statusEl) {
            statusEl.className = 'ee-hint ee-alert-warn';
            statusEl.textContent = 'Could not save. Try again.';
          }
        });
    });
  }

  function bindCollapse(root, forceExpanded) {
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

    apply(forceExpanded ? false : isCollapsed());
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
    var schemaMissing = Boolean(billing.slots && billing.slots.schemaMissing);
    var setupHint =
      (billing.setup && billing.setup.nextStep) ||
      billing.schemaWarning ||
      '';
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
    if (setupHint) {
      assignedBlock +=
        '<p class="ee-hint ee-alert-warn org-connected-billing-setup-hint" role="status">' +
        esc(setupHint) +
        '</p>';
    }
    if (assigned.length) {
      assignedBlock =
        '<p class="org-connected-billing-banner-assigned"><strong>Connected booking is on:</strong> ' +
        assigned
          .map(function (o) {
            return '<span class="org-connected-billing-banner-page">' + esc(o.name) + '</span>';
          })
          .join(', ') +
        '. See the <strong>Connected</strong> column in the table below.</p>';
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
      (schemaMissing
        ? '<strong>Setup incomplete:</strong> organiser-page Connected slots need database migration 297 on production — assignment cannot be saved until that is applied. '
        : '') +
      (warnBits.length ? warnBits.join(' ') + ' ' : '') +
      'Connected billing uses <strong>slots</strong> on organiser pages (not one event at a time). ' +
      'Tick the page(s) below, click <strong>Save assignment</strong>, then check the <strong>Connected</strong> column. ' +
      'Upgrade your plan for more slots. ' +
      'Only need a booking link on one event? Use <strong>Link-out listing (£9.99 + VAT per event)</strong> — hub button to your site, no webhook, no attendee list or verified reviews on The Networker UK.';

    var warn = overPublished || overPages || needsPick;

    function inlineSlotsHtml(forOrgPage) {
      if (!needsPick || !forOrgPage) return '';
      var orgs = (billing.slots && billing.slots.accountOrganisers) || [];
      if (!orgs.length) return '';
      var ids = (billing.slots.assignedOrganiserIds || []).slice();
      var items = orgs
        .map(function (o) {
          var checked = ids.indexOf(o.id) >= 0;
          return (
            '<li class="cb-slots-list-item"><label class="cb-slots-label">' +
            '<input type="checkbox" data-org-id="' +
            esc(o.id) +
            '"' +
            (checked ? ' checked' : '') +
            ' /> <span>' +
            esc(o.name || 'Organiser page') +
            '</span></label></li>'
          );
        })
        .join('');
      return (
        '<div class="org-connected-slots-inline">' +
        '<ul class="cb-slots-list" data-org-slots-list>' +
        items +
        '</ul>' +
        '<p class="ee-hint org-connected-slots-status" data-org-slots-status hidden role="status"></p>' +
        '<p class="org-connected-billing-banner-actions org-connected-slots-actions">' +
        '<button type="button" class="org-btn org-btn-gold org-btn-sm" data-org-slots-save>Save assignment</button>' +
        '</p></div>'
      );
    }

    function buildHtml(forOrgPage) {
      var inline = inlineSlotsHtml(forOrgPage);
      var actions = '';
      if (needsPick && forOrgPage && inline) {
        actions =
          (overPages
            ? '<a class="org-btn org-btn-gold org-btn-sm" href="/organiser/#cb-pricing">Upgrade plan</a> '
            : '') +
          '<a class="org-btn org-btn-outline org-btn-sm" href="/organiser/booking-options#link-out">Link-out £9.99 / event</a> ' +
          '<a class="org-btn org-btn-outline org-btn-sm" href="/organiser/#connected-booking">Connected plan &amp; billing</a>';
      } else {
        actions =
          '<a class="org-btn org-btn-gold org-btn-sm" href="' +
          (needsPick ? '/organiser/#groups' : '/organiser/#connected-booking') +
          '">' +
          (needsPick ? 'Choose organiser pages' : 'Connected booking & sync log') +
          '</a> ' +
          '<a class="org-btn org-btn-outline org-btn-sm" href="/organiser/booking-options#link-out">Link-out £9.99 / event</a> ' +
          (forOrgPage
            ? ''
            : '<a class="org-btn org-btn-outline org-btn-sm" href="/organiser/#groups">Organiser pages</a>');
      }

      return (
        '<div class="org-connected-billing-banner-inner">' +
        '<div class="org-connected-billing-banner-head">' +
        '<p id="org-connected-billing-banner-title" class="org-connected-billing-banner-title">' +
        '<strong>' +
        esc(assignedTitle) +
        '</strong></p>' +
        '<button type="button" class="org-btn org-btn-outline org-btn-sm org-connected-billing-banner-toggle" data-connected-banner-toggle aria-expanded="true">' +
        '<span class="org-connected-billing-banner-toggle-label">Hide</span>' +
        '</button></div>' +
        '<div class="org-connected-billing-banner-panel" data-connected-banner-panel>' +
        assignedBlock +
        inline +
        '<p class="org-connected-billing-banner-body">' +
        body +
        '</p>' +
        '<p class="org-connected-billing-banner-actions">' +
        actions +
        '</p></div></div>'
      );
    }

    targets.forEach(function (el) {
      var forOrgPage = el.id === ORG_MOUNT;
      el.innerHTML = buildHtml(forOrgPage);
      el.hidden = false;
      el.className =
        'org-connected-billing-banner' + (warn ? ' org-connected-billing-banner--warn' : ' org-connected-billing-banner--info');
      bindCollapse(el, forOrgPage && needsPick);
      if (forOrgPage && needsPick && !schemaMissing) bindOrgInlineSlots(el, billing);
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
      var data = res.data || {};
      renderBanner(data, groups.length);
      renderEventsQuickLink(data);
      publishConnectedBookingState(data, groups.length);
    });
  }

  window.addEventListener('hub-organiser-connected-booking', function (e) {
    if (!mountEl(ORG_MOUNT) && !mountEl(CB_MOUNT) && !mountEl(EVENTS_QUICKLINK_MOUNT)) return;
    var detail = (e && e.detail) || {};
    var total =
      detail.groupTotal != null
        ? detail.groupTotal
        : detail.slots && detail.slots.accountOrganisers
          ? detail.slots.accountOrganisers.length
          : undefined;
    renderBanner(detail, total);
    renderEventsQuickLink(detail);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (shouldSelfFetch()) loadFromApi();
    });
  } else if (shouldSelfFetch()) {
    loadFromApi();
  }
})();
