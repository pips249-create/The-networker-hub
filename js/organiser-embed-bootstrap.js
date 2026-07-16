/**
 * Fast bootstrap for organiser event drawers (iframe embed).
 * Prefers data pushed from the dashboard, then sessionStorage, then a lean API call.
 */
(function (global) {
  'use strict';

  const CACHE_KEY = 'hub_org_bootstrap_cache';
  const CACHE_MS = 300000;
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

  global.HubOrganiserEmbedBootstrap = {
    CACHE_KEY: CACHE_KEY,
    isEmbedDrawer: isEmbedDrawer,
    readCache: readCache,
    writeCache: writeCache,
    loadOrganiserBootstrapData: loadOrganiserBootstrapData,
  };
})(typeof window !== 'undefined' ? window : globalThis);
