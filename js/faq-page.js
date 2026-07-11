/**
 * FAQ page — instant search, category tabs, inline Hubert.
 */
(function () {
  var searchInput = document.getElementById('faq-search');
  var searchMeta = document.getElementById('faq-search-meta');
  var searchCount = document.getElementById('faq-search-count');
  var emptyEl = document.getElementById('faq-empty');
  var categoryNav = document.getElementById('faq-categories');
  var panelsEl = document.getElementById('faq-panels');
  var hubertCard = document.querySelector('.faq-hubert-card');

  var activeCategory = 'all';
  var items = [];
  var blocks = [];

  function initFaqLists() {
    if (!panelsEl) return;
    items = Array.prototype.slice.call(panelsEl.querySelectorAll('.faq-list-item'));
    blocks = Array.prototype.slice.call(panelsEl.querySelectorAll('.faq-category-block'));
  }

  function normaliseQuery(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function itemMatchesQuery(item, query) {
    if (!query) return true;
    var haystack = item.getAttribute('data-search') || item.textContent || '';
    return haystack.toLowerCase().indexOf(query) !== -1;
  }

  function itemMatchesCategory(item, category) {
    if (category === 'all') return true;
    return item.getAttribute('data-category') === category;
  }

  function updateCategoryBlocks() {
    var query = normaliseQuery(searchInput && searchInput.value);
    var searchAllCategories = !!query;

    blocks.forEach(function (block) {
      var blockCategory = block.getAttribute('data-category-block');
      var visibleInBlock = block.querySelectorAll('.faq-list-item:not(.is-hidden)').length;
      var showBlock = searchAllCategories
        ? visibleInBlock > 0
        : activeCategory === 'all'
          ? visibleInBlock > 0
          : blockCategory === activeCategory && visibleInBlock > 0;
      block.classList.toggle('is-hidden', !showBlock);
    });
  }

  function applyFilters() {
    var query = normaliseQuery(searchInput && searchInput.value);
    var visibleCount = 0;
    var searchAllCategories = !!query;

    items.forEach(function (item) {
      var matchesCategory = searchAllCategories || itemMatchesCategory(item, activeCategory);
      var matches = itemMatchesQuery(item, query) && matchesCategory;
      item.classList.toggle('is-hidden', !matches);
      item.classList.toggle('is-match', !!query && matches);
      if (matches) visibleCount += 1;
    });

    updateCategoryBlocks();

    if (emptyEl) emptyEl.hidden = visibleCount > 0;
    if (searchMeta && searchCount) {
      if (query) {
        searchCount.textContent = String(visibleCount);
        searchMeta.hidden = false;
      } else {
        searchMeta.hidden = true;
      }
    }
  }

  function setActiveCategory(category) {
    activeCategory = category || 'all';
    if (!categoryNav) return;

    var tabs = categoryNav.querySelectorAll('.faq-category-tab');
    tabs.forEach(function (tab) {
      var isActive = tab.getAttribute('data-category') === activeCategory;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    applyFilters();
  }

  function initCategoryTabs() {
    if (!categoryNav) return;

    categoryNav.addEventListener('click', function (e) {
      var tab = e.target.closest('.faq-category-tab');
      if (!tab) return;
      setActiveCategory(tab.getAttribute('data-category'));
    });
  }

  function initSearch() {
    if (!searchInput) return;

    searchInput.addEventListener('input', applyFilters);
    searchInput.addEventListener('search', applyFilters);
  }

  function initHubert() {
    if (!window.HubertChat) return;

    var messagesEl = document.getElementById('faq-hubert-messages');
    var formEl = document.getElementById('faq-hubert-form');
    var inputEl = document.getElementById('faq-hubert-input');
    var resetBtn = document.getElementById('faq-hubert-reset');
    var suggestionsEl = document.getElementById('faq-hubert-suggestions');

    if (!messagesEl || !formEl || !inputEl) return;

    if (window.HubertChatRenderSuggestions) {
      window.HubertChatRenderSuggestions(suggestionsEl, [
        { label: 'Organiser payouts', prompt: 'When do organisers receive payouts?' },
        { label: 'Reset password', prompt: 'I forgot my password — how do I sign in?' },
        { label: 'Transfer a ticket', prompt: 'Can I transfer my ticket to someone else?' },
      ]);
    }

    var chat = new window.HubertChat({
      messagesEl: messagesEl,
      formEl: formEl,
      inputEl: inputEl,
      sendBtn: document.getElementById('faq-hubert-send'),
      resetBtn: resetBtn,
      suggestionsEl: suggestionsEl,
      bubblePrefix: 'faq-hubert-bubble',
      greeting:
        "Hello — I'm Hubert. Ask me about accounts, tickets, refunds, or organiser tools and I'll point you in the right direction.",
    });

    function markChatActive() {
      if (hubertCard) hubertCard.classList.add('is-chat-active');
    }

    formEl.addEventListener('submit', markChatActive);

    if (suggestionsEl) {
      suggestionsEl.addEventListener('click', function () {
        markChatActive();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (hubertCard) hubertCard.classList.remove('is-chat-active');
      });
    }
  }

  initFaqLists();
  initCategoryTabs();
  initSearch();
  initHubert();
  applyFilters();
})();
