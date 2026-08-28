(function () {
  var HOOK_MS = 3200;
  var TAB_STEP = 1400;
  var TABS = ['all', 'franchise', 'side-hustle', 'partnership'];
  var CAPTIONS = {
    all: 'All opportunities · filter by type & budget',
    franchise: 'Franchise · UK territories & proven models',
    'side-hustle': 'Side hustle · part-time & low investment',
    partnership: 'Partnership · referral & affiliate deals'
  };
  var BROWSE_MS = TAB_STEP * TABS.length;
  var BENEFIT_STEP = 900;
  var BENEFIT_COUNT = 4;
  var BENEFITS_MS = BENEFIT_STEP * BENEFIT_COUNT + 300;
  var CLOSE_MS = 4200;
  var TOTAL = HOOK_MS + BROWSE_MS + BENEFITS_MS + CLOSE_MS;

  var scenes = Array.prototype.slice.call(document.querySelectorAll('.scene'));
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  var benefits = Array.prototype.slice.call(document.querySelectorAll('.benefit'));
  var caption = document.getElementById('browse-caption');
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
      el.classList.remove('is-in', 'is-out');
      if (idx === i) el.classList.add('is-in', 'was-shown');
      else if (el.classList.contains('was-shown')) el.classList.add('is-out');
    });
  }

  function setTab(tabId, cardIdx) {
    tabs.forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-tab') === tabId);
    });
    cards.forEach(function (el, idx) {
      el.classList.toggle('is-visible', idx === cardIdx);
    });
    caption.textContent = CAPTIONS[tabId] || '';
  }

  function setBenefit(liveIdx) {
    benefits.forEach(function (el, idx) {
      el.classList.toggle('is-live', idx <= liveIdx);
    });
  }

  function tickProgress() {
    var elapsed = Date.now() - startAt;
    progress.style.width = Math.min(100, (elapsed / TOTAL) * 100) + '%';
    if (elapsed < TOTAL) raf = requestAnimationFrame(tickProgress);
  }

  function play() {
    clearTimers();
    scenes.forEach(function (el) { el.classList.remove('is-in', 'is-out', 'was-shown'); });
    benefits.forEach(function (el) { el.classList.remove('is-live'); });
    cards.forEach(function (el) { el.classList.remove('is-visible'); });
    progress.style.width = '0%';
    startAt = Date.now();
    tickProgress();

    var t = 0;
    schedule(function () { setScene(0); }, t);
    t += HOOK_MS;

    schedule(function () {
      setScene(1);
      setTab(TABS[0], 0);
    }, t);
    TABS.forEach(function (id, i) {
      if (i === 0) return;
      schedule(function () { setTab(id, i); }, t + TAB_STEP * i);
    });
    t += BROWSE_MS;

    schedule(function () {
      setScene(2);
      setBenefit(0);
    }, t);
    for (var i = 1; i < BENEFIT_COUNT; i++) {
      (function (idx) {
        schedule(function () { setBenefit(idx); }, t + BENEFIT_STEP * idx);
      })(i);
    }
    t += BENEFITS_MS;

    schedule(function () { setScene(3); }, t);

    if (!exportMode) schedule(play, TOTAL + 500);
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
