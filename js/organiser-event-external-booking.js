/**
 * Connected booking entry on Set up tickets — links to dedicated Connected setup page.
 */
(function () {
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

  function eventIdFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get('id') || params.get('eventId') || '').trim();
  }

  function setConnectedOnlyLayout(on) {
    document.body.classList.toggle('ee-connected-tickets-only', on);
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

  function refreshCardVisibility() {
    const show = shouldShowCard();
    card.hidden = !show;
    if (!show) {
      setConnectedOnlyLayout(false);
      card.classList.remove('is-active');
      showStatus('');
      return;
    }

    if (planLink) planLink.hidden = false;

    const eid = eventIdFromQuery();
    if (setupLink && eid) {
      setupLink.href = '/organiser/event-connected-setup?id=' + encodeURIComponent(eid);
    }

    setConnectedOnlyLayout(true);

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
  });

  api('/api/organiser/connected-booking').then(function (res) {
    if (res.ok && res.data && res.data.featureEnabled) {
      featureEnabled = true;
      billingActive = Boolean(res.data.active);
    }
    refreshCardVisibility();
  });

  refreshCardVisibility();
})();
