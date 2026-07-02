/**
 * Post-publish confirmation — listing preview + social share.
 */
(function () {
  const params = new URLSearchParams(location.search);
  const eventIds = (params.get('ids') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const primaryId = eventIds[0] || '';
  const fallbackTitle = params.get('title') || '';
  const fallbackImage = params.get('image') || '';
  const featuredCancelled = params.get('featured') === 'cancelled';
  const extendFeatured = params.get('extend') === 'featured';

  const featuredUpsell = document.getElementById('ep-featured-upsell');
  const featuredHeading = document.getElementById('ep-featured-heading');
  const featuredLede = document.getElementById('ep-featured-lede');
  const featuredYes = document.getElementById('ep-featured-yes');
  const featuredSkip = document.getElementById('ep-featured-skip');
  const featuredError = document.getElementById('ep-featured-error');
  const featuredSlotStatus = document.getElementById('ep-featured-slot-status');

  const origin = location.origin;
  let listingUrl = primaryId
    ? origin + '/events/event.html?id=' + encodeURIComponent(primaryId)
    : origin + '/events/index.html';

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
      return origin + '/events/event.html?id=' + encodeURIComponent(id);
    }
    return origin + '/events/index.html';
  }

  function setShareUrls(title) {
    const urlInput = document.getElementById('ep-share-url');
    const encoded = encodeURIComponent(listingUrl);
    const text = encodeURIComponent(
      (title || 'My event') + ' — join us on The Networker Hub'
    );
    if (urlInput) urlInput.value = listingUrl;

    const linkedin = document.getElementById('ep-share-linkedin');
    const facebook = document.getElementById('ep-share-facebook');
    const xBtn = document.getElementById('ep-share-x');
    const whatsapp = document.getElementById('ep-share-whatsapp');
    const email = document.getElementById('ep-share-email');

    if (linkedin) {
      linkedin.href =
        'https://www.linkedin.com/sharing/share-offsite/?url=' + encoded;
    }
    if (facebook) {
      facebook.href = 'https://www.facebook.com/sharer/sharer.php?u=' + encoded;
    }
    if (xBtn) {
      xBtn.href =
        'https://twitter.com/intent/tweet?url=' + encoded + '&text=' + text;
    }
    if (whatsapp) {
      whatsapp.href =
        'https://wa.me/?text=' + encodeURIComponent((title || 'Event') + ' ' + listingUrl);
    }
    if (email) {
      email.href =
        'mailto:?subject=' +
        encodeURIComponent('Join my event on The Networker Hub') +
        '&body=' +
        encodeURIComponent('Book your place:\n' + listingUrl);
    }
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
    const meta = [ev.date || ev.dateLine, ev.location, ev.meetingType || ev.format]
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

    const commsRoot = document.getElementById('ep-comms-preview');
    if (window.HubCommsPack && commsRoot) {
      const pack = window.HubCommsPack.buildEventCommsPack(
        {
          title,
          date: ev.date || ev.dateLine,
          location: ev.location,
          description: plainDescription(ev.description),
        },
        listingUrl
      );
      commsRoot.hidden = false;
      window.HubCommsPack.bindCommsPack(commsRoot, pack);
    }
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
        renderPreview({
          id: data.event.id,
          slug: data.event.slug,
          title: data.event.title,
          description: data.event.description,
          date: data.event.date,
          location: data.event.location,
          imageUrl: data.event.imageUrl,
          photo: data.event.imageUrl,
          approvalStatus: data.event.approvalStatus,
        });
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
    try {
      await navigator.clipboard.writeText(listingUrl);
      if (feedback) {
        feedback.hidden = false;
        setTimeout(() => {
          feedback.hidden = true;
        }, 2500);
      }
    } catch {
      const input = document.getElementById('ep-share-url');
      if (input) {
        input.select();
        document.execCommand('copy');
        if (feedback) feedback.hidden = false;
      }
    }
  });

  function selectedPlanId() {
    const checked = document.querySelector('input[name="featured-plan"]:checked');
    return checked ? checked.value : '1week';
  }

  function hideFeaturedUpsell() {
    if (featuredUpsell) featuredUpsell.hidden = true;
  }

  if (extendFeatured && featuredHeading) {
    featuredHeading.textContent = 'Extend your featured listing';
  }
  if (extendFeatured && featuredLede) {
    featuredLede.textContent =
      'Your featured placement is ending soon. Choose how long you would like to extend it.';
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

  setShareUrls(fallbackTitle);
  fetchPreview();
})();
