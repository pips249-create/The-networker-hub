/**
 * Ensure every Hub email footer includes an Unsubscribe link (PECR / marketing law).
 * Works on template HTML ({{unsubscribe_url}}) and on already-rendered HTML.
 */

const UNSUBSCRIBE_LINK_RE = /unsubscribe/i;

const FOOTER_LINK_ANCHOR_RE =
  /(<a\s+[^>]*href="(?:\{\{contact_url\}\}|\{\{site_url\}\}\/contact)"[^>]*>Contact<\/a>\s*)(<\/p>)/i;

const FOOTER_CONTACT_RENDERED_RE =
  /(<a\s+[^>]*href="[^"]*\/contact[^"]*"[^>]*>Contact<\/a>\s*)(<\/p>)/i;

const FOOTER_INLINE_CONTACT_RE =
  /(·\s*<a\s+[^>]*href="\{\{contact_url\}\}"[^>]*>Contact<\/a>\s*)(<\/td>|<\/p>)/i;

const FOOTER_PRIVACY_TERMS_RE =
  /(<a\s+[^>]*href="\{\{privacy_url\}\}"[^>]*>Privacy<\/a>[\s\S]*?<a\s+[^>]*href="\{\{(?:terms_url|refunds_url|contact_url|hub_rules_url)\}\}[^"]*"[^>]*>[^<]+<\/a>\s*)(<\/p>)/i;

const CREAM_FOOTER_CLOSE_RE =
  /(<td[^>]*class="mobile-footer-pad"[^>]*>[\s\S]*?)(<\/td>\s*<\/tr>\s*(?:\{\{mini_sponsors_row\}\})?\s*<\/table>)/i;

