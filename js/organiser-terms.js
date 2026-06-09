/**
 * Organiser terms acceptance — required before first publish.
 */
(function () {
  var STORAGE_KEY = 'hub_organiser_terms_v1';
  var script = document.currentScript;
  var root = (script && script.getAttribute('data-root')) || '../';

  function hasAccepted() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function markAccepted() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch (e) {
      /* ignore */
    }
  }

  function ensureModal() {
    if (document.getElementById('hub-organiser-terms-modal')) return;

    var modal = document.createElement('div');
    modal.id = 'hub-organiser-terms-modal';
    modal.className = 'hub-organiser-terms-modal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'hub-organiser-terms-title');
    modal.innerHTML =
      '<div class="hub-organiser-terms-panel">' +
      '<h2 id="hub-organiser-terms-title">Organiser terms</h2>' +
      '<p>Before you publish on The Networker Hub, please confirm you agree to our organiser terms, including refund responsibilities, attendee data protection, and listing accuracy.</p>' +
      '<ul class="hub-organiser-terms-list">' +
      '<li>You are responsible for delivering events and honouring your stated refund policy</li>' +
      '<li>Business opportunity listings must be truthful and not misleading</li>' +
      '<li>You will handle attendee data only for event administration</li>' +
      '</ul>' +
      '<label class="hub-organiser-terms-check">' +
      '<input type="checkbox" id="hub-organiser-terms-checkbox" />' +
      '<span>I agree to the <a href="' +
      root +
      'legal-policies.html#organisers" target="_blank" rel="noopener noreferrer">Organiser terms</a> and <a href="' +
      root +
      'legal-policies.html#terms" target="_blank" rel="noopener noreferrer">Terms &amp; conditions</a></span>' +
      '</label>' +
      '<div class="hub-organiser-terms-actions">' +
      '<button type="button" class="hub-organiser-terms-btn" id="hub-organiser-terms-cancel">Cancel</button>' +
      '<button type="button" class="hub-organiser-terms-btn hub-organiser-terms-btn--primary" id="hub-organiser-terms-confirm" disabled>Accept and continue</button>' +
      '</div></div>';
    document.body.appendChild(modal);

    var checkbox = document.getElementById('hub-organiser-terms-checkbox');
    var confirmBtn = document.getElementById('hub-organiser-terms-confirm');
    checkbox.addEventListener('change', function () {
      confirmBtn.disabled = !checkbox.checked;
    });
    document.getElementById('hub-organiser-terms-cancel').addEventListener('click', function () {
      modal.hidden = true;
      document.body.classList.remove('hub-organiser-terms-open');
      if (modal._reject) modal._reject();
    });
    confirmBtn.addEventListener('click', function () {
      if (!checkbox.checked) return;
      markAccepted();
      modal.hidden = true;
      document.body.classList.remove('hub-organiser-terms-open');
      if (modal._resolve) modal._resolve();
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal && modal._reject) {
        modal.hidden = true;
        document.body.classList.remove('hub-organiser-terms-open');
        modal._reject();
      }
    });
  }

  window.HubOrganiserTerms = {
    requireAcceptance: function () {
      if (hasAccepted()) return Promise.resolve();
      ensureModal();
      var modal = document.getElementById('hub-organiser-terms-modal');
      var checkbox = document.getElementById('hub-organiser-terms-checkbox');
      var confirmBtn = document.getElementById('hub-organiser-terms-confirm');
      checkbox.checked = false;
      confirmBtn.disabled = true;
      modal.hidden = false;
      document.body.classList.add('hub-organiser-terms-open');
      return new Promise(function (resolve, reject) {
        modal._resolve = resolve;
        modal._reject = reject;
      });
    },
  };
})();
