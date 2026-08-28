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

  function isProfileComplete(profile) {
    if (!profile) return false;
    return (
      String(profile.businessSector || '').trim().length >= 2 &&
      String(profile.jobTitle || '').trim().length >= 2
    );
  }

  function fillIndustrySelect(selectEl, selectedValue) {
    if (!selectEl) return;
    var current = normalizeIndustry(selectedValue);
    var html =
      '<option value="">Select your industry</option>' +
      INDUSTRIES.map(function (label) {
        var sel = label === current ? ' selected' : '';
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
    if (current && !INDUSTRIES.includes(current)) {
      var legacy = document.createElement('option');
      legacy.value = current;
      legacy.textContent = current + ' (saved)';
      legacy.selected = true;
      selectEl.insertBefore(legacy, selectEl.options[1] || null);
    }
  }

  global.HubProfileIndustries = {
    INDUSTRIES: INDUSTRIES,
    normalizeIndustry: normalizeIndustry,
    isProfileComplete: isProfileComplete,
    fillIndustrySelect: fillIndustrySelect,
  };
})(typeof window !== 'undefined' ? window : globalThis);
