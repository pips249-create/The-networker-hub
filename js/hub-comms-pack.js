/**
 * Organiser comms pack — social caption + link for publish success pages.
 */
(function (global) {
  var SHARE_DONE_KEY = 'hub_getting_started_share_done';

  function trimText(text, max) {
    var s = String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!max || s.length <= max) return s;
    return s.slice(0, max - 1).trim() + '…';
  }

  function normalizeEventKind(ev) {
    var raw = String(
      (ev && (ev.eventType || ev.type || ev.event_type || ev.meetingType || ev.format)) || ''
    )
      .trim()
      .toLowerCase();
    if (/conference|summit/.test(raw)) return 'conference';
    if (/exhibition|exhibit/.test(raw)) return 'conference';
    if (/webinar|workshop|masterclass|awards/.test(raw)) return 'conference';
    return 'networking';
  }

  function isFreeEvent(ev) {
    if (ev && ev.priceKey === 'free') return true;
    if (ev && ev.isFree === true) return true;
    var priceRaw = ev && (ev.priceNum != null ? ev.priceNum : ev.price);
    var n = Number(priceRaw);
    if (Number.isFinite(n)) return n <= 0;
    var label = String((ev && ev.price) || '').trim().toLowerCase();
    return !label || label === 'free' || label === '£0' || label === '£0.00';
  }

  function formatMetaDate(raw) {
    if (!raw) return '';
    var d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw).trim();
    return d.toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function eventMetaLine(ev) {
    var date = formatMetaDate((ev && (ev.starts_at || ev.date || ev.dateLine)) || '');
    var location = String((ev && ev.location) || '').trim();
    return [date, location].filter(Boolean).join(' · ');
  }

  function buildEventCaptionVariants(ev, listingUrl) {
    var title = String((ev && ev.title) || 'Our event').trim();
    var url = String(listingUrl || '').trim();
    var meta = eventMetaLine(ev);
    var kind = normalizeEventKind(ev);
    var free = isFreeEvent(ev);
    var metaBlock = meta ? '\n\n' + meta : '';

    var variants = [];

    if (kind === 'networking') {
      if (free) {
        variants.push({
          id: 'networking_free',
          label: 'Networking meetup — free',
          caption:
            "We're hosting a networking meetup — come and meet local business owners.\n\n📅 " +
            title +
            metaBlock +
            '\n\nFree to attend — save your place on The Networker Hub:\n' +
            url,
        });
        variants.push({
          id: 'networking_free_warm',
          label: 'Warm invite — free meetup',
          caption:
            'Looking for a friendly room of business owners to connect with?\n\n📅 ' +
            title +
            metaBlock +
            '\n\nIt is free to join — register on The Networker Hub:\n' +
            url,
        });
      } else {
        variants.push({
          id: 'networking_paid',
          label: 'Networking meetup — tickets',
          caption:
            'Our next networking meetup is open for booking.\n\n📅 ' +
            title +
            metaBlock +
            '\n\nGet your ticket on The Networker Hub:\n' +
            url,
        });
        variants.push({
          id: 'networking_paid_short',
          label: 'Short & direct — tickets',
          caption:
            '📅 ' +
            title +
            metaBlock +
            '\n\nBook your place on The Networker Hub:\n' +
            url,
        });
      }
    } else if (free) {
      variants.push({
        id: 'conference_free',
        label: 'Conference / exhibition — free entry',
        caption:
          'Join us at ' +
          title +
          ' — a chance to connect with peers in your industry.' +
          metaBlock +
          '\n\nRegister free on The Networker Hub:\n' +
          url,
      });
      variants.push({
        id: 'conference_free_announce',
        label: 'Announcement — free event',
        caption:
          "We've just opened registration for:\n\n📅 " +
          title +
          metaBlock +
          '\n\nFree entry — save your place on The Networker Hub:\n' +
          url,
      });
    } else {
      variants.push({
        id: 'conference_paid',
        label: 'Conference / exhibition — tickets',
        caption:
          'Tickets are now available for ' +
          title +
          '.' +
          metaBlock +
          '\n\nBook on The Networker Hub:\n' +
          url,
      });
      variants.push({
        id: 'conference_paid_announce',
        label: 'Now on sale',
        caption:
          "We've just added a new event:\n\n📅 " +
          title +
          metaBlock +
          '\n\nGet your ticket on The Networker Hub:\n' +
          url,
      });
    }

    var defaultId = variants[0] ? variants[0].id : 'default';
    return {
      title: title,
      url: url,
      caption: variants[0] ? variants[0].caption : '',
      variants: variants,
      defaultVariantId: defaultId,
      kind: kind,
      free: free,
    };
  }

  function buildEventCommsPack(ev, listingUrl) {
    var pack = buildEventCaptionVariants(ev, listingUrl);
    return {
      title: pack.title,
      url: pack.url,
      caption: pack.caption,
      variants: pack.variants,
      defaultVariantId: pack.defaultVariantId,
      kind: pack.kind,
      free: pack.free,
    };
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
    if (urlEl) {
      var url = String(pack.url || '').trim();
      var caption = String(pack.caption || '');
      var showUrlLine = url && caption.indexOf(url) === -1;
      urlEl.hidden = !showUrlLine;
      urlEl.textContent = showUrlLine ? url : '';
    }

    root.querySelectorAll('[data-comms-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var kind = btn.getAttribute('data-comms-copy') || 'caption';
        var text = kind === 'url' ? pack.url : pack.caption;
        if (!text) return;
        var original = btn.textContent;
        function done() {
          btn.textContent = 'Copied!';
          markEventShareDone();
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

  function markEventShareDone() {
    try {
      localStorage.setItem(SHARE_DONE_KEY, '1');
    } catch {
      /* ignore */
    }
    if (global.orgDashUpdateGettingStarted) {
      global.orgDashUpdateGettingStarted();
    }
  }

  function isEventShareDone() {
    try {
      return localStorage.getItem(SHARE_DONE_KEY) === '1';
    } catch {
      return false;
    }
  }

  global.HubCommsPack = {
    buildEventCommsPack: buildEventCommsPack,
    buildEventCaptionVariants: buildEventCaptionVariants,
    buildOpportunityCommsPack: buildOpportunityCommsPack,
    bindCommsPack: bindCommsPack,
    markEventShareDone: markEventShareDone,
    isEventShareDone: isEventShareDone,
    normalizeEventKind: normalizeEventKind,
    isFreeEvent: isFreeEvent,
  };
})(typeof window !== 'undefined' ? window : global);
