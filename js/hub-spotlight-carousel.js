/**
 * Premium Spotlight carousel helpers — loop only when cards overflow the viewport.
 */
(function (global) {
  function measureCardsWidth(track, cardSelector, count) {
    if (!track) return 0;
    var cards = track.querySelectorAll(cardSelector);
    if (!cards.length) return 0;

    var gap = parseFloat(getComputedStyle(track).gap) || 14;
    var width = 0;
    var n = Math.min(count, cards.length);

    for (var i = 0; i < n; i++) {
      width += cards[i].getBoundingClientRect().width;
      if (i < n - 1) width += gap;
    }

    return width;
  }

  function cardsOverflowViewport(track, itemCount, cardSelector) {
    if (!track || itemCount <= 1) return false;
    var contentWidth = measureCardsWidth(track, cardSelector, itemCount);
    return contentWidth > track.clientWidth + 2;
  }

  function isLooping(track) {
    return !!(track && track.dataset.spotlightLoop === '1');
  }

  function canAutoAdvance(track, itemCount) {
    if (itemCount <= 1 || !track) return false;
    return track.dataset.spotlightOverflow === '1';
  }

  function setNavArrowsVisible(section, visible) {
    if (!section) return;
    section.querySelectorAll('.spotlight-nav button').forEach(function (btn) {
      btn.hidden = !visible;
    });
  }

  function applyLoopLayout(track, section, itemCount, cardSelector, cardsHtml) {
    if (!track) return { overflow: false, looping: false };

    var overflow = cardsOverflowViewport(track, itemCount, cardSelector);
    var looping = overflow && itemCount > 1;

    track.dataset.spotlightLoop = looping ? '1' : '0';
    track.dataset.spotlightOverflow = overflow ? '1' : '0';

    var desiredHtml = looping ? cardsHtml + cardsHtml : cardsHtml;
    if (track.innerHTML !== desiredHtml) {
      track.innerHTML = desiredHtml;
    }
    if (!looping) track.scrollLeft = 0;

    setNavArrowsVisible(section, overflow && itemCount > 1);

    return { overflow: overflow, looping: looping };
  }

  function measureLoopWidth(track, itemCount, cardSelector) {
    if (!track || !isLooping(track) || itemCount <= 1) return 0;
    return measureCardsWidth(track, cardSelector, itemCount);
  }

  function syncLoopScroll(track, loopWidth) {
    if (!track || !loopWidth) return;
    track.dataset.loopWidth = String(loopWidth);
    if (track.scrollLeft >= loopWidth) {
      track.scrollLeft = track.scrollLeft - loopWidth;
    }
  }

  function advanceNonLoop(track, dir, step, behavior) {
    var maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    if (dir > 0 && track.scrollLeft >= maxScroll - 4) {
      track.scrollTo({ left: 0, behavior: behavior });
    } else if (dir < 0 && track.scrollLeft <= 4) {
      track.scrollTo({ left: maxScroll, behavior: behavior });
    } else {
      track.scrollBy({ left: step, behavior: behavior });
    }
  }

  global.HubSpotlightCarousel = {
    applyLoopLayout: applyLoopLayout,
    canAutoAdvance: canAutoAdvance,
    cardsOverflowViewport: cardsOverflowViewport,
    isLooping: isLooping,
    measureLoopWidth: measureLoopWidth,
    syncLoopScroll: syncLoopScroll,
    advanceNonLoop: advanceNonLoop,
    setNavArrowsVisible: setNavArrowsVisible,
  };
})(window);
