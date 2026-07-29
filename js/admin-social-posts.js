/**
 * Command Center — social post composer (draft, copy, open share links).
 */
(function (global) {
  var POST_TYPES = {
    opportunity_new: {
      label: 'New business opportunity',
      source: 'opportunity',
      searchLabel: 'Search business opportunities',
      searchPlaceholder: 'Search by title or host…',
      recentDays: 14,
      styles: [
        {
          id: 'announce',
          label: 'New listing announce',
          caption:
            '🆕 New on Business Opportunities — {{title}}\n\n{{description}}\n\nBrowse and enquire free: {{url}}',
          image: 'listing',
        },
        {
          id: 'spotlight',
          label: 'Spotlight callout',
          caption:
            'Looking for your next move? {{title}} is now live on The Networker Hub.\n\n{{description}}\n\n👉 {{url}}',
          image: 'listing',
        },
        {
          id: 'short',
          label: 'Short & punchy',
          caption: 'New on the Hub: {{title}} — check it out 👇\n{{url}}',
          image: 'logo',
        },
        {
          id: 'question',
          label: 'Engagement question',
          caption:
            'Could {{title}} be your next opportunity?\n\n{{description}}\n\nSee the full listing on The Networker Hub: {{url}}',
          image: 'listing',
        },
      ],
    },
    opportunity_featured: {
      label: 'Featured opportunity',
      source: 'opportunity_featured',
      searchLabel: 'Search featured opportunities',
      searchPlaceholder: 'Search featured listings…',
      styles: [
        {
          id: 'premium',
          label: 'Premium spotlight',
          caption:
            '⭐ Featured on Business Opportunities — {{title}}\n\n{{description}}\n\nExplore now: {{url}}',
          image: 'listing',
        },
        {
          id: 'carousel',
          label: 'Carousel-friendly',
          caption:
            '{{title}} — now in the spotlight on The Networker Hub.\n\nSwipe-worthy opportunity 👇\n{{url}}',
          image: 'listing',
        },
        {
          id: 'logo_card',
          label: 'Logo card style',
          caption: 'Spotlight listing: {{title}}\n\n{{url}}',
          image: 'logo',
        },
      ],
    },
    event_spotlight: {
      label: 'Event spotlight',
      source: 'event',
      searchLabel: 'Search live events',
      searchPlaceholder: 'Search by title or city…',
      styles: [
        {
          id: 'upcoming',
          label: 'Coming up',
          caption:
            '📅 Coming up on The Networker Hub — {{title}}\n\n{{date_line}} · {{location}}\n\n{{host_line}}Book your place: {{url}}',
          image: 'listing',
        },
        {
          id: 'book_now',
          label: 'Book now',
          caption:
            'Don\'t miss {{title}} — {{date_line}} in {{location}}.\n\nSecure your spot on The Networker Hub: {{url}}',
          image: 'listing',
        },
        {
          id: 'last_chance',
          label: 'Last chance',
          caption:
            '⏰ Last chance to book — {{title}}\n\n{{date_line}} · {{location}}\n\nGrab your ticket: {{url}}',
          image: 'listing',
        },
        {
          id: 'meet_host',
          label: 'Meet the host',
          caption:
            'Networking with {{organiser_name}} — {{title}}\n\n{{date_line}} · {{location}}\n\nView event: {{url}}',
          image: 'organiser',
        },
        {
          id: 'minimal',
          label: 'Minimal link post',
          caption: '{{title}} · {{date_line}}\n{{url}}',
          image: 'logo',
        },
      ],
    },
    event_free: {
      label: 'Free event',
      source: 'event',
      searchLabel: 'Search live events',
      searchPlaceholder: 'Search by title or city…',
      styles: [
        {
          id: 'free_entry',
          label: 'Free to attend',
          caption:
            '🎟️ Free networking — {{title}}\n\n{{date_line}} · {{location}}\n\nRegister on The Networker Hub: {{url}}',
          image: 'listing',
        },
        {
          id: 'try_networking',
          label: 'Try networking',
          caption:
            'New to networking? {{title}} is free to attend.\n\n{{date_line}} · {{location}}\n\n{{url}}',
          image: 'listing',
        },
      ],
    },
    organiser_spotlight: {
      label: 'Group spotlight',
      source: 'organiser',
      searchLabel: 'Search group profiles',
      searchPlaceholder: 'Search by group name…',
      styles: [
        {
          id: 'discover',
          label: 'Discover the group',
          caption:
            'Discover {{name}} on The Networker Hub — UK networking events and meetings.\n\n{{description}}\n\nView their profile: {{url}}',
          image: 'organiser',
        },
        {
          id: 'community',
          label: 'Community shoutout',
          caption:
            '👋 Shoutout to {{name}} — one of the active networking groups on The Networker Hub.\n\n{{description}}\n\n{{url}}',
          image: 'organiser',
        },
        {
          id: 'events_live',
          label: 'Events now live',
          caption:
            '{{name}} has events live on The Networker Hub right now.\n\nBrowse their upcoming listings: {{url}}',
          image: 'listing',
        },
      ],
    },
    ranking_top10: {
      label: 'Top 10 groups (monthly)',
      source: 'ranking',
      styles: [
        {
          id: 'leaderboard',
          label: 'Leaderboard announce',
          caption:
            '🏆 Top 10 networking groups on The Networker Hub — {{period_label}}\n\n{{ranked_list}}\n\nBrowse events and groups: {{url}}',
          image: 'ranking_card',
        },
        {
          id: 'carousel',
          label: 'Carousel caption',
          caption:
            'Who made the Top 10 this month? 🏆\n\n{{ranked_list_short}}\n\nFull leaderboard on The Networker Hub: {{url}}',
          image: 'ranking_card',
        },
        {
          id: 'congrats',
          label: 'Congratulations all',
          caption:
            'Huge congratulations to our Top 10 networking groups for {{period_label}} 👏\n\n{{ranked_list}}\n\n{{url}}',
          image: 'ranking_card',
        },
      ],
    },
    organiser_ranking: {
      label: 'Single group ranking badge',
      source: 'organiser',
      searchLabel: 'Search ranked group',
      searchPlaceholder: 'Search by group name…',
      styles: [
        {
          id: 'celebrate',
          label: 'Celebrate ranking',
          caption:
            '🏆 {{name}} is ranked on The Networker Hub — recognised for great networking events.\n\nSee their profile: {{url}}',
          image: 'organiser',
        },
        {
          id: 'congrats',
          label: 'Congratulations post',
          caption:
            'Congratulations to {{name}} — a top-rated networking group on The Networker Hub.\n\n{{url}}',
          image: 'organiser',
        },
      ],
    },
    hub_events: {
      label: 'Browse events promo',
      source: 'none',
      styles: [
        {
          id: 'directory',
          label: 'Events directory',
          caption:
            'Find your next networking event on The Networker Hub — meetings, webinars, workshops, exhibitions, awards and more across the UK.\n\nBrowse free: {{url}}',
          image: 'hub',
        },
        {
          id: 'weekend',
          label: 'Weekend planning',
          caption:
            'Planning your week? Discover networking events near you on The Networker Hub.\n\n{{url}}',
          image: 'hub',
        },
      ],
    },
    hub_opportunities: {
      label: 'Browse opportunities promo',
      source: 'none',
      styles: [
        {
          id: 'directory',
          label: 'Opportunities directory',
          caption:
            'Browse franchises, side hustles, partnerships and more on Business Opportunities — free on The Networker Hub.\n\n{{url}}',
          image: 'hub',
        },
        {
          id: 'entrepreneur',
          label: 'For entrepreneurs',
          caption:
            'Building something new? Explore business opportunities on The Networker Hub.\n\n{{url}}',
          image: 'hub',
        },
      ],
    },
    hub_general: {
      label: 'Hub promo',
      source: 'none',
      styles: [
        {
          id: 'welcome',
          label: 'Welcome / intro',
          caption:
            'Find your next networking event or business opportunity on The Networker Hub — free to browse.\n\n{{url}}',
          image: 'hub',
        },
        {
          id: 'three_things',
          label: 'Events · Opportunities',
          caption:
            'The Networker Hub — your place for UK networking events and business opportunities.\n\nStart here: {{url}}',
          image: 'hub',
        },
        {
          id: 'sign_up',
          label: 'Sign up nudge',
          caption:
            'Create a free account on The Networker Hub — book tickets, enquire about opportunities, and save your favourites.\n\n{{url}}',
          image: 'hub',
        },
      ],
    },
  };

  var IMAGE_OPTIONS = {
    auto: { label: 'Auto (from style)' },
    listing: { label: 'Listing / event photo' },
    logo: { label: 'Logo or brand image' },
    organiser: { label: 'Group profile photo' },
    ranking_card: { label: 'Top 10 ranking graphic' },
    hub: { label: 'Networker Hub logo' },
    none: { label: 'No image' },
  };

  var SEARCH_DEBOUNCE_MS = 280;

  function trimText(text, max) {
    var raw = String(text || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!raw) return '';
    if (raw.length <= max) return raw;
    return raw.slice(0, max - 1).trim() + '…';
  }

  function siteOrigin() {
    var origin = String(global.location && global.location.origin ? global.location.origin : '').replace(
      /\/$/,
      ''
    );
    return origin || 'https://www.thenetworkerhub.com';
  }

  function hubLogoUrl() {
    return siteOrigin() + '/assets/logo.png';
  }

  function opportunityPublicUrl(id) {
    return siteOrigin() + '/opportunities/' + encodeURIComponent(id);
  }

  function eventPublicUrl(slug) {
    return siteOrigin() + '/events/' + encodeURIComponent(slug || '');
  }

  function organiserPublicUrl(org) {
    if (org && org.slug) return siteOrigin() + '/organisers/' + encodeURIComponent(org.slug);
    if (org && org.id) return siteOrigin() + '/events/organiser?id=' + encodeURIComponent(org.id);
    return siteOrigin() + '/events/';
  }

  function hubHomeUrl() {
    return siteOrigin() + '/';
  }

  function hubEventsUrl() {
    return siteOrigin() + '/events/';
  }

  function hubOpportunitiesUrl() {
    return siteOrigin() + '/opportunities/';
  }

  function applyTemplate(tpl, vars) {
    var out = tpl;
    Object.keys(vars).forEach(function (key) {
      out = out.split('{{' + key + '}}').join(vars[key] || '');
    });
    return out.replace(/\n{3,}/g, '\n\n').trim();
  }

  function isLiveEvent(ev) {
    if (!ev) return false;
    if (String(ev.approval_status || '').trim() !== 'Approved') return false;
    var status = String(ev.status || 'published').toLowerCase();
    if (['draft', 'unpublished', 'archived', 'cancelled'].indexOf(status) !== -1) return false;
    if (!ev.starts_at) return false;
    return true;
  }

  function isLiveOpportunity(opp) {
    if (!opp) return false;
    if (String(opp.status || '').toLowerCase() !== 'published') return false;
    if (String(opp.approval_status || '').trim() !== 'Approved') return false;
    if (opp.listing_expires_at) {
      return new Date(opp.listing_expires_at).getTime() > Date.now();
    }
    return Boolean(opp.published_at);
  }

  function isBrowsableOpportunity(opp) {
    if (!opp) return false;
    if (String(opp.approval_status || '').trim() === 'Rejected') return false;
    if (String(opp.status || '').toLowerCase() === 'archived') return false;
    return true;
  }

  function sanitizeSearchQuery(q) {
    return String(q || '')
      .replace(/[%_,().]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function opportunityMeta(opp) {
    var parts = [];
    if (isLiveOpportunity(opp)) parts.push('Live on site');
    else if (String(opp.status || '').toLowerCase() === 'published') parts.push('Published');
    else if (opp.status) parts.push(String(opp.status));
    if (opp.approval_status && opp.approval_status !== 'Approved') parts.push(opp.approval_status);
    if (opp.host) parts.push(opp.host);
    if (opp.published_at) parts.push(String(opp.published_at).slice(0, 10));
    return parts.join(' · ');
  }

  function sortOpportunitiesForSocial(rows) {
    return rows.slice().sort(function (a, b) {
      var al = isLiveOpportunity(a) ? 0 : 1;
      var bl = isLiveOpportunity(b) ? 0 : 1;
      if (al !== bl) return al - bl;
      return String(b.published_at || b.updated_at || '').localeCompare(
        String(a.published_at || a.updated_at || '')
      );
    });
  }

  function mapOpportunitySearchRows(rows) {
    return rows.map(function (opp) {
      return {
        id: opp.id,
        title: opp.title || 'Untitled',
        meta: opportunityMeta(opp),
        raw: opp,
      };
    });
  }

  function mentionFromUrl(url, platform) {
    var raw = String(url || '').trim();
    if (!raw) return '';
    try {
      var u = new URL(raw.indexOf('://') === -1 ? 'https://' + raw : raw);
      var parts = u.pathname.split('/').filter(Boolean);
      if (platform === 'instagram') {
        var ig = parts[0] === 'p' || parts[0] === 'reel' ? '' : parts[0];
        return ig ? '@' + ig.replace(/^@/, '') : '';
      }
      if (platform === 'x') {
        var handle = parts[0] || '';
        return handle ? '@' + handle.replace(/^@/, '') : '';
      }
      if (platform === 'facebook') return parts[parts.length - 1] || u.hostname;
      if (platform === 'linkedin') {
        if (parts[0] === 'company' && parts[1]) return parts[1].replace(/-/g, ' ');
        if (parts[0] === 'in' && parts[1]) return '@' + parts[1];
      }
    } catch (e) {
      return '';
    }
    return '';
  }

  function tagSuggestionsFromOrganiser(org) {
    if (!org) return [];
    var items = [];
    var pairs = [
      ['instagram', org.instagram_url, 'Instagram'],
      ['facebook', org.facebook_url, 'Facebook'],
      ['linkedin', org.linkedin_url, 'LinkedIn'],
      ['x', org.x_url, 'X'],
    ];
    pairs.forEach(function (row) {
      var url = String(row[1] || '').trim();
      if (!url) return;
      var mention = mentionFromUrl(url, row[0]);
      items.push({
        platform: row[2],
        url: url,
        mention: mention,
        line: mention ? mention + ' (' + row[2] + ')' : url,
      });
    });
    return items;
  }

  function formatEventDate(startsAt) {
    if (!startsAt) return 'Date TBC';
    try {
      var d = new Date(startsAt);
      if (Number.isNaN(d.getTime())) return 'Date TBC';
      return d.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return 'Date TBC';
    }
  }

  function shareLinks(caption, pageUrl) {
    var text = String(caption || '').trim();
    var url = String(pageUrl || '').trim();
    return {
      linkedIn: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url),
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url),
      twitter:
        'https://twitter.com/intent/tweet?text=' +
        encodeURIComponent(text) +
        (url ? '&url=' + encodeURIComponent(url) : ''),
    };
  }

  function copyText(text, btn) {
    var done = function () {
      if (!btn) return;
      var prev = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(function () {
        btn.textContent = prev;
      }, 1600);
    };
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(text).then(done).catch(function () {
        global.prompt('Copy this text:', text);
        done();
      });
    } else {
      global.prompt('Copy this text:', text);
      done();
    }
  }

  function postTypeConfig(key) {
    return POST_TYPES[key] || POST_TYPES.opportunity_new;
  }

  function resolveImageChoice(styleImage, override, context) {
    var choice = override === 'auto' || !override ? styleImage || 'listing' : override;
    if (choice === 'none') return '';
    if (choice === 'ranking_card') return context.rankingCardUrl || hubLogoUrl();
    if (choice === 'hub') return hubLogoUrl();
    if (choice === 'organiser') {
      return (context.organiser && context.organiser.photo_url) || context.organiserPhoto || hubLogoUrl();
    }
    if (choice === 'logo') {
      return context.logoUrl || context.listingImage || hubLogoUrl();
    }
    return context.listingImage || context.logoUrl || hubLogoUrl();
  }

  function loadImage(url) {
    return new Promise(function (resolve) {
      var src = String(url || '').trim();
      if (!src) {
        resolve(null);
        return;
      }
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = src;
    });
  }

  function drawCircleImage(ctx, img, x, y, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (img) {
      ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
    } else {
      ctx.fillStyle = '#e8e2ec';
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      ctx.fillStyle = '#736b6e';
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', x, y);
    }
    ctx.restore();
  }

  function truncateCanvasText(ctx, text, maxWidth) {
    var value = String(text || '');
    if (ctx.measureText(value).width <= maxWidth) return value;
    while (value.length > 1 && ctx.measureText(value + '…').width > maxWidth) {
      value = value.slice(0, -1);
    }
    return value + '…';
  }

  async function generateRankingCardImage(top10, periodLabel) {
    var width = 1080;
    var rowHeight = 108;
    var headerHeight = 220;
    var footerHeight = 100;
    var height = headerHeight + top10.length * rowHeight + footerHeight;
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');

    var gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1c2040');
    gradient.addColorStop(1, '#2d3561');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 42px Georgia, "DM Serif Display", serif';
    ctx.textAlign = 'center';
    ctx.fillText('Top 10 Networking Groups', width / 2, 72);

    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.font = '500 24px system-ui, sans-serif';
    ctx.fillText(String(periodLabel || ''), width / 2, 118);

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(80, 150, width - 160, 2);

    var logo = await loadImage(hubLogoUrl());
    if (logo) {
      ctx.drawImage(logo, width - 130, 36, 72, 72);
    }

    for (var i = 0; i < top10.length; i++) {
      var row = top10[i];
      var org = row.organisers || {};
      var y = headerHeight + i * rowHeight + 12;
      var cardY = y;
      var cardH = rowHeight - 16;

      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)';
      roundRect(ctx, 56, cardY, width - 112, cardH, 16);
      ctx.fill();

      var rank = Number(row.rank) || i + 1;
      ctx.fillStyle = rank <= 3 ? '#f5c842' : '#ffffff';
      ctx.font = '700 34px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('#' + rank, 84, cardY + cardH / 2 + 4);

      var photoUrl = String(org.photo_url || '').trim();
      var avatar = await loadImage(photoUrl);
      drawCircleImage(ctx, avatar, 168, cardY + cardH / 2, 34);

      ctx.fillStyle = '#ffffff';
      ctx.font = '600 28px system-ui, sans-serif';
      var name = truncateCanvasText(ctx, org.name || 'Networking group', width - 430);
      ctx.fillText(name, 220, cardY + cardH / 2 - 8);

      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.font = '500 22px system-ui, sans-serif';
      var rating = Number(row.rating);
      var ratingLine =
        '★ ' +
        (Number.isFinite(rating) ? rating.toFixed(1) : '—') +
        ' · ' +
        String(row.review_count || 0) +
        ' reviews';
      ctx.fillText(ratingLine, 220, cardY + cardH / 2 + 24);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '500 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('The Networker Hub · thenetworkerhub.com', width / 2, height - 42);

    return canvas.toDataURL('image/png');
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function rankedListText(top10, short) {
    return top10
      .map(function (row) {
        var org = row.organisers || {};
        var name = org.name || 'Networking group';
        var rating = Number(row.rating);
        var stars = Number.isFinite(rating) ? ' ★ ' + rating.toFixed(1) : '';
        if (short) return String(row.rank) + '. ' + name;
        return String(row.rank) + '. ' + name + stars;
      })
      .join('\n');
  }

  function render(main, deps) {
    deps = deps || {};
    var esc = deps.esc || function (s) {
      return String(s || '');
    };
    var attrEsc = deps.attrEsc || esc;
    var adminGet = deps.adminGet;
    var adminPost = deps.adminPost;

    if (!main || !adminGet) return;

    var state = {
      postTypeKey: 'opportunity_new',
      styleId: '',
      imageOverride: 'auto',
      selectedOpportunityId: '',
      selectedEventId: '',
      selectedOrganiserId: '',
      selectedOpportunity: null,
      selectedEvent: null,
      selectedOrganiser: null,
      linkedOrganiser: null,
      pageUrl: '',
      imageUrl: '',
      rankingCardUrl: '',
      rankingSnapshots: [],
      rankingEntries: [],
      selectedSnapshotId: '',
      searchQuery: '',
      searchResults: [],
      searchLoading: false,
      searchTimer: null,
    };

    main.innerHTML =
      '<div class="space-y-6 max-w-4xl">' +
      '<p class="text-sm text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">Draft social posts from live Hub listings. Search for an event or group, pick a caption style, then copy or open a share link. Top 10 posts generate a leaderboard graphic you can download.</p>' +
      '<div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">' +
      '<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">' +
      '<div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Post type</label>' +
      '<select id="social-template" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"></select></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Caption style</label>' +
      '<select id="social-style" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"></select></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Image</label>' +
      '<select id="social-image-choice" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"></select></div>' +
      '</div>' +
      '<div id="social-ranking-period-wrap" class="hidden">' +
      '<label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Ranking month</label>' +
      '<select id="social-ranking-period" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"></select>' +
      '</div>' +
      '<div id="social-source-wrap" class="space-y-2">' +
      '<label class="block text-xs font-semibold text-slate-500 uppercase mb-1" id="social-source-label">Search</label>' +
      '<input type="search" id="social-source-search" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" autocomplete="off" />' +
      '<p id="social-source-status" class="text-xs text-slate-500">Type to search listings…</p>' +
      '<div id="social-source-results" class="max-h-52 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white"></div>' +
      '<div id="social-source-selected" class="hidden rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900"></div>' +
      '</div>' +
      '<div id="social-recent" class="hidden text-xs text-slate-600"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Caption</label>' +
      '<textarea id="social-caption" rows="8" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed"></textarea></div>' +
      '<div id="social-tags" class="hidden rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950"></div>' +
      '<div class="flex flex-wrap items-start gap-4">' +
      '<div id="social-image-wrap" class="hidden shrink-0 max-w-[220px] rounded-lg border border-slate-200 overflow-hidden bg-slate-100">' +
      '<img id="social-image" alt="" class="w-full h-auto block" /></div>' +
      '<div class="min-w-0 flex-1 space-y-2">' +
      '<p class="text-xs text-slate-500">Link in post · <span id="social-image-label" class="text-slate-400"></span></p>' +
      '<p id="social-url" class="text-sm font-mono text-brand-800 break-all">—</p>' +
      '<div class="flex flex-wrap gap-2 pt-1">' +
      '<button type="button" id="social-copy-caption" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Copy caption</button>' +
      '<button type="button" id="social-copy-url" class="rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold px-4 py-2 hover:bg-slate-50">Copy link</button>' +
      '<button type="button" id="social-copy-image" class="rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold px-4 py-2 hover:bg-slate-50">Copy image URL</button>' +
      '<button type="button" id="social-download-image" class="hidden rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold px-4 py-2 hover:bg-slate-50">Download image</button>' +
      '<a id="social-share-linkedin" class="rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold px-4 py-2 hover:bg-slate-50" target="_blank" rel="noopener noreferrer">Open LinkedIn</a>' +
      '<a id="social-share-facebook" class="rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold px-4 py-2 hover:bg-slate-50" target="_blank" rel="noopener noreferrer">Open Facebook</a>' +
      '<a id="social-share-twitter" class="rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold px-4 py-2 hover:bg-slate-50" target="_blank" rel="noopener noreferrer">Open X</a>' +
      '</div></div></div>' +
      '</div></div>';

    var templateEl = main.querySelector('#social-template');
    var styleEl = main.querySelector('#social-style');
    var imageChoiceEl = main.querySelector('#social-image-choice');
    var rankingPeriodWrap = main.querySelector('#social-ranking-period-wrap');
    var rankingPeriodEl = main.querySelector('#social-ranking-period');
    var sourceWrapEl = main.querySelector('#social-source-wrap');
    var sourceLabelEl = main.querySelector('#social-source-label');
    var sourceSearchEl = main.querySelector('#social-source-search');
    var sourceStatusEl = main.querySelector('#social-source-status');
    var sourceResultsEl = main.querySelector('#social-source-results');
    var sourceSelectedEl = main.querySelector('#social-source-selected');
    var captionEl = main.querySelector('#social-caption');
    var tagsEl = main.querySelector('#social-tags');
    var urlEl = main.querySelector('#social-url');
    var imageWrap = main.querySelector('#social-image-wrap');
    var imageEl = main.querySelector('#social-image');
    var imageLabelEl = main.querySelector('#social-image-label');
    var recentEl = main.querySelector('#social-recent');
    var downloadBtn = main.querySelector('#social-download-image');

    templateEl.innerHTML = Object.keys(POST_TYPES)
      .map(function (key) {
        return (
          '<option value="' + attrEsc(key) + '">' + esc(POST_TYPES[key].label) + '</option>'
        );
      })
      .join('');

    imageChoiceEl.innerHTML = Object.keys(IMAGE_OPTIONS)
      .map(function (key) {
        return (
          '<option value="' + attrEsc(key) + '">' + esc(IMAGE_OPTIONS[key].label) + '</option>'
        );
      })
      .join('');

    function currentStyle() {
      var cfg = postTypeConfig(state.postTypeKey);
      var styles = cfg.styles || [];
      return (
        styles.find(function (s) {
          return s.id === state.styleId;
        }) ||
        styles[0] ||
        { caption: '', image: 'listing' }
      );
    }

    function refreshShareLinks() {
      var links = shareLinks(captionEl.value, state.pageUrl);
      main.querySelector('#social-share-linkedin').href = links.linkedIn;
      main.querySelector('#social-share-facebook').href = links.facebook;
      main.querySelector('#social-share-twitter').href = links.twitter;
    }

    function setPreview(imageUrl, pageUrl, imageNote) {
      state.imageUrl = imageUrl || '';
      state.pageUrl = pageUrl || '';
      urlEl.textContent = pageUrl || '—';
      imageLabelEl.textContent = imageNote || '';
      if (imageUrl) {
        imageWrap.classList.remove('hidden');
        imageEl.src = imageUrl;
        downloadBtn.classList.toggle('hidden', !String(imageUrl).startsWith('data:image/'));
      } else {
        imageWrap.classList.add('hidden');
        imageEl.removeAttribute('src');
        downloadBtn.classList.add('hidden');
      }
      refreshShareLinks();
    }

    function renderTags(org) {
      var tags = tagSuggestionsFromOrganiser(org);
      if (!tags.length) {
        tagsEl.classList.add('hidden');
        tagsEl.innerHTML = '';
        return;
      }
      tagsEl.classList.remove('hidden');
      tagsEl.innerHTML =
        '<p class="font-semibold text-amber-900 mb-1">Suggested tags for ' +
        esc(org.name || 'this group') +
        '</p>' +
        '<ul class="space-y-1">' +
        tags
          .map(function (t) {
            return (
              '<li class="flex flex-wrap items-center gap-2">' +
              '<code class="text-xs bg-white/80 px-1.5 py-0.5 rounded">' +
              esc(t.line) +
              '</code>' +
              '<button type="button" class="social-insert-tag text-xs font-semibold text-brand-800 hover:underline" data-tag="' +
              attrEsc(t.mention || t.url) +
              '">Insert</button></li>'
            );
          })
          .join('') +
        '</ul>';
      tagsEl.querySelectorAll('.social-insert-tag').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var tag = btn.getAttribute('data-tag') || '';
          if (!tag) return;
          var cur = captionEl.value.trim();
          captionEl.value = cur ? cur + '\n\n' + tag : tag;
          refreshShareLinks();
        });
      });
    }

    function loadOrganiser(organiserId, fallbackOrg) {
      if (fallbackOrg) {
        state.linkedOrganiser = fallbackOrg;
        renderTags(fallbackOrg);
        return Promise.resolve(fallbackOrg);
      }
      if (!organiserId) {
        state.linkedOrganiser = null;
        renderTags(null);
        return Promise.resolve(null);
      }
      return adminGet('/api/admin/organisers?id=' + encodeURIComponent(organiserId)).then(function (data) {
        var org = data && data.organisers && data.organisers[0] ? data.organisers[0] : null;
        state.linkedOrganiser = org;
        renderTags(org);
        return org;
      });
    }

    function fillStyleOptions() {
      var cfg = postTypeConfig(state.postTypeKey);
      styleEl.innerHTML = (cfg.styles || [])
        .map(function (s) {
          return '<option value="' + attrEsc(s.id) + '">' + esc(s.label) + '</option>';
        })
        .join('');
      if (!state.styleId || !(cfg.styles || []).some(function (s) { return s.id === state.styleId; })) {
        state.styleId = cfg.styles && cfg.styles[0] ? cfg.styles[0].id : '';
      }
      styleEl.value = state.styleId;
    }

    function imageNoteForChoice(choice, style) {
      var effective = choice === 'auto' ? style.image : choice;
      return IMAGE_OPTIONS[effective] ? IMAGE_OPTIONS[effective].label : 'Custom';
    }

    function showSelectedItem(label, meta) {
      if (!label) {
        sourceSelectedEl.classList.add('hidden');
        sourceSelectedEl.textContent = '';
        return;
      }
      sourceSelectedEl.classList.remove('hidden');
      sourceSelectedEl.innerHTML =
        '<span class="font-semibold">Selected:</span> ' + esc(label) + (meta ? ' · ' + esc(meta) : '');
    }

    function paintSearchResults(items, emptyMsg) {
      if (!items.length) {
        sourceResultsEl.innerHTML =
          '<p class="px-3 py-4 text-sm text-slate-500">' + esc(emptyMsg || 'No results') + '</p>';
        return;
      }
      sourceResultsEl.innerHTML = items
        .map(function (item) {
          return (
            '<button type="button" class="social-search-result w-full text-left px-3 py-2.5 hover:bg-slate-50 transition" data-id="' +
            attrEsc(item.id) +
            '">' +
            '<span class="block text-sm font-semibold text-brand-900">' +
            esc(item.title) +
            '</span>' +
            (item.meta
              ? '<span class="block text-xs text-slate-500 mt-0.5">' + esc(item.meta) + '</span>'
              : '') +
            '</button>'
          );
        })
        .join('');
      sourceResultsEl.querySelectorAll('.social-search-result').forEach(function (btn) {
        btn.addEventListener('click', function () {
          selectSearchResult(btn.getAttribute('data-id') || '');
        });
      });
    }

    function searchEndpoint(q) {
      var cfg = postTypeConfig(state.postTypeKey);
      var params = new URLSearchParams();
      params.set('limit', '50');
      var safeQ = sanitizeSearchQuery(q);
      if (safeQ) params.set('q', safeQ);
      if (cfg.source === 'event') {
        params.set('approval_status', 'Approved');
        params.set('sort', 'date');
        return adminGet('/api/admin/events?' + params.toString()).then(function (data) {
          if (data && data.ok === false) throw new Error(data.message || data.error || 'events_failed');
          var events = ((data && data.events) || []).filter(isLiveEvent);
          return events.map(function (ev) {
            return {
              id: ev.id,
              title: ev.title || 'Untitled event',
              meta: [formatEventDate(ev.starts_at), ev.city, ev.organiser_name].filter(Boolean).join(' · '),
              raw: ev,
            };
          });
        });
      }
      if (cfg.source === 'opportunity' || cfg.source === 'opportunity_featured') {
        params.set('sort', 'published');
        if (cfg.source === 'opportunity_featured') params.set('featured', '1');
        return adminGet('/api/admin/opportunities?' + params.toString())
          .then(function (data) {
            if (data && data.ok === false) throw new Error(data.message || data.error || 'opportunities_failed');
            var rows = sortOpportunitiesForSocial(
              ((data && data.opportunities) || []).filter(isBrowsableOpportunity)
            );
            return mapOpportunitySearchRows(rows);
          })
          .catch(function (err) {
            throw err;
          });
      }
      if (cfg.source === 'organiser') {
        return adminGet('/api/admin/organisers?' + params.toString()).then(function (data) {
          return ((data && data.organisers) || []).map(function (org) {
            return {
              id: org.id,
              title: org.name || 'Untitled group',
              meta: org.website || org.email || '',
              raw: org,
            };
          });
        });
      }
      return Promise.resolve([]);
    }

    function selectSearchResult(id) {
      var item = state.searchResults.find(function (row) {
        return row.id === id || String(row.id) === String(id);
      });
      if (!item) return;
      var cfg = postTypeConfig(state.postTypeKey);
      if (cfg.source === 'event') {
        state.selectedEventId = id;
        state.selectedEvent = item.raw;
        showSelectedItem(item.title, item.meta);
      } else if (cfg.source === 'opportunity' || cfg.source === 'opportunity_featured') {
        state.selectedOpportunityId = id;
        state.selectedOpportunity = item.raw;
        showSelectedItem(item.title, item.meta);
      } else if (cfg.source === 'organiser') {
        state.selectedOrganiserId = id;
        state.selectedOrganiser = item.raw;
        showSelectedItem(item.title, item.meta);
      }
      rebuildCaption();
    }

    function runSearch(query) {
      var cfg = postTypeConfig(state.postTypeKey);
      if (cfg.source === 'none' || cfg.source === 'ranking') return;
      state.searchLoading = true;
      sourceStatusEl.textContent = 'Searching…';
      searchEndpoint(query)
        .then(function (items) {
          state.searchResults = items;
          state.searchLoading = false;
          sourceStatusEl.textContent = items.length
            ? items.length + ' result' + (items.length === 1 ? '' : 's')
            : query
              ? 'No matches — try a different search'
              : 'No listings found — add or approve opportunities under Listing cleanup';
          paintSearchResults(items, query ? 'No matches found' : 'No business opportunities in Supabase yet');
          if (!query && items[0] && !getSelectedRaw()) {
            selectSearchResult(items[0].id);
          }
        })
        .catch(function (err) {
          state.searchLoading = false;
          sourceStatusEl.textContent = err && err.message ? err.message : 'Search failed — try again';
          paintSearchResults([], 'Could not load listings');
        });
    }

    function getSelectedRaw() {
      var cfg = postTypeConfig(state.postTypeKey);
      if (cfg.source === 'event') return state.selectedEvent;
      if (cfg.source === 'opportunity' || cfg.source === 'opportunity_featured') return state.selectedOpportunity;
      if (cfg.source === 'organiser') return state.selectedOrganiser;
      return null;
    }

    function scheduleSearch() {
      if (state.searchTimer) clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(function () {
        runSearch(state.searchQuery);
      }, SEARCH_DEBOUNCE_MS);
    }

    function applyBuild(caption, pageUrl, imageContext, organiserId, fallbackOrg) {
      var style = currentStyle();
      var imageUrl = resolveImageChoice(style.image, state.imageOverride, imageContext);
      captionEl.value = caption;
      setPreview(imageUrl, pageUrl, imageNoteForChoice(state.imageOverride, style));
      loadOrganiser(organiserId, fallbackOrg).then(function (org) {
        if (state.imageOverride === 'auto' && style.image === 'organiser' && org) {
          var refreshed = resolveImageChoice(style.image, 'auto', {
            organiser: org,
            organiserPhoto: org.photo_url,
            listingImage: imageContext.listingImage,
            logoUrl: imageContext.logoUrl,
            rankingCardUrl: imageContext.rankingCardUrl,
          });
          if (refreshed && refreshed !== imageUrl) {
            setPreview(refreshed, pageUrl, imageNoteForChoice(state.imageOverride, style));
          }
        }
      });
    }

    function buildFromOpportunity(opp) {
      if (!opp) return;
      var style = currentStyle();
      var caption = applyTemplate(style.caption, {
        title: opp.title || 'Business opportunity',
        description: trimText(opp.description, 140) || 'Explore this opportunity on The Networker Hub.',
        url: opportunityPublicUrl(opp.id),
      });
      applyBuild(
        caption,
        opportunityPublicUrl(opp.id),
        { listingImage: opp.image_url || '', logoUrl: opp.logo_url || opp.image_url || '' },
        opp.organiser_id
      );
    }

    function buildFromEvent(ev) {
      if (!ev) return;
      var style = currentStyle();
      var location = [ev.city, ev.meeting_type].filter(Boolean).join(' · ') || 'UK';
      var hostLine = ev.organiser_name ? 'Hosted by ' + ev.organiser_name + '.\n\n' : '';
      var caption = applyTemplate(style.caption, {
        title: ev.title || 'Event',
        date_line: formatEventDate(ev.starts_at),
        location: location,
        organiser_name: ev.organiser_name || 'the host',
        host_line: hostLine,
        url: eventPublicUrl(ev.slug),
      });
      applyBuild(
        caption,
        eventPublicUrl(ev.slug),
        { listingImage: ev.photo_url || '', logoUrl: ev.photo_url || '' },
        ev.organiser_id
      );
    }

    function buildFromOrganiser(org) {
      if (!org) return;
      var style = currentStyle();
      var caption = applyTemplate(style.caption, {
        name: org.name || 'Networking group',
        description: trimText(org.description, 140) || 'UK networking events and meetings.',
        url: organiserPublicUrl(org),
      });
      applyBuild(
        caption,
        organiserPublicUrl(org),
        {
          listingImage: org.photo_url || '',
          logoUrl: org.photo_url || '',
          organiser: org,
          organiserPhoto: org.photo_url || '',
        },
        null,
        org
      );
    }

    function buildHubOnly(url, captionVars) {
      var style = currentStyle();
      var caption = applyTemplate(style.caption, captionVars || { url: url });
      applyBuild(caption, url, { listingImage: hubLogoUrl(), logoUrl: hubLogoUrl() }, null);
    }

    function top10Entries() {
      return (state.rankingEntries || [])
        .filter(function (row) {
          return Number(row.rank) <= 10;
        })
        .sort(function (a, b) {
          return Number(a.rank) - Number(b.rank);
        });
    }

    function loadRankingSnapshot(snapshotId) {
      var url = '/api/admin/rankings' + (snapshotId ? '?snapshot_id=' + encodeURIComponent(snapshotId) : '');
      return adminGet(url).then(function (data) {
        if (!data || !data.ok) throw new Error((data && data.message) || 'rankings_failed');
        state.rankingEntries = data.entries || [];
        if (data.snapshot) state.selectedSnapshotId = data.snapshot.id;
        if (data.snapshots && data.snapshots.length) state.rankingSnapshots = data.snapshots;
        return data;
      });
    }

    function paintRankingPeriodOptions() {
      var snaps = state.rankingSnapshots || [];
      if (!snaps.length) {
        rankingPeriodEl.innerHTML = '<option value="">No snapshots yet</option>';
        return;
      }
      rankingPeriodEl.innerHTML = snaps
        .map(function (snap) {
          return (
            '<option value="' +
            attrEsc(snap.id) +
            '">' +
            esc(snap.period_label || snap.period_key || 'Period') +
            ' · ' +
            esc(String(snap.total_ranked || 0)) +
            ' groups</option>'
          );
        })
        .join('');
      rankingPeriodEl.value = state.selectedSnapshotId || snaps[0].id;
    }

    function buildFromRanking() {
      var top10 = top10Entries();
      if (!top10.length) {
        captionEl.value = 'No Top 10 ranking snapshot found yet. Run a snapshot under Group rankings first.';
        setPreview('', hubEventsUrl(), 'No ranking data');
        state.rankingCardUrl = '';
        return;
      }
      var snap = (state.rankingSnapshots || []).find(function (s) {
        return s.id === state.selectedSnapshotId;
      });
      var periodLabel = (snap && snap.period_label) || 'this month';
      var style = currentStyle();
      var listFull = rankedListText(top10, false);
      var listShort = rankedListText(top10.slice(0, 5), true) + (top10.length > 5 ? '\n…see full list on the Hub' : '');
      var caption = applyTemplate(style.caption, {
        period_label: periodLabel,
        ranked_list: listFull,
        ranked_list_short: listShort,
        url: hubEventsUrl(),
      });
      captionEl.value = caption;
      setPreview(hubLogoUrl(), hubEventsUrl(), 'Generating ranking graphic…');
      renderTags(null);
      generateRankingCardImage(top10, periodLabel)
        .then(function (dataUrl) {
          state.rankingCardUrl = dataUrl;
          var imageUrl = resolveImageChoice(style.image, state.imageOverride, {
            rankingCardUrl: dataUrl,
            listingImage: dataUrl,
          });
          setPreview(imageUrl, hubEventsUrl(), imageNoteForChoice(state.imageOverride, style));
        })
        .catch(function () {
          state.rankingCardUrl = '';
          setPreview(hubLogoUrl(), hubEventsUrl(), 'Could not generate ranking graphic');
        });
    }

    function rebuildCaption() {
      var cfg = postTypeConfig(state.postTypeKey);
      if (cfg.source === 'ranking') {
        buildFromRanking();
        return;
      }
      if (cfg.source === 'none') {
        if (state.postTypeKey === 'hub_events') buildHubOnly(hubEventsUrl(), { url: hubEventsUrl() });
        else if (state.postTypeKey === 'hub_opportunities') buildHubOnly(hubOpportunitiesUrl(), { url: hubOpportunitiesUrl() });
        else buildHubOnly(hubHomeUrl(), { url: hubHomeUrl() });
        return;
      }
      if (cfg.source === 'opportunity' || cfg.source === 'opportunity_featured') {
        buildFromOpportunity(state.selectedOpportunity);
        return;
      }
      if (cfg.source === 'event') {
        buildFromEvent(state.selectedEvent);
        return;
      }
      if (cfg.source === 'organiser') {
        buildFromOrganiser(state.selectedOrganiser);
      }
    }

    function paintRecentOpportunities() {
      var cfg = postTypeConfig(state.postTypeKey);
      if (cfg.source !== 'opportunity' || !cfg.recentDays) {
        recentEl.classList.add('hidden');
        return;
      }
      adminGet('/api/admin/opportunities?sort=published&limit=50').then(function (data) {
        var opps = sortOpportunitiesForSocial(
          ((data && data.opportunities) || []).filter(isBrowsableOpportunity)
        );
        var recent = opps.filter(function (o) {
          if (!isLiveOpportunity(o) || !o.published_at) return false;
          var t = new Date(o.published_at).getTime();
          return t && Date.now() - t < cfg.recentDays * 24 * 60 * 60 * 1000;
        });
        if (!recent.length) {
          recentEl.classList.add('hidden');
          return;
        }
        recentEl.classList.remove('hidden');
        recentEl.innerHTML =
          '<span class="font-semibold text-slate-700">New this fortnight:</span> ' +
          recent
            .slice(0, 6)
            .map(function (o) {
              return (
                '<button type="button" class="social-quick-opp font-semibold text-brand-800 hover:underline" data-id="' +
                attrEsc(o.id) +
                '">' +
                esc(o.title || 'Listing') +
                '</button>'
              );
            })
            .join(' · ');
        recentEl.querySelectorAll('.social-quick-opp').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-id') || '';
            var item = recent.find(function (o) { return o.id === id; });
            if (!item) return;
            state.selectedOpportunityId = id;
            state.selectedOpportunity = item;
            showSelectedItem(item.title, item.host || '');
            rebuildCaption();
          });
        });
      });
    }

    function configureSourceUi() {
      var cfg = postTypeConfig(state.postTypeKey);
      fillStyleOptions();

      if (cfg.source === 'ranking') {
        sourceWrapEl.classList.add('hidden');
        recentEl.classList.add('hidden');
        rankingPeriodWrap.classList.remove('hidden');
        paintRankingPeriodOptions();
        if (state.rankingEntries.length) rebuildCaption();
        else {
          loadRankingSnapshot(state.selectedSnapshotId).then(function () {
            paintRankingPeriodOptions();
            rebuildCaption();
          });
        }
        return;
      }

      rankingPeriodWrap.classList.add('hidden');

      if (cfg.source === 'none') {
        sourceWrapEl.classList.add('hidden');
        recentEl.classList.add('hidden');
        rebuildCaption();
        return;
      }

      sourceWrapEl.classList.remove('hidden');
      sourceLabelEl.textContent = cfg.searchLabel || 'Search listings';
      sourceSearchEl.placeholder = cfg.searchPlaceholder || 'Search…';
      state.searchQuery = '';
      sourceSearchEl.value = '';
      state.selectedEvent = null;
      state.selectedOpportunity = null;
      state.selectedOrganiser = null;
      state.selectedEventId = '';
      state.selectedOpportunityId = '';
      state.selectedOrganiserId = '';
      showSelectedItem('', '');
      paintRecentOpportunities();
      runSearch('');
    }

    templateEl.addEventListener('change', function () {
      state.postTypeKey = templateEl.value;
      state.styleId = '';
      state.imageOverride = 'auto';
      imageChoiceEl.value = 'auto';
      configureSourceUi();
    });

    styleEl.addEventListener('change', function () {
      state.styleId = styleEl.value;
      rebuildCaption();
    });

    imageChoiceEl.addEventListener('change', function () {
      state.imageOverride = imageChoiceEl.value;
      rebuildCaption();
    });

    rankingPeriodEl.addEventListener('change', function () {
      state.selectedSnapshotId = rankingPeriodEl.value;
      loadRankingSnapshot(state.selectedSnapshotId).then(function () {
        rebuildCaption();
      });
    });

    sourceSearchEl.addEventListener('input', function () {
      state.searchQuery = sourceSearchEl.value.trim();
      scheduleSearch();
    });

    captionEl.addEventListener('input', refreshShareLinks);

    main.querySelector('#social-copy-caption').addEventListener('click', function () {
      copyText(captionEl.value, main.querySelector('#social-copy-caption'));
    });
    main.querySelector('#social-copy-url').addEventListener('click', function () {
      copyText(state.pageUrl, main.querySelector('#social-copy-url'));
    });
    main.querySelector('#social-copy-image').addEventListener('click', function () {
      copyText(state.imageUrl || '', main.querySelector('#social-copy-image'));
    });
    downloadBtn.addEventListener('click', function () {
      if (!state.imageUrl || !String(state.imageUrl).startsWith('data:image/')) return;
      var link = document.createElement('a');
      link.href = state.imageUrl;
      link.download = 'networker-top10-' + (state.selectedSnapshotId || 'ranking') + '.png';
      link.click();
    });

    adminGet('/api/admin/rankings')
      .then(function (data) {
        if (data && data.ok) {
          state.rankingSnapshots = data.snapshots || [];
          state.rankingEntries = data.entries || [];
          if (data.snapshot) state.selectedSnapshotId = data.snapshot.id;
        }
      })
      .finally(function () {
        configureSourceUi();
      });
  }

  global.AdminSocialPosts = {
    render: render,
    generateRankingCardImage: generateRankingCardImage,
    rankedListText: rankedListText,
  };
})(typeof window !== 'undefined' ? window : global);
