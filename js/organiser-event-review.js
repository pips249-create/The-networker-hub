/**
 * Review step before publishing an event listing.
 */
(function () {
  const SERIES_STORAGE_KEY = 'hub_event_series';
  const PUBLISHED_PREVIEW_KEY = 'hub_event_published_preview';
  const params = new URLSearchParams(location.search);
  const idsParam = params.get('ids') || '';
  const isEmbedDrawer = params.get('embed') === '1' || window.self !== window.top;

  if (isEmbedDrawer) {
    document.documentElement.classList.add('ee-embed-drawer-root');
    if (document.body) document.body.classList.add('ee-embed-drawer');
  }

  let eventIds = idsParam
    .split(',')
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
  let seriesMeta = { title: '', events: [], eventFormat: '' };
  let anchorEvent = null;
  let loadedTickets = [];
  let organiserGroupName = '';
  let organiserComplimentaryVisits = 0;

  const FORMAT_LABELS = {
    'in-person': 'In person',
    online: 'Online',
    hybrid: 'Hybrid',
  };

  const REFUND_LABELS = {
    flexible: 'Flexible',
    standard: 'Standard',
    strict: 'Strict (B2B)',
    non_refundable: 'Non-refundable',
  };

  const SALE_END_OPTIONS = [
    { value: 'at_start', label: 'When the event starts' },
    { value: '12_hours', label: '12 hours before the event' },
    { value: '1_day', label: '1 day before the event' },
    { value: '1_week', label: '1 week before the event' },
    { value: 'custom', label: 'Custom date & time' },
  ];

  const LEGACY_MODERATE_REFUND_DETAILS =
    '100% refund up to 7 days before the event; 50% refund up to 48 hours before the event.';

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
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

  function showAlert(msg, tone) {
    const el = document.getElementById('ee-review-alert');
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
    el.classList.toggle('ee-alert-ok', tone === 'ok');
    el.classList.toggle('ee-alert-warn', tone === 'warn');
    if (msg) {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch {
        /* ignore */
      }
    }
  }

  function loadSeriesMeta() {
    const hadUrlIds = eventIds.length > 0;
    try {
      const raw = sessionStorage.getItem(SERIES_STORAGE_KEY);
      if (raw) seriesMeta = { ...seriesMeta, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    if (!hadUrlIds && seriesMeta.eventIds && seriesMeta.eventIds.length) {
      eventIds = seriesMeta.eventIds;
    }
  }

  function formatDateShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function formatTime12hFromIso(iso) {
    if (!iso) return '';
    const tz = window.HubEventTimezone;
    let hour = NaN;
    let minute = NaN;
    if (tz && typeof tz.londonTimeFromIso === 'function') {
      const parts = String(tz.londonTimeFromIso(iso) || '').split(':');
      hour = Number(parts[0]);
      minute = Number(parts[1]);
    } else {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      hour = d.getHours();
      minute = d.getMinutes();
    }
    if (Number.isNaN(hour) || Number.isNaN(minute)) return '';
    const period = hour >= 12 ? 'pm' : 'am';
    const hour12 = hour % 12 || 12;
    return hour12 + ':' + pad2(minute) + period;
  }

  function formatReviewTimeRange(startIso, endIso) {
    const start = formatTime12hFromIso(startIso);
    if (!start) return '';
    if (!endIso) return start;
    const end = formatTime12hFromIso(endIso);
    return end ? start + ' – ' + end : start;
  }

  function formatReviewDateLabel(ev) {
    if (!ev || !ev.date) return 'Date TBC';
    const datePart = formatDateShort(ev.date);
    const endDate = ev.endDate || anchorEvent?.endDate || '';
    const timePart = formatReviewTimeRange(ev.date, endDate);
    return timePart ? datePart + ' · ' + timePart : datePart;
  }

  function saleEndLabel(option) {
    const hit = SALE_END_OPTIONS.find(function (o) {
      return o.value === option;
    });
    return hit ? hit.label : option;
  }

  function inferRefundPresetFromStored(refundPolicy, refundCutoffDays, refundPolicyDetails) {
    const policy = String(refundPolicy || '').trim();
    const cutoff = Number(refundCutoffDays);
    const details = String(refundPolicyDetails || '').trim();
    if (policy === 'no_refunds') return 'non_refundable';
    if (policy === 'full_refund') {
      if (cutoff === 2 || cutoff === 1) return 'flexible';
      if (cutoff === 7) return 'standard';
      if (cutoff === 14 || cutoff === 3) return 'strict';
      if (!Number.isFinite(cutoff) || cutoff <= 0) return 'standard';
      if (cutoff <= 2) return 'flexible';
      if (cutoff <= 7) return 'standard';
      return 'strict';
    }
    if (
      (policy === 'custom' || policy === 'partial_refund') &&
      (details === LEGACY_MODERATE_REFUND_DETAILS || /^100% refund up to 7 days before/i.test(details))
    ) {
      return 'standard';
    }
    return '';
  }

  function isAlumniTicket(ticket) {
    const kind = ticket.ticketType || '';
    return kind === 'Alumni' || /^alumni/i.test(ticket.name || '');
  }

  function isGuestVisitTicket(ticket) {
    const kind = ticket.ticketType || '';
    return /guest-visit/i.test(kind) || /^guest\s*visit$/i.test(ticket.name || '');
  }

  function isMembersOnlyTicket(ticket) {
    return String(ticket?.visibility || '').toLowerCase() === 'members_only';
  }

  function ticketsPageUrl() {
    const qs = new URLSearchParams();
    qs.set('ids', eventIds.join(','));
    if (isEmbedDrawer) qs.set('embed', '1');
    return '/organiser/event-tickets?' + qs.toString();
  }

  function reviewEditHref(path) {
    const id = eventIds[0];
    if (!id || isEmbedDrawer) return '';
    return path + '?id=' + encodeURIComponent(id);
  }

  function resolveReviewFormat() {
    const raw = seriesMeta.eventFormat || anchorEvent?.eventFormat || anchorEvent?.meetingType || 'in-person';
    const key = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    if (key.includes('online') && !key.includes('hybrid') && !key.includes('person')) return 'online';
    if (key.includes('hybrid')) return 'hybrid';
    return 'in-person';
  }

  function reviewLocationSummary() {
    const formatKey = resolveReviewFormat();
    const label = FORMAT_LABELS[formatKey] || 'In person';
    if (formatKey === 'online') {
      const link = String(anchorEvent?.onlineLink || '').trim();
      return link ? label + ' — join link added' : label;
    }
    const venue = String(anchorEvent?.venue || '').trim();
    const city = String(anchorEvent?.city || '').trim();
    const postcode = String(anchorEvent?.postcode || '').trim();
    const parts = [venue, city, postcode].filter(Boolean);
    if (formatKey === 'hybrid') {
      return parts.length ? label + ' — ' + parts.join(', ') : label + ' — venue and online link';
    }
    return parts.length ? parts.join(', ') : label + ' — location saved';
  }

  function reviewAttendanceLabel() {
    const mode = anchorEvent?.attendanceMode || 'tickets';
    if (mode === 'category_exclusivity') return 'Category Exclusivity — apply, then approve before payment';
    if (mode === 'guest_programme') {
      const visits = organiserComplimentaryVisits || 1;
      return (
        'Guest visit programme — newcomers can visit up to ' + visits + ' time(s) before buying a member ticket'
      );
    }
    return 'Open ticket booking';
  }

  function formatTierPrice(price) {
    const n = Number(price);
    if (!Number.isFinite(n) || n <= 0) return 'Free';
    return '£' + n.toFixed(2);
  }

  function displayTiers() {
    return loadedTickets.filter(function (t) {
      return !isGuestVisitTicket(t) && !isAlumniTicket(t);
    });
  }

  function tiersHavePaidPrice(tiers, alumniFastPass) {
    if (alumniFastPass?.enabled && Number(alumniFastPass.price) > 0) return true;
    return (tiers || []).some(function (tier) {
      const price = Number(tier.price);
      return Number.isFinite(price) && price > 0;
    });
  }

  function reviewTicketLines(tiers) {
    return (tiers || []).map(function (tier) {
      const qty =
        tier.quantityAvailable == null || tier.quantityAvailable === ''
          ? 'unlimited'
          : String(tier.quantityAvailable);
      let line = esc(tier.name || 'Ticket') + ' — ' + esc(formatTierPrice(tier.price));
      if (isMembersOnlyTicket(tier)) line += ' (members only)';
      if (tier.ticketType === 'Alumni') line += ' (previous attendees)';
      line += ' · ' + esc(qty) + ' available';
      if (tier.saleEndOption) {
        line += ' · sales end ' + esc(saleEndLabel(tier.saleEndOption).toLowerCase());
      }
      return line;
    });
  }

  function reviewEventImageUrl() {
    const fromMeta = String(seriesMeta.imageUrl || '').trim();
    if (fromMeta) return fromMeta;
    const fromAnchor = String(anchorEvent?.imageUrl || '').trim();
    if (fromAnchor) return fromAnchor;
    const firstEvent =
      seriesMeta.events && seriesMeta.events.length ? seriesMeta.events[0] : null;
    return String(firstEvent?.imageUrl || '').trim();
  }

  function reviewEventImagePosition() {
    const pos =
      seriesMeta.imagePosition ||
      anchorEvent?.imagePosition ||
      (seriesMeta.events && seriesMeta.events[0] && seriesMeta.events[0].imagePosition) ||
      '';
    const normalized = String(pos || '').trim();
    return /^\d{1,3}% \d{1,3}%$/.test(normalized) ? normalized : '';
  }

  function reviewEventImageHtml() {
    const imageUrl = reviewEventImageUrl();
    if (!imageUrl) return '';
    const title = seriesMeta.title || anchorEvent?.title || 'Event photo';
    const position = reviewEventImagePosition();
    const style = position ? ' style="object-position:' + esc(position) + '"' : '';
    return (
      '<div class="ee-publish-review-event-media">' +
      '<img src="' +
      esc(imageUrl) +
      '" alt="' +
      esc(title) +
      ' photo"' +
      style +
      ' width="240" height="150" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'../assets/event-placeholder.svg\'" />' +
      '</div>'
    );
  }

  function reviewSection(title, valueHtml, editPath, editLabel) {
    const editHref = editPath ? reviewEditHref(editPath) : '';
    const editLink = editHref
      ? '<a class="ee-publish-review-edit" href="' +
        esc(editHref) +
        '">' +
        esc(editLabel || 'Edit') +
        '</a>'
      : '';
    return (
      '<section class="ee-publish-review-section">' +
      '<div class="ee-publish-review-section-head">' +
      '<h3>' +
      esc(title) +
      '</h3>' +
      editLink +
      '</div>' +
      valueHtml +
      '</section>'
    );
  }

  function alumniFastPassFromLoaded(event, tickets) {
    const alumniTicket = (tickets || []).find(isAlumniTicket);
    const enabled = Boolean(event?.alumniFastPassEnabled || alumniTicket);
    if (!enabled) return { enabled: false };
    if (!alumniTicket) return { enabled: true };
    return {
      enabled: true,
      price: alumniTicket.price,
      quantityAvailable: alumniTicket.quantityAvailable,
      saleEnd: alumniTicket.saleEnd || null,
      saleEndOption: alumniTicket.saleEndOption || null,
      saleEndCustom: alumniTicket.saleEndCustom || null,
    };
  }

  function ticketsForPublish(allTickets) {
    return (allTickets || [])
      .filter(function (t) {
        return !isGuestVisitTicket(t) && !isAlumniTicket(t);
      })
      .map(function (t, idx) {
        return {
          name: String(t.name || '').trim(),
          price: t.price,
          description: String(t.description || '').trim(),
          status: String(t.status || 'Available').trim(),
          quantityAvailable: t.quantityAvailable,
          saleEnd: t.saleEnd || null,
          saleEndOption: t.saleEndOption || null,
          saleEndCustom: t.saleEndCustom || null,
          saleStart: t.saleStart || null,
          categoryExclusivity: Boolean(t.categoryExclusivity),
          ticketType: t.ticketType || (t.categoryExclusivity ? 'Application-based' : 'Standard'),
          displayOrder: t.displayOrder != null ? t.displayOrder : idx,
          visibility: t.visibility || 'public',
        };
      })
      .filter(function (t) {
        return t.name;
      });
  }

  function renderReviewBody() {
    const tiers = displayTiers();
    const alumniFastPass = alumniFastPassFromLoaded(anchorEvent, loadedTickets);
    const hasPaid = tiersHavePaidPrice(tiers, alumniFastPass);
    const refundPreset = hasPaid
      ? inferRefundPresetFromStored(
          anchorEvent?.refundPolicy,
          anchorEvent?.refundCutoffDays,
          anchorEvent?.refundPolicyDetails
        )
      : '';
    const events =
      seriesMeta.events && seriesMeta.events.length
        ? seriesMeta.events.slice().sort(function (a, b) {
            return new Date(a.date || 0) - new Date(b.date || 0);
          })
        : eventIds.map(function (id) {
            return { id: id };
          });
    const dateItems = events
      .map(function (ev) {
        return '<li>' + esc(formatReviewDateLabel(ev)) + '</li>';
      })
      .join('');
    const dateCount = events.length;
    const ticketLines = reviewTicketLines(tiers);
    const ticketList =
      ticketLines.length > 0
        ? '<ul class="ee-publish-review-list">' +
          ticketLines
            .map(function (line) {
              return '<li>' + line + '</li>';
            })
            .join('') +
          '</ul>'
        : '<p class="ee-publish-review-value">No ticket types</p>';

    const eventImageHtml = reviewEventImageHtml();
    const eventCopyHtml =
      '<div class="ee-publish-review-event-copy">' +
      '<p class="ee-publish-review-value">' +
      esc(seriesMeta.title || anchorEvent?.title || 'Untitled event') +
      '</p>' +
      (organiserGroupName
        ? '<p class="ee-publish-review-sub">Organiser page: ' + esc(organiserGroupName) + '</p>'
        : '') +
      '</div>';
    const eventBodyHtml =
      '<div class="ee-publish-review-event' +
      (eventImageHtml ? ' ee-publish-review-event--has-image' : '') +
      '">' +
      eventImageHtml +
      eventCopyHtml +
      '</div>';

    let html = '';
    html += reviewSection('Event', eventBodyHtml, '/organiser/event-edit', 'Edit details');
    html += reviewSection(
      dateCount === 1 ? 'Date' : 'Dates (' + dateCount + ')',
      '<ul class="ee-publish-review-dates">' + dateItems + '</ul>',
      '/organiser/event-edit',
      'Edit dates'
    );
    html += reviewSection(
      'Location & format',
      '<p class="ee-publish-review-value">' +
        esc(FORMAT_LABELS[resolveReviewFormat()] || 'In person') +
        '</p>' +
        '<p class="ee-publish-review-sub">' +
        esc(reviewLocationSummary()) +
        '</p>',
      '/organiser/event-location',
      'Edit location'
    );
    html += reviewSection(
      'Attendance',
      '<p class="ee-publish-review-value">' + esc(reviewAttendanceLabel()) + '</p>',
      '',
      ''
    );
    html += reviewSection(
      'Tickets',
      ticketList +
        (hasPaid
          ? '<p class="ee-publish-review-sub">' +
            'VAT: ' +
            esc(
              anchorEvent?.vatTreatment === 'added' ? 'added at checkout' : 'included in ticket price'
            ) +
            ' · Refund policy: ' +
            esc(REFUND_LABELS[refundPreset] || 'Selected') +
            '</p>'
          : '<p class="ee-publish-review-sub">Free event — no VAT or refund policy required</p>'),
      ticketsPageUrl(),
      'Edit tickets'
    );
    return html;
  }

  function renderReviewNext() {
    const tiers = displayTiers();
    const scheduled = tiers.some(function (tier) {
      if (!tier.saleStart) return false;
      const start = new Date(tier.saleStart);
      return !Number.isNaN(start.getTime()) && start > Date.now();
    });
    let text =
      'Your listing is submitted for review. Once approved, it appears on Browse events';
    if (scheduled) {
      text += ' and ticket sales open on the start dates you set';
    } else {
      text += ' and ticket sales go live';
    }
    text += '. You can still edit most details from My Events before the first date.';
    const nextEl = document.getElementById('ee-publish-review-next');
    if (nextEl) nextEl.textContent = text;
  }

  function buildPublishBody() {
    const tiers = ticketsForPublish(loadedTickets);
    const alumniFastPass = alumniFastPassFromLoaded(anchorEvent, loadedTickets);
    const hasPaid = tiersHavePaidPrice(tiers, alumniFastPass);
    const body = {
      eventIds: eventIds.slice(),
      tickets: tiers,
      publish: true,
      attendanceMode: String(anchorEvent?.attendanceMode || 'tickets').trim(),
      guestPassesDisabled: Boolean(anchorEvent?.guestPassesDisabled),
      alumniFastPass: alumniFastPass,
      vatTreatment: hasPaid ? String(anchorEvent?.vatTreatment || '').trim() : '',
      attendeeExtras: {
        foodIncluded: Boolean(anchorEvent?.foodIncluded),
        collectDietary: Boolean(anchorEvent?.collectDietary),
        collectAccessibility: Boolean(anchorEvent?.collectAccessibility),
      },
    };
    if (hasPaid) {
      body.refundPolicy = anchorEvent?.refundPolicy;
      body.refundPolicyDetails = anchorEvent?.refundPolicyDetails || '';
      body.refundCutoffDays = anchorEvent?.refundCutoffDays;
      body.refundTermsAgreed = Boolean(anchorEvent?.refundTermsAgreed);
    }
    return body;
  }

  async function hydrateSeriesEvents() {
    if (!eventIds.length) return;
    const existing = seriesMeta.events && seriesMeta.events.length ? seriesMeta.events : [];
    const byId = new Map(
      existing.map(function (ev) {
        return [ev.id, ev];
      })
    );
    eventIds.forEach(function (id) {
      if (!byId.has(id)) byId.set(id, { id: id });
    });

    const missingDates = eventIds.filter(function (id) {
      const ev = byId.get(id);
      return !ev || !ev.date;
    });
    if (missingDates.length) {
      const results = await Promise.all(
        missingDates.map(function (id) {
          return api('/api/organiser/events?id=' + encodeURIComponent(id));
        })
      );
      results.forEach(function (res) {
        const ev = res.ok && res.data.event ? res.data.event : null;
        if (!ev) return;
        byId.set(ev.id, {
          id: ev.id,
          title: ev.title,
          date: ev.date,
          endDate: ev.endDate || '',
          imageUrl: ev.imageUrl || '',
          imagePosition: ev.imagePosition || '',
        });
      });
    }

    seriesMeta.events = eventIds
      .map(function (id) {
        return byId.get(id);
      })
      .filter(Boolean);
  }

  async function loadOrganiserGroup(groupId) {
    if (!groupId) return;
    const { ok, data } = await api('/api/organiser/groups?id=' + encodeURIComponent(groupId));
    if (ok && data.group) {
      organiserGroupName = String(data.group.name || '').trim();
      organiserComplimentaryVisits = Number(data.group.complimentaryVisitsAllowed) || 0;
    }
  }

  async function loadData() {
    const firstId = eventIds[0];
    const [ticketsRes, eventRes] = await Promise.all([
      api('/api/organiser/tickets?eventId=' + encodeURIComponent(firstId)),
      api('/api/organiser/events?id=' + encodeURIComponent(firstId)),
    ]);

    if (ticketsRes.status === 401 || eventRes.status === 401) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.href = '../login?next=' + next;
      return false;
    }

    loadedTickets =
      ticketsRes.ok && Array.isArray(ticketsRes.data.tickets) ? ticketsRes.data.tickets : [];
    anchorEvent = eventRes.ok && eventRes.data.event ? eventRes.data.event : null;

    if (!anchorEvent) return false;

    if (anchorEvent.title && !seriesMeta.title) seriesMeta.title = anchorEvent.title;
    if (anchorEvent.organiserGroupId && !seriesMeta.organiserGroupId) {
      seriesMeta.organiserGroupId = anchorEvent.organiserGroupId;
    }
    if (anchorEvent.imageUrl && !seriesMeta.imageUrl) seriesMeta.imageUrl = anchorEvent.imageUrl;
    if (anchorEvent.imagePosition && !seriesMeta.imagePosition) {
      seriesMeta.imagePosition = anchorEvent.imagePosition;
    }

    await hydrateSeriesEvents();
    await loadOrganiserGroup(seriesMeta.organiserGroupId || anchorEvent.organiserGroupId);
    return true;
  }

  function redirectAfterPublish() {
    const publishedTitle = seriesMeta.title || anchorEvent?.title || '';
    const publishedImage =
      seriesMeta.imageUrl ||
      (seriesMeta.events && seriesMeta.events[0] && seriesMeta.events[0].imageUrl) ||
      anchorEvent?.imageUrl ||
      '';
    try {
      sessionStorage.removeItem(SERIES_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.setItem(
        PUBLISHED_PREVIEW_KEY,
        JSON.stringify({
          ids: eventIds.join(','),
          title: publishedTitle,
          image: publishedImage,
        })
      );
    } catch {
      /* ignore */
    }
    const publishedQs = new URLSearchParams();
    publishedQs.set('ids', eventIds.join(','));
    if (publishedTitle) publishedQs.set('title', publishedTitle);
    const publishedUrl = '/organiser/event-published?' + publishedQs.toString();

    if (isEmbedDrawer && window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'hub-event-tickets-done',
          eventIds: eventIds.slice(),
          eventId: eventIds[0] || '',
          title: publishedTitle,
          imageUrl: publishedImage,
          publishedUrl: publishedUrl,
        },
        window.location.origin
      );
      return;
    }

    location.href = publishedUrl;
  }

  async function publishListing() {
    showAlert('');

    if (!loadedTickets.length) {
      showAlert('No ticket types found — go back and set up tickets before publishing.', 'warn');
      return;
    }

    if (window.HubOrganiserTerms) {
      try {
        await window.HubOrganiserTerms.requireAcceptance();
      } catch {
        showAlert('Accept the organiser terms to publish, or cancel and come back when you are ready.', 'warn');
        return;
      }
    }

    const confirmBtn = document.getElementById('ee-review-confirm');
    const backBtn = document.getElementById('ee-review-back');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Publishing…';
    }
    if (backBtn) backBtn.setAttribute('aria-disabled', 'true');

    const loading = window.organiserPageLoading;
    const body = buildPublishBody();

    const publishWork = function () {
      return api('/api/organiser/tickets', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    };

    let result;
    try {
      if (loading && loading.run) {
        result = await loading.run('Creating and publishing your event', publishWork, {
          progressStep: 'publish',
        });
      } else {
        if (loading) loading.show('Creating and publishing your event');
        result = await publishWork();
        if (loading) loading.hide();
      }
    } finally {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm & publish';
      }
      if (backBtn) backBtn.removeAttribute('aria-disabled');
    }

    if (!result.ok) {
      const data = result.data || {};
      showAlert(data.message || data.error || 'Could not publish your event', 'warn');
      return;
    }

    const publishedRows = Array.isArray(result.data.publishedEvents) ? result.data.publishedEvents : [];
    const allLive =
      publishedRows.length > 0 &&
      publishedRows.every(function (ev) {
        return String(ev.status || ev.listingStatus || '').toLowerCase() === 'published';
      });
    if (!allLive) {
      showAlert(
        'Tickets were saved, but this event is still a draft and not live yet. Check ticket types, bank details (for paid tickets), and dates — then try publishing again.',
        'warn'
      );
      return;
    }

    redirectAfterPublish();
  }

  function bindUi() {
    const ticketsUrl = ticketsPageUrl();
    const backTickets = document.getElementById('ee-back-tickets-link');
    const backEdit = document.getElementById('ee-review-back');
    if (backTickets) {
      backTickets.href = ticketsUrl;
      backTickets.hidden = false;
    }
    if (backEdit) backEdit.href = ticketsUrl;
    document.getElementById('ee-review-confirm')?.addEventListener('click', publishListing);
  }

  function renderReview() {
    const body = document.getElementById('ee-publish-review-body');
    if (body) body.innerHTML = renderReviewBody();
    renderReviewNext();
  }

  async function init() {
    loadSeriesMeta();
    if (!eventIds.length) {
      showAlert('No events to review. Go back and save your event dates first.', 'warn');
      return;
    }

    bindUi();

    const loading = window.organiserPageLoading;
    let ok = false;
    if (loading && loading.run) {
      ok = await loading.run('Loading review', loadData);
    } else {
      if (loading) loading.show('Loading review');
      ok = await loadData();
      if (loading) loading.hide();
    }

    if (!ok) {
      showAlert(
        'This event was deleted or is no longer available. Go back to My Events and open a current listing.',
        'warn'
      );
      return;
    }

    if (!displayTiers().length) {
      showAlert('No ticket types found — go back and set up tickets before publishing.', 'warn');
    }

    renderReview();
  }

  init().catch(function (err) {
    console.error(err);
    showAlert('Could not load review. Refresh the page or go back to ticket setup.', 'warn');
  });
})();
