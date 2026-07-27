/**
 * Saved organisers — localStorage for guests, Supabase sync when signed in.
 *
 * localStorage is browser-scoped. Never merge another account's local saves
 * (especially while impersonating) into the current session.
 */
(function () {
  var KEY = 'hubSavedOrganiserIds';
  var OWNER_KEY = 'hubSavedOrganiserOwner';
  var cache = null;
  var syncPromise = null;
  var activeAccount = { email: '', impersonating: false };

  function readOwner() {
    try {
      return String(localStorage.getItem(OWNER_KEY) || '')
        .trim()
        .toLowerCase();
    } catch (e) {
      return '';
    }
  }

  function writeOwner(email) {
    try {
      var key = String(email || '')
        .trim()
        .toLowerCase();
      if (key) localStorage.setItem(OWNER_KEY, key);
      else localStorage.removeItem(OWNER_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function accountEmail(sessionData) {
    return sessionData && sessionData.user && sessionData.user.email
      ? String(sessionData.user.email)
          .trim()
          .toLowerCase()
      : '';
  }

  function setActiveAccount(sessionData) {
    activeAccount.email = accountEmail(sessionData);
    activeAccount.impersonating = !!(sessionData && sessionData.impersonating);
  }

  function canUseLocalCache() {
    if (activeAccount.impersonating) return false;
    var owner = readOwner();
    if (!activeAccount.email) return true;
    if (!owner) return true;
    return owner === activeAccount.email;
  }

  function shouldMergeLocal(sessionData) {
    if (!sessionData || !sessionData.ok || !sessionData.user) return false;
    if (sessionData.impersonating) return false;
    var owner = readOwner();
    var email = accountEmail(sessionData);
    if (!owner) return true;
    return owner === email;
  }

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
    if (activeAccount.impersonating) {
      cache = (ids || []).map(String);
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch (e) {
      /* ignore */
    }
    cache = ids.slice();
    if (activeAccount.email) writeOwner(activeAccount.email);
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
    if (activeAccount.impersonating) return;
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
    if (activeAccount.impersonating || !canUseLocalCache()) {
      return syncFromServer();
    }
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

  function adoptSession(sessionData) {
    setActiveAccount(sessionData);
    if (!(sessionData && sessionData.ok && sessionData.user)) return Promise.resolve(null);
    if (shouldMergeLocal(sessionData)) {
      return mergeLocalToServer().then(function (data) {
        writeOwner(accountEmail(sessionData));
        return data;
      });
    }
    return syncFromServer().then(function (data) {
      if (!sessionData.impersonating) writeOwner(accountEmail(sessionData));
      return data;
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
    adoptSession: adoptSession,
    canUseLocalCache: canUseLocalCache,
    refreshButtons: refreshButtons,
    writeLocal: writeLocal,
  };

  var loadSession = window.hubFetchSession
    ? window.hubFetchSession
    : function () {
        return fetch('/api/auth/session', { credentials: 'include' }).then(function (r) {
          return r.json();
        });
      };

  loadSession()
    .then(function (data) {
      return adoptSession(data);
    })
    .catch(function () {
      /* guest — local only */
    });
})();
