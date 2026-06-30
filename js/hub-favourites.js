/**
 * Saved events — localStorage for guests, Supabase sync when signed in.
 */
(function () {
  var KEY = 'hubSavedEventIds';
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

  function isSaved(eventId) {
    return ids().includes(String(eventId));
  }

  function setCacheFromServer(serverIds) {
    if (!Array.isArray(serverIds)) return;
    cache = serverIds.map(String);
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
