/**
 * Event detail page — /api/events?id= or URL query fallback.
 */
(function () {
  window.hubEventDetailBooted = true;

  const BOOKING_FEE_RATE = 0.045;
  const BOOKING_FEE_PER_TICKET = 0.2;

  let currentEvent = null;
  let seriesDatesList = [];
  let seriesBaseEvent = null;
  let selectedSeriesEventId = null;
  let seriesCalMonth = new Date().getMonth();
  let seriesCalYear = new Date().getFullYear();
  let ticketPanelSetEvent = null;

  const MOCK_ORGANISER_REVIEWS = [
    {
      name: 'Sarah Mitchell',
      date: '12 May 2026',
      rating: 5,
      text: 'Brilliantly run events — welcoming hosts, sharp content, and genuinely useful connections every time.',
    },
    {
      name: 'James Okonkwo',
      date: '3 Apr 2026',
      rating: 4,
      text: 'Professional setup and a great mix of people. Would happily book again for our team.',
    },
    {
      name: 'Emma Clarke',
      date: '18 Mar 2026',
      rating: 4,
      text: 'Clear communication before the day and a well-paced session. Felt worth the ticket price.',
    },
  ];

  function fmt(n) {
    return '£' + Number(n).toFixed(2);
  }

  function hostInitials(name) {
    const parts = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const a = (parts[0] && parts[0][0]) || 'H';
    const b = (parts[1] && parts[1][0]) || (parts[0] && parts[0][1]) || 'N';
    return (a + b).toUpperCase();
  }

  function isSafeImgSrc(u) {
    const s = String(u || '').trim().toLowerCase();
    return s.indexOf('https:') === 0 || s.indexOf('http:') === 0 || s.indexOf('data:image/') === 0;
  }

  async function requireSignedInAttendee() {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      const data = await res.json();
      if (data.ok && data.user) return true;
    } catch (e) {
      /* ignore */
    }
    const next = encodeURIComponent(location.pathname + location.search);
    location.href = '/login.html?next=' + next;
    return false;
  }

  function starsFromAvg(avg) {
    const a = Number(avg);
    if (!Number.isFinite(a) || a <= 0) return '☆☆☆☆☆';
    const full = Math.min(5, Math.max(0, Math.round(a)));
    let s = '';
    for (let i = 1; i <= 5; i++) s += i <= full ? '★' : '☆';
    return s;
  }

  function slugifyTitle(title) {
    return String(title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 96);
  }

  function publicSlug(ev) {
    const stored = ev && ev.slug ? String(ev.slug).trim() : '';
    const uuidLike =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored);
    if (stored && !uuidLike) return stored;
    return slugifyTitle(ev && ev.title) || stored || '';
  }

  function canonicalEventPath(ev) {
    const slug = publicSlug(ev);
    if (slug) return '/events/' + encodeURIComponent(slug);
    if (ev && ev.id) return '/events/event.html?id=' + encodeURIComponent(ev.id);
    return window.location.pathname;
  }

  /** Vercel rewrites /events/:slug → event.html without exposing ?slug= in the browser URL. */
  function eventRouteFromLocation() {
    const params = new URLSearchParams(window.location.search);
    let id = params.get('id');
    let slug = params.get('slug');

    const path = String(window.location.pathname || '').replace(/\/+$/, '');
    const pretty = path.match(/\/events\/([^/]+)$/i);
    if (pretty) {
      const segment = decodeURIComponent(pretty[1]);
      if (segment !== 'event.html' && segment !== 'index.html' && !slug) {
        slug = segment;
      }
    }

    return { id, slug, params };
  }

  function formatHeroLabel(fmt) {
    const m = String(fmt || '').toLowerCase();
    if (m.includes('hybrid')) return 'Hybrid event';
    if (m.includes('online') && !m.includes('person')) return 'Online event';
    return 'In-person event';
  }

  function formatTagClass(fmt) {
    const m = String(fmt || '').toLowerCase();
    if (m.includes('hybrid')) return 'hybrid-tag';
    if (m.includes('online') && !m.includes('person')) return 'online-tag';
    return '';
  }

  function formatTagLabel(fmt) {
    const m = String(fmt || '').toLowerCase();
    if (m.includes('hybrid')) return 'HYBRID';
    if (m.includes('online') && !m.includes('person')) return 'ONLINE';
    return 'IN-PERSON';
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el && text != null && text !== '') el.textContent = text;
  }

  function parseBoolFlag(value) {
    if (value === true) return true;
    if (value === false || value == null || value === '') return false;
    const s = String(value).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'on';
  }

  function normalizeEventFlags(ev, params) {
    const p = params || new URLSearchParams(window.location.search);
    return {
      ...ev,
      isApprovalRequired:
        parseBoolFlag(ev.isApprovalRequired) || p.get('approval') === '1' || p.get('isApprovalRequired') === '1',
      isSoldOut: parseBoolFlag(ev.isSoldOut) || p.get('sold_out') === '1' || p.get('isSoldOut') === '1',
      isSalesClosed:
        parseBoolFlag(ev.isSalesClosed) || p.get('sales_closed') === '1' || p.get('isSalesClosed') === '1',
      isTicketSalesPending:
        parseBoolFlag(ev.isTicketSalesPending) ||
        p.get('ticket_sales_pending') === '1' ||
        p.get('isTicketSalesPending') === '1',
    };
  }

  function venueQuery(ev) {
    return [ev.venueName, ev.venueAddress, ev.venue, ev.postcode, ev.location]
      .filter(Boolean)
      .join(', ')
      .trim();
  }

  function organiserProfileHref(ev) {
    const slug = String(ev.organiserSlug || ev.organiser_slug || '').trim();
    if (slug) return '/organisers/' + encodeURIComponent(slug);
    const id = String(ev.organiserId || ev.organiser_id || '').trim();
    if (id) return 'organiser.html?id=' + encodeURIComponent(id);
    return '';
  }

  function applyHostBlock(ev) {
    const host = ev.organiser || 'Event organiser';
    setText('ev-host-name', host);

    const rankingEl = document.getElementById('ev-host-ranking');
    if (rankingEl) {
      const label = ev.organiserRanking?.displayLabel || '';
      if (label) {
        const tier = ev.organiserRanking?.tier || 'top10';
        rankingEl.hidden = false;
        rankingEl.className = 'ev-host-ranking hub-ranking-badge hub-ranking-badge--' + tier;
        rankingEl.textContent = '★ ' + label;
        rankingEl.title = ev.organiserRanking?.displayLabel || label;
      } else {
        rankingEl.hidden = true;
        rankingEl.textContent = '';
        rankingEl.className = 'ev-host-ranking';
        rankingEl.removeAttribute('title');
      }
    }

    const logoEl = document.getElementById('ev-host-logo');
    const initialsEl = document.getElementById('ev-host-initials');
    const avatar = document.getElementById('ev-host-avatar');
    const logo = ev.organiserLogo || '';

    if (logoEl && initialsEl && avatar) {
      if (logo && isSafeImgSrc(logo)) {
        logoEl.src = logo;
        logoEl.alt = host + ' logo';
        logoEl.hidden = false;
        initialsEl.hidden = true;
        avatar.classList.add('has-logo');
      } else {
        logoEl.hidden = true;
        logoEl.removeAttribute('src');
        initialsEl.hidden = false;
        initialsEl.textContent = hostInitials(host);
        avatar.classList.remove('has-logo');
      }
    }

    const profileEl = document.getElementById('ev-host-profile');
    if (profileEl) {
      if (ev.organiserProfile) {
        profileEl.textContent = ev.organiserProfile;
      } else if (ev.organiser) {
        profileEl.textContent =
          ev.organiser +
          ' hosts curated networking events across the UK. Full company profile coming soon.';
      } else {
        profileEl.textContent =
          'The organiser is completing their group profile. Check back soon for host details.';
      }
    }

    const profileLink = document.getElementById('ev-host-profile-link');
    if (profileLink) {
      const href = organiserProfileHref(ev);
      if (href) {
        profileLink.href = href;
        profileLink.hidden = false;
      } else {
        profileLink.removeAttribute('href');
        profileLink.hidden = true;
      }
    }

    const indEl = document.getElementById('ev-host-industry');
    if (indEl) {
      if (ev.industry) {
        indEl.textContent = ev.industry;
        indEl.hidden = false;
      } else indEl.hidden = true;
    }

    const metaWrap = document.getElementById('ev-host-meta');
    const ratingMeta = document.getElementById('ev-host-rating-meta');
    const reviewCount = Number(ev.reviews) || 0;
    const rating = Number(ev.rating) || 0;
    if (metaWrap && ratingMeta && reviewCount > 0 && rating > 0) {
      ratingMeta.textContent =
        '★ ' + rating.toFixed(1) + ' average · ' + reviewCount + ' review' + (reviewCount === 1 ? '' : 's');
      metaWrap.hidden = false;
    } else if (metaWrap) metaWrap.hidden = true;
  }

  function applyMapAndDirections(ev) {
    const q = venueQuery(ev);
    const dir = document.getElementById('ev-directions');
    if (dir && q) {
      dir.href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(q);
    }

    const iframe = document.getElementById('ev-map-iframe');
    if (iframe) {
      if (q) {
        iframe.src =
          'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&z=15&output=embed';
        iframe.hidden = false;
      } else {
        iframe.removeAttribute('src');
        iframe.hidden = true;
      }
    }
  }

  function eventDetailHref(ev) {
    const slug = publicSlug(ev);
    if (slug) return '/events/' + encodeURIComponent(slug);
    return 'event.html?id=' + encodeURIComponent(ev.id);
  }

  function renderRelated(related) {
    const grid = document.getElementById('ev-related-grid');
    const empty = document.getElementById('ev-related-empty');
    const section = document.getElementById('ev-related-section');
    if (!grid) return;

    grid.innerHTML = '';
    const list = (related || []).filter((e) => e && e.id);

    if (!list.length) {
      if (empty) empty.hidden = false;
      if (section) section.classList.add('is-empty-related');
      return;
    }

    if (empty) empty.hidden = true;
    if (section) section.classList.remove('is-empty-related');

    list.forEach((ev) => {
      const card = document.createElement('a');
      card.className = 'related-card';
      card.href = eventDetailHref(ev);

      const imgWrap = document.createElement('div');
      imgWrap.className = 'related-img';

      const img = document.createElement('img');
      const resolvedSrc = window.getEventImage
        ? window.getEventImage(ev)
        : window.getFlexibleEventImage
          ? window.getFlexibleEventImage(ev.photo, ev.organiserLogo, ev.id)
          : ev.photo || '';
      const fallbackSrc = window.getEventPlacementImage
        ? window.getEventPlacementImage(ev.id, ev.eventType || ev.typeRaw)
        : resolvedSrc;
      img.src = resolvedSrc;
      img.alt = '';
      img.loading = 'lazy';
      img.onerror = function () {
        img.onerror = null;
        img.src = fallbackSrc;
      };
      imgWrap.appendChild(img);

      const pill = document.createElement('span');
      pill.className = 'mini-pill';
      pill.textContent = ev.typeRaw || ev.typeCategory || 'Event';
      imgWrap.appendChild(pill);

      const price = document.createElement('span');
      price.className = 'mini-price';
      price.textContent = ev.priceKey === 'free' ? 'Free' : ev.price || '—';
      imgWrap.appendChild(price);

      const body = document.createElement('div');
      body.className = 'related-body';

      const tag = document.createElement('div');
      tag.className = 'format-tag ' + formatTagClass(ev.format);
      tag.textContent = formatTagLabel(ev.format);
      body.appendChild(tag);

      const h4 = document.createElement('h4');
      h4.textContent = ev.title;
      body.appendChild(h4);

      const when = document.createElement('div');
      when.className = 'when';
      when.textContent = ev.dateLine || [ev.location, ev.date, ev.time].filter(Boolean).join(' · ');
      body.appendChild(when);

      card.appendChild(imgWrap);
      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  function updateBreadcrumbTrail(ev) {
    const mid = String(ev.typeRaw || ev.typeCategory || ev.eventType || '').trim();
    const catEl = document.getElementById('ev-trail-category');
    if (!catEl) return;
    const sepBefore = catEl.previousElementSibling;
    const sepAfter = document.getElementById('ev-trail-sep-after') || catEl.nextElementSibling;
    if (mid) {
      catEl.textContent = mid;
      catEl.href = 'index.html';
      catEl.hidden = false;
      if (sepBefore && sepBefore.classList.contains('sep')) sepBefore.hidden = false;
      if (sepAfter) sepAfter.hidden = false;
    } else {
      catEl.hidden = true;
      if (sepBefore && sepBefore.classList.contains('sep')) sepBefore.hidden = true;
      if (sepAfter) sepAfter.hidden = true;
    }
  }

  function renderAboutSection(ev) {
    const lead = document.getElementById('ev-about-lead');
    const extra = document.getElementById('ev-about-extra');
    const heading = document.getElementById('ev-included-heading');
    const list = document.getElementById('ev-included-list');
    const desc = String(ev.description || '').trim();

    if (lead) {
      lead.textContent =
        desc || 'Join us for ' + ev.title + '. Full details will be shared with ticket holders.';
    }
    if (extra) extra.hidden = true;

    if (!list) return;
    list.innerHTML = '';
    const bullets = Array.isArray(ev.highlights) ? ev.highlights.filter(Boolean) : [];
    if (ev.foodIncluded) bullets.push('Food or drink included with your ticket');

    if (bullets.length) {
      if (heading) heading.hidden = false;
      bullets.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
      });
    } else if (heading) {
      heading.hidden = true;
    }
  }

  function renderRatingBlock(ev) {
    const wrap = document.getElementById('ev-rating-wrap');
    const stars = document.getElementById('ev-rating-stars');
    const cnt = document.getElementById('ev-rating-count');
    const reviewCount = Number(ev.reviews) || 0;
    const rating = Number(ev.rating) || 0;

    if (!wrap) return;
    if (!reviewCount || rating <= 0) {
      wrap.hidden = true;
      return;
    }

    wrap.hidden = false;
    if (stars) stars.textContent = starsFromAvg(rating);
    if (cnt) {
      cnt.textContent = rating.toFixed(1) + ' (' + reviewCount + ' review' + (reviewCount === 1 ? '' : 's') + ')';
    }
    wrap.setAttribute(
      'aria-label',
      rating.toFixed(1) + ' out of 5 from ' + reviewCount + ' reviews'
    );
  }

  function updateCanonicalUrl(ev) {
    const path = canonicalEventPath(ev);
    if (!path || window.location.pathname + window.location.search === path) return;
    try {
      history.replaceState(null, '', path);
    } catch {
      /* ignore */
    }
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function dateKeyFromParts(y, m, d) {
    return y + '-' + pad2(m + 1) + '-' + pad2(d);
  }

  function dateKeyFromIso(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return dateKeyFromParts(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function mergeSeriesDateEntry(baseEv, entry) {
    return Object.assign({}, baseEv, entry, {
      tickets: entry.tickets || baseEv.tickets,
    });
  }

  function updateEventDateMeta(ev) {
    const dateLabel =
      ev.date ||
      (ev.dateFieldRaw
        ? new Date(ev.dateFieldRaw).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : '');
    setText('ev-meta-starts', dateLabel || 'Date to be confirmed');
    const timeRow = document.getElementById('ev-meta-time-row');
    if (ev.time) {
      setText('ev-meta-time', ev.time);
      if (timeRow) timeRow.style.display = '';
    } else if (timeRow) timeRow.style.display = 'none';
  }

  function formatSeriesSelectedLine(entry) {
    const parts = [entry.date, entry.time].filter(Boolean);
    let line = parts.join(' · ');
    if (entry.isSoldOut) line += ' · Sold out';
    return line;
  }

  function seriesDatesByKey() {
    const map = new Map();
    seriesDatesList.forEach((entry) => {
      const key = dateKeyFromIso(entry.dateRaw || entry.dateFieldRaw);
      if (key) map.set(key, entry);
    });
    return map;
  }

  function updateSeriesDateCopy() {
    const hint = document.getElementById('ev-series-dates-hint');
    if (!hint) return;
    const n = seriesDatesList.length;
    const word = n === 1 ? 'date' : 'dates';
    hint.textContent =
      'This event runs on multiple ' +
      word +
      '. Pick the one you want to attend.';
  }

  function renderSeriesCalendar() {
    const grid = document.getElementById('ev-cal-days');
    const label = document.getElementById('ev-cal-month-label');
    if (!grid) return;

    const datesMap = seriesDatesByKey();
    const first = new Date(seriesCalYear, seriesCalMonth, 1);
    if (label) {
      label.textContent = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }

    const startDow = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(seriesCalYear, seriesCalMonth + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    grid.innerHTML = '';
    const prevMonthDays = new Date(seriesCalYear, seriesCalMonth, 0).getDate();

    for (let i = 0; i < startDow; i++) {
      const day = prevMonthDays - startDow + i + 1;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ev-cal-day is-other';
      btn.textContent = String(day);
      btn.disabled = true;
      btn.tabIndex = -1;
      grid.appendChild(btn);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const key = dateKeyFromParts(seriesCalYear, seriesCalMonth, d);
      const entry = datesMap.get(key);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ev-cal-day';
      btn.textContent = String(d);
      const cellDate = new Date(seriesCalYear, seriesCalMonth, d);

      if (entry) {
        btn.classList.add('is-available');
        if (entry.isSoldOut) btn.classList.add('is-sold-out');
        if (entry.id === selectedSeriesEventId) btn.classList.add('is-selected');
        btn.setAttribute('aria-label', formatSeriesSelectedLine(entry));
        if (cellDate < today) {
          btn.classList.add('is-past');
          btn.disabled = true;
        } else {
          btn.addEventListener('click', () => selectSeriesDate(entry));
        }
      } else if (cellDate < today) {
        btn.classList.add('is-past');
        btn.disabled = true;
      }

      grid.appendChild(btn);
    }

    const totalCells = startDow + daysInMonth;
    const trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= trailing; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ev-cal-day is-other';
      btn.textContent = String(i);
      btn.disabled = true;
      btn.tabIndex = -1;
      grid.appendChild(btn);
    }
  }

  function selectSeriesDate(entry) {
    if (!entry || !seriesBaseEvent) return;
    selectedSeriesEventId = entry.id;
    const merged = mergeSeriesDateEntry(seriesBaseEvent, entry);
    currentEvent = merged;
    updateEventDateMeta(merged);
    const selectedEl = document.getElementById('ev-series-selected');
    if (selectedEl) selectedEl.textContent = 'Selected: ' + formatSeriesSelectedLine(entry);
    renderSeriesCalendar();
    if (ticketPanelSetEvent) ticketPanelSetEvent(merged);
  }

  function initSeriesDatePicker(initialEv) {
    const wrap = document.getElementById('ev-series-dates');
    if (!wrap || seriesDatesList.length <= 1) {
      if (wrap) wrap.hidden = true;
      return;
    }

    wrap.hidden = false;
    updateSeriesDateCopy();

    const now = Date.now() - 86400000;
    const upcoming = seriesDatesList.find((item) => {
      const ts =
        item.dateTs != null
          ? Number(item.dateTs)
          : item.dateRaw
            ? new Date(item.dateRaw).getTime()
            : 0;
      return ts >= now;
    });
    const initialEntry =
      seriesDatesList.find((item) => item.id === initialEv.id) || upcoming || seriesDatesList[0];

    if (initialEntry && initialEntry.dateRaw) {
      const d = new Date(initialEntry.dateRaw);
      if (!Number.isNaN(d.getTime())) {
        seriesCalMonth = d.getMonth();
        seriesCalYear = d.getFullYear();
      }
    }

    if (initialEntry && initialEntry.id !== initialEv.id && ticketPanelSetEvent) {
      selectSeriesDate(initialEntry);
      return;
    }

    if (!wrap.dataset.bound) {
      wrap.dataset.bound = '1';
      document.getElementById('ev-cal-prev')?.addEventListener('click', () => {
        seriesCalMonth -= 1;
        if (seriesCalMonth < 0) {
          seriesCalMonth = 11;
          seriesCalYear -= 1;
        }
        renderSeriesCalendar();
      });
      document.getElementById('ev-cal-next')?.addEventListener('click', () => {
        seriesCalMonth += 1;
        if (seriesCalMonth > 11) {
          seriesCalMonth = 0;
          seriesCalYear += 1;
        }
        renderSeriesCalendar();
      });
    }

    selectedSeriesEventId = initialEv.id;
    renderSeriesCalendar();
    const selectedEl = document.getElementById('ev-series-selected');
    if (selectedEl && initialEntry) {
      selectedEl.textContent = 'Selected: ' + formatSeriesSelectedLine(initialEntry);
    }
  }

  function populateFromEvent(ev) {
    currentEvent = ev;
    document.title = ev.title + ' – The Networker Hub';
    document.body.setAttribute('data-event-id', ev.id);
    setText('ev-title', ev.title);
    setText('ev-trail-current', ev.title);
    setText('ev-category', ev.typeRaw || ev.typeCategory || ev.format || 'Event');
    updateBreadcrumbTrail(ev);
    updateCanonicalUrl(ev);

    const priceLabel = ev.priceKey === 'free' ? 'Free' : ev.price;
    setText('ev-price', ev.priceKey === 'free' ? 'Free' : 'from ' + ev.price);
    setText('ev-ticket-from-price', priceLabel);
    setText('ev-format', formatHeroLabel(ev.format));

    const hero = document.getElementById('ev-hero-img');
    if (hero) {
      const resolvedSrc = window.getEventImage
        ? window.getEventImage(ev)
        : window.getFlexibleEventImage
          ? window.getFlexibleEventImage(ev.photo, ev.organiserLogo, ev.id)
          : ev.photo || '';
      const fallbackSrc = window.getEventPlacementImage
        ? window.getEventPlacementImage(ev.id, ev.eventType || ev.typeRaw)
        : resolvedSrc;
      hero.loading = 'lazy';
      hero.decoding = 'async';
      hero.src = resolvedSrc;
      hero.alt = ev.title;
      hero.onerror = function () {
        hero.onerror = null;
        hero.src = fallbackSrc;
      };
    }

    updateEventDateMeta(ev);

    const cityLabel = ev.city || ev.outcode || ev.locationShort || 'Location TBC';
    setText('ev-meta-city', cityLabel);

    renderRatingBlock(ev);
    applyHostBlock(ev);

    const vn = String(ev.venue || ev.venueName || '').trim();
    const va = [ev.address, ev.city, ev.postcode].filter(Boolean).join(', ') || ev.venueAddress || '';
    setText('ev-venue-name', vn || 'Venue TBC');
    setText('ev-venue-addr', va);
    applyMapAndDirections(ev);
    renderAboutSection(ev);

    renderTicketPanel(ev);
    renderRefundPolicy(ev);
    setText('ev-related-title', 'More from ' + (ev.organiser || 'this organiser'));
    renderOrganiserReviews(ev);
    applyTicketPanelState(ev);
    wireListingReport(ev);
  }

  function wireListingReport(ev) {
    const btn = document.getElementById('ev-report-btn');
    if (!btn || !window.ListingReport || !ev || !ev.id) return;
    window.ListingReport.attachTrigger(btn, {
      listingType: 'event',
      eventId: ev.id,
      title: ev.title || 'Event',
    });
  }

  function refundPolicyDetailText(ev) {
    const policy = ev.refundPolicy || ev.refund_policy || '';
    if (!policy) return 'No refund policy has been set for this event. Contact the organiser before booking.';
    if (policy === 'full_refund') {
      const days = ev.refundCutoffDays != null ? ev.refundCutoffDays : ev.refund_cutoff_days;
      return days != null
        ? 'Full refunds are available up to ' + days + ' day' + (days === 1 ? '' : 's') + ' before the event.'
        : 'Full refunds are available before the event.';
    }
    if (policy === 'partial_refund') {
      return ev.refundPolicyDetails || ev.refund_policy_details || 'Partial refunds apply — see organiser terms.';
    }
    if (policy === 'no_refunds') {
      return 'Ticket sales are final for this event. The 14-day cooling-off right does not apply to leisure events on a specific date.';
    }
    if (policy === 'custom') {
      return ev.refundPolicyDetails || ev.refund_policy_details || 'See organiser refund policy.';
    }
    return 'See organiser refund policy.';
  }

  function renderRefundPolicy(ev) {
    const badge = document.getElementById('ev-refund-badge');
    const details = document.getElementById('ev-refund-details');
    const body = document.getElementById('ev-refund-details-body');
    if (!badge) return;

    const policy = ev.refundPolicy || ev.refund_policy || '';
    if (!policy) {
      badge.hidden = true;
      if (details) details.hidden = true;
      return;
    }

    let label = '';
    let cls = '';
    let detailText = '';

    if (policy === 'full_refund') {
      label = '✓ Full refunds available';
      cls = 'is-full';
      const days = ev.refundCutoffDays != null ? ev.refundCutoffDays : ev.refund_cutoff_days;
      detailText =
        days != null
          ? 'Full refunds are available up to ' + days + ' day' + (days === 1 ? '' : 's') + ' before the event.'
          : 'Full refunds are available before the event.';
    } else if (policy === 'partial_refund') {
      label = '~ Partial refunds — see policy';
      cls = 'is-partial';
      detailText = ev.refundPolicyDetails || ev.refund_policy_details || 'Partial refunds apply — see organiser terms.';
    } else if (policy === 'no_refunds') {
      label = 'All sales final — no refunds';
      cls = 'is-none';
      detailText = 'Ticket sales are final for this event.';
    } else if (policy === 'custom') {
      label = 'ℹ Custom refund policy';
      cls = 'is-custom';
      detailText = ev.refundPolicyDetails || ev.refund_policy_details || 'See organiser refund policy below.';
    } else {
      badge.hidden = true;
      if (details) details.hidden = true;
      return;
    }

    badge.textContent = label;
    badge.className = 'refund-badge ' + cls;
    badge.hidden = false;

    if (details && body) {
      body.textContent = detailText;
      details.hidden = !detailText;
    }
  }

  let currentEventDetail = null;
  const BOOKING_PENDING_KEY = 'hub_booking_pending';
  let checkoutSessionUser = null;
  let checkoutUseSlimPaid = false;

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(value || '').trim()
    );
  }

  function getStripeBaseUrl(ev, tierEl) {
    const fromTier = tierEl && tierEl.getAttribute('data-stripe-link');
    if (fromTier && fromTier.trim()) return fromTier.trim();
    if (ev && ev.stripePaymentLink) return String(ev.stripePaymentLink).trim();
    const meta = document.querySelector('meta[name="stripe-payment-link"]');
    const fromMeta = meta && meta.getAttribute('content') ? meta.getAttribute('content').trim() : '';
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('stripe') || params.get('payment_link');
    return (fromQuery || fromMeta || '').trim();
  }

  function getSelectedTierEl() {
    return document.querySelector('#ticket-tiers .tier.selected:not(.sold-out):not(.tier-disabled)');
  }

  function buildStripeCheckoutUrl(ev, tierEl, qty, label) {
    const base = getStripeBaseUrl(ev, tierEl);
    if (!base) return null;
    try {
      const u = new URL(base);
      const evId = ev && ev.id ? String(ev.id) : '';
      const ticketId = tierEl ? tierEl.getAttribute('data-ticket-id') || '' : '';
      const ref =
        (evId ? 'id' + evId + '-' : '') +
        (ticketId ? 'ticket-' + ticketId + '-' : '') +
        'qty-' +
        String(qty) +
        '-' +
        String(label || 'ticket')
          .replace(/\s+/g, '-')
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '');
      u.searchParams.set('client_reference_id', ref.slice(0, 200));
      if (qty > 1) u.searchParams.set('quantity', String(qty));
      return u.toString();
    } catch (err) {
      return base;
    }
  }

  function seriesKeyFromContext() {
    if (!seriesDatesList || seriesDatesList.length <= 1 || !seriesBaseEvent) return '';
    return (
      's:' +
      String(seriesBaseEvent.organiserId || '').trim() +
      ':' +
      String(seriesBaseEvent.title || '').trim().toLowerCase()
    );
  }

  function saveBookingPending(ev, ticketId, qty, attendee) {
    const seriesKey = seriesKeyFromContext();
    const eventImage = window.getEventImage
      ? window.getEventImage(ev)
      : window.getFlexibleEventImage
        ? window.getFlexibleEventImage(ev.photo, ev.organiserLogo, ev.id)
        : ev.photo || '';
    try {
      sessionStorage.setItem(
        BOOKING_PENDING_KEY,
        JSON.stringify({
          eventId: ev.id,
          ticketId: isUuid(ticketId) ? ticketId : null,
          qty: qty,
          email: attendee && attendee.email ? String(attendee.email).trim().toLowerCase() : '',
          name: attendee && attendee.name ? String(attendee.name).trim() : '',
          eventTitle: ev.title || '',
          eventImage: eventImage || '',
          ts: Date.now(),
          seriesKey: seriesKey || null,
          seriesTitle: seriesBaseEvent && seriesBaseEvent.title ? seriesBaseEvent.title : ev.title || '',
        })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function checkoutAttendeeFromSession() {
    if (!checkoutSessionUser) return null;
    const email = String(checkoutSessionUser.email || '')
      .trim()
      .toLowerCase();
    if (!email) return null;
    let name = String(checkoutSessionUser.name || '').trim();
    if (!name) {
      const local = email.split('@')[0] || '';
      name = local.replace(/[._-]+/g, ' ').trim() || 'Guest';
    }
    return { email, name, guestNames: [] };
  }

  function wantsSlimPaidCheckout(qty, total) {
    if (!(total > 0)) return false;
    if (Math.max(1, parseInt(qty, 10) || 1) !== 1) return false;
    return Boolean(checkoutAttendeeFromSession());
  }

  function checkoutErrorMessage(data) {
    const code = data && data.error ? String(data.error) : '';
    const messages = {
      invalid_event_id: 'This event could not be loaded for checkout. Refresh the page and try again.',
      event_not_found: 'This event is no longer available.',
      event_not_published: 'This event is not open for bookings yet.',
      ticket_not_found: 'That ticket type is no longer available.',
      ticket_sold_out: 'Sorry — that ticket tier is sold out.',
      ticket_sales_disabled: 'Ticket sales are not open for this event yet.',
      missing_email: 'Please enter your email address.',
      missing_name: 'Please enter your full name.',
      stripe_connect_required:
        'The organiser has not finished payout setup. Ticket sales are temporarily unavailable.',
      free_ticket_use_complete_booking: 'Use Confirm registration for free tickets.',
    };
    if (data && data.message) return String(data.message);
    if (messages[code]) return messages[code];
    if (code) return 'Checkout could not start (' + code + '). Please try again.';
    return 'Could not start checkout. Please try again or contact support.';
  }

  async function startPaidCheckout(ev, ticketId, qty, attendee) {
    saveBookingPending(ev, ticketId, qty, attendee);
    const res = await fetch('/api/auth/create-checkout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: ev.id,
        ticketId: isUuid(ticketId) ? ticketId : null,
        qty: qty,
        name: attendee?.name || '',
        email: attendee?.email || '',
        guestNames: attendee?.guestNames || [],
      }),
    });
    const data = await res.json().catch(function () {
      return {};
    });
    if (res.ok && data.ok && data.url) {
      window.location.assign(data.url);
      return true;
    }
    if (data.error === 'stripe_not_configured') {
      clearBookingPending();
      return false;
    }
    clearBookingPending();
    throw new Error(checkoutErrorMessage(data));
  }

  async function completeFreeBooking(ev, ticketId, qty, attendee) {
    saveBookingPending(ev, ticketId, qty, attendee);
    const res = await fetch('/api/auth/complete-booking', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: ev.id,
        ticketId: isUuid(ticketId) ? ticketId : null,
        qty: qty || 1,
        amountPaid: 0,
        paymentStatus: 'Free',
        name: attendee?.name || '',
        email: attendee?.email || '',
        guestNames: attendee?.guestNames || [],
      }),
    });
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok || !data.ok) {
      throw new Error((data && data.message) || (data && data.error) || 'booking_failed');
    }
    window.location.assign('/events/booking-success.html?free=1&confirmed=1');
  }

  function clearBookingPending() {
    try {
      sessionStorage.removeItem(BOOKING_PENDING_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function ticketTiersForEvent(ev) {
    if (ev.tickets && ev.tickets.length) return ev.tickets;
    return [
      {
        id: (ev.id || 'event') + '-standard',
        name: 'Standard ticket',
        description:
          ev.priceKey === 'free' ? 'Free admission' : 'Ticket includes full event access',
        price: ev.price,
        priceKey: ev.priceKey,
        priceNum: ev.priceKey === 'free' ? 0 : Number(ev.priceNum) || 0,
        soldOut: Boolean(ev.isSoldOut),
        quantityAvailable: ev.spotsLeft,
        label: 'Standard',
      },
    ];
  }

  function renderVatNote(ev, tiers) {
    const el = document.getElementById('ev-vat-note');
    if (!el) return;

    let treatment = String(ev.vatTreatment || ev.vat_treatment || '').trim();
    const hasPaidTier = (tiers || []).some((t) => {
      const priceNum = t.priceKey === 'free' ? 0 : Number(t.priceNum) || 0;
      return priceNum > 0;
    });

    if (!hasPaidTier) {
      el.hidden = true;
      el.textContent = '';
      return;
    }

    if (!treatment) treatment = 'included';

    el.textContent =
      treatment === 'added' ? 'VAT added at checkout' : 'Prices include VAT';
    el.hidden = false;
  }

  function tierRemainingCount(t) {
    const cap = t.quantityAvailable;
    if (cap == null || !Number.isFinite(Number(cap))) return null;
    const sold = Math.max(0, Number(t.registrationsCount) || 0);
    return Math.max(0, Number(cap) - sold);
  }

  function tierRemainingLabel(t) {
    const left = tierRemainingCount(t);
    if (left == null || left <= 0) return '';
    if (left === 1) return 'Only 1 ticket left';
    if (left <= 5) return 'Only ' + left + ' tickets left';
    const cap = Number(t.quantityAvailable);
    if (Number.isFinite(cap) && left <= Math.max(10, Math.ceil(cap * 0.2))) {
      return left + ' tickets remaining';
    }
    return '';
  }

  function renderTicketPanel(ev) {
    const tiersEl = document.getElementById('ticket-tiers');
    const urgencyEl = document.getElementById('ev-urgency');
    if (!tiersEl) return;

    const tiers = ticketTiersForEvent(ev);
    const salesPending = Boolean(ev.isTicketSalesPending);
    const panelClosed = ev.isSoldOut || (ev.isSalesClosed && !salesPending);
    tiersEl.innerHTML = '';

    let firstSelectable = null;

    tiers.forEach((t, index) => {
      const soldOut = Boolean(t.soldOut) || panelClosed;
      const priceNum = t.priceKey === 'free' ? 0 : Number(t.priceNum) || 0;
      const priceDisplay = t.priceKey === 'free' ? 'Free' : t.price || fmt(priceNum);
      const remainingLabel = soldOut ? '' : tierRemainingLabel(t);
      const subtitle = soldOut
        ? 'Sold out'
        : remainingLabel || t.description || '';

      const tier = document.createElement('div');
      tier.className = 'tier' + (soldOut ? ' sold-out tier-disabled' : '');
      tier.id = index === 0 ? 'ev-tier-standard' : 'ev-tier-' + t.id;
      tier.setAttribute('data-ticket-id', t.id);
      tier.setAttribute('data-price', String(priceNum));
      tier.setAttribute('data-label', t.label || t.name || 'Ticket');
      if (t.stripePaymentLink) tier.setAttribute('data-stripe-link', t.stripePaymentLink);
      const cap = t.quantityAvailable;
      const sold = Math.max(0, Number(t.registrationsCount) || 0);
      if (cap != null && Number.isFinite(Number(cap))) {
        tier.setAttribute('data-qty-max', String(Math.max(0, Number(cap) - sold)));
      } else {
        tier.setAttribute('data-qty-max', '99');
      }

      if (!soldOut) {
        tier.setAttribute('role', 'button');
        tier.setAttribute('tabindex', '0');
        if (!firstSelectable) {
          firstSelectable = tier;
          tier.classList.add('selected');
          tier.setAttribute('aria-pressed', 'true');
        } else {
          tier.setAttribute('aria-pressed', 'false');
        }
      } else {
        tier.setAttribute('aria-disabled', 'true');
      }

      tier.innerHTML =
        '<div class="tier-radio" aria-hidden="true"></div>' +
        '<div class="tier-info"><strong>' +
        escapeHtml(t.name || 'Ticket') +
        '</strong><span class="tier-subtitle">' +
        escapeHtml(subtitle) +
        '</span>' +
        (remainingLabel
          ? '<span class="tier-remaining-badge">' + escapeHtml(remainingLabel) + '</span>'
          : '') +
        '</div>' +
        '<div class="tier-price">' +
        escapeHtml(priceDisplay) +
        '</div>';

      tiersEl.appendChild(tier);
    });

    if (!firstSelectable && tiersEl.children.length) {
      const hint = ev.isSoldOut
        ? 'All ticket tiers are currently sold out.'
        : 'Tickets are not currently available for this event.';
      tiersEl.innerHTML = '<p class="ticket-load-hint">' + hint + '</p>';
    }

    renderVatNote(ev, tiers);

    const fromPrice = ev.priceKey === 'free' ? 'Free' : ev.price || '—';
    setText('ev-ticket-from-price', fromPrice);
    const heroPrice = document.getElementById('ev-price');
    if (heroPrice && ev.priceKey !== 'free') {
      heroPrice.textContent = 'from ' + (ev.price || fromPrice);
    }

    if (urgencyEl) {
      urgencyEl.classList.remove('is-sold-out');
      if (ev.urgency) {
        urgencyEl.textContent = ev.urgency;
        urgencyEl.hidden = false;
        if (ev.spotsLeft === 0 || ev.isSoldOut) urgencyEl.classList.add('is-sold-out');
      } else if (ev.isSoldOut) {
        urgencyEl.textContent = 'Sold out';
        urgencyEl.hidden = false;
        urgencyEl.classList.add('is-sold-out');
      } else {
        const scarce = tiers
          .filter((t) => !t.soldOut)
          .map((t) => ({ t, left: tierRemainingCount(t), label: tierRemainingLabel(t) }))
          .filter((x) => x.label);
        if (scarce.length) {
          const lowest = scarce.reduce((a, b) => (a.left < b.left ? a : b));
          urgencyEl.textContent = lowest.label;
          urgencyEl.hidden = false;
        } else {
          urgencyEl.hidden = true;
        }
      }
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderOrganiserReviews(ev) {
    const section = document.getElementById('ev-reviews-section');
    const scoreEl = document.getElementById('ev-reviews-score');
    const starsEl = document.getElementById('ev-reviews-score-stars');
    const countEl = document.getElementById('ev-reviews-score-count');
    const feed = document.getElementById('ev-reviews-feed');
    const r = Number(ev.rating) || 0;
    const c = Number(ev.reviews) || 0;
    const hasReviews = c > 0 && r > 0;

    if (section) section.hidden = !hasReviews;
    if (!hasReviews) {
      if (feed) feed.innerHTML = '';
      return;
    }

    if (scoreEl) {
      scoreEl.innerHTML = r.toFixed(1) + '<span class="reviews-score-max"> / 5</span>';
    }
    if (starsEl) starsEl.textContent = starsFromAvg(r);
    if (countEl) countEl.textContent = 'Based on ' + c + ' review' + (c === 1 ? '' : 's');
    if (!feed) return;

    feed.innerHTML = '';
    const reviewItems = Array.isArray(ev.reviewItems) ? ev.reviewItems : [];
    const reviewContext = {
      organiserId: ev.organiserId || ev.organiser_id || null,
      eventId: ev.id || null,
    };
    if (reviewItems.length) {
      reviewItems.forEach((review) => {
        appendReviewCard(feed, review, reviewContext);
      });
      return;
    }
    if (c > 0 && c <= MOCK_ORGANISER_REVIEWS.length) {
      MOCK_ORGANISER_REVIEWS.slice(0, c).forEach((review) => {
        appendReviewCard(feed, review, reviewContext);
      });
      return;
    }
    if (c > 0) {
      const placeholder = document.createElement('p');
      placeholder.className = 'reviews-empty-note';
      placeholder.textContent = 'Attendee reviews will appear here as they are submitted.';
      feed.appendChild(placeholder);
    }
  }

  function appendReviewCard(feed, review, context) {
    const card = document.createElement('article');
    card.className = 'review-card';
    const header = document.createElement('div');
    header.className = 'review-card-header';
    const name = document.createElement('strong');
    name.textContent = review.name;
    const date = document.createElement('span');
    date.className = 'review-card-date';
    date.textContent = review.date;
    header.appendChild(name);
    header.appendChild(date);
    const stars = document.createElement('div');
    stars.className = 'review-card-stars';
    stars.setAttribute('aria-label', review.rating + ' out of 5 stars');
    stars.textContent = starsFromAvg(review.rating);
    const body = document.createElement('p');
    body.textContent = review.text;
    card.appendChild(header);
    card.appendChild(stars);
    card.appendChild(body);
    if (review.id && window.ReviewReport) {
      window.ReviewReport.addReportButton(card, {
        reviewId: review.id,
        organiserId: context && context.organiserId,
        eventId: context && context.eventId,
        snippet: String(review.text || '').slice(0, 500),
      });
    }
    feed.appendChild(card);
  }

  function showSeatApplication(show) {
    const panel = document.getElementById('tickets');
    if (panel) {
      panel.classList.toggle('show-application', show);
      if (show) panel.classList.remove('show-checkout');
    }
  }

  function showCheckoutDetails(show) {
    const panel = document.getElementById('tickets');
    const form = document.getElementById('checkout-details-form');
    const secureFoot = document.getElementById('ticket-secure-foot');
    if (panel) {
      panel.classList.toggle('show-checkout', show);
      if (show) panel.classList.remove('show-application');
    }
    if (form) form.hidden = !show;
    if (secureFoot && !show) secureFoot.hidden = false;
    if (!show) setCheckoutSubmitting(false);
  }

  function setCheckoutSubmitting(active, title) {
    const panel = document.getElementById('tickets');
    const overlay = document.getElementById('checkout-submitting');
    const titleEl = document.getElementById('checkout-submitting-title');
    const confirmBtn = document.getElementById('checkout-confirm-btn');
    const buyBtn = document.getElementById('buy-btn');

    if (panel) panel.classList.toggle('is-submitting', Boolean(active));
    if (overlay) {
      overlay.hidden = !active;
      overlay.setAttribute('aria-busy', active ? 'true' : 'false');
    }
    if (titleEl && title) titleEl.textContent = title;
    if (confirmBtn) {
      confirmBtn.disabled = Boolean(active);
      if (active) {
        if (!confirmBtn.dataset.defaultLabel) {
          confirmBtn.dataset.defaultLabel = confirmBtn.textContent || 'Confirm registration';
        }
        confirmBtn.textContent = title || 'Please wait…';
      } else if (confirmBtn.dataset.defaultLabel) {
        confirmBtn.textContent = confirmBtn.dataset.defaultLabel;
      }
    }
    if (buyBtn) buyBtn.disabled = Boolean(active);
  }

  async function loadCheckoutSessionUser() {
    checkoutSessionUser = null;
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      const data = await res.json();
      if (data.ok && data.user) checkoutSessionUser = data.user;
    } catch (e) {
      /* ignore */
    }
    return checkoutSessionUser;
  }

  async function prefillCheckoutDetails() {
    await loadCheckoutSessionUser();
    const nameEl = document.getElementById('checkout-name');
    const emailEl = document.getElementById('checkout-email');
    if (!nameEl && !emailEl) return;
    if (checkoutSessionUser) {
      if (nameEl && checkoutSessionUser.name && !nameEl.value.trim()) {
        nameEl.value = checkoutSessionUser.name;
      }
      if (emailEl && checkoutSessionUser.email && !emailEl.value.trim()) {
        emailEl.value = checkoutSessionUser.email;
      }
    }
  }

  function renderCheckoutGuestNames(ticketQty) {
    const wrap = document.getElementById('checkout-guest-names');
    const nameLabel = document.getElementById('checkout-name-label');
    const qtyNum = Math.max(1, parseInt(ticketQty, 10) || 1);
    const extra = Math.max(0, qtyNum - 1);

    if (nameLabel) {
      nameLabel.textContent = extra > 0 ? 'Your name (attendee 1)' : 'Full name';
    }

    if (!wrap) return;

    if (!extra) {
      wrap.hidden = true;
      wrap.innerHTML = '';
      return;
    }

    wrap.hidden = false;
    let html =
      '<p class="checkout-guest-names-title">Other attendee names</p>' +
      '<p class="checkout-guest-names-hint">Add a name for each additional ticket in this booking.</p>';

    for (let i = 0; i < extra; i++) {
      const attendeeNum = i + 2;
      html +=
        '<label class="form-field" for="checkout-guest-' +
        i +
        '">' +
        '<span>Attendee ' +
        attendeeNum +
        '</span>' +
        '<input type="text" id="checkout-guest-' +
        i +
        '" name="guest_name_' +
        i +
        '" autocomplete="name" required />' +
        '</label>' +
        '<label class="checkout-guest-same" for="checkout-guest-same-' +
        i +
        '">' +
        '<input type="checkbox" id="checkout-guest-same-' +
        i +
        '" data-guest-same-as-first data-guest-index="' +
        i +
        '" />' +
        '<span>Same as attendee 1</span>' +
        '</label>';
    }

    wrap.innerHTML = html;
    bindCheckoutGuestSameHandlers();
  }

  function applyGuestSameAsFirst(index, checked) {
    const guestInput = document.getElementById('checkout-guest-' + index);
    const nameEl = document.getElementById('checkout-name');
    if (!guestInput) return;
    if (checked) {
      guestInput.value = nameEl ? nameEl.value.trim() : '';
      guestInput.readOnly = true;
      guestInput.classList.add('is-same-as-primary');
    } else {
      guestInput.readOnly = false;
      guestInput.classList.remove('is-same-as-primary');
      if (guestInput.value === (nameEl ? nameEl.value.trim() : '')) {
        guestInput.value = '';
      }
    }
  }

  function bindCheckoutGuestSameHandlers() {
    const nameEl = document.getElementById('checkout-name');
    const wrap = document.getElementById('checkout-guest-names');
    if (!wrap) return;

    wrap.querySelectorAll('[data-guest-same-as-first]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        const index = parseInt(cb.getAttribute('data-guest-index'), 10);
        applyGuestSameAsFirst(index, cb.checked);
      });
    });

    if (nameEl && !nameEl.dataset.guestSyncBound) {
      nameEl.dataset.guestSyncBound = '1';
      nameEl.addEventListener('input', function () {
        wrap.querySelectorAll('[data-guest-same-as-first]:checked').forEach(function (cb) {
          const index = parseInt(cb.getAttribute('data-guest-index'), 10);
          applyGuestSameAsFirst(index, true);
        });
      });
    }
  }

  function readCheckoutGuestNames(ticketQty) {
    const qtyNum = Math.max(1, parseInt(ticketQty, 10) || 1);
    const extra = Math.max(0, qtyNum - 1);
    const guestNames = [];

    for (let i = 0; i < extra; i++) {
      const val = document.getElementById('checkout-guest-' + i)?.value.trim() || '';
      if (!val) {
        throw new Error('Please enter a name for attendee ' + (i + 2) + '.');
      }
      guestNames.push(val);
    }

    return guestNames;
  }

  function readCheckoutDetails(ticketQty) {
    if (checkoutUseSlimPaid) {
      const attendee = checkoutAttendeeFromSession();
      if (!attendee) {
        throw new Error('Please sign in or enter your details to continue.');
      }
      return attendee;
    }
    const name = document.getElementById('checkout-name')?.value.trim() || '';
    const email = document.getElementById('checkout-email')?.value.trim() || '';
    if (!name) throw new Error('Please enter your full name.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Please enter a valid email address.');
    }
    const guestNames = readCheckoutGuestNames(ticketQty);
    return { name, email, guestNames };
  }

  function updateCheckoutSummary(label, qty, total) {
    const el = document.getElementById('checkout-order-summary');
    const confirmBtn = document.getElementById('checkout-confirm-btn');
    const ev = currentEventDetail || currentEvent;
    const organiserEl = document.getElementById('checkout-organiser-name');
    const totalEl = document.getElementById('checkout-total-price');
    const refundEl = document.getElementById('checkout-refund-policy');
    const feeNoteEl = document.getElementById('checkout-fee-note');
    const termsCheck = document.getElementById('checkout-terms-agree');
    const form = document.getElementById('checkout-details-form');
    const intro = document.getElementById('checkout-details-intro');
    const freeOrganiser = document.getElementById('checkout-free-organiser');
    const termsLabel = document.getElementById('checkout-terms-label');
    const secureFoot = document.getElementById('ticket-secure-foot');
    const isFree = !(total > 0);
    checkoutUseSlimPaid = wantsSlimPaidCheckout(qty, total);
    const accountLine = document.getElementById('checkout-account-line');
    const attendeeFields = document.getElementById('checkout-attendee-fields');

    if (form) {
      form.classList.toggle('is-free', isFree);
      form.classList.toggle('is-slim-paid', checkoutUseSlimPaid && !isFree);
    }
    if (accountLine) {
      if (checkoutUseSlimPaid && !isFree && checkoutSessionUser?.email) {
        accountLine.textContent = 'Booking as ' + checkoutSessionUser.email;
        accountLine.hidden = false;
      } else {
        accountLine.hidden = true;
        accountLine.textContent = '';
      }
    }
    if (attendeeFields) attendeeFields.hidden = checkoutUseSlimPaid && !isFree;

    if (intro) {
      intro.textContent = isFree
        ? 'Enter your details to register for this free event.'
        : checkoutUseSlimPaid
          ? 'Review your order and confirm to continue to secure payment.'
          : 'Review your order and enter your details to complete your booking.';
    }
    if (freeOrganiser) {
      const organiserName = ev ? ev.organiser || ev.organiserName || 'the event organiser' : 'the event organiser';
      freeOrganiser.textContent = 'Organised by ' + organiserName;
      freeOrganiser.hidden = !isFree;
    }
    if (secureFoot) secureFoot.hidden = isFree;
    if (el) {
      el.hidden = isFree;
      if (!isFree) {
        el.textContent =
          (label || 'Ticket') + ' × ' + String(qty || 1) + ' — Total ' + fmt(total || 0);
      }
    }
    if (organiserEl && ev) {
      organiserEl.textContent = ev.organiser || ev.organiserName || 'Event organiser';
    }
    if (totalEl) {
      totalEl.textContent = fmt(total || 0) + (total > 0 ? ' (inc. booking fee where shown)' : '');
    }
    if (refundEl && ev) {
      refundEl.textContent = refundPolicyDetailText(ev);
    }
    if (feeNoteEl) {
      feeNoteEl.hidden = !total;
    }
    if (termsCheck) {
      termsCheck.checked = false;
    }
    if (termsLabel) {
      termsLabel.textContent = isFree
        ? 'I confirm my details are correct and agree to register for this event.'
        : 'I have read the refund policy and agree to proceed with this booking.';
    }
    if (confirmBtn) {
      confirmBtn.textContent = total > 0 ? 'Continue to payment' : 'Confirm registration';
    }
  }

  let nudgeUiBound = false;

  async function prefillNudgeEmail() {
    const emailEl = document.getElementById('ticket-nudge-email');
    const nameEl = document.getElementById('ticket-nudge-name');
    if (!emailEl) return;
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      const data = await res.json();
      if (data.ok && data.user) {
        if (!emailEl.value && data.user.email) emailEl.value = data.user.email;
        if (nameEl && !nameEl.value && data.user.name) nameEl.value = data.user.name;
      }
    } catch {
      /* ignore */
    }
  }

  function bindTicketSalesNudgeUi(ev) {
    if (nudgeUiBound) return;
    nudgeUiBound = true;
    const btn = document.getElementById('ticket-nudge-btn');
    const statusEl = document.getElementById('ticket-nudge-status');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      const email = document.getElementById('ticket-nudge-email')?.value.trim() || '';
      const name = document.getElementById('ticket-nudge-name')?.value.trim() || '';
      if (!email) {
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.className = 'ticket-nudge-status is-error';
          statusEl.textContent = 'Enter your email so the organiser can follow up.';
        }
        return;
      }
      btn.disabled = true;
      if (statusEl) statusEl.hidden = true;
      try {
        const res = await fetch('/api/auth/nudge-ticket-sales', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: ev.id, email: email, name: name }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.message || data.error || 'nudge_failed');
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.className = 'ticket-nudge-status is-ok';
          statusEl.textContent = data.message || 'Nudge sent — thank you!';
        }
      } catch (e) {
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.className = 'ticket-nudge-status is-error';
          statusEl.textContent = e.message || 'Could not send nudge. Please try again.';
        }
        btn.disabled = false;
      }
    });
  }

  function applyTicketPanelState(ev) {
    const panel = document.getElementById('tickets');
    const buy = document.getElementById('buy-btn');
    const purchaseView = document.getElementById('ticket-purchase-view');
    const appForm = document.getElementById('seat-application-form');
    const nudgePanel = document.getElementById('ticket-sales-nudge');
    if (!panel || !buy) return;

    panel.dataset.approvalRequired = ev.isApprovalRequired ? 'true' : 'false';
    panel.dataset.soldOut = ev.isSoldOut ? 'true' : 'false';
    panel.dataset.salesClosed = ev.isSalesClosed ? 'true' : 'false';

    panel.classList.remove(
      'is-unavailable',
      'is-sales-pending',
      'is-approval-mode',
      'show-application',
      'show-checkout'
    );
    showSeatApplication(false);
    showCheckoutDetails(false);
    if (nudgePanel) nudgePanel.hidden = true;

    if (ev.isTicketSalesPending) {
      panel.classList.add('is-sales-pending');
      buy.disabled = true;
      buy.classList.add('cta-btn-disabled');
      if (purchaseView) purchaseView.removeAttribute('aria-hidden');
      if (nudgePanel) {
        nudgePanel.hidden = false;
        bindTicketSalesNudgeUi(ev);
        prefillNudgeEmail();
      }
      return;
    }

    const unavailable = ev.isSoldOut || ev.isSalesClosed;
    if (unavailable) {
      panel.classList.add('is-unavailable');
      buy.disabled = true;
      buy.classList.add('cta-btn-disabled');
      buy.textContent = ev.isSalesClosed ? 'Registration Closed' : 'Sold Out';
      if (purchaseView) purchaseView.setAttribute('aria-hidden', 'true');
      document.querySelectorAll('#ticket-tiers .tier:not(.sold-out)').forEach((tier) => {
        tier.classList.add('tier-disabled');
        tier.setAttribute('aria-disabled', 'true');
        tier.style.pointerEvents = 'none';
      });
      const qtyDown = document.getElementById('qty-down');
      const qtyUp = document.getElementById('qty-up');
      if (qtyDown) qtyDown.disabled = true;
      if (qtyUp) qtyUp.disabled = true;
      if (appForm) appForm.hidden = true;
      return;
    }

    buy.disabled = false;
    buy.classList.remove('cta-btn-disabled');
    if (purchaseView) purchaseView.removeAttribute('aria-hidden');

    if (ev.isApprovalRequired) {
      panel.classList.add('is-approval-mode');
      buy.textContent = 'Apply for a Seat';
    } else {
      buy.textContent = ev.priceKey === 'free' ? 'Get free ticket' : 'Buy ticket';
    }
  }

  function parseEventStartEnd(ev) {
    let start = null;
    if (ev.dateRaw) {
      const iso = String(ev.dateRaw).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) {
        let h = 12;
        let m = 0;
        const tm = String(ev.time || '').match(/(\d{1,2}):(\d{2})/);
        if (tm) {
          h = parseInt(tm[1], 10);
          m = parseInt(tm[2], 10);
        }
        start = new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10), h, m, 0);
      }
    }
    if (!start || Number.isNaN(start.getTime())) {
      start = new Date();
      start.setHours(12, 0, 0, 0);
    }
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    return { start, end };
  }

  function formatGCal(dt) {
    const pad = (n) => String(n).padStart(2, '0');
    return (
      dt.getUTCFullYear() +
      pad(dt.getUTCMonth() + 1) +
      pad(dt.getUTCDate()) +
      'T' +
      pad(dt.getUTCHours()) +
      pad(dt.getUTCMinutes()) +
      pad(dt.getUTCSeconds()) +
      'Z'
    );
  }

  function formatOutlookIso(dt) {
    return dt.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  function formatIcsDate(dt) {
    const pad = (n) => String(n).padStart(2, '0');
    return (
      dt.getUTCFullYear() +
      pad(dt.getUTCMonth() + 1) +
      pad(dt.getUTCDate()) +
      'T' +
      pad(dt.getUTCHours()) +
      pad(dt.getUTCMinutes()) +
      pad(dt.getUTCSeconds()) +
      'Z'
    );
  }

  function buildCalendarLinks(ev) {
    const { start, end } = parseEventStartEnd(ev);
    const title = ev.title || 'Event';
    const loc = venueQuery(ev) || ev.location || '';
    const details = (ev.description || '').slice(0, 800);
    const dates = formatGCal(start) + '/' + formatGCal(end);

    return {
      google:
        'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' +
        encodeURIComponent(title) +
        '&dates=' +
        dates +
        '&details=' +
        encodeURIComponent(details) +
        '&location=' +
        encodeURIComponent(loc),
      outlook:
        'https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=' +
        encodeURIComponent(title) +
        '&startdt=' +
        encodeURIComponent(formatOutlookIso(start)) +
        '&enddt=' +
        encodeURIComponent(formatOutlookIso(end)) +
        '&body=' +
        encodeURIComponent(details) +
        '&location=' +
        encodeURIComponent(loc),
      icsContent: [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//The Networker Hub//EN',
        'BEGIN:VEVENT',
        'UID:' + (ev.id || 'event') + '@thenetworkerhub',
        'DTSTAMP:' + formatIcsDate(new Date()),
        'DTSTART:' + formatIcsDate(start),
        'DTEND:' + formatIcsDate(end),
        'SUMMARY:' + title.replace(/[,;\\]/g, '\\$&'),
        'DESCRIPTION:' + details.replace(/\n/g, '\\n').replace(/[,;\\]/g, '\\$&'),
        'LOCATION:' + loc.replace(/[,;\\]/g, '\\$&'),
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n'),
    };
  }

  function pageUrl() {
    const ev = currentEvent;
    if (ev) {
      const path = canonicalEventPath(ev);
      return window.location.origin + path;
    }
    return window.location.href;
  }

  function closeAllDropdowns(except) {
    document.querySelectorAll('.action-dropdown').forEach((menu) => {
      if (menu !== except) {
        menu.hidden = true;
        const btnId = menu.id === 'share-menu' ? 'share-btn' : menu.id === 'calendar-menu' ? 'calendar-btn' : null;
        if (btnId) {
          const btn = document.getElementById(btnId);
          if (btn) btn.setAttribute('aria-expanded', 'false');
        }
      }
    });
  }

  function toggleDropdown(menu, btn) {
    const open = menu.hidden;
    closeAllDropdowns(menu);
    menu.hidden = !open;
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function initActions(ev) {
    const saveBtn = document.getElementById('save-btn');
    const shareBtn = document.getElementById('share-btn');
    const shareMenu = document.getElementById('share-menu');
    const calBtn = document.getElementById('calendar-btn');
    const calMenu = document.getElementById('calendar-menu');
    const url = pageUrl();
    const shareTitle = ev.title || 'Event on The Networker Hub';

    function refreshSaveUi() {
      if (!saveBtn || !ev.id) return;
      const id = String(ev.id);
      const saved = window.HubFavourites ? window.HubFavourites.isSaved(id) : false;
      saveBtn.setAttribute('aria-pressed', saved ? 'true' : 'false');
      saveBtn.setAttribute('aria-label', saved ? 'Remove from saved' : 'Save event');
      saveBtn.classList.toggle('is-saved', saved);
      const label = saveBtn.querySelector('.action-btn-label');
      if (label) label.textContent = saved ? 'Saved' : 'Save event';
    }

    refreshSaveUi();
    if (window.HubFavourites) {
      window.HubFavourites.sync().then(function () {
        refreshSaveUi();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        const id = String(ev.id || document.body.getAttribute('data-event-id') || '');
        if (!id) return;
        if (window.HubFavourites) {
          const organiserId = String(ev.organiserId || ev.organiser_id || '').trim();
          window.HubFavourites.toggle(id, { organiserId: organiserId }).then(function () {
            refreshSaveUi();
            if (window.HubOrganiserFavourites) window.HubOrganiserFavourites.refreshButtons();
          });
          return;
        }
        refreshSaveUi();
      });
    }

    const linkedIn = document.getElementById('share-linkedin');
    const twitter = document.getElementById('share-twitter');
    const facebook = document.getElementById('share-facebook');
    const shareEmail = document.getElementById('share-email');
    if (linkedIn) {
      linkedIn.href =
        'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url);
    }
    if (twitter) {
      twitter.href =
        'https://twitter.com/intent/tweet?url=' +
        encodeURIComponent(url) +
        '&text=' +
        encodeURIComponent(shareTitle);
    }
    if (facebook) {
      facebook.href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url);
    }
    if (shareEmail) {
      shareEmail.href =
        'mailto:?subject=' +
        encodeURIComponent(shareTitle + ' – The Networker Hub') +
        '&body=' +
        encodeURIComponent('I thought you might like this event:\n\n' + shareTitle + '\n' + url);
    }

    const copyBtn = document.getElementById('share-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        const done = function () {
          copyBtn.textContent = 'Link copied';
          setTimeout(function () {
            copyBtn.textContent = 'Copy link';
          }, 2000);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done).catch(function () {
            window.prompt('Copy this link:', url);
          });
        } else {
          window.prompt('Copy this link:', url);
        }
        if (shareMenu) shareMenu.hidden = true;
        if (shareBtn) shareBtn.setAttribute('aria-expanded', 'false');
      });
    }

    if (shareBtn && shareMenu) {
      shareBtn.addEventListener('click', function () {
        toggleDropdown(shareMenu, shareBtn);
      });
    }

    const links = buildCalendarLinks(ev);
    const calGoogle = document.getElementById('cal-google');
    const calOutlook = document.getElementById('cal-outlook');
    const calIcs = document.getElementById('cal-ics');
    if (calGoogle) calGoogle.href = links.google;
    if (calOutlook) calOutlook.href = links.outlook;

    if (calIcs) {
      calIcs.addEventListener('click', function () {
        const blob = new Blob([links.icsContent], { type: 'text/calendar;charset=utf-8' });
        const dl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = dl;
        a.download = (ev.title || 'event').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.ics';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(dl);
        if (calMenu) calMenu.hidden = true;
        if (calBtn) calBtn.setAttribute('aria-expanded', 'false');
      });
    }

    if (calBtn && calMenu) {
      calBtn.addEventListener('click', function () {
        toggleDropdown(calMenu, calBtn);
      });
    }

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.action-dropdown-wrap')) {
        closeAllDropdowns(null);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAllDropdowns(null);
    });
  }

  function initContactHost(ev) {
    const openBtn = document.getElementById('contact-host-btn');
    const modal = document.getElementById('contact-host-modal');
    const closeBtn = document.getElementById('contact-host-close');
    const form = document.getElementById('contact-host-form');
    const nameSpan = document.getElementById('contact-host-name');
    if (!openBtn || !modal) return;

    if (nameSpan) nameSpan.textContent = ev.organiser || 'the organiser';

    function openModal() {
      modal.hidden = false;
      document.body.classList.add('modal-open');
      const first = document.getElementById('contact-name');
      if (first) setTimeout(() => first.focus(), 50);
    }

    function closeModal() {
      modal.hidden = true;
      document.body.classList.remove('modal-open');
    }

    openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    modal.querySelectorAll('[data-modal-close]').forEach((el) => {
      el.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', function escModal(e) {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        // TODO: Connect to organiser messaging API when backend is live
        closeModal();
        form.reset();
        window.alert('Thanks — your message has been queued. The host will respond by email.');
      });
    }
  }

  function initTicketPanel(ev) {
    currentEventDetail = ev;
    const qtyDown = document.getElementById('qty-down');
    const qtyUp = document.getElementById('qty-up');
    const qtyValue = document.getElementById('qty-value');
    const sumLabel = document.getElementById('sum-label');
    const sumQty = document.getElementById('sum-qty');
    const sumSubtotal = document.getElementById('sum-subtotal');
    const sumFee = document.getElementById('sum-fee');
    const sumFeeRow = sumFee ? sumFee.closest('.summary-row') : null;
    const summaryFeeNote = document.getElementById('summary-fee-note');
    const sumTotal = document.getElementById('sum-total');
    const qtyHint = document.getElementById('qty-avail-hint');
    if (!qtyDown) return;

    let qty = 1;
    let price = ev.priceKey === 'free' ? 0 : Number(ev.priceNum) || 0;
    let label = 'Standard';
    let maxQty = 99;

    function getSelectableTiers() {
      return document.querySelectorAll('#ticket-tiers .tier:not(.sold-out):not(.tier-disabled)');
    }

    function maxQtyForTier(tierEl) {
      if (!tierEl) return 99;
      const raw = tierEl.getAttribute('data-qty-max');
      const n = parseInt(raw, 10);
      return Number.isFinite(n) && n > 0 ? Math.min(n, 99) : 99;
    }

    const sel = document.querySelector('#ticket-tiers .tier.selected');
    if (sel) {
      price = parseFloat(sel.getAttribute('data-price')) || 0;
      label = sel.getAttribute('data-label') || label;
      maxQty = maxQtyForTier(sel);
    }

    function update() {
      if (qty > maxQty) qty = maxQty;
      const subtotal = price * qty;
      const fee =
        subtotal > 0 ? subtotal * BOOKING_FEE_RATE + BOOKING_FEE_PER_TICKET * qty : 0;
      const total = subtotal + fee;
      if (sumLabel) sumLabel.textContent = label;
      if (sumQty) sumQty.textContent = String(qty);
      if (sumSubtotal) sumSubtotal.textContent = fmt(subtotal);
      if (sumFee) sumFee.textContent = fmt(fee);
      if (sumFeeRow) sumFeeRow.hidden = subtotal <= 0;
      if (summaryFeeNote) summaryFeeNote.hidden = subtotal <= 0;
      if (sumTotal) sumTotal.textContent = fmt(total);
      if (qtyValue) qtyValue.textContent = String(qty);
      qtyDown.disabled = qty <= 1;
      qtyUp.disabled = qty >= maxQty;
      if (qtyHint) {
        if (maxQty < 99) {
          qtyHint.textContent =
            maxQty === 1
              ? 'Only 1 ticket available for this type.'
              : 'Up to ' + maxQty + ' tickets available for this type.';
          qtyHint.hidden = false;
        } else {
          qtyHint.hidden = true;
          qtyHint.textContent = '';
        }
      }
    }

    function selectTier(tier) {
      getSelectableTiers().forEach((t) => {
        t.classList.remove('selected');
        t.setAttribute('aria-pressed', 'false');
      });
      tier.classList.add('selected');
      tier.setAttribute('aria-pressed', 'true');
      price = parseFloat(tier.getAttribute('data-price')) || 0;
      label = tier.getAttribute('data-label') || 'Ticket';
      maxQty = maxQtyForTier(tier);
      if (qty > maxQty) qty = maxQty;
      update();
    }

    document.getElementById('ticket-tiers')?.addEventListener('click', (e) => {
      const tier = e.target.closest('.tier:not(.sold-out):not(.tier-disabled)');
      if (tier) selectTier(tier);
    });
    qtyDown.addEventListener('click', () => {
      if (qty > 1) {
        qty--;
        update();
      }
    });
    qtyUp.addEventListener('click', () => {
      if (qty < maxQty) {
        qty++;
        update();
      }
    });
    update();

    const buy = document.getElementById('buy-btn');
    const stripeHint = document.getElementById('stripe-hint');
    const appForm = document.getElementById('seat-application-form');
    const appBack = document.getElementById('application-back-btn');

    if (appBack) {
      appBack.addEventListener('click', () => showSeatApplication(false));
    }

    if (appForm) {
      appForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!(await requireSignedInAttendee())) return;

        const submitApplication = async () => {
          // TODO: Connect to seat approval workflow API when backend is live
          showSeatApplication(false);
          appForm.reset();
          window.alert('Application submitted. The host will review your request and email you.');
        };

        await submitApplication();
      });
    }

    const checkoutForm = document.getElementById('checkout-details-form');
    const checkoutBack = document.getElementById('checkout-back-btn');
    const checkoutConfirm = document.getElementById('checkout-confirm-btn');

    if (checkoutBack) {
      checkoutBack.addEventListener('click', () => showCheckoutDetails(false));
    }

    async function processCheckoutBooking() {
      const attendee = readCheckoutDetails(qty);
      update();
      const tierEl = getSelectedTierEl();
      const ticketId = tierEl ? tierEl.getAttribute('data-ticket-id') : null;
      const tierPrice = tierEl ? parseFloat(tierEl.getAttribute('data-price')) || 0 : price;
      const subtotal = tierPrice * qty;
      const fee = subtotal > 0 ? subtotal * BOOKING_FEE_RATE + BOOKING_FEE_PER_TICKET * qty : 0;
      const total = subtotal + fee;

      if (tierPrice <= 0) {
        setCheckoutSubmitting(true, 'Registering…');
        try {
          await completeFreeBooking(currentEvent, ticketId, qty, attendee);
        } catch (err) {
          setCheckoutSubmitting(false);
          window.alert(
            err && err.message
              ? err.message
              : 'Could not complete your free booking. Please try again or contact support.'
          );
        }
        return;
      }

      if (stripeHint) stripeHint.hidden = true;
      setCheckoutSubmitting(true, 'Redirecting to payment…');
      try {
        const usedCheckoutApi = await startPaidCheckout(currentEvent, ticketId, qty, attendee);
        if (usedCheckoutApi) return;

        const checkoutUrl = buildStripeCheckoutUrl(currentEvent, tierEl, qty, label);
        if (!checkoutUrl) {
          setCheckoutSubmitting(false);
          showCheckoutDetails(false);
          if (stripeHint) {
            stripeHint.hidden = false;
            stripeHint.focus();
          }
          return;
        }
        saveBookingPending(currentEvent, ticketId, qty);
        window.location.assign(checkoutUrl);
      } catch (err) {
        setCheckoutSubmitting(false);
        window.alert(
          err && err.message
            ? err.message
            : 'Could not start checkout. Please try again or contact support.'
        );
      }
    }

    if (checkoutForm) {
      checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const termsAgree = document.getElementById('checkout-terms-agree');
        if (termsAgree && !termsAgree.checked) {
          window.alert('Please confirm you have read the refund policy and agree to proceed.');
          termsAgree.focus();
          return;
        }
        try {
          readCheckoutDetails(qty);
        } catch (err) {
          window.alert(err.message || 'Please check your details.');
          return;
        }

        const runBooking = async () => {
          await processCheckoutBooking();
        };

        try {
          await runBooking();
        } catch (err) {
          window.alert(err && err.message ? err.message : 'Could not complete your booking.');
        }
      });
    }

    if (buy) {
      buy.addEventListener('click', async () => {
        if (buy.disabled) return;

        if (currentEvent.isApprovalRequired) {
          if (!(await requireSignedInAttendee())) return;
          showSeatApplication(true);
          const industry = document.getElementById('apply-industry');
          if (industry) industry.focus();
          return;
        }

        update();
        const tierEl = getSelectedTierEl();
        const tierPrice = tierEl ? parseFloat(tierEl.getAttribute('data-price')) || 0 : price;
        const subtotal = tierPrice * qty;
        const fee = subtotal > 0 ? subtotal * BOOKING_FEE_RATE + BOOKING_FEE_PER_TICKET * qty : 0;
        const total = subtotal + fee;

        await prefillCheckoutDetails();
        renderCheckoutGuestNames(qty);
        updateCheckoutSummary(label, qty, total);
        showCheckoutDetails(true);
        const termsAgree = document.getElementById('checkout-terms-agree');
        const nameInput = document.getElementById('checkout-name');
        if (checkoutUseSlimPaid && termsAgree) termsAgree.focus();
        else if (nameInput) nameInput.focus();
      });
    }

    ticketPanelSetEvent = function (newEv) {
      currentEvent = newEv;
      currentEventDetail = newEv;
      qty = 1;
      price = newEv.priceKey === 'free' ? 0 : Number(newEv.priceNum) || 0;
      label = 'Standard';
      maxQty = 99;
      renderTicketPanel(newEv);
      applyTicketPanelState(newEv);
      document.body.setAttribute('data-event-id', newEv.id);
      showSeatApplication(false);
      showCheckoutDetails(false);
      const selectedTier =
        document.querySelector('#ticket-tiers .tier.selected:not(.sold-out):not(.tier-disabled)') ||
        document.querySelector('#ticket-tiers .tier:not(.sold-out):not(.tier-disabled)');
      if (selectedTier) selectTier(selectedTier);
      else update();
      wireListingReport(newEv);
    };
  }

  async function loadRelatedFallback(ev) {
    const organiserId = ev.organiserId || ev.organiser_id || '';
    if (!organiserId) return [];
    try {
      const qs =
        'organiserId=' +
        encodeURIComponent(organiserId) +
        '&exclude=' +
        encodeURIComponent(ev.id || '') +
        '&limit=8';
      const res = await fetch('/api/hub-listings?' + qs);
      const data = await res.json();
      return (data.events || []).slice(0, 6);
    } catch (e) {
      return [];
    }
  }

  var loadOverlayTimer = null;
  var loadOverlayVisible = false;
  var LOAD_OVERLAY_DELAY_MS = 0;

  function showEventLoadOverlayNow() {
    const overlay = document.getElementById('event-detail-load-overlay');
    const shell = document.getElementById('event-detail-shell');
    if (window.hubLoading) window.hubLoading.show('event-detail-load-overlay');
    else if (overlay) {
      overlay.classList.add('is-active');
      overlay.hidden = false;
      if (shell) shell.classList.add('is-loading');
    }
  }

  function hideEventLoadOverlayNow() {
    const overlay = document.getElementById('event-detail-load-overlay');
    const shell = document.getElementById('event-detail-shell');
    if (window.hubLoading) window.hubLoading.hide('event-detail-load-overlay');
    else if (overlay) {
      overlay.classList.remove('is-active');
      overlay.hidden = true;
      if (shell) shell.classList.remove('is-loading');
    }
  }

  function primeEventLoadOverlay(route) {
    const preview =
      window.hubEventPreview && window.hubEventPreview.readForRoute(route);
    if (preview && preview.image) {
      window.hubEventPreview.applyToOverlay('event-detail-load-overlay', preview);
      return true;
    }
    if (window.hubEventPreview) {
      window.hubEventPreview.resetOverlay('event-detail-load-overlay');
    }
    return false;
  }

  function setEventLoading(on, immediate) {
    if (on) {
      if (loadOverlayTimer || loadOverlayVisible) return;
      const delay = immediate ? 0 : LOAD_OVERLAY_DELAY_MS;
      loadOverlayTimer = window.setTimeout(function () {
        loadOverlayTimer = null;
        loadOverlayVisible = true;
        showEventLoadOverlayNow();
      }, delay);
      return;
    }

    if (loadOverlayTimer) {
      window.clearTimeout(loadOverlayTimer);
      loadOverlayTimer = null;
    }
    if (loadOverlayVisible) {
      loadOverlayVisible = false;
      hideEventLoadOverlayNow();
    }
  }

  function showEventLoadError(message) {
    const lead = document.getElementById('ev-about-lead');
    if (lead) lead.textContent = message;
    const tiersEl = document.getElementById('ticket-tiers');
    if (tiersEl) {
      tiersEl.innerHTML =
        '<p class="ticket-load-hint">' +
        escapeHtml(message) +
        ' <a href="index.html">Browse events</a></p>';
    }
    setText('ev-title', 'Event unavailable');
    setText('ev-trail-current', 'Event unavailable');
  }

  async function loadEventPageAds() {
    if (!window.CmsAdBlocks) return;
    const sidebarEl = document.getElementById('event-page-sidebar-ad');
    if (!sidebarEl) return;
    try {
      await window.CmsAdBlocks.loadPageCarouselAds(sidebarEl);
    } catch {
      /* non-fatal */
    }
  }

  async function bootWork(params, id, slug) {
    if (id || slug) {
      const tiersEl = document.getElementById('ticket-tiers');
      if (tiersEl) tiersEl.innerHTML = '<p class="ticket-load-hint">Loading tickets…</p>';
      try {
        const apiUrl = id
          ? '/api/hub-listings?id=' + encodeURIComponent(id)
          : '/api/hub-listings?slug=' + encodeURIComponent(slug);
        const res = await fetch(apiUrl);
        const data = await res.json();
        if (data.event) {
          const ev = normalizeEventFlags(data.event, params);
          currentEvent = ev;
          seriesDatesList = data.seriesDates || [];
          seriesBaseEvent = ev;
          populateFromEvent(ev);
          initTicketPanel(ev);
          initSeriesDatePicker(ev);
          initContactHost(ev);
          initActions(ev);
          setEventLoading(false);

          const relatedFromApi = data.related || [];
          if (relatedFromApi.length) {
            renderRelated(relatedFromApi);
          } else {
            loadRelatedFallback(ev).then(function (related) {
              renderRelated(related);
            });
          }
          loadEventPageAds();
          return;
        }
        showEventLoadError(
          data.message || 'This event could not be found. It may be unpublished or removed.'
        );
        return;
      } catch (e) {
        console.error(e);
        showEventLoadError('Could not load this event. Please try again in a moment.');
        return;
      }
    }

    if (params.get('title')) {
      const ev = normalizeEventFlags({
        id: params.get('id') || '',
        title: params.get('title'),
        description: params.get('about') || params.get('blurb') || '',
        date: params.get('starts') || '',
        dateRaw: '',
        time: params.get('time') || '',
        location: params.get('city') || '',
        industry: params.get('category') || '',
        format: params.get('format') || '',
        price: params.get('price') ? '£' + params.get('price') : 'Free',
        priceKey: 'paid',
        priceNum: parseFloat(params.get('price')) || 0,
        photo: params.get('img') || null,
        organiser: params.get('host') || '',
        organiserId: params.get('organiser_id') || '',
        organiserLogo: params.get('host_logo') || '',
        organiserProfile: params.get('host_profile') || '',
        rating: params.get('rating') || 4,
        reviews: params.get('reviews') || 0,
        venueName: params.get('venue_name') || '',
        venueAddress: params.get('venue_addr') || '',
        postcode: params.get('postcode') || '',
        isApprovalRequired: false,
        isSoldOut: false,
        isSalesClosed: false,
        spotsLeft: null,
        urgency: params.get('urgency') || '',
        tickets: [],
      }, params);
      currentEvent = ev;
      populateFromEvent(ev);
      if (ev.organiser || ev.organiserId) {
        const related = await loadRelatedFallback(ev);
        renderRelated(related);
      } else {
        renderRelated([]);
      }
      initTicketPanel(ev);
      initContactHost(ev);
      initActions(ev);
      loadEventPageAds();
    }
  }

  async function boot() {
    const route = eventRouteFromLocation();
    const params = route.params;
    const id = route.id;
    const slug = route.slug;

    if (!id && !slug && !params.get('title')) {
      setEventLoading(false);
      showEventLoadError('Open an event from Browse events to view ticket details.');
      return;
    }

    const hasPreview = primeEventLoadOverlay({ id, slug, params });
    setEventLoading(true, hasPreview);
    try {
      await bootWork(params, id, slug);
    } finally {
      setEventLoading(false);
    }
  }

  boot();
})();
