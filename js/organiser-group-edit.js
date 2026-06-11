/**
 * Full-page group profile create / edit.
 */
(function () {
  const GROUP_SAVED_KEY = 'hub_group_last_saved';
  const INDUSTRY_OPTIONS = [
    'Business',
    'Technology',
    'Creative',
    'Finance',
    'Healthcare',
    'Property',
    'Legal',
    'Marketing',
    'Education',
    'Manufacturing',
    'Retail',
    'Hospitality',
    'Other',
  ];
  const params = new URLSearchParams(location.search);
  const editId = params.get('id') || '';
  const onboardReview = params.get('onboard') === 'review';
  let logoFile = null;
  let currentGroup = null;
  const selectedIndustries = new Set();

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
    const qualityHint = document.getElementById('ge-logo-quality');
    const urlInput = document.getElementById('ge-logo-url');

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
      if (window.hubClearLogoQualityHint) window.hubClearLogoQualityHint(qualityHint);
    }

    function setLogoFile(file) {
      logoFile = file;
      const reader = new FileReader();
      reader.onload = () => showPreview(reader.result);
      reader.readAsDataURL(file);
    }

    if (zone && window.hubBindImageUpload) {
      window.hubBindImageUpload({ zone, fileInput, onFile: setLogoFile, qualityHintEl: qualityHint });
    }
    if (window.hubBindLogoUrlQualityCheck) {
      window.hubBindLogoUrlQualityCheck(urlInput, qualityHint, function () {
        return Boolean(logoFile);
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetPreview();
        if (urlInput) urlInput.value = '';
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

  function countWords(text) {
    return String(text || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  function bindWordCounter() {
    const ta = document.getElementById('ge-description');
    const counter = document.getElementById('ge-word-count');
    if (!ta || !counter) return;
    const update = () => {
      counter.textContent = String(countWords(ta.value));
    };
    ta.addEventListener('input', update);
    update();
  }

  function renderIndustryChips() {
    const wrap = document.getElementById('ge-industries');
    if (!wrap) return;
    wrap.innerHTML = '';
    INDUSTRY_OPTIONS.forEach((label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ee-chip' + (selectedIndustries.has(label) ? ' is-active' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (selectedIndustries.has(label)) selectedIndustries.delete(label);
        else selectedIndustries.add(label);
        renderIndustryChips();
      });
      wrap.appendChild(btn);
    });
  }

  function configureEditActions(g) {
    const saveChanges = document.getElementById('ge-save-changes');
    const continueBtn = document.getElementById('ge-save-continue');
    const publishBtn = document.getElementById('ge-publish');
    const draftBtn = document.getElementById('ge-save-draft');
    const hint = document.getElementById('ge-actions-hint');

    if (saveChanges) saveChanges.hidden = false;
    if (continueBtn) continueBtn.hidden = true;
    if (publishBtn) {
      publishBtn.hidden = false;
      publishBtn.textContent = 'Publish now';
    }
    if (draftBtn) {
      draftBtn.hidden = false;
      draftBtn.textContent = 'Save as draft';
    }
    if (hint) {
      hint.innerHTML =
        '<strong>Save changes</strong> updates your profile. Use <strong>Publish now</strong> when ready for the public site.';
    }
    if (g) showStatusBadge(g);
  }

  function configureOnboardReviewActions(g) {
    const saveChanges = document.getElementById('ge-save-changes');
    const continueBtn = document.getElementById('ge-save-continue');
    const publishBtn = document.getElementById('ge-publish');
    const draftBtn = document.getElementById('ge-save-draft');
    const hint = document.getElementById('ge-actions-hint');
    const titleEl = document.getElementById('ge-page-title');
    const leadEl = document.getElementById('ge-page-lead');

    if (titleEl) titleEl.textContent = 'Check your group profile';
    if (leadEl) {
      leadEl.textContent =
        'We linked this group to your account. Please confirm the name, logo, and contact details are correct before you list events.';
    }
    if (saveChanges) saveChanges.hidden = false;
    if (continueBtn) {
      continueBtn.hidden = false;
      continueBtn.textContent = 'Looks good — list my first event →';
    }
    if (publishBtn) publishBtn.hidden = true;
    if (draftBtn) draftBtn.hidden = true;
    if (hint) {
      hint.textContent =
        'Update anything that needs changing, then continue to set up your first event listing.';
    }
    if (g) showStatusBadge(g);
  }

  function configureCreateActions() {
    const saveChanges = document.getElementById('ge-save-changes');
    const continueBtn = document.getElementById('ge-save-continue');
    const publishBtn = document.getElementById('ge-publish');
    const draftBtn = document.getElementById('ge-save-draft');
    const hint = document.getElementById('ge-actions-hint');

    if (saveChanges) saveChanges.hidden = true;
    if (continueBtn) continueBtn.hidden = false;
    if (publishBtn) publishBtn.hidden = true;
    if (draftBtn) draftBtn.hidden = true;
    if (hint) {
      hint.textContent =
        'Your profile will be submitted for verification. Next, you will set up your first event.';
    }
  }

  function prefillGroup(g) {
    currentGroup = g;
    document.getElementById('ge-name').value = g.name || '';
    document.getElementById('ge-description').value = g.description || '';
    document.getElementById('ge-website').value = g.website || '';
    if (document.getElementById('ge-contact-email')) {
      document.getElementById('ge-contact-email').value = g.contactEmail || '';
    }
    selectedIndustries.clear();
    (g.industries || []).forEach((i) => selectedIndustries.add(i));
    renderIndustryChips();
    const counter = document.getElementById('ge-word-count');
    if (counter) counter.textContent = String(countWords(g.description || ''));
    if (g.imageUrl) {
      const preview = document.getElementById('ge-logo-preview');
      const previewImg = document.getElementById('ge-logo-preview-img');
      const placeholder = document.getElementById('ge-logo-placeholder');
      const qualityHint = document.getElementById('ge-logo-quality');
      if (previewImg) previewImg.src = g.imageUrl;
      if (preview) preview.hidden = false;
      if (placeholder) placeholder.hidden = true;
      document.getElementById('ge-logo-url').value = g.imageUrl;
      if (window.hubCheckLogoUrlQuality) window.hubCheckLogoUrlQuality(g.imageUrl, qualityHint);
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

    const description = document.getElementById('ge-description').value.trim();
    if (!description) {
      showAlert('Enter a description for your group.');
      return null;
    }
    if (countWords(description) > 150) {
      showAlert('Description must be 150 words or fewer.');
      return null;
    }

    const contactEmail = document.getElementById('ge-contact-email').value.trim();
    if (!contactEmail) {
      showAlert('Enter a contact email.');
      return null;
    }

    const payload = {
      name,
      description,
      website: document.getElementById('ge-website').value.trim(),
      logoUrl: document.getElementById('ge-logo-url').value.trim(),
      industries: [...selectedIndustries],
      contactEmail,
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
    const continueBtn = document.getElementById('ge-save-continue');
    [saveChanges, draftBtn, publishBtn, continueBtn].forEach((b) => {
      if (b) b.disabled = true;
    });
    if (triggerBtn) triggerBtn.disabled = true;

    try {
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

    if (!res.ok) {
      showAlert(res.data.message || res.data.error || 'Could not save profile');
      return;
    }

    const saved = enrichGroupFromApi(res.data.group);
    if (saved) stashSavedGroup(saved);

    const logoWarning = res.data.logoWarning || res.data.group?.logoWarning;
    const logoResolutionWarning =
      res.data.logoResolutionWarning || res.data.group?.logoResolutionWarning;
    const saveWarnings = res.data.saveWarnings || [];
    const apiMessage = res.data.message || '';

    let msg = 'Profile saved.';
    if (mode === 'published') msg = 'Profile published — it will appear on the site.';
    else if (mode === 'draft') msg = 'Saved as draft.';
    else if (mode === 'save') msg = 'Changes saved.';
    else if (mode === 'continue') msg = 'Profile saved — redirecting to event setup.';

    if (apiMessage) msg = apiMessage;
    else if (saveWarnings.length) msg = msg + ' ' + saveWarnings.join(' ');
    if (logoWarning) msg = logoWarning + (saveWarnings.length ? ' ' + saveWarnings.join(' ') : '');
    else if (logoResolutionWarning) msg = logoResolutionWarning;

    showAlert(msg);
    const qualityHint = document.getElementById('ge-logo-quality');
    if (logoResolutionWarning && qualityHint) {
      qualityHint.textContent = logoResolutionWarning;
      qualityHint.hidden = false;
    }
    if ((onboardReview || (!editId && mode === 'continue')) && window.HubFlowTour) {
      window.HubFlowTour.markEventTourPending();
    }
    if (onboardReview && mode === 'continue' && window.HubOrganiserOnboarding) {
      window.HubOrganiserOnboarding.markProfileReviewDone();
    }
    const redirect =
      onboardReview || (!editId && mode === 'continue') ? 'event-format.html' : 'index.html#groups';
    setTimeout(function () {
      location.href = redirect;
    }, logoWarning || logoResolutionWarning || saveWarnings.length ? 2200 : 700);
    } finally {
      [saveChanges, draftBtn, publishBtn, continueBtn].forEach((b) => {
        if (b) b.disabled = false;
      });
    }
  }

  async function load() {
    const backLink = document.querySelector('.ee-back');
    if (backLink && window.HubOrganiserActions) {
      window.HubOrganiserActions.applyBrowseReturnBack(
        backLink,
        'index.html#groups',
        '← Back to group profiles'
      );
    }
    const sessionRes = await api('/api/auth/session');
    if (!sessionRes.ok || !sessionRes.data.user) {
      const nextPath =
        '/organiser/group-edit.html' + (editId ? '?id=' + encodeURIComponent(editId) : '');
      location.href = '../login.html?next=' + encodeURIComponent(nextPath);
      return;
    }
    const emailEl = document.getElementById('ge-page-email');
    const accountEmail = sessionRes.data.user.email || '';
    if (emailEl) {
      emailEl.textContent = 'Linked to ' + (accountEmail || 'your account');
    }
    const contactEl = document.getElementById('ge-contact-email');
    if (contactEl && !editId && accountEmail) contactEl.value = accountEmail;

    if (editId) {
      if (!onboardReview) {
        document.getElementById('ge-page-title').textContent = 'Edit group profile';
        document.getElementById('ge-page-lead').textContent =
          'Update your group page details — changes appear in your group profiles list after you save.';
        configureEditActions(null);
      }

      const res = await api('/api/organiser/groups?id=' + encodeURIComponent(editId));
      if (res.ok && res.data.group) {
        const g = enrichGroupFromApi(res.data.group);
        prefillGroup(g);
        if (onboardReview) configureOnboardReviewActions(g);
        else configureEditActions(g);
      } else {
        const boot = await api('/api/organiser/bootstrap');
        const local = enrichGroupFromApi((boot.data.groups || []).find((x) => x.id === editId));
        if (local) {
          prefillGroup(local);
          if (onboardReview) configureOnboardReviewActions(local);
          else configureEditActions(local);
        } else showAlert('Could not load this profile.');
      }

      if (onboardReview && window.HubFlowTour) {
        window.HubFlowTour.startGroupTour({ onboardReview: true, force: true, delay: 350 });
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

  const continueBtn = document.getElementById('ge-save-continue');
  if (continueBtn) {
    continueBtn.addEventListener('click', () => saveGroup('continue', continueBtn));
  }

  bindLogoUpload();
  bindWordCounter();
  renderIndustryChips();
  if (!editId && window.HubFlowTour) {
    window.HubFlowTour.startGroupTour({ isEdit: false, delay: 0 });
  }
  load();
})();
