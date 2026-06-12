/**
 * Event format picker — group profile must be chosen before format.
 */
(function () {
  var GROUP_KEY =
    (window.HubOrganiserActions && window.HubOrganiserActions.GROUP_STORAGE_KEY) ||
    'hub_event_group_id';
  var FORMAT_KEY = 'hub_event_format';

  var groupSelect = document.getElementById('ee-event-group');
  var formatGrid = document.getElementById('ee-format-grid');
  var groupHint = document.getElementById('ee-group-pick-hint');
  var groups = [];

  function api(path) {
    return fetch(path, { credentials: 'include' }).then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, data: data };
      });
    });
  }

  function loginRedirect() {
    var next = '/organiser/event-format.html';
    window.location.href = '../login.html?next=' + encodeURIComponent(next);
  }

  function setFormatEnabled(on) {
    if (!formatGrid) return;
    formatGrid.classList.toggle('is-disabled', !on);
    formatGrid.querySelectorAll('.ee-format-card').forEach(function (card) {
      card.setAttribute('aria-disabled', on ? 'false' : 'true');
      card.tabIndex = on ? 0 : -1;
    });
  }

  function selectedGroupId() {
    var val = groupSelect && groupSelect.value ? String(groupSelect.value).trim() : '';
    if (!val || val === '__new_group__') return '';
    return val;
  }

  function syncGroupSelection() {
    var id = selectedGroupId();
    if (id === '__new_group__') {
      window.location.href = 'group-edit.html';
      return;
    }
    setFormatEnabled(Boolean(id));
    if (groupHint) {
      groupHint.textContent = id
        ? 'Group selected — now choose how people will attend.'
        : 'Choose a group profile to continue.';
    }
  }

  function fillGroups(list) {
    if (!groupSelect) return;
    groupSelect.innerHTML = '';
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select a group profile…';
    groupSelect.appendChild(placeholder);
    list.forEach(function (g) {
      var opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name || 'Group';
      groupSelect.appendChild(opt);
    });
    var addNew = document.createElement('option');
    addNew.value = '__new_group__';
    addNew.textContent = '+ Add a new group profile…';
    groupSelect.appendChild(addNew);
    if (list.length === 1) {
      groupSelect.value = list[0].id;
    } else {
      var preselected = '';
      try {
        preselected = sessionStorage.getItem(GROUP_KEY) || '';
      } catch (err) {
        /* ignore */
      }
      if (preselected && list.some(function (g) { return g.id === preselected; })) {
        groupSelect.value = preselected;
      }
    }
    syncGroupSelection();
  }

  function bindFormatCards() {
    if (!formatGrid) return;
    formatGrid.querySelectorAll('.ee-format-card').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var groupId = selectedGroupId();
        if (!groupId) {
          window.alert('Please choose a group profile first.');
          if (groupSelect) groupSelect.focus();
          return;
        }
        var href = link.getAttribute('href') || '';
        var m = href.match(/format=([a-z-]+)/i);
        if (!m) return;
        try {
          sessionStorage.setItem(GROUP_KEY, groupId);
          sessionStorage.setItem(FORMAT_KEY, m[1]);
        } catch (err) {
          /* ignore */
        }
        window.location.href = href;
      });
    });
  }

  async function init() {
    setFormatEnabled(false);
    bindFormatCards();

    var session = await api('/api/auth/session');
    if (!session.ok || !session.data.user) {
      loginRedirect();
      return;
    }

    var profiles = Number(session.data.organiserProfiles) || 0;
    var isAdmin = session.data.user.role === 'admin';
    if (profiles === 0 && !(isAdmin && session.data.canOrganise)) {
      window.alert('You must add a group profile first.');
      window.location.href = 'group-edit.html';
      return;
    }

    var boot = await api('/api/organiser/bootstrap');
    if (!boot.ok || !boot.data) {
      loginRedirect();
      return;
    }

    groups = boot.data.groups || [];
    if (!groups.length) {
      window.alert('You must add a group profile first.');
      window.location.href = 'group-edit.html';
      return;
    }

    fillGroups(groups);
    if (groupSelect) {
      groupSelect.addEventListener('change', syncGroupSelection);
    }
  }

  if (window.HubFlowTour) {
    window.HubFlowTour.consumeEventTourPending();
    window.HubFlowTour.startEventFormatTour({ delay: 0 });
  }
  init();
  var backLink = document.querySelector('.ee-back');
  if (backLink && window.HubOrganiserActions) {
    window.HubOrganiserActions.applyBrowseReturnBack(
      backLink,
      'index.html#events-list',
      '← Back to My Events'
    );
  }
})();
