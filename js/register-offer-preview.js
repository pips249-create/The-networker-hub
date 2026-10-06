/**
 * Sign-up page teaser for member offers.
 * Cards are a preview only: no links, no codes, no detail page.
 */
(function (root) {
  var PREVIEW_FIELDS = ['title', 'provider', 'category', 'highlight', 'summary', 'imageUrl'];

  function esc(value) {
    var d = document.createElement('div');
    d.textContent = value == null ? '' : String(value);
    return d.innerHTML;
  }

  function toneClass(title) {
    var s = String(title || '');
    var n = 0;
    for (var i = 0; i < s.length; i += 1) n = (n + s.charCodeAt(i)) % 4;
    return 'auth-offer-media--' + n;
  }

  function initials(title) {
    var parts = String(title || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return '✦';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  function safeImage(value) {
    var href = String(value || '').trim();
    return /^https?:\/\//i.test(href) ? href : '';
  }

  function previewOffer(offer) {
    var clean = {};
    if (!offer || typeof offer !== 'object') return null;
    PREVIEW_FIELDS.forEach(function (key) {
      clean[key] = offer[key] == null ? '' : String(offer[key]);
    });
    clean.imageUrl = safeImage(clean.imageUrl);
    if (!clean.title.trim()) return null;
    return clean;
  }

  function cardHtml(offer) {
    var image = offer.imageUrl;
    var category = offer.category || 'Member offer';
    var highlight = offer.highlight || '';
    var provider = offer.provider || '';
    var summary = offer.summary || '';
    return (
      '<article class="auth-offer-card">' +
      '<div class="auth-offer-media ' +
      toneClass(offer.title) +
      (image ? ' has-image' : '') +
      '">' +
      (image
        ? '<img class="auth-offer-img" src="' + esc(image) + '" alt="" />'
        : '<span class="auth-offer-initials" aria-hidden="true">' + esc(initials(offer.title)) + '</span>') +
      '</div>' +
      '<div class="auth-offer-body">' +
      '<p class="auth-offer-category">' +
      esc(category) +
      '</p>' +
      '<h3 class="auth-offer-card-title">' +
      esc(offer.title) +
      '</h3>' +
      (provider ? '<p class="auth-offer-provider">' + esc(provider) + '</p>' : '') +
      (highlight ? '<p class="auth-offer-highlight">' + esc(highlight) + '</p>' : '') +
      (summary ? '<p class="auth-offer-summary">' + esc(summary) + '</p>' : '') +
      '</div></article>'
    );
  }

  function bindImageFallback(list) {
    list.querySelectorAll('.auth-offer-img').forEach(function (img) {
      img.addEventListener('error', function () {
        var media = img.parentElement;
        if (!media) return;
        media.classList.remove('has-image');
        var card = media.closest('.auth-offer-card');
        var title = card ? card.querySelector('.auth-offer-card-title') : null;
        img.remove();
        if (!media.querySelector('.auth-offer-initials')) {
          var mark = document.createElement('span');
          mark.className = 'auth-offer-initials';
          mark.setAttribute('aria-hidden', 'true');
          mark.textContent = initials(title ? title.textContent : '');
          media.appendChild(mark);
        }
      });
    });
  }

  function render(offers) {
    var layout = document.getElementById('auth-register-layout');
    var panel = document.getElementById('auth-offer-preview');
    var list = document.getElementById('auth-offer-preview-list');
    if (!layout || !panel || !list) return;
    var cards = (Array.isArray(offers) ? offers : []).map(previewOffer).filter(Boolean).slice(0, 3);
    if (!cards.length) {
      hide();
      list.innerHTML = '';
      return;
    }
    list.innerHTML = cards.map(cardHtml).join('');
    bindImageFallback(list);
    layout.classList.add('has-offer-preview');
    panel.hidden = false;
  }

  var requestId = 0;

  function hide() {
    requestId += 1;
    var layout = document.getElementById('auth-register-layout');
    var panel = document.getElementById('auth-offer-preview');
    if (layout) layout.classList.remove('has-offer-preview');
    if (panel) panel.hidden = true;
  }

  function load() {
    var list = document.getElementById('auth-offer-preview-list');
    if (!list) return;
    var id = ++requestId;
    fetch('/api/auth/member-offer-previews', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (id !== requestId) return;
        var data = result.data || {};
        if (!result.ok || data.ok === false) {
          hide();
          return;
        }
        render(data.offers);
      })
      .catch(function () {
        if (id !== requestId) return;
        hide();
      });
  }

  root.HubRegisterOfferPreview = {
    hide: hide,
    render: render,
    load: load,
  };
})(window);
