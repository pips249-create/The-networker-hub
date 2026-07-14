/**
 * Minimal PDF 1.4 helpers (no external PDF dependency).
 * Coordinates use PDF space: origin bottom-left, units in points.
 */

function escapePdfText(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
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
 * @param {Array<{width?:number,height?:number,items:Array<{x:number,y:number,size?:number,font?:'F1'|'F2',text:string}>}>} pages
 */
function buildPositionedPdf(pages) {
  const built = (pages || []).map((page) => {
    const width = page.width || 595.28;
    const height = page.height || 841.89;
    const parts = ['BT'];
    let currentFont = '';
    let currentSize = 0;
    (page.items || []).forEach((item) => {
      const text = String(item.text || '').slice(0, 80);
      if (!text) return;
      const font = item.font === 'F2' ? 'F2' : 'F1';
      const size = item.size || 11;
      if (font !== currentFont || size !== currentSize) {
        parts.push('/' + font + ' ' + size + ' Tf');
        currentFont = font;
        currentSize = size;
      }
      parts.push('1 0 0 1 ' + Number(item.x).toFixed(2) + ' ' + Number(item.y).toFixed(2) + ' Tm');
      parts.push('(' + escapePdfText(text) + ') Tj');
    });
    parts.push('ET');
    return { width, height, stream: parts.join('\n') };
  });
  return assemblePdf(built, true);
}

function assemblePdf(pages, withBold) {
  const objects = [];
  const pageObjectIndexes = [];

  objects.push(null); // 1 catalog placeholder
  objects.push(null); // 2 pages placeholder

  const fontRegularIndex = objects.length;
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n');
  let fontBoldIndex = fontRegularIndex;
  if (withBold) {
    fontBoldIndex = objects.length;
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\n');
  }

  pages.forEach((page) => {
    const stream = page.stream || '';
    const streamLength = Buffer.byteLength(stream, 'utf8');
    const contentIndex = objects.length;
    objects.push('<< /Length ' + streamLength + ' >>\nstream\n' + stream + '\nendstream\n');
    const pageIndex = objects.length;
    pageObjectIndexes.push(pageIndex);
    const resources =
      '<< /Font << /F1 ' +
      (fontRegularIndex + 1) +
      ' 0 R' +
      (withBold ? ' /F2 ' + (fontBoldIndex + 1) + ' 0 R' : '') +
      ' >> >>';
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

  let body = '%PDF-1.4\n';
  const offs = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offs.push(Buffer.byteLength(body, 'utf8'));
    body += i + 1 + ' 0 obj\n' + objects[i] + 'endobj\n';
  }

  const xrefOffset = Buffer.byteLength(body, 'utf8');
  body += 'xref\n0 ' + (objects.length + 1) + '\n';
  body += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    body += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  }
  body += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\n';
  body += 'startxref\n' + xrefOffset + '\n%%EOF';
  return Buffer.from(body, 'utf8');
}

module.exports = {
  escapePdfText,
  buildSimpleTextPdf,
  buildPositionedPdf,
};
