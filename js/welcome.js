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

  function industryEls() {
    return {
      select: document.getElementById('welcome-profile-industry'),
      otherField: document.getElementById('welcome-profile-industry-other-field'),
      otherInput: document.getElementById('welcome-profile-industry-other'),
    };
  }

  function bindWelcomeIndustryOther() {
    var els = industryEls();
    if (!window.HubProfileIndustries || !els.select) return;
    window.HubProfileIndustries.bindIndustryOther(els.select, els.otherField, els.otherInput, {
      required: true,
    });
  }

  function applyWelcomeIndustry(selectedValue) {
    var els = industryEls();
    if (!window.HubProfileIndustries || !els.select) return;
    bindWelcomeIndustryOther();
    window.HubProfileIndustries.applyIndustrySelection(
      els.select,
      els.otherField,
      els.otherInput,
      selectedValue,
      { required: true }
    );
  }

  function resolvedWelcomeIndustry() {
    var els = industryEls();
    if (window.HubProfileIndustries && window.HubProfileIndustries.resolveIndustryValue) {
      return window.HubProfileIndustries.resolveIndustryValue(els.select, els.otherInput);
    }
    return els.select ? els.select.value : '';
  }

  function fillHomeRegionSelect(selectedSlug) {
    var select = document.getElementById('welcome-profile-home-region');
    var regions = window.HUB_NETWORKING_REGIONS;
    if (!select || !regions) return;

    var groups = {
      london: { label: 'London areas', slugs: [] },
      city: { label: 'Cities', slugs: [] },
      county: { label: 'Counties', slugs: [] },
    };

    Object.keys(regions).forEach(function (slug) {
      var meta = regions[slug];
      if (!meta) return;
      if (meta.areaType === 'London area') groups.london.slugs.push(slug);
      else if (meta.areaType === 'county') {
        /* Counties come from HUB_UK_PROFILE_COUNTY_GROUPS below */
      } else groups.city.slugs.push(slug);
    });

    function sortSlugs(slugs) {
      return slugs.sort(function (a, b) {
        return String(regions[a].name).localeCompare(String(regions[b].name));
      });
    }

    var html = '<option value="">Select your area</option>';
    ['london', 'city'].forEach(function (key) {
      var slugs = sortSlugs(groups[key].slugs);
      if (!slugs.length) return;
      html += '<optgroup label="' + groups[key].label.replace(/"/g, '&quot;') + '">';
      slugs.forEach(function (slug) {
        var name = regions[slug].name;
        var sel = slug === selectedSlug ? ' selected' : '';
        html +=
          '<option value="' +
          slug.replace(/"/g, '&quot;') +
          '"' +
          sel +
          '>' +
          name.replace(/</g, '&lt;') +
          '</option>';
      });
      html += '</optgroup>';
    });

    var countyGroups = window.HUB_UK_PROFILE_COUNTY_GROUPS || [];
    countyGroups.forEach(function (group) {
      var names = (group.names || []).slice().sort(function (a, b) {
        return String(a).localeCompare(String(b));
      });
      if (!names.length) return;
      html += '<optgroup label="' + String(group.nation || 'Counties').replace(/"/g, '&quot;') + '">';
      names.forEach(function (name) {
        var slug = String(name || '')
          .trim()
          .toLowerCase()
          .replace(/['’]/g, '')
          .replace(/&/g, 'and')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        var sel = slug === selectedSlug ? ' selected' : '';
        html +=
          '<option value="' +
          slug.replace(/"/g, '&quot;') +
          '"' +
          sel +
          '>' +
          String(name).replace(/</g, '&lt;') +
          '</option>';
      });
      html += '</optgroup>';
    });

    select.innerHTML = html;
  }

  function resolvedHomeRegionSlug(profile) {
    if (profile && profile.homeRegionSlug) return String(profile.homeRegionSlug).trim();
    if (window.HUB_resolveNetworkingRegionSlug && profile && profile.location) {
      var fromNetworking = window.HUB_resolveNetworkingRegionSlug(profile.location) || '';
      if (fromNetworking) return fromNetworking;
    }
    if (window.HUB_getProfileCounty && profile && profile.location) {
      var slugify = function (name) {
        return String(name || '')
          .trim()
          .toLowerCase()
          .replace(/['’]/g, '')
          .replace(/&/g, 'and')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      };
      var want = slugify(profile.location);
      if (window.HUB_getProfileCounty(want)) return want;
    }
    return '';
  }

  function showProfileStep() {
    var pathPanel = document.getElementById('welcome-step-path');
    var profilePanel = document.getElementById('welcome-step-profile');
    if (pathPanel) pathPanel.hidden = true;
    if (profilePanel) profilePanel.hidden = false;
    setWizardStep(3);
    showMessage('', '');
    fillHomeRegionSelect(resolvedHomeRegionSlug(cachedProfile));
    applyWelcomeIndustry(cachedProfile && cachedProfile.businessSector);
    var homeRegion = document.getElementById('welcome-profile-home-region');
    var industry = document.getElementById('welcome-profile-industry');
    var jobTitle = document.getElementById('welcome-profile-job-title');
    var company = document.getElementById('welcome-profile-company');
    if (jobTitle && cachedProfile && cachedProfile.jobTitle) jobTitle.value = cachedProfile.jobTitle;
    if (company && cachedProfile && cachedProfile.company) company.value = cachedProfile.company;
    if (homeRegion) homeRegion.focus();
    else if (industry) industry.focus();
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

  async function loadProfileState() {
    if (!window.HubProfileCompletion) return;
    var profileRes = await window.HubProfileCompletion.fetchProfile(false);
    if (profileRes.ok && profileRes.profile) {
      cachedProfile = profileRes.profile;
      profileComplete = window.HubProfileCompletion.isComplete(profileRes.profile);
    }
  }

  async function ensureSignedIn() {
    try {
      var res = await fetch('/api/auth/session', { credentials: 'include' });
      var data = await res.json();
      if (!data.ok || !data.user) {
        window.location.href = '/register';
        return null;
      }

      personalizeWelcome(data.user);
      await loadProfileState();

      if (profileComplete) {
        if (!isWelcomeDone()) markWelcomeDone();
        window.location.href = '/events/';
        return null;
      }

      if (isWelcomeDone()) {
        pendingDestination = '/events/';
        showProfileStep();
        var s2 = document.getElementById('welcome-wizard-step-2');
        if (s2) {
          s2.classList.add('is-done');
          s2.classList.remove('is-current');
        }
        return data;
      }

      applyWelcomeIndustry(cachedProfile && cachedProfile.businessSector);
      fillHomeRegionSelect(resolvedHomeRegionSlug(cachedProfile));

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
    bindWelcomeIndustryOther();
    profileForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var industryValue = resolvedWelcomeIndustry();
      var homeRegion = document.getElementById('welcome-profile-home-region');
      var jobTitle = document.getElementById('welcome-profile-job-title');
      var company = document.getElementById('welcome-profile-company');
      var submitBtn = document.getElementById('welcome-profile-submit');
      var err = window.HubProfileCompletion
        ? window.HubProfileCompletion.validateProfileForm(
            industryValue,
            jobTitle && jobTitle.value,
            homeRegion && homeRegion.value
          )
        : '';
      if (err) {
        showMessage(err, 'error');
        if (!homeRegion || !homeRegion.value) {
          homeRegion && homeRegion.focus();
        } else if (document.getElementById('welcome-profile-industry')?.value === 'Other') {
          document.getElementById('welcome-profile-industry-other')?.focus();
        }
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      showMessage('Saving…', 'success');
      window.HubProfileCompletion
        .saveProfileFields({
          homeRegionSlug: homeRegion ? homeRegion.value.trim() : '',
          businessSector: industryValue,
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
