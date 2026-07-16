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
  const featuredSkip = document.getElementById('ep-featured-skip');
  const featuredError = document.getElementById('ep-featured-error');
  const featuredSlotStatus = document.getElementById('ep-featured-slot-status');
  const featuredDurationNote = document.getElementById('ep-featured-duration-note');

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
  let shareEventData = null;
  let shareModalPlatform = '';

  const sharePackEl = document.getElementById('ep-share-pack');
  const shareImagePreview = document.getElementById('ep-share-image-preview');
  const shareImageLoading = document.getElementById('ep-share-image-loading');
  const downloadImageBtn = document.getElementById('ep-download-image');
  const shareModal = document.getElementById('ep-share-modal');
  const shareModalPreview = document.getElementById('ep-share-modal-preview');
  const shareModalLoading = document.getElementById('ep-share-modal-loading');
  const shareModalCaption = document.getElementById('ep-share-modal-caption');
  const shareModalDownload = document.getElementById('ep-share-modal-download');
  const shareModalOpen = document.getElementById('ep-share-modal-open');
  const shareModalTitle = document.getElementById('ep-share-modal-title');
  const shareModalSub = document.getElementById('ep-share-modal-sub');

  const PLATFORM_LABELS = {
    linkedin: 'LinkedIn',
    facebook: 'Facebook',
    x: 'X',
    whatsapp: 'WhatsApp',
    email: 'Email',
  };

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

  function setShareUrls(title) {
    const urlInput = document.getElementById('ep-share-url');
    if (urlInput) urlInput.value = listingUrl;
    syncOpenListingHref();
  }

  function syncOpenListingHref() {
    const openListing = document.getElementById('ep-open-listing');
    if (openListing && listingUrl) openListing.href = listingUrl;
  }

  function platformShareUrl(platform, title, caption) {
    const encoded = encodeURIComponent(listingUrl);
    const shareText = String(caption || title || 'My event').trim();
    const shortText =
      shareText.length > 240 ? shareText.slice(0, 237).trim() + '…' : shareText;
    const text = encodeURIComponent(shortText);
    if (platform === 'linkedin') {
      return 'https://www.linkedin.com/feed/?shareActive=true';
    }
    if (platform === 'facebook') {
      return 'https://www.facebook.com/sharer/sharer.php?u=' + encoded;
    }
    if (platform === 'x') {
      return 'https://twitter.com/intent/tweet?url=' + encoded + '&text=' + text;
    }
    if (platform === 'whatsapp') {
      return 'https://wa.me/?text=' + encodeURIComponent(shareText + '\n\n' + listingUrl);
    }
    if (platform === 'email') {
      return (
        'mailto:?subject=' +
        encodeURIComponent('Join my event on The Networker Hub') +
        '&body=' +
        encodeURIComponent(shareText + '\n\n' + listingUrl)
      );
    }
    return listingUrl;
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
    if (shareModalLoading) shareModalLoading.hidden = !loading;
    if (shareModalPreview) {
      if (dataUrl) {
        shareModalPreview.src = dataUrl;
        shareModalPreview.hidden = false;
      } else {
        shareModalPreview.hidden = true;
        shareModalPreview.removeAttribute('src');
      }
    }
    const ready = Boolean(dataUrl);
    if (downloadImageBtn) downloadImageBtn.disabled = !ready;
    if (shareModalDownload) shareModalDownload.disabled = !ready;
  }

  async function ensureSharePack(ev) {
    if (!window.HubOrganiserEventShare) return null;
    if (sharePackPromise) return sharePackPromise;
    sharePackPromise = (async function () {
      shareEventData = ev;
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
      if (shareModalCaption) shareModalCaption.value = caption;

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

  function openShareModal(platform) {
    if (!shareModal) return;
    shareModalPlatform = platform || 'linkedin';
    const label = PLATFORM_LABELS[shareModalPlatform] || 'social media';
    if (shareModalTitle) shareModalTitle.textContent = 'Share to ' + label;
    if (shareModalSub) {
      shareModalSub.textContent =
        'Download the image, copy the caption, then paste both into your ' + label + ' post.';
    }
    if (shareModalOpen) {
      shareModalOpen.textContent = 'Open ' + label;
      shareModalOpen.href = platformShareUrl(
        shareModalPlatform,
        sharePack && sharePack.title,
        sharePack && sharePack.caption
      );
      if (shareModalPlatform === 'email') {
        shareModalOpen.removeAttribute('target');
      } else {
        shareModalOpen.setAttribute('target', '_blank');
        shareModalOpen.setAttribute('rel', 'noopener noreferrer');
      }
    }
    if (shareModalCaption && sharePack) shareModalCaption.value = sharePack.caption || '';
    if (shareCardDataUrl) {
      setShareImageState({ loading: false, dataUrl: shareCardDataUrl });
    } else if (shareEventData) {
      setShareImageState({ loading: true, dataUrl: '' });
      window.HubOrganiserEventShare.generatePromoCardDataUrl(shareEventData)
        .then(function (dataUrl) {
          shareCardDataUrl = dataUrl;
          setShareImageState({ loading: false, dataUrl });
        })
        .catch(function () {
          setShareImageState({ loading: false, dataUrl: '' });
        });
    }
    shareModal.hidden = false;
    document.body.classList.add('ep-share-modal-open');
  }

  function closeShareModal() {
    if (shareModal) shareModal.hidden = true;
    document.body.classList.remove('ep-share-modal-open');
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
    const openListing = document.getElementById('ep-open-listing');
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
    if (openListing) openListing.href = listingUrl;
    if (previewLink) previewLink.href = listingUrl;

    if (loading) loading.hidden = true;
    if (card) card.hidden = false;

    const lead = document.getElementById('ep-lead');
    if (lead && eventIds.length > 1 && String(ev.approvalStatus || '').trim() === 'Approved') {
      lead.textContent =
        'Your ' +
        eventIds.length +
        ' dates are live on the hub. Preview the main listing below, then share it with your network.';
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
      if (title) title.textContent = 'Your event is now published';
      if (previewHint) {
        previewHint.textContent = 'This is how your event appears on the browse page.';
      }
      if (lead) {
        lead.textContent =
          'Attendees can find it on the hub. Preview your listing and choose featured placement, then share it with your network.';
      }
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
        const approved = String(data.event.approvalStatus || '').trim() === 'Approved';
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
  shareModalDownload?.addEventListener('click', downloadShareImage);

  shareModalOpen?.addEventListener('click', async () => {
    if (!sharePack || !sharePack.caption) return;
    await copyText(sharePack.caption);
    const feedback = document.getElementById('ep-copy-feedback');
    if (feedback) {
      feedback.hidden = false;
      feedback.textContent = 'Caption copied — paste it into your post';
      setTimeout(() => {
        feedback.hidden = true;
      }, 2500);
    }
  });

  document.getElementById('ep-share-modal-copy-caption')?.addEventListener('click', async () => {
    const btn = document.getElementById('ep-share-modal-copy-caption');
    const original = btn ? btn.textContent : '';
    await copyText(sharePack && sharePack.caption);
    if (btn) {
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = original || 'Copy caption';
      }, 2000);
    }
  });

  ['ep-share-modal-backdrop', 'ep-share-modal-close'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', closeShareModal);
  });

  document.querySelectorAll('[data-share-platform]').forEach((btn) => {
    btn.addEventListener('click', async function () {
      const platform = btn.getAttribute('data-share-platform') || 'linkedin';
      if (sharePackPromise) await sharePackPromise;
      else if (shareEventData) await ensureSharePack(shareEventData);
      openShareModal(platform);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && shareModal && !shareModal.hidden) closeShareModal();
  });

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

  const publishRow = document.querySelector('.ep-publish-row');

  function hideFeaturedUpsell() {
    if (featuredUpsell) featuredUpsell.hidden = true;
    if (publishRow) publishRow.classList.add('ep-publish-row--preview-only');
    const previewCard = document.getElementById('ep-preview-heading');
    if (previewCard) {
      previewCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  if (extendFeatured && featuredHeading) {
    featuredHeading.textContent = 'Extend your featured listing';
  }
  if (extendFeatured && featuredLede) {
    featuredLede.textContent =
      'Your featured placement is ending soon. Extend to keep premium visibility — from £55 per month, prorated when your event is sooner.';
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
  if (featuredSkip) featuredSkip.addEventListener('click', hideFeaturedUpsell);

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

  syncOpenListingHref();
  setShareUrls(fallbackTitle);
  fetchPreview();
})();
