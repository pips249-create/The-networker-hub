/**
 * Inject landmark icons into homepage location chips from HUB_NETWORKING_REGION_THEMES.
 */
(function () {
  function initHomeLocationChips() {
    var themes = window.HUB_NETWORKING_REGION_THEMES || {};
    document.querySelectorAll('.home-location-chip[data-region]').forEach(function (chip) {
      var slug = chip.getAttribute('data-region');
      var theme = themes[slug];
      if (!theme || !theme.landmarkChip) return;

      var icon = chip.querySelector('.home-location-chip-icon');
      if (!icon) return;

      icon.classList.remove('home-location-chip-icon--mark');
      icon.innerHTML = theme.landmarkChip;
      if (theme.landmarkLabel) {
        icon.setAttribute('title', theme.landmarkLabel);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomeLocationChips);
  } else {
    initHomeLocationChips();
  }
})();
