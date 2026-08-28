(function () {
  var printBtn = document.getElementById('pitch-print-btn');
  if (printBtn) {
    printBtn.addEventListener('click', function () {
      window.print();
    });
  }

  var nav = document.getElementById('pitch-section-nav');
  if (!nav) return;
  var buttons = nav.querySelectorAll('[data-pitch-section]');
  function setActive(id) {
    buttons.forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-pitch-section') === id);
    });
  }
  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-pitch-section');
      var el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActive(id);
    });
  });
  var sections = ['overview', 'proposal', 'options', 'how', 'agreement', 'next'];
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }
})();
