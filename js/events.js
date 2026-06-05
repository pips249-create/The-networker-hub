/**
 * Loads events from /api/events (Supabase or Airtable via Vercel) and renders card grid + pagination.
 */
(function () {
  const API = '/api/events';
  const PAGE_SIZE = 12;

  const els = {
    status: document.getElementById('load-status'),
    featuredList: document.getElementById('featured-list'),
    spotlightTrack: document.getElementById('spotlight-track'),
    listings: document.getElementById('event-listings'),
    resultsCount: document.getElementById('results-count'),
    countAll: document.getElementById('count-all'),
    countMeeting: document.getElementById('count-meeting'),
    countExhibition: document.getElementById('count-exhibition'),
    location: document.getElementById('location'),
    sponsorTitle: document.getElementById('sponsor-title'),
    sponsorBody: document.getElementById('sponsor-body'),
    sponsorCta: document.getElementById('sponsor-cta'),
  };

  let events = [];
  let currentPage = 1;

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

  function eventImageSrc(ev) {
    if (window.getEventImage) return window.getEventImage(ev);
    if (window.getFlexibleEventImage) {
      return window.getFlexibleEventImage(ev.photo, ev.organiserLogo, ev.id);
    }
    return ev.photo || ev.organiserLogo || '';
  }

  function photoImg(url, className, eventId, eventType) {
    const placementFn = window.getEventPlacementImage;
    const fallbackRaw = placementFn
      ? placementFn(eventId || '', eventType || '')
      : window.getEventImage
        ? window.getEventImage({ id: eventId, eventType: eventType })
        : '';
    const src = safePhotoUrl(url || fallbackRaw);
    const fallback = safePhotoUrl(fallbackRaw).replace(/'/g, '%27');
    return (
      `<img class="${className}" src="${src}" alt="" loading="lazy" decoding="async" ` +
      `referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${fallback}'">`
    );
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
    if (s.includes('hybrid')) return 'hybrid';
    return 'in-person';
  }

  function formatTagLabel(fmt) {
    const c = formatTagClass(fmt);
    if (c === 'online') return 'Online';
    if (c === 'hybrid') return 'Hybrid';
    return 'In-person';
  }

  /** Meeting type label for cards (not industry). */
  function meetingTypeLabel(ev) {
    const raw =
      ev.meetingType ||
      ev.typeRaw ||
      ev.typeCategory ||
      ev.format ||
      '';
    const label = String(raw).trim();
    if (!label) return 'Event';
    if (label.length > 28) return label.slice(0, 26) + '…';
    return label;
  }

  function priceBadgeLabel(ev) {
    if (ev.priceKey === 'free' || !ev.price || /^free$/i.test(ev.price)) return 'Free';
    const n = Number(ev.priceNum);
    if (n > 0) {
      const amt = n % 1 === 0 ? '£' + n.toFixed(0) : '£' + n.toFixed(2);
      return 'from ' + amt;
    }
    return ev.price;
  }

  function starsHtml(rating) {
    const avg = Number(rating);
    const full = Math.min(5, Math.max(0, Math.round(Number.isFinite(avg) ? avg : 4)));
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="star ${i <= full ? 'is-full' : ''}" aria-hidden="true">★</span>`;
    }
    return html;
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
    return slugifyEventTitle(ev.title) || '';
  }

  function detailHref(ev) {
    const slug = publicEventSlug(ev);
    if (slug) return '/events/' + encodeURIComponent(slug);
    return 'event.html?id=' + encodeURIComponent(ev.id);
  }

  function premiumCard(ev) {
    return `
      <article class="premium-card" data-id="${escapeHtml(ev.id)}"
        data-type="${escapeHtml(ev.type)}"
        data-search="${escapeHtml(ev.search)}"
        data-location="${escapeHtml(ev.locationSlug)}"
        data-format="${escapeHtml(ev.formatSlug)}"
        data-price="${escapeHtml(ev.priceKey)}">
        <a class="premium-card-link" href="${escapeHtml(detailHref(ev))}">
          <div class="premium-card-bg">${photoImg(eventImageSrc(ev), 'premium-card-img', ev.id, ev.eventType || ev.typeRaw)}</div>
          <div class="premium-card-overlay"></div>
          <span class="premium-badge">Premium</span>
          <span class="premium-price">${escapeHtml(priceBadgeLabel(ev))}</span>
          <div class="premium-card-body">
            <h3>${escapeHtml(ev.title)}</h3>
            <p class="premium-desc">${escapeHtml(ev.description).slice(0, 90)}${ev.description.length > 90 ? '…' : ''}</p>
            <p class="premium-meta">
              <span>${escapeHtml(ev.location || 'TBC')}</span>
              <span class="sep">|</span>
              <span>${escapeHtml(ev.date || 'Date TBC')}</span>
              ${ev.time ? `<span class="sep">|</span><span>${escapeHtml(ev.time)}</span>` : ''}
            </p>
          </div>
        </a>
      </article>`;
  }

  function gridCard(ev) {
    const fmtClass = formatTagClass(ev.format);
    const fmtLabel = formatTagLabel(ev.format);
    const reviewCount = Number(ev.reviews) || 0;
    const meetingType = meetingTypeLabel(ev);
    const dateLine =
      ev.dateLine ||
      [ev.location, ev.date || ev.dateFieldRaw, ev.time].filter(Boolean).join(' · ') ||
      'Date TBC';
    const premiumBadge = ev.featured
      ? '<span class="event-grid-premium">Premium</span>'
      : '';

    return `
      <a class="event-grid-card${ev.featured ? ' is-premium' : ''}" href="${escapeHtml(detailHref(ev))}"
        data-id="${escapeHtml(ev.id)}"
        data-type="${escapeHtml(ev.type)}"
        data-search="${escapeHtml(ev.search)}"
        data-location="${escapeHtml(ev.locationSlug)}"
        data-format="${escapeHtml(ev.formatSlug)}"
        data-price="${escapeHtml(ev.priceKey)}">
        <div class="event-grid-media">
          ${photoImg(eventImageSrc(ev), 'event-grid-img', ev.id, ev.eventType || ev.typeRaw)}
          ${premiumBadge}
          <span class="event-grid-category">${escapeHtml(meetingType)}</span>
          <span class="event-grid-price">${escapeHtml(priceBadgeLabel(ev))}</span>
        </div>
        <div class="event-grid-body">
          <span class="event-grid-format ${escapeHtml(fmtClass)}">${escapeHtml(fmtLabel)}</span>
          <h3 class="event-grid-title">${escapeHtml(ev.title)}</h3>
          <div class="event-grid-rating">
            <span class="stars">${starsHtml(ev.rating)}</span>
            <span class="review-count">(${reviewCount})</span>
            <span class="fav-btn" role="presentation" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
            </span>
          </div>
          <p class="event-grid-meta">${escapeHtml(dateLine)}</p>
        </div>
      </a>`;
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

  function getFilteredList() {
    return window.hubGetFilteredEvents ? window.hubGetFilteredEvents(events) : events.slice();
  }

  function renderGridPage(list) {
    const rows = list;
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = rows.slice(start, start + PAGE_SIZE);

    if (!els.listings) return;

    if (!rows.length) {
      els.listings.innerHTML =
        '<div class="empty-state is-visible" role="status"><p>No events match your filters.</p><button type="button" id="empty-reset">Show all</button></div>';
      if (els.resultsCount) els.resultsCount.textContent = '0';
      return;
    }

    const rangeStart = rows.length ? start + 1 : 0;
    const rangeEnd = Math.min(start + PAGE_SIZE, rows.length);
    const rangeHtml =
      rows.length > PAGE_SIZE
        ? '<p class="listings-range">Showing ' +
          rangeStart +
          '–' +
          rangeEnd +
          ' of ' +
          rows.length +
          '</p>'
        : '';

    els.listings.innerHTML =
      rangeHtml +
      '<div class="event-grid">' +
      pageItems.map(gridCard).join('') +
      '</div>' +
      paginationHtml(currentPage, totalPages);

    if (els.resultsCount) els.resultsCount.textContent = String(rows.length);
  }

  function initListingsPagination() {
    if (!els.listings || els.listings.dataset.paginationBound) return;
    els.listings.dataset.paginationBound = '1';
    els.listings.addEventListener('click', function (e) {
      const btn = e.target.closest('.page-btn');
      if (!btn || btn.disabled) return;
      const filtered = getFilteredList();
      const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      const p = parseInt(btn.getAttribute('data-page'), 10);
      if (!p || p === currentPage || p < 1 || p > totalPages) return;
      currentPage = p;
      renderGridPage(filtered);
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

  function renderSpotlight() {
    const premium = events.filter((e) => e.featured).slice(0, 3);

    if (els.spotlightTrack) {
      els.spotlightTrack.innerHTML = premium.length
        ? premium.map(premiumCard).join('')
        : '<p class="spotlight-empty">No premium events yet — set <strong>featured</strong> on approved events in Supabase.</p>';
    }

    if (els.featuredList) {
      els.featuredList.innerHTML = premium.map(premiumCard).join('') || '';
      els.featuredList.closest('.featured')?.classList.toggle('is-hidden', !premium.length);
    }
  }

  function updateCounts(list) {
    const meetings = list.filter((e) => (e.eventTypeCategory || 'meeting') === 'meeting').length;
    const exhibitions = list.filter((e) => e.eventTypeCategory === 'exhibition').length;
    if (els.countAll) els.countAll.textContent = `(${list.length})`;
    if (els.countMeeting) els.countMeeting.textContent = `(${meetings})`;
    if (els.countExhibition) els.countExhibition.textContent = `(${exhibitions})`;
  }

  function renderAll() {
    const filtered = getFilteredList();
    renderSpotlight();
    renderGridPage(filtered);
    updateCounts(events);
  }

  function setLoading(on) {
    const overlay = document.getElementById('events-load-overlay');
    const shell = document.getElementById('events-shell');
    if (window.hubLoading) {
      if (on) window.hubLoading.show('events-load-overlay');
      else window.hubLoading.hide('events-load-overlay');
      return;
    }
    if (!overlay) return;
    if (on) {
      overlay.classList.add('is-active');
      overlay.hidden = false;
      if (shell) shell.classList.add('is-loading');
    } else {
      overlay.classList.remove('is-active');
      overlay.hidden = true;
      if (shell) shell.classList.remove('is-loading');
    }
  }

  function setStatus(msg, isError) {
    if (!els.status) return;
    els.status.textContent = msg;
    els.status.classList.toggle('is-error', !!isError);
    els.status.hidden = !msg;
  }

  const SPONSOR_ENQUIRE_MAILTO =
    'mailto:sales@the-networker.co.uk?subject=' + encodeURIComponent('Sponsor Hub enquiry');

  function normalizeSponsorCtaUrl(url) {
    const u = String(url || '').trim();
    if (!u) return SPONSOR_ENQUIRE_MAILTO;
    if (/^(https?:|mailto:)/i.test(u)) return u;
    return SPONSOR_ENQUIRE_MAILTO;
  }

  function renderSponsorBlock(block) {
    if (!els.sponsorTitle && !els.sponsorBody && !els.sponsorCta) return;
    if (!block) return;

    const title = String(block.title || '').trim();
    const body = String(block.body || '').trim();
    const ctaLabel = String(block.cta_label || '').trim();
    const ctaUrl = normalizeSponsorCtaUrl(block.cta_url);

    if (els.sponsorTitle && title) els.sponsorTitle.textContent = title;
    if (els.sponsorBody) {
      els.sponsorBody.innerHTML = body ? body : '';
    }
    if (els.sponsorCta) {
      if (ctaLabel && ctaUrl) {
        els.sponsorCta.textContent = ctaLabel;
        els.sponsorCta.href = ctaUrl;
        els.sponsorCta.hidden = false;
      } else {
        els.sponsorCta.hidden = true;
      }
    }
  }

  async function loadSponsorBlock() {
    try {
      const res = await fetch('/api/cms-block?slot=sponsor_hub');
      const data = await res.json();
      if (data && data.ok && data.block) {
        renderSponsorBlock(data.block);
      }
    } catch {
      /* non-fatal */
    }
  }

  window.hubRefreshListings = function () {
    currentPage = 1;
    renderAll();
    if (window.hubRefreshMap && window.hubGetFilteredEvents) {
      window.hubRefreshMap(window.hubGetFilteredEvents(events));
    }
  };

  function applyLoadedEvents() {
    window.hubAllEvents = events;
    fillFilterOptions();
    currentPage = 1;
    if (window.hubApplyFilters) window.hubApplyFilters();
    else renderAll();
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

  async function load() {
    setLoading(true);
    setStatus('', false);
    var safetyTimer = setTimeout(function () {
      setLoading(false);
    }, 6000);
    try {
      const res = await fetch(API);
      const data = await res.json();
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
        events = data.events || [];
        setStatus(
          events.length
            ? ''
            : 'No published events yet. Approve events in Supabase so they appear in published_events.',
          false
        );
      }
      applyLoadedEvents();
      refreshAfterGeocode();
    } catch (e) {
      setStatus('Could not reach /api/events. Deploy on Vercel or run `vercel dev` locally.', true);
      events = [];
      applyLoadedEvents();
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
      if (window.hubLoading && window.hubLoading.clear) {
        window.hubLoading.clear('events-load-overlay');
      }
    }
  }

  window.hubReloadEvents = load;
  initListingsPagination();
  loadSponsorBlock();
  load();
})();
