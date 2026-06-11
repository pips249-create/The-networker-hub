/**
 * Attendee account dashboard — /api/auth/attendee-dashboard
 */
(function () {
  const PAGE_SIZE = 5;
  const listPages = { upcoming: 1, past: 1 };
  let registrations = [];
  let savedEvents = [];
  let opportunityEnquiries = [];
  let currentRoute = 'overview';

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
    if (item.imageUrl) {
      return (
        '<img class="ad-thumb" src="' +
        esc(item.imageUrl) +
        '" alt="" width="44" height="44" loading="lazy" />'
      );
    }
    const letter = String(name).trim().charAt(0).toUpperCase() || '?';
    return '<div class="ad-thumb-placeholder" aria-hidden="true">' + esc(letter) + '</div>';
  }

  function reviewBadge(status, reg) {
    if (status === 'reviewed') {
      const stars = reg && reg.rating ? ' · ' + reg.rating + '★' : '';
      return '<span class="ad-badge ad-badge-green">✓ Reviewed' + esc(stars) + '</span>';
    }
    if (status === 'pending') {
      return '<span class="ad-badge ad-badge-red">⚠ Pending</span>';
    }
    if (status === 'ineligible') {
      return '<span class="ad-badge ad-badge-grey">—</span>';
    }
    return '<span class="ad-badge ad-badge-grey">Upcoming</span>';
  }

  function paymentBadge(status) {
    const s = String(status || 'Pending');
    if (s === 'Paid' || s === 'Free') {
      return '<span class="ad-badge ad-badge-green">' + esc(s) + '</span>';
    }
    if (s === 'Refunded') {
      return '<span class="ad-badge ad-badge-grey">' + esc(s) + '</span>';
    }
    return '<span class="ad-badge ad-badge-red">' + esc(s) + '</span>';
  }

  function eventHref(reg) {
    const slug = reg.slug ? String(reg.slug).trim() : '';
    if (slug) return '../events/' + encodeURIComponent(slug);
    return '../events/event.html?id=' + encodeURIComponent(reg.eventId || reg.id || '');
  }

  function eventTitleCell(reg) {
    const title = reg.title || 'Event';
    return (
      '<a class="ad-event-link" href="' + esc(eventHref(reg)) + '">' + esc(title) + '</a>'
    );
  }

  function actionCell(reg, options) {
    const opts = options || {};
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
      return (
        '<a class="ad-btn" href="' +
        esc(eventHref(reg)) +
        '">View event</a>'
      );
    }
    if (opts.showCancel && reg.canCancel) {
      return (
        '<div class="ad-action-group">' +
        '<a class="ad-btn ad-btn-primary" href="' +
        esc(eventHref(reg)) +
        '">View event</a>' +
        '<button type="button" class="ad-btn ad-cancel-booking" data-registration-id="' +
        esc(reg.id || '') +
        '">Cancel booking</button>' +
        '</div>'
      );
    }
    return (
      '<a class="ad-btn ad-btn-primary" href="' +
      esc(eventHref(reg)) +
      '">View event</a>'
    );
  }

  let reviewRating = 0;
  let reviewModalOpen = false;
  let paymentModalOpen = false;
  let cancelModalOpen = false;
  let pendingCancelRegistration = null;
  let highlightRegistrationId = '';

  function setReviewStars(rating) {
    reviewRating = rating;
    const stars = document.querySelectorAll('#ad-review-stars .ad-review-star');
    stars.forEach((btn) => {
      const n = Number(btn.getAttribute('data-rating'));
      btn.classList.toggle('is-active', n <= rating);
      btn.setAttribute('aria-checked', n === rating ? 'true' : 'false');
    });
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
    modal.hidden = false;
    reviewModalOpen = true;
    document.body.classList.add('ad-review-modal-open');
    if (text) text.focus();
  }

  function closeReviewModal() {
    const modal = document.getElementById('ad-review-modal');
    if (modal) modal.hidden = true;
    reviewModalOpen = false;
    document.body.classList.remove('ad-review-modal-open');
  }

  function bindReviewModal() {
    const modal = document.getElementById('ad-review-modal');
    const backdrop = document.getElementById('ad-review-modal-backdrop');
    const closeBtn = document.getElementById('ad-review-modal-close');
    const cancelBtn = document.getElementById('ad-review-cancel');
    const form = document.getElementById('ad-review-form');
    const stars = document.getElementById('ad-review-stars');

    [backdrop, closeBtn, cancelBtn].forEach((el) => {
      if (!el) return;
      el.addEventListener('click', closeReviewModal);
    });

    if (stars) {
      stars.querySelectorAll('.ad-review-star').forEach((btn) => {
        btn.addEventListener('click', () => {
          setReviewStars(Number(btn.getAttribute('data-rating')) || 0);
        });
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && reviewModalOpen) closeReviewModal();
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
        if (reviewText.length < 10) {
          if (err) {
            err.textContent = 'Please write at least 10 characters of feedback.';
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

  function parseRoute() {
    const hash = (location.hash.replace('#', '') || 'overview').toLowerCase();
    const allowed = [
      'overview',
      'upcoming',
      'payments',
      'saved',
      'past',
      'opportunity-enquiries',
      'reviews-pending',
      'reviews-done',
    ];
    return allowed.includes(hash) ? hash : 'overview';
  }

  function findRegistrationById(id) {
    const key = String(id || '').trim();
    if (!key) return null;
    for (let i = 0; i < registrations.length; i++) {
      if (String(registrations[i].id) === key) return registrations[i];
    }
    return null;
  }

  function openPaymentModal(reg) {
    const modal = document.getElementById('ad-payment-modal');
    const sub = document.getElementById('ad-payment-modal-sub');
    const details = document.getElementById('ad-payment-details');
    const note = document.getElementById('ad-payment-note');
    const eventLink = document.getElementById('ad-payment-event-link');
    if (!modal || !details || !reg) return;

    if (sub) {
      sub.textContent = 'Booking for “' + (reg.title || 'Event') + '”.';
    }

    const paid = formatAmountPaid(reg.amountPaid, reg.paymentStatus);
    const isPaid =
      String(reg.paymentStatus || '').toLowerCase() === 'paid' ||
      (paid !== 'Free' && paid !== '—');

    details.innerHTML =
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
      '<div><dt>Tickets</dt><dd>' +
      esc(reg.ticketLabel || '—') +
      '</dd></div>' +
      '<div><dt>Total paid</dt><dd>' +
      esc(paid) +
      '</dd></div>' +
      '<div><dt>Payment status</dt><dd>' +
      esc(reg.paymentStatus || 'Pending') +
      '</dd></div>';

    if (note) note.hidden = !isPaid;
    if (eventLink) eventLink.href = eventHref(reg);

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
      return 'This is a free booking — no payment was taken, so no refund applies.';
    }
    if (reg.refundEligible) {
      return (
        'Based on ' +
        organiser +
        '\'s policy, you may be eligible for a refund of ' +
        paid +
        '. The organiser — not The Networker Hub — will process any refund due through their payment account.'
      );
    }
    return (
      'Based on ' +
      organiser +
      '\'s policy, no refund is due for this cancellation. Your ticket will be deactivated.'
    );
  }

  function openCancelModal(reg) {
    const modal = document.getElementById('ad-cancel-modal');
    const sub = document.getElementById('ad-cancel-modal-sub');
    const summary = document.getElementById('ad-cancel-summary');
    const policyLabel = document.getElementById('ad-cancel-policy-label');
    const policyText = document.getElementById('ad-cancel-policy-text');
    const outcome = document.getElementById('ad-cancel-outcome');
    const outcomeText = document.getElementById('ad-cancel-outcome-text');
    const confirmCheck = document.getElementById('ad-cancel-confirm-check');
    const confirmBtn = document.getElementById('ad-cancel-confirm');
    const err = document.getElementById('ad-cancel-error');
    if (!modal || !reg) return;

    pendingCancelRegistration = reg;

    if (sub) {
      sub.textContent =
        'Review the organiser\'s refund policy before cancelling your booking for “' +
        (reg.title || 'Event') +
        '”.';
    }

    if (summary) {
      summary.innerHTML =
        '<div><dt>Event date</dt><dd>' +
        esc(formatDateTimeLong(reg.date)) +
        '</dd></div>' +
        '<div><dt>Tickets</dt><dd>' +
        esc(reg.ticketLabel || '—') +
        '</dd></div>' +
        '<div><dt>Amount paid</dt><dd>' +
        esc(formatAmountPaid(reg.amountPaid, reg.paymentStatus)) +
        '</dd></div>' +
        '<div><dt>Organiser</dt><dd>' +
        esc(reg.organiserName || '—') +
        '</dd></div>';
    }

    if (policyLabel) {
      policyLabel.textContent = reg.refundPolicyLabel || 'Refund policy';
    }
    if (policyText) {
      policyText.textContent =
        reg.refundPolicyText ||
        'No refund policy has been set for this event. Contact the organiser if you have questions.';
    }

    if (outcome && outcomeText) {
      outcome.hidden = false;
      outcome.classList.remove('is-eligible', 'is-ineligible', 'is-free');
      if (!reg.isPaid) outcome.classList.add('is-free');
      else if (reg.refundEligible) outcome.classList.add('is-eligible');
      else outcome.classList.add('is-ineligible');
      outcomeText.textContent = buildCancelOutcomeText(reg);
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
          closeCancelModal();
          await reloadDashboard();
          alert(data.message || 'Your booking has been cancelled.');
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
      const tr = document.createElement('tr');
      if (highlightRegistrationId && String(reg.id) === highlightRegistrationId) {
        tr.className = 'ad-row-highlight';
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
        esc(formatAmountPaid(reg.amountPaid, reg.paymentStatus)) +
        '</td><td>' +
        paymentBadge(reg.paymentStatus) +
        '</td><td><div class="ad-action-group">' +
        '<button type="button" class="ad-btn ad-btn-primary ad-view-payment" data-registration-id="' +
        esc(reg.id || '') +
        '">Payment details</button>' +
        (reg.canCancel
          ? '<button type="button" class="ad-btn ad-cancel-booking" data-registration-id="' +
            esc(reg.id || '') +
            '">Cancel booking</button>'
          : '') +
        '</div></td>';
      body.appendChild(tr);
    });

    bindPaymentButtons(body);
    bindCancelButtons(body);
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
    currentRoute = route || 'overview';
    document.querySelectorAll('[data-ad-page]').forEach((p) => {
      p.classList.toggle('is-active', p.getAttribute('data-ad-page') === currentRoute);
    });
    document.querySelectorAll('.hub-side-nav-link[data-ad-route]').forEach((a) => {
      a.classList.toggle('is-active', a.getAttribute('data-ad-route') === currentRoute);
    });
    if (location.hash.replace('#', '') !== currentRoute) {
      history.replaceState(null, '', (location.search || '') + '#' + currentRoute);
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
    if (!id) return '../opportunities/index.html';
    return '../opportunities/opportunity.html?id=' + encodeURIComponent(id);
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
      if (el) el.textContent = String(n);
    };
    set('ad-side-upcoming', upcomingList().length);
    set('ad-side-past', pastList().length);
    set('ad-side-enquiries', (opportunityEnquiries || []).length);
    set('ad-side-pending', pendingReviewsList().length);
    set('ad-side-reviewed', doneReviewsList().length);
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
        renderAllTables();
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
          paymentBadge(reg.paymentStatus) +
          '</td><td>' +
          reviewBadge(reg.reviewStatus, reg) +
          '</td><td>' +
          actionCell(reg, { showCancel: listKey === 'upcoming' }) +
          '</td>';
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
          '</td><td>' +
          actionCell(reg) +
          '</td>';
      }
      body.appendChild(tr);
    });

    bindLeaveReviewButtons(body);
    bindCancelButtons(body);

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
    renderSavedTable();
  }

  function renderAllTables() {
    const up = upcomingList().sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return da - db;
    });
    const past = pastList().sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });
    renderEventRows('ad-upcoming-body', 'ad-upcoming-empty', 'ad-pagination-upcoming', 'upcoming', up, true);
    renderEventRows('ad-past-body', 'ad-past-empty', 'ad-pagination-past', 'past', past, true);
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
    renderPaymentsTable();
    renderOpportunityEnquiries();
    updateSideCounts();
  }

  function renderWelcome(user) {
    const name = (user && user.name && String(user.name).trim()) || '';
    const nameEl = document.getElementById('ad-welcome-name');
    if (nameEl) {
      nameEl.textContent = name ? 'Welcome back, ' + name + ' 👋' : 'Welcome back 👋';
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
    const res = await fetch('/api/auth/attendee-dashboard', { credentials: 'include' });
    const data = await res.json();
    if (!data.ok) return;
    registrations = data.registrations || [];
    opportunityEnquiries = data.opportunityEnquiries || [];
    renderStats(data.stats || {});
    renderAllTables();
  }

  async function init() {
    bindNav();
    bindHubContextSwitch();
    bindReviewModal();
    bindPaymentModal();
    bindCancelModal();
    setRoute(parseRoute());

    const sessionRes = await fetch('/api/auth/session', { credentials: 'include' });
    const sessionData = await sessionRes.json();
    if (!sessionData.ok || !sessionData.user) {
      if (signin) signin.hidden = false;
      if (shell) shell.hidden = true;
      return;
    }

    if (signin) signin.hidden = true;
    if (shell) shell.hidden = false;
    renderWelcome(sessionData.user);
    await ensureAttendeeHubMode();

    const res = await fetch('/api/auth/attendee-dashboard', { credentials: 'include' });
    const data = await res.json();
    if (!data.ok) {
      if (signin) signin.hidden = true;
      if (shell) shell.hidden = false;
      registrations = [];
      opportunityEnquiries = [];
      renderStats({});
      renderAllTables();
      loadSavedEvents();
      const sub = document.getElementById('ad-welcome-sub');
      if (sub) {
        sub.textContent =
          data.message ||
          data.error ||
          'Could not load your dashboard right now. Try refreshing the page.';
      }
      return;
    }

    registrations = data.registrations || [];
    opportunityEnquiries = data.opportunityEnquiries || [];
    renderStats(data.stats || {});
    renderAllTables();
    loadSavedEvents();

    const demoNote = document.getElementById('ad-demo-note');
    if (demoNote) demoNote.hidden = !data.isDemo;

    openPaymentFromQuery();
  }

  init();
})();
