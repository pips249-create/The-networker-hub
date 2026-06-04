/**
 * Full-page event editor — recurring dates + ticket setup flow.
 */
(function () {
  const SERIES_STORAGE_KEY = 'hub_event_series';
  const FORMAT_STORAGE_KEY = 'hub_event_format';
  const params = new URLSearchParams(location.search);
  const editId = params.get('id') || '';
  function normalizeEventFormat(raw) {
    const s = String(raw || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-');
    if (s === 'inperson' || s === 'in-person' || s === 'in_person') return 'in-person';
    if (s === 'online' || s === 'virtual') return 'online';
    if (s === 'hybrid') return 'hybrid';
    return s || '';
  }

  let eventFormat = normalizeEventFormat(
    params.get('format') || sessionStorage.getItem(FORMAT_STORAGE_KEY) || ''
  );

  const FORMAT_LABELS = {
    'in-person': 'In person',
    online: 'Online',
    hybrid: 'Hybrid',
  };

  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();
  const selectedDates = new Set();
  let photoFile = null;
  let groups = [];

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
    const end = endTime || '12:00';
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
    list.innerHTML = keys.map((k) => '<li>' + esc(formatDateLabel(k)) + '</li>').join('');
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
      if (preview) preview.hidden = true;
      if (placeholder) placeholder.hidden = false;
      if (previewImg) previewImg.removeAttribute('src');
    }

    if (zone && fileInput) {
      zone.addEventListener('click', () => fileInput.click());
      zone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fileInput.click();
        }
      });
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          alert('Image must be under 2MB');
          return;
        }
        photoFile = file;
        const reader = new FileReader();
        reader.onload = () => showPreview(reader.result);
        reader.readAsDataURL(file);
      });
    }
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

  function setMeetingTypeSelect(value) {
    const sel = document.getElementById('ee-type');
    if (!sel) return;
    const v = fieldToString(value);
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
    copy.type = fieldToString(ev.type || ev.typeRaw);
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

  function fillGroupsSelect() {
    const sel = document.getElementById('ee-group');
    const hint = document.getElementById('ee-group-hint');
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
          'You need an organiser profile first. <a href="group-edit.html">Create a group</a> then return here.';
      }
      return;
    }
    sel.disabled = false;
    if (hint) hint.textContent = 'Which organiser group this event belongs to.';
    groups.forEach((g) => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      sel.appendChild(opt);
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
    const showVenue = eventFormat === 'in-person' || eventFormat === 'hybrid';
    const showOnline = eventFormat === 'online' || eventFormat === 'hybrid';
    if (venueBlock) venueBlock.classList.toggle('is-visible', showVenue);
    if (onlineBlock) onlineBlock.classList.toggle('is-visible', showOnline);
    if (badge) {
      badge.textContent = FORMAT_LABELS[eventFormat] || eventFormat;
      badge.hidden = false;
    }
    const changeTop = document.getElementById('ee-change-format-top');
    if (changeTop) changeTop.href = 'event-format.html';
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
    if (loc === 'online' || ev.onlineLink) return 'online';
    if (ev.onlineLink && (ev.venue || ev.addressLine1)) return 'hybrid';
    return 'in-person';
  }

  function prefillFromEvent(rawEv) {
    const ev = normalizeEventForForm(rawEv);
    document.getElementById('ee-title').value = ev.title || '';
    setMeetingTypeSelect(ev.type || 'Networking Event');
    document.getElementById('ee-description').value = ev.description || '';
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
    if (ev.date) {
      const d = parseAirtableDate(ev.date);
      if (d) {
        calYear = d.getFullYear();
        calMonth = d.getMonth();
        const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
        selectedDates.add(key);
        const t = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
        const endD = ev.endDate ? parseAirtableDate(ev.endDate) : null;
        const endT = endD
          ? pad2(endD.getHours()) + ':' + pad2(endD.getMinutes())
          : '12:00';
        if (QuarterTime) {
          QuarterTime.setValues('ee-start-time', 'ee-end-time', t, endT);
        }
      }
    } else if (QuarterTime) {
      QuarterTime.setValues('ee-start-time', 'ee-end-time', '10:00', '12:00');
    }
    renderCalendar();
    renderSelectedList();
  }

  function goToTicketSetup(series) {
    try {
      sessionStorage.setItem(SERIES_STORAGE_KEY, JSON.stringify(series));
    } catch {
      /* ignore */
    }
    const ids = (series.eventIds || []).join(',');
    location.href = 'event-tickets.html?ids=' + encodeURIComponent(ids);
  }

  async function load() {
    const { ok, data } = await api('/api/organiser/bootstrap');
    if (!ok) {
      showAlert('Please sign in to manage events.');
      return;
    }
    groups = data.groups || [];

    if (editId) {
      document.getElementById('ee-page-title').textContent = 'Edit event';
      document.getElementById('ee-page-lead').textContent =
        'Update your listing, add more dates on the calendar, then continue to tickets.';
      document.getElementById('ee-submit').textContent = 'Save & publish → tickets';
      const changeTop = document.getElementById('ee-change-format-top');
      if (changeTop) changeTop.hidden = false;

      let ev = null;
      const evRes = await api('/api/organiser/events?id=' + encodeURIComponent(editId));
      if (evRes.ok && evRes.data.event) {
        ev = evRes.data.event;
      }
      if (!ev) {
        ev = (data.events || []).find((e) => e.id === editId);
      }
      fillGroupsSelect();
      if (ev) {
        prefillFromEvent(ev);
      } else {
        showAlert(
          'Could not load this event. Try again from My Events, or check you have access to this listing.'
        );
      }
      return;
    }

    fillGroupsSelect();
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

    const dateKeys = getSelectedDateKeys();
    if (publish && !dateKeys.length) {
      showAlert('Select at least one date on the calendar before publishing.');
      return;
    }

    let occurrences = [];
    if (dateKeys.length) {
      const timeCheck = QuarterTime
        ? QuarterTime.validatePair('ee-start-time', 'ee-end-time')
        : { ok: true, start: '10:00', end: '12:00' };
      if (!timeCheck.ok) {
        showAlert(timeCheck.message);
        return;
      }
      occurrences = buildOccurrences(dateKeys, timeCheck.start, timeCheck.end);
    }

    const locFields = buildLocationFields();
    const payload = {
      organiserGroupId,
      title,
      type: document.getElementById('ee-type').value,
      description: document.getElementById('ee-description').value.trim(),
      photoUrl: document.getElementById('ee-photo-url').value.trim(),
      listingStatus: publish ? 'published' : 'draft',
      occurrences,
      ...locFields,
    };

    if (photoFile) {
      payload.photoBase64 = await readFileAsBase64(photoFile);
      payload.photoMime = photoFile.type;
      payload.photoFilename = photoFile.name;
    }

    const submitBtn = document.getElementById('ee-submit');
    const draftBtn = document.getElementById('ee-save-draft');
    [submitBtn, draftBtn].forEach((b) => {
      if (b) b.disabled = true;
    });

    let res;
    if (editId) {
      res = await api('/api/organiser/events', {
        method: 'PATCH',
        body: JSON.stringify({ id: editId, ...payload }),
      });
    } else {
      res = await api('/api/organiser/events', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    [submitBtn, draftBtn].forEach((b) => {
      if (b) b.disabled = false;
    });

    if (!res.ok) {
      const err = res.data.error || '';
      const msg =
        err === 'missing_dates'
          ? 'Select at least one date on the calendar before publishing.'
          : res.data.message || err || 'Could not save event';
      showAlert(msg);
      return;
    }

    if (!publish) {
      location.href = 'index.html#events-list';
      return;
    }

    const eventIds = res.data.eventIds || (res.data.events || []).map((ev) => ev.id);
    const events = res.data.events || (res.data.event ? [res.data.event] : []);
    goToTicketSetup({
      title,
      organiserGroupId,
      eventFormat: locFields.eventFormat,
      eventIds,
      events: events.map((ev) => ({
        id: ev.id,
        title: ev.title,
        date: ev.date,
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
      location.replace('event-format.html');
      return false;
    }
    applyFormatUi(eventFormat);
    return true;
  }

  async function bootEditor() {
    bindPhotoUpload();
    if (QuarterTime) {
      QuarterTime.initPair('ee-start-time', 'ee-end-time', { start: '10:00', end: '12:00' });
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
