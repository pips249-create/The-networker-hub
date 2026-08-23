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
  /** @type {'general'|'application'} */
  let attendanceDoor = 'general';
  let selectedRefundPolicy = '';
  let existingTicketsLoaded = false;
  let savedTicketsSnapshot = '';
  let paymentSetupState = null;
  let returnedFromStripe = false;
  let ticketsLocked = false;
  let lastPersistedTicketSignature = '';
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

  function confirmApplyTicketsToSeries() {
    const modal = document.getElementById('ee-tickets-confirm-modal');
    const body = document.getElementById('ee-tickets-confirm-body');
    const hint = document.getElementById('ee-tickets-confirm-hint');
    const okBtn = document.getElementById('ee-tickets-confirm-ok');
    const title = document.getElementById('ee-tickets-confirm-title');
    const n = eventIds.length;

    if (!modal || !okBtn) {
      const fallback =
        n <= 1
          ? 'Update ticket types for this event with what you have here?'
          : 'Apply these tickets to all ' + n + ' dates in this series?';
      return Promise.resolve(window.confirm(fallback));
    }

    if (title) {
      title.textContent =
        n <= 1 ? 'Update tickets for this event?' : 'Apply tickets to all dates in this series?';
    }
    if (body) {
      body.textContent =
        n <= 1
          ? 'This replaces the ticket types on this listing with what you have set up here.'
          : 'Apply these ticket types to all ' +
            n +
            ' dates in this series? Every date listed above gets the same tickets.';
    }
    if (hint) {
      hint.textContent =
        'Other listings on your organiser page are not changed — only this series.';
    }
    if (okBtn) {
      okBtn.textContent = n <= 1 ? 'Update tickets' : 'Apply to all ' + n + ' dates';
    }

    return new Promise(function (resolve) {
      let settled = false;
      function finish(ok) {
        if (settled) return;
        settled = true;
        modal.hidden = true;
        document.body.classList.remove('ee-modal-open');
        document.removeEventListener('keydown', onKey);
        resolve(Boolean(ok));
      }
      function onKey(e) {
        if (e.key === 'Escape') finish(false);
      }
      modal.querySelectorAll('[data-ee-confirm-cancel]').forEach(function (el) {
        el.onclick = function () {
          finish(false);
        };
      });
      okBtn.onclick = function () {
        finish(true);
      };
      document.addEventListener('keydown', onKey);
      modal.hidden = false;
      document.body.classList.add('ee-modal-open');
      try {
        okBtn.focus();
      } catch {
        /* ignore */
      }
    });
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
      if (!(payHowIncludesMembership() && privateTicketEnabled() && collectMembersOnlyTicket())) {
        blockers.push(
          payHowIncludesMembership()
            ? 'Add a public ticket, or set a member ticket price for people on your member list'
            : 'Add at least one ticket with a name'
        );
      }
    } else if (!tiersHaveRequiredSaleEnds(list)) {
      blockers.push('Choose a valid sale end for every ticket');
    }
    const unpaidNamed = Array.from(document.querySelectorAll('.ee-tier-row')).some(function (row) {
      const name = row.querySelector('.ee-tier-name')?.value.trim();
      if (!name) return false;
      const paid = row.querySelector('.ee-tier-price-mode-btn.is-active[data-price-mode="paid"]');
      if (!paid) return false;
      const price = Number(row.querySelector('.ee-tier-price')?.value);
      return !Number.isFinite(price) || price <= 0;
    });
    if (unpaidNamed) {
      blockers.push('Enter a price for each paid ticket');
    }
    if (!payHowIncludesTickets() && !payHowIncludesMembership()) {
      blockers.push('Choose tickets or monthly membership (or both)');
    }
    if (payHowIncludesMembership() && !hubMembershipHasPrice()) {
      blockers.push(
        'Membership must be blank/£0 (free via member list) or at least £1 for platform billing'
      );
    }
    if (
      payHowIncludesTickets() &&
      payHowIncludesMembership() &&
      !privateTicketEnabled() &&
      !membersOnlyEventEnabled() &&
      !isMembershipMeetingMode()
    ) {
      blockers.push(
        'Set a member ticket price (usually £0) so members on your list are not charged the public ticket again'
      );
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
      blockers.push('Add a name for your list-member booking');
    }
    if (attendanceMode === 'category_exclusivity' && ceMemberTicketEnabled() && !collectCeMemberTicket()) {
      blockers.push('Add a name for your list-member booking');
    }
    if (attendanceMode === 'category_exclusivity' && ceChargeTicketEnabled()) {
      const cePrice = Number(document.getElementById('ee-ce-price')?.value);
      if (!Number.isFinite(cePrice) || cePrice <= 0) {
        blockers.push('Enter a ticket price after approval, or choose membership only');
      }
    }
    if (membersOnlyEventEnabled()) {
      // Empty member list is a warning only — organisers can publish the listing and
      // add people later under Memberships. Keep checking so the status line stays accurate.
      if (memberRosterLoadState === 'idle') {
        loadMemberRosterStatus();
      }
    }
    if (guestProgrammeEnabled() && !payHowIncludesTickets() && !payHowIncludesMembership()) {
      blockers.push('After complimentary visits, people need tickets or membership — choose one above');
    }
    if (publicFreeTicketIsFirstVisitStandIn(list)) {
      blockers.push(
        'A first-visit ticket (for example First Meeting) should be complimentary visits — you can still keep a free ticket and a paid ticket'
      );
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

  function isExistingPublicListing(ev) {
    const row = ev || anchorEvent;
    if (!row) return false;
    const status = String(row.status || row.listingStatus || '').toLowerCase();
    if (status === 'published') return true;
    if (status === 'unpublished') return false;
    return Boolean(row.publishedAt || row.published_at);
  }

  function ticketPersistBlockers(tiers) {
    const list = tiers || collectActiveTiers();
    const blockers = [];
    if (!list.length) {
      blockers.push('Add at least one ticket type with a name');
    } else if (!tiersHaveRequiredSaleEnds(list)) {
      blockers.push('Choose a valid sale end for every ticket');
    }
    const unpaidNamed = Array.from(document.querySelectorAll('.ee-tier-row')).some(function (row) {
      const name = row.querySelector('.ee-tier-name')?.value.trim();
      if (!name) return false;
      const paid = row.querySelector('.ee-tier-price-mode-btn.is-active[data-price-mode="paid"]');
      if (!paid) return false;
      const price = Number(row.querySelector('.ee-tier-price')?.value);
      return !Number.isFinite(price) || price <= 0;
    });
    if (unpaidNamed) {
      blockers.push('Enter a price for each paid ticket');
    }
    return blockers;
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
    if (option === 'at_start') return base.toISOString();
    if (option === '12_hours') return new Date(base.getTime() - 12 * 60 * 60 * 1000).toISOString();
    if (option === '1_day') return new Date(base.getTime() - 24 * 60 * 60 * 1000).toISOString();
    if (option === '1_week') return new Date(base.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    if (option === 'custom' && customDatetime) {
      const tz = window.HubEventTimezone;
      if (tz && typeof tz.parseEventDateInputToUtcIso === 'function') {
        return tz.parseEventDateInputToUtcIso(customDatetime);
      }
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
      const storedIds = (Array.isArray(parsed.eventIds) ? parsed.eventIds : [])
        .map((id) => String(id).trim())
        .filter(Boolean);
      if (!hadUrlIds) {
        seriesMeta = { ...seriesMeta, ...parsed };
        if (storedIds.length) eventIds = storedIds;
        return;
      }
      const sameIds =
        storedIds.length === urlIds.length &&
        urlIds.every((id) => storedIds.includes(id));
      // Claim / drawer often opens with the primary id only while sessionStorage
      // already has every date in the series — prefer the full stored list.
      const urlIsSubsetOfStored =
        storedIds.length > urlIds.length &&
        urlIds.every((id) => storedIds.includes(id));
      if (sameIds || urlIsSubsetOfStored) {
        seriesMeta = { ...seriesMeta, ...parsed };
        if (urlIsSubsetOfStored) eventIds = storedIds.slice();
      }
    } catch {
      /* ignore */
    }
  }

  function persistSeriesMeta() {
    try {
      const next = {
        ...seriesMeta,
        eventIds: eventIds.slice(),
        events:
          seriesMeta.events && seriesMeta.events.length
            ? seriesMeta.events
            : eventIds.map((id) => ({ id })),
      };
      seriesMeta = next;
      sessionStorage.setItem(SERIES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function markNeedsMembersOnSeriesMeta() {
    seriesMeta.needsMembersAfterPublish = needsMembersAfterPublish();
    persistSeriesMeta();
  }

  function buildPublishedPreviewPayload() {
    return {
      ids: eventIds.join(','),
      title: seriesMeta.title || '',
      image:
        seriesMeta.imageUrl ||
        (seriesMeta.events && seriesMeta.events[0] && seriesMeta.events[0].imageUrl) ||
        '',
      needsMembers:
        Boolean(seriesMeta.needsMembersAfterPublish) || needsMembersAfterPublish(),
      organiserGroupId: String(seriesMeta.organiserGroupId || '').trim(),
    };
  }

  function persistPublishedPreview() {
    try {
      sessionStorage.setItem(PUBLISHED_PREVIEW_KEY, JSON.stringify(buildPublishedPreviewPayload()));
    } catch {
      /* ignore */
    }
  }

  function renderSeriesSummary() {
    const countEl = document.getElementById('ee-series-count');
    const pills = document.getElementById('ee-series-pills');
    const lead = document.getElementById('ee-tickets-lead');
    const seriesCard = document.getElementById('ee-series-card');
    const heading = document.getElementById('ee-series-heading');
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
    if (heading) {
      heading.textContent = n === 1 ? 'Date in this listing' : 'Dates in this series (' + n + ')';
    }
    if (countEl) {
      countEl.textContent = n + ' date' + (n === 1 ? '' : 's');
    }
    if (lead) {
      if (seriesMeta.title) {
        lead.textContent =
          'Define tickets for “' +
          seriesMeta.title +
          '”. Each ticket type applies to ' +
          (n === 1 ? 'this date' : 'all ' + n + ' dates in this series') +
          '.';
      } else if (n > 1) {
        lead.textContent =
          'Choose how people attend, add your ticket types once, and we apply them to all ' +
          n +
          ' dates in this series.';
      }
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
    persistSeriesMeta();
  }

  function seedSeriesMetaFromLoadedEvent(ev) {
    if (!ev || !ev.id) return;
    const existing = Array.isArray(seriesMeta.events) ? seriesMeta.events.slice() : [];
    const byId = new Map(existing.map((row) => [row.id, row]));
    const cur = byId.get(ev.id) || { id: ev.id };
    byId.set(ev.id, {
      id: ev.id,
      title: cur.title || ev.title || '',
      date: cur.date || ev.date || '',
      endDate: cur.endDate || ev.endDate || '',
      imageUrl: cur.imageUrl || ev.imageUrl || seriesMeta.imageUrl || '',
      imagePosition: cur.imagePosition || ev.imagePosition || seriesMeta.imagePosition || '',
      seriesGroupId: cur.seriesGroupId || ev.seriesGroupId || '',
    });
    if (!eventIds.includes(ev.id)) eventIds = [ev.id].concat(eventIds.filter((id) => id !== ev.id));
    seriesMeta.events = eventIds.map((id) => byId.get(id) || { id });
    seriesMeta.eventIds = eventIds.slice();
    if (ev.title && !seriesMeta.title) seriesMeta.title = ev.title;
    if (ev.organiserGroupId && !seriesMeta.organiserGroupId) {
      seriesMeta.organiserGroupId = ev.organiserGroupId;
    }
    if (ev.imageUrl && !seriesMeta.imageUrl) seriesMeta.imageUrl = ev.imageUrl;
    if (ev.imagePosition && !seriesMeta.imagePosition) seriesMeta.imagePosition = ev.imagePosition;
    persistSeriesMeta();
  }

  async function expandSeriesEventIds(anchorEvent) {
    if (eventIds.length > 1) {
      persistSeriesMeta();
      return;
    }
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
    } else {
      persistSeriesMeta();
    }
  }

  async function hydrateSeriesEvents(hintEvent) {
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
      // Prefer one series fetch over N per-date calls when peers share a series group.
      const seed = byId.get(missingDates[0]) || {};
      const seriesGroupId = String(
        (hintEvent && hintEvent.seriesGroupId) ||
          seed.seriesGroupId ||
          (seriesMeta.events && seriesMeta.events[0] && seriesMeta.events[0].seriesGroupId) ||
          ''
      ).trim();
      if (seriesGroupId && missingDates.length > 1) {
        const res = await api(
          '/api/organiser/events?seriesGroupId=' + encodeURIComponent(seriesGroupId)
        );
        if (res.ok && Array.isArray(res.data.events)) {
          res.data.events.forEach((ev) => {
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
      }
      const stillMissing = missingDates.filter((id) => {
        const ev = byId.get(id);
        return !ev || !ev.date;
      });
      if (stillMissing.length) {
        const results = await Promise.all(
          stillMissing.map((id) => api('/api/organiser/events?id=' + encodeURIComponent(id)))
        );
        stillMissing.forEach((id, i) => {
          const res = results[i];
          if (!res || !res.ok || !res.data || !res.data.event) return;
          const ev = res.data.event;
          const cur = byId.get(id) || { id };
          byId.set(id, {
            id,
            title: cur.title || ev.title,
            date: cur.date || ev.date,
            endDate: cur.endDate || ev.endDate || '',
            imageUrl: cur.imageUrl || ev.imageUrl,
            imagePosition: cur.imagePosition || ev.imagePosition || '',
          });
        });
      }
    }

    seriesMeta.events = eventIds.map((id) => byId.get(id) || { id });
    if (!seriesMeta.imageUrl && seriesMeta.events[0] && seriesMeta.events[0].imageUrl) {
      seriesMeta.imageUrl = seriesMeta.events[0].imageUrl;
    }
    if (!seriesMeta.imagePosition && seriesMeta.events[0] && seriesMeta.events[0].imagePosition) {
      seriesMeta.imagePosition = seriesMeta.events[0].imagePosition;
    }
  }

  function ticketsStepIsComplete() {
    return Boolean(lastPersistedTicketSignature);
  }

  function syncTicketsStepProgressUi() {
    if (window.HubEventWizard && typeof window.HubEventWizard.setStepComplete === 'function') {
      window.HubEventWizard.setStepComplete(ticketsStepIsComplete());
    }
    if (isEmbedDrawer && window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'hub-event-drawer-ready',
          progressStep: 'tickets',
          stepComplete: ticketsStepIsComplete(),
        },
        window.location.origin
      );
    }
  }

  function notifyEmbedDrawerReady() {
    syncTicketsStepProgressUi();
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
    return mode === 'tickets' || mode === 'guest_programme' || mode === 'membership_meeting';
  }

  function isMembershipMeetingMode(mode) {
    return (mode == null ? attendanceMode : mode) === 'membership_meeting';
  }

  function guestProgrammeEnabled() {
    const el = document.getElementById('ee-guest-programme-enabled');
    return Boolean(el && el.checked);
  }

  function setGuestProgrammeEnabled(on) {
    const el = document.getElementById('ee-guest-programme-enabled');
    if (el) el.checked = Boolean(on);
  }

  function isMembershipOnlyPayHow() {
    return payHowIncludesMembership() && !payHowIncludesTickets();
  }

  function resolveModeFromDoorAndPayHow() {
    if (attendanceDoor === 'application') return 'category_exclusivity';
    if (membersOnlyEventEnabled() && isMembershipOnlyPayHow()) return 'tickets';
    if (isMembershipOnlyPayHow()) {
      return guestProgrammeEnabled() ? 'membership_meeting' : 'tickets';
    }
    if (membersOnlyEventEnabled()) return 'tickets';
    return guestProgrammeEnabled() ? 'guest_programme' : 'tickets';
  }

  function resolveOpenBookingMode() {
    if (isMembershipMeetingMode()) return 'membership_meeting';
    return guestProgrammeEnabled() ? 'guest_programme' : 'tickets';
  }

  function usesGuestVisitProgramme() {
    return (
      attendanceMode === 'guest_programme' ||
      attendanceMode === 'membership_meeting' ||
      ceGuestVisitsEnabled()
    );
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

    const payHow = document.getElementById('ee-panel-pay-how');
    if (payHow && !payHow.hidden) sections.push({ el: payHow, optional: false });

    const categoryPanel = document.getElementById('ee-panel-category-exclusivity');
    if (categoryPanel && !categoryPanel.hidden) sections.push({ el: categoryPanel, optional: false });

    const ticketsPanel = document.getElementById('ee-panel-tickets');
    if (ticketsPanel && !ticketsPanel.hidden) sections.push({ el: ticketsPanel, optional: false });

    const optionalExtras = document.getElementById('ee-panel-optional-extras');
    if (optionalExtras && !optionalExtras.hidden) {
      const bothPayHow = payHowIncludesTickets() && payHowIncludesMembership();
      sections.push({ el: optionalExtras, optional: !bothPayHow });
    }

    const paidWrap = document.getElementById('ee-paid-setup-wrap');
    const vatCard = document.getElementById('ee-vat-card');
    if (paidWrap && !paidWrap.hidden && vatCard && !vatCard.hidden) {
      sections.push({ el: vatCard, optional: false });
    }

    const attendeeExtras = document.getElementById('ee-attendee-extras-card');
    if (attendeeExtras && !attendeeExtras.hidden) sections.push({ el: attendeeExtras, optional: true });

    sections.forEach(function (section, index) {
      setStepLabelText(section.el.querySelector('[data-ee-step-label]'), index + 1, section.optional);
    });
  }

  let step2Confirmed = false; // Step 1 (door) done
  let payHowConfirmed = false; // Step 2 (tickets or membership) done
  let payHowChoice = 'tickets';
  let step2Home = null;

  function attendanceModeLabel() {
    if (attendanceDoor === 'application' || attendanceMode === 'category_exclusivity') {
      return 'Application based';
    }
    if (attendanceMode === 'membership_meeting') return 'General ticketing — membership';
    if (attendanceMode === 'guest_programme') return 'General ticketing — with free trial visits';
    if (membersOnlyEventEnabled()) return 'General ticketing — closed member list';
    return 'General ticketing';
  }

  function readPayHow() {
    if (payHowChoice === 'membership' || payHowChoice === 'both' || payHowChoice === 'tickets') {
      return payHowChoice;
    }
    const active = document.querySelector('.ee-pay-how-options .ee-attendance-card.is-active');
    const v = active && active.getAttribute('data-pay-how');
    if (v === 'membership' || v === 'both' || v === 'tickets') return v;
    return 'tickets';
  }

  function setPayHow(value) {
    const v = value === 'membership' || value === 'both' ? value : 'tickets';
    payHowChoice = v;
    document.querySelectorAll('.ee-pay-how-options .ee-attendance-card').forEach(function (btn) {
      const active = (btn.getAttribute('data-pay-how') || '') === v;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }

  function payHowLabel() {
    const h = readPayHow();
    if (h === 'both') return 'Ticket and membership';
    if (h === 'membership') return 'Free visits, then membership';
    return 'Ticket for this event';
  }

  function payHowIncludesTickets() {
    const h = readPayHow();
    return h === 'tickets' || h === 'both';
  }

  function payHowIncludesMembership() {
    const h = readPayHow();
    return h === 'membership' || h === 'both';
  }

  function setAttendanceDoor(door, opts) {
    const options = opts || {};
    attendanceDoor = door === 'application' ? 'application' : 'general';
    document.querySelectorAll('#ee-attendance-card-wrap .ee-attendance-card').forEach(function (btn) {
      const active = (btn.getAttribute('data-door') || '') === attendanceDoor;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (!options.keepPayHow) {
      if (attendanceDoor === 'application') {
        setPayHow('membership');
        setGuestProgrammeEnabled(true);
        const visits = document.getElementById('ee-guest-visits-allowed');
        if (visits && !visits.dataset.touched) visits.value = '2';
        setMembersOnlyEventEnabled(false);
      } else {
        setPayHow('tickets');
        setGuestProgrammeEnabled(false);
        setMembersOnlyEventEnabled(false);
      }
    }
    setAttendanceMode(resolveModeFromDoorAndPayHow());
    syncPayHowUi();
  }

  function ensureAttendanceSummary() {
    const wrap = document.getElementById('ee-attendance-card-wrap');
    if (!wrap) return null;
    let summary = document.getElementById('ee-attendance-summary');
    if (summary) return summary;
    summary = document.createElement('div');
    summary.id = 'ee-attendance-summary';
    summary.className = 'ee-attendance-summary';
    summary.innerHTML =
      '<p class="ee-attendance-summary-copy" id="ee-attendance-summary-text"></p>' +
      '<button type="button" class="ee-btn ee-btn-outline" id="ee-attendance-change">Change</button>';
    wrap.appendChild(summary);
    document.getElementById('ee-attendance-change')?.addEventListener('click', function () {
      step2Confirmed = false;
      payHowConfirmed = false;
      showAlert('');
      syncAttendanceStepUi();
      hideLaterTicketSteps();
      parkStep2Panels();
      const ticketsPanel = document.getElementById('ee-panel-tickets');
      const categoryPanel = document.getElementById('ee-panel-category-exclusivity');
      const payHowPanel = document.getElementById('ee-panel-pay-how');
      if (ticketsPanel) ticketsPanel.hidden = true;
      if (categoryPanel) categoryPanel.hidden = true;
      if (payHowPanel) payHowPanel.hidden = true;
      syncPayHowStepUi();
      syncTicketStepLabels();
      wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return summary;
  }

  function syncAttendanceStepUi() {
    const wrap = document.getElementById('ee-attendance-card-wrap');
    if (!wrap) return;
    ensureAttendanceSummary();
    wrap.classList.toggle('is-collapsed', Boolean(step2Confirmed));
    const text = document.getElementById('ee-attendance-summary-text');
    if (text) {
      text.innerHTML =
        '<strong>' +
        esc(attendanceModeLabel()) +
        '</strong> — chosen for this event. Change only if you need a different way in.';
    }
  }

  function step2HasUsableTiers() {
    try {
      return collectActiveTiers().length > 0;
    } catch {
      return false;
    }
  }

  function activeStep2Panel() {
    return attendanceDoor === 'application' || attendanceMode === 'category_exclusivity'
      ? document.getElementById('ee-panel-category-exclusivity')
      : document.getElementById('ee-panel-tickets');
  }

  function step2PanelIds() {
    return ['ee-panel-pay-how', 'ee-panel-tickets', 'ee-panel-category-exclusivity'];
  }

  function ensureStep2Home() {
    return null;
  }

  function parkStep2Panels() {
    /* Panels stay inline — no modal parking. */
  }

  function unparkStep2Panels() {
    /* no-op */
  }

  function hideLaterTicketSteps() {
    const optionalExtras = document.getElementById('ee-panel-optional-extras');
    const paidWrap = document.getElementById('ee-paid-setup-wrap');
    const attendeeExtras = document.getElementById('ee-attendee-extras-card');
    const actions = document.getElementById('ee-tickets-actions');
    const ticketsPanel = document.getElementById('ee-panel-tickets');
    const categoryPanel = document.getElementById('ee-panel-category-exclusivity');
    const capacityCard = document.getElementById('ee-event-capacity-card');
    if (optionalExtras) optionalExtras.hidden = true;
    if (paidWrap) paidWrap.hidden = true;
    if (attendeeExtras) attendeeExtras.hidden = true;
    if (actions) actions.hidden = true;
    if (ticketsPanel) ticketsPanel.hidden = true;
    if (categoryPanel) categoryPanel.hidden = true;
    if (capacityCard) capacityCard.hidden = true;
    document.querySelectorAll('.ee-tickets-after-step2').forEach(function (el) {
      el.hidden = true;
    });
  }

  function syncEventCapacityCard() {
    const card = document.getElementById('ee-event-capacity-card');
    if (!card) return;
    const ticketsPanel = document.getElementById('ee-panel-tickets');
    const categoryPanel = document.getElementById('ee-panel-category-exclusivity');
    const show =
      Boolean(payHowConfirmed) &&
      ((ticketsPanel && !ticketsPanel.hidden) || (categoryPanel && !categoryPanel.hidden));
    card.hidden = !show;
  }

  function collectEventCapacity() {
    return normalizeTicketQuantity(document.getElementById('ee-event-capacity')?.value);
  }

  function prefillEventCapacity(ev) {
    const el = document.getElementById('ee-event-capacity');
    if (!el) return;
    const qtyNorm = normalizeTicketQuantity(ev && (ev.maxAttendees ?? ev.capacity));
    el.value = qtyNorm == null ? '' : String(qtyNorm);
  }

  function syncPayHowStepUi() {
    const panel = document.getElementById('ee-panel-pay-how');
    if (!panel) return;
    const collapsed = Boolean(step2Confirmed && payHowConfirmed);
    panel.classList.toggle('is-collapsed', collapsed);
    const summary = document.getElementById('ee-pay-how-summary');
    if (summary) summary.hidden = !collapsed;
    const text = document.getElementById('ee-pay-how-summary-text');
    if (text) {
      const base =
        '<strong>' +
        esc(payHowLabel()) +
        '</strong> — chosen for this event. Change only if you need a different option.';
      if (isMembershipOnlyPayHow() && guestProgrammeEnabled()) {
        const visits = readGuestVisitsAllowed();
        text.innerHTML =
          base +
          ' Free trial visits: <strong>' +
          esc(String(visits)) +
          '</strong> per visitor.';
      } else {
        text.innerHTML = base;
      }
    }
    syncPayHowContinueUi();
  }

  function bindPayHowChange() {
    const btn = document.getElementById('ee-pay-how-change');
    if (!btn || btn.dataset.boundPayHowChange) return;
    btn.dataset.boundPayHowChange = '1';
    btn.addEventListener('click', function () {
      payHowConfirmed = false;
      showAlert('');
      hideLaterTicketSteps();
      const payHowPanel = document.getElementById('ee-panel-pay-how');
      if (payHowPanel) payHowPanel.hidden = false;
      syncPayHowStepUi();
      syncPayHowUi();
      syncTicketStepLabels();
      try {
        payHowPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        /* ignore */
      }
    });
  }

  function syncPayHowContinueUi() {
    const next = document.getElementById('ee-pay-how-next');
    if (!next) return;
    next.hidden = !step2Confirmed || payHowConfirmed;
  }

  /** After Step 1 door choice — show pay-how only until they continue. */
  function revealPayHowStep() {
    hideLaterTicketSteps();
    const payHowPanel = document.getElementById('ee-panel-pay-how');
    if (payHowPanel) payHowPanel.hidden = false;
    syncPayHowUi();
    syncGuestProgrammeMount();
    syncHubMembershipMount();
    syncAttendanceStepUi();
    syncPayHowStepUi();
    syncTicketStepLabels();
    updatePublishButton();
  }

  /** After Step 1 door choice — show pay-how only (ticket types wait for Step 2 continue). */
  function confirmStep1AndRevealSteps() {
    showAlert('');
    step2Confirmed = true;
    payHowConfirmed = false;
    if (isMembershipOnlyPayHow()) {
      if (guestProgrammeEnabled()) setAttendanceMode('membership_meeting');
      else {
        setMembersOnlyEventEnabled(true);
        setAttendanceMode('tickets');
      }
    } else {
      setAttendanceMode(resolveModeFromDoorAndPayHow());
    }
    revealPayHowStep();
    scrollStepIntoView(document.getElementById('ee-panel-pay-how'));
  }

  function stickyChromeOffset() {
    let h = 16;
    const nav = document.getElementById('hub-site-nav');
    if (nav && nav.offsetParent !== null) h += nav.getBoundingClientRect().height;
    const wizard = document.querySelector('#ee-wizard-mount .ee-wizard');
    if (wizard && wizard.offsetParent !== null) h += wizard.getBoundingClientRect().height;
    return h;
  }

  function scrollStepIntoView(el) {
    if (!el) return;
    const run = function () {
      const offset = stickyChromeOffset();
      const rect = el.getBoundingClientRect();
      let scroller = el.parentElement;
      while (scroller && scroller !== document.body) {
        const style = window.getComputedStyle(scroller);
        const oy = style.overflowY;
        if ((oy === 'auto' || oy === 'scroll') && scroller.scrollHeight > scroller.clientHeight + 8) {
          break;
        }
        scroller = scroller.parentElement;
      }
      if (scroller && scroller !== document.body && scroller !== document.documentElement) {
        const sRect = scroller.getBoundingClientRect();
        scroller.scrollTo({
          top: scroller.scrollTop + rect.top - sRect.top - offset,
          behavior: 'smooth',
        });
        return;
      }
      const top = rect.top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    };
    requestAnimationFrame(function () {
      requestAnimationFrame(run);
    });
  }

  function confirmPayHowAndRevealRest() {
    showAlert('');
    payHowConfirmed = true;
    if (isMembershipOnlyPayHow()) {
      if (guestProgrammeEnabled()) setAttendanceMode('membership_meeting');
      else {
        setMembersOnlyEventEnabled(true);
        setAttendanceMode('tickets');
      }
    } else {
      setAttendanceMode(resolveModeFromDoorAndPayHow());
    }
    revealPostStep2();
    scrollStepIntoView(activeStep2Panel() || document.getElementById('ee-panel-tickets'));
  }

  function openStep2Modal() {
    confirmStep1AndRevealSteps();
  }

  function closeStep2Modal(opts) {
    const confirm = !opts || opts.confirm !== false || step2HasUsableTiers();
    document.body.classList.remove('ee-step2-modal-open');
    const modal = document.getElementById('ee-step2-modal');
    if (modal) modal.hidden = true;
    if (confirm) {
      step2Confirmed = true;
      payHowConfirmed = true;
      showAlert('');
      revealPostStep2();
    } else {
      step2Confirmed = false;
      payHowConfirmed = false;
      hideLaterTicketSteps();
      const ticketsPanel = document.getElementById('ee-panel-tickets');
      const categoryPanel = document.getElementById('ee-panel-category-exclusivity');
      const payHowPanel = document.getElementById('ee-panel-pay-how');
      if (ticketsPanel) ticketsPanel.hidden = true;
      if (categoryPanel) categoryPanel.hidden = true;
      if (payHowPanel) payHowPanel.hidden = true;
      syncPayHowStepUi();
      syncAttendanceStepUi();
      syncTicketStepLabels();
    }
  }

  function revealPostStep2() {
    unparkStep2Panels();
    const ticketsPanel = document.getElementById('ee-panel-tickets');
    const categoryPanel = document.getElementById('ee-panel-category-exclusivity');
    const payHowPanel = document.getElementById('ee-panel-pay-how');
    const optionalExtras = document.getElementById('ee-panel-optional-extras');
    const paidWrap = document.getElementById('ee-paid-setup-wrap');
    const attendeeExtras = document.getElementById('ee-attendee-extras-card');
    const actions = document.getElementById('ee-tickets-actions');
    const rest = document.getElementById('ee-tickets-rest');
    const openBooking = isOpenBookingMode(attendanceMode);
    const isCategory = attendanceMode === 'category_exclusivity';
    const membershipMeeting = isMembershipMeetingMode();

    if (payHowPanel) payHowPanel.hidden = false;
    if (ticketsPanel) ticketsPanel.hidden = !openBooking;
    if (categoryPanel) categoryPanel.hidden = !isCategory;
    if (optionalExtras) {
      optionalExtras.hidden =
        (!openBooking && !isCategory) ||
        (membersOnlyEventEnabled() && !membershipMeeting) ||
        !payHowIncludesMembership();
    }
    if (paidWrap) paidWrap.hidden = false;
    if (attendeeExtras) attendeeExtras.hidden = false;
    if (actions) actions.hidden = false;
    if (rest) rest.hidden = false;
    document.querySelectorAll('.ee-tickets-after-step2').forEach(function (el) {
      el.hidden = false;
    });
    syncEventCapacityCard();
    syncPayHowUi();
    syncMembersOnlyEventMode();
    syncAttendanceStepUi();
    syncPayHowStepUi();
    syncTicketStepLabels();
    updatePublishButton();
  }

  function setAttendanceMode(mode) {
    const requested =
      mode === 'guest_programme' ||
      mode === 'tickets' ||
      mode === 'category_exclusivity' ||
      mode === 'membership_meeting'
        ? mode
        : 'tickets';
    const isCategory = requested === 'category_exclusivity';
    const isMembershipMeeting = requested === 'membership_meeting';
    const isGuest = requested === 'guest_programme';

    if (isCategory) {
      attendanceDoor = 'application';
      attendanceMode = 'category_exclusivity';
    } else if (isMembershipMeeting) {
      attendanceDoor = 'general';
      attendanceMode = 'membership_meeting';
      setGuestProgrammeEnabled(true);
      // Closed meeting means "no trial visits" — keep it off while visits are on.
      const moe = document.getElementById('ee-members-only-event-enabled');
      if (moe) moe.checked = false;
      const priceEl = document.getElementById('ee-private-ticket-price');
      if (priceEl && (priceEl.value === '' || priceEl.value == null)) priceEl.value = '0';
      const optOut = document.getElementById('ee-guest-passes-disabled');
      if (optOut) optOut.checked = false;
      if (!payHowIncludesMembership()) setPayHow('membership');
    } else {
      attendanceDoor = 'general';
      setGuestProgrammeEnabled(isGuest);
      attendanceMode = isGuest ? 'guest_programme' : 'tickets';
      // Leaving membership-meeting must clear the closed/member-list shell when
      // public tickets are on — otherwise Ticket 1 stays hidden after switching.
      if (payHowIncludesTickets()) {
        const moe = document.getElementById('ee-members-only-event-enabled');
        if (moe) moe.checked = false;
      } else if (isGuest) {
        const moe = document.getElementById('ee-members-only-event-enabled');
        if (moe) moe.checked = false;
      }
    }

    document.querySelectorAll('#ee-attendance-card-wrap .ee-attendance-card, .ee-mode-btn').forEach((btn) => {
      const door = btn.getAttribute('data-door');
      const active = door
        ? door === attendanceDoor
        : btn.getAttribute('data-mode') === 'category_exclusivity'
          ? isCategory
          : !isCategory;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    // Keep Step 2 pay-how highlight correct (attendance cards must not overwrite these).
    setPayHow(payHowChoice);

    const ticketsPanel = document.getElementById('ee-panel-tickets');
    const optionalExtras = document.getElementById('ee-panel-optional-extras');
    const categoryExclusivityPanel = document.getElementById('ee-panel-category-exclusivity');
    const payHowPanel = document.getElementById('ee-panel-pay-how');
    const guestFields = document.getElementById('ee-guest-programme-fields');
    const guestPassesOptOut = document.getElementById('ee-guest-passes-opt-out');
    const panelTitle = document.getElementById('ee-tickets-panel-title');
    const openBooking = isOpenBookingMode(attendanceMode);
    const guestOn = guestProgrammeEnabled();
    if (!step2Confirmed) {
      if (ticketsPanel) ticketsPanel.hidden = true;
      if (categoryExclusivityPanel) categoryExclusivityPanel.hidden = true;
      if (payHowPanel) payHowPanel.hidden = true;
      if (optionalExtras) optionalExtras.hidden = true;
      hideLaterTicketSteps();
    } else if (!payHowConfirmed) {
      if (payHowPanel) payHowPanel.hidden = false;
      if (ticketsPanel) ticketsPanel.hidden = true;
      if (categoryExclusivityPanel) categoryExclusivityPanel.hidden = true;
      if (optionalExtras) optionalExtras.hidden = true;
      hideLaterTicketSteps();
      if (payHowPanel) payHowPanel.hidden = false;
    } else {
      if (payHowPanel) payHowPanel.hidden = false;
      if (ticketsPanel) ticketsPanel.hidden = !openBooking;
      if (optionalExtras) {
        optionalExtras.hidden =
          (!openBooking && !isCategory) ||
          (membersOnlyEventEnabled() && !isMembershipMeetingMode()) ||
          !payHowIncludesMembership();
      }
      if (categoryExclusivityPanel) categoryExclusivityPanel.hidden = !isCategory;
    }

    const privateAddon = document.getElementById('ee-private-ticket-addon');
    if (privateAddon) {
      privateAddon.hidden =
        isCategory ||
        membersOnlyEventEnabled() ||
        isMembershipMeetingMode() ||
        !payHowIncludesTickets() ||
        !payHowIncludesMembership();
    }

    const optionalLead = document.getElementById('ee-optional-extras-lead');
    const optionalTitle = document.getElementById('ee-optional-extras-title');
    const bothPayHow = payHowIncludesTickets() && payHowIncludesMembership();
    if (optionalTitle) {
      optionalTitle.textContent = bothPayHow ? 'Member ticket price' : 'Member ticket price (optional)';
    }
    if (optionalLead) {
      optionalLead.textContent = bothPayHow
        ? 'Required for this path. Set what members pay for this event (often £0). Visitors still use the public ticket.'
        : 'Optional. Let people on your member list book cheaper (or free) while everyone else uses the ticket above.';
    }

    syncHubMembershipMount();
    syncGuestProgrammeMount();
    syncPayHowUi();

    if (guestPassesOptOut) {
      guestPassesOptOut.hidden = !guestOn || isCategory || isMembershipMeetingMode();
      if (isCategory || isMembershipMeetingMode()) {
        const optOut = document.getElementById('ee-guest-passes-disabled');
        if (optOut) optOut.checked = false;
      }
    }

    if (guestFields && !isMembershipMeetingMode()) guestFields.hidden = !guestOn;
    syncAddonCard('ee-guest-addon', guestOn && !isMembershipMeetingMode());
    syncGuestProgrammeNote();
    if (panelTitle) {
      panelTitle.textContent = isMembershipMeetingMode()
        ? 'Member ticket & join fee'
        : attendanceMode === 'guest_programme'
          ? 'Your ticket'
          : membersOnlyEventEnabled()
            ? 'Member booking'
            : 'Your ticket';
    }
    const panelLead = document.getElementById('ee-tickets-panel-lead');
    if (panelLead) {
      if (isMembershipMeetingMode()) {
        panelLead.hidden = false;
        panelLead.textContent =
          'Free visits stay as you set them in Step 2. Here, set the member ticket for this meeting and the fee to join your group.';
      } else {
        panelLead.hidden = membersOnlyEventEnabled() || isMembershipMeetingMode();
      }
    }
    syncMembersOnlyEventMode();
    syncHubMembershipMount();
    syncGuestVisitsInput();
    updateTierSummary();
    syncPayHowStepUi();
    syncTicketStepLabels();
    updatePublishButton();
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
    const advanced = document.getElementById('ee-guest-visits-advanced');
    if (advanced && value === 'across_groups') advanced.open = true;
    syncGuestProgrammeNote();
  }

  function syncGuestProgrammeNote() {
    const note = document.getElementById('ee-guest-programme-note-text');
    const summary = document.getElementById('ee-guest-programme-summary');
    if (!note) return;
    const isCategory = attendanceMode === 'category_exclusivity';
    const isMembershipMeeting = isMembershipMeetingMode();
    const scope = readGuestVisitsScope();
    if (summary) {
      summary.textContent = isCategory
        ? hubMembershipEnabled()
          ? 'Free trial visits, then join monthly membership (no ticket required)'
          : 'Let visitors take a free visit — they still apply for a Category Exclusivity seat'
        : isMembershipMeeting || isMembershipOnlyPayHow()
          ? 'Let visitors try your group free — then join your membership at your price'
          : 'Let visitors try a complimentary visit before they buy a ticket';
    }
    if (isCategory) {
      if (hubMembershipEnabled()) {
        note.textContent =
          scope === 'across_groups'
            ? 'Up to 3 free visits shared across your organiser pages, then invite to join. Category Exclusivity still controls seats. You keep 100% of the membership fee.'
            : 'Up to 3 free visits on this organiser page, then invite to join. Category Exclusivity still controls seats. You keep 100% of the membership fee.';
      } else {
        note.textContent =
          scope === 'across_groups'
            ? 'Visitors get up to 3 free trial visits shared across your organiser pages — no application needed. People who want a full place still apply.'
            : 'Visitors get up to 3 free trial visits on this organiser page — no application needed. People who want a full place still apply.';
      }
      return;
    }
    if (isMembershipMeeting || (isMembershipOnlyPayHow() && guestProgrammeEnabled())) {
      note.textContent =
        scope === 'across_groups'
          ? 'Visitors get free trial visits shared across your organiser pages (up to 3), then we invite them to join. You keep 100% of the membership fee.'
          : 'Visitors get free trial visits on this organiser page (up to 3), then we invite them to join. You keep 100% of the membership fee.';
      return;
    }
    if (scope === 'across_groups') {
      note.textContent =
        'Visitors get up to 3 free trial visits shared across your organiser pages. After that, they need a paid member ticket to keep attending.';
    } else {
      note.textContent =
        'Visitors get up to 3 free trial visits on this organiser page. After that, they need a paid member ticket to keep attending.';
    }
  }

  function syncGuestVisitsInput() {
    const el = document.getElementById('ee-guest-visits-allowed');
    if (!el) return;
    // Never fight the organiser while they are typing a visit count.
    if (el.dataset.touched === '1') return;
    const current = Number(el.value);
    if (!Number.isFinite(current) || current < 1) {
      el.value = String(Math.min(3, Math.max(1, organiserComplimentaryVisits || 1)));
    } else if (organiserComplimentaryVisits > 0) {
      el.value = String(Math.min(3, Math.max(1, organiserComplimentaryVisits)));
    }
  }

  function syncGuestVisitsScopeFromOrganiser() {
    const scopeWrap = document.getElementById('ee-visits-scope-wrap');
    if (scopeWrap && scopeWrap.dataset.userScoped === '1') return;
    // If the organiser already edited the visit count, don't yank the scope radio
    // when a slow group settings fetch finishes.
    const visitsEl = document.getElementById('ee-guest-visits-allowed');
    if (visitsEl && visitsEl.dataset.touched === '1') return;
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
  const DEFAULT_MEMBER_BOOKING_NAME = 'Member ticket';
  const LEGACY_MEMBER_TICKET_NAME_RE = /^member ticket$/i;

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
      '<input type="text" class="ee-tier-name" required placeholder="e.g. General admission" /></div>' +
      '<div class="ee-field ee-tier-price-mode-field">' +
      '<span class="ee-label-block">Is this ticket free or paid?</span>' +
      '<div class="ee-tier-price-mode" role="group" aria-label="Free or paid">' +
      '<button type="button" class="ee-tier-price-mode-btn is-active" data-price-mode="free" aria-pressed="true">Free</button>' +
      '<button type="button" class="ee-tier-price-mode-btn" data-price-mode="paid" aria-pressed="false">Paid</button>' +
      '</div>' +
      '<p class="ee-hint ee-hint--below ee-tier-price-mode-hint">You can have a free ticket and a paid ticket. First visit still free? Tick complimentary visits below — do not name a ticket First Meeting.</p>' +
      '<p class="ee-hint ee-hint-warn ee-complimentary-visit-hint" hidden></p>' +
      '</div>' +
      '<div class="ee-field ee-tier-price-field" hidden>' +
      '<label>Price (£)</label>' +
      '<div class="ee-number-stepper">' +
      '<button type="button" class="ee-number-step ee-tier-price-down" aria-label="Decrease price">↓</button>' +
      '<input type="number" class="ee-tier-price" min="0" step="0.01" value="0" />' +
      '<button type="button" class="ee-number-step ee-tier-price-up" aria-label="Increase price">↑</button>' +
      '</div></div>' +
      '<div class="ee-field ee-tier-series-pass-field" hidden data-field-tip="event-series-pass-tier">' +
      '<label class="ee-check-label">' +
      '<input type="checkbox" class="ee-tier-series-pass" /> ' +
      '<span><strong>Multiple dates</strong> — one ticket covers every date in this listing (full series pass)</span>' +
      '</label>' +
      '<p class="ee-hint ee-hint--below">Leave unticked for weekly meetings (pay per date). Tick only if one purchase should cover all dates.</p></div>' +
      '<details class="ee-tier-advanced">' +
      '<summary>More options</summary>' +
      '<div class="ee-tier-advanced-body">' +
      '<div class="ee-field ee-tier-desc-field"><label>Description <span class="ee-optional">(optional)</span></label>' +
      '<textarea class="ee-tier-desc" rows="2" placeholder="What is included with this ticket"></textarea></div>' +
      '<div class="ee-field"><label>How many available <span class="ee-optional">(optional)</span></label>' +
      '<div class="ee-number-stepper">' +
      '<button type="button" class="ee-number-step ee-tier-qty-down" aria-label="Decrease quantity">↓</button>' +
      '<input type="number" class="ee-tier-qty" min="1" step="1" placeholder="Unlimited" inputmode="numeric" />' +
      '<button type="button" class="ee-number-step ee-tier-qty-up" aria-label="Increase quantity">↑</button>' +
      '</div>' +
      '<p class="ee-hint ee-hint--below">Defaults to unlimited. Only set a number if you want a hard cap for this ticket type. Use Event capacity below for the room total.</p></div>' +
      '<div class="ee-row-2 ee-tier-sale-row">' +
      '<div class="ee-field"><label>Sale start</label>' +
      '<div class="ee-datetime-split">' +
      '<input type="date" class="ee-tier-sale-start-date" />' +
      '<select class="ee-tier-sale-start-time" aria-label="Sale start time"></select>' +
      '</div>' +
      '<p class="ee-hint ee-hint--below">leave blank for sales to start today</p></div>' +
      '<div class="ee-field"><label>Sale end</label>' +
      saleEndSelectHtml('at_start') +
      '<div class="ee-sale-custom-wrap" hidden>' +
      '<p class="ee-hint" style="margin:0 0 6px">Custom end date and time</p>' +
      '<div class="ee-datetime-split">' +
      '<input type="date" class="ee-tier-sale-custom-date" />' +
      '<select class="ee-tier-sale-custom-time" aria-label="Custom sale end time"></select>' +
      '</div></div></div>' +
      '</div></div></details>' +
      '</div></div>'
    );
  }

  /** Blank / 0 / invalid → unlimited (null). Qty 0 was wrongly saving as sold out. */
  function normalizeTicketQuantity(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (s === '') return null;
    const n = Number(s);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n);
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
      const qtyNorm = normalizeTicketQuantity(row.querySelector('.ee-tier-qty')?.value);
      if (qtyNorm == null) hasUnlimited = true;
      else totalQty += qtyNorm;
      const price = Number(row.querySelector('.ee-tier-price')?.value) || 0;
      if (minPrice == null || price < minPrice) minPrice = price;
    });
    const qtyLabel = hasUnlimited && count ? 'unlimited' : String(totalQty);
    const fromPrice = minPrice == null ? 0 : Number(minPrice);
    const priceLabel =
      minPrice == null || fromPrice === 0
        ? 'Free'
        : count > 1
          ? 'from £' + fromPrice.toFixed(2)
          : '£' + fromPrice.toFixed(2);
    summary.textContent =
      count + ' ticket' + (count === 1 ? '' : 's') + ' · ' + qtyLabel + ' · ' + priceLabel;
    syncTierToolbarVisibility();
    updateComplimentaryVisitHints();
  }

  function syncTierToolbarVisibility() {
    const wrap = document.getElementById('ee-tier-rows');
    if (!wrap) return;
    const rows = wrap.querySelectorAll('.ee-tier-row');
    const multi = rows.length > 1;
    rows.forEach(function (row) {
      const toolbar = row.querySelector('.ee-tier-toolbar');
      if (toolbar) toolbar.hidden = !multi;
    });
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

  function syncTierPriceMode(row) {
    if (!row) return;
    const priceEl = row.querySelector('.ee-tier-price');
    const priceField = row.querySelector('.ee-tier-price-field');
    const raw = String((priceEl && priceEl.value) || '').trim();
    const price = Number(raw);
    const paidSelected = Boolean(
      row.querySelector('.ee-tier-price-mode-btn.is-active[data-price-mode="paid"]')
    );
    const isFree =
      Number.isFinite(price) && price > 0 ? false : paidSelected ? false : true;
    row.querySelectorAll('.ee-tier-price-mode-btn').forEach(function (btn) {
      const mode = btn.getAttribute('data-price-mode');
      const active = isFree ? mode === 'free' : mode === 'paid';
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (priceField) priceField.hidden = isFree;
  }

  function setTierPriceMode(row, mode) {
    if (!row) return;
    const priceEl = row.querySelector('.ee-tier-price');
    const priceField = row.querySelector('.ee-tier-price-field');
    const paid = mode === 'paid';
    row.querySelectorAll('.ee-tier-price-mode-btn').forEach(function (btn) {
      const active = (btn.getAttribute('data-price-mode') || '') === (paid ? 'paid' : 'free');
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (priceField) priceField.hidden = !paid;
    if (!priceEl) return;
    if (!paid) {
      priceEl.value = '0';
    } else if (!Number(priceEl.value) || Number(priceEl.value) <= 0) {
      priceEl.value = '';
      try {
        priceEl.focus();
      } catch {
        /* ignore */
      }
    }
    priceEl.dispatchEvent(new Event('input', { bubbles: true }));
    priceEl.dispatchEvent(new Event('change', { bubbles: true }));
    updateComplimentaryVisitHints();
  }

  function looksLikeComplimentaryVisitTicketName(name) {
    const n = String(name || '')
      .trim()
      .toLowerCase()
      .replace(/['’]/g, '');
    if (!n) return false;
    if (/^guest\s*visit$/i.test(n)) return true;
    return (
      /\b(first|1st|trial|taster|intro|introductory|complimentary|visitor|guest)\b/.test(n) &&
      /\b(visit|meeting|ticket|session|breakfast|lunch|event)\b/.test(n)
    );
  }

  function publicTierRowIsFree(row) {
    if (!row) return false;
    const paid = row.querySelector('.ee-tier-price-mode-btn.is-active[data-price-mode="paid"]');
    if (paid) {
      const price = Number(row.querySelector('.ee-tier-price')?.value);
      return !Number.isFinite(price) || price <= 0;
    }
    return true;
  }

  function publicTierRowIsPaid(row) {
    if (!row) return false;
    const price = Number(row.querySelector('.ee-tier-price')?.value);
    const paidSelected = Boolean(
      row.querySelector('.ee-tier-price-mode-btn.is-active[data-price-mode="paid"]')
    );
    return paidSelected && Number.isFinite(price) && price > 0;
  }

  function publicRowsHavePaidTicket(exceptRow) {
    return Array.from(document.querySelectorAll('.ee-tier-row')).some(function (row) {
      return row !== exceptRow && publicTierRowIsPaid(row);
    });
  }

  function publicFreeTicketIsFirstVisitStandIn(tiers) {
    const list = (tiers || []).filter(function (t) {
      if (isGuestVisitTicket(t) || isAlumniTicket(t) || isMembersOnlyTicket(t)) return false;
      return String(t.visibility || 'public').toLowerCase() !== 'members_only';
    });
    const hasPaid = list.some(function (t) {
      const price = Number(t.price);
      return Number.isFinite(price) && price > 0;
    });
    if (!hasPaid) return false;
    return list.some(function (t) {
      const price = Number(t.price);
      const free = !Number.isFinite(price) || price <= 0;
      return free && looksLikeComplimentaryVisitTicketName(t && t.name);
    });
  }

  function rowLooksLikeFirstVisitStandIn(row) {
    if (!publicTierRowIsFree(row)) return false;
    const name = row.querySelector('.ee-tier-name')?.value.trim() || '';
    return looksLikeComplimentaryVisitTicketName(name);
  }

  function updateComplimentaryVisitHints() {
    const rows = Array.from(document.querySelectorAll('.ee-tier-row'));
    const hasPaid = rows.some(publicTierRowIsPaid);
    const standIn = hasPaid && rows.some(rowLooksLikeFirstVisitStandIn);
    rows.forEach(function (row) {
      const hint = row.querySelector('.ee-complimentary-visit-hint');
      if (!hint) return;
      const show = hasPaid && rowLooksLikeFirstVisitStandIn(row);
      hint.hidden = !show;
      hint.textContent = show
        ? 'This looks like a first visit. Use complimentary visits so people cannot book every remaining date at £0. You can still keep a separate free ticket.'
        : '';
    });
    const banner = document.getElementById('ee-complimentary-visit-banner');
    if (banner) {
      banner.hidden = !standIn;
    }
  }

  function confirmComplimentaryVisitSwitch() {
    const modal = document.getElementById('ee-tickets-confirm-modal');
    const body = document.getElementById('ee-tickets-confirm-body');
    const hint = document.getElementById('ee-tickets-confirm-hint');
    const okBtn = document.getElementById('ee-tickets-confirm-ok');
    const title = document.getElementById('ee-tickets-confirm-title');
    const message =
      'You can keep a free ticket and a paid ticket. If this ticket is meant as a first visit, use complimentary visits instead — a free First Meeting ticket can be booked on every remaining date, with no visit limit.';
    if (!modal || !okBtn) {
      return Promise.resolve(window.confirm(message + '\n\nSwitch to complimentary visits?'));
    }
    if (title) title.textContent = 'Use complimentary visits for the first visit?';
    if (body) body.textContent = message;
    if (hint) {
      hint.textContent =
        'We will remove first-visit tickets (for example First Meeting) and turn on complimentary visits. Your other tickets stay.';
    }
    if (okBtn) okBtn.textContent = 'Switch to complimentary visits';
    return new Promise(function (resolve) {
      let settled = false;
      function finish(ok) {
        if (settled) return;
        settled = true;
        modal.hidden = true;
        document.body.classList.remove('ee-modal-open');
        document.removeEventListener('keydown', onKey);
        resolve(Boolean(ok));
      }
      function onKey(e) {
        if (e.key === 'Escape') finish(false);
      }
      modal.querySelectorAll('[data-ee-confirm-cancel]').forEach(function (el) {
        el.onclick = function () {
          finish(false);
        };
      });
      okBtn.onclick = function () {
        finish(true);
      };
      document.addEventListener('keydown', onKey);
      modal.hidden = false;
      document.body.classList.add('ee-modal-open');
      try {
        okBtn.focus();
      } catch {
        /* ignore */
      }
    });
  }

  function convertFreePublicTicketsToComplimentaryVisits() {
    document.querySelectorAll('.ee-tier-row').forEach(function (row) {
      if (rowLooksLikeFirstVisitStandIn(row)) row.remove();
    });
    const wrap = document.getElementById('ee-tier-rows');
    if (wrap && !wrap.querySelector('.ee-tier-row')) {
      addTierRow({ useDefaultName: true });
      const first = wrap.querySelector('.ee-tier-row');
      if (first) setTierPriceMode(first, 'paid');
    }
    const visits = document.getElementById('ee-guest-visits-allowed');
    if (visits && !visits.dataset.touched) {
      visits.value = String(Math.min(3, Math.max(1, organiserComplimentaryVisits || 1)));
    }
    const toggle = document.getElementById('ee-guest-programme-enabled');
    if (toggle) toggle.dataset.userToggled = '1';
    setGuestProgrammeEnabled(true);
    setMembersOnlyEventEnabled(false);
    if (attendanceDoor === 'application') {
      setAttendanceMode('category_exclusivity');
    } else {
      setAttendanceMode(resolveModeFromDoorAndPayHow());
    }
    updateComplimentaryVisitHints();
    updateTierSummary();
    updatePublishButton();
    const guestAddon = document.getElementById('ee-guest-addon');
    try {
      guestAddon?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      /* ignore */
    }
    showAlert(
      'Complimentary visits are on. Visitors get a limited number of complimentary first visits, then they use your tickets. Review the visit count, then save.',
      'ok'
    );
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
        if (el.classList && el.classList.contains('ee-tier-price')) syncTierPriceMode(row);
        updateComplimentaryVisitHints();
        updateTierSummary();
        updatePublishButton();
      });
      el.addEventListener('change', function () {
        if (el.classList && el.classList.contains('ee-tier-price')) syncTierPriceMode(row);
        updateComplimentaryVisitHints();
        updateTierSummary();
        updatePublishButton();
      });
    });
    row.querySelectorAll('.ee-tier-price-mode-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const mode = btn.getAttribute('data-price-mode') || 'free';
        setTierPriceMode(row, mode);
        updateComplimentaryVisitHints();
        if (mode === 'free' && publicRowsHavePaidTicket(row) && rowLooksLikeFirstVisitStandIn(row)) {
          confirmComplimentaryVisitSwitch().then(function (ok) {
            if (ok) convertFreePublicTicketsToComplimentaryVisits();
          });
        }
      });
    });
    syncTierPriceMode(row);
    const up = row.querySelector('.ee-tier-up');
    const down = row.querySelector('.ee-tier-down');
    if (up) up.addEventListener('click', () => moveTierRow(row, -1));
    if (down) down.addEventListener('click', () => moveTierRow(row, 1));

    function stepNumberInput(input, delta, opts) {
      if (!input) return;
      const step = Number(opts && opts.step) || 1;
      const min = opts && opts.min != null ? Number(opts.min) : 0;
      const allowEmpty = Boolean(opts && opts.allowEmpty);
      const raw = String(input.value || '').trim();
      if (allowEmpty && raw === '' && delta < 0) return;
      let current =
        raw === ''
          ? opts && opts.emptyAs != null
            ? Number(opts.emptyAs)
            : 0
          : Number(raw);
      if (!Number.isFinite(current)) current = 0;
      const next = Math.round((current + delta * step) * 100) / 100;
      if (allowEmpty && next < min) {
        input.value = '';
      } else {
        input.value = String(Math.max(min, next));
      }
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
      // Blank = unlimited; first ↑ starts a cap at 1 (never 0 / sold out).
      stepNumberInput(row.querySelector('.ee-tier-qty'), 1, {
        step: 1,
        min: 1,
        emptyAs: 0,
        allowEmpty: true,
      });
    });
    row.querySelector('.ee-tier-qty-down')?.addEventListener('click', () => {
      // ↓ from 1 clears back to unlimited (blank), never writes 0.
      stepNumberInput(row.querySelector('.ee-tier-qty'), -1, {
        step: 1,
        min: 1,
        emptyAs: 0,
        allowEmpty: true,
      });
    });

    const removeBtn = row.querySelector('.ee-tier-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        const wrap = document.getElementById('ee-tier-rows');
        if (!wrap) return;
        // Last public tier can be removed when membership also covers attendance.
        if (wrap.children.length <= 1 && !payHowIncludesMembership()) return;
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
    updateComplimentaryVisitHints();
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
      const qtyNorm = normalizeTicketQuantity(ticket.quantityAvailable);
      qtyEl.value = qtyNorm == null ? '' : String(qtyNorm);
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
    syncTierPriceMode(row);
    const advanced = row.querySelector('.ee-tier-advanced');
    if (advanced) {
      const qtyNorm = normalizeTicketQuantity(ticket.quantityAvailable);
      const hasAdvanced =
        Boolean(ticket.description) ||
        qtyNorm != null ||
        Boolean(ticket.saleStart) ||
        (ticket.saleEndOption && ticket.saleEndOption !== 'at_start');
      advanced.open = hasAdvanced;
    }
    updateComplimentaryVisitHints();
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
    if (isMembershipOnlyPayHow()) {
      if (membersOnlyEventEnabled()) {
        // Closed meeting: member list only — turn free trial visits off.
        const guestEl = document.getElementById('ee-guest-programme-enabled');
        if (guestEl) {
          guestEl.dataset.userToggled = '1';
          guestEl.checked = false;
        }
        setAttendanceMode('tickets');
        loadMemberRosterStatus();
      } else {
        // Unticked closed meeting → offer free trial visits again.
        const guestEl = document.getElementById('ee-guest-programme-enabled');
        if (guestEl) {
          guestEl.dataset.userToggled = '1';
          guestEl.checked = true;
        }
        const visits = document.getElementById('ee-guest-visits-allowed');
        if (visits && !visits.dataset.touched) visits.value = '2';
        setAttendanceMode('membership_meeting');
        setMemberRosterStatusMessage('');
      }
      syncMembersOnlyEventMode();
      updatePublishButton();
      return;
    }
    if (isMembershipMeetingMode()) {
      // Closed meeting and free visits are mutually exclusive on membership-only;
      // for other modes, keep membership_meeting from forcing the box back on.
      syncMembersOnlyEventMode();
      updatePublishButton();
      return;
    }
    if (membersOnlyEventEnabled()) {
      const guestEl = document.getElementById('ee-guest-programme-enabled');
      if (guestEl && guestEl.checked) {
        guestEl.checked = false;
        setAttendanceMode('tickets');
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

  function syncMembershipMeetingGuestMount() {
    syncGuestProgrammeMount();
  }

  function syncGuestProgrammeMount() {
    const meetingMount = document.getElementById('ee-membership-meeting-guest-mount');
    const ceMount = document.getElementById('ee-ce-guest-mount');
    const guestAddon = document.getElementById('ee-guest-addon');
    const fields = document.getElementById('ee-guest-programme-fields');
    if (!fields) return;

    let fieldsHome = document.getElementById('ee-guest-programme-fields-home');
    if (!fieldsHome) {
      fieldsHome = document.createElement('div');
      fieldsHome.id = 'ee-guest-programme-fields-home';
      if (guestAddon) guestAddon.appendChild(fieldsHome);
      else if (fields.parentElement) fields.parentElement.insertBefore(fieldsHome, fields);
    }

    let addonHome = document.getElementById('ee-guest-addon-home');
    if (!addonHome && guestAddon) {
      addonHome = document.createElement('div');
      addonHome.id = 'ee-guest-addon-home';
      if (guestAddon.parentElement) {
        guestAddon.parentElement.insertBefore(addonHome, guestAddon);
      }
      addonHome.appendChild(guestAddon);
    }

    const optOut = document.getElementById('ee-guest-passes-opt-out');
    const isCategory = attendanceMode === 'category_exclusivity';
    const isMeeting = isMembershipMeetingMode();
    const membershipOnly = isMembershipOnlyPayHow();
    const generalMount = document.getElementById('ee-general-guest-mount');

    const ticketsGuestMount = document.getElementById('ee-tickets-guest-mount');

    // Tickets-only: complimentary visits sit with the public tickets (first visit
    // before a paid ticket), not only on the membership path.
    if (!payHowIncludesMembership() && !isCategory) {
      if (meetingMount) meetingMount.hidden = true;
      if (ceMount) ceMount.hidden = true;
      if (generalMount) generalMount.hidden = true;
      if (ticketsGuestMount && guestAddon) {
        ticketsGuestMount.hidden = !payHowConfirmed;
        if (guestAddon.parentElement !== ticketsGuestMount) ticketsGuestMount.appendChild(guestAddon);
        guestAddon.hidden = !payHowConfirmed;
      } else if (guestAddon) {
        guestAddon.hidden = !payHowConfirmed;
      }
      if (fieldsHome && fields.parentElement !== fieldsHome) fieldsHome.appendChild(fields);
      fields.hidden = !payHowConfirmed || !guestProgrammeEnabled();
      if (optOut) optOut.hidden = !payHowConfirmed || !guestProgrammeEnabled();
      return;
    }
    if (ticketsGuestMount) ticketsGuestMount.hidden = true;

    // Membership-only: keep free trial visits on the path-choice step.
    if (membershipOnly && !isMeeting) {
      if (meetingMount) meetingMount.hidden = true;
      if (ceMount) ceMount.hidden = true;
      if (fieldsHome && fields.parentElement !== fieldsHome) fieldsHome.appendChild(fields);
      if (generalMount && guestAddon) {
        generalMount.hidden = false;
        if (guestAddon.parentElement !== generalMount) generalMount.appendChild(guestAddon);
        guestAddon.hidden = false;
        fields.hidden = !guestProgrammeEnabled();
        if (optOut) optOut.hidden = true;
      }
      return;
    }

    // Ticket and membership: free visits belong after Continue, not under the cards.
    if (payHowIncludesTickets() && payHowIncludesMembership() && !isCategory && !isMeeting) {
      if (meetingMount) meetingMount.hidden = true;
      if (ceMount) ceMount.hidden = true;
      if (generalMount) generalMount.hidden = true;
      if (addonHome && guestAddon && guestAddon.parentElement !== addonHome) {
        addonHome.appendChild(guestAddon);
      }
      if (fieldsHome && fields.parentElement !== fieldsHome) fieldsHome.appendChild(fields);
      if (guestAddon) guestAddon.hidden = !payHowConfirmed;
      fields.hidden = !payHowConfirmed || !guestProgrammeEnabled();
      if (optOut) optOut.hidden = !payHowConfirmed || !guestProgrammeEnabled();
      return;
    }

    if (isMeeting) {
      if (addonHome && guestAddon && guestAddon.parentElement !== addonHome) {
        addonHome.appendChild(guestAddon);
      }
      // Free visits stay on Step 2 — do not repeat the form on Step 3.
      if (generalMount && guestAddon) {
        generalMount.hidden = false;
        if (guestAddon.parentElement !== generalMount) generalMount.appendChild(guestAddon);
        guestAddon.hidden = false;
        if (fieldsHome && fields.parentElement !== fieldsHome) fieldsHome.appendChild(fields);
        fields.hidden = !guestProgrammeEnabled();
      }
      if (meetingMount) {
        meetingMount.hidden = true;
        meetingMount.replaceChildren();
      }
      if (optOut) optOut.hidden = true;
      if (ceMount) ceMount.hidden = true;
      return;
    }

    if (isCategory) {
      if (meetingMount) meetingMount.hidden = true;
      if (fieldsHome && fields.parentElement !== fieldsHome) fieldsHome.appendChild(fields);
      if (ceMount && guestAddon) {
        ceMount.hidden = false;
        if (guestAddon.parentElement !== ceMount) ceMount.appendChild(guestAddon);
        guestAddon.hidden = false;
      }
      fields.hidden = !guestProgrammeEnabled();
      if (optOut) optOut.hidden = true;
      if (generalMount) generalMount.hidden = true;
      return;
    }

    if (meetingMount) meetingMount.hidden = true;
    if (ceMount) ceMount.hidden = true;
    if (generalMount) generalMount.hidden = true;
    if (addonHome && guestAddon && guestAddon.parentElement !== addonHome) {
      addonHome.appendChild(guestAddon);
    }
    if (fieldsHome && fields.parentElement !== fieldsHome) fieldsHome.appendChild(fields);
    fields.hidden = !guestProgrammeEnabled();
    if (optOut) optOut.hidden = !guestProgrammeEnabled();
  }

  function syncMembersOnlyEventMode() {
    const membershipMeeting = isMembershipMeetingMode();
    const membershipOnlyPay = isMembershipOnlyPayHow();
    // Membership-only (with or without visits) never shows public Ticket 1 rows.
    const on = membersOnlyEventEnabled() || membershipMeeting || membershipOnlyPay;
    // Do not force the closed-meeting checkbox here — user must be able to untick it
    // and turn free trial visits back on.
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
    const closedHow = document.getElementById('ee-members-only-event-how');
    const visitsSummary = document.getElementById('ee-membership-visits-summary');
    const moeSummary = document.getElementById('ee-members-only-event-summary');
    const addonMount = document.getElementById('ee-private-ticket-fields-mount');
    if (toggleWrap) {
      toggleWrap.classList.toggle(
        'is-enabled',
        membersOnlyEventEnabled() && !guestProgrammeEnabled()
      );
    }
    if (toggleWrap) {
      // Always show for General + membership-only so organisers can switch
      // between closed meeting and free trial visits.
      const showClosed =
        membershipOnlyPay &&
        isOpenBookingMode(attendanceMode) &&
        attendanceMode !== 'guest_programme' &&
        attendanceDoor !== 'application';
      toggleWrap.hidden = !showClosed;
    }
    if (publicWrap) publicWrap.hidden = on;
    if (membersWrap) membersWrap.hidden = !on;
    if (privateAddon) {
      privateAddon.hidden =
        on ||
        attendanceMode === 'category_exclusivity' ||
        membershipMeeting ||
        membershipOnlyPay ||
        !payHowIncludesMembership();
    }
    if (optionalExtras) {
      if (!step2Confirmed || !payHowConfirmed) {
        optionalExtras.hidden = true;
      } else if (membershipMeeting || membershipOnlyPay) {
        // Membership path: member ticket + join fee live in the tickets panel.
        optionalExtras.hidden = true;
      } else if (!payHowIncludesMembership()) {
        // Plain tickets path — skip "Members pay less" to keep the happy path simple.
        optionalExtras.hidden = true;
      } else if (isOpenBookingMode(attendanceMode)) {
        optionalExtras.hidden = on;
      } else if (attendanceMode === 'category_exclusivity') {
        optionalExtras.hidden = on;
      }
    }
    const guestAddon = document.getElementById('ee-guest-addon');
    // Guest visits live in Step 2 mounts — don't hide when already relocated there.
    if (
      guestAddon &&
      guestAddon.parentElement?.id !== 'ee-ce-guest-mount' &&
      guestAddon.parentElement?.id !== 'ee-general-guest-mount'
    ) {
      guestAddon.hidden =
        membershipMeeting ||
        attendanceMode === 'category_exclusivity' ||
        (on && !membershipMeeting);
    }
    const alumniAddon = document.getElementById('ee-alumni-addon');
    if (alumniAddon) alumniAddon.hidden = true;
    const extrasMembershipMount = document.getElementById('ee-hub-membership-mount-extras');
    if (extrasMembershipMount && membershipMeeting && step2Confirmed && payHowConfirmed) {
      extrasMembershipMount.hidden = false;
    }
    if (panelTitle) {
      panelTitle.textContent = membershipMeeting
        ? 'Member ticket & join fee'
        : membershipOnlyPay
          ? 'Member booking'
          : on
            ? 'Member booking'
            : 'Your ticket';
    }
    if (panelLead) {
      if (membershipMeeting) {
        panelLead.hidden = false;
        panelLead.textContent =
          'Free visits stay as you set them in Step 2. Here, set the member ticket for this meeting and the fee to join your group.';
      } else {
        panelLead.hidden = on;
        if (!on) {
          panelLead.textContent =
            'Give it a name and choose free or a price. Most organisers only need one ticket.';
        }
      }
    }
    if (closedHow) closedHow.hidden = !on || membershipMeeting || guestProgrammeEnabled();
    if (visitsSummary) {
      visitsSummary.hidden = !(membershipMeeting && payHowConfirmed && guestProgrammeEnabled());
    }
    syncMembershipVisitsSummary();
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

    syncMembershipMeetingGuestMount();
    syncHubMembershipMount();

    if (on) {
      const nameEl = document.getElementById('ee-private-ticket-name');
      if (nameEl) {
        const n = String(nameEl.value || '').trim();
        if (!n || /^general admission$/i.test(n) || LEGACY_MEMBER_TICKET_NAME_RE.test(n)) {
          nameEl.value = DEFAULT_MEMBER_BOOKING_NAME;
        }
      }
      const priceEl = document.getElementById('ee-private-ticket-price');
      if (priceEl && (priceEl.value === '' || priceEl.value == null)) priceEl.value = '0';
      const feeNote = document.getElementById('ee-private-ticket-fee-note');
      if (feeNote) feeNote.hidden = Boolean(membershipMeeting);
      setMembersOnlyTicketHint(
        membershipMeeting
          ? 'What members pay to book this meeting — often £0 when membership covers attendance.'
          : 'Members book when signed in with their membership email.',
        'ok'
      );
    } else {
      const feeNote = document.getElementById('ee-private-ticket-fee-note');
      if (feeNote) feeNote.hidden = false;
    }

    if (membershipMeeting && memberRosterLoadState === 'idle') loadMemberRosterStatus();
    if ((membershipMeeting ||
        attendanceMode === 'category_exclusivity' ||
        (payHowIncludesTickets() && payHowIncludesMembership())) &&
      groupId
    ) {
      if (loadHubMembershipPlan._for !== groupId) {
        loadHubMembershipPlan._for = groupId;
        loadHubMembershipPlan(groupId);
      } else {
        syncHubMembershipMount();
      }
    } else {
      syncHubMembershipMount();
    }

    updateMembersOnlyEventSummary();
    updateTierSummary();
    syncTicketStepLabels();
  }

  function syncMembershipVisitsSummary() {
    const text = document.getElementById('ee-membership-visits-summary-text');
    if (!text) return;
    if (!(isMembershipMeetingMode() && guestProgrammeEnabled())) {
      text.textContent = '';
      return;
    }
    const visits = readGuestVisitsAllowed();
    const scope = readGuestVisitsScope();
    const scopeLabel =
      scope === 'across_groups' ? 'across all your organiser pages' : 'on this organiser page';
    text.innerHTML =
      '<strong>Free trial visits</strong> — ' +
      esc(String(visits)) +
      ' per visitor ' +
      esc(scopeLabel) +
      ' (set in Step 2).';
  }

  function bindMembershipVisitsChange() {
    const btn = document.getElementById('ee-membership-visits-change');
    if (!btn || btn.dataset.boundVisitsChange) return;
    btn.dataset.boundVisitsChange = '1';
    btn.addEventListener('click', function () {
      payHowConfirmed = false;
      showAlert('');
      hideLaterTicketSteps();
      const payHowPanel = document.getElementById('ee-panel-pay-how');
      if (payHowPanel) payHowPanel.hidden = false;
      syncPayHowStepUi();
      syncPayHowUi();
      syncTicketStepLabels();
      try {
        const guest = document.getElementById('ee-general-guest-mount') || payHowPanel;
        guest?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        /* ignore */
      }
    });
  }

  function updateMembersOnlyEventSummary() {
    const summary = document.getElementById('ee-members-only-event-summary');
    if (!summary) return;
    if (!(membersOnlyEventEnabled() || isMembershipMeetingMode() || isMembershipOnlyPayHow())) {
      return;
    }
    const tier = collectMembersOnlyTicket([]);
    if (!tier) {
      summary.textContent = 'Member booking · add a name below';
      return;
    }
    const qtyRaw = tier.quantityAvailable;
    const qtyNorm =
      qtyRaw == null || qtyRaw === '' || !Number.isFinite(Number(qtyRaw)) || Number(qtyRaw) <= 0
        ? null
        : Math.floor(Number(qtyRaw));
    const qtyLabel = qtyNorm == null ? 'unlimited' : String(qtyNorm);
    const priceNum = Number(tier.price);
    const priceLabel = !Number.isFinite(priceNum) || priceNum <= 0 ? 'Free' : '£' + priceNum.toFixed(2);
    summary.textContent =
      (tier.name || DEFAULT_MEMBER_BOOKING_NAME) + ' · ' + qtyLabel + ' available · ' + priceLabel;
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
              ? '1 active member on your list — they can book when signed in.'
              : memberRosterActiveCount + ' active members on your list — they can book when signed in.',
            'ok'
          );
        } else {
          setMemberRosterStatusMessage(
            'Your listing can go live now. Add people under Memberships when you’re ready — until then nobody can book this members-only meeting.',
            'warn'
          );
        }
      } else {
        setMemberRosterStatusMessage('');
      }
      updatePublishButton();
      syncTicketsNextSteps();
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

  function needsMembersAfterPublish() {
    return (
      membersOnlyEventEnabled() &&
      memberRosterLoadState === 'ready' &&
      Number(memberRosterActiveCount) === 0
    );
  }

  function syncTicketsNextSteps() {
    const wrap = document.getElementById('ee-tickets-next-steps');
    const body = document.getElementById('ee-tickets-next-steps-body');
    if (!wrap || !body) return;
    if (!ticketsSetupReadyForReview()) {
      wrap.hidden = true;
      return;
    }

    const parts = [];
    if (isExistingPublicListing()) {
      parts.push('Save tickets onto this listing. They stay on the organiser page — the group does not need to type them again.');
    } else {
      parts.push('Continue to review, then Confirm & publish — that is what makes the listing live.');
    }

    if (membersOnlyEventEnabled()) {
      if (needsMembersAfterPublish()) {
        parts.push(
          'Your member list is empty for now — that is fine. The listing can go live, and people book once you add them under Memberships.'
        );
      } else if (memberRosterActiveCount > 0) {
        parts.push('People on your member list can book when signed in with their membership email.');
      } else {
        parts.push('Add people under Memberships whenever you are ready.');
      }
    } else if (payHowIncludesMembership() && !payHowIncludesTickets()) {
      parts.push('New joiners pay your membership fee + booking fee (4.5% + 20p); manage prices under Memberships.');
    } else if (payHowIncludesTickets()) {
      parts.push('Ticket sales follow the sale dates you set on each ticket type.');
    }

    body.textContent = parts.join(' ');
    wrap.hidden = false;
  }

  function privateTicketEnabled() {
    return membersOnlyEventEnabled() || Boolean(document.getElementById('ee-private-ticket-enabled')?.checked);
  }

  function ceMemberTicketEnabled() {
    return Boolean(document.getElementById('ee-ce-member-ticket-enabled')?.checked);
  }

  function ceChargeTicketEnabled() {
    return attendanceDoor === 'application' && payHowIncludesTickets();
  }

  function setCeChargeTicket(on) {
    // Legacy helper — drive from pay-how (tickets / both vs membership only).
    if (on) {
      setPayHow(payHowIncludesMembership() ? 'both' : 'tickets');
    } else if (payHowIncludesMembership()) {
      setPayHow('membership');
    } else {
      setPayHow('membership');
    }
    syncPayHowUi();
  }

  function syncCeChargeTicketUi() {
    syncPayHowUi();
  }

  function syncPayHowUi() {
    const includesTickets = payHowIncludesTickets();
    const includesMembership = payHowIncludesMembership();
    const isApplication = attendanceDoor === 'application';
    const hint = document.getElementById('ee-pay-how-hint');
    const outcome = document.getElementById('ee-pay-how-outcome');
    const lead = document.getElementById('ee-pay-how-lead');
    const wrap = document.getElementById('ee-ce-price-wrap');
    const priceEl = document.getElementById('ee-ce-price');
    const publicWrap = document.getElementById('ee-public-tickets-wrap');
    const closedToggle = document.getElementById('ee-members-only-event-toggle');

    if (lead) {
      lead.textContent = 'Pick one path, then continue.';
    }
    if (hint) {
      // Keep the status line for screen readers / continue prompts, but hide the visual clutter.
      hint.hidden = true;
      if (!payHowConfirmed) {
        hint.textContent = includesMembership
          ? 'Continue to set your membership fee.'
          : 'Continue to set your ticket.';
      } else {
        hint.textContent = includesMembership
          ? 'Set the monthly or annual membership fee below.'
          : 'Set your ticket below.';
      }
    }
    if (outcome) {
      if (isApplication) {
        outcome.textContent = includesTickets && includesMembership
          ? 'Next: ticket price after approval, then your join fee.'
          : includesMembership
            ? 'Next: free visits, then your join fee.'
            : 'Next: ticket price after you approve.';
      } else if (includesTickets && includesMembership) {
        outcome.textContent = 'Next: visitor tickets, then member price, join fee, and optional free visits.';
      } else if (includesMembership) {
        outcome.textContent = 'Next: free visits, then member ticket and join fee.';
      } else {
        outcome.textContent = 'Next: ticket name and price.';
      }
    }

    if (wrap) {
      const showCePrice = isApplication && includesTickets;
      wrap.hidden = !showCePrice;
      if (showCePrice) wrap.removeAttribute('hidden');
      else wrap.setAttribute('hidden', '');
    }
    if (priceEl) {
      if (isApplication && includesTickets) {
        priceEl.min = '0.01';
        if (priceEl.value === '0') priceEl.value = '';
      } else {
        priceEl.min = '0';
        priceEl.value = '0';
      }
    }

    if (includesMembership) {
      setHubMembershipEnabled(true);
    } else {
      setHubMembershipEnabled(false);
      if (guestProgrammeEnabled()) setGuestProgrammeEnabled(false);
    }

    // Membership path: default free trial visits on once (user can untick).
    // Do not re-force on every sync — that made the checkbox impossible to clear.
    if (!isApplication && includesMembership && !includesTickets && !membersOnlyEventEnabled()) {
      const visitsToggle = document.getElementById('ee-guest-programme-enabled');
      if (visitsToggle && !visitsToggle.dataset.userToggled && !visitsToggle.checked) {
        setGuestProgrammeEnabled(true);
      }
      const visits = document.getElementById('ee-guest-visits-allowed');
      if (visits && !visits.dataset.touched) visits.value = '2';
    }

    if (closedToggle) {
      // Visible for General + membership-only so organisers can switch to/from closed.
      closedToggle.hidden =
        isApplication ||
        !includesMembership ||
        includesTickets ||
        attendanceMode === 'guest_programme';
    }

    if (publicWrap && !isApplication) {
      publicWrap.hidden = membersOnlyEventEnabled() || (!includesTickets && includesMembership);
    }

    if (includesTickets && includesMembership) {
      ensureListMemberBookingWhenBoth();
    }

    syncHubMembershipMount();
    syncGuestProgrammeMount();
    syncTicketsNextSteps();
  }

  function ceGuestVisitsEnabled() {
    return attendanceMode === 'category_exclusivity' && guestProgrammeEnabled();
  }

  function hubMembershipEnabled() {
    return Boolean(document.getElementById('ee-hub-membership-enabled')?.checked);
  }

  function setHubMembershipEnabled(on) {
    const el = document.getElementById('ee-hub-membership-enabled');
    if (el) el.checked = Boolean(on);
    syncHubMembershipFields();
  }

  function syncHubMembershipFields() {
    const enabled = hubMembershipEnabled();
    const body = document.getElementById('ee-hub-membership-fields');
    if (body) body.hidden = !enabled;
    syncAddonCard('ee-hub-membership-addon', enabled);
  }

  function hubMembershipMountTarget() {
    if (!payHowIncludesMembership()) return null;
    if (attendanceMode === 'category_exclusivity') {
      return document.getElementById('ee-hub-membership-mount-ce');
    }
    if (isMembershipMeetingMode() || isMembershipOnlyPayHow()) {
      // Join fee belongs on Step 3 with the member ticket — not again on Step 2.
      if (!payHowConfirmed) return null;
      return document.getElementById('ee-hub-membership-mount-meeting');
    }
    // Ticket + membership: fee after visitor tickets, with the member price step.
    if (payHowIncludesTickets() && payHowIncludesMembership()) {
      if (!payHowConfirmed) return null;
      return document.getElementById('ee-hub-membership-mount-extras');
    }
    return (
      document.getElementById('ee-hub-membership-mount-payhow') ||
      document.getElementById('ee-hub-membership-mount-extras')
    );
  }

  function syncHubMembershipMount() {
    const config = document.getElementById('ee-hub-membership-config');
    const addon = document.getElementById('ee-hub-membership-addon');
    const extrasMount = document.getElementById('ee-hub-membership-mount-extras');
    if (!config || !addon) return;
    const target = hubMembershipMountTarget();
    const show = Boolean(target);
    config.hidden = !show;
    if (extrasMount) extrasMount.hidden = !(show && target === extrasMount);
    if (show) {
      if (addon.parentElement !== target) target.appendChild(addon);
      if (
        (isMembershipMeetingMode() || (payHowIncludesTickets() && payHowIncludesMembership())) &&
        !hubMembershipEnabled()
      ) {
        setHubMembershipEnabled(true);
      }
    } else if (addon.parentElement !== config) {
      config.appendChild(addon);
    }
    const locked =
      (isMembershipMeetingMode() || isMembershipOnlyPayHow() || (payHowIncludesTickets() && payHowIncludesMembership())) &&
      hubMembershipEnabled();
    addon.classList.toggle('is-locked', locked);
    syncHubMembershipFields();
  }

  function setHubMembershipStatus(msg, tone) {
    const el = document.getElementById('ee-hub-membership-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('ee-hint-warn', tone === 'warn');
    el.classList.toggle('ee-hint-ok', tone === 'ok');
  }

  function readHubMembershipVat() {
    const checked = document.querySelector('input[name="ee-hub-membership-vat"]:checked');
    const v = String(checked?.value || 'included').trim();
    if (v === 'added' || v === 'none') return v;
    return 'included';
  }

  function readHubMembershipAmounts() {
    const monthlyRaw = String(document.getElementById('ee-hub-membership-monthly')?.value || '').trim();
    const annualRaw = String(document.getElementById('ee-hub-membership-annual')?.value || '').trim();
    const monthly = monthlyRaw === '' ? null : Number(monthlyRaw);
    const annual = annualRaw === '' ? null : Number(annualRaw);
    return { monthlyRaw: monthlyRaw, annualRaw: annualRaw, monthly: monthly, annual: annual };
  }

  function hubMembershipIsPaid() {
    const amounts = readHubMembershipAmounts();
    return (
      (amounts.monthly != null && Number.isFinite(amounts.monthly) && amounts.monthly >= 1) ||
      (amounts.annual != null && Number.isFinite(amounts.annual) && amounts.annual >= 1)
    );
  }

  function collectHubMembershipPayload() {
    if (!hubMembershipEnabled()) return null;
    if (!hubMembershipIsPaid()) return null;
    const amounts = readHubMembershipAmounts();
    return {
      active: true,
      vatTreatment: readHubMembershipVat(),
      monthlyAmountPounds: amounts.monthly != null && amounts.monthly >= 1 ? amounts.monthly : null,
      annualAmountPounds: amounts.annual != null && amounts.annual >= 1 ? amounts.annual : null,
      clearMonthly: !(amounts.monthly != null && amounts.monthly >= 1),
      clearAnnual: !(amounts.annual != null && amounts.annual >= 1),
    };
  }

  function hubMembershipHasPrice() {
    const amounts = readHubMembershipAmounts();
    if (amounts.monthlyRaw !== '' && !Number.isFinite(amounts.monthly)) return false;
    if (amounts.annualRaw !== '' && !Number.isFinite(amounts.annual)) return false;
    if (amounts.monthly != null && amounts.monthly < 0) return false;
    if (amounts.annual != null && amounts.annual < 0) return false;
    // platform billing stores £1+ only. Blank or 0 = free join via member list (no plan row).
    if (amounts.monthly != null && amounts.monthly > 0 && amounts.monthly < 1) return false;
    if (amounts.annual != null && amounts.annual > 0 && amounts.annual < 1) return false;
    return true;
  }

  async function loadHubMembershipPlan(groupId) {
    const id = String(groupId || seriesMeta.organiserGroupId || '').trim();
    if (!id) {
      setHubMembershipStatus('Link this event to an organiser page to set membership prices.', 'warn');
      return;
    }
    const { ok, data } = await api(
      '/api/organiser/membership-plans?organiserId=' + encodeURIComponent(id)
    );
    if (!ok) {
      setHubMembershipStatus('Could not load membership prices — refresh and try again.', 'warn');
      return;
    }
    const plan = data.plan || null;
    const monthlyEl = document.getElementById('ee-hub-membership-monthly');
    const annualEl = document.getElementById('ee-hub-membership-annual');
    if (monthlyEl) {
      monthlyEl.value =
        plan && plan.monthlyAmountPence != null && Number(plan.monthlyAmountPence) >= 100
          ? String((plan.monthlyAmountPence / 100).toFixed(2)).replace(/\.00$/, '')
          : '';
    }
    if (annualEl) {
      annualEl.value =
        plan && plan.annualAmountPence != null && Number(plan.annualAmountPence) >= 100
          ? String((plan.annualAmountPence / 100).toFixed(2)).replace(/\.00$/, '')
          : '';
    }
    const vat = String(plan?.vatTreatment || 'included');
    document.querySelectorAll('input[name="ee-hub-membership-vat"]').forEach(function (radio) {
      radio.checked = radio.value === vat;
    });
    const connectNote = document.getElementById('ee-hub-membership-connect');
    if (connectNote) {
      const paid = hubMembershipIsPaid();
      connectNote.hidden = data.connectReady !== false || !paid;
    }
    if (plan && plan.offered) {
      setHubMembershipEnabled(true);
      setHubMembershipStatus(
        plan.paid
          ? 'Membership fees loaded from your Memberships settings.'
          : 'Free membership — people join via your member list (no platform charge).',
        'ok'
      );
    } else if (isMembershipMeetingMode() || hubMembershipEnabled()) {
      setHubMembershipStatus(
        'Leave blank if joining is free (member list only). Paid memberships start from £1.',
        'ok'
      );
    } else {
      setHubMembershipStatus('');
    }
  }

  async function saveHubMembershipPlanIfNeeded() {
    if (!hubMembershipEnabled()) return { ok: true };
    const groupId = String(seriesMeta.organiserGroupId || '').trim();
    if (!groupId) {
      return { ok: false, message: 'Choose an organiser page before setting membership prices.' };
    }
    if (!hubMembershipHasPrice()) {
      return {
        ok: false,
        message:
          'Membership prices must be blank/£0 (free via member list) or at least £1 for platform billing.',
      };
    }
    // Free join — no organiser_membership_plans row (database only allows £1+).
    if (!hubMembershipIsPaid()) {
      setHubMembershipStatus(
        'Joining stays free via your member list — no membership charge to save.',
        'ok'
      );
      return { ok: true };
    }
    const payload = collectHubMembershipPayload();
    if (!payload) return { ok: true };
    const { ok, data } = await api('/api/organiser/membership-plans', {
      method: 'PUT',
      body: JSON.stringify(Object.assign({ organiserId: groupId }, payload)),
    });
    if (!ok) {
      return {
        ok: false,
        message: data?.message || data?.error || 'Could not save membership fees.',
      };
    }
    setHubMembershipStatus('Membership fees saved.', 'ok');
    return { ok: true };
  }

  function bindHubMembershipFields() {
    const enabled = document.getElementById('ee-hub-membership-enabled');
    if (enabled && !enabled.dataset.boundHubMembership) {
      enabled.dataset.boundHubMembership = '1';
      enabled.addEventListener('change', function () {
        syncHubMembershipFields();
        if (hubMembershipEnabled() && attendanceMode === 'category_exclusivity') {
          setGuestProgrammeEnabled(true);
          if (!ceMemberTicketEnabled()) {
            const ceMember = document.getElementById('ee-ce-member-ticket-enabled');
            if (ceMember) {
              ceMember.checked = true;
              syncCeMemberTicketFields();
            }
          }
          setAttendanceMode('category_exclusivity');
        }
        if (hubMembershipEnabled() && seriesMeta.organiserGroupId) {
          loadHubMembershipPlan(seriesMeta.organiserGroupId);
        }
        syncGuestProgrammeNote();
        updatePublishButton();
      });
    }
    ['ee-hub-membership-monthly', 'ee-hub-membership-annual'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el || el.dataset.boundHubMembershipInput) return;
      el.dataset.boundHubMembershipInput = '1';
      el.addEventListener('input', updatePublishButton);
      el.addEventListener('change', updatePublishButton);
    });
    document.querySelectorAll('input[name="ee-hub-membership-vat"]').forEach(function (radio) {
      if (radio.dataset.boundHubMembershipVat) return;
      radio.dataset.boundHubMembershipVat = '1';
      radio.addEventListener('change', updatePublishButton);
    });
  }

  function syncCeMemberTicketFields() {
    const enabled = ceMemberTicketEnabled();
    const body = document.getElementById('ee-ce-member-ticket-fields');
    if (body) {
      body.hidden = !enabled;
      if (enabled) body.removeAttribute('hidden');
      else body.setAttribute('hidden', '');
    }
    syncAddonCard('ee-ce-member-ticket-addon', enabled);
  }

  function collectCeMemberTicket(ceTier) {
    if (!ceMemberTicketEnabled()) return null;
    const name =
      document.getElementById('ee-ce-member-ticket-name')?.value.trim() || DEFAULT_MEMBER_BOOKING_NAME;
    if (!name) return null;
    const price = document.getElementById('ee-ce-member-ticket-price')?.value;
    const qty = document.getElementById('ee-ce-member-ticket-qty')?.value;
    return {
      name,
      price: price === '' || price == null ? 0 : price,
      description:
        'Book without applying — for people on this group\u2019s membership list. Guests use Category Exclusivity application above.',
      status: 'Available',
      quantityAvailable: normalizeTicketQuantity(qty),
      saleStart: ceTier?.saleStart || null,
      saleEnd: ceTier?.saleEnd || null,
      saleEndOption: ceTier?.saleEndOption || 'at_start',
      saleEndCustom: ceTier?.saleEndCustom || null,
      categoryExclusivity: false,
      ticketType: 'Standard',
      displayOrder: 1,
      visibility: 'members_only',
    };
  }

  function prefillCeGuestVisits(eventRow, tickets) {
    const hasGuestVisit = (tickets || []).some(isGuestVisitTicket);
    const disabled = Boolean(eventRow?.guestPassesDisabled);
    if (!hasGuestVisit && !disabled) {
      setGuestProgrammeEnabled(false);
      return;
    }
    setGuestProgrammeEnabled(true);
    const optOut = document.getElementById('ee-guest-passes-disabled');
    if (optOut) optOut.checked = disabled && !hasGuestVisit;
  }

  function prefillCeMemberTicket(tickets) {
    const tier = (tickets || []).find(isMembersOnlyTicket);
    const enabledEl = document.getElementById('ee-ce-member-ticket-enabled');
    if (!tier) {
      if (enabledEl) enabledEl.checked = false;
      syncCeMemberTicketFields();
      return;
    }
    if (enabledEl) enabledEl.checked = true;
    const nameEl = document.getElementById('ee-ce-member-ticket-name');
    if (nameEl) nameEl.value = tier.name || DEFAULT_MEMBER_BOOKING_NAME;
    const priceEl = document.getElementById('ee-ce-member-ticket-price');
    if (priceEl) {
      priceEl.value = tier.price === '' || tier.price == null ? '0' : String(tier.price);
    }
    const qtyEl = document.getElementById('ee-ce-member-ticket-qty');
    if (qtyEl) {
      const qtyNorm = normalizeTicketQuantity(tier.quantityAvailable);
      qtyEl.value = qtyNorm == null ? '' : String(qtyNorm);
    }
    syncCeMemberTicketFields();
  }

  function bindPayHowFields() {
    bindPayHowChange();
    bindMembershipVisitsChange();
    document.querySelectorAll('.ee-pay-how-options .ee-attendance-card').forEach(function (btn) {
      if (btn.dataset.boundPayHow) return;
      btn.dataset.boundPayHow = '1';
      btn.addEventListener('click', function () {
        const value = btn.getAttribute('data-pay-how') || 'tickets';
        setPayHow(value);
        applyPayHowSelection();
      });
    });
    syncPayHowUi();
    syncPayHowStepUi();
  }

  /** Keep UI consistent when switching Tickets / Membership / Both. */
  function applyPayHowSelection() {
    if (isMembershipOnlyPayHow()) {
      const visitsToggle = document.getElementById('ee-guest-programme-enabled');
      if (visitsToggle && !visitsToggle.dataset.userToggled) {
        setGuestProgrammeEnabled(true);
      }
      if (guestProgrammeEnabled()) {
        setMembersOnlyEventEnabled(false);
        setAttendanceMode('membership_meeting');
      } else {
        setMembersOnlyEventEnabled(true);
        setAttendanceMode('tickets');
      }
    } else {
      // Tickets or Both — leave membership-meeting / closed shell so public tiers show.
      if (isMembershipMeetingMode()) {
        attendanceMode = 'tickets';
      }
      setMembersOnlyEventEnabled(false);
      if (!payHowIncludesMembership()) {
        setHubMembershipEnabled(false);
        // Free visits belong on Join the group — clear them on tickets-only.
        setGuestProgrammeEnabled(false);
      }
      setAttendanceMode(resolveModeFromDoorAndPayHow());
      ensurePublicTiersAfterLeavingMembership();
      ensureListMemberBookingWhenBoth();
    }
    syncPayHowUi();
    syncMembersOnlyEventMode();
    updateTierSummary();
    updatePublishButton();
  }

  /** Both tickets + membership: members should not pay the public price again. */
  function ensureListMemberBookingWhenBoth() {
    if (!(payHowIncludesTickets() && payHowIncludesMembership())) return;
    if (membersOnlyEventEnabled() || isMembershipMeetingMode()) return;
    const enabled = document.getElementById('ee-private-ticket-enabled');
    if (enabled && !enabled.checked) {
      enabled.checked = true;
    }
    const addon = document.getElementById('ee-private-ticket-addon');
    if (addon) addon.classList.add('is-locked');
    const nameEl = document.getElementById('ee-private-ticket-name');
    if (nameEl) {
      const n = String(nameEl.value || '').trim();
      if (!n || LEGACY_MEMBER_TICKET_NAME_RE.test(n) || /^general admission$/i.test(n)) {
        nameEl.value = DEFAULT_MEMBER_BOOKING_NAME;
      }
    }
    const priceEl = document.getElementById('ee-private-ticket-price');
    if (priceEl && !priceEl.dataset.userSet) {
      priceEl.value = '0';
    }
    syncPrivateTicketFields();
  }

  /**
   * Membership-only stores the £0/member price in private fields. When switching
   * to Tickets/Both, seed a public tier so the free ticket does not “vanish”.
   */
  function ensurePublicTiersAfterLeavingMembership() {
    if (!payHowIncludesTickets()) return;
    const wrap = document.getElementById('ee-tier-rows');
    if (!wrap) return;
    if (wrap.querySelectorAll('.ee-tier-row').length) {
      const publicWrap = document.getElementById('ee-public-tickets-wrap');
      if (publicWrap) publicWrap.hidden = false;
      return;
    }
    const privateName = String(document.getElementById('ee-private-ticket-name')?.value || '').trim();
    const privatePrice = document.getElementById('ee-private-ticket-price')?.value;
    const row = addTierRow({ useDefaultName: false });
    if (!row) return;
    const nameEl = row.querySelector('.ee-tier-name');
    const priceEl = row.querySelector('.ee-tier-price');
    if (nameEl) {
      nameEl.value =
        privateName && !LEGACY_MEMBER_TICKET_NAME_RE.test(privateName)
          ? privateName
          : DEFAULT_TIER_NAME;
    }
    if (priceEl) {
      priceEl.value =
        privatePrice === '' || privatePrice == null ? '0' : String(privatePrice);
    }
    const publicWrap = document.getElementById('ee-public-tickets-wrap');
    if (publicWrap) publicWrap.hidden = false;
    const membersWrap = document.getElementById('ee-members-only-event-wrap');
    if (membersWrap) membersWrap.hidden = true;
  }

  function bindCeChargeTicketFields() {
    bindPayHowFields();
  }

  function bindCeMemberTicketFields() {
    const enabled = document.getElementById('ee-ce-member-ticket-enabled');
    const onToggle = function () {
      syncCeMemberTicketFields();
      updatePublishButton();
    };
    if (enabled && !enabled.dataset.boundCeMemberTicket) {
      enabled.dataset.boundCeMemberTicket = '1';
      enabled.addEventListener('change', onToggle);
    }
    // Delegation fallback (covers late panel moves / stale single-element binds)
    const form = document.getElementById('ee-tickets-form');
    if (form && !form.dataset.boundCeMemberTicketDelegate) {
      form.dataset.boundCeMemberTicketDelegate = '1';
      form.addEventListener('change', function (e) {
        if (e.target && e.target.id === 'ee-ce-member-ticket-enabled') onToggle();
      });
    }
    ['ee-ce-member-ticket-name', 'ee-ce-member-ticket-price', 'ee-ce-member-ticket-qty'].forEach(
      function (id) {
        const el = document.getElementById(id);
        if (!el || el.dataset.boundCeMemberTicketInput) return;
        el.dataset.boundCeMemberTicketInput = '1';
        el.addEventListener('input', updatePublishButton);
        el.addEventListener('change', updatePublishButton);
      }
    );
    syncCeMemberTicketFields();
  }

  function handlePrivateTicketAddonToggle() {
    // Member rate stays an optional add-on beside public tickets.
    // Closed member-list booking is only via the explicit Closed meeting control
    // under General + membership — never auto-switched from this toggle.
    syncPrivateTicketFields();
    updatePublishButton();
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
    const both = payHowIncludesTickets() && payHowIncludesMembership();
    const addon = document.getElementById('ee-private-ticket-addon');
    if (addon) addon.classList.toggle('is-locked', both && enabled && !membersOnlyEventEnabled());
    syncAddonCard('ee-private-ticket-addon', enabled && !membersOnlyEventEnabled());
    syncMembersOnlyEventMode();
    if (enabled && !membersOnlyEventEnabled()) {
      setMembersOnlyTicketHint(
        'Members see this ticket when signed in with their membership email.',
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
      document.getElementById('ee-private-ticket-name')?.value.trim() || DEFAULT_MEMBER_BOOKING_NAME;
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
      quantityAvailable: normalizeTicketQuantity(qty),
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
    if (nameEl) nameEl.value = tier.name || DEFAULT_MEMBER_BOOKING_NAME;
    const priceEl = document.getElementById('ee-private-ticket-price');
    if (priceEl) {
      priceEl.value = tier.price === '' || tier.price == null ? '0' : String(tier.price);
    }
    const qtyEl = document.getElementById('ee-private-ticket-qty');
    if (qtyEl) {
      const qtyNorm = normalizeTicketQuantity(tier.quantityAvailable);
      qtyEl.value = qtyNorm == null ? '' : String(qtyNorm);
    }
    setMembersOnlyTicketHint(
      'Members book when signed in with their membership email.',
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
          if (id === 'ee-private-ticket-price') el.dataset.userSet = '1';
          updateMembersOnlyEventSummary();
          updatePublishButton();
        });
        el.addEventListener('change', function () {
          if (id === 'ee-private-ticket-price') el.dataset.userSet = '1';
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
    hydrateAttendeeExtrasFromEvent(ev);
    updatePublishButton();
  }

  function openAttendeeExtrasIfNeeded() {
    const details = document.getElementById('ee-attendee-extras-details');
    if (!details) return;
    const anyChecked = ['ee-food-included', 'ee-collect-dietary', 'ee-collect-access'].some(
      function (id) {
        return Boolean(document.getElementById(id)?.checked);
      }
    );
    if (anyChecked) details.open = true;
  }

  function hydrateAttendeeExtrasFromEvent(ev) {
    const food = document.getElementById('ee-food-included');
    const dietary = document.getElementById('ee-collect-dietary');
    const access = document.getElementById('ee-collect-access');
    if (food) food.checked = Boolean(ev.foodIncluded);
    if (dietary) dietary.checked = Boolean(ev.collectDietary);
    if (access) access.checked = Boolean(ev.collectAccessibility);
    openAttendeeExtrasIfNeeded();
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

    if (
      ticketsRes.status === 403 ||
      eventRes.status === 403 ||
      (ticketsRes.data && ticketsRes.data.error === 'event_not_owned') ||
      (eventRes.data && eventRes.data.error === 'event_not_owned')
    ) {
      const ownedErr =
        (eventRes.data && eventRes.data.error === 'event_not_owned' && eventRes.data) ||
        (ticketsRes.data && ticketsRes.data.error === 'event_not_owned' && ticketsRes.data) ||
        ticketsRes.data ||
        eventRes.data ||
        {};
      showAlert(
        ownedErr.message ||
          'This event is not on this organiser account, so tickets cannot be edited here.',
        'warn'
      );
      const tickets =
        ticketsRes.ok && Array.isArray(ticketsRes.data.tickets) ? ticketsRes.data.tickets : [];
      const event = eventRes.ok && eventRes.data.event ? eventRes.data.event : null;
      return { tickets: tickets, event: event, authFailed: false, notOwned: true };
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

  function findCachedOrganiserGroup(groupId) {
    const id = String(groupId || '').trim();
    if (!id) return null;
    const fromList = function (groups) {
      if (!Array.isArray(groups)) return null;
      return (
        groups.find(function (g) {
          return String(g && g.id) === id;
        }) || null
      );
    };
    const embedBootstrap = window.HubOrganiserEmbedBootstrap;
    if (embedBootstrap && embedBootstrap.readCache) {
      const hit = fromList((embedBootstrap.readCache() || {}).groups);
      if (hit) return hit;
    }
    if (paymentSetupState && Array.isArray(paymentSetupState.groups)) {
      const hit = fromList(paymentSetupState.groups);
      if (hit) return hit;
    }
    try {
      const raw = sessionStorage.getItem(ORG_BOOTSTRAP_CACHE_KEY);
      if (raw) {
        const hit = fromList((JSON.parse(raw) || {}).groups);
        if (hit) return hit;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  function applyGuestVisitSettingsFromGroup(group) {
    if (!group) return;
    organiserComplimentaryVisits = Number(group.complimentaryVisitsAllowed) || 0;
    organiserComplimentaryVisitsScope =
      group.complimentaryVisitsScope === 'across_groups' ? 'across_groups' : 'per_group';
    organiserGroupName = String(group.name || '').trim();
    const visitsEl = document.getElementById('ee-guest-visits-allowed');
    if (visitsEl && organiserComplimentaryVisits > 0 && visitsEl.dataset.touched !== '1') {
      visitsEl.value = String(Math.min(3, Math.max(1, organiserComplimentaryVisits)));
    }
    syncGuestVisitsScopeFromOrganiser();
  }

  async function loadOrganiserGuestVisitSetting(groupId) {
    if (!groupId) {
      organiserComplimentaryVisits = 0;
      organiserComplimentaryVisitsScope = 'per_group';
      return;
    }
    const cached = findCachedOrganiserGroup(groupId);
    if (
      cached &&
      (cached.complimentaryVisitsAllowed != null || cached.complimentaryVisitsScope != null)
    ) {
      applyGuestVisitSettingsFromGroup(cached);
      return;
    }
    const { ok, data } = await api('/api/organiser/groups?id=' + encodeURIComponent(groupId));
    if (ok && data.group) {
      applyGuestVisitSettingsFromGroup(data.group);
    }
  }

  async function saveOrganiserGuestVisitsAllowed(groupId, allowed, scope) {
    const id = String(groupId || '').trim();
    const n = Math.min(3, Math.max(1, Math.floor(Number(allowed) || 0)));
    const visitsScope = scope === 'across_groups' ? 'across_groups' : 'per_group';
    if (!id || n < 1) return { ok: false, message: 'Enter how many free trial visits (1–3).' };
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
        quantityAvailable: normalizeTicketQuantity(qty),
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
        quantityAvailable: normalizeTicketQuantity(t.quantityAvailable),
        saleEnd: t.saleEnd || '',
        saleStart: t.saleStart || '',
        ticketType: String(t.ticketType || '').trim(),
        visibility: String(t.visibility || 'public').trim(),
        categoryExclusivity: Boolean(t.categoryExclusivity),
      };
    });
    return JSON.stringify({
      attendanceMode: attendanceMode,
      maxAttendees: collectEventCapacity(),
      tiers: normalized,
    });
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
        maxAttendees: collectEventCapacity(),
        guestPassesDisabled: collectGuestPassesDisabled(),
        enableGuestVisits: ceGuestVisitsEnabled(),
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
      if (Array.isArray(draft.tiers) && draft.tiers[0]) {
        const ceTier = draft.tiers.find(isCategoryExclusivityTicket) || draft.tiers[0];
        prefillCategoryExclusivityFromTicket(ceTier);
        prefillCeMemberTicket(draft.tiers);
      }
      if (draft.enableGuestVisits) {
        setGuestProgrammeEnabled(true);
        setAttendanceMode('category_exclusivity');
      }
    } else if (draft.attendanceMode === 'membership_meeting') {
      setAttendanceMode('membership_meeting');
      if (Array.isArray(draft.tiers) && draft.tiers.length) prefillMembersOnlyTicket(draft.tiers);
    } else if (draft.attendanceMode === 'guest_programme') {
      setAttendanceMode(
        draft.membersOnlyEvent || ticketsAreMembersOnlyEvent(draft.tiers || [])
          ? 'membership_meeting'
          : 'guest_programme'
      );
      if (Array.isArray(draft.tiers) && draft.tiers.length) {
        if (isMembershipMeetingMode()) prefillMembersOnlyTicket(draft.tiers);
        else prefillTiers(draft.tiers);
      }
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
    if (draft.maxAttendees !== undefined) {
      prefillEventCapacity({ maxAttendees: draft.maxAttendees });
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
    openAttendeeExtrasIfNeeded();
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
      title: 'Add bank details before publishing paid tickets',
      lead:
        'You can set prices now, but Confirm & publish stays blocked until Stripe has your UK bank details. Free events do not need bank details.',
      singleGroupOnly: true,
      onLinked: handlePaymentSetupLinked,
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

  async function handlePaymentSetupLinked(status) {
    await loadPaymentSetupState({ bypassCache: true });
    if (status && status.ready === false) {
      showAlert(
        status.incompleteHint ||
          'Bank details were linked, but Stripe still needs a few steps. Click Add bank details to finish.',
        'warn'
      );
    } else {
      showAlert('Bank details linked — you can publish paid tickets now.', 'ok');
    }
    updatePublishButton();
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
      await loadPaymentSetupState({ bypassCache: true });
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

  async function loadPaymentSetupState(options) {
    if (!window.HubOrganiserPaymentSetup) {
      paymentSetupState = null;
      return;
    }
    paymentSetupState = await window.HubOrganiserPaymentSetup.fetchState(options || {});
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

  function ticketsSetupReadyForReview(tiers) {
    if (!payHowConfirmed) return false;
    try {
      if (isExistingPublicListing()) {
        return ticketPersistBlockers(tiers).length === 0;
      }
      const list = tiers || collectActiveTiers();
      return getPublishBlockers(list, { includeBankDetails: false }).length === 0;
    } catch {
      return false;
    }
  }

  function syncContinueToReviewVisibility(tiers) {
    const btn = document.getElementById('ee-tickets-submit');
    const nextSteps = document.getElementById('ee-tickets-next-steps');
    const ready = ticketsSetupReadyForReview(tiers);
    if (btn) btn.hidden = !ready;
    if (nextSteps && !ready) nextSteps.hidden = true;
  }

  function updatePublishButton() {
    const btn = document.getElementById('ee-tickets-submit');
    const warn = document.getElementById('ee-publish-warn');
    if (!btn) return;
    if (ticketsLocked) {
      btn.disabled = true;
      btn.hidden = false;
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
      const liveListing = isExistingPublicListing();
      const blockers = liveListing
        ? ticketPersistBlockers(tiers)
        : getPublishBlockers(tiers);
      const bankPending = !liveListing && needsBankDetailsSetup(tiers);
      btn.disabled = false;
      btn.textContent = liveListing ? 'Save tickets' : 'Continue to review →';
      syncContinueToReviewVisibility(tiers);
      refreshPaymentSetupCard(tiers);
      if (warn) {
        if (!blockers.length && !bankPending) {
          warn.hidden = true;
          warn.textContent = '';
        } else {
          warn.hidden = false;
          const parts = [];
          if (blockers.length) {
            parts.push(
              liveListing
                ? 'Before tickets can be saved: ' + blockers.join('; ') + '.'
                : 'Before this event can go live: ' + blockers.join('; ') + '.'
            );
          }
          if (bankPending && !blockers.some((b) => /bank details/i.test(b))) {
            parts.push(
              'Add bank details before you publish paid tickets — use Add bank details above, then continue to review.'
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
      syncContinueToReviewVisibility();
      if (warn) {
        warn.hidden = false;
        warn.textContent =
          'Finish ticket types below, then click Continue to review again.';
      }
    }
    syncTicketsNextSteps();
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
    /* Previous Attendees removed from ticket setup. */
  }

  function collectAlumniFastPass() {
    return { enabled: false };
  }

  function prefillAlumniFastPass() {
    /* no-op — Previous Attendees removed from ticket setup */
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
    const priceNum = Number(ticket.price);
    const hasPaidTicket = Number.isFinite(priceNum) && priceNum > 0;
    attendanceDoor = 'application';
    if (hasPaidTicket && payHowIncludesMembership()) setPayHow('both');
    else if (hasPaidTicket) setPayHow('tickets');
    else setPayHow(payHowIncludesMembership() ? 'membership' : 'membership');
    const priceEl = document.getElementById('ee-ce-price');
    if (priceEl) {
      priceEl.value = hasPaidTicket ? String(ticket.price) : '0';
    }
    const placesEl = document.getElementById('ee-ce-places');
    if (placesEl) {
      const qtyNorm = normalizeTicketQuantity(ticket.quantityAvailable);
      placesEl.value = qtyNorm == null ? '' : String(qtyNorm);
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
    syncPayHowUi();
    existingTicketsLoaded = true;
  }

  function applyPayHowFromLoadedEvent(eventRow, tickets) {
    const mode = String(eventRow?.attendanceMode || '').trim();
    const hasGuest = (tickets || []).some(isGuestVisitTicket);
    const membersOnly = ticketsAreMembersOnlyEvent(tickets || []);
    const ceTier = (tickets || []).find(function (t) {
      return t && (t.categoryExclusivity || /application/i.test(String(t.ticketType || '')));
    });
    const cePaid = Number(ceTier?.price) > 0;
    const publicTiers = (tickets || []).filter(function (t) {
      return (
        t &&
        !isGuestVisitTicket(t) &&
        !isAlumniTicket(t) &&
        String(t.visibility || '').toLowerCase() !== 'members_only' &&
        !t.categoryExclusivity
      );
    });
    const hasPublic = publicTiers.length > 0;
    const hasMembersOnlyTier = (tickets || []).some(isMembersOnlyTicket);

    if (mode === 'category_exclusivity') {
      attendanceDoor = 'application';
      if (cePaid && (hubMembershipEnabled() || hasMembersOnlyTier)) setPayHow('both');
      else if (cePaid) setPayHow('tickets');
      else setPayHow('membership');
    } else if (mode === 'membership_meeting' || (membersOnly && hasGuest)) {
      attendanceDoor = 'general';
      setPayHow('membership');
    } else if (membersOnly) {
      attendanceDoor = 'general';
      setPayHow('membership');
    } else if (hasPublic && (hubMembershipEnabled() || hasMembersOnlyTier)) {
      attendanceDoor = 'general';
      setPayHow(hasMembersOnlyTier || hubMembershipEnabled() ? 'both' : 'tickets');
    } else {
      attendanceDoor = 'general';
      setPayHow('tickets');
    }
    syncPayHowUi();
  }

  function collectCategoryExclusivityTiers() {
    const chargeTicket = ceChargeTicketEnabled();
    const priceRaw = document.getElementById('ee-ce-price')?.value;
    const price = chargeTicket ? (priceRaw === '' || priceRaw == null ? 0 : priceRaw) : 0;
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
    if (!chargeTicket) {
      description += ' No event ticket charge after approval.';
    }
    if (places) description += ' Max approved places: ' + places + '.';
    if (saleOption && saleOption !== 'custom') {
      description += ' Applications close: ' + saleEndLabel(saleOption) + '.';
    } else if (saleEnd) {
      description += ' Applications close: ' + formatCloseLabel(saleEnd) + '.';
    }
    const ceTier = {
      name: 'Application to attend',
      price: price === '' ? 0 : price,
      description,
      status: 'Available',
      quantityAvailable: normalizeTicketQuantity(places),
      saleEnd,
      saleEndOption: saleOption,
      saleEndCustom: customDt,
      categoryExclusivity: true,
      ticketType: 'Application-based',
      visibility: 'public',
      displayOrder: 0,
    };
    const tiers = [ceTier];
    const memberTier = collectCeMemberTicket(ceTier);
    if (memberTier) tiers.push(memberTier);
    return tiers;
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

  function bindAttendanceStep1Ui() {
    const generalBtn = document.getElementById('ee-mode-tickets');
    const applicationBtn = document.getElementById('ee-mode-category-exclusivity');
    const continueBtn = document.getElementById('ee-attendance-continue');
    const payHowContinueBtn = document.getElementById('ee-pay-how-continue');
    const firstBind = !continueBtn?.dataset.boundAttendanceContinue;
    if (generalBtn && !generalBtn.dataset.boundAttendanceDoor) {
      generalBtn.dataset.boundAttendanceDoor = '1';
      generalBtn.addEventListener('click', () => {
        setAttendanceDoor('general');
        updatePublishButton();
      });
    }
    if (applicationBtn && !applicationBtn.dataset.boundAttendanceDoor) {
      applicationBtn.dataset.boundAttendanceDoor = '1';
      applicationBtn.addEventListener('click', () => {
        setAttendanceDoor('application');
        updatePublishButton();
      });
    }
    if (continueBtn && !continueBtn.dataset.boundAttendanceContinue) {
      continueBtn.dataset.boundAttendanceContinue = '1';
      continueBtn.addEventListener('click', () => {
        confirmStep1AndRevealSteps();
      });
    }
    if (payHowContinueBtn && !payHowContinueBtn.dataset.boundPayHowContinue) {
      payHowContinueBtn.dataset.boundPayHowContinue = '1';
      payHowContinueBtn.addEventListener('click', () => {
        confirmPayHowAndRevealRest();
      });
    }
    bindPayHowFields();
    if (firstBind) hideLaterTicketSteps();
    syncPayHowStepUi();
    syncAttendanceStepUi();
  }

  async function init() {
    loadSeriesMeta();
    bindGuestPassesFields();
    bindAttendanceStep1Ui();
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

    const bookingOptionsLink = document.getElementById('ee-booking-options-link');
    if (bookingOptionsLink && eventIds.length) {
      bookingOptionsLink.href =
        '/organiser/booking-options?ids=' + encodeURIComponent(eventIds.join(','));
    }

    const loading = window.organiserPageLoading;
    const bootWork = async () => {
      // Start secondary fetches immediately so they overlap primary tickets/event load.
      const earlyGroupId = String(seriesMeta.organiserGroupId || '').trim();
      const paymentPromise = loadPaymentSetupState();
      const guestPromise = earlyGroupId
        ? loadOrganiserGuestVisitSetting(earlyGroupId)
        : Promise.resolve();

      const loaded = await loadExistingData();
      if (loaded.authFailed) {
        await Promise.allSettled([paymentPromise, guestPromise]);
        return loaded;
      }

      if (loaded.event) {
        seedSeriesMetaFromLoadedEvent(loaded.event);
      }

      await expandSeriesEventIds(loaded.event);
      await hydrateSeriesEvents(loaded.event);

      // Do not block first paint on payment/roster — refresh UI when they finish.
      const secondary = [paymentPromise, guestPromise];
      const lateGroupId = String(seriesMeta.organiserGroupId || '').trim();
      if (lateGroupId && lateGroupId !== earlyGroupId) {
        secondary.push(loadOrganiserGuestVisitSetting(lateGroupId));
      }
      if (loaded.tickets && ticketsAreMembersOnlyEvent(loaded.tickets)) {
        secondary.push(loadMemberRosterStatus());
      }
      Promise.allSettled(secondary).then(function () {
        try {
          syncGuestProgrammeNote();
          updatePublishButton();
        } catch {
          /* ignore */
        }
      });

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

    if (!loaded.event && eventIds.length && !loaded.notOwned) {
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
      if (loaded.event.attendanceMode === 'membership_meeting') {
        setAttendanceMode('membership_meeting');
      } else if (loaded.event.attendanceMode === 'guest_programme') {
        setAttendanceMode(
          ticketsAreMembersOnlyEvent(loaded.tickets) ? 'membership_meeting' : 'guest_programme'
        );
      } else if (loaded.event.attendanceMode === 'category_exclusivity') {
        setAttendanceMode('category_exclusivity');
      }
      prefillGuestPassesDisabled(loaded.event);
      prefillEventCapacity(loaded.event);
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
      if (
        loaded.event &&
        (loaded.event.attendanceMode === 'membership_meeting' ||
          (loaded.event.attendanceMode === 'guest_programme' &&
            ticketsAreMembersOnlyEvent(loaded.tickets)))
      ) {
        setAttendanceMode('membership_meeting');
        prefillMembersOnlyTicket(loaded.tickets);
        prefillGuestPassesDisabled(loaded.event);
      } else if (loaded.event && loaded.event.attendanceMode === 'guest_programme') {
        setAttendanceMode('guest_programme');
        prefillTiers(memberTickets);
        prefillMembersOnlyTicket(loaded.tickets);
        prefillGuestPassesDisabled(loaded.event);
      } else if (categoryExclusivityTicket) {
        prefillCategoryExclusivityFromTicket(categoryExclusivityTicket);
        prefillCeMemberTicket(loaded.tickets);
        prefillCeGuestVisits(loaded.event, loaded.tickets);
        setAttendanceMode('category_exclusivity');
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
      // Keep free trial visits opt-in for new General ticketing events.
    }

    if (loaded.event) {
      applyPayHowFromLoadedEvent(loaded.event, loaded.tickets || []);
    }

    document.getElementById('ee-add-tier').addEventListener('click', () => addTierRow({ useDefaultName: false }));
    document.getElementById('ee-switch-complimentary-visits')?.addEventListener('click', function () {
      confirmComplimentaryVisitSwitch().then(function (ok) {
        if (ok) convertFreePublicTicketsToComplimentaryVisits();
      });
    });
    bindAttendanceStep1Ui();
    parkStep2Panels();
    if (loaded.tickets && loaded.tickets.length) {
      step2Confirmed = true;
      payHowConfirmed = true;
      revealPostStep2();
    } else {
      hideLaterTicketSteps();
      syncPayHowStepUi();
      syncAttendanceStepUi();
    }
    bindPrivateTicketFields();
    bindMembersOnlyEventToggle();
    document.getElementById('ee-guest-programme-enabled')?.addEventListener('change', () => {
      const toggle = document.getElementById('ee-guest-programme-enabled');
      if (toggle) toggle.dataset.userToggled = '1';
      if (isMembershipOnlyPayHow()) {
        if (guestProgrammeEnabled()) {
          setMembersOnlyEventEnabled(false);
          setAttendanceMode('membership_meeting');
        } else {
          // Unticked visits on membership-only → closed meeting (no public ticket).
          setMembersOnlyEventEnabled(true);
          setAttendanceMode('tickets');
        }
        updatePublishButton();
        return;
      }
      if (document.getElementById('ee-guest-programme-enabled')?.checked) {
        setMembersOnlyEventEnabled(false);
      }
      if (attendanceDoor === 'application') {
        setAttendanceMode('category_exclusivity');
        updatePublishButton();
        return;
      }
      setAttendanceMode(resolveModeFromDoorAndPayHow());
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
        syncGuestProgrammeNote();
        syncMembershipVisitsSummary();
        syncPayHowStepUi();
        updatePublishButton();
      });
      guestVisitsEl.addEventListener('change', () => {
        guestVisitsEl.dataset.touched = '1';
        const n = Math.floor(Number(guestVisitsEl.value));
        if (!Number.isFinite(n) || n < 1) guestVisitsEl.value = '1';
        else if (n > 3) guestVisitsEl.value = '3';
        syncGuestProgrammeNote();
        syncMembershipVisitsSummary();
        syncPayHowStepUi();
        updatePublishButton();
      });
    }
    document.querySelectorAll('input[name="ee-visits-scope"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        const scopeWrap = document.getElementById('ee-visits-scope-wrap');
        if (scopeWrap) scopeWrap.dataset.userScoped = '1';
        organiserComplimentaryVisitsScope = readGuestVisitsScope();
        syncGuestProgrammeNote();
        syncMembershipVisitsSummary();
        syncPayHowStepUi();
        updatePublishButton();
      });
    });
    syncGuestProgrammeNote();
    bindRefundPolicy();
    bindAlumniFastPassFields();
    bindCategoryExclusivityCloseFields();
    bindCeMemberTicketFields();
    bindPayHowFields();
    bindHubMembershipFields();
    document.getElementById('ee-ce-price')?.addEventListener('input', updatePublishButton);
    document.getElementById('ee-ce-price')?.addEventListener('change', updatePublishButton);
    syncPayHowUi();
    if (!selectedRefundPolicy && !document.querySelector('input[name="refund-policy"]:checked')) {
      const defaultRadio = document.getElementById('refund-policy-standard');
      if (defaultRadio) selectRefundCard(defaultRadio);
    }
    bindVatOptions();
    syncMembersOnlyEventMode();
    syncEventCapacityCard();
    updatePublishButton();
    captureSavedTicketsSnapshot(collectActiveTiers());
    if (loaded.tickets.length && !restoredDraft) {
      lastPersistedTicketSignature = ticketsChangeSignature(collectActiveTiers());
    }

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
      confirmStep1AndRevealSteps();
      showAlert('Choose how people get in, then tickets or membership, then continue.', 'warn');
      return;
    }
    if (!payHowConfirmed) {
      if (step2HasUsableTiers()) {
        payHowConfirmed = true;
        revealPostStep2();
      } else {
        revealPayHowStep();
        showAlert('Choose tickets or membership, then continue to ticket types.', 'warn');
        document.getElementById('ee-panel-pay-how')?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
        return;
      }
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
    const persistBlockers = isExistingPublicListing()
      ? ticketPersistBlockers(tiers)
      : getPublishBlockers(tiers, { includeBankDetails: false });
    if (persistBlockers.length) {
      showAlert(
        isExistingPublicListing()
          ? 'Before tickets can be saved: ' + persistBlockers.join('; ') + '.'
          : 'Before this event can go live: ' + persistBlockers.join('; ') + '.',
        'warn'
      );
      const warn = document.getElementById('ee-publish-warn');
      if (warn) {
        warn.hidden = false;
        warn.textContent = isExistingPublicListing()
          ? 'Before tickets can be saved: ' + persistBlockers.join('; ') + '.'
          : 'Before this event can go live: ' + persistBlockers.join('; ') + '.';
      }
      updatePublishButton();
      return;
    }

    if (usesGuestVisitProgramme()) {
      const visits = readGuestVisitsAllowed();
      if (visits < 1) {
        showAlert('Enter how many free trial visits a visitor can take (1–3).', 'warn');
        document.getElementById('ee-guest-visits-allowed')?.focus();
        updatePublishButton();
        return;
      }
    }

    if (hubMembershipEnabled() && !hubMembershipHasPrice()) {
      showAlert(
        'Membership must be blank/£0 (free via member list) or at least £1 for platform billing.',
        'warn'
      );
      document.getElementById('ee-hub-membership-monthly')?.focus();
      updatePublishButton();
      return;
    }

    if (needsBankDetailsSetup(tiers)) {
      showAlert(
        'Add bank details before you can publish paid tickets. You can continue to review now, but Confirm & publish will stay blocked until Stripe setup is finished — use Add bank details on this page or on the next step.',
        'warn'
      );
      document.getElementById('ee-payment-setup-mount')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }

    await saveTickets(false, { redirectToReview: !isExistingPublicListing() });
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
    if (publicFreeTicketIsFirstVisitStandIn(tiers)) {
      const ok = await confirmComplimentaryVisitSwitch();
      if (ok) {
        convertFreePublicTicketsToComplimentaryVisits();
        updatePublishButton();
        return;
      }
      showAlert(
        'Rename that first-visit ticket, or switch it to complimentary visits. You can still keep a free ticket and a paid ticket.',
        'warn'
      );
      updatePublishButton();
      return;
    }
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
      if (usesGuestVisitProgramme()) {
        const visits = readGuestVisitsAllowed();
        if (visits < 1) {
          showAlert('Enter how many free trial visits a visitor can take (1–3).', 'warn');
          document.getElementById('ee-guest-visits-allowed')?.focus();
          updatePublishButton();
          return;
        }
      }
    }

    if (!publish && lastPersistedTicketSignature && !ticketsChangedFromSnapshot(tiers)) {
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
      // Tickets unchanged — only persist membership fees if needed (avoids rewriting every series date).
      if (hubMembershipEnabled()) {
        try {
          const membershipSaved = await saveHubMembershipPlanIfNeeded();
          if (!membershipSaved.ok) {
            showAlert(membershipSaved.message || 'Could not save membership prices.', 'warn');
            return;
          }
        } catch (err) {
          console.error(err);
          showAlert('Could not save membership prices. Check your connection and try again.', 'warn');
          return;
        }
      }
      showAlert(
        isExistingPublicListing()
          ? 'Tickets are already saved on this listing.'
          : 'Tickets saved as draft. Your event is not on Browse events yet — finish ticket setup below, then click Continue to review.',
        'ok'
      );
      notifyEmbedDrawerReady();
      return;
    }

    // Confirm overwrite only when ticket setup changed since last save/load.
    if (existingTicketsLoaded && ticketsChangedFromSnapshot(tiers)) {
      const proceed = await confirmApplyTicketsToSeries();
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

    const reenableSaveButtons = function () {
      if (saveBtn) saveBtn.disabled = false;
      updatePublishButton();
    };

    try {
    if (usesGuestVisitProgramme()) {
      const visits = readGuestVisitsAllowed();
      if (visits < 1) {
        showAlert('Enter how many free trial visits a visitor can take (1–3).', 'warn');
        reenableSaveButtons();
        return;
      }
      const groupId = seriesMeta.organiserGroupId;
      if (!groupId) {
        showAlert('Choose an organiser page before enabling the guest visit programme.', 'warn');
        reenableSaveButtons();
        return;
      }
      if (visits !== organiserComplimentaryVisits || readGuestVisitsScope() !== organiserComplimentaryVisitsScope) {
        const saved = await saveOrganiserGuestVisitsAllowed(groupId, visits, readGuestVisitsScope());
        if (!saved.ok) {
          showAlert(saved.message || 'Could not save free trial visit allowance.', 'warn');
          reenableSaveButtons();
          return;
        }
      }
    }

    const body = {
      eventIds,
      tickets: tiers,
      publish,
      attendanceMode,
      maxAttendees: collectEventCapacity(),
      guestPassesDisabled:
        usesGuestVisitProgramme()
          ? collectGuestPassesDisabled()
          : false,
      enableGuestVisits: ceGuestVisitsEnabled(),
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

    // Membership plan + ticket rewrite in parallel (membership was a serial wait before).
    const membershipPromise = hubMembershipEnabled()
      ? saveHubMembershipPlanIfNeeded().catch(function (membershipErr) {
          console.error(membershipErr);
          return {
            ok: false,
            message: 'Could not save membership prices. Check your connection and try again.',
          };
        })
      : Promise.resolve({ ok: true });

    let result;
    let membershipSaved = { ok: true };
    try {
      if (loading && loading.run) {
        const pair = await loading.run(
          busyMessage,
          function () {
            return Promise.all([membershipPromise, saveWork()]);
          },
          publish ? { progressStep: 'publish' } : null
        );
        membershipSaved = pair[0];
        result = pair[1];
      } else {
        if (loading) loading.show(busyMessage);
        const pair = await Promise.all([membershipPromise, saveWork()]);
        membershipSaved = pair[0];
        result = pair[1];
        if (loading) loading.hide();
      }
    } catch (err) {
      console.error(err);
      if (loading) loading.hide();
      showAlert('Could not save tickets. Check your connection and try again.', 'warn');
      return;
    } finally {
      reenableSaveButtons();
    }

    if (!membershipSaved.ok) {
      showAlert(membershipSaved.message || 'Could not save membership prices.', 'warn');
      return;
    }

    if (!result) {
      showAlert('Could not save tickets. Check your connection and try again.', 'warn');
      return;
    }

    const ok = result.ok;
    const data = result.data;

    if (!ok) {
      if (data.error === 'use_complimentary_visits') {
        showAlert(
          data.message ||
            'A first-visit ticket should be complimentary visits. You can still keep a free ticket and a paid ticket.',
          'warn'
        );
        return;
      }
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
    lastPersistedTicketSignature = ticketsChangeSignature(tiers);

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
        markNeedsMembersOnSeriesMeta();
        location.href = reviewPageUrl();
        return;
      }
      showAlert(
        isExistingPublicListing()
          ? 'Tickets saved on this listing.'
          : 'Tickets saved as draft. Your event is not on Browse events yet — finish ticket setup below, then click Continue to review.',
        'ok'
      );
      notifyEmbedDrawerReady();
      if (tiersHavePaidPrice(collectActiveTiers())) {
        document.getElementById('ee-vat-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      return;
    }

    showAlert(
      salesScheduled
        ? 'Your event is live on the platform. Ticket sales will open on the date you set — saved attendees will be emailed when sales begin.'
        : 'Your event is live on the platform and ticket sales are on.',
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
    persistPublishedPreview();
    const publishedQs = new URLSearchParams();
    publishedQs.set('ids', eventIds.join(','));
    publishedQs.set('published', '1');
    if (publishedTitle) publishedQs.set('title', publishedTitle);
    if (buildPublishedPreviewPayload().needsMembers) publishedQs.set('needsMembers', '1');
    const groupId = String(seriesMeta.organiserGroupId || '').trim();
    if (groupId) publishedQs.set('groupId', groupId);
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
          needsMembers: buildPublishedPreviewPayload().needsMembers,
          organiserGroupId: String(seriesMeta.organiserGroupId || '').trim(),
          launchSetup: Boolean(seriesMeta && seriesMeta.launchSetup),
          familyKey:
            (seriesMeta && seriesMeta.familyKey) ||
            (seriesMeta && seriesMeta.seriesGroupId
              ? 'sg:' + seriesMeta.seriesGroupId
              : eventIds[0]
                ? 'ev:' + eventIds[0]
                : ''),
        },
        window.location.origin
      );
      return;
    }

    location.href = publishedUrl;
    } catch (saveErr) {
      console.error(saveErr);
      if (loading) loading.hide();
      showAlert('Could not save tickets. Check your connection and try again.', 'warn');
    } finally {
      reenableSaveButtons();
    }
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
