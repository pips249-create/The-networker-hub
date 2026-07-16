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

  function previewBlock(raw) {
    if (!raw || raw.active === false) return DEMO_SPONSOR;
    var logo = window.CmsSponsorFields ? window.CmsSponsorFields.logoUrl(raw) : String(raw.logo_url || '').trim();
    if (!logo) return DEMO_SPONSOR;
    return raw;
  }

  function logoFromBlock(block) {
    if (!block || !window.CmsSponsorFields) return DEMO_SPONSOR.logo_url;
    return window.CmsSponsorFields.logoUrl(block) || DEMO_SPONSOR.logo_url;
  }

  function companyFromBlock(block) {
    if (!block || !window.CmsSponsorFields) return DEMO_SPONSOR.company_name;
    return window.CmsSponsorFields.companyName(block) || DEMO_SPONSOR.company_name;
  }

  function ctaUrlFromBlock(block) {
    if (!block) return DEMO_SPONSOR.cta_url;
    var url = String(block.cta_url || '').trim();
    return /^(https?:|mailto:)/i.test(url) ? url : DEMO_SPONSOR.cta_url;
  }

  function renderHeroPreview(container, block) {
    if (!container || !window.CmsAdBlocks) return;
    window.CmsAdBlocks.renderHeroSponsorAd(container, previewBlock(block));
  }

  function buildSponsorEmailRow(block) {
    var safe = previewBlock(block);
    var logo = logoFromBlock(safe);
    var company = companyFromBlock(safe);
    var url = ctaUrlFromBlock(safe);
    var logoInner =
      '<img src="' +
      esc(logo) +
      '" alt="' +
      esc(company) +
      '" class="ad-full-email-sponsor-logo" loading="lazy" decoding="async">';
    return (
      '<div class="ad-full-email-sponsor ad-full-email-sponsor--highlight">' +
      '<p class="pitch-email-kicker">Our event directory is proudly powered by</p>' +
      '<a href="' +
      esc(url) +
      '" target="_blank" rel="noopener noreferrer">' +
      logoInner +
      '</a>' +
      '</div>'
    );
  }

  function renderFullBookingEmail(container, block) {
    if (!container) return;
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
      '<p class="pitch-email-title">You&rsquo;re booked in</p>' +
      '<span class="ad-email-line"></span>' +
      '<span class="ad-email-line ad-email-line--short"></span>' +
      '</div>' +
      '<div class="ad-full-email-event-wrap">' +
      '<div class="ad-full-email-event">' +
      '<span class="ad-email-line ad-email-line--on-dark ad-email-line--xs"></span>' +
      '<span class="ad-email-line ad-email-line--on-dark ad-email-line--title"></span>' +
      '<span class="ad-email-line ad-email-line--on-dark"></span>' +
      '</div>' +
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
          panel.hidden = panel.getAttribute('data-pitch-preview-panel') !== key;
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
        label: 'Launch · months 1–3 post Sep 2026',
        rows: [
          ['Directory views', '2k – 5k / mo', 'Hero slot · every browse visit'],
          ['Attendee emails', '800 – 2.5k / mo', 'Logo + link in header'],
          ['Total impressions', '3k – 7.5k / mo', 'Site + email combined'],
        ],
      },
      growth: {
        label: 'Growth · months 4–12',
        rows: [
          ['Directory views', '8k – 18k / mo', 'Primary UK events browse page'],
          ['Attendee emails', '4k – 12k / mo', 'Full booking lifecycle'],
          ['Total impressions', '12k – 30k / mo', 'Compounds with organiser base'],
        ],
      },
      scale: {
        label: 'Scale · year 2+',
        rows: [
          ['Directory views', '20k – 45k / mo', 'Directory + regional SEO pages'],
          ['Attendee emails', '12k – 35k / mo', 'Reminders, saved events, nudges'],
          ['Total impressions', '32k – 80k / mo', 'Flagship Hub inventory'],
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
      if (caption) caption.textContent = data.label + ' · planning estimates, not guaranteed.';
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

    renderHeroPreview(heroSlot, DEMO_SPONSOR);
    renderFullBookingEmail(emailSlot, DEMO_SPONSOR);

    fetch('/api/cms-block?slot=events_sponsor_hub')
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        var block = data && data.block ? data.block : null;
        if (!block) return;
        renderHeroPreview(heroSlot, block);
        renderFullBookingEmail(emailSlot, block);
      })
      .catch(function () {
        /* demo creative already shown */
      });
  }

  bindSectionNav();
  bindPreviewTabs();
  bindScenarioTabs();
  loadLivePreview();
})();
