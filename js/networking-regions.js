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
    } else if (slug === 'glasgow' || slug === 'bristol') {
      heading.innerHTML = 'Business networking events in <span class="accent"></span>';
      var cityAccent = heading.querySelector('.accent');
      if (cityAccent) {
        cityAccent.textContent = region.name;
        if (theme.accentHero) cityAccent.style.color = theme.accentHero;
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

  function articleFor(word) {
    return /^[aeiou]/i.test(String(word || '')) ? 'an' : 'a';
  }

  function listPlaces(places) {
    var items = (places || []).filter(Boolean);
    if (items.length <= 1) return items[0] || '';
    if (items.length === 2) return items[0] + ' and ' + items[1];
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  function cityNameFromSlug(citySlug) {
    return String(citySlug || '')
      .split('-')
      .filter(Boolean)
      .map(function (part) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(' ');
  }

  function buildCountyFaqs(county) {
    var name = county.name;
    var towns = county.towns && county.towns.length ? county.towns.slice() : [name];
    var townList = listPlaces(towns);
    var hubs = (county.cities || [])
      .map(function (citySlug) {
        var key = String(citySlug || '').trim().toLowerCase();
        if (!key) return null;
        return { name: cityNameFromSlug(key), path: '/networking/' + key };
      })
      .filter(Boolean);
    var together =
      towns.length > 1
        ? ', so ' +
          articleFor(towns[0]) +
          ' ' +
          towns[0] +
          ' event and ' +
          articleFor(towns[towns.length - 1]) +
          ' ' +
          towns[towns.length - 1] +
          ' group appear together'
        : '';
    var faqs = [
      {
        q: 'Which towns does networking in ' + name + ' cover?',
        a:
          'This page lists business networking across ' +
          name +
          ', including ' +
          townList +
          '. A meeting is included when the venue postcode falls in this county' +
          together +
          '.',
      },
    ];

    if (hubs.length === 1) {
      var hub = hubs[0];
      var others = towns.filter(function (town) {
        return town.toLowerCase() !== hub.name.toLowerCase();
      });
      faqs.push({
        q: 'Does ' + hub.name + ' have its own networking page?',
        a:
          'Yes. ' +
          hub.name +
          ' has a city hub at ' +
          hub.path +
          ' for events in and around the city. This ' +
          name +
          ' page is the wider county directory' +
          (others.length ? ', including ' + listPlaces(others) + ' as well as ' + hub.name : '') +
          '.',
      });
    } else if (hubs.length > 1) {
      var hubNames = hubs.map(function (item) {
        return item.name;
      });
      var otherTowns = towns.filter(function (town) {
        return hubNames.every(function (hubName) {
          return town.toLowerCase() !== hubName.toLowerCase();
        });
      });
      var hubSentence = hubs
        .map(function (item, index) {
          var line = item.name + ' has a city hub at ' + item.path;
          if (index === 0) return line;
          if (index === hubs.length - 1) return 'and ' + line;
          return line;
        })
        .join(', ');
      faqs.push({
        q: 'Do ' + listPlaces(hubNames) + ' have their own networking pages?',
        a:
          'Yes. ' +
          hubSentence +
          '. This ' +
          name +
          ' page covers the wider county' +
          (otherTowns.length
            ? ', including ' + listPlaces(otherTowns) + ' as well as ' + listPlaces(hubNames)
            : '') +
          '.',
      });
    } else {
      faqs.push({
        q: 'How do I find networking in a specific ' + name + ' town?',
        a:
          townList +
          ' are listed together on this ' +
          name +
          ' directory. Filter by location, or search the town name. Open an event to see the venue, or visit the organiser page for their next meetings.',
      });
    }

    faqs.push(
      {
        q: 'Are there free networking events in ' + name + '?',
        a:
          'Often, yes. Many organisers list a free meeting or a guest visit before you join a group. Tick Free in the price filters on this page, then open the listing to see what is included.',
      },
      {
        q: 'How do I list a networking group in ' + name + '?',
        a:
          'Claim a free organiser page and publish the meeting with its venue postcode. If that postcode sits in ' +
          name +
          ', the event is added to this directory automatically, including meetings in ' +
          townList +
          '. Start at /for-organisers.',
      },
      {
        q: 'Why might a nearby event not appear on the ' + name + ' page?',
        a:
          'Listings follow postcode areas, which are a practical match for the county and sometimes differ from the ceremonial boundary. An event appears here when its venue postcode is in the ' +
          name +
          ' sectors this directory uses. Search the town or postcode on the main events page at /events/ if you are looking just outside those sectors.',
      }
    );
    return faqs;
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
      var faqs =
        region.areaType === 'county'
          ? buildCountyFaqs(region)
          : [
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
