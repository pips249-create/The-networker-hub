/** Shared Connected booking platform labels, hints, and per-event storage. */
(function (global) {
  var PLATFORMS = {
    eventbrite: {
      label: 'Eventbrite',
      placeholder: 'https://www.eventbrite.co.uk/e/your-event-… or checkout link',
      hint:
        'Use a link that opens <strong>ticket checkout</strong>, not just your Eventbrite listing. Paste your public ' +
        '<strong>/e/…</strong> URL and we send buyers straight to checkout, or paste ' +
        '<strong>Marketing → Embedded checkout</strong> preview / ' +
        '<code>…/checkout-external?eid=</code> from your event dashboard. Enable <strong>Eventbrite</strong> on ' +
        '<a href="/organiser/connected-booking#cb-providers-title">Connected booking → Booking providers</a>, ' +
        'link this TNH event to your Eventbrite event id below (we fill it from your URL when we can), and add our webhook URL in Eventbrite admin once.',
    },
    own_site: {
      label: 'Your own website',
      placeholder: 'https://yourdomain.com/book/…',
      hint:
        'Paste your checkout URL in setup. Enable <strong>Your own website</strong> webhook on Booking providers ' +
        'so each sale POSTs to us — no Zapier.',
    },
    ticket_tailor: {
      label: 'Ticket Tailor',
      placeholder: 'https://www.tickettailor.com/events/…',
      hint:
        'Paste your Ticket Tailor event URL in setup. Enable <strong>Ticket Tailor</strong> on ' +
        '<a href="/organiser/connected-booking#cb-providers-title">Booking providers</a> and link the box office event id.',
    },
    luma: {
      label: 'Luma',
      placeholder: 'https://lu.ma/…',
      hint:
        'Paste your Luma event link in setup. Enable <strong>Luma</strong> on ' +
        '<a href="/organiser/connected-booking#cb-providers-title">Booking providers</a> and link the Luma event id.',
    },
    trybooking: {
      label: 'TryBooking',
      placeholder: 'https://…',
      hint:
        'Paste your TryBooking event URL in setup. Enable <strong>TryBooking</strong> on ' +
        '<a href="/organiser/connected-booking#cb-providers-title">Booking providers</a> and link the TryBooking event id.',
    },
  };

  function storageKey(eventId) {
    var id = String(eventId || '').trim();
    return id ? 'ecs_booking_platform:' + id : '';
  }

  function getStored(eventId) {
    try {
      var key = storageKey(eventId);
      if (!key) return '';
      var v = localStorage.getItem(key) || '';
      return PLATFORMS[v] ? v : '';
    } catch (e) {
      return '';
    }
  }

  function setStored(eventId, platform) {
    var key = String(platform || '').trim();
    if (!PLATFORMS[key]) return;
    try {
      var sk = storageKey(eventId);
      if (sk) localStorage.setItem(sk, key);
    } catch (e) {
      /* ignore */
    }
  }

  function guessFromUrl(url) {
    var u = String(url || '').toLowerCase();
    if (!u) return '';
    if (/eventbrite/.test(u)) return 'eventbrite';
    if (/tickettailor|ticket-tailor/.test(u)) return 'ticket_tailor';
    if (/lu\.ma|luma\.com/.test(u)) return 'luma';
    if (/trybooking/.test(u)) return 'trybooking';
    if (/^https?:\/\//.test(u)) return 'own_site';
    return '';
  }

  function bindPicker(root, eventId, onChange) {
    if (!root || root.dataset.platformBound) return null;
    root.dataset.platformBound = '1';
    var hintEl = root.querySelector('[data-connected-platform-hint]');
    var selected = getStored(eventId) || 'own_site';

    function apply(platform) {
      var key = String(platform || '').trim();
      if (!PLATFORMS[key]) return;
      selected = key;
      setStored(eventId, key);
      root.querySelectorAll('[data-connected-platform]').forEach(function (btn) {
        var on = btn.getAttribute('data-connected-platform') === key;
        btn.classList.toggle('is-selected', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (hintEl) {
        hintEl.hidden = false;
        hintEl.innerHTML = PLATFORMS[key].hint;
      }
      if (typeof onChange === 'function') onChange(key, PLATFORMS[key]);
    }

    root.querySelectorAll('[data-connected-platform]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        apply(btn.getAttribute('data-connected-platform'));
      });
    });

    apply(selected);
    return { getSelected: function () { return selected; }, apply: apply };
  }

  global.HubConnectedPlatform = {
    PLATFORMS: PLATFORMS,
    storageKey: storageKey,
    getStored: getStored,
    setStored: setStored,
    guessFromUrl: guessFromUrl,
    bindPicker: bindPicker,
  };
})(typeof window !== 'undefined' ? window : globalThis);
