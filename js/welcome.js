(function () {
  var WELCOME_DONE_KEY = 'hub_welcome_completed';
  var pendingDestination = '/events/';
  var pendingOrganiserAction = null;
  var cachedProfile = null;
  var profileComplete = false;

  function markWelcomeDone() {
    try {
      localStorage.setItem(WELCOME_DONE_KEY, '1');
    } catch (e) {
      /* ignore */
    }
  }

  function isWelcomeDone() {
    try {
      return localStorage.getItem(WELCOME_DONE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function pathForChoice(key) {
    if (key === 'find-event') return '/events/';
    if (key === 'find-opportunity') return '/opportunities/';
    if (key === 'account') return '/account/';
    if (key === 'list-event') return '/organiser/enable';
    if (key === 'list-opportunity') return '/organiser/enable';
    return '/events/';
  }

  function showMessage(msg, kind) {
    var el = document.getElementById('welcome-profile-message');
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'auth-message';
      return;
    }
    el.hidden = false;
    el.textContent = msg;
    el.className = 'auth-message auth-message--' + (kind || 'error');
  }

  function setWizardStep(step) {
    var s2 = document.getElementById('welcome-wizard-step-2');
    var s3 = document.getElementById('welcome-wizard-step-3');
    if (s2) {
      s2.classList.toggle('is-current', step === 2);
      s2.classList.toggle('is-done', step > 2);
      s2.setAttribute('aria-current', step === 2 ? 'step' : 'false');
    }
    if (s3) {
      s3.classList.toggle('is-current', step === 3);
      s3.classList.toggle('is-done', step > 3);
      s3.setAttribute('aria-current', step === 3 ? 'step' : 'false');
    }
  }

  function showProfileStep() {
    var pathPanel = document.getElementById('welcome-step-path');
    var profilePanel = document.getElementById('welcome-step-profile');
    if (pathPanel) pathPanel.hidden = true;
    if (profilePanel) profilePanel.hidden = false;
    setWizardStep(3);
    showMessage('', '');
    var industry = document.getElementById('welcome-profile-industry');
    if (window.HubProfileIndustries && industry) {
      window.HubProfileIndustries.fillIndustrySelect(
        industry,
        cachedProfile && cachedProfile.businessSector
      );
    }
    var jobTitle = document.getElementById('welcome-profile-job-title');
    var company = document.getElementById('welcome-profile-company');
    if (jobTitle && cachedProfile && cachedProfile.jobTitle) jobTitle.value = cachedProfile.jobTitle;
    if (company && cachedProfile && cachedProfile.company) company.value = cachedProfile.company;
    if (industry) industry.focus();
  }

  function finishAndGo() {
    markWelcomeDone();
    if (pendingOrganiserAction === 'list-event') {
      if (window.HubOrganiserActions && window.HubOrganiserActions.goToAddEvent) {
        window.HubOrganiserActions.goToAddEvent();
        return;
      }
    } else if (pendingOrganiserAction === 'list-opportunity') {
      if (window.HubOrganiserActions && window.HubOrganiserActions.goToAddOpportunity) {
        window.HubOrganiserActions.goToAddOpportunity();
        return;
      }
    }
    window.location.href = pendingDestination;
  }

  function proceedAfterPathChoice(key) {
    pendingOrganiserAction = null;
    pendingDestination = pathForChoice(key);
    if (key === 'list-event') pendingOrganiserAction = 'list-event';
    if (key === 'list-opportunity') pendingOrganiserAction = 'list-opportunity';

    if (profileComplete) {
      finishAndGo();
      return;
    }
    showProfileStep();
  }

  function personalizeWelcome(user) {
    var nameEl = document.getElementById('welcome-user-name');
    if (!nameEl || !user) return;
    var name = user.name && String(user.name).trim();
    nameEl.textContent = name || 'there';
  }

  async function ensureSignedIn() {
    try {
      var res = await fetch('/api/auth/session', { credentials: 'include' });
      var data = await res.json();
      if (!data.ok || !data.user) {
        window.location.href = '/register';
        return null;
      }
      if (isWelcomeDone()) {
        window.location.href = '/events/';
        return null;
      }
      personalizeWelcome(data.user);

      if (window.HubProfileCompletion) {
        var profileRes = await window.HubProfileCompletion.fetchProfile(false);
        if (profileRes.ok && profileRes.profile) {
          cachedProfile = profileRes.profile;
          profileComplete = window.HubProfileCompletion.isComplete(profileRes.profile);
        }
      }

      var industry = document.getElementById('welcome-profile-industry');
      if (window.HubProfileIndustries && industry) {
        window.HubProfileIndustries.fillIndustrySelect(industry, cachedProfile && cachedProfile.businessSector);
      }

      return data;
    } catch (e) {
      window.location.href = '/register';
      return null;
    }
  }

  document.querySelectorAll('[data-welcome-path]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      proceedAfterPathChoice(btn.getAttribute('data-welcome-path') || 'find-event');
    });
  });

  var profileForm = document.getElementById('welcome-profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var industry = document.getElementById('welcome-profile-industry');
      var jobTitle = document.getElementById('welcome-profile-job-title');
      var company = document.getElementById('welcome-profile-company');
      var submitBtn = document.getElementById('welcome-profile-submit');
      var err = window.HubProfileCompletion
        ? window.HubProfileCompletion.validateProfileForm(
            industry && industry.value,
            jobTitle && jobTitle.value
          )
        : '';
      if (err) {
        showMessage(err, 'error');
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      showMessage('Saving…', 'success');
      window.HubProfileCompletion
        .saveProfileFields({
          businessSector: industry ? industry.value : '',
          jobTitle: jobTitle ? jobTitle.value.trim() : '',
          company: company ? company.value.trim() : '',
        })
        .then(function (result) {
          if (!result.ok) {
            showMessage(result.message || 'Could not save your details.', 'error');
            if (submitBtn) submitBtn.disabled = false;
            return;
          }
          profileComplete = true;
          finishAndGo();
        })
        .catch(function () {
          showMessage('Could not reach the server. Try again.', 'error');
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  var skipProfile = document.getElementById('welcome-profile-skip');
  if (skipProfile) {
    skipProfile.addEventListener('click', function () {
      finishAndGo();
    });
  }

  ensureSignedIn();
})();
