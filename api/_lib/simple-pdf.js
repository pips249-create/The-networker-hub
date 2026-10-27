/**
 * Minimal PDF 1.4 helpers (no external PDF dependency).
 * Coordinates use PDF space: origin bottom-left, units in points.
 * Helvetica is declared with WinAnsiEncoding; text is mapped + octal-escaped
 * so UTF-8 source strings (em dashes, £, ×, etc.) render correctly.
 * JPEG images can be embedded as XObjects (prepare with sharp elsewhere).
 */

/** Windows-1252 / WinAnsi codepoints that differ from Unicode. */
const WINANSI_FROM_UNICODE = {
  0x20ac: 0x80, // €
  0x201a: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201e: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02c6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8a, // Š
  0x2039: 0x8b, // ‹
  0x0152: 0x8c, // Œ
  0x017d: 0x8e, // Ž
  0x2018: 0x91, // ‘
  0x2019: 0x92, // ’
  0x201c: 0x93, // “
  0x201d: 0x94, // ”
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02dc: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9a, // š
  0x203a: 0x9b, // ›
  0x0153: 0x9c, // œ
  0x017e: 0x9e, // ž
  0x0178: 0x9f, // Ÿ
};

function toWinAnsiChar(codePoint) {
  if (codePoint === 0x00d7) return 0xd7; // ×
  if (codePoint === 0x00a3) return 0xa3; // £
  if (codePoint === 0x00a0) return 0x20; // nbsp → space
  if (codePoint === 0x2212) return 0x2d; // minus → hyphen
  if (Object.prototype.hasOwnProperty.call(WINANSI_FROM_UNICODE, codePoint)) {
    return WINANSI_FROM_UNICODE[codePoint];
  }
  if (codePoint <= 0xff) return codePoint;
  return 0x3f; // unmapped → ?
}

function escapePdfText(text) {
  const raw = String(text || '');
  let out = '';
  for (let i = 0; i < raw.length; i += 1) {
    const cp = raw.charCodeAt(i);
    // Skip UTF-16 surrogate halves; treat unpaired as '?'
    if (cp >= 0xd800 && cp <= 0xdbff) {
      const next = raw.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        i += 1;
        out += '?';
        continue;
      }
      out += '?';
      continue;
    }
    if (cp >= 0xdc00 && cp <= 0xdfff) {
      out += '?';
      continue;
    }
    const b = toWinAnsiChar(cp);
    if (b === 0x5c) out += '\\\\';
    else if (b === 0x28) out += '\\(';
    else if (b === 0x29) out += '\\)';
    else if (b === 0x0a) out += '\\n';
    else if (b === 0x0d) out += '\\r';
    else if (b === 0x09) out += '\\t';
    else if (b < 0x20 || b > 0x7e) out += '\\' + b.toString(8).padStart(3, '0');
    else out += String.fromCharCode(b);
  }
  return out;
}

function rgbComponents(color, fallback) {
  if (Array.isArray(color) && color.length >= 3) {
    return [
      Math.max(0, Math.min(1, Number(color[0]) || 0)),
      Math.max(0, Math.min(1, Number(color[1]) || 0)),
      Math.max(0, Math.min(1, Number(color[2]) || 0)),
    ];
  }
  const hex = String(color || '').trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (m) {
    const n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  return fallback || [0, 0, 0];
}

function formatRgb(components) {
  return (
    components[0].toFixed(3) +
    ' ' +
    components[1].toFixed(3) +
    ' ' +
    components[2].toFixed(3)
  );
}

function approxTextWidth(text, fontSize) {
  // Helvetica average glyph width ~0.5em; good enough for wrapping/truncation.
  return String(text || '').length * fontSize * 0.5;
}

function truncateToWidth(text, fontSize, maxWidth) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  if (approxTextWidth(raw, fontSize) <= maxWidth) return raw;
  let out = raw;
  while (out.length > 1 && approxTextWidth(out + '…', fontSize) > maxWidth) {
    out = out.slice(0, -1);
  }
  return out.replace(/\s+$/, '') + '…';
}

function wrapText(text, fontSize, maxWidth, maxLines) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [];
  const limit = maxLines || 4;
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const trial = current ? current + ' ' + word : word;
    if (approxTextWidth(trial, fontSize) <= maxWidth || !current) {
      current = trial;
      return;
    }
    lines.push(current);
    current = word;
  });
  if (current) lines.push(current);
  if (lines.length <= limit) return lines;
  const kept = lines.slice(0, limit);
  kept[limit - 1] = truncateToWidth(kept[limit - 1], fontSize, maxWidth);
  return kept;
}

