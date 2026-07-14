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

  function scrollAlertIntoView() {
    if (alertEl) alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function applyWritable(writable) {
    const w = writable || {};
    setFieldWritable('as-name', w.name !== false);
    // Default on so fields stay visible even if an older API omits these flags.
    setFieldWritable('as-company', w.company !== false);
    setFieldWritable('as-job-title', w.jobTitle !== false);
    setFieldWritable('as-location', w.location !== false);
  }

  function setFieldValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? '';
  }

  function fillForm(profile) {
    setFieldValue('as-email', profile.email || '');
    setFieldValue('as-name', profile.name || '');
    setFieldValue('as-company', profile.company || '');
    setFieldValue('as-job-title', profile.jobTitle || '');
    setFieldValue('as-location', profile.location || '');
    fillEmailPrefs(profile);
  }

  function fillEmailPrefs(profile) {
    const master = document.getElementById('as-email-master');
    const reminders = document.getElementById('as-email-reminders');
    const organiserAlerts = document.getElementById('as-email-organiser-alerts');
    if (master) master.checked = profile.emailsEnabled === true;
    if (reminders) reminders.checked = profile.emailPrefEventReminders !== false;
    if (organiserAlerts) organiserAlerts.checked = profile.emailPrefOrganiserAlerts !== false;
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

  document.getElementById('as-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const btn = document.getElementById('as-save-profile');
    if (btn) btn.disabled = true;
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('as-name').value.trim(),
          company: document.getElementById('as-company').value.trim(),
          jobTitle: document.getElementById('as-job-title').value.trim(),
          location: document.getElementById('as-location').value.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || data.error || 'save_failed');
      await loadProfile();
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
    } finally {
      if (btn) btn.disabled = false;
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

  init();
})();
