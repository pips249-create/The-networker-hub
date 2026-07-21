/**
 * Enhances the shared events directory when served at /networking/:region.
 * The allow-list mirrors api/_lib/networking-regions.js.
 */
(function () {
  var REGIONS = window.HUB_NETWORKING_REGIONS || {};

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
  var applyAccent = window.HUB_applyRegionAccentVars;
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
    if (accent) {
      accent.textContent = region.name + ' ' + year;
      if (theme.accentHero) accent.style.color = theme.accentHero;
    }
  }
  var lede = document.getElementById('events-hero-lede');
  if (lede) {
    lede.innerHTML =
      'Discover upcoming meetings, workshops, conferences and local networking communities across ' +
      region.name +
      '.<br>Filter by online/in person, date, location and price.';
  }
  setText('all-heading', 'Upcoming networking events in ' + region.name);

  var intro = document.getElementById('networking-region-intro');
  if (intro) {
    intro.hidden = false;
    intro.setAttribute('data-region', slug);
    if (applyAccent) applyAccent(intro, theme);
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

  var directory = document.getElementById('networking-location-directory');
  if (directory) {
    directory.classList.add('is-regional-landing');
    setText('networking-location-directory-heading', 'Other UK locations');
  }

  var currentLink = document.querySelector(
    '.home-location-chip[data-region="' + slug + '"], .networking-location-links a[data-region="' + slug + '"]'
  );
  if (currentLink) {
    currentLink.hidden = true;
  }

  function showCityPartnerLayout() {
    var organiserLink = document.getElementById('networking-region-organiser-link');
    if (organiserLink) organiserLink.hidden = false;
  }

  var partnerShell = document.getElementById('networking-region-city-partner');
  showCityPartnerLayout();
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
