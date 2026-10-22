/**
 * Gate for "List your… → Organiser" when signed out.
 * Signed-in visitors continue into the organiser group flow.
 */
(function () {
  var GROUP_EDIT = '/organiser/group-edit';
  var ENABLE = '/organiser/enable';
  var VERIFY = '/organiser/verify-email';
  var main = document.getElementById('list-account-main');
  var loading = document.getElementById('list-account-loading');

  function showGate() {
    if (loading) loading.hidden = true;
    if (main) main.hidden = false;
  }

  function organiserWorkspaceReady(data) {
    if (!data || !data.ok || !data.user) return false;
    if (data.user.role === 'admin') return true;
    if ((data.pendingClaimCount || 0) > 0) return true;
    return data.organiserUiVisible === true;
  }

  async function restoreOrganiserUiIfHidden(sessionData) {
    if (!sessionData.organiserAccess || sessionData.organiserUiVisible) return sessionData;
    try {
      var res = await fetch('/api/auth/organiser-access', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'show-ui' }),
      });
      var data = await res.json();
      if (data.ok && data.needsEnable) return sessionData;
      if (data.ok) {
        var refreshed = await fetch('/api/auth/session', { credentials: 'include' });
        return refreshed.json();
      }
    } catch (e) {
      /* fall through */
    }
    return sessionData;
  }

  async function init() {
    var data;
    try {
      var res = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
      data = await res.json();
    } catch (e) {
      showGate();
      return;
    }

    if (!data || !data.ok || !data.user) {
      showGate();
      return;
    }

    if (data.user.role !== 'admin' && !data.impersonating && data.organiserEmailVerified !== true) {
      window.location.replace(VERIFY + '?next=' + encodeURIComponent(GROUP_EDIT));
      return;
    }

    data = await restoreOrganiserUiIfHidden(data);
    if (!organiserWorkspaceReady(data)) {
      window.location.replace(ENABLE);
      return;
    }

    window.location.replace(GROUP_EDIT);
  }

  init();
})();
