/**
 * Hero Sponsor Hub — loads cms_blocks slot and renders browse-page placement.
 */
(function () {
  var SPONSOR_ENQUIRE_MAILTO =
    'mailto:rosie@thenetworkerhub.com?subject=' + encodeURIComponent('Sponsor Hub enquiry');

  var SPONSOR_FALLBACK = {
    headline: 'Your brand here',
    ctaLabel: 'Find out more →',
    ctaUrl: SPONSOR_ENQUIRE_MAILTO,
  };

  var SPONSOR_HERO_MAX_BULLETS = 0;

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function getEls() {
    return {
      sponsorHub: document.getElementById('sponsor-hub'),
      sponsorLogoWrap: document.getElementById('sponsor-logo-wrap'),
      sponsorLogoLink: document.getElementById('sponsor-logo-link'),
      sponsorLogo: document.getElementById('sponsor-logo'),
      sponsorLogoPlaceholder: document.getElementById('sponsor-logo-placeholder'),
      sponsorCompany: document.getElementById('sponsor-company'),
      sponsorTagline: document.getElementById('sponsor-tagline'),
      sponsorBody: document.getElementById('sponsor-body'),
      sponsorCta: document.getElementById('sponsor-cta'),
    };
  }

  function isSponsorInHero(els) {
    return !!(els.sponsorHub && els.sponsorHub.classList.contains('sponsor-hub--in-hero'));
  }

  function normalizeSponsorCtaUrl(url) {
    var u = String(url || '').trim();
    if (!u) return SPONSOR_ENQUIRE_MAILTO;
    if (/^(https?:|mailto:)/i.test(u)) return u;
    return SPONSOR_ENQUIRE_MAILTO;
  }

  function sponsorTaglineFromBlock(block) {
    if (window.CmsSponsorFields) return window.CmsSponsorFields.tagline(block);
    var title = String(block.title || '').trim();
    if (title && title.toLowerCase() !== 'sponsor hub') return title;
    var subtitle = String(block.subtitle || '').trim();
    if (subtitle) return subtitle;
    var temp = document.createElement('div');
    temp.innerHTML = String(block.body || '');
    var h3 = temp.querySelector('h3');
    return h3 ? h3.textContent.trim() : '';
  }

  function sponsorBulletsHtml(body, maxItems) {
    var temp = document.createElement('div');
    temp.innerHTML = String(body || '');
    var items = Array.prototype.map
      .call(temp.querySelectorAll('li'), function (li) {
        return li.textContent.trim();
      })
      .filter(Boolean);
    if (maxItems > 0 && items.length > maxItems) {
      items = items.slice(0, maxItems);
    }
    if (!items.length) return '';
    return (
      '<ul class="sponsor-list">' +
      items.map(function (line) {
        return '<li>' + escapeHtml(line) + '</li>';
      }).join('') +
      '</ul>'
    );
  }

  function sponsorTaglineHtml(text) {
    var raw = String(text || '').trim();
    if (!raw) return '';
    var colon = raw.indexOf(':');
    if (colon === -1) return escapeHtml(raw);
    var lead = escapeHtml(raw.slice(0, colon + 1).trim());
    var rest = escapeHtml(raw.slice(colon + 1).trim());
    return '<em>' + lead + '</em> ' + rest;
  }

  function whenLogoReady(els, logoOnly) {
    if (!logoOnly || !els.sponsorLogo || els.sponsorLogo.hidden) {
      return Promise.resolve();
    }
    if (els.sponsorLogo.complete && els.sponsorLogo.naturalWidth) {
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      els.sponsorLogo.addEventListener('load', resolve, { once: true });
      els.sponsorLogo.addEventListener('error', resolve, { once: true });
    });
  }

  function markSponsorReady(els) {
    if (els.sponsorHub) els.sponsorHub.classList.add('sponsor-hub--ready');
  }

  function markSponsorLoading(els) {
    if (els.sponsorHub) els.sponsorHub.classList.remove('sponsor-hub--ready');
  }

  function clearHeroLogoLink(els) {
    if (els.sponsorHub) els.sponsorHub.classList.remove('sponsor-hub--logo-only');
    if (!els.sponsorLogoLink) return;
    els.sponsorLogoLink.hidden = true;
    els.sponsorLogoLink.removeAttribute('href');
    els.sponsorLogoLink.removeAttribute('aria-label');
    els.sponsorLogoLink.removeAttribute('target');
    els.sponsorLogoLink.removeAttribute('rel');
  }

  function applyHeroLogoLink(els, opts) {
    var hero = isSponsorInHero(els);
    var useLogoOnly = hero && opts.active && opts.hasLogo;

    if (!useLogoOnly) {
      clearHeroLogoLink(els);
      return false;
    }

    if (els.sponsorHub) els.sponsorHub.classList.add('sponsor-hub--logo-only');
    if (els.sponsorLogoLink) {
      els.sponsorLogoLink.href = opts.ctaUrl;
      els.sponsorLogoLink.hidden = false;
      var label = opts.company ? 'Visit ' + opts.company : opts.ctaLabel || 'Visit sponsor';
      els.sponsorLogoLink.setAttribute('aria-label', label);
      if (window.CmsSponsorFields) {
        window.CmsSponsorFields.applyCtaLink(els.sponsorLogoLink, opts.ctaUrl);
      }
    }
    if (els.sponsorLogo) {
      els.sponsorLogo.alt = opts.company || '';
    }
    return true;
  }

  function setSponsorLogo(els, logoUrl) {
    var url = String(logoUrl || '').trim();
    var hasLogo = window.CmsSponsorFields
      ? window.CmsSponsorFields.isLogoUrl(url)
      : /^https?:\/\//i.test(url);
    if (els.sponsorLogoWrap) {
      els.sponsorLogoWrap.hidden = false;
      els.sponsorLogoWrap.classList.toggle('has-logo', hasLogo);
    }
    if (els.sponsorLogo) {
      if (hasLogo) {
        els.sponsorLogo.src = url;
        els.sponsorLogo.hidden = false;
        if (window.CmsSponsorFields) {
          window.CmsSponsorFields.applyLogoBand(els.sponsorLogoWrap, els.sponsorLogo, true);
        }
      } else {
        els.sponsorLogo.removeAttribute('src');
        els.sponsorLogo.alt = '';
        els.sponsorLogo.hidden = true;
        if (window.CmsSponsorFields) {
          window.CmsSponsorFields.applyLogoBand(els.sponsorLogoWrap, null, false);
        }
      }
    }
    if (els.sponsorLogoPlaceholder) {
      els.sponsorLogoPlaceholder.hidden = hasLogo;
    }
    return hasLogo;
  }

  function renderSponsorFallback(els) {
    if (!els.sponsorHub) return;
    els.sponsorHub.classList.remove('sponsor-hub--active');
    els.sponsorHub.classList.add('sponsor-hub--fallback');
    clearHeroLogoLink(els);

    if (els.sponsorLogoWrap) els.sponsorLogoWrap.hidden = true;
    if (els.sponsorCompany) els.sponsorCompany.hidden = true;
    if (els.sponsorTagline) {
      els.sponsorTagline.hidden = false;
      els.sponsorTagline.textContent = SPONSOR_FALLBACK.headline;
    }
    if (els.sponsorBody) {
      els.sponsorBody.hidden = true;
      els.sponsorBody.textContent = '';
    }
    if (els.sponsorCta) {
      els.sponsorCta.textContent = SPONSOR_FALLBACK.ctaLabel;
      els.sponsorCta.href = SPONSOR_FALLBACK.ctaUrl;
      els.sponsorCta.hidden = false;
      if (window.CmsSponsorFields) {
        window.CmsSponsorFields.applyCtaColor(els.sponsorCta, '');
        window.CmsSponsorFields.applyCtaLink(els.sponsorCta, SPONSOR_FALLBACK.ctaUrl);
      }
    }
  }

  function renderSponsorAd(els, block) {
    if (!els.sponsorHub) return;
    els.sponsorHub.classList.add('sponsor-hub--active');
    els.sponsorHub.classList.remove('sponsor-hub--fallback');

    var company = window.CmsSponsorFields
      ? window.CmsSponsorFields.companyName(block)
      : String(block.company_name || '').trim();
    var tagline = sponsorTaglineFromBlock(block);
    var logoUrl = window.CmsSponsorFields
      ? window.CmsSponsorFields.logoUrl(block)
      : String(block.logo_url || block.image_url || '').trim();
    var ctaLabel = String(block.cta_label || '').trim() || 'Enquire now';
    var ctaUrl = normalizeSponsorCtaUrl(block.cta_url);
    var heroSponsor = isSponsorInHero(els);
    var bulletsHtml = sponsorBulletsHtml(
      block.body,
      heroSponsor ? SPONSOR_HERO_MAX_BULLETS : 0
    );
    var hasLogo = setSponsorLogo(els, logoUrl);
    var logoOnly = applyHeroLogoLink(els, {
      active: true,
      hasLogo: hasLogo,
      ctaUrl: ctaUrl,
      company: company,
      ctaLabel: ctaLabel,
    });

    if (els.sponsorCompany) {
      if (company && !logoOnly) {
        els.sponsorCompany.textContent = company;
        els.sponsorCompany.hidden = false;
      } else {
        els.sponsorCompany.textContent = '';
        els.sponsorCompany.hidden = true;
      }
    }

    if (els.sponsorTagline) {
      if (tagline && !logoOnly) {
        els.sponsorTagline.hidden = false;
        els.sponsorTagline.innerHTML = sponsorTaglineHtml(tagline);
      } else {
        els.sponsorTagline.hidden = true;
        els.sponsorTagline.textContent = '';
      }
    }

    if (els.sponsorBody) {
      if (bulletsHtml && !logoOnly) {
        els.sponsorBody.hidden = false;
        els.sponsorBody.innerHTML = bulletsHtml;
      } else {
        els.sponsorBody.hidden = true;
        els.sponsorBody.innerHTML = '';
      }
    }

    if (els.sponsorCta) {
      els.sponsorCta.textContent = ctaLabel;
      els.sponsorCta.href = ctaUrl;
      els.sponsorCta.hidden = logoOnly;
      if (!logoOnly && window.CmsSponsorFields) {
        window.CmsSponsorFields.applyCtaColor(
          els.sponsorCta,
          window.CmsSponsorFields.ctaColor(block)
        );
        window.CmsSponsorFields.applyCtaLink(els.sponsorCta, ctaUrl);
      }
    }
  }

  function renderSponsorBlock(els, block) {
    if (!els.sponsorHub) return;
    if (!block || block.active === false) {
      renderSponsorFallback(els);
      return;
    }
    renderSponsorAd(els, block);
  }

  async function load(slot) {
    var els = getEls();
    if (!els.sponsorHub) return;

    markSponsorLoading(els);

    var slotKey =
      String(slot || els.sponsorHub.getAttribute('data-slot') || 'events_sponsor_hub').trim() ||
      'events_sponsor_hub';

    try {
      var res = await fetch('/api/cms-block?slot=' + encodeURIComponent(slotKey));
      var data = await res.json();
      if (data && data.ok && data.block) {
        renderSponsorBlock(els, data.block);
      } else {
        renderSponsorFallback(els);
      }
    } catch (e) {
      renderSponsorFallback(els);
    }

    await whenLogoReady(els, els.sponsorHub.classList.contains('sponsor-hub--logo-only'));
    markSponsorReady(els);
  }

  window.HubSponsorHub = { load: load };
  window.hubReloadSponsorBlock = load;

  function scheduleAutoLoad() {
    if (!document.getElementById('sponsor-hub')) return;
    load();
  }

  scheduleAutoLoad();
})();
