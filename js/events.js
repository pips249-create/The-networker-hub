/**
 * Loads events from /api/events (Airtable via Vercel) and renders card grid + pagination.
 */
(function () {
  const API = '/api/events';
  const PAGE_SIZE = 12;
  const EVENT_PLACEHOLDER = '../assets/event-placeholder.svg';

  const els = {
    status: document.getElementById('load-status'),
    featuredList: document.getElementById('featured-list'),
    spotlightTrack: document.getElementById('spotlight-track'),
    listings: document.getElementById('event-listings'),
    resultsCount: document.getElementById('results-count'),
    countAll: document.getElementById('count-all'),
    countMeeting: document.getElementById('count-meeting'),
    countExhibition: document.getElementById('count-exhibition'),
    industry: document.getElementById('industry'),
    location: document.getElementById('location'),
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

  function photoImg(url, className) {
    const src = url ? safePhotoUrl(url) : EVENT_PLACEHOLDER;
    const fallback = EVENT_PLACEHOLDER.replace(/'/g, '%27');
    return (
      `<img class="${className}" src="${src}" alt="" loading="lazy" decoding="async" ` +
      `referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${fallback}'">`
    );
  }

  function slugIndustry(ind) {
    if (!ind) return '';
    return String(ind).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
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

  /** Meeting type from Airtable (Meeting Type / Event Type), not industry. */
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

  function detailHref(ev) {
    return 'event.html?id=' + encodeURIComponent(ev.id);
  }

  function premiumCard(ev) {
    return `
      <article class="premium-card" data-id="${escapeHtml(ev.id)}"
        data-type="${escapeHtml(ev.type)}"
        data-search="${escapeHtml(ev.search)}"
        data-location="${escapeHtml(ev.locationSlug)}"
        data-industry="${escapeHtml(ev.industrySlug)}"
        data-format="${escapeHtml(ev.formatSlug)}"
        data-price="${escapeHtml(ev.priceKey)}">
        <a class="premium-card-link" href="${escapeHtml(detailHref(ev))}">
          <div class="premium-card-bg">${photoImg(ev.photo, 'premium-card-img')}</div>
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

    return `
      <a class="event-grid-card" href="${escapeHtml(detailHref(ev))}"
        data-id="${escapeHtml(ev.id)}"
        data-type="${escapeHtml(ev.type)}"
        data-search="${escapeHtml(ev.search)}"
        data-location="${escapeHtml(ev.locationSlug)}"
        data-industry="${escapeHtml(ev.industrySlug)}"
        data-format="${escapeHtml(ev.formatSlug)}"
        data-price="${escapeHtml(ev.priceKey)}">
        <div class="event-grid-media">
          ${photoImg(ev.photo, 'event-grid-img')}
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
    const nonPremium = list.filter((e) => !e.featured);
    const rows = nonPremium.length ? nonPremium : list;
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
      const nonPremium = filtered.filter(function (ev) {
        return !ev.featured;
      });
      const rows = nonPremium.length ? nonPremium : filtered;
      const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
      const p = parseInt(btn.getAttribute('data-page'), 10);
      if (!p || p === currentPage || p < 1 || p > totalPages) return;
      currentPage = p;
      renderGridPage(filtered);
      const block = document.querySelector('.listings-block');
      if (block) block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function fillTypeFilterOptions() {
    var sel = document.getElementById('filter-type');
    if (!sel) return;
    var keep = sel.value;
    var bySlug = {};
    events.forEach(function (e) {
      var slug = e.typeSlug || '';
      var label = e.typeRaw || e.typeCategory || slug;
      if (slug) bySlug[slug] = label;
    });
    var slugs = Object.keys(bySlug).sort(function (a, b) {
      return String(bySlug[a]).localeCompare(String(bySlug[b]));
    });
    sel.innerHTML = '<option value="all">Type: All</option>';
    slugs.forEach(function (slug) {
      var opt = document.createElement('option');
      opt.value = slug;
      opt.textContent = bySlug[slug];
      sel.appendChild(opt);
    });
    if (keep && (keep === 'all' || bySlug[keep])) sel.value = keep;
  }

  function fillFilterOptions() {
    fillTypeFilterOptions();
    if (!els.industry || !els.location) return;
    while (els.industry.options.length > 1) els.industry.remove(1);
    while (els.location.options.length > 1) els.location.remove(1);
    const industries = [...new Set(events.map((e) => e.industry).filter(Boolean))].sort();
    const locations = [...new Set(events.map((e) => e.location).filter(Boolean))].sort();
    industries.forEach((label) => {
      const opt = document.createElement('option');
      opt.value = slugIndustry(label);
      opt.textContent = label;
      els.industry.appendChild(opt);
    });
    locations.forEach((label) => {
      const opt = document.createElement('option');
      opt.value = slugLocation(label);
      opt.textContent = label;
      els.location.appendChild(opt);
    });
  }

  function renderSpotlight(list) {
    const premium = list.filter((e) => e.featured);

    if (els.spotlightTrack) {
      els.spotlightTrack.innerHTML = premium.length
        ? premium.map(premiumCard).join('')
        : '<p class="spotlight-empty">No premium events yet — mark rows as Featured in Airtable.</p>';
    }

    if (els.featuredList) {
      els.featuredList.innerHTML = premium.slice(0, 6).map(premiumCard).join('') || '';
      els.featuredList.closest('.featured')?.classList.toggle('is-hidden', !premium.length);
    }
  }

  function updateCounts(list) {
    const meetings = list.filter((e) => e.type === 'meeting').length;
    const exhibitions = list.filter((e) => e.type === 'exhibition').length;
    if (els.countAll) els.countAll.textContent = `(${list.length})`;
    if (els.countMeeting) els.countMeeting.textContent = `(${meetings})`;
    if (els.countExhibition) els.countExhibition.textContent = `(${exhibitions})`;
  }

  function renderAll() {
    const filtered = getFilteredList();
    renderSpotlight(filtered);
    renderGridPage(filtered);
    updateCounts(events);
  }

  function setStatus(msg, isError) {
    if (!els.status) return;
    els.status.textContent = msg;
    els.status.classList.toggle('is-error', !!isError);
    els.status.hidden = !msg;
  }

  window.hubRefreshListings = function () {
    currentPage = 1;
    renderAll();
    if (window.hubRefreshMap && window.hubGetFilteredEvents) {
      window.hubRefreshMap(window.hubGetFilteredEvents(events));
    }
  };

  async function load() {
    setStatus('Loading events…', false);
    try {
      const res = await fetch(API);
      const data = await res.json();
      if (!data.configured) {
        setStatus(
          'Connect Airtable: set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in Vercel (see README).',
          true
        );
        events = [];
      } else if (data.error) {
        setStatus('Could not load Airtable: ' + (data.detail || data.message || data.error), true);
        events = [];
      } else {
        events = data.events || [];
        setStatus(events.length ? '' : 'No events in your Airtable table yet.', false);
      }
      window.hubAllEvents = events;
      var afterGeo = window.hubEnrichEventCoords
        ? window.hubEnrichEventCoords(events)
        : Promise.resolve();
      afterGeo.then(function () {
        fillFilterOptions();
        currentPage = 1;
        if (window.hubApplyFilters) window.hubApplyFilters();
        else renderAll();
      });
    } catch (e) {
      setStatus('Could not reach /api/events. Deploy on Vercel or run `vercel dev` locally.', true);
      events = [];
      window.hubAllEvents = events;
      fillFilterOptions();
      renderAll();
    }
  }

  window.hubReloadEvents = load;
  initListingsPagination();
  load();
})();
