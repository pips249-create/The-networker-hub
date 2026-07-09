/**
 * Full-page event editor — recurring dates + ticket setup flow.
 */
(function () {
  const DESCRIPTION_MAX_WORDS = 500;
  const SERIES_STORAGE_KEY = 'hub_event_series';
  const FORMAT_STORAGE_KEY = 'hub_event_format';
  const GROUP_STORAGE_KEY = 'hub_event_group_id';
  const ORG_BOOTSTRAP_CACHE_KEY = 'hub_org_bootstrap_cache';
  const ORG_BOOTSTRAP_CACHE_MS = 120000;
  const params = new URLSearchParams(location.search);
  const editId = params.get('id') || '';
  const isEmbedDrawer = params.get('embed') === '1' || window.self !== window.top;

  if (isEmbedDrawer) {
    document.documentElement.classList.add('ee-embed-drawer-root');
    if (document.body) document.body.classList.add('ee-embed-drawer');
  } else if (!editId && document.body) {
    document.body.classList.add('ee-is-new-listing');
  }
  function normalizeEventFormat(raw) {
    const s = String(raw || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-');
    if (s === 'inperson' || s === 'in-person' || s === 'in_person') return 'in-person';
    if (s === 'online' || s === 'virtual') return 'online';
    if (s === 'hybrid') return 'in-person';
    return s || '';
  }

  let eventFormat = normalizeEventFormat(
    params.get('format') || sessionStorage.getItem(FORMAT_STORAGE_KEY) || ''
  );

  const FORMAT_LABELS = {
    'in-person': 'In person',
    online: 'Online',
  };

  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();
  const selectedDates = new Set();
  let photoFile = null;
  let groups = [];
  let currentEventLocked = false;
  let currentSeriesPeerCount = 0;
  let currentSeriesDateOnly = false;
  let currentSeriesContext = null;

  function countWords(text) {
    return String(text || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  function bindWordCounter() {
    const ta = document.getElementById('ee-description');
    const counter = document.getElementById('ee-word-count');
    const maxEl = document.getElementById('ee-word-max');
    if (maxEl) maxEl.textContent = String(DESCRIPTION_MAX_WORDS);
    if (!ta || !counter) return;
    const update = () => {
      counter.textContent = String(countWords(ta.value));
    };
    ta.addEventListener('input', update);
    update();
  }

  function showEventStatusBadge(ev) {
    const badge = document.getElementById('ee-status-badge');
    if (!badge) return;
    const status = String(ev.status || ev.listingStatus || 'draft').toLowerCase();
    let label = 'Draft';
    let cls = 'is-draft';
    if (status === 'cancelled') {
      label = 'Cancelled';
      cls = 'is-cancelled';
    } else if (status === 'published' || ev.approvalStatus === 'Approved') {
      label = 'Published';
      cls = 'is-published';
    }
    badge.textContent = label;
    badge.className = 'ee-status-badge ' + cls;
    badge.hidden = false;
    return label;
  }

  function formatGbpAmount(n) {
    const num = Number(n) || 0;
    return '£' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function formatTicketsSoldLabel(sold, capacity) {
    const s = Number(sold) || 0;
    const c = Number(capacity) || 0;
    if (c > 0) return s + ' / ' + c;
    return String(s);
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

  function eventIsPublishedListing(ev) {
    if (!ev) return false;
    const st = String(ev.status || '').toLowerCase();
    const key = String(ev.statusKey || '').toLowerCase();
    if (st === 'cancelled' || key === 'cancelled') return false;
    const approval = String(ev.approvalStatus || '').toLowerCase();
    return (
      st === 'published' ||
      approval === 'approved' ||
      key === 'live' ||
      key === 'upcoming' ||
      key === 'pending_approval' ||
      key === 'archived'
    );
  }

  function eventCanCancelListing(ev) {
    if (!ev || !ev.id) return false;
    const st = String(ev.status || '').toLowerCase();
    const key = String(ev.statusKey || '').toLowerCase();
    if (st === 'cancelled' || key === 'cancelled') return false;
    if (eventTicketsSoldCount(ev) > 0) return true;
    return Boolean(ev.locked) && eventIsPublishedListing(ev);
  }

  function shouldShowEventOverviewStats(ev) {
    if (!editId || !ev || !ev.id) return false;
    const sold = eventTicketsSoldCount(ev);
    if (sold > 0) return true;
    const st = String(ev.status || '').toLowerCase();
    const key = String(ev.statusKey || '').toLowerCase();
    if (st === 'published' || String(ev.approvalStatus || '').trim() === 'Approved') {
      return true;
    }
    return key === 'live' || key === 'upcoming' || key === 'pending_approval';
  }

  function updateEventCancelUi(ev) {
    const cancelRow = document.getElementById('ee-cancel-row');
    const cancelBtn = document.getElementById('ee-cancel-event-btn');
    if (!cancelRow || !cancelBtn) return;
    const canCancel = eventCanCancelListing(ev);
    const sold = eventTicketsSoldCount(ev);
    cancelRow.hidden = !canCancel;
    if (canCancel) {
      cancelBtn.textContent =
        sold > 0 ? 'Cancel this event (' + sold + ' tickets sold)' : 'Cancel this event';
    }
  }

  function renderEventOverviewStats(ev) {
    const wrap = document.getElementById('ee-event-stats');
    if (!wrap) return;
    if (isEmbedDrawer) {
      wrap.hidden = true;
      const cancelRow = document.getElementById('ee-cancel-row');
      if (cancelRow) cancelRow.hidden = true;
      return;
    }
    updateEventCancelUi(ev);
    if (!shouldShowEventOverviewStats(ev)) {
      wrap.hidden = true;
      return;
    }
    const ticketsEl = document.getElementById('ee-stat-tickets');
    const revenueEl = document.getElementById('ee-stat-revenue');
    const statusEl = document.getElementById('ee-stat-status');
    const sold = eventTicketsSoldCount(ev);
    const capacity = Number(ev.ticketsCapacity) || 0;
    if (ticketsEl) {
      ticketsEl.textContent =
        ev.ticketsSoldLabel || formatTicketsSoldLabel(sold, capacity);
    }
    if (revenueEl) {
      revenueEl.textContent =
        ev.revenueDisplay || formatGbpAmount(ev.revenueNum != null ? ev.revenueNum : 0);
    }
    if (statusEl) {
      const st = String(ev.status || '').toLowerCase();
      statusEl.textContent =
        ev.statusLabel ||
        (st === 'cancelled'
          ? 'Cancelled'
          : st === 'published' || ev.approvalStatus === 'Approved'
            ? 'Published'
            : 'Draft');
    }
    wrap.hidden = false;
  }

  function requestEventCancellation() {
    if (!editId) return;
    if (isEmbedDrawer && window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: 'hub-event-cancel-request', eventId: editId },
        window.location.origin
      );
      return;
    }
    location.href = 'index.html#events-list';
  }

  function applyLockUi(locked) {
    currentEventLocked = Boolean(locked);
    const banner = document.getElementById('ee-lock-banner');
    if (banner) banner.hidden = !currentEventLocked;

    const lockSelectors = ['#ee-type', '#ee-start-time', '#ee-end-time', '#ee-postcode'];
    lockSelectors.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) {
        el.disabled = currentEventLocked;
        const field = el.closest('.ee-field');
        if (field) field.classList.toggle('is-locked', currentEventLocked);
      }
    });
    const datesCard = document.getElementById('ee-card-dates');
    if (datesCard) datesCard.classList.toggle('is-locked', currentEventLocked);
    refreshSeriesEditUi();
  }

  const SERIES_SHARED_FIELD_SELECTORS = [
    '#ee-group',
    '#ee-title',
    '#ee-type',
    '#ee-description',
    '#ee-venue',
    '#ee-address1',
    '#ee-city',
    '#ee-postcode',
    '#ee-platform',
    '#ee-join-link',
    '#ee-photo-url',
    '#ee-start-time',
    '#ee-end-time',
  ];

  const SERIES_SHARED_CARD_IDS = ['ee-card-group', 'ee-card-details', 'ee-card-location'];

  function pickPrimarySeriesEvent(peers) {
    const sorted = sortEventsByDate(peers);
    const now = Date.now();
    const upcoming = sorted.find((ev) => {
      if (!ev.date) return false;
      const d = new Date(ev.date).getTime();
      return !Number.isNaN(d) && d >= now - 86400000;
    });
    return upcoming || sorted[0];
  }

  function resolveSeriesEditScope(peers, ev) {
    if (!peers || peers.length <= 1 || !ev || !ev.id) {
      return { isSeries: false, dateOnly: false, peerCount: 0 };
    }
    if (params.get('seriesEdit') === '1') {
      return { isSeries: true, dateOnly: false, peerCount: peers.length };
    }
    if (params.get('seriesDate') === '1') {
      return { isSeries: true, dateOnly: true, peerCount: peers.length };
    }
    const primary = pickPrimarySeriesEvent(peers);
    return {
      isSeries: true,
      dateOnly: ev.id !== primary.id,
      peerCount: peers.length,
    };
  }

  function setSeriesFieldLocked(el, locked) {
    if (!el) return;
    el.disabled = locked;
    const field = el.closest('.ee-field');
    if (field) field.classList.toggle('is-locked', locked);
  }

  function refreshSeriesEditUi() {
    const ctx = currentSeriesContext;
    if (!ctx || !ctx.peers || !ctx.ev) {
      currentSeriesPeerCount = 0;
      currentSeriesDateOnly = false;
      const seriesBanner = document.getElementById('ee-series-banner');
      if (seriesBanner) seriesBanner.hidden = true;
      SERIES_SHARED_CARD_IDS.forEach((id) => {
        const card = document.getElementById(id);
        if (card) card.classList.remove('is-series-locked');
      });
      if (!currentEventLocked) {
        SERIES_SHARED_FIELD_SELECTORS.forEach((sel) => {
          setSeriesFieldLocked(document.querySelector(sel), false);
        });
      }
      return;
    }

    const scope = resolveSeriesEditScope(ctx.peers, ctx.ev);
    currentSeriesPeerCount = scope.peerCount;
    currentSeriesDateOnly = scope.isSeries && scope.dateOnly;
    const lockShared = currentSeriesDateOnly && !currentEventLocked;

    const seriesBanner = document.getElementById('ee-series-banner');
    if (seriesBanner) {
      if (!scope.isSeries) {
        seriesBanner.hidden = true;
      } else {
        seriesBanner.hidden = false;
        if (currentSeriesDateOnly) {
          seriesBanner.innerHTML =
            'This date is part of a <strong>' +
            scope.peerCount +
            '-date series</strong>. You can add or remove dates on the calendar below. To change the title, location, times, or description, open <strong>Edit event</strong> on the main series row in My Events.';
        } else {
          seriesBanner.innerHTML =
            'This listing has <strong>' +
            scope.peerCount +
            ' dates</strong>. Title, location, times, and description apply to <strong>every date</strong> in the series.';
        }
      }
    }

    const pageTitle = document.getElementById('ee-page-title');
    const pageLead = document.getElementById('ee-page-lead');
    if (scope.isSeries && currentSeriesDateOnly) {
      if (pageTitle) pageTitle.textContent = 'Edit date in series';
      if (pageLead) {
        pageLead.textContent =
          'Add or remove dates on the calendar. Shared details are managed from the main series row in My Events.';
      }
    }

    SERIES_SHARED_CARD_IDS.forEach((id) => {
      const card = document.getElementById(id);
      if (card) card.classList.toggle('is-series-locked', lockShared);
    });

    SERIES_SHARED_FIELD_SELECTORS.forEach((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      if (currentEventLocked) return;
      setSeriesFieldLocked(el, lockShared);
    });

    document.querySelectorAll('[data-ee-format]').forEach((btn) => {
      btn.disabled = lockShared || currentEventLocked;
    });

    ['#ee-copy-title-from-group', '#ee-copy-desc-from-group'].forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.disabled = lockShared || currentEventLocked;
    });

    const photoZone = document.getElementById('ee-photo-zone');
    const photoFileInput = document.getElementById('ee-photo-file');
    const photoClear = document.getElementById('ee-photo-clear');
    if (photoZone) photoZone.classList.toggle('is-locked', lockShared || currentEventLocked);
    if (photoFileInput) photoFileInput.disabled = lockShared || currentEventLocked;
    if (photoClear) photoClear.disabled = lockShared || currentEventLocked;

    if (lockShared) {
      ['#ee-start-time', '#ee-end-time'].forEach((sel) => {
        setSeriesFieldLocked(document.querySelector(sel), true);
      });
    }
  }

  function applySeriesEditUi(peers, ev) {
    currentSeriesContext =
      peers && peers.length > 1 && ev ? { peers: peers, ev: ev } : null;
    refreshSeriesEditUi();
  }

  function bindFormatToggleButtons() {
    document.querySelectorAll('[data-ee-format]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (currentEventLocked || currentSeriesDateOnly) return;
        const fmt = btn.getAttribute('data-ee-format');
        eventFormat = normalizeEventFormat(fmt);
        document.querySelectorAll('[data-ee-format]').forEach((b) => {
          b.classList.toggle('is-active', b.getAttribute('data-ee-format') === fmt);
        });
        applyFormatUi(eventFormat);
      });
    });
  }

  function syncFormatToggleButtons() {
    document.querySelectorAll('[data-ee-format]').forEach((b) => {
      b.classList.toggle('is-active', normalizeEventFormat(b.getAttribute('data-ee-format')) === eventFormat);
    });
  }

  function daysBetweenDateKeys(a, b) {
    const da = parseDateKey(a);
    const db = parseDateKey(b);
    return Math.round((db.getTime() - da.getTime()) / 86400000);
  }

  function deriveRecurrenceFromDates(keys) {
    if (!keys || keys.length <= 1) {
      return { recurrencePattern: null, recurrenceEndDate: null };
    }
    const sorted = [...keys].sort();
    const end = sorted[sorted.length - 1];
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetweenDateKeys(sorted[i - 1], sorted[i]));
    }
    const allSame = gaps.length && gaps.every((g) => g === gaps[0]);
    if (allSame && gaps[0] === 7) {
      return { recurrencePattern: 'weekly', recurrenceEndDate: end };
    }
    if (allSame && gaps[0] === 14) {
      return { recurrencePattern: 'bi-weekly', recurrenceEndDate: end };
    }
    return { recurrencePattern: 'Series', recurrenceEndDate: end };
  }

  function validateTimes() {
    if (QuarterTime && QuarterTime.validatePair) {
      return QuarterTime.validatePair('ee-start-time', 'ee-end-time');
    }
    const startEl = document.getElementById('ee-start-time');
    const endEl = document.getElementById('ee-end-time');
    const start = startEl ? startEl.value : '';
    const end = endEl ? endEl.value : '';
    if (!start || !end) {
      return { ok: false, message: 'Choose both a start time and an end time.' };
    }
    if (QuarterTime && QuarterTime.timeToMinutes(end) <= QuarterTime.timeToMinutes(start)) {
      return { ok: false, message: 'End time must be after start time.' };
    }
    return { ok: true, start, end };
  }

  function defaultEndFromStart(start) {
    if (!start) return '12:00';
    const mins = (QuarterTime ? QuarterTime.timeToMinutes(start) : 0) + 120;
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return pad2(h) + ':' + pad2(m);
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function showAlert(msg) {
    const el = document.getElementById('ee-alert');
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
  }

  function fieldToString(val) {
    if (val == null || val === '') return '';
    if (Array.isArray(val)) {
      return val
        .map((x) => (typeof x === 'string' ? x : ''))
        .filter(Boolean)
        .join('\n')
        .trim();
    }
    return String(val).trim();
  }

  function parseAirtableDate(raw) {
    if (!raw) return null;
    const d = new Date(String(raw).trim());
    if (!Number.isNaN(d.getTime())) return d;
    return null;
  }

  async function api(path, opts) {
    const res = await fetch(path, {
      credentials: 'include',
      cache: 'no-store',
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

  function readEmbedBootstrapCache() {
    if (!isEmbedDrawer) return null;
    try {
      const raw = sessionStorage.getItem(ORG_BOOTSTRAP_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || Date.now() - Number(parsed.at || 0) > ORG_BOOTSTRAP_CACHE_MS) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  async function loadOrganiserBootstrapData() {
    const cached = readEmbedBootstrapCache();
    if (cached) {
      return { ok: true, data: { groups: cached.groups || [], events: cached.events || [] } };
    }
    return api('/api/organiser/bootstrap');
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function dateKey(y, m, d) {
    return y + '-' + pad2(m + 1) + '-' + pad2(d);
  }

  function parseDateKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDateLabel(key) {
    const d = parseDateKey(key);
    return d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  const QuarterTime = window.OrganiserQuarterTime;

  function formatTime12h(timeStr) {
    if (!timeStr) return '';
    const rounded = QuarterTime ? QuarterTime.roundToQuarterHour(timeStr) : timeStr;
    const parts = rounded.split(':').map(Number);
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    const period = h >= 12 ? 'pm' : 'am';
    const hour12 = h % 12 || 12;
    return hour12 + ':' + pad2(m) + period;
  }

  function formatSelectedDateLine(key) {
    const d = parseDateKey(key);
    const datePart = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const startEl = document.getElementById('ee-start-time');
    const endEl = document.getElementById('ee-end-time');
    const start = startEl ? formatTime12h(startEl.value) : '';
    const end = endEl && endEl.value ? formatTime12h(endEl.value) : '';
    if (!start) return datePart;
    return datePart + ' · ' + start + (end ? ' – ' + end : '');
  }

  function combineDateAndTime(dateKeyStr, timeStr) {
    const [y, m, d] = dateKeyStr.split('-').map(Number);
    const rounded = QuarterTime ? QuarterTime.roundToQuarterHour(timeStr) : timeStr || '10:00';
    const [hh, mm] = rounded.split(':').map(Number);
    const local = new Date(y, m - 1, d, hh || 0, mm || 0, 0);
    return local.toISOString();
  }

  function syncSelectedDatesFromDom() {
    document
      .querySelectorAll('#ee-cal-days .ee-cal-day.is-selected[data-date-key]')
      .forEach((btn) => {
        const key = btn.getAttribute('data-date-key');
        if (key) selectedDates.add(key);
      });
  }

  function getSelectedDateKeys() {
    syncSelectedDatesFromDom();
    return [...selectedDates].sort();
  }

  function buildOccurrences(keys, startTime, endTime) {
    const start = startTime || '10:00';
    const end = endTime || defaultEndFromStart(start);
    return keys.map((key) => ({
      date: combineDateAndTime(key, start),
      endDate: combineDateAndTime(key, end),
    }));
  }

  function renderSelectedList() {
    const list = document.getElementById('ee-date-list');
    const count = document.getElementById('ee-date-count');
    const keys = getSelectedDateKeys();
    if (count) count.textContent = String(keys.length);
    if (!list) return;
    list.innerHTML = keys.map((k) => '<li>' + esc(formatSelectedDateLine(k)) + '</li>').join('');
  }

  function bindTimeListRefresh() {
    const startEl = document.getElementById('ee-start-time');
    const endEl = document.getElementById('ee-end-time');
    [startEl, endEl].forEach((el) => {
      if (!el || el.dataset.dateListBound) return;
      el.dataset.dateListBound = '1';
      el.addEventListener('change', renderSelectedList);
    });
  }

  function renderCalendar() {
    const grid = document.getElementById('ee-cal-days');
    const label = document.getElementById('ee-cal-month-label');
    if (!grid) return;

    const first = new Date(calYear, calMonth, 1);
    const monthName = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    if (label) label.textContent = monthName;

    const startDow = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    grid.innerHTML = '';
    const prevMonthDays = new Date(calYear, calMonth, 0).getDate();

    for (let i = 0; i < startDow; i++) {
      const day = prevMonthDays - startDow + i + 1;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ee-cal-day is-other';
      btn.textContent = String(day);
      btn.disabled = true;
      grid.appendChild(btn);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const key = dateKey(calYear, calMonth, d);
      const cellDate = new Date(calYear, calMonth, d);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ee-cal-day';
      btn.textContent = String(d);
      btn.setAttribute('data-date-key', key);
      if (selectedDates.has(key)) btn.classList.add('is-selected');
      if (cellDate < today) {
        btn.classList.add('is-past');
        btn.disabled = true;
      } else {
        btn.addEventListener('click', () => {
          if (currentEventLocked) return;
          if (selectedDates.has(key)) selectedDates.delete(key);
          else selectedDates.add(key);
          showAlert('');
          renderCalendar();
          renderSelectedList();
        });
      }
      grid.appendChild(btn);
    }

    const totalCells = startDow + daysInMonth;
    const trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= trailing; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ee-cal-day is-other';
      btn.textContent = String(i);
      btn.disabled = true;
      grid.appendChild(btn);
    }
  }

  function bindPhotoUpload() {
    const zone = document.getElementById('ee-photo-zone');
    const fileInput = document.getElementById('ee-photo-file');
    const preview = document.getElementById('ee-photo-preview');
    const previewImg = document.getElementById('ee-photo-preview-img');
    const placeholder = document.getElementById('ee-photo-placeholder');
    const clearBtn = document.getElementById('ee-photo-clear');

    function showPreview(src) {
      if (previewImg) previewImg.src = src;
      if (preview) preview.hidden = false;
      if (placeholder) placeholder.hidden = true;
    }

    function resetPreview() {
      photoFile = null;
      if (fileInput) fileInput.value = '';
      const urlInput = document.getElementById('ee-photo-url');
      if (urlInput) urlInput.value = '';
      if (preview) preview.hidden = true;
      if (placeholder) placeholder.hidden = false;
      if (previewImg) previewImg.removeAttribute('src');
    }

    function setPhotoFile(file) {
      photoFile = file;
      const urlInput = document.getElementById('ee-photo-url');
      if (urlInput) urlInput.value = '';
      const reader = new FileReader();
      reader.onload = () => showPreview(reader.result);
      reader.readAsDataURL(file);
      if (window.hubCheckEventCoverFileQuality) {
        window.hubCheckEventCoverFileQuality(file, document.getElementById('ee-photo-quality-hint'));
      }
    }

    if (zone && window.hubBindImageUpload) {
      window.hubBindImageUpload({ zone, fileInput, onFile: setPhotoFile });
    }
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (fileInput) fileInput.click();
      }
    });
    if (clearBtn) clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resetPreview();
    });
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function ensureGroupOptionForEvent(ev) {
    const sel = document.getElementById('ee-group');
    if (!sel) return;
    const gid =
      ev.organiserGroupId || (ev.organiserGroupIds && ev.organiserGroupIds[0]) || '';
    if (!gid) return;
    const existing = [...sel.options].some((o) => o.value === gid);
    if (!existing) {
      const g = groups.find((x) => x.id === gid);
      const opt = document.createElement('option');
      opt.value = gid;
      opt.textContent = g ? g.name : ev.organiserName || 'Linked organiser';
      sel.appendChild(opt);
    }
    sel.value = gid;
  }

  function canonicalEventType(value) {
    const raw = fieldToString(value);
    if (!raw) return 'Meeting';
    if (window.hubNormalizeEventType) return window.hubNormalizeEventType(raw);
    return raw;
  }

  function initEventTypeSelect(selected) {
    const sel = document.getElementById('ee-type');
    if (!sel) return;
    const types = window.HUB_MEETING_TYPES || [
      { value: 'Meeting', label: 'Meeting' },
      { value: 'Events', label: 'Events' },
      { value: 'Exhibition', label: 'Exhibition' },
      { value: 'Awards', label: 'Awards' },
      { value: 'Webinar', label: 'Webinar' },
      { value: 'Workshop', label: 'Workshop' },
      { value: 'Session', label: 'Session' },
    ];
    const current = canonicalEventType(selected || sel.value || 'Meeting');
    sel.innerHTML = '';
    types.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item.value;
      opt.textContent = item.label || item.value;
      sel.appendChild(opt);
    });
    sel.value = types.some((item) => item.value === current) ? current : 'Meeting';
  }

  function setMeetingTypeSelect(value) {
    const sel = document.getElementById('ee-type');
    if (!sel) return;
    const v = canonicalEventType(value);
    if (!v) return;
    let matched = false;
    for (let i = 0; i < sel.options.length; i++) {
      const opt = sel.options[i];
      if (opt.value === v || opt.textContent === v) {
        sel.value = opt.value;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
      sel.value = v;
    }
  }

  function normalizeEventForForm(ev) {
    const copy = { ...ev };
    copy.title = fieldToString(ev.title);
    copy.description = fieldToString(ev.description);
    copy.type = canonicalEventType(ev.type || ev.typeRaw || ev.eventType);
    copy.venue = fieldToString(ev.venue);
    copy.addressLine1 = fieldToString(ev.addressLine1);
    copy.city = fieldToString(ev.city);
    copy.postcode = fieldToString(ev.postcode);
    copy.location = fieldToString(ev.location);
    copy.onlinePlatform = fieldToString(ev.onlinePlatform);
    copy.onlineLink = fieldToString(ev.onlineLink);
    if (!copy.addressLine1 && !copy.venue && copy.location && copy.location.toLowerCase() !== 'online') {
      copy.addressLine1 = copy.location;
    }
    return copy;
  }

  function fillGroupsSelect(preselectedId, lockSelection) {
    const sel = document.getElementById('ee-group');
    const hint = document.getElementById('ee-group-hint');
    const addRow = document.getElementById('ee-group-add-row');
    if (!sel) return;
    sel.innerHTML = '';
    if (!groups.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Create a group first';
      sel.appendChild(opt);
      sel.disabled = true;
      if (hint) {
        hint.innerHTML =
          'You need an organiser page first. <a href="group-edit.html" class="ee-inline-action">Create your organiser page</a> then return here.';
      }
      if (addRow) addRow.hidden = true;
      return;
    }
    sel.disabled = Boolean(lockSelection);
    if (hint) {
      hint.textContent = lockSelection
        ? 'This event belongs to the organiser page you selected.'
        : 'Which organiser group this event belongs to.';
    }
    if (addRow) addRow.hidden = false;
    groups.forEach((g) => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      sel.appendChild(opt);
    });
    if (preselectedId) {
      for (let i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === preselectedId) {
          sel.value = preselectedId;
          break;
        }
      }
    }
    syncCopyFromGroupButtons();
  }

  function getSelectedGroup() {
    const sel = document.getElementById('ee-group');
    let gid = sel && sel.value ? String(sel.value).trim() : '';
    if (!gid) {
      try {
        gid = sessionStorage.getItem(GROUP_STORAGE_KEY) || '';
      } catch {
        /* ignore */
      }
    }
    return groups.find((g) => g.id === gid) || null;
  }

  function syncCopyFromGroupButtons() {
    const group = getSelectedGroup();
    const titleBtn = document.getElementById('ee-copy-title-from-group');
    const descBtn = document.getElementById('ee-copy-desc-from-group');
    const hasGroup = Boolean(group);
    if (titleBtn) {
      titleBtn.disabled = !hasGroup || !group.name;
      titleBtn.title = hasGroup && group.name ? '' : 'Choose an organiser page first';
    }
    if (descBtn) {
      descBtn.disabled = !hasGroup || !group.description;
      descBtn.title = hasGroup && group.description ? '' : 'This group has no description yet';
    }
  }

  function bindCopyFromGroupButtons() {
    const titleBtn = document.getElementById('ee-copy-title-from-group');
    const descBtn = document.getElementById('ee-copy-desc-from-group');
    const groupSel = document.getElementById('ee-group');

    if (titleBtn) {
      titleBtn.addEventListener('click', () => {
        const group = getSelectedGroup();
        if (!group || !group.name) return;
        const titleEl = document.getElementById('ee-title');
        if (titleEl) titleEl.value = group.name;
      });
    }
    if (descBtn) {
      descBtn.addEventListener('click', () => {
        const group = getSelectedGroup();
        if (!group || !group.description) return;
        const descEl = document.getElementById('ee-description');
        if (descEl) {
          descEl.value = group.description;
          descEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    }
    if (groupSel) {
      groupSel.addEventListener('change', syncCopyFromGroupButtons);
    }
    syncCopyFromGroupButtons();
  }

  function setFormatPanelFieldsDisabled(block, disabled) {
    if (!block) return;
    block.querySelectorAll('input, select, textarea').forEach((el) => {
      el.disabled = disabled;
    });
  }

  function applyFormatUi(format) {
    eventFormat = normalizeEventFormat(format) || eventFormat || 'in-person';
    try {
      sessionStorage.setItem(FORMAT_STORAGE_KEY, eventFormat);
    } catch {
      /* ignore */
    }
    const venueBlock = document.getElementById('ee-venue-block');
    const onlineBlock = document.getElementById('ee-online-block');
    const badge = document.getElementById('ee-format-badge');
    const showVenue = eventFormat === 'in-person';
    const showOnline = eventFormat === 'online';
    if (venueBlock) venueBlock.classList.toggle('is-visible', showVenue);
    if (onlineBlock) onlineBlock.classList.toggle('is-visible', showOnline);
    setFormatPanelFieldsDisabled(venueBlock, !showVenue);
    setFormatPanelFieldsDisabled(onlineBlock, !showOnline);
    if (badge) {
      badge.textContent = FORMAT_LABELS[eventFormat] || eventFormat;
      badge.hidden = false;
    }
    syncFormatToggleButtons();
  }

  function buildLocationFields() {
    const venue = document.getElementById('ee-venue').value.trim();
    const address1 = document.getElementById('ee-address1').value.trim();
    const city = document.getElementById('ee-city').value.trim();
    const postcode = document.getElementById('ee-postcode').value.trim();
    const parts = [venue, address1, city, postcode].filter(Boolean);
    const fullAddress = parts.join(', ');
    let location = fullAddress;
    if (eventFormat === 'online' && !location) location = 'Online';
    return {
      venue,
      addressLine1: address1,
      city,
      postcode,
      location,
      fullAddress,
      eventFormat,
      onlinePlatform: document.getElementById('ee-platform').value.trim(),
      onlineLink: document.getElementById('ee-join-link').value.trim(),
    };
  }

  function inferFormatFromEvent(ev) {
    const loc = String(ev.location || '').toLowerCase();
    if (loc === 'online') return 'online';
    if (ev.onlineLink && !ev.venue && !ev.addressLine1 && !ev.postcode) return 'online';
    return 'in-person';
  }

  function sortEventsByDate(events) {
    return (events || []).slice().sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      if (da !== db) return da - db;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
  }

  function findSeriesPeers(ev, allEvents) {
    if (!ev || !ev.id) return [];
    const all = allEvents || [];
    const seriesGroupId = String(ev.seriesGroupId || '').trim();
    if (seriesGroupId) {
      const peers = all.filter((peer) => String(peer.seriesGroupId || '').trim() === seriesGroupId);
      if (peers.length > 1) return sortEventsByDate(peers);
    }
    const groupId = ev.organiserGroupId || ev.groupId || '';
    const titleKey = String(ev.title || '').trim().toLowerCase();
    if (!groupId || !titleKey) return [ev];
    const peers = all.filter((peer) => {
      const peerGroup = peer.organiserGroupId || peer.groupId || '';
      return (
        peerGroup === groupId && String(peer.title || '').trim().toLowerCase() === titleKey
      );
    });
    return peers.length > 1 ? sortEventsByDate(peers) : [ev];
  }

  function prefillFromEvent(rawEv) {
    const ev = normalizeEventForForm(rawEv);
    document.getElementById('ee-title').value = ev.title || '';
    initEventTypeSelect(ev.type || 'Meeting');
    document.getElementById('ee-description').value = ev.description || '';
    const wc = document.getElementById('ee-word-count');
    if (wc) wc.textContent = String(countWords(ev.description || ''));
    document.getElementById('ee-venue').value = ev.venue || '';
    if (document.getElementById('ee-address1')) {
      document.getElementById('ee-address1').value = ev.addressLine1 || '';
    }
    if (document.getElementById('ee-city')) document.getElementById('ee-city').value = ev.city || '';
    if (document.getElementById('ee-postcode')) {
      document.getElementById('ee-postcode').value = ev.postcode || '';
    }
    if (document.getElementById('ee-platform')) {
      const platform = ev.onlinePlatform || '';
      const platformSel = document.getElementById('ee-platform');
      if (platform && ![...platformSel.options].some((o) => o.value === platform || o.text === platform)) {
        const opt = document.createElement('option');
        opt.value = platform;
        opt.textContent = platform;
        platformSel.appendChild(opt);
      }
      platformSel.value = platform;
    }
    if (document.getElementById('ee-join-link')) {
      document.getElementById('ee-join-link').value = ev.onlineLink || '';
    }
    eventFormat = normalizeEventFormat(ev.eventFormat || inferFormatFromEvent(ev));
    applyFormatUi(eventFormat);
    ensureGroupOptionForEvent(ev);
    if (ev.imageUrl) {
      const preview = document.getElementById('ee-photo-preview');
      const previewImg = document.getElementById('ee-photo-preview-img');
      const placeholder = document.getElementById('ee-photo-placeholder');
      if (previewImg) previewImg.src = ev.imageUrl;
      if (preview) preview.hidden = false;
      if (placeholder) placeholder.hidden = true;
      document.getElementById('ee-photo-url').value = ev.imageUrl;
    }
    selectedDates.clear();
    const datePeers = Array.isArray(rawEv._seriesPeers) && rawEv._seriesPeers.length ? rawEv._seriesPeers : [ev];
    let timeSet = false;
    datePeers.forEach((peer) => {
      if (!peer.date) return;
      const d = parseAirtableDate(peer.date);
      if (!d) return;
      if (!timeSet) {
        calYear = d.getFullYear();
        calMonth = d.getMonth();
        const t = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
        const endD = peer.endDate ? parseAirtableDate(peer.endDate) : null;
        const endT = endD
          ? pad2(endD.getHours()) + ':' + pad2(endD.getMinutes())
          : '12:00';
        if (QuarterTime) {
          QuarterTime.setValues('ee-start-time', 'ee-end-time', t, endT);
        }
        timeSet = true;
      }
      selectedDates.add(dateKey(d.getFullYear(), d.getMonth(), d.getDate()));
    });
    if (!timeSet && QuarterTime) {
      QuarterTime.setValues('ee-start-time', 'ee-end-time', '10:00', '12:00');
    }
    renderCalendar();
    renderSelectedList();
    showEventStatusBadge(ev);
    renderEventOverviewStats(ev);
    const seriesPeers =
      Array.isArray(rawEv._seriesPeers) && rawEv._seriesPeers.length > 1
        ? rawEv._seriesPeers
        : findSeriesPeers(ev, []);
    applySeriesEditUi(seriesPeers.length > 1 ? seriesPeers : [], ev);
    applyLockUi(ev.locked || eventTicketsSoldCount(ev) > 0);
  }

  function goToTicketSetup(series) {
    try {
      sessionStorage.setItem(SERIES_STORAGE_KEY, JSON.stringify(series));
    } catch {
      /* ignore */
    }
    if (isEmbedDrawer) return;
    const ids = (series.eventIds || []).join(',');
    location.href = 'event-tickets.html?ids=' + encodeURIComponent(ids);
  }

  async function load() {
    const backLink = document.getElementById('ee-back-link') || document.querySelector('.ee-back');
    if (backLink && window.HubOrganiserActions) {
      window.HubOrganiserActions.applyBrowseReturnBack(
        backLink,
        'index.html#events-list',
        '← Back to My Events'
      );
    }

    const loadWork = async () => {
      const { ok, data } = await loadOrganiserBootstrapData();
      if (!ok) {
        const next = encodeURIComponent(location.pathname + location.search);
        location.href = '../login.html?next=' + next;
        return;
      }
      groups = data.groups || [];

      const explicitGroupId =
        sessionStorage.getItem(GROUP_STORAGE_KEY) || params.get('groupId') || '';

      if (!editId && !explicitGroupId) {
        if (isEmbedDrawer) {
          const autoGroupId = groups.length === 1 ? groups[0].id : '';
          fillGroupsSelect(autoGroupId, Boolean(autoGroupId));
          initEventTypeSelect('Meeting');
          return;
        }
        location.href = 'event-format.html';
        return;
      }

      if (!editId && explicitGroupId && !groups.some((g) => g.id === explicitGroupId)) {
        sessionStorage.removeItem(GROUP_STORAGE_KEY);
        if (isEmbedDrawer) {
          const autoGroupId = groups.length === 1 ? groups[0].id : '';
          fillGroupsSelect(autoGroupId, Boolean(autoGroupId));
          initEventTypeSelect('Meeting');
          return;
        }
        location.href = 'event-format.html';
        return;
      }

      if (editId) {
        document.getElementById('ee-page-title').textContent = 'Edit event';
        document.getElementById('ee-page-lead').textContent =
          'Update your listing, add more dates on the calendar, then continue to tickets.';
        document.getElementById('ee-submit').textContent = 'Continue to tickets →';

        let ev = (data.events || []).find((e) => e.id === editId) || null;
        if (!ev) {
          const evRes = await api('/api/organiser/events?id=' + encodeURIComponent(editId));
          if (evRes.ok && evRes.data.event) {
            ev = evRes.data.event;
          }
        }
        fillGroupsSelect(ev ? ev.organiserGroupId || ev.groupId : '', false);
        if (ev) {
          const peers = findSeriesPeers(ev, data.events || []);
          if (peers.length > 1) {
            ev._seriesPeers = peers;
          }
          prefillFromEvent(ev);
        } else {
          showAlert(
            'Could not load this event. Try again from My Events, or check you have access to this listing.'
          );
          if (isEmbedDrawer && editId && window.parent && window.parent !== window) {
            window.parent.postMessage(
              { type: 'hub-event-not-found', eventId: editId },
              window.location.origin
            );
          }
        }
        return;
      }

      fillGroupsSelect(explicitGroupId, true);
      initEventTypeSelect('Meeting');
    };

    const loading = window.organiserPageLoading;
    if (loading && loading.run) {
      await loading.run('Loading event', loadWork);
      notifyEmbedDrawerReady();
      return;
    }

    if (loading) loading.show('Loading event');
    try {
      await loadWork();
    } finally {
      if (loading) loading.hide();
    }
    notifyEmbedDrawerReady();
  }

  function notifyEmbedDrawerReady() {
    if (isEmbedDrawer && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'hub-event-drawer-ready' }, window.location.origin);
    }
  }

  document.getElementById('ee-cal-prev').addEventListener('click', () => {
    calMonth -= 1;
    if (calMonth < 0) {
      calMonth = 11;
      calYear -= 1;
    }
    renderCalendar();
  });

  document.getElementById('ee-cal-next').addEventListener('click', () => {
    calMonth += 1;
    if (calMonth > 11) {
      calMonth = 0;
      calYear += 1;
    }
    renderCalendar();
  });

  async function saveEvent(options) {
    const publish = options && options.publish;
    showAlert('');

    const organiserGroupId = document.getElementById('ee-group').value;
    const title = document.getElementById('ee-title').value.trim();
    if (!organiserGroupId || !title) {
      showAlert('Choose a group and enter an event title.');
      return;
    }

    const description = document.getElementById('ee-description').value.trim();
    if (countWords(description) > DESCRIPTION_MAX_WORDS) {
      showAlert('Description must be ' + DESCRIPTION_MAX_WORDS + ' words or fewer.');
      return;
    }

    const dateKeys = getSelectedDateKeys();
    const timeCheck = validateTimes();
    if (publish && !timeCheck.ok) {
      showAlert(timeCheck.message);
      return;
    }
    if (publish && !dateKeys.length) {
      showAlert('Select at least one date on the calendar before continuing.');
      return;
    }

    let occurrences = [];
    if (dateKeys.length) {
      if (!timeCheck.ok) {
        showAlert(timeCheck.message);
        return;
      }
      occurrences = buildOccurrences(dateKeys, timeCheck.start, timeCheck.end);
    }

    const locFields = buildLocationFields();
    if (
      eventFormat === 'in-person' &&
      !currentEventLocked &&
      !locFields.postcode
    ) {
      showAlert('Enter a postcode for in-person events (used to place your event on the map).');
      return;
    }
    const recurrence = deriveRecurrenceFromDates(dateKeys);
    const payload = {
      organiserGroupId,
      title,
      type: canonicalEventType(document.getElementById('ee-type').value),
      description,
      recurrencePattern: recurrence.recurrencePattern,
      recurrenceEndDate: recurrence.recurrenceEndDate,
      occurrences,
      ...locFields,
    };
    if (!editId) payload.listingStatus = 'draft';

    const photoUrl = document.getElementById('ee-photo-url').value.trim();
    if (photoUrl) payload.photoUrl = photoUrl;

    if (photoFile) {
      payload.photoBase64 = await readFileAsBase64(photoFile);
      payload.photoMime = photoFile.type;
      payload.photoFilename = photoFile.name;
    }

    const submitBtn = document.getElementById('ee-submit');
    const draftBtn = document.getElementById('ee-save-draft');
    const loading = window.organiserPageLoading;
    [submitBtn, draftBtn].forEach((b) => {
      if (b) b.disabled = true;
    });

    const saveWork = async () => {
      if (editId) {
        return api('/api/organiser/events', {
          method: 'PATCH',
          body: JSON.stringify({ id: editId, ...payload }),
        });
      }
      return api('/api/organiser/events', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    };

    let res;
    try {
      if (loading && loading.run) {
        res = await loading.run(publish ? 'Continuing to tickets' : 'Saving draft', saveWork);
      } else {
        if (loading) loading.show(publish ? 'Continuing to tickets' : 'Saving draft');
        res = await saveWork();
        if (loading) loading.hide();
      }
    } finally {
      [submitBtn, draftBtn].forEach((b) => {
        if (b) b.disabled = false;
      });
    }

    if (!res.ok) {
      const err = res.data.error || '';
      const msg =
        err === 'missing_dates'
          ? 'Select at least one date on the calendar before publishing.'
          : res.data.message || err || 'Could not save event';
      showAlert(msg);
      return;
    }

    const savedEvent = res.data.event || {};
    const linkEmails = savedEvent.linkUpdateEmails;
    if (linkEmails && linkEmails.sent > 0) {
      showAlert(
        'Join link saved. We emailed ' +
          linkEmails.sent +
          ' ticket holder' +
          (linkEmails.sent === 1 ? '' : 's') +
          ' with the link.',
        'ok'
      );
    }

    if (!publish) {
      if (isEmbedDrawer && window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'hub-event-saved', draft: true }, window.location.origin);
        return;
      }
      location.href = 'index.html#events-list';
      return;
    }

    const events = res.data.events || (res.data.event ? [res.data.event] : []);
    const eventIds =
      res.data.eventIds || events.map((ev) => ev.id).filter(Boolean);
    if (publish && !eventIds.length) {
      showAlert('Event saved but could not open ticket setup. Try Manage tickets from My Events.');
      return;
    }
    const leadImage =
      (events[0] && events[0].imageUrl) ||
      document.getElementById('ee-photo-preview-img')?.src ||
      document.getElementById('ee-photo-url')?.value.trim() ||
      '';
    if (isEmbedDrawer && window.parent && window.parent !== window) {
      goToTicketSetup({
        title,
        organiserGroupId,
        eventFormat: locFields.eventFormat,
        eventIds,
        imageUrl: leadImage,
        events: events.map((ev) => ({
          id: ev.id,
          title: ev.title,
          date: ev.date,
          imageUrl: ev.imageUrl || leadImage,
        })),
      });
      window.parent.postMessage(
        {
          type: 'hub-event-goto-tickets',
          eventIds,
          title,
        },
        window.location.origin
      );
      return;
    }
    goToTicketSetup({
      title,
      organiserGroupId,
      eventFormat: locFields.eventFormat,
      eventIds,
      imageUrl: leadImage,
      events: events.map((ev) => ({
        id: ev.id,
        title: ev.title,
        date: ev.date,
        imageUrl: ev.imageUrl || leadImage,
      })),
    });
  }

  document.getElementById('ee-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveEvent({ publish: true });
  });

  const draftBtn = document.getElementById('ee-save-draft');
  if (draftBtn) {
    draftBtn.addEventListener('click', () => saveEvent({ publish: false }));
  }

  function initPage() {
    if (editId) return true;
    if (params.get('format')) {
      eventFormat = normalizeEventFormat(params.get('format'));
      try {
        sessionStorage.setItem(FORMAT_STORAGE_KEY, eventFormat);
      } catch {
        /* ignore */
      }
    }
    if (!eventFormat) {
      if (isEmbedDrawer || params.get('groupId') || params.get('format')) {
        eventFormat = 'in-person';
      } else {
        location.replace('event-format.html');
        return false;
      }
    }
    applyFormatUi(eventFormat);
    return true;
  }

  async function bootEditor() {
    bindPhotoUpload();
    bindWordCounter();
    bindFormatToggleButtons();
    bindCopyFromGroupButtons();
    const cancelBtn = document.getElementById('ee-cancel-event-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', requestEventCancellation);
    if (QuarterTime) {
      QuarterTime.initPair('ee-start-time', 'ee-end-time', { start: '18:00', end: '20:00' });
    }
    bindTimeListRefresh();
    if (!editId && window.HubFlowTour) {
      window.HubFlowTour.startEventEditTour({ isEdit: false, delay: 0 });
    }
    if (editId) {
      await load();
      return;
    }
    if (!initPage()) return;
    await load();
    renderCalendar();
    renderSelectedList();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootEditor);
  } else {
    bootEditor();
  }
})();
