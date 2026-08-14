/**
 * /add-your-event — field tips + submit event details for staff to list.
 */
(function (global) {
  global.EventIntakeFieldTips = {
    'ei-dates': {
      title: 'Date(s)',
      body:
        'One date, several dates, or a simple pattern is fine — e.g. Fri 12 Sep 2026, or every Friday from September. We will put the real calendar dates on the listing.',
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
        'How they get a place on the day. Free or paid tickets are for this event. Membership is joining your group. Tickets + membership is both: visitors pay a ticket, members book at a member rate. We set up card payments, VAT, and refunds when we list it.',
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
        'People attend because they join your group (monthly or annual fee), not by buying a one-off ticket. Tell us the membership price and term in the box that appears.',
    },
    'ei-pay-both': {
      title: 'Tickets + membership',
      body:
        'Visitors buy a ticket for this event. People already in your group book at a member rate (often £0 if membership covers the meeting). Tell us both prices in the box that appears.',
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
