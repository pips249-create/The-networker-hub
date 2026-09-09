/**
 * Shared site footer — same block on every public page.
 * When the public catalogue is gated, Explore links stay on the organiser funnel.
 * Early-access surfaces (Email 1) always keep the slim footer — even if a team
 * preview cookie unlocks catalogue APIs.
 */
(function () {
  var FOOTER_BUILD = '20260909social1';
  var PUBLIC_BROWSE_OPENS_AT_MS = Date.parse('2026-08-25T00:00:00+01:00');
  var script = document.currentScript;
  var root = (script && script.getAttribute('data-root')) || '';
  var SOCIAL_LINKS = [
    {
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/company/the-networker-group-ltd/',
      icon:
        '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.23 0z"/></svg>',
    },
    {
      label: 'Facebook',
      href: 'https://www.facebook.com/profile.php?id=61556836190159',
      icon:
        '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M22.68 0H1.32A1.32 1.32 0 0 0 0 1.32v21.36A1.32 1.32 0 0 0 1.32 24h11.5v-9.29H9.69v-3.62h3.13V8.41c0-3.1 1.89-4.79 4.66-4.79 1.33 0 2.47.1 2.8.14v3.24h-1.92c-1.5 0-1.8.72-1.8 1.76v2.31h3.6l-.47 3.62h-3.13V24h6.12A1.32 1.32 0 0 0 24 22.68V1.32A1.32 1.32 0 0 0 22.68 0z"/></svg>',
    },
  ];

  function socialLinksHtml() {
    return (
      '<nav class="footer-social" aria-label="Follow The Networker UK">' +
      '<p class="footer-social-label">Follow us</p>' +
      '<ul class="footer-social-list">' +
      SOCIAL_LINKS.map(function (item) {
        return (
          '<li>' +
          '<a class="footer-social-link" href="' +
          item.href +
          '" target="_blank" rel="noopener noreferrer">' +
          '<span class="footer-social-icon">' +
          item.icon +
          '</span>' +
          '<span>' +
          item.label +
          '</span>' +
          '</a>' +
          '</li>'
        );
      }).join('') +
      '</ul>' +
      '</nav>'
    );
  }

  function isPublicBrowseDateOpen() {
    if (window.HubSoftLaunch && typeof window.HubSoftLaunch.isPublicBrowseOpen === 'function') {
      return window.HubSoftLaunch.isPublicBrowseOpen();
    }
    return Date.now() >= PUBLIC_BROWSE_OPENS_AT_MS;
  }

  function guessCatalogueOpen() {
    if (typeof window.HubCatalogueOpen === 'boolean') return window.HubCatalogueOpen;
    try {
      var raw = sessionStorage.getItem('hub_catalogue_open_v1');
      if (raw === '1') return true;
      if (raw === '0') return false;
    } catch (e) {
      /* ignore */
    }
    return isPublicBrowseDateOpen();
  }

  function href(path) {
    if (!path) return root || '/';
    if (path.charAt(0) === '/' || /^(https?:|mailto:|tel:)/i.test(path)) return path;
    return root + path;
  }

  /** Soft-launch /peek mini-site — closed footer bubble. */
  function isPeekPath() {
    var p = String(window.location.pathname || '').toLowerCase();
    return p === '/peek' || p.indexOf('/peek/') === 0;
  }

  /** Soft-launch /peek mini-site only — marketing pages follow real catalogue state. */
  function forceEarlyAccessChrome() {
    return isPeekPath();
  }

  function effectiveCatalogueOpen(open) {
    if (forceEarlyAccessChrome()) return false;
    return open === true;
  }

  var mount = document.getElementById('hub-site-footer');
  if (!mount) return;

  function exploreLinksHtml(catalogueOpen) {
    if (isPeekPath()) {
      return (
        '<a href="' +
        href('/peek/for-organisers') +
        '">For organisers</a>' +
        '<a href="' +
        href('/add-your-event') +
        '">Send us your event</a>' +
        '<a href="' +
        href('/peek/for-networkers') +
        '">For networkers</a>' +
        '<a href="' +
        href('/peek/about-us') +
        '">About us</a>' +
        '<a href="' +
        href('/peek/about-us#updates') +
        '">Get updates</a>'
      );
    }
    if (catalogueOpen) {
      return (
        '<a href="' +
        href('/events/') +
        '">Events</a>' +
        '<a href="' +
        href('/events/?mode=organisers') +
        '">Organisers</a>' +
        '<a href="' +
        href('/rankings') +
        '">Top groups</a>' +
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
      href('/add-your-event') +
      '">Send us your event</a>' +
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
        href('/for-networkers') +
        '">For Networkers</a>' +
        '<a href="' +
        href('/for-organisers') +
        '">For Organisers</a>' +
        '<a href="' +
        href('/add-your-event') +
        '">Send us your event</a>' +
        '<a href="' +
        href('/guides') +
        '">Organiser guides</a>' +
        '<a href="' +
        href('/advertising') +
        '">Advertising &amp; sponsorship</a>' +
        '<a href="' +
        href('/contact') +
        '">Contact us</a>'
      );
    }
    return '';
  }

  function renderFooter(catalogueOpen) {
    var homeHref = isPeekPath()
      ? href('/peek')
      : catalogueOpen
        ? href('/')
        : href('/for-organisers');
    var helpBlock = '';
    var companyBlock =
      '<div class="footer-col">' +
      '<p class="footer-col-title">Company</p>' +
      '<nav class="footer-col-links" aria-label="Company">' +
      (catalogueOpen
        ? '<a href="' + href('/about') + '">About us</a>'
        : '') +
      '<a href="https://www.thenetworkerinternational.com/">The Networker International</a>' +
      (catalogueOpen
        ? '<a href="' + href('/advertising') + '">Advertising &amp; sponsorship</a>'
        : '') +
      '</nav>' +
      '</div>';
    if (catalogueOpen) {
      helpBlock =
        '<div class="footer-col">' +
        '<p class="footer-col-title">Help</p>' +
        '<nav class="footer-col-links" aria-label="Help">' +
        helpLinksHtml(true) +
        '</nav>' +
        '</div>';
    }
    var contentReportHref =
      'mailto:hi@thenetworkeruk.com?subject=' +
      encodeURIComponent('Content report') +
      '&body=' +
      encodeURIComponent(
        'Please describe the content you are reporting and include the page URL.\n\nURL:\nWhat is wrong:\n'
      );
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
        '" data-footer-policy="hub-rules">Platform rules</a>' +
        '<a href="' +
        href('/legal-policies#refunds') +
        '" data-footer-policy="refunds">Refunds &amp; cancellations</a>' +
        '<a href="' +
        href('/legal-policies#cookies') +
        '" data-footer-policy="cookies">Cookie policy</a>' +
        '<a href="' +
        contentReportHref +
        '">Report content</a>' +
        '<button type="button" class="footer-cookie-settings" id="footer-cookie-settings">Cookie settings</button>'
      : '<a href="' +
        href('/legal-policies') +
        '" data-footer-policy="overview">Legal &amp; policies</a>' +
        '<a href="' +
        href('/legal-policies#privacy') +
        '" data-footer-policy="privacy">Privacy policy</a>' +
        '<a href="' +
        contentReportHref +
        '">Report content</a>' +
        '<button type="button" class="footer-cookie-settings" id="footer-cookie-settings">Cookie settings</button>';

    mount.innerHTML =
      '<footer class="site-footer">' +
      '<div class="footer-inner">' +
      '<div class="footer-brand-block">' +
      '<a href="' +
      homeHref +
      '" class="footer-brand" aria-label="Home">' +
      '<img class="footer-logo" src="' +
      href('/assets/logo-nav-transparent.png?v=20260823uk3') +
      '" alt="" width="550" height="255" aria-hidden="true">' +
      '</a>' +
      socialLinksHtml() +
      '</div>' +
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

  // Prefer full Explore links once browse is open; avoid slim-footer flash.
  var catalogueOpen = effectiveCatalogueOpen(guessCatalogueOpen());
  renderFooter(catalogueOpen);

  window.addEventListener('hub-catalogue-access', function (ev) {
    var open = ev && ev.detail && ev.detail.open === true;
    renderFooter(effectiveCatalogueOpen(open));
  });

  if (forceEarlyAccessChrome()) {
    // Peek mini-site stays slim even when preview cookie unlocks /api/events.
    // Do not mutate HubCatalogueOpen — that would flash early nav on the next page.
  } else if (typeof window.HubCatalogueOpen !== 'boolean') {
    var probe =
      typeof window.hubProbeCatalogueAccess === 'function'
        ? window.hubProbeCatalogueAccess()
        : fetch('/api/events?probe=1', { credentials: 'include', cache: 'no-store' })
            .then(function (res) {
              if (res.status !== 200) return isPublicBrowseDateOpen();
              return res
                .json()
                .then(function (data) {
                  return !(data && data.open === false);
                })
                .catch(function () {
                  return isPublicBrowseDateOpen();
                });
            })
            .catch(function () {
              return isPublicBrowseDateOpen();
            })
            .then(function (open) {
              window.HubCatalogueOpen = open;
              try {
                sessionStorage.setItem('hub_catalogue_open_v1', open ? '1' : '0');
              } catch (e) {
                /* ignore */
              }
              return open;
            });
    probe.then(function (open) {
      renderFooter(effectiveCatalogueOpen(open === true || window.HubCatalogueOpen === true));
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
    if (
      document.getElementById('hubert-widget') ||
      window.HubertWidget ||
      document.querySelector('script[src*="hubert-widget"]')
    ) {
      return;
    }
    var hubertCss = document.createElement('link');
    hubertCss.rel = 'stylesheet';
    hubertCss.href = href('css/hubert-widget.css?v=' + FOOTER_BUILD);
    document.head.appendChild(hubertCss);

    var hubertChat = document.createElement('script');
    hubertChat.src = href('js/hubert-chat.js?v=' + FOOTER_BUILD);
    hubertChat.onload = function () {
      if (document.getElementById('hubert-widget') || window.HubertWidget) return;
      if (document.querySelector('script[src*="hubert-widget.js"]')) return;
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
