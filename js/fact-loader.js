/**
 * FactLoader — lazy loading overlay with hub facts (shows only after 800ms).
 *
 * Usage:
 *   await FactLoader.run(() => fetch('/api/events').then(r => r.json()));
 *
 * Manual session:
 *   const session = FactLoader.begin();
 *   try { await doWork(); } finally { await session.end(); }
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined') {
    global.FactLoader = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function FactLoaderFactory() {
  const LAZY_DELAY_MS = 800;
  const MIN_VISIBLE_MS = 1200;
  const FADE_MS = 350;

  const networkingFacts = [
    {
      text: 'The Networker Hub is a UK directory for networking meetings, exhibitions, conferences, and business opportunities.',
    },
    {
      text: 'HubSpot research found that 85% of jobs are filled through personal and professional networks — not online applications alone.',
    },
    {
      text: 'Every business host on the hub is reviewed before they can list, to keep events focused on genuine networking.',
    },
    {
      text: 'You can browse live listings and filter by format, industry, date, and location — no account required.',
    },
    {
      text: 'Organiser reviews on the hub reflect real attendee feedback, so you can compare hosts before you book.',
    },
    {
      text: 'Save events to your favourites and return when you are ready to register.',
    },
    {
      text: 'UK business networking spans breakfast clubs, chamber events, sector meetups, and exhibitions.',
    },
    {
      text: 'Listings are managed by verified organisers — dates, venues, and prices on each event page are kept up to date.',
    },
    {
      text: 'LinkedIn\u2019s global talent research shows that most hiring still starts with referrals and warm introductions.',
    },
  ];

  let overlayEl = null;
  let activeSessions = 0;

  function pickRandomFact() {
    return networkingFacts[Math.floor(Math.random() * networkingFacts.length)];
  }

  function ensureOverlay() {
    if (overlayEl && document.body.contains(overlayEl)) return overlayEl;

    overlayEl = document.createElement('div');
    overlayEl.className = 'fact-loader';
    overlayEl.hidden = true;
    overlayEl.setAttribute('role', 'status');
    overlayEl.setAttribute('aria-live', 'polite');
    overlayEl.setAttribute('aria-busy', 'true');
    overlayEl.innerHTML =
      '<div class="fact-loader__pulse" aria-hidden="true">' +
      '<span class="fact-loader__pulse-bar"></span>' +
      '</div>' +
      '<div class="fact-loader__content">' +
      '<img class="fact-loader__logo" src="/assets/logo-nav.png" alt="The Networker Hub" width="200" height="80" decoding="async">' +
      '<div class="fact-loader__card">' +
      '<span class="fact-loader__label">From the hub</span>' +
      '<p class="fact-loader__fact"></p>' +
      '</div>' +
      '</div>';

    var mount = document.body || document.documentElement;
    mount.appendChild(overlayEl);
    return overlayEl;
  }

  function setFactText(fact) {
    const el = ensureOverlay().querySelector('.fact-loader__fact');
    if (el) el.textContent = fact.text;
  }

  function fadeIn() {
    const el = ensureOverlay();
    el.hidden = false;
    el.classList.remove('is-visible');
    document.body.classList.add('fact-loader-active');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.add('is-visible');
      });
    });
  }

  function fadeOut() {
    return new Promise(function (resolve) {
      if (!overlayEl) {
        resolve();
        return;
      }
      overlayEl.classList.remove('is-visible');
      window.setTimeout(function () {
        if (overlayEl) {
          overlayEl.hidden = true;
        }
        if (activeSessions <= 0) {
          document.body.classList.remove('fact-loader-active');
        }
        resolve();
      }, FADE_MS);
    });
  }

  function createSession() {
    let finished = false;
    let visible = false;
    let shownAt = 0;
    let showTimer = null;

    activeSessions += 1;

    function scheduleShow() {
      showTimer = window.setTimeout(function () {
        if (finished) return;
        visible = true;
        shownAt = Date.now();
        setFactText(pickRandomFact());
        fadeIn();
      }, LAZY_DELAY_MS);
    }

    scheduleShow();

    return {
      end: function endSession() {
        finished = true;
        if (showTimer) {
          window.clearTimeout(showTimer);
          showTimer = null;
        }
        activeSessions = Math.max(0, activeSessions - 1);

        if (!visible) {
          if (activeSessions <= 0) {
            document.body.classList.remove('fact-loader-active');
          }
          return Promise.resolve();
        }

        var visibleFor = Date.now() - shownAt;
        var hold = Math.max(0, MIN_VISIBLE_MS - visibleFor);
        return new Promise(function (resolve) {
          window.setTimeout(function () {
            fadeOut().then(resolve);
          }, hold);
        });
      },
    };
  }

  function run(work) {
    const session = createSession();
    const runWork =
      typeof work === 'function'
        ? Promise.resolve().then(work)
        : Promise.resolve(work);

    return runWork.finally(function () {
      return session.end();
    });
  }

  return {
    LAZY_DELAY_MS: LAZY_DELAY_MS,
    MIN_VISIBLE_MS: MIN_VISIBLE_MS,
    networkingFacts: networkingFacts,
    begin: createSession,
    run: run,
  };
});
