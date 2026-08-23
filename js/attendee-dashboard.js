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
  let myGroups = [];
  let savedOpportunities = [];
  let savedOpportunitySearches = [];
  let opportunityEnquiries = [];
  let currentRoute = 'overview';
  let savedScope = 'events';
  let savedScopePinned = false;
  let ticketsScope = 'upcoming';
  let opportunitySavedScope = 'enquiries';
  let reviewsScope = 'pending';
  let openUtilityMenu = null;
  let shareModalOpen = false;
  let shareCardDataUrl = '';
  let currentShareReg = null;
  const REVIEW_EVENT_STORAGE_KEY = 'hub_review_event_id';
  const ORGANISER_CONTEXT_DISMISS_KEY = 'hub_attendee_organiser_context_dismissed';

  const SAVED_SCOPE_HEAD = {
    groups: {
      title: 'My memberships',
      sub: 'Groups that added you to their member list. Sign in with the same email for member rates and booking options.',
    },
    events: {
      title: 'Saved events',
      sub: 'Events you bookmarked from the directory — book before they sell out.',
    },
    organisers: {
      title: 'Saved organisers',
      sub: 'Networking groups and hosts you follow. Saving an event also saves its organiser.',
    },
    reviews: {
      title: 'Organiser reviews',
      sub: 'Rate networking groups after events you attended. Reviews appear on the organiser’s public profile; they can reply here.',
    },
  };

  const OPPORTUNITY_SAVED_SCOPE_HEAD = {
    enquiries: {
      title: 'My opportunity enquiries',
      sub: 'Messages you sent to business opportunity listings. Organisers reply by email.',
    },
    listings: {
      title: 'Saved listings',
      sub: 'Business opportunities you bookmarked — compare listings or send an enquiry.',
    },
    alerts: {
      title: 'Search alerts',
      sub: 'Email alerts when newly published listings match filters you saved on the browse page.',
    },
  };

  const SUBPAGE_HEAD = {
    tickets: {
      title: 'Event tickets',
      sub: 'Events you are registered for, payment history, and cancelled bookings.',
    },
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
      title: 'Saved & memberships',
      sub: 'Your group memberships, saved events, saved organisers, and organiser reviews from events you attended.',
    },
    'saved-opportunities': {
      title: 'Opportunities',
      sub: 'Enquiries you sent, saved business listings, and search alerts for new matches.',
    },
    past: {
      title: 'Past events',
      sub: 'Events you have already attended.',
    },
    'opportunity-enquiries': {
      title: 'My opportunity enquiries',
      sub: 'Messages you sent to business opportunity listings. Organisers reply by email.',
    },
    visibility: {
      title: 'Grow your visibility',
      sub: 'Pin your own listings higher, or sponsor The Networker UK as a brand to reach audiences across events, organisers, and business opportunities.',
    },
    'reviews-pending': {
      title: 'Reviews to write',
      sub: 'Leave feedback for networking groups after events you attended. Reviews show on their public profile and they can reply here.',
    },
    'reviews-done': {
      title: 'Your reviews',
      sub: 'Feedback you have already submitted. Organiser replies appear here when they respond.',
    },
    reviews: {
      title: 'Reviews to write',
      sub: 'Leave feedback for networking groups after events you attended. Reviews show on their public profile and they can reply here.',
    },
  };

  const signin = document.getElementById('ad-signin');
  const shell = document.getElementById('ad-shell');

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function membershipStatusLabel(item) {
    if (item.paymentFailed || item.subscriptionStatus === 'past_due') return 'Payment failed';
    if (!item.membershipActive) return 'Expired';
    if (item.expiringSoon) return 'Expiring soon';
    if (item.expiresAt) return 'Until ' + formatDateShort(item.expiresAt);
    return 'Active';
  }

  function membershipStatusBadge(item) {
    const label = membershipStatusLabel(item);
    let cls = 'ad-badge ad-badge-green';
    if (item.paymentFailed || item.subscriptionStatus === 'past_due') cls = 'ad-badge ad-badge-gold';
    else if (!item.membershipActive) cls = 'ad-badge ad-badge-grey';
    else if (item.expiringSoon) cls = 'ad-badge ad-badge-gold';
    return '<span class="' + cls + '">' + esc(label) + '</span>';
  }

  function membershipOrganiserHref(item) {
    return (
      '/events/organiser.html?slug=' +
      encodeURIComponent(item.organiserSlug || item.organiserId || '') +
      '#org-upcoming'
    );
  }

  function goToMemberships() {
    setSavedScope('groups');
    setRoute('saved');
  }

  function setListEmptyState(tableId, emptyId, isEmpty) {
    const table = tableId ? document.getElementById(tableId) : null;
    const empty = emptyId ? document.getElementById(emptyId) : null;
    if (table) table.hidden = isEmpty;
    if (empty) empty.hidden = !isEmpty;
  }

  const TICKETS_SCOPES = ['upcoming', 'past', 'payments', 'cancellations'];

  function isTicketsScope(scope) {
    return TICKETS_SCOPES.includes(scope);
  }

  function routeHash() {
    if (currentRoute === 'overview') return '';
    if (currentRoute === 'tickets') return '#' + ticketsScope;
    if (currentRoute === 'saved' && savedScope === 'groups') return '#memberships';
    if (currentRoute === 'saved' && savedScope === 'reviews') {
      return reviewsScope === 'done' ? '#reviews-done' : '#reviews-pending';
    }
    if (currentRoute === 'saved-opportunities' && opportunitySavedScope === 'alerts') return '#search-alerts';
    if (currentRoute === 'saved-opportunities' && opportunitySavedScope === 'enquiries') {
      return '#opportunity-enquiries';
    }
    if (currentRoute === 'saved-opportunities') return '#saved-opportunities';
    if (currentRoute === 'visibility') return '#visibility';
    return '#' + currentRoute;
  }

  function syncRouteHash() {
    const url = new URL(window.location.href);
    const wantHash = routeHash();
    if ((url.hash || '') !== wantHash) {
      url.hash = wantHash;
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
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
      event_sold_out: 'Sorry — this event is fully booked.',
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

  function groupSeriesRegistrations(regs) {
    const byGroup = new Map();
    (regs || []).forEach(function (reg) {
      const kind = String(reg.registrationKind || '').trim();
      const groupId = reg.bookingGroupId;
      if (!groupId || (kind !== 'series_bundle' && kind !== 'series_pass')) return;
      if (!byGroup.has(groupId)) byGroup.set(groupId, []);
      byGroup.get(groupId).push(reg);
    });
    const memberIds = new Set();
    const groupRows = [];
    byGroup.forEach(function (members) {
      const sorted = members.slice().sort(function (a, b) {
        return new Date(a.date || 0) - new Date(b.date || 0);
      });
      sorted.forEach(function (m) {
        memberIds.add(m.id);
      });
      const primary = sorted.find(function (m) {
        return Number(m.amountPaid) > 0;
      }) || sorted[0];
      const dateParts = sorted.map(function (m) {
        return formatDateShort(m.date);
      }).filter(Boolean);
      let dateLabel = dateParts.join(', ');
      if (dateParts.length > 1) {
        const last = dateParts.pop();
        dateLabel = dateParts.join(', ') + ' & ' + last;
      }
      groupRows.push(
        Object.assign({}, primary, {
          isSeriesGroup: true,
          seriesGroupKind: primary.registrationKind,
          seriesDateCount: sorted.length,
          seriesDateLabel: dateLabel,
          seriesMemberIds: sorted.map(function (m) {
            return m.id;
          }),
          ticketLabel:
            (primary.registrationKind === 'series_pass' ? 'Series pass' : 'All dates') +
            ' · ' +
            sorted.length +
            ' sessions',
        })
      );
    });
    const singles = (regs || []).filter(function (reg) {
      return !memberIds.has(reg.id);
    });
    return groupRows.concat(singles);
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
    if (window.getEventImage) {
      imageUrl = window.getEventImage({
        photo: imageUrl,
        organiserLogo: item.organiserLogo || '',
        id: item.eventId || item.id,
        eventType: item.eventType || '',
        title: name,
      });
    } else if (window.getFlexibleEventImage) {
      imageUrl = window.getFlexibleEventImage(
        imageUrl,
        item.organiserLogo || '',
        item.eventId || item.id
      );
    }
    const logo = String(item.organiserLogo || '').trim();
    if (
      logo &&
      imageUrl === logo &&
      window.getEventPlacementImage &&
      window.hubIsLogoStyleCover
    ) {
      imageUrl = window.getEventPlacementImage(item.eventId || item.id, item.eventType || '', name);
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
    const isCE = Boolean(reg && reg.isCategoryExclusivity);
    const status = String(reg?.applicationStatus || 'Approved').trim();

    if (isCE) {
      if (status === 'Pending') {
        return '<span class="ad-badge ad-badge-gold">⏳ Pending approval</span>';
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
        return '<span class="ad-badge ad-badge-green">✅ Seat approved</span>';
      }
    }

    if (!hasApplicationDecision(reg)) {
      return '<span class="ad-badge ad-badge-grey">—</span>';
    }
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
    return '../events/event?id=' + encodeURIComponent(reg.eventId || reg.id || '');
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

  function directionsHref(reg) {
    if (!reg || reg.isOnline) return '';
    const query = [reg.venueName, reg.address, reg.city, reg.postcode]
      .map(function (part) {
        return String(part || '').trim();
      })
      .filter(Boolean)
      .join(', ');
    if (!query) return '';
    return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(query);
  }

  function secondaryActionLinksHtml(reg) {
    const links = [
      '<a class="ad-action-link" href="' + esc(eventHref(reg)) + '">View event</a>',
    ];
    const directions = directionsHref(reg);
    if (directions) {
      links.push(
        '<a class="ad-action-link" href="' +
          esc(directions) +
          '" target="_blank" rel="noopener noreferrer">Get directions</a>'
      );
    }
    return (
      '<div class="ad-action-links">' +
      links.join('<span class="ad-action-sep" aria-hidden="true">·</span>') +
      '</div>'
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
        secondaryActionLinksHtml(reg) +
        '</div>'
      );
    }

    if (applicationStatus === 'Pending') {
      return (
        '<div class="ad-action-group">' +
        ticketButtonHtml(reg) +
        secondaryActionLinksHtml(reg) +
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
        secondaryActionLinksHtml(reg) +
        '</div>'
      );
    }
    if (opts.showTicket) {
      return (
        '<div class="ad-action-group">' +
        ticketButtonHtml(reg) +
        secondaryActionLinksHtml(reg) +
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
    const location = reg.isOnline
      ? 'Online'
      : String(reg.city || '').trim() || '';
    return {
      id: reg.eventId || reg.id,
      slug: reg.slug || '',
      title: reg.title || 'Event',
      starts_at: reg.date || '',
      ends_at: reg.endDate || '',
      location: location,
    };
  }

  function canShowCalendarLinks(reg) {
    const applicationStatus = String(reg?.applicationStatus || 'Approved').trim();
    if (applicationStatus === 'Denied' || applicationStatus === 'Pending') return false;
    if (needsBookingAction(reg)) return false;
    if (!reg?.date) return false;
    return true;
  }

  function bindCalendarLinks(root) {
    (root || document).querySelectorAll('.ad-cal-ics').forEach((btn) => {
      if (btn.dataset.boundCalendarIcs) return;
      btn.dataset.boundCalendarIcs = '1';
      btn.addEventListener('click', () => {
        const regId = btn.getAttribute('data-registration-id');
        const reg = findRegistrationById(regId);
        if (!reg || !window.HubCalendarShare) return;
        closeUtilityMenus();
        const links = HubCalendarShare.buildCalendarLinks(registrationCalendarEvent(reg));
        HubCalendarShare.downloadIcs(links.icsContent, links.icsFilename);
      });
    });
  }

  function registrationShareEvent(reg) {
    return {
      id: reg.eventId || reg.id,
      slug: reg.slug || '',
      title: reg.title || 'Event',
      starts_at: reg.date || '',
      imageUrl: reg.imageUrl || '',
      imagePosition: reg.imagePosition || '',
      organiserLogo: reg.organiserLogo || '',
      organiserName: reg.organiserName || '',
      eventType: reg.eventType || '',
      location: reg.isOnline ? 'Online' : String(reg.city || '').trim(),
    };
  }

  function shareMenuItemHtml(reg) {
    if (!canShowCalendarLinks(reg) || !window.HubGoingShare) return '';
    return (
      '<button type="button" class="ad-utility-item ad-share-going" role="menuitem" data-registration-id="' +
      esc(reg.id || '') +
      '">Share to social media</button>'
    );
  }

  function calendarLinksInlineHtml(reg) {
    if (!canShowCalendarLinks(reg) || !window.HubCalendarShare) return '';
    const links = HubCalendarShare.buildCalendarLinks(registrationCalendarEvent(reg));
    return (
      '<div class="ad-cal-links" aria-label="Add to calendar">' +
      '<span class="ad-cal-links-label">Add to calendar</span>' +
      '<a class="ad-cal-link" href="' +
      esc(links.google) +
      '" target="_blank" rel="noopener noreferrer">Google</a>' +
      '<span class="ad-cal-sep" aria-hidden="true">·</span>' +
      '<a class="ad-cal-link" href="' +
      esc(links.outlook) +
      '" target="_blank" rel="noopener noreferrer">Outlook</a>' +
      '<span class="ad-cal-sep" aria-hidden="true">·</span>' +
      '<button type="button" class="ad-cal-link ad-cal-ics" data-registration-id="' +
      esc(reg.id || '') +
      '">iCal</button>' +
      '</div>'
    );
  }

  function calendarMenuItemsHtml(reg) {
    if (!canShowCalendarLinks(reg) || !window.HubCalendarShare) return '';
    const links = HubCalendarShare.buildCalendarLinks(registrationCalendarEvent(reg));
    return (
      '<a class="ad-utility-item" role="menuitem" href="' +
      esc(links.google) +
      '" target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>' +
      '<a class="ad-utility-item" role="menuitem" href="' +
      esc(links.outlook) +
      '" target="_blank" rel="noopener noreferrer">Add to Outlook</a>' +
      '<button type="button" class="ad-utility-item ad-cal-ics" role="menuitem" data-registration-id="' +
      esc(reg.id || '') +
      '">Download iCal (.ics)</button>'
    );
  }

  function cancelMenuItemHtml(reg, options) {
    if (!options || !options.showCancel || !reg.canCancel) return '';
    return (
      '<button type="button" class="ad-utility-item ad-utility-item--danger ad-cancel-booking" role="menuitem" data-registration-id="' +
      esc(reg.id || '') +
      '">Cancel booking</button>'
    );
  }

  async function openShareModal(reg) {
    const modal = document.getElementById('ad-share-modal');
    const preview = document.getElementById('ad-share-preview');
    const loading = document.getElementById('ad-share-preview-loading');
    const captionEl = document.getElementById('ad-share-caption');
    const downloadBtn = document.getElementById('ad-share-download-image');
    if (!modal || !reg || !window.HubGoingShare) return;

    closeUtilityMenus();
    currentShareReg = reg;
    const ev = registrationShareEvent(reg);
    const captionText = HubGoingShare.buildAttendeeCaption(ev);

    if (captionEl) captionEl.value = captionText;
    if (preview) {
      preview.hidden = true;
      preview.removeAttribute('src');
    }
    if (loading) {
      loading.hidden = false;
      loading.textContent = 'Creating your image…';
    }
    if (downloadBtn) downloadBtn.disabled = true;
    shareCardDataUrl = '';

    modal.hidden = false;
    shareModalOpen = true;
    document.body.classList.add('ad-share-modal-open');

    try {
      shareCardDataUrl = await HubGoingShare.generateGoingCardDataUrl(ev);
      if (preview) {
        preview.src = shareCardDataUrl;
        preview.hidden = false;
      }
      if (loading) loading.hidden = true;
      if (downloadBtn) downloadBtn.disabled = !shareCardDataUrl;
    } catch (err) {
      if (loading) {
        loading.hidden = false;
        loading.textContent = 'Could not create image. You can still copy the caption.';
      }
    }
  }

  function closeShareModal() {
    const modal = document.getElementById('ad-share-modal');
    if (modal) modal.hidden = true;
    shareModalOpen = false;
    currentShareReg = null;
    shareCardDataUrl = '';
    document.body.classList.remove('ad-share-modal-open');
  }

  function bindShareButtons(root) {
    (root || document).querySelectorAll('.ad-share-going').forEach((btn) => {
      if (btn.dataset.boundShareGoing) return;
      btn.dataset.boundShareGoing = '1';
      btn.addEventListener('click', () => {
        const reg = findRegistrationById(btn.getAttribute('data-registration-id'));
        closeUtilityMenus();
        if (reg) openShareModal(reg);
      });
    });
  }

  function bindShareModal() {
    const backdrop = document.getElementById('ad-share-modal-backdrop');
    const closeBtn = document.getElementById('ad-share-modal-close');
    const copyBtn = document.getElementById('ad-share-copy-caption');
    const downloadBtn = document.getElementById('ad-share-download-image');
    const linkedIn = document.getElementById('ad-share-linkedin');
    const captionEl = document.getElementById('ad-share-caption');

    [backdrop, closeBtn].forEach((el) => {
      if (!el) return;
      el.addEventListener('click', closeShareModal);
    });

    if (copyBtn && captionEl) {
      copyBtn.addEventListener('click', async () => {
        const text = captionEl.value || '';
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
          } else {
            captionEl.select();
            document.execCommand('copy');
          }
          showAdToast('Caption copied');
          copyBtn.textContent = 'Copied!';
          setTimeout(() => {
            copyBtn.textContent = 'Copy caption';
          }, 2000);
        } catch {
          showAdToast('Select the caption and copy manually');
        }
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        if (!shareCardDataUrl || !window.HubGoingShare) return;
        const name = HubGoingShare.safeFilename(currentShareReg && currentShareReg.title) + '-attending.png';
        HubGoingShare.downloadPngDataUrl(shareCardDataUrl, name);
        showAdToast('Image downloaded');
      });
    }

    if (linkedIn && captionEl) {
      linkedIn.addEventListener('click', async () => {
        const text = captionEl.value || '';
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            showAdToast('Caption copied — paste it into your LinkedIn post');
          }
        } catch {
          /* still open LinkedIn */
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && shareModalOpen) closeShareModal();
    });
  }

  function utilityDropdownHtml(reg, options) {
    if (!options || !options.showUtilities) return '';
    const canPdf = registrationHasTicketPdf(reg);
    const calendarItems = options.hideCalendar ? '' : calendarMenuItemsHtml(reg);
    const shareItem = shareMenuItemHtml(reg);
    const cancelItem = cancelMenuItemHtml(reg, options);
    const pdfItem = canPdf
      ? '<button type="button" class="ad-utility-item ad-download-ticket-pdf" role="menuitem" data-registration-id="' +
        esc(reg.id || '') +
        '">Download ticket (PDF)</button>'
      : '';
    if (!calendarItems && !shareItem && !pdfItem && !cancelItem) return '';
    return (
      '<div class="ad-utility-wrap">' +
      '<button type="button" class="ad-utility-btn" data-ad-utility-toggle aria-expanded="false" aria-haspopup="true">' +
      'More <span class="ad-utility-chev" aria-hidden="true">▾</span></button>' +
      '<div class="ad-utility-menu" role="menu" hidden>' +
      calendarItems +
      shareItem +
      pdfItem +
      cancelItem +
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
      menu.style.bottom = '';
    });
    document.querySelectorAll('[data-ad-utility-toggle][aria-expanded="true"]').forEach((btn) => {
      btn.setAttribute('aria-expanded', 'false');
    });
    openUtilityMenu = null;
  }

  function positionUtilityMenu(btn, menu) {
    const rect = btn.getBoundingClientRect();
    const pad = 8;
    const bottomReserve =
      window.matchMedia('(max-width: 768px)').matches && document.querySelector('.ad-bottom-nav')
        ? 88
        : pad;
    menu.classList.add('is-floating');
    menu.hidden = false;
    menu.classList.add('is-open');
    menu.style.top = '';
    menu.style.left = '';
    menu.style.right = '';
    menu.style.bottom = '';

    // Measure after open so we can clamp to the viewport (left-aligned More
    // buttons used to push a right-anchored menu off the left edge on mobile).
    const menuRect = menu.getBoundingClientRect();
    const menuWidth = Math.max(menuRect.width || 0, 196);
    const menuHeight = Math.max(menuRect.height || 0, 48);
    let left = rect.right - menuWidth;
    const maxLeft = window.innerWidth - pad - menuWidth;
    if (left > maxLeft) left = maxLeft;
    if (left < pad) left = pad;

    const spaceBelow = window.innerHeight - rect.bottom - bottomReserve;
    const spaceAbove = rect.top - pad;
    const openUp = spaceBelow < menuHeight + 4 && spaceAbove > spaceBelow;

    if (openUp) {
      menu.style.bottom = Math.round(window.innerHeight - rect.top + 4) + 'px';
      menu.style.top = 'auto';
    } else {
      menu.style.top = Math.round(rect.bottom + 4) + 'px';
      menu.style.bottom = 'auto';
    }
    menu.style.left = Math.round(left) + 'px';
    menu.style.right = 'auto';
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

    (root || document).querySelectorAll('.ad-utility-menu a.ad-utility-item').forEach((link) => {
      if (link.dataset.boundUtilityLink) return;
      link.dataset.boundUtilityLink = '1';
      link.addEventListener('click', () => closeUtilityMenus());
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
    if (route === 'tickets' || isTicketsScope(route)) return ticketsScope;
    if (currentRoute === 'saved' && savedScope === 'reviews') return 'reviews';
    return route;
  }

  function pageRouteKey(route) {
    if (route === 'tickets' || isTicketsScope(route)) return 'tickets';
    return route;
  }

  function bottomNavRouteKey(route) {
    if (route === 'tickets' || isTicketsScope(route)) return 'tickets';
    if (route === 'saved' || route === 'memberships' || isReviewsRoute(route)) return 'saved';
    if (route === 'saved-opportunities' || route === 'opportunity-enquiries') {
      return 'saved-opportunities';
    }
    if (route === 'overview') return 'overview';
    return '';
  }

  function syncBottomNavHighlight() {
    const bottomKey = bottomNavRouteKey(currentRoute);
    document.querySelectorAll('.ad-bottom-nav-link[data-ad-route]').forEach((a) => {
      const navRoute = a.getAttribute('data-ad-route');
      const active = Boolean(bottomKey) && navRoute === bottomKey;
      a.classList.toggle('is-active', active);
      if (active) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function syncSideNavHighlight() {
    document.querySelectorAll('.hub-side-nav-link[data-ad-route]').forEach((a) => {
      const navRoute = a.getAttribute('data-ad-route');
      let active = navRoute === currentRoute;
      if (navRoute === 'tickets' && (currentRoute === 'tickets' || isTicketsScope(currentRoute))) {
        active = true;
      }
      if (navRoute === 'saved' && currentRoute === 'saved') active = true;
      if (
        navRoute === 'saved-opportunities' &&
        (currentRoute === 'saved-opportunities' || currentRoute === 'opportunity-enquiries')
      ) {
        active = true;
      }
      a.classList.toggle('is-active', active);
      if (active) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function invoiceDownloadHref(reg, format) {
    const base =
      '/api/auth/registration-invoice?registrationId=' + encodeURIComponent(reg.id || '');
    return format === 'pdf' ? base + '&format=pdf' : base;
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
        setSavedScope('reviews');
        setReviewsScope(scope);
        syncRouteHash();
        if (currentRoute !== 'saved') setRoute('saved');
        else if (dashboardReady) renderRouteTables('saved', { force: true });
      });
    });
    setReviewsScope(reviewsScope);
  }

  function maybeDefaultSavedScope() {
    if (savedScopePinned) return;
    if (currentRoute !== 'saved') return;
    const pending = pendingReviewsList().length;
    if (pending > 0 && (savedScope === 'events' || savedScope === 'reviews')) {
      setSavedScope('reviews');
      setReviewsScope('pending');
      return;
    }
    if (savedScope !== 'events') return;
    const hasGroups = myGroups.length > 0;
    const hasEvents = savedEvents.length > 0;
    const hasOrganisers = savedOrganisers.length > 0;
    /* Only auto-land on memberships/organisers when there are no saved events.
       Having memberships must not block the Events tab. */
    if (!hasEvents && hasGroups) {
      setSavedScope('groups');
    } else if (!hasEvents && hasOrganisers) {
      setSavedScope('organisers');
    }
  }

  function setTicketsScope(scope) {
    ticketsScope = isTicketsScope(scope) ? scope : 'upcoming';
    document.querySelectorAll('[data-tickets-scope]').forEach((btn) => {
      const active = btn.getAttribute('data-tickets-scope') === ticketsScope;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-tickets-pane]').forEach((pane) => {
      const active = pane.getAttribute('data-tickets-pane') === ticketsScope;
      pane.classList.toggle('is-active', active);
      pane.hidden = !active;
    });
    if (currentRoute === 'tickets') {
      syncRouteHash();
      updateTicketsSubpageHead();
    }
  }

  function updateTicketsSubpageHead() {
    if (currentRoute !== 'tickets') return;
    const meta = SUBPAGE_HEAD[ticketsScope] || SUBPAGE_HEAD.tickets;
    const titleEl = document.getElementById('ad-subpage-title');
    const subEl = document.getElementById('ad-subpage-sub');
    if (titleEl) titleEl.textContent = meta.title;
    if (subEl) subEl.textContent = meta.sub;
  }

  function bindTicketsScope() {
    document.querySelectorAll('[data-tickets-scope]').forEach((btn) => {
      if (btn.dataset.boundTicketsScope) return;
      btn.dataset.boundTicketsScope = '1';
      btn.addEventListener('click', () => {
        const scope = btn.getAttribute('data-tickets-scope') || 'upcoming';
        setTicketsScope(scope);
        if (currentRoute !== 'tickets') setRoute('tickets');
        else if (dashboardReady) renderRouteTables(ticketsScope, { force: true });
      });
    });
    setTicketsScope(ticketsScope);
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
    if (currentRoute === 'saved') {
      syncRouteHash();
      updateSavedSubpageHead();
    }
  }

  function updateSavedSubpageHead() {
    if (currentRoute !== 'saved') return;
    const meta = SAVED_SCOPE_HEAD[savedScope] || SUBPAGE_HEAD.saved;
    const titleEl = document.getElementById('ad-subpage-title');
    const subEl = document.getElementById('ad-subpage-sub');
    if (titleEl) titleEl.textContent = meta.title;
    if (subEl) subEl.textContent = meta.sub;
  }

  function bindSavedScope() {
    document.querySelectorAll('[data-saved-scope]').forEach((btn) => {
      if (btn.dataset.boundSavedScope) return;
      btn.dataset.boundSavedScope = '1';
      btn.addEventListener('click', () => {
        const scope = btn.getAttribute('data-saved-scope') || 'events';
        savedScopePinned = true;
        setSavedScope(scope);
        if (dashboardReady) renderRouteTables('saved', { force: true });
      });
    });
    setSavedScope(savedScope);
  }

  function setOpportunitySavedScope(scope) {
    const next = scope || 'enquiries';
    opportunitySavedScope =
      next === 'alerts' || next === 'listings' || next === 'enquiries' ? next : 'enquiries';
    document.querySelectorAll('[data-opp-saved-scope]').forEach((btn) => {
      const active = btn.getAttribute('data-opp-saved-scope') === opportunitySavedScope;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-opp-saved-pane]').forEach((pane) => {
      const active = pane.getAttribute('data-opp-saved-pane') === opportunitySavedScope;
      pane.classList.toggle('is-active', active);
      pane.hidden = !active;
    });
    const toolbar = document.getElementById('ad-saved-opp-toolbar');
    if (toolbar) {
      toolbar.hidden =
        opportunitySavedScope !== 'listings' ||
        currentRoute !== 'saved-opportunities' ||
        !savedOpportunities.length;
    }
    if (currentRoute === 'saved-opportunities') {
      syncRouteHash();
      updateOpportunitySavedSubpageHead();
    }
  }

  function updateOpportunitySavedSubpageHead() {
    if (currentRoute !== 'saved-opportunities') return;
    const meta = OPPORTUNITY_SAVED_SCOPE_HEAD[opportunitySavedScope] || SUBPAGE_HEAD['saved-opportunities'];
    const titleEl = document.getElementById('ad-subpage-title');
    const subEl = document.getElementById('ad-subpage-sub');
    if (titleEl) titleEl.textContent = meta.title;
    if (subEl) subEl.textContent = meta.sub;
  }

  function bindOpportunitySavedScope() {
    document.querySelectorAll('[data-opp-saved-scope]').forEach((btn) => {
      if (btn.dataset.boundOppSavedScope) return;
      btn.dataset.boundOppSavedScope = '1';
      btn.addEventListener('click', () => {
        const scope = btn.getAttribute('data-opp-saved-scope') || 'listings';
        setOpportunitySavedScope(scope);
        if (dashboardReady) renderRouteTables('saved-opportunities', { force: true });
      });
    });
    setOpportunitySavedScope(opportunitySavedScope);
  }

  let reviewRating = 0;
  let reviewModalOpen = false;
  let viewReviewModalOpen = false;
  let reviewNameState = {
    legalName: '',
    reviewNameMode: 'name',
    networkerAlias: 'Networker ####',
    reviewNameExample: 'Alex M.',
    reviewDisplayName: 'Attendee',
  };

  function selectedAdReviewNameMode() {
    const checked = document.querySelector('#ad-review-form input[name="reviewNameMode"]:checked');
    return checked && checked.value === 'anonymous' ? 'anonymous' : 'name';
  }

  function formatReviewDisplayName() {
    if (selectedAdReviewNameMode() === 'anonymous') {
      return reviewNameState.networkerAlias || 'Networker ####';
    }
    return reviewNameState.reviewNameExample || reviewNameState.reviewDisplayName || 'Attendee';
  }

  function updateReviewNamePreview() {
    const preview = document.getElementById('ad-review-name-preview');
    if (!preview) return;
    preview.textContent = formatReviewDisplayName();
  }

  function syncReviewNameFields() {
    const nameRadio = document.getElementById('ad-review-name-mode-name');
    const anonRadio = document.getElementById('ad-review-name-mode-anonymous');
    const mode = reviewNameState.reviewNameMode === 'anonymous' ? 'anonymous' : 'name';
    if (nameRadio) nameRadio.checked = mode === 'name';
    if (anonRadio) anonRadio.checked = mode === 'anonymous';
    const example = document.getElementById('ad-review-name-example');
    if (example) {
      example.textContent = reviewNameState.reviewNameExample
        ? '(' + reviewNameState.reviewNameExample + ')'
        : '';
    }
    const alias = document.getElementById('ad-review-networker-alias');
    if (alias) alias.textContent = reviewNameState.networkerAlias || 'Networker ####';
    updateReviewNamePreview();
  }

  async function loadReviewNameState() {
    try {
      const res = await fetch('/api/auth/profile', { credentials: 'include' });
      const data = await res.json();
      if (data.ok && data.profile) {
        reviewNameState.legalName = String(data.profile.name || '').trim();
        reviewNameState.reviewNameMode =
          data.profile.reviewNameMode === 'anonymous' ? 'anonymous' : 'name';
        reviewNameState.networkerAlias =
          String(data.profile.networkerAlias || '').trim() || 'Networker ####';
        reviewNameState.reviewNameExample =
          String(data.profile.reviewNameExample || '').trim() || 'Alex M.';
        reviewNameState.reviewDisplayName =
          String(data.profile.reviewDisplayName || '').trim() || 'Attendee';
      }
    } catch {
      /* keep existing state */
    }
    syncReviewNameFields();
  }

  async function savePublicReviewNameIfChanged() {
    const next = selectedAdReviewNameMode();
    const prev = reviewNameState.reviewNameMode === 'anonymous' ? 'anonymous' : 'name';
    if (next === prev) return true;
    const res = await fetch('/api/auth/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewNameMode: next }),
    });
    const data = await res.json();
    if (!data.ok) {
      const err = new Error(data.message || data.error || 'Could not save review name preference.');
      throw err;
    }
    if (data.profile) {
      reviewNameState.legalName = String(data.profile.name || reviewNameState.legalName || '').trim();
      reviewNameState.reviewNameMode =
        data.profile.reviewNameMode === 'anonymous' ? 'anonymous' : 'name';
      reviewNameState.networkerAlias =
        String(data.profile.networkerAlias || '').trim() || reviewNameState.networkerAlias;
      reviewNameState.reviewNameExample =
        String(data.profile.reviewNameExample || '').trim() || reviewNameState.reviewNameExample;
      reviewNameState.reviewDisplayName =
        String(data.profile.reviewDisplayName || '').trim() || reviewNameState.reviewDisplayName;
    }
    syncReviewNameFields();
    return true;
  }
  let paymentModalOpen = false;
  let cancelModalOpen = false;
  let pendingCancelRegistration = null;
  let highlightRegistrationId = '';
  let dashboardReady = false;
  let renderedRoutes = new Set();
  let routeLoadGen = 0;

  function beginAdRouteLoading() {
    const gen = ++routeLoadGen;
    const main = document.getElementById('hub-main-content');
    if (main) {
      main.classList.add('is-route-loading');
      main.setAttribute('aria-busy', 'true');
    }
    document.body.classList.add('ad-route-loading');
    return { gen: gen };
  }

  function endAdRouteLoading(token) {
    if (token && token.gen !== routeLoadGen) return;
    const main = document.getElementById('hub-main-content');
    if (main) {
      main.classList.remove('is-route-loading');
      main.removeAttribute('aria-busy');
    }
    document.body.classList.remove('ad-route-loading');
  }

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

  function openReviewModal(reg, options) {
    const modal = document.getElementById('ad-review-modal');
    const sub = document.getElementById('ad-review-modal-sub');
    const eventIdInput = document.getElementById('ad-review-event-id');
    const text = document.getElementById('ad-review-text');
    const err = document.getElementById('ad-review-error');
    if (!modal || !eventIdInput) return;

    const opts = options && typeof options === 'object' ? options : {};
    const initialRating = Math.max(0, Math.min(5, Math.round(Number(opts.rating) || 0)));

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
    setReviewStars(initialRating);
    if (initialRating >= 1) showReviewFeedbackStep();
    else resetReviewFeedbackStep();
    syncReviewNameFields();
    loadReviewNameState();
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

    document.querySelectorAll('#ad-review-form input[name="reviewNameMode"]').forEach((input) => {
      input.addEventListener('change', updateReviewNamePreview);
    });

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
          await savePublicReviewNameIfChanged();
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
                : data.error === 'did_not_attend'
                  ? 'This review is only available to people who attended the event.'
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
          const reward =
            (data && data.reviewerReward) ||
            (data && data.review && data.review.reviewerReward) ||
            null;
          if (reward && reward.toastMessage) {
            showAdToast(reward.toastMessage);
          } else {
            showAdToast('Thanks — your review helps this group on The Networker UK.');
          }
          await reloadDashboard();
        } catch (submitErr) {
          if (err) {
            err.textContent =
              (submitErr && submitErr.message) || 'Something went wrong. Please try again.';
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
    if (hash.startsWith('review/')) {
      savedScope = 'reviews';
      reviewsScope = 'pending';
      return 'saved';
    }
    if (hash === 'memberships') return 'memberships';
    if (hash === 'search-alerts') {
      opportunitySavedScope = 'alerts';
      return 'saved-opportunities';
    }
    if (hash === 'saved-opportunities') {
      opportunitySavedScope = 'listings';
      return 'saved-opportunities';
    }
    if (hash === 'opportunity-enquiries' || hash === 'opportunities') {
      opportunitySavedScope = 'enquiries';
      return 'saved-opportunities';
    }
    if (hash === 'reviews-done') {
      savedScope = 'reviews';
      reviewsScope = 'done';
      return 'saved';
    }
    if (hash === 'reviews-pending' || hash === 'reviews') {
      savedScope = 'reviews';
      reviewsScope = 'pending';
      return 'saved';
    }
    if (hash === 'tickets') {
      ticketsScope = 'upcoming';
      return 'tickets';
    }
    if (isTicketsScope(hash)) {
      ticketsScope = hash;
      return 'tickets';
    }
    if (hash === 'visibility' || hash === 'grow-visibility') return 'visibility';
    const allowed = [
      'overview',
      'tickets',
      'saved',
      'saved-opportunities',
      'opportunity-enquiries',
      'visibility',
    ];
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
        closeUtilityMenus();
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
      setListEmptyState('ad-payments-table', 'ad-payments-empty', true);
      return;
    }
    setListEmptyState('ad-payments-table', 'ad-payments-empty', false);

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
        '<td class="ad-td-thumb">' +
        thumbHtml(reg) +
        '</td><td class="ad-td-name" data-label="Event">' +
        eventTitleCell(reg) +
        '</td><td data-label="Booked">' +
        esc(formatDateShort(reg.createdAt)) +
        '</td><td data-label="Reference">' +
        esc(reg.bookingReference || formatBookingReference(reg.id)) +
        '</td><td data-label="Tickets">' +
        esc(reg.ticketLabel || '—') +
        '</td><td data-label="Paid">' +
        esc(
          applicationStatus === 'Pending' || applicationStatus === 'Denied'
            ? '—'
            : formatAmountPaid(reg.amountPaid, reg.paymentStatus)
        ) +
        '</td><td data-label="Application">' +
        applicationBadge(reg) +
        '</td><td data-label="Payment">' +
        paymentBadge(reg.paymentStatus, reg) +
        '</td><td class="ad-td-actions" data-label="Actions"><div class="ad-action-group">' +
        '<button type="button" class="ad-btn ad-btn-primary ad-view-payment" data-registration-id="' +
        esc(reg.id || '') +
        '">Payment details</button>' +
        (isRegistrationPaid(reg) && String(reg.applicationStatus || 'Approved').trim() !== 'Denied'
          ? '<a class="ad-action-link ad-download-invoice" href="' +
            esc(invoiceDownloadHref(reg, 'pdf')) +
            '" target="_blank" rel="noopener noreferrer">Download tax invoice</a>'
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
        '<td class="ad-td-thumb">' +
        thumbHtml(reg) +
        '</td><td class="ad-td-name" data-label="Event">' +
        eventTitleCell(reg) +
        '<div class="ad-cancel-refund-detail">' +
        esc(cancellationRefundDetail(reg)) +
        '</div></td><td data-label="Cancelled">' +
        esc(formatDateShort(reg.cancelledAt)) +
        '</td><td data-label="Reference">' +
        esc(reg.bookingReference || formatBookingReference(reg.id)) +
        '</td><td data-label="Tickets">' +
        esc(reg.ticketLabel || '—') +
        '</td><td data-label="Paid">' +
        esc(formatAmountPaid(reg.amountPaid, reg.paymentStatus)) +
        '</td><td data-label="Refund">' +
        refundStatusBadge(reg) +
        '</td><td class="ad-td-actions" data-label="Actions"><div class="ad-action-group">' +
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
    const ratingParam = Number(new URLSearchParams(location.search).get('rating') || 0);
    const initialRating = ratingParam >= 1 && ratingParam <= 5 ? Math.round(ratingParam) : 0;
    setSavedScope('reviews');
    setReviewsScope('pending');
    setRoute('saved');
    const reg = findRegistrationByEventId(eventId);
    const launch = () => {
      if (!reg) return;
      if (reg.reviewStatus === 'pending') {
        openReviewModal(reg, { rating: initialRating });
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
    try {
      const clean = new URL(location.href);
      clean.searchParams.delete('review');
      clean.searchParams.delete('rating');
      history.replaceState(null, '', clean.pathname + clean.search + '#reviews-pending');
    } catch {
      history.replaceState(null, '', location.pathname + '#reviews-pending');
    }
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
    if (nextRoute === 'memberships') {
      setSavedScope('groups');
      nextRoute = 'saved';
    }
    if (nextRoute === 'reviews') nextRoute = 'reviews-pending';
    if (isReviewsRoute(nextRoute)) {
      setSavedScope('reviews');
      setReviewsScope(reviewsScopeFromRoute(nextRoute));
      nextRoute = 'saved';
    }
    if (isTicketsScope(nextRoute)) {
      setTicketsScope(nextRoute);
      nextRoute = 'tickets';
    }
    if (nextRoute === 'opportunity-enquiries') {
      setOpportunitySavedScope('enquiries');
      nextRoute = 'saved-opportunities';
    }
    currentRoute = nextRoute;
    closeUtilityMenus();
    updateLayoutHeader(layoutRouteKey(currentRoute));
    const activePage = pageRouteKey(currentRoute);
    document.querySelectorAll('[data-ad-page]').forEach((p) => {
      p.classList.toggle('is-active', p.getAttribute('data-ad-page') === activePage);
    });
    syncSideNavHighlight();
    syncBottomNavHighlight();
    if (currentRoute === 'saved' && savedScope === 'events') {
      maybeDefaultSavedScope();
    }
    if (currentRoute === 'saved') {
      setSavedScope(savedScope);
      updateSavedSubpageHead();
    }
    if (currentRoute === 'tickets') {
      setTicketsScope(ticketsScope);
      updateTicketsSubpageHead();
    }
    if (currentRoute === 'saved-opportunities') {
      setOpportunitySavedScope(opportunitySavedScope);
      updateOpportunitySavedSubpageHead();
      loadSavedOpportunities();
    }
    syncRouteHash();
    if (dashboardReady) {
      const key = routeTablesKey(currentRoute);
      const needsPaint = !renderedRoutes.has(key);
      const loadToken = needsPaint ? beginAdRouteLoading() : null;
      renderRouteTables(key);
      if (loadToken) {
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            endAdRouteLoading(loadToken);
          });
        });
      }
    }
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
    if (!id) return '../opportunities/';
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
      const scroll = body.closest('.ad-table-scroll');
      if (scroll) scroll.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    const scroll = body.closest('.ad-table-scroll');
    if (scroll) scroll.hidden = false;

    list.forEach((enquiry) => {
      const tr = document.createElement('tr');
      const message = String(enquiry.message || '').trim();
      const preview = message.length > 120 ? message.slice(0, 117) + '…' : message;
      tr.innerHTML =
        '<td data-label="Sent">' +
        esc(formatDateShort(enquiry.createdAt)) +
        '</td><td class="ad-td-name" data-label="Listing">' +
        esc(enquiry.opportunityTitle || 'Listing') +
        '</td><td class="ad-enquiry-message" data-label="Message">' +
        esc(preview || '—') +
        '</td><td data-label="Status">' +
        enquiryStatusBadge(enquiry.status) +
        '</td><td class="ad-td-actions" data-label="Actions"><a class="ad-btn ad-btn-primary ad-btn-sm" href="' +
        esc(opportunityListingHref(enquiry.opportunityId)) +
        '">View listing</a></td>';
      body.appendChild(tr);
    });
  }

  function reviewerRewardStatMeta(reward, pendingCount) {
    const pending = Math.max(0, Number(pendingCount) || 0);
    const r = reward && typeof reward === 'object' ? reward : null;
    if (pending) return '⭐ ' + pending + ' pending';
    if (r && r.tier && r.tier.shortLabel) return r.tier.shortLabel;
    if (r && r.nextTier && r.nextTier.remaining) {
      return r.nextTier.remaining + ' to Top contributor';
    }
    if (r && r.count) return r.count + ' submitted';
    return 'Review after each event';
  }

  function renderOverviewReviewerReward(stats) {
    const el = document.getElementById('ad-overview-reviewer-reward');
    if (!el) return;
    const reward = (stats && stats.reviewerReward) || null;
    const count = reward && reward.count ? Number(reward.count) : Number(stats && stats.reviewsLeft) || 0;
    const pending = Number(stats && stats.reviewsPending) || 0;
    if (!count && !pending) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    const isTop = Boolean(reward && reward.tier);
    const title = isTop
      ? 'Top contributor'
      : count
        ? count + ' event review' + (count === 1 ? '' : 's')
        : 'Your reviews';
    const nextLine = isTop
      ? 'Thanks for reviewing after events — it helps groups you support on The Networker UK.'
      : reward && reward.nextTier && reward.nextTier.remaining
        ? reward.nextTier.remaining +
          ' more review' +
          (reward.nextTier.remaining === 1 ? '' : 's') +
          ' to become a Top contributor.'
        : 'Leave a review after each event you attend — every one counts.';
    el.innerHTML =
      '<div class="ad-overview-reviewer-reward-card">' +
      '<p class="ad-overview-reviewer-reward-kicker">Reviews</p>' +
      '<h2 class="ad-section-title">' +
      esc(title) +
      (isTop && count ? ' · ' + esc(String(count)) + ' event reviews' : '') +
      '</h2>' +
      '<p class="ad-overview-reviewer-reward-copy">' +
      esc(nextLine) +
      (pending
        ? ' You have ' +
          pending +
          ' review' +
          (pending === 1 ? '' : 's') +
          ' waiting.'
        : '') +
      '</p>' +
      (pending
        ? '<button type="button" class="ad-btn ad-btn-gold ad-overview-reviewer-reward-cta" data-ad-open-reviews>Leave a review</button>'
        : '') +
      '</div>';
    const cta = el.querySelector('[data-ad-open-reviews]');
    if (cta) {
      cta.addEventListener('click', () => {
        setSavedScope('reviews');
        setReviewsScope('pending');
        setRoute('reviews-pending');
      });
    }
  }

  function renderStats(stats) {
    const upcoming = document.getElementById('ad-stat-upcoming');
    const next = document.getElementById('ad-stat-next');
    const reviews = document.getElementById('ad-stat-reviews');
    const pending = document.getElementById('ad-stat-reviews-pending');
    const enquiries = document.getElementById('ad-stat-enquiries');
    const enquiriesHint = document.getElementById('ad-stat-enquiries-hint');
    const pendingCount = Number(stats.reviewsPending) || 0;
    if (upcoming) upcoming.textContent = String(stats.upcomingCount || 0);
    if (next) {
      next.textContent = stats.nextEventDate
        ? 'Next: ' + formatDateShort(stats.nextEventDate)
        : '—';
    }
    if (reviews) {
      reviews.textContent = String(pendingCount > 0 ? pendingCount : stats.reviewsLeft || 0);
    }
    if (pending) {
      pending.textContent =
        pendingCount > 0
          ? reviewerRewardStatMeta(stats.reviewerReward, pendingCount)
          : stats.reviewsLeft
            ? String(stats.reviewsLeft) + ' submitted · ' + reviewerRewardStatMeta(stats.reviewerReward, 0)
            : reviewerRewardStatMeta(stats.reviewerReward, 0);
    }
    renderOverviewReviewerReward(stats);
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

  function setTabCount(id, n) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!dashboardReady || !n) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = String(n);
  }

  function updateSideCounts() {
    const set = (id, n) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (!dashboardReady || !n) {
        el.hidden = true;
        el.textContent = '';
        return;
      }
      el.hidden = false;
      el.textContent = String(n);
    };
    set('ad-side-tickets', upcomingList().length);
    const oppTotal =
      (opportunityEnquiries || []).length + savedOpportunities.length + savedOpportunitySearches.length;
    set('ad-side-opportunities', oppTotal);
    set('ad-side-enquiries', (opportunityEnquiries || []).length);
    set('ad-side-reviews', pendingReviewsList().length);
    set(
      'ad-side-pending',
      myGroups.length + savedEvents.length + savedOrganisers.length
    );
    set('ad-side-reviewed', doneReviewsList().length);
    set('ad-side-saved-opportunities', savedOpportunities.length + savedOpportunitySearches.length);
    set('ad-bottom-tickets', upcomingList().length);
    set(
      'ad-bottom-saved',
      myGroups.length + savedEvents.length + savedOrganisers.length + pendingReviewsList().length
    );
    set('ad-bottom-opportunities', oppTotal);
    setTabCount('ad-tickets-count-upcoming', upcomingList().length);
    setTabCount('ad-tickets-count-past', pastList().length);
    setTabCount('ad-tickets-count-cancellations', (cancelledBookings || []).length);
    setTabCount('ad-opp-saved-count-enquiries', (opportunityEnquiries || []).length);
    setTabCount('ad-opp-saved-count-listings', savedOpportunities.length);
    setTabCount('ad-opp-saved-count-alerts', savedOpportunitySearches.length);
    setTabCount('ad-saved-count-groups', myGroups.length);
    setTabCount('ad-saved-count-events', savedEvents.length);
    setTabCount('ad-saved-count-organisers', savedOrganisers.length);
    setTabCount('ad-saved-count-reviews', pendingReviewsList().length);
    setTabCount('ad-reviews-count-pending', pendingReviewsList().length);
    setTabCount('ad-reviews-count-done', doneReviewsList().length);
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
      if (bodyId === 'ad-upcoming-body') {
        setListEmptyState('ad-upcoming-table', emptyId, true);
      } else if (empty) {
        empty.hidden = false;
      }
      renderPagination(navId, listKey, 1);
      return;
    }
    if (bodyId === 'ad-upcoming-body') {
      setListEmptyState('ad-upcoming-table', emptyId, false);
    } else if (empty) {
      empty.hidden = true;
    }

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
        const dateLabel = reg.isSeriesGroup
          ? reg.seriesDateLabel || formatDateShort(reg.date)
          : formatDateShort(reg.date);
        const timeLabel = reg.isSeriesGroup ? 'All sessions' : formatTimeRange(reg.date, reg.endDate);
        const metaBits = [dateLabel, timeLabel, reg.ticketLabel].filter(function (bit) {
          return bit && String(bit).trim() && String(bit) !== '—';
        });
        tr.innerHTML =
          '<td class="ad-td-thumb">' +
          thumbHtml(reg) +
          '</td><td class="ad-td-name" data-label="Event">' +
          eventTitleCell(reg) +
          '</td><td class="ad-td-meta-compact" data-label="">' +
          '<p class="ad-meta-compact-line">' +
          esc(metaBits.join(' · ')) +
          '</p>' +
          '<div class="ad-meta-compact-badges">' +
          applicationBadge(reg) +
          paymentBadge(reg.paymentStatus, reg) +
          reviewBadge(reg.reviewStatus, reg) +
          '</div></td><td class="ad-td-meta-desk" data-label="Date">' +
          esc(dateLabel) +
          '</td><td class="ad-td-meta-desk" data-label="Time">' +
          esc(timeLabel) +
          '</td><td class="ad-td-meta-desk" data-label="Tickets">' +
          esc(reg.ticketLabel || '—') +
          '</td><td class="ad-td-meta-desk" data-label="Application">' +
          applicationBadge(reg) +
          '</td><td class="ad-td-meta-desk" data-label="Payment">' +
          paymentBadge(reg.paymentStatus, reg) +
          '</td><td class="ad-td-meta-desk" data-label="Review">' +
          reviewBadge(reg.reviewStatus, reg) +
          '</td><td class="ad-td-actions" data-label="Actions"><div class="ad-action-group ad-action-group--with-utilities">' +
          actionCell(reg, { showCancel: listKey === 'upcoming', showTicket: true }) +
          utilityDropdownHtml(reg, {
            showUtilities: listKey === 'upcoming',
            showCancel: listKey === 'upcoming',
          }) +
          '</div></td>';
      } else {
        tr.innerHTML =
          '<td class="ad-td-thumb">' +
          thumbHtml(reg) +
          '</td><td class="ad-td-name" data-label="Event">' +
          eventTitleCell(reg) +
          '</td><td data-label="Date">' +
          esc(formatDateShort(reg.date)) +
          '</td><td data-label="Status">' +
          reviewBadge(reg.reviewStatus, reg) +
          '</td><td class="ad-td-actions" data-label="Actions">' +
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
    bindCalendarLinks(body);
    bindShareButtons(body);

    renderPagination(navId, listKey, totalPages);
  }

  function organiserLogoHtml(reg, className) {
    const logo = String(reg?.organiserLogo || '').trim();
    const cls = className || 'ad-org-logo';
    if (logo) {
      return (
        '<img class="' +
        cls +
        '" src="' +
        esc(logo) +
        '" alt="" width="48" height="48" loading="lazy" />'
      );
    }
    const letter =
      String(reg?.organiserName || reg?.title || '?')
        .trim()
        .charAt(0)
        .toUpperCase() || '?';
    return (
      '<div class="' + cls + ' ad-org-logo-placeholder" aria-hidden="true">' + esc(letter) + '</div>'
    );
  }

  function reviewNudgeCardHtml(reg) {
    const orgName = reg.organiserName || 'this organiser';
    return (
      '<article class="ad-review-nudge" role="listitem">' +
      organiserLogoHtml(reg, 'ad-review-nudge-logo') +
      '<div class="ad-review-nudge-body">' +
      '<p class="ad-review-nudge-title">' +
      esc(reg.title || 'Event') +
      '</p>' +
      '<p class="ad-review-nudge-meta">' +
      esc(orgName) +
      (reg.date ? ' · ' + esc(formatDateShort(reg.date)) : '') +
      '</p>' +
      '<button type="button" class="ad-btn ad-btn-gold ad-leave-review" data-event-id="' +
      esc(reg.eventId || '') +
      '" data-event-title="' +
      esc(reg.title || 'Event') +
      '" data-organiser-name="' +
      esc(reg.organiserName || '') +
      '">Leave a review</button>' +
      '</div></article>'
    );
  }

  function renderPendingReviewCards() {
    const container = document.getElementById('ad-reviews-pending-cards');
    const empty = document.getElementById('ad-reviews-pending-empty');
    if (!container) return;

    const list = pendingReviewsList().sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });

    container.innerHTML = '';
    if (!list.length) {
      container.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    container.hidden = false;

    list.forEach((reg) => {
      const article = document.createElement('article');
      article.className = 'ad-review-card';
      article.setAttribute('role', 'listitem');
      const orgName = reg.organiserName || 'this organiser';
      article.innerHTML =
        organiserLogoHtml(reg, 'ad-review-card-logo-img') +
        '<div class="ad-review-card-body">' +
        '<p class="ad-review-card-title">' +
        esc(reg.title || 'Event') +
        '</p>' +
        '<p class="ad-review-card-meta">' +
        esc(orgName) +
        ' · ' +
        esc(formatDateShort(reg.date)) +
        '</p>' +
        '<button type="button" class="ad-btn ad-btn-gold ad-leave-review" data-event-id="' +
        esc(reg.eventId || '') +
        '" data-event-title="' +
        esc(reg.title || 'Event') +
        '" data-organiser-name="' +
        esc(reg.organiserName || '') +
        '">Leave a review</button>' +
        '</div>';
      container.appendChild(article);
    });
    bindLeaveReviewButtons(container);
  }

  function savedEventsHappeningSoon() {
    const now = Date.now();
    return savedEvents
      .filter((item) => {
        const d = item.startsAt || item.starts_at;
        if (!d) return true;
        const t = new Date(d).getTime();
        return !Number.isNaN(t) && t >= now;
      })
      .sort((a, b) => {
        const ta = new Date(a.startsAt || a.starts_at || 0).getTime();
        const tb = new Date(b.startsAt || b.starts_at || 0).getTime();
        return ta - tb;
      })
      .slice(0, 12);
  }

  function feedCardImageHtml(item) {
    const title = item.title || 'Event';
    const imageUrl = item.photoUrl || item.photo_url || '';
    if (imageUrl) {
      return (
        '<img class="ad-feed-thumb" src="' +
        esc(imageUrl) +
        '" alt="" width="120" height="72" loading="lazy" />'
      );
    }
    const letter = String(title).trim().charAt(0).toUpperCase() || '?';
    return '<div class="ad-feed-thumb ad-feed-thumb-placeholder" aria-hidden="true">' + esc(letter) + '</div>';
  }

  function feedEventCardHtml(item) {
    const href = savedEventHref(item);
    const title = item.title || 'Event';
    const dateStr = formatDateShort(item.startsAt || item.starts_at);
    const city = String(item.city || '').trim();
    const meta = [dateStr, city].filter((part) => part && part !== '—').join(' · ');
    return (
      '<a class="ad-feed-card" href="' +
      esc(href) +
      '" role="listitem">' +
      '<div class="ad-feed-card-media">' +
      feedCardImageHtml(item) +
      '</div>' +
      '<div class="ad-feed-card-body">' +
      '<span class="ad-feed-card-title">' +
      esc(title) +
      '</span>' +
      (meta ? '<span class="ad-feed-card-meta">' + esc(meta) + '</span>' : '') +
      '</div></a>'
    );
  }

  function renderOverviewNextUp() {
    const el = document.getElementById('ad-overview-next');
    if (!el) return;

    const items = [];
    const nextTicket = upcomingList()
      .slice()
      .sort(function (a, b) {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return da - db;
      })[0];
    if (nextTicket) {
      const metaBits = [
        formatDateShort(nextTicket.date),
        nextTicket.isSeriesGroup ? '' : formatTimeRange(nextTicket.date, nextTicket.endDate),
      ].filter(function (bit) {
        return bit && String(bit).trim() && String(bit) !== '—';
      });
      items.push({
        key: 'ticket',
        eyebrow: 'Next booking',
        title: nextTicket.title || 'Event',
        meta: metaBits.join(' · '),
        cta: 'Open tickets',
        route: 'tickets',
      });
    }

    const pending = pendingReviewsList();
    if (pending.length) {
      items.push({
        key: 'review',
        eyebrow: pending.length === 1 ? 'Review to write' : pending.length + ' reviews to write',
        title: pending[0].title || 'Past event',
        meta: String(pending[0].organiserName || '').trim(),
        cta: 'Leave review',
        route: 'reviews-pending',
      });
    }

    const waiting = (opportunityEnquiries || []).filter(function (enquiry) {
      return String(enquiry.status || '').toLowerCase() === 'new';
    });
    if (waiting.length) {
      items.push({
        key: 'enquiry',
        eyebrow:
          waiting.length === 1
            ? 'Enquiry awaiting reply'
            : waiting.length + ' enquiries awaiting reply',
        title: waiting[0].opportunityTitle || 'Business listing',
        meta: '',
        cta: 'View enquiries',
        route: 'opportunity-enquiries',
      });
    }

    const expiring = myGroups.filter(function (item) {
      return item.expiringSoon && item.membershipActive;
    });
    if (expiring.length && items.length < 3) {
      items.push({
        key: 'membership',
        eyebrow: 'Membership',
        title: expiring[0].organiserName || 'Group',
        meta: 'Expiring soon',
        cta: 'View memberships',
        route: 'memberships',
      });
    }

    if (!items.length) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }

    el.hidden = false;
    el.innerHTML =
      '<h2 class="ad-section-title">Next up</h2>' +
      '<div class="ad-overview-next-list" role="list">' +
      items
        .map(function (item) {
          return (
            '<button type="button" class="ad-overview-next-card ad-overview-next-card--' +
            esc(item.key) +
            '" role="listitem" data-overview-next-route="' +
            esc(item.route) +
            '">' +
            '<span class="ad-overview-next-eyebrow">' +
            esc(item.eyebrow) +
            '</span>' +
            '<span class="ad-overview-next-title">' +
            esc(item.title) +
            '</span>' +
            (item.meta
              ? '<span class="ad-overview-next-meta">' + esc(item.meta) + '</span>'
              : '') +
            '<span class="ad-overview-next-cta">' +
            esc(item.cta) +
            ' →</span>' +
            '</button>'
          );
        })
        .join('') +
      '</div>';

    el.querySelectorAll('[data-overview-next-route]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const route = btn.getAttribute('data-overview-next-route') || 'overview';
        if (route === 'tickets') {
          setTicketsScope('upcoming');
          setRoute('tickets');
          return;
        }
        if (route === 'memberships') {
          goToMemberships();
          return;
        }
        setRoute(route);
      });
    });
  }

  function renderOverviewMembershipNudge() {
    const el = document.getElementById('ad-overview-membership-nudge');
    if (!el) return;
    if (!myGroups.length) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }

    const expiring = myGroups.filter((item) => item.expiringSoon && item.membershipActive);
    const expired = myGroups.filter((item) => !item.membershipActive);
    const summaryParts = [myGroups.length + (myGroups.length === 1 ? ' membership' : ' memberships')];
    if (expiring.length) {
      summaryParts.push(expiring.length + ' expiring soon');
    } else if (expired.length) {
      summaryParts.push(expired.length + ' expired');
    }

    const warnClass = expiring.length ? ' ad-overview-membership-nudge--warn' : '';
    el.hidden = false;
    el.innerHTML =
      '<div class="ad-overview-membership-nudge-card' +
      warnClass +
      '">' +
      '<div class="ad-overview-membership-nudge-head">' +
      '<h2 class="ad-section-title">Your memberships</h2>' +
      '<p class="ad-overview-membership-nudge-summary">' +
      esc(summaryParts.join(' · ')) +
      '</p>' +
      '</div>' +
      '<ul class="ad-overview-membership-nudge-list">' +
      myGroups
        .slice(0, 3)
        .map((item) => {
          const href = membershipOrganiserHref(item);
          return (
            '<li class="ad-overview-membership-nudge-item">' +
            '<div class="ad-overview-membership-nudge-item-main">' +
            '<a class="ad-overview-membership-nudge-name" href="' +
            esc(href) +
            '">' +
            esc(item.organiserName || 'Group') +
            '</a>' +
            membershipStatusBadge(item) +
            '</div>' +
            '<a class="ad-btn ad-btn-primary ad-btn-sm" href="' +
            esc(href) +
            '">View member events</a>' +
            '</li>'
          );
        })
        .join('') +
      '</ul>' +
      (myGroups.length > 3
        ? '<p class="ad-overview-more"><a href="#memberships">View all ' +
          myGroups.length +
          ' memberships →</a></p>'
        : '<p class="ad-overview-more"><a href="#memberships">View memberships →</a></p>') +
      '<p class="ad-overview-membership-nudge-footnote">Renewals are handled by your networking group — contact them directly, not through The Networker UK.</p>' +
      '</div>';

    el.querySelectorAll('a[href="#memberships"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        goToMemberships();
      });
    });
  }

  function renderOverviewReviewNudge() {
    const el = document.getElementById('ad-overview-review-nudge');
    if (!el) return;
    const pending = pendingReviewsList();
    if (!pending.length) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    el.innerHTML =
      '<h2 class="ad-section-title ad-section-title--spaced">Reviews to write</h2>' +
      '<p class="ad-overview-review-nudge-lead">Share quick feedback after events you attended — it only takes a minute and helps groups you support.</p>' +
      '<div class="ad-review-nudges" role="list">' +
      pending
        .slice(0, 3)
        .map((reg) => reviewNudgeCardHtml(reg))
        .join('') +
      '</div>' +
      (pending.length > 3
        ? '<p class="ad-overview-more"><a href="#reviews-pending">View all ' +
          pending.length +
          ' pending reviews →</a></p>'
        : '');
    bindLeaveReviewButtons(el);
  }

  function renderOverviewFeed() {
    renderOverviewNextUp();
    renderOverviewMembershipNudge();
    renderOverviewReviewNudge();

    const feed = document.getElementById('ad-overview-feed');
    const scroll = document.getElementById('ad-overview-feed-scroll');
    if (!feed || !scroll) return;

    const items = savedEventsHappeningSoon();
    if (!items.length) {
      feed.hidden = true;
      scroll.innerHTML = '';
      return;
    }

    feed.hidden = false;
    scroll.innerHTML = items.map((item) => feedEventCardHtml(item)).join('');
  }

  function savedEventHref(item) {
    const slug = item.slug ? String(item.slug).trim() : '';
    if (slug) return '../events/' + encodeURIComponent(slug);
    return '../events/event?id=' + encodeURIComponent(item.eventId || item.id || '');
  }

  function renderSavedTable() {
    const body = document.getElementById('ad-saved-body');
    const empty = document.getElementById('ad-saved-empty');
    if (!body) return;

    body.innerHTML = '';
    if (!savedEvents.length) {
      setListEmptyState('ad-saved-events-table', 'ad-saved-empty', true);
      return;
    }
    setListEmptyState('ad-saved-events-table', 'ad-saved-empty', false);

    savedEvents.forEach((item) => {
      const tr = document.createElement('tr');
      const favItem = {
        title: item.title,
        imageUrl: item.photoUrl || item.photo_url || '',
      };
      tr.innerHTML =
        '<td class="ad-td-thumb">' +
        thumbHtml(favItem) +
        '</td><td class="ad-td-name" data-label="Event"><a href="' +
        esc(savedEventHref(item)) +
        '">' +
        esc(item.title || 'Event') +
        '</a></td><td data-label="Date">' +
        esc(formatDateShort(item.startsAt || item.starts_at)) +
        '</td><td data-label="Location">' +
        esc(item.city || '—') +
        '</td><td class="ad-td-actions" data-label="Actions"><button type="button" class="ad-action-link ad-action-link--danger ad-saved-remove" data-event-id="' +
        esc(item.eventId || item.event_id || '') +
        '">Remove</button></td>';
      body.appendChild(tr);
    });

    body.querySelectorAll('.ad-saved-remove').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const eventId = btn.getAttribute('data-event-id');
        if (!eventId) return;
        if (!window.confirm('Remove this event from your saved list?')) return;
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
          if (currentRoute === 'overview') renderOverviewFeed();
        } catch {
          btn.disabled = false;
        }
      });
    });
  }

  function savedOrganiserHref(item) {
    const slug = item.slug ? String(item.slug).trim() : '';
    if (slug) return '../organisers/' + encodeURIComponent(slug);
    return '../events/organiser?id=' + encodeURIComponent(item.organiserId || item.organiser_id || item.id || '');
  }

  function savedOpportunityHref(item) {
    const slug = item.slug ? String(item.slug).trim() : '';
    if (slug) return '../opportunities/' + encodeURIComponent(slug);
    return '/opportunities/opportunity?id=' + encodeURIComponent(item.opportunityId || item.opportunity_id || item.id || '');
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

  function readStoredOpportunityItems() {
    if (window.HubOpportunitySaves && typeof window.HubOpportunitySaves.readLocalItems === 'function') {
      return window.HubOpportunitySaves.readLocalItems();
    }
    try {
      const raw = localStorage.getItem('hubSavedOpportunityItems');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function readStoredOpportunityIds() {
    if (window.HubOpportunitySaves && typeof window.HubOpportunitySaves.readLocal === 'function') {
      return window.HubOpportunitySaves.readLocal();
    }
    try {
      const raw = localStorage.getItem('hubSavedOpportunityIds');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  function localOpportunityCacheAllowed() {
    return !(
      window.HubOpportunitySaves &&
      typeof window.HubOpportunitySaves.canUseLocalCache === 'function' &&
      !window.HubOpportunitySaves.canUseLocalCache()
    );
  }

  function applySavedOpportunityData(data) {
    let list = [];
    const serverOk = !!(data && data.ok);
    const allowLocal = localOpportunityCacheAllowed();

    if (serverOk) {
      if (Array.isArray(data.favourites)) {
        list = data.favourites.slice();
      }
      if (Array.isArray(data.opportunityIds) && data.opportunityIds.length) {
        const seen = new Set(
          list.map((item) => String(item.opportunityId || item.opportunity_id || '').trim()).filter(Boolean)
        );
        data.opportunityIds.forEach((id) => {
          const key = String(id || '').trim();
          if (key && !seen.has(key)) {
            list.push({ opportunityId: key, title: 'Opportunity' });
            seen.add(key);
          }
        });
      }
    } else if (allowLocal) {
      const localItems = readStoredOpportunityItems();
      if (localItems.length) {
        list = localItems.map((item) => ({
          opportunityId: item.opportunityId || item.opportunity_id,
          title: item.title || 'Opportunity',
          host: item.host || '',
          slug: item.slug || '',
          logoUrl: item.logoUrl || item.imageUrl || '',
          imageUrl: item.imageUrl || item.logoUrl || '',
          createdAt: item.createdAt || item.created_at || item.savedAt || null,
        }));
      }
      const seen = new Set(
        list.map((item) => String(item.opportunityId || item.opportunity_id || '').trim()).filter(Boolean)
      );
      readStoredOpportunityIds().forEach((id) => {
        const key = String(id || '').trim();
        if (key && !seen.has(key)) {
          list.push({ opportunityId: key, title: 'Opportunity' });
          seen.add(key);
        }
      });
    }

    savedOpportunities = list.map(enrichSavedOpportunity);

    if (window.HubOpportunitySaves && allowLocal) {
      const mergedIds = savedOpportunities
        .map((item) => String(item.opportunityId || item.opportunity_id || '').trim())
        .filter(Boolean);
      if (mergedIds.length) {
        window.HubOpportunitySaves.writeLocal(mergedIds);
        window.HubOpportunitySaves.writeLocalItems(
          savedOpportunities.map((item) => ({
            opportunityId: item.opportunityId || item.opportunity_id,
            id: item.opportunityId || item.opportunity_id,
            title: item.title || 'Opportunity',
            host: item.host || '',
            slug: item.slug || '',
            type: item.type || '',
            logoUrl: item.logoUrl || item.imageUrl || '',
            imageUrl: item.imageUrl || item.logoUrl || '',
            locationLabel: item.locationLabel || '',
            investment: item.investment || '',
            commitment: item.commitment || '',
            meta: Array.isArray(item.meta) ? item.meta : [],
            createdAt: item.createdAt || item.created_at || new Date().toISOString(),
          }))
        );
      } else if (serverOk && Array.isArray(data.opportunityIds)) {
        window.HubOpportunitySaves.writeLocal(data.opportunityIds);
        if (!data.opportunityIds.length && typeof window.HubOpportunitySaves.writeLocalItems === 'function') {
          window.HubOpportunitySaves.writeLocalItems([]);
        }
      }
    }

    const syncNote = document.getElementById('ad-saved-opportunities-sync');
    if (syncNote) {
      const apiFailed = data && data.ok === false;
      const hasLocalOnly = savedOpportunities.length > 0 && apiFailed;
      syncNote.hidden = !hasLocalOnly;
      if (hasLocalOnly) {
        syncNote.textContent =
          data.message ||
          data.error ||
          'Showing saves from this browser. Cloud sync is unavailable until the database migration is applied.';
      }
    }

    maybeDefaultSavedScope();
    if (dashboardReady && currentRoute === 'saved-opportunities') {
      renderRouteTables('saved-opportunities', { force: true });
    } else if (dashboardReady && currentRoute === 'saved') {
      renderRouteTables('saved', { force: true });
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
    toolbar.hidden =
      currentRoute !== 'saved-opportunities' ||
      opportunitySavedScope !== 'listings' ||
      !savedOpportunities.length;
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
        openSavedOpportunityCompare();
      });
    }
  }

  async function openSavedOpportunityCompare(forceIds) {
    const cmp = window.HubOpportunityCompare;
    if (!cmp) return false;

    await ensureOpportunitiesCatalog();

    let ids = Array.isArray(forceIds) && forceIds.length ? forceIds.map(String) : cmp.ids();
    if (ids.length < 2) {
      ids = savedOpportunities
        .map((item) => String(item.opportunityId || item.opportunity_id || '').trim())
        .filter(Boolean)
        .slice(0, cmp.MAX);
      if (ids.length >= 2 && typeof cmp.setIds === 'function') {
        cmp.setIds(ids);
      }
    }
    if (ids.length < 2) return false;

    const existing = document.getElementById('opp-compare-modal');
    if (existing) existing.remove();

    const html = cmp.renderModal(window.HubOpportunitiesCatalog, ids, savedOpportunities);
    if (!html) return false;
    document.body.insertAdjacentHTML('beforeend', html);
    cmp.bindModal(document.getElementById('opp-compare-modal'));
    refreshCompareToolbar();
    return true;
  }

  function openCompareFromQuery() {
    const params = new URLSearchParams(location.search);
    const wantCompare = params.get('compare') === '1';
    const scope = String(params.get('scope') || '').trim().toLowerCase();
    if (!wantCompare && scope !== 'opportunities') return;

    setRoute('saved-opportunities');

    if (!wantCompare) return;

    const cmp = window.HubOpportunityCompare;
    if (cmp && typeof cmp.setIds === 'function') {
      const seed = (
        window.HubOpportunitySaves
          ? window.HubOpportunitySaves.ids()
          : savedOpportunities.map((item) => item.opportunityId || item.opportunity_id)
      )
        .map(String)
        .filter(Boolean)
        .slice(0, cmp.MAX);
      if (seed.length) cmp.setIds(seed);
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        openSavedOpportunityCompare();
        const clean = new URL(location.href);
        clean.searchParams.delete('compare');
        clean.searchParams.delete('scope');
        history.replaceState(null, '', clean.pathname + clean.search + '#saved-opportunities');
      });
    });
  }

  function renderSavedOpportunitiesTable() {
    const body = document.getElementById('ad-saved-opportunities-body');
    const empty = document.getElementById('ad-saved-opportunities-empty');
    const cmp = window.HubOpportunityCompare;
    if (!body) return;

    body.innerHTML = '';
    refreshCompareToolbar();
    if (!savedOpportunities.length) {
      setListEmptyState('ad-saved-opportunities-table', 'ad-saved-opportunities-empty', true);
      return;
    }
    setListEmptyState('ad-saved-opportunities-table', 'ad-saved-opportunities-empty', false);

    savedOpportunities.forEach((item) => {
      const tr = document.createElement('tr');
      const oppId = String(item.opportunityId || item.opportunity_id || '');
      const checked = cmp && cmp.isSelected(oppId);
      const favItem = {
        title: item.title,
        imageUrl: item.logoUrl || item.imageUrl || item.logo_url || item.image_url || '',
      };
      tr.innerHTML =
        '<td class="ad-td-check" data-label="Compare"><input type="checkbox" class="ad-compare-check" data-opportunity-id="' +
        esc(oppId) +
        '" aria-label="Compare ' +
        esc(item.title || 'opportunity') +
        '"' +
        (checked ? ' checked' : '') +
        ' /></td><td class="ad-td-thumb">' +
        thumbHtml(favItem) +
        '</td><td class="ad-td-name" data-label="Opportunity"><a href="' +
        esc(savedOpportunityHref(item)) +
        '">' +
        esc(item.title || 'Opportunity') +
        '</a></td><td data-label="Listed by">' +
        esc(item.host || '—') +
        '</td><td data-label="Saved">' +
        esc(formatDateShort(item.createdAt || item.created_at)) +
        '</td><td class="ad-td-actions" data-label="Actions"><button type="button" class="ad-action-link ad-action-link--danger ad-saved-opportunity-remove" data-opportunity-id="' +
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
        if (!window.confirm('Remove this opportunity from your saved list?')) return;
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

  function ensureMyGroupsListEl() {
    let list = document.getElementById('ad-my-groups-list');
    if (list) return list;

    const legacyBody = document.getElementById('ad-my-groups-body');
    const pane = document.querySelector('[data-saved-pane="groups"]');
    if (!pane) return null;

    if (legacyBody) {
      const tableWrap = legacyBody.closest('.ad-table-scroll');
      if (tableWrap) tableWrap.remove();
      pane.querySelectorAll('.ad-section-sub').forEach((el) => el.remove());
    }

    let inner = pane.querySelector('.ad-saved-pane-inner');
    if (!inner) {
      inner = document.createElement('div');
      inner.className = 'ad-saved-pane-inner';
      pane.appendChild(inner);
    }

    list = document.createElement('div');
    list.id = 'ad-my-groups-list';
    list.className = 'ad-membership-cards';
    list.setAttribute('role', 'list');
    inner.insertBefore(list, inner.firstChild);
    return list;
  }

  function renderMyGroupsList() {
    const list = ensureMyGroupsListEl();
    const empty = document.getElementById('ad-my-groups-empty');
    const footnote = document.querySelector('.ad-membership-footnote');
    if (!list) return;

    list.innerHTML = '';
    if (!myGroups.length) {
      list.hidden = true;
      if (empty) empty.hidden = false;
      if (footnote) footnote.hidden = true;
      return;
    }

    list.hidden = false;
    if (empty) empty.hidden = true;
    if (footnote) footnote.hidden = false;

    myGroups.forEach((item) => {
      const favItem = {
        title: item.organiserName || item.name,
        imageUrl: item.organiserPhotoUrl || '',
      };
      const account = item.claimedAt || item.attendeeId ? 'Signed up on The Networker UK' : 'Invite sent — use the same email to sign in';
      const href = membershipOrganiserHref(item);
      const card = document.createElement('article');
      card.className = 'ad-membership-card';
      card.setAttribute('role', 'listitem');
      card.innerHTML =
        '<div class="ad-membership-card-main">' +
        '<div class="ad-membership-card-logo">' +
        thumbHtml(favItem) +
        '</div>' +
        '<div class="ad-membership-card-copy">' +
        '<a class="ad-membership-card-name" href="' +
        esc(href) +
        '">' +
        esc(item.organiserName || 'Group') +
        '</a>' +
        '<p class="ad-membership-card-meta">' +
        esc(account) +
        '</p>' +
        '</div>' +
        '<div class="ad-membership-card-status">' +
        membershipStatusBadge(item) +
        '</div>' +
        '</div>' +
        '<div class="ad-membership-card-actions">' +
        '<a class="ad-btn ad-btn-primary" href="' +
        esc(href) +
        '">View member events</a>' +
        (item.organiserId
          ? '<button type="button" class="ad-btn ad-btn-ghost" data-membership-renew="' +
            esc(item.organiserId) +
            '" data-membership-interval="' +
            esc(item.billingInterval === 'month' ? 'month' : 'year') +
            '" data-membership-portal="' +
            (item.billedThroughHub && item.stripeCustomerId ? '1' : '0') +
            '">' +
            (item.billedThroughHub && item.membershipActive
              ? item.paymentFailed
                ? 'Update payment'
                : 'Manage membership'
              : 'Pay / renew on the platform') +
            '</button>'
          : '') +
        '</div>';
      list.appendChild(card);
    });

    list.querySelectorAll('[data-membership-renew]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        renewMembershipViaHub(btn);
      });
    });
  }

  async function renewMembershipViaHub(btn) {
    const organiserId = btn.getAttribute('data-membership-renew');
    let interval = btn.getAttribute('data-membership-interval') || 'year';
    const usePortal = btn.getAttribute('data-membership-portal') === '1';
    if (!organiserId) return;
    btn.disabled = true;
    try {
      if (usePortal) {
        const portalRes = await fetch('/api/auth/membership-portal', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organiserId: organiserId }),
        });
        const portalData = await portalRes.json().catch(function () {
          return {};
        });
        if (portalRes.ok && portalData.url) {
          location.href = portalData.url;
          return;
        }
        // Fall through to checkout if portal unavailable.
      }
      // Prefer annual when renewing from account unless they already pay monthly.
      if (interval !== 'month' && interval !== 'year') interval = 'year';
      const res = await fetch('/api/auth/membership-checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organiserId: organiserId, interval: interval }),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || !data.url) {
        // If preferred interval isn't offered, try the other.
        if (data.error === 'membership_not_offered') {
          const alt = interval === 'month' ? 'year' : 'month';
          const res2 = await fetch('/api/auth/membership-checkout', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ organiserId: organiserId, interval: alt }),
          });
          const data2 = await res2.json().catch(function () {
            return {};
          });
          if (!res2.ok || !data2.url) {
            throw new Error(data2.message || data.message || 'Membership checkout unavailable');
          }
          location.href = data2.url;
          return;
        }
        throw new Error(data.message || data.error || 'Could not start checkout');
      }
      location.href = data.url;
    } catch (e) {
      alert(e.message || 'Could not start membership checkout.');
      btn.disabled = false;
    }
  }

  function renderSavedOrganisersTable() {
    const body = document.getElementById('ad-saved-organisers-body');
    const empty = document.getElementById('ad-saved-organisers-empty');
    if (!body) return;

    body.innerHTML = '';
    if (!savedOrganisers.length) {
      setListEmptyState('ad-saved-organisers-table', 'ad-saved-organisers-empty', true);
      return;
    }
    setListEmptyState('ad-saved-organisers-table', 'ad-saved-organisers-empty', false);

    savedOrganisers.forEach((item) => {
      const tr = document.createElement('tr');
      const favItem = {
        title: item.name,
        imageUrl: item.photoUrl || item.photo_url || '',
      };
      const rating = item.rating != null && Number(item.rating) > 0 ? Number(item.rating).toFixed(1) + '★' : '—';
      tr.innerHTML =
        '<td class="ad-td-thumb">' +
        thumbHtml(favItem) +
        '</td><td class="ad-td-name" data-label="Organiser"><a href="' +
        esc(savedOrganiserHref(item)) +
        '">' +
        esc(item.name || 'Organiser') +
        '</a></td><td data-label="Industry">' +
        esc(item.industry || '—') +
        '</td><td data-label="Rating">' +
        esc(rating) +
        '</td><td class="ad-td-actions" data-label="Actions"><button type="button" class="ad-action-link ad-action-link--danger ad-saved-organiser-remove" data-organiser-id="' +
        esc(item.organiserId || item.organiser_id || '') +
        '">Remove</button></td>';
      body.appendChild(tr);
    });

    body.querySelectorAll('.ad-saved-organiser-remove').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const organiserId = btn.getAttribute('data-organiser-id');
        if (!organiserId) return;
        if (!window.confirm('Remove this organiser from your saved list?')) return;
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
      setListEmptyState('ad-saved-searches-table', 'ad-saved-searches-empty', true);
      return;
    }
    setListEmptyState('ad-saved-searches-table', 'ad-saved-searches-empty', false);

    const q = window.HubOpportunityQuality;
    savedOpportunitySearches.forEach((item) => {
      const tr = document.createElement('tr');
      const criteria = item.criteria || {};
      const label =
        String(item.label || '').trim() ||
        (q && q.criteriaLabel ? q.criteriaLabel(criteria) : 'Saved search');
      const href =
        q && q.criteriaToUrl ? q.criteriaToUrl(criteria, '../opportunities/') : '../opportunities/';
      const lastAlert = item.lastNotifiedAt || item.last_notified_at;
      tr.innerHTML =
        '<td class="ad-td-name" data-label="Search filters"><a href="' +
        esc(href) +
        '">' +
        esc(label) +
        '</a></td><td data-label="Saved">' +
        esc(formatDateShort(item.createdAt || item.created_at)) +
        '</td><td data-label="Last alert">' +
        esc(lastAlert ? formatDateShort(lastAlert) : 'None yet') +
        '</td><td class="ad-td-actions" data-label="Actions"><div class="ad-action-group ad-action-group--inline">' +
        '<a class="ad-btn ad-btn-ghost ad-btn-sm" href="' +
        esc(href) +
        '">View matches</a>' +
        '<button type="button" class="ad-action-link ad-action-link--danger ad-saved-search-remove" data-search-id="' +
        esc(item.id || '') +
        '">Remove</button></div></td>';
      body.appendChild(tr);
    });

    body.querySelectorAll('.ad-saved-search-remove').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const searchId = btn.getAttribute('data-search-id');
        if (!searchId) return;
        if (!window.confirm('Remove this saved search and stop its alerts?')) return;
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
          updateSideCounts();
        } catch {
          btn.disabled = false;
        }
      });
    });
  }

  async function loadSavedOpportunities() {
    // Paint browser saves immediately so the compare table is never blank while syncing.
    if (localOpportunityCacheAllowed()) {
      applySavedOpportunityData(null);
    }
    try {
      if (window.HubOpportunitySaves && window.HubOpportunitySaves.adoptSession) {
        const sessionData =
          typeof window.hubFetchSession === 'function'
            ? await window.hubFetchSession()
            : null;
        if (sessionData) await window.HubOpportunitySaves.adoptSession(sessionData);
      } else if (window.HubOpportunitySaves && window.HubOpportunitySaves.mergeOnLogin) {
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
    if (dashboardReady && currentRoute === 'saved-opportunities') {
      renderRouteTables('saved-opportunities', { force: true });
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
    if (dashboardReady && currentRoute === 'overview') {
      renderOverviewFeed();
    }
  }

  function routeTablesKey(route) {
    if (route === 'tickets') return ticketsScope;
    return route;
  }

  function renderRouteTables(route, options) {
    if (!dashboardReady) return;
    const force = Boolean(options && options.force);
    const key = route || 'overview';
    if (!force && renderedRoutes.has(key)) return;

    const loadToken = force && !document.body.classList.contains('ad-route-loading')
      ? beginAdRouteLoading()
      : null;

    updateSideCounts();

    if (key === 'overview') {
      renderOverviewFeed();
      renderedRoutes.add(key);
      if (loadToken) endAdRouteLoading(loadToken);
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
    } else if (key === 'saved') {
      maybeDefaultSavedScope();
      try {
        renderMyGroupsList();
      } catch (err) {
        /* non-fatal */
      }
      try {
        renderSavedTable();
      } catch (err) {
        /* non-fatal */
      }
      try {
        renderSavedOrganisersTable();
      } catch (err) {
        /* non-fatal */
      }
      try {
        renderPendingReviewCards();
        renderEventRows(
          'ad-reviews-done-body',
          'ad-reviews-done-empty',
          null,
          'reviews-done',
          doneReviewsList(),
          false
        );
      } catch (err) {
        /* non-fatal */
      }
    } else if (key === 'payments') {
      renderPaymentsTable();
    } else if (key === 'cancellations') {
      renderCancellationsTable();
    } else if (key === 'saved-opportunities') {
      try {
        renderOpportunityEnquiries();
      } catch (err) {
        /* non-fatal */
      }
      try {
        renderSavedOpportunitiesTable();
      } catch (err) {
        /* non-fatal */
      }
      try {
        renderSavedOpportunitySearchesTable();
      } catch (err) {
        /* non-fatal */
      }
    } else if (key === 'opportunity-enquiries') {
      setOpportunitySavedScope('enquiries');
      renderOpportunityEnquiries();
    }

    renderedRoutes.add(key);
    if (loadToken) {
      window.requestAnimationFrame(function () {
        endAdRouteLoading(loadToken);
      });
    }
  }

  function applyDashboardData(data) {
    registrations = groupSeriesRegistrations(data.registrations || []);
    cancelledBookings = data.cancelledBookings || [];
    opportunityEnquiries = data.opportunityEnquiries || [];
    myGroups = data.myGroups || [];
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
    renderRouteTables('payments', { force: true });
    renderRouteTables('cancellations', { force: true });
    if (savedEvents.length || myGroups.length || savedOrganisers.length || pendingReviewsList().length || doneReviewsList().length) {
      renderRouteTables('saved', { force: true });
    }
    renderRouteTables('saved-opportunities', { force: true });
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
    const bottomNav = document.querySelector('.ad-bottom-nav');
    if (bottomNav && bottomNav.parentElement !== document.body) {
      document.body.appendChild(bottomNav);
    }
    document.querySelectorAll('[data-ad-route]').forEach((a) => {
      if (a.dataset.boundAdRoute) return;
      a.dataset.boundAdRoute = '1';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        setRoute(a.getAttribute('data-ad-route') || 'overview');
      });
    });
    window.addEventListener('hashchange', () => setRoute(parseRoute()));
  }

  function bindStatCards() {
    document.querySelectorAll('[data-ad-stat-route]').forEach((btn) => {
      if (btn.dataset.boundStatRoute) return;
      btn.dataset.boundStatRoute = '1';
      btn.addEventListener('click', () => {
        let route = btn.getAttribute('data-ad-stat-route') || 'overview';
        if (route === 'reviews') {
          setSavedScope('reviews');
          setReviewsScope(pendingReviewsList().length > 0 ? 'pending' : 'done');
          route = 'saved';
        }
        if (route === 'opportunity-enquiries') {
          setOpportunitySavedScope('enquiries');
          route = 'saved-opportunities';
        }
        setRoute(route);
      });
    });
  }

  function bindHubContextSwitch() {
    initOrganiserContextBanner();
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

  function initOrganiserContextBanner() {
    const banner = document.getElementById('ad-organiser-context');
    if (!banner) return;
    if (localStorage.getItem(ORGANISER_CONTEXT_DISMISS_KEY) === '1') {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    const dismissBtn = document.getElementById('ad-organiser-context-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        localStorage.setItem(ORGANISER_CONTEXT_DISMISS_KEY, '1');
        banner.hidden = true;
      });
    }
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
    bindStatCards();
    bindHubContextSwitch();
    bindSavedScope();
    bindTicketsScope();
    bindOpportunitySavedScope();
    bindReviewsScope();
    bindReviewModal();
    bindViewReviewModal();
    bindPaymentModal();
    bindCancelModal();
    bindShareModal();
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
        signInLink.href = '../login?next=' + encodeURIComponent(returnTo);
      }
      return;
    }

    if (signin) signin.hidden = true;
    if (shell) shell.hidden = false;
    setDashboardLoading(true);
    renderWelcome(sessionData.user);

    try {
      ensureAttendeeHubMode();

      try {
        if (window.HubOpportunitySaves && window.HubOpportunitySaves.adoptSession) {
          await window.HubOpportunitySaves.adoptSession(sessionData);
        } else if (window.HubOpportunitySaves && window.HubOpportunitySaves.mergeOnLogin) {
          await window.HubOpportunitySaves.mergeOnLogin();
        }
        if (window.HubFavourites && window.HubFavourites.adoptSession) {
          await window.HubFavourites.adoptSession(sessionData);
        }
        if (window.HubOrganiserFavourites && window.HubOrganiserFavourites.adoptSession) {
          await window.HubOrganiserFavourites.adoptSession(sessionData);
        }
      } catch {
        /* non-fatal — dashboard still falls back to server fetches */
      }
      // Show local saves before the network round-trip finishes (never while
      // impersonating / when local cache belongs to another account).
      if (localOpportunityCacheAllowed()) {
        applySavedOpportunityData(null);
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
        openCompareFromQuery();
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
        if (dashboardReady && currentRoute === 'saved-opportunities') {
          setOpportunitySavedScope(opportunitySavedScope);
          renderRouteTables('saved-opportunities', { force: true });
        }
      } catch {
        savedOpportunitySearches = [];
      }

      applyDashboardData(data);
      maybeDefaultSavedScope();
      openCompareFromQuery();

      const membershipParams = new URLSearchParams(location.search);
      const membershipSuccess = membershipParams.get('membership') === 'success';
      if (membershipSuccess) {
        const note = document.getElementById('ad-demo-note');
        if (note) {
          note.hidden = false;
          note.textContent =
            'Membership payment received. Updating your expiry date…';
        }
        const successOrganiserId = membershipParams.get('organiserId') || '';
        membershipParams.delete('membership');
        membershipParams.delete('organiserId');
        const clean =
          location.pathname +
          (membershipParams.toString() ? '?' + membershipParams.toString() : '') +
          (location.hash || '#memberships');
        history.replaceState(null, '', clean);

        async function syncMembershipExpiry() {
          try {
            await fetch('/api/auth/membership-sync', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(
                successOrganiserId ? { organiserId: successOrganiserId } : {}
              ),
            });
          } catch {
            /* webhook may still land */
          }
          await reloadDashboard();
          if (note) {
            note.hidden = false;
            note.textContent = 'Membership payment received. Your expiry date is up to date.';
          }
        }

        window.setTimeout(function () {
          syncMembershipExpiry().catch(function () {
            if (note) {
              note.hidden = false;
              note.textContent =
                'Membership payment received. Refresh the page if your expiry date still looks old.';
            }
          });
        }, 1500);
      } else {
        const demoNote = document.getElementById('ad-demo-note');
        if (demoNote) demoNote.hidden = !data.isDemo;
      }

      openPaymentFromQuery();
      openReviewFromQuery();
    } finally {
      setDashboardLoading(false);
    }
  }

  init();
})();
