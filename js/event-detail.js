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

  function publicListingPriceLabel(ev, options) {
    if (window.HubBookingFees) {
      return window.HubBookingFees.listingPriceLabel(ev, options || {});
    }
    if (!ev || ev.priceKey === 'free') return 'Free';
    const withFrom = !options || options.withFrom !== false;
    const display = ev.price || '—';
    return withFrom ? 'from ' + display : display;
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

  async function isSignedInAttendee() {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      const data = await res.json();
      return !!(data.ok && data.user);
    } catch (e) {
      return false;
    }
  }

  function authPageUrl(page, withCheckoutFlag) {
    const next = encodeURIComponent(location.pathname + location.search);
    let url = '/' + page + '.html?next=' + next;
    if (withCheckoutFlag) url += '&checkout=1';
    return url;
  }

  const CHECKOUT_INTENT_KEY = 'hub_checkout_intent';
  let signInGateBound = false;

  function saveCheckoutIntent(ev, data) {
    if (!ev || !ev.id) return;
    try {
      sessionStorage.setItem(
        CHECKOUT_INTENT_KEY,
        JSON.stringify({
          eventId: ev.id,
          eventTitle: ev.title || '',
          ticketId: data && data.ticketId ? String(data.ticketId) : null,
          qty: Math.max(1, parseInt(data && data.qty, 10) || 1),
          termsAgreed: !!(data && data.termsAgreed),
          action: (data && data.action) || 'paid_buy',
          ts: Date.now(),
        })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function readCheckoutIntent() {
    try {
      const raw = sessionStorage.getItem(CHECKOUT_INTENT_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearCheckoutIntent() {
    try {
      sessionStorage.removeItem(CHECKOUT_INTENT_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function bindSignInGateOnce() {
    if (signInGateBound) return;
    signInGateBound = true;
    const cancel = document.getElementById('checkout-signin-cancel');
    if (cancel) {
      cancel.addEventListener('click', function () {
        showCheckoutSignInGate(false);
      });
    }
  }

  function showCheckoutSignInGate(show, config) {
    const gate = document.getElementById('checkout-signin-gate');
    const panel = document.getElementById('tickets');
    const notice = document.getElementById('checkout-resume-notice');
    if (!gate) {
      if (show) location.href = authPageUrl('login', true);
      return;
    }
    bindSignInGateOnce();
    if (show && config) {
      const title = document.getElementById('checkout-signin-gate-title');
      const lead = document.getElementById('checkout-signin-gate-lead');
      const signIn = document.getElementById('checkout-signin-btn');
      const register = document.getElementById('checkout-register-btn');
      if (title) title.textContent = config.title || 'Sign in to buy tickets';
      if (lead) {
        lead.textContent =
          config.lead ||
          'A free Hub account lets us take payment securely and save your ticket. Your selection below will be kept.';
      }
      const checkoutFlag = config.checkoutFlag !== false;
      if (signIn) signIn.href = authPageUrl('login', checkoutFlag);
      if (register) register.href = authPageUrl('register', checkoutFlag);
    }
    gate.hidden = !show;
    if (panel) {
      panel.classList.toggle('show-signin-gate', show);
      if (show) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
    const buyBtn = document.getElementById('buy-btn');
    if (buyBtn && !show && !panel?.classList.contains('is-submitting')) {
      buyBtn.disabled = false;
      buyBtn.dataset.busy = '0';
    }
    if (notice && show) notice.hidden = true;
    refreshTicketJumpVisibility();
  }

  async function requireSignedInAttendee(options) {
    if (await isSignedInAttendee()) return true;
    if (options && options.gate) {
      if (options.intent) saveCheckoutIntent(options.intent.ev, options.intent.data);
      showCheckoutSignInGate(true, options.gate);
      return false;
    }
    location.href = authPageUrl('login', true);
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

  function tierIsApplication(t) {
    if (!t) return false;
    if (t.oneSeatOnly) return true;
    const type = String(t.ticketType || t.ticket_type || '').toLowerCase();
    if (type.includes('application')) return true;
    return /application to attend/i.test(String(t.name || ''));
  }

  function eventIsOsop(ev) {
    if (!ev) return false;
    if (parseBoolFlag(ev.isApprovalRequired)) return true;
    return ticketTiersForEvent(ev).some(tierIsApplication);
  }

  function formatOsopCloseDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return date + ' at ' + time;
  }

  function osopTierCardHtml(t, soldOut) {
    const priceNum = t.priceKey === 'free' ? 0 : Number(t.priceNum) || 0;
    const priceDisplay = priceNum > 0 ? t.price || fmt(priceNum) : 'Free';
    const remainingLabel = soldOut ? '' : tierRemainingLabel(t);
    const closeDate = t.saleEnd ? formatOsopCloseDate(t.saleEnd) : '';
    let html =
      '<div class="osop-tier-card' +
      (soldOut ? ' is-sold-out' : '') +
      '">' +
      '<div class="osop-tier-badge"><span aria-hidden="true">🪑</span> One Seat Only Policy</div>' +
      (soldOut
        ? '<p class="osop-tier-lead">Applications are no longer being accepted for this event.</p>'
        : '<p class="osop-tier-lead">Apply to attend — the host reviews your industry and job title before approving your seat.</p>');
    if (!soldOut) {
      html +=
        '<ol class="osop-tier-steps">' +
        '<li><strong>1. Apply</strong><span>Answer two quick questions about you</span></li>' +
        '<li><strong>2. Review</strong><span>The organiser approves or declines</span></li>' +
        '<li><strong>3. Book</strong><span>Approved applicants receive a payment link</span></li>' +
        '</ol>';
    }
    if (remainingLabel) {
      html += '<p class="osop-tier-meta">' + escapeHtml(remainingLabel) + '</p>';
    }
    if (closeDate && !soldOut) {
      html += '<p class="osop-tier-meta">Applications close ' + escapeHtml(closeDate) + '</p>';
    }
    if (!soldOut) {
      html +=
        '<div class="osop-tier-price-row">' +
        '<span class="osop-tier-price-label">If approved</span>' +
        '<span class="osop-tier-price">' +
        escapeHtml(priceDisplay) +
        '</span></div>';
    }
    html += '</div>';
    return html;
  }

  function syncTicketHeader(ev) {
    const labelEl = document.getElementById('ev-ticket-from-label');
    const priceEl = document.getElementById('ev-ticket-from-price');
    if (!labelEl || !priceEl || !ev) return;
    if (eventIsOsop(ev)) {
      labelEl.textContent = 'Price if approved';
      const priceNum = ev.priceKey === 'free' ? 0 : Number(ev.priceNum) || 0;
      priceEl.textContent =
        priceNum > 0 ? publicListingPriceLabel(ev, { withFrom: false }) : 'Free';
      return;
    }
    labelEl.textContent = 'Tickets from';
    priceEl.textContent =
      ev.priceKey === 'free' ? 'Free' : publicListingPriceLabel(ev, { withFrom: false });
  }

  function normalizeEventFlags(ev, params) {
    const p = params || new URLSearchParams(window.location.search);
    const approvalFromTickets = (ev.tickets || []).some(tierIsApplication);
    return {
      ...ev,
      isApprovalRequired:
        parseBoolFlag(ev.isApprovalRequired) ||
        approvalFromTickets ||
        p.get('approval') === '1' ||
        p.get('isApprovalRequired') === '1',
      isSoldOut: parseBoolFlag(ev.isSoldOut) || p.get('sold_out') === '1' || p.get('isSoldOut') === '1',
      isSalesClosed:
        parseBoolFlag(ev.isSalesClosed) || p.get('sales_closed') === '1' || p.get('isSalesClosed') === '1',
      isTicketSalesPending:
        parseBoolFlag(ev.isTicketSalesPending) ||
        p.get('ticket_sales_pending') === '1' ||
        p.get('isTicketSalesPending') === '1',
      isTicketSalesScheduled:
        parseBoolFlag(ev.isTicketSalesScheduled) ||
        p.get('ticket_sales_scheduled') === '1' ||
        p.get('isTicketSalesScheduled') === '1',
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
      price.textContent = publicListingPriceLabel(ev);
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

    setText('ev-price', publicListingPriceLabel(ev));
    syncTicketHeader(ev);
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
    refreshEventApplicationUi(ev);
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
  let eventApplicationState = null;
  let ticketPanelBound = false;

  function clearCheckoutInlineError() {
    const el = document.getElementById('checkout-inline-error');
    if (!el) return;
    el.hidden = true;
    el.textContent = '';
  }

  function showCheckoutInlineError(message) {
    const el = document.getElementById('checkout-inline-error');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function activeEvent() {
    return currentEventDetail || currentEvent;
  }

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

  function readPaidCheckoutAttendee(qty) {
    const attendee = checkoutAttendeeFromSession();
    if (!attendee) {
      throw new Error('Please sign in to buy tickets for this event.');
    }
    const qtyNum = Math.max(1, parseInt(qty, 10) || 1);
    if (qtyNum > 1) {
      attendee.guestNames = readCheckoutGuestNames(qty);
    }
    return attendee;
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
      stripe_not_configured:
        'Card checkout is not set up on this server. If you are on localhost, add STRIPE_SECRET_KEY to local.env (copy sk_test_… from Vercel), run npm run dev, and restart npm start. On the live site, check Vercel env vars and redeploy.',
      stripe_connect_required:
        'The organiser has not finished payout setup. Ticket sales are temporarily unavailable.',
      free_ticket_use_complete_booking: 'Use Confirm registration for free tickets.',
      not_authenticated: 'Please sign in or create a free account to complete your booking.',
    };
    if (data && data.message) return String(data.message);
    if (messages[code]) return messages[code];
    if (code) return 'Checkout could not start (' + code + '). Please try again.';
    return 'Could not start checkout. Please try again or contact support.';
  }

  async function startPaidCheckout(ev, ticketId, qty, attendee) {
    const event = ev || activeEvent();
    if (!event || !event.id) {
      throw new Error('This event could not be loaded for checkout. Refresh the page and try again.');
    }
    saveBookingPending(event, ticketId, qty, attendee);
    const res = await fetch('/api/auth/create-checkout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: event.id,
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
    const salesPending = Boolean(ev.isTicketSalesPending || ev.isTicketSalesScheduled);
    const panelClosed = ev.isSoldOut || (ev.isSalesClosed && !salesPending);
    const isOsop = eventIsOsop(ev);
    tiersEl.innerHTML = '';

    let firstSelectable = null;

    if (isOsop && tiers.length) {
      const t = tiers.find((tier) => tierIsApplication(tier)) || tiers[0];
      let soldOut = Boolean(t.soldOut) || panelClosed;
      const priceNum = t.priceKey === 'free' ? 0 : Number(t.priceNum) || 0;

      const tier = document.createElement('div');
      tier.className = 'tier tier-osop' + (soldOut ? ' sold-out tier-disabled' : ' selected');
      tier.id = 'ev-tier-osop';
      tier.setAttribute('data-ticket-id', t.id);
      tier.setAttribute('data-price', String(priceNum));
      tier.setAttribute('data-label', t.label || t.name || 'Application');
      if (t.stripePaymentLink) tier.setAttribute('data-stripe-link', t.stripePaymentLink);
      const cap = t.quantityAvailable;
      const sold = Math.max(0, Number(t.registrationsCount) || 0);
      tier.setAttribute('data-qty-max', '1');
      if (cap != null && Number.isFinite(Number(cap))) {
        const left = Math.max(0, Number(cap) - sold);
        if (left <= 0) {
          soldOut = true;
          tier.classList.add('sold-out', 'tier-disabled');
        }
      }

      if (!soldOut) {
        tier.setAttribute('aria-pressed', 'true');
        firstSelectable = tier;
      } else {
        tier.setAttribute('aria-disabled', 'true');
      }

      tier.innerHTML = osopTierCardHtml(t, soldOut);
      tiersEl.appendChild(tier);
    } else {
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
    }

    if (!firstSelectable && tiersEl.children.length && !isOsop) {
      const hint = ev.isSoldOut
        ? 'All ticket tiers are currently sold out.'
        : 'Tickets are not currently available for this event.';
      tiersEl.innerHTML = '<p class="ticket-load-hint">' + hint + '</p>';
    }

    renderVatNote(ev, tiers);

    syncTicketHeader(ev);
    const heroPrice = document.getElementById('ev-price');
    if (heroPrice && ev.priceKey !== 'free') {
      heroPrice.textContent = publicListingPriceLabel(ev);
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
    refreshTicketJumpVisibility();
  }

  let applicationSuccessBound = false;

  function showApplicationSuccessModal(ev) {
    const modal = document.getElementById('application-success-modal');
    const lead = document.getElementById('application-success-lead');
    if (!modal) return;
    const title = ev && ev.title ? String(ev.title).trim() : 'this event';
    if (lead) {
      lead.textContent =
        'Thanks — your request to join “' + title + '” has been submitted to the host.';
    }
    modal.hidden = false;
    document.body.classList.add('modal-open');
    const done = document.getElementById('application-success-done');
    if (done) done.focus();
  }

  function hideApplicationSuccessModal() {
    const modal = document.getElementById('application-success-modal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function initApplicationSuccessModal() {
    if (applicationSuccessBound) return;
    const modal = document.getElementById('application-success-modal');
    if (!modal) return;
    applicationSuccessBound = true;

    const close = () => hideApplicationSuccessModal();
    document.getElementById('application-success-close')?.addEventListener('click', close);
    document.getElementById('application-success-done')?.addEventListener('click', close);
    modal.querySelectorAll('[data-application-success-close]').forEach((el) => {
      el.addEventListener('click', close);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) close();
    });
  }

  function showCheckoutDetails(show) {
    const panel = document.getElementById('tickets');
    const form = document.getElementById('checkout-details-form');
    const secureFoot = document.getElementById('ticket-secure-foot');
    if (panel) {
      panel.classList.toggle('show-checkout', show);
      if (show) panel.classList.remove('show-application');
    }
    if (form) {
      form.hidden = !show;
      if (!show) form.classList.remove('is-paid-guests');
    }
    if (secureFoot && !show) secureFoot.hidden = false;
    if (!show) setCheckoutSubmitting(false);
    refreshTicketJumpVisibility();
  }

  function showPaidGuestCheckout(show, isPaid) {
    if (isPaid === undefined) isPaid = true;
    const form = document.getElementById('checkout-details-form');
    const confirmBtn = document.getElementById('checkout-confirm-btn');
    const intro = document.getElementById('checkout-details-intro');
    const nameField = document.getElementById('checkout-name')?.closest('.form-field');
    const emailField = document.getElementById('checkout-email')?.closest('.form-field');
    const freeTerms = document.querySelector('.checkout-free-terms');
    showCheckoutDetails(show);
    if (form) form.classList.toggle('is-paid-guests', show);
    if (nameField) nameField.hidden = show;
    if (emailField) emailField.hidden = show;
    if (freeTerms) freeTerms.hidden = show && isPaid;
    if (intro && show) {
      intro.textContent = isPaid
        ? 'Add names for additional attendees in your booking.'
        : 'Add names for additional attendees, then confirm your registration.';
    }
    if (confirmBtn) {
      confirmBtn.textContent = show ? (isPaid ? 'Continue to payment' : 'Confirm registration') : 'Confirm registration';
    }
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
    const name = document.getElementById('checkout-name')?.value.trim() || '';
    const email = document.getElementById('checkout-email')?.value.trim() || '';
    if (!name) throw new Error('Please enter your full name.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Please enter a valid email address.');
    }
    const guestNames = readCheckoutGuestNames(ticketQty);
    return { name, email, guestNames };
  }

  function syncPaidCheckoutPanel(label, qty, total) {
    const ev = activeEvent();
    const paidBlock = document.getElementById('ticket-paid-checkout');
    const organiserEl = document.getElementById('checkout-organiser-name');
    const totalEl = document.getElementById('checkout-total-price');
    const refundEl = document.getElementById('checkout-refund-policy');
    const feeNoteEl = document.getElementById('checkout-fee-note');
    const accountLine = document.getElementById('checkout-account-line');
    const secureFoot = document.getElementById('ticket-secure-foot');
    const buy = document.getElementById('buy-btn');

    if (ev?.isTicketSalesScheduled || ev?.isTicketSalesPending) {
      if (paidBlock) paidBlock.hidden = true;
      if (secureFoot) secureFoot.hidden = true;
      return;
    }

    const isFree = !(total > 0);

    if (paidBlock) paidBlock.hidden = isFree;
    if (secureFoot) secureFoot.hidden = isFree;
    if (buy && !eventIsOsop(ev)) {
      buy.textContent = isFree ? 'Get free ticket' : 'Buy ticket';
    }
    if (organiserEl && ev) {
      organiserEl.textContent = ev.organiser || ev.organiserName || 'Event organiser';
    }
    if (totalEl) {
      totalEl.textContent =
        fmt(total || 0) +
        (total > 0 ? ' — ' + (label || 'Ticket') + ' × ' + String(qty || 1) : '');
    }
    if (refundEl && ev) {
      refundEl.textContent = refundPolicyDetailText(ev);
    }
    if (feeNoteEl) feeNoteEl.hidden = isFree;
    if (accountLine) {
      if (!isFree && checkoutSessionUser?.email) {
        accountLine.textContent = 'Booking as ' + checkoutSessionUser.email;
        accountLine.hidden = false;
      } else {
        accountLine.hidden = true;
        accountLine.textContent = '';
      }
    }
  }

  function updateFreeCheckoutSummary(ev) {
    const freeOrganiser = document.getElementById('checkout-free-organiser');
    if (freeOrganiser) {
      const organiserName = ev ? ev.organiser || ev.organiserName || 'the event organiser' : 'the event organiser';
      freeOrganiser.textContent = 'Organised by ' + organiserName;
      freeOrganiser.hidden = false;
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

  let scheduledUiBound = false;

  function formatTicketSalesOpensClient(ev) {
    if (ev.ticketSalesOpensLabel) return ev.ticketSalesOpensLabel;
    if (!ev.ticketSalesOpensAt) return '';
    const d = new Date(ev.ticketSalesOpensAt);
    if (Number.isNaN(d.getTime())) return '';
    return (
      d.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }) +
      ' at ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    );
  }

  function bindTicketSalesScheduledUi(ev) {
    const panel = document.getElementById('ticket-sales-scheduled');
    const lead = document.getElementById('ticket-sales-scheduled-lead');
    const btn = document.getElementById('ticket-sales-scheduled-save-btn');
    const statusEl = document.getElementById('ticket-sales-scheduled-status');
    if (!panel || !btn) return;

    const opensLabel = formatTicketSalesOpensClient(ev);
    if (lead) {
      lead.textContent = opensLabel
        ? 'Tickets open ' + opensLabel + '.'
        : 'Ticket sales are not open yet.';
    }

    function refreshScheduledSaveUi() {
      const eventId = String(document.body.getAttribute('data-event-id') || ev.id || '');
      const saved = window.HubFavourites ? window.HubFavourites.isSaved(eventId) : false;
      btn.textContent = saved ? "Saved — we'll notify you" : 'Save event';
      btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
      btn.classList.toggle('is-saved', saved);
      const saveBtn = document.getElementById('save-btn');
      if (saveBtn && window.HubFavourites) {
        saveBtn.setAttribute('aria-pressed', saved ? 'true' : 'false');
        saveBtn.setAttribute('aria-label', saved ? 'Remove from saved' : 'Save event');
        saveBtn.classList.toggle('is-saved', saved);
        const label = saveBtn.querySelector('.action-btn-label');
        if (label) label.textContent = saved ? 'Saved' : 'Save event';
      }
    }

    refreshScheduledSaveUi();
    if (window.HubFavourites) {
      window.HubFavourites.sync().then(function () {
        refreshScheduledSaveUi();
      });
    }

    if (scheduledUiBound) return;
    scheduledUiBound = true;
    btn.addEventListener('click', async function () {
      if (!window.HubFavourites) return;
      const current = activeEvent() || ev;
      if (
        !(await requireSignedInAttendee({
          gate: {
            title: 'Sign in to save this event',
            lead: "Create a free account or sign in — we'll email you when tickets go on sale.",
            checkoutFlag: true,
          },
          intent: {
            ev: current,
            data: { action: 'save_event', qty: 1, termsAgreed: false, ticketId: null },
          },
        }))
      ) {
        return;
      }
      const eventId = String(document.body.getAttribute('data-event-id') || current.id || '');
      const organiserId = String(current.organiserId || '').trim();

      btn.disabled = true;
      if (statusEl) statusEl.hidden = true;

      try {
        const saved = await window.HubFavourites.toggle(eventId, { organiserId: organiserId });
        refreshScheduledSaveUi();
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.className = 'ticket-sales-scheduled-status is-ok';
          statusEl.textContent = saved
            ? "Saved — we'll email you when tickets go on sale."
            : 'Removed from saved events.';
        }
      } catch (e) {
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.className = 'ticket-sales-scheduled-status is-error';
          statusEl.textContent = e.message || 'Could not save this event. Please try again.';
        }
      } finally {
        btn.disabled = false;
        refreshScheduledSaveUi();
      }
    });
  }

  function applicationBlocksReapply(state) {
    if (!state || !state.hasApplication) return false;
    return String(state.applicationStatus || '').trim() !== 'Denied';
  }

  function applicationStatusCopy(state) {
    const status = String(state?.applicationStatus || '').trim();
    const payment = String(state?.paymentStatus || '').trim();
    if (status === 'Pending') {
      return {
        title: 'Application submitted',
        lead:
          "You've already applied for this event. We'll let you know when the organiser has made a decision — check your email and My Hub for updates.",
      };
    }
    if (status === 'Approved') {
      if (payment === 'Paid' || payment === 'Free') {
        return {
          title: "You're registered",
          lead: 'Your application was approved and your place is confirmed. View your ticket in My Hub.',
        };
      }
      return {
        title: 'Application approved',
        lead: 'Good news — the organiser approved your application. Complete your booking in My Hub to secure your seat.',
      };
    }
    return {
      title: 'Application submitted',
      lead: "You've already applied for this event.",
    };
  }

  function applyEventApplicationUi(ev) {
    const panel = document.getElementById('tickets');
    const statusPanel = document.getElementById('osop-application-status');
    const titleEl = document.getElementById('osop-application-status-title');
    const leadEl = document.getElementById('osop-application-status-lead');
    if (!panel) return;

    const shouldShow = eventIsOsop(ev) && applicationBlocksReapply(eventApplicationState);
    panel.classList.toggle('is-application-submitted', shouldShow);
    if (!statusPanel) return;

    if (!shouldShow) {
      statusPanel.hidden = true;
      return;
    }

    const copy = applicationStatusCopy(eventApplicationState);
    if (titleEl) titleEl.textContent = copy.title;
    if (leadEl) leadEl.textContent = copy.lead;
    statusPanel.hidden = false;
  }

  async function refreshEventApplicationUi(ev) {
    if (!ev || !ev.id || !eventIsOsop(ev)) {
      eventApplicationState = null;
      applyEventApplicationUi(ev);
      return;
    }

    const signedIn = await isSignedInAttendee();
    if (!signedIn) {
      eventApplicationState = null;
      applyEventApplicationUi(ev);
      return;
    }

    try {
      const res = await fetch(
        '/api/auth/event-application?eventId=' + encodeURIComponent(ev.id),
        { credentials: 'include' }
      );
      const data = await res.json().catch(function () {
        return {};
      });
      if (res.ok && data.ok && data.hasApplication) {
        eventApplicationState = {
          hasApplication: true,
          applicationStatus: data.applicationStatus,
          paymentStatus: data.paymentStatus,
          registrationId: data.registrationId,
          submittedAt: data.submittedAt,
        };
      } else {
        eventApplicationState = null;
      }
    } catch (e) {
      eventApplicationState = null;
    }
    applyEventApplicationUi(ev);
  }

  function applyTicketPanelState(ev) {
    const panel = document.getElementById('tickets');
    const buy = document.getElementById('buy-btn');
    const purchaseView = document.getElementById('ticket-purchase-view');
    const appForm = document.getElementById('seat-application-form');
    const nudgePanel = document.getElementById('ticket-sales-nudge');
    const scheduledPanel = document.getElementById('ticket-sales-scheduled');
    if (!panel || !buy) return;

    panel.dataset.approvalRequired = eventIsOsop(ev) ? 'true' : 'false';
    panel.dataset.soldOut = ev.isSoldOut ? 'true' : 'false';
    panel.dataset.salesClosed = ev.isSalesClosed ? 'true' : 'false';

    panel.classList.remove(
      'is-unavailable',
      'is-sales-pending',
      'is-sales-scheduled',
      'is-approval-mode',
      'show-application',
      'show-checkout'
    );
    showSeatApplication(false);
    showCheckoutDetails(false);
    if (nudgePanel) nudgePanel.hidden = true;
    if (scheduledPanel) scheduledPanel.hidden = true;

    if (ev.isTicketSalesScheduled) {
      panel.classList.add('is-sales-scheduled');
      buy.disabled = true;
      buy.classList.add('cta-btn-disabled');
      if (purchaseView) purchaseView.hidden = true;
      if (scheduledPanel) {
        scheduledPanel.hidden = false;
        bindTicketSalesScheduledUi(ev);
      }
      applyEventApplicationUi(ev);
      return;
    }

    if (purchaseView) purchaseView.hidden = false;

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
      applyEventApplicationUi(ev);
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
      applyEventApplicationUi(ev);
      return;
    }

    buy.disabled = false;
    buy.classList.remove('cta-btn-disabled');
    if (purchaseView) purchaseView.removeAttribute('aria-hidden');

    if (eventIsOsop(ev)) {
      panel.classList.add('is-approval-mode');
      buy.textContent = 'Apply for a Seat';
      const osopFoot = document.getElementById('osop-apply-foot');
      if (osopFoot) osopFoot.hidden = false;
    } else {
      const osopFoot = document.getElementById('osop-apply-foot');
      if (osopFoot) osopFoot.hidden = true;
      buy.textContent = ev.priceKey === 'free' ? 'Get free ticket' : 'Buy ticket';
    }
    updateTicketJumpBar(ev);
    applyEventApplicationUi(ev);
  }

  let ticketJumpBound = false;

  function refreshTicketJumpVisibility() {
    const jump = document.getElementById('ev-ticket-jump');
    const panel = document.getElementById('tickets');
    if (!jump || !panel) return;

    const mobile = window.matchMedia('(max-width: 768px)').matches;
    const panelVisible = jump.dataset.panelVisible === '1';
    const inFlow =
      panel.classList.contains('show-checkout') ||
      panel.classList.contains('show-application') ||
      panel.classList.contains('show-signin-gate') ||
      panel.classList.contains('is-application-submitted');
    const show = mobile && !panelVisible && !inFlow;

    jump.hidden = !show;
    jump.classList.toggle('is-visible', show);
    document.body.classList.toggle('ev-ticket-jump-active', show);
  }

  function initTicketJumpBar() {
    if (ticketJumpBound) return;
    const jump = document.getElementById('ev-ticket-jump');
    const btn = document.getElementById('ev-ticket-jump-btn');
    const panel = document.getElementById('tickets');
    if (!jump || !btn || !panel) return;
    ticketJumpBound = true;

    btn.addEventListener('click', function () {
      const navOffset = window.matchMedia('(max-width: 768px)').matches ? 64 : 80;
      const top = panel.getBoundingClientRect().top + window.scrollY - navOffset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });

    window.matchMedia('(max-width: 768px)').addEventListener('change', function () {
      updateTicketJumpBar(activeEvent());
    });

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          jump.dataset.panelVisible =
            entry.isIntersecting && entry.intersectionRatio > 0.15 ? '1' : '0';
          refreshTicketJumpVisibility();
        });
      },
      { threshold: [0, 0.15, 0.35], rootMargin: '-56px 0px -72px 0px' }
    );
    observer.observe(panel);
  }

  function updateTicketJumpBar(ev) {
    initTicketJumpBar();
    const jump = document.getElementById('ev-ticket-jump');
    const label = document.getElementById('ev-ticket-jump-label');
    const priceEl = document.getElementById('ev-ticket-jump-price');
    if (!jump) return;

    if (!ev) {
      jump.hidden = true;
      jump.classList.remove('is-visible');
      document.body.classList.remove('ev-ticket-jump-active');
      return;
    }

    const priceNode = document.querySelector('.ticket-header .price');
    const priceText = priceNode ? priceNode.textContent.trim() : '';

    let labelText = 'Get tickets';
    if (ev.isSoldOut) labelText = 'Sold out';
    else if (ev.isSalesClosed) labelText = 'Registration closed';
    else if (ev.isTicketSalesScheduled || ev.isTicketSalesPending) labelText = 'View tickets';
    else if (eventIsOsop(ev)) labelText = 'Apply for a seat';
    else if (ev.priceKey === 'free') labelText = 'Get free ticket';
    else labelText = 'Buy ticket';

    if (label) label.textContent = labelText;
    if (priceEl) {
      const showPrice =
        priceText &&
        labelText !== 'Sold out' &&
        labelText !== 'Registration closed' &&
        labelText !== 'View tickets';
      priceEl.textContent = showPrice ? priceText : '';
      priceEl.hidden = !showPrice;
    }

    refreshTicketJumpVisibility();
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

  function isLocalDev() {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  }

  function shareUrlForEvent(ev) {
    const path = canonicalEventPath(ev);
    let origin = window.location.origin;
    if (isLocalDev()) {
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical && canonical.href) {
        try {
          origin = new URL(canonical.href).origin;
        } catch (e) {
          origin = 'https://the-networker-hub.vercel.app';
        }
      } else {
        origin = 'https://the-networker-hub.vercel.app';
      }
    }
    return origin.replace(/\/$/, '') + path;
  }

  function buildEventShareContent(ev, shareUrl) {
    const title = String(ev.title || 'Event on The Networker Hub').trim();
    const parts = [];
    const whenWhere = String(ev.dateLine || '').trim();
    if (whenWhere) {
      parts.push(whenWhere);
    } else {
      if (ev.date) parts.push(ev.date);
      if (ev.time) parts.push(ev.time);
      const loc = ev.city || ev.location || ev.venue;
      if (loc) parts.push(loc);
    }
    if (ev.organiser) parts.push('Hosted by ' + ev.organiser);
    const details = parts.join(' · ');
    const text = details ? title + ' — ' + details : title;
    const message = text + '\n\n' + shareUrl;
    return { title, text, details, message, url: shareUrl };
  }

  function initActions(ev) {
    const saveBtn = document.getElementById('save-btn');
    const shareBtn = document.getElementById('share-btn');
    const shareMenu = document.getElementById('share-menu');
    const calBtn = document.getElementById('calendar-btn');
    const calMenu = document.getElementById('calendar-menu');
    const url = shareUrlForEvent(ev);
    const share = buildEventShareContent(ev, url);

    const shareMenuLabel = shareMenu && shareMenu.querySelector('.action-dropdown-label');
    if (shareMenuLabel) {
      shareMenuLabel.textContent = isLocalDev()
        ? 'Share this event (link previews use the live site)'
        : 'Share this event';
    }

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
    let shareState = { url: url, share: share };

    function applyShareLinks() {
      const publicUrl = shareUrlForEvent(ev);
      shareState = {
        url: publicUrl,
        share: buildEventShareContent(ev, publicUrl),
      };
      if (linkedIn) {
        linkedIn.href =
          'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(publicUrl);
      }
      if (twitter) {
        twitter.href =
          'https://twitter.com/intent/tweet?url=' +
          encodeURIComponent(publicUrl) +
          '&text=' +
          encodeURIComponent(shareState.share.text);
      }
      if (facebook) {
        facebook.href = 'https://www.facebook.com/sharer.php?u=' + encodeURIComponent(publicUrl);
      }
      if (shareEmail) {
        shareEmail.href =
          'mailto:?subject=' +
          encodeURIComponent(shareState.share.title + ' – The Networker Hub') +
          '&body=' +
          encodeURIComponent('I thought you might like this event:\n\n' + shareState.share.message);
      }
    }

    applyShareLinks();
    if (isLocalDev()) {
      setTimeout(applyShareLinks, 2000);
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
        const message = shareState.share.message;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(message).then(done).catch(function () {
            window.prompt('Copy this message:', message);
          });
        } else {
          window.prompt('Copy this message:', message);
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

  function initTicketPanel(ev) {
    if (ticketPanelBound) return;
    const qtyDown = document.getElementById('qty-down');
    if (!qtyDown) return;
    ticketPanelBound = true;
    initApplicationSuccessModal();

    currentEventDetail = ev;
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
      const evNow = activeEvent();
      if (eventIsOsop(evNow)) {
        qty = 1;
        maxQty = 1;
      }
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
      syncPaidCheckoutPanel(label, qty, total);
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
    const appForm = document.getElementById('seat-application-form');
    const appBack = document.getElementById('application-back-btn');

    loadCheckoutSessionUser().then(function () {
      update();
      const evNow = activeEvent();
      if (evNow && eventIsOsop(evNow)) refreshEventApplicationUi(evNow);
    });

    if (appBack) {
      appBack.addEventListener('click', () => showSeatApplication(false));
    }

    if (appForm) {
      appForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (applicationBlocksReapply(eventApplicationState)) return;
        if (!(await requireSignedInAttendee())) return;

        const submitApplication = async () => {
          const industry = String(document.getElementById('apply-industry')?.value || '').trim();
          const jobTitle = String(document.getElementById('apply-job-title')?.value || '').trim();
          if (!industry || !jobTitle) {
            window.alert('Please answer both application questions.');
            return;
          }

          const ev = activeEvent();
          const tierEl = getSelectedTierEl();
          const ticketId = tierEl ? tierEl.getAttribute('data-ticket-id') : null;
          const submitBtn = appForm.querySelector('button[type="submit"]');
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting…';
          }

          try {
            const res = await fetch('/api/auth/submit-application', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                eventId: ev.id,
                ticketId: isUuid(ticketId) ? ticketId : null,
                industry,
                jobTitle,
              }),
            });
            const data = await res.json().catch(function () {
              return {};
            });
            if (!res.ok || !data.ok) {
              throw new Error(
                (data && data.message) || (data && data.error) || 'application_failed'
              );
            }
            eventApplicationState = {
              hasApplication: true,
              applicationStatus: 'Pending',
              paymentStatus: 'Pending',
              registrationId: data.id || data.registration?.id || null,
            };
            showSeatApplication(false);
            appForm.reset();
            applyEventApplicationUi(activeEvent());
            showApplicationSuccessModal(activeEvent());
          } catch (err) {
            window.alert(
              err && err.message
                ? err.message
                : 'Could not submit your application. Please try again.'
            );
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Submit Application';
            }
          }
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

    async function processCheckoutBooking(isPaid) {
      clearCheckoutInlineError();
      const ev = activeEvent();
      update();
      const tierEl = getSelectedTierEl();
      const ticketId = tierEl ? tierEl.getAttribute('data-ticket-id') : null;
      const tierPrice = tierEl ? parseFloat(tierEl.getAttribute('data-price')) || 0 : price;
      const subtotal = tierPrice * qty;
      const fee = subtotal > 0 ? subtotal * BOOKING_FEE_RATE + BOOKING_FEE_PER_TICKET * qty : 0;
      const total = subtotal + fee;
      const paid = isPaid != null ? isPaid : tierPrice > 0;

      let attendee;
      try {
        attendee = readPaidCheckoutAttendee(qty);
      } catch (err) {
        throw err;
      }

      if (!paid) {
        setCheckoutSubmitting(true, 'Registering…');
        try {
          await completeFreeBooking(ev, ticketId, qty, attendee);
        } catch (err) {
          setCheckoutSubmitting(false);
          throw err;
        }
        return;
      }

      setCheckoutSubmitting(true, 'Redirecting to payment…');
      try {
        await startPaidCheckout(ev, ticketId, qty, attendee);
      } catch (err) {
        setCheckoutSubmitting(false);
        throw err;
      }
    }

    if (checkoutForm) {
      checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (checkoutForm.classList.contains('is-paid-guests')) {
          const tierEl = getSelectedTierEl();
          const tierPrice = tierEl ? parseFloat(tierEl.getAttribute('data-price')) || 0 : price;
          const isPaid = tierPrice > 0;
          if (!isPaid) {
            const termsAgree = document.getElementById('checkout-free-terms-agree');
            if (termsAgree && !termsAgree.checked) {
              window.alert('Please confirm your details are correct before registering.');
              termsAgree.focus();
              return;
            }
          }
          try {
            await processCheckoutBooking(isPaid);
          } catch (err) {
            window.alert(err && err.message ? err.message : 'Could not complete your booking.');
          }
          return;
        }

        window.alert('Please sign in or create a free account to register for this event.');
      });
    }

    if (buy) {
      buy.addEventListener('click', async () => {
        if (buy.disabled || buy.dataset.busy === '1') return;
        clearCheckoutInlineError();

        const evNow = activeEvent();
        const buyLabel = buy.textContent || 'Buy ticket';
        buy.dataset.busy = '1';
        buy.disabled = true;

        try {
        if (evNow?.isApprovalRequired || eventIsOsop(evNow)) {
          if (applicationBlocksReapply(eventApplicationState)) {
            return;
          }
          if (
            !(await requireSignedInAttendee({
              gate: {
                title: 'Sign in to apply for a seat',
                lead: 'This event uses an approval process. Sign in or create a free account to submit your application.',
                checkoutFlag: true,
              },
              intent: {
                ev: evNow,
                data: {
                  action: 'apply',
                  qty: qty,
                  termsAgreed: false,
                  ticketId: getSelectedTierEl()
                    ? getSelectedTierEl().getAttribute('data-ticket-id')
                    : null,
                },
              },
            }))
          ) {
            return;
          }
          showSeatApplication(true);
          const industry = document.getElementById('apply-industry');
          if (industry) industry.focus();
          return;
        }

        update();
        const tierEl = getSelectedTierEl();
        const tierPrice = tierEl ? parseFloat(tierEl.getAttribute('data-price')) || 0 : price;

        if (tierPrice <= 0) {
          if (!(await isSignedInAttendee())) {
            const tierElForIntent = getSelectedTierEl();
            saveCheckoutIntent(evNow, {
              ticketId: tierElForIntent ? tierElForIntent.getAttribute('data-ticket-id') : null,
              qty: qty,
              termsAgreed: false,
              action: 'free_buy',
            });
            showCheckoutSignInGate(true, {
              title: 'Sign in to get your free ticket',
              lead:
                'Create a free account or sign in to register. Your ticket is saved to My Hub — one account per person, no repeat guest bookings.',
              checkoutFlag: true,
            });
            return;
          }
          await loadCheckoutSessionUser();
          if (qty > 1) {
            renderCheckoutGuestNames(qty);
            updateFreeCheckoutSummary(evNow);
            showPaidGuestCheckout(true, false);
            return;
          }
          try {
            await processCheckoutBooking(false);
          } catch (err) {
            window.alert(
              err && err.message ? err.message : 'Could not complete your registration. Please try again.'
            );
          }
          return;
        }

        const termsAgree = document.getElementById('checkout-terms-agree');
        if (termsAgree && !termsAgree.checked) {
          showCheckoutInlineError(
            'Please confirm you have read the refund policy and agree to proceed.'
          );
          termsAgree.focus();
          return;
        }

        if (!(await isSignedInAttendee())) {
          const tierElForIntent = getSelectedTierEl();
          saveCheckoutIntent(evNow, {
            ticketId: tierElForIntent ? tierElForIntent.getAttribute('data-ticket-id') : null,
            qty: qty,
            termsAgreed: termsAgree ? termsAgree.checked : false,
            action: 'paid_buy',
          });
          showCheckoutSignInGate(true, {
            title: 'Sign in to buy tickets',
            lead:
              'Create a free account or sign in to complete your booking. Your ticket is saved to My Hub — one account per person.',
            checkoutFlag: true,
          });
          return;
        }
        await loadCheckoutSessionUser();
        syncPaidCheckoutPanel(label, qty, tierPrice * qty + (tierPrice > 0 ? tierPrice * qty * BOOKING_FEE_RATE + BOOKING_FEE_PER_TICKET * qty : 0));

        if (qty > 1) {
          renderCheckoutGuestNames(qty);
          showPaidGuestCheckout(true);
          return;
        }

        try {
          await processCheckoutBooking(true);
        } catch (err) {
          showCheckoutInlineError(
            err && err.message ? err.message : 'Could not start checkout. Please try again.'
          );
        }
        } finally {
          buy.dataset.busy = '0';
          if (!document.getElementById('tickets')?.classList.contains('show-signin-gate')) {
            buy.disabled = false;
            if (!document.getElementById('tickets')?.classList.contains('is-submitting')) {
              buy.textContent = buyLabel;
            }
          }
        }
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
      refreshEventApplicationUi(newEv);
      document.body.setAttribute('data-event-id', newEv.id);
      showSeatApplication(false);
      showCheckoutDetails(false);
      showCheckoutSignInGate(false);
      const selectedTier =
        document.querySelector('#ticket-tiers .tier.selected:not(.sold-out):not(.tier-disabled)') ||
        document.querySelector('#ticket-tiers .tier:not(.sold-out):not(.tier-disabled)');
      if (selectedTier) selectTier(selectedTier);
      else update();
      wireListingReport(newEv);
      setTimeout(function () {
        tryResumeCheckoutIntent(newEv);
      }, 0);
    };

    async function tryResumeCheckoutIntent(eventForResume) {
      const intent = readCheckoutIntent();
      if (!intent || String(intent.eventId) !== String(eventForResume.id)) return;
      if (!(await isSignedInAttendee())) return;

      if (intent.ticketId) {
        const escaped = CSS.escape(String(intent.ticketId));
        const tier = document.querySelector('#ticket-tiers .tier[data-ticket-id="' + escaped + '"]');
        if (tier && !tier.classList.contains('sold-out') && !tier.classList.contains('tier-disabled')) {
          selectTier(tier);
        }
      }
      if (intent.qty > 1) {
        qty = Math.min(intent.qty, maxQty);
        update();
      }
      const terms = document.getElementById('checkout-terms-agree');
      if (terms && intent.termsAgreed) terms.checked = true;

      clearCheckoutIntent();
      showCheckoutSignInGate(false);

      if (intent.action === 'save_event') {
        const saveBtn = document.getElementById('ticket-sales-scheduled-save-btn');
        if (saveBtn && window.HubFavourites) saveBtn.click();
        return;
      }

      if (intent.action === 'apply') {
        await refreshEventApplicationUi(eventForResume);
        if (applicationBlocksReapply(eventApplicationState)) return;
        showSeatApplication(true);
        const industry = document.getElementById('apply-industry');
        if (industry) industry.focus();
        return;
      }

      const notice = document.getElementById('checkout-resume-notice');
      const noticeText = document.getElementById('checkout-resume-notice-text');
      if (notice && noticeText) {
        const btnLabel = intent.action === 'free_buy' ? 'Get free ticket' : 'Buy ticket';
        const step =
          intent.action === 'free_buy' ? 'complete your registration' : 'continue to payment';
        noticeText.innerHTML =
          'You\u2019re signed in \u2014 your ticket selection is ready. Click <strong>' +
          btnLabel +
          '</strong> to ' +
          step +
          '.';
        notice.hidden = false;
      }

      const panel = document.getElementById('tickets');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      await loadCheckoutSessionUser();
    }

    setTimeout(function () {
      tryResumeCheckoutIntent(ev);
    }, 0);
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
