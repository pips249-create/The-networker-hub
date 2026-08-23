/**
 * Shared “How reviews work” explainer (Airbnb-style sheet).
 * Usage: HubHowReviewsWork.mount(anchorEl) or data-how-reviews-mount on a host.
 */
(function (global) {
  var STYLE_ID = 'how-reviews-work-css';
  var MODAL_ID = 'how-reviews-work-modal';
  var open = false;
  var lastFocus = null;

  function ensureStylesheet() {
    if (document.getElementById(STYLE_ID)) return;
    var link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = '/css/how-reviews-work.css?v=20260728a';
    document.head.appendChild(link);
  }

  function ensureModal() {
    var existing = document.getElementById(MODAL_ID);
    if (existing) return existing;

    var modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'how-reviews-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'how-reviews-work-title');
    modal.hidden = true;
    modal.innerHTML =
      '<div class="how-reviews-backdrop" data-how-reviews-close tabindex="-1"></div>' +
      '<div class="how-reviews-panel">' +
      '<button type="button" class="how-reviews-close" data-how-reviews-close aria-label="Close">×</button>' +
      '<h2 class="how-reviews-title" id="how-reviews-work-title">How reviews work</h2>' +
      '<div class="how-reviews-body">' +
      '<p>Reviews are sorted to surface the most useful feedback first — newer reviews, clearer comments, and ratings from verified bookings tend to appear higher.</p>' +
      '<p>Only guests who booked through The Networker UK and attended can leave a review. Organisers can mark a no-show after the event so that person does not get a review email. Organisers can reply publicly from their dashboard; replies show on their profile.</p>' +
      '<p>We moderate reviews flagged for policy issues. Ranking badges on The Networker UK need a published profile, at least <strong>8 reviews</strong>, and <strong>10+ past-event ticket purchases</strong>. Groups are ranked by average rating, then by review rate (reviews ÷ past-event ticket purchases).</p>' +
      '<p><a class="how-reviews-more" href="/rankings">See this month’s leaderboard →</a></p>' +
      '</div>' +
      '</div>';

    document.body.appendChild(modal);

    modal.addEventListener('click', function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute('data-how-reviews-close') != null) {
        closeModal();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    });

    return modal;
  }

  function openModal() {
    ensureStylesheet();
    var modal = ensureModal();
    lastFocus = document.activeElement;
    modal.hidden = false;
    open = true;
    document.body.classList.add('how-reviews-open');
    var closeBtn = modal.querySelector('.how-reviews-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    var modal = document.getElementById(MODAL_ID);
    if (modal) modal.hidden = true;
    open = false;
    document.body.classList.remove('how-reviews-open');
    if (lastFocus && typeof lastFocus.focus === 'function') {
      try {
        lastFocus.focus();
      } catch (e) {
        /* ignore */
      }
    }
    lastFocus = null;
  }

  function makeTrigger() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'how-reviews-trigger';
    btn.setAttribute('data-how-reviews-open', '');
    btn.textContent = 'How reviews work';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      openModal();
    });
    return btn;
  }

  function mount(anchor) {
    if (!anchor || anchor.getAttribute('data-how-reviews-mounted') === '1') return null;
    ensureStylesheet();
    ensureModal();
    var trigger = makeTrigger();
    anchor.appendChild(trigger);
    anchor.setAttribute('data-how-reviews-mounted', '1');
    return trigger;
  }

  function autoMount() {
    document.querySelectorAll('[data-how-reviews-mount]').forEach(function (el) {
      mount(el);
    });
  }

  global.HubHowReviewsWork = {
    mount: mount,
    open: openModal,
    close: closeModal,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }
})(window);
