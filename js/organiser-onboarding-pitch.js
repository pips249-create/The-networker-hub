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
      document.body.style.overflow = 'hidden';
    }

    function closePresent() {
      overlay.classList.remove('is-open');
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
})();
