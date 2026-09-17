(function () {
  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function deckSlugFromPath() {
    var params = new URLSearchParams(window.location.search || '');
    var q = String(params.get('slug') || '').trim().toLowerCase();
    if (/^custom-[a-z0-9-]+$/.test(q)) return q;

    var path = (window.location.pathname || '').replace(/\.html$/i, '').replace(/\/+$/, '');
    if (/\/p-tnh-custom-deck$/i.test(path)) return '';
    var m = path.match(/\/p-tnh-(custom-[a-z0-9-]+)$/i);
    if (m && m[1].toLowerCase() !== 'custom-deck') return m[1].toLowerCase();
    return '';
  }

  function logoUrlFromWebsite(website) {
    try {
      var raw = String(website || '').trim();
      if (!raw) return '';
      var url = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw.replace(/^\/+/, '');
      var host = new URL(url).hostname.replace(/^www\./i, '');
      return host ? 'https://logo.clearbit.com/' + host : '';
    } catch (e) {
      return '';
    }
  }

  function enrichHero(hero, payload) {
    hero = hero || {};
    if (!hero.prospectLogoUrl && payload && payload.prospectLogoUrl) {
      hero.prospectLogoUrl = payload.prospectLogoUrl;
    }
    if (!hero.prospectLogoUrl && payload && payload.website) {
      hero.prospectLogoUrl = logoUrlFromWebsite(payload.website);
    }
    if (!hero.prospectLogoUrl && hero.website) {
      hero.prospectLogoUrl = logoUrlFromWebsite(hero.website);
    }
    if (!hero.preparedFor && payload && payload.companyName) {
      hero.preparedFor = payload.companyName;
    }
    return hero;
  }

  function renderProspectLogoBlock(hero) {
    var name = String(hero.preparedFor || 'Partner').trim();
    if (hero.prospectLogoUrl) {
      return (
        '<img class="custom-pitch-partner-logo" src="' +
        escHtml(hero.prospectLogoUrl) +
        '" alt="' +
        escHtml(name) +
        '" width="200" height="56">'
      );
    }
    var initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map(function (w) {
        return w.charAt(0);
      })
      .join('')
      .toUpperCase();
    return (
      '<span class="custom-pitch-prospect-mark">' +
      escHtml(initials || name.slice(0, 2).toUpperCase()) +
      '</span>'
    );
  }

  function heroPriceChip(hero) {
    var chips = hero.chips || [];
    if (!chips.length) return '';
    if (chips.length === 1) {
      return '<p class="sponsor-pitch-price-chip">' + escHtml(chips[0]) + '</p>';
    }
    return (
      '<p class="sponsor-pitch-price-chip">' +
      escHtml(chips[0]) +
      ' <span>/ ' +
      escHtml(chips.slice(1).join(' · ')) +
      '</span></p>'
    );
  }

  function renderHero(hero) {
    var website = hero.website
      ? '<p class="pitch-aside"><a href="' +
        escHtml(hero.website) +
        '" target="_blank" rel="noopener">' +
        escHtml(hero.websiteLabel || hero.website) +
        '</a></p>'
      : '';
    var headline = escHtml(hero.headline || '');
    var accentMatch = headline.match(/^(.+?\s)(on The Networker UK.*)$/i);
    var h1Html = accentMatch
      ? escHtml(accentMatch[1]) + '<span class="accent">' + escHtml(accentMatch[2]) + '</span>'
      : headline;

    return (
      '<header class="sponsor-pitch-hero">' +
      '<div class="custom-pitch-logo-row">' +
      renderProspectLogoBlock(hero) +
      '<span class="custom-pitch-logo-x" aria-hidden="true">×</span>' +
      '<img src="/assets/logo-nav-transparent.png?v=20260823uk3" alt="The Networker UK" width="220" height="48">' +
      '</div>' +
      '<p class="sponsor-pitch-kicker">Prepared for ' +
      escHtml(hero.preparedFor || 'your partner') +
      '</p>' +
      '<h1>' +
      h1Html +
      '</h1>' +
      '<p class="sponsor-pitch-lede">' +
      escHtml(hero.lede || '') +
      '</p>' +
      heroPriceChip(hero) +
      website +
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
      '<nav class="sponsor-pitch-nav" id="pitch-section-nav" aria-label="Sections">' +
      '<div class="sponsor-pitch-nav-inner">' +
      buttons +
      '</div></nav>'
    );
  }

  function bulletToStat(text) {
    var b = String(text || '').trim();
    var dash = b.indexOf('—');
    if (dash === -1) dash = b.indexOf(' – ');
    if (dash === -1) dash = b.indexOf(' - ');
    if (dash > 0 && dash < 90) {
      return {
        strong: b.slice(0, dash).trim(),
        span: b.slice(dash + 1).replace(/^[-–—]\s*/, '').trim(),
      };
    }
    var colon = b.indexOf(':');
    if (colon > 0 && colon < 70) {
      return { strong: b.slice(0, colon).trim(), span: b.slice(colon + 1).trim() };
    }
    if (b.length > 72) {
      return { strong: b.slice(0, 68) + '…', span: b };
    }
    return { strong: b, span: '' };
  }

  function liveLinkForSection(section) {
    var id = String((section && section.id) || '');
    var title = String((section && section.title) || '').toLowerCase();
    if (/opportunity|listing|spotlight|sponsor_opportunity|sponsor_headline_opportunities/.test(id + title)) {
      return {
        href: '/opportunities/',
        label: 'Open live /opportunities/ →',
      };
    }
    if (/event|headline_events|sponsor_headline_events/.test(id + title)) {
      return { href: '/events/', label: 'Open live /events/ →' };
    }
    if (/organiser|onboard|dashboard/.test(id + title)) {
      return { href: '/for-organisers', label: 'For organisers →' };
    }
    return null;
  }

  function renderSection(section) {
    var live = liveLinkForSection(section);
    var titleHtml = live
      ? '<div class="pitch-section-head"><h2>' +
        escHtml(section.title || '') +
        '</h2><a class="pitch-live-link" href="' +
        escHtml(live.href) +
        '" target="_blank" rel="noopener">' +
        escHtml(live.label) +
        '</a></div>'
      : '<h2>' + escHtml(section.title || '') + '</h2>';

    var priceHtml = '';
    if (section.price) {
      priceHtml = /included|no charge|free/i.test(String(section.price))
        ? '<p class="sponsor-pitch-price-chip">' + escHtml(section.price) + '</p>'
        : '<p class="section-intro"><strong>' + escHtml(section.price) + '</strong></p>';
    }

    var tiles = (section.tiles || [])
      .map(function (t) {
        return (
          '<article class="pitch-stat"><strong>' +
          escHtml(t.title) +
          '</strong><span>' +
          escHtml(t.body) +
          '</span></article>'
        );
      })
      .join('');

    var bullets = section.bullets || [];
    var statGrid = '';
    if (!tiles.length && bullets.length) {
      statGrid =
        '<div class="pitch-stat-grid">' +
        bullets
          .slice(0, 4)
          .map(function (b) {
            var stat = bulletToStat(b);
            return (
              '<article class="pitch-stat"><strong>' +
              escHtml(stat.strong) +
              '</strong>' +
              (stat.span ? '<span>' + escHtml(stat.span) + '</span>' : '') +
              '</article>'
            );
          })
          .join('') +
        '</div>';
    }

    var extraList = '';
    if (bullets.length > 4) {
      extraList =
        '<ul class="sponsor-pitch-checklist">' +
        bullets
          .slice(4)
          .map(function (b) {
            return '<li>' + escHtml(b) + '</li>';
          })
          .join('') +
        '</ul>';
    } else if (!statGrid && bullets.length) {
      extraList =
        '<ul class="sponsor-pitch-checklist">' +
        bullets
          .map(function (b) {
            return '<li>' + escHtml(b) + '</li>';
          })
          .join('') +
        '</ul>';
    }

    if (tiles) {
      statGrid = '<div class="pitch-stat-grid">' + tiles + '</div>';
    }

    var body = statGrid + extraList;
    if (section.quote) {
      body += '<p class="pitch-aside">&ldquo;' + escHtml(section.quote) + '&rdquo;</p>';
    }

    return (
      '<section class="sponsor-pitch-section" id="' +
      escHtml(section.id) +
      '">' +
      titleHtml +
      priceHtml +
      (section.intro ? '<p class="section-intro">' + escHtml(section.intro) + '</p>' : '') +
      body +
      '</section>'
    );
  }

  function renderClose(close, companyName) {
    var co = escHtml(companyName || 'your partner');
    var mailSubject = encodeURIComponent('Partnership — ' + (companyName || 'The Networker UK'));
    return (
      '<section class="sponsor-pitch-section" id="close">' +
      '<h2>What we need from you</h2>' +
      '<div class="pitch-spec-row">' +
      '<div><strong>Logo</strong> PNG/SVG · landscape · for listing &amp; spotlight</div>' +
      '<div><strong>Listing copy</strong> Opportunity description, investment level, enquiry routing</div>' +
      '<div><strong>Website</strong> HTTPS URL for the listing CTA</div>' +
      '<div><strong>Timing</strong> Go-live date for listing + first Premium Spotlight month</div>' +
      '</div>' +
      '<div class="sponsor-pitch-cta">' +
      '<div><h2>Ready to confirm?</h2>' +
      '<p>Send assets and preferred start date — we publish the listing, schedule spotlight months, and confirm the launch offer in writing.</p></div>' +
      '<div class="sponsor-pitch-cta-actions">' +
      '<a class="primary" href="mailto:rosie@thenetworkeruk.com?subject=' +
      mailSubject +
      '">Email Rosie →</a>' +
      '<a class="secondary" href="/advertising" target="_blank" rel="noopener">Rate card</a>' +
      '</div></div>' +
      '<p class="pitch-footnote">Prepared by The Networker UK for ' +
      co +
      ' · Share this link after the meeting (same format as the Events Headline sales walkthrough)</p>' +
      '</section>'
    );
  }

  function bindProspectLogoFallback(root, companyName) {
    if (!root) return;
    var name = String(companyName || 'Partner').trim();
    var initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map(function (w) {
        return w.charAt(0);
      })
      .join('')
      .toUpperCase();
    root.querySelectorAll('.custom-pitch-partner-logo').forEach(function (img) {
      img.addEventListener(
        'error',
        function () {
          var mark = document.createElement('span');
          mark.className = 'custom-pitch-prospect-mark';
          mark.textContent = initials || name.slice(0, 2).toUpperCase();
          if (img.parentNode) img.parentNode.replaceChild(mark, img);
        },
        { once: true }
      );
    });
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

  function showError(message) {
    var root = document.getElementById('custom-pitch-root');
    if (root) {
      root.innerHTML =
        '<p class="section-intro" style="color:#991b1b;border:1px solid #fecaca;background:#fef2f2;padding:1rem;border-radius:12px;">' +
        escHtml(message) +
        '</p>';
    }
  }

  function renderDeck(payload) {
    var deck = payload.deck || {};
    deck.hero = enrichHero(deck.hero, payload);
    var sections = deck.sections || [];
    var root = document.getElementById('custom-pitch-root');
    if (!root) return;

    document.title = (payload.companyName || 'Tailored pitch') + ' — sales walkthrough';

    var bannerLabel = document.getElementById('custom-pitch-banner-label');
    if (bannerLabel) {
      bannerLabel.textContent = 'Tailored deck — ' + (payload.companyName || 'prospect');
    }

    root.innerHTML =
      renderHero(deck.hero || {}) +
      renderNav(sections) +
      sections.map(renderSection).join('') +
      renderClose(deck.close, payload.companyName);

    bindSectionNav();
    bindProspectLogoFallback(root, payload.companyName);
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
