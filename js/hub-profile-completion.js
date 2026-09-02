(function (global) {
  var PROFILE_CACHE_KEY = 'hub_profile_cache_v1';
  var CACHE_TTL_MS = 5 * 60 * 1000;

  function readCache() {
    try {
      var raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.ts || Date.now() - parsed.ts > CACHE_TTL_MS) return null;
      return parsed.profile || null;
    } catch (e) {
      return null;
    }
  }

  function writeCache(profile) {
    try {
      sessionStorage.setItem(
        PROFILE_CACHE_KEY,
        JSON.stringify({ ts: Date.now(), profile: profile || null })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function clearCache() {
    try {
      sessionStorage.removeItem(PROFILE_CACHE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function isComplete(profile) {
    if (global.HubProfileIndustries && global.HubProfileIndustries.isProfileComplete) {
      return global.HubProfileIndustries.isProfileComplete(profile);
    }
    return (
      String(profile && profile.businessSector || '').trim().length >= 2 &&
      String(profile && profile.jobTitle || '').trim().length >= 2
    );
  }

  function fetchProfile(force) {
    if (!force) {
      var cached = readCache();
      if (cached) return Promise.resolve({ ok: true, profile: cached });
    }
    return fetch('/api/auth/profile', { credentials: 'include' })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data && result.data.profile) {
          writeCache(result.data.profile);
          return { ok: true, profile: result.data.profile, profileComplete: isComplete(result.data.profile) };
        }
        return { ok: false, profile: null, error: (result.data && result.data.error) || 'profile_unavailable' };
      })
      .catch(function () {
        return { ok: false, profile: null, error: 'network' };
      });
  }

  function saveProfileFields(fields) {
    var payload = {};
    if (fields.businessSector !== undefined) payload.businessSector = fields.businessSector;
    if (fields.jobTitle !== undefined) payload.jobTitle = fields.jobTitle;
    if (fields.company !== undefined) payload.company = fields.company;
    if (fields.name !== undefined) payload.name = fields.name;

    return fetch('/api/auth/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data && result.data.profile) {
          writeCache(result.data.profile);
          return { ok: true, profile: result.data.profile, message: result.data.message };
        }
        return {
          ok: false,
          message: (result.data && result.data.message) || 'Could not save your details.',
        };
      });
  }

  function validateProfileForm(industry, jobTitle) {
    var sector = String(industry || '').trim();
    var title = String(jobTitle || '').trim();
    if (!sector) return 'Please select your industry.';
    if (
      global.HubProfileIndustries &&
      global.HubProfileIndustries.isBareOther &&
      global.HubProfileIndustries.isBareOther(sector)
    ) {
      return 'Please enter your industry.';
    }
    if (sector.length < 2) return 'Industry must be at least 2 characters.';
    if (!title) return 'Please enter your job title.';
    if (title.length < 2) return 'Job title must be at least 2 characters.';
    return '';
  }

  global.HubProfileCompletion = {
    fetchProfile: fetchProfile,
    saveProfileFields: saveProfileFields,
    isComplete: isComplete,
    validateProfileForm: validateProfileForm,
    clearCache: clearCache,
  };
})(typeof window !== 'undefined' ? window : globalThis);
