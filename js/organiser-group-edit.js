/**
 * Full-page organiser profile (group) create / edit.
 */
(function () {
  const params = new URLSearchParams(location.search);
  const editId = params.get('id') || '';
  let logoFile = null;

  function showAlert(msg) {
    const el = document.getElementById('ge-alert');
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
  }

  async function api(path, opts) {
    const res = await fetch(path, {
      credentials: 'include',
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

  function prefillGroup(g) {
    document.getElementById('ge-name').value = g.name || '';
    document.getElementById('ge-description').value = g.description || '';
    document.getElementById('ge-website').value = g.website || '';
    document.getElementById('ge-location').value = g.location || '';
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

  async function load() {
    const sessionRes = await api('/api/auth/session');
    if (!sessionRes.ok || !sessionRes.data.user) {
      showAlert('Please sign in to manage organiser profiles.');
      return;
    }
    const emailEl = document.getElementById('ge-page-email');
    if (emailEl) {
      emailEl.textContent = 'Linked to ' + (sessionRes.data.user.email || 'your account');
    }

    if (editId) {
      document.getElementById('ge-page-title').textContent = 'Edit organiser profile';
      document.getElementById('ge-page-lead').textContent =
        'Update your group page details shown on event listings.';
      document.getElementById('ge-submit').textContent = 'Save changes';
      const res = await api('/api/organiser/groups?id=' + encodeURIComponent(editId));
      if (res.ok && res.data.group) {
        prefillGroup(res.data.group);
      } else {
        const boot = await api('/api/organiser/bootstrap');
        const local = (boot.data.groups || []).find((x) => x.id === editId);
        if (local) prefillGroup(local);
        else showAlert('Could not load this profile.');
      }
    }
  }

  document.getElementById('ge-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showAlert('');
    const name = document.getElementById('ge-name').value.trim();
    if (!name) {
      showAlert('Enter a group name.');
      return;
    }

    const payload = {
      name,
      description: document.getElementById('ge-description').value.trim(),
      website: document.getElementById('ge-website').value.trim(),
      location: document.getElementById('ge-location').value.trim(),
      logoUrl: document.getElementById('ge-logo-url').value.trim(),
    };

    if (logoFile) {
      payload.logoBase64 = await readFileAsBase64(logoFile);
      payload.logoMime = logoFile.type;
      payload.logoFilename = logoFile.name;
    }

    const btn = document.getElementById('ge-submit');
    btn.disabled = true;

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

    btn.disabled = false;

    if (!res.ok) {
      showAlert(res.data.message || res.data.error || 'Could not save profile');
      return;
    }

    const logoWarning = res.data.logoWarning || res.data.group?.logoWarning;
    if (logoWarning) {
      showAlert(logoWarning);
      setTimeout(() => {
        location.href = 'index.html#groups';
      }, 3500);
      return;
    }

    location.href = 'index.html#groups';
  });

  bindLogoUpload();
  load();
})();
