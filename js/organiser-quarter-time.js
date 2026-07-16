/**
 * 15-minute time selects for organiser event forms.
 * Uses a compact hour + quarter-minute picker instead of one long native list.
 */
(function (global) {
  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function quarterHourValues() {
    const values = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        values.push(pad2(h) + ':' + pad2(m));
      }
    }
    return values;
  }

  const SLOTS = quarterHourValues();
  const HOURS = [];
  for (let h = 0; h < 24; h++) HOURS.push(pad2(h));
  const MINUTES = ['00', '15', '30', '45'];

  function roundToQuarterHour(timeStr) {
    if (!timeStr) return '10:00';
    const parts = String(timeStr).trim().split(':');
    let h = Number(parts[0]);
    let m = Number(parts[1]) || 0;
    if (Number.isNaN(h)) h = 10;
    h = Math.max(0, Math.min(23, h));
    m = Math.round(m / 15) * 15;
    if (m >= 60) {
      m = 0;
      h = Math.min(23, h + 1);
    }
    return pad2(h) + ':' + pad2(m);
  }

  function timeToMinutes(timeStr) {
    const [h, m] = roundToQuarterHour(timeStr).split(':').map(Number);
    return h * 60 + m;
  }

  function labelForSelect(selectEl, part) {
    const id = selectEl.id || '';
    if (id.indexOf('start') !== -1) return part === 'hour' ? 'Start hour' : 'Start minutes';
    if (id.indexOf('end') !== -1) return part === 'hour' ? 'End hour' : 'End minutes';
    if (id.indexOf('close') !== -1) return part === 'hour' ? 'Closing hour' : 'Closing minutes';
    return part === 'hour' ? 'Hour' : 'Minutes';
  }

  function syncDisabledState(selectEl, hourSel, minSel) {
    const dis = Boolean(selectEl.disabled);
    hourSel.disabled = dis;
    minSel.disabled = dis;
  }

  function enhanceSelect(selectEl) {
    if (!selectEl || selectEl.dataset.quarterEnhanced === '1') return;
    selectEl.dataset.quarterEnhanced = '1';

    const wrap = document.createElement('div');
    wrap.className = 'ee-quarter-time';

    const hourSel = document.createElement('select');
    hourSel.className = 'ee-quarter-time-hour';
    hourSel.setAttribute('aria-label', labelForSelect(selectEl, 'hour'));
    if (selectEl.id) hourSel.id = selectEl.id + '-hour';
    hourSel.innerHTML = HOURS.map(function (h) {
      return '<option value="' + h + '">' + h + '</option>';
    }).join('');

    const sep = document.createElement('span');
    sep.className = 'ee-quarter-time-sep';
    sep.setAttribute('aria-hidden', 'true');
    sep.textContent = ':';

    const minSel = document.createElement('select');
    minSel.className = 'ee-quarter-time-min';
    minSel.setAttribute('aria-label', labelForSelect(selectEl, 'min'));
    if (selectEl.id) minSel.id = selectEl.id + '-min';
    minSel.innerHTML = MINUTES.map(function (m) {
      return '<option value="' + m + '">' + m + '</option>';
    }).join('');

    const parent = selectEl.parentNode;
    if (!parent) return;
    parent.insertBefore(wrap, selectEl);
    wrap.appendChild(hourSel);
    wrap.appendChild(sep);
    wrap.appendChild(minSel);
    wrap.appendChild(selectEl);
    selectEl.classList.add('ee-quarter-time-value');
    selectEl.setAttribute('tabindex', '-1');
    selectEl.setAttribute('aria-hidden', 'true');

    function syncFromParts() {
      const next = hourSel.value + ':' + minSel.value;
      if (selectEl.value === next) return;
      selectEl.value = next;
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function syncFromValue() {
      const rounded = roundToQuarterHour(selectEl.value || '10:00');
      const parts = rounded.split(':');
      hourSel.value = parts[0];
      minSel.value = parts[1];
      syncDisabledState(selectEl, hourSel, minSel);
    }

    hourSel.addEventListener('change', syncFromParts);
    minSel.addEventListener('change', syncFromParts);
    selectEl._quarterSyncUi = syncFromValue;

    if (typeof MutationObserver !== 'undefined') {
      const mo = new MutationObserver(function () {
        syncDisabledState(selectEl, hourSel, minSel);
      });
      mo.observe(selectEl, { attributes: true, attributeFilter: ['disabled'] });
    }

    syncFromValue();
  }

  function populateSelect(selectEl, selected) {
    if (!selectEl) return;
    const value = roundToQuarterHour(selected);
    selectEl.innerHTML = SLOTS.map(function (t) {
      return '<option value="' + t + '">' + t + '</option>';
    }).join('');
    if (SLOTS.includes(value)) {
      selectEl.value = value;
    } else {
      selectEl.value = SLOTS[0];
    }
    enhanceSelect(selectEl);
    if (typeof selectEl._quarterSyncUi === 'function') {
      selectEl._quarterSyncUi();
    }
  }

  function initPair(startId, endId, defaults) {
    const startEl = document.getElementById(startId);
    const endEl = document.getElementById(endId);
    const d = defaults || {};
    populateSelect(startEl, d.start || '10:00');
    populateSelect(endEl, d.end || '12:00');
    if (startEl && !startEl.dataset.quarterBound) {
      startEl.dataset.quarterBound = '1';
      startEl.addEventListener('change', function () {
        if (!endEl) return;
        const startM = timeToMinutes(startEl.value);
        const endM = timeToMinutes(endEl.value);
        if (endM <= startM) {
          const next = Math.min(startM + 60, 23 * 60 + 45);
          const nh = Math.floor(next / 60);
          const nm = next % 60;
          endEl.value = pad2(nh) + ':' + pad2(nm);
          if (typeof endEl._quarterSyncUi === 'function') endEl._quarterSyncUi();
        }
      });
    }
    if (endEl && !endEl.dataset.quarterBound) {
      endEl.dataset.quarterBound = '1';
      endEl.addEventListener('change', function () {
        if (!startEl) return;
        const startM = timeToMinutes(startEl.value);
        const endM = timeToMinutes(endEl.value);
        if (endM <= startM) {
          const next = Math.min(startM + 60, 23 * 60 + 45);
          const nh = Math.floor(next / 60);
          const nm = next % 60;
          endEl.value = pad2(nh) + ':' + pad2(nm);
          if (typeof endEl._quarterSyncUi === 'function') endEl._quarterSyncUi();
        }
      });
    }
  }

  function setValues(startId, endId, startTime, endTime) {
    populateSelect(document.getElementById(startId), startTime);
    populateSelect(document.getElementById(endId), endTime);
  }

  function syncPairFromUi(startId, endId) {
    [startId, endId].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      const hourSel = document.getElementById(id + '-hour');
      const minSel = document.getElementById(id + '-min');
      if (hourSel && minSel) {
        const next = hourSel.value + ':' + minSel.value;
        if (el.value !== next) el.value = next;
      }
    });
  }

  function validatePair(startId, endId) {
    syncPairFromUi(startId, endId);
    const startEl = document.getElementById(startId);
    const endEl = document.getElementById(endId);
    const start = startEl ? startEl.value : '';
    const end = endEl ? endEl.value : '';
    if (!start || !end) {
      return { ok: false, message: 'Choose both a start time and an end time.' };
    }
    if (timeToMinutes(end) <= timeToMinutes(start)) {
      return { ok: false, message: 'End time must be after start time.' };
    }
    return { ok: true, start: start, end: end };
  }

  global.OrganiserQuarterTime = {
    SLOTS: SLOTS,
    roundToQuarterHour: roundToQuarterHour,
    timeToMinutes: timeToMinutes,
    populateSelect: populateSelect,
    initPair: initPair,
    setValues: setValues,
    validatePair: validatePair,
    syncPairFromUi: syncPairFromUi,
  };
})(typeof window !== 'undefined' ? window : globalThis);
