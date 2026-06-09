/**
 * Contact page — AI chat assistant.
 */
(function () {
  var messagesEl = document.getElementById('contact-chat-messages');
  var formEl = document.getElementById('contact-chat-form');
  var inputEl = document.getElementById('contact-chat-input');
  var sendBtn = document.getElementById('contact-chat-send');
  var resetBtn = document.getElementById('contact-chat-reset');
  var suggestionsEl = document.getElementById('contact-chat-suggestions');

  if (!messagesEl || !formEl || !inputEl) return;

  var history = [];
  var busy = false;

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function appendBubble(role, text, extraClass) {
    var div = document.createElement('div');
    div.className =
      'contact-chat-bubble contact-chat-bubble--' +
      role +
      (extraClass ? ' ' + extraClass : '');
    div.innerHTML = esc(text).replace(/\n/g, '<br>');
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function setBusy(on) {
    busy = on;
    inputEl.disabled = on;
    sendBtn.disabled = on;
  }

  function hideSuggestions() {
    if (suggestionsEl) suggestionsEl.hidden = true;
  }

  function showReset() {
    if (resetBtn) resetBtn.hidden = false;
  }

  function sendMessage(text) {
    var content = String(text || '').trim();
    if (!content || busy) return;

    hideSuggestions();
    showReset();
    appendBubble('user', content);
    history.push({ role: 'user', content: content });
    inputEl.value = '';

    var typing = appendBubble('assistant', 'Thinking…', 'contact-chat-bubble--typing');
    setBusy(true);

    fetch('/api/contact-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        typing.remove();
        var reply =
          (data && data.reply) ||
          'Sorry — I could not get a reply just now. Please email hello@the-networker.co.uk.';
        appendBubble('assistant', reply);
        history.push({ role: 'assistant', content: reply });
      })
      .catch(function () {
        typing.remove();
        appendBubble(
          'assistant',
          'Something went wrong. Please try again or email hello@the-networker.co.uk.'
        );
      })
      .finally(function () {
        setBusy(false);
        inputEl.focus();
      });
  }

  formEl.addEventListener('submit', function (ev) {
    ev.preventDefault();
    sendMessage(inputEl.value);
  });

  inputEl.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      formEl.requestSubmit();
    }
  });

  if (suggestionsEl) {
    suggestionsEl.addEventListener('click', function (ev) {
      var chip = ev.target.closest('[data-prompt]');
      if (!chip) return;
      sendMessage(chip.getAttribute('data-prompt'));
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      history = [];
      messagesEl.innerHTML = '';
      if (suggestionsEl) suggestionsEl.hidden = false;
      resetBtn.hidden = true;
      appendBubble(
        'assistant',
        'Hi — I\'m the Networker Hub assistant. Ask me about events, tickets, organiser listings, or business opportunities.'
      );
      inputEl.focus();
    });
  }

  appendBubble(
    'assistant',
    'Hi — I\'m the Networker Hub assistant. Ask me about events, tickets, organiser listings, or business opportunities.'
  );
})();
