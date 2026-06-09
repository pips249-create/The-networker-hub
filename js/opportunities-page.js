/**
 * Opportunities — filter, search, and submit form interactions.
 */
(function () {
  var activeFilter = 'all';
  var searchQ = '';

  function filterOpp(el, type) {
    document.querySelectorAll('.opp-filter-btn').forEach(function (b) {
      b.classList.remove('active');
    });
    el.classList.add('active');
    activeFilter = type;
    applyFilters();
  }

  function searchOpp(val) {
    searchQ = val.toLowerCase();
    applyFilters();
  }

  function applyFilters() {
    var cards = document.querySelectorAll('.opp-card');
    var shown = 0;
    cards.forEach(function (card) {
      var tags = card.dataset.tags || '';
      var type = card.dataset.type || '';
      var match =
        (activeFilter === 'all' || type === activeFilter || tags.includes(activeFilter)) &&
        (!searchQ || card.innerText.toLowerCase().includes(searchQ));
      card.style.display = match ? '' : 'none';
      if (match) shown++;
    });
    var noResults = document.getElementById('opp-no-results');
    if (noResults) {
      noResults.style.display = shown === 0 ? 'block' : 'none';
    }
  }

  function resetFilters() {
    activeFilter = 'all';
    searchQ = '';
    var firstBtn = document.querySelector('.opp-filter-btn');
    if (firstBtn) firstBtn.click();
    var searchInput = document.querySelector('.opp-search-box input');
    if (searchInput) searchInput.value = '';
  }

  function submitForm(btn) {
    btn.textContent = "✓ Submitted — we'll be in touch within 24 hours";
    btn.style.background = '#166534';
    btn.style.color = '#fff';
    btn.disabled = true;
  }

  window.filterOpp = filterOpp;
  window.searchOpp = searchOpp;
  window.resetFilters = resetFilters;
  window.submitForm = submitForm;

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();
