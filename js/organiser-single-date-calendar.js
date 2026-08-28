/**
 * Single-date month calendar for organiser forms (open days, etc.).
 */
(function (global) {
  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function dateKey(y, m, d) {
    return y + '-' + pad2(m + 1) + '-' + pad2(d);
  }

  function parseDateKey(key) {
    const parts = String(key || '').trim().split('-').map(Number);
    if (!parts[0] || !parts[1] || !parts[2]) return null;
    return { y: parts[0], m: parts[1] - 1, d: parts[2] };
  }

  function formatSelectedLabel(key) {
    const parsed = parseDateKey(key);
    if (!parsed) return '';
    const dt = new Date(parsed.y, parsed.m, parsed.d);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  function init(options) {
    const opts = options || {};
    const container = document.getElementById(opts.containerId);
    const hiddenInput = document.getElementById(opts.inputId);
    const labelEl = opts.labelId ? document.getElementById(opts.labelId) : null;
    if (!container || !hiddenInput) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let calYear = today.getFullYear();
    let calMonth = today.getMonth();
    let selectedKey = String(hiddenInput.value || '').trim();

    container.innerHTML =
      '<div class="org-cal" role="group" aria-label="Choose a date">' +
      '<div class="org-cal-header">' +
      '<button type="button" class="org-cal-nav" data-cal-nav="prev" aria-label="Previous month">‹</button>' +
      '<span class="org-cal-month" data-cal-month-label></span>' +
      '<button type="button" class="org-cal-nav" data-cal-nav="next" aria-label="Next month">›</button>' +
      '</div>' +
      '<div class="org-cal-weekdays" aria-hidden="true">' +
      '<span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>' +
      '</div>' +
      '<div class="org-cal-days" data-cal-days></div>' +
      '</div>';

    const monthLabel = container.querySelector('[data-cal-month-label]');
    const grid = container.querySelector('[data-cal-days]');

    function syncLabel() {
      if (!labelEl) return;
      const text = formatSelectedLabel(selectedKey);
      labelEl.textContent = text;
      labelEl.hidden = !text;
    }

    function syncInput() {
      hiddenInput.value = selectedKey || '';
      hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
      syncLabel();
      if (typeof opts.onChange === 'function') opts.onChange(selectedKey);
    }

    function render() {
      if (selectedKey) {
        const parsed = parseDateKey(selectedKey);
        if (parsed) {
          calYear = parsed.y;
          calMonth = parsed.m;
        }
      }

      const first = new Date(calYear, calMonth, 1);
      if (monthLabel) {
        monthLabel.textContent = first.toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
        });
      }

      const startDow = (first.getDay() + 6) % 7;
      const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
      const prevMonthDays = new Date(calYear, calMonth, 0).getDate();

      grid.innerHTML = '';

      for (let i = 0; i < startDow; i++) {
        const day = prevMonthDays - startDow + i + 1;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'org-cal-day is-other';
        btn.textContent = String(day);
        btn.disabled = true;
        btn.tabIndex = -1;
        grid.appendChild(btn);
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const key = dateKey(calYear, calMonth, d);
        const cellDate = new Date(calYear, calMonth, d);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'org-cal-day';
        btn.textContent = String(d);
        btn.setAttribute('data-date-key', key);
        if (key === selectedKey) {
          btn.classList.add('is-selected');
          btn.setAttribute('aria-pressed', 'true');
        } else {
          btn.setAttribute('aria-pressed', 'false');
        }
        if (cellDate < today) {
          btn.classList.add('is-past');
          btn.disabled = true;
        } else {
          btn.addEventListener('click', function () {
            selectedKey = key;
            syncInput();
            render();
          });
        }
        grid.appendChild(btn);
      }

      const totalCells = startDow + daysInMonth;
      const trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
      for (let i = 1; i <= trailing; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'org-cal-day is-other';
        btn.textContent = String(i);
        btn.disabled = true;
        btn.tabIndex = -1;
        grid.appendChild(btn);
      }

      syncLabel();
    }

    container.addEventListener('click', function (e) {
      const nav = e.target.closest('[data-cal-nav]');
      if (!nav) return;
      if (nav.getAttribute('data-cal-nav') === 'prev') {
        calMonth -= 1;
        if (calMonth < 0) {
          calMonth = 11;
          calYear -= 1;
        }
      } else {
        calMonth += 1;
        if (calMonth > 11) {
          calMonth = 0;
          calYear += 1;
        }
      }
      render();
    });

    render();

    return {
      getValue: function () {
        return String(hiddenInput.value || '').trim();
      },
      setValue: function (key) {
        selectedKey = String(key || '').trim();
        syncInput();
        render();
      },
      clear: function () {
        selectedKey = '';
        syncInput();
        calYear = today.getFullYear();
        calMonth = today.getMonth();
        render();
      },
      render: render,
    };
  }

  global.OrganiserSingleDateCalendar = {
    init: init,
    formatSelectedLabel: formatSelectedLabel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
