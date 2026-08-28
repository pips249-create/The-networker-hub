(function () {
  var BEAT0 = 3200;
  var BEAT1 = 3200;
  var CLOSE = 5600;
  var TOTAL = BEAT0 + BEAT1 + CLOSE;

  var scenes = Array.prototype.slice.call(document.querySelectorAll('.scene'));
  var progress = document.getElementById('progress');
  var timers = [];
  var startAt = 0;
  var raf = null;
  var exportMode = new URLSearchParams(window.location.search).get('export') === '1';

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
    if (raf) cancelAnimationFrame(raf);
  }
  function schedule(fn, ms) { timers.push(setTimeout(fn, ms)); }

  function setScene(i) {
    scenes.forEach(function (el, idx) {
      el.classList.toggle('is-in', idx === i);
    });
  }

  function tickProgress() {
    var elapsed = Date.now() - startAt;
    progress.style.width = Math.min(100, (elapsed / TOTAL) * 100) + '%';
    if (elapsed < TOTAL) raf = requestAnimationFrame(tickProgress);
  }

  function play() {
    clearTimers();
    scenes.forEach(function (el) { el.classList.remove('is-in'); });
    progress.style.width = '0%';
    startAt = Date.now();
    tickProgress();

    var t = 0;
    schedule(function () { setScene(0); }, t);
    t += BEAT0;
    schedule(function () { setScene(1); }, t);
    t += BEAT1;
    schedule(function () { setScene(2); }, t);

    if (!exportMode) schedule(play, TOTAL + 600);
  }

  window.__adDurationMs = TOTAL;
  if (!exportMode) play();

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space') { e.preventDefault(); play(); }
    if (e.key === 'r' || e.key === 'R') {
      document.getElementById('rec-hint').classList.add('is-hidden');
    }
  });
})();
