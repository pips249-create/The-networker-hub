(function () {
  var panel = document.getElementById('cb-providers-panel');
  var list = document.getElementById('cb-providers-list');
  var detail = document.getElementById('cb-provider-detail');
  var schemaWarn = document.getElementById('cb-providers-schema-warn');
  var linkCard = document.getElementById('cb-providers-link-card');
  var linksCard = document.getElementById('cb-event-links-card');
  var linksTableWrap = document.getElementById('cb-event-links-table-wrap');
  var linkStatus = document.getElementById('cb-providers-link-status');
  var saveLinkBtn = document.getElementById('cb-providers-link-save');
  var selectedId = '';
  var lastProvidersData = null;

  var PROVIDER_LABELS = {
    eventbrite: 'Eventbrite',
    ticket_tailor: 'Ticket Tailor',
    luma: 'Luma',
    trybooking: 'TryBooking',
    own_site: 'Your website',
    meetup: 'Meetup',
  };

  var PROVIDER_MARK = {
    eventbrite: 'EB',
    ticket_tailor: 'TT',
    trybooking: 'TB',
    own_site: 'WWW',
    luma: 'LU',
    meetup: 'MU',
  };

  var PROVIDER_STEPS = {
    eventbrite: [
      'Open <a href="/organiser/#events-list">My events</a>.',
      'Expand <strong>Connect Eventbrite</strong>.',
      'Connect (or paste a private token), then Import each event onto an organiser page.',
      'Optional: open the <a href="/guides/connect-eventbrite" target="_blank" rel="noopener noreferrer">Eventbrite guide</a>.',
    ],
    own_site: [
      'Open an event → Connected setup / tickets and set your booking URL.',
      'Enable your own website connection below to get a webhook URL.',
      'After each sale, POST JSON with <code>eventId</code>, <code>orderId</code>, and <code>email</code>.',
      'Follow the <a href="/guides/connect-own-website" target="_blank" rel="noopener noreferrer">own website guide</a>.',
    ],
    ticket_tailor: [
      'Ticket Tailor connect is coming soon.',
      'When live, you will enable it here and paste your Ticket Tailor event id on each listing.',
    ],
    trybooking: [
      'TryBooking connect is coming soon.',
      'When live, you will enable it here and link each TryBooking event.',
    ],
    luma: [
      'Luma connect is coming soon.',
      'When live, you will enable it here and link each Luma event.',
    ],
    meetup: [
      'Meetup connect is coming soon.',
      'When live, you will enable it here and link each Meetup event.',
    ],
  };

  var EXTERNAL_ID_LABELS = {
    eventbrite: 'Eventbrite numeric event id',
    ticket_tailor: 'Ticket Tailor ev_… event id (Box office)',
    luma: 'Luma event id or slug',
    trybooking: 'TryBooking event id',
    own_site: 'Optional — TNH event id in webhook JSON',
    meetup: 'Meetup event id',
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

  function defaultTestEventId(links) {
    var linkInput = document.getElementById('cb-link-event-id');
    if (linkInput && linkInput.value && String(linkInput.value).trim()) {
      return String(linkInput.value).trim();
    }
    var own = (links || []).filter(function (row) {
      return row && row.provider === 'own_site' && row.event_id;
    })[0];
    if (own) return String(own.event_id);
    var any = (links || []).filter(function (row) {
      return row && row.event_id;
    })[0];
    return any ? String(any.event_id) : '';
  }

  function bindSendTestBookingButtons(root, links) {
    if (!root) return;
    root.querySelectorAll('[data-send-test-booking]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var suggested = defaultTestEventId(links);
        var eventId = window.prompt(
          'Enter the Networker UK event id to receive the test attendee:',
          suggested || ''
        );
        if (eventId == null) return;
        eventId = String(eventId).trim();
        if (!eventId) {
          window.alert('Event id is required.');
          return;
        }
        btn.disabled = true;
        fetch('/api/organiser/connected-booking-providers', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send_test_booking', eventId: eventId }),
        })
          .then(function (r) {
            return r.json().then(function (body) {
              return { ok: r.ok, body: body };
            });
          })
          .then(function (res) {
            btn.disabled = false;
            if (!res.ok) {
              window.alert(res.body.message || res.body.error || 'Could not send test booking.');
              return;
            }
            window.alert(res.body.message || 'Test booking sent.');
            if (typeof window.refreshOrganiserConnectedBooking === 'function') {
              window.refreshOrganiserConnectedBooking({ silent: true });
            }
          })
          .catch(function () {
            btn.disabled = false;
            window.alert('Could not send test booking.');
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
          '">Event setup</a></td>' +
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

  function providerGuideHref(p) {
    if (p && p.guidePath) return String(p.guidePath);
    if (p && p.id === 'eventbrite') return '/guides/connect-eventbrite';
    if (p && p.id === 'own_site') return '/guides/connect-own-website';
    return '';
  }

  function renderDetail(p, data) {
    if (!detail) return;
    if (!p) {
      detail.hidden = true;
      detail.innerHTML = '';
      return;
    }
    var live = String(p.status || '').toLowerCase() === 'live';
    var steps = PROVIDER_STEPS[p.id] || ['More details coming soon.'];
    var stepsHtml =
      '<ol class="cb-provider-steps">' +
      steps
        .map(function (step) {
          return '<li>' + step + '</li>';
        })
        .join('') +
      '</ol>';

    var enableBtn =
      live && p.connectionStatus === 'not_configured'
        ? '<button type="button" class="ee-btn ee-btn-gold ee-btn-sm" data-enable-provider="' +
          esc(p.id) +
          '">Enable connection</button>'
        : '';
    var guideHref = providerGuideHref(p);
    var guideBtn = guideHref
      ? '<a class="ee-btn ee-btn-outline ee-btn-sm" href="' +
        esc(guideHref) +
        '" target="_blank" rel="noopener noreferrer">Open guide</a>'
      : '';
    var myEventsBtn =
      live && p.id === 'eventbrite'
        ? '<a class="ee-btn ee-btn-gold ee-btn-sm" href="/organiser/#events-list">Go to My events →</a>'
        : '';
    var copyBtn =
      live && p.webhookUrl
        ? '<button type="button" class="ee-btn ee-btn-outline ee-btn-sm" data-copy-provider-webhook="' +
          esc(p.webhookUrl) +
          '">Copy webhook URL</button>'
        : '';
    var testBtn =
      live && p.id === 'own_site' && p.webhookUrl
        ? '<button type="button" class="ee-btn ee-btn-outline ee-btn-sm" data-send-test-booking="own_site">Send test booking</button>'
        : '';
    var webhookBlock = !live
      ? '<p class="ee-hint">This connection is not selectable yet.</p>'
      : p.webhookUrl
        ? '<p class="ee-hint cb-provider-webhook"><strong>Webhook URL</strong><br /><code class="cb-provider-webhook-url">' +
          esc(p.webhookUrl) +
          '</code></p>'
        : live
          ? '<p class="ee-hint">Enable the connection to generate your webhook URL (where needed).</p>'
          : '';

    var statusLabel = live
      ? p.connectionStatus === 'active' || p.eventbriteApiTokenConfigured
        ? 'Connected'
        : 'Live'
      : 'Coming soon';

    detail.hidden = false;
    detail.innerHTML =
      '<div class="cb-provider-detail-inner">' +
      '<div class="cb-provider-detail-head">' +
      '<h3 class="cb-provider-detail-title">' +
      esc(p.label || PROVIDER_LABELS[p.id] || p.id) +
      '</h3>' +
      '<span class="cb-provider-badge' +
      (live ? ' cb-provider-badge--live' : ' cb-provider-badge--soon') +
      '">' +
      esc(statusLabel) +
      '</span>' +
      '</div>' +
      '<p class="ee-hint">' +
      esc(p.docsHint || '') +
      '</p>' +
      '<h4 class="cb-provider-steps-title">Steps</h4>' +
      stepsHtml +
      webhookBlock +
      '<p class="ee-attendance-next">' +
      [myEventsBtn, enableBtn, guideBtn, copyBtn, testBtn].filter(Boolean).join(' ') +
      '</p>' +
      '</div>';

    bindCopyWebhookButtons(detail);
    bindSendTestBookingButtons(detail, (data && data.eventLinks) || []);
    detail.querySelectorAll('[data-enable-provider]').forEach(function (btn) {
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

  function selectProvider(id) {
    selectedId = String(id || '');
    list.querySelectorAll('.cb-provider-tile').forEach(function (btn) {
      var on = btn.getAttribute('data-provider-id') === selectedId;
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var providers = (lastProvidersData && lastProvidersData.providers) || [];
    var match = providers.filter(function (p) {
      return p && p.id === selectedId;
    })[0];
    renderDetail(match, lastProvidersData);
  }

  function renderProviders(data) {
    if (!data || !data.ok) return;
    lastProvidersData = data;
    panel.hidden = false;
    if (linkCard) linkCard.hidden = true;

    if (data.schemaMissing && schemaWarn) {
      schemaWarn.hidden = false;
      schemaWarn.textContent =
        'Database update needed for provider webhooks (migrations 299/300). Email hi@thenetworkeruk.com if this persists.';
    } else if (schemaWarn) {
      schemaWarn.hidden = true;
    }

    list.innerHTML = '';
    list.className = 'cb-provider-tiles';
    (data.providers || []).forEach(function (p) {
      if (!p || p.id === 'custom') return;
      var live = String(p.status || '').toLowerCase() === 'live';
      var li = document.createElement('li');
      li.className = 'cb-provider-tile-wrap';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'cb-provider-tile' +
        (live ? '' : ' is-soon') +
        (selectedId === p.id ? ' is-selected' : '');
      btn.setAttribute('data-provider-id', p.id);
      btn.setAttribute('aria-pressed', selectedId === p.id ? 'true' : 'false');
      btn.innerHTML =
        '<span class="cb-provider-tile-mark cb-provider-tile-mark--' +
        esc(p.id) +
        '" aria-hidden="true">' +
        esc(PROVIDER_MARK[p.id] || String(p.label || '?').slice(0, 2).toUpperCase()) +
        '</span>' +
        '<span class="cb-provider-tile-label">' +
        esc(PROVIDER_LABELS[p.id] || p.label || p.id) +
        '</span>' +
        '<span class="cb-provider-tile-status">' +
        (live ? 'Live' : 'Soon') +
        '</span>';
      btn.addEventListener('click', function () {
        if (selectedId === p.id) {
          selectedId = '';
          selectProvider('');
          return;
        }
        selectProvider(p.id);
      });
      li.appendChild(btn);
      list.appendChild(li);
    });

    renderEventLinks(data.eventLinks || []);
    if (selectedId) {
      selectProvider(selectedId);
    } else if (detail) {
      detail.hidden = true;
      detail.innerHTML = '';
    }
  }

  function loadProviders() {
    fetch('/api/organiser/connected-booking-providers', { credentials: 'include', cache: 'no-store' })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data && data.ok) renderProviders(data);
        var eventbrite = ((data && data.providers) || []).filter(function (p) {
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
      .catch(function () {});
  }

  if (saveLinkBtn) {
    saveLinkBtn.addEventListener('click', function () {
      var eventId = String((document.getElementById('cb-link-event-id') || {}).value || '').trim();
      var provider = String((document.getElementById('cb-link-provider') || {}).value || '').trim();
      var externalEventId = String(
        (document.getElementById('cb-link-external-id') || {}).value || ''
      ).trim();
      if (!eventId || !provider) {
        setLinkStatus('Event id and provider are required.', 'error');
        return;
      }
      saveLinkBtn.disabled = true;
      fetch('/api/organiser/connected-booking-providers', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link_event',
          eventId: eventId,
          provider: provider,
          externalEventId: externalEventId,
        }),
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
          setLinkStatus('Event link saved.', 'ok');
          loadProviders();
        })
        .catch(function () {
          saveLinkBtn.disabled = false;
          setLinkStatus('Could not save link.', 'error');
        });
    });
  }

  var providerSelect = document.getElementById('cb-link-provider');
  if (providerSelect) {
    providerSelect.addEventListener('change', function () {
      var label = document.getElementById('cb-link-external-id-label');
      var hint = document.getElementById('cb-own-site-payload-hint');
      var val = String(providerSelect.value || '');
      if (label) label.textContent = EXTERNAL_ID_LABELS[val] || 'Provider event id';
      if (hint) hint.hidden = val !== 'own_site';
    });
  }

  window.addEventListener('hub-organiser-connected-booking', function () {
    loadProviders();
  });

  loadProviders();
})();
