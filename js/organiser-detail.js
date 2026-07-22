/**
 * Public organiser profile — /organisers/:slug or organiser.html?id=
 */
(function () {
  var API = '/api/organisers';
  var currentOrganiser = null;
  var claimFormBound = false;

  var MOCK_REVIEWS = [
    {
      name: 'Sarah Mitchell',
      date: '12 May 2026',
      rating: 5,
      text: 'Brilliantly run events — welcoming hosts, sharp content, and genuinely useful connections every time.',
    },
    {
      name: 'James Okonkwo',
      date: '3 Apr 2026',
      rating: 4,
      text: 'Professional setup and a great mix of people. Would happily book again for our team.',
    },
    {
      name: 'Emma Clarke',
      date: '18 Mar 2026',
      rating: 4,
      text: 'Clear communication before the day and a well-paced session. Felt worth the ticket price.',
    },
    {
      name: 'Jamie Reid',
      date: '25 Jan 2026',
      rating: 5,
      text: 'Professional hosting and respectful pacing — I left with three solid follow-ups.',
    },
  ];

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function starsHtml(rating) {
    var avg = Number(rating);
    var full =
      Number.isFinite(avg) && avg > 0 ? Math.min(5, Math.max(0, Math.round(avg))) : 0;
    var html = '';
    for (var i = 1; i <= 5; i++) {
      html +=
        '<span class="star ' +
        (i <= full ? 'is-full' : '') +
        '" aria-hidden="true">★</span>';
    }
    return html;
  }

  function starsFromAvg(avg) {
    var n = Number(avg);
    if (!Number.isFinite(n) || n <= 0) return '☆☆☆☆☆';
    var full = Math.floor(n);
    var half = n - full >= 0.5 ? 1 : 0;
    var empty = 5 - full - half;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
  }

  function queryParams() {
    var params = new URLSearchParams(location.search);
    var slug = params.get('slug') || '';
    var id = params.get('id') || '';
    if (!slug && !id) {
      var pathMatch = location.pathname.match(/\/organisers\/([^/]+)\/?$/i);
      if (pathMatch) slug = decodeURIComponent(pathMatch[1]);
    }
    return {
      slug: slug,
      id: id,
    };
  }

  function eventHref(ev) {
    var slug = ev.slug ? String(ev.slug).trim() : '';
    if (slug) return '/events/' + encodeURIComponent(slug);
    return '/events/event?id=' + encodeURIComponent(ev.id);
  }

  function markOrganiserPageReady() {
    document.documentElement.classList.add('org-page-ready');
  }

  function setLoading(on) {
    var overlay = document.getElementById('org-load-overlay');
    if (window.hubLoading) {
      if (on) window.hubLoading.show('org-load-overlay');
      else window.hubLoading.hide('org-load-overlay');
    } else if (overlay) {
      overlay.classList.toggle('is-active', !!on);
      overlay.hidden = !on;
    }
    document.body.classList.toggle('hub-is-page-loading', !!on);
    if (!on) markOrganiserPageReady();
  }

  function setStatus(msg, isError) {
    var el = document.getElementById('org-load-status');
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || '';
    el.classList.toggle('is-error', Boolean(isError));
  }

  function renderPhoto(org) {
    var wrap = document.getElementById('org-photo-wrap');
    if (!wrap) return;
    var letter = String(org.name || '?').trim().charAt(0).toUpperCase() || '?';
    if (org.photoUrl) {
      wrap.innerHTML =
        '<img class="org-profile-logo" src="' +
        escapeHtml(org.photoUrl) +
        '" alt="" loading="eager" decoding="async" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML=\'<span class=org-profile-logo-placeholder>' +
        escapeHtml(letter) +
        '</span>\'">';
    } else {
      wrap.innerHTML =
        '<span class="org-profile-logo-placeholder" aria-hidden="true">' + escapeHtml(letter) + '</span>';
    }
  }

  function appendReviewCard(feed, review, context) {
    var card = document.createElement('article');
    card.className = 'org-review-card';
    var header = document.createElement('div');
    header.className = 'org-review-card-header';
    var name = document.createElement('strong');
    name.textContent = review.name || 'Attendee';
    var date = document.createElement('span');
    date.className = 'org-review-card-date';
    date.textContent = review.date || '';
    header.appendChild(name);
    header.appendChild(date);
    var stars = document.createElement('div');
    stars.className = 'org-review-card-stars';
    stars.setAttribute('aria-label', (review.rating || 0) + ' out of 5 stars');
    stars.textContent = starsFromAvg(review.rating);
    var body = document.createElement('p');
    body.textContent = review.text || '';
    card.appendChild(header);
    card.appendChild(stars);
    card.appendChild(body);
    var reply = review.reply ? String(review.reply).trim() : '';
    if (reply) {
      var replyBlock = document.createElement('div');
      replyBlock.className = 'org-review-organiser-reply';
      var replyLabel = document.createElement('div');
      replyLabel.className = 'org-review-organiser-reply-label';
      replyLabel.textContent = 'Organiser reply';
      var replyText = document.createElement('p');
      replyText.className = 'org-review-organiser-reply-text';
      replyText.textContent = reply;
      replyBlock.appendChild(replyLabel);
      replyBlock.appendChild(replyText);
      card.appendChild(replyBlock);
    }
    if (review.id && window.ReviewReport) {
      window.ReviewReport.addReportButton(card, {
        reviewId: review.id,
        organiserId: context && context.organiserId,
        snippet: String(review.text || '').slice(0, 500),
      });
    }
    feed.appendChild(card);
  }

  function resolveReviewItems(org) {
    var items = Array.isArray(org.reviewItems) ? org.reviewItems : [];
    if (items.length) return items;
    var count = Number(org.reviews) || 0;
    if (count > 0 && count <= MOCK_REVIEWS.length) {
      return MOCK_REVIEWS.slice(0, count);
    }
    return [];
  }

  function renderReviews(org) {
    var rating = Number(org.rating) || 0;
    var count = Number(org.reviews) || 0;
    var starsEl = document.getElementById('org-stars');
    var summaryEl = document.getElementById('org-review-summary');
    var leadEl = document.getElementById('org-reviews-lead');
    var feed = document.getElementById('org-reviews-feed');
    var emptyEl = document.getElementById('org-reviews-empty');
    var ratingWrap = document.getElementById('org-rating-wrap');

    if (starsEl) starsEl.innerHTML = starsHtml(rating);
    if (summaryEl) {
      summaryEl.textContent =
        count > 0 && rating > 0
          ? rating.toFixed(1) + ' average · ' + count + ' review' + (count === 1 ? '' : 's')
          : 'No reviews yet';
    }
    if (ratingWrap) {
      ratingWrap.hidden = count <= 0 && rating <= 0;
    }

    if (leadEl) {
      if (count > 0 && rating > 0) {
        leadEl.innerHTML =
          'This organiser shows an average of <strong>' +
          rating.toFixed(1) +
          ' stars</strong> from <strong>' +
          count +
          ' rating' +
          (count === 1 ? '' : 's') +
          '</strong>.';
      } else {
        leadEl.textContent = 'Reviews appear here after attendees share feedback from events.';
      }
    }

    if (!feed) return;
    feed.innerHTML = '';

    var items = resolveReviewItems(org);
    if (items.length) {
      if (emptyEl) emptyEl.hidden = true;
      items.forEach(function (review) {
        appendReviewCard(feed, review, { organiserId: org.id });
      });
      return;
    }

    if (count > 0) {
      if (emptyEl) emptyEl.hidden = true;
      var note = document.createElement('p');
      note.className = 'org-reviews-empty';
      note.textContent = 'Attendee reviews will appear here as they are submitted.';
      feed.appendChild(note);
      return;
    }

    if (emptyEl) emptyEl.hidden = false;
  }

  function renderEvents(events) {
    var list = document.getElementById('org-events');
    var empty = document.getElementById('org-events-empty');
    if (!list) return;

    if (!events || !events.length) {
      list.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    list.innerHTML = events
      .map(function (ev) {
        var meta = [ev.dateLine, ev.city, ev.meetingType].filter(Boolean).join(' · ');
        return (
          '<a class="org-event-row" href="' +
          escapeHtml(eventHref(ev)) +
          '"><div><p class="org-event-row-title">' +
          escapeHtml(ev.title) +
          '</p><p class="org-event-row-meta">' +
          escapeHtml(meta || 'Details on event page') +
          '</p></div><span class="org-event-row-cta">View event →</span></a>'
        );
      })
      .join('');
  }

  function rankingCollapseKey(orgId) {
    return 'hub_org_public_ranking_collapsed_' + String(orgId || 'default');
  }

  function isRankingPanelCollapsed(orgId) {
    try {
      var stored = localStorage.getItem(rankingCollapseKey(orgId));
      if (stored === null) return true;
      return stored === '1';
    } catch (e) {
      return true;
    }
  }

  function setRankingPanelCollapsed(orgId, collapsed) {
    try {
      localStorage.setItem(rankingCollapseKey(orgId), collapsed ? '1' : '0');
    } catch (e) {
      /* ignore */
    }
  }

  function bindPublicRankingPanel(orgId) {
    var panel = document.getElementById('org-ranking-panel');
    var toggle = panel && panel.querySelector('.org-ranking-panel-toggle');
    var body = document.getElementById('org-ranking-panel-body');
    var chev = panel && panel.querySelector('.org-ranking-panel-chev');
    if (!panel || !toggle || !body) return;

    function applyCollapsed(collapsed) {
      body.hidden = collapsed;
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      if (chev) chev.textContent = collapsed ? 'Show' : 'Hide';
      panel.classList.toggle('is-expanded', !collapsed);
    }

    applyCollapsed(isRankingPanelCollapsed(orgId));
    toggle.onclick = function () {
      var collapsed = !body.hidden;
      applyCollapsed(collapsed);
      setRankingPanelCollapsed(orgId, collapsed);
    };
  }

  function showReviewStatus(message, type) {
    var el = document.getElementById('org-review-status');
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function bindReviewButton(org) {
    var btn = document.getElementById('org-review-btn');
    if (!btn || !org || !org.id) return;

    if (window.HubReviewModal) {
      window.HubReviewModal.init({
        onSubmitted: function () {
          showReviewStatus('Thank you — your review has been submitted.', 'success');
          load();
        },
      });
    }

    btn.onclick = async function () {
      showReviewStatus('', null);
      btn.disabled = true;
      try {
        var sessionRes = await fetch('/api/auth/session', { credentials: 'include' });
        var session = await sessionRes.json();
        if (!session.ok || !session.user) {
          var next = location.pathname + location.search;
          window.location.href = '../login?next=' + encodeURIComponent(next);
          return;
        }

        var dashRes = await fetch('/api/auth/attendee-dashboard', { credentials: 'include' });
        var dash = await dashRes.json();
        if (!dashRes.ok || !dash.ok) {
          showReviewStatus('Could not load your bookings. Please try again.', 'error');
          return;
        }

        var organiserId = String(org.id);
        var pending = (dash.registrations || []).filter(function (reg) {
          return String(reg.organiserId) === organiserId && reg.reviewStatus === 'pending';
        });

        if (!pending.length) {
          var attended = (dash.registrations || []).filter(function (reg) {
            return String(reg.organiserId) === organiserId;
          });
          if (attended.some(function (reg) { return reg.reviewStatus === 'reviewed'; })) {
            showReviewStatus(
              'You have already reviewed the events you attended with this organiser.',
              null
            );
          } else if (attended.length) {
            showReviewStatus(
              'You can leave a review after the event has finished.',
              null
            );
          } else {
            showReviewStatus(
              'Attend one of this organiser\'s events first — then you can leave a review here.',
              null
            );
          }
          return;
        }

        if (!window.HubReviewModal) {
          showReviewStatus('Review form could not load. Refresh the page and try again.', 'error');
          return;
        }

        if (pending.length === 1) {
          window.HubReviewModal.open({
            eventId: pending[0].eventId,
            title: pending[0].title,
            organiserName: org.name,
          });
          return;
        }

        window.HubReviewModal.openPicker(pending, org.name);
      } catch (e) {
        showReviewStatus('Something went wrong. Please try again.', 'error');
      } finally {
        btn.disabled = false;
      }
    };
  }

  function renderOrganiser(org) {
    currentOrganiser = org;
    document.getElementById('org-profile-content').hidden = false;
    document.title = (org.name || 'Organiser') + ' – The Networker Hub';

    renderPhoto(org);
    document.getElementById('org-name').textContent = org.name || 'Organiser';

    var panel = document.getElementById('org-ranking-panel');
    var summaryEl = document.getElementById('org-ranking-panel-summary');
    var rankingEl = document.getElementById('org-ranking-badge');
    var metaEl = document.getElementById('org-ranking-meta');

    if (org.ranking && org.ranking.label) {
      var tier = org.ranking.tier || 'top10';
      var badgeText =
        org.ranking.displayLabel ||
        String(org.ranking.label).replace(' on the Hub', '') +
          (org.ranking.periodLabel ? ' · ' + org.ranking.periodLabel : '');

      if (panel) panel.hidden = false;
      if (summaryEl) summaryEl.textContent = ' — ' + badgeText;

      if (rankingEl) {
        rankingEl.className =
          'org-profile-ranking hub-ranking-badge hub-ranking-badge--' + tier + ' hub-ranking-badge--lg';
        rankingEl.textContent = '★ ' + badgeText;
        rankingEl.title =
          'Ranked #' +
          org.ranking.rank +
          ' of ' +
          org.ranking.totalRanked +
          ' rated networking groups on the Hub';
      }

      if (metaEl) {
        metaEl.textContent =
          'Ranked #' +
          org.ranking.rank +
          ' of ' +
          org.ranking.totalRanked +
          ' rated networking groups on the Hub (★ ' +
          Number(org.ranking.rating).toFixed(1) +
          ' from ' +
          org.ranking.reviewCount +
          ' review' +
          (Number(org.ranking.reviewCount) === 1 ? '' : 's') +
          ').';
      }

      bindPublicRankingPanel(org.id);
    } else {
      if (panel) panel.hidden = true;
      if (summaryEl) summaryEl.textContent = '';
      if (rankingEl) {
        rankingEl.className = 'org-profile-ranking hub-ranking-badge';
        rankingEl.textContent = '';
        rankingEl.removeAttribute('title');
      }
      if (metaEl) metaEl.textContent = '';
    }

    renderReviews(org);

    document.getElementById('org-description').textContent =
      org.description ||
      'This organiser is building their profile on The Networker Hub. Browse their upcoming listings below.';

    var formats = org.meetingFormats || [];
    var formatsSection = document.getElementById('org-formats-section');
    var formatsEl = document.getElementById('org-formats');
    if (formats.length && formatsEl && formatsSection) {
      formatsSection.hidden = false;
      formatsEl.innerHTML = formats
        .map(function (fmt) {
          return '<span class="org-format-pill">' + escapeHtml(fmt) + '</span>';
        })
        .join('');
    } else if (formatsSection) {
      formatsSection.hidden = true;
    }

    var website = document.getElementById('org-website');
    if (website) {
      if (org.website && /^https?:\/\//i.test(org.website)) {
        website.href = org.website;
        website.hidden = false;
      } else {
        website.hidden = true;
      }
    }

    var actionsPrimary = document.querySelector('.org-profile-actions-primary');
    var socialWrap = document.getElementById('org-social-links');
    if (!socialWrap && actionsPrimary) {
      socialWrap = document.createElement('div');
      socialWrap.id = 'org-social-links';
      socialWrap.className = 'org-profile-social-links';
      actionsPrimary.appendChild(socialWrap);
    }
    if (socialWrap) {
      var socialItems = [
        { label: 'Instagram', url: org.instagramUrl },
        { label: 'Facebook', url: org.facebookUrl },
        { label: 'LinkedIn', url: org.linkedinUrl },
        { label: 'X', url: org.xUrl },
      ].filter(function (item) {
        return item.url && /^https?:\/\//i.test(item.url);
      });
      if (socialItems.length) {
        socialWrap.hidden = false;
        socialWrap.innerHTML = socialItems
          .map(function (item) {
            return (
              '<a class="org-profile-btn org-profile-btn--social" href="' +
              escapeHtml(item.url) +
              '" target="_blank" rel="noopener noreferrer">' +
              escapeHtml(item.label) +
              '</a>'
            );
          })
          .join('');
      } else {
        socialWrap.hidden = true;
        socialWrap.innerHTML = '';
      }
    }

    renderEvents(org.events || []);

    var reportBtn = document.getElementById('org-report-btn');
    if (reportBtn && window.ListingReport && org.id) {
      window.ListingReport.attachTrigger(reportBtn, {
        listingType: 'organiser',
        organiserId: org.id,
        title: org.name || 'Organiser',
      });
    }

    var shareBtn = document.getElementById('org-share-btn');
    if (shareBtn) {
      shareBtn.onclick = function () {
        var url = location.href;
        if (navigator.share) {
          navigator
            .share({ title: org.name, text: 'Networking group on The Networker Hub', url: url })
            .catch(function () {});
          return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            shareBtn.textContent = 'Link copied';
            setTimeout(function () {
              shareBtn.textContent = 'Share';
            }, 2000);
          });
        }
      };
    }

    var saveBtn = document.getElementById('org-save-btn');
    if (saveBtn && org.id) {
      saveBtn.setAttribute('data-organiser-id', String(org.id));
      function refreshSaveUi() {
        var saved = window.HubOrganiserFavourites ? window.HubOrganiserFavourites.isSaved(org.id) : false;
        saveBtn.setAttribute('aria-pressed', saved ? 'true' : 'false');
        saveBtn.classList.toggle('is-saved', saved);
      }
      refreshSaveUi();
      if (window.HubOrganiserFavourites) {
        window.HubOrganiserFavourites.sync().then(function () {
          refreshSaveUi();
        });
      }
      saveBtn.onclick = function () {
        if (!window.HubOrganiserFavourites) return;
        window.HubOrganiserFavourites.toggle(org.id).then(function () {
          refreshSaveUi();
        });
      };
    }

    bindReviewButton(org);
    applyClaimSection(org);
  }

  function applyClaimSection(org) {
    var section = document.getElementById('org-claim-section');
    if (!section) return;
    var claimable = Boolean(org && org.claimable);
    section.hidden = !claimable;
    if (!claimable) return;
    bindClaimForm();
  }

  function showClaimStatus(msg, ok) {
    var el = document.getElementById('org-claim-status');
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
    el.className = 'org-claim-status' + (ok ? ' is-ok' : ' is-error');
  }

  function bindClaimForm() {
    if (claimFormBound) return;
    var form = document.getElementById('org-claim-form');
    if (!form) return;
    claimFormBound = true;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!currentOrganiser || !currentOrganiser.claimable) return;

      var name = (document.getElementById('org-claim-name').value || '').trim();
      var email = (document.getElementById('org-claim-email').value || '').trim();
      var role = (document.getElementById('org-claim-role').value || '').trim();
      var message = (document.getElementById('org-claim-message').value || '').trim();
      if (!name || !email) return;

      var submitBtn = document.getElementById('org-claim-submit');
      var statusEl = document.getElementById('org-claim-status');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending request…';
      }
      if (statusEl) statusEl.hidden = true;

      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'claim_request',
          organiserId: currentOrganiser.id,
          name: name,
          email: email,
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
              'Request sent — our team will email you to verify your details and send a claim link.',
              true
            );
            if (submitBtn) submitBtn.textContent = 'Request sent';
            form.reset();
            return;
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Request access to this profile';
          }
          showClaimStatus(
            (result.data && (result.data.message || result.data.error)) ||
              'Could not send your request. Please email hello@thenetworkerhub.com instead.',
            false
          );
        })
        .catch(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Request access to this profile';
          }
          showClaimStatus('Could not send your request. Please try again later.', false);
        });
    });
  }

  async function loadOrganiserPageAd() {
    if (!window.CmsAdBlocks) return;
    var el = document.getElementById('organiser-page-sidebar-ad');
    if (!el) return;
    try {
      await window.CmsAdBlocks.loadOrganiserPageCarouselAds(el);
    } catch (e) {
      /* non-fatal */
    }
  }

  async function load() {
    var q = queryParams();
    var url = API;
    if (q.slug) url += '?slug=' + encodeURIComponent(q.slug);
    else if (q.id) url += '?id=' + encodeURIComponent(q.id);
    else {
      setLoading(false);
      setStatus('Missing organiser link.', true);
      return;
    }

    setLoading(true);

    const fetchOrganiser = async () => {
      setStatus('', false);
      try {
        var res = await fetch(url);
        var data = await res.json();
        if (!res.ok || !data.organiser) {
          setStatus(data.message || 'Organiser not found.', true);
          return;
        }
        renderOrganiser(data.organiser);
        loadOrganiserPageAd();
      } catch (e) {
        setStatus('Could not load organiser profile.', true);
      }
    };

    try {
      if (window.FactLoader) {
        await window.FactLoader.run(fetchOrganiser);
      } else {
        await fetchOrganiser();
      }
    } finally {
      setLoading(false);
    }
  }

  load();
})();
