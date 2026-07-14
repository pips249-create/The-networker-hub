/**
 * Enhances the shared events directory when served at /networking/:region.
 * The allow-list mirrors api/_lib/networking-regions.js.
 */
(function () {
  var REGIONS = {
    'central-london': { name: 'Central London', location: 'Central London' },
    'north-london': { name: 'North London', location: 'North London' },
    'south-london': { name: 'South London', location: 'South London' },
    'east-london': { name: 'East London', location: 'East London' },
    'west-london': { name: 'West London', location: 'West London' },
    manchester: { name: 'Manchester', location: 'Manchester' },
    birmingham: { name: 'Birmingham', location: 'Birmingham' },
    glasgow: { name: 'Glasgow', location: 'Glasgow' },
    edinburgh: { name: 'Edinburgh', location: 'Edinburgh' },
    leeds: { name: 'Leeds', location: 'Leeds' },
    liverpool: { name: 'Liverpool', location: 'Liverpool' },
    newcastle: { name: 'Newcastle', location: 'Newcastle' },
    bristol: { name: 'Bristol', location: 'Bristol' },
    sheffield: { name: 'Sheffield', location: 'Sheffield' },
    nottingham: { name: 'Nottingham', location: 'Nottingham' },
    cardiff: { name: 'Cardiff', location: 'Cardiff' },
    brighton: { name: 'Brighton', location: 'Brighton' },
    cambridge: { name: 'Cambridge', location: 'Cambridge' },
    oxford: { name: 'Oxford', location: 'Oxford' },
    chester: { name: 'Chester', location: 'Chester' },
  };

  var match = String(window.location.pathname || '').match(/^\/networking\/([^/]+)\/?$/);
  if (!match) return;

  var slug;
  try {
    slug = decodeURIComponent(match[1]).toLowerCase();
  } catch (e) {
    return;
  }
  var region = REGIONS[slug];
  if (!region) return;

  var themes = window.HUB_NETWORKING_REGION_THEMES || {};
  var theme = themes[slug] || {};
  var year = new Date().getFullYear();

  window.hubRegionalLanding = {
    slug: slug,
    name: region.name,
    location: region.location,
    accent: theme.accent || '',
  };
  document.body.classList.add('networking-region-page');
  document.body.setAttribute('data-region', slug);

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  setText('events-hero-badge', 'Local networking directory');
  var heading = document.getElementById('events-hero-heading');
  if (heading) {
    heading.innerHTML =
      'The best business networking events &amp; groups in <span class="accent"></span>';
    var accent = heading.querySelector('.accent');
    if (accent) accent.textContent = region.name + ' ' + year;
  }
  setText(
    'events-hero-lede',
    'Discover upcoming meetings, workshops, conferences and local networking communities across ' +
      region.name +
      '.'
  );
  setText('all-heading', 'Upcoming networking events in ' + region.name);

  var intro = document.getElementById('networking-region-intro');
  if (intro) {
    intro.hidden = false;
    intro.setAttribute('data-region', slug);
  }

  var introHeading = document.getElementById('networking-region-intro-heading');
  if (introHeading) {
    introHeading.innerHTML =
      'Business networking in <span class="networking-region-name-accent"></span>';
    var nameAccent = introHeading.querySelector('.networking-region-name-accent');
    if (nameAccent) nameAccent.textContent = region.name;
  }

  var introCopy = theme.tagline
    ? theme.tagline + ' Browse live events and local organiser communities.'
    : 'Browse live business networking events and organiser communities across ' +
      region.name +
      '.';
  setText('networking-region-intro-copy', introCopy);

  var landmark = document.getElementById('networking-region-skyline');
  if (landmark) {
    landmark.className = 'networking-region-landmark';
    landmark.style.removeProperty('--skyline-image');
    landmark.innerHTML = theme.landmark || '';
    landmark.hidden = !theme.landmark;
  }

  var postcode = document.getElementById('postcode');
  if (postcode) postcode.value = region.location;

  var currentLink = document.querySelector(
    '.networking-location-links a[href="/networking/' + slug + '"]'
  );
  if (currentLink) currentLink.setAttribute('aria-current', 'page');
})();
