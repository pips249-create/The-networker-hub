(function () {
  function qs(id) {
    return document.getElementById(id);
  }

  function eventIdFromQuery() {
    var params = new URLSearchParams(location.search);
    var single = String(params.get('id') || params.get('eventId') || '').trim();
    if (single) return single;
    var ids = String(params.get('ids') || '')
      .split(',')
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    return ids[0] || '';
  }

  function api(path, opts) {
    return fetch(path, Object.assign({ credentials: 'include', headers: { 'Content-Type': 'application/json' } }, opts || {})).then(
      function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      }
    );
  }

  function setStatus(el, msg, kind) {
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || '';
    el.className =
      'ee-hint' +
      (kind === 'error' ? ' ee-alert-warn' : kind === 'ok' ? ' ee-alert-ok' : '');
  }

  var eventId = eventIdFromQuery();
  var billing = null;
  var loadedEvent = null;
  var assignedIds = [];

  var blocked = qs('ecs-blocked');
  var formCard = qs('ecs-form-card');
  var devSection = qs('ecs-developer-section');
  var slotStatus = qs('ecs-slot-status');
  var saveStatus = qs('ecs-save-status');

  function organiserIdForEvent(ev) {
    return String(ev.organiserGroupId || (ev.organiserGroupIds && ev.organiserGroupIds[0]) || '').trim();
  }

  function eventOnAssignedSlot(ev) {
    var oid = organiserIdForEvent(ev);
    if (!oid || !assignedIds.length) return false;
    return assignedIds.indexOf(oid) >= 0;
  }

  function showBlocked(msg) {
    if (blocked) {
      blocked.hidden = false;
      blocked.textContent = msg;
    }
    if (formCard) formCard.hidden = true;
    if (devSection) devSection.hidden = true;
  }

  function applyEvent(ev) {
    loadedEvent = ev;
    var titleEl = qs('ecs-event-title');
    if (titleEl && ev) titleEl.textContent = ev.title ? 'Event: ' + ev.title : '';

    var editLink = qs('ecs-edit-event-link');
    if (editLink && eventId) {
      editLink.href = '/organiser/event-edit?id=' + encodeURIComponent(eventId);
      editLink.hidden = false;
    }

    if (qs('ecs-price-label')) qs('ecs-price-label').value = ev.externalPriceLabel || ev.external_price_label || '';
    if (qs('ecs-booking-url')) qs('ecs-booking-url').value = ev.externalBookingUrl || ev.external_booking_url || '';
    if (qs('ecs-event-id')) qs('ecs-event-id').textContent = eventId;
    if (qs('ecs-event-id-wrap')) qs('ecs-event-id-wrap').hidden = !eventId;
  }

  function refreshAccess() {
    if (!billing || !billing.ok || !billing.active) {
      showBlocked(
        'Connected booking is not active. Open Connected booking to subscribe or use your pilot access, then assign your organiser page.'
      );
      return;
    }

    if (billing.slots && billing.slots.needsAssignment) {
      showBlocked(
        'Choose which organiser page(s) use your Connected plan before setting up events. Open Connected booking → Apply your plan.'
      );
      return;
    }

    if (loadedEvent && !eventOnAssignedSlot(loadedEvent)) {
      showBlocked(
        'This event belongs to an organiser page that is not on your Connected plan. Reassign slots on Connected booking, or create the event under an assigned page.'
      );
      return;
    }

    if (blocked) blocked.hidden = true;
    if (formCard) formCard.hidden = false;
    if (devSection) devSection.hidden = false;
    if (slotStatus && billing.plan) {
      slotStatus.hidden = false;
      slotStatus.textContent =
        'Connected plan: ' +
        billing.plan +
        ' — this event uses one of your assigned organiser page slot(s).';
    }

    var hubNote = qs('ecs-hub-tickets-note');
    if (hubNote) hubNote.hidden = false;
  }

  async function saveConnected(publish) {
    if (!loadedEvent || !billing || !billing.active) return;
    var price = qs('ecs-price-label') ? qs('ecs-price-label').value.trim() : '';
    var url = qs('ecs-booking-url') ? qs('ecs-booking-url').value.trim() : '';
    if (!price) {
      setStatus(saveStatus, 'Enter the price shown on the listing.', 'error');
      return;
    }
    if (publish && !url) {
      setStatus(saveStatus, 'Enter your booking page URL before publishing.', 'error');
      return;
    }

    setStatus(saveStatus, 'Saving…');
    var payload = {
      id: eventId,
      title: loadedEvent.title,
      organiserGroupId: organiserIdForEvent(loadedEvent),
      checkoutMode: 'external_connected',
      externalPriceLabel: price,
      externalBookingUrl: url,
      listingStatus: publish ? 'published' : 'draft',
    };

    var res = await api('/api/organiser/events', { method: 'PATCH', body: JSON.stringify(payload) });
    if (!res.ok) {
      setStatus(saveStatus, res.data.message || res.data.error || 'Could not save.', 'error');
      return;
    }
    setStatus(saveStatus, publish ? 'Published with Connected booking.' : 'Saved.', 'ok');
  }

  if (!eventId) {
    showBlocked(
      'No event selected. Open an event from My Events → Set up tickets, then use Connected event setup — or add ?id=your-event-id to this page URL.'
    );
  } else {
    Promise.all([
      api('/api/organiser/events?id=' + encodeURIComponent(eventId)),
      api('/api/organiser/connected-booking'),
    ]).then(function (results) {
      var evRes = results[0];
      var billRes = results[1];

      if (!evRes.ok || !evRes.data.event) {
        showBlocked(evRes.data?.message || 'Could not load this event.');
        return;
      }

      billing = billRes.data || {};
      assignedIds =
        (billing.slots && billing.slots.assignedOrganiserIds) ||
        (billing.slots && billing.slots.accountOrganisers
          ? billing.slots.accountOrganisers.filter(function (o) {
              return o.slotAssigned;
            }).map(function (o) {
              return o.id;
            })
          : []) ||
        [];

      applyEvent(evRes.data.event);
      refreshAccess();

      var site = location.origin.replace(/\/$/, '');
      var wUrl = qs('ecs-webhook-url');
      if (wUrl) wUrl.textContent = site + '/api/integrations/booking';
      if (billing.accountId) {
        var aw = qs('ecs-account-id-wrap');
        var ae = qs('ecs-account-id');
        if (ae) ae.textContent = billing.accountId;
        if (aw) aw.hidden = false;
      }
    });
  }

  var saveBtn = qs('ecs-save');
  var pubBtn = qs('ecs-publish');
  if (saveBtn) saveBtn.addEventListener('click', function () {
    saveConnected(false);
  });
  if (pubBtn) pubBtn.addEventListener('click', function () {
    saveConnected(true);
  });
})();
