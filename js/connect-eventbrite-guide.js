/** Step deck for /guides/connect-eventbrite */
(function () {
  var root = document.getElementById('ceb-deck');
  if (!root) return;

  var slides = Array.prototype.slice.call(root.querySelectorAll('[data-ceb-slide]'));
  var dotsWrap = document.getElementById('ceb-dots');
  var counter = document.getElementById('ceb-counter');
  var prevBtn = document.getElementById('ceb-prev');
  var nextBtn = document.getElementById('ceb-next');
  var idx = 0;

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

  /* Old webhook-first deep links still land on the closest OAuth step. */
  var hashAliases = {
    'enable-eventbrite': 'open-my-events',
    'paste-webhook': 'connect-oauth',
    'api-token': 'approve-eventbrite',
    'link-event': 'events-import',
  };

  var startHash = (location.hash || '').replace(/^#/, '');
  if (startHash && hashAliases[startHash]) startHash = hashAliases[startHash];
  if (startHash) {
    var match = slides.findIndex(function (slide) {
      return slide.id === startHash;
    });
    if (match >= 0) idx = match;
  }

  render();
})();
