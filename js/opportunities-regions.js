/**
 * City landing pages for business opportunities — /opportunities/networking/:region
 * (rewrites to /opportunities/?city=:region). Mirrors js/networking-regions.js slugs.
 * City Partner ads reuse the same CMS slots as event city pages (networking_city_partner_*).
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
  document.body.setAttribute('data-region', slug);
  if (theme.accent) {
    document.body.style.setProperty('--opp-region-accent', theme.accent);
  }

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

  var intro = document.getElementById('networking-region-intro');
  if (intro) {
    intro.hidden = false;
    intro.setAttribute('data-region', slug);
  }

  var introHeading = document.getElementById('networking-region-intro-heading');
  if (introHeading) {
    introHeading.innerHTML =
      'Business opportunities in <span class="networking-region-name-accent"></span>';
    var nameAccent = introHeading.querySelector('.networking-region-name-accent');
    if (nameAccent) nameAccent.textContent = region.name;
  }

  var introCopy = theme.tagline
    ? theme.tagline + ' Browse live listings and enquire directly with providers.'
    : 'Browse franchises, side hustles, and partnerships across ' + region.name + '.';
  setText('networking-region-intro-copy', introCopy);

  var landmark = document.getElementById('networking-region-skyline');
  if (landmark) {
    landmark.className = 'networking-region-landmark';
    landmark.style.removeProperty('--skyline-image');
    landmark.innerHTML = theme.landmark || '';
    landmark.hidden = !theme.landmark;
  }

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

  var providerLink = document.getElementById('networking-region-provider-link');
  if (providerLink) providerLink.hidden = false;

  var partnerShell = document.getElementById('networking-region-city-partner');
  if (partnerShell && window.CmsAdBlocks) {
    if (
      !partnerShell.querySelector('.networking-city-partner-ad') &&
      window.CmsAdBlocks.renderCityPartnerPlaceholder
    ) {
      window.CmsAdBlocks.renderCityPartnerPlaceholder(partnerShell);
    }
    window.CmsAdBlocks.loadCmsAd('networking_city_partner_' + slug)
      .then(function (block) {
        if (block && window.CmsAdBlocks.renderCityPartnerAd(partnerShell, block)) return;
        if (window.CmsAdBlocks.renderCityPartnerPlaceholder) {
          window.CmsAdBlocks.renderCityPartnerPlaceholder(partnerShell);
        }
      })
      .catch(function () {
        if (window.CmsAdBlocks.renderCityPartnerPlaceholder) {
          window.CmsAdBlocks.renderCityPartnerPlaceholder(partnerShell);
        }
      });
  }
})();
