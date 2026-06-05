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
    'https://images.unsplash.com/photo-1557804506-669a77965eba?q=80&w=800&auto=format&fit=crop',
  ];

  var TYPE_PLACEMENTS = {
    meeting: [
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1557804506-669a77965eba?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=800&auto=format&fit=crop',
    ],
    exhibition: [
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1560179707-f14e90ef3623?q=80&w=800&auto=format&fit=crop',
    ],
    conference: [
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1515187029135-18ee286d815b?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=800&auto=format&fit=crop',
    ],
  };

  function isUsableImageUrl(url) {
    var value = String(url || '').trim();
    if (!value) return false;
    if (/event-placeholder/i.test(value)) return false;
    return true;
  }

  function typePool(eventType) {
    var t = String(eventType || '').toLowerCase();
    if (t.indexOf('exhibition') !== -1) return TYPE_PLACEMENTS.exhibition;
    if (t.indexOf('conference') !== -1) return TYPE_PLACEMENTS.conference;
    if (t.indexOf('meeting') !== -1 || t.indexOf('networking') !== -1) return TYPE_PLACEMENTS.meeting;
    return PLACEMENT_IMAGES;
  }

  function placementForEvent(eventId, eventType) {
    var pool = typePool(eventType);
    if (!eventId) return pool[0];

    var charSum = 0;
    var id = String(eventId);
    for (var i = 0; i < id.length; i++) {
      charSum += id.charCodeAt(i);
    }

    return pool[charSum % pool.length];
  }

  function getEventImage(ev) {
    var photo = (ev && (ev.photo || ev.imageUrl)) || '';
    var logo = (ev && ev.organiserLogo) || '';
    var eventType = (ev && (ev.eventType || ev.event_type || ev.typeRaw)) || '';
    var eventId = ev && ev.id;

    if (isUsableImageUrl(photo)) return String(photo).trim();
    if (isUsableImageUrl(logo)) return String(logo).trim();
    return placementForEvent(eventId, eventType);
  }

  function getFlexibleEventImage(eventImageUrl, groupLogoUrl, eventId) {
    return getEventImage({
      photo: eventImageUrl,
      organiserLogo: groupLogoUrl,
      id: eventId,
    });
  }

  window.getEventImage = getEventImage;
  window.getFlexibleEventImage = getFlexibleEventImage;
  window.getEventPlacementImage = function (eventId, eventType) {
    return placementForEvent(eventId, eventType);
  };
})();
