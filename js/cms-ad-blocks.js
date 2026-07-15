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
    var cta = container.querySelector('.sponsor-cta');
    if (cta && window.CmsSponsorFields) {
      window.CmsSponsorFields.applyCtaColor(cta, window.CmsSponsorFields.ctaColor(block));
      window.CmsSponsorFields.applyCtaLink(cta, ctaUrl);
    }
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
    var bannerCta = container.querySelector('.cms-ad-banner-cta');
    if (bannerCta && window.CmsSponsorFields) {
      window.CmsSponsorFields.applyCtaColor(bannerCta, window.CmsSponsorFields.ctaColor(block));
      window.CmsSponsorFields.applyCtaLink(bannerCta, ctaUrl);
    }
  }

  function isCompactRenderable(block) {
    if (!block || block.active === false) return false;
    var logo = window.CmsSponsorFields ? window.CmsSponsorFields.logoUrl(block) : block.logo_url;
    var hasLogo = window.CmsSponsorFields
      ? window.CmsSponsorFields.isLogoUrl(logo)
      : /^https?:\/\//i.test(String(logo || '').trim());
    var ctaLabel = String(block.cta_label || '').trim();
    var ctaUrl = String(block.cta_url || '').trim();
    var hasCtaUrl = /^https?:\/\//i.test(ctaUrl) && ctaUrl.replace(/^https?:\/\//i, '').trim().length > 0;
    return hasLogo && ctaLabel && hasCtaUrl;
  }

  function renderCompactAd(container, block) {
    if (!container || !block) return;
    if (!isCompactRenderable(block)) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }
    var logo = window.CmsSponsorFields ? window.CmsSponsorFields.logoUrl(block) : block.logo_url;
    var ctaLabel = String(block.cta_label || '').trim() || 'Learn more';
    var ctaUrl = normalizeCta(block.cta_url);

    container.hidden = false;
    container.innerHTML =
      '<aside class="cms-ad-compact">' +
      '<span class="cms-ad-compact-badge">Sponsored</span>' +
      logoMarkup(logo, 'cms-ad-compact-logo', 'cms-ad-compact-logo-placeholder') +
      '<a class="cms-ad-compact-cta" href="' +
      esc(ctaUrl) +
      '">' +
      esc(ctaLabel) +
      '</a>' +
      '</aside>';
    var compactCta = container.querySelector('.cms-ad-compact-cta');
    if (compactCta && window.CmsSponsorFields) {
      window.CmsSponsorFields.applyCtaColor(compactCta, window.CmsSponsorFields.ctaColor(block));
      window.CmsSponsorFields.applyCtaLink(compactCta, ctaUrl);
    }
  }

  function renderCityPartnerAd(container, block) {
    if (!container || !block) return false;
    if (!isCompactRenderable(block)) {
      container.hidden = true;
      container.innerHTML = '';
      return false;
    }
    var logo = window.CmsSponsorFields ? window.CmsSponsorFields.logoUrl(block) : block.logo_url;
    var ctaLabel = String(block.cta_label || '').trim() || 'Find out more';
    var ctaUrl = normalizeCta(block.cta_url);
    var company = window.CmsSponsorFields ? window.CmsSponsorFields.companyName(block) : block.company_name;

    container.hidden = false;
    container.innerHTML =
      '<aside class="networking-city-partner-ad" aria-label="City partner">' +
      '<span class="networking-city-partner-badge">City partner</span>' +
      logoMarkup(logo, 'networking-city-partner-logo', 'networking-city-partner-logo-placeholder') +
      '<a class="networking-city-partner-cta" href="' +
      esc(ctaUrl) +
      '">' +
      esc(ctaLabel) +
      '</a>' +
      '</aside>';

    if (company) container.setAttribute('data-company', company);

    var partnerCta = container.querySelector('.networking-city-partner-cta');
    if (partnerCta && window.CmsSponsorFields) {
      window.CmsSponsorFields.applyCtaColor(partnerCta, window.CmsSponsorFields.ctaColor(block));
      window.CmsSponsorFields.applyCtaLink(partnerCta, ctaUrl);
    }
    return true;
  }

  function loadCmsAd(slot) {
    return fetch('/api/cms-block?slot=' + encodeURIComponent(slot))
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

  function renderHeroSponsorAd(container, block) {
    if (!container || !block) return;
    renderSidebarAd(container, block);
    var aside = container.querySelector('.sponsor-hub');
    if (aside) {
      aside.classList.add('sponsor-hub--in-hero');
    }
  }

  function loadEventPageCarousel() {
    return fetch('/api/cms-block?slot=event_page_carousel_ads')
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok) return [];
        if (Array.isArray(data.ads) && data.ads.length) return data.ads;
        return [];
      })
      .catch(function () {
        return [];
      });
  }

  function shuffleArray(list) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function logoLinkMarkup(logoUrl, linkUrl, ariaLabel, fillBox) {
    var url = String(logoUrl || '').trim();
    var href = normalizeCta(linkUrl);
    var hasLogo = window.CmsSponsorFields ? window.CmsSponsorFields.isLogoUrl(url) : /^https?:\/\//i.test(url);
    var label = esc(String(ariaLabel || 'Sponsored partner').trim() || 'Sponsored partner');
    var imgClass = 'cms-ad-logo-only-img sponsor-logo--full' + (fillBox ? ' cms-ad-logo-only-img--fill' : '');
    var inner = hasLogo
      ? '<img class="' +
        imgClass +
        '" src="' +
        esc(url) +
        '" alt="" loading="lazy" decoding="async" crossorigin="anonymous">'
      : '<div class="cms-ad-logo-only-placeholder">Your logo here</div>';
    return (
      '<a class="cms-ad-logo-link' +
      (fillBox ? ' cms-ad-logo-link--fill' : '') +
      '" href="' +
      esc(href) +
      '" aria-label="' +
      label +
      '">' +
      '<div class="sponsor-logo-wrap sponsor-logo-band' +
      (hasLogo ? ' has-logo' : '') +
      (fillBox ? ' sponsor-logo-wrap--fill' : '') +
      '">' +
      inner +
      '</div></a>'
    );
  }

  function carouselAriaLabel(block) {
    var company = window.CmsSponsorFields
      ? window.CmsSponsorFields.companyName(block)
      : String(block.company_name || '').trim();
    return company ? 'Visit ' + company : 'Sponsored partner';
  }

  function applyLogoLink(el, linkUrl) {
    if (!el || !window.CmsSponsorFields) return;
    window.CmsSponsorFields.applyCtaLink(el, normalizeCta(linkUrl));
  }

  function renderLogoOnlyAd(container, block) {
    if (!container || !block) return false;
    var logo = window.CmsSponsorFields ? window.CmsSponsorFields.logoUrl(block) : block.logo_url;
    var linkUrl = normalizeCta(block.cta_url);
    if (!logo || !linkUrl || linkUrl === '#') {
      container.hidden = true;
      container.innerHTML = '';
      return false;
    }
    container.hidden = false;
    container.innerHTML =
      '<aside class="cms-ad-logo-only cms-ad-logo-only--fill">' +
      '<span class="cms-ad-logo-only-badge">Sponsored</span>' +
      logoLinkMarkup(logo, linkUrl, carouselAriaLabel(block), true) +
      '</aside>';
    applyLogoLink(container.querySelector('.cms-ad-logo-link'), block.cta_url);
    return true;
  }

  function renderCompactSlideHtml(block, slideIndex, total) {
    var logo = window.CmsSponsorFields ? window.CmsSponsorFields.logoUrl(block) : block.logo_url;
    var linkUrl = normalizeCta(block.cta_url);
    var isActive = slideIndex === 0 ? ' is-active' : '';
    return (
      '<div class="cms-ad-carousel-slide' +
      isActive +
      '" data-carousel-slide="' +
      slideIndex +
      '" role="group" aria-roledescription="slide" aria-label="Sponsor ' +
      (slideIndex + 1) +
      ' of ' +
      total +
      '">' +
      '<aside class="cms-ad-logo-only cms-ad-logo-only--fill">' +
      '<span class="cms-ad-logo-only-badge">Sponsored</span>' +
      logoLinkMarkup(logo, linkUrl, carouselAriaLabel(block), true) +
      '</aside></div>'
    );
  }

  function renderCarouselAd(container, ads) {
    if (!container) return false;
    var list = Array.isArray(ads) ? ads : [];
    if (!list.length) {
      container.hidden = true;
      container.innerHTML = '';
      return false;
    }

    if (list.length === 1) {
      return renderLogoOnlyAd(container, list[0]);
    }

    list = shuffleArray(list);

    var dots = list
      .map(function (_ad, index) {
        return (
          '<button type="button" class="cms-ad-carousel-dot' +
          (index === 0 ? ' is-active' : '') +
          '" data-carousel-dot="' +
          index +
          '" aria-label="Show sponsor ' +
          (index + 1) +
          '"></button>'
        );
      })
      .join('');

    container.hidden = false;
    container.innerHTML =
      '<div class="cms-ad-carousel" data-carousel-count="' +
      list.length +
      '">' +
      '<div class="cms-ad-carousel-viewport" aria-live="polite">' +
      '<div class="cms-ad-carousel-track">' +
      list.map(function (block, index) {
        return renderCompactSlideHtml(block, index, list.length);
      }).join('') +
      '</div></div>' +
      '<div class="cms-ad-carousel-controls">' +
      '<button type="button" class="cms-ad-carousel-arrow cms-ad-carousel-arrow--prev" aria-label="Previous sponsor">‹</button>' +
      '<div class="cms-ad-carousel-dots" role="tablist" aria-label="Sponsor adverts">' +
      dots +
      '</div>' +
      '<button type="button" class="cms-ad-carousel-arrow cms-ad-carousel-arrow--next" aria-label="Next sponsor">›</button>' +
      '</div></div>';

    list.forEach(function (block, index) {
      var slide = container.querySelector('[data-carousel-slide="' + index + '"]');
      if (!slide) return;
      applyLogoLink(slide.querySelector('.cms-ad-logo-link'), block.cta_url);
    });

    initCarousel(container.querySelector('.cms-ad-carousel'));
    return true;
  }

  var carouselTimers = new WeakMap();

  function setCarouselSlide(root, index) {
    if (!root) return;
    var count = parseInt(root.getAttribute('data-carousel-count'), 10) || 0;
    if (!count) return;
    var next = ((index % count) + count) % count;
    root.setAttribute('data-carousel-index', String(next));
    root.querySelectorAll('[data-carousel-slide]').forEach(function (slide) {
      var slideIndex = parseInt(slide.getAttribute('data-carousel-slide'), 10);
      slide.classList.toggle('is-active', slideIndex === next);
      slide.setAttribute('aria-hidden', slideIndex === next ? 'false' : 'true');
    });
    root.querySelectorAll('[data-carousel-dot]').forEach(function (dot) {
      var dotIndex = parseInt(dot.getAttribute('data-carousel-dot'), 10);
      var active = dotIndex === next;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function stopCarouselAuto(root) {
    var timer = carouselTimers.get(root);
    if (timer) {
      clearInterval(timer);
      carouselTimers.delete(root);
    }
  }

  function startCarouselAuto(root) {
    stopCarouselAuto(root);
    var count = parseInt(root.getAttribute('data-carousel-count'), 10) || 0;
    if (count < 2) return;
    var timer = setInterval(function () {
      var current = parseInt(root.getAttribute('data-carousel-index') || '0', 10) || 0;
      setCarouselSlide(root, current + 1);
    }, 4000);
    carouselTimers.set(root, timer);
  }

  function initCarousel(root) {
    if (!root || root.dataset.carouselBound === '1') return;
    root.dataset.carouselBound = '1';
    setCarouselSlide(root, 0);

    root.addEventListener('click', function (ev) {
      if (ev.target.closest('.cms-ad-logo-link')) return;
      var dot = ev.target.closest('[data-carousel-dot]');
      if (dot) {
        setCarouselSlide(root, parseInt(dot.getAttribute('data-carousel-dot'), 10) || 0);
        startCarouselAuto(root);
        return;
      }
      if (ev.target.closest('.cms-ad-carousel-arrow--prev')) {
        var current = parseInt(root.getAttribute('data-carousel-index') || '0', 10) || 0;
        setCarouselSlide(root, current - 1);
        startCarouselAuto(root);
        return;
      }
      if (ev.target.closest('.cms-ad-carousel-arrow--next')) {
        current = parseInt(root.getAttribute('data-carousel-index') || '0', 10) || 0;
        setCarouselSlide(root, current + 1);
        startCarouselAuto(root);
      }
    });

    startCarouselAuto(root);
  }

  function loadPageCarouselAds(container) {
    if (!container) return Promise.resolve(false);
    return loadEventPageCarousel().then(function (ads) {
      return renderCarouselAd(container, ads);
    });
  }

  window.CmsAdBlocks = {
    renderSidebarAd: renderSidebarAd,
    renderHeroSponsorAd: renderHeroSponsorAd,
    renderBannerAd: renderBannerAd,
    renderCompactAd: renderCompactAd,
    renderCityPartnerAd: renderCityPartnerAd,
    renderCarouselAd: renderCarouselAd,
    renderLogoOnlyAd: renderLogoOnlyAd,
    isCompactRenderable: isCompactRenderable,
    loadCmsAd: loadCmsAd,
    loadEventPageCarousel: loadEventPageCarousel,
    loadPageCarouselAds: loadPageCarouselAds,
    initCarousel: initCarousel,
  };
})();
