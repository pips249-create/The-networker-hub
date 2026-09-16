(function () {
  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function deckSlugFromPath() {
    var path = (window.location.pathname || '').replace(/\.html$/i, '').replace(/\/+$/, '');
    var m = path.match(/\/p-tnh-(custom-[a-z0-9-]+)$/i);
    if (m) return m[1].toLowerCase();
    var params = new URLSearchParams(window.location.search || '');
    var q = String(params.get('slug') || '').trim().toLowerCase();
    if (/^custom-[a-z0-9-]+$/.test(q)) return q;
    return '';
  }

  function renderHero(hero) {
    var chips = (hero.chips || [])
      .map(function (c) {
        return '<span class="org-pitch-chip">' + escHtml(c) + '</span>';
      })
      .join('');
    var website = hero.website
      ? '<a href="' +
        escHtml(hero.website) +
        '" target="_blank" rel="noopener">' +
        escHtml(hero.websiteLabel || hero.website) +
        '</a>'
      : '';
    return (
      '<header class="sponsor-pitch-hero">' +
      '<div class="org-pitch-hero-logos">' +
      '<img src="/assets/logo-nav-transparent.png?v=20260823uk3" alt="The Networker UK" width="220" height="48">' +
      '</div>' +
      '<p class="sponsor-pitch-kicker">Prepared for ' +
      escHtml(hero.preparedFor || 'your group') +
      '</p>' +
      '<h1>' +
      escHtml(hero.headline || '') +
      '</h1>' +
      '<p class="sponsor-pitch-lede">' +
      escHtml(hero.lede || '') +
      '</p>' +
      (chips ? '<div class="org-pitch-chip-row">' + chips + '</div>' : '') +
      (website ? '<p class="text-sm mt-3 opacity-80">' + website + '</p>' : '') +
      '</header>'
    );
  }

  function renderNav(sections) {
    var buttons = sections
      .map(function (s, i) {
        return (
          '<button type="button"' +
          (i === 0 ? ' class="is-active"' : '') +
          ' data-pitch-section="' +
          escHtml(s.id) +
          '">' +
          escHtml(s.navLabel || s.id) +
          '</button>'
        );
      })
      .join('');
    return (
      '<nav class="sponsor-pitch-nav" id="pitch-section-nav" aria-label="Presentation sections">' +
      '<div class="sponsor-pitch-nav-inner">' +
      buttons +
      '</div></nav>'
    );
  }

  function renderSection(section) {
    var tiles = (section.tiles || [])
      .map(function (t) {
        return (
          '<article class="org-pitch-tile"><strong>' +
          escHtml(t.title) +
          '</strong><span>' +
          escHtml(t.body) +
          '</span></article>'
        );
      })
      .join('');
    var bullets = (section.bullets || [])
      .map(function (b) {
        return '<li>' + escHtml(b) + '</li>';
      })
      .join('');
    var body = '';
    if (tiles) {
      body = '<div class="org-pitch-tight-grid">' + tiles + '</div>';
    } else if (bullets) {
      body = '<ul class="sponsor-pitch-checklist">' + bullets + '</ul>';
    }
    if (section.quote) {
      body +=
        '<p class="org-pitch-quote">&ldquo;' + escHtml(section.quote) + '&rdquo;</p>';
    }
    return (
      '<section class="sponsor-pitch-section" id="' +
      escHtml(section.id) +
      '">' +
      '<h2>' +
      escHtml(section.title || '') +
      '</h2>' +
      (section.intro
        ? '<p class="section-intro">' + escHtml(section.intro) + '</p>'
        : '') +
      body +
      '</section>'
    );
  }

  function renderClose(close) {
    return (
      '<section class="sponsor-pitch-section org-pitch-section--compact" id="close">' +
      '<div class="org-pitch-slide-close">' +
      '<img src="/assets/logo-nav-transparent.png?v=20260823uk3" alt="The Networker UK">' +
      '<p>' +
      escHtml((close && close.headline) || 'Find your next attendees') +
      '</p>' +
      '<p class="url">' +
      escHtml((close && close.url) || 'thenetworkeruk.com/for-organisers') +
      '</p></div></section>'
    );
  }

  function renderPresentSlides(deck) {
    var hero = deck.hero || {};
    var slides = [];
    slides.push(
      '<div class="org-pitch-slide is-active">' +
        '<p class="org-pitch-slide-kicker">' +
        escHtml(hero.preparedFor || '') +
        '</p>' +
        '<h2>' +
        escHtml(hero.headline || '') +
        '</h2>' +
        '<p class="org-pitch-slide-lede">' +
        escHtml(hero.lede || '') +
        '</p></div>'
    );
    (deck.sections || []).forEach(function (section) {
      var bullets = (section.bullets || [])
        .slice(0, 6)
        .map(function (b) {
          return '<li>' + escHtml(b) + '</li>';
        })
        .join('');
      slides.push(
        '<div class="org-pitch-slide">' +
          '<p class="org-pitch-slide-kicker">' +
          escHtml(section.kicker || section.navLabel || '') +
          '</p>' +
          '<h2>' +
          escHtml(section.title || '') +
          '</h2>' +
          (bullets ? '<ul class="org-pitch-slide-bullets">' + bullets + '</ul>' : '') +
          '</div>'
      );
    });
    slides.push(
      '<div class="org-pitch-slide"><div class="org-pitch-slide-close">' +
        '<img src="/assets/logo-nav-transparent.png?v=20260823uk3" alt="The Networker UK">' +
        '<p>' +
        escHtml((deck.close && deck.close.headline) || '') +
        '</p></div></div>'
    );
    return slides.join('');
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

    openBtn.disabled = false;
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

  function showError(message) {
    var root = document.getElementById('custom-pitch-root');
    if (root) {
      root.innerHTML =
        '<p class="text-sm text-red-800 p-6 rounded-xl border border-red-200 bg-red-50">' +
        escHtml(message) +
        '</p>';
    }
  }

  function renderDeck(payload) {
    var deck = payload.deck || {};
    var sections = deck.sections || [];
    var root = document.getElementById('custom-pitch-root');
    if (!root) return;

    document.title = (payload.companyName || 'Tailored pitch') + ' — organiser pitch';

    var bannerLabel = document.getElementById('custom-pitch-banner-label');
    if (bannerLabel) {
      bannerLabel.textContent = 'Tailored deck — ' + (payload.companyName || 'prospect');
    }
    var bannerMeta = document.getElementById('custom-pitch-banner-meta');
    if (bannerMeta) {
      bannerMeta.innerHTML =
        'Questions? <a href="mailto:rosie@thenetworkeruk.com">rosie@thenetworkeruk.com</a>';
    }

    root.innerHTML =
      renderHero(deck.hero || {}) +
      renderNav(sections) +
      sections.map(renderSection).join('') +
      renderClose(deck.close);

    var slideHost = document.getElementById('org-pitch-present-slides');
    if (slideHost) slideHost.innerHTML = renderPresentSlides(deck);

    bindSectionNav();
    bindPresentMode();
  }

  var slug = deckSlugFromPath();
  if (!slug) {
    showError('This deck link is missing a slug. Open it from Command Centre → Pitch deck.');
    return;
  }

  fetch('/api/custom-pitch-deck?slug=' + encodeURIComponent(slug))
    .then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, data: data };
      });
    })
    .then(function (result) {
      if (!result.ok || !result.data || !result.data.ok) {
        showError(
          (result.data && result.data.message) ||
            'Could not load this pitch deck.'
        );
        return;
      }
      renderDeck(result.data);
    })
    .catch(function () {
      showError('Could not load this pitch deck — check your connection and try again.');
    });
})();
