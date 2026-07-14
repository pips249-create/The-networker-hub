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
      label: 'Join our next event',
      group: 'events',
      groupLabel: 'Events & group',
      accent: '#9a7aa8',
      kicker: 'NETWORKING EVENT',
      line1: 'Join our next',
      line2: 'networking event',
      line3: 'Meet founders, operators, and local connectors',
      caption:
        "We're hosting our next networking event — come and meet founders, operators, and local connectors.\n\n{name}\nFind us on The Networker Hub → {url}",
    },
    {
      id: 'meet',
      label: 'Let us meet',
      group: 'events',
      groupLabel: 'Events & group',
      accent: '#4a4446',
      kicker: 'LET US MEET',
      line1: 'Let us connect',
      line2: 'in the room',
      line3: 'Business networking that leads to real introductions',
      caption:
        'Real conversations beat endless scrolling. Come and connect with us in the room.\n\n{name}\nOn The Networker Hub → {url}',
    },
    {
      id: 'guest',
      label: 'Guest visits welcome',
      group: 'events',
      groupLabel: 'Events & group',
      accent: '#c299d1',
      kicker: 'GUEST VISITS',
      line1: 'Guest visits welcome',
      line2: 'try before you join',
      line3: 'A complimentary first visit — then come back as a member',
      caption:
        'Curious about our networking group? Guest visits are welcome — try a meeting before you join.\n\n{name}\nDetails on The Networker Hub → {url}',
    },
    {
      id: 'book',
      label: 'Tickets are open',
      group: 'events',
      groupLabel: 'Events & group',
      accent: '#b8956a',
      kicker: 'TICKETS OPEN',
      line1: 'Tickets are open',
      line2: 'for our next event',
      line3: 'Secure your seat and bring a guest if you like',
      caption:
        'Tickets are open for our next event. Secure your seat — and bring a guest if you like.\n\n{name}\nBook via The Networker Hub → {url}',
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
        "There's a business opportunity open that may be worth a conversation — franchise, partnership, or side-hustle.\n\n{name}\nEnquire on The Networker Hub → {url}",
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
        "We're looking for the right partners. Serious enquiries welcome from aligned founders and operators.\n\n{name}\nOn The Networker Hub → {url}",
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
        'Franchise opportunity now open to enquire — explore territory, investment, and next steps.\n\n{name}\nOn The Networker Hub → {url}',
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
        'Curious? Enquire to learn more — send a short note and we will share the details that matter.\n\n{name}\nOn The Networker Hub → {url}',
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
      var brandBoxH = 132;
      ctx.fillStyle = isOpp ? 'rgba(253,246,227,0.94)' : 'rgba(255,255,255,0.72)';
      roundRect(ctx, brandBoxX, brandBoxY, brandBoxW, brandBoxH, 18);
      ctx.fill();

      if (orgLogo) {
        drawContainedImage(ctx, orgLogo, brandBoxX + 24, brandBoxY + 20, 140, 92);
        ctx.fillStyle = brandText;
        ctx.font = '700 36px "DM Serif Display", Georgia, serif';
        var nameLines = wrapText(ctx, name || 'Your group', 820);
        for (var n = 0; n < Math.min(2, nameLines.length); n++) {
          ctx.fillText(nameLines[n], brandBoxX + 190, brandBoxY + 62 + n * 40);
        }
      } else {
        ctx.fillStyle = brandText;
        ctx.font = '700 40px "DM Serif Display", Georgia, serif';
        var solo = wrapText(ctx, name || 'Your group name', 980);
        for (var s = 0; s < Math.min(2, solo.length); s++) {
          ctx.fillText(solo[s], brandBoxX + 36, brandBoxY + 58 + s * 44);
        }
        if (!name) {
          ctx.fillStyle = brandHint;
          ctx.font = '400 20px "DM Sans", Arial, Helvetica, sans-serif';
          ctx.fillText('Add your logo for a stronger post', brandBoxX + 36, brandBoxY + 108);
        }
      }
    }

    var textY = quietBrand ? 340 : 420;
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

    var creditW = tpl.hubEmphasis ? 210 : 170;
    var creditH = tpl.hubEmphasis ? 56 : 46;
    var cx = W - creditW - 56;
    var cy = H - creditH - 64;
    if (hubLogo) {
      drawContainedImage(ctx, hubLogo, cx, cy, creditW, creditH);
    }
    ctx.fillStyle = creditColor;
    ctx.font = '400 18px "DM Sans", Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      tpl.hubEmphasis ? 'The Networker Hub' : 'on The Networker Hub',
      cx + creditW / 2,
      cy + creditH + 26
    );
    ctx.textAlign = 'left';
  }

  function profileUrlForGroup(groupId) {
    if (!groupId) return (global.location && global.location.origin ? global.location.origin : '') + '/events';
    return (
      (global.location && global.location.origin ? global.location.origin : '') +
      '/events/organiser?id=' +
      encodeURIComponent(groupId)
    );
  }

  function buildCaption(tpl, name, groupId) {
    var raw = tpl.caption || '';
    return raw
      .replace(/\{name\}/g, name || 'Our group')
      .replace(/\{url\}/g, profileUrlForGroup(groupId));
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

    var state = {
      templateId: TEMPLATES[0].id,
      groupId: '',
      displayName: '',
      line1: TEMPLATES[0].line1,
      line2: TEMPLATES[0].line2,
      line3: TEMPLATES[0].line3,
      orgLogoUrl: '',
      orgLogoObjectUrl: '',
      hubLogoImg: null,
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
        return (
          '<div class="org-post-gallery-group">' +
          '<p class="org-post-gallery-group-title">' +
          esc(label) +
          '</p>' +
          '<div class="org-post-gallery-grid" role="list">' +
          items
            .map(function (t) {
              return (
                '<button type="button" class="org-post-thumb" role="listitem" data-template-id="' +
                esc(t.id) +
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
      '<label class="org-post-field">' +
      '<span class="org-post-label">Display name</span>' +
      '<input type="text" id="post-name" maxlength="60" placeholder="Your group or brand name" />' +
      '</label>' +
      '<label class="org-post-field">' +
      '<span class="org-post-label">Logo</span>' +
      '<input type="file" id="post-logo-file" accept="image/*" />' +
      '<span class="org-post-hint">Uses your organiser page logo when available. Upload to override.</span>' +
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
    var elName = root.querySelector('#post-name');
    var elFile = root.querySelector('#post-logo-file');
    var elLine1 = root.querySelector('#post-line1');
    var elLine2 = root.querySelector('#post-line2');
    var elLine3 = root.querySelector('#post-line3');
    var elStatus = root.querySelector('#post-status');
    var elCaption = root.querySelector('#post-caption-preview');
    var canvas = root.querySelector('#post-preview-canvas');
    var ctx = canvas.getContext('2d');

    function currentTemplate() {
      return (
        TEMPLATES.find(function (t) {
          return t.id === state.templateId;
        }) || TEMPLATES[0]
      );
    }

    function setStatus(msg, isError) {
      elStatus.textContent = msg || '';
      elStatus.classList.toggle('is-error', Boolean(isError));
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
      var groups = getGroups() || [];
      var g = groups.find(function (x) {
        return String(x.id) === String(state.groupId);
      });
      if (g) {
        state.displayName = g.name || '';
        state.orgLogoUrl = g.imageUrl || '';
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
      elCaption.textContent = buildCaption(
        currentTemplate(),
        state.displayName || elName.value,
        state.groupId
      );
    }

    async function ensureHubLogo() {
      if (state.hubLogoImg) return state.hubLogoImg;
      try {
        state.hubLogoImg = await loadImage('../assets/logo-nav-transparent.png', true);
      } catch (e) {
        try {
          state.hubLogoImg = await loadImage('/assets/logo-nav-transparent.png', true);
        } catch (e2) {
          state.hubLogoImg = null;
        }
      }
      return state.hubLogoImg;
    }

    async function ensureOrgLogo() {
      var src = state.orgLogoObjectUrl || state.orgLogoUrl;
      if (!src) {
        state.orgLogoImg = null;
        return null;
      }
      try {
        state.orgLogoImg = await loadImage(src, !state.orgLogoObjectUrl);
        setStatus('');
      } catch (e) {
        state.orgLogoImg = null;
        if (state.orgLogoUrl && !state.orgLogoObjectUrl) {
          setStatus(
            'Could not load your page logo into the preview (image host blocked it). Upload the logo file below to include it in the download.',
            true
          );
        }
      }
      return state.orgLogoImg;
    }

    function paintOpts(tpl, quietBrand) {
      return {
        template: tpl,
        displayName: quietBrand ? tpl.label : state.displayName || elName.value,
        line1: quietBrand ? tpl.line1 : state.line1,
        line2: quietBrand ? tpl.line2 : state.line2,
        line3: quietBrand ? tpl.line3 : state.line3,
        orgLogoImg: quietBrand ? null : state.orgLogoImg,
        hubLogoImg: state.hubLogoImg,
        quietBrand: quietBrand,
      };
    }

    async function renderGalleryThumbs() {
      await ensureHubLogo();
      TEMPLATES.forEach(function (tpl) {
        var el = root.querySelector('canvas[data-thumb-for="' + tpl.id + '"]');
        if (!el) return;
        var tctx = el.getContext('2d');
        paintPost(tctx, paintOpts(tpl, true));
      });
    }

    async function renderPreview() {
      if (state.rendering) return;
      state.rendering = true;
      try {
        await ensureHubLogo();
        await ensureOrgLogo();
        paintPost(ctx, paintOpts(currentTemplate(), false));
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
      var text = buildCaption(currentTemplate(), state.displayName || elName.value, state.groupId);
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

    function selectTemplate(id) {
      state.templateId = id;
      var tpl = currentTemplate();
      state.line1 = tpl.line1;
      state.line2 = tpl.line2;
      state.line3 = tpl.line3;
      elLine1.value = state.line1;
      elLine2.value = state.line2;
      elLine3.value = state.line3;
      refresh();
    }

    root.querySelector('#post-gallery').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-template-id]');
      if (!btn || !root.contains(btn)) return;
      selectTemplate(btn.getAttribute('data-template-id'));
    });

    elGroup.addEventListener('change', function () {
      state.groupId = elGroup.value;
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
