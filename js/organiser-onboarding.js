(function () {
  var TOUR_KEY = 'hub_organiser_tour_v1';
  var CHECKLIST_KEY = 'hub_getting_started_dismissed';
  var PROFILE_REVIEW_KEY = 'hub_organiser_profile_review_v1';
  var READY_EVENT_KEY = 'hub_ready_event_dismissed';

  var steps = [
    {
      title: 'Welcome to your organiser dashboard',
      body: 'This is your home for group profiles, events, tickets, and Academy sessions. We\'ll show you the essentials in a quick tour.',
      target: null,
    },
    {
      title: 'Navigate from the sidebar',
      body: 'Use the sidebar to jump between Overview, My events (group profiles, listings, tickets), and more. On mobile, swipe the menu bar horizontally.',
      target: '.org-sidebar',
    },
    {
      title: 'Add something new',
      body: 'Tap + Add new to create a group profile, list an event, or (soon) publish an Academy workshop or seminar.',
      target: '#org-add-menu-wrap',
    },
    {
      title: 'Invite your team',
      body: 'Open Team & invites in the sidebar — or use the quick link on Overview — to add editors who can help manage events. When you finish the tour, we will confirm your group profile next.',
      target: '[data-org-route="team"]',
      afterShow: function () {
        if (typeof window.orgDashSetRoute === 'function') {
          window.orgDashSetRoute('dashboard');
        }
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

  function shouldDeferGroupClaim() {
    return shouldAutoStart() && !isTourDone();
  }

  function shouldAutoStart() {
    if (isTourDone()) return false;
    var params = new URLSearchParams(window.location.search);
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
      });
    }

    var hubertBtn = document.getElementById('org-open-hubert');
    if (hubertBtn) {
      hubertBtn.addEventListener('click', function () {
        if (window.HubertWidget && window.HubertWidget.open) {
          window.HubertWidget.open();
        }
      });
    }

    panel.querySelectorAll('[data-org-getting-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-org-getting-action');
        if (action === 'group') {
          window.location.href = 'group-edit.html';
          return;
        }
        if (action === 'event') {
          window.location.href = 'event-format.html';
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
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindTourUi);
  } else {
    bindTourUi();
  }
})();
