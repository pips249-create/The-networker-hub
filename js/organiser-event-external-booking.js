/**
 * Connected booking entry on Set up tickets — links to dedicated Connected setup page.
 */
(function () {
  const embed = window.HubOrganiserEmbedBootstrap || {};
  const isEmbedDrawer =
    typeof embed.isEmbedDrawer === 'function'
      ? embed.isEmbedDrawer
      : function () {
          try {
            return (
              new URLSearchParams(window.location.search).get('embed') === '1' ||
              window.self !== window.top
            );
          } catch (e) {
            return false;
          }
        };

  const form = document.getElementById('ee-tickets-form');
  if (!form || form.dataset.externalBookingBound) return;
  form.dataset.externalBookingBound = '1';

  const card = document.getElementById('ee-external-booking-card');
  if (!card) return;

  const hubPanels = document.getElementById('ee-hub-ticket-panels');
  const seriesCard = document.getElementById('ee-series-card');
  const wizardMount = document.getElementById('ee-wizard-mount');
  const pageTitle = document.querySelector('.ee-title');
  const pageLead = document.getElementById('ee-tickets-lead');
  const statusEl = document.getElementById('ee-external-booking-status');
  const planLink = document.getElementById('ee-connected-plan-link');
  const setupLink = document.getElementById('ee-connected-setup-link');

  let billingActive = false;
  let featureEnabled = false;
  let loadedEvent = null;
  let billingPayload = null;
  let platformPicker = null;
  let providersById = {};
  let providerLinks = [];
  let providersLoadPromise = null;
  const accountStatusEl = document.getElementById('ee-connected-account-status');

  function cacheSetupPrefetch() {
    const eid = resolveEventId();
    if (!eid || !loadedEvent || typeof embed.writeConnectedSetupPrefetch !== 'function') return;
    embed.writeConnectedSetupPrefetch(eid, loadedEvent, billingPayload);
  }

  if (isEmbedDrawer()) {
    document.documentElement.classList.add('ee-connected-tickets-checking');
  }

  function api(path) {
    return fetch(path, { credentials: 'include', cache: 'no-store' }).then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, data: data };
      });
    });
  }

  function showStatus(msg, kind) {
    if (!statusEl) return;
    statusEl.hidden = !msg;
    statusEl.textContent = msg || '';
    statusEl.className = 'ee-hint' + (kind === 'error' ? ' ee-alert-warn' : kind === 'ok' ? ' ee-alert-ok' : '');
  }

  function isExternalConnectedEvent(ev) {
    return ev && String(ev.checkoutMode || '').trim() === 'external_connected';
  }

  function shouldShowCard() {
    if (!featureEnabled) return false;
    if (billingActive) return true;
    return isExternalConnectedEvent(loadedEvent);
  }

  function eventIdsFromQueryArray() {
    if (typeof embed.eventIdsFromSearch === 'function') {
      return embed.eventIdsFromSearch();
    }
    const params = new URLSearchParams(window.location.search);
    const ids = String(params.get('ids') || '')
      .split(',')
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    if (ids.length) return ids;
    const eid = resolveEventId();
    return eid ? [eid] : [];
  }

  function eventIdFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const single = String(params.get('id') || params.get('eventId') || '').trim();
    if (single) return single;
    const ids = String(params.get('ids') || '')
      .split(',')
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    return ids[0] || '';
  }

  function resolveEventId() {
    const fromQuery = eventIdFromQuery();
    if (fromQuery) return fromQuery;
    if (loadedEvent && loadedEvent.id) return String(loadedEvent.id).trim();
    return '';
  }

  function setConnectedOnlyLayout(on) {
    document.body.classList.toggle('ee-connected-tickets-only', on);
    document.documentElement.classList.toggle('ee-connected-tickets-checking', !on && isEmbedDrawer());
    if (hubPanels) hubPanels.hidden = on;
    if (seriesCard) seriesCard.hidden = on;
    if (wizardMount) wizardMount.hidden = on;
    if (pageTitle) {
      pageTitle.textContent = on ? 'Connected booking' : 'Set up tickets';
    }
    if (pageLead) {
      pageLead.hidden = on;
    }
  }

  function bindPlanLink() {
    if (!planLink || planLink.dataset.boundConnectedPlan) return;
    planLink.dataset.boundConnectedPlan = '1';
    planLink.addEventListener('click', function (e) {
      const ids = eventIdsFromQueryArray();
      if (
        isEmbedDrawer() &&
        typeof embed.notifyParent === 'function' &&
        embed.notifyParent('hub-event-goto-connected-booking', { eventIds: ids })
      ) {
        e.preventDefault();
        return;
      }
      if (typeof embed.buildEmbedHref === 'function') {
        planLink.href = '/organiser/#groups';
      }
    });
  }

  function selectedPlatform() {
    if (platformPicker && platformPicker.getSelected) return platformPicker.getSelected();
    const hub = window.HubConnectedPlatform;
    const eid = resolveEventId();
    if (hub && eid) return hub.getStored(eid) || 'own_site';
    return 'own_site';
  }

  function providerLabel(key) {
    const hub = window.HubConnectedPlatform;
    const meta = hub && hub.PLATFORMS && hub.PLATFORMS[key];
    return (meta && meta.label) || String(key || '').replace(/_/g, ' ');
  }

  function eventLinkForPlatform(platform) {
    const eid = resolveEventId();
    if (!eid) return null;
    return (providerLinks || []).find(function (link) {
      return (
        String(link.event_id || link.eventId || '') === String(eid) &&
        String(link.provider || '') === String(platform || '')
      );
    });
  }

  function refreshAccountConnectionStatus(platform) {
    if (!accountStatusEl) return;
    const key = String(platform || selectedPlatform() || '').trim();
    if (!key || key === 'custom') {
      accountStatusEl.hidden = true;
      accountStatusEl.textContent = '';
      return;
    }
    const p = providersById[key];
    const linked = eventLinkForPlatform(key);
    const linkedId = linked && (linked.external_event_id || linked.externalEventId);
    const webhookReady = Boolean(p && p.webhookUrl);
    const tokenOk = key !== 'eventbrite' || Boolean(p && p.eventbriteApiTokenConfigured);

    if (webhookReady && (key === 'own_site' || key === 'eventbrite' ? tokenOk : true)) {
      accountStatusEl.hidden = false;
      accountStatusEl.className = 'ee-hint ee-alert-ok';
      let msg =
        providerLabel(key) +
        ' is already connected on your account (webhook ready). On the next screen you only add price, booking URL';
      if (key === 'eventbrite' && !tokenOk) {
        accountStatusEl.className = 'ee-hint';
        msg =
          providerLabel(key) +
          ' webhook is ready — you still need to paste your Eventbrite API token once on Connected setup.';
      } else if (linkedId) {
        msg += ', and confirm the link for this event (already linked as ' + linkedId + ').';
      } else if (key === 'ticket_tailor') {
        msg += ', and the ev_… event id for this listing.';
      } else if (key === 'eventbrite') {
        msg += ', and your Eventbrite event id (we usually fill this from the booking URL).';
      } else {
        msg += ', and the provider event id for this listing.';
      }
      accountStatusEl.textContent = msg;
      return;
    }

    if (p && key !== 'custom') {
      accountStatusEl.hidden = false;
      accountStatusEl.className = 'ee-hint';
      accountStatusEl.textContent =
        'First time with ' +
        providerLabel(key) +
        ' on this account? You will enable the webhook once on Connected setup (about a minute), then repeat only price + booking link for each new event.';
      return;
    }

    accountStatusEl.hidden = true;
    accountStatusEl.textContent = '';
  }

  function loadProviderCatalogForTickets() {
    const eid = resolveEventId();
    if (!eid || !billingActive) return Promise.resolve();
    if (providersLoadPromise) return providersLoadPromise;
    providersLoadPromise = fetch(
      '/api/organiser/connected-booking-providers?eventId=' + encodeURIComponent(eid),
      { credentials: 'include', cache: 'no-store' }
    )
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        providersLoadPromise = null;
        if (!data || !data.ok) return;
        providersById = {};
        (data.providers || []).forEach(function (p) {
          if (p && p.id) providersById[p.id] = p;
        });
        providerLinks = data.eventLinks || [];
        refreshAccountConnectionStatus(selectedPlatform());
      })
      .catch(function () {
        providersLoadPromise = null;
      });
    return providersLoadPromise;
  }

  function initPlatformPicker() {
    const root = document.getElementById('ee-connected-platform-picker');
    const hub = window.HubConnectedPlatform;
    const eid = resolveEventId();
    if (!root || !hub || !eid) return;
    platformPicker = hub.bindPicker(
      root,
      eid,
      function (platformKey) {
        refreshAccountConnectionStatus(platformKey);
      },
      { hintContext: 'pick' }
    );
    refreshAccountConnectionStatus(selectedPlatform());
  }

  function bindSetupLink() {
    if (!setupLink || setupLink.dataset.boundConnectedSetup) return;
    setupLink.dataset.boundConnectedSetup = '1';
    setupLink.addEventListener('click', function (e) {
      const eid = resolveEventId();
      if (!eid) return;
      const ids = eventIdsFromQueryArray();
      const platform = selectedPlatform();
      cacheSetupPrefetch();
      if (setupLink) {
        setupLink.setAttribute('aria-busy', 'true');
        setupLink.classList.add('is-loading');
      }
      if (typeof embed.notifyEmbedDrawerBusy === 'function') {
        embed.notifyEmbedDrawerBusy(true, 'Opening Connected setup…', 'tickets');
      }
      if (
        isEmbedDrawer() &&
        typeof embed.notifyParent === 'function' &&
        embed.notifyParent('hub-event-goto-connected-setup', {
          eventId: eid,
          eventIds: ids,
          title: (loadedEvent && loadedEvent.title) || '',
          platform: platform,
        })
      ) {
        e.preventDefault();
        return;
      }
      if (typeof embed.buildEmbedHref === 'function') {
        setupLink.href = embed.buildEmbedHref('/organiser/event-connected-setup', {
          id: eid,
          eventIds: ids,
          platform: platform,
          fromTickets: true,
        });
      } else {
        setupLink.href =
          '/organiser/event-connected-setup?id=' +
          encodeURIComponent(eid) +
          '&platform=' +
          encodeURIComponent(platform) +
          '&from=tickets';
      }
    });
  }

  function refreshCardVisibility() {
    const show = shouldShowCard();
    card.hidden = !show;
    if (!show) {
      setConnectedOnlyLayout(false);
      document.documentElement.classList.remove('ee-connected-tickets-checking');
      card.classList.remove('is-active');
      showStatus('');
      return;
    }

    if (planLink) planLink.hidden = false;

    const eid = resolveEventId();
    if (setupLink) {
      var setupHref;
      if (typeof embed.buildEmbedHref === 'function' && eid) {
        setupHref = embed.buildEmbedHref('/organiser/event-connected-setup', {
          id: eid,
          eventIds: eventIdsFromQueryArray(),
          platform: selectedPlatform(),
          fromTickets: true,
        });
      } else {
        setupHref = eid
          ? '/organiser/event-connected-setup?id=' + encodeURIComponent(eid)
          : '/organiser/event-connected-setup';
      }
      setupLink.href = setupHref;
      if (eid && setupHref) {
        var pf = document.querySelector('link[data-connected-setup-prefetch]');
        if (!pf) {
          pf = document.createElement('link');
          pf.rel = 'prefetch';
          pf.setAttribute('data-connected-setup-prefetch', '1');
          document.head.appendChild(pf);
        }
        pf.href = setupHref;
      }
    }

    setConnectedOnlyLayout(true);
    initPlatformPicker();
    loadProviderCatalogForTickets();

    if (isExternalConnectedEvent(loadedEvent)) {
      card.classList.add('is-active');
      showStatus('This event uses Connected booking. Use Connected event setup to edit price and booking link.', 'ok');
    } else {
      card.classList.remove('is-active');
      if (!billingActive) {
        showStatus(
          'This event uses Connected booking but your plan is not active. Renew or contact us.',
          'error'
        );
      } else {
        showStatus('');
      }
    }
  }

  function applyEventFields(ev) {
    loadedEvent = ev || null;
    refreshCardVisibility();
  }

  window.addEventListener('ee-event-loaded', function (e) {
    applyEventFields(e.detail && e.detail.event);
    cacheSetupPrefetch();
  });

  bindPlanLink();
  bindSetupLink();

  if (setupLink) {
    setupLink.addEventListener('mouseenter', cacheSetupPrefetch);
    setupLink.addEventListener('focus', cacheSetupPrefetch);
  }

  api('/api/organiser/connected-booking').then(function (res) {
    if (res.ok && res.data && res.data.featureEnabled) {
      featureEnabled = true;
      billingActive = Boolean(res.data.active);
      billingPayload = res.data;
    }
    refreshCardVisibility();
    cacheSetupPrefetch();
  });

  refreshCardVisibility();
})();
