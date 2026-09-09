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
    areaType: region.areaType || 'city',
    accent: theme.accent || '',
  };
  document.body.classList.add('networking-region-page');
  document.body.setAttribute('data-region', slug);
  if (region.areaType === 'county') {
    document.body.classList.add('networking-county-page');
    document.body.setAttribute('data-area-type', 'county');
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  setText(
    'events-hero-badge',
    region.areaType === 'county' ? 'County networking directory' : 'Local networking directory'
  );
  var heading = document.getElementById('events-hero-heading');
  if (heading) {
    if (slug === 'online') {
      heading.innerHTML = 'Online networking events <span class="accent"></span>';
      var onlineAccent = heading.querySelector('.accent');
      if (onlineAccent) {
        onlineAccent.textContent = String(year);
        if (theme.accentHero) onlineAccent.style.color = theme.accentHero;
      }
    } else {
      heading.innerHTML = 'Networking in <span class="accent"></span>';
      var accent = heading.querySelector('.accent');
      if (accent) {
        accent.textContent = region.name;
        if (theme.accentHero) accent.style.color = theme.accentHero;
      }
    }
  }
  var lede = document.getElementById('events-hero-lede');
  if (lede) {
    if (slug === 'online') {
      lede.textContent =
        'Discover upcoming webinars, virtual meetings and workshops you can join from anywhere.';
    } else {
      lede.innerHTML =
        'Discover upcoming meetings, workshops, conferences and local networking communities across ' +
        region.name +
        '.<br>Filter by online/in person, date, location and price.';
    }
  }
  setText(
    'all-heading',
    slug === 'online'
      ? 'Upcoming online networking events'
      : 'Upcoming networking events in ' + region.name
  );

  var intro = document.getElementById('networking-region-intro');
  if (intro) {
    intro.hidden = false;
    intro.setAttribute('data-region', slug);
    if (applyAccent) applyAccent(intro, theme);
  }

  var introHeading = document.getElementById('networking-region-intro-heading');
  if (introHeading) {
    if (slug === 'online') {
      introHeading.textContent = 'Online business networking';
    } else {
      introHeading.innerHTML =
        'Business networking in <span class="networking-region-name-accent"></span>';
      var nameAccent = introHeading.querySelector('.networking-region-name-accent');
      if (nameAccent) nameAccent.textContent = region.name;
    }
  }

  var introCopyEl = document.getElementById('networking-region-intro-copy');
  var ssrAnswer = introCopyEl && introCopyEl.getAttribute('data-hub-ssr-answer');
  if (introCopyEl && !ssrAnswer) {
    var introCopy = theme.tagline
      ? theme.tagline +
        ' Find business networking ' +
        (slug === 'online' ? 'online' : 'in ' + region.name) +
        ' — browse live events and organiser communities on The Networker UK.'
      : 'Find business networking ' +
        (slug === 'online' ? 'online' : 'in ' + region.name) +
        '. Browse live events and organiser communities on The Networker UK.';
    setText('networking-region-intro-copy', introCopy);
  }

  var faqSection = document.getElementById('networking-region-faq');
  if (faqSection && !faqSection.getAttribute('data-hub-ssr-faq')) {
    faqSection.hidden = false;
    var faqHeading = document.getElementById('networking-region-faq-heading');
    if (faqHeading) {
      faqHeading.textContent =
        slug === 'online'
          ? 'Online networking — FAQ'
          : 'Networking in ' + region.name + ' — FAQ';
    }
    var faqList = document.getElementById('networking-region-faq-list');
    if (faqList && !faqList.children.length) {
      var place = slug === 'online' ? 'online' : 'in ' + region.name;
      var faqs = [
        {
          q:
            slug === 'online'
              ? 'Where can I find online networking events?'
              : 'Where can I find networking events ' + place + '?',
          a:
            'Browse upcoming business networking events on this page, then open a listing to book. You can also visit organiser pages to see their next meetings.',
        },
        {
          q:
            slug === 'online'
              ? 'Are there free online networking events?'
              : 'Are there free networking events ' + place + '?',
          a: 'Many organisers list free events or guest-visit options. Use filters to spot free and low-cost meetings.',
        },
        {
          q:
            slug === 'online'
              ? 'How do I list an online networking event?'
              : 'How do I list my networking group ' + place + '?',
          a: 'Claim a free organiser page and publish your meetings from the organiser dashboard. Start at /for-organisers.',
        },
        {
          q:
            slug === 'online'
              ? 'What types of online networking are listed?'
              : 'What types of networking happen ' + place + '?',
          a:
            slug === 'online'
              ? 'Webinars, virtual meetings, workshops and hybrid events you can join from anywhere.'
              : 'Breakfast meetings, evening mixers, workshops, conferences and industry groups — plus online options.',
        },
      ];
      faqList.innerHTML = faqs
        .map(function (item) {
          return (
            '<details class="networking-region-faq-item">' +
            '<summary class="networking-region-faq-q"></summary>' +
            '<p class="networking-region-faq-a"></p>' +
            '</details>'
          );
        })
        .join('');
      Array.prototype.forEach.call(faqList.querySelectorAll('.networking-region-faq-item'), function (el, i) {
        var q = el.querySelector('.networking-region-faq-q');
        var a = el.querySelector('.networking-region-faq-a');
        if (q) q.textContent = faqs[i].q;
        if (a) a.textContent = faqs[i].a;
      });
    }
  } else if (faqSection && faqSection.getAttribute('data-hub-ssr-faq')) {
    faqSection.hidden = false;
  }

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
    setText(
      'networking-location-directory-heading',
      region.areaType === 'county' ? 'Cities & other UK locations' : 'Other UK locations'
    );
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
  var partnerSlot =
    region.areaType === 'county'
      ? 'networking_county_partner_' + slug
      : 'networking_city_partner_' + slug;
  showCityPartnerLayout();
  if (partnerShell && window.CmsAdBlocks) {
    if (window.CmsAdBlocks.mountCityPartnerSlot) {
      window.CmsAdBlocks.mountCityPartnerSlot(partnerShell, partnerSlot);
    } else if (window.CmsAdBlocks.loadCmsAd && window.CmsAdBlocks.renderCityPartnerAd) {
      // Always replace the static HTML placeholder — do not bail when one is already in the DOM.
      if (window.CmsAdBlocks.renderCityPartnerPlaceholder) {
        window.CmsAdBlocks.renderCityPartnerPlaceholder(partnerShell, partnerSlot);
      }
      window.CmsAdBlocks.loadCmsAd(partnerSlot)
        .then(function (block) {
          if (block && window.CmsAdBlocks.renderCityPartnerAd(partnerShell, block, partnerSlot)) return;
          if (window.CmsAdBlocks.renderCityPartnerPlaceholder) {
            window.CmsAdBlocks.renderCityPartnerPlaceholder(partnerShell, partnerSlot);
          }
        })
        .catch(function () {
          if (window.CmsAdBlocks.renderCityPartnerPlaceholder) {
            window.CmsAdBlocks.renderCityPartnerPlaceholder(partnerShell, partnerSlot);
          }
        });
    }
  }
})();
