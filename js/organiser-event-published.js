/**
 * Post-publish confirmation — listing preview + social share.
 */
(function () {
  const featuredPlanDuration = document.getElementById('ep-featured-plan-duration');

  function beforePublicCatalogueLaunch() {
    // Europe/London midnight 1 Sept 2026 — matches soft-launch copy elsewhere.
    return Date.now() < Date.parse('2026-09-01T00:00:00+01:00');
  }

  (function syncSoftLaunchShareNote() {
    const note = document.getElementById('ep-share-soft-launch');
    if (note && !beforePublicCatalogueLaunch()) note.hidden = true;
  })();

  function applyFeaturedQuote(quote) {
    if (!quote) return;
    document.querySelectorAll('.ep-featured-single-price .ep-featured-plan-price').forEach(function (el) {
      el.textContent = quote.displayPrice || '£55.00';
    });
    if (featuredPlanDuration) {
      featuredPlanDuration.textContent =
        quote.pricingMode === 'prorated' ? 'until your event' : 'one-time · up to 30 days';
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
  const needsMembersCta =
    params.get('needsMembers') === '1' || Boolean(previewStash && previewStash.needsMembers);
  const membersGroupId = String(
    params.get('groupId') || (previewStash && previewStash.organiserGroupId) || ''
  ).trim();
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
  let previewEvent = null;
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
  const shareLinkedInPrimary = document.getElementById('ep-share-linkedin-primary');
  const sharePromoteLink = document.getElementById('ep-share-promote');
  const shareCustomiseLink = document.getElementById('ep-share-customise');
  const featuredDashboardLink = document.getElementById('ep-featured-dashboard');

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
    let url = origin + '/events/';
    if (slug) {
      url = origin + '/events/' + encodeURIComponent(slug);
    } else {
      const id = (ev && ev.id) || primaryId;
      if (id) {
        url = origin + '/events/event?id=' + encodeURIComponent(id);
      }
    }
    try {
      const u = new URL(url);
      u.searchParams.set('utm_source', 'linkedin');
      u.searchParams.set('utm_medium', 'organic');
      u.searchParams.set('utm_campaign', 'organiser_share');
      u.searchParams.set('utm_content', 'event_published');
      return u.toString();
    } catch {
      return url;
    }
  }

  const promoteSection = document.getElementById('ep-promote-section');
  const viewListingLink = document.getElementById('ep-view-listing');
  const justPublished = Boolean(previewStash) || params.get('published') === '1';

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

  function canPromoteEvent(ev) {
    if (justPublished) return true;
    if (primaryId && !ev) return true;
    return isPublishedListing(ev);
  }

  function setPromoteVisibility(isLive, options) {
    options = options || {};
    if (promoteSection) promoteSection.hidden = !isLive;
    if (isLive && options.scrollIntoView && promoteSection) {
      requestAnimationFrame(function () {
        promoteSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  function markShareDone(action) {
    if (window.HubCommsPack && window.HubCommsPack.markEventShareDone) {
      window.HubCommsPack.markEventShareDone();
    }
    var promoteAction =
      action === 'download' || action === 'copy_caption' || action === 'open_linkedin'
        ? action
        : 'open_linkedin';
    try {
      if (window.HubAnalytics && typeof window.HubAnalytics.track === 'function') {
        window.HubAnalytics.track(
          promoteAction === 'copy_caption'
            ? 'organiser_linkedin_copy_caption'
            : promoteAction === 'download'
              ? 'organiser_linkedin_download'
              : 'organiser_linkedin_open',
          { source: 'event_published' }
        );
      } else if (typeof window.va === 'function') {
        window.va('event', {
          name:
            promoteAction === 'copy_caption'
              ? 'organiser_linkedin_copy_caption'
              : promoteAction === 'download'
                ? 'organiser_linkedin_download'
                : 'organiser_linkedin_open',
          data: { source: 'event_published' },
        });
      }
    } catch {
      /* analytics optional */
    }
    try {
      var ev = previewEvent || null;
      fetch('/api/organiser/promote-action', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: promoteAction,
          source: 'event_published',
          organiserId: (ev && (ev.organiserId || ev.groupId || ev.organiser_id)) || null,
          eventId: (ev && ev.id) || primaryId || null,
          templateId: 'event_published',
        }),
        keepalive: true,
      }).catch(function () {
        /* non-fatal */
      });
    } catch {
      /* non-fatal */
    }
  }

  function applyShareCaption(caption) {
    if (!sharePack) return;
    sharePack.caption = caption || '';
    const captionEl = document.getElementById('ep-comms-caption');
    if (captionEl) captionEl.textContent = sharePack.caption;
    updateShareQuickLinks(sharePack.title, sharePack.caption);
  }

  function renderCaptionVariants(pack) {
    const wrap = document.getElementById('ep-caption-variants');
    const list = document.getElementById('ep-caption-variant-list');
    const variants = (pack && pack.variants) || [];
    if (!wrap || !list || variants.length < 2) {
      if (wrap) wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    list.innerHTML = variants
      .map(function (variant, index) {
        const checked = index === 0 ? ' checked' : '';
        return (
          '<label class="ep-caption-variant">' +
          '<input type="radio" name="ep-caption-variant" value="' +
          esc(variant.id) +
          '"' +
          checked +
          ' />' +
          '<span>' +
          esc(variant.label) +
          '</span></label>'
        );
      })
      .join('');

    list.querySelectorAll('input[name="ep-caption-variant"]').forEach(function (input) {
      input.addEventListener('change', function () {
        const selected = variants.find(function (variant) {
          return variant.id === input.value;
        });
        if (selected) applyShareCaption(selected.caption);
      });
    });
  }

  let commsPackBound = false;

  function bindShareCommsPack(root, pack) {
    if (!root || !pack) return;
    const urlEl = root.querySelector('[data-comms-url]');
    if (urlEl) {
      const url = String(pack.url || '').trim();
      const caption = String(pack.caption || '');
      const showUrlLine = url && caption.indexOf(url) === -1;
      urlEl.hidden = !showUrlLine;
      urlEl.textContent = showUrlLine ? url : '';
    }
    renderCaptionVariants(pack);
    applyShareCaption(pack.caption || '');
    if (commsPackBound) return;
    commsPackBound = true;

    root.querySelectorAll('[data-comms-copy]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const kind = btn.getAttribute('data-comms-copy') || 'caption';
        const text = kind === 'url' ? listingUrl : sharePack && sharePack.caption;
        if (!text) return;
        const feedback = document.getElementById('ep-copy-feedback');
        const original = btn.textContent;
        const copied = await copyText(text, feedback, '', 'Copied to clipboard');
        if (copied) {
          markShareDone('copy_caption');
          btn.textContent = 'Copied!';
          setTimeout(function () {
            btn.textContent = original;
          }, 2000);
        }
      });
    });
  }

  function setShareUrls(title) {
    const urlInput = document.getElementById('ep-share-url');
    if (urlInput) urlInput.value = listingUrl;
    if (viewListingLink) viewListingLink.href = listingUrl;
    updateShareQuickLinks(title, sharePack && sharePack.caption);
  }

  function updateShareQuickLinks(title, caption) {
    const rawCaption = String(caption || title || 'My event').trim();
    const shareText = captionWithListingUrl(rawCaption);
    const encodedUrl = encodeURIComponent(listingUrl);
    let tweetText = rawCaption;
    if (listingUrl && tweetText.indexOf(listingUrl) !== -1) {
      tweetText = tweetText
        .split(listingUrl)
        .join('')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
    const shortTweet =
      tweetText.length > 220 ? tweetText.slice(0, 217).trim() + '…' : tweetText;
    const encodedTweet = encodeURIComponent(shortTweet);

    if (shareQuickLinkedIn) {
      // LinkedIn no longer accepts prefilled text — open the feed for paste.
      shareQuickLinkedIn.href = 'https://www.linkedin.com/feed/';
      shareQuickLinkedIn.setAttribute('data-share-network', 'linkedin');
    }
    if (shareQuickFacebook) {
      shareQuickFacebook.href =
        'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl;
      shareQuickFacebook.setAttribute('data-share-network', 'facebook');
    }
    if (shareQuickX) {
      shareQuickX.href =
        'https://twitter.com/intent/tweet?text=' +
        encodedTweet +
        '&url=' +
        encodedUrl;
      shareQuickX.setAttribute('data-share-network', 'x');
    }
    if (shareQuickWhatsapp) {
      shareQuickWhatsapp.href =
        'https://wa.me/?text=' + encodeURIComponent(shareText);
      shareQuickWhatsapp.setAttribute('data-share-network', 'whatsapp');
    }
    if (shareQuickEmail) {
      shareQuickEmail.href =
        'mailto:?subject=' +
        encodeURIComponent('Join my event on The Networker Hub') +
        '&body=' +
        encodeURIComponent(shareText);
      shareQuickEmail.removeAttribute('target');
      shareQuickEmail.setAttribute('data-share-network', 'email');
    }
  }

  function captionWithListingUrl(caption) {
    const text = String(caption || '').trim();
    const url = String(listingUrl || '').trim();
    if (!url) return text;
    if (!text) return url;
    if (text.indexOf(url) !== -1) return text;
    return text + '\n\n' + url;
  }

  function networkLabel(network) {
    if (network === 'linkedin') return 'LinkedIn';
    if (network === 'facebook') return 'Facebook';
    if (network === 'x') return 'X';
    if (network === 'whatsapp') return 'WhatsApp';
    if (network === 'email') return 'email';
    return 'your post';
  }

  async function shareToNetwork(network, clickEvent) {
    if (clickEvent) clickEvent.preventDefault();
    try {
      await sharePackPromise;
    } catch {
      /* non-fatal */
    }
    const caption = captionWithListingUrl(
      (sharePack && sharePack.caption) || listingUrl
    );
    const feedback = document.getElementById('ep-copy-feedback');
    const needsPaste = network === 'linkedin' || network === 'facebook';

    if (needsPaste) {
      await copyText(
        caption,
        feedback,
        '',
        'Post copied — paste it into ' + networkLabel(network)
      );
    }

    // Image posts: offer the promo image for platforms that support attachments.
    if (
      shareCardDataUrl &&
      (network === 'linkedin' || network === 'facebook' || network === 'x')
    ) {
      downloadShareImage();
    }

    updateShareQuickLinks(sharePack && sharePack.title, caption);

    let href = listingUrl;
    if (network === 'linkedin' && shareQuickLinkedIn) href = shareQuickLinkedIn.href;
    else if (network === 'facebook' && shareQuickFacebook) href = shareQuickFacebook.href;
    else if (network === 'x' && shareQuickX) href = shareQuickX.href;
    else if (network === 'whatsapp' && shareQuickWhatsapp) href = shareQuickWhatsapp.href;
    else if (network === 'email' && shareQuickEmail) href = shareQuickEmail.href;

    if (network === 'email') {
      window.location.href = href;
    } else {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
    markShareDone('open_linkedin');
  }

  function bindShareQuickButtons() {
    const buttons = [
      [shareQuickLinkedIn, 'linkedin'],
      [shareQuickFacebook, 'facebook'],
      [shareQuickX, 'x'],
      [shareQuickWhatsapp, 'whatsapp'],
      [shareQuickEmail, 'email'],
    ];
    buttons.forEach(function (pair) {
      const el = pair[0];
      const network = pair[1];
      if (!el || el.dataset.shareBound === '1') return;
      el.dataset.shareBound = '1';
      el.addEventListener('click', function (e) {
        shareToNetwork(network, e);
      });
    });
  }

  bindShareQuickButtons();

  function fullShareLocation(ev) {
    if (
      window.HubOrganiserEventShare &&
      window.HubOrganiserEventShare.formatShareLocation
    ) {
      return window.HubOrganiserEventShare.formatShareLocation(ev);
    }
    return String((ev && ev.location) || '').trim();
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
    if (!window.HubOrganiserEventShare && !window.HubCommsPack) return null;
    if (sharePackPromise) return sharePackPromise;
    sharePackPromise = (async function () {
      listingUrl = buildListingUrl(ev);
      const title = ev.title || fallbackTitle || 'Your event';
      if (window.HubCommsPack && window.HubCommsPack.buildEventCommsPack) {
        sharePack = window.HubCommsPack.buildEventCommsPack(ev, listingUrl);
        sharePack.title = title;
      } else {
        const caption = window.HubOrganiserEventShare.buildPromoCaption(ev, listingUrl);
        sharePack = { title, url: listingUrl, caption };
      }
      setShareUrls(title);

      const commsRoot = document.getElementById('ep-comms-preview');
      if (commsRoot) {
        bindShareCommsPack(commsRoot, sharePack);
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

    previewEvent = ev || null;
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
        ' dates are live on the hub. Share your listing now to start filling seats.';
    }

    setShareUrls(title);
    ensureSharePack({
      id: ev.id || primaryId,
      slug: ev.slug,
      title,
      description: plainDescription(ev.description),
      date: ev.date || ev.dateLine,
      starts_at: ev.starts_at || ev.date || ev.dateLine,
      location: fullShareLocation(ev) || ev.location,
      venue: ev.venue,
      addressLine1: ev.addressLine1 || ev.address,
      address: ev.address || ev.addressLine1,
      city: ev.city,
      postcode: ev.postcode,
      type: ev.type || ev.eventType,
      eventType: ev.eventType || ev.type,
      priceKey: ev.priceKey,
      priceNum: ev.priceNum,
      price: ev.price,
      imageUrl: photo,
      photo,
      imagePosition: ev.imagePosition || ev.photoPosition,
      organiserName: ev.organiserName || ev.groupName,
      organiserLogo: ev.organiserLogo,
    });
  }

  function sharePackEventFromSources(organiserEvent, hubEvent) {
    const base = organiserEvent || hubEvent || {};
    const hub = hubEvent || {};
    const merged = {
      id: base.id || primaryId,
      slug: base.slug || hub.slug,
      title: base.title || hub.title || fallbackTitle,
      description: plainDescription(base.description || hub.description),
      date: base.date || hub.date || hub.dateLine,
      starts_at: base.starts_at || base.date || hub.starts_at || hub.date,
      location: base.location || hub.location,
      venue: base.venue || hub.venue,
      addressLine1: base.addressLine1 || base.address || hub.addressLine1 || hub.address,
      address: base.address || base.addressLine1 || hub.address || hub.addressLine1,
      city: base.city || hub.city,
      postcode: base.postcode || hub.postcode,
      type: base.type || hub.type || hub.eventType,
      eventType: base.eventType || hub.eventType || base.type || hub.type,
      priceKey: hub.priceKey || base.priceKey,
      priceNum: hub.priceNum != null ? hub.priceNum : base.priceNum,
      price: hub.price || base.price,
      imageUrl: base.imageUrl || hub.imageUrl || hub.photo,
      photo: base.imageUrl || hub.photo || hub.imageUrl,
      imagePosition: base.imagePosition || hub.imagePosition || hub.photoPosition,
      organiserName: base.organiserName || base.groupName || hub.organiserName || hub.groupName,
      organiserLogo: base.organiserLogo || hub.organiserLogo,
      approvalStatus: base.approvalStatus,
      status: base.status,
      listingStatus: base.listingStatus,
    };
    merged.location = fullShareLocation(merged) || merged.location;
    return merged;
  }

  function showMembersCtaIfNeeded() {
    const card = document.getElementById('ep-members-cta');
    if (!card || !needsMembersCta) return;
    card.hidden = false;
    const go = document.getElementById('ep-members-cta-go');
    const roster = document.getElementById('ep-members-cta-roster');
    if (go) {
      go.href = membersGroupId
        ? '/organiser/?membershipGroup=' + encodeURIComponent(membersGroupId) + '#memberships'
        : '/organiser/#memberships';
    }
    if (roster) {
      roster.hidden = !membersGroupId;
      if (membersGroupId) {
        roster.href = '/organiser/member-roster?id=' + encodeURIComponent(membersGroupId);
      }
    }
  }

  function markLiveOnBrowse(options) {
    options = options || {};
    const title = document.getElementById('ep-title');
    const previewHint = document.getElementById('ep-preview-hint');
    const lead = document.getElementById('ep-lead');
    if (title) title.textContent = 'Your listing is live';
    if (previewHint) {
      previewHint.textContent = 'This is how your event appears on the browse page.';
    }
    if (lead) {
      lead.textContent = needsMembersCta
        ? 'Your listing is live. Add people under Memberships so members can book this closed event, or share it free on social media.'
        : 'Your listing is live. Share it free on social media, or feature it in Premium Spotlight for extra visibility on the hub.';
    }
    showMembersCtaIfNeeded();
    setPromoteVisibility(true, {
      scrollIntoView: options.scrollIntoView != null ? options.scrollIntoView : justPublished,
    });
  }

  function markPendingApproval(ev) {
    const title = document.getElementById('ep-title');
    const previewHint = document.getElementById('ep-preview-hint');
    const lead = document.getElementById('ep-lead');
    const pendingReview = ev && isPublishedListing(ev) && !isApprovedListing(ev);
    if (pendingReview) {
      if (title) title.textContent = 'Your event is submitted';
      if (previewHint) {
        previewHint.textContent =
          'We are finishing a quick review before it appears on the public browse page.';
      }
      if (lead) {
        lead.textContent =
          'You can share your listing link now while we finish a quick review.';
      }
      setPromoteVisibility(true);
      return;
    }
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

  async function fetchPreview() {
    if (!primaryId) {
      renderPreview({
        title: fallbackTitle,
        photo: fallbackImage,
        description: '',
      });
      setPromoteVisibility(false);
      return;
    }

    async function loadOrganiserEvent() {
      const res = await fetch('/api/organiser/events?id=' + encodeURIComponent(primaryId), {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      return data && data.event ? data.event : null;
    }

    try {
      let organiserEvent = await loadOrganiserEvent();
      if (justPublished && organiserEvent && !canPromoteEvent(organiserEvent)) {
        await new Promise(function (resolve) {
          setTimeout(resolve, 600);
        });
        organiserEvent = await loadOrganiserEvent();
      }
      if (organiserEvent) {
        if (canPromoteEvent(organiserEvent)) markLiveOnBrowse();
        else markPendingApproval(organiserEvent);
        applyFeaturedStartIso(organiserEvent.date || organiserEvent.starts_at || '');
        let hubEvent = null;
        try {
          const hubRes = await fetch('/api/hub-listings?id=' + encodeURIComponent(primaryId), {
            cache: 'no-store',
          });
          const hubData = await hubRes.json();
          hubEvent = hubData && hubData.event ? hubData.event : null;
          if (hubData.seriesDates && hubData.seriesDates.length > 1) {
            applyFeaturedStartIso(
              organiserEvent.date || organiserEvent.starts_at || '',
              hubData.seriesDates
            );
          }
        } catch {
          /* optional hub enrichment */
        }
        const merged = sharePackEventFromSources(organiserEvent, hubEvent);
        renderPreview(merged);
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
      if (!justPublished) markPendingApproval();
    } catch {
      if (!justPublished) markPendingApproval();
    }

    if (!justPublished) markPendingApproval();
    renderPreview({
      title: fallbackTitle,
      photo: fallbackImage,
      description: '',
    });
  }

  document.getElementById('ep-copy-link')?.addEventListener('click', async () => {
    const feedback = document.getElementById('ep-copy-feedback');
    const softNote =
      'Link copied. Public browsing opens 1 September — until then, cold traffic may see the waitlist page.';
    const okMsg = beforePublicCatalogueLaunch() ? softNote : 'Link copied to clipboard';
    const copied = await copyText(listingUrl, feedback, '', okMsg);
    if (copied) markShareDone('copy_caption');
    if (!copied) {
      const input = document.getElementById('ep-share-url');
      if (input) {
        input.select();
        document.execCommand('copy');
        if (feedback) {
          feedback.textContent = okMsg;
          feedback.hidden = false;
        }
      }
    }
  });

  document.getElementById('ep-copy-caption')?.addEventListener('click', async () => {
    const feedback = document.getElementById('ep-copy-feedback');
    const btn = document.getElementById('ep-copy-caption');
    const original = btn ? btn.textContent : '';
    const copied = await copyText(sharePack && sharePack.caption, feedback, '', 'Caption copied to clipboard');
    if (copied) {
      markShareDone('copy_caption');
      if (btn) {
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = original || 'Copy social post';
        }, 2000);
      }
    }
  });

  async function copyPostAndOpenLinkedIn() {
    const feedback = document.getElementById('ep-copy-feedback');
    const btn = shareLinkedInPrimary;
    const original = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Preparing…';
    }
    try {
      await sharePackPromise;
    } catch {
      /* non-fatal */
    }
    const caption = captionWithListingUrl((sharePack && sharePack.caption) || listingUrl);
    const copied = await copyText(
      caption,
      feedback,
      '',
      'Post copied — paste it into LinkedIn'
    );
    if (shareCardDataUrl) downloadShareImage();
    if (btn) {
      btn.disabled = false;
      btn.textContent = copied ? 'Copied — opening LinkedIn…' : original || 'Copy post & open LinkedIn';
    }
    window.open('https://www.linkedin.com/feed/', '_blank', 'noopener,noreferrer');
    if (copied) markShareDone('open_linkedin');
    if (copied && btn) {
      setTimeout(function () {
        btn.textContent = original || 'Copy post & open LinkedIn';
      }, 2500);
    }
  }

  shareLinkedInPrimary?.addEventListener('click', copyPostAndOpenLinkedIn);

  function rememberPromoteEvent() {
    if (!primaryId) return;
    try {
      sessionStorage.setItem('hub_promote_event_id', primaryId);
    } catch {
      /* ignore private mode */
    }
  }

  sharePromoteLink?.addEventListener('click', rememberPromoteEvent);
  featuredDashboardLink?.addEventListener('click', rememberPromoteEvent);

  shareCustomiseLink?.addEventListener('click', rememberPromoteEvent);

  function downloadShareImage() {
    if (!shareCardDataUrl || !window.HubOrganiserEventShare) return;
    const name =
      window.HubOrganiserEventShare.safeFilename(sharePack && sharePack.title) + '-event-promo.png';
    window.HubOrganiserEventShare.downloadPngDataUrl(shareCardDataUrl, name);
    markShareDone('download');
  }

  downloadImageBtn?.addEventListener('click', downloadShareImage);

  function selectedPlanId() {
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
      'Your featured placement is ending soon. Extend with a one-time boost to keep premium visibility — from <strong>£55</strong>, adjusted when your event is sooner.';
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
            ? 'All featured spotlight places are currently taken. Your event stays live — you can upgrade from Promote in your dashboard when a slot opens.'
            : data.message || data.error || 'Could not start checkout. Your event is still live.';
      if (featuredError) {
        featuredError.hidden = false;
        featuredError.textContent = msg;
      }
      if (data.error === 'featured_slots_full' && featuredUpsell) {
        featuredUpsell.classList.add('is-slots-full');
        if (featuredDashboardLink) featuredDashboardLink.hidden = false;
        if (featuredYes) featuredYes.hidden = true;
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
        featuredUpsell.classList.add('is-slots-full');
        if (featuredSlotStatus) {
          featuredSlotStatus.hidden = false;
          featuredSlotStatus.textContent =
            'All ' +
            slots.max +
            ' featured spotlight places are taken at the moment. Your event stays live — you can upgrade from Promote in your dashboard when a slot opens.';
        }
        if (featuredYes) {
          featuredYes.disabled = true;
          featuredYes.hidden = true;
          featuredYes.textContent = 'Featured spotlight full';
        }
        if (featuredDashboardLink) featuredDashboardLink.hidden = false;
      }
    } catch {
      /* non-fatal */
    }
  }

  loadFeaturedSlotStatus();

  function showLaunchContinueIfNeeded() {
    const banner = document.getElementById('ep-launch-continue');
    const titleEl = document.getElementById('ep-launch-continue-title');
    const bodyEl = document.getElementById('ep-launch-continue-body');
    if (!banner || !window.HubOrganiserLaunchSetup) return;

    fetch('/api/organiser/bootstrap', { credentials: 'include', cache: 'no-store' })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok) return;
        const built = window.HubOrganiserLaunchSetup.buildQueue({
          groups: data.groups || [],
          events: (data.events || []).concat(data.upcomingEvents || []),
          tickets: data.tickets || [],
        });
        if (built.stored.dismissed || !built.queue.length) {
          banner.hidden = true;
          return;
        }
        const next = built.queue[0];
        if (titleEl) {
          titleEl.textContent =
            built.queue.length === 1
              ? 'One more step to finish setup'
              : built.queue.length + ' steps left in your setup';
        }
        if (bodyEl) {
          bodyEl.textContent =
            next.kind === 'profile'
              ? 'Next: review “' + next.title + '” (profile + complimentary visits).'
              : 'Next: set tickets and Confirm & publish for “' +
                next.title +
                '” — it stays Draft until then. Public buying opens 1 September.';
        }
        banner.hidden = false;
      })
      .catch(function () {
        /* non-fatal */
      });
  }

  showLaunchContinueIfNeeded();

  setShareUrls(fallbackTitle);
  if (primaryId) {
    markLiveOnBrowse({ scrollIntoView: justPublished });
  } else {
    showMembersCtaIfNeeded();
    setPromoteVisibility(false);
  }
  fetchPreview();
})();