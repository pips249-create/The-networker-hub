/**
 * /add-your-event — field tips + submit event details for staff to list.
 */
(function (global) {
  global.EventIntakeFieldTips = {
    'ei-dates': {
      title: 'Date(s)',
      body:
        'Click every date this event runs — one click per meeting day. Weekly breakfasts: tap each Friday. A conference: tap every day you meet. The same start and end time apply to all selected dates.',
    },
    'ei-format': {
      title: 'Format',
      body:
        'In person = people meet at a venue. Online = Zoom, Teams, or similar. Choose the main way people attend.',
    },
    'ei-meeting-link': {
      title: 'Meeting / join link',
      body:
        'Optional for now. We only share the link with people who have a place — it is not shown on the public listing. You can send it later.',
    },
    'ei-get-in': {
      title: 'How should people get in?',
      body:
        'This is who can take a seat. General ticketing = anyone can book. Application based = you approve each person first, often one per industry or role.',
    },
    'ei-get-in-general': {
      title: 'General ticketing',
      body:
        'Anyone can book until the event is full. No application and no approval step. Typical for open networking breakfasts and mixers.',
    },
    'ei-get-in-application': {
      title: 'Application based',
      body:
        'People apply (industry and job title). You approve or decline so you can keep a mix of seats — e.g. one accountant, one solicitor. Use this for category exclusivity.',
    },
    'ei-pay-how': {
      title: 'How do people pay / get access?',
      body:
        'How they get a place on the day. Free or paid tickets are for this event. Membership is for a new group: try meetings, then join to come regularly. Tickets + membership is for growing an existing group: guests try free then join, and members book at a different price (often free). We set up card payments, VAT, and refunds when we list it.',
    },
    'ei-pay-free': {
      title: 'Free tickets',
      body:
        'No charge to book this event. People still reserve a place so you know who is coming.',
    },
    'ei-pay-paid': {
      title: 'Paid tickets',
      body:
        'Guests pay a ticket price for this event (one-off). Tell us the price in the box that appears — we will add card payments when we list it.',
    },
    'ei-pay-membership': {
      title: 'Membership',
      body:
        'For a new group: they try your meetings, then join so they can attend regularly (monthly or annual fee). Tell us the membership price and term in the box that appears.',
    },
    'ei-pay-both': {
      title: 'Tickets + membership',
      body:
        'For growing an existing group. Guests try meetings free, then join to come regularly. Your existing members book at a different price, or for free. Tell us both prices in the box that appears.',
    },
    'ei-max-places': {
      title: 'Max places',
      body:
        'Optional room or Zoom cap for this date — the total number of people you can take. Leave blank if there is no limit.',
    },
    'ei-trial': {
      title: 'Free trial visits',
      body:
        'Let new people try one or more meetings before they join or buy. If yes, say how many visits in the details box. Hub maximum is usually 3.',
    },
    'ei-ticket-details': {
      title: 'Prices and membership details',
      body:
        'Write the numbers in plain English — e.g. Guest £25, Member £0, Membership £40/month. We copy this onto the listing for you.',
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

(function () {
  var form = document.getElementById('ei-form');
  if (!form) return;

  var submitBtn = document.getElementById('ei-submit');
  var statusEl = document.getElementById('ei-status');
  var inPersonEl = document.getElementById('ei-location-inperson');
  var onlineEl = document.getElementById('ei-location-online');
  var ticketWrap = document.getElementById('ei-ticket-details-wrap');
  var ticketField = document.getElementById('ei-ticket-details');
  var ticketLabel = document.getElementById('ei-ticket-details-label');
  var trialWrap = document.getElementById('ei-trial-details-wrap');

  var PAY_COPY = {
    paid_tickets: {
      label: 'Ticket prices',
      placeholder: 'e.g. Guest £25 · early bird £20',
    },
    membership: {
      label: 'Membership details',
      placeholder: 'e.g. £40/month or £400/year',
    },
    both: {
      label: 'Ticket / membership details',
      placeholder: 'e.g. Guest £25 · Member £0 · Membership £40/month',
    },
    application: {
      label: 'Application notes <span class="ei-optional">(optional)</span>',
      placeholder: 'e.g. one seat per industry',
    },
  };

  function setStatus(message, tone) {
    if (!statusEl) return;
    if (!message) {
      statusEl.hidden = true;
      statusEl.textContent = '';
      statusEl.className = 'ei-status';
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.className = 'ei-status' + (tone === 'ok' ? ' is-ok' : tone === 'error' ? ' is-error' : '');
  }

  function selectedValue(name, fallback) {
    var checked = form.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : fallback;
  }

  function syncFormat() {
    var isOnline = selectedValue('format', 'In person') === 'Online';
    if (inPersonEl) inPersonEl.hidden = !!isOnline;
    if (onlineEl) onlineEl.hidden = !isOnline;
  }

  function syncPayHow() {
    var payHow = selectedValue('payHow', 'free_tickets');
    var door = selectedValue('attendanceDoor', 'general');
    var needsPrices = payHow === 'paid_tickets' || payHow === 'membership' || payHow === 'both';
    var showNotes = needsPrices || door === 'category_exclusivity';
    if (ticketWrap) ticketWrap.hidden = !showNotes;
    if (!ticketLabel || !ticketField) return;
    var copy = needsPrices
      ? PAY_COPY[payHow]
      : door === 'category_exclusivity'
        ? PAY_COPY.application
        : null;
    if (!copy) return;
    ticketLabel.innerHTML = copy.label;
    ticketField.placeholder = copy.placeholder;
    ticketField.required = needsPrices;
  }

  function syncTrial() {
    var yes = selectedValue('freeTrialVisits', 'no') === 'yes';
    if (trialWrap) trialWrap.hidden = !yes;
  }

  form.querySelectorAll('input[name="format"]').forEach(function (el) {
    el.addEventListener('change', syncFormat);
  });
  form.querySelectorAll('input[name="payHow"]').forEach(function (el) {
    el.addEventListener('change', syncPayHow);
  });
  form.querySelectorAll('input[name="attendanceDoor"]').forEach(function (el) {
    el.addEventListener('change', syncPayHow);
  });
  form.querySelectorAll('input[name="freeTrialVisits"]').forEach(function (el) {
    el.addEventListener('change', syncTrial);
  });
  syncFormat();
  syncPayHow();
  syncTrial();

  var selectedDates = {};
  var calNow = new Date();
  var calYear = calNow.getFullYear();
  var calMonth = calNow.getMonth();
  var datesInput = document.getElementById('ei-dates');
  var calDays = document.getElementById('ei-cal-days');
  var calLabel = document.getElementById('ei-cal-month-label');
  var dateCount = document.getElementById('ei-date-count');
  var dateList = document.getElementById('ei-date-list');

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function dateKey(y, m, d) {
    return y + '-' + pad2(m + 1) + '-' + pad2(d);
  }

  function parseDateKey(key) {
    var parts = String(key || '').split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatDateLabel(key) {
    return parseDateKey(key).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function selectedDateKeys() {
    return Object.keys(selectedDates).sort();
  }

  function syncDatesField() {
    var keys = selectedDateKeys();
    var labels = keys.map(formatDateLabel);
    if (datesInput) datesInput.value = labels.join(', ');
    if (dateCount) dateCount.textContent = String(keys.length);
    if (dateList) {
      dateList.innerHTML = keys
        .map(function (k) {
          return '<li>' + formatDateLabel(k) + '</li>';
        })
        .join('');
    }
  }

  function renderCalendar() {
    if (!calDays) return;
    var first = new Date(calYear, calMonth, 1);
    if (calLabel) {
      calLabel.textContent = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
    var startDow = (first.getDay() + 6) % 7;
    var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var html = '';
    var prevMonthDays = new Date(calYear, calMonth, 0).getDate();
    var i;
    for (i = 0; i < startDow; i++) {
      html +=
        '<button type="button" class="ei-cal-day is-other" disabled>' +
        (prevMonthDays - startDow + i + 1) +
        '</button>';
    }
    for (var d = 1; d <= daysInMonth; d++) {
      var key = dateKey(calYear, calMonth, d);
      var cell = new Date(calYear, calMonth, d);
      var past = cell < today;
      var selected = !!selectedDates[key];
      html +=
        '<button type="button" class="ei-cal-day' +
        (selected ? ' is-selected' : '') +
        (past ? ' is-past' : '') +
        '" data-date-key="' +
        key +
        '"' +
        (past ? ' disabled' : '') +
        '>' +
        d +
        '</button>';
    }
    var totalCells = startDow + daysInMonth;
    var trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (i = 1; i <= trailing; i++) {
      html += '<button type="button" class="ei-cal-day is-other" disabled>' + i + '</button>';
    }
    calDays.innerHTML = html;
  }

  function clearCalendar() {
    selectedDates = {};
    var now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
    renderCalendar();
    syncDatesField();
  }

  if (calDays) {
    calDays.addEventListener('click', function (e) {
      var btn = e.target.closest('.ei-cal-day');
      if (!btn || btn.disabled || !btn.getAttribute('data-date-key')) return;
      var key = btn.getAttribute('data-date-key');
      if (selectedDates[key]) delete selectedDates[key];
      else selectedDates[key] = true;
      renderCalendar();
      syncDatesField();
    });
  }
  var prevBtn = document.getElementById('ei-cal-prev');
  var nextBtn = document.getElementById('ei-cal-next');
  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      calMonth -= 1;
      if (calMonth < 0) {
        calMonth = 11;
        calYear -= 1;
      }
      renderCalendar();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      calMonth += 1;
      if (calMonth > 11) {
        calMonth = 0;
        calYear += 1;
      }
      renderCalendar();
    });
  }
  renderCalendar();
  syncDatesField();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    setStatus('', '');

    if (!selectedDateKeys().length) {
      setStatus('Click at least one date on the calendar.', 'error');
      var cal = document.querySelector('.ei-calendar');
      if (cal && cal.scrollIntoView) cal.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    var fd = new FormData(form);
    var payload = {
      name: String(fd.get('name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      group: String(fd.get('group') || '').trim(),
      organiserWebsiteUrl: String(fd.get('organiserWebsiteUrl') || '').trim(),
      title: String(fd.get('title') || '').trim(),
      dates: String(fd.get('dates') || '').trim(),
      startTime: String(fd.get('startTime') || '').trim(),
      endTime: String(fd.get('endTime') || '').trim(),
      format: String(fd.get('format') || 'In person').trim(),
      venue: String(fd.get('venue') || '').trim(),
      address: String(fd.get('address') || '').trim(),
      city: String(fd.get('city') || '').trim(),
      postcode: String(fd.get('postcode') || '').trim(),
      meetingLink: String(fd.get('meetingLink') || '').trim(),
      attendanceDoor: String(fd.get('attendanceDoor') || 'general').trim(),
      payHow: String(fd.get('payHow') || 'free_tickets').trim(),
      maxPlaces: String(fd.get('maxPlaces') || '').trim(),
      freeTrialVisits: String(fd.get('freeTrialVisits') || 'no').trim(),
      freeTrialDetails: String(fd.get('freeTrialDetails') || '').trim(),
      ticketDetails: String(fd.get('ticketDetails') || '').trim(),
      description: String(fd.get('description') || '').trim(),
      photoUrl: String(fd.get('photoUrl') || '').trim(),
      notes: String(fd.get('notes') || '').trim(),
      website: String(fd.get('website') || '').trim(),
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
    }

    fetch('/api/event-intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data && result.data.ok) {
          setStatus(
            result.data.message || 'Thanks — we will list your event and email you when it is live.',
            'ok'
          );
          form.reset();
          clearCalendar();
          syncFormat();
          syncPayHow();
          syncTrial();
          return;
        }
        setStatus(
          (result.data && result.data.message) ||
            'Could not send your details. Email hello@thenetworkeruk.com instead.',
          'error'
        );
      })
      .catch(function () {
        setStatus('Could not send your details. Email hello@thenetworkeruk.com instead.', 'error');
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send event details →';
        }
      });
  });
})();
