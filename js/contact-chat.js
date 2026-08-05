/**
 * Contact page — team email form (Hubert paused until launch).
 */
(function () {
  var form = document.getElementById('contact-team-only-form');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = String(document.getElementById('contact-team-only-name')?.value || '').trim();
    var email = String(document.getElementById('contact-team-only-email')?.value || '').trim();
    var message = String(document.getElementById('contact-team-only-message')?.value || '').trim();
    if (!name || !email || !message) return;
    var subject = encodeURIComponent('Contact from ' + name);
    var body = encodeURIComponent('Name: ' + name + '\nEmail: ' + email + '\n\n' + message);
    window.location.href = 'mailto:hello@thenetworkerhub.com?subject=' + subject + '&body=' + body;
  });
})();
