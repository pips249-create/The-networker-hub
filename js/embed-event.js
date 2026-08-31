/**
 * White-label ticket embed — /embed/event?slug=… or /embed/event/:slug
 * Checkout stays on the live event page (top-level navigation).
 * Does not modify event-detail.js or Stripe checkout APIs.
 */
(function () {
  'use strict';

  var ORIGIN = window.location.origin || 'https://www.thenetworkeruk.com';
  var root = document.getElementById('embed-ticket-root');
  if (!root) return;

  function params() {
    return new URLSearchParams(window.location.search || '');
  }

  function slugFromPath() {
    var path = (window.location.pathname || '').replace(/\/+$/, '');
    var match = path.match(/\/embed\/event\/([^/]+)$/i);
    if (!match || !match[1]) return '';
    var raw = decodeURIComponent(match[1]);
    if (raw === 'event.html' || raw === 'index.html') return '';
    return raw.trim();
  }

  function route() {
    var p = params();
    return {
      id: String(p.get('id') || '').trim(),
      slug: String(p.get('slug') || slugFromPath() || '').trim(),
    };
  }

  function isHexColor(raw) {
    return /^#?[0-9a-fA-F]{6}$/.test(String(raw || '').trim());
  }

  function normalizeHex(raw) {
    var s = String(raw || '').trim();
    if (!isHexColor(s)) return '';
    return s.charAt(0) === '#' ? s : '#' + s;
  }

  function applyTheme() {
    var p = params();
    var brand = normalizeHex(p.get('brand') || p.get('primary') || '');
    var bg = normalizeHex(p.get('bg') || '');
    var accent = normalizeHex(p.get('accent') || '');
    var surface = normalizeHex(p.get('surface') || '');
    var rootEl = document.documentElement;
    if (brand) rootEl.style.setProperty('--embed-brand', brand);
    if (bg) rootEl.style.setProperty('--embed-bg', bg);
    if (surface) rootEl.style.setProperty('--embed-surface', surface);
    if (accent) rootEl.style.setProperty('--embed-accent', accent);
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatPrice(tier) {
    if (!tier) return '';
    if (tier.priceKey === 'free' || !(Number(tier.priceNum) > 0)) return 'Free';
    if (tier.price) return String(tier.price);
    var n = Number(tier.priceNum) || 0;
    return '£' + n.toFixed(2);
  }

  function publicTiers(ev) {
    var tickets = Array.isArray(ev.tickets) ? ev.tickets.slice() : [];
    tickets = tickets.filter(function (t) {
      if (!t) return false;
      if (t.isMembersOnly || t.isGuestVisit || t.isAlumni) return false;
      var type = String(t.ticketType || t.ticket_type || '').toLowerCase();
      if (type === 'guest-visit' || type === 'alumni') return false;
      if (/application/i.test(type) || /application/i.test(String(t.name || ''))) return false;
      return true;
    });
    if (tickets.length) return tickets;
    if (ev.isMembersOnlyEvent) return [];
    return [
      {
        id: (ev.id || 'event') + '-standard',
        name: 'Standard ticket',
        description: ev.priceKey === 'free' ? 'Free admission' : '',
        price: ev.price,
        priceKey: ev.priceKey,
        priceNum: ev.priceKey === 'free' ? 0 : Number(ev.priceNum) || 0,
        soldOut: Boolean(ev.isSoldOut),
      },
    ];
  }

  function eventUrl(ev) {
    var slug = String(ev.slug || '').trim();
    var path = slug
      ? '/events/' + encodeURIComponent(slug)
      : '/events/event?id=' + encodeURIComponent(ev.id || '');
    var u = new URL(ORIGIN + path);
    u.searchParams.set('utm_source', 'embed');
    u.searchParams.set('utm_medium', 'widget');
    u.hash = 'tickets';
    return u.toString();
  }

  function postHeight() {
    try {
      var height = Math.ceil(
        Math.max(
          document.documentElement.scrollHeight || 0,
          document.body.scrollHeight || 0,
          root.offsetHeight || 0
        )
      );
      if (height < 80) height = 80;
      window.parent.postMessage(
        { source: 'tnh-ticket-embed', type: 'resize', height: height },
        '*'
      );
    } catch (e) {
      /* ignore */
    }
  }

  function scheduleHeight() {
    window.requestAnimationFrame(function () {
      postHeight();
      setTimeout(postHeight, 50);
      setTimeout(postHeight, 250);
    });
  }

  function openTickets(url) {
    try {
      if (window.top && window.top !== window) {
        window.top.location.assign(url);
        return;
      }
    } catch (e) {
      /* cross-origin top — fall through */
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function renderLoading() {
    root.className = 'embed-ticket embed-ticket--loading';
    root.innerHTML = '<p class="embed-ticket__status">Loading tickets…</p>';
    scheduleHeight();
  }

  function renderError(message) {
    root.className = 'embed-ticket embed-ticket--error';
    root.innerHTML =
      '<p class="embed-ticket__error">' +
      esc(message || 'This event could not be loaded.') +
      '</p>';
    scheduleHeight();
  }

  function ctaLabel(ev, canBuy) {
    if (ev.isEventPast) return 'View event';
    if (ev.isSoldOut) return 'Sold out — view event';
    if (
      (window.HubSoftLaunch &&
        typeof window.HubSoftLaunch.arePublicTicketSalesOpen === 'function' &&
        !window.HubSoftLaunch.arePublicTicketSalesOpen()) ||
      ev.isTicketSalesPending ||
      ev.isTicketSalesScheduled
    ) {
      return 'Sales opening soon';
    }
    if (ev.isSalesClosed) return 'View event';
    if (!canBuy) return 'View event details';
    if (ev.priceKey === 'free') return 'Get free tickets';
    return 'Get tickets';
  }

  function render(ev) {
    var platformTicketsClosed =
      window.HubSoftLaunch &&
      typeof window.HubSoftLaunch.arePublicTicketSalesOpen === 'function' &&
      !window.HubSoftLaunch.arePublicTicketSalesOpen();
    var tiers = publicTiers(ev);
    var canBuy =
      !platformTicketsClosed &&
      !ev.isEventPast &&
      !ev.isSoldOut &&
      !ev.isSalesClosed &&
      !ev.isTicketSalesPending &&
      !ev.isTicketSalesScheduled &&
      tiers.length > 0 &&
      !tiers.every(function (t) {
        return t.soldOut;
      });
    var url = eventUrl(ev);
    var metaBits = [];
    if (ev.date) metaBits.push(esc(ev.date));
    if (ev.time) metaBits.push(esc(ev.time));
    if (ev.locationShort || ev.city || ev.location) {
      metaBits.push(esc(ev.locationShort || ev.city || ev.location));
    }

    var thumb = '';
    if (ev.photo) {
      thumb =
        '<img class="embed-ticket__thumb" src="' +
        esc(ev.photo) +
        '" alt="" loading="lazy" decoding="async" />';
    } else {
      thumb =
        '<div class="embed-ticket__thumb embed-ticket__thumb--empty" aria-hidden="true">' +
        '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' +
        '<rect x="3" y="7" width="18" height="12" rx="2"/>' +
        '<path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/>' +
        '<path d="M3 12h18"/>' +
        '</svg></div>';
    }

    var tiersHtml = '';
    if (tiers.length) {
      tiersHtml =
        '<ul class="embed-ticket__tiers">' +
        tiers
          .map(function (t) {
            var sold = Boolean(t.soldOut);
            var desc = String(t.description || '').trim();
            return (
              '<li class="embed-ticket__tier' +
              (sold ? ' is-sold-out' : '') +
              '">' +
              '<div><div class="embed-ticket__tier-name">' +
              esc(t.name || t.label || 'Ticket') +
              (sold ? ' (sold out)' : '') +
              '</div>' +
              (desc ? '<div class="embed-ticket__tier-desc">' + esc(desc) + '</div>' : '') +
              '</div>' +
              '<div class="embed-ticket__tier-price">' +
              esc(formatPrice(t)) +
              '</div></li>'
            );
          })
          .join('') +
        '</ul>';
    }

    var notice = '';
    if (ev.isEventPast) notice = 'This event has ended.';
    else if (ev.isSoldOut) notice = 'Tickets are sold out.';
    else if (platformTicketsClosed) {
      notice = 'Ticket buying opens at 9am on 1 September 2026.';
    } else if (ev.isTicketSalesPending || ev.isTicketSalesScheduled) {
      notice = ev.ticketSalesOpensLabel
        ? 'Ticket sales open ' + ev.ticketSalesOpensLabel + '.'
        : 'Ticket sales are not open yet.';
    } else if (!tiers.length) {
      notice = 'Ticket details are on the event page.';
    }

    root.className = 'embed-ticket';
    root.innerHTML =
      '<div class="embed-ticket__hero">' +
      thumb +
      '<div>' +
      '<p class="embed-ticket__kicker">' +
      esc(ev.organiser || 'Event tickets') +
      '</p>' +
      '<h1 class="embed-ticket__title">' +
      esc(ev.title || 'Event') +
      '</h1>' +
      (metaBits.length
        ? '<p class="embed-ticket__meta">' +
          metaBits.map(function (b) {
            return '<span>' + b + '</span>';
          }).join('') +
          '</p>'
        : '') +
      '</div></div>' +
      '<div class="embed-ticket__body">' +
      (notice ? '<p class="embed-ticket__notice">' + esc(notice) + '</p>' : '') +
      tiersHtml +
      '<div class="embed-ticket__actions">' +
      '<a class="embed-ticket__btn' +
      (canBuy ? '' : '') +
      '" id="embed-ticket-cta" href="' +
      esc(url) +
      '" target="_top" rel="noopener">' +
      esc(ctaLabel(ev, canBuy)) +
      '</a>' +
      '</div></div>' +
      '<div class="embed-ticket__powered">' +
      '<span>Secure checkout on The Networker UK</span>' +
      '<a href="' +
      esc(ORIGIN + '/') +
      '" target="_blank" rel="noopener noreferrer">Powered by TNH</a>' +
      '</div>';

    var cta = document.getElementById('embed-ticket-cta');
    if (cta) {
      cta.addEventListener('click', function (e) {
        e.preventDefault();
        openTickets(url);
      });
    }
    scheduleHeight();
  }

  async function load() {
    applyTheme();
    renderLoading();
    var r = route();
    if (!r.id && !r.slug) {
      renderError('Add ?slug=your-event-slug to this embed URL.');
      return;
    }
    var qs = r.id
      ? 'id=' + encodeURIComponent(r.id)
      : 'slug=' + encodeURIComponent(r.slug);
    try {
      var res = await fetch('/api/hub-listings?' + qs, { cache: 'no-store' });
      var data = await res.json().catch(function () {
        return {};
      });
      var ev = data && (data.event || (data.events && data.events[0]));
      if (!res.ok || !ev) {
        renderError('Event not found.');
        return;
      }
      render(ev);
      document.title = (ev.title || 'Event') + ' – Tickets';
    } catch (e) {
      renderError('Could not load tickets right now.');
    }
  }

  window.addEventListener('message', function (event) {
    if (!event || !event.data || event.data.source !== 'tnh-ticket-embed-host') return;
    if (event.data.type === 'ping') postHeight();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
