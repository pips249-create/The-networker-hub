/**
 * Home page — scroll reveals and home page partners strip.
 */
(function () {
  var SPONSOR_FALLBACK_SLOTS = [
    'events_sponsor_hub',
    'organisers_sponsor_hub',
    'opportunities_sponsor_hub',
    'sponsor_hub',
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
    var sections = document.querySelectorAll('.home-reveal:not(.home-hero)');
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
    return fetch('/api/cms-block?slot=' + encodeURIComponent(slot))
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return null;
      });
  }

  function partnerFromRow(p) {
    return {
      name: String(p.company_name || '').trim() || 'Partner',
      logo: String(p.logo_url || '').trim(),
      url: String(p.cta_url || '').trim(),
      label: String(p.cta_label || '').trim() || 'Visit website',
    };
  }

  function partnerItemHtml(p) {
    var inner =
      '<img src="' +
      esc(p.logo) +
      '" alt="' +
      esc(p.name) +
      '" loading="lazy" decoding="async" class="home-partner-logo" onerror="this.closest(\'.home-partner-item\').hidden=true" />';
    var title = esc(p.name) + (p.url ? ' — ' + esc(p.label) : '');
    if (/^(https?:|mailto:)/i.test(p.url)) {
      return (
        '<a class="home-partner-item" href="' +
        esc(p.url) +
        '" target="_blank" rel="noopener noreferrer" title="' +
        title +
        '">' +
        inner +
        '</a>'
      );
    }
    return '<div class="home-partner-item" title="' + title + '">' + inner + '</div>';
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
    var isMobile = window.matchMedia('(max-width: 640px)').matches;
    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var useMarquee = !isMobile && partners.length > 3 && !prefersReducedMotion;
    var isStatic = !useMarquee && !isMobile && partners.length <= 3;
    var isScrollable = !isStatic && partners.length > 1;

    track.classList.toggle('home-partners-track--marquee', useMarquee);
    track.classList.toggle('home-partners-track--scroll', isScrollable);
    track.classList.toggle('home-partners-track--static', isStatic);
    track.innerHTML = useMarquee ? items + items : items;

    if (marquee) {
      marquee.classList.toggle('home-partners-marquee--scrollable', isScrollable);
      marquee.scrollLeft = 0;
    }

    setupPartnersScroller(marquee, track, {
      scrollable: isScrollable,
      autoScroll: useMarquee,
      loop: useMarquee,
      speed: 0.6,
    });
  }

  function loadPartners() {
    var section = document.getElementById('home-partners');
    revealSection(section);

    fetchCmsSlot('home_partners').then(function (data) {
      var partners = [];
      var seen = new Set();

      if (data && data.ok && data.active !== false && Array.isArray(data.partners)) {
        data.partners.forEach(function (p) {
          var row = partnerFromRow(p);
          if (!row.logo || seen.has(row.logo)) return;
          seen.add(row.logo);
          partners.push(row);
        });
      }

      if (partners.length) {
        renderPartners(partners);
        return;
      }

      return Promise.all(SPONSOR_FALLBACK_SLOTS.map(fetchCmsSlot)).then(function (results) {
        results.forEach(function (slotData) {
          if (!slotData || !slotData.ok || !slotData.block) return;
          var row = {
            name: sponsorCompany(slotData.block) || 'Partner',
            logo: sponsorLogo(slotData.block),
            url: sponsorCta(slotData.block),
            label: String(slotData.block.cta_label || '').trim() || 'Visit website',
          };
          if (!row.logo || seen.has(row.logo)) return;
          seen.add(row.logo);
          partners.push(row);
        });
        renderPartners(partners);
      });
    });
  }

  function initHeroSearch() {
    var form = document.getElementById('home-hero-search');
    var input = document.getElementById('home-hero-search-input');
    var hero = document.querySelector('.home-hero');
    if (!form || !input) return;

    input.addEventListener('focus', function () {
      if (hero) hero.classList.add('is-entered');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = String(input.value || '').trim();
      window.location.href = q
        ? '/events/?q=' + encodeURIComponent(q) + '#results'
        : '/events/#results';
    });
  }

  initHeroEntrance();
  initReveal();
  loadPartners();
  initHeroSearch();
})();
