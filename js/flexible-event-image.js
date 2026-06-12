/**
 * Event card images: event photo → organiser logo → type-based Unsplash placeholder.
 */
(function () {
  var PLACEMENT_IMAGES = [
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1515187029135-18ee286d815b?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1560179707-f14e90ef3623?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1515187029135-18ee286d815b?q=80&w=800&auto=format&fit=crop',
  ];

  var TYPE_PLACEMENTS = {
    meeting: [
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1515187029135-18ee286d815b?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=800&auto=format&fit=crop',
    ],
    exhibition: [
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1560179707-f14e90ef3623?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1515187029135-18ee286d815b?q=80&w=800&auto=format&fit=crop',
    ],
    events: [
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1515187029135-18ee286d815b?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=800&auto=format&fit=crop',
    ],
    netwalking: [
      'https://images.unsplash.com/photo-1515187029135-18ee286d815b?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=800&auto=format&fit=crop',
    ],
    awards: [
      'https://images.unsplash.com/photo-1560179707-f14e90ef3623?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop',
    ],
    'sport-social': [
      'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1593113598332-cd288d649433?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=800&auto=format&fit=crop',
    ],
    'womens-networking': [
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=800&auto=format&fit=crop',
    ],
  };

  var DEFAULT_PLACEHOLDER = PLACEMENT_IMAGES[0];

  function isUsableImageUrl(url) {
    var value = String(url || '').trim();
    if (!value) return false;
    if (/event-placeholder/i.test(value)) return false;
    if (/\/assets\/placeholders\//i.test(value)) return false;
    return true;
  }

  function typePool(eventType) {
    var t = String(eventType || '').toLowerCase();
    if (t.indexOf('exhibition') !== -1) return TYPE_PLACEMENTS.exhibition;
    if (t.indexOf('award') !== -1) return TYPE_PLACEMENTS.awards;
    if (t === 'events' || t.indexOf('conference') !== -1 || t.indexOf('summit') !== -1) {
      return TYPE_PLACEMENTS.events;
    }
    if (t.indexOf('netwalk') !== -1) return TYPE_PLACEMENTS.netwalking;
    if (t.indexOf('sport') !== -1 || t.indexOf('golf') !== -1 || t.indexOf('padel') !== -1) {
      return TYPE_PLACEMENTS['sport-social'];
    }
    if (t.indexOf('women') !== -1) return TYPE_PLACEMENTS['womens-networking'];
    if (t.indexOf('meeting') !== -1 || t.indexOf('networking') !== -1) return TYPE_PLACEMENTS.meeting;
    return PLACEMENT_IMAGES;
  }

  function placementForEvent(eventId, eventType, title) {
    var pool = typePool(eventType);
    var key = String(eventId || '') + '|' + String(title || '').trim();
    if (!key || key === '|') return pool[0] || DEFAULT_PLACEHOLDER;

    var charSum = 0;
    for (var i = 0; i < key.length; i++) {
      charSum += key.charCodeAt(i);
    }

    return pool[charSum % pool.length] || DEFAULT_PLACEHOLDER;
  }

  function getEventImage(ev) {
    var photo = (ev && (ev.photo || ev.imageUrl)) || '';
    var logo = (ev && ev.organiserLogo) || '';
    var eventType = (ev && (ev.eventType || ev.event_type || ev.typeRaw)) || '';
    var eventId = ev && ev.id;
    var title = ev && ev.title;

    if (isUsableImageUrl(photo)) return String(photo).trim();
    if (isUsableImageUrl(logo)) return String(logo).trim();
    return placementForEvent(eventId, eventType, title);
  }

  /** Browse cards: event photo → organiser logo → type-based placeholder. */
  function getEventBrowseImage(ev) {
    var photo = (ev && (ev.photo || ev.imageUrl)) || '';
    var logo = (ev && ev.organiserLogo) || '';
    var eventType = (ev && (ev.eventType || ev.event_type || ev.typeRaw)) || '';
    var eventId = ev && ev.id;
    var title = ev && ev.title;

    if (isUsableImageUrl(photo)) return String(photo).trim();
    if (isUsableImageUrl(logo)) return String(logo).trim();
    return placementForEvent(eventId, eventType, title);
  }

  function getFlexibleEventImage(eventImageUrl, groupLogoUrl, eventId) {
    return getEventImage({
      photo: eventImageUrl,
      organiserLogo: groupLogoUrl,
      id: eventId,
    });
  }

  window.getEventImage = getEventImage;
  window.getEventBrowseImage = getEventBrowseImage;
  window.getFlexibleEventImage = getFlexibleEventImage;
  window.getEventPlacementImage = function (eventId, eventType, title) {
    return placementForEvent(eventId, eventType, title);
  };
  window.getDefaultEventPlaceholder = function () {
    return DEFAULT_PLACEHOLDER;
  };

  /** Group logos and small assets — use contain on browse cards, not cover stretch. */
  function isLogoStyleCover(ev, url) {
    var photo = String(url || '').trim();
    if (!photo) return false;
    var logo = ev && ev.organiserLogo ? String(ev.organiserLogo).trim() : '';
    if (logo && photo === logo) return true;
    if (/\/logo[.\-_/]/i.test(photo) || /\/img\/logo\./i.test(photo)) return true;
    return false;
  }

  window.hubIsLogoStyleCover = isLogoStyleCover;

  window.hubMarkSmallEventCover = function (img) {
    if (!img || img.naturalWidth <= 0) return;
    if (img.naturalWidth < 640 || img.naturalHeight < 400) {
      img.classList.add('is-logo-cover');
    }
  };
})();
