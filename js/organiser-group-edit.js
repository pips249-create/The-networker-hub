/**
 * Full-page group profile create / edit.
 */
(function () {
  const GROUP_SAVED_KEY = 'hub_group_last_saved';
  const params = new URLSearchParams(location.search);
  const editId = params.get('id') || '';
  let logoFile = null;
  let currentGroup = null;

  function showAlert(msg) {
    const el = document.getElementById('ge-alert');
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
  }

  async function api(path, opts) {
    const res = await fetch(path, {
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(opts && opts.headers) },
      ...opts,
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return { ok: res.ok, status: res.status, data };
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function bindLogoUpload() {
    const zone = document.getElementById('ge-logo-zone');
    const fileInput = document.getElementById('ge-logo-file');
    const preview = document.getElementById('ge-logo-preview');
    const previewImg = document.getElementById('ge-logo-preview-img');
    const placeholder = document.getElementById('ge-logo-placeholder');
    const clearBtn = document.getElementById('ge-logo-clear');

    function showPreview(src) {
      if (previewImg) previewImg.src = src;
      if (preview) preview.hidden = false;
      if (placeholder) placeholder.hidden = true;
    }

    function resetPreview() {
      logoFile = null;
      if (fileInput) fileInput.value = '';
      if (preview) preview.hidden = true;
      if (placeholder) placeholder.hidden = false;
      if (previewImg) previewImg.removeAttribute('src');
    }

    if (zone && fileInput) {
      zone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          alert('Image must be under 2MB');
          return;
        }
        logoFile = file;
        const reader = new FileReader();
        reader.onload = () => showPreview(reader.result);
        reader.readAsDataURL(file);
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetPreview();
        document.getElementById('ge-logo-url').value = '';
      });
    }
  }

  function showStatusBadge(g) {
    const line = document.getElementById('ge-status-line');
    const pill = document.getElementById('ge-status-pill');
    if (!line || !pill || !g) return;
    const key = g.statusKey || 'draft';
    const label = g.statusLabel || 'Draft';
    pill.textContent = label;
    pill.className = 'ge-status-pill';
    if (key === 'live' || key === 'upcoming') pill.classList.add('is-live');
    else if (key === 'unpublished') pill.classList.add('is-unpublished');
    else pill.classList.add('is-draft');
    line.hidden = false;
  }

  function configureEditActions(g) {
    const saveChanges = document.getElementById('ge-save-changes');
    const publishBtn = document.getElementById('ge-publish');
    const draftBtn = document.getElementById('ge-save-draft');
    const hint = document.getElementById('ge-actions-hint');

    if (saveChanges) saveChanges.hidden = false;
    if (publishBtn) publishBtn.textContent = 'Publish now';
    if (draftBtn) draftBtn.textContent = 'Save as draft';
    if (hint) {
      hint.innerHTML =
        '<strong>Save changes</strong> updates your profile here without changing publish status. ' +
        'Use <strong>Publish now</strong> to make this group visible on the public site.';
    }
    if (g) showStatusBadge(g);
  }

  function configureCreateActions() {
    const saveChanges = document.getElementById('ge-save-changes');
    const publishBtn = document.getElementById('ge-publish');
    const draftBtn = document.getElementById('ge-save-draft');
    const hint = document.getElementById('ge-actions-hint');

    if (saveChanges) saveChanges.hidden = true;
    if (publishBtn) publishBtn.textContent = 'Publish profile';
    if (draftBtn) draftBtn.textContent = 'Save as draft';
    if (hint) {
      hint.innerHTML =
        'Draft profiles are only visible in your dashboard until you publish. ' +
        'Use <strong>Publish profile</strong> when you are ready for your group to appear on the site.';
    }
  }

  function prefillGroup(g) {
    currentGroup = g;
    document.getElementById('ge-name').value = g.name || '';
    document.getElementById('ge-description').value = g.description || '';
    document.getElementById('ge-website').value = g.website || '';
    if (g.imageUrl) {
      const preview = document.getElementById('ge-logo-preview');
      const previewImg = document.getElementById('ge-logo-preview-img');
      const placeholder = document.getElementById('ge-logo-placeholder');
      if (previewImg) previewImg.src = g.imageUrl;
      if (preview) preview.hidden = false;
      if (placeholder) placeholder.hidden = true;
      document.getElementById('ge-logo-url').value = g.imageUrl;
    }
  }

  function deriveStatusKeyFromRaw(statusRaw) {
    const raw = String(statusRaw || '').toLowerCase();
    if (!raw) return 'draft';
    if (/unpublish/.test(raw)) return 'unpublished';
    if (/^draft$|pending|hidden|inactive/.test(raw)) return 'draft';
    if (/publish|live|active|public|approved|visible/.test(raw)) return 'live';
    return 'draft';
  }

  function enrichGroupFromApi(raw) {
    if (!raw) return null;
    const statusKey = raw.statusKey || deriveStatusKeyFromRaw(raw.statusRaw);
    const statusLabel =
      raw.statusLabel ||
      (statusKey === 'live' ? 'Live' : statusKey === 'unpublished' ? 'Unpublished' : 'Draft');
    return {
      ...raw,
      statusKey,
      statusLabel,
      eventsListed: raw.eventsListed != null ? raw.eventsListed : 0,
      revenueDisplay: raw.revenueDisplay || '£0',
    };
  }

  function stashSavedGroup(group) {
    if (!group || !group.id) return;
    try {
      sessionStorage.setItem(
        GROUP_SAVED_KEY,
        JSON.stringify({ group: enrichGroupFromApi(group), savedAt: Date.now() })
      );
    } catch {
      /* ignore */
    }
  }

  async function buildPayload() {
    const name = document.getElementById('ge-name').value.trim();
    if (!name) {
      showAlert('Enter a group name.');
      return null;
    }

    const payload = {
      name,
      description: document.getElementById('ge-description').value.trim(),
      website: document.getElementById('ge-website').value.trim(),
      logoUrl: document.getElementById('ge-logo-url').value.trim(),
    };

    if (logoFile) {
      payload.logoBase64 = await readFileAsBase64(logoFile);
      payload.logoMime = logoFile.type;
      payload.logoFilename = logoFile.name;
    }
    return payload;
  }

  async function saveGroup(mode, triggerBtn) {
    showAlert('');
    const payload = await buildPayload();
    if (!payload) return;

    if (mode === 'published') payload.listingStatus = 'published';
    else if (mode === 'draft') payload.listingStatus = 'draft';

    const saveChanges = document.getElementById('ge-save-changes');
    const draftBtn = document.getElementById('ge-save-draft');
    const publishBtn = document.getElementById('ge-publish');
    [saveChanges, draftBtn, publishBtn].forEach((b) => {
      if (b) b.disabled = true;
    });
    if (triggerBtn) triggerBtn.disabled = true;

    let res;
    if (editId) {
      res = await api('/api/organiser/groups', {
        method: 'PATCH',
        body: JSON.stringify({ id: editId, ...payload }),
      });
    } else {
      res = await api('/api/organiser/groups', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    [saveChanges, draftBtn, publishBtn].forEach((b) => {
      if (b) b.disabled = false;
    });

    if (!res.ok) {
      showAlert(res.data.message || res.data.error || 'Could not save profile');
      return;
    }

    const saved = enrichGroupFromApi(res.data.group);
    if (saved) stashSavedGroup(saved);

    const logoWarning = res.data.logoWarning || res.data.group?.logoWarning;
    if (logoWarning) {
      showAlert(logoWarning);
      setTimeout(() => {
        location.href = 'index.html#groups';
      }, 3500);
      return;
    }

    let msg = 'Profile saved.';
    if (mode === 'published') msg = 'Profile published — it will appear on the site.';
    else if (mode === 'draft') msg = 'Saved as draft.';
    showAlert(msg);
    setTimeout(() => {
      location.href = 'index.html#groups';
    }, mode === 'save' ? 400 : 800);
  }

  async function load() {
    const sessionRes = await api('/api/auth/session');
    if (!sessionRes.ok || !sessionRes.data.user) {
      showAlert('Please sign in to manage group profiles.');
      return;
    }
    const emailEl = document.getElementById('ge-page-email');
    if (emailEl) {
      emailEl.textContent = 'Linked to ' + (sessionRes.data.user.email || 'your account');
    }

    if (editId) {
      document.getElementById('ge-page-title').textContent = 'Edit group profile';
      document.getElementById('ge-page-lead').textContent =
        'Update your group page details — changes appear in your group profiles list after you save.';
      configureEditActions(null);

      const res = await api('/api/organiser/groups?id=' + encodeURIComponent(editId));
      if (res.ok && res.data.group) {
        const g = enrichGroupFromApi(res.data.group);
        prefillGroup(g);
        configureEditActions(g);
      } else {
        const boot = await api('/api/organiser/bootstrap');
        const local = enrichGroupFromApi((boot.data.groups || []).find((x) => x.id === editId));
        if (local) {
          prefillGroup(local);
          configureEditActions(local);
        } else showAlert('Could not load this profile.');
      }
    } else {
      configureCreateActions();
    }
  }

  document.getElementById('ge-form').addEventListener('submit', (e) => e.preventDefault());

  document.getElementById('ge-save-changes').addEventListener('click', () => {
    saveGroup('save', document.getElementById('ge-save-changes'));
  });

  document.getElementById('ge-save-draft').addEventListener('click', () => {
    saveGroup('draft', document.getElementById('ge-save-draft'));
  });

  document.getElementById('ge-publish').addEventListener('click', () => {
    saveGroup('published', document.getElementById('ge-publish'));
  });

  bindLogoUpload();
  load();
})();
