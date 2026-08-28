/**
 * Business opportunity listing editor.
 */
(function () {
  const params = new URLSearchParams(location.search);
  const editId = params.get('id') || '';
  const checkoutCancelled = params.get('checkout') === 'cancelled';
  const checkoutStart = params.get('checkout') === 'start';
  const justSubmitted = params.get('submitted') === '1';
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

  const OPPORTUNITY_TYPES = [
    'franchise',
    'side-hustle',
    'partnership',
    'affiliate',
    'networking',
    'network-marketing',
    'business-opportunity',
    'distributorship',
  ];

  const CAPITAL_TYPES = ['franchise', 'distributorship', 'business-opportunity', 'network-marketing', 'partnership'];

  const LISTING_REGIONS = [
    { slug: 'uk-wide', label: 'UK-wide' },
    { slug: 'remote', label: 'Remote / Online' },
    { slug: 'london', label: 'London' },
    { slug: 'manchester', label: 'Manchester' },
    { slug: 'birmingham', label: 'Birmingham' },
    { slug: 'leeds', label: 'Leeds' },
    { slug: 'liverpool', label: 'Liverpool' },
    { slug: 'newcastle', label: 'Newcastle' },
    { slug: 'sheffield', label: 'Sheffield' },
    { slug: 'nottingham', label: 'Nottingham' },
    { slug: 'bristol', label: 'Bristol' },
    { slug: 'brighton', label: 'Brighton' },
    { slug: 'cambridge', label: 'Cambridge' },
    { slug: 'oxford', label: 'Oxford' },
    { slug: 'chester', label: 'Chester' },
    { slug: 'cardiff', label: 'Cardiff & Wales' },
    { slug: 'glasgow', label: 'Glasgow' },
    { slug: 'edinburgh', label: 'Edinburgh' },
    { slug: 'belfast', label: 'Belfast' },
    { slug: 'yorkshire', label: 'Yorkshire (wider area)' },
  ];

  function listingRegionBySlug(slug) {
    const key = String(slug || '').trim().toLowerCase();
    return LISTING_REGIONS.find((row) => row.slug === key) || null;
  }

  function getSelectedListingRegion() {
    const slug = String(document.getElementById('oe-region')?.value || '').trim();
    return listingRegionBySlug(slug);
  }

  function formatListingLocation(region, detail) {
    const row = region || null;
    if (!row) return '';
    const extra = String(detail || '').trim();
    return extra ? row.label + ' — ' + extra : row.label;
  }

  function parseStoredListingLocation(stored, regionSlug) {
    let slugFromRow = String(regionSlug || '').trim().toLowerCase();
    if (slugFromRow === 'online') slugFromRow = 'remote';
    const text = String(stored || '').trim();
    if (slugFromRow && listingRegionBySlug(slugFromRow)) {
      const row = listingRegionBySlug(slugFromRow);
      if (text) {
        const norm = text.toLowerCase();
        const labelNorm = row.label.toLowerCase();
        if (norm.startsWith(labelNorm + ' — ') || norm.startsWith(labelNorm + ' - ')) {
          const sep = text.indexOf('—') >= 0 ? '—' : '-';
          return { slug: slugFromRow, detail: text.slice(text.indexOf(sep) + 1).trim() };
        }
      }
      return { slug: slugFromRow, detail: '' };
    }
    if (!text) return { slug: '', detail: '' };
    const norm = text.toLowerCase();
    if (/remote|online/.test(norm)) return { slug: 'remote', detail: '' };
    if (/uk.?wide|nationwide/.test(norm)) return { slug: 'uk-wide', detail: '' };
    for (let i = 0; i < LISTING_REGIONS.length; i++) {
      const row = LISTING_REGIONS[i];
      const labelNorm = row.label.toLowerCase();
      if (norm === labelNorm || norm === row.slug) return { slug: row.slug, detail: '' };
      if (norm.startsWith(labelNorm + ' — ') || norm.startsWith(labelNorm + ' - ')) {
        return {
          slug: row.slug,
          detail: text.slice(text.indexOf('—') + 1).trim() || text.slice(text.indexOf('-') + 1).trim(),
        };
      }
      if (norm.includes(row.slug) || norm.includes(labelNorm.split(' ')[0])) {
        return { slug: row.slug, detail: '' };
      }
    }
    return { slug: '', detail: text };
  }

  function populateListingRegionSelect() {
    const select = document.getElementById('oe-region');
    if (!select || select.options.length > 1) return;
    LISTING_REGIONS.forEach((row) => {
      const opt = document.createElement('option');
      opt.value = row.slug;
      opt.textContent = row.label;
      select.appendChild(opt);
    });
  }

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

  function isAffiliateStyleListing(types) {
    const list = types || getSelectedTypes();
    if (list.indexOf('affiliate') === -1) return false;
    return !list.some((type) => CAPITAL_TYPES.indexOf(type) !== -1);
  }

  function coerceLegacyAffiliateTypes(types, meta) {
    const list = (types || []).slice();
    if (list.indexOf('affiliate') !== -1) return list;
    if (list.indexOf('partnership') === -1) return list;
    const capitalOthers = ['franchise', 'distributorship', 'business-opportunity', 'network-marketing'];
    if (list.some((type) => capitalOthers.indexOf(type) !== -1)) return list;
    if (!metaValue(meta, /^commission$/i)) return list;
    const investRaw = String(metaValue(meta, /^investment$/i) || '').trim();
    if (investRaw) {
      if (!/^(unlimited|n\/?a|tbc|tba|contact|enquire|varies|negotiable|on request)$/i.test(investRaw)) {
        const num = parseInt(investRaw.replace(/[^0-9]/g, ''), 10);
        if (!Number.isNaN(num) && num > 0) return list;
      }
    }
    return list.map((type) => (type === 'partnership' ? 'affiliate' : type));
  }

  function formatGbp(amount) {
    return '£' + amount.toFixed(2);
  }

  function updateListingPriceBreakdown() {
    const subtotal = LISTING_MONTHLY_EX_VAT;
    const vat = Math.round(subtotal * LISTING_VAT_RATE * 100) / 100;
    const total = subtotal + vat;
    const subtotalEl = document.getElementById('oe-price-subtotal');
    const vatEl = document.getElementById('oe-price-vat');
    const totalEl = document.getElementById('oe-price-total');
    if (subtotalEl) subtotalEl.textContent = formatGbp(subtotal);
    if (vatEl) vatEl.textContent = formatGbp(vat);
    if (totalEl) totalEl.textContent = formatGbp(total);
    return 1;
  }

  function syncAffiliateFormMode(options) {
    const opts = options || {};
    const types = getSelectedTypes();
    const affiliate = isAffiliateStyleListing(types);
    const wasAffiliate = syncAffiliateFormMode.lastAffiliate === true;
    const capitalWrap = document.getElementById('oe-fields-capital');
    const affiliateWrap = document.getElementById('oe-fields-affiliate');
    const investmentEl = document.getElementById('oe-investment');
    const commissionEl = document.getElementById('oe-commission');
    const promoteEl = document.getElementById('oe-promote');
    const metaHeading = document.getElementById('oe-card-meta-heading');
    const metaLead = document.getElementById('oe-card-meta-lead');
    const investmentShortcuts = document.getElementById('oe-investment-shortcuts');
    if (capitalWrap) capitalWrap.hidden = affiliate;
    if (affiliateWrap) affiliateWrap.hidden = !affiliate;
    if (investmentShortcuts) investmentShortcuts.hidden = affiliate;
    if (investmentEl) {
      if (affiliate) investmentEl.removeAttribute('required');
      else investmentEl.setAttribute('required', 'required');
    }
    if (commissionEl) {
      if (affiliate) commissionEl.setAttribute('required', 'required');
      else commissionEl.removeAttribute('required');
    }
    if (promoteEl) {
      if (affiliate) promoteEl.setAttribute('required', 'required');
      else promoteEl.removeAttribute('required');
    }
    if (metaHeading) metaHeading.textContent = affiliate ? 'Card highlights — affiliate' : 'Card highlights';
    if (metaLead) {
      metaLead.textContent = affiliate
        ? 'Commission and what partners promote appear on your card — not franchise-style investment.'
        : 'Investment, region, and commitment appear in the meta row on your listing card.';
    }
    updateTypeModeNote(types, affiliate);
    updateFcaAttestVisibility();
    refreshCompleteness();
    syncAffiliateFormMode.lastAffiliate = affiliate;
    if (opts.scroll && affiliate && !wasAffiliate) {
      const card = document.getElementById('oe-card-meta');
      if (card) {
        window.requestAnimationFrame(function () {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }
  }

  function updateTypeModeNote(types, affiliateMode) {
    const note = document.getElementById('oe-type-mode-note');
    if (!note) return;
    const list = types || getSelectedTypes();
    if (!list.length) {
      note.hidden = true;
      note.textContent = '';
      note.className = 'oe-type-mode-note';
      return;
    }
    const hasAffiliate = list.indexOf('affiliate') !== -1;
    const hasCapital = list.some((type) => CAPITAL_TYPES.indexOf(type) !== -1);
    const affiliate = affiliateMode != null ? affiliateMode : isAffiliateStyleListing(list);

    if (affiliate) {
      note.innerHTML =
        '<strong>Affiliate fields unlocked.</strong> Scroll to <strong>Card highlights — affiliate</strong> below for commission and what you promote. Investment is not required.';
      note.className = 'oe-type-mode-note is-affiliate';
      note.hidden = false;
      return;
    }
    if (hasAffiliate && hasCapital) {
      note.innerHTML =
        '<strong>Affiliate + investment-style types selected.</strong> We use investment fields (not commission) because franchise, partnership, and similar listings need upfront cost details. Your listing still appears under every type you ticked — pick types that truly match what you offer.';
      note.className = 'oe-type-mode-note is-mixed';
      note.hidden = false;
      return;
    }
    if (list.length > 1) {
      note.textContent =
        'Multiple types selected — your listing appears under each filter. Make sure they all describe the same opportunity.';
      note.className = 'oe-type-mode-note';
      note.hidden = false;
      return;
    }
    note.hidden = true;
    note.textContent = '';
    note.className = 'oe-type-mode-note';
  }

  function listingPaymentPanelVisible() {
    const panel = document.getElementById('oe-listing-payment');
    if (!panel) return false;
    if (currentOpportunity && currentOpportunity.listingPaymentActive) {
      panel.hidden = true;
      return false;
    }
    panel.hidden = false;
    const lead = document.getElementById('oe-listing-payment-lead');
    const note = document.getElementById('oe-actions-note');
    const approval = String(
      (currentOpportunity && currentOpportunity.approvalStatus) || ''
    ).trim();
    if (approval === 'Approved') {
      if (lead) {
        lead.innerHTML =
          'Your listing is <strong>approved</strong>. Start a <strong>monthly subscription of £25 + VAT</strong> (£30 total) and it goes live on the directory immediately.';
      }
      if (note) {
        note.textContent =
          'Billed monthly via Stripe — cancel any time from your Stripe customer portal or by contacting us.';
      }
    } else {
      if (lead) {
        lead.innerHTML =
          'Submit your listing for review first — no charge yet. After we approve it, start a <strong>monthly subscription of £25 + VAT</strong> (£30 total) and it goes live immediately.';
      }
      if (note) {
        note.textContent =
          'We review listings before payment. Once approved, you’ll pay via Stripe and go live straight away.';
      }
    }
    return true;
  }

  function primarySubmitLabel() {
    if (currentOpportunity && currentOpportunity.listingPaymentActive) return 'Update listing';
    const approval = String(
      (currentOpportunity && currentOpportunity.approvalStatus) || ''
    ).trim();
    if (approval === 'Approved') return 'Pay to go live';
    if (approval === 'Pending Review') return 'Update submission';
    if (approval === 'Rejected') return 'Resubmit for review';
    return 'Submit for review';
  }

  function syncPrimarySubmitButton() {
    const submitBtn = document.getElementById('oe-submit');
    if (submitBtn) submitBtn.textContent = primarySubmitLabel();
  }

  function parseInvestmentFromForm() {
    const raw = document.getElementById('oe-investment')?.value.trim() || '';
    if (!raw) return null;
    const num = parseInt(raw.replace(/[^0-9]/g, ''), 10);
    return Number.isNaN(num) ? null : num;
  }

  function hasHighRiskOpportunityType() {
    if (isAffiliateStyleListing()) return false;
    const types = getSelectedTypes();
    return types.some((type) => CAPITAL_TYPES.indexOf(type) !== -1);
  }

  function requiresFcaDisclaimer() {
    const investment = parseInvestmentFromForm();
    return hasHighRiskOpportunityType() || (investment != null && investment >= 10000);
  }

  function updateFcaAttestVisibility() {
    const panel = document.getElementById('oe-fca-attest-panel');
    const wrap = document.getElementById('oe-fca-attest-wrap');
    const lead = document.getElementById('oe-fca-attest-lead');
    if (!panel || !wrap) return;
    const show = requiresFcaDisclaimer();
    panel.hidden = !show;
    if (lead) {
      const investment = parseInvestmentFromForm();
      if (investment != null && investment >= 10000 && !hasHighRiskOpportunityType()) {
        lead.textContent =
          'Required because your investment is £10,000 or more — confirm this before submitting.';
      } else {
        lead.textContent =
          'Required before you submit franchise, partnership, distributorship, or high-investment listings.';
      }
    }
    if (!show) {
      const box = document.getElementById('oe-fca-attest');
      if (box) box.checked = false;
    }
  }

  async function startListingCheckout(opportunityId) {
    const submitBtn = document.getElementById('oe-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Opening secure checkout…';
    }
    const checkoutBody = { opportunityId: opportunityId };
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
      submitBtn.textContent = primarySubmitLabel();
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
    const approval = String(opportunity.approvalStatus || '').trim();
    let label = 'Draft';
    let cls = 'is-draft';
    if (opportunity.listingPaymentActive && status === 'published' && approval === 'Approved') {
      label = 'Live';
      cls = 'is-published';
    } else if (approval === 'Approved') {
      label = 'Approved — pay to go live';
      cls = 'is-draft';
    } else if (approval === 'Rejected') {
      label = 'Not approved';
      cls = 'is-draft';
    } else if (approval === 'Pending Review') {
      label = 'Pending review';
      cls = 'is-draft';
    } else if (status === 'published') {
      label = 'Pending review';
      cls = 'is-draft';
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
    const initialTypes = typeTags.length ? typeTags : opp.type ? [opp.type] : [];
    setSelectedTypes(coerceLegacyAffiliateTypes(initialTypes, opp.meta));
    document.getElementById('oe-category').value = opp.category || '';
    document.getElementById('oe-desc').value = opp.desc || '';
    document.getElementById('oe-about').value = (opp.about || []).join('\n\n');
    document.getElementById('oe-host').value = opp.host || '';
    document.getElementById('oe-companies-house').value = metaValue(opp.meta, /^companies house$/i);
    document.getElementById('oe-email').value = opp.contactEmail || '';
    document.getElementById('oe-investment').value = metaValue(opp.meta, /^investment$/i);
    document.getElementById('oe-investment-includes').value = metaValue(opp.meta, /^investment includes$/i);
    const commissionEl = document.getElementById('oe-commission');
    const promoteEl = document.getElementById('oe-promote');
    const suitsEl = document.getElementById('oe-suits');
    if (commissionEl) commissionEl.value = metaValue(opp.meta, /^commission$/i);
    if (promoteEl) promoteEl.value = metaValue(opp.meta, /^what you promote$/i);
    if (suitsEl) suitsEl.value = metaValue(opp.meta, /^who it suits$/i);
    const parsed = parseStoredListingLocation(
      metaValue(opp.meta, /^location$/i) || metaValue(opp.meta, /^territory$/i),
      opp.regionSlug || opp.region_slug
    );
    document.getElementById('oe-location-detail').value = parsed.detail || '';
    document.getElementById('oe-region').value = parsed.slug || '';
    document.getElementById('oe-commitment').value = metaValue(opp.meta, /^commitment$/i);
    syncAffiliateFormMode();

    const usedKeys = new Set([
      'investment',
      'investment includes',
      'location',
      'commitment',
      'companies house',
      'commission',
      'what you promote',
      'who it suits',
    ]);
    const extra = (opp.meta || []).find((m) => {
      const k = String(m.key || '').toLowerCase();
      return !usedKeys.has(k) && !/^(return|earnings|revenue|income|profit)/i.test(m.key);
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
      if (logoPreviewImg) {
        logoPreviewImg.src = opp.logoUrl;
        syncLogoPreviewContrast(logoPreviewImg, opp.logoUrl);
      }
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
    updateListingPriceBreakdown();
    refreshCompleteness();
    syncPrimarySubmitButton();
  }

  function logoSuggestsDarkPad(url) {
    if (window.CmsSponsorFields && window.CmsSponsorFields.logoUrlSuggestsDarkBand) {
      return window.CmsSponsorFields.logoUrlSuggestsDarkBand(url);
    }
    var path = String(url || '')
      .split('?')[0]
      .split('#')[0]
      .toLowerCase();
    return /(?:^|[\/_\-.])(?:logo[_-]?)?(?:text[_-]?)?white(?:[\/_\-.]|$)/.test(path);
  }

  function syncLogoPreviewContrast(img, src) {
    if (!img) return;
    var dark = logoSuggestsDarkPad(src || img.src || '');
    img.classList.toggle('is-logo-dark', dark);
  }

  function bindLogoUpload() {
    const zone = document.getElementById('oe-logo-zone');
    const fileInput = document.getElementById('oe-logo-file');
    const preview = document.getElementById('oe-logo-preview');
    const placeholder = document.getElementById('oe-logo-placeholder');
    const previewImg = document.getElementById('oe-logo-preview-img');
    const clearBtn = document.getElementById('oe-logo-clear');
    const urlInput = document.getElementById('oe-logo-url');

    function showPreview(src) {
      if (previewImg) {
        previewImg.src = src;
        syncLogoPreviewContrast(previewImg, src);
      }
      if (preview) preview.hidden = false;
      if (placeholder) placeholder.hidden = true;
    }

    function resetPreview() {
      logoFile = null;
      if (fileInput) fileInput.value = '';
      if (preview) preview.hidden = true;
      if (placeholder) placeholder.hidden = false;
      if (previewImg) {
        previewImg.removeAttribute('src');
        previewImg.classList.remove('is-logo-dark');
      }
    }

    function setLogoFile(file) {
      logoFile = file;
      const reader = new FileReader();
      reader.onload = () => showPreview(reader.result);
      reader.readAsDataURL(file);
      refreshCompleteness();
      syncVisualRequirement(false);
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
        if (urlInput) urlInput.value = '';
        refreshCompleteness();
        syncVisualRequirement(false);
      });
    }
    if (urlInput) {
      urlInput.addEventListener('input', () => {
        const url = String(urlInput.value || '').trim();
        if (url) showPreview(url);
        refreshCompleteness();
        syncVisualRequirement(false);
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
      refreshCompleteness();
      syncVisualRequirement(false);
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
        refreshCompleteness();
        syncVisualRequirement(false);
      });
    }
    const photoUrlInput = document.getElementById('oe-photo-url');
    if (photoUrlInput) {
      photoUrlInput.addEventListener('input', () => {
        const url = String(photoUrlInput.value || '').trim();
        if (url) showPreview(url);
        refreshCompleteness();
        syncVisualRequirement(false);
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

  function hasListingImage(payload) {
    if (photoFile || logoFile) return true;
    const p = payload || buildPayload('draft');
    if (String(p.photoUrl || '').trim() || String(p.logoUrl || '').trim()) return true;
    const logoPreview = document.getElementById('oe-logo-preview');
    const photoPreview = document.getElementById('oe-photo-preview');
    if (logoPreview && !logoPreview.hidden && document.getElementById('oe-logo-preview-img')?.src) {
      return true;
    }
    if (photoPreview && !photoPreview.hidden && document.getElementById('oe-photo-preview-img')?.src) {
      return true;
    }
    return false;
  }

  function syncVisualRequirement(showMissing) {
    const note = document.getElementById('oe-visual-requirement');
    if (!note) return;
    const missing = showMissing && !hasListingImage(buildPayload('draft'));
    note.hidden = !missing;
  }

  function scrollToValidationField(message) {
    const msg = String(message || '').toLowerCase();
    let id = '';
    if (/territory|location|region/.test(msg)) id = 'oe-region';
    else if (/logo|photo|cover|image/.test(msg)) id = 'oe-card-host';
    else if (/commission/.test(msg)) id = 'oe-commission';
    else if (/promote/.test(msg)) id = 'oe-promote';
    else if (/investment/.test(msg)) id = 'oe-investment';
    else if (/commitment/.test(msg)) id = 'oe-commitment';
    else if (/type/.test(msg)) id = 'oe-type-group';
    else if (/declaration|regulated investment/.test(msg)) id = 'oe-fca-attest-panel';
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const focusable = el.querySelector('input, select, textarea, button');
    if (focusable && typeof focusable.focus === 'function') {
      focusable.focus({ preventScroll: true });
    }
    if (id === 'oe-region') {
      document.getElementById('oe-location-field')?.classList.add('is-invalid');
    }
  }

  function buildMeta() {
    const meta = [];
    const affiliate = isAffiliateStyleListing();
    const region = getSelectedListingRegion();
    const locationDetail = document.getElementById('oe-location-detail')?.value.trim() || '';
    const location = formatListingLocation(region, locationDetail);
    const commitment = document.getElementById('oe-commitment').value.trim();
    const extraKey = document.getElementById('oe-extra-key').value.trim();
    const extraVal = document.getElementById('oe-extra-val').value.trim();

    if (affiliate) {
      const commission = document.getElementById('oe-commission')?.value.trim() || '';
      const promote = document.getElementById('oe-promote')?.value.trim() || '';
      const suits = document.getElementById('oe-suits')?.value.trim() || '';
      if (commission) meta.push({ key: 'Commission', val: commission });
      if (promote) meta.push({ key: 'What you promote', val: promote });
      if (suits) meta.push({ key: 'Who it suits', val: suits });
    } else {
      const investment = document.getElementById('oe-investment').value.trim();
      if (investment) meta.push({ key: 'Investment', val: investment });
      const includes = document.getElementById('oe-investment-includes').value.trim();
      if (includes) meta.push({ key: 'Investment includes', val: includes });
    }

    const companiesHouse = document.getElementById('oe-companies-house')?.value.trim() || '';
    if (companiesHouse) meta.push({ key: 'Companies House', val: companiesHouse });
    if (location) meta.push({ key: 'Location', val: location });
    if (
      extraKey &&
      extraVal &&
      !/^(return|earnings|revenue|income|profit)/i.test(extraKey) &&
      !/^(commission|what you promote|who it suits|investment)/i.test(extraKey)
    ) {
      meta.push({ key: extraKey, val: extraVal });
    }
    if (commitment) meta.push({ key: 'Commitment', val: commitment });
    return meta;
  }

  function buildPayload(listingStatus) {
    const types = getSelectedTypes();
    const category = document.getElementById('oe-category').value.trim();
    const region = getSelectedListingRegion();
    const locationDetail = document.getElementById('oe-location-detail')?.value.trim() || '';
    const tags = types.slice();
    if (category && category !== 'general') tags.push('cat-' + category);

    const aboutText = document.getElementById('oe-about').value.trim();
    const aboutBlocks = aboutText
      ? aboutText
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .split(/\n\s*\n/)
          .map((p) => p.replace(/^\s+|\s+$/g, ''))
          .filter(Boolean)
      : [];

    return {
      title: document.getElementById('oe-title').value.trim(),
      type: types[0] || '',
      types,
      category,
      description: document.getElementById('oe-desc').value.trim(),
      about: aboutBlocks,
      aboutText,
      host: document.getElementById('oe-host').value.trim(),
      contactEmail: document.getElementById('oe-email').value.trim(),
      location: formatListingLocation(region, locationDetail),
      regionSlug: region ? region.slug : '',
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
      affiliateStyle: isAffiliateStyleListing(),
      desc: document.getElementById('oe-desc')?.value.trim(),
      about: document.getElementById('oe-about')?.value.trim(),
      host: document.getElementById('oe-host')?.value.trim(),
      email: document.getElementById('oe-email')?.value.trim(),
      investment: document.getElementById('oe-investment')?.value.trim(),
      commission: document.getElementById('oe-commission')?.value.trim(),
      promote: document.getElementById('oe-promote')?.value.trim(),
      suits: document.getElementById('oe-suits')?.value.trim(),
      location: formatListingLocation(getSelectedListingRegion(), document.getElementById('oe-location-detail')?.value.trim()),
      regionSlug: getSelectedListingRegion()?.slug || '',
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
    syncVisualRequirement(false);
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
      'oe-commission',
      'oe-promote',
      'oe-suits',
      'oe-location-detail',
      'oe-region',
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
      'oe-commission',
      'oe-promote',
      'oe-suits',
      'oe-location-detail',
      'oe-region',
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
    if (isAffiliateStyleListing(payload.types)) {
      if (!payload.meta.some((m) => /^commission$/i.test(m.key))) {
        return 'Enter the commission (e.g. 20% recurring or £50 per sale).';
      }
      if (!payload.meta.some((m) => /^what you promote$/i.test(m.key))) {
        return 'Say what partners promote.';
      }
    } else if (!payload.meta.some((m) => /^investment$/i.test(m.key))) {
      return 'Enter the investment required.';
    }
    if (!getSelectedListingRegion()) {
      return 'Select the region where this opportunity is available.';
    }
    if (!payload.meta.some((m) => /^commitment$/i.test(m.key))) return 'Select a commitment level.';
    if (!isDraft && !hasListingImage(payload)) {
      return 'Add a business logo or cover photo before submitting.';
    }
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
    const approval = String(
      (currentOpportunity && currentOpportunity.approvalStatus) || ''
    ).trim();
    const awaitingPayment = approval === 'Approved' && !hasActiveListing;

    // Approved + unpaid → open Stripe. Otherwise submit for review (no charge yet).
    if (publish && awaitingPayment) {
      if (!editId && !(currentOpportunity && currentOpportunity.id)) {
        showAlert('Save your listing before starting checkout.');
        return;
      }
      const payloadCheck = buildPayload('draft');
      const validationError = validatePayload(payloadCheck, false);
      if (validationError) {
        showAlert(validationError);
        scrollToValidationField(validationError);
        syncVisualRequirement(true);
        return;
      }
      await startListingCheckout(editId || currentOpportunity.id);
      return;
    }

    const payload = buildPayload(publish && hasActiveListing ? 'published' : 'draft');
    if (publish && !hasActiveListing) {
      payload.submitForReview = true;
    }
    const validationError = validatePayload(payload, !publish);
    if (validationError) {
      showAlert(validationError);
      scrollToValidationField(validationError);
      syncVisualRequirement(true);
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
          publish
            ? hasActiveListing
              ? 'Updating listing'
              : 'Submitting for review'
            : 'Saving draft',
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
      syncPrimarySubmitButton();
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
    showStatusBadge(opportunity);
    listingPaymentPanelVisible();
    syncPrimarySubmitButton();

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

    if (isEmbedDrawer && window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'hub-opportunity-saved',
          draft: false,
          pendingReview: true,
          id: opportunity.id || editId,
          title: opportunity.title || '',
        },
        window.location.origin
      );
      return;
    }

    showAlert(
      'Submitted for review. We’ll email you when it’s approved — then you can pay via Stripe to go live.'
    );
    if (opportunity.id && !editId) {
      location.href =
        '/organiser/opportunity-edit?id=' + encodeURIComponent(opportunity.id) + '&submitted=1';
    }
  }

  async function init() {
    populateListingRegionSelect();

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
      input.addEventListener('change', function () {
        syncAffiliateFormMode({ scroll: true });
        updateFcaAttestVisibility();
      });
    });
    document.querySelectorAll('.oe-investment-chip').forEach((btn) => {
      btn.addEventListener('click', function () {
        const investmentEl = document.getElementById('oe-investment');
        const value = btn.getAttribute('data-investment-value') || '';
        if (investmentEl && value) {
          investmentEl.value = value;
          investmentEl.dispatchEvent(new Event('input', { bubbles: true }));
          investmentEl.focus();
        }
        refreshCompleteness();
        updateFcaAttestVisibility();
      });
    });
    populateListingRegionSelect();

    const regionEl = document.getElementById('oe-region');
    if (regionEl) {
      regionEl.addEventListener('change', function () {
        if (regionEl.value) {
          document.getElementById('oe-location-field')?.classList.remove('is-invalid');
        }
        refreshCompleteness();
      });
    }
    syncAffiliateFormMode();
    updateFcaAttestVisibility();

    const backLink = document.getElementById('oe-back-link');
    if (backLink && editId) {
      backLink.href = '/organiser/#business-overview';
      backLink.textContent = '← Back to My business opportunities';
    }

    updateListingPriceBreakdown();
    listingPaymentPanelVisible();
    syncPrimarySubmitButton();

    if (checkoutCancelled) {
      showAlert(
        'Checkout was cancelled. Your listing stays approved — pay via Stripe when you are ready to go live.'
      );
    } else     if (justSubmitted) {
      showAlert(
        'Submitted for review. We’ll email you when it’s approved — then you can pay via Stripe to go live.'
      );
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

    if (
      checkoutStart &&
      currentOpportunity &&
      currentOpportunity.approvalStatus === 'Approved' &&
      !currentOpportunity.listingPaymentActive
    ) {
      await startListingCheckout(currentOpportunity.id || editId);
      return;
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
