/**
 * Command Center — social post composer (draft, copy, open share links).
 */
(function (global) {
  var POST_TYPES = {
    opportunity_new: {
      label: 'New business opportunity',
      source: 'opportunity',
      recentDays: 14,
      styles: [
        {
          id: 'announce',
          label: 'New listing announce',
          caption:
            '🆕 New on Business Opps — {{title}}\n\n{{description}}\n\nBrowse and enquire free: {{url}}',
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
      styles: [
        {
          id: 'premium',
          label: 'Premium spotlight',
          caption:
            '⭐ Featured on Business Opps — {{title}}\n\n{{description}}\n\nExplore now: {{url}}',
          image: 'listing',
        },
        {
          id: 'carousel',
          label: 'Carousel-friendly',
          caption: '{{title}} — now in the spotlight on The Networker Hub.\n\nSwipe-worthy opportunity 👇\n{{url}}',
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
    organiser_ranking: {
      label: 'Group ranking badge',
      source: 'organiser',
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
            'Find your next networking event on The Networker Hub — meetings, exhibitions, awards and more across the UK.\n\nBrowse free: {{url}}',
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
            'Browse franchises, side hustles, partnerships and more on Business Opps — free on The Networker Hub.\n\n{{url}}',
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
            'Find your next networking event, training session, or business opportunity on The Networker Hub — free to browse.\n\n{{url}}',
          image: 'hub',
        },
        {
          id: 'three_things',
          label: 'Events · Training · Opps',
          caption:
            'The Networker Hub — your place for UK networking events, training workshops, and business opportunities.\n\nStart here: {{url}}',
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
    hub: { label: 'Networker Hub logo' },
    none: { label: 'No image' },
  };

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
    return origin || 'https://the-networker.co.uk';
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
    if (org && org.slug) return siteOrigin() + '/organiser/' + encodeURIComponent(org.slug);
    if (org && org.id) return siteOrigin() + '/events/organiser.html?id=' + encodeURIComponent(org.id);
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
      var platform = row[0];
      var url = String(row[1] || '').trim();
      var label = row[2];
      if (!url) return;
      var mention = mentionFromUrl(url, platform);
      items.push({
        platform: label,
        url: url,
        mention: mention,
        line: mention ? mention + ' (' + label + ')' : url,
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
    if (choice === 'hub') return hubLogoUrl();
    if (choice === 'organiser') {
      return (context.organiser && context.organiser.photo_url) || context.organiserPhoto || hubLogoUrl();
    }
    if (choice === 'logo') {
      return context.logoUrl || context.listingImage || hubLogoUrl();
    }
    return context.listingImage || context.logoUrl || hubLogoUrl();
  }

  function render(main, deps) {
    deps = deps || {};
    var esc = deps.esc || function (s) {
      return String(s || '');
    };
    var attrEsc = deps.attrEsc || esc;
    var adminGet = deps.adminGet;

    if (!main || !adminGet) return;

    var state = {
      postTypeKey: 'opportunity_new',
      styleId: '',
      imageOverride: 'auto',
      opportunities: [],
      featuredOpportunities: [],
      events: [],
      organisers: [],
      selectedOpportunityId: '',
      selectedEventId: '',
      selectedOrganiserId: '',
      linkedOrganiser: null,
      pageUrl: '',
    };

    main.innerHTML =
      '<div class="space-y-6 max-w-4xl">' +
      '<p class="text-sm text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">Draft social posts from live Hub listings. Pick a post type and caption style, tweak the image if needed, then copy or open a share link for Meta Business Suite, LinkedIn, or X.</p>' +
      '<div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">' +
      '<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">' +
      '<div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Post type</label>' +
      '<select id="social-template" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">' +
      Object.keys(POST_TYPES)
        .map(function (key) {
          return (
            '<option value="' +
            attrEsc(key) +
            '">' +
            esc(POST_TYPES[key].label) +
            '</option>'
          );
        })
        .join('') +
      '</select></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Caption style</label>' +
      '<select id="social-style" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"></select></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Image</label>' +
      '<select id="social-image-choice" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">' +
      Object.keys(IMAGE_OPTIONS)
        .map(function (key) {
          return (
            '<option value="' +
            attrEsc(key) +
            '">' +
            esc(IMAGE_OPTIONS[key].label) +
            '</option>'
          );
        })
        .join('') +
      '</select></div>' +
      '</div>' +
      '<div id="social-source-wrap"><label class="block text-xs font-semibold text-slate-500 uppercase mb-1" id="social-source-label">Listing</label>' +
      '<select id="social-source" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">Loading…</option></select></div>' +
      '<div id="social-recent" class="hidden text-xs text-slate-600"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Caption</label>' +
      '<textarea id="social-caption" rows="8" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed"></textarea>' +
      '<p class="text-[11px] text-slate-500 mt-1">Edit freely — changing style or image resets from the template unless you edit after.</p></div>' +
      '<div id="social-tags" class="hidden rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950"></div>' +
      '<div class="flex flex-wrap items-start gap-4">' +
      '<div id="social-image-wrap" class="hidden shrink-0 w-32 h-32 rounded-lg border border-slate-200 overflow-hidden bg-slate-100">' +
      '<img id="social-image" alt="" class="w-full h-full object-cover" /></div>' +
      '<div class="min-w-0 flex-1 space-y-2">' +
      '<p class="text-xs text-slate-500">Link in post · <span id="social-image-label" class="text-slate-400"></span></p>' +
      '<p id="social-url" class="text-sm font-mono text-brand-800 break-all">—</p>' +
      '<div class="flex flex-wrap gap-2 pt-1">' +
      '<button type="button" id="social-copy-caption" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Copy caption</button>' +
      '<button type="button" id="social-copy-url" class="rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold px-4 py-2 hover:bg-slate-50">Copy link</button>' +
      '<button type="button" id="social-copy-image" class="rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold px-4 py-2 hover:bg-slate-50">Copy image URL</button>' +
      '<a id="social-share-linkedin" class="rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold px-4 py-2 hover:bg-slate-50" target="_blank" rel="noopener noreferrer">Open LinkedIn</a>' +
      '<a id="social-share-facebook" class="rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold px-4 py-2 hover:bg-slate-50" target="_blank" rel="noopener noreferrer">Open Facebook</a>' +
      '<a id="social-share-twitter" class="rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold px-4 py-2 hover:bg-slate-50" target="_blank" rel="noopener noreferrer">Open X</a>' +
      '</div></div></div>' +
      '</div></div>';

    var templateEl = main.querySelector('#social-template');
    var styleEl = main.querySelector('#social-style');
    var imageChoiceEl = main.querySelector('#social-image-choice');
    var sourceEl = main.querySelector('#social-source');
    var sourceLabelEl = main.querySelector('#social-source-label');
    var sourceWrapEl = main.querySelector('#social-source-wrap');
    var captionEl = main.querySelector('#social-caption');
    var tagsEl = main.querySelector('#social-tags');
    var urlEl = main.querySelector('#social-url');
    var imageWrap = main.querySelector('#social-image-wrap');
    var imageEl = main.querySelector('#social-image');
    var imageLabelEl = main.querySelector('#social-image-label');
    var recentEl = main.querySelector('#social-recent');

    function currentStyle() {
      var cfg = postTypeConfig(state.postTypeKey);
      var styles = cfg.styles || [];
      var found = styles.find(function (s) {
        return s.id === state.styleId;
      });
      return found || styles[0] || { caption: '', image: 'listing' };
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
      } else {
        imageWrap.classList.add('hidden');
        imageEl.removeAttribute('src');
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
        '<p class="text-xs text-amber-900/80 mb-2">Insert into your caption — organisers add URLs on their group profile.</p>' +
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
              '">Insert</button>' +
              '</li>'
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
          return (
            '<option value="' +
            attrEsc(s.id) +
            '">' +
            esc(s.label) +
            '</option>'
          );
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
      var desc = trimText(opp.description, 140);
      var caption = applyTemplate(style.caption, {
        title: opp.title || 'Business opportunity',
        description: desc || 'Explore this opportunity on The Networker Hub.',
        url: opportunityPublicUrl(opp.id),
      });
      applyBuild(
        caption,
        opportunityPublicUrl(opp.id),
        {
          listingImage: opp.image_url || '',
          logoUrl: opp.logo_url || opp.image_url || '',
        },
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
        {
          listingImage: ev.photo_url || '',
          logoUrl: ev.photo_url || '',
          organiserPhoto: state.linkedOrganiser && state.linkedOrganiser.photo_url,
        },
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

    function rebuildCaption() {
      var cfg = postTypeConfig(state.postTypeKey);
      if (cfg.source === 'none') {
        if (state.postTypeKey === 'hub_events') buildHubOnly(hubEventsUrl(), { url: hubEventsUrl() });
        else if (state.postTypeKey === 'hub_opportunities') buildHubOnly(hubOpportunitiesUrl(), { url: hubOpportunitiesUrl() });
        else buildHubOnly(hubHomeUrl(), { url: hubHomeUrl() });
        return;
      }
      if (cfg.source === 'opportunity' || cfg.source === 'opportunity_featured') {
        var list = cfg.source === 'opportunity_featured' ? state.featuredOpportunities : state.opportunities;
        var opp = list.find(function (o) {
          return o.id === state.selectedOpportunityId;
        });
        buildFromOpportunity(opp);
        return;
      }
      if (cfg.source === 'event') {
        var ev = state.events.find(function (e) {
          return e.id === state.selectedEventId;
        });
        buildFromEvent(ev);
        return;
      }
      if (cfg.source === 'organiser') {
        var org = state.organisers.find(function (o) {
          return o.id === state.selectedOrganiserId;
        });
        buildFromOrganiser(org);
      }
    }

    function fillSourceOptions() {
      var cfg = postTypeConfig(state.postTypeKey);
      fillStyleOptions();

      if (cfg.source === 'none') {
        sourceWrapEl.classList.add('hidden');
        recentEl.classList.add('hidden');
        rebuildCaption();
        return;
      }
      sourceWrapEl.classList.remove('hidden');

      if (cfg.source === 'opportunity' || cfg.source === 'opportunity_featured') {
        sourceLabelEl.textContent =
          cfg.source === 'opportunity_featured' ? 'Featured opportunity' : 'Business opportunity';
        var opps = cfg.source === 'opportunity_featured' ? state.featuredOpportunities : state.opportunities;
        sourceEl.innerHTML =
          '<option value="">Choose a listing…</option>' +
          opps
            .map(function (o) {
              return (
                '<option value="' +
                attrEsc(o.id) +
                '">' +
                esc(o.title || 'Untitled') +
                (o.published_at ? ' · ' + esc(String(o.published_at).slice(0, 10)) : '') +
                '</option>'
              );
            })
            .join('');
        if (!state.selectedOpportunityId && opps[0]) state.selectedOpportunityId = opps[0].id;
        if (opps.length && !opps.some(function (o) { return o.id === state.selectedOpportunityId; })) {
          state.selectedOpportunityId = opps[0].id;
        }
        sourceEl.value = state.selectedOpportunityId || '';

        if (cfg.source === 'opportunity' && cfg.recentDays) {
          var recent = opps.filter(function (o) {
            if (!o.published_at) return false;
            var t = new Date(o.published_at).getTime();
            return t && Date.now() - t < cfg.recentDays * 24 * 60 * 60 * 1000;
          });
          if (recent.length) {
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
                state.selectedOpportunityId = btn.getAttribute('data-id') || '';
                sourceEl.value = state.selectedOpportunityId;
                rebuildCaption();
              });
            });
          } else {
            recentEl.classList.add('hidden');
          }
        } else {
          recentEl.classList.add('hidden');
        }
      } else if (cfg.source === 'event') {
        sourceLabelEl.textContent = 'Event';
        var events = state.events;
        sourceEl.innerHTML =
          '<option value="">Choose an event…</option>' +
          events
            .map(function (e) {
              return (
                '<option value="' +
                attrEsc(e.id) +
                '">' +
                esc(e.title || 'Untitled') +
                (e.starts_at ? ' · ' + esc(formatEventDate(e.starts_at)) : '') +
                '</option>'
              );
            })
            .join('');
        if (!state.selectedEventId && events[0]) state.selectedEventId = events[0].id;
        if (events.length && !events.some(function (e) { return e.id === state.selectedEventId; })) {
          state.selectedEventId = events[0].id;
        }
        sourceEl.value = state.selectedEventId || '';
        recentEl.classList.add('hidden');
      } else if (cfg.source === 'organiser') {
        sourceLabelEl.textContent = 'Group profile';
        var orgs = state.organisers;
        sourceEl.innerHTML =
          '<option value="">Choose a group…</option>' +
          orgs
            .map(function (o) {
              return (
                '<option value="' +
                attrEsc(o.id) +
                '">' +
                esc(o.name || 'Untitled') +
                '</option>'
              );
            })
            .join('');
        if (!state.selectedOrganiserId && orgs[0]) state.selectedOrganiserId = orgs[0].id;
        if (orgs.length && !orgs.some(function (o) { return o.id === state.selectedOrganiserId; })) {
          state.selectedOrganiserId = orgs[0].id;
        }
        sourceEl.value = state.selectedOrganiserId || '';
        recentEl.classList.add('hidden');
      }
      rebuildCaption();
    }

    templateEl.addEventListener('change', function () {
      state.postTypeKey = templateEl.value;
      state.styleId = '';
      state.imageOverride = 'auto';
      imageChoiceEl.value = 'auto';
      fillSourceOptions();
    });

    styleEl.addEventListener('change', function () {
      state.styleId = styleEl.value;
      rebuildCaption();
    });

    imageChoiceEl.addEventListener('change', function () {
      state.imageOverride = imageChoiceEl.value;
      rebuildCaption();
    });

    sourceEl.addEventListener('change', function () {
      var cfg = postTypeConfig(state.postTypeKey);
      var val = sourceEl.value;
      if (cfg.source === 'opportunity' || cfg.source === 'opportunity_featured') state.selectedOpportunityId = val;
      else if (cfg.source === 'event') state.selectedEventId = val;
      else if (cfg.source === 'organiser') state.selectedOrganiserId = val;
      rebuildCaption();
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

    Promise.all([
      adminGet(
        '/api/admin/opportunities?status=published&approval_status=Approved&sort=published&limit=40'
      ),
      adminGet(
        '/api/admin/opportunities?status=published&approval_status=Approved&featured=1&sort=published&limit=20'
      ),
      adminGet('/api/admin/events?sort=date&status=published&approval_status=Approved&limit=40'),
      adminGet('/api/admin/organisers?limit=80'),
    ])
      .then(function (results) {
        state.opportunities = (results[0] && results[0].opportunities) || [];
        state.featuredOpportunities = (results[1] && results[1].opportunities) || [];
        state.events = (results[2] && results[2].events) || [];
        state.organisers = (results[3] && results[3].organisers) || [];
        fillSourceOptions();
      })
      .catch(function () {
        sourceEl.innerHTML = '<option value="">Could not load listings</option>';
      });
  }

  global.AdminSocialPosts = { render: render };
})(typeof window !== 'undefined' ? window : global);
