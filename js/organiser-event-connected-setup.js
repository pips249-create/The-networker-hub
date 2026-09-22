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
    /* Embed drawer parent already handles event/location nav — one back link avoids clutter. */
    var backEdit = document.getElementById('ecs-embed-back-edit');
    var backLoc = document.getElementById('ecs-embed-back-location');
    if (backEdit) backEdit.hidden = true;
    if (backLoc) backLoc.hidden = true;
  }

  function initEmbedDrawerNav() {
    bindEmbedDrawerNav();
    if (isEmbedDrawer() && typeof embed.notifyEmbedDrawerReady === 'function') {
      embed.notifyEmbedDrawerReady('tickets');
    }
  }

  var platformPickerControl = null;
  var platformUrlInputBound = false;
  var platformPickerExpanded = false;

  function arrivedFromTicketsStep() {
    return String(new URLSearchParams(location.search).get('from') || '').trim() === 'tickets';
  }

  function shouldCollapsePlatformPicker() {
    return arrivedFromTicketsStep() && !platformPickerExpanded;
  }

  function escAttr(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function updatePlatformPickerPresentation() {
    var hub = window.HubConnectedPlatform;
    var picker = qs('ecs-platform-picker');
    var summary = qs('ecs-platform-chosen');
    if (!picker || !summary || !hub || !platformPickerControl) return;

    var key = platformPickerControl.getSelected();
    var meta = hub.PLATFORMS[key];
    var collapse = shouldCollapsePlatformPicker();

    picker.hidden = collapse;
    summary.hidden = !collapse;
    if (collapse && meta) {
      var nameEl = qs('ecs-platform-chosen-name');
      var logoEl = qs('ecs-platform-chosen-logo');
      if (nameEl) nameEl.textContent = meta.label || key;
      if (logoEl) {
        logoEl.innerHTML = meta.logo
          ? '<img src="' + escAttr(meta.logo) + '" alt="" width="120" height="28" decoding="async" />'
          : '';
      }
    }
  }

  function bindPlatformChangeControl() {
    var btn = qs('ecs-platform-change');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function () {
      platformPickerExpanded = true;
      updatePlatformPickerPresentation();
      var picker = qs('ecs-platform-picker');
      if (picker) {
        try {
          picker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (e) {
          /* ignore */
        }
      }
    });
  }

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
    var grid = picker.querySelector('[data-connected-platform-grid]');
    if (grid && hub.fillPlatformGrid) hub.fillPlatformGrid(grid);
    if (!platformPickerControl) {
      platformPickerControl = hub.bindPicker(picker, eventId, function (platformKey, meta) {
        syncBookingUrlPlaceholder(meta);
        syncEventLinkPanel(platformKey);
        renderProviderWebhookCard(platformKey);
        updateOneTimeProviderStatus(platformKey);
        updatePlatformPickerPresentation();
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
    updatePlatformPickerPresentation();
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
      'ecs-page-actions-status ee-hint' +
      (kind === 'error' ? ' ee-alert-warn' : kind === 'ok' ? ' ee-alert-ok' : '');
    if (msg && (kind === 'error' || kind === 'ok')) {
      try {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } catch {
        /* ignore */
      }
    }
  }

  function setPageActionsVisible(show) {
    var bar = qs('ecs-page-actions');
    if (bar) bar.hidden = !show;
  }

  function saveErrorMessage(data, status) {
    if (!data) return status === 403 ? 'You do not have permission to publish this event.' : 'Could not save.';
    if (data.message) return String(data.message);
    var code = String(data.error || '').trim();
    if (code === 'missing_dates') {
      return 'Add at least one event date in Event details or Location before publishing.';
    }
    if (code === 'organiser_email_not_verified') {
      return 'Verify your organiser email before publishing (check your inbox for the verification link).';
    }
    if (code === 'missing_title' || code === 'missing_group') {
      return 'Event details are incomplete — open Event details and try again.';
    }
    return code || 'Could not save.';
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
    setPageActionsVisible(false);
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
    setPageActionsVisible(false);
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
    bindPlatformChangeControl();
    updatePlatformPickerPresentation();
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

  var EVENTBRITE_PAYLOAD_URL_MAX = 70;
  var EVENTBRITE_WEBHOOK_ORIGIN = 'https://www.thenetworkeruk.com';

  function canonicalEventbriteWebhookUrl(url) {
    var u = String(url || '').trim();
    if (!u) return u;
    if (u.indexOf('https://thenetworkeruk.com/') === 0) {
      return u.replace('https://thenetworkeruk.com/', EVENTBRITE_WEBHOOK_ORIGIN + '/');
    }
    return u;
  }

  function eventbriteWebhookUrlOk(url) {
    var u = canonicalEventbriteWebhookUrl(url);
    return (
      u.length > 0 &&
      u.length <= EVENTBRITE_PAYLOAD_URL_MAX &&
      u.indexOf(EVENTBRITE_WEBHOOK_ORIGIN + '/w/eb/') === 0
    );
  }

  function renderEventbriteWebhookCard(mount, p, linked) {
    var url = canonicalEventbriteWebhookUrl((p && p.webhookUrl) || '');
    var linkedDone = Boolean(linked && (linked.external_event_id || linked.externalEventId));
    var len = url.length;
    var lenOk = len > 0 && len <= EVENTBRITE_PAYLOAD_URL_MAX;
    var urlOk = eventbriteWebhookUrlOk(url);
    var tokenOk = Boolean(p && p.eventbriteApiTokenConfigured);

    if (!url) {
      mount.innerHTML =
        '<div class="ecs-eb-sync">' +
        '<p class="ecs-eb-sync-tagline">One-time setup · ~1 minute</p>' +
        '<p class="ecs-eb-sync-lead">Generate a <strong>short</strong> webhook URL, paste it in Eventbrite, then link your event id above.</p>' +
        '<button type="button" class="ee-btn ee-btn-gold" data-enable-provider="eventbrite">Enable Eventbrite</button>' +
        '</div>';
      bindProviderEnableButtons(mount);
      return;
    }

    mount.innerHTML =
      '<div class="ecs-eb-sync">' +
      '<ul class="ecs-eb-checklist" aria-label="Eventbrite sync">' +
      '<li class="ecs-eb-check is-done"><span class="ecs-eb-check-icon" aria-hidden="true">✓</span> Webhook URL ready</li>' +
      '<li class="ecs-eb-check' +
      (linkedDone ? ' is-done' : '') +
      '"><span class="ecs-eb-check-icon" aria-hidden="true">' +
      (linkedDone ? '✓' : '2') +
      '</span> Event id saved above' +
      (linkedDone ? '' : ' <span class="ecs-eb-check-sub">(Link registrations)</span>') +
      '</li>' +
      '<li class="ecs-eb-check' +
      (tokenOk ? ' is-done' : '') +
      '"><span class="ecs-eb-check-icon" aria-hidden="true">' +
      (tokenOk ? '✓' : '3') +
      '</span> Eventbrite API token saved' +
      (tokenOk ? '' : ' <span class="ecs-eb-check-sub">(below)</span>') +
      '</li>' +
      '</ul>' +
      '<div class="ecs-eb-url-panel' +
      (urlOk ? '' : ' is-warning') +
      '">' +
      '<div class="ecs-eb-url-panel-head">' +
      '<span class="ecs-eb-url-label">Copy into Eventbrite → Payload URL</span>' +
      '<span class="ecs-eb-len-badge' +
      (lenOk ? ' is-ok' : ' is-bad') +
      '" title="Eventbrite truncates longer URLs">' +
      len +
      '/' +
      EVENTBRITE_PAYLOAD_URL_MAX +
      '</span>' +
      '</div>' +
      '<code class="ecs-eb-url cb-webhook-url" data-webhook-url="' +
      escAttr(url) +
      '">' +
      escHtml(url) +
      '</code>' +
      '<div class="ecs-webhook-copy-row">' +
      '<button type="button" class="ee-btn ee-btn-gold ee-btn-sm" data-copy-webhook-url>Copy for Eventbrite</button>' +
      '<span class="ee-hint ecs-copy-webhook-status" data-copy-webhook-status hidden role="status"></span>' +
      '</div>' +
      (!urlOk
        ? '<p class="ecs-eb-url-warn">URL must start with <code>https://www.thenetworkeruk.com/w/eb/</code> (www avoids Eventbrite 308 errors). Refresh or click Enable Eventbrite again if this line looks wrong.</p>'
        : '<p class="ee-hint ecs-eb-www-ok">Uses <strong>www</strong> so Eventbrite POSTs succeed (no 308 redirect).</p>') +
      '</div>' +
      '<p class="ecs-eb-paste-hint">In Eventbrite: profile menu → <strong>Account settings → Webhooks</strong> · Action <code>order.placed</code></p>' +
      '<div class="ecs-eb-token-panel">' +
      '<label class="ee-field ecs-eb-token-field">' +
      '<span>Eventbrite private token <strong>(required for attendee sync)</strong></span>' +
      '<input type="password" id="ecs-eb-private-token" autocomplete="off" spellcheck="false" placeholder="From Eventbrite → Account settings → Developer links" />' +
      '</label>' +
      '<p class="ee-hint">Eventbrite webhooks only send an order link — we use this token to load buyer name and email when someone buys a ticket.</p>' +
      '<button type="button" class="ee-btn ee-btn-outline ee-btn-sm" data-save-eventbrite-token>Save API token</button>' +
      '<span class="ee-hint ecs-eb-token-status" data-eb-token-status hidden role="status"></span>' +
      '</div>' +
      '<details class="ecs-eb-help-details">' +
      '<summary>Step-by-step in Eventbrite</summary>' +
      '<ol class="ecs-eb-help-steps">' +
      '<li>Open <strong>Webhooks</strong> → Add webhook (or edit yours).</li>' +
      '<li>Paste the copied URL into <strong>Payload URL</strong> (full line).</li>' +
      '<li>Set <strong>Action</strong> to <code>order.placed</code> and save.</li>' +
      '</ol>' +
      '</details>' +
      (linkedDone
        ? '<p class="ee-hint ee-alert-ok ecs-eb-linked">Linked event id <code>' +
          escHtml(displayExternalEventId('eventbrite', linked.external_event_id || linked.externalEventId)) +
          '</code></p>'
        : '') +
      (!urlOk
        ? '<button type="button" class="ee-btn ee-btn-outline ee-btn-sm ecs-eb-regen" data-enable-provider="eventbrite">Get shorter URL</button>'
        : '') +
      (p && p.eventbriteWebhookNeedsFix
        ? '<p class="ee-alert ee-alert-warn ecs-eb-token-status">Webhook URL on TNH was updated — paste the URL above into Eventbrite again or sync will stop (Recent sync attempts may show <code>invalid_webhook_token</code>).</p>'
        : '<p class="ee-hint">If sync worked once then stopped, compare Eventbrite <strong>Payload URL</strong> with the line above — they must match exactly. Check <a href="/organiser/connected-booking">Connected booking → Recent sync attempts</a>.</p>') +
      '</div>';
    bindProviderEnableButtons(mount);
    bindEventbriteTokenSave(mount);
  }

  function bindEventbriteTokenSave(root) {
    if (!root || root.dataset.ebTokenBound === '1') return;
    root.dataset.ebTokenBound = '1';
    root.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-save-eventbrite-token]') : null;
      if (!btn || btn.disabled) return;
      e.preventDefault();
      var input = qs('ecs-eb-private-token');
      var token = input ? String(input.value || '').trim() : '';
      var statusEl = root.querySelector('[data-eb-token-status]');
      if (!token) {
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.textContent = 'Paste your Eventbrite private token first.';
          statusEl.className = 'ee-hint ee-alert-warn ecs-eb-token-status';
        }
        return;
      }
      btn.disabled = true;
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = 'Saving…';
        statusEl.className = 'ee-hint ecs-eb-token-status';
      }
      api('/api/organiser/connected-booking-providers', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'save_eventbrite_private_token', token: token }),
      })
        .then(function (res) {
          btn.disabled = false;
          if (!res.ok || !res.data || !res.data.ok) {
            if (statusEl) {
              statusEl.textContent =
                (res.data && res.data.message) || (res.data && res.data.error) || 'Could not save token.';
              statusEl.className = 'ee-hint ee-alert-warn ecs-eb-token-status';
            }
            return;
          }
          if (input) input.value = '';
          providersById.eventbrite = Object.assign({}, providersById.eventbrite || { id: 'eventbrite' }, {
            eventbriteApiTokenConfigured: true,
          });
          if (statusEl) {
            statusEl.textContent = 'Saved — new ticket sales can sync attendee details.';
            statusEl.className = 'ee-hint ee-alert-ok ecs-eb-token-status';
          }
          renderProviderWebhookCard('eventbrite');
        })
        .catch(function () {
          btn.disabled = false;
          if (statusEl) {
            statusEl.textContent = 'Could not save token. Try again.';
            statusEl.className = 'ee-hint ee-alert-warn ecs-eb-token-status';
          }
        });
    });
  }

  function providerWebhookLead(platform) {
    var key = String(platform || '').trim();
    if (key === 'own_site') {
      return (
        'When someone completes checkout on <strong>your booking link</strong>, your site POSTs JSON to the webhook below ' +
        'so we create the registration (attendee list, round-ups, verified reviews). No Zapier required.'
      );
    }
    if (key === 'custom') {
      return (
        'Use <strong>Zapier</strong>, <strong>Make</strong>, or your developer to send each booking to The Networker UK. ' +
        'Include your TNH event id in the payload. Signed HMAC is in <strong>Advanced</strong> below — or use your own-site token webhook from Booking providers.'
      );
    }
    if (key === 'eventbrite') {
      return 'Webhook URL + API token + linked event id → Eventbrite buyers appear in your TNH attendee list.';
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

  function normalizeExternalEventId(platform, raw) {
    var key = String(platform || '').trim();
    var value = String(raw || '').trim();
    if (!value) return '';
    var hub = window.HubExternalBookingUrl;
    if (hub && typeof hub.guessProviderExternalEventId === 'function') {
      var fromUrl = hub.guessProviderExternalEventId(key, value);
      if (fromUrl) return fromUrl;
    }
    if (/^\d+$/.test(value)) return value;
    return value;
  }

  function resolveGuessedExternalId(platform) {
    var key = String(platform || selectedIntegrationPlatform() || '').trim();
    var bookingUrl = qs('ecs-booking-url') ? qs('ecs-booking-url').value.trim() : '';
    var input = qs('ecs-external-event-id');
    var manual = input ? String(input.value || '').trim() : '';
    var hub = window.HubExternalBookingUrl;
    if (!hub || typeof hub.guessProviderExternalEventId !== 'function') return '';
    return (
      hub.guessProviderExternalEventId(key, bookingUrl) ||
      hub.guessProviderExternalEventId(key, manual) ||
      ''
    );
  }

  function resolveExternalEventIdForLink(platform) {
    var key = String(platform || selectedIntegrationPlatform() || '').trim();
    var input = qs('ecs-external-event-id');
    var manual = input ? String(input.value || '').trim() : '';
    if (manual) return normalizeExternalEventId(key, manual);
    return normalizeExternalEventId(key, guessExternalEventIdFromBookingUrl(key));
  }

  function displayExternalEventId(platform, raw) {
    return normalizeExternalEventId(platform, raw) || String(raw || '').trim();
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
      badge.textContent =
        'Linked — provider event id ' +
        displayExternalEventId(key, linkedId) +
        ' will sync registrations to this TNH event.';
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
    var guessed = resolveGuessedExternalId(platform);
    var input = qs('ecs-external-event-id');
    var current = input ? normalizeExternalEventId(platform, input.value) : '';
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
    var guessed = resolveGuessedExternalId(platform);
    if (force && guessed) {
      input.value = guessed;
      externalEventIdUserEdited = false;
      return;
    }
    var linked = linkedExternalEventId(platform);
    if (linked && !force) {
      input.value = displayExternalEventId(platform, linked);
      return;
    }
    if (guessed && (force || !input.value.trim())) {
      input.value = guessed;
      externalEventIdUserEdited = false;
    }
  }

  function syncEventLinkPanel(platform) {
    var panel = qs('ecs-event-link-panel');
    var key = String(platform || selectedIntegrationPlatform() || 'own_site').trim();
    if (!panel) return;
    if (key === 'own_site' || key === 'custom') {
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
    if (platform === 'own_site' || platform === 'custom') return Promise.resolve({ ok: true, skipped: true });
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
        var platform = selectedIntegrationPlatform();
        var guessed = resolveGuessedExternalId(platform);
        var input = qs('ecs-external-event-id');
        if (!guessed) {
          setEventLinkStatus(
            'We could not read an event id — paste your Eventbrite /e/… link in Booking / checkout URL above, then try again.',
            'error'
          );
          return;
        }
        if (input) input.value = guessed;
        externalEventIdUserEdited = false;
        refreshEventLinkAutofillHint();
        setEventLinkStatus('Using event id ' + guessed + '. Click Save link for this event.', 'ok');
      });
    }
  }

  function renderRegistrationSyncSteps(platform) {
    var stepsEl = qs('ecs-webhook-steps');
    if (!stepsEl) return;
    var key = String(platform || selectedIntegrationPlatform() || '').trim();
    if (key === 'own_site' || key === 'custom') {
      stepsEl.hidden = true;
      return;
    }
    if (key === 'eventbrite') {
      stepsEl.hidden = true;
      stepsEl.innerHTML = '';
      return;
    }
    stepsEl.hidden = false;
    var p = providersById[key];
    var label = (p && p.label) || key.replace(/_/g, ' ');
    var linked = linkedExternalEventId(key);
    var webhookReady = Boolean(p && p.webhookUrl);
    var parts =
        [
            {
              done: webhookReady,
              text: 'Enable ' + label + ' below — once per account — to generate your webhook URL.',
            },
            {
              done: Boolean(linked),
              text:
                'Link this listing to your ' +
                label +
                ' event id in the box above (numbers only — use “Use id from booking URL” if you pasted a full link).',
            },
            {
              done: false,
              text: 'Copy the webhook URL into ' + label + ' admin (see their webhook / integrations help).',
            },
          ];
    stepsEl.innerHTML = parts
      .map(function (step, index) {
        return (
          '<li class="ecs-webhook-step' +
          (step.done ? ' is-done' : '') +
          '">' +
          '<span class="ecs-webhook-step-num" aria-hidden="true">' +
          (index + 1) +
          '</span>' +
          '<span class="ecs-webhook-step-text">' +
          escHtml(step.text) +
          '</span></li>'
        );
      })
      .join('');
  }

  function renderProviderWebhookCard(platform) {
    var mount = qs('ecs-provider-webhook-card');
    var lead = qs('ecs-webhook-lead');
    var heading = qs('ecs-webhook-heading');
    if (!mount) return;
    var key = String(platform || selectedIntegrationPlatform() || 'own_site').trim();
    renderRegistrationSyncSteps(key);
    if (lead) lead.innerHTML = providerWebhookLead(key);
    if (heading) {
      var providerLabel = providersById[key] && providersById[key].label;
      heading.textContent =
        key === 'own_site'
          ? 'Your website webhook'
          : key === 'custom'
            ? 'Zapier, Make, or custom webhook'
            : key === 'eventbrite'
              ? 'Eventbrite sync'
              : 'Webhook for ' + (providerLabel || key);
    }

    var p = providersById[key];
    if (!p && key !== 'own_site' && key !== 'custom') {
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

    if (key === 'custom') {
      var custom = providersById.custom || p;
      var hmacUrl = custom && custom.webhookUrl ? custom.webhookUrl : location.origin.replace(/\/$/, '') + '/api/integrations/booking';
      mount.innerHTML =
        '<p class="ee-hint"><strong>Other platforms</strong> — connect via automation or code. Each booking should include TNH event id <code>' +
        escHtml(eventId) +
        '</code>.</p>' +
        '<p class="ee-hint"><strong>Option A — Zapier / Make</strong><br />Trigger on a new sale in your tool → POST JSON to your ' +
        '<a href="/organiser/connected-booking#cb-providers-title">own-site webhook URL</a> (enable <strong>Your own website</strong> on Booking providers).</p>' +
        '<p class="ee-hint"><strong>Option B — Signed API</strong><br />Developers POST to:</p>' +
        '<p class="cb-webhook-url">' +
        escHtml(hmacUrl) +
        '</p>' +
        '<p class="ee-hint"><a href="/organiser/connected-booking#cb-webhook-title">HMAC webhook docs</a> (account id + secret).</p>';
      return;
    }

    if (key === 'eventbrite') {
      renderEventbriteWebhookCard(mount, p, eventLinkForPlatform(key));
      return;
    }

    var linked = eventLinkForPlatform(key);
    var webhookUrlBlock = p.webhookUrl
      ? '<p class="ee-hint"><strong>Webhook URL</strong> — paste into your provider’s webhook settings:</p>' +
        '<p class="cb-webhook-url" data-webhook-url="' +
        escAttr(p.webhookUrl) +
        '">' +
        escHtml(p.webhookUrl) +
        '</p>' +
        '<p class="ee-attendance-next ecs-webhook-copy-row">' +
        '<button type="button" class="ee-btn ee-btn-outline ee-btn-sm" data-copy-webhook-url>Copy webhook URL</button>' +
        '<span class="ee-hint ecs-copy-webhook-status" data-copy-webhook-status hidden role="status"></span>' +
        '</p>'
      : '<p class="ee-hint">Click Enable to generate your webhook URL for ' + escHtml(p.label) + '.</p>';

    mount.innerHTML =
      '<p class="ee-hint"><strong>' +
      escHtml(p.label) +
      '</strong> — ' +
      escHtml(p.docsHint || '') +
      '</p>' +
      webhookUrlBlock +
      '<button type="button" class="ee-btn ee-btn-outline ee-btn-sm" data-enable-provider="' +
      escHtml(key) +
      '"' +
      (p.webhookUrl ? ' hidden' : '') +
      '>Enable ' +
      escHtml(p.label) +
      '</button>' +
      (linked && (linked.external_event_id || linked.externalEventId)
        ? '<p class="ee-hint ee-alert-ok">This event is linked (id <code>' +
          escHtml(
            displayExternalEventId(key, linked.external_event_id || linked.externalEventId)
          ) +
          '</code>).</p>'
        : '<p class="ee-hint">Link this event in the <strong>Link registrations</strong> section above (we can fill the id from your booking URL).</p>') +
      '<p class="ee-hint">Account setup: <a href="/organiser/connected-booking#cb-providers-title">Connected booking → Booking providers</a>.</p>';
    bindProviderEnableButtons(mount);
  }

  function bindProviderEnableButtons(root) {
    if (!root || root.dataset.enableDelegated === '1') return;
    root.dataset.enableDelegated = '1';
    root.addEventListener('click', function (e) {
      var copyBtn = e.target && e.target.closest ? e.target.closest('[data-copy-webhook-url]') : null;
      if (copyBtn) {
        e.preventDefault();
        var urlEl = root.querySelector('[data-webhook-url]');
        var url = urlEl ? urlEl.getAttribute('data-webhook-url') || urlEl.textContent : '';
        url = String(url || '').trim();
        var statusEl = root.querySelector('[data-copy-webhook-status]');
        if (!url) return;
        function copiedOk() {
          if (statusEl) {
            statusEl.hidden = false;
            statusEl.textContent = 'Copied — paste into Eventbrite Payload URL.';
            statusEl.className = 'ee-hint ee-alert-ok ecs-copy-webhook-status';
          }
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(copiedOk).catch(function () {
            window.prompt('Copy this webhook URL:', url);
          });
        } else {
          window.prompt('Copy this webhook URL:', url);
          copiedOk();
        }
        return;
      }
      var btn = e.target && e.target.closest ? e.target.closest('[data-enable-provider]') : null;
      if (!btn || btn.disabled) return;
      e.preventDefault();
      var provider = btn.getAttribute('data-enable-provider');
      if (!provider) return;
      btn.disabled = true;
      var statusMount = qs('ecs-provider-enable-status');
      if (statusMount) {
        statusMount.hidden = false;
        statusMount.textContent = 'Enabling…';
        statusMount.className = 'ee-hint';
      }
      api('/api/organiser/connected-booking-providers', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'enable_provider', provider: provider }),
      })
        .then(function (res) {
          btn.disabled = false;
          if (!res.ok || (res.data && res.data.ok === false)) {
            var msg = providerEnableErrorMessage(res.data);
            if (statusMount) {
              statusMount.textContent = msg;
              statusMount.className = 'ee-hint ee-alert-warn';
            } else {
              window.alert(msg);
            }
            return;
          }
          mergeProviderConnectionFromPatch(res.data && res.data.connection);
          if (statusMount) {
            statusMount.textContent = 'Enabled — copy the webhook URL below into Eventbrite admin.';
            statusMount.className = 'ee-hint ee-alert-ok';
          }
          return loadProviderCatalog().then(function () {
            renderProviderWebhookCard(selectedIntegrationPlatform());
            renderRegistrationSyncSteps(selectedIntegrationPlatform());
            updateOneTimeProviderStatus(selectedIntegrationPlatform());
          });
        })
        .catch(function () {
          btn.disabled = false;
          if (statusMount) {
            statusMount.textContent = 'Could not enable provider. Check your connection and try again.';
            statusMount.className = 'ee-hint ee-alert-warn';
          } else {
            window.alert('Could not enable provider.');
          }
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

  function providerEnableErrorMessage(data) {
    if (!data) return 'Could not enable provider.';
    if (data.message) return String(data.message);
    var code = String(data.error || '').trim();
    if (code === 'connected_booking_provider_schema_missing') {
      return 'Provider webhooks are not set up on this environment yet. Your site admin needs to run the Connected booking provider database migration.';
    }
    if (code === 'preview_restricted') {
      return 'Connected booking preview is not enabled for this account.';
    }
    if (code === 'supabase_not_configured') {
      return 'Connected booking is temporarily unavailable (database not configured).';
    }
    return code || 'Could not enable provider.';
  }

  function showProviderSchemaWarn(data) {
    var el = qs('ecs-providers-schema-warn');
    if (!el) return;
    if (data && data.schemaMissing) {
      el.hidden = false;
      el.innerHTML =
        'Registration sync needs a database update on the server (migration <strong>299_connected_booking_provider_links.sql</strong>). ' +
        'Until then, Enable Eventbrite will not work here — contact support or use Connected booking → Booking providers on a fully configured site.';
      return;
    }
    el.hidden = true;
    el.textContent = '';
  }

  function mergeProviderConnectionFromPatch(connection) {
    if (!connection || !connection.provider) return;
    var key = String(connection.provider).trim();
    var prev = providersById[key] || { id: key };
    var webhookUrl = connection.webhookUrl || prev.webhookUrl;
    if (key === 'eventbrite' && webhookUrl) {
      webhookUrl = canonicalEventbriteWebhookUrl(webhookUrl);
    }
    providersById[key] = Object.assign({}, prev, {
      id: key,
      label: prev.label || key,
      webhookUrl: webhookUrl,
      connectionStatus: connection.status || 'active',
    });
  }

  function loadProviderCatalog() {
    if (!eventId) return Promise.resolve();
    return api('/api/organiser/connected-booking-providers?eventId=' + encodeURIComponent(eventId)).then(
      function (res) {
        if (!res.ok || !res.data || !res.data.ok) return;
        showProviderSchemaWarn(res.data);
        providersById = {};
        (res.data.providers || []).forEach(function (p) {
          if (p && p.id) {
            if (p.id === 'eventbrite' && p.webhookUrl) {
              p = Object.assign({}, p, {
                webhookUrl: canonicalEventbriteWebhookUrl(p.webhookUrl),
              });
            }
            providersById[p.id] = p;
          }
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
    setPageActionsVisible(true);
    bindEmbedDrawerNav();
    bindEventLinkUi();
    initPlatformPicker();
    restorePlatformSelection();
    bindPlatformChangeControl();
    updatePlatformPickerPresentation();
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
    var saveBtn = qs('ecs-save');
    var pubBtn = qs('ecs-publish');
    if (!loadedEvent || !billing || !billing.active) {
      setStatus(
        saveStatus,
        !billing || !billing.active
          ? 'Connected booking is not active on this account yet.'
          : 'Still loading this event — wait a moment and try again.',
        'error'
      );
      return;
    }
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

    if (saveBtn) saveBtn.disabled = true;
    if (pubBtn) pubBtn.disabled = true;
    setStatus(saveStatus, publish ? 'Publishing…' : 'Saving…');

    try {
      var linkResult = await ensureEventLinkBeforeSave(publish);
      if (!linkResult.ok) {
        setStatus(saveStatus, linkResult.message || 'Could not link provider event.', 'error');
        syncEventLinkPanel(selectedIntegrationPlatform());
        return;
      }

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
        setStatus(saveStatus, saveErrorMessage(res.data, res.status), 'error');
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
      setStatus(saveStatus, publish ? 'Published — your Connected listing is live.' : 'Draft saved.', 'ok');
    } catch (err) {
      setStatus(saveStatus, 'Could not save — check your connection and try again.', 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
      if (pubBtn) pubBtn.disabled = false;
    }
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
  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      saveConnected(false);
    });
  }
  if (pubBtn) {
    pubBtn.addEventListener('click', function () {
      saveConnected(true);
    });
  }

})();
