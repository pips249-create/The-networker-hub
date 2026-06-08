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
    if (lead && eventIds.length > 1) {
      lead.textContent =
        'Your ' +
        eventIds.length +
        ' dates are live on the hub. Preview the main listing below, then share it with your network.';
    }

    setShareUrls(title);
  }

  async function fetchPreview() {
    if (!primaryId) {
      renderPreview({
        title: fallbackTitle,
        photo: fallbackImage,
        description: '',
      });
      return;
    }

    try {
      const res = await fetch(
        '/api/organiser/events?id=' + encodeURIComponent(primaryId),
        { credentials: 'include', cache: 'no-store' }
      );
      const data = await res.json();
      if (data.event) {
        renderPreview({
          id: data.event.id,
          slug: data.event.slug,
          title: data.event.title,
          description: data.event.description,
          date: data.event.date,
          location: data.event.location,
          imageUrl: data.event.imageUrl,
          photo: data.event.imageUrl,
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
        renderPreview(data.event);
        return;
      }
    } catch {
      /* ignore */
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

  setShareUrls(fallbackTitle);
  fetchPreview();
})();
