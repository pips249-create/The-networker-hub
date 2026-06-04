/**
 * Event detail page — loads from /api/events?id= or URL query params.
 */
(function () {
  window.hubEventDetailBooted = true;

  function fmt(n) {
    return '£' + Number(n).toFixed(2);
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

  function starsFromAvg(avg) {
    const a = Number(avg);
    const full = Math.min(5, Math.max(0, Math.round(isNaN(a) ? 4 : a)));
    let s = '';
    for (let i = 1; i <= 5; i++) s += i <= full ? '★' : '☆';
    return s;
  }

  function formatHeroLabel(fmt) {
    const m = String(fmt || '').toLowerCase();
    if (m.includes('hybrid')) return 'Hybrid event';
    if (m.includes('online') && !m.includes('person')) return 'Online event';
    return 'In-person event';
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el && text != null && text !== '') el.textContent = text;
  }

  function applyHostAvatar(avatarEl, initials) {
    if (!avatarEl) return;
    avatarEl.textContent = initials || '?';
  }

  function populateFromEvent(ev) {
    document.title = ev.title + ' – The Networker Hub';
    document.body.setAttribute('data-event-id', ev.id);
    setText('ev-title', ev.title);
    setText('ev-trail-current', ev.title);
    setText('ev-category', ev.industry || 'Networking');
    setText('ev-trail-category', ev.industry || 'Events');

    const priceLabel = ev.priceKey === 'free' ? 'Free' : ev.price;
    setText('ev-price', ev.priceKey === 'free' ? 'Free' : 'from ' + ev.price);
    setText('ev-ticket-from-price', priceLabel);
    setText('ev-format', formatHeroLabel(ev.format));

    const hero = document.getElementById('ev-hero-img');
    if (hero) {
      const placeholder = '../assets/event-placeholder.svg';
      hero.loading = 'lazy';
      hero.decoding = 'async';
      hero.src = ev.photo || placeholder;
      hero.alt = ev.title;
      hero.onerror = function () {
        hero.onerror = null;
        hero.src = placeholder;
      };
    }

    setText('ev-meta-starts', ev.date || 'Date to be confirmed');
    const timeRow = document.getElementById('ev-meta-time-row');
    if (ev.time) {
      setText('ev-meta-time', ev.time);
      if (timeRow) timeRow.style.display = '';
    } else if (timeRow) timeRow.style.display = 'none';

    setText('ev-meta-city', ev.location || 'Location TBC');

    const stars = document.getElementById('ev-rating-stars');
    if (stars) stars.textContent = starsFromAvg(ev.rating);
    const cnt = document.getElementById('ev-rating-count');
    if (cnt) {
      const r = Number(ev.rating) || 4;
      const c = Number(ev.reviews) || 0;
      cnt.textContent = r.toFixed(1) + (c ? ' (' + c + ' reviews)' : '');
    }

    const host = ev.organiser || 'Event organiser';
    setText('ev-host-name', host);
    applyHostAvatar(document.getElementById('ev-host-avatar'), hostInitials(host));
    const indEl = document.getElementById('ev-host-industry');
    if (indEl) {
      if (ev.industry) {
        indEl.textContent = ev.industry;
        indEl.hidden = false;
      } else indEl.hidden = true;
    }

    const vn = ev.venueName || ev.location || '';
    const va = ev.venueAddress || ev.location || '';
    setText('ev-venue-name', vn || 'Venue TBC');
    setText('ev-venue-addr', va);
    const dir = document.getElementById('ev-directions');
    if (dir && (vn || va)) {
      dir.href =
        'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent([vn, va].filter(Boolean).join(', '));
    }

    const lead = document.getElementById('ev-about-lead');
    const extra = document.getElementById('ev-about-extra');
    if (lead) {
      lead.textContent =
        ev.description ||
        'Join us for ' +
          ev.title +
          '. Full details will be shared with ticket holders.';
      if (extra) extra.hidden = true;
    }

    const std = document.getElementById('ev-tier-standard');
    if (std && ev.priceNum > 0) {
      std.setAttribute('data-price', String(ev.priceNum));
      const tp = std.querySelector('.tier-price');
      if (tp) tp.textContent = fmt(ev.priceNum);
    } else if (std && ev.priceKey === 'free') {
      std.setAttribute('data-price', '0');
      const tp = std.querySelector('.tier-price');
      if (tp) tp.textContent = 'Free';
    }

    const related = document.getElementById('ev-related-title');
    if (related) related.textContent = 'More from ' + (ev.organiser || 'this organiser');
  }

  function initTicketing() {
    const tiers = document.querySelectorAll('.tier:not(.sold-out)');
    const qtyDown = document.getElementById('qty-down');
    const qtyUp = document.getElementById('qty-up');
    const qtyValue = document.getElementById('qty-value');
    const sumLabel = document.getElementById('sum-label');
    const sumQty = document.getElementById('sum-qty');
    const sumSubtotal = document.getElementById('sum-subtotal');
    const sumFee = document.getElementById('sum-fee');
    const sumTotal = document.getElementById('sum-total');
    if (!qtyDown) return;

    let qty = 1;
    let price = 32.15;
    let label = 'Standard';
    const sel = document.querySelector('.tier.selected');
    if (sel) {
      price = parseFloat(sel.getAttribute('data-price')) || 0;
      label = sel.getAttribute('data-label') || label;
    }

    function update() {
      const subtotal = price * qty;
      const fee = subtotal * 0.04 + 0.2 * qty;
      const total = subtotal + fee;
      if (sumLabel) sumLabel.textContent = label;
      if (sumQty) sumQty.textContent = String(qty);
      if (sumSubtotal) sumSubtotal.textContent = fmt(subtotal);
      if (sumFee) sumFee.textContent = fmt(fee);
      if (sumTotal) sumTotal.textContent = fmt(total);
      if (qtyValue) qtyValue.textContent = String(qty);
      qtyDown.disabled = qty <= 1;
      qtyUp.disabled = qty >= 10;
    }

    function selectTier(tier) {
      tiers.forEach((t) => {
        t.classList.remove('selected');
        t.setAttribute('aria-pressed', 'false');
      });
      tier.classList.add('selected');
      tier.setAttribute('aria-pressed', 'true');
      price = parseFloat(tier.getAttribute('data-price')) || 0;
      label = tier.getAttribute('data-label') || 'Ticket';
      update();
    }

    tiers.forEach((tier) => {
      tier.addEventListener('click', () => selectTier(tier));
    });
    qtyDown.addEventListener('click', () => {
      if (qty > 1) {
        qty--;
        update();
      }
    });
    qtyUp.addEventListener('click', () => {
      if (qty < 10) {
        qty++;
        update();
      }
    });
    update();

    const buy = document.getElementById('buy-btn');
    const stripeHint = document.getElementById('stripe-hint');
    if (buy) {
      buy.addEventListener('click', () => {
        const meta = document.querySelector('meta[name="stripe-payment-link"]');
        const base = (meta && meta.getAttribute('content')) || '';
        if (!base.trim()) {
          if (stripeHint) stripeHint.hidden = false;
          return;
        }
        window.location.assign(base);
      });
    }

    const cal = document.getElementById('calendar-btn');
    if (cal) {
      cal.addEventListener('click', () => {
        const title = document.getElementById('ev-title')?.textContent || 'Event';
        const loc =
          [document.getElementById('ev-venue-name')?.textContent, document.getElementById('ev-venue-addr')?.textContent]
            .filter(Boolean)
            .join(', ') || '';
        window.open(
          'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' +
            encodeURIComponent(title) +
            '&location=' +
            encodeURIComponent(loc),
          '_blank'
        );
      });
    }
  }

  function buyBtn() {
    return document.getElementById('buy-btn');
  }

  async function boot() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (id) {
      try {
        const res = await fetch('/api/events?id=' + encodeURIComponent(id));
        const data = await res.json();
        if (data.event) {
          populateFromEvent(data.event);
          initTicketing();
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (params.get('title')) {
      populateFromEvent({
        id: params.get('id') || '',
        title: params.get('title'),
        description: params.get('about') || params.get('blurb') || '',
        date: params.get('starts') || '',
        time: params.get('time') || '',
        location: params.get('city') || '',
        industry: params.get('category') || '',
        format: params.get('format') || '',
        price: params.get('price') ? '£' + params.get('price') : 'Free',
        priceKey: 'paid',
        priceNum: parseFloat(params.get('price')) || 0,
        photo: params.get('img') || null,
        organiser: params.get('host') || '',
        rating: params.get('rating') || 4,
        reviews: params.get('reviews') || 0,
        venueName: params.get('venue_name') || '',
        venueAddress: params.get('venue_addr') || '',
      });
      initTicketing();
    }
  }

  boot();
})();
