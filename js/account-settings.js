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

  function syncPrefsFromTextarea() {
    const ta = document.getElementById('as-prefs');
    const quick = document.getElementById('as-prefs-quick');
    if (!ta || !quick) return;
    const parts = ta.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    quick.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = parts.includes(cb.value);
    });
  }

  function syncTextareaFromPrefs() {
    const ta = document.getElementById('as-prefs');
    const quick = document.getElementById('as-prefs-quick');
    if (!ta || !quick) return;
    const selected = [];
    quick.querySelectorAll('input[type="checkbox"]:checked').forEach((cb) => {
      selected.push(cb.value);
    });
    const existing = ta.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const merged = [...new Set([...selected, ...existing.filter((x) => !quick.querySelector('[value="' + x + '"]'))])];
    ta.value = merged.join(', ');
  }

  function setFieldWritable(id, enabled) {
    const el = document.getElementById(id);
    if (!el) return;
    const field = el.closest('.as-field');
    if (field) field.hidden = !enabled;
    if (!enabled) {
      if (el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        el.disabled = true;
      }
    }
  }

  function applyWritable(writable) {
    const w = writable || {};
    setFieldWritable('as-name', w.name !== false);
    setFieldWritable('as-location', !!w.location);
    setFieldWritable('as-sector', !!w.businessSector);
    setFieldWritable('as-prefs', !!w.marketPreferences);
    const quick = document.getElementById('as-prefs-quick');
    if (quick) quick.hidden = !w.marketPreferences;
  }

  function fillForm(profile) {
    document.getElementById('as-email').value = profile.email || '';
    document.getElementById('as-name').value = profile.name || '';
    document.getElementById('as-location').value = profile.location || '';
    document.getElementById('as-sector').value = profile.businessSector || '';
    document.getElementById('as-prefs').value = profile.marketPreferences || '';
    syncPrefsFromTextarea();
  }

  async function loadProfile() {
    const res = await fetch('/api/auth/profile', { credentials: 'include' });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || data.error || 'load_failed');
    fillForm(data.profile || {});
    applyWritable(data.writable);
  }

  document.getElementById('as-prefs-quick')?.addEventListener('change', syncTextareaFromPrefs);

  document.getElementById('as-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const btn = document.getElementById('as-save-profile');
    if (btn) btn.disabled = true;
    syncTextareaFromPrefs();
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('as-name').value.trim(),
          location: document.getElementById('as-location').value.trim(),
          businessSector: document.getElementById('as-sector').value.trim(),
          marketPreferences: document.getElementById('as-prefs').value.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || data.error || 'save_failed');
      fillForm(data.profile || {});
      if (data.writable) applyWritable(data.writable);
      showAlert(data.message || 'Your details were saved.', true);
    } catch (err) {
      showAlert(err.message || 'Could not save.', false);
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
      return;
    }
    if (main) main.hidden = false;
    try {
      await loadProfile();
    } catch (err) {
      showAlert(err.message || 'Could not load your profile.', false);
    }
  }

  init();
})();
