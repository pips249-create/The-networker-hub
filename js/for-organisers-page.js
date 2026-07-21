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

  var panelCopy = {
    overview: {
      title: 'Overview',
      text: 'See tickets sold, revenue, and shortcuts into events, memberships, and business opportunities from one home screen.'
    },
    social: {
      title: 'Promote & social',
      text: 'Upgrade events to Premium Spotlight, build LinkedIn post images, copy ready-made social captions, and share ranking badges when you earn one.'
    },
    events: {
      title: 'My events',
      text: 'Create and manage events, then switch tabs for attendees, reviews, and revenue — including CSV export, Avery name badge PDFs, and Stripe payouts.'
    },
    memberships: {
      title: 'Memberships',
      text: 'Upload your member register, import CSVs, sell members-only tickets, and download event reports for renewals and follow-up.'
    },
    business: {
      title: 'My business opportunities',
      text: 'List franchises and partnerships alongside your events. Member enquiries land in the same workspace as your ticket sales.'
    },
    team: {
      title: 'Team & invites',
      text: 'Invite editors to manage events and attendees without sharing your login. Assign access to all groups or specific networking groups.'
    }
  };

  var eventsTabCopy = {
    list: 'Browse live, draft, and archived events. Search by title or location and open any event to edit tickets or publish.',
    attendees:
      'Filter by first visit or returning members, export attendee CSVs, and print Avery name badges (L7160 or L7163) the night before check-in.',
    reviews: 'Read attendee reviews after each event and reply publicly from your dashboard to build trust with new visitors.',
    revenue:
      'Track available balances per event after settlement and request Stripe Connect payouts — you keep the full ticket price you set.'
  };

  function updateDetail(panelId, eventsTabId) {
    var detailTitle = document.getElementById('fo-workspace-detail-title');
    var detailText = document.getElementById('fo-workspace-detail-text');
    var copy = panelCopy[panelId] || panelCopy.overview;

    if (detailTitle) detailTitle.textContent = copy.title;
    if (!detailText) return;

    if (panelId === 'events' && eventsTabId && eventsTabCopy[eventsTabId]) {
      detailText.textContent = eventsTabCopy[eventsTabId];
      return;
    }

    detailText.textContent = copy.text;
  }

  function initEventsSubnav(mock) {
    var tabs = mock.querySelectorAll('[data-fo-events-tab]');
    var views = mock.querySelectorAll('[data-fo-events-view]');
    if (!tabs.length || !views.length) return;

    function activateEventsTab(tabId, focusTab) {
      tabs.forEach(function (tab) {
        var selected = tab.getAttribute('data-fo-events-tab') === tabId;
        tab.classList.toggle('is-active', selected);
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        tab.tabIndex = selected ? 0 : -1;
        if (selected && focusTab) tab.focus();
      });

      views.forEach(function (view) {
        var match = view.getAttribute('data-fo-events-view') === tabId;
        view.classList.toggle('is-active', match);
        if (match) view.removeAttribute('hidden');
        else view.setAttribute('hidden', '');
      });

      updateDetail('events', tabId);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        activateEventsTab(tab.getAttribute('data-fo-events-tab'), false);
      });
    });

    activateEventsTab('list', false);
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
          panel.style.animation = 'none';
          void panel.offsetWidth;
          panel.style.animation = '';
        } else {
          panel.setAttribute('hidden', '');
        }
      });

      if (panelId === 'events') {
        var activeEventsTab = mock.querySelector('[data-fo-events-tab].is-active');
        updateDetail(panelId, activeEventsTab ? activeEventsTab.getAttribute('data-fo-events-tab') : 'list');
      } else {
        updateDetail(panelId);
      }
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

    initEventsSubnav(mock);
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
