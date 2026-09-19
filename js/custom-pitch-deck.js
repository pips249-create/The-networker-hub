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
    var accentMatch =
      rawHeadline.match(/^(.+?\s)(on The Networker UK.*)$/i) ||
      rawHeadline.match(/^(Complimentary launch partnership)(\s+for\s+.+)$/i) ||
      rawHeadline.match(/^(Launch partnership walkthrough)(\s+[—-]\s+.+)$/i);
    var h1Html = accentMatch
      ? '<span class="accent">' +
        escHtml(accentMatch[1]) +
        '</span>' +
        escHtml(accentMatch[2] || '')
      : escHtml(rawHeadline);

    return (
      '<div class="custom-pitch-hero-showcase">' +
      '<header class="sponsor-pitch-hero">' +
      '<div class="custom-pitch-logo-row">' +
      renderProspectLogoBlock(hero) +
      '<span class="custom-pitch-logo-x" aria-hidden="true">×</span>' +
      '<img src="/assets/logo-nav-transparent.png?v=20260823uk3" alt="The Networker UK" width="220" height="48">' +
      '</div>' +
      '<p class="sponsor-pitch-kicker">Sales walkthrough · talk track for ' +
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

  function renderSayNotes(section) {
    var notes = (section && section.sayNotes) || [];
    if (!notes.length) return '';
    return (
      '<ul class="pitch-presenter-notes">' +
      notes
        .map(function (n) {
          var text = String(n || '').trim();
          if (!text) return '';
          var labeled = /^(Say|Ask|Confirm|Coach)\s*:/i.test(text);
          if (labeled) {
            var parts = text.split(/:\s*/);
            var label = parts.shift();
            return (
              '<li><strong>' +
              escHtml(label) +
              ':</strong> ' +
              escHtml(parts.join(': ').replace(/^["“]|["”]$/g, '')) +
              '</li>'
            );
          }
          return '<li><strong>Say:</strong> ' + escHtml(text) + '</li>';
        })
        .filter(Boolean)
        .join('') +
      '</ul>'
    );
  }

  function formatTalkBullet(text) {
    var b = String(text || '').trim();
    var m = b.match(/^(Ask|Say|Confirm|Ask for|Book|Optional later)\s*:\s*(.*)$/i);
    if (m) {
      return '<li><strong>' + escHtml(m[1]) + ':</strong> ' + escHtml(m[2]) + '</li>';
    }
    if (/\?$/.test(b)) {
      return '<li><strong>Ask:</strong> ' + escHtml(b) + '</li>';
    }
    return '<li>' + escHtml(b) + '</li>';
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
    var isTalkSection =
      section.id === 'sponsor_opening' ||
      section.id === 'sponsor_next_steps' ||
      /^(Ask|Say|Confirm|Ask for)\s*:/i.test(String(bullets[0] || ''));

    if (tiles) {
      statGrid = '<div class="pitch-stat-grid">' + tiles + '</div>';
      if (bullets.length) {
        extraList =
          '<ul class="sponsor-pitch-checklist">' +
          bullets.map(formatTalkBullet).join('') +
          '</ul>';
      }
    } else if (bullets.length) {
      if (isTalkSection) {
        extraList =
          '<ul class="sponsor-pitch-checklist custom-pitch-talk-list">' +
          bullets.map(formatTalkBullet).join('') +
          '</ul>';
      } else {
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
            bullets.map(formatTalkBullet).join('') +
            '</ul>';
        }
      }
    }

    var coach =
      section.intro && /talk track|coach notes|internal/i.test(String(section.intro))
        ? '<p class="custom-pitch-coach"><strong>Coach:</strong> ' + escHtml(section.intro) + '</p>'
        : section.intro
          ? '<p class="section-intro">' + escHtml(section.intro) + '</p>'
          : '';

    var body =
      renderSayNotes(section) + statGrid + extraList + renderEmailInventory(section);
    if (section.quote) {
      body +=
        '<p class="pitch-aside"><strong>Line:</strong> &ldquo;' +
        escHtml(section.quote) +
        '&rdquo;</p>';
    }

    return (
      '<section class="sponsor-pitch-section" id="' +
      escHtml(section.id) +
      '">' +
      titleHtml +
      priceHtml +
      coach +
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
        '<div><strong>Ask for · Logo</strong> High-res PNG/SVG · landscape</div>' +
        '<div><strong>Ask for · Overview</strong> 150–300 words + investment figures</div>' +
        '<div><strong>Ask for · URL</strong> Direct franchise enquiry destination</div>' +
        '<div><strong>Ask for · Lead email</strong> Where candidate enquiries go</div>' +
        '</div>'
      : '<div class="pitch-spec-row">' +
        '<div><strong>Ask for · Logo</strong> PNG/SVG · landscape</div>' +
        '<div><strong>Ask for · Copy</strong> Listing description + investment level</div>' +
        '<div><strong>Ask for · Website</strong> HTTPS URL for the CTA</div>' +
        '<div><strong>Ask for · Timing</strong> Preferred go-live date</div>' +
        '</div>';
    var ctaCopy = launch
      ? 'Close by asking for the four assets — then you publish the listing and schedule spotlight months.'
      : 'Close by agreeing placements and start dates, then collect logo + URL.';
    return (
      '<section class="sponsor-pitch-section" id="close">' +
      '<h2>Close the call</h2>' +
      (launch
        ? '<p class="section-intro">Keep the asset ask short — this is your end-of-call checklist, not a leave-behind.</p>'
        : '') +
      checklist +
      '<div class="sponsor-pitch-cta">' +
      '<div><h2>After they say yes</h2>' +
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
      '<p class="pitch-footnote">Internal walkthrough for ' +
      co +
      ' — read on the call · show live /opportunities/ or /events/ demos · not a leave-behind PDF</p>' +
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
      '.custom-pitch-partner-logo, .custom-pitch-detail-logo, .custom-pitch-events-logo, .ad-full-email-sponsor-logo'
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
      bannerLabel.textContent =
        'Sales walkthrough — ' + (payload.companyName || 'prospect') + ' · read on the call';
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
