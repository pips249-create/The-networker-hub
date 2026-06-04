/**
 * Ticket setup for an event series — tiers, One Seat Only Policy, sale windows.
 */
(function () {
  const SERIES_STORAGE_KEY = 'hub_event_series';
  const params = new URLSearchParams(location.search);
  const idsParam = params.get('ids') || '';

  let eventIds = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  let seriesMeta = { title: '', events: [], eventFormat: '' };
  let attendanceMode = 'tickets';

  const SALE_END_OPTIONS = [
    { value: 'at_start', label: 'When the event starts' },
    { value: '12_hours', label: '12 hours before the event' },
    { value: '1_day', label: '1 day before the event' },
    { value: '1_week', label: '1 week before the event' },
    { value: 'custom', label: 'Custom date & time' },
  ];

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function showAlert(msg) {
    const el = document.getElementById('ee-tickets-alert');
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
  }

  async function api(path, opts) {
    const res = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(opts && opts.headers) },
      ...opts,
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return { ok: res.ok, status: res.status, data };
  }

  function formatDateShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function earliestEventDate() {
    const events = seriesMeta.events && seriesMeta.events.length ? seriesMeta.events : [];
    let earliest = null;
    events.forEach((ev) => {
      if (!ev.date) return;
      const d = new Date(ev.date);
      if (Number.isNaN(d.getTime())) return;
      if (!earliest || d < earliest) earliest = d;
    });
    return earliest;
  }

  function computeSaleEndIso(option, customDatetime, eventDateIso) {
    const base = eventDateIso ? new Date(eventDateIso) : earliestEventDate();
    if (!base || Number.isNaN(base.getTime())) return null;
    const d = new Date(base.getTime());
    if (option === 'at_start') return d.toISOString();
    if (option === '12_hours') {
      d.setHours(d.getHours() - 12);
      return d.toISOString();
    }
    if (option === '1_day') {
      d.setDate(d.getDate() - 1);
      return d.toISOString();
    }
    if (option === '1_week') {
      d.setDate(d.getDate() - 7);
      return d.toISOString();
    }
    if (option === 'custom' && customDatetime) {
      const c = new Date(customDatetime);
      if (!Number.isNaN(c.getTime())) return c.toISOString();
    }
    return null;
  }

  function saleEndLabel(option) {
    const hit = SALE_END_OPTIONS.find((o) => o.value === option);
    return hit ? hit.label : option;
  }

  function loadSeriesMeta() {
    try {
      const raw = sessionStorage.getItem(SERIES_STORAGE_KEY);
      if (raw) seriesMeta = { ...seriesMeta, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    if (seriesMeta.eventIds && seriesMeta.eventIds.length) {
      eventIds = seriesMeta.eventIds;
    }
  }

  function renderSeriesSummary() {
    const countEl = document.getElementById('ee-series-count');
    const pills = document.getElementById('ee-series-pills');
    const lead = document.getElementById('ee-tickets-lead');
    const n = eventIds.length;
    if (countEl) {
      countEl.textContent = n + ' event' + (n === 1 ? '' : 's');
    }
    if (lead && seriesMeta.title) {
      lead.textContent =
        'Define tickets for “' +
        seriesMeta.title +
        '”. Each tier is copied to all ' +
        n +
        ' date' +
        (n === 1 ? '' : 's') +
        ' in this series.';
    }
    if (!pills) return;
    const events = seriesMeta.events && seriesMeta.events.length ? seriesMeta.events : eventIds.map((id) => ({ id }));
    pills.innerHTML = events
      .map((ev) => {
        const label = ev.date ? formatDateShort(ev.date) : ev.id;
        return '<span class="ee-pill">' + esc(label) + '</span>';
      })
      .join('');
  }

  function setAttendanceMode(mode) {
    attendanceMode = mode;
    document.querySelectorAll('.ee-mode-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-mode') === mode);
    });
    const ticketsPanel = document.getElementById('ee-panel-tickets');
    const osopPanel = document.getElementById('ee-panel-osop');
    const desc = document.getElementById('ee-mode-desc');
    if (ticketsPanel) ticketsPanel.hidden = mode !== 'tickets';
    if (osopPanel) osopPanel.hidden = mode !== 'osop';
    if (desc) {
      desc.textContent =
        mode === 'osop'
          ? 'Application-based attendance — you review industry and job title, then approve or deny. Approved applicants pay via your payment link.'
          : 'Standard open booking — set up one or more ticket types with prices and quantities. Attendees purchase directly.';
    }
  }

  function saleEndSelectHtml(selected) {
    return (
      '<select class="ee-tier-sale-end">' +
      SALE_END_OPTIONS.map(
        (o) =>
          '<option value="' +
          o.value +
          '"' +
          (o.value === selected ? ' selected' : '') +
          '>' +
          esc(o.label) +
          '</option>'
      ).join('') +
      '</select>'
    );
  }

  function tierRowHtml(index) {
    return (
      '<div class="ee-tier-row ee-tier-row-expanded" data-tier-index="' +
      index +
      '">' +
      '<div class="ee-field"><label>Ticket name</label><input type="text" class="ee-tier-name" required placeholder="e.g. Standard, Early bird" /></div>' +
      '<div class="ee-row-2">' +
      '<div class="ee-field"><label>Price (£) <span class="ee-optional">(optional)</span></label><input type="number" class="ee-tier-price" min="0" step="0.01" value="0" /></div>' +
      '<div class="ee-field"><label>Qty <span class="ee-optional">(optional)</span></label><input type="number" class="ee-tier-qty" min="0" step="1" placeholder="Unlimited" /></div>' +
      '</div>' +
      '<div class="ee-field"><label>Ticket description <span class="ee-optional">(optional)</span></label>' +
      '<p class="ee-hint">e.g. what is included — breakfast, VIP access, etc.</p>' +
      '<input type="text" class="ee-tier-desc" placeholder="e.g. Includes networking lunch" /></div>' +
      '<div class="ee-field"><label>Sales end</label>' +
      '<p class="ee-hint">When this ticket type stops being available (useful for early bird tiers).</p>' +
      saleEndSelectHtml('1_week') +
      '<input type="datetime-local" class="ee-tier-sale-custom" hidden style="margin-top:8px" /></div>' +
      '<div class="ee-field"><label>Status</label><select class="ee-tier-status"><option>Available</option><option>Sold out</option></select></div>' +
      '<button type="button" class="ee-btn ee-btn-outline ee-tier-remove" style="font-size:11px;padding:8px 10px">Remove</button>' +
      '</div>'
    );
  }

  function bindTierRow(row) {
    const saleSelect = row.querySelector('.ee-tier-sale-end');
    const customInput = row.querySelector('.ee-tier-sale-custom');
    if (saleSelect && customInput) {
      saleSelect.addEventListener('change', () => {
        customInput.hidden = saleSelect.value !== 'custom';
      });
    }
    const removeBtn = row.querySelector('.ee-tier-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        const wrap = document.getElementById('ee-tier-rows');
        if (wrap && wrap.children.length <= 1) return;
        row.remove();
      });
    }
  }

  function addTierRow() {
    const wrap = document.getElementById('ee-tier-rows');
    if (!wrap) return;
    const index = wrap.children.length;
    const div = document.createElement('div');
    div.innerHTML = tierRowHtml(index);
    const row = div.firstElementChild;
    bindTierRow(row);
    wrap.appendChild(row);
  }

  function collectTiers() {
    const rows = document.querySelectorAll('.ee-tier-row');
    const tiers = [];
    const eventDate = seriesMeta.events && seriesMeta.events[0] ? seriesMeta.events[0].date : null;
    rows.forEach((row) => {
      const name = row.querySelector('.ee-tier-name').value.trim();
      if (!name) return;
      const price = row.querySelector('.ee-tier-price').value;
      const qty = row.querySelector('.ee-tier-qty').value;
      const status = row.querySelector('.ee-tier-status').value;
      const desc = row.querySelector('.ee-tier-desc').value.trim();
      const saleOption = row.querySelector('.ee-tier-sale-end').value;
      const customDt = row.querySelector('.ee-tier-sale-custom').value;
      const saleEnd = computeSaleEndIso(saleOption, customDt, eventDate);
      let description = desc;
      if (saleOption && saleOption !== 'at_start') {
        const note = 'Sales end: ' + saleEndLabel(saleOption) + '.';
        description = description ? description + ' ' + note : note;
      }
      tiers.push({
        name,
        price,
        description,
        status,
        quantityAvailable: qty === '' ? null : Number(qty),
        saleEnd,
        oneSeatOnly: false,
      });
    });
    return tiers;
  }

  function collectOsopTiers() {
    const price = document.getElementById('ee-osop-price').value;
    const places = document.getElementById('ee-osop-places').value;
    const closeDate = document.getElementById('ee-osop-close').value;
    let description =
      'One Seat Only Policy. Fixed application questions: (1) What industry are you in? (2) What is your job title?';
    if (places) description += ' Max approved places: ' + places + '.';
    if (closeDate) description += ' Applications close: ' + closeDate + '.';
    return [
      {
        name: 'Application to attend',
        price: price === '' ? 0 : price,
        description,
        status: 'Available',
        quantityAvailable: places === '' ? null : Number(places),
        saleEnd: closeDate ? new Date(closeDate + 'T23:59:00').toISOString() : null,
        oneSeatOnly: true,
      },
    ];
  }

  function attendeeExtras() {
    return {
      foodIncluded: document.getElementById('ee-food-included').checked,
      collectDietary: document.getElementById('ee-collect-dietary').checked,
      collectAccessibility: document.getElementById('ee-collect-access').checked,
    };
  }

  async function applyAttendeeExtrasToEvents() {
    const extras = attendeeExtras();
    if (!extras.foodIncluded && !extras.collectDietary && !extras.collectAccessibility) {
      return;
    }
    for (const id of eventIds) {
      const res = await api('/api/organiser/events?id=' + encodeURIComponent(id));
      if (!res.ok || !res.data.event) continue;
      const ev = res.data.event;
      await api('/api/organiser/events', {
        method: 'PATCH',
        body: JSON.stringify({
          id,
          title: ev.title,
          organiserGroupId: ev.organiserGroupId || seriesMeta.organiserGroupId,
          description: ev.description,
          location: ev.location,
          venue: ev.venue,
          attendeeExtras: extras,
        }),
      });
    }
  }

  async function init() {
    loadSeriesMeta();
    if (!eventIds.length) {
      showAlert('No events in this series. Go back and save your event dates first.');
      return;
    }
    renderSeriesSummary();
    addTierRow();
    document.getElementById('ee-add-tier').addEventListener('click', addTierRow);
    document.getElementById('ee-mode-tickets').addEventListener('click', () => setAttendanceMode('tickets'));
    document.getElementById('ee-mode-osop').addEventListener('click', () => setAttendanceMode('osop'));
  }

  document.getElementById('ee-tickets-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showAlert('');
    const tiers = attendanceMode === 'osop' ? collectOsopTiers() : collectTiers();
    if (!tiers.length) {
      showAlert('Add at least one ticket type with a name.');
      return;
    }
    if (!eventIds.length) {
      showAlert('No events to attach tickets to.');
      return;
    }

    const btn = document.getElementById('ee-tickets-submit');
    btn.disabled = true;
    const { ok, data } = await api('/api/organiser/tickets', {
      method: 'POST',
      body: JSON.stringify({ eventIds, tickets: tiers }),
    });

    if (ok) {
      await applyAttendeeExtrasToEvents();
    }

    btn.disabled = false;

    if (!ok) {
      showAlert(data.message || data.error || 'Could not create tickets');
      return;
    }

    try {
      sessionStorage.removeItem(SERIES_STORAGE_KEY);
    } catch {
      /* ignore */
    }

    const created = data.created || tiers.length * eventIds.length;
    alert(
      'Created ' +
        created +
        ' ticket record' +
        (created === 1 ? '' : 's') +
        ' across your series.'
    );
    location.href = 'index.html#events-tickets';
  });

  init();
})();
