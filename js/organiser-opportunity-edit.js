/**
 * Business opportunity listing editor.
 */
(function () {
  const params = new URLSearchParams(location.search);
  const editId = params.get('id') || '';
  const checkoutCancelled = params.get('checkout') === 'cancelled';
  const isEmbedDrawer = params.get('embed') === '1' || window.self !== window.top;

  if (isEmbedDrawer) {
    document.documentElement.classList.add('ee-embed-drawer-root');
    if (document.body) document.body.classList.add('ee-embed-drawer');
  }

  let photoFile = null;
  let logoFile = null;
  let currentOpportunity = null;

  const LISTING_MONTHLY_EX_VAT = 25;
  const LISTING_VAT_RATE = 0.2;
  const LISTING_MIN_MONTHS = 3;
  const LISTING_MAX_MONTHS = 36;

  const OPPORTUNITY_TYPES = [
    'franchise',
    'side-hustle',
    'partnership',
    'networking',
    'network-marketing',
    'business-opportunity',
    'distributorship',
  ];

  function getSelectedTypes() {
    return Array.from(document.querySelectorAll('#oe-type-group input[name="oe-type"]:checked'))
      .map((input) => input.value.trim())
      .filter(Boolean);
  }

  function setSelectedTypes(types) {
    const selected = new Set((types || []).filter(Boolean));
    document.querySelectorAll('#oe-type-group input[name="oe-type"]').forEach((input) => {
      input.checked = selected.has(input.value);
    });
  }

  function formatGbp(amount) {
    return '£' + amount.toFixed(2);
  }

  function normalizeListingMonths(value) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < LISTING_MIN_MONTHS) return LISTING_MIN_MONTHS;
    return Math.min(n, LISTING_MAX_MONTHS);
  }

  function monthsForPriceDisplay(value) {
    const raw = String(value ?? '').trim();
    if (raw === '') return LISTING_MIN_MONTHS;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return LISTING_MIN_MONTHS;
    return Math.min(n, LISTING_MAX_MONTHS);
  }

  function updateListingPriceBreakdown(options) {
    const clamp = options && options.clamp;
    const input = document.getElementById('oe-listing-months');
    let months;
    if (clamp && input) {
      months = normalizeListingMonths(input.value);
      if (String(input.value) !== String(months)) input.value = String(months);
    } else {
      months = monthsForPriceDisplay(input ? input.value : null);
    }
    const subtotal = LISTING_MONTHLY_EX_VAT * months;
    const vat = Math.round(subtotal * LISTING_VAT_RATE * 100) / 100;
    const total = subtotal + vat;
    const monthsEl = document.getElementById('oe-price-months');
    const subtotalEl = document.getElementById('oe-price-subtotal');
    const vatEl = document.getElementById('oe-price-vat');
    const totalEl = document.getElementById('oe-price-total');
    if (monthsEl) monthsEl.textContent = String(months);
    if (subtotalEl) subtotalEl.textContent = formatGbp(subtotal);
    if (vatEl) vatEl.textContent = formatGbp(vat);
    if (totalEl) totalEl.textContent = formatGbp(total);
    return months;
  }

  function listingPaymentPanelVisible() {
    const panel = document.getElementById('oe-listing-payment');
    if (!panel) return false;
    if (currentOpportunity && currentOpportunity.listingPaymentActive) {
      panel.hidden = true;
      return false;
    }
    panel.hidden = false;
    return true;
  }

  function parseInvestmentFromForm() {
    const raw = document.getElementById('oe-investment')?.value.trim() || '';
    const num = parseInt(raw.replace(/[^0-9]/g, ''), 10);
    return Number.isNaN(num) ? null : num;
  }

  function hasHighRiskOpportunityType() {
    const types = getSelectedTypes();
    return types.some((type) =>
      ['franchise', 'distributorship', 'partnership', 'business-opportunity', 'network-marketing'].includes(type)
    );
  }

  function requiresFcaDisclaimer() {
    const investment = parseInvestmentFromForm();
    return hasHighRiskOpportunityType() || (investment != null && investment >= 10000);
  }

  function updateFcaAttestVisibility() {
    const wrap = document.getElementById('oe-fca-attest-wrap');
    const field = document.getElementById('oe-fca-attest-field');
    if (!wrap) return;
    const show = requiresFcaDisclaimer();
    wrap.hidden = !show;
    if (field) field.hidden = !show;
    if (!show) {
      const box = document.getElementById('oe-fca-attest');
      if (box) box.checked = false;
    }
  }

  async function startListingCheckout(opportunityId, months) {
    const submitBtn = document.getElementById('oe-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Opening secure checkout…';
    }
    const checkoutBody = { opportunityId: opportunityId, months: months };
    if (requiresFcaDisclaimer()) {
      checkoutBody.fcaDisclaimerAttested = Boolean(document.getElementById('oe-fca-attest')?.checked);
    }
    const res = await api('/api/organiser/opportunity-listing-checkout', {
      method: 'POST',
      body: JSON.stringify(checkoutBody),
    });
    if (res.ok && res.data.url) {
      location.href = res.data.url;
      return;
    }
    const msg =
      res.data.error === 'stripe_not_configured'
        ? 'Listing checkout is not configured yet — contact support.'
        : res.data.message || res.data.error || 'Could not start checkout';
    showAlert(msg);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = currentOpportunity && currentOpportunity.listingPaymentActive
        ? 'Update listing'
        : 'Continue to payment';
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

  function showAlert(msg) {
    const el = document.getElementById('oe-alert');
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.textContent = msg;
    el.hidden = false;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showStatusBadge(opportunity) {
    const badge = document.getElementById('oe-status-badge');
    if (!badge || !opportunity) return;
    const status = String(opportunity.status || 'draft').toLowerCase();
    let label = 'Draft';
    let cls = 'is-draft';
    if (status === 'published') {
      if (opportunity.approvalStatus === 'Approved') {
        label = 'Live';
        cls = 'is-published';
      } else {
        label = 'Pending review';
        cls = 'is-draft';
      }
    }
    badge.textContent = label;
    badge.className = 'ee-status-badge ' + cls;
    badge.hidden = false;
  }

  function metaValue(meta, keyRe) {
    for (let i = 0; i < (meta || []).length; i++) {
      if (keyRe.test(meta[i].key)) return meta[i].val;
    }
    return '';
  }

  function prefillFromOpportunity(opp) {
    currentOpportunity = opp;
    document.getElementById('oe-title').value = opp.title || '';
    const typeTags = (opp.tags || []).filter((tag) => OPPORTUNITY_TYPES.includes(tag));
    setSelectedTypes(typeTags.length ? typeTags : opp.type ? [opp.type] : []);
    document.getElementById('oe-category').value = opp.category || '';
    document.getElementById('oe-desc').value = opp.desc || '';
    document.getElementById('oe-about').value = (opp.about || []).join('\n\n');
    document.getElementById('oe-host').value = opp.host || '';
    document.getElementById('oe-companies-house').value = metaValue(opp.meta, /^companies house$/i);
    document.getElementById('oe-email').value = opp.contactEmail || '';
    document.getElementById('oe-investment').value = metaValue(opp.meta, /^investment$/i);
    document.getElementById('oe-investment-includes').value = metaValue(opp.meta, /^investment includes$/i);
    document.getElementById('oe-location').value = metaValue(opp.meta, /^location$/i);
    document.getElementById('oe-commitment').value = metaValue(opp.meta, /^commitment$/i);
    updateFcaAttestVisibility();

    const usedKeys = new Set(['investment', 'investment includes', 'location', 'commitment', 'companies house']);
    const extra = (opp.meta || []).find((m) => {
      const k = String(m.key || '').toLowerCase();
      return !usedKeys.has(k) && !/^(return|earnings|commission|revenue|income|profit)/i.test(m.key);
    });
    if (extra) {
      document.getElementById('oe-extra-key').value = extra.key;
      document.getElementById('oe-extra-val').value = extra.val;
    }

    if (opp.logoUrl) {
      document.getElementById('oe-logo-url').value = opp.logoUrl;
      const logoPreview = document.getElementById('oe-logo-preview');
      const logoPlaceholder = document.getElementById('oe-logo-placeholder');
      const logoPreviewImg = document.getElementById('oe-logo-preview-img');
      if (logoPreviewImg) logoPreviewImg.src = opp.logoUrl;
      if (logoPreview) logoPreview.hidden = false;
      if (logoPlaceholder) logoPlaceholder.hidden = true;
    }

    if (opp.imageUrl) {
      document.getElementById('oe-photo-url').value = opp.imageUrl;
      const preview = document.getElementById('oe-photo-preview');
      const placeholder = document.getElementById('oe-photo-placeholder');
      const previewImg = document.getElementById('oe-photo-preview-img');
      if (previewImg) previewImg.src = opp.imageUrl;
      if (preview) preview.hidden = false;
      if (placeholder) placeholder.hidden = true;
    }

    showStatusBadge(opp);
    document.getElementById('oe-page-title').textContent = 'Edit opportunity';
    listingPaymentPanelVisible();
    updateListingPriceBreakdown({ clamp: true });
    refreshCompleteness();
    const submitBtn = document.getElementById('oe-submit');
    if (submitBtn) {
      submitBtn.textContent = opp.listingPaymentActive ? 'Update listing' : 'Continue to payment';
    }
  }

  function bindLogoUpload() {
    const zone = document.getElementById('oe-logo-zone');
    const fileInput = document.getElementById('oe-logo-file');
    const preview = document.getElementById('oe-logo-preview');
    const placeholder = document.getElementById('oe-logo-placeholder');
    const previewImg = document.getElementById('oe-logo-preview-img');
    const clearBtn = document.getElementById('oe-logo-clear');

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

    function setLogoFile(file) {
      logoFile = file;
      const reader = new FileReader();
      reader.onload = () => showPreview(reader.result);
      reader.readAsDataURL(file);
    }

    if (zone && window.hubBindImageUpload) {
      window.hubBindImageUpload({ zone, fileInput, onFile: setLogoFile });
    }
    if (zone) {
      zone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (fileInput) fileInput.click();
        }
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetPreview();
        const urlInput = document.getElementById('oe-logo-url');
        if (urlInput) urlInput.value = '';
      });
    }
  }

  function bindPhotoUpload() {
    const zone = document.getElementById('oe-photo-zone');
    const fileInput = document.getElementById('oe-photo-file');
    const preview = document.getElementById('oe-photo-preview');
    const placeholder = document.getElementById('oe-photo-placeholder');
    const previewImg = document.getElementById('oe-photo-preview-img');
    const clearBtn = document.getElementById('oe-photo-clear');

    function showPreview(src) {
      if (previewImg) previewImg.src = src;
      if (preview) preview.hidden = false;
      if (placeholder) placeholder.hidden = true;
    }

    function resetPreview() {
      photoFile = null;
      if (fileInput) fileInput.value = '';
      if (preview) preview.hidden = true;
      if (placeholder) placeholder.hidden = false;
      if (previewImg) previewImg.removeAttribute('src');
    }

    function setPhotoFile(file) {
      photoFile = file;
      const reader = new FileReader();
      reader.onload = () => showPreview(reader.result);
      reader.readAsDataURL(file);
    }

    if (zone && window.hubBindImageUpload) {
      window.hubBindImageUpload({ zone, fileInput, onFile: setPhotoFile });
    }
    if (zone) {
      zone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (fileInput) fileInput.click();
        }
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetPreview();
        const urlInput = document.getElementById('oe-photo-url');
        if (urlInput) urlInput.value = '';
      });
    }
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function buildMeta() {
    const meta = [];
    const investment = document.getElementById('oe-investment').value.trim();
    const location = document.getElementById('oe-location').value.trim();
    const commitment = document.getElementById('oe-commitment').value.trim();
    const extraKey = document.getElementById('oe-extra-key').value.trim();
    const extraVal = document.getElementById('oe-extra-val').value.trim();

    if (investment) meta.push({ key: 'Investment', val: investment });
    const includes = document.getElementById('oe-investment-includes').value.trim();
    if (includes) meta.push({ key: 'Investment includes', val: includes });
    const companiesHouse = document.getElementById('oe-companies-house')?.value.trim() || '';
    if (companiesHouse) meta.push({ key: 'Companies House', val: companiesHouse });
    if (location) meta.push({ key: 'Location', val: location });
    if (extraKey && extraVal && !/^(return|earnings|commission|revenue|income|profit)/i.test(extraKey)) {
      meta.push({ key: extraKey, val: extraVal });
    }
    if (commitment) meta.push({ key: 'Commitment', val: commitment });
    return meta;
  }

  function buildPayload(listingStatus) {
    const types = getSelectedTypes();
    const category = document.getElementById('oe-category').value.trim();
    const tags = types.slice();
    if (category && category !== 'general') tags.push('cat-' + category);

    const aboutText = document.getElementById('oe-about').value.trim();

    return {
      title: document.getElementById('oe-title').value.trim(),
      type: types[0] || '',
      types,
      category,
      description: document.getElementById('oe-desc').value.trim(),
      about: aboutText
        ? aboutText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
        : [],
      aboutText,
      host: document.getElementById('oe-host').value.trim(),
      contactEmail: document.getElementById('oe-email').value.trim(),
      meta: buildMeta(),
      tags,
      listingStatus,
      photoUrl: document.getElementById('oe-photo-url').value.trim(),
      logoUrl: document.getElementById('oe-logo-url').value.trim(),
      fcaDisclaimerAttested: requiresFcaDisclaimer()
        ? Boolean(document.getElementById('oe-fca-attest')?.checked)
        : false,
    };
  }

  function moderationScanInput(payload, options) {
    const scan = window.HubOpportunityModerationScan;
    if (!scan || !scan.scanOpportunityRedFlags) return null;
    return scan.scanOpportunityRedFlags(payload, options);
  }

  function completenessInput() {
    return {
      title: document.getElementById('oe-title')?.value.trim(),
      types: getSelectedTypes(),
      desc: document.getElementById('oe-desc')?.value.trim(),
      about: document.getElementById('oe-about')?.value.trim(),
      host: document.getElementById('oe-host')?.value.trim(),
      email: document.getElementById('oe-email')?.value.trim(),
      investment: document.getElementById('oe-investment')?.value.trim(),
      location: document.getElementById('oe-location')?.value.trim(),
      commitment: document.getElementById('oe-commitment')?.value.trim(),
      investmentIncludes: document.getElementById('oe-investment-includes')?.value.trim(),
      companiesHouse: document.getElementById('oe-companies-house')?.value.trim(),
      logoUrl: document.getElementById('oe-logo-url')?.value.trim(),
      logoFile: logoFile,
      imageUrl: document.getElementById('oe-photo-url')?.value.trim(),
      imageFile: photoFile,
    };
  }

  function refreshCompleteness() {
    const q = window.HubOpportunityQuality;
    const pctEl = document.getElementById('oe-completeness-pct');
    const fillEl = document.getElementById('oe-completeness-fill');
    const tipEl = document.getElementById('oe-completeness-tip');
    if (!q || !q.listingCompleteness || !pctEl || !fillEl) return;

    const result = q.listingCompleteness(completenessInput());
    pctEl.textContent = result.percent + '%';
    fillEl.style.width = result.percent + '%';

    if (tipEl) {
      if (result.missing && result.missing.length) {
        const next = result.missing[0];
        tipEl.textContent = 'Next: ' + next.label + (next.tip ? ' — ' + next.tip : '');
      } else {
        tipEl.textContent = 'Great — your listing has strong detail for browsers.';
      }
    }
  }

  function bindCompletenessScan() {
    const fields = [
      'oe-title',
      'oe-desc',
      'oe-about',
      'oe-host',
      'oe-email',
      'oe-investment',
      'oe-investment-includes',
      'oe-location',
      'oe-commitment',
      'oe-companies-house',
      'oe-logo-url',
      'oe-photo-url',
    ];
    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', refreshCompleteness);
      el.addEventListener('change', refreshCompleteness);
    });
    document.querySelectorAll('#oe-type-group input[name="oe-type"]').forEach((input) => {
      input.addEventListener('change', refreshCompleteness);
    });
  }

  function formatModerationReason(reason) {
    const label = String(reason.label || '').replace(/</g, '&lt;');
    if (reason.id === 'missing_field') {
      const field = label.replace(/^Missing required field:\s*/i, '');
      return 'Add ' + field;
    }
    return label;
  }

  function renderModerationWarnings(scan, isDraft) {
    const panel = document.getElementById('oe-moderation-warnings');
    if (!panel) return;

    if (!scan || !scan.flagged || !scan.reasons || !scan.reasons.length) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }

    const allMissingFields = scan.reasons.every((reason) => reason.id === 'missing_field');
    const hasPolicyIssues = scan.reasons.some((reason) => reason.id !== 'missing_field');

    let title;
    let intro;
    let note;
    let panelClass;

    if (allMissingFields) {
      title = 'A few details still needed';
      intro = isDraft
        ? 'Add these before publishing so browsers can compare your opportunity:'
        : 'Add these so your listing shows clearly on opportunity cards:';
      note =
        'Investment, location, and opportunity type help people understand what you\u2019re offering.';
      panelClass = 'oe-moderation-warnings is-incomplete';
    } else {
      title = 'Please review';
      intro = isDraft
        ? 'Before you publish, please address the following:'
        : 'Please update the following to keep your listing live:';
      note = hasPolicyIssues
        ? 'We don\u2019t allow MLM-style recruitment, guaranteed income claims, or unregulated investment language.'
        : '';
      panelClass = 'oe-moderation-warnings is-flagged';
    }

    const items = scan.reasons
      .map((reason) => '<li>' + formatModerationReason(reason) + '</li>')
      .join('');

    panel.className = panelClass;
    panel.innerHTML =
      '<strong>' +
      title +
      '</strong>' +
      '<p>' +
      intro +
      '</p>' +
      '<ul>' +
      items +
      '</ul>' +
      (note ? '<p class="oe-moderation-warnings-note">' + note + '</p>' : '');
    panel.hidden = false;
  }

  let moderationScanTimer = null;

  function refreshModerationWarnings(isDraft) {
    const payload = buildPayload(isDraft ? 'draft' : 'published');
    const scan = moderationScanInput(payload, { includeMissingFields: !isDraft });
    renderModerationWarnings(scan, isDraft);
    return scan;
  }

  function bindModerationScan() {
    const fields = [
      'oe-title',
      'oe-desc',
      'oe-about',
      'oe-host',
      'oe-investment',
      'oe-investment-includes',
      'oe-location',
      'oe-commitment',
      'oe-companies-house',
      'oe-extra-key',
      'oe-extra-val',
    ];

    function scheduleScan() {
      if (moderationScanTimer) clearTimeout(moderationScanTimer);
      moderationScanTimer = setTimeout(() => refreshModerationWarnings(false), 280);
    }

    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', scheduleScan);
      el.addEventListener('change', scheduleScan);
    });

    document.querySelectorAll('#oe-type-group input[name="oe-type"]').forEach((input) => {
      input.addEventListener('change', scheduleScan);
    });
  }

  function validatePayload(payload, isDraft) {
    if (!payload.title) return 'Enter an opportunity title.';
    if (isDraft) return '';
    if (!payload.types || !payload.types.length) return 'Select at least one opportunity type.';
    if (!payload.description) return 'Add a short description for the card.';
    if (!payload.host) return 'Enter your business or company name.';
    if (!payload.contactEmail) return 'Enter a contact email for enquiries.';
    if (!payload.meta.some((m) => /^investment$/i.test(m.key))) return 'Enter the investment required.';
    if (!payload.meta.some((m) => /^location$/i.test(m.key) || /^territory$/i.test(m.key))) {
      return 'Enter the territory or location for this opportunity.';
    }
    if (!payload.meta.some((m) => /^commitment$/i.test(m.key))) return 'Select a commitment level.';
    if (requiresFcaDisclaimer() && !payload.fcaDisclaimerAttested) {
      return 'Confirm this is not a regulated investment and you will not make guaranteed return claims.';
    }

    const scan = moderationScanInput(payload, { includeMissingFields: true });
    renderModerationWarnings(scan, false);
    if (scan && scan.blocking) {
      const first = scan.reasons && scan.reasons[0] ? scan.reasons[0].label : 'prohibited content';
      return 'Please fix the content issues flagged above before continuing — ' + first + '.';
    }

    return '';
  }

  async function saveOpportunity(options) {
    const publish = options && options.publish;
    showAlert('');

    if (publish && window.HubOrganiserTerms) {
      try {
        await window.HubOrganiserTerms.requireAcceptance();
      } catch (e) {
        return;
      }
    }

    const hasActiveListing =
      currentOpportunity && currentOpportunity.listingPaymentActive && editId;
    const payload = buildPayload(
      publish && hasActiveListing ? 'published' : 'draft'
    );
    const validationError = validatePayload(payload, !publish);
    if (validationError) {
      showAlert(validationError);
      return;
    }

    if (photoFile) {
      payload.photoBase64 = await readFileAsBase64(photoFile);
      payload.photoMime = photoFile.type;
      payload.photoFilename = photoFile.name;
    }

    if (logoFile) {
      payload.logoBase64 = await readFileAsBase64(logoFile);
      payload.logoMime = logoFile.type;
      payload.logoFilename = logoFile.name;
    }

    const submitBtn = document.getElementById('oe-submit');
    const draftBtn = document.getElementById('oe-save-draft');
    const loading = window.organiserPageLoading;
    [submitBtn, draftBtn].forEach((b) => {
      if (b) b.disabled = true;
    });

    const saveWork = async () => {
      if (editId) {
        return api('/api/organiser/opportunities', {
          method: 'PATCH',
          body: JSON.stringify({ id: editId, ...payload }),
        });
      }
      return api('/api/organiser/opportunities', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    };

    let res;
    try {
      if (loading && loading.run) {
        res = await loading.run(
          publish ? (hasActiveListing ? 'Updating listing' : 'Saving listing') : 'Saving draft',
          saveWork
        );
      } else {
        if (loading) loading.show(publish ? 'Saving listing' : 'Saving draft');
        res = await saveWork();
        if (loading) loading.hide();
      }
    } finally {
      [submitBtn, draftBtn].forEach((b) => {
        if (b) b.disabled = false;
      });
    }

    if (!res.ok) {
      const err = res.data.error || '';
      const msg =
        err === 'opportunities_unavailable'
          ? 'Opportunity listings are not available yet — contact support if this persists.'
          : res.data.message || err || 'Could not save opportunity';
      showAlert(msg);
      return;
    }

    const opportunity = res.data.opportunity || {};
    currentOpportunity = opportunity;

    if (!publish) {
      if (!editId && opportunity.id) {
        if (isEmbedDrawer && window.parent && window.parent !== window) {
          window.parent.postMessage(
            { type: 'hub-opportunity-saved', draft: true, id: opportunity.id, title: opportunity.title || '' },
            window.location.origin
          );
          location.replace('/organiser/opportunity-edit?id=' + encodeURIComponent(opportunity.id) + '&embed=1');
          return;
        }
        location.href = '/organiser/opportunity-edit?id=' + encodeURIComponent(opportunity.id);
        return;
      }
      if (isEmbedDrawer && window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'hub-opportunity-saved',
            draft: true,
            id: opportunity.id || editId,
            title: opportunity.title || '',
          },
          window.location.origin
        );
        return;
      }
      showAlert('Draft saved.');
      return;
    }

    if (hasActiveListing) {
      if (isEmbedDrawer && window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'hub-opportunity-saved',
            draft: false,
            id: opportunity.id || editId,
            title: opportunity.title || '',
          },
          window.location.origin
        );
        return;
      }
      showAlert('Listing updated.');
      return;
    }

    const months = updateListingPriceBreakdown({ clamp: true });
    await startListingCheckout(opportunity.id, months);
  }

  async function init() {
    const actions = window.HubOrganiserActions;
    if (actions) {
      const loggedIn = await actions.requireLogin('/organiser/opportunity-edit' + location.search);
      if (!loggedIn) return;
    }

    bindLogoUpload();
    bindPhotoUpload();
    bindModerationScan();
    bindCompletenessScan();
    refreshModerationWarnings(false);
    refreshCompleteness();

    const investmentEl = document.getElementById('oe-investment');
    if (investmentEl) {
      investmentEl.addEventListener('input', updateFcaAttestVisibility);
      investmentEl.addEventListener('change', updateFcaAttestVisibility);
    }
    document.querySelectorAll('#oe-type-group input[name="oe-type"]').forEach((input) => {
      input.addEventListener('change', updateFcaAttestVisibility);
    });
    updateFcaAttestVisibility();

    const backLink = document.getElementById('oe-back-link');
    if (backLink && editId) {
      backLink.href = '/organiser/#business-overview';
      backLink.textContent = '← Back to My business opportunities';
    }

    const monthsInput = document.getElementById('oe-listing-months');
    if (monthsInput) {
      monthsInput.addEventListener('input', function () {
        updateListingPriceBreakdown({ clamp: false });
      });
      monthsInput.addEventListener('change', function () {
        updateListingPriceBreakdown({ clamp: true });
      });
      monthsInput.addEventListener('blur', function () {
        updateListingPriceBreakdown({ clamp: true });
      });
    }
    updateListingPriceBreakdown({ clamp: true });
    listingPaymentPanelVisible();

    if (checkoutCancelled) {
      showAlert('Checkout was cancelled — your draft is saved. Continue to payment when you are ready.');
    }

    if (window.hubBindLocationAutocomplete) {
      window.hubBindLocationAutocomplete(document.getElementById('oe-location'), {
        listClass: 'hub-location-suggest oe-location-suggest',
      });
    }

    const loadWork = async () => {
      if (editId) {
        document.getElementById('oe-page-title').textContent = 'Edit opportunity';
        const res = await api('/api/organiser/opportunities?id=' + encodeURIComponent(editId));
        if (res.ok && res.data.opportunity) {
          prefillFromOpportunity(res.data.opportunity);
        } else {
          showAlert('Could not load this opportunity. Check you have access to this listing.');
        }
        return;
      }

      if (actions) {
        const session = await actions.fetchSession();
        const emailEl = document.getElementById('oe-email');
        if (emailEl && session?.user?.email && !emailEl.value) {
          emailEl.value = session.user.email;
        }
      }
    };

    const loading = window.organiserPageLoading;
    if (loading && loading.run) {
      await loading.run('Loading', loadWork);
    } else {
      if (loading) loading.show('Loading');
      try {
        await loadWork();
      } finally {
        if (loading) loading.hide();
      }
    }
    notifyEmbedDrawerReady();
  }

  function notifyEmbedDrawerReady() {
    if (isEmbedDrawer && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'hub-opportunity-drawer-ready' }, window.location.origin);
    }
  }

  document.getElementById('oe-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveOpportunity({ publish: true });
  });

  document.getElementById('oe-save-draft').addEventListener('click', () => {
    saveOpportunity({ publish: false });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
