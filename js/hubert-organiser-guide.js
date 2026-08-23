/**
 * Hubert — left-side listing guide for organiser event creation pages.
 */
(function (global) {
  var GREETINGS = {
    'event-format':
      "Good afternoon. I'll walk you through choosing a group and format — do ask if anything is unclear.",
    'event-edit':
      "Allow me to help with your listing details. I'll highlight each section, or you may ask me here.",
    'event-tickets':
      'Almost there — ticket types and publishing next. Do ask if VAT, refunds, tier setup, or member list tickets are unclear.',
    'event-review':
      'Do check your summary before publishing. Ask if anything looks amiss or you would like to change a section.',
    'event-location':
      'This is the location step — venue address for in-person events, or your online join link. Do ask if anything is unclear.',
    'member-roster':
      'This is your membership — it unlocks Members only tickets. Ask how to add members, import CSV, expiry dates, or reports.',
    'group-edit':
      'Your organiser page is the home for your events. Do ask if anything on this page is unclear.',
    'organiser-dashboard':
      "I'm at your service on your organiser dashboard — ask about claiming your page, listing events, tickets, payouts, or inviting your team.",
  };

  var SUGGESTIONS = {
    'event-format': [
      { label: 'In person vs online', prompt: 'Should I list my event as in person or online?' },
      { label: 'Multiple organiser pages', prompt: 'Can I run events under more than one organiser page?' },
      { label: 'What happens next', prompt: 'What do I fill in after choosing the event format?' },
    ],
    'event-edit': [
      { label: 'Meeting vs Events type', prompt: 'What is the difference between an event and a meeting?' },
      { label: 'Photo cropped wrong', prompt: 'My event photo is cropped badly on the listing — how do I fix it?' },
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
      { label: 'Attendance modes', prompt: 'What is the difference between ticket types, guest visit programme, and Category Exclusivity?' },
      { label: 'Paid + guest visits', prompt: 'Can I create a paid ticket as well as offering guest visit tickets?' },
      { label: 'Guest visit programme', prompt: 'What is the guest visit programme for networking groups?' },
      { label: 'Category Exclusivity', prompt: 'What is Category Exclusivity?' },
      { label: 'Previous Attendees', prompt: 'What is Previous Attendees for repeat events?' },
      { label: 'Application questions', prompt: 'Can I change the application questions asked?' },
      { label: 'See registrations', prompt: 'How can I see who has registered for my event?' },
      { label: 'Visit counts', prompt: 'How do visit counts and new vs returning attendees work?' },
      { label: 'Early bird pricing', prompt: 'How do I set up early bird ticket pricing?' },
      { label: 'VAT choice', prompt: 'Should VAT be included in my ticket price or added at checkout?' },
      { label: 'Save before publish', prompt: 'Can I save tickets as draft before publishing my event?' },
      { label: 'Members only ticket', prompt: 'How do I set up a members only ticket with the member list?' },
      { label: 'Member list', prompt: 'What is a member list?' },
    ],
    'event-review': [
      { label: 'What happens when I publish', prompt: 'What happens when I publish my event on The Networker UK?' },
      { label: 'Edit before publish', prompt: 'Can I still edit my event after publishing?' },
      { label: 'Approval time', prompt: 'How long does event listing review take before it goes live?' },
    ],
    'member-roster': [
      { label: 'What is it?', prompt: 'What is a member list?' },
      { label: 'Members only tickets', prompt: 'How do I set up a members only ticket with the member list?' },
      { label: 'Import CSV', prompt: 'How do I import my member list as CSV?' },
      { label: 'Expiry dates', prompt: 'How do membership expiry dates on the member list work?' },
      { label: 'Invite emails', prompt: 'What happens when I add someone to the member list?' },
    ],
    'group-edit': [
      { label: 'Complimentary visits', prompt: 'How do complimentary guest visits work on my organiser page?' },
      { label: 'First event', prompt: 'What happens after I save my organiser page?' },
      { label: 'Conference or exhibition', prompt: 'Should I list my event as a Conference or Exhibition?' },
      { label: 'Logo & name', prompt: 'What should I use for my group logo and name?' },
      { label: 'Contact email', prompt: 'Who sees the contact email on my organiser page?' },
    ],
    'organiser-dashboard': [
      { label: 'Getting started', prompt: 'How do I list my first event on The Networker UK?' },
      { label: 'Claim my group', prompt: 'How do I claim my organiser page on The Networker UK?' },
      { label: 'Stripe payouts', prompt: 'How do Stripe Connect payouts and refunds work for organisers?' },
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
    if (/\/event-format(?:\.html)?\/?$/.test(path)) return 'event-format';
    if (/\/event-edit(?:\.html)?\/?$/.test(path)) return 'event-edit';
    if (/\/event-tickets(?:\.html)?\/?$/.test(path)) return 'event-tickets';
    if (/\/event-review(?:\.html)?\/?$/.test(path)) return 'event-review';
    if (/\/event-location(?:\.html)?\/?$/.test(path)) return 'event-location';
    if (/\/group-edit(?:\.html)?\/?$/.test(path)) return 'group-edit';
    if (/\/member-roster(?:\.html)?\/?$/.test(path)) return 'member-roster';
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
    if (chatInstance || !global.HubertChat || !rootEl) {
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

    chatInstance = instance;

    return instance;
  }

  function askHubert(prompt) {
    var text = String(prompt || '').trim();
    if (!text) return null;
    if (global.HubFlowTour && global.HubFlowTour.openHelp) {
      global.HubFlowTour.openHelp();
    }
    var root = document.getElementById('hub-flow-tour');
    if (!root) return null;
    if (!chatInstance) {
      initChat(root);
    }
    if (chatInstance) {
      global.setTimeout(function () {
        chatInstance.sendMessage(text);
      }, 60);
    }
    return chatInstance;
  }

  function mountQuestionsOnlyIfNeeded() {
    /* Hubert help opens on demand via Hubert's help — not automatically. */
  }

  global.HubertOrganiserGuide = {
    assetRoot: assetRoot,
    initChat: initChat,
    ask: askHubert,
    pageKey: pageKey,
    mountQuestionsOnlyIfNeeded: mountQuestionsOnlyIfNeeded,
    DASHBOARD_GREETING: GREETINGS['organiser-dashboard'],
    DASHBOARD_SUGGESTIONS: SUGGESTIONS['organiser-dashboard'],
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountQuestionsOnlyIfNeeded);
  } else {
    mountQuestionsOnlyIfNeeded();
  }
})(typeof window !== 'undefined' ? window : globalThis);
