/**
 * Hubert — shared chat logic for inline (contact) and floating widget.
 */
(function (global) {
  var HUBERT_GREETING =
    "Good afternoon. I'm Hubert — at your service on The Networker UK. Do browse events and opportunities freely, or allow me to guide you through tickets, enquiries, and organiser tools.";

  var DEFAULT_SUGGESTIONS = [
    { label: 'Upcoming events', prompt: 'What networking events are coming up?' },
    { label: 'Franchise deals', prompt: 'What franchise opportunities are on The Networker UK?' },
    { label: 'Do I need an account?', prompt: 'Do I need an account to browse?' },
    { label: 'Book a ticket', prompt: 'How do I book a ticket?' },
  ];

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function HubertChat(options) {
    this.messagesEl = options.messagesEl;
    this.formEl = options.formEl;
    this.inputEl = options.inputEl;
    this.sendBtn = options.sendBtn;
    this.resetBtn = options.resetBtn;
    this.suggestionsEl = options.suggestionsEl;
    this.bubblePrefix = options.bubblePrefix || 'hubert-bubble';
    this.apiUrl = options.apiUrl || '/api/contact-chat';
    this.hubertContext = options.hubertContext || '';
    this.greeting = options.greeting || HUBERT_GREETING;
    this.history = [];
    this.busy = false;
    this.bind();
    this.showGreeting();
  }

  HubertChat.prototype.appendBubble = function (role, text, extraClass) {
    var div = document.createElement('div');
    div.className =
      this.bubblePrefix +
      ' ' +
      this.bubblePrefix +
      '--' +
      role +
      (extraClass ? ' ' + extraClass : '');
    div.innerHTML = esc(text).replace(/\n/g, '<br>');
    this.messagesEl.appendChild(div);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return div;
  };

  HubertChat.prototype.setBusy = function (on) {
    this.busy = on;
    this.inputEl.disabled = on;
    if (this.sendBtn) this.sendBtn.disabled = on;
  };

  HubertChat.prototype.hideSuggestions = function () {
    if (this.suggestionsEl) this.suggestionsEl.hidden = true;
  };

  HubertChat.prototype.showReset = function () {
    if (this.resetBtn) this.resetBtn.hidden = false;
  };

  HubertChat.prototype.showGreeting = function () {
    this.appendBubble('assistant', this.greeting);
  };

  HubertChat.prototype.reset = function () {
    this.history = [];
    this.messagesEl.innerHTML = '';
    if (this.suggestionsEl) this.suggestionsEl.hidden = false;
    if (this.resetBtn) this.resetBtn.hidden = true;
    this.showGreeting();
    this.inputEl.focus();
  };

  HubertChat.prototype.sendMessage = function (text) {
    var self = this;
    var content = String(text || '').trim();
    if (!content || self.busy) return;

    self.hideSuggestions();
    self.showReset();
    self.appendBubble('user', content);
    self.history.push({ role: 'user', content: content });
    self.inputEl.value = '';

    var typing = self.appendBubble('assistant', 'Thinking…', self.bubblePrefix + '--typing');
    self.setBusy(true);

    fetch(self.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: self.history,
        context: self.hubertContext || undefined,
      }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        typing.remove();
        var reply =
          (data && data.reply) ||
          'Sorry — I could not get a reply just now. Please email hello@thenetworkeruk.com.';
        self.appendBubble('assistant', reply);
        self.history.push({ role: 'assistant', content: reply });
      })
      .catch(function () {
        typing.remove();
        self.appendBubble(
          'assistant',
          'Something went wrong. Please try again or email hello@thenetworkeruk.com.'
        );
      })
      .finally(function () {
        self.setBusy(false);
        self.inputEl.focus();
      });
  };

  HubertChat.prototype.bind = function () {
    var self = this;

    self.formEl.addEventListener('submit', function (ev) {
      ev.preventDefault();
      self.sendMessage(self.inputEl.value);
    });

    self.inputEl.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        self.formEl.requestSubmit();
      }
    });

    self.inputEl.addEventListener('input', function () {
      if (!self.suggestionsEl) return;
      if (self.inputEl.value.trim()) {
        self.hideSuggestions();
      } else if (self.history.length === 0) {
        self.suggestionsEl.hidden = false;
      }
    });

    if (self.suggestionsEl) {
      self.suggestionsEl.addEventListener('click', function (ev) {
        var chip = ev.target.closest('[data-prompt]');
        if (!chip) return;
        self.sendMessage(chip.getAttribute('data-prompt'));
      });
    }

    if (self.resetBtn) {
      self.resetBtn.addEventListener('click', function () {
        self.reset();
      });
    }
  };

  function renderSuggestions(container, suggestions, chipClass) {
    if (!container) return;
    var cls = chipClass || 'hubert-chip';
    container.innerHTML = (suggestions || DEFAULT_SUGGESTIONS)
      .map(function (item) {
        return (
          '<button type="button" class="' +
          cls +
          '" data-prompt="' +
          esc(item.prompt) +
          '">' +
          esc(item.label) +
          '</button>'
        );
      })
      .join('');
  }

  global.HubertChat = HubertChat;
  global.HubertChatGreeting = HUBERT_GREETING;
  global.HubertChatSuggestions = DEFAULT_SUGGESTIONS;
  global.HubertChatRenderSuggestions = renderSuggestions;
})(window);
