/**
 * Ticket setup for an event series — tiers, Category Exclusivity, sale windows.
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
  let organiserComplimentaryVisits = 0;

  const SALE_END_OPTIONS = [
    { value: 'at_start', label: 'When the event starts' },
    { value: '12_hours', label: '12 hours before the event' },
    { value: '1_day', label: '1 day before the event' },
    { value: '1_week', label: '1 week before the event' },
    { value: 'custom', label: 'Custom date & time' },
  ];
  const LEGACY_MODERATE_REFUND_DETAILS =
    '100% refund up to 7 days before the event; 50% refund up to 48 hours before the event.';
  const REFUND_PRESETS = {
    flexible: { refundPolicy: 'full_refund', refundCutoffDays: 2 },
    standard: { refundPolicy: 'full_refund', refundCutoffDays: 7 },
    strict: { refundPolicy: 'full_refund', refundCutoffDays: 14 },
    non_refundable: { refundPolicy: 'no_refunds' },
  };

  function inferRefundPresetFromStored(refundPolicy, refundCutoffDays, refundPolicyDetails) {
    const policy = String(refundPolicy || '').trim();
    const cutoff = Number(refundCutoffDays);
    const details = String(refundPolicyDetails || '').trim();
    if (policy === 'no_refunds') return 'non_refundable';
    if (policy === 'full_refund') {
      if (cutoff === 2 || cutoff === 1) return 'flexible';
      if (cutoff === 7) return 'standard';
      if (cutoff === 14 || cutoff === 3) return 'strict';
      if (!Number.isFinite(cutoff) || cutoff <= 0) return 'standard';
      if (cutoff <= 2) return 'flexible';
      if (cutoff <= 7) return 'standard';
      return 'strict';
    }
    if (
      (policy === 'custom' || policy === 'partial_refund') &&
      (details === LEGACY_MODERATE_REFUND_DETAILS ||
        /^100% refund up to 7 days before/i.test(details))
    ) {
      return 'standard';
    }
    return '';
  }

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
    if (msg) {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch {
        /* ignore */
      }
    }
  }

  function getPublishBlockers(tiers) {
    const list = tiers || collectActiveTiers();
    const refund = collectRefundPayload();
    const blockers = [];
    if (!list.length) {
      blockers.push('Add at least one ticket type with a name');
    } else if (!tiersHaveRequiredSaleEnds(list)) {
      blockers.push('Choose a valid sale end for every ticket tier');
    }
    if (!collectVatTreatment()) {
      blockers.push('Choose how VAT applies to ticket prices');
    }
    if (!refund.refundPolicy) {
      blockers.push('Select a refund policy');
    }
    if (!refund.refundTermsAgreed) {
      blockers.push('Tick the refund responsibility checkbox');
    }
    const paymentNeeded =
      tiersHavePaidPrice(list) &&
      paymentSetupState &&
      window.HubOrganiserPaymentSetup &&
      window.HubOrganiserPaymentSetup.groupNeedsSetup(paymentSetupState, paymentGroupForSeries());
    if (paymentNeeded) {
      blockers.push('Add bank details for paid tickets');
    }
    return blockers;
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
    const heroPos = String(
      seriesMeta.imagePosition ||
        (seriesMeta.events && seriesMeta.events[0] && seriesMeta.events[0].imagePosition) ||
        ''
    ).trim();
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
      if (/^\d{1,3}%\s+\d{1,3}%$/.test(heroPos)) {
        img.style.objectPosition = heroPos;
      }
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
    } else if (heroImg && seriesCard) {
      const existing = seriesCard.querySelector('.ee-series-hero img');
      if (existing && /^\d{1,3}%\s+\d{1,3}%$/.test(heroPos)) {
        existing.style.objectPosition = heroPos;
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
      imagePosition: ev.imagePosition || seriesMeta.imagePosition || '',
    }));
    if (!seriesMeta.imagePosition && seriesMeta.events[0] && seriesMeta.events[0].imagePosition) {
      seriesMeta.imagePosition = seriesMeta.events[0].imagePosition;
    }
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
            imagePosition: cur.imagePosition || ev.imagePosition || '',
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
          imagePosition: ev.imagePosition || '',
        });
      });
    }

    seriesMeta.events = eventIds.map((id) => byId.get(id) || { id });
    if (!seriesMeta.imageUrl && seriesMeta.events[0] && seriesMeta.events[0].imageUrl) {
      seriesMeta.imageUrl = seriesMeta.events[0].imageUrl;
    }
    if (!seriesMeta.imagePosition && seriesMeta.events[0] && seriesMeta.events[0].imagePosition) {
      seriesMeta.imagePosition = seriesMeta.events[0].imagePosition;
    }
  }

  function notifyEmbedDrawerReady() {
    if (isEmbedDrawer && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'hub-event-drawer-ready' }, window.location.origin);
    }
  }

  function isOpenBookingMode(mode) {
    return mode === 'tickets' || mode === 'guest_programme';
  }

  function guestProgrammeEnabled() {
    const el = document.getElementById('ee-guest-programme-enabled');
    return Boolean(el && el.checked);
  }

  function setGuestProgrammeEnabled(on) {
    const el = document.getElementById('ee-guest-programme-enabled');
    if (el) el.checked = Boolean(on);
  }

  function resolveOpenBookingMode() {
    return guestProgrammeEnabled() ? 'guest_programme' : 'tickets';
  }

  function setAttendanceMode(mode) {
    const requested = mode === 'guest_programme' ? mode : 'tickets';
    const isCategory = false;
    const isGuest = requested === 'guest_programme';

    if (!isCategory) {
      setGuestProgrammeEnabled(isGuest);
      attendanceMode = resolveOpenBookingMode();
    } else {
      attendanceMode = 'category_exclusivity';
    }

    document.querySelectorAll('.ee-mode-btn').forEach((btn) => {
      const btnMode = btn.getAttribute('data-mode');
      const active =
        btnMode === 'category_exclusivity'
          ? isCategory
          : btnMode === 'tickets' && !isCategory;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const ticketsPanel = document.getElementById('ee-panel-tickets');
    const guestAddon = document.getElementById('ee-guest-addon');
    const guestFields = document.getElementById('ee-guest-programme-fields');
    const guestPassesOptOut = document.getElementById('ee-guest-passes-opt-out');
    const panelTitle = document.getElementById('ee-tickets-panel-title');
    const desc = document.getElementById('ee-mode-desc');
    const openBooking = isOpenBookingMode(attendanceMode);
    const guestOn = attendanceMode === 'guest_programme';

    if (ticketsPanel) ticketsPanel.hidden = !openBooking;
    if (guestAddon) guestAddon.hidden = !openBooking;
    if (guestFields) guestFields.hidden = !guestOn;
    if (guestPassesOptOut) guestPassesOptOut.hidden = !guestOn;
    // Keep the how-it-works note visible so organisers can read it before enabling.
    if (panelTitle) {
      panelTitle.textContent = guestOn ? 'Member ticket types' : 'Ticket types';
    }
    syncGuestVisitsInput();
    if (desc) {
      if (isCategory) {
        desc.textContent =
          'Application-based attendance — you review industry and job title, then approve or deny. Approved applicants pay via your payment link.';
      } else if (guestOn) {
        const visits = readGuestVisitsAllowed() || organiserComplimentaryVisits || 0;
        desc.textContent =
          visits > 0
            ? 'Open booking with guest visits — new attendees get ' +
              visits +
              ' complimentary visit' +
              (visits === 1 ? '' : 's') +
              ' before paid member tickets unlock. Add your ticket types below.'
            : 'Open booking with guest visits — enter how many complimentary visits (1–3) below.';
      } else {
        desc.textContent =
          'Standard open booking — set up one or more ticket types with prices and quantities. Optionally enable the guest visit programme below.';
      }
    }
    updateTierSummary();
  }

  function readGuestVisitsAllowed() {
    const el = document.getElementById('ee-guest-visits-allowed');
    if (!el) return organiserComplimentaryVisits || 0;
    const n = Math.floor(Number(el.value));
    if (!Number.isFinite(n)) return 0;
    return Math.min(3, Math.max(0, n));
  }

  function syncGuestVisitsInput() {
    const el = document.getElementById('ee-guest-visits-allowed');
    if (!el) return;
    const current = Number(el.value);
    if (!Number.isFinite(current) || current < 1) {
      el.value = String(Math.min(3, Math.max(1, organiserComplimentaryVisits || 1)));
    } else if (organiserComplimentaryVisits > 0 && (!el.dataset.touched || current < 1)) {
      el.value = String(Math.min(3, Math.max(1, organiserComplimentaryVisits)));
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
      '<div class="ee-tier-toolbar">' +
      '<div class="ee-tier-order">' +
      '<button type="button" class="ee-btn ee-btn-outline ee-tier-up" aria-label="Move up">↑</button>' +
      '<button type="button" class="ee-btn ee-btn-outline ee-tier-down" aria-label="Move down">↓</button>' +
      '<span class="ee-tier-order-label">Tier ' +
      String(index + 1) +
      '</span>' +
      '</div>' +
      '<button type="button" class="ee-btn ee-btn-outline ee-tier-remove">Remove</button>' +
      '</div>' +
      '<div class="ee-tier-body">' +
      '<div class="ee-field ee-tier-name-field"><label>Ticket name</label>' +
      '<input type="text" class="ee-tier-name" required placeholder="e.g. General Admission, Early Bird" /></div>' +
      '<div class="ee-field ee-tier-desc-field"><label>Description <span class="ee-optional">(optional)</span></label>' +
      '<textarea class="ee-tier-desc" rows="2" placeholder="What is included with this ticket"></textarea></div>' +
      '<div class="ee-row-2 ee-tier-price-row">' +
      '<div class="ee-field"><label>Price (£)</label><p class="ee-hint">Enter 0 for free</p>' +
      '<input type="number" class="ee-tier-price" min="0" step="0.01" value="0" /></div>' +
      '<div class="ee-field"><label>Quantity available <span class="ee-optional">(optional)</span></label>' +
      '<input type="number" class="ee-tier-qty" min="0" step="1" placeholder="Unlimited" /></div>' +
      '</div>' +
      '<div class="ee-row-2 ee-tier-sale-row">' +
      '<div class="ee-field"><label>Sale start <span class="ee-optional">(optional)</span></label>' +
      '<p class="ee-hint" style="margin-top:0">Leave blank and sales start today.</p>' +
      '<div class="ee-datetime-split">' +
      '<input type="date" class="ee-tier-sale-start-date" />' +
      '<select class="ee-tier-sale-start-time" aria-label="Sale start time"></select>' +
      '</div></div>' +
      '<div class="ee-field"><label>Sale end</label>' +
      saleEndSelectHtml('at_start') +
      '<div class="ee-sale-custom-wrap" hidden>' +
      '<p class="ee-hint" style="margin:0 0 6px">Custom end date and time</p>' +
      '<div class="ee-datetime-split">' +
      '<input type="date" class="ee-tier-sale-custom-date" />' +
      '<select class="ee-tier-sale-custom-time" aria-label="Custom sale end time"></select>' +
      '</div></div></div>' +
      '</div>' +
      '</div></div>'
    );
  }

  function updateTierSummary() {
    const summary = document.getElementById('ee-tier-summary');
    if (!summary || !isOpenBookingMode(attendanceMode)) return;
    const rows = document.querySelectorAll('.ee-tier-row');
    let count = 0;
    let totalQty = 0;
    let hasUnlimited = false;
    let minPrice = null;
    rows.forEach((row, i) => {
      const orderLabel = row.querySelector('.ee-tier-order-label');
      if (orderLabel) orderLabel.textContent = 'Tier ' + String(i + 1);
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
    const noun = attendanceMode === 'guest_programme' ? 'member ticket type' : 'ticket type';
    summary.textContent =
      count +
      ' ' +
      noun +
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
      const eventDate = seriesMeta.events && seriesMeta.events[0] ? seriesMeta.events[0].date : null;
      const option = ticket.saleEndOption || inferSaleEndOptionFromIso(ticket.saleEnd, eventDate);
      if (saleSelect) saleSelect.value = option;
      if (customWrap) customWrap.hidden = option !== 'custom';
      if (option === 'custom') {
        if (customDate) customDate.value = isoToDateInput(ticket.saleEnd);
        if (customTime) populateQuarterTimeSelect(customTime, isoToTimeInput(ticket.saleEnd) || '18:00');
      }
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
      const editablePolicy = inferRefundPresetFromStored(
        ev.refundPolicy,
        ev.refundCutoffDays,
        ev.refundPolicyDetails
      );
      const refundRadio = document.querySelector(
        'input[name="refund-policy"][value="' + editablePolicy + '"]'
      );
      if (refundRadio) selectRefundCard(refundRadio);
    } else {
      const defaultRadio = document.getElementById('refund-policy-standard');
      if (defaultRadio) selectRefundCard(defaultRadio);
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
      location.href = '../login?next=' + next;
      return { tickets: [], event: null, authFailed: true };
    }

    const tickets =
      ticketsRes.ok && Array.isArray(ticketsRes.data.tickets) ? ticketsRes.data.tickets : [];
    const event = eventRes.ok && eventRes.data.event ? eventRes.data.event : null;
    return { tickets, event, authFailed: false };
  }

  function collectActiveTiers() {
    return collectTiers();
  }

  async function loadOrganiserGuestVisitSetting(groupId) {
    if (!groupId) {
      organiserComplimentaryVisits = 0;
      return;
    }
    const { ok, data } = await api('/api/organiser/groups?id=' + encodeURIComponent(groupId));
    if (ok && data.group) {
      organiserComplimentaryVisits = Number(data.group.complimentaryVisitsAllowed) || 0;
    }
    const visitsEl = document.getElementById('ee-guest-visits-allowed');
    if (visitsEl && organiserComplimentaryVisits > 0) {
      visitsEl.value = String(Math.min(3, Math.max(1, organiserComplimentaryVisits)));
    }
  }

  async function saveOrganiserGuestVisitsAllowed(groupId, allowed) {
    const id = String(groupId || '').trim();
    const n = Math.min(3, Math.max(1, Math.floor(Number(allowed) || 0)));
    if (!id || n < 1) return { ok: false, message: 'Enter how many complimentary visits (1–3).' };
    const { ok, data } = await api('/api/organiser/groups', {
      method: 'PATCH',
      body: JSON.stringify({ id, complimentaryVisitsAllowed: n }),
    });
    if (ok) organiserComplimentaryVisits = n;
    return { ok, message: data?.message || data?.error || '' };
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
        categoryExclusivity: false,
        ticketType: 'Standard',
        displayOrder: idx,
      });
    });
    return tiers;
  }

  function collectVatTreatment() {
    return document.querySelector('input[name="vat-treatment"]:checked')?.value || '';
  }

  function collectRefundPayload() {
    const presetKey =
      selectedRefundPolicy ||
      document.querySelector('input[name="refund-policy"]:checked')?.value ||
      '';
    const agreed = document.getElementById('refund-terms-agreed')?.checked;
    const preset = REFUND_PRESETS[presetKey];
    return {
      ...(preset || {}),
      refundPreset: presetKey,
      refundTermsAgreed: agreed,
    };
  }

  function tiersHaveRequiredSaleEnds(tiers) {
    return (tiers || []).length > 0 && tiers.every((tier) => Boolean(tier.saleEnd));
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
    return '/organiser/event-tickets?' + qs.toString();
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
        guestPassesDisabled: collectGuestPassesDisabled(),
        tiers: collectTiers(),
        vatTreatment: collectVatTreatment(),
        refund: collectRefundPayload(),
        foodOrDrinkIncluded: !!document.getElementById('ee-food-included')?.checked,
        askDietary: !!document.getElementById('ee-collect-dietary')?.checked,
        askAccessibility: !!document.getElementById('ee-collect-access')?.checked,
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
    if (draft.attendanceMode === 'guest_programme') {
      setAttendanceMode('guest_programme');
      if (Array.isArray(draft.tiers) && draft.tiers.length) prefillTiers(draft.tiers);
    } else if (Array.isArray(draft.tiers) && draft.tiers.length) {
      setAttendanceMode('tickets');
      prefillTiers(draft.tiers);
    } else {
      return false;
    }
    if (draft.guestPassesDisabled != null) {
      const guestEl = document.getElementById('ee-guest-passes-disabled');
      if (guestEl) guestEl.checked = Boolean(draft.guestPassesDisabled);
    }
    if (draft.vatTreatment) {
      const vatVal = String(draft.vatTreatment);
      const radio = Array.from(document.querySelectorAll('input[name="vat-treatment"]')).find(
        (el) => el.value === vatVal
      );
      if (radio) selectVatCard(radio);
    }
    if (draft.refund && draft.refund.refundPolicy) {
      const draftPolicyVal = String(draft.refund.refundPolicy);
      let policyVal = String(draft.refund.refundPreset || '');
      if (!REFUND_PRESETS[policyVal]) {
        policyVal = inferRefundPresetFromStored(
          draftPolicyVal,
          draft.refund.refundCutoffDays,
          draft.refund.refundPolicyDetails
        );
      }
      selectedRefundPolicy = policyVal;
      const policyRadio = Array.from(document.querySelectorAll('input[name="refund-policy"]')).find(
        (el) => el.value === policyVal
      );
      if (policyRadio) selectRefundCard(policyRadio);
      const agree = document.getElementById('refund-terms-agreed');
      if (agree && draft.refund.refundTermsAgreed) agree.checked = true;
    }
    const food = document.getElementById('ee-food-included');
    if (food) food.checked = !!draft.foodOrDrinkIncluded;
    const dietary = document.getElementById('ee-collect-dietary');
    if (dietary) dietary.checked = !!draft.askDietary;
    const access = document.getElementById('ee-collect-access');
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
      if (warn) warn.hidden = true;
      return;
    }
    try {
      const tiers = collectActiveTiers();
      const blockers = getPublishBlockers(tiers);
      // Keep Publish clickable so incomplete setup shows a clear message instead of a dead click.
      btn.disabled = false;
      refreshPaymentSetupCard(tiers);
      if (warn) {
        if (!blockers.length) {
          warn.hidden = true;
          warn.textContent = '';
        } else {
          warn.hidden = false;
          warn.textContent =
            'Before this event can go live: ' + blockers.join('; ') + '.';
        }
      }
    } catch {
      btn.disabled = false;
      if (warn) {
        warn.hidden = false;
        warn.textContent =
          'Finish ticket types, VAT, and refund policy below, then click Publish event again.';
      }
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
  }

  function formatCloseLabel(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return date + ' at ' + time;
  }

  function bindCategoryExclusivityCloseFields() {
    bindCategoryExclusivityCloseUi();
  }

  function isAlumniTicket(ticket) {
    const kind = ticket.ticketType || '';
    return kind === 'Alumni' || /^alumni/i.test(ticket.name || '');
  }

  function isGuestVisitTicket(ticket) {
    const kind = ticket.ticketType || '';
    return /guest-visit/i.test(kind) || /^guest\s*visit$/i.test(ticket.name || '');
  }

  function collectGuestPassesDisabled() {
    return Boolean(document.getElementById('ee-guest-passes-disabled')?.checked);
  }

  function prefillGuestPassesDisabled(eventRow) {
    const el = document.getElementById('ee-guest-passes-disabled');
    if (el) el.checked = Boolean(eventRow?.guestPassesDisabled);
  }

  function bindGuestPassesFields() {
    const disabledEl = document.getElementById('ee-guest-passes-disabled');
    if (disabledEl) disabledEl.addEventListener('change', updatePublishButton);
  }

  function bindAlumniFastPassFields() {
    const enabled = document.getElementById('ee-alumni-enabled');
    const fields = document.getElementById('ee-alumni-fields');
    const toggle = () => {
      if (fields) fields.hidden = !enabled?.checked;
      updatePublishButton();
    };
    if (enabled) {
      enabled.addEventListener('change', toggle);
      toggle();
    }
    populateQuarterTimeSelect(document.getElementById('ee-alumni-sale-end-time'), '18:00');
  }

  function collectAlumniFastPass() {
    // Not available to organisers yet — never persist an enabled alumni tier from this UI.
    return { enabled: false };
  }

  function prefillAlumniFastPass(_eventRow, _alumniTicket) {
    // Alumni Fast-Pass UI is hidden until the feature ships.
  }

  function isCategoryExclusivityTicket(ticket) {
    const kind = ticket.ticketType || '';
    return /application/i.test(kind) || /application to attend/i.test(ticket.name || '');
  }

  function inferSaleEndOptionFromIso(saleEndIso, eventDateIso) {
    if (!saleEndIso) return '1_week';
    for (const opt of SALE_END_OPTIONS) {
      if (opt.value === 'custom') continue;
      const computed = computeSaleEndIso(opt.value, null, eventDateIso);
      if (!computed) continue;
      const a = new Date(computed).getTime();
      const b = new Date(saleEndIso).getTime();
      if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 60 * 1000) {
        return opt.value;
      }
    }
    return 'custom';
  }

  function bindCategoryExclusivityCloseUi() {
    const closeSel = document.getElementById('ee-ce-close');
    const customWrap = document.getElementById('ee-ce-close-custom');
    populateQuarterTimeSelect(document.getElementById('ee-ce-close-time'), '18:00');
    if (!closeSel || !customWrap) return;
    const sync = () => {
      customWrap.hidden = closeSel.value !== 'custom';
    };
    closeSel.addEventListener('change', sync);
    sync();
  }

  function prefillCategoryExclusivityFromTicket(ticket) {
    if (!ticket) return;
    const priceEl = document.getElementById('ee-ce-price');
    if (priceEl) {
      priceEl.value = ticket.price === '' || ticket.price == null ? '0' : String(ticket.price);
    }
    const placesEl = document.getElementById('ee-ce-places');
    if (placesEl) {
      placesEl.value =
        ticket.quantityAvailable == null || ticket.quantityAvailable === ''
          ? ''
          : String(ticket.quantityAvailable);
    }
    const eventDate = seriesMeta.events && seriesMeta.events[0] ? seriesMeta.events[0].date : null;
    const closeSel = document.getElementById('ee-ce-close');
    const customWrap = document.getElementById('ee-ce-close-custom');
    const closeDateEl = document.getElementById('ee-ce-close-date');
    const closeTimeEl = document.getElementById('ee-ce-close-time');
    if (ticket.saleEnd) {
      const option = ticket.saleEndOption || inferSaleEndOptionFromIso(ticket.saleEnd, eventDate);
      if (closeSel) closeSel.value = option;
      if (customWrap) customWrap.hidden = option !== 'custom';
      if (option === 'custom') {
        if (closeDateEl) closeDateEl.value = isoToDateInput(ticket.saleEnd);
        if (closeTimeEl) populateQuarterTimeSelect(closeTimeEl, isoToTimeInput(ticket.saleEnd) || '18:00');
      }
    }
    setAttendanceMode('category_exclusivity');
    existingTicketsLoaded = true;
  }

  function collectCategoryExclusivityTiers() {
    const price = document.getElementById('ee-ce-price').value;
    const places = document.getElementById('ee-ce-places').value;
    const saleOption = document.getElementById('ee-ce-close')?.value || '1_week';
    const customDt = combineDateAndQuarterTime(
      document.getElementById('ee-ce-close-date')?.value,
      document.getElementById('ee-ce-close-time')?.value
    );
    const eventDate = seriesMeta.events && seriesMeta.events[0] ? seriesMeta.events[0].date : null;
    const saleEnd = computeSaleEndIso(saleOption, customDt, eventDate);
    let description =
      'Category Exclusivity. Fixed application questions: (1) What industry are you in? (2) What is your job title?';
    if (places) description += ' Max approved places: ' + places + '.';
    if (saleOption && saleOption !== 'custom') {
      description += ' Applications close: ' + saleEndLabel(saleOption) + '.';
    } else if (saleEnd) {
      description += ' Applications close: ' + formatCloseLabel(saleEnd) + '.';
    }
    return [
      {
        name: 'Application to attend',
        price: price === '' ? 0 : price,
        description,
        status: 'Available',
        quantityAvailable: places === '' ? null : Number(places),
        saleEnd,
        saleEndOption: saleOption,
        saleEndCustom: customDt,
        categoryExclusivity: true,
        ticketType: 'Application-based',
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
    bindGuestPassesFields();
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
        editLink.href = '/organiser/event-edit?id=' + encodeURIComponent(eventIds[0]);
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
      if (loaded.event.imageUrl && !seriesMeta.imageUrl) {
        seriesMeta.imageUrl = loaded.event.imageUrl;
      }
      if (loaded.event.imagePosition && !seriesMeta.imagePosition) {
        seriesMeta.imagePosition = loaded.event.imagePosition;
      }
      if (loaded.event.attendanceMode === 'guest_programme') {
        setAttendanceMode('guest_programme');
      }
      prefillGuestPassesDisabled(loaded.event);
      prefillRefundFromEvent(loaded.event);
      applyTicketsLockUi(loaded.event);
    }

    await loadOrganiserGuestVisitSetting(seriesMeta.organiserGroupId);
    setAttendanceMode(attendanceMode);

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
      const memberTickets = loaded.tickets.filter((t) => !isGuestVisitTicket(t) && !isAlumniTicket(t));
      if (loaded.event && loaded.event.attendanceMode === 'guest_programme') {
        setAttendanceMode('guest_programme');
        prefillTiers(memberTickets);
        prefillGuestPassesDisabled(loaded.event);
      } else {
        prefillTiers(memberTickets.length ? memberTickets : loaded.tickets);
      }
    } else {
      addTierRow();
    }

    document.getElementById('ee-add-tier').addEventListener('click', () => addTierRow({ useDefaultName: false }));
    document.getElementById('ee-guest-programme-enabled')?.addEventListener('change', () => {
      if (attendanceMode === 'category_exclusivity') return;
      setAttendanceMode(resolveOpenBookingMode());
      updatePublishButton();
    });
    const guestVisitsEl = document.getElementById('ee-guest-visits-allowed');
    if (guestVisitsEl) {
      guestVisitsEl.addEventListener('input', () => {
        guestVisitsEl.dataset.touched = '1';
        const n = Math.floor(Number(guestVisitsEl.value));
        if (Number.isFinite(n)) {
          if (n > 3) guestVisitsEl.value = '3';
          if (n < 1 && guestVisitsEl.value !== '') guestVisitsEl.value = '1';
        }
        if (attendanceMode === 'guest_programme') setAttendanceMode('guest_programme');
        updatePublishButton();
      });
    }
    bindRefundPolicy();
    if (!selectedRefundPolicy && !document.querySelector('input[name="refund-policy"]:checked')) {
      const defaultRadio = document.getElementById('refund-policy-standard');
      if (defaultRadio) selectRefundCard(defaultRadio);
    }
    bindVatOptions();
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
        showAlert('Accept the organiser terms to publish, or cancel and come back when you are ready.', 'warn');
        updatePublishButton();
        return;
      }
    }

    const loading = window.organiserPageLoading;
    const tiers = collectActiveTiers();
    if (!tiers.length) {
      const msg = publish
        ? 'Your event is not live until you publish a ticket type — please add at least one ticket tier above.'
        : 'Add at least one ticket type with a name.';
      showAlert(msg, publish ? 'warn' : '');
      if (publish) {
        const panelId =
          attendanceMode === 'category_exclusivity'
            ? 'ee-panel-category-exclusivity'
            : attendanceMode === 'guest_programme'
              ? 'ee-guest-programme-note'
              : 'ee-panel-tickets';
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
    if (publish && !tiersHaveRequiredSaleEnds(tiers)) {
      showAlert('Choose a valid sale end for every ticket tier before publishing.', 'warn');
      const missing = Array.from(document.querySelectorAll('.ee-tier-row')).find((row) => {
        const option = row.querySelector('.ee-tier-sale-end')?.value;
        if (option !== 'custom') return !computeSaleEndIso(option, null, seriesMeta.events?.[0]?.date);
        return !row.querySelector('.ee-tier-sale-custom-date')?.value;
      });
      (missing || document.getElementById('ee-panel-tickets'))?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
      updatePublishButton();
      return;
    }

    const refund = collectRefundPayload();
    if (publish) {
      const blockers = getPublishBlockers(tiers);
      if (blockers.length) {
        showAlert('Before this event can go live: ' + blockers.join('; ') + '.', 'warn');
        const warn = document.getElementById('ee-publish-warn');
        if (warn) {
          warn.hidden = false;
          warn.textContent = 'Before this event can go live: ' + blockers.join('; ') + '.';
          warn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        if (!collectVatTreatment()) {
          document.getElementById('ee-refund-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (!refund.refundPolicy || !refund.refundTermsAgreed) {
          document.getElementById('ee-refund-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (blockers.some((b) => /bank details/i.test(b))) {
          document.getElementById('ee-payment-setup-mount')?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }
        updatePublishButton();
        return;
      }
      if (attendanceMode === 'guest_programme') {
        const visits = readGuestVisitsAllowed();
        if (visits < 1) {
          showAlert('Enter how many complimentary visits a guest can take (1–3).', 'warn');
          document.getElementById('ee-guest-visits-allowed')?.focus();
          updatePublishButton();
          return;
        }
        if (!tiersHavePaidPrice(tiers)) {
          showAlert('Add at least one paid member ticket type for the guest visit programme.', 'warn');
          document.getElementById('ee-panel-tickets')?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
          updatePublishButton();
          return;
        }
      }
    }

    // Confirm overwrite only after publish requirements are met, so "OK" means it will go live.
    if (existingTicketsLoaded) {
      const scopeText =
        eventIds.length === 1
          ? 'this event only'
          : 'the ' + eventIds.length + ' dates in this listing only';
      const proceed = window.confirm(
        'This will update the ticket types for ' +
          scopeText +
          ' with what you have here. Your other events are not affected. Continue?'
      );
      if (!proceed) {
        showAlert(
          publish
            ? 'Publish cancelled — your event is still a draft.'
            : 'Save cancelled — your ticket types were not changed.',
          'warn'
        );
        return;
      }
    }

    const btn = document.getElementById('ee-tickets-submit');
    const saveBtn = document.getElementById('ee-tickets-save');
    if (btn) btn.disabled = true;
    if (saveBtn) saveBtn.disabled = true;

    if (attendanceMode === 'guest_programme') {
      const visits = readGuestVisitsAllowed();
      if (visits < 1) {
        showAlert('Enter how many complimentary visits a guest can take (1–3).', 'warn');
        if (btn) btn.disabled = false;
        if (saveBtn) saveBtn.disabled = false;
        updatePublishButton();
        return;
      }
      const groupId = seriesMeta.organiserGroupId;
      if (!groupId) {
        showAlert('Choose an organiser page before enabling the guest visit programme.', 'warn');
        if (btn) btn.disabled = false;
        if (saveBtn) saveBtn.disabled = false;
        updatePublishButton();
        return;
      }
      if (visits !== organiserComplimentaryVisits) {
        const saved = await saveOrganiserGuestVisitsAllowed(groupId, visits);
        if (!saved.ok) {
          showAlert(saved.message || 'Could not save complimentary visit allowance.', 'warn');
          if (btn) btn.disabled = false;
          if (saveBtn) saveBtn.disabled = false;
          updatePublishButton();
          return;
        }
      }
    }

    const body = {
      eventIds,
      tickets: tiers,
      publish,
      attendanceMode,
      guestPassesDisabled: collectGuestPassesDisabled(),
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

    const busyMessage = publish
      ? 'Creating and publishing your event'
      : 'Saving your tickets';

    let result;
    try {
      if (loading && loading.run) {
        result = await loading.run(busyMessage, saveWork);
      } else {
        if (loading) loading.show(busyMessage);
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
        refreshPaymentSetupCard(collectActiveTiers());
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
          'Tickets were saved, but this event is still a draft and not live yet. Check VAT, refund policy, bank details (for paid tickets), and dates — then click Publish event again.',
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
      window.parent.postMessage(
        {
          type: 'hub-event-tickets-done',
          eventIds: eventIds.slice(),
          eventId: eventIds[0] || '',
          title: seriesMeta.title || '',
          imageUrl:
            seriesMeta.imageUrl ||
            (seriesMeta.events && seriesMeta.events[0] && seriesMeta.events[0].imageUrl) ||
            '',
        },
        window.location.origin
      );
      return;
    }

    try {
      sessionStorage.setItem('hub_promote_event_id', eventIds[0] || '');
    } catch {
      /* ignore private mode */
    }
    location.href = '/organiser/#social';
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
