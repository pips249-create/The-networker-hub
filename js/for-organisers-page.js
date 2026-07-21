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
      text: 'Create and manage events, then switch tabs for attendees, reviews, and revenue — including CSV export, printable name badge PDFs, and Stripe payouts.'
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
    list: {
      title: 'All events',
      lead: 'Browse live, draft, and archived listings. Search by title or location and open any event to edit tickets or publish.',
      detail:
        'Browse live, draft, and archived events. Search by title or location and open any event to edit tickets or publish.'
    },
    attendees: {
      title: 'Attendees & name badges',
      lead: 'Filter your guest list, export CSVs, and print name badges on A4 sticker sheets the night before check-in.',
      detail:
        'Filter by first visit or returning members, export attendee CSVs, and print name badges on standard or large sticker sheets the night before check-in.'
    },
    reviews: {
      title: 'Reviews',
      lead: 'Read feedback after each event and reply publicly to build trust with new visitors.',
      detail: 'Read attendee reviews after each event and reply publicly from your dashboard to build trust with new visitors.'
    },
    revenue: {
      title: 'Revenue',
      lead: 'Track balances per event after settlement and request Stripe Connect payouts.',
      detail:
        'Track available balances per event after settlement and request Stripe Connect payouts — you keep the full ticket price you set.'
    }
  };

  function updateDetail(panelId, eventsTabId) {
    var detailTitle = document.getElementById('fo-workspace-detail-title');
    var detailText = document.getElementById('fo-workspace-detail-text');
    var copy = panelCopy[panelId] || panelCopy.overview;

    if (panelId === 'events' && eventsTabId && eventsTabCopy[eventsTabId]) {
      if (detailTitle) detailTitle.textContent = eventsTabCopy[eventsTabId].title;
      if (detailText) detailText.textContent = eventsTabCopy[eventsTabId].detail;
      return;
    }

    if (detailTitle) detailTitle.textContent = copy.title;
    if (detailText) detailText.textContent = copy.text;
  }

  function updateEventsPanelHead(tabId) {
    var meta = eventsTabCopy[tabId] || eventsTabCopy.list;
    var titleEl = document.getElementById('fo-events-panel-title');
    var leadEl = document.getElementById('fo-events-panel-lead');
    if (titleEl) titleEl.textContent = meta.title;
    if (leadEl) leadEl.textContent = meta.lead;
  }

  function initDashPreview() {
    var mock = document.getElementById('fo-dash-mock');
    if (!mock) return;

    var tabs = mock.querySelectorAll('[role="tab"][data-fo-panel]');
    var panels = mock.querySelectorAll('[data-fo-panel-view]');
    var eventTabs = mock.querySelectorAll('[data-fo-events-tab]');
    var eventViews = mock.querySelectorAll('[data-fo-events-view]');
    if (!tabs.length || !panels.length) return;

    function activateEventsTab(tabId, focusTab) {
      eventTabs.forEach(function (tab) {
        var selected = tab.getAttribute('data-fo-events-tab') === tabId;
        tab.classList.toggle('is-active', selected);
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        tab.tabIndex = selected ? 0 : -1;
        if (selected && focusTab) tab.focus();
      });

      eventViews.forEach(function (view) {
        var match = view.getAttribute('data-fo-events-view') === tabId;
        view.classList.toggle('is-active', match);
        if (match) view.removeAttribute('hidden');
        else view.setAttribute('hidden', '');
      });

      tabs.forEach(function (tab) {
        if (tab.getAttribute('data-fo-panel') !== 'events') return;
        var selected = tab.getAttribute('data-fo-events-tab') === tabId;
        tab.classList.toggle('is-active', selected);
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        tab.tabIndex = selected ? 0 : -1;
      });

      updateEventsPanelHead(tabId);
      updateDetail('events', tabId);
    }

    function activate(panelId, focusTab, eventsTabId) {
      var nextEventsTab = eventsTabId;

      if (panelId === 'events') {
        if (!nextEventsTab) {
          var activeSidebar = mock.querySelector('[data-fo-panel="events"].is-active');
          nextEventsTab =
            (activeSidebar && activeSidebar.getAttribute('data-fo-events-tab')) || 'list';
        }
      }

      tabs.forEach(function (tab) {
        var tabPanel = tab.getAttribute('data-fo-panel');
        var selected = tabPanel === panelId;
        if (tabPanel === 'events') {
          selected = panelId === 'events' && tab.getAttribute('data-fo-events-tab') === nextEventsTab;
        }
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
        activateEventsTab(nextEventsTab, false);
      } else {
        updateDetail(panelId);
      }
    }

    eventTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        activate('events', false, tab.getAttribute('data-fo-events-tab'));
      });
    });

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var panelId = tab.getAttribute('data-fo-panel');
        var eventsTabId = tab.getAttribute('data-fo-events-tab') || null;
        activate(panelId, false, eventsTabId);
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

        var nextTab = list[next];
        activate(nextTab.getAttribute('data-fo-panel'), true, nextTab.getAttribute('data-fo-events-tab'));
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
