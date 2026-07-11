/**
 * Guides page — compact Hubert + collapsible step lists.
 */
(function () {
  var hubertCard = document.getElementById('guides-hubert-card');

  function initStepToggles() {
    document.querySelectorAll('.guide-steps-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var panelId = btn.getAttribute('aria-controls');
        var panel = panelId ? document.getElementById(panelId) : null;
        if (!panel) return;
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        btn.textContent = open ? 'View steps' : 'Hide steps';
        panel.hidden = open;
        btn.closest('.guide-checklist-item').classList.toggle('is-steps-open', !open);
      });
    });
  }

  function initHubert() {
    if (!window.HubertChat) return;

    var messagesEl = document.getElementById('guides-hubert-messages');
    var formEl = document.getElementById('guides-hubert-form');
    var inputEl = document.getElementById('guides-hubert-input');
    var resetBtn = document.getElementById('guides-hubert-reset');

    if (!messagesEl || !formEl || !inputEl) return;

    var chat = new window.HubertChat({
      messagesEl: messagesEl,
      formEl: formEl,
      inputEl: inputEl,
      sendBtn: document.getElementById('guides-hubert-send'),
      resetBtn: resetBtn,
      suggestionsEl: null,
      bubblePrefix: 'guides-hubert-bubble',
      hubertContext: 'guides',
      greeting: '',
    });

    chat.showGreeting = function () {};
    messagesEl.hidden = true;

    function markChatActive() {
      if (hubertCard) hubertCard.classList.add('is-chat-active');
      messagesEl.hidden = false;
    }

    formEl.addEventListener('submit', markChatActive);

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (hubertCard) hubertCard.classList.remove('is-chat-active');
        messagesEl.hidden = true;
      });
    }

    return chat;
  }

  function init() {
    initStepToggles();
    initHubert();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
