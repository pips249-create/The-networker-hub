(function () {
  const params = new URLSearchParams(location.search);
  const isDashboardEmbed = Boolean(document.getElementById('org-page-memberships'));
  const isStandalonePage = Boolean(document.querySelector('.omr-page')) && !isDashboardEmbed;
  let organiserId = String(params.get('id') || params.get('organiserId') || '').trim();
  const PAGE_SIZE = 25;
  let members = [];
  let rosterTotal = 0;
  let rosterActiveTotal = 0;
  let events = [];
  let lastReports = null;
  let page = 1;
  let controlsBound = false;
  let searchTimer = null;
  let activeLoadPromise = null;
  let activeLoadGroupId = '';
  const filters = { search: '', status: 'all' };

  function isLoadInFlight() {
    return Boolean(activeLoadPromise);
  }

  function getActiveGroupId() {
    return String(activeLoadGroupId || organiserId || '').trim();
  }

  function clearStuckLoading() {
    if (rosterAppearsPainted() || !isLoadInFlight()) setRosterLoading(false);
  }

  function setActiveGroupId(groupId) {
    const id = String(groupId || '').trim();
    if (!id) return;
    organiserId = id;
    syncGroupSelect();
  }

  function getOrganiserId() {
    return String(organiserId || '').trim();
  }

  function syncGroupSelect() {
    if (!isDashboardEmbed) return;
    const sel = document.getElementById('filter-memberships-group');
    if (sel && organiserId) sel.value = organiserId;
  }

  function requireOrganiserId() {
    const id = getOrganiserId();
    if (!id) throw new Error('Choose an organiser page first.');
    return id;
  }

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
    el.classList.toggle('org-alert-error', tone === 'error');
    el.classList.toggle('org-alert-success', tone === 'success');
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

  function rosterListQuery(offset, limit) {
    const params = new URLSearchParams();
    params.set('limit', String(limit != null ? limit : PAGE_SIZE));
    params.set('offset', String(offset != null ? offset : (page - 1) * PAGE_SIZE));
    if (filters.search.trim()) params.set('search', filters.search.trim());
    if (filters.status && filters.status !== 'all') params.set('filter', filters.status);
    const eventId = selectedEventId();
    if (eventId && (filters.status === 'booked' || filters.status === 'not_booked')) {
      params.set('eventId', eventId);
    }
    return '&' + params.toString();
  }

  function rosterUrl(extra) {
    const id = requireOrganiserId();
    return (
      '/api/organiser/roster?organiserId=' +
      encodeURIComponent(id) +
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
    const eventId = selectedEventId();
    if (!eventId) return null;
    return isBookedForEvent(m, eventId);
  }

  function memberBookings(m) {
    return (
      m.bookings || {
        total: 0,
        upcoming: [],
        recent: [],
        all: [],
        latest: null,
      }
    );
  }

  function isBookedForEvent(m, eventId) {
    if (!eventId) return null;
    const bookings = memberBookings(m);
    if (bookings.all && bookings.all.length) {
      return bookings.all.some(function (b) {
        return String(b.eventId) === String(eventId);
      });
    }
    if (lastReports && lastReports.bookedForEvent) {
      return bookedEmailSet().has(String(m.email || '').toLowerCase());
    }
    return false;
  }

  function formatShortEventDate(startsAt) {
    if (!startsAt) return '';
    try {
      return new Date(startsAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  }

  function bookingChipTitle(title) {
    const label = String(title || 'Event');
    return label.slice(0, 26) + (label.length > 26 ? '…' : '');
  }

  function rosterAppearsPainted() {
    const body = document.getElementById('omr-body');
    const empty = document.getElementById('omr-empty');
    return Boolean(body && (body.children.length > 0 || (empty && !empty.hidden)));
  }

  function setRosterLoading(on) {
    const hint = document.getElementById('omr-load-hint');
    const wrap = document.getElementById('omr-table-wrap');
    if (hint) {
      hint.hidden = !on;
      hint.setAttribute('aria-busy', on ? 'true' : 'false');
    }
    if (wrap) wrap.classList.toggle('is-roster-loading', on);
  }

  async function ensureRosterPainted(groupId) {
    if (getOrganiserId() !== groupId) return;
    if (rosterAppearsPainted()) return;
    await fetchRosterPage(page || 1, { showLoader: false });
    if (getOrganiserId() === groupId && !rosterAppearsPainted()) renderRoster();
  }

  function renderBookingsCell(m) {
    const bookings = memberBookings(m);
    const eventId = selectedEventId();

    if (eventId) {
      const booked = isBookedForEvent(m, eventId);
      const ev = events.find(function (e) {
        return String(e.id) === String(eventId);
      });
      const evTitle = ev ? ev.title || 'Event' : 'This event';
      const highlight = booked
        ? '<span class="omr-booking-pill omr-booking-pill-yes" title="' +
          esc(evTitle) +
          '">Booked for this event</span>'
        : '<span class="omr-booking-pill omr-booking-pill-no">Not booked for this event</span>';
      const others = (bookings.upcoming || []).filter(function (b) {
        return String(b.eventId) !== String(eventId);
      });
      let extra = '';
      if (others.length) {
        extra = others
          .slice(0, 2)
          .map(function (b) {
            const date = formatShortEventDate(b.startsAt);
            return (
              '<span class="omr-booking-chip omr-booking-chip-upcoming" title="' +
              esc((b.title || 'Event') + (date ? ' · ' + date : '')) +
              '">' +
              esc(bookingChipTitle(b.title)) +
              '</span>'
            );
          })
          .join('');
        if (others.length > 2) {
          extra += '<span class="omr-booking-more">+' + (others.length - 2) + ' more</span>';
        }
      }
      return (
        '<div class="omr-bookings-cell">' +
        highlight +
        (extra ? '<div class="omr-booking-chips">' + extra + '</div>' : '') +
        '</div>'
      );
    }

    if (!bookings.total) {
      return '<span class="omr-badge-pending">None yet</span>';
    }

    const upcoming = bookings.upcoming || [];
    const chips = upcoming
      .slice(0, 2)
      .map(function (b) {
        const date = formatShortEventDate(b.startsAt);
        return (
          '<span class="omr-booking-chip omr-booking-chip-upcoming" title="' +
          esc((b.title || 'Event') + (date ? ' · ' + date : '')) +
          '">' +
          esc(bookingChipTitle(b.title)) +
          '</span>'
        );
      })
      .join('');
    const pastCount = (bookings.recent || []).length;
    let more = '';
    if (upcoming.length > 2) {
      more = '<span class="omr-booking-more">+' + (upcoming.length - 2) + ' upcoming</span>';
    } else if (!upcoming.length && pastCount) {
      more = '<span class="omr-booking-more">' + pastCount + ' past</span>';
    }
    const summary =
      '<span class="omr-booking-summary">' +
      bookings.total +
      (bookings.total === 1 ? ' event' : ' events') +
      '</span>';
    return (
      '<div class="omr-bookings-cell">' +
      summary +
      (chips || more
        ? '<div class="omr-booking-chips">' + chips + more + '</div>'
        : '') +
      '</div>'
    );
  }

  function memberActionsHtml(m) {
    const items = [
      '<button type="button" class="org-action-item omr-action-edit-name" data-id="' +
        esc(m.id) +
        '" data-email="' +
        esc(m.email) +
        '" data-name="' +
        esc(m.name || '') +
        '"><span class="org-action-icon">✎</span><span class="org-action-text"><strong>Edit name</strong><span>Update display name</span></span></button>',
      '<button type="button" class="org-action-item omr-action-edit-expiry" data-id="' +
        esc(m.id) +
        '" data-email="' +
        esc(m.email) +
        '" data-expires="' +
        esc(m.expiresAt || '') +
        '"><span class="org-action-icon">📅</span><span class="org-action-text"><strong>Edit expiry</strong><span>Change membership end date</span></span></button>',
    ];
    if (!isClaimed(m)) {
      items.push(
        '<button type="button" class="org-action-item omr-action-resend" data-id="' +
          esc(m.id) +
          '" data-email="' +
          esc(m.email) +
          '"><span class="org-action-icon">✉</span><span class="org-action-text"><strong>Resend invite</strong><span>Send Hub sign-up email again</span></span></button>'
      );
    }
    items.push(
      '<button type="button" class="org-action-item danger omr-action-remove" data-id="' +
        esc(m.id) +
        '"><span class="org-action-icon">✕</span><span class="org-action-text"><strong>Remove</strong><span>Remove from membership list</span></span></button>'
    );
    const label = String(m.name || m.email || 'Member').slice(0, 36);
    return (
      '<div class="org-action-wrap">' +
      '<button type="button" class="org-action-btn" data-org-action-toggle aria-expanded="false">Actions <span class="chev">▾</span></button>' +
      '<div class="org-action-menu" role="menu">' +
      '<div class="org-action-menu-header">' +
      esc(label) +
      '</div>' +
      items.join('') +
      '</div></div>'
    );
  }

  function closeAllActionMenus() {
    document.querySelectorAll('.org-action-menu.is-open').forEach(function (menu) {
      menu.classList.remove('is-open', 'is-floating');
      menu.style.top = '';
      menu.style.left = '';
      menu.style.right = '';
      menu.style.bottom = '';
      menu.style.visibility = '';
      menu.style.display = '';
      if (menu._actionWrap) {
        menu._actionWrap.appendChild(menu);
        menu._actionWrap = null;
      }
    });
    document.querySelectorAll('[data-org-action-toggle][aria-expanded="true"]').forEach(function (btn) {
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  function getActionMenuPortal() {
    return (
      document.getElementById('org-action-menu-portal') ||
      document.getElementById('omr-action-menu-portal') ||
      document.body
    );
  }

  function openActionMenu(menu, toggle) {
    const wrap = toggle.closest('.org-action-wrap');
    const portal = getActionMenuPortal();
    if (wrap && menu.parentElement !== portal) {
      menu._actionWrap = wrap;
      portal.appendChild(menu);
    }
    menu.classList.add('is-open', 'is-floating');
    toggle.setAttribute('aria-expanded', 'true');
    menu.style.visibility = 'hidden';
    menu.style.display = 'block';
    const rect = toggle.getBoundingClientRect();
    const menuW = menu.offsetWidth || 240;
    const menuH = menu.offsetHeight || 200;
    let top = rect.bottom + 6;
    let left = rect.right - menuW;
    if (top + menuH > window.innerHeight - 12) {
      top = Math.max(12, rect.top - menuH - 6);
    }
    if (left < 12) left = 12;
    if (left + menuW > window.innerWidth - 12) {
      left = window.innerWidth - menuW - 12;
    }
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
    menu.style.right = 'auto';
    menu.style.bottom = 'auto';
    menu.style.visibility = '';
  }

  function isClaimed(m) {
    return Boolean(m.claimedAt || m.attendeeId);
  }

  function syncAddPanel(totalActive) {
    const details = document.getElementById('omr-add-details');
    if (!document.getElementById('omr-add-panel') && !details) return;
    if (details) {
      if (totalActive === 0) details.open = true;
      else if (!details.dataset.omrUserOpened) details.open = false;
    }
  }

  function jumpToAddSection(targetId) {
    const section = document.getElementById('omr-add-section');
    const addDetails = document.getElementById('omr-add-details');
    const importDetails = document.getElementById('omr-import-card');
    if (targetId === 'omr-import-card' && importDetails) {
      if (addDetails) addDetails.open = false;
      importDetails.open = true;
      importDetails.dataset.omrUserOpened = '1';
    }
    if ((targetId === 'omr-add-card' || targetId === 'omr-add-details') && addDetails) {
      if (importDetails) importDetails.open = false;
      addDetails.open = true;
      addDetails.dataset.omrUserOpened = '1';
    }
    const target =
      document.getElementById(targetId) ||
      (targetId === 'omr-add-card' ? addDetails : null);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (target) {
      window.setTimeout(function () {
        target.classList.add('omr-highlight-flash');
        const focusEl = target.querySelector('input, textarea, button');
        if (focusEl && typeof focusEl.focus === 'function') focusEl.focus({ preventScroll: true });
        window.setTimeout(function () {
          target.classList.remove('omr-highlight-flash');
        }, 1400);
      }, 280);
    }
  }

  function syncBulkResend(totalActive) {
    const btn = document.getElementById('omr-bulk-resend');
    if (!btn) return;
    const unclaimed =
      lastReports && lastReports.rosterHealth
        ? Number(lastReports.rosterHealth.unclaimed) || 0
        : 0;
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
          return String(ev.organiserGroupId || ev.organiserId || '') === getOrganiserId();
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

      if (!sel.value && events.length) {
        const firstUpcoming = events.find(function (ev) {
          const start = ev.startsAt || ev.starts_at || ev.date || '';
          return start && new Date(start).getTime() >= now;
        });
        sel.value = (firstUpcoming || events[0]).id;
      }

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

      if (sel.dataset.omrBound !== '1') {
        sel.dataset.omrBound = '1';
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
          fetchRosterPage(1).then(function () {
            return loadReports(sel.value);
          }).then(function () {
            renderRoster();
          });
        });
      }
    } catch {
      /* optional */
    }
  }

  function renderReports(reports) {
    const mount = document.getElementById('omr-reports');
    const wrap = document.getElementById('omr-reports-wrap');
    if (!mount || !reports) {
      if (wrap) wrap.hidden = true;
      return;
    }
    const h = reports.rosterHealth || {};
    const booked = reports.bookedForEvent;
    const attendance = reports.eventAttendance;
    const missed = reports.missedRecentMeetings;
    const expiry = reports.membershipExpiry || {};

    let html =
      '<p class="omr-reports-intro">Based on people you have added to this member list — not all event attendees. Download CSV or email reminders below; members are also notified by email when you publish events.</p>' +
      '<div class="omr-report-card"><h3>Your member list</h3>' +
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
        '<div class="omr-report-card"><h3>Your members — booked for selected event</h3>' +
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
        '<div class="omr-report-card"><h3>Your members at this event</h3>' +
        '<p>' +
        esc(attendance.newCount) +
        ' new to your group · ' +
        esc(attendance.returningCount) +
        ' returning</p>' +
        '<p class="omr-report-note">Only people on your uploaded member list who booked this event.</p></div>';
    }

    if (missed && missed.members && missed.members.length) {
      html += '<div class="omr-report-card"><h3>Your members — missed recent meetings</h3><ul>';
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
      html += '<div class="omr-report-card"><h3>Your members — expiring within 14 days</h3><ul>';
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
    if (wrap) wrap.hidden = false;
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
      if (filters.status === 'has_bookings' && !memberBookings(m).total) return false;
      if (filters.status === 'no_bookings' && memberBookings(m).total) return false;
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

  async function downloadMembersCsv() {
    let rows = [];
    try {
      const data = await api(rosterUrl(rosterListQuery(0, 10000)));
      rows = data.members || [];
    } catch (err) {
      showAlert(err.message, 'error');
      return;
    }
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
      'Event bookings',
    ];
    if (eventId) header.push('Booked for selected event');
    const lines = [header.map(csvCell).join(',')];
    rows.forEach(function (m) {
      const b = memberBookings(m);
      const bookingLabels = (b.all || [])
        .map(function (x) {
          return x.title || 'Event';
        })
        .join('; ');
      const row = [
        m.name || '',
        m.email,
        m.expiresAt || '',
        m.expiringSoon ? 'Yes' : '',
        isClaimed(m) ? 'Signed up' : 'Not yet',
        m.inviteSentAt ? 'Yes' : 'No',
        bookingLabels || 'None',
      ];
      if (eventId) {
        row.push(isBookedForEvent(m, eventId) ? 'Yes' : 'No');
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
      lines.push(csvCell('Your members at this event (member list only)'));
      lines.push(['New to your group', 'Returning', 'Member bookings'].map(csvCell).join(','));
      lines.push([a.newCount, a.returningCount, a.totalMemberBookings || a.newCount + a.returningCount].map(csvCell).join(','));
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
        if (btn.dataset.omrPage === 'prev' && page > 1) {
          fetchRosterPage(page - 1);
        }
        if (btn.dataset.omrPage === 'next') {
          const totalPages = Math.max(1, Math.ceil(rosterTotal / PAGE_SIZE));
          if (page < totalPages) fetchRosterPage(page + 1);
        }
      });
    });
  }

  function renderRoster() {
    const body = document.getElementById('omr-body');
    const empty = document.getElementById('omr-empty');
    const count = document.getElementById('omr-count');
    if (!body) return;
    try {
      closeAllActionMenus();
      body.innerHTML = '';

      const totalActive = rosterActiveTotal;
      syncAddPanel(totalActive);
      syncBulkResend(totalActive);

      const rows = members;
      if (count) {
        count.hidden = totalActive === 0 && rosterTotal === 0;
        count.textContent =
          rosterTotal === totalActive
            ? totalActive + (totalActive === 1 ? ' member on this register' : ' members on this register')
            : rosterTotal + ' of ' + totalActive + ' members shown';
      }

      if (!rows.length) {
        if (empty) {
          empty.hidden = false;
          const title = empty.querySelector('.org-empty-state-title');
          const text = empty.querySelector('.org-empty-state-text');
          if (totalActive > 0 && title && text) {
            title.textContent = 'No members match these filters';
            text.textContent = 'Try a different search or filter, or clear the event filter.';
          } else if (title && text) {
            title.textContent = 'No members yet';
            text.textContent =
              'Add someone above or import a spreadsheet to start your membership register.';
          }
        }
        renderPagination(rosterTotal);
        return;
      }
      if (empty) empty.hidden = true;

      renderPagination(rosterTotal);

      rows.forEach(function (m) {
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
          '</td><td class="omr-bookings-col">' +
          renderBookingsCell(m) +
          '</td><td class="org-td-actions omr-actions">' +
          memberActionsHtml(m) +
          '</td>';
        body.appendChild(tr);
      });
    } catch (err) {
      if (empty) {
        empty.hidden = false;
        const title = empty.querySelector('.org-empty-state-title');
        const text = empty.querySelector('.org-empty-state-text');
        if (title) title.textContent = 'Could not show members';
        if (text) text.textContent = err.message || 'Something went wrong loading the register.';
      }
      showAlert(err.message || 'Could not show members on the register.', 'error');
    }
  }

  function bindMemberActionHandlers() {
    if (document.documentElement.dataset.omrActionBound === '1') return;
    document.documentElement.dataset.omrActionBound = '1';

    document.addEventListener('click', function (e) {
      const toggle = e.target.closest('[data-org-action-toggle]');
      if (toggle && toggle.closest('#omr-body')) {
        e.preventDefault();
        e.stopPropagation();
        const wrap = toggle.closest('.org-action-wrap');
        const menu = wrap && wrap.querySelector('.org-action-menu');
        if (!menu) return;
        const wasOpen = menu.classList.contains('is-open');
        closeAllActionMenus();
        if (!wasOpen) openActionMenu(menu, toggle);
        return;
      }

      if (
        !e.target.closest('.org-action-menu') &&
        !e.target.closest('[data-org-action-toggle]')
      ) {
        closeAllActionMenus();
      }

      const removeBtn = e.target.closest('.omr-action-remove');
      if (removeBtn) {
        e.preventDefault();
        e.stopPropagation();
        closeAllActionMenus();
        if (!confirm('Remove this member from the list?')) return;
        (async function () {
          try {
            await api(rosterUrl('&id=' + encodeURIComponent(removeBtn.dataset.id)), {
              method: 'DELETE',
            });
            await refresh();
          } catch (err) {
            showAlert(err.message, 'error');
          }
        })();
        return;
      }

      const resendBtn = e.target.closest('.omr-action-resend');
      if (resendBtn) {
        e.preventDefault();
        e.stopPropagation();
        closeAllActionMenus();
        resendBtn.disabled = true;
        (async function () {
          try {
            await api(rosterUrl(), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                organiserId: getOrganiserId(),
                id: resendBtn.dataset.id,
                email: resendBtn.dataset.email,
                resendInvite: true,
              }),
            });
            showAlert('Invite resent.', 'success');
            await refresh();
          } catch (err) {
            showAlert(err.message, 'error');
          } finally {
            resendBtn.disabled = false;
          }
        })();
        return;
      }

      const editExpiryBtn = e.target.closest('.omr-action-edit-expiry');
      if (editExpiryBtn) {
        e.preventDefault();
        e.stopPropagation();
        closeAllActionMenus();
        startExpiryEdit(editExpiryBtn.dataset.id, editExpiryBtn.dataset.email, editExpiryBtn.dataset.expires);
        return;
      }

      const editNameBtn = e.target.closest('.omr-action-edit-name');
      if (editNameBtn) {
        e.preventDefault();
        e.stopPropagation();
        closeAllActionMenus();
        startNameEdit(editNameBtn.dataset.id, editNameBtn.dataset.email, editNameBtn.dataset.name);
      }
    });

    window.addEventListener('scroll', closeAllActionMenus, true);
    window.addEventListener('resize', closeAllActionMenus);
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
            organiserId: getOrganiserId(),
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
            organiserId: getOrganiserId(),
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
    const unclaimed =
      lastReports && lastReports.rosterHealth
        ? Number(lastReports.rosterHealth.unclaimed) || 0
        : 0;
    if (!unclaimed) {
      showAlert('Everyone on the list already has a Hub account.', 'success');
      return;
    }
    if (
      !confirm(
        'Queue invite emails for ' +
          unclaimed +
          ' member' +
          (unclaimed === 1 ? '' : 's') +
          ' who have not signed up yet? They will send gradually over the next 2 hours.'
      )
    ) {
      return;
    }
    const btn = document.getElementById('omr-bulk-resend');
    if (btn) btn.disabled = true;
    try {
      const data = await api(rosterUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organiserId: getOrganiserId(),
          action: 'queue-invites',
        }),
      });
      showAlert(
        'Queued ' +
          (data.queued || 0) +
          ' invite' +
          ((data.queued || 0) === 1 ? '' : 's') +
          ' — sending over the next 2 hours.',
        (data.queued || 0) ? 'success' : 'error'
      );
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function fetchRosterPage(pageNum, options) {
    const groupId = getOrganiserId();
    if (!groupId) return;
    const showLoader = !options || options.showLoader !== false;
    page = Math.max(Number(pageNum) || 1, 1);
    if (showLoader) setRosterLoading(true);
    const path =
      '/api/organiser/roster?organiserId=' +
      encodeURIComponent(groupId) +
      rosterListQuery((page - 1) * PAGE_SIZE, PAGE_SIZE);
    try {
      const data = await api(path);
      if (getOrganiserId() !== groupId) return;
      members = data.members || [];
      rosterTotal = Number(data.total) || members.length;
      rosterActiveTotal = Number(data.totalActive) || rosterTotal;
    } catch (err) {
      if (getOrganiserId() !== groupId) return;
      showAlert(err.message, 'error');
    } finally {
      if (getOrganiserId() === groupId) {
        if (showLoader) setRosterLoading(false);
        renderRoster();
      }
    }
  }

  async function refresh() {
    const groupId = getOrganiserId();
    if (!groupId) return;
    page = 1;
    await fetchRosterPage(1, { showLoader: false });
    if (getOrganiserId() !== groupId) return;
    setRosterLoading(false);

    const eventId = selectedEventId();
    loadReports(eventId)
      .then(function () {
        if (getOrganiserId() === groupId) renderRoster();
      })
      .catch(function (err) {
        if (getOrganiserId() === groupId) {
          showAlert(err.message || 'Could not load member reports.', 'error');
        }
      });
  }

  function removeDuplicateAddPanels() {
    const panels = document.querySelectorAll('.omr-add-panel');
    for (let i = 1; i < panels.length; i += 1) {
      panels[i].remove();
    }
  }

  function bindControlsOnce() {
    if (controlsBound) return;
    controlsBound = true;

    removeDuplicateAddPanels();
    bindMemberActionHandlers();

    document.getElementById('omr-jump-add')?.addEventListener('click', function () {
      jumpToAddSection('omr-add-details');
    });
    document.getElementById('omr-jump-import')?.addEventListener('click', function () {
      const details = document.getElementById('omr-import-card');
      if (details && details.tagName === 'DETAILS') details.open = true;
      jumpToAddSection('omr-import-card');
    });

    document.getElementById('omr-add-details')?.addEventListener('toggle', function (e) {
      if (e.target.open) e.target.dataset.omrUserOpened = '1';
    });
    document.getElementById('omr-import-card')?.addEventListener('toggle', function (e) {
      if (e.target.open) e.target.dataset.omrUserOpened = '1';
    });

    const back = document.getElementById('omr-back');
    if (back) {
      back.href = '/organiser/#memberships';
      back.addEventListener('click', function (e) {
        let cameFromMemberships = false;
        try {
          const ref = document.referrer ? new URL(document.referrer) : null;
          cameFromMemberships =
            !!ref &&
            ref.origin === location.origin &&
            /^\/organiser(\/|$)/.test(ref.pathname) &&
            (ref.hash === '#memberships' || ref.hash === '#member-lists');
        } catch {
          /* fall through */
        }
        if (cameFromMemberships && window.history.length > 1) {
          e.preventDefault();
          window.history.back();
        }
      });
    }

    document.getElementById('omr-search')?.addEventListener('input', function (e) {
      filters.search = e.target.value || '';
      page = 1;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        fetchRosterPage(1);
      }, 300);
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
      fetchRosterPage(1);
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
          'Queue reminder emails for ' +
            count +
            ' member' +
            (count === 1 ? '' : 's') +
            ' who have not booked yet? They will send gradually over the next 2 hours.'
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
            organiserId: getOrganiserId(),
            action: 'remind-not-booked',
            eventId: eventId,
          }),
        });
        showAlert(
          'Queued ' +
            (data.queued || 0) +
            ' reminder' +
            ((data.queued || 0) === 1 ? '' : 's') +
            ' — sending over the next 2 hours.',
          (data.queued || 0) ? 'success' : 'error'
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
            organiserId: getOrganiserId(),
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
            organiserId: getOrganiserId(),
            csv: csv,
            sendInvites: document.getElementById('omr-csv-send-invites')?.checked === true,
          }),
        });
        const inviteNote =
          data.invitesQueued > 0
            ? ' · ' + data.invitesQueued + ' invites queued (sending over 2 hours)'
            : data.invitesSent > 0
              ? ' · ' + data.invitesSent + ' invites sent'
              : '';
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
  }

  async function loadForGroup(groupId) {
    const id = String(groupId || '').trim();
    bindControlsOnce();
    organiserId = id;
    syncGroupSelect();

    if (!id) {
      members = [];
      rosterTotal = 0;
      rosterActiveTotal = 0;
      events = [];
      lastReports = null;
      page = 1;
      renderRoster();
      const mount = document.getElementById('omr-reports');
      const wrap = document.getElementById('omr-reports-wrap');
      if (mount) mount.innerHTML = '';
      if (wrap) wrap.hidden = true;
      return;
    }

    if (activeLoadGroupId === id && activeLoadPromise) return activeLoadPromise;

    if (activeLoadGroupId !== id) {
      members = [];
      rosterTotal = 0;
      rosterActiveTotal = 0;
      lastReports = null;
      page = 1;
      renderRoster();
    }

    activeLoadGroupId = id;
    setRosterLoading(true);
    activeLoadPromise = (async function () {
      page = 1;

      try {
        const group = await api('/api/organiser/groups?id=' + encodeURIComponent(id));
        if (getOrganiserId() !== id) return;
        const title = document.getElementById('omr-title');
        if (title && group.group && group.group.name) {
          title.textContent = 'Membership — ' + group.group.name;
        }
      } catch {
        /* ignore */
      }

      await loadEvents();
      if (getOrganiserId() !== id) return;
      await refresh();
    })().finally(function () {
      if (activeLoadGroupId === id) {
        setRosterLoading(false);
        if (getOrganiserId() === id && !rosterAppearsPainted()) {
          renderRoster();
        }
        activeLoadPromise = null;
      }
      ensureRosterPainted(id);
    });
    return activeLoadPromise;
  }

  async function initStandalone() {
    if (!organiserId) {
      location.replace('/organiser/#memberships');
      return;
    }
    await loadForGroup(organiserId);
  }

  window.OrganiserMemberRoster = {
    loadForGroup: loadForGroup,
    appearsPainted: rosterAppearsPainted,
    setLoading: setRosterLoading,
    bindControls: bindControlsOnce,
    getActiveGroupId: getActiveGroupId,
    isLoadInFlight: isLoadInFlight,
    clearStuckLoading: clearStuckLoading,
    setActiveGroupId: setActiveGroupId,
  };

  if (isDashboardEmbed) {
    bindControlsOnce();
  }

  if (isStandalonePage) {
    initStandalone().catch(function (e) {
      showAlert(e.message || 'Could not load membership', 'error');
    });
  }
})();
