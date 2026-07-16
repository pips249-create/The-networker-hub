/**
 * Step-by-step walkthrough for group profile and event listing — Hubert left guide.
 */
(function (global) {
  function assetRoot() {
    if (global.HubertOrganiserGuide && global.HubertOrganiserGuide.assetRoot) {
      return global.HubertOrganiserGuide.assetRoot();
    }
    var s = document.querySelector('script[data-root][src*="organiser-flow-tour"]');
    return (s && s.getAttribute('data-root')) || '../';
  }

  function ensureShell() {
    var existing = document.getElementById('hub-flow-tour');
    if (existing) return existing;

    var icon = assetRoot() + 'assets/hubert-icon.png';
    var root = document.createElement('div');
    root.id = 'hub-flow-tour';
    root.className = 'hub-flow-tour';
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="hub-flow-tour-backdrop" data-flow-tour-skip aria-hidden="true"></div>' +
      '<div class="hub-flow-tour-spotlight" aria-hidden="true"></div>' +
      '<aside class="hub-hubert-guide-panel" role="complementary" aria-label="Hubert listing guide">' +
      '<header class="hub-hubert-guide-head">' +
      '<img class="hub-hubert-guide-avatar" src="' +
      icon +
      '" alt="" width="44" height="44">' +
      '<div class="hub-hubert-guide-brand">' +
      '<h2 class="hub-hubert-guide-name">Hubert</h2>' +
      '<p class="hub-hubert-guide-tagline">Your listing guide</p>' +
      '</div>' +
      '<button type="button" class="hub-hubert-guide-collapse" aria-label="Close Hubert help" title="Close">×</button>' +
      '</header>' +
      '<div class="hub-hubert-guide-step" id="hub-hubert-guide-step">' +
      '<p class="hub-flow-tour-step">1 of 1</p>' +
      '<h3 class="hub-flow-tour-title" id="hub-flow-tour-title">Welcome</h3>' +
      '<p class="hub-flow-tour-body"></p>' +
      '<div class="hub-flow-tour-actions">' +
      '<button type="button" class="ee-btn ee-btn-outline" data-flow-tour-skip>Skip tour</button>' +
      '<button type="button" class="ee-btn ee-btn-gold" data-flow-tour-next>Next</button>' +
      '</div></div>' +
      '<div class="hub-hubert-guide-chat">' +
      '<p class="hub-hubert-guide-chat-label">Questions?</p>' +
      '<div class="hub-hubert-guide-messages" id="hub-hubert-guide-messages" role="log" aria-live="polite"></div>' +
      '<button type="button" class="hub-hubert-guide-reset" id="hub-hubert-guide-reset" hidden>New chat</button>' +
      '<div class="hub-hubert-guide-suggestions" id="hub-hubert-guide-suggestions" aria-label="Suggested questions"></div>' +
      '<form class="hub-hubert-guide-form hubert-form" id="hub-hubert-guide-form">' +
      '<div class="hubert-form-compose">' +
      '<label class="visually-hidden" for="hub-hubert-guide-input">Ask Hubert</label>' +
      '<textarea id="hub-hubert-guide-input" rows="2" placeholder="Ask about this step…" maxlength="2000" required></textarea>' +
      '<button type="submit" class="ee-btn ee-btn-primary" id="hub-hubert-guide-send">Send</button>' +
      '</div></form></div></aside>';
    document.body.appendChild(root);
    bindShell(root);
    return root;
  }

  function openHelp() {
    var root = ensureShell();
    initGuideChat(root);
    root.hidden = false;
    root.classList.remove('is-open', 'is-collapsed');
    root.classList.add('is-questions-only', 'is-help-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.remove('hub-flow-tour-active', 'hub-hubert-guide-collapsed');
    document.body.classList.add('hub-hubert-help-open');
  }

  function closeHelp() {
    var root = document.getElementById('hub-flow-tour');
    if (!root) return;
    root.hidden = true;
    root.classList.remove('is-open', 'is-questions-only', 'is-help-open', 'is-collapsed');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove(
      'hub-flow-tour-active',
      'hub-hubert-guide-active',
      'hub-hubert-guide-collapsed',
      'hub-hubert-help-open'
    );
    var spotlight = root.querySelector('.hub-flow-tour-spotlight');
    if (spotlight) spotlight.style.cssText = '';
    var backdrop = root.querySelector('.hub-flow-tour-backdrop');
    if (backdrop) backdrop.style.pointerEvents = '';
  }

  function bindHelpTriggers(selector) {
    document.querySelectorAll(selector).forEach(function (btn) {
      if (btn.getAttribute('data-hubert-help-bound') === '1') return;
      btn.setAttribute('data-hubert-help-bound', '1');
      btn.addEventListener('click', function () {
        var root = document.getElementById('hub-flow-tour');
        if (root && !root.hidden && root.classList.contains('is-help-open')) closeHelp();
        else openHelp();
      });
    });
  }

  function bindShell(root) {
    if (root.getAttribute('data-shell-bound') === '1') return;
    root.setAttribute('data-shell-bound', '1');

    var collapseBtn = root.querySelector('.hub-hubert-guide-collapse');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', function () {
        closeHelp();
      });
    }
  }

  function initGuideChat(root) {
    if (global.HubertOrganiserGuide && global.HubertOrganiserGuide.initChat) {
      global.HubertOrganiserGuide.initChat(root);
    }
  }

  function FlowTour(options) {
    this.storageKey = options.storageKey;
    this.steps = options.steps || [];
    this.shouldStart =
      options.shouldStart ||
      function () {
        return true;
      };
    this.delay = options.delay == null ? 0 : options.delay;
    this.started = false;
    this.stepIndex = 0;
    this.root = null;
    this.stepSection = null;
    this.spotlight = null;
  }

  FlowTour.prototype.isDone = function () {
    try {
      return global.localStorage.getItem(this.storageKey) === '1';
    } catch (e) {
      return false;
    }
  };

  FlowTour.prototype.enterQuestionsMode = function () {
    if (!this.root) return;
    this.root.classList.remove('is-open');
    this.root.classList.add('is-questions-only');
    this.root.setAttribute('aria-hidden', 'false');
    this.root.hidden = false;
    document.body.classList.remove('hub-flow-tour-active');
    document.body.classList.add('hub-hubert-guide-active');
    this.clearSpotlight();
  };

  FlowTour.prototype.markDone = function () {
    try {
      global.localStorage.setItem(this.storageKey, '1');
    } catch (e) {
      /* ignore */
    }
    this.hide();
  };

  FlowTour.prototype.hide = function () {
    closeHelp();
    this.clearSpotlight();
  };

  FlowTour.prototype.clearSpotlight = function () {
    if (this.spotlight) this.spotlight.style.cssText = '';
    if (this.root) {
      var backdrop = this.root.querySelector('.hub-flow-tour-backdrop');
      if (backdrop) backdrop.style.pointerEvents = '';
    }
  };

  FlowTour.prototype.positionSpotlight = function (el) {
    if (!this.spotlight || !el) {
      this.clearSpotlight();
      return;
    }
    var rect = el.getBoundingClientRect();
    var pad = 8;
    this.spotlight.style.top = rect.top - pad + 'px';
    this.spotlight.style.left = rect.left - pad + 'px';
    this.spotlight.style.width = rect.width + pad * 2 + 'px';
    this.spotlight.style.height = rect.height + pad * 2 + 'px';
  };

  FlowTour.prototype.renderStep = function () {
    var step = this.steps[this.stepIndex];
    if (!step || !this.stepSection) return;

    if (typeof step.afterShow === 'function') step.afterShow();

    var stepLabel = this.stepSection.querySelector('.hub-flow-tour-step');
    var titleEl = this.stepSection.querySelector('.hub-flow-tour-title');
    var bodyEl = this.stepSection.querySelector('.hub-flow-tour-body');
    var nextBtn = this.root.querySelector('[data-flow-tour-next]');

    if (stepLabel) {
      stepLabel.textContent = this.stepIndex + 1 + ' of ' + this.steps.length;
    }
    if (titleEl) titleEl.textContent = step.title || '';
    if (bodyEl) bodyEl.textContent = step.body || '';
    if (nextBtn) {
      nextBtn.textContent = this.stepIndex >= this.steps.length - 1 ? 'Got it' : 'Next';
    }

    var target = step.target ? document.querySelector(step.target) : null;
    var backdrop = this.root.querySelector('.hub-flow-tour-backdrop');
    if (backdrop) {
      backdrop.style.pointerEvents = target ? 'none' : 'auto';
    }
    if (target) {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      this.positionSpotlight(target);
    } else {
      this.clearSpotlight();
    }
  };

  FlowTour.prototype.show = function () {
    this.root = ensureShell();
    this.stepSection = this.root.querySelector('#hub-hubert-guide-step');
    this.spotlight = this.root.querySelector('.hub-flow-tour-spotlight');
    initGuideChat(this.root);

    if (!this.bound) {
      this.bound = true;
      var self = this;
      this.root.querySelectorAll('[data-flow-tour-skip]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          self.markDone();
        });
      });
      var nextBtn = this.root.querySelector('[data-flow-tour-next]');
      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          if (self.stepIndex >= self.steps.length - 1) self.markDone();
          else {
            self.stepIndex += 1;
            self.renderStep();
          }
        });
      }
      global.addEventListener('resize', function () {
        if (!self.root || self.root.hidden || !self.root.classList.contains('is-open')) return;
        var step = self.steps[self.stepIndex];
        var target = step && step.target ? document.querySelector(step.target) : null;
        self.positionSpotlight(target);
      });
    }

    this.root.classList.remove('is-questions-only', 'is-collapsed', 'is-help-open');
    document.body.classList.remove('hub-hubert-guide-collapsed', 'hub-hubert-help-open');
    this.stepIndex = 0;
    this.root.hidden = false;
    this.root.classList.add('is-open');
    this.root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('hub-flow-tour-active');
    this.renderStep();
  };

  FlowTour.prototype.startIfNeeded = function () {
    if (this.started || this.isDone() || !this.shouldStart()) return;
    this.started = true;
    var self = this;
    function open() {
      self.show();
    }
    if (this.delay > 0) {
      global.setTimeout(open, this.delay);
    } else if (typeof global.requestAnimationFrame === 'function') {
      global.requestAnimationFrame(open);
    } else {
      open();
    }
  };

  function showQuestionsOnly() {
    openHelp();
  }

  function bindHelpMessageListener() {
    global.addEventListener('message', function (e) {
      if (e.origin !== global.location.origin) return;
      if (e.data && e.data.type === 'hub-open-hubert-help') {
        var root = document.getElementById('hub-flow-tour');
        if (root && !root.hidden && root.classList.contains('is-help-open')) closeHelp();
        else openHelp();
      }
    });
  }

  var GROUP_REVIEW_STEPS = [
    {
      title: 'Check your organiser page',
      body: 'We linked this networking group to your account. Please confirm the logo, name, and contact details are correct before you list events.',
    },
    {
      title: 'Logo and group name',
      body: 'Update your logo or photo and the name attendees will recognise — this appears on your organiser card and event listings.',
      target: '#ge-logo-zone',
    },
    {
      title: 'Tell people about your group',
      body: 'Check the description matches how you present your group today. Attendees see this when browsing organisers.',
      target: '#ge-description',
    },
    {
      title: 'Contact email',
      body: 'Confirm a contact email so attendees and the Hub team can reach you.',
      target: '#ge-contact-email',
    },
    {
      title: 'Ready for your first event?',
      body: 'When everything looks right, use Save and list my first event — we will walk you through creating a listing next.',
      target: '.ge-actions-stack',
    },
  ];

  var GROUP_STEPS = [
    {
      title: 'Welcome — your organiser page',
      body: 'This is your public page on The Networker Hub. A quick walkthrough of what to fill in before your first event.',
    },
    {
      title: 'Logo and group name',
      body: 'Add a logo or photo and the name attendees will recognise — this appears on your organiser card and event listings.',
      target: '#ge-logo-zone',
    },
    {
      title: 'Tell people about your group',
      body: 'Write a short description of who you serve and the events you run. Attendees see this when browsing organisers.',
      target: '#ge-description',
    },
    {
      title: 'Contact email',
      body: 'Add a contact email so attendees and the Hub team can reach you.',
      target: '#ge-contact-email',
    },
    {
      title: 'Save and list your first event',
      body: 'When you are ready, use Save and create event — we will walk you through listing your first event next.',
      target: '.ge-actions-stack',
    },
  ];

  var EVENT_FORMAT_STEPS = [
    {
      title: 'Create your first event',
      body: 'You have an organiser page — now choose which organiser this listing belongs to and how people will attend.',
    },
    {
      title: 'Pick your organiser',
      body: 'Confirm the organiser page this event is published under. You can run many events under one organiser.',
      target: '.ee-group-pick-card',
    },
    {
      title: 'Choose in person or online',
      body: 'Select the format that matches your event. In-person listings need a venue; online events need a join link for ticket holders.',
      target: '#ee-format-grid',
    },
  ];

  var EVENT_EDIT_STEPS = [
    {
      title: 'Event listing details',
      body: 'Add a clear title, type, and description — this is what people search and filter on when browsing events.',
      target: '#ee-card-details',
    },
    {
      title: 'Location or online access',
      body: 'Fill in the venue and address for in-person events, or the platform and join link for online sessions.',
      target: '#ee-card-location',
    },
    {
      title: 'Pick your date(s)',
      body: 'Select one date for a single event, or click multiple days to create a series — the same start and end times apply to every date.',
      target: '#ee-card-dates',
    },
    {
      title: 'Continue to tickets',
      body: 'Save as draft anytime, or continue to tickets when the listing looks good — pricing and ticket types come next.',
      target: '.ee-card-actions',
    },
  ];

  var EVENT_TICKETS_STEPS = [
    {
      title: 'Set up ticket types',
      body: 'You saved your event dates — now define ticket types. Each tier you add is copied to every date in the series.',
    },
    {
      title: 'Add ticket tiers',
      body: 'Add one row per tier (Standard, Early bird, VIP, etc.). Set price, quantity, and when sales end for each.',
      target: '#ee-panel-tickets',
    },
    {
      title: 'VAT on ticket prices',
      body: 'If you sell paid tickets, choose exactly one option: VAT included in the price, or VAT added at checkout. Not required for free-only events.',
      target: '#ee-vat-card',
    },
    {
      title: 'Refund policy',
      body: 'For paid tickets, pick how refunds work and confirm you understand Stripe Connect handles payouts and refunds.',
      target: '#ee-refund-card',
    },
    {
      title: 'Publish when ready',
      body: 'Save as draft anytime, or publish when ticket types are complete. Paid tickets also need VAT, refund policy, and bank details.',
      target: '.ee-actions',
    },
  ];

  global.HubFlowTour = {
    create: function (options) {
      return new FlowTour(options);
    },
    showQuestionsOnly: showQuestionsOnly,
    openHelp: openHelp,
    closeHelp: closeHelp,
    bindHelpTriggers: bindHelpTriggers,
    startGroupTour: function (opts) {
      opts = opts || {};
      var review = Boolean(opts.onboardReview);
      return new FlowTour({
        storageKey: review ? 'hub_flow_tour_group_review_v1' : 'hub_flow_tour_group_v1',
        steps: review ? GROUP_REVIEW_STEPS : GROUP_STEPS,
        shouldStart:
          opts.shouldStart ||
          function () {
            if (opts.force) return true;
            return !opts.isEdit;
          },
        delay: opts.delay,
      }).startIfNeeded();
    },
    startEventFormatTour: function (opts) {
      opts = opts || {};
      return new FlowTour({
        storageKey: 'hub_flow_tour_event_format_v1',
        steps: EVENT_FORMAT_STEPS,
        shouldStart:
          opts.shouldStart ||
          function () {
            return true;
          },
        delay: opts.delay,
      }).startIfNeeded();
    },
    startEventEditTour: function (opts) {
      opts = opts || {};
      return new FlowTour({
        storageKey: 'hub_flow_tour_event_edit_v1',
        steps: EVENT_EDIT_STEPS,
        shouldStart:
          opts.shouldStart ||
          function () {
            return !opts.isEdit;
          },
        delay: opts.delay,
      }).startIfNeeded();
    },
    startEventTicketsTour: function (opts) {
      opts = opts || {};
      return new FlowTour({
        storageKey: 'hub_flow_tour_event_tickets_v1',
        steps: EVENT_TICKETS_STEPS,
        shouldStart:
          opts.shouldStart ||
          function () {
            return !opts.isEdit;
          },
        delay: opts.delay,
      }).startIfNeeded();
    },
    markEventTourPending: function () {
      try {
        global.sessionStorage.setItem('hub_flow_event_tour_pending', '1');
      } catch (e) {
        /* ignore */
      }
    },
    consumeEventTourPending: function () {
      try {
        var pending = global.sessionStorage.getItem('hub_flow_event_tour_pending') === '1';
        if (pending) global.sessionStorage.removeItem('hub_flow_event_tour_pending');
        return pending;
      } catch (e) {
        return false;
      }
    },
  };

  bindHelpMessageListener();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      bindHelpTriggers('[data-hubert-help]');
    });
  } else {
    bindHelpTriggers('[data-hubert-help]');
  }
})(typeof window !== 'undefined' ? window : globalThis);
