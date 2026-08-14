/**
 * /add-your-event — submit event details for staff to list.
 */
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

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    setStatus('', '');

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
          syncFormat();
          syncPayHow();
          syncTrial();
          return;
        }
        setStatus(
          (result.data && result.data.message) ||
            'Could not send your details. Email hello@thenetworkerhub.com instead.',
          'error'
        );
      })
      .catch(function () {
        setStatus('Could not send your details. Email hello@thenetworkerhub.com instead.', 'error');
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send event details →';
        }
      });
  });
})();
