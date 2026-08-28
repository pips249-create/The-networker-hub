(function () {
  var HOOK_MS = 3200;
  var BENEFIT_STEP = 1700;
  var BENEFIT_COUNT = 5;
  var BENEFITS_MS = BENEFIT_STEP * BENEFIT_COUNT;
  var CLOSE_MS = 5200;
  var TOTAL = HOOK_MS + BENEFITS_MS + CLOSE_MS;

  var scenes = Array.prototype.slice.call(document.querySelectorAll('.scene'));
  var benefits = Array.prototype.slice.call(document.querySelectorAll('.benefit-card'));
  var benefitIndex = document.getElementById('benefit-index');
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

  function setBenefit(liveIdx) {
    benefits.forEach(function (el, idx) {
      el.classList.toggle('is-live', idx === liveIdx);
    });
    benefitIndex.textContent = (liveIdx + 1) + ' / ' + BENEFIT_COUNT;
  }

  function tickProgress() {
    var elapsed = Date.now() - startAt;
    progress.style.width = Math.min(100, (elapsed / TOTAL) * 100) + '%';
    if (elapsed < TOTAL) raf = requestAnimationFrame(tickProgress);
  }

  function play() {
    clearTimers();
    scenes.forEach(function (el) { el.classList.remove('is-in'); });
    setBenefit(0);
    progress.style.width = '0%';
    startAt = Date.now();
    tickProgress();

    var t = 0;
    schedule(function () { setScene(0); }, t);
    t += HOOK_MS;

    schedule(function () {
      setScene(1);
      setBenefit(0);
    }, t);
    for (var i = 1; i < BENEFIT_COUNT; i++) {
      (function (idx) {
        schedule(function () { setBenefit(idx); }, t + BENEFIT_STEP * idx);
      })(i);
    }
    t += BENEFITS_MS;

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
