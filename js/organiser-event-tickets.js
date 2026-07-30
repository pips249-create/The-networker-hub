/**
 * Ticket setup for an event series — tiers, Category Exclusivity, sale windows.
 */
(function () {
  const SERIES_STORAGE_KEY = 'hub_event_series';
  const PUBLISHED_PREVIEW_KEY = 'hub_event_published_preview';
  const ORG_BOOTSTRAP_CACHE_KEY = 'hub_org_bootstrap_cache';
  const TICKET_DRAFT_KEY = 'hub_ticket_setup_draft';
  const REVIEW_REFUND_KEY = 'hub_event_review_refund';
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
  let savedTicketsSnapshot = '';
  let paymentSetupState = null;
  let returnedFromStripe = false;
  let ticketsLocked = false;
  let organiserComplimentaryVisits = 0;
  let organiserComplimentaryVisitsScope = 'per_group';
  let anchorEvent = null;
  /** @type {number|null} active member count once loaded; null while unknown */
  let memberRosterActiveCount = null;
  /** idle | loading | ready | error */
  let memberRosterLoadState = 'idle';
  let organiserGroupName = '';

  const FORMAT_LABELS = {
    'in-person': 'In person',
    online: 'Online',
  };

  const REFUND_LABELS = {
    flexible: 'Flexible',
    standard: 'Standard',
    strict: 'Strict (B2B)',
    non_refundable: 'Non-refundable',
  };

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

  function needsBankDetailsSetup(tiers) {
    const list = tiers || collectActiveTiers();
    return (
      tiersHavePaidPrice(list) &&
      paymentSetupState &&
      window.HubOrganiserPaymentSetup &&
      window.HubOrganiserPaymentSetup.groupNeedsSetup(paymentSetupState, paymentGroupForSeries())
    );
  }

  function refundTermsAlreadyAgreed() {
    return Boolean(anchorEvent?.refundTermsAgreed || anchorEvent?.refundTermsAgreedAt);
  }

  function lockRefundTermsCheckbox() {
    const agree = document.getElementById('refund-terms-agreed');
    if (!agree) return;
    agree.checked = true;
    agree.disabled = true;
    const label = agree.closest('.ee-refund-check');
    if (label) label.classList.add('is-locked');
    let note = document.getElementById('ee-refund-terms-locked-note');
    if (!note && label) {
      note = document.createElement('p');
      note.id = 'ee-refund-terms-locked-note';
      note.className = 'ee-hint ee-refund-terms-locked-note';
      note.textContent =
        'You confirmed this when paid tickets were first set up — it cannot be changed.';
      label.insertAdjacentElement('afterend', note);
    } else if (note) {
      note.hidden = false;
    }
  }

  function getPublishBlockers(tiers, options) {
    const opts = options || {};
    const includeBankDetails = opts.includeBankDetails !== false;
    const list = tiers || collectActiveTiers();
    const hasPaid = tiersHavePaidPrice(list);
    const refund = hasPaid ? collectRefundPayload() : null;
    const blockers = [];
    if (!list.length) {
      blockers.push('Add at least one ticket type with a name');
    } else if (!tiersHaveRequiredSaleEnds(list)) {
      blockers.push('Choose a valid sale end for every ticket tier');
    }
    if (hasPaid && !collectVatTreatment()) {
      blockers.push('Choose how VAT applies to ticket prices');
    }
    if (hasPaid && !refund.refundPolicy) {
      blockers.push('Select a refund policy');
    }
    if (hasPaid && !refund.refundTermsAgreed && !refundTermsAlreadyAgreed()) {
      blockers.push('Tick the refund responsibility checkbox');
    }
    if (includeBankDetails && needsBankDetailsSetup(list)) {
      blockers.push('Add bank details for paid tickets');
    }
    if (privateTicketEnabled() && !collectMembersOnlyTicket()) {
      blockers.push('Add a name for your members-only ticket');
    }
    if (membersOnlyEventEnabled()) {
      if (memberRosterLoadState === 'loading' || memberRosterLoadState === 'idle') {
        blockers.push('Checking your member list…');
      } else if (memberRosterLoadState === 'error' || memberRosterActiveCount == null) {
        blockers.push('Could not verify your member list — refresh and try again');
      } else if (memberRosterActiveCount === 0) {
        blockers.push('Add at least one person to your member list before publishing');
      }
    }
    const alumni = collectAlumniFastPass();
    if (alumni.enabled && !alumni.saleEnd) {
      blockers.push('Choose a sale end for the previous attendee ticket');
    }
    return blockers;
  }

  function eventTicketsSoldCount(ev) {
    if (!ev) return 0;
    const label = String(ev.ticketsSoldLabel || '').trim();
    if (label) {
      const slash = label.match(/^(\d+)\s*\/\s*(\d+|—|-)/);
      if (slash) return Number(slash[1]) || 0;
      const soldWord = label.match(/^(\d+)\s+sold$/i);
      if (soldWord) return Number(soldWord[1]) || 0;
      if (/^\d+$/.test(label)) return Number(label) || 0;
    }
    const direct = Number(ev.ticketsSold);
    return Number.isFinite(direct) && direct > 0 ? direct : 0;
  }

  function eventHasTicketSales(ev) {
    if (!ev) return false;
    if (ev.locked) return true;
    return eventTicketsSoldCount(ev) > 0;
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
    const tz = window.HubEventTimezone;
    if (tz && typeof tz.londonDateKeyFromIso === 'function') {
      return tz.londonDateKeyFromIso(iso);
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function isoToTimeInput(iso) {
    if (!iso) return '';
    const tz = window.HubEventTimezone;
    if (tz && typeof tz.londonTimeFromIso === 'function') {
      return tz.londonTimeFromIso(iso);
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  async function api(path, opts) {
    opts = opts || {};
    const timeoutMs = Number(opts.timeoutMs) || 0;
    const controller = timeoutMs > 0 ? new AbortController() : null;
    let timer = null;
    if (controller) {
      timer = setTimeout(function () {
        controller.abort();
      }, timeoutMs);
    }
    try {
      const res = await fetch(path, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
        method: opts.method,
        body: opts.body,
        signal: controller ? controller.signal : opts.signal,
      });
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      if (err && err.name === 'AbortError') {
        return {
          ok: false,
          status: 0,
          data: { error: 'timeout', message: 'Request timed out. Try again.' },
        };
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function formatDateShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function formatTime12hFromIso(iso) {
    if (!iso) return '';
    const tz = window.HubEventTimezone;
    let hour = NaN;
    let minute = NaN;
    if (tz && typeof tz.londonTimeFromIso === 'function') {
      const parts = String(tz.londonTimeFromIso(iso) || '').split(':');
      hour = Number(parts[0]);
      minute = Number(parts[1]);
    } else {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      hour = d.getHours();
      minute = d.getMinutes();
    }
    if (Number.isNaN(hour) || Number.isNaN(minute)) return '';
    const period = hour >= 12 ? 'pm' : 'am';
    const hour12 = hour % 12 || 12;
    return hour12 + ':' + pad2(minute) + period;
  }

  function formatReviewTimeRange(startIso, endIso) {
    const start = formatTime12hFromIso(startIso);
    if (!start) return '';
    if (!endIso) return start;
    const end = formatTime12hFromIso(endIso);
    return end ? start + ' – ' + end : start;
  }

  function formatReviewDateLabel(ev) {
    if (!ev || !ev.date) return 'Date TBC';
    const datePart = formatDateShort(ev.date);
    const endDate = ev.endDate || anchorEvent?.endDate || '';
    const timePart = formatReviewTimeRange(ev.date, endDate);
    return timePart ? datePart + ' · ' + timePart : datePart;
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
    const tz = window.HubEventTimezone;
    if (tz && typeof tz.londonWallToUtcIso === 'function') {
      return tz.londonWallToUtcIso(
        ymd[0],
        ymd[1] || 1,
        ymd[2] || 1,
        parts[0] || 0,
        parts[1] || 0
      );
    }
    const local = new Date(ymd[0], (ymd[1] || 1) - 1, ymd[2] || 1, parts[0] || 0, parts[1] || 0, 0);
    if (Number.isNaN(local.getTime())) return null;
    return local.toISOString();
  }

  function populateQuarterTimeSelect(selectEl, selected) {
    if (!selectEl || !QuarterTime) return;
    QuarterTime.populateSelect(selectEl, selected || '09:00');
  }

  function loadSeriesMeta() {
    const urlIds = eventIds.slice();
    const hadUrlIds = urlIds.length > 0;
    try {
      const raw = sessionStorage.getItem(SERIES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (hadUrlIds) {
        const storedIds = (Array.isArray(parsed.eventIds) ? parsed.eventIds : [])
          .map((id) => String(id).trim())
          .filter(Boolean);
        const sameIds =
          storedIds.length === urlIds.length &&
          urlIds.every((id) => storedIds.includes(id));
        if (sameIds) {
          seriesMeta = { ...seriesMeta, ...parsed };
        }
      } else {
        seriesMeta = { ...seriesMeta, ...parsed };
        if (parsed.eventIds && parsed.eventIds.length) {
          eventIds = parsed.eventIds;
        }
      }
    } catch {
      /* ignore */
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

  function applyExpandedSeriesPeers(peers) {
    if (!peers || peers.length <= 1) return;
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
      endDate: ev.endDate || '',
      imageUrl: ev.imageUrl || seriesMeta.imageUrl || '',
      imagePosition: ev.imagePosition || seriesMeta.imagePosition || '',
    }));
    if (!seriesMeta.imagePosition && seriesMeta.events[0] && seriesMeta.events[0].imagePosition) {
      seriesMeta.imagePosition = seriesMeta.events[0].imagePosition;
    }
    seriesMeta.eventIds = eventIds.slice();
  }

  async function expandSeriesEventIds(anchorEvent) {
    if (eventIds.length > 1) return;
    const anchorId = eventIds[0];
    if (!anchorId) return;

    const anchor = anchorEvent || { id: anchorId };
    const seriesGroupId = String(anchor.seriesGroupId || '').trim();
    if (!seriesGroupId) return;

    const res = await api(
      '/api/organiser/events?seriesGroupId=' + encodeURIComponent(seriesGroupId)
    );
    if (res.ok && Array.isArray(res.data.events) && res.data.events.length > 1) {
      applyExpandedSeriesPeers(res.data.events);
    }
  }

  async function hydrateSeriesEvents() {
    if (!eventIds.length) return;
    const existing = seriesMeta.events && seriesMeta.events.length ? seriesMeta.events : [];
    const byId = new Map(existing.map((ev) => [ev.id, ev]));
    eventIds.forEach((id) => {
      if (!byId.has(id)) byId.set(id, { id });
    });

    const embedBootstrap = window.HubOrganiserEmbedBootstrap;
    const cachedEvents =
      embedBootstrap && embedBootstrap.readCache
        ? (embedBootstrap.readCache() || {}).events || []
        : [];
    if (cachedEvents.length) {
      cachedEvents.forEach((ev) => {
        if (!ev || !ev.id || !byId.has(ev.id)) return;
        const cur = byId.get(ev.id);
        byId.set(ev.id, {
          id: ev.id,
          title: cur.title || ev.title,
          date: cur.date || ev.date,
          endDate: cur.endDate || ev.endDate || '',
          imageUrl: cur.imageUrl || ev.imageUrl,
          imagePosition: cur.imagePosition || ev.imagePosition || '',
        });
      });
    } else {
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
              endDate: cur.endDate || ev.endDate || '',
              imageUrl: cur.imageUrl || ev.imageUrl,
              imagePosition: cur.imagePosition || ev.imagePosition || '',
            });
          });
        }
      } catch {
        /* ignore */
      }
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
          endDate: ev.endDate || '',
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

  function goBackToEventDetailsInDrawer() {
    if (!eventIds[0] || !window.parent || window.parent === window) return;
    window.parent.postMessage(
      { type: 'hub-event-goto-edit', eventId: eventIds[0], title: seriesMeta.title || '' },
      window.location.origin
    );
  }

  function bindEmbedBackToEdit() {
    if (!isEmbedDrawer || !eventIds[0]) return;
    const editLink = document.getElementById('ee-edit-event-link');
    const actionBack = document.getElementById('ee-tickets-back-edit');
    if (editLink) {
      editLink.hidden = false;
      editLink.textContent = '← Event details';
      editLink.href = '#';
      editLink.addEventListener('click', function (e) {
        e.preventDefault();
        goBackToEventDetailsInDrawer();
      });
    }
    if (actionBack) {
      actionBack.hidden = false;
      actionBack.textContent = '← Event details';
      actionBack.addEventListener('click', function (e) {
        e.preventDefault();
        goBackToEventDetailsInDrawer();
      });
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

  function syncAddonCard(cardId, enabled) {
    const card = document.getElementById(cardId);
    if (card) card.classList.toggle('is-enabled', Boolean(enabled));
  }

  function setStepLabelText(labelEl, stepNum, optional) {
    if (!labelEl) return;
    labelEl.innerHTML = optional
      ? 'Step ' + stepNum + ' <span class="ee-optional">(optional)</span>'
      : 'Step ' + stepNum;
  }

  function syncTicketStepLabels() {
    const sections = [];
    const attendance = document.getElementById('ee-attendance-card-wrap');
    if (attendance) sections.push({ el: attendance, optional: false });

    const categoryPanel = document.getElementById('ee-panel-category-exclusivity');
    if (categoryPanel && !categoryPanel.hidden) sections.push({ el: categoryPanel, optional: false });

    const ticketsPanel = document.getElementById('ee-panel-tickets');
    if (ticketsPanel && !ticketsPanel.hidden) sections.push({ el: ticketsPanel, optional: false });

    const optionalExtras = document.getElementById('ee-panel-optional-extras');
    if (optionalExtras && !optionalExtras.hidden) sections.push({ el: optionalExtras, optional: true });

    const paidWrap = document.getElementById('ee-paid-setup-wrap');
    const vatCard = document.getElementById('ee-vat-card');
    if (paidWrap && !paidWrap.hidden && vatCard && !vatCard.hidden) {
      sections.push({ el: vatCard, optional: false });
    }

    const attendeeExtras = document.getElementById('ee-attendee-extras-card');
    if (attendeeExtras) sections.push({ el: attendeeExtras, optional: true });

    sections.forEach(function (section, index) {
      setStepLabelText(section.el.querySelector('[data-ee-step-label]'), index + 1, section.optional);
    });
  }

  let step2Confirmed = false;
  let step2Home = null;

  function activeStep2Panel() {
    return attendanceMode === 'category_exclusivity'
      ? document.getElementById('ee-panel-category-exclusivity')
      : document.getElementById('ee-panel-tickets');
  }

  function ensureStep2Home() {
    if (step2Home) return step2Home;
    const form = document.getElementById('ee-tickets-form');
    if (!form) return null;
    step2Home = document.createElement('div');
    step2Home.id = 'ee-step2-home';
    step2Home.hidden = true;
    const attendance = document.getElementById('ee-attendance-card-wrap');
    if (attendance && attendance.nextSibling) {
      form.insertBefore(step2Home, attendance.nextSibling);
    } else {
      form.appendChild(step2Home);
    }
    return step2Home;
  }

  function parkStep2Panels() {
    const home = ensureStep2Home();
    if (!home) return;
    ['ee-panel-tickets', 'ee-panel-category-exclusivity'].forEach(function (id) {
      const panel = document.getElementById(id);
      if (panel && panel.parentElement !== home) home.appendChild(panel);
    });
  }

  function unparkStep2Panels() {
    const form = document.getElementById('ee-tickets-form');
    const home = document.getElementById('ee-step2-home');
    if (!form) return;
    const anchor =
      document.getElementById('ee-panel-optional-extras') ||
      document.getElementById('ee-paid-setup-wrap') ||
      document.getElementById('ee-attendee-extras-card');
    ['ee-panel-tickets', 'ee-panel-category-exclusivity'].forEach(function (id) {
      const panel = document.getElementById(id);
      if (!panel) return;
      if (home && panel.parentElement === home) {
        if (anchor && anchor.parentElement === form) {
          form.insertBefore(panel, anchor);
        } else {
          form.appendChild(panel);
        }
      } else if (!panel.parentElement) {
        if (anchor && anchor.parentElement === form) {
          form.insertBefore(panel, anchor);
        } else {
          form.appendChild(panel);
        }
      }
    });
  }

  function hideLaterTicketSteps() {
    const optionalExtras = document.getElementById('ee-panel-optional-extras');
    const paidWrap = document.getElementById('ee-paid-setup-wrap');
    const attendeeExtras = document.getElementById('ee-attendee-extras-card');
    const actions = document.getElementById('ee-tickets-actions');
    if (optionalExtras) optionalExtras.hidden = true;
    if (paidWrap) paidWrap.hidden = true;
    if (attendeeExtras) attendeeExtras.hidden = true;
    if (actions) actions.hidden = true;
    document.querySelectorAll('.ee-tickets-after-step2').forEach(function (el) {
      el.hidden = true;
    });
  }

  function openStep2Modal() {
    parkStep2Panels();
    hideLaterTicketSteps();
    const modal = document.getElementById('ee-step2-modal');
    const body = document.getElementById('ee-step2-modal-body');
    const panel = activeStep2Panel();
    if (!modal || !body || !panel) return;
    panel.hidden = false;
    body.appendChild(panel);
    modal.hidden = false;
    document.body.classList.add('ee-step2-modal-open');
    const title = document.getElementById('ee-step2-modal-title');
    if (title) {
      title.textContent =
        attendanceMode === 'category_exclusivity'
          ? 'Step 2 — Category Exclusivity'
          : 'Step 2 — ticket types';
    }
  }

  function closeStep2Modal(opts) {
    const confirm = !opts || opts.confirm !== false;
    const modal = document.getElementById('ee-step2-modal');
    const home = ensureStep2Home();
    const body = document.getElementById('ee-step2-modal-body');
    if (body && home) {
      Array.from(body.children).forEach(function (child) {
        home.appendChild(child);
      });
    }
    if (modal) modal.hidden = true;
    document.body.classList.remove('ee-step2-modal-open');
    if (confirm) {
      step2Confirmed = true;
      revealPostStep2();
    } else {
      hideLaterTicketSteps();
      parkStep2Panels();
      const ticketsPanel = document.getElementById('ee-panel-tickets');
      const categoryPanel = document.getElementById('ee-panel-category-exclusivity');
      if (ticketsPanel) ticketsPanel.hidden = true;
      if (categoryPanel) categoryPanel.hidden = true;
      syncTicketStepLabels();
    }
  }

  function revealPostStep2() {
    unparkStep2Panels();
    const ticketsPanel = document.getElementById('ee-panel-tickets');
    const categoryPanel = document.getElementById('ee-panel-category-exclusivity');
    const optionalExtras = document.getElementById('ee-panel-optional-extras');
    const paidWrap = document.getElementById('ee-paid-setup-wrap');
    const attendeeExtras = document.getElementById('ee-attendee-extras-card');
    const actions = document.getElementById('ee-tickets-actions');
    const rest = document.getElementById('ee-tickets-rest');
    const openBooking = isOpenBookingMode(attendanceMode);
    const isCategory = attendanceMode === 'category_exclusivity';

    if (ticketsPanel) ticketsPanel.hidden = !openBooking;
    if (categoryPanel) categoryPanel.hidden = !isCategory;
    if (optionalExtras) optionalExtras.hidden = !openBooking || membersOnlyEventEnabled();
    if (paidWrap) paidWrap.hidden = false;
    if (attendeeExtras) attendeeExtras.hidden = false;
    if (actions) actions.hidden = false;
    if (rest) rest.hidden = false;
    document.querySelectorAll('.ee-tickets-after-step2').forEach(function (el) {
      el.hidden = false;
    });
    syncTicketStepLabels();
    updatePublishButton();
  }

  function setAttendanceMode(mode) {
    const requested =
      mode === 'guest_programme' || mode === 'tickets' || mode === 'category_exclusivity'
        ? mode
        : 'tickets';
    const isCategory = requested === 'category_exclusivity';
    const isGuest = requested === 'guest_programme';

    if (!isCategory) {
      setGuestProgrammeEnabled(isGuest);
      attendanceMode = resolveOpenBookingMode();
    } else {
      attendanceMode = 'category_exclusivity';
    }

    document.querySelectorAll('.ee-attendance-card, .ee-mode-btn').forEach((btn) => {
      const btnMode = btn.getAttribute('data-mode');
      const active =
        btnMode === 'category_exclusivity'
          ? isCategory
          : btnMode === 'tickets' && !isCategory;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const ticketsPanel = document.getElementById('ee-panel-tickets');
    const optionalExtras = document.getElementById('ee-panel-optional-extras');
    const categoryExclusivityPanel = document.getElementById('ee-panel-category-exclusivity');
    const guestFields = document.getElementById('ee-guest-programme-fields');
    const guestPassesOptOut = document.getElementById('ee-guest-passes-opt-out');
    const panelTitle = document.getElementById('ee-tickets-panel-title');
    const openBooking = isOpenBookingMode(attendanceMode);
    const guestOn = attendanceMode === 'guest_programme';
    const modalOpen = document.getElementById('ee-step2-modal') && !document.getElementById('ee-step2-modal').hidden;

    if (!step2Confirmed && !modalOpen) {
      if (ticketsPanel) ticketsPanel.hidden = true;
      if (categoryExclusivityPanel) categoryExclusivityPanel.hidden = true;
      if (optionalExtras) optionalExtras.hidden = true;
      hideLaterTicketSteps();
    } else if (modalOpen) {
      if (ticketsPanel) ticketsPanel.hidden = !openBooking;
      if (categoryExclusivityPanel) categoryExclusivityPanel.hidden = !isCategory;
      if (optionalExtras) optionalExtras.hidden = true;
      const paidWrap = document.getElementById('ee-paid-setup-wrap');
      const attendeeExtras = document.getElementById('ee-attendee-extras-card');
      const actions = document.getElementById('ee-tickets-actions');
      if (paidWrap) paidWrap.hidden = true;
      if (attendeeExtras) attendeeExtras.hidden = true;
      if (actions) actions.hidden = true;
    } else {
      if (ticketsPanel) ticketsPanel.hidden = !openBooking;
      if (optionalExtras) optionalExtras.hidden = !openBooking || membersOnlyEventEnabled();
      if (categoryExclusivityPanel) categoryExclusivityPanel.hidden = !isCategory;
    }

    if (guestFields) guestFields.hidden = !guestOn;
    if (guestPassesOptOut) guestPassesOptOut.hidden = !guestOn;
    syncAddonCard('ee-guest-addon', guestOn);
    if (panelTitle) {
      panelTitle.textContent = guestOn
        ? 'Member ticket types'
        : membersOnlyEventEnabled()
          ? 'Member ticket'
          : 'Public ticket types';
    }
    const panelLead = document.getElementById('ee-tickets-panel-lead');
    if (panelLead) {
      panelLead.hidden = membersOnlyEventEnabled();
    }
    syncMembersOnlyEventMode();
    syncGuestVisitsInput();
    updateTierSummary();
    syncTicketStepLabels();
  }

  function readGuestVisitsAllowed() {
    const el = document.getElementById('ee-guest-visits-allowed');
    if (!el) return organiserComplimentaryVisits || 0;
    const n = Math.floor(Number(el.value));
    if (!Number.isFinite(n)) return 0;
    return Math.min(3, Math.max(0, n));
  }

  function readGuestVisitsScope() {
    const checked = document.querySelector('input[name="ee-visits-scope"]:checked');
    return checked && checked.value === 'across_groups' ? 'across_groups' : 'per_group';
  }

  function setGuestVisitsScope(scope) {
    const value = scope === 'across_groups' ? 'across_groups' : 'per_group';
    document.querySelectorAll('input[name="ee-visits-scope"]').forEach((radio) => {
      radio.checked = radio.value === value;
    });
    organiserComplimentaryVisitsScope = value;
    syncGuestProgrammeNote();
  }

  function syncGuestProgrammeNote() {
    const note = document.getElementById('ee-guest-programme-note-text');
    if (!note) return;
    const scope = readGuestVisitsScope();
    if (scope === 'across_groups') {
      note.textContent =
        'Newcomers get up to 3 complimentary visits shared across all your organiser pages. After that, they must buy a paid member ticket to keep attending any of your groups.';
    } else {
      note.textContent =
        'Newcomers get up to 3 complimentary visits across this organiser page. After that, they must buy a paid member ticket to keep attending.';
    }
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
    setGuestVisitsScope(organiserComplimentaryVisitsScope);
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

  function ticketOrderLabel(index) {
    return 'Ticket ' + String(index + 1);
  }

  function tierRowHtml(index) {
    return (
      '<div class="ee-tier-row ee-tier-row-expanded" data-tier-index="' +
      index +
      '">' +
      '<div class="ee-tier-toolbar">' +
      '<div class="ee-tier-order">' +
      '<button type="button" class="ee-btn ee-btn-outline ee-tier-up" aria-label="Move up">↑</button>' +
      '<button type="button" class="ee-btn ee-btn-outline ee-tier-down" aria-label="Move down">↓</button>' +
      '<span class="ee-tier-order-label">' +
      ticketOrderLabel(index) +
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
      '<div class="ee-number-stepper">' +
      '<button type="button" class="ee-number-step ee-tier-price-down" aria-label="Decrease price">↓</button>' +
      '<input type="number" class="ee-tier-price" min="0" step="0.01" value="0" />' +
      '<button type="button" class="ee-number-step ee-tier-price-up" aria-label="Increase price">↑</button>' +
      '</div></div>' +
      '<div class="ee-field"><label>Quantity available <span class="ee-optional">(optional)</span></label>' +
      '<div class="ee-number-stepper">' +
      '<button type="button" class="ee-number-step ee-tier-qty-down" aria-label="Decrease quantity">↓</button>' +
      '<input type="number" class="ee-tier-qty" min="0" step="1" placeholder="Unlimited" />' +
      '<button type="button" class="ee-number-step ee-tier-qty-up" aria-label="Increase quantity">↑</button>' +
      '</div></div>' +
      '</div>' +
      '<div class="ee-field ee-tier-series-pass-field" hidden data-field-tip="event-series-pass-tier">' +
      '<label class="ee-check-label">' +
      '<input type="checkbox" class="ee-tier-series-pass" /> ' +
      '<span><strong>Full series pass</strong> — one price covers every date in this listing (not per session)</span>' +
      '</label></div>' +
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
    if (membersOnlyEventEnabled()) {
      summary.hidden = true;
      updateMembersOnlyEventSummary();
      return;
    }
    summary.hidden = false;
    const rows = document.querySelectorAll('.ee-tier-row');
    let count = 0;
    let totalQty = 0;
    let hasUnlimited = false;
    let minPrice = null;
    rows.forEach((row, i) => {
      const orderLabel = row.querySelector('.ee-tier-order-label');
      if (orderLabel) orderLabel.textContent = ticketOrderLabel(i);
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

  function seriesHasMultipleDates() {
    return Array.isArray(eventIds) && eventIds.length > 1;
  }

  function syncSeriesPassFieldVisibility(row) {
    if (!row) return;
    const field = row.querySelector('.ee-tier-series-pass-field');
    if (!field) return;
    field.hidden = !seriesHasMultipleDates();
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

    function stepNumberInput(input, delta, opts) {
      if (!input) return;
      const step = Number(opts && opts.step) || 1;
      const min = opts && opts.min != null ? Number(opts.min) : 0;
      const raw = String(input.value || '').trim();
      let current = raw === '' ? (opts && opts.emptyAs != null ? Number(opts.emptyAs) : 0) : Number(raw);
      if (!Number.isFinite(current)) current = 0;
      const next = Math.max(min, Math.round((current + delta * step) * 100) / 100);
      input.value = String(next);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    row.querySelector('.ee-tier-price-up')?.addEventListener('click', () => {
      stepNumberInput(row.querySelector('.ee-tier-price'), 1, { step: 1, min: 0 });
    });
    row.querySelector('.ee-tier-price-down')?.addEventListener('click', () => {
      stepNumberInput(row.querySelector('.ee-tier-price'), -1, { step: 1, min: 0 });
    });
    row.querySelector('.ee-tier-qty-up')?.addEventListener('click', () => {
      stepNumberInput(row.querySelector('.ee-tier-qty'), 1, { step: 1, min: 0, emptyAs: 0 });
    });
    row.querySelector('.ee-tier-qty-down')?.addEventListener('click', () => {
      stepNumberInput(row.querySelector('.ee-tier-qty'), -1, { step: 1, min: 0, emptyAs: 0 });
    });

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
    syncSeriesPassFieldVisibility(row);
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
    syncSeriesPassFieldVisibility(row);
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
    const passEl = row.querySelector('.ee-tier-series-pass');
    if (passEl) {
      passEl.checked = String(ticket.seriesScope || ticket.series_scope || '').trim() === 'series_pass';
    }
    syncSeriesPassFieldVisibility(row);
  }

  function isMembersOnlyTicket(ticket) {
    return String(ticket?.visibility || '').toLowerCase() === 'members_only';
  }

  function membersOnlyEventEnabled() {
    return Boolean(document.getElementById('ee-members-only-event-enabled')?.checked);
  }

  function setMembersOnlyEventEnabled(enabled) {
    const el = document.getElementById('ee-members-only-event-enabled');
    if (!el) return;
    el.checked = Boolean(enabled);
    syncMembersOnlyEventMode();
    if (enabled) {
      loadMemberRosterStatus();
    } else {
      setMemberRosterStatusMessage('');
    }
  }

  function ticketsAreMembersOnlyEvent(tickets) {
    const list = tickets || [];
    if (!list.length) return false;
    const hasMember = list.some(isMembersOnlyTicket);
    const hasPublic = list.some(function (t) {
      return !isMembersOnlyTicket(t) && !isGuestVisitTicket(t) && !isAlumniTicket(t);
    });
    return hasMember && !hasPublic;
  }

  function memberTicketConfigMount() {
    if (membersOnlyEventEnabled()) {
      return document.getElementById('ee-members-only-event-fields-mount');
    }
    if (Boolean(document.getElementById('ee-private-ticket-enabled')?.checked)) {
      return document.getElementById('ee-private-ticket-fields-mount');
    }
    return document.getElementById('ee-members-only-event-fields-mount');
  }

  function handleMembersOnlyEventToggle() {
    if (membersOnlyEventEnabled()) {
      const guestEl = document.getElementById('ee-guest-programme-enabled');
      if (guestEl && guestEl.checked) {
        guestEl.checked = false;
        setAttendanceMode('tickets');
      }
      const alumniEl = document.getElementById('ee-alumni-enabled');
      if (alumniEl && alumniEl.checked) {
        alumniEl.checked = false;
        alumniEl.dispatchEvent(new Event('change'));
      }
      const addonEl = document.getElementById('ee-private-ticket-enabled');
      if (addonEl) addonEl.checked = false;
      loadMemberRosterStatus();
    } else {
      setMemberRosterStatusMessage('');
    }
    syncMembersOnlyEventMode();
    updatePublishButton();
  }

  function bindMembersOnlyEventToggle() {
    const el = document.getElementById('ee-members-only-event-enabled');
    if (!el || el.dataset.boundMembersOnlyEvent) return;
    el.dataset.boundMembersOnlyEvent = '1';
    el.addEventListener('change', handleMembersOnlyEventToggle);
  }

  function syncMembersOnlyEventMode() {
    const on = membersOnlyEventEnabled();
    const addonOnly = !on && Boolean(document.getElementById('ee-private-ticket-enabled')?.checked);
    const toggleWrap = document.getElementById('ee-members-only-event-toggle');
    const publicWrap = document.getElementById('ee-public-tickets-wrap');
    const membersWrap = document.getElementById('ee-members-only-event-wrap');
    const privateAddon = document.getElementById('ee-private-ticket-addon');
    const optionalExtras = document.getElementById('ee-panel-optional-extras');
    const config = document.getElementById('ee-member-ticket-config');
    const targetMount = memberTicketConfigMount();
    const panelTitle = document.getElementById('ee-tickets-panel-title');
    const panelLead = document.getElementById('ee-tickets-panel-lead');
    const infoBox = membersWrap ? membersWrap.querySelector('.ee-members-only-event-how') : null;
    const moeSummary = document.getElementById('ee-members-only-event-summary');
    const addonMount = document.getElementById('ee-private-ticket-fields-mount');

    if (toggleWrap) toggleWrap.classList.toggle('is-enabled', on);
    if (toggleWrap) {
      toggleWrap.hidden =
        !isOpenBookingMode(attendanceMode) || attendanceMode === 'guest_programme';
    }
    if (publicWrap) publicWrap.hidden = on;
    if (membersWrap) membersWrap.hidden = !on;
    if (privateAddon) privateAddon.hidden = on;
    if (optionalExtras && isOpenBookingMode(attendanceMode)) optionalExtras.hidden = on;
    const guestAddon = document.getElementById('ee-guest-addon');
    if (guestAddon) guestAddon.hidden = on;
    const alumniAddon = document.getElementById('ee-alumni-addon');
    if (alumniAddon) alumniAddon.hidden = on;
    if (panelTitle) {
      panelTitle.textContent =
        on ? 'Member ticket' : attendanceMode === 'guest_programme' ? 'Member ticket types' : 'Public ticket types';
    }
    if (panelLead) panelLead.hidden = on;
    if (infoBox) infoBox.hidden = !on;
    if (moeSummary) moeSummary.hidden = !on;

    if (config && targetMount && config.parentElement !== targetMount) {
      targetMount.appendChild(config);
    }
    if (addonMount) addonMount.hidden = !addonOnly;
    const privateHow = document.getElementById('ee-private-ticket-how');
    if (privateHow) privateHow.hidden = !addonOnly;

    const rosterLink = document.getElementById('ee-members-only-roster-link');
    const groupId = String(seriesMeta.organiserGroupId || '').trim();
    if (rosterLink) {
      rosterLink.hidden = !on || !groupId;
      if (groupId) rosterLink.href = '/organiser/member-roster?id=' + encodeURIComponent(groupId);
    }

    if (on) {
      setMembersOnlyTicketHint(
        'Members on your list see this ticket when signed in with their membership email.',
        'ok'
      );
    }

    updateMembersOnlyEventSummary();
    updateTierSummary();
    syncTicketStepLabels();
  }

  function updateMembersOnlyEventSummary() {
    const summary = document.getElementById('ee-members-only-event-summary');
    if (!summary || !membersOnlyEventEnabled()) return;
    const tier = collectMembersOnlyTicket([]);
    if (!tier) {
      summary.textContent = 'Member ticket · add a name below';
      return;
    }
    const qtyRaw = tier.quantityAvailable;
    const qtyLabel =
      qtyRaw == null || qtyRaw === '' ? 'unlimited' : String(Math.max(0, Number(qtyRaw) || 0));
    const priceNum = Number(tier.price);
    const priceLabel = !Number.isFinite(priceNum) || priceNum <= 0 ? 'Free' : '£' + priceNum.toFixed(2);
    summary.textContent =
      (tier.name || 'Member ticket') + ' · ' + qtyLabel + ' available · ' + priceLabel;
  }

  function setMemberRosterStatusMessage(msg, tone) {
    const el = document.getElementById('ee-members-only-roster-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('ee-hint-warn', tone === 'warn');
    el.classList.toggle('ee-hint-ok', tone === 'ok');
  }

  async function loadMemberRosterStatus() {
    if (loadMemberRosterStatus._inflight) return loadMemberRosterStatus._inflight;
    loadMemberRosterStatus._inflight = (async function () {
      const groupId = String(seriesMeta.organiserGroupId || '').trim();
      memberRosterLoadState = 'loading';
      memberRosterActiveCount = null;
      if (!groupId) {
        memberRosterActiveCount = 0;
        memberRosterLoadState = 'ready';
        setMemberRosterStatusMessage(
          membersOnlyEventEnabled()
            ? 'Link this event to an organiser page before publishing a members-only event.'
            : '',
          'warn'
        );
        updatePublishButton();
        return;
      }
      if (membersOnlyEventEnabled()) {
        setMemberRosterStatusMessage('Checking your member list…', '');
      }
      updatePublishButton();
      let ok = false;
      let data = {};
      try {
        const result = await api(
          '/api/organiser/roster?organiserId=' +
            encodeURIComponent(groupId) +
            '&limit=1&offset=0'
        );
        ok = Boolean(result && result.ok);
        data = (result && result.data) || {};
      } catch {
        ok = false;
        data = {};
      }
      if (!ok) {
        memberRosterActiveCount = null;
        memberRosterLoadState = 'error';
        if (membersOnlyEventEnabled()) {
          setMemberRosterStatusMessage('Could not load your member list — refresh and try again.', 'warn');
        }
        updatePublishButton();
        return;
      }
      memberRosterActiveCount = Math.max(0, Number(data.totalActive) || 0);
      memberRosterLoadState = 'ready';
      if (membersOnlyEventEnabled()) {
        if (memberRosterActiveCount > 0) {
          setMemberRosterStatusMessage(
            memberRosterActiveCount === 1
              ? '1 active member on your list — ready to publish.'
              : memberRosterActiveCount + ' active members on your list — ready to publish.',
            'ok'
          );
        } else {
          setMemberRosterStatusMessage(
            'Add at least one person to your member list before you publish.',
            'warn'
          );
        }
      } else {
        setMemberRosterStatusMessage('');
      }
      updatePublishButton();
    })().finally(function () {
      loadMemberRosterStatus._inflight = null;
    });
    return loadMemberRosterStatus._inflight;
  }

  /** Wait for an in-flight roster check (or start one) before publish/continue. */
  async function ensureMemberRosterStatus() {
    if (!membersOnlyEventEnabled()) return;
    if (memberRosterLoadState === 'ready' || memberRosterLoadState === 'error') return;
    await loadMemberRosterStatus();
  }

  function privateTicketEnabled() {
    return membersOnlyEventEnabled() || Boolean(document.getElementById('ee-private-ticket-enabled')?.checked);
  }

  /** True when public tiers look intentionally set up (not just the auto-seeded default row). */
  function hasIntentionalPublicTickets() {
    const rows = Array.from(document.querySelectorAll('#ee-tier-rows .ee-tier-row'));
    if (rows.length > 1) return true;
    if (!rows.length) return false;
    const name = rows[0].querySelector('.ee-tier-name')?.value.trim() || '';
    if (!name) return false;
    if (name !== DEFAULT_TIER_NAME) return true;
    const priceRaw = rows[0].querySelector('.ee-tier-price')?.value;
    const price = Number(priceRaw);
    return Number.isFinite(price) && price > 0;
  }

  function preferMembersOnlyEventFromAddon() {
    const addonEl = document.getElementById('ee-private-ticket-enabled');
    if (addonEl) addonEl.checked = false;
    setMembersOnlyEventEnabled(true);
    showAlert(
      'Switched to “This event is for my members only” — no public ticket needed. Set the member ticket details above.',
      'ok'
    );
    updatePublishButton();
  }

  function handlePrivateTicketAddonToggle() {
    const addonEl = document.getElementById('ee-private-ticket-enabled');
    if (addonEl && addonEl.checked && !hasIntentionalPublicTickets()) {
      preferMembersOnlyEventFromAddon();
      return;
    }
    syncPrivateTicketFields();
  }

  function setMembersOnlyTicketHint(msg, tone) {
    const el = document.getElementById('ee-private-ticket-roster-hint');
    if (!el) return;
    el.textContent =
      msg || 'Manage who can see this ticket under Member list on your organiser page.';
    el.classList.toggle('ee-hint-ok', tone === 'ok');
  }

  function syncPrivateTicketFields() {
    const enabled = privateTicketEnabled();
    syncAddonCard('ee-private-ticket-addon', enabled && !membersOnlyEventEnabled());
    syncMembersOnlyEventMode();
    if (enabled && !membersOnlyEventEnabled()) {
      setMembersOnlyTicketHint(
        'Members on your list see this ticket when signed in with their membership email.',
        'ok'
      );
    } else if (!membersOnlyEventEnabled()) {
      setMembersOnlyTicketHint('');
    }
    updatePublishButton();
  }

  function collectMembersOnlyTicket(publicTiers) {
    if (!privateTicketEnabled()) return null;
    const name =
      document.getElementById('ee-private-ticket-name')?.value.trim() || 'Member ticket';
    if (!name) return null;
    const price = document.getElementById('ee-private-ticket-price')?.value;
    const qty = document.getElementById('ee-private-ticket-qty')?.value;

    const template = Array.isArray(publicTiers) && publicTiers.length ? publicTiers[0] : null;
    const eventDate = seriesMeta.events && seriesMeta.events[0] ? seriesMeta.events[0].date : null;
    const saleEnd =
      template?.saleEnd || computeSaleEndIso('at_start', null, eventDate);
    return {
      name,
      price: price === '' || price == null ? 0 : price,
      description: 'For members on your list when signed in',
      status: 'Available',
      quantityAvailable: qty === '' || qty == null ? null : Number(qty),
      saleStart: template?.saleStart || null,
      saleEnd,
      saleEndOption: template?.saleEndOption || 'at_start',
      saleEndCustom: template?.saleEndCustom || null,
      categoryExclusivity: false,
      ticketType: 'Standard',
      displayOrder: (publicTiers || []).length,
      visibility: 'members_only',
    };
  }

  function prefillMembersOnlyTicket(tickets) {
    const tier = (tickets || []).find(isMembersOnlyTicket);
    const enabledEl = document.getElementById('ee-private-ticket-enabled');
    if (!tier) {
      if (enabledEl && !membersOnlyEventEnabled()) enabledEl.checked = false;
      if (!membersOnlyEventEnabled()) setMembersOnlyTicketHint('');
      syncPrivateTicketFields();
      return;
    }
    if (enabledEl && !membersOnlyEventEnabled()) enabledEl.checked = true;
    const nameEl = document.getElementById('ee-private-ticket-name');
    if (nameEl) nameEl.value = tier.name || 'Member ticket';
    const priceEl = document.getElementById('ee-private-ticket-price');
    if (priceEl) {
      priceEl.value = tier.price === '' || tier.price == null ? '0' : String(tier.price);
    }
    const qtyEl = document.getElementById('ee-private-ticket-qty');
    if (qtyEl) {
      qtyEl.value =
        tier.quantityAvailable == null || tier.quantityAvailable === ''
          ? ''
          : String(tier.quantityAvailable);
    }
      setMembersOnlyTicketHint(
        'Members on your list see this ticket when signed in with their membership email.',
        'ok'
      );
    syncPrivateTicketFields();
  }

  function bindPrivateTicketFields() {
    const enabled = document.getElementById('ee-private-ticket-enabled');
    if (enabled) enabled.addEventListener('change', handlePrivateTicketAddonToggle);
    ['ee-private-ticket-name', 'ee-private-ticket-price', 'ee-private-ticket-qty'].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', function () {
          updateMembersOnlyEventSummary();
          updatePublishButton();
        });
        el.addEventListener('change', function () {
          updateMembersOnlyEventSummary();
          updatePublishButton();
        });
      }
    );
    syncPrivateTicketFields();
  }

  function prefillTiers(tickets) {
    const wrap = document.getElementById('ee-tier-rows');
    if (!wrap) return;
    wrap.innerHTML = '';
    const sorted = tickets
      .slice()
      .filter((t) => !isMembersOnlyTicket(t))
      .sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));
    sorted.forEach((ticket) => {
      const row = addTierRow({ useDefaultName: false });
      fillTierFromTicket(row, ticket);
    });
    existingTicketsLoaded =
      sorted.length > 0 || (tickets || []).some(isMembersOnlyTicket);
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
    if (ev.refundTermsAgreed || ev.refundTermsAgreedAt) {
      lockRefundTermsCheckbox();
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
    if (attendanceMode === 'category_exclusivity') return collectCategoryExclusivityTiers();
    return collectTiers();
  }

  async function loadOrganiserGuestVisitSetting(groupId) {
    if (!groupId) {
      organiserComplimentaryVisits = 0;
      organiserComplimentaryVisitsScope = 'per_group';
      return;
    }
    const { ok, data } = await api('/api/organiser/groups?id=' + encodeURIComponent(groupId));
    if (ok && data.group) {
      organiserComplimentaryVisits = Number(data.group.complimentaryVisitsAllowed) || 0;
      organiserComplimentaryVisitsScope =
        data.group.complimentaryVisitsScope === 'across_groups' ? 'across_groups' : 'per_group';
      organiserGroupName = String(data.group.name || '').trim();
    }
    const visitsEl = document.getElementById('ee-guest-visits-allowed');
    if (visitsEl && organiserComplimentaryVisits > 0) {
      visitsEl.value = String(Math.min(3, Math.max(1, organiserComplimentaryVisits)));
    }
    setGuestVisitsScope(organiserComplimentaryVisitsScope);
  }

  async function saveOrganiserGuestVisitsAllowed(groupId, allowed, scope) {
    const id = String(groupId || '').trim();
    const n = Math.min(3, Math.max(1, Math.floor(Number(allowed) || 0)));
    const visitsScope = scope === 'across_groups' ? 'across_groups' : 'per_group';
    if (!id || n < 1) return { ok: false, message: 'Enter how many complimentary visits (1–3).' };
    const { ok, data } = await api('/api/organiser/groups', {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        complimentaryVisitsAllowed: n,
        complimentaryVisitsScope: visitsScope,
      }),
    });
    if (ok) {
      organiserComplimentaryVisits = n;
      organiserComplimentaryVisitsScope = visitsScope;
    }
    return { ok, message: data?.message || data?.error || '' };
  }

  function collectTiers() {
    if (membersOnlyEventEnabled()) {
      const privateTier = collectMembersOnlyTicket([]);
      return privateTier ? [privateTier] : [];
    }
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
        visibility: 'public',
        seriesScope: row.querySelector('.ee-tier-series-pass')?.checked ? 'series_pass' : 'date',
      });
    });
    const privateTier = collectMembersOnlyTicket(tiers);
    if (privateTier) tiers.push(privateTier);
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
    const agreed =
      refundTermsAlreadyAgreed() || Boolean(document.getElementById('refund-terms-agreed')?.checked);
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
    const alumni = collectAlumniFastPass();
    if (alumni.enabled && Number(alumni.price) > 0) return true;
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

  function ticketsChangeSignature(tiers) {
    const normalized = (tiers || []).map(function (t) {
      return {
        name: String(t.name || '').trim(),
        price: String(t.price ?? ''),
        quantityAvailable:
          t.quantityAvailable == null || t.quantityAvailable === ''
            ? null
            : Number(t.quantityAvailable),
        saleEnd: t.saleEnd || '',
        saleStart: t.saleStart || '',
        ticketType: String(t.ticketType || '').trim(),
        visibility: String(t.visibility || 'public').trim(),
        categoryExclusivity: Boolean(t.categoryExclusivity),
      };
    });
    return JSON.stringify({ attendanceMode: attendanceMode, tiers: normalized });
  }

  function captureSavedTicketsSnapshot(tiers) {
    savedTicketsSnapshot = ticketsChangeSignature(tiers || collectActiveTiers());
  }

  function ticketsChangedFromSnapshot(tiers) {
    return ticketsChangeSignature(tiers) !== savedTicketsSnapshot;
  }

  function saveTicketDraft() {
    try {
      const payload = {
        savedAt: Date.now(),
        eventIds: eventIds.slice(),
        attendanceMode: attendanceMode,
        guestPassesDisabled: collectGuestPassesDisabled(),
        membersOnlyEvent: membersOnlyEventEnabled(),
        tiers: collectActiveTiers(),
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
    if (draft.attendanceMode === 'category_exclusivity') {
      setAttendanceMode('category_exclusivity');
      if (Array.isArray(draft.tiers) && draft.tiers[0]) prefillCategoryExclusivityFromTicket(draft.tiers[0]);
    } else if (draft.attendanceMode === 'guest_programme') {
      setAttendanceMode('guest_programme');
      if (Array.isArray(draft.tiers) && draft.tiers.length) prefillTiers(draft.tiers);
    } else if (Array.isArray(draft.tiers) && draft.tiers.length) {
      setAttendanceMode('tickets');
      if (draft.membersOnlyEvent) {
        setMembersOnlyEventEnabled(true);
        prefillMembersOnlyTicket(draft.tiers);
      } else {
        prefillTiers(draft.tiers);
        prefillMembersOnlyTicket(draft.tiers);
      }
    } else {
      return false;
    }
    if (!draft.membersOnlyEvent) syncMembersOnlyEventMode();
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
      if (refundTermsAlreadyAgreed()) {
        lockRefundTermsCheckbox();
      } else {
        const agree = document.getElementById('refund-terms-agreed');
        if (agree && draft.refund.refundTermsAgreed) agree.checked = true;
      }
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
      title: 'Bank details needed before ticket sales go live',
      lead:
        'You can finish your event setup first. When you are ready, add your UK bank account via Stripe — your event stays as a draft until this is complete.',
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

  function syncPaidOnlySections(tiers) {
    const hasPaid = tiersHavePaidPrice(tiers);
    const paidWrap = document.getElementById('ee-paid-setup-wrap');
    const vatCard = document.getElementById('ee-vat-card');
    const refundCard = document.getElementById('ee-refund-card');
    const freeNote = document.getElementById('ee-free-tickets-note');
    if (paidWrap) paidWrap.hidden = !hasPaid;
    if (vatCard) vatCard.hidden = !hasPaid;
    if (refundCard) refundCard.hidden = !hasPaid;
    if (freeNote) freeNote.hidden = hasPaid;
    document.querySelectorAll('input[name="vat-treatment"]').forEach(function (radio) {
      radio.required = hasPaid;
    });
    syncTicketStepLabels();
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
      if (membersOnlyEventEnabled() && memberRosterLoadState === 'idle') {
        loadMemberRosterStatus();
      }
      const tiers = collectActiveTiers();
      syncPaidOnlySections(tiers);
      const blockers = getPublishBlockers(tiers);
      const bankPending = needsBankDetailsSetup(tiers);
      // Keep Publish clickable so incomplete setup shows a clear message instead of a dead click.
      btn.disabled = false;
      refreshPaymentSetupCard(tiers);
      if (warn) {
        if (!blockers.length && !bankPending) {
          warn.hidden = true;
          warn.textContent = '';
        } else {
          warn.hidden = false;
          const parts = [];
          if (blockers.length) {
            parts.push('Before this event can go live: ' + blockers.join('; ') + '.');
          }
          if (bankPending && !blockers.some((b) => /bank details/i.test(b))) {
            parts.push(
              'Paid tickets will not go on sale until you add bank details — you can do that now or before you publish.'
            );
          }
          warn.textContent = parts.join(' ');
        }
      }
      // Clear a stale top-of-page alert once member-list / publish blockers are resolved.
      const alertEl = document.getElementById('ee-tickets-alert');
      if (
        alertEl &&
        !alertEl.hidden &&
        /member list/i.test(alertEl.textContent || '') &&
        !blockers.some((b) => /member list/i.test(b))
      ) {
        showAlert('');
      }
    } catch {
      btn.disabled = false;
      if (warn) {
        warn.hidden = false;
        warn.textContent =
          'Finish ticket types below, then click Continue to review again.';
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
    const closeSel = document.getElementById('ee-alumni-sale-end');
    const customWrap = document.getElementById('ee-alumni-sale-end-custom');
    const toggle = () => {
      const on = Boolean(enabled?.checked);
      if (fields) fields.hidden = !on;
      syncAddonCard('ee-alumni-addon', on);
      updatePublishButton();
    };
    if (enabled) {
      enabled.addEventListener('change', toggle);
      toggle();
    }
    if (closeSel && customWrap) {
      const syncClose = () => {
        customWrap.hidden = closeSel.value !== 'custom';
        updatePublishButton();
      };
      closeSel.addEventListener('change', syncClose);
      syncClose();
    }
    ['ee-alumni-price', 'ee-alumni-qty', 'ee-alumni-sale-end-date'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updatePublishButton);
      if (el) el.addEventListener('change', updatePublishButton);
    });
    populateQuarterTimeSelect(document.getElementById('ee-alumni-sale-end-time'), '18:00');
  }

  function collectAlumniFastPass() {
    const enabled = Boolean(document.getElementById('ee-alumni-enabled')?.checked);
    if (!enabled) return { enabled: false };
    const price = document.getElementById('ee-alumni-price')?.value;
    const qty = document.getElementById('ee-alumni-qty')?.value;
    const saleOption = document.getElementById('ee-alumni-sale-end')?.value || '1_week';
    const customDt = combineDateAndQuarterTime(
      document.getElementById('ee-alumni-sale-end-date')?.value,
      document.getElementById('ee-alumni-sale-end-time')?.value
    );
    const eventDate = seriesMeta.events && seriesMeta.events[0] ? seriesMeta.events[0].date : null;
    const saleEnd = computeSaleEndIso(saleOption, customDt, eventDate);
    return {
      enabled: true,
      price: price === '' ? 0 : price,
      quantityAvailable: qty === '' ? null : Number(qty),
      saleEnd,
      saleEndOption: saleOption,
      saleEndCustom: customDt,
    };
  }

  function prefillAlumniFastPass(eventRow, alumniTicket) {
    const enabledEl = document.getElementById('ee-alumni-enabled');
    const fields = document.getElementById('ee-alumni-fields');
    const enabled = Boolean(eventRow?.alumniFastPassEnabled);
    if (enabledEl) enabledEl.checked = enabled;
    if (!enabled || !alumniTicket) {
      if (fields) fields.hidden = true;
      return;
    }
    const priceEl = document.getElementById('ee-alumni-price');
    if (priceEl) {
      priceEl.value =
        alumniTicket.price === '' || alumniTicket.price == null ? '0' : String(alumniTicket.price);
    }
    const qtyEl = document.getElementById('ee-alumni-qty');
    if (qtyEl) {
      qtyEl.value =
        alumniTicket.quantityAvailable == null || alumniTicket.quantityAvailable === ''
          ? ''
          : String(alumniTicket.quantityAvailable);
    }
    const eventDate = seriesMeta.events && seriesMeta.events[0] ? seriesMeta.events[0].date : null;
    const closeSel = document.getElementById('ee-alumni-sale-end');
    const customWrap = document.getElementById('ee-alumni-sale-end-custom');
    if (alumniTicket.saleEnd) {
      const option = inferSaleEndOptionFromIso(alumniTicket.saleEnd, eventDate);
      if (closeSel) closeSel.value = option;
      if (customWrap) customWrap.hidden = option !== 'custom';
      if (option === 'custom') {
        const dateEl = document.getElementById('ee-alumni-sale-end-date');
        const timeEl = document.getElementById('ee-alumni-sale-end-time');
        if (dateEl) dateEl.value = isoToDateInput(alumniTicket.saleEnd);
        if (timeEl) populateQuarterTimeSelect(timeEl, isoToTimeInput(alumniTicket.saleEnd) || '18:00');
      }
    }
    if (fields) fields.hidden = false;
  }

  function isCategoryExclusivityTicket(ticket) {
    if (ticket.categoryExclusivity) return true;
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
        bindEmbedBackToEdit();
      } else {
        editLink.href = '/organiser/event-edit?id=' + encodeURIComponent(eventIds[0]);
        editLink.textContent = '← Event details';
        editLink.hidden = false;
      }
    }

    const loading = window.organiserPageLoading;
    const bootWork = async () => {
      const loaded = await loadExistingData();
      if (loaded.authFailed) return loaded;

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
      }

      await expandSeriesEventIds(loaded.event);
      await hydrateSeriesEvents();

      const secondary = [loadPaymentSetupState()];
      if (seriesMeta.organiserGroupId) {
        secondary.push(loadOrganiserGuestVisitSetting(seriesMeta.organiserGroupId));
      }
      if (loaded.tickets && ticketsAreMembersOnlyEvent(loaded.tickets)) {
        secondary.push(loadMemberRosterStatus());
      }
      await Promise.all(secondary);

      return loaded;
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
      anchorEvent = loaded.event;
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
      } else if (loaded.event.attendanceMode === 'category_exclusivity') {
        setAttendanceMode('category_exclusivity');
      }
      prefillGuestPassesDisabled(loaded.event);
      prefillRefundFromEvent(loaded.event);
      applyTicketsLockUi(loaded.event);
      const alumniTicket = loaded.tickets.find(isAlumniTicket);
      prefillAlumniFastPass(loaded.event, alumniTicket);
      prefillMembersOnlyTicket(loaded.tickets);
    }

    await handleStripeConnectReturn();

    setAttendanceMode(attendanceMode);
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
      const categoryExclusivityTicket = loaded.tickets.find(isCategoryExclusivityTicket);
      const memberTickets = loaded.tickets.filter(
        (t) => !isGuestVisitTicket(t) && !isAlumniTicket(t) && !isMembersOnlyTicket(t)
      );
      if (loaded.event && loaded.event.attendanceMode === 'guest_programme') {
        setAttendanceMode('guest_programme');
        prefillTiers(memberTickets);
        prefillMembersOnlyTicket(loaded.tickets);
        prefillGuestPassesDisabled(loaded.event);
      } else if (categoryExclusivityTicket) {
        prefillCategoryExclusivityFromTicket(categoryExclusivityTicket);
      } else {
        if (ticketsAreMembersOnlyEvent(loaded.tickets)) {
          prefillMembersOnlyTicket(loaded.tickets);
          setMembersOnlyEventEnabled(true);
        } else {
          if (memberTickets.length) {
            prefillTiers(memberTickets);
          } else {
            addTierRow();
          }
          prefillMembersOnlyTicket(loaded.tickets);
        }
      }
    } else {
      addTierRow();
      if (
        organiserComplimentaryVisits > 0 &&
        !restoredDraft &&
        (!loaded.event ||
          (loaded.event.attendanceMode !== 'category_exclusivity' &&
            loaded.event.attendanceMode !== 'guest_programme'))
      ) {
        setAttendanceMode('guest_programme');
      }
    }

    document.getElementById('ee-add-tier').addEventListener('click', () => addTierRow({ useDefaultName: false }));
    document.getElementById('ee-mode-tickets')?.addEventListener('click', () => {
      setAttendanceMode(resolveOpenBookingMode());
      updatePublishButton();
    });
    document.getElementById('ee-mode-category-exclusivity')?.addEventListener('click', () => {
      setAttendanceMode('category_exclusivity');
      updatePublishButton();
    });
    document.getElementById('ee-attendance-continue')?.addEventListener('click', () => {
      openStep2Modal();
    });
    document.getElementById('ee-step2-modal-done')?.addEventListener('click', () => {
      closeStep2Modal({ confirm: true });
    });
    document.querySelectorAll('[data-ee-step2-close]').forEach(function (el) {
      el.addEventListener('click', function () {
        closeStep2Modal({ confirm: false });
      });
    });
    parkStep2Panels();
    if (loaded.tickets && loaded.tickets.length) {
      step2Confirmed = true;
      revealPostStep2();
    } else {
      hideLaterTicketSteps();
    }
    bindPrivateTicketFields();
    bindMembersOnlyEventToggle();
    document.getElementById('ee-guest-programme-enabled')?.addEventListener('change', () => {
      if (document.getElementById('ee-guest-programme-enabled')?.checked) {
        setMembersOnlyEventEnabled(false);
      }
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
    document.querySelectorAll('input[name="ee-visits-scope"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        syncGuestProgrammeNote();
        updatePublishButton();
      });
    });
    syncGuestProgrammeNote();
    bindRefundPolicy();
    bindAlumniFastPassFields();
    bindCategoryExclusivityCloseFields();
    document.getElementById('ee-ce-price')?.addEventListener('input', updatePublishButton);
    document.getElementById('ee-ce-price')?.addEventListener('change', updatePublishButton);
    if (!selectedRefundPolicy && !document.querySelector('input[name="refund-policy"]:checked')) {
      const defaultRadio = document.getElementById('refund-policy-standard');
      if (defaultRadio) selectRefundCard(defaultRadio);
    }
    bindVatOptions();
    syncMembersOnlyEventMode();
    updatePublishButton();
    captureSavedTicketsSnapshot(collectActiveTiers());

    if (!loaded.tickets.length && window.HubFlowTour && !isEmbedDrawer) {
      window.HubFlowTour.startEventTicketsTour({ isEdit: false, delay: 0 });
    }

    notifyEmbedDrawerReady();
  }

  function reviewPageUrl() {
    const qs = new URLSearchParams();
    qs.set('ids', eventIds.join(','));
    if (isEmbedDrawer) qs.set('embed', '1');
    return '/organiser/event-review?' + qs.toString();
  }

  async function continueToReview() {
    if (!step2Confirmed) {
      openStep2Modal();
      showAlert('Finish ticket setup in the step 2 window, then click Done — continue.', 'warn');
      return;
    }
    if (ticketsLocked) {
      showAlert(
        'This event has ticket sales — ticket types and refund terms cannot be changed. Cancel the event from the event editor if you need to make changes.',
        'warn'
      );
      return;
    }

    const tiers = collectActiveTiers();
    if (!tiers.length) {
      showAlert(
        'Your event is not live until you publish a ticket type — please add at least one ticket tier above.',
        'warn'
      );
      const panelId =
        attendanceMode === 'category_exclusivity'
          ? 'ee-panel-category-exclusivity'
          : attendanceMode === 'guest_programme'
            ? 'ee-guest-programme-fields'
            : 'ee-panel-tickets';
      document.getElementById(panelId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const warn = document.getElementById('ee-publish-warn');
      if (warn) warn.hidden = false;
      updatePublishButton();
      return;
    }

    if (!eventIds.length) {
      showAlert('No events to attach tickets to.');
      return;
    }

    if (!tiersHaveRequiredSaleEnds(tiers)) {
      showAlert('Choose a valid sale end for every ticket tier before continuing.', 'warn');
      updatePublishButton();
      return;
    }

    await ensureMemberRosterStatus();
    const blockers = getPublishBlockers(tiers, { includeBankDetails: false });
    if (blockers.length) {
      showAlert('Before this event can go live: ' + blockers.join('; ') + '.', 'warn');
      const warn = document.getElementById('ee-publish-warn');
      if (warn) {
        warn.hidden = false;
        warn.textContent = 'Before this event can go live: ' + blockers.join('; ') + '.';
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
    }

    if (needsBankDetailsSetup(tiers)) {
      showAlert(
        'Bank details are not set up yet — your event will stay as a draft until you add them. You can do that on this page or from Revenue in your dashboard before you publish.',
        'warn'
      );
    }

    await saveTickets(false, { redirectToReview: true });
  }

  async function saveTickets(publish, options) {
    options = options || {};
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
              ? 'ee-guest-programme-fields'
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

    const hasPaidTickets = tiersHavePaidPrice(tiers);
    const refund = hasPaidTickets ? collectRefundPayload() : {};
    if (publish) {
      await ensureMemberRosterStatus();
      const blockers = getPublishBlockers(tiers);
      if (blockers.length) {
        showAlert('Before this event can go live: ' + blockers.join('; ') + '.', 'warn');
        const warn = document.getElementById('ee-publish-warn');
        if (warn) {
          warn.hidden = false;
          warn.textContent = 'Before this event can go live: ' + blockers.join('; ') + '.';
          warn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        if (blockers.some((b) => /VAT/i.test(b))) {
          document.getElementById('ee-vat-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (blockers.some((b) => /refund/i.test(b))) {
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
      }
    }

    if (!publish && existingTicketsLoaded && !ticketsChangedFromSnapshot(tiers)) {
      if (options.redirectToReview) {
        if (hasPaidTickets) {
          try {
            sessionStorage.setItem(
              REVIEW_REFUND_KEY,
              JSON.stringify({
                eventIds: eventIds.slice(),
                refundPolicy: refund.refundPolicy,
                refundPolicyDetails: refund.refundPolicyDetails || '',
                refundCutoffDays: refund.refundCutoffDays,
                refundTermsAgreed: Boolean(refund.refundTermsAgreed),
                vatTreatment: collectVatTreatment(),
              })
            );
          } catch {
            /* ignore quota / private mode */
          }
        }
        clearTicketDraft();
        location.href = reviewPageUrl();
        return;
      }
      showAlert(
        'Tickets saved as draft. Your event is not on Browse events yet — finish ticket setup below, then click Continue to review.',
        'ok'
      );
      return;
    }

    // Confirm overwrite only when ticket setup changed since last save/load.
    if (existingTicketsLoaded && ticketsChangedFromSnapshot(tiers)) {
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
      if (visits !== organiserComplimentaryVisits || readGuestVisitsScope() !== organiserComplimentaryVisitsScope) {
        const saved = await saveOrganiserGuestVisitsAllowed(groupId, visits, readGuestVisitsScope());
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
      alumniFastPass: collectAlumniFastPass(),
      vatTreatment: hasPaidTickets ? collectVatTreatment() : '',
      attendeeExtras: attendeeExtras(),
      ...refund,
    };

    const saveWork = async () => {
      const { ok, data } = await api('/api/organiser/tickets', {
        method: 'POST',
        body: JSON.stringify(body),
        timeoutMs: 120000,
      });

      return { ok, data };
    };

    const busyMessage = publish
      ? 'Creating and publishing your event'
      : 'Saving your tickets';

    let result;
    try {
      if (loading && loading.run) {
        result = await loading.run(
          busyMessage,
          saveWork,
          publish ? { progressStep: 'publish' } : null
        );
      } else {
        if (loading) loading.show(busyMessage);
        result = await saveWork();
        if (loading) loading.hide();
      }
    } catch (err) {
      console.error(err);
      if (loading) loading.hide();
      showAlert('Could not save tickets. Check your connection and try again.', 'warn');
      return;
    } finally {
      if (saveBtn) saveBtn.disabled = false;
      updatePublishButton();
    }

    if (!result) {
      showAlert('Could not save tickets. Check your connection and try again.', 'warn');
      return;
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

    captureSavedTicketsSnapshot(tiers);

    if (publish) {
      const published = Boolean(data.published);
      if (!published) {
        showAlert(
          'Tickets were saved, but this event is still a draft and not live yet. Check ticket types, bank details (for paid tickets), and dates — then continue to review again.',
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
      if (options.redirectToReview && hasPaidTickets) {
        try {
          sessionStorage.setItem(
            REVIEW_REFUND_KEY,
            JSON.stringify({
              eventIds: eventIds.slice(),
              refundPolicy: refund.refundPolicy,
              refundPolicyDetails: refund.refundPolicyDetails || '',
              refundCutoffDays: refund.refundCutoffDays,
              refundTermsAgreed: Boolean(refund.refundTermsAgreed),
              vatTreatment: body.vatTreatment,
            })
          );
        } catch {
          /* ignore quota / private mode */
        }
      }
      clearTicketDraft();
      if (options.redirectToReview) {
        location.href = reviewPageUrl();
        return;
      }
      showAlert(
        'Tickets saved as draft. Your event is not on Browse events yet — finish ticket setup below, then click Continue to review.',
        'ok'
      );
      if (tiersHavePaidPrice(collectActiveTiers())) {
        document.getElementById('ee-vat-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
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

    const publishedTitle = seriesMeta.title || '';
    const publishedImage =
      seriesMeta.imageUrl ||
      (seriesMeta.events && seriesMeta.events[0] && seriesMeta.events[0].imageUrl) ||
      '';
    try {
      sessionStorage.setItem(
        PUBLISHED_PREVIEW_KEY,
        JSON.stringify({
          ids: eventIds.join(','),
          title: publishedTitle,
          image: publishedImage,
        })
      );
    } catch {
      /* ignore — preview falls back to API fetch */
    }
    const publishedQs = new URLSearchParams();
    publishedQs.set('ids', eventIds.join(','));
    publishedQs.set('published', '1');
    if (publishedTitle) publishedQs.set('title', publishedTitle);
    const publishedUrl = '/organiser/event-published?' + publishedQs.toString();

    try {
      if (window.HubOrganiserLaunchSetup) {
        const famKey =
          (seriesMeta && seriesMeta.familyKey) ||
          (seriesMeta && seriesMeta.seriesGroupId
            ? 'sg:' + seriesMeta.seriesGroupId
            : eventIds[0]
              ? 'ev:' + eventIds[0]
              : '');
        if (famKey) window.HubOrganiserLaunchSetup.markEventFamilyDone(famKey);
        if (eventIds[0]) window.HubOrganiserLaunchSetup.markEventFamilyDone('ev:' + eventIds[0]);
      }
    } catch {
      /* ignore */
    }

    if (isEmbedDrawer && window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'hub-event-tickets-done',
          eventIds: eventIds.slice(),
          eventId: eventIds[0] || '',
          title: publishedTitle,
          imageUrl: publishedImage,
          publishedUrl: publishedUrl,
        },
        window.location.origin
      );
      return;
    }

    location.href = publishedUrl;
  }

  document.getElementById('ee-tickets-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await continueToReview();
  });

  const saveDraftBtn = document.getElementById('ee-tickets-save');
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', () => saveTickets(false));
  }

  bindMembersOnlyEventToggle();

  init().catch(function (err) {
    console.error(err);
    showAlert('Could not load ticket setup. Refresh the page or go back to My Events.', 'warn');
  });
})();
