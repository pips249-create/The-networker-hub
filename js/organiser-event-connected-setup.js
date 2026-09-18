(function () {
  var embed = window.HubOrganiserEmbedBootstrap || {};

  function isEmbedDrawer() {
    return typeof embed.isEmbedDrawer === 'function' ? embed.isEmbedDrawer() : false;
  }

  function eventIdsForNavigation() {
    if (typeof embed.eventIdsFromSearch === 'function') {
      var ids = embed.eventIdsFromSearch();
      if (ids.length) return ids;
    }
    return eventId ? [eventId] : [];
  }

  function notifyDrawerNav(type) {
    var ids = eventIdsForNavigation();
    var payload = {
      eventId: eventId,
      eventIds: ids,
      title: (loadedEvent && loadedEvent.title) || '',
    };
    if (typeof embed.notifyParent === 'function' && embed.notifyParent(type, payload)) {
      return true;
    }
    return false;
  }

  var embedNavBound = false;

  function bindEmbedDrawerNav() {
    if (!isEmbedDrawer() || embedNavBound) return;
    if (typeof embed.applyEmbedDrawerBodyClass === 'function') {
      embed.applyEmbedDrawerBodyClass();
    }
    var ids = eventIdsForNavigation();
    if (!ids.length && !eventId) return;
    embedNavBound = true;

    function wire(btn, type, fallbackHref) {
      if (!btn) return;
      btn.hidden = false;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (notifyDrawerNav(type)) return;
        if (fallbackHref) location.href = fallbackHref;
      });
    }

    wire(
      document.getElementById('ecs-embed-back-tickets'),
      'hub-event-goto-tickets',
      ids.length
        ? '/organiser/event-tickets?ids=' + encodeURIComponent(ids.join(',')) + '&embed=1'
        : ''
    );
    wire(
      document.getElementById('ecs-embed-back-edit'),
      'hub-event-goto-edit',
      eventId ? '/organiser/event-edit?id=' + encodeURIComponent(eventId) + '&embed=1' : ''
    );
    wire(
      document.getElementById('ecs-embed-back-location'),
      'hub-event-goto-location',
      eventId ? '/organiser/event-location?id=' + encodeURIComponent(eventId) + '&embed=1' : ''
    );
  }

  function initEmbedDrawerNav() {
    bindEmbedDrawerNav();
    if (isEmbedDrawer() && typeof embed.notifyEmbedDrawerReady === 'function') {
      embed.notifyEmbedDrawerReady('tickets');
    }
  }

  var platformPickerControl = null;
  var platformUrlInputBound = false;

  function syncBookingUrlPlaceholder(meta) {
    var urlInput = qs('ecs-booking-url');
    if (urlInput && meta && meta.placeholder) {
      urlInput.placeholder = meta.placeholder;
    }
  }

  function initPlatformPicker() {
    var picker = qs('ecs-platform-picker');
    var hub = window.HubConnectedPlatform;
    if (!picker || !hub || !eventId) return;
    if (!platformPickerControl) {
      platformPickerControl = hub.bindPicker(picker, eventId, function (platformKey, meta) {
        syncBookingUrlPlaceholder(meta);
        syncEventLinkPanel(platformKey);
        renderProviderWebhookCard(platformKey);
        updateOneTimeProviderStatus(platformKey);
      });
    }
    if (platformPickerControl) {
      syncBookingUrlPlaceholder(hub.PLATFORMS[platformPickerControl.getSelected()]);
    }
    var urlInput = qs('ecs-booking-url');
    if (urlInput && !platformUrlInputBound) {
      platformUrlInputBound = true;
      urlInput.addEventListener('input', function () {
        if (!hub || !platformPickerControl) return;
        var guess = hub.guessFromUrl(urlInput.value);
        if (guess && guess !== platformPickerControl.getSelected()) {
          platformPickerControl.apply(guess);
        }
        maybeAutofillExternalEventId(false);
        refreshEventLinkAutofillHint();
      });
    }
  }

  function restorePlatformSelection() {
    var hub = window.HubConnectedPlatform;
    if (!hub || !platformPickerControl) return;
    var fromQuery = String(new URLSearchParams(location.search).get('platform') || '').trim();
    if (fromQuery && hub.PLATFORMS[fromQuery]) {
      hub.setStored(eventId, fromQuery);
      platformPickerControl.apply(fromQuery);
      syncEventLinkPanel(fromQuery);
      renderProviderWebhookCard(fromQuery);
      return;
    }
    var fromUrl = hub.guessFromUrl(qs('ecs-booking-url') && qs('ecs-booking-url').value);
    var stored = hub.getStored(eventId);
    var chosen = fromUrl || stored || 'own_site';
    platformPickerControl.apply(chosen);
    renderProviderWebhookCard(chosen);
  }

  var PLATFORM_UI = {
    eventbrite: {
      label: 'Eventbrite',
      placeholder: 'https://www.eventbrite.co.uk/e/your-event-…',
      hint:
        'Paste your <strong>Eventbrite event URL</strong> above. Enable <strong>Eventbrite</strong> on ' +
        '<a href="/organiser/connected-booking#cb-providers-title">Connected booking → Booking providers</a>, ' +
        'link this TNH event to your Eventbrite event id, and add our webhook URL in Eventbrite admin.',
    },
    own_site: {
      label: 'Your own website',
      placeholder: 'https://yourdomain.com/book/…',
      hint:
        'Paste your checkout URL above. Use <strong>Enable your own website webhook</strong> below (or on Booking providers) ' +
        'so each sale POSTs to us — no Zapier.',
    },
    ticket_tailor: {
      label: 'Ticket Tailor',
      placeholder: 'https://www.tickettailor.com/events/…',
      hint:
        'Paste your Ticket Tailor event URL. Enable <strong>Ticket Tailor</strong> on ' +
        '<a href="/organiser/connected-booking#cb-providers-title">Booking providers</a> and link the box office event id.',
    },
    luma: {
      label: 'Luma',
      placeholder: 'https://lu.ma/…',
      hint:
        'Paste your Luma event link. Enable <strong>Luma</strong> on ' +
        '<a href="/organiser/connected-booking#cb-providers-title">Booking providers</a> and link the Luma event id.',
    },
    trybooking: {
      label: 'TryBooking',
      placeholder: 'https://…',
      hint:
        'Paste your TryBooking event URL. Enable <strong>TryBooking</strong> on ' +
        '<a href="/organiser/connected-booking#cb-providers-title">Booking providers</a> and link the TryBooking event id.',
    },
  };

  var selectedPlatform = '';

  function guessPlatformFromUrl(url) {
    var u = String(url || '').toLowerCase();
    if (!u) return '';
    if (/eventbrite/.test(u)) return 'eventbrite';
    if (/tickettailor|ticket-tailor/.test(u)) return 'ticket_tailor';
    if (/lu\.ma|luma\.com/.test(u)) return 'luma';
    if (/trybooking/.test(u)) return 'trybooking';
    if (/^https?:\/\//.test(u)) return 'own_site';
    return '';
  }

  function platformStorageKey() {
    return eventId ? 'ecs_booking_platform:' + eventId : '';
  }

  function applyPlatform(platform, opts) {
    var key = String(platform || '').trim();
    if (!PLATFORM_UI[key]) return;
    selectedPlatform = key;
    try {
      var sk = platformStorageKey();
      if (sk) localStorage.setItem(sk, key);
    } catch (e) {
      /* ignore */
    }
    var picker = qs('ecs-platform-picker');
    if (picker) {
      picker.querySelectorAll('[data-ecs-platform]').forEach(function (btn) {
        btn.classList.toggle('is-selected', btn.getAttribute('data-ecs-platform') === key);
        btn.setAttribute('aria-pressed', btn.getAttribute('data-ecs-platform') === key ? 'true' : 'false');
      });
    }
    var meta = PLATFORM_UI[key];
    var urlInput = qs('ecs-booking-url');
    if (urlInput && meta.placeholder && (!urlInput.value.trim() || (opts && opts.forcePlaceholder))) {
      urlInput.placeholder = meta.placeholder;
    } else if (urlInput && meta.placeholder) {
      urlInput.placeholder = meta.placeholder;
    }
    var hintEl = qs('ecs-platform-hint');
    if (hintEl) {
      hintEl.hidden = false;
      hintEl.innerHTML = meta.hint;
    }
  }

  function initPlatformPicker() {
    var picker = qs('ecs-platform-picker');
    if (!picker || picker.dataset.bound) return;
    picker.dataset.bound = '1';
    picker.querySelectorAll('[data-ecs-platform]').forEach(function (btn) {
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', function () {
        applyPlatform(btn.getAttribute('data-ecs-platform'));
      });
    });
    var urlInput = qs('ecs-booking-url');
    if (urlInput) {
      urlInput.addEventListener('input', function () {
        var guess = guessPlatformFromUrl(urlInput.value);
        if (guess && guess !== selectedPlatform) applyPlatform(guess);
      });
    }
  }

  function restorePlatformSelection() {
    var fromUrl = guessPlatformFromUrl(qs('ecs-booking-url') && qs('ecs-booking-url').value);
    var stored = '';
    try {
      stored = platformStorageKey() ? localStorage.getItem(platformStorageKey()) || '' : '';
    } catch (e) {
      stored = '';
    }
    applyPlatform(fromUrl || stored || 'own_site');
  }

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
      editLink.hidden = isEmbedDrawer();
    }
    bindEmbedDrawerNav();

    if (qs('ecs-price-label')) qs('ecs-price-label').value = ev.externalPriceLabel || ev.external_price_label || '';
    if (qs('ecs-booking-url')) qs('ecs-booking-url').value = ev.externalBookingUrl || ev.external_booking_url || '';
    initPlatformPicker();
    restorePlatformSelection();
  }

  var providersById = {};
  var providerLinks = [];
  var externalEventIdUserEdited = false;
  var eventLinkUiBound = false;

  var EXTERNAL_ID_LABELS = {
    eventbrite: 'Eventbrite event id (numbers — we can fill this from your booking URL)',
    ticket_tailor: 'Ticket Tailor event id (from box office / event URL)',
    luma: 'Luma event id or slug (from your lu.ma link)',
    trybooking: 'TryBooking event id',
  };

  function selectedIntegrationPlatform() {
    if (platformPickerControl && platformPickerControl.getSelected) {
      return platformPickerControl.getSelected();
    }
    var hub = window.HubConnectedPlatform;
    return (hub && hub.getStored(eventId)) || 'own_site';
  }

  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function providerWebhookLead(platform) {
    var key = String(platform || '').trim();
    if (key === 'own_site') {
      return (
        'When someone completes checkout on <strong>your booking link</strong>, your site POSTs JSON to the webhook below ' +
        'so we create the registration (attendee list, round-ups, verified reviews). No Zapier required.'
      );
    }
    if (key === 'eventbrite') {
      return (
        'Enable <strong>Eventbrite</strong> below, paste the webhook URL into Eventbrite admin, then link this TNH event to your ' +
        '<strong>Eventbrite event id</strong> on Booking providers. Orders sync automatically — not via your own website POST.'
      );
    }
    var p = providersById[key];
    var label = (p && p.label) || key.replace(/_/g, ' ');
    return (
      'Enable <strong>' +
      escHtml(label) +
      '</strong> below and paste the webhook URL into that platform’s admin. Link this TNH event to the provider’s event id on ' +
      '<a href="/organiser/connected-booking#cb-providers-title">Connected booking → Booking providers</a>.'
    );
  }

  function eventLinkForPlatform(platform) {
    return (providerLinks || []).find(function (link) {
      return (
        String(link.event_id || link.eventId || '') === String(eventId || '') &&
        String(link.provider || '') === String(platform || '')
      );
    });
  }

  function linkedExternalEventId(platform) {
    var link = eventLinkForPlatform(platform);
    if (!link) return '';
    return String(link.external_event_id || link.externalEventId || '').trim();
  }

  function guessExternalEventIdFromBookingUrl(platform) {
    var hub = window.HubExternalBookingUrl;
    var bookingUrl = qs('ecs-booking-url') ? qs('ecs-booking-url').value : '';
    if (!hub || typeof hub.guessProviderExternalEventId !== 'function') return '';
    return hub.guessProviderExternalEventId(platform, bookingUrl);
  }

  function resolveExternalEventIdForLink(platform) {
    var key = String(platform || selectedIntegrationPlatform() || '').trim();
    var input = qs('ecs-external-event-id');
    var manual = input ? String(input.value || '').trim() : '';
    if (manual) return manual;
    return guessExternalEventIdFromBookingUrl(key);
  }

  function setEventLinkStatus(msg, kind) {
    var el = qs('ecs-event-link-status');
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || '';
    el.className =
      'ee-hint' + (kind === 'error' ? ' ee-alert-warn' : kind === 'ok' ? ' ee-alert-ok' : '');
  }

  function refreshEventLinkBadge(platform) {
    var badge = qs('ecs-event-link-badge');
    if (!badge) return;
    var key = String(platform || selectedIntegrationPlatform() || '').trim();
    var linkedId = linkedExternalEventId(key);
    if (linkedId) {
      badge.hidden = false;
      badge.className = 'ecs-event-link-badge ee-hint is-linked';
      badge.textContent = 'Linked — provider event id ' + linkedId + ' will sync registrations to this TNH event.';
      return;
    }
    badge.hidden = false;
    badge.className = 'ecs-event-link-badge ee-hint is-unlinked';
    badge.textContent = 'Not linked yet — save the provider event id below (or publish and we will link it for you).';
  }

  function refreshEventLinkAutofillHint() {
    var hint = qs('ecs-event-link-autofill-hint');
    var useBtn = qs('ecs-use-url-id');
    if (!hint) return;
    var platform = selectedIntegrationPlatform();
    if (platform === 'own_site') {
      hint.hidden = true;
      if (useBtn) useBtn.hidden = true;
      return;
    }
    var guessed = guessExternalEventIdFromBookingUrl(platform);
    var input = qs('ecs-external-event-id');
    var current = input ? String(input.value || '').trim() : '';
    if (guessed && guessed !== current) {
      hint.hidden = false;
      hint.textContent =
        'From your booking URL we see id “' + guessed + '”. Click “Use id from booking URL” or edit the field.';
      if (useBtn) useBtn.hidden = false;
      return;
    }
    hint.hidden = true;
    if (useBtn) useBtn.hidden = true;
  }

  function maybeAutofillExternalEventId(force) {
    var platform = selectedIntegrationPlatform();
    if (platform === 'own_site') return;
    var input = qs('ecs-external-event-id');
    if (!input) return;
    if (externalEventIdUserEdited && !force && input.value.trim()) return;
    var linked = linkedExternalEventId(platform);
    if (linked) {
      input.value = linked;
      return;
    }
    var guessed = guessExternalEventIdFromBookingUrl(platform);
    if (guessed && (force || !input.value.trim())) {
      input.value = guessed;
      externalEventIdUserEdited = false;
    }
  }

  function syncEventLinkPanel(platform) {
    var panel = qs('ecs-event-link-panel');
    var key = String(platform || selectedIntegrationPlatform() || 'own_site').trim();
    if (!panel) return;
    if (key === 'own_site') {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    var label = qs('ecs-external-id-label');
    if (label) label.textContent = EXTERNAL_ID_LABELS[key] || 'Provider event id';
    var help = qs('ecs-event-link-help');
    if (help) {
      var p = providersById[key];
      help.textContent =
        'Tell us which ' +
        ((p && p.label) || 'provider') +
        ' event matches this listing so ticket sales sync to The Networker UK — you do this once per TNH event.';
    }
    maybeAutofillExternalEventId(false);
    refreshEventLinkBadge(key);
    refreshEventLinkAutofillHint();
  }

  function updateOneTimeProviderStatus(platform) {
    var el = qs('ecs-onetime-status');
    if (!el) return;
    var key = String(platform || selectedIntegrationPlatform() || '').trim();
    if (key === 'own_site') {
      var own = providersById.own_site;
      if (own && own.webhookUrl) {
        el.hidden = false;
        el.textContent = 'Your website webhook: ready';
      } else {
        el.hidden = false;
        el.textContent = 'Your website webhook: not enabled yet';
      }
      return;
    }
    var p = providersById[key];
    if (p && p.webhookUrl) {
      el.hidden = false;
      el.textContent = ((p && p.label) || 'Provider') + ' webhook: ready (account setup done)';
    } else if (p) {
      el.hidden = false;
      el.textContent = ((p && p.label) || 'Provider') + ' webhook: enable below (one time)';
    } else {
      el.hidden = true;
    }
  }

  function mergeEventLinkFromApi(data) {
    providerLinks = (data && data.eventLinks) || providerLinks || [];
    var single = data && data.eventLink;
    if (single && single.event_id) {
      var exists = providerLinks.some(function (l) {
        return String(l.event_id || l.eventId) === String(single.event_id || single.eventId);
      });
      if (!exists) providerLinks = providerLinks.concat([single]);
    }
  }

  function saveEventLink(opts) {
    var options = opts || {};
    var platform = selectedIntegrationPlatform();
    if (platform === 'own_site') return Promise.resolve({ ok: true, skipped: true });
    var externalId = resolveExternalEventIdForLink(platform);
    if (!externalId) {
      if (options.required) {
        return Promise.resolve({
          ok: false,
          message:
            'Enter the provider event id, or paste a booking URL we can read (e.g. Eventbrite /e/… link). Then save the link.',
        });
      }
      return Promise.resolve({ ok: true, skipped: true });
    }
    var linked = linkedExternalEventId(platform);
    if (linked === externalId) {
      return Promise.resolve({ ok: true, already: true });
    }
    setEventLinkStatus('Saving link…');
    var bookingUrl = qs('ecs-booking-url') ? qs('ecs-booking-url').value.trim() : '';
    return api('/api/organiser/connected-booking-providers', {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'link_event',
        eventId: eventId,
        provider: platform,
        externalEventId: externalId,
        externalEventUrl: bookingUrl || undefined,
      }),
    }).then(function (res) {
      if (!res.ok) {
        var msg = (res.data && (res.data.message || res.data.error)) || 'Could not save event link.';
        if (!options.silent) setEventLinkStatus(msg, 'error');
        return { ok: false, message: msg };
      }
      if (res.data && res.data.eventLink) {
        var row = res.data.eventLink;
        providerLinks = providerLinks.filter(function (l) {
          return !(
            String(l.event_id || l.eventId) === String(eventId) &&
            String(l.provider || '') === String(platform)
          );
        });
        providerLinks.push(row);
      }
      if (!options.silent) {
        setEventLinkStatus('Linked — registrations from that provider event will sync here.', 'ok');
      }
      refreshEventLinkBadge(platform);
      renderProviderWebhookCard(platform);
      return { ok: true };
    });
  }

  function ensureEventLinkBeforeSave(publish) {
    return saveEventLink({ required: Boolean(publish), silent: Boolean(publish) });
  }

  function bindEventLinkUi() {
    if (eventLinkUiBound) return;
    eventLinkUiBound = true;
    var extInput = qs('ecs-external-event-id');
    if (extInput) {
      extInput.addEventListener('input', function () {
        externalEventIdUserEdited = true;
        refreshEventLinkAutofillHint();
      });
    }
    var saveLinkBtn = qs('ecs-save-event-link');
    if (saveLinkBtn) {
      saveLinkBtn.addEventListener('click', function () {
        saveLinkBtn.disabled = true;
        saveEventLink({ required: true }).then(function (res) {
          saveLinkBtn.disabled = false;
          if (!res.ok && res.message) setEventLinkStatus(res.message, 'error');
        });
      });
    }
    var useUrlBtn = qs('ecs-use-url-id');
    if (useUrlBtn) {
      useUrlBtn.addEventListener('click', function () {
        maybeAutofillExternalEventId(true);
        externalEventIdUserEdited = false;
        refreshEventLinkAutofillHint();
      });
    }
  }

  function renderProviderWebhookCard(platform) {
    var mount = qs('ecs-provider-webhook-card');
    var lead = qs('ecs-webhook-lead');
    var heading = qs('ecs-webhook-heading');
    if (!mount) return;
    var key = String(platform || selectedIntegrationPlatform() || 'own_site').trim();
    if (lead) lead.innerHTML = providerWebhookLead(key);
    if (heading) {
      var providerLabel = providersById[key] && providersById[key].label;
      heading.textContent = key === 'own_site' ? 'Your website webhook' : 'Webhook for ' + (providerLabel || key);
    }

    var p = providersById[key];
    if (!p && key !== 'own_site') {
      mount.innerHTML =
        '<p class="ee-hint">Loading provider details… Open <a href="/organiser/connected-booking#cb-providers-title">Booking providers</a> if this does not update.</p>';
      return;
    }

    if (key === 'own_site') {
      var own = providersById.own_site || p;
      mount.innerHTML =
        '<p class="ee-hint"><strong>Token webhook URL</strong> — POST <code>application/json</code> after each completed booking.</p>' +
        '<p class="cb-webhook-url" id="ecs-own-site-webhook-url">' +
        escHtml(own && own.webhookUrl ? own.webhookUrl : 'Enable below to generate your webhook URL.') +
        '</p>' +
        '<p class="ee-hint" id="ecs-own-site-webhook-hint">' +
        escHtml(
          own && own.webhookUrl
            ? 'Include the TNH event id in each JSON body (see example).'
            : 'One click enables the URL — paste it into your site automation.'
        ) +
        '</p>' +
        '<button type="button" class="ee-btn ee-btn-outline ee-btn-sm" data-enable-provider="own_site"' +
        (own && own.webhookUrl ? ' hidden' : '') +
        '>Enable your own website webhook</button>' +
        '<p class="ee-hint" style="margin-top:12px"><strong>Event id in JSON body:</strong> <code>' +
        escHtml(eventId) +
        '</code></p>' +
        '<pre class="cb-code-block" id="ecs-own-site-sample" aria-label="Example JSON payload"></pre>' +
        '<p class="ee-hint">More detail: <a href="/organiser/connected-booking#cb-providers-title">Connected booking → Booking providers</a>.</p>';
      var sampleEl = qs('ecs-own-site-sample');
      if (sampleEl) sampleEl.textContent = ownSiteSampleJson();
      bindProviderEnableButtons(mount);
      return;
    }

    var linked = eventLinkForPlatform(key);

    mount.innerHTML =
      '<p class="ee-hint"><strong>' +
      escHtml(p.label) +
      '</strong> — ' +
      escHtml(p.docsHint || '') +
      '</p>' +
      (p.webhookUrl
        ? '<p class="ee-hint"><strong>Webhook URL</strong> (paste in ' +
          escHtml(p.label) +
          ' admin):</p><p class="cb-webhook-url">' +
          escHtml(p.webhookUrl) +
          '</p>'
        : '<p class="ee-hint">Click Enable to generate your webhook URL for ' + escHtml(p.label) + '.</p>') +
      '<button type="button" class="ee-btn ee-btn-outline ee-btn-sm" data-enable-provider="' +
      escHtml(key) +
      '"' +
      (p.webhookUrl ? ' hidden' : '') +
      '>Enable ' +
      escHtml(p.label) +
      '</button>' +
      (linked && (linked.external_event_id || linked.externalEventId)
        ? '<p class="ee-hint ee-alert-ok">This event is linked (id <code>' +
          escHtml(linked.external_event_id || linked.externalEventId) +
          '</code>).</p>'
        : '<p class="ee-hint">Link this event in the <strong>Link registrations</strong> section above (we can fill the id from your booking URL).</p>') +
      '<p class="ee-hint">Account setup: <a href="/organiser/connected-booking#cb-providers-title">Connected booking → Booking providers</a>.</p>';
    bindProviderEnableButtons(mount);
  }

  function bindProviderEnableButtons(root) {
    if (!root) return;
    root.querySelectorAll('[data-enable-provider]').forEach(function (btn) {
      if (btn.dataset.enableBound) return;
      btn.dataset.enableBound = '1';
      btn.addEventListener('click', function () {
        var provider = btn.getAttribute('data-enable-provider');
        btn.disabled = true;
        api('/api/organiser/connected-booking-providers', {
          method: 'PATCH',
          body: JSON.stringify({ action: 'enable_provider', provider: provider }),
        })
          .then(function (res) {
            btn.disabled = false;
            if (!res.ok) {
              window.alert(res.data.message || res.data.error || 'Could not enable provider.');
              return;
            }
            loadProviderCatalog().then(function () {
              renderProviderWebhookCard(selectedIntegrationPlatform());
            });
          })
          .catch(function () {
            btn.disabled = false;
            window.alert('Could not enable provider.');
          });
      });
    });
  }

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

  function loadProviderCatalog() {
    if (!eventId) return Promise.resolve();
    return api('/api/organiser/connected-booking-providers?eventId=' + encodeURIComponent(eventId)).then(
      function (res) {
        if (!res.ok || !res.data || !res.data.ok) return;
        providersById = {};
        (res.data.providers || []).forEach(function (p) {
          if (p && p.id) providersById[p.id] = p;
        });
        mergeEventLinkFromApi(res.data);
        var platform = selectedIntegrationPlatform();
        updateOneTimeProviderStatus(platform);
        syncEventLinkPanel(platform);
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
    return loadProviderCatalog().then(function () {
      renderProviderWebhookCard(selectedIntegrationPlatform());
    });
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
    bindEmbedDrawerNav();
    bindEventLinkUi();
    initPlatformPicker();
    restorePlatformSelection();
    syncEventLinkPanel(selectedIntegrationPlatform());
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
    var eventDate = loadedEvent && String(loadedEvent.date || loadedEvent.startsAt || '').trim();
    if (publish && !eventDate) {
      setStatus(
        saveStatus,
        'Add at least one event date in Event details or Location before publishing.',
        'error'
      );
      return;
    }

    var linkResult = await ensureEventLinkBeforeSave(publish);
    if (!linkResult.ok) {
      setStatus(saveStatus, linkResult.message || 'Could not link provider event.', 'error');
      syncEventLinkPanel(selectedIntegrationPlatform());
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
    if (eventDate) {
      payload.date = eventDate;
      if (loadedEvent.endDate) payload.endDate = loadedEvent.endDate;
    }

    var res = await api('/api/organiser/events', { method: 'PATCH', body: JSON.stringify(payload) });
    if (!res.ok) {
      setStatus(saveStatus, res.data.message || res.data.error || 'Could not save.', 'error');
      return;
    }
    var savedEv = (res.data && res.data.event) || null;
    if (savedEv && savedEv.externalBookingUrl && qs('ecs-booking-url')) {
      qs('ecs-booking-url').value = savedEv.externalBookingUrl;
      payload.externalBookingUrl = savedEv.externalBookingUrl;
    } else if (
      window.HubExternalBookingUrl &&
      typeof window.HubExternalBookingUrl.toAttendeeBookingUrl === 'function' &&
      url &&
      qs('ecs-booking-url')
    ) {
      var attendeeUrl = window.HubExternalBookingUrl.toAttendeeBookingUrl(url);
      if (attendeeUrl && attendeeUrl !== url) {
        qs('ecs-booking-url').value = attendeeUrl;
        payload.externalBookingUrl = attendeeUrl;
      }
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
    initEmbedDrawerNav();
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

})();
