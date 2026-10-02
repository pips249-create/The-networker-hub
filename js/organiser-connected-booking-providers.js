(function () {
  var panel = document.getElementById('cb-providers-panel');
  var list = document.getElementById('cb-providers-list');
  var schemaWarn = document.getElementById('cb-providers-schema-warn');
  var linkCard = document.getElementById('cb-providers-link-card');
  var linksCard = document.getElementById('cb-event-links-card');
  var linksTableWrap = document.getElementById('cb-event-links-table-wrap');
  var linkStatus = document.getElementById('cb-providers-link-status');
  var saveLinkBtn = document.getElementById('cb-providers-link-save');

  var PROVIDER_LABELS = {
    eventbrite: 'Eventbrite',
    ticket_tailor: 'Ticket Tailor',
    luma: 'Luma',
    trybooking: 'TryBooking',
    own_site: 'Your own website',
  };

  var EXTERNAL_ID_LABELS = {
    eventbrite: 'Eventbrite numeric event id',
    ticket_tailor: 'Ticket Tailor ev_… event id (Box office)',
    luma: 'Luma event id or slug',
    trybooking: 'TryBooking event id',
    own_site: 'Optional — TNH event id in webhook JSON',
  };

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

  function copyText(text) {
    var value = String(text || '').trim();
    if (!value) return Promise.reject();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value);
    }
    window.prompt('Copy:', value);
    return Promise.resolve();
  }

  function bindCopyWebhookButtons(root) {
    if (!root) return;
    root.querySelectorAll('[data-copy-provider-webhook]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var url = btn.getAttribute('data-copy-provider-webhook') || '';
        copyText(url).catch(function () {
          window.prompt('Copy webhook URL:', url);
        });
      });
    });
  }

  function renderEventLinks(links) {
    if (!linksCard || !linksTableWrap) return;
    var rows = (links || []).filter(function (row) {
      return row && row.event_id && row.provider && row.provider !== 'custom';
    });
    if (!rows.length) {
      linksCard.hidden = true;
      linksTableWrap.innerHTML = '';
      return;
    }
    linksCard.hidden = false;
    var body = rows
      .map(function (row) {
        var eid = esc(row.event_id);
        var provider = esc(PROVIDER_LABELS[row.provider] || row.provider);
        var ext = esc(row.external_event_id || '');
        var setupHref =
          '/organiser/event-connected-setup?id=' + encodeURIComponent(row.event_id);
        return (
          '<tr>' +
          '<td><code class="cb-event-links-id">' +
          eid +
          '</code></td>' +
          '<td>' +
          provider +
          '</td>' +
          '<td><code>' +
          ext +
          '</code></td>' +
          '<td><a class="ee-link" href="' +
          esc(setupHref) +
          '">Connected setup</a></td>' +
          '</tr>'
        );
      })
      .join('');
    linksTableWrap.innerHTML =
      '<table class="cb-event-links-table">' +
      '<thead><tr><th>TNH event id</th><th>Provider</th><th>Provider event id</th><th></th></tr></thead>' +
      '<tbody>' +
      body +
      '</tbody></table>';
  }

  function renderProviders(data) {
    if (!data || !data.ok) return;
    panel.hidden = false;
    if (linkCard) linkCard.hidden = false;

    if (data.schemaMissing && schemaWarn) {
      schemaWarn.hidden = false;
      schemaWarn.textContent =
        'Run Supabase migrations 299_connected_booking_provider_links.sql and 300_connected_booking_own_site_provider.sql to enable provider webhooks.';
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
          '</code></p>' +
          '<p class="ee-attendance-next"><button type="button" class="ee-btn ee-btn-outline ee-btn-sm" data-copy-provider-webhook="' +
          esc(p.webhookUrl) +
          '">Copy webhook URL</button></p>'
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

    bindCopyWebhookButtons(list);
    renderEventLinks(data.eventLinks || []);

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
        var eventbrite = (data && data.providers || []).filter(function (p) {
          return p && p.id === 'eventbrite' && p.eventbriteApiTokenConfigured;
        })[0];
        if (!eventbrite) return;
        fetch('/api/organiser/connected-booking-providers', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sync_eventbrite_attendees' }),
        }).catch(function () {});
      })
      .catch(function () {
        /* ignore */
      });
  }

  var providerSelect = document.getElementById('cb-link-provider');
  var externalIdLabel = document.getElementById('cb-link-external-id-label');
  var externalIdInput = document.getElementById('cb-link-external-id');
  var ownSiteHint = document.getElementById('cb-own-site-payload-hint');

  function syncLinkFormForProvider() {
    var p = providerSelect ? providerSelect.value : '';
    var isOwn = p === 'own_site';
    if (externalIdLabel) {
      externalIdLabel.textContent = EXTERNAL_ID_LABELS[p] || 'Provider event id';
    }
    if (externalIdInput) {
      if (p === 'ticket_tailor') {
        externalIdInput.placeholder = 'ev_40980';
      } else if (isOwn) {
        externalIdInput.placeholder = 'Same as TNH event id if you link for records';
      } else if (p === 'eventbrite') {
        externalIdInput.placeholder = '2001520723363';
      } else {
        externalIdInput.placeholder = '';
      }
    }
    if (ownSiteHint) ownSiteHint.hidden = !isOwn;
  }

  if (providerSelect) {
    providerSelect.addEventListener('change', syncLinkFormForProvider);
    syncLinkFormForProvider();
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
      if (!payload.eventId) {
        setLinkStatus('Enter TNH event id.', 'error');
        return;
      }
      if (payload.provider !== 'own_site' && !payload.externalEventId) {
        setLinkStatus('Enter provider event id.', 'error');
        return;
      }
      if (payload.provider === 'own_site' && !payload.externalEventId) {
        payload.externalEventId = payload.eventId;
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
          setLinkStatus(
            payload.provider === 'own_site'
              ? 'Event noted. Webhook POSTs use eventId in JSON — linking is optional for your own site.'
              : 'Event linked. New orders from this provider event id will sync here.',
            'ok'
          );
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
