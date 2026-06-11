(function () {
  const PENDING_KEY = 'hub_booking_pending';
  const SERIES_BOOKED_KEY = 'hub_series_booked';
  const lead = document.getElementById('booking-success-lead');
  const status = document.getElementById('booking-success-status');
  const actions = document.getElementById('booking-success-actions');
  const note = document.getElementById('booking-success-note');
  const eventBlock = document.getElementById('booking-success-event');
  const eventTitle = document.getElementById('booking-success-event-title');
  const eventMeta = document.getElementById('booking-success-event-meta');
  const calendarSection = document.getElementById('booking-success-calendar');
  const shareSection = document.getElementById('booking-success-share');

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

  function readSeriesBooked() {
    try {
      const raw = sessionStorage.getItem(SERIES_BOOKED_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeSeriesBooked(map) {
    try {
      sessionStorage.setItem(SERIES_BOOKED_KEY, JSON.stringify(map || {}));
    } catch (e) {
      /* ignore */
    }
  }

  function seriesKeyForEvent(ev) {
    if (!ev) return '';
    return (
      's:' +
      String(ev.organiserId || '').trim() +
      ':' +
      String(ev.title || '').trim().toLowerCase()
    );
  }

  function recordSeriesBooking(seriesKey, eventId) {
    if (!seriesKey || !eventId) return;
    const map = readSeriesBooked();
    const ids = new Set(map[seriesKey] || []);
    ids.add(eventId);
    map[seriesKey] = [...ids];
    writeSeriesBooked(map);
  }

  function seriesEventPath(entry) {
    if (entry.id) return '/events/event.html?id=' + encodeURIComponent(entry.id);
    if (entry.slug) return '/events/' + encodeURIComponent(entry.slug);
    return '/events/';
  }

  function formatSeriesDateLabel(entry) {
    return [entry.date, entry.time].filter(Boolean).join(' · ') || 'View date';
  }

  function similarEventPath(ev) {
    if (ev.slug) return '/events/' + encodeURIComponent(ev.slug);
    if (ev.id) return '/events/event.html?id=' + encodeURIComponent(ev.id);
    return '/events/';
  }

  function similarEventImage(ev) {
    if (window.getEventImage) return window.getEventImage(ev);
    if (window.getFlexibleEventImage) {
      return window.getFlexibleEventImage(ev.photo, ev.organiserLogo, ev.id);
    }
    return ev.photo || '../assets/event-placeholder.svg';
  }

  function isUpcomingEvent(ev) {
    const ts =
      ev.dateTs != null
        ? Number(ev.dateTs)
        : ev.dateRaw
          ? new Date(ev.dateRaw).getTime()
          : ev.nextDateTs != null
            ? Number(ev.nextDateTs)
            : 0;
    if (!ts || Number.isNaN(ts)) return true;
    return ts >= Date.now() - 86400000;
  }

  function showSimilarEvents(listingData, bookedEventId) {
    const section = document.getElementById('booking-success-similar');
    const lede = document.getElementById('booking-success-similar-lede');
    const grid = document.getElementById('booking-success-similar-grid');
    if (!section || !grid) return false;

    const ev = listingData && listingData.event;
    const related = (listingData && listingData.related) || [];
    const seriesIds = new Set(
      ((listingData && listingData.seriesDates) || []).map(function (entry) {
        return entry.id;
      })
    );

    const picks = related
      .filter(function (item) {
        if (!item || !item.id) return false;
        if (item.id === bookedEventId) return false;
        if (seriesIds.has(item.id)) return false;
        if (item.isSoldOut) return false;
        return isUpcomingEvent(item);
      })
      .slice(0, 4);

    if (!picks.length) {
      section.hidden = true;
      return false;
    }

    const organiser = ev && ev.organiser ? String(ev.organiser).trim() : '';
    if (lede) {
      lede.textContent = organiser
        ? 'More upcoming events from ' + organiser + '.'
        : 'More upcoming events you might enjoy.';
    }

    grid.innerHTML = picks
      .map(function (item) {
        const href = similarEventPath(item);
        const img = similarEventImage(item);
        const meta = item.dateLine || [item.date, item.time, item.location || item.city].filter(Boolean).join(' · ');
        const price = item.priceKey === 'free' ? 'Free' : item.price || '';
        return (
          '<a class="bs-similar-card" href="' +
          escapeHtml(href) +
          '"><span class="bs-similar-thumb"><img src="' +
          escapeHtml(img) +
          '" alt="" loading="lazy" decoding="async" /></span><span class="bs-similar-body"><span class="bs-similar-title">' +
          escapeHtml(item.title || 'Event') +
          '</span><span class="bs-similar-meta">' +
          escapeHtml(meta) +
          '</span></span>' +
          (price ? '<span class="bs-similar-price">' + escapeHtml(price) + '</span>' : '') +
          '</a>'
        );
      })
      .join('');

    section.hidden = false;
    return true;
  }

  async function showSeriesBookAnother(pending, evFromSummary) {
    const section = document.getElementById('booking-success-series');
    const lede = document.getElementById('booking-success-series-lede');
    const list = document.getElementById('booking-success-series-dates');
    const similarSection = document.getElementById('booking-success-similar');
    if (!section || !list || !pending || !pending.eventId) return false;

    let seriesDates = [];
    let ev = evFromSummary;
    let listingData = null;

    try {
      const res = await fetch('/api/hub-listings?id=' + encodeURIComponent(pending.eventId));
      listingData = await res.json();
      ev = listingData.event || evFromSummary;
      seriesDates = listingData.seriesDates || [];
    } catch (e) {
      return false;
    }

    if (seriesDates.length <= 1) {
      section.hidden = true;
      showSimilarEvents(listingData, pending.eventId);
      return false;
    }

    const seriesKey = pending.seriesKey || seriesKeyForEvent(ev);
    recordSeriesBooking(seriesKey, pending.eventId);

    const booked = new Set((readSeriesBooked()[seriesKey] || []));
    const now = Date.now() - 86400000;
    const remaining = seriesDates.filter(function (entry) {
      if (booked.has(entry.id)) return false;
      const ts =
        entry.dateTs != null
          ? Number(entry.dateTs)
          : entry.dateRaw
            ? new Date(entry.dateRaw).getTime()
            : 0;
      if (ts && ts < now) return false;
      if (entry.isSoldOut) return false;
      return true;
    });

    if (!remaining.length) {
      section.hidden = true;
      showSimilarEvents(listingData, pending.eventId);
      return false;
    }

    if (similarSection) similarSection.hidden = true;

    const total = seriesDates.length;
    const word = total === 1 ? 'date' : 'dates';
    if (lede) {
      lede.textContent =
        'This event has ' +
        total +
        ' ' +
        word +
        '. Pick another session if you would like to come again.';
    }

    list.innerHTML = remaining
      .map(function (entry) {
        const label = formatSeriesDateLabel(entry);
        const href = seriesEventPath(entry);
        const price =
          entry.priceKey === 'free'
            ? 'Free'
            : entry.price
              ? entry.price
              : '';
        return (
          '<a class="bs-series-date" href="' +
          escapeHtml(href) +
          '"><span class="bs-series-date-label">' +
          escapeHtml(label) +
          '</span>' +
          (price ? '<span class="bs-series-date-price">' + escapeHtml(price) + '</span>' : '') +
          '</a>'
        );
      })
      .join('');

    section.hidden = false;
    return true;
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
    if (note) note.hidden = false;
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
    if (note) note.hidden = false;
    if (actions) actions.hidden = false;
  }

  async function finishConfirmedBooking(pending, message) {
    if (pending && pending.eventId) {
      await showSeriesBookAnother(pending, loadedEvent);
    }
    clearPending();
    showReady(message);
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
      await finishConfirmedBooking(
        pending,
        'Your free ticket is confirmed. We have emailed you the details.'
      );
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
      email: (pending && pending.email) || '',
      name: (pending && pending.name) || '',
    };

    if (isFree) {
      body.amountPaid = 0;
    }

    if (!body.email || !body.name) {
      try {
        const sessionRes = await fetch('/api/auth/session', { credentials: 'include' });
        const sessionData = await sessionRes.json().catch(function () {
          return {};
        });
        if (sessionData && sessionData.ok && sessionData.user) {
          if (!body.email) body.email = sessionData.user.email || '';
          if (!body.name) body.name = sessionData.user.name || '';
        }
      } catch (e) {
        /* non-fatal */
      }
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

      if (!res.ok || !data.ok) {
        if (data.action === 'exists' || data.error === 'booking_failed') {
          await finishConfirmedBooking(pending, 'Your ticket is already confirmed.');
          return;
        }
        clearPending();
        showError((data && data.message) || (data && data.error) || 'Confirmation is still processing.');
        return;
      }

      if (data.action === 'exists') {
        await finishConfirmedBooking(pending, 'Your ticket is already confirmed.');
        return;
      }

      const qtyMsg = qty > 1 ? 'Your ' + qty + ' tickets are confirmed.' : 'Your ticket is confirmed.';
      let tail = '';
      const emailResult = data.emailResult || {};
      if (emailResult.attendee) {
        tail = ' We have emailed you the details.';
      } else if (emailResult.skipped) {
        tail = ' Check My tickets for your booking details.';
      } else if (emailResult.errors && emailResult.errors.length) {
        tail =
          ' Your ticket is saved — if the confirmation email does not arrive shortly, check spam or My tickets.';
      } else {
        tail = ' We have emailed you the details.';
      }
      await finishConfirmedBooking(pending, qtyMsg + tail);
    } catch (e) {
      clearPending();
      showError('Could not reach the server. Your webhook may still complete the booking shortly.');
    }
  }

  confirmBooking();
})();
