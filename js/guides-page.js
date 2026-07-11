/**
 * Guides page — inline Hubert for organiser questions.
 */
(function () {
  var hubertCard = document.getElementById('guides-hubert-card');

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHubert);
  } else {
    initHubert();
  }
})();
