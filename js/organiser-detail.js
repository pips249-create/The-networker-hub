/**
 * Public organiser profile — /organisers/:slug or organiser.html?id=
 */
(function () {
  var API = '/api/organisers';

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
    return 'event.html?id=' + encodeURIComponent(ev.id);
  }

  function setLoading(on) {
    var overlay = document.getElementById('org-load-overlay');
    if (window.hubLoading) {
      if (on) window.hubLoading.show('org-load-overlay');
      else window.hubLoading.hide('org-load-overlay');
      return;
    }
    if (overlay) overlay.hidden = !on;
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
        '" alt="" loading="eager" decoding="async" onerror="this.parentElement.innerHTML=\'<span class=org-profile-logo-placeholder>' +
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

  function renderOrganiser(org) {
    document.getElementById('org-profile-content').hidden = false;
    document.title = (org.name || 'Organiser') + ' – The Networker Hub';

    renderPhoto(org);
    document.getElementById('org-name').textContent = org.name || 'Organiser';

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
  }

  async function loadOrganiserPageAd() {
    if (!window.CmsAdBlocks) return;
    var el = document.getElementById('organiser-page-sidebar-ad');
    if (!el) return;
    try {
      var block = await window.CmsAdBlocks.loadCmsAd('organiser_page_sidebar_ad');
      window.CmsAdBlocks.renderCompactAd(el, block);
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
      setStatus('Missing organiser link.', true);
      return;
    }

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

    if (window.FactLoader) {
      await window.FactLoader.run(fetchOrganiser);
      return;
    }

    setLoading(true);
    try {
      await fetchOrganiser();
    } finally {
      setLoading(false);
    }
  }

  load();
})();
