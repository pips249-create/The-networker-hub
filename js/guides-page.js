/**
 * Guides page — inline Hubert + category filter tabs.
 */
(function () {
  var hubertCard = document.getElementById('guides-hubert-card');

  function initCategoryFilter() {
    var tabs = document.querySelectorAll('.guides-category-tab');
    var items = document.querySelectorAll('#guides-grid > li[data-category]');
    if (!tabs.length || !items.length) return;

    function setCategory(category) {
      tabs.forEach(function (tab) {
        var isActive = tab.getAttribute('data-category') === category;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      items.forEach(function (item) {
        var categories = (item.getAttribute('data-category') || '').split(/\s+/);
        var show = category === 'all' || categories.indexOf(category) !== -1;
        item.hidden = !show;
      });
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        setCategory(tab.getAttribute('data-category') || 'all');
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
    initCategoryFilter();
    initHubert();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
