/**
 * Ticket setup for an event series — tiers, One Seat Only Policy, sale windows.
 */
(function () {
  const SERIES_STORAGE_KEY = 'hub_event_series';
  const ORG_BOOTSTRAP_CACHE_KEY = 'hub_org_bootstrap_cache';
  const TICKET_DRAFT_KEY = 'hub_ticket_setup_draft';
  const params = new URLSearchParams(location.search);
  const idsParam = params.get('ids') || '';
  const isEmbedDrawer = params.get('embed') === '1' || window.self !== window.top;

  if (isEmbedDrawer) {
    document.documentElement.classList.add('ee-embed-drawer-root');
    if (document.body) document.body.classList.add('ee-embed-drawer');
  }

  let eventIds = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  let seriesMeta = { title: '', events: [], eventFormat: '' };
  let attendanceMode = 'tickets';
  let selectedRefundPolicy = '';
  let existingTicketsLoaded = false;
  let paymentSetupState = null;
  let returnedFromStripe = false;
  let ticketsLocked = false;

  const SALE_END_OPTIONS = [
    { value: 'at_start', label: 'When the event starts' },
    { value: '12_hours', label: '12 hours before the event' },
    { value: '1_day', label: '1 day before the event' },
    { value: '1_week', label: '1 week before the event' },
    { value: 'custom', label: 'Custom date & time' },
  ];

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function showAlert(msg, tone) {
    const el = document.getElementById('ee-tickets-alert');
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
    el.classList.toggle('ee-alert-ok', tone === 'ok');
    el.classList.toggle('ee-alert-warn', tone === 'warn');
  }

  function eventHasTicketSales(ev) {
    if (!ev) return false;
    if (ev.locked) return true;
    const sold = Number(ev.ticketsSold);
    if (Number.isFinite(sold) && sold > 0) return true;
    const label = String(ev.ticketsSoldLabel || '').trim();
    return /^\d+\s+sold/i.test(label) || /^\d+\/\d+/.test(label);
  }

  function applyTicketsLockUi(ev) {
    ticketsLocked = eventHasTicketSales(ev);
    const banner = document.getElementById('ee-tickets-lock-banner');
    if (banner) banner.hidden = !ticketsLocked;
    if (!ticketsLocked) return;
    const form = document.getElementById('ee-tickets-form');
    if (form) form.classList.add('is-locked');
    form?.querySelectorAll('input, select, textarea, button').forEach((el) => {
      el.disabled = true;
    });
  }

  function isoToDateInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function isoToTimeInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  async function api(path, opts) {
    const res = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(opts && opts.headers) },
      ...opts,
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return { ok: res.ok, status: res.status, data };
  }

  function formatDateShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function earliestEventDate() {
    const events = seriesMeta.events && seriesMeta.events.length ? seriesMeta.events : [];
    let earliest = null;
    events.forEach((ev) => {
      if (!ev.date) return;
      const d = new Date(ev.date);
      if (Number.isNaN(d.getTime())) return;
      if (!earliest || d < earliest) earliest = d;
    });
    return earliest;
  }

  function computeSaleEndIso(option, customDatetime, eventDateIso) {
    const base = eventDateIso ? new Date(eventDateIso) : earliestEventDate();
    if (!base || Number.isNaN(base.getTime())) return null;
    const d = new Date(base.getTime());
    if (option === 'at_start') return d.toISOString();
    if (option === '12_hours') {
      d.setHours(d.getHours() - 12);
      return d.toISOString();
    }
    if (option === '1_day') {
      d.setDate(d.getDate() - 1);
      return d.toISOString();
    }
    if (option === '1_week') {
      d.setDate(d.getDate() - 7);
      return d.toISOString();
    }
    if (option === 'custom' && customDatetime) {
      const c = new Date(customDatetime);
      if (!Number.isNaN(c.getTime())) return c.toISOString();
    }
    return null;
  }

  function saleEndLabel(option) {
    const hit = SALE_END_OPTIONS.find((o) => o.value === option);
    return hit ? hit.label : option;
  }

  const QuarterTime = window.OrganiserQuarterTime;

  function combineDateAndQuarterTime(dateStr, timeStr) {
    if (!dateStr) return null;
    const rounded = QuarterTime
      ? QuarterTime.roundToQuarterHour(timeStr || '09:00')
      : timeStr || '09:00';
    const parts = rounded.split(':').map(Number);
    const ymd = dateStr.split('-').map(Number);
    const local = new Date(ymd[0], (ymd[1] || 1) - 1, ymd[2] || 1, parts[0] || 0, parts[1] || 0, 0);
    if (Number.isNaN(local.getTime())) return null;
    return local.toISOString();
  }

  function populateQuarterTimeSelect(selectEl, selected) {
    if (!selectEl || !QuarterTime) return;
    QuarterTime.populateSelect(selectEl, selected || '09:00');
  }

  function loadSeriesMeta() {
    const hadUrlIds = eventIds.length > 0;
    try {
      const raw = sessionStorage.getItem(SERIES_STORAGE_KEY);
      if (raw) seriesMeta = { ...seriesMeta, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    if (!hadUrlIds && seriesMeta.eventIds && seriesMeta.eventIds.length) {
      eventIds = seriesMeta.eventIds;
    }
  }

  function renderSeriesSummary() {
    const countEl = document.getElementById('ee-series-count');
    const pills = document.getElementById('ee-series-pills');
    const lead = document.getElementById('ee-tickets-lead');
    const seriesCard = document.getElementById('ee-series-card');
    const n = eventIds.length;
    const heroImg =
      seriesMeta.imageUrl ||
      (seriesMeta.events && seriesMeta.events[0] && seriesMeta.events[0].imageUrl) ||
      '';
    if (heroImg && seriesCard && !seriesCard.querySelector('.ee-series-hero')) {
      const wrap = document.createElement('div');
      wrap.className = 'ee-series-hero';
      const img = document.createElement('img');
      img.src = heroImg;
      img.alt = '';
      img.width = 640;
      img.height = 360;
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.onerror = function () {
        wrap.remove();
      };
      wrap.appendChild(img);
      const heading = seriesCard.querySelector('h2');
      if (heading && heading.nextSibling) {
        seriesCard.insertBefore(wrap, heading.nextSibling);
      } else {
        seriesCard.appendChild(wrap);
      }
    }
    if (countEl) {
      countEl.textContent = n + ' event' + (n === 1 ? '' : 's');
    }
    if (lead && seriesMeta.title) {
      lead.textContent =
        'Define tickets for “' +
        seriesMeta.title +
        '”. Each tier is copied to all ' +
        n +
        ' date' +
        (n === 1 ? '' : 's') +
        ' in this series.';
    }
    if (!pills) return;
    const events =
      seriesMeta.events && seriesMeta.events.length ? seriesMeta.events : eventIds.map((id) => ({ id }));
    pills.innerHTML = events
      .map((ev) => {
        const label = ev.date
          ? formatDateShort(ev.date)
          : ev.title
            ? ev.title
            : 'Date TBC';
        return '<span class="ee-pill">' + esc(label) + '</span>';
      })
      .join('');
  }

  async function expandSeriesEventIds() {
    if (eventIds.length > 1) return;
    const anchorId = eventIds[0];
    if (!anchorId) return;

    let allEvents = [];
    try {
      const raw = sessionStorage.getItem(ORG_BOOTSTRAP_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached && cached.ts && Date.now() - cached.ts < 120000) {
          allEvents = cached.events || [];
        }
      }
    } catch {
      /* ignore */
    }

    if (!allEvents.length) {
      const res = await api('/api/organiser/events');
      if (res.ok && Array.isArray(res.data.events)) allEvents = res.data.events;
    }

    const anchor = (seriesMeta.events && seriesMeta.events[0]) || { id: anchorId };
    const seriesGroupId = String(anchor.seriesGroupId || '').trim();
    let peers = [];
    if (seriesGroupId) {
      peers = allEvents.filter((ev) => String(ev.seriesGroupId || '').trim() === seriesGroupId);
    } else {
      const groupId = seriesMeta.organiserGroupId || anchor.organiserGroupId || anchor.groupId || '';
      const titleKey = String(seriesMeta.title || anchor.title || '').trim().toLowerCase();
      if (groupId && titleKey) {
        peers = allEvents.filter((ev) => {
          const peerGroup = ev.organiserGroupId || ev.groupId || '';
          return peerGroup === groupId && String(ev.title || '').trim().toLowerCase() === titleKey;
        });
      }
    }

    if (peers.length <= 1) return;
    const sorted = peers.slice().sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return da - db;
    });
    eventIds = sorted.map((ev) => ev.id).filter(Boolean);
    seriesMeta.events = sorted.map((ev) => ({
      id: ev.id,
      title: ev.title,
      date: ev.date,
      imageUrl: ev.imageUrl || seriesMeta.imageUrl || '',
    }));
    seriesMeta.eventIds = eventIds.slice();
  }

  async function hydrateSeriesEvents() {
    if (!eventIds.length) return;
    const existing = seriesMeta.events && seriesMeta.events.length ? seriesMeta.events : [];
    const byId = new Map(existing.map((ev) => [ev.id, ev]));
    eventIds.forEach((id) => {
      if (!byId.has(id)) byId.set(id, { id });
    });

    try {
      const raw = sessionStorage.getItem(ORG_BOOTSTRAP_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        (cached.events || []).forEach((ev) => {
          if (!ev || !ev.id || !byId.has(ev.id)) return;
          const cur = byId.get(ev.id);
          byId.set(ev.id, {
            id: ev.id,
            title: cur.title || ev.title,
            date: cur.date || ev.date,
            imageUrl: cur.imageUrl || ev.imageUrl,
          });
        });
      }
    } catch {
      /* ignore */
    }

    const missingDates = eventIds.filter((id) => {
      const ev = byId.get(id);
      return !ev || !ev.date;
    });

    if (missingDates.length) {
      const results = await Promise.all(
        missingDates.map((id) => api('/api/organiser/events?id=' + encodeURIComponent(id)))
      );
      missingDates.forEach((id, i) => {
        const res = results[i];
        const ev = res.ok && res.data.event ? res.data.event : null;
        if (!ev) return;
        byId.set(id, {
          id: ev.id || id,
          title: ev.title,
          date: ev.date,
          imageUrl: ev.imageUrl,
        });
      });
    }

    seriesMeta.events = eventIds.map((id) => byId.get(id) || { id });
  }

  function notifyEmbedDrawerReady() {
    if (isEmbedDrawer && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'hub-event-drawer-ready' }, window.location.origin);
    }
  }

  function setAttendanceMode(mode) {
    attendanceMode = mode;
    document.querySelectorAll('.ee-mode-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-mode') === mode);
    });
    const ticketsPanel = document.getElementById('ee-panel-tickets');
    const osopPanel = document.getElementById('ee-panel-osop');
    const desc = document.getElementById('ee-mode-desc');
    if (ticketsPanel) ticketsPanel.hidden = mode !== 'tickets';
    if (osopPanel) osopPanel.hidden = mode !== 'osop';
    if (desc) {
      desc.textContent =
        mode === 'osop'
          ? 'Application-based attendance — you review industry and job title, then approve or deny. Approved applicants pay via your payment link.'
          : 'Standard open booking — set up one or more ticket types with prices and quantities. Attendees purchase directly.';
    }
  }

  function saleEndSelectHtml(selected) {
    return (
      '<select class="ee-tier-sale-end">' +
      SALE_END_OPTIONS.map(
        (o) =>
          '<option value="' +
          o.value +
          '"' +
          (o.value === selected ? ' selected' : '') +
          '>' +
          esc(o.label) +
          '</option>'
      ).join('') +
      '</select>'
    );
  }

  const DEFAULT_TIER_NAME = 'General admission';

  function tierRowHtml(index) {
    return (
      '<div class="ee-tier-row ee-tier-row-expanded" data-tier-index="' +
      index +
      '">' +
      '<div class="ee-tier-order">' +
      '<button type="button" class="ee-btn ee-btn-outline ee-tier-up" aria-label="Move up">↑</button>' +
      '<button type="button" class="ee-btn ee-btn-outline ee-tier-down" aria-label="Move down">↓</button>' +
      '</div>' +
      '<div class="ee-field"><label>Ticket name</label><input type="text" class="ee-tier-name" required placeholder="e.g. General Admission, Early Bird" /></div>' +
      '<div class="ee-field"><label>Description <span class="ee-optional">(optional)</span></label>' +
      '<textarea class="ee-tier-desc" rows="2" placeholder="What is included with this ticket"></textarea></div>' +
      '<div class="ee-row-2">' +
      '<div class="ee-field"><label>Price (£)</label><p class="ee-hint">Enter 0 for free</p><input type="number" class="ee-tier-price" min="0" step="0.01" value="0" /></div>' +
      '<div class="ee-field"><label>Quantity available <span class="ee-optional">(optional)</span></label><input type="number" class="ee-tier-qty" min="0" step="1" placeholder="Unlimited" /></div>' +
      '</div>' +
      '<div class="ee-row-2">' +
      '<div class="ee-field"><label>Sale start <span class="ee-optional">(optional)</span></label>' +
      '<p class="ee-hint" style="margin-top:0">Leave blank and sales start today. Or pick a date and time in 15-minute steps.</p>' +
      '<div class="ee-datetime-split">' +
      '<input type="date" class="ee-tier-sale-start-date" />' +
      '<select class="ee-tier-sale-start-time" aria-label="Sale start time"></select>' +
      '</div></div>' +
      '<div class="ee-field"><label>Sale end <span class="ee-optional">(optional)</span></label>' +
      saleEndSelectHtml('1_week') +
      '<div class="ee-sale-custom-wrap" hidden style="margin-top:8px">' +
      '<p class="ee-hint" style="margin:0 0 6px">Custom end date and time</p>' +
      '<div class="ee-datetime-split">' +
      '<input type="date" class="ee-tier-sale-custom-date" />' +
      '<select class="ee-tier-sale-custom-time" aria-label="Custom sale end time"></select>' +
      '</div></div></div>' +
      '</div>' +
      '<div class="ee-field"><label>Ticket type</label><select class="ee-tier-kind">' +
      '<option value="Standard">Standard (auto-approve)</option>' +
      '<option value="Application-based">Application-based (you review applicants)</option>' +
      '</select></div>' +
      '<button type="button" class="ee-btn ee-btn-outline ee-tier-remove" style="font-size:11px;padding:8px 10px">Remove</button>' +
      '</div>'
    );
  }

  function updateTierSummary() {
    const summary = document.getElementById('ee-tier-summary');
    if (!summary || attendanceMode !== 'tickets') return;
    const rows = document.querySelectorAll('.ee-tier-row');
    let count = 0;
    let totalQty = 0;
    let hasUnlimited = false;
    let minPrice = null;
    rows.forEach((row) => {
      const name = row.querySelector('.ee-tier-name')?.value.trim();
      if (!name) return;
      count += 1;
      const qtyRaw = row.querySelector('.ee-tier-qty')?.value;
      if (qtyRaw === '' || qtyRaw == null) hasUnlimited = true;
      else totalQty += Number(qtyRaw) || 0;
      const price = Number(row.querySelector('.ee-tier-price')?.value) || 0;
      if (minPrice == null || price < minPrice) minPrice = price;
    });
    const qtyLabel = hasUnlimited && count ? 'unlimited' : String(totalQty);
    const fromPrice = minPrice == null ? '0' : minPrice.toFixed(2);
    summary.textContent =
      count +
      ' ticket type' +
      (count === 1 ? '' : 's') +
      ' · ' +
      qtyLabel +
      ' total available · from £' +
      fromPrice;
  }

  function moveTierRow(row, dir) {
    const wrap = document.getElementById('ee-tier-rows');
    if (!wrap || !row) return;
    if (dir < 0 && row.previousElementSibling) {
      wrap.insertBefore(row, row.previousElementSibling);
    } else if (dir > 0 && row.nextElementSibling) {
      wrap.insertBefore(row.nextElementSibling, row);
    }
    updateTierSummary();
  }

  function bindTierRow(row) {
    const saleSelect = row.querySelector('.ee-tier-sale-end');
    const customWrap = row.querySelector('.ee-sale-custom-wrap');
    if (saleSelect && customWrap) {
      saleSelect.addEventListener('change', () => {
        customWrap.hidden = saleSelect.value !== 'custom';
      });
    }
    populateQuarterTimeSelect(row.querySelector('.ee-tier-sale-start-time'), '09:00');
    populateQuarterTimeSelect(row.querySelector('.ee-tier-sale-custom-time'), '18:00');
    row.querySelectorAll('input, textarea, select').forEach((el) => {
      el.addEventListener('input', function () {
        updateTierSummary();
        updatePublishButton();
      });
      el.addEventListener('change', function () {
        updateTierSummary();
        updatePublishButton();
      });
    });
    const up = row.querySelector('.ee-tier-up');
    const down = row.querySelector('.ee-tier-down');
    if (up) up.addEventListener('click', () => moveTierRow(row, -1));
    if (down) down.addEventListener('click', () => moveTierRow(row, 1));
    const removeBtn = row.querySelector('.ee-tier-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        const wrap = document.getElementById('ee-tier-rows');
        if (wrap && wrap.children.length <= 1) return;
        row.remove();
        updateTierSummary();
        updatePublishButton();
      });
    }
  }

  function addTierRow(options) {
    const wrap = document.getElementById('ee-tier-rows');
    if (!wrap) return;
    const index = wrap.children.length;
    const div = document.createElement('div');
    div.innerHTML = tierRowHtml(index);
    const row = div.firstElementChild;
    bindTierRow(row);
    const nameEl = row.querySelector('.ee-tier-name');
    if (nameEl && index === 0 && options?.useDefaultName !== false && !nameEl.value.trim()) {
      nameEl.value = DEFAULT_TIER_NAME;
    }
    wrap.appendChild(row);
    updateTierSummary();
    updatePublishButton();
    return row;
  }

  function fillTierFromTicket(row, ticket) {
    if (!row || !ticket) return;
    const nameEl = row.querySelector('.ee-tier-name');
    if (nameEl) nameEl.value = ticket.name || '';
    const descEl = row.querySelector('.ee-tier-desc');
    if (descEl) descEl.value = ticket.description || '';
    const priceEl = row.querySelector('.ee-tier-price');
    if (priceEl) priceEl.value = ticket.price === '' || ticket.price == null ? '0' : String(ticket.price);
    const qtyEl = row.querySelector('.ee-tier-qty');
    if (qtyEl) {
      qtyEl.value =
        ticket.quantityAvailable == null || ticket.quantityAvailable === ''
          ? ''
          : String(ticket.quantityAvailable);
    }
    const kindEl = row.querySelector('.ee-tier-kind');
    if (kindEl) {
      const kind = ticket.ticketType || (/application/i.test(ticket.name || '') ? 'Application-based' : 'Standard');
      kindEl.value = /application/i.test(kind) ? 'Application-based' : 'Standard';
    }
    if (ticket.saleStart) {
      const dateEl = row.querySelector('.ee-tier-sale-start-date');
      const timeEl = row.querySelector('.ee-tier-sale-start-time');
      if (dateEl) dateEl.value = isoToDateInput(ticket.saleStart);
      if (timeEl) populateQuarterTimeSelect(timeEl, isoToTimeInput(ticket.saleStart) || '09:00');
    }
    if (ticket.saleEnd) {
      const saleSelect = row.querySelector('.ee-tier-sale-end');
      const customWrap = row.querySelector('.ee-sale-custom-wrap');
      const customDate = row.querySelector('.ee-tier-sale-custom-date');
      const customTime = row.querySelector('.ee-tier-sale-custom-time');
      if (saleSelect) saleSelect.value = 'custom';
      if (customWrap) customWrap.hidden = false;
      if (customDate) customDate.value = isoToDateInput(ticket.saleEnd);
      if (customTime) populateQuarterTimeSelect(customTime, isoToTimeInput(ticket.saleEnd) || '18:00');
    }
  }

  function prefillTiers(tickets) {
    const wrap = document.getElementById('ee-tier-rows');
    if (!wrap) return;
    wrap.innerHTML = '';
    const sorted = tickets
      .slice()
      .sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));
    sorted.forEach((ticket) => {
      const row = addTierRow({ useDefaultName: false });
      fillTierFromTicket(row, ticket);
    });
    existingTicketsLoaded = sorted.length > 0;
    updateTierSummary();
    updatePublishButton();
  }

  function prefillRefundFromEvent(ev) {
    if (!ev) return;
    if (ev.vatTreatment) {
      const vatRadio = document.querySelector(
        'input[name="vat-treatment"][value="' + ev.vatTreatment + '"]'
      );
      if (vatRadio) selectVatCard(vatRadio);
    }
    if (ev.refundPolicy) {
      const refundRadio = document.querySelector(
        'input[name="refund-policy"][value="' + ev.refundPolicy + '"]'
      );
      if (refundRadio) selectRefundCard(refundRadio);
    }
    if (ev.refundCutoffDays != null) {
      const cutoff = document.getElementById('refund-cutoff-days');
      if (cutoff) cutoff.value = String(ev.refundCutoffDays);
    }
    if (ev.refundPolicyDetails) {
      if (ev.refundPolicy === 'partial_refund') {
        const el = document.getElementById('refund-partial-details');
        if (el) el.value = ev.refundPolicyDetails;
      } else if (ev.refundPolicy === 'custom') {
        const el = document.getElementById('refund-custom-details');
        if (el) el.value = ev.refundPolicyDetails;
      }
    }
    if (ev.refundTermsAgreed) {
      const agree = document.getElementById('refund-terms-agreed');
      if (agree) agree.checked = true;
    }
    const food = document.getElementById('ee-food-included');
    const dietary = document.getElementById('ee-collect-dietary');
    const access = document.getElementById('ee-collect-access');
    if (food) food.checked = Boolean(ev.foodIncluded);
    if (dietary) dietary.checked = Boolean(ev.collectDietary);
    if (access) access.checked = Boolean(ev.collectAccessibility);
    updatePublishButton();
  }

  async function loadExistingData() {
    const firstId = eventIds[0];
    const [ticketsRes, eventRes] = await Promise.all([
      api('/api/organiser/tickets?eventId=' + encodeURIComponent(firstId)),
      api('/api/organiser/events?id=' + encodeURIComponent(firstId)),
    ]);

    if (ticketsRes.status === 401 || eventRes.status === 401) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.href = '../login.html?next=' + next;
      return { tickets: [], event: null, authFailed: true };
    }

    const tickets =
      ticketsRes.ok && Array.isArray(ticketsRes.data.tickets) ? ticketsRes.data.tickets : [];
    const event = eventRes.ok && eventRes.data.event ? eventRes.data.event : null;
    return { tickets, event, authFailed: false };
  }

  function collectTiers() {
    const rows = document.querySelectorAll('.ee-tier-row');
    const tiers = [];
    const eventDate = seriesMeta.events && seriesMeta.events[0] ? seriesMeta.events[0].date : null;
    rows.forEach((row, idx) => {
      const nameEl = row.querySelector('.ee-tier-name');
      if (!nameEl) return;
      const name = nameEl.value.trim();
      if (!name) return;
      const price = row.querySelector('.ee-tier-price')?.value;
      const qty = row.querySelector('.ee-tier-qty')?.value;
      const desc = row.querySelector('.ee-tier-desc')?.value.trim() || '';
      const saleOption = row.querySelector('.ee-tier-sale-end')?.value;
      const customDt = combineDateAndQuarterTime(
        row.querySelector('.ee-tier-sale-custom-date')?.value,
        row.querySelector('.ee-tier-sale-custom-time')?.value
      );
      const saleStart = combineDateAndQuarterTime(
        row.querySelector('.ee-tier-sale-start-date')?.value,
        row.querySelector('.ee-tier-sale-start-time')?.value
      );
      const saleEnd = computeSaleEndIso(saleOption, customDt, eventDate);
      const ticketKind = row.querySelector('.ee-tier-kind')?.value || 'Standard';
      const isApp = ticketKind === 'Application-based';
      tiers.push({
        name,
        price,
        description: desc,
        status: 'Available',
        quantityAvailable: qty === '' ? null : Number(qty),
        saleStart,
        saleEnd,
        saleEndOption: saleOption,
        saleEndCustom: customDt,
        oneSeatOnly: isApp,
        ticketType: ticketKind,
        displayOrder: idx,
      });
    });
    return tiers;
  }

  function collectVatTreatment() {
    return document.querySelector('input[name="vat-treatment"]:checked')?.value || '';
  }

  function collectRefundPayload() {
    const policy =
      selectedRefundPolicy ||
      document.querySelector('input[name="refund-policy"]:checked')?.value ||
      '';
    const agreed = document.getElementById('refund-terms-agreed')?.checked;
    const payload = {
      refundPolicy: policy,
      refundTermsAgreed: agreed,
    };
    if (policy === 'full_refund') {
      payload.refundCutoffDays = Number(document.getElementById('refund-cutoff-days')?.value) || 0;
    } else if (policy === 'partial_refund') {
      payload.refundPolicyDetails = document.getElementById('refund-partial-details')?.value.trim() || '';
    } else if (policy === 'custom') {
      payload.refundPolicyDetails = document.getElementById('refund-custom-details')?.value.trim() || '';
    }
    return payload;
  }

  function tiersHavePaidPrice(tiers) {
    return (tiers || []).some(function (tier) {
      const price = Number(tier.price);
      return Number.isFinite(price) && price > 0;
    });
  }

  function paymentSetupReturnPath() {
    const qs = new URLSearchParams();
    if (eventIds.length) qs.set('ids', eventIds.join(','));
    // Keep drawer context out of Stripe return — open tickets full-page with draft restored.
    return '/organiser/event-tickets.html?' + qs.toString();
  }

  function draftStorageKey() {
    return TICKET_DRAFT_KEY + ':' + (eventIds.slice().sort().join(',') || 'none');
  }

  function saveTicketDraft() {
    try {
      const payload = {
        savedAt: Date.now(),
        eventIds: eventIds.slice(),
        attendanceMode: attendanceMode,
        tiers: attendanceMode === 'osop' ? collectOsopTiers() : collectTiers(),
        vatTreatment: collectVatTreatment(),
        refund: collectRefundPayload(),
        foodOrDrinkIncluded: !!document.getElementById('ee-food-or-drink')?.checked,
        askDietary: !!document.getElementById('ee-ask-dietary')?.checked,
        askAccessibility: !!document.getElementById('ee-ask-accessibility')?.checked,
      };
      sessionStorage.setItem(draftStorageKey(), JSON.stringify(payload));
    } catch {
      /* ignore quota / private mode */
    }
  }

  function readTicketDraft() {
    try {
      const raw = sessionStorage.getItem(draftStorageKey());
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function clearTicketDraft() {
    try {
      sessionStorage.removeItem(draftStorageKey());
    } catch {
      /* ignore */
    }
  }

  function restoreTicketDraft(draft) {
    if (!draft || typeof draft !== 'object') return false;
    if (draft.attendanceMode === 'osop') {
      setAttendanceMode('osop');
      if (Array.isArray(draft.tiers) && draft.tiers[0]) prefillOsopFromTicket(draft.tiers[0]);
    } else if (Array.isArray(draft.tiers) && draft.tiers.length) {
      setAttendanceMode('tickets');
      prefillTiers(draft.tiers);
    } else {
      return false;
    }
    if (draft.vatTreatment) {
      const vatVal = String(draft.vatTreatment);
      const radio = Array.from(document.querySelectorAll('input[name="vat-treatment"]')).find(
        (el) => el.value === vatVal
      );
      if (radio) selectVatCard(radio);
    }
    if (draft.refund && draft.refund.refundPolicy) {
      selectedRefundPolicy = draft.refund.refundPolicy;
      const policyVal = String(draft.refund.refundPolicy);
      const policyRadio = Array.from(document.querySelectorAll('input[name="refund-policy"]')).find(
        (el) => el.value === policyVal
      );
      if (policyRadio) selectRefundCard(policyRadio);
      const agree = document.getElementById('refund-terms-agreed');
      if (agree && draft.refund.refundTermsAgreed) agree.checked = true;
      const partial = document.getElementById('refund-partial-details');
      if (partial && draft.refund.refundPolicyDetails && policyVal === 'partial') {
        partial.value = draft.refund.refundPolicyDetails;
      }
      const custom = document.getElementById('refund-custom-details');
      if (custom && draft.refund.refundPolicyDetails && policyVal === 'custom') {
        custom.value = draft.refund.refundPolicyDetails;
      }
    }
    const food = document.getElementById('ee-food-or-drink');
    if (food) food.checked = !!draft.foodOrDrinkIncluded;
    const dietary = document.getElementById('ee-ask-dietary');
    if (dietary) dietary.checked = !!draft.askDietary;
    const access = document.getElementById('ee-ask-accessibility');
    if (access) access.checked = !!draft.askAccessibility;
    return true;
  }

  function paymentGroupForSeries() {
    if (!paymentSetupState) return null;
    return (
      window.HubOrganiserPaymentSetup?.groupForEvent(
        paymentSetupState,
        seriesMeta.organiserGroupId
      ) || paymentSetupState.primaryGroup
    );
  }

  function refreshPaymentSetupCard(tiers) {
    const mount = document.getElementById('ee-payment-setup-mount');
    const payment = window.HubOrganiserPaymentSetup;
    if (!mount || !payment || !paymentSetupState) return;

    const hasPaid = tiersHavePaidPrice(tiers);
    const group = paymentGroupForSeries();
    const needsSetup = hasPaid && payment.groupNeedsSetup(paymentSetupState, group);

    if (!needsSetup) {
      mount.hidden = true;
      mount.innerHTML = '';
      return;
    }

    const wasHidden = mount.hidden;
    payment.renderInto(mount, paymentSetupState, group, {
      returnPath: paymentSetupReturnPath(),
      buttonClass: 'hub-payment-setup-btn ee-btn ee-btn-primary',
      title: 'Add bank details before you publish paid tickets',
      lead: 'Stripe will ask for your UK bank account (about 5 minutes). Then come back here and click Publish event.',
      singleGroupOnly: true,
    });
    // Persist ticket form before leaving for Stripe, so return does not lose tiers.
    mount.querySelectorAll('[data-payment-setup]').forEach(function (btn) {
      if (btn.dataset.draftBound === '1') return;
      btn.dataset.draftBound = '1';
      btn.addEventListener('click', function () {
        saveTicketDraft();
      });
    });
    if (wasHidden) {
      mount.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  async function handleStripeConnectReturn() {
    const connectParam = new URLSearchParams(window.location.search).get('stripe_connect');
    if (connectParam !== 'return' && connectParam !== 'refresh') return;
    returnedFromStripe = true;
    const group = paymentGroupForSeries();
    let status = null;
    if (group?.id) {
      const { ok, data } = await api(
        '/api/organiser/stripe-connect?groupId=' + encodeURIComponent(group.id)
      );
      status = ok ? data : null;
      await loadPaymentSetupState();
    }
    if (status && status.ready) {
      showAlert('Bank details saved — you can publish paid tickets now.', 'ok');
    } else {
      showAlert(
        (status && status.incompleteHint) ||
          'Stripe setup is not finished yet. Keep your ticket details below, then click Add bank details again to complete identity and bank account.',
        'warn'
      );
    }
    if (window.history.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.delete('stripe_connect');
      window.history.replaceState({}, '', url.pathname + '?' + url.searchParams.toString());
    }
  }

  async function loadPaymentSetupState() {
    if (!window.HubOrganiserPaymentSetup) {
      paymentSetupState = null;
      return;
    }
    paymentSetupState = await window.HubOrganiserPaymentSetup.fetchState();
  }

  function updatePublishButton() {
    const btn = document.getElementById('ee-tickets-submit');
    const warn = document.getElementById('ee-publish-warn');
    if (!btn) return;
    if (ticketsLocked) {
      btn.disabled = true;
      const saveBtn = document.getElementById('ee-tickets-save');
      if (saveBtn) saveBtn.disabled = true;
      return;
    }
    try {
      const tiers = attendanceMode === 'osop' ? collectOsopTiers() : collectTiers();
      const refund = collectRefundPayload();
      const vat = collectVatTreatment();
      const hasPaid = tiersHavePaidPrice(tiers);
      const paymentNeeded =
        hasPaid &&
        paymentSetupState &&
        window.HubOrganiserPaymentSetup &&
        window.HubOrganiserPaymentSetup.groupNeedsSetup(paymentSetupState, paymentGroupForSeries());
      const ready =
        tiers.length > 0 && vat && refund.refundPolicy && refund.refundTermsAgreed && !paymentNeeded;
      btn.disabled = !ready;
      refreshPaymentSetupCard(tiers);
      if (warn) {
        if (paymentNeeded) {
          warn.hidden = false;
          warn.textContent =
            'Add bank details above before publishing paid tickets. Free tickets (£0) can be published without this step.';
        } else {
          warn.hidden = ready;
          if (!ready) {
            warn.textContent =
              'Your event is not live until you publish a ticket type — please add at least one ticket tier, choose how VAT applies, and complete the refund policy.';
          }
        }
      }
    } catch {
      btn.disabled = true;
      if (warn) warn.hidden = false;
    }
  }

  function selectVatCard(radio) {
    if (!radio) return;
    radio.checked = true;
    document.querySelectorAll('.ee-vat-card').forEach((card) => {
      const r = card.querySelector('input[type="radio"]');
      const active = r && r.checked;
      card.classList.toggle('is-selected', active);
      card.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    updatePublishButton();
  }

  function bindVatOptions() {
    document.querySelectorAll('.ee-vat-card').forEach((card) => {
      const radio = card.querySelector('input[type="radio"]');
      if (!radio) return;
      radio.addEventListener('change', () => selectVatCard(radio));
      card.addEventListener('click', (e) => {
        if (e.target.closest('input')) return;
        e.preventDefault();
        selectVatCard(radio);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectVatCard(radio);
        }
      });
    });
  }

  function selectRefundCard(radio) {
    if (!radio) return;
    radio.checked = true;
    selectedRefundPolicy = radio.value;
    document.querySelectorAll('.ee-refund-card').forEach((c) => {
      const r = c.querySelector('input[type="radio"]');
      const active = r && r.checked;
      c.classList.toggle('is-selected', active);
      c.setAttribute('aria-checked', active ? 'true' : 'false');
      const extra = c.querySelector('.ee-refund-extra');
      if (extra) extra.hidden = !active;
    });
    updatePublishButton();
  }

  function bindRefundPolicy() {
    document.querySelectorAll('.ee-refund-card').forEach((card) => {
      const radio = card.querySelector('input[type="radio"]');
      if (!radio) return;
      radio.addEventListener('change', () => selectRefundCard(radio));
      card.addEventListener('click', (e) => {
        if (e.target.closest('input, textarea')) return;
        e.preventDefault();
        selectRefundCard(radio);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectRefundCard(radio);
        }
      });
    });
    const agree = document.getElementById('refund-terms-agreed');
    if (agree) agree.addEventListener('change', updatePublishButton);
    ['refund-cutoff-days', 'refund-partial-details', 'refund-custom-details'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updatePublishButton);
    });
  }

  function formatCloseLabel(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return date + ' at ' + time;
  }

  function bindOsopCloseFields() {
    populateQuarterTimeSelect(document.getElementById('ee-osop-close-time'), '18:00');
  }

  function isOsopTicket(ticket) {
    const kind = ticket.ticketType || '';
    return /application/i.test(kind) || /application to attend/i.test(ticket.name || '');
  }

  function prefillOsopFromTicket(ticket) {
    if (!ticket) return;
    const priceEl = document.getElementById('ee-osop-price');
    if (priceEl) {
      priceEl.value = ticket.price === '' || ticket.price == null ? '0' : String(ticket.price);
    }
    const placesEl = document.getElementById('ee-osop-places');
    if (placesEl) {
      placesEl.value =
        ticket.quantityAvailable == null || ticket.quantityAvailable === ''
          ? ''
          : String(ticket.quantityAvailable);
    }
    const closeDateEl = document.getElementById('ee-osop-close-date');
    const closeTimeEl = document.getElementById('ee-osop-close-time');
    if (ticket.saleEnd) {
      if (closeDateEl) closeDateEl.value = isoToDateInput(ticket.saleEnd);
      if (closeTimeEl) populateQuarterTimeSelect(closeTimeEl, isoToTimeInput(ticket.saleEnd) || '18:00');
    }
    setAttendanceMode('osop');
    existingTicketsLoaded = true;
  }

  function collectOsopTiers() {
    const price = document.getElementById('ee-osop-price').value;
    const places = document.getElementById('ee-osop-places').value;
    const saleEnd = combineDateAndQuarterTime(
      document.getElementById('ee-osop-close-date')?.value,
      document.getElementById('ee-osop-close-time')?.value
    );
    let description =
      'One Seat Only Policy. Fixed application questions: (1) What industry are you in? (2) What is your job title?';
    if (places) description += ' Max approved places: ' + places + '.';
    if (saleEnd) description += ' Applications close: ' + formatCloseLabel(saleEnd) + '.';
    return [
      {
        name: 'Application to attend',
        price: price === '' ? 0 : price,
        description,
        status: 'Available',
        quantityAvailable: places === '' ? null : Number(places),
        saleEnd,
        oneSeatOnly: true,
      },
    ];
  }

  function attendeeExtras() {
    return {
      foodIncluded: document.getElementById('ee-food-included').checked,
      collectDietary: document.getElementById('ee-collect-dietary').checked,
      collectAccessibility: document.getElementById('ee-collect-access').checked,
    };
  }

  async function applyAttendeeExtrasToEvents() {
    const extras = attendeeExtras();
    let lastError = '';
    for (const id of eventIds) {
      const res = await api('/api/organiser/events?id=' + encodeURIComponent(id));
      if (!res.ok || !res.data.event) {
        lastError = res.data?.message || res.data?.error || 'Could not load event';
        continue;
      }
      const ev = res.data.event;
      const patch = await api('/api/organiser/events', {
        method: 'PATCH',
        body: JSON.stringify({
          id,
          title: ev.title,
          organiserGroupId: ev.organiserGroupId || seriesMeta.organiserGroupId,
          type: ev.type,
          description: ev.description,
          location: ev.location,
          venue: ev.venue,
          ...(ev.imageUrl ? { photoUrl: ev.imageUrl } : {}),
          attendeeExtras: extras,
        }),
      });
      if (!patch.ok) {
        lastError = patch.data?.message || patch.data?.error || 'Could not save attendee booking questions';
      }
    }
    if (lastError) return { ok: false, message: lastError };
    return { ok: true };
  }

  function renderSalesPendingBanner() {
    const el = document.getElementById('ee-tickets-alert');
    if (!el || !eventIds[0]) return;
    el.className = 'ee-alert';
    el.hidden = false;
    el.innerHTML =
      '<strong>Ticket sales are off for this event</strong> — visitors see a nudge instead of checkout. Turn sales on when you are ready.' +
      '<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;">' +
      '<button type="button" class="ee-btn ee-btn-primary" id="ee-enable-sales-btn">Enable ticket sales</button>' +
      '</div>';
    const btn = document.getElementById('ee-enable-sales-btn');
    if (btn) {
      btn.addEventListener('click', async function () {
        btn.disabled = true;
        const { ok, data } = await api('/api/organiser/tickets', {
          method: 'PATCH',
          body: JSON.stringify({ action: 'enable_sales', eventId: eventIds[0] }),
        });
        if (!ok) {
          showAlert(data.message || data.error || 'Could not enable ticket sales', 'warn');
          btn.disabled = false;
          return;
        }
        el.hidden = true;
        el.innerHTML = '';
        showAlert(data.message || 'Ticket sales are now live.', 'ok');
      });
    }
  }

  async function init() {
    loadSeriesMeta();
    bindOsopCloseFields();
    if (!eventIds.length) {
      showAlert('No events in this series. Go back and save your event dates first.', 'warn');
      return;
    }

    const editLink = document.getElementById('ee-edit-event-link');
    if (editLink && eventIds[0]) {
      if (isEmbedDrawer) {
        editLink.hidden = false;
        editLink.href = '#';
        editLink.addEventListener('click', function (e) {
          e.preventDefault();
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(
              { type: 'hub-event-goto-edit', eventId: eventIds[0] },
              window.location.origin
            );
          }
        });
      } else {
        editLink.href = 'event-edit.html?id=' + encodeURIComponent(eventIds[0]);
        editLink.hidden = false;
      }
    }

    const loading = window.organiserPageLoading;
    const bootWork = async () => {
      await hydrateSeriesEvents();
      await expandSeriesEventIds();
      return loadExistingData();
    };
    let loaded;
    if (loading && loading.run) {
      loaded = await loading.run('Loading tickets', bootWork);
    } else {
      if (loading) loading.show('Loading tickets');
      loaded = await bootWork();
      if (loading) loading.hide();
    }
    if (!loaded || loaded.authFailed) return;

    if (!loaded.event && eventIds.length) {
      try {
        sessionStorage.removeItem(SERIES_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      showAlert(
        'This event was deleted or is no longer available. Go back to My Events and open a current listing.',
        'warn'
      );
      notifyEmbedDrawerReady();
      return;
    }

    if (loaded.event) {
      if (loaded.event.title && !seriesMeta.title) seriesMeta.title = loaded.event.title;
      if (loaded.event.organiserGroupId && !seriesMeta.organiserGroupId) {
        seriesMeta.organiserGroupId = loaded.event.organiserGroupId;
      }
      prefillRefundFromEvent(loaded.event);
      applyTicketsLockUi(loaded.event);
    }

    await loadPaymentSetupState();
    await handleStripeConnectReturn();

    renderSeriesSummary();

    if (loaded.event && loaded.event.status === 'published' && !loaded.event.ticketSalesEnabled) {
      renderSalesPendingBanner();
    }

    const draft = readTicketDraft();
    let restoredDraft = false;
    if (draft && (returnedFromStripe || !loaded.tickets.length)) {
      restoredDraft = restoreTicketDraft(draft);
    }

    if (restoredDraft) {
      showAlert('Restored your ticket details from before bank setup. Review them, then publish when ready.', 'ok');
    } else if (loaded.tickets.length) {
      const osopTicket = loaded.tickets.find(isOsopTicket);
      if (osopTicket) {
        prefillOsopFromTicket(osopTicket);
        showAlert('Loaded your One Seat Only Policy settings. Saving will update all dates in this series.', 'ok');
      } else {
        prefillTiers(loaded.tickets);
        showAlert(
          'Loaded ' +
            loaded.tickets.length +
            ' existing ticket type' +
            (loaded.tickets.length === 1 ? '' : 's') +
            '. Saving will update all dates in this series.',
          'ok'
        );
      }
    } else {
      addTierRow();
    }

    document.getElementById('ee-add-tier').addEventListener('click', () => addTierRow({ useDefaultName: false }));
    document.getElementById('ee-mode-tickets').addEventListener('click', () => {
      setAttendanceMode('tickets');
      updateTierSummary();
      updatePublishButton();
    });
    document.getElementById('ee-mode-osop').addEventListener('click', () => {
      setAttendanceMode('osop');
      updatePublishButton();
    });
    bindRefundPolicy();
    bindVatOptions();
    document.getElementById('ee-osop-price')?.addEventListener('input', updatePublishButton);
    document.getElementById('ee-osop-price')?.addEventListener('change', updatePublishButton);
    updatePublishButton();

    if (!loaded.tickets.length && window.HubFlowTour && !isEmbedDrawer) {
      window.HubFlowTour.startEventTicketsTour({ isEdit: false, delay: 0 });
    }

    notifyEmbedDrawerReady();
  }

  async function saveTickets(publish) {
    showAlert('');

    if (ticketsLocked) {
      showAlert(
        'This event has ticket sales — ticket types and refund terms cannot be changed. Cancel the event from the event editor if you need to make changes.',
        'warn'
      );
      return;
    }

    if (publish && window.HubOrganiserTerms) {
      try {
        await window.HubOrganiserTerms.requireAcceptance();
      } catch (e) {
        return;
      }
    }

    const loading = window.organiserPageLoading;
    const tiers = attendanceMode === 'osop' ? collectOsopTiers() : collectTiers();
    if (!tiers.length) {
      const msg = publish
        ? 'Your event is not live until you publish a ticket type — please add at least one ticket tier above.'
        : 'Add at least one ticket type with a name.';
      showAlert(msg, publish ? 'warn' : '');
      if (publish) {
        const panelId = attendanceMode === 'osop' ? 'ee-panel-osop' : 'ee-panel-tickets';
        document.getElementById(panelId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const warn = document.getElementById('ee-publish-warn');
        if (warn) warn.hidden = false;
      }
      updatePublishButton();
      return;
    }
    if (!eventIds.length) {
      showAlert('No events to attach tickets to.');
      return;
    }

    if (existingTicketsLoaded) {
      const proceed = window.confirm(
        'This will replace existing ticket types for ' +
          eventIds.length +
          ' event' +
          (eventIds.length === 1 ? '' : 's') +
          ' with what you have here. Continue?'
      );
      if (!proceed) return;
    }

    const refund = collectRefundPayload();
    if (publish) {
      if (!collectVatTreatment()) {
        showAlert('Choose whether VAT is included in the ticket price or added at checkout.');
        updatePublishButton();
        return;
      }
      if (!refund.refundPolicy) {
        showAlert('Select a refund policy before publishing.');
        updatePublishButton();
        return;
      }
      if (!refund.refundTermsAgreed) {
        showAlert('Confirm you understand refunds are your responsibility under Stripe Connect.');
        updatePublishButton();
        return;
      }
      if (
        tiersHavePaidPrice(tiers) &&
        paymentSetupState &&
        window.HubOrganiserPaymentSetup &&
        window.HubOrganiserPaymentSetup.groupNeedsSetup(paymentSetupState, paymentGroupForSeries())
      ) {
        refreshPaymentSetupCard(tiers);
        showAlert('Add bank details above before publishing paid tickets.', 'warn');
        updatePublishButton();
        return;
      }
    }

    const btn = document.getElementById('ee-tickets-submit');
    const saveBtn = document.getElementById('ee-tickets-save');
    if (btn) btn.disabled = true;
    if (saveBtn) saveBtn.disabled = true;

    const body = {
      eventIds,
      tickets: tiers,
      publish,
      vatTreatment: collectVatTreatment(),
      attendeeExtras: attendeeExtras(),
      ...refund,
    };

    const saveWork = async () => {
      const { ok, data } = await api('/api/organiser/tickets', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!ok) return { ok, data };

      const extrasResult = await applyAttendeeExtrasToEvents();
      if (extrasResult && !extrasResult.ok) {
        return {
          ok: false,
          data: {
            error: 'attendee_extras_failed',
            message:
              extrasResult.message ||
              'Tickets saved but attendee booking questions could not be updated. Try saving again.',
          },
        };
      }

      return { ok, data };
    };

    let result;
    try {
      if (loading && loading.run) {
        result = await loading.run(publish ? 'Publishing event' : 'Saving tickets', saveWork);
      } else {
        if (loading) loading.show(publish ? 'Publishing event' : 'Saving tickets');
        result = await saveWork();
        if (loading) loading.hide();
      }
    } finally {
      if (saveBtn) saveBtn.disabled = false;
      updatePublishButton();
    }

    const ok = result.ok;
    const data = result.data;

    if (!ok) {
      if (data.error === 'event_has_ticket_sales') {
        applyTicketsLockUi({ locked: true });
        showAlert(
          data.message ||
            'This event has ticket sales — cancel the event instead of changing ticket types or refund terms.',
          'warn'
        );
        return;
      }
      if (data.error === 'stripe_connect_required' || /connect stripe|bank details/i.test(String(data.message || ''))) {
        refreshPaymentSetupCard(attendanceMode === 'osop' ? collectOsopTiers() : collectTiers());
        showAlert(
          data.message ||
            'Add bank details before publishing paid tickets — use the button above, then try again.',
          'warn'
        );
        return;
      }
      showAlert(data.message || data.error || 'Could not save tickets');
      return;
    }

    if (publish) {
      const publishedRows = Array.isArray(data.publishedEvents) ? data.publishedEvents : [];
      const allLive =
        publishedRows.length > 0 &&
        publishedRows.every(function (ev) {
          return String(ev.status || ev.listingStatus || '').toLowerCase() === 'published';
        });
      if (!allLive) {
        showAlert(
          'Tickets were saved but the event did not go live. Open My Events, check refund policy and VAT, then publish again.',
          'warn'
        );
        return;
      }
    }

    const salesScheduled = tiers.some(function (tier) {
      if (!tier.saleStart) return false;
      const start = new Date(tier.saleStart);
      return !Number.isNaN(start.getTime()) && start > new Date();
    });

    if (!publish) {
      existingTicketsLoaded = true;
      clearTicketDraft();
      showAlert(
        'Tickets saved as draft. Your event is not on Browse events yet — choose VAT and refund policy below, then click Publish event.',
        'ok'
      );
      document.getElementById('ee-refund-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    showAlert(
      salesScheduled
        ? 'Your event is live on the hub. Ticket sales will open on the date you set — saved attendees will be emailed when sales begin.'
        : 'Your event is live on the hub and ticket sales are on.',
      'ok'
    );

    try {
      sessionStorage.removeItem(SERIES_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    clearTicketDraft();

    if (isEmbedDrawer && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'hub-event-tickets-done' }, window.location.origin);
      return;
    }

    const qs = new URLSearchParams();
    qs.set('ids', eventIds.join(','));
    if (seriesMeta.title) qs.set('title', seriesMeta.title);
    if (seriesMeta.imageUrl) qs.set('image', seriesMeta.imageUrl);
    const firstImg =
      seriesMeta.events && seriesMeta.events[0] && seriesMeta.events[0].imageUrl;
    if (firstImg) qs.set('image', firstImg);
    location.href = 'event-published.html?' + qs.toString();
  }

  document.getElementById('ee-tickets-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveTickets(true);
  });

  const saveDraftBtn = document.getElementById('ee-tickets-save');
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', () => saveTickets(false));
  }

  init().catch(function (err) {
    console.error(err);
    showAlert('Could not load ticket setup. Refresh the page or go back to My Events.', 'warn');
  });
})();
