/**
 * Organiser LinkedIn cover builder — preview + download with their logo/name.
 * Templates keep organiser messaging first; Hub stays a small corner credit.
 */
(function (global) {
  var W = 1584;
  var H = 396;

  var TEMPLATES = [
    {
      id: 'events',
      label: 'Join our next event',
      group: 'events',
      accent: '#9a7aa8',
      kicker: 'NETWORKING EVENT',
      line1: 'Join our next',
      line2: 'networking event',
      line3: 'Meet founders, operators, and local connectors',
    },
    {
      id: 'meet',
      label: 'Let us meet',
      group: 'events',
      accent: '#4a4446',
      kicker: 'LET US MEET',
      line1: 'Let us connect',
      line2: 'in the room',
      line3: 'Business networking that leads to real introductions',
    },
    {
      id: 'guest',
      label: 'Guest visits welcome',
      group: 'events',
      accent: '#c299d1',
      kicker: 'GUEST VISITS',
      line1: 'Guest visits welcome',
      line2: 'try before you join',
      line3: 'A complimentary first visit — then come back as a member',
    },
    {
      id: 'book',
      label: 'Tickets are open',
      group: 'events',
      accent: '#b8956a',
      kicker: 'TICKETS OPEN',
      line1: 'Tickets are open',
      line2: 'for our next event',
      line3: 'Secure your seat and bring a guest if you like',
    },
    {
      id: 'opportunity',
      label: 'Business opportunity',
      group: 'opportunities',
      accent: '#b8956a',
      kicker: 'BUSINESS OPPORTUNITY',
      line1: 'A business opportunity',
      line2: 'worth a conversation',
      line3: 'Franchise, partnership, or side-hustle — enquire to learn more',
    },
    {
      id: 'partnership',
      label: 'Looking for partners',
      group: 'opportunities',
      accent: '#c299d1',
      kicker: 'PARTNERSHIP',
      line1: 'Looking for the',
      line2: 'right partners',
      line3: 'Serious enquiries welcome from aligned founders',
    },
    {
      id: 'franchise',
      label: 'Franchise opportunity',
      group: 'opportunities',
      accent: '#9a7aa8',
      kicker: 'FRANCHISE',
      line1: 'Franchise opportunity',
      line2: 'now open to enquire',
      line3: 'Explore territory, investment, and next steps',
    },
    {
      id: 'enquire',
      label: 'Enquire to learn more',
      group: 'opportunities',
      accent: '#4a4446',
      kicker: 'ENQUIRE',
      line1: 'Curious?',
      line2: 'Enquire to learn more',
      line3: 'Send a short note — we will share what matters',
    },
    {
      id: 'verified',
      label: 'Verified organiser (Hub badge)',
      group: 'badges',
      accent: '#c299d1',
      kicker: 'TRUST MARK',
      line1: 'Verified organiser',
      line2: 'on The Networker Hub',
      line3: 'A small credibility badge for your LinkedIn profile',
      hubEmphasis: true,
    },
    {
      id: 'listed',
      label: 'Listed on the Hub (badge)',
      group: 'badges',
      accent: '#9a7aa8',
      kicker: 'DIRECTORY',
      line1: 'Listed on',
      line2: 'The Networker Hub',
      line3: 'UK networking events and business opportunities',
      hubEmphasis: true,
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

  function drawCoveredImage(ctx, img, x, y, w, h) {
    if (!img) return;
    var ir = img.width / img.height;
    var br = w / h;
    var sx = 0;
    var sy = 0;
    var sw = img.width;
    var sh = img.height;
    if (ir > br) {
      sw = img.height * br;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / br;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
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

  function paintBanner(ctx, opts) {
    var tpl = opts.template;
    var name = String(opts.displayName || '').trim();
    var line1 = String(opts.line1 != null ? opts.line1 : tpl.line1).trim();
    var line2 = String(opts.line2 != null ? opts.line2 : tpl.line2).trim();
    var line3 = String(opts.line3 != null ? opts.line3 : tpl.line3).trim();
    var orgLogo = opts.orgLogoImg || null;
    var hubLogo = opts.hubLogoImg || null;

    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#faf6ee');
    g.addColorStop(0.55, '#f5f0e8');
    g.addColorStop(1, '#ebe0f0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = tpl.accent || '#c299d1';
    ctx.fillRect(0, 0, 12, H);

    ctx.fillStyle = 'rgba(194,153,209,0.12)';
    ctx.beginPath();
    ctx.arc(1520, 40, 180, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(154,122,168,0.1)';
    ctx.beginPath();
    ctx.arc(1460, 380, 140, 0, Math.PI * 2);
    ctx.fill();

    // Copy block — clear of LinkedIn avatar on the left
    var textX = 520;
    ctx.fillStyle = '#9a7aa8';
    ctx.font = '700 16px "DM Sans", Arial, Helvetica, sans-serif';
    ctx.fillText(String(tpl.kicker || '').toUpperCase(), textX, 118);

    ctx.fillStyle = '#4a4446';
    ctx.font = '400 46px "DM Serif Display", Georgia, "Times New Roman", serif';
    ctx.fillText(line1.slice(0, 42), textX, 176);
    ctx.fillText(line2.slice(0, 42), textX, 234);

    ctx.fillStyle = '#5c5557';
    ctx.font = '400 20px "DM Sans", Arial, Helvetica, sans-serif';
    var subLines = wrapText(ctx, line3, 620);
    for (var i = 0; i < Math.min(2, subLines.length); i++) {
      ctx.fillText(subLines[i], textX, 286 + i * 26);
    }

    // Organiser logo + name (their brand), top-right
    var brandBoxX = 1180;
    var brandBoxY = 36;
    var brandBoxW = 340;
    var brandBoxH = 120;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    roundRect(ctx, brandBoxX, brandBoxY, brandBoxW, brandBoxH, 14);
    ctx.fill();

    if (orgLogo) {
      drawContainedImage(ctx, orgLogo, brandBoxX + 18, brandBoxY + 12, 120, 72);
      ctx.fillStyle = '#4a4446';
      ctx.font = '700 18px "DM Sans", Arial, Helvetica, sans-serif';
      var nameLines = wrapText(ctx, name || 'Your group', 170);
      for (var n = 0; n < Math.min(3, nameLines.length); n++) {
        ctx.fillText(nameLines[n], brandBoxX + 150, brandBoxY + 42 + n * 22);
      }
    } else {
      ctx.fillStyle = '#4a4446';
      ctx.font = '700 22px "DM Serif Display", Georgia, serif';
      var solo = wrapText(ctx, name || 'Your group name', 300);
      for (var s = 0; s < Math.min(3, solo.length); s++) {
        ctx.fillText(solo[s], brandBoxX + 20, brandBoxY + 48 + s * 28);
      }
      ctx.fillStyle = '#9a7aa8';
      ctx.font = '400 13px "DM Sans", Arial, Helvetica, sans-serif';
      ctx.fillText('Add your logo for a stronger banner', brandBoxX + 20, brandBoxY + 100);
    }

    // Small Hub credit
    var creditW = tpl.hubEmphasis ? 150 : 120;
    var creditH = tpl.hubEmphasis ? 40 : 32;
    var cx = W - creditW - 36;
    var cy = H - creditH - 36;
    if (hubLogo) {
      drawContainedImage(ctx, hubLogo, cx, cy, creditW, creditH);
    }
    ctx.fillStyle = '#5c5557';
    ctx.font = '400 11px "DM Sans", Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tpl.hubEmphasis ? 'The Networker Hub' : 'on The Networker Hub', cx + creditW / 2, cy + creditH + 14);
    ctx.textAlign = 'left';
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

  function initLinkedInCoverBuilder(root, options) {
    if (!root) return null;
    var opts = options || {};
    var getGroups = typeof opts.getGroups === 'function' ? opts.getGroups : function () {
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

    root.innerHTML =
      '<div class="org-cover-builder">' +
      '<div class="org-cover-builder-controls">' +
      '<label class="org-cover-field">' +
      '<span class="org-cover-label">Template</span>' +
      '<select id="cover-template" aria-label="Cover template"></select>' +
      '</label>' +
      '<label class="org-cover-field">' +
      '<span class="org-cover-label">Organiser page</span>' +
      '<select id="cover-group" aria-label="Organiser page"></select>' +
      '</label>' +
      '<label class="org-cover-field">' +
      '<span class="org-cover-label">Display name</span>' +
      '<input type="text" id="cover-name" maxlength="60" placeholder="Your group or brand name" />' +
      '</label>' +
      '<label class="org-cover-field">' +
      '<span class="org-cover-label">Logo</span>' +
      '<input type="file" id="cover-logo-file" accept="image/*" />' +
      '<span class="org-cover-hint" id="cover-logo-hint">Uses your organiser page logo when available. Upload to override.</span>' +
      '</label>' +
      '<label class="org-cover-field">' +
      '<span class="org-cover-label">Headline line 1</span>' +
      '<input type="text" id="cover-line1" maxlength="42" />' +
      '</label>' +
      '<label class="org-cover-field">' +
      '<span class="org-cover-label">Headline line 2</span>' +
      '<input type="text" id="cover-line2" maxlength="42" />' +
      '</label>' +
      '<label class="org-cover-field">' +
      '<span class="org-cover-label">Supporting line</span>' +
      '<input type="text" id="cover-line3" maxlength="80" />' +
      '</label>' +
      '<div class="org-cover-actions">' +
      '<button type="button" class="org-btn org-btn-gold" id="cover-download">Download PNG</button>' +
      '<button type="button" class="org-btn org-btn-outline" id="cover-reset">Reset copy</button>' +
      '</div>' +
      '<p class="org-cover-status" id="cover-status" role="status"></p>' +
      '</div>' +
      '<div class="org-cover-preview-wrap">' +
      '<p class="org-cover-label">Live preview</p>' +
      '<div class="org-cover-preview-frame">' +
      '<canvas id="cover-preview-canvas" width="' +
      W +
      '" height="' +
      H +
      '" aria-label="LinkedIn cover preview"></canvas>' +
      '</div>' +
      '<p class="org-cover-hint">1584×396 — left side stays clear for your LinkedIn photo. Your logo/name sit top-right; Hub stays a small credit.</p>' +
      '</div>' +
      '</div>';

    var elTemplate = root.querySelector('#cover-template');
    var elGroup = root.querySelector('#cover-group');
    var elName = root.querySelector('#cover-name');
    var elFile = root.querySelector('#cover-logo-file');
    var elLine1 = root.querySelector('#cover-line1');
    var elLine2 = root.querySelector('#cover-line2');
    var elLine3 = root.querySelector('#cover-line3');
    var elStatus = root.querySelector('#cover-status');
    var canvas = root.querySelector('#cover-preview-canvas');
    var ctx = canvas.getContext('2d');

    TEMPLATES.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.label;
      elTemplate.appendChild(opt);
    });

    function currentTemplate() {
      return TEMPLATES.find(function (t) {
        return t.id === state.templateId;
      }) || TEMPLATES[0];
    }

    function setStatus(msg, isError) {
      elStatus.textContent = msg || '';
      elStatus.classList.toggle('is-error', Boolean(isError));
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
      if (prev && groups.some(function (g) {
        return g.id === prev;
      })) {
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

    function refresh() {
      return renderPreview();
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

    async function renderPreview() {
      if (state.rendering) return;
      state.rendering = true;
      try {
        await ensureHubLogo();
        await ensureOrgLogo();
        paintBanner(ctx, {
          template: currentTemplate(),
          displayName: state.displayName || elName.value,
          line1: state.line1,
          line2: state.line2,
          line3: state.line3,
          orgLogoImg: state.orgLogoImg,
          hubLogoImg: state.hubLogoImg,
        });
      } finally {
        state.rendering = false;
      }
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
        link.download = 'linkedin-cover-' + tpl.id + (slug ? '-' + slug : '') + '.png';
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
        setStatus('Downloaded — upload this PNG as your LinkedIn banner.');
      });
    }

    elTemplate.addEventListener('change', function () {
      state.templateId = elTemplate.value;
      var tpl = currentTemplate();
      state.line1 = tpl.line1;
      state.line2 = tpl.line2;
      state.line3 = tpl.line3;
      elLine1.value = state.line1;
      elLine2.value = state.line2;
      elLine3.value = state.line3;
      refresh();
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
      setStatus('Using uploaded logo for this banner.');
      refresh();
    });
    root.querySelector('#cover-download').addEventListener('click', downloadPng);
    root.querySelector('#cover-reset').addEventListener('click', function () {
      applyGroupToFields(true);
      refresh();
    });

    function hydrate() {
      syncGroupOptions();
      applyGroupToFields(true);
      elTemplate.value = state.templateId;
      elLine1.value = state.line1;
      elLine2.value = state.line2;
      elLine3.value = state.line3;
      elName.value = state.displayName;
      refresh();
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

  global.HubLinkedInCoverBuilder = {
    init: initLinkedInCoverBuilder,
    templates: TEMPLATES,
  };
})(typeof window !== 'undefined' ? window : globalThis);
