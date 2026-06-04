/**
 * Full-page event editor — recurring dates + ticket setup flow.
 */
(function () {
  const SERIES_STORAGE_KEY = 'hub_event_series';
  const params = new URLSearchParams(location.search);
  const editId = params.get('id') || '';
  let eventFormat = (params.get('format') || '').toLowerCase();

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

  function fillGroupsSelect() {
    const sel = document.getElementById('ee-group');
    if (!sel) return;
    sel.innerHTML = '';
    if (!groups.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Create a group first';
      sel.appendChild(opt);
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    groups.forEach((g) => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      sel.appendChild(opt);
    });
  }

  function applyFormatUi(format) {
    eventFormat = format || eventFormat || 'in-person';
    const venueBlock = document.getElementById('ee-venue-block');
    const onlineBlock = document.getElementById('ee-online-block');
    const badge = document.getElementById('ee-format-badge');
    const changeLink = document.getElementById('ee-change-format');
    const showVenue = eventFormat === 'in-person' || eventFormat === 'hybrid';
    const showOnline = eventFormat === 'online' || eventFormat === 'hybrid';
    if (venueBlock) venueBlock.hidden = !showVenue;
    if (onlineBlock) onlineBlock.hidden = !showOnline;
    if (badge) {
      badge.textContent = FORMAT_LABELS[eventFormat] || eventFormat;
      badge.hidden = false;
    }
    if (changeLink && !editId) {
      changeLink.href = 'event-format.html';
    }
  }

  function buildLocationFields() {
    const venue = document.getElementById('ee-venue').value.trim();
    const address1 = document.getElementById('ee-address1').value.trim();
    const city = document.getElementById('ee-city').value.trim();
    const postcode = document.getElementById('ee-postcode').value.trim();
    const listingArea = document.getElementById('ee-location').value.trim();
    const parts = [venue, address1, city, postcode].filter(Boolean);
    const fullAddress = parts.join(', ');
    let location = listingArea || fullAddress;
    if (eventFormat === 'online' && !location) location = 'Online';
    if (eventFormat === 'hybrid' && listingArea) location = listingArea + (fullAddress ? ' · ' + fullAddress : '');
    if (eventFormat === 'hybrid' && !listingArea && fullAddress) location = fullAddress;
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

  function prefillFromEvent(ev) {
    document.getElementById('ee-title').value = ev.title || '';
    document.getElementById('ee-type').value = ev.type || 'Networking Event';
    document.getElementById('ee-description').value = ev.description || '';
    document.getElementById('ee-location').value = ev.location || '';
    document.getElementById('ee-venue').value = ev.venue || '';
    if (document.getElementById('ee-address1')) {
      document.getElementById('ee-address1').value = ev.addressLine1 || '';
    }
    if (document.getElementById('ee-city')) document.getElementById('ee-city').value = ev.city || '';
    if (document.getElementById('ee-postcode')) {
      document.getElementById('ee-postcode').value = ev.postcode || '';
    }
    if (document.getElementById('ee-platform')) {
      document.getElementById('ee-platform').value = ev.onlinePlatform || '';
    }
    if (document.getElementById('ee-join-link')) {
      document.getElementById('ee-join-link').value = ev.onlineLink || '';
    }
    eventFormat = ev.eventFormat || inferFormatFromEvent(ev);
    applyFormatUi(eventFormat);
    const grp = document.getElementById('ee-group');
    if (grp && ev.organiserGroupId) grp.value = ev.organiserGroupId;
    if (ev.imageUrl) {
      const preview = document.getElementById('ee-photo-preview');
      const previewImg = document.getElementById('ee-photo-preview-img');
      const placeholder = document.getElementById('ee-photo-placeholder');
      if (previewImg) previewImg.src = ev.imageUrl;
      if (preview) preview.hidden = false;
      if (placeholder) placeholder.hidden = true;
      document.getElementById('ee-photo-url').value = ev.imageUrl;
    }
    if (ev.date) {
      const d = new Date(ev.date);
      if (!Number.isNaN(d.getTime())) {
        const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
        selectedDates.add(key);
        const t = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
        const endT = ev.endDate
          ? (() => {
              const end = new Date(ev.endDate);
              return Number.isNaN(end.getTime())
                ? '12:00'
                : pad2(end.getHours()) + ':' + pad2(end.getMinutes());
            })()
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
    fillGroupsSelect();

    if (editId) {
      document.getElementById('ee-page-title').textContent = 'Edit event';
      document.getElementById('ee-page-lead').textContent =
        'Update your listing, add more dates to the series on the calendar, then continue to tickets.';
      document.getElementById('ee-submit').textContent = 'Save & set up tickets →';
      const evRes = await api('/api/organiser/events?id=' + encodeURIComponent(editId));
      if (evRes.ok && evRes.data.event) {
        prefillFromEvent(evRes.data.event);
      } else {
        const local = (data.events || []).find((e) => e.id === editId);
        if (local) prefillFromEvent(local);
        else showAlert('Could not load this event.');
      }
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

  document.getElementById('ee-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showAlert('');

    const organiserGroupId = document.getElementById('ee-group').value;
    const title = document.getElementById('ee-title').value.trim();
    if (!organiserGroupId || !title) {
      showAlert('Choose a group and enter an event title.');
      return;
    }

    const dateKeys = getSelectedDateKeys();
    if (!dateKeys.length) {
      showAlert('Select at least one date on the calendar.');
      return;
    }

    const timeCheck = QuarterTime
      ? QuarterTime.validatePair('ee-start-time', 'ee-end-time')
      : { ok: true, start: '10:00', end: '12:00' };
    if (!timeCheck.ok) {
      showAlert(timeCheck.message);
      return;
    }

    const occurrences = buildOccurrences(dateKeys, timeCheck.start, timeCheck.end);

    const locFields = buildLocationFields();
    const payload = {
      organiserGroupId,
      title,
      type: document.getElementById('ee-type').value,
      description: document.getElementById('ee-description').value.trim(),
      photoUrl: document.getElementById('ee-photo-url').value.trim(),
      occurrences,
      ...locFields,
    };

    if (photoFile) {
      payload.photoBase64 = await readFileAsBase64(photoFile);
      payload.photoMime = photoFile.type;
      payload.photoFilename = photoFile.name;
    }

    const btn = document.getElementById('ee-submit');
    btn.disabled = true;

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

    btn.disabled = false;

    if (!res.ok) {
      const err = res.data.error || '';
      const msg =
        err === 'missing_dates'
          ? 'Select at least one date on the calendar.'
          : res.data.message || err || 'Could not save event';
      showAlert(msg);
      return;
    }

    const eventIds = res.data.eventIds || (res.data.events || []).map((ev) => ev.id);
    const events = res.data.events || (res.data.event ? [res.data.event] : []);
    const locFields = buildLocationFields();
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
  });

  function initPage() {
    if (!editId && !eventFormat) {
      location.replace('event-format.html');
      return;
    }
    if (!editId) applyFormatUi(eventFormat);
    else applyFormatUi(eventFormat || 'in-person');
  }

  bindPhotoUpload();
  if (QuarterTime) {
    QuarterTime.initPair('ee-start-time', 'ee-end-time', { start: '10:00', end: '12:00' });
  }
  initPage();
  renderCalendar();
  renderSelectedList();
  load();
})();
