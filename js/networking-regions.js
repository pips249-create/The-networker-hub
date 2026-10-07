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

  var faqAccent = document.getElementById('networking-region-faq');
  if (faqAccent && applyAccent) applyAccent(faqAccent, theme);

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
      var local = String(theme.tagline || '').replace(/\.\s*$/, '');
      var fromLine = /^from\b/i.test(local) ? local.charAt(0).toLowerCase() + local.slice(1) : '';
      var faqs = [
        {
          q:
            slug === 'online'
              ? 'Where can I find online networking events?'
              : 'Where can I find networking events ' + place + '?',
          a:
            slug === 'online'
              ? 'Online networking events are listed on this page. Each listing shows whether it is a webinar, virtual meeting or workshop, plus the date and ticket price. Filter by date, open an event to book, or visit an organiser page to see that group’s next sessions.'
              : 'Networking events ' +
                place +
                ' are listed on this page.' +
                (fromLine ? ' Coverage runs ' + fromLine + '.' : local ? ' ' + local + '.' : '') +
                ' Open an event to see the date, format and price, then book a ticket, or open an organiser page to see that group’s next meetings.',
        },
        {
          q:
            slug === 'online'
              ? 'Are there free online networking events?'
              : 'Are there free networking events ' + place + '?',
          a:
            slug === 'online'
              ? 'Yes. Free online networking is listed alongside paid webinars and virtual meetings. Many organisers also offer a guest visit so you can try a group before you join. Use the price filter to show free and low-cost sessions, then open a listing to confirm a guest ticket is available.'
              : 'Yes. Free networking ' +
                place +
                ' is listed on this page alongside paid breakfasts, mixers and workshops. Many groups offer a guest visit so you can try a meeting before you join. Filter by price to show free and low-cost events, then open a listing or the organiser’s page to confirm a guest ticket.',
        },
        {
          q:
            slug === 'online'
              ? 'How do I list an online networking event?'
              : 'How do I list my networking group ' + place + '?',
          a:
            slug === 'online'
              ? 'List an online networking event by claiming a free organiser page, then publishing the meeting from the organiser dashboard. Once it is live it can appear in the online directory with the date, format and ticket price, so people can find it and book. Begin at /for-organisers.'
              : 'List a networking group ' +
                place +
                ' by claiming a free organiser page, then publishing your meetings from the organiser dashboard. Once a meeting is live it can appear in the ' +
                region.name +
                ' directory, with the date, format and ticket price, so people can find it and book. Begin at /for-organisers.',
        },
        {
          q:
            slug === 'online'
              ? 'What types of online networking are listed?'
              : 'What types of networking happen ' + place + '?',
          a:
            slug === 'online'
              ? 'Online networking here covers webinars, virtual meetings, workshops and hybrid events you can join from anywhere in the UK. Filter this page by date and price to see what is coming up, then book a ticket from the event page.'
              : 'Networking ' +
                place +
                ' includes breakfast meetings, evening mixers, workshops, conferences, exhibitions and industry groups' +
                (fromLine ? ', ' + fromLine : '') +
                '. Hybrid and online meetings you can join from ' +
                region.name +
                ' are listed too. Filter this page by format, date and price to see what is on, then book from the event page.',
        },
      ];
      faqList.innerHTML = faqs
        .map(function (_item, i) {
          return (
            '<details class="networking-region-faq-item" name="networking-region-faq"' +
            (i === 0 ? ' open' : '') +
            '>' +
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

  if (faqSection && !faqSection.getAttribute('data-faq-exclusive')) {
    faqSection.setAttribute('data-faq-exclusive', '1');
    faqSection.addEventListener('click', function (event) {
      var summary = event.target.closest ? event.target.closest('.networking-region-faq-q') : null;
      if (!summary || !faqSection.contains(summary)) return;
      var item = summary.parentElement;
      if (item && item.open) event.preventDefault();
    });
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
