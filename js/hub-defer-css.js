/**
 * Load non-critical stylesheets without blocking first paint (CSP-safe — no inline handlers).
 * Separate hrefs with | (pipe) — commas appear inside Google Fonts URLs.
 */
(function () {
  var script = document.currentScript;
  var hrefs = String((script && script.getAttribute('data-hrefs')) || '')
    .split('|')
    .map(function (href) {
      return href.trim();
    })
    .filter(Boolean);

  hrefs.forEach(function (href) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  });
})();
