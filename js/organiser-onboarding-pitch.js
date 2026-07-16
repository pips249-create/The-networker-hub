(function () {
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

  function bindDashTabs() {
    var wrap = document.getElementById('org-pitch-dash-tabs');
    if (!wrap) return;
    var tabs = wrap.querySelectorAll('[data-dash-panel]');
    var panels = document.querySelectorAll('[data-dash-panel-view]');

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var key = tab.getAttribute('data-dash-panel');
        tabs.forEach(function (t) {
          t.classList.toggle('is-active', t === tab);
        });
        panels.forEach(function (panel) {
          panel.classList.toggle('is-active', panel.getAttribute('data-dash-panel-view') === key);
        });
      });
    });
  }

  function bindPresentMode() {
    var overlay = document.getElementById('org-pitch-present');
    var openBtn = document.getElementById('org-pitch-present-open');
    var closeBtn = document.getElementById('org-pitch-present-close');
    if (!overlay || !openBtn) return;

    var slides = Array.prototype.slice.call(overlay.querySelectorAll('.org-pitch-slide'));
    var dotsWrap = document.getElementById('org-pitch-present-dots');
    var counter = document.getElementById('org-pitch-present-counter');
    var idx = 0;

    if (dotsWrap) {
      dotsWrap.innerHTML = slides
        .map(function (_, i) {
          return '<span data-slide-dot="' + i + '"></span>';
        })
        .join('');
    }

    function renderSlide() {
      slides.forEach(function (slide, i) {
        slide.classList.toggle('is-active', i === idx);
      });
      if (dotsWrap) {
        dotsWrap.querySelectorAll('[data-slide-dot]').forEach(function (dot, i) {
          dot.classList.toggle('is-active', i === idx);
        });
      }
      if (counter) counter.textContent = idx + 1 + ' / ' + slides.length;
    }

    function openPresent() {
      idx = 0;
      renderSlide();
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closePresent() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    function next() {
      idx = Math.min(slides.length - 1, idx + 1);
      renderSlide();
    }

    function prev() {
      idx = Math.max(0, idx - 1);
      renderSlide();
    }

    openBtn.addEventListener('click', openPresent);
    if (closeBtn) closeBtn.addEventListener('click', closePresent);

    if (dotsWrap) {
      dotsWrap.addEventListener('click', function (e) {
        var dot = e.target.closest('[data-slide-dot]');
        if (!dot) return;
        idx = parseInt(dot.getAttribute('data-slide-dot'), 10) || 0;
        renderSlide();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (!overlay.classList.contains('is-open')) return;
      if (e.key === 'Escape') closePresent();
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        next();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      }
    });
  }

  function bindSiteTabs() {
    var wrap = document.getElementById('org-pitch-site-tabs');
    if (!wrap) return;
    var tabs = wrap.querySelectorAll('[data-site-panel]');
    var panels = document.querySelectorAll('[data-site-panel-view]');

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var key = tab.getAttribute('data-site-panel');
        tabs.forEach(function (t) {
          var active = t === tab;
          t.classList.toggle('is-active', active);
          t.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        panels.forEach(function (panel) {
          panel.hidden = panel.getAttribute('data-site-panel-view') !== key;
        });
      });
    });
  }

  bindSectionNav();
  bindDashTabs();
  bindPresentMode();
  bindSiteTabs();
  bindForecastTabs();
})();

