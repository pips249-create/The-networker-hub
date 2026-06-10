/**
 * Hubert — floating chat widget on public site pages.
 */
(function () {
  var script = document.currentScript;
  var root = (script && script.getAttribute('data-root')) || '';

  function href(path) {
    return root + path;
  }

  function shouldSkip() {
    if (script && script.getAttribute('data-hubert') === 'off') return true;
    var path = (window.location.pathname || '').toLowerCase();
    if (/\/contact\.html$/.test(path) || /\/contact\/?$/.test(path)) return true;
    if (/\/admin\//.test(path)) return true;
    if (/\/organiser\//.test(path)) return true;
    return false;
  }

  if (shouldSkip() || !window.HubertChat) return;

  var mount = document.createElement('div');
  mount.id = 'hubert-widget';
  mount.className = 'hubert-widget';
  mount.innerHTML =
    '<button type="button" class="hubert-launcher" id="hubert-launcher" aria-label="Chat with Hubert" aria-expanded="false" aria-controls="hubert-panel">' +
    '<img class="hubert-launcher-icon" src="' +
    href('assets/hubert-icon.png') +
    '" alt="" width="56" height="56">' +
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
    '<p class="hubert-panel-sub">Your business butler &amp; concierge</p>' +
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
    '<textarea id="hubert-input" rows="2" placeholder="Ask Hubert to find events, opportunities, or guide you…" maxlength="2000" required></textarea>' +
    '<button type="submit" class="btn btn-primary" id="hubert-send">Send</button>' +
    '</div>' +
    '</form>' +
    '</div>';

  document.body.appendChild(mount);

  var launcher = document.getElementById('hubert-launcher');
  var panel = document.getElementById('hubert-panel');
  var closeBtn = document.getElementById('hubert-close');
  var suggestionsEl = document.getElementById('hubert-suggestions');

  window.HubertChatRenderSuggestions(suggestionsEl, window.HubertChatSuggestions);

  var chat = new window.HubertChat({
    messagesEl: document.getElementById('hubert-messages'),
    formEl: document.getElementById('hubert-form'),
    inputEl: document.getElementById('hubert-input'),
    sendBtn: document.getElementById('hubert-send'),
    resetBtn: document.getElementById('hubert-reset'),
    suggestionsEl: suggestionsEl,
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
})();
