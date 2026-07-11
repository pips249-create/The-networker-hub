/**
 * Saved opportunities — localStorage for guests, Supabase sync when signed in.
 */
(function () {
  var SAVE_KEY = 'hubSavedOpportunityIds';
  var SAVE_ITEMS_KEY = 'hubSavedOpportunityItems';
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

  function readLocalItems() {
    try {
      var raw = localStorage.getItem(SAVE_ITEMS_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
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

  function writeLocalItems(items) {
    var list = Array.isArray(items) ? items : [];
    try {
      localStorage.setItem(SAVE_ITEMS_KEY, JSON.stringify(list));
    } catch (e) {
      /* ignore */
    }
  }

  function snapshotFromMeta(id, meta) {
    var key = String((meta && meta.id) || id || '').trim();
    if (!key) return null;
    return {
      opportunityId: key,
      title: String((meta && meta.title) || 'Opportunity').trim() || 'Opportunity',
      host: String((meta && meta.host) || '').trim(),
      slug: String((meta && meta.slug) || '').trim(),
      logoUrl: String((meta && meta.logoUrl) || '').trim(),
      imageUrl: String((meta && meta.imageUrl) || '').trim(),
      createdAt: new Date().toISOString(),
    };
  }

  function upsertLocalItem(snapshot) {
    if (!snapshot || !snapshot.opportunityId) return;
    var items = readLocalItems();
    var key = String(snapshot.opportunityId);
    var next = items.filter(function (item) {
      return String(item.opportunityId || item.opportunity_id || '') !== key;
    });
    next.unshift(snapshot);
    writeLocalItems(next);
  }

  function removeLocalItem(id) {
    var key = String(id || '').trim();
    if (!key) return;
    writeLocalItems(
      readLocalItems().filter(function (item) {
        return String(item.opportunityId || item.opportunity_id || '') !== key;
      })
    );
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
        return res.json().then(function (data) {
          return { status: res.status, data: data };
        });
      })
      .catch(function () {
        return { status: 0, data: null };
      });
  }

  function syncFromServer() {
    if (syncPromise) return syncPromise;
    syncPromise = fetchFromServer()
      .then(function (result) {
        var data = result.data;
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
    var localItems = readLocalItems();
    if (!localSnapshot.length) return syncFromServer();

    return fetchFromServer().then(function (result) {
      var data = result.data;
      if (!data || !data.ok) {
        cache = uniqueIds(
          localSnapshot.concat(
            localItems.map(function (item) {
              return item.opportunityId || item.opportunity_id;
            })
          )
        );
        writeLocal(cache);
        return data;
      }

      var server = new Set((data.opportunityIds || []).map(String));
      var pending = uniqueIds(
        localSnapshot.concat(
          localItems.map(function (item) {
            return item.opportunityId || item.opportunity_id;
          })
        )
      ).filter(function (id) {
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
        .then(function (finalResult) {
          var finalData = finalResult.data;
          var serverIds =
            finalData && finalData.ok && Array.isArray(finalData.opportunityIds)
              ? finalData.opportunityIds
              : data.opportunityIds || [];
          setCacheFromServer(
            serverIds,
            uniqueIds(
              localSnapshot.concat(
                localItems.map(function (item) {
                  return item.opportunityId || item.opportunity_id;
                })
              )
            )
          );
          return finalData || data;
        });
    });
  }

  function toggle(id, meta) {
    var key = String(id || '');
    if (!key) return Promise.resolve(false);

    var local = ids();
    var nowSaved = !local.includes(key);
    if (nowSaved) {
      local.push(key);
      var snapshot = snapshotFromMeta(key, meta);
      if (snapshot) upsertLocalItem(snapshot);
    } else {
      local = local.filter(function (x) {
        return x !== key;
      });
      removeLocalItem(key);
    }
    writeLocal(local);

    return fetch('/api/auth/opportunity-favourites', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: key }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { status: res.status, data: data };
        });
      })
      .then(function (result) {
        var data = result.data;
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
    readLocalItems: readLocalItems,
    isSaved: isSaved,
    toggle: toggle,
    sync: syncFromServer,
    mergeOnLogin: mergeLocalToServer,
    refreshButtons: refreshButtons,
    writeLocal: writeLocal,
    writeLocalItems: writeLocalItems,
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
