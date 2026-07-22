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

  function initHeroEntrance() {
    var hero = document.querySelector('.ad-hero');
    if (!hero) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      hero.classList.add('is-entered');
      return;
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        hero.classList.add('is-entered');
      });
    });
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

  function renderHeroInShell(shell, block) {
    if (!shell || !window.CmsAdBlocks) return;
    if (!block || block.active === false) {
      renderEmptyPreview(shell);
      return;
    }
    window.CmsAdBlocks.renderHeroSponsorAd(shell, block);
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
      '<img src="' + DEMO_HUB_LOGO + '" alt="" class="ad-full-email-hub-logo">' +
      sponsorRow +
      '<div class="ad-full-email-wave" aria-hidden="true"></div>' +
      '</div>' +
      '<div class="ad-full-email-body">' +
      '<div class="ad-full-email-check" aria-hidden="true"></div>' +
      '<span class="ad-email-line ad-email-line--kicker"></span>' +
      '<span class="ad-email-line ad-email-line--title"></span>' +
      '<span class="ad-email-line"></span>' +
      '<span class="ad-email-line ad-email-line--short"></span>' +
      '</div>' +
      '<div class="ad-full-email-event-wrap">' +
      '<div class="ad-full-email-event">' +
      '<span class="ad-email-line ad-email-line--on-dark ad-email-line--xs"></span>' +
      '<span class="ad-email-line ad-email-line--on-dark ad-email-line--title"></span>' +
      '<span class="ad-email-line ad-email-line--on-dark"></span>' +
      '<div class="ad-email-line-row">' +
      '<span class="ad-email-line ad-email-line--on-dark ad-email-line--meta"></span>' +
      '<span class="ad-email-line ad-email-line--on-dark ad-email-line--meta"></span>' +
      '<span class="ad-email-line ad-email-line--on-dark ad-email-line--meta"></span>' +
      '</div>' +
      '<span class="ad-email-line ad-email-line--on-dark ad-email-line--btn"></span>' +
      '</div>' +
      '</div>' +
      '<div class="ad-full-email-upsell-wrap">' +
      '<div class="ad-full-email-upsell">' +
      '<span class="ad-email-line ad-email-line--upsell"></span>' +
      '<span class="ad-email-line ad-email-line--upsell ad-email-line--title"></span>' +
      '<span class="ad-email-line ad-email-line--upsell ad-email-line--short"></span>' +
      '</div>' +
      '</div>' +
      '<div class="ad-full-email-footer">' +
      '<div class="ad-full-email-footer-links">' +
      '<span class="ad-email-line ad-email-line--footer"></span>' +
      '<span class="ad-email-line ad-email-line--footer"></span>' +
      '<span class="ad-email-line ad-email-line--footer"></span>' +
      '</div>' +
      '</div>' +
      '<div class="ad-full-email-brand">' +
      '<img src="' + DEMO_HUB_LOGO + '" alt="" class="ad-full-email-hub-logo ad-full-email-hub-logo--sm">' +
      '<span class="ad-email-line ad-email-line--brand"></span>' +
      '<span class="ad-email-line ad-email-line--brand-short"></span>' +
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
    var compactEl = document.getElementById('ad-live-opportunity-sidebar');
    if (!compactEl || !window.CmsAdBlocks) return;
    window.CmsAdBlocks.renderCompactAd(compactEl, DEMO_SPONSOR);
  }

  function initExampleGallery(root) {
    if (!root) return;
    var thumbs = root.querySelectorAll('.ad-example-thumb');
    var panels = root.querySelectorAll('[data-example-panel]');

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
  }

  function loadLivePreviews() {
    if (!window.CmsAdBlocks) return;

    loadMainSponsorGallery();
    loadSectionHeroPreviews();
    loadOpportunitySidebarPreview();
    initExampleGallery(document.getElementById('ad-main-sponsor-gallery'));

    var miniEvent = document.getElementById('ad-live-mini-event');
    if (miniEvent) {
      window.CmsAdBlocks.loadPageCarouselAds(miniEvent, {
        slot: 'event_page_carousel_ads',
        placeholderSubject: 'Events Mini Sponsors enquiry',
      }).then(function (ok) {
        if (!ok) renderEmptyPreview(miniEvent, 'Mini Sponsors not configured yet.');
      });
    }
    var miniOrganisersDir = document.getElementById('ad-live-mini-organisers-dir');
    if (miniOrganisersDir) {
      window.CmsAdBlocks.loadOrganiserPageCarouselAds(miniOrganisersDir).then(function (ok) {
        if (!ok) renderEmptyPreview(miniOrganisersDir, 'Mini Sponsors not configured yet.');
      });
    }

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
    document.querySelectorAll('[data-ad-pick]').forEach(function (pick) {
      var active = pick.getAttribute('data-ad-pick') === target;
      pick.classList.toggle('is-active', active);
      pick.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function scrollToAnchor(id) {
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    window.setTimeout(function () {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }

  function initTabs() {
    var tabsRoot = document.getElementById('ad-section-tabs');
    if (!tabsRoot) return;

    var tabs = tabsRoot.querySelectorAll('[role="tab"]');
    var panels = document.querySelectorAll('[data-ad-panel]');

    function activateTab(tab, options) {
      var target = tab.getAttribute('data-ad-tab');
      if (!target) return;

      tabs.forEach(function (btn) {
        var active = btn === tab;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        btn.tabIndex = active ? 0 : -1;
      });

      panels.forEach(function (panel) {
        var show = panel.getAttribute('data-ad-panel') === target;
        panel.hidden = !show;
        panel.classList.toggle('is-active', show);
        if (show) refreshPackageReveal(panel);
      });

      syncSectionPicks(target);

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

    document.querySelectorAll('[data-ad-pick]').forEach(function (pick) {
      pick.addEventListener('click', function () {
        activateByName(pick.getAttribute('data-ad-pick'));
        tabsRoot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });

    document.querySelectorAll('[data-ad-jump]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activateByName(btn.getAttribute('data-ad-jump'), {
          anchor: btn.getAttribute('data-ad-anchor') || '',
        });
        document.getElementById('ad-section-picks').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      loadPartnersStrip();
      loadLivePreviews();
    });
  } else {
    initHeroEntrance();
    initReveal();
    initTabs();
    initPackageReveal();
    loadPartnersStrip();
    loadLivePreviews();
  }
})();
