/**
 * Connected — account plan vs organiser group profiles (My Events + Connected page).
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

  function renderBanner(billing, groupTotal) {
    var els = mounts();
    if (!els.length) return;

    els.forEach(function (el) {
      el.hidden = true;
      el.innerHTML = '';
      el.className = 'cb-account-notice';
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
    var headline = overPublished
      ? plan +
        ' allows ' +
        limit +
        ' published group profile' +
        (limit === 1 ? '' : 's') +
        ' — you have ' +
        published +
        ' live.'
      : plan +
        ' includes ' +
        limit +
        ' group profile' +
        (limit === 1 ? '' : 's') +
        ' — your account has ' +
        total +
        ' organiser pages.';

    var detail = overPublished
      ? 'Unpublish profiles you are not using, or upgrade for more published slots.'
      : 'You can keep every page, but only ' +
        limit +
        ' can stay published on Connected at once. Unpublish extras or upgrade.';

    var html =
      '<div class="cb-account-notice-icon" aria-hidden="true">!</div>' +
      '<div class="cb-account-notice-copy">' +
      '<p class="cb-account-notice-title">' +
      headline +
      '</p>' +
      '<p class="cb-account-notice-body">' +
      detail +
      ' For a single event with no integration, use <strong>Link Out</strong> (£9.99 + VAT per event) — redirect only, no reviews or attendee sync.' +
      '</p>' +
      '</div>' +
      '<div class="cb-account-notice-actions">' +
      '<a class="ee-btn ee-btn-gold cb-account-notice-btn" href="/organiser/connected-booking#cb-pricing">Upgrade plan</a>' +
      '<a class="ee-btn ee-btn-outline cb-account-notice-btn" href="/organiser/booking-options#link-out">Link Out</a>' +
      '<a class="ee-btn ee-btn-outline cb-account-notice-btn" href="/organiser/#groups">Manage pages</a>' +
      '</div>';

    els.forEach(function (el) {
      el.innerHTML = html;
      el.hidden = false;
      el.className = 'cb-account-notice cb-account-notice--active';
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
      renderBanner(res.data || {}, groups.length);
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
