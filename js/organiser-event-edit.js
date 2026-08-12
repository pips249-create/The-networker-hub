/**
 * Full-page event editor — recurring dates + ticket setup flow.
 */
(function () {
  const DESCRIPTION_MAX_WORDS = 500;
  const SERIES_STORAGE_KEY = 'hub_event_series';
  const FORMAT_STORAGE_KEY = 'hub_event_format';
  const GROUP_STORAGE_KEY = 'hub_event_group_id';
  const AUTODRAFT_PREFIX = 'hub_event_autodraft_v1:';
  const EDIT_AUTODRAFT_PREFIX = 'hub_event_edit_autodraft_v1:';
  const AUTODRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
  const params = new URLSearchParams(location.search);
  let editId = params.get('id') || '';
  const isEmbedDrawer = params.get('embed') === '1' || window.self !== window.top;
  const SERVER_AUTODRAFT_DELAY_MS = 2500;

  if (isEmbedDrawer) {
    document.documentElement.classList.add('ee-embed-drawer-root');
    if (document.body) document.body.classList.add('ee-embed-drawer');
    const pageHead = document.querySelector('.ee-page-head');
    if (pageHead) pageHead.hidden = true;
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
    return s || '';
  }

  /** Domains/URLs stored in location fields (e.g. Trivago.com) should not become street addresses. */
  function looksLikeUrl(value) {
    const s = String(value || '').trim();
    if (!s) return false;
    if (/^https?:\/\//i.test(s) || /^mailto:/i.test(s)) return true;
    if (/\s/.test(s)) return false;
    return /^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(s);
  }

  let eventFormat = normalizeEventFormat(
    params.get('format') || sessionStorage.getItem(FORMAT_STORAGE_KEY) || ''
  );
  let duplicateSourceTitle = '';
  let duplicateDefaultTitle = '';

  const DUPLICATE_TITLE_SUFFIX_RE = / \(copy\)$/i;

  function defaultDuplicateTitle(sourceTitle) {
    const base = String(sourceTitle || '').trim();
    if (!base) return '';
    return DUPLICATE_TITLE_SUFFIX_RE.test(base) ? base : base + ' (copy)';
  }

  function duplicateDraftActive() {
    return Boolean(duplicateSourceTitle && duplicateDefaultTitle);
  }

  function validateDuplicateTitle(title) {
    if (!duplicateDraftActive()) return '';
    const proposed = String(title || '').trim();
    if (!proposed) return 'Enter an event title.';
    if (proposed.toLowerCase() === duplicateSourceTitle.toLowerCase()) {
      return (
        'This draft copy must keep “(copy)” in the title or use a new name — it cannot match the original event title.'
      );
    }
    return '';
  }

  function applyDuplicateDraftUi(ev) {
    const banner = document.getElementById('ee-duplicate-banner');
    duplicateSourceTitle = '';
    duplicateDefaultTitle = '';
    if (!ev || !ev.duplicatedFromEventId) {
      if (banner) banner.hidden = true;
      return;
    }
    duplicateSourceTitle = String(ev.duplicateSourceTitle || '').trim();
    if (!duplicateSourceTitle && ev.title) {
      duplicateSourceTitle = String(ev.title).replace(DUPLICATE_TITLE_SUFFIX_RE, '').trim();
    }
    duplicateDefaultTitle = defaultDuplicateTitle(duplicateSourceTitle);
    if (banner) {
      banner.hidden = false;
      banner.innerHTML =
        'This is a <strong>draft copy</strong> of “' +
        escHtml(duplicateSourceTitle || 'the original event') +
        '”. Keep “(copy)” in the title or choose a new name so it stays separate from the original series.';
    }
  }

  function escHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const FORMAT_LABELS = {
    'in-person': 'In person',
    online: 'Online',
  };

  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();
  const selectedDates = new Set();
  let photoFile = null;
  let photoPosition = '';
  let groups = [];
  let currentEventLocked = false;
  let currentSeriesPeerCount = 0;
  let currentSeriesDateOnly = false;
  let currentSeriesContext = null;
  let autodraftTimer = null;
  let serverAutodraftTimer = null;
  let serverAutodraftInFlight = null;
  let lastServerAutodraftFingerprint = '';
  let restoringAutodraft = false;
  let autodraftDisabled = false;
  let cachedLocationFields = null;

  const AUTODRAFT_INLINE_DEFAULT = 'Progress saves to your account automatically.';

  function countWords(text) {
    return String(text || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  function autodraftKey(groupId) {
    if (editId) return EDIT_AUTODRAFT_PREFIX + editId;
    const id = String(groupId || '').trim();
    return id ? AUTODRAFT_PREFIX + id : '';
  }

  function autodraftSavedMessage(draft, opts) {
    opts = opts || {};
    if (opts.server) {
      if (draft && draft.hadUploadedPhoto) {
        return 'Saved to your account — re-select a new upload if you change the image.';
      }
      return 'Saved to your account';
    }
    if (draft && draft.hadUploadedPhoto) {
      return 'Saved a backup in this browser — re-select the uploaded image if you leave.';
    }
    return 'Saved a backup in this browser';
  }

  function setAutodraftStatus(text, tone) {
    const el = document.getElementById('ee-autodraft-status');
    const inline = document.getElementById('ee-autodraft-inline');
    if (el) {
      el.textContent = text || '';
      el.className =
        'ee-hint ee-autodraft-status' +
        (tone === 'restored' ? ' is-restored' : tone === 'error' ? ' is-error' : '');
    }
    if (inline) {
      if (tone === 'error' && text) {
        inline.textContent = text;
        inline.classList.add('is-error');
        inline.classList.remove('is-restored', 'is-saving');
      } else if (tone === 'saving') {
        inline.textContent = text || 'Saving to your account…';
        inline.classList.add('is-saving');
        inline.classList.remove('is-error', 'is-restored');
      } else if (text && (tone === 'restored' || tone === 'saved' || !tone)) {
        inline.textContent = text;
        inline.classList.remove('is-error', 'is-saving');
        if (tone === 'restored') inline.classList.add('is-restored');
        else inline.classList.remove('is-restored');
      } else if (!text) {
        inline.textContent = AUTODRAFT_INLINE_DEFAULT;
        inline.classList.remove('is-error', 'is-restored', 'is-saving');
      }
    }
  }

  function fieldValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  function collectAutodraft() {
    const groupId = fieldValue('ee-group').trim();
    if (!editId && !groupId) return null;
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      editId: editId || '',
      groupId,
      eventFormat,
      title: fieldValue('ee-title'),
      type: fieldValue('ee-type'),
      description: fieldValue('ee-description'),
      photoUrl: fieldValue('ee-photo-url'),
      photoPosition,
      hadUploadedPhoto: Boolean(photoFile),
      dates: getSelectedDateKeys(),
      startTime: fieldValue('ee-start-time'),
      endTime: fieldValue('ee-end-time'),
      venue: fieldValue('ee-venue'),
      address1: fieldValue('ee-address1'),
      city: fieldValue('ee-city'),
      postcode: fieldValue('ee-postcode'),
      platform: fieldValue('ee-platform'),
      joinLink: fieldValue('ee-join-link'),
    };
  }

  function autodraftHasWork(draft) {
    if (!draft) return false;
    return Boolean(
      String(draft.title || '').trim() ||
        String(draft.description || '').trim() ||
        String(draft.photoUrl || '').trim() ||
        draft.hadUploadedPhoto ||
        (Array.isArray(draft.dates) && draft.dates.length) ||
        (draft.editId && (String(draft.startTime || '').trim() || String(draft.endTime || '').trim()))
    );
  }

  function saveAutodraftNow() {
    if (restoringAutodraft || autodraftDisabled) return;
    const draft = collectAutodraft();
    if (!draft) return;
    const key = autodraftKey(draft.groupId);
    if (!key) return;
    try {
      if (!autodraftHasWork(draft)) {
        localStorage.removeItem(key);
        return;
      }
      localStorage.setItem(key, JSON.stringify(draft));
    } catch {
      setAutodraftStatus('Could not save a browser backup.', 'error');
    }
  }

  function scheduleAutodraft() {
    if (restoringAutodraft || autodraftDisabled) return;
    window.clearTimeout(autodraftTimer);
    autodraftTimer = window.setTimeout(saveAutodraftNow, 700);
    window.clearTimeout(serverAutodraftTimer);
    serverAutodraftTimer = window.setTimeout(function () {
      if (typeof saveServerAutodraftNow === 'function') {
        saveServerAutodraftNow();
      }
    }, SERVER_AUTODRAFT_DELAY_MS);
  }

  function clearAutodraft(groupId) {
    window.clearTimeout(autodraftTimer);
    window.clearTimeout(serverAutodraftTimer);
    const keys = [];
    if (editId) keys.push(EDIT_AUTODRAFT_PREFIX + editId);
    const createKey = !editId ? autodraftKey(groupId) : AUTODRAFT_PREFIX + String(groupId || '').trim();
    if (createKey && (!editId || createKey !== EDIT_AUTODRAFT_PREFIX + editId)) keys.push(createKey);
    keys.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    });
    setAutodraftStatus('');
  }

  function setDraftField(id, value, options) {
    const el = document.getElementById(id);
    if (!el || value == null) return;
    const next = String(value);
    if (options && options.keepIfLoaded && !next.trim() && String(el.value || '').trim()) return;
    el.value = next;
  }

  function applyDraftToForm(draft, options) {
    options = options || {};
    const keepLoaded = Boolean(options.keepLoadedDescription);
    restoringAutodraft = true;
    eventFormat = normalizeEventFormat(draft.eventFormat) || eventFormat;
    applyFormatUi(eventFormat);
    setDraftField('ee-title', draft.title, { keepIfLoaded: keepLoaded });
    setDraftField('ee-type', draft.type, { keepIfLoaded: keepLoaded });
    setDraftField('ee-description', draft.description, { keepIfLoaded: keepLoaded });
    setDraftField('ee-photo-url', draft.photoUrl, { keepIfLoaded: keepLoaded });
    setPhotoPosition(draft.photoPosition || '');

    if (draft.photoUrl) {
      const photoUrl = document.getElementById('ee-photo-url');
      if (photoUrl) photoUrl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const preserveDateKeys = Array.isArray(options.preserveDateKeys)
      ? options.preserveDateKeys.filter(function (keyName) {
          return /^\d{4}-\d{2}-\d{2}$/.test(String(keyName));
        })
      : [];
    selectedDates.clear();
    (Array.isArray(draft.dates) ? draft.dates : []).forEach((keyName) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(keyName))) selectedDates.add(String(keyName));
    });
    // Series listings: never let a stale autosave drop dates already loaded from the server.
    if (preserveDateKeys.length > 1) {
      preserveDateKeys.forEach(function (keyName) {
        selectedDates.add(String(keyName));
      });
    }
    const firstDate = [...selectedDates].sort()[0];
    if (firstDate) {
      const parts = firstDate.split('-').map(Number);
      calYear = parts[0];
      calMonth = parts[1] - 1;
    }
    if (QuarterTime && draft.startTime && draft.endTime && !options.skipTimes) {
      QuarterTime.setValues('ee-start-time', 'ee-end-time', draft.startTime, draft.endTime);
    }
    fillLocationFields({
      venue: draft.venue,
      addressLine1: draft.address1,
      city: draft.city,
      postcode: draft.postcode,
      onlinePlatform: draft.platform,
      onlineLink: draft.joinLink,
    });
    const description = document.getElementById('ee-description');
    if (description) description.dispatchEvent(new Event('input', { bubbles: true }));
    renderCalendar();
    renderSelectedList();
    restoringAutodraft = false;
  }

  function restoreAutodraft(groupId) {
    if (editId) return false;
    const key = autodraftKey(groupId);
    if (!key) return false;
    let draft;
    try {
      draft = JSON.parse(localStorage.getItem(key) || 'null');
      const age = Date.now() - new Date(draft?.savedAt || 0).getTime();
      if (!draft || !Number.isFinite(age) || age > AUTODRAFT_MAX_AGE_MS) {
        localStorage.removeItem(key);
        return false;
      }
    } catch {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      return false;
    }

    if (!autodraftHasWork(draft)) return false;
    applyDraftToForm(draft);
    setAutodraftStatus(
      draft.hadUploadedPhoto
        ? 'Restored your autosaved draft. Please re-select its uploaded image.'
        : 'Restored your autosaved draft.',
      'restored'
    );
    scheduleAutodraft();
    return true;
  }

  function restoreEditAutodraft() {
    if (!editId) return false;
    const key = EDIT_AUTODRAFT_PREFIX + editId;
    let draft;
    try {
      draft = JSON.parse(localStorage.getItem(key) || 'null');
      const age = Date.now() - new Date(draft?.savedAt || 0).getTime();
      if (!draft || !Number.isFinite(age) || age > AUTODRAFT_MAX_AGE_MS) {
        localStorage.removeItem(key);
        return false;
      }
    } catch {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      return false;
    }

    if (!autodraftHasWork(draft)) return false;
    const preserveDateKeys =
      selectedDates.size > 1
        ? getSelectedDateKeys()
        : storedSeriesDateKeysFromMeta();
    applyDraftToForm(draft, {
      keepLoadedDescription: true,
      // Restore times too — skipping them made time edits look like autosave was broken.
      skipTimes: false,
      preserveDateKeys: preserveDateKeys.length > 1 ? preserveDateKeys : null,
    });
    setAutodraftStatus(
      draft.hadUploadedPhoto
        ? 'Restored unsaved changes from this browser. Please re-select its uploaded image.'
        : 'Restored unsaved changes from this browser.',
      'restored'
    );
    scheduleAutodraft();
    return true;
  }

  function bindAutodraft() {
    const form = document.getElementById('ee-form');
    if (!form || form.dataset.autodraftBound === '1') return;
    form.dataset.autodraftBound = '1';
    form.addEventListener('input', () => {
      scheduleAutodraft();
    });
    form.addEventListener('change', () => {
      scheduleAutodraft();
    });
    form.addEventListener('click', (event) => {
      if (event.target.closest('[data-date-key], #ee-photo-clear, #ee-photo-recentre')) {
        scheduleAutodraft();
      }
    });
    window.addEventListener('pagehide', saveAutodraftNow);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'hidden') return;
      saveAutodraftNow();
      if (typeof flushServerAutodraft === 'function') {
        flushServerAutodraft();
      }
    });
  }

  let postcodeLookupTimer = null;

  async function lookupCityFromPostcode() {
    if (currentEventLocked || currentSeriesDateOnly || eventFormat === 'online') return;
    const postcodeEl = document.getElementById('ee-postcode');
    const cityEl = document.getElementById('ee-city');
    const venueEl = document.getElementById('ee-venue');
    if (!postcodeEl || !cityEl) return;
    const postcode = postcodeEl.value.trim().replace(/\s+/g, '');
    if (!postcode) return;
    const venueNorm = String((venueEl && venueEl.value) || '')
      .trim()
      .toLowerCase();
    const cityVal = cityEl.value.trim();
    // Replace empty city OR city that was wrongly copied from venue name.
    if (cityVal && (!venueNorm || cityVal.toLowerCase() !== venueNorm)) return;
    try {
      const res = await fetch(
        'https://api.postcodes.io/postcodes/' + encodeURIComponent(postcode)
      );
      const data = await res.json();
      const city =
        data?.result?.admin_district ||
        data?.result?.admin_ward ||
        data?.result?.parish ||
        '';
      if (city) {
        cityEl.value = String(city);
        if (window.hubParseFullUkPostcode) {
          const formatted = window.hubParseFullUkPostcode(postcodeEl.value);
          if (formatted) postcodeEl.value = formatted;
        }
        scheduleAutodraft();
      }
    } catch {
      /* ignore */
    }
  }

  function bindPostcodeCityLookup() {
    const postcodeEl = document.getElementById('ee-postcode');
    if (!postcodeEl || postcodeEl.dataset.cityLookupBound === '1') return;
    postcodeEl.dataset.cityLookupBound = '1';
    const scheduleLookup = () => {
      window.clearTimeout(postcodeLookupTimer);
      postcodeLookupTimer = window.setTimeout(lookupCityFromPostcode, 400);
    };
    postcodeEl.addEventListener('change', scheduleLookup);
    postcodeEl.addEventListener('blur', scheduleLookup);
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
    location.href = '/organiser/#events-list';
  }

  function applyLockUi(locked) {
    currentEventLocked = Boolean(locked);
    const banner = document.getElementById('ee-lock-banner');
    if (banner) {
      banner.hidden = !currentEventLocked;
      if (currentEventLocked) banner.innerHTML = ticketSalesLockBannerHtml();
    }
    const editableHint = document.getElementById('ee-lock-editable-hint');
    if (editableHint) editableHint.hidden = !currentEventLocked;

    setSeriesFieldLocked(document.getElementById('ee-group'), currentEventLocked);
    ['#ee-copy-title-from-group', '#ee-copy-desc-from-group'].forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.disabled = currentEventLocked;
    });

    const lockSelectors = [
      '#ee-type',
      '#ee-start-time',
      '#ee-end-time',
    ];
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
    setPhotoLockUi(currentEventLocked);
    refreshSeriesEditUi();
  }

  const SERIES_SHARED_FIELD_SELECTORS = [
    '#ee-group',
    '#ee-title',
    '#ee-type',
    '#ee-description',
    '#ee-photo-url',
    '#ee-start-time',
    '#ee-end-time',
  ];

  const SERIES_SHARED_CARD_IDS = ['ee-card-details'];

  const SUPPORT_EMAIL = 'hello@thenetworkerhub.com';

  function ticketSalesLockBannerHtml() {
    return (
      '🔒 <strong>Ticket sales are live.</strong> Date, time, type, location, and cover photo are locked. ' +
      'You can still edit the title and description — ticket holders are emailed when those change. ' +
      'For date, venue, or ticket changes, contact <a href="mailto:' +
      SUPPORT_EMAIL +
      '">' +
      SUPPORT_EMAIL +
      '</a> or cancel the event.'
    );
  }

  function showAttendeeUpdateAlerts(source) {
    if (!source) return;
    const linkEmails = source.linkUpdateEmails;
    if (linkEmails && linkEmails.sent > 0) {
      showAlert(
        'Join link saved. We emailed ' +
          linkEmails.sent +
          ' ticket holder' +
          (linkEmails.sent === 1 ? '' : 's') +
          ' with the link.',
        'ok'
      );
      return;
    }
    const detailsEmails = source.detailsUpdateEmails;
    if (detailsEmails && detailsEmails.sent > 0) {
      showAlert(
        'Changes saved. We emailed ' +
          detailsEmails.sent +
          ' ticket holder' +
          (detailsEmails.sent === 1 ? '' : 's') +
          ' with the update.',
        'ok'
      );
    }
  }

  function setPhotoLockUi(locked) {
    const photoZone = document.getElementById('ee-photo-zone');
    const photoFileInput = document.getElementById('ee-photo-file');
    const photoClear = document.getElementById('ee-photo-clear');
    const photoChange = document.getElementById('ee-photo-change');
    const photoRecentre = document.getElementById('ee-photo-recentre');
    const photoFrame = document.getElementById('ee-photo-frame');
    const photoUrl = document.getElementById('ee-photo-url');
    if (photoZone) photoZone.classList.toggle('is-locked', locked);
    if (photoFrame) {
      photoFrame.classList.toggle('is-locked', locked);
      photoFrame.style.cursor = locked ? 'default' : '';
      photoFrame.tabIndex = locked ? -1 : 0;
    }
    if (photoFileInput) photoFileInput.disabled = locked;
    if (photoClear) photoClear.disabled = locked;
    if (photoChange) photoChange.disabled = locked;
    if (photoRecentre) photoRecentre.disabled = locked;
    if (photoUrl) {
      photoUrl.disabled = locked;
      const field = photoUrl.closest('.ee-field');
      if (field) field.classList.toggle('is-locked', locked);
    }
  }

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
      setPhotoLockUi(currentEventLocked);
      applyFormatUi(eventFormat);
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
            ' dates</strong>. Title, location, times, and description apply to <strong>every date</strong> in the series. Use matching ticket prices on each day if you want attendees to book all dates in one checkout.';
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

    ['#ee-copy-title-from-group', '#ee-copy-desc-from-group'].forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.disabled = lockShared || currentEventLocked;
    });

    setPhotoLockUi(lockShared || currentEventLocked);

    if (lockShared) {
      ['#ee-start-time', '#ee-end-time'].forEach((sel) => {
        setSeriesFieldLocked(document.querySelector(sel), true);
      });
    }
    applyFormatUi(eventFormat);
  }

  function applySeriesEditUi(peers, ev) {
    currentSeriesContext =
      peers && peers.length > 1 && ev ? { peers: peers, ev: ev } : null;
    refreshSeriesEditUi();
  }

  function snapshotLocationFromEvent(ev) {
    const normalized = normalizeEventForForm(ev);
    cachedLocationFields = {
      venue: normalized.venue || '',
      addressLine1: normalized.addressLine1 || '',
      city: normalized.city || '',
      postcode: normalized.postcode || '',
      location: [normalized.venue, normalized.addressLine1, normalized.city, normalized.postcode]
        .filter(Boolean)
        .join(', '),
      fullAddress: normalized.addressLine1 || '',
      eventFormat: resolveEventFormat(ev),
      onlinePlatform: normalized.onlinePlatform || '',
      onlineLink: normalized.onlineLink || '',
    };
  }

  function preserveLocationOnPayload(payload) {
    if (!cachedLocationFields) return payload;
    return { ...payload, ...cachedLocationFields };
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
    if (QuarterTime && QuarterTime.syncPairFromUi) {
      QuarterTime.syncPairFromUi('ee-start-time', 'ee-end-time');
    }
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
    if (msg) {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch {
        /* ignore */
      }
    }
  }

  function clearLocationFieldErrors() {
    document.querySelectorAll('#ee-card-location .ee-field.is-error').forEach((field) => {
      field.classList.remove('is-error');
    });
    const postcodeHint = document.getElementById('ee-postcode-hint');
    if (postcodeHint) postcodeHint.hidden = true;
  }

  function showLocationFieldError(fieldId, message) {
    clearLocationFieldErrors();
    const input = document.getElementById(fieldId);
    const field = input ? input.closest('.ee-field') : null;
    if (field) field.classList.add('is-error');
    if (fieldId === 'ee-postcode') {
      const hint = document.getElementById('ee-postcode-hint');
      if (hint) {
        hint.textContent = message;
        hint.hidden = false;
      }
    }
    const card = document.getElementById('ee-card-location');
    if (card) {
      try {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch {
        /* ignore */
      }
    }
    showAlert(message);
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

  async function fetchEventForEdit(eventId, bootstrapEvents) {
    const res = await api('/api/organiser/events?id=' + encodeURIComponent(eventId));
    if (res.ok && res.data.event) return res.data.event;

    const cached = (bootstrapEvents || []).find((e) => e.id === eventId) || null;
    if (cached && String(cached.description || '').trim()) return cached;

    if (!res.ok) {
      const retry = await api('/api/organiser/events?id=' + encodeURIComponent(eventId));
      if (retry.ok && retry.data.event) return retry.data.event;
    }

    return cached;
  }

  async function loadOrganiserBootstrapData() {
    if (window.HubOrganiserEmbedBootstrap && window.HubOrganiserEmbedBootstrap.loadOrganiserBootstrapData) {
      return window.HubOrganiserEmbedBootstrap.loadOrganiserBootstrapData({
        groupsOnly: !editId,
      });
    }
    return api('/api/organiser/bootstrap' + (editId ? '' : '?groupsOnly=1'));
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
    const tz = window.HubEventTimezone;
    if (tz && typeof tz.londonWallToUtcIso === 'function') {
      return tz.londonWallToUtcIso(y, m, d, hh || 0, mm || 0);
    }
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
      el.addEventListener('change', function () {
        renderSelectedList();
        scheduleAutodraft();
      });
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
          scheduleAutodraft();
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

  function applyPhotoPosition() {
    const previewImg = document.getElementById('ee-photo-preview-img');
    if (previewImg) previewImg.style.objectPosition = photoPosition || '50% 50%';
  }

  function setPhotoPosition(value) {
    photoPosition = value === '50% 50%' ? '' : value || '';
    applyPhotoPosition();
    scheduleAutodraft();
  }

  function parsePhotoPosition() {
    const m = String(photoPosition || '').match(/^(\d{1,3})%\s+(\d{1,3})%$/);
    if (!m) return { x: 50, y: 50 };
    return { x: Number(m[1]), y: Number(m[2]) };
  }

  function getPhotoCoverOverflow(frame, img) {
    const fw = frame?.clientWidth || 0;
    const fh = frame?.clientHeight || 0;
    const iw = img?.naturalWidth || 0;
    const ih = img?.naturalHeight || 0;
    if (!fw || !fh || !iw || !ih) return { ox: 0, oy: 0 };
    const scale = Math.max(fw / iw, fh / ih);
    return {
      ox: Math.max(0, iw * scale - fw),
      oy: Math.max(0, ih * scale - fh),
    };
  }

  function updatePhotoCropHint() {
    const frame = document.getElementById('ee-photo-frame');
    const img = document.getElementById('ee-photo-preview-img');
    const chip = document.getElementById('ee-photo-frame-hint');
    const help = document.getElementById('ee-photo-preview-hint');
    if (!frame || !img) return;
    const { ox, oy } = getPhotoCoverOverflow(frame, img);
    const canPan = ox > 1 || oy > 1;
    frame.classList.toggle('is-locked', !canPan);
    frame.tabIndex = canPan ? 0 : -1;
    let chipText = 'Drag to reposition';
    let helpText =
      'This is the same crop used on browse cards. Drag the photo to choose what stays in frame.';
    if (!img.naturalWidth) {
      chipText = 'Loading photo…';
      helpText = 'Loading your photo for the listing card crop.';
    } else if (!canPan) {
      chipText = '';
      helpText = 'This photo already fills the listing card crop, so there is nothing to drag.';
    } else if (ox > 1 && oy <= 1) {
      chipText = 'Drag sideways';
      helpText =
        'This wide photo is cropped at the sides. Drag left or right to choose what stays centred on browse cards.';
    } else if (oy > 1 && ox <= 1) {
      chipText = 'Drag up or down';
      helpText =
        'This tall photo is cropped top and bottom. Drag up or down to choose what stays on browse cards.';
    }
    if (chip) {
      chip.textContent = chipText;
      chip.hidden = !chipText;
    }
    if (help) help.textContent = helpText;
  }

  function bindPhotoReposition() {
    const frame = document.getElementById('ee-photo-frame');
    const img = document.getElementById('ee-photo-preview-img');
    if (!frame || frame.dataset.repositionBound === '1') return;
    frame.dataset.repositionBound = '1';
    const clamp = (n) => Math.min(100, Math.max(0, Math.round(n)));
    let dragging = false;
    let moved = false;
    let start = null;

    if (img) {
      img.addEventListener('load', () => {
        applyPhotoPosition();
        updatePhotoCropHint();
      });
    }

    frame.addEventListener('pointerdown', (e) => {
      if (currentEventLocked || frame.classList.contains('is-locked')) return;
      if (e.button != null && e.button !== 0) return;
      const overflow = getPhotoCoverOverflow(frame, img);
      if (overflow.ox <= 1 && overflow.oy <= 1) return;
      dragging = true;
      moved = false;
      start = { x: e.clientX, y: e.clientY, pos: parsePhotoPosition(), overflow };
      frame.classList.add('is-dragging');
      try {
        frame.setPointerCapture(e.pointerId);
      } catch (_) {
        /* older browsers */
      }
      e.preventDefault();
    });
    frame.addEventListener('pointermove', (e) => {
      if (!dragging || !start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!moved && dx * dx + dy * dy < 9) return;
      moved = true;
      // Convert pointer movement into object-position using the real cover overflow,
      // so the photo tracks the finger/cursor 1:1 instead of jumping.
      const ox = Math.max(start.overflow.ox, 1);
      const oy = Math.max(start.overflow.oy, 1);
      const nx = start.overflow.ox > 1 ? clamp(start.pos.x - (dx / ox) * 100) : 50;
      const ny = start.overflow.oy > 1 ? clamp(start.pos.y - (dy / oy) * 100) : 50;
      setPhotoPosition(nx + '% ' + ny + '%');
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      start = null;
      frame.classList.remove('is-dragging');
      if (e && e.pointerId != null) {
        try {
          if (frame.hasPointerCapture(e.pointerId)) frame.releasePointerCapture(e.pointerId);
        } catch (_) {
          /* ignore */
        }
      }
    };
    frame.addEventListener('pointerup', endDrag);
    frame.addEventListener('pointercancel', endDrag);
    frame.addEventListener('lostpointercapture', () => {
      dragging = false;
      start = null;
      frame.classList.remove('is-dragging');
    });
    window.addEventListener('resize', () => updatePhotoCropHint());
  }

  function bindPhotoUpload() {
    const zone = document.getElementById('ee-photo-zone');
    const fileInput = document.getElementById('ee-photo-file');
    const preview = document.getElementById('ee-photo-preview');
    const previewImg = document.getElementById('ee-photo-preview-img');
    const placeholder = document.getElementById('ee-photo-placeholder');
    const clearBtn = document.getElementById('ee-photo-clear');
    const recentreBtn = document.getElementById('ee-photo-recentre');
    const changeBtn = document.getElementById('ee-photo-change');
    const urlInput = document.getElementById('ee-photo-url');

    function showPreview(src) {
      if (previewImg) previewImg.src = src;
      if (preview) preview.hidden = false;
      if (zone) zone.hidden = true;
      if (placeholder) placeholder.hidden = true;
      applyPhotoPosition();
      // naturalWidth may still be 0 until load fires; hint updates on img load too.
      updatePhotoCropHint();
    }

    function resetPreview() {
      photoFile = null;
      setPhotoPosition('');
      if (fileInput) fileInput.value = '';
      if (urlInput) urlInput.value = '';
      if (preview) preview.hidden = true;
      if (zone) zone.hidden = false;
      if (placeholder) placeholder.hidden = false;
      if (previewImg) {
        previewImg.removeAttribute('src');
        previewImg.style.objectPosition = '50% 50%';
      }
    }

    function setPhotoFile(file) {
      photoFile = file;
      setPhotoPosition('');
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
    if (zone) {
      zone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (fileInput) fileInput.click();
        }
      });
    }
    if (changeBtn) {
      changeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (currentEventLocked) return;
        if (fileInput) fileInput.click();
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (currentEventLocked) return;
        resetPreview();
      });
    }
    if (recentreBtn) {
      recentreBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (currentEventLocked) return;
        setPhotoPosition('');
        updatePhotoCropHint();
      });
    }
    if (urlInput) {
      urlInput.addEventListener('change', () => {
        const url = urlInput.value.trim();
        if (!url) return;
        photoFile = null;
        if (fileInput) fileInput.value = '';
        showPreview(url);
      });
    }
    bindPhotoReposition();
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
      { value: 'Conference', label: 'Conference' },
      { value: 'Events', label: 'Events' },
      { value: 'Exhibition', label: 'Exhibition' },
      { value: 'Awards', label: 'Awards' },
      { value: 'Webinar', label: 'Webinar' },
      { value: 'Workshop', label: 'Workshop' },
      { value: 'Seminar', label: 'Seminar' },
      { value: 'Masterclass', label: 'Masterclass' },
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

  function sanitizeLocationFields(fields) {
    const out = {
      venue: String((fields && fields.venue) || '').trim(),
      addressLine1: String((fields && (fields.addressLine1 || fields.address)) || '').trim(),
      city: String((fields && fields.city) || '').trim(),
      postcode: String((fields && fields.postcode) || '').trim(),
      location: String((fields && fields.location) || '').trim(),
    };
    const venueNorm = out.venue.toLowerCase();
    if (out.postcode && window.hubParseFullUkPostcode) {
      const formatted = window.hubParseFullUkPostcode(out.postcode);
      if (formatted) out.postcode = formatted;
    } else if (!out.postcode && out.location && window.hubParseFullUkPostcode) {
      out.postcode = window.hubParseFullUkPostcode(out.location) || '';
    }
    if (out.city && venueNorm && out.city.toLowerCase() === venueNorm) {
      out.city = '';
    }
    if (out.addressLine1 && venueNorm) {
      const addressNorm = out.addressLine1.toLowerCase().replace(/\s+/g, ' ').trim();
      const pcCompact = out.postcode.replace(/\s+/g, '').toLowerCase();
      const pcSpaced = out.postcode.toLowerCase();
      if (
        addressNorm === venueNorm ||
        addressNorm === venueNorm + ',' ||
        (pcCompact &&
          (addressNorm === venueNorm + ', ' + pcCompact ||
            addressNorm === venueNorm + ' ' + pcCompact ||
            addressNorm === venueNorm + ', ' + pcSpaced ||
            addressNorm === venueNorm + ' ' + pcSpaced))
      ) {
        out.addressLine1 = '';
      }
    }
    // location_label often repeats venue/city/postcode — never use it as street address.
    if (out.addressLine1 && out.location && out.addressLine1 === out.location) {
      out.addressLine1 = '';
    }
    if (
      !out.addressLine1 &&
      out.location &&
      venueNorm &&
      out.location.toLowerCase().startsWith(venueNorm)
    ) {
      /* keep address empty */
    } else if (
      !out.addressLine1 &&
      !out.venue &&
      out.location &&
      out.location.toLowerCase() !== 'online' &&
      !looksLikeUrl(out.location)
    ) {
      out.addressLine1 = out.location;
    }
    if (!out.city && out.location && window.hubParseCityFromLocationLabel) {
      const parsedCity = window.hubParseCityFromLocationLabel(out.location, out.postcode);
      if (parsedCity && (!venueNorm || parsedCity.toLowerCase() !== venueNorm)) {
        out.city = parsedCity;
      }
    }
    return out;
  }

  function normalizeEventForForm(ev) {
    const copy = { ...ev };
    copy.title = fieldToString(ev.title);
    copy.description = fieldToString(ev.description);
    copy.type = canonicalEventType(ev.type || ev.typeRaw || ev.eventType);
    const cleaned = sanitizeLocationFields({
      venue: fieldToString(ev.venue),
      addressLine1: fieldToString(ev.addressLine1),
      city: fieldToString(ev.city),
      postcode: fieldToString(ev.postcode),
      location: fieldToString(ev.location),
    });
    copy.venue = cleaned.venue;
    copy.addressLine1 = cleaned.addressLine1;
    copy.city = cleaned.city;
    copy.postcode = cleaned.postcode;
    copy.location = cleaned.location;
    copy.onlinePlatform = fieldToString(ev.onlinePlatform);
    copy.onlineLink = fieldToString(ev.onlineLink);

    // URL/domain in venue or location is a join link, not a street address.
    if (!copy.onlineLink && looksLikeUrl(copy.location)) {
      copy.onlineLink = copy.location;
    } else if (!copy.onlineLink && looksLikeUrl(copy.venue)) {
      copy.onlineLink = copy.venue;
    } else if (!copy.onlineLink && looksLikeUrl(copy.addressLine1)) {
      copy.onlineLink = copy.addressLine1;
    }
    if (looksLikeUrl(copy.venue)) copy.venue = '';
    if (looksLikeUrl(copy.addressLine1)) copy.addressLine1 = '';

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
          'You need an organiser page first. <a href="/organiser/group-edit" class="ee-inline-action">Create your organiser page</a> then return here.';
        hint.hidden = false;
      }
      if (addRow) addRow.hidden = true;
      return;
    }
    sel.disabled = Boolean(lockSelection);
    if (hint) {
      if (lockSelection) {
        hint.textContent = 'This event belongs to the organiser page you selected.';
        hint.hidden = false;
      } else {
        hint.textContent = '';
        hint.hidden = true;
      }
    }
    if (addRow) addRow.hidden = false;
    if (!lockSelection) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select an organiser page…';
      sel.appendChild(placeholder);
    }
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
    } else if (!lockSelection && groups.length === 1) {
      sel.value = groups[0].id;
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
        if (duplicateDraftActive()) {
          const ok = window.confirm(
            'Replace the draft copy title with your organiser page name? The copy should keep “(copy)” or use a different name from the original event.'
          );
          if (!ok) return;
        }
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
    const badge = document.getElementById('ee-format-badge');
    if (badge) badge.hidden = true;

    document.querySelectorAll('[data-ee-format]').forEach((btn) => {
      btn.classList.toggle(
        'is-active',
        normalizeEventFormat(btn.getAttribute('data-ee-format')) === eventFormat
      );
      btn.setAttribute(
        'aria-pressed',
        normalizeEventFormat(btn.getAttribute('data-ee-format')) === eventFormat ? 'true' : 'false'
      );
    });

    const formatField = document.getElementById('ee-format-field');
    if (formatField) {
      const locked = currentEventLocked || currentSeriesDateOnly;
      formatField.classList.toggle('is-locked', locked);
      formatField.querySelectorAll('[data-ee-format]').forEach((btn) => {
        btn.disabled = locked;
      });
    }

    const venueBlock = document.getElementById('ee-venue-block');
    const onlineBlock = document.getElementById('ee-online-block');
    const showVenue = eventFormat === 'in-person';
    const showOnline = eventFormat === 'online';
    if (venueBlock) venueBlock.classList.toggle('is-visible', showVenue);
    if (onlineBlock) onlineBlock.classList.toggle('is-visible', showOnline);
    setFormatPanelFieldsDisabled(venueBlock, !showVenue || currentEventLocked || currentSeriesDateOnly);
    setFormatPanelFieldsDisabled(onlineBlock, !showOnline || currentSeriesDateOnly);
  }

  function buildLocationFields() {
    const showOnline = eventFormat === 'online';
    const venue = showOnline ? '' : fieldValue('ee-venue').trim();
    const address1 = showOnline ? '' : fieldValue('ee-address1').trim();
    const city = showOnline ? '' : fieldValue('ee-city').trim();
    const postcode = showOnline ? '' : fieldValue('ee-postcode').trim();
    const parts = [venue, address1, city, postcode].filter(Boolean);
    const fullAddress = parts.join(', ');
    return {
      venue,
      addressLine1: address1,
      city,
      postcode,
      location: showOnline ? 'Online' : fullAddress,
      fullAddress: showOnline ? 'Online' : fullAddress,
      eventFormat,
      onlinePlatform: showOnline ? fieldValue('ee-platform').trim() : '',
      onlineLink: showOnline ? fieldValue('ee-join-link').trim() : '',
    };
  }

  function fillLocationFields(fields) {
    if (!fields) return;
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el && val != null) el.value = String(val);
    };
    set('ee-venue', fields.venue || '');
    set('ee-address1', fields.addressLine1 || '');
    set('ee-city', fields.city || '');
    set('ee-postcode', fields.postcode || '');
    set('ee-platform', fields.onlinePlatform || '');
    set('ee-join-link', fields.onlineLink || '');
  }

  function bindFormatToggleButtons() {
    document.querySelectorAll('[data-ee-format]').forEach((btn) => {
      if (btn.dataset.formatBound === '1') return;
      btn.dataset.formatBound = '1';
      btn.addEventListener('click', () => {
        if (currentEventLocked || currentSeriesDateOnly) return;
        eventFormat = normalizeEventFormat(btn.getAttribute('data-ee-format'));
        applyFormatUi(eventFormat);
        scheduleAutodraft();
      });
    });
  }

  function inferFormatFromEvent(ev) {
    const loc = String(ev.location || '').trim().toLowerCase();
    if (loc === 'online' || loc.includes('online')) return 'online';
    if (ev.onlineLink) return 'online';
    if (looksLikeUrl(ev.location) || looksLikeUrl(ev.venue)) return 'online';
    return 'in-person';
  }

  /** Prefer stored format, but recover when meeting link / URL location says online. */
  function resolveEventFormat(ev) {
    const stored = normalizeEventFormat(ev.eventFormat);
    if (stored === 'online') return 'online';
    if (inferFormatFromEvent(ev) === 'online') return 'online';
    if (stored === 'in-person') return 'in-person';
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
    if (String(ev.duplicatedFromEventId || '').trim()) return [ev];
    const all = allEvents || [];
    const seriesGroupId = String(ev.seriesGroupId || '').trim();
    if (seriesGroupId) {
      const peers = all.filter((peer) => String(peer.seriesGroupId || '').trim() === seriesGroupId);
      if (peers.length > 1) return sortEventsByDate(peers);
      // Incomplete bootstrap lists often only include the primary id — caller
      // should fetch by seriesGroupId rather than falling through to title match.
      return peers.length === 1 ? peers : [ev];
    }
    const groupId = ev.organiserGroupId || ev.groupId || '';
    const titleKey = String(ev.title || '').trim().toLowerCase();
    if (!groupId || !titleKey) return [ev];
    const peers = all.filter((peer) => {
      const peerGroup = peer.organiserGroupId || peer.groupId || '';
      if (peerGroup !== groupId) return false;
      if (String(peer.title || '').trim().toLowerCase() !== titleKey) return false;
      if (String(peer.seriesGroupId || '').trim()) return false;
      if (String(peer.duplicatedFromEventId || '').trim()) return false;
      return true;
    });
    return peers.length > 1 ? sortEventsByDate(peers) : [ev];
  }

  function readStoredSeriesMeta() {
    try {
      const raw = sessionStorage.getItem(SERIES_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function storedSeriesDateKeysFromMeta() {
    const stored = readStoredSeriesMeta();
    if (!stored) return [];
    const keys = new Set();
    const rows = Array.isArray(stored.events) ? stored.events : [];
    rows.forEach(function (row) {
      if (!row || !row.date) return;
      const parts = londonCalendarPartsFromIso(row.date);
      if (!parts) return;
      keys.add(dateKey(parts.year, parts.month - 1, parts.day));
    });
    return [...keys].sort();
  }

  async function fetchEventsByIds(ids) {
    const wanted = (ids || []).map(String).filter(Boolean);
    if (!wanted.length) return [];
    const results = await Promise.all(
      wanted.map(function (id) {
        return api('/api/organiser/events?id=' + encodeURIComponent(id));
      })
    );
    return results
      .map(function (res) {
        return res.ok && res.data.event ? res.data.event : null;
      })
      .filter(Boolean);
  }

  /** Prefer full series peers even when bootstrap only returned the primary event. */
  async function resolveSeriesPeersForEdit(ev, bootstrapEvents) {
    if (!ev || !ev.id) return [];
    if (String(ev.duplicatedFromEventId || '').trim()) return [ev];

    let peers = findSeriesPeers(ev, bootstrapEvents || []);
    const stored = readStoredSeriesMeta();
    const storedIds = Array.isArray(stored && stored.eventIds)
      ? stored.eventIds.map(String).filter(Boolean)
      : [];
    const storedEvents = Array.isArray(stored && stored.events) ? stored.events : [];
    const editIdStr = String(ev.id);
    const storedCoversEdit =
      storedIds.length > 1 &&
      (storedIds.includes(editIdStr) ||
        storedEvents.some(function (row) {
          return row && String(row.id) === editIdStr;
        }));

    if (storedCoversEdit && storedIds.length > peers.length) {
      const byId = new Map();
      (bootstrapEvents || []).forEach(function (row) {
        if (row && row.id) byId.set(String(row.id), row);
      });
      peers.forEach(function (row) {
        if (row && row.id) byId.set(String(row.id), row);
      });
      storedEvents.forEach(function (row) {
        if (!row || !row.id) return;
        const id = String(row.id);
        const cur = byId.get(id) || { id: id };
        byId.set(id, {
          ...cur,
          id: id,
          title: cur.title || row.title || ev.title || '',
          date: cur.date || row.date || row.startsAt || row.starts_at || '',
          endDate: cur.endDate || row.endDate || row.endsAt || row.ends_at || '',
          seriesGroupId: cur.seriesGroupId || row.seriesGroupId || ev.seriesGroupId || '',
          organiserGroupId:
            cur.organiserGroupId || row.organiserGroupId || ev.organiserGroupId || ev.groupId || '',
          imageUrl: cur.imageUrl || row.imageUrl || '',
          imagePosition: cur.imagePosition || row.imagePosition || '',
        });
      });
      const missingIds = storedIds.filter(function (id) {
        return !byId.has(String(id)) || !byId.get(String(id)).date;
      });
      if (missingIds.length) {
        const fetched = await fetchEventsByIds(missingIds);
        fetched.forEach(function (row) {
          if (row && row.id) byId.set(String(row.id), row);
        });
      }
      peers = sortEventsByDate(
        storedIds
          .map(function (id) {
            return byId.get(String(id));
          })
          .filter(Boolean)
      );
    }

    const seriesGroupId = String(
      (ev && ev.seriesGroupId) ||
        (peers[0] && peers[0].seriesGroupId) ||
        (stored && stored.seriesGroupId) ||
        ''
    ).trim();
    const needsFetch =
      seriesGroupId &&
      (peers.length <= 1 ||
        peers.some(function (peer) {
          return !peer || !peer.date;
        }));
    if (needsFetch) {
      try {
        const res = await api(
          '/api/organiser/events?seriesGroupId=' + encodeURIComponent(seriesGroupId)
        );
        if (res.ok && Array.isArray(res.data.events) && res.data.events.length > 1) {
          peers = sortEventsByDate(res.data.events);
        }
      } catch {
        /* keep local peers */
      }
    }

    const stillMissingDates = peers.filter(function (peer) {
      return peer && peer.id && !peer.date;
    });
    if (stillMissingDates.length && peers.length > 1) {
      await Promise.all(
        stillMissingDates.map(async function (peer) {
          try {
            const res = await api('/api/organiser/events?id=' + encodeURIComponent(peer.id));
            if (res.ok && res.data.event) {
              const full = res.data.event;
              const idx = peers.findIndex(function (row) {
                return row && String(row.id) === String(peer.id);
              });
              if (idx >= 0) peers[idx] = { ...peers[idx], ...full };
            }
          } catch {
            /* ignore */
          }
        })
      );
      peers = sortEventsByDate(peers);
    }

    if (peers.length <= 1) {
      try {
        const res = await api('/api/organiser/events');
        if (res.ok && Array.isArray(res.data.events) && res.data.events.length) {
          const titlePeers = findSeriesPeers(ev, res.data.events);
          if (titlePeers.length > peers.length) {
            peers = titlePeers;
          }
        }
      } catch {
        /* keep local peers */
      }
    }

    return peers.length ? peers : [ev];
  }

  function eventWallTimeFromIso(iso) {
    const tz = window.HubEventTimezone;
    if (tz && typeof tz.londonTimeFromIso === 'function') {
      return tz.londonTimeFromIso(iso);
    }
    const d = parseAirtableDate(iso);
    if (!d) return '';
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function londonCalendarPartsFromIso(iso) {
    const tz = window.HubEventTimezone;
    if (tz && typeof tz.londonDatePartsFromIso === 'function') {
      return tz.londonDatePartsFromIso(iso);
    }
    const d = parseAirtableDate(iso);
    if (!d) return null;
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }

  function endIsoForPeer(peer) {
    const tz = window.HubEventTimezone;
    if (tz && typeof tz.eventEndMs === 'function') {
      const endMs = tz.eventEndMs({
        date: peer.date,
        endDate: peer.endDate,
        starts_at: peer.date,
        ends_at: peer.endDate,
      });
      if (endMs != null) return new Date(endMs).toISOString();
    }
    return peer.endDate || '';
  }

  function prefillFromEvent(rawEv) {
    const ev = normalizeEventForForm(rawEv);
    document.getElementById('ee-title').value = ev.title || '';
    initEventTypeSelect(ev.type || 'Meeting');
    document.getElementById('ee-description').value = ev.description || '';
    const wc = document.getElementById('ee-word-count');
    if (wc) wc.textContent = String(countWords(ev.description || ''));
    eventFormat = resolveEventFormat(ev);
    snapshotLocationFromEvent(ev);
    applyFormatUi(eventFormat);
    fillLocationFields(cachedLocationFields);
    ensureGroupOptionForEvent(ev);
    if (ev.imageUrl) {
      const preview = document.getElementById('ee-photo-preview');
      const previewImg = document.getElementById('ee-photo-preview-img');
      const placeholder = document.getElementById('ee-photo-placeholder');
      const zone = document.getElementById('ee-photo-zone');
      if (previewImg) previewImg.src = ev.imageUrl;
      if (preview) preview.hidden = false;
      if (zone) zone.hidden = true;
      if (placeholder) placeholder.hidden = true;
      document.getElementById('ee-photo-url').value = ev.imageUrl;
      setPhotoPosition(ev.imagePosition || '');
      updatePhotoCropHint();
    }
    selectedDates.clear();
    const datePeers = Array.isArray(rawEv._seriesPeers) && rawEv._seriesPeers.length ? rawEv._seriesPeers : [ev];
    let timeSet = false;
    datePeers.forEach((peer) => {
      if (!peer.date) return;
      const dateParts = londonCalendarPartsFromIso(peer.date);
      if (!dateParts) return;
      if (!timeSet) {
        calYear = dateParts.year;
        calMonth = dateParts.month - 1;
        const t = eventWallTimeFromIso(peer.date);
        const endIso = endIsoForPeer(peer);
        const endT = endIso ? eventWallTimeFromIso(endIso) : defaultEndFromStart(t);
        if (QuarterTime) {
          QuarterTime.setValues('ee-start-time', 'ee-end-time', t, endT);
        }
        timeSet = true;
      }
      selectedDates.add(dateKey(dateParts.year, dateParts.month - 1, dateParts.day));
    });
    if (!timeSet && QuarterTime) {
      QuarterTime.setValues('ee-start-time', 'ee-end-time', '09:00', '11:00');
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
    applyDuplicateDraftUi(rawEv);
    applyLockUi(ev.locked || eventTicketsSoldCount(ev) > 0);
    lookupCityFromPostcode();
  }

  function preserveSeriesLaunchFlags(series) {
    if (!series || typeof series !== 'object') return series;
    try {
      const raw = sessionStorage.getItem(SERIES_STORAGE_KEY);
      const prev = raw ? JSON.parse(raw) : null;
      if (prev && prev.launchSetup) series.launchSetup = true;
      if (prev && prev.familyKey && !series.familyKey) series.familyKey = prev.familyKey;
    } catch {
      /* ignore */
    }
    if (params.get('onboard') === 'launch') series.launchSetup = true;
    return series;
  }

  function goToLocationSetup(series) {
    try {
      sessionStorage.setItem(SERIES_STORAGE_KEY, JSON.stringify(preserveSeriesLaunchFlags(series)));
    } catch {
      /* ignore */
    }
    if (isEmbedDrawer) return;
    const id = (series.eventIds && series.eventIds[0]) || editId || '';
    location.href = '/organiser/event-location?id=' + encodeURIComponent(id);
  }

  function goToTicketSetup(series) {
    try {
      sessionStorage.setItem(SERIES_STORAGE_KEY, JSON.stringify(preserveSeriesLaunchFlags(series)));
    } catch {
      /* ignore */
    }
    if (isEmbedDrawer) return;
    const ids = (series.eventIds || []).join(',');
    location.href = '/organiser/event-tickets?ids=' + encodeURIComponent(ids);
  }

  async function load() {
    const backLink = document.getElementById('ee-back-link') || document.querySelector('.ee-back');
    if (backLink && window.HubOrganiserActions) {
      window.HubOrganiserActions.applyBrowseReturnBack(
        backLink,
        '/organiser/#events-list',
        '← Back to My Events'
      );
    }

    const loadWork = async () => {
      const { ok, data } = await loadOrganiserBootstrapData();
      if (!ok) {
        const next = encodeURIComponent(location.pathname + location.search);
        location.href = '../login?next=' + next;
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
        fillGroupsSelect('', false);
        initEventTypeSelect('Meeting');
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
        fillGroupsSelect('', false);
        initEventTypeSelect('Meeting');
        return;
      }

      if (editId) {
        document.getElementById('ee-page-title').textContent = 'Edit event';
        document.getElementById('ee-page-lead').textContent =
          'Update your listing, location, and dates, then continue to tickets.';
        document.getElementById('ee-submit').textContent = 'Continue to tickets →';

        let ev = null;
        ev = await fetchEventForEdit(editId, data.events || []);
        fillGroupsSelect(ev ? ev.organiserGroupId || ev.groupId : '', false);
        if (ev) {
          const peers = await resolveSeriesPeersForEdit(ev, data.events || []);
          if (peers.length > 1) {
            ev._seriesPeers = peers;
            // Keep series meta in sync so location/tickets see every date.
            try {
              const stored = readStoredSeriesMeta() || {};
              sessionStorage.setItem(
                SERIES_STORAGE_KEY,
                JSON.stringify(
                  preserveSeriesLaunchFlags({
                    ...stored,
                    title: stored.title || ev.title || '',
                    eventIds: peers.map(function (peer) {
                      return peer.id;
                    }),
                    events: peers.map(function (peer) {
                      return {
                        id: peer.id,
                        title: peer.title || ev.title || '',
                        date: peer.date || '',
                        endDate: peer.endDate || '',
                        imageUrl: peer.imageUrl || '',
                        imagePosition: peer.imagePosition || '',
                        seriesGroupId: peer.seriesGroupId || ev.seriesGroupId || '',
                      };
                    }),
                    seriesGroupId: ev.seriesGroupId || peers[0].seriesGroupId || '',
                    organiserGroupId: ev.organiserGroupId || ev.groupId || '',
                    eventFormat: resolveEventFormat(ev),
                  })
                )
              );
            } catch {
              /* ignore */
            }
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
    try {
      if (loading && loading.run) {
        await loading.run('Loading event', loadWork);
      } else {
        if (loading) loading.show('Loading event');
        try {
          await loadWork();
        } finally {
          if (loading) loading.hide();
        }
      }
    } catch (err) {
      console.error('[event-edit] load failed', err);
      if (isEmbedDrawer) {
        showAlert('Could not load the event editor. Close this panel and try again.');
      }
    } finally {
      notifyEmbedDrawerReady();
    }
  }

  function notifyEmbedDrawerReady() {
    if (isEmbedDrawer && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'hub-event-drawer-ready' }, window.location.origin);
    }
    try {
      if (window.HubFieldTip && window.HubFieldTip.init) {
        window.HubFieldTip.init('[data-hub-tip]');
      }
    } catch (err) {
      console.error('[event-edit] field tips init failed', err);
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

  function promoteToSavedEventId(newId) {
    const id = String(newId || '').trim();
    if (!id || id === editId) return;
    const prevGroup = fieldValue('ee-group').trim();
    const prevCreateKey = prevGroup ? AUTODRAFT_PREFIX + prevGroup : '';
    editId = id;
    if (document.body) document.body.classList.remove('ee-is-new-listing');
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('id', id);
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch {
      /* ignore */
    }
    if (prevCreateKey) {
      try {
        localStorage.removeItem(prevCreateKey);
      } catch {
        /* ignore */
      }
    }
  }

  function serverAutodraftFingerprint(payload) {
    try {
      return JSON.stringify({
        title: payload.title,
        type: payload.type,
        description: payload.description,
        occurrences: payload.occurrences,
        recurrencePattern: payload.recurrencePattern,
        recurrenceEndDate: payload.recurrenceEndDate,
        venue: payload.venue,
        addressLine1: payload.addressLine1,
        city: payload.city,
        postcode: payload.postcode,
        onlinePlatform: payload.onlinePlatform,
        onlineLink: payload.onlineLink,
        photoUrl: payload.photoUrl,
        imagePosition: payload.imagePosition,
        eventFormat: eventFormat,
      });
    } catch {
      return String(Date.now());
    }
  }

  function buildEventSavePayload(options) {
    const opts = options || {};
    const quiet = Boolean(opts.quiet);
    const organiserGroupId = fieldValue('ee-group').trim();
    const title = fieldValue('ee-title').trim();
    if (!organiserGroupId || !title) {
      return { ok: false, error: 'Choose a group and enter an event title.' };
    }
    const duplicateTitleError = validateDuplicateTitle(title);
    if (duplicateTitleError) {
      return { ok: false, error: duplicateTitleError };
    }

    const description = fieldValue('ee-description').trim();
    if (countWords(description) > DESCRIPTION_MAX_WORDS) {
      return {
        ok: false,
        error: 'Description must be ' + DESCRIPTION_MAX_WORDS + ' words or fewer.',
      };
    }

    const dateKeys = getSelectedDateKeys();
    const timeCheck = validateTimes();
    let occurrences = [];
    if (dateKeys.length) {
      if (!timeCheck.ok) {
        if (!quiet) return { ok: false, error: timeCheck.message };
      } else {
        occurrences = buildOccurrences(dateKeys, timeCheck.start, timeCheck.end);
      }
    }

    const recurrence = deriveRecurrenceFromDates(dateKeys);
    const locFields = buildLocationFields();
    const payload = {
      organiserGroupId,
      title,
      type: canonicalEventType(fieldValue('ee-type')),
      description,
      recurrencePattern: recurrence.recurrencePattern,
      recurrenceEndDate: recurrence.recurrenceEndDate,
      occurrences,
      ...locFields,
    };
    if (!editId) payload.listingStatus = 'draft';

    if (!currentEventLocked) {
      const photoUrl = fieldValue('ee-photo-url').trim();
      if (photoUrl) payload.photoUrl = photoUrl;
      payload.imagePosition = photoPosition || '';
    }

    return {
      ok: true,
      payload: payload,
      organiserGroupId: organiserGroupId,
      title: title,
      timeCheck: timeCheck,
      dateKeys: dateKeys,
    };
  }

  async function persistEventPayload(payload) {
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
  }

  async function saveServerAutodraftNow() {
    if (restoringAutodraft || autodraftDisabled) return null;
    saveAutodraftNow();

    const built = buildEventSavePayload({ quiet: true });
    if (!built.ok) return null;

    const fingerprint = serverAutodraftFingerprint(built.payload);
    if (fingerprint && fingerprint === lastServerAutodraftFingerprint) return null;

    const run = (async function () {
      setAutodraftStatus('Saving to your account…', 'saving');
      const res = await persistEventPayload(built.payload);
      if (!res.ok) {
        setAutodraftStatus(
          "Couldn't save to your account — kept a browser backup.",
          'error'
        );
        return res;
      }

      const saved = res.data.event || (res.data.events && res.data.events[0]) || {};
      const newId = saved.id || (res.data.eventIds && res.data.eventIds[0]) || '';
      if (!editId && newId) promoteToSavedEventId(newId);

      lastServerAutodraftFingerprint = fingerprint;
      const draft = collectAutodraft();
      if (draft) {
        try {
          const key = autodraftKey(draft.groupId);
          if (key) localStorage.setItem(key, JSON.stringify(draft));
        } catch {
          /* ignore */
        }
      }
      setAutodraftStatus(autodraftSavedMessage(draft, { server: true }), 'saved');
      return res;
    })();

    serverAutodraftInFlight = run;
    try {
      return await run;
    } finally {
      if (serverAutodraftInFlight === run) serverAutodraftInFlight = null;
    }
  }

  async function flushServerAutodraft() {
    window.clearTimeout(serverAutodraftTimer);
    if (serverAutodraftInFlight) {
      try {
        await serverAutodraftInFlight;
      } catch {
        /* ignore */
      }
    }
    return saveServerAutodraftNow();
  }

  async function saveEvent(options) {
    const publish = options && options.publish;
    showAlert('');

    await flushServerAutodraft();

    const built = buildEventSavePayload({ quiet: false });
    if (!built.ok) {
      showAlert(built.error || 'Could not save event');
      return;
    }

    if (publish && !built.timeCheck.ok) {
      showAlert(built.timeCheck.message);
      return;
    }
    if (publish && !built.dateKeys.length) {
      showAlert('Select at least one date on the calendar before continuing.');
      return;
    }
    if (
      publish &&
      eventFormat === 'in-person' &&
      !currentEventLocked &&
      !currentSeriesDateOnly
    ) {
      if (!built.payload.postcode) {
        showAlert('Enter a postcode before continuing — we use it to place your event on the map.');
        const postcodeEl = document.getElementById('ee-postcode');
        if (postcodeEl) postcodeEl.focus();
        return;
      }
    }

    let payload = built.payload;
    if (!currentEventLocked && photoFile && !options.quiet) {
      payload = { ...payload };
      payload.photoBase64 = await readFileAsBase64(photoFile);
      payload.photoMime = photoFile.type;
      payload.photoFilename = photoFile.name;
    }

    const organiserGroupId = built.organiserGroupId;
    const title = built.title;
    const submitBtn = document.getElementById('ee-submit');
    const draftBtn = document.getElementById('ee-save-draft');
    const loading = window.organiserPageLoading;
    [submitBtn, draftBtn].forEach((b) => {
      if (b) b.disabled = true;
    });

    const saveWork = async () => persistEventPayload(payload);

    const saveLabel = publish
      ? 'Continuing to tickets'
      : editId
        ? 'Saving draft'
        : 'Saving draft';

    let res;
    try {
      if (loading && loading.run) {
        res = await loading.run(saveLabel, saveWork);
      } else {
        if (loading) loading.show(saveLabel);
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
          : err === 'duplicate_title_matches_source'
            ? res.data.message ||
              'This draft copy must keep “(copy)” in the title or use a new name — it cannot match the original event title.'
            : res.data.message || err || 'Could not save event';
      showAlert(msg);
      return;
    }

    autodraftDisabled = true;
    clearAutodraft(organiserGroupId);
    const savedEvent = res.data.event || {};
    if (!editId && savedEvent.id) promoteToSavedEventId(savedEvent.id);
    showAttendeeUpdateAlerts(savedEvent);

    if (!publish) {
      if (isEmbedDrawer && window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'hub-event-saved', draft: true }, window.location.origin);
        return;
      }
      location.href = '/organiser/#events-list';
      return;
    }

    const events = res.data.events || (res.data.event ? [res.data.event] : []);
    const eventIds =
      res.data.eventIds || events.map((ev) => ev.id).filter(Boolean);
    if (publish && !eventIds.length) {
      showAlert('Event saved but could not open ticket setup. Try Edit from My Events.');
      return;
    }
    const leadImage =
      (events[0] && events[0].imageUrl) ||
      document.getElementById('ee-photo-preview-img')?.src ||
      document.getElementById('ee-photo-url')?.value.trim() ||
      '';
    const leadImagePosition =
      (events[0] && events[0].imagePosition) || photoPosition || '';
    const locationMeta = {
      title,
      organiserGroupId,
      eventFormat,
      eventIds,
      imageUrl: leadImage,
      imagePosition: leadImagePosition,
      events: events.map((ev) => ({
        id: ev.id,
        title: ev.title,
        date: ev.date,
        endDate: ev.endDate || '',
        imageUrl: ev.imageUrl || leadImage,
        imagePosition: ev.imagePosition || leadImagePosition,
      })),
    };
    if (isEmbedDrawer && window.parent && window.parent !== window) {
      goToTicketSetup(locationMeta);
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
    goToTicketSetup(locationMeta);
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
      eventFormat = 'in-person';
    }
    applyFormatUi(eventFormat);
    return true;
  }

  async function bootEditor() {
    try {
      bindPhotoUpload();
      bindWordCounter();
      bindCopyFromGroupButtons();
      bindFormatToggleButtons();
      const cancelBtn = document.getElementById('ee-cancel-event-btn');
      if (cancelBtn) cancelBtn.addEventListener('click', requestEventCancellation);
      if (QuarterTime) {
        QuarterTime.initPair('ee-start-time', 'ee-end-time', { start: '09:00', end: '11:00' });
      }
      bindTimeListRefresh();
      if (!editId && window.HubFlowTour && !isEmbedDrawer) {
        window.HubFlowTour.startEventEditTour({ isEdit: false, delay: 0 });
      }
      if (editId) {
        await load();
        restoreEditAutodraft();
        bindAutodraft();
        return;
      }
      if (!initPage()) return;
      await load();
      restoreAutodraft(fieldValue('ee-group'));
      bindAutodraft();
      renderCalendar();
      renderSelectedList();
    } catch (err) {
      console.error('[event-edit] bootEditor failed', err);
      if (isEmbedDrawer) {
        showAlert('Could not open the event editor. Close this panel and try again.');
      }
    } finally {
      if (isEmbedDrawer) notifyEmbedDrawerReady();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootEditor);
  } else {
    bootEditor();
  }
})();
