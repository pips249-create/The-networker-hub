/**
 * Public organiser profile — /organisers/:slug or organiser.html?id=
 */
(function () {
  var API = '/api/organisers';

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

  function queryParams() {
    var params = new URLSearchParams(location.search);
    return {
      slug: params.get('slug') || '',
      id: params.get('id') || '',
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

  function renderLogo(org) {
    var wrap = document.getElementById('org-logo-wrap');
    if (!wrap) return;
    var letter = String(org.name || '?').trim().charAt(0).toUpperCase() || '?';
    if (org.photoUrl) {
      wrap.innerHTML =
        '<img class="org-profile-logo" src="' +
        escapeHtml(org.photoUrl) +
        '" alt="" onerror="this.parentElement.innerHTML=\'<span class=org-profile-logo-placeholder>' +
        escapeHtml(letter) +
        '</span>\'">';
    } else {
      wrap.innerHTML =
        '<span class="org-profile-logo-placeholder" aria-hidden="true">' + escapeHtml(letter) + '</span>';
    }
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

    renderLogo(org);
    document.getElementById('org-name').textContent = org.name || 'Organiser';

    var industryEl = document.getElementById('org-industry');
    var industry = org.industry || (org.industries && org.industries[0]) || '';
    if (industry && industryEl) {
      industryEl.textContent = industry;
      industryEl.hidden = false;
    } else if (industryEl) {
      industryEl.hidden = true;
    }

    document.getElementById('org-stars').innerHTML = starsHtml(org.rating);
    var reviews = Number(org.reviews) || 0;
    document.getElementById('org-review-count').textContent =
      reviews + ' review' + (reviews === 1 ? '' : 's');

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

  async function load() {
    var q = queryParams();
    var url = API;
    if (q.slug) url += '?slug=' + encodeURIComponent(q.slug);
    else if (q.id) url += '?id=' + encodeURIComponent(q.id);
    else {
      setStatus('Missing organiser link.', true);
      return;
    }

    setLoading(true);
    setStatus('', false);
    try {
      var res = await fetch(url);
      var data = await res.json();
      if (!res.ok || !data.organiser) {
        setStatus(data.message || 'Organiser not found.', true);
        return;
      }
      renderOrganiser(data.organiser);
    } catch (e) {
      setStatus('Could not load organiser profile.', true);
    } finally {
      setLoading(false);
    }
  }

  load();
})();
