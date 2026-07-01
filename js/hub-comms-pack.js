/**
 * Organiser comms pack — social caption + link for publish success pages.
 */
(function (global) {
  function trimText(text, max) {
    var s = String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!max || s.length <= max) return s;
    return s.slice(0, max - 1).trim() + '…';
  }

  function buildEventCommsPack(ev, listingUrl) {
    var title = String((ev && ev.title) || 'Our event').trim();
    var url = String(listingUrl || '').trim();
    var date = String((ev && (ev.date || ev.dateLine)) || '').trim();
    var location = String((ev && ev.location) || '').trim();
    var meta = [date, location].filter(Boolean).join(' · ');
    var caption =
      '📅 ' +
      title +
      (meta ? '\n\n' + meta : '') +
      '\n\nBook your place on The Networker Hub:\n' +
      url;
    return { title: title, url: url, caption: caption };
  }

  function buildOpportunityCommsPack(opp, listingUrl) {
    var title = String((opp && (opp.title || opp.name)) || 'Our listing').trim();
    var url = String(listingUrl || '').trim();
    var host = String((opp && (opp.host || opp.organiserName)) || '').trim();
    var description = trimText(
      (opp && (opp.summary || opp.description || opp.shortDescription)) || '',
      180
    );
    var caption =
      '🆕 ' +
      title +
      (host ? ' — ' + host : '') +
      (description ? '\n\n' + description : '') +
      '\n\nBrowse and enquire on The Networker Hub:\n' +
      url;
    return { title: title, url: url, caption: caption };
  }

  function bindCommsPack(root, pack) {
    if (!root || !pack) return;
    var captionEl = root.querySelector('[data-comms-caption]');
    var urlEl = root.querySelector('[data-comms-url]');
    if (captionEl) captionEl.textContent = pack.caption || '';
    if (urlEl) urlEl.textContent = pack.url || '';

    root.querySelectorAll('[data-comms-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var kind = btn.getAttribute('data-comms-copy') || 'caption';
        var text = kind === 'url' ? pack.url : pack.caption;
        if (!text) return;
        var original = btn.textContent;
        function done() {
          btn.textContent = 'Copied!';
          window.setTimeout(function () {
            btn.textContent = original;
          }, 2000);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(function () {
            window.prompt('Copy this text:', text);
          });
        } else {
          window.prompt('Copy this text:', text);
          done();
        }
      });
    });
  }

  global.HubCommsPack = {
    buildEventCommsPack: buildEventCommsPack,
    buildOpportunityCommsPack: buildOpportunityCommsPack,
    bindCommsPack: bindCommsPack,
  };
})(typeof window !== 'undefined' ? window : global);
