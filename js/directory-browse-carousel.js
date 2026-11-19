/**
 * Shared Directory carousel — one CMS pool (events_browse_carousel_ads),
 * shuffled independently on Events, Opportunities, and Organisers browse.
 */
(function (global) {
  var SLOT = 'events_browse_carousel_ads';
  var PLACEMENT = 'events_browse_carousel';
  var POOL_MAX = 50;
  var BOOK_HREF = '/advertising#ad-pkg-events-directory-carousel';
  var CARD_SEL = '.premium-card';

  var poolCache = null;
  var loadPromise = null;
  var instances = [];

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function shuffleList(list) {
    var arr = (list || []).slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function availableCardHtml() {
    return (
      '<article class="premium-card events-ad-card events-ad-card--available">' +
      '<div class="events-ad-card-inner">' +
      '<a class="events-ad-card-available-panel" href="' +
      escapeHtml(BOOK_HREF) +
      '">' +
      '<span class="events-ad-card-available-kicker">Available</span>' +
      '<span class="events-ad-card-available-title">Put your logo here for thousands to see each month</span>' +
      '<span class="events-ad-card-available-price">£55 <span>per month + VAT</span></span>' +
      '</a>' +
      '<a class="events-ad-card-cta events-ad-card-cta--available" href="' +
      escapeHtml(BOOK_HREF) +
      '">Book a slot</a></div></article>'
    );
  }

  function adCardHtml(ad) {
    var company = String(ad.company_name || 'Sponsored partner').trim() || 'Sponsored partner';
    var label =
      String(ad.cta_label || 'Find out more')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 5)
        .join(' ') || 'Find out more';
    var href = String(ad.cta_url || '').trim();
    var colorAttr = ad.cta_color
      ? ' data-cta-color="' + escapeHtml(ad.cta_color) + '"'
      : '';
    return (
      '<article class="premium-card events-ad-card">' +
      '<div class="events-ad-card-inner">' +
      '<a class="events-ad-card-logo" href="' +
      escapeHtml(href) +
      '" aria-label="' +
      escapeHtml(company) +
      '" data-sponsor-placement="' +
      PLACEMENT +
      '" data-sponsor-company="' +
      escapeHtml(company) +
      '">' +
      '<img src="' +
      escapeHtml(ad.logo_url) +
      '" alt=""></a>' +
      '<a class="events-ad-card-cta" href="' +
      escapeHtml(href) +
      '" data-sponsor-placement="' +
      PLACEMENT +
      '" data-sponsor-company="' +
      escapeHtml(company) +
      '"' +
      colorAttr +
      '>' +
      escapeHtml(label) +
      '</a></div></article>'
    );
  }

  function paintCtaColor(card) {
    if (!card || !global.CmsSponsorFields || !global.CmsSponsorFields.applyCtaColor) return;
    var cta = card.querySelector('.events-ad-card-cta');
    var img = card.querySelector('.events-ad-card-logo img');
    if (!cta) return;
    var stored = String(cta.getAttribute('data-cta-color') || '').trim();
    if (stored) {
      global.CmsSponsorFields.applyCtaColor(cta, stored);
      return;
    }
    if (!img || !global.CmsSponsorFields.sampleLogoColorHex) return;

    function applyFrom(sampleImg) {
      var hex = global.CmsSponsorFields.sampleLogoColorHex(sampleImg);
      if (hex) global.CmsSponsorFields.applyCtaColor(cta, hex);
    }

    var src = String(img.currentSrc || img.src || '').trim();
    if (!src) return;
    if (/^data:/i.test(src)) {
      if (img.complete && img.naturalWidth) applyFrom(img);
      else img.addEventListener('load', function () { applyFrom(img); }, { once: true });
      return;
    }
    var probe = new Image();
    probe.crossOrigin = 'anonymous';
    probe.onload = function () {
      applyFrom(probe);
    };
    probe.src = src;
  }

  function cardStep(track) {
    if (!track) return 220;
    var card = track.querySelector(CARD_SEL);
    if (!card) return 220;
    var gap = parseFloat(getComputedStyle(track).gap) || 14;
    return card.getBoundingClientRect().width + gap;
  }

  function createInstance(root) {
    var section = root.querySelector('.events-browse-ads-panel') || root.querySelector('.premium-spotlight') || root;
    var track =
      root.querySelector('[data-directory-carousel-track]') ||
      root.querySelector('.spotlight-track');
    var prev =
      root.querySelector('[data-directory-carousel-prev]') ||
      root.querySelector('.spotlight-nav button:first-of-type');
    var next =
      root.querySelector('[data-directory-carousel-next]') ||
      root.querySelector('.spotlight-nav button:last-of-type');
    var wrap = root.querySelector('.spotlight-wrap');

    var itemCount = 0;
    var cardsHtml = '';
    var bound = false;
    var animating = false;
    var autoTimer = null;
    var pointerPaused = false;
    var touchResumeTimer = null;

    function stopAuto() {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
      }
    }

    function startAuto() {
      stopAuto();
      if (!track || itemCount <= 1 || pointerPaused) return;
      if (global.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      autoTimer = setInterval(function () {
        advance(1);
      }, 4200);
    }

    function syncLoop() {
      var sc = global.HubSpotlightCarousel;
      if (!sc || !track) return;
      var loopWidth = parseFloat(track.dataset.loopWidth) || sc.measureLoopWidth(track, itemCount, CARD_SEL);
      sc.syncLoopScroll(track, loopWidth, itemCount, CARD_SEL);
    }

    function layout() {
      var sc = global.HubSpotlightCarousel;
      if (!sc || !track) return;
      sc.applyLoopLayout(track, section, itemCount, CARD_SEL, cardsHtml, {
        loop: true,
        loopOnTouch: true,
      });
      if (itemCount > 1 && sc.setNavArrowsVisible) {
        sc.setNavArrowsVisible(section, true);
      }
    }

    function advance(dir) {
      dir = dir < 0 ? -1 : 1;
      var sc = global.HubSpotlightCarousel;
      if (!track || itemCount <= 1 || animating) return;
      animating = true;
      stopAuto();
      var step = cardStep(track) * dir;
      var looping = sc && sc.isLooping(track);
      var loopWidth =
        looping && sc
          ? parseFloat(track.dataset.loopWidth) || sc.measureLoopWidth(track, itemCount, CARD_SEL)
          : 0;
      var reduceMotion = global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var behavior = reduceMotion ? 'auto' : 'smooth';

      if (looping && loopWidth > 0) {
        if (dir < 0 && track.scrollLeft <= 4) track.scrollLeft = loopWidth;
        track.scrollBy({ left: step, behavior: behavior });
      } else if (sc) {
        sc.advanceNonLoop(track, dir, step, behavior);
      } else {
        track.scrollBy({ left: step, behavior: behavior });
      }

      setTimeout(function () {
        syncLoop();
        animating = false;
        startAuto();
      }, reduceMotion ? 0 : 380);
    }

    function bindNav() {
      if (bound) return;
      bound = true;

      function pause() {
        pointerPaused = true;
        stopAuto();
      }
      function resume(delayMs) {
        pointerPaused = false;
        clearTimeout(touchResumeTimer);
        touchResumeTimer = setTimeout(function () {
          startAuto();
        }, delayMs || 0);
      }

      if (prev) prev.addEventListener('click', function () { advance(-1); });
      if (next) next.addEventListener('click', function () { advance(1); });
      if (wrap) {
        wrap.addEventListener('mouseenter', pause);
        wrap.addEventListener('mouseleave', function () { resume(0); });
        wrap.addEventListener('touchstart', pause, { passive: true });
        wrap.addEventListener('touchend', function () { resume(2400); }, { passive: true });
      }
      global.addEventListener('resize', function () {
        if (!track || !itemCount) return;
        var sc = global.HubSpotlightCarousel;
        if (track.children.length && sc && typeof sc.remeasureLayout === 'function') {
          var wasLooping = sc.isLooping(track);
          var prefersSimple = global.matchMedia('(hover: none), (max-width: 768px)').matches;
          if (wasLooping && prefersSimple) layout();
          else sc.remeasureLayout(track, section, itemCount, CARD_SEL);
          syncLoop();
          return;
        }
        layout();
        syncLoop();
        startAuto();
      });
    }

    function paint(ads) {
      if (!track) return;
      var list = shuffleList((Array.isArray(ads) ? ads : []).slice(0, POOL_MAX));
      var showAvailable = list.length < POOL_MAX;
      var cards = list.map(adCardHtml);
      if (showAvailable) {
        var insertAt = Math.floor(Math.random() * (cards.length + 1));
        cards.splice(insertAt, 0, availableCardHtml());
      }
      cardsHtml = cards.join('');
      itemCount = list.length + (showAvailable ? 1 : 0);
      root.hidden = false;
      track.classList.add('spotlight-track--carousel');
      bindNav();
      layout();

      if (global.CmsSponsorFields) {
        track.querySelectorAll('.events-ad-card-logo, .events-ad-card-cta').forEach(function (el) {
          if (!el.getAttribute('data-sponsor-placement')) return;
          global.CmsSponsorFields.applyCtaLink(el, el.getAttribute('href'), {
            placement: PLACEMENT,
            company: el.getAttribute('data-sponsor-company') || '',
            campaign: PLACEMENT,
          });
        });
        track.querySelectorAll('.events-ad-card:not(.events-ad-card--available)').forEach(function (card) {
          paintCtaColor(card);
          var logo = card.querySelector('.events-ad-card-logo');
          var company = logo && logo.getAttribute('data-sponsor-company');
          if (logo && global.CmsSponsorFields.trackSponsorImpression) {
            global.CmsSponsorFields.trackSponsorImpression(PLACEMENT, company, {
              el: logo,
              path: global.location && global.location.pathname,
            });
          }
        });
      }

      syncLoop();
      startAuto();
    }

    return { paint: paint, root: root };
  }

  function mount(root) {
    if (!root || root.getAttribute('data-directory-carousel-mounted') === '1') {
      for (var i = 0; i < instances.length; i++) {
        if (instances[i].root === root) return instances[i];
      }
      return null;
    }
    root.setAttribute('data-directory-carousel-mounted', '1');
    var inst = createInstance(root);
    instances.push(inst);
    return inst;
  }

  function mountAll() {
    document.querySelectorAll('[data-directory-browse-carousel]').forEach(function (root) {
      mount(root);
    });
    return instances;
  }

  function fetchPool(forceReload) {
    if (poolCache && !forceReload) return Promise.resolve(poolCache);
    if (loadPromise && !forceReload) return loadPromise;
    var load =
      global.CmsAdBlocks && global.CmsAdBlocks.loadCarouselAds
        ? global.CmsAdBlocks.loadCarouselAds(SLOT)
        : Promise.resolve([]);
    loadPromise = load
      .then(function (ads) {
        poolCache = Array.isArray(ads) ? ads : [];
        loadPromise = null;
        return poolCache;
      })
      .catch(function () {
        loadPromise = null;
        poolCache = poolCache || [];
        return poolCache;
      });
    return loadPromise;
  }

  /**
   * Mount every root and paint each with an independent shuffle of the shared pool.
   */
  function loadAll(forceReload) {
    mountAll();
    if (!instances.length) return Promise.resolve([]);
    return fetchPool(!!forceReload).then(function (ads) {
      instances.forEach(function (inst) {
        inst.paint(ads);
      });
      return ads;
    });
  }

  global.HubDirectoryBrowseCarousel = {
    SLOT: SLOT,
    PLACEMENT: PLACEMENT,
    POOL_MAX: POOL_MAX,
    shuffleList: shuffleList,
    mount: mount,
    mountAll: mountAll,
    loadAll: loadAll,
  };
})(typeof window !== 'undefined' ? window : this);
