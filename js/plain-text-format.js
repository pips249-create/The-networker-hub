/**
 * Preserve author line breaks / paragraphs when rendering plain text
 * (event descriptions, opportunity about copy, organiser bios).
 */
(function (global) {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeNewlines(text) {
    return String(text || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
  }

  function looksLikeSectionHeading(line) {
    var t = String(line || '').trim();
    if (!t || t.length > 60) return false;
    if (/[.!?;:]$/.test(t)) return false;
    if (t.split(/\s+/).length > 8) return false;
    return true;
  }

  function normalizeTextBlocks(value) {
    var chunks = [];
    if (Array.isArray(value)) {
      value.forEach(function (part) {
        if (part != null && String(part).trim()) chunks.push(String(part));
      });
    } else if (value != null && String(value).trim()) {
      chunks.push(String(value));
    }

    var blocks = [];
    chunks.forEach(function (chunk) {
      normalizeNewlines(chunk)
        .split(/\n\s*\n/)
        .forEach(function (part) {
          var cleaned = part.replace(/^\s+|\s+$/g, '');
          if (cleaned) blocks.push(cleaned);
        });
    });

    var expanded = [];
    blocks.forEach(function (block) {
      var lines = normalizeNewlines(block).split('\n');
      if (lines.length === 1) {
        expanded.push(block);
        return;
      }
      var buf = [];
      function flush() {
        if (!buf.length) return;
        expanded.push(buf.join('\n'));
        buf = [];
      }
      lines.forEach(function (line) {
        var t = line.trim();
        if (!t) {
          flush();
          return;
        }
        if (looksLikeSectionHeading(t)) {
          flush();
          expanded.push(t);
          return;
        }
        buf.push(t);
      });
      flush();
    });
    return expanded;
  }

  function plainTextToHtml(text) {
    return escapeHtml(normalizeNewlines(text)).replace(/\n/g, '<br>\n');
  }

  function formatDocument(value, options) {
    options = options || {};
    var paras = normalizeTextBlocks(value);
    if (!paras.length) return '';
    var pClass = options.paragraphClass || 'hub-plain-p';
    var hClass = options.headingClass || 'hub-plain-heading';
    return paras
      .map(function (p) {
        var isHeading = looksLikeSectionHeading(p) && p.indexOf('\n') === -1;
        return (
          '<p class="' +
          (isHeading ? hClass : pClass) +
          '">' +
          plainTextToHtml(p) +
          '</p>'
        );
      })
      .join('');
  }

  global.HubPlainTextFormat = {
    escapeHtml: escapeHtml,
    normalizeNewlines: normalizeNewlines,
    normalizeTextBlocks: normalizeTextBlocks,
    plainTextToHtml: plainTextToHtml,
    formatDocument: formatDocument,
    looksLikeSectionHeading: looksLikeSectionHeading,
  };
})(typeof window !== 'undefined' ? window : globalThis);
