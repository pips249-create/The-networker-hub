/**
 * Home page — scroll reveals and home page partners strip.
 */
(function () {
  /** Dark-on-transparent Barnsgate mark for white partner tiles (CMS often stores the navy-plate PNG). */
  var BARNSGATE_LIGHT_LOGO = '/assets/sponsors/barnsgate-logo-on-light.svg?v=20260806light';
  var activePartnersScroller = null;

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function isBarnsgatePartner(name, url) {
    return /barnsgate/i.test(String(name || '')) || /barnsgate[-_]?logo/i.test(String(url || ''));
  }

  function partnerNeedsDarkBand(_name, flagged) {
    return !!flagged;
  }

  function partnerLogoForStrip(url, name) {
    var u = String(url || '').trim();
    // Navy-plate Barnsgate assets look boxed on white tiles — use the light-bg mark.
    if (isBarnsgatePartner(name, u)) return BARNSGATE_LIGHT_LOGO;
    return u;
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
    return fetch('/api/cms-block?slot=' + encodeURIComponent(slot))
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return null;
      });
  }

  function partnerFromRow(p) {
    var name = String(p.company_name || '').trim() || 'Partner';
    var logo = partnerLogoForStrip(String(p.logo_url || '').trim(), name);
    var flaggedDark = p.logo_band_dark === true || p.logoBandDark === true;
    if (logo === BARNSGATE_LIGHT_LOGO) flaggedDark = false;
    return {
      name: name,
      logo: logo,
      url: String(p.cta_url || '').trim(),
      label: String(p.cta_label || '').trim() || 'Visit website',
      logoBandDark: partnerNeedsDarkBand(name, flaggedDark),
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
    // Uniform white/navy tiles only — never brand edge colours. Skip dark band
    // for the Barnsgate light-bg strip mark (CMS may still flag logo_band_dark).
    if (!window.CmsSponsorFields || !window.CmsSponsorFields.applyLogoBand) {
      track.querySelectorAll('.home-partner-item').forEach(function (item) {
        var img = item.querySelector('.home-partner-logo');
        var src = img ? img.getAttribute('src') || '' : '';
        var forceDark =
          item.getAttribute('data-logo-band-dark') === 'true' &&
          src.indexOf('barnsgate-logo-on-light') === -1;
        item.classList.toggle('home-partner-item--dark-logo', forceDark);
      });
      return;
    }
    track.querySelectorAll('.home-partner-item').forEach(function (item) {
      var img = item.querySelector('.home-partner-logo');
      if (!img) return;
      img.removeAttribute('crossOrigin');
      var src = img.getAttribute('src') || '';
      var lightBarnsgate = src.indexOf('barnsgate-logo-on-light') !== -1;
      var forceDark =
        !lightBarnsgate && item.getAttribute('data-logo-band-dark') === 'true';
      function apply() {
        if (lightBarnsgate) {
          item.style.backgroundColor = '';
          item.classList.remove(
            'sponsor-logo-band',
            'sponsor-logo-band--dark',
            'home-partner-item--dark-logo'
          );
          return;
        }
        window.CmsSponsorFields.applyLogoBand(item, img, true, {
          forceDark: forceDark,
          uniformTiles: true,
        });
        item.classList.toggle(
          'home-partner-item--dark-logo',
          forceDark || item.classList.contains('sponsor-logo-band--dark')
        );
      }
      if (forceDark || lightBarnsgate) apply();
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
    track.style.setProperty(
      '--home-marquee-duration',
      useMarquee ? Math.max(60, Math.round(partners.length * 3.8)) + 's' : ''
    );
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

    fetchCmsSlot('home_partners')
      .then(function (homeData) {
        var partners = [];
        var seen = new Set();
        if (homeData && homeData.ok && homeData.active !== false && Array.isArray(homeData.partners)) {
          homeData.partners.forEach(function (p) {
            addUniquePartner(partners, seen, partnerFromRow(p));
          });
        }
        renderPartners(partners);
      })
      .catch(function () {
        renderPartners([]);
      });
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

  function foundingItemHtml(org) {
    var name = String(org.name || 'Organiser').trim() || 'Organiser';
    var href = String(org.href || org.website || '').trim();
    var photo = String(org.photoUrl || '').trim();
    var initial = name.charAt(0).toUpperCase();
    var external = /^https?:\/\//i.test(href);
    var darkClass = org.logoBandDark ? ' home-partner-item--dark-logo' : '';
    var inner;
    if (photo) {
      // No fallback initial in the DOM while the logo is present — CSS `display`
      // on .home-founding-initial was overriding [hidden] and showing giant letters.
      inner =
        '<img src="' +
        esc(photo) +
        '" alt="' +
        esc(name) +
        '" loading="lazy" decoding="async" class="home-partner-logo" onerror="this.remove();var s=document.createElement(\'span\');s.className=\'home-founding-initial\';s.setAttribute(\'aria-hidden\',\'true\');s.textContent=this.alt?this.alt.charAt(0).toUpperCase():\'?\';this.parentElement.classList.add(\'home-founding-item--fallback\');this.parentElement.classList.remove(\'home-partner-item--dark-logo\');this.parentElement.appendChild(s);" />';
    } else {
      inner =
        '<span class="home-founding-initial" aria-hidden="true">' + esc(initial) + '</span>';
    }
    var fallbackClass = photo ? '' : ' home-founding-item--fallback';
    var title = esc(name);
    if (href) {
      return (
        '<a class="home-partner-item home-founding-item' +
        darkClass +
        fallbackClass +
        '" href="' +
        esc(href) +
        '"' +
        (external ? ' target="_blank" rel="noopener noreferrer"' : '') +
        ' title="' +
        title +
        '">' +
        inner +
        '</a>'
      );
    }
    return (
      '<div class="home-partner-item home-founding-item' +
      darkClass +
      fallbackClass +
      '" title="' +
      title +
      '">' +
      inner +
      '</div>'
    );
  }

  function splitFoundingRows(list) {
    var rowA = [];
    var rowB = [];
    var countA = {};
    var countB = {};
    (list || []).forEach(function (org) {
      var key = foundingBrandKey(org);
      var a = countA[key] || 0;
      var b = countB[key] || 0;
      // Prefer the shorter row, but keep same-brand chapters off the same row when possible.
      var preferA =
        a < b || (a === b && rowA.length <= rowB.length);
      if (preferA) {
        rowA.push(org);
        countA[key] = a + 1;
      } else {
        rowB.push(org);
        countB[key] = b + 1;
      }
    });
    if (rowA.length > rowB.length + 1 && rowB.length) {
      rowB.push(rowA.pop());
    }
    return {
      rowA: spreadFoundingLogos(rowA),
      rowB: spreadFoundingLogos(rowB),
    };
  }

  /** Group key so regional chapters that share a logo (e.g. Women in Property) can be spaced out. */
  function foundingBrandKey(org) {
    var n = String((org && org.name) || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    if (/women\s*in\s*property/.test(n)) return 'brand:women-in-property';
    if (/women\s*in\s*the\s*law/.test(n)) return 'brand:women-in-the-law';
    if (/women\s*mean\s*business|\bwmb\b|womenmeanbiz/.test(n)) return 'brand:wmb';
    if (org && org.id) return 'id:' + org.id;
    return 'name:' + n;
  }

  /**
   * Homepage strip: one tile per shared brand logo (Women in Property chapters share artwork).
   */
  function dedupeFoundingBrandLogos(list) {
    var seen = {};
    var out = [];
    (list || []).forEach(function (org) {
      var key = foundingBrandKey(org);
      if (key.indexOf('brand:') !== 0) {
        out.push(org);
        return;
      }
      if (seen[key]) return;
      seen[key] = true;
      // Prefer a chapter that has a logo URL when collapsing.
      var best = org;
      if (!String(org.photoUrl || '').trim()) {
        var withPhoto = (list || []).find(function (o) {
          return foundingBrandKey(o) === key && String(o.photoUrl || '').trim();
        });
        if (withPhoto) best = withPhoto;
      }
      // Display as the parent brand when collapsing Women in Property chapters.
      if (key === 'brand:women-in-property') {
        best = Object.assign({}, best, { name: 'Women in Property' });
      }
      out.push(best);
    });
    return out;
  }

  /**
   * Spread lookalike / same-brand logos so they are not clumped in the marquee
   * (Women in Property chapters were sitting next to each other).
   */
  function spreadFoundingLogos(list) {
    var items = (list || []).slice();
    if (items.length < 3) return items;

    var buckets = {};
    var brandOrder = [];
    items.forEach(function (org) {
      var key = foundingBrandKey(org);
      if (!buckets[key]) {
        buckets[key] = [];
        brandOrder.push(key);
      }
      buckets[key].push(org);
    });

    var multiBrand = brandOrder.some(function (k) {
      return buckets[k].length > 1;
    });
    if (!multiBrand) return items;

    var out = [];
    var lastBrand = '';
    var remaining = items.length;
    while (remaining > 0) {
      var candidates = brandOrder
        .filter(function (k) {
          return buckets[k].length > 0;
        })
        .sort(function (a, b) {
          return buckets[b].length - buckets[a].length;
        });
      if (!candidates.length) break;

      var pick = candidates[0];
      if (pick === lastBrand && candidates.length > 1) {
        pick = candidates[1];
      }
      out.push(buckets[pick].shift());
      lastBrand = pick;
      remaining -= 1;
    }
    return out;
  }

  function paintFoundingTrack(track, marquee, orgs, opts) {
    opts = opts || {};
    if (!track) return;
    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var useMarquee = orgs.length >= 4 && !prefersReducedMotion;
    var items = orgs.map(foundingItemHtml).join('');
    var seconds = useMarquee ? Math.max(36, Math.round(orgs.length * 4.2)) : '';

    track.classList.remove('home-partners-track--loading');
    track.classList.toggle('home-partners-track--marquee', useMarquee);
    track.classList.toggle('home-partners-track--marquee-reverse', Boolean(useMarquee && opts.reverse));
    track.classList.toggle('home-partners-track--scroll', false);
    track.classList.toggle('home-partners-track--static', !useMarquee);
    track.innerHTML = useMarquee ? items + items : items;
    if (seconds) track.style.setProperty('--home-marquee-duration', seconds + 's');
    else track.style.removeProperty('--home-marquee-duration');

    if (marquee) {
      marquee.hidden = false;
      marquee.classList.remove('home-partners-marquee--scrollable');
      marquee.scrollLeft = 0;
      marquee.setAttribute('tabindex', '-1');
    }
  }

  function renderFoundingOrganisers(list) {
    var section = document.getElementById('home-founding');
    var track = document.getElementById('home-founding-logos');
    var trackB = document.getElementById('home-founding-logos-b');
    var marquee = document.getElementById('home-founding-marquee');
    var marqueeB = document.getElementById('home-founding-marquee-b');
    var wrap = document.getElementById('home-founding-marquees');
    if (!section || !track) return;

    if (!list.length) {
      section.hidden = true;
      track.setAttribute('aria-busy', 'false');
      if (marquee) marquee.classList.remove('home-partners-marquee--scrollable');
      if (marqueeB) marqueeB.hidden = true;
      if (wrap) wrap.classList.remove('home-founding-marquees--dual');
      return;
    }

    revealSection(section);
    track.setAttribute('aria-busy', 'false');

    var spaced = spreadFoundingLogos(dedupeFoundingBrandLogos(list));

    // Two rows once we have enough logos — halves the loop length so the strip doesn't crawl.
    var useDual = spaced.length >= 8 && trackB && marqueeB;
    if (wrap) wrap.classList.toggle('home-founding-marquees--dual', useDual);

    if (useDual) {
      var rows = splitFoundingRows(spaced);
      paintFoundingTrack(track, marquee, rows.rowA, { reverse: false });
      paintFoundingTrack(trackB, marqueeB, rows.rowB, { reverse: true });
      trackB.setAttribute('aria-hidden', 'true');
    } else {
      paintFoundingTrack(track, marquee, spaced, { reverse: false });
      if (marqueeB) marqueeB.hidden = true;
      if (trackB) {
        trackB.innerHTML = '';
        trackB.classList.remove(
          'home-partners-track--marquee',
          'home-partners-track--marquee-reverse',
          'home-partners-track--static'
        );
      }
    }
  }

  function loadFoundingOrganisers() {
    var section = document.getElementById('home-founding');
    var track = document.getElementById('home-founding-logos');
    if (!section || !track) return;

    fetch('/api/founding-organisers')
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var list = data && data.ok && Array.isArray(data.organisers) ? data.organisers : [];
        renderFoundingOrganisers(list);
      })
      .catch(function () {
        renderFoundingOrganisers([]);
      });
  }

  initHeroEntrance();
  initReveal();
  loadPartners();
  loadFoundingOrganisers();
  initHeroHubertForm();
})();