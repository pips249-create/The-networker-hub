/**
 * Ticket setup for an event series — duplicate tiers across all dates.
 */
(function () {
  const SERIES_STORAGE_KEY = 'hub_event_series';
  const params = new URLSearchParams(location.search);
  const idsParam = params.get('ids') || '';

  let eventIds = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  let seriesMeta = { title: '', events: [] };

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

  function loadSeriesMeta() {
    try {
      const raw = sessionStorage.getItem(SERIES_STORAGE_KEY);
      if (raw) seriesMeta = JSON.parse(raw) || seriesMeta;
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
        'Define ticket tiers for “' +
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

  function tierRowHtml(index) {
    return (
      '<div class="ee-tier-row" data-tier-index="' +
      index +
      '">' +
      '<div class="ee-field"><label>Ticket name</label><input type="text" class="ee-tier-name" required placeholder="e.g. Standard" /></div>' +
      '<div class="ee-field"><label>Price (£)</label><input type="number" class="ee-tier-price" min="0" step="0.01" value="0" /></div>' +
      '<div class="ee-field"><label>Qty</label><input type="number" class="ee-tier-qty" min="0" step="1" placeholder="—" /></div>' +
      '<div class="ee-field"><label>Status</label><select class="ee-tier-status"><option>Available</option><option>Sold out</option></select></div>' +
      '<button type="button" class="ee-btn ee-btn-outline ee-tier-remove" style="font-size:11px;padding:8px 10px">Remove</button>' +
      '</div>'
    );
  }

  function addTierRow() {
    const wrap = document.getElementById('ee-tier-rows');
    if (!wrap) return;
    const index = wrap.children.length;
    const div = document.createElement('div');
    div.innerHTML = tierRowHtml(index);
    const row = div.firstElementChild;
    row.querySelector('.ee-tier-remove').addEventListener('click', () => {
      if (wrap.children.length <= 1) return;
      row.remove();
    });
    wrap.appendChild(row);
  }

  function collectTiers() {
    const rows = document.querySelectorAll('.ee-tier-row');
    const tiers = [];
    rows.forEach((row) => {
      const name = row.querySelector('.ee-tier-name').value.trim();
      if (!name) return;
      const price = row.querySelector('.ee-tier-price').value;
      const qty = row.querySelector('.ee-tier-qty').value;
      const status = row.querySelector('.ee-tier-status').value;
      tiers.push({
        name,
        price,
        description: '',
        status,
        quantityAvailable: qty === '' ? null : Number(qty),
      });
    });
    return tiers;
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
  }

  document.getElementById('ee-tickets-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showAlert('');
    const tiers = collectTiers();
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
