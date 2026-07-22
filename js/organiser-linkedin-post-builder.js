/**
 * Organiser LinkedIn post image builder — square post graphic + caption.
 * Pick a category + caption (or write your own), choose a background, preview, download PNG.
 */
(function (global) {
  var W = 1200;
  var H = 1200;

  var BACKGROUNDS = [
    {
      id: 'cream',
      label: 'Soft cream',
      dark: false,
      accent: '#9a7aa8',
      stops: ['#faf6ee', '#f5f0e8', '#ebe0f0'],
      blob1: 'rgba(194,153,209,0.14)',
      blob2: 'rgba(154,122,168,0.1)',
      kicker: '#9a7aa8',
      title: '#4a4446',
      sub: '#5c5557',
      brandText: '#4a4446',
      brandHint: '#9a7aa8',
      brandBox: 'rgba(255,255,255,0.78)',
      credit: '#5c5557',
    },
    {
      id: 'charcoal',
      label: 'Charcoal',
      dark: true,
      accent: '#c4a574',
      stops: ['#2c2826', '#3a3532', '#1e1b1a'],
      blob1: 'rgba(196,165,116,0.18)',
      blob2: 'rgba(255,255,255,0.05)',
      kicker: '#c4a574',
      title: '#f7f1e8',
      sub: '#b7aea4',
      brandText: '#2c2826',
      brandHint: '#8a7355',
      brandBox: 'rgba(247,241,232,0.95)',
      credit: '#b7aea4',
    },
    {
      id: 'navy',
      label: 'Navy & gold',
      dark: true,
      accent: '#c9961f',
      stops: ['#0d1f3c', '#162847', '#1a3a5c'],
      blob1: 'rgba(201,150,31,0.2)',
      blob2: 'rgba(232,184,75,0.12)',
      kicker: '#e8b84b',
      title: '#ffffff',
      sub: '#8d99ae',
      brandText: '#0d1f3c',
      brandHint: '#c9961f',
      brandBox: 'rgba(253,246,227,0.94)',
      credit: '#8d99ae',
    },
  ];

  var TEMPLATES = [
    {
      id: 'new_event',
      label: 'Event photo',
      group: 'events',
      groupLabel: 'Events & group',
      theme: 'event_photo_hero',
      styleHint: 'Large event photo with your logo in the corner',
      accent: '#9a7aa8',
      kicker: 'NEW EVENT',
      line1: 'We have just added',
      line2: 'a new event',
      line3: 'Book your place on The Networker Hub',
      caption:
        "We've just added a new event: {eventTitle}\n\n{dateLine}{locationLine}Buy tickets now on The Networker Hub:\n{url}",
    },
    {
      id: 'events',
      label: 'Room full of referrals',
      group: 'events',
      groupLabel: 'Events & group',
      styleHint: 'Bold quote on a soft background',
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
      styleHint: 'Bold quote on a soft background',
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
      styleHint: 'Bold quote on a soft background',
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
      styleHint: 'Bold quote on a soft background',
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

  function drawLogoPlaceholder(ctx, x, y, w, h, hintColor) {
    ctx.save();
    ctx.setLineDash([14, 10]);
    ctx.strokeStyle = hintColor || 'rgba(154, 122, 168, 0.5)';
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, w, h, 14);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = hintColor || 'rgba(154, 122, 168, 0.85)';
    ctx.font = '600 26px "DM Sans", Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Your logo here', x + w / 2, y + h / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  function parseImagePosition(raw) {
    var m = String(raw || '')
      .trim()
      .match(/^(\d{1,3})%\s+(\d{1,3})%$/);
    if (!m) return null;
    return {
      x: Math.min(100, Math.max(0, Number(m[1]))) / 100,
      y: Math.min(100, Math.max(0, Number(m[2]))) / 100,
    };
  }

  function drawCoverImage(ctx, img, x, y, w, h, position) {
    if (!img) return;
    var scale = Math.max(w / img.width, h / img.height);
    var dw = img.width * scale;
    var dh = img.height * scale;
    // Match CSS object-position / organiser photo recenter.
    var pos = parseImagePosition(position) || { x: 0.5, y: 0.5 };
    var dx = x + (w - dw) * pos.x;
    var dy = y + (h - dh) * pos.y;
    ctx.save();
    roundRect(ctx, x, y, w, h, 22);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
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

  function backgroundById(id) {
    return (
      BACKGROUNDS.find(function (b) {
        return b.id === id;
      }) || BACKGROUNDS[0]
    );
  }

  function defaultBackgroundIdForTemplate(tpl) {
    if (tpl && (tpl.theme === 'opportunity' || tpl.group === 'opportunities')) return 'navy';
    return 'cream';
  }

  function paintPost(ctx, opts) {
    var tpl = opts.template;
    var bg = opts.background || BACKGROUNDS[0];
    var name = String(opts.displayName || '').trim();
    var line1 = String(opts.line1 != null ? opts.line1 : tpl.line1).trim();
    var line2 = String(opts.line2 != null ? opts.line2 : tpl.line2).trim();
    var line3 = String(opts.line3 != null ? opts.line3 : tpl.line3).trim();
    var orgLogo = opts.orgLogoImg || null;
    var hubLogo = opts.hubLogoImg || null;
    var eventImage = opts.eventImageImg || null;
    var isEventSpotlight = tpl.theme === 'event_spotlight';
    var isPhotoHero = tpl.theme === 'event_photo_hero';
    var isEventGroup = tpl.group === 'events';
    var quietBrand = Boolean(opts.quietBrand);
    var isDark = Boolean(bg.dark);

    if (isPhotoHero && !quietBrand) {
      ctx.clearRect(0, 0, W, H);
      if (eventImage) {
        drawCoverImage(ctx, eventImage, 0, 0, W, H, opts.eventImagePosition);
      } else {
        var ph = ctx.createLinearGradient(0, 0, W, H);
        ph.addColorStop(0, bg.stops[0]);
        ph.addColorStop(1, bg.stops[2] || bg.stops[1] || bg.stops[0]);
        ctx.fillStyle = ph;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.font = '600 28px "DM Sans", Arial, Helvetica, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Your event photo will appear here', W / 2, H / 2 - 12);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '400 20px "DM Sans", Arial, Helvetica, sans-serif';
        ctx.fillText('Pick an event with a photo for the best result', W / 2, H / 2 + 28);
        ctx.textAlign = 'left';
      }

      var overlay = ctx.createLinearGradient(0, H * 0.32, 0, H);
      overlay.addColorStop(0, 'rgba(8, 12, 18, 0)');
      overlay.addColorStop(0.45, 'rgba(8, 12, 18, 0.55)');
      overlay.addColorStop(1, 'rgba(8, 12, 18, 0.9)');
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = bg.accent || tpl.accent || '#9a7aa8';
      ctx.fillRect(0, 0, W, 12);

      var logoBoxW = 168;
      var logoBoxH = 88;
      var logoBoxX = W - logoBoxW - 36;
      var logoBoxY = 40;
      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      roundRect(ctx, logoBoxX, logoBoxY, logoBoxW, logoBoxH, 12);
      ctx.fill();
      if (orgLogo) {
        drawContainedImage(ctx, orgLogo, logoBoxX + 12, logoBoxY + 8, logoBoxW - 24, logoBoxH - 16);
      } else {
        drawLogoPlaceholder(ctx, logoBoxX + 12, logoBoxY + 8, logoBoxW - 24, logoBoxH - 16, '#9a7aa8');
      }

      var textBaseY = H - 250;
      ctx.fillStyle = '#e8b84b';
      ctx.font = '700 20px "DM Sans", Arial, Helvetica, sans-serif';
      ctx.fillText(String(tpl.kicker || 'NEW EVENT').toUpperCase(), 56, textBaseY);

      ctx.fillStyle = '#ffffff';
      ctx.font = '400 58px "DM Serif Display", Georgia, "Times New Roman", serif';
      var heroTitle = wrapText(ctx, [line1, line2].filter(Boolean).join(' '), 920);
      var heroY = textBaseY + 62;
      for (var hi = 0; hi < Math.min(3, heroTitle.length); hi++) {
        ctx.fillText(heroTitle[hi], 56, heroY);
        heroY += 64;
      }

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '400 24px "DM Sans", Arial, Helvetica, sans-serif';
      var heroSub = wrapText(ctx, line3, 880);
      heroY += 10;
      for (var hs = 0; hs < Math.min(2, heroSub.length); hs++) {
        ctx.fillText(heroSub[hs], 56, heroY);
        heroY += 34;
      }

      if (hubLogo) drawContainedImage(ctx, hubLogo, W - 210, H - 82, 170, 46);
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.font = '400 16px "DM Sans", Arial, Helvetica, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('on The Networker Hub', W - 56, H - 28);
      ctx.textAlign = 'left';
      return;
    }

    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, bg.stops[0]);
    g.addColorStop(0.55, bg.stops[1] || bg.stops[0]);
    g.addColorStop(1, bg.stops[2] || bg.stops[1] || bg.stops[0]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = bg.accent || tpl.accent || '#9a7aa8';
    ctx.fillRect(0, 0, W, 16);

    ctx.fillStyle = bg.blob1;
    ctx.beginPath();
    ctx.arc(1040, 160, 220, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bg.blob2;
    ctx.beginPath();
    ctx.arc(180, 1040, 260, 0, Math.PI * 2);
    ctx.fill();

    var kickerColor = bg.kicker;
    var titleColor = bg.title;
    var subColor = bg.sub;
    var brandText = bg.brandText;
    var brandHint = bg.brandHint;
    var creditColor = bg.credit;

    if (!quietBrand) {
      var brandBoxX = 72;
      var brandBoxY = 56;
      var brandBoxW = 1056;
      var brandBoxH = 220;
      ctx.fillStyle = bg.brandBox;
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
      } else if (isEventGroup) {
        var phLogoW = 360;
        var phLogoH = 180;
        var phLogoX = brandBoxX + 28;
        var phLogoY = brandBoxY + (brandBoxH - phLogoH) / 2;
        drawLogoPlaceholder(ctx, phLogoX, phLogoY, phLogoW, phLogoH, brandHint);
        ctx.fillStyle = brandText;
        ctx.font = '700 40px "DM Serif Display", Georgia, serif';
        var eventNameLines = wrapText(ctx, name || 'Your group name', brandBoxW - phLogoW - 80);
        var eventNameY = brandBoxY + (brandBoxH - Math.min(2, eventNameLines.length) * 46) / 2 + 36;
        for (var en = 0; en < Math.min(2, eventNameLines.length); en++) {
          ctx.fillText(eventNameLines[en], phLogoX + phLogoW + 32, eventNameY + en * 46);
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

    if (isEventSpotlight && !quietBrand) {
      // Match the organiser listing crop frame (16:10) so object-position lines up.
      var coverY = 300;
      var coverAreaW = 1056;
      var coverH = eventImage ? 410 : 0;
      var coverW = eventImage ? Math.round(coverH * (16 / 10)) : 0;
      var coverX = eventImage ? 72 + Math.round((coverAreaW - coverW) / 2) : 72;
      if (eventImage) {
        drawCoverImage(ctx, eventImage, coverX, coverY, coverW, coverH, opts.eventImagePosition);
      }
      var spotlightTextY = eventImage ? 780 : 390;
      ctx.fillStyle = kickerColor;
      ctx.font = '700 22px "DM Sans", Arial, Helvetica, sans-serif';
      ctx.fillText(String(tpl.kicker || '').toUpperCase(), 72, spotlightTextY);
      ctx.fillStyle = titleColor;
      ctx.font = '400 62px "DM Serif Display", Georgia, "Times New Roman", serif';
      var eventTitleLines = wrapText(ctx, [line1, line2].filter(Boolean).join(' '), 1000);
      var eventY = spotlightTextY + 70;
      for (var et = 0; et < Math.min(3, eventTitleLines.length); et++) {
        ctx.fillText(eventTitleLines[et], 72, eventY);
        eventY += 68;
      }
      ctx.fillStyle = subColor;
      ctx.font = '400 27px "DM Sans", Arial, Helvetica, sans-serif';
      var eventSubLines = wrapText(ctx, line3, 820);
      eventY += 12;
      for (var es = 0; es < Math.min(2, eventSubLines.length); es++) {
        ctx.fillText(eventSubLines[es], 72, eventY);
        eventY += 36;
      }
      if (hubLogo) drawContainedImage(ctx, hubLogo, W - 230, H - 116, 170, 46);
      ctx.fillStyle = creditColor;
      ctx.font = '400 18px "DM Sans", Arial, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('on The Networker Hub', W - 145, H - 42);
      ctx.textAlign = 'left';
      return;
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

    var isDarkHub = Boolean(isDark && hubLogo);
    var creditW = tpl.hubEmphasis ? 210 : isDarkHub ? 200 : 170;
    var creditH = tpl.hubEmphasis ? 56 : isDarkHub ? 54 : 46;
    var cx = W - creditW - 48;
    var cy = H - creditH - (isDarkHub ? 48 : 64);
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

  function isPublishedEvent(ev) {
    if (!ev) return false;
    var status = String(ev.status || ev.listingStatus || '').toLowerCase();
    return status === 'published' || status === 'live';
  }

  function eventPublicUrl(ev) {
    var origin = siteOrigin();
    if (!ev) return origin + '/events';
    var slug = String(ev.slug || '').trim();
    if (slug && !/^[0-9a-f-]{36}$/i.test(slug)) {
      return origin + '/events/' + encodeURIComponent(slug);
    }
    if (ev.id) return origin + '/events/event?id=' + encodeURIComponent(ev.id);
    return origin + '/events';
  }

  function eventIsOnline(ev) {
    if (!ev) return false;
    var format = String(ev.eventFormat || ev.meeting_type || '').toLowerCase();
    if (format.includes('online') || format.includes('virtual')) return true;
    var loc = String(ev.location || '').trim().toLowerCase();
    if (loc === 'online') return true;
    return Boolean(ev.onlineLink || ev.meeting_link) && !ev.venue && !ev.addressLine1 && !ev.postcode;
  }

  function eventPlaceLine(ev) {
    if (!ev) return '';
    if (eventIsOnline(ev)) {
      var platform = String(ev.onlinePlatform || '').trim();
      return platform ? 'Online · ' + platform : 'Online';
    }
    return String(ev.location || ev.venue || '').trim();
  }

  function eventOptionLabel(ev) {
    var title = String((ev && ev.title) || 'Untitled event').trim();
    var date = eventDateLine(ev);
    if (date) return title + ' · ' + date;
    return title + ' · Date TBC';
  }

  function eventDateLine(ev) {
    var raw = ev && (ev.date || ev.startsAt || ev.starts_at);
    if (!raw) return '';
    var d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
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
      .replace(/\{eventTitle\}/g, o.eventTitle || listing)
      .replace(/\{dateLine\}/g, o.dateLine ? o.dateLine + '\n' : '')
      .replace(/\{locationLine\}/g, o.location ? o.location + '\n\n' : '\n')
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
    var getEvents =
      typeof opts.getEvents === 'function'
        ? opts.getEvents
        : function () {
            return [];
          };

    var CATEGORIES = [
      { id: 'events', label: 'Events & group' },
      { id: 'opportunities', label: 'Business opportunities' },
      { id: 'badges', label: 'Hub trust badges' },
    ];

    var DEFAULT_TEMPLATE_BY_CATEGORY = {
      events: 'new_event',
      opportunities: 'opportunity',
      badges: 'verified',
    };

    var state = {
      categoryId: TEMPLATES[0].group,
      templateId: TEMPLATES[0].id,
      customCaption: false,
      captionText: '',
      backgroundId: 'cream',
      backgroundTouched: false,
      groupId: '',
      opportunityId: '',
      eventId: '',
      displayName: '',
      line1: TEMPLATES[0].line1,
      line2: TEMPLATES[0].line2,
      line3: TEMPLATES[0].line3,
      orgLogoUrl: '',
      orgLogoObjectUrl: '',
      hubLogoImg: null,
      hubLogoDarkImg: null,
      orgLogoImg: null,
      eventImageImg: null,
      eventImageUrl: '',
      eventImagePosition: '',
      rendering: false,
      renderPending: false,
    };

    var backgroundPickerHtml =
      '<div class="org-post-bg-picker" id="post-bg-picker" role="listbox" aria-label="Post background">' +
      BACKGROUNDS.map(function (bg) {
        return (
          '<button type="button" class="org-post-bg-option" role="option" data-background-id="' +
          esc(bg.id) +
          '" aria-selected="false">' +
          '<span class="org-post-bg-swatch org-post-bg-swatch--' +
          esc(bg.id) +
          '" aria-hidden="true"></span>' +
          '<span class="org-post-bg-label">' +
          esc(bg.label) +
          '</span>' +
          '</button>'
        );
      }).join('') +
      '</div>';

    var categoryTabsHtml =
      '<div class="org-post-category-tabs" id="post-category-tabs" role="tablist" aria-label="Caption category">' +
      CATEGORIES.map(function (cat, idx) {
        return (
          '<button type="button" class="org-post-category-tab" role="tab" data-category-id="' +
          esc(cat.id) +
          '" aria-selected="' +
          (idx === 0 ? 'true' : 'false') +
          '">' +
          esc(cat.label) +
          '</button>'
        );
      }).join('') +
      '</div>';

    root.innerHTML =
      '<div class="org-post-builder">' +
      '<div class="org-post-workspace">' +
      '<div class="org-post-builder-controls">' +
      '<div class="org-post-field org-post-field--category">' +
      '<span class="org-post-label">What is this post about?</span>' +
      '<div class="org-post-category-tabs-wrap">' +
      categoryTabsHtml +
      '</div>' +
      '<p class="org-post-gallery-gate" id="post-opp-gate" hidden>Publish a live business opportunity first to unlock these options. <a href="#business-list">List a business opportunity →</a></p>' +
      '</div>' +
      '<div class="org-post-pick-block">' +
      '<label class="org-post-field">' +
      '<span class="org-post-label">Your organiser page</span>' +
      '<select id="post-group" aria-label="Organiser page"></select>' +
      '</label>' +
      '<label class="org-post-field" id="post-event-field" hidden>' +
      '<span class="org-post-label">Which event?</span>' +
      '<select id="post-event" aria-label="Published event"></select>' +
      '<span class="org-post-hint">We add your event photo, date, and booking link automatically.</span>' +
      '</label>' +
      '<label class="org-post-field" id="post-listing-field" hidden style="display:none">' +
      '<span class="org-post-label">Which business opportunity?</span>' +
      '<select id="post-listing" aria-label="Business opportunity listing"></select>' +
      '<span class="org-post-hint">The post will link to this listing on The Networker Hub.</span>' +
      '</label>' +
      '</div>' +
      '<div class="org-post-field">' +
      '<span class="org-post-label">Choose a picture style</span>' +
      '<div class="org-post-caption-options" id="post-caption-options" role="listbox" aria-label="Picture styles"></div>' +
      '<p class="org-post-hint">Each style changes the picture layout. You can edit the words below.</p>' +
      '</div>' +
      '<label class="org-post-field">' +
      '<span class="org-post-label">Your post message</span>' +
      '<textarea id="post-caption-edit" class="org-post-caption-edit" rows="6" maxlength="1200" aria-label="Post text"></textarea>' +
      '</label>' +
      '<details class="org-post-advanced org-post-advanced--picture">' +
      '<summary>Customise your picture (optional)</summary>' +
      '<div class="org-post-field">' +
      '<span class="org-post-label">Choose a background colour</span>' +
      backgroundPickerHtml +
      '</div>' +
      '<label class="org-post-field">' +
      '<span class="org-post-label">Name shown on the picture</span>' +
      '<input type="text" id="post-name" maxlength="60" placeholder="Your group or business name" />' +
      '</label>' +
      '<label class="org-post-field">' +
      '<span class="org-post-label">Your logo (optional)</span>' +
      '<input type="file" id="post-logo-file" accept="image/*" />' +
      '<span class="org-post-hint" id="post-logo-hint">We use your organiser page logo when you have one. Upload a file here to use a different logo.</span>' +
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
      '<span class="org-post-label">Smaller line underneath</span>' +
      '<input type="text" id="post-line3" maxlength="90" />' +
      '</label>' +
      '</details>' +
      '<div class="org-post-actions org-post-actions-primary">' +
      '<button type="button" class="org-btn org-btn-gold" id="post-linkedin-primary">Copy text &amp; open LinkedIn</button>' +
      '</div>' +
      '<div class="org-post-actions">' +
      '<button type="button" class="org-btn org-btn-outline" id="post-download">Download picture</button>' +
      '<button type="button" class="org-btn org-btn-outline" id="post-copy-caption">Copy post text only</button>' +
      '<button type="button" class="org-btn org-btn-outline" id="post-reset">Start again</button>' +
      '</div>' +
      '<p class="org-post-status" id="post-status" role="status"></p>' +
      '</div>' +
      '<div class="org-post-preview-wrap">' +
      '<p class="org-post-label">Preview — your LinkedIn picture</p>' +
      '<div class="org-post-preview-frame">' +
      '<canvas id="post-preview-canvas" width="' +
      W +
      '" height="' +
      H +
      '" aria-label="LinkedIn post image preview"></canvas>' +
      '</div>' +
      '<p class="org-post-hint">Download the picture, then paste your text when you create a post on LinkedIn. The picture is square — ideal for LinkedIn.</p>' +
      '</div>' +
      '</div>' +
      '</div>';

    var elGroup = root.querySelector('#post-group');
    var elEventField = root.querySelector('#post-event-field');
    var elEvent = root.querySelector('#post-event');
    var elListingField = root.querySelector('#post-listing-field');
    var elListing = root.querySelector('#post-listing');
    var elName = root.querySelector('#post-name');
    var elFile = root.querySelector('#post-logo-file');
    var elLogoHint = root.querySelector('#post-logo-hint');
    var elLine1 = root.querySelector('#post-line1');
    var elLine2 = root.querySelector('#post-line2');
    var elLine3 = root.querySelector('#post-line3');
    var elStatus = root.querySelector('#post-status');
    var elCaptionEdit = root.querySelector('#post-caption-edit');
    var elCaptionOptions = root.querySelector('#post-caption-options');
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

    function currentBackground() {
      return backgroundById(state.backgroundId);
    }

    function syncBackgroundSelection() {
      root.querySelectorAll('.org-post-bg-option').forEach(function (btn) {
        var on = btn.getAttribute('data-background-id') === state.backgroundId;
        btn.classList.toggle('is-selected', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }

    function selectBackground(id, flags) {
      var bg = backgroundById(id);
      if (!bg) return;
      state.backgroundId = bg.id;
      if (!flags || !flags.silent) state.backgroundTouched = true;
      syncBackgroundSelection();
      refresh();
    }

    function templatesForCategory(categoryId) {
      return TEMPLATES.filter(function (t) {
        return t.group === (categoryId || state.categoryId);
      });
    }

    function defaultTemplateForCategory(categoryId) {
      var preferred = DEFAULT_TEMPLATE_BY_CATEGORY[categoryId || state.categoryId];
      return (
        TEMPLATES.find(function (t) {
          return t.id === preferred;
        }) ||
        templatesForCategory(categoryId)[0] ||
        TEMPLATES[0]
      );
    }

    function syncCategoryTabs() {
      root.querySelectorAll('.org-post-category-tab').forEach(function (btn) {
        var on = btn.getAttribute('data-category-id') === state.categoryId;
        btn.classList.toggle('is-selected', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }

    function styleHintFor(tpl) {
      if (tpl.styleHint) return tpl.styleHint;
      if (tpl.theme === 'event_photo_hero') return 'Large event photo with your logo in the corner';
      if (tpl.theme === 'event_spotlight') return 'Event photo with headline underneath';
      if (tpl.theme === 'opportunity') return 'Professional layout for business listings';
      return 'Text on a coloured background';
    }

    function styleThumbClass(tpl) {
      if (tpl.theme === 'event_photo_hero' || tpl.theme === 'event_spotlight') {
        return 'org-post-caption-option-thumb--photo';
      }
      if (tpl.theme === 'opportunity') return 'org-post-caption-option-thumb--listing';
      return 'org-post-caption-option-thumb--quote';
    }

    function syncCaptionOptions() {
      if (!elCaptionOptions) return;
      var list = templatesForCategory(state.categoryId);
      var locked = state.categoryId === 'opportunities' && !hasLiveListings();
      var html = list
        .map(function (t) {
          var selected = !state.customCaption && t.id === state.templateId;
          return (
            '<button type="button" class="org-post-caption-option' +
            (selected ? ' is-selected' : '') +
            (locked ? ' is-locked' : '') +
            '" role="option" data-template-id="' +
            esc(t.id) +
            '" aria-selected="' +
            (selected ? 'true' : 'false') +
            '"' +
            (locked ? ' disabled aria-disabled="true"' : '') +
            '>' +
            '<span class="org-post-caption-option-thumb ' +
            styleThumbClass(t) +
            '" aria-hidden="true"></span>' +
            '<span class="org-post-caption-option-copy">' +
            '<span class="org-post-caption-option-title">' +
            esc(t.label) +
            '</span>' +
            '<span class="org-post-caption-option-blurb">' +
            esc(styleHintFor(t)) +
            '</span>' +
            '</span>' +
            '</button>'
          );
        })
        .join('');
      html +=
        '<button type="button" class="org-post-caption-option' +
        (state.customCaption ? ' is-selected' : '') +
        '" role="option" data-caption-custom="1" aria-selected="' +
        (state.customCaption ? 'true' : 'false') +
        '">' +
        '<span class="org-post-caption-option-thumb org-post-caption-option-thumb--custom" aria-hidden="true"></span>' +
        '<span class="org-post-caption-option-copy">' +
        '<span class="org-post-caption-option-title">Write your own message</span>' +
        '<span class="org-post-caption-option-blurb">Keep the picture layout and type your own words</span>' +
        '</span>' +
        '</button>';
      elCaptionOptions.innerHTML = html;
    }

    function isOppTemplate(tpl) {
      tpl = tpl || currentTemplate();
      return tpl.theme === 'opportunity' || tpl.group === 'opportunities';
    }

    function isEventTemplate(tpl) {
      tpl = tpl || currentTemplate();
      return tpl.theme === 'event_spotlight' || tpl.theme === 'event_photo_hero';
    }

    function publishedListings() {
      return (getOpportunities() || []).filter(isPublishedOpportunity);
    }

    function publishedEvents() {
      return (getEvents() || []).filter(isPublishedEvent);
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

    function currentEvent() {
      return (
        publishedEvents().find(function (ev) {
          return String(ev.id) === String(state.eventId);
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
      var event = currentEvent();
      var name = state.displayName || elName.value || 'Our group';
      if (isEventTemplate(tpl) && event) {
        return {
          name: name,
          listingTitle: event.title || name,
          eventTitle: event.title || 'Our event',
          dateLine: eventDateLine(event),
          location: eventPlaceLine(event),
          url: eventPublicUrl(event),
        };
      }
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
      if (elOppGate) elOppGate.hidden = unlocked || state.categoryId !== 'opportunities';
      if (!unlocked && state.categoryId === 'opportunities') {
        state.categoryId = 'events';
        state.customCaption = false;
        var fallback = defaultTemplateForCategory('events');
        state.templateId = fallback.id;
        state.line1 = fallback.line1;
        state.line2 = fallback.line2;
        state.line3 = fallback.line3;
        if (elLine1) elLine1.value = state.line1;
        if (elLine2) elLine2.value = state.line2;
        if (elLine3) elLine3.value = state.line3;
        syncCategoryTabs();
        syncCaptionOptions();
        fillCaptionFromTemplate();
      } else {
        syncCaptionOptions();
      }
    }

    function setFieldVisible(el, show) {
      if (!el) return;
      el.hidden = !show;
      el.setAttribute('aria-hidden', show ? 'false' : 'true');
      el.style.display = show ? '' : 'none';
    }

    function syncListingField() {
      // Opportunity-only control — never show on event announcement templates.
      var show = isOppTemplate() && !isEventTemplate() && hasLiveListings();
      setFieldVisible(elListingField, show);
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

    function syncEventField() {
      var show = isEventTemplate();
      setFieldVisible(elEventField, show);
      if (!show) return;
      var list = publishedEvents()
        .slice()
        .sort(function (a, b) {
          var da = a.date ? new Date(a.date).getTime() : 0;
          var db = b.date ? new Date(b.date).getTime() : 0;
          if (da !== db) return da - db;
          return String(a.title || '').localeCompare(String(b.title || ''));
        });
      var preferred = String(state.eventId || '');
      elEvent.innerHTML = '';
      if (!list.length) {
        var empty = document.createElement('option');
        empty.value = preferred || '';
        empty.textContent = preferred ? 'Published event (loading…)' : 'No published events yet';
        elEvent.appendChild(empty);
        if (!preferred) state.eventImagePosition = '';
        return;
      }
      list.forEach(function (ev) {
        var option = document.createElement('option');
        option.value = ev.id;
        option.textContent = eventOptionLabel(ev);
        elEvent.appendChild(option);
      });
      var inList = list.some(function (ev) {
        return String(ev.id) === preferred;
      });
      if (inList) {
        elEvent.value = preferred;
        state.eventId = preferred;
      } else if (preferred) {
        // Prefill can race ahead of bootstrap — keep the id and show a temporary row.
        var pending = document.createElement('option');
        pending.value = preferred;
        pending.textContent = 'Selected event (loading…)';
        elEvent.insertBefore(pending, elEvent.firstChild);
        elEvent.value = preferred;
        state.eventId = preferred;
      } else {
        elEvent.value = list[0].id;
        state.eventId = list[0].id;
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

    function applyEventToFields() {
      var event = currentEvent();
      if (!event) return;
      var eventGroupId = event.organiserGroupId || event.organiser_id || event.groupId || '';
      if (eventGroupId) {
        state.groupId = String(eventGroupId);
        elGroup.value = state.groupId;
      }
      state.line1 = event.title || 'New event';
      state.line2 = eventDateLine(event);
      state.line3 = [eventPlaceLine(event), 'Buy tickets now'].filter(Boolean).join(' · ');
      elLine1.value = state.line1;
      elLine2.value = state.line2;
      elLine3.value = state.line3;
      state.eventImageUrl = event.imageUrl || event.photoUrl || event.photo_url || '';
      state.eventImagePosition = String(event.imagePosition || event.photoPosition || '').trim();
      state.eventImageImg = null;
      applyGroupToFields(false);
    }

    function syncThumbSelection() {
      syncCaptionOptions();
    }

    function currentCaptionText() {
      if (state.customCaption) return String(state.captionText || elCaptionEdit.value || '').trim();
      return buildCaption(currentTemplate(), captionPayload());
    }

    function fillCaptionFromTemplate() {
      if (state.customCaption) return;
      state.captionText = buildCaption(currentTemplate(), captionPayload());
      if (elCaptionEdit) elCaptionEdit.value = state.captionText;
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
        if (isEventTemplate(tpl) && currentEvent()) {
          applyEventToFields();
          return;
        }
        state.line1 = tpl.line1;
        state.line2 = tpl.line2;
        state.line3 = tpl.line3;
        elLine1.value = state.line1;
        elLine2.value = state.line2;
        elLine3.value = state.line3;
      }
    }

    function updateCaptionPreview() {
      if (state.customCaption) {
        if (elCaptionEdit && document.activeElement !== elCaptionEdit) {
          elCaptionEdit.value = state.captionText || '';
        }
        return;
      }
      fillCaptionFromTemplate();
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
      var bg = currentBackground();
      var useDark = Boolean(bg.dark);
      if (useDark) {
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

    async function ensureEventImage() {
      if (!isEventTemplate()) {
        state.eventImageImg = null;
        state.eventImagePosition = '';
        return null;
      }
      var event = currentEvent();
      if (event) {
        state.eventImagePosition = String(event.imagePosition || event.photoPosition || '').trim();
      }
      var url =
        (event && (event.imageUrl || event.photoUrl || event.photo_url)) || state.eventImageUrl || '';
      if (!url) {
        state.eventImageImg = null;
        return null;
      }
      if (state.eventImageImg && state.eventImageUrl === url) return state.eventImageImg;
      state.eventImageUrl = url;
      try {
        state.eventImageImg = await loadImage(url, true);
      } catch (e) {
        state.eventImageImg = null;
        setStatus('The event photo could not be loaded into the post preview.', true);
      }
      return state.eventImageImg;
    }

    function paintOpts(tpl, quietBrand, hubImg) {
      var event = !quietBrand && isEventTemplate(tpl) ? currentEvent() : null;
      var position = '';
      if (event) {
        position = String(event.imagePosition || event.photoPosition || '').trim();
      }
      if (!position) position = String(state.eventImagePosition || '').trim();
      return {
        template: tpl,
        background: currentBackground(),
        displayName: quietBrand ? tpl.label : state.displayName || elName.value,
        line1: quietBrand ? tpl.line1 : state.line1,
        line2: quietBrand ? tpl.line2 : state.line2,
        line3: quietBrand ? tpl.line3 : state.line3,
        orgLogoImg: quietBrand ? null : state.orgLogoImg,
        eventImageImg: quietBrand ? null : state.eventImageImg,
        eventImagePosition: position,
        hubLogoImg: hubImg || null,
        quietBrand: quietBrand,
      };
    }

    async function renderPreview() {
      if (state.rendering) {
        state.renderPending = true;
        return;
      }
      state.rendering = true;
      try {
        var tpl = currentTemplate();
        var hubImg = await ensureHubLogo(tpl);
        await ensureOrgLogo();
        await ensureEventImage();
        state.line1 = elLine1.value;
        state.line2 = elLine2.value;
        state.line3 = elLine3.value;
        state.displayName = elName.value;
        paintPost(ctx, paintOpts(tpl, false, hubImg));
        updateCaptionPreview();
      } finally {
        state.rendering = false;
        if (state.renderPending) {
          state.renderPending = false;
          renderPreview();
        }
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
        setStatus('Downloaded — attach this picture when you post on LinkedIn.');
      });
    }

    function copyCaption() {
      if (isOppTemplate() && !hasLiveListings()) {
        setStatus('Publish a live business opportunity listing before copying this caption.', true);
        return;
      }
      var text = currentCaptionText();
      if (!text) {
        setStatus('Add a caption before copying.', true);
        return;
      }
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
      setStatus('Text copied — paste it into your LinkedIn post along with the picture.');
    }

    function copyCaptionAndOpenLinkedIn() {
      if (isOppTemplate() && !hasLiveListings()) {
        setStatus('Publish a live business opportunity listing before copying this post.', true);
        return;
      }
      var text = currentCaptionText();
      if (!text) {
        setStatus('Add some post text first — pick a ready-made option or type your own.', true);
        return;
      }
      var btn = root.querySelector('#post-linkedin-primary');
      var done = function () {
        if (!btn) return;
        var prev = btn.textContent;
        btn.textContent = 'Copied — opening LinkedIn…';
        setTimeout(function () {
          btn.textContent = prev;
        }, 2500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {
          window.prompt('Copy this text:', text);
        });
      } else {
        window.prompt('Copy this text:', text);
        done();
      }
      window.open('https://www.linkedin.com/feed/', '_blank', 'noopener,noreferrer');
      setStatus('Text copied. On LinkedIn, click Start a post, paste the text, and attach your downloaded picture.');
    }

    function selectCategory(categoryId) {
      var cat = CATEGORIES.find(function (c) {
        return c.id === categoryId;
      });
      if (!cat) return;
      if (categoryId === 'opportunities' && !hasLiveListings()) {
        setStatus('Publish a live business opportunity listing to unlock these captions.', true);
        syncOpportunityGate();
        return;
      }
      state.categoryId = categoryId;
      state.customCaption = false;
      var tpl = defaultTemplateForCategory(categoryId);
      selectTemplate(tpl.id, { fromCategory: true });
    }

    function selectCustomCaption() {
      state.customCaption = true;
      if (!String(state.captionText || '').trim()) {
        state.captionText = buildCaption(currentTemplate(), captionPayload());
      }
      if (elCaptionEdit) {
        elCaptionEdit.value = state.captionText;
        elCaptionEdit.focus();
      }
      syncCaptionOptions();
      refresh();
    }

    function selectTemplate(id, flags) {
      var tpl = TEMPLATES.find(function (t) {
        return t.id === id;
      });
      if (!tpl) return;
      if (tpl.group === 'opportunities' && !hasLiveListings()) {
        setStatus('Publish a live business opportunity listing to unlock these captions.', true);
        return;
      }
      if (flags && flags.skipResetIfSame && state.templateId === id && !state.customCaption) {
        refresh();
        return;
      }
      state.categoryId = tpl.group;
      state.templateId = id;
      state.customCaption = false;
      state.line1 = tpl.line1;
      state.line2 = tpl.line2;
      state.line3 = tpl.line3;
      elLine1.value = state.line1;
      elLine2.value = state.line2;
      elLine3.value = state.line3;
      if (!state.backgroundTouched) {
        state.backgroundId = defaultBackgroundIdForTemplate(tpl);
        syncBackgroundSelection();
      }
      syncCategoryTabs();
      syncListingField();
      syncEventField();
      if (isEventTemplate(tpl) && currentEvent()) applyEventToFields();
      else applyGroupToFields(false);
      fillCaptionFromTemplate();
      syncCaptionOptions();
      refresh();
    }

    root.addEventListener('click', function (e) {
      var catBtn = e.target.closest('[data-category-id]');
      if (catBtn && root.contains(catBtn)) {
        selectCategory(catBtn.getAttribute('data-category-id'));
        return;
      }
      var bgBtn = e.target.closest('[data-background-id]');
      if (bgBtn && root.contains(bgBtn)) {
        selectBackground(bgBtn.getAttribute('data-background-id'));
        return;
      }
      var customBtn = e.target.closest('[data-caption-custom]');
      if (customBtn && root.contains(customBtn)) {
        selectCustomCaption();
        return;
      }
      var captionBtn = e.target.closest('[data-template-id]');
      if (captionBtn && root.contains(captionBtn) && !captionBtn.disabled) {
        selectTemplate(captionBtn.getAttribute('data-template-id'));
      }
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
    elEvent.addEventListener('change', function () {
      state.eventId = elEvent.value;
      applyEventToFields();
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
    elCaptionEdit.addEventListener('input', function () {
      state.customCaption = true;
      state.captionText = elCaptionEdit.value;
      syncCaptionOptions();
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
    root.querySelector('#post-linkedin-primary').addEventListener('click', copyCaptionAndOpenLinkedIn);
    root.querySelector('#post-reset').addEventListener('click', function () {
      state.customCaption = false;
      applyGroupToFields(true);
      fillCaptionFromTemplate();
      syncCaptionOptions();
      refresh();
    });

    function hydrate() {
      syncGroupOptions();
      syncCategoryTabs();
      syncOpportunityGate();
      syncListingField();
      syncEventField();
      syncBackgroundSelection();
      if (isEventTemplate() && currentEvent()) applyEventToFields();
      else applyGroupToFields(true);
      elLine1.value = state.line1;
      elLine2.value = state.line2;
      elLine3.value = state.line3;
      elName.value = state.displayName;
      fillCaptionFromTemplate();
      syncCaptionOptions();
      refresh();
    }

    hydrate();

    return {
      refreshGroups: function () {
        syncGroupOptions();
        syncOpportunityGate();
        syncListingField();
        syncEventField();
        if (isEventTemplate() && currentEvent()) applyEventToFields();
        else applyGroupToFields(false);
        refresh();
      },
      refreshOpportunities: function () {
        syncOpportunityGate();
        syncListingField();
        applyGroupToFields(false);
        refresh();
      },
      refreshEvents: function () {
        syncEventField();
        if (isEventTemplate() && currentEvent()) applyEventToFields();
        refresh();
      },
      prefillEvent: function (eventId) {
        state.eventId = String(eventId || '');
        selectTemplate('new_event');
        syncEventField();
        if (currentEvent()) applyEventToFields();
        fillCaptionFromTemplate();
        refresh();
      },
      refresh: refresh,
      templates: TEMPLATES,
      backgrounds: BACKGROUNDS,
    };
  }

  global.HubLinkedInPostBuilder = {
    init: initLinkedInPostBuilder,
    templates: TEMPLATES,
    backgrounds: BACKGROUNDS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
