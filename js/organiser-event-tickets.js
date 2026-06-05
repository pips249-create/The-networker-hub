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
  let selectedRefundPolicy = '';

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

  const QuarterTime = window.OrganiserQuarterTime;

  function combineDateAndQuarterTime(dateStr, timeStr) {
    if (!dateStr) return null;
    const rounded = QuarterTime
      ? QuarterTime.roundToQuarterHour(timeStr || '09:00')
      : timeStr || '09:00';
    const parts = rounded.split(':').map(Number);
    const ymd = dateStr.split('-').map(Number);
    const local = new Date(ymd[0], (ymd[1] || 1) - 1, ymd[2] || 1, parts[0] || 0, parts[1] || 0, 0);
    if (Number.isNaN(local.getTime())) return null;
    return local.toISOString();
  }

  function populateQuarterTimeSelect(selectEl, selected) {
    if (!selectEl || !QuarterTime) return;
    QuarterTime.populateSelect(selectEl, selected || '09:00');
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
    const seriesCard = document.getElementById('ee-series-card');
    const n = eventIds.length;
    const heroImg =
      seriesMeta.imageUrl ||
      (seriesMeta.events && seriesMeta.events[0] && seriesMeta.events[0].imageUrl) ||
      '';
    if (heroImg && seriesCard && !seriesCard.querySelector('.ee-series-hero')) {
      const wrap = document.createElement('div');
      wrap.className = 'ee-series-hero';
      const img = document.createElement('img');
      img.src = heroImg;
      img.alt = '';
      img.width = 640;
      img.height = 360;
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.onerror = function () {
        wrap.remove();
      };
      wrap.appendChild(img);
      const heading = seriesCard.querySelector('h2');
      if (heading && heading.nextSibling) {
        seriesCard.insertBefore(wrap, heading.nextSibling);
      } else {
        seriesCard.appendChild(wrap);
      }
    }
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
      '<div class="ee-tier-order">' +
      '<button type="button" class="ee-btn ee-btn-outline ee-tier-up" aria-label="Move up">↑</button>' +
      '<button type="button" class="ee-btn ee-btn-outline ee-tier-down" aria-label="Move down">↓</button>' +
      '</div>' +
      '<div class="ee-field"><label>Ticket name</label><input type="text" class="ee-tier-name" required placeholder="e.g. General Admission, Early Bird" /></div>' +
      '<div class="ee-field"><label>Description <span class="ee-optional">(optional)</span></label>' +
      '<textarea class="ee-tier-desc" rows="2" placeholder="What is included with this ticket"></textarea></div>' +
      '<div class="ee-row-2">' +
      '<div class="ee-field"><label>Price (£)</label><p class="ee-hint">Enter 0 for free</p><input type="number" class="ee-tier-price" min="0" step="0.01" value="0" /></div>' +
      '<div class="ee-field"><label>Quantity available <span class="ee-optional">(optional)</span></label><input type="number" class="ee-tier-qty" min="0" step="1" placeholder="Unlimited" /></div>' +
      '</div>' +
      '<div class="ee-row-2">' +
      '<div class="ee-field"><label>Sale start <span class="ee-optional">(optional)</span></label>' +
      '<p class="ee-hint" style="margin-top:0">Pick a date and time in 15-minute steps</p>' +
      '<div class="ee-datetime-split">' +
      '<input type="date" class="ee-tier-sale-start-date" />' +
      '<select class="ee-tier-sale-start-time" aria-label="Sale start time"></select>' +
      '</div></div>' +
      '<div class="ee-field"><label>Sale end <span class="ee-optional">(optional)</span></label>' +
      saleEndSelectHtml('1_week') +
      '<div class="ee-sale-custom-wrap" hidden style="margin-top:8px">' +
      '<p class="ee-hint" style="margin:0 0 6px">Custom end date and time</p>' +
      '<div class="ee-datetime-split">' +
      '<input type="date" class="ee-tier-sale-custom-date" />' +
      '<select class="ee-tier-sale-custom-time" aria-label="Custom sale end time"></select>' +
      '</div></div></div>' +
      '</div>' +
      '<div class="ee-field"><label>Ticket type</label><select class="ee-tier-kind">' +
      '<option value="Standard">Standard (auto-approve)</option>' +
      '<option value="Application-based">Application-based (you review applicants)</option>' +
      '</select></div>' +
      '<button type="button" class="ee-btn ee-btn-outline ee-tier-remove" style="font-size:11px;padding:8px 10px">Remove</button>' +
      '</div>'
    );
  }

  function updateTierSummary() {
    const summary = document.getElementById('ee-tier-summary');
    if (!summary || attendanceMode !== 'tickets') return;
    const rows = document.querySelectorAll('.ee-tier-row');
    let count = 0;
    let totalQty = 0;
    let hasUnlimited = false;
    let minPrice = null;
    rows.forEach((row) => {
      const name = row.querySelector('.ee-tier-name')?.value.trim();
      if (!name) return;
      count += 1;
      const qtyRaw = row.querySelector('.ee-tier-qty')?.value;
      if (qtyRaw === '' || qtyRaw == null) hasUnlimited = true;
      else totalQty += Number(qtyRaw) || 0;
      const price = Number(row.querySelector('.ee-tier-price')?.value) || 0;
      if (minPrice == null || price < minPrice) minPrice = price;
    });
    const qtyLabel = hasUnlimited && count ? 'unlimited' : String(totalQty);
    const fromPrice = minPrice == null ? '0' : minPrice.toFixed(2);
    summary.textContent =
      count +
      ' ticket type' +
      (count === 1 ? '' : 's') +
      ' · ' +
      qtyLabel +
      ' total available · from £' +
      fromPrice;
  }

  function moveTierRow(row, dir) {
    const wrap = document.getElementById('ee-tier-rows');
    if (!wrap || !row) return;
    if (dir < 0 && row.previousElementSibling) {
      wrap.insertBefore(row, row.previousElementSibling);
    } else if (dir > 0 && row.nextElementSibling) {
      wrap.insertBefore(row.nextElementSibling, row);
    }
    updateTierSummary();
  }

  function bindTierRow(row) {
    const saleSelect = row.querySelector('.ee-tier-sale-end');
    const customWrap = row.querySelector('.ee-sale-custom-wrap');
    if (saleSelect && customWrap) {
      saleSelect.addEventListener('change', () => {
        customWrap.hidden = saleSelect.value !== 'custom';
      });
    }
    populateQuarterTimeSelect(row.querySelector('.ee-tier-sale-start-time'), '09:00');
    populateQuarterTimeSelect(row.querySelector('.ee-tier-sale-custom-time'), '18:00');
    row.querySelectorAll('input, textarea, select').forEach((el) => {
      el.addEventListener('input', updateTierSummary);
      el.addEventListener('change', updateTierSummary);
    });
    const up = row.querySelector('.ee-tier-up');
    const down = row.querySelector('.ee-tier-down');
    if (up) up.addEventListener('click', () => moveTierRow(row, -1));
    if (down) down.addEventListener('click', () => moveTierRow(row, 1));
    const removeBtn = row.querySelector('.ee-tier-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        const wrap = document.getElementById('ee-tier-rows');
        if (wrap && wrap.children.length <= 1) return;
        row.remove();
        updateTierSummary();
        updatePublishButton();
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
    updateTierSummary();
    updatePublishButton();
  }

  function collectTiers() {
    const rows = document.querySelectorAll('.ee-tier-row');
    const tiers = [];
    const eventDate = seriesMeta.events && seriesMeta.events[0] ? seriesMeta.events[0].date : null;
    rows.forEach((row, idx) => {
      const nameEl = row.querySelector('.ee-tier-name');
      if (!nameEl) return;
      const name = nameEl.value.trim();
      if (!name) return;
      const price = row.querySelector('.ee-tier-price')?.value;
      const qty = row.querySelector('.ee-tier-qty')?.value;
      const desc = row.querySelector('.ee-tier-desc')?.value.trim() || '';
      const saleOption = row.querySelector('.ee-tier-sale-end')?.value;
      const customDt = combineDateAndQuarterTime(
        row.querySelector('.ee-tier-sale-custom-date')?.value,
        row.querySelector('.ee-tier-sale-custom-time')?.value
      );
      const saleStart = combineDateAndQuarterTime(
        row.querySelector('.ee-tier-sale-start-date')?.value,
        row.querySelector('.ee-tier-sale-start-time')?.value
      );
      const saleEnd = computeSaleEndIso(saleOption, customDt, eventDate);
      const ticketKind = row.querySelector('.ee-tier-kind')?.value || 'Standard';
      const isApp = ticketKind === 'Application-based';
      tiers.push({
        name,
        price,
        description: desc,
        status: 'Available',
        quantityAvailable: qty === '' ? null : Number(qty),
        saleStart,
        saleEnd,
        oneSeatOnly: isApp,
        ticketType: ticketKind,
        displayOrder: idx,
      });
    });
    return tiers;
  }

  function collectRefundPayload() {
    const policy =
      selectedRefundPolicy ||
      document.querySelector('input[name="refund-policy"]:checked')?.value ||
      '';
    const agreed = document.getElementById('refund-terms-agreed')?.checked;
    const payload = {
      refundPolicy: policy,
      refundTermsAgreed: agreed,
    };
    if (policy === 'full_refund') {
      payload.refundCutoffDays = Number(document.getElementById('refund-cutoff-days')?.value) || 0;
    } else if (policy === 'partial_refund') {
      payload.refundPolicyDetails = document.getElementById('refund-partial-details')?.value.trim() || '';
    } else if (policy === 'custom') {
      payload.refundPolicyDetails = document.getElementById('refund-custom-details')?.value.trim() || '';
    }
    return payload;
  }

  function updatePublishButton() {
    const btn = document.getElementById('ee-tickets-submit');
    const warn = document.getElementById('ee-publish-warn');
    if (!btn) return;
    try {
      const tiers = attendanceMode === 'osop' ? collectOsopTiers() : collectTiers();
      const refund = collectRefundPayload();
      const ready =
        tiers.length > 0 && refund.refundPolicy && refund.refundTermsAgreed;
      btn.disabled = !ready;
      if (warn) warn.hidden = ready;
    } catch {
      btn.disabled = true;
      if (warn) warn.hidden = false;
    }
  }

  function selectRefundCard(radio) {
    if (!radio) return;
    radio.checked = true;
    selectedRefundPolicy = radio.value;
    document.querySelectorAll('.ee-refund-card').forEach((c) => {
      const r = c.querySelector('input[type="radio"]');
      const active = r && r.checked;
      c.classList.toggle('is-selected', active);
      c.setAttribute('aria-checked', active ? 'true' : 'false');
      const extra = c.querySelector('.ee-refund-extra');
      if (extra) extra.hidden = !active;
    });
    updatePublishButton();
  }

  function bindRefundPolicy() {
    document.querySelectorAll('.ee-refund-card').forEach((card) => {
      const radio = card.querySelector('input[type="radio"]');
      if (!radio) return;
      radio.addEventListener('change', () => selectRefundCard(radio));
      card.addEventListener('click', (e) => {
        if (e.target.closest('input, textarea')) return;
        e.preventDefault();
        selectRefundCard(radio);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectRefundCard(radio);
        }
      });
    });
    const agree = document.getElementById('refund-terms-agreed');
    if (agree) agree.addEventListener('change', updatePublishButton);
    ['refund-cutoff-days', 'refund-partial-details', 'refund-custom-details'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updatePublishButton);
    });
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
          type: ev.type,
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
    document.getElementById('ee-mode-tickets').addEventListener('click', () => {
      setAttendanceMode('tickets');
      updateTierSummary();
      updatePublishButton();
    });
    document.getElementById('ee-mode-osop').addEventListener('click', () => {
      setAttendanceMode('osop');
      updatePublishButton();
    });
    bindRefundPolicy();
    updatePublishButton();
  }

  async function saveTickets(publish) {
    showAlert('');
    const loading = window.organiserPageLoading;
    const tiers = attendanceMode === 'osop' ? collectOsopTiers() : collectTiers();
    if (!tiers.length) {
      showAlert('Add at least one ticket type with a name.');
      updatePublishButton();
      return;
    }
    if (!eventIds.length) {
      showAlert('No events to attach tickets to.');
      return;
    }

    const refund = collectRefundPayload();
    if (publish) {
      if (!refund.refundPolicy) {
        showAlert('Select a refund policy before publishing.');
        updatePublishButton();
        return;
      }
      if (!refund.refundTermsAgreed) {
        showAlert('Confirm you understand you are responsible for refunds.');
        updatePublishButton();
        return;
      }
    }

    const btn = document.getElementById('ee-tickets-submit');
    const saveBtn = document.getElementById('ee-tickets-save');
    if (btn) btn.disabled = true;
    if (saveBtn) saveBtn.disabled = true;
    if (loading) loading.show(publish ? 'Publishing event' : 'Saving tickets');

    const body = {
      eventIds,
      tickets: tiers,
      publish,
      ...refund,
    };

    const { ok, data } = await api('/api/organiser/tickets', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (ok) {
      await applyAttendeeExtrasToEvents();
    }

    if (loading) loading.hide();
    if (saveBtn) saveBtn.disabled = false;
    updatePublishButton();

    if (!ok) {
      showAlert(data.message || data.error || 'Could not save tickets');
      return;
    }

    if (!publish) {
      showAlert('Tickets saved. Complete the refund policy and publish when ready.');
      return;
    }

    try {
      sessionStorage.removeItem(SERIES_STORAGE_KEY);
    } catch {
      /* ignore */
    }

    const qs = new URLSearchParams();
    qs.set('ids', eventIds.join(','));
    if (seriesMeta.title) qs.set('title', seriesMeta.title);
    if (seriesMeta.imageUrl) qs.set('image', seriesMeta.imageUrl);
    const firstImg =
      seriesMeta.events && seriesMeta.events[0] && seriesMeta.events[0].imageUrl;
    if (firstImg) qs.set('image', firstImg);
    location.href = 'event-published.html?' + qs.toString();
  }

  document.getElementById('ee-tickets-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveTickets(true);
  });

  const saveDraftBtn = document.getElementById('ee-tickets-save');
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', () => saveTickets(false));
  }

  init();
})();
