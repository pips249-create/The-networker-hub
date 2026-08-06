/**
 * Home page — scroll reveals and home page partners strip.
 */
(function () {
  /** Live Powered by heroes — always shown in the home partners strip when published. */
  var LIVE_HERO_SLOTS = [
    'events_sponsor_hub',
    'organisers_sponsor_hub',
    'opportunities_sponsor_hub',
  ];
  var activePartnersScroller = null;

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function sponsorLogo(block) {
    if (window.CmsSponsorFields && window.CmsSponsorFields.logoUrl) {
      return window.CmsSponsorFields.logoUrl(block);
    }
    return String((block && (block.logo_url || block.image_url)) || '').trim();
  }

  function sponsorCompany(block) {
    if (window.CmsSponsorFields && window.CmsSponsorFields.companyName) {
      return window.CmsSponsorFields.companyName(block);
    }
    return String((block && block.company_name) || '').trim();
  }

  function sponsorCta(block) {
    var url = String((block && block.cta_url) || '').trim();
    if (/^(https?:|mailto:)/i.test(url)) return url;
    return '';
  }

  function partnerNeedsDarkBand(name, flagged) {
    if (flagged) return true;
    // Light-on-dark wordmark with a baked navy plate (same rule as sponsor packs).
    return /barnsgate/i.test(String(name || ''));
  }

  function partnerFromSponsorBlock(block) {
    var name = sponsorCompany(block) || 'Partner';
    return {
      name: name,
      logo: sponsorLogo(block),
      url: sponsorCta(block),
      label: String((block && block.cta_label) || '').trim() || 'Visit website',
      logoBandDark: partnerNeedsDarkBand(
        name,
        !!(block && (block.logo_band_dark === true || block.logoBandDark === true))
      ),
    };
  }

  function addUniquePartner(list, seen, row) {
    if (!row || !row.logo) return;
    var logoKey = String(row.logo).trim().toLowerCase();
    var nameKey = String(row.name || '')
      .trim()
      .toLowerCase();
    if (!logoKey || seen.has('logo:' + logoKey)) return;
    if (nameKey && seen.has('name:' + nameKey)) return;
    seen.add('logo:' + logoKey);
    if (nameKey) seen.add('name:' + nameKey);
    list.push(row);
  }

  function initHeroEntrance() {
    var hero = document.querySelector('.home-hero');
    if (!hero) return;

    hero.classList.add('is-visible');

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      hero.classList.add('is-entered');
      return;
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        hero.classList.add('is-entered');
      });
    });
  }

  function initReveal() {
    var sections = document.querySelectorAll('.home-reveal:not(.home-hero):not([hidden])');
    if (!sections.length) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sections.forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    if (!window.IntersectionObserver) {
      sections.forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -5% 0px' }
    );

    sections.forEach(function (el) {
      io.observe(el);
    });
  }

  function fetchCmsSlot(slot) {
    return fetch('/api/cms-block?slot=' + encodeURIComponent(slot), { cache: 'no-store' })
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return null;
      });
  }

  function partnerFromRow(p) {
    var name = String(p.company_name || '').trim() || 'Partner';
    return {
      name: name,
      logo: String(p.logo_url || '').trim(),
      url: String(p.cta_url || '').trim(),
      label: String(p.cta_label || '').trim() || 'Visit website',
      logoBandDark: partnerNeedsDarkBand(
        name,
        p.logo_band_dark === true || p.logoBandDark === true
      ),
    };
  }

  function partnerItemHtml(p) {
    var darkClass = p.logoBandDark ? ' home-partner-item--dark-logo' : '';
    var taggedUrl =
      window.CmsSponsorFields && window.CmsSponsorFields.withSponsorUtm
        ? window.CmsSponsorFields.withSponsorUtm(p.url, 'home_partners', { campaign: 'home_partners' })
        : p.url;
    var inner =
      '<img src="' +
      esc(p.logo) +
      '" alt="' +
      esc(p.name) +
      '" loading="lazy" decoding="async" class="home-partner-logo" onerror="this.closest(\'.home-partner-item\').hidden=true" />';
    var title = esc(p.name);
    if (/^(https?:|mailto:)/i.test(taggedUrl)) {
      return (
        '<a class="home-partner-item' +
        darkClass +
        '" href="' +
        esc(taggedUrl) +
        '" target="_blank" rel="noopener noreferrer" title="' +
        title +
        '" data-sponsor-placement="home_partners" data-sponsor-company="' +
        title +
        '"' +
        (p.logoBandDark ? ' data-logo-band-dark="true"' : '') +
        '>' +
        inner +
        '</a>'
      );
    }
    return (
      '<div class="home-partner-item' +
      darkClass +
      '" title="' +
      title +
      '"' +
      (p.logoBandDark ? ' data-logo-band-dark="true"' : '') +
      '>' +
      inner +
      '</div>'
    );
  }

  function enhancePartnerLogoBands(track) {
    if (!track) return;
    track.querySelectorAll('.home-partner-item[data-sponsor-placement]').forEach(function (item) {
      if (!window.CmsSponsorFields || !window.CmsSponsorFields.applyCtaLink) return;
      var company =
        item.getAttribute('data-sponsor-company') || item.getAttribute('title') || '';
      window.CmsSponsorFields.applyCtaLink(item, item.getAttribute('href') || '', {
        placement: item.getAttribute('data-sponsor-placement') || 'home_partners',
        company: company,
        campaign: 'home_partners',
      });
      if (window.CmsSponsorFields.trackSponsorImpression) {
        window.CmsSponsorFields.trackSponsorImpression('home_partners', company, { el: item });
      }
    });
    // Uniform white/navy tiles only — never brand edge colours. Dark when CMS
    // flags it, the name is Barnsgate, or the logo file itself has a dark plate.
    if (!window.CmsSponsorFields || !window.CmsSponsorFields.applyLogoBand) {
      track.querySelectorAll('.home-partner-item').forEach(function (item) {
        var forceDark = item.getAttribute('data-logo-band-dark') === 'true';
        var name =
          item.getAttribute('data-sponsor-company') || item.getAttribute('title') || '';
        item.classList.toggle(
          'home-partner-item--dark-logo',
          partnerNeedsDarkBand(name, forceDark)
        );
      });
      return;
    }
    track.querySelectorAll('.home-partner-item').forEach(function (item) {
      var img = item.querySelector('.home-partner-logo');
      if (!img) return;
      img.removeAttribute('crossOrigin');
      var name =
        item.getAttribute('data-sponsor-company') || item.getAttribute('title') || '';
      var forceDark = partnerNeedsDarkBand(
        name,
        item.getAttribute('data-logo-band-dark') === 'true'
      );
      function apply() {
        window.CmsSponsorFields.applyLogoBand(item, img, true, {
          forceDark: forceDark,
          uniformTiles: true,
        });
        item.classList.toggle(
          'home-partner-item--dark-logo',
          forceDark || item.classList.contains('sponsor-logo-band--dark')
        );
      }
      if (forceDark) apply();
      if (img.complete && img.naturalWidth) apply();
      else img.addEventListener('load', apply, { once: true });
    });
  }

  function revealSection(section) {
    if (!section) return;
    section.hidden = false;
    section.classList.add('is-visible');
  }

  function teardownPartnersScroller() {
    if (!activePartnersScroller) return;
    var state = activePartnersScroller;
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.listeners.forEach(function (listener) {
      listener.target.removeEventListener(listener.type, listener.fn, listener.opts);
    });
    activePartnersScroller = null;
  }

  function setupPartnersScroller(marquee, track, config) {
    teardownPartnersScroller();
    if (!marquee || !track || !config.scrollable) return;

    var state = {
      marquee: marquee,
      track: track,
      rafId: 0,
      listeners: [],
      autoScrolling: false,
      userIdleUntil: 0,
    };
    activePartnersScroller = state;

    marquee.setAttribute('tabindex', '0');

    function addListener(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      state.listeners.push({ target: target, type: type, fn: fn, opts: opts });
    }

    function noteUserInteraction(durationMs) {
      state.userIdleUntil = Date.now() + (durationMs || 4000);
    }

    function loopWidth() {
      return config.loop ? track.scrollWidth / 2 : 0;
    }

    function normalizeScroll() {
      if (!config.loop) return;
      var width = loopWidth();
      if (width <= 0) return;
      if (state.marquee.scrollLeft >= width) {
        state.autoScrolling = true;
        state.marquee.scrollLeft -= width;
        state.autoScrolling = false;
      } else if (state.marquee.scrollLeft < 0) {
        state.autoScrolling = true;
        state.marquee.scrollLeft += width;
        state.autoScrolling = false;
      }
    }

    function tick() {
      if (config.autoScroll && Date.now() >= state.userIdleUntil) {
        var width = loopWidth();
        var maxScroll = config.loop
          ? width
          : Math.max(0, track.scrollWidth - marquee.clientWidth);
        if (maxScroll > 0) {
          state.autoScrolling = true;
          state.marquee.scrollLeft += config.speed || 0.6;
          if (config.loop && state.marquee.scrollLeft >= width) {
            state.marquee.scrollLeft -= width;
          } else if (!config.loop && state.marquee.scrollLeft >= maxScroll) {
            state.marquee.scrollLeft = 0;
          }
          state.autoScrolling = false;
        }
      }
      state.rafId = requestAnimationFrame(tick);
    }

    addListener(marquee, 'pointerdown', function () {
      noteUserInteraction(5000);
    });
    addListener(
      marquee,
      'touchstart',
      function () {
        noteUserInteraction(5000);
      },
      { passive: true }
    );
    addListener(
      marquee,
      'wheel',
      function () {
        noteUserInteraction(3000);
      },
      { passive: true }
    );
    addListener(marquee, 'keydown', function (e) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        noteUserInteraction(4000);
        marquee.scrollLeft -= 220;
        normalizeScroll();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        noteUserInteraction(4000);
        marquee.scrollLeft += 220;
        normalizeScroll();
      }
    });
    addListener(
      marquee,
      'scroll',
      function () {
        if (!state.autoScrolling) noteUserInteraction(4000);
        normalizeScroll();
      },
      { passive: true }
    );

    state.rafId = requestAnimationFrame(tick);
  }

  function renderPartners(partners) {
    var section = document.getElementById('home-partners');
    var track = document.getElementById('home-partners-logos');
    var marquee = document.getElementById('home-partners-marquee');
    if (!section || !track) return;

    teardownPartnersScroller();

    if (!partners.length) {
      section.hidden = true;
      track.setAttribute('aria-busy', 'false');
      if (marquee) marquee.classList.remove('home-partners-marquee--scrollable');
      return;
    }

    revealSection(section);
    track.classList.remove('home-partners-track--loading');
    track.setAttribute('aria-busy', 'false');

    var items = partners.map(partnerItemHtml).join('');
    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var useMarquee = partners.length > 1 && !prefersReducedMotion;
    var isStatic = partners.length <= 1;
    var isScrollable = !useMarquee && partners.length > 1;

    track.classList.toggle('home-partners-track--marquee', useMarquee);
    track.classList.toggle('home-partners-track--scroll', isScrollable);
    track.classList.toggle('home-partners-track--static', isStatic);
    track.innerHTML = useMarquee ? items + items : items;
    enhancePartnerLogoBands(track);

    if (marquee) {
      marquee.classList.toggle('home-partners-marquee--scrollable', isScrollable);
      marquee.scrollLeft = 0;
    }

    setupPartnersScroller(marquee, track, {
      scrollable: isScrollable,
      autoScroll: false,
      loop: false,
    });
  }

  function loadPartners() {
    var section = document.getElementById('home-partners');
    revealSection(section);

    Promise.all([fetchCmsSlot('home_partners'), Promise.all(LIVE_HERO_SLOTS.map(fetchCmsSlot))]).then(
      function (results) {
        var homeData = results[0];
        var slotResults = results[1] || [];
        var partners = [];
        var seen = new Set();

        // Live Powered by heroes first (Events / Organisers / Opportunities).
        slotResults.forEach(function (slotData) {
          if (!slotData || !slotData.ok || !slotData.block) return;
          addUniquePartner(partners, seen, partnerFromSponsorBlock(slotData.block));
        });

        // Then any extras managed under Home partners in Command Centre.
        if (homeData && homeData.ok && homeData.active !== false && Array.isArray(homeData.partners)) {
          homeData.partners.forEach(function (p) {
            addUniquePartner(partners, seen, partnerFromRow(p));
          });
        }

        renderPartners(partners);
      }
    );
  }

  function initHeroHubertForm() {
    var form = document.getElementById('home-hero-hubert-form');
    var input = document.getElementById('home-hero-hubert-input');
    var searchWrap = form ? form.closest('.home-hero-rich-search-wrap') : null;
    if (!form || !input || !searchWrap || !window.HUB_initNetworkingRegionSearch) return;

    var hero = document.querySelector('.home-hero');
    var handleSubmit = window.HUB_initNetworkingRegionSearch(input, searchWrap, {
      suggestClass: 'home-hero-search-suggest',
      onFocus: function () {
        if (hero) hero.classList.add('is-entered');
      },
      onNonCitySubmit: function (q) {
        if (!q) {
          if (window.HubertWidget && typeof window.HubertWidget.open === 'function') {
            window.HubertWidget.open();
          }
          return;
        }
        if (window.HubertWidget && typeof window.HubertWidget.ask === 'function') {
          window.HubertWidget.ask(q);
          input.value = '';
          return;
        }
        window.location.href = '/contact?q=' + encodeURIComponent(q);
      },
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (handleSubmit) handleSubmit();
    });
  }

  initHeroEntrance();
  initReveal();
  loadPartners();
  initHeroHubertForm();
})();
