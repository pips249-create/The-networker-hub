/**
 * About page — scroll reveals, updates anchor, founding organisers marquee.
 */
(function () {
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function scrollToUpdatesIfNeeded() {
    if (String(window.location.hash || '').toLowerCase() !== '#updates') return;
    var el = document.getElementById('updates');
    if (!el) return;
    window.setTimeout(function () {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }

  function initReveal() {
    var sections = document.querySelectorAll('.about-reveal:not(.is-visible)');
    if (!sections.length) {
      scrollToUpdatesIfNeeded();
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sections.forEach(function (el) {
        el.classList.add('is-visible');
      });
      scrollToUpdatesIfNeeded();
      return;
    }

    if (!('IntersectionObserver' in window)) {
      sections.forEach(function (el) {
        el.classList.add('is-visible');
      });
      scrollToUpdatesIfNeeded();
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );

    sections.forEach(function (el) {
      observer.observe(el);
    });
    scrollToUpdatesIfNeeded();
  }

  function foundingItemHtml(org) {
    var name = String(org.name || 'Organiser').trim() || 'Organiser';
    var href = String(org.href || org.website || '').trim();
    var photo = String(org.photoUrl || '').trim();
    var initial = name.charAt(0).toUpperCase();
    var external = /^https?:\/\//i.test(href);
    var darkClass = org.logoBandDark ? ' about-founding-item--dark-logo' : '';
    var inner;
    if (photo) {
      inner =
        '<img src="' +
        esc(photo) +
        '" alt="' +
        esc(name) +
        '" loading="lazy" decoding="async" width="156" height="60" class="about-founding-logo" onerror="this.remove();var s=document.createElement(\'span\');s.className=\'about-founding-initial\';s.setAttribute(\'aria-hidden\',\'true\');s.textContent=this.alt?this.alt.charAt(0).toUpperCase():\'?\';this.parentElement.classList.add(\'about-founding-item--fallback\');this.parentElement.classList.remove(\'about-founding-item--dark-logo\');this.parentElement.appendChild(s);" />';
    } else {
      inner =
        '<span class="about-founding-initial" aria-hidden="true">' + esc(initial) + '</span>';
    }
    var fallbackClass = photo ? '' : ' about-founding-item--fallback';
    var title = esc(name);
    if (href) {
      return (
        '<a class="about-founding-item' +
        darkClass +
        fallbackClass +
        '" href="' +
        esc(href) +
        '"' +
        (external ? ' target="_blank" rel="noopener noreferrer"' : '') +
        ' title="' +
        title +
        '">' +
        inner +
        '</a>'
      );
    }
    return (
      '<div class="about-founding-item' +
      darkClass +
      fallbackClass +
      '" title="' +
      title +
      '">' +
      inner +
      '</div>'
    );
  }

  function renderFoundingOrganisers(list) {
    var section = document.getElementById('about-founding');
    var track = document.getElementById('about-founding-logos');
    var marquee = document.getElementById('about-founding-marquee');
    if (!section || !track) return;

    if (!list.length) {
      section.hidden = true;
      track.setAttribute('aria-busy', 'false');
      if (marquee) marquee.classList.remove('about-founding-marquee--scrollable');
      return;
    }

    section.hidden = false;
    section.classList.add('is-visible');
    track.classList.remove('about-founding-track--loading');
    track.setAttribute('aria-busy', 'false');

    var items = list.map(foundingItemHtml).join('');
    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var useMarquee = list.length >= 6 && !prefersReducedMotion;
    var isStatic = !useMarquee;
    var isScrollable = false;

    track.classList.toggle('about-founding-track--marquee', useMarquee);
    track.classList.toggle('about-founding-track--scroll', isScrollable);
    track.classList.toggle('about-founding-track--static', isStatic);
    track.innerHTML = useMarquee ? items + items : items;
    track.style.setProperty(
      '--about-marquee-duration',
      useMarquee ? Math.max(60, Math.round(list.length * 3.8)) + 's' : ''
    );

    if (marquee) {
      marquee.classList.toggle('about-founding-marquee--scrollable', isScrollable);
      marquee.scrollLeft = 0;
      marquee.setAttribute('tabindex', '-1');
    }
  }

  function loadFoundingOrganisers() {
    var section = document.getElementById('about-founding');
    var track = document.getElementById('about-founding-logos');
    if (!section || !track) return;

    fetch('/api/founding-organisers?for=gateway')
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var list = data && data.ok && Array.isArray(data.organisers) ? data.organisers : [];
        renderFoundingOrganisers(list);
      })
      .catch(function () {
        renderFoundingOrganisers([]);
      });
  }

  function trackBannerLanding() {
    try {
      var params = new URLSearchParams(window.location.search);
      var source = String(params.get('utm_source') || '').trim();
      var campaign = String(params.get('utm_campaign') || '').trim();
      if (!source && !campaign) return;
      if (!window.HubAnalytics || typeof window.HubAnalytics.track !== 'function') return;
      // Vercel custom events allow at most 2 data keys
      window.HubAnalytics.track('soft_launch_peek', {
        source: source || 'unknown',
        campaign: campaign || 'unknown',
      });
    } catch (err) {
      /* analytics optional */
    }
  }

  function boot() {
    initReveal();
    loadFoundingOrganisers();
    trackBannerLanding();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('hashchange', scrollToUpdatesIfNeeded);
})();
