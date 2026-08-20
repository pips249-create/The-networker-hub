/**
 * Communicate → Analytics — round-up + monthly update engagement lists.
 */
(function (global) {
  'use strict';

  var state = {
    groups: [],
    organiserId: '',
    bound: false,
    loading: false,
  };

  function els() {
    return {
      group: document.getElementById('oea-group'),
      groupWrap: document.getElementById('oea-group-wrap'),
      refresh: document.getElementById('oea-refresh'),
      status: document.getElementById('oea-status'),
      roundup: document.getElementById('oea-roundup-list'),
      monthly: document.getElementById('oea-monthly-list'),
    };
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setStatus(msg, kind) {
    var el = els().status;
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('is-ok', kind === 'ok');
    el.classList.toggle('is-error', kind === 'error');
  }

  function api(path) {
    return fetch(path, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    }).then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, status: res.status, data: data || {} };
      });
    });
  }

  function syncGroupOptions(groups) {
    state.groups = groups || [];
    var e = els();
    if (!e.group) return;
    if (state.groups.length > 1 && e.groupWrap) e.groupWrap.hidden = false;
    else if (e.groupWrap) e.groupWrap.hidden = true;
    e.group.innerHTML = state.groups
      .map(function (g) {
        return (
          '<option value="' +
          esc(g.id) +
          '"' +
          (String(g.id) === String(state.organiserId) ? ' selected' : '') +
          '>' +
          esc(g.name || 'Organiser page') +
          '</option>'
        );
      })
      .join('');
    if (!state.organiserId && state.groups[0]) {
      state.organiserId = state.groups[0].id;
      e.group.value = state.organiserId;
    }
  }

  function formatWhen(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('en-GB');
    } catch (e) {
      return String(iso);
    }
  }

  function renderRoundups(sends) {
    var el = els().roundup;
    if (!el) return;
    if (!sends || !sends.length) {
      el.innerHTML =
        '<p class="org-attendee-email-hint">No Attendee round-ups sent yet for this page.</p>';
      return;
    }
    el.innerHTML = sends
      .map(function (s) {
        var kind = s.listKind === 'going' ? 'Who’s going' : 'Who attended';
        return (
          '<article class="org-email-analytics-row">' +
          '<div class="org-email-analytics-row-main">' +
          '<strong>' +
          esc(s.eventTitle || 'Event') +
          '</strong>' +
          '<span>' +
          esc(kind) +
          (s.sentAt ? ' · ' + esc(formatWhen(s.sentAt)) : '') +
          (s.usedExtraCredit ? ' · paid credit' : '') +
          '</span>' +
          '</div>' +
          '<dl class="ogu-report-stats ogu-report-stats--compact">' +
          '<div><dt>Sent</dt><dd>' +
          esc(s.sentCount) +
          '</dd></div>' +
          '<div><dt>Opened</dt><dd>' +
          esc(s.opened) +
          ' <span>(' +
          esc(s.openRate) +
          '%)</span></dd></div>' +
          '<div><dt>Clicked</dt><dd>' +
          esc(s.clicked) +
          ' <span>(' +
          esc(s.clickRate) +
          '%)</span></dd></div>' +
          '</dl>' +
          '</article>'
        );
      })
      .join('');
  }

  function renderMonthly(updates) {
    var el = els().monthly;
    if (!el) return;
    var sent = (updates || []).filter(function (u) {
      return u.status === 'sent' || u.sent_at;
    });
    if (!sent.length) {
      el.innerHTML =
        '<p class="org-attendee-email-hint">No Monthly group updates sent yet for this page.</p>';
      return;
    }
    el.innerHTML = sent
      .map(function (u) {
        var eng = u.engagement || {};
        return (
          '<article class="org-email-analytics-row">' +
          '<div class="org-email-analytics-row-main">' +
          '<strong>' +
          esc(u.subject || 'Group update') +
          '</strong>' +
          '<span>' +
          esc(formatWhen(u.sent_at || u.sentAt || u.created_at)) +
          '</span>' +
          '</div>' +
          '<dl class="ogu-report-stats ogu-report-stats--compact">' +
          '<div><dt>Sent</dt><dd>' +
          esc(eng.sent != null ? eng.sent : u.sent_count || u.recipient_count || '—') +
          '</dd></div>' +
          '<div><dt>Opened</dt><dd>' +
          esc(eng.opened != null ? eng.opened : '—') +
          (eng.openRate != null ? ' <span>(' + esc(eng.openRate) + '%)</span>' : '') +
          '</dd></div>' +
          '<div><dt>Clicked</dt><dd>' +
          esc(eng.clicked != null ? eng.clicked : '—') +
          (eng.clickRate != null ? ' <span>(' + esc(eng.clickRate) + '%)</span>' : '') +
          '</dd></div>' +
          '<div><dt>Booked after</dt><dd>' +
          esc(eng.bookingsAfter != null ? eng.bookingsAfter : '—') +
          '</dd></div>' +
          '</dl>' +
          '</article>'
        );
      })
      .join('');
  }

  async function load() {
    if (!state.organiserId || state.loading) return;
    state.loading = true;
    setStatus('Loading email analytics…');
    try {
      var roundupRes = await api(
        '/api/organiser/event-connections?action=history&organiserId=' +
          encodeURIComponent(state.organiserId)
      );
      if (!roundupRes.ok) {
        throw new Error(
          (roundupRes.data && (roundupRes.data.message || roundupRes.data.error)) ||
            'Could not load round-up stats'
        );
      }
      renderRoundups((roundupRes.data && roundupRes.data.sends) || []);

      var monthlyRes = await api(
        '/api/organiser/group-updates?action=bootstrap&organiserId=' +
          encodeURIComponent(state.organiserId)
      );
      var updates = [];
      if (monthlyRes.ok && monthlyRes.data) {
        updates = monthlyRes.data.updates || [];
        // Enrich sent rows with engagement reports (best-effort, capped).
        var sent = updates.filter(function (u) {
          return u.status === 'sent';
        }).slice(0, 8);
        await Promise.all(
          sent.map(function (u) {
            return api(
              '/api/organiser/group-updates?action=report&organiserId=' +
                encodeURIComponent(state.organiserId) +
                '&id=' +
                encodeURIComponent(u.id)
            ).then(function (res) {
              if (res.ok && res.data && res.data.report) {
                u.engagement = res.data.report;
              }
            });
          })
        );
      }
      renderMonthly(updates);
      setStatus('Updated ' + new Date().toLocaleTimeString('en-GB') + '.', 'ok');
    } catch (err) {
      setStatus((err && err.message) || 'Could not load analytics.', 'error');
    } finally {
      state.loading = false;
    }
  }

  function bind() {
    if (state.bound) return;
    state.bound = true;
    var e = els();
    if (e.group) {
      e.group.addEventListener('change', function () {
        state.organiserId = String(e.group.value || '').trim();
        load().catch(function () {});
      });
    }
    if (e.refresh) {
      e.refresh.addEventListener('click', function () {
        load().catch(function () {});
      });
    }
  }

  function init(opts) {
    opts = opts || {};
    bind();
    syncGroupOptions(opts.groups || state.groups || []);
    if (!state.organiserId && state.groups[0]) state.organiserId = state.groups[0].id;
    if (!state.organiserId) {
      setStatus('Choose an organiser page first.', 'error');
      renderRoundups([]);
      renderMonthly([]);
      return;
    }
    load().catch(function () {});
  }

  global.HubOrganiserEmailAnalytics = {
    init: init,
  };
})(typeof window !== 'undefined' ? window : globalThis);
