/**
 * Event location & access step — in-person venue or online join details.
 */
(function () {
  const SERIES_STORAGE_KEY = 'hub_event_series';
  const FORMAT_STORAGE_KEY = 'hub_event_format';
  const LOCATION_AUTODRAFT_PREFIX = 'hub_event_location_autodraft_v1:';
  const AUTODRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
  const ORG_BOOTSTRAP_CACHE_KEY = 'hub_org_bootstrap_cache';
  const ORG_BOOTSTRAP_CACHE_MS = 120000;
  const params = new URLSearchParams(location.search);
  const editId = params.get('id') || '';
  const isEmbedDrawer = params.get('embed') === '1' || window.self !== window.top;

  if (isEmbedDrawer) {
    document.documentElement.classList.add('ee-embed-drawer-root');
    if (document.body) document.body.classList.add('ee-embed-drawer');
    const pageHead = document.querySelector('.ee-page-head');
    if (pageHead) pageHead.hidden = true;
  }

  let eventFormat = 'in-person';
  let eventIds = [];
  let loadedEvent = null;
  let currentEventLocked = false;
  let currentSeriesDateOnly = false;
  let autodraftTimer = null;
  let restoringAutodraft = false;
  let autodraftDisabled = false;

  const FORMAT_LABELS = {
    'in-person': 'In person',
    online: 'Online',
  };

  function normalizeEventFormat(raw) {
    const s = String(raw || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-');
    if (s === 'inperson' || s === 'in-person' || s === 'in_person') return 'in-person';
    if (s === 'online' || s === 'virtual') return 'online';
    return s || '';
  }

  function looksLikeUrl(value) {
    const s = String(value || '').trim();
    if (!s) return false;
    if (/^https?:\/\//i.test(s) || /^mailto:/i.test(s)) return true;
    if (/\s/.test(s)) return false;
    return /^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(s);
  }

  function fieldValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function showAlert(msg) {
    const el = document.getElementById('ee-alert');
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
    if (msg) {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch {
        /* ignore */
      }
    }
  }

  async function api(path, opts) {
    const res = await fetch(path, {
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(opts && opts.headers) },
      ...opts,
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return { ok: res.ok, status: res.status, data };
  }

  function readSeriesMeta() {
    try {
      const raw = sessionStorage.getItem(SERIES_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function resolveEventIds() {
    const fromSeries = readSeriesMeta();
    if (fromSeries && Array.isArray(fromSeries.eventIds) && fromSeries.eventIds.length) {
      return fromSeries.eventIds.filter(Boolean);
    }
    const idsParam = params.get('ids') || '';
    if (idsParam) {
      return idsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return editId ? [editId] : [];
  }

  function autodraftKey() {
    const id = editId || (eventIds[0] || '');
    return id ? LOCATION_AUTODRAFT_PREFIX + id : '';
  }

  function setAutodraftStatus(text, tone) {
    const el = document.getElementById('ee-autodraft-status');
    if (!el) return;
    el.textContent = text || '';
    el.className =
      'ee-hint ee-autodraft-status' +
      (tone === 'restored' ? ' is-restored' : tone === 'error' ? ' is-error' : '');
  }

  function collectLocationAutodraft() {
    if (!editId && !eventIds.length) return null;
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      eventFormat,
      venue: fieldValue('ee-venue'),
      address1: fieldValue('ee-address1'),
      city: fieldValue('ee-city'),
      postcode: fieldValue('ee-postcode'),
      platform: fieldValue('ee-platform'),
      joinLink: fieldValue('ee-join-link'),
    };
  }

  function autodraftHasWork(draft) {
    if (!draft) return false;
    return Boolean(
      String(draft.venue || '').trim() ||
        String(draft.address1 || '').trim() ||
        String(draft.city || '').trim() ||
        String(draft.postcode || '').trim() ||
        String(draft.platform || '').trim() ||
        String(draft.joinLink || '').trim()
    );
  }

  function applyLocationDraft(draft) {
    restoringAutodraft = true;
    eventFormat = normalizeEventFormat(draft.eventFormat) || eventFormat;
    applyFormatUi(eventFormat);
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el && val != null) el.value = String(val);
    };
    set('ee-venue', draft.venue);
    set('ee-address1', draft.address1);
    set('ee-city', draft.city);
    set('ee-postcode', draft.postcode);
    set('ee-platform', draft.platform);
    set('ee-join-link', draft.joinLink);
    restoringAutodraft = false;
  }

  function saveAutodraftNow() {
    if (restoringAutodraft || autodraftDisabled) return;
    const draft = collectLocationAutodraft();
    const key = autodraftKey();
    if (!draft || !key) return;
    try {
      if (!autodraftHasWork(draft)) {
        localStorage.removeItem(key);
        setAutodraftStatus('');
        return;
      }
      localStorage.setItem(key, JSON.stringify(draft));
      setAutodraftStatus('Unsaved location changes kept in this browser.');
    } catch {
      setAutodraftStatus('Could not autosave in this browser.', 'error');
    }
  }

  function scheduleAutodraft() {
    if (restoringAutodraft || autodraftDisabled) return;
    window.clearTimeout(autodraftTimer);
    autodraftTimer = window.setTimeout(saveAutodraftNow, 700);
  }

  function restoreLocationAutodraft() {
    const key = autodraftKey();
    if (!key) return false;
    let draft;
    try {
      draft = JSON.parse(localStorage.getItem(key) || 'null');
      const age = Date.now() - new Date(draft?.savedAt || 0).getTime();
      if (!draft || !Number.isFinite(age) || age > AUTODRAFT_MAX_AGE_MS) {
        localStorage.removeItem(key);
        return false;
      }
    } catch {
      return false;
    }
    if (!autodraftHasWork(draft)) return false;
    applyLocationDraft(draft);
    setAutodraftStatus('Restored unsaved location changes from this browser.', 'restored');
    return true;
  }

  function bindAutodraft() {
    [
      '#ee-venue',
      '#ee-address1',
      '#ee-city',
      '#ee-postcode',
      '#ee-platform',
      '#ee-join-link',
    ].forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        el.addEventListener('input', scheduleAutodraft);
        el.addEventListener('change', scheduleAutodraft);
      });
    });
  }

  function setFormatPanelFieldsDisabled(block, disabled) {
    if (!block) return;
    block.querySelectorAll('input, select, textarea').forEach((el) => {
      el.disabled = disabled;
    });
  }

  function syncFormatToggleButtons() {
    document.querySelectorAll('[data-ee-format]').forEach((b) => {
      b.classList.toggle(
        'is-active',
        normalizeEventFormat(b.getAttribute('data-ee-format')) === eventFormat
      );
    });
  }

  function applyFormatUi(format) {
    eventFormat = normalizeEventFormat(format) || eventFormat || 'in-person';
    try {
      sessionStorage.setItem(FORMAT_STORAGE_KEY, eventFormat);
    } catch {
      /* ignore */
    }
    const venueBlock = document.getElementById('ee-venue-block');
    const onlineBlock = document.getElementById('ee-online-block');
    const showVenue = eventFormat === 'in-person';
    const showOnline = eventFormat === 'online';
    if (venueBlock) venueBlock.classList.toggle('is-visible', showVenue);
    if (onlineBlock) onlineBlock.classList.toggle('is-visible', showOnline);
    setFormatPanelFieldsDisabled(venueBlock, !showVenue || currentEventLocked || currentSeriesDateOnly);
    setFormatPanelFieldsDisabled(onlineBlock, !showOnline || currentEventLocked || currentSeriesDateOnly);
    syncFormatToggleButtons();
  }

  function bindFormatToggleButtons() {
    document.querySelectorAll('[data-ee-format]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (currentEventLocked || currentSeriesDateOnly) return;
        const fmt = btn.getAttribute('data-ee-format');
        eventFormat = normalizeEventFormat(fmt);
        applyFormatUi(eventFormat);
        scheduleAutodraft();
      });
    });
  }

  function buildLocationFields() {
    const showOnline = eventFormat === 'online';
    const venue = showOnline ? '' : document.getElementById('ee-venue').value.trim();
    const address1 = showOnline ? '' : document.getElementById('ee-address1').value.trim();
    const city = showOnline ? '' : document.getElementById('ee-city').value.trim();
    const postcode = showOnline ? '' : document.getElementById('ee-postcode').value.trim();
    const parts = [venue, address1, city, postcode].filter(Boolean);
    const fullAddress = parts.join(', ');
    return {
      venue,
      addressLine1: address1,
      city,
      postcode,
      location: showOnline ? 'Online' : fullAddress,
      fullAddress: showOnline ? 'Online' : fullAddress,
      eventFormat,
      onlinePlatform: showOnline ? document.getElementById('ee-platform').value.trim() : '',
      onlineLink: showOnline ? document.getElementById('ee-join-link').value.trim() : '',
    };
  }

  function inferFormatFromEvent(ev) {
    const loc = String(ev.location || '').trim().toLowerCase();
    if (loc === 'online' || loc.includes('online')) return 'online';
    if (ev.onlineLink) return 'online';
    if (looksLikeUrl(ev.location) || looksLikeUrl(ev.venue)) return 'online';
    return 'in-person';
  }

  function resolveEventFormat(ev) {
    const stored = normalizeEventFormat(ev.eventFormat);
    if (stored === 'online') return 'online';
    if (inferFormatFromEvent(ev) === 'online') return 'online';
    return stored === 'in-person' ? 'in-person' : 'in-person';
  }

  function normalizeEventForForm(ev) {
    const copy = { ...ev };
    copy.venue = String(ev.venue || '').trim();
    copy.addressLine1 = String(ev.addressLine1 || ev.address || '').trim();
    copy.city = String(ev.city || '').trim();
    copy.postcode = String(ev.postcode || '').trim();
    copy.location = String(ev.location || '').trim();
    if (!copy.postcode && copy.location && window.hubParseFullUkPostcode) {
      copy.postcode = window.hubParseFullUkPostcode(copy.location);
    }
    if (!copy.city && copy.location && window.hubParseCityFromLocationLabel) {
      copy.city = window.hubParseCityFromLocationLabel(copy.location, copy.postcode);
    }
    copy.onlinePlatform = String(ev.onlinePlatform || '').trim();
    copy.onlineLink = String(ev.onlineLink || '').trim();
    if (!copy.onlineLink && looksLikeUrl(copy.location)) copy.onlineLink = copy.location;
    else if (!copy.onlineLink && looksLikeUrl(copy.venue)) copy.onlineLink = copy.venue;
    else if (!copy.onlineLink && looksLikeUrl(copy.addressLine1)) copy.onlineLink = copy.addressLine1;
    if (looksLikeUrl(copy.venue)) copy.venue = '';
    if (looksLikeUrl(copy.addressLine1)) copy.addressLine1 = '';
    const locLower = copy.location.toLowerCase();
    if (!copy.addressLine1 && copy.location && locLower !== 'online' && !looksLikeUrl(copy.location)) {
      copy.addressLine1 = copy.location;
    }
    return copy;
  }

  function prefillLocationFromEvent(rawEv) {
    const ev = normalizeEventForForm(rawEv);
    document.getElementById('ee-venue').value = ev.venue || '';
    if (document.getElementById('ee-address1')) {
      document.getElementById('ee-address1').value = ev.addressLine1 || '';
    }
    if (document.getElementById('ee-city')) document.getElementById('ee-city').value = ev.city || '';
    if (document.getElementById('ee-postcode')) {
      document.getElementById('ee-postcode').value = ev.postcode || '';
    }
    if (document.getElementById('ee-platform')) {
      const platform = ev.onlinePlatform || '';
      const platformSel = document.getElementById('ee-platform');
      if (platform && ![...platformSel.options].some((o) => o.value === platform || o.text === platform)) {
        const opt = document.createElement('option');
        opt.value = platform;
        opt.textContent = platform;
        platformSel.appendChild(opt);
      }
      platformSel.value = platform;
    }
    if (document.getElementById('ee-join-link')) {
      document.getElementById('ee-join-link').value = ev.onlineLink || '';
    }
    eventFormat = resolveEventFormat(ev);
    applyFormatUi(eventFormat);
  }

  function clearLocationFieldErrors() {
    document.querySelectorAll('#ee-card-location .ee-field.is-error').forEach((field) => {
      field.classList.remove('is-error');
    });
    const postcodeHint = document.getElementById('ee-postcode-hint');
    if (postcodeHint) postcodeHint.hidden = true;
  }

  function showLocationFieldError(fieldId, message) {
    clearLocationFieldErrors();
    const input = document.getElementById(fieldId);
    const field = input ? input.closest('.ee-field') : null;
    if (field) field.classList.add('is-error');
    if (fieldId === 'ee-postcode') {
      const hint = document.getElementById('ee-postcode-hint');
      if (hint) {
        hint.textContent = message;
        hint.hidden = false;
      }
    }
    const card = document.getElementById('ee-card-location');
    if (card) {
      try {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch {
        /* ignore */
      }
    }
    showAlert(message);
  }

  function eventTicketsSoldCount(ev) {
    const sold = Number(ev.ticketsSold ?? ev.tickets_sold ?? 0);
    return Number.isFinite(sold) ? sold : 0;
  }

  function applyLockUi(locked) {
    currentEventLocked = Boolean(locked);
    const banner = document.getElementById('ee-lock-banner');
    if (banner) banner.hidden = !currentEventLocked;
    ['#ee-venue', '#ee-address1', '#ee-city', '#ee-postcode', '#ee-platform', '#ee-join-link'].forEach(
      (sel) => {
        const el = document.querySelector(sel);
        if (el) {
          el.disabled = currentEventLocked || currentSeriesDateOnly;
          const field = el.closest('.ee-field');
          if (field) field.classList.toggle('is-locked', currentEventLocked || currentSeriesDateOnly);
        }
      }
    );
    document.querySelectorAll('[data-ee-format]').forEach((btn) => {
      btn.disabled = currentEventLocked || currentSeriesDateOnly;
    });
    applyFormatUi(eventFormat);
  }

  function applySeriesDateOnlyUi(isDateOnly) {
    currentSeriesDateOnly = Boolean(isDateOnly);
    const card = document.getElementById('ee-card-location');
    if (card) card.classList.toggle('is-series-locked', currentSeriesDateOnly);
    const banner = document.getElementById('ee-series-banner');
    if (banner) {
      if (currentSeriesDateOnly) {
        banner.hidden = false;
        banner.innerHTML =
          'Location applies to the whole series. Open <strong>Edit event</strong> on the main series row in My Events to change venue or online access.';
      } else {
        banner.hidden = true;
      }
    }
    applyLockUi(currentEventLocked);
  }

  let postcodeLookupTimer = null;

  async function lookupCityFromPostcode() {
    const postcodeEl = document.getElementById('ee-postcode');
    const cityEl = document.getElementById('ee-city');
    if (!postcodeEl || !cityEl) return;
    const postcode = postcodeEl.value.trim().replace(/\s+/g, '');
    if (!postcode || cityEl.value.trim()) return;
    try {
      const res = await fetch(
        'https://api.postcodes.io/postcodes/' + encodeURIComponent(postcode)
      );
      const data = await res.json();
      if (data.status === 200 && data.result && data.result.admin_district) {
        cityEl.value = data.result.admin_district;
        scheduleAutodraft();
      }
    } catch {
      /* ignore */
    }
  }

  function bindPostcodeCityLookup() {
    const postcodeEl = document.getElementById('ee-postcode');
    if (!postcodeEl || postcodeEl.dataset.cityLookupBound === '1') return;
    postcodeEl.dataset.cityLookupBound = '1';
    const scheduleLookup = () => {
      window.clearTimeout(postcodeLookupTimer);
      postcodeLookupTimer = window.setTimeout(lookupCityFromPostcode, 400);
    };
    postcodeEl.addEventListener('change', scheduleLookup);
    postcodeEl.addEventListener('blur', scheduleLookup);
  }

  function bindBackLinks() {
    const detailsLink = document.getElementById('ee-back-details-link');
    const backLink = document.getElementById('ee-back-link');
    if (backLink && window.HubOrganiserActions) {
      window.HubOrganiserActions.applyBrowseReturnBack(
        backLink,
        '/organiser/#events-list',
        '← Back to My Events'
      );
    }
    if (!detailsLink || !eventIds[0]) return;
    detailsLink.hidden = false;
    if (isEmbedDrawer) {
      detailsLink.href = '#';
      detailsLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(
            { type: 'hub-event-goto-edit', eventId: eventIds[0] },
            window.location.origin
          );
        }
      });
    } else {
      detailsLink.href = '/organiser/event-edit?id=' + encodeURIComponent(eventIds[0]);
    }
  }

  function goToTicketSetup(series) {
    try {
      sessionStorage.setItem(SERIES_STORAGE_KEY, JSON.stringify(series));
    } catch {
      /* ignore */
    }
    if (isEmbedDrawer) return;
    const ids = (series.eventIds || []).join(',');
    location.href = '/organiser/event-tickets?ids=' + encodeURIComponent(ids);
  }

  function buildPatchPayload(locFields) {
    const ev = loadedEvent || {};
    return {
      organiserGroupId: ev.organiserGroupId || ev.groupId || '',
      title: ev.title || '',
      type: ev.type || ev.eventType || 'Meeting',
      listingStatus: 'draft',
      ...locFields,
    };
  }

  async function saveLocation(options) {
    const continueToTickets = options && options.continueToTickets;
    showAlert('');
    clearLocationFieldErrors();

    if (!loadedEvent || !eventIds.length) {
      showAlert('Event not found. Go back to event details and save again.');
      return;
    }

    const locFields = buildLocationFields();
    if (eventFormat === 'in-person' && !currentEventLocked && !currentSeriesDateOnly) {
      const hasLocation =
        locFields.venue || locFields.addressLine1 || locFields.city || locFields.postcode;
      if (continueToTickets && !locFields.postcode) {
        showLocationFieldError(
          'ee-postcode',
          'Enter a postcode before continuing — we use it to place your event on the map.'
        );
        return;
      }
      if (!continueToTickets && !hasLocation) {
        showLocationFieldError(
          'ee-venue',
          'Add a venue name or address before saving this in-person event.'
        );
        return;
      }
    }

    const submitBtn = document.getElementById('ee-submit');
    const draftBtn = document.getElementById('ee-save-draft');
    const loading = window.organiserPageLoading;
    [submitBtn, draftBtn].forEach((b) => {
      if (b) b.disabled = true;
    });

    const patchPayload = buildPatchPayload(locFields);
    const saveLabel = continueToTickets ? 'Continuing to tickets' : 'Saving location';

    const saveWork = async () => {
      const updatedEvents = [];
      for (const id of eventIds) {
        const res = await api('/api/organiser/events', {
          method: 'PATCH',
          body: JSON.stringify({ id, ...patchPayload }),
        });
        if (!res.ok) return res;
        if (res.data.event) updatedEvents.push(res.data.event);
      }
      return { ok: true, data: { events: updatedEvents, eventIds } };
    };

    let res;
    try {
      if (loading && loading.run) {
        res = await loading.run(saveLabel, saveWork);
      } else {
        if (loading) loading.show(saveLabel);
        res = await saveWork();
        if (loading) loading.hide();
      }
    } finally {
      [submitBtn, draftBtn].forEach((b) => {
        if (b) b.disabled = false;
      });
    }

    if (!res.ok) {
      showAlert(res.data.message || res.data.error || 'Could not save location');
      return;
    }

    autodraftDisabled = true;
    try {
      localStorage.removeItem(autodraftKey());
    } catch {
      /* ignore */
    }
    setAutodraftStatus('');

    const savedEvents = res.data.events || [];
    const linkEmails = savedEvents[0] && savedEvents[0].linkUpdateEmails;
    if (linkEmails && linkEmails.sent > 0) {
      showAlert(
        'Join link saved. We emailed ' +
          linkEmails.sent +
          ' ticket holder' +
          (linkEmails.sent === 1 ? '' : 's') +
          ' with the link.',
        'ok'
      );
    }

    if (!continueToTickets) {
      if (isEmbedDrawer && window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'hub-event-saved', draft: true }, window.location.origin);
        return;
      }
      location.href = '/organiser/#events-list';
      return;
    }

    const title = loadedEvent.title || '';
    const organiserGroupId = loadedEvent.organiserGroupId || loadedEvent.groupId || '';
    const leadImage = (savedEvents[0] && savedEvents[0].imageUrl) || loadedEvent.imageUrl || '';
    const leadImagePosition =
      (savedEvents[0] && savedEvents[0].imagePosition) || loadedEvent.imagePosition || '';
    const seriesPayload = {
      title,
      organiserGroupId,
      eventFormat: locFields.eventFormat,
      eventIds,
      imageUrl: leadImage,
      imagePosition: leadImagePosition,
      events: savedEvents.map((ev) => ({
        id: ev.id,
        title: ev.title,
        date: ev.date,
        imageUrl: ev.imageUrl || leadImage,
        imagePosition: ev.imagePosition || leadImagePosition,
      })),
    };

    if (isEmbedDrawer && window.parent && window.parent !== window) {
      goToTicketSetup(seriesPayload);
      window.parent.postMessage(
        { type: 'hub-event-goto-tickets', eventIds, title },
        window.location.origin
      );
      return;
    }
    goToTicketSetup(seriesPayload);
  }

  async function loadEvent() {
    eventIds = resolveEventIds();
    if (!eventIds.length) {
      showAlert('No event found. Go back to event details and save your listing first.');
      return;
    }

    const seriesMeta = readSeriesMeta();
    if (seriesMeta && seriesMeta.eventFormat) {
      eventFormat = normalizeEventFormat(seriesMeta.eventFormat) || eventFormat;
    }

    let ev = null;
    const embedBootstrap = window.HubOrganiserEmbedBootstrap;
    if (embedBootstrap && embedBootstrap.readCache) {
      const cached = embedBootstrap.readCache();
      if (cached) {
        ev = (cached.events || []).find((e) => e.id === eventIds[0]) || null;
      }
    }
    if (!ev) {
      const evRes = await api('/api/organiser/events?id=' + encodeURIComponent(eventIds[0]));
      if (evRes.ok && evRes.data.event) ev = evRes.data.event;
    }
    if (!ev) {
      showAlert('Event not found. It may have been deleted.');
      return;
    }

    loadedEvent = ev;
    if (params.get('seriesDate') === '1') {
      applySeriesDateOnlyUi(true);
    }
    prefillLocationFromEvent(ev);
    applyLockUi(ev.locked || eventTicketsSoldCount(ev) > 0);
    restoreLocationAutodraft();
    bindBackLinks();

    const titleEl = document.getElementById('ee-page-title');
    if (titleEl && ev.title) {
      titleEl.textContent = 'Location: ' + ev.title;
    }
  }

  function notifyEmbedDrawerReady() {
    if (window.HubFieldTip && window.HubFieldTip.init) {
      window.HubFieldTip.init('[data-hub-tip]');
    }
    if (isEmbedDrawer && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'hub-event-drawer-ready' }, window.location.origin);
    }
  }

  async function bootLocationStep() {
    bindFormatToggleButtons();
    bindPostcodeCityLookup();
    bindAutodraft();
    const loading = window.organiserPageLoading;
    if (loading) loading.show('Loading location');
    try {
      await loadEvent();
    } finally {
      if (loading) loading.hide();
    }
    notifyEmbedDrawerReady();
    if (!editId && window.HubFlowTour && window.HubFlowTour.startEventLocationTour) {
      window.HubFlowTour.startEventLocationTour({ delay: 0 });
    }
  }

  document.getElementById('ee-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveLocation({ continueToTickets: true });
  });

  const draftBtn = document.getElementById('ee-save-draft');
  if (draftBtn) {
    draftBtn.addEventListener('click', () => saveLocation({ continueToTickets: false }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootLocationStep);
  } else {
    bootLocationStep();
  }
})();