function buildSimpleTextPdf(lines, options) {
  const opts = options || {};
  const pageWidth = opts.pageWidth || 612;
  const pageHeight = opts.pageHeight || 792;
  const fontSize = opts.fontSize || 11;
  const lineHeight = opts.lineHeight || 14;
  const marginX = opts.marginX || 40;
  const marginTop = opts.marginTop || 40;

  const sanitized = (lines || []).map((line) => String(line || '').slice(0, 110));
  const startY = pageHeight - marginTop - fontSize;
  const contentParts = ['BT', '/F1 ' + fontSize + ' Tf', marginX + ' ' + startY + ' Td'];
  sanitized.forEach((line, index) => {
    if (index > 0) contentParts.push('0 -' + lineHeight + ' Td');
    contentParts.push('(' + escapePdfText(line) + ') Tj');
  });
  contentParts.push('ET');
  return assemblePdf(
    [
      {
        width: pageWidth,
        height: pageHeight,
        stream: contentParts.join('\n'),
      },
    ],
    true
  );
}

/**
 * Fit an image into a box (contain), returning draw rect bottom-left origin.
 * @param {{width:number,height:number}} image
 * @param {{x:number,y:number,w:number,h:number}} box
 */
function fitImageInBox(image, box) {
  const iw = Math.max(1, Number(image && image.width) || 1);
  const ih = Math.max(1, Number(image && image.height) || 1);
  const boxW = Math.max(1, Number(box.w) || 1);
  const boxH = Math.max(1, Number(box.h) || 1);
  const scale = Math.min(boxW / iw, boxH / ih);
  const w = iw * scale;
  const h = ih * scale;
  return {
    x: Number(box.x) + (boxW - w) / 2,
    y: Number(box.y) + (boxH - h) / 2,
    w,
    h,
  };
}

/**
 * @param {Array<{
 *   width?: number,
 *   height?: number,
 *   images?: Array<{name:string,width:number,height:number,jpeg:Buffer}>,
 *   items?: Array<object>
 * }>} pages
 */
function buildPositionedPdf(pages) {
  const built = (pages || []).map((page) => {
    const width = page.width || 595.28;
    const height = page.height || 841.89;
    const imageList = Array.isArray(page.images) ? page.images.filter(Boolean) : [];
    const imageByName = new Map();
    imageList.forEach((img, index) => {
      const name = String(img.name || 'Im' + (index + 1));
      imageByName.set(name, img);
    });

    const parts = [];
    let inText = false;
    let currentFont = '';
    let currentSize = 0;
    let currentColorKey = '';

    function endText() {
      if (inText) {
        parts.push('ET');
        inText = false;
        currentFont = '';
        currentSize = 0;
        currentColorKey = '';
      }
    }

    function beginText() {
      if (!inText) {
        parts.push('BT');
        inText = true;
      }
    }

    (page.items || []).forEach((item) => {
      if (!item) return;
      if (item.type === 'rect') {
        endText();
        const x = Number(item.x) || 0;
        const y = Number(item.y) || 0;
        const w = Number(item.w) || 0;
        const h = Number(item.h) || 0;
        parts.push('q');
        if (item.fill) {
          parts.push(formatRgb(rgbComponents(item.fill)) + ' rg');
          parts.push(
            x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re'
          );
          parts.push('f');
        }
        if (item.stroke) {
          parts.push(formatRgb(rgbComponents(item.stroke)) + ' RG');
          parts.push((Number(item.lineWidth) || 1).toFixed(2) + ' w');
          parts.push(
            x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re'
          );
          parts.push('S');
        }
        parts.push('Q');
        return;
      }

      if (item.type === 'line') {
        endText();
        const x1 = Number(item.x1) || 0;
        const y1 = Number(item.y1) || 0;
        const x2 = Number(item.x2) || 0;
        const y2 = Number(item.y2) || 0;
        parts.push('q');
        parts.push(formatRgb(rgbComponents(item.stroke, [0.6, 0.6, 0.6])) + ' RG');
        parts.push((Number(item.lineWidth) || 1).toFixed(2) + ' w');
        if (Array.isArray(item.dash) && item.dash.length) {
          parts.push(
            '[' +
              item.dash.map((n) => Number(n).toFixed(2)).join(' ') +
              '] 0 d'
          );
        }
        parts.push(x1.toFixed(2) + ' ' + y1.toFixed(2) + ' m');
        parts.push(x2.toFixed(2) + ' ' + y2.toFixed(2) + ' l');
        parts.push('S');
        parts.push('Q');
        return;
      }

      if (item.type === 'image') {
        endText();
        const name = String(item.name || '').trim();
        if (!name || !imageByName.has(name)) return;
        const x = Number(item.x) || 0;
        const y = Number(item.y) || 0;
        const w = Number(item.w) || 0;
        const h = Number(item.h) || 0;
        if (w <= 0 || h <= 0) return;
        parts.push('q');
        parts.push(
          w.toFixed(2) +
            ' 0 0 ' +
            h.toFixed(2) +
            ' ' +
            x.toFixed(2) +
            ' ' +
            y.toFixed(2) +
            ' cm'
        );
        parts.push('/' + name + ' Do');
        parts.push('Q');
        return;
      }

      const text = String(item.text || '').slice(0, 120);
      if (!text) return;
      beginText();
      const font = item.font === 'F2' ? 'F2' : 'F1';
      const size = item.size || 11;
      const color = rgbComponents(item.color, [0, 0, 0]);
      const colorKey = formatRgb(color);
      if (font !== currentFont || size !== currentSize) {
        parts.push('/' + font + ' ' + size + ' Tf');
        currentFont = font;
        currentSize = size;
      }
      if (colorKey !== currentColorKey) {
        parts.push(colorKey + ' rg');
        currentColorKey = colorKey;
      }
      parts.push(
        '1 0 0 1 ' + Number(item.x).toFixed(2) + ' ' + Number(item.y).toFixed(2) + ' Tm'
      );
      parts.push('(' + escapePdfText(text) + ') Tj');
    });
    endText();
    return {
      width,
      height,
      stream: parts.join('\n'),
      images: imageList,
    };
  });
  return assemblePdf(built, true);
}

function toObjectBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  return Buffer.from(String(value || ''), 'utf8');
}

function assemblePdf(pages, withBold) {
  const objects = [];
  const pageObjectIndexes = [];

  objects.push(null); // 1 catalog placeholder
  objects.push(null); // 2 pages placeholder

  const fontRegularIndex = objects.length;
  objects.push(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\n'
  );
  let fontBoldIndex = fontRegularIndex;
  if (withBold) {
    fontBoldIndex = objects.length;
    objects.push(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\n'
    );
  }

  pages.forEach((page) => {
    const imageEntries = [];
    (page.images || []).forEach((img, index) => {
      const name = String(img.name || 'Im' + (index + 1)).replace(/[^A-Za-z0-9]/g, '') || 'Im';
      const jpeg = Buffer.isBuffer(img.jpeg) ? img.jpeg : Buffer.from([]);
      if (!jpeg.length) return;
      const width = Math.max(1, Math.round(Number(img.width) || 1));
      const height = Math.max(1, Math.round(Number(img.height) || 1));
      const dict =
        '<< /Type /XObject /Subtype /Image /Width ' +
        width +
        ' /Height ' +
        height +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' +
        jpeg.length +
        ' >>\nstream\n';
      const objIndex = objects.length;
      objects.push(
        Buffer.concat([Buffer.from(dict, 'utf8'), jpeg, Buffer.from('\nendstream\n', 'utf8')])
      );
      imageEntries.push({ name, objectNumber: objIndex + 1 });
    });

    const stream = page.stream || '';
    const streamBuf = Buffer.from(stream, 'utf8');
    const contentIndex = objects.length;
    objects.push(
      Buffer.concat([
        Buffer.from('<< /Length ' + streamBuf.length + ' >>\nstream\n', 'utf8'),
        streamBuf,
        Buffer.from('\nendstream\n', 'utf8'),
      ])
    );
    const pageIndex = objects.length;
    pageObjectIndexes.push(pageIndex);
    let xObjectDict = '';
    if (imageEntries.length) {
      xObjectDict =
        ' /XObject << ' +
        imageEntries.map((e) => '/' + e.name + ' ' + e.objectNumber + ' 0 R').join(' ') +
        ' >>';
    }
    const resources =
      '<< /Font << /F1 ' +
      (fontRegularIndex + 1) +
      ' 0 R' +
      (withBold ? ' /F2 ' + (fontBoldIndex + 1) + ' 0 R' : '') +
      ' >>' +
      xObjectDict +
      ' >>';
    objects.push(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
        page.width +
        ' ' +
        page.height +
        '] /Contents ' +
        (contentIndex + 1) +
        ' 0 R /Resources ' +
        resources +
        ' >>\n'
    );
  });

  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>\n';
  objects[1] =
    '<< /Type /Pages /Kids [' +
    pageObjectIndexes.map((i) => i + 1 + ' 0 R').join(' ') +
    '] /Count ' +
    pageObjectIndexes.length +
    ' >>\n';

  const chunks = [Buffer.from('%PDF-1.4\n', 'utf8')];
  const offs = [0];
  let offset = chunks[0].length;
  for (let i = 0; i < objects.length; i += 1) {
    offs.push(offset);
    const head = Buffer.from(i + 1 + ' 0 obj\n', 'utf8');
    const body = toObjectBuffer(objects[i]);
    const tail = Buffer.from('endobj\n', 'utf8');
    chunks.push(head, body, tail);
    offset += head.length + body.length + tail.length;
  }

  const xrefOffset = offset;
  let xref = 'xref\n0 ' + (objects.length + 1) + '\n';
  xref += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    xref += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  }
  xref += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\n';
  xref += 'startxref\n' + xrefOffset + '\n%%EOF';
  chunks.push(Buffer.from(xref, 'utf8'));
  return Buffer.concat(chunks);
}

module.exports = {
  escapePdfText,
  approxTextWidth,
  truncateToWidth,
  wrapText,
  fitImageInBox,
  buildSimpleTextPdf,
  buildPositionedPdf,
};
