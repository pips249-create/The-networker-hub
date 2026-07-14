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
    bristol: { name: 'Bristol', location: 'Bristol' },
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

  var year = new Date().getFullYear();
  window.hubRegionalLanding = {
    slug: slug,
    name: region.name,
    location: region.location,
  };
  document.body.classList.add('networking-region-page');

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
  setText('networking-region-intro-heading', 'Business networking in ' + region.name);
  setText(
    'networking-region-intro-copy',
    'Explore live business networking events and the organiser communities behind them in ' +
      region.name +
      '. Browse without signing in, then create a free account when you are ready to book.'
  );

  var intro = document.getElementById('networking-region-intro');
  if (intro) intro.hidden = false;
  var postcode = document.getElementById('postcode');
  if (postcode) postcode.value = region.location;
  var currentLink = document.querySelector(
    '.networking-location-links a[href="/networking/' + slug + '"]'
  );
  if (currentLink) currentLink.setAttribute('aria-current', 'page');
})();
