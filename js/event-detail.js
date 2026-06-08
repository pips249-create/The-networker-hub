/**
 * Event detail page — /api/events?id= or URL query fallback.
 */
(function () {
  window.hubEventDetailBooted = true;

  const BOOKING_FEE_RATE = 0.045;
  const BOOKING_FEE_PER_TICKET = 0.2;

  let currentEvent = null;

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
    };
  }

  function venueQuery(ev) {
    return [ev.venueName, ev.venueAddress, ev.venue, ev.postcode, ev.location]
      .filter(Boolean)
      .join(', ')
      .trim();
  }

  function applyHostBlock(ev) {
    const host = ev.organiser || 'Event organiser';
    setText('ev-host-name', host);

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
      profileLink.hidden = !ev.organiser;
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
      label = '✗ No refunds — all sales final';
      cls = 'is-none';
      detailText = 'All ticket sales are final. No refunds will be issued.';
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

  function renderTicketPanel(ev) {
    const tiersEl = document.getElementById('ticket-tiers');
    const urgencyEl = document.getElementById('ev-urgency');
    if (!tiersEl) return;

    const tiers = ticketTiersForEvent(ev);
    const panelClosed = ev.isSoldOut || ev.isSalesClosed;
    tiersEl.innerHTML = '';

    let firstSelectable = null;

    tiers.forEach((t, index) => {
      const soldOut = Boolean(t.soldOut) || panelClosed;
      const priceNum = t.priceKey === 'free' ? 0 : Number(t.priceNum) || 0;
      const priceDisplay = t.priceKey === 'free' ? 'Free' : t.price || fmt(priceNum);
      const subtitle = soldOut ? 'Sold out' : t.description || '';

      const tier = document.createElement('div');
      tier.className = 'tier' + (soldOut ? ' sold-out tier-disabled' : '');
      tier.id = index === 0 ? 'ev-tier-standard' : 'ev-tier-' + t.id;
      tier.setAttribute('data-ticket-id', t.id);
      tier.setAttribute('data-price', String(priceNum));
      tier.setAttribute('data-label', t.label || t.name || 'Ticket');

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
        '</strong><span>' +
        escapeHtml(subtitle) +
        '</span></div>' +
        '<div class="tier-price">' +
        escapeHtml(priceDisplay) +
        '</div>';

      tiersEl.appendChild(tier);
    });

    if (!firstSelectable && tiersEl.children.length) {
      tiersEl.innerHTML =
        '<p class="ticket-load-hint">All ticket tiers are currently sold out.</p>';
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
        urgencyEl.hidden = true;
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
    if (c > 0 && c <= MOCK_ORGANISER_REVIEWS.length) {
      MOCK_ORGANISER_REVIEWS.slice(0, c).forEach((review) => {
        appendReviewCard(feed, review);
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

  function appendReviewCard(feed, review) {
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
    feed.appendChild(card);
  }

  function showSeatApplication(show) {
    const panel = document.getElementById('tickets');
    if (panel) panel.classList.toggle('show-application', show);
  }

  function applyTicketPanelState(ev) {
    const panel = document.getElementById('tickets');
    const buy = document.getElementById('buy-btn');
    const purchaseView = document.getElementById('ticket-purchase-view');
    const appForm = document.getElementById('seat-application-form');
    if (!panel || !buy) return;

    panel.dataset.approvalRequired = ev.isApprovalRequired ? 'true' : 'false';
    panel.dataset.soldOut = ev.isSoldOut ? 'true' : 'false';
    panel.dataset.salesClosed = ev.isSalesClosed ? 'true' : 'false';

    panel.classList.remove('is-unavailable', 'is-approval-mode', 'show-application');
    showSeatApplication(false);

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
      buy.textContent = 'Buy ticket';
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

  function getSavedIds() {
    try {
      const raw = localStorage.getItem('hubSavedEventIds');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (e) {
      return [];
    }
  }

  function setSavedIds(ids) {
    try {
      localStorage.setItem('hubSavedEventIds', JSON.stringify(ids));
    } catch (e) {
      /* ignore */
    }
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
      const saved = getSavedIds().includes(String(ev.id));
      saveBtn.setAttribute('aria-pressed', saved ? 'true' : 'false');
      saveBtn.classList.toggle('is-saved', saved);
    }

    refreshSaveUi();

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        const id = String(ev.id || document.body.getAttribute('data-event-id') || '');
        if (!id) return;
        let ids = getSavedIds();
        if (ids.includes(id)) {
          ids = ids.filter((x) => x !== id);
        } else {
          // TODO: Connect to Attendee Dashboard database storage when built
          ids.push(id);
        }
        setSavedIds(ids);
        refreshSaveUi();
      });
    }

    const linkedIn = document.getElementById('share-linkedin');
    const twitter = document.getElementById('share-twitter');
    const facebook = document.getElementById('share-facebook');
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
        if (navigator.share) {
          navigator
            .share({ title: shareTitle, text: shareTitle, url: url })
            .catch(function () {
              toggleDropdown(shareMenu, shareBtn);
            });
          return;
        }
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
    const qtyDown = document.getElementById('qty-down');
    const qtyUp = document.getElementById('qty-up');
    const qtyValue = document.getElementById('qty-value');
    const sumLabel = document.getElementById('sum-label');
    const sumQty = document.getElementById('sum-qty');
    const sumSubtotal = document.getElementById('sum-subtotal');
    const sumFee = document.getElementById('sum-fee');
    const sumTotal = document.getElementById('sum-total');
    if (!qtyDown) return;

    let qty = 1;
    let price = ev.priceKey === 'free' ? 0 : Number(ev.priceNum) || 0;
    let label = 'Standard';

    function getSelectableTiers() {
      return document.querySelectorAll('#ticket-tiers .tier:not(.sold-out):not(.tier-disabled)');
    }

    const sel = document.querySelector('#ticket-tiers .tier.selected');
    if (sel) {
      price = parseFloat(sel.getAttribute('data-price')) || 0;
      label = sel.getAttribute('data-label') || label;
    }

    function update() {
      const subtotal = price * qty;
      const fee = subtotal * BOOKING_FEE_RATE + BOOKING_FEE_PER_TICKET * qty;
      const total = subtotal + fee;
      if (sumLabel) sumLabel.textContent = label;
      if (sumQty) sumQty.textContent = String(qty);
      if (sumSubtotal) sumSubtotal.textContent = fmt(subtotal);
      if (sumFee) sumFee.textContent = fmt(fee);
      if (sumTotal) sumTotal.textContent = fmt(total);
      if (qtyValue) qtyValue.textContent = String(qty);
      qtyDown.disabled = qty <= 1;
      qtyUp.disabled = qty >= 10;
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
      if (qty < 10) {
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

        if (window.FactLoader) {
          await window.FactLoader.run(submitApplication);
        } else {
          await submitApplication();
        }
      });
    }

    if (buy) {
      buy.addEventListener('click', async () => {
        if (buy.disabled) return;
        if (!(await requireSignedInAttendee())) return;

        if (ev.isApprovalRequired) {
          showSeatApplication(true);
          const industry = document.getElementById('apply-industry');
          if (industry) industry.focus();
          return;
        }

        const meta = document.querySelector('meta[name="stripe-payment-link"]');
        const base = (meta && meta.getAttribute('content')) || '';
        if (!base.trim()) {
          if (stripeHint) stripeHint.hidden = false;
          return;
        }
        window.location.assign(base);
      });
    }
  }

  async function loadRelatedFallback(ev) {
    try {
      const res = await fetch('/api/hub-listings');
      const data = await res.json();
      const all = data.events || [];
      return all
        .filter((e) => {
          if (e.id === ev.id) return false;
          if (ev.organiserId && e.organiserId) return e.organiserId === ev.organiserId;
          const a = String(e.organiser || '')
            .trim()
            .toLowerCase();
          const b = String(ev.organiser || '')
            .trim()
            .toLowerCase();
          return a && b && a === b;
        })
        .slice(0, 6);
    } catch (e) {
      return [];
    }
  }

  function setEventLoading(on) {
    const overlay = document.getElementById('event-detail-load-overlay');
    const shell = document.getElementById('event-detail-shell');
    if (on) {
      if (window.hubLoading) window.hubLoading.show('event-detail-load-overlay');
      else if (overlay) {
        overlay.classList.add('is-active');
        overlay.hidden = false;
        if (shell) shell.classList.add('is-loading');
      }
    } else {
      if (window.hubLoading) window.hubLoading.hide('event-detail-load-overlay');
      else if (overlay) {
        overlay.classList.remove('is-active');
        overlay.hidden = true;
        if (shell) shell.classList.remove('is-loading');
      }
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
    try {
      const block = await window.CmsAdBlocks.loadCmsAd('event_page_sidebar_ad');
      if (block && sidebarEl) window.CmsAdBlocks.renderCompactAd(sidebarEl, block);
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
          populateFromEvent(ev);
          let related = data.related || [];
          if (!related.length) related = await loadRelatedFallback(ev);
          renderRelated(related);
          initTicketPanel(ev);
          initContactHost(ev);
          initActions(ev);
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

    if (window.FactLoader) {
      await window.FactLoader.run(() => bootWork(params, id, slug));
      return;
    }

    setEventLoading(true);
    try {
      await bootWork(params, id, slug);
    } finally {
      setEventLoading(false);
    }
  }

  boot();
})();
