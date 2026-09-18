(function () {
  var embed = window.HubOrganiserEmbedBootstrap || {};

  function initEmbedDrawerNav() {
    if (typeof embed.applyEmbedDrawerBodyClass === 'function') {
      embed.applyEmbedDrawerBodyClass();
    }
    var isEmbed =
      typeof embed.isEmbedDrawer === 'function' ? embed.isEmbedDrawer() : false;
    if (!isEmbed) return;
    var backBtn = document.getElementById('ecs-embed-back-tickets');
    var ids =
      typeof embed.eventIdsFromSearch === 'function' ? embed.eventIdsFromSearch() : [];
    if (backBtn && ids.length) {
      backBtn.hidden = false;
      backBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (
          typeof embed.notifyParent === 'function' &&
          embed.notifyParent('hub-event-goto-tickets', {
            eventIds: ids,
            title: '',
          })
        ) {
          return;
        }
        location.href =
          '/organiser/event-tickets?ids=' +
          encodeURIComponent(ids.join(',')) +
          '&embed=1';
      });
    }
    if (typeof embed.notifyEmbedDrawerReady === 'function') {
      embed.notifyEmbedDrawerReady('tickets');
    }
  }

  initEmbedDrawerNav();

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
  var usedPrefetch = false;

  var blocked = qs('ecs-blocked');
  var slotsCard = qs('ecs-slots-card');
  var formCard = qs('ecs-form-card');
  var devSection = qs('ecs-developer-section');
  var slotStatus = qs('ecs-slot-status');
  var saveStatus = qs('ecs-save-status');
  var slotsSelection = [];
  var slotsSaveBound = false;

  if (slotStatus && eventId) {
    slotStatus.hidden = false;
    slotStatus.textContent = 'Loading Connected setup…';
  }

  function organiserIdForEvent(ev) {
    return String(ev.organiserGroupId || (ev.organiserGroupIds && ev.organiserGroupIds[0]) || '').trim();
  }

  function eventOnAssignedSlot(ev) {
    var oid = organiserIdForEvent(ev);
    if (!oid || !assignedIds.length) return false;
    return assignedIds.indexOf(oid) >= 0;
  }

  function applyBillingSlots(bill) {
    billing = bill || {};
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
  }

  function hideSlotsCard() {
    if (slotsCard) slotsCard.hidden = true;
  }

  function showBlocked(msg) {
    hideSlotsCard();
    if (blocked) {
      blocked.hidden = false;
      blocked.textContent = msg;
    }
    if (formCard) formCard.hidden = true;
    if (devSection) devSection.hidden = true;
    if (slotStatus) slotStatus.hidden = true;
    if (typeof embed.notifyEmbedDrawerBusy === 'function') {
      embed.notifyEmbedDrawerBusy(false, '', 'tickets');
    }
    if (typeof embed.notifyEmbedDrawerReady === 'function') {
      embed.notifyEmbedDrawerReady('tickets');
    }
  }

  function eventOrganiserMeta() {
    var oid = loadedEvent ? organiserIdForEvent(loadedEvent) : '';
    var orgs = (billing && billing.slots && billing.slots.accountOrganisers) || [];
    var match = orgs.filter(function (o) {
      return String(o.id) === String(oid);
    })[0];
    return {
      id: oid,
      name: (match && match.name) || (loadedEvent && loadedEvent.organiserName) || 'this organiser page',
    };
  }

  function renderSlotsList() {
    var list = qs('ecs-slots-list');
    var hint = qs('ecs-slots-hint');
    if (!list || !billing || !billing.slots) return;
    var limit = billing.groupLimit;
    var organisers = billing.slots.accountOrganisers || [];
    slotsSelection = (billing.slots.assignedOrganiserIds || []).slice();
    var eventOrg = eventOrganiserMeta();

    if (slotsSelection.length === 0 && eventOrg.id) {
      slotsSelection = [eventOrg.id];
    }

    if (hint) {
      var limitText =
        limit != null
          ? 'Your plan includes ' +
            limit +
            ' organiser page' +
            (limit === 1 ? '' : 's') +
            ' on Connected.'
          : '';
      hint.textContent =
        (limitText ? limitText + ' ' : '') +
        'This event is under “' +
        eventOrg.name +
        '” — include that page in your selection, then save.';
    }

    list.innerHTML = '';
    organisers.forEach(function (org) {
      var li = document.createElement('li');
      li.className = 'cb-slots-list-item';
      var checked = slotsSelection.indexOf(org.id) >= 0;
      var isEventPage = String(org.id) === String(eventOrg.id);
      li.innerHTML =
        '<label class="cb-slots-label">' +
        '<input type="checkbox" data-org-id="' +
        org.id +
        '"' +
        (checked ? ' checked' : '') +
        ' /> ' +
        '<span>' +
        (org.name || 'Organiser page') +
        (isEventPage ? ' <strong>(this event)</strong>' : '') +
        '</span></label>';
      list.appendChild(li);
    });

    list.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var id = cb.getAttribute('data-org-id');
        if (cb.checked) {
          if (slotsSelection.indexOf(id) < 0) slotsSelection.push(id);
          if (limit != null && slotsSelection.length > limit) {
            slotsSelection = slotsSelection.slice(-limit);
            list.querySelectorAll('input[type=checkbox]').forEach(function (other) {
              var oid = other.getAttribute('data-org-id');
              other.checked = slotsSelection.indexOf(oid) >= 0;
            });
          }
        } else {
          slotsSelection = slotsSelection.filter(function (x) {
            return x !== id;
          });
        }
      });
    });

    if (!slotsSaveBound) {
      slotsSaveBound = true;
      var saveBtn = qs('ecs-slots-save');
      if (saveBtn) {
        saveBtn.addEventListener('click', saveSlotsAssignment);
      }
      var backBtn = qs('ecs-slots-back-tickets');
      if (backBtn) {
        backBtn.hidden = false;
        backBtn.addEventListener('click', function (e) {
          e.preventDefault();
          var ids =
            typeof embed.eventIdsFromSearch === 'function' ? embed.eventIdsFromSearch() : [];
          if (!ids.length && eventId) ids = [eventId];
          if (
            typeof embed.notifyParent === 'function' &&
            embed.notifyParent('hub-event-goto-tickets', { eventIds: ids, title: '' })
          ) {
            return;
          }
          if (ids.length) {
            location.href =
              '/organiser/event-tickets?ids=' + encodeURIComponent(ids.join(',')) + '&embed=1';
          }
        });
      }
    }
  }

  function saveSlotsAssignment() {
    var status = qs('ecs-slots-status');
    var saveBtn = qs('ecs-slots-save');
    if (!slotsSelection.length) {
      if (status) {
        status.hidden = false;
        status.className = 'ee-hint ee-alert-warn';
        status.textContent = 'Select at least one organiser page.';
      }
      return;
    }
    if (saveBtn) saveBtn.disabled = true;
    if (status) {
      status.hidden = false;
      status.className = 'ee-hint';
      status.textContent = 'Saving…';
    }
    api('/api/organiser/connected-booking', {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'assign_connected_slots',
        organiserIds: slotsSelection,
      }),
    })
      .then(function (res) {
        if (saveBtn) saveBtn.disabled = false;
        if (!res.ok) {
          if (status) {
            status.className = 'ee-hint ee-alert-warn';
            status.textContent = res.data.message || res.data.error || 'Could not save assignment.';
          }
          return;
        }
        applyBillingSlots(res.data);
        if (typeof embed.writeConnectedSetupPrefetch === 'function' && loadedEvent) {
          embed.writeConnectedSetupPrefetch(eventId, loadedEvent, billing);
        }
        if (status) {
          status.className = 'ee-hint ee-alert-ok';
          status.textContent = 'Saved. You can set up this event below.';
        }
        refreshAccess();
      })
      .catch(function () {
        if (saveBtn) saveBtn.disabled = false;
        if (status) {
          status.className = 'ee-hint ee-alert-warn';
          status.textContent = 'Could not save. Try again.';
        }
      });
  }

  function showSlotsAssignmentPanel() {
    if (blocked) blocked.hidden = true;
    if (formCard) formCard.hidden = true;
    if (devSection) devSection.hidden = true;
    if (slotStatus) slotStatus.hidden = true;
    if (slotsCard) slotsCard.hidden = false;
    renderSlotsList();
    if (typeof embed.notifyEmbedDrawerBusy === 'function') {
      embed.notifyEmbedDrawerBusy(false, '', 'tickets');
    }
    if (typeof embed.notifyEmbedDrawerReady === 'function') {
      embed.notifyEmbedDrawerReady('tickets');
    }
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

  var ownSiteProvider = null;

  function ownSiteSampleJson() {
    return JSON.stringify(
      {
        eventId: eventId || 'YOUR_TNH_EVENT_UUID',
        orderId: 'your-booking-ref-123',
        email: 'buyer@example.com',
        name: 'Buyer Name',
        quantity: 1,
        amountPaid: 15,
        status: 'confirmed',
      },
      null,
      2
    );
  }

  function applyOwnSiteWebhookUi() {
    var urlEl = qs('ecs-own-site-webhook-url');
    var hintEl = qs('ecs-own-site-webhook-hint');
    var enableBtn = qs('ecs-enable-own-site');
    var sampleEl = qs('ecs-own-site-sample');
    if (sampleEl) sampleEl.textContent = ownSiteSampleJson();

    var own = ownSiteProvider;
    if (urlEl) {
      urlEl.textContent = own && own.webhookUrl ? own.webhookUrl : 'Enable below to generate your webhook URL.';
    }
    if (hintEl) {
      hintEl.textContent =
        own && own.webhookUrl
          ? 'POST Content-Type: application/json to this URL after each completed booking.'
          : 'One click enables the URL — paste it into your site automation.';
    }
    if (enableBtn) {
      enableBtn.hidden = Boolean(own && own.webhookUrl);
    }
  }

  function loadOwnSiteProvider() {
    if (!eventId) return Promise.resolve();
    return api('/api/organiser/connected-booking-providers?eventId=' + encodeURIComponent(eventId)).then(
      function (res) {
        if (!res.ok || !res.data || !res.data.ok) return;
        var list = res.data.providers || [];
        ownSiteProvider = list.find(function (p) {
          return p.id === 'own_site';
        }) || null;
        applyOwnSiteWebhookUi();
      }
    );
  }

  function applyWebhookMeta() {
    var site = location.origin.replace(/\/$/, '');
    var wUrl = qs('ecs-webhook-url');
    if (wUrl) wUrl.textContent = site + '/api/integrations/booking';
    if (billing && billing.accountId) {
      var aw = qs('ecs-account-id-wrap');
      var ae = qs('ecs-account-id');
      if (ae) ae.textContent = billing.accountId;
      if (aw) aw.hidden = false;
    }
    applyOwnSiteWebhookUi();
    loadOwnSiteProvider();
  }

  function refreshAccess() {
    if (!billing || !billing.ok || !billing.active) {
      showBlocked(
        'Connected booking is not active. Open Connected booking to subscribe or use your pilot access, then assign your organiser page.'
      );
      return;
    }

    if (
      (billing.slots && billing.slots.needsAssignment) ||
      (loadedEvent && !eventOnAssignedSlot(loadedEvent))
    ) {
      showSlotsAssignmentPanel();
      return;
    }

    hideSlotsCard();
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

    applyWebhookMeta();

    if (typeof embed.notifyEmbedDrawerBusy === 'function') {
      embed.notifyEmbedDrawerBusy(false, '', 'tickets');
    }
    if (typeof embed.notifyEmbedDrawerReady === 'function') {
      embed.notifyEmbedDrawerReady('tickets');
    }
  }

  function tryPrefetch() {
    if (!eventId || typeof embed.readConnectedSetupPrefetch !== 'function') return false;
    var hit = embed.readConnectedSetupPrefetch(eventId);
    if (!hit || !hit.event) return false;
    usedPrefetch = true;
    applyEvent(hit.event);
    if (hit.billing) {
      applyBillingSlots(hit.billing);
      refreshAccess();
    }
    return true;
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
    loadedEvent = Object.assign({}, loadedEvent, payload);
    if (typeof embed.writeConnectedSetupPrefetch === 'function') {
      embed.writeConnectedSetupPrefetch(eventId, loadedEvent, billing);
    }
    setStatus(saveStatus, publish ? 'Published with Connected booking.' : 'Saved.', 'ok');
  }

  function loadFromNetwork() {
    if (typeof embed.notifyEmbedDrawerBusy === 'function' && !usedPrefetch) {
      embed.notifyEmbedDrawerBusy(true, 'Loading Connected setup…', 'tickets');
    }
    return Promise.all([
      api('/api/organiser/events?id=' + encodeURIComponent(eventId)),
      usedPrefetch && billing && billing.ok
        ? Promise.resolve({ ok: true, data: billing })
        : api('/api/organiser/connected-booking'),
    ]).then(function (results) {
      var evRes = results[0];
      var billRes = results[1];

      if (!evRes.ok || !evRes.data.event) {
        if (!usedPrefetch) {
          showBlocked(evRes.data?.message || 'Could not load this event.');
        }
        return;
      }

      applyBillingSlots(billRes.data || {});
      applyEvent(evRes.data.event);
      if (typeof embed.writeConnectedSetupPrefetch === 'function') {
        embed.writeConnectedSetupPrefetch(eventId, loadedEvent, billing);
      }
      refreshAccess();
    });
  }

  if (!eventId) {
    showBlocked(
      'No event selected. Open an event from My Events → Set up tickets, then use Connected event setup — or add ?id=your-event-id to this page URL.'
    );
  } else {
    tryPrefetch();
    loadFromNetwork().catch(function () {
      if (!usedPrefetch) {
        showBlocked('Could not load Connected setup. Try again.');
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

  var enableOwnBtn = qs('ecs-enable-own-site');
  if (enableOwnBtn) {
    enableOwnBtn.addEventListener('click', function () {
      enableOwnBtn.disabled = true;
      api('/api/organiser/connected-booking-providers', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'enable_provider', provider: 'own_site' }),
      })
        .then(function (res) {
          enableOwnBtn.disabled = false;
          if (!res.ok) {
            window.alert(res.data.message || res.data.error || 'Could not enable webhook.');
            return;
          }
          if (res.data.connection && res.data.connection.webhookUrl) {
            ownSiteProvider = {
              id: 'own_site',
              webhookUrl: res.data.connection.webhookUrl,
            };
          }
          applyOwnSiteWebhookUi();
          loadOwnSiteProvider();
        })
        .catch(function () {
          enableOwnBtn.disabled = false;
          window.alert('Could not enable webhook.');
        });
    });
  }
})();
