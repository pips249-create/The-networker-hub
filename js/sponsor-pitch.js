(function () {
  var DEMO_SPONSOR = {
    active: true,
    logo_url: '/assets/advertising-example-everlasting-build.png',
    company_name: 'Your brand',
    title: 'Your tagline goes here',
    cta_label: 'Visit website →',
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

  function renderHeroPreview(container, block) {
    if (!container) return;
    if (window.CmsAdBlocks && block && block.active !== false) {
      container.innerHTML = '';
      window.CmsAdBlocks.renderHeroSponsorAd(container, block);
      return;
    }
    container.innerHTML =
      '<div class="sponsor-pitch-demo-placeholder">' +
      '<strong>' +
      esc((block && block.company_name) || 'Your logo &amp; CTA here') +
      '</strong>' +
      '<span>Hero Sponsor Hub on /events/</span>' +
      '</div>';
  }

  function renderEmailPreview(container, block) {
    if (!container) return;
    var logo = logoFromBlock(block) || DEMO_SPONSOR.logo_url;
    var company = companyFromBlock(block) || DEMO_SPONSOR.company_name;
    var url = ctaUrlFromBlock(block);
    var logoHtml =
      '<img src="' +
      esc(logo) +
      '" alt="' +
      esc(company) +
      '" class="sponsor-pitch-email-sponsor-logo">';
    if (url !== '#') {
      logoHtml =
        '<a href="' +
        esc(url) +
        '" target="_blank" rel="noopener noreferrer">' +
        logoHtml +
        '</a>';
    }
    container.innerHTML =
      '<div class="sponsor-pitch-email-mock">' +
      '<div class="sponsor-pitch-email-header">' +
      '<img src="/assets/advertising-example-hub-logo.png" alt="" class="hub-logo">' +
      '<p style="font-size:0.75rem;color:#4a6272;margin:0 0 8px;">Our event directory is proudly powered by</p>' +
      '<div class="sponsor-pitch-email-sponsor">' +
      logoHtml +
      '</div>' +
      '</div>' +
      '<div class="sponsor-pitch-email-body">' +
      '<span class="line w50"></span>' +
      '<span class="line w70"></span>' +
      '<span class="line"></span>' +
      '<span class="line w50"></span>' +
      '</div>' +
      '</div>';
  }

  function bindSectionNav() {
    var nav = document.getElementById('pitch-section-nav');
    if (!nav) return;
    var buttons = nav.querySelectorAll('[data-pitch-section]');
    var sections = document.querySelectorAll('.sponsor-pitch-section[id]');

    function setActive(id) {
      buttons.forEach(function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-pitch-section') === id);
      });
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-pitch-section');
        var target = document.getElementById(id);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActive(id);
      });
    });

    if (!('IntersectionObserver' in window) || !sections.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: 0 }
    );

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  function bindPreviewTabs() {
    var wrap = document.getElementById('pitch-preview-tabs');
    if (!wrap) return;
    var tabs = wrap.querySelectorAll('[data-pitch-preview]');
    var panels = document.querySelectorAll('[data-pitch-preview-panel]');

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var key = tab.getAttribute('data-pitch-preview');
        tabs.forEach(function (t) {
          var active = t === tab;
          t.classList.toggle('is-active', active);
          t.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        panels.forEach(function (panel) {
          var show = panel.getAttribute('data-pitch-preview-panel') === key;
          panel.hidden = !show;
        });
      });
    });
  }

  function bindScenarioTabs() {
    var wrap = document.getElementById('pitch-scenario-tabs');
    var table = document.getElementById('pitch-forecast-table');
    if (!wrap || !table) return;

    var scenarios = {
      launch: {
        label: 'Launch (months 1–3)',
        rows: [
          ['Events directory page views', '2,000 – 5,000', 'First container every visitor sees'],
          ['Attendee transactional emails', '800 – 2,500', 'Logo + backlink in header band'],
          ['Estimated logo impressions', '3,000 – 7,500', 'Site + email combined'],
          ['Exclusive competitors in slot', '0', 'One vetted brand per calendar month'],
        ],
      },
      growth: {
        label: 'Growth (months 4–12)',
        rows: [
          ['Events directory page views', '8,000 – 18,000', 'Primary UK networking discovery page'],
          ['Attendee transactional emails', '4,000 – 12,000', 'Every booking lifecycle touchpoint'],
          ['Estimated logo impressions', '12,000 – 30,000', 'Compounds as organiser base grows'],
          ['Exclusive competitors in slot', '0', 'Renewals prioritised for incumbents'],
        ],
      },
      scale: {
        label: 'Scale (year 2+)',
        rows: [
          ['Events directory page views', '20,000 – 45,000', 'Regional browse + SEO landing pages'],
          ['Attendee transactional emails', '12,000 – 35,000', 'Reminders, saved events, re-engagement'],
          ['Estimated logo impressions', '32,000 – 80,000', 'Highest-attention inventory on Hub'],
          ['Exclusive competitors in slot', '0', 'Category leadership positioning'],
        ],
      },
    };

    function renderScenario(key) {
      var data = scenarios[key] || scenarios.launch;
      var tbody = table.querySelector('tbody');
      if (!tbody) return;
      tbody.innerHTML = data.rows
        .map(function (row) {
          return (
            '<tr><td>' +
            esc(row[0]) +
            '</td><td class="num">' +
            esc(row[1]) +
            '</td><td>' +
            esc(row[2]) +
            '</td></tr>'
          );
        })
        .join('');
      var caption = document.getElementById('pitch-scenario-caption');
      if (caption) caption.textContent = data.label + ' — illustrative monthly ranges post public launch (Sep 2026).';
    }

    wrap.querySelectorAll('[data-pitch-scenario]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        wrap.querySelectorAll('[data-pitch-scenario]').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        renderScenario(btn.getAttribute('data-pitch-scenario'));
      });
    });

    renderScenario('launch');
  }

  function loadLivePreview() {
    var heroSlot = document.getElementById('pitch-live-hero');
    var emailSlot = document.getElementById('pitch-live-email');
    if (!heroSlot && !emailSlot) return;

    fetch('/api/cms-block?slot=events_sponsor_hub')
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        var block =
          data && data.block && data.block.active !== false ? data.block : DEMO_SPONSOR;
        renderHeroPreview(heroSlot, block);
        renderEmailPreview(emailSlot, block);
      })
      .catch(function () {
        renderHeroPreview(heroSlot, DEMO_SPONSOR);
        renderEmailPreview(emailSlot, DEMO_SPONSOR);
      });
  }

  bindSectionNav();
  bindPreviewTabs();
  bindScenarioTabs();
  loadLivePreview();
})();
