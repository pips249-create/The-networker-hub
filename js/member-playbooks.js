/**
 * Member zone playbooks — click-through slide decks.
 */
(function () {
  var root = null;
  var decks = {};
  var activeId = '';
  var reduceMotion = false;

  function $(sel, el) {
    return (el || document).querySelector(sel);
  }

  function $all(sel, el) {
    return Array.prototype.slice.call((el || document).querySelectorAll(sel));
  }

  function hashPlaybook() {
    var hash = String(location.hash || '').replace(/^#/, '').toLowerCase();
    if (hash === 'marketing' || hash === 'numbers' || hash === 'funding') return hash;
    return '';
  }

  function setHash(id) {
    if (!id) return;
    if (location.hash.replace(/^#/, '') === id) return;
    history.replaceState(null, '', '#' + id);
  }

  function updateChrome(deck) {
    if (!deck) return;
    var label = $('.mp-pager-label', deck.el);
    var dots = $all('.mp-dot', deck.el);
    var prev = $('.mp-nav-prev', deck.el);
    var next = $('.mp-nav-next', deck.el);
    if (label) label.textContent = deck.index + 1 + ' / ' + deck.slides.length;
    dots.forEach(function (dot, i) {
      dot.classList.toggle('is-active', i === deck.index);
      dot.setAttribute('aria-current', i === deck.index ? 'true' : 'false');
    });
    if (prev) prev.disabled = deck.index <= 0;
    if (next) next.disabled = deck.index >= deck.slides.length - 1;
    deck.slides.forEach(function (slide, i) {
      var on = i === deck.index;
      slide.classList.toggle('is-active', on);
      slide.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
  }

  function goTo(deckId, index) {
    var deck = decks[deckId];
    if (!deck) return;
    var next = Math.max(0, Math.min(deck.slides.length - 1, index));
    deck.index = next;
    updateChrome(deck);
  }

  function showDeck(id) {
    if (!decks[id]) id = Object.keys(decks)[0] || '';
    if (!id) return;
    activeId = id;
    Object.keys(decks).forEach(function (key) {
      var deck = decks[key];
      var on = key === id;
      deck.el.hidden = !on;
      if (on && deck.index == null) deck.index = 0;
      if (on) updateChrome(deck);
    });
    $all('.mp-tab', root).forEach(function (tab) {
      var on = tab.getAttribute('data-mp-deck') === id;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    setHash(id);
  }

  function bindDeck(deck) {
    var prev = $('.mp-nav-prev', deck.el);
    var next = $('.mp-nav-next', deck.el);
    if (prev) {
      prev.addEventListener('click', function (e) {
        e.preventDefault();
        goTo(deck.id, deck.index - 1);
      });
    }
    if (next) {
      next.addEventListener('click', function (e) {
        e.preventDefault();
        goTo(deck.id, deck.index + 1);
      });
    }
    $all('.mp-dot', deck.el).forEach(function (dot) {
      dot.addEventListener('click', function (e) {
        e.preventDefault();
        var i = Number(dot.getAttribute('data-mp-dot'));
        if (!Number.isNaN(i)) goTo(deck.id, i);
      });
    });
  }

  function init() {
    root = document.getElementById('mp-root');
    if (!root) return;
    reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    $all('.mp-deck', root).forEach(function (el) {
      var id = el.getAttribute('data-mp-deck');
      if (!id) return;
      var slides = $all('.mp-slide', el);
      decks[id] = { id: id, el: el, slides: slides, index: 0 };
      bindDeck(decks[id]);
      updateChrome(decks[id]);
    });

    $all('.mp-tab', root).forEach(function (tab) {
      tab.addEventListener('click', function () {
        showDeck(tab.getAttribute('data-mp-deck'));
        goTo(activeId, 0);
      });
    });

    root.addEventListener('keydown', function (event) {
      if (!activeId || !decks[activeId]) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(activeId, decks[activeId].index + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(activeId, decks[activeId].index - 1);
      }
    });

    window.addEventListener('hashchange', function () {
      var id = hashPlaybook();
      if (id) {
        showDeck(id);
        goTo(id, 0);
      }
    });

    showDeck(hashPlaybook() || 'marketing');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
