/**
 * Saved organisers — localStorage for guests, Supabase sync when signed in.
 */
(function () {
  var KEY = 'hubSavedOrganiserIds';
  var cache = null;
  var syncPromise = null;

  function readLocal() {
    try {
      var raw = localStorage.getItem(KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (e) {
      return [];
    }
  }

  function writeLocal(ids) {
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch (e) {
      /* ignore */
    }
    cache = ids.slice();
  }

  function ids() {
    if (cache) return cache.slice();
    cache = readLocal();
    return cache.slice();
  }

  function isSaved(organiserId) {
    return ids().includes(String(organiserId));
  }

  function setCacheFromServer(serverIds) {
    if (!Array.isArray(serverIds)) return;
    cache = serverIds.map(String);
    writeLocal(cache);
  }

  function syncFromServer() {
    if (syncPromise) return syncPromise;
    syncPromise = fetch('/api/auth/organiser-favourites', { credentials: 'include' })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok && Array.isArray(data.organiserIds)) {
          setCacheFromServer(data.organiserIds);
        }
        return data;
      })
      .catch(function () {
        return null;
      })
      .finally(function () {
        syncPromise = null;
      });
    return syncPromise;
  }

  function mergeLocalToServer() {
    var local = readLocal();
    if (!local.length) return syncFromServer();
    return syncFromServer().then(function (data) {
      if (!data || !data.ok) return data;
      var server = new Set((data.organiserIds || []).map(String));
      var pending = local.filter(function (id) {
        return !server.has(id);
      });
      if (!pending.length) return data;
      return pending
        .reduce(function (chain, id) {
          return chain.then(function () {
            return fetch('/api/auth/organiser-favourites', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ organiserId: id }),
            }).then(function (r) {
              return r.json();
            });
          });
        }, Promise.resolve())
        .then(function () {
          return syncFromServer();
        });
    });
  }

  function toggle(organiserId) {
    var id = String(organiserId || '');
    if (!id) return Promise.resolve(false);

    var local = ids();
    var nowSaved = !local.includes(id);
    if (nowSaved) local.push(id);
    else {
      local = local.filter(function (x) {
        return x !== id;
      });
    }
    writeLocal(local);

    return fetch('/api/auth/organiser-favourites', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organiserId: id }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok && Array.isArray(data.organiserIds)) {
          setCacheFromServer(data.organiserIds);
          return data.saved !== false;
        }
        return nowSaved;
      })
      .catch(function () {
        return nowSaved;
      });
  }

  function refreshButtons(root) {
    var scope = root || document;
    scope.querySelectorAll('.fav-btn[data-organiser-id]').forEach(function (btn) {
      var id = btn.getAttribute('data-organiser-id');
      var on = isSaved(id);
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Remove from saved' : 'Save organiser');
    });
    var saveBtn = scope.querySelector ? scope.querySelector('#org-save-btn') : null;
    if (!saveBtn && scope.id === 'org-save-btn') saveBtn = scope;
    if (!saveBtn) saveBtn = document.getElementById('org-save-btn');
    if (saveBtn) {
      var orgId = saveBtn.getAttribute('data-organiser-id');
      if (orgId) {
        var saved = isSaved(orgId);
        saveBtn.classList.toggle('is-saved', saved);
        saveBtn.setAttribute('aria-pressed', saved ? 'true' : 'false');
      }
    }
  }

  window.HubOrganiserFavourites = {
    ids: ids,
    isSaved: isSaved,
    toggle: toggle,
    sync: syncFromServer,
    mergeOnLogin: mergeLocalToServer,
    refreshButtons: refreshButtons,
    writeLocal: writeLocal,
  };

  fetch('/api/auth/session', { credentials: 'include' })
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      if (data && data.ok && data.user) return mergeLocalToServer();
    })
    .catch(function () {
      /* guest — local only */
    });
})();
