/**
 * Vercel Web Analytics — load only after cookie consent.
 */
(function () {
  window.HubAnalytics = {
    loaded: false,
    load: function () {
      if (this.loaded) return;
      this.loaded = true;
      if (!window.va) {
        window.va = function () {
          (window.vaq = window.vaq || []).push(arguments);
        };
      }
      var insightsSrc = '/_vercel/insights/script.js';
      if (document.head.querySelector('script[src*="insights/script.js"]')) return;
      var insights = document.createElement('script');
      insights.src = insightsSrc;
      insights.defer = true;
      insights.dataset.sdkn = '@vercel/analytics';
      insights.dataset.sdkv = '2.0.1';
      insights.onerror = function () {
        console.log(
          '[Vercel Web Analytics] Failed to load ' +
            insightsSrc +
            '. Enable Web Analytics in Vercel and redeploy.'
        );
      };
      document.head.appendChild(insights);
    },
  };
})();
