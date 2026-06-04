/**
 * Loads events from /api/events (Airtable via Vercel) and renders listings.
 */
(function () {
  const API = '/api/events';

  const els = {
    status: document.getElementById('load-status'),
    featuredList: document.getElementById('featured-list'),
    spotlightTrack: document.getElementById('spotlight-track'),
    listings: document.getElementById('listings'),
    empty: document.getElementById('empty-state'),
    resultsCount: document.getElementById('results-count'),
    countAll: document.getElementById('count-all'),
    countMeeting: document.getElementById('count-meeting'),
    countExhibition: document.getElementById('count-exhibition'),
    industry: document.getElementById('industry'),
    location: document.getElementById('location'),
  };

  let events = [];
  let filtered = [];

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  /** Use in src="" only — do not escape & like escapeHtml (breaks Airtable CDN URLs). */
  function safePhotoUrl(url) {
    if (!url) return '';
    return String(url)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function photoImg(url, className) {
    if (!url) return '';
    return `<img class="${className}" src="${safePhotoUrl(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
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
        <div class="premium-card-bg">${photoImg(ev.photo, 'premium-card-img')}</div>
        <div class="premium-card-overlay"></div>
        <span class="premium-badge">Premium</span>
        <span class="premium-price">${escapeHtml(ev.price)}</span>
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
      </article>`;
  }

  function listingRow(ev) {
    const typeLabel = ev.type === 'exhibition' ? 'Exhibition' : 'Meeting';
    const thumbClass = ev.photo ? 'thumb thumb--photo' : 'thumb';
    return `
      <article class="event-row" data-id="${escapeHtml(ev.id)}"
        data-type="${escapeHtml(ev.type)}"
        data-search="${escapeHtml(ev.search)}"
        data-location="${escapeHtml(ev.locationSlug)}"
        data-industry="${escapeHtml(ev.industrySlug)}"
        data-format="${escapeHtml(ev.formatSlug)}"
        data-price="${escapeHtml(ev.priceKey)}">
        <div class="${thumbClass}">${photoImg(ev.photo, 'thumb-img')}</div>
        <div>
          <span class="type-badge ${escapeHtml(ev.type)}">${typeLabel}</span>
          <h3>${escapeHtml(ev.title)}</h3>
          <p class="meta">${escapeHtml(ev.industry || 'General')} · ${escapeHtml(ev.format || '—')} · ${escapeHtml(ev.location || 'TBC')}${ev.organiser ? ` · ${escapeHtml(ev.organiser)}` : ''}</p>
        </div>
        <span class="actions">${escapeHtml(ev.price)} · View</span>
      </article>`;
  }

  function fillFilterOptions() {
    if (!els.industry || !els.location) return;
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

  function renderLists(list) {
    const premium = list.filter((e) => e.featured);
    const rest = list.filter((e) => !e.featured);

    if (els.spotlightTrack) {
      els.spotlightTrack.innerHTML = premium.length
        ? premium.map(premiumCard).join('')
        : '<p class="spotlight-empty">No premium events yet — mark rows as Featured in Airtable.</p>';
    }

    if (els.featuredList) {
      els.featuredList.innerHTML = premium.slice(0, 6).map(premiumCard).join('') || '';
      els.featuredList.closest('.featured')?.classList.toggle('is-hidden', !premium.length);
    }

    if (els.listings) {
      const rows = rest.length ? rest : list;
      els.listings.innerHTML =
        rows.map(listingRow).join('') +
        '<div class="empty-state" id="empty-state" role="status"><p>No events match your filters.</p><button type="button" id="empty-reset">Show all</button></div>';
      document.getElementById('empty-reset')?.addEventListener('click', window.hubResetFilters);
    }

    updateCounts(list);
    window.hubBindFilters?.();
  }

  function updateCounts(list) {
    const meetings = list.filter((e) => e.type === 'meeting').length;
    const exhibitions = list.filter((e) => e.type === 'exhibition').length;
    if (els.countAll) els.countAll.textContent = `(${list.length})`;
    if (els.countMeeting) els.countMeeting.textContent = `(${meetings})`;
    if (els.countExhibition) els.countExhibition.textContent = `(${exhibitions})`;
  }

  function setStatus(msg, isError) {
    if (!els.status) return;
    els.status.textContent = msg;
    els.status.classList.toggle('is-error', !!isError);
    els.status.hidden = !msg;
  }

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
      filtered = events.slice();
      fillFilterOptions();
      renderLists(filtered);
      window.hubAllEvents = events;
      window.hubApplyFilters?.();
    } catch (e) {
      setStatus('Could not reach /api/events. Deploy on Vercel or run `vercel dev` locally.', true);
      events = [];
      renderLists([]);
    }
  }

  window.hubReloadEvents = load;
  load();
})();
