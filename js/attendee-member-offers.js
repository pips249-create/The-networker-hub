/**
 * Member offers on the attendee dashboard.
 * Cards follow the events / opportunities grid. Only platform admins can edit them.
 */
(function () {
  var offers = [];
  var canManage = false;
  var loaded = false;
  var loading = false;
  var loadError = '';
  var editingId = '';
  var pendingImage = null;
  var imagePrepare = Promise.resolve();
  var imageToken = 0;
  var imageIncoming = false;
  var imageFailed = false;
  var IMAGE_READ_ERROR = "Couldn't read that image. Use a JPG or PNG, or paste an image link.";
  var onChange = null;

  /** Static playbooks — same card shape as partner offers; open the click-through deck. */
  var PLAYBOOKS =
    window.HubMemberPlaybooks && Array.isArray(window.HubMemberPlaybooks.catalog)
      ? window.HubMemberPlaybooks.catalog.map(function (book) {
          return {
            id: book.id,
            title: book.title,
            provider: 'The Networker UK',
            category: 'Playbook',
            highlight: '5 pages',
            summary: book.summary,
            tone: book.tone != null ? book.tone : 0,
            imageUrl: book.imageUrl || '',
          };
        })
      : [];

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

  function londonToday() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function offerHasEnded(offer) {
    var end = offer && offer.endsOn ? String(offer.endsOn).slice(0, 10) : '';
    return Boolean(end && end < londonToday());
  }

  function offerIsLive(offer) {
    return Boolean(offer && offer.published && !offerHasEnded(offer));
  }

  function visibleOffers() {
    if (canManage) return offers.slice();
    return offers.filter(offerIsLive);
  }

  function publishedCount() {
    return offers.filter(offerIsLive).length;
  }

  function featuredDeal() {
    var live = offers.filter(offerIsLive);
    if (!live.length) return '';
    var offer = live[0];
    var who = offer.provider || offer.title || '';
    var badge = offer.highlight || '';
    if (who && badge) return who + ': ' + badge;
    return who || badge;
  }

  function statusBadge(offer) {
    if (!offer.published) return '<span class="ad-service-hidden">Hidden</span>';
    if (offerHasEnded(offer)) return '<span class="ad-service-hidden">Ended</span>';
    return '';
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
    form.elements.promoCode.value = offer && offer.promoCode ? offer.promoCode : '';
    form.elements.endsOn.value = offer && offer.endsOn ? String(offer.endsOn).slice(0, 10) : '';
    form.elements.imageUrl.value = offer && offer.imageUrl ? offer.imageUrl : '';
    resetPendingImage();
    showImagePreview(offer && offer.imageUrl ? offer.imageUrl : '');
    form.elements.sortOrder.value =
      offer && offer.sortOrder != null ? String(offer.sortOrder) : '0';
    form.elements.published.checked = offer ? offer.published === true : false;
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
      statusBadge(offer) +
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
      statusBadge(offer) +
      '</div>' +
      '<div class="ad-service-detail-body">' +
      (provider ? '<p class="ad-service-detail-provider">' + esc(provider) + '</p>' : '') +
      '<h2 class="ad-service-detail-title">' +
      esc(offer.title) +
      '</h2>' +
      (summary ? '<p class="ad-service-detail-summary">' + esc(summary) + '</p>' : '') +
      (body ? '<div class="ad-service-detail-copy">' + body + '</div>' : '') +
      (offer.promoCode
        ? '<p class="ad-service-code">Use code <strong>' +
          esc(offer.promoCode) +
          '</strong> <button type="button" class="ad-service-code-copy" data-service-copy-code="' +
          esc(offer.promoCode) +
          '">Copy</button></p>'
        : '') +
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

  function playbookCardHtml(book) {
    var image = String(book.imageUrl || '').trim();
    var safeImage = image.indexOf('/assets/') === 0 || /^https?:\/\//i.test(image) ? image : '';
    return (
      '<article class="ad-service-card ad-service-card--playbook" data-playbook-id="' +
      esc(book.id) +
      '" role="listitem">' +
      '<div class="ad-service-media ad-service-media--' +
      String(book.tone != null ? book.tone : 0) +
      (safeImage ? ' has-image' : '') +
      '">' +
      (safeImage
        ? '<img class="ad-service-img" src="' + esc(safeImage) + '" alt="" loading="lazy" />'
        : '<span class="ad-service-initials" aria-hidden="true">' + esc(initials(book.title)) + '</span>') +
      '<span class="ad-service-category">' +
      esc(book.category) +
      '</span>' +
      (book.highlight ? '<span class="ad-service-highlight">' + esc(book.highlight) + '</span>' : '') +
      '</div>' +
      '<div class="ad-service-body">' +
      '<div class="ad-service-body-top">' +
      '<span class="ad-service-provider">' +
      esc(book.provider) +
      '</span>' +
      '<span class="ad-service-kicker">Playbook</span></div>' +
      '<h3 class="ad-service-title">' +
      esc(book.title) +
      '</h3>' +
      (book.summary ? '<p class="ad-service-summary">' + esc(book.summary) + '</p>' : '') +
      '<span class="ad-service-view">Open playbook</span>' +
      '</div>' +
      '<button type="button" class="ad-service-card-link" data-playbook-open="' +
      esc(book.id) +
      '" aria-label="Open playbook: ' +
      esc(book.title) +
      '"></button></article>'
    );
  }

  function closePlaybookModal() {
    var modal = document.getElementById('ad-playbook-modal');
    var mount = document.getElementById('ad-playbook-mount');
    if (modal) modal.hidden = true;
    document.body.classList.remove('ad-playbook-modal-open');
    if (mount) mount.innerHTML = '';
  }

  function openPlaybookModal(id) {
    var book = null;
    for (var i = 0; i < PLAYBOOKS.length; i += 1) {
      if (PLAYBOOKS[i].id === id) {
        book = PLAYBOOKS[i];
        break;
      }
    }
    if (!book) return;
    var modal = document.getElementById('ad-playbook-modal');
    var mount = document.getElementById('ad-playbook-mount');
    var title = document.getElementById('ad-playbook-modal-title');
    if (!modal || !mount || !window.HubMemberPlaybooks || typeof window.HubMemberPlaybooks.mount !== 'function') {
      location.href = '/guides/member-playbooks.html#' + id;
      return;
    }
    if (title) title.textContent = book.title;
    window.HubMemberPlaybooks.mount(mount, {
      deckId: id,
      onSwitch: function (nextId) {
        for (var j = 0; j < PLAYBOOKS.length; j += 1) {
          if (PLAYBOOKS[j].id === nextId) {
            if (title) title.textContent = PLAYBOOKS[j].title;
            break;
          }
        }
      },
    });
    modal.hidden = false;
    document.body.classList.add('ad-playbook-modal-open');
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
      'Member offers',
      'Free trials, discounts, and practical help arranged for you.'
    );
    var list = visibleOffers();
    if (!loaded) {
      grid.innerHTML = '<p class="ad-services-loading">Loading offers…</p>';
      if (empty) empty.hidden = true;
      return;
    }
    var playbookHtml = PLAYBOOKS.map(playbookCardHtml).join('');
    if (!list.length) {
      grid.innerHTML = playbookHtml;
      if (empty) empty.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    grid.innerHTML = playbookHtml + list.map(cardHtml).join('');
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
    if (code === 'publish_incomplete') return 'Add a link and a picture before publishing this offer.';
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

  function showImagePreview(src) {
    var preview = document.getElementById('ad-service-image-preview');
    var empty = document.getElementById('ad-service-drop-empty');
    var clearBtn = document.getElementById('ad-service-image-clear');
    var hasSrc = Boolean(src);
    if (preview) {
      if (hasSrc) preview.src = src;
      else preview.removeAttribute('src');
      preview.hidden = !hasSrc;
    }
    if (empty) empty.hidden = hasSrc;
    if (clearBtn) clearBtn.hidden = !hasSrc;
  }

  function resetPendingImage() {
    imageToken += 1;
    pendingImage = null;
    imageIncoming = false;
    imageFailed = false;
    imagePrepare = Promise.resolve();
  }

  function loadDrawable(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        if (!img.naturalWidth || !img.naturalHeight) {
          reject(new Error(IMAGE_READ_ERROR));
          return;
        }
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error(IMAGE_READ_ERROR));
      };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(
        function (blob) {
          if (blob) resolve(blob);
          else reject(new Error(IMAGE_READ_ERROR));
        },
        type,
        quality
      );
    });
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ''));
      };
      reader.onerror = function () {
        reject(new Error(IMAGE_READ_ERROR));
      };
      reader.readAsDataURL(blob);
    });
  }

  function prepareOfferImage(file) {
    if (!file) return Promise.reject(new Error('Choose an image.'));
    return loadDrawable(file).then(function (img) {
      var maxEdge = 1600;
      var longest = Math.max(img.naturalWidth, img.naturalHeight);
      var scale = longest > maxEdge ? maxEdge / longest : 1;
      var width = Math.max(1, Math.round(img.naturalWidth * scale));
      var height = Math.max(1, Math.round(img.naturalHeight * scale));
      var canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext('2d');
      if (!ctx) return Promise.reject(new Error(IMAGE_READ_ERROR));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      var qualities = [0.86, 0.74, 0.62, 0.5];
      var chain = Promise.resolve(null);
      qualities.forEach(function (quality) {
        chain = chain.then(function (blob) {
          if (blob && blob.size <= 900 * 1024) return blob;
          return canvasToBlob(canvas, 'image/jpeg', quality);
        });
      });
      return chain.then(function (blob) {
        if (!blob || blob.size > 2 * 1024 * 1024) {
          throw new Error('That image is too large. Use one under 2MB.');
        }
        return blobToDataUrl(blob).then(function (dataUrl) {
          if (dataUrl.indexOf('data:image/jpeg') !== 0) throw new Error(IMAGE_READ_ERROR);
          var base = String(file.name || 'offer').replace(/\.[^.]+$/, '') || 'offer';
          return { dataUrl: dataUrl, type: 'image/jpeg', name: base + '.jpg' };
        });
      });
    });
  }

  function setDroppedImage(file) {
    resetPendingImage();
    var token = imageToken;
    imageIncoming = true;
    setFormError('');
    var form = document.getElementById('ad-service-form');
    if (form && form.elements.imageUrl) form.elements.imageUrl.value = '';
    imagePrepare = prepareOfferImage(file)
      .then(function (prepared) {
        if (token !== imageToken) return;
        pendingImage = prepared;
        imageIncoming = false;
        showImagePreview(prepared.dataUrl);
      })
      .catch(function (err) {
        if (token !== imageToken) return;
        pendingImage = null;
        imageIncoming = false;
        imageFailed = true;
        showImagePreview('');
        setFormError(err && err.message ? err.message : IMAGE_READ_ERROR);
      });
  }

  function clearDroppedImage() {
    resetPendingImage();
    var fileInput = document.getElementById('ad-service-image-file');
    var form = document.getElementById('ad-service-form');
    if (fileInput) fileInput.value = '';
    if (form && form.elements.imageUrl) form.elements.imageUrl.value = '';
    showImagePreview('');
  }

  function bindImageDrop() {
    var zone = document.getElementById('ad-service-drop');
    var fileInput = document.getElementById('ad-service-image-file');
    var clearBtn = document.getElementById('ad-service-image-clear');
    var form = document.getElementById('ad-service-form');
    if (zone && fileInput && !zone.dataset.boundImageDrop) {
      zone.dataset.boundImageDrop = '1';
      if (window.hubBindImageUpload) {
        window.hubBindImageUpload({
          zone: zone,
          fileInput: fileInput,
          onFile: setDroppedImage,
          uploadOptions: { decodeLater: true },
        });
      }
      zone.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          fileInput.click();
        }
      });
    }
    if (clearBtn && !clearBtn.dataset.boundImageClear) {
      clearBtn.dataset.boundImageClear = '1';
      clearBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        clearDroppedImage();
      });
    }
    if (form && form.elements.imageUrl && !form.elements.imageUrl.dataset.boundImageUrl) {
      form.elements.imageUrl.dataset.boundImageUrl = '1';
      form.elements.imageUrl.addEventListener('input', function () {
        var url = String(form.elements.imageUrl.value || '').trim();
        if (!url) {
          if (!pendingImage && !imageIncoming) showImagePreview('');
          return;
        }
        resetPendingImage();
        if (fileInput) fileInput.value = '';
        showImagePreview(url);
      });
    }
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
      promoCode: form.elements.promoCode.value,
      endsOn: form.elements.endsOn.value,
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
        var ready = imagePrepare.then(function () {
          if (imageFailed) throw new Error(IMAGE_READ_ERROR);
          if (pendingImage) {
            payload.imageBase64 = pendingImage.dataUrl;
            payload.imageMime = pendingImage.type;
            payload.imageFilename = pendingImage.name;
            payload.imageUrl = '';
          }
          var hasPicture = Boolean(pendingImage) || String(payload.imageUrl || '').trim();
          if (payload.published && (!String(payload.href || '').trim() || !hasPicture)) {
            throw new Error('Add a link and a picture before publishing this offer.');
          }
          return payload;
        });
        ready
          .then(function (body) {
            return send(method, body);
          })
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
    var playbookModal = document.getElementById('ad-playbook-modal');
    if (playbookModal && !playbookModal.dataset.bound) {
      playbookModal.dataset.bound = '1';
      var closePlaybook = document.getElementById('ad-playbook-modal-close');
      var playbookBackdrop = document.getElementById('ad-playbook-modal-backdrop');
      if (closePlaybook) closePlaybook.addEventListener('click', closePlaybookModal);
      if (playbookBackdrop) playbookBackdrop.addEventListener('click', closePlaybookModal);
    }

    var services = document.querySelector('.ad-services');
    if (services && !services.dataset.boundServiceClicks) {
      services.dataset.boundServiceClicks = '1';
      services.addEventListener('click', function (event) {
        var playbookBtn = event.target.closest('[data-playbook-open]');
        if (playbookBtn) {
          event.preventDefault();
          event.stopPropagation();
          openPlaybookModal(playbookBtn.getAttribute('data-playbook-open'));
          return;
        }
        var copyBtn = event.target.closest('[data-service-copy-code]');
        if (copyBtn) {
          event.preventDefault();
          var code = copyBtn.getAttribute('data-service-copy-code') || '';
          var done = function () {
            copyBtn.textContent = 'Copied';
          };
          if (code && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(done).catch(function () {});
          }
          return;
        }
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
          if (!current.published && !offerIsPublishable(current)) {
            loadError = 'Add a link and a picture before publishing this offer.';
            render();
            return;
          }
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
        var playbookModalEl = document.getElementById('ad-playbook-modal');
        if (playbookModalEl && !playbookModalEl.hidden) {
          closePlaybookModal();
          return;
        }
        var modal = document.getElementById('ad-service-modal');
        if (modal && !modal.hidden) closeForm();
        else if (detailIdFromHash()) location.hash = 'services';
      }
    });
  }

  var started = false;
  var member = { name: '', email: '' };

  function offerIsPublishable(offer) {
    return Boolean(offer && offer.href && offer.imageUrl);
  }

  function setPitchError(message) {
    var el = document.getElementById('ad-services-pitch-error');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
  }

  function showPitchForm(open) {
    var intro = document.getElementById('ad-services-pitch-intro');
    var form = document.getElementById('ad-services-pitch-form');
    var done = document.getElementById('ad-services-pitch-done');
    var from = document.getElementById('ad-services-pitch-from');
    if (intro) intro.hidden = open;
    if (form) form.hidden = !open;
    if (done) done.hidden = true;
    if (open && from) {
      var who = member.name ? member.name : 'your account';
      from.textContent = member.email
        ? 'Sending as ' + who + ' (' + member.email + ').'
        : 'Sending from your signed-in account.';
    }
    if (open) setPitchError('');
  }

  function showPitchDone(message) {
    var intro = document.getElementById('ad-services-pitch-intro');
    var form = document.getElementById('ad-services-pitch-form');
    var done = document.getElementById('ad-services-pitch-done');
    if (intro) intro.hidden = true;
    if (form) form.hidden = true;
    if (done) {
      done.hidden = false;
      if (message) done.textContent = message;
    }
  }

  function bindPitch() {
    var openBtn = document.getElementById('ad-services-pitch-open');
    var cancelBtn = document.getElementById('ad-services-pitch-cancel');
    var form = document.getElementById('ad-services-pitch-form');
    if (openBtn && !openBtn.dataset.boundPitchOpen) {
      openBtn.dataset.boundPitchOpen = '1';
      openBtn.addEventListener('click', function () {
        showPitchForm(true);
        var field = form && form.elements.offer;
        if (field) field.focus();
      });
    }
    if (cancelBtn && !cancelBtn.dataset.boundPitchCancel) {
      cancelBtn.dataset.boundPitchCancel = '1';
      cancelBtn.addEventListener('click', function () {
        showPitchForm(false);
      });
    }
    if (form && !form.dataset.boundPitchForm) {
      form.dataset.boundPitchForm = '1';
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        setPitchError('');
        var offerText = String(form.elements.offer.value || '').trim();
        if (offerText.length < 10) {
          setPitchError('Tell us what you offer, in a sentence or two.');
          return;
        }
        var sendBtn = document.getElementById('ad-services-pitch-send');
        if (sendBtn) sendBtn.disabled = true;
        fetch('/api/auth/member-offer-enquire', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offer: offerText,
            audience: form.elements.audience.value,
            website: form.elements.website.value,
          }),
        })
          .then(function (res) {
            return res.json().then(function (data) {
              return { ok: res.ok, data: data || {} };
            });
          })
          .then(function (result) {
            if (!result.ok || !result.data.ok) {
              setPitchError(
                (result.data && result.data.message) ||
                  'Could not send that just now. Email partnerships@thenetworkeruk.com instead.'
              );
              return;
            }
            form.reset();
            showPitchDone(result.data.message);
          })
          .catch(function () {
            setPitchError('Could not send that just now. Email partnerships@thenetworkeruk.com instead.');
          })
          .then(function () {
            if (sendBtn) sendBtn.disabled = false;
          });
      });
    }
  }

  function init(options) {
    if (started) return;
    started = true;
    if (options && options.member) {
      member.name = String(options.member.name || '').trim();
      member.email = String(options.member.email || '').trim();
    }
    bind();
    bindImageDrop();
    bindPitch();
    onChange = options && options.onChange;
    if (options && options.isAdmin) canManage = true;
    reload();
  }

  window.HubAttendeeServices = {
    init: init,
    render: render,
    publishedCount: publishedCount,
    featuredDeal: featuredDeal,
    routeHash: function () {
      var id = detailIdFromHash();
      return id ? '#services/' + id : '#services';
    },
  };
})();
