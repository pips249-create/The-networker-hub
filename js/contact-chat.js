/**
 * Contact page — inline Hubert chat (uses shared hubert-chat.js).
 */
(function () {
  function initTeamContactForm() {
    var showBtn = document.getElementById('contact-show-team-form');
    var hideBtn = document.getElementById('contact-hide-team-form');
    var teamPanel = document.getElementById('contact-team-form');
    var chatForm = document.getElementById('contact-chat-form');
    var teamForm = document.getElementById('contact-team-form-fields');
    var suggestions = document.getElementById('contact-chat-suggestions');
    if (!showBtn || !teamPanel || !chatForm) return;

    function openTeamForm() {
      teamPanel.hidden = false;
      chatForm.hidden = true;
      if (suggestions) suggestions.hidden = true;
      showBtn.setAttribute('aria-expanded', 'true');
      var first = document.getElementById('contact-team-name');
      if (first) first.focus();
    }

    function closeTeamForm() {
      teamPanel.hidden = true;
      chatForm.hidden = false;
      if (suggestions) suggestions.hidden = false;
      showBtn.setAttribute('aria-expanded', 'false');
      var chatInput = document.getElementById('contact-chat-input');
      if (chatInput) chatInput.focus();
    }

    showBtn.addEventListener('click', openTeamForm);
    if (hideBtn) hideBtn.addEventListener('click', closeTeamForm);

    if (teamForm) {
      teamForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = String(document.getElementById('contact-team-name')?.value || '').trim();
        var email = String(document.getElementById('contact-team-email')?.value || '').trim();
        var message = String(document.getElementById('contact-team-message')?.value || '').trim();
        if (!name || !email || !message) return;

        var subject = encodeURIComponent('Contact from ' + name);
        var body = encodeURIComponent('Name: ' + name + '\nEmail: ' + email + '\n\n' + message);
        window.location.href = 'mailto:hello@thenetworkerhub.com?subject=' + subject + '&body=' + body;
      });
    }
  }

  initTeamContactForm();

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
    { label: 'Do I need an account?', prompt: 'Do I need an account to browse?' },
    { label: 'How do I book a ticket?', prompt: 'How do I book a ticket?' },
    { label: 'List as organiser', prompt: 'How do I list an event as an organiser?' },
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
