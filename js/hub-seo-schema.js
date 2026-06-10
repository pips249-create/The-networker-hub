/**
 * Injects JSON-LD from Hubert knowledge for SEO & AEO.
 * Requires js/hub-seo-data.js (run scripts/build-hub-seo-data.js after FAQ changes).
 */
(function () {
  if (!window.HUB_SEO_DATA) return;

  function detectPage() {
    var navScript = document.querySelector('script[data-page]');
    if (navScript) {
      var page = navScript.getAttribute('data-page');
      if (page === 'home') return 'home';
      if (page === 'faq') return 'faq';
      if (page === 'contact') return 'contact';
      if (page === 'about') return 'about';
    }
    var path = (window.location.pathname || '').toLowerCase();
    if (/\/faq\.html$/.test(path)) return 'faq';
    if (/\/contact\.html$/.test(path)) return 'contact';
    if (/\/about\.html$/.test(path)) return 'about';
    if (/index\.html$/.test(path) || /\/$/.test(path)) return 'home';
    return '';
  }

  function injectSchema(data) {
    if (!data) return;
    var el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute('data-hubert-seo', 'true');
    el.textContent = JSON.stringify(data);
    document.head.appendChild(el);
  }

  var page = detectPage();
  var schemas = window.HUB_SEO_DATA.schemas || {};
  if (page && schemas[page]) {
    injectSchema(schemas[page]);
    return;
  }

  if (schemas.home && schemas.home['@graph']) {
    injectSchema({
      '@context': 'https://schema.org',
      '@graph': [schemas.home['@graph'][0]],
    });
  }
})();
