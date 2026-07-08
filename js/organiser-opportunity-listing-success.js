/**
 * Confirm business opportunity listing payment after Stripe redirect.
 */
(function () {
  var params = new URLSearchParams(location.search);
  var sessionId = params.get('session_id') || '';
  var id = params.get('id') || '';
  var title = params.get('title') || '';
  var months = params.get('months') || '';

  var lede = document.getElementById('oe-listing-success-lede');
  var status = document.getElementById('oe-listing-success-status');
  var actions = document.getElementById('oe-listing-success-actions');
  var viewDirectory = document.getElementById('oe-listing-view-directory');
  var viewYours = document.getElementById('oe-listing-view-yours');
  var editBtn = document.getElementById('oe-listing-edit');
  var previewCard = document.getElementById('oe-premium-preview-card');
  var opportunityDrawerLoadTimeout = null;

  var META_PIN_SVG =
    '<svg class="premium-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  var META_HOST_SVG =
    '<svg class="premium-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  var listingSlug = '';

  function listingUrl() {
    if (!id) return '/opportunities/';
    if (window.HubPublicUrls && window.HubPublicUrls.opportunityDetailHref) {
      return window.HubPublicUrls.opportunityDetailHref({ id: id, slug: listingSlug, title: title });
    }
    return '/opportunities/' + encodeURIComponent(listingSlug || id);
  }

  function setOpportunityDrawerLoading(on) {
    var wrap = document.getElementById('oe-opportunity-drawer-frame-wrap');
    var loading = document.getElementById('oe-opportunity-drawer-loading');
    if (!wrap || !loading) return;
    wrap.classList.toggle('is-loading', !!on);
    loading.hidden = !on;
    if (!on && opportunityDrawerLoadTimeout) {
      clearTimeout(opportunityDrawerLoadTimeout);
      opportunityDrawerLoadTimeout = null;
    }
  }

  function closeOpportunityEditorDrawer() {
    var drawer = document.getElementById('oe-opportunity-drawer');
    var frame = document.getElementById('oe-opportunity-drawer-frame');
    if (!drawer) return;
    drawer.classList.remove('is-open');
    document.body.classList.remove('oe-opportunity-drawer-open');
    setOpportunityDrawerLoading(false);
    window.setTimeout(function () {
      if (!drawer.classList.contains('is-open')) {
        drawer.hidden = true;
        drawer.setAttribute('aria-hidden', 'true');
        if (frame) frame.removeAttribute('src');
      }
    }, 280);
  }

  function openOpportunityEditorDrawer(opportunityId, titleText) {
    var drawer = document.getElementById('oe-opportunity-drawer');
    var frame = document.getElementById('oe-opportunity-drawer-frame');
    var titleEl = document.getElementById('oe-opportunity-drawer-title');
    if (!drawer || !frame || !opportunityId) {
      location.href = 'opportunity-edit.html?id=' + encodeURIComponent(opportunityId || id);
      return;
    }

    if (titleEl) {
      titleEl.textContent = titleText || (title ? 'Edit: ' + title : 'Edit listing');
    }

    setOpportunityDrawerLoading(true);
    if (opportunityDrawerLoadTimeout) clearTimeout(opportunityDrawerLoadTimeout);
    opportunityDrawerLoadTimeout = window.setTimeout(function () {
      setOpportunityDrawerLoading(false);
    }, 12000);

    frame.src = 'opportunity-edit.html?id=' + encodeURIComponent(opportunityId) + '&embed=1';
    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    window.requestAnimationFrame(function () {
      drawer.classList.add('is-open');
    });
    document.body.classList.add('oe-opportunity-drawer-open');
  }

  function bindOpportunityEditorDrawer() {
    document.querySelectorAll('[data-oe-opportunity-drawer-close]').forEach(function (el) {
      el.addEventListener('click', closeOpportunityEditorDrawer);
    });

    if (editBtn) {
      editBtn.addEventListener('click', function () {
        if (!id) return;
        openOpportunityEditorDrawer(id, title ? 'Edit: ' + title : 'Edit listing');
      });
    }

    window.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data) return;
      if (e.data.type === 'hub-opportunity-drawer-ready') {
        setOpportunityDrawerLoading(false);
      }
      if (e.data.type === 'hub-opportunity-saved') {
        if (e.data.id) id = String(e.data.id);
        if (e.data.title) title = String(e.data.title);
        if (lede && title) {
          lede.textContent = '"' + title + '" is now live in the business opportunities directory.';
        }
        if (viewYours && id) viewYours.href = listingUrl();
        loadOpportunityForPreview();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var drawer = document.getElementById('oe-opportunity-drawer');
      if (drawer && !drawer.hidden && drawer.classList.contains('is-open')) {
        closeOpportunityEditorDrawer();
      }
    });
  }

  function enrichOpportunity(raw) {
    var catalog = window.HubOpportunitiesCatalog;
    if (!catalog || !raw) return null;
    return catalog.normalizeListing(catalog.apiRowToSeed(raw), 0);
  }

  function investmentLabel(item) {
    var catalog = window.HubOpportunitiesCatalog;
    var meta = catalog ? catalog.cardDisplayMeta(item) : (item.meta || []).slice(0, 1);
    if (meta.length && meta[0].val) {
      return catalog
        ? catalog.formatMetaDisplayValue(meta[0].key, meta[0].val)
        : String(meta[0].val);
    }
    return 'Enquire';
  }

  function previewItemFromParams() {
    if (!title && !id) return null;
    return enrichOpportunity({
      id: id || 'preview',
      type: 'franchise',
      title: title || 'Your opportunity',
      host: 'Your business',
      meta: [],
    });
  }

  function renderPremiumPreview(raw) {
    if (!previewCard) return;

    var item = enrichOpportunity(raw) || previewItemFromParams();
    if (!item) {
      previewCard.innerHTML =
        '<div class="oe-premium-preview-card oe-premium-preview-card--placeholder">' +
        '<div class="premium-card-link">' +
        '<div class="premium-card-top"><span class="premium-badge">Premium</span></div>' +
        '<div class="premium-card-body">' +
        '<h3 class="premium-card-title">Your listing title</h3>' +
        '</div></div></div>';
      return;
    }

    var catalog = window.HubOpportunitiesCatalog;
    var thumb = item.thumb || { emoji: '✦', gradient: 'linear-gradient(135deg,#fdf6e3,#f5e0a0)' };
    var cover = String(item.imageUrl || '').trim();
    var mediaInner = cover
      ? '<img class="oe-premium-preview-img" src="' +
        esc(cover) +
        '" alt="" loading="lazy" decoding="async" />'
      : '<span class="oe-premium-thumb-emoji" aria-hidden="true">' + esc(thumb.emoji) + '</span>';
    var typeLabels = catalog ? catalog.TYPE_LABELS : {};
    var typeClass = catalog
      ? catalog.typeClass(item.type)
      : 'opp-type-franchise';

    previewCard.innerHTML =
      '<article class="premium-card oe-premium-preview-card">' +
      '<div class="premium-card-link">' +
      '<div class="premium-card-media" aria-hidden="true">' +
      '<div class="premium-card-bg" style="background:' +
      esc(thumb.gradient) +
      '">' +
      mediaInner +
      '</div>' +
      '<div class="premium-card-overlay"></div></div>' +
      '<div class="premium-card-top">' +
      '<span class="premium-badge">Premium</span>' +
      '<span class="premium-price">' +
      esc(investmentLabel(item)) +
      '</span></div>' +
      '<div class="premium-card-body">' +
      '<span class="opp-premium-type ' +
      esc(typeClass) +
      '">' +
      esc(typeLabels[item.type] || item.type || 'Opportunity') +
      '</span>' +
      '<h3 class="premium-card-title">' +
      esc(item.title) +
      '</h3>' +
      '<div class="premium-card-meta">' +
      '<p class="premium-meta-row">' +
      META_PIN_SVG +
      '<span>' +
      esc(item.locationLabel || 'UK') +
      '</span></p>' +
      '<p class="premium-meta-row">' +
      META_HOST_SVG +
      '<span>' +
      esc(item.host || 'Listed on The Networker') +
      '</span></p>' +
      '</div></div></div></article>';
  }

  async function loadOpportunityForPreview() {
    if (!id) {
      renderPremiumPreview(null);
      return null;
    }

    try {
      var res = await fetch(
        '/api/organiser/opportunities?id=' + encodeURIComponent(id),
        { credentials: 'include', cache: 'no-store' }
      );
      var data = {};
      try {
        data = await res.json();
      } catch (e) {
        data = {};
      }
      if (res.ok && data.ok && data.opportunity) {
        if (data.opportunity.slug) listingSlug = String(data.opportunity.slug);
        renderPremiumPreview(data.opportunity);
        return data.opportunity;
      }
    } catch (e) {
      /* preview fallback below */
    }

    renderPremiumPreview(null);
    return null;
  }

  function showCommsPack(opportunity) {
    var root = document.getElementById('oe-comms-pack');
    if (!root || !window.HubCommsPack) return;
    var opp = opportunity || previewItemFromParams();
    var url = listingUrl();
    var pack = window.HubCommsPack.buildOpportunityCommsPack(
      {
        title: (opp && opp.title) || title,
        host: (opp && (opp.host || opp.organiserName)) || '',
        summary: (opp && (opp.summary || opp.description)) || '',
      },
      url
    );
    root.hidden = false;
    window.HubCommsPack.bindCommsPack(root, pack);
  }

  function showReady(opportunity) {
    var term = months ? months + ' month' + (months === '1' ? '' : 's') : 'your chosen term';
    var pendingReview =
      opportunity &&
      String(opportunity.approvalStatus || opportunity.approval_status || '').toLowerCase() ===
        'pending review';
    var rejected =
      opportunity &&
      String(opportunity.approvalStatus || opportunity.approval_status || '').toLowerCase() ===
        'rejected';

    if (lede) {
      if (rejected) {
        lede.textContent = title
          ? '"' + title + '" could not be approved. Check your email for details and next steps.'
          : 'Your listing could not be approved. Check your email for details and next steps.';
      } else if (pendingReview) {
        lede.textContent = title
          ? '"' + title + '" has been submitted for review.'
          : 'Your opportunity has been submitted for review.';
      } else {
        lede.textContent = title
          ? '"' + title + '" is now live in the business opportunities directory.'
          : 'Your opportunity is now live in the business opportunities directory.';
      }
    }
    if (status) {
      var expiry = opportunity && opportunity.listingExpiresAt;
      if (rejected) {
        status.textContent =
          'Payment received. Edit your listing to address the issues in our email, then resubmit when ready.';
      } else if (pendingReview) {
        status.textContent = expiry
          ? 'Paid for ' +
            term +
            '. We typically review within 1–2 working days — you will receive an email when your listing goes live.'
          : 'Thank you — your listing fee has been received. We will email you once review is complete.';
      } else {
        status.textContent = expiry
          ? 'Paid for ' + term + '. Listing active until ' + new Date(expiry).toLocaleDateString('en-GB') + '.'
          : 'Thank you — your listing fee has been received.';
      }
    }
    if (viewDirectory && pendingReview) {
      viewDirectory.textContent = 'Browse opportunities';
    }
    if (actions) actions.hidden = false;
    if (opportunity) renderPremiumPreview(opportunity);
    showCommsPack(rejected || pendingReview ? null : opportunity);
  }

  function showError(msg) {
    if (lede) lede.textContent = 'We received your payment — finishing setup…';
    if (status) status.textContent = msg;
    if (actions) actions.hidden = false;
  }

  if (viewYours && id) viewYours.href = listingUrl();
  if (viewDirectory) viewDirectory.href = '/opportunities/';
  if (editBtn && !id) editBtn.disabled = true;
  bindOpportunityEditorDrawer();

  async function confirmListing() {
    renderPremiumPreview(previewItemFromParams());

    if (!sessionId) {
      var fetched = await loadOpportunityForPreview();
      showReady(fetched);
      return;
    }

    try {
      var res = await fetch('/api/organiser/opportunity-listing-complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId }),
      });
      var data = {};
      try {
        data = await res.json();
      } catch (e) {
        data = {};
      }

      if (res.ok && data.ok) {
        showReady(data.opportunity);
        return;
      }

      await loadOpportunityForPreview();
      showError(
        'Your payment went through — your listing may take a minute to appear. Refresh the directory shortly.'
      );
    } catch (e) {
      await loadOpportunityForPreview();
      showError(
        'Your payment went through — your listing may take a minute to appear. Refresh the directory shortly.'
      );
    }
  }

  confirmListing();
})();
