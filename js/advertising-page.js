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

  var tabsRoot = document.getElementById('ad-section-tabs');
  if (tabsRoot) {
    var tabs = tabsRoot.querySelectorAll('[role="tab"]');
    var panels = document.querySelectorAll('[data-ad-panel]');

    function activateTab(tab) {
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
      });

      if (history.replaceState) {
        history.replaceState(null, '', '#' + target);
      }
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

    var hash = (location.hash || '').replace(/^#/, '');
    var initial =
      hash === 'opportunities' || hash === 'organisers' ? hash : 'events';
    var startTab = tabsRoot.querySelector('[data-ad-tab="' + initial + '"]') || tabs[0];
    if (startTab) activateTab(startTab);

    window.addEventListener('hashchange', function () {
      var want = (location.hash || '').replace(/^#/, '');
      if (want !== 'events' && want !== 'opportunities' && want !== 'organisers') return;
      var tab = tabsRoot.querySelector('[data-ad-tab="' + want + '"]');
      if (tab) activateTab(tab);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadLivePreviews);
  } else {
    loadLivePreviews();
  }
})();
