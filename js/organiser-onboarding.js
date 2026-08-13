(function () {
  var TOUR_KEY = 'hub_organiser_tour_v3';
  var CHECKLIST_KEY = 'hub_getting_started_dismissed';
  var PROFILE_REVIEW_KEY = 'hub_organiser_profile_review_v1';
  var READY_EVENT_KEY = 'hub_ready_event_dismissed';
  var RESUME_KEY = 'hub_setup_resume_dismissed';

  function goDashboard() {
    if (window.orgDashSetRoute) window.orgDashSetRoute('dashboard');
  }

  function refreshSetupChrome() {
    if (typeof window.orgDashUpdateSetupResume === 'function') {
      try {
        window.orgDashUpdateSetupResume();
      } catch (e) {
        /* ignore */
      }
    }
  }

  var steps = [
    {
      title: 'Welcome to your organiser workspace',
      body: 'A quick walk through the main areas — where your pages, events, memberships, team, and payouts live. Hubert (bottom right) can answer questions anytime.',
      target: null,
      beforeShow: goDashboard,
    },
    {
      title: 'To-do',
      body: 'Action items land here — applications to approve, payout setup, enquiries, and other alerts. Open anytime from the sidebar so nothing slips through.',
      target: '#org-notifications-panel .org-notifications-panel-sheet',
      beforeShow: function () {
        goDashboard();
        if (typeof window.orgDashOpenNotifications === 'function') {
          window.orgDashOpenNotifications();
        }
      },
    },
    {
      title: 'My events',
      body: 'Your listings live here. Use the tabs — Events, Tickets, Attendees, Cancellations, Reviews, and Revenue — to manage bookings and payouts.',
      target: '#org-page-events .org-page-head',
      beforeShow: function () {
        if (window.orgDashSetRoute) window.orgDashSetRoute('events-list', { skipEventsGuard: true });
      },
    },
    {
      title: 'Organiser pages',
      body: 'Your public group pages live here — edit logo, description, and contact details anytime. Events are published under an organiser page.',
      target: '#org-page-groups .org-page-head',
      beforeShow: function () {
        if (window.orgDashSetRoute) window.orgDashSetRoute('groups', { skipEventsGuard: true });
      },
    },
    {
      title: 'Memberships',
      body: 'Choose an organiser page, add members (or import a spreadsheet), then unlock Reports. Use the list for members-only tickets.',
      target: '#org-page-memberships .org-page-head',
      beforeShow: function () {
        if (window.orgDashSetRoute) window.orgDashSetRoute('memberships', { skipEventsGuard: true });
      },
    },
    {
      title: 'Team & invites',
      body: 'Invite colleagues to help manage events — assign which organiser pages they can access. Only the account owner can change bank details.',
      target: '#org-page-team .org-page-head',
      beforeShow: function () {
        if (window.orgDashSetRoute) window.orgDashSetRoute('team', { skipEventsGuard: true });
      },
    },
    {
      title: 'Promote & share',
      body: 'Make a free LinkedIn post with ready-made words and a picture, or pay for extra visibility on the hub.',
      target: '#org-page-social .org-page-head',
      beforeShow: function () {
        if (window.orgDashSetRoute) window.orgDashSetRoute('social');
      },
    },
    {
      title: 'Revenue & payouts',
      body: 'Connect Stripe before publishing paid tickets. After an event ends and is archived, request your payout from the Revenue tab.',
      target: '#events-tab-revenue',
      beforeShow: function () {
        if (window.orgDashSetRoute) window.orgDashSetRoute('events-revenue', { skipEventsGuard: true });
      },
    },
    {
      title: 'You’re ready — start with My events',
      body: 'Check any listings we prepared, set tickets if needed, then publish. Polish your organiser page under Organiser pages anytime. Ask Hubert if you get stuck.',
      target: '#org-page-events .org-page-head',
      beforeShow: function () {
        if (window.orgDashSetRoute) window.orgDashSetRoute('events-list', { skipEventsGuard: true });
      },
    },
  ];

  function isTourOpen() {
    return Boolean(tourEl && !tourEl.hidden && tourEl.classList.contains('is-open'));
  }

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

  function clearTourDone() {
    try {
      localStorage.removeItem(TOUR_KEY);
    } catch (e) {
      /* ignore */
    }
    tourAutoStarted = false;
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

  function claimOrLaunchOverlayOpen() {
    var ids = ['org-group-claim', 'org-launch-setup', 'org-launch-complete', 'org-ready-event', 'org-opportunity-claim'];
    return ids.some(function (id) {
      var el = document.getElementById(id);
      return Boolean(el && !el.hidden);
    });
  }

  /**
   * Soft-launch claim path: Overview tour runs after claim(s) finish
   * (not after forced page/event re-edit). Call when claim modals are clear.
   */
  function maybeStartOverviewTourAfterClaimSetup(opts) {
    opts = opts || {};
    if (isTourDone() || isTourOpen()) return false;
    if (claimOrLaunchOverlayOpen() && !opts.ignoreOverlays) return false;
    try {
      if (window.hubPendingGroupClaims) return false;
    } catch (e) {
      /* ignore */
    }
    if (
      !opts.skipLaunchQueueCheck &&
      window.HubOrganiserLaunchSetup &&
      typeof window.HubOrganiserLaunchSetup.progressSummary === 'function' &&
      typeof window.orgDashLaunchSetupInput === 'function'
    ) {
      try {
        var progress = window.HubOrganiserLaunchSetup.progressSummary(
          window.orgDashLaunchSetupInput()
        );
        if (progress && !progress.dismissed && progress.remaining > 0) return false;
      } catch (e) {
        /* ignore */
      }
    }
    tourAutoStarted = true;
    if (window.orgDashSetRoute) {
      try {
        window.orgDashSetRoute('dashboard', { skipEventsGuard: true, skipRouteLoading: true });
      } catch (e) {
        /* ignore */
      }
    }
    window.setTimeout(showTour, opts.delay != null ? opts.delay : 450);
    return true;
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

  function clearProfileReviewDone() {
    try {
      localStorage.removeItem(PROFILE_REVIEW_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function clearReadyEventDismissed() {
    try {
      localStorage.removeItem(READY_EVENT_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function clearResumeDismissed() {
    try {
      localStorage.removeItem(RESUME_KEY);
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
    // Claim always wins over the workspace tour (Email 2 / pending invites).
    try {
      if (window.hubPendingGroupClaims) return false;
    } catch (e) {
      /* ignore */
    }
    var params = new URLSearchParams(window.location.search);
    if (params.get('onboard') === 'claim') return false;
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
    if (typeof window.orgDashCloseNotifications === 'function') {
      try {
        window.orgDashCloseNotifications();
      } catch (e) {
        /* ignore */
      }
    }
    refreshSetupChrome();
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

    // Allow route/panel paint before measuring the spotlight target.
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        if (!isTourOpen()) return;
        var current = steps[stepIndex];
        var target = current && current.target ? document.querySelector(current.target) : null;
        if (target) {
          target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
          positionSpotlight(target);
        } else {
          clearSpotlight();
        }
      });
    });
  }

  function clearForcedReviewForTour() {
    // Workspace tour replaces forced profile/event re-edit — clear leftover review queues.
    markProfileReviewDone();
    try {
      if (window.HubOrganiserLaunchSetup && window.HubOrganiserLaunchSetup.dismiss) {
        window.HubOrganiserLaunchSetup.dismiss();
      }
    } catch (e) {
      /* ignore */
    }
  }

  function showTour() {
    if (!tourEl) return;
    clearForcedReviewForTour();
    stepIndex = 0;
    tourEl.hidden = false;
    tourEl.classList.add('is-open');
    document.body.classList.add('org-onboard-active');
    refreshSetupChrome();
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
        if (action === 'share') {
          if (window.orgDashOpenShareEvent) window.orgDashOpenShareEvent();
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
    var claimOnboard = params.get('onboard') === 'claim';
    var hasPendingClaims = Boolean(window.hubPendingGroupClaims);
    if ((claimOnboard || hasPendingClaims) && window.orgDashOpenClaimModal) {
      // Defer Overview tour until claim(s) finish — then walk through each page.
      // Do not mark the tour done — soft-launch claim used to skip it forever.
      if (claimOnboard) clearTourDone();
      window.orgDashOpenClaimModal();
      if (window.orgDashHandleClaimOnboardMismatch) {
        window.orgDashHandleClaimOnboardMismatch();
      }
      return;
    }
    if (!tourAutoStarted && shouldAutoStart()) {
      tourAutoStarted = true;
      window.setTimeout(showTour, 400);
    }
  }

  window.HubOrganiserOnboarding = {
    initAfterDashboardReady: initAfterDashboardReady,
    showTour: showTour,
    markTourDone: markTourDone,
    clearTourDone: clearTourDone,
    isTourDone: isTourDone,
    isTourOpen: isTourOpen,
    maybeStartOverviewTourAfterClaimSetup: maybeStartOverviewTourAfterClaimSetup,
    shouldDeferGroupClaim: shouldDeferGroupClaim,
    setAfterTourStep: function (fn) {
      afterTourStep = fn;
    },
    isProfileReviewDone: isProfileReviewDone,
    markProfileReviewDone: markProfileReviewDone,
    clearProfileReviewDone: clearProfileReviewDone,
    clearReadyEventDismissed: clearReadyEventDismissed,
    clearResumeDismissed: clearResumeDismissed,
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
