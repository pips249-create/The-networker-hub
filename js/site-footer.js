/**
 * Shared site footer — same block on every public page.
 * FOOTER_BUILD=20260609
 */
(function () {
  var FOOTER_BUILD = '20260609';
  var script = document.currentScript;
  var root = (script && script.getAttribute('data-root')) || '';

  function href(path) {
    return root + path;
  }

  var mount = document.getElementById('hub-site-footer');
  if (!mount) return;

  mount.innerHTML =
    '<footer class="site-footer">' +
    '<div class="footer-inner">' +
    '<a href="' +
    href('index.html') +
    '" class="footer-brand" aria-label="Home">' +
    '<img class="footer-logo" src="' +
    href('assets/logo.png') +
    '" alt="" width="160" height="60">' +
    '</a>' +
    '<div class="footer-columns">' +
    '<div class="footer-col">' +
    '<p class="footer-col-title">Explore</p>' +
    '<nav class="footer-col-links" aria-label="Explore">' +
    '<a href="' +
    href('events/index.html') +
    '">Events</a>' +
    '<a href="' +
    href('training/index.html') +
    '">Training</a>' +
    '<a href="' +
    href('opportunities/index.html') +
    '">Opportunities</a>' +
    '</nav>' +
    '</div>' +
    '<div class="footer-col">' +
    '<p class="footer-col-title">Company</p>' +
    '<nav class="footer-col-links" aria-label="Company">' +
    '<a href="' +
    href('about.html') +
    '">About us</a>' +
    '<a href="' +
    href('faq.html') +
    '">FAQ</a>' +
    '<a href="' +
    href('contact.html') +
    '">Contact</a>' +
    '</nav>' +
    '</div>' +
    '<div class="footer-col">' +
    '<p class="footer-col-title">Legal</p>' +
    '<nav class="footer-col-links" aria-label="Legal">' +
    '<a href="' +
    href('legal-policies.html') +
    '">Legal &amp; policies</a>' +
    '<a href="' +
    href('legal-policies.html#privacy') +
    '">Privacy</a>' +
    '<a href="' +
    href('legal-policies.html#terms') +
    '">Terms</a>' +
    '<a href="' +
    href('legal-policies.html#refunds') +
    '">Refunds</a>' +
    '<a href="' +
    href('legal-policies.html#cookies') +
    '">Cookies</a>' +
    '<button type="button" class="footer-cookie-settings" id="footer-cookie-settings">Cookie settings</button>' +
    '</nav>' +
    '</div>' +
    '</div>' +
    '<p class="footer-copy">' +
    '© ' +
    new Date().getFullYear() +
    ' The Networker Group Ltd · Registered in England &amp; Wales (Company No. 15252227) · VAT No. 454 4092 94<br>' +
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
})();
