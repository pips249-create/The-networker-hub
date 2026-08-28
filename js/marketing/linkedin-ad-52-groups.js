const TARGET = 52;
  // Faster: ~2.2s roll, short hold — total ~6.5s
  const DURATION_MS = 6500;
  window.__adDurationMs = DURATION_MS;

  const logo = document.getElementById('logo');
  const countEl = document.getElementById('count');
  const label = document.getElementById('label');
  const sub = document.getElementById('sub');
  const url = document.getElementById('url');

  let playing = false;
  let raf = 0;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function valueAt(t) {
    // Tiny beat on 0, then fast roll, land by ~40% of total
    if (t < 0.04) return 0;
    if (t > 0.38) return TARGET;
    const u = (t - 0.04) / 0.34;
    return Math.round(TARGET * easeOutCubic(u));
  }

  function reset() {
    cancelAnimationFrame(raf);
    playing = false;
    countEl.textContent = '0';
    countEl.classList.remove('is-in', 'is-land');
    label.classList.remove('is-in');
    sub.classList.remove('is-in');
    url.classList.remove('is-in');
    logo.classList.remove('is-in');
  }

  function play() {
    if (playing) return;
    reset();
    playing = true;
    const start = performance.now();
    let landed = false;
    let lastShown = -1;

    logo.classList.add('is-in');
    countEl.classList.add('is-in');

    function frame(now) {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const n = valueAt(t);
      if (n !== lastShown) {
        countEl.textContent = String(n);
        lastShown = n;
      }

      if (!landed && n >= TARGET && t >= 0.35) {
        landed = true;
        countEl.classList.add('is-land');
        label.classList.add('is-in');
        setTimeout(() => sub.classList.add('is-in'), 120);
        setTimeout(() => url.classList.add('is-in'), 260);
      }

      if (t < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        playing = false;
      }
    }

    raf = requestAnimationFrame(frame);
  }

  window.__playAd = play;
  window.__resetAd = reset;

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      play();
    }
  });
