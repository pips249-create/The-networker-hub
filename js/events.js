/**
 * Loads event listings from /api/hub-listings (Supabase).
 */
(function () {
  const API_PATHS = ['/api/hub-listings', '/api/events'];
  const PAGE_SIZE = 12;
  window.hubBrowsePageSize = PAGE_SIZE;

  const els = {
    status: document.getElementById('load-status'),
    featuredList: document.getElementById('featured-list'),
    spotlightTrack: document.getElementById('spotlight-track'),
    spotlightNote: document.getElementById('spotlight-note'),
    listings: document.getElementById('event-listings'),
    resultsCount: document.getElementById('results-count'),
    location: document.getElementById('location'),
  };

  let events = [];
  let currentPage = 1;
  let spotlightPremiumOrder = null;
  let spotlightFilterKey = '';
  let spotlightRenderKey = '';
  let spotlightTimer = null;
  let spotlightAnimating = false;
  let spotlightCarouselBound = false;
  const SPOTLIGHT_MAX = 12; /* sync with api/_lib/spotlight-carousel-limits.js */
  const SPOTLIGHT_AUTO_MS = 2800;

  function shuffleList(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function resetSpotlightOrder() {
    spotlightPremiumOrder = null;
    spotlightFilterKey = '';
    spotlightRenderKey = '';
  }

  window.hubResetSpotlightOrder = resetSpotlightOrder;

  function spotlightFilterSignature(featured) {
    return featured
      .map(function (ev) {
        return String(ev.id || ev.slug || ev.title || '');
      })
      .sort()
      .join('|');
  }

  function getSpotlightPremium() {
    const source =
      window.hubBrowseFeatured && window.hubBrowseFeatured.length
        ? window.hubBrowseFeatured
        : window.hubBrowseEvents && window.hubBrowseEvents.length
          ? window.hubBrowseEvents
          : window.hubAllEvents && window.hubAllEvents.length
            ? window.hubAllEvents
            : events;
    const featured = source.filter(function (ev) {
      return ev.featured;
    });
    // Server browse: spotlight cards come from data.featured. An empty featured
    // payload means filters excluded them — don't fall back to the grid page.
    if (
      window.hubServerBrowse &&
      Array.isArray(window.hubBrowseFeatured) &&
      !window.hubBrowseFeatured.length &&
      window.hubBrowseHasActiveFeatured
    ) {
      return [];
    }
    const key = spotlightFilterSignature(featured);
    if (key !== spotlightFilterKey || !spotlightPremiumOrder) {
      spotlightFilterKey = key;
      const pool =
        featured.length > SPOTLIGHT_MAX
          ? shuffleList(featured).slice(0, SPOTLIGHT_MAX)
          : shuffleList(featured);
      spotlightPremiumOrder = pool;
    }
    return spotlightPremiumOrder;
  }

  function spotlightCarouselHasOpenSlots() {
    const slots = window.hubBrowseSpotlightSlots;
    if (slots && typeof slots.full === 'boolean') return !slots.full;
    return null;
  }

  function shouldAppendSpotlightBoostPromo() {
    const premium = getSpotlightPremium();
    if (!premium.length) return false;
    const open = spotlightCarouselHasOpenSlots();
    if (open === false) return false;
    if (open === true) return true;
    return premium.length < SPOTLIGHT_MAX;
  }

  function getSpotlightTrackItemCount() {
    const premium = getSpotlightPremium();
    if (!premium.length) return 0;
    return premium.length + (shouldAppendSpotlightBoostPromo() ? 1 : 0);
  }

  function buildSpotlightTrackHtml() {
    const premium = getSpotlightPremium();
    let html = premium.map(premiumCard).join('');
    if (shouldAppendSpotlightBoostPromo()) html += spotlightBoostPromoCard();
    return html;
  }

  function spotlightRefinementNote() {
    if (!window.hubSpotlightRefinementFiltersActive) return '';
    const refinement = window.hubSpotlightRefinementFiltersActive();
    if (!refinement || !refinement.any) return '';
    const parts = [];
    if (refinement.type) parts.push('other event types');
    if (refinement.freeOnly || refinement.priceMax) parts.push('different ticket prices');
    if (!parts.length) return '';
    return (
      'Premium listings match your area and dates — they may include ' + parts.join(' and ') + '.'
    );
  }

  function renderSpotlightNote(hasPremium) {
    if (!els.spotlightNote) return;
    const note = hasPremium ? spotlightRefinementNote() : '';
    if (!note) {
      els.spotlightNote.hidden = true;
      els.spotlightNote.textContent = '';
      return;
    }
    els.spotlightNote.textContent = note;
    els.spotlightNote.hidden = false;
  }

  function stopSpotlightAuto() {
    if (spotlightTimer) {
      clearInterval(spotlightTimer);
      spotlightTimer = null;
    }
  }

  function startSpotlightAuto() {
    stopSpotlightAuto();
    if (!els.spotlightTrack) return;
    /* Auto-advance fights touch scrolling on phones and causes flicker */
    if (window.matchMedia('(hover: none), (max-width: 768px)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const itemCount = getSpotlightTrackItemCount();
    const sc = window.HubSpotlightCarousel;
    if (!sc || !sc.canAutoAdvance(els.spotlightTrack, itemCount)) return;
    spotlightTimer = window.setInterval(function () {
      if (document.hidden || spotlightAnimating) return;
      advanceSpotlight(1);
    }, SPOTLIGHT_AUTO_MS);
  }

  function getSpotlightCardStep() {
    const track = els.spotlightTrack;
    if (!track) return 274;
    const card = track.querySelector('.premium-card');
    if (!card) return 274;
    const gap = parseFloat(getComputedStyle(track).gap) || 14;
    return card.getBoundingClientRect().width + gap;
  }

  function measureSpotlightLoopWidth() {
    const sc = window.HubSpotlightCarousel;
    const track = els.spotlightTrack;
    const itemCount = getSpotlightTrackItemCount();
    if (!sc || !track || !itemCount) return 0;
    return sc.measureLoopWidth(track, itemCount, '.premium-card');
  }

  function syncSpotlightLoopScroll() {
    const sc = window.HubSpotlightCarousel;
    const track = els.spotlightTrack;
    if (!sc || !track) return;
    const loopWidth = measureSpotlightLoopWidth();
    sc.syncLoopScroll(track, loopWidth);
  }

  function layoutSpotlightTrack(cardsHtml, itemCount) {
    const sc = window.HubSpotlightCarousel;
    if (!sc || !els.spotlightTrack) return;
    const section = els.spotlightTrack.closest('.premium-spotlight');
    sc.applyLoopLayout(els.spotlightTrack, section, itemCount, '.premium-card', cardsHtml);
  }

  function refreshSpotlightLayout() {
    const itemCount = getSpotlightTrackItemCount();
    const track = els.spotlightTrack;
    if (!track || !itemCount) return;
    const sc = window.HubSpotlightCarousel;
    const section = track.closest('.premium-spotlight');
    /* Mobile URL-bar show/hide fires resize — never rewrite card HTML, only remeasure. */
    if (track.children.length && sc && typeof sc.remeasureLayout === 'function') {
      const wasLooping = sc.isLooping(track);
      const prefersSimple = window.matchMedia('(hover: none), (max-width: 768px)').matches;
      if (wasLooping && prefersSimple) {
        layoutSpotlightTrack(buildSpotlightTrackHtml(), itemCount);
      } else {
        sc.remeasureLayout(track, section, itemCount, '.premium-card');
      }
      syncSpotlightLoopScroll();
      return;
    }
    layoutSpotlightTrack(buildSpotlightTrackHtml(), itemCount);
    syncSpotlightLoopScroll();
    startSpotlightAuto();
  }

  function advanceSpotlight(dir) {
    dir = dir < 0 ? -1 : 1;
    const itemCount = getSpotlightTrackItemCount();
    const track = els.spotlightTrack;
    const sc = window.HubSpotlightCarousel;
    if (!itemCount || itemCount <= 1 || !track || spotlightAnimating) return;

    spotlightAnimating = true;
    stopSpotlightAuto();

    const step = getSpotlightCardStep() * dir;
    const looping = sc && sc.isLooping(track);
    const loopWidth =
      looping && sc
        ? parseFloat(track.dataset.loopWidth) || sc.measureLoopWidth(track, itemCount, '.premium-card')
        : 0;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = reduceMotion ? 'auto' : 'smooth';

    function finishAdvance() {
      syncSpotlightLoopScroll();
      spotlightAnimating = false;
      startSpotlightAuto();
    }

    if (looping && loopWidth > 0) {
      if (dir < 0 && track.scrollLeft <= 4) {
        track.scrollLeft = loopWidth;
      }
      track.scrollBy({ left: step, behavior: behavior });
    } else if (sc) {
      sc.advanceNonLoop(track, dir, step, behavior);
    } else {
      track.scrollBy({ left: step, behavior: behavior });
    }

    window.setTimeout(finishAdvance, reduceMotion ? 0 : 380);
  }

  function bindSpotlightCarousel() {
    if (spotlightCarouselBound) return;
    spotlightCarouselBound = true;

    const wrap = document.querySelector('.spotlight-wrap');
    const prev = document.getElementById('spotlight-prev');
    const next = document.getElementById('spotlight-next');

    if (prev) {
      prev.addEventListener('click', function () {
        advanceSpotlight(-1);
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        advanceSpotlight(1);
      });
    }
    if (wrap) {
      wrap.addEventListener('mouseenter', stopSpotlightAuto);
      wrap.addEventListener('mouseleave', startSpotlightAuto);
    }

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (!spotlightAnimating) {
          refreshSpotlightLayout();
        }
      }, 200);
    });
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function safePhotoUrl(url) {
    if (!url) return '';
    return String(url)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function jsPhotoUrl(url) {
    if (!url) return '';
    return String(url).replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
  }

  function eventImageSrc(ev) {
    if (window.getEventBrowseImage) return window.getEventBrowseImage(ev);
    if (window.getEventImage) return window.getEventImage(ev);
    if (window.getFlexibleEventImage) {
      return window.getFlexibleEventImage(ev.photo, ev.organiserLogo, ev.id);
    }
    return ev.photo || ev.organiserLogo || '';
  }

  function defaultPlaceholder() {
    if (window.getDefaultEventPlaceholder) return window.getDefaultEventPlaceholder();
    return '/assets/placeholders/default.svg';
  }

  function isPlaceholderSrc(url) {
    return /\/assets\/placeholders\//i.test(url) || /event-placeholder/i.test(url);
  }

  function isLogoStyleCover(ev, url) {
    if (window.hubIsLogoStyleCover) return window.hubIsLogoStyleCover(ev, url);
    const photo = String(url || '').trim();
    const logo = ev && ev.organiserLogo ? String(ev.organiserLogo).trim() : '';
    return Boolean(photo && logo && photo === logo);
  }

  function photoPositionStyle(ev, resolvedUrl) {
    const pos = ev && String(ev.photoPosition || '').trim();
    if (!pos || !/^\d{1,3}% \d{1,3}%$/.test(pos)) return '';
    const ownPhoto = String((ev && ev.photo) || '').trim();
    if (!ownPhoto || resolvedUrl !== ownPhoto) return '';
    return ` style="object-position:${pos}"`;
  }

  function photoImg(url, className, eventId, eventType, eventTitle, ev) {
    const placementFn = window.getEventPlacementImage;
    const fallbackRaw =
      (placementFn
        ? placementFn(eventId || '', eventType || '', eventTitle || '')
        : window.getEventBrowseImage
          ? window.getEventBrowseImage({ id: eventId, eventType: eventType, title: eventTitle })
          : '') || defaultPlaceholder();
    const resolved = url || fallbackRaw;
    const src = safePhotoUrl(resolved);
    const errorFallback = jsPhotoUrl(defaultPlaceholder());
    const placeholderClass = isPlaceholderSrc(resolved) ? ' is-placeholder' : '';
    const logoCoverClass = isLogoStyleCover(ev, resolved) ? ' is-logo-cover' : '';
    const positionStyle = photoPositionStyle(ev, resolved);
    return (
      `<img class="${className}${placeholderClass}${logoCoverClass}"${positionStyle} src="${src}" alt="${escapeHtml(eventTitle || 'Event cover')}" loading="lazy" decoding="async" referrerpolicy="no-referrer" ` +
      `onload="window.hubMarkSmallEventCover&&window.hubMarkSmallEventCover(this)" ` +
      `onerror="this.onerror=null;this.src='${errorFallback}';this.classList.add('is-placeholder');this.style.objectPosition=''">`
    );
  }

  function cardLocation(ev) {
    const city = String(ev.city || '').trim();
    if (city) return city.slice(0, 20);
    const outcode = String(ev.outcode || '').trim();
    if (outcode) return outcode.slice(0, 20);
    if (String(ev.format || '').toLowerCase().includes('online')) return 'Online';
    const loc = String(ev.locationShort || ev.location || '').trim();
    if (!loc) return 'TBC';
    const short = loc.split(',')[0].trim() || loc;
    return short.slice(0, 20);
  }

  function slugLocation(loc) {
    if (!loc) return '';
    const s = String(loc).toLowerCase();
    if (s.includes('online')) return 'online';
    return s.replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  }

  function formatTagClass(fmt) {
    const s = String(fmt || '').toLowerCase();
    if (s.includes('online') && !s.includes('person')) return 'online';
    return 'in-person';
  }

  function formatTagLabel(fmt) {
    const c = formatTagClass(fmt);
    if (c === 'online') return 'Online';
    return 'In-person';
  }

  /** Meeting type label for cards (networking, conference, etc. — not online/in-person). */
  function meetingTypeLabel(ev) {
    let raw = ev.eventType || ev.typeRaw || ev.typeCategory || '';
    if (typeof window !== 'undefined' && window.hubNormalizeEventType) {
      raw = window.hubNormalizeEventType(raw);
    }
    const label = String(raw).trim();
    if (!label) return 'Meeting';
    if (label.length > 28) return label.slice(0, 26) + '…';
    return label;
  }

  var guestVisitEligibilityByOrganiser = window.hubGuestVisitEligibilityByOrganiser || {};
  window.hubGuestVisitEligibilityByOrganiser = guestVisitEligibilityByOrganiser;
  var guestVisitLabelRefreshPromise = null;

  function priceBadgeLabel(ev) {
    const mode = String(ev?.attendanceMode || '').trim();
    const isCe = mode === 'category_exclusivity' || mode === 'osop';
    if (!isCe && ev?.isMembersOnlyEvent) {
      return 'Members only';
    }
    if (window.HubBookingFees) {
      const organiserId = String(ev.organiserId || '').trim();
      const eligibility = organiserId ? guestVisitEligibilityByOrganiser[organiserId] : null;
      return window.HubBookingFees.listingPriceLabel(ev, {
        guestVisitEligibility: eligibility || null,
      });
    }
    if (ev.priceKey === 'free' || !ev.price || /^free$/i.test(ev.price)) return 'Free';
    const n = Number(ev.priceNum);
    if (n > 0) {
      const amt = n % 1 === 0 ? '£' + n.toFixed(0) : '£' + n.toFixed(2);
      return 'from ' + amt;
    }
    return ev.price;
  }

  function eventLookupById(id) {
    const needle = String(id || '').trim();
    if (!needle) return null;
    const pools = [];
    if (Array.isArray(events)) pools.push(events);
    if (Array.isArray(window.hubAllEvents)) pools.push(window.hubAllEvents);
    if (Array.isArray(window.hubBrowseEvents)) pools.push(window.hubBrowseEvents);
    for (let i = 0; i < pools.length; i++) {
      const found = pools[i].find(function (ev) {
        return String(ev && ev.id) === needle;
      });
      if (found) return found;
    }
    return null;
  }

  function applyGuestVisitPriceLabels() {
    document
      .querySelectorAll('.event-grid-card[data-id], .premium-card[data-id]')
      .forEach(function (card) {
        const ev = eventLookupById(card.getAttribute('data-id'));
        if (
          !ev ||
          (String(ev.attendanceMode || '') !== 'guest_programme' &&
            String(ev.attendanceMode || '') !== 'membership_meeting')
        )
          return;
        const priceEl = card.querySelector('.event-grid-price, .premium-price');
        if (priceEl) priceEl.textContent = priceBadgeLabel(ev);
      });
  }

  function refreshGuestVisitPriceLabels() {
    const source = Array.isArray(events) && events.length ? events : window.hubAllEvents || [];
    const organiserIds = [];
    const seen = {};
    source.forEach(function (ev) {
      if (
        !ev ||
        (String(ev.attendanceMode || '') !== 'guest_programme' &&
          String(ev.attendanceMode || '') !== 'membership_meeting')
      )
        return;
      if (ev.guestPassesDisabled) return;
      if (!(Number(ev.complimentaryVisitsAllowed) > 0)) return;
      const organiserId = String(ev.organiserId || '').trim();
      if (!organiserId || seen[organiserId]) return;
      seen[organiserId] = true;
      organiserIds.push(organiserId);
    });
    if (!organiserIds.length) return Promise.resolve();

    if (guestVisitLabelRefreshPromise) return guestVisitLabelRefreshPromise;

    guestVisitLabelRefreshPromise = Promise.resolve()
      .then(function () {
        if (typeof window.hubFetchSession === 'function') return window.hubFetchSession();
        return fetch('/api/auth/session', { credentials: 'include' }).then(function (res) {
          return res.json();
        });
      })
      .then(function (sessionData) {
        if (!sessionData || !sessionData.ok || !sessionData.user) return null;
        return fetch(
          '/api/auth/guest-visit-eligibility?organiserIds=' +
            encodeURIComponent(organiserIds.join(',')),
          { credentials: 'include', cache: 'no-store' }
        ).then(function (res) {
          return res.json();
        });
      })
      .then(function (data) {
        if (!data || !data.ok || !data.byOrganiserId) return;
        Object.keys(data.byOrganiserId).forEach(function (organiserId) {
          guestVisitEligibilityByOrganiser[organiserId] = data.byOrganiserId[organiserId];
        });
        applyGuestVisitPriceLabels();
      })
      .catch(function () {
        /* non-fatal */
      })
      .finally(function () {
        guestVisitLabelRefreshPromise = null;
      });

    return guestVisitLabelRefreshPromise;
  }

  function starsHtml(rating) {
    const avg = Number(rating);
    const full =
      Number.isFinite(avg) && avg > 0 ? Math.min(5, Math.max(0, Math.round(avg))) : 0;
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="star ${i <= full ? 'is-full' : ''}" aria-hidden="true">★</span>`;
    }
    return html;
  }

  function currentBrowseSearchCriteria() {
    const searchInput = document.getElementById('search');
    const locationInput = document.getElementById('location');
    const typeTabs = [];
    document.querySelectorAll('[data-type-filter].is-active, .type-chip.is-active, input[name="event-type"]:checked').forEach(function (el) {
      const v = el.getAttribute('data-type-filter') || el.value;
      if (v) typeTabs.push(v);
    });
    const criteria = {
      q: searchInput ? String(searchInput.value || '').trim() : '',
      location: locationInput ? String(locationInput.value || '').trim() : '',
      types: typeTabs.join(','),
    };
    if (window.hubServerBrowse && window.hubBrowseLastParams) {
      const p = window.hubBrowseLastParams;
      if (p.q) criteria.q = String(p.q).trim();
      if (p.location || p.loc) criteria.location = String(p.location || p.loc).trim();
      if (p.types) criteria.types = String(p.types).trim();
      if (p.format) criteria.format = String(p.format).trim();
    }
    return criteria;
  }

  function criteriaLabel(criteria) {
    const parts = [];
    if (criteria.q) parts.push('“' + criteria.q + '”');
    if (criteria.location) parts.push(criteria.location);
    if (criteria.types) parts.push(criteria.types.replace(/,/g, ', '));
    if (criteria.format && criteria.format !== 'all') parts.push(criteria.format);
    return parts.length ? parts.join(' · ') : 'your filters';
  }

  function bindEmptySaveSearch() {
    const btn = document.getElementById('empty-save-search');
    const status = document.getElementById('empty-save-search-status');
    const resetBtn = document.getElementById('empty-reset');
    if (resetBtn && !resetBtn.dataset.bound) {
      resetBtn.dataset.bound = '1';
      resetBtn.addEventListener('click', function () {
        if (window.hubClearAllFilters) window.hubClearAllFilters();
        else if (window.location) window.location.href = '/events/?browse=all';
      });
    }
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function () {
      const criteria = currentBrowseSearchCriteria();
      const label = criteriaLabel(criteria);
      if (status) {
        status.hidden = false;
        status.textContent = 'Saving alert…';
      }
      btn.disabled = true;
      fetch('/api/auth/event-saved-searches', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label, criteria: criteria, notifyEmail: true }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, status: res.status, data: data };
          });
        })
        .then(function (res) {
          if (res.status === 401) {
            const next = '/events/' + (window.location.search || '');
            window.location.href = '/login?next=' + encodeURIComponent(next);
            return;
          }
          if (!res.ok) {
            if (status) {
              status.textContent = (res.data && (res.data.message || res.data.error)) || 'Could not save alert.';
              status.classList.add('is-error');
            }
            return;
          }
          if (status) {
            status.textContent = 'Alert saved — we will email you when a matching event is published.';
            status.classList.remove('is-error');
          }
          btn.textContent = 'Alert saved';
        })
        .catch(function () {
          if (status) {
            status.textContent = 'Could not save alert. Try again.';
            status.classList.add('is-error');
          }
        })
        .finally(function () {
          btn.disabled = false;
        });
    });
  }

  function slugifyEventTitle(title) {
    return String(title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 96);
  }

  function publicEventSlug(ev) {
    const stored = ev.slug ? String(ev.slug).trim() : '';
    const uuidLike =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored);
    if (stored && !uuidLike) return stored;
    return '';
  }

  function detailHref(ev) {
    if (window.HubPublicUrls && typeof window.HubPublicUrls.eventDetailHref === 'function') {
      return window.HubPublicUrls.eventDetailHref(ev);
    }
    const slug = publicEventSlug(ev);
    if (slug) return '/events/' + encodeURIComponent(slug);
    if (ev && ev.id) return '/events/event.html?id=' + encodeURIComponent(ev.id);
    return '/events/';
  }

  const META_PIN_SVG =
    '<svg class="premium-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  const META_CAL_SVG =
    '<svg class="premium-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></svg>';
  const META_CLOCK_SVG =
    '<svg class="premium-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>';

  function premiumCard(ev) {
    const dateLabel = ev.date || 'Date TBC';
    const timeLabel = ev.time || '';
    return `
      <article class="premium-card" data-id="${escapeHtml(ev.id)}"
        data-type="${escapeHtml(ev.type)}"
        data-search="${escapeHtml(ev.search)}"
        data-location="${escapeHtml(ev.locationSlug)}"
        data-format="${escapeHtml(ev.formatSlug)}"
        data-price="${escapeHtml(ev.priceKey)}">
        <a class="premium-card-link" href="${escapeHtml(detailHref(ev))}">
          <div class="premium-card-media" aria-hidden="true">
            <div class="premium-card-bg">${photoImg(eventImageSrc(ev), 'premium-card-img', ev.id, ev.eventType || ev.typeRaw, ev.title, ev)}</div>
            <div class="premium-card-overlay"></div>
          </div>
          <div class="premium-card-top">
            <span class="premium-badge">Premium</span>
            <span class="premium-price">${escapeHtml(priceBadgeLabel(ev))}</span>
          </div>
          <div class="premium-card-body">
            <h3 class="premium-card-title">${escapeHtml(ev.title)}</h3>
            <div class="premium-card-meta">
              <p class="premium-meta-row">${META_PIN_SVG}<span>${escapeHtml(cardLocation(ev))}</span></p>
              <p class="premium-meta-row">${META_CAL_SVG}<span>${escapeHtml(dateLabel)}${timeLabel ? ' · ' + escapeHtml(timeLabel) : ''}</span></p>
            </div>
          </div>
        </a>
      </article>`;
  }

  function rankingShortLabel(ev) {
    const rank = ev.organiserRanking;
    if (rank && rank.label) {
      return String(rank.label).replace(/\s+networking group$/i, '').trim();
    }
    const raw = String(ev.organiserRankingLabel || '').trim();
    if (!raw) return '';
    return raw.split('·')[0].trim();
  }

  function gridCard(ev) {
    const fmtClass = formatTagClass(ev.format);
    const fmtLabel = formatTagLabel(ev.format);
    const reviewCount = Number(ev.organiserReviews) || Number(ev.reviews) || 0;
    const rating = Number(ev.organiserRating) || Number(ev.rating) || 0;
    const hasRating = reviewCount > 0 && rating > 0;
    const meetingType = meetingTypeLabel(ev);
    const dateLine =
      ev.dateLine ||
      [cardLocation(ev), ev.date || ev.dateFieldRaw, ev.time].filter(Boolean).join(' · ') ||
      'Date TBC';
    const premiumBadge = ev.featured
      ? '<span class="event-grid-premium">Premium</span>'
      : '';
    const salesBadge = ev.isTicketSalesScheduled && ev.ticketSalesOpensShort
      ? '<span class="event-grid-sales-pending">Tickets open ' +
        escapeHtml(ev.ticketSalesOpensShort) +
        '</span>'
      : ev.isTicketSalesScheduled
        ? '<span class="event-grid-sales-pending">Tickets soon</span>'
        : '';
    const rankingShort = rankingShortLabel(ev);
    const rankingBadge =
      !salesBadge && rankingShort
        ? '<span class="event-grid-ranking hub-ranking-badge hub-ranking-badge--' +
          escapeHtml(ev.organiserRanking?.tier || 'top10') +
          '" title="' +
          escapeHtml(ev.organiserRanking?.displayLabel || ev.organiserRankingLabel || rankingShort) +
          '">★ ' +
          escapeHtml(rankingShort) +
          '</span>'
        : '';
    const statusBadge = salesBadge || rankingBadge;

    return `
      <article class="event-grid-card${ev.featured ? ' is-premium' : ''}"
        data-id="${escapeHtml(ev.id)}"
        data-type="${escapeHtml(ev.type)}"
        data-search="${escapeHtml(ev.search)}"
        data-location="${escapeHtml(ev.locationSlug)}"
        data-format="${escapeHtml(ev.formatSlug)}"
        data-price="${escapeHtml(ev.priceKey)}">
        <div class="event-grid-media">
          ${photoImg(eventImageSrc(ev), 'event-grid-img', ev.id, ev.eventType || ev.typeRaw, ev.title, ev)}
          ${premiumBadge}
          ${statusBadge}
          <span class="event-grid-category">${escapeHtml(meetingType)}</span>
        </div>
        <div class="event-grid-body">
          <div class="event-grid-body-top">
            <span class="event-grid-format ${escapeHtml(fmtClass)}">${escapeHtml(fmtLabel)}</span>
            <span class="event-grid-price">${escapeHtml(priceBadgeLabel(ev))}</span>
          </div>
          <h3 class="event-grid-title">${escapeHtml(ev.title)}</h3>
          <div class="event-grid-rating${hasRating ? '' : ' event-grid-rating--empty'}">
            ${
              hasRating
                ? '<span class="stars">' +
                  starsHtml(rating) +
                  '</span><span class="review-count">(' +
                  reviewCount +
                  ')</span>'
                : '<span class="review-count review-count--none">No reviews yet</span>'
            }
            <button type="button" class="fav-btn" data-event-id="${escapeHtml(ev.id)}" data-organiser-id="${escapeHtml(ev.organiserId || '')}" aria-label="Save event" aria-pressed="false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
            </button>
          </div>
          <p class="event-grid-meta">${escapeHtml(dateLine)}</p>
        </div>
        <a class="event-grid-card-link" href="${escapeHtml(detailHref(ev))}" aria-label="View ${escapeHtml(ev.title)}"></a>
      </article>`;
  }

  function paginationHtml(page, totalPages) {
    if (totalPages <= 1) return '';

    const items = [];
    const maxVisible = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);

    items.push(
      `<button type="button" class="page-btn page-prev" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>`
    );

    if (start > 1) {
      items.push(`<button type="button" class="page-btn" data-page="1">1</button>`);
      if (start > 2) items.push('<span class="page-ellipsis" aria-hidden="true">…</span>');
    }

    for (let p = start; p <= end; p++) {
      items.push(
        `<button type="button" class="page-btn${p === page ? ' is-active' : ''}" data-page="${p}" ${p === page ? 'aria-current="page"' : ''}>${p}</button>`
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) items.push('<span class="page-ellipsis" aria-hidden="true">…</span>');
      items.push(`<button type="button" class="page-btn" data-page="${totalPages}">${totalPages}</button>`);
    }

    items.push(
      `<button type="button" class="page-btn page-next" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''} aria-label="Next page">›</button>`
    );

    return `<nav class="listings-pagination" aria-label="Listings pages">${items.join('')}</nav>`;
  }

  function activeBrowseTypeTabs() {
    if (window.hubGetActiveTypeTabs) return window.hubGetActiveTypeTabs();
    return window.hubBrowseActiveTypeTabs || [];
  }

  function browseCountFromTypeTabs(counts, typeTabs) {
    if (!counts || !typeTabs || !typeTabs.length) return null;
    var sum = 0;
    var hasCount = false;
    typeTabs.forEach(function (type) {
      if (counts[type] != null) {
        sum += Number(counts[type]) || 0;
        hasCount = true;
      }
    });
    return hasCount ? sum : null;
  }

  function getFilteredList() {
    if (window.hubServerBrowse && window.hubBrowsePins && window.hubBrowsePins.length) {
      var mapBtn = document.getElementById('map-view-btn');
      if (mapBtn && mapBtn.getAttribute('aria-pressed') === 'true') {
        return window.hubBrowsePins;
      }
    }
    if (window.hubServerBrowse && window.hubBrowseEvents) {
      if (window.hubFilterServerBrowseEvents) {
        return window.hubFilterServerBrowseEvents(window.hubBrowseEvents);
      }
      return window.hubBrowseEvents;
    }
    return window.hubGetFilteredEvents ? window.hubGetFilteredEvents(events) : events.slice();
  }

  function browseTotalCount() {
    if (window.hubServerBrowse && window.hubBrowseTotal != null) {
      // Trust the paginated API total — do not substitute chip counts when
      // a type tab is selected but the request has not applied types yet.
      return Number(window.hubBrowseTotal) || 0;
    }
    return getFilteredList().length;
  }

  function renderGridPage(list) {
    const rows = list;
    const totalItems = window.hubServerBrowse ? browseTotalCount() : rows.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    const page = window.hubServerBrowse ? window.hubBrowseCurrentPage || currentPage : currentPage;

    if (page > totalPages) {
      currentPage = totalPages;
      if (window.hubServerBrowse) window.hubBrowseCurrentPage = totalPages;
    } else {
      currentPage = page;
    }
    if (currentPage < 1) currentPage = 1;

    const start = window.hubServerBrowse ? (currentPage - 1) * PAGE_SIZE : (currentPage - 1) * PAGE_SIZE;
    const pageItems = window.hubServerBrowse ? rows : rows.slice(start, start + PAGE_SIZE);

    if (!els.listings) return;

    if (!totalItems && !rows.length) {
      const searchInput = document.getElementById('search');
      const searchQ = searchInput ? String(searchInput.value || '').trim() : '';
      const regional = window.hubRegionalLanding;
      const regionalName = regional && regional.name ? String(regional.name).trim() : '';
      const isRegionalPage =
        Boolean(regionalName) || document.body.classList.contains('networking-region-page');
      const emptyTitle = searchQ
        ? 'No events found for “' + escapeHtml(searchQ) + '”'
        : regionalName
          ? 'No upcoming events in ' + escapeHtml(regionalName) + ' yet'
          : isRegionalPage
            ? 'No upcoming events in this area yet'
            : 'No events match your filters';
      const emptyText = searchQ
        ? 'Check the spelling or try a shorter word, or browse <a href="/opportunities/?q=' +
          encodeURIComponent(searchQ) +
          '">opportunities matching “' +
          escapeHtml(searchQ) +
          '”</a>.'
        : isRegionalPage
          ? 'Check back soon, or <a href="' +
            (window.hubBrowseAllEventsHref || '/events/?browse=all') +
            '">browse all UK events</a>. Organisers can list a group from the button above.'
          : 'Try clearing filters, choosing a different date range, or browsing all event types.';
      const emptyAction = isRegionalPage
        ? '<a class="empty-state-btn" href="' +
          (window.hubBrowseAllEventsHref || '/events/?browse=all') +
          '">Browse all events</a>'
        : '<button type="button" class="empty-state-btn" id="empty-reset">Clear all filters</button>';
      const notifyBtn =
        '<button type="button" class="empty-state-btn empty-state-btn--secondary" id="empty-save-search" style="margin-left:8px">Email me when something matches</button>' +
        '<p class="empty-state-text" id="empty-save-search-status" hidden role="status" style="margin-top:10px"></p>';
      els.listings.innerHTML =
        '<div class="empty-state is-visible" role="status">' +
        '<div class="empty-state-inner">' +
        '<div class="empty-state-icon" aria-hidden="true">' +
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
        '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/>' +
        '<path d="M8 11h6M11 8v6" stroke-linecap="round"/>' +
        '</svg></div>' +
        '<h3 class="empty-state-title">' +
        emptyTitle +
        '</h3>' +
        '<p class="empty-state-text">' +
        emptyText +
        '</p>' +
        '<div class="empty-state-actions">' +
        emptyAction +
        notifyBtn +
        '</div>' +
        '</div></div>';
      updateResultsSummary(0);
      bindEmptySaveSearch();
      return;
    }

    const rangeStart = totalItems ? start + 1 : 0;
    const rangeEnd = Math.min(start + pageItems.length, totalItems);
    const rangeHtml =
      totalItems > PAGE_SIZE
        ? '<p class="listings-range">Showing ' +
          rangeStart +
          '–' +
          rangeEnd +
          ' of ' +
          totalItems +
          '</p>'
        : '';

    els.listings.innerHTML =
      rangeHtml +
      '<div class="event-grid">' +
      pageItems.map(gridCard).join('') +
      '</div>' +
      paginationHtml(currentPage, totalPages);

    updateResultsSummary(totalItems);

    if (window.HubFavourites) window.HubFavourites.refreshButtons(els.listings);
  }

  function revealBrowseResultCount() {
    const loading = document.getElementById('results-loading');
    const ready = document.getElementById('results-ready');
    if (loading) loading.hidden = true;
    if (ready) ready.hidden = false;
  }
  window.hubRevealBrowseResultCount = revealBrowseResultCount;

  function updateResultsSummary(totalItems) {
    const searchInput = document.getElementById('search');
    const searchQ = searchInput ? String(searchInput.value || '').trim() : '';
    const queryEl = document.getElementById('events-search-query');
    revealBrowseResultCount();
    if (els.resultsCount) els.resultsCount.textContent = String(totalItems);
    if (!queryEl) return;
    if (searchQ) {
      queryEl.hidden = false;
      queryEl.textContent = ' for “' + searchQ + '”';
    } else {
      queryEl.hidden = true;
      queryEl.textContent = '';
    }
  }

  function scrollToResultsAfterLanding() {
    if (!window.hubConsumePendingResultsScroll) return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        window.hubConsumePendingResultsScroll();
      });
    });
  }

  function initListingsPagination() {
    if (!els.listings || els.listings.dataset.paginationBound) return;
    els.listings.dataset.paginationBound = '1';
    els.listings.addEventListener('click', function (e) {
      if (document.body.classList.contains('browse-mode-organisers')) return;

      var fav = e.target.closest('.fav-btn[data-event-id]');
      if (fav) {
        e.preventDefault();
        e.stopPropagation();
        var eventId = fav.getAttribute('data-event-id');
        var organiserId = fav.getAttribute('data-organiser-id');
        if (window.HubFavourites && eventId) {
          window.HubFavourites.toggle(eventId, { organiserId: organiserId }).then(function () {
            window.HubFavourites.refreshButtons(els.listings);
            if (window.HubOrganiserFavourites) window.HubOrganiserFavourites.refreshButtons(els.listings);
          });
          window.HubFavourites.refreshButtons(els.listings);
        } else {
          fav.classList.toggle('is-active');
        }
        return;
      }

      const btn = e.target.closest('.page-btn');
      if (!btn || btn.disabled) return;
      const totalPages = Math.max(
        1,
        Math.ceil(browseTotalCount() / PAGE_SIZE)
      );
      const p = parseInt(btn.getAttribute('data-page'), 10);
      if (!p || p === currentPage || p < 1 || p > totalPages) return;
      currentPage = p;
      if (window.hubServerBrowse && window.hubBrowseFetchNow) {
        window.hubBrowseFetchNow(p).then(function () {
          renderSpotlight();
          renderGridPage(getFilteredList());
        });
      } else {
        renderGridPage(getFilteredList());
      }
      const block = document.querySelector('.listings-block');
      if (block) block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function fillFilterOptions() {
    if (!els.location) return;
    while (els.location.options.length > 1) els.location.remove(1);
    const locations = [...new Set(events.map((e) => e.location).filter(Boolean))].sort();
    locations.forEach((label) => {
      const opt = document.createElement('option');
      opt.value = slugLocation(label);
      opt.textContent = label;
      els.location.appendChild(opt);
    });
  }

  function spotlightBoostPromoCard() {
    if (window.HubOrganiserActions && window.HubOrganiserActions.spotlightBoostCardHtml) {
      return window.HubOrganiserActions.spotlightBoostCardHtml('event');
    }
    return (
      '<article class="premium-card premium-card--boost-cta">' +
      '<a class="premium-card-link" href="../organiser/">' +
      '<div class="premium-card-media" aria-hidden="true">' +
      '<div class="premium-card-bg premium-card-bg--boost">' +
      '<span class="premium-card-boost-icon" aria-hidden="true">★</span></div>' +
      '<div class="premium-card-overlay"></div></div>' +
      '<div class="premium-card-top"><span class="premium-badge">Premium</span>' +
      '<span class="premium-price">£55/mo</span></div>' +
      '<div class="premium-card-body"><h3 class="premium-card-title">Boost your event here</h3>' +
      '<div class="premium-card-meta">' +
      '<p class="premium-meta-row"><span>Premium Spotlight carousel on the events directory</span></p>' +
      '<p class="premium-meta-row premium-meta-row--cta"><span>List or feature your event →</span></p>' +
      '</div></div></a></article>'
    );
  }

  function bindSpotlightBoostPromo() {
    if (window.HubOrganiserActions && window.HubOrganiserActions.bindSpotlightBoost) {
      window.HubOrganiserActions.bindSpotlightBoost(els.spotlightTrack);
    }
  }

  function renderSpotlight() {
    if (document.body.classList.contains('browse-mode-organisers')) return;

    const premium = getSpotlightPremium();
    const promo =
      document.querySelector('.events-promo-section') ||
      (els.spotlightTrack && els.spotlightTrack.closest('.events-promo-section'));
    renderSpotlightNote(premium.length > 0);

    if (els.spotlightTrack) {
      if (!premium.length) {
        stopSpotlightAuto();
        if (window.HubSpotlightCarousel && window.HubSpotlightCarousel.clearTrack) {
          window.HubSpotlightCarousel.clearTrack(els.spotlightTrack);
        } else {
          els.spotlightTrack.innerHTML = '';
          els.spotlightTrack.removeAttribute('data-loop-width');
          els.spotlightTrack.removeAttribute('data-spotlight-content-key');
        }
        els.spotlightTrack.classList.remove('spotlight-track--carousel');
        els.spotlightTrack.scrollLeft = 0;
        spotlightRenderKey = '';
        if (promo) promo.hidden = true;
      } else {
        if (promo) promo.hidden = false;
        const cardsHtml = buildSpotlightTrackHtml();
        const itemCount = getSpotlightTrackItemCount();
        const renderKey = itemCount + ':' + cardsHtml.length + ':' + premium.map(function (e) {
          return e.id || e.slug || '';
        }).join(',');
        /* Skip rebuild when the featured set is unchanged (e.g. sort-only) — stops flicker. */
        if (renderKey === spotlightRenderKey && els.spotlightTrack.children.length) {
          return;
        }
        spotlightRenderKey = renderKey;
        els.spotlightTrack.classList.add('spotlight-track--carousel');
        bindSpotlightCarousel();
        /* Paint once — no deferred second layout that rewrites the track. */
        layoutSpotlightTrack(cardsHtml, itemCount);
        if (shouldAppendSpotlightBoostPromo()) bindSpotlightBoostPromo();
        syncSpotlightLoopScroll();
        startSpotlightAuto();
      }
    } else if (promo) {
      promo.hidden = !premium.length;
    }

    if (els.featuredList) {
      els.featuredList.innerHTML = premium.map(premiumCard).join('') || '';
      els.featuredList.closest('.featured')?.classList.toggle('is-hidden', !premium.length);
    }
  }

  function updateCounts() {
    if (window.hubUpdateEventTypeChipCounts) {
      window.hubUpdateEventTypeChipCounts();
    }
  }

  function renderAll() {
    if (document.body.classList.contains('browse-mode-organisers')) return;
    const filtered = getFilteredList();
    renderSpotlight();
    renderGridPage(filtered);
    updateCounts();
    refreshGuestVisitPriceLabels();
  }

  function setLoading(on) {
    if (window.FactLoader) return;
    const shell = document.getElementById('events-shell');
    if (shell) shell.classList.toggle('is-loading', !!on);
  }

  function setStatus(msg, isError) {
    if (!els.status) return;
    els.status.textContent = msg;
    els.status.classList.toggle('is-error', !!isError);
    els.status.hidden = !msg;
  }

  function isMapViewOpen() {
    var mapBtn = document.getElementById('map-view-btn');
    return !!(mapBtn && mapBtn.getAttribute('aria-pressed') === 'true');
  }

  window.hubRefreshListings = function () {
    if (document.body.classList.contains('browse-mode-organisers')) {
      if (window.hubRefreshOrganiserListings) window.hubRefreshOrganiserListings();
      return;
    }
    if (!window.hubServerBrowse) currentPage = 1;
    renderAll();
    if (window.hubRefreshMap && window.hubGetFilteredEvents) {
      // Server browse refreshes map pins after the dedicated pins fetch —
      // avoid flashing paginated list rows as map markers.
      if (window.hubServerBrowse && isMapViewOpen()) return;
      var mapList =
        window.hubBrowsePins && window.hubBrowsePins.length ? window.hubBrowsePins : getFilteredList();
      window.hubRefreshMap(mapList);
    }
  };

  function applyLoadedEvents(options) {
    options = options || {};
    if (!window.hubServerBrowse) {
      window.hubAllEvents = events;
    }
    resetSpotlightOrder();
    fillFilterOptions();
    currentPage = 1;
    if (document.body.classList.contains('browse-mode-organisers')) {
      if (window.hubApplyOrganiserFilters) window.hubApplyOrganiserFilters();
      return;
    }
    if (!options.skipRestore && window.hubRestoreEventFilterPrefs) {
      window.hubRestoreEventFilterPrefs();
      return;
    }
    if (window.hubRefreshListings) {
      window.hubRefreshListings();
    } else if (window.hubApplyFilters) {
      window.hubApplyFilters();
    } else {
      renderAll();
    }
    if (window.hubUpdateEventTypeChipCounts) window.hubUpdateEventTypeChipCounts();
  }

  function refreshAfterGeocode() {
    var geo = window.hubEnrichEventCoords
      ? window.hubEnrichEventCoords(events)
      : Promise.resolve();
    return geo
      .then(function () {
        if (window.hubApplyFilters) window.hubApplyFilters();
        else renderAll();
      })
      .catch(function () {
        /* map coords are optional */
      });
  }

  async function fetchEventsPayload() {
    var lastError = null;
    for (var i = 0; i < API_PATHS.length; i++) {
      var path = API_PATHS[i];
      try {
        var res = await fetch(path, { credentials: 'same-origin' });
        if (!res.ok) {
          var body = null;
          try {
            body = await res.json();
          } catch (parseErr) {
            body = null;
          }
          if (body && (body.error === 'site_private' || res.status === 403)) {
            throw new Error(body.message || 'site_private');
          }
          lastError = new Error('HTTP ' + res.status + ' for ' + path);
          continue;
        }
        return await res.json();
      } catch (err) {
        lastError = err;
        if (err && /site_private|private preview/i.test(String(err.message || ''))) {
          throw err;
        }
      }
    }
    throw lastError || new Error('Failed to fetch');
  }

  async function load() {
    const fetchAndRender = async () => {
      setStatus('', false);
      if (window.hubServerBrowse && window.hubBrowseFetchNow) {
        try {
          if (window.hubRestoreEventFilterPrefs) {
            await window.hubRestoreEventFilterPrefs({ prepareOnly: true });
          }
          await window.hubBrowseFetchNow(1);
          events = window.hubBrowseEvents || [];
          setStatus('', false);
          applyLoadedEvents({ skipRestore: true });
          scrollToResultsAfterLanding();
        } catch (e) {
          var detail = e && e.message ? String(e.message) : 'network error';
          var hint =
            window.location.protocol === 'file:'
              ? 'Open this page via your dev server: http://localhost:3000/events/ (run npm start first). Do not open the HTML file from Finder.'
              : /403|site_private|private preview/i.test(detail)
                ? 'Preview access required. Go to http://localhost:3000/site-access, enter the shared preview password, then open Events again.'
                : 'Could not load events (' +
                  detail +
                  '). Confirm npm start is running, use http://localhost:3000/events/, and disable ad blockers for localhost.';
          setStatus(hint, true);
          events = [];
          applyLoadedEvents();
          scrollToResultsAfterLanding();
        }
        return;
      }

      var data;
      try {
        data = await fetchEventsPayload();
      } catch (e) {
        var detail = e && e.message ? String(e.message) : 'network error';
        var hint =
          window.location.protocol === 'file:'
            ? 'Open this page via your dev server: http://localhost:3000/events/ (run npm start first). Do not open the HTML file from Finder.'
            : /403|site_private|private preview|Failed to fetch/i.test(detail)
              ? 'Preview access required (or the API is blocked). Go to http://localhost:3000/site-access, enter the preview password, then open http://localhost:3000/events/ again.'
              : 'Could not load events (' +
                detail +
                '). Confirm npm start is running, use http://localhost:3000/events/, and disable ad blockers for localhost.';
        setStatus(hint, true);
        events = [];
        applyLoadedEvents();
        scrollToResultsAfterLanding();
        return;
      }

      try {
        const provider = data.provider || 'supabase';

        if (!data.configured) {
          setStatus(
            'Connect Supabase: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy.',
            true
          );
          events = [];
        } else if (data.error) {
          setStatus('Could not load events: ' + (data.detail || data.message || data.error), true);
          events = [];
        } else {
          events = (data.events || []).filter(function (ev) {
            return String(ev.listingStatusRaw || '').trim() === 'Approved';
          });
          setStatus('', false);
        }
        applyLoadedEvents();
        scrollToResultsAfterLanding();
      } catch (e) {
        console.error('Events render error', e);
      }
    };

    const runGeocodeRefresh = function () {
      if (window.hubServerBrowse) return;
      refreshAfterGeocode().catch(function () {
        /* map coords are optional */
      });
    };

    if (window.FactLoader) {
      await window.FactLoader.run(fetchAndRender);
      runGeocodeRefresh();
      return;
    }

    setLoading(true);
    var safetyTimer = setTimeout(function () {
      setLoading(false);
    }, 6000);
    try {
      await fetchAndRender();
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
    }
    runGeocodeRefresh();
  }

  window.hubReloadEvents = load;
  window.hubEventDetailHref = detailHref;
  window.hubSpotlightStep = advanceSpotlight;
  initListingsPagination();
  // Organiser directory uses /api/organisers via browse-mode — skip the events fetch.
  var startInOrganisers =
    location.hash === '#organisers' ||
    (location.search && location.search.indexOf('mode=organisers') !== -1);
  if (!startInOrganisers) load();
})();
