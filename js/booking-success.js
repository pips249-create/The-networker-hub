(function () {
  const PENDING_KEY = 'hub_booking_pending';
  const lead = document.getElementById('booking-success-lead');
  const status = document.getElementById('booking-success-status');
  const actions = document.getElementById('booking-success-actions');
  const steps = document.getElementById('booking-success-steps');
  const eventBlock = document.getElementById('booking-success-event');
  const eventTitle = document.getElementById('booking-success-event-title');
  const eventMeta = document.getElementById('booking-success-event-meta');
  const calendarSection = document.getElementById('booking-success-calendar');
  const shareSection = document.getElementById('booking-success-share');
  const shareText = document.getElementById('booking-success-share-text');

  let loadedEvent = null;
  let bookedQty = 1;

  function readPending() {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearPending() {
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function metaRow(iconPath, text) {
    if (!text) return '';
    return (
      '<div>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      iconPath +
      '</svg>' +
      '<span>' +
      escapeHtml(text) +
      '</span></div>'
    );
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function wireCalendarAndShare(ev, qty) {
    if (!window.HubCalendarShare) return;

    const calendar = HubCalendarShare.buildCalendarLinks(ev);
    const share = HubCalendarShare.buildGoingShare(ev, qty);

    if (calendarSection) {
      const google = document.getElementById('bs-cal-google');
      const outlook = document.getElementById('bs-cal-outlook');
      const ics = document.getElementById('bs-cal-ics');
      if (google) google.href = calendar.google;
      if (outlook) outlook.href = calendar.outlook;
      if (ics) {
        ics.addEventListener('click', function () {
          HubCalendarShare.downloadIcs(calendar.icsContent, calendar.icsFilename);
        });
      }
      calendarSection.hidden = false;
    }

    if (shareSection) {
      if (shareText) shareText.textContent = share.text;
      const linkedIn = document.getElementById('bs-share-linkedin');
      const facebook = document.getElementById('bs-share-facebook');
      const twitter = document.getElementById('bs-share-twitter');
      const whatsapp = document.getElementById('bs-share-whatsapp');
      const copyBtn = document.getElementById('bs-share-copy');
      const nativeBtn = document.getElementById('bs-share-native');

      if (linkedIn) linkedIn.href = share.linkedIn;
      if (facebook) facebook.href = share.facebook;
      if (twitter) twitter.href = share.twitter;
      if (whatsapp) whatsapp.href = share.whatsapp;

      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          const done = function () {
            copyBtn.textContent = 'Copied!';
            setTimeout(function () {
              copyBtn.textContent = 'Copy link';
            }, 2000);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(share.url).then(done).catch(function () {
              window.prompt('Copy this link:', share.url);
            });
          } else {
            window.prompt('Copy this link:', share.url);
          }
        });
      }

      if (nativeBtn && navigator.share) {
        nativeBtn.hidden = false;
        nativeBtn.addEventListener('click', function () {
          navigator.share({ title: share.title, text: share.text, url: share.url }).catch(function () {
            /* ignore */
          });
        });
      }

      shareSection.hidden = false;
    }
  }

  async function loadEventSummary(eventId, qty) {
    if (!eventId || !eventBlock) return;
    try {
      const res = await fetch('/api/hub-listings?id=' + encodeURIComponent(eventId));
      const data = await res.json();
      const ev = data.event || (data.events && data.events[0]);
      if (!ev) return;

      loadedEvent = ev;
      bookedQty = qty;

      if (eventTitle) eventTitle.textContent = ev.title || 'Your event';

      const dateLine = [ev.date, ev.time].filter(Boolean).join(' · ');
      const location = ev.location || ev.city || '';
      const rows = [
        metaRow('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>', dateLine),
        metaRow('<path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>', location),
      ].join('');

      if (eventMeta && (dateLine || location)) {
        eventMeta.innerHTML = rows;
        eventBlock.hidden = false;
      }

      const eventsLink = document.getElementById('booking-success-events');
      if (eventsLink && ev.slug) {
        eventsLink.href = '/events/' + encodeURIComponent(ev.slug);
      }

      wireCalendarAndShare(ev, qty);
    } catch (e) {
      /* non-fatal */
    }
  }

  function showReady(message) {
    if (lead) lead.textContent = message || 'Your ticket is confirmed. Check your email for the details.';
    if (status) {
      status.textContent = '';
      status.classList.remove('is-error');
    }
    if (steps) steps.hidden = false;
    if (actions) actions.hidden = false;
  }

  function showError(message) {
    if (lead) lead.textContent = 'We received your payment but could not confirm your ticket yet.';
    if (status) {
      status.textContent =
        message ||
        'Your booking should appear shortly. If it does not, contact support with your payment receipt.';
      status.classList.add('is-error');
    }
    if (steps) steps.hidden = false;
    if (actions) actions.hidden = false;
  }

  async function confirmBooking() {
    const params = new URLSearchParams(window.location.search);
    const isFree = params.get('free') === '1';
    const alreadyConfirmed = params.get('confirmed') === '1';
    const pending = readPending();
    const sessionId = params.get('session_id') || params.get('checkout_session_id');
    const qty = pending && pending.qty ? Math.max(1, parseInt(pending.qty, 10) || 1) : 1;

    if (pending && pending.eventId) {
      await loadEventSummary(pending.eventId, qty);
    }

    if (alreadyConfirmed) {
      clearPending();
      showReady('Your free ticket is confirmed. We have emailed you the details.');
      return;
    }

    if (!pending && !sessionId) {
      showReady('If you just paid, your ticket should appear in your account within a minute.');
      return;
    }

    const body = {
      eventId: pending && pending.eventId,
      ticketId: pending && pending.ticketId,
      qty: qty,
      stripeCheckoutSessionId: sessionId || null,
      paymentStatus: isFree ? 'Free' : 'Paid',
    };

    if (isFree) {
      body.amountPaid = 0;
    }

    try {
      const res = await fetch('/api/auth/complete-booking', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      clearPending();

      if (!res.ok || !data.ok) {
        if (data.action === 'exists' || data.error === 'booking_failed') {
          showReady('Your ticket is already confirmed.');
          return;
        }
        showError((data && data.message) || (data && data.error) || 'Confirmation is still processing.');
        return;
      }

      if (data.action === 'exists') {
        showReady('Your ticket is already confirmed.');
        return;
      }

      const qtyMsg = qty > 1 ? 'Your ' + qty + ' tickets are confirmed.' : 'Your ticket is confirmed.';
      showReady(qtyMsg + ' We have emailed you the details.');
    } catch (e) {
      showError('Could not reach the server. Your webhook may still complete the booking shortly.');
    }
  }

  confirmBooking();
})();
