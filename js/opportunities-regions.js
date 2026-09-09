/**
 * City/county landing pages for business opportunities — /opportunities/networking/:region
 * (rewrites to /opportunities/?city=:region). Mirrors js/networking-regions.js.
 * Opportunities County Sponsor uses opportunity_county_sponsor_* — separate from Events
 * networking_county_partner_* slots. City Sponsor stays Events-only.
 * Industry Sponsor mounts from opportunities-page.js when ?category= is set.
 */
(function () {
  var REGIONS = window.HUB_NETWORKING_REGIONS || {};

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
  var applyAccent = window.HUB_applyRegionAccentVars;
  var year = new Date().getFullYear();
  var isCounty = region.areaType === 'county';
  var countySponsorSlot = 'opportunity_county_sponsor_' + slug;

  window.hubOppRegionalLanding = {
    slug: slug,
    name: region.name,
    cityQuery: region.name,
    areaType: region.areaType || 'city',
    accent: theme.accent || '',
  };

  document.body.classList.add('networking-region-page');
  document.body.classList.add('opp-regional-landing');
  document.body.setAttribute('data-opp-region', slug);
  document.body.setAttribute('data-region', slug);
  if (isCounty) {
    document.body.classList.add('networking-county-page');
    document.body.setAttribute('data-area-type', 'county');
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  setText('opp-hero-badge', isCounty ? 'County opportunity directory' : 'Local opportunity directory');
  var heading = document.getElementById('opp-hero-heading');
  if (heading) {
    heading.innerHTML =
      'The best business opportunities in <span class="accent"></span>';
    var accent = heading.querySelector('.accent');
    if (accent) {
      accent.textContent = region.name + ' ' + year;
      if (theme.accentHero) accent.style.color = theme.accentHero;
    }
  }
  var lede = document.getElementById('opp-hero-lede');
  if (lede) {
    lede.innerHTML =
      'Franchises, side hustles, partnerships and more across ' +
      region.name +
      '.<br>Browse free and enquire directly with providers.';
  }
  setText('opp-listings-heading', 'Business opportunities in ' + region.name);

  var listingsHeading = document.getElementById('opp-listings-heading');
  if (listingsHeading) listingsHeading.hidden = false;

  var intro = document.getElementById('networking-region-intro');
  if (intro) {
    intro.hidden = false;
    intro.setAttribute('data-region', slug);
    if (applyAccent) applyAccent(intro, theme);
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
    // County pages prefer the County Sponsor slot over the landmark mark.
    landmark.hidden = isCounty || !theme.landmark;
  }

  var directory = document.getElementById('networking-location-directory');
  if (directory) {
    directory.classList.add('is-regional-landing');
    setText('networking-location-directory-heading', 'Other UK counties');
  }

  var currentLink = document.querySelector(
    '.home-location-chip[data-region="' + slug + '"], .networking-location-links a[data-region="' + slug + '"]'
  );
  if (currentLink) {
    currentLink.hidden = true;
  }

  var providerLink = document.getElementById('networking-region-organiser-link');
  if (providerLink) providerLink.hidden = false;

  var partnerShell = document.getElementById('networking-region-city-partner');
  if (partnerShell) {
    if (isCounty && window.CmsAdBlocks && window.CmsAdBlocks.mountCityPartnerSlot) {
      partnerShell.hidden = false;
      partnerShell.removeAttribute('hidden');
      window.CmsAdBlocks.mountCityPartnerSlot(partnerShell, countySponsorSlot);
    } else if (isCounty && window.CmsAdBlocks && window.CmsAdBlocks.renderCityPartnerPlaceholder) {
      partnerShell.hidden = false;
      partnerShell.removeAttribute('hidden');
      window.CmsAdBlocks.renderCityPartnerPlaceholder(partnerShell, countySponsorSlot);
    } else {
      // City Sponsor is Events-only — leave opportunities city pages without a region ad.
      partnerShell.hidden = true;
      partnerShell.innerHTML = '';
    }
  }
})();
