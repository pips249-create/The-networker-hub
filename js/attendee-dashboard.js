/**
 * Attendee account dashboard — /api/auth/attendee-dashboard
 */
(function () {
  const PAGE_SIZE = 5;
  const listPages = { upcoming: 1, past: 1 };
  let registrations = [];
  let cancelledBookings = [];
  let savedEvents = [];
  let savedOrganisers = [];
  let savedOpportunities = [];
  let savedOpportunitySearches = [];
  let opportunityEnquiries = [];
  let currentRoute = 'overview';
  let savedScope = 'events';
  let reviewsScope = 'pending';
  let openUtilityMenu = null;
  const REVIEW_EVENT_STORAGE_KEY = 'hub_review_event_id';

  const SUBPAGE_HEAD = {
    upcoming: {
      title: 'Upcoming events',
      sub: 'Events you are registered for or have applied to attend.',
    },
    payments: {
      title: 'Payments & receipts',
      sub: 'Booking references, amounts paid, and ticket details for your registrations.',
    },
    cancellations: {
      title: 'Cancellations & refunds',
      sub: 'Bookings you have cancelled, including refund status and amounts.',
    },
    saved: {
      title: 'Saved',
      sub: 'Events, organisers, and business opportunities you have saved while browsing. We will email you when ticket sales open for saved events, when a saved organiser lists something new, when a saved opportunity is closing soon, and when a new listing matches a saved opportunity search.',
    },
    past: {
      title: 'Past events',
      sub: 'Events you have already attended.',
    },
    'opportunity-enquiries': {
      title: 'My opportunity enquiries',
      sub: 'Messages you sent to business opportunity listings on the Hub. Organisers reply by email.',
    },
    'reviews-pending': {
      title: 'Reviews',
      sub: 'Leave feedback after events you attended, or read reviews you have already submitted.',
    },
    'reviews-done': {
      title: 'Reviews',
      sub: 'Leave feedback after events you attended, or read reviews you have already submitted.',
    },
    reviews: {
      title: 'Reviews',
      sub: 'Leave feedback after events you attended, or read reviews you have already submitted.',
    },
  };

  const signin = document.getElementById('ad-signin');
  const shell = document.getElementById('ad-shell');

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function formatDateShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatDateTimeLong(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const date = d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return date + ' at ' + time;
  }

  function formatAmountPaid(amount, status) {
    const paymentStatus = String(status || '').trim();
    if (paymentStatus === 'Free') return 'Free';
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return 'Free';
    return n % 1 === 0 ? '£' + n.toFixed(0) : '£' + n.toFixed(2);
  }

  function isRegistrationPaid(reg) {
    const payment = String(reg?.paymentStatus || 'Pending').trim();
    if (payment === 'Paid' || payment === 'Free') return true;
    const amount = Number(reg?.amountPaid);
    return Number.isFinite(amount) && amount > 0;
  }

  function needsBookingAction(reg) {
    if (isRegistrationPaid(reg)) return false;
    return Boolean(reg?.needsPayment || reg?.needsFreeConfirmation);
  }

  function bookingActionLabel(reg) {
    if (reg?.needsFreeConfirmation) return 'Confirm registration';
    return 'Complete payment';
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
      stripe_not_configured: 'Card checkout is not set up yet. Please try again later or contact support.',
      stripe_connect_required:
        'The organiser has not finished payout setup. Ticket sales are temporarily unavailable.',
      free_ticket_use_complete_booking: 'This is a free ticket — no payment is required.',
      not_authenticated: 'Please sign in to complete your booking.',
      registration_not_found: 'We could not find that booking. Refresh the page and try again.',
      registration_not_approved: 'Your application must be approved before you can complete your booking.',
      registration_already_paid: 'This booking is already paid.',
      registration_email_mismatch: 'This booking belongs to a different email address.',
      booking_failed: 'Could not complete your booking. Please try again.',
      checkout_failed: 'Could not start checkout. Please try again.',
    };
    if (data && data.message) return String(data.message);
    if (messages[code]) return messages[code];
    if (code) return 'Checkout could not start (' + code + '). Please try again.';
    return 'Could not complete your booking. Please try again or contact support.';
  }

  async function completeFreeRegistration(reg) {
    const res = await fetch('/api/auth/complete-booking', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: reg.eventId,
        ticketId: reg.ticketId || null,
        registrationId: reg.id,
        qty: 1,
        amountPaid: 0,
        paymentStatus: 'Free',
      }),
    });
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok || !data.ok) {
      throw new Error(checkoutErrorMessage(data));
    }
    return data;
  }

  async function startRegistrationCheckout(reg) {
    const res = await fetch('/api/auth/create-checkout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: reg.eventId,
        ticketId: reg.ticketId || null,
        registrationId: reg.id,
        qty: 1,
      }),
    });
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok || !data.ok) {
      if (data.error === 'free_ticket_use_complete_booking') {
        return completeFreeRegistration(reg);
      }
      throw new Error(checkoutErrorMessage(data));
    }
    if (data.completed) return data;
    if (!data.url) throw new Error(checkoutErrorMessage(data));
    try {
      sessionStorage.setItem(
        'hub_booking_pending',
        JSON.stringify({
          eventId: reg.eventId,
          ticketId: reg.ticketId || null,
          registrationId: reg.id,
          qty: 1,
          email: String(reg.email || '').trim().toLowerCase(),
          name: String(reg.name || '').trim(),
          eventTitle: String(reg.eventTitle || '').trim(),
          ts: Date.now(),
        })
      );
    } catch (e) {
      /* ignore */
    }
    window.location.assign(data.url);
    return data;
  }

  async function finishRegistrationBooking(reg, payBtn) {
    const isFree = Boolean(reg.needsFreeConfirmation);
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.textContent = isFree ? 'Confirming…' : 'Redirecting…';
    }
    try {
      const result = isFree ? await completeFreeRegistration(reg) : await startRegistrationCheckout(reg);
      if (result && !result.url) {
        await reloadDashboard();
        const updated = findRegistrationById(reg.id);
        if (updated) openPaymentModal(updated);
        else closePaymentModal();
        showAdToast('Your place is confirmed.');
      }
    } catch (err) {
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.textContent = bookingActionLabel(reg);
      }
      window.alert(err.message || 'Could not complete your booking. Please try again.');
    }
  }

  function formatBookingReference(registrationId) {
    const raw = String(registrationId || '')
      .replace(/-/g, '')
      .toUpperCase();
    if (raw.length >= 8) return 'HUB-' + raw.slice(0, 8);
    if (raw) return 'HUB-' + raw;
    return '—';
  }

  function formatTimeRange(startRaw, endRaw) {
    if (!startRaw) return '—';
    const start = new Date(startRaw);
    if (Number.isNaN(start.getTime())) return '—';
    const fmt = (d) =>
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (endRaw) {
      const end = new Date(endRaw);
      if (!Number.isNaN(end.getTime())) return fmt(start) + '–' + fmt(end);
    }
    return fmt(start);
  }

  function isUpcoming(reg) {
    if (!reg.date) return true;
    const t = new Date(reg.date).getTime();
    return !Number.isNaN(t) && t >= Date.now();
  }

  function upcomingList() {
    return registrations.filter(isUpcoming);
  }

  function pastList() {
    return registrations.filter((r) => !isUpcoming(r));
  }

  function pendingReviewsList() {
    return registrations.filter((r) => r.reviewStatus === 'pending');
  }

  function doneReviewsList() {
    return registrations.filter((r) => r.reviewStatus === 'reviewed');
  }

  function thumbHtml(item) {
    const name = item.title || '?';
    let imageUrl = item.imageUrl || '';
    if (global.getEventImage) {
      imageUrl = global.getEventImage({
        photo: imageUrl,
        organiserLogo: item.organiserLogo || '',
        id: item.eventId || item.id,
        eventType: item.eventType || '',
        title: name,
      });
    } else if (global.getFlexibleEventImage) {
      imageUrl = global.getFlexibleEventImage(
        imageUrl,
        item.organiserLogo || '',
        item.eventId || item.id
      );
    }
    const logo = String(item.organiserLogo || '').trim();
    if (
      logo &&
      imageUrl === logo &&
      global.getEventPlacementImage &&
      global.hubIsLogoStyleCover
    ) {
      imageUrl = global.getEventPlacementImage(item.eventId || item.id, item.eventType || '', name);
    }
    if (imageUrl) {
      return (
        '<img class="ad-thumb" src="' +
        esc(imageUrl) +
        '" alt="" width="44" height="44" loading="lazy" />'
      );
    }
    const letter = String(name).trim().charAt(0).toUpperCase() || '?';
    return '<div class="ad-thumb-placeholder" aria-hidden="true">' + esc(letter) + '</div>';
  }

  function reviewBadge(status, reg) {
    if (status === 'reviewed') {
      const stars = reg && reg.rating ? ' · ' + reg.rating + '★' : '';
      const reply =
        reg && reg.organiserResponse && String(reg.organiserResponse).trim()
          ? ' · Reply'
          : '';
      return '<span class="ad-badge ad-badge-green">✓ Reviewed' + esc(stars + reply) + '</span>';
    }
    if (status === 'pending') {
      return '<span class="ad-badge ad-badge-red">⚠ Pending</span>';
    }
    if (status === 'ineligible') {
      return '<span class="ad-badge ad-badge-grey">—</span>';
    }
    return '<span class="ad-badge ad-badge-grey">Upcoming</span>';
  }

  function paymentBadge(status, reg) {
    if (reg && reg.isCancelled) {
      return refundStatusBadge(reg);
    }
    if (reg && String(reg.applicationStatus || '').trim() === 'Pending') {
      return '<span class="ad-badge ad-badge-grey">—</span>';
    }
    const s = String(status || 'Pending');
    if (s === 'Paid' || s === 'Free') {
      return '<span class="ad-badge ad-badge-green">' + esc(s) + '</span>';
    }
    if (s === 'Refunded') {
      return '<span class="ad-badge ad-badge-grey">' + esc(s) + '</span>';
    }
    return '<span class="ad-badge ad-badge-red">' + esc(s) + '</span>';
  }

  function refundStatusBadge(reg) {
    const status = String(reg?.refundStatus || '').trim();
    if (status === 'pending') {
      return '<span class="ad-badge ad-badge-gold">Refund on its way</span>';
    }
    if (status === 'completed') {
      return '<span class="ad-badge ad-badge-green">Refunded</span>';
    }
    if (Number(reg?.amountPaid) > 0) {
      return '<span class="ad-badge ad-badge-grey">No refund due</span>';
    }
    return '<span class="ad-badge ad-badge-grey">Cancelled</span>';
  }

  function pendingRefundBookings() {
    return (cancelledBookings || []).filter((row) => row.refundStatus === 'pending');
  }

  function renderRefundAlerts() {
    const pending = pendingRefundBookings();
    const message =
      pending.length === 1
        ? 'A refund for your cancelled booking is on its way to your original payment method. Allow 5–10 business days.'
        : pending.length + ' refunds for cancelled bookings are on their way to your original payment methods. Allow 5–10 business days.';

    ['ad-refund-alert-overview', 'ad-refund-alert-payments', 'ad-refund-alert-cancellations'].forEach(
      function (id) {
        const el = document.getElementById(id);
        if (!el) return;
        if (!pending.length) {
          el.hidden = true;
          el.textContent = '';
          return;
        }
        el.hidden = false;
        el.textContent = message;
      }
    );
  }

  function hasApplicationDecision(reg) {
    const status = String(reg?.applicationStatus || 'Approved').trim();
    return status === 'Pending' || status === 'Denied' || needsBookingAction(reg);
  }

  function applicationStatusLabel(reg) {
    const status = String(reg?.applicationStatus || 'Approved').trim();
    const payment = String(reg?.paymentStatus || 'Pending').trim();
    if (status === 'Pending') return 'Pending review';
    if (status === 'Denied') return 'Not approved';
    if (status === 'Approved' && reg?.needsPayment) return 'Approved — payment due';
    if (status === 'Approved' && reg?.needsFreeConfirmation) return 'Approved — confirm your place';
    if (status === 'Approved' && (payment === 'Paid' || payment === 'Free')) return 'Approved';
    return '—';
  }

  function applicationStatusLead(reg) {
    const status = String(reg?.applicationStatus || 'Approved').trim();
    const payment = String(reg?.paymentStatus || 'Pending').trim();
    if (status === 'Pending') {
      return 'Your application is with the organiser. We will email you when they approve or deny it.';
    }
    if (status === 'Denied') {
      return 'The organiser did not approve your application for this event.';
    }
    if (status === 'Approved' && reg?.needsPayment) {
      return 'Good news — you are approved. Complete payment below to secure your seat.';
    }
    if (status === 'Approved' && reg?.needsFreeConfirmation) {
      return 'Good news — you are approved. Confirm your registration below to secure your place.';
    }
    if (status === 'Approved' && (payment === 'Paid' || payment === 'Free')) {
      return 'Your application was approved and your place is confirmed.';
    }
    return '';
  }

  function applicationBadge(reg) {
    if (!hasApplicationDecision(reg)) {
      return '<span class="ad-badge ad-badge-grey">—</span>';
    }
    const status = String(reg.applicationStatus || 'Approved').trim();
    if (status === 'Pending') {
      return '<span class="ad-badge ad-badge-gold">Pending review</span>';
    }
    if (status === 'Denied') {
      return '<span class="ad-badge ad-badge-red">Not approved</span>';
    }
    if (needsBookingAction(reg)) {
      return (
        '<span class="ad-badge ad-badge-gold">' +
        esc(reg.needsFreeConfirmation ? 'Approved — confirm place' : 'Approved — pay now') +
        '</span>'
      );
    }
    if (status === 'Approved') {
      return '<span class="ad-badge ad-badge-green">Approved</span>';
    }
    return '<span class="ad-badge ad-badge-grey">—</span>';
  }

  function eventHref(reg) {
    const slug = reg.slug ? String(reg.slug).trim() : '';
    if (slug) return '../events/' + encodeURIComponent(slug);
    return '../events/event.html?id=' + encodeURIComponent(reg.eventId || reg.id || '');
  }

  function joinLinkHtml(reg) {
    const link = String(reg.meetingLink || '').trim();
    if (!reg.isOnline || !link) return '';
    const safe = esc(link);
    return (
      '<a class="ad-join-link" href="' +
      safe +
      '" target="_blank" rel="noopener noreferrer">Join online</a>'
    );
  }

  function eventTitleCell(reg) {
    const title = reg.title || 'Event';
    const join = joinLinkHtml(reg);
    return (
      '<a class="ad-event-link" href="' +
      esc(eventHref(reg)) +
      '">' +
      esc(title) +
      '</a>' +
      (join ? '<div class="ad-event-join">' + join + '</div>' : '')
    );
  }

  function ticketButtonHtml(reg) {
    const pending = String(reg.applicationStatus || '').trim() === 'Pending';
    const denied = String(reg.applicationStatus || '').trim() === 'Denied';
    const label = pending ? 'View application' : denied ? 'Application details' : 'View ticket';
    return (
      '<button type="button" class="ad-btn ad-btn-primary ad-view-payment" data-registration-id="' +
      esc(reg.id || '') +
      '">' +
      esc(label) +
      '</button>'
    );
  }

  function actionCell(reg, options) {
    const opts = options || {};
    const applicationStatus = String(reg.applicationStatus || 'Approved').trim();

    if (applicationStatus === 'Denied') {
      return (
        '<a class="ad-btn ad-btn-primary" href="' +
        esc(eventHref(reg)) +
        '">View event</a>'
      );
    }

    if (needsBookingAction(reg)) {
      return (
        '<div class="ad-action-group">' +
        '<button type="button" class="ad-btn ad-btn-gold ad-view-payment" data-registration-id="' +
        esc(reg.id || '') +
        '">' +
        esc(bookingActionLabel(reg)) +
        '</button>' +
        '<a class="ad-action-link" href="' +
        esc(eventHref(reg)) +
        '">View event</a>' +
        '</div>'
      );
    }

    if (applicationStatus === 'Pending') {
      return (
        '<div class="ad-action-group">' +
        ticketButtonHtml(reg) +
        '<a class="ad-action-link" href="' +
        esc(eventHref(reg)) +
        '">View event</a>' +
        '</div>'
      );
    }
    if (reg.reviewStatus === 'pending') {
      return (
        '<button type="button" class="ad-btn ad-btn-gold ad-leave-review" data-event-id="' +
        esc(reg.eventId || '') +
        '" data-event-title="' +
        esc(reg.title || 'Event') +
        '" data-organiser-name="' +
        esc(reg.organiserName || 'the organiser') +
        '">Leave Review</button>'
      );
    }
    if (reg.reviewStatus === 'reviewed') {
      const hasReply = reg.organiserResponse && String(reg.organiserResponse).trim();
      return (
        '<button type="button" class="ad-btn ad-view-review' +
        (hasReply ? ' ad-view-review-has-reply' : '') +
        '" data-event-id="' +
        esc(reg.eventId || '') +
        '" data-event-title="' +
        esc(reg.title || 'Event') +
        '" data-organiser-name="' +
        esc(reg.organiserName || 'the organiser') +
        '">' +
        (hasReply ? 'View reply' : 'View review') +
        '</button>'
      );
    }
    if (opts.showCancel && reg.canCancel) {
      return (
        '<div class="ad-action-group">' +
        ticketButtonHtml(reg) +
        '<div class="ad-action-links">' +
        '<a class="ad-action-link" href="' +
        esc(eventHref(reg)) +
        '">View event</a>' +
        '<button type="button" class="ad-action-link ad-action-link--danger ad-cancel-booking" data-registration-id="' +
        esc(reg.id || '') +
        '">Cancel booking</button>' +
        '</div></div>'
      );
    }
    if (opts.showTicket) {
      return (
        '<div class="ad-action-group">' +
        ticketButtonHtml(reg) +
        '<a class="ad-action-link" href="' +
        esc(eventHref(reg)) +
        '">View event</a>' +
        '</div>'
      );
    }
    return (
      '<a class="ad-btn ad-btn-primary" href="' +
      esc(eventHref(reg)) +
      '">View event</a>'
    );
  }

  function registrationHasTicketPdf(reg) {
    const applicationStatus = String(reg?.applicationStatus || 'Approved').trim();
    if (applicationStatus === 'Denied' || applicationStatus === 'Pending') return false;
    if (needsBookingAction(reg)) return false;
    return true;
  }

  function registrationCalendarEvent(reg) {
    return {
      id: reg.eventId || reg.id,
      slug: reg.slug || '',
      title: reg.title || 'Event',
      starts_at: reg.date || '',
      ends_at: reg.endDate || '',
      location: reg.isOnline ? 'Online' : '',
    };
  }

  function utilityDropdownHtml(reg, options) {
    if (!options || !options.showUtilities) return '';
    const canPdf = registrationHasTicketPdf(reg);
    return (
      '<div class="ad-utility-wrap">' +
      '<button type="button" class="ad-utility-btn" data-ad-utility-toggle aria-expanded="false" aria-haspopup="true">' +
      'Utilities <span class="ad-utility-chev" aria-hidden="true">▾</span></button>' +
      '<div class="ad-utility-menu" role="menu" hidden>' +
      '<button type="button" class="ad-utility-item ad-download-ticket-pdf" role="menuitem" data-registration-id="' +
      esc(reg.id || '') +
      '"' +
      (canPdf ? '' : ' disabled') +
      '>Download Ticket (PDF)</button>' +
      '<button type="button" class="ad-utility-item ad-download-calendar-ics" role="menuitem" data-registration-id="' +
      esc(reg.id || '') +
      '">Add to Calendar (.ics)</button>' +
      '</div></div>'
    );
  }

  function closeUtilityMenus() {
    document.querySelectorAll('.ad-utility-menu.is-open').forEach((menu) => {
      menu.hidden = true;
      menu.classList.remove('is-open', 'is-floating');
      menu.style.top = '';
      menu.style.left = '';
      menu.style.right = '';
    });
    document.querySelectorAll('[data-ad-utility-toggle][aria-expanded="true"]').forEach((btn) => {
      btn.setAttribute('aria-expanded', 'false');
    });
    openUtilityMenu = null;
  }

  function positionUtilityMenu(btn, menu) {
    const rect = btn.getBoundingClientRect();
    menu.classList.add('is-floating');
    menu.hidden = false;
    menu.classList.add('is-open');
    menu.style.top = Math.round(rect.bottom + 4) + 'px';
    menu.style.left = 'auto';
    menu.style.right = Math.max(8, window.innerWidth - rect.right) + 'px';
  }

  function bindUtilityMenus(root) {
    (root || document).querySelectorAll('[data-ad-utility-toggle]').forEach((btn) => {
      if (btn.dataset.boundUtility) return;
      btn.dataset.boundUtility = '1';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wrap = btn.closest('.ad-utility-wrap');
        const menu = wrap && wrap.querySelector('.ad-utility-menu');
        if (!menu) return;
        const isOpen = menu.classList.contains('is-open');
        closeUtilityMenus();
        if (!isOpen) {
          positionUtilityMenu(btn, menu);
          btn.setAttribute('aria-expanded', 'true');
          openUtilityMenu = menu;
        }
      });
    });

    (root || document).querySelectorAll('.ad-download-ticket-pdf').forEach((btn) => {
      if (btn.dataset.boundTicketPdf) return;
      btn.dataset.boundTicketPdf = '1';
      btn.addEventListener('click', () => {
        const regId = btn.getAttribute('data-registration-id');
        if (!regId || btn.disabled) return;
        closeUtilityMenus();
        window.open(
          '/api/auth/registration-ticket-pdf?registrationId=' + encodeURIComponent(regId),
          '_blank',
          'noopener,noreferrer'
        );
      });
    });

    (root || document).querySelectorAll('.ad-download-calendar-ics').forEach((btn) => {
      if (btn.dataset.boundCalendarIcs) return;
      btn.dataset.boundCalendarIcs = '1';
      btn.addEventListener('click', () => {
        const regId = btn.getAttribute('data-registration-id');
        const reg = findRegistrationById(regId);
        if (!reg) return;
        closeUtilityMenus();
        if (!window.HubCalendarShare) return;
        const links = HubCalendarShare.buildCalendarLinks(registrationCalendarEvent(reg));
        HubCalendarShare.downloadIcs(links.icsContent, links.icsFilename);
      });
    });
  }

  function isReviewsRoute(route) {
    return route === 'reviews' || route === 'reviews-pending' || route === 'reviews-done';
  }

  function reviewsScopeFromRoute(route) {
    if (route === 'reviews-done') return 'done';
    return 'pending';
  }

  function reviewsRouteFromScope(scope) {
    return scope === 'done' ? 'reviews-done' : 'reviews-pending';
  }

  function layoutRouteKey(route) {
    if (isReviewsRoute(route)) return 'reviews';
    return route;
  }

  function pageRouteKey(route) {
    if (isReviewsRoute(route)) return 'reviews';
    return route;
  }

  function invoiceDownloadHref(reg) {
    return '/api/auth/registration-invoice?registrationId=' + encodeURIComponent(reg.id || '');
  }

  function updateLayoutHeader(route) {
    const overviewHeader = document.getElementById('ad-overview-header');
    const subpageHead = document.getElementById('ad-subpage-head');
    const titleEl = document.getElementById('ad-subpage-title');
    const subEl = document.getElementById('ad-subpage-sub');
    const isOverview = route === 'overview';
    const meta = SUBPAGE_HEAD[layoutRouteKey(route)] || SUBPAGE_HEAD[route] || null;

    if (overviewHeader) overviewHeader.classList.toggle('is-hidden', !isOverview);
    if (subpageHead) subpageHead.hidden = isOverview;
    if (!isOverview && meta) {
      if (titleEl) titleEl.textContent = meta.title;
      if (subEl) subEl.textContent = meta.sub;
    }
  }

  function setReviewsScope(scope) {
    reviewsScope = scope || 'pending';
    document.querySelectorAll('[data-reviews-scope]').forEach((btn) => {
      const active = btn.getAttribute('data-reviews-scope') === reviewsScope;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-reviews-pane]').forEach((pane) => {
      const active = pane.getAttribute('data-reviews-pane') === reviewsScope;
      pane.classList.toggle('is-active', active);
      pane.hidden = !active;
    });
  }

  function bindReviewsScope() {
    document.querySelectorAll('[data-reviews-scope]').forEach((btn) => {
      if (btn.dataset.boundReviewsScope) return;
      btn.dataset.boundReviewsScope = '1';
      btn.addEventListener('click', () => {
        const scope = btn.getAttribute('data-reviews-scope') || 'pending';
        setRoute(reviewsRouteFromScope(scope));
      });
    });
    setReviewsScope(reviewsScope);
  }

  function maybeDefaultSavedScope() {
    if (currentRoute !== 'saved' || savedScope !== 'events') return;
    const hasEvents = savedEvents.length > 0;
    const hasOrganisers = savedOrganisers.length > 0;
    const hasOpportunities = savedOpportunities.length > 0;
    if (!hasEvents && !hasOrganisers && hasOpportunities) {
      setSavedScope('opportunities');
    }
  }

  function setSavedScope(scope) {
    savedScope = scope || 'events';
    document.querySelectorAll('[data-saved-scope]').forEach((btn) => {
      const active = btn.getAttribute('data-saved-scope') === savedScope;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-saved-pane]').forEach((pane) => {
      const active = pane.getAttribute('data-saved-pane') === savedScope;
      pane.classList.toggle('is-active', active);
      pane.hidden = !active;
    });
    const toolbar = document.getElementById('ad-saved-opp-toolbar');
    if (toolbar) {
      toolbar.hidden = savedScope !== 'opportunities' || !savedOpportunities.length;
    }
  }

  function bindSavedScope() {
    document.querySelectorAll('[data-saved-scope]').forEach((btn) => {
      if (btn.dataset.boundSavedScope) return;
      btn.dataset.boundSavedScope = '1';
      btn.addEventListener('click', () => {
        setSavedScope(btn.getAttribute('data-saved-scope') || 'events');
      });
    });
    setSavedScope(savedScope);
  }

  let reviewRating = 0;
  let reviewModalOpen = false;
  let viewReviewModalOpen = false;
  let paymentModalOpen = false;
  let cancelModalOpen = false;
  let pendingCancelRegistration = null;
  let highlightRegistrationId = '';
  let dashboardReady = false;
  let renderedRoutes = new Set();

  function setDashboardLoading(on) {
    const el = document.getElementById('ad-dash-loading');
    if (el) {
      el.hidden = !on;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
      el.setAttribute('aria-busy', on ? 'true' : 'false');
    }
    if (shell) shell.classList.toggle('ad-shell--loading', on);
    document.body.classList.toggle('hub-is-page-loading', on);
  }

  function setReviewStars(rating) {
    reviewRating = rating;
    const stars = document.querySelectorAll('#ad-review-stars .ad-review-star');
    stars.forEach((btn) => {
      const n = Number(btn.getAttribute('data-rating'));
      btn.classList.toggle('is-active', n <= rating);
      btn.setAttribute('aria-checked', n === rating ? 'true' : 'false');
    });
  }

  function showReviewFeedbackStep() {
    const feedbackStep = document.getElementById('ad-review-feedback-step');
    const submitBtn = document.getElementById('ad-review-submit');
    const hint = document.getElementById('ad-review-rating-hint');
    const text = document.getElementById('ad-review-text');
    if (feedbackStep) feedbackStep.hidden = false;
    if (submitBtn) submitBtn.hidden = false;
    if (hint) hint.hidden = true;
    if (text) text.focus();
  }

  function resetReviewFeedbackStep() {
    const feedbackStep = document.getElementById('ad-review-feedback-step');
    const submitBtn = document.getElementById('ad-review-submit');
    const hint = document.getElementById('ad-review-rating-hint');
    if (feedbackStep) feedbackStep.hidden = true;
    if (submitBtn) submitBtn.hidden = true;
    if (hint) hint.hidden = false;
  }

  function starsHtml(rating) {
    const n = Math.max(0, Math.min(5, Number(rating) || 0));
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += '<span class="ad-view-review-star' + (i <= n ? ' is-active' : '') + '">★</span>';
    }
    return html;
  }

  function openReviewModal(reg) {
    const modal = document.getElementById('ad-review-modal');
    const sub = document.getElementById('ad-review-modal-sub');
    const eventIdInput = document.getElementById('ad-review-event-id');
    const text = document.getElementById('ad-review-text');
    const err = document.getElementById('ad-review-error');
    if (!modal || !eventIdInput) return;

    if (sub) {
      const org = reg.organiserName ? String(reg.organiserName).trim() : 'the organiser';
      sub.textContent =
        'Share feedback about ' +
        org +
        ' after attending “' +
        (reg.title || 'Event') +
        '”. Your review appears on their organiser profile.';
    }
    eventIdInput.value = reg.eventId || '';
    if (text) text.value = '';
    if (err) err.hidden = true;
    setReviewStars(0);
    resetReviewFeedbackStep();
    modal.hidden = false;
    reviewModalOpen = true;
    document.body.classList.add('ad-review-modal-open');
  }

  function closeReviewModal() {
    const modal = document.getElementById('ad-review-modal');
    if (modal) modal.hidden = true;
    reviewModalOpen = false;
    document.body.classList.remove('ad-review-modal-open');
    resetReviewFeedbackStep();
  }

  function findRegistrationByEventId(eventId) {
    const key = String(eventId || '').trim();
    if (!key) return null;
    for (let i = 0; i < registrations.length; i++) {
      if (String(registrations[i].eventId) === key) return registrations[i];
    }
    return null;
  }

  function openViewReviewModal(reg) {
    const modal = document.getElementById('ad-view-review-modal');
    const sub = document.getElementById('ad-view-review-modal-sub');
    const starsEl = document.getElementById('ad-view-review-stars');
    const feedbackBlock = document.getElementById('ad-view-review-feedback-block');
    const feedbackText = document.getElementById('ad-view-review-text');
    const organiserBlock = document.getElementById('ad-view-review-organiser-block');
    const organiserLabel = document.getElementById('ad-view-review-organiser-label');
    const organiserText = document.getElementById('ad-view-review-organiser-text');
    const eventLink = document.getElementById('ad-view-review-event-link');
    if (!modal || !reg) return;

    const org = reg.organiserName ? String(reg.organiserName).trim() : 'the organiser';
    if (sub) {
      sub.textContent =
        'Your review for “' + (reg.title || 'Event') + '” with ' + org + '.';
    }
    if (starsEl) starsEl.innerHTML = starsHtml(reg.rating);

    const reviewBody = reg.reviewText ? String(reg.reviewText).trim() : '';
    if (feedbackBlock && feedbackText) {
      if (reviewBody) {
        feedbackText.textContent = reviewBody;
        feedbackBlock.hidden = false;
      } else {
        feedbackBlock.hidden = true;
      }
    }

    const reply = reg.organiserResponse ? String(reg.organiserResponse).trim() : '';
    if (organiserBlock && organiserLabel && organiserText) {
      organiserBlock.classList.toggle('has-response', Boolean(reply));
      if (reply) {
        organiserLabel.textContent = 'Response from ' + org;
        organiserText.textContent = reply;
      } else {
        organiserLabel.textContent = 'Organiser response';
        organiserText.textContent = 'No response from the organiser yet.';
      }
    }

    if (eventLink) eventLink.href = eventHref(reg);

    modal.hidden = false;
    viewReviewModalOpen = true;
    document.body.classList.add('ad-view-review-modal-open');
  }

  function closeViewReviewModal() {
    const modal = document.getElementById('ad-view-review-modal');
    if (modal) modal.hidden = true;
    viewReviewModalOpen = false;
    document.body.classList.remove('ad-view-review-modal-open');
  }

  function bindReviewModal() {
    const modal = document.getElementById('ad-review-modal');
    const backdrop = document.getElementById('ad-review-modal-backdrop');
    const closeBtn = document.getElementById('ad-review-modal-close');
    const cancelBtn = document.getElementById('ad-review-cancel');
    const changeRatingBtn = document.getElementById('ad-review-change-rating');
    const form = document.getElementById('ad-review-form');
    const stars = document.getElementById('ad-review-stars');

    [backdrop, closeBtn, cancelBtn].forEach((el) => {
      if (!el) return;
      el.addEventListener('click', closeReviewModal);
    });

    if (changeRatingBtn) {
      changeRatingBtn.addEventListener('click', () => {
        resetReviewFeedbackStep();
        const firstStar = stars && stars.querySelector('.ad-review-star');
        if (firstStar) firstStar.focus();
      });
    }

    if (stars) {
      stars.querySelectorAll('.ad-review-star').forEach((btn) => {
        btn.addEventListener('click', () => {
          setReviewStars(Number(btn.getAttribute('data-rating')) || 0);
          showReviewFeedbackStep();
        });
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && reviewModalOpen) closeReviewModal();
      if (e.key === 'Escape' && viewReviewModalOpen) closeViewReviewModal();
    });

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = document.getElementById('ad-review-error');
        const submitBtn = document.getElementById('ad-review-submit');
        const eventId = document.getElementById('ad-review-event-id')?.value || '';
        const reviewText = document.getElementById('ad-review-text')?.value?.trim() || '';

        if (err) err.hidden = true;
        if (!reviewRating) {
          if (err) {
            err.textContent = 'Please choose a star rating.';
            err.hidden = false;
          }
          return;
        }

        if (submitBtn) submitBtn.disabled = true;
        try {
          const res = await fetch('/api/auth/reviews', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventId,
              rating: reviewRating,
              reviewText,
            }),
          });
          const data = await res.json();
          if (!data.ok) {
            const msg =
              data.error === 'not_eligible'
                ? 'Only confirmed ticket holders can leave a review for this event.'
                : data.error === 'review_already_submitted'
                  ? 'You have already reviewed this event.'
                  : data.error === 'event_not_finished'
                    ? 'You can leave a review after the event has finished.'
                    : data.message || data.error || 'Could not submit review.';
            if (err) {
              err.textContent = msg;
              err.hidden = false;
            }
            return;
          }
          closeReviewModal();
          await reloadDashboard();
        } catch {
          if (err) {
            err.textContent = 'Something went wrong. Please try again.';
            err.hidden = false;
          }
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }
  }

  function bindLeaveReviewButtons(root) {
    (root || document).querySelectorAll('.ad-leave-review').forEach((btn) => {
      btn.addEventListener('click', () => {
        openReviewModal({
          eventId: btn.getAttribute('data-event-id'),
          title: btn.getAttribute('data-event-title'),
          organiserName: btn.getAttribute('data-organiser-name'),
        });
      });
    });
  }

  function bindViewReviewModal() {
    const backdrop = document.getElementById('ad-view-review-modal-backdrop');
    const closeBtn = document.getElementById('ad-view-review-modal-close');
    const closeFooterBtn = document.getElementById('ad-view-review-close');

    [backdrop, closeBtn, closeFooterBtn].forEach((el) => {
      if (!el) return;
      el.addEventListener('click', closeViewReviewModal);
    });
  }

  function bindViewReviewButtons(root) {
    (root || document).querySelectorAll('.ad-view-review').forEach((btn) => {
      btn.addEventListener('click', () => {
        const reg = findRegistrationByEventId(btn.getAttribute('data-event-id'));
        if (reg) openViewReviewModal(reg);
      });
    });
  }

  function reviewEventIdFromHash(hashRaw) {
    const hash = String(hashRaw || '').replace(/^#/, '');
    if (!hash) return '';
    if (hash.toLowerCase().startsWith('review/')) {
      return decodeURIComponent(hash.slice(7).split(/[?&]/)[0] || '').trim();
    }
    const qIndex = hash.indexOf('?');
    if (qIndex >= 0) {
      const fromHashQuery = new URLSearchParams(hash.slice(qIndex)).get('review');
      if (fromHashQuery) return String(fromHashQuery).trim();
    }
    return '';
  }

  function reviewEventIdFromLocation() {
    const fromQuery = new URLSearchParams(location.search).get('review');
    if (fromQuery) return String(fromQuery).trim();
    return reviewEventIdFromHash(location.hash);
  }

  const pendingReviewEventId = (function captureReviewIntent() {
    try {
      const id = reviewEventIdFromLocation();
      if (id) {
        sessionStorage.setItem(REVIEW_EVENT_STORAGE_KEY, id);
        return id;
      }
      return String(sessionStorage.getItem(REVIEW_EVENT_STORAGE_KEY) || '').trim();
    } catch {
      return reviewEventIdFromLocation();
    }
  })();

  function consumePendingReviewEventId() {
    const id =
      reviewEventIdFromLocation() ||
      pendingReviewEventId ||
      String(sessionStorage.getItem(REVIEW_EVENT_STORAGE_KEY) || '').trim();
    return String(id || '').trim();
  }

  function clearPendingReviewEventId() {
    try {
      sessionStorage.removeItem(REVIEW_EVENT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  function parseRoute() {
    const hash = (location.hash.replace('#', '') || 'overview').toLowerCase();
    if (hash.startsWith('review/')) return 'reviews-pending';
    const allowed = [
      'overview',
      'upcoming',
      'payments',
      'cancellations',
      'saved',
      'past',
      'opportunity-enquiries',
      'reviews',
      'reviews-pending',
      'reviews-done',
    ];
    if (hash === 'reviews') return 'reviews-pending';
    return allowed.includes(hash) ? hash : 'overview';
  }

  function findRegistrationById(id) {
    const key = String(id || '').trim();
    if (!key) return null;
    for (let i = 0; i < registrations.length; i++) {
      if (String(registrations[i].id) === key) return registrations[i];
    }
    for (let j = 0; j < (cancelledBookings || []).length; j++) {
      if (String(cancelledBookings[j].id) === key) return cancelledBookings[j];
    }
    return null;
  }

  function openPaymentModal(reg) {
    const modal = document.getElementById('ad-payment-modal');
    const sub = document.getElementById('ad-payment-modal-sub');
    const details = document.getElementById('ad-payment-details');
    const note = document.getElementById('ad-payment-note');
    const eventLink = document.getElementById('ad-payment-event-link');
    const titleEl = document.getElementById('ad-payment-modal-title');
    if (!modal || !details || !reg) return;

    const applicationStatus = String(reg.applicationStatus || 'Approved').trim();
    const applicationLead = applicationStatusLead(reg);
    const showApplication = hasApplicationDecision(reg);

    if (titleEl) {
      if (applicationStatus === 'Pending') titleEl.textContent = 'Your application';
      else if (applicationStatus === 'Denied') titleEl.textContent = 'Application update';
      else if (needsBookingAction(reg)) titleEl.textContent = reg.needsFreeConfirmation ? 'Confirm your registration' : 'Complete your booking';
      else titleEl.textContent = 'Your ticket';
    }

    if (sub) {
      if (applicationLead) {
        sub.textContent = applicationLead;
      } else {
        sub.textContent = 'Booking for “' + (reg.title || 'Event') + '”.';
      }
    }

    const paid = formatAmountPaid(reg.amountPaid, reg.paymentStatus);
    const isPaid =
      String(reg.paymentStatus || '').toLowerCase() === 'paid' ||
      (paid !== 'Free' && paid !== '—');

    let detailsHtml = '';
    if (showApplication) {
      detailsHtml +=
        '<div><dt>Application</dt><dd>' +
        applicationBadge(reg) +
        '</dd></div>';
    }
    detailsHtml +=
      '<div><dt>Booking reference</dt><dd>' +
      esc(reg.bookingReference || formatBookingReference(reg.id)) +
      '</dd></div>' +
      '<div><dt>Booked on</dt><dd>' +
      esc(formatDateTimeLong(reg.createdAt)) +
      '</dd></div>' +
      '<div><dt>Event date</dt><dd>' +
      esc(formatDateShort(reg.date)) +
      ' · ' +
      esc(formatTimeRange(reg.date, reg.endDate)) +
      '</dd></div>' +
      (reg.isOnline
        ? '<div><dt>Online access</dt><dd>' +
          (reg.meetingLink
            ? '<a href="' +
              esc(reg.meetingLink) +
              '" target="_blank" rel="noopener noreferrer">Join online</a>'
            : applicationStatus === 'Pending' || needsBookingAction(reg)
              ? 'Available after your place is confirmed.'
              : 'The organiser will email you the join link before the event starts.') +
          '</dd></div>'
        : '') +
      '<div><dt>Tickets</dt><dd>' +
      esc(reg.ticketLabel || '—') +
      '</dd></div>';

    if (applicationStatus !== 'Pending' && applicationStatus !== 'Denied') {
      detailsHtml +=
        '<div><dt>Total paid</dt><dd>' +
        esc(paid) +
        '</dd></div>' +
        '<div><dt>Payment status</dt><dd>' +
        esc(reg.paymentStatus || 'Pending') +
        '</dd></div>';
    } else if (reg.needsPayment) {
      const price =
        reg.ticketPriceNum != null && Number(reg.ticketPriceNum) > 0
          ? formatAmountPaid(reg.ticketPriceNum, 'Paid')
          : '—';
      detailsHtml +=
        '<div><dt>Price if approved</dt><dd>' +
        esc(price) +
        '</dd></div>';
    }

    details.innerHTML = detailsHtml;

    if (note) note.hidden = !isPaid;
    if (eventLink) eventLink.href = eventHref(reg);

    const payBtn = document.getElementById('ad-payment-pay-btn');
    if (payBtn) {
      const showPayAction = needsBookingAction(reg);
      payBtn.hidden = !showPayAction;
      payBtn.disabled = false;
      payBtn.textContent = bookingActionLabel(reg);
      payBtn.onclick = function () {
        finishRegistrationBooking(reg, payBtn);
      };
    }

    modal.hidden = false;
    paymentModalOpen = true;
    document.body.classList.add('ad-payment-modal-open');
  }

  function closePaymentModal() {
    const modal = document.getElementById('ad-payment-modal');
    if (modal) modal.hidden = true;
    paymentModalOpen = false;
    document.body.classList.remove('ad-payment-modal-open');
  }

  function bindPaymentModal() {
    const modal = document.getElementById('ad-payment-modal');
    const backdrop = document.getElementById('ad-payment-modal-backdrop');
    const closeBtn = document.getElementById('ad-payment-modal-close');
    const closeAction = document.getElementById('ad-payment-close');

    [backdrop, closeBtn, closeAction].forEach((el) => {
      if (!el) return;
      el.addEventListener('click', closePaymentModal);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && paymentModalOpen) closePaymentModal();
    });

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closePaymentModal();
      });
    }
  }

  function bindPaymentButtons(root) {
    (root || document).querySelectorAll('.ad-view-payment').forEach((btn) => {
      btn.addEventListener('click', () => {
        const reg = findRegistrationById(btn.getAttribute('data-registration-id'));
        if (reg) openPaymentModal(reg);
      });
    });
  }

  function buildCancelOutcomeText(reg) {
    const paid = formatAmountPaid(reg.amountPaid, reg.paymentStatus);
    const organiser = reg.organiserName ? String(reg.organiserName).trim() : 'the organiser';

    if (!reg.isPaid) {
      return 'Your place will be released. No payment was taken, so nothing needs to be refunded.';
    }
    if (reg.refundEligible) {
      return (
        'Based on ' +
        organiser +
        '\'s policy, you are eligible for a full refund of ' +
        paid +
        '. If you cancel now, your refund will be processed automatically to your original payment method within 5–10 business days.'
      );
    }
    return (
      'Based on ' +
      organiser +
      '\'s policy, no refund is due for this cancellation. Your ticket will be deactivated.'
    );
  }

  let adToastTimer = null;

  function showAdToast(message) {
    const toast = document.getElementById('ad-toast');
    if (!toast) return;
    toast.textContent = message || '';
    toast.hidden = false;
    toast.classList.add('is-visible');
    if (adToastTimer) clearTimeout(adToastTimer);
    adToastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
      toast.hidden = true;
    }, 6000);
  }

  function openCancelModal(reg) {
    const modal = document.getElementById('ad-cancel-modal');
    const sub = document.getElementById('ad-cancel-modal-sub');
    const summary = document.getElementById('ad-cancel-summary');
    const policy = document.getElementById('ad-cancel-policy');
    const policyLabel = document.getElementById('ad-cancel-policy-label');
    const policyText = document.getElementById('ad-cancel-policy-text');
    const outcome = document.getElementById('ad-cancel-outcome');
    const outcomeText = document.getElementById('ad-cancel-outcome-text');
    const disclaimer = document.getElementById('ad-cancel-disclaimer');
    const confirmLabel = document.getElementById('ad-cancel-confirm-label');
    const confirmCheck = document.getElementById('ad-cancel-confirm-check');
    const confirmBtn = document.getElementById('ad-cancel-confirm');
    const err = document.getElementById('ad-cancel-error');
    if (!modal || !reg) return;

    const isFree = !reg.isPaid;
    pendingCancelRegistration = reg;

    if (sub) {
      sub.textContent = isFree
        ? 'You\'re about to cancel your free registration for “' + (reg.title || 'Event') + '”.'
        : 'Review the organiser\'s refund policy before cancelling your booking for “' + (reg.title || 'Event') + '”.';
    }

    if (summary) {
      summary.innerHTML =
        '<div><dt>Event date</dt><dd>' +
        esc(formatDateTimeLong(reg.date)) +
        '</dd></div>' +
        '<div><dt>Tickets</dt><dd>' +
        esc(reg.ticketLabel || '—') +
        '</dd></div>' +
        '<div><dt>' +
        (isFree ? 'Ticket price' : 'Amount paid') +
        '</dt><dd>' +
        esc(formatAmountPaid(reg.amountPaid, reg.paymentStatus)) +
        '</dd></div>' +
        '<div><dt>Organiser</dt><dd>' +
        esc(reg.organiserName || '—') +
        '</dd></div>';
    }

    if (policy) policy.hidden = isFree;
    if (disclaimer) disclaimer.hidden = isFree;

    if (!isFree) {
      if (policyLabel) {
        policyLabel.textContent = reg.refundPolicyLabel || 'Refund policy';
      }
      if (policyText) {
        policyText.textContent =
          reg.refundPolicyText ||
          'No refund policy has been set for this event. Contact the organiser if you have questions.';
      }
    }

    if (outcome && outcomeText) {
      outcome.hidden = false;
      outcome.classList.remove('is-eligible', 'is-ineligible', 'is-free');
      if (isFree) outcome.classList.add('is-free');
      else if (reg.refundEligible) outcome.classList.add('is-eligible');
      else outcome.classList.add('is-ineligible');
      outcomeText.textContent = buildCancelOutcomeText(reg);
    }

    if (confirmLabel) {
      confirmLabel.textContent = isFree
        ? 'I understand this will cancel my registration and release my place.'
        : 'I understand the organiser\'s refund policy and that eligible refunds are processed automatically when I cancel.';
    }

    if (confirmCheck) confirmCheck.checked = false;
    if (confirmBtn) confirmBtn.disabled = true;
    if (err) err.hidden = true;

    modal.hidden = false;
    cancelModalOpen = true;
    document.body.classList.add('ad-cancel-modal-open');
  }

  function closeCancelModal() {
    const modal = document.getElementById('ad-cancel-modal');
    if (modal) modal.hidden = true;
    cancelModalOpen = false;
    pendingCancelRegistration = null;
    document.body.classList.remove('ad-cancel-modal-open');
  }

  function bindCancelModal() {
    const modal = document.getElementById('ad-cancel-modal');
    const backdrop = document.getElementById('ad-cancel-modal-backdrop');
    const closeBtn = document.getElementById('ad-cancel-modal-close');
    const keepBtn = document.getElementById('ad-cancel-keep');
    const confirmBtn = document.getElementById('ad-cancel-confirm');
    const confirmCheck = document.getElementById('ad-cancel-confirm-check');
    const err = document.getElementById('ad-cancel-error');

    [backdrop, closeBtn, keepBtn].forEach((el) => {
      if (!el) return;
      el.addEventListener('click', closeCancelModal);
    });

    if (confirmCheck && confirmBtn) {
      confirmCheck.addEventListener('change', () => {
        confirmBtn.disabled = !confirmCheck.checked;
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && cancelModalOpen) closeCancelModal();
    });

    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        if (!pendingCancelRegistration || !confirmCheck?.checked) return;
        if (err) err.hidden = true;
        confirmBtn.disabled = true;

        try {
          const res = await fetch('/api/auth/cancel-booking', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registrationId: pendingCancelRegistration.id }),
          });
          const data = await res.json();
          if (!data.ok) {
            const msg =
              data.message ||
              (data.error === 'not_authenticated'
                ? 'Please sign in again to cancel this booking.'
                : data.error || 'Could not cancel booking.');
            if (err) {
              err.textContent = msg;
              err.hidden = false;
            }
            confirmBtn.disabled = !confirmCheck.checked;
            return;
          }
          const wasFree = Boolean(data.isFree);
          closeCancelModal();
          await reloadDashboard();
          let toastMessage =
            data.message ||
            (wasFree ? 'Your registration has been cancelled.' : 'Your booking has been cancelled.');
          const attendeeEmail = data.emailResult;
          if (attendeeEmail && attendeeEmail.sent === false) {
            if (attendeeEmail.code === 'recipient_not_allowlisted' || /allowlist/i.test(attendeeEmail.error || '')) {
              toastMessage +=
                ' We could not email your confirmation yet — your address may need adding to the pre-launch email list.';
            } else if (attendeeEmail.error) {
              toastMessage += ' We could not send a confirmation email — please check your account email is correct.';
            }
          }
          showAdToast(toastMessage);
        } catch {
          if (err) {
            err.textContent = 'Something went wrong. Please try again.';
            err.hidden = false;
          }
          confirmBtn.disabled = !confirmCheck.checked;
        }
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeCancelModal();
      });
    }
  }

  function bindCancelButtons(root) {
    (root || document).querySelectorAll('.ad-cancel-booking').forEach((btn) => {
      btn.addEventListener('click', () => {
        const reg = findRegistrationById(btn.getAttribute('data-registration-id'));
        if (reg) openCancelModal(reg);
      });
    });
  }

  function renderPaymentsTable() {
    const body = document.getElementById('ad-payments-body');
    const empty = document.getElementById('ad-payments-empty');
    if (!body) return;

    const list = registrations.slice().sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });

    body.innerHTML = '';
    if (!list.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    list.forEach((reg) => {
      const applicationStatus = String(reg.applicationStatus || 'Approved').trim();
      const tr = document.createElement('tr');
      if (highlightRegistrationId && String(reg.id) === highlightRegistrationId) {
        tr.className = 'ad-row-highlight';
      } else if (reg.isCancelled) {
        tr.className = 'ad-row-cancelled';
      } else if (applicationStatus === 'Pending') {
        tr.className = 'ad-row-application-pending';
      } else if (applicationStatus === 'Denied') {
        tr.className = 'ad-row-application-denied';
      } else if (needsBookingAction(reg)) {
        tr.className = 'ad-row-application-approved';
      }
      tr.innerHTML =
        '<td>' +
        thumbHtml(reg) +
        '</td><td class="ad-td-name">' +
        eventTitleCell(reg) +
        '</td><td>' +
        esc(formatDateShort(reg.createdAt)) +
        '</td><td>' +
        esc(reg.bookingReference || formatBookingReference(reg.id)) +
        '</td><td>' +
        esc(reg.ticketLabel || '—') +
        '</td><td>' +
        esc(
          applicationStatus === 'Pending' || applicationStatus === 'Denied'
            ? '—'
            : formatAmountPaid(reg.amountPaid, reg.paymentStatus)
        ) +
        '</td><td>' +
        applicationBadge(reg) +
        '</td><td>' +
        paymentBadge(reg.paymentStatus, reg) +
        '</td><td class="ad-td-actions"><div class="ad-action-group">' +
        '<button type="button" class="ad-btn ad-btn-primary ad-view-payment" data-registration-id="' +
        esc(reg.id || '') +
        '">Payment details</button>' +
        (isRegistrationPaid(reg) && String(reg.applicationStatus || 'Approved').trim() !== 'Denied'
          ? '<a class="ad-action-link ad-download-invoice" href="' +
            esc(invoiceDownloadHref(reg)) +
            '" target="_blank" rel="noopener noreferrer">Download Invoice</a>'
          : '') +
        (reg.canCancel
          ? '<button type="button" class="ad-action-link ad-action-link--danger ad-cancel-booking" data-registration-id="' +
            esc(reg.id || '') +
            '">Cancel booking</button>'
          : '') +
        '</div></td>';
      body.appendChild(tr);
    });

    renderRefundAlerts();
    bindPaymentButtons(body);
    bindCancelButtons(body);
  }

  function cancellationRefundDetail(reg) {
    const status = String(reg?.refundStatus || '').trim();
    const amount = formatAmountPaid(reg.amountPaid, reg.paymentStatus);
    if (status === 'pending') {
      return 'Your refund of ' + amount + ' is being processed to your original payment method. Allow 5–10 business days.';
    }
    if (status === 'completed') {
      return 'Your refund of ' + amount + ' has been issued to your original payment method.';
    }
    if (Number(reg.amountPaid) > 0) {
      const policyText = String(reg.refundPolicyText || '').trim();
      if (policyText) {
        return 'No refund is due for this cancellation. ' + policyText;
      }
      return 'No refund is due for this cancellation under the organiser\'s refund policy.';
    }
    return 'This was a free registration — no payment was taken.';
  }

  function renderCancellationsTable() {
    const body = document.getElementById('ad-cancellations-body');
    const empty = document.getElementById('ad-cancellations-empty');
    if (!body) return;

    const list = (cancelledBookings || []).slice().sort((a, b) => {
      const da = a.cancelledAt ? new Date(a.cancelledAt).getTime() : 0;
      const db = b.cancelledAt ? new Date(b.cancelledAt).getTime() : 0;
      return db - da;
    });

    body.innerHTML = '';
    if (!list.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    list.forEach((reg) => {
      const tr = document.createElement('tr');
      tr.className = 'ad-row-cancelled';
      tr.innerHTML =
        '<td>' +
        thumbHtml(reg) +
        '</td><td class="ad-td-name">' +
        eventTitleCell(reg) +
        '<div class="ad-cancel-refund-detail">' +
        esc(cancellationRefundDetail(reg)) +
        '</div></td><td>' +
        esc(formatDateShort(reg.cancelledAt)) +
        '</td><td>' +
        esc(reg.bookingReference || formatBookingReference(reg.id)) +
        '</td><td>' +
        esc(reg.ticketLabel || '—') +
        '</td><td>' +
        esc(formatAmountPaid(reg.amountPaid, reg.paymentStatus)) +
        '</td><td>' +
        refundStatusBadge(reg) +
        '</td><td class="ad-td-actions"><div class="ad-action-group">' +
        '<button type="button" class="ad-btn ad-btn-primary ad-view-payment" data-registration-id="' +
        esc(reg.id || '') +
        '">View details</button>' +
        '</div></td>';
      body.appendChild(tr);
    });

    renderRefundAlerts();
    bindPaymentButtons(body);
  }

  function openReviewFromQuery() {
    const eventId = consumePendingReviewEventId();
    if (!eventId) return;
    setRoute('reviews-pending');
    const reg = findRegistrationByEventId(eventId);
    const launch = () => {
      if (!reg) return;
      if (reg.reviewStatus === 'pending') {
        openReviewModal(reg);
      } else if (reg.reviewStatus === 'reviewed') {
        openViewReviewModal(reg);
      }
    };
    if (reg) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(launch);
      });
    }
    clearPendingReviewEventId();
    history.replaceState(null, '', location.pathname + '#reviews-pending');
  }

  function openPaymentFromQuery() {
    const params = new URLSearchParams(location.search);
    const bookingId = String(params.get('booking') || '').trim();
    if (!bookingId) return;
    highlightRegistrationId = bookingId;
    setRoute('payments');
    const reg = findRegistrationById(bookingId);
    if (reg) openPaymentModal(reg);
  }

  function setRoute(route) {
    let nextRoute = route || 'overview';
    if (nextRoute === 'reviews') nextRoute = 'reviews-pending';
    if (isReviewsRoute(nextRoute)) {
      setReviewsScope(reviewsScopeFromRoute(nextRoute));
      nextRoute = reviewsRouteFromScope(reviewsScope);
    }
    currentRoute = nextRoute;
    closeUtilityMenus();
    updateLayoutHeader(currentRoute);
    const activePage = pageRouteKey(currentRoute);
    document.querySelectorAll('[data-ad-page]').forEach((p) => {
      p.classList.toggle('is-active', p.getAttribute('data-ad-page') === activePage);
    });
    document.querySelectorAll('.hub-side-nav-link[data-ad-route]').forEach((a) => {
      const navRoute = a.getAttribute('data-ad-route');
      const active = isReviewsRoute(currentRoute) ? navRoute === 'reviews' : navRoute === currentRoute;
      a.classList.toggle('is-active', active);
    });
    if (location.hash.replace('#', '') !== currentRoute) {
      history.replaceState(null, '', (location.search || '') + '#' + currentRoute);
    }
    if (dashboardReady) renderRouteTables(routeTablesKey(currentRoute));
  }

  function enquiryStatusLabel(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'responded') return 'Replied';
    if (s === 'read') return 'Seen';
    return 'Sent';
  }

  function enquiryStatusBadge(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'responded') return '<span class="ad-badge ad-badge-green">' + esc(enquiryStatusLabel(s)) + '</span>';
    if (s === 'read') return '<span class="ad-badge ad-badge-grey">' + esc(enquiryStatusLabel(s)) + '</span>';
    return '<span class="ad-badge ad-badge-red">' + esc(enquiryStatusLabel(s)) + '</span>';
  }

  function opportunityListingHref(opportunityId) {
    const id = String(opportunityId || '').trim();
    if (!id) return '../opportunities/index.html';
    return '/opportunities/' + encodeURIComponent(id);
  }

  function renderOpportunityEnquiries() {
    const body = document.getElementById('ad-enquiries-body');
    const empty = document.getElementById('ad-enquiries-empty');
    if (!body) return;

    const list = opportunityEnquiries || [];
    body.innerHTML = '';
    if (!list.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    list.forEach((enquiry) => {
      const tr = document.createElement('tr');
      const message = String(enquiry.message || '').trim();
      const preview = message.length > 120 ? message.slice(0, 117) + '…' : message;
      tr.innerHTML =
        '<td>' +
        esc(formatDateShort(enquiry.createdAt)) +
        '</td><td class="ad-td-name">' +
        esc(enquiry.opportunityTitle || 'Listing') +
        '</td><td class="ad-enquiry-message">' +
        esc(preview || '—') +
        '</td><td>' +
        enquiryStatusBadge(enquiry.status) +
        '</td><td><a class="ad-btn ad-btn-primary ad-btn-sm" href="' +
        esc(opportunityListingHref(enquiry.opportunityId)) +
        '">View listing</a></td>';
      body.appendChild(tr);
    });
  }

  function renderStats(stats) {
    const upcoming = document.getElementById('ad-stat-upcoming');
    const next = document.getElementById('ad-stat-next');
    const reviews = document.getElementById('ad-stat-reviews');
    const pending = document.getElementById('ad-stat-reviews-pending');
    const enquiries = document.getElementById('ad-stat-enquiries');
    const enquiriesHint = document.getElementById('ad-stat-enquiries-hint');
    if (upcoming) upcoming.textContent = String(stats.upcomingCount || 0);
    if (next) {
      next.textContent = stats.nextEventDate
        ? 'Next: ' + formatDateShort(stats.nextEventDate)
        : '—';
    }
    if (reviews) reviews.textContent = String(stats.reviewsLeft || 0);
    if (pending) {
      const n = stats.reviewsPending || 0;
      pending.textContent = n ? '⭐ ' + n + ' pending' : '—';
    }
    const enquiryCount = (opportunityEnquiries || []).length;
    if (enquiries) enquiries.textContent = String(enquiryCount);
    if (enquiriesHint) {
      const waiting = (opportunityEnquiries || []).filter(
        (e) => String(e.status || '').toLowerCase() === 'new'
      ).length;
      enquiriesHint.textContent = waiting
        ? waiting + ' awaiting reply'
        : enquiryCount
          ? 'Track replies by email'
          : '—';
    }
  }

  function updateSideCounts() {
    const set = (id, n) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (!dashboardReady) {
        el.hidden = true;
        el.textContent = '';
        return;
      }
      el.hidden = false;
      el.textContent = String(n);
    };
    set('ad-side-upcoming', upcomingList().length);
    set('ad-side-past', pastList().length);
    set('ad-side-enquiries', (opportunityEnquiries || []).length);
    set('ad-side-pending', pendingReviewsList().length);
    set('ad-side-reviewed', doneReviewsList().length);
    set('ad-side-cancellations', (cancelledBookings || []).length);
  }

  function renderPagination(navId, listKey, totalPages) {
    const nav = document.getElementById(navId);
    if (!nav) return;
    const currentPage = listPages[listKey] || 1;
    if (totalPages <= 1) {
      nav.hidden = true;
      return;
    }
    nav.hidden = false;
    let html = '<span class="ad-page-label">Page ' + currentPage + ' of ' + totalPages + '</span>';
    for (let p = 1; p <= totalPages; p++) {
      html +=
        '<button type="button" class="ad-page-btn' +
        (p === currentPage ? ' is-active' : '') +
        '" data-page="' +
        p +
        '" data-list="' +
        listKey +
        '">' +
        p +
        '</button>';
    }
    html +=
      '<button type="button" class="ad-page-btn" data-page="' +
      (currentPage + 1) +
      '" data-list="' +
      listKey +
      '" ' +
      (currentPage >= totalPages ? 'disabled' : '') +
      ' aria-label="Next page">›</button>';
    nav.innerHTML = html;
    nav.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = Number(btn.getAttribute('data-page'));
        const key = btn.getAttribute('data-list');
        if (!p || !key || p < 1 || p > totalPages || p === listPages[key]) return;
        listPages[key] = p;
        if (key === 'upcoming') renderRouteTables('upcoming', { force: true });
        else if (key === 'past') renderRouteTables('past', { force: true });
        else renderAllTables();
      });
    });
  }

  function renderEventRows(bodyId, emptyId, navId, listKey, list, fullColumns) {
    const body = document.getElementById(bodyId);
    const empty = document.getElementById(emptyId);
    if (!body) return;

    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    listPages[listKey] = Math.min(listPages[listKey] || 1, totalPages);
    const start = (listPages[listKey] - 1) * PAGE_SIZE;
    const slice = list.slice(start, start + PAGE_SIZE);

    body.innerHTML = '';
    if (!list.length) {
      if (empty) empty.hidden = false;
      renderPagination(navId, listKey, 1);
      return;
    }
    if (empty) empty.hidden = true;

    slice.forEach((reg) => {
      const tr = document.createElement('tr');
      if (String(reg.applicationStatus || '') === 'Pending') {
        tr.className = 'ad-row-application-pending';
      } else if (String(reg.applicationStatus || '') === 'Denied') {
        tr.className = 'ad-row-application-denied';
      } else if (needsBookingAction(reg)) {
        tr.className = 'ad-row-application-approved';
      }
      if (fullColumns) {
        tr.innerHTML =
          '<td>' +
          thumbHtml(reg) +
          '</td><td class="ad-td-name">' +
          eventTitleCell(reg) +
          '</td><td>' +
          esc(formatDateShort(reg.date)) +
          '</td><td>' +
          esc(formatTimeRange(reg.date, reg.endDate)) +
          '</td><td>' +
          esc(reg.ticketLabel || '—') +
          '</td><td>' +
          applicationBadge(reg) +
          '</td><td>' +
          paymentBadge(reg.paymentStatus, reg) +
          '</td><td>' +
          reviewBadge(reg.reviewStatus, reg) +
          '</td><td class="ad-td-actions"><div class="ad-action-group ad-action-group--with-utilities">' +
          actionCell(reg, { showCancel: listKey === 'upcoming', showTicket: true }) +
          utilityDropdownHtml(reg, { showUtilities: listKey === 'upcoming' }) +
          '</div></td>';
      } else {
        tr.innerHTML =
          '<td>' +
          thumbHtml(reg) +
          '</td><td class="ad-td-name">' +
          eventTitleCell(reg) +
          '</td><td>' +
          esc(formatDateShort(reg.date)) +
          '</td><td>' +
          reviewBadge(reg.reviewStatus, reg) +
          '</td><td class="ad-td-actions">' +
          actionCell(reg) +
          '</td>';
      }
      body.appendChild(tr);
    });

    bindLeaveReviewButtons(body);
    bindViewReviewButtons(body);
    bindCancelButtons(body);
    bindPaymentButtons(body);
    bindUtilityMenus(body);

    renderPagination(navId, listKey, totalPages);
  }

  function savedEventHref(item) {
    const slug = item.slug ? String(item.slug).trim() : '';
    if (slug) return '../events/' + encodeURIComponent(slug);
    return '../events/event.html?id=' + encodeURIComponent(item.eventId || item.id || '');
  }

  function renderSavedTable() {
    const body = document.getElementById('ad-saved-body');
    const empty = document.getElementById('ad-saved-empty');
    if (!body) return;

    body.innerHTML = '';
    if (!savedEvents.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    savedEvents.forEach((item) => {
      const tr = document.createElement('tr');
      const favItem = {
        title: item.title,
        imageUrl: item.photoUrl || item.photo_url || '',
      };
      tr.innerHTML =
        '<td>' +
        thumbHtml(favItem) +
        '</td><td class="ad-td-name"><a href="' +
        esc(savedEventHref(item)) +
        '">' +
        esc(item.title || 'Event') +
        '</a></td><td>' +
        esc(formatDateShort(item.startsAt || item.starts_at)) +
        '</td><td>' +
        esc(item.city || '—') +
        '</td><td><button type="button" class="ad-btn ad-btn-ghost ad-saved-remove" data-event-id="' +
        esc(item.eventId || item.event_id || '') +
        '">Remove</button></td>';
      body.appendChild(tr);
    });

    body.querySelectorAll('.ad-saved-remove').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const eventId = btn.getAttribute('data-event-id');
        if (!eventId) return;
        btn.disabled = true;
        try {
          if (window.HubFavourites) {
            await window.HubFavourites.toggle(eventId);
          } else {
            await fetch('/api/auth/favourites', {
              method: 'DELETE',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ eventId }),
            });
          }
          savedEvents = savedEvents.filter((x) => String(x.eventId || x.event_id) !== String(eventId));
          renderSavedTable();
        } catch {
          btn.disabled = false;
        }
      });
    });
  }

  function savedOrganiserHref(item) {
    const slug = item.slug ? String(item.slug).trim() : '';
    if (slug) return '../organisers/' + encodeURIComponent(slug);
    return '../events/organiser.html?id=' + encodeURIComponent(item.organiserId || item.organiser_id || item.id || '');
  }

  function savedOpportunityHref(item) {
    const slug = item.slug ? String(item.slug).trim() : '';
    if (slug) return '../opportunities/' + encodeURIComponent(slug);
    return '../opportunities/opportunity.html?id=' + encodeURIComponent(item.opportunityId || item.opportunity_id || item.id || '');
  }

  async function ensureOpportunitiesCatalog() {
    if (!window.HubOpportunitiesCatalog || !window.HubOpportunitiesCatalog.loadCatalogAsync) return;
    try {
      await window.HubOpportunitiesCatalog.loadCatalogAsync();
    } catch {
      /* non-fatal */
    }
  }

  function enrichSavedOpportunity(item) {
    const next = Object.assign({}, item || {});
    const id = String(next.opportunityId || next.opportunity_id || '').trim();
    const catalog = window.HubOpportunitiesCatalog;
    if (!id || !catalog || typeof catalog.getById !== 'function') return next;

    const hit = catalog.getById(id);
    if (!hit) return next;

    const fallbackTitle = !next.title || next.title === 'Opportunity' || next.title === 'Listing no longer available';
    if (fallbackTitle && hit.title) next.title = hit.title;
    if (!next.host && hit.host) next.host = hit.host;
    if (!next.slug && hit.slug) next.slug = hit.slug;
    if (!next.logoUrl && hit.logoUrl) next.logoUrl = hit.logoUrl;
    if (!next.imageUrl && hit.imageUrl) next.imageUrl = hit.imageUrl;
    if (!next.type && hit.type) next.type = hit.type;
    return next;
  }

  function applySavedOpportunityData(data) {
    let list = [];
    if (data && data.ok && Array.isArray(data.favourites) && data.favourites.length) {
      list = data.favourites.slice();
    } else if (data && data.ok && Array.isArray(data.opportunityIds) && data.opportunityIds.length) {
      list = data.opportunityIds.map((id) => ({ opportunityId: id, title: 'Opportunity' }));
    }

    const serverIds = new Set(
      list.map((item) => String(item.opportunityId || item.opportunity_id || '').trim()).filter(Boolean)
    );
    const localIds = window.HubOpportunitySaves ? window.HubOpportunitySaves.ids() : [];
    localIds.forEach((id) => {
      const key = String(id || '').trim();
      if (key && !serverIds.has(key)) {
        list.push({ opportunityId: key, title: 'Opportunity' });
        serverIds.add(key);
      }
    });

    savedOpportunities = list.map(enrichSavedOpportunity);

    if (window.HubOpportunitySaves) {
      const ids = savedOpportunities
        .map((item) => String(item.opportunityId || item.opportunity_id || '').trim())
        .filter(Boolean);
      if (ids.length) window.HubOpportunitySaves.writeLocal(ids);
      else if (data && data.ok && Array.isArray(data.opportunityIds)) {
        window.HubOpportunitySaves.writeLocal(data.opportunityIds);
      }
    }
  }

  function refreshCompareToolbar() {
    const cmp = window.HubOpportunityCompare;
    const toolbar = document.getElementById('ad-saved-opp-toolbar');
    const countEl = document.getElementById('ad-compare-count');
    const openBtn = document.getElementById('ad-compare-open');
    const clearBtn = document.getElementById('ad-compare-clear');
    if (!cmp || !toolbar) return;

    const ids = cmp.ids();
    toolbar.hidden = savedScope !== 'opportunities' || !savedOpportunities.length;
    if (countEl) countEl.textContent = String(ids.length);
    if (openBtn) openBtn.disabled = ids.length < 2;
    if (clearBtn) clearBtn.disabled = !ids.length;

    if (clearBtn && !clearBtn.dataset.bound) {
      clearBtn.dataset.bound = '1';
      clearBtn.addEventListener('click', () => {
        cmp.clear();
        refreshCompareToolbar();
        renderSavedOpportunitiesTable();
      });
    }
    if (openBtn && !openBtn.dataset.bound) {
      openBtn.dataset.bound = '1';
      openBtn.addEventListener('click', () => {
        const catalog = window.HubOpportunitiesCatalog;
        const html = cmp.renderModal(catalog, cmp.ids());
        if (!html) return;
        document.body.insertAdjacentHTML('beforeend', html);
        cmp.bindModal(document.getElementById('opp-compare-modal'));
      });
    }
  }

  function renderSavedOpportunitiesTable() {
    const body = document.getElementById('ad-saved-opportunities-body');
    const empty = document.getElementById('ad-saved-opportunities-empty');
    const cmp = window.HubOpportunityCompare;
    if (!body) return;

    body.innerHTML = '';
    refreshCompareToolbar();
    if (!savedOpportunities.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    savedOpportunities.forEach((item) => {
      const tr = document.createElement('tr');
      const oppId = String(item.opportunityId || item.opportunity_id || '');
      const checked = cmp && cmp.isSelected(oppId);
      const favItem = {
        title: item.title,
        imageUrl: item.logoUrl || item.imageUrl || item.logo_url || item.image_url || '',
      };
      tr.innerHTML =
        '<td><input type="checkbox" class="ad-compare-check" data-opportunity-id="' +
        esc(oppId) +
        '" aria-label="Compare ' +
        esc(item.title || 'opportunity') +
        '"' +
        (checked ? ' checked' : '') +
        ' /></td><td>' +
        thumbHtml(favItem) +
        '</td><td class="ad-td-name"><a href="' +
        esc(savedOpportunityHref(item)) +
        '">' +
        esc(item.title || 'Opportunity') +
        '</a></td><td>' +
        esc(item.host || '—') +
        '</td><td>' +
        esc(formatDateShort(item.createdAt || item.created_at)) +
        '</td><td><button type="button" class="ad-btn ad-btn-ghost ad-saved-opportunity-remove" data-opportunity-id="' +
        esc(oppId) +
        '">Remove</button></td>';
      body.appendChild(tr);
    });

    body.querySelectorAll('.ad-compare-check').forEach((input) => {
      input.addEventListener('change', () => {
        if (!cmp) return;
        const id = input.getAttribute('data-opportunity-id');
        const before = cmp.ids();
        if (input.checked && before.length >= cmp.MAX && !cmp.isSelected(id)) {
          input.checked = false;
          return;
        }
        cmp.toggle(id);
        refreshCompareToolbar();
      });
    });

    body.querySelectorAll('.ad-saved-opportunity-remove').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const opportunityId = btn.getAttribute('data-opportunity-id');
        if (!opportunityId) return;
        btn.disabled = true;
        try {
          if (window.HubOpportunitySaves) {
            await window.HubOpportunitySaves.toggle(opportunityId);
          } else {
            await fetch('/api/auth/opportunity-favourites', {
              method: 'DELETE',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ opportunityId }),
            });
          }
          savedOpportunities = savedOpportunities.filter(
            (x) => String(x.opportunityId || x.opportunity_id) !== String(opportunityId)
          );
          renderSavedOpportunitiesTable();
        } catch {
          btn.disabled = false;
        }
      });
    });
  }

  function renderSavedOrganisersTable() {
    const body = document.getElementById('ad-saved-organisers-body');
    const empty = document.getElementById('ad-saved-organisers-empty');
    if (!body) return;

    body.innerHTML = '';
    if (!savedOrganisers.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    savedOrganisers.forEach((item) => {
      const tr = document.createElement('tr');
      const favItem = {
        title: item.name,
        imageUrl: item.photoUrl || item.photo_url || '',
      };
      const rating = item.rating != null && Number(item.rating) > 0 ? Number(item.rating).toFixed(1) + '★' : '—';
      tr.innerHTML =
        '<td>' +
        thumbHtml(favItem) +
        '</td><td class="ad-td-name"><a href="' +
        esc(savedOrganiserHref(item)) +
        '">' +
        esc(item.name || 'Organiser') +
        '</a></td><td>' +
        esc(item.industry || '—') +
        '</td><td>' +
        esc(rating) +
        '</td><td><button type="button" class="ad-btn ad-btn-ghost ad-saved-organiser-remove" data-organiser-id="' +
        esc(item.organiserId || item.organiser_id || '') +
        '">Remove</button></td>';
      body.appendChild(tr);
    });

    body.querySelectorAll('.ad-saved-organiser-remove').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const organiserId = btn.getAttribute('data-organiser-id');
        if (!organiserId) return;
        btn.disabled = true;
        try {
          if (window.HubOrganiserFavourites) {
            await window.HubOrganiserFavourites.toggle(organiserId);
          } else {
            await fetch('/api/auth/organiser-favourites', {
              method: 'DELETE',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ organiserId }),
            });
          }
          savedOrganisers = savedOrganisers.filter(
            (x) => String(x.organiserId || x.organiser_id) !== String(organiserId)
          );
          renderSavedOrganisersTable();
        } catch {
          btn.disabled = false;
        }
      });
    });
  }

  function renderSavedOpportunitySearchesTable() {
    const body = document.getElementById('ad-saved-searches-body');
    const empty = document.getElementById('ad-saved-searches-empty');
    if (!body) return;

    body.innerHTML = '';
    if (!savedOpportunitySearches.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    const q = window.HubOpportunityQuality;
    savedOpportunitySearches.forEach((item) => {
      const tr = document.createElement('tr');
      const criteria = item.criteria || {};
      const label =
        String(item.label || '').trim() ||
        (q && q.criteriaLabel ? q.criteriaLabel(criteria) : 'Saved search');
      const href =
        q && q.criteriaToUrl ? q.criteriaToUrl(criteria, '../opportunities/index.html') : '../opportunities/index.html';
      tr.innerHTML =
        '<td class="ad-td-name"><a href="' +
        esc(href) +
        '">' +
        esc(label) +
        '</a></td><td>' +
        esc(formatDateShort(item.createdAt || item.created_at)) +
        '</td><td><button type="button" class="ad-btn ad-btn-ghost ad-saved-search-remove" data-search-id="' +
        esc(item.id || '') +
        '">Remove alert</button></td>';
      body.appendChild(tr);
    });

    body.querySelectorAll('.ad-saved-search-remove').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const searchId = btn.getAttribute('data-search-id');
        if (!searchId) return;
        btn.disabled = true;
        try {
          await fetch('/api/auth/opportunity-saved-searches', {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ searchId }),
          });
          savedOpportunitySearches = savedOpportunitySearches.filter((x) => String(x.id) !== String(searchId));
          renderSavedOpportunitySearchesTable();
        } catch {
          btn.disabled = false;
        }
      });
    });
  }

  async function loadSavedOpportunities() {
    try {
      if (window.HubOpportunitySaves && window.HubOpportunitySaves.mergeOnLogin) {
        await window.HubOpportunitySaves.mergeOnLogin();
      }
      const res = await fetch('/api/auth/opportunity-favourites', { credentials: 'include' });
      const data = await res.json();
      await ensureOpportunitiesCatalog();
      applySavedOpportunityData(data);
    } catch {
      await ensureOpportunitiesCatalog();
      applySavedOpportunityData(null);
    }
    if (dashboardReady && currentRoute === 'saved') {
      renderRouteTables('saved', { force: true });
    }
  }

  function applySavedOrganiserData(data) {
    if (data && data.ok && Array.isArray(data.favourites)) {
      savedOrganisers = data.favourites;
    } else if (data && data.ok && Array.isArray(data.organiserIds)) {
      savedOrganisers = data.organiserIds.map((id) => ({ organiserId: id, name: 'Organiser' }));
    } else {
      savedOrganisers = [];
    }
    if (window.HubOrganiserFavourites && data && Array.isArray(data.organiserIds)) {
      window.HubOrganiserFavourites.writeLocal(data.organiserIds);
    }
  }

  async function loadSavedOrganisers() {
    try {
      const res = await fetch('/api/auth/organiser-favourites', { credentials: 'include' });
      const data = await res.json();
      applySavedOrganiserData(data);
    } catch {
      savedOrganisers = window.HubOrganiserFavourites
        ? window.HubOrganiserFavourites.ids().map((id) => ({ organiserId: id }))
        : [];
    }
    if (dashboardReady && currentRoute === 'saved') {
      renderRouteTables('saved', { force: true });
    }
  }

  async function loadSavedEvents() {
    try {
      const res = await fetch('/api/auth/favourites', { credentials: 'include' });
      const data = await res.json();
      if (data && data.ok && Array.isArray(data.favourites)) {
        savedEvents = data.favourites;
      } else if (data && data.ok && Array.isArray(data.eventIds)) {
        savedEvents = data.eventIds.map((id) => ({ eventId: id, title: 'Event' }));
      } else {
        savedEvents = [];
      }
      if (window.HubFavourites && Array.isArray(data.eventIds)) {
        window.HubFavourites.writeLocal(data.eventIds);
      }
    } catch {
      savedEvents = window.HubFavourites ? window.HubFavourites.ids().map((id) => ({ eventId: id })) : [];
    }
    if (dashboardReady && currentRoute === 'saved') {
      renderRouteTables('saved', { force: true });
    }
  }

  function routeTablesKey(route) {
    return isReviewsRoute(route) ? 'reviews' : route;
  }

  function renderRouteTables(route, options) {
    if (!dashboardReady) return;
    const force = Boolean(options && options.force);
    const key = route || 'overview';
    if (!force && renderedRoutes.has(key)) return;

    updateSideCounts();

    if (key === 'overview') {
      renderedRoutes.add(key);
      return;
    }

    if (key === 'upcoming') {
      const up = upcomingList().sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return da - db;
      });
      renderEventRows('ad-upcoming-body', 'ad-upcoming-empty', 'ad-pagination-upcoming', 'upcoming', up, true);
    } else if (key === 'past') {
      const past = pastList().sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      });
      renderEventRows('ad-past-body', 'ad-past-empty', 'ad-pagination-past', 'past', past, true);
    } else if (key === 'reviews' || key === 'reviews-pending' || key === 'reviews-done') {
      renderEventRows(
        'ad-reviews-pending-body',
        'ad-reviews-pending-empty',
        null,
        'reviews-pending',
        pendingReviewsList(),
        false
      );
      renderEventRows(
        'ad-reviews-done-body',
        'ad-reviews-done-empty',
        null,
        'reviews-done',
        doneReviewsList(),
        false
      );
      renderedRoutes.add('reviews');
      renderedRoutes.add('reviews-pending');
      renderedRoutes.add('reviews-done');
      return;
    } else if (key === 'payments') {
      renderPaymentsTable();
    } else if (key === 'cancellations') {
      renderCancellationsTable();
    } else if (key === 'saved') {
      maybeDefaultSavedScope();
      renderSavedTable();
      renderSavedOrganisersTable();
      renderSavedOpportunitiesTable();
      renderSavedOpportunitySearchesTable();
    } else if (key === 'opportunity-enquiries') {
      renderOpportunityEnquiries();
    }

    renderedRoutes.add(key);
  }

  function applyDashboardData(data) {
    registrations = data.registrations || [];
    cancelledBookings = data.cancelledBookings || [];
    opportunityEnquiries = data.opportunityEnquiries || [];
    dashboardReady = true;
    renderedRoutes.clear();
    renderStats(data.stats || {});
    renderRefundAlerts();
    renderRouteTables(routeTablesKey(currentRoute), { force: true });
  }

  function renderAllTables() {
    renderedRoutes.clear();
    renderRouteTables('upcoming', { force: true });
    renderRouteTables('past', { force: true });
    renderRouteTables('reviews', { force: true });
    renderRouteTables('payments', { force: true });
    renderRouteTables('cancellations', { force: true });
    renderRouteTables('opportunity-enquiries', { force: true });
    if (savedEvents.length || savedOrganisers.length || savedOpportunities.length || savedOpportunitySearches.length) {
      renderRouteTables('saved', { force: true });
    }
    updateSideCounts();
  }

  const ACCOUNT_VISITED_KEY = 'hub_account_visited_v1';

  function hasVisitedAccountBefore() {
    try {
      return localStorage.getItem(ACCOUNT_VISITED_KEY) === '1';
    } catch {
      return false;
    }
  }

  function markAccountVisited() {
    try {
      localStorage.setItem(ACCOUNT_VISITED_KEY, '1');
    } catch {
      /* ignore quota / private mode */
    }
  }

  function renderWelcome(user) {
    const name = (user && user.name && String(user.name).trim()) || '';
    const nameEl = document.getElementById('ad-welcome-name');
    if (!nameEl) return;

    const isReturnVisit = hasVisitedAccountBefore();
    if (isReturnVisit) {
      nameEl.textContent = name ? 'Welcome back, ' + name + ' 👋' : 'Welcome back 👋';
    } else {
      nameEl.textContent = name ? 'Welcome, ' + name + ' 👋' : 'Welcome 👋';
      markAccountVisited();
    }
  }

  function bindNav() {
    document.querySelectorAll('.hub-side-nav-link[data-ad-route]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        setRoute(a.getAttribute('data-ad-route') || 'overview');
      });
    });
    window.addEventListener('hashchange', () => setRoute(parseRoute()));
  }

  function bindHubContextSwitch() {
    document.querySelectorAll('[data-hub-switch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-hub-switch');
        if (!mode || !window.HubModeSwitch || !window.HubModeSwitch.switchTo) return;
        btn.disabled = true;
        window.HubModeSwitch.switchTo(mode, '../').catch(() => {
          btn.disabled = false;
        });
      });
    });
  }

  async function ensureAttendeeHubMode() {
    try {
      await fetch('/api/auth/hub-mode', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'attendee' }),
      });
    } catch {
      /* non-fatal */
    }
  }

  async function reloadDashboard() {
    setDashboardLoading(true);
    try {
      const res = await fetch('/api/auth/attendee-dashboard', { credentials: 'include' });
      const data = await res.json();
      if (!data.ok) return;
      applyDashboardData(data);
    } finally {
      setDashboardLoading(false);
    }
  }

  async function init() {
    bindNav();
    bindHubContextSwitch();
    bindSavedScope();
    bindReviewsScope();
    bindReviewModal();
    bindViewReviewModal();
    bindPaymentModal();
    bindCancelModal();
    document.addEventListener('click', (e) => {
      if (
        openUtilityMenu &&
        !e.target.closest('.ad-utility-wrap') &&
        !e.target.closest('.ad-utility-menu.is-floating')
      ) {
        closeUtilityMenus();
      }
    });
    window.addEventListener('resize', closeUtilityMenus);
    setRoute(parseRoute());
    setDashboardLoading(true);

    const sessionRes = await fetch('/api/auth/session', { credentials: 'include' });
    const sessionData = await sessionRes.json();
    if (!sessionData.ok || !sessionData.user) {
      setDashboardLoading(false);
      if (signin) signin.hidden = false;
      if (shell) shell.hidden = true;
      const signInLink = signin && signin.querySelector('a.ad-btn-primary');
      if (signInLink) {
        const returnTo = location.pathname + location.search + location.hash;
        signInLink.href = '../login.html?next=' + encodeURIComponent(returnTo);
      }
      return;
    }

    if (signin) signin.hidden = true;
    if (shell) shell.hidden = false;
    setDashboardLoading(true);
    renderWelcome(sessionData.user);

    try {
      ensureAttendeeHubMode();

      if (window.HubOpportunitySaves && window.HubOpportunitySaves.mergeOnLogin) {
        try {
          await window.HubOpportunitySaves.mergeOnLogin();
        } catch {
          /* non-fatal — dashboard still falls back to local saves */
        }
      }

      const [dashRes, favRes, orgFavRes, oppFavRes, oppSearchRes] = await Promise.all([
        fetch('/api/auth/attendee-dashboard', { credentials: 'include' }),
        fetch('/api/auth/favourites', { credentials: 'include' }),
        fetch('/api/auth/organiser-favourites', { credentials: 'include' }),
        fetch('/api/auth/opportunity-favourites', { credentials: 'include' }),
        fetch('/api/auth/opportunity-saved-searches', { credentials: 'include' }),
      ]);
      const data = await dashRes.json();
      if (!data.ok) {
        dashboardReady = true;
        registrations = [];
        opportunityEnquiries = [];
        renderStats({});
        renderRouteTables(routeTablesKey(currentRoute), { force: true });
        try {
          const favData = await favRes.json();
          if (favData && favData.ok && Array.isArray(favData.favourites)) {
            savedEvents = favData.favourites;
          }
        } catch {
          savedEvents = [];
        }
        try {
          const orgFavData = await orgFavRes.json();
          applySavedOrganiserData(orgFavData);
        } catch {
          savedOrganisers = [];
        }
        try {
          const oppFavData = await oppFavRes.json();
          await ensureOpportunitiesCatalog();
          applySavedOpportunityData(oppFavData);
        } catch {
          await ensureOpportunitiesCatalog();
          applySavedOpportunityData(null);
        }
        const sub = document.getElementById('ad-welcome-sub');
        if (sub) {
          sub.textContent =
            data.message ||
            data.error ||
            'Could not load your dashboard right now. Try refreshing the page.';
        }
        return;
      }

      try {
        const favData = await favRes.json();
        if (favData && favData.ok && Array.isArray(favData.favourites)) {
          savedEvents = favData.favourites;
        } else if (favData && favData.ok && Array.isArray(favData.eventIds)) {
          savedEvents = favData.eventIds.map((id) => ({ eventId: id, title: 'Event' }));
        }
        if (window.HubFavourites && favData && Array.isArray(favData.eventIds)) {
          window.HubFavourites.writeLocal(favData.eventIds);
        }
      } catch {
        savedEvents = window.HubFavourites ? window.HubFavourites.ids().map((id) => ({ eventId: id })) : [];
      }

      try {
        const orgFavData = await orgFavRes.json();
        applySavedOrganiserData(orgFavData);
      } catch {
        savedOrganisers = window.HubOrganiserFavourites
          ? window.HubOrganiserFavourites.ids().map((id) => ({ organiserId: id }))
          : [];
      }

      try {
        const oppFavData = await oppFavRes.json();
        await ensureOpportunitiesCatalog();
        applySavedOpportunityData(oppFavData);
      } catch {
        await ensureOpportunitiesCatalog();
        applySavedOpportunityData(null);
      }

      try {
        const oppSearchData = await oppSearchRes.json();
        if (oppSearchData && oppSearchData.ok && Array.isArray(oppSearchData.searches)) {
          savedOpportunitySearches = oppSearchData.searches;
        } else {
          savedOpportunitySearches = [];
        }
      } catch {
        savedOpportunitySearches = [];
      }

      applyDashboardData(data);
      maybeDefaultSavedScope();

      const demoNote = document.getElementById('ad-demo-note');
      if (demoNote) demoNote.hidden = !data.isDemo;

      openPaymentFromQuery();
      openReviewFromQuery();
    } finally {
      setDashboardLoading(false);
    }
  }

  init();
})();
