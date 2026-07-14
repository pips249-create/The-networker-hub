/**
 * Gentle word rotation for "Find your next …" hero lines.
 */
(function () {
  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function rotate(el, words, intervalMs) {
    if (!el || !words || !words.length) return;

    el.textContent = words[0];
    if (words.length === 1) return;

    if (prefersReducedMotion()) {
      el.textContent = words.join(', ');
      return;
    }

    var index = 0;
    window.setInterval(function () {
      index = (index + 1) % words.length;
      el.classList.add('is-fading');
      window.setTimeout(function () {
        el.textContent = words[index];
        el.classList.remove('is-fading');
      }, 180);
    }, intervalMs || 2800);
  }

  window.HubFindYourNextRotate = rotate;
})();
