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
    var inner;
    if (photo) {
      inner =
        '<img src="' +
        esc(photo) +
        '" alt="' +
        esc(name) +
        '" loading="lazy" decoding="async" class="about-founding-logo" onerror="this.hidden=true;var f=this.nextElementSibling;if(f){f.hidden=false;this.parentElement.classList.add(\'about-founding-item--fallback\')}" />' +
        '<span class="about-founding-initial" hidden aria-hidden="true">' +
        esc(initial) +
        '</span>';
    } else {
      inner =
        '<span class="about-founding-initial" aria-hidden="true">' + esc(initial) + '</span>';
    }
    var fallbackClass = photo ? '' : ' about-founding-item--fallback';
    var title = esc(name);
    if (href) {
      return (
        '<a class="about-founding-item' +
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
    var useMarquee = list.length > 1 && !prefersReducedMotion;
    var isStatic = list.length <= 1;
    var isScrollable = !useMarquee && list.length > 1;

    track.classList.toggle('about-founding-track--marquee', useMarquee);
    track.classList.toggle('about-founding-track--scroll', isScrollable);
    track.classList.toggle('about-founding-track--static', isStatic);
    track.innerHTML = useMarquee ? items + items : items;

    if (marquee) {
      marquee.classList.toggle('about-founding-marquee--scrollable', isScrollable);
      marquee.scrollLeft = 0;
      if (isScrollable) marquee.setAttribute('tabindex', '0');
      else marquee.setAttribute('tabindex', '-1');
    }
  }

  function loadFoundingOrganisers() {
    var section = document.getElementById('about-founding');
    var track = document.getElementById('about-founding-logos');
    if (!section || !track) return;

    fetch('/api/founding-organisers?for=gateway', { cache: 'no-store' })
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