const DARK_FOOTER_LINKS_MISSING_RE =
  /(<td[^>]*(?:background\s*:\s*#1c2040|background\s*:\s*#452d5c)[^>]*>[\s\S]*?<img[^>]*logo[^>]*>\s*)(<\/td>)/i;

function unsubscribeAnchor(hrefToken, linkColor) {
  const color = String(linkColor || '#9a7aa8').trim() || '#9a7aa8';
  return (
    '<a href="' +
    hrefToken +
    '" style="color:' +
    color +
    ';text-decoration:none;">Unsubscribe</a>'
  );
}

function appendUnsubscribeBeforeClose(html, beforeCloseRe, hrefToken, linkColor) {
  return String(html || '').replace(beforeCloseRe, function (_m, before, after) {
    if (UNSUBSCRIBE_LINK_RE.test(before)) return before + after;
    return before + '&nbsp;&middot;&nbsp;\n              ' + unsubscribeAnchor(hrefToken, linkColor) + '\n            ' + after;
  });
}

function linkColorNearContact(html, contactMatch) {
  const snippet = String(contactMatch || html || '');
  const fromLink = snippet.match(/style="[^"]*color:(#[0-9a-fA-F]{3,8})/i);
  if (fromLink) return fromLink[1];
  if (/background:#(?:1c2040|452d5c|0d1f3c)/i.test(html)) return '#ebe0f0';
  if (/#4aa8f0/.test(html)) return '#4aa8f0';
  return '#9a7aa8';
}

/**
 * Insert {{unsubscribe_url}} into template footers that lack it.
 */
function ensureUnsubscribePlaceholder(html) {
  let out = String(html || '');
  if (UNSUBSCRIBE_LINK_RE.test(out) && /\{\{\s*unsubscribe_url\s*\}\}/.test(out)) {
    return out;
  }
  if (UNSUBSCRIBE_LINK_RE.test(out) && /Unsubscribe/.test(out)) {
    return out;
  }

  if (FOOTER_LINK_ANCHOR_RE.test(out)) {
    return out.replace(FOOTER_LINK_ANCHOR_RE, function (m, before, after) {
      if (UNSUBSCRIBE_LINK_RE.test(before)) return before + after;
      const color = linkColorNearContact(out, before);
      return (
        before +
        '&nbsp;&middot;&nbsp;\n              ' +
        unsubscribeAnchor('{{unsubscribe_url}}', color) +
        '\n            ' +
        after
      );
    });
  }

  if (FOOTER_INLINE_CONTACT_RE.test(out)) {
    return out.replace(FOOTER_INLINE_CONTACT_RE, function (_m, before, after) {
      if (UNSUBSCRIBE_LINK_RE.test(before)) return before + after;
      return (
        before +
        ' · <a href="{{unsubscribe_url}}" style="color:#6b6567;">Unsubscribe</a>' +
        after
      );
    });
  }

  // Privacy row without Contact (rare)
  if (FOOTER_PRIVACY_TERMS_RE.test(out)) {
    return out.replace(FOOTER_PRIVACY_TERMS_RE, function (_m, before, after) {
      if (UNSUBSCRIBE_LINK_RE.test(before)) return before + after;
      return (
        before +
        '&nbsp;&middot;&nbsp;\n              ' +
        unsubscribeAnchor('{{unsubscribe_url}}', '#9a7aa8') +
        '\n            ' +
        after
      );
    });
  }

  // City-partner style: logo-only dark footer — add a links paragraph
  if (DARK_FOOTER_LINKS_MISSING_RE.test(out) && !/Privacy|Terms|Contact/.test(out.slice(out.lastIndexOf('logo_footer')))) {
    return out.replace(DARK_FOOTER_LINKS_MISSING_RE, function (_m, before, after) {
      return (
        before +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:400;color:rgba(255,255,255,0.55);margin:12px 0 0;">' +
        '<a href="{{privacy_url}}" style="color:#ebe0f0;text-decoration:none;">Privacy</a>' +
        '&nbsp;&middot;&nbsp;' +
        '<a href="{{terms_url}}" style="color:#ebe0f0;text-decoration:none;">Terms</a>' +
        '&nbsp;&middot;&nbsp;' +
        '<a href="{{unsubscribe_url}}" style="color:#ebe0f0;text-decoration:none;">Unsubscribe</a>' +
        '</p>' +
        after
      );
    });
  }

  // Cream footer with company details but no link row
  if (CREAM_FOOTER_CLOSE_RE.test(out) && !/Privacy<\/a>/.test(out)) {
    return out.replace(CREAM_FOOTER_CLOSE_RE, function (_m, before, after) {
      return (
        before +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:400;color:#7a7274;margin:14px 0 0;">' +
        '<a href="{{privacy_url}}" style="color:#9a7aa8;text-decoration:none;">Privacy</a>' +
        '&nbsp;&middot;&nbsp;' +
        '<a href="{{terms_url}}" style="color:#9a7aa8;text-decoration:none;">Terms</a>' +
        '&nbsp;&middot;&nbsp;' +
        '<a href="{{unsubscribe_url}}" style="color:#9a7aa8;text-decoration:none;">Unsubscribe</a>' +
        '</p>' +
        after
      );
    });
  }

  return out;
}

/**
 * After placeholders are filled, ensure a visible Unsubscribe link remains.
 */
function ensureUnsubscribeLink(html, resolvedUnsubscribeUrl) {
  let out = String(html || '');
  if (UNSUBSCRIBE_LINK_RE.test(out)) return out;

  const url = String(resolvedUnsubscribeUrl || '').trim();
  if (!url) return out;

  if (FOOTER_CONTACT_RENDERED_RE.test(out)) {
    const color = /#4aa8f0/.test(out) ? '#4aa8f0' : '#9a7aa8';
    return appendUnsubscribeBeforeClose(out, FOOTER_CONTACT_RENDERED_RE, url, color);
  }

  // Last-resort: append before the final closing of the email card
  const lastFooter = out.lastIndexOf('mobile-footer-pad');
  const darkFooter = out.lastIndexOf('background:#1c2040');
  const purpleFooter = out.lastIndexOf('background:#452d5c');
  const anchorAt = Math.max(lastFooter, darkFooter, purpleFooter);
  if (anchorAt === -1) return out;

  const closeTd = out.indexOf('</td>', anchorAt);
  if (closeTd === -1) return out;

  const snippet =
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;margin:14px 0 0;">' +
    unsubscribeAnchor(url.replace(/"/g, '&quot;'), '#9a7aa8') +
    '</p>';
  return out.slice(0, closeTd) + snippet + out.slice(closeTd);
}

module.exports = {
  ensureUnsubscribePlaceholder,
  ensureUnsubscribeLink,
};
