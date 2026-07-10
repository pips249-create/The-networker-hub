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
      sponsorBadge: document.getElementById('sponsor-badge'),
      sponsorLogoWrap: document.getElementById('sponsor-logo-wrap'),
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
        els.sponsorLogo.alt = '';
        els.sponsorLogo.hidden = false;
        if (window.CmsSponsorFields) {
          window.CmsSponsorFields.applyLogoBand(els.sponsorLogoWrap, els.sponsorLogo, true);
        }
      } else {
        els.sponsorLogo.removeAttribute('src');
        els.sponsorLogo.hidden = true;
        if (window.CmsSponsorFields) {
          window.CmsSponsorFields.applyLogoBand(els.sponsorLogoWrap, null, false);
        }
      }
    }
    if (els.sponsorLogoPlaceholder) {
      els.sponsorLogoPlaceholder.hidden = hasLogo;
    }
  }

  function renderSponsorFallback(els) {
    if (!els.sponsorHub) return;
    els.sponsorHub.classList.remove('sponsor-hub--active');
    els.sponsorHub.classList.add('sponsor-hub--fallback');

    if (els.sponsorBadge) els.sponsorBadge.hidden = true;
    setSponsorLogo(els, '');
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
    var hasLogo = window.CmsSponsorFields
      ? window.CmsSponsorFields.isLogoUrl(logoUrl)
      : /^https?:\/\//i.test(String(logoUrl || '').trim());

    if (els.sponsorBadge) els.sponsorBadge.hidden = false;
    setSponsorLogo(els, logoUrl);

    if (els.sponsorCompany) {
      if (company && !(heroSponsor && hasLogo)) {
        els.sponsorCompany.textContent = company;
        els.sponsorCompany.hidden = false;
      } else {
        els.sponsorCompany.textContent = '';
        els.sponsorCompany.hidden = true;
      }
    }

    if (els.sponsorTagline) {
      if (tagline) {
        els.sponsorTagline.hidden = false;
        els.sponsorTagline.innerHTML = sponsorTaglineHtml(tagline);
      } else {
        els.sponsorTagline.hidden = true;
        els.sponsorTagline.textContent = '';
      }
    }

    if (els.sponsorBody) {
      if (bulletsHtml) {
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
      els.sponsorCta.hidden = false;
      if (window.CmsSponsorFields) {
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
  }

  window.HubSponsorHub = { load: load };
  window.hubReloadSponsorBlock = load;

  function scheduleAutoLoad() {
    if (!document.getElementById('sponsor-hub')) return;
    var run = function () {
      Promise.resolve().then(load);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
  }

  scheduleAutoLoad();
})();
