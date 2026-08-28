(function () {
  var buttons = document.querySelectorAll('[data-show]');
  var sheets = document.querySelectorAll('.sheet');
  var printBtn = document.getElementById('print-btn');
  var downloadBtn = document.getElementById('download-btn');
  var current = 'all';

  function show(who) {
    current = who;
    buttons.forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-show') === who);
    });
    sheets.forEach(function (sheet) {
      var match = who === 'all' || sheet.getAttribute('data-person') === who;
      sheet.hidden = !match;
      sheet.classList.toggle('is-print-target', match && who !== 'all');
    });
    document.body.classList.toggle('print-one', who !== 'all');
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var who = btn.getAttribute('data-show');
      show(who);
      if (who === 'all') {
        if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      } else {
        history.replaceState(null, '', '#' + who);
      }
    });
  });

  printBtn.addEventListener('click', function () {
    window.print();
  });

  function loadHtml2Pdf() {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-hub-html2pdf]');
      if (existing) {
        existing.addEventListener('load', function () {
          if (window.html2pdf) resolve(window.html2pdf);
          else reject(new Error('PDF library failed to load.'));
        });
        existing.addEventListener('error', function () {
          reject(new Error('PDF library failed to load.'));
        });
        return;
      }
      var script = document.createElement('script');
      script.src = 'https://unpkg.com/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';
      script.async = true;
      script.setAttribute('data-hub-html2pdf', '1');
      script.onload = function () {
        if (window.html2pdf) resolve(window.html2pdf);
        else reject(new Error('PDF library failed to load.'));
      };
      script.onerror = function () {
        reject(new Error('PDF library failed to load.'));
      };
      document.head.appendChild(script);
    });
  }

  function pdfFilename() {
    if (current === 'all') return 'organiser-overview-pack.pdf';
    return current + '-organiser-overview.pdf';
  }

  downloadBtn.addEventListener('click', function () {
    var label = downloadBtn.textContent;
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Preparing…';

    var restore = [];
    sheets.forEach(function (sheet) {
      restore.push({ sheet: sheet, hidden: sheet.hidden });
      var keep = current === 'all' || sheet.getAttribute('data-person') === current;
      sheet.hidden = !keep;
    });

    var source = current === 'all'
      ? document.querySelector('.sheet-stack')
      : document.querySelector('.sheet[data-person="' + current + '"]');

    loadHtml2Pdf()
      .then(function (html2pdf) {
        return html2pdf()
          .set({
            margin: 0,
            filename: pdfFilename(),
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff'
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'], after: '.sheet' }
          })
          .from(source)
          .save();
      })
      .catch(function () {
        window.alert('Could not prepare the PDF. Try Print → Save as PDF instead.');
      })
      .then(function () {
        restore.forEach(function (item) {
          item.sheet.hidden = item.hidden;
        });
        downloadBtn.disabled = false;
        downloadBtn.textContent = label;
      });
  });

  var hash = (location.hash || '').replace(/^#/, '').toLowerCase();
  if (hash === 'catherine' || hash === 'rosie' || hash === 'jamie') {
    show(hash);
  } else {
    show('all');
  }

  window.addEventListener('hashchange', function () {
    var next = (location.hash || '').replace(/^#/, '').toLowerCase();
    if (next === 'catherine' || next === 'rosie' || next === 'jamie') show(next);
    else if (!next) show('all');
  });
})();
