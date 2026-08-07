/**
 * Premium Spotlight carousel helpers — infinite loop when there are multiple cards.
 */
(function (global) {
  var loopScrollHandlers = new WeakMap();

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

  function preferSimpleScroll() {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(hover: none), (max-width: 768px)').matches
    );
  }

  function contentKeyFor(cardsHtml, itemCount, looping) {
    return String(itemCount || 0) + ':' + (looping ? '1' : '0') + ':' + String(cardsHtml || '').length;
  }

  /**
   * Update overflow / nav / loop metrics without rewriting card HTML.
   * Used on resize so mobile address-bar chrome does not flicker the carousel.
   */
  function remeasureLayout(track, section, itemCount, cardSelector) {
    if (!track || !itemCount) return { overflow: false, looping: false };

    var looping = isLooping(track) && !preferSimpleScroll() && itemCount > 1;
    if (preferSimpleScroll() && isLooping(track)) {
      /* Viewport crossed into mobile — drop loop clones if present by caller rebuild. */
      looping = false;
    }

    track.dataset.spotlightLoop = looping ? '1' : '0';

    var overflow = cardsOverflowViewport(track, itemCount, cardSelector);
    track.dataset.spotlightOverflow = overflow ? '1' : '0';

    if (!looping) {
      unbindLoopScrollSync(track);
      track.removeAttribute('data-loop-width');
    } else {
      bindLoopScrollSync(track, itemCount, cardSelector);
      updateLoopScrollBinding(track, itemCount, cardSelector);
      var loopWidth = measureLoopWidth(track, itemCount, cardSelector);
      if (loopWidth > 0) track.dataset.loopWidth = String(loopWidth);
    }

    setNavArrowsVisible(section, overflow && itemCount > 1);
    return { overflow: overflow, looping: looping };
  }

  function applyLoopLayout(track, section, itemCount, cardSelector, cardsHtml) {
    if (!track) return { overflow: false, looping: false };

    /* Infinite HTML doubling causes flicker on phones — use simple snap scroll instead */
    var looping = itemCount > 1 && !preferSimpleScroll();
    var desiredHtml = looping ? cardsHtml + cardsHtml : cardsHtml || '';
    var nextKey = contentKeyFor(desiredHtml, itemCount, looping);
    var htmlChanged = track.dataset.spotlightContentKey !== nextKey;

    /* Never compare track.innerHTML to a source string — browsers normalise markup
       and that false mismatch rewrites the track (double paint / flicker). */
    if (htmlChanged) {
      track.innerHTML = desiredHtml;
      track.dataset.spotlightContentKey = nextKey;
    }

    track.dataset.spotlightLoop = looping ? '1' : '0';

    var overflow = cardsOverflowViewport(track, itemCount, cardSelector);
    track.dataset.spotlightOverflow = overflow ? '1' : '0';

    if (!looping) {
      unbindLoopScrollSync(track);
      if (htmlChanged) track.scrollLeft = 0;
      track.removeAttribute('data-loop-width');
    } else {
      bindLoopScrollSync(track, itemCount, cardSelector);
      updateLoopScrollBinding(track, itemCount, cardSelector);
      var loopWidth = measureLoopWidth(track, itemCount, cardSelector);
      if (loopWidth > 0) track.dataset.loopWidth = String(loopWidth);
      if (htmlChanged) {
        syncLoopScroll(track, loopWidth, itemCount, cardSelector);
      }
    }

    setNavArrowsVisible(section, overflow && itemCount > 1);

    return { overflow: overflow, looping: looping, htmlChanged: htmlChanged };
  }

  function measureLoopWidth(track, itemCount, cardSelector) {
    if (!track || !isLooping(track) || itemCount <= 1) return 0;
    return measureCardsWidth(track, cardSelector, itemCount);
  }

  function resolveLoopWidth(track, loopWidth, itemCount, cardSelector) {
    if (loopWidth > 0) return loopWidth;
    if (!track || !isLooping(track)) return 0;
    if (itemCount && cardSelector) {
      return measureLoopWidth(track, itemCount, cardSelector);
    }
    return track.scrollWidth > 0 ? track.scrollWidth / 2 : 0;
  }

  function syncLoopScroll(track, loopWidth, itemCount, cardSelector) {
    if (!track || !isLooping(track)) return;
    loopWidth = resolveLoopWidth(track, loopWidth, itemCount, cardSelector);
    if (!loopWidth) return;
    track.dataset.loopWidth = String(loopWidth);
    if (track.scrollLeft >= loopWidth - 1) {
      track.scrollLeft = track.scrollLeft - loopWidth;
    }
  }

  function bindLoopScrollSync(track, itemCount, cardSelector) {
    if (!track || loopScrollHandlers.has(track)) return;
    var state = { itemCount: itemCount, cardSelector: cardSelector };
    var handler = function () {
      if (!isLooping(track)) return;
      var loopWidth = parseFloat(track.dataset.loopWidth) || 0;
      syncLoopScroll(track, loopWidth, state.itemCount, state.cardSelector);
    };
    track.addEventListener('scroll', handler, { passive: true });
    loopScrollHandlers.set(track, { handler: handler, state: state });
  }

  function updateLoopScrollBinding(track, itemCount, cardSelector) {
    var bound = loopScrollHandlers.get(track);
    if (bound) {
      bound.state.itemCount = itemCount;
      bound.state.cardSelector = cardSelector;
    }
  }

  function unbindLoopScrollSync(track) {
    var bound = loopScrollHandlers.get(track);
    if (!bound || !track) return;
    track.removeEventListener('scroll', bound.handler);
    loopScrollHandlers.delete(track);
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

  function advanceLoop(track, dir, step, behavior, loopWidth, itemCount, cardSelector) {
    loopWidth = resolveLoopWidth(track, loopWidth, itemCount, cardSelector);
    if (!loopWidth) return false;

    if (dir < 0 && track.scrollLeft <= 4) {
      track.scrollLeft = loopWidth;
    } else if (dir > 0 && track.scrollLeft >= loopWidth - 1) {
      track.scrollLeft = track.scrollLeft - loopWidth;
    }

    track.scrollBy({ left: step, behavior: behavior });
    syncLoopScroll(track, loopWidth, itemCount, cardSelector);
    return true;
  }

  function clearTrack(track) {
    if (!track) return;
    track.innerHTML = '';
    track.removeAttribute('data-spotlight-content-key');
    track.removeAttribute('data-loop-width');
    track.dataset.spotlightLoop = '0';
    track.dataset.spotlightOverflow = '0';
    unbindLoopScrollSync(track);
  }

  global.HubSpotlightCarousel = {
    applyLoopLayout: applyLoopLayout,
    remeasureLayout: remeasureLayout,
    clearTrack: clearTrack,
    advanceLoop: advanceLoop,
    canAutoAdvance: canAutoAdvance,
    cardsOverflowViewport: cardsOverflowViewport,
    isLooping: isLooping,
    measureLoopWidth: measureLoopWidth,
    syncLoopScroll: syncLoopScroll,
    advanceNonLoop: advanceNonLoop,
    setNavArrowsVisible: setNavArrowsVisible,
  };
})(window);
