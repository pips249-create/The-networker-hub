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

  function fetchCmsSlot(slot) {
    return fetch('/api/cms-block?slot=' + encodeURIComponent(slot))
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return null;
      });
  }

  function loadPartnersStrip() {
    var section = document.getElementById('ad-partners-strip');
    var logosEl = document.getElementById('ad-partners-logos');
    if (!section || !logosEl) return;

    fetchCmsSlot('home_partners').then(function (data) {
      var partners = [];
      var seen = new Set();

      if (data && data.ok && data.active !== false && Array.isArray(data.partners)) {
        data.partners.forEach(function (p) {
          var logo = String((p && p.logo_url) || '').trim();
          if (!logo || seen.has(logo)) return;
          seen.add(logo);
          partners.push({
            name: String((p && p.company_name) || '').trim() || 'Partner',
            logo: logo,
            url: String((p && p.cta_url) || '').trim(),
          });
        });
      }

      if (!partners.length) return;

      logosEl.innerHTML = partners
        .map(function (p) {
          var img =
            '<img src="' +
            esc(p.logo) +
            '" alt="' +
            esc(p.name) +
            '" loading="lazy" decoding="async" onerror="this.closest(\'a,span\').hidden=true">';
          if (/^https?:/i.test(p.url)) {
            return (
              '<a href="' +
              esc(p.url) +
              '" target="_blank" rel="noopener noreferrer" title="' +
              esc(p.name) +
              '">' +
              img +
              '</a>'
            );
          }
          return '<span title="' + esc(p.name) + '">' + img + '</span>';
        })
        .join('');

      section.hidden = false;
      section.classList.add('is-visible');
    });
  }

  var PRICING_GLANCE = {
    events: [
      {
        name: 'Main Events Directory Sponsor',
        detail: 'Main Sponsor banner + booking emails',
        price: '£2,000/mo',
        type: 'Third-party brand',
        typeClass: 'brand',
        anchor: 'ad-pkg-events-main',
      },
      {
        name: 'Mini Sponsors',
        detail: 'Event page sidebar',
        price: '£600/slot/mo',
        type: 'Third-party brand',
        typeClass: 'brand',
        anchor: 'ad-pkg-events-mini',
      },
      {
        name: 'City Partner',
        detail: 'Regional city landing pages',
        price: 'From £29/city/mo',
        type: 'Third-party brand',
        typeClass: 'brand',
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
        detail: 'Main Sponsor banner on organisers browse',
        price: '£1,000/mo',
        type: 'Third-party brand',
        typeClass: 'brand',
        anchor: 'ad-pkg-organisers-main',
      },
      {
        name: 'Mini Sponsors',
        detail: 'Organiser profile sidebar',
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
        detail: 'Main Sponsor banner on /opportunities/',
        price: '£2,000/mo',
        type: 'Third-party brand',
        typeClass: 'brand',
        anchor: 'ad-pkg-opportunities-main',
      },
      {
        name: 'Mini Sponsors',
        detail: 'Opportunity detail sidebar',
        price: '£600/slot/mo',
        type: 'Third-party brand',
        typeClass: 'brand',
        anchor: 'ad-pkg-opportunities-mini',
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

  function renderPricingGlance(section) {
    var body = document.getElementById('ad-pricing-table-body');
    var hint = document.querySelector('.ad-pricing-glance-toggle-hint');
    if (!body) return;

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
    var el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add('ad-package--highlight');
    window.setTimeout(function () {
      el.classList.remove('ad-package--highlight');
    }, 1800);
  }

  function initPricingGlanceLinks() {
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

  function renderFullBookingEmail(container, block) {
    if (!container) return;
    if (!block || block.active === false) {
      renderEmptyPreview(container);
      return;
    }

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
      '<p class="ad-full-email-kicker">Booking confirmed</p>' +
      '<p class="ad-full-email-title">You&rsquo;re booked in</p>' +
      '<p class="ad-full-email-lede">Your place is reserved. We&rsquo;ve sent the details below.</p>' +
      '</div>' +
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
      '<p class="ad-full-email-upsell-kicker">While you&rsquo;re here</p>' +
      '<p class="ad-full-email-upsell-title">Discover more events near you</p>' +
      '</div>' +
      '</div>' +
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
  }

  function loadOpportunitySidebarPreview() {
    renderDemoCompactAd(document.getElementById('ad-live-opportunity-sidebar'), DEMO_SPONSOR);
  }

  function loadLivePreviews() {
    loadMainSponsorGallery();
    loadSectionHeroPreviews();
    loadOpportunitySidebarPreview();
    initExampleGallery(document.getElementById('ad-main-sponsor-gallery'));

    renderDemoMiniSponsor(document.getElementById('ad-live-mini-event'), DEMO_SPONSOR);
    renderDemoMiniSponsor(document.getElementById('ad-live-mini-organisers-dir'), DEMO_SPONSOR);
  }

  function initExampleGallery(root) {
    if (!root) return;
    var thumbs = root.querySelectorAll('.ad-example-thumb');
    var panels = root.querySelectorAll('[data-example-panel]');
    var examples = [];
    var rotateTimer = null;
    var rotateIndex = 0;

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
      rotateIndex = Math.max(0, examples.indexOf(example));
    }

    function stopRotate() {
      if (rotateTimer) {
        window.clearInterval(rotateTimer);
        rotateTimer = null;
      }
      root.classList.add('is-paused');
    }

    function startRotate() {
      if (examples.length < 2) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      stopRotate();
      root.classList.remove('is-paused');
      rotateTimer = window.setInterval(function () {
        rotateIndex = (rotateIndex + 1) % examples.length;
        activate(examples[rotateIndex]);
      }, 5500);
    }

    thumbs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        stopRotate();
        activate(btn.getAttribute('data-example'));
        window.setTimeout(startRotate, 12000);
      });
    });

    root.addEventListener('mouseenter', stopRotate);
    root.addEventListener('mouseleave', startRotate);
    root.addEventListener('focusin', stopRotate);
    root.addEventListener('focusout', function (e) {
      if (!root.contains(e.relatedTarget)) startRotate();
    });

    startRotate();
  }


  var packageRevealIo = null;

  function initPackageReveal() {
    var packages = document.querySelectorAll('.ad-package');
    packages.forEach(function (pkg) {
      pkg.classList.add('ad-package-reveal');
    });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      packages.forEach(function (pkg) {
        pkg.classList.add('is-visible');
      });
      return;
    }

    if (!window.IntersectionObserver) {
      packages.forEach(function (pkg) {
        pkg.classList.add('is-visible');
      });
      return;
    }

    packageRevealIo = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            packageRevealIo.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 }
    );

    packages.forEach(function (pkg) {
      packageRevealIo.observe(pkg);
    });
  }

  function refreshPackageReveal(panel) {
    if (!packageRevealIo || !panel) return;
    panel.querySelectorAll('.ad-package-reveal:not(.is-visible)').forEach(function (pkg) {
      packageRevealIo.observe(pkg);
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

      var preserveHash = options && options.preserveHash;
      var anchor = options && options.anchor;
      if (history.replaceState && !preserveHash) {
        history.replaceState(null, '', anchor ? '#' + anchor : '#ad-panel-' + target);
      }

      if (anchor) scrollToAnchor(anchor);
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
    var hashAnchor = String(location.hash || '').replace(/^#/, '');
    var startTab = tabsRoot.querySelector('[data-ad-tab="' + initial + '"]') || tabs[0];
    if (startTab) {
      activateTab(startTab, {
        preserveHash: true,
        anchor: hashAnchor === 'city-partner-package' ? hashAnchor : '',
      });
    }

    window.addEventListener('hashchange', function () {
      var want = tabFromHash(location.hash);
      if (!want) return;
      var hashId = String(location.hash || '').replace(/^#/, '');
      activateByName(want, {
        anchor: hashId === 'city-partner-package' ? hashId : '',
      });
    });
  }

  function tabFromHash(hash) {
    var want = String(hash || '').replace(/^#/, '').trim().toLowerCase();
    if (!want || want === 'events' || want === 'ad-panel-events' || want === 'city-partner-package') {
      return 'events';
    }
    if (want === 'organisers' || want === 'ad-panel-organisers') return 'organisers';
    if (want === 'opportunities' || want === 'ad-panel-opportunities') return 'opportunities';
    return null;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initHeroEntrance();
      initReveal();
      initTabs();
      initPackageReveal();
      initPricingGlanceLinks();
      loadPartnersStrip();
      loadLivePreviews();
    });
  } else {
    initHeroEntrance();
    initReveal();
    initTabs();
    initPackageReveal();
    initPricingGlanceLinks();
    loadPartnersStrip();
    loadLivePreviews();
  }
})();
