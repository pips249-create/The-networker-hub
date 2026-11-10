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
      var sumLum = 0;

      for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++) {
          var i = (y * size + x) * 4;
          if (data[i + 3] < 40) continue;
          var pr = data[i];
          var pg = data[i + 1];
          var pb = data[i + 2];
          var lum = pixelLuminance(pr, pg, pb);
          total++;
          sumLum += lum;
          // Near-white logos AND cream/tan wordmarks (e.g. Plate & Post) need a dark pad.
          if (lum > 0.68) bright++;
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

      var meanLum = sumLum / total;
      var bgR = edgeN ? edgeR / edgeN : 0;
      var bgG = edgeN ? edgeG / edgeN : 0;
      var bgB = edgeN ? edgeB / edgeN : 0;
      var bgLum = edgeN ? pixelLuminance(bgR, bgG, bgB) : meanLum;
      var brightRatio = bright / total;
      var darkRatio = dark / total;

      // Light / cream artwork on transparent or white — prefer a dark surround.
      // Transparent PNGs often have no edge pixels; use overall luminance instead.
      if (darkRatio < 0.12 && brightRatio > 0.06) {
        if (meanLum > 0.58 || bgLum > 0.72 || !edgeN) {
          return { color: LOGO_BAND_DARK, dark: true, darkSurface: false };
        }
      }

      if (bgLum > 0.72 && brightRatio > 0.08 && darkRatio < 0.12) {
        return { color: LOGO_BAND_DARK, dark: true, darkSurface: false };
      }

      if (!edgeN) return { color: LOGO_BAND_LIGHT, dark: false, darkSurface: false };

      // Logo file already has a dark (or brand-coloured) baked background.
      var darkSurface = bgLum < 0.42;
      return {
        color: darkSurface
          ? LOGO_BAND_DARK
          : 'rgb(' +
            Math.round(bgR) +
            ',' +
            Math.round(bgG) +
            ',' +
            Math.round(bgB) +
            ')',
        dark: darkSurface,
        darkSurface: darkSurface,
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
      var bestScore = -1;
      var bestR = 0;
      var bestG = 0;
      var bestB = 0;
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
        var sat = mx - mn;
        var lum = pixelLuminance(pr, pg, pb);
        /* Skip near-white / near-black / grey — keep the punchiest brand colour. */
        if (mx > 245 && mn > 235) continue;
        if (lum < 0.08 || lum > 0.92) continue;
        if (sat < 28) continue;
        var score = sat * (1 - Math.abs(lum - 0.45));
        if (score > bestScore) {
          bestScore = score;
          bestR = pr;
          bestG = pg;
          bestB = pb;
        }
      }
      if (bestScore >= 0) return rgbToHex(bestR, bestG, bestB);
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

  function impressionKey(placement, company) {
    return (
      'hub_sp_imp_' +
      String(placement || '').slice(0, 40) +
      '_' +
      String(company || '').slice(0, 40) +
      '_' +
      new Date().toISOString().slice(0, 10)
    );
  }

  function postSponsorImpression(placement, company, meta) {
    var place = String(placement || 'sponsor').slice(0, 64);
    var brand = String(company || '').slice(0, 64);
    if (!place) return;
    try {
      fetch('/api/sponsor-analytics', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record_impression',
          placement: place,
          company: brand,
          path: String(
            (meta && meta.path) || (window.location && window.location.pathname) || ''
          ).slice(0, 200),
        }),
        keepalive: true,
      }).catch(function () {});
    } catch (e2) {
      /* optional */
    }
  }

  function isDirectoryHeroPlacement(placement) {
    var p = String(placement || '');
    return (
      p === 'events_hero' ||
      p === 'organisers_hero' ||
      p === 'opportunities_hero' ||
      p === 'events_sponsor_hub' ||
      p === 'organisers_sponsor_hub' ||
      p === 'opportunities_sponsor_hub' ||
      p === 'sponsor_hub'
    );
  }

  function oncePerPageLoadKey(placement, company) {
    return String(placement || '') + '|' + String(company || '');
  }

  /**
   * Directory heroes (e.g. /events/): count each page view while the sponsor is live.
   * Other placements: count when visible, at most once per tab per day.
   */
  function trackSponsorImpression(placement, company, meta) {
    var place = String(placement || (meta && meta.placement) || 'sponsor').slice(0, 64);
    var brand = String(company || (meta && meta.company) || '').slice(0, 64);
    var el = meta && meta.el ? meta.el : null;
    if (!place) return;

    if (meta && meta.preview === true) return;
    if (
      el &&
      (el.closest('.ad-live-preview') ||
        el.closest('[data-pitch-preview-panel]') ||
        el.getAttribute('data-sponsor-preview') === 'true')
    ) {
      return;
    }

    function fire() {
      postSponsorImpression(place, brand, meta);
    }

    // Events / organisers / opportunities directory: one count per page load.
    if (isDirectoryHeroPlacement(place) || (meta && meta.pageView === true)) {
      try {
        window.__hubSponsorPageViews = window.__hubSponsorPageViews || {};
        var navKey = oncePerPageLoadKey(place, brand);
        if (window.__hubSponsorPageViews[navKey]) return;
        window.__hubSponsorPageViews[navKey] = true;
      } catch (e) {
        /* ignore */
      }
      fire();
      return;
    }

    // Secondary placements (home partners, carousels): visible + once per tab/day.
    try {
      var key = impressionKey(place, brand);
      if (window.sessionStorage) {
        if (sessionStorage.getItem(key)) return;
      }
    } catch (e2) {
      /* private mode */
    }

    function fireSecondary() {
      try {
        if (window.sessionStorage) sessionStorage.setItem(impressionKey(place, brand), '1');
      } catch (e3) {
        /* ignore */
      }
      fire();
    }

    if (!el || typeof IntersectionObserver !== 'function') {
      fireSecondary();
      return;
    }
    if (el.__hubSponsorImpBound) return;
    el.__hubSponsorImpBound = true;
    try {
      var obs = new IntersectionObserver(
        function (entries) {
          for (var i = 0; i < entries.length; i++) {
            if (entries[i].isIntersecting && entries[i].intersectionRatio >= 0.35) {
              fireSecondary();
              obs.disconnect();
              break;
            }
          }
        },
        { threshold: [0.35] }
      );
      obs.observe(el);
    } catch (e4) {
      fireSecondary();
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

  function isCompactAdLogoWrap(wrap) {
    return !!(wrap && wrap.closest('.cms-ad-compact, .cms-ad-logo-only, .cms-ad-carousel'));
  }

  function prefersDarkLogoBand(img) {
    var band = sampleLogoBandColor(img);
    return !!(band && band.dark && !band.darkSurface);
  }

  /**
   * Find the content bounding box of a logo, trimming uniform edge padding
   * (solid brand plates or transparent PNG margins). Returns null when the
   * artwork already fills the frame or sampling fails.
   */
  function logoContentBox(img, opts) {
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;
    try {
      var srcW = img.naturalWidth;
      var srcH = img.naturalHeight;
      var maxProbe = (opts && opts.maxProbe) || 360;
      var scale = Math.min(1, maxProbe / Math.max(srcW, srcH));
      var w = Math.max(1, Math.round(srcW * scale));
      var h = Math.max(1, Math.round(srcH * scale));
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, w, h);
      var data = ctx.getImageData(0, 0, w, h).data;

      function sample(x, y) {
        var i = (y * w + x) * 4;
        return [data[i], data[i + 1], data[i + 2], data[i + 3]];
      }

      var corners = [
        sample(0, 0),
        sample(w - 1, 0),
        sample(0, h - 1),
        sample(w - 1, h - 1),
      ];
      var opaqueCorners = 0;
      var bgR = 0;
      var bgG = 0;
      var bgB = 0;
      var transparentEdges = 0;
      for (var c = 0; c < corners.length; c++) {
        if (corners[c][3] < 40) {
          transparentEdges++;
          continue;
        }
        opaqueCorners++;
        bgR += corners[c][0];
        bgG += corners[c][1];
        bgB += corners[c][2];
      }
      var alphaTrimOnly = transparentEdges >= 3 || opaqueCorners === 0;
      if (opaqueCorners) {
        bgR /= opaqueCorners;
        bgG /= opaqueCorners;
        bgB /= opaqueCorners;
      }

      // Reject inconsistent corner colours (gradients / photos) — unsafe to trim.
      if (!alphaTrimOnly && opaqueCorners >= 2) {
        var cornerSpread = 0;
        for (var s = 0; s < corners.length; s++) {
          if (corners[s][3] < 40) continue;
          cornerSpread = Math.max(
            cornerSpread,
            Math.abs(corners[s][0] - bgR) +
              Math.abs(corners[s][1] - bgG) +
              Math.abs(corners[s][2] - bgB)
          );
        }
        if (cornerSpread > 48) return null;
      }

      var colorThreshold = (opts && opts.colorThreshold) || 36;
      var minX = w;
      var minY = h;
      var maxX = -1;
      var maxY = -1;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var i = (y * w + x) * 4;
          var a = data[i + 3];
          if (a < 40) continue;
          if (!alphaTrimOnly) {
            var diff =
              Math.abs(data[i] - bgR) +
              Math.abs(data[i + 1] - bgG) +
              Math.abs(data[i + 2] - bgB);
            if (diff < colorThreshold) continue;
          }
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
      if (maxX < minX || maxY < minY) return null;

      var contentW = maxX - minX + 1;
      var contentH = maxY - minY + 1;
      var areaRatio = (contentW * contentH) / (w * h);
      // Already fills most of the frame — leave alone.
      if (areaRatio > 0.82) return null;
      // Tiny speck / noise — ignore.
      if (areaRatio < 0.004) return null;

      var padRatio = (opts && opts.padRatio) || 0.22;
      var padX = Math.max(2, Math.round(contentW * padRatio));
      var padY = Math.max(2, Math.round(contentH * padRatio));
      minX = Math.max(0, minX - padX);
      minY = Math.max(0, minY - padY);
      maxX = Math.min(w - 1, maxX + padX);
      maxY = Math.min(h - 1, maxY + padY);

      var sx = Math.floor(minX / scale);
      var sy = Math.floor(minY / scale);
      var sw = Math.min(srcW - sx, Math.ceil((maxX - minX + 1) / scale));
      var sh = Math.min(srcH - sy, Math.ceil((maxY - minY + 1) / scale));
      if (sw < 8 || sh < 8) return null;
      if (sw * sh > srcW * srcH * 0.92) return null;
      return { sx: sx, sy: sy, sw: sw, sh: sh };
    } catch (e) {
      return null;
    }
  }

  /**
   * Crop uniform logo padding onto a canvas data URL. Returns '' when no trim
   * is needed or canvas sampling is blocked.
   */
  function trimmedLogoDataUrl(img, opts) {
    var box = logoContentBox(img, opts);
    if (!box) return '';
    try {
      var canvas = document.createElement('canvas');
      canvas.width = box.sw;
      canvas.height = box.sh;
      var ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.drawImage(img, box.sx, box.sy, box.sw, box.sh, 0, 0, box.sw, box.sh);
      return canvas.toDataURL('image/png');
    } catch (e) {
      return '';
    }
  }

  /**
   * Replace a displayed logo with a padding-trimmed version when the source
   * has large empty margins (common on sponsor brand plates).
   */
  function fitLogoInFrame(imgEl, opts) {
    if (!imgEl || imgEl.getAttribute('data-logo-fit') === '1') return;
    var src = String(imgEl.currentSrc || imgEl.src || '').trim();
    if (!src || /^data:/i.test(src)) return;

    function applyFrom(probe) {
      var dataUrl = trimmedLogoDataUrl(probe, opts);
      imgEl.setAttribute('data-logo-fit', '1');
      if (!dataUrl) return;
      imgEl.src = dataUrl;
    }

    var useCors = true;
    try {
      useCors = new URL(src, window.location.href).origin !== window.location.origin;
    } catch (e) {
      useCors = true;
    }

    var probe = new Image();
    // Cross-origin CDN logos (Supabase) need CORS to sample; same-origin must omit it
    // or hosts without ACAO headers taint the canvas.
    if (useCors) probe.crossOrigin = 'anonymous';
    probe.onload = function () {
      applyFrom(probe);
    };
    probe.onerror = function () {
      imgEl.setAttribute('data-logo-fit', '1');
    };
    probe.src = src;
  }

  /** Filename / path cues when canvas sampling is blocked by CORS (e.g. *-white.png). */
  function logoUrlSuggestsDarkBand(url) {
    var path = String(url || '')
      .split('?')[0]
      .split('#')[0]
      .toLowerCase();
    if (!path) return false;
    return /(?:^|[\/_\-.])(?:logo[_-]?)?(?:text[_-]?)?white(?:[\/_\-.]|$)|[_-]on[_-]?dark(?:[\/_\-.]|$)|(?:^|[\/_\-.])(?:light|cream|ivory)[_-]?(?:logo|mark|wordmark)?(?:[\/_\-.]|$)|(?:logo|mark|wordmark)[_-]?(?:light|cream|ivory|white)(?:[\/_\-.]|$)/.test(
      path
    );
  }

  /**
   * Paint a logo surface dark when artwork is light (sampled or URL heuristic).
   * Returns true when a dark pad was applied.
   */
  function applyLogoSurfaceContrast(surfaceEl, imgOrUrl, opts) {
    if (!surfaceEl) return false;
    var url = '';
    var img = null;
    if (typeof imgOrUrl === 'string') {
      url = imgOrUrl;
    } else if (imgOrUrl) {
      img = imgOrUrl;
      url = img.currentSrc || img.src || '';
    }
    var forceDark = opts && opts.forceDark === true;
    var dark =
      forceDark ||
      logoUrlSuggestsDarkBand(url) ||
      (img && prefersDarkLogoBand(img));
    surfaceEl.classList.toggle('is-logo-dark', Boolean(dark));
    if (dark) {
      surfaceEl.style.backgroundColor = LOGO_BAND_DARK;
      surfaceEl.style.background = LOGO_BAND_DARK;
    } else if (opts && opts.lightColor) {
      surfaceEl.style.backgroundColor = opts.lightColor;
      surfaceEl.style.background = opts.lightColor;
    } else {
      surfaceEl.style.backgroundColor = '';
      surfaceEl.style.background = '';
    }
    return Boolean(dark);
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

    function paintFromBand(band) {
      if (logoBandForceDark(wrap, opts)) {
        applyDarkLogoBand(wrap);
        return;
      }
      // Homepage partners strip: white or navy only — never paint brand edge colours
      // (magenta/etc). Dark tile only when the logo file itself has a dark surface
      // (e.g. Barnsgate), not when a light logo would merely prefer a dark surround.
      if (opts && opts.uniformTiles) {
        if (band && band.darkSurface) applyDarkLogoBand(wrap);
        else {
          wrap.style.backgroundColor = LOGO_BAND_LIGHT;
          wrap.classList.remove('sponsor-logo-band--dark');
        }
        return;
      }
      if (!band && (isHeroLogoWrap(wrap) || isCompactAdLogoWrap(wrap))) {
        band = { color: LOGO_BAND_DARK, dark: true };
      }
      wrap.style.backgroundColor = (band && band.color) || LOGO_BAND_LIGHT;
      wrap.classList.toggle('sponsor-logo-band--dark', !!(band && band.dark));
    }

    function paint() {
      if (logoBandForceDark(wrap, opts)) {
        applyDarkLogoBand(wrap);
        return;
      }

      var src = String(img.currentSrc || img.src || '').trim();
      // Data URLs can be sampled from the visible image. Remote logos are sampled via a
      // CORS probe so we never set crossOrigin on the display <img> — hosts without ACAO
      // would otherwise fail to render entirely.
      if (!src || /^data:/i.test(src)) {
        paintFromBand(sampleLogoBandColor(img));
        return;
      }

      var probe = new Image();
      probe.crossOrigin = 'anonymous';
      probe.onload = function () {
        paintFromBand(sampleLogoBandColor(probe));
      };
      probe.onerror = function () {
        paintFromBand(null);
      };
      probe.src = src;
    }

    if (img.complete && img.naturalWidth) {
      paint();
    } else if (img.complete) {
      // Broken/empty image (often CORS) — events already fired, so fall back now.
      if (logoBandForceDark(wrap, opts) || isHeroLogoWrap(wrap) || isCompactAdLogoWrap(wrap)) {
        applyDarkLogoBand(wrap);
      } else {
        wrap.style.backgroundColor = LOGO_BAND_LIGHT;
        wrap.classList.remove('sponsor-logo-band--dark');
      }
    } else {
      img.addEventListener('load', paint, { once: true });
      img.addEventListener(
        'error',
        function () {
          if (logoBandForceDark(wrap, opts) || isHeroLogoWrap(wrap) || isCompactAdLogoWrap(wrap)) {
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
    sampleLogoBandColor: sampleLogoBandColor,
    prefersDarkLogoBand: prefersDarkLogoBand,
    logoContentBox: logoContentBox,
    trimmedLogoDataUrl: trimmedLogoDataUrl,
    fitLogoInFrame: fitLogoInFrame,
    logoUrlSuggestsDarkBand: logoUrlSuggestsDarkBand,
    applyLogoSurfaceContrast: applyLogoSurfaceContrast,
    LOGO_BAND_DARK: LOGO_BAND_DARK,
    ctaColor: ctaColor,
    ctaTextOnBg: ctaTextOnBg,
    applyCtaColor: applyCtaColor,
    applyCtaLink: applyCtaLink,
    applyLogoBand: applyLogoBand,
    withSponsorUtm: withSponsorUtm,
    trackSponsorClick: trackSponsorClick,
    trackSponsorImpression: trackSponsorImpression,
  };
})();
