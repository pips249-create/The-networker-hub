/**
 * Hubert — left-side listing guide for organiser event creation pages.
 */
(function (global) {
  var GREETINGS = {
    'event-format':
      "I'll walk you through choosing a group and format — ask me anything as you go.",
    'event-edit':
      "Let's get your listing details in shape. I'll highlight each section, or you can ask me here.",
    'event-tickets':
      'Almost there — ticket types and publishing next. Ask if VAT, refunds, or tier setup is unclear.',
    'group-edit':
      'Your group profile is the home for your events. Ask if anything on this page is unclear.',
    'organiser-dashboard':
      "I'm here on your organiser dashboard — ask about group profiles, listing events, tickets, payouts, or inviting your team.",
  };

  var SUGGESTIONS = {
    'event-format': [
      { label: 'In person vs online', prompt: 'Should I list my event as in person or online?' },
      { label: 'Multiple groups', prompt: 'Can I run events under more than one group profile?' },
      { label: 'What happens next', prompt: 'What do I fill in after choosing the event format?' },
    ],
    'event-edit': [
      { label: 'Meeting vs Events type', prompt: 'What is the difference between an event and a meeting?' },
      { label: 'Image too small', prompt: 'My event image is too small — what can I do?' },
      { label: 'Image too large', prompt: 'My event image is too big — what do I do?' },
      { label: 'Remove a date', prompt: "I've accidentally added an extra date — how do I remove it?" },
      {
        label: 'Same name, different details',
        prompt:
          'I have several sessions with the same name but different times or locations — what do I do?',
      },
      { label: 'Description tips', prompt: 'What should I write in my event description?' },
      { label: 'Multiple dates (series)', prompt: 'How do I add more than one date to a recurring event series?' },
    ],
    'event-tickets': [
      { label: 'One Seat Only Policy', prompt: 'What is One Seat Only Policy?' },
      { label: 'Application questions', prompt: 'Can I change the application questions asked?' },
      { label: 'See registrations', prompt: 'How can I see who has registered for my event?' },
      { label: 'Early bird pricing', prompt: 'How do I set up early bird ticket pricing?' },
      { label: 'VAT choice', prompt: 'Should VAT be included in my ticket price or added at checkout?' },
      { label: 'Save before publish', prompt: 'Can I save tickets as draft before publishing my event?' },
    ],
    'group-edit': [
      { label: 'First event', prompt: 'What happens after I save my group profile?' },
      { label: 'Logo & name', prompt: 'What should I use for my group logo and name?' },
      { label: 'Contact email', prompt: 'Who sees the contact email on my organiser page?' },
    ],
    'organiser-dashboard': [
      { label: 'Create a group', prompt: 'How do I create a group profile on the organiser dashboard?' },
      { label: 'List an event', prompt: 'How do I list my first event?' },
      { label: 'Stripe payouts', prompt: 'How do Stripe Connect payouts work for organisers?' },
      { label: 'Invite my team', prompt: 'How do I invite team members to help manage events?' },
    ],
  };

  var TOUR_KEYS = {
    'event-format': 'hub_flow_tour_event_format_v1',
    'event-edit': 'hub_flow_tour_event_edit_v1',
    'event-tickets': 'hub_flow_tour_event_tickets_v1',
    'group-edit': 'hub_flow_tour_group_v1',
    'group-review': 'hub_flow_tour_group_review_v1',
  };

  var chatInstance = null;
  var dashboardChatInstance = null;

  function assetRoot() {
    var s =
      document.querySelector('script[data-root][src*="hubert-organiser-guide"]') ||
      document.querySelector('script[data-root][src*="organiser-flow-tour"]');
    return (s && s.getAttribute('data-root')) || '../';
  }

  function isOrganiserDashboard() {
    var path = (global.location.pathname || '').toLowerCase();
    return /\/organiser\/?$/.test(path) || /\/organiser\/index\.html$/.test(path);
  }

  function pageKey() {
    if (isOrganiserDashboard()) return 'organiser-dashboard';
    var path = (global.location.pathname || '').toLowerCase();
    if (/\/event-format\.html$/.test(path)) return 'event-format';
    if (/\/event-edit\.html$/.test(path)) return 'event-edit';
    if (/\/event-tickets\.html$/.test(path)) return 'event-tickets';
    if (/\/group-edit\.html$/.test(path)) return 'group-edit';
    return '';
  }

  function isNewEventEdit() {
    if (pageKey() !== 'event-edit') return false;
    try {
      return !new URLSearchParams(global.location.search || '').get('id');
    } catch (e) {
      return !/\bid=/.test(global.location.search || '');
    }
  }

  function isTourDone(storageKey) {
    if (!storageKey) return true;
    try {
      return global.localStorage.getItem(storageKey) === '1';
    } catch (e) {
      return false;
    }
  }

  function initChat(rootEl, options) {
    options = options || {};
    var useDashboard = options.dashboard === true;
    if (useDashboard) {
      if (dashboardChatInstance || !global.HubertChat || !rootEl) return dashboardChatInstance;
    } else if (chatInstance || !global.HubertChat || !rootEl) {
      return chatInstance;
    }

    var messagesEl = rootEl.querySelector(options.messagesSelector || '#hub-hubert-guide-messages');
    var formEl = rootEl.querySelector(options.formSelector || '#hub-hubert-guide-form');
    var inputEl = rootEl.querySelector(options.inputSelector || '#hub-hubert-guide-input');
    var sendBtn = rootEl.querySelector(options.sendSelector || '#hub-hubert-guide-send');
    var resetBtn = rootEl.querySelector(options.resetSelector || '#hub-hubert-guide-reset');
    var suggestionsEl = rootEl.querySelector(
      options.suggestionsSelector || '#hub-hubert-guide-suggestions'
    );
    if (!messagesEl || !formEl || !inputEl) return null;

    var key = options.pageKey || pageKey();
    var cfgSuggestions = options.suggestions || SUGGESTIONS[key] || SUGGESTIONS['event-edit'];
    if (global.HubertChatRenderSuggestions) {
      global.HubertChatRenderSuggestions(suggestionsEl, cfgSuggestions);
    }

    var instance = new global.HubertChat({
      messagesEl: messagesEl,
      formEl: formEl,
      inputEl: inputEl,
      sendBtn: sendBtn,
      resetBtn: resetBtn,
      suggestionsEl: suggestionsEl,
      greeting: options.greeting || GREETINGS[key] || GREETINGS['event-edit'],
      hubertContext: options.hubertContext || key,
      bubblePrefix: 'hubert-bubble',
    });

    if (useDashboard) dashboardChatInstance = instance;
    else chatInstance = instance;

    return instance;
  }

  function initOrganiserDashboardChat() {
    if (!isOrganiserDashboard()) return null;
    var root = document.getElementById('org-getting-started-hubert');
    if (!root) return null;
    return initChat(root, {
      dashboard: true,
      pageKey: 'organiser-dashboard',
      messagesSelector: '#org-hubert-messages',
      formSelector: '#org-hubert-form',
      inputSelector: '#org-hubert-input',
      sendSelector: '#org-hubert-send',
      resetSelector: '#org-hubert-reset',
      suggestionsSelector: '#org-hubert-suggestions',
    });
  }

  function mountQuestionsOnlyIfNeeded() {
    if (isOrganiserDashboard()) {
      initOrganiserDashboardChat();
      return;
    }
    var key = pageKey();
    if (!key || !global.HubFlowTour) return;
    if (key === 'event-edit' && !isNewEventEdit()) return;

    var storageKey = TOUR_KEYS[key];
    if (key === 'group-edit') {
      try {
        if (new URLSearchParams(global.location.search || '').get('id')) return;
        if (new URLSearchParams(global.location.search || '').get('onboard') === 'review') {
          storageKey = TOUR_KEYS['group-review'];
        }
      } catch (e) {
        /* ignore */
      }
    }
    if (!isTourDone(storageKey)) return;

    global.HubFlowTour.showQuestionsOnly();
  }

  global.HubertOrganiserGuide = {
    assetRoot: assetRoot,
    initChat: initChat,
    initOrganiserDashboardChat: initOrganiserDashboardChat,
    pageKey: pageKey,
    mountQuestionsOnlyIfNeeded: mountQuestionsOnlyIfNeeded,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountQuestionsOnlyIfNeeded);
  } else {
    mountQuestionsOnlyIfNeeded();
  }
})(typeof window !== 'undefined' ? window : globalThis);
