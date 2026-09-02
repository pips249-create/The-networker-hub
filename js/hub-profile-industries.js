(function (global) {
  var INDUSTRIES = [
    'Accountancy & Finance',
    'Banking & Insurance',
    'Legal',
    'Marketing, PR & Media',
    'IT, Software & Technology',
    'Consulting & Professional Services',
    'Construction & Trades',
    'Property & Real Estate',
    'Healthcare & Medical',
    'Education & Training',
    'Manufacturing & Engineering',
    'Retail, Hospitality & Leisure',
    'Recruitment & HR',
    'Creative, Design & Arts',
    'Coaching & Personal Development',
    'Transport & Logistics',
    'Energy & Environment',
    'Charity, Public & Social Enterprise',
    'Other',
  ];

  function lookupMap() {
    var map = {};
    INDUSTRIES.forEach(function (label) {
      map[label.toLocaleLowerCase('en-GB')] = label;
    });
    return map;
  }

  var CANONICAL = lookupMap();

  function normalizeIndustry(raw) {
    var trimmed = String(raw || '').trim();
    if (!trimmed) return '';
    return CANONICAL[trimmed.toLocaleLowerCase('en-GB')] || trimmed;
  }

  function isBareOther(raw) {
    return normalizeIndustry(raw).toLocaleLowerCase('en-GB') === 'other';
  }

  function isListedIndustry(raw) {
    var normalized = normalizeIndustry(raw);
    return !!normalized && !!CANONICAL[normalized.toLocaleLowerCase('en-GB')] && !isBareOther(normalized);
  }

  function isProfileComplete(profile) {
    if (!profile) return false;
    var sector = String(profile.businessSector || '').trim();
    var title = String(profile.jobTitle || '').trim();
    return sector.length >= 2 && !isBareOther(sector) && title.length >= 2;
  }

  function fillIndustrySelect(selectEl, selectedValue) {
    if (!selectEl) return { otherValue: '', showOther: false };
    var current = normalizeIndustry(selectedValue);
    var selectValue = '';
    var otherValue = '';
    var showOther = false;

    if (current) {
      if (isListedIndustry(current)) {
        selectValue = current;
      } else {
        selectValue = 'Other';
        otherValue = isBareOther(current) ? '' : current;
        showOther = true;
      }
    }

    var html =
      '<option value="">Select your industry</option>' +
      INDUSTRIES.map(function (label) {
        var sel = label === selectValue ? ' selected' : '';
        return (
          '<option value="' +
          label.replace(/"/g, '&quot;') +
          '"' +
          sel +
          '>' +
          label +
          '</option>'
        );
      }).join('');
    selectEl.innerHTML = html;
    return { otherValue: otherValue, showOther: showOther };
  }

  function setIndustryOtherVisible(otherField, otherInput, show, options) {
    var opts = options || {};
    if (otherField) otherField.hidden = !show;
    if (otherInput) {
      otherInput.disabled = !show;
      if (opts.required != null) otherInput.required = !!show && !!opts.required;
      if (!show && opts.clear !== false) otherInput.value = '';
    }
  }

  function syncIndustryOther(selectEl, otherField, otherInput, options) {
    if (!selectEl) return false;
    var show = selectEl.value === 'Other';
    setIndustryOtherVisible(otherField, otherInput, show, options);
    return show;
  }

  function applyIndustrySelection(selectEl, otherField, otherInput, selectedValue, options) {
    var state = fillIndustrySelect(selectEl, selectedValue);
    setIndustryOtherVisible(otherField, otherInput, state.showOther, {
      required: options && options.required,
      clear: false,
    });
    if (otherInput) otherInput.value = state.otherValue || '';
    return state;
  }

  function bindIndustryOther(selectEl, otherField, otherInput, options) {
    if (!selectEl || selectEl.dataset.industryOtherBound === '1') return;
    selectEl.dataset.industryOtherBound = '1';
    selectEl.addEventListener('change', function () {
      var show = syncIndustryOther(selectEl, otherField, otherInput, options);
      if (show && otherInput) otherInput.focus();
    });
  }

  function resolveIndustryValue(selectEl, otherInput) {
    var selected = String((selectEl && selectEl.value) || '').trim();
    if (selected === 'Other') {
      var custom = String((otherInput && otherInput.value) || '').trim();
      return custom || 'Other';
    }
    return selected;
  }

  global.HubProfileIndustries = {
    INDUSTRIES: INDUSTRIES,
    normalizeIndustry: normalizeIndustry,
    isBareOther: isBareOther,
    isListedIndustry: isListedIndustry,
    isProfileComplete: isProfileComplete,
    fillIndustrySelect: fillIndustrySelect,
    applyIndustrySelection: applyIndustrySelection,
    bindIndustryOther: bindIndustryOther,
    syncIndustryOther: syncIndustryOther,
    resolveIndustryValue: resolveIndustryValue,
  };
})(typeof window !== 'undefined' ? window : globalThis);
