/**
 * Fast bootstrap for organiser event drawers (iframe embed).
 * Prefers data pushed from the dashboard, then sessionStorage, then a lean API call.
 */
(function (global) {
  'use strict';

  const CACHE_KEY = 'hub_org_bootstrap_cache';
  const CACHE_MS = 300000;
  const CONNECTED_SETUP_PREFETCH_KEY = 'hub_connected_setup_prefetch_v1';
  const CONNECTED_SETUP_PREFETCH_MS = 180000;
  const PARENT_WAIT_MS = 150;

  function isEmbedDrawer() {
    try {
      return (
        new URLSearchParams(global.location.search).get('embed') === '1' ||
        global.self !== global.top
      );
    } catch {
      return false;
    }
  }

  function normalizeCacheEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const at = Number(raw.at || raw.ts || 0);
    if (!at || Date.now() - at > CACHE_MS) return null;
    return {
      groups: Array.isArray(raw.groups) ? raw.groups : [],
      events: Array.isArray(raw.events) ? raw.events : [],
    };
  }

  function writeCache(groups, events) {
    try {
      global.sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          at: Date.now(),
          groups: groups || [],
          events: events || [],
        })
      );
    } catch {
      /* ignore */
    }
  }

  function readCache() {
    try {
      const raw = global.sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return normalizeCacheEntry(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  function clearCache() {
    try {
      global.sessionStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
    parentPayload = null;
  }

  function patchCachedGroup(groupId, patch) {
    const gid = String(groupId || '').trim();
    if (!gid || !patch || typeof patch !== 'object') return false;
    let changed = false;
    const apply = function (groups) {
      if (!Array.isArray(groups)) return groups;
      return groups.map(function (g) {
        if (String(g && g.id) !== gid) return g;
        changed = true;
        return Object.assign({}, g, patch);
      });
    };
    if (parentPayload && Array.isArray(parentPayload.groups)) {
      parentPayload = {
        groups: apply(parentPayload.groups),
        events: parentPayload.events || [],
      };
    }
    const cached = readCache();
    if (cached) {
      const groups = apply(cached.groups);
      if (changed) writeCache(groups, cached.events);
    }
    return changed;
  }

  let parentPayload = null;
  let parentWaiters = [];

  function resolveParentWaiters() {
    const payload = parentPayload;
    const waiters = parentWaiters.slice();
    parentWaiters = [];
    waiters.forEach(function (resolve) {
      resolve(payload);
    });
  }

  function applyParentPayload(groups, events) {
    parentPayload = {
      groups: Array.isArray(groups) ? groups : [],
      events: Array.isArray(events) ? events : [],
    };
    writeCache(parentPayload.groups, parentPayload.events);
    resolveParentWaiters();
  }

  global.addEventListener('message', function (e) {
    if (e.origin !== global.location.origin) return;
    if (!e.data || e.data.type !== 'hub-event-drawer-bootstrap') return;
    applyParentPayload(e.data.groups, e.data.events);
  });

  function requestParentBootstrap() {
    try {
      if (global.parent && global.parent !== global) {
        global.parent.postMessage({ type: 'hub-event-drawer-bootstrap-request' }, global.location.origin);
      }
    } catch {
      /* ignore */
    }
  }

  function waitForParentBootstrap() {
    if (!isEmbedDrawer()) return Promise.resolve(null);
    if (parentPayload) return Promise.resolve(parentPayload);
    return new Promise(function (resolve) {
      let settled = false;
      const finish = function () {
        if (settled) return;
        settled = true;
        resolve(parentPayload);
      };
      parentWaiters.push(finish);
      global.setTimeout(finish, PARENT_WAIT_MS);
      requestParentBootstrap();
    });
  }

  async function fetchBootstrapApi(groupsOnly) {
    const path = groupsOnly ? '/api/organiser/bootstrap?groupsOnly=1' : '/api/organiser/bootstrap';
    const res = await fetch(path, {
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return { ok: res.ok, status: res.status, data: data };
  }

  async function loadOrganiserBootstrapData(options) {
    options = options || {};
    const embed = isEmbedDrawer();

    if (embed) {
      await waitForParentBootstrap();
      if (parentPayload) {
        return { ok: true, data: parentPayload };
      }
    }

    const cached = embed || options.allowCache ? readCache() : null;
    if (cached) {
      return { ok: true, data: cached };
    }

    const useGroupsOnly = embed && options.groupsOnly !== false;
    const result = await fetchBootstrapApi(useGroupsOnly);
    if (!result.ok) return result;

    const body = result.data || {};
    const payload = {
      groups: body.groups || [],
      events: body.events || [],
    };
    if (embed) writeCache(payload.groups, payload.events);
    return { ok: true, data: payload };
  }

  function eventIdsFromSearch(search) {
    const params = new URLSearchParams(search || global.location.search);
    const ids = String(params.get('ids') || params.get('returnIds') || '')
      .split(',')
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    if (ids.length) return ids;
    const single = String(params.get('id') || params.get('eventId') || '').trim();
    return single ? [single] : [];
  }

  function buildEmbedHref(path, opts) {
    const options = opts || {};
    const url = new URL(path, global.location.origin);
    if (isEmbedDrawer()) url.searchParams.set('embed', '1');
    const ids = options.eventIds || eventIdsFromSearch();
    if (ids.length && !url.searchParams.has('ids') && !url.searchParams.has('returnIds')) {
      url.searchParams.set(options.idsParam || 'returnIds', ids.join(','));
    }
    if (options.id) url.searchParams.set('id', String(options.id));
    if (options.platform) url.searchParams.set('platform', String(options.platform));
    if (options.fromTickets) url.searchParams.set('from', 'tickets');
    if (options.hash) url.hash = options.hash;
    return url.pathname + url.search + url.hash;
  }

  function applyEmbedDrawerBodyClass() {
    if (!isEmbedDrawer()) return;
    if (global.document && global.document.body) {
      global.document.body.classList.add('ee-embed-drawer');
    }
    if (global.document && global.document.documentElement) {
      global.document.documentElement.classList.add('ee-embed-drawer-root');
    }
  }

  function notifyParent(type, payload) {
    if (!isEmbedDrawer() || !global.parent || global.parent === global) return false;
    global.parent.postMessage(
      Object.assign({ type: type }, payload || {}),
      global.location.origin
    );
    return true;
  }

  function writeConnectedSetupPrefetch(eventId, event, billing) {
    const id = String(eventId || '').trim();
    if (!id || !event) return;
    try {
      global.sessionStorage.setItem(
        CONNECTED_SETUP_PREFETCH_KEY,
        JSON.stringify({
          at: Date.now(),
          eventId: id,
          event: event,
          billing: billing || null,
        })
      );
    } catch {
      /* ignore */
    }
  }

  function readConnectedSetupPrefetch(eventId) {
    const id = String(eventId || '').trim();
    if (!id) return null;
    try {
      const raw = global.sessionStorage.getItem(CONNECTED_SETUP_PREFETCH_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || String(parsed.eventId) !== id) return null;
      if (!parsed.at || Date.now() - Number(parsed.at) > CONNECTED_SETUP_PREFETCH_MS) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function notifyEmbedDrawerReady(progressStep, stepComplete) {
    return notifyParent('hub-event-drawer-ready', {
      progressStep: progressStep || 'tickets',
      stepComplete: stepComplete,
    });
  }

  function notifyEmbedDrawerBusy(busy, message, progressStep) {
    return notifyParent('hub-event-drawer-busy', {
      busy: Boolean(busy),
      message: message || '',
      progressStep: progressStep || 'tickets',
    });
  }

  global.HubOrganiserEmbedBootstrap = {
    CACHE_KEY: CACHE_KEY,
    isEmbedDrawer: isEmbedDrawer,
    eventIdsFromSearch: eventIdsFromSearch,
    buildEmbedHref: buildEmbedHref,
    applyEmbedDrawerBodyClass: applyEmbedDrawerBodyClass,
    notifyParent: notifyParent,
    writeConnectedSetupPrefetch: writeConnectedSetupPrefetch,
    readConnectedSetupPrefetch: readConnectedSetupPrefetch,
    notifyEmbedDrawerReady: notifyEmbedDrawerReady,
    notifyEmbedDrawerBusy: notifyEmbedDrawerBusy,
    readCache: readCache,
    writeCache: writeCache,
    clearCache: clearCache,
    patchCachedGroup: patchCachedGroup,
    loadOrganiserBootstrapData: loadOrganiserBootstrapData,
  };
})(typeof window !== 'undefined' ? window : globalThis);
