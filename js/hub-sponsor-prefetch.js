/**
 * Start hero sponsor CMS fetch early so LCP logo discovery happens before deferred JS runs.
 * Included only on /events/ browse page.
 */
(function () {
  var params = new URLSearchParams(window.location.search);
  var slot =
    params.get('mode') === 'organisers' ? 'organisers_sponsor_hub' : 'events_sponsor_hub';
  window.hubSponsorPrefetchSlot = slot;

  window.hubSponsorBlockPromise = fetch('/api/cms-block?slot=' + encodeURIComponent(slot))
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      var block = data && data.block;
      if (block) {
        var logo = String(block.logo_url || block.image_url || '').trim();
        if (/^https?:\/\//i.test(logo)) {
          var preload = document.createElement('link');
          preload.rel = 'preload';
          preload.as = 'image';
          preload.href = logo;
          document.head.appendChild(preload);
        }
      }
      return data;
    })
    .catch(function () {
      return null;
    });
})();
