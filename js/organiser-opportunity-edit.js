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
  let oeFormBaseline = '';
  let oeFormDirty = false;
  let oeSkipUnloadGuard = false;

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

  const AFFILIATE_TYPE = 'affiliate';

  const TYPE_LABELS = {
    franchise: 'Franchise',
    'side-hustle': 'Side hustle',
    partnership: 'Partnership',
    affiliate: 'Affiliate',
    networking: 'Networking / Ambassador',
    'network-marketing': 'Network marketing',
    'business-opportunity': 'Business opportunity',
    distributorship: 'Distributorship',
  };

  const TYPE_CATEGORY_HINTS = {
    franchise: 'retail',
    'network-marketing': 'mlm',
  };

  const OE_STEP_ORDER = ['details', 'host', 'meta', 'photo', 'submit'];

  let oeStepsConfirmed = {
    details: false,
    host: false,
    meta: false,
    photo: false,
  };
  let oeFlowRevealAll = false;

  const LISTING_REGION_BROAD = [
    { slug: 'uk-wide', label: 'UK-wide' },
    { slug: 'england', label: 'England' },
    { slug: 'scotland', label: 'Scotland' },
    { slug: 'wales', label: 'Wales' },
    { slug: 'northern-ireland', label: 'Northern Ireland' },
    { slug: 'remote', label: 'Remote / Online' },
    { slug: 'london', label: 'London (all areas)' },
  ];

  const LISTING_REGION_BROAD_SLUGS = new Set(
    LISTING_REGION_BROAD.map(function (row) {
      return row.slug;
    })
  );

  const LISTING_REGION_SPECIFIC_VALUE = '__specific__';

  const LISTING_REGION_GROUPS = [
    {
      label: 'Nationwide',
      regions: [
        { slug: 'uk-wide', label: 'UK-wide' },
        { slug: 'england', label: 'England' },
        { slug: 'scotland', label: 'Scotland' },
        { slug: 'wales', label: 'Wales' },
        { slug: 'northern-ireland', label: 'Northern Ireland' },
        { slug: 'remote', label: 'Remote / Online' },
      ],
    },
    {
      label: 'Counties',
      regions: [
        { slug: 'berkshire', label: 'Berkshire' },
        { slug: 'buckinghamshire', label: 'Buckinghamshire' },
        { slug: 'cambridgeshire', label: 'Cambridgeshire' },
        { slug: 'cheshire', label: 'Cheshire' },
        { slug: 'essex', label: 'Essex' },
        { slug: 'hampshire', label: 'Hampshire' },
        { slug: 'hertfordshire', label: 'Hertfordshire' },
        { slug: 'kent', label: 'Kent' },
        { slug: 'lancashire', label: 'Lancashire' },
        { slug: 'oxfordshire', label: 'Oxfordshire' },
        { slug: 'surrey', label: 'Surrey' },
        { slug: 'sussex', label: 'Sussex' },
      ],
    },
    {
      label: 'Wider regions',
      regions: [
        { slug: 'yorkshire', label: 'Yorkshire' },
        { slug: 'north-west', label: 'North West England' },
        { slug: 'north-east', label: 'North East England' },
        { slug: 'east-midlands', label: 'East Midlands' },
        { slug: 'west-midlands', label: 'West Midlands' },
        { slug: 'east-of-england', label: 'East of England' },
        { slug: 'south-east', label: 'South East England' },
        { slug: 'south-west', label: 'South West England' },
      ],
    },
    {
      label: 'London',
      regions: [
        { slug: 'london', label: 'London (all areas)' },
        { slug: 'central-london', label: 'Central London' },
        { slug: 'north-london', label: 'North London' },
        { slug: 'south-london', label: 'South London' },
        { slug: 'east-london', label: 'East London' },
        { slug: 'west-london', label: 'West London' },
      ],
    },
    {
      label: 'Cities & towns',
      regions: [
        { slug: 'belfast', label: 'Belfast' },
        { slug: 'birmingham', label: 'Birmingham' },
        { slug: 'bournemouth', label: 'Bournemouth' },
        { slug: 'brighton', label: 'Brighton' },
        { slug: 'bristol', label: 'Bristol' },
        { slug: 'cambridge', label: 'Cambridge' },
        { slug: 'cardiff', label: 'Cardiff' },
        { slug: 'chester', label: 'Chester' },
        { slug: 'edinburgh', label: 'Edinburgh' },
        { slug: 'glasgow', label: 'Glasgow' },
        { slug: 'leeds', label: 'Leeds' },
        { slug: 'leicester', label: 'Leicester' },
        { slug: 'liverpool', label: 'Liverpool' },
        { slug: 'manchester', label: 'Manchester' },
        { slug: 'newcastle', label: 'Newcastle' },
        { slug: 'nottingham', label: 'Nottingham' },
        { slug: 'oxford', label: 'Oxford' },
        { slug: 'reading', label: 'Reading' },
        { slug: 'sheffield', label: 'Sheffield' },
      ],
    },
  ];

  const LISTING_REGIONS = LISTING_REGION_GROUPS.reduce(function (acc, group) {
    return acc.concat(group.regions);
  }, []);

  const LISTING_REGION_LEGACY = {
    online: 'remote',
  };

  function listingRegionBySlug(slug) {
    let key = String(slug || '').trim().toLowerCase();
    if (LISTING_REGION_LEGACY[key]) key = LISTING_REGION_LEGACY[key];
    return LISTING_REGIONS.find((row) => row.slug === key) || null;
  }

  function getSelectedListingRegion() {
    const broadEl = document.getElementById('oe-region-broad');
    if (broadEl && broadEl.value && broadEl.value !== LISTING_REGION_SPECIFIC_VALUE) {
      return listingRegionBySlug(broadEl.value);
    }
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
    if (/^england$/.test(norm)) return { slug: 'england', detail: '' };
    if (/^scotland$/.test(norm)) return { slug: 'scotland', detail: '' };
    if (/^wales$/.test(norm)) return { slug: 'wales', detail: '' };
    if (/northern ireland/.test(norm)) return { slug: 'northern-ireland', detail: '' };
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

  function populateListingRegionBroadSelect() {
    const select = document.getElementById('oe-region-broad');
    if (!select || select.dataset.regionsPopulated === '1') return;
    LISTING_REGION_BROAD.forEach(function (row) {
      const opt = document.createElement('option');
      opt.value = row.slug;
      opt.textContent = row.label;
      select.appendChild(opt);
    });
    const specific = document.createElement('option');
    specific.value = LISTING_REGION_SPECIFIC_VALUE;
    specific.textContent = 'A specific city or county…';
    select.appendChild(specific);
    select.dataset.regionsPopulated = '1';
  }

  function populateListingRegionSelect() {
    const select = document.getElementById('oe-region');
    if (!select || select.dataset.regionsPopulated === '1') return;
    LISTING_REGION_GROUPS.forEach(function (group) {
      if (group.label === 'Nationwide') return;
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.label;
      group.regions.forEach(function (row) {
        if (group.label === 'London' && row.slug === 'london') return;
        const opt = document.createElement('option');
        opt.value = row.slug;
        opt.textContent = row.label;
        optgroup.appendChild(opt);
      });
      if (optgroup.children.length) select.appendChild(optgroup);
    });
    select.dataset.regionsPopulated = '1';
  }

  function syncListingRegionPickers() {
    const broadEl = document.getElementById('oe-region-broad');
    const specificWrap = document.getElementById('oe-region-specific-wrap');
    const specificEl = document.getElementById('oe-region');
    if (!broadEl) return;
    const isSpecific = broadEl.value === LISTING_REGION_SPECIFIC_VALUE;
    if (specificWrap) specificWrap.hidden = !isSpecific;
    if (specificEl) {
      if (isSpecific) specificEl.setAttribute('required', 'required');
      else specificEl.removeAttribute('required');
    }
  }

  function setListingRegionSlug(slug) {
    const key = String(slug || '').trim().toLowerCase();
    const broadEl = document.getElementById('oe-region-broad');
    const specificEl = document.getElementById('oe-region');
    if (!broadEl) return;
    if (key && LISTING_REGION_BROAD_SLUGS.has(key)) {
      broadEl.value = key;
      if (specificEl) specificEl.value = '';
    } else if (key) {
      broadEl.value = LISTING_REGION_SPECIFIC_VALUE;
      populateListingRegionSelect();
      if (specificEl) specificEl.value = key;
    } else {
      broadEl.value = '';
      if (specificEl) specificEl.value = '';
    }
    syncListingRegionPickers();
  }

  function bindListingRegionPickers() {
    populateListingRegionBroadSelect();
    populateListingRegionSelect();
    const broadEl = document.getElementById('oe-region-broad');
    if (broadEl) {
      broadEl.addEventListener('change', function () {
        syncListingRegionPickers();
        if (broadEl.value !== LISTING_REGION_SPECIFIC_VALUE) {
          const specificEl = document.getElementById('oe-region');
          if (specificEl) specificEl.value = '';
        }
        document.getElementById('oe-location-field')?.classList.remove('is-invalid');
        refreshCompleteness();
      });
    }
    const specificEl = document.getElementById('oe-region');
    if (specificEl) {
      specificEl.addEventListener('change', function () {
        document.getElementById('oe-location-field')?.classList.remove('is-invalid');
        refreshCompleteness();
      });
    }
    syncListingRegionPickers();
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

  function normalizeExclusiveTypes(types) {
    const list = (types || []).filter(Boolean);
    if (list.indexOf(AFFILIATE_TYPE) === -1) return list;
    if (list.length === 1) return list;
    const hasCapital = list.some((type) => CAPITAL_TYPES.indexOf(type) !== -1);
    if (hasCapital) return list.filter((type) => type !== AFFILIATE_TYPE);
    return [AFFILIATE_TYPE];
  }

  function reconcileTypeSelection(changedInput) {
    if (!changedInput) return;
    const value = changedInput.value;
    const nowChecked = changedInput.checked;
    if (value === AFFILIATE_TYPE && nowChecked) {
      setSelectedTypes([AFFILIATE_TYPE]);
      return;
    }
    if (value !== AFFILIATE_TYPE && nowChecked) {
      const affiliateInput = document.querySelector('#oe-type-group input[value="' + AFFILIATE_TYPE + '"]');
      if (affiliateInput && affiliateInput.checked) affiliateInput.checked = false;
    }
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
    const types = getSelectedTypes();
    const affiliate = isAffiliateStyleListing(types);
    const wasAffiliate = syncAffiliateFormMode.lastAffiliate === true;
    const capitalWrap = document.getElementById('oe-fields-capital');
    const affiliateWrap = document.getElementById('oe-fields-affiliate');
    const investmentEl = document.getElementById('oe-investment');
    const commissionEl = document.getElementById('oe-commission');
    const promoteEl = document.getElementById('oe-promote');
    const suitsEl = document.getElementById('oe-suits');
    const investmentIncludesEl = document.getElementById('oe-investment-includes');
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
    if (wasAffiliate !== affiliate) {
      if (affiliate) {
        if (investmentEl) investmentEl.value = '';
        if (investmentIncludesEl) investmentIncludesEl.value = '';
      } else {
        if (commissionEl) commissionEl.value = '';
        if (promoteEl) promoteEl.value = '';
        if (suitsEl) suitsEl.value = '';
      }
    }
    updateTypeModeNote(types, affiliate);
    updateFcaAttestVisibility();
    refreshCompleteness();
    syncAffiliateFormMode.lastAffiliate = affiliate;
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
        '<strong>Affiliate listing.</strong> Commission and what you promote go in <strong>Card highlights</strong> when that section appears — investment is not required.';
      note.className = 'oe-type-mode-note is-affiliate';
      note.hidden = false;
      return;
    }
    if (hasAffiliate && hasCapital) {
      note.innerHTML =
        '<strong>Affiliate cannot combine with other types.</strong> We kept your investment-style types — untick those if this is a pure affiliate programme.';
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
    } else if (isSubmittedAwaitingApproval(currentOpportunity)) {
      if (lead) {
        lead.innerHTML =
          'Your listing is <strong>awaiting approval</strong>. You can still edit below — save changes and submit for approval again to send updates. After we approve it, start a <strong>monthly subscription of £25 + VAT</strong> (£30 total) and it goes live immediately.';
      }
      if (note) {
        note.textContent =
          'No charge until approved. Keep editing as needed, then submit for approval again after changes.';
      }
    } else {
      if (lead) {
        lead.innerHTML =
          'Review everything below, then submit for approval — no charge yet. After we approve it, start a <strong>monthly subscription of £25 + VAT</strong> (£30 total) and it goes live immediately.';
      }
      if (note) {
        note.textContent =
          'Review your listing, then submit for approval. You can keep editing until we approve — submit again after any changes.';
      }
    }
    return true;
  }

  function isSubmittedAwaitingApproval(opportunity) {
    if (!opportunity) return false;
    const approval = String(opportunity.approvalStatus || '').trim();
    return approval === 'Pending Review' && Boolean(opportunity.reviewSubmittedAt);
  }

  function submittedApprovalMessage() {
    return 'Submitted for approval. You can keep editing until we approve it — save changes and submit for approval again whenever you update it.';
  }

  function primarySubmitLabel() {
    if (currentOpportunity && currentOpportunity.listingPaymentActive) return 'Update listing';
    const approval = String(
      (currentOpportunity && currentOpportunity.approvalStatus) || ''
    ).trim();
    if (approval === 'Approved') return 'Pay to go live';
    if (approval === 'Rejected') return 'Resubmit for approval';
    if (isSubmittedAwaitingApproval(currentOpportunity)) return 'Save & submit for approval';
    return 'Submit for approval';
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

  function syncSavedOpportunityMedia(opportunity) {
    if (!opportunity) return;
    if (opportunity.imageUrl) {
      const photoUrlInput = document.getElementById('oe-photo-url');
      if (photoUrlInput) photoUrlInput.value = opportunity.imageUrl;
      const preview = document.getElementById('oe-photo-preview');
      const placeholder = document.getElementById('oe-photo-placeholder');
      const previewImg = document.getElementById('oe-photo-preview-img');
      if (previewImg) previewImg.src = opportunity.imageUrl;
      if (preview) preview.hidden = false;
      if (placeholder) placeholder.hidden = true;
      photoFile = null;
    }
    if (opportunity.logoUrl) {
      const logoUrlInput = document.getElementById('oe-logo-url');
      if (logoUrlInput) logoUrlInput.value = opportunity.logoUrl;
      const logoPreview = document.getElementById('oe-logo-preview');
      const logoPlaceholder = document.getElementById('oe-logo-placeholder');
      const logoPreviewImg = document.getElementById('oe-logo-preview-img');
      if (logoPreviewImg) {
        logoPreviewImg.src = opportunity.logoUrl;
        syncLogoPreviewContrast(logoPreviewImg, opportunity.logoUrl);
      }
      if (logoPreview) logoPreview.hidden = false;
      if (logoPlaceholder) logoPlaceholder.hidden = true;
      logoFile = null;
    }
    refreshListingPreview();
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

  function showRejectionBanner(opportunity) {
    const el = document.getElementById('oe-rejection-banner');
    if (!el) return;
    const approval = String((opportunity && opportunity.approvalStatus) || '').trim();
    const note = String((opportunity && opportunity.rejectionNote) || '').trim();
    if (approval !== 'Rejected' || !note) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.innerHTML =
      '<strong>This listing was not approved</strong>' +
      '<p>Please update your listing to address the points below, then resubmit for review.</p>' +
      '<p>' +
      esc(note) +
      '</p>';
    el.hidden = false;
  }

  function oeProgressiveFlowActive() {
    return !editId && !oeFlowRevealAll;
  }

  function oeShowGlobalHints() {
    if (!oeProgressiveFlowActive()) return true;
    return Boolean(oeStepsConfirmed.photo);
  }

  function clearStepErrors() {
    document.querySelectorAll('.oe-step-error').forEach(function (el) {
      el.hidden = true;
      el.textContent = '';
    });
  }

  function showStepError(stepKey, msg) {
    showAlert('');
    clearStepErrors();
    if (!msg) return;
    const card = document.querySelector('.oe-step-card[data-oe-step="' + stepKey + '"]');
    if (!card) return;
    let el = card.querySelector('.oe-step-error');
    if (!el) {
      el = document.createElement('p');
      el.className = 'oe-step-error';
      el.setAttribute('role', 'alert');
      const body = card.querySelector('.oe-step-body') || card;
      body.insertBefore(el, body.firstChild);
    }
    el.textContent = msg;
    el.hidden = false;
  }

  function bindStepFeedbackClear() {
    [
      'oe-title',
      'oe-desc',
      'oe-about',
      'oe-host',
      'oe-email',
      'oe-investment',
      'oe-commission',
      'oe-promote',
      'oe-region-broad',
      'oe-region',
    ].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () {
        showAlert('');
        clearStepErrors();
      });
      el.addEventListener('change', function () {
        showAlert('');
        clearStepErrors();
      });
    });
    document.querySelectorAll('#oe-type-group input[name="oe-type"]').forEach(function (input) {
      input.addEventListener('change', function () {
        showAlert('');
        clearStepErrors();
      });
    });
  }

  function syncListingStatusUi(opportunity) {
    if (opportunity) currentOpportunity = opportunity;
    const opp = currentOpportunity;
    const badge = document.getElementById('oe-status-badge');
    if (badge && opp) {
      const status = String(opp.status || 'draft').toLowerCase();
      const approval = String(opp.approvalStatus || '').trim();
      let label = 'Draft';
      let cls = 'is-draft';
      if (opp.listingPaymentActive && status === 'published' && approval === 'Approved') {
        label = 'Live';
        cls = 'is-published';
      } else if (approval === 'Approved') {
        label = 'Approved — pay to go live';
        cls = 'is-draft';
      } else if (approval === 'Rejected') {
        label = 'Not approved';
        cls = 'is-draft';
      } else if (isSubmittedAwaitingApproval(opp)) {
        label = 'Awaiting approval';
        cls = 'is-awaiting-approval';
      } else if (approval === 'Pending Review') {
        label = 'Draft — not submitted';
        cls = 'is-draft';
      } else if (status === 'published') {
        label = 'Awaiting approval';
        cls = 'is-awaiting-approval';
      }
      badge.textContent = label;
      badge.className = 'ee-status-badge ' + cls;
      badge.hidden = false;
    }

    const notice = document.getElementById('oe-submitted-notice');
    if (notice) notice.hidden = !isSubmittedAwaitingApproval(opp);

    const submitted = isSubmittedAwaitingApproval(opp);
    const draftLabel = submitted ? 'Save changes' : 'Save as draft';
    ['oe-save-draft', 'oe-save-draft-sticky'].forEach(function (id) {
      const btn = document.getElementById(id);
      if (btn) btn.textContent = draftLabel;
    });
    const draftBarCopy = document.querySelector('#oe-draft-bar .oe-draft-bar-copy');
    if (draftBarCopy) {
      draftBarCopy.textContent = submitted
        ? 'You can keep editing until we approve your listing. Save changes anytime, then submit for approval again to send updates.'
        : 'Save your progress any time — only a title is needed for a draft.';
    }

    syncPrimarySubmitButton();
    listingPaymentPanelVisible();
  }

  function showStatusBadge(opportunity) {
    syncListingStatusUi(opportunity);
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
    setSelectedTypes(normalizeExclusiveTypes(coerceLegacyAffiliateTypes(initialTypes, opp.meta)));
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
    setListingRegionSlug(parsed.slug || '');
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
    showRejectionBanner(opp);
    document.getElementById('oe-page-title').textContent = 'Edit opportunity';
    updateListingPriceBreakdown();
    refreshCompleteness();
    syncOpportunitySteps({ revealAll: true });
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
      if (window.hubClearLogoQualityHint) {
        window.hubClearLogoQualityHint(document.getElementById('oe-logo-quality-hint'));
      }
      refreshListingPreview();
    }

    function setLogoFile(file) {
      logoFile = file;
      const reader = new FileReader();
      reader.onload = function () {
        showPreview(reader.result);
        refreshListingPreview();
      };
      reader.readAsDataURL(file);
      refreshCompleteness();
      syncVisualRequirement(false);
    }

    if (zone && window.hubBindImageUpload) {
      window.hubBindImageUpload({
        zone,
        fileInput,
        onFile: setLogoFile,
        qualityHintEl: document.getElementById('oe-logo-quality-hint'),
      });
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
      urlInput.addEventListener('input', function () {
        const url = String(urlInput.value || '').trim();
        if (url) showPreview(url);
        refreshCompleteness();
        syncVisualRequirement(false);
        refreshListingPreview();
        if (window.hubCheckLogoUrlQuality) {
          window.hubCheckLogoUrlQuality(url, document.getElementById('oe-logo-quality-hint'));
        }
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
      const hint = document.getElementById('oe-photo-quality-hint');
      if (hint) {
        hint.hidden = true;
        hint.textContent = '';
      }
      refreshListingPreview();
    }

    function setPhotoFile(file) {
      photoFile = file;
      const reader = new FileReader();
      reader.onload = function () {
        showPreview(reader.result);
        refreshListingPreview();
      };
      reader.readAsDataURL(file);
      refreshCompleteness();
      syncVisualRequirement(false);
    }

    if (zone && window.hubBindImageUpload) {
      window.hubBindImageUpload({
        zone,
        fileInput,
        onFile: setPhotoFile,
        qualityHintEl: document.getElementById('oe-photo-quality-hint'),
        uploadOptions: { coverQuality: true },
      });
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
      photoUrlInput.addEventListener('input', function () {
        const url = String(photoUrlInput.value || '').trim();
        const hint = document.getElementById('oe-photo-quality-hint');
        if (url) showPreview(url);
        refreshCompleteness();
        syncVisualRequirement(false);
        refreshListingPreview();
        if (!hint) return;
        if (!url || !/^https?:\/\//i.test(url)) {
          hint.hidden = true;
          hint.textContent = '';
          return;
        }
        if (!window.hubMeasureImageUrl) return;
        window.hubMeasureImageUrl(url)
          .then(function (dims) {
            const longEdge = Math.max(dims.width, dims.height);
            const shortEdge = Math.min(dims.width, dims.height);
            if (longEdge >= 1200 && shortEdge >= 720) {
              hint.hidden = true;
              hint.textContent = '';
              return;
            }
            hint.textContent =
              'This image is ' +
              dims.width +
              '×' +
              dims.height +
              'px and may look soft on the browse page. Use a landscape photo at least 1200×750px for a sharp listing card.';
            hint.hidden = false;
          })
          .catch(function () {
            hint.hidden = true;
            hint.textContent = '';
          });
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
    if (/territory|location|region/.test(msg)) id = 'oe-region-broad';
    else if (/logo|photo|cover|image/.test(msg)) id = 'oe-card-photo';
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
    if (id === 'oe-region-broad' || id === 'oe-region') {
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
      fcaDisclaimerAttested: requiresFcaDisclaimer()
        ? Boolean(document.getElementById('oe-fca-attest')?.checked)
        : false,
    };
  }

  function appendListingMediaUrls(payload) {
    const photoUrl = document.getElementById('oe-photo-url')?.value.trim();
    const logoUrl = document.getElementById('oe-logo-url')?.value.trim();
    if (photoUrl) payload.photoUrl = photoUrl;
    if (logoUrl) payload.logoUrl = logoUrl;
    return payload;
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

  function escHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function snapshotFormState() {
    try {
      return JSON.stringify(buildPayload('draft'));
    } catch {
      return '';
    }
  }

  function resetFormBaseline() {
    oeFormBaseline = snapshotFormState();
    oeFormDirty = false;
  }

  function markFormDirty() {
    oeFormDirty = true;
  }

  function hasUnsavedFormChanges() {
    if (oeSkipUnloadGuard || !oeFormDirty) return false;
    return snapshotFormState() !== oeFormBaseline;
  }

  function bindUnsavedGuard() {
    window.addEventListener('beforeunload', function (e) {
      if (!hasUnsavedFormChanges()) return;
      e.preventDefault();
      e.returnValue = '';
    });
    const form = document.getElementById('oe-form');
    if (!form) return;
    form.addEventListener('input', markFormDirty);
    form.addEventListener('change', markFormDirty);
  }

  function previewCoverUrl() {
    const photoImg = document.getElementById('oe-photo-preview-img');
    if (photoImg && photoImg.getAttribute('src')) return photoImg.getAttribute('src');
    const photoUrl = document.getElementById('oe-photo-url')?.value.trim();
    if (photoUrl) return photoUrl;
    if (currentOpportunity && currentOpportunity.displayCoverUrl) {
      return currentOpportunity.displayCoverUrl;
    }
    const logoImg = document.getElementById('oe-logo-preview-img');
    if (logoImg && logoImg.getAttribute('src')) return logoImg.getAttribute('src');
    return document.getElementById('oe-logo-url')?.value.trim() || '';
  }

  function previewHostsNearDuplicate(title, host) {
    const a = String(title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    const b = String(host || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    if (!a || !b) return false;
    if (a === b) return true;
    return a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
  }

  function previewItemFromForm() {
    const payload = buildPayload('draft');
    const seed = {
      id: 'preview',
      title: payload.title || 'Your opportunity title',
      type: payload.type || payload.types[0] || 'franchise',
      tags: payload.tags || payload.types || [],
      host: payload.host || '',
      desc: payload.description || '',
      meta: payload.meta || [],
      category: payload.category || 'general',
      imageUrl: previewCoverUrl(),
      logoUrl: payload.logoUrl || '',
    };
    const catalog = window.HubOpportunitiesCatalog;
    if (catalog && catalog.normalizeListing) {
      return catalog.normalizeListing(seed, 0);
    }
    return seed;
  }

  function previewInvestmentDisplay(item) {
    const catalog = window.HubOpportunitiesCatalog;
    if (isAffiliateStyleListing(item.tags || item.types || [])) {
      const commission = (item.meta || []).find(function (m) {
        return /^commission$/i.test(m.key);
      });
      return {
        value: (commission && commission.val) || 'On request',
        label: 'Commission',
      };
    }
    const investment = (item.meta || []).find(function (m) {
      return /^investment$/i.test(m.key);
    });
    if (investment && investment.val) {
      return { value: investment.val, label: 'Investment' };
    }
    if (catalog && catalog.parseInvestmentAmount) {
      const amount = catalog.parseInvestmentAmount(item.meta || []);
      if (amount != null && amount > 0) {
        return {
          value: 'From £' + Number(amount).toLocaleString('en-GB'),
          label: 'Investment',
        };
      }
    }
    return { value: 'On request', label: 'Investment' };
  }

  function buildBrowsePreviewHtml() {
    const item = previewItemFromForm();
    const catalog = window.HubOpportunitiesCatalog;
    const typeLabels = catalog ? catalog.TYPE_LABELS : TYPE_LABELS;
    const typeLabel = typeLabels[item.type] || item.type || 'Opportunity';
    const thumb = item.thumb || { emoji: '✦', gradient: 'linear-gradient(135deg,#fdf6e3,#f5e0a0)' };
    const cover = String(item.imageUrl || '').trim();
    const logoUrl = String(item.logoUrl || '').trim();
    const isLogoCover = Boolean(cover && logoUrl && cover === logoUrl);
    const commitment =
      document.getElementById('oe-commitment')?.value.trim() ||
      (item.filterTags && item.filterTags.indexOf('full-time') !== -1 ? 'Full-time' : 'Flexible');
    const price = previewInvestmentDisplay(item);
    const host = String(item.host || '').trim();
    const title = String(item.title || '').trim() || 'Your opportunity title';
    const showHost =
      host &&
      host.toLowerCase() !== 'provider' &&
      !previewHostsNearDuplicate(title, host);
    const locationLabel = item.locationLabel || formatListingLocation(getSelectedListingRegion(), '') || 'UK';
    const media = cover
      ? '<img src="' +
        escHtml(cover) +
        '" alt="" class="' +
        (isLogoCover ? 'is-logo-cover' : '') +
        '" />'
      : '<div class="oe-browse-preview-placeholder" style="background:' +
        escHtml(thumb.gradient) +
        '"><span aria-hidden="true">' +
        escHtml(thumb.emoji || '✦') +
        '</span></div>';

    return (
      '<article class="oe-browse-preview-card">' +
      '<div class="oe-browse-preview-media">' +
      media +
      '<span class="oe-browse-preview-category">' +
      escHtml(typeLabel) +
      '</span></div>' +
      '<div class="oe-browse-preview-body">' +
      '<div class="oe-browse-preview-top">' +
      '<span class="oe-browse-preview-commitment">' +
      escHtml(commitment) +
      '</span>' +
      '<div class="oe-browse-preview-price"><strong>' +
      escHtml(price.value) +
      '</strong><span>' +
      escHtml(price.label) +
      '</span></div></div>' +
      '<h3 class="oe-browse-preview-title">' +
      escHtml(title) +
      '</h3>' +
      (showHost ? '<p class="oe-browse-preview-host">' + escHtml(host) + '</p>' : '') +
      '<p class="oe-browse-preview-location">' +
      escHtml(locationLabel) +
      '</p></div></article>'
    );
  }

  function refreshListingPreview() {
    const show = stepTitleComplete();
    const html = show ? buildBrowsePreviewHtml() : '';
    document.querySelectorAll('[data-oe-preview-mount]').forEach(function (mount) {
      mount.innerHTML = html;
      mount.setAttribute('aria-hidden', show ? 'false' : 'true');
    });
    const photoWrap = document.getElementById('oe-live-preview-photo');
    if (photoWrap) photoWrap.hidden = !show;
  }

  function refreshSubmitSummary() {
    const recap = document.getElementById('oe-submit-recap');
    const list = document.getElementById('oe-submit-summary-list');
    const submitCard = document.getElementById('oe-card-submit');
    const submitVisible = submitCard && !submitCard.hidden;
    if (recap) recap.hidden = !submitVisible;
    if (!list || !submitVisible) return;

    const payload = buildPayload('draft');
    const region = getSelectedListingRegion();
    const rows = [
      ['Title', payload.title || '—'],
      ['Type', typeLabelsList(payload.types) || '—'],
      ['Company', payload.host || '—'],
      ['Region', region ? region.label : '—'],
    ];
    if (isAffiliateStyleListing()) {
      const commission = (payload.meta || []).find(function (m) {
        return /^commission$/i.test(m.key);
      });
      const promote = (payload.meta || []).find(function (m) {
        return /^what you promote$/i.test(m.key);
      });
      rows.push(['Commission', (commission && commission.val) || '—']);
      rows.push(['Promote', (promote && promote.val) || '—']);
    } else {
      const investment = (payload.meta || []).find(function (m) {
        return /^investment$/i.test(m.key);
      });
      rows.push(['Investment', (investment && investment.val) || '—']);
    }
    const images = [];
    if (logoFile || payload.logoUrl) images.push('Logo');
    if (photoFile || payload.photoUrl) images.push('Cover photo');
    rows.push(['Images', images.length ? images.join(' + ') : 'None yet']);

    list.innerHTML = rows
      .map(function (row) {
        return (
          '<li><dt>' +
          escHtml(row[0]) +
          '</dt><dd>' +
          escHtml(row[1]) +
          '</dd></li>'
        );
      })
      .join('');
  }

  function typeLabelsList(types) {
    return (types || [])
      .map((type) => TYPE_LABELS[type] || type)
      .filter(Boolean)
      .join(', ');
  }

  function categoryLabel(value) {
    const select = document.getElementById('oe-category');
    if (!select || !value) return '';
    const opt = select.querySelector('option[value="' + value + '"]');
    return opt ? opt.textContent.trim() : value;
  }

  function maybeSuggestCategoryFromTypes() {
    const categoryEl = document.getElementById('oe-category');
    if (!categoryEl || categoryEl.value) return;
    const types = getSelectedTypes();
    for (let i = 0; i < types.length; i++) {
      const hint = TYPE_CATEGORY_HINTS[types[i]];
      if (hint) {
        categoryEl.value = hint;
        break;
      }
    }
  }

  function stepTitleComplete() {
    return (document.getElementById('oe-title')?.value.trim() || '').length >= 2;
  }

  function stepTypeComplete() {
    return getSelectedTypes().length > 0;
  }

  function stepDescComplete() {
    return (document.getElementById('oe-desc')?.value.trim() || '').length >= 8;
  }

  function stepHostComplete() {
    const host = document.getElementById('oe-host')?.value.trim() || '';
    const email = document.getElementById('oe-email')?.value.trim() || '';
    return host.length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function stepMetaComplete() {
    if (!getSelectedListingRegion()) return false;
    if (isAffiliateStyleListing()) {
      return (
        !!(document.getElementById('oe-commission')?.value.trim() || '') &&
        !!(document.getElementById('oe-promote')?.value.trim() || '')
      );
    }
    return !!(document.getElementById('oe-investment')?.value.trim() || '');
  }

  function resetOeStepsFrom(stepKey) {
    const idx = OE_STEP_ORDER.indexOf(stepKey);
    if (idx === -1) return;
    for (let i = idx; i < OE_STEP_ORDER.length; i++) {
      const key = OE_STEP_ORDER[i];
      if (key === 'submit') continue;
      oeStepsConfirmed[key] = false;
    }
  }

  function updateOeStepSummaries() {
    const title = document.getElementById('oe-title')?.value.trim() || '';
    const types = getSelectedTypes();
    const category = document.getElementById('oe-category')?.value.trim() || '';
    const desc = document.getElementById('oe-desc')?.value.trim() || '';
    const detailsText = document.getElementById('oe-summary-details-text');
    if (detailsText) {
      let html = '<strong>' + escHtml(title || 'Untitled') + '</strong>';
      if (types.length) html += ' · ' + escHtml(typeLabelsList(types));
      if (category) html += ' · ' + escHtml(categoryLabel(category));
      if (desc) html += '<br><span>' + escHtml(desc.length > 120 ? desc.slice(0, 117) + '…' : desc) + '</span>';
      detailsText.innerHTML = html;
    }

    const host = document.getElementById('oe-host')?.value.trim() || '';
    const email = document.getElementById('oe-email')?.value.trim() || '';
    const hostText = document.getElementById('oe-summary-host-text');
    if (hostText) {
      hostText.innerHTML =
        '<strong>' +
        escHtml(host || 'Company') +
        '</strong> · ' +
        escHtml(email || 'No email yet');
    }

    const region = getSelectedListingRegion();
    const metaText = document.getElementById('oe-summary-meta-text');
    if (metaText) {
      const parts = [];
      if (region) parts.push(region.label);
      if (isAffiliateStyleListing()) {
        const commission = document.getElementById('oe-commission')?.value.trim();
        if (commission) parts.push(commission);
      } else {
        const investment = document.getElementById('oe-investment')?.value.trim();
        if (investment) parts.push(investment);
      }
      const commitment = document.getElementById('oe-commitment')?.value.trim();
      if (commitment) parts.push(commitment);
      metaText.innerHTML =
        parts.length > 0
          ? '<strong>' + escHtml(parts[0]) + '</strong>' + (parts.slice(1).length ? ' · ' + escHtml(parts.slice(1).join(' · ')) : '')
          : 'Card highlights added';
    }

    const photoText = document.getElementById('oe-summary-photo-text');
    if (photoText) {
      const hasLogo = hasListingImage(buildPayload('draft')) && (
        logoFile ||
        document.getElementById('oe-logo-url')?.value.trim() ||
        (document.getElementById('oe-logo-preview') && !document.getElementById('oe-logo-preview').hidden)
      );
      const hasCover =
        photoFile ||
        document.getElementById('oe-photo-url')?.value.trim() ||
        (document.getElementById('oe-photo-preview') && !document.getElementById('oe-photo-preview').hidden);
      const bits = [];
      if (hasLogo) bits.push('Logo');
      if (hasCover) bits.push('Cover photo');
      photoText.innerHTML =
        bits.length > 0
          ? '<strong>' + escHtml(bits.join(' + ')) + '</strong> added'
          : '<strong>No cover photo</strong> — logo only is fine';
    }
  }

  function setOeCardCollapsed(stepKey, collapsed) {
    const card = document.querySelector('.oe-step-card[data-oe-step="' + stepKey + '"]');
    const summary = document.getElementById('oe-summary-' + stepKey);
    if (card) card.classList.toggle('is-collapsed', Boolean(collapsed));
    if (summary) summary.hidden = !collapsed;
  }

  function syncOpportunitySteps(options) {
    const revealAll = oeFlowRevealAll || Boolean(options && options.revealAll) || Boolean(editId);
    updateOeStepSummaries();

    const draftBar = document.getElementById('oe-draft-bar');
    if (draftBar) draftBar.hidden = revealAll ? true : !stepTitleComplete();

    const completeness = document.getElementById('oe-listing-completeness');
    if (completeness) {
      const showProgress =
        revealAll || (oeStepsConfirmed.details && stepTitleComplete());
      completeness.hidden = !showProgress;
    }

    const moderationPanel = document.getElementById('oe-moderation-warnings');
    if (moderationPanel && oeProgressiveFlowActive() && !oeShowGlobalHints()) {
      moderationPanel.hidden = true;
    }

    if (revealAll) {
      oeStepsConfirmed.details = true;
      oeStepsConfirmed.host = true;
      oeStepsConfirmed.meta = true;
      oeStepsConfirmed.photo = true;
    }

    OE_STEP_ORDER.forEach(function (stepKey) {
      const card = document.querySelector('.oe-step-card[data-oe-step="' + stepKey + '"]');
      if (!card) return;

      if (stepKey === 'details') {
        card.hidden = false;
        if (revealAll) {
          setOeCardCollapsed('details', false);
        } else {
          setOeCardCollapsed('details', oeStepsConfirmed.details);
        }
        return;
      }

      if (stepKey === 'submit') {
        card.hidden = revealAll ? false : !oeStepsConfirmed.photo;
        return;
      }

      const stepIdx = OE_STEP_ORDER.indexOf(stepKey);
      const prevKey = OE_STEP_ORDER[stepIdx - 1];
      const prevConfirmed = revealAll || oeStepsConfirmed[prevKey];
      card.hidden = !prevConfirmed;

      if (revealAll) {
        setOeCardCollapsed(stepKey, false);
      } else {
        setOeCardCollapsed(stepKey, oeStepsConfirmed[stepKey]);
      }
    });

    refreshListingPreview();
    refreshSubmitSummary();
  }

  function confirmOeStep(stepKey) {
    if (stepKey === 'details') {
      if (!stepTitleComplete()) {
        showStepError('details', 'Enter an opportunity title (at least 2 characters).');
        document.getElementById('oe-title')?.focus();
        return false;
      }
      if (!stepTypeComplete()) {
        showStepError('details', 'Select at least one opportunity type.');
        return false;
      }
      if (!stepDescComplete()) {
        showStepError(
          'details',
          'Add a short description (at least 8 characters) for the browse card.'
        );
        document.getElementById('oe-desc')?.focus();
        return false;
      }
      oeStepsConfirmed.details = true;
      clearStepErrors();
      syncOpportunitySteps();
      const hostCard = document.getElementById('oe-card-host');
      if (hostCard) hostCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }

    if (stepKey === 'host') {
      if (!stepHostComplete()) {
        showStepError('host', 'Enter your company name and a valid contact email.');
        return false;
      }
      oeStepsConfirmed.host = true;
      clearStepErrors();
      syncOpportunitySteps();
      document.getElementById('oe-card-meta')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }

    if (stepKey === 'meta') {
      if (!stepMetaComplete()) {
        if (isAffiliateStyleListing()) {
          showStepError('meta', 'Enter commission, what you promote, and region.');
        } else {
          showStepError('meta', 'Enter investment and region.');
        }
        return false;
      }
      oeStepsConfirmed.meta = true;
      clearStepErrors();
      syncOpportunitySteps();
      document.getElementById('oe-card-photo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }

    if (stepKey === 'photo') {
      oeStepsConfirmed.photo = true;
      clearStepErrors();
      syncOpportunitySteps();
      refreshModerationWarnings(false);
      document.getElementById('oe-card-submit')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }

    return false;
  }

  function changeOeStep(stepKey) {
    resetOeStepsFrom(stepKey);
    syncOpportunitySteps();
    const card = document.querySelector('.oe-step-card[data-oe-step="' + stepKey + '"]');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function bindOpportunitySteps() {
    document.getElementById('oe-continue-details')?.addEventListener('click', function () {
      confirmOeStep('details');
    });
    document.getElementById('oe-continue-host')?.addEventListener('click', function () {
      confirmOeStep('host');
    });
    document.getElementById('oe-continue-meta')?.addEventListener('click', function () {
      confirmOeStep('meta');
    });
    document.getElementById('oe-continue-photo')?.addEventListener('click', function () {
      confirmOeStep('photo');
    });

    document.querySelectorAll('.oe-step-change').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const stepKey = btn.getAttribute('data-oe-change');
        if (stepKey) changeOeStep(stepKey);
      });
    });

    const titleEl = document.getElementById('oe-title');
    if (titleEl) {
      titleEl.addEventListener('input', function () {
        syncOpportunitySteps();
      });
    }

    const summaryFields = [
      'oe-desc',
      'oe-about',
      'oe-host',
      'oe-email',
      'oe-investment',
      'oe-commission',
      'oe-promote',
      'oe-region-broad',
      'oe-region',
      'oe-commitment',
      'oe-category',
      'oe-logo-url',
      'oe-photo-url',
    ];
    summaryFields.forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', syncOpportunitySteps);
      el.addEventListener('change', syncOpportunitySteps);
    });

    document.querySelectorAll('#oe-type-group input[name="oe-type"]').forEach(function (input) {
      input.addEventListener('change', function () {
        reconcileTypeSelection(this);
        maybeSuggestCategoryFromTypes();
        syncAffiliateFormMode();
        updateFcaAttestVisibility();
        syncOpportunitySteps();
      });
    });

    const stickyDraft = document.getElementById('oe-save-draft-sticky');
    if (stickyDraft) {
      stickyDraft.addEventListener('click', function () {
        saveOpportunity({ publish: false });
      });
    }
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
    syncOpportunitySteps();
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
      'oe-region-broad',
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
    const progressive = oeProgressiveFlowActive();
    const includeMissing = !progressive && !isDraft;
    const scan = moderationScanInput(payload, { includeMissingFields: includeMissing });
    if (
      progressive &&
      scan &&
      scan.flagged &&
      scan.reasons &&
      scan.reasons.every(function (reason) {
        return reason.id === 'missing_field';
      })
    ) {
      renderModerationWarnings(null, isDraft);
      return scan;
    }
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
      'oe-region-broad',
      'oe-region',
      'oe-commitment',
      'oe-companies-house',
      'oe-extra-key',
      'oe-extra-val',
    ];

    function scheduleScan() {
      if (moderationScanTimer) clearTimeout(moderationScanTimer);
      moderationScanTimer = setTimeout(function () {
        refreshModerationWarnings(!oeShowGlobalHints());
      }, 280);
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
        oeFlowRevealAll = true;
        syncOpportunitySteps({ revealAll: true });
        scrollToValidationField(validationError);
        syncVisualRequirement(true);
        return;
      }
      await startListingCheckout(editId || currentOpportunity.id);
      return;
    }

    const payload = buildPayload(publish && hasActiveListing ? 'published' : 'draft');
    appendListingMediaUrls(payload);
    if (publish && !hasActiveListing) {
      payload.submitForReview = true;
      payload.action = 'submit_for_review';
    }
    const validationError = validatePayload(payload, !publish);
    if (validationError) {
      showAlert(validationError);
      oeFlowRevealAll = true;
      syncOpportunitySteps({ revealAll: true });
      scrollToValidationField(validationError);
      syncVisualRequirement(true);
      return;
    }

    const submitBtn = document.getElementById('oe-submit');
    const draftBtn = document.getElementById('oe-save-draft');
    const loading = window.organiserPageLoading;
    let redirecting = false;
    const submitLabel = submitBtn ? submitBtn.textContent : '';

    [submitBtn, draftBtn].forEach((b) => {
      if (b) b.disabled = true;
    });
    if (submitBtn && publish) submitBtn.textContent = 'Submitting…';
    if (loading) {
      loading.show(
        publish
          ? hasActiveListing
            ? 'Updating listing'
            : 'Preparing submission'
          : 'Saving draft'
      );
    }

    try {
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

      if (loading && publish) loading.show(hasActiveListing ? 'Updating listing' : 'Submitting for review');

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
        res = await saveWork();
      } catch (e) {
        showAlert((e && e.message) || 'Could not save opportunity');
        return;
      }

      if (!res.ok) {
        const err = res.data.error || '';
        const msg =
          err === 'opportunities_unavailable'
            ? 'Opportunity listings are not available yet — contact support if this persists.'
            : err === 'cover_upload_failed'
              ? 'Your cover photo could not be uploaded. Try a smaller JPG or PNG (under 2MB) and save again.'
              : err === 'review_submission_failed'
                ? 'Your listing saved but could not be queued for review. Please try submitting again.'
                : res.data.message || err || 'Could not save opportunity';
        showAlert(msg);
        return;
      }

      const opportunity = res.data.opportunity || {};
      currentOpportunity = opportunity;
      syncSavedOpportunityMedia(opportunity);
      syncListingStatusUi(opportunity);

      if (publish && !hasActiveListing && !opportunity.reviewSubmittedAt) {
        showAlert(
          'Your listing saved but is not in the approval queue yet. Click Submit for approval again — if this keeps happening, contact support.'
        );
        return;
      }

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
        showAlert(
          isSubmittedAwaitingApproval(opportunity)
            ? 'Changes saved. Submit for approval again when you want to send updates to the review team.'
            : 'Draft saved.'
        );
        resetFormBaseline();
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
        resetFormBaseline();
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

      if (opportunity.id && !editId) {
        oeSkipUnloadGuard = true;
        if (loading) loading.hide();
        location.replace(
          '/organiser/opportunity-edit?id=' +
            encodeURIComponent(opportunity.id) +
            (isEmbedDrawer ? '&embed=1' : '')
        );
        return;
      }

      showAlert(submittedApprovalMessage());
      resetFormBaseline();
    } finally {
      if (!redirecting) {
        if (loading) loading.hide();
        [submitBtn, draftBtn].forEach((b) => {
          if (b) b.disabled = false;
        });
        if (submitBtn) submitBtn.textContent = submitLabel;
        syncPrimarySubmitButton();
      }
    }
  }

  async function init() {
    bindListingRegionPickers();

    const actions = window.HubOrganiserActions;
    if (actions) {
      const loggedIn = await actions.requireLogin('/organiser/opportunity-edit' + location.search);
      if (!loggedIn) return;
      try {
        await fetch('/api/auth/hub-mode', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'organiser' }),
        });
      } catch (e) {
        /* non-fatal */
      }
    }

    bindLogoUpload();
    bindPhotoUpload();
    bindModerationScan();
    bindCompletenessScan();
    bindStepFeedbackClear();
    bindOpportunitySteps();
    bindUnsavedGuard();
    refreshModerationWarnings(true);
    refreshCompleteness();

    const investmentEl = document.getElementById('oe-investment');
    if (investmentEl) {
      investmentEl.addEventListener('input', updateFcaAttestVisibility);
      investmentEl.addEventListener('change', updateFcaAttestVisibility);
    }
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
    syncAffiliateFormMode();
    updateFcaAttestVisibility();
    syncOpportunitySteps();

    const backLink = document.getElementById('oe-back-link');
    if (backLink) {
      if (editId) {
        backLink.textContent = '← Back to My business opportunities';
      }
      backLink.addEventListener('click', function (e) {
        e.preventDefault();
        if (window.HubOrganiserActions && window.HubOrganiserActions.goToBusinessOpportunities) {
          window.HubOrganiserActions.goToBusinessOpportunities();
        } else {
          location.href = '/organiser/#business-overview';
        }
      });
    }

    updateListingPriceBreakdown();
    listingPaymentPanelVisible();
    syncPrimarySubmitButton();

    if (checkoutCancelled) {
      showAlert(
        'Checkout was cancelled. Your listing stays approved — pay via Stripe when you are ready to go live.'
      );
    } else if (justSubmitted) {
      showAlert(submittedApprovalMessage());
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

    syncOpportunitySteps({ revealAll: !!editId });
    resetFormBaseline();
    refreshListingPreview();
    refreshSubmitSummary();

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
