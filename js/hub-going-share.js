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
    return origin || 'https://www.thenetworkeruk.com';
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
      '! Joining via @The Networker UK — anyone else from my network going?'
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

  /** Prefer the most complete address string available on the event. */
  function formatShareLocation(ev) {
    const location = String((ev && ev.location) || '').trim();
    const venue = String((ev && ev.venue) || '').trim();
    const address = String((ev && (ev.addressLine1 || ev.address || ev.fullAddress)) || '').trim();
    const city = String((ev && ev.city) || '').trim();
    const postcode = String((ev && ev.postcode) || '').trim();

    const parts = [];
    function pushUnique(value) {
      const v = String(value || '').trim();
      if (!v) return;
      const lower = v.toLowerCase();
      if (parts.some(function (p) { return p.toLowerCase() === lower; })) return;
      if (parts.some(function (p) { return p.toLowerCase().indexOf(lower) !== -1; })) return;
      if (parts.some(function (p) { return lower.indexOf(p.toLowerCase()) !== -1; })) {
        for (let i = 0; i < parts.length; i++) {
          if (lower.indexOf(parts[i].toLowerCase()) !== -1) {
            parts[i] = v;
            return;
          }
        }
      }
      parts.push(v);
    }

    pushUnique(venue);
    pushUnique(address);
    pushUnique(city);
    pushUnique(postcode);

    const structured = parts.join(', ');
    if (structured && structured.length >= location.length) return structured;
    return location || structured;
  }

  /**
   * Draw date + address under the title. Address wraps onto multiple lines
   * so long venues are not cut off with an ellipsis.
   * Returns the y position after the last meta line.
   */
  function drawShareMeta(ctx, ev, textX, startY, textMaxW, options) {
    options = options || {};
    const dateLabel = formatShareDate(
      ev && (ev.starts_at || ev.date || ev.dateLine)
    );
    const location = formatShareLocation(ev);
    const fontSize = options.fontSize || 24;
    const lineHeight = options.lineHeight || 30;
    const maxLocLines = options.maxLocLines || 3;

    ctx.fillStyle = options.color || '#5a4a62';
    ctx.font = '500 ' + fontSize + 'px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    let y = startY;
    if (dateLabel) {
      ctx.fillText(truncateText(ctx, dateLabel, textMaxW), textX, y);
      y += lineHeight;
    }
    if (location) {
      const locLines = wrapLines(ctx, location, textMaxW, maxLocLines);
      locLines.forEach(function (line) {
        ctx.fillText(line, textX, y);
        y += lineHeight;
      });
    }
    return y;
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
    const locationHint = formatShareLocation(ev);
    const titleLines = wrapLines(
      ctx,
      (ev && ev.title) || 'Event',
      textMaxW,
      locationHint ? 2 : 3
    );
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

    drawShareMeta(ctx, ev, textX, titleY + 28, textMaxW, {
      fontSize: 26,
      lineHeight: 32,
      maxLocLines: 3,
    });

    // Footer brand strip
    ctx.fillStyle = 'rgba(45, 27, 94, 0.08)';
    ctx.fillRect(64, CARD_H - 78, CARD_W - 128, 1);

    if (hubLogo) {
      drawContainedImage(ctx, hubLogo, 96, CARD_H - 64, 140, 40);
    }
    ctx.fillStyle = '#5a4a62';
    ctx.font = '600 22px "DM Sans", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('The Networker UK', hubLogo ? 250 : 96, CARD_H - 44);

    ctx.fillStyle = '#9d87aa';
    ctx.font = '500 20px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('thenetworkeruk.com', CARD_W - 96, CARD_H - 44);
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
      return global.HubCommsPack.buildEventCommsPack(ev, listingUrl).caption;
    }
    const title = String((ev && ev.title) || 'Our event').trim();
    const url = String(listingUrl || '').trim();
    return (
      "We've just added a new event:\n\n📅 " +
      title +
      '\n\nBook your place on The Networker UK:\n' +
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
    const locationHint = formatShareLocation(ev);
    const titleLines = wrapLines(
      ctx,
      (ev && ev.title) || 'Event',
      textMaxW,
      locationHint ? 2 : 3
    );
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

    const metaBottom = drawShareMeta(ctx, ev, textX, titleY + 28, textMaxW, {
      fontSize: 24,
      lineHeight: 30,
      maxLocLines: 3,
    });

    ctx.fillStyle = '#5a4a62';
    ctx.font = '500 24px "DM Sans", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('Book on The Networker UK', textX, Math.min(metaBottom + 28, CARD_H - 110));

    ctx.fillStyle = 'rgba(45, 27, 94, 0.08)';
    ctx.fillRect(64, CARD_H - 78, CARD_W - 128, 1);

    if (hubLogo) {
      drawContainedImage(ctx, hubLogo, 96, CARD_H - 64, 140, 40);
    }
    ctx.fillStyle = '#5a4a62';
    ctx.font = '600 22px "DM Sans", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('The Networker UK', hubLogo ? 250 : 96, CARD_H - 44);

    ctx.fillStyle = '#9d87aa';
    ctx.font = '500 20px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('thenetworkeruk.com', CARD_W - 96, CARD_H - 44);
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
    formatShareLocation: formatShareLocation,
    safeFilename: safeFilename,
  };

  global.HubOrganiserEventShare = {
    buildPromoCaption: buildOrganiserPromoCaption,
    generatePromoCardDataUrl: generateOrganiserPromoCardDataUrl,
    downloadPngDataUrl: downloadPngDataUrl,
    safeFilename: safeFilename,
    formatShareDate: formatShareDate,
    formatShareLocation: formatShareLocation,
  };
})(typeof window !== 'undefined' ? window : global);
