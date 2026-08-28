(function () {
  var scenes = [
    document.getElementById('scene-1'),
    document.getElementById('scene-2'),
    document.getElementById('scene-3'),
    document.getElementById('scene-4')
  ];
  // Slightly longer on logo transition + closing email
  var holdMs = [2100, 3200, 2600, 3600];
  var timers = [];
  var hintEl = document.getElementById('rec-hint');
  var params = new URLSearchParams(window.location.search);
  var isExport = params.get('export') === '1';

  if (isExport) hintEl.classList.add('is-hidden');

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function schedule(fn, ms) {
    timers.push(setTimeout(fn, ms));
  }

  function reset() {
    scenes.forEach(function (el) {
      el.classList.remove('is-in', 'is-out');
      el.hidden = true;
    });
  }

  function play() {
    clearTimers();
    reset();

    var t = 80;
    scenes.forEach(function (el, i) {
      schedule(function () {
        if (i > 0) {
          scenes[i - 1].classList.remove('is-in', 'is-out');
          scenes[i - 1].hidden = true;
        }
        el.hidden = false;
        el.classList.remove('is-out');
        el.classList.add('is-in');
      }, t);

      t += holdMs[i];
    });
  }

  // Export mode: start as soon as fonts are ready so the recording has no blank lead-in
  if (isExport) {
    document.fonts.ready.then(function () {
      schedule(play, 120);
    }).catch(function () {
      schedule(play, 120);
    });
  } else {
    play();
  }

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space') {
      e.preventDefault();
      play();
    }
    if (e.key === 'r' || e.key === 'R') hintEl.classList.add('is-hidden');
  });
})();
