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
    setFieldWritable('as-location', !!w.location);
    setFieldWritable('as-sector', !!w.businessSector);
  }

  function fillForm(profile) {
    document.getElementById('as-email').value = profile.email || '';
    document.getElementById('as-name').value = profile.name || '';
    document.getElementById('as-location').value = profile.location || '';
    document.getElementById('as-sector').value = profile.businessSector || '';
    fillEmailPrefs(profile);
  }

  function fillEmailPrefs(profile) {
    const master = document.getElementById('as-email-master');
    const newsletter = document.getElementById('as-email-newsletter');
    const reminders = document.getElementById('as-email-reminders');
    const organiserAlerts = document.getElementById('as-email-organiser-alerts');
    if (master) master.checked = profile.emailsEnabled !== false;
    if (newsletter) newsletter.checked = profile.emailPrefNewsletter !== false;
    if (reminders) reminders.checked = profile.emailPrefEventReminders !== false;
    if (organiserAlerts) organiserAlerts.checked = profile.emailPrefOrganiserAlerts !== false;
    syncEmailPrefDisabled();
  }

  function syncEmailPrefDisabled() {
    const master = document.getElementById('as-email-master');
    const disabled = master ? !master.checked : false;
    ['as-email-newsletter', 'as-email-reminders', 'as-email-organiser-alerts'].forEach((id) => {
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

  document.getElementById('as-email-master')?.addEventListener('change', syncEmailPrefDisabled);

  document.getElementById('as-email-prefs-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const btn = document.getElementById('as-save-email-prefs');
    if (btn) btn.disabled = true;
    const master = document.getElementById('as-email-master');
    const emailsEnabled = master ? master.checked : true;
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailsEnabled,
          emailPrefNewsletter: document.getElementById('as-email-newsletter')?.checked ?? true,
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
          location: document.getElementById('as-location').value.trim(),
          businessSector: document.getElementById('as-sector').value.trim(),
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

  async function init() {
    const sessionRes = await fetch('/api/auth/session', { credentials: 'include' });
    const sessionData = await sessionRes.json();
    if (!sessionData.ok || !sessionData.user) {
      if (signin) signin.hidden = false;
      if (main) main.hidden = true;
      return;
    }
    if (signin) signin.hidden = true;
    if (main) main.hidden = false;
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
