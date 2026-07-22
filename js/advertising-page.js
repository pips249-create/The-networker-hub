(function () {
  var DEMO_HUB_LOGO = '/assets/advertising-example-hub-logo.png';

  var DEMO_SPONSOR = {
    active: true,
    logo_url: '/assets/advertising-example-everlasting-build.png',
    company_name: 'Everlasting Build',
    title: 'Renovations & construction you can trust',
    cta_label: 'Find out more →',
    cta_url: 'https://example.com',
  };

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function initHeroEntrance() {}

  function scrollToAnchor(id) {
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    window.setTimeout(function () {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }

  function initReveal() {
    var sections = document.querySelectorAll('.ad-reveal:not([hidden])');
    if (!sections.length) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sections.forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    if (!window.IntersectionObserver) {
      sections.forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );

    sections.forEach(function (el) {
      io.observe(el);
    });
  }

  var PACKAGE_PANEL = {
    'ad-pkg-events-main': 'events',
    'ad-pkg-events-mini': 'events',
    'city-partner-package': 'events',
    'ad-pkg-events-spotlight': 'events',
    'ad-pkg-organisers-main': 'organisers',
    'ad-pkg-organisers-mini': 'organisers',
    'ad-pkg-organisers-spotlight': 'organisers',
    'ad-pkg-opportunities-main': 'opportunities',
    'ad-pkg-opportunities-mini': 'opportunities',
    'ad-pkg-opportunities-city-partner': 'opportunities',
    'ad-pkg-opportunities-listing': 'opportunities',
    'ad-pkg-opportunities-spotlight': 'opportunities',
  };

  var PRICING_GLANCE = {
    events: [
      {
        name: 'Main Events Directory Sponsor',
        detail: 'Browse hero + 3k–80k total impressions/mo',
        price: '£2,000/mo',
        type: 'Third-party brand',
        typeClass: 'brand',
        anchor: 'ad-pkg-events-main',
      },
      {
        name: 'Mini Sponsors',
        detail: 'Event pages + selected attendee emails',
        price: '£600/slot/mo',
        type: 'Third-party brand',
        typeClass: 'brand',
        anchor: 'ad-pkg-events-mini',
      },
      {
        name: 'City Partner',
        detail: 'City pages — self-serve checkout when available (+ VAT)',
        price: 'From £29/city/mo + VAT',
        type: 'Self-serve checkout',
        typeClass: 'self',
        anchor: 'city-partner-package',
      },
      {
        name: 'Featured Listing — Events',
        detail: 'Pinned to top of events directory',
        price: '£55/mo',
        type: 'Organiser self-serve',
        typeClass: 'self',
        anchor: 'ad-pkg-events-spotlight',
      },
    ],
    organisers: [
      {
        name: 'Main Organisers Directory Sponsor',
        detail: 'Main Sponsor banner + 400–18k organiser emails/mo',
        price: '£1,000/mo',
        type: 'Third-party brand',
        typeClass: 'brand',
        anchor: 'ad-pkg-organisers-main',
      },
      {
        name: 'Mini Sponsors',
        detail: 'Organiser profiles + selected organiser emails',
        price: '£300/slot/mo',
        type: 'Third-party brand',
        typeClass: 'brand',
        anchor: 'ad-pkg-organisers-mini',
      },
      {
        name: 'Featured Listing — Organisers',
        detail: 'Pinned to top of organisers browse',
        price: '£27.50/mo',
        type: 'Organiser self-serve',
        typeClass: 'self',
        anchor: 'ad-pkg-organisers-spotlight',
      },
    ],
    opportunities: [
      {
        name: 'Main Opportunities Directory Sponsor',
        detail: 'Main Sponsor banner + 250–12k opportunity emails/mo',
        price: '£2,000/mo',
        type: 'Third-party brand',
        typeClass: 'brand',
        anchor: 'ad-pkg-opportunities-main',
      },
      {
        name: 'Mini Sponsors',
        detail: 'Detail pages + selected opportunity emails',
        price: '£600/slot/mo',
        type: 'Third-party brand',
        typeClass: 'brand',
        anchor: 'ad-pkg-opportunities-mini',
      },
      {
        name: 'City Partner',
        detail: 'Shared city inventory — checkout on Events tab (+ VAT)',
        price: 'From £29/city/mo + VAT',
        type: 'Self-serve checkout',
        typeClass: 'self',
        anchor: 'city-partner-package',
      },
      {
        name: 'Directory Listing',
        detail: 'Standard opportunity listing',
        price: '£25/mo + VAT',
        type: 'Lister self-serve',
        typeClass: 'self',
        anchor: 'ad-pkg-opportunities-listing',
      },
      {
        name: 'Featured Listing — Opportunities',
        detail: 'Pinned to top of opportunities browse',
        price: '£55/mo',
        type: 'Lister self-serve',
        typeClass: 'self',
        anchor: 'ad-pkg-opportunities-spotlight',
      },
    ],
  };

  var MAIN_SPONSOR_SLOTS = [
    {
      section: 'events',
      slot: 'events_sponsor_hub',
      label: 'Events Main Sponsor',
      price: '£2,000/mo',
      anchor: 'ad-pkg-events-main',
    },
    {
      section: 'organisers',
      slot: 'organisers_sponsor_hub',
      label: 'Organisers Main Sponsor',
      price: '£1,000/mo',
      anchor: 'ad-pkg-organisers-main',
    },
    {
      section: 'opportunities',
      slot: 'opportunities_sponsor_hub',
      label: 'Opportunities Main Sponsor',
      price: '£2,000/mo',
      anchor: 'ad-pkg-opportunities-main',
    },
  ];

  var ENQUIRY_SECTION_LABELS = {
    events: 'Events',
    organisers: 'Organisers',
    opportunities: 'Opportunities',
  };

  var ENQUIRY_PACKAGES = {
    events: ['Main Sponsor', 'Mini Sponsors', 'Featured Listing', 'Not sure yet'],
    organisers: ['Main Sponsor', 'Mini Sponsors', 'Featured Listing', 'Not sure yet'],
    opportunities: [
      'Main Sponsor',
      'Mini Sponsors',
      'Directory Listing',
      'Featured Listing',
      'Not sure yet',
    ],
  };

  function packageLabelFromArticle(article) {
    var custom = article.getAttribute('data-ad-package-label');
    if (custom) return custom.trim();
    var badge = article.querySelector('.ad-package-badge');
    if (badge) return badge.textContent.trim();
    var title = article.querySelector('.ad-package-title');
    return title ? title.textContent.trim() : 'Package';
  }

  function packagePriceFromArticle(article) {
    var priceEl = article.querySelector('.ad-package-price');
    if (!priceEl) return '';
    var first = priceEl.childNodes[0];
    return first && first.nodeType === 3 ? first.textContent.trim() : priceEl.textContent.trim().split('\n')[0];
  }

  function activatePackageInPanel(panel, packageId, options) {
    if (!panel || !packageId) return false;
    var browser = panel.querySelector('.ad-package-browser');
    if (!browser) return false;

    var tabs = browser.querySelectorAll('.ad-package-tab');
    var articles = browser.querySelectorAll('.ad-package');
    var found = false;

    articles.forEach(function (article) {
      var active = article.id === packageId;
      article.hidden = !active;
      article.classList.toggle('is-active-package', active);
      if (active) found = true;
    });

    tabs.forEach(function (tab) {
      var active = tab.getAttribute('data-ad-package-target') === packageId;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
    });

    if (found && options && options.scroll) {
      browser.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    return found;
  }

  function initPackageTabs() {
    document.querySelectorAll('.ad-tab-panel').forEach(function (panel) {
      var browser = panel.querySelector('.ad-package-browser');
      if (!browser) return;

      var packagesWrap = browser.querySelector('.ad-packages');
      if (!packagesWrap) return;

      var articles = packagesWrap.querySelectorAll('.ad-package');
      if (!articles.length) return;

      var nav = document.createElement('nav');
      nav.className = 'ad-package-tabs';
      nav.setAttribute('role', 'tablist');
      nav.setAttribute('aria-label', 'Packages');

      articles.forEach(function (article, index) {
        var id = article.id;
        if (!id) return;

        var label = packageLabelFromArticle(article);
        var price = packagePriceFromArticle(article);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ad-package-tab' + (index === 0 ? ' is-active' : '');
        btn.setAttribute('role', 'tab');
        btn.setAttribute('data-ad-package-target', id);
        btn.setAttribute('aria-controls', id);
        btn.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
        btn.tabIndex = index === 0 ? 0 : -1;
        btn.innerHTML =
          '<span class="ad-package-tab-label">' +
          esc(label) +
          '</span>' +
          (price ? '<span class="ad-package-tab-price">' + esc(price) + '</span>' : '');

        btn.addEventListener('click', function () {
          activatePackageInPanel(panel, id);
          if (history.replaceState) {
            history.replaceState(null, '', '#' + id);
          }
          window.dispatchEvent(new CustomEvent('ad-package-tab-change', { detail: { id: id } }));
        });

        nav.appendChild(btn);
        article.hidden = index !== 0;
        article.classList.toggle('is-active-package', index === 0);
      });

      browser.insertBefore(nav, packagesWrap);

      nav.addEventListener('keydown', function (e) {
        var tabs = Array.prototype.slice.call(nav.querySelectorAll('.ad-package-tab'));
        var current = document.activeElement;
        var idx = tabs.indexOf(current);
        if (idx < 0) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          var next = e.key === 'ArrowRight' ? idx + 1 : idx - 1;
          if (next < 0) next = tabs.length - 1;
          if (next >= tabs.length) next = 0;
          tabs[next].focus();
          tabs[next].click();
        }
      });
    });
  }

  function syncEnquiryFormSection(section) {
    var sectionEl = document.getElementById('ad-enquiry-section');
    var packageEl = document.getElementById('ad-enquiry-package');
    if (!sectionEl || !packageEl) return;

    var label = ENQUIRY_SECTION_LABELS[section] || 'Events';
    Array.prototype.forEach.call(sectionEl.options, function (opt) {
      opt.selected = opt.value === label;
    });

    var packages = ENQUIRY_PACKAGES[section] || ENQUIRY_PACKAGES.events;
    packageEl.innerHTML = packages
      .map(function (name) {
        return '<option value="' + esc(name) + '">' + esc(name) + '</option>';
      })
      .join('');
  }

  function initEnquiryForm() {
    var form = document.getElementById('ad-enquiry-form');
    if (!form) return;

    var packageEl = document.getElementById('ad-enquiry-package');
    var cityPartnerNote = document.getElementById('ad-enquiry-city-partner-note');

    function syncCityPartnerEnquiryNote() {
      if (!cityPartnerNote || !packageEl) return;
      var isCityPartner = String(packageEl.value || '').trim() === 'City Partner';
      cityPartnerNote.hidden = !isCityPartner;
    }

    if (packageEl) {
      packageEl.addEventListener('change', syncCityPartnerEnquiryNote);
      syncCityPartnerEnquiryNote();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var company = String(fd.get('company') || '').trim();
      var name = String(fd.get('name') || '').trim();
      var email = String(fd.get('email') || '').trim();
      var section = String(fd.get('section') || '').trim();
      var pkg = String(fd.get('package') || '').trim();
      var budget = String(fd.get('budget') || '').trim();
      var message = String(fd.get('message') || '').trim();

      var subject = 'Advertising enquiry — ' + (pkg || 'package') + ' (' + section + ')';
      var body =
        'Company: ' +
        company +
        '\nContact: ' +
        name +
        '\nEmail: ' +
        email +
        '\nSection: ' +
        section +
        '\nPackage: ' +
        pkg +
        (budget ? '\nBudget: ' + budget : '') +
        (message ? '\n\nMessage:\n' + message : '');

      window.location.href =
        'mailto:rosie@thenetworkerhub.com?subject=' +
        encodeURIComponent(subject) +
        '&body=' +
        encodeURIComponent(body);
    });
  }

  function sponsorBlockIsLive(block) {
    if (!block) return false;
    if (block.active === false) return false;
    var logo = String(block.logo_url || '').trim();
    var company = String(block.company_name || '').trim();
    return !!(logo || company);
  }

  function companyFromSponsorBlock(block) {
    if (!block) return '';
    if (window.CmsSponsorFields && window.CmsSponsorFields.companyName) {
      return String(window.CmsSponsorFields.companyName(block) || '').trim();
    }
    return String(block.company_name || '').trim();
  }

  function loadMainSponsorAvailability() {
    var list = document.getElementById('ad-availability-list');
    if (!list) return;

    var monthLabel = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    Promise.all(
      MAIN_SPONSOR_SLOTS.map(function (entry) {
        return fetch('/api/cms-block?slot=' + encodeURIComponent(entry.slot), { credentials: 'same-origin' })
          .then(function (res) {
            return res.json();
          })
          .then(function (data) {
            return { entry: entry, block: data && data.block ? data.block : null };
          })
          .catch(function () {
            return { entry: entry, block: null, error: true };
          });
      })
    ).then(function (results) {
      list.innerHTML = results
        .map(function (result) {
          var entry = result.entry;
          if (result.error) {
            return (
              '<li class="ad-availability-item ad-availability-item--error">' +
              '<div><strong>' +
              esc(entry.label) +
              '</strong> <span>' +
              esc(entry.price) +
              '</span></div>' +
              '<em>Status unavailable</em>' +
              '</li>'
            );
          }

          var live = sponsorBlockIsLive(result.block);
          var company = companyFromSponsorBlock(result.block);
          var statusClass = live ? 'booked' : 'available';
          var statusLabel = live ? 'Live now' : 'Available';
          var detail = live
            ? 'Showing ' + (company || 'a partner') + ' — enquire for ' + monthLabel + '+'
            : 'Open for ' + monthLabel;

          return (
            '<li class="ad-availability-item ad-availability-item--' +
            statusClass +
            '">' +
            '<div><strong>' +
            esc(entry.label) +
            '</strong> <span>' +
            esc(entry.price) +
            ' · ' +
            esc(detail) +
            '</span></div>' +
            '<em>' +
            esc(statusLabel) +
            '</em>' +
            '</li>'
          );
        })
        .join('');
    });
  }

  function renderMiniSponsorEmailPreview(container, block) {
    if (!container) return;
    block = block || DEMO_SPONSOR;
    var logo = String(block.logo_url || DEMO_SPONSOR.logo_url).trim();
    var company = String(block.company_name || DEMO_SPONSOR.company_name).trim();
    var logoCell =
      '<img src="' +
      esc(logo) +
      '" alt="' +
      esc(company) +
      '" loading="lazy" decoding="async">';

    renderSponsorEmailPreview(container, block, {
      kicker: 'Booking confirmed',
      title: 'You\u2019re booked in',
      lede: 'Your place is reserved. We\u2019ve sent the details below.',
      detailHtml:
        '<div class="ad-full-email-event-wrap">' +
        '<div class="ad-full-email-event">' +
        '<p class="ad-full-email-event-kicker">Your event</p>' +
        '<p class="ad-full-email-event-name">Women in Business Breakfast</p>' +
        '<p class="ad-full-email-event-date"><span>When &amp; where</span><strong>Wed 14 Aug · Manchester</strong></p>' +
        '</div>' +
        '</div>' +
        '<div class="ad-full-email-mini-row">' +
        '<p class="ad-full-email-mini-row-label">Sponsored partners</p>' +
        '<div class="ad-full-email-mini-row-logos">' +
        logoCell +
        logoCell +
        logoCell +
        '</div>' +
        '</div>',
    });
  }

  function syncSectionPackages(section) {
    syncEnquiryFormSection(section);
  }

  function renderPricingGlance(section) {
    var body = document.getElementById('ad-pricing-table-body');
    var hint = document.querySelector('.ad-pricing-glance-toggle-hint');
    var glance = document.getElementById('ad-pricing-glance');
    if (!body) return;

    if (glance) {
      glance.classList.remove(
        'ad-pricing-glance--events',
        'ad-pricing-glance--organisers',
        'ad-pricing-glance--opportunities'
      );
      glance.classList.add('ad-pricing-glance--' + section);
    }

    var rows = PRICING_GLANCE[section] || PRICING_GLANCE.events;
    var labels = {
      events: 'Events directory packages',
      organisers: 'Organisers directory packages',
      opportunities: 'Opportunities directory packages',
    };

    if (hint) hint.textContent = labels[section] || 'Guide rates for this section';

    body.innerHTML = rows
      .map(function (row) {
        return (
          '<tr>' +
          '<td><a class="ad-pricing-row-link" href="#' +
          esc(row.anchor) +
          '" data-ad-pricing-jump="' +
          esc(row.anchor) +
          '"><strong>' +
          esc(row.name) +
          '</strong><span>' +
          esc(row.detail) +
          '</span></a></td>' +
          '<td class="ad-pricing-price">' +
          esc(row.price) +
          '</td>' +
          '<td><span class="ad-pricing-type ad-pricing-type--' +
          esc(row.typeClass) +
          '">' +
          esc(row.type) +
          '</span></td>' +
          '</tr>'
        );
      })
      .join('');

    body.querySelectorAll('[data-ad-pricing-jump]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        jumpToPackage(link.getAttribute('data-ad-pricing-jump'));
      });
    });
  }

  function jumpToPackage(id) {
    if (!id) return;
    var panelName = PACKAGE_PANEL[id];
    if (panelName) {
      var tabsRoot = document.getElementById('ad-section-picks');
      var tab = tabsRoot && tabsRoot.querySelector('[data-ad-tab="' + panelName + '"]');
      if (tab && !tab.classList.contains('is-active')) {
        tab.click();
      }
    }

    window.setTimeout(function () {
      var panel = panelName
        ? document.querySelector('[data-ad-panel="' + panelName + '"]')
        : null;
      if (panel && activatePackageInPanel(panel, id, { scroll: true })) {
        return;
      }
      var el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, panelName ? 80 : 0);
  }

  function initTabJumpLinks() {
    document.querySelectorAll('[data-ad-tab-jump]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var targetTab = link.getAttribute('data-ad-tab-jump');
        var hash = String(link.getAttribute('href') || '').replace(/^#/, '');
        if (!targetTab || !hash) return;
        e.preventDefault();
        var tabsRoot = document.getElementById('ad-section-picks');
        var tab = tabsRoot && tabsRoot.querySelector('[data-ad-tab="' + targetTab + '"]');
        if (tab && !tab.classList.contains('is-active')) {
          tab.click();
        }
        window.setTimeout(function () {
          jumpToPackage(hash);
        }, 80);
      });
    });
  }

  function initPricingGlanceLinks() {
    syncSectionPackages('events');
    renderPricingGlance('events');
  }

  function logoFromBlock(block) {
    if (!block || !window.CmsSponsorFields) return '';
    return window.CmsSponsorFields.logoUrl(block);
  }

  function companyFromBlock(block) {
    if (!block || !window.CmsSponsorFields) return '';
    return window.CmsSponsorFields.companyName(block);
  }

  function ctaUrlFromBlock(block) {
    if (!block) return '#';
    var url = String(block.cta_url || '').trim();
    return /^(https?:|mailto:)/i.test(url) ? url : '#';
  }

  function renderEmptyPreview(container, message) {
    if (!container) return;
    container.innerHTML =
      '<p class="ad-live-empty">' + esc(message || 'Live example not configured yet.') + '</p>';
  }

  function renderDemoHeroSponsor(container, block) {
    if (!container) return;
    block = block || DEMO_SPONSOR;
    var logo = String(block.logo_url || '').trim();
    var company = String(block.company_name || '').trim();
    var tagline = String(block.title || block.tagline || '').trim();
    var ctaLabel = String(block.cta_label || 'Find out more →').trim();

    container.innerHTML =
      '<aside class="ad-mock-sponsor">' +
      '<span class="ad-mock-sponsor-badge">Sponsored</span>' +
      '<div class="ad-mock-logo-band">' +
      (logo
        ? '<img src="' +
          esc(logo) +
          '" alt="' +
          esc(company) +
          '" class="ad-mock-sponsor-logo-img" loading="lazy" decoding="async">'
        : '<span class="ad-mock-logo">' + esc(company || 'Your logo') + '</span>') +
      '</div>' +
      (company ? '<p class="ad-mock-tagline"><strong>' + esc(company) + '</strong></p>' : '') +
      (tagline ? '<p class="ad-mock-tagline-desc">' + esc(tagline) + '</p>' : '') +
      '<span class="ad-mock-cta">' +
      esc(ctaLabel) +
      '</span>' +
      '</aside>';
  }

  function renderDemoMiniSponsor(container, block) {
    if (!container) return;
    block = block || DEMO_SPONSOR;
    var logo = String(block.logo_url || '').trim();
    container.innerHTML =
      '<aside class="ad-mock-carousel">' +
      '<span class="ad-mock-carousel-badge">Sponsored</span>' +
      '<div class="ad-mock-carousel-logos ad-mock-carousel-logos--single">' +
      (logo
        ? '<img src="' +
          esc(logo) +
          '" alt="" class="ad-mock-carousel-logo-img" loading="lazy" decoding="async">'
        : '<span class="is-active">Your logo</span>') +
      '</div>' +
      '<div class="ad-mock-carousel-dots" aria-hidden="true"><i class="is-active"></i><i></i><i></i></div>' +
      '</aside>';
  }

  function renderDemoCompactAd(container, block) {
    if (!container) return;
    block = block || DEMO_SPONSOR;
    var logo = String(block.logo_url || '').trim();
    var ctaLabel = String(block.cta_label || 'Find out more →').trim();

    container.innerHTML =
      '<aside class="ad-mock-compact">' +
      '<span class="ad-mock-compact-badge">Sponsored</span>' +
      '<div class="ad-mock-compact-logo-wrap">' +
      (logo
        ? '<img src="' +
          esc(logo) +
          '" alt="" class="ad-mock-compact-logo-img" loading="lazy" decoding="async">'
        : '<span class="ad-mock-compact-logo-placeholder">Your logo</span>') +
      '</div>' +
      '<span class="ad-mock-compact-cta">' +
      esc(ctaLabel) +
      '</span>' +
      '</aside>';
  }

  function renderHeroInShell(shell, block) {
    if (!shell) return;
    if (!block || block.active === false) {
      renderEmptyPreview(shell);
      return;
    }
    renderDemoHeroSponsor(shell, block);
  }

  function buildSponsorEmailRow(block) {
    var logo = logoFromBlock(block);
    var company = companyFromBlock(block);
    var url = ctaUrlFromBlock(block);
    var hasLogo = !!(logo && String(logo).trim());
    var logoInner = hasLogo
      ? '<img src="' +
        esc(logo) +
        '" alt="' +
        esc(company || 'Sponsor') +
        '" class="ad-full-email-sponsor-logo" loading="lazy" decoding="async">'
      : '<span class="ad-full-email-sponsor-name">' + esc(company || 'Sponsor logo') + '</span>';
    return (
      '<div class="ad-full-email-sponsor ad-full-email-sponsor--highlight">' +
      '<span class="ad-email-line ad-email-line--sponsor-kicker"></span>' +
      (url !== '#' ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + logoInner + '</a>' : logoInner) +
      '</div>'
    );
  }

  function renderSponsorEmailPreview(container, block, config) {
    if (!container) return;
    if (!block || block.active === false) {
      renderEmptyPreview(container);
      return;
    }

    config = config || {};
    var sponsorRow = buildSponsorEmailRow(block);
    container.innerHTML =
      '<div class="ad-full-email-card">' +
      '<div class="ad-full-email-header">' +
      '<img src="' +
      DEMO_HUB_LOGO +
      '" alt="" class="ad-full-email-hub-logo">' +
      sponsorRow +
      '<div class="ad-full-email-wave" aria-hidden="true"></div>' +
      '</div>' +
      '<div class="ad-full-email-body">' +
      '<div class="ad-full-email-check" aria-hidden="true"></div>' +
      '<p class="ad-full-email-kicker">' +
      esc(config.kicker || 'Update from The Networker Hub') +
      '</p>' +
      '<p class="ad-full-email-title">' +
      esc(config.title || 'You have a new notification') +
      '</p>' +
      '<p class="ad-full-email-lede">' +
      esc(config.lede || 'Details are included below for your records.') +
      '</p>' +
      '</div>' +
      (config.detailHtml || '') +
      '<div class="ad-full-email-footer">' +
      '<p class="ad-full-email-footer-note">Questions? Reply to this email or visit your account.</p>' +
      '</div>' +
      '<div class="ad-full-email-brand">' +
      '<img src="' +
      DEMO_HUB_LOGO +
      '" alt="" class="ad-full-email-hub-logo ad-full-email-hub-logo--sm">' +
      '<p class="ad-full-email-brand-name">The Networker Hub</p>' +
      '</div>' +
      '</div>';
  }

  function renderFullBookingEmail(container, block) {
    renderSponsorEmailPreview(container, block, {
      kicker: 'Booking confirmed',
      title: 'You\u2019re booked in',
      lede: 'Your place is reserved. We\u2019ve sent the details below.',
      detailHtml:
        '<div class="ad-full-email-event-wrap">' +
        '<div class="ad-full-email-event">' +
        '<p class="ad-full-email-event-kicker">Your event</p>' +
        '<p class="ad-full-email-event-name">Women in Business Breakfast</p>' +
        '<p class="ad-full-email-event-date"><span>When &amp; where</span><strong>Wed 14 Aug · Manchester · In person</strong></p>' +
        '<div class="ad-full-email-event-meta">' +
        '<div><span>Ticket</span><strong>General admission</strong></div>' +
        '<div><span>Price</span><strong>Free</strong></div>' +
        '<div><span>Status</span><strong>Confirmed</strong></div>' +
        '</div>' +
        '<span class="ad-full-email-event-cta">View event details</span>' +
        '</div>' +
        '</div>' +
        '<div class="ad-full-email-upsell-wrap">' +
        '<div class="ad-full-email-upsell">' +
        '<p class="ad-full-email-upsell-kicker">While you\u2019re here</p>' +
        '<p class="ad-full-email-upsell-title">Discover more events near you</p>' +
        '</div>' +
        '</div>',
    });
  }

  function renderOrganiserEmailPreview(container, block) {
    renderSponsorEmailPreview(container, block, {
      kicker: 'Payout approved',
      title: 'Your payout is on its way',
      lede: 'We\u2019ve approved your payout request. Funds should arrive within 3\u20135 working days.',
      detailHtml:
        '<div class="ad-full-email-event-wrap">' +
        '<div class="ad-full-email-event">' +
        '<p class="ad-full-email-event-kicker">Payout summary</p>' +
        '<p class="ad-full-email-event-name">Manchester Business Network</p>' +
        '<p class="ad-full-email-event-date"><span>Amount</span><strong>£420.00</strong></p>' +
        '<div class="ad-full-email-event-meta">' +
        '<div><span>Reference</span><strong>PO-10482</strong></div>' +
        '<div><span>Status</span><strong>Approved</strong></div>' +
        '</div>' +
        '</div>' +
        '</div>',
    });
  }

  function renderOpportunityEmailPreview(container, block) {
    renderSponsorEmailPreview(container, block, {
      kicker: 'Listing live',
      title: 'Your opportunity is now live',
      lede: 'Your business opportunity listing is published and visible to members browsing the directory.',
      detailHtml:
        '<div class="ad-full-email-event-wrap">' +
        '<div class="ad-full-email-event">' +
        '<p class="ad-full-email-event-kicker">Your listing</p>' +
        '<p class="ad-full-email-event-name">Coffee shop franchise — Manchester</p>' +
        '<p class="ad-full-email-event-date"><span>Category</span><strong>Franchise · North West</strong></p>' +
        '<div class="ad-full-email-event-meta">' +
        '<div><span>Status</span><strong>Live</strong></div>' +
        '<div><span>Enquiries</span><strong>Open</strong></div>' +
        '</div>' +
        '<span class="ad-full-email-event-cta">View listing</span>' +
        '</div>' +
        '</div>',
    });
  }

  function loadMainSponsorGallery() {
    var eventsShell = document.getElementById('ad-live-events-hero');
    var emailShell = document.getElementById('ad-live-full-email');
    if (!eventsShell && !emailShell) return;

    renderHeroInShell(eventsShell, DEMO_SPONSOR);
    renderFullBookingEmail(emailShell, DEMO_SPONSOR);
  }

  function loadSectionHeroPreviews() {
    renderHeroInShell(document.getElementById('ad-live-opportunities-hero'), DEMO_SPONSOR);
    renderHeroInShell(document.getElementById('ad-live-organisers-hero'), DEMO_SPONSOR);
    renderOrganiserEmailPreview(document.getElementById('ad-live-organisers-email'), DEMO_SPONSOR);
    renderOpportunityEmailPreview(document.getElementById('ad-live-opportunities-email'), DEMO_SPONSOR);
  }

  function loadOpportunitySidebarPreview() {
    renderDemoCompactAd(document.getElementById('ad-live-opportunity-sidebar'), DEMO_SPONSOR);
  }

  function loadLivePreviews() {
    loadMainSponsorGallery();
    loadSectionHeroPreviews();
    loadOpportunitySidebarPreview();
    initExampleGallery(document.getElementById('ad-main-sponsor-gallery'));
    initExampleGallery(document.getElementById('ad-organisers-main-gallery'));
    initExampleGallery(document.getElementById('ad-opportunities-main-gallery'));

    initExampleGallery(document.getElementById('ad-events-mini-gallery'));
    initExampleGallery(document.getElementById('ad-opp-listing-gallery'));

    renderDemoMiniSponsor(document.getElementById('ad-live-mini-event'), DEMO_SPONSOR);
    renderMiniSponsorEmailPreview(document.getElementById('ad-live-mini-event-email'), DEMO_SPONSOR);
    renderDemoMiniSponsor(document.getElementById('ad-live-mini-organisers-dir'), DEMO_SPONSOR);
  }

  function initExampleGallery(root) {
    if (!root) return;
    var thumbs = root.querySelectorAll('.ad-example-thumb');
    var panels = root.querySelectorAll('[data-example-panel]');
    var examples = [];

    thumbs.forEach(function (btn) {
      examples.push(btn.getAttribute('data-example'));
    });

    function activate(example) {
      thumbs.forEach(function (btn) {
        var active = btn.getAttribute('data-example') === example;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        btn.tabIndex = active ? 0 : -1;
      });
      panels.forEach(function (panel) {
        var show = panel.getAttribute('data-example-panel') === example;
        panel.hidden = !show;
        panel.classList.toggle('is-active', show);
      });
    }

    thumbs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activate(btn.getAttribute('data-example'));
      });
    });

    activate(examples[0] || 'events');
  }


  function initPackageReveal() {
    document.querySelectorAll('.ad-package').forEach(function (pkg) {
      pkg.classList.add('ad-package-reveal', 'is-visible');
    });
  }

  function refreshPackageReveal(panel) {
    if (!panel) return;
    panel.querySelectorAll('.ad-package.is-active-package').forEach(function (pkg) {
      pkg.classList.add('is-visible');
    });
  }

  function syncSectionPicks(target) {
    document.querySelectorAll('[data-ad-tab]').forEach(function (pick) {
      var active = pick.getAttribute('data-ad-tab') === target;
      pick.classList.toggle('is-active', active);
      pick.setAttribute('aria-selected', active ? 'true' : 'false');
      pick.tabIndex = active ? 0 : -1;
    });
  }

  function initTabs() {
    var tabsRoot = document.getElementById('ad-section-picks');
    if (!tabsRoot) return;

    var tabs = tabsRoot.querySelectorAll('[role="tab"]');
    var panels = document.querySelectorAll('[data-ad-panel]');

    function activateTab(tab, options) {
      var target = tab.getAttribute('data-ad-tab');
      if (!target) return;

      syncSectionPicks(target);

      panels.forEach(function (panel) {
        var show = panel.getAttribute('data-ad-panel') === target;
        panel.hidden = !show;
        panel.classList.toggle('is-active', show);
        if (show) refreshPackageReveal(panel);
      });

      renderPricingGlance(target);
      syncSectionPackages(target);

      var preserveHash = options && options.preserveHash;
      var anchor = options && options.anchor;
      if (history.replaceState && !preserveHash) {
        history.replaceState(null, '', anchor ? '#' + anchor : '#ad-panel-' + target);
      }

      if (anchor) {
        window.setTimeout(function () {
          activatePackageInPanel(
            document.querySelector('[data-ad-panel="' + target + '"]'),
            anchor,
            { scroll: true }
          );
        }, 40);
      }
    }

    function activateByName(name, options) {
      var tab = tabsRoot.querySelector('[data-ad-tab="' + name + '"]');
      if (tab) activateTab(tab, options || {});
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        activateTab(tab);
      });
      tab.addEventListener('keydown', function (e) {
        var idx = Array.prototype.indexOf.call(tabs, tab);
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          var next = e.key === 'ArrowRight' ? idx + 1 : idx - 1;
          if (next < 0) next = tabs.length - 1;
          if (next >= tabs.length) next = 0;
          tabs[next].focus();
          activateTab(tabs[next]);
        }
      });
    });

    var initial = tabFromHash(location.hash) || 'events';
    var hashAnchor = packageFromHash(location.hash);
    var startTab = tabsRoot.querySelector('[data-ad-tab="' + initial + '"]') || tabs[0];
    if (startTab) {
      activateTab(startTab, {
        preserveHash: !!hashAnchor,
        anchor: hashAnchor,
      });
    }

    window.addEventListener('hashchange', function () {
      var want = tabFromHash(location.hash);
      if (!want) return;
      var hashId = packageFromHash(location.hash);
      activateByName(want, {
        anchor: hashId,
      });
    });
  }

  function tabFromHash(hash) {
    var want = String(hash || '').replace(/^#/, '').trim();
    if (!want) return null;
    if (PACKAGE_PANEL[want]) return PACKAGE_PANEL[want];
    var lower = want.toLowerCase();
    if (lower === 'events' || lower === 'ad-panel-events') return 'events';
    if (lower === 'organisers' || lower === 'ad-panel-organisers') return 'organisers';
    if (lower === 'opportunities' || lower === 'ad-panel-opportunities') return 'opportunities';
    return null;
  }

  function packageFromHash(hash) {
    var want = String(hash || '').replace(/^#/, '').trim();
    return PACKAGE_PANEL[want] ? want : '';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initHeroEntrance();
      initReveal();
      initTabs();
      initPackageTabs();
      initPackageReveal();
      initPricingGlanceLinks();
      initTabJumpLinks();
      initEnquiryForm();
      loadLivePreviews();
      loadMainSponsorAvailability();
    });
  } else {
    initHeroEntrance();
    initReveal();
    initTabs();
    initPackageTabs();
    initPackageReveal();
    initPricingGlanceLinks();
    initTabJumpLinks();
    initEnquiryForm();
    loadLivePreviews();
    loadMainSponsorAvailability();
  }
})();
