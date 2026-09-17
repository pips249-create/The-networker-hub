/**
 * Connected external booking — Set up tickets (only when feature + active plan, or existing Connected event).
 */
(function () {
  const form = document.getElementById('ee-tickets-form');
  if (!form || form.dataset.externalBookingBound) return;
  form.dataset.externalBookingBound = '1';

  const card = document.getElementById('ee-external-booking-card');
  if (!card) return;

  const toggle = document.getElementById('ee-external-booking-enabled');
  const urlInput = document.getElementById('ee-external-booking-url');
  const priceInput = document.getElementById('ee-external-price-label');
  const hubPanels = document.getElementById('ee-hub-ticket-panels');
  const saveBtn = document.getElementById('ee-external-booking-save');
  const publishBtn = document.getElementById('ee-external-booking-publish');
  const statusEl = document.getElementById('ee-external-booking-status');
  const planLink = document.getElementById('ee-connected-plan-link');

  let billingActive = false;
  let featureEnabled = false;
  let loadedEvent = null;

  function api(path, opts) {
    return fetch(path, Object.assign({ credentials: 'include', headers: { 'Content-Type': 'application/json' } }, opts || {})).then(
      function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      }
    );
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

  function refreshCardVisibility() {
    const show = shouldShowCard();
    card.hidden = !show;
    if (!show) {
      if (hubPanels) hubPanels.hidden = false;
      return;
    }

    if (planLink) planLink.hidden = false;

    if (!billingActive && isExternalConnectedEvent(loadedEvent)) {
      showStatus(
        'This event uses Connected but your plan is not active. Renew or contact us to edit or publish.',
        'error'
      );
    }

    syncPanels();
  }

  function syncPanels() {
    if (!shouldShowCard()) return;
    const on = toggle && toggle.checked;
    card.classList.toggle('is-active', Boolean(on));
    if (hubPanels) hubPanels.hidden = Boolean(on);
  }

  function eventIdFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get('id') || params.get('eventId') || '').trim();
  }

  function applyEventFields(ev) {
    loadedEvent = ev || null;
    if (!ev) {
      refreshCardVisibility();
      return;
    }
    if (isExternalConnectedEvent(ev)) {
      if (toggle) toggle.checked = true;
      if (urlInput) urlInput.value = ev.externalBookingUrl || '';
      if (priceInput) priceInput.value = ev.externalPriceLabel || '';
    }
    refreshCardVisibility();
  }

  window.addEventListener('ee-event-loaded', function (e) {
    applyEventFields(e.detail && e.detail.event);
  });

  if (toggle) toggle.addEventListener('change', syncPanels);

  async function saveExternal(publish) {
    const eventId = eventIdFromQuery();
    if (!eventId) {
      showStatus('Open an event from My Events first.', 'error');
      return;
    }
    if (!billingActive) {
      showStatus('Connected is not active on your account yet.', 'error');
      return;
    }
    if (!toggle || !toggle.checked) {
      showStatus('Turn on Connected to save.', 'error');
      return;
    }
    const url = urlInput ? urlInput.value.trim() : '';
    const priceLabel = priceInput ? priceInput.value.trim() : '';
    if (!url || !priceLabel) {
      showStatus('Enter your booking page URL and a price label (e.g. Free or £15).', 'error');
      return;
    }
    showStatus('Saving…');
    const existingRes = await api('/api/organiser/events?id=' + encodeURIComponent(eventId));
    if (!existingRes.ok || !existingRes.data.event) {
      showStatus(existingRes.data?.message || 'Could not load this event.', 'error');
      return;
    }
    const ev = existingRes.data.event;
    const payload = {
      id: eventId,
      title: ev.title,
      organiserGroupId: ev.organiserGroupId || (ev.organiserGroupIds && ev.organiserGroupIds[0]) || '',
      checkoutMode: 'external_connected',
      externalBookingUrl: url,
      externalPriceLabel: priceLabel,
      listingStatus: publish ? 'published' : 'draft',
    };
    const { ok, data } = await api('/api/organiser/events', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (!ok) {
      showStatus(data.message || data.error || 'Could not save.', 'error');
      return;
    }
    loadedEvent = Object.assign({}, ev, payload, { checkoutMode: 'external_connected' });
    showStatus(publish ? 'Published with Connected.' : 'Saved Connected settings.', 'ok');
    refreshCardVisibility();
  }

  if (saveBtn) saveBtn.addEventListener('click', function () { saveExternal(false); });
  if (publishBtn) publishBtn.addEventListener('click', function () { saveExternal(true); });

  api('/api/organiser/connected-booking').then(function (res) {
    if (res.ok && res.data && res.data.featureEnabled) {
      featureEnabled = true;
      billingActive = Boolean(res.data.active);
    } else {
      featureEnabled = false;
      billingActive = false;
    }
    refreshCardVisibility();
  });

  refreshCardVisibility();
})();
