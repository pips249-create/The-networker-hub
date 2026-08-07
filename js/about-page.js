/**
 * About page — scroll reveals + updates anchor.
 */
(function () {
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReveal);
  } else {
    initReveal();
  }

  window.addEventListener('hashchange', scrollToUpdatesIfNeeded);
})();
