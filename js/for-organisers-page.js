/**
 * For organisers page: scroll reveals and interactive dashboard preview.
 */
(function () {
  function initReveal() {
    var sections = document.querySelectorAll('.fo-reveal:not(.is-visible)');
    if (!sections.length) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sections.forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    if (!('IntersectionObserver' in window)) {
      sections.forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );

    sections.forEach(function (el) {
      observer.observe(el);
    });
  }

  function initDashPreview() {
    var mock = document.getElementById('fo-dash-mock');
    if (!mock) return;

    var tabs = mock.querySelectorAll('[role="tab"][data-fo-panel]');
    var panels = mock.querySelectorAll('[data-fo-panel-view]');
    if (!tabs.length || !panels.length) return;

    function activate(panelId, focusTab) {
      tabs.forEach(function (tab) {
        var selected = tab.getAttribute('data-fo-panel') === panelId;
        tab.classList.toggle('is-active', selected);
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        tab.tabIndex = selected ? 0 : -1;
        if (selected && focusTab) tab.focus();
      });

      panels.forEach(function (panel) {
        var match = panel.getAttribute('data-fo-panel-view') === panelId;
        panel.classList.toggle('is-active', match);
        if (match) {
          panel.removeAttribute('hidden');
          // Restart enter animation when switching panels.
          panel.style.animation = 'none';
          void panel.offsetWidth;
          panel.style.animation = '';
        } else {
          panel.setAttribute('hidden', '');
        }
      });
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        activate(tab.getAttribute('data-fo-panel'), false);
      });

      tab.addEventListener('keydown', function (event) {
        var keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
        if (keys.indexOf(event.key) === -1) return;

        event.preventDefault();
        var list = Array.prototype.slice.call(tabs);
        var index = list.indexOf(tab);
        var next = index;

        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
          next = (index + 1) % list.length;
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
          next = (index - 1 + list.length) % list.length;
        } else if (event.key === 'Home') {
          next = 0;
        } else if (event.key === 'End') {
          next = list.length - 1;
        }

        activate(list[next].getAttribute('data-fo-panel'), true);
      });
    });

    activate('overview', false);
  }

  function initHeroSlogan() {
    var wordEl = document.getElementById('fo-hero-word');
    if (!wordEl || !window.HubFindYourNextRotate) return;

    window.HubFindYourNextRotate(
      wordEl,
      ['attendees', 'bookings', 'discovery', 'community', 'ticketing platform'],
      3000
    );
  }

  function init() {
    initReveal();
    initDashPreview();
    initHeroSlogan();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
