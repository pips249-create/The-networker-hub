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

  function sampleBackgroundFromImage(img) {
    try {
      var canvas = document.createElement('canvas');
      var size = 24;
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, size, size);
      var data = ctx.getImageData(0, 0, size, size).data;
      var r = 0;
      var g = 0;
      var b = 0;
      var n = 0;
      for (var i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 40) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
      if (!n) return null;
      return (
        'rgb(' +
        Math.round(r / n) +
        ',' +
        Math.round(g / n) +
        ',' +
        Math.round(b / n) +
        ')'
      );
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

  function applyCtaLink(el, url) {
    if (!el) return;
    var u = String(url || '').trim();
    if (/^https?:\/\//i.test(u)) {
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
    } else {
      el.removeAttribute('target');
      el.removeAttribute('rel');
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

  function applyLogoBand(wrap, img, hasLogo) {
    if (!wrap) return;
    wrap.classList.add('sponsor-logo-band');
    wrap.classList.toggle('has-logo', Boolean(hasLogo));

    if (!hasLogo || !img) {
      wrap.style.backgroundColor = '';
      return;
    }

    img.classList.add('sponsor-logo--full');

    function paint() {
      var bg = sampleBackgroundFromImage(img);
      wrap.style.backgroundColor = bg || '#f3f4f6';
    }

    if (img.complete && img.naturalWidth) paint();
    else {
      img.addEventListener('load', paint, { once: true });
      img.addEventListener(
        'error',
        function () {
          wrap.style.backgroundColor = '#f3f4f6';
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
    isLogoUrl: isLogoUrl,
    sanitizeCtaColor: sanitizeCtaColor,
    sampleLogoColorHex: sampleLogoColorHex,
    ctaColor: ctaColor,
    ctaTextOnBg: ctaTextOnBg,
    applyCtaColor: applyCtaColor,
    applyCtaLink: applyCtaLink,
    applyLogoBand: applyLogoBand,
  };
})();
