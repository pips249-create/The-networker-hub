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
  };

  var SUGGESTIONS = {
    'event-format': [
      { label: 'In person vs online', prompt: 'Should I list my event as in person or online?' },
      { label: 'Multiple groups', prompt: 'Can I run events under more than one group profile?' },
      { label: 'What happens next', prompt: 'What do I fill in after choosing the event format?' },
    ],
    'event-edit': [
      { label: 'Description tips', prompt: 'What should I write in my event description?' },
      { label: 'Multiple dates', prompt: 'How do I add more than one date to an event series?' },
      { label: 'Cover photo', prompt: 'What photo works best for an event listing?' },
    ],
    'event-tickets': [
      { label: 'Early bird pricing', prompt: 'How do I set up early bird ticket pricing?' },
      { label: 'VAT choice', prompt: 'Should VAT be included in my ticket price or added at checkout?' },
      { label: 'Save before publish', prompt: 'Can I save tickets as draft before publishing my event?' },
    ],
    'group-edit': [
      { label: 'First event', prompt: 'What happens after I save my group profile?' },
      { label: 'Logo & name', prompt: 'What should I use for my group logo and name?' },
      { label: 'Contact email', prompt: 'Who sees the contact email on my organiser page?' },
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

  function assetRoot() {
    var s =
      document.querySelector('script[data-root][src*="hubert-organiser-guide"]') ||
      document.querySelector('script[data-root][src*="organiser-flow-tour"]');
    return (s && s.getAttribute('data-root')) || '../';
  }

  function pageKey() {
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

  function initChat(rootEl) {
    if (chatInstance || !global.HubertChat || !rootEl) return chatInstance;

    var messagesEl = rootEl.querySelector('#hub-hubert-guide-messages');
    var formEl = rootEl.querySelector('#hub-hubert-guide-form');
    var inputEl = rootEl.querySelector('#hub-hubert-guide-input');
    var sendBtn = rootEl.querySelector('#hub-hubert-guide-send');
    var resetBtn = rootEl.querySelector('#hub-hubert-guide-reset');
    var suggestionsEl = rootEl.querySelector('#hub-hubert-guide-suggestions');
    if (!messagesEl || !formEl || !inputEl) return null;

    var key = pageKey();
    var cfgSuggestions = SUGGESTIONS[key] || SUGGESTIONS['event-edit'];
    if (global.HubertChatRenderSuggestions) {
      global.HubertChatRenderSuggestions(suggestionsEl, cfgSuggestions);
    }

    chatInstance = new global.HubertChat({
      messagesEl: messagesEl,
      formEl: formEl,
      inputEl: inputEl,
      sendBtn: sendBtn,
      resetBtn: resetBtn,
      suggestionsEl: suggestionsEl,
      greeting: GREETINGS[key] || GREETINGS['event-edit'],
      bubblePrefix: 'hubert-bubble',
    });

    return chatInstance;
  }

  function mountQuestionsOnlyIfNeeded() {
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
    pageKey: pageKey,
    mountQuestionsOnlyIfNeeded: mountQuestionsOnlyIfNeeded,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountQuestionsOnlyIfNeeded);
  } else {
    mountQuestionsOnlyIfNeeded();
  }
})(typeof window !== 'undefined' ? window : globalThis);
