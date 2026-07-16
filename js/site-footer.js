/**
 * Shared site footer — same block on every public page.
 * FOOTER_BUILD=20260714u
 */
(function () {
  var FOOTER_BUILD = '20260714u';
  var script = document.currentScript;
  var root = (script && script.getAttribute('data-root')) || '';

  function href(path) {
    if (!path) return root || '/';
    if (path.charAt(0) === '/' || /^(https?:|mailto:|tel:)/i.test(path)) return path;
    return root + path;
  }

  var mount = document.getElementById('hub-site-footer');
  if (!mount) return;

  mount.innerHTML =
    '<footer class="site-footer">' +
    '<div class="footer-inner">' +
    '<a href="' +
    href('/') +
    '" class="footer-brand" aria-label="Home">' +
    '<img class="footer-logo" src="' +
    href('/assets/logo.png') +
    '" alt="" width="160" height="60">' +
    '</a>' +
    '<div class="footer-columns">' +
    '<div class="footer-col">' +
    '<p class="footer-col-title">Explore</p>' +
    '<nav class="footer-col-links" aria-label="Explore">' +
    '<a href="' +
    href('/events/') +
    '">Events</a>' +
    '<a href="' +
    href('/opportunities/') +
    '">Opportunities</a>' +
    '</nav>' +
    '</div>' +
    '<div class="footer-col">' +
    '<p class="footer-col-title">Help</p>' +
    '<nav class="footer-col-links" aria-label="Help">' +
    '<a href="' +
    href('/faq') +
    '">FAQ</a>' +
    '<a href="' +
    href('/for-organisers') +
    '">For Organisers</a>' +
    '<a href="' +
    href('/guides') +
    '">Organiser guides</a>' +
    '<a href="' +
    href('/contact') +
    '">Contact us</a>' +
    '</nav>' +
    '</div>' +
    '<div class="footer-col">' +
    '<p class="footer-col-title">Company</p>' +
    '<nav class="footer-col-links" aria-label="Company">' +
    '<a href="' +
    href('/about') +
    '">About us</a>' +
    '<a href="' +
    href('/advertising') +
    '">Advertising</a>' +
    '</nav>' +
    '</div>' +
    '<div class="footer-col">' +
    '<p class="footer-col-title">Legal</p>' +
    '<nav class="footer-col-links" aria-label="Legal">' +
    '<a href="' +
    href('/legal-policies') +
    '">Legal &amp; policies</a>' +
    '<a href="' +
    href('/legal-policies#privacy') +
    '">Privacy</a>' +
    '<a href="' +
    href('/legal-policies#terms') +
    '">Terms</a>' +
    '<a href="' +
    href('/legal-policies#hub-rules') +
    '">Hub rules</a>' +
    '<a href="' +
    href('/legal-policies#refunds') +
    '">Refunds</a>' +
    '<a href="' +
    href('/legal-policies#cookies') +
    '">Cookies</a>' +
    '<button type="button" class="footer-cookie-settings" id="footer-cookie-settings">Cookie settings</button>' +
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
})();
