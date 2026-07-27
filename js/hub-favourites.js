/**
 * Saved events — localStorage for guests, Supabase sync when signed in.
 *
 * localStorage is browser-scoped. Never merge another account's local saves
 * (especially while impersonating) into the current session.
 */
(function () {
  var KEY = 'hubSavedEventIds';
  var OWNER_KEY = 'hubSavedEventOwner';
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

  function isSaved(eventId) {
    return ids().includes(String(eventId));
  }

  function setCacheFromServer(serverIds) {
    if (!Array.isArray(serverIds)) return;
    cache = serverIds.map(String);
    if (activeAccount.impersonating) return;
    writeLocal(cache);
  }

  function syncFromServer() {
    if (syncPromise) return syncPromise;
    syncPromise = fetch('/api/auth/favourites', { credentials: 'include' })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok && Array.isArray(data.eventIds)) {
          setCacheFromServer(data.eventIds);
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
      var server = new Set((data.eventIds || []).map(String));
      var pending = local.filter(function (id) {
        return !server.has(id);
      });
      if (!pending.length) return data;
      return pending
        .reduce(function (chain, id) {
          return chain.then(function () {
            return fetch('/api/auth/favourites', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ eventId: id }),
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

  function cascadeOrganiserSave(organiserId) {
    var oid = String(organiserId || '').trim();
    if (!oid || !window.HubOrganiserFavourites) return;
    var ids = window.HubOrganiserFavourites.ids();
    if (ids.includes(oid)) return;
    ids.push(oid);
    window.HubOrganiserFavourites.writeLocal(ids);
  }

  function organiserIdForEvent(eventId) {
    var id = String(eventId || '').trim();
    if (!id || !window.hubAllEvents) return '';
    for (var i = 0; i < window.hubAllEvents.length; i++) {
      var ev = window.hubAllEvents[i];
      if (String(ev.id) === id) {
        return String(ev.organiserId || ev.organiser_id || '').trim();
      }
    }
    return '';
  }

  function toggle(eventId, options) {
    options = options || {};
    var id = String(eventId || '');
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

    if (nowSaved) {
      var organiserId = options.organiserId || organiserIdForEvent(id);
      if (organiserId) cascadeOrganiserSave(organiserId);
    }

    return fetch('/api/auth/favourites', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: id }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok && Array.isArray(data.eventIds)) {
          setCacheFromServer(data.eventIds);
          if (data.organiserId && window.HubOrganiserFavourites) {
            cascadeOrganiserSave(data.organiserId);
          }
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
    scope.querySelectorAll('.fav-btn[data-event-id]').forEach(function (btn) {
      var id = btn.getAttribute('data-event-id');
      var on = isSaved(id);
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Remove from saved' : 'Save event');
    });
  }

  window.HubFavourites = {
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
