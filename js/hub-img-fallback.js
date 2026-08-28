/**
 * CSP-safe replacement for inline img onerror handlers.
 * Usage: <img src="..." data-fallback-src="https://example.com/fallback.png" alt="">
 */
(function () {
  document.querySelectorAll('img[data-fallback-src]').forEach(function (img) {
    img.addEventListener('error', function () {
      if (img.dataset.fallbackApplied === '1') return;
      img.dataset.fallbackApplied = '1';
      var fallback = img.getAttribute('data-fallback-src');
      if (fallback) img.src = fallback;
    });
  });
})();
