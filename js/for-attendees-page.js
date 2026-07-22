/**
 * For attendees page: scroll reveals, hero rotation, and My Hub preview.
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

  var panelCopy = {
    overview: {
      title: 'Overview',
      text: 'See upcoming tickets, saved events, pending reviews, and membership expiry dates from one home screen.'
    },
    upcoming: {
      title: 'Upcoming',
      text: 'Booking references, meeting links for online events, share cards, and cancellation options when the policy allows.'
    },
    past: {
      title: 'Past events',
      text: 'Events you attended — leave a review to help others pick the right networking room.'
    },
    payments: {
      title: 'Payments',
      text: 'Receipts, booking references, and refund status for tickets you purchased through the Hub.'
    },
    saved: {
      title: 'Saved',
      text: 'Saved events, organisers, opportunities, and search alerts — get emailed when tickets open or new listings match.'
    },
    reviews: {
      title: 'Reviews',
      text: 'Leave feedback after events you attended and read organiser replies in your dashboard.'
    },
    enquiries: {
      title: 'My enquiries',
      text: 'Track enquiries you sent to franchise, side hustle, and partnership listings on Business Opportunities.'
    }
  };

  function updateDetail(panelId) {
    var detailTitle = document.getElementById('fa-workspace-detail-title');
    var detailText = document.getElementById('fa-workspace-detail-text');
    var copy = panelCopy[panelId] || panelCopy.overview;
    if (detailTitle) detailTitle.textContent = copy.title;
    if (detailText) detailText.textContent = copy.text;
  }

  function initDashPreview() {
    var mock = document.getElementById('fa-dash-mock');
    if (!mock) return;

    var tabs = mock.querySelectorAll('[role="tab"][data-fa-panel]');
    var panels = mock.querySelectorAll('[data-fa-panel-view]');
    if (!tabs.length || !panels.length) return;

    function activate(panelId, focusTab) {
      tabs.forEach(function (tab) {
        var selected = tab.getAttribute('data-fa-panel') === panelId;
        tab.classList.toggle('is-active', selected);
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        tab.tabIndex = selected ? 0 : -1;
        if (selected && focusTab) tab.focus();
      });

      panels.forEach(function (panel) {
        var match = panel.getAttribute('data-fa-panel-view') === panelId;
        panel.classList.toggle('is-active', match);
        if (match) {
          panel.removeAttribute('hidden');
          panel.style.animation = 'none';
          void panel.offsetWidth;
          panel.style.animation = '';
        } else {
          panel.setAttribute('hidden', '');
        }
      });

      updateDetail(panelId);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        activate(tab.getAttribute('data-fa-panel'), false);
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

        activate(list[next].getAttribute('data-fa-panel'), true);
      });
    });

    activate('overview', false);
  }

  function initHeroSlogan() {
    var wordEl = document.getElementById('fa-hero-word');
    if (!wordEl || !window.HubFindYourNextRotate) return;

    window.HubFindYourNextRotate(
      wordEl,
      ['opportunity', 'organiser', 'event', 'connection', 'community'],
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
