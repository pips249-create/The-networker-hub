/**
 * PECR cookie consent — gates non-essential analytics until accepted.
 */
(function () {
  var STORAGE_KEY = 'hub_cookie_consent_v1';

  function readConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function writeConsent(prefs) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          necessary: true,
          analytics: !!prefs.analytics,
          ts: Date.now(),
        })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function cookiePolicyHref() {
    var host = String(window.location.hostname || '').toLowerCase().replace(/^www\./, '');
    if (
      host === 'thenetworkerinternational.com' ||
      host === 'thenetworkerireland.com' ||
      host === 'thenetworkerusa.com'
    ) {
      return 'https://www.thenetworkeruk.com/legal-policies#cookies';
    }
    return '/legal-policies#cookies';
  }

  function loadAnalytics() {
    if (!window.HubAnalytics || typeof window.HubAnalytics.load !== 'function') return;
    window.HubAnalytics.load();
  }

  function disableAnalytics() {
    if (window.HubAnalytics && typeof window.HubAnalytics.disable === 'function') {
      window.HubAnalytics.disable();
    }
  }

  function applyConsent(prefs) {
    writeConsent(prefs);
    if (prefs.analytics) loadAnalytics();
    else disableAnalytics();
    hideBanner();
    hideModal();
  }

  var bannerEl;
  var modalEl;

  function hideBanner() {
    if (bannerEl) bannerEl.hidden = true;
  }

  function hideModal() {
    if (modalEl) modalEl.hidden = true;
    document.body.classList.remove('hub-cookie-modal-open');
  }

  function showModal() {
    if (!modalEl) return;
    var consent = readConsent();
    var analyticsToggle = document.getElementById('hub-cookie-analytics');
    if (analyticsToggle) analyticsToggle.checked = consent ? !!consent.analytics : false;
    modalEl.hidden = false;
    document.body.classList.add('hub-cookie-modal-open');
  }

  function buildUi() {
    if (document.getElementById('hub-cookie-banner')) return;

    bannerEl = document.createElement('div');
    bannerEl.id = 'hub-cookie-banner';
    bannerEl.className = 'hub-cookie-banner';
    bannerEl.setAttribute('role', 'dialog');
    bannerEl.setAttribute('aria-label', 'Cookie consent');
    bannerEl.innerHTML =
      '<div class="hub-cookie-banner-inner">' +
      '<p class="hub-cookie-banner-copy">We use essential cookies to run the platform and optional analytics to improve the site. ' +
      '<a href="' +
      cookiePolicyHref() +
      '">Cookie policy</a></p>' +
      '<div class="hub-cookie-banner-actions">' +
      '<button type="button" class="hub-cookie-btn" id="hub-cookie-settings-btn">Manage</button>' +
      '<button type="button" class="hub-cookie-btn" id="hub-cookie-reject-btn">Essential only</button>' +
      '<button type="button" class="hub-cookie-btn hub-cookie-btn--primary" id="hub-cookie-accept-btn">Accept all</button>' +
      '</div></div>';
    document.body.appendChild(bannerEl);

    modalEl = document.createElement('div');
    modalEl.id = 'hub-cookie-modal';
    modalEl.className = 'hub-cookie-modal';
    modalEl.hidden = true;
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'hub-cookie-modal-title');
    modalEl.innerHTML =
      '<div class="hub-cookie-modal-panel">' +
      '<h2 id="hub-cookie-modal-title">Cookie preferences</h2>' +
      '<p>Choose which cookies we may use. Essential cookies are required for sign-in, bookings, and security.</p>' +
      '<div class="hub-cookie-pref">' +
      '<div><strong>Essential</strong><span>Required for the site to work. Always on.</span></div>' +
      '<input type="checkbox" checked disabled aria-label="Essential cookies always on" />' +
      '</div>' +
      '<div class="hub-cookie-pref">' +
      '<div><strong>Analytics</strong><span>Privacy-oriented usage statistics via Vercel Web Analytics.</span></div>' +
      '<input type="checkbox" id="hub-cookie-analytics" aria-label="Allow analytics cookies" />' +
      '</div>' +
      '<div class="hub-cookie-modal-actions">' +
      '<button type="button" class="hub-cookie-btn" id="hub-cookie-modal-cancel">Cancel</button>' +
      '<button type="button" class="hub-cookie-btn hub-cookie-btn--primary" id="hub-cookie-modal-save">Save preferences</button>' +
      '</div></div>';
    document.body.appendChild(modalEl);

    document.getElementById('hub-cookie-accept-btn').addEventListener('click', function () {
      applyConsent({ analytics: true });
    });
    document.getElementById('hub-cookie-reject-btn').addEventListener('click', function () {
      applyConsent({ analytics: false });
    });
    document.getElementById('hub-cookie-settings-btn').addEventListener('click', showModal);
    document.getElementById('hub-cookie-modal-cancel').addEventListener('click', hideModal);
    document.getElementById('hub-cookie-modal-save').addEventListener('click', function () {
      var analytics = document.getElementById('hub-cookie-analytics').checked;
      applyConsent({ analytics: analytics });
    });
    modalEl.addEventListener('click', function (e) {
      if (e.target === modalEl) hideModal();
    });
  }

  function hasAnalyticsConsent() {
    var consent = readConsent();
    return !!(consent && consent.analytics);
  }

  window.HubCookieConsent = {
    openSettings: showModal,
    getConsent: readConsent,
    hasAnalyticsConsent: hasAnalyticsConsent,
  };

  function init() {
    buildUi();
    var existing = readConsent();
    if (existing) {
      hideBanner();
      if (existing.analytics) loadAnalytics();
    } else if (bannerEl) {
      bannerEl.hidden = false;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
