/** Shared Connected booking platform labels, hints, logos, and per-event storage. */
(function (global) {
  var LOGO_BASE = '/assets/connected-providers/';

  var PLATFORMS = {
    eventbrite: {
      label: 'Eventbrite',
      logo: LOGO_BASE + 'eventbrite.svg',
      placeholder: 'https://www.eventbrite.co.uk/e/your-event-… or checkout link',
      hint:
        'Paste a <strong>checkout</strong> link in the field above — your public <strong>/e/…</strong> URL is fine; we send buyers to checkout when we can. ' +
        'First time only: enable <strong>Eventbrite</strong> on ' +
        '<a href="/organiser/#cb-providers-title">Connected booking → Booking providers</a> and add our webhook in Eventbrite. ' +
        'Then link your Eventbrite event id below (we fill it from the URL when possible).',
    },
    ticket_tailor: {
      label: 'Ticket Tailor',
      logo: LOGO_BASE + 'ticket-tailor.svg',
      placeholder: 'https://www.tickettailor.com/events/…',
      hint:
        'Paste your Ticket Tailor checkout URL above. Enable <strong>Ticket Tailor</strong> below and add our webhook in Ticket Tailor (order created). ' +
        'Link the <strong>ev_…</strong> event id from Box office (webhooks use that id, not the public URL slug).',
    },
    luma: {
      label: 'Luma',
      logo: LOGO_BASE + 'luma.svg',
      placeholder: 'https://lu.ma/…',
      hint:
        'Paste your Luma link in the field above. Enable <strong>Luma</strong> on ' +
        '<a href="/organiser/#cb-providers-title">Booking providers</a> and link the Luma event id below.',
    },
    trybooking: {
      label: 'TryBooking',
      logo: LOGO_BASE + 'trybooking.svg',
      placeholder: 'https://…',
      hint:
        'Paste your TryBooking event URL in the field above. Enable <strong>TryBooking</strong> on ' +
        '<a href="/organiser/#cb-providers-title">Booking providers</a> and link the TryBooking event id below.',
    },
    own_site: {
      label: 'Your own website',
      logo: LOGO_BASE + 'own-site.svg',
      placeholder: 'https://yourdomain.com/book/…',
      hint:
        'Paste your checkout URL in the field above. Enable <strong>Your own website</strong> on ' +
        '<a href="/organiser/#cb-providers-title">Booking providers</a> so each sale POSTs to us — no Zapier required.',
    },
    custom: {
      label: 'Other / Zapier',
      logo: LOGO_BASE + 'other-zapier.svg',
      placeholder: 'https://your-checkout-or-event-page…',
      hint:
        'Use <strong>any</strong> checkout (Humanitix, Meetup, your CRM, etc.). Connect with ' +
        '<strong>Zapier</strong>, <strong>Make</strong>, or a small script — send each booking to our webhook with your TNH event id. ' +
        'Developers can use the signed <strong>HMAC</strong> API on Connected setup → Advanced. ' +
        '<a href="/organiser/#cb-webhook-title">Webhook docs</a>.',
    },
  };

  /** Default card order on tickets + setup (Luma / TryBooking / Zapier hidden — webhooks still work if legacy). */
  var PLATFORM_ORDER = ['eventbrite', 'ticket_tailor', 'own_site'];

  var LEGACY_PLATFORM_ALIASES = { luma: 'own_site', trybooking: 'own_site', custom: 'own_site' };

  var PICK_STEP_HINT =
    'Tap <strong>Continue to Connected setup</strong> next — you will add listing price and your checkout link there.';

  function hintForContext(platformKey, context) {
    var p = PLATFORMS[platformKey];
    if (!p) return '';
    if (context === 'pick') return PICK_STEP_HINT;
    return p.hint;
  }

  function storageKey(eventId) {
    var id = String(eventId || '').trim();
    return id ? 'ecs_booking_platform:' + id : '';
  }

  function normalizePlatformKey(key) {
    var v = String(key || '').trim();
    if (LEGACY_PLATFORM_ALIASES[v]) return LEGACY_PLATFORM_ALIASES[v];
    return PLATFORMS[v] ? v : '';
  }

  function getStored(eventId) {
    try {
      var key = storageKey(eventId);
      if (!key) return '';
      var v = localStorage.getItem(key) || '';
      return normalizePlatformKey(v);
    } catch (e) {
      return '';
    }
  }

  function setStored(eventId, platform) {
    var key = normalizePlatformKey(platform);
    if (!key || !PLATFORMS[key]) return;
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
    if (/^https?:\/\//.test(u)) return 'own_site';
    return '';
  }

  function escAttr(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function fillPlatformGrid(container) {
    if (!container || container.dataset.platformGridFilled) return;
    container.dataset.platformGridFilled = '1';
    container.classList.add('ecs-platform-grid');
    container.setAttribute('role', 'radiogroup');
    if (!container.getAttribute('aria-label')) {
      container.setAttribute('aria-label', 'Connected booking integration');
    }
    var parts = [];
    PLATFORM_ORDER.forEach(function (id) {
      var p = PLATFORMS[id];
      if (!p) return;
      parts.push(
        '<button type="button" class="ecs-platform-card" data-connected-platform="' +
          escAttr(id) +
          '" aria-pressed="false">' +
          '<span class="ecs-platform-card-logo">' +
          '<img src="' +
          escAttr(p.logo) +
          '" alt="" width="120" height="32" decoding="async" />' +
          '</span>' +
          '<span class="ecs-platform-card-label">' +
          escAttr(p.label) +
          '</span>' +
          '</button>'
      );
    });
    container.innerHTML = parts.join('');
  }

  function bindPicker(root, eventId, onChange, options) {
    if (!root) return null;
    options = options || {};
    var hintContext = String(options.hintContext || 'setup').trim();
    var grid = root.querySelector('[data-connected-platform-grid]') || root.querySelector('.ecs-platform-grid');
    if (grid && !grid.dataset.platformGridFilled) {
      fillPlatformGrid(grid);
    }
    if (root.dataset.platformBound) {
      return {
        getSelected: function () {
          return getStored(eventId) || 'own_site';
        },
        apply: function (platform) {
          var key = String(platform || '').trim();
          if (!PLATFORMS[key]) return;
          setStored(eventId, key);
          root.querySelectorAll('[data-connected-platform]').forEach(function (btn) {
            var on = btn.getAttribute('data-connected-platform') === key;
            btn.classList.toggle('is-selected', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
        },
      };
    }
    root.dataset.platformBound = '1';
    var hintEl =
      root.querySelector('[data-connected-platform-hint]') ||
      (root.closest && root.closest('.ee-card') && root.closest('.ee-card').querySelector('[data-connected-platform-hint]')) ||
      document.querySelector('[data-connected-platform-hint]');
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
        var hintHtml = hintForContext(key, hintContext);
        hintEl.hidden = !hintHtml;
        hintEl.innerHTML = hintHtml;
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
    PLATFORM_ORDER: PLATFORM_ORDER,
    storageKey: storageKey,
    getStored: getStored,
    setStored: setStored,
    guessFromUrl: guessFromUrl,
    fillPlatformGrid: fillPlatformGrid,
    bindPicker: bindPicker,
  };
})(typeof window !== 'undefined' ? window : globalThis);
