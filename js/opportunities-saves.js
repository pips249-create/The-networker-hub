/**
 * Saved opportunities — localStorage heart toggles (browse + detail).
 */
(function () {
  var SAVE_KEY = 'hubSavedOpportunityIds';

  function readSavedIds() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (e) {
      return [];
    }
  }

  function writeSavedIds(ids) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(ids));
    } catch (e) {
      /* ignore */
    }
  }

  function isOpportunitySaved(id) {
    return readSavedIds().includes(String(id));
  }

  function toggleOpportunitySave(id) {
    var key = String(id || '');
    if (!key) return false;
    var ids = readSavedIds();
    var nowSaved = !ids.includes(key);
    if (nowSaved) ids.push(key);
    else {
      ids = ids.filter(function (x) {
        return x !== key;
      });
    }
    writeSavedIds(ids);
    return nowSaved;
  }

  function refreshSaveButtons(root) {
    var scope = root || document;
    scope.querySelectorAll('.opp-fav-btn[data-opp-id]').forEach(function (btn) {
      var saved = isOpportunitySaved(btn.getAttribute('data-opp-id'));
      btn.classList.toggle('is-active', saved);
      btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
      btn.setAttribute('aria-label', saved ? 'Remove from saved' : 'Save opportunity');
    });
  }

  window.HubOpportunitySaves = {
    ids: readSavedIds,
    isSaved: isOpportunitySaved,
    toggle: toggleOpportunitySave,
    refreshButtons: refreshSaveButtons,
  };
})();
