/**
 * Event detail page — /api/events?id= or URL query fallback.
 */
(function () {
  window.hubEventDetailBooted = true;

  const BOOKING_FEE_RATE = 0.045;
  const BOOKING_FEE_PER_TICKET = 0.2;

  let currentEvent = null;
  let guestVisitEligibilityByOrganiser = window.hubGuestVisitEligibilityByOrganiser || {};
  window.hubGuestVisitEligibilityByOrganiser = guestVisitEligibilityByOrganiser;
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
      const opts = Object.assign({}, options || {});
      if (!opts.guestVisitEligibility && !opts.guestVisitRemaining) {
        const organiserId = String((ev && ev.organiserId) || '').trim();
        if (organiserId && guestVisitEligibilityByOrganiser[organiserId]) {
          opts.guestVisitEligibility = guestVisitEligibilityByOrganiser[organiserId];
        } else {
          const sameOrganiser =
            ev &&
            currentEvent &&
            organiserId &&
            organiserId === String(currentEvent.organiserId || '');
          if (sameOrganiser && guestVisitEligibility) {
            opts.guestVisitEligibility = guestVisitEligibility;
          }
        }
      }
      return window.HubBookingFees.listingPriceLabel(ev, opts);
    }
    if (!ev || ev.priceKey === 'free') {
      const mode = String(ev?.attendanceMode || '').trim();
      if (
        ev?.isMembersOnlyEvent &&
        mode !== 'category_exclusivity' &&
        mode !== 'osop'
      ) {
        return 'Members only';
      }
      return 'Free';
    }
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
    return (
      s.indexOf('https:') === 0 ||
      s.indexOf('http:') === 0 ||
      s.indexOf('data:image/') === 0 ||
      s.indexOf('/') === 0
    );
  }

  function ensureHostAvatarStructure(avatar) {
    if (!avatar) return { logoEl: null, initialsEl: null };
    let logoEl = document.getElementById('ev-host-logo');
    let initialsEl = document.getElementById('ev-host-initials');
    if (!logoEl || !initialsEl || logoEl.parentNode !== avatar || initialsEl.parentNode !== avatar) {
      avatar.innerHTML = '';
      logoEl = document.createElement('img');
      logoEl.id = 'ev-host-logo';
      logoEl.width = 64;
      logoEl.height = 64;
      logoEl.alt = '';
      logoEl.hidden = true;
      initialsEl = document.createElement('span');
      initialsEl.id = 'ev-host-initials';
      initialsEl.className = 'host-initials';
      initialsEl.setAttribute('aria-hidden', 'true');
      avatar.appendChild(logoEl);
      avatar.appendChild(initialsEl);
    }
    return { logoEl: logoEl, initialsEl: initialsEl };
  }

  function showHostInitials(avatar, logoEl, initialsEl, host) {
    if (!avatar || !initialsEl) return;
    if (logoEl) {
      logoEl.hidden = true;
      logoEl.removeAttribute('src');
      logoEl.onerror = null;
    }
    initialsEl.hidden = false;
    initialsEl.textContent = hostInitials(host);
    avatar.classList.remove('has-logo');
  }

  let localSessionPromise = null;

  function fetchSessionData() {
    if (typeof window.hubFetchSession === 'function') return window.hubFetchSession();
    if (!localSessionPromise) {
      localSessionPromise = fetch('/api/auth/session', { credentials: 'include' }).then(function (res) {
        return res.json();
      });
    }
    return localSessionPromise;
  }

  async function isSignedInAttendee() {
    try {
      const data = await fetchSessionData();
      return !!(data.ok && data.user);
    } catch (e) {
      return false;
    }
  }

  function authPageUrl(page, withCheckoutFlag) {
    const next = encodeURIComponent(location.pathname + location.search);
    let url = '/' + page + '?next=' + next;
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
    /* Only trust a real stored slug — inventing from title breaks navigation when
       the DB slug has a uniqueness suffix (e.g. breakfast-club-2). */
    if (stored && !uuidLike) return stored;
    return '';
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
    if (m.includes('online') && !m.includes('person')) return 'Online event';
    return 'In-person event';
  }

  function syncTitleTags(ev) {
    const wrap = document.getElementById('ev-title-tags');
    const cat = document.getElementById('ev-title-tag-category');
    const format = document.getElementById('ev-title-tag-format');
    const price = document.getElementById('ev-title-tag-price');
    if (!wrap) return;
    const categoryLabel = String(ev.typeRaw || ev.typeCategory || ev.eventType || '').trim();
    const formatLabel = formatTagLabel(ev.format);
    const priceLabel = publicListingPriceLabel(ev, { withFrom: false });
    if (cat) {
      cat.textContent = categoryLabel || 'Event';
      cat.hidden = !categoryLabel && !formatLabel;
    }
    if (format) {
      format.textContent = formatLabel;
      format.className =
        'title-tag' +
        (formatTagClass(ev.format) ? ' title-tag--online' : ' title-tag--inperson');
    }
    if (price) {
      price.textContent = priceLabel || '';
      price.hidden = !priceLabel || priceLabel === '—';
    }
    wrap.hidden = false;
  }

  function formatTagClass(fmt) {
    const m = String(fmt || '').toLowerCase();
    if (m.includes('online') && !m.includes('person')) return 'online-tag';
    return '';
  }

  function formatTagLabel(fmt) {
    const m = String(fmt || '').toLowerCase();
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
    if (t.categoryExclusivity) return true;
    const type = String(t.ticketType || t.ticket_type || '').toLowerCase();
    if (type.includes('application')) return true;
    return /application to attend/i.test(String(t.name || ''));
  }

  function eventIsCategoryExclusivity(ev) {
    if (!ev) return false;
    const mode = String(ev.attendanceMode || '').trim();
    if (mode === 'category_exclusivity' || mode === 'osop') return true;
    if (parseBoolFlag(ev.isApprovalRequired)) return true;
    return ticketTiersForEvent(ev).some(tierIsApplication);
  }

  function eventIsMembershipMeeting(ev) {
    return String(ev?.attendanceMode || '').trim() === 'membership_meeting';
  }

  function eventUsesMembershipAfterVisits(ev) {
    if (!ev) return false;
    if (eventIsMembershipMeeting(ev)) return true;
    if (!eventIsCategoryExclusivity(ev)) return false;
    if (!eventAllowsGuestPasses(ev)) return false;
    return Boolean(ev.organiserMembershipOffered);
  }

  function eventIsGuestProgramme(ev) {
    const mode = String(ev?.attendanceMode || '').trim();
    return mode === 'guest_programme' || mode === 'membership_meeting';
  }

  function eventAllowsGuestPasses(ev) {
    if (!ev || ev.guestPassesDisabled) return false;
    if (!(Number(ev.complimentaryVisitsAllowed) > 0)) return false;
    if (eventIsGuestProgramme(ev)) return true;
    // Category Exclusivity (and any mode) can offer guest visits when a guest-visit tier exists
    return Boolean(ev.guestVisitTier);
  }

  function organiserMembershipJoinHref(ev) {
    const base = organiserProfileHref(ev);
    return base ? base + '#org-membership-join' : '';
  }

  function eventOffersPaidHubMembership(ev) {
    const plan = ev && ev.organiserMembershipPlan;
    if (!plan || !plan.offered) return false;
    const monthly = Number(plan.monthly && plan.monthly.amountPounds) || 0;
    const annual = Number(plan.annual && plan.annual.amountPounds) || 0;
    return monthly >= 1 || annual >= 1;
  }

  function membershipSoftUpsellHtml(ev) {
    if (!ev || isRosterMemberForEvent()) return '';
    if (ev.isMembersOnlyEvent) return '';
    const paidJoin = eventOffersPaidHubMembership(ev);
    const memberRate = Boolean(ev.hasMembersOnlyTiers);
    const offered = Boolean(ev.organiserMembershipOffered) || paidJoin || memberRate;
    if (!offered) return '';

    const signInHref = authPageUrl('login');
    const joinHref = organiserMembershipJoinHref(ev);
    const plan = ev.organiserMembershipPlan || null;
    const monthly = plan && plan.monthly ? Number(plan.monthly.amountPounds) || 0 : 0;
    const annual = plan && plan.annual ? Number(plan.annual.amountPounds) || 0 : 0;
    let joinLabel = 'join membership';
    if (monthly >= 1 && annual >= 1) joinLabel = 'join monthly or annual membership';
    else if (monthly >= 1) joinLabel = 'join monthly membership';
    else if (annual >= 1) joinLabel = 'join annual membership';

    const parts = [
      '<div class="ticket-membership-upsell">',
      '<p class="ticket-membership-upsell-line">',
      memberRate || paidJoin
        ? 'Already a member? <a href="' +
          escapeHtml(signInHref) +
          '">Sign in</a> with your membership email for the member rate.'
        : 'Already on this group\u2019s member list? <a href="' +
          escapeHtml(signInHref) +
          '">Sign in</a> with that email.',
      '</p>',
    ];
    if (paidJoin && joinHref) {
      parts.push(
        '<p class="ticket-membership-upsell-line ticket-membership-upsell-line--secondary">',
        'Or <a href="' + escapeHtml(joinHref) + '">' + escapeHtml(joinLabel) + '</a>',
        monthly >= 1 ? ' (from £' + escapeHtml(String(monthly % 1 ? monthly.toFixed(2) : monthly)) + '/month)' : '',
        '.</p>'
      );
    }
    parts.push('</div>');
    return parts.join('');
  }

  function membershipJoinCtaHtml(ev) {
    const href = organiserMembershipJoinHref(ev);
    const plan = ev && ev.organiserMembershipPlan;
    const freeOnly =
      plan &&
      plan.offered &&
      !(Number(plan.monthly && plan.monthly.amountPounds) > 0) &&
      !(Number(plan.annual && plan.annual.amountPounds) > 0);
    if (!href) {
      return (
        '<p class="ticket-load-hint">You have used your free visits. Join this group\u2019s membership to keep attending, then book with the email on their member list.</p>'
      );
    }
    return (
      '<div class="ticket-load-hint ticket-load-hint--membership-join">' +
      '<p>' +
      (freeOnly
        ? 'You have used your free visits. Ask the organiser to add you to their member list to keep attending — then book with that email.'
        : 'You have used your free visits. Join this group\u2019s monthly or annual membership to keep attending — then book with your membership email.') +
      '</p>' +
      (freeOnly
        ? ''
        : '<p class="ticket-membership-join-actions"><a class="btn btn-gold" href="' +
          escapeHtml(href) +
          '">Join membership</a></p>') +
      '</div>'
    );
  }

  function hasAlumniInviteLink(ev) {
    return Boolean(String(alumniInviteToken || '').trim() && ev?.alumniFastPassEnabled);
  }

  function alumniInviteBlockedMessage(eligibility) {
    const reason = String(eligibility?.reason || '').trim();
    const messages = {
      not_invited:
        'This previous attendee invite link is invalid or has expired. Use the link from your invite email, or contact the organiser.',
      email_mismatch: 'Sign in with the email address that received the previous attendee invite.',
      not_enabled: 'Previous Attendees is not available for this event.',
      no_alumni_tier: 'The previous attendee ticket is not set up for this event yet.',
    };
    return (
      messages[reason] ||
      'This previous attendee rate is invite-only. Use the link from your email or sign in with the invited address.'
    );
  }

  function tierIsGuestVisit(t) {
    if (!t) return false;
    if (t.isGuestVisit) return true;
    const type = String(t.ticketType || t.ticket_type || '').trim();
    if (/guest-visit/i.test(type)) return true;
    return /^guest\s*visit$/i.test(String(t.name || '').trim());
  }

  function isRosterMemberForEvent() {
    return Boolean(guestVisitEligibility?.isRosterMember || rosterMembership?.isMember);
  }

  function syncGuestVisitStateForRosterMember() {
    const fromGuest = Boolean(guestVisitEligibility?.isRosterMember);
    const fromRoster = Boolean(rosterMembership?.isMember);
    if (!fromGuest && !fromRoster) return;

    if (!rosterMembership) rosterMembership = { isMember: true };
    else rosterMembership.isMember = true;

    if (guestVisitEligibility) {
      guestVisitEligibility.isRosterMember = true;
      guestVisitEligibility.eligible = false;
      guestVisitEligibility.remaining = 0;
      guestVisitEligibility.used = guestVisitEligibility.allowed || 0;
    }
  }

  async function ensureRosterMemberTickets(ev) {
    if (!ev || !ev.hasMembersOnlyTiers || !isRosterMemberForEvent()) return;
    if ((rosterMemberTickets || []).length) return;
    await loadRosterEligibility(ev);
    syncGuestVisitStateForRosterMember();
  }

  function syncTicketPanelSelectionFromDom() {
    if (typeof window.hubTicketPanelResync === 'function') {
      window.hubTicketPanelResync();
    }
  }

  async function refreshGuestProgrammeTicketPanel(ev) {
    if (!ev || !eventIsGuestProgramme(ev)) return;
    await Promise.all([loadGuestVisitEligibility(ev), loadRosterEligibility(ev)]);
    syncGuestVisitStateForRosterMember();
    await ensureRosterMemberTickets(ev);
    renderTicketPanel(ev);
    setText('ev-price', publicListingPriceLabel(ev));
    syncTicketHeader(ev);
    applyTicketPanelState(ev);
    syncTicketPanelSelectionFromDom();
  }

  async function loadGuestVisitEligibility(ev) {
    if (!eventAllowsGuestPasses(ev)) {
      guestVisitEligibility = { allowed: 0, used: 0, remaining: 0, eligible: false };
      return guestVisitEligibility;
    }
    try {
      const res = await fetch(
        '/api/auth/guest-visit-eligibility?eventId=' + encodeURIComponent(ev.id),
        { credentials: 'include', cache: 'no-store' }
      );
      const data = await res.json().catch(function () {
        return {};
      });
      if (data.ok && data.eligibility) {
        guestVisitEligibility = data.eligibility;
        if (data.viewerEmail) {
          guestVisitEligibility.viewerEmail = data.viewerEmail;
        }
      } else if (res.status === 401) {
        guestVisitEligibility = {
          allowed: ev.complimentaryVisitsAllowed,
          used: 0,
          remaining: ev.complimentaryVisitsAllowed,
          eligible: false,
          signedOut: true,
        };
      } else {
        guestVisitEligibility = { allowed: 0, used: 0, remaining: 0, eligible: false };
      }
    } catch {
      guestVisitEligibility = null;
    }
    const organiserId = String((ev && ev.organiserId) || '').trim();
    if (organiserId && guestVisitEligibility) {
      guestVisitEligibilityByOrganiser[organiserId] = guestVisitEligibility;
    }
    return guestVisitEligibility;
  }

  async function loadRosterEligibility(ev) {
    rosterMemberTickets = [];
    rosterMembership = null;
    const organiserId = String((ev && ev.organiserId) || '').trim();
    if (!organiserId && !(ev && ev.id)) return rosterMembership;
    try {
      const res = await fetch(
        '/api/auth/roster-eligibility?eventId=' + encodeURIComponent(ev.id),
        { credentials: 'include', cache: 'no-store' }
      );
      const data = await res.json().catch(function () {
        return {};
      });
      if (data.ok) {
        rosterMembership = {
          isMember: Boolean(data.isMember),
          signedOut: res.status === 401,
        };
        if (data.isMember && Array.isArray(data.memberTickets)) {
          rosterMemberTickets = data.memberTickets.map(function (t) {
            return Object.assign({}, t, { isMembersOnly: true });
          });
        }
      } else if (res.status === 401) {
        rosterMembership = { isMember: false, signedOut: true };
      }
    } catch {
      rosterMembership = null;
    }
    return rosterMembership;
  }

  async function refreshGuestVisitLabelsForEvents(list) {
    const organiserIds = [];
    const seen = {};
    (list || []).forEach(function (ev) {
      if (!ev || ev.guestPassesDisabled) return;
      if (!(Number(ev.complimentaryVisitsAllowed) > 0)) return;
      const mode = String(ev.attendanceMode || '');
      if (mode !== 'guest_programme' && !ev.guestVisitTier) return;
      const organiserId = String(ev.organiserId || '').trim();
      if (!organiserId || seen[organiserId]) return;
      if (guestVisitEligibilityByOrganiser[organiserId]) return;
      seen[organiserId] = true;
      organiserIds.push(organiserId);
    });
    if (!organiserIds.length) {
      applyRelatedGuestVisitPriceLabels();
      return;
    }
    try {
      const sessionData = await fetchSessionData();
      if (!sessionData || !sessionData.ok || !sessionData.user) return;
      const res = await fetch(
        '/api/auth/guest-visit-eligibility?organiserIds=' +
          encodeURIComponent(organiserIds.join(',')),
        { credentials: 'include', cache: 'no-store' }
      );
      const data = await res.json().catch(function () {
        return {};
      });
      if (!data || !data.ok || !data.byOrganiserId) return;
      Object.keys(data.byOrganiserId).forEach(function (organiserId) {
        guestVisitEligibilityByOrganiser[organiserId] = data.byOrganiserId[organiserId];
      });
      applyRelatedGuestVisitPriceLabels();
      if (currentEvent) {
        setText('ev-price', publicListingPriceLabel(currentEvent));
        syncTicketHeader(currentEvent);
      }
    } catch {
      /* non-fatal */
    }
  }

  function applyRelatedGuestVisitPriceLabels() {
    document.querySelectorAll('.related-card .mini-price[data-organiser-id]').forEach(function (el) {
      const organiserId = String(el.getAttribute('data-organiser-id') || '').trim();
      const attendanceMode = String(el.getAttribute('data-attendance-mode') || '').trim();
      if (attendanceMode !== 'guest_programme' || !organiserId) return;
      const allowed = Number(el.getAttribute('data-visits-allowed') || 0) || 0;
      const stub = {
        attendanceMode: 'guest_programme',
        complimentaryVisitsAllowed: allowed,
        guestPassesDisabled: false,
        organiserId: organiserId,
        priceKey: el.getAttribute('data-price-key') || '',
        priceNum: Number(el.getAttribute('data-price-num') || 0) || 0,
        price: el.getAttribute('data-price-raw') || '',
      };
      el.textContent = publicListingPriceLabel(stub);
    });
  }

  function tierIsAlumni(t) {
    if (!t) return false;
    if (t.isAlumni) return true;
    const type = String(t.ticketType || t.ticket_type || '').trim();
    if (type === 'Alumni') return true;
    return /^alumni/i.test(String(t.name || '').trim());
  }

  async function loadAlumniEligibility(ev) {
    if (!ev?.alumniFastPassEnabled) {
      alumniEligibility = { eligible: false };
      return alumniEligibility;
    }
    const token = String(alumniInviteToken || '').trim();
    try {
      const qs =
        'eventId=' +
        encodeURIComponent(ev.id) +
        (token ? '&token=' + encodeURIComponent(token) : '');
      const res = await fetch('/api/auth/alumni-eligibility?' + qs, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (data.ok) {
        alumniEligibility = {
          eligible: Boolean(data.eligible),
          reason: data.reason || '',
          inviteToken: data.inviteToken || token || '',
          alumniTierId: data.alumniTierId || null,
          signedOut: !token && res.status === 200 && data.reason === 'not_authenticated',
        };
      } else if (res.status === 401) {
        alumniEligibility = {
          eligible: false,
          signedOut: true,
          inviteToken: token || '',
        };
      } else {
        alumniEligibility = { eligible: false, reason: data.reason || '' };
      }
    } catch {
      alumniEligibility = null;
    }
    return alumniEligibility;
  }

  function alumniTierCardHtml(t, eligibility, soldOut) {
    const priceNum = t.priceKey === 'free' ? 0 : Number(t.priceNum) || 0;
    const priceDisplay = priceNum > 0 ? t.price || fmt(priceNum) : 'Free';
    let html =
      '<div class="alumni-tier-card' +
      (soldOut ? ' is-sold-out' : '') +
      '">' +
      '<div class="alumni-tier-badge"><span aria-hidden="true">🎓</span> Previous Attendees</div>';
    if (eligibility?.signedOut) {
      html +=
        '<p class="alumni-tier-lead">Sign in with the email that received your invite to claim your previous attendee rate.</p>';
    } else {
      html +=
        '<p class="alumni-tier-lead">Exclusive rate for past attendees — invite only.</p>';
    }
    html +=
      '<div class="alumni-tier-price-row">' +
      '<span class="alumni-tier-price-label">Your rate</span>' +
      '<span class="alumni-tier-price">' +
      escapeHtml(priceDisplay) +
      '</span></div></div>';
    return html;
  }

  function guestVisitTierCardHtml(t, eligibility, soldOut, opts) {
    const remaining = eligibility?.remaining || 0;
    const isCategory = Boolean(opts && opts.isCategoryExclusivity);
    const isMembershipMeeting = Boolean(opts && opts.isMembershipMeeting);
    let html =
      '<div class="guest-visit-tier-card' +
      (soldOut ? ' is-sold-out' : '') +
      '">' +
      '<div class="guest-visit-tier-badge"><span aria-hidden="true">🎫</span> Free visit</div>';
    if (eligibility?.signedOut) {
      html +=
        '<p class="guest-visit-tier-lead">Sign in to check how many trial visits you have left with this organiser.</p>';
    } else if (remaining > 0) {
      html +=
        '<p class="guest-visit-tier-lead">Try this group before you commit — ' +
        escapeHtml(remaining === 1 ? '1 free visit' : remaining + ' free visits') +
        ' remaining with this organiser.</p>';
    }
    html +=
      '<p class="guest-visit-tier-meta">' +
      (isMembershipMeeting
        ? 'After your free visits, join this group\u2019s membership to keep attending.'
        : isCategory
          ? 'No application needed for a free visit. Or apply below for a full Category Exclusivity place.'
          : 'Paid tickets unlock after you use your free visits.') +
      '</p>' +
      '<div class="guest-visit-tier-price-row">' +
      '<span class="guest-visit-tier-price-label">Today</span>' +
      '<span class="guest-visit-tier-price">Free</span></div></div>';
    return html;
  }

  function formatCategoryExclusivityCloseDate(iso) {
    if (!iso) return '';
    if (window.HubEventTimezone && typeof window.HubEventTimezone.formatDateTimeLong === 'function') {
      const formatted = window.HubEventTimezone.formatDateTimeLong(iso);
      return formatted === '\u2014' ? '' : formatted;
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const date = d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Europe/London',
    });
    const time = d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/London',
    });
    return date + ' at ' + time;
  }

  function categoryExclusivityTierCardHtml(t, soldOut) {
    const priceNum = t.priceKey === 'free' ? 0 : Number(t.priceNum) || 0;
    const priceDisplay = priceNum > 0 ? t.price || fmt(priceNum) : 'Free';
    const remainingLabel = soldOut ? '' : tierRemainingLabel(t);
    const closeDate = t.saleEnd ? formatCategoryExclusivityCloseDate(t.saleEnd) : '';
    const bookStep =
      priceNum > 0
        ? '<li><strong>3. Pay</strong><span>Approved applicants receive a payment link</span></li>'
        : '<li><strong>3. Attend</strong><span>Your place is confirmed — no ticket to buy</span></li>';
    let html =
      '<div class="category-exclusivity-tier-card' +
      (soldOut ? ' is-sold-out' : '') +
      '">' +
      '<div class="category-exclusivity-tier-badge"><span aria-hidden="true">🪑</span> Category Exclusivity</div>' +
      (soldOut
        ? '<p class="category-exclusivity-tier-lead">Applications are no longer being accepted for this event.</p>'
        : '<p class="category-exclusivity-tier-lead">Apply to attend — the host reviews your industry and job title before approving your seat.</p>');
    if (!soldOut) {
      html +=
        '<ol class="category-exclusivity-tier-steps">' +
        '<li><strong>1. Apply</strong><span>Answer two quick questions about you</span></li>' +
        '<li><strong>2. Review</strong><span>The organiser approves or declines</span></li>' +
        bookStep +
        '</ol>';
    }
    if (remainingLabel) {
      html += '<p class="category-exclusivity-tier-meta">' + escapeHtml(remainingLabel) + '</p>';
    }
    if (closeDate && !soldOut) {
      html += '<p class="category-exclusivity-tier-meta">Applications close ' + escapeHtml(closeDate) + '</p>';
    }
    if (!soldOut) {
      html +=
        '<div class="category-exclusivity-tier-price-row">' +
        '<span class="category-exclusivity-tier-price-label">' +
        (priceNum > 0 ? 'If approved' : 'Ticket charge') +
        '</span>' +
        '<span class="category-exclusivity-tier-price">' +
        escapeHtml(priceDisplay) +
        '</span></div>';
    }
    html += '</div>';
    return html;
  }

  function eventHasMembersOnlyTickets(ev) {
    if (!ev || !ev.hasMembersOnlyTiers) return false;
    if ((rosterMemberTickets || []).some(function (t) {
      return t.isMembersOnly;
    })) {
      return true;
    }
    return ticketTiersForEvent(ev).some(function (t) {
      return t.isMembersOnly;
    });
  }

  function memberTicketPriceLabel(ev) {
    if (!ev || ev.priceKey === 'free' || /^free$/i.test(String(ev.price || ''))) return 'Free';
    if (window.HubBookingFees && typeof window.HubBookingFees.listingPriceNum === 'function') {
      const total = window.HubBookingFees.listingPriceNum(ev);
      if (total <= 0) return 'Free';
      return window.HubBookingFees.formatPounds
        ? window.HubBookingFees.formatPounds(total)
        : fmt(total);
    }
    // Avoid listingPriceLabel here — for guest programmes it already appends trial-visit copy.
    const display = String(ev.price || '').trim();
    return display || '—';
  }

  function syncTicketHeader(ev) {
    const labelEl = document.getElementById('ev-ticket-from-label');
    const priceEl = document.getElementById('ev-ticket-from-price');
    if (!labelEl || !priceEl || !ev) return;
    if (eventIsGuestProgramme(ev)) {
      const showGuestHeader =
        eventAllowsGuestPasses(ev) &&
        guestVisitEligibility &&
        !isRosterMemberForEvent() &&
        (guestVisitEligibility.eligible || guestVisitEligibility.signedOut);
      if (showGuestHeader) {
        const remaining = Number(guestVisitEligibility.remaining) || 0;
        labelEl.textContent = 'Free visit';
        priceEl.textContent = 'Free';
        if (guestVisitEligibility.signedOut) {
          labelEl.textContent = 'Free visit available';
        } else if (remaining > 1) {
          labelEl.textContent =
            remaining + ' free visits left';
        }
        return;
      }
      if (isRosterMemberForEvent()) {
        const memberOnly = (rosterMemberTickets || []).find(function (t) {
          return t.isMembersOnly;
        });
        labelEl.textContent = 'Member ticket';
        if (memberOnly) {
          priceEl.textContent =
            memberOnly.priceKey === 'free' ? 'Free' : memberOnly.price || memberTicketPriceLabel(ev);
        } else {
          priceEl.textContent = memberTicketPriceLabel(ev);
        }
        return;
      }
      labelEl.textContent = 'Tickets from';
      priceEl.textContent = memberTicketPriceLabel(ev);
      return;
    }
    if (eventIsCategoryExclusivity(ev)) {
      if (isRosterMemberForEvent()) {
        const memberOnly = (rosterMemberTickets || []).find(function (t) {
          return t.isMembersOnly;
        });
        labelEl.textContent = 'Member ticket';
        if (memberOnly) {
          priceEl.textContent =
            memberOnly.priceKey === 'free' ? 'Free' : memberOnly.price || memberTicketPriceLabel(ev);
        } else {
          const priceNum = ev.priceKey === 'free' ? 0 : Number(ev.priceNum) || 0;
          priceEl.textContent =
            priceNum > 0 ? publicListingPriceLabel(ev, { withFrom: false }) : 'Free';
        }
        return;
      }
      labelEl.textContent = 'Price if approved';
      const priceNum = ev.priceKey === 'free' ? 0 : Number(ev.priceNum) || 0;
      priceEl.textContent =
        priceNum > 0 ? publicListingPriceLabel(ev, { withFrom: false }) : 'Free';
      return;
    }
    if (ev.isMembersOnlyEvent) {
      if (isRosterMemberForEvent()) {
        const memberOnly = (rosterMemberTickets || []).find(function (t) {
          return t.isMembersOnly;
        });
        labelEl.textContent = 'Member booking';
        if (memberOnly) {
          priceEl.textContent =
            memberOnly.priceKey === 'free' || !(Number(memberOnly.priceNum) > 0)
              ? 'Free'
              : memberOnly.price || memberTicketPriceLabel(ev);
        } else {
          priceEl.textContent =
            ev.priceKey === 'free' || ev.priceKey === 'members_only'
              ? 'Free'
              : memberTicketPriceLabel(ev);
        }
        return;
      }
      labelEl.textContent = 'Members only';
      priceEl.textContent = 'Sign in';
      return;
    }
    if (ev.hasMembersOnlyTiers && isRosterMemberForEvent()) {
      const memberOnly = (rosterMemberTickets || []).find(function (t) {
        return t.isMembersOnly;
      });
      labelEl.textContent = 'Member booking';
      if (memberOnly) {
        priceEl.textContent =
          memberOnly.priceKey === 'free' || !(Number(memberOnly.priceNum) > 0)
            ? 'Free'
            : memberOnly.price || memberTicketPriceLabel(ev);
      } else {
        priceEl.textContent =
          ev.priceKey === 'free' ? 'Free' : memberTicketPriceLabel(ev);
      }
      return;
    }
    labelEl.textContent = 'Tickets from';
    priceEl.textContent =
      ev.priceKey === 'free' ? 'Free' : publicListingPriceLabel(ev, { withFrom: false });
  }

  function normalizeEventFlags(ev, params) {
    const p = params || new URLSearchParams(window.location.search);
    const approvalFromTickets = (ev.tickets || []).some(tierIsApplication);
    const past =
      parseBoolFlag(ev.isEventPast) ||
      (window.HubEventTimezone && typeof window.HubEventTimezone.isEventPast === 'function'
        ? window.HubEventTimezone.isEventPast(ev)
        : false);
    return {
      ...ev,
      isApprovalRequired:
        parseBoolFlag(ev.isApprovalRequired) ||
        approvalFromTickets ||
        p.get('approval') === '1' ||
        p.get('isApprovalRequired') === '1',
      isSoldOut: parseBoolFlag(ev.isSoldOut) || p.get('sold_out') === '1' || p.get('isSoldOut') === '1',
      isEventPast: past,
      isSalesClosed:
        parseBoolFlag(ev.isSalesClosed) ||
        p.get('sales_closed') === '1' ||
        p.get('isSalesClosed') === '1',
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

  const SERIES_LOCATION_KEYS = [
    'venue',
    'venueName',
    'venueAddress',
    'address',
    'city',
    'postcode',
    'location',
    'locationShort',
    'outcode',
    'lat',
    'lng',
  ];

  function locationScore(ev) {
    if (!ev) return 0;
    let score = 0;
    const lat = ev.lat != null ? Number(ev.lat) : null;
    const lng = ev.lng != null ? Number(ev.lng) : null;
    if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) score += 4;
    if (String(ev.postcode || '').trim()) score += 2;
    if (String(ev.address || '').trim()) score += 1;
    if (String(ev.city || '').trim()) score += 1;
    return score;
  }

  function pickBestLocationSource(sources) {
    let best = null;
    let bestScore = 0;
    (sources || []).forEach(function (ev) {
      const score = locationScore(ev);
      if (score > bestScore) {
        bestScore = score;
        best = ev;
      }
    });
    return best;
  }

  function copyLocationFields(from) {
    const out = {};
    if (!from) return out;
    SERIES_LOCATION_KEYS.forEach(function (key) {
      const val = from[key];
      if (val != null && val !== '') out[key] = val;
    });
    return out;
  }

  function enrichEventWithSeriesLocation(ev) {
    const locationSource = pickBestLocationSource([ev].concat(seriesDatesList || []));
    if (!locationSource || locationScore(ev) >= locationScore(locationSource)) return ev;
    return Object.assign({}, ev, copyLocationFields(locationSource));
  }

  function isOnlineOnlyEvent(ev) {
    const m = String((ev && (ev.format || ev.meetingType || ev.meeting_type)) || '').toLowerCase();
    return m.includes('online') && !m.includes('person');
  }

  function applyLocationBlock(ev) {
    const online = isOnlineOnlyEvent(ev);
    const cityLabel = online
      ? 'Online'
      : ev.city || ev.outcode || ev.locationShort || 'Location TBC';
    setText('ev-meta-city', cityLabel);

    const section = document.getElementById('ev-location-section');
    if (section) section.hidden = online;
    const regionCta = document.getElementById('ev-region-cta');
    if (online) {
      if (regionCta) regionCta.hidden = true;
      return;
    }

    const vn = String(ev.venue || ev.venueName || '').trim();
    const va = [ev.address, ev.city, ev.postcode].filter(Boolean).join(', ') || ev.venueAddress || '';
    setText('ev-venue-name', vn || 'Venue TBC');
    setText('ev-venue-addr', va);
    applyMapAndDirections(ev);

    if (window.HUB_applyDetailRegionCta) {
      window.HUB_applyDetailRegionCta(document.getElementById('ev-region-cta'), {
        context: 'events',
        locationTexts: [ev.postcode, ev.city, ev.outcode, ev.location, ev.locationShort, ev.address],
      });
    }
  }

  function organiserProfileHref(ev) {
    const slug = String(ev.organiserSlug || ev.organiser_slug || '').trim();
    if (slug) return '/organisers/' + encodeURIComponent(slug);
    const id = String(ev.organiserId || ev.organiser_id || '').trim();
    if (id) return '/events/organiser?id=' + encodeURIComponent(id);
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

    const avatar = document.getElementById('ev-host-avatar');
    const logo = ev.organiserLogo || '';
    const { logoEl, initialsEl } = ensureHostAvatarStructure(avatar);

    if (logoEl && initialsEl && avatar) {
      if (logo && isSafeImgSrc(logo)) {
        logoEl.onload = function () {
          logoEl.hidden = false;
          initialsEl.hidden = true;
          avatar.classList.add('has-logo');
        };
        logoEl.onerror = function () {
          showHostInitials(avatar, logoEl, initialsEl, host);
        };
        logoEl.alt = host + ' logo';
        logoEl.src = logo;
        /* Keep initials visible until load succeeds so the circle is never blank */
        initialsEl.hidden = false;
        initialsEl.textContent = hostInitials(host);
      } else {
        showHostInitials(avatar, logoEl, initialsEl, host);
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
          'The organiser is completing their organiser page. Check back soon for host details.';
      }
    }

    const profileLink = document.getElementById('ev-host-profile-link');
    if (profileLink) {
      const href = organiserProfileHref(ev);
      if (href) {
        profileLink.href = href;
        profileLink.hidden = false;
        if (!profileLink.dataset.organiserPrefetchBound) {
          profileLink.dataset.organiserPrefetchBound = '1';
          profileLink.addEventListener(
            'mouseenter',
            function prefetchOrganiserPage() {
              if (profileLink.dataset.prefetched) return;
              profileLink.dataset.prefetched = '1';
              const link = document.createElement('link');
              link.rel = 'prefetch';
              link.as = 'document';
              link.href = href;
              document.head.appendChild(link);
            },
            { once: true, passive: true }
          );
        }
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
    const { reviews: reviewCount, rating } = hostReviewStats(ev);
    if (metaWrap && ratingMeta && reviewCount > 0 && rating > 0) {
      ratingMeta.innerHTML =
        '<span class="ev-host-stars" aria-hidden="true">' +
        starsForRating(rating) +
        '</span> <strong>' +
        rating.toFixed(1) +
        '</strong> · ' +
        reviewCount +
        ' review' +
        (reviewCount === 1 ? '' : 's');
      metaWrap.hidden = false;
    } else if (metaWrap && ratingMeta) {
      ratingMeta.textContent = 'New on the Hub — be among the first to review after you attend.';
      metaWrap.hidden = false;
    } else if (metaWrap) metaWrap.hidden = true;
  }

  function hostReviewStats(ev) {
    const orgReviews = Number(ev && ev.organiserReviews) || 0;
    const orgRating = Number(ev && ev.organiserRating) || 0;
    const eventReviews = Number(ev && ev.reviews) || 0;
    const eventRating = Number(ev && ev.rating) || 0;
    if (orgReviews > 0 && orgRating > 0) {
      return { rating: orgRating, reviews: orgReviews };
    }
    if (eventReviews > 0 && eventRating > 0) {
      return { rating: eventRating, reviews: eventReviews };
    }
    return {
      rating: orgRating || eventRating || 0,
      reviews: orgReviews || eventReviews || 0,
    };
  }

  function starsForRating(rating) {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    const full = Math.round(r);
    return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
  }

  function mapEmbedSrc(ev, q) {
    const lat = ev && ev.lat != null ? Number(ev.lat) : null;
    const lng = ev && ev.lng != null ? Number(ev.lng) : null;
    if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      const pad = 0.012;
      return (
        'https://www.openstreetmap.org/export/embed.html?bbox=' +
        [lng - pad, lat - pad, lng + pad, lat + pad].join(',') +
        '&layer=mapnik&marker=' +
        lat +
        ',' +
        lng
      );
    }
    if (!q) return '';
    return 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&z=15&output=embed';
  }

  function applyMapAndDirections(ev) {
    const online = isOnlineOnlyEvent(ev);
    const q = online ? '' : venueQuery(ev);
    const dir = document.getElementById('ev-directions');
    if (dir) {
      if (q) {
        dir.href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(q);
      } else if (online) {
        dir.removeAttribute('href');
        dir.hidden = true;
      }
    }

    const iframe = document.getElementById('ev-map-iframe');
    const mapWrap = iframe ? iframe.closest('.map-embed') : null;
    if (iframe) {
      const src = online ? '' : mapEmbedSrc(ev, q);
      if (src) {
        iframe.src = src;
        iframe.hidden = false;
        if (mapWrap) mapWrap.hidden = false;
      } else {
        iframe.removeAttribute('src');
        iframe.hidden = true;
        if (mapWrap) mapWrap.hidden = online;
      }
    }
  }

  function eventDetailHref(ev) {
    if (window.HubPublicUrls && typeof window.HubPublicUrls.eventDetailHref === 'function') {
      return window.HubPublicUrls.eventDetailHref(ev);
    }
    const slug = publicSlug(ev);
    if (slug) return '/events/' + encodeURIComponent(slug);
    /* Use .html so /events/:slug rewrite does not treat "event" as a slug. */
    if (ev && ev.id) return '/events/event.html?id=' + encodeURIComponent(ev.id);
    return '/events/';
  }

  function renderRelated(related, options) {
    const grid = document.getElementById('ev-related-grid');
    const empty = document.getElementById('ev-related-empty');
    const section = document.getElementById('ev-related-section');
    if (!grid) return;

    grid.innerHTML = '';
    const list = (related || []).filter((e) => e && e.id);
    const hasSeriesDates = Boolean(options && options.hasSeriesDates);
    const sourceEv = (options && options.event) || currentEvent || {};

    if (!list.length) {
      if (empty) {
        empty.hidden = false;
        const orgHref = organiserProfileHref(sourceEv);
        const orgName = String(sourceEv.organiser || '').trim();
        const parts = [];
        if (hasSeriesDates) {
          parts.push(
            '<p class="related-empty-lead">Other dates for this event are in <button type="button" class="related-empty-link" id="ev-related-jump-dates">Choose a date</button> above.</p>'
          );
        } else {
          parts.push(
            '<p class="related-empty-lead">No other upcoming events from this organiser yet.</p>'
          );
        }
        if (orgHref) {
          parts.push(
            '<p class="related-empty-cta"><a class="related-empty-org-link" href="' +
              escapeHtml(orgHref) +
              '">View ' +
              escapeHtml(orgName || 'organiser') +
              ' page →</a></p>'
          );
        }
        empty.innerHTML = parts.join('');
        const jumpBtn = document.getElementById('ev-related-jump-dates');
        if (jumpBtn) {
          jumpBtn.addEventListener('click', function () {
            const wrap = document.getElementById('ev-series-dates');
            if (wrap) {
              wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setSeriesDatePickerOpen(true);
            }
          });
        }
      }
      if (section) section.classList.add('is-empty-related');
      return;
    }

    if (empty) {
      empty.hidden = true;
      empty.textContent = '';
    }
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
      price.setAttribute('data-organiser-id', String(ev.organiserId || ''));
      price.setAttribute('data-attendance-mode', String(ev.attendanceMode || ''));
      price.setAttribute(
        'data-visits-allowed',
        String(Number(ev.complimentaryVisitsAllowed) || 0)
      );
      price.setAttribute('data-price-key', String(ev.priceKey || ''));
      price.setAttribute('data-price-num', String(Number(ev.priceNum) || 0));
      price.setAttribute('data-price-raw', String(ev.price || ''));
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
    refreshGuestVisitLabelsForEvents(list);
  }

  function updateBreadcrumbTrail(ev) {
    const mid = String(ev.typeRaw || ev.typeCategory || ev.eventType || '').trim();
    const catEl = document.getElementById('ev-trail-category');
    if (!catEl) return;
    const sepBefore = catEl.previousElementSibling;
    const sepAfter = document.getElementById('ev-trail-sep-after') || catEl.nextElementSibling;
    if (mid) {
      catEl.textContent = mid;
      catEl.href = '/events/';
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
    const fallback =
      'Join us for ' + ev.title + '. Full details will be shared with ticket holders.';

    if (lead) {
      const fmt = window.HubPlainTextFormat;
      if (fmt && typeof fmt.formatDocument === 'function') {
        lead.innerHTML = fmt.formatDocument(desc || fallback);
      } else if (desc) {
        lead.textContent = desc;
      } else {
        lead.textContent = fallback;
      }
    }
    if (extra) {
      extra.hidden = true;
      extra.innerHTML = '';
    }

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
    const { reviews: reviewCount, rating } = hostReviewStats(ev);

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
      'Host rating ' + rating.toFixed(1) + ' out of 5 from ' + reviewCount + ' reviews'
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
    const locationSource = pickBestLocationSource([entry, baseEv].concat(seriesDatesList || []));
    return Object.assign({}, baseEv, entry, copyLocationFields(locationSource), {
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
    const timeLabel =
      window.HubEventTimezone && typeof window.HubEventTimezone.formatTimeRange === 'function'
        ? window.HubEventTimezone.formatTimeRange(
            ev.dateFieldRaw || ev.dateRaw,
            ev.endDateRaw
          ) || ev.time
        : ev.time;
    if (timeLabel) {
      setText('ev-meta-time', timeLabel);
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
      '. Pick one date, or tick Book all dates below to checkout for every remaining session at once.';
  }

  function normalizeTierName(name) {
    return String(name || '')
      .trim()
      .toLowerCase();
  }

  function tierPriceNum(tier) {
    if (!tier) return 0;
    if (tier.priceKey === 'free') return 0;
    return Number(tier.priceNum) || 0;
  }

  function findSeriesTierMatch(entry, tierName, unitPrice) {
    const tickets = entry && entry.tickets ? entry.tickets : [];
    return tickets.find(function (t) {
      if (t.isGuestVisit || t.isAlumni || t.isMembersOnly || t.categoryExclusivity) return false;
      if (Boolean(t.soldOut)) return false;
      return normalizeTierName(t.name) === tierName && tierPriceNum(t) === unitPrice;
    });
  }

  function seriesBundleOffer(ev, tierEl) {
    if (!seriesDatesList || seriesDatesList.length <= 1 || !tierEl || !ev) return null;
    if (tierEl.getAttribute('data-series-pass') === '1') return null;
    if (eventIsCategoryExclusivity(ev) || eventIsGuestProgramme(ev)) return null;
    if (tierEl.getAttribute('data-guest-visit') === '1' || tierEl.getAttribute('data-alumni') === '1') {
      return null;
    }
    const unitPrice = parseFloat(tierEl.getAttribute('data-price')) || 0;
    const tierName = normalizeTierName(
      tierEl.getAttribute('data-tier-name') || tierEl.getAttribute('data-label') || ''
    );
    if (!tierName) return null;

    const matches = seriesDatesList.filter(function (entry) {
      if (!seriesEntryIsBookable(entry)) return false;
      if (entry.isSoldOut || entry.isSalesClosed) return false;
      return Boolean(findSeriesTierMatch(entry, tierName, unitPrice));
    });
    if (matches.length < 2) return null;

    return {
      dateCount: matches.length,
      unitPrice: unitPrice,
      tierName: tierName,
    };
  }

  function updateSeriesBundleOption(ev) {
    const wrap = document.getElementById('ev-series-bundle-option');
    const check = document.getElementById('ev-series-bundle-check');
    const label = document.getElementById('ev-series-bundle-label');
    const hint = document.getElementById('ev-series-bundle-hint');
    const tierEl = getSelectedTierEl();
    const offer = seriesBundleOffer(ev || activeEvent(), tierEl);
    if (!wrap || !check) return null;

    if (!offer) {
      wrap.hidden = true;
      check.checked = false;
      return null;
    }

    wrap.hidden = false;
    const priceLabel =
      offer.unitPrice <= 0 ? 'free' : fmt(offer.unitPrice);
    if (label) {
      label.textContent = 'Book all ' + offer.dateCount + ' remaining dates';
    }
    if (hint) {
      hint.textContent =
        'One checkout — ' +
        offer.dateCount +
        ' × ' +
        priceLabel +
        ' (same ticket type on every date).';
    }
    return offer;
  }

  function seriesPassOffer(ev, tierEl) {
    if (!seriesDatesList || seriesDatesList.length <= 1 || !tierEl || !ev) return null;
    if (tierEl.getAttribute('data-series-pass') !== '1') return null;
    if (eventIsCategoryExclusivity(ev) || eventIsGuestProgramme(ev)) return null;
    const matches = seriesDatesList.filter(function (entry) {
      if (!seriesEntryIsBookable(entry)) return false;
      if (entry.isSoldOut || entry.isSalesClosed) return false;
      return Boolean(findSeriesTierMatch(entry, normalizeTierName(tierEl.getAttribute('data-tier-name') || tierEl.getAttribute('data-label') || ''), parseFloat(tierEl.getAttribute('data-price')) || 0));
    });
    if (matches.length < 2) return null;
    return { dateCount: matches.length };
  }

  function isSeriesBundleCheckoutSelected() {
    const check = document.getElementById('ev-series-bundle-check');
    return Boolean(check && check.checked && !check.closest('[hidden]'));
  }

  function isSeriesPassCheckoutSelected() {
    const tierEl = getSelectedTierEl();
    return Boolean(tierEl && tierEl.getAttribute('data-series-pass') === '1');
  }

  function seriesCheckoutOptions() {
    const bookSeriesPass = isSeriesPassCheckoutSelected();
    const bookSeriesBundle = !bookSeriesPass && isSeriesBundleCheckoutSelected();
    const tierEl = getSelectedTierEl();
    const ev = activeEvent();
    let seriesDateCount = null;
    if (bookSeriesPass && tierEl) {
      const offer = seriesPassOffer(ev, tierEl);
      seriesDateCount = offer ? offer.dateCount : seriesDatesList.length;
    } else if (bookSeriesBundle && tierEl) {
      const offer = seriesBundleOffer(ev, tierEl);
      seriesDateCount = offer ? offer.dateCount : null;
    }
    return {
      bookSeriesPass: bookSeriesPass,
      bookSeriesBundle: bookSeriesBundle,
      seriesDateCount: seriesDateCount,
    };
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
        if (!seriesEntryIsBookable(entry)) {
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

  function setSeriesDatePickerOpen(open) {
    const picker = document.getElementById('ev-series-picker');
    const collapsed = document.getElementById('ev-series-collapsed');
    if (picker) picker.hidden = !open;
    if (collapsed) collapsed.hidden = open;
  }

  function seriesEntryIsBookable(entry) {
    if (!entry || entry.isSoldOut) return false;
    if (
      window.HubEventTimezone &&
      typeof window.HubEventTimezone.isEventPast === 'function' &&
      window.HubEventTimezone.isEventPast(entry)
    ) {
      return false;
    }
    const ts =
      entry.dateTs != null
        ? Number(entry.dateTs)
        : entry.dateRaw
          ? new Date(entry.dateRaw).getTime()
          : 0;
    return !ts || ts >= Date.now() - 86400000;
  }

  function seriesHasOtherBookableDates(currentEventId) {
    if (!seriesDatesList || seriesDatesList.length <= 1) return false;
    return seriesDatesList.some(function (entry) {
      if (!entry || !entry.id || entry.id === currentEventId) return false;
      return seriesEntryIsBookable(entry);
    });
  }

  function openSeriesDatePickerForAnotherDate() {
    const wrap = document.getElementById('ev-series-dates');
    if (!wrap) return;
    if (seriesDatesList.length > 1) wrap.hidden = false;
    if (wrap.hidden) return;
    setSeriesDatePickerOpen(true);
    try {
      wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch {
      /* ignore */
    }
    const calendar = document.getElementById('ev-date-calendar');
    if (calendar && typeof calendar.focus === 'function') {
      try {
        calendar.focus({ preventScroll: true });
      } catch {
        calendar.focus();
      }
    }
  }

  function bindAlreadyGoingActions() {
    const anotherBtn = document.getElementById('category-exclusivity-application-status-another-date');
    if (!anotherBtn || anotherBtn.dataset.bound === '1') return;
    anotherBtn.dataset.bound = '1';
    anotherBtn.addEventListener('click', openSeriesDatePickerForAnotherDate);
  }

  function selectSeriesDate(entry) {
    if (!entry || !seriesBaseEvent) return;
    selectedSeriesEventId = entry.id;
    const merged = mergeSeriesDateEntry(seriesBaseEvent, entry);
    currentEvent = merged;
    updateEventDateMeta(merged);
    applyLocationBlock(merged);
    const selectedEl = document.getElementById('ev-series-selected');
    if (selectedEl) selectedEl.textContent = 'Selected: ' + formatSeriesSelectedLine(entry);
    renderSeriesCalendar();
    setSeriesDatePickerOpen(false);
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
    const upcoming = seriesDatesList.find(function (item) {
      return seriesEntryIsBookable(item);
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
      document.getElementById('ev-series-change-btn')?.addEventListener('click', () => {
        setSeriesDatePickerOpen(true);
      });
    }

    selectedSeriesEventId = initialEv.id;
    renderSeriesCalendar();
    const selectedEl = document.getElementById('ev-series-selected');
    if (selectedEl && initialEntry) {
      selectedEl.textContent = 'Selected: ' + formatSeriesSelectedLine(initialEntry);
    }
    setSeriesDatePickerOpen(false);
  }

  function applyEndedEventBanner(ev, options) {
    const opts = options || {};
    const banner = document.getElementById('ev-ended-banner');
    const titleEl = document.getElementById('ev-ended-banner-title');
    const textEl = document.getElementById('ev-ended-banner-text');
    const actionsEl = document.getElementById('ev-ended-banner-actions');
    if (!banner) return;

    const ended = Boolean(opts.force || (ev && ev.isEventPast));
    if (!ended) {
      banner.hidden = true;
      return;
    }

    const city = String((ev && (ev.city || ev.outcode)) || '').trim();
    const orgName = String((ev && ev.organiser) || '').trim();
    const title =
      opts.title ||
      (opts.cancelled ? 'This event was cancelled' : 'This event has ended');
    const text =
      opts.text ||
      (opts.cancelled
        ? 'It is no longer available to book. See upcoming events' +
          (orgName ? ' from ' + orgName : '') +
          (city ? ' or more in ' + city : '') +
          '.'
        : 'Tickets are no longer available. See upcoming events' +
          (orgName ? ' from ' + orgName : '') +
          (city ? ' or more networking in ' + city : '') +
          '.');

    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;

    const links = [];
    const orgHref = organiserProfileHref(ev || {});
    if (orgHref) {
      links.push(
        '<a class="ev-ended-primary" href="' +
          escapeHtml(orgHref) +
          '">View organiser page</a>'
      );
    }
    links.push('<a href="/events/">Browse upcoming events</a>');
    if (actionsEl) actionsEl.innerHTML = links.join('');
    banner.hidden = false;

    if (window.HUB_applyDetailRegionCta && city) {
      const regionCta = document.getElementById('ev-region-cta');
      if (regionCta) {
        window.HUB_applyDetailRegionCta(regionCta, {
          context: 'events',
          locationTexts: [ev.postcode, ev.city, ev.outcode, ev.location],
        });
        if (!regionCta.hidden) {
          const clone = regionCta.cloneNode(true);
          clone.id = '';
          clone.hidden = false;
          clone.classList.add('ev-ended-region-link');
          if (actionsEl) actionsEl.appendChild(clone);
        }
      }
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
    syncTitleTags(ev);

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
      hero.loading = 'eager';
      hero.fetchPriority = 'high';
      hero.decoding = 'async';
      hero.src = resolvedSrc;
      hero.alt = ev.title;
      const ownPhoto = String(ev.photo || '').trim();
      const pos = String(ev.photoPosition || '').trim();
      if (pos && /^\d{1,3}%\s+\d{1,3}%$/.test(pos) && ownPhoto && resolvedSrc === ownPhoto) {
        hero.style.objectPosition = pos;
      } else {
        hero.style.objectPosition = '';
      }
      hero.onerror = function () {
        hero.onerror = null;
        hero.src = fallbackSrc;
        hero.style.objectPosition = '';
      };
    }

    updateEventDateMeta(ev);

    applyLocationBlock(ev);

    renderRatingBlock(ev);
    applyHostBlock(ev);
    renderAboutSection(ev);
    applyEndedEventBanner(ev);

    if (!eventIsGuestProgramme(ev)) {
      renderTicketPanel(ev);
    }
    renderRefundPolicy(ev);
    setText(
      'ev-related-title',
      ev.isEventPast
        ? 'Upcoming from ' + (ev.organiser || 'this organiser')
        : 'More from ' + (ev.organiser || 'this organiser')
    );
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
      if (Number(days) === 2) {
        return 'Full refunds are available up to 48 hours before the event. After that, cancellations are not available from your account.';
      }
      if (days != null) {
        return (
          'Full refunds are available up to ' +
          days +
          ' day' +
          (days === 1 ? '' : 's') +
          ' before the event. After that, cancellations are not available from your account.'
        );
      }
      return 'Full refunds are available before the event.';
    }
    if (policy === 'partial_refund') {
      return ev.refundPolicyDetails || ev.refund_policy_details || 'Partial refunds apply — see organiser terms.';
    }
    if (policy === 'no_refunds') {
      return 'No refund is offered if you change your mind or cannot attend. Your statutory rights still apply if the event is cancelled, materially changed, or not provided as described.';
    }
    if (policy === 'custom') {
      return ev.refundPolicyDetails || ev.refund_policy_details || 'See organiser refund policy.';
    }
    return 'See organiser refund policy.';
  }

  function refundPolicyShortLabel(ev) {
    const policy = ev.refundPolicy || ev.refund_policy || '';
    if (!policy) return 'Not set';
    if (policy === 'full_refund') {
      const days = ev.refundCutoffDays != null ? ev.refundCutoffDays : ev.refund_cutoff_days;
      if (Number(days) === 2 || Number(days) === 1) return 'Flexible refunds';
      if (Number(days) === 7) return 'Standard refunds';
      if (Number(days) === 14 || Number(days) === 3) return 'Strict refunds (B2B)';
      return 'Full refunds available';
    }
    if (policy === 'partial_refund') return 'Partial refunds';
    if (policy === 'no_refunds') return 'Non-refundable';
    if (policy === 'custom') {
      const policyDetails = ev.refundPolicyDetails || ev.refund_policy_details || '';
      if (/^100% refund up to 7 days before/i.test(policyDetails)) return 'Standard refunds';
      return 'Custom policy';
    }
    return 'See policy';
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
      cls = 'is-full';
      const days = ev.refundCutoffDays != null ? ev.refundCutoffDays : ev.refund_cutoff_days;
      if (Number(days) === 2 || Number(days) === 1) label = '✓ Flexible refunds';
      else if (Number(days) === 7) label = '✓ Standard refunds';
      else if (Number(days) === 14 || Number(days) === 3) label = 'Strict refunds (B2B)';
      else label = '✓ Full refunds available';
      detailText = refundPolicyDetailText(ev);
    } else if (policy === 'partial_refund') {
      label = '~ Partial refunds — see policy';
      cls = 'is-partial';
      detailText = ev.refundPolicyDetails || ev.refund_policy_details || 'Partial refunds apply — see organiser terms.';
    } else if (policy === 'no_refunds') {
      label = 'Non-refundable';
      cls = 'is-none';
      detailText =
        'No refund is offered if you change your mind or cannot attend. Your statutory rights still apply if the event is cancelled, materially changed, or not provided as described.';
    } else if (policy === 'custom') {
      const policyDetails = ev.refundPolicyDetails || ev.refund_policy_details || '';
      label = /^100% refund up to 7 days before/i.test(policyDetails)
        ? 'Standard refunds'
        : 'ℹ Refund policy';
      cls = 'is-custom';
      detailText = policyDetails || 'See organiser refund policy below.';
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
  let guestVisitEligibility = null;
  let alumniEligibility = null;
  let alumniInviteToken = '';
  let ceMemberInviteToken = '';
  let rosterMemberTickets = [];
  let rosterMembership = null;
  let eventApplicationState = null;
  let ticketPanelBound = false;

  function clearCheckoutInlineError() {
    const el = document.getElementById('checkout-inline-error');
    if (!el) return;
    el.hidden = true;
    el.textContent = '';
  }

  function revealPaidCheckoutTerms() {
    const paidBlock = document.getElementById('ticket-paid-checkout');
    if (paidBlock) paidBlock.hidden = false;
    paidBlock?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showCheckoutInlineError(message) {
    const el = document.getElementById('checkout-inline-error');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    revealPaidCheckoutTerms();
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

  function saveBookingPending(ev, ticketId, qty, attendee, options) {
    const seriesKey = seriesKeyFromContext();
    const checkoutOpts = options || seriesCheckoutOptions();
    const bookSeriesBundle = Boolean(checkoutOpts.bookSeriesBundle);
    const bookSeriesPass = Boolean(checkoutOpts.bookSeriesPass);
    const seriesDateCount = checkoutOpts.seriesDateCount || null;
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
          eventImagePosition: String(ev.photoPosition || '').trim(),
          ts: Date.now(),
          seriesKey: seriesKey || null,
          seriesTitle: seriesBaseEvent && seriesBaseEvent.title ? seriesBaseEvent.title : ev.title || '',
          bookSeriesBundle: bookSeriesBundle,
          bookSeriesPass: bookSeriesPass,
          seriesDateCount: seriesDateCount,
        })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function eventCollectsAttendeeExtras(ev) {
    return Boolean(ev && (ev.collectDietary || ev.collectAccessibility));
  }

  function needsCheckoutDetailsStep(ev, ticketQty) {
    const qtyNum = Math.max(1, parseInt(ticketQty, 10) || 1);
    if (qtyNum > 1) return true;
    return eventCollectsAttendeeExtras(ev);
  }

  function renderCheckoutAttendeeExtras(ev) {
    const wrap = document.getElementById('checkout-attendee-extras');
    const dietaryField = document.getElementById('checkout-dietary-field');
    const accessField = document.getElementById('checkout-accessibility-field');
    const collectDietary = Boolean(ev && ev.collectDietary);
    const collectAccessibility = Boolean(ev && ev.collectAccessibility);
    const show = collectDietary || collectAccessibility;

    if (wrap) wrap.hidden = !show;
    if (dietaryField) dietaryField.hidden = !collectDietary;
    if (accessField) accessField.hidden = !collectAccessibility;
  }

  function readCheckoutAttendeeExtras(ev) {
    const extras = {};
    if (ev && ev.collectDietary) {
      extras.dietaryRequirements =
        document.getElementById('checkout-dietary')?.value.trim().slice(0, 500) || '';
    }
    if (ev && ev.collectAccessibility) {
      extras.accessibilityRequirements =
        document.getElementById('checkout-accessibility')?.value.trim().slice(0, 500) || '';
    }
    return extras;
  }

  function mergeAttendeeExtras(attendee, ev) {
    if (!attendee || !ev) return attendee;
    return Object.assign(attendee, readCheckoutAttendeeExtras(ev));
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
    if (eventCollectsAttendeeExtras(activeEvent())) return false;
    return Boolean(checkoutAttendeeFromSession());
  }

  function readPaidCheckoutAttendee(qty) {
    const ev = activeEvent();
    const attendee = checkoutAttendeeFromSession();
    if (!attendee) {
      throw new Error('Please sign in to buy tickets for this event.');
    }
    const qtyNum = Math.max(1, parseInt(qty, 10) || 1);
    if (qtyNum > 1) {
      attendee.guestNames = readCheckoutGuestNames(qty);
    }
    return mergeAttendeeExtras(attendee, ev);
  }

  function checkoutErrorMessage(data) {
    const code = data && data.error ? String(data.error) : '';
    const messages = {
      invalid_event_id: 'This event could not be loaded for checkout. Refresh the page and try again.',
      event_not_found: 'This event is no longer available.',
      event_ended: 'This event has ended.',
      event_not_published: 'This event is not open for bookings yet.',
      ticket_not_found: 'That ticket type is no longer available.',
      ticket_sold_out: 'Sorry — that ticket tier is sold out.',
      event_sold_out: 'Sorry — this event is fully booked.',
      ticket_sales_disabled: 'Ticket sales are not open for this event yet.',
      missing_email: 'Please enter your email address.',
      missing_name: 'Please enter your full name.',
      stripe_not_configured:
        'Card checkout is not set up on this server. If you are on localhost, add STRIPE_SECRET_KEY to local.env (copy sk_test_… from Vercel), run npm run sync-env, and restart npm start. On the live site, check Vercel env vars and redeploy.',
      stripe_connect_required:
        'The organiser has not finished payout setup. Ticket sales are temporarily unavailable.',
      guest_visits_remaining:
        'Use your free visit before booking a paid member ticket with this organiser.',
      guest_visits_exhausted:
        'You have used all free visits with this organiser. Join their membership to keep attending, or book a member ticket if you are already on their list.',
      guest_visits_not_enabled: 'Free visits are not available for this organiser.',
      guest_passes_disabled: 'Free visits are not available for this event.',
      alumni_not_eligible: 'This previous attendee ticket is invite-only. Use the link from your email.',
      not_invited: 'This previous attendee ticket is invite-only. Use the link from your email.',
      email_mismatch: 'Sign in with the email address that received the previous attendee invite.',
      series_bundle_unavailable:
        'Book all dates is not available for this ticket right now. Pick a single date instead.',
      already_going: "You're already going to this event. View your ticket in My Hub.",
      not_authenticated: 'Please sign in or create a free account to complete your booking.',
    };
    if (data && data.message) return String(data.message);
    if (messages[code]) return messages[code];
    if (code) return 'Checkout could not start (' + code + '). Please try again.';
    return 'Could not start checkout. Please try again or contact support.';
  }

  async function startPaidCheckout(ev, ticketId, qty, attendee, options) {
    const event = ev || activeEvent();
    if (!event || !event.id) {
      throw new Error('This event could not be loaded for checkout. Refresh the page and try again.');
    }
    const checkoutOpts = options || seriesCheckoutOptions();
    const bookSeriesBundle = Boolean(checkoutOpts.bookSeriesBundle);
    const bookSeriesPass = Boolean(checkoutOpts.bookSeriesPass);
    saveBookingPending(event, ticketId, qty, attendee, checkoutOpts);
    const isAlumniBooking = Boolean(event.alumniTier && event.alumniTier.id === ticketId);
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
        dietaryRequirements: attendee?.dietaryRequirements || '',
        accessibilityRequirements: attendee?.accessibilityRequirements || '',
        alumniInviteToken:
          isAlumniBooking
            ? alumniEligibility?.inviteToken || alumniInviteToken || ''
            : undefined,
        bookSeriesBundle: bookSeriesBundle,
        bookSeriesPass: bookSeriesPass,
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

  async function completeFreeBooking(ev, ticketId, qty, attendee, options) {
    const checkoutOpts = options || seriesCheckoutOptions();
    const bookSeriesBundle = Boolean(checkoutOpts.bookSeriesBundle);
    const bookSeriesPass = Boolean(checkoutOpts.bookSeriesPass);
    const isGuestVisit = Boolean(ev.guestVisitTier && ev.guestVisitTier.id === ticketId);
    const isAlumni = Boolean(ev.alumniTier && ev.alumniTier.id === ticketId);
    const isMembersOnly = Boolean(
      (rosterMemberTickets || []).some((tier) => tier.id === ticketId)
    );
    const isSeriesCheckout = bookSeriesBundle || bookSeriesPass;
    saveBookingPending(ev, ticketId, qty, attendee, checkoutOpts);
    const endpoint =
      isGuestVisit || isAlumni || isMembersOnly || isSeriesCheckout
        ? '/api/auth/create-checkout'
        : '/api/auth/complete-booking';
    const body = {
      eventId: ev.id,
      ticketId: isUuid(ticketId) ? ticketId : null,
      qty: qty || 1,
      name: attendee?.name || '',
      email: attendee?.email || '',
      guestNames: attendee?.guestNames || [],
      dietaryRequirements: attendee?.dietaryRequirements || '',
      accessibilityRequirements: attendee?.accessibilityRequirements || '',
    };
    if (isAlumni) {
      body.alumniInviteToken = alumniEligibility?.inviteToken || alumniInviteToken || '';
      if (ceMemberInviteToken) body.ceMemberToken = ceMemberInviteToken;
    }
    if (!isGuestVisit && !isAlumni) {
      body.amountPaid = 0;
      body.paymentStatus = 'Free';
    }
    if (bookSeriesBundle) {
      body.bookSeriesBundle = true;
    }
    if (bookSeriesPass) {
      body.bookSeriesPass = true;
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok || !data.ok) {
      throw new Error(checkoutErrorMessage(data));
    }
    if (data.completed) {
      const suffix = isGuestVisit ? '&guest_visit=1' : isAlumni ? '&alumni=1' : '';
      window.location.assign('/events/booking-success?free=1&confirmed=1' + suffix);
      return;
    }
    window.location.assign('/events/booking-success?free=1&confirmed=1');
  }

  function clearBookingPending() {
    try {
      sessionStorage.removeItem(BOOKING_PENDING_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function presentMemberBookingTier(tier) {
    if (!tier || !tier.isMembersOnly) return tier;
    const rawName = String(tier.name || '').trim();
    const generic =
      !rawName ||
      /^standard(\s+ticket)?$/i.test(rawName) ||
      /^ticket$/i.test(rawName);
    if (!generic) return tier;
    const free =
      tier.priceKey === 'free' || !(Number(tier.priceNum) > 0);
    return Object.assign({}, tier, {
      name: 'Member booking',
      label: 'Member booking',
      description: free
        ? 'Included with your membership'
        : tier.description || 'Member rate — your membership',
    });
  }

  function ticketTiersForEvent(ev) {
    // Closed listing = member tiers only (no public ticket). A member price alongside
    // public tickets must still show public rates to visitors.
    const membersOnlyListing = Boolean(ev && ev.isMembersOnlyEvent);
    // Never invent a public "Standard ticket" for closed / member-list listings —
    // those tiers stay hidden until roster eligibility returns the real member rates.
    let base;
    if (ev.tickets && ev.tickets.length) {
      base = ev.tickets.slice();
    } else if (membersOnlyListing) {
      base = [];
    } else {
      base = [
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
    const extras = (rosterMemberTickets || []).filter(
      (tier) => !base.some((existing) => existing.id === tier.id)
    );
    let combined = base.concat(extras);
    const rosterMember = isRosterMemberForEvent();
    if (rosterMember) {
      combined = combined.filter(function (t) {
        return !tierIsGuestVisit(t);
      });
      const memberOnlyTiers = combined.filter(function (t) {
        return t.isMembersOnly;
      });
      if (memberOnlyTiers.length > 0) {
        combined = memberOnlyTiers;
      } else if (membersOnlyListing) {
        combined = [];
      }
      combined.sort(function (a, b) {
        return (a.isMembersOnly ? 0 : 1) - (b.isMembersOnly ? 0 : 1);
      });
    } else if (membersOnlyListing) {
      combined = combined.filter(function (t) {
        return t.isMembersOnly;
      });
    } else {
      combined = combined.filter(function (t) {
        return !t.isMembersOnly;
      });
    }
    return combined.map(presentMemberBookingTier);
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
      treatment === 'added'
        ? 'VAT added at checkout'
        : treatment === 'none'
          ? 'No VAT charged'
          : 'Prices include VAT';
    el.hidden = false;
  }

  function showAlumniTierSelected(ev) {
    const tierEl = getSelectedTierEl();
    if (!tierEl || !ev?.alumniTier) return false;
    return (
      tierEl.getAttribute('data-alumni') === '1' ||
      tierEl.getAttribute('data-ticket-id') === String(ev.alumniTier.id)
    );
  }

  function tierRemainingCount(t) {
    const capRaw = Number(t.quantityAvailable);
    // Cap of 0 was a common mis-save meaning "unlimited" — treat as no cap.
    let tierLeft = null;
    if (Number.isFinite(capRaw) && capRaw > 0) {
      const sold = Math.max(0, Number(t.registrationsCount) || 0);
      tierLeft = Math.max(0, Math.floor(capRaw) - sold);
    }
    const eventLeftRaw = Number(currentEvent && currentEvent.spotsLeft);
    const eventLeft =
      currentEvent &&
      currentEvent.capacity != null &&
      Number.isFinite(eventLeftRaw) &&
      eventLeftRaw >= 0
        ? Math.floor(eventLeftRaw)
        : null;
    if (tierLeft == null && eventLeft == null) return null;
    if (tierLeft == null) return eventLeft;
    if (eventLeft == null) return tierLeft;
    return Math.min(tierLeft, eventLeft);
  }

  function tierCapacityCap(t) {
    const capRaw = Number(t && t.quantityAvailable);
    if (!Number.isFinite(capRaw) || capRaw <= 0) return null;
    return Math.floor(capRaw);
  }

  function tierRemainingLabel(t) {
    const left = tierRemainingCount(t);
    if (left == null || left <= 0) return '';
    if (left === 1) return 'Only 1 ticket left';
    if (left <= 5) return 'Only ' + left + ' tickets left';
    const cap = tierCapacityCap(t);
    if (cap != null && left <= Math.max(10, Math.ceil(cap * 0.2))) {
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
    const isCategoryExclusivity = eventIsCategoryExclusivity(ev);
    const isGuestProg = eventIsGuestProgramme(ev);
    const isMembershipMeeting = eventIsMembershipMeeting(ev);
    const membershipAfterVisits = eventUsesMembershipAfterVisits(ev);
    const rosterMember = isRosterMemberForEvent();
    const showGuestTier =
      eventAllowsGuestPasses(ev) &&
      ev.guestVisitTier &&
      guestVisitEligibility &&
      !guestVisitEligibility.isRosterMember &&
      !rosterMembership?.isMember &&
      (guestVisitEligibility.eligible || guestVisitEligibility.signedOut);
    const guestVisitsExhausted =
      membershipAfterVisits &&
      eventAllowsGuestPasses(ev) &&
      guestVisitEligibility &&
      !guestVisitEligibility.signedOut &&
      !guestVisitEligibility.eligible &&
      !rosterMember &&
      Number(guestVisitEligibility.remaining) === 0;
    const showAlumniTier =
      ev.alumniFastPassEnabled &&
      ev.alumniTier &&
      alumniEligibility &&
      (alumniEligibility.eligible || alumniEligibility.signedOut);
    const alumniOnlyView = hasAlumniInviteLink(ev);
    const memberTiers = isGuestProg ? tiers : tiers;
    tiersEl.innerHTML = '';

    if (rosterMember && (eventHasMembersOnlyTickets(ev) || isGuestProg || isCategoryExclusivity)) {
      const banner = document.createElement('p');
      banner.className = 'ticket-load-hint ticket-load-hint--member';
      banner.textContent = isCategoryExclusivity
        ? 'You\u2019re on this group\u2019s membership list — book without applying. Guests still need host approval.'
        : eventHasMembersOnlyTickets(ev)
          ? 'You\u2019re on this group\u2019s membership list — your member rates are included below.'
          : 'You\u2019re on this group\u2019s membership list — book with your member rate below.';
      tiersEl.appendChild(banner);
    } else if (
      isGuestProg &&
      ev.hasMembersOnlyTiers &&
      guestVisitEligibility &&
      !guestVisitEligibility.signedOut &&
      guestVisitEligibility.eligible &&
      !rosterMember
    ) {
      const hint = document.createElement('p');
      hint.className = 'ticket-load-hint';
      const signedInEmail = String(guestVisitEligibility.viewerEmail || '').trim();
      hint.textContent = signedInEmail
        ? 'Free visits are for visitors. Member tickets need the email on this group\u2019s membership list (you\u2019re signed in as ' +
          signedInEmail +
          ').'
        : 'Free visits are for visitors. Sign in with the email on this group\u2019s membership list for member tickets.';
      tiersEl.appendChild(hint);
    }

    let firstSelectable = null;

    if (showGuestTier) {
      const t = ev.guestVisitTier;
      const soldOut = panelClosed;
      const tier = document.createElement('div');
      tier.className =
        'tier tier-guest-visit' + (soldOut ? ' sold-out tier-disabled' : ' selected');
      tier.id = 'ev-tier-guest-visit';
      tier.setAttribute('data-ticket-id', t.id);
      tier.setAttribute('data-price', '0');
      tier.setAttribute('data-label', 'Free visit');
      tier.setAttribute('data-qty-max', '1');
      tier.setAttribute('data-guest-visit', '1');
      if (!soldOut) {
        tier.setAttribute('aria-pressed', 'true');
        firstSelectable = tier;
      } else {
        tier.setAttribute('aria-disabled', 'true');
      }
      tier.innerHTML = guestVisitTierCardHtml(t, guestVisitEligibility, soldOut, {
        isCategoryExclusivity: isCategoryExclusivity,
        isMembershipMeeting: membershipAfterVisits,
      });
      tiersEl.appendChild(tier);
    }

    if (isCategoryExclusivity && tiers.length && !rosterMember) {
      const t = tiers.find((tier) => tierIsApplication(tier)) || tiers[0];
      let soldOut = Boolean(t.soldOut) || panelClosed;
      const priceNum = t.priceKey === 'free' ? 0 : Number(t.priceNum) || 0;

      const tier = document.createElement('div');
      tier.className =
        'tier tier-category-exclusivity' +
        (soldOut ? ' sold-out tier-disabled' : '') +
        (!firstSelectable && !soldOut ? ' selected' : '');
      tier.id = 'ev-tier-category-exclusivity';
      tier.setAttribute('data-ticket-id', t.id);
      tier.setAttribute('data-price', String(priceNum));
      tier.setAttribute('data-label', t.label || t.name || 'Application');
      if (t.stripePaymentLink) tier.setAttribute('data-stripe-link', t.stripePaymentLink);
      const cap = tierCapacityCap(t);
      const sold = Math.max(0, Number(t.registrationsCount) || 0);
      tier.setAttribute('data-qty-max', '1');
      if (cap != null) {
        const left = Math.max(0, cap - sold);
        if (left <= 0) {
          soldOut = true;
          tier.classList.add('sold-out', 'tier-disabled');
        }
      }

      if (!soldOut) {
        tier.setAttribute('role', 'button');
        tier.setAttribute('tabindex', '0');
        if (!firstSelectable) {
          firstSelectable = tier;
          tier.setAttribute('aria-pressed', 'true');
        } else {
          tier.setAttribute('aria-pressed', 'false');
        }
      } else {
        tier.setAttribute('aria-disabled', 'true');
      }

      tier.innerHTML = categoryExclusivityTierCardHtml(t, soldOut);
      tiersEl.appendChild(tier);
    } else if (showAlumniTier) {
      const t = ev.alumniTier;
      let soldOut = panelClosed;
      const priceNum = t.priceKey === 'free' ? 0 : Number(t.priceNum) || 0;
      const cap = tierCapacityCap(t);
      const sold = Math.max(0, Number(t.registrationsCount) || 0);
      if (cap != null) {
        const left = Math.max(0, cap - sold);
        if (left <= 0) soldOut = true;
      }
      const tier = document.createElement('div');
      tier.className =
        'tier tier-alumni' + (soldOut ? ' sold-out tier-disabled' : ' selected');
      tier.id = 'ev-tier-alumni';
      tier.setAttribute('data-ticket-id', t.id);
      tier.setAttribute('data-price', String(priceNum));
      tier.setAttribute('data-label', 'Previous attendee ticket');
      tier.setAttribute('data-qty-max', '1');
      tier.setAttribute('data-alumni', '1');
      if (!soldOut) {
        tier.setAttribute('aria-pressed', 'true');
        firstSelectable = tier;
      } else {
        tier.setAttribute('aria-disabled', 'true');
      }
      tier.innerHTML = alumniTierCardHtml(t, alumniEligibility, soldOut);
      tiersEl.appendChild(tier);
    } else if (!alumniOnlyView) {
    (showGuestTier ? [] : memberTiers).forEach((t, index) => {
      const soldOut = Boolean(t.soldOut) || panelClosed;
      const priceNum = t.priceKey === 'free' ? 0 : Number(t.priceNum) || 0;
      const priceDisplay = t.priceKey === 'free' ? 'Free' : t.price || fmt(priceNum);
      const remainingLabel = soldOut ? '' : tierRemainingLabel(t);
      const isMemberTier = Boolean(t.isMembersOnly);
      const isPass = Boolean(t.isSeriesPass);
      const subtitle = soldOut
        ? 'Sold out'
        : isPass
          ? 'All dates included — one checkout'
          : isMemberTier
          ? priceNum > 0
            ? 'Member rate — your membership'
            : 'Included with your membership'
          : rosterMember && isCategoryExclusivity
          ? 'Member booking — no application needed'
          : rosterMember && isGuestProg
          ? priceNum > 0
            ? 'Member rate — your membership'
            : 'Included with your membership'
          : remainingLabel || t.description || '';

      const tier = document.createElement('div');
      tier.className =
        'tier' +
        (soldOut ? ' sold-out tier-disabled' : '');
      tier.id = index === 0 ? 'ev-tier-standard' : 'ev-tier-' + t.id;
      tier.setAttribute('data-ticket-id', t.id);
      tier.setAttribute('data-price', String(priceNum));
      tier.setAttribute('data-label', t.label || t.name || 'Ticket');
      tier.setAttribute('data-tier-name', t.name || t.label || 'Ticket');
      if (t.isSeriesPass) tier.setAttribute('data-series-pass', '1');
      if (t.stripePaymentLink) tier.setAttribute('data-stripe-link', t.stripePaymentLink);
      const cap = tierCapacityCap(t);
      const sold = Math.max(0, Number(t.registrationsCount) || 0);
      const remaining = tierRemainingCount(t);
      if (remaining != null) {
        tier.setAttribute('data-qty-max', String(remaining));
      } else if (cap != null) {
        tier.setAttribute('data-qty-max', String(Math.max(0, cap - sold)));
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
        (remainingLabel && !isMemberTier
          ? '<span class="tier-remaining-badge">' + escapeHtml(remainingLabel) + '</span>'
          : '') +
        '</div>' +
        '<div class="tier-price">' +
        escapeHtml(priceDisplay) +
        '</div>';

      tiersEl.appendChild(tier);
    });
    }

    if (
      alumniOnlyView &&
      !firstSelectable &&
      !tiersEl.children.length &&
      !isCategoryExclusivity
    ) {
      tiersEl.innerHTML =
        '<p class="ticket-load-hint ticket-load-hint--warn">' +
        escapeHtml(alumniInviteBlockedMessage(alumniEligibility)) +
        '</p>';
    } else if (guestVisitsExhausted && !firstSelectable) {
      tiersEl.innerHTML = membershipJoinCtaHtml(ev);
    } else if (!firstSelectable && tiersEl.children.length && !isCategoryExclusivity) {
      const hint = ev.isSoldOut
        ? 'All ticket tiers are currently sold out.'
        : 'Tickets are not currently available for this event.';
      tiersEl.innerHTML = '<p class="ticket-load-hint">' + hint + '</p>';
    } else if (
      !firstSelectable &&
      !tiersEl.children.length &&
      !isCategoryExclusivity &&
      ev.isMembersOnlyEvent
    ) {
      if (membershipAfterVisits && !rosterMember) {
        tiersEl.innerHTML = membershipJoinCtaHtml(ev);
      } else {
        tiersEl.innerHTML =
          '<p class="ticket-load-hint">' +
          (rosterMembership?.signedOut
            ? 'This is a members-only event. Sign in with the email on this group\u2019s membership list to book.'
            : 'This is a members-only event — booking is for people on this group\u2019s membership list only.') +
          '</p>';
      }
    } else if (firstSelectable && !rosterMember) {
      const upsell = membershipSoftUpsellHtml(ev);
      if (upsell) {
        const wrap = document.createElement('div');
        wrap.innerHTML = upsell;
        if (wrap.firstChild) tiersEl.appendChild(wrap.firstChild);
      }
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
        urgencyEl.hidden = true;
      }
    }

    updateSeriesBundleOption(ev);
    syncTicketPanelSelectionFromDom();
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
    const { rating: r, reviews: c } = hostReviewStats(ev);
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
    name.textContent = review.name || review.authorName || 'Attendee';
    const date = document.createElement('span');
    date.className = 'review-card-date';
    date.textContent = review.date || '';
    header.appendChild(name);
    header.appendChild(date);
    const stars = document.createElement('div');
    stars.className = 'review-card-stars';
    const rating = Number(review.rating) || 0;
    stars.setAttribute('aria-label', rating + ' out of 5 stars');
    stars.textContent = starsFromAvg(rating);
    const body = document.createElement('p');
    const text = String(review.text || review.body || '').trim();
    body.textContent = text;
    card.appendChild(header);
    card.appendChild(stars);
    if (text) card.appendChild(body);
    const reply = review.reply ? String(review.reply).trim() : '';
    if (reply) {
      const replyBlock = document.createElement('div');
      replyBlock.className = 'review-organiser-reply';
      const replyLabel = document.createElement('div');
      replyLabel.className = 'review-organiser-reply-label';
      replyLabel.textContent = 'Organiser reply';
      const replyText = document.createElement('p');
      replyText.className = 'review-organiser-reply-text';
      replyText.textContent = reply;
      replyBlock.appendChild(replyLabel);
      replyBlock.appendChild(replyText);
      card.appendChild(replyBlock);
    }
    if (review.id && window.ReviewReport) {
      window.ReviewReport.addReportButton(card, {
        reviewId: review.id,
        organiserId: context && context.organiserId,
        eventId: context && context.eventId,
        snippet: text.slice(0, 500),
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
      if (!show) form.classList.remove('is-paid-guests', 'is-checkout-details');
    }
    const freeDataSharingNote = document.getElementById('checkout-free-data-sharing-note');
    if (freeDataSharingNote && !show) freeDataSharingNote.hidden = true;
    if (secureFoot && !show) secureFoot.hidden = false;
    if (!show) setCheckoutSubmitting(false);
    refreshTicketJumpVisibility();
  }

  function currentTicketQty() {
    const raw = document.getElementById('qty-value')?.textContent;
    return Math.max(1, parseInt(raw, 10) || 1);
  }

  function showPaidGuestCheckout(show, isPaid, ticketQty) {
    if (isPaid === undefined) isPaid = true;
    const ev = activeEvent();
    const form = document.getElementById('checkout-details-form');
    const confirmBtn = document.getElementById('checkout-confirm-btn');
    const intro = document.getElementById('checkout-details-intro');
    const nameField = document.getElementById('checkout-name')?.closest('.form-field');
    const emailField = document.getElementById('checkout-email')?.closest('.form-field');
    const freeTerms = document.querySelector('.checkout-free-terms');
    const hasExtras = eventCollectsAttendeeExtras(ev);
    const qtyNum = Math.max(1, parseInt(ticketQty, 10) || currentTicketQty());
    const hasGuests = qtyNum > 1;
    showCheckoutDetails(show);
    if (form) {
      form.classList.toggle('is-paid-guests', show && isPaid);
      form.classList.toggle('is-checkout-details', show);
    }
    if (nameField) nameField.hidden = show && isPaid;
    if (emailField) emailField.hidden = show && isPaid;
    if (freeTerms) freeTerms.hidden = show && isPaid;
    const freeDataSharingNote = document.getElementById('checkout-free-data-sharing-note');
    if (freeDataSharingNote) freeDataSharingNote.hidden = !show || isPaid;
    if (intro && show) {
      if (hasGuests && hasExtras && isPaid) {
        intro.textContent =
          'Add names for additional attendees and any dietary or accessibility needs.';
      } else if (hasGuests && hasExtras && !isPaid) {
        intro.textContent =
          'Add names for additional attendees and any dietary or accessibility needs, then confirm your registration.';
      } else if (hasGuests && isPaid) {
        intro.textContent = 'Add names for additional attendees in your booking.';
      } else if (hasGuests) {
        intro.textContent =
          'Add names for additional attendees, then confirm your registration.';
      } else if (hasExtras && isPaid) {
        intro.textContent =
          'Tell us about any dietary or accessibility needs, then continue to payment.';
      } else if (hasExtras) {
        intro.textContent =
          'Tell us about any dietary or accessibility needs, then confirm your registration.';
      }
    }
    if (confirmBtn) {
      confirmBtn.textContent = show ? (isPaid ? 'Continue to payment' : 'Confirm registration') : 'Confirm registration';
    }
    if (show) renderCheckoutAttendeeExtras(ev);
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
      const data = await fetchSessionData();
      if (data.ok && data.user) checkoutSessionUser = data.user;
    } catch (e) {
      /* ignore */
    }
    return checkoutSessionUser;
  }

  async function prefillCheckoutDetails() {
    await loadCheckoutSessionUser();
    const attendee = checkoutAttendeeFromSession();
    const nameEl = document.getElementById('checkout-name');
    const emailEl = document.getElementById('checkout-email');
    if (!nameEl && !emailEl) return;
    if (attendee) {
      if (nameEl && attendee.name && !nameEl.value.trim()) {
        nameEl.value = attendee.name;
      }
      if (emailEl && attendee.email && !emailEl.value.trim()) {
        emailEl.value = attendee.email;
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
    const ev = activeEvent();
    return Object.assign({ name, email, guestNames }, readCheckoutAttendeeExtras(ev));
  }

  function syncPaidCheckoutPanel(label, qty, total) {
    const ev = activeEvent();
    const paidBlock = document.getElementById('ticket-paid-checkout');
    const organiserEl = document.getElementById('checkout-organiser-name');
    const totalEl = document.getElementById('checkout-total-price');
    const refundEl = document.getElementById('checkout-refund-policy');
    const refundLabelEl = document.getElementById('checkout-refund-policy-label');
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
    if (buy && !eventIsCategoryExclusivity(ev)) {
      buy.textContent = isFree ? 'Get free ticket' : 'Buy ticket';
    }
    const organiserName = ev ? ev.organiser || ev.organiserName || 'Event organiser' : 'Event organiser';
    if (organiserEl && ev) {
      organiserEl.textContent = organiserName;
    }
    const dataSharingOrganiser = document.getElementById('checkout-data-sharing-organiser');
    if (dataSharingOrganiser && ev) {
      dataSharingOrganiser.textContent = organiserName;
    }
    if (totalEl) {
      totalEl.textContent =
        fmt(total || 0) +
        (total > 0 ? ' — ' + (label || 'Ticket') + ' × ' + String(qty || 1) : '');
    }
    if (refundEl && ev) {
      refundEl.textContent = refundPolicyDetailText(ev);
    }
    if (refundLabelEl && ev) {
      refundLabelEl.textContent = refundPolicyShortLabel(ev);
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
    const organiserName = ev ? ev.organiser || ev.organiserName || 'the event organiser' : 'the event organiser';
    const freeOrganiser = document.getElementById('checkout-free-organiser');
    if (freeOrganiser) {
      freeOrganiser.textContent = 'Organised by ' + organiserName;
      freeOrganiser.hidden = false;
    }
    const dataSharingNote = document.getElementById('checkout-free-data-sharing-note');
    const dataSharingOrganiser = document.getElementById('checkout-free-data-sharing-organiser');
    if (dataSharingNote) dataSharingNote.hidden = false;
    if (dataSharingOrganiser) dataSharingOrganiser.textContent = organiserName;
  }

  let nudgeUiBound = false;

  async function prefillNudgeEmail() {
    const emailEl = document.getElementById('ticket-nudge-email');
    const nameEl = document.getElementById('ticket-nudge-name');
    const emailField = emailEl && emailEl.closest('.form-field');
    const nameField = nameEl && nameEl.closest('.form-field');
    const nudgePanel = document.getElementById('ticket-sales-nudge');
    if (!emailEl) return;
    try {
      const data = await fetchSessionData();
      if (data && data.ok && data.user) {
        if (data.user.email) emailEl.value = data.user.email;
        if (nameEl && data.user.name) nameEl.value = data.user.name;
        if (emailField) emailField.hidden = true;
        if (nameField) nameField.hidden = true;
        if (nudgePanel) nudgePanel.classList.add('is-logged-in');
        const btn = document.getElementById('ticket-nudge-btn');
        if (btn && !btn.dataset.sent) btn.textContent = 'Nudge organiser to add tickets';
        return;
      }
    } catch {
      /* ignore */
    }
    if (emailField) emailField.hidden = false;
    if (nameField) nameField.hidden = false;
    if (nudgePanel) nudgePanel.classList.remove('is-logged-in');
  }

  function bindTicketSalesNudgeUi(ev) {
    if (nudgeUiBound) return;
    const btn = document.getElementById('ticket-nudge-btn');
    const statusEl = document.getElementById('ticket-nudge-status');
    if (!btn) return;
    nudgeUiBound = true;

    async function submitTicketSalesNudge() {
      const current = activeEvent() || ev;
      const eventId = String(document.body.getAttribute('data-event-id') || current?.id || '').trim();
      const email = document.getElementById('ticket-nudge-email')?.value.trim() || '';
      const name = document.getElementById('ticket-nudge-name')?.value.trim() || '';
      if (!eventId) {
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.className = 'ticket-nudge-status is-error';
          statusEl.textContent = 'Could not identify this event. Refresh the page and try again.';
        }
        return;
      }
      if (!email) {
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.className = 'ticket-nudge-status is-error';
          statusEl.textContent = 'Enter your email so the organiser can follow up.';
        }
        document.getElementById('ticket-nudge-email')?.focus();
        return;
      }
      btn.disabled = true;
      if (statusEl) statusEl.hidden = true;
      try {
        const res = await fetch('/api/auth/nudge-ticket-sales', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: eventId, email: email, name: name }),
        });
        const data = await res.json().catch(function () {
          return {};
        });
        if (!res.ok || !data.ok) {
          throw new Error(data.message || data.error || 'Could not send nudge. Please try again.');
        }
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.className = 'ticket-nudge-status is-ok';
          statusEl.textContent = data.message || 'Nudge sent — thank you!';
        }
        btn.textContent = 'Nudge sent';
        btn.dataset.sent = '1';
      } catch (e) {
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.className = 'ticket-nudge-status is-error';
          statusEl.textContent = e.message || 'Could not send nudge. Please try again.';
        }
        btn.disabled = false;
      }
    }

    btn.addEventListener('click', submitTicketSalesNudge);
    document.getElementById('ticket-nudge-email')?.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitTicketSalesNudge();
      }
    });
  }

  let scheduledUiBound = false;

  function formatTicketSalesOpensClient(ev) {
    if (ev.ticketSalesOpensLabel) return ev.ticketSalesOpensLabel;
    if (!ev.ticketSalesOpensAt) return '';
    if (window.HubEventTimezone && typeof window.HubEventTimezone.formatDateTimeLong === 'function') {
      const formatted = window.HubEventTimezone.formatDateTimeLong(ev.ticketSalesOpensAt);
      return formatted === '\u2014' ? '' : formatted;
    }
    const d = new Date(ev.ticketSalesOpensAt);
    if (Number.isNaN(d.getTime())) return '';
    return (
      d.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/London',
      }) +
      ' at ' +
      d.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/London',
      })
    );
  }

  let alertUiBound = false;

  function bindTicketSalesAlertUi(ev) {
    const panel = document.getElementById('ticket-sales-alert');
    const btn = document.getElementById('ticket-sales-alert-btn');
    const statusEl = document.getElementById('ticket-sales-alert-status');
    if (!panel || !btn) return;

    function refreshAlertSaveUi() {
      const eventId = String(document.body.getAttribute('data-event-id') || ev.id || '');
      const saved = window.HubFavourites ? window.HubFavourites.isSaved(eventId) : false;
      btn.textContent = saved ? "Saved — we'll notify you" : 'Alert me if tickets open';
      btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
      btn.classList.toggle('is-saved', saved);
    }

    refreshAlertSaveUi();
    if (window.HubFavourites) {
      window.HubFavourites.sync().then(function () {
        refreshAlertSaveUi();
      });
    }

    if (alertUiBound) return;
    alertUiBound = true;
    btn.addEventListener('click', async function () {
      if (!window.HubFavourites) return;
      const current = activeEvent() || ev;
      if (
        !(await requireSignedInAttendee({
          gate: {
            title: 'Sign in to get ticket alerts',
            lead: "Create a free account or sign in — we'll email you if tickets open again.",
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
        await window.HubFavourites.toggle(eventId, { organiserId: organiserId });
        refreshAlertSaveUi();
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.className = 'ticket-sales-alert-status is-ok';
          statusEl.textContent = 'Saved — we\u2019ll email you if tickets open.';
        }
      } catch (e) {
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.className = 'ticket-sales-alert-status is-error';
          statusEl.textContent = e.message || 'Could not save this event. Please try again.';
        }
      }
      btn.disabled = false;
    });
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
        if (label) label.textContent = saved ? 'Saved' : 'Save';
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

  function registrationIsConfirmedGoing(state) {
    if (!applicationBlocksReapply(state)) return false;
    const status = String(state.applicationStatus || '').trim();
    const payment = String(state.paymentStatus || '').trim();
    return status === 'Approved' && (payment === 'Paid' || payment === 'Free');
  }

  function applicationStatusCopy(state, ev) {
    const status = String(state?.applicationStatus || '').trim();
    const payment = String(state?.paymentStatus || '').trim();
    if (status === 'Approved' && (payment === 'Paid' || payment === 'Free')) {
      return {
        title: "You're already going",
        lead: "You're registered for this date.",
      };
    }
    if (status === 'Pending') {
      return {
        title: 'Application submitted',
        lead:
          "You've already applied for this event. We'll let you know when the organiser has made a decision — check your email and My Hub for updates.",
      };
    }
    if (status === 'Approved') {
      return {
        title: 'Application approved',
        lead: 'Good news — the organiser approved your application. Complete your booking in My Hub to secure your seat.',
      };
    }
    return {
      title: eventIsCategoryExclusivity(ev) ? 'Application submitted' : "You're already going",
      lead: eventIsCategoryExclusivity(ev)
        ? "You've already applied for this event."
        : "You're registered for this date.",
    };
  }

  function applyAlreadyGoingStatusActions(ev, alreadyGoing) {
    const link = document.getElementById('category-exclusivity-application-status-link');
    const anotherBtn = document.getElementById('category-exclusivity-application-status-another-date');
    if (!link) return;

    if (alreadyGoing) {
      link.textContent = 'View my tickets';
      link.href = '/account/#upcoming';
      if (anotherBtn) {
        const showAnother = seriesHasOtherBookableDates(ev && ev.id);
        anotherBtn.hidden = !showAnother;
      }
      return;
    }

    link.textContent = 'View in My Hub';
    link.href = '/account/';
    if (anotherBtn) anotherBtn.hidden = true;
  }

  function applyEventApplicationUi(ev) {
    bindAlreadyGoingActions();
    const panel = document.getElementById('tickets');
    const statusPanel = document.getElementById('category-exclusivity-application-status');
    const titleEl = document.getElementById('category-exclusivity-application-status-title');
    const leadEl = document.getElementById('category-exclusivity-application-status-lead');
    if (!panel) return;

    const shouldShow = eventIsCategoryExclusivity(ev)
      ? applicationBlocksReapply(eventApplicationState)
      : registrationIsConfirmedGoing(eventApplicationState);
    const alreadyGoing = registrationIsConfirmedGoing(eventApplicationState);
    panel.classList.toggle('is-application-submitted', shouldShow);
    panel.classList.toggle('is-already-going', alreadyGoing);
    if (!statusPanel) return;

    if (!shouldShow) {
      statusPanel.hidden = true;
      applyAlreadyGoingStatusActions(ev, false);
      updateTicketJumpBar(ev);
      return;
    }

    const copy = applicationStatusCopy(eventApplicationState, ev);
    if (titleEl) titleEl.textContent = copy.title;
    if (leadEl) leadEl.textContent = copy.lead;
    applyAlreadyGoingStatusActions(ev, alreadyGoing);
    statusPanel.hidden = false;
    updateTicketJumpBar(ev);
  }

  async function refreshEventApplicationUi(ev) {
    if (!ev || !ev.id) {
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

  async function showAlreadyGoingInsteadOfAlert(ev, err) {
    const code = err && err.message ? String(err.message) : '';
    const isAlreadyGoing =
      /already going/i.test(code) || /already_going/i.test(code);
    if (!isAlreadyGoing) return false;
    const event = ev || activeEvent();
    await refreshEventApplicationUi(event);
    if (event) applyTicketPanelState(event);
    showCheckoutDetails(false);
    showPaidGuestCheckout(false);
    const panel = document.getElementById('tickets');
    if (panel) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return true;
  }

  function applyTicketPanelState(ev) {
    const panel = document.getElementById('tickets');
    const buy = document.getElementById('buy-btn');
    const purchaseView = document.getElementById('ticket-purchase-view');
    const appForm = document.getElementById('seat-application-form');
    const nudgePanel = document.getElementById('ticket-sales-nudge');
    const scheduledPanel = document.getElementById('ticket-sales-scheduled');
    if (!panel || !buy) return;

    panel.dataset.approvalRequired = eventIsCategoryExclusivity(ev) ? 'true' : 'false';
    panel.dataset.soldOut = ev.isSoldOut ? 'true' : 'false';
    panel.dataset.salesClosed = ev.isSalesClosed || ev.isEventPast ? 'true' : 'false';

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
    const alertPanelReset = document.getElementById('ticket-sales-alert');
    if (alertPanelReset) alertPanelReset.hidden = true;

    if (ev.isEventPast) {
      panel.classList.add('is-unavailable');
      buy.disabled = true;
      buy.classList.add('cta-btn-disabled');
      buy.textContent = 'Event ended';
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
      updateTicketJumpBar(ev);
      return;
    }

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
      updateTicketJumpBar(ev);
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
        const leadEl = nudgePanel.querySelector('.ticket-sales-nudge-lead');
        if (leadEl) {
          leadEl.textContent =
            'Interested in attending? Nudge the host to release tickets for this event.';
        }
        const subEl = nudgePanel.querySelector('.ticket-sales-nudge-sub');
        if (subEl) {
          subEl.hidden = true;
        }
        const btn = document.getElementById('ticket-nudge-btn');
        if (btn && !btn.dataset.sent) btn.textContent = 'Nudge organiser to add tickets';
        bindTicketSalesNudgeUi(ev);
        prefillNudgeEmail();
      }
      applyEventApplicationUi(ev);
      updateTicketJumpBar(ev);
      return;
    }

    const unavailable = ev.isSoldOut || ev.isSalesClosed;
    if (unavailable) {
      panel.classList.add('is-unavailable');
      buy.disabled = true;
      buy.classList.add('cta-btn-disabled');
      buy.textContent = ev.isSoldOut ? 'Sold Out' : 'Registration Closed';
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
      const alertPanel = document.getElementById('ticket-sales-alert');
      if (alertPanel && !ev.isEventPast) {
        alertPanel.hidden = false;
        const lead = document.getElementById('ticket-sales-alert-lead');
        if (lead) {
          lead.textContent = ev.isSoldOut
            ? 'This event is sold out. Save it and we\u2019ll email you if more tickets open.'
            : 'Registration is closed for now. Save this event and we\u2019ll email you if tickets open again.';
        }
        bindTicketSalesAlertUi(ev);
      }
      applyEventApplicationUi(ev);
      updateTicketJumpBar(ev);
      return;
    }

    if (hasAlumniInviteLink(ev) && !getSelectedTierEl()) {
      panel.classList.add('is-unavailable');
      buy.disabled = true;
      buy.classList.add('cta-btn-disabled');
      buy.textContent = 'Previous attendee invite required';
      if (purchaseView) purchaseView.removeAttribute('aria-hidden');
      applyEventApplicationUi(ev);
      return;
    }

    if (registrationIsConfirmedGoing(eventApplicationState)) {
      buy.disabled = true;
      buy.classList.add('cta-btn-disabled');
      buy.textContent = "You're already going";
      if (purchaseView) purchaseView.setAttribute('aria-hidden', 'true');
      applyEventApplicationUi(ev);
      updateTicketJumpBar(ev);
      return;
    }

    buy.disabled = false;
    buy.classList.remove('cta-btn-disabled');
    if (purchaseView) purchaseView.removeAttribute('aria-hidden');

    if (eventIsCategoryExclusivity(ev)) {
      if (isRosterMemberForEvent()) {
        panel.classList.remove('is-approval-mode');
      } else {
        panel.classList.add('is-approval-mode');
      }
      const categoryExclusivityFoot = document.getElementById('category-exclusivity-apply-foot');
      const footText = document.getElementById('category-exclusivity-apply-foot-text');
      if (isRosterMemberForEvent()) {
        buy.textContent = 'Book as a member';
        if (categoryExclusivityFoot) categoryExclusivityFoot.hidden = false;
        if (footText) {
          footText.textContent =
            'You’re on this group’s membership list — book without applying. Guests still need host approval.';
        }
      } else {
        buy.textContent = 'Apply for a Seat';
        if (categoryExclusivityFoot) categoryExclusivityFoot.hidden = false;
        if (footText) footText.textContent = 'Application reviewed by the organiser';
      }
    } else if (
      eventAllowsGuestPasses(ev) &&
      guestVisitEligibility?.eligible &&
      !isRosterMemberForEvent()
    ) {
      const categoryExclusivityFoot = document.getElementById('category-exclusivity-apply-foot');
      if (categoryExclusivityFoot) categoryExclusivityFoot.hidden = true;
      buy.textContent = 'Book free visit';
    } else if (showAlumniTierSelected(ev)) {
      const categoryExclusivityFoot = document.getElementById('category-exclusivity-apply-foot');
      if (categoryExclusivityFoot) categoryExclusivityFoot.hidden = true;
      const tierEl = getSelectedTierEl();
      const priceNum = tierEl ? parseFloat(tierEl.getAttribute('data-price')) || 0 : 0;
      buy.textContent = priceNum > 0 ? 'Book previous attendee ticket' : 'Claim previous attendee ticket';
    } else {
      const categoryExclusivityFoot = document.getElementById('category-exclusivity-apply-foot');
      if (categoryExclusivityFoot) categoryExclusivityFoot.hidden = true;
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

    /* Pending/scheduled must win over isSalesClosed — both flags are often true together. */
    let labelText = 'Get tickets';
    if (registrationIsConfirmedGoing(eventApplicationState)) labelText = "You're already going";
    else if (ev.isEventPast) labelText = 'Event ended';
    else if (ev.isTicketSalesPending) labelText = 'Nudge organiser';
    else if (ev.isTicketSalesScheduled) labelText = 'Tickets opening soon';
    else if (ev.isSoldOut) labelText = 'Sold out';
    else if (ev.isSalesClosed) labelText = 'Registration closed';
    else if (eventIsCategoryExclusivity(ev))
      labelText = isRosterMemberForEvent() ? 'Book as a member' : 'Apply for a seat';
    else if (ev.priceKey === 'free') labelText = 'Get free ticket';
    else labelText = 'Buy ticket';

    if (label) label.textContent = labelText;
    if (priceEl) {
      const showPrice =
        priceText &&
        labelText !== 'Sold out' &&
        labelText !== 'Registration closed' &&
        labelText !== 'Nudge organiser' &&
        labelText !== 'Tickets opening soon' &&
        labelText !== 'Event ended' &&
        labelText !== "You're already going";
      priceEl.textContent = showPrice ? priceText : '';
      priceEl.hidden = !showPrice;
    }

    jump.dataset.jumpMode = ev.isTicketSalesPending
      ? 'nudge'
      : ev.isTicketSalesScheduled
        ? 'scheduled'
        : ev.isSoldOut || ev.isSalesClosed || ev.isEventPast
          ? 'closed'
          : 'buy';

    refreshTicketJumpVisibility();
  }

  function parseEventStartEnd(ev) {
    let start = null;
    let end = null;
    const startRaw = (ev && (ev.starts_at || ev.dateRaw || ev.date || ev.nextDate || ev.next_date)) || null;
    const endRaw = (ev && (ev.ends_at || ev.endDateRaw || ev.endDate)) || null;

    if (startRaw) {
      start = new Date(startRaw);
      if (Number.isNaN(start.getTime())) start = null;
    }

    if (!start && ev && ev.dateRaw) {
      const iso = String(ev.dateRaw).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (iso) {
        let h = 12;
        let m = 0;
        const tm = String(ev.time || '').match(/(\d{1,2}):(\d{2})/);
        if (tm) {
          h = parseInt(tm[1], 10);
          m = parseInt(tm[2], 10);
        }
        const tz = window.HubEventTimezone;
        if (tz && typeof tz.londonWallToUtcIso === 'function') {
          start = new Date(
            tz.londonWallToUtcIso(
              parseInt(iso[1], 10),
              parseInt(iso[2], 10),
              parseInt(iso[3], 10),
              h,
              m
            )
          );
        } else {
          start = new Date(
            parseInt(iso[1], 10),
            parseInt(iso[2], 10) - 1,
            parseInt(iso[3], 10),
            h,
            m,
            0
          );
        }
      }
    }

    if (!start || Number.isNaN(start.getTime())) {
      start = new Date();
      start.setUTCHours(12, 0, 0, 0);
    }

    if (endRaw) {
      end = new Date(endRaw);
      if (Number.isNaN(end.getTime())) end = null;
    }
    if (!end && window.HubEventTimezone && typeof window.HubEventTimezone.eventEndMs === 'function') {
      const endMs = window.HubEventTimezone.eventEndMs(ev || {});
      if (endMs != null) end = new Date(endMs);
    }
    if (!end || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    }
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

  function trackOrganiserShareLanding(ev) {
    try {
      var params = new URLSearchParams(window.location.search || '');
      var campaign = String(params.get('utm_campaign') || '')
        .trim()
        .toLowerCase();
      if (campaign !== 'organiser_share') return;
      var key =
        'hub_promote_landing:' +
        String((ev && ev.id) || params.get('id') || window.location.pathname || '');
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
      } catch (e) {
        /* private mode — still send once per page load */
      }
      fetch('/api/promote-analytics', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'landing',
          source: 'event_page',
          eventId: (ev && ev.id) || null,
          organiserId: (ev && (ev.organiserId || ev.organiser_id)) || null,
          utmCampaign: campaign,
          utmSource: params.get('utm_source') || null,
          utmMedium: params.get('utm_medium') || null,
          utmContent: params.get('utm_content') || null,
          path: String(window.location.pathname || '').slice(0, 200),
        }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {
      /* non-fatal */
    }
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
      if (label) label.textContent = saved ? 'Saved' : 'Save';
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
    const qtyRow = document.querySelector('.qty-row');
    const bundleCheck = document.getElementById('ev-series-bundle-check');

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
      if (eventIsCategoryExclusivity(evNow) || eventIsGuestProgramme(evNow)) {
        qty = 1;
        maxQty = 1;
      }
      const bundleOffer = updateSeriesBundleOption(evNow);
      const selectedTier = getSelectedTierEl();
      const bundleSelected = Boolean(bundleOffer && bundleCheck && bundleCheck.checked);
      const passSelected =
        selectedTier && selectedTier.getAttribute('data-series-pass') === '1';
      if (bundleSelected || passSelected) {
        qty = 1;
        maxQty = 1;
      }
      if (qty > maxQty) qty = maxQty;
      const billQty =
        bundleSelected && bundleOffer
          ? bundleOffer.dateCount
          : passSelected
            ? 1
            : qty;
      const subtotal = price * billQty;
      const fee =
        subtotal > 0 ? subtotal * BOOKING_FEE_RATE + BOOKING_FEE_PER_TICKET * billQty : 0;
      const total = subtotal + fee;
      if (sumLabel) {
        sumLabel.textContent = bundleSelected
          ? label + ' · all dates'
          : passSelected
            ? label + ' · all dates'
            : label;
      }
      if (sumQty) sumQty.textContent = String(billQty);
      if (sumSubtotal) sumSubtotal.textContent = fmt(subtotal);
      if (sumFee) sumFee.textContent = fmt(fee);
      if (sumFeeRow) sumFeeRow.hidden = subtotal <= 0;
      if (summaryFeeNote) summaryFeeNote.hidden = subtotal <= 0;
      if (sumTotal) sumTotal.textContent = fmt(total);
      if (qtyValue) qtyValue.textContent = String(qty);
      qtyDown.disabled = qty <= 1 || bundleSelected || passSelected;
      qtyUp.disabled = qty >= maxQty || bundleSelected || passSelected;
      if (qtyRow) qtyRow.hidden = bundleSelected || passSelected;
      if (qtyHint) {
        if (bundleSelected) {
          qtyHint.hidden = false;
          qtyHint.textContent = 'Booking all remaining dates in one checkout.';
        } else if (passSelected) {
          qtyHint.hidden = false;
          qtyHint.textContent = 'Full series pass — includes every date in this listing.';
        } else if (maxQty < 99) {
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
      syncPaidCheckoutPanel(label, billQty, total);
    }

    if (bundleCheck && !bundleCheck.dataset.bound) {
      bundleCheck.dataset.bound = '1';
      bundleCheck.addEventListener('change', update);
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

    window.hubTicketPanelResync = function hubTicketPanelResync() {
      const sel = document.querySelector('#ticket-tiers .tier.selected:not(.sold-out):not(.tier-disabled)');
      if (sel) {
        price = parseFloat(sel.getAttribute('data-price')) || 0;
        label = sel.getAttribute('data-label') || label;
        maxQty = maxQtyForTier(sel);
        if (qty > maxQty) qty = maxQty;
      }
      update();
    };

    const buy = document.getElementById('buy-btn');
    const appForm = document.getElementById('seat-application-form');
    const appBack = document.getElementById('application-back-btn');

    loadCheckoutSessionUser().then(function () {
      update();
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
        if (!paid && needsCheckoutDetailsStep(ev, qty)) {
          attendee = readCheckoutDetails(qty);
        } else {
          attendee = readPaidCheckoutAttendee(qty);
        }
      } catch (err) {
        throw err;
      }

      if (!paid) {
        setCheckoutSubmitting(true, 'Registering…');
        try {
          await completeFreeBooking(ev, ticketId, qty, attendee, seriesCheckoutOptions());
        } catch (err) {
          setCheckoutSubmitting(false);
          throw err;
        }
        return;
      }

      setCheckoutSubmitting(true, 'Redirecting to payment…');
      try {
        await startPaidCheckout(ev, ticketId, qty, attendee, seriesCheckoutOptions());
      } catch (err) {
        setCheckoutSubmitting(false);
        throw err;
      }
    }

    if (checkoutForm) {
      checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (checkoutForm.classList.contains('is-checkout-details')) {
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
            if (await showAlreadyGoingInsteadOfAlert(activeEvent(), err)) return;
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
        if (registrationIsConfirmedGoing(eventApplicationState)) {
          await refreshEventApplicationUi(evNow);
          return;
        }
        if (
          (evNow?.isApprovalRequired || eventIsCategoryExclusivity(evNow)) &&
          !isRosterMemberForEvent()
        ) {
          if (applicationBlocksReapply(eventApplicationState)) {
            await refreshEventApplicationUi(evNow);
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
          if (needsCheckoutDetailsStep(evNow, qty)) {
            renderCheckoutGuestNames(qty);
            renderCheckoutAttendeeExtras(evNow);
            updateFreeCheckoutSummary(evNow);
            await prefillCheckoutDetails();
            showPaidGuestCheckout(true, false, qty);
            return;
          }
          try {
            await processCheckoutBooking(false);
          } catch (err) {
            if (await showAlreadyGoingInsteadOfAlert(evNow, err)) return;
            window.alert(
              err && err.message ? err.message : 'Could not complete your registration. Please try again.'
            );
          }
          return;
        }

        const termsAgree = document.getElementById('checkout-terms-agree');
        if (termsAgree && !termsAgree.checked) {
          revealPaidCheckoutTerms();
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

        if (needsCheckoutDetailsStep(evNow, qty)) {
          renderCheckoutGuestNames(qty);
          renderCheckoutAttendeeExtras(evNow);
          await prefillCheckoutDetails();
          showPaidGuestCheckout(true, true, qty);
          return;
        }

        try {
          await processCheckoutBooking(true);
        } catch (err) {
          if (await showAlreadyGoingInsteadOfAlert(evNow, err)) return;
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
        if (isRosterMemberForEvent() && eventIsCategoryExclusivity(eventForResume)) {
          // Fall through to normal checkout for members.
        } else {
          showSeatApplication(true);
          const industry = document.getElementById('apply-industry');
          if (industry) industry.focus();
          return;
        }
      }

      update();
      const notice = document.getElementById('checkout-resume-notice');
      const noticeText = document.getElementById('checkout-resume-notice-text');
      if (notice && noticeText) {
        const tierEl = getSelectedTierEl();
        const tierPrice = tierEl ? parseFloat(tierEl.getAttribute('data-price')) || 0 : price;
        const isFreeCheckout = tierPrice <= 0;
        const buyBtn = document.getElementById('buy-btn');
        const btnLabel =
          (buyBtn && buyBtn.textContent.trim()) ||
          (isFreeCheckout ? 'Get free ticket' : 'Buy ticket');
        const step = isFreeCheckout ? 'complete your registration' : 'continue to payment';
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
  var LOAD_OVERLAY_DELAY_MS = 120;

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
    let preview =
      window.hubEventPreview && window.hubEventPreview.readForRoute(route);
    if (!preview || !preview.image) {
      const seoImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (seoImage) {
        preview = {
          id: route && route.id,
          slug: route && route.slug,
          image: seoImage,
          title: document.title.replace(/\s+[–-]\s+The Networker Hub\s*$/i, ''),
        };
      }
    }
    if (preview && preview.image) {
      window.hubEventPreview.applyToOverlay('event-detail-load-overlay', preview);
      const hero = document.getElementById('ev-hero-img');
      if (hero && !hero.getAttribute('src')) {
        hero.loading = 'eager';
        hero.fetchPriority = 'high';
        hero.src = preview.image;
        hero.alt = preview.title || 'Event';
        const pos = String(preview.imagePosition || '').trim();
        if (/^\d{1,3}%\s+\d{1,3}%$/.test(pos)) {
          hero.style.objectPosition = pos;
        }
      }
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

  async function loadEventPageAds() {
    if (!window.CmsAdBlocks) return;
    const sidebarEl = document.getElementById('event-page-sidebar-ad');
    if (!sidebarEl) return;
    try {
      await window.CmsAdBlocks.loadPageCarouselAds(sidebarEl, {
        slot: 'event_page_carousel_ads',
        showPlaceholder: true,
      });
    } catch {
      /* non-fatal */
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
        ' <a href="/events/">Browse events</a></p>';
    }
    setText('ev-title', 'Event unavailable');
    setText('ev-trail-current', 'Event unavailable');
    applyEndedEventBanner(
      {},
      {
        force: true,
        title: 'Event unavailable',
        text: message || 'This listing is no longer available.',
      }
    );
  }

  function showEventSoftLanding(data) {
    const stub = data.eventStub || {};
    const title = stub.title || 'Event';
    const cancelled = data.error === 'event_cancelled';
    const ended = data.error === 'event_ended' || stub.isEventPast;
    document.title = title + ' – The Networker Hub';
    setText('ev-title', title);
    setText('ev-trail-current', title);
    const aboutLead = document.getElementById('ev-about-lead');
    if (aboutLead) {
      aboutLead.textContent = data.message || 'This event is no longer available to book.';
    }
    const aboutExtra = document.getElementById('ev-about-extra');
    if (aboutExtra) {
      aboutExtra.hidden = false;
      aboutExtra.textContent =
        'Explore upcoming networking from this organiser or across the Hub.';
    }
    applyEndedEventBanner(stub, {
      force: true,
      cancelled: cancelled,
      title: cancelled
        ? 'This event was cancelled'
        : ended
          ? 'This event has ended'
          : 'Event unavailable',
      text: data.message || '',
    });
    const buy = document.getElementById('buy-btn');
    const panel = document.getElementById('tickets');
    if (panel) panel.classList.add('is-unavailable');
    if (buy) {
      buy.disabled = true;
      buy.classList.add('cta-btn-disabled');
      buy.textContent = cancelled ? 'Cancelled' : ended ? 'Event ended' : 'Unavailable';
    }
    const tiersEl = document.getElementById('ticket-tiers');
    if (tiersEl) {
      tiersEl.innerHTML =
        '<p class="ticket-load-hint">' +
        escapeHtml(data.message || 'Tickets are not available.') +
        '</p>';
    }
    setText(
      'ev-related-title',
      stub.organiser ? 'Upcoming from ' + stub.organiser : 'Upcoming events'
    );
    if (Array.isArray(data.related) && data.related.length) {
      renderRelated(data.related, { event: stub });
    } else if (stub.organiserId) {
      loadRelatedFallback({
        id: stub.id,
        organiserId: stub.organiserId,
        organiser: stub.organiser,
      }).then(function (related) {
        renderRelated(related || [], { event: stub });
      });
    } else {
      renderRelated([], { event: stub });
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
        const prefetched = window.hubEventDetailPromise
          ? await window.hubEventDetailPromise
          : null;
        if (prefetched && prefetched.error) throw prefetched.error;
        const data = prefetched
          ? prefetched.data
          : await fetch(apiUrl).then(function (res) {
              return res.json();
            });
        if (data.event) {
          const ev = normalizeEventFlags(data.event, params);
          seriesDatesList = data.seriesDates || [];
          seriesBaseEvent = ev;
          const displayEv = enrichEventWithSeriesLocation(ev);
          currentEvent = displayEv;
          populateFromEvent(displayEv);
          const resolvedImage = window.getEventImage
            ? window.getEventImage(displayEv)
            : displayEv.photo || '';
          if (window.hubEventPreview && resolvedImage) {
            window.hubEventPreview.applyToOverlay('event-detail-load-overlay', {
              image: resolvedImage,
              imagePosition: displayEv.photoPosition || '',
              title: displayEv.title,
            });
          }
          setEventLoading(false);
          alumniInviteToken = String(params.get('alumni_token') || '').trim();
          ceMemberInviteToken = String(params.get('ce_member_token') || '').trim();
          if (eventIsGuestProgramme(displayEv)) {
            await Promise.all([
              loadGuestVisitEligibility(displayEv),
              loadRosterEligibility(displayEv),
            ]);
            syncGuestVisitStateForRosterMember();
            await ensureRosterMemberTickets(displayEv);
            renderTicketPanel(displayEv);
            setText('ev-price', publicListingPriceLabel(displayEv));
            syncTicketHeader(displayEv);
            applyTicketPanelState(displayEv);
          } else if (displayEv.alumniFastPassEnabled || alumniInviteToken) {
            await loadAlumniEligibility(displayEv);
            renderTicketPanel(displayEv);
            applyTicketPanelState(displayEv);
          } else if (displayEv.hasMembersOnlyTiers || eventIsCategoryExclusivity(displayEv)) {
            await loadRosterEligibility(displayEv);
            syncGuestVisitStateForRosterMember();
            await ensureRosterMemberTickets(displayEv);
            renderTicketPanel(displayEv);
            syncTicketHeader(displayEv);
            applyTicketPanelState(displayEv);
          }
          initTicketPanel(displayEv);
          initSeriesDatePicker(displayEv);
          initActions(displayEv);
          trackOrganiserShareLanding(displayEv);
          setEventLoading(false);
          if (eventIsGuestProgramme(displayEv)) {
            fetchSessionData().then(function (sessionData) {
              if (!sessionData || !sessionData.ok || !sessionData.user) return;
              refreshGuestProgrammeTicketPanel(displayEv);
            });
          }

          const relatedFromApi = data.related || [];
          const relatedOpts = {
            hasSeriesDates: Array.isArray(data.seriesDates) && data.seriesDates.length > 1,
            event: displayEv || ev,
          };
          if (relatedFromApi.length) {
            renderRelated(relatedFromApi, relatedOpts);
          } else if (!Object.prototype.hasOwnProperty.call(data, 'related')) {
            loadRelatedFallback(ev).then(function (related) {
              renderRelated(related, relatedOpts);
            });
          } else {
            renderRelated([], relatedOpts);
          }
          loadEventPageAds();
          return;
        }
        if (data.softLanding || data.eventStub) {
          setEventLoading(false);
          showEventSoftLanding(data);
          return;
        }
        showEventLoadError(
          data.error === 'event_ended'
            ? 'This event has ended.'
            : data.message || 'This event could not be found. It may be unpublished or removed.'
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
        renderRelated(related, { event: ev });
      } else {
        renderRelated([], { event: ev });
      }
      initTicketPanel(ev);
      initActions(ev);
      trackOrganiserShareLanding(ev);
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
