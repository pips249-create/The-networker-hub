/** Step deck + walkthrough video for /guides/connect-eventbrite */
(function () {
  var root = document.getElementById('ceb-deck');
  if (!root) return;

  var slides = Array.prototype.slice.call(root.querySelectorAll('[data-ceb-slide]'));
  var dotsWrap = document.getElementById('ceb-dots');
  var counter = document.getElementById('ceb-counter');
  var prevBtn = document.getElementById('ceb-prev');
  var nextBtn = document.getElementById('ceb-next');
  var video = document.getElementById('ceb-walkthrough-video');
  var chapters = Array.prototype.slice.call(root.querySelectorAll('[data-ceb-chapter]'));
  var idx = 0;
  var activeChapter = 0;

  function setActiveChapter(i) {
    activeChapter = i;
    chapters.forEach(function (btn, n) {
      var on = n === i;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-current', on ? 'true' : 'false');
    });
  }

  function seekChapter(btn, play) {
    if (!video || !btn) return;
    var start = parseFloat(btn.getAttribute('data-start') || '0') || 0;
    var i = chapters.indexOf(btn);
    if (i < 0) i = 0;
    setActiveChapter(i);
    var go = function () {
      try {
        video.currentTime = start;
      } catch (e) {
        /* ignore */
      }
      if (play) {
        var p = video.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      }
    };
    if (video.readyState >= 1) go();
    else video.addEventListener('loadedmetadata', go, { once: true });
  }

  if (chapters.length && video) {
    chapters.forEach(function (btn) {
      btn.addEventListener('click', function () {
        seekChapter(btn, true);
      });
    });
    video.addEventListener('timeupdate', function () {
      if (!chapters.length) return;
      var t = video.currentTime || 0;
      var current = 0;
      for (var i = 0; i < chapters.length; i++) {
        var start = parseFloat(chapters[i].getAttribute('data-start') || '0') || 0;
        if (t + 0.2 >= start) current = i;
      }
      if (current !== activeChapter) setActiveChapter(current);
    });
    setActiveChapter(0);
  }

  if (!slides.length) return;

  if (dotsWrap) {
    dotsWrap.innerHTML = slides
      .map(function (_, i) {
        return (
          '<button type="button" data-ceb-dot="' +
          i +
          '" aria-label="Go to step ' +
          (i + 1) +
          '"></button>'
        );
      })
      .join('');
  }

  function render() {
    slides.forEach(function (slide, i) {
      var on = i === idx;
      slide.classList.toggle('is-active', on);
      slide.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    if (dotsWrap) {
      dotsWrap.querySelectorAll('[data-ceb-dot]').forEach(function (dot, i) {
        dot.classList.toggle('is-active', i === idx);
        dot.setAttribute('aria-current', i === idx ? 'step' : 'false');
      });
    }
    if (counter) counter.textContent = idx + 1 + ' / ' + slides.length;
    if (prevBtn) prevBtn.disabled = idx === 0;
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.textContent = idx === slides.length - 1 ? 'Done' : 'Next →';
    }
  }

  function go(n) {
    idx = Math.max(0, Math.min(slides.length - 1, n));
    render();
    try {
      root.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {
      /* ignore */
    }
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      go(idx - 1);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      if (idx >= slides.length - 1) {
        var end = document.getElementById('ceb-trouble');
        if (end) {
          try {
            end.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } catch (e) {
            /* ignore */
          }
        }
        return;
      }
      go(idx + 1);
    });
  }
  if (dotsWrap) {
    dotsWrap.addEventListener('click', function (e) {
      var dot = e.target.closest('[data-ceb-dot]');
      if (!dot) return;
      go(parseInt(dot.getAttribute('data-ceb-dot'), 10) || 0);
    });
  }

  document.addEventListener('keydown', function (e) {
    if (!root.contains(document.activeElement) && document.activeElement !== document.body) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(idx + 1);
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(idx - 1);
    }
  });

  var startHash = (location.hash || '').replace(/^#/, '');
  if (startHash) {
    var match = slides.findIndex(function (slide) {
      return slide.id === startHash;
    });
    if (match >= 0) idx = match;
  }

  render();
})();
