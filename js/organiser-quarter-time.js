/**
 * 15-minute time selects for organiser event forms.
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
          const prev = Math.max(endM - 60, 0);
          const nh = Math.floor(prev / 60);
          const nm = prev % 60;
          startEl.value = pad2(nh) + ':' + pad2(nm);
        }
      });
    }
  }

  function setValues(startId, endId, startTime, endTime) {
    populateSelect(document.getElementById(startId), startTime);
    populateSelect(document.getElementById(endId), endTime);
  }

  function validatePair(startId, endId) {
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
  };
})(typeof window !== 'undefined' ? window : globalThis);
