/**
 * City landing pages for business opportunities — /opportunities/networking/:region
 * (rewrites to /opportunities/?city=:region). Mirrors js/networking-regions.js slugs.
 */
(function () {
  var REGIONS = {
    'central-london': { name: 'Central London' },
    'north-london': { name: 'North London' },
    'south-london': { name: 'South London' },
    'east-london': { name: 'East London' },
    'west-london': { name: 'West London' },
    manchester: { name: 'Manchester' },
    birmingham: { name: 'Birmingham' },
    glasgow: { name: 'Glasgow' },
    edinburgh: { name: 'Edinburgh' },
    leeds: { name: 'Leeds' },
    liverpool: { name: 'Liverpool' },
    newcastle: { name: 'Newcastle' },
    bristol: { name: 'Bristol' },
    sheffield: { name: 'Sheffield' },
    nottingham: { name: 'Nottingham' },
    cardiff: { name: 'Cardiff' },
    brighton: { name: 'Brighton' },
    cambridge: { name: 'Cambridge' },
    oxford: { name: 'Oxford' },
    chester: { name: 'Chester' },
  };

  var params = new URLSearchParams(window.location.search);
  var cityParam = String(params.get('city') || '').trim().toLowerCase();
  var pathMatch = String(window.location.pathname || '').match(/^\/opportunities\/networking\/([^/]+)\/?$/);
  var slug = cityParam;

  if (!slug && pathMatch) {
    try {
      slug = decodeURIComponent(pathMatch[1]).toLowerCase();
    } catch (e) {
      slug = '';
    }
  }

  if (!slug || !REGIONS[slug]) return;

  var region = REGIONS[slug];
  var themes = window.HUB_NETWORKING_REGION_THEMES || {};
  var theme = themes[slug] || {};
  var year = new Date().getFullYear();

  window.hubOppRegionalLanding = {
    slug: slug,
    name: region.name,
    cityQuery: region.name,
    accent: theme.accent || '',
  };

  document.body.classList.add('opp-regional-landing');
  document.body.setAttribute('data-opp-region', slug);

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  setText('opp-hero-badge', 'Local opportunity directory');
  var heading = document.getElementById('opp-hero-heading');
  if (heading) {
    heading.innerHTML =
      'Business opportunities in <span class="accent">' + region.name + ' ' + year + '</span>';
  }
  setText(
    'opp-hero-lede',
    'Franchises, side hustles, partnerships and more across ' +
      region.name +
      '. Browse free and enquire directly with providers.'
  );

  var directory = document.getElementById('networking-location-directory');
  if (directory) {
    directory.classList.add('is-regional-landing');
    setText('networking-location-directory-heading', 'Other UK locations');
    var citiesHeading = directory.querySelector('.networking-location-cities-heading');
    if (citiesHeading) citiesHeading.textContent = 'Other popular cities';
  }

  var currentLink = document.querySelector(
    '.networking-location-links a[data-region="' + slug + '"]'
  );
  if (currentLink) {
    currentLink.hidden = true;
    var popular = {
      manchester: true,
      birmingham: true,
      liverpool: true,
      leeds: true,
      glasgow: true,
      edinburgh: true,
    };
    if (!popular[slug]) {
      var more = document.getElementById('networking-location-more');
      if (more) more.open = true;
    }
  }
})();
