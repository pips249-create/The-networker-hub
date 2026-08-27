/**
 * Account settings — /api/auth/profile
 */
(function () {
  const signin = document.getElementById('as-signin');
  const main = document.getElementById('as-main');
  const alertEl = document.getElementById('as-alert');

  function showAlert(msg, ok) {
    if (!alertEl) return;
    alertEl.hidden = false;
    alertEl.textContent = msg;
    alertEl.className = 'as-alert ' + (ok ? 'is-ok' : 'is-error');
  }

  function hideAlert() {
    if (alertEl) alertEl.hidden = true;
  }

  function setFieldWritable(id, enabled) {
    const el = document.getElementById(id);
    if (!el) return;
    const field = el.closest('.as-field');
    if (field) field.hidden = !enabled;
    if (el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      el.disabled = !enabled;
    }
  }

  function setReviewNameWritable(enabled) {
    const field = document.getElementById('as-review-name-field');
    if (field) field.hidden = !enabled;
    document.querySelectorAll('input[name="reviewNameMode"]').forEach((input) => {
      input.disabled = !enabled;
    });
  }

  function applyWritable(writable) {
    const w = writable || {};
    setFieldWritable('as-name', w.name !== false);
    setReviewNameWritable(w.publicReviewName !== false);
    // Default on so fields stay visible even if an older API omits these flags.
    setFieldWritable('as-company', w.company !== false);
    setFieldWritable('as-job-title', w.jobTitle !== false);
    setFieldWritable('as-industry', w.businessSector !== false);
    setFieldWritable('as-professional-role', w.professionalRole !== false);
    setFieldWritable('as-location', w.location !== false);
  }

  function scrollAlertIntoView() {
    if (alertEl) alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function setFieldValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? '';
  }

  function fillReviewNameMode(profile) {
    const mode = profile.reviewNameMode === 'anonymous' ? 'anonymous' : 'name';
    const nameRadio = document.getElementById('as-review-name-mode-name');
    const anonRadio = document.getElementById('as-review-name-mode-anonymous');
    if (nameRadio) nameRadio.checked = mode === 'name';
    if (anonRadio) anonRadio.checked = mode === 'anonymous';
    const example = document.getElementById('as-review-name-example');
    if (example) {
      example.textContent = profile.reviewNameExample
        ? 'e.g. ' + profile.reviewNameExample
        : 'e.g. Alex M.';
    }
    const alias = document.getElementById('as-networker-alias');
    if (alias) {
      alias.textContent = profile.networkerAlias || 'Networker ####';
    }
  }

  function selectedReviewNameMode() {
    const checked = document.querySelector('input[name="reviewNameMode"]:checked');
    return checked && checked.value === 'anonymous' ? 'anonymous' : 'name';
  }

  function fillForm(profile) {
    setFieldValue('as-email', profile.email || '');
    setFieldValue('as-name', profile.name || '');
    fillReviewNameMode(profile);
    setFieldValue('as-company', profile.company || '');
    setFieldValue('as-job-title', profile.jobTitle || '');
    setFieldValue('as-industry', profile.businessSector || '');
    setFieldValue('as-professional-role', profile.professionalRole || '');
    setFieldValue('as-location', profile.location || '');
    fillEmailPrefs(profile);
    rememberProfileBaseline();
  }

  function fillEmailPrefs(profile) {
    const master = document.getElementById('as-email-master');
    const reminders = document.getElementById('as-email-reminders');
    const organiserAlerts = document.getElementById('as-email-organiser-alerts');
    const organiserRoundups = document.getElementById('as-email-organiser-roundups');
    if (master) master.checked = profile.emailsEnabled === true;
    if (reminders) reminders.checked = profile.emailPrefEventReminders !== false;
    if (organiserAlerts) organiserAlerts.checked = profile.emailPrefOrganiserAlerts !== false;
    if (organiserRoundups) organiserRoundups.checked = profile.emailPrefOrganiserRoundups !== false;
    syncEmailPrefDisabled();
  }

  function syncEmailPrefDisabled() {
    const master = document.getElementById('as-email-master');
    const disabled = master ? !master.checked : false;
    ['as-email-reminders', 'as-email-organiser-alerts'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.disabled = disabled;
      if (disabled) el.checked = false;
    });
  }

  async function loadProfile() {
    const res = await fetch('/api/auth/profile', { credentials: 'include' });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || data.error || 'load_failed');
    fillForm(data.profile || {});
    applyWritable(data.writable);
  }

  function renderOrganiserWorkspace(sessionData) {
    const attendeeOnly = document.getElementById('as-organiser-attendee-only');
    const hiddenPanel = document.getElementById('as-organiser-hidden');
    const hideForm = document.getElementById('as-organiser-hide-form');
    const linkedPanel = document.getElementById('as-organiser-linked');
    [attendeeOnly, hiddenPanel, hideForm, linkedPanel].forEach((el) => {
      if (el) el.hidden = true;
    });

    if (!sessionData || !sessionData.ok) return;

    const profiles = sessionData.organiserProfiles || 0;
    const pending = sessionData.pendingClaimCount || 0;
    const access = sessionData.organiserAccess === true;
    const uiVisible = sessionData.organiserUiVisible === true;
    const isAdmin = sessionData.user && sessionData.user.role === 'admin';

    if (isAdmin) {
      if (linkedPanel) linkedPanel.hidden = false;
      return;
    }

    if (profiles > 0 || pending > 0) {
      if (linkedPanel) linkedPanel.hidden = false;
      return;
    }

    if (!access) {
      if (attendeeOnly) attendeeOnly.hidden = false;
      return;
    }

    if (!uiVisible) {
      if (hiddenPanel) hiddenPanel.hidden = false;
      return;
    }

    if (hideForm) hideForm.hidden = false;
  }

  document.getElementById('as-organiser-show')?.addEventListener('click', async () => {
    hideAlert();
    const btn = document.getElementById('as-organiser-show');
    if (btn) btn.disabled = true;
    try {
      const res = await fetch('/api/auth/organiser-access', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'show-ui' }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || data.error || 'show_failed');
      if (data.redirect) {
        window.location.href = '..' + data.redirect;
        return;
      }
      showAlert(data.message || 'Organiser workspace restored.', true);
      const sessionRes = await fetch('/api/auth/session', { credentials: 'include' });
      const sessionData = await sessionRes.json();
      renderOrganiserWorkspace(sessionData);
    } catch (err) {
      showAlert(err.message || 'Could not restore organiser workspace.', false);
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  document.getElementById('as-organiser-hide-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const confirmEl = document.getElementById('as-organiser-hide-confirm');
    if (!confirmEl || !confirmEl.checked) {
      showAlert('Tick the box to confirm you only want attendee access for now.', false);
      return;
    }
    const btn = document.getElementById('as-organiser-hide-submit');
    if (btn) btn.disabled = true;
    try {
      const res = await fetch('/api/auth/organiser-access', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hide-ui', confirm: true }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || data.error || 'hide_failed');
      showAlert(data.message || 'Organiser workspace hidden.', true);
      const sessionRes = await fetch('/api/auth/session', { credentials: 'include' });
      const sessionData = await sessionRes.json();
      renderOrganiserWorkspace(sessionData);
      scrollAlertIntoView();
    } catch (err) {
      showAlert(err.message || 'Could not hide organiser workspace.', false);
      scrollAlertIntoView();
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  document.getElementById('as-email-master')?.addEventListener('change', syncEmailPrefDisabled);

  document.getElementById('as-email-prefs-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const btn = document.getElementById('as-save-email-prefs');
    if (btn) btn.disabled = true;
    const master = document.getElementById('as-email-master');
    const emailsEnabled = master ? master.checked : false;
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailsEnabled,
          emailPrefEventReminders: document.getElementById('as-email-reminders')?.checked ?? true,
          emailPrefOrganiserAlerts:
            document.getElementById('as-email-organiser-alerts')?.checked ?? true,
          emailPrefOrganiserRoundups:
            document.getElementById('as-email-organiser-roundups')?.checked ?? true,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || data.error || 'save_failed');
      await loadProfile();
      showAlert(data.message || 'Email preferences saved.', true);
      scrollAlertIntoView();
    } catch (err) {
      showAlert(err.message || 'Could not save email preferences.', false);
      scrollAlertIntoView();
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  let profileBaseline = '';

  function profileSnapshot() {
    return JSON.stringify({
      name: document.getElementById('as-name')?.value.trim() || '',
      reviewNameMode: selectedReviewNameMode(),
      company: document.getElementById('as-company')?.value.trim() || '',
      jobTitle: document.getElementById('as-job-title')?.value.trim() || '',
      businessSector: document.getElementById('as-industry')?.value.trim() || '',
      professionalRole: document.getElementById('as-professional-role')
        ? document.getElementById('as-professional-role').value.trim()
        : '',
      location: document.getElementById('as-location')?.value.trim() || '',
    });
  }

  function setProfileDirty(dirty) {
    document.body.classList.toggle('is-profile-dirty', dirty);
    const sticky = document.getElementById('as-sticky-save');
    const stickyBtn = document.getElementById('as-sticky-save-btn');
    const saveBtn = document.getElementById('as-save-profile');
    if (sticky) sticky.hidden = !dirty;
    if (stickyBtn) stickyBtn.disabled = !dirty;
    if (saveBtn && !saveBtn.dataset.saving) saveBtn.disabled = false;
  }

  function syncProfileDirty() {
    if (!profileBaseline) {
      setProfileDirty(false);
      return;
    }
    setProfileDirty(profileSnapshot() !== profileBaseline);
  }

  function rememberProfileBaseline() {
    profileBaseline = profileSnapshot();
    setProfileDirty(false);
  }

  const profileForm = document.getElementById('as-profile-form');
  profileForm?.addEventListener('input', syncProfileDirty);
  profileForm?.addEventListener('change', syncProfileDirty);

  document.getElementById('as-sticky-save-btn')?.addEventListener('click', () => {
    if (profileForm && typeof profileForm.requestSubmit === 'function') {
      profileForm.requestSubmit();
    } else {
      profileForm?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  });

  document.getElementById('as-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const btn = document.getElementById('as-save-profile');
    const stickyBtn = document.getElementById('as-sticky-save-btn');
    if (btn) {
      btn.dataset.saving = '1';
      btn.disabled = true;
    }
    if (stickyBtn) stickyBtn.disabled = true;
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('as-name').value.trim(),
          reviewNameMode: selectedReviewNameMode(),
          company: document.getElementById('as-company').value.trim(),
          jobTitle: document.getElementById('as-job-title').value.trim(),
          businessSector: document.getElementById('as-industry').value.trim(),
          professionalRole: document.getElementById('as-professional-role')
            ? document.getElementById('as-professional-role').value.trim()
            : '',
          location: document.getElementById('as-location').value.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || data.error || 'save_failed');
      await loadProfile();
      rememberProfileBaseline();
      let msg = data.message || 'Your details were saved.';
      if (data.partial && data.skipped && data.skipped.length) {
        msg =
          (data.message || 'Some details were saved.') +
          ' Fields not stored yet: ' +
          data.skipped.join(', ') +
          '.';
      }
      showAlert(msg, true);
      scrollAlertIntoView();
      if (data.profile && data.profile.name) {
        document.dispatchEvent(
          new CustomEvent('hub-profile-updated', { detail: { name: data.profile.name } })
        );
      }
    } catch (err) {
      showAlert(err.message || 'Could not save.', false);
      scrollAlertIntoView();
      syncProfileDirty();
    } finally {
      if (btn) {
        delete btn.dataset.saving;
        btn.disabled = false;
      }
    }
  });

  document.getElementById('as-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const current = document.getElementById('as-current-pw').value;
    const next = document.getElementById('as-new-pw').value;
    const confirm = document.getElementById('as-confirm-pw').value;
    if (next !== confirm) {
      showAlert('New passwords do not match.', false);
      return;
    }
    if (next.length < 10) {
      showAlert('Password must be at least 10 characters.', false);
      return;
    }
    if (!/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) {
      showAlert('Password must include at least one letter and one number.', false);
      return;
    }
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change-password',
          currentPassword: current,
          newPassword: next,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        let msg = data.message || 'Could not update password.';
        if (data.error === 'wrong_password') msg = 'Current password is incorrect.';
        showAlert(msg, false);
        return;
      }
      document.getElementById('as-current-pw').value = '';
      document.getElementById('as-new-pw').value = '';
      document.getElementById('as-confirm-pw').value = '';
      showAlert('Password updated successfully.', true);
    } catch (err) {
      showAlert(err.message || 'Could not update password.', false);
    }
  });

  async function fetchSession() {
    if (typeof window.hubFetchSession === 'function') {
      return window.hubFetchSession();
    }
    const sessionRes = await fetch('/api/auth/session', { credentials: 'include' });
    return sessionRes.json();
  }

  function initFieldTips() {
    let activeBtn = null;
    let activePopover = null;

    function closeFieldTip() {
      if (activePopover) {
        activePopover.hidden = true;
        activePopover.classList.remove('is-sheet');
        activePopover.style.left = '';
        activePopover.style.top = '';
        activePopover.style.visibility = '';
      }
      if (activeBtn) {
        activeBtn.setAttribute('aria-expanded', 'false');
        activeBtn = null;
      }
      activePopover = null;
    }

    function positionFieldTip(btn, pop) {
      const useSheet = window.matchMedia('(max-width: 720px)').matches;
      pop.classList.toggle('is-sheet', useSheet);
      pop.hidden = false;
      if (useSheet) {
        pop.style.left = '';
        pop.style.top = '';
        pop.style.visibility = '';
        return;
      }
      pop.style.visibility = 'hidden';
      pop.style.left = '0';
      pop.style.top = '0';
      const rect = btn.getBoundingClientRect();
      const width = pop.offsetWidth;
      const height = pop.offsetHeight;
      let left = rect.left + rect.width / 2 - width / 2;
      let top = rect.bottom + 8;
      if (left < 12) left = 12;
      if (left + width > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - width - 12);
      }
      if (top + height > window.innerHeight - 12) {
        top = Math.max(12, rect.top - height - 8);
      }
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
      pop.style.visibility = '';
    }

    document.querySelectorAll('[data-as-field-tip]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const popId = btn.getAttribute('data-as-field-tip');
        const pop = popId ? document.getElementById(popId) : null;
        if (!pop) return;
        if (activeBtn === btn && !pop.hidden) {
          closeFieldTip();
          return;
        }
        closeFieldTip();
        activeBtn = btn;
        activePopover = pop;
        btn.setAttribute('aria-expanded', 'true');
        positionFieldTip(btn, pop);
      });
    });

    document.addEventListener('click', function (e) {
      if (e.target.closest('.as-field-tip-btn') || e.target.closest('.as-field-tip-popover')) return;
      closeFieldTip();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeFieldTip();
    });

    window.addEventListener(
      'scroll',
      function () {
        closeFieldTip();
      },
      true
    );
  }

  async function init() {
    let sessionData;
    try {
      sessionData = await fetchSession();
    } catch (_) {
      sessionData = { ok: false };
    }
    if (!sessionData.ok || !sessionData.user) {
      if (signin) signin.hidden = false;
      if (main) main.hidden = true;
      return;
    }
    if (signin) signin.hidden = true;
    if (main) main.hidden = false;
    renderOrganiserWorkspace(sessionData);
    if (window.location.hash === '#organiser-workspace') {
      const section = document.getElementById('organiser-workspace');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    try {
      await loadProfile();
    } catch (err) {
      const msg = String(err.message || 'Could not load your profile.');
      showAlert(
        msg === 'airtable_not_configured'
          ? 'Account settings could not load. Check Supabase is configured on the server.'
          : msg,
        false
      );
    }
  }

  initFieldTips();
  init();
})();
