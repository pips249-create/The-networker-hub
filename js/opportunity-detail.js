/**
 * Opportunity detail page — ?id=opp-1
 */
(function () {
  var catalog = window.HubOpportunitiesCatalog;
  var saves = window.HubOpportunitySaves;
  var current = null;

  var els = {
    notFound: document.getElementById('opp-not-found'),
    layout: document.getElementById('opp-detail-layout'),
    trailCurrent: document.getElementById('opp-trail-current'),
    hostLogo: document.getElementById('opp-host-logo'),
    typeBadge: document.getElementById('opp-type-badge'),
    featuredPip: document.getElementById('opp-featured-pip'),
    title: document.getElementById('opp-title'),
    hostName: document.getElementById('opp-host-name'),
    saveBtn: document.getElementById('opp-save-btn'),
    metaGrid: document.getElementById('opp-meta-grid'),
    desc: document.getElementById('opp-desc'),
    aboutExtra: document.getElementById('opp-about-extra'),
    cover: document.getElementById('opp-detail-cover'),
    coverImg: document.getElementById('opp-detail-cover-img'),
    posterLogo: document.getElementById('opp-poster-logo'),
    posterName: document.getElementById('opp-poster-name'),
    form: document.getElementById('opp-enquire-form'),
    mailto: document.getElementById('opp-enquire-mailto'),
    submit: document.getElementById('opp-enquire-submit'),
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function shortTitle(title) {
    var t = String(title || '');
    return t.length > 48 ? t.slice(0, 45) + '…' : t;
  }

  function resolveId() {
    var params = new URLSearchParams(window.location.search);
    return params.get('id') || '';
  }

  function showNotFound() {
    document.title = 'Opportunity not found – The Networker Hub';
    if (els.notFound) els.notFound.hidden = false;
    if (els.layout) els.layout.hidden = true;
    if (els.trailCurrent) els.trailCurrent.textContent = 'Not found';
  }

  function applyCoverImage(item) {
    if (!els.cover || !els.coverImg || !item) return;
    if (item.imageUrl) {
      els.coverImg.src = item.imageUrl;
      els.coverImg.alt = item.host ? item.host + ' logo' : 'Opportunity image';
      els.cover.hidden = false;
      return;
    }
    els.cover.hidden = true;
    els.coverImg.removeAttribute('src');
    els.coverImg.alt = '';
  }

  function applyHostLogo(el, item) {
    if (!el || !item) return;
    if (item.imageUrl) {
      el.textContent = '';
      el.style.background = '#fff';
      el.classList.add('has-logo');
      el.innerHTML =
        '<img src="' +
        escapeHtml(item.imageUrl) +
        '" alt="" width="40" height="40" loading="lazy" />';
      return;
    }
    el.classList.remove('has-logo');
    el.innerHTML = '';
    el.textContent = item.hostInitials || '';
    el.style.background = item.hostColor || '#0d1f3c';
  }

  function refreshSaveButton() {
    if (!els.saveBtn || !current) return;
    var saved = saves && saves.isSaved(current.id);
    els.saveBtn.classList.toggle('is-active', saved);
    els.saveBtn.setAttribute('aria-pressed', saved ? 'true' : 'false');
    els.saveBtn.setAttribute('aria-label', saved ? 'Remove from saved' : 'Save opportunity');
  }

  function renderAbout(item) {
    if (!els.aboutExtra) return;
    var paras = (item.about || []).slice();
    if (!paras.length) {
      els.aboutExtra.innerHTML = '';
      return;
    }
    els.aboutExtra.innerHTML = paras
      .map(function (p) {
        return '<p>' + escapeHtml(p) + '</p>';
      })
      .join('');
  }

  function renderMeta(item) {
    if (!els.metaGrid) return;
    els.metaGrid.innerHTML = (item.meta || [])
      .map(function (m) {
        var val = catalog && catalog.formatMetaDisplayValue ? catalog.formatMetaDisplayValue(m.key, m.val) : m.val;
        return (
          '<div class="opp-detail-meta-item">' +
          '<span class="opp-detail-meta-key">' +
          escapeHtml(m.key) +
          '</span>' +
          '<span class="opp-detail-meta-val">' +
          escapeHtml(val) +
          '</span>' +
          '</div>'
        );
      })
      .join('');
  }

  function enquiryEmail(item) {
    var email = String((item && item.contactEmail) || '').trim();
    return email || 'hello@the-networker.co.uk';
  }

  function buildMailto(item, name, email, message) {
    var subject = 'Opportunity enquiry: ' + item.title;
    var body =
      'Name: ' +
      name +
      '\nEmail: ' +
      email +
      '\n\n' +
      message +
      '\n\n—\nSent via The Networker Hub\nListing: ' +
      window.location.href;
    return (
      'mailto:' +
      encodeURIComponent(enquiryEmail(item)) +
      '?subject=' +
      encodeURIComponent(subject) +
      '&body=' +
      encodeURIComponent(body)
    );
  }

  function render(item) {
    current = item;
    document.title = item.title + ' – The Networker Hub';

    if (els.trailCurrent) els.trailCurrent.textContent = shortTitle(item.title);
    if (els.title) els.title.textContent = item.title;
    if (els.hostName) els.hostName.textContent = item.host;
    if (els.desc) els.desc.textContent = item.desc;
    if (els.posterName) els.posterName.textContent = item.host;

    applyCoverImage(item);
    applyHostLogo(els.hostLogo, item);
    applyHostLogo(els.posterLogo, item);

    if (els.hostLogo && item.imageUrl) {
      els.hostLogo.hidden = true;
    } else if (els.hostLogo) {
      els.hostLogo.hidden = false;
    }

    if (els.typeBadge) {
      els.typeBadge.textContent = catalog.TYPE_LABELS[item.type] || item.type;
      els.typeBadge.className = 'opp-type-badge ' + catalog.typeClass(item.type);
    }

    if (els.featuredPip) els.featuredPip.hidden = !item.featured;

    renderMeta(item);
    renderAbout(item);
    refreshSaveButton();

    if (els.mailto) {
      els.mailto.href = buildMailto(item, '', '', 'I would like to find out more about this opportunity.');
    }

    if (els.notFound) els.notFound.hidden = true;
    if (els.layout) els.layout.hidden = false;
  }

  function bindSave() {
    if (!els.saveBtn) return;
    els.saveBtn.addEventListener('click', function () {
      if (!current || !saves) return;
      saves.toggle(current.id);
      refreshSaveButton();
    });
  }

  function bindForm() {
    if (!els.form) return;
    els.form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!current) return;

      var name = (document.getElementById('opp-enquire-name').value || '').trim();
      var email = (document.getElementById('opp-enquire-email').value || '').trim();
      var message = (document.getElementById('opp-enquire-message').value || '').trim();
      if (!name || !email || !message) return;

      window.location.href = buildMailto(current, name, email, message);

      if (els.submit) {
        els.submit.textContent = 'Opening your email app…';
        els.submit.disabled = true;
      }
    });
  }

  function loadSidebarAd() {
    if (!window.CmsAdBlocks) return;
    var el = document.getElementById('opportunity-page-sidebar-ad');
    if (!el) return;

    window.CmsAdBlocks.loadCmsAd('opportunity_page_sidebar_ad')
      .then(function (block) {
        window.CmsAdBlocks.renderCompactAd(el, block);
      })
      .catch(function () {});
  }

  function finishInit(item) {
    if (!item) {
      showNotFound();
      return;
    }
    render(item);
    bindSave();
    bindForm();
    loadSidebarAd();
  }

  function init() {
    if (!catalog) {
      showNotFound();
      return;
    }

    var id = resolveId();
    var item = catalog.getById(id);
    if (item) {
      finishInit(item);
      return;
    }

    if (catalog.fetchById) {
      catalog.fetchById(id).then(finishInit);
      return;
    }

    showNotFound();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
