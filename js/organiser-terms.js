/**
 * Organiser terms acceptance — required before first publish.
 * Event and business opportunity listings track acceptance separately.
 * Persisted in hub_accounts (with localStorage cache).
 */
(function () {
  var EVENT_STORAGE_KEY = 'hub_organiser_terms_v2';
  var OPPORTUNITY_STORAGE_KEY = 'hub_organiser_opportunity_terms_v1';
  var EVENT_TERMS_VERSION = 'v2';
  var OPPORTUNITY_TERMS_VERSION = 'v1';
  var serverState = {
    event: { checked: false, accepted: false },
    opportunity: { checked: false, accepted: false },
  };

  function termsContext() {
    var script = document.querySelector('script[data-context]');
    if (script && script.getAttribute('data-context')) {
      return script.getAttribute('data-context');
    }
    if (document.body && document.body.classList.contains('organiser-opportunity-edit-page')) {
      return 'opportunity';
    }
    return 'event';
  }

  function storageKey(context) {
    return context === 'opportunity' ? OPPORTUNITY_STORAGE_KEY : EVENT_STORAGE_KEY;
  }

  function termsVersion(context) {
    return context === 'opportunity' ? OPPORTUNITY_TERMS_VERSION : EVENT_TERMS_VERSION;
  }

  function modalCopy(context) {
    if (context === 'opportunity') {
      return {
        title: 'Business listing terms',
        intro:
          'Before you submit a business opportunity on The Networker UK, please confirm you agree to our organiser terms — especially section 4 (business opportunities), listing accuracy, enquiry handling, and what is allowed on the directory.',
        note:
          'We record the date and version you accept for business listings (currently ' +
          OPPORTUNITY_TERMS_VERSION +
          '). This is required even if you have already accepted organiser terms for events.',
        checkbox:
          'I agree to the <a href="/legal-policies#organisers" target="_blank" rel="noopener noreferrer">Organiser terms</a> (including business listings) and <a href="/legal-policies#terms" target="_blank" rel="noopener noreferrer">Terms &amp; conditions</a>',
        bullets: [
          'Your listing must be truthful, complete, and not misleading about investment, earnings, or territory',
          'Network marketing listings must be product-selling only — recruitment-primary / downline schemes are not allowed',
          'You will respond to member enquiries in good faith using the contact details you provide',
          'Use enquiry contact details only for this opportunity — not for unrelated marketing',
          'You must follow our <a href="/legal-policies#hub-rules" target="_blank" rel="noopener noreferrer">Platform rules</a> for organisers',
        ],
      };
    }
    return {
      title: 'Organiser terms',
      intro:
        'Before you publish on The Networker UK, please confirm you agree to our organiser terms, including refund responsibilities, attendee data protection, and listing accuracy.',
      note:
        'We record the date and version you accept (currently ' + EVENT_TERMS_VERSION + ').',
      checkbox:
        'I agree to the <a href="/legal-policies#organisers" target="_blank" rel="noopener noreferrer">Organiser terms</a> and <a href="/legal-policies#terms" target="_blank" rel="noopener noreferrer">Terms &amp; conditions</a>',
      bullets: [
        'You are responsible for delivering events and honouring your stated refund policy',
        'Business opportunity listings must be truthful and not misleading',
        'Network marketing listings must be product-selling only — recruitment-primary / downline schemes are not allowed',
        'Use attendee contact details only to run your events — not for unrelated marketing',
        'You must follow our <a href="/legal-policies#hub-rules" target="_blank" rel="noopener noreferrer">Platform rules</a> for organisers',
      ],
    };
  }

  function hasAcceptedLocal(context) {
    try {
      return localStorage.getItem(storageKey(context)) === '1';
    } catch (e) {
      return false;
    }
  }

  function markAcceptedLocal(context) {
    try {
      localStorage.setItem(storageKey(context), '1');
    } catch (e) {
      /* ignore */
    }
  }

  function applySessionFlags(data) {
    serverState.event.checked = true;
    serverState.opportunity.checked = true;
    if (!data) return;
    if ('organiserTermsAccepted' in data) {
      serverState.event.accepted = !!data.organiserTermsAccepted;
    }
    if ('organiserOpportunityTermsAccepted' in data) {
      serverState.opportunity.accepted = !!data.organiserOpportunityTermsAccepted;
    }
    if (serverState.event.accepted) markAcceptedLocal('event');
    if (serverState.opportunity.accepted) markAcceptedLocal('opportunity');
  }

  function checkServerAccepted(context) {
    var ctx = context || termsContext();
    if (serverState[ctx].checked) return Promise.resolve(serverState[ctx].accepted);
    return fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        applySessionFlags(data);
        if (serverState[ctx].accepted) return true;
        return hasAcceptedLocal(ctx);
      })
      .catch(function () {
        serverState.event.checked = true;
        serverState.opportunity.checked = true;
        serverState.event.accepted = hasAcceptedLocal('event');
        serverState.opportunity.accepted = hasAcceptedLocal('opportunity');
        return serverState[ctx].accepted || hasAcceptedLocal(ctx);
      });
  }

  function persistAcceptance(context) {
    return fetch('/api/auth/accept-organiser-terms', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: termsVersion(context), context: context }),
    })
      .then(function (r) {
        return r.json().then(function (body) {
          if (!r.ok || body.ok === false) {
            throw new Error(body.message || body.error || 'Could not save acceptance');
          }
          applySessionFlags(body);
          markAcceptedLocal(context);
          if (body.organiserTermsAccepted) markAcceptedLocal('event');
          if (body.organiserOpportunityTermsAccepted) markAcceptedLocal('opportunity');
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
      '<h2 id="hub-organiser-terms-title"></h2>' +
      '<p id="hub-organiser-terms-intro"></p>' +
      '<ul class="hub-organiser-terms-list" id="hub-organiser-terms-list"></ul>' +
      '<label class="hub-organiser-terms-check">' +
      '<input type="checkbox" id="hub-organiser-terms-checkbox" />' +
      '<span id="hub-organiser-terms-checkbox-label"></span>' +
      '</label>' +
      '<p class="hub-organiser-terms-note" id="hub-organiser-terms-note"></p>' +
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
      var ctx = modal._context || termsContext();
      confirmBtn.disabled = true;
      if (errEl) errEl.hidden = true;
      persistAcceptance(ctx)
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

  function applyModalCopy(context) {
    var copy = modalCopy(context);
    var titleEl = document.getElementById('hub-organiser-terms-title');
    var introEl = document.getElementById('hub-organiser-terms-intro');
    var listEl = document.getElementById('hub-organiser-terms-list');
    var noteEl = document.getElementById('hub-organiser-terms-note');
    var checkboxLabel = document.getElementById('hub-organiser-terms-checkbox-label');
    if (titleEl) titleEl.textContent = copy.title;
    if (introEl) introEl.textContent = copy.intro;
    if (noteEl) noteEl.textContent = copy.note;
    if (checkboxLabel) checkboxLabel.innerHTML = copy.checkbox;
    if (listEl) {
      listEl.innerHTML = copy.bullets
        .map(function (item) {
          return '<li>' + item + '</li>';
        })
        .join('');
    }
  }

  window.HubOrganiserTerms = {
    requireAcceptance: function () {
      var context = termsContext();
      return checkServerAccepted(context).then(function (accepted) {
        if (accepted) return Promise.resolve();
        ensureModal();
        applyModalCopy(context);
        var modal = document.getElementById('hub-organiser-terms-modal');
        modal._context = context;
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
