/**
 * Organiser LinkedIn post image builder — square post graphic + caption.
 * Gallery of all templates; personalise logo/name; preview; download PNG + copy caption.
 */
(function (global) {
  var W = 1200;
  var H = 1200;

  var TEMPLATES = [
    {
      id: 'events',
      label: 'Room full of referrals',
      group: 'events',
      groupLabel: 'Events & group',
      accent: '#9a7aa8',
      kicker: 'NETWORKING EVENT',
      line1: 'A room full',
      line2: 'of warm referrals',
      line3: 'Meet local business owners ready to swap introductions',
      caption:
        "Our next networking event is built around warm conversations, useful introductions, and people who actually follow up.\n\n{name}\nFind us on The Networker Hub -> {url}",
    },
    {
      id: 'meet',
      label: 'Coffee before inboxes',
      group: 'events',
      groupLabel: 'Events & group',
      accent: '#4a4446',
      kicker: 'REAL CONNECTIONS',
      line1: 'Coffee first',
      line2: 'inbox later',
      line3: 'Meet the people behind the profiles before the follow-up',
      caption:
        'Swap the cold message for a warm conversation. Come and meet the people behind the profiles at our next event.\n\n{name}\nOn The Networker Hub -> {url}',
    },
    {
      id: 'guest',
      label: 'Bring a business friend',
      group: 'events',
      groupLabel: 'Events & group',
      accent: '#c299d1',
      kicker: 'GUEST INVITE',
      line1: 'Bring a business',
      line2: 'friend along',
      line3: 'Guest visits are welcome for curious connectors',
      caption:
        'Know someone who would enjoy a room of useful business conversations? Guest visits are welcome at our next meeting.\n\n{name}\nDetails on The Networker Hub -> {url}',
    },
    {
      id: 'book',
      label: 'Seat at the table',
      group: 'events',
      groupLabel: 'Events & group',
      accent: '#b8956a',
      kicker: 'TICKETS OPEN',
      line1: 'Save your seat',
      line2: 'at the table',
      line3: 'Tickets are open for people ready to make useful connections',
      caption:
        'Tickets are open for our next event. Save your seat, bring your best intro, and leave with conversations worth continuing.\n\n{name}\nBook via The Networker Hub -> {url}',
    },
    {
      id: 'opportunity',
      label: 'Business opportunity',
      group: 'opportunities',
      groupLabel: 'Business opportunities',
      theme: 'opportunity',
      accent: '#c9961f',
      kicker: 'BUSINESS OPPORTUNITY',
      line1: 'A business opportunity',
      line2: 'worth a conversation',
      line3: 'Franchise, partnership, or side-hustle — enquire to learn more',
      caption:
        "There's a business opportunity open that may be worth a conversation — franchise, partnership, or side-hustle.\n\n{listing}\nEnquire on The Networker Hub → {url}",
    },
    {
      id: 'partnership',
      label: 'Looking for partners',
      group: 'opportunities',
      groupLabel: 'Business opportunities',
      theme: 'opportunity',
      accent: '#e8b84b',
      kicker: 'PARTNERSHIP',
      line1: 'Looking for the',
      line2: 'right partners',
      line3: 'Serious enquiries welcome from aligned founders',
      caption:
        "We're looking for the right partners. Serious enquiries welcome from aligned founders and operators.\n\n{listing}\nOn The Networker Hub → {url}",
    },
    {
      id: 'franchise',
      label: 'Franchise opportunity',
      group: 'opportunities',
      groupLabel: 'Business opportunities',
      theme: 'opportunity',
      accent: '#c9961f',
      kicker: 'FRANCHISE',
      line1: 'Franchise opportunity',
      line2: 'now open to enquire',
      line3: 'Explore territory, investment, and next steps',
      caption:
        'Franchise opportunity now open to enquire — explore territory, investment, and next steps.\n\n{listing}\nOn The Networker Hub → {url}',
    },
    {
      id: 'enquire',
      label: 'Enquire to learn more',
      group: 'opportunities',
      groupLabel: 'Business opportunities',
      theme: 'opportunity',
      accent: '#e8b84b',
      kicker: 'ENQUIRE',
      line1: 'Curious?',
      line2: 'Enquire to learn more',
      line3: 'Send a short note — we will share what matters',
      caption:
        'Curious? Enquire to learn more — send a short note and we will share the details that matter.\n\n{listing}\nOn The Networker Hub → {url}',
    },
    {
      id: 'verified',
      label: 'Verified organiser',
      group: 'badges',
      groupLabel: 'Hub trust badges',
      accent: '#c299d1',
      kicker: 'TRUST MARK',
      line1: 'Verified organiser',
      line2: 'on The Networker Hub',
      line3: 'A small credibility mark for your LinkedIn post',
      hubEmphasis: true,
      caption:
        "We're a verified organiser on The Networker Hub — the UK home for networking events and business opportunities.\n\n{name}\n→ {url}",
    },
    {
      id: 'listed',
      label: 'Listed on the Hub',
      group: 'badges',
      groupLabel: 'Hub trust badges',
      accent: '#9a7aa8',
      kicker: 'DIRECTORY',
      line1: 'Listed on',
      line2: 'The Networker Hub',
      line3: 'UK networking events and business opportunities',
      hubEmphasis: true,
      caption:
        "You'll find us listed on The Networker Hub — UK networking events and business opportunities.\n\n{name}\n→ {url}",
    },
  ];

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function loadImage(src, useCors) {
    return new Promise(function (resolve, reject) {
      if (!src) {
        resolve(null);
        return;
      }
      var img = new Image();
      if (useCors) img.crossOrigin = 'anonymous';
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        reject(new Error('Could not load image'));
      };
      img.src = src;
    });
  }

  function drawContainedImage(ctx, img, x, y, w, h) {
    if (!img) return;
    var scale = Math.min(w / img.width, h / img.height);
    var dw = img.width * scale;
    var dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  function wrapText(ctx, text, maxWidth) {
    var words = String(text || '').split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    var lines = [];
    var current = words[0];
    for (var i = 1; i < words.length; i++) {
      var test = current + ' ' + words[i];
      if (ctx.measureText(test).width <= maxWidth) current = test;
      else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function paintPost(ctx, opts) {
    var tpl = opts.template;
    var name = String(opts.displayName || '').trim();
    var line1 = String(opts.line1 != null ? opts.line1 : tpl.line1).trim();
    var line2 = String(opts.line2 != null ? opts.line2 : tpl.line2).trim();
    var line3 = String(opts.line3 != null ? opts.line3 : tpl.line3).trim();
    var orgLogo = opts.orgLogoImg || null;
    var hubLogo = opts.hubLogoImg || null;
    var isOpp = tpl.theme === 'opportunity' || tpl.group === 'opportunities';
    var quietBrand = Boolean(opts.quietBrand);

    var g = ctx.createLinearGradient(0, 0, W, H);
    if (isOpp) {
      g.addColorStop(0, '#0d1f3c');
      g.addColorStop(0.5, '#162847');
      g.addColorStop(1, '#1a3a5c');
    } else {
      g.addColorStop(0, '#faf6ee');
      g.addColorStop(0.55, '#f5f0e8');
      g.addColorStop(1, '#ebe0f0');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = tpl.accent || (isOpp ? '#c9961f' : '#c299d1');
    ctx.fillRect(0, 0, W, 16);

    if (isOpp) {
      ctx.fillStyle = 'rgba(201,150,31,0.2)';
      ctx.beginPath();
      ctx.arc(1040, 160, 220, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(232,184,75,0.12)';
      ctx.beginPath();
      ctx.arc(180, 1040, 260, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(194,153,209,0.14)';
      ctx.beginPath();
      ctx.arc(1040, 160, 220, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(154,122,168,0.1)';
      ctx.beginPath();
      ctx.arc(180, 1040, 260, 0, Math.PI * 2);
      ctx.fill();
    }

    var kickerColor = isOpp ? '#e8b84b' : '#9a7aa8';
    var titleColor = isOpp ? '#ffffff' : '#4a4446';
    var subColor = isOpp ? '#8d99ae' : '#5c5557';
    var brandText = isOpp ? '#0d1f3c' : '#4a4446';
    var brandHint = isOpp ? '#c9961f' : '#9a7aa8';
    var creditColor = isOpp ? '#8d99ae' : '#5c5557';

    if (!quietBrand) {
      var brandBoxX = 72;
      var brandBoxY = 56;
      var brandBoxW = 1056;
      var brandBoxH = 220;
      ctx.fillStyle = isOpp ? 'rgba(253,246,227,0.94)' : 'rgba(255,255,255,0.72)';
      roundRect(ctx, brandBoxX, brandBoxY, brandBoxW, brandBoxH, 18);
      ctx.fill();

      if (orgLogo) {
        var logoW = 360;
        var logoH = 180;
        var logoX = brandBoxX + 28;
        var logoY = brandBoxY + (brandBoxH - logoH) / 2;
        drawContainedImage(ctx, orgLogo, logoX, logoY, logoW, logoH);
        ctx.fillStyle = brandText;
        ctx.font = '700 40px "DM Serif Display", Georgia, serif';
        var nameLines = wrapText(ctx, name || 'Your group', brandBoxW - logoW - 80);
        var nameY = brandBoxY + (brandBoxH - Math.min(2, nameLines.length) * 46) / 2 + 36;
        for (var n = 0; n < Math.min(2, nameLines.length); n++) {
          ctx.fillText(nameLines[n], logoX + logoW + 32, nameY + n * 46);
        }
      } else {
        ctx.fillStyle = brandText;
        ctx.font = '700 44px "DM Serif Display", Georgia, serif';
        var solo = wrapText(ctx, name || 'Your group name', 980);
        for (var s = 0; s < Math.min(2, solo.length); s++) {
          ctx.fillText(solo[s], brandBoxX + 36, brandBoxY + 72 + s * 50);
        }
        if (!name) {
          ctx.fillStyle = brandHint;
          ctx.font = '400 22px "DM Sans", Arial, Helvetica, sans-serif';
          ctx.fillText('Add your logo for a stronger post', brandBoxX + 36, brandBoxY + 168);
        }
      }
    }

    var textY = quietBrand ? 340 : 500;
    ctx.fillStyle = kickerColor;
    ctx.font = '700 22px "DM Sans", Arial, Helvetica, sans-serif';
    ctx.fillText(String(tpl.kicker || '').toUpperCase(), 72, textY);

    ctx.fillStyle = titleColor;
    ctx.font = '400 72px "DM Serif Display", Georgia, "Times New Roman", serif';
    var h1 = wrapText(ctx, line1.slice(0, 48), 1050);
    var y = textY + 80;
    for (var a = 0; a < Math.min(2, h1.length); a++) {
      ctx.fillText(h1[a], 72, y);
      y += 84;
    }
    var h2 = wrapText(ctx, line2.slice(0, 48), 1050);
    for (var b = 0; b < Math.min(2, h2.length); b++) {
      ctx.fillText(h2[b], 72, y);
      y += 84;
    }

    ctx.fillStyle = subColor;
    ctx.font = '400 28px "DM Sans", Arial, Helvetica, sans-serif';
    var subLines = wrapText(ctx, line3, 1050);
    y += 18;
    for (var i = 0; i < Math.min(3, subLines.length); i++) {
      ctx.fillText(subLines[i], 72, y);
      y += 38;
    }

    var isDarkHub = Boolean(isOpp && hubLogo);
    var creditW = tpl.hubEmphasis ? 210 : isDarkHub ? 200 : 170;
    var creditH = tpl.hubEmphasis ? 56 : isDarkHub ? 200 : 46;
    var cx = W - creditW - 48;
    var cy = H - creditH - (isDarkHub ? 40 : 64);
    if (hubLogo) {
      drawContainedImage(ctx, hubLogo, cx, cy, creditW, creditH);
    }
    if (!isDarkHub) {
      ctx.fillStyle = creditColor;
      ctx.font = '400 18px "DM Sans", Arial, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        tpl.hubEmphasis ? 'The Networker Hub' : 'on The Networker Hub',
        cx + creditW / 2,
        cy + creditH + 26
      );
    }
    ctx.textAlign = 'left';
  }

  function siteOrigin() {
    if (global.location && global.location.origin) return global.location.origin;
    return 'https://www.thenetworkerhub.com';
  }

  function isPublishedOpportunity(o) {
    if (!o) return false;
    var status = String(o.status || '').toLowerCase();
    return status === 'published' || status === 'live';
  }

  function opportunityPublicUrl(o) {
    var origin = siteOrigin();
    if (!o) return origin + '/opportunities/';
    var slug = String(o.slug || '').trim();
    if (slug) return origin + '/opportunities/' + encodeURIComponent(slug);
    if (o.id) return origin + '/opportunities/' + encodeURIComponent(o.id);
    return origin + '/opportunities/';
  }

  function profileUrlForGroup(groupOrId, maybeSlug) {
    var origin = siteOrigin();
    var id = '';
    var slug = '';
    if (groupOrId && typeof groupOrId === 'object') {
      id = String(groupOrId.id || '').trim();
      slug = String(groupOrId.slug || '').trim();
    } else {
      id = String(groupOrId || '').trim();
      slug = String(maybeSlug || '').trim();
    }
    if (slug) return origin + '/organisers/' + encodeURIComponent(slug);
    if (id) return origin + '/events/organiser?id=' + encodeURIComponent(id);
    return origin + '/events';
  }

  function buildCaption(tpl, opts) {
    var o = opts || {};
    var name = o.name || 'Our group';
    var listing = o.listingTitle || name;
    var url = o.url || siteOrigin() + '/events';
    var raw = tpl.caption || '';
    return raw
      .replace(/\{listing\}/g, listing)
      .replace(/\{name\}/g, name)
      .replace(/\{url\}/g, url);
  }

  function initLinkedInPostBuilder(root, options) {
    if (!root) return null;
    var opts = options || {};
    var getGroups =
      typeof opts.getGroups === 'function'
        ? opts.getGroups
        : function () {
            return [];
          };
    var getOpportunities =
      typeof opts.getOpportunities === 'function'
        ? opts.getOpportunities
        : function () {
            return [];
          };

    var state = {
      templateId: TEMPLATES[0].id,
      groupId: '',
      opportunityId: '',
      displayName: '',
      line1: TEMPLATES[0].line1,
      line2: TEMPLATES[0].line2,
      line3: TEMPLATES[0].line3,
      orgLogoUrl: '',
      orgLogoObjectUrl: '',
      hubLogoImg: null,
      hubLogoDarkImg: null,
      orgLogoImg: null,
      rendering: false,
    };

    var groupOrder = ['events', 'opportunities', 'badges'];
    var galleryHtml = groupOrder
      .map(function (gid) {
        var items = TEMPLATES.filter(function (t) {
          return t.group === gid;
        });
        if (!items.length) return '';
        var label = items[0].groupLabel || gid;
        var gateNote =
          gid === 'opportunities'
            ? '<p class="org-post-gallery-gate" id="post-opp-gate" hidden>Publish a live business opportunity listing to unlock these templates. <a href="#business-list">List a listing →</a></p>'
            : '';
        return (
          '<div class="org-post-gallery-group" data-gallery-group="' +
          esc(gid) +
          '">' +
          '<p class="org-post-gallery-group-title">' +
          esc(label) +
          '</p>' +
          gateNote +
          '<div class="org-post-gallery-grid" role="list">' +
          items
            .map(function (t) {
              return (
                '<button type="button" class="org-post-thumb" role="listitem" data-template-id="' +
                esc(t.id) +
                '" data-template-group="' +
                esc(t.group) +
                '" aria-pressed="false">' +
                '<span class="org-post-thumb-canvas-wrap">' +
                '<canvas width="' +
                W +
                '" height="' +
                H +
                '" data-thumb-for="' +
                esc(t.id) +
                '" aria-hidden="true"></canvas>' +
                '</span>' +
                '<span class="org-post-thumb-label">' +
                esc(t.label) +
                '</span>' +
                '</button>'
              );
            })
            .join('') +
          '</div></div>'
        );
      })
      .join('');

    root.innerHTML =
      '<div class="org-post-builder">' +
      '<div class="org-post-gallery" id="post-gallery">' +
      '<p class="org-post-label">Choose a post type</p>' +
      galleryHtml +
      '</div>' +
      '<div class="org-post-workspace">' +
      '<div class="org-post-builder-controls">' +
      '<label class="org-post-field">' +
      '<span class="org-post-label">Organiser page</span>' +
      '<select id="post-group" aria-label="Organiser page"></select>' +
      '</label>' +
      '<label class="org-post-field" id="post-listing-field" hidden>' +
      '<span class="org-post-label">Live listing</span>' +
      '<select id="post-listing" aria-label="Business opportunity listing"></select>' +
      '<span class="org-post-hint">Caption links to this listing on The Networker Hub.</span>' +
      '</label>' +
      '<label class="org-post-field">' +
      '<span class="org-post-label">Display name</span>' +
      '<input type="text" id="post-name" maxlength="60" placeholder="Your group or brand name" />' +
      '</label>' +
      '<label class="org-post-field">' +
      '<span class="org-post-label">Logo</span>' +
      '<input type="file" id="post-logo-file" accept="image/*" />' +
      '<span class="org-post-hint" id="post-logo-hint">Uses your organiser page logo when available. Upload to override.</span>' +
      '</label>' +
      '<label class="org-post-field">' +
      '<span class="org-post-label">Headline line 1</span>' +
      '<input type="text" id="post-line1" maxlength="48" />' +
      '</label>' +
      '<label class="org-post-field">' +
      '<span class="org-post-label">Headline line 2</span>' +
      '<input type="text" id="post-line2" maxlength="48" />' +
      '</label>' +
      '<label class="org-post-field">' +
      '<span class="org-post-label">Supporting line</span>' +
      '<input type="text" id="post-line3" maxlength="90" />' +
      '</label>' +
      '<div class="org-post-actions">' +
      '<button type="button" class="org-btn org-btn-gold" id="post-download">Download image</button>' +
      '<button type="button" class="org-btn org-btn-outline" id="post-copy-caption">Copy caption</button>' +
      '<button type="button" class="org-btn org-btn-outline" id="post-reset">Reset copy</button>' +
      '</div>' +
      '<p class="org-post-status" id="post-status" role="status"></p>' +
      '</div>' +
      '<div class="org-post-preview-wrap">' +
      '<p class="org-post-label">Live preview</p>' +
      '<div class="org-post-preview-frame">' +
      '<canvas id="post-preview-canvas" width="' +
      W +
      '" height="' +
      H +
      '" aria-label="LinkedIn post image preview"></canvas>' +
      '</div>' +
      '<p class="org-post-hint">1200×1200 — upload the PNG with your caption on LinkedIn.</p>' +
      '<div class="org-post-caption-box">' +
      '<p class="org-post-label">Suggested caption</p>' +
      '<pre class="org-post-caption-text" id="post-caption-preview"></pre>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>';

    var elGroup = root.querySelector('#post-group');
    var elListingField = root.querySelector('#post-listing-field');
    var elListing = root.querySelector('#post-listing');
    var elName = root.querySelector('#post-name');
    var elFile = root.querySelector('#post-logo-file');
    var elLogoHint = root.querySelector('#post-logo-hint');
    var elLine1 = root.querySelector('#post-line1');
    var elLine2 = root.querySelector('#post-line2');
    var elLine3 = root.querySelector('#post-line3');
    var elStatus = root.querySelector('#post-status');
    var elCaption = root.querySelector('#post-caption-preview');
    var elOppGate = root.querySelector('#post-opp-gate');
    var canvas = root.querySelector('#post-preview-canvas');
    var ctx = canvas.getContext('2d');

    function currentTemplate() {
      return (
        TEMPLATES.find(function (t) {
          return t.id === state.templateId;
        }) || TEMPLATES[0]
      );
    }

    function isOppTemplate(tpl) {
      tpl = tpl || currentTemplate();
      return tpl.theme === 'opportunity' || tpl.group === 'opportunities';
    }

    function publishedListings() {
      return (getOpportunities() || []).filter(isPublishedOpportunity);
    }

    function hasLiveListings() {
      return publishedListings().length > 0;
    }

    function currentGroup() {
      var groups = getGroups() || [];
      return (
        groups.find(function (x) {
          return String(x.id) === String(state.groupId);
        }) || null
      );
    }

    function currentListing() {
      return (
        publishedListings().find(function (o) {
          return String(o.id) === String(state.opportunityId);
        }) || null
      );
    }

    function setStatus(msg, isError) {
      elStatus.textContent = msg || '';
      elStatus.classList.toggle('is-error', Boolean(isError));
    }

    function captionPayload() {
      var tpl = currentTemplate();
      var group = currentGroup() || { id: state.groupId };
      var listing = currentListing();
      var name = state.displayName || elName.value || 'Our group';
      if (isOppTemplate(tpl) && listing) {
        return {
          name: name,
          listingTitle: listing.title || name,
          url: opportunityPublicUrl(listing),
        };
      }
      return {
        name: name,
        listingTitle: name,
        url: profileUrlForGroup(group),
      };
    }

    function syncOpportunityGate() {
      var unlocked = hasLiveListings();
      if (elOppGate) elOppGate.hidden = unlocked;
      root.querySelectorAll('.org-post-thumb[data-template-group="opportunities"]').forEach(function (btn) {
        btn.disabled = !unlocked;
        btn.classList.toggle('is-locked', !unlocked);
        btn.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
        btn.title = unlocked ? '' : 'Publish a live listing to use this template';
      });
      if (!unlocked && isOppTemplate()) {
        var fallback = TEMPLATES[0];
        state.templateId = fallback.id;
        state.line1 = fallback.line1;
        state.line2 = fallback.line2;
        state.line3 = fallback.line3;
        elLine1.value = state.line1;
        elLine2.value = state.line2;
        elLine3.value = state.line3;
      }
    }

    function syncListingField() {
      var show = isOppTemplate() && hasLiveListings();
      elListingField.hidden = !show;
      if (!show) return;
      var list = publishedListings();
      var prev = state.opportunityId;
      elListing.innerHTML = '';
      list.forEach(function (o, idx) {
        var opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = o.title || 'Untitled listing';
        elListing.appendChild(opt);
        if (!prev && idx === 0) state.opportunityId = o.id;
      });
      if (
        prev &&
        list.some(function (o) {
          return String(o.id) === String(prev);
        })
      ) {
        elListing.value = prev;
        state.opportunityId = prev;
      } else {
        elListing.value = state.opportunityId || (list[0] && list[0].id) || '';
        state.opportunityId = elListing.value;
      }
    }

    function resolveLogoUrl() {
      var listing = isOppTemplate() ? currentListing() : null;
      if (listing && (listing.logoUrl || listing.imageUrl)) {
        return listing.logoUrl || listing.imageUrl;
      }
      var g = currentGroup();
      return (g && g.imageUrl) || state.orgLogoUrl || '';
    }

    function syncThumbSelection() {
      root.querySelectorAll('.org-post-thumb').forEach(function (btn) {
        var on = btn.getAttribute('data-template-id') === state.templateId;
        btn.classList.toggle('is-selected', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    function syncGroupOptions() {
      var groups = getGroups() || [];
      var prev = state.groupId;
      elGroup.innerHTML = '';
      if (!groups.length) {
        var empty = document.createElement('option');
        empty.value = '';
        empty.textContent = 'No organiser page yet — type a name below';
        elGroup.appendChild(empty);
        return;
      }
      groups.forEach(function (g, idx) {
        var opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.name || 'Organiser page';
        elGroup.appendChild(opt);
        if (!prev && idx === 0) state.groupId = g.id;
      });
      if (
        prev &&
        groups.some(function (g) {
          return g.id === prev;
        })
      ) {
        elGroup.value = prev;
        state.groupId = prev;
      } else {
        elGroup.value = state.groupId || groups[0].id;
        state.groupId = elGroup.value;
      }
    }

    function applyGroupToFields(resetCopy) {
      var g = currentGroup();
      if (g) {
        state.displayName = g.name || '';
        elName.value = state.displayName;
        elFile.value = '';
        if (state.orgLogoObjectUrl) {
          try {
            URL.revokeObjectURL(state.orgLogoObjectUrl);
          } catch (e) {
            /* ignore */
          }
          state.orgLogoObjectUrl = '';
        }
      }
      state.orgLogoUrl = resolveLogoUrl();
      if (elLogoHint) {
        elLogoHint.textContent = isOppTemplate()
          ? 'Uses your listing logo when available, otherwise your organiser page logo. Upload to override.'
          : 'Uses your organiser page logo when available. Upload to override.';
      }
      if (resetCopy) {
        var tpl = currentTemplate();
        state.line1 = tpl.line1;
        state.line2 = tpl.line2;
        state.line3 = tpl.line3;
        elLine1.value = state.line1;
        elLine2.value = state.line2;
        elLine3.value = state.line3;
      }
    }

    function updateCaptionPreview() {
      elCaption.textContent = buildCaption(currentTemplate(), captionPayload());
    }

    async function loadAsset(paths) {
      var lastErr = null;
      for (var i = 0; i < paths.length; i++) {
        try {
          return await loadImage(paths[i], true);
        } catch (e) {
          lastErr = e;
        }
      }
      if (lastErr) throw lastErr;
      return null;
    }

    async function ensureHubLogo(tpl) {
      var isOpp = tpl && (tpl.theme === 'opportunity' || tpl.group === 'opportunities');
      if (isOpp) {
        if (state.hubLogoDarkImg) return state.hubLogoDarkImg;
        try {
          state.hubLogoDarkImg = await loadAsset([
            '../assets/logo-hub-dark.png',
            '/assets/logo-hub-dark.png',
          ]);
        } catch (e) {
          state.hubLogoDarkImg = null;
        }
        return state.hubLogoDarkImg || ensureHubLogoLight();
      }
      return ensureHubLogoLight();
    }

    async function ensureHubLogoLight() {
      if (state.hubLogoImg) return state.hubLogoImg;
      try {
        state.hubLogoImg = await loadAsset([
          '../assets/logo-nav-transparent.png',
          '/assets/logo-nav-transparent.png',
        ]);
      } catch (e) {
        state.hubLogoImg = null;
      }
      return state.hubLogoImg;
    }

    async function ensureOrgLogo() {
      if (state.orgLogoObjectUrl) {
        try {
          state.orgLogoImg = await loadImage(state.orgLogoObjectUrl, false);
          setStatus('');
        } catch (e) {
          state.orgLogoImg = null;
          setStatus('Could not read the uploaded logo file. Try a PNG or JPG under 2MB.', true);
        }
        return state.orgLogoImg;
      }

      state.orgLogoUrl = resolveLogoUrl();
      if (!state.orgLogoUrl) {
        state.orgLogoImg = null;
        return null;
      }

      // Prefer same-origin group proxy when using organiser page logo
      var listing = isOppTemplate() ? currentListing() : null;
      var usingListingLogo = Boolean(listing && (listing.logoUrl || listing.imageUrl));
      if (!usingListingLogo && state.groupId) {
        try {
          state.orgLogoImg = await loadImage(
            '/api/organiser/logo-proxy?groupId=' + encodeURIComponent(state.groupId),
            false
          );
          setStatus('');
          return state.orgLogoImg;
        } catch (e) {
          /* fall through */
        }
      }

      try {
        state.orgLogoImg = await loadImage(state.orgLogoUrl, true);
        setStatus('');
      } catch (e2) {
        state.orgLogoImg = null;
        setStatus(
          'Could not load the logo into the preview. Upload the logo file below to include it in the download.',
          true
        );
      }
      return state.orgLogoImg;
    }

    function paintOpts(tpl, quietBrand, hubImg) {
      return {
        template: tpl,
        displayName: quietBrand ? tpl.label : state.displayName || elName.value,
        line1: quietBrand ? tpl.line1 : state.line1,
        line2: quietBrand ? tpl.line2 : state.line2,
        line3: quietBrand ? tpl.line3 : state.line3,
        orgLogoImg: quietBrand ? null : state.orgLogoImg,
        hubLogoImg: hubImg || null,
        quietBrand: quietBrand,
      };
    }

    async function renderGalleryThumbs() {
      for (var i = 0; i < TEMPLATES.length; i++) {
        var tpl = TEMPLATES[i];
        var el = root.querySelector('canvas[data-thumb-for="' + tpl.id + '"]');
        if (!el) continue;
        var hubImg = await ensureHubLogo(tpl);
        var tctx = el.getContext('2d');
        paintPost(tctx, paintOpts(tpl, true, hubImg));
      }
    }

    async function renderPreview() {
      if (state.rendering) return;
      state.rendering = true;
      try {
        syncOpportunityGate();
        syncListingField();
        var tpl = currentTemplate();
        var hubImg = await ensureHubLogo(tpl);
        await ensureOrgLogo();
        paintPost(ctx, paintOpts(tpl, false, hubImg));
        updateCaptionPreview();
        syncThumbSelection();
      } finally {
        state.rendering = false;
      }
    }

    function refresh() {
      return renderPreview();
    }

    function downloadPng() {
      if (isOppTemplate() && !hasLiveListings()) {
        setStatus('Publish a live business opportunity listing before downloading this template.', true);
        return;
      }
      renderPreview().then(function () {
        var tpl = currentTemplate();
        var link = document.createElement('a');
        var slug = String(state.displayName || 'organiser')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40);
        link.download = 'linkedin-post-' + tpl.id + (slug ? '-' + slug : '') + '.png';
        try {
          link.href = canvas.toDataURL('image/png');
        } catch (e) {
          setStatus(
            'Download blocked because an external logo tainted the canvas. Upload your logo file instead, then try again.',
            true
          );
          return;
        }
        link.click();
        setStatus('Downloaded — attach this image to your LinkedIn post with the caption below.');
      });
    }

    function copyCaption() {
      if (isOppTemplate() && !hasLiveListings()) {
        setStatus('Publish a live business opportunity listing before copying this caption.', true);
        return;
      }
      var text = buildCaption(currentTemplate(), captionPayload());
      var btn = root.querySelector('#post-copy-caption');
      var done = function () {
        if (!btn) return;
        var prev = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(function () {
          btn.textContent = prev;
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {
          window.prompt('Copy this caption:', text);
        });
      } else {
        window.prompt('Copy this caption:', text);
        done();
      }
      setStatus('Caption copied — paste it with your downloaded image on LinkedIn.');
    }

    function selectTemplate(id, flags) {
      var tpl = TEMPLATES.find(function (t) {
        return t.id === id;
      });
      if (!tpl) return;
      if (tpl.group === 'opportunities' && !hasLiveListings()) {
        setStatus('Publish a live business opportunity listing to unlock these templates.', true);
        return;
      }
      if (flags && flags.skipResetIfSame && state.templateId === id) {
        refresh();
        return;
      }
      state.templateId = id;
      state.line1 = tpl.line1;
      state.line2 = tpl.line2;
      state.line3 = tpl.line3;
      elLine1.value = state.line1;
      elLine2.value = state.line2;
      elLine3.value = state.line3;
      applyGroupToFields(false);
      refresh();
    }

    root.querySelector('#post-gallery').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-template-id]');
      if (!btn || !root.contains(btn) || btn.disabled) return;
      selectTemplate(btn.getAttribute('data-template-id'));
    });

    elGroup.addEventListener('change', function () {
      state.groupId = elGroup.value;
      applyGroupToFields(false);
      refresh();
    });
    elListing.addEventListener('change', function () {
      state.opportunityId = elListing.value;
      applyGroupToFields(false);
      refresh();
    });
    elName.addEventListener('input', function () {
      state.displayName = elName.value;
      refresh();
    });
    elLine1.addEventListener('input', function () {
      state.line1 = elLine1.value;
      refresh();
    });
    elLine2.addEventListener('input', function () {
      state.line2 = elLine2.value;
      refresh();
    });
    elLine3.addEventListener('input', function () {
      state.line3 = elLine3.value;
      refresh();
    });
    elFile.addEventListener('change', function () {
      var file = elFile.files && elFile.files[0];
      if (state.orgLogoObjectUrl) {
        try {
          URL.revokeObjectURL(state.orgLogoObjectUrl);
        } catch (e) {
          /* ignore */
        }
      }
      if (!file) {
        state.orgLogoObjectUrl = '';
        refresh();
        return;
      }
      state.orgLogoObjectUrl = URL.createObjectURL(file);
      setStatus('Using uploaded logo for this post image.');
      refresh();
    });
    root.querySelector('#post-download').addEventListener('click', downloadPng);
    root.querySelector('#post-copy-caption').addEventListener('click', copyCaption);
    root.querySelector('#post-reset').addEventListener('click', function () {
      applyGroupToFields(true);
      refresh();
    });

    function hydrate() {
      syncGroupOptions();
      syncOpportunityGate();
      syncListingField();
      applyGroupToFields(true);
      elLine1.value = state.line1;
      elLine2.value = state.line2;
      elLine3.value = state.line3;
      elName.value = state.displayName;
      renderGalleryThumbs().then(function () {
        return refresh();
      });
    }

    hydrate();

    return {
      refreshGroups: function () {
        syncGroupOptions();
        syncOpportunityGate();
        syncListingField();
        applyGroupToFields(false);
        refresh();
      },
      refreshOpportunities: function () {
        syncOpportunityGate();
        syncListingField();
        applyGroupToFields(false);
        refresh();
      },
      refresh: refresh,
      templates: TEMPLATES,
    };
  }

  global.HubLinkedInPostBuilder = {
    init: initLinkedInPostBuilder,
    templates: TEMPLATES,
  };
})(typeof window !== 'undefined' ? window : globalThis);
