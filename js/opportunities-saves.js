/**
 * Saved opportunities — localStorage for guests, Supabase sync when signed in.
 * POST = add (idempotent). DELETE = remove. Never toggle via POST — parallel
 * merges were adding then immediately removing the same favourite.
 *
 * localStorage is browser-scoped (not per account). Never merge local saves into
 * another account — especially while impersonating — or the wrong user's bookmarks
 * appear and can be written to the target account.
 */
(function () {
  var SAVE_KEY = 'hubSavedOpportunityIds';
  var SAVE_ITEMS_KEY = 'hubSavedOpportunityItems';
  var OWNER_KEY = 'hubSavedOpportunityOwner';
  var cache = null;
  var syncPromise = null;
  var mergePromise = null;
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
    if (activeAccount.impersonating) {
      cache = uniqueIds(ids);
      return;
    }
    var next = uniqueIds(ids);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(next));
    } catch (e) {
      /* ignore */
    }
    cache = next.slice();
    if (activeAccount.email) writeOwner(activeAccount.email);
  }

  function writeLocalItems(items) {
    if (activeAccount.impersonating) return;
    var list = Array.isArray(items) ? items : [];
    try {
      localStorage.setItem(SAVE_ITEMS_KEY, JSON.stringify(list));
    } catch (e) {
      /* ignore */
    }
    if (activeAccount.email) writeOwner(activeAccount.email);
  }

  function metaVal(meta, keyRe) {
    for (var i = 0; i < (meta || []).length; i++) {
      if (keyRe.test(meta[i].key)) return String(meta[i].val || '').trim();
    }
    return '';
  }

  function snapshotFromMeta(id, meta) {
    var key = String((meta && meta.id) || id || '').trim();
    if (!key) return null;
    var listingMeta = Array.isArray(meta && meta.meta) ? meta.meta : [];
    return {
      opportunityId: key,
      id: key,
      title: String((meta && meta.title) || 'Opportunity').trim() || 'Opportunity',
      host: String((meta && meta.host) || '').trim(),
      slug: String((meta && meta.slug) || '').trim(),
      type: String((meta && meta.type) || '').trim(),
      logoUrl: String((meta && meta.logoUrl) || '').trim(),
      imageUrl: String((meta && meta.imageUrl) || '').trim(),
      locationLabel: String((meta && meta.locationLabel) || metaVal(listingMeta, /^location$/i) || '').trim(),
      investment: String(metaVal(listingMeta, /^investment$/i) || '').trim(),
      commitment: String(metaVal(listingMeta, /^commitment$/i) || '').trim(),
      meta: listingMeta.map(function (m) {
        return { key: m.key, val: m.val };
      }),
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
    if (!activeAccount.impersonating && keepLocalIds && keepLocalIds.length && canUseLocalCache()) {
      merged = uniqueIds(merged.concat(keepLocalIds));
    }
    cache = merged;
    if (activeAccount.impersonating) return;
    writeLocal(cache);
  }

  function parseFetchJson(res) {
    return res.json().then(
      function (data) {
        return { status: res.status, data: data };
      },
      function () {
        return { status: res.status, data: null };
      }
    );
  }

  function fetchFromServer() {
    return fetch('/api/auth/opportunity-favourites', { credentials: 'include' })
      .then(parseFetchJson)
      .catch(function () {
        return { status: 0, data: null };
      });
  }

  function postFavourite(id) {
    return fetch('/api/auth/opportunity-favourites', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: id }),
    }).then(parseFetchJson);
  }

  function deleteFavourite(id) {
    return fetch('/api/auth/opportunity-favourites', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: id }),
    }).then(parseFetchJson);
  }

  function syncFromServer() {
    if (syncPromise) return syncPromise;
    syncPromise = fetchFromServer()
      .then(function (result) {
        var data = result.data;
        if (data && data.ok && Array.isArray(data.opportunityIds)) {
          setCacheFromServer(data.opportunityIds);
          if (data.favourites && !activeAccount.impersonating) {
            writeLocalItems(
              (data.favourites || []).map(function (item) {
                return {
                  opportunityId: item.opportunityId || item.opportunity_id,
                  id: item.opportunityId || item.opportunity_id,
                  title: item.title || 'Opportunity',
                  host: item.host || '',
                  slug: item.slug || '',
                  type: item.type || '',
                  logoUrl: item.logoUrl || item.imageUrl || '',
                  imageUrl: item.imageUrl || item.logoUrl || '',
                  locationLabel: item.locationLabel || '',
                  investment: item.investment || '',
                  commitment: item.commitment || '',
                  meta: Array.isArray(item.meta) ? item.meta : [],
                  createdAt: item.createdAt || item.created_at || null,
                };
              })
            );
          }
        }
        return data;
      })
      .finally(function () {
        syncPromise = null;
      });
    return syncPromise;
  }

  function mergeLocalToServer() {
    if (mergePromise) return mergePromise;

    mergePromise = (function () {
      if (activeAccount.impersonating || !canUseLocalCache()) {
        return syncFromServer();
      }

      var localSnapshot = readLocal();
      var localItems = readLocalItems();
      if (!localSnapshot.length && !localItems.length) return syncFromServer();

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
              return postFavourite(id);
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
            setCacheFromServer(serverIds);
            return finalData || data;
          });
      });
    })().finally(function () {
      mergePromise = null;
    });

    return mergePromise;
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

  function compareHref() {
    return '../account/?scope=opportunities&compare=1#saved';
  }

  function dismissCompareNudge() {
    var el = document.getElementById('opp-compare-nudge');
    if (el) el.remove();
  }

  function showCompareNudge() {
    try {
      if (sessionStorage.getItem('hubOppCompareNudgeShown') === '1') return;
      sessionStorage.setItem('hubOppCompareNudgeShown', '1');
    } catch (e) {
      /* ignore */
    }

    dismissCompareNudge();
    var el = document.createElement('div');
    el.id = 'opp-compare-nudge';
    el.className = 'opp-compare-nudge';
    el.setAttribute('role', 'status');
    el.innerHTML =
      '<div class="opp-compare-nudge-inner">' +
      '<p class="opp-compare-nudge-text">You have saved 2 opportunities. You can compare them side by side.</p>' +
      '<div class="opp-compare-nudge-actions">' +
      '<a class="opp-compare-nudge-btn" href="' +
      compareHref() +
      '">Compare now</a>' +
      '<button type="button" class="opp-compare-nudge-dismiss" aria-label="Dismiss">Not now</button>' +
      '</div></div>';
    document.body.appendChild(el);

    var dismissBtn = el.querySelector('.opp-compare-nudge-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', dismissCompareNudge);
    }
    var link = el.querySelector('.opp-compare-nudge-btn');
    if (link) {
      link.addEventListener('click', function () {
        var savedIds = ids().slice(0, 3);
        try {
          localStorage.setItem('hub_opp_compare', JSON.stringify(savedIds));
        } catch (err) {
          /* ignore */
        }
      });
    }

    window.setTimeout(function () {
      el.classList.add('is-visible');
    }, 20);
  }

  function maybeNudgeCompare(nowSaved) {
    if (!nowSaved) return;
    if (ids().length === 2) showCompareNudge();
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
    maybeNudgeCompare(nowSaved);

    var request = nowSaved ? postFavourite(key) : deleteFavourite(key);

    return request
      .then(function (result) {
        var data = result.data;
        if (data && data.ok && Array.isArray(data.opportunityIds)) {
          setCacheFromServer(data.opportunityIds, nowSaved ? [key] : []);
          return nowSaved;
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
    adoptSession: adoptSession,
    canUseLocalCache: canUseLocalCache,
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
      return adoptSession(data);
    })
    .catch(function () {
      /* guest — local only */
    });
})();
