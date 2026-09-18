(function () {
  var panel = document.getElementById('cb-providers-panel');
  var list = document.getElementById('cb-providers-list');
  var schemaWarn = document.getElementById('cb-providers-schema-warn');
  var linkCard = document.getElementById('cb-providers-link-card');
  var linkStatus = document.getElementById('cb-providers-link-status');
  var saveLinkBtn = document.getElementById('cb-providers-link-save');

  if (!panel || !list) return;

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function setLinkStatus(msg, kind) {
    if (!linkStatus) return;
    linkStatus.hidden = !msg;
    linkStatus.textContent = msg || '';
    linkStatus.className =
      'ee-hint' + (kind === 'error' ? ' ee-alert-warn' : kind === 'ok' ? ' ee-alert-ok' : '');
  }

  function renderProviders(data) {
    if (!data || !data.ok) return;
    panel.hidden = false;
    if (linkCard) linkCard.hidden = false;

    if (data.schemaMissing && schemaWarn) {
      schemaWarn.hidden = false;
      schemaWarn.textContent =
        'Run Supabase migration 299_connected_booking_provider_links.sql to enable provider webhooks.';
    } else if (schemaWarn) {
      schemaWarn.hidden = true;
    }

    list.innerHTML = '';
    (data.providers || []).forEach(function (p) {
      if (p.id === 'custom') return;
      var li = document.createElement('li');
      li.className = 'cb-providers-list-item';
      var actions =
        p.connectionStatus === 'not_configured'
          ? '<button type="button" class="ee-btn ee-btn-outline ee-btn-sm" data-enable-provider="' +
            esc(p.id) +
            '">Enable</button>'
          : '';
      var urlBlock = p.webhookUrl
        ? '<p class="ee-hint cb-provider-webhook"><strong>Webhook URL</strong> (paste in ' +
          esc(p.label) +
          '):<br /><code class="cb-provider-webhook-url">' +
          esc(p.webhookUrl) +
          '</code></p>'
        : '<p class="ee-hint">Click Enable to generate your webhook URL.</p>';
      li.innerHTML =
        '<div class="cb-provider-card">' +
        '<p class="cb-provider-name"><strong>' +
        esc(p.label) +
        '</strong> <span class="cb-provider-badge">' +
        esc(p.status) +
        '</span></p>' +
        '<p class="ee-hint">' +
        esc(p.docsHint) +
        '</p>' +
        urlBlock +
        actions +
        '</div>';
      list.appendChild(li);
    });

    list.querySelectorAll('[data-enable-provider]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var provider = btn.getAttribute('data-enable-provider');
        btn.disabled = true;
        fetch('/api/organiser/connected-booking-providers', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'enable_provider', provider: provider }),
        })
          .then(function (r) {
            return r.json().then(function (body) {
              return { ok: r.ok, body: body };
            });
          })
          .then(function (res) {
            btn.disabled = false;
            if (!res.ok) {
              window.alert(res.body.message || res.body.error || 'Could not enable provider.');
              return;
            }
            loadProviders();
          })
          .catch(function () {
            btn.disabled = false;
            window.alert('Could not enable provider.');
          });
      });
    });
  }

  function loadProviders() {
    fetch('/api/organiser/connected-booking-providers', { credentials: 'include', cache: 'no-store' })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data && data.ok) renderProviders(data);
      })
      .catch(function () {
        /* ignore */
      });
  }

  if (saveLinkBtn) {
    saveLinkBtn.addEventListener('click', function () {
      var eventId = document.getElementById('cb-link-event-id');
      var provider = document.getElementById('cb-link-provider');
      var externalId = document.getElementById('cb-link-external-id');
      var payload = {
        action: 'link_event',
        eventId: eventId ? eventId.value.trim() : '',
        provider: provider ? provider.value : '',
        externalEventId: externalId ? externalId.value.trim() : '',
      };
      if (!payload.eventId || !payload.externalEventId) {
        setLinkStatus('Enter TNH event id and provider event id.', 'error');
        return;
      }
      saveLinkBtn.disabled = true;
      setLinkStatus('Saving…');
      fetch('/api/organiser/connected-booking-providers', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          return r.json().then(function (body) {
            return { ok: r.ok, body: body };
          });
        })
        .then(function (res) {
          saveLinkBtn.disabled = false;
          if (!res.ok) {
            setLinkStatus(res.body.message || res.body.error || 'Could not save link.', 'error');
            return;
          }
          setLinkStatus('Event linked. New orders from this provider event id will sync here.', 'ok');
        })
        .catch(function () {
          saveLinkBtn.disabled = false;
          setLinkStatus('Could not save link.', 'error');
        });
    });
  }

  window.addEventListener('hub-organiser-connected-booking', function (e) {
    if (e && e.detail && e.detail.ok && e.detail.active) loadProviders();
  });

  loadProviders();
})();
