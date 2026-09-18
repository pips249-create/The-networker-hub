/**
 * Live visual examples for tailored sponsorship pitch decks (advertising-page mocks).
 */
(function (global) {
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function deckHasOpportunityVisuals(deck) {
    var placements = (deck && deck.sponsorshipPlacements) || [];
    var keys = placements.join(' ');
    if (/opportunity|listing|spotlight|featured_opportunity|headline_opportunities/i.test(keys)) {
      return true;
    }
    var sections = (deck && deck.sections) || [];
    return sections.some(function (s) {
      return /opportunity|listing|spotlight|sponsor_opportunity|sponsor_featured_opportunity/i.test(
        String(s.id || '') + String(s.title || '')
      );
    });
  }

  function deckHasEventsHeadline(deck) {
    var placements = (deck && deck.sponsorshipPlacements) || [];
    return placements.indexOf('headline_events') !== -1;
  }

  function deckHasOrganisersHeadline(deck) {
    var placements = (deck && deck.sponsorshipPlacements) || [];
    return placements.indexOf('headline_organisers') !== -1;
  }

  function deckHasOpportunitiesHeadline(deck) {
    var placements = (deck && deck.sponsorshipPlacements) || [];
    return placements.indexOf('headline_opportunities') !== -1;
  }

  function deckHasHeadlineEmail(deck) {
    return (
      deckHasEventsHeadline(deck) ||
      deckHasOrganisersHeadline(deck) ||
      deckHasOpportunitiesHeadline(deck)
    );
  }

  var HUB_LOGO = '/assets/logo-nav-transparent.png?v=20260823uk3';

  function sponsorEmailRowHtml(ctx) {
    var co = String(ctx.companyName || 'Partner').trim();
    var url = String(ctx.website || '#').trim() || '#';
    var logoInner = ctx.logoUrl
      ? '<img src="' +
        esc(ctx.logoUrl) +
        '" alt="' +
        esc(co) +
        '" class="ad-full-email-sponsor-logo" loading="lazy" decoding="async" referrerpolicy="no-referrer">'
      : '<span class="ad-full-email-sponsor-name">' + esc(co) + '</span>';
    return (
      '<div class="ad-full-email-sponsor ad-full-email-sponsor--highlight">' +
      '<p class="pitch-email-kicker">Powered by</p>' +
      '<a href="' +
      esc(url) +
      '" target="_blank" rel="noopener noreferrer">' +
      logoInner +
      '</a></div>'
    );
  }

  function renderBookingEmailPanel(ctx) {
    return (
      '<div class="ad-email-preview-wrap">' +
      '<div class="ad-email-preview-scale">' +
      '<div class="ad-email-preview-inner">' +
      '<div class="ad-full-email-card">' +
      '<div class="ad-full-email-header">' +
      '<img src="' +
      HUB_LOGO +
      '" alt="" class="ad-full-email-hub-logo">' +
      sponsorEmailRowHtml(ctx) +
      '<div class="ad-full-email-wave" aria-hidden="true"></div>' +
      '</div>' +
      '<div class="ad-full-email-body">' +
      '<div class="ad-full-email-check" aria-hidden="true"></div>' +
      '<p class="pitch-email-title">You\u2019re booked in</p>' +
      '<span class="ad-email-line"></span>' +
      '<span class="ad-email-line ad-email-line--short"></span>' +
      '</div>' +
      '<div class="ad-full-email-event-wrap">' +
      '<div class="ad-full-email-event">' +
      '<span class="ad-email-line ad-email-line--on-dark ad-email-line--xs"></span>' +
      '<span class="ad-email-line ad-email-line--on-dark ad-email-line--title"></span>' +
      '<span class="ad-email-line ad-email-line--on-dark"></span>' +
      '</div></div></div></div></div>' +
      '<p class="barns-preview-caption" style="margin:10px 0 0;font-size:0.85rem;color:var(--pitch-muted)">' +
      'Attendee booking email — ' +
      esc(ctx.companyName || 'your brand') +
      ' logo under The Networker UK header (same placement across 21 templates)</p>' +
      '</div>'
    );
  }

  function renderOrganiserEmailPanel(ctx) {
    return (
      '<div class="ad-email-preview-wrap">' +
      '<div class="ad-email-preview-scale">' +
      '<div class="ad-email-preview-inner">' +
      '<div class="ad-full-email-card">' +
      '<div class="ad-full-email-header">' +
      '<img src="' +
      HUB_LOGO +
      '" alt="" class="ad-full-email-hub-logo">' +
      sponsorEmailRowHtml(ctx) +
      '<div class="ad-full-email-wave" aria-hidden="true"></div>' +
      '</div>' +
      '<div class="ad-full-email-body">' +
      '<p class="ad-full-email-kicker">Organiser update</p>' +
      '<p class="pitch-email-title">New registration</p>' +
      '<span class="ad-email-line"></span>' +
      '<span class="ad-email-line ad-email-line--short"></span>' +
      '<span class="ad-email-line ad-email-line--short"></span>' +
      '</div></div></div></div>' +
      '<p class="barns-preview-caption" style="margin:10px 0 0;font-size:0.85rem;color:var(--pitch-muted)">' +
      'Organiser email — same Headline logo placement across 21 organiser templates</p>' +
      '</div>'
    );
  }

  function renderOpportunityEmailPanel(ctx) {
    return (
      '<div class="ad-email-preview-wrap">' +
      '<div class="ad-email-preview-scale">' +
      '<div class="ad-email-preview-inner">' +
      '<div class="ad-full-email-card">' +
      '<div class="ad-full-email-header">' +
      '<img src="' +
      HUB_LOGO +
      '" alt="" class="ad-full-email-hub-logo">' +
      sponsorEmailRowHtml(ctx) +
      '<div class="ad-full-email-wave" aria-hidden="true"></div>' +
      '</div>' +
      '<div class="ad-full-email-body">' +
      '<p class="ad-full-email-kicker">Business opportunity</p>' +
      '<p class="pitch-email-title">New enquiry received</p>' +
      '<span class="ad-email-line"></span>' +
      '<span class="ad-email-line ad-email-line--short"></span>' +
      '</div></div></div></div>' +
      '<p class="barns-preview-caption" style="margin:10px 0 0;font-size:0.85rem;color:var(--pitch-muted)">' +
      'Opportunity email — Headline logo in the header across 11 opportunity templates</p>' +
      '</div>'
    );
  }

  function listingTitle(ctx) {
    var co = String(ctx.companyName || 'Your brand').trim();
    if (/franchise|franchising/i.test(co) || /spaghetti/i.test(co)) {
      return co + ' — franchise territories UK-wide';
    }
    return co + ' — business opportunity';
  }

  function logoThumbStyle(ctx) {
    if (!ctx.logoUrl) {
      return 'background:linear-gradient(135deg,#e8f6f8,#f3eef8);display:flex;align-items:center;justify-content:center;font-weight:800;color:#1e3a4f;font-size:1.1rem';
    }
    return (
      'background-image:url("' +
      esc(ctx.logoUrl).replace(/"/g, '%22') +
      '");background-size:contain;background-position:center;background-repeat:no-repeat;background-color:#fff;'
    );
  }

  function renderSpotlightPanel(ctx) {
    var thumbExtra = ctx.logoUrl ? '' : esc(String(ctx.companyName || 'PS').slice(0, 2).toUpperCase());
    return (
      '<div class="ad-mock-spotlight ad-mock-spotlight--directory" aria-hidden="true">' +
      '<div class="ad-mock-spotlight-head"><span>Premium Spotlight</span><span>/opportunities/</span></div>' +
      '<p class="ad-preview-label" style="margin:0 0 10px;text-align:left">Featured row — first thing buyers see</p>' +
      '<div class="ad-mock-spotlight-card ad-mock-spotlight-card--rich ad-mock-spotlight-card--directory ad-mock-spotlight-card--featured">' +
      '<div class="ad-mock-spotlight-thumb ad-mock-spotlight-thumb--opp" style="' +
      logoThumbStyle(ctx) +
      '">' +
      (ctx.logoUrl ? '' : thumbExtra) +
      '</div>' +
      '<div class="ad-mock-spotlight-meta">' +
      '<strong>' +
      esc(listingTitle(ctx)) +
      '</strong>' +
      '<span>Franchise · Featured</span>' +
      '<span class="ad-mock-lorem ad-mock-lorem--card">Launch offer: three months in the Premium Spotlight carousel — highlighted card and Featured badge on browse.</span>' +
      '<span class="ad-mock-spotlight-tag">Included · 3 months</span>' +
      '</div></div></div>'
    );
  }

  function renderDetailPanel(ctx) {
    var slug = String(ctx.companyName || 'listing')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    return (
      '<div class="ad-mock-page ad-mock-page--detail ad-mock-page--opp-detail">' +
      '<div class="ad-mock-page-bar"><span></span><span></span><span></span><em>/opportunities/' +
      esc(slug || 'your-listing') +
      '</em></div>' +
      '<div class="ad-mock-detail-layout ad-mock-detail-layout--opp">' +
      '<div class="ad-mock-detail-main">' +
      (ctx.logoUrl
        ? '<img src="' +
          esc(ctx.logoUrl) +
          '" alt="" class="custom-pitch-detail-logo" width="160" height="48" referrerpolicy="no-referrer">'
        : '') +
      '<span class="ad-mock-detail-badge">Franchise · Listed on The Networker UK</span>' +
      '<h4 class="ad-mock-detail-title">' +
      esc(listingTitle(ctx)) +
      '</h4>' +
      '<p class="ad-mock-detail-meta">Investment &amp; territory · Member enquiries to you</p>' +
      '<div class="ad-mock-detail-body">' +
      '<p class="ad-mock-lorem">Public detail page on /opportunities/ with enquiry form, investment summary, and your website link — included for 12 months in this launch offer.</p>' +
      '</div>' +
      '<div class="custom-pitch-open-days">' +
      '<h3>Open days &amp; discovery sessions</h3>' +
      '<p class="custom-pitch-open-days-lede">List in-person or online open days on the listing — members register interest without leaving the platform.</p>' +
      '<ul class="custom-pitch-open-days-list">' +
      '<li><strong>Example · Online</strong> Discovery call — franchise overview &amp; Q&amp;A</li>' +
      '<li><strong>Example · In person</strong> Territory open day — meet the team</li>' +
      '<li><strong>You add dates</strong> From the organiser workspace when the listing is live</li>' +
      '</ul></div>' +
      '<span class="ad-mock-detail-cta">Send enquiry →</span>' +
      '</div></div></div>'
    );
  }

  function renderEventsHeadlinePanel(ctx) {
    var logoInner = ctx.logoUrl
      ? '<img src="' + esc(ctx.logoUrl) + '" alt="" referrerpolicy="no-referrer" style="max-height:44px;width:auto">'
      : '<span style="font-weight:800;font-size:0.85rem">' + esc(ctx.companyName || 'Partner') + '</span>';
    return (
      '<div class="ad-mock-page ad-mock-page--events-dir">' +
      '<div class="ad-mock-page-bar"><span></span><span></span><span></span><em>/events/</em></div>' +
      '<div class="ad-events-dir-scale">' +
      '<div class="ad-events-dir-mock" aria-hidden="true">' +
      '<section class="ad-events-dir-hero">' +
      '<div class="ad-events-dir-hero-inner">' +
      '<div class="ad-events-dir-hero-copy">' +
      '<span class="ad-events-dir-line ad-events-dir-line--badge"></span>' +
      '<span class="ad-events-dir-line ad-events-dir-line--title"></span>' +
      '<span class="ad-events-dir-line ad-events-dir-line--title2"></span>' +
      '</div>' +
      '<div class="ad-events-dir-sponsor-col">' +
      '<aside class="sponsor-hub sponsor-hub--in-hero sponsor-hub--active sponsor-hub--logo-only" style="margin:0 auto">' +
      '<div class="sponsor-hub-head"><span class="icon" aria-hidden="true">★</span><span>Powered by</span></div>' +
      '<div class="sponsor-logo-wrap sponsor-logo-band has-logo" style="background:#1a1a2e;padding:12px;border-radius:12px">' +
      logoInner +
      '</div></aside></div></div></section></div></div></div>'
    );
  }

  function renderLiveExamplesSection(ctx, deck) {
    var showOpp = deckHasOpportunityVisuals(deck);
    var showEvents = deckHasEventsHeadline(deck);
    var showOrgEmail = deckHasOrganisersHeadline(deck);
    var showOppEmail = deckHasOpportunitiesHeadline(deck);
    var showBookingEmail = showEvents;
    if (!showOpp && !showEvents && !showOrgEmail && !showOppEmail) return '';

    var tabBits = [];
    var panelBits = [];
    var noteBits = [];
    var firstKey = '';

    function addTab(key, label, panelHtml, noteHtml) {
      var isFirst = !firstKey;
      if (isFirst) firstKey = key;
      tabBits.push(
        '<button type="button" class="' +
          (isFirst ? 'is-active' : '') +
          '" role="tab" data-custom-pitch-preview="' +
          key +
          '" aria-selected="' +
          (isFirst ? 'true' : 'false') +
          '">' +
          label +
          '</button>'
      );
      panelBits.push(
        '<div class="pitch-preview-panel" data-custom-pitch-preview-panel="' +
          key +
          '" role="tabpanel"' +
          (isFirst ? '' : ' hidden') +
          '>' +
          panelHtml +
          '</div>'
      );
      if (noteHtml) noteBits.push(noteHtml);
    }

    if (showOpp) {
      addTab(
        'spotlight',
        'Premium Spotlight',
        renderSpotlightPanel(ctx),
        '<li><strong>Say:</strong> &ldquo;Premium Spotlight puts your listing in the featured row with a badge — included for three months in this launch offer.&rdquo;</li>'
      );
      addTab(
        'detail',
        'Listing + open days',
        renderDetailPanel(ctx),
        '<li><strong>Say:</strong> &ldquo;The detail page is where members read the offer, send enquiries, and book open days you publish.&rdquo;</li>'
      );
    }
    if (showEvents) {
      addTab(
        'events',
        'Events Headline',
        renderEventsHeadlinePanel(ctx),
        '<li><strong>Say:</strong> &ldquo;Events Headline is the Powered by hero on /events/.&rdquo;</li>'
      );
    }
    if (showBookingEmail) {
      addTab(
        'booking-email',
        'Booking email',
        renderBookingEmailPanel(ctx),
        '<li><strong>Say:</strong> &ldquo;Same sponsor logo in every attendee booking email, directly under our header — 21 templates.&rdquo;</li>'
      );
    }
    if (showOrgEmail) {
      addTab(
        'organiser-email',
        'Organiser email',
        renderOrganiserEmailPanel(ctx),
        '<li><strong>Say:</strong> &ldquo;Organisers Headline puts your logo in every organiser email — 21 templates.&rdquo;</li>'
      );
    }
    if (showOppEmail) {
      addTab(
        'opportunity-email',
        'Opportunity email',
        renderOpportunityEmailPanel(ctx),
        '<li><strong>Say:</strong> &ldquo;Opportunities Headline puts your logo in every opportunity email — 11 templates.&rdquo;</li>'
      );
    }

    var liveLink = showOpp
      ? '<a class="pitch-live-link" href="/opportunities/" target="_blank" rel="noopener">Open live /opportunities/ →</a>'
      : showEvents
        ? '<a class="pitch-live-link" href="/events/" target="_blank" rel="noopener">Open live /events/ →</a>'
        : '<a class="pitch-live-link" href="/advertising" target="_blank" rel="noopener">Open rate card →</a>';

    return (
      '<section class="sponsor-pitch-section custom-pitch-live-examples" id="custom_pitch_live_examples">' +
      '<div class="pitch-section-head">' +
      '<h2>Live examples for ' +
      esc(ctx.companyName || 'your brand') +
      '</h2>' +
      liveLink +
      '</div>' +
      (noteBits.length ? '<ul class="pitch-presenter-notes">' + noteBits.join('') + '</ul>' : '') +
      '<div class="pitch-preview-stage">' +
      '<div class="sponsor-pitch-preview-tabs" id="custom-pitch-preview-tabs" role="tablist">' +
      tabBits.join('') +
      '</div>' +
      panelBits.join('') +
      '</div></section>'
    );
  }

  function bindTabs(root) {
    if (!root) return;
    var wrap = root.querySelector('#custom-pitch-preview-tabs');
    if (!wrap) return;
    var tabs = wrap.querySelectorAll('[data-custom-pitch-preview]');
    var panels = root.querySelectorAll('[data-custom-pitch-preview-panel]');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var key = tab.getAttribute('data-custom-pitch-preview');
        tabs.forEach(function (t) {
          var on = t === tab;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        panels.forEach(function (panel) {
          panel.hidden = panel.getAttribute('data-custom-pitch-preview-panel') !== key;
        });
      });
    });
  }

  global.CustomPitchPreviews = {
    deckHasOpportunityVisuals: deckHasOpportunityVisuals,
    renderLiveExamplesSection: renderLiveExamplesSection,
    bindTabs: bindTabs,
  };
})(window);
