/**
 * Organiser terms acceptance — required before first publish.
 * Persisted in hub_accounts (with localStorage cache).
 */
(function () {
  var STORAGE_KEY = 'hub_organiser_terms_v2';
  var TERMS_VERSION = 'v2';
  var serverChecked = false;
  var serverAccepted = false;

  function hasAcceptedLocal() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function markAcceptedLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch (e) {
      /* ignore */
    }
  }

  function checkServerAccepted() {
    if (serverChecked) return Promise.resolve(serverAccepted);
    return fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        serverChecked = true;
        serverAccepted = !!(data && data.ok && data.organiserTermsAccepted);
        if (serverAccepted) markAcceptedLocal();
        return serverAccepted;
      })
      .catch(function () {
        serverChecked = true;
        serverAccepted = hasAcceptedLocal();
        return serverAccepted;
      });
  }

  function persistAcceptance() {
    return fetch('/api/auth/accept-organiser-terms', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: TERMS_VERSION }),
    })
      .then(function (r) {
        return r.json().then(function (body) {
          if (!r.ok || body.ok === false) {
            throw new Error(body.message || body.error || 'Could not save acceptance');
          }
          serverAccepted = true;
          serverChecked = true;
          markAcceptedLocal();
          return body;
        });
      });
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
      '<p>Before you publish on The Networker UK, please confirm you agree to our organiser terms, including refund responsibilities, attendee data protection, and listing accuracy.</p>' +
      '<ul class="hub-organiser-terms-list">' +
      '<li>You are responsible for delivering events and honouring your stated refund policy</li>' +
      '<li>Business opportunity listings must be truthful and not misleading</li>' +
      '<li>Network marketing listings must be product-selling only — recruitment-primary / downline schemes are not allowed</li>' +
      '<li>Use attendee contact details only to run your events — not for unrelated marketing</li>' +
      '<li>You must follow our <a href="/legal-policies#hub-rules" target="_blank" rel="noopener noreferrer">Platform rules</a> for organisers</li>' +
      '</ul>' +
      '<label class="hub-organiser-terms-check">' +
      '<input type="checkbox" id="hub-organiser-terms-checkbox" />' +
      '<span>I agree to the <a href="/legal-policies#organisers" target="_blank" rel="noopener noreferrer">Organiser terms</a> and <a href="/legal-policies#terms" target="_blank" rel="noopener noreferrer">Terms &amp; conditions</a></span>' +
      '</label>' +
      '<p class="hub-organiser-terms-error" id="hub-organiser-terms-error" hidden></p>' +
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
      var errEl = document.getElementById('hub-organiser-terms-error');
      confirmBtn.disabled = true;
      if (errEl) errEl.hidden = true;
      persistAcceptance()
        .then(function () {
          modal.hidden = true;
          document.body.classList.remove('hub-organiser-terms-open');
          if (modal._resolve) modal._resolve();
        })
        .catch(function (err) {
          if (errEl) {
            errEl.hidden = false;
            errEl.textContent = err.message || 'Could not save acceptance. Try again.';
          }
          confirmBtn.disabled = !checkbox.checked;
        });
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
      return checkServerAccepted().then(function (accepted) {
        if (accepted) return Promise.resolve();
        ensureModal();
        var modal = document.getElementById('hub-organiser-terms-modal');
        var checkbox = document.getElementById('hub-organiser-terms-checkbox');
        var confirmBtn = document.getElementById('hub-organiser-terms-confirm');
        var errEl = document.getElementById('hub-organiser-terms-error');
        checkbox.checked = false;
        confirmBtn.disabled = true;
        if (errEl) errEl.hidden = true;
        modal.hidden = false;
        document.body.classList.add('hub-organiser-terms-open');
        return new Promise(function (resolve, reject) {
          modal._resolve = resolve;
          modal._reject = reject;
        });
      });
    },
  };
})();
