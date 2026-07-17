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

  function initHeroCitySearch(input, searchWrap, onNonCitySubmit) {
    if (!input || !searchWrap) return;

    var hero = document.querySelector('.home-hero');
    var resolveSlug = window.HUB_resolveNetworkingRegionSlug;
    var searchRegions = window.HUB_searchNetworkingRegions;
    var regionPath = window.HUB_networkingRegionPath;
    var suggestTimer = null;
    var activeIndex = -1;
    var currentItems = [];
    var list = null;

    function escAttr(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
    }

    function hideSuggest() {
      if (!list) return;
      list.hidden = true;
      list.innerHTML = '';
      activeIndex = -1;
      currentItems = [];
      input.setAttribute('aria-expanded', 'false');
    }

    function ensureSuggestList() {
      if (list) return list;
      list = document.createElement('ul');
      list.id = input.id + '-suggest';
      list.className = 'home-hero-search-suggest';
      list.setAttribute('role', 'listbox');
      list.hidden = true;
      searchWrap.appendChild(list);
      return list;
    }

    function navigateToRegion(slug) {
      if (!slug || !regionPath) return;
      hideSuggest();
      window.location.href = regionPath(slug);
    }

    function handleSubmit() {
      var q = String(input.value || '').trim();
      if (!q) {
        if (onNonCitySubmit) onNonCitySubmit(q);
        return;
      }
      var slug = resolveSlug ? resolveSlug(q) : '';
      if (slug) {
        navigateToRegion(slug);
        return;
      }
      if (onNonCitySubmit) onNonCitySubmit(q);
    }

    function renderSuggest(items) {
      ensureSuggestList();
      if (!list) return;
      currentItems = items;
      if (!items.length) {
        hideSuggest();
        return;
      }
      list.innerHTML = items
        .map(function (item, i) {
          return (
            '<li role="option" data-index="' +
            i +
            '" data-slug="' +
            escAttr(item.slug) +
            '" tabindex="-1">' +
            escAttr(item.name) +
            '</li>'
          );
        })
        .join('');
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    function refreshSuggest() {
      if (!searchRegions) return;
      var q = String(input.value || '').trim();
      if (q.length < 2) {
        hideSuggest();
        return;
      }
      renderSuggest(searchRegions(q, 8));
    }

    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', input.id + '-suggest');

    input.addEventListener('focus', function () {
      if (hero) hero.classList.add('is-entered');
      if (String(input.value || '').trim().length >= 2) refreshSuggest();
    });

    input.addEventListener('input', function () {
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(refreshSuggest, 180);
    });

    input.addEventListener('keydown', function (e) {
      if (!list || list.hidden || !currentItems.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, currentItems.length - 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        navigateToRegion(currentItems[activeIndex].slug);
        return;
      } else if (e.key === 'Escape') {
        hideSuggest();
        return;
      } else {
        return;
      }
      Array.prototype.forEach.call(list.children, function (li, i) {
        li.classList.toggle('is-active', i === activeIndex);
      });
      var active = list.children[activeIndex];
      if (active) active.scrollIntoView({ block: 'nearest' });
    });

    searchWrap.addEventListener('mousedown', function (e) {
      var li = e.target.closest('.home-hero-search-suggest li[role="option"]');
      if (!li) return;
      e.preventDefault();
      var slug = li.getAttribute('data-slug');
      if (slug) navigateToRegion(slug);
    });

    document.addEventListener('click', function (e) {
      if (e.target === input || (list && list.contains(e.target))) return;
      hideSuggest();
    });

    return handleSubmit;
  }

  function initHeroHubertForm() {
    var form = document.getElementById('home-hero-hubert-form');
    var input = document.getElementById('home-hero-hubert-input');
    var searchWrap = form ? form.closest('.home-hero-rich-search-wrap') : null;
    if (!form || !input || !searchWrap) return;

    var handleSubmit = initHeroCitySearch(input, searchWrap, function (q) {
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
