(function () {
  var AUDIENCES = {
    attendee: {
      kicker: 'UK business networking platform',
      words: ['Event', 'Connection', 'Community', 'Opportunity'],
      wordsLong: ['Event', 'Connection', 'Community', 'Opportunity', 'Room'],
      tagline: 'Where useful business conversations begin.',
      url: 'thenetworkeruk.com',
      cta: 'Browse events',
      logoDark: '../assets/logo-hub-dark.png',
      logoLight: '../assets/logo-nav-transparent.png?v=20260823uk3'
    },
    organiser: {
      kicker: 'For UK event organisers',
      words: ['Audience', 'Bookings', 'Community', 'Discovery'],
      wordsLong: ['Audience', 'Bookings', 'Community', 'Discovery', 'Growth'],
      tagline: 'List where networkers already browse.',
      url: 'thenetworkeruk.com/for-organisers',
      cta: 'List your event',
      logoDark: '../assets/logo-hub-dark.png',
      logoLight: '../assets/logo-nav-transparent.png?v=20260823uk3'
    }
  };

  var TIMINGS = {
    15: { introDelay: 900, wordMs: 850, closingStart: 5200, total: 15000, loop: false },
    20: { introDelay: 1200, wordMs: 1100, closingStart: 6800, total: 20000, loop: false }
  };

  var params = new URLSearchParams(window.location.search);
  var audienceKey = params.get('audience') === 'organiser' ? 'organiser' : 'attendee';
  var theme = params.get('theme') === 'light' ? 'light' : 'dark';
  var duration = params.get('duration') === '20' ? 20 : 15;

  var audience = AUDIENCES[audienceKey];
  var timing = TIMINGS[duration];
  var words = duration === 15 ? audience.words : audience.wordsLong;

  document.documentElement.classList.toggle('theme-light', theme === 'light');

  var kickerEl = document.getElementById('kicker');
  var headlineEl = document.getElementById('headline');
  var dotsEl = document.getElementById('headline-dots');
  var taglineEl = document.getElementById('tagline');
  var urlEl = document.getElementById('url');
  var ctaEl = document.getElementById('cta');
  var logoEl = document.getElementById('logo');
  var stage = document.getElementById('word-stage');
  var intro = document.getElementById('intro');
  var closing = document.getElementById('closing');
  var hintEl = document.getElementById('rec-hint');

  kickerEl.textContent = audience.kicker;
  taglineEl.textContent = audience.tagline;
  urlEl.textContent = audience.url;
  ctaEl.textContent = audience.cta;
  logoEl.src = theme === 'light' ? audience.logoLight : audience.logoDark;

  hintEl.innerHTML =
    '<strong>' + duration + 's · ' + theme + ' · ' + audienceKey + '</strong><br>' +
    'Record the square at 100% zoom · <kbd>Space</kbd> restart · ' +
    '<kbd>1</kbd>/<kbd>2</kbd> duration · <kbd>L</kbd>/<kbd>D</kbd> theme · ' +
    '<kbd>A</kbd>/<kbd>O</kbd> audience · <kbd>R</kbd> hide';

  var timers = [];
  var wordEls = [];

  words.forEach(function (word, i) {
    var el = document.createElement('span');
    el.className = 'word';
    el.textContent = word;
    el.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
    stage.appendChild(el);
    wordEls.push(el);
  });

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function schedule(fn, ms) {
    timers.push(setTimeout(fn, ms));
  }

  function resetIntro() {
    kickerEl.classList.remove('is-in');
    headlineEl.classList.remove('is-in');
    dotsEl.classList.remove('is-in');
    intro.hidden = false;
    intro.style.opacity = '1';
    intro.style.transition = '';
    closing.classList.remove('is-visible');
    closing.hidden = true;
  }

  function resetWords() {
    wordEls.forEach(function (el) {
      el.className = 'word';
      el.style.animation = 'none';
      el.offsetHeight;
      el.style.animation = '';
    });
  }

  function play() {
    clearTimers();
    resetIntro();
    resetWords();

    schedule(function () { kickerEl.classList.add('is-in'); }, 120);
    schedule(function () { headlineEl.classList.add('is-in'); }, 280);
    schedule(function () { dotsEl.classList.add('is-in'); }, timing.introDelay - 320);

    var t = timing.introDelay;
    words.forEach(function (_, i) {
      schedule(function () {
        wordEls.forEach(function (el, j) {
          el.classList.remove('is-active', 'is-exit');
          el.setAttribute('aria-hidden', j === i ? 'false' : 'true');
        });
        if (i > 0) wordEls[i - 1].classList.add('is-exit');
        wordEls[i].classList.add('is-active');
      }, t);
      t += timing.wordMs;
    });

    schedule(function () {
      intro.style.transition = 'opacity 0.35s ease';
      intro.style.opacity = '0';
    }, timing.closingStart - 180);

    schedule(function () {
      intro.hidden = true;
      closing.hidden = false;
      closing.classList.add('is-visible');
    }, timing.closingStart);

    if (timing.loop) {
      schedule(play, timing.total);
    }
  }

  function navigate(patch) {
    var next = new URLSearchParams(window.location.search);
    Object.keys(patch).forEach(function (key) { next.set(key, patch[key]); });
    window.location.search = next.toString();
  }

  // export=1 waits for Space so screen/video capture can start clean
  if (params.get('export') !== '1') play();

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space') {
      e.preventDefault();
      play();
    }
    if (e.key === 'r' || e.key === 'R') hintEl.classList.add('is-hidden');
    if (e.key === '1') navigate({ duration: '15' });
    if (e.key === '2') navigate({ duration: '20' });
    if (e.key === 'l' || e.key === 'L') navigate({ theme: 'light' });
    if (e.key === 'd' || e.key === 'D') navigate({ theme: 'dark' });
    if (e.key === 'a' || e.key === 'A') navigate({ audience: 'attendee' });
    if (e.key === 'o' || e.key === 'O') navigate({ audience: 'organiser' });
  });
})();
