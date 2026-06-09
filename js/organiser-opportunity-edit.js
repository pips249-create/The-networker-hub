/**
 * Business opportunity listing editor.
 */
(function () {
  const params = new URLSearchParams(location.search);
  const editId = params.get('id') || '';

  let photoFile = null;
  let logoFile = null;

  const OPPORTUNITY_TYPES = [
    'franchise',
    'side-hustle',
    'partnership',
    'networking',
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
    document.getElementById('oe-title').value = opp.title || '';
    const typeTags = (opp.tags || []).filter((tag) => OPPORTUNITY_TYPES.includes(tag));
    setSelectedTypes(typeTags.length ? typeTags : opp.type ? [opp.type] : []);
    document.getElementById('oe-category').value = opp.category || '';
    document.getElementById('oe-desc').value = opp.desc || '';
    document.getElementById('oe-about').value = (opp.about || []).join('\n\n');
    document.getElementById('oe-host').value = opp.host || '';
    document.getElementById('oe-email').value = opp.contactEmail || '';
    document.getElementById('oe-investment').value = metaValue(opp.meta, /^investment$/i);
    document.getElementById('oe-location').value = metaValue(opp.meta, /^location$/i);
    document.getElementById('oe-commitment').value = metaValue(opp.meta, /^commitment$/i);

    const financial = (opp.meta || []).find((m) =>
      /^(return(\s+est\.?)?|earnings|commission|revenue|income|profit)$/i.test(m.key)
    );
    if (financial) {
      document.getElementById('oe-financial-key').value = financial.key;
      document.getElementById('oe-financial-val').value = financial.val;
    }

    const usedKeys = new Set(['investment', 'location', 'commitment']);
    if (financial) usedKeys.add(financial.key.toLowerCase());
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
    const finKey = document.getElementById('oe-financial-key').value.trim();
    const finVal = document.getElementById('oe-financial-val').value.trim();
    const extraKey = document.getElementById('oe-extra-key').value.trim();
    const extraVal = document.getElementById('oe-extra-val').value.trim();

    if (investment) meta.push({ key: 'Investment', val: investment });
    if (finKey && finVal) meta.push({ key: finKey, val: finVal });
    if (location) meta.push({ key: 'Location', val: location });
    if (extraKey && extraVal) meta.push({ key: extraKey, val: extraVal });
    if (commitment) meta.push({ key: 'Commitment', val: commitment });
    return meta;
  }

  function buildPayload(listingStatus) {
    const types = getSelectedTypes();
    const category = document.getElementById('oe-category').value.trim();
    const tags = types.slice();
    if (category && category !== 'general') tags.push('cat-' + category);

    return {
      title: document.getElementById('oe-title').value.trim(),
      type: types[0] || '',
      types,
      category,
      description: document.getElementById('oe-desc').value.trim(),
      aboutText: document.getElementById('oe-about').value.trim(),
      host: document.getElementById('oe-host').value.trim(),
      contactEmail: document.getElementById('oe-email').value.trim(),
      meta: buildMeta(),
      tags,
      listingStatus,
      photoUrl: document.getElementById('oe-photo-url').value.trim(),
      logoUrl: document.getElementById('oe-logo-url').value.trim(),
    };
  }

  function validatePayload(payload, isDraft) {
    if (!payload.title) return 'Enter an opportunity title.';
    if (isDraft) return '';
    if (!payload.types || !payload.types.length) return 'Select at least one opportunity type.';
    if (!payload.description) return 'Add a short description for the card.';
    if (!payload.host) return 'Enter your business or company name.';
    if (!payload.contactEmail) return 'Enter a contact email for enquiries.';
    if (!payload.meta.some((m) => /^investment$/i.test(m.key))) return 'Enter the investment required.';
    if (!payload.meta.some((m) => /^location$/i.test(m.key))) return 'Enter a location.';
    if (!payload.meta.some((m) => /^commitment$/i.test(m.key))) return 'Select a commitment level.';
    return '';
  }

  async function saveOpportunity(options) {
    const publish = options && options.publish;
    showAlert('');

    const payload = buildPayload(publish ? 'published' : 'draft');
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
        res = await loading.run(publish ? 'Submitting listing' : 'Saving draft', saveWork);
      } else {
        if (loading) loading.show(publish ? 'Submitting listing' : 'Saving draft');
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
    if (!publish) {
      if (!editId && opportunity.id) {
        location.href = 'opportunity-edit.html?id=' + encodeURIComponent(opportunity.id);
        return;
      }
      showAlert('Draft saved.');
      return;
    }

    location.href =
      'opportunity-submitted.html?title=' +
      encodeURIComponent(payload.title) +
      (opportunity.id ? '&id=' + encodeURIComponent(opportunity.id) : '');
  }

  async function init() {
    const actions = window.HubOrganiserActions;
    if (actions) {
      const loggedIn = await actions.requireLogin('/organiser/opportunity-edit.html' + location.search);
      if (!loggedIn) return;
    }

    bindLogoUpload();
    bindPhotoUpload();

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
