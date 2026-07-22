/**
 * Post-publish confirmation — listing preview + social share.
 */
(function () {
  const featuredPlanDuration = document.getElementById('ep-featured-plan-duration');

  function applyFeaturedQuote(quote) {
    if (!quote) return;
    document.querySelectorAll('.ep-featured-plan-price').forEach(function (el) {
      el.textContent = quote.displayPrice || '£55.00';
    });
    if (featuredPlanDuration) {
      featuredPlanDuration.textContent =
        quote.pricingMode === 'prorated' ? 'until your event' : 'per month';
    }
    if (featuredDurationNote && quote.pricingNote) {
      featuredDurationNote.textContent = quote.pricingNote;
      featuredDurationNote.hidden = false;
    }
  }

  async function loadFeaturedQuote() {
    if (!primaryId) return;
    try {
      const res = await fetch(
        '/api/organiser/event-featured-quote?eventId=' +
          encodeURIComponent(primaryId) +
          '&planId=' +
          encodeURIComponent(selectedPlanId()),
        { credentials: 'include', cache: 'no-store' }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.quote) applyFeaturedQuote(data.quote);
    } catch {
      /* non-fatal */
    }
  }

  const PUBLISHED_PREVIEW_KEY = 'hub_event_published_preview';

  function readPublishedPreview(ids) {
    try {
      const raw = sessionStorage.getItem(PUBLISHED_PREVIEW_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const storedIds = String(data.ids || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const currentIds = (ids || []).map((s) => String(s).trim()).filter(Boolean);
      if (
        storedIds.length &&
        currentIds.length &&
        storedIds.join(',') === currentIds.join(',')
      ) {
        return data;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  const params = new URLSearchParams(location.search);
  const eventIds = (params.get('ids') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const primaryId = eventIds[0] || '';
  const previewStash = readPublishedPreview(eventIds);
  const urlImage = params.get('image') || '';
  const fallbackTitle = (previewStash && previewStash.title) || params.get('title') || '';
  const fallbackImage =
    (previewStash && previewStash.image) ||
    (urlImage && !/^data:/i.test(urlImage) && urlImage.length <= 2048 ? urlImage : '');
  if (previewStash) {
    try {
      sessionStorage.removeItem(PUBLISHED_PREVIEW_KEY);
    } catch {
      /* ignore */
    }
  }
  const featuredCancelled = params.get('featured') === 'cancelled';
  const extendFeatured = params.get('extend') === 'featured';

  const featuredUpsell = document.getElementById('ep-featured-upsell');
  const featuredHeading = document.getElementById('ep-featured-heading');
  const featuredLede = document.getElementById('ep-featured-lede');
  const featuredYes = document.getElementById('ep-featured-yes');
  const featuredError = document.getElementById('ep-featured-error');
  const featuredSlotStatus = document.getElementById('ep-featured-slot-status');
  const featuredDurationNote = document.getElementById('ep-featured-duration-note');
  const featuredPreviewCard = document.getElementById('ep-featured-preview-card');

  let eventStartIso = '';

  function featuredStartCapFromSeries(seriesDates) {
    if (!Array.isArray(seriesDates) || seriesDates.length <= 1) return '';
    const now = Date.now();
    let maxMs = null;
    seriesDates.forEach(function (entry) {
      const raw = entry.dateRaw || entry.date;
      if (!raw) return;
      const ms = new Date(raw).getTime();
      if (Number.isNaN(ms) || ms <= now) return;
      if (maxMs == null || ms > maxMs) maxMs = ms;
    });
    return maxMs != null ? new Date(maxMs).toISOString() : '';
  }

  function applyFeaturedStartIso(iso, seriesDates) {
    eventStartIso = featuredStartCapFromSeries(seriesDates) || iso || '';
    updateFeaturedDurationNote();
  }

  const origin = location.origin;
  let listingUrl = primaryId
    ? origin + '/events/event?id=' + encodeURIComponent(primaryId)
    : origin + '/events/';
  let sharePack = null;
  let sharePackPromise = null;
  let shareCardDataUrl = '';

  const sharePackEl = document.getElementById('ep-share-pack');
  const shareImagePreview = document.getElementById('ep-share-image-preview');
  const shareImageLoading = document.getElementById('ep-share-image-loading');
  const downloadImageBtn = document.getElementById('ep-download-image');
  const shareQuickLinkedIn = document.getElementById('ep-share-linkedin');
  const shareQuickFacebook = document.getElementById('ep-share-facebook');
  const shareQuickX = document.getElementById('ep-share-x');
  const shareQuickWhatsapp = document.getElementById('ep-share-whatsapp');
  const shareQuickEmail = document.getElementById('ep-share-email');

  const META_PIN_SVG =
    '<svg class="premium-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  const META_CAL_SVG =
    '<svg class="premium-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></svg>';

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function plainDescription(text) {
    let s = String(text || '').trim();
    if (!s) return '';
    if (s.startsWith('{') && s.endsWith('}')) {
      try {
        const obj = JSON.parse(s);
        if (obj && typeof obj === 'object' && 'foodIncluded' in obj) return '';
      } catch {
        /* keep */
      }
    }
    const m = s.match(/\n\n(\{[\s\S]*\})\s*$/);
    if (m) {
      try {
        const obj = JSON.parse(m[1]);
        if (obj && typeof obj === 'object' && 'foodIncluded' in obj) {
          s = s.slice(0, m.index).trim();
        }
      } catch {
        /* keep */
      }
    }
    return s;
  }

  function buildListingUrl(ev) {
    const slug = ev && ev.slug ? String(ev.slug).trim() : '';
    if (slug) {
      return origin + '/events/' + encodeURIComponent(slug);
    }
    const id = (ev && ev.id) || primaryId;
    if (id) {
      return origin + '/events/event?id=' + encodeURIComponent(id);
    }
    return origin + '/events/';
  }

  const promoteSection = document.getElementById('ep-promote-section');
  const viewListingLink = document.getElementById('ep-view-listing');
  const promoteJump = document.getElementById('ep-promote-jump');
  const justPublished = Boolean(previewStash);

  function isApprovedListing(ev) {
    const approval = String(
      (ev && ev.approvalStatus) ||
        (ev && ev.statusRaw) ||
        (ev && ev.listingStatusRaw) ||
        ''
    )
      .trim()
      .toLowerCase();
    return approval === 'approved';
  }

  function isPublishedListing(ev) {
    const status = String((ev && ev.status) || (ev && ev.listingStatus) || '')
      .trim()
      .toLowerCase();
    return status === 'published' || status === 'live';
  }

  function listingIsLive(ev) {
    return isApprovedListing(ev) && isPublishedListing(ev);
  }

  function setPromoteVisibility(isLive) {
    if (promoteSection) promoteSection.hidden = !isLive;
    if (promoteJump) promoteJump.hidden = !isLive;
    if (isLive && justPublished && promoteSection) {
      requestAnimationFrame(function () {
        promoteSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  function setShareUrls(title) {
    const urlInput = document.getElementById('ep-share-url');
    if (urlInput) urlInput.value = listingUrl;
    if (viewListingLink) viewListingLink.href = listingUrl;
    updateShareQuickLinks(title, sharePack && sharePack.caption);
  }

  function updateShareQuickLinks(title, caption) {
    const shareText = String(caption || title || 'My event').trim();
    const encodedUrl = encodeURIComponent(listingUrl);
    const shortText =
      shareText.length > 240 ? shareText.slice(0, 237).trim() + '…' : shareText;
    const encodedText = encodeURIComponent(shortText);

    if (shareQuickLinkedIn) {
      shareQuickLinkedIn.href =
        'https://www.linkedin.com/sharing/share-offsite/?url=' + encodedUrl;
    }
    if (shareQuickFacebook) {
      shareQuickFacebook.href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl;
    }
    if (shareQuickX) {
      shareQuickX.href =
        'https://twitter.com/intent/tweet?url=' + encodedUrl + '&text=' + encodedText;
    }
    if (shareQuickWhatsapp) {
      shareQuickWhatsapp.href =
        'https://wa.me/?text=' + encodeURIComponent(shareText + '\n\n' + listingUrl);
    }
    if (shareQuickEmail) {
      shareQuickEmail.href =
        'mailto:?subject=' +
        encodeURIComponent('Join my event on The Networker Hub') +
        '&body=' +
        encodeURIComponent(shareText + '\n\n' + listingUrl);
      shareQuickEmail.removeAttribute('target');
    }
  }

  function cardLocationForPreview(ev) {
    const city = String(ev.city || '').trim();
    if (city) return city.slice(0, 20);
    const loc = String(ev.location || ev.locationShort || '').trim();
    if (!loc) return 'TBC';
    return (loc.split(',')[0].trim() || loc).slice(0, 20);
  }

  function priceBadgeForPreview(ev) {
    if (ev.priceKey === 'free' || /^free$/i.test(String(ev.price || ''))) return 'Free';
    const n = Number(ev.priceNum != null ? ev.priceNum : ev.price);
    if (Number.isFinite(n) && n > 0) {
      const amt = n % 1 === 0 ? '£' + n.toFixed(0) : '£' + n.toFixed(2);
      return 'from ' + amt;
    }
    const label = String(ev.price || '').trim();
    return label || 'See listing';
  }

  function renderFeaturedSpotlightPreview(ev) {
    if (!featuredPreviewCard) return;

    const title = ev.title || fallbackTitle || 'Your event';
    const photo = ev.photo || ev.imageUrl || fallbackImage || '../assets/event-placeholder.svg';
    const dateLabel = formatDateLine(ev.date || ev.dateLine) || 'Date TBC';
    const locationLabel = cardLocationForPreview(ev);
    const priceLabel = priceBadgeForPreview(ev);

    featuredPreviewCard.innerHTML =
      '<article class="premium-card ep-featured-preview-card">' +
      '<div class="premium-card-link">' +
      '<div class="premium-card-media" aria-hidden="true">' +
      '<div class="premium-card-bg">' +
      '<img class="ep-featured-preview-img" src="' +
      esc(photo) +
      '" alt="" loading="lazy" decoding="async" />' +
      '</div>' +
      '<div class="premium-card-overlay"></div></div>' +
      '<div class="premium-card-top">' +
      '<span class="premium-badge">Premium</span>' +
      '<span class="premium-price">' +
      esc(priceLabel) +
      '</span></div>' +
      '<div class="premium-card-body">' +
      '<h3 class="premium-card-title">' +
      esc(title) +
      '</h3>' +
      '<div class="premium-card-meta">' +
      '<p class="premium-meta-row">' +
      META_PIN_SVG +
      '<span>' +
      esc(locationLabel) +
      '</span></p>' +
      '<p class="premium-meta-row">' +
      META_CAL_SVG +
      '<span>' +
      esc(dateLabel) +
      '</span></p>' +
      '</div></div></div></article>';
  }

  async function copyText(text, feedbackEl, originalLabel, copiedLabel) {
    if (!text) return false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        window.prompt('Copy this text:', text);
      }
      if (feedbackEl) {
        feedbackEl.hidden = false;
        feedbackEl.textContent = copiedLabel || 'Copied to clipboard';
        setTimeout(() => {
          feedbackEl.hidden = true;
        }, 2500);
      }
      return true;
    } catch {
      window.prompt('Copy this text:', text);
      return false;
    }
  }

  function setShareImageState({ loading, dataUrl }) {
    if (shareImageLoading) shareImageLoading.hidden = !loading;
    if (shareImagePreview) {
      if (dataUrl) {
        shareImagePreview.src = dataUrl;
        shareImagePreview.hidden = false;
      } else {
        shareImagePreview.hidden = true;
        shareImagePreview.removeAttribute('src');
      }
    }
    const ready = Boolean(dataUrl);
    if (downloadImageBtn) downloadImageBtn.disabled = !ready;
  }

  async function ensureSharePack(ev) {
    if (!window.HubOrganiserEventShare) return null;
    if (sharePackPromise) return sharePackPromise;
    sharePackPromise = (async function () {
      listingUrl = buildListingUrl(ev);
      const title = ev.title || fallbackTitle || 'Your event';
      const caption = window.HubOrganiserEventShare.buildPromoCaption(ev, listingUrl);
      sharePack = { title, url: listingUrl, caption };
      setShareUrls(title);

      const commsRoot = document.getElementById('ep-comms-preview');
      if (window.HubCommsPack && commsRoot) {
        if (sharePackEl) sharePackEl.hidden = false;
        window.HubCommsPack.bindCommsPack(commsRoot, sharePack);
      }

      setShareImageState({ loading: true, dataUrl: '' });
      shareCardDataUrl = '';
      try {
        shareCardDataUrl = await window.HubOrganiserEventShare.generatePromoCardDataUrl(ev);
        setShareImageState({ loading: false, dataUrl: shareCardDataUrl });
      } catch {
        setShareImageState({ loading: false, dataUrl: '' });
        if (shareImageLoading) {
          shareImageLoading.hidden = false;
          shareImageLoading.textContent =
            'Could not create image. You can still copy the caption and link.';
        }
      }
      return sharePack;
    })();
    return sharePackPromise;
  }

  function formatDateLine(raw) {
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function renderPreview(ev) {
    const loading = document.getElementById('ep-preview-loading');
    const card = document.getElementById('ep-listing-preview');
    const img = document.getElementById('ep-preview-img');
    const titleEl = document.getElementById('ep-preview-title');
    const metaEl = document.getElementById('ep-preview-meta');
    const descEl = document.getElementById('ep-preview-desc');
    const previewLink = document.getElementById('ep-preview-link');

    listingUrl = buildListingUrl(ev);

    const title = ev.title || fallbackTitle || 'Your event';
    const photo = ev.photo || ev.imageUrl || fallbackImage || '../assets/event-placeholder.svg';
    const meta = [formatDateLine(ev.date || ev.dateLine), ev.location, ev.meetingType || ev.format]
      .filter(Boolean)
      .join(' · ');

    if (img) {
      img.src = photo;
      img.alt = title;
      img.onerror = function () {
        this.onerror = null;
        this.src = '../assets/event-placeholder.svg';
      };
    }
    if (titleEl) titleEl.textContent = title;
    if (metaEl) metaEl.textContent = meta || 'See listing for details';
    if (descEl) {
      const d = plainDescription(ev.description);
      descEl.textContent =
        d.length > 220 ? d.slice(0, 217) + '…' : d || 'Your published listing is live on the hub.';
    }
    if (previewLink) previewLink.href = listingUrl;

    renderFeaturedSpotlightPreview(ev);

    if (loading) loading.hidden = true;
    if (card) card.hidden = false;

    const lead = document.getElementById('ep-lead');
    if (lead && eventIds.length > 1 && isApprovedListing(ev)) {
      lead.textContent =
        'Your ' +
        eventIds.length +
        ' dates are live on the hub. Preview the main listing below — then share it or choose featured placement if you like.';
    }

    setShareUrls(title);
    ensureSharePack({
      id: ev.id || primaryId,
      slug: ev.slug,
      title,
      description: plainDescription(ev.description),
      date: ev.date || ev.dateLine,
      starts_at: ev.starts_at || ev.date || ev.dateLine,
      location: ev.location,
      imageUrl: photo,
      photo,
      imagePosition: ev.imagePosition || ev.photoPosition,
      organiserName: ev.organiserName || ev.groupName,
      organiserLogo: ev.organiserLogo,
    });
  }

  async function fetchPreview() {
    const previewHint = document.getElementById('ep-preview-hint');
    const lead = document.getElementById('ep-lead');

    function markLiveOnBrowse() {
      const title = document.getElementById('ep-title');
      if (title) title.textContent = 'Your listing is live';
      if (previewHint) {
        previewHint.textContent = 'This is how your event appears on the browse page.';
      }
      if (lead) {
        lead.textContent =
          'Attendees can find your event on the hub. Preview your listing below — then share it or choose featured placement if you like.';
      }
      setPromoteVisibility(true);
    }

    function markPendingApproval() {
      const title = document.getElementById('ep-title');
      if (title) title.textContent = 'Finish your listing to go live';
      if (previewHint) {
        previewHint.textContent =
          'Complete any missing event details and publish again to appear on the browse page.';
      }
      if (lead) {
        lead.textContent =
          'Your event is saved but is not on the public browse page yet. Check tickets, refund policy, VAT, and event details, then publish again.';
      }
      setPromoteVisibility(false);
    }

    if (!primaryId) {
      renderPreview({
        title: fallbackTitle,
        photo: fallbackImage,
        description: '',
      });
      markPendingApproval();
      return;
    }

    try {
      const res = await fetch(
        '/api/organiser/events?id=' + encodeURIComponent(primaryId),
        { credentials: 'include', cache: 'no-store' }
      );
      const data = await res.json();
      if (data.event) {
        const approved = listingIsLive(data.event);
        if (approved) markLiveOnBrowse();
        else markPendingApproval();
        applyFeaturedStartIso(data.event.date || data.event.starts_at || '');
        renderPreview({
          id: data.event.id,
          slug: data.event.slug,
          title: data.event.title,
          description: data.event.description,
          date: data.event.date,
          location: data.event.location,
          imageUrl: data.event.imageUrl,
          photo: data.event.imageUrl,
          imagePosition: data.event.imagePosition,
          organiserName: data.event.organiserName || data.event.groupName,
          organiserLogo: data.event.organiserLogo,
          approvalStatus: data.event.approvalStatus,
        });
        if (data.event.seriesGroupId) {
          try {
            const hubRes = await fetch('/api/hub-listings?id=' + encodeURIComponent(primaryId), {
              cache: 'no-store',
            });
            const hubData = await hubRes.json();
            if (hubData.seriesDates && hubData.seriesDates.length > 1) {
              applyFeaturedStartIso(data.event.date || data.event.starts_at || '', hubData.seriesDates);
            }
          } catch {
            /* optional series enrichment */
          }
        }
        return;
      }
    } catch {
      /* fall through */
    }

    try {
      const res = await fetch('/api/hub-listings?id=' + encodeURIComponent(primaryId), {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.event) {
        markLiveOnBrowse();
        applyFeaturedStartIso(
          data.event.date || data.event.dateRaw || data.event.starts_at || '',
          data.seriesDates
        );
        renderPreview(data.event);
        return;
      }
      markPendingApproval();
    } catch {
      markPendingApproval();
    }

    renderPreview({
      title: fallbackTitle,
      photo: fallbackImage,
      description: '',
    });
  }

  document.getElementById('ep-copy-link')?.addEventListener('click', async () => {
    const feedback = document.getElementById('ep-copy-feedback');
    const copied = await copyText(listingUrl, feedback, '', 'Link copied to clipboard');
    if (!copied) {
      const input = document.getElementById('ep-share-url');
      if (input) {
        input.select();
        document.execCommand('copy');
        if (feedback) feedback.hidden = false;
      }
    }
  });

  document.getElementById('ep-copy-caption')?.addEventListener('click', async () => {
    const feedback = document.getElementById('ep-copy-feedback');
    const btn = document.getElementById('ep-copy-caption');
    const original = btn ? btn.textContent : '';
    const copied = await copyText(sharePack && sharePack.caption, feedback, '', 'Caption copied to clipboard');
    if (copied && btn) {
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = original || 'Copy social post';
      }, 2000);
    }
  });

  function downloadShareImage() {
    if (!shareCardDataUrl || !window.HubOrganiserEventShare) return;
    const name =
      window.HubOrganiserEventShare.safeFilename(sharePack && sharePack.title) + '-event-promo.png';
    window.HubOrganiserEventShare.downloadPngDataUrl(shareCardDataUrl, name);
  }

  downloadImageBtn?.addEventListener('click', downloadShareImage);

  function selectedPlanId() {
    const checked = document.querySelector('input[name="featured-plan"]:checked');
    const hidden = document.querySelector('input[name="featured-plan"][type="hidden"]');
    if (checked) return checked.value;
    if (hidden) return hidden.value;
    return '1month';
  }

  function updateFeaturedDurationNote() {
    if (!featuredDurationNote) return;
    if (!eventStartIso) {
      featuredDurationNote.hidden = true;
      featuredDurationNote.textContent = '';
      return;
    }
    loadFeaturedQuote();
  }

  if (extendFeatured && featuredHeading) {
    featuredHeading.textContent = 'Extend your featured listing';
  }
  if (extendFeatured && featuredLede) {
    featuredLede.innerHTML =
      'Your featured placement is ending soon. Extend to keep premium visibility — from <strong>£55 per month</strong>, prorated when your event is sooner.';
  }

  if (featuredCancelled && featuredError) {
    featuredError.hidden = false;
    featuredError.textContent =
      'Checkout was cancelled — your event is still live. You can feature it any time from this page.';
  }

  async function startFeaturedCheckout() {
    if (!primaryId) {
      if (featuredError) {
        featuredError.hidden = false;
        featuredError.textContent =
          'Missing event id — refresh the page or open your event from the dashboard.';
      }
      return;
    }

    if (featuredYes) {
      featuredYes.disabled = true;
      featuredYes.textContent = 'Opening secure checkout…';
    }
    if (featuredError) featuredError.hidden = true;

    try {
      const res = await fetch('/api/organiser/event-featured-checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: primaryId, planId: selectedPlanId() }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok && data.url) {
        location.href = data.url;
        return;
      }

      const msg =
        data.error === 'stripe_not_configured'
          ? 'Stripe is not configured for local checkout. Add STRIPE_SECRET_KEY=sk_test_… to local.env, run npm run sync-env, restart npm start, then try again. Your event is still live.'
          : data.error === 'event_already_started'
            ? data.message ||
              'This event has already started — featured placement only runs while it appears on the events browse page.'
          : data.error === 'featured_slots_full'
            ? data.message ||
              'All featured spotlight places are currently taken. Your event stays live — try again when a slot opens.'
            : data.message || data.error || 'Could not start checkout. Your event is still live.';
      if (featuredError) {
        featuredError.hidden = false;
        featuredError.textContent = msg;
      }
    } catch {
      if (featuredError) {
        featuredError.hidden = false;
        featuredError.textContent = 'Could not reach checkout. Your event is still live.';
      }
    }

    if (featuredYes) {
      featuredYes.disabled = false;
      featuredYes.textContent = extendFeatured
        ? 'Yes — extend featured listing'
        : 'Yes — feature my event';
    }
  }

  if (extendFeatured && featuredYes) {
    featuredYes.textContent = 'Yes — extend featured listing';
  }

  if (featuredYes) featuredYes.addEventListener('click', startFeaturedCheckout);

  async function loadFeaturedSlotStatus() {
    if (!featuredUpsell) return;
    try {
      const res = await fetch('/api/hub-listings?meta=featured-slots', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.featuredSlots) return;
      const slots = data.featuredSlots;
      if (featuredSlotStatus && slots.available > 0 && slots.available <= 3) {
        featuredSlotStatus.hidden = false;
        featuredSlotStatus.textContent =
          slots.available === 1
            ? 'Only 1 featured spotlight place left right now.'
            : 'Only ' + slots.available + ' featured spotlight places left right now.';
      }
      if (slots.full && !extendFeatured) {
        if (featuredSlotStatus) {
          featuredSlotStatus.hidden = false;
          featuredSlotStatus.textContent =
            'All ' + slots.max + ' featured spotlight places are taken at the moment. Your event stays live — check back soon.';
        }
        if (featuredYes) {
          featuredYes.disabled = true;
          featuredYes.textContent = 'Featured spotlight full';
        }
      }
    } catch {
      /* non-fatal */
    }
  }

  loadFeaturedSlotStatus();

  setShareUrls(fallbackTitle);
  fetchPreview();
})();
