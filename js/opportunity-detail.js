/**
 * Opportunity detail page — /opportunities/:slug
 */
(function () {
  var catalog = window.HubOpportunitiesCatalog;
  var saves = window.HubOpportunitySaves;
  var current = null;
  var sessionUser = null;
  var enquiriesOpen = true;

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
    submit: document.getElementById('opp-enquire-submit'),
    enquireStatus: document.getElementById('opp-enquire-status'),
    enquireClosed: document.getElementById('opp-enquire-closed'),
    enquireLede: document.getElementById('opp-enquire-lede'),
    investBreakdownSection: document.getElementById('opp-investment-breakdown-section'),
    investBreakdownLede: document.getElementById('opp-investment-breakdown-lede'),
    investBreakdownList: document.getElementById('opp-investment-breakdown-list'),
    enquireSignin: document.getElementById('opp-enquire-signin'),
    trustBadges: document.getElementById('opp-detail-trust-badges'),
    typeNotice: document.getElementById('opp-type-notice'),
    companiesHouse: document.getElementById('opp-companies-house'),
    similarSection: document.getElementById('opp-similar-section'),
    similarGrid: document.getElementById('opp-similar-grid'),
    claimSection: document.getElementById('opp-claim-section'),
    claimForm: document.getElementById('opp-claim-form'),
    claimSubmit: document.getElementById('opp-claim-submit'),
    claimStatus: document.getElementById('opp-claim-status'),
    claimInvite: document.getElementById('opp-claim-invite'),
    claimInviteBtn: document.getElementById('opp-claim-invite-btn'),
    claimInviteTitle: document.getElementById('opp-claim-invite-title'),
  };

  function claimInviteQuery() {
    var params = new URLSearchParams(window.location.search);
    var intent = String(params.get('intent') || '').trim().toLowerCase();
    return {
      isClaim: intent === 'opportunity-claim',
      email: String(params.get('email') || '').trim(),
      auth: String(params.get('auth') || 'register').trim().toLowerCase() === 'login' ? 'login' : 'register',
      next: String(params.get('next') || '/organiser/?onboard=opportunity-claim').trim(),
    };
  }

  function initClaimInviteFromEmail(item) {
    var q = claimInviteQuery();
    if (!q.isClaim || !els.claimInvite) return;
    els.claimInvite.hidden = false;
    if (els.claimInviteTitle && item && item.title) {
      els.claimInviteTitle.textContent = 'This is a preview of ' + item.title;
    }
    var safeNext = q.next && q.next.charAt(0) === '/' ? q.next : '/organiser/?onboard=opportunity-claim';
    var path = q.auth === 'login' ? '/login' : '/register';
    var href =
      path +
      '?intent=opportunity-claim&next=' +
      encodeURIComponent(safeNext) +
      (q.email ? '&email=' + encodeURIComponent(q.email) : '');
    if (els.claimInviteBtn) els.claimInviteBtn.setAttribute('href', href);
    if (els.claimSection) els.claimSection.hidden = true;
  }

  function syncEnquiriesOpenFromSoftLaunch(meta) {
    if (meta && typeof meta.enquiriesOpen === 'boolean') {
      enquiriesOpen = meta.enquiriesOpen;
      return;
    }
    if (window.HubSoftLaunch && typeof window.HubSoftLaunch.arePublicEnquiriesOpen === 'function') {
      enquiriesOpen = window.HubSoftLaunch.arePublicEnquiriesOpen();
      return;
    }
    enquiriesOpen = Date.now() >= Date.parse('2026-09-01T00:00:00+01:00');
  }

  function enquiriesClosedCopy() {
    if (window.HubSoftLaunch && window.HubSoftLaunch.publicEnquiriesClosedMessage) {
      return window.HubSoftLaunch.publicEnquiriesClosedMessage();
    }
    return 'Opportunity enquiries open on 1 September 2026. You can browse listings now and enquire when they go live.';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderDesc(item) {
    if (!els.desc) return;
    var text = String((item && item.desc) || '').trim();
    if (!text) {
      els.desc.innerHTML = '';
      els.desc.hidden = true;
      return;
    }
    els.desc.hidden = false;
    var fmt = window.HubPlainTextFormat;
    if (fmt && typeof fmt.formatDocument === 'function' && /\n/.test(fmt.normalizeNewlines(text))) {
      els.desc.innerHTML = fmt.formatDocument(text, {
        paragraphClass: 'opp-about-p',
        headingClass: 'opp-about-heading',
      });
      return;
    }
    if (fmt && typeof fmt.plainTextToHtml === 'function' && /\n/.test(String(text))) {
      els.desc.innerHTML = fmt.plainTextToHtml(text);
      return;
    }
    els.desc.textContent = text;
  }

  function renderAbout(item) {
    if (!els.aboutExtra) return;
    var fmt = window.HubPlainTextFormat;
    if (fmt && typeof fmt.formatDocument === 'function') {
      els.aboutExtra.innerHTML = fmt.formatDocument(item && item.about, {
        paragraphClass: 'opp-about-p',
        headingClass: 'opp-about-heading',
      });
      return;
    }
    var paras = Array.isArray(item && item.about) ? item.about : [];
    els.aboutExtra.innerHTML = paras
      .map(function (p) {
        return '<p class="opp-about-p">' + escapeHtml(p) + '</p>';
      })
      .join('');
  }

  function shortTitle(title) {
    var t = String(title || '');
    return t.length > 48 ? t.slice(0, 45) + '…' : t;
  }

  function resolveSlug() {
    var pathMatch = window.location.pathname.match(/\/opportunities\/([^/]+)\/?$/i);
    if (pathMatch && pathMatch[1]) {
      return decodeURIComponent(pathMatch[1]);
    }
    var params = new URLSearchParams(window.location.search);
    return params.get('slug') || params.get('id') || '';
  }

  function maybeRedirectToCanonicalSlug(item) {
    if (!item || !item.slug) return;
    var canonical = '/opportunities/' + encodeURIComponent(item.slug);
    var currentPath = window.location.pathname.replace(/\/$/, '');
    if (currentPath !== canonical) {
      window.history.replaceState({}, '', canonical);
    }
  }

  function showNotFound() {
    document.title = 'Opportunity not found – The Networker UK';
    if (els.notFound) els.notFound.hidden = false;
    if (els.layout) els.layout.hidden = true;
    if (els.trailCurrent) els.trailCurrent.textContent = 'Not found';
  }

  function applyCoverImage(item) {
    if (!els.cover || !els.coverImg || !item) return;
    if (item.imageUrl) {
      els.coverImg.src = item.imageUrl;
      els.coverImg.alt = item.title ? item.title + ' photo' : 'Opportunity photo';
      els.cover.hidden = false;
      return;
    }
    els.cover.hidden = true;
    els.coverImg.removeAttribute('src');
    els.coverImg.alt = '';
  }

  function hostLogoUrl(item) {
    return String((item && item.logoUrl) || '').trim();
  }

  function applyHostLogo(el, item) {
    if (!el || !item) return;
    var logo = hostLogoUrl(item);
    if (logo) {
      el.textContent = '';
      el.classList.add('has-logo');
      el.innerHTML =
        '<img src="' +
        escapeHtml(logo) +
        '" alt="" width="40" height="40" loading="lazy" />';
      var img = el.querySelector('img');
      var paint = function () {
        if (window.CmsSponsorFields && window.CmsSponsorFields.applyLogoSurfaceContrast) {
          window.CmsSponsorFields.applyLogoSurfaceContrast(el, img || logo, {
            lightColor: '#ffffff',
          });
        } else {
          var dark =
            window.CmsSponsorFields && window.CmsSponsorFields.logoUrlSuggestsDarkBand
              ? window.CmsSponsorFields.logoUrlSuggestsDarkBand(logo)
              : /white/i.test(logo);
          el.classList.toggle('is-logo-dark', dark);
          el.style.background = dark ? '#1a1a2e' : '#fff';
        }
      };
      paint();
      if (img) {
        img.addEventListener('load', paint, { once: true });
      }
      return;
    }
    el.classList.remove('has-logo', 'is-logo-dark');
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

  function renderMeta(item) {
    if (!els.metaGrid) return;
    els.metaGrid.innerHTML = (item.meta || [])
      .filter(function (m) {
        return !/^investment includes$/i.test(m.key) && !/^companies house$/i.test(m.key);
      })
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

  function renderTrustBadges(item) {
    if (!els.trustBadges) return;
    var q = window.HubOpportunityQuality;
    if (!q || !q.trustBadgesHtml) {
      els.trustBadges.innerHTML = '';
      els.trustBadges.hidden = true;
      return;
    }
    var html = q.trustBadgesHtml(item, 'opp-trust-badges opp-trust-badges--detail');
    if (!html) {
      els.trustBadges.innerHTML = '';
      els.trustBadges.hidden = true;
      return;
    }
    els.trustBadges.innerHTML = html;
    els.trustBadges.hidden = false;
  }

  function renderCompaniesHouse(item) {
    if (!els.companiesHouse) return;
    var q = window.HubOpportunityQuality;
    if (!q || !q.companiesHouseMetaHtml || !q.companiesHouseNumber(item)) {
      els.companiesHouse.hidden = true;
      els.companiesHouse.innerHTML = '';
      return;
    }
    els.companiesHouse.innerHTML =
      '<span class="opp-detail-meta-key">Company registration</span>' +
      '<span class="opp-detail-meta-val">' +
      q.companiesHouseMetaHtml(item) +
      '</span>';
    els.companiesHouse.hidden = false;
  }

  function similarCardHtml(item) {
    var href = item.slug
      ? '/opportunities/' + encodeURIComponent(item.slug)
      : '/opportunities/opportunity?id=' + encodeURIComponent(item.id);
    var invest = '';
    (item.meta || []).forEach(function (m) {
      if (/^investment$/i.test(m.key)) invest = String(m.val || '').trim();
    });
    return (
      '<a class="opp-similar-card" href="' +
      escapeHtml(href) +
      '">' +
      '<span class="opp-similar-type">' +
      escapeHtml((catalog && catalog.TYPE_LABELS[item.type]) || item.type || '') +
      '</span>' +
      '<strong class="opp-similar-title">' +
      escapeHtml(item.title || '') +
      '</strong>' +
      '<span class="opp-similar-host">' +
      escapeHtml(item.host || '') +
      '</span>' +
      (invest ? '<span class="opp-similar-invest">' + escapeHtml(invest) + '</span>' : '') +
      '</a>'
    );
  }

  function renderSimilar(item) {
    if (!els.similarSection || !els.similarGrid) return;
    var q = window.HubOpportunityQuality;
    if (!catalog || !catalog.loadCatalogAsync || !q || !q.similarOpportunities) {
      els.similarSection.hidden = true;
      return;
    }
    catalog.loadCatalogAsync().then(function (list) {
      var similar = q.similarOpportunities(list, item, 4);
      if (!similar.length) {
        els.similarSection.hidden = true;
        els.similarGrid.innerHTML = '';
        return;
      }
      els.similarGrid.innerHTML = similar.map(similarCardHtml).join('');
      els.similarSection.hidden = false;
    });
  }

  function renderInvestmentBreakdown(item) {
    if (!els.investBreakdownSection) return;
    if (catalog && catalog.isAffiliateStyleListing && catalog.isAffiliateStyleListing(item)) {
      els.investBreakdownSection.hidden = true;
      if (els.investBreakdownList) els.investBreakdownList.innerHTML = '';
      return;
    }
    var investUi = window.HubOpportunityInvestment;
    var items =
      item.investmentIncludes ||
      (investUi && investUi.fromMeta ? investUi.fromMeta(item.meta) : []) ||
      (catalog && catalog.parseInvestmentIncludes
        ? catalog.parseInvestmentIncludes(
            (item.meta || [])
              .filter(function (m) {
                return /^investment includes$/i.test(m.key);
              })
              .map(function (m) {
                return m.val;
              })
              .join('\n')
          )
        : []);
    if (!items.length) {
      els.investBreakdownSection.hidden = true;
      if (els.investBreakdownList) els.investBreakdownList.innerHTML = '';
      return;
    }
    var total = '';
    (item.meta || []).forEach(function (m) {
      if (/^investment$/i.test(m.key)) total = String(m.val || '').trim();
    });
    var heading =
      investUi && investUi.breakdownHeading
        ? investUi.breakdownHeading(total, items.length)
        : total
          ? total + ' total — typically includes:'
          : 'Typically includes:';
    if (els.investBreakdownLede) els.investBreakdownLede.textContent = heading;
    if (els.investBreakdownList) {
      els.investBreakdownList.innerHTML = items
        .map(function (line) {
          return '<li>' + escapeHtml(line) + '</li>';
        })
        .join('');
    }
    els.investBreakdownSection.hidden = false;
  }

  function isNetworkMarketingListing(item) {
    if (!item) return false;
    if (String(item.type || '') === 'network-marketing') return true;
    var tags = (item.tags || []).concat(item.filterTags || []);
    for (var i = 0; i < tags.length; i++) {
      if (String(tags[i] || '') === 'network-marketing') return true;
    }
    return false;
  }

  function renderTypeNotice(item) {
    if (!els.typeNotice) return;
    if (isNetworkMarketingListing(item)) {
      els.typeNotice.hidden = false;
      els.typeNotice.innerHTML =
        '<p><strong>Network marketing — product-selling only.</strong> ' +
        'This listing should be about selling products or services. It is not an investment product, ' +
        'and The Networker UK does not verify earnings claims. Do your own due diligence before committing.</p>';
      return;
    }
    if (catalog && catalog.isAffiliateStyleListing && catalog.isAffiliateStyleListing(item)) {
      els.typeNotice.hidden = false;
      els.typeNotice.innerHTML =
        '<p><strong>Affiliate programme.</strong> ' +
        'This is commission-based (promote a product or service), not a franchise or capital investment. ' +
        'Commission figures are set by the advertiser — verify terms before you promote.</p>';
      return;
    }
    els.typeNotice.hidden = true;
    els.typeNotice.innerHTML = '';
  }

  function render(item) {
    current = item;
    document.title = item.title + ' – The Networker UK';

    if (els.trailCurrent) els.trailCurrent.textContent = shortTitle(item.title);
    if (els.title) els.title.textContent = item.title;
    if (els.hostName) els.hostName.textContent = item.host;
    if (els.posterName) els.posterName.textContent = item.host;
    renderDesc(item);

    var posterNote = document.querySelector('.opp-detail-poster-note');
    if (posterNote) {
      posterNote.textContent = item.claimable
        ? 'Listed on behalf of this business by The Networker UK. Use the claim form below if you represent this company.'
        : 'Enquiries go directly to the poster — no middlemen or per-lead fees.';
    }

    applyCoverImage(item);
    applyHostLogo(els.hostLogo, item);
    applyHostLogo(els.posterLogo, item);

    if (els.hostLogo) els.hostLogo.hidden = false;

    if (els.typeBadge) {
      els.typeBadge.textContent = catalog.TYPE_LABELS[item.type] || item.type;
      els.typeBadge.className = 'opp-type-badge ' + catalog.typeClass(item.type);
    }

    if (els.featuredPip) els.featuredPip.hidden = !item.featured;

    renderMeta(item);
    renderTypeNotice(item);
    if (window.HUB_applyDetailRegionCta) {
      var locMeta = '';
      (item.meta || []).forEach(function (m) {
        if (/^location$/i.test(m.key) || /territor/i.test(m.key)) {
          locMeta = locMeta || String(m.val || '').trim();
        }
      });
      window.HUB_applyDetailRegionCta(document.getElementById('opp-region-cta'), {
        context: 'opportunities',
        slug: item.citySlugs && item.citySlugs[0] ? item.citySlugs[0] : '',
        locationTexts: locMeta ? [locMeta] : [],
      });
    }
    renderTrustBadges(item);
    renderCompaniesHouse(item);
    renderInvestmentBreakdown(item);
    renderAbout(item);
    renderSimilar(item);
    refreshSaveButton();
    applyClaimSection(item);
    initClaimInviteFromEmail(item);

    if (els.notFound) els.notFound.hidden = true;
    if (els.layout) els.layout.hidden = false;
  }

  function bindSave() {
    if (!els.saveBtn) return;
    els.saveBtn.addEventListener('click', function () {
      if (!current || !saves) return;
      saves.toggle(current.id, current).then(function () {
        refreshSaveButton();
      });
    });
  }

  function loadSession() {
    var fetcher = window.hubFetchSession
      ? window.hubFetchSession
      : function () {
          return fetch('/api/auth/session', { credentials: 'include' }).then(function (r) {
            return r.json();
          });
        };
    return fetcher()
      .then(function (data) {
        if (data && data.ok && data.user) {
          sessionUser = data.user;
          return data.user;
        }
        sessionUser = null;
        return null;
      })
      .catch(function () {
        sessionUser = null;
        return null;
      });
  }

  function applyEnquireAuthUi() {
    var signedIn = Boolean(sessionUser && sessionUser.email);
    var nameEl = document.getElementById('opp-enquire-name');
    var emailEl = document.getElementById('opp-enquire-email');
    var messageEl = document.getElementById('opp-enquire-message');
    var termsEl = document.getElementById('opp-enquire-terms');
    var jumpBtn = document.getElementById('opp-enquire-jump-btn');

    if (els.enquireClosed) {
      els.enquireClosed.hidden = enquiriesOpen;
    }
    if (els.enquireLede) {
      els.enquireLede.hidden = !enquiriesOpen;
    }

    if (!enquiriesOpen) {
      if (els.enquireSignin) els.enquireSignin.hidden = true;
      if (els.form) els.form.hidden = true;
      if (els.submit) els.submit.disabled = true;
      if (jumpBtn) jumpBtn.textContent = 'Enquiries open 1 September';
      return;
    }

    if (jumpBtn) jumpBtn.textContent = 'Enquire about this listing';
    if (els.enquireSignin) els.enquireSignin.hidden = signedIn;
    if (els.form) els.form.hidden = !signedIn;
    if (els.submit) els.submit.disabled = !signedIn;

    var next = window.location.pathname + window.location.search + window.location.hash;
    var loginLink = document.getElementById('opp-enquire-login-link');
    var registerLink = document.getElementById('opp-enquire-register-link');
    if (loginLink) loginLink.href = '../login?next=' + encodeURIComponent(next);
    if (registerLink) registerLink.href = '../register?next=' + encodeURIComponent(next);

    if (signedIn && nameEl && sessionUser.name && !nameEl.value) {
      nameEl.value = sessionUser.name;
    }
    if (signedIn && emailEl && sessionUser.email) {
      emailEl.value = sessionUser.email;
      emailEl.readOnly = true;
      emailEl.setAttribute('aria-readonly', 'true');
    }

    if (!signedIn) {
      if (nameEl) nameEl.value = '';
      if (emailEl) {
        emailEl.value = '';
        emailEl.readOnly = false;
        emailEl.removeAttribute('aria-readonly');
      }
      if (messageEl) messageEl.value = '';
      if (termsEl) termsEl.checked = false;
    }
  }

  function prefillEnquireForm() {
    return loadSession().then(function () {
      applyEnquireAuthUi();
    });
  }

  function showEnquireStatus(msg, ok) {
    if (!els.enquireStatus) return;
    els.enquireStatus.hidden = false;
    els.enquireStatus.textContent = msg;
    els.enquireStatus.className = 'opp-enquire-status' + (ok ? ' is-ok' : ' is-error');
  }

  function applyClaimSection(item) {
    if (!els.claimSection) return;
    var claimable = Boolean(item && item.claimable);
    els.claimSection.hidden = !claimable;
    if (!claimable) return;

    var companyInput = document.getElementById('opp-claim-company');
    if (companyInput && item.host && !companyInput.value) {
      companyInput.value = item.host;
    }
  }

  function showClaimStatus(msg, ok) {
    if (!els.claimStatus) return;
    els.claimStatus.hidden = false;
    els.claimStatus.textContent = msg;
    els.claimStatus.className = 'opp-claim-status' + (ok ? ' is-ok' : ' is-error');
  }

  function bindClaimForm() {
    if (!els.claimForm) return;
    els.claimForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!current || !current.claimable) return;

      var name = (document.getElementById('opp-claim-name').value || '').trim();
      var email = (document.getElementById('opp-claim-email').value || '').trim();
      var company = (document.getElementById('opp-claim-company').value || '').trim();
      var role = (document.getElementById('opp-claim-role').value || '').trim();
      var message = (document.getElementById('opp-claim-message').value || '').trim();
      if (!name || !email || !company) return;

      if (els.claimSubmit) {
        els.claimSubmit.disabled = true;
        els.claimSubmit.textContent = 'Sending request…';
      }
      if (els.claimStatus) els.claimStatus.hidden = true;

      fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'claim_request',
          opportunityId: current.id,
          name: name,
          email: email,
          company: company,
          role: role,
          message: message,
        }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok && result.data && result.data.ok) {
            showClaimStatus(
              'Request sent — our team will email you to verify your details and arrange payment.',
              true
            );
            if (els.claimSubmit) els.claimSubmit.textContent = 'Request sent';
            els.claimForm.reset();
            applyClaimSection(current);
            return;
          }
          if (els.claimSubmit) {
            els.claimSubmit.disabled = false;
            els.claimSubmit.textContent = 'Request to claim listing';
          }
          showClaimStatus(
            (result.data && (result.data.message || result.data.error)) ||
              'Could not send your request. Please email hi@thenetworkeruk.com instead.',
            false
          );
        })
        .catch(function () {
          if (els.claimSubmit) {
            els.claimSubmit.disabled = false;
            els.claimSubmit.textContent = 'Request to claim listing';
          }
          showClaimStatus(
            'Could not send your request. Please email hi@thenetworkeruk.com instead.',
            false
          );
        });
    });
  }

  function bindForm() {
    if (!els.form) return;
    els.form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!current) return;
      if (!enquiriesOpen) {
        showEnquireStatus(enquiriesClosedCopy(), false);
        applyEnquireAuthUi();
        return;
      }

      var name = (document.getElementById('opp-enquire-name').value || '').trim();
      var email = (document.getElementById('opp-enquire-email').value || '').trim();
      var message = (document.getElementById('opp-enquire-message').value || '').trim();
      var terms = document.getElementById('opp-enquire-terms');
      if (!name || !email || !message) return;
      if (terms && !terms.checked) {
        showEnquireStatus('Please confirm you understand this is not investment advice.', false);
        terms.focus();
        return;
      }

      if (els.submit) {
        els.submit.disabled = true;
        els.submit.textContent = 'Sending…';
      }
      if (els.enquireStatus) els.enquireStatus.hidden = true;

      fetch('/api/opportunities', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: current.id,
          name: name,
          email: email,
          message: message,
        }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok && result.data && result.data.ok) {
            showEnquireStatus(
              'Enquiry sent — the poster has been notified and will respond to you by email.',
              true
            );
            if (els.submit) els.submit.textContent = 'Enquiry sent';
            var messageEl = document.getElementById('opp-enquire-message');
            if (messageEl) messageEl.value = '';
            if (terms) terms.checked = false;
            return;
          }
          if (result.data && result.data.error === 'enquiries_closed') {
            if (result.data.softLaunch) syncEnquiriesOpenFromSoftLaunch(result.data.softLaunch);
            else enquiriesOpen = false;
            applyEnquireAuthUi();
            showEnquireStatus(
              (result.data && result.data.message) || enquiriesClosedCopy(),
              false
            );
            return;
          }
          if (result.data && result.data.error === 'not_authenticated') {
            sessionUser = null;
            applyEnquireAuthUi();
          }
          if (els.submit) {
            els.submit.disabled = false;
            els.submit.textContent = 'Send enquiry';
          }
          showEnquireStatus(
            (result.data && (result.data.message || result.data.error)) ||
              'Could not send your enquiry. Try the email link below.',
            false
          );
        })
        .catch(function () {
          if (els.submit) {
            els.submit.disabled = false;
            els.submit.textContent = 'Send enquiry';
          }
          showEnquireStatus('Could not send your enquiry. Try the email link below.', false);
        });
    });
  }

  function loadSidebarAd() {
    if (!window.CmsAdBlocks) return;
    var el = document.getElementById('opportunity-page-sidebar-ad');
    if (!el) return;

    var loadCarousel = window.CmsAdBlocks.loadOpportunityPageCarouselAds
      ? window.CmsAdBlocks.loadOpportunityPageCarouselAds(el)
      : window.CmsAdBlocks.loadPageCarouselAds(el, { slot: 'opportunity_page_carousel_ads' });

    Promise.resolve(loadCarousel)
      .then(function (shown) {
        if (shown) return true;
        return window.CmsAdBlocks.loadCmsAd('opportunity_page_sidebar_ad').then(function (block) {
          return window.CmsAdBlocks.renderCompactAd(el, block, 'opportunity_page_sidebar_ad', {
            showPlaceholder: true,
          });
        });
      })
      .catch(function () {});
  }

  function wireListingReport(item) {
    var btn = document.getElementById('opp-report-btn');
    if (!btn || !window.ListingReport || !item || !item.id) return;
    window.ListingReport.attachTrigger(btn, {
      listingType: 'opportunity',
      opportunityId: item.id,
      title: item.title || 'Opportunity',
    });
  }

  function recordOpportunityView(item) {
    if (!item || !item.id) return;
    try {
      fetch('/api/opportunities', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record_view', opportunityId: item.id }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {
      /* ignore */
    }
  }

  var enquireJumpBound = false;

  function refreshEnquireJumpVisibility() {
    var jump = document.getElementById('opp-enquire-jump');
    var card = document.getElementById('opp-enquire-card');
    if (!jump || !card) return;

    var mobile = window.matchMedia('(max-width: 768px)').matches;
    var cardVisible = jump.dataset.cardVisible === '1';
    var show = mobile && !cardVisible;

    jump.hidden = !show;
    jump.classList.toggle('is-visible', show);
    document.body.classList.toggle('opp-enquire-jump-active', show);
  }

  function initEnquireJumpBar() {
    if (enquireJumpBound) {
      refreshEnquireJumpVisibility();
      return;
    }
    var jump = document.getElementById('opp-enquire-jump');
    var card = document.getElementById('opp-enquire-card');
    var btn = document.getElementById('opp-enquire-jump-btn');
    if (!jump || !card || !btn) return;
    enquireJumpBound = true;

    btn.addEventListener('click', function () {
      var navOffset = window.matchMedia('(max-width: 768px)').matches ? 64 : 80;
      var top = card.getBoundingClientRect().top + window.scrollY - navOffset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });

    window.matchMedia('(max-width: 768px)').addEventListener('change', refreshEnquireJumpVisibility);

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          jump.dataset.cardVisible =
            entry.isIntersecting && entry.intersectionRatio > 0.15 ? '1' : '0';
          refreshEnquireJumpVisibility();
        });
      },
      { threshold: [0, 0.15, 0.35], rootMargin: '-56px 0px -72px 0px' }
    );
    observer.observe(card);
    refreshEnquireJumpVisibility();
  }

  function finishInit(item, softLaunchMeta) {
    syncEnquiriesOpenFromSoftLaunch(softLaunchMeta);
    if (!item) {
      showNotFound();
      return;
    }
    maybeRedirectToCanonicalSlug(item);
    render(item);
    recordOpportunityView(item);
    bindSave();
    bindForm();
    bindClaimForm();
    prefillEnquireForm();
    wireListingReport(item);
    loadSidebarAd();
    initEnquireJumpBar();
  }

  function init() {
    syncEnquiriesOpenFromSoftLaunch(null);
    if (!catalog) {
      showNotFound();
      return;
    }

    var slug = resolveSlug();
    var item = catalog.getBySlug ? catalog.getBySlug(slug) : catalog.getById(slug);
    if (item) {
      finishInit(item);
      return;
    }

    var fetcher = catalog.fetchBySlugOrId || catalog.fetchById;
    if (fetcher) {
      fetcher(slug).then(function (result) {
        if (result && result.opportunity) {
          finishInit(result.opportunity, result.softLaunch || null);
          return;
        }
        finishInit(result, result && result._softLaunch ? result._softLaunch : null);
      });
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
