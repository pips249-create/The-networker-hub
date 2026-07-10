/**
 * Opportunity detail page — /opportunities/:slug
 */
(function () {
  var catalog = window.HubOpportunitiesCatalog;
  var saves = window.HubOpportunitySaves;
  var current = null;
  var sessionUser = null;

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
    enquireStatus: document.getElementById('opp-enquire-status'),
    investBreakdownSection: document.getElementById('opp-investment-breakdown-section'),
    investBreakdownLede: document.getElementById('opp-investment-breakdown-lede'),
    investBreakdownList: document.getElementById('opp-investment-breakdown-list'),
    enquireSignin: document.getElementById('opp-enquire-signin'),
    claimSection: document.getElementById('opp-claim-section'),
    claimForm: document.getElementById('opp-claim-form'),
    claimSubmit: document.getElementById('opp-claim-submit'),
    claimStatus: document.getElementById('opp-claim-status'),
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
    document.title = 'Opportunity not found – The Networker Hub';
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
      el.style.background = '#fff';
      el.classList.add('has-logo');
      el.innerHTML =
        '<img src="' +
        escapeHtml(logo) +
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
      .filter(function (m) {
        return !/^investment includes$/i.test(m.key);
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

  function renderInvestmentBreakdown(item) {
    if (!els.investBreakdownSection) return;
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

  function enquiryEmail(item) {
    var email = String((item && item.contactEmail) || '').trim();
    return email || 'hello@thenetworkerhub.com';
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

    var posterNote = document.querySelector('.opp-detail-poster-note');
    if (posterNote) {
      posterNote.textContent = item.claimable
        ? 'Listed on behalf of this business by The Networker Hub. Use the claim form below if you represent this company.'
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
    renderInvestmentBreakdown(item);
    renderAbout(item);
    refreshSaveButton();
    applyClaimSection(item);

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
      saves.toggle(current.id).then(function () {
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

    if (els.enquireSignin) els.enquireSignin.hidden = signedIn;
    if (els.form) els.form.hidden = !signedIn;
    if (els.submit) els.submit.disabled = !signedIn;

    var next = window.location.pathname + window.location.search + window.location.hash;
    var loginLink = document.getElementById('opp-enquire-login-link');
    var registerLink = document.getElementById('opp-enquire-register-link');
    if (loginLink) loginLink.href = '../login.html?next=' + encodeURIComponent(next);
    if (registerLink) registerLink.href = '../register.html?next=' + encodeURIComponent(next);

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
              'Could not send your request. Please email hello@thenetworkerhub.com instead.',
            false
          );
        })
        .catch(function () {
          if (els.claimSubmit) {
            els.claimSubmit.disabled = false;
            els.claimSubmit.textContent = 'Request to claim listing';
          }
          showClaimStatus(
            'Could not send your request. Please email hello@thenetworkerhub.com instead.',
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

    window.CmsAdBlocks.loadCmsAd('opportunity_page_sidebar_ad')
      .then(function (block) {
        window.CmsAdBlocks.renderCompactAd(el, block);
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

  function finishInit(item) {
    if (!item) {
      showNotFound();
      return;
    }
    maybeRedirectToCanonicalSlug(item);
    render(item);
    bindSave();
    bindForm();
    bindClaimForm();
    prefillEnquireForm();
    wireListingReport(item);
    loadSidebarAd();
  }

  function init() {
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
      fetcher(slug).then(finishInit);
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
