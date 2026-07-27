/**
 * Vercel Web Analytics — load only after cookie consent.
 */
(function () {
  window.HubAnalytics = {
    loaded: false,
    load: function () {
      if (this.loaded) return;
      var host = String(window.location.hostname || '').toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
        this.loaded = true;
        return;
      }
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
        /* non-fatal — analytics optional in preview/local */
      };
      document.head.appendChild(insights);
    },
  };
})();
