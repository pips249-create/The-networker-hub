/**
 * Injects JSON-LD from Hubert knowledge for SEO & AEO.
 * Requires js/hub-seo-data.js (run scripts/build-hub-seo-data.js after FAQ changes).
 */
(function () {
  if (!window.HUB_SEO_DATA) return;

  function detectPage() {
    var staticScript = document.querySelector('script[src*="hub-seo-static"]');
    if (staticScript) {
      var staticPage = staticScript.getAttribute('data-page');
      if (staticPage) return staticPage;
    }

    var navScript = document.querySelector('script[data-page][src*="site-nav"]');
    if (navScript) {
      var page = navScript.getAttribute('data-page');
      if (page === 'home') return 'home';
      if (page === 'faq') return 'faq';
      if (page === 'guides') return 'guides';
      if (page && page.indexOf('guide-') === 0) return page;
      if (page === 'help-organiser-payouts') return 'help-organiser-payouts';
      if (page === 'help-pricing-fees') return 'help-pricing-fees';
      if (page === 'contact') return 'contact';
      if (page === 'about') return 'about';
      if (page === 'events') return 'events';
      if (page === 'opportunities') return 'opportunities';
      if (page === 'legal') return 'legal';
    }

    var path = (window.location.pathname || '').toLowerCase();
    if (/\/events\/(?:index\.html)?$/.test(path) || /\/events\/?$/.test(path)) return 'events';
    if (/\/opportunities\//.test(path)) return 'opportunities';
    if (/\/guides\.html$/.test(path)) return 'guides';
    if (/\/guides\/list-an-event\.html$/.test(path)) return 'guide-list-an-event';
    if (/\/guides\/list-a-conference-or-exhibition\.html$/.test(path)) return 'guide-list-a-conference-or-exhibition';
    if (/\/guides\/list-a-business-opportunity\.html$/.test(path)) return 'guide-list-a-business-opportunity';
    if (/\/guides\/invite-your-team\.html$/.test(path)) return 'guide-invite-your-team';
    if (/\/faq\.html$/.test(path)) return 'faq';
    if (/\/help\/organiser-payouts(?:\.html)?\/?$/.test(path)) return 'help-organiser-payouts';
    if (/\/help\/pricing-fees(?:\.html)?\/?$/.test(path)) return 'help-pricing-fees';
    if (/\/contact\.html$/.test(path)) return 'contact';
    if (/\/about\.html$/.test(path)) return 'about';
    if (/\/legal-policies\.html$/.test(path)) return 'legal';
    if (/index\.html$/.test(path) || /\/$/.test(path)) return 'home';
    return '';
  }

  function injectSchema(data) {
    if (!data) return;
    if (document.querySelector('script[data-hubert-seo="static"]')) return;
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
