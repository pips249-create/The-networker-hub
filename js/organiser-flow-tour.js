/**
 * Step-by-step walkthrough for first group profile and first event listing.
 */
(function (global) {
  function ensureShell() {
    var existing = document.getElementById('hub-flow-tour');
    if (existing) return existing;

    var root = document.createElement('div');
    root.id = 'hub-flow-tour';
    root.className = 'hub-flow-tour';
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="hub-flow-tour-backdrop" data-flow-tour-skip></div>' +
      '<div class="hub-flow-tour-spotlight" aria-hidden="true"></div>' +
      '<div class="hub-flow-tour-popover" role="dialog" aria-modal="true" aria-labelledby="hub-flow-tour-title">' +
      '<p class="hub-flow-tour-step">1 of 1</p>' +
      '<h2 class="hub-flow-tour-title" id="hub-flow-tour-title">Welcome</h2>' +
      '<p class="hub-flow-tour-body"></p>' +
      '<div class="hub-flow-tour-actions">' +
      '<button type="button" class="ee-btn ee-btn-outline" data-flow-tour-skip>Skip</button>' +
      '<button type="button" class="ee-btn ee-btn-gold" data-flow-tour-next>Next</button>' +
      '</div></div>';
    document.body.appendChild(root);
    return root;
  }

  function FlowTour(options) {
    this.storageKey = options.storageKey;
    this.steps = options.steps || [];
    this.shouldStart = options.shouldStart || function () {
      return true;
    };
    this.delay = options.delay == null ? 0 : options.delay;
    this.started = false;
    this.stepIndex = 0;
    this.root = null;
    this.popover = null;
    this.spotlight = null;
  }

  FlowTour.prototype.isDone = function () {
    try {
      return global.localStorage.getItem(this.storageKey) === '1';
    } catch (e) {
      return false;
    }
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
    if (!this.root) return;
    this.root.hidden = true;
    this.root.classList.remove('is-open');
    this.root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('hub-flow-tour-active');
    this.clearSpotlight();
  };

  FlowTour.prototype.clearSpotlight = function () {
    if (this.spotlight) this.spotlight.style.cssText = '';
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
    if (!step || !this.popover) return;

    if (typeof step.afterShow === 'function') step.afterShow();

    var stepLabel = this.popover.querySelector('.hub-flow-tour-step');
    var titleEl = this.popover.querySelector('.hub-flow-tour-title');
    var bodyEl = this.popover.querySelector('.hub-flow-tour-body');
    var nextBtn = this.popover.querySelector('[data-flow-tour-next]');

    if (stepLabel) {
      stepLabel.textContent = this.stepIndex + 1 + ' of ' + this.steps.length;
    }
    if (titleEl) titleEl.textContent = step.title || '';
    if (bodyEl) bodyEl.textContent = step.body || '';
    if (nextBtn) {
      nextBtn.textContent = this.stepIndex >= this.steps.length - 1 ? 'Got it' : 'Next';
    }

    var target = step.target ? document.querySelector(step.target) : null;
    if (target) {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      this.positionSpotlight(target);
    } else {
      this.clearSpotlight();
    }
  };

  FlowTour.prototype.show = function () {
    this.root = ensureShell();
    this.popover = this.root.querySelector('.hub-flow-tour-popover');
    this.spotlight = this.root.querySelector('.hub-flow-tour-spotlight');
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
        if (!self.root || self.root.hidden) return;
        var step = self.steps[self.stepIndex];
        var target = step && step.target ? document.querySelector(step.target) : null;
        self.positionSpotlight(target);
      });
    }

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

  var GROUP_STEPS = [
    {
      title: 'Welcome — your group profile',
      body: 'This is your public organiser page on The Networker Hub. A quick walkthrough of what to fill in before your first event.',
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
      title: 'Industries and contact',
      body: 'Pick the industries you serve, then confirm a contact email so attendees and the Hub team can reach you.',
      target: '#ge-industries',
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
      body: 'You have a group profile — now choose which group this listing belongs to and how people will attend.',
    },
    {
      title: 'Pick your group',
      body: 'Confirm the group profile this event is published under. You can run many events under one group.',
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
      body: 'Tap days on the calendar to add dates, then set start and end times. You can select multiple dates for a series.',
      target: '#ee-card-dates',
    },
    {
      title: 'Continue to tickets',
      body: 'Save as draft anytime, or continue to tickets when the listing looks good — pricing and ticket types come next.',
      target: '.ee-card-actions',
    },
  ];

  global.HubFlowTour = {
    create: function (options) {
      return new FlowTour(options);
    },
    startGroupTour: function (opts) {
      opts = opts || {};
      return new FlowTour({
        storageKey: 'hub_flow_tour_group_v1',
        steps: GROUP_STEPS,
        shouldStart: opts.shouldStart || function () {
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
        shouldStart: opts.shouldStart || function () {
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
        shouldStart: opts.shouldStart || function () {
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
})(typeof window !== 'undefined' ? window : globalThis);
