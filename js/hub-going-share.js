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
    return siteOrigin() + '/assets/logo-nav-transparent.png';
  }

  function eventPageUrl(ev) {
    if (ev && ev.slug) return siteOrigin() + '/events/' + encodeURIComponent(ev.slug);
    if (ev && ev.id) return siteOrigin() + '/events/event?id=' + encodeURIComponent(ev.id);
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
      ' via @The Networker Hub! Anyone else from my network going?'
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
    let imageUrl = String((ev && ev.imageUrl) || '').trim();
    if (global.getEventImage) {
      imageUrl = global.getEventImage({
        photo: imageUrl,
        organiserLogo: (ev && ev.organiserLogo) || '',
        id: (ev && ev.id) || '',
        eventType: (ev && ev.eventType) || '',
        title: (ev && ev.title) || '',
      });
    } else if (global.getFlexibleEventImage) {
      imageUrl = global.getFlexibleEventImage(
        imageUrl,
        (ev && ev.organiserLogo) || '',
        (ev && ev.id) || ''
      );
    }
    return String(imageUrl || '').trim();
  }

  function drawCoverImage(ctx, img, x, y, w, h) {
    if (!img) {
      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, '#9d60a7');
      grad.addColorStop(1, '#7a3d8a');
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, w, h, 24);
      ctx.fill();
      return;
    }
    ctx.save();
    roundRect(ctx, x, y, w, h, 24);
    ctx.clip();
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
    ctx.save();
    roundRect(ctx, x, y, w, h, 24);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  async function generateGoingCardDataUrl(ev) {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    bg.addColorStop(0, '#2d1b5e');
    bg.addColorStop(0.55, '#4a2d6e');
    bg.addColorStop(1, '#7a3d8a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, 56, 56, CARD_W - 112, CARD_H - 112, 28);
    ctx.fill();

    const imageUrl = resolveEventImageUrl(ev);
    const [eventImg, hubLogo] = await Promise.all([loadImage(imageUrl), loadImage(hubLogoUrl())]);

    const imgX = 88;
    const imgY = 88;
    const imgW = 460;
    const imgH = CARD_H - 176;
    drawCoverImage(ctx, eventImg, imgX, imgY, imgW, imgH);

    const textX = 600;
    const textMaxW = CARD_W - textX - 72;

    ctx.fillStyle = '#bd932e';
    roundRect(ctx, textX, 108, 248, 52, 26);
    ctx.fill();
    ctx.fillStyle = '#2d1b3d';
    ctx.font = '700 22px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText("I'm attending", textX + 24, 134);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 46px "DM Sans", system-ui, sans-serif';
    const titleLines = wrapLines(ctx, (ev && ev.title) || 'Event', textMaxW, 3);
    let titleY = 210;
    titleLines.forEach(function (line) {
      ctx.fillText(line, textX, titleY);
      titleY += 54;
    });

    const dateLabel = formatShareDate(ev && ev.starts_at);
    if (dateLabel) {
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.font = '500 28px "DM Sans", system-ui, sans-serif';
      ctx.fillText(truncateText(ctx, dateLabel, textMaxW), textX, titleY + 20);
    }

    const location = String((ev && ev.location) || '').trim();
    if (location) {
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = '500 24px "DM Sans", system-ui, sans-serif';
      ctx.fillText(truncateText(ctx, location, textMaxW), textX, titleY + 58);
    }

    const footerY = CARD_H - 96;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(88, footerY - 28, CARD_W - 176, 1);

    if (hubLogo) {
      ctx.drawImage(hubLogo, 88, footerY, 120, 48);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '600 24px "DM Sans", system-ui, sans-serif';
    ctx.fillText('The Networker Hub', hubLogo ? 224 : 88, footerY + 30);

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

  global.HubGoingShare = {
    buildAttendeeCaption: buildAttendeeCaption,
    generateGoingCardDataUrl: generateGoingCardDataUrl,
    downloadPngDataUrl: downloadPngDataUrl,
    eventPageUrl: eventPageUrl,
    formatShareDate: formatShareDate,
    safeFilename: safeFilename,
  };
})(typeof window !== 'undefined' ? window : global);
