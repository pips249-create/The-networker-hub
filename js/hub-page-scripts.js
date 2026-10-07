/**
 * Load a page's deferred scripts from one tag (keeps HTML request counts down for
 * scanners; preserves order). List absolute or root-relative paths in data-scripts,
 * separated by | (pipe). Optional data-attrs is JSON: { "pathSubstring": { "data-root": ".." } }.
 */
(function () {
  // defer/async scripts leave document.currentScript null — find our tag by src + data-scripts.
  var boot =
    document.currentScript ||
    document.querySelector('script[src*="hub-page-scripts.js"][data-scripts]');
  if (!boot) return;

  var list = String(boot.getAttribute('data-scripts') || '')
    .split('|')
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);

  var attrMap = {};
  try {
    attrMap = JSON.parse(boot.getAttribute('data-attrs') || '{}') || {};
  } catch (err) {
    attrMap = {};
  }

  function attrsFor(src) {
    var keys = Object.keys(attrMap);
    for (var i = 0; i < keys.length; i++) {
      if (src.indexOf(keys[i]) !== -1) return attrMap[keys[i]];
    }
    return null;
  }

  // Insert with async=false so the browser downloads in parallel but runs in list order
  // (same dependency order as the previous explicit <script defer> tags).
  list.forEach(function (src) {
    var el = document.createElement('script');
    el.src = src;
    el.async = false;
    var extra = attrsFor(src);
    if (extra) {
      Object.keys(extra).forEach(function (key) {
        el.setAttribute(key, extra[key]);
      });
    }
    el.onerror = function () {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[hub-page-scripts] Failed to load', src);
      }
    };
    document.body.appendChild(el);
  });
})();
