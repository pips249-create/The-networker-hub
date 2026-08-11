/**
 * Review step before publishing an event listing.
 */
(function () {
  const SERIES_STORAGE_KEY = 'hub_event_series';
  const PUBLISHED_PREVIEW_KEY = 'hub_event_published_preview';
  const REVIEW_REFUND_KEY = 'hub_event_review_refund';
  const TICKET_DRAFT_KEY = 'hub_ticket_setup_draft';
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
  let paymentSetupState = null;

  const FORMAT_LABELS = {
    'in-person': 'In person',
    online: 'Online',
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
  const DEFAULT_PAID_REFUND = {
    refundPolicy: 'full_refund',
    refundCutoffDays: 7,
    refundPolicyDetails: '',
  };

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
    const urlIds = eventIds.slice();
    const hadUrlIds = urlIds.length > 0;
    try {
      const raw = sessionStorage.getItem(SERIES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const storedIds = (Array.isArray(parsed.eventIds) ? parsed.eventIds : [])
        .map(function (id) {
          return String(id).trim();
        })
        .filter(Boolean);
      if (!hadUrlIds) {
        seriesMeta = { ...seriesMeta, ...parsed };
        if (storedIds.length) eventIds = storedIds;
        return;
      }
      const sameIds =
        storedIds.length === urlIds.length &&
        urlIds.every(function (id) {
          return storedIds.includes(id);
        });
      const urlIsSubsetOfStored =
        storedIds.length > urlIds.length &&
        urlIds.every(function (id) {
          return storedIds.includes(id);
        });
      if (sameIds || urlIsSubsetOfStored) {
        seriesMeta = { ...seriesMeta, ...parsed };
        if (urlIsSubsetOfStored) eventIds = storedIds.slice();
      }
    } catch {
      /* ignore */
    }
  }

  function persistSeriesMeta() {
    try {
      const next = {
        ...seriesMeta,
        eventIds: eventIds.slice(),
        events:
          seriesMeta.events && seriesMeta.events.length
            ? seriesMeta.events
            : eventIds.map(function (id) {
                return { id: id };
              }),
      };
      seriesMeta = next;
      sessionStorage.setItem(SERIES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
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

  function paymentSetupReturnPath() {
    const qs = new URLSearchParams();
    if (eventIds.length) qs.set('ids', eventIds.join(','));
    return '/organiser/event-review?' + qs.toString();
  }

  function paymentGroupForSeries() {
    if (!paymentSetupState) return null;
    return (
      window.HubOrganiserPaymentSetup?.groupForEvent(
        paymentSetupState,
        seriesMeta.organiserGroupId || anchorEvent?.organiserGroupId
      ) || paymentSetupState.primaryGroup
    );
  }

  function needsBankDetailsForPublish() {
    const tiers = displayTiers();
    const alumniFastPass = alumniFastPassFromLoaded(anchorEvent, loadedTickets);
    const hasPaid = tiersHavePaidPrice(tiers, alumniFastPass);
    if (!hasPaid) return false;
    if (!paymentSetupState || !window.HubOrganiserPaymentSetup) return false;
    return window.HubOrganiserPaymentSetup.groupNeedsSetup(
      paymentSetupState,
      paymentGroupForSeries()
    );
  }

  async function loadPaymentSetupState(options) {
    if (!window.HubOrganiserPaymentSetup) {
      paymentSetupState = null;
      return;
    }
    paymentSetupState = await window.HubOrganiserPaymentSetup.fetchState(options || {});
  }

  async function handleReviewPaymentLinked(status) {
    await loadPaymentSetupState({ bypassCache: true });
    if (status && status.ready === false) {
      showAlert(
        status.incompleteHint ||
          'Bank details were linked, but Stripe still needs a few steps. Click Add bank details to finish.',
        'warn'
      );
    } else {
      showAlert('Bank details linked — you can publish paid tickets now.', 'ok');
    }
    refreshReviewPaymentSetup();
    renderReviewNext();
  }

  function refreshReviewPaymentSetup() {
    const mount = document.getElementById('ee-payment-setup-mount');
    const payment = window.HubOrganiserPaymentSetup;
    const confirmBtn = document.getElementById('ee-review-confirm');
    const lede = document.querySelector('.ee-publish-review-lede');
    if (!mount || !payment || !paymentSetupState) {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.removeAttribute('aria-disabled');
        confirmBtn.title = '';
        confirmBtn.dataset.bankBlocked = '';
      }
      return;
    }

    const bankPending = needsBankDetailsForPublish();
    if (!bankPending) {
      mount.hidden = true;
      mount.innerHTML = '';
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.removeAttribute('aria-disabled');
        confirmBtn.title = '';
        confirmBtn.textContent = 'Confirm & publish';
        confirmBtn.dataset.bankBlocked = '';
      }
      if (lede) {
        lede.textContent =
          'Check everything looks right. Once you publish, your listing goes live automatically and ticket sales can start straight away.';
      }
      return;
    }

    payment.renderInto(mount, paymentSetupState, paymentGroupForSeries(), {
      returnPath: paymentSetupReturnPath(),
      buttonClass: 'hub-payment-setup-btn ee-btn ee-btn-primary',
      title: 'Add bank details before publishing paid tickets',
      lead:
        'This listing has paid tickets. Connect your UK bank account via Stripe, then return here to publish. Free events do not need bank details.',
      singleGroupOnly: true,
      onLinked: handleReviewPaymentLinked,
    });
    if (confirmBtn) {
      // Keep clickable so it scrolls to the bank CTA instead of a dead control.
      confirmBtn.disabled = false;
      confirmBtn.removeAttribute('aria-disabled');
      confirmBtn.title = 'Add bank details before publishing paid tickets';
      confirmBtn.textContent = 'Add bank details to publish';
      confirmBtn.dataset.bankBlocked = '1';
    }
    if (lede) {
      lede.textContent =
        'Paid tickets need bank details before publish. Use Add bank details below — Confirm & publish unlocks when Stripe setup is finished.';
    }
  }

  async function handleStripeConnectReturn() {
    const connectParam = new URLSearchParams(window.location.search).get('stripe_connect');
    if (connectParam !== 'return' && connectParam !== 'refresh') return;
    const group = paymentGroupForSeries();
    let status = null;
    if (group?.id) {
      const { ok, data } = await api(
        '/api/organiser/stripe-connect?groupId=' + encodeURIComponent(group.id)
      );
      status = ok ? data : null;
      await loadPaymentSetupState({ bypassCache: true });
    }
    if (status && status.ready) {
      showAlert('Bank details saved — you can publish paid tickets now.', 'ok');
    } else {
      showAlert(
        (status && status.incompleteHint) ||
          'Stripe setup is not finished yet. Click Add bank details again to complete identity and bank account.',
        'warn'
      );
    }
    if (window.history.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.delete('stripe_connect');
      window.history.replaceState({}, '', url.pathname + '?' + url.searchParams.toString());
    }
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
    if (key.includes('online') && !key.includes('person')) return 'online';
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
    const refund = hasPaid ? reviewRefundContext() : null;
    const refundLabel = hasPaid ? reviewRefundPresetLabel(refund) : '';
    const vatLabel = hasPaid ? reviewVatLabel(refund?.vatTreatment || anchorEvent?.vatTreatment) : '';
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
      '/organiser/event-edit',
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
            esc(vatLabel) +
            ' · Refund policy: ' +
            esc(refundLabel) +
            (refund?.usedDefaultRefund
              ? ' · <span class="ee-publish-review-note">Default policy — edit tickets to change</span>'
              : '') +
            '</p>'
          : '<p class="ee-publish-review-sub">Free event — no VAT or refund policy required</p>'),
      ticketsPageUrl(),
      'Edit tickets'
    );
    return html;
  }

  function renderReviewNext() {
    const nextEl = document.getElementById('ee-publish-review-next');
    if (!nextEl) return;

    if (needsBankDetailsForPublish()) {
      nextEl.textContent =
        'Confirm & publish is blocked until bank details are added. Use Add bank details above, finish Stripe in the new tab, then return here.';
      return;
    }

    const tiers = displayTiers();
    const scheduled = tiers.some(function (tier) {
      if (!tier.saleStart) return false;
      const start = new Date(tier.saleStart);
      return !Number.isNaN(start.getTime()) && start > Date.now();
    });
    let text = 'Your listing goes live automatically on Browse events';
    if (scheduled) {
      text += ' and ticket sales open on the start dates you set';
    } else {
      text += ' and ticket sales go live straight away';
    }
    text += '. You can still edit most details from My Events before the first date.';
    nextEl.textContent = text;
  }

  function ticketDraftStorageKey() {
    return TICKET_DRAFT_KEY + ':' + (eventIds.slice().sort().join(',') || 'none');
  }

  function readTicketDraftRefund() {
    try {
      const raw = sessionStorage.getItem(ticketDraftStorageKey());
      if (!raw) return null;
      const draft = JSON.parse(raw);
      const draftIds = (draft.eventIds || []).slice().sort().join(',');
      const currentIds = eventIds.slice().sort().join(',');
      if (draftIds !== currentIds) return null;
      const refund = draft.refund;
      if (!refund || typeof refund !== 'object') return null;
      return {
        refundPolicy: refund.refundPolicy,
        refundPolicyDetails: refund.refundPolicyDetails || '',
        refundCutoffDays: refund.refundCutoffDays,
        refundTermsAgreed: Boolean(refund.refundTermsAgreed),
        vatTreatment: draft.vatTreatment || '',
      };
    } catch {
      return null;
    }
  }

  function reviewRefundPresetLabel(refund) {
    const preset = inferRefundPresetFromStored(
      refund?.refundPolicy,
      refund?.refundCutoffDays,
      refund?.refundPolicyDetails
    );
    if (preset && REFUND_LABELS[preset]) return REFUND_LABELS[preset];
    if (refund?.refundPolicy === 'no_refunds') return REFUND_LABELS.non_refundable;
    if (refund?.usedDefaultRefund) return 'Standard (default)';
    return 'Selected';
  }

  function reviewVatLabel(vatTreatment) {
    const v = String(vatTreatment || '').trim();
    if (v === 'added') return 'added at checkout';
    if (v === 'none') return 'not VAT registered (no VAT charged)';
    return 'included in ticket price';
  }

  function storedRefundMatchesCurrent(stored) {
    if (!stored || !Array.isArray(stored.eventIds) || !stored.eventIds.length) return false;
    const storedSet = new Set(
      stored.eventIds.map(function (id) {
        return String(id || '').trim();
      })
    );
    return eventIds.some(function (id) {
      return storedSet.has(String(id || '').trim());
    });
  }

  function reviewRefundContext() {
    const fromEvent = {
      refundPolicy: anchorEvent?.refundPolicy,
      refundPolicyDetails: anchorEvent?.refundPolicyDetails || '',
      refundCutoffDays: anchorEvent?.refundCutoffDays,
      refundTermsAgreed: Boolean(
        anchorEvent?.refundTermsAgreed || anchorEvent?.refundTermsAgreedAt
      ),
      vatTreatment: anchorEvent?.vatTreatment,
    };
    let merged = { ...fromEvent };
    try {
      const raw = sessionStorage.getItem(REVIEW_REFUND_KEY);
      if (raw) {
        const stored = JSON.parse(raw);
        if (storedRefundMatchesCurrent(stored)) {
          merged = {
            refundPolicy: stored.refundPolicy || merged.refundPolicy,
            refundPolicyDetails: stored.refundPolicyDetails || merged.refundPolicyDetails,
            refundCutoffDays:
              stored.refundCutoffDays != null ? stored.refundCutoffDays : merged.refundCutoffDays,
            refundTermsAgreed: Boolean(stored.refundTermsAgreed || merged.refundTermsAgreed),
            vatTreatment: stored.vatTreatment || merged.vatTreatment,
          };
        }
      }
    } catch {
      /* ignore */
    }
    if (!String(merged.refundPolicy || '').trim()) {
      const draft = readTicketDraftRefund();
      if (draft) {
        merged = {
          refundPolicy: draft.refundPolicy || merged.refundPolicy,
          refundPolicyDetails: draft.refundPolicyDetails || merged.refundPolicyDetails,
          refundCutoffDays:
            draft.refundCutoffDays != null ? draft.refundCutoffDays : merged.refundCutoffDays,
          refundTermsAgreed: Boolean(draft.refundTermsAgreed || merged.refundTermsAgreed),
          vatTreatment: draft.vatTreatment || merged.vatTreatment,
        };
      }
    }
    let usedDefaultRefund = false;
    if (!String(merged.refundPolicy || '').trim()) {
      merged.refundPolicy = DEFAULT_PAID_REFUND.refundPolicy;
      merged.refundPolicyDetails = DEFAULT_PAID_REFUND.refundPolicyDetails;
      merged.refundCutoffDays = DEFAULT_PAID_REFUND.refundCutoffDays;
      usedDefaultRefund = true;
    }
    merged.usedDefaultRefund = usedDefaultRefund;
    return merged;
  }

  function buildPublishBody() {
    const tiers = ticketsForPublish(loadedTickets);
    const alumniFastPass = alumniFastPassFromLoaded(anchorEvent, loadedTickets);
    const hasPaid = tiersHavePaidPrice(tiers, alumniFastPass);
    const refund = hasPaid ? reviewRefundContext() : null;
    const body = {
      eventIds: eventIds.slice(),
      tickets: tiers,
      publish: true,
      attendanceMode: String(anchorEvent?.attendanceMode || 'tickets').trim(),
      guestPassesDisabled: Boolean(anchorEvent?.guestPassesDisabled),
      alumniFastPass: alumniFastPass,
      vatTreatment: hasPaid ? String(refund?.vatTreatment || anchorEvent?.vatTreatment || '').trim() : '',
      attendeeExtras: {
        foodIncluded: Boolean(anchorEvent?.foodIncluded),
        collectDietary: Boolean(anchorEvent?.collectDietary),
        collectAccessibility: Boolean(anchorEvent?.collectAccessibility),
      },
    };
    if (hasPaid && refund) {
      body.refundPolicy = refund.refundPolicy;
      body.refundPolicyDetails = refund.refundPolicyDetails || '';
      body.refundCutoffDays = refund.refundCutoffDays;
      body.refundTermsAgreed = Boolean(refund.refundTermsAgreed);
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
          seriesGroupId: ev.seriesGroupId || '',
        });
      });
    }

    seriesMeta.events = eventIds
      .map(function (id) {
        return byId.get(id);
      })
      .filter(Boolean);
    persistSeriesMeta();
  }

  async function expandSeriesEventIds(anchor) {
    if (eventIds.length > 1) {
      persistSeriesMeta();
      return;
    }
    const seriesGroupId = String(
      (anchor && anchor.seriesGroupId) ||
        (seriesMeta.events && seriesMeta.events[0] && seriesMeta.events[0].seriesGroupId) ||
        ''
    ).trim();
    if (!seriesGroupId) return;

    const res = await api(
      '/api/organiser/events?seriesGroupId=' + encodeURIComponent(seriesGroupId)
    );
    if (!(res.ok && Array.isArray(res.data.events) && res.data.events.length > 1)) {
      persistSeriesMeta();
      return;
    }
    const sorted = res.data.events.slice().sort(function (a, b) {
      return new Date(a.date || 0) - new Date(b.date || 0);
    });
    eventIds = sorted.map(function (ev) {
      return ev.id;
    }).filter(Boolean);
    seriesMeta.events = sorted.map(function (ev) {
      return {
        id: ev.id,
        title: ev.title,
        date: ev.date,
        endDate: ev.endDate || '',
        imageUrl: ev.imageUrl || seriesMeta.imageUrl || '',
        imagePosition: ev.imagePosition || seriesMeta.imagePosition || '',
        seriesGroupId: ev.seriesGroupId || seriesGroupId,
      };
    });
    seriesMeta.eventIds = eventIds.slice();
    persistSeriesMeta();
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

    await expandSeriesEventIds(anchorEvent);
    await hydrateSeriesEvents();
    await Promise.all([
      loadOrganiserGroup(seriesMeta.organiserGroupId || anchorEvent.organiserGroupId),
      loadPaymentSetupState(),
    ]);
    await handleStripeConnectReturn();
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
      sessionStorage.removeItem(REVIEW_REFUND_KEY);
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
    publishedQs.set('published', '1');
    if (publishedTitle) publishedQs.set('title', publishedTitle);
    const publishedUrl = '/organiser/event-published?' + publishedQs.toString();

    try {
      if (window.HubOrganiserLaunchSetup) {
        const famKey =
          (seriesMeta && seriesMeta.familyKey) ||
          (eventIds[0] ? 'ev:' + eventIds[0] : '');
        if (famKey) window.HubOrganiserLaunchSetup.markEventFamilyDone(famKey);
        if (eventIds[0]) window.HubOrganiserLaunchSetup.markEventFamilyDone('ev:' + eventIds[0]);
      }
    } catch {
      /* ignore */
    }

    if (isEmbedDrawer && window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'hub-event-tickets-done',
          eventIds: eventIds.slice(),
          eventId: eventIds[0] || '',
          title: publishedTitle,
          imageUrl: publishedImage,
          publishedUrl: publishedUrl,
          launchSetup: Boolean(seriesMeta && seriesMeta.launchSetup),
          familyKey:
            (seriesMeta && seriesMeta.familyKey) ||
            (eventIds[0] ? 'ev:' + eventIds[0] : ''),
        },
        window.location.origin
      );
      return;
    }

    location.href = publishedUrl;
  }

  function resetPublishUi() {
    const confirmBtn = document.getElementById('ee-review-confirm');
    const backBtn = document.getElementById('ee-review-back');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      if (needsBankDetailsForPublish()) {
        confirmBtn.textContent = 'Add bank details to publish';
        confirmBtn.title = 'Add bank details before publishing paid tickets';
        confirmBtn.dataset.bankBlocked = '1';
      } else {
        confirmBtn.textContent = 'Confirm & publish';
        confirmBtn.title = '';
        confirmBtn.dataset.bankBlocked = '';
      }
    }
    if (backBtn) backBtn.removeAttribute('aria-disabled');
  }

  function setPublishUiBusy() {
    const confirmBtn = document.getElementById('ee-review-confirm');
    const backBtn = document.getElementById('ee-review-back');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Publishing…';
    }
    if (backBtn) backBtn.setAttribute('aria-disabled', 'true');
  }

  async function publishListing() {
    showAlert('');

    if (!loadedTickets.length) {
      showAlert('No ticket types found — go back and set up tickets before publishing.', 'warn');
      return;
    }

    if (needsBankDetailsForPublish()) {
      showAlert(
        'Add bank details before publishing paid tickets — use the Add bank details button above, finish Stripe, then try again.',
        'warn'
      );
      refreshReviewPaymentSetup();
      const setupBtn = document.querySelector(
        '#ee-payment-setup-mount [data-payment-setup], #ee-payment-setup-mount [data-payment-link]'
      );
      if (setupBtn && typeof setupBtn.focus === 'function') {
        try {
          setupBtn.focus();
        } catch {
          /* ignore */
        }
      }
      document.getElementById('ee-payment-setup-mount')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
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

    setPublishUiBusy();

    const loading = window.organiserPageLoading;
    let result;
    try {
      const body = buildPublishBody();
      const tiers = ticketsForPublish(loadedTickets);
      const alumniFastPass = alumniFastPassFromLoaded(anchorEvent, loadedTickets);
      const hasPaid = tiersHavePaidPrice(tiers, alumniFastPass);

      if (hasPaid && !String(body.refundPolicy || '').trim()) {
        showAlert('Select a refund policy on the tickets step, then try again.', 'warn');
        return;
      }
      if (hasPaid && !String(body.vatTreatment || '').trim()) {
        showAlert('Choose how VAT applies to ticket prices on the tickets step, then try again.', 'warn');
        return;
      }
      if (hasPaid && !body.refundTermsAgreed) {
        showAlert(
          'Go back to ticket setup, choose your refund policy, and tick the refund responsibility checkbox — then return here to publish.',
          'warn'
        );
        return;
      }

      const publishWork = function () {
        return api('/api/organiser/tickets', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      };

      if (loading && loading.run) {
        result = await loading.run('Creating and publishing your event', publishWork, {
          progressStep: 'publish',
        });
      } else {
        if (loading) loading.show('Creating and publishing your event');
        result = await publishWork();
        if (loading) loading.hide();
      }

      if (!result.ok) {
        const data = result.data || {};
        if (
          data.error === 'stripe_connect_required' ||
          /connect stripe|bank details/i.test(String(data.message || ''))
        ) {
          showAlert(
            data.message ||
              'Add bank details before publishing paid tickets — use Add bank details above, then try again.',
            'warn'
          );
          await loadPaymentSetupState({ bypassCache: true });
          refreshReviewPaymentSetup();
          document.getElementById('ee-payment-setup-mount')?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
          return;
        }
        showAlert(data.message || data.error || 'Could not publish your event', 'warn');
        return;
      }

      redirectAfterPublish();
    } finally {
      resetPublishUi();
    }
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

  function removeStaleReviewRefundCheck() {
    document.getElementById('ee-review-refund-check')?.remove();
  }

  function renderReview() {
    removeStaleReviewRefundCheck();
    const body = document.getElementById('ee-publish-review-body');
    if (body) body.innerHTML = renderReviewBody();
    refreshReviewPaymentSetup();
    renderReviewNext();
  }

  async function init() {
    loadSeriesMeta();
    if (!eventIds.length) {
      showAlert('No events to review. Go back and save your event dates first.', 'warn');
      return;
    }

    bindUi();
    removeStaleReviewRefundCheck();

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

    if (isEmbedDrawer && window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: 'hub-event-drawer-ready', progressStep: 'publish' },
        window.location.origin
      );
    }
  }

  init().catch(function (err) {
    console.error(err);
    showAlert('Could not load review. Refresh the page or go back to ticket setup.', 'warn');
  });
})();
