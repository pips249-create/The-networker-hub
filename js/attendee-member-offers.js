/**
 * My services — member offers on the attendee dashboard.
 * Cards follow the events / opportunities grid. Only platform admins can edit them.
 */
(function () {
  var offers = [];
  var canManage = false;
  var loaded = false;
  var loading = false;
  var loadError = '';
  var editingId = '';
  var onChange = null;

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function toneClass(title) {
    var s = String(title || '');
    var n = 0;
    for (var i = 0; i < s.length; i += 1) n = (n + s.charCodeAt(i)) % 4;
    return 'ad-service-media--' + n;
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

  function visibleOffers() {
    if (canManage) return offers.slice();
    return offers.filter(function (offer) {
      return offer.published;
    });
  }

  function publishedCount() {
    return offers.filter(function (offer) {
      return offer.published;
    }).length;
  }

  function notify() {
    if (typeof onChange === 'function') onChange();
  }

  function setFormError(message) {
    var el = document.getElementById('ad-service-form-error');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
  }

  function closeForm() {
    var modal = document.getElementById('ad-service-modal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('ad-service-modal-open');
    editingId = '';
    setFormError('');
  }

  function fillForm(offer) {
    var form = document.getElementById('ad-service-form');
    if (!form) return;
    form.elements.title.value = offer && offer.title ? offer.title : '';
    form.elements.provider.value = offer && offer.provider ? offer.provider : '';
    form.elements.category.value = offer && offer.category ? offer.category : '';
    form.elements.highlight.value = offer && offer.highlight ? offer.highlight : '';
    form.elements.summary.value = offer && offer.summary ? offer.summary : '';
    form.elements.details.value = offer && offer.details ? offer.details : '';
    form.elements.href.value = offer && offer.href ? offer.href : '';
    form.elements.imageUrl.value = offer && offer.imageUrl ? offer.imageUrl : '';
    form.elements.sortOrder.value =
      offer && offer.sortOrder != null ? String(offer.sortOrder) : '0';
    form.elements.published.checked = offer ? offer.published !== false : true;
  }

  function openForm(offer) {
    var modal = document.getElementById('ad-service-modal');
    var title = document.getElementById('ad-service-modal-title');
    if (!modal) return;
    editingId = offer && offer.id ? offer.id : '';
    if (title) title.textContent = editingId ? 'Edit offer' : 'Add offer';
    fillForm(offer || null);
    setFormError('');
    modal.hidden = false;
    document.body.classList.add('ad-service-modal-open');
    var first = document.getElementById('ad-service-title');
    if (first) first.focus();
  }

  function safeHttpUrl(value) {
    var href = String(value || '').trim();
    return /^https?:\/\//i.test(href) ? href : '';
  }

  function detailIdFromHash() {
    var hash = String(location.hash || '').replace(/^#/, '');
    var parts = hash.split('/');
    if (parts[0].toLowerCase() !== 'services' || !parts[1]) return '';
    return parts[1];
  }

  function detailsHtml(text) {
    return String(text || '')
      .split(/\n{2,}/)
      .map(function (block) {
        var lines = block
          .split('\n')
          .map(function (line) {
            return esc(line.trim());
          })
          .filter(Boolean);
        if (!lines.length) return '';
        return '<p>' + lines.join('<br>') + '</p>';
      })
      .join('');
  }

  function setPageHeading(title, sub) {
    var titleEl = document.getElementById('ad-subpage-title');
    var subEl = document.getElementById('ad-subpage-sub');
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = sub;
  }

  function cardHtml(offer) {
    var image = String(offer.imageUrl || '').trim();
    var safeImage = /^https?:\/\//i.test(image) ? image : '';
    var category = offer.category || 'Member offer';
    var highlight = offer.highlight || '';
    var provider = offer.provider || 'The Networker UK';
    var summary = offer.summary || '';
    var media =
      '<div class="ad-service-media ' +
      toneClass(offer.title) +
      (safeImage ? ' has-image' : '') +
      '">' +
      (safeImage
        ? '<img class="ad-service-img" src="' +
          esc(safeImage) +
          '" alt="" />'
        : '<span class="ad-service-initials" aria-hidden="true">' + esc(initials(offer.title)) + '</span>') +
      '<span class="ad-service-category">' +
      esc(category) +
      '</span>' +
      (highlight ? '<span class="ad-service-highlight">' + esc(highlight) + '</span>' : '') +
      (offer.published ? '' : '<span class="ad-service-hidden">Hidden</span>') +
      '</div>';
    var admin = canManage
      ? '<div class="ad-service-admin">' +
        '<button type="button" class="ad-btn ad-btn-ghost ad-btn-sm" data-service-edit="' +
        esc(offer.id) +
        '">Edit</button>' +
        '<button type="button" class="ad-btn ad-btn-ghost ad-btn-sm" data-service-toggle="' +
        esc(offer.id) +
        '">' +
        (offer.published ? 'Hide' : 'Publish') +
        '</button>' +
        '<button type="button" class="ad-btn ad-btn-danger ad-btn-sm" data-service-delete="' +
        esc(offer.id) +
        '">Delete</button></div>'
      : '';
    return (
      '<article class="ad-service-card' +
      (offer.published ? '' : ' is-hidden-offer') +
      (highlight ? ' is-highlight' : '') +
      '" data-service-id="' +
      esc(offer.id) +
      '" role="listitem">' +
      media +
      '<div class="ad-service-body">' +
      '<div class="ad-service-body-top">' +
      '<span class="ad-service-provider">' +
      esc(provider) +
      '</span>' +
      '<span class="ad-service-kicker">' +
      (highlight ? esc(highlight) : 'Member offer') +
      '</span></div>' +
      '<h3 class="ad-service-title">' +
      esc(offer.title) +
      '</h3>' +
      (summary ? '<p class="ad-service-summary">' + esc(summary) + '</p>' : '') +
      '<span class="ad-service-view">More information</span>' +
      admin +
      '</div>' +
      '<button type="button" class="ad-service-card-link" data-service-open="' +
      esc(offer.id) +
      '" aria-label="More about ' +
      esc(offer.title) +
      '"></button></article>'
    );
  }

  function detailHtml(offer) {
    var safeHref = safeHttpUrl(offer.href);
    var safeImage = safeHttpUrl(offer.imageUrl);
    var category = offer.category || 'Member offer';
    var highlight = offer.highlight || '';
    var provider = offer.provider || '';
    var summary = offer.summary || '';
    var body = detailsHtml(offer.details) || (summary ? '<p>' + esc(summary) + '</p>' : '');
    var outbound = safeHref
      ? '<a class="ad-btn ad-btn-primary ad-service-outbound" href="' +
        esc(safeHref) +
        '" target="_blank" rel="noopener noreferrer">Go to this offer</a>'
      : '<p class="ad-service-outbound-missing">The link to this offer has not been added yet.</p>';
    var admin = canManage
      ? '<div class="ad-service-detail-admin">' +
        '<button type="button" class="ad-btn ad-btn-ghost" data-service-edit="' +
        esc(offer.id) +
        '">Edit</button>' +
        '<button type="button" class="ad-btn ad-btn-ghost" data-service-toggle="' +
        esc(offer.id) +
        '">' +
        (offer.published ? 'Hide' : 'Publish') +
        '</button>' +
        '<button type="button" class="ad-btn ad-btn-danger" data-service-delete="' +
        esc(offer.id) +
        '">Delete</button></div>'
      : '';
    return (
      '<button type="button" class="ad-service-back" data-service-back>← All offers</button>' +
      '<article class="ad-service-detail-card">' +
      '<div class="ad-service-media ' +
      toneClass(offer.title) +
      (safeImage ? ' has-image' : '') +
      '">' +
      (safeImage
        ? '<img class="ad-service-img" src="' + esc(safeImage) + '" alt="" />'
        : '<span class="ad-service-initials" aria-hidden="true">' + esc(initials(offer.title)) + '</span>') +
      '<span class="ad-service-category">' +
      esc(category) +
      '</span>' +
      (highlight ? '<span class="ad-service-highlight">' + esc(highlight) + '</span>' : '') +
      (offer.published ? '' : '<span class="ad-service-hidden">Hidden</span>') +
      '</div>' +
      '<div class="ad-service-detail-body">' +
      (provider ? '<p class="ad-service-detail-provider">' + esc(provider) + '</p>' : '') +
      '<h2 class="ad-service-detail-title">' +
      esc(offer.title) +
      '</h2>' +
      (summary ? '<p class="ad-service-detail-summary">' + esc(summary) + '</p>' : '') +
      (body ? '<div class="ad-service-detail-copy">' + body + '</div>' : '') +
      outbound +
      admin +
      '</div></article>'
    );
  }

  function findOffer(id) {
    for (var i = 0; i < offers.length; i += 1) {
      if (String(offers[i].id) === String(id)) return offers[i];
    }
    return null;
  }

  function showListChrome(show) {
    var grid = document.getElementById('ad-services-grid');
    var adminBar = document.getElementById('ad-services-admin');
    var detail = document.getElementById('ad-services-detail');
    var pitch = document.getElementById('ad-services-pitch');
    if (grid) grid.hidden = !show;
    if (adminBar) adminBar.hidden = !show || !canManage;
    if (detail) detail.hidden = show;
    if (pitch) pitch.hidden = !show;
  }

  function render() {
    var grid = document.getElementById('ad-services-grid');
    var empty = document.getElementById('ad-services-empty');
    var error = document.getElementById('ad-services-error');
    var detail = document.getElementById('ad-services-detail');
    if (!grid) return;
    if (error) {
      error.hidden = !loadError;
      error.textContent = loadError || '';
    }
    var detailId = detailIdFromHash();
    if (detailId && loaded) {
      var offer = findOffer(detailId);
      var allowed = offer && (offer.published || canManage);
      if (allowed && detail) {
        showListChrome(false);
        if (empty) empty.hidden = true;
        detail.hidden = false;
        detail.innerHTML = detailHtml(offer);
        setPageHeading(offer.title, offer.highlight || offer.provider || 'Member offer');
        return;
      }
      if (loaded) {
        location.hash = 'services';
      }
    }
    showListChrome(true);
    setPageHeading(
      'My services',
      'Member offers and practical help — free trials, discounts, and guidance arranged for you.'
    );
    var list = visibleOffers();
    if (!loaded) {
      grid.innerHTML = '<p class="ad-services-loading">Loading offers…</p>';
      if (empty) empty.hidden = true;
      return;
    }
    if (!list.length) {
      grid.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    grid.innerHTML = list.map(cardHtml).join('');
    grid.querySelectorAll('.ad-service-img').forEach(function (img) {
      img.addEventListener('error', function () {
        var media = img.parentElement;
        if (!media) return;
        media.classList.remove('has-image');
        img.remove();
        if (!media.querySelector('.ad-service-initials')) {
          var mark = document.createElement('span');
          mark.className = 'ad-service-initials';
          mark.setAttribute('aria-hidden', 'true');
          var card = media.closest('.ad-service-card');
          var title = card ? card.querySelector('.ad-service-title') : null;
          mark.textContent = initials(title ? title.textContent : '');
          media.insertBefore(mark, media.firstChild);
        }
      });
    });
  }

  async function reload() {
    loading = true;
    loadError = '';
    render();
    try {
      var res = await fetch('/api/auth/member-offers', { credentials: 'include' });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || !data.ok) {
        offers = [];
        loadError =
          (data && data.message) ||
          (res.status === 401 ? 'Sign in to see member offers.' : 'Could not load offers.');
      } else {
        offers = Array.isArray(data.offers) ? data.offers : [];
        canManage = data.canManage === true;
      }
    } catch (err) {
      offers = [];
      loadError = 'Could not load offers.';
    }
    loading = false;
    loaded = true;
    render();
    notify();
  }

  function friendlyError(code) {
    if (code === 'invalid_offer') return 'Check the offer details.';
    if (code === 'invalid_id') return 'That offer could not be found.';
    if (code === 'admin_only') return 'Only platform admins can change offers.';
    if (code === 'not_ready') return 'Member offers are not available yet.';
    if (code === 'not_found') return 'That offer has already been removed.';
    return '';
  }

  async function send(method, payload) {
    var res = await fetch('/api/auth/member-offers', {
      method: method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok || !data.ok) {
      var fields =
        data && data.fields && data.fields.length ? ' Check ' + data.fields.join(', ') + '.' : '';
      var base = (data && data.message) || friendlyError(data && data.error) || 'Could not save the offer.';
      throw new Error(base + fields);
    }
    return data;
  }

  function formPayload(form) {
    return {
      title: form.elements.title.value,
      provider: form.elements.provider.value,
      category: form.elements.category.value,
      highlight: form.elements.highlight.value,
      summary: form.elements.summary.value,
      details: form.elements.details.value,
      href: form.elements.href.value,
      imageUrl: form.elements.imageUrl.value,
      sortOrder: form.elements.sortOrder.value,
      published: form.elements.published.checked,
    };
  }

  function bind() {
    var add = document.getElementById('ad-services-add');
    if (add && !add.dataset.boundServiceAdd) {
      add.dataset.boundServiceAdd = '1';
      add.addEventListener('click', function () {
        openForm(null);
      });
    }
    var modal = document.getElementById('ad-service-modal');
    if (modal && !modal.dataset.boundServiceModal) {
      modal.dataset.boundServiceModal = '1';
      modal.addEventListener('click', function (event) {
        var target = event.target;
        if (
          target &&
          (target.id === 'ad-service-modal-backdrop' ||
            target.id === 'ad-service-modal-close' ||
            target.id === 'ad-service-cancel')
        ) {
          closeForm();
        }
      });
    }
    var form = document.getElementById('ad-service-form');
    if (form && !form.dataset.boundServiceForm) {
      form.dataset.boundServiceForm = '1';
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var submit = document.getElementById('ad-service-save');
        if (submit) submit.disabled = true;
        setFormError('');
        var payload = formPayload(form);
        var method = editingId ? 'PATCH' : 'POST';
        if (editingId) payload.id = editingId;
        send(method, payload)
          .then(function () {
            closeForm();
            return reload();
          })
          .catch(function (err) {
            setFormError(err && err.message ? err.message : 'Could not save the offer.');
          })
          .then(function () {
            if (submit) submit.disabled = false;
          });
      });
    }
    var services = document.querySelector('.ad-services');
    if (services && !services.dataset.boundServiceClicks) {
      services.dataset.boundServiceClicks = '1';
      services.addEventListener('click', function (event) {
        if (event.target.closest('[data-service-back]')) {
          location.hash = 'services';
          return;
        }
        var editBtn = event.target.closest('[data-service-edit]');
        var toggleBtn = event.target.closest('[data-service-toggle]');
        var deleteBtn = event.target.closest('[data-service-delete]');
        var openBtn = event.target.closest('[data-service-open]');
        if (!editBtn && !toggleBtn && !deleteBtn && !openBtn) return;
        event.preventDefault();
        event.stopPropagation();
        if (openBtn) {
          location.hash = 'services/' + openBtn.getAttribute('data-service-open');
          return;
        }
        if (editBtn) {
          var offer = findOffer(editBtn.getAttribute('data-service-edit'));
          if (offer) openForm(offer);
          return;
        }
        if (toggleBtn) {
          var current = findOffer(toggleBtn.getAttribute('data-service-toggle'));
          if (!current) return;
          toggleBtn.disabled = true;
          send('PATCH', { id: current.id, published: !current.published })
            .then(function () {
              return reload();
            })
            .catch(function (err) {
              loadError = err && err.message ? err.message : 'Could not update the offer.';
              render();
            });
          return;
        }
        var id = deleteBtn.getAttribute('data-service-delete');
        var doomed = findOffer(id);
        var name = doomed && doomed.title ? doomed.title : 'this offer';
        if (!window.confirm('Delete “' + name + '”? Members will no longer see it.')) return;
        if (detailIdFromHash()) location.hash = 'services';
        deleteBtn.disabled = true;
        send('DELETE', { id: id })
          .then(function () {
            return reload();
          })
          .catch(function (err) {
            loadError = err && err.message ? err.message : 'Could not delete the offer.';
            render();
          });
      });
    }
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        var modal = document.getElementById('ad-service-modal');
        if (modal && !modal.hidden) closeForm();
        else if (detailIdFromHash()) location.hash = 'services';
      }
    });
  }

  var started = false;

  function init(options) {
    if (started) return;
    started = true;
    bind();
    onChange = options && options.onChange;
    if (options && options.isAdmin) canManage = true;
    reload();
  }

  window.HubAttendeeServices = {
    init: init,
    render: render,
    publishedCount: publishedCount,
    routeHash: function () {
      var id = detailIdFromHash();
      return id ? '#services/' + id : '#services';
    },
  };
})();
