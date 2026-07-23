/**
 * Hubert — floating chat widget on public site pages and organiser dashboard.
 */
(function () {
  var script = document.currentScript;
  var root = (script && script.getAttribute('data-root')) || '';
  var organiserDashMode = script && script.getAttribute('data-hubert') === 'organiser-dashboard';

  function href(path) {
    return root + path;
  }

  function isOrganiserDashboard() {
    var path = (window.location.pathname || '').toLowerCase();
    return /\/organiser\/?$/.test(path) || /\/organiser\/index\.html$/.test(path);
  }

  function publicPageContext() {
    var path = (window.location.pathname || '').toLowerCase();
    if (/\/opportunities\/?/.test(path)) return 'opportunities';
    return '';
  }

  function shouldSkip() {
    if (script && script.getAttribute('data-hubert') === 'off') return true;
    var path = (window.location.pathname || '').toLowerCase();
    if (/\/contact\.html$/.test(path) || /\/contact\/?$/.test(path)) return true;
    if (/\/faq\.html$/.test(path) || /\/faq\/?$/.test(path)) return true;
    if (/\/admin\//.test(path)) return true;
    if (/\/organiser\//.test(path)) return true;
    return false;
  }

  if (organiserDashMode) {
    if (!isOrganiserDashboard() || !window.HubertChat) return;
  } else if (shouldSkip() || !window.HubertChat) {
    return;
  }

  var guide = window.HubertOrganiserGuide;
  var greeting =
    organiserDashMode && guide && guide.DASHBOARD_GREETING
      ? guide.DASHBOARD_GREETING
      : window.HubertChatGreeting;
  var suggestions =
    organiserDashMode && guide && guide.DASHBOARD_SUGGESTIONS
      ? guide.DASHBOARD_SUGGESTIONS
      : window.HubertChatSuggestions;
  var panelSub = organiserDashMode
    ? 'Got any questions? Ask me anything.'
    : publicPageContext() === 'opportunities'
      ? 'At your service — find franchises, partnerships &amp; deals'
      : 'Your British English gentleman &amp; concierge';
  var inputPlaceholder = organiserDashMode
    ? 'Ask about groups, events, tickets, or payouts…'
    : publicPageContext() === 'opportunities'
      ? 'Ask Hubert to find franchises, side hustles, or partnerships…'
      : 'Ask Hubert to find events, opportunities, or guide you…';
  var widgetGreeting =
    publicPageContext() === 'opportunities'
      ? "Good afternoon. I'm Hubert — allow me to help you explore business opportunities on the hub. Ask about franchises, side hustles, or partnerships, or tap a suggestion below."
      : greeting;

  var mount = document.createElement('div');
  mount.id = 'hubert-widget';
  mount.className = 'hubert-widget' + (organiserDashMode ? ' hubert-widget--organiser' : '');
  mount.innerHTML =
    '<button type="button" class="hubert-launcher" id="hubert-launcher" aria-label="Chat with Hubert" aria-expanded="false" aria-controls="hubert-panel">' +
    '<img class="hubert-launcher-icon" src="' +
    href('assets/hubert-icon.png') +
    '" alt="" width="72" height="72">' +
    '<span class="hubert-launcher-label">Hubert</span>' +
    '</button>' +
    '<div class="hubert-panel" id="hubert-panel" role="dialog" aria-labelledby="hubert-panel-title" hidden>' +
    '<header class="hubert-panel-head">' +
    '<div class="hubert-panel-brand">' +
    '<img class="hubert-panel-avatar" src="' +
    href('assets/hubert-icon.png') +
    '" alt="" width="40" height="40">' +
    '<div>' +
    '<h2 class="hubert-panel-title" id="hubert-panel-title">Hubert</h2>' +
    '<p class="hubert-panel-sub">' +
    panelSub +
    '</p>' +
    '</div>' +
    '</div>' +
    '<div class="hubert-panel-actions">' +
    '<button type="button" class="hubert-panel-reset" id="hubert-reset" hidden>New chat</button>' +
    '<button type="button" class="hubert-panel-close" id="hubert-close" aria-label="Close chat">×</button>' +
    '</div>' +
    '</header>' +
    '<div class="hubert-messages" id="hubert-messages" role="log" aria-live="polite" aria-relevant="additions"></div>' +
    '<div class="hubert-suggestions" id="hubert-suggestions" aria-label="Suggested questions"></div>' +
    '<form class="hubert-form" id="hubert-form">' +
    '<div class="hubert-form-compose">' +
    '<label class="visually-hidden" for="hubert-input">Your message</label>' +
    '<textarea id="hubert-input" rows="2" placeholder="' +
    inputPlaceholder +
    '" maxlength="2000" required></textarea>' +
    '<button type="submit" class="btn btn-primary" id="hubert-send">Send</button>' +
    '</div>' +
    '</form>' +
    '</div>';

  document.body.appendChild(mount);

  var launcher = document.getElementById('hubert-launcher');
  var panel = document.getElementById('hubert-panel');
  var closeBtn = document.getElementById('hubert-close');
  var suggestionsEl = document.getElementById('hubert-suggestions');

  window.HubertChatRenderSuggestions(suggestionsEl, suggestions);

  var chat = new window.HubertChat({
    messagesEl: document.getElementById('hubert-messages'),
    formEl: document.getElementById('hubert-form'),
    inputEl: document.getElementById('hubert-input'),
    sendBtn: document.getElementById('hubert-send'),
    resetBtn: document.getElementById('hubert-reset'),
    suggestionsEl: suggestionsEl,
    greeting: widgetGreeting,
    hubertContext: organiserDashMode ? 'organiser-dashboard' : publicPageContext(),
    bubblePrefix: 'hubert-bubble',
  });

  function openPanel() {
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    mount.classList.add('hubert-widget--open');
    chat.inputEl.focus();
  }

  function closePanel() {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    mount.classList.remove('hubert-widget--open');
  }

  launcher.addEventListener('click', function () {
    if (panel.hidden) openPanel();
    else closePanel();
  });

  closeBtn.addEventListener('click', closePanel);

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !panel.hidden) closePanel();
  });

  window.HubertWidget = {
    open: openPanel,
    close: closePanel,
    ask: function (prompt) {
      var text = String(prompt || '').trim();
      if (!text) return;
      openPanel();
      chat.sendMessage(text);
    },
  };
})();
