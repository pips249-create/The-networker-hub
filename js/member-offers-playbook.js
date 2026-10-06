/**
 * Member Zone offers playbook carousel (LinkedIn-style multi-slide guide).
 */
(function () {
  var root = null;
  var index = 0;
  var slides = [];
  var reduceMotion = false;

  function $(sel, el) {
    return (el || document).querySelector(sel);
  }

  function setVisible(show) {
    if (!root) return;
    root.hidden = !show;
  }

  function updateChrome() {
    if (!root || !slides.length) return;
    var label = $('.mz-pager-label', root);
    var dots = root.querySelectorAll('.mz-pager-dot');
    var prev = $('.mz-nav-prev', root);
    var next = $('.mz-nav-next', root);
    if (label) label.textContent = index + 1 + ' / ' + slides.length;
    dots.forEach(function (dot, i) {
      dot.classList.toggle('is-active', i === index);
      dot.setAttribute('aria-current', i === index ? 'true' : 'false');
    });
    if (prev) prev.disabled = index <= 0;
    if (next) next.disabled = index >= slides.length - 1;
  }

  function goTo(nextIndex) {
    if (!slides.length) return;
    var target = Math.max(0, Math.min(slides.length - 1, nextIndex));
    if (target === index) {
      updateChrome();
      return;
    }
    var prev = slides[index];
    var next = slides[target];
    if (prev) {
      prev.classList.remove('is-active');
      prev.setAttribute('aria-hidden', 'true');
      if (!reduceMotion && target < index) prev.classList.add('is-exit-left');
      window.setTimeout(function () {
        prev.classList.remove('is-exit-left');
      }, 450);
    }
    if (next) {
      next.classList.add('is-active');
      next.setAttribute('aria-hidden', 'false');
    }
    index = target;
    updateChrome();
    if (root) {
      root.dispatchEvent(
        new CustomEvent('mz-playbook-change', { detail: { index: index, total: slides.length } })
      );
    }
  }

  function onBrowse() {
    var grid = document.getElementById('ad-services-grid');
    if (grid) grid.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  function onPitch() {
    var openBtn = document.getElementById('ad-services-pitch-open');
    var pitchBox = document.getElementById('ad-services-pitch');
    if (pitchBox) pitchBox.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    if (openBtn) openBtn.click();
  }

  function bind() {
    if (!root || root.dataset.bound === '1') return;
    root.dataset.bound = '1';

    var prevBtn = $('.mz-nav-prev', root);
    var nextBtn = $('.mz-nav-next', root);
    if (prevBtn) {
      prevBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        goTo(index - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        goTo(index + 1);
      });
    }
    root.querySelectorAll('.mz-pager-dot').forEach(function (dot) {
      dot.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var i = Number(dot.getAttribute('data-mz-dot'));
        if (!Number.isNaN(i)) goTo(i);
      });
    });
    root.querySelectorAll('[data-mz-browse-offers]').forEach(function (btn) {
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        onBrowse();
      });
    });
    root.querySelectorAll('[data-mz-open-pitch]').forEach(function (btn) {
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        onPitch();
      });
    });

    root.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(index + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(index - 1);
      }
    });
  }

  function mount(el) {
    root = el || document.getElementById('mz-playbook');
    if (!root) return false;
    reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    slides = Array.prototype.slice.call(root.querySelectorAll('.mz-slide'));
    index = 0;
    slides.forEach(function (slide, i) {
      slide.classList.toggle('is-active', i === 0);
      slide.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
    });
    bind();
    updateChrome();
    return true;
  }

  function init(options) {
    var el = options && options.root ? options.root : document.getElementById('mz-playbook');
    mount(el);
  }

  window.HubMemberOffersPlaybook = {
    init: init,
    mount: mount,
    setVisible: setVisible,
    goTo: goTo,
    index: function () {
      return index;
    },
  };
})();
