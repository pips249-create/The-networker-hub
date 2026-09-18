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

  function logoCandidatesFromPayload(payload) {
    var list = (payload && payload.prospectLogoCandidates) || [];
    if (list.length) return list.slice();
    if (payload && payload.prospectLogoUrl) return [payload.prospectLogoUrl];
    if (payload && payload.website) {
      var fb = logoUrlFromWebsite(payload.website);
      return fb ? [fb] : [];
    }
    return [];
  }

  function enrichHero(hero, payload) {
    hero = hero || {};
    var candidates = logoCandidatesFromPayload(payload);
    // Always prefer API-resolved candidates over a stale saved Clearbit URL.
    if (candidates.length) {
      hero.prospectLogoUrl = candidates[0];
    } else if (payload && payload.prospectLogoUrl) {
      hero.prospectLogoUrl = payload.prospectLogoUrl;
    } else if (!hero.prospectLogoUrl && payload && payload.website) {
      hero.prospectLogoUrl = logoUrlFromWebsite(payload.website);
    }
    if (!hero.preparedFor && payload && payload.companyName) {
      hero.preparedFor = payload.companyName;
    }
    hero.prospectLogoCandidates = candidates;
    return hero;
  }

  function renderProspectLogoBlock(hero) {
    var name = String(hero.preparedFor || 'Partner').trim();
    var src = hero.prospectLogoUrl || (hero.prospectLogoCandidates && hero.prospectLogoCandidates[0]) || '';
    if (src) {
      return (
        '<img class="custom-pitch-partner-logo" src="' +
        escHtml(src) +
        '" alt="' +
        escHtml(name) +
        '" width="220" height="64" decoding="async" referrerpolicy="no-referrer">'
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

  function heroOfferChips(hero) {
    var chips = hero.chips || [];
    if (!chips.length) return '';
    return (
      '<div class="custom-pitch-hero-chip-row">' +
      chips
        .map(function (c, i) {
          return (
            '<span class="custom-pitch-hero-chip' +
            (i > 1 ? ' custom-pitch-hero-chip--soft' : '') +
            '">' +
            escHtml(c) +
            '</span>'
          );
        })
        .join('') +
      '</div>'
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
    var rawHeadline = String(hero.headline || '');
    var accentMatch = rawHeadline.match(/^(.+?\s)(on The Networker UK.*)$/i);
    var h1Html = accentMatch
      ? escHtml(accentMatch[1]) + '<span class="accent">' + escHtml(accentMatch[2]) + '</span>'
      : escHtml(rawHeadline);

    return (
      '<div class="custom-pitch-hero-showcase">' +
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
      heroOfferChips(hero) +
      website +
      '</header></div>'
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
    if (!b) return { strong: '', span: '' };
    var dash = b.indexOf('—');
    if (dash === -1) dash = b.indexOf(' – ');
    if (dash === -1) dash = b.indexOf(' - ');
    if (dash > 8 && dash < 56) {
      return {
        strong: b.slice(0, dash).trim(),
        span: b.slice(dash + 1).replace(/^[-–—]\s*/, '').trim(),
      };
    }
    var colon = b.indexOf(':');
    if (colon > 8 && colon < 48) {
      return { strong: b.slice(0, colon).trim(), span: b.slice(colon + 1).trim() };
    }
    // Long bullets: full text in the body — never truncate with ellipsis.
    return { strong: '', span: b };
  }

  function renderEmailInventory(section) {
    var inv = section && section.emailInventory;
    if (!inv) return '';

    function listBlock(part) {
      var templates = part.templates || [];
      if (!templates.length) return '';
      var count = part.count || templates.length;
      return (
        '<details class="pitch-email-details">' +
        '<summary>Full email list (' +
        escHtml(String(count)) +
        ' templates)' +
        (part.shortLabel ? ' — ' + escHtml(part.shortLabel) : '') +
        '</summary>' +
        '<ul class="pitch-email-tags">' +
        templates
          .map(function (name) {
            return '<li>' + escHtml(name) + '</li>';
          })
          .join('') +
        '</ul></details>'
      );
    }

    if (inv.tally && Array.isArray(inv.parts) && inv.parts.length) {
      return (
        '<div class="pitch-email-tally">' +
        inv.parts.map(listBlock).join('') +
        '</div>'
      );
    }

    return listBlock(inv);
  }

  function liveLinkForSection(section) {
    var id = String((section && section.id) || '');
    var title = String((section && section.title) || '').toLowerCase();
    if (/email_inventory|sponsor_email/.test(id)) {
      return { href: '/advertising', label: 'Open rate card →' };
    }
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
    var extraList = '';

    if (tiles) {
      statGrid = '<div class="pitch-stat-grid">' + tiles + '</div>';
      if (bullets.length) {
        extraList =
          '<ul class="sponsor-pitch-checklist">' +
          bullets
            .map(function (b) {
              return '<li>' + escHtml(b) + '</li>';
            })
            .join('') +
          '</ul>';
      }
    } else if (bullets.length) {
      var cardable = bullets.every(function (b) {
        var s = bulletToStat(b);
        return s.strong && s.strong.length <= 56 && s.span;
      });
      if (cardable) {
        statGrid =
          '<div class="pitch-stat-grid">' +
          bullets
            .map(function (b) {
              var stat = bulletToStat(b);
              return (
                '<article class="pitch-stat"><strong>' +
                escHtml(stat.strong) +
                '</strong><span>' +
                escHtml(stat.span) +
                '</span></article>'
              );
            })
            .join('') +
          '</div>';
      } else {
        extraList =
          '<ul class="sponsor-pitch-checklist">' +
          bullets
            .map(function (b) {
              return '<li>' + escHtml(b) + '</li>';
            })
            .join('') +
          '</ul>';
      }
    }

    var body = statGrid + extraList + renderEmailInventory(section);
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

  function salesSenderFromPayload(payload) {
    var raw = String(
      (payload && (payload.createdByEmail || payload.fromEmail || payload.ownerEmail)) || ''
    )
      .trim()
      .toLowerCase();
    if (/^catherine@/.test(raw) || raw.indexOf('catherine@') !== -1) {
      return { name: 'Catherine', email: 'catherine@thenetworkeruk.com' };
    }
    if (/^jamie@/.test(raw) || raw.indexOf('jamie@') !== -1) {
      return { name: 'Jamie', email: 'jamie@thenetworkeruk.com' };
    }
    if (/^rosie@/.test(raw) || raw.indexOf('rosie@') !== -1) {
      return { name: 'Rosie', email: 'rosie@thenetworkeruk.com' };
    }
    // Default commercial inbox when creator is unknown.
    return { name: 'Rosie', email: 'rosie@thenetworkeruk.com' };
  }

  function deckHasLaunchOffer(deck, payload) {
    var placements =
      (deck && deck.sponsorshipPlacements) ||
      (payload && payload.sponsorshipPlacements) ||
      [];
    if (placements.indexOf('opportunity_directory_listing') !== -1) return true;
    var sections = (deck && deck.sections) || [];
    return sections.some(function (s) {
      return /sponsor_opportunity_directory_listing|sponsor_featured_opportunity_boost/.test(
        String((s && s.id) || '')
      );
    });
  }

  function renderClose(close, companyName, payload, deck) {
    var co = escHtml(companyName || 'your partner');
    var sender = salesSenderFromPayload(payload || {});
    var mailSubject = encodeURIComponent('Partnership — ' + (companyName || 'The Networker UK'));
    var launch = deckHasLaunchOffer(deck, payload);
    var checklist = launch
      ? '<div class="pitch-spec-row">' +
        '<div><strong>Logo</strong> High-res PNG/SVG · landscape</div>' +
        '<div><strong>Franchise overview</strong> 150–300 words + key investment figures</div>' +
        '<div><strong>Target destination</strong> Direct URL for franchise enquiries</div>' +
        '<div><strong>Lead email</strong> Where candidate enquiries should be sent</div>' +
        '</div>'
      : '<div class="pitch-spec-row">' +
        '<div><strong>Logo</strong> PNG/SVG · landscape · for listing &amp; creative</div>' +
        '<div><strong>Listing copy</strong> Opportunity description, investment level, enquiry routing</div>' +
        '<div><strong>Website</strong> HTTPS URL for the listing CTA</div>' +
        '<div><strong>Timing</strong> Preferred go-live date</div>' +
        '</div>';
    var ctaCopy = launch
      ? 'Send the four assets above — we publish the listing, schedule spotlight months, and confirm the launch offer in writing.'
      : 'Send assets and preferred start date — we confirm placements and go live.';
    return (
      '<section class="sponsor-pitch-section" id="close">' +
      '<h2>What we need from you</h2>' +
      (launch
        ? '<p class="section-intro">A frictionless 2-minute handoff — then we do the rest.</p>'
        : '') +
      checklist +
      '<div class="sponsor-pitch-cta">' +
      '<div><h2>Ready to confirm?</h2>' +
      '<p>' +
      ctaCopy +
      '</p></div>' +
      '<div class="sponsor-pitch-cta-actions">' +
      '<a class="primary" href="mailto:' +
      escHtml(sender.email) +
      '?subject=' +
      mailSubject +
      '">Email ' +
      escHtml(sender.name) +
      ' →</a>' +
      '<a class="secondary" href="/advertising" target="_blank" rel="noopener">Rate card</a>' +
      '</div></div>' +
      '<p class="pitch-footnote">Prepared by The Networker UK for ' +
      co +
      ' · Share this link after the meeting</p>' +
      '</section>'
    );
  }

  function syncPreviewThumbLogos(root, src) {
    if (!root || !src) return;
    root.querySelectorAll('.ad-mock-spotlight-thumb--opp').forEach(function (el) {
      el.style.backgroundImage = 'url("' + String(src).replace(/"/g, '\\"') + '")';
      el.style.backgroundSize = 'contain';
      el.style.backgroundPosition = 'center';
      el.style.backgroundRepeat = 'no-repeat';
      el.textContent = '';
    });
  }

  function bindProspectLogoFallback(root, payload) {
    if (!root) return;
    var name = String((payload && payload.companyName) || 'Partner').trim();
    var initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map(function (w) {
        return w.charAt(0);
      })
      .join('')
      .toUpperCase();
    var candidates = logoCandidatesFromPayload(payload);
    if (!candidates.length && payload && payload.prospectLogoUrl) {
      candidates = [payload.prospectLogoUrl];
    }

    function replaceWithMark(img) {
      var mark = document.createElement('span');
      mark.className = 'custom-pitch-prospect-mark';
      mark.textContent = initials || name.slice(0, 2).toUpperCase();
      if (img.parentNode) img.parentNode.replaceChild(mark, img);
    }

    root.querySelectorAll(
      '.custom-pitch-partner-logo, .custom-pitch-detail-logo, .ad-full-email-sponsor-logo'
    ).forEach(function (img) {
      var idx = 0;
      img.removeAttribute('crossorigin');
      function tryNext() {
        idx += 1;
        if (idx >= candidates.length) {
          replaceWithMark(img);
          return;
        }
        img.removeAttribute('crossorigin');
        img.src = candidates[idx];
      }
      img.addEventListener('error', tryNext);
      img.addEventListener(
        'load',
        function () {
          syncPreviewThumbLogos(root, img.currentSrc || img.src);
        },
        { once: true }
      );
      if (candidates.length) {
        // Prefer API-resolved candidate list; do not force CORS (breaks many brand CDNs).
        img.src = candidates[0];
      }
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
    var sections = Array.isArray(deck.sections) ? deck.sections : [];
    var root = document.getElementById('custom-pitch-root');
    if (!root) return;

    document.title = (payload.companyName || 'Tailored pitch') + ' — sales walkthrough';

    var bannerLabel = document.getElementById('custom-pitch-banner-label');
    if (bannerLabel) {
      bannerLabel.textContent = 'Tailored deck — ' + (payload.companyName || 'prospect');
    }
    var sender = salesSenderFromPayload(payload);
    var bannerMail = document.getElementById('custom-pitch-banner-mail');
    if (bannerMail) {
      bannerMail.href = 'mailto:' + sender.email;
      bannerMail.textContent = sender.email;
    }

    var liveHtml = '';
    try {
      var previewCtx = {
        companyName: payload.companyName,
        website: payload.website,
        logoUrl: (deck.hero && deck.hero.prospectLogoUrl) || '',
      };
      if (window.CustomPitchPreviews && typeof CustomPitchPreviews.renderLiveExamplesSection === 'function') {
        liveHtml = CustomPitchPreviews.renderLiveExamplesSection(previewCtx, deck) || '';
      }
    } catch (previewErr) {
      console.warn('[custom-pitch-deck] live examples skipped', previewErr);
      liveHtml = '';
    }

    var navSections = sections.slice();
    var sectionParts = sections.map(renderSection);
    if (liveHtml) {
      // Show visuals first — before text-heavy opening.
      sectionParts.unshift(liveHtml);
      navSections.unshift({
        id: 'custom_pitch_live_examples',
        navLabel: 'Live examples',
      });
    }

    root.innerHTML =
      renderHero(deck.hero || {}) +
      renderNav(navSections) +
      sectionParts.join('') +
      renderClose(deck.close, payload.companyName, payload, deck);

    bindSectionNav();
    bindProspectLogoFallback(root, payload);
    try {
      if (window.CustomPitchPreviews && typeof CustomPitchPreviews.bindTabs === 'function') {
        CustomPitchPreviews.bindTabs(root);
      }
    } catch (tabErr) {
      console.warn('[custom-pitch-deck] preview tabs skipped', tabErr);
    }
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
      try {
        renderDeck(result.data);
      } catch (renderErr) {
        console.error('[custom-pitch-deck] render', renderErr);
        showError('Could not display this pitch deck. Try a hard refresh, then open the link from Command Centre again.');
      }
    })
    .catch(function (err) {
      console.error('[custom-pitch-deck]', err);
      showError('Could not load this pitch deck. Try a hard refresh (Ctrl+Shift+R), then open the link from Command Centre again.');
    });
})();
