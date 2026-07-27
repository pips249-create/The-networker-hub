/**
 * City / region discovery links on detail pages — "More events in Manchester →"
 */
(function (global) {
  function slugFromTexts(texts) {
    if (!global.hubNetworkingRegionSlugFromInput) return '';
    var list = texts || [];
    for (var i = 0; i < list.length; i++) {
      var text = String(list[i] || '').trim();
      if (!text) continue;
      var slug = global.hubNetworkingRegionSlugFromInput(text);
      if (slug && global.HUB_getNetworkingRegion && global.HUB_getNetworkingRegion(slug)) {
        return slug;
      }
    }
    return '';
  }

  function hubPath(slug, context) {
    if (context === 'opportunities') {
      return '/opportunities/networking/' + encodeURIComponent(slug);
    }
    return global.HUB_networkingRegionPath
      ? global.HUB_networkingRegionPath(slug)
      : '/networking/' + encodeURIComponent(slug);
  }

  function ctaLabel(name, context) {
    if (context === 'events') return 'More events in ' + name + ' →';
    if (context === 'organisers') return 'More networking groups in ' + name + ' →';
    if (context === 'opportunities') return 'More opportunities in ' + name + ' →';
    return 'View ' + name + ' networking hub →';
  }

  function applyDetailRegionCta(el, options) {
    if (!el) return;

    var opts = options || {};
    var context = opts.context || 'events';
    var slug = String(opts.slug || '').trim();

    if (!slug) {
      var texts = opts.locationTexts || (opts.locationText ? [opts.locationText] : []);
      slug = slugFromTexts(texts);
    }

    if (!slug) {
      el.hidden = true;
      return;
    }

    if (opts.hideOnCurrentHub !== false) {
      var regional =
        context === 'opportunities' ? global.hubOppRegionalLanding : global.hubRegionalLanding;
      if (regional && regional.slug === slug) {
        el.hidden = true;
        return;
      }
    }

    var meta = global.HUB_getNetworkingRegion ? global.HUB_getNetworkingRegion(slug) : null;
    if (!meta) {
      el.hidden = true;
      return;
    }

    el.href = hubPath(slug, context);
    el.textContent = opts.label || ctaLabel(meta.name, context);
    el.hidden = false;
  }

  global.HUB_slugFromLocationTexts = slugFromTexts;
  global.HUB_applyDetailRegionCta = applyDetailRegionCta;
})(typeof window !== 'undefined' ? window : globalThis);
