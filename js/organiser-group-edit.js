/**
 * Group profile create / edit — standalone page or dashboard drawer.
 */
(function (global) {
  const GROUP_SAVED_KEY = 'hub_group_last_saved';
  const GROUP_CONTINUE_KEY = 'hub_group_continue_to_event';
  const DESCRIPTION_MAX_WORDS = 500;

  let logoFile = null;
  let currentGroup = null;
  let config = null;
  let bound = false;
  let pendingImport = null;
  let loadGeneration = 0;
  let formDirty = false;
  let saveInFlight = false;

  function getRoot() {
    return (config && config.root) || document;
  }

  function el(id) {
    return getRoot().querySelector('#' + id);
  }

  function isPlatformWebsiteImportUrl(url) {
    try {
      var raw = String(url || '').trim();
      if (!raw) return false;
      var test = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
      var host = new URL(test).hostname.toLowerCase().replace(/^www\./, '');
      return (
        host === 'thenetworkerhub.com' ||
        host === 'thenetworkerhub.co.uk' ||
        host === 'the-networker.co.uk' ||
        host === 'the-networker.com' ||
        /\.vercel\.app$/.test(host)
      );
    } catch (e) {
      return false;
    }
  }

  function isEmbedded() {
    return Boolean(config && config.embedded);
  }

  function getEditId() {
    return (config && config.editId) || '';
  }

  function showAlert(msg, kind) {
    const text = msg ? String(msg) : '';
    const alertEl = el('ge-alert');
    if (alertEl) {
      alertEl.textContent = text;
      alertEl.hidden = !text;
      if (text && alertEl.scrollIntoView) {
        try {
          alertEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch {
          /* ignore */
        }
      }
    }
    const footStatus = el('ge-drawer-status');
    if (footStatus) {
      footStatus.textContent = text;
      footStatus.hidden = !text;
      footStatus.classList.toggle('is-error', Boolean(text) && kind === 'error');
      footStatus.classList.toggle('is-ok', Boolean(text) && kind === 'ok');
    }
  }

  let loadingHideTimer = null;
  let loadingShowRaf = null;

  function setEmbeddedLoading(on, message) {
    const root = getRoot();
    const drawer =
      (root && root.id === 'org-group-drawer' && root) ||
      document.getElementById('org-group-drawer');
    const loading =
      (drawer && drawer.querySelector('#org-group-drawer-loading')) ||
      document.getElementById('org-group-drawer-loading');
    if (!loading) return;

    if (drawer) drawer.classList.toggle('is-loading', Boolean(on));

    const textEl = loading.querySelector('.org-group-drawer-loading-text');
    if (textEl) {
      textEl.textContent = on
        ? String(message || '').trim() || 'Loading your page…'
        : 'Loading your page…';
    }

    if (loadingHideTimer) {
      clearTimeout(loadingHideTimer);
      loadingHideTimer = null;
    }
    if (loadingShowRaf) {
      cancelAnimationFrame(loadingShowRaf);
      loadingShowRaf = null;
    }

    if (on) {
      loading.hidden = false;
      loading.setAttribute('aria-hidden', 'false');
      loading.setAttribute('aria-busy', 'true');
      loadingShowRaf = requestAnimationFrame(function () {
        loadingShowRaf = null;
        loading.classList.add('is-visible');
      });
    } else {
      loading.classList.remove('is-visible');
      loading.hidden = true;
      loading.setAttribute('aria-hidden', 'true');
      loading.setAttribute('aria-busy', 'false');
    }
  }

  function consumeFoundingToast() {
    try {
      const msg = sessionStorage.getItem('hub_founding_toast');
      if (!msg) return;
      sessionStorage.removeItem('hub_founding_toast');
      showAlert(msg);
    } catch (e) {
      /* ignore */
    }
  }

  function normalizeBrandHex(value, fallback) {
    var raw = String(value || '').trim();
    if (!raw && fallback) raw = String(fallback).trim();
    if (!raw) return '';
    if (raw[0] !== '#') raw = '#' + raw;
    if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
      raw =
        '#' +
        raw[1] +
        raw[1] +
        raw[2] +
        raw[2] +
        raw[3] +
        raw[3];
    }
    return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : '';
  }

  function syncBrandColorPair(colorEl, hexEl, value) {
    var hex = normalizeBrandHex(value, colorEl ? colorEl.value : '#000000');
    if (colorEl && hex) colorEl.value = hex;
    if (hexEl) hexEl.value = hex || '';
  }

  function readBrandColorsFromForm() {
    return {
      primary: normalizeBrandHex(
        el('ge-brand-primary-hex') && el('ge-brand-primary-hex').value,
        el('ge-brand-primary') && el('ge-brand-primary').value
      ),
      secondary: normalizeBrandHex(
        el('ge-brand-secondary-hex') && el('ge-brand-secondary-hex').value,
        el('ge-brand-secondary') && el('ge-brand-secondary').value
      ),
      accent: normalizeBrandHex(
        el('ge-brand-accent-hex') && el('ge-brand-accent-hex').value,
        el('ge-brand-accent') && el('ge-brand-accent').value
      ),
    };
  }

  function focusBrandFields() {
    var section = el('ge-brand-fields');
    if (section && section.scrollIntoView) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    var primary = el('ge-brand-primary');
    if (primary && primary.focus) {
      try {
        primary.focus({ preventScroll: true });
      } catch {
        primary.focus();
      }
    }
  }

  function fieldHasValue(value) {
    return Boolean(String(value || '').trim());
  }

  function setImportStatus(msg, kind) {
    var statusEl = el('ge-import-status');
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('is-error', kind === 'error');
    statusEl.classList.toggle('is-ok', kind === 'ok');
  }

  function hideImportReview() {
    pendingImport = null;
    var review = el('ge-import-review');
    var list = el('ge-import-review-list');
    if (review) review.hidden = true;
    if (list) list.innerHTML = '';
  }

  function currentImportFieldSnapshot() {
    var g = currentGroup || {};
    return {
      // Colours: only "already set" when saved on the group — pickers always have a default.
      brandPrimaryColor: g.brandPrimaryColor || '',
      brandSecondaryColor: g.brandSecondaryColor || '',
      brandAccentColor: g.brandAccentColor || '',
    };
  }

  function showImportReview(importData, existing) {
    var review = el('ge-import-review');
    var list = el('ge-import-review-list');
    if (!review || !list) return;

    var items = [];
    function pushItem(key, label, value, isColor) {
      if (!fieldHasValue(value)) return;
      var already = fieldHasValue(existing[key]);
      items.push({
        key: key,
        label: label,
        value: value,
        isColor: Boolean(isColor),
        already: already,
        checked: !already,
      });
    }

    // Website import is colours-only — never offer logo, description, or socials.
    pushItem('brandPrimaryColor', 'Primary colour', importData.brandPrimaryColor, true);
    pushItem('brandSecondaryColor', 'Secondary colour', importData.brandSecondaryColor, true);
    pushItem('brandAccentColor', 'Accent colour', importData.brandAccentColor, true);

    pendingImport = { data: importData, items: items };

    if (!items.length) {
      hideImportReview();
      setImportStatus(
        'We couldn’t find brand colours on that site. Set them by hand below, or try another URL.',
        'error'
      );
      return;
    }

    list.innerHTML = items
      .map(function (item, idx) {
        var preview = item.isColor
          ? '<span class="ge-import-review-swatch" style="background:' +
            escHtml(item.value) +
            '"></span>' +
            escHtml(item.value)
          : escHtml(item.value);
        return (
          '<label class="ge-import-review-item">' +
          '<input type="checkbox" data-ge-import-idx="' +
          idx +
          '"' +
          (item.checked ? ' checked' : '') +
          ' />' +
          '<span>' +
          '<strong>' +
          escHtml(item.label) +
          '</strong>' +
          '<span>' +
          preview +
          '</span>' +
          (item.already
            ? '<span class="ge-import-review-note">Already set — tick to replace</span>'
            : '') +
          '</span>' +
          '</label>'
        );
      })
      .join('');
    review.hidden = false;
    setImportStatus(
      'Found ' +
        items.length +
        ' colour' +
        (items.length === 1 ? '' : 's') +
        '. Tick what you want, then Apply to form.',
      'ok'
    );
    requestAnimationFrame(function () {
      var applyBtn = el('ge-import-apply');
      if (applyBtn && applyBtn.scrollIntoView) {
        applyBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (review.scrollIntoView) {
        review.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  function applyImportSelection() {
    var list = el('ge-import-review-list');
    if (!pendingImport || !list) return;
    var selected = {};
    list.querySelectorAll('[data-ge-import-idx]').forEach(function (input) {
      if (!input.checked) return;
      var item = pendingImport.items[Number(input.getAttribute('data-ge-import-idx'))];
      if (item) selected[item.key] = item.value;
    });
    if (!Object.keys(selected).length) {
      setImportStatus('Tick at least one colour to apply.', 'error');
      return;
    }

    if (selected.brandPrimaryColor) {
      syncBrandColorPair(el('ge-brand-primary'), el('ge-brand-primary-hex'), selected.brandPrimaryColor);
    }
    if (selected.brandSecondaryColor) {
      syncBrandColorPair(el('ge-brand-secondary'), el('ge-brand-secondary-hex'), selected.brandSecondaryColor);
    }
    if (selected.brandAccentColor) {
      syncBrandColorPair(el('ge-brand-accent'), el('ge-brand-accent-hex'), selected.brandAccentColor);
    }

    hideImportReview();
    setImportStatus('Colours applied — review, then Save changes.', 'ok');
  }

  async function importFromWebsite() {
    var websiteEl = el('ge-website');
    var importBtn = el('ge-import-website');
    var url = String((websiteEl && websiteEl.value) || '').trim();
    if (!url) {
      setImportStatus('Enter your website URL first.', 'error');
      if (websiteEl) websiteEl.focus();
      return;
    }
    if (isPlatformWebsiteImportUrl(url)) {
      setImportStatus(
        'Enter your own business website (e.g. yourcompany.co.uk), not The Networker Hub.',
        'error'
      );
      if (websiteEl) websiteEl.focus();
      return;
    }
    if (importBtn) {
      importBtn.disabled = true;
      importBtn.textContent = 'Importing…';
    }
    hideImportReview();
    setImportStatus('Reading your website…');
    try {
      var res = await api('/api/organiser/website-brand', {
        method: 'POST',
        body: JSON.stringify({ url: url }),
      });
      if (!res.ok || !res.data || !res.data.ok) {
        throw new Error((res.data && (res.data.message || res.data.error)) || 'Import failed');
      }
      showImportReview(res.data, currentImportFieldSnapshot());
    } catch (e) {
      setImportStatus(e.message || 'Could not read that website.', 'error');
    } finally {
      if (importBtn) {
        importBtn.disabled = false;
        importBtn.textContent = 'Import from website';
      }
    }
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

  function resetActionButtons() {
    ['ge-save-changes', 'ge-save-continue', 'ge-publish', 'ge-save-draft', 'ge-cancel'].forEach(function (id) {
      const btn = el(id);
      if (!btn) return;
      btn.disabled = false;
      btn.classList.remove('is-busy');
      btn.removeAttribute('aria-busy');
      if (btn.dataset.idleLabel != null) {
        btn.textContent = btn.dataset.idleLabel;
        delete btn.dataset.idleLabel;
      }
    });
    if (isEmbedded()) setEmbeddedLoading(false);
  }

  function configureEditActions(g) {
    resetActionButtons();
    const saveChanges = el('ge-save-changes');
    const continueBtn = el('ge-save-continue');
    const publishBtn = el('ge-publish');
    const draftBtn = el('ge-save-draft');
    const hint = el('ge-actions-hint');
    const cancelLink = el('ge-cancel');

    if (saveChanges) {
      saveChanges.hidden = false;
      saveChanges.classList.remove('org-btn-linkish');
      saveChanges.classList.add('org-btn-primary');
      saveChanges.textContent = 'Save changes';
    }
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
    resetActionButtons();
    const saveChanges = el('ge-save-changes');
    const continueBtn = el('ge-save-continue');
    const publishBtn = el('ge-publish');
    const draftBtn = el('ge-save-draft');
    const hint = el('ge-actions-hint');
    const titleEl = el('ge-page-title');
    const leadEl = el('ge-page-lead');
    const launchSetup = config && config.onboardLaunch;

    if (titleEl) titleEl.textContent = 'Your organiser page';
    if (leadEl) {
      leadEl.textContent = launchSetup
        ? 'Confirm logo, description, and contact details. Free guest visits are optional — set them if you offer trial nights.'
        : 'Linked to your account — confirm the details below.';
    }
    if (saveChanges) {
      saveChanges.hidden = false;
      if (launchSetup || (config && config.onboardReview)) {
        saveChanges.classList.add('org-btn-linkish');
        saveChanges.classList.remove('org-btn-primary');
        saveChanges.textContent = 'Save draft changes';
      } else {
        saveChanges.classList.remove('org-btn-linkish');
        saveChanges.classList.add('org-btn-primary');
        saveChanges.textContent = 'Save changes';
      }
    }
    if (continueBtn) {
      continueBtn.hidden = false;
      continueBtn.textContent = launchSetup
        ? 'Looks good — continue setup →'
        : 'Looks good — list my first event →';
      if (saveChanges && continueBtn.parentNode && saveChanges.parentNode === continueBtn.parentNode) {
        continueBtn.parentNode.insertBefore(continueBtn, saveChanges);
      }
    }
    if (publishBtn) publishBtn.hidden = true;
    if (draftBtn) draftBtn.hidden = true;
    if (hint) {
      hint.textContent = launchSetup
        ? 'When this page looks right, continue — next we show any events we have added for you.'
        : 'Update anything that needs changing, then continue to set up your first event listing.';
    }
    if (g) showStatusBadge(g);
  }

  function showMultiProfileTip(existingGroups) {
    const tip = el('ge-multi-profile-tip');
    if (!tip || getEditId() || isEmbedded()) return;
    const count = Array.isArray(existingGroups) ? existingGroups.length : 0;
    if (count < 1) {
      tip.hidden = true;
      tip.textContent = '';
      return;
    }
    const names = existingGroups
      .slice(0, 3)
      .map((g) => g.name || 'Untitled page')
      .join(', ');
    const more = count > 3 ? ' and ' + (count - 3) + ' more' : '';
    tip.innerHTML =
      '<strong>Already have an organiser page?</strong> Only create another if payouts should go to a different bank account or legal entity. ' +
      'If all your events pay into the same account, list them under <strong>' +
      escHtml(names + more) +
      '</strong> instead — one Stripe setup covers every event on that page.';
    tip.hidden = false;
  }

  function escHtml(value) {
    const d = document.createElement('div');
    d.textContent = value == null ? '' : String(value);
    return d.innerHTML;
  }

  function configureCreateActions() {
    resetActionButtons();
    const saveChanges = el('ge-save-changes');
    const continueBtn = el('ge-save-continue');
    const publishBtn = el('ge-publish');
    const draftBtn = el('ge-save-draft');
    const hint = el('ge-actions-hint');
    const cancelLink = el('ge-cancel');
    const statusLine = el('ge-status-line');

    if (saveChanges) saveChanges.hidden = true;
    if (continueBtn) {
      continueBtn.hidden = false;
      continueBtn.textContent = 'Save and create event →';
    }
    if (publishBtn) publishBtn.hidden = true;
    if (draftBtn) draftBtn.hidden = true;
    if (cancelLink) cancelLink.hidden = isEmbedded();
    if (statusLine) statusLine.hidden = true;
    if (hint) {
      hint.textContent =
        'Your profile goes live when you save, then you’ll set up your first event. Verification follows separately.';
    }
  }

  function resetFormState() {
    currentGroup = null;
    formDirty = false;
    showAlert('');
    hideImportReview();
    setImportStatus('');
    const form = el('ge-form');
    if (form) form.reset();
    resetLogoPreview();
    const statusLine = el('ge-status-line');
    if (statusLine) statusLine.hidden = true;
    resetActionButtons();
    ['ge-save-changes', 'ge-save-continue', 'ge-publish', 'ge-save-draft', 'ge-cancel'].forEach((id) => {
      const btn = el(id);
      if (btn) btn.hidden = true;
    });
  }

  function prefillGroup(g) {
    currentGroup = g;
    if (el('ge-name')) el('ge-name').value = g.name || '';
    if (el('ge-description')) el('ge-description').value = g.description || '';
    if (el('ge-website')) el('ge-website').value = g.website || '';
    if (el('ge-instagram')) el('ge-instagram').value = g.instagramUrl || '';
    if (el('ge-facebook')) el('ge-facebook').value = g.facebookUrl || '';
    if (el('ge-linkedin')) el('ge-linkedin').value = g.linkedinUrl || '';
    if (el('ge-x')) el('ge-x').value = g.xUrl || '';
    syncBrandColorPair(el('ge-brand-primary'), el('ge-brand-primary-hex'), g.brandPrimaryColor || '#0d1f3c');
    syncBrandColorPair(el('ge-brand-secondary'), el('ge-brand-secondary-hex'), g.brandSecondaryColor || '#f7f1e8');
    syncBrandColorPair(el('ge-brand-accent'), el('ge-brand-accent-hex'), g.brandAccentColor || '#c9961f');
    if (el('ge-contact-email')) el('ge-contact-email').value = g.contactEmail || '';
    const visitsEl = el('ge-complimentary-visits');
    if (visitsEl) {
      const allowed = g.complimentaryVisitsAllowed != null ? Number(g.complimentaryVisitsAllowed) : 0;
      visitsEl.value = String(Math.min(3, Math.max(0, allowed)));
    }
    const scope = String(g.complimentaryVisitsScope || 'per_group').trim() === 'across_groups'
      ? 'across_groups'
      : 'per_group';
    document.querySelectorAll('input[name="ge-visits-scope"]').forEach((radio) => {
      radio.checked = radio.value === scope;
    });
    const counter = el('ge-word-count');
    if (counter) counter.textContent = String(countWords(g.description || ''));
    const rosterWrap = el('ge-roster-link-wrap');
    const rosterLink = el('ge-roster-link');
    if (rosterWrap && rosterLink && g.id) {
      rosterWrap.hidden = false;
      rosterLink.href =
        '/organiser/#memberships?membershipGroup=' + encodeURIComponent(g.id);
    } else if (rosterWrap) {
      rosterWrap.hidden = true;
    }
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

  function stashGroupContinue(groupId) {
    if (!groupId) return;
    try {
      sessionStorage.setItem(GROUP_CONTINUE_KEY, String(groupId));
    } catch {
      /* ignore */
    }
  }

  function markFormDirty() {
    formDirty = true;
  }

  function bindDirtyTracking() {
    const form = el('ge-form');
    if (!form || form.dataset.geDirtyBound) return;
    form.dataset.geDirtyBound = '1';
    form.addEventListener(
      'input',
      function () {
        markFormDirty();
      },
      true
    );
    form.addEventListener(
      'change',
      function () {
        markFormDirty();
      },
      true
    );
  }

  async function buildPayload() {
    const nameEl = el('ge-name');
    const descEl = el('ge-description');
    const contactEl = el('ge-contact-email');
    const name = nameEl ? nameEl.value.trim() : '';
    if (!name) {
      showAlert('Enter a group name.', 'error');
      if (nameEl) nameEl.focus();
      return null;
    }

    const description = descEl ? descEl.value.trim() : '';
    if (!description) {
      showAlert('Enter a description for your group.', 'error');
      if (descEl) descEl.focus();
      return null;
    }
    if (countWords(description) > DESCRIPTION_MAX_WORDS) {
      showAlert('Description must be ' + DESCRIPTION_MAX_WORDS + ' words or fewer.', 'error');
      if (descEl) descEl.focus();
      return null;
    }

    const contactEmail = contactEl ? contactEl.value.trim() : '';
    if (!contactEmail) {
      showAlert('Enter a contact email.', 'error');
      if (contactEl) contactEl.focus();
      return null;
    }

    const payload = {
      name,
      description,
      website: el('ge-website').value.trim(),
      instagramUrl: el('ge-instagram') ? el('ge-instagram').value.trim() : '',
      facebookUrl: el('ge-facebook') ? el('ge-facebook').value.trim() : '',
      linkedinUrl: el('ge-linkedin') ? el('ge-linkedin').value.trim() : '',
      xUrl: el('ge-x') ? el('ge-x').value.trim() : '',
      brandPrimaryColor: readBrandColorsFromForm().primary || '',
      brandSecondaryColor: readBrandColorsFromForm().secondary || '',
      brandAccentColor: readBrandColorsFromForm().accent || '',
      logoUrl: el('ge-logo-url').value.trim(),
      contactEmail,
      complimentaryVisitsAllowed: el('ge-complimentary-visits')
        ? Math.min(3, Math.max(0, Math.floor(Number(el('ge-complimentary-visits').value) || 0)))
        : 0,
      complimentaryVisitsScope: (function () {
        const scopeRoot = getRoot();
        const checked = (scopeRoot.querySelector
          ? scopeRoot.querySelector('input[name="ge-visits-scope"]:checked')
          : null) || document.querySelector('#org-group-drawer input[name="ge-visits-scope"]:checked')
          || document.querySelector('input[name="ge-visits-scope"]:checked');
        return checked && checked.value === 'across_groups' ? 'across_groups' : 'per_group';
      })(),
    };

    if (logoFile) {
      payload.logoBase64 = await readFileAsBase64(logoFile);
      payload.logoMime = logoFile.type;
      payload.logoFilename = logoFile.name;
    }
    return payload;
  }

  function setActionBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) {
      if (btn.dataset.idleLabel == null) {
        btn.dataset.idleLabel = btn.textContent || '';
      }
      btn.disabled = true;
      btn.classList.add('is-busy');
      btn.setAttribute('aria-busy', 'true');
      if (label) btn.textContent = label;
    } else {
      btn.disabled = false;
      btn.classList.remove('is-busy');
      btn.removeAttribute('aria-busy');
      if (btn.dataset.idleLabel != null) {
        btn.textContent = btn.dataset.idleLabel;
        delete btn.dataset.idleLabel;
      }
    }
  }

  async function saveGroup(mode, triggerBtn) {
    if (saveInFlight) return;
    if (triggerBtn && (triggerBtn.disabled || triggerBtn.classList.contains('is-busy'))) return;
    showAlert('');
    const payload = await buildPayload();
    if (!payload) return;

    saveInFlight = true;

    const editId = getEditId();
    if (mode === 'published') payload.listingStatus = 'published';
    else if (mode === 'draft') payload.listingStatus = 'draft';
    // New profiles via "Save and create event" go live so they appear on the site
    // (verification stays Pending until admin verifies).
    else if (mode === 'continue' && !editId) payload.listingStatus = 'published';

    const saveChanges = el('ge-save-changes');
    const draftBtn = el('ge-save-draft');
    const publishBtn = el('ge-publish');
    const continueBtn = el('ge-save-continue');
    const actionBtns = [saveChanges, draftBtn, publishBtn, continueBtn];
    actionBtns.forEach((b) => {
      if (b) b.disabled = true;
    });

    const onboardReview = Boolean(
      (config && config.onboardReview) || (config && config.onboardLaunch)
    );
    const launchSetup = Boolean(config && config.onboardLaunch);
    const busyLabel =
      mode === 'continue'
        ? onboardReview || launchSetup
          ? 'Continuing…'
          : 'Saving…'
        : 'Saving…';
    setActionBusy(triggerBtn, true, busyLabel);

    let keepBusy = false;
    const continueOnboard =
      mode === 'continue' && (onboardReview || launchSetup) && isEmbedded();
    try {
      if (continueOnboard) {
        setEmbeddedLoading(true, 'Saving your page…');
      }

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
        const err = res.data.error || '';
        if (continueOnboard) setEmbeddedLoading(false);
        if (err === 'group_not_owned') {
          showAlert(
            'This organiser page is not linked to your account yet. Sign in with the email on the profile, or use Request access on the public page.',
            'error'
          );
          return;
        }
        showAlert(res.data.message || err || 'Could not save profile', 'error');
        return;
      }

      const saved = enrichGroupFromApi(res.data.group);
      if (saved) stashSavedGroup(saved);
      formDirty = false;
      if (saved && mode === 'save') {
        prefillGroup(saved);
        formDirty = false;
      }

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

      const hasWarnings = Boolean(logoWarning || logoResolutionWarning || saveWarnings.length);
      if (!continueOnboard) {
        showAlert(msg, hasWarnings ? 'error' : 'ok');
      }
      const qualityHint = el('ge-logo-quality');
      if (logoResolutionWarning && qualityHint) {
        qualityHint.textContent = logoResolutionWarning;
        qualityHint.hidden = false;
      }
      if ((onboardReview || (!editId && mode === 'continue')) && window.HubFlowTour) {
        window.HubFlowTour.markEventTourPending();
      }
      if (onboardReview && window.HubOrganiserOnboarding) {
        window.HubOrganiserOnboarding.markProfileReviewDone();
      }
      if (saved && saved.id && window.HubOrganiserLaunchSetup) {
        const launchMarked = onboardReview || (config && config.onboardLaunch);
        const looksComplete =
          typeof window.HubOrganiserLaunchSetup.profileLooksThin === 'function'
            ? !window.HubOrganiserLaunchSetup.profileLooksThin(saved)
            : false;
        if (launchMarked || looksComplete) {
          window.HubOrganiserLaunchSetup.markProfileDone(saved.id);
        }
        if (launchMarked) {
          try {
            if (window.HubAnalytics && typeof window.HubAnalytics.track === 'function') {
              window.HubAnalytics.track('organiser_claim_funnel', {
                step: 'profile_saved',
                detail: String(saved.slug || saved.name || saved.id || '').slice(0, 80),
              });
            }
          } catch (e) {
            /* ignore */
          }
        }
      }

      // Claim/onboard continue: advance immediately (no second bootstrap wait flash).
      // Other continues keep a short pause so the success message is readable.
      const delay = continueOnboard
        ? hasWarnings
          ? 1200
          : 0
        : hasWarnings
          ? 2200
          : isEmbedded()
            ? 900
            : 700;

      // Only the continue CTA advances setup. Plain "Save changes" stays on the form.
      const continueToEvent = mode === 'continue';

      if (isEmbedded()) {
        if (!(continueToEvent && config.onContinue) && config.onSaved) {
          config.onSaved(saved, mode);
        }
        if (continueToEvent) {
          keepBusy = true;
          setActionBusy(triggerBtn, true, 'Continuing…');
          const advance = async function () {
            try {
              if (config.onContinue) await config.onContinue(saved, mode);
              else {
                stashGroupContinue(saved && saved.id);
                location.href = launchSetup ? '/organiser/?onboard=launch' : '/organiser/#groups';
              }
            } finally {
              if (continueOnboard) setEmbeddedLoading(false);
            }
          };
          if (delay > 0) {
            await new Promise(function (resolve) {
              setTimeout(resolve, delay);
            });
          }
          await advance();
        } else if (mode === 'save' || mode === 'draft' || mode === 'published') {
          /* keep drawer open after save in embedded editor */
        } else {
          setTimeout(function () {
            if (config.onClose) config.onClose();
          }, delay);
        }
        return;
      }

      if (continueToEvent || onboardReview || launchSetup) stashGroupContinue(saved && saved.id);
      if (continueToEvent || onboardReview || launchSetup) {
        keepBusy = true;
        setActionBusy(triggerBtn, true, 'Continuing…');
        setTimeout(function () {
          location.href = launchSetup ? '/organiser/?onboard=launch' : '/organiser/#groups';
        }, delay);
      }
    } finally {
      saveInFlight = false;
      // Always unlock the footer after save/continue finishes — keepBusy used to leave
      // buttons disabled if the drawer stayed open or was reopened without a full reset.
      if (continueOnboard) setEmbeddedLoading(false);
      if (!keepBusy || document.body.classList.contains('org-group-drawer-open')) {
        actionBtns.forEach((b) => {
          if (b) b.disabled = false;
        });
        setActionBusy(triggerBtn, false);
      }
    }
  }

  async function load() {
    const editId = getEditId();
    const onboardReview = Boolean(
      (config && config.onboardReview) || (config && config.onboardLaunch)
    );
    const thisLoad = ++loadGeneration;

    if (!isEmbedded()) {
      const backLink = getRoot().querySelector('.ee-back');
      if (backLink && window.HubOrganiserActions) {
        window.HubOrganiserActions.applyBrowseReturnBack(
          backLink,
          '/organiser/#groups',
          '← Back to organiser pages'
        );
      }
    }

    const sessionRes = await api('/api/auth/session');
    if (thisLoad !== loadGeneration) return;
    if (!sessionRes.ok || !sessionRes.data.user) {
      if (isEmbedded()) {
        showAlert('Your session expired — refresh the page and sign in again.');
        return;
      }
      const nextPath =
        '/organiser/group-edit' + (editId ? '?id=' + encodeURIComponent(editId) : '');
      location.href = '../login?next=' + encodeURIComponent(nextPath);
      return;
    }

    if (onboardReview || (config && config.onboardLaunch)) {
      // Founding toast if set after claim (or publish safety-net award).
      consumeFoundingToast();
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
        if (titleEl) titleEl.textContent = 'Edit organiser page';
        if (leadEl) {
          leadEl.textContent = isEmbedded()
            ? ''
            : 'Update your organiser page — changes appear in your organiser pages list after you save.';
        }
        configureEditActions(null);
      }

      const res = await api('/api/organiser/groups?id=' + encodeURIComponent(editId));
      if (thisLoad !== loadGeneration) return;
      // Never clobber in-progress edits if a stale reload finishes late.
      if (formDirty) {
        if (onboardReview) configureOnboardReviewActions(currentGroup);
        else configureEditActions(currentGroup);
        return;
      }
      if (res.ok && res.data.group) {
        const g = enrichGroupFromApi(res.data.group);
        prefillGroup(g);
        formDirty = false;
        if (onboardReview) configureOnboardReviewActions(g);
        else configureEditActions(g);
      } else {
        const boot = await api('/api/organiser/bootstrap');
        if (thisLoad !== loadGeneration || formDirty) return;
        const local = enrichGroupFromApi((boot.data.groups || []).find((x) => x.id === editId));
        if (local) {
          prefillGroup(local);
          formDirty = false;
          if (onboardReview) configureOnboardReviewActions(local);
          else configureEditActions(local);
        } else showAlert('Could not load this profile.');
      }

      if (onboardReview && !isEmbedded() && window.HubFlowTour) {
        window.HubFlowTour.startGroupTour({ onboardReview: true, force: true, delay: 350 });
      }
    } else {
      if (titleEl) titleEl.textContent = 'New organiser page';
      if (leadEl) {
        leadEl.textContent = isEmbedded()
          ? 'Linked to your account email.'
          : 'Create your organiser group — linked to your account email.';
      }
      configureCreateActions();
      const boot = await api('/api/organiser/bootstrap');
      if (thisLoad !== loadGeneration) return;
      if (boot.ok) showMultiProfileTip(boot.data.groups || []);
      if (!isEmbedded() && window.HubFlowTour) {
        window.HubFlowTour.startGroupTour({ isEdit: false, delay: 350 });
      }
    }

    if (config && config.focusBrand) {
      config.focusBrand = false;
      requestAnimationFrame(function () {
        focusBrandFields();
      });
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

    function handleActionButton(btn, e) {
      if (!btn || btn.disabled || btn.classList.contains('is-busy') || btn.hidden) return;
      const id = btn.id;
      if (id === 'ge-save-changes') {
        if (e) e.preventDefault();
        saveGroup('save', btn);
      } else if (id === 'ge-save-continue') {
        if (e) e.preventDefault();
        saveGroup('continue', btn);
      } else if (id === 'ge-publish') {
        if (e) e.preventDefault();
        saveGroup('published', btn);
      } else if (id === 'ge-save-draft') {
        if (e) e.preventDefault();
        saveGroup('draft', btn);
      } else if (id === 'ge-cancel' && isEmbedded()) {
        if (e) e.preventDefault();
        if (config.onClose) config.onClose();
      }
    }

    function onActionClick(e) {
      const btn = e.target && e.target.closest
        ? e.target.closest(
            '#ge-save-changes, #ge-save-continue, #ge-publish, #ge-save-draft, #ge-cancel'
          )
        : null;
      if (!btn) return;
      // Prefer the direct listener when present to avoid double-firing.
      if (btn.dataset.geClickBound) return;
      handleActionButton(btn, e);
    }

    const actionRoot =
      (config && config.root && config.root.nodeType === 1 && config.root) ||
      document.getElementById('org-group-drawer') ||
      document;
    actionRoot.addEventListener('click', onActionClick);

    // Direct bindings — survive cases where delegated clicks are blocked.
    ['ge-save-changes', 'ge-save-continue', 'ge-publish', 'ge-save-draft', 'ge-cancel'].forEach(
      function (id) {
        const btn = el(id) || document.getElementById(id);
        if (!btn || btn.dataset.geClickBound) return;
        btn.dataset.geClickBound = '1';
        btn.addEventListener('click', function (e) {
          handleActionButton(btn, e);
        });
      }
    );

    function wireColorInputs(colorEl, hexEl) {
      if (!colorEl || !hexEl || colorEl.dataset.geBound) return;
      colorEl.dataset.geBound = '1';
      hexEl.dataset.geBound = '1';
      colorEl.addEventListener('input', function () {
        hexEl.value = colorEl.value;
      });
      hexEl.addEventListener('change', function () {
        var hex = normalizeBrandHex(hexEl.value, colorEl.value);
        if (hex) {
          colorEl.value = hex;
          hexEl.value = hex;
        }
      });
    }
    wireColorInputs(el('ge-brand-primary'), el('ge-brand-primary-hex'));
    wireColorInputs(el('ge-brand-secondary'), el('ge-brand-secondary-hex'));
    wireColorInputs(el('ge-brand-accent'), el('ge-brand-accent-hex'));

    const importBtn = el('ge-import-website');
    if (importBtn && !importBtn.dataset.geBound) {
      importBtn.dataset.geBound = '1';
      importBtn.addEventListener('click', importFromWebsite);
    }
    const importApply = el('ge-import-apply');
    if (importApply && !importApply.dataset.geBound) {
      importApply.dataset.geBound = '1';
      importApply.addEventListener('click', applyImportSelection);
    }
    const importDismiss = el('ge-import-dismiss');
    if (importDismiss && !importDismiss.dataset.geBound) {
      importDismiss.dataset.geBound = '1';
      importDismiss.addEventListener('click', function () {
        hideImportReview();
        setImportStatus('');
      });
    }
  }

  function init(options) {
    config = {
      root: options.root || document,
      editId: options.editId || '',
      onboardReview: Boolean(options.onboardReview),
      onboardLaunch: Boolean(options.onboardLaunch),
      embedded: Boolean(options.embedded),
      onClose: options.onClose || null,
      onSaved: options.onSaved || null,
      onContinue: options.onContinue || null,
    };
    bindEvents();
    bindDirtyTracking();
    bindLogoUpload();
    bindWordCounter();
    return {
      open: openWith,
      reload: load,
      reset: resetFormState,
    };
  }

  function openWith(options) {
    const prevId = getEditId();
    if (options) {
      if (options.root) config.root = options.root;
      if (options.editId != null) config.editId = options.editId;
      if (options.onboardReview != null) config.onboardReview = Boolean(options.onboardReview);
      if (options.onboardLaunch != null) config.onboardLaunch = Boolean(options.onboardLaunch);
      if (options.embedded != null) config.embedded = Boolean(options.embedded);
      if (options.onClose) config.onClose = options.onClose;
      if (options.onSaved) config.onSaved = options.onSaved;
      if (options.onContinue) config.onContinue = options.onContinue;
      if (options.focusBrand != null) config.focusBrand = Boolean(options.focusBrand);
    }
    if (!config) init(options || {});

    const nextId = getEditId();
    const drawerOpen =
      isEmbedded() &&
      document.body.classList.contains('org-group-drawer-open') &&
      String(prevId || '') === String(nextId || '') &&
      formDirty;
    // Same page already open with unsaved edits — keep the form, only refresh callbacks.
    if (drawerOpen) {
      if (config.onboardReview || config.onboardLaunch) configureOnboardReviewActions(currentGroup);
      return Promise.resolve();
    }

    resetFormState();
    if (isEmbedded()) {
      const titleEl = el('ge-page-title');
      const leadEl = el('ge-page-lead');
      const onboard = Boolean(config.onboardReview || config.onboardLaunch);
      if (onboard) {
        if (titleEl) titleEl.textContent = 'Review your organiser page';
        if (leadEl) leadEl.textContent = 'Loading your details…';
      } else if (config.editId) {
        if (titleEl) titleEl.textContent = 'Edit organiser page';
        if (leadEl) leadEl.textContent = 'Loading…';
      }
      setEmbeddedLoading(
        true,
        onboard ? 'Loading your page…' : 'Loading…'
      );
    }
    return Promise.resolve(load()).finally(function () {
      if (isEmbedded()) setEmbeddedLoading(false);
    });
  }

  global.HubGroupEdit = {
    init,
    open: openWith,
    load,
    resetFormState,
  };

  const geForm = document.getElementById('ge-form');
  if (geForm && !geForm.closest('#org-group-drawer')) {
    // Standalone group-edit must never run inside the event drawer iframe —
    // that nests the form (and later the dashboard) under "List event" chrome.
    try {
      if (window.self !== window.top) {
        window.top.location.href = window.location.href;
        return;
      }
    } catch (err) {
      /* cross-origin */
    }
    const params = new URLSearchParams(location.search);
    const onboard = params.get('onboard') || '';
    init({
      editId: params.get('id') || '',
      onboardReview: onboard === 'review' || onboard === 'launch',
      onboardLaunch: onboard === 'launch',
    });
    if (!params.get('id') && window.HubFlowTour) {
      window.HubFlowTour.startGroupTour({ isEdit: false, delay: 0 });
    }
    load();
  }
})(window);
