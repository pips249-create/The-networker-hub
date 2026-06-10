/**
 * Contact page — inline Hubert chat (uses shared hubert-chat.js).
 */
(function () {
  if (!window.HubertChat) return;
  if (
    !document.getElementById('contact-chat-messages') ||
    !document.getElementById('contact-chat-form') ||
    !document.getElementById('contact-chat-input')
  ) {
    return;
  }

  var suggestionsEl = document.getElementById('contact-chat-suggestions');
  window.HubertChatRenderSuggestions(suggestionsEl, [
    { label: 'Events in Manchester', prompt: 'What events are in Manchester?' },
    { label: 'Franchise opportunities', prompt: 'What franchise opportunities are available?' },
    { label: 'How do I book a ticket?', prompt: 'How do I book a ticket?' },
    { label: 'Partnership deals', prompt: 'Show me partnership opportunities on the hub' },
    { label: 'List an event', prompt: 'How do I list an event as an organiser?' },
  ]);

  new window.HubertChat({
    messagesEl: document.getElementById('contact-chat-messages'),
    formEl: document.getElementById('contact-chat-form'),
    inputEl: document.getElementById('contact-chat-input'),
    sendBtn: document.getElementById('contact-chat-send'),
    resetBtn: document.getElementById('contact-chat-reset'),
    suggestionsEl: suggestionsEl,
    bubblePrefix: 'contact-chat-bubble',
  });
})();
