(function () {
  var TOUR_KEY = 'hub_organiser_tour_v2';
  var CHECKLIST_KEY = 'hub_getting_started_dismissed';
  var PROFILE_REVIEW_KEY = 'hub_organiser_profile_review_v1';
  var READY_EVENT_KEY = 'hub_ready_event_dismissed';
  var RESUME_KEY = 'hub_setup_resume_dismissed';

  var steps = [
    {
      title: 'Welcome to your organiser workspace',
      body: 'Two steps to go live: confirm your organiser page, then list your first event. We\'ll highlight your checklist — Hubert can answer questions anytime.',
      target: null,
    },
    {
      title: 'Start from Overview',
      body: 'Use the shortcuts below for events, business opportunities, and member lists. New organisers: follow the setup checklist when it appears.',
      target: '.org-hub-portals',
    },
    {
      title: 'My events',
      body: 'Open My events in the sidebar, then use the tabs — Events, Tickets, Attendees, Reviews, Revenue — to switch sections.',
      target: '#org-events-subnav',
      beforeShow: function () {
        if (window.orgDashSetRoute) window.orgDashSetRoute('events-list');
      },
    },
    {
      title: 'Revenue & payouts',
      body: 'Set up Stripe bank details before publishing paid tickets. After an event ends and is archived, request your payout from the Revenue tab.',
      target: '#events-tab-revenue',
      beforeShow: function () {
        if (window.orgDashSetRoute) window.orgDashSetRoute('events-revenue');
      },
    },
  ];

  var tourAutoStarted = false;
  var gettingStartedBound = false;
  var afterTourStep = null;
  var tourEl;
  var popoverEl;
  var stepIndex = 0;
  var spotlightEl;

  function isTourDone() {
    try {
      return localStorage.getItem(TOUR_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function markTourDone() {
    try {
      localStorage.setItem(TOUR_KEY, '1');
    } catch (e) {
      /* ignore */
    }
    hideTour();
    if (afterTourStep) afterTourStep();
  }

  function isProfileReviewDone() {
    try {
      return localStorage.getItem(PROFILE_REVIEW_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function markProfileReviewDone() {
    try {
      localStorage.setItem(PROFILE_REVIEW_KEY, '1');
    } catch (e) {
      /* ignore */
    }
  }

  function isReadyEventDismissed() {
    try {
      return localStorage.getItem(READY_EVENT_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function markReadyEventDismissed() {
    try {
      localStorage.setItem(READY_EVENT_KEY, '1');
    } catch (e) {
      /* ignore */
    }
  }

  function isResumeDismissed() {
    try {
      return localStorage.getItem(RESUME_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function markResumeDismissed() {
    try {
      localStorage.setItem(RESUME_KEY, '1');
    } catch (e) {
      /* ignore */
    }
  }

  function shouldDeferGroupClaim() {
    return shouldAutoStart() && !isTourDone();
  }

  function shouldAutoStart() {
    if (isTourDone()) return false;
    var params = new URLSearchParams(window.location.search);
    if (params.get('onboard') === 'claim') return false;
    return params.get('onboard') === '1' || !isTourDone();
  }

  function hideTour() {
    if (!tourEl) return;
    tourEl.hidden = true;
    tourEl.classList.remove('is-open');
    document.body.classList.remove('org-onboard-active');
    clearSpotlight();
  }

  function clearSpotlight() {
    if (spotlightEl) spotlightEl.style.cssText = '';
  }

  function positionSpotlight(el) {
    if (!spotlightEl || !el) {
      clearSpotlight();
      return;
    }
    var rect = el.getBoundingClientRect();
    var pad = 8;
    spotlightEl.style.top = rect.top - pad + 'px';
    spotlightEl.style.left = rect.left - pad + 'px';
    spotlightEl.style.width = rect.width + pad * 2 + 'px';
    spotlightEl.style.height = rect.height + pad * 2 + 'px';
  }

  function renderStep() {
    var step = steps[stepIndex];
    if (!step || !popoverEl) return;

    if (step.afterShow) step.afterShow();

    var stepLabel = popoverEl.querySelector('.org-onboard-step');
    var titleEl = popoverEl.querySelector('.org-onboard-title');
    var bodyEl = popoverEl.querySelector('.org-onboard-body');
    var nextBtn = popoverEl.querySelector('[data-onboard-next]');

    if (step.beforeShow) step.beforeShow();

    if (stepLabel) stepLabel.textContent = stepIndex + 1 + ' of ' + steps.length;
    if (titleEl) titleEl.textContent = step.title;
    if (bodyEl) bodyEl.textContent = step.body;
    if (nextBtn) nextBtn.textContent = stepIndex >= steps.length - 1 ? 'Finish tour' : 'Next';

    var target = step.target ? document.querySelector(step.target) : null;
    if (target) {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      positionSpotlight(target);
    } else {
      clearSpotlight();
    }
  }

  function showTour() {
    if (!tourEl) return;
    stepIndex = 0;
    tourEl.hidden = false;
    tourEl.classList.add('is-open');
    document.body.classList.add('org-onboard-active');
    renderStep();
  }

  function nextStep() {
    if (stepIndex >= steps.length - 1) {
      markTourDone();
      return;
    }
    stepIndex += 1;
    renderStep();
  }

  function bindTourUi() {
    tourEl = document.getElementById('org-onboard-tour');
    if (!tourEl) return;
    popoverEl = tourEl.querySelector('.org-onboard-popover');
    spotlightEl = tourEl.querySelector('.org-onboard-spotlight');

    tourEl.querySelectorAll('[data-onboard-skip]').forEach(function (btn) {
      btn.addEventListener('click', markTourDone);
    });
    var nextBtn = tourEl.querySelector('[data-onboard-next]');
    if (nextBtn) nextBtn.addEventListener('click', nextStep);

    var restartBtn = document.getElementById('org-start-tour');
    if (restartBtn) {
      restartBtn.addEventListener('click', function () {
        try {
          localStorage.removeItem(TOUR_KEY);
        } catch (e) {
          /* ignore */
        }
        showTour();
      });
    }

    window.addEventListener('resize', function () {
      if (!tourEl || tourEl.hidden) return;
      var step = steps[stepIndex];
      var target = step && step.target ? document.querySelector(step.target) : null;
      positionSpotlight(target);
    });
  }

  function bindGettingStarted() {
    if (gettingStartedBound) return;
    gettingStartedBound = true;
    var panel = document.getElementById('org-getting-started');
    if (!panel) return;

    try {
      if (localStorage.getItem(CHECKLIST_KEY) === '1') {
        panel.hidden = true;
        return;
      }
    } catch (e) {
      /* ignore */
    }

    var dismiss = document.getElementById('org-getting-started-dismiss');
    if (dismiss) {
      dismiss.addEventListener('click', function () {
        panel.hidden = true;
        try {
          localStorage.setItem(CHECKLIST_KEY, '1');
        } catch (e) {
          /* ignore */
        }
        if (window.orgDashUpdateSetupResume) window.orgDashUpdateSetupResume();
      });
    }

    var hubertBtn = document.getElementById('org-open-hubert');
    if (hubertBtn) {
      hubertBtn.addEventListener('click', function () {
        if (window.HubFlowTour && window.HubFlowTour.openHelp) {
          window.HubFlowTour.openHelp();
        } else if (window.HubertWidget && window.HubertWidget.open) {
          window.HubertWidget.open();
        }
      });
    }

    panel.querySelectorAll('[data-org-getting-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-org-getting-action');
        if (action === 'group') {
          window.location.href = '/organiser/group-edit';
          return;
        }
        if (action === 'memberships' && typeof window.orgDashSetRoute === 'function') {
          window.orgDashSetRoute('memberships');
          return;
        }
        if (action === 'event' && typeof window.orgDashSetRoute === 'function') {
          window.orgDashSetRoute('events-list');
          return;
        }
        if (action === 'team' && typeof window.orgDashSetRoute === 'function') {
          window.orgDashSetRoute('team');
        }
      });
    });
  }

  function initAfterDashboardReady() {
    bindGettingStarted();
    var params = new URLSearchParams(window.location.search);
    if (params.get('onboard') === 'claim' && window.orgDashOpenClaimModal) {
      markTourDone();
      window.orgDashOpenClaimModal();
      return;
    }
    if (!tourAutoStarted && shouldAutoStart()) {
      tourAutoStarted = true;
      window.setTimeout(showTour, 400);
    } else if (isTourDone() && afterTourStep) {
      afterTourStep();
    }
  }

  window.HubOrganiserOnboarding = {
    initAfterDashboardReady: initAfterDashboardReady,
    showTour: showTour,
    markTourDone: markTourDone,
    isTourDone: isTourDone,
    shouldDeferGroupClaim: shouldDeferGroupClaim,
    setAfterTourStep: function (fn) {
      afterTourStep = fn;
    },
    isProfileReviewDone: isProfileReviewDone,
    markProfileReviewDone: markProfileReviewDone,
    isReadyEventDismissed: isReadyEventDismissed,
    markReadyEventDismissed: markReadyEventDismissed,
    isResumeDismissed: isResumeDismissed,
    markResumeDismissed: markResumeDismissed,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindTourUi);
  } else {
    bindTourUi();
  }
})();
