/**
 * London Business Show stand join: create free account path + free Attendee ticket
 * so the show appears on the member’s tickets / attended list.
 */
(function () {
  'use strict';

  var EVENT_SLUG = 'the-business-show-london';
  var JOIN_PATH =
    '/marketing/lbs-tina-join?utm_source=the_business_show_london&utm_medium=leaflet&utm_campaign=tina_lbs';

  var statusEl = document.getElementById('lbs-join-status');
  var actionEl = document.getElementById('lbs-join-action');

  function setStatus(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.dataset.kind = kind || '';
  }

  function setAction(html) {
    if (!actionEl) return;
    actionEl.innerHTML = html || '';
  }

  function registerHref() {
    return (
      '/register?intent=attendee&utm_source=the_business_show_london&utm_medium=leaflet&utm_campaign=tina_lbs&next=' +
      encodeURIComponent(JOIN_PATH)
    );
  }

  function pickFreeTicket(event) {
    var tickets = (event && event.tickets) || [];
    for (var i = 0; i < tickets.length; i++) {
      var t = tickets[i];
      if (!t) continue;
      if (t.soldOut) continue;
      if (t.priceKey === 'free' || Number(t.priceNum) === 0 || t.price === 'Free') return t;
    }
    return null;
  }

  function fetchEvent() {
    return fetch('/api/events?slug=' + encodeURIComponent(EVENT_SLUG), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok || !data || !data.event) {
          throw new Error((data && data.error) || 'event_unavailable');
        }
        return data.event;
      });
    });
  }

  function fetchSession() {
    return fetch('/api/auth/session', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        return res.json().catch(function () {
          return {};
        });
      })
      .then(function (data) {
        return data && data.user ? data.user : null;
      })
      .catch(function () {
        return null;
      });
  }

  function bookFree(event, ticket, user) {
    return fetch('/api/auth/complete-booking', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        eventId: event.id,
        ticketId: ticket.id,
        qty: 1,
        name: user.name || '',
        email: user.email || '',
        amountPaid: 0,
        paymentStatus: 'Free',
      }),
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok || !data || !data.ok) {
          var err = new Error((data && (data.message || data.error)) || 'booking_failed');
          err.code = data && data.error;
          throw err;
        }
        return data;
      });
    });
  }

  function showSignedOut() {
    setStatus('Create your free profile, then we’ll add The Business Show London to your tickets.');
    setAction(
      '<a class="lbs-btn lbs-btn-primary" href="' +
        registerHref() +
        '">Create free profile</a>' +
        '<a class="lbs-btn lbs-btn-secondary" href="/login?next=' +
        encodeURIComponent(JOIN_PATH) +
        '">Sign in</a>'
    );
  }

  function showSuccess() {
    setStatus('You’re in — The Business Show London is on your tickets. Next, finish your TINA profile.', 'ok');
    setAction(
      '<a class="lbs-btn lbs-btn-primary" href="/account/#meet">Open TINA profile</a>' +
        '<a class="lbs-btn lbs-btn-secondary" href="/account/#tickets">View my tickets</a>'
    );
  }

  function humanError(err) {
    var code = err && err.code ? String(err.code) : '';
    var msg = err && err.message ? String(err.message) : '';
    if (code === 'already_registered' || /already/i.test(msg)) {
      return 'You’re already registered for The Business Show London.';
    }
    if (code === 'ticket_sales_platform_closed' || /sales/i.test(msg)) {
      return 'Ticket sales are closed right now. Create your free profile anyway — we’ll help you claim the show from My account.';
    }
    return 'We couldn’t add the ticket automatically. Create or open your profile, then book the free Attendee ticket on the event page.';
  }

  function run() {
    setStatus('Checking your account…');
    setAction('');

    Promise.all([fetchSession(), fetchEvent()])
      .then(function (parts) {
        var user = parts[0];
        var event = parts[1];
        var ticket = pickFreeTicket(event);

        if (!user) {
          showSignedOut();
          return null;
        }
        if (!ticket) {
          setStatus('Free tickets aren’t open on this listing right now. You can still create your TINA profile.');
          setAction(
            '<a class="lbs-btn lbs-btn-primary" href="/account/#meet">Open TINA profile</a>' +
              '<a class="lbs-btn lbs-btn-secondary" href="/events/' +
              EVENT_SLUG +
              '">View event</a>'
          );
          return null;
        }

        setStatus('Adding The Business Show London to your tickets…');
        return bookFree(event, ticket, user)
          .then(function () {
            showSuccess();
          })
          .catch(function (err) {
            var code = err && err.code ? String(err.code) : '';
            var msg = err && err.message ? String(err.message) : '';
            if (
              code === 'already_registered' ||
              code === 'already_going' ||
              code === 'exists' ||
              /already/i.test(msg)
            ) {
              showSuccess();
              return;
            }
            setStatus(humanError(err), 'warn');
            setAction(
              '<a class="lbs-btn lbs-btn-primary" href="/events/' +
                EVENT_SLUG +
                '">Book free ticket</a>' +
                '<a class="lbs-btn lbs-btn-secondary" href="/account/#meet">Open TINA profile</a>'
            );
          });
      })
      .catch(function () {
        setStatus('Something went wrong loading the show listing. You can still create your free profile for TINA.', 'warn');
        setAction(
          '<a class="lbs-btn lbs-btn-primary" href="' +
            registerHref() +
            '">Create free profile</a>' +
            '<a class="lbs-btn lbs-btn-secondary" href="/events/' +
            EVENT_SLUG +
            '">View event</a>'
        );
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
