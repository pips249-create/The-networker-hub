/**
 * CMS ad blocks — sidebar and horizontal banner placements from cms_blocks.
 */
(function () {
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function normalizeCta(url) {
    var u = String(url || '').trim();
    if (!u) return '#';
    if (/^(https?:|mailto:)/i.test(u)) return u;
    return '#';
  }

  function taglineFromBlock(block) {
    if (window.CmsSponsorFields) return window.CmsSponsorFields.tagline(block);
    var title = String(block.title || '').trim();
    if (title) return title;
    var subtitle = String(block.subtitle || '').trim();
    if (subtitle) return subtitle;
    var temp = document.createElement('div');
    temp.innerHTML = String(block.body || '');
    var h3 = temp.querySelector('h3');
    return h3 ? h3.textContent.trim() : '';
  }

  function bulletsFromBody(body) {
    var temp = document.createElement('div');
    temp.innerHTML = String(body || '');
    return Array.prototype.map
      .call(temp.querySelectorAll('li'), function (li) {
        return li.textContent.trim();
      })
      .filter(Boolean);
  }

  function bodyTextFromBlock(block) {
    var bullets = bulletsFromBody(block.body);
    if (bullets.length) return bullets.join(' · ');
    var temp = document.createElement('div');
    temp.innerHTML = String(block.body || '');
    temp.querySelectorAll('h3').forEach(function (el) {
      el.remove();
    });
    return temp.textContent.replace(/\s+/g, ' ').trim();
  }

  function taglineHtml(text) {
    var raw = String(text || '').trim();
    if (!raw) return '';
    var colon = raw.indexOf(':');
    if (colon === -1) return esc(raw);
    return (
      '<em>' +
      esc(raw.slice(0, colon + 1).trim()) +
      '</em> ' +
      esc(raw.slice(colon + 1).trim())
    );
  }

  function logoMarkup(logoUrl, imgClass, placeholderClass) {
    var url = String(logoUrl || '').trim();
    var hasLogo = window.CmsSponsorFields ? window.CmsSponsorFields.isLogoUrl(url) : /^https?:\/\//i.test(url);
    if (hasLogo) {
      return (
        '<div class="sponsor-logo-wrap sponsor-logo-band has-logo">' +
        '<img class="' +
        imgClass +
        ' sponsor-logo--full" src="' +
        esc(url) +
        '" alt="" loading="lazy" decoding="async" crossorigin="anonymous" ' +
        'onload="window.CmsSponsorFields&&window.CmsSponsorFields.applyLogoBand(this.parentElement,this,true)">' +
        '</div>'
      );
    }
    return (
      '<div class="sponsor-logo-wrap sponsor-logo-band">' +
      '<div class="' +
      placeholderClass +
      '">Your logo here</div></div>'
    );
  }

  function renderSidebarAd(container, block) {
    if (!container || !block) return;
    var company = window.CmsSponsorFields
      ? window.CmsSponsorFields.companyName(block)
      : String(block.company_name || '').trim();
    var tagline = taglineFromBlock(block);
    var bullets = bulletsFromBody(block.body);
    var logo = window.CmsSponsorFields ? window.CmsSponsorFields.logoUrl(block) : block.logo_url;
    var ctaLabel = String(block.cta_label || '').trim() || 'Enquire now';
    var ctaUrl = normalizeCta(block.cta_url);
    var list =
      bullets.length > 0
        ? '<ul class="cms-ad-list">' +
          bullets
            .map(function (line) {
              return '<li>' + esc(line) + '</li>';
            })
            .join('') +
          '</ul>'
        : '';

    container.hidden = false;
    container.innerHTML =
      '<aside class="cms-ad-sidebar sponsor-hub sponsor-hub--active">' +
      '<span class="sponsor-hub-badge">Sponsored</span>' +
      '<div class="sponsor-hub-head"><span class="icon" aria-hidden="true">★</span><span>Sponsor Hub</span></div>' +
      logoMarkup(logo, 'sponsor-logo', 'sponsor-logo-placeholder') +
      (company ? '<p class="sponsor-company">' + esc(company) + '</p>' : '') +
      (tagline ? '<p class="sponsor-tagline">' + taglineHtml(tagline) + '</p>' : '') +
      (list ? '<div class="sponsor-body">' + list + '</div>' : '') +
      '<a class="sponsor-cta" href="' +
      esc(ctaUrl) +
      '">' +
      esc(ctaLabel) +
      '</a>' +
      '</aside>';
  }

  function renderBannerAd(container, block) {
    if (!container || !block) return;
    var company = window.CmsSponsorFields
      ? window.CmsSponsorFields.companyName(block)
      : String(block.company_name || '').trim();
    var title = taglineFromBlock(block);
    var bodyText = bodyTextFromBlock(block);
    var logo = window.CmsSponsorFields ? window.CmsSponsorFields.logoUrl(block) : block.logo_url;
    var ctaLabel = String(block.cta_label || '').trim() || 'Learn more';
    var ctaUrl = normalizeCta(block.cta_url);

    container.hidden = false;
    container.innerHTML =
      '<aside class="cms-ad-banner">' +
      '<span class="cms-ad-banner-badge">Sponsored</span>' +
      '<div class="cms-ad-banner-logo">' +
      logoMarkup(logo, 'cms-ad-banner-logo-img', 'cms-ad-banner-logo-placeholder') +
      '</div>' +
      '<div class="cms-ad-banner-copy">' +
      (company ? '<p class="cms-ad-banner-company">' + esc(company) + '</p>' : '') +
      (title ? '<p class="cms-ad-banner-title">' + taglineHtml(title) + '</p>' : '') +
      (bodyText ? '<p class="cms-ad-banner-body">' + esc(bodyText) + '</p>' : '') +
      '</div>' +
      '<a class="cms-ad-banner-cta" href="' +
      esc(ctaUrl) +
      '">' +
      esc(ctaLabel) +
      '</a>' +
      '</aside>';
  }

  function loadCmsAd(slot) {
    return fetch('/api/cms-block?slot=' + encodeURIComponent(slot) + '&_=' + Date.now(), {
      cache: 'no-store',
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok && data.block) return data.block;
        return null;
      })
      .catch(function () {
        return null;
      });
  }

  window.CmsAdBlocks = {
    renderSidebarAd: renderSidebarAd,
    renderBannerAd: renderBannerAd,
    loadCmsAd: loadCmsAd,
  };
})();
