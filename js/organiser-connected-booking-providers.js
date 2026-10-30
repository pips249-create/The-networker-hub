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

  var LOGO_BASE = '/assets/booking-providers/';

  var PROVIDER_LABELS = {
    networker: 'The Networker UK',
    eventbrite: 'Eventbrite',
    ticket_tailor: 'Ticket Tailor',
    luma: 'Luma',
    trybooking: 'TryBooking',
    own_site: 'Your website',
    meetup: 'Meetup',
  };

  var PROVIDER_LOGOS = {
    networker: '/assets/logo-hub-dark.png',
    eventbrite: LOGO_BASE + 'eventbrite.svg',
    ticket_tailor: LOGO_BASE + 'ticket-tailor.svg',
    trybooking: LOGO_BASE + 'trybooking.svg',
    own_site: LOGO_BASE + 'own-site.svg',
    luma: LOGO_BASE + 'luma.svg',
    meetup: LOGO_BASE + 'meetup.svg',
  };

  /** First tile — hub booking (not an external webhook provider). */
  var HUB_PROVIDER = {
    id: 'networker',
    label: 'The Networker UK',
    status: 'live',
    connectionStatus: 'active',
    docsHint:
      'Sell tickets here. Attendees, reviews, and round-ups are built in — no webhook to set up.',
    guidePath: '/organiser/booking-options',
  };

  function allProviders(data) {
    var remote = ((data && data.providers) || []).filter(function (p) {
      return p && p.id && p.id !== 'custom' && p.id !== 'networker';
    });
    return [HUB_PROVIDER].concat(remote);
  }

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

  function patchProviders(body) {
    return fetch('/api/organiser/connected-booking-providers', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.json().then(function (data) {
        return { ok: r.ok, body: data };
      });
    });
  }

  function firstOrganiserGroupId() {
    try {
      var sel = document.getElementById('org-eb-group');
      if (sel && sel.value) return String(sel.value).trim();
      var opt = sel && sel.options && sel.options[0];
      if (opt && opt.value) return String(opt.value).trim();
    } catch (_e) {
      /* ignore */
    }
    return '';
  }

  function setDetailStatus(msg, kind) {
    var el = detail && detail.querySelector('[data-cb-detail-status]');
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || '';
    el.className =
      'ee-hint cb-provider-detail-status' +
      (kind === 'error' ? ' ee-alert-warn' : kind === 'ok' ? ' ee-alert-ok' : '');
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
        patchProviders({ action: 'send_test_booking', eventId: eventId })
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
    if (p && p.id === 'networker') return '/organiser/booking-options';
    return '';
  }

  function oauthAvailable(data, p) {
    return Boolean(
      (data && data.eventbriteOAuth && data.eventbriteOAuth.available) ||
        (p && p.eventbriteOAuthAvailable)
    );
  }

  function renderHubConnect() {
    return (
      '<p class="ee-hint">Checkout stays on The Networker UK. Buyers book from your listing — attendees and reviews land here automatically.</p>' +
      '<ol class="cb-provider-steps">' +
      '<li>Create or open an <a href="/organiser/#groups">organiser page</a> if you need one.</li>' +
      '<li>Go to <a href="/organiser/#events-list">My events</a> → <strong>Create event</strong> (or open a draft).</li>' +
      '<li>Choose <strong>Set up tickets</strong> and sell on <strong>The Networker UK</strong>.</li>' +
      '<li>For paid tickets, connect payouts (Stripe) when prompted, then publish.</li>' +
      '</ol>' +
      '<div class="cb-provider-actions">' +
      '<a class="ee-btn ee-btn-gold ee-btn-sm" href="/organiser/#events-list">Go to My events →</a>' +
      '<a class="ee-btn ee-btn-outline ee-btn-sm" href="/organiser/group-edit">Add organiser page</a>' +
      '</div>'
    );
  }

  function renderEventbriteConnect(p, data) {
    var connected = Boolean(p.eventbriteApiTokenConfigured);
    var canOauth = oauthAvailable(data, p);
    var hasWebhook = Boolean(p.webhookUrl);
    var statusLine = connected
      ? '<p class="ee-hint ee-alert-ok">Eventbrite is connected on this account.</p>'
      : '<p class="ee-hint">Connect once here — then import live events from My events.</p>';

    var primaryBtn = connected
      ? '<a class="ee-btn ee-btn-gold ee-btn-sm" href="/organiser/#events-list">Import events on My events →</a>'
      : canOauth
        ? '<button type="button" class="ee-btn ee-btn-gold ee-btn-sm" data-cb-eb-oauth>Connect with Eventbrite</button>'
        : '';

    var enableBtn =
      !hasWebhook
        ? '<button type="button" class="ee-btn ee-btn-outline ee-btn-sm" data-enable-provider="eventbrite">Enable Eventbrite</button>'
        : '';
    var copyWebhookBtn = hasWebhook
      ? '<button type="button" class="ee-btn ee-btn-outline ee-btn-sm" data-copy-provider-webhook="' +
        esc(p.webhookUrl) +
        '">Copy webhook URL</button>'
      : '';

    var webhookBlock = hasWebhook
      ? '<div class="cb-provider-webhook-block">' +
        '<p class="ee-hint"><strong>Account webhook</strong> (once per Eventbrite account) — keep the <code>www</code>.</p>' +
        '<code class="cb-provider-webhook-url">' +
        esc(p.webhookUrl) +
        '</code>' +
        '<p class="ee-hint" style="margin-top:8px">Saving your private token usually registers this in Eventbrite for you. To check or paste by hand: Eventbrite → Account settings → <strong>Webhooks</strong> → Payload URL, action <code>order.placed</code>.</p>' +
        '<p class="ee-attendance-next">' +
        copyWebhookBtn +
        '</p>' +
        '</div>'
      : '<div class="cb-provider-webhook-block">' +
        '<p class="ee-hint">Press <strong>Enable Eventbrite</strong> to generate your account webhook URL here (same URL used on Connected setup).</p>' +
        (enableBtn ? '<p class="ee-attendance-next">' + enableBtn + '</p>' : '') +
        '</div>';

    var tokenBlock =
      '<details class="cb-provider-howto"' +
      (connected || canOauth ? '' : ' open') +
      '>' +
      '<summary>' +
      (connected ? 'Reconnect with a private token' : 'How to connect (private token)') +
      '</summary>' +
      '<div class="cb-provider-howto-body">' +
      '<ol class="cb-provider-steps">' +
      '<li>In Eventbrite, open your profile menu → <strong>Account Settings</strong>.</li>' +
      '<li>Open <strong>Developer Links</strong> → <strong>API Keys</strong>.</li>' +
      '<li><strong>Create API Key</strong> (or open an existing one) → <strong>Show API key, client secret and tokens</strong> → copy the <strong>Private token</strong>.</li>' +
      '<li>Paste it below and press <strong>Save &amp; connect</strong>.</li>' +
      '</ol>' +
      '<div class="cb-provider-token-row">' +
      '<label class="ee-field-label" for="cb-eb-token">Eventbrite private token</label>' +
      '<input class="ee-input" id="cb-eb-token" type="password" autocomplete="off" placeholder="Paste Private token from API Keys" />' +
      '<button type="button" class="ee-btn ee-btn-outline ee-btn-sm" data-cb-eb-save-token>Save &amp; connect</button>' +
      '</div>' +
      '<p class="ee-hint">Need pictures? Open the <a href="/guides/connect-eventbrite" target="_blank" rel="noopener noreferrer">full Eventbrite guide</a> (starts at step 1).</p>' +
      '</div>' +
      '</details>';

    var nextTitle = connected ? 'Import your events' : 'After you connect';
    var after =
      '<div class="cb-provider-after">' +
      '<h4 class="cb-provider-steps-title">' +
      nextTitle +
      '</h4>' +
      '<ol class="cb-provider-steps">' +
      '<li>Open <a href="/organiser/#events-list">My events</a>.</li>' +
      '<li>Expand <strong>Connect Eventbrite</strong> / <strong>Eventbrite events</strong>.</li>' +
      '<li>Choose an organiser page, then <strong>Import</strong> each live Eventbrite event.</li>' +
      '<li>Buyers sync automatically for attendees, reviews, and round-ups.</li>' +
      '</ol>' +
      '</div>';

    // Connected: webhook + import CTA first; keep reconnect collapsed at the bottom.
    if (connected) {
      return (
        statusLine +
        webhookBlock +
        '<div class="cb-provider-actions">' +
        primaryBtn +
        '</div>' +
        after +
        tokenBlock
      );
    }

    return (
      statusLine +
      (primaryBtn ? '<div class="cb-provider-actions">' + primaryBtn + '</div>' : '') +
      tokenBlock +
      webhookBlock +
      after
    );
  }

  function renderOwnSiteConnect(p) {
    var live = String(p.status || '').toLowerCase() === 'live';
    var enabled = p.connectionStatus === 'active' || Boolean(p.webhookUrl);
    var enableBtn =
      live && !enabled
        ? '<button type="button" class="ee-btn ee-btn-gold ee-btn-sm" data-enable-provider="own_site">Enable connection</button>'
        : '';
    var copyBtn =
      p.webhookUrl
        ? '<button type="button" class="ee-btn ee-btn-outline ee-btn-sm" data-copy-provider-webhook="' +
          esc(p.webhookUrl) +
          '">Copy webhook URL</button>'
        : '';
    var testBtn =
      p.webhookUrl
        ? '<button type="button" class="ee-btn ee-btn-outline ee-btn-sm" data-send-test-booking="own_site">Send test booking</button>'
        : '';

    var webhookBlock = p.webhookUrl
      ? '<div class="cb-provider-webhook-block">' +
        '<p class="ee-hint"><strong>Your webhook URL</strong> — keep the <code>www</code> in the address.</p>' +
        '<code class="cb-provider-webhook-url">' +
        esc(p.webhookUrl) +
        '</code>' +
        '</div>'
      : '<p class="ee-hint">Press <strong>Enable connection</strong> to generate your webhook URL.</p>';

    var steps =
      '<ol class="cb-provider-steps">' +
      '<li>Enable the connection below and copy your webhook URL.</li>' +
      '<li>On each Networker UK event, set the <strong>booking URL</strong> (your checkout page) and publish.</li>' +
      '<li>After each sale on your site, POST JSON to the webhook with <code>eventId</code>, <code>orderId</code>, and <code>email</code>.</li>' +
      '<li>Optional fields: <code>name</code>, <code>company</code>, <code>jobTitle</code>, <code>quantity</code>, <code>amountPaid</code>, <code>status</code>.</li>' +
      '<li>Use your checkout server, Zapier, or Make — then check Recent sync attempts for <code>own_site:accepted</code>.</li>' +
      '</ol>';

    var sample =
      '<pre class="cb-provider-sample">{&#10;  "eventId": "your-networker-uk-event-uuid",&#10;  "orderId": "order-123",&#10;  "email": "buyer@example.com",&#10;  "name": "Alex Buyer"&#10;}</pre>';

    return (
      '<p class="ee-hint">Checkout stays on your website. After each sale, send us a short message so buyers appear on your attendee list.</p>' +
      steps +
      webhookBlock +
      '<p class="ee-attendance-next">' +
      [enableBtn, copyBtn, testBtn].filter(Boolean).join(' ') +
      '</p>' +
      '<h4 class="cb-provider-steps-title">Example payload</h4>' +
      sample
    );
  }

  function renderSoonConnect(p) {
    return (
      '<p class="ee-hint">This connection is not selectable yet. We will unlock it here when it is ready — same place you connect Eventbrite and your website today.</p>' +
      '<ol class="cb-provider-steps">' +
      '<li>Tap this tile again later when the status shows <strong>Live</strong>.</li>' +
      '<li>You will connect once, then link each event.</li>' +
      '</ol>'
    );
  }

  function renderDetail(p, data) {
    if (!detail) return;
    if (!p) {
      detail.hidden = true;
      detail.innerHTML = '';
      return;
    }
    var live = String(p.status || '').toLowerCase() === 'live';
    var isHub = p.id === 'networker';
    var guideHref = providerGuideHref(p);
    var statusLabel = isHub
      ? 'Easiest'
      : live
        ? p.connectionStatus === 'active' || p.eventbriteApiTokenConfigured
          ? 'Connected'
          : 'Live'
        : 'Coming soon';

    var bodyHtml = '';
    if (isHub) bodyHtml = renderHubConnect();
    else if (p.id === 'eventbrite' && live) bodyHtml = renderEventbriteConnect(p, data);
    else if (p.id === 'own_site' && live) bodyHtml = renderOwnSiteConnect(p);
    else bodyHtml = renderSoonConnect(p);

    var guideLabel = isHub ? 'How booking options work' : 'Open full guide';
    var guideBtn = guideHref
      ? '<a class="ee-btn ee-btn-outline ee-btn-sm" href="' +
        esc(guideHref) +
        '"' +
        (isHub ? '' : ' target="_blank" rel="noopener noreferrer"') +
        '>' +
        esc(guideLabel) +
        '</a>'
      : '';

    var titleText = isHub
      ? 'Sell tickets on The Networker UK'
      : 'Connect ' + (p.label || PROVIDER_LABELS[p.id] || p.id);
    var logoClass =
      'cb-provider-detail-logo' + (isHub ? ' cb-provider-detail-logo--hub' : '');

    detail.hidden = false;
    detail.innerHTML =
      '<div class="cb-provider-detail-inner">' +
      '<p class="ee-booking-help-kicker">Step 2</p>' +
      '<div class="cb-provider-detail-head">' +
      '<img class="' +
      logoClass +
      '" src="' +
      esc(PROVIDER_LOGOS[p.id] || '') +
      '" alt="" width="36" height="36" />' +
      '<h3 class="cb-provider-detail-title">' +
      esc(titleText) +
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
      '<p class="ee-hint cb-provider-detail-status" data-cb-detail-status hidden role="status"></p>' +
      bodyHtml +
      (guideBtn ? '<div class="cb-provider-actions">' + guideBtn + '</div>' : '') +
      '</div>';

    bindCopyWebhookButtons(detail);
    bindSendTestBookingButtons(detail, (data && data.eventLinks) || []);
    bindDetailActions(p, data);

    // Token-connected Eventbrite with no webhook URL yet — generate it so the panel always shows /w/eb/…
    if (
      p.id === 'eventbrite' &&
      p.eventbriteApiTokenConfigured &&
      !p.webhookUrl &&
      !detail.getAttribute('data-cb-eb-webhook-heal')
    ) {
      detail.setAttribute('data-cb-eb-webhook-heal', '1');
      setDetailStatus('Generating your account webhook…');
      patchProviders({ action: 'enable_provider', provider: 'eventbrite' })
        .then(function (res) {
          if (!res.ok) {
            setDetailStatus(
              res.body.message ||
                res.body.error ||
                'Could not generate webhook URL. Press Enable Eventbrite.',
              'error'
            );
            detail.removeAttribute('data-cb-eb-webhook-heal');
            return;
          }
          loadProviders();
        })
        .catch(function () {
          setDetailStatus('Could not generate webhook URL. Press Enable Eventbrite.', 'error');
          detail.removeAttribute('data-cb-eb-webhook-heal');
        });
    }
  }

  function bindDetailActions(p, data) {
    if (!detail) return;
    detail.querySelectorAll('[data-enable-provider]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var provider = btn.getAttribute('data-enable-provider');
        btn.disabled = true;
        setDetailStatus('Enabling…');
        patchProviders({ action: 'enable_provider', provider: provider })
          .then(function (res) {
            btn.disabled = false;
            if (!res.ok) {
              setDetailStatus(res.body.message || res.body.error || 'Could not enable provider.', 'error');
              return;
            }
            loadProviders();
          })
          .catch(function () {
            btn.disabled = false;
            setDetailStatus('Could not enable provider.', 'error');
          });
      });
    });

    var oauthBtn = detail.querySelector('[data-cb-eb-oauth]');
    if (oauthBtn) {
      oauthBtn.addEventListener('click', function () {
        oauthBtn.disabled = true;
        setDetailStatus('Opening Eventbrite…');
        patchProviders({
          action: 'start_eventbrite_oauth',
          groupId: firstOrganiserGroupId() || undefined,
          returnPath: '/organiser/#connected-booking',
        })
          .then(function (res) {
            oauthBtn.disabled = false;
            if (!res.ok) {
              setDetailStatus(
                res.body.message ||
                  res.body.error ||
                  'OAuth unavailable — paste a private token below.',
                'error'
              );
              var tokenInput = document.getElementById('cb-eb-token');
              if (tokenInput && tokenInput.focus) {
                try {
                  tokenInput.focus();
                } catch (_e) {
                  /* ignore */
                }
              }
              return;
            }
            if (res.body.authorizeUrl) {
              window.location.href = res.body.authorizeUrl;
              return;
            }
            setDetailStatus('Could not start Eventbrite connect.', 'error');
          })
          .catch(function () {
            oauthBtn.disabled = false;
            setDetailStatus('Could not start Eventbrite connect.', 'error');
          });
      });
    }

    var saveTokenBtn = detail.querySelector('[data-cb-eb-save-token]');
    if (saveTokenBtn) {
      saveTokenBtn.addEventListener('click', function () {
        var input = document.getElementById('cb-eb-token');
        var token = input ? String(input.value || '').trim() : '';
        if (!token) {
          setDetailStatus('Paste your Eventbrite private token first.', 'error');
          return;
        }
        saveTokenBtn.disabled = true;
        setDetailStatus('Connecting…');
        patchProviders({
          action: 'save_eventbrite_private_token',
          token: token,
          groupId: firstOrganiserGroupId() || undefined,
        })
          .then(function (res) {
            saveTokenBtn.disabled = false;
            if (!res.ok) {
              setDetailStatus(res.body.message || res.body.error || 'Could not save token.', 'error');
              return;
            }
            var wh = res.body && res.body.webhookUrl ? String(res.body.webhookUrl) : '';
            setDetailStatus(
              wh
                ? 'Connected. Your account webhook is on this panel — copy it if Eventbrite Webhooks is empty.'
                : 'Connected. You can import events from My events.',
              'ok'
            );
            if (input) input.value = '';
            loadProviders();
            if (typeof window.refreshOrganiserConnectedBooking === 'function') {
              window.refreshOrganiserConnectedBooking({ silent: true });
            }
          })
          .catch(function () {
            saveTokenBtn.disabled = false;
            setDetailStatus('Could not save token.', 'error');
          });
      });
    }
  }

  function selectProvider(id) {
    selectedId = String(id || '');
    list.querySelectorAll('.cb-provider-tile').forEach(function (btn) {
      var on = btn.getAttribute('data-provider-id') === selectedId;
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var providers = allProviders(lastProvidersData);
    var match = providers.filter(function (p) {
      return p && p.id === selectedId;
    })[0];
    renderDetail(match, lastProvidersData);
    if (match && detail && detail.scrollIntoView) {
      try {
        detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (_e) {
        /* ignore */
      }
    }
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
    allProviders(data).forEach(function (p) {
      if (!p) return;
      var live = String(p.status || '').toLowerCase() === 'live';
      var isHub = p.id === 'networker';
      var logo = PROVIDER_LOGOS[p.id] || '';
      var li = document.createElement('li');
      li.className = 'cb-provider-tile-wrap';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'cb-provider-tile' +
        (live ? '' : ' is-soon') +
        (isHub ? ' cb-provider-tile--hub' : '') +
        (selectedId === p.id ? ' is-selected' : '');
      btn.setAttribute('data-provider-id', p.id);
      btn.setAttribute('aria-pressed', selectedId === p.id ? 'true' : 'false');
      btn.innerHTML =
        '<span class="cb-provider-tile-logo-wrap' +
        (isHub ? ' cb-provider-tile-logo-wrap--hub' : '') +
        '" aria-hidden="true">' +
        (logo
          ? '<img class="cb-provider-tile-logo' +
            (isHub ? ' cb-provider-tile-logo--hub' : '') +
            '" src="' +
            esc(logo) +
            '" alt="" width="44" height="44" loading="lazy" />'
          : '') +
        '</span>' +
        '<span class="cb-provider-tile-label">' +
        esc(PROVIDER_LABELS[p.id] || p.label || p.id) +
        '</span>' +
        '<span class="cb-provider-tile-status">' +
        (isHub ? 'Us' : live ? 'Live' : 'Soon') +
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

  function fallbackProvidersData() {
    return {
      ok: true,
      providers: [
        {
          id: 'eventbrite',
          label: 'Eventbrite',
          status: 'live',
          connectionStatus: 'not_configured',
          docsHint:
            'Connect Eventbrite here (OAuth or private token). Then import live events from My events.',
          guidePath: '/guides/connect-eventbrite',
        },
        {
          id: 'ticket_tailor',
          label: 'Ticket Tailor',
          status: 'beta',
          docsHint: 'Coming soon — Ticket Tailor will connect from this page the same way as Eventbrite.',
        },
        {
          id: 'trybooking',
          label: 'TryBooking',
          status: 'beta',
          docsHint: 'Coming soon — connect TryBooking from this page when the tile unlocks.',
        },
        {
          id: 'own_site',
          label: 'Your own website',
          status: 'live',
          connectionStatus: 'not_configured',
          docsHint:
            'WordPress, Wix, or custom checkout — enable here, copy your webhook URL, and POST each booking.',
          guidePath: '/guides/connect-own-website',
        },
        {
          id: 'luma',
          label: 'Luma',
          status: 'beta',
          docsHint: 'Coming soon — Luma will connect from this page when ready.',
        },
        {
          id: 'meetup',
          label: 'Meetup',
          status: 'beta',
          docsHint: 'Coming soon — Meetup will connect from this page when ready.',
        },
      ],
    };
  }

  function loadProviders() {
    fetch('/api/organiser/connected-booking-providers', { credentials: 'include', cache: 'no-store' })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data && data.ok) renderProviders(data);
        else renderProviders(fallbackProvidersData());
        var eventbrite = ((data && data.providers) || []).filter(function (p) {
          return p && p.id === 'eventbrite' && p.eventbriteApiTokenConfigured;
        })[0];
        if (!eventbrite) return;
        patchProviders({ action: 'sync_eventbrite_attendees' }).catch(function () {});
      })
      .catch(function () {
        renderProviders(fallbackProvidersData());
      });
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
      patchProviders({
        action: 'link_event',
        eventId: eventId,
        provider: provider,
        externalEventId: externalEventId,
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

  // Open Eventbrite panel when returning from OAuth to this page
  try {
    var params = new URLSearchParams(window.location.search);
    var ebOauth = String(params.get('eb_oauth') || '').trim();
    if (ebOauth) {
      selectedId = 'eventbrite';
    }
  } catch (_eOauth) {
    /* ignore */
  }

  window.addEventListener('hub-organiser-connected-booking', function () {
    loadProviders();
  });

  loadProviders();
})();
