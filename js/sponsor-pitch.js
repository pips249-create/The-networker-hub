(function () {
  var DEMO_HUB_LOGO = '/assets/advertising-example-hub-logo.png';

  /* Live Events Headline creative (CMS) — keeps pitch previews accurate if /api/cms-block is gated. */
  var LIVE_EVENTS_SPONSOR = {
    active: true,
    logo_url:
      'https://cdn.prod.website-files.com/66e99a1017187b724a2bc8b8/66e9a2aee48ebc4a38f6add4_BAR%200007%20Solutions%20logo%20various%20final-01.svg',
    image_url:
      'https://cdn.prod.website-files.com/66e99a1017187b724a2bc8b8/66e9a2aee48ebc4a38f6add4_BAR%200007%20Solutions%20logo%20various%20final-01.svg',
    company_name: 'Barnsgate Solutions',
    title: 'Trusted M&A advice for UK business owners',
    subtitle: 'Barnsgate Solutions',
    cta_label: 'Explore your options →',
    cta_url: 'https://www.barnsgatesolutions.com/',
    cta_color: '#49c5ee',
    logo_band_dark: true,
  };

  var DEMO_SPONSOR = LIVE_EVENTS_SPONSOR;

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function previewBlock(raw) {
    if (!raw || raw.active === false) return LIVE_EVENTS_SPONSOR;
    var logo = window.CmsSponsorFields ? window.CmsSponsorFields.logoUrl(raw) : String(raw.logo_url || '').trim();
    if (!logo) return LIVE_EVENTS_SPONSOR;
    return raw;
  }

  function logoFromBlock(block) {
    if (!block || !window.CmsSponsorFields) return LIVE_EVENTS_SPONSOR.logo_url;
    return window.CmsSponsorFields.logoUrl(block) || LIVE_EVENTS_SPONSOR.logo_url;
  }

  function companyFromBlock(block) {
    if (!block || !window.CmsSponsorFields) return LIVE_EVENTS_SPONSOR.company_name;
    return window.CmsSponsorFields.companyName(block) || LIVE_EVENTS_SPONSOR.company_name;
  }

  function ctaUrlFromBlock(block) {
    if (!block) return LIVE_EVENTS_SPONSOR.cta_url;
    var url = String(block.cta_url || '').trim();
    return /^(https?:|mailto:)/i.test(url) ? url : LIVE_EVENTS_SPONSOR.cta_url;
  }

  /** Match live /events/ hero: logo-only Powered by slot (same markup as sponsor-hub.js). */
  function renderLiveEventsHeroPreview(container, block) {
    if (!container) return;
    var safe = previewBlock(block);
    var logo = logoFromBlock(safe);
    var company = companyFromBlock(safe);
    var url = ctaUrlFromBlock(safe);
    container.innerHTML =
      '<aside class="sponsor-hub sponsor-hub--in-hero sponsor-hub--active sponsor-hub--logo-only sponsor-hub--ready" data-slot="events_sponsor_hub">' +
      '<div class="sponsor-hub-head"><span class="icon" aria-hidden="true">★</span><span>Powered by</span></div>' +
      '<div class="sponsor-logo-wrap sponsor-logo-band has-logo sponsor-logo-band--dark" style="background-color:#1a1a2e;">' +
      '<a class="sponsor-logo-link" href="' +
      esc(url) +
      '" target="_blank" rel="noopener noreferrer" aria-label="Visit ' +
      esc(company) +
      '">' +
      '<img class="sponsor-logo sponsor-logo--full" alt="' +
      esc(company) +
      '" src="' +
      esc(logo) +
      '">' +
      '</a></div></aside>';
  }

  /** Full card used on the advertising rate card + email-adjacent creative. */
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
      '<p class="pitch-email-kicker">Powered by</p>' +
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
      legacy: {
        label: 'Old site · the-networker.co.uk (proven last year)',
        rows: [
          ['Events listed', '27,000+', 'Networking events on the directory last year'],
          ['Networkers', '17,000+', 'People who used the directory last year'],
          ['Audience', 'UK-wide B2B', 'Founders, directors & organisers — same audience the Hub inherits'],
        ],
      },
      launch: {
        label: 'Expected · Hub launch (months 1–3 post Sep 2026)',
        rows: [
          ['Directory impressions', '2k – 5k / mo', 'Hero slot on every /events/ browse visit'],
          ['Attendee emails', '800 – 2.5k / mo', 'Logo + link in booking lifecycle headers'],
          ['Combined reach', '3k – 7.5k / mo', 'Site + email · planning estimate, not guaranteed'],
        ],
      },
      growth: {
        label: 'Expected · growth (months 4–12)',
        rows: [
          ['Directory impressions', '8k – 18k / mo', 'Primary UK events browse page'],
          ['Attendee emails', '4k – 12k / mo', 'Full booking lifecycle'],
          ['Combined reach', '12k – 30k / mo', 'Matches public advertising guide ranges'],
        ],
      },
      scale: {
        label: 'Expected · scale (year 2+)',
        rows: [
          ['Directory impressions', '20k – 45k / mo', 'Directory + regional SEO pages'],
          ['Attendee emails', '12k – 35k / mo', 'Reminders, saved events, nudges'],
          ['Combined reach', '32k – 80k / mo', 'Flagship Hub inventory'],
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

    renderScenario(document.querySelector('#pitch-scenario-tabs [data-pitch-scenario].is-active')
      ? document.querySelector('#pitch-scenario-tabs [data-pitch-scenario].is-active').getAttribute('data-pitch-scenario')
      : 'legacy');
  }

  function applySponsorPreviews(block) {
    var heroSlot = document.getElementById('pitch-live-hero');
    var fullSlot = document.getElementById('pitch-live-hero-full');
    var emailSlot = document.getElementById('pitch-live-email');
    renderLiveEventsHeroPreview(heroSlot, block);
    renderHeroPreview(fullSlot, block);
    renderFullBookingEmail(emailSlot, block);
  }

  function loadLivePreview() {
    var heroSlot = document.getElementById('pitch-live-hero');
    var emailSlot = document.getElementById('pitch-live-email');
    if (!heroSlot && !emailSlot && !document.getElementById('pitch-live-hero-full')) return;

    applySponsorPreviews(LIVE_EVENTS_SPONSOR);

    fetch('/api/cms-block?slot=events_sponsor_hub')
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        var block = data && data.block ? data.block : null;
        if (!block) return;
        applySponsorPreviews(block);
      })
      .catch(function () {
        /* live Barnsgate creative already shown */
      });
  }

  bindSectionNav();
  bindPreviewTabs();
  bindScenarioTabs();
  loadLivePreview();
})();
