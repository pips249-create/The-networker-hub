(function () {
  const params = new URLSearchParams(location.search);
  const organiserId = String(params.get('id') || params.get('organiserId') || '').trim();
  let members = [];
  let events = [];

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function showAlert(msg, tone) {
    const el = document.getElementById('omr-alert');
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
    el.classList.toggle('ee-alert-error', tone === 'error');
    el.classList.toggle('ee-alert-success', tone === 'success');
  }

  async function api(path, options) {
    const res = await fetch(path, {
      credentials: 'include',
      cache: 'no-store',
      ...(options || {}),
    });
    const data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
    return data;
  }

  function rosterUrl(extra) {
    return (
      '/api/organiser/roster?organiserId=' +
      encodeURIComponent(organiserId) +
      (extra || '')
    );
  }

  async function loadEvents() {
    try {
      const data = await api('/api/organiser/events?upcoming=1');
      events = (data.events || []).filter(function (ev) {
        return String(ev.organiserGroupId || ev.organiserId || '') === organiserId;
      });
      const sel = document.getElementById('omr-event-select');
      if (!sel) return;
      events.forEach(function (ev) {
        const opt = document.createElement('option');
        opt.value = ev.id;
        opt.textContent = (ev.title || 'Event') + (ev.dateLabel ? ' · ' + ev.dateLabel : '');
        sel.appendChild(opt);
      });
      sel.addEventListener('change', function () {
        loadReports(sel.value);
      });
    } catch {
      /* optional */
    }
  }

  function renderReports(reports) {
    const mount = document.getElementById('omr-reports');
    if (!mount || !reports) return;
    const h = reports.rosterHealth || {};
    const booked = reports.bookedForEvent;
    const attendance = reports.eventAttendance;
    const missed = reports.missedRecentMeetings;
    const expiry = reports.membershipExpiry || {};

    let html =
      '<div class="omr-report-card"><h3>Roster health</h3>' +
      '<p class="omr-report-stat">' +
      esc(h.totalActive || 0) +
      ' active</p>' +
      '<p>' +
      esc(h.claimed || 0) +
      ' signed up · ' +
      esc(h.unclaimed || 0) +
      ' not yet · ' +
      esc(h.expiringSoon || 0) +
      ' expiring soon</p></div>';

    if (booked) {
      html +=
        '<div class="omr-report-card"><h3>Booked for selected event</h3>' +
        '<p class="omr-report-stat">' +
        esc(booked.bookedCount) +
        ' booked · ' +
        esc(booked.notBookedCount) +
        ' not yet</p>';
      if (booked.notBooked && booked.notBooked.length) {
        html += '<ul>';
        booked.notBooked.slice(0, 8).forEach(function (m) {
          html += '<li>' + esc(m.name || m.email) + '</li>';
        });
        if (booked.notBooked.length > 8) {
          html += '<li>…and ' + (booked.notBooked.length - 8) + ' more</li>';
        }
        html += '</ul>';
      }
      html += '</div>';
    }

    if (attendance) {
      html +=
        '<div class="omr-report-card"><h3>New vs returning (event)</h3>' +
        '<p>' +
        esc(attendance.newCount) +
        ' new · ' +
        esc(attendance.returningCount) +
        ' returning</p></div>';
    }

    if (missed && missed.members && missed.members.length) {
      html += '<div class="omr-report-card"><h3>Missed recent meetings</h3><ul>';
      missed.members.slice(0, 6).forEach(function (m) {
        html +=
          '<li>' +
          esc(m.name || m.email) +
          ' — missed ' +
          esc(m.missedCount) +
          ' of ' +
          esc(m.recentEventsChecked) +
          '</li>';
      });
      html += '</ul></div>';
    }

    if (expiry.within14Days && expiry.within14Days.length) {
      html += '<div class="omr-report-card"><h3>Expiring within 14 days</h3><ul>';
      expiry.within14Days.forEach(function (m) {
        html +=
          '<li>' +
          esc(m.name || m.email) +
          ' — ' +
          esc(m.expiresAt) +
          '</li>';
      });
      html += '</ul></div>';
    }

    mount.innerHTML = html;
    mount.hidden = false;
  }

  async function loadReports(eventId) {
    let qs = '&action=reports';
    if (eventId) qs += '&eventId=' + encodeURIComponent(eventId);
    const recent = events
      .slice(0, 6)
      .map(function (e) {
        return e.id;
      })
      .join(',');
    if (recent) qs += '&recentEventIds=' + encodeURIComponent(recent);
    const data = await api(rosterUrl(qs));
    renderReports(data.reports);
  }

  function renderRoster() {
    const body = document.getElementById('omr-body');
    const empty = document.getElementById('omr-empty');
    if (!body) return;
    body.innerHTML = '';
    const active = members.filter(function (m) {
      return m.status === 'active';
    });
    if (!active.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    active.forEach(function (m) {
      const tr = document.createElement('tr');
      const hub =
        m.claimedAt || m.attendeeId
          ? '<span class="omr-badge-claimed">Signed up</span>'
          : '<span class="omr-badge-pending">Not yet</span>';
      const exp = m.expiresAt
        ? m.expiringSoon
          ? '<span class="omr-badge-expiring">' + esc(m.expiresAt) + '</span>'
          : esc(m.expiresAt)
        : '—';
      tr.innerHTML =
        '<td>' +
        esc(m.name || '—') +
        '</td><td>' +
        esc(m.email) +
        '</td><td>' +
        exp +
        '</td><td>' +
        hub +
        '</td><td><button type="button" class="ee-btn ee-btn-outline omr-remove" data-id="' +
        esc(m.id) +
        '">Remove</button></td>';
      body.appendChild(tr);
    });
    body.querySelectorAll('.omr-remove').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('Remove this member from the roster?')) return;
        try {
          await api(rosterUrl('&id=' + encodeURIComponent(btn.dataset.id)), { method: 'DELETE' });
          await refresh();
        } catch (e) {
          showAlert(e.message, 'error');
        }
      });
    });
  }

  async function refresh() {
    const hint = document.getElementById('omr-load-hint');
    if (hint) hint.hidden = false;
    const data = await api(rosterUrl());
    members = data.members || [];
    renderRoster();
    const eventId = document.getElementById('omr-event-select')?.value || '';
    await loadReports(eventId);
    if (hint) hint.hidden = true;
  }

  async function init() {
    if (!organiserId) {
      location.href = '/organiser/#groups';
      return;
    }
    const back = document.getElementById('omr-back');
    if (back) back.href = '/organiser/group-edit?id=' + encodeURIComponent(organiserId);

    document.getElementById('omr-add-form')?.addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        await api(rosterUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organiserId: organiserId,
            name: document.getElementById('omr-name')?.value.trim(),
            email: document.getElementById('omr-email')?.value.trim(),
            expiresAt: document.getElementById('omr-expires')?.value || null,
          }),
        });
        document.getElementById('omr-add-form')?.reset();
        showAlert('Member added.', 'success');
        await refresh();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    });

    document.getElementById('omr-import-btn')?.addEventListener('click', async function () {
      const csv = document.getElementById('omr-csv')?.value || '';
      if (!csv.trim()) {
        showAlert('Paste CSV content first.', 'error');
        return;
      }
      try {
        const data = await api(rosterUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organiserId: organiserId, csv: csv }),
        });
        showAlert('Imported ' + data.ok + ' of ' + data.total + ' rows.', 'success');
        await refresh();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    });

    try {
      const group = await api('/api/organiser/groups?id=' + encodeURIComponent(organiserId));
      const title = document.getElementById('omr-title');
      if (title && group.group?.name) {
        title.textContent = 'Member roster — ' + group.group.name;
      }
    } catch {
      /* ignore */
    }

    await loadEvents();
    await refresh();
  }

  init().catch(function (e) {
    showAlert(e.message || 'Could not load roster', 'error');
  });
})();
