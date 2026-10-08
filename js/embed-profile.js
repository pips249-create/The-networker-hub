/**
 * Organiser profile embed — /embed/profile?slug=… or /embed/profile?id=…
 * Clicks open the public profile or event on The Networker UK.
 */
(function () {
  'use strict';

  var ORIGIN = window.location.origin || 'https://www.thenetworkeruk.com';
  var root = document.getElementById('embed-profile-root');
  if (!root) return;

  function params() {
    return new URLSearchParams(window.location.search || '');
  }

  function route() {
    var p = params();
    return {
      id: String(p.get('id') || '').trim(),
      slug: String(p.get('slug') || '').trim(),
    };
  }

  function isHexColor(raw) {
    return /^#?[0-9a-fA-F]{6}$/.test(String(raw || '').trim());
  }

  function normalizeHex(raw) {
    var s = String(raw || '').trim();
    if (!isHexColor(s)) return '';
    return s.charAt(0) === '#' ? s : '#' + s;
  }

  function applyTheme() {
    var p = params();
    var brand = normalizeHex(p.get('brand') || p.get('primary') || '');
    var bg = normalizeHex(p.get('bg') || '');
    var accent = normalizeHex(p.get('accent') || '');
    var rootEl = document.documentElement;
    if (brand) rootEl.style.setProperty('--embed-brand', brand);
    if (bg) rootEl.style.setProperty('--embed-bg', bg);
    if (accent) rootEl.style.setProperty('--embed-accent', accent);
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function withUtm(path) {
    var u = new URL(ORIGIN + path);
    u.searchParams.set('utm_source', 'embed');
    u.searchParams.set('utm_medium', 'profile-widget');
    return u.toString();
  }

  function profilePath(org) {
    var slug = String((org && org.slug) || '').trim();
    if (slug) return '/organisers/' + encodeURIComponent(slug);
    return '/events/organiser?id=' + encodeURIComponent(org && org.id ? org.id : '');
  }

  function eventPath(ev) {
    var slug = String((ev && ev.slug) || '').trim();
    if (slug) return '/events/' + encodeURIComponent(slug);
    return '/events/event?id=' + encodeURIComponent(ev && ev.id ? ev.id : '');
  }

  function postHeight() {
    try {
      var height = Math.ceil(
        Math.max(
          document.documentElement.scrollHeight || 0,
          document.body.scrollHeight || 0,
          root.offsetHeight || 0
        )
      );
      if (height < 80) height = 80;
      window.parent.postMessage({ source: 'tnh-profile-embed', type: 'resize', height: height }, '*');
    } catch (e) {
      /* ignore */
    }
  }

  function scheduleHeight() {
    window.requestAnimationFrame(function () {
      postHeight();
      setTimeout(postHeight, 50);
      setTimeout(postHeight, 300);
    });
  }

  function openTop(url) {
    try {
      if (window.top && window.top !== window) {
        window.top.location.assign(url);
        return;
      }
    } catch (e) {
      /* cross-origin top */
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function stars(rating) {
    var value = Number(rating) || 0;
    var n = Math.round(value);
    if (n < 0) n = 0;
    if (n > 5) n = 5;
    var marks = '';
    var i;
    for (i = 1; i <= 5; i += 1) {
      marks += '<span class="' + (i <= n ? 'is-on' : '') + '" aria-hidden="true">★</span>';
    }
    var label = (value ? value.toFixed(1) : '0') + ' out of 5';
    return '<span class="embed-profile__stars" aria-label="' + esc(label) + '">' + marks + '</span>';
  }

  function placeLine(org) {
    var locs = org && Array.isArray(org.locations) ? org.locations : [];
    var first = locs[0] || {};
    return String(first.city || first.outcode || '').trim();
  }

  function initial(name) {
    var s = String(name || '').trim();
    return s ? s.charAt(0).toUpperCase() : 'N';
  }

  function renderLoading() {
    root.className = 'embed-profile embed-profile--loading';
    root.innerHTML = '<p class="embed-profile__status">Loading profile…</p>';
    scheduleHeight();
  }

  function renderError(message) {
    root.className = 'embed-profile embed-profile--error';
    root.innerHTML =
      '<p class="embed-profile__error">' + esc(message || 'This profile could not be loaded.') + '</p>';
    scheduleHeight();
  }

  function render(org) {
    var profileUrl = withUtm(profilePath(org));
    var name = org.name || 'Networking group';
    var place = placeLine(org);
    var reviews = Number(org.reviews) || 0;
    var logo = '';
    if (org.photoUrl) {
      logo =
        '<img class="embed-profile__logo" src="' +
        esc(org.photoUrl) +
        '" alt="" width="56" height="56" />';
    } else {
      logo =
        '<div class="embed-profile__logo embed-profile__logo--empty" aria-hidden="true">' +
        esc(initial(name)) +
        '</div>';
    }

    var award = '';
    if (org.ranking && (org.ranking.cardLabel || org.ranking.displayLabel || org.ranking.label)) {
      award =
        '<span class="embed-profile__award">' +
        esc(org.ranking.cardLabel || org.ranking.displayLabel || org.ranking.label) +
        '</span>';
    }

    var desc = String(org.description || '').trim();
    var events = Array.isArray(org.events) ? org.events.slice(0, 3) : [];
    var eventsHtml = '';
    if (events.length) {
      eventsHtml =
        '<ul class="embed-profile__events">' +
        events
          .map(function (ev) {
            var meta = [ev.dateLine, ev.city].filter(Boolean).join(' · ');
            return (
              '<li><a class="embed-profile__event" href="' +
              esc(withUtm(eventPath(ev))) +
              '" data-embed-go="' +
              esc(withUtm(eventPath(ev))) +
              '"><strong>' +
              esc(ev.title || 'Event') +
              '</strong>' +
              (meta ? '<small>' + esc(meta) + '</small>' : '') +
              '</a></li>'
            );
          })
          .join('') +
        '</ul>';
    } else {
      eventsHtml =
        '<p class="embed-profile__empty">Upcoming events appear here once they are published.</p>';
    }

    var reviewHtml = '';
    var reviewItems = Array.isArray(org.reviewItems) ? org.reviewItems : [];
    var review = reviewItems.find(function (item) {
      return item && item.text;
    });
    if (review) {
      reviewHtml =
        '<blockquote class="embed-profile__review"><p>“' +
        esc(review.text) +
        '”</p><cite>' +
        esc(review.name || 'Attendee') +
        (review.rating ? ' · ' + esc(String(review.rating)) + '★' : '') +
        '</cite></blockquote>';
    }

    var badgeSrc = ORIGIN + '/assets/organiser-badge.png?v=20261008uk1';
    root.className = 'embed-profile';
    root.innerHTML =
      '<div class="embed-profile__head">' +
      logo +
      '<div><h1 class="embed-profile__name">' +
      esc(name) +
      '</h1>' +
      (place ? '<p class="embed-profile__place">' + esc(place) + '</p>' : '') +
      '<p class="embed-profile__rating">' +
      stars(org.rating) +
      '<span>' +
      esc(reviews ? reviews + (reviews === 1 ? ' review' : ' reviews') : 'New on The Networker UK') +
      '</span></p>' +
      award +
      '</div></div>' +
      (desc ? '<p class="embed-profile__desc">' + esc(desc) + '</p>' : '') +
      eventsHtml +
      reviewHtml +
      '<a class="embed-profile__cta" href="' +
      esc(profileUrl) +
      '" data-embed-go="' +
      esc(profileUrl) +
      '">View profile</a>' +
      '<div class="embed-profile__foot"><a href="' +
      esc(profileUrl) +
      '" data-embed-go="' +
      esc(profileUrl) +
      '" title="' +
      esc(name) +
      ' on The Networker UK"><img src="' +
      esc(badgeSrc) +
      '" alt="Listed on The Networker UK" width="148" height="59" /></a></div>';

    root.querySelectorAll('[data-embed-go]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        event.preventDefault();
        openTop(link.getAttribute('data-embed-go') || link.getAttribute('href') || profileUrl);
      });
    });

    var img = root.querySelector('.embed-profile__logo');
    if (img && img.tagName === 'IMG') {
      img.addEventListener('load', scheduleHeight);
      img.addEventListener('error', function () {
        img.replaceWith(
          (function () {
            var fallback = document.createElement('div');
            fallback.className = 'embed-profile__logo embed-profile__logo--empty';
            fallback.setAttribute('aria-hidden', 'true');
            fallback.textContent = initial(name);
            return fallback;
          })()
        );
        scheduleHeight();
      });
    }
    scheduleHeight();
  }

  function load() {
    applyTheme();
    var q = route();
    if (!q.slug && !q.id) {
      renderError('Add a profile link to show this group.');
      return;
    }
    renderLoading();
    var api =
      ORIGIN +
      '/api/organisers?' +
      (q.slug ? 'slug=' + encodeURIComponent(q.slug) : 'id=' + encodeURIComponent(q.id));
    fetch(api, { credentials: 'omit' })
      .then(function (res) {
        return res.json().then(function (body) {
          return { ok: res.ok, status: res.status, body: body || {} };
        });
      })
      .then(function (result) {
        var org = result.body && result.body.organiser;
        if (!result.ok || !org) {
          renderError(
            result.status === 404
              ? 'This organiser profile is not published yet.'
              : 'This profile could not be loaded.'
          );
          return;
        }
        render(org);
      })
      .catch(function () {
        renderError('This profile could not be loaded.');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
