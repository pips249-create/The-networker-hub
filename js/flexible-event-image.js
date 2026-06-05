/**
 * Event card images: event photo → organiser logo → local placeholder in /assets/placeholders/.
 */
(function () {
  var PLACEHOLDER_BASE = '/assets/placeholders/';

  var PLACEMENT_IMAGES = [
    PLACEHOLDER_BASE + '1.svg',
    PLACEHOLDER_BASE + '2.svg',
    PLACEHOLDER_BASE + '3.svg',
    PLACEHOLDER_BASE + '4.svg',
    PLACEHOLDER_BASE + '5.svg',
    PLACEHOLDER_BASE + '6.svg',
    PLACEHOLDER_BASE + '7.svg',
    PLACEHOLDER_BASE + '8.svg',
  ];

  var TYPE_PLACEMENTS = {
    meeting: [
      PLACEHOLDER_BASE + '1.svg',
      PLACEHOLDER_BASE + '2.svg',
      PLACEHOLDER_BASE + '3.svg',
      PLACEHOLDER_BASE + '4.svg',
      PLACEHOLDER_BASE + '5.svg',
    ],
    exhibition: [PLACEHOLDER_BASE + '6.svg', PLACEHOLDER_BASE + '7.svg'],
    conference: [
      PLACEHOLDER_BASE + '2.svg',
      PLACEHOLDER_BASE + '4.svg',
      PLACEHOLDER_BASE + '6.svg',
      PLACEHOLDER_BASE + '8.svg',
    ],
    netwalking: [PLACEHOLDER_BASE + '3.svg', PLACEHOLDER_BASE + '5.svg'],
    awards: [PLACEHOLDER_BASE + '7.svg', PLACEHOLDER_BASE + '8.svg'],
  };

  var DEFAULT_PLACEHOLDER = PLACEHOLDER_BASE + 'default.svg';

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
    if (t.indexOf('conference') !== -1) return TYPE_PLACEMENTS.conference;
    if (t.indexOf('netwalk') !== -1) return TYPE_PLACEMENTS.netwalking;
    if (t.indexOf('award') !== -1) return TYPE_PLACEMENTS.awards;
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

  /** Browse cards: event photo, then varied placeholder (skip shared organiser logos). */
  function getEventBrowseImage(ev) {
    var photo = (ev && (ev.photo || ev.imageUrl)) || '';
    var eventType = (ev && (ev.eventType || ev.event_type || ev.typeRaw)) || '';
    var eventId = ev && ev.id;
    var title = ev && ev.title;

    if (isUsableImageUrl(photo)) return String(photo).trim();
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
})();
