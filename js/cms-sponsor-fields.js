/**
 * Sponsor Hub field helpers — subtitle/image_url vs title/logo_url schema variants.
 */
(function () {
  var DEFAULT_CTA_COLOR = '#2d2636';

  function tagline(block) {
    if (!block) return '';
    var title = String(block.title || '').trim();
    if (title && title.toLowerCase() !== 'sponsor hub' && title.toLowerCase() !== 'powered by') return title;
    var subtitle = String(block.subtitle || '').trim();
    if (subtitle) return subtitle;
    var temp = document.createElement('div');
    temp.innerHTML = String(block.body || '');
    var h3 = temp.querySelector('h3');
    return h3 ? h3.textContent.trim() : '';
  }

  function logoUrl(block) {
    if (!block) return '';
    return String(block.logo_url || block.image_url || '').trim();
  }

  function companyName(block) {
    if (!block) return '';
    return String(block.company_name || '').trim();
  }

  function isLogoUrl(url) {
    var u = String(url || '').trim();
    return /^(https?:|\/|data:image\/)/i.test(u);
  }

  var LOGO_BAND_DARK = '#1a1a2e';
  var LOGO_BAND_LIGHT = '#f3f4f6';

  function pixelLuminance(r, g, b) {
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  function sampleLogoBandColor(img) {
    try {
      var canvas = document.createElement('canvas');
      var size = 48;
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, size, size);
      var data = ctx.getImageData(0, 0, size, size).data;
      var edgeR = 0;
      var edgeG = 0;
      var edgeB = 0;
      var edgeN = 0;
      var bright = 0;
      var dark = 0;
      var total = 0;

      for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++) {
          var i = (y * size + x) * 4;
          if (data[i + 3] < 40) continue;
          var pr = data[i];
          var pg = data[i + 1];
          var pb = data[i + 2];
          var lum = pixelLuminance(pr, pg, pb);
          total++;
          if (lum > 0.92) bright++;
          if (lum < 0.35) dark++;
          var onEdge = x < 4 || y < 4 || x >= size - 4 || y >= size - 4;
          if (onEdge) {
            edgeR += pr;
            edgeG += pg;
            edgeB += pb;
            edgeN++;
          }
        }
      }

      if (!total) return null;

      var bgR = edgeN ? edgeR / edgeN : 0;
      var bgG = edgeN ? edgeG / edgeN : 0;
      var bgB = edgeN ? edgeB / edgeN : 0;
      var bgLum = pixelLuminance(bgR, bgG, bgB);
      var brightRatio = bright / total;
      var darkRatio = dark / total;

      if (bgLum > 0.72 && brightRatio > 0.08 && darkRatio < 0.12) {
        return { color: LOGO_BAND_DARK, dark: true };
      }

      if (!edgeN) return { color: LOGO_BAND_LIGHT, dark: false };
      return {
        color:
          'rgb(' +
          Math.round(bgR) +
          ',' +
          Math.round(bgG) +
          ',' +
          Math.round(bgB) +
          ')',
        dark: false,
      };
    } catch (e) {
      return null;
    }
  }

  function rgbToHex(r, g, b) {
    function part(v) {
      var h = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return h.length === 1 ? '0' + h : h;
    }
    return '#' + part(r) + part(g) + part(b);
  }

  /**
   * Sample a brand colour from a logo image, for auto-filling the CTA button colour.
   * Prefers saturated pixels (skips transparent, near-white, and grey ones) so a logo
   * on a white background still yields its brand colour; falls back to the overall
   * average. Returns '#rrggbb' or '' when sampling fails (e.g. cross-origin taint).
   */
  function sampleLogoColorHex(img) {
    try {
      var canvas = document.createElement('canvas');
      var size = 48;
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.drawImage(img, 0, 0, size, size);
      var data = ctx.getImageData(0, 0, size, size).data;
      var r = 0;
      var g = 0;
      var b = 0;
      var n = 0;
      var allR = 0;
      var allG = 0;
      var allB = 0;
      var allN = 0;
      for (var i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 40) continue;
        var pr = data[i];
        var pg = data[i + 1];
        var pb = data[i + 2];
        allR += pr;
        allG += pg;
        allB += pb;
        allN++;
        var mx = Math.max(pr, pg, pb);
        var mn = Math.min(pr, pg, pb);
        if (mx > 245 && mn > 235) continue;
        if (mx - mn < 28) continue;
        r += pr;
        g += pg;
        b += pb;
        n++;
      }
      if (n > 0 && n >= allN * 0.02) return rgbToHex(r / n, g / n, b / n);
      if (allN > 0) return rgbToHex(allR / allN, allG / allN, allB / allN);
      return '';
    } catch (e) {
      return '';
    }
  }

  function sanitizeCtaColor(color) {
    var c = String(color || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(c)) {
      return ('#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]).toLowerCase();
    }
    return '';
  }

  function ctaColor(block) {
    if (!block) return '';
    return sanitizeCtaColor(block.cta_color);
  }

  function ctaTextOnBg(hex) {
    var safe = sanitizeCtaColor(hex);
    if (!safe) return '#ffffff';
    var r = parseInt(safe.slice(1, 3), 16);
    var g = parseInt(safe.slice(3, 5), 16);
    var b = parseInt(safe.slice(5, 7), 16);
    var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.62 ? '#2d2636' : '#ffffff';
  }

  function withSponsorUtm(rawUrl, placement, opts) {
    var url = String(rawUrl || '').trim();
    if (!/^https?:\/\//i.test(url)) return url;
    try {
      var parsed = new URL(url, window.location.origin);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return url;
      var place = String(placement || (opts && opts.placement) || 'sponsor')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64) || 'sponsor';
      var source = String((opts && opts.source) || 'thenetworkerhub').trim().slice(0, 64) || 'thenetworkerhub';
      var medium = String((opts && opts.medium) || 'sponsor').trim().slice(0, 64) || 'sponsor';
      var campaign = String((opts && opts.campaign) || place).trim().slice(0, 64) || place;
      if (!parsed.searchParams.has('utm_source')) parsed.searchParams.set('utm_source', source);
      if (!parsed.searchParams.has('utm_medium')) parsed.searchParams.set('utm_medium', medium);
      if (!parsed.searchParams.has('utm_campaign')) parsed.searchParams.set('utm_campaign', campaign);
      if (!parsed.searchParams.has('utm_content') && place) {
        parsed.searchParams.set('utm_content', place);
      }
      return parsed.toString();
    } catch (e) {
      return url;
    }
  }

  function trackSponsorClick(placement, company, meta) {
    var place = String(placement || 'sponsor').slice(0, 64);
    var brand = String(company || '').slice(0, 64);
    var dest =
      (meta && (meta.url || meta.href)) ||
      '';
    try {
      if (window.HubAnalytics && typeof window.HubAnalytics.track === 'function') {
        window.HubAnalytics.track('sponsor_click', {
          slot: place,
          brand: brand,
        });
      }
    } catch (e) {
      /* optional */
    }
    try {
      var payload = {
        action: 'record_click',
        placement: place,
        company: brand,
        url: String(dest || '').slice(0, 500),
        path: String((meta && meta.path) || (window.location && window.location.pathname) || '').slice(
          0,
          200
        ),
      };
      fetch('/api/sponsor-analytics', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(function () {});
    } catch (e2) {
      /* optional first-party log */
    }
  }

  function applyCtaLink(el, url, opts) {
    if (!el) return;
    var placement = opts && opts.placement ? opts.placement : el.getAttribute('data-sponsor-placement') || '';
    var company = opts && opts.company ? opts.company : el.getAttribute('data-sponsor-company') || '';
    var u = withSponsorUtm(String(url || '').trim() || el.getAttribute('href') || '', placement, opts);
    if (u) el.href = u;
    if (placement) el.setAttribute('data-sponsor-placement', placement);
    if (company) el.setAttribute('data-sponsor-company', company);
    if (/^https?:\/\//i.test(u)) {
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
    } else {
      el.removeAttribute('target');
      el.removeAttribute('rel');
    }
    if (!el.__hubSponsorClickBound) {
      el.__hubSponsorClickBound = true;
      el.addEventListener('click', function () {
        trackSponsorClick(
          el.getAttribute('data-sponsor-placement') || placement,
          el.getAttribute('data-sponsor-company') || company,
          {
            url: el.href || '',
            path: window.location && window.location.pathname,
          }
        );
      });
    }
  }

  function applyCtaColor(el, color) {
    if (!el) return;
    var safe = sanitizeCtaColor(color);
    if (!safe) {
      el.classList.remove('cms-cta--custom');
      el.style.removeProperty('--sponsor-cta-bg');
      el.style.removeProperty('--sponsor-cta-fg');
      return;
    }
    el.classList.add('cms-cta--custom');
    el.style.setProperty('--sponsor-cta-bg', safe);
    el.style.setProperty('--sponsor-cta-fg', ctaTextOnBg(safe));
  }

  function isHeroLogoWrap(wrap) {
    return !!(
      wrap &&
      wrap.closest('.sponsor-hub--in-hero.sponsor-hub--logo-only, .sponsor-hub--in-hero.sponsor-hub--active')
    );
  }

  function logoBandDark(block) {
    return !!(block && block.logo_band_dark === true);
  }

  function logoBandForceDark(wrap, opts) {
    if (opts && opts.forceDark === true) return true;
    return !!(wrap && wrap.getAttribute('data-logo-band-dark') === 'true');
  }

  function applyDarkLogoBand(wrap) {
    wrap.style.backgroundColor = LOGO_BAND_DARK;
    wrap.classList.add('sponsor-logo-band--dark');
  }

  function applyLogoBand(wrap, img, hasLogo, opts) {
    if (!wrap) return;
    wrap.classList.add('sponsor-logo-band');
    wrap.classList.toggle('has-logo', Boolean(hasLogo));

    if (!hasLogo || !img) {
      wrap.style.backgroundColor = '';
      wrap.classList.remove('sponsor-logo-band--dark');
      return;
    }

    img.classList.add('sponsor-logo--full');
    if (!/^data:/i.test(String(img.src || ''))) {
      img.crossOrigin = 'anonymous';
    }

    function paint() {
      if (logoBandForceDark(wrap, opts)) {
        applyDarkLogoBand(wrap);
        return;
      }
      var band = sampleLogoBandColor(img);
      if (!band && isHeroLogoWrap(wrap)) {
        band = { color: LOGO_BAND_DARK, dark: true };
      }
      wrap.style.backgroundColor = (band && band.color) || LOGO_BAND_LIGHT;
      wrap.classList.toggle('sponsor-logo-band--dark', !!(band && band.dark));
    }

    if (img.complete && img.naturalWidth) paint();
    else {
      img.addEventListener('load', paint, { once: true });
      img.addEventListener(
        'error',
        function () {
          if (logoBandForceDark(wrap, opts) || isHeroLogoWrap(wrap)) {
            applyDarkLogoBand(wrap);
          } else {
            wrap.style.backgroundColor = LOGO_BAND_LIGHT;
            wrap.classList.remove('sponsor-logo-band--dark');
          }
        },
        { once: true }
      );
    }
  }

  window.CmsSponsorFields = {
    DEFAULT_CTA_COLOR: DEFAULT_CTA_COLOR,
    tagline: tagline,
    logoUrl: logoUrl,
    companyName: companyName,
    logoBandDark: logoBandDark,
    isLogoUrl: isLogoUrl,
    sanitizeCtaColor: sanitizeCtaColor,
    sampleLogoColorHex: sampleLogoColorHex,
    ctaColor: ctaColor,
    ctaTextOnBg: ctaTextOnBg,
    applyCtaColor: applyCtaColor,
    applyCtaLink: applyCtaLink,
    applyLogoBand: applyLogoBand,
    withSponsorUtm: withSponsorUtm,
    trackSponsorClick: trackSponsorClick,
  };
})();
