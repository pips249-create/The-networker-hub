(function () {
  const params = new URLSearchParams(location.search);
  const organiserId = String(params.get('id') || params.get('organiserId') || '').trim();
  const PAGE_SIZE = 10;
  let members = [];
  let events = [];
  let lastReports = null;
  let page = 1;
  const filters = { search: '', status: 'all' };

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
    if (msg) {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch {
        /* ignore */
      }
    }
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

  function selectedEventId() {
    return document.getElementById('omr-event-select')?.value || '';
  }

  function bookedEmailSet() {
    const set = new Set();
    const booked = lastReports && lastReports.bookedForEvent;
    if (!booked) return set;
    (booked.booked || []).forEach(function (m) {
      if (m.email) set.add(String(m.email).toLowerCase());
    });
    return set;
  }

  function isBookedForSelectedEvent(m) {
    if (!selectedEventId() || !lastReports || !lastReports.bookedForEvent) return null;
    return bookedEmailSet().has(String(m.email || '').toLowerCase());
  }

  function isClaimed(m) {
    return Boolean(m.claimedAt || m.attendeeId);
  }

  function syncAddPanel(totalActive) {
    const panel = document.getElementById('omr-add-panel');
    const hint = document.getElementById('omr-add-panel-hint');
    const intro = document.getElementById('omr-intro');
    if (!panel) return;
    if (totalActive > 0) {
      panel.open = false;
      if (hint) hint.textContent = 'Add more people or import another spreadsheet';
      if (intro) intro.hidden = true;
    } else {
      panel.open = true;
      if (hint) hint.textContent = 'Name, email, or a spreadsheet';
      if (intro) intro.hidden = false;
    }
  }

  function syncBulkResend(totalActive) {
    const btn = document.getElementById('omr-bulk-resend');
    if (!btn) return;
    const unclaimed = members.filter(function (m) {
      return m.status === 'active' && !isClaimed(m);
    }).length;
    btn.hidden = !(totalActive > 0 && unclaimed > 0);
    btn.textContent =
      unclaimed === 1
        ? 'Resend invite to 1 not signed up'
        : 'Resend invites to ' + unclaimed + ' not signed up';
  }

  async function loadEvents() {
    try {
      const data = await api('/api/organiser/events');
      const now = Date.now();
      events = (data.events || [])
        .filter(function (ev) {
          return String(ev.organiserGroupId || ev.organiserId || '') === organiserId;
        })
        .filter(function (ev) {
          const status = String(ev.status || ev.listingStatus || '').toLowerCase();
          const approval = String(ev.approvalStatus || ev.approval_status || 'Approved');
          return status === 'published' && approval === 'Approved';
        })
        .sort(function (a, b) {
          const aStart = a.startsAt || a.starts_at || a.date || '';
          const bStart = b.startsAt || b.starts_at || b.date || '';
          const aTime = aStart ? new Date(aStart).getTime() : 0;
          const bTime = bStart ? new Date(bStart).getTime() : 0;
          const aUpcoming = aTime >= now;
          const bUpcoming = bTime >= now;
          if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
          if (aUpcoming) return aTime - bTime;
          return bTime - aTime;
        });
      const sel = document.getElementById('omr-event-select');
      if (!sel) return;
      while (sel.options.length > 1) sel.remove(1);
      events.forEach(function (ev) {
        const opt = document.createElement('option');
        opt.value = ev.id;
        const start = ev.startsAt || ev.starts_at || ev.date || '';
        const isPast = start && new Date(start).getTime() < now;
        const label = (ev.title || 'Event') + (ev.dateLabel ? ' · ' + ev.dateLabel : '');
        opt.textContent = isPast ? label + ' (past)' : label;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', function () {
        const reportBtn = document.getElementById('omr-download-report');
        const remindBtn = document.getElementById('omr-remind-not-booked');
        if (reportBtn) {
          reportBtn.disabled = !sel.value;
          reportBtn.title = sel.value ? '' : 'Choose an event first';
        }
        if (remindBtn) {
          remindBtn.disabled = !sel.value;
          remindBtn.title = sel.value ? '' : 'Choose an event first';
        }
        if (
          !sel.value &&
          (filters.status === 'booked' || filters.status === 'not_booked')
        ) {
          filters.status = 'all';
          const statusSel = document.getElementById('omr-status-filter');
          if (statusSel) statusSel.value = 'all';
        }
        page = 1;
        loadReports(sel.value).then(function () {
          renderRoster();
        });
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
      '<div class="omr-report-card"><h3>Membership health</h3>' +
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
    lastReports = data.reports || null;
    renderReports(data.reports);
  }

  function filteredMembers() {
    const q = filters.search.trim().toLowerCase();
    const eventSelected = Boolean(selectedEventId());
    return members.filter(function (m) {
      if (m.status !== 'active') return false;
      if (filters.status === 'claimed' && !isClaimed(m)) return false;
      if (filters.status === 'unclaimed' && isClaimed(m)) return false;
      if (filters.status === 'expiring' && !m.expiringSoon) return false;
      if (filters.status === 'booked') {
        if (!eventSelected) return false;
        if (!isBookedForSelectedEvent(m)) return false;
      }
      if (filters.status === 'not_booked') {
        if (!eventSelected) return false;
        if (isBookedForSelectedEvent(m) !== false) return false;
      }
      if (q) {
        const hay = ((m.name || '') + ' ' + (m.email || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function csvCell(v) {
    return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  }

  function downloadCsvFile(filename, lines) {
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadTemplateCsv() {
    downloadCsvFile(
      'member-list-template.csv',
      ['email,name,expires', 'jane@example.com,Jane Smith,2026-12-31']
    );
  }

  function downloadMembersCsv() {
    const rows = filteredMembers();
    if (!rows.length) {
      showAlert('No members to download for the current filters.', 'error');
      return;
    }
    const eventId = selectedEventId();
    const header = [
      'Name',
      'Email',
      'Membership expires',
      'Expiring soon',
      'Hub account',
      'Invite sent',
    ];
    if (eventId && lastReports && lastReports.bookedForEvent) header.push('Booked for event');
    const lines = [header.map(csvCell).join(',')];
    rows.forEach(function (m) {
      const row = [
        m.name || '',
        m.email,
        m.expiresAt || '',
        m.expiringSoon ? 'Yes' : '',
        isClaimed(m) ? 'Signed up' : 'Not yet',
        m.inviteSentAt ? 'Yes' : 'No',
      ];
      if (eventId && lastReports && lastReports.bookedForEvent) {
        row.push(isBookedForSelectedEvent(m) ? 'Yes' : 'No');
      }
      lines.push(row.map(csvCell).join(','));
    });
    downloadCsvFile('member-list.csv', lines);
  }

  function downloadReportCsv() {
    const eventId = selectedEventId();
    if (!eventId || !lastReports) {
      showAlert('Choose an event first, then download its report.', 'error');
      return;
    }
    const ev = events.find(function (e) {
      return String(e.id) === String(eventId);
    });
    const eventLabel = ev ? ev.title || 'Event' : 'Event';
    const r = lastReports;
    const lines = [];

    lines.push(csvCell('Member report — ' + eventLabel));
    lines.push('');

    const h = r.rosterHealth || {};
    lines.push(csvCell('Membership health'));
    lines.push(['Active members', 'Signed up', 'Not signed up', 'Expiring soon'].map(csvCell).join(','));
    lines.push([h.totalActive || 0, h.claimed || 0, h.unclaimed || 0, h.expiringSoon || 0].map(csvCell).join(','));
    lines.push('');

    if (r.bookedForEvent) {
      const b = r.bookedForEvent;
      lines.push(
        csvCell(
          'Bookings for this event (' + b.bookedCount + ' booked, ' + b.notBookedCount + ' not booked)'
        )
      );
      lines.push(['Status', 'Name', 'Email'].map(csvCell).join(','));
      (b.booked || []).forEach(function (m) {
        lines.push(['Booked', m.name || '', m.email].map(csvCell).join(','));
      });
      (b.notBooked || []).forEach(function (m) {
        lines.push(['Not booked', m.name || '', m.email].map(csvCell).join(','));
      });
      lines.push('');
    }

    if (r.eventAttendance) {
      const a = r.eventAttendance;
      lines.push(csvCell('New vs returning at this event'));
      lines.push(['New to your group', 'Returning', 'Total registrations'].map(csvCell).join(','));
      lines.push([a.newCount, a.returningCount, a.totalRegistrations].map(csvCell).join(','));
      lines.push('');
    }

    if (r.missedRecentMeetings && (r.missedRecentMeetings.members || []).length) {
      lines.push(csvCell('Members who missed recent meetings'));
      lines.push(['Name', 'Email', 'Missed', 'Meetings checked'].map(csvCell).join(','));
      r.missedRecentMeetings.members.forEach(function (m) {
        lines.push([m.name || '', m.email, m.missedCount, m.recentEventsChecked].map(csvCell).join(','));
      });
      lines.push('');
    }

    const expiry = (r.membershipExpiry && r.membershipExpiry.within14Days) || [];
    if (expiry.length) {
      lines.push(csvCell('Memberships expiring within 14 days'));
      lines.push(['Name', 'Email', 'Expires', 'Days left'].map(csvCell).join(','));
      expiry.forEach(function (m) {
        lines.push([m.name || '', m.email, m.expiresAt || '', m.daysUntilExpiry].map(csvCell).join(','));
      });
    }

    downloadCsvFile('member-report-' + String(eventId).slice(0, 8) + '.csv', lines);
  }

  function renderPagination(total) {
    const nav = document.getElementById('omr-pagination');
    if (!nav) return;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > totalPages) page = totalPages;
    if (total <= PAGE_SIZE) {
      nav.hidden = true;
      nav.innerHTML = '';
      return;
    }
    nav.hidden = false;
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, total);
    nav.innerHTML =
      '<p class="omr-pagination-meta">Showing ' +
      start +
      '–' +
      end +
      ' of ' +
      total +
      '</p>' +
      '<div class="omr-pagination-btns">' +
      '<button type="button" class="ee-btn ee-btn-outline omr-btn-sm" data-omr-page="prev"' +
      (page <= 1 ? ' disabled' : '') +
      '>Previous</button>' +
      '<span class="omr-pagination-page">Page ' +
      page +
      ' of ' +
      totalPages +
      '</span>' +
      '<button type="button" class="ee-btn ee-btn-outline omr-btn-sm" data-omr-page="next"' +
      (page >= totalPages ? ' disabled' : '') +
      '>Next</button>' +
      '</div>';
    nav.querySelectorAll('[data-omr-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.dataset.omrPage === 'prev' && page > 1) page -= 1;
        if (btn.dataset.omrPage === 'next' && page < totalPages) page += 1;
        renderRoster();
      });
    });
  }

  function renderRoster() {
    const body = document.getElementById('omr-body');
    const empty = document.getElementById('omr-empty');
    const count = document.getElementById('omr-count');
    const bookedTh = document.getElementById('omr-booked-th');
    if (!body) return;
    body.innerHTML = '';

    const totalActive = members.filter(function (m) {
      return m.status === 'active';
    }).length;
    syncAddPanel(totalActive);
    syncBulkResend(totalActive);

    const showBooked = Boolean(selectedEventId() && lastReports && lastReports.bookedForEvent);
    if (bookedTh) bookedTh.hidden = !showBooked;

    const rows = filteredMembers();
    if (count) {
      count.hidden = totalActive === 0;
      count.textContent =
        rows.length === totalActive
          ? totalActive + (totalActive === 1 ? ' member' : ' members')
          : rows.length + ' of ' + totalActive + ' members';
    }

    if (!rows.length) {
      if (empty) empty.hidden = false;
      renderPagination(0);
      return;
    }
    if (empty) empty.hidden = true;

    renderPagination(rows.length);
    const start = (page - 1) * PAGE_SIZE;
    const pageRows = rows.slice(start, start + PAGE_SIZE);

    pageRows.forEach(function (m) {
      const tr = document.createElement('tr');
      const hub = isClaimed(m)
        ? '<span class="omr-badge-claimed">Signed up</span>'
        : '<span class="omr-badge-pending">Not yet</span>';
      const invite = isClaimed(m)
        ? '—'
        : m.inviteSentAt
          ? '<span class="omr-badge-claimed">Sent</span>'
          : '<span class="omr-badge-pending">Not sent</span>';
      const exp = m.expiresAt
        ? m.expiringSoon
          ? '<span class="omr-badge-expiring">' + esc(m.expiresAt) + '</span>'
          : esc(m.expiresAt)
        : '—';
      const bookedCell = showBooked
        ? '<td>' +
          (isBookedForSelectedEvent(m)
            ? '<span class="omr-badge-claimed">Booked</span>'
            : '<span class="omr-badge-pending">Not booked</span>') +
          '</td>'
        : '';
      tr.innerHTML =
        '<td class="omr-name-cell" data-id="' +
        esc(m.id) +
        '"><span class="omr-member-name">' +
        esc(m.name || '—') +
        '</span></td><td>' +
        esc(m.email) +
        '</td><td class="omr-expires-cell" data-id="' +
        esc(m.id) +
        '">' +
        exp +
        '</td><td>' +
        hub +
        '</td><td>' +
        invite +
        '</td>' +
        bookedCell +
        '<td class="omr-actions">' +
        '<button type="button" class="ee-btn ee-btn-outline omr-btn-sm omr-edit-name" data-id="' +
        esc(m.id) +
        '" data-email="' +
        esc(m.email) +
        '" data-name="' +
        esc(m.name || '') +
        '">Edit name</button> ' +
        '<button type="button" class="ee-btn ee-btn-outline omr-btn-sm omr-edit-expiry" data-id="' +
        esc(m.id) +
        '" data-email="' +
        esc(m.email) +
        '" data-expires="' +
        esc(m.expiresAt || '') +
        '">Edit expiry</button> ' +
        (!isClaimed(m)
          ? '<button type="button" class="ee-btn ee-btn-outline omr-btn-sm omr-resend" data-id="' +
            esc(m.id) +
            '" data-email="' +
            esc(m.email) +
            '">Resend invite</button> '
          : '') +
        '<button type="button" class="ee-btn ee-btn-outline omr-btn-sm omr-remove" data-id="' +
        esc(m.id) +
        '">Remove</button></td>';
      body.appendChild(tr);
    });

    body.querySelectorAll('.omr-remove').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('Remove this member from the list?')) return;
        try {
          await api(rosterUrl('&id=' + encodeURIComponent(btn.dataset.id)), { method: 'DELETE' });
          await refresh();
        } catch (e) {
          showAlert(e.message, 'error');
        }
      });
    });
    body.querySelectorAll('.omr-resend').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        btn.disabled = true;
        try {
          await api(rosterUrl(), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organiserId: organiserId,
              id: btn.dataset.id,
              email: btn.dataset.email,
              resendInvite: true,
            }),
          });
          showAlert('Invite resent.', 'success');
          await refresh();
        } catch (e) {
          showAlert(e.message, 'error');
        } finally {
          btn.disabled = false;
        }
      });
    });
    body.querySelectorAll('.omr-edit-expiry').forEach(function (btn) {
      btn.addEventListener('click', function () {
        startExpiryEdit(btn.dataset.id, btn.dataset.email, btn.dataset.expires);
      });
    });
    body.querySelectorAll('.omr-edit-name').forEach(function (btn) {
      btn.addEventListener('click', function () {
        startNameEdit(btn.dataset.id, btn.dataset.email, btn.dataset.name);
      });
    });
  }

  function startNameEdit(memberId, email, currentName) {
    const cell = document.querySelector('.omr-name-cell[data-id="' + memberId + '"]');
    if (!cell || cell.querySelector('input')) return;
    cell.innerHTML =
      '<span class="omr-expiry-edit">' +
      '<input type="text" value="' +
      esc(currentName || '') +
      '" aria-label="Member name" />' +
      '<button type="button" class="ee-btn ee-btn-gold omr-btn-sm omr-name-save">Save</button>' +
      '<button type="button" class="ee-btn ee-btn-outline omr-btn-sm omr-name-cancel">Cancel</button>' +
      '</span>';
    cell.querySelector('.omr-name-cancel').addEventListener('click', function () {
      renderRoster();
    });
    cell.querySelector('.omr-name-save').addEventListener('click', async function () {
      const value = cell.querySelector('input').value.trim();
      try {
        await api(rosterUrl(), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organiserId: organiserId,
            id: memberId,
            email: email,
            name: value,
          }),
        });
        showAlert('Name updated.', 'success');
        await refresh();
      } catch (e) {
        showAlert(e.message, 'error');
      }
    });
  }

  function startExpiryEdit(memberId, email, currentExpiry) {
    const cell = document.querySelector('.omr-expires-cell[data-id="' + memberId + '"]');
    if (!cell || cell.querySelector('input')) return;
    cell.innerHTML =
      '<span class="omr-expiry-edit">' +
      '<input type="date" value="' +
      esc(currentExpiry || '') +
      '" aria-label="Membership expiry date" />' +
      '<button type="button" class="ee-btn ee-btn-gold omr-btn-sm omr-expiry-save">Save</button>' +
      '<button type="button" class="ee-btn ee-btn-outline omr-btn-sm omr-expiry-cancel">Cancel</button>' +
      '</span>';
    cell.querySelector('.omr-expiry-cancel').addEventListener('click', function () {
      renderRoster();
    });
    cell.querySelector('.omr-expiry-save').addEventListener('click', async function () {
      const value = cell.querySelector('input').value;
      try {
        await api(rosterUrl(), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organiserId: organiserId,
            id: memberId,
            email: email,
            expiresAt: value,
          }),
        });
        showAlert('Expiry date updated.', 'success');
        await refresh();
      } catch (e) {
        showAlert(e.message, 'error');
      }
    });
  }

  async function bulkResendInvites() {
    const unclaimed = members.filter(function (m) {
      return m.status === 'active' && !isClaimed(m);
    });
    if (!unclaimed.length) {
      showAlert('Everyone on the list already has a Hub account.', 'success');
      return;
    }
    if (
      !confirm(
        'Resend invite emails to ' +
          unclaimed.length +
          ' member' +
          (unclaimed.length === 1 ? '' : 's') +
          ' who have not signed up yet?'
      )
    ) {
      return;
    }
    const btn = document.getElementById('omr-bulk-resend');
    if (btn) btn.disabled = true;
    let sent = 0;
    let failed = 0;
    for (const m of unclaimed) {
      try {
        await api(rosterUrl(), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organiserId: organiserId,
            id: m.id,
            email: m.email,
            resendInvite: true,
          }),
        });
        sent += 1;
      } catch {
        failed += 1;
      }
    }
    if (btn) btn.disabled = false;
    showAlert(
      'Resent ' + sent + ' invite' + (sent === 1 ? '' : 's') + (failed ? ' · ' + failed + ' failed' : '') + '.',
      failed && !sent ? 'error' : 'success'
    );
    await refresh();
  }

  async function refresh() {
    const hint = document.getElementById('omr-load-hint');
    if (hint) hint.hidden = false;
    const data = await api(rosterUrl());
    members = data.members || [];
    const eventId = selectedEventId();
    await loadReports(eventId);
    renderRoster();
    if (hint) hint.hidden = true;
  }

  async function init() {
    if (!organiserId) {
      location.href = '/organiser/#groups';
      return;
    }

    const back = document.getElementById('omr-back');
    if (back) {
      back.addEventListener('click', function (e) {
        let cameFromWorkspace = false;
        try {
          const ref = document.referrer ? new URL(document.referrer) : null;
          cameFromWorkspace =
            !!ref &&
            ref.origin === location.origin &&
            /^\/organiser(\/|$)/.test(ref.pathname) &&
            !/member-roster/.test(ref.pathname);
        } catch {
          /* fall through */
        }
        if (cameFromWorkspace && window.history.length > 1) {
          e.preventDefault();
          window.history.back();
        }
      });
    }

    document.getElementById('omr-search')?.addEventListener('input', function (e) {
      filters.search = e.target.value || '';
      page = 1;
      renderRoster();
    });
    document.getElementById('omr-status-filter')?.addEventListener('change', function (e) {
      filters.status = e.target.value || 'all';
      if (
        (filters.status === 'booked' || filters.status === 'not_booked') &&
        !selectedEventId()
      ) {
        showAlert('Choose an event first to filter by booking status.', 'error');
        filters.status = 'all';
        e.target.value = 'all';
      }
      page = 1;
      renderRoster();
    });
    document.getElementById('omr-download-members')?.addEventListener('click', downloadMembersCsv);
    document.getElementById('omr-download-report')?.addEventListener('click', downloadReportCsv);
    document.getElementById('omr-remind-not-booked')?.addEventListener('click', async function () {
      const eventId = selectedEventId();
      if (!eventId || !lastReports || !lastReports.bookedForEvent) {
        showAlert('Choose an event first.', 'error');
        return;
      }
      const count = lastReports.bookedForEvent.notBookedCount || 0;
      if (count < 1) {
        showAlert('Everyone on your membership has booked for this event.', 'success');
        return;
      }
      if (
        !confirm(
          'Email ' +
            count +
            ' member' +
            (count === 1 ? '' : 's') +
            ' who have not booked yet?'
        )
      ) {
        return;
      }
      const btn = document.getElementById('omr-remind-not-booked');
      if (btn) btn.disabled = true;
      try {
        const data = await api(rosterUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organiserId: organiserId,
            action: 'remind-not-booked',
            eventId: eventId,
          }),
        });
        const failed = (data.errors || []).length;
        showAlert(
          'Sent ' +
            (data.sent || 0) +
            ' reminder' +
            ((data.sent || 0) === 1 ? '' : 's') +
            (failed ? ' · ' + failed + ' failed' : '') +
            '.',
          failed && !data.sent ? 'error' : 'success'
        );
      } catch (err) {
        showAlert(err.message, 'error');
      } finally {
        if (btn) {
          btn.disabled = !selectedEventId();
        }
      }
    });
    document.getElementById('omr-download-template')?.addEventListener('click', downloadTemplateCsv);
    document.getElementById('omr-bulk-resend')?.addEventListener('click', bulkResendInvites);

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
            sendInvite: document.getElementById('omr-send-invite')?.checked !== false,
          }),
        });
        document.getElementById('omr-add-form')?.reset();
        showAlert('Member added.', 'success');
        await refresh();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    });

    const csvEl = document.getElementById('omr-csv');
    const fileInput = document.getElementById('omr-file');
    const dropzone = document.getElementById('omr-dropzone');
    const fileNameEl = document.getElementById('omr-file-name');

    function setLoadedFileName(name) {
      if (!fileNameEl) return;
      if (name) {
        fileNameEl.hidden = false;
        fileNameEl.textContent = 'Ready to import: ' + name;
      } else {
        fileNameEl.hidden = true;
        fileNameEl.textContent = '';
      }
    }

    function loadCsvText(text, sourceName) {
      if (csvEl) csvEl.value = text;
      setLoadedFileName(sourceName || '');
      const paste = document.querySelector('.omr-paste-details');
      if (paste && text) paste.open = false;
    }

    function readMemberFile(file) {
      if (!file) return;
      const name = String(file.name || '').toLowerCase();
      const okType =
        name.endsWith('.csv') ||
        name.endsWith('.tsv') ||
        name.endsWith('.txt') ||
        /csv|tab-separated|plain/i.test(file.type || '');
      if (!okType) {
        showAlert('Please upload a CSV file (export from Excel or Google Sheets as CSV).', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = function () {
        let text = String(reader.result || '');
        if (name.endsWith('.tsv')) {
          text = text
            .split(/\r?\n/)
            .map(function (line) {
              return line.split('\t').join(',');
            })
            .join('\n');
        }
        loadCsvText(text, file.name);
        showAlert('File loaded. Click Import members to add them.', 'success');
      };
      reader.onerror = function () {
        showAlert('Could not read that file.', 'error');
      };
      reader.readAsText(file);
    }

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', function () {
        fileInput.click();
      });
      dropzone.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fileInput.click();
        }
      });
      fileInput.addEventListener('change', function () {
        const file = fileInput.files && fileInput.files[0];
        readMemberFile(file);
        fileInput.value = '';
      });
      ['dragenter', 'dragover'].forEach(function (evt) {
        dropzone.addEventListener(evt, function (e) {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('is-dragover');
        });
      });
      ['dragleave', 'drop'].forEach(function (evt) {
        dropzone.addEventListener(evt, function (e) {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('is-dragover');
        });
      });
      dropzone.addEventListener('drop', function (e) {
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        readMemberFile(file);
      });
    }

    document.getElementById('omr-import-btn')?.addEventListener('click', async function () {
      const csv = csvEl?.value || '';
      if (!csv.trim()) {
        showAlert('Upload a CSV spreadsheet or paste CSV text first.', 'error');
        return;
      }
      try {
        const data = await api(rosterUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organiserId: organiserId,
            csv: csv,
            sendInvites: document.getElementById('omr-csv-send-invites')?.checked === true,
          }),
        });
        const inviteNote =
          data.invitesSent > 0 ? ' · ' + data.invitesSent + ' invites sent' : '';
        let msg = 'Imported ' + data.ok + ' of ' + data.total + ' rows' + inviteNote + '.';
        if (data.fail > 0 && data.errors && data.errors.length) {
          msg +=
            ' ' +
            data.fail +
            ' failed: ' +
            data.errors
              .slice(0, 3)
              .map(function (err) {
                return (err.email || 'row') + ' (' + (err.message || 'error') + ')';
              })
              .join('; ');
        }
        showAlert(msg, data.fail && !data.ok ? 'error' : 'success');
        if (csvEl) csvEl.value = '';
        setLoadedFileName('');
        await refresh();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    });

    try {
      const group = await api('/api/organiser/groups?id=' + encodeURIComponent(organiserId));
      const title = document.getElementById('omr-title');
      if (title && group.group?.name) {
        title.textContent = 'Membership — ' + group.group.name;
      }
    } catch {
      /* ignore */
    }

    await loadEvents();
    await refresh();
  }

  init().catch(function (e) {
    showAlert(e.message || 'Could not load membership', 'error');
  });
})();
