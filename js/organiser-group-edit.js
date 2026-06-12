/**
 * Group profile create / edit — standalone page or dashboard drawer.
 */
(function (global) {
  const GROUP_SAVED_KEY = 'hub_group_last_saved';
  const DESCRIPTION_MAX_WORDS = 500;

  let logoFile = null;
  let currentGroup = null;
  let config = null;
  let bound = false;

  function getRoot() {
    return (config && config.root) || document;
  }

  function el(id) {
    return getRoot().querySelector('#' + id);
  }

  function isEmbedded() {
    return Boolean(config && config.embedded);
  }

  function getEditId() {
    return (config && config.editId) || '';
  }

  function showAlert(msg) {
    const alertEl = el('ge-alert');
    if (!alertEl) return;
    alertEl.textContent = msg;
    alertEl.hidden = !msg;
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

  function resetLogoPreview() {
    logoFile = null;
    const fileInput = el('ge-logo-file');
    const preview = el('ge-logo-preview');
    const previewImg = el('ge-logo-preview-img');
    const placeholder = el('ge-logo-placeholder');
    const qualityHint = el('ge-logo-quality');
    const urlInput = el('ge-logo-url');
    if (fileInput) fileInput.value = '';
    if (preview) preview.hidden = true;
    if (placeholder) placeholder.hidden = false;
    if (previewImg) previewImg.removeAttribute('src');
    if (urlInput) urlInput.value = '';
    if (window.hubClearLogoQualityHint) window.hubClearLogoQualityHint(qualityHint);
  }

  function bindLogoUpload() {
    const zone = el('ge-logo-zone');
    const fileInput = el('ge-logo-file');
    const preview = el('ge-logo-preview');
    const previewImg = el('ge-logo-preview-img');
    const placeholder = el('ge-logo-placeholder');
    const clearBtn = el('ge-logo-clear');
    const qualityHint = el('ge-logo-quality');
    const urlInput = el('ge-logo-url');

    function showPreview(src) {
      if (previewImg) previewImg.src = src;
      if (preview) preview.hidden = false;
      if (placeholder) placeholder.hidden = true;
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
    if (clearBtn && !clearBtn.dataset.geBound) {
      clearBtn.dataset.geBound = '1';
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetLogoPreview();
      });
    }
  }

  function showStatusBadge(g) {
    const line = el('ge-status-line');
    const pill = el('ge-status-pill');
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
    const ta = el('ge-description');
    const counter = el('ge-word-count');
    const maxEl = el('ge-word-max');
    if (maxEl) maxEl.textContent = String(DESCRIPTION_MAX_WORDS);
    if (!ta || !counter || ta.dataset.geCounterBound) return;
    ta.dataset.geCounterBound = '1';
    const update = () => {
      counter.textContent = String(countWords(ta.value));
    };
    ta.addEventListener('input', update);
    update();
  }

  function configureEditActions(g) {
    const saveChanges = el('ge-save-changes');
    const continueBtn = el('ge-save-continue');
    const publishBtn = el('ge-publish');
    const draftBtn = el('ge-save-draft');
    const hint = el('ge-actions-hint');
    const cancelLink = el('ge-cancel');

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
    if (cancelLink) cancelLink.hidden = isEmbedded();
    if (hint) {
      hint.innerHTML = isEmbedded()
        ? '<strong>Save changes</strong> updates your profile. Use <strong>Publish now</strong> when ready for the public site.'
        : '<strong>Save changes</strong> updates your profile. Use <strong>Publish now</strong> when ready for the public site.';
    }
    if (g) showStatusBadge(g);
  }

  function configureOnboardReviewActions(g) {
    const saveChanges = el('ge-save-changes');
    const continueBtn = el('ge-save-continue');
    const publishBtn = el('ge-publish');
    const draftBtn = el('ge-save-draft');
    const hint = el('ge-actions-hint');
    const titleEl = el('ge-page-title');
    const leadEl = el('ge-page-lead');

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
    const saveChanges = el('ge-save-changes');
    const continueBtn = el('ge-save-continue');
    const publishBtn = el('ge-publish');
    const draftBtn = el('ge-save-draft');
    const hint = el('ge-actions-hint');
    const cancelLink = el('ge-cancel');
    const statusLine = el('ge-status-line');

    if (saveChanges) saveChanges.hidden = true;
    if (continueBtn) continueBtn.hidden = false;
    if (publishBtn) publishBtn.hidden = true;
    if (draftBtn) draftBtn.hidden = true;
    if (cancelLink) cancelLink.hidden = isEmbedded();
    if (statusLine) statusLine.hidden = true;
    if (hint) {
      hint.textContent =
        'Your profile will be submitted for verification. Next, you will set up your first event.';
    }
  }

  function prefillGroup(g) {
    currentGroup = g;
    if (el('ge-name')) el('ge-name').value = g.name || '';
    if (el('ge-description')) el('ge-description').value = g.description || '';
    if (el('ge-website')) el('ge-website').value = g.website || '';
    if (el('ge-contact-email')) el('ge-contact-email').value = g.contactEmail || '';
    const counter = el('ge-word-count');
    if (counter) counter.textContent = String(countWords(g.description || ''));
    if (g.imageUrl) {
      const preview = el('ge-logo-preview');
      const previewImg = el('ge-logo-preview-img');
      const placeholder = el('ge-logo-placeholder');
      const qualityHint = el('ge-logo-quality');
      if (previewImg) previewImg.src = g.imageUrl;
      if (preview) preview.hidden = false;
      if (placeholder) placeholder.hidden = true;
      if (el('ge-logo-url')) el('ge-logo-url').value = g.imageUrl;
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

  function resetFormState() {
    currentGroup = null;
    showAlert('');
    const form = el('ge-form');
    if (form) form.reset();
    resetLogoPreview();
    const statusLine = el('ge-status-line');
    if (statusLine) statusLine.hidden = true;
    ['ge-save-changes', 'ge-save-continue', 'ge-publish', 'ge-save-draft', 'ge-cancel'].forEach((id) => {
      const btn = el(id);
      if (btn) btn.hidden = true;
    });
  }

  async function buildPayload() {
    const name = el('ge-name').value.trim();
    if (!name) {
      showAlert('Enter a group name.');
      return null;
    }

    const description = el('ge-description').value.trim();
    if (!description) {
      showAlert('Enter a description for your group.');
      return null;
    }
    if (countWords(description) > DESCRIPTION_MAX_WORDS) {
      showAlert('Description must be ' + DESCRIPTION_MAX_WORDS + ' words or fewer.');
      return null;
    }

    const contactEmail = el('ge-contact-email').value.trim();
    if (!contactEmail) {
      showAlert('Enter a contact email.');
      return null;
    }

    const payload = {
      name,
      description,
      website: el('ge-website').value.trim(),
      logoUrl: el('ge-logo-url').value.trim(),
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

    const saveChanges = el('ge-save-changes');
    const draftBtn = el('ge-save-draft');
    const publishBtn = el('ge-publish');
    const continueBtn = el('ge-save-continue');
    [saveChanges, draftBtn, publishBtn, continueBtn].forEach((b) => {
      if (b) b.disabled = true;
    });
    if (triggerBtn) triggerBtn.disabled = true;

    const editId = getEditId();
    const onboardReview = config && config.onboardReview;

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
      const qualityHint = el('ge-logo-quality');
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

      const hasWarnings = Boolean(logoWarning || logoResolutionWarning || saveWarnings.length);
      const delay = hasWarnings ? 2200 : isEmbedded() ? 900 : 700;

      if (isEmbedded()) {
        if (config.onSaved) config.onSaved(saved, mode);
        if (mode === 'continue' || onboardReview) {
          setTimeout(function () {
            location.href = 'event-format.html';
          }, delay);
        } else {
          setTimeout(function () {
            if (config.onClose) config.onClose();
          }, delay);
        }
        return;
      }

      const redirect =
        onboardReview || (!editId && mode === 'continue') ? 'event-format.html' : 'index.html#groups';
      setTimeout(function () {
        location.href = redirect;
      }, delay);
    } finally {
      [saveChanges, draftBtn, publishBtn, continueBtn].forEach((b) => {
        if (b) b.disabled = false;
      });
    }
  }

  async function load() {
    const editId = getEditId();
    const onboardReview = config && config.onboardReview;

    if (!isEmbedded()) {
      const backLink = getRoot().querySelector('.ee-back');
      if (backLink && window.HubOrganiserActions) {
        window.HubOrganiserActions.applyBrowseReturnBack(
          backLink,
          'index.html#groups',
          '← Back to group profiles'
        );
      }
    }

    const sessionRes = await api('/api/auth/session');
    if (!sessionRes.ok || !sessionRes.data.user) {
      if (isEmbedded()) {
        showAlert('Your session expired — refresh the page and sign in again.');
        return;
      }
      const nextPath =
        '/organiser/group-edit.html' + (editId ? '?id=' + encodeURIComponent(editId) : '');
      location.href = '../login.html?next=' + encodeURIComponent(nextPath);
      return;
    }

    const emailEl = el('ge-page-email');
    const accountEmail = sessionRes.data.user.email || '';
    if (emailEl) {
      if (isEmbedded() && editId) {
        emailEl.textContent = '';
      } else {
        emailEl.textContent = isEmbedded()
          ? accountEmail
          : 'Linked to ' + (accountEmail || 'your account');
      }
    }
    const contactEl = el('ge-contact-email');
    if (contactEl && !editId && accountEmail && !contactEl.value) contactEl.value = accountEmail;

    const titleEl = el('ge-page-title');
    const leadEl = el('ge-page-lead');

    if (editId) {
      if (!onboardReview) {
        if (titleEl) titleEl.textContent = 'Edit group profile';
        if (leadEl) {
          leadEl.textContent = isEmbedded()
            ? ''
            : 'Update your group page details — changes appear in your group profiles list after you save.';
        }
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
      if (titleEl) titleEl.textContent = 'New group profile';
      if (leadEl) {
        leadEl.textContent = isEmbedded()
          ? 'Linked to your account email.'
          : 'Create your organiser group — linked to your account email in Airtable.';
      }
      configureCreateActions();
    }
  }

  function bindEvents() {
    if (bound) return;
    bound = true;

    const form = el('ge-form');
    if (form && !form.dataset.geBound) {
      form.dataset.geBound = '1';
      form.addEventListener('submit', (e) => e.preventDefault());
    }

    const saveChanges = el('ge-save-changes');
    if (saveChanges && !saveChanges.dataset.geBound) {
      saveChanges.dataset.geBound = '1';
      saveChanges.addEventListener('click', () => saveGroup('save', saveChanges));
    }

    const draftBtn = el('ge-save-draft');
    if (draftBtn && !draftBtn.dataset.geBound) {
      draftBtn.dataset.geBound = '1';
      draftBtn.addEventListener('click', () => saveGroup('draft', draftBtn));
    }

    const publishBtn = el('ge-publish');
    if (publishBtn && !publishBtn.dataset.geBound) {
      publishBtn.dataset.geBound = '1';
      publishBtn.addEventListener('click', () => saveGroup('published', publishBtn));
    }

    const continueBtn = el('ge-save-continue');
    if (continueBtn && !continueBtn.dataset.geBound) {
      continueBtn.dataset.geBound = '1';
      continueBtn.addEventListener('click', () => saveGroup('continue', continueBtn));
    }

    const cancelBtn = el('ge-cancel');
    if (cancelBtn && !cancelBtn.dataset.geBound) {
      cancelBtn.dataset.geBound = '1';
      cancelBtn.addEventListener('click', (e) => {
        if (!isEmbedded()) return;
        e.preventDefault();
        if (config.onClose) config.onClose();
      });
    }
  }

  function init(options) {
    config = {
      root: options.root || document,
      editId: options.editId || '',
      onboardReview: Boolean(options.onboardReview),
      embedded: Boolean(options.embedded),
      onClose: options.onClose || null,
      onSaved: options.onSaved || null,
    };
    bindEvents();
    bindLogoUpload();
    bindWordCounter();
    return {
      open: openWith,
      reload: load,
      reset: resetFormState,
    };
  }

  function openWith(options) {
    if (options) {
      if (options.root) config.root = options.root;
      if (options.editId != null) config.editId = options.editId;
      if (options.onboardReview != null) config.onboardReview = Boolean(options.onboardReview);
      if (options.embedded != null) config.embedded = Boolean(options.embedded);
      if (options.onClose) config.onClose = options.onClose;
      if (options.onSaved) config.onSaved = options.onSaved;
    }
    if (!config) init(options || {});
    resetFormState();
    return load();
  }

  global.HubGroupEdit = {
    init,
    open: openWith,
    load,
    resetFormState,
  };

  const geForm = document.getElementById('ge-form');
  if (geForm && !geForm.closest('#org-group-drawer')) {
    const params = new URLSearchParams(location.search);
    init({
      editId: params.get('id') || '',
      onboardReview: params.get('onboard') === 'review',
    });
    if (!params.get('id') && window.HubFlowTour) {
      window.HubFlowTour.startGroupTour({ isEdit: false, delay: 0 });
    }
    load();
  }
})(window);
