/**
 * Saved opportunities — localStorage for guests, Supabase sync when signed in.
 */
(function () {
  var SAVE_KEY = 'hubSavedOpportunityIds';
  var cache = null;
  var syncPromise = null;

  function readLocal() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (e) {
      return [];
    }
  }

  function uniqueIds(ids) {
    var seen = new Set();
    var out = [];
    (ids || []).forEach(function (id) {
      var key = String(id || '').trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(key);
    });
    return out;
  }

  function writeLocal(ids) {
    var next = uniqueIds(ids);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(next));
    } catch (e) {
      /* ignore */
    }
    cache = next.slice();
  }

  function ids() {
    if (cache) return cache.slice();
    cache = readLocal();
    return cache.slice();
  }

  function isSaved(id) {
    return ids().includes(String(id));
  }

  function setCacheFromServer(serverIds, keepLocalIds) {
    if (!Array.isArray(serverIds)) return;
    var merged = uniqueIds(serverIds);
    if (keepLocalIds && keepLocalIds.length) {
      merged = uniqueIds(merged.concat(keepLocalIds));
    }
    cache = merged;
    writeLocal(cache);
  }

  function fetchFromServer() {
    return fetch('/api/auth/opportunity-favourites', { credentials: 'include' })
      .then(function (res) {
        return res.json();
      })
      .catch(function () {
        return null;
      });
  }

  function syncFromServer() {
    if (syncPromise) return syncPromise;
    syncPromise = fetchFromServer()
      .then(function (data) {
        if (data && data.ok && Array.isArray(data.opportunityIds)) {
          setCacheFromServer(data.opportunityIds);
        }
        return data;
      })
      .finally(function () {
        syncPromise = null;
      });
    return syncPromise;
  }

  function mergeLocalToServer() {
    var localSnapshot = readLocal();
    if (!localSnapshot.length) return syncFromServer();

    return fetchFromServer().then(function (data) {
      if (!data || !data.ok) {
        cache = localSnapshot.slice();
        writeLocal(cache);
        return data;
      }

      var server = new Set((data.opportunityIds || []).map(String));
      var pending = localSnapshot.filter(function (id) {
        return !server.has(String(id));
      });

      if (!pending.length) {
        setCacheFromServer(data.opportunityIds);
        return data;
      }

      return pending
        .reduce(function (chain, id) {
          return chain.then(function () {
            return fetch('/api/auth/opportunity-favourites', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ opportunityId: id }),
            }).then(function (r) {
              return r.json();
            });
          });
        }, Promise.resolve())
        .then(function () {
          return fetchFromServer();
        })
        .then(function (finalData) {
          var serverIds =
            finalData && finalData.ok && Array.isArray(finalData.opportunityIds)
              ? finalData.opportunityIds
              : data.opportunityIds || [];
          setCacheFromServer(serverIds, localSnapshot);
          return finalData || data;
        });
    });
  }

  function toggle(id) {
    var key = String(id || '');
    if (!key) return Promise.resolve(false);

    var local = ids();
    var nowSaved = !local.includes(key);
    if (nowSaved) local.push(key);
    else {
      local = local.filter(function (x) {
        return x !== key;
      });
    }
    writeLocal(local);

    return fetch('/api/auth/opportunity-favourites', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: key }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok && Array.isArray(data.opportunityIds)) {
          setCacheFromServer(data.opportunityIds, nowSaved ? [key] : []);
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
    scope.querySelectorAll('.opp-fav-btn[data-opp-id]').forEach(function (btn) {
      var saved = isSaved(btn.getAttribute('data-opp-id'));
      btn.classList.toggle('is-active', saved);
      btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
      btn.setAttribute('aria-label', saved ? 'Remove from saved' : 'Save opportunity');
    });
  }

  window.HubOpportunitySaves = {
    ids: ids,
    readLocal: readLocal,
    isSaved: isSaved,
    toggle: toggle,
    sync: syncFromServer,
    mergeOnLogin: mergeLocalToServer,
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
      if (data && data.ok && data.user) return mergeLocalToServer();
    })
    .catch(function () {
      /* guest — local only */
    });
})();
