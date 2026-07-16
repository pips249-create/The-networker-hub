/**
 * "I'm attending" social card image + LinkedIn-ready caption for events.
 */
(function (global) {
  const CARD_W = 1200;
  const CARD_H = 630;

  function siteOrigin() {
    const origin = String(global.location && global.location.origin ? global.location.origin : '').replace(
      /\/$/,
      ''
    );
    return origin || 'https://www.thenetworkerhub.com';
  }

  function hubLogoUrl() {
    return siteOrigin() + '/assets/logo-nav.png';
  }

  function eventPageUrl(ev) {
    if (ev && ev.slug) return siteOrigin() + '/events/' + encodeURIComponent(ev.slug);
    if (ev && ev.id) return siteOrigin() + '/events/' + encodeURIComponent(ev.id);
    return siteOrigin() + '/events/';
  }

  function formatShareDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  function buildAttendeeCaption(ev) {
    const title = String((ev && ev.title) || 'this event').trim();
    const date = formatShareDate(ev && ev.starts_at);
    const datePart = date ? ' on ' + date : '';
    return (
      'Looking forward to connecting with local businesses at ' +
      title +
      datePart +
      '! Joining via @The Networker Hub — anyone else from my network going?'
    );
  }

  function loadImage(url) {
    return new Promise(function (resolve) {
      const src = String(url || '').trim();
      if (!src) {
        resolve(null);
        return;
      }
      const img = new Image();
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

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function truncateText(ctx, text, maxWidth) {
    let value = String(text || '');
    if (ctx.measureText(value).width <= maxWidth) return value;
    while (value.length > 1 && ctx.measureText(value + '…').width > maxWidth) {
      value = value.slice(0, -1);
    }
    return value + '…';
  }

  function wrapLines(ctx, text, maxWidth, maxLines) {
    const words = String(text || '').trim().split(/\s+/);
    const lines = [];
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = words[i];
        if (lines.length >= maxLines - 1) break;
      }
    }
    if (line) lines.push(line);
    if (words.length && lines.length >= maxLines) {
      lines[maxLines - 1] = truncateText(ctx, lines[maxLines - 1], maxWidth);
    }
    return lines;
  }

  function resolveEventImageUrl(ev) {
    const direct = String((ev && ev.imageUrl) || '').trim();
    const logo = String((ev && ev.organiserLogo) || '').trim();
    if (direct && logo && direct === logo) return logo;
    if (direct) return direct;
    return logo;
  }

  function isLikelyLogo(img, url, ev) {
    if (global.hubIsLogoStyleCover && global.hubIsLogoStyleCover(ev || {}, url)) return true;
    if (!img) return false;
    const ratio = img.width / Math.max(1, img.height);
    return ratio > 0.75 && ratio < 1.35 && img.width < 900;
  }

  function drawContainedImage(ctx, img, x, y, w, h) {
    if (!img) return;
    const scale = Math.min(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function parseImagePosition(raw) {
    const m = String(raw || '')
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
    ctx.save();
    roundRect(ctx, x, y, w, h, 20);
    ctx.clip();
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    // Match CSS object-position: align the chosen focal point of the image with the frame.
    const pos = parseImagePosition(position) || { x: 0.5, y: 0.5 };
    const dx = x + (w - dw) * pos.x;
    const dy = y + (h - dh) * pos.y;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  async function generateGoingCardDataUrl(ev) {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    bg.addColorStop(0, '#faf6ee');
    bg.addColorStop(0.55, '#f5f0e8');
    bg.addColorStop(1, '#ebe0f0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    ctx.fillStyle = '#bd932e';
    ctx.fillRect(0, 0, CARD_W, 14);

    ctx.fillStyle = 'rgba(157, 96, 167, 0.12)';
    ctx.beginPath();
    ctx.arc(1080, 120, 200, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(45, 27, 94, 0.06)';
    ctx.beginPath();
    ctx.arc(120, 560, 240, 0, Math.PI * 2);
    ctx.fill();

    const imageUrl = resolveEventImageUrl(ev);
    const logoUrl = String((ev && ev.organiserLogo) || '').trim();
    const [eventImg, orgLogoImg, hubLogo] = await Promise.all([
      loadImage(imageUrl),
      loadImage(logoUrl && logoUrl !== imageUrl ? logoUrl : ''),
      loadImage(hubLogoUrl()),
    ]);

    const logoImg = orgLogoImg || (isLikelyLogo(eventImg, imageUrl, ev) ? eventImg : null);
    const photoImg = logoImg && eventImg === logoImg ? null : eventImg;

    // Soft white content panel
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    roundRect(ctx, 64, 56, CARD_W - 128, CARD_H - 148, 24);
    ctx.fill();

    let textX = 100;
    let textMaxW = CARD_W - 200;

    if (photoImg) {
      drawCoverImage(ctx, photoImg, 88, 88, 420, 380, ev && ev.imagePosition);
      textX = 560;
      textMaxW = CARD_W - textX - 96;
    } else if (logoImg) {
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, 100, 100, 200, 200, 28);
      ctx.fill();
      ctx.strokeStyle = 'rgba(45, 27, 94, 0.08)';
      ctx.lineWidth = 2;
      roundRect(ctx, 100, 100, 200, 200, 28);
      ctx.stroke();
      drawContainedImage(ctx, logoImg, 124, 124, 152, 152);
      textX = 360;
      textMaxW = CARD_W - textX - 100;
    }

    // Badge
    const badgeLabel = "I'm attending";
    ctx.font = '700 22px "DM Sans", system-ui, sans-serif';
    const badgeW = Math.ceil(ctx.measureText(badgeLabel).width) + 40;
    ctx.fillStyle = '#bd932e';
    roundRect(ctx, textX, 108, badgeW, 44, 22);
    ctx.fill();
    ctx.fillStyle = '#2d1b3d';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeLabel, textX + 20, 130);

    // Title
    ctx.fillStyle = '#2d1b5e';
    ctx.font = '700 48px "DM Sans", system-ui, sans-serif';
    const titleLines = wrapLines(ctx, (ev && ev.title) || 'Event', textMaxW, 3);
    let titleY = 210;
    titleLines.forEach(function (line) {
      ctx.fillText(line, textX, titleY);
      titleY += 56;
    });

    const organiser = String((ev && ev.organiserName) || '').trim();
    const title = String((ev && ev.title) || '').trim();
    if (organiser && organiser.toLowerCase() !== title.toLowerCase()) {
      ctx.fillStyle = '#5a4a62';
      ctx.font = '600 24px "DM Sans", system-ui, sans-serif';
      ctx.fillText(truncateText(ctx, 'Hosted by ' + organiser, textMaxW), textX, titleY + 8);
      titleY += 40;
    }

    const dateLabel = formatShareDate(ev && ev.starts_at);
    const location = String((ev && ev.location) || '').trim();
    const meta = [dateLabel, location].filter(Boolean).join('  ·  ');
    if (meta) {
      ctx.fillStyle = '#5a4a62';
      ctx.font = '500 26px "DM Sans", system-ui, sans-serif';
      ctx.fillText(truncateText(ctx, meta, textMaxW), textX, titleY + 28);
    }

    // Footer brand strip
    ctx.fillStyle = 'rgba(45, 27, 94, 0.08)';
    ctx.fillRect(64, CARD_H - 78, CARD_W - 128, 1);

    if (hubLogo) {
      drawContainedImage(ctx, hubLogo, 96, CARD_H - 64, 140, 40);
    }
    ctx.fillStyle = '#5a4a62';
    ctx.font = '600 22px "DM Sans", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('The Networker Hub', hubLogo ? 250 : 96, CARD_H - 44);

    ctx.fillStyle = '#9d87aa';
    ctx.font = '500 20px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('thenetworkerhub.com', CARD_W - 96, CARD_H - 44);
    ctx.textAlign = 'left';

    return canvas.toDataURL('image/png');
  }

  function downloadPngDataUrl(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename || 'im-attending.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function safeFilename(title) {
    return (
      String(title || 'event')
        .replace(/[^a-z0-9]+/gi, '-')
        .toLowerCase()
        .replace(/^-+|-+$/g, '') || 'event'
    );
  }

  function buildOrganiserPromoCaption(ev, listingUrl) {
    if (global.HubCommsPack && global.HubCommsPack.buildEventCommsPack) {
      return global.HubCommsPack.buildEventCommsPack(
        {
          title: ev && ev.title,
          date: formatShareDate(ev && (ev.starts_at || ev.date || ev.dateLine)),
          location: ev && ev.location,
          description: ev && ev.description,
        },
        listingUrl
      ).caption;
    }
    const title = String((ev && ev.title) || 'Our event').trim();
    const url = String(listingUrl || '').trim();
    return (
      "We've just added a new event:\n\n📅 " +
      title +
      '\n\nBuy tickets now on The Networker Hub:\n' +
      url
    );
  }

  async function generateOrganiserPromoCardDataUrl(ev) {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    bg.addColorStop(0, '#faf6ee');
    bg.addColorStop(0.55, '#f5f0e8');
    bg.addColorStop(1, '#ebe0f0');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    ctx.fillStyle = '#9a7aa8';
    ctx.fillRect(0, 0, CARD_W, 14);

    ctx.fillStyle = 'rgba(154, 122, 168, 0.12)';
    ctx.beginPath();
    ctx.arc(1080, 120, 200, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(45, 27, 94, 0.06)';
    ctx.beginPath();
    ctx.arc(120, 560, 240, 0, Math.PI * 2);
    ctx.fill();

    const imageUrl = resolveEventImageUrl(ev);
    const logoUrl = String((ev && ev.organiserLogo) || '').trim();
    const [eventImg, orgLogoImg, hubLogo] = await Promise.all([
      loadImage(imageUrl),
      loadImage(logoUrl && logoUrl !== imageUrl ? logoUrl : ''),
      loadImage(hubLogoUrl()),
    ]);

    const logoImg = orgLogoImg || (isLikelyLogo(eventImg, imageUrl, ev) ? eventImg : null);
    const photoImg = logoImg && eventImg === logoImg ? null : eventImg;

    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    roundRect(ctx, 64, 56, CARD_W - 128, CARD_H - 148, 24);
    ctx.fill();

    let textX = 100;
    let textMaxW = CARD_W - 200;

    if (photoImg) {
      drawCoverImage(ctx, photoImg, 88, 88, 420, 380, ev && (ev.imagePosition || ev.photoPosition));
      textX = 560;
      textMaxW = CARD_W - textX - 96;
    } else if (logoImg) {
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, 100, 100, 200, 200, 28);
      ctx.fill();
      ctx.strokeStyle = 'rgba(45, 27, 94, 0.08)';
      ctx.lineWidth = 2;
      roundRect(ctx, 100, 100, 200, 200, 28);
      ctx.stroke();
      drawContainedImage(ctx, logoImg, 124, 124, 152, 152);
      textX = 360;
      textMaxW = CARD_W - textX - 100;
    }

    const badgeLabel = 'NEW EVENT';
    ctx.font = '700 22px "DM Sans", system-ui, sans-serif';
    const badgeW = Math.ceil(ctx.measureText(badgeLabel).width) + 40;
    ctx.fillStyle = '#9a7aa8';
    roundRect(ctx, textX, 108, badgeW, 44, 22);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeLabel, textX + 20, 130);

    ctx.fillStyle = '#2d1b5e';
    ctx.font = '700 48px "DM Sans", system-ui, sans-serif';
    const titleLines = wrapLines(ctx, (ev && ev.title) || 'Event', textMaxW, 3);
    let titleY = 210;
    titleLines.forEach(function (line) {
      ctx.fillText(line, textX, titleY);
      titleY += 56;
    });

    const organiser = String((ev && (ev.organiserName || ev.groupName)) || '').trim();
    const title = String((ev && ev.title) || '').trim();
    if (organiser && organiser.toLowerCase() !== title.toLowerCase()) {
      ctx.fillStyle = '#5a4a62';
      ctx.font = '600 24px "DM Sans", system-ui, sans-serif';
      ctx.fillText(truncateText(ctx, 'Hosted by ' + organiser, textMaxW), textX, titleY + 8);
      titleY += 40;
    }

    const dateLabel = formatShareDate(ev && (ev.starts_at || ev.date || ev.dateLine));
    const location = String((ev && ev.location) || '').trim();
    const meta = [dateLabel, location].filter(Boolean).join('  ·  ');
    if (meta) {
      ctx.fillStyle = '#5a4a62';
      ctx.font = '500 26px "DM Sans", system-ui, sans-serif';
      ctx.fillText(truncateText(ctx, meta, textMaxW), textX, titleY + 28);
    }

    ctx.fillStyle = '#5a4a62';
    ctx.font = '500 24px "DM Sans", system-ui, sans-serif';
    ctx.fillText('Book on The Networker Hub', textX, titleY + 72);

    ctx.fillStyle = 'rgba(45, 27, 94, 0.08)';
    ctx.fillRect(64, CARD_H - 78, CARD_W - 128, 1);

    if (hubLogo) {
      drawContainedImage(ctx, hubLogo, 96, CARD_H - 64, 140, 40);
    }
    ctx.fillStyle = '#5a4a62';
    ctx.font = '600 22px "DM Sans", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('The Networker Hub', hubLogo ? 250 : 96, CARD_H - 44);

    ctx.fillStyle = '#9d87aa';
    ctx.font = '500 20px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('thenetworkerhub.com', CARD_W - 96, CARD_H - 44);
    ctx.textAlign = 'left';

    return canvas.toDataURL('image/png');
  }

  global.HubGoingShare = {
    buildAttendeeCaption: buildAttendeeCaption,
    buildOrganiserPromoCaption: buildOrganiserPromoCaption,
    generateGoingCardDataUrl: generateGoingCardDataUrl,
    generateOrganiserPromoCardDataUrl: generateOrganiserPromoCardDataUrl,
    downloadPngDataUrl: downloadPngDataUrl,
    eventPageUrl: eventPageUrl,
    formatShareDate: formatShareDate,
    safeFilename: safeFilename,
  };

  global.HubOrganiserEventShare = {
    buildPromoCaption: buildOrganiserPromoCaption,
    generatePromoCardDataUrl: generateOrganiserPromoCardDataUrl,
    downloadPngDataUrl: downloadPngDataUrl,
    safeFilename: safeFilename,
    formatShareDate: formatShareDate,
  };
})(typeof window !== 'undefined' ? window : global);