function escHtml(s) {
  var d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function bindForecastTabs() {
  var wrap = document.getElementById('pitch-scenario-tabs');
  var table = document.getElementById('pitch-forecast-table');
  if (!wrap || !table) return;

  var isWibn = document.body.classList.contains('org-pitch-page--wibn');
  var isBmu = document.body.classList.contains('org-pitch-page') && !isWibn;

  var scenarios = isWibn
    ? {
        launch: {
          label: 'Launch · months 1–3 post Sep 2026',
          rows: [
            ['Events directory views', '2k – 5k / mo', 'UK-wide browse · map · filters'],
            ['Organiser profile views', '400 – 1.2k / mo', 'Chapters discovered via directory'],
            ['Discovery-led bookings', '50 – 180 / mo', 'Guest visits & open checkout'],
            ['WIBN pilot chapters (est.)', '150 – 400 / mo', 'Profile views · 5–10 live groups'],
          ],
        },
        growth: {
          label: 'Growth · months 4–12',
          rows: [
            ['Events directory views', '8k – 18k / mo', 'Primary UK networking discovery page'],
            ['Organiser profile views', '2k – 5k / mo', 'Organiser tab + SEO landing pages'],
            ['Discovery-led bookings', '400 – 1.2k / mo', 'Compounds as chapters list here'],
            ['WIBN per chapter (est.)', '80 – 200 / mo', '30–50 listed · local + online funnel'],
          ],
        },
        scale: {
          label: 'Scale · year 2+',
          rows: [
            ['Events directory views', '20k – 45k / mo', 'Directory + regional SEO pages'],
            ['Organiser profile views', '6k – 15k / mo', '~100-chapter organiser network potential'],
            ['Discovery-led bookings', '1.5k – 4k / mo', 'Saved events · ticket alerts · re-engagement'],
            ['WIBN national footprint (est.)', '4k – 12k / mo', 'Profile views across all chapters'],
          ],
        },
      }
    : isBmu
    ? {
        launch: {
          label: 'Launch · months 1–3 post Sep 2026',
          rows: [
            ['Events directory views', '2k – 5k / mo', 'UK-wide browse · map · filters'],
            ['Organiser profile views', '400 – 1.2k / mo', 'Groups discovered via directory'],
            ['Discovery-led bookings', '50 – 180 / mo', 'Guest visits & open checkout'],
            ['BMU pilot city (est.)', '80 – 250 / mo', 'Profile views · Leeds or Manchester'],
          ],
        },
        growth: {
          label: 'Growth · months 4–12',
          rows: [
            ['Events directory views', '8k – 18k / mo', 'Primary UK networking discovery page'],
            ['Organiser profile views', '2k – 5k / mo', 'Organiser tab + SEO landing pages'],
            ['Discovery-led bookings', '400 – 1.2k / mo', 'Compounds as groups list here'],
            ['BMU per city group (est.)', '300 – 900 / mo', '3 live groups · guest + member funnel'],
          ],
        },
        scale: {
          label: 'Scale · year 2+',
          rows: [
            ['Events directory views', '20k – 45k / mo', 'Directory + regional SEO pages'],
            ['Organiser profile views', '6k – 15k / mo', '42-city organiser network potential'],
            ['Discovery-led bookings', '1.5k – 4k / mo', 'Saved events · ticket alerts · re-engagement'],
            ['BMU national footprint (est.)', '2k – 6k / mo', 'Profile views across franchise cities'],
          ],
        },
      }
    : {
        launch: {
          label: 'Launch · months 1–3 post Sep 2026',
          rows: [
            ['Events directory views', '2k – 5k / mo', 'Every browse visit sees listings'],
            ['Organiser profile views', '400 – 1.2k / mo', 'Organiser tab discovery'],
            ['Discovery-led bookings', '50 – 180 / mo', 'New attendees from directory'],
          ],
        },
        growth: {
          label: 'Growth · months 4–12',
          rows: [
            ['Events directory views', '8k – 18k / mo', 'Primary UK events browse'],
            ['Organiser profile views', '2k – 5k / mo', 'Reviews · ranking badges visible'],
            ['Discovery-led bookings', '400 – 1.2k / mo', 'Guest visits · member conversion'],
          ],
        },
        scale: {
          label: 'Scale · year 2+',
          rows: [
            ['Events directory views', '20k – 45k / mo', 'Regional networking landing pages'],
            ['Organiser profile views', '6k – 15k / mo', 'Organiser ecosystem at scale'],
            ['Discovery-led bookings', '1.5k – 4k / mo', 'Lifecycle emails bring browsers back'],
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
          escHtml(row[0]) +
          '</td><td class="num">' +
          escHtml(row[1]) +
          '</td><td>' +
          escHtml(row[2]) +
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
