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

  function syncFormat() {
    var checked = form.querySelector('input[name="format"]:checked');
    var isOnline = checked && checked.value === 'Online';
    if (inPersonEl) inPersonEl.hidden = !!isOnline;
    if (onlineEl) onlineEl.hidden = !isOnline;
  }

  function syncPricing() {
    var checked = form.querySelector('input[name="pricing"]:checked');
    var isPaid = checked && checked.value === 'Paid';
    if (ticketWrap) ticketWrap.hidden = !isPaid;
  }

  form.querySelectorAll('input[name="format"]').forEach(function (el) {
    el.addEventListener('change', syncFormat);
  });
  form.querySelectorAll('input[name="pricing"]').forEach(function (el) {
    el.addEventListener('change', syncPricing);
  });
  syncFormat();
  syncPricing();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    setStatus('', '');

    var fd = new FormData(form);
    var payload = {
      name: String(fd.get('name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      group: String(fd.get('group') || '').trim(),
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
      pricing: String(fd.get('pricing') || 'Free').trim(),
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
          syncPricing();
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
