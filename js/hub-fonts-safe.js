/**
 * Prevent Google Font load failures from surfacing as unhandled rejections.
 * Pages already fall back to metric-adjusted system fonts in hub.css.
 */
(function () {
  if (window.__hubFontsSafe) return;
  window.__hubFontsSafe = true;

  try {
    if (document.fonts && document.fonts.ready && document.fonts.ready.catch) {
      document.fonts.ready.catch(function () {
        /* non-fatal */
      });
    }
  } catch (_e) {
    /* ignore */
  }
})();
