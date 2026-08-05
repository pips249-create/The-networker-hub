/**
 * Shared site footer — same block on every public page.
 * When the public catalogue is gated, Explore links stay on the organiser funnel.
 * Early-access surfaces (Email 1) always keep the slim footer — even if a team
 * preview cookie unlocks catalogue APIs.
 */
(function () {
  var FOOTER_BUILD = '20260805mobile1';
  var script = document.currentScript;
  var root = (script && script.getAttribute('data-root')) || '';

  function href(path) {
    if (!path) return root || '/';
    if (path.charAt(0) === '/' || /^(https?:|mailto:|tel:)/i.test(path)) return path;
    return root + path;
  }

  /** Email 1 / pre-launch marketing pages — never show catalogue footer links. */
  function forceEarlyAccessChrome() {
    var p = String(window.location.pathname || '').toLowerCase();
    return /\/(for-organisers|about|contact|legal-policies)(?:\.html)?\/?$/.test(p);
  }

  function effectiveCatalogueOpen(open) {
    if (forceEarlyAccessChrome()) return false;
    return open === true;
  }

  var mount = document.getElementById('hub-site-footer');
  if (!mount) return;

  function exploreLinksHtml(catalogueOpen) {
    if (catalogueOpen) {
      return (
        '<a href="' +
        href('/events/') +
        '">Events</a>' +
        '<a href="' +
        href('/events/?mode=organisers') +
        '">Organisers</a>' +
        '<a href="' +
        href('/opportunities/') +
        '">Opportunities</a>'
      );
    }
    return (
      '<a href="' +
      href('/for-organisers') +
      '">For organisers</a>' +
      '<a href="' +
      href('/about') +
      '">About us</a>' +
      '<a href="' +
      href('/contact') +
      '">Contact us</a>'
    );
  }

  function helpLinksHtml(catalogueOpen) {
    if (catalogueOpen) {
      return (
        '<a href="' +
        href('/faq') +
        '">FAQ</a>' +
        '<a href="' +
        href('/for-attendees') +
        '">For Attendees</a>' +
        '<a href="' +
        href('/for-organisers') +
        '">For Organisers</a>' +
        '<a href="' +
        href('/guides') +
        '">Organiser guides</a>' +
        '<a href="' +
        href('/contact') +
        '">Contact us</a>'
      );
    }
    return '';
  }

  function renderFooter(catalogueOpen) {
    var homeHref = catalogueOpen ? href('/') : href('/for-organisers');
    var helpBlock = '';
    var companyBlock = '';
    if (catalogueOpen) {
      helpBlock =
        '<div class="footer-col">' +
        '<p class="footer-col-title">Help</p>' +
        '<nav class="footer-col-links" aria-label="Help">' +
        helpLinksHtml(true) +
        '</nav>' +
        '</div>';
      companyBlock =
        '<div class="footer-col">' +
        '<p class="footer-col-title">Company</p>' +
        '<nav class="footer-col-links" aria-label="Company">' +
        '<a href="' +
        href('/about') +
        '">About us</a>' +
        '<a href="' +
        href('/advertising') +
        '">Advertising &amp; sponsorship</a>' +
        '</nav>' +
        '</div>';
    }
    var legalLinks = catalogueOpen
      ? '<a href="' +
        href('/legal-policies') +
        '" data-footer-policy="overview">Legal &amp; policies</a>' +
        '<a href="' +
        href('/legal-policies#privacy') +
        '" data-footer-policy="privacy">Privacy policy</a>' +
        '<a href="' +
        href('/legal-policies#terms') +
        '" data-footer-policy="terms">Terms &amp; conditions</a>' +
        '<a href="' +
        href('/legal-policies#hub-rules') +
        '" data-footer-policy="hub-rules">Hub rules</a>' +
        '<a href="' +
        href('/legal-policies#refunds') +
        '" data-footer-policy="refunds">Refunds &amp; cancellations</a>' +
        '<a href="' +
        href('/legal-policies#cookies') +
        '" data-footer-policy="cookies">Cookie policy</a>' +
        '<button type="button" class="footer-cookie-settings" id="footer-cookie-settings">Cookie settings</button>'
      : '<a href="' +
        href('/legal-policies') +
        '" data-footer-policy="overview">Legal &amp; policies</a>' +
        '<a href="' +
        href('/legal-policies#privacy') +
        '" data-footer-policy="privacy">Privacy policy</a>' +
        '<button type="button" class="footer-cookie-settings" id="footer-cookie-settings">Cookie settings</button>';

    mount.innerHTML =
      '<footer class="site-footer">' +
      '<div class="footer-inner">' +
      '<a href="' +
      homeHref +
      '" class="footer-brand" aria-label="Home">' +
      '<img class="footer-logo" src="' +
      href('/assets/logo-nav-transparent.png?v=20260729a') +
      '" alt="" width="550" height="255" aria-hidden="true">' +
      '</a>' +
      '<div class="footer-columns">' +
      '<div class="footer-col">' +
      '<p class="footer-col-title">Explore</p>' +
      '<nav class="footer-col-links" aria-label="Explore">' +
      exploreLinksHtml(catalogueOpen) +
      '</nav>' +
      '</div>' +
      helpBlock +
      companyBlock +
      '<div class="footer-col">' +
      '<p class="footer-col-title">Legal</p>' +
      '<nav class="footer-col-links" aria-label="Legal">' +
      legalLinks +
      '</nav>' +
      '</div>' +
      '</div>' +
      '<p class="footer-copy">' +
      '© ' +
      new Date().getFullYear() +
      ' The Networker Group Ltd · Registered in England &amp; Wales (Company No. 15252227) · <span class="nowrap">VAT No. 454&nbsp;4092&nbsp;94</span><br>' +
      'Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon, Cambridgeshire PE28 4YF' +
      '</p>' +
      '</div>' +
      '</footer>';

    var cookieBtn = document.getElementById('footer-cookie-settings');
    if (cookieBtn) {
      cookieBtn.addEventListener('click', function () {
        if (window.HubCookieConsent && window.HubCookieConsent.openSettings) {
          window.HubCookieConsent.openSettings();
        }
      });
    }
  }

  // Default to gated footer so Email 1 visitors never see catalogue links.
  var catalogueOpen = effectiveCatalogueOpen(
    typeof window.HubCatalogueOpen === 'boolean' ? window.HubCatalogueOpen : false
  );
  renderFooter(catalogueOpen);

  window.addEventListener('hub-catalogue-access', function (ev) {
    var open = ev && ev.detail && ev.detail.open === true;
    renderFooter(effectiveCatalogueOpen(open));
  });

  if (forceEarlyAccessChrome()) {
    // Stay slim on Email 1 pages even when preview cookie unlocks /api/events.
    window.HubCatalogueOpen = false;
  } else if (typeof window.HubCatalogueOpen !== 'boolean') {
    fetch('/api/events?limit=1', { credentials: 'include', cache: 'no-store' })
      .then(function (res) {
        return res.status === 200;
      })
      .catch(function () {
        return false;
      })
      .then(function (open) {
        window.HubCatalogueOpen = open;
        renderFooter(effectiveCatalogueOpen(open));
      });
  }

  if (!document.querySelector('script[src*="hub-seo-data"]')) {
    var seoData = document.createElement('script');
    seoData.src = href('js/hub-seo-data.js?v=' + FOOTER_BUILD);
    seoData.onload = function () {
      if (document.querySelector('script[src*="hub-seo-schema"]')) return;
      var seoInject = document.createElement('script');
      seoInject.src = href('js/hub-seo-schema.js?v=' + FOOTER_BUILD);
      (document.head || document.body).appendChild(seoInject);
    };
    (document.head || document.body).appendChild(seoData);
  }

  if (script && script.getAttribute('data-hubert') === 'off') return;
  var pagePath = (window.location.pathname || '').toLowerCase();
  if (/\/contact(?:\.html)?\/?$/.test(pagePath)) return;

  function loadHubertWidget() {
    if (document.querySelector('script[src*="hubert-widget"]')) return;
    var hubertCss = document.createElement('link');
    hubertCss.rel = 'stylesheet';
    hubertCss.href = href('css/hubert-widget.css?v=' + FOOTER_BUILD);
    document.head.appendChild(hubertCss);

    var hubertChat = document.createElement('script');
    hubertChat.src = href('js/hubert-chat.js?v=' + FOOTER_BUILD);
    hubertChat.onload = function () {
      var hubertWidget = document.createElement('script');
      hubertWidget.src = href('js/hubert-widget.js?v=' + FOOTER_BUILD);
      hubertWidget.setAttribute('data-root', root);
      document.body.appendChild(hubertWidget);
    };
    document.body.appendChild(hubertChat);
  }

  // Keep Hubert off while the public catalogue is gated (Email 1 / pre-launch).
  if (window.HubCatalogueOpen === true) {
    loadHubertWidget();
  } else {
    window.addEventListener('hub-catalogue-access', function (ev) {
      if (ev && ev.detail && ev.detail.open === true) loadHubertWidget();
    });
  }
})();
