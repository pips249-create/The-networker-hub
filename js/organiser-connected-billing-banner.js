/**
 * Connected booking — account plan vs organiser group profiles (My Events + Connected page).
 */
(function () {
  var MOUNT_IDS = ['org-connected-billing-banner', 'cb-connected-billing-banner'];

  function mounts() {
    return MOUNT_IDS.map(function (id) {
      return document.getElementById(id);
    }).filter(Boolean);
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

  function renderBanner(billing, groupTotal) {
    var els = mounts();
    if (!els.length) return;

    els.forEach(function (el) {
      el.hidden = true;
      el.innerHTML = '';
      el.className = 'org-connected-billing-banner';
    });

    if (!billing || !billing.ok || !billing.active) return;

    var limit = billing.groupLimit;
    var published = Number(billing.groupCount) || 0;
    var total = Number(groupTotal) || 0;
    if (limit == null) return;

    var overPublished = published > limit;
    var multiplePages = total > limit;
    if (!overPublished && !multiplePages) return;

    var plan = planLabel(billing.plan);
    var up = upgradePlan(billing.plan);
    var title = overPublished
      ? plan + ' includes ' + limit + ' published group profile' + (limit === 1 ? '' : 's') + ', you have ' + published + '.'
      : plan + ' includes ' + limit + ' group profile' + (limit === 1 ? '' : 's') + ' on your account — you have ' + total + ' organiser pages.';

    var body =
      'Connected billing applies to your whole organiser account (not one page at a time). ' +
      'Unpublish extra group profiles you do not need on the hub, or upgrade for more slots. ' +
      'Only need a booking link on one event? Use <strong>Link-out listing (£9.99 + VAT per event)</strong> — hub button to your site, no webhook, no attendee list or verified reviews on The Networker UK.';

    var html =
      '<div class="org-connected-billing-banner-inner">' +
      '<p class="org-connected-billing-banner-title"><strong>' +
      title +
      '</strong></p>' +
      '<p class="org-connected-billing-banner-body">' +
      body +
      '</p>' +
      '<p class="org-connected-billing-banner-actions">' +
      '<a class="org-btn org-btn-gold org-btn-sm" href="/organiser/connected-booking">Upgrade plan</a> ' +
      '<a class="org-btn org-btn-outline org-btn-sm" href="/organiser/booking-options#link-out">Link-out £9.99 / event</a> ' +
      '<a class="org-btn org-btn-outline org-btn-sm" href="/organiser/group-edit">Manage group pages</a>' +
      '</p></div>';

    els.forEach(function (el) {
      el.innerHTML = html;
      el.hidden = false;
      el.className = 'org-connected-billing-banner org-connected-billing-banner--warn';
    });
  }

  function load() {
    if (!mounts().length) return;

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
      var billing = res.data || {};
      renderBanner(billing, groups.length);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }

  window.addEventListener('hub-organiser-bootstrap', function (e) {
    var groups = (e.detail && e.detail.groups) || [];
    fetch('/api/organiser/connected-booking', { credentials: 'include', cache: 'no-store' })
      .then(function (r) {
        return r.json().then(function (data) {
          return { status: r.status, data: data };
        });
      })
      .then(function (res) {
        if (res.status === 403 || res.status === 404) return;
        renderBanner(res.data || {}, groups.length);
      })
      .catch(function () {});
  });
})();
