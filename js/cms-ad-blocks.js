/**
 * CMS ad blocks — sidebar and horizontal banner placements from cms_blocks.
 */
(function () {
  var PLACEMENT_AD_PATHS = {
    events_sponsor_hub: '/advertising#ad-panel-events',
    organisers_sponsor_hub: '/advertising#ad-panel-organisers',
    opportunities_sponsor_hub: '/advertising#ad-panel-opportunities',
    event_page_carousel_ads: '/advertising#ad-panel-events',
    organiser_page_carousel_ads: '/advertising#ad-panel-organisers',
    opportunity_page_carousel_ads: '/advertising#ad-panel-opportunities',
    opportunity_page_sidebar_ad: '/advertising#ad-panel-opportunities',
  };

  var PLACEHOLDER_COPY = {
    event_page_carousel_ads: {
      headline: 'Advertise your business here',
      price: '£600 / month + VAT',
      cta: 'Advertise here →',
    },
    organiser_page_carousel_ads: {
      headline: 'Advertise your business here',
      price: '£300 / month + VAT',
      cta: 'Advertise here →',
    },
    opportunity_page_carousel_ads: {
      headline: 'Advertise your business here',
      price: '£600 / month + VAT',
      cta: 'Advertise here →',
    },
    opportunity_page_sidebar_ad: {
      headline: 'Advertise your business here',
      price: '£600 / month + VAT',
      cta: 'Advertise here →',
    },
  };

  var CAROUSEL_MAX_SLOTS = 3;

  function advertisingPathForSlot(slotOrSubject) {
    var key = String(slotOrSubject || '').trim().toLowerCase();
    if (PLACEMENT_AD_PATHS[key]) return PLACEMENT_AD_PATHS[key];
    if (key.indexOf('networking_county_partner_') === 0) return '/advertising#county-partner-package';
    if (key.indexOf('networking_city_partner_') === 0) return '/advertising#city-partner-package';
    var subject = String(slotOrSubject || '');
    if (/organiser/i.test(subject)) return PLACEMENT_AD_PATHS.organiser_page_carousel_ads;
    if (/opportunit/i.test(subject)) return PLACEMENT_AD_PATHS.opportunity_page_carousel_ads;
    return PLACEMENT_AD_PATHS.event_page_carousel_ads;
  }

  function placeholderCopyForSlot(slotOrSubject) {
    var key = String(slotOrSubject || '').trim().toLowerCase();
    if (PLACEHOLDER_COPY[key]) return PLACEHOLDER_COPY[key];
    var subject = String(slotOrSubject || '');
    if (/organiser/i.test(subject)) return PLACEHOLDER_COPY.organiser_page_carousel_ads;
    if (/opportunit/i.test(subject)) return PLACEHOLDER_COPY.opportunity_page_carousel_ads;
    return PLACEHOLDER_COPY.event_page_carousel_ads;
  }

  function placeholderPitchHtml(copy) {
    return (
      '<div class="cms-ad-placeholder-pitch">' +
      '<p class="cms-ad-placeholder-headline">' +
      esc(copy.headline) +
      '</p>' +
      '<p class="cms-ad-placeholder-price">' +
      esc(copy.price) +
      '</p>' +
      '</div>'
    );
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function normalizeCta(url) {
    var u = String(url || '').trim();
    if (!u) return '#';
    if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
    /* Root-relative and in-page anchors are valid sponsor destinations */
    if (u.charAt(0) === '/' || u.charAt(0) === '#') return u;
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

  function logoBandDarkAttr(block) {
    if (window.CmsSponsorFields && window.CmsSponsorFields.logoBandDark(block)) {
      return ' data-logo-band-dark="true"';
    }
    return '';
  }

  function logoMarkup(logoUrl, imgClass, placeholderClass, block) {
    var url = String(logoUrl || '').trim();
    var hasLogo = window.CmsSponsorFields ? window.CmsSponsorFields.isLogoUrl(url) : /^https?:\/\//i.test(url);
    var darkAttr = logoBandDarkAttr(block);
    if (hasLogo) {
      return (
        '<div class="sponsor-logo-wrap sponsor-logo-band has-logo"' +
        darkAttr +
        '>' +
        '<img class="' +
        imgClass +
        ' sponsor-logo--full" src="' +
        esc(url) +
        '" alt="" loading="lazy" decoding="async" ' +
        'onload="window.CmsSponsorFields&&window.CmsSponsorFields.applyLogoBand(this.parentElement,this,true)" ' +
        'onerror="window.CmsAdBlocks&&window.CmsAdBlocks.hideBrokenCarouselImage(this)">' +
        '</div>'
      );
    }
    return (
      '<div class="sponsor-logo-wrap sponsor-logo-band"' +
      darkAttr +
      '>' +
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
      '<div class="sponsor-hub-head"><span class="icon" aria-hidden="true">★</span><span>Powered by</span></div>' +
      logoMarkup(logo, 'sponsor-logo', 'sponsor-logo-placeholder', block) +
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
      window.CmsSponsorFields.applyCtaLink(cta, ctaUrl, {
        placement: 'sponsor_sidebar',
        company: company,
        campaign: 'sponsor_sidebar',
      });
    }
    if (window.CmsSponsorFields && window.CmsSponsorFields.trackSponsorImpression) {
      window.CmsSponsorFields.trackSponsorImpression('sponsor_sidebar', company, {
        el: container,
      });
    }
  }

  function isCompactRenderable(block) {
    if (!block || block.active === false) return false;
    var logo = window.CmsSponsorFields ? window.CmsSponsorFields.logoUrl(block) : block.logo_url;
    var hasLogo = /^https:\/\//i.test(String(logo || '').trim());
    var ctaUrl = String(block.cta_url || '').trim();
    var hasCtaUrl = /^https?:\/\//i.test(ctaUrl) && ctaUrl.replace(/^https?:\/\//i, '').trim().length > 0;
    return hasLogo && hasCtaUrl;
  }

  function hideBrokenCarouselImage(img) {
    if (!img) return;
    var slide = img.closest('.cms-ad-carousel-slide, .cms-ad-logo-only, .cms-ad-compact');
    if (slide) slide.hidden = true;
    var carousel = img.closest('.cms-ad-carousel');
    if (!carousel) return;
    var visible = carousel.querySelectorAll('.cms-ad-carousel-slide:not([hidden])');
    if (!visible.length) {
      var host = carousel.closest('[id$="-sidebar-ad"], [id$="-ad"], aside, .cms-ad-slot');
      if (host) {
        host.hidden = true;
        host.innerHTML = '';
      }
    } else if (visible.length === 1) {
      carousel.querySelectorAll('.cms-ad-carousel-controls').forEach(function (el) {
        el.hidden = true;
      });
    }
  }

  function renderCompactAd(container, block, slot, options) {
    if (!container) return false;
    options = options || {};
    if (!block || !isCompactRenderable(block)) {
      if (options.showPlaceholder) {
        return renderCompactPlaceholder(container, slot);
      }
      container.hidden = true;
      container.innerHTML = '';
      return false;
    }
    var logo = window.CmsSponsorFields ? window.CmsSponsorFields.logoUrl(block) : block.logo_url;
    var ctaUrl = normalizeCta(block.cta_url);
    var company = window.CmsSponsorFields
      ? window.CmsSponsorFields.companyName(block)
      : String(block.company_name || '').trim();

    container.hidden = false;
    container.innerHTML =
      '<aside class="cms-ad-compact cms-ad-compact--logo-only">' +
      '<span class="cms-ad-compact-badge">Sponsored</span>' +
      '<a class="cms-ad-compact-logo-link" href="' +
      esc(ctaUrl) +
      '"' +
      (company ? ' title="' + esc(company) + '"' : '') +
      '>' +
      logoMarkup(logo, 'cms-ad-compact-logo', 'cms-ad-compact-logo-placeholder', block) +
      '</a>' +
      '</aside>';
    var logoLink = container.querySelector('.cms-ad-compact-logo-link');
    if (logoLink && window.CmsSponsorFields) {
      var placement = pagePartnerPlacement(slot || 'opportunity_page_sidebar_ad');
      window.CmsSponsorFields.applyCtaLink(logoLink, ctaUrl, {
        placement: placement,
        company: company,
        campaign: placement,
      });
      if (window.CmsSponsorFields.trackSponsorImpression) {
        window.CmsSponsorFields.trackSponsorImpression(placement, company, {
          el: container,
        });
      }
    }
    return true;
  }

  function cityPartnerLogoMarkup(logoUrl) {
    var url = String(logoUrl || '').trim();
    var hasLogo = window.CmsSponsorFields
      ? window.CmsSponsorFields.isLogoUrl(url)
      : /^(https?:|\/|data:image\/)/i.test(url);
    if (hasLogo) {
      return (
        '<img class="networking-city-partner-logo" src="' +
        esc(url) +
        '" alt="" loading="lazy" decoding="async">'
      );
    }
    return '<div class="networking-city-partner-logo-placeholder">Your logo here</div>';
  }

  function renderCityPartnerPlaceholder(container, slot) {
    if (!container) return false;
    var badge = regionPartnerBadge(slot);
    var href = regionPartnerAdvertiseHref(slot);
    container.hidden = false;
    container.removeAttribute('hidden');
    container.removeAttribute('data-company');
    container.innerHTML =
      '<aside class="networking-city-partner-ad networking-city-partner-ad--available" aria-label="' +
      esc(badge) +
      ' slot available">' +
      '<span class="networking-city-partner-badge">' +
      esc(badge) +
      '</span>' +
      '<a class="networking-city-partner-logo-link" href="' +
      esc(href) +
      '">' +
      '<div class="networking-city-partner-logo-placeholder">Get your business seen here</div>' +
      '<span class="networking-city-partner-placeholder-price">From £29 / month + VAT</span>' +
      '</a>' +
      '</aside>';
    return true;
  }

  function formatCityPartnerOpens(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  function renderCityPartnerWaitlist(container, cityPartner) {
    if (!container || !cityPartner) return false;
    var status = String(cityPartner.status || '').trim();
    if (status !== 'booked' && status !== 'booked_until') return false;

    var opensLabel = formatCityPartnerOpens(cityPartner.availableFrom);
    var statusText =
      status === 'booked_until' && opensLabel
        ? 'Currently sponsored · opens ' + opensLabel
        : 'City sponsor slot held · join the waitlist for the next opening.';
    var opensHtml = opensLabel
      ? '<p class="networking-city-partner-opens">Opens <strong>' + esc(opensLabel) + '</strong></p>'
      : '';

    container.hidden = false;
    container.removeAttribute('hidden');
    container.removeAttribute('data-company');
    container.innerHTML =
      '<aside class="networking-city-partner-ad networking-city-partner-ad--booked" aria-label="City Sponsor slot held">' +
      '<span class="networking-city-partner-badge">City Sponsor</span>' +
      '<p class="networking-city-partner-status">' +
      esc(statusText) +
      '</p>' +
      opensHtml +
      '<a class="networking-city-partner-waitlist-link" href="/advertising#city-partner-package">Join waitlist</a>' +
      '</aside>';
    return true;
  }

  function isCityPartnerRenderable(block) {
    if (!block || block.active === false) return false;
    var logo = window.CmsSponsorFields ? window.CmsSponsorFields.logoUrl(block) : block.logo_url;
    var hasLogo = window.CmsSponsorFields
      ? window.CmsSponsorFields.isLogoUrl(logo)
      : /^https?:\/\//i.test(String(logo || '').trim());
    var ctaUrl = String(block.cta_url || '').trim();
    var hasCtaUrl = /^https?:\/\//i.test(ctaUrl) && ctaUrl.replace(/^https?:\/\//i, '').trim().length > 0;
    return hasLogo && hasCtaUrl;
  }

  function renderCityPartnerAd(container, block, slot) {
    if (!container || !block) return false;
    if (!isCityPartnerRenderable(block)) {
      return renderCityPartnerPlaceholder(container, slot);
    }
    var badge = regionPartnerBadge(slot);
    var logo = window.CmsSponsorFields ? window.CmsSponsorFields.logoUrl(block) : block.logo_url;
    var ctaUrl = normalizeCta(block.cta_url);
    var company = window.CmsSponsorFields ? window.CmsSponsorFields.companyName(block) : block.company_name;
    var logoHtml = cityPartnerLogoMarkup(logo);

    container.hidden = false;
    container.removeAttribute('hidden');
    container.innerHTML =
      '<aside class="networking-city-partner-ad" aria-label="' +
      esc(badge) +
      '">' +
      '<span class="networking-city-partner-badge">' +
      esc(badge) +
      '</span>' +
      '<a class="networking-city-partner-logo-link" href="' +
      esc(ctaUrl) +
      '">' +
      logoHtml +
      '</a>' +
      '</aside>';

    if (company) container.setAttribute('data-company', company);
    else container.removeAttribute('data-company');

    var logoLink = container.querySelector('.networking-city-partner-logo-link');
    if (window.CmsSponsorFields && logoLink) {
      window.CmsSponsorFields.applyCtaLink(logoLink, ctaUrl, {
        placement: 'city_partner',
        company: company,
        campaign: 'city_partner',
      });
    }
    return true;
  }

  function loadCmsAd(slot) {
    return fetch('/api/cms-block?slot=' + encodeURIComponent(slot), { cache: 'no-store' })
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

  function loadCityPartnerSlot(slot) {
    return fetch('/api/cms-block?slot=' + encodeURIComponent(slot), { cache: 'no-store' })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok) return { block: null, cityPartner: null };
        return {
          block: data.block || null,
          cityPartner: data.cityPartner || null,
        };
      })
      .catch(function () {
        return { block: null, cityPartner: null };
      });
  }

  function mountCityPartnerSlot(container, slot) {
    if (!container) return Promise.resolve(false);
    return loadCityPartnerSlot(slot)
      .then(function (result) {
        if (result.block && renderCityPartnerAd(container, result.block, slot)) return true;
        if (
          String(slot || '').indexOf('networking_city_partner_') === 0 &&
          result.cityPartner &&
          renderCityPartnerWaitlist(container, result.cityPartner)
        ) {
          return true;
        }
        return renderCityPartnerPlaceholder(container, slot);
      })
      .catch(function () {
        return renderCityPartnerPlaceholder(container, slot);
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

  function renderCarouselPlaceholder(container, slotOrSubject) {
    if (!container) return false;
    var href = advertisingPathForSlot(slotOrSubject);
    var copy = placeholderCopyForSlot(slotOrSubject);
    container.hidden = false;
    container.innerHTML =
      '<aside class="cms-ad-carousel-placeholder" aria-label="Sponsored placement available">' +
      '<span class="cms-ad-logo-only-badge">Available</span>' +
      '<a class="cms-ad-carousel-placeholder-link" href="' +
      esc(href) +
      '">' +
      placeholderPitchHtml(copy) +
      '<span class="cms-ad-carousel-placeholder-cta">' +
      esc(copy.cta) +
      '</span>' +
      '</a></aside>';
    return true;
  }

  function renderCompactPlaceholder(container, slot) {
    if (!container) return false;
    var slotKey = slot || 'opportunity_page_sidebar_ad';
    var href = advertisingPathForSlot(slotKey);
    var copy = placeholderCopyForSlot(slotKey);
    container.hidden = false;
    container.innerHTML =
      '<aside class="cms-ad-compact cms-ad-compact--available" aria-label="Sponsored sidebar placement available">' +
      '<span class="cms-ad-compact-badge">Available</span>' +
      '<a class="cms-ad-compact-placeholder-link" href="' +
      esc(href) +
      '">' +
      placeholderPitchHtml(copy) +
      '<span class="cms-ad-compact-cta cms-ad-compact-cta--placeholder">' +
      esc(copy.cta) +
      '</span>' +
      '</a></aside>';
    return true;
  }

  function regionPartnerBadge(slot) {
    var key = String(slot || '');
    if (key.indexOf('networking_county_partner_') === 0) return 'County Sponsor';
    if (key.indexOf('opportunity_industry_sponsor_') === 0) return 'Industry Sponsor';
    return 'City Sponsor';
  }

  function regionPartnerAdvertiseHref(slot) {
    var key = String(slot || '');
    if (key.indexOf('networking_county_partner_') === 0) return '/advertising#county-partner-package';
    if (key.indexOf('opportunity_industry_sponsor_') === 0) {
      return '/advertising#industry-sponsor-package';
    }
    return '/advertising#city-partner-package';
  }

  function loadCarouselAds(slot) {
    return fetch('/api/cms-block?slot=' + encodeURIComponent(slot), { cache: 'no-store' })
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

  function loadEventPageCarousel() {
    return loadCarouselAds('event_page_carousel_ads');
  }

  function loadOrganiserPageCarousel() {
    return loadCarouselAds('organiser_page_carousel_ads');
  }

  function loadOpportunityPageCarousel() {
    return loadCarouselAds('opportunity_page_carousel_ads');
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

  function logoLinkMarkup(logoUrl, linkUrl, ariaLabel, fillBox, block) {
    var url = String(logoUrl || '').trim();
    var href = normalizeCta(linkUrl);
    var hasLogo = window.CmsSponsorFields ? window.CmsSponsorFields.isLogoUrl(url) : /^https?:\/\//i.test(url);
    var label = esc(String(ariaLabel || 'Sponsored partner').trim() || 'Sponsored partner');
    var imgClass = 'cms-ad-logo-only-img sponsor-logo--full' + (fillBox ? ' cms-ad-logo-only-img--fill' : '');
    var darkAttr = logoBandDarkAttr(block);
    var inner = hasLogo
      ? '<img class="' +
        imgClass +
        '" src="' +
        esc(url) +
        '" alt="" loading="lazy" decoding="async" ' +
        'onerror="window.CmsAdBlocks&&window.CmsAdBlocks.hideBrokenCarouselImage(this)">'
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
      '"' +
      darkAttr +
      '>' +
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

  function pagePartnerPlacement(slotOrSubject) {
    var key = String(slotOrSubject || '').trim().toLowerCase();
    if (key === 'organiser_page_carousel_ads' || /organiser/.test(key)) {
      return 'organisers_page_partner';
    }
    if (
      key === 'opportunity_page_carousel_ads' ||
      key === 'opportunity_page_sidebar_ad' ||
      /opportunit/.test(key)
    ) {
      return 'opportunities_page_partner';
    }
    return 'events_page_partner';
  }

  function applyLogoLink(el, linkUrl, slotOrSubject) {
    if (!el || !window.CmsSponsorFields) return;
    var company = el.getAttribute('aria-label') || '';
    if (/^Visit /i.test(company)) company = company.replace(/^Visit\s+/i, '');
    var placement = pagePartnerPlacement(slotOrSubject);
    window.CmsSponsorFields.applyCtaLink(el, normalizeCta(linkUrl), {
      placement: placement,
      company: company,
      campaign: placement,
    });
    if (window.CmsSponsorFields.trackSponsorImpression) {
      window.CmsSponsorFields.trackSponsorImpression(placement, company, {
        el: el.closest('.cms-ad-logo-only, .cms-ad-carousel, .cms-ad-sidebar') || el,
      });
    }
  }

  function wireCarouselLogoBands(container) {
    if (!container || !window.CmsSponsorFields) return;
    container.querySelectorAll('.cms-ad-logo-link img').forEach(function (img) {
      var wrap = img.closest('.sponsor-logo-wrap');
      if (wrap) window.CmsSponsorFields.applyLogoBand(wrap, img, true);
    });
  }

  function renderLogoOnlyAd(container, block, slotOrSubject) {
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
      logoLinkMarkup(logo, linkUrl, carouselAriaLabel(block), true, block) +
      '</aside>';
    applyLogoLink(container.querySelector('.cms-ad-logo-link'), block.cta_url, slotOrSubject);
    wireCarouselLogoBands(container);
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
      logoLinkMarkup(logo, linkUrl, carouselAriaLabel(block), true, block) +
      '</aside></div>'
    );
  }

  function renderCarouselAvailableSlideHtml(slotOrSubject, slideIndex, total) {
    var href = advertisingPathForSlot(slotOrSubject);
    var copy = placeholderCopyForSlot(slotOrSubject);
    var isActive = slideIndex === 0 ? ' is-active' : '';
    return (
      '<div class="cms-ad-carousel-slide cms-ad-carousel-slide--available' +
      isActive +
      '" data-carousel-slide="' +
      slideIndex +
      '" role="group" aria-roledescription="slide" aria-label="Available slot ' +
      (slideIndex + 1) +
      ' of ' +
      total +
      '">' +
      '<aside class="cms-ad-logo-only cms-ad-logo-only--fill cms-ad-logo-only--available">' +
      '<span class="cms-ad-logo-only-badge">Available</span>' +
      '<a class="cms-ad-carousel-placeholder-link" href="' +
      esc(href) +
      '">' +
      placeholderPitchHtml(copy) +
      '<span class="cms-ad-carousel-placeholder-cta">' +
      esc(copy.cta) +
      '</span></a></aside></div>'
    );
  }

  function renderCarouselAd(container, ads, slotOrSubject, options) {
    if (!container) return false;
    options = options || {};
    var list = Array.isArray(ads) ? ads : [];
    var showPlaceholder = options.showPlaceholder === true;
    var showLastPlaceholder =
      options.showLastSlotPlaceholder !== false && showPlaceholder;

    if (!list.length) {
      if (showPlaceholder) {
        return renderCarouselPlaceholder(container, slotOrSubject);
      }
      container.hidden = true;
      container.innerHTML = '';
      return false;
    }

    var appendLastPlaceholder = showLastPlaceholder && list.length < CAROUSEL_MAX_SLOTS;

    if (list.length === 1 && !appendLastPlaceholder) {
      return renderLogoOnlyAd(container, list[0], slotOrSubject);
    }

    if (options.shuffle !== false) {
      list = shuffleArray(list);
    }

    var total = list.length + (appendLastPlaceholder ? 1 : 0);
    var slideHtml = list
      .map(function (block, index) {
        return renderCompactSlideHtml(block, index, total);
      })
      .concat(
        appendLastPlaceholder
          ? [renderCarouselAvailableSlideHtml(slotOrSubject, list.length, total)]
          : []
      )
      .join('');

    var dots = [];
    for (var di = 0; di < total; di++) {
      dots.push(
        '<button type="button" class="cms-ad-carousel-dot' +
          (di === 0 ? ' is-active' : '') +
          '" data-carousel-dot="' +
          di +
          '" aria-label="Show slide ' +
          (di + 1) +
          '"></button>'
      );
    }

    container.hidden = false;
    container.innerHTML =
      '<div class="cms-ad-carousel" data-carousel-count="' +
      total +
      '">' +
      '<div class="cms-ad-carousel-viewport" aria-live="polite">' +
      '<div class="cms-ad-carousel-track">' +
      slideHtml +
      '</div></div>' +
      '<div class="cms-ad-carousel-controls">' +
      '<button type="button" class="cms-ad-carousel-arrow cms-ad-carousel-arrow--prev" aria-label="Previous sponsor">‹</button>' +
      '<div class="cms-ad-carousel-dots" role="tablist" aria-label="Sponsor adverts">' +
      dots.join('') +
      '</div>' +
      '<button type="button" class="cms-ad-carousel-arrow cms-ad-carousel-arrow--next" aria-label="Next sponsor">›</button>' +
      '</div></div>';

    list.forEach(function (block, index) {
      var slide = container.querySelector('[data-carousel-slide="' + index + '"]');
      if (!slide) return;
      applyLogoLink(slide.querySelector('.cms-ad-logo-link'), block.cta_url, slotOrSubject);
    });

    wireCarouselLogoBands(container);
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

  function loadPageCarouselAds(container, options) {
    if (!container) return Promise.resolve(false);
    var opts = options || {};
    var slot = String(opts.slot || 'event_page_carousel_ads').trim() || 'event_page_carousel_ads';
    return loadCarouselAds(slot).then(function (ads) {
      return renderCarouselAd(container, ads, slot, {
        shuffle: opts.shuffle,
        showPlaceholder: opts.showPlaceholder === true,
      });
    });
  }

  function loadOrganiserPageCarouselAds(container) {
    return loadPageCarouselAds(container, {
      slot: 'organiser_page_carousel_ads',
      showPlaceholder: true,
    });
  }

  function loadOpportunityPageCarouselAds(container) {
    return loadPageCarouselAds(container, {
      slot: 'opportunity_page_carousel_ads',
      showPlaceholder: true,
    });
  }

  window.CmsAdBlocks = {
    renderSidebarAd: renderSidebarAd,
    renderHeroSponsorAd: renderHeroSponsorAd,
    renderCompactAd: renderCompactAd,
    renderCompactPlaceholder: renderCompactPlaceholder,
    renderCityPartnerAd: renderCityPartnerAd,
    renderCityPartnerPlaceholder: renderCityPartnerPlaceholder,
    renderCityPartnerWaitlist: renderCityPartnerWaitlist,
    mountCityPartnerSlot: mountCityPartnerSlot,
    renderCarouselAd: renderCarouselAd,
    renderCarouselPlaceholder: renderCarouselPlaceholder,
    renderLogoOnlyAd: renderLogoOnlyAd,
    hideBrokenCarouselImage: hideBrokenCarouselImage,
    isCompactRenderable: isCompactRenderable,
    loadCmsAd: loadCmsAd,
    loadCityPartnerSlot: loadCityPartnerSlot,
    loadCarouselAds: loadCarouselAds,
    loadEventPageCarousel: loadEventPageCarousel,
    loadOrganiserPageCarousel: loadOrganiserPageCarousel,
    loadOpportunityPageCarousel: loadOpportunityPageCarousel,
    loadPageCarouselAds: loadPageCarouselAds,
    loadOrganiserPageCarouselAds: loadOrganiserPageCarouselAds,
    loadOpportunityPageCarouselAds: loadOpportunityPageCarouselAds,
    initCarousel: initCarousel,
  };
})();
