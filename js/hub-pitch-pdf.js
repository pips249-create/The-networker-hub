/**
 * html2pdf.js export for confidential /p-tnh-* sales decks (Barnsgate-style).
 */
(function (global) {
  function loadHtml2PdfLibrary() {
    if (global.html2pdf) return Promise.resolve(global.html2pdf);
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-hub-html2pdf]');
      if (existing) {
        existing.addEventListener('load', function () {
          if (global.html2pdf) resolve(global.html2pdf);
          else reject(new Error('html2pdf unavailable'));
        });
        existing.addEventListener('error', function () {
          reject(new Error('html2pdf failed to load'));
        });
        return;
      }
      var sources = [
        '/js/vendor/html2pdf.bundle.min.js',
        'https://unpkg.com/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js',
      ];
      function inject(srcIndex) {
        if (srcIndex >= sources.length) {
          reject(new Error('html2pdf failed to load'));
          return;
        }
        var script = document.createElement('script');
        script.src = sources[srcIndex];
        script.async = true;
        script.setAttribute('data-hub-html2pdf', '1');
        script.onload = function () {
          if (global.html2pdf) resolve(global.html2pdf);
          else {
            script.remove();
            inject(srcIndex + 1);
          }
        };
        script.onerror = function () {
          script.remove();
          inject(srcIndex + 1);
        };
        document.head.appendChild(script);
      }
      inject(0);
    });
  }

  function forceDownloadBlob(blob, filename) {
    var forceBlob =
      blob && blob.type === 'application/octet-stream'
        ? blob
        : new Blob([blob], { type: 'application/octet-stream' });
    var url = URL.createObjectURL(forceBlob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'Networker-UK-pitch.pdf';
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      try {
        URL.revokeObjectURL(url);
      } catch (_e) {
        /* ignore */
      }
    }, 60000);
  }

  function prepareShellImagesForPdf(shell, imageHook) {
    var swaps = [];
    Array.prototype.slice.call(shell.querySelectorAll('img')).forEach(function (img) {
      var src = String(img.getAttribute('src') || img.currentSrc || '');
      if (!src || /^data:|^blob:/i.test(src)) return;
      var replacement = imageHook ? imageHook(img, src) : null;
      if (replacement) {
        swaps.push({ img: img, src: img.getAttribute('src') || src });
        img.setAttribute('src', replacement);
        return;
      }
      var isRemote = /^https?:\/\//i.test(src) && src.indexOf(window.location.origin) !== 0;
      if (!isRemote) return;
      swaps.push({ img: img, src: img.getAttribute('src') || src, crossorigin: img.getAttribute('crossorigin') });
      img.setAttribute('crossorigin', 'anonymous');
    });
    return function restore() {
      swaps.forEach(function (entry) {
        entry.img.setAttribute('src', entry.src);
        if (entry.crossorigin == null) entry.img.removeAttribute('crossorigin');
        else entry.img.setAttribute('crossorigin', entry.crossorigin);
      });
    };
  }

  function waitForImages(shell, timeoutMs) {
    var images = Array.prototype.slice.call(shell.querySelectorAll('img'));
    if (!images.length) return Promise.resolve();
    return Promise.all(
      images.map(function (img) {
        if (img.complete && img.naturalWidth) return Promise.resolve();
        return new Promise(function (resolve) {
          var done = function () {
            resolve();
          };
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          setTimeout(done, timeoutMs || 4000);
        });
      })
    );
  }

  function setButtonsBusy(buttons, busy) {
    buttons.forEach(function (btn) {
      if (!btn) return;
      if (busy && !btn.getAttribute('data-label')) {
        btn.setAttribute('data-label', btn.textContent);
      }
      btn.disabled = !!busy;
      btn.textContent = busy ? 'Preparing PDF…' : btn.getAttribute('data-label') || 'Download PDF';
    });
  }

  function createFixedWidthClone(shell, width) {
    var w = width || 760;
    var host = document.createElement('div');
    host.setAttribute('data-hub-pitch-pdf-clone', '1');
    host.style.cssText =
      'position:fixed;left:0;top:0;width:' +
      w +
      'px;opacity:0.01;pointer-events:none;z-index:2147483646;overflow:visible;background:#fffdf9';
    var clone = shell.cloneNode(true);
    clone.classList.add('hub-pitch-pdf-clone-shell');
    host.appendChild(clone);
    document.body.appendChild(host);
    return {
      target: clone,
      cleanup: function () {
        host.remove();
      },
    };
  }

  function downloadFromShell(options) {
    options = options || {};
    var shell = document.querySelector(options.shellSelector || '.sponsor-pitch-shell');
    if (!shell) {
      window.print();
      return Promise.resolve();
    }

    var filename = options.filename || 'Networker-UK-pitch.pdf';
    var hideSelectors = options.hideSelectors || ['.no-print', '.sponsor-pitch-nav'];
    var buttons = options.buttons || [];
    var cloneMount = null;
    var captureShell = shell;

    setButtonsBusy(buttons, true);
    var hideNodes = [];
    hideSelectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        hideNodes.push(el);
      });
    });
    hideNodes.forEach(function (el) {
      el.setAttribute('data-pdf-was-hidden', el.style.display || '');
      el.style.display = 'none';
    });

    shell.classList.add('hub-pitch-pdf-capture');
    if (options.fixedWidthClone) {
      cloneMount = createFixedWidthClone(shell, options.cloneWidth || 760);
      captureShell = cloneMount.target;
    }

    var restoreImages = prepareShellImagesForPdf(captureShell, options.imageHook);

    return waitForImages(captureShell, options.imageTimeoutMs || 5000)
      .then(function () {
        return loadHtml2PdfLibrary();
      })
      .then(function (html2pdf) {
        var captureWidth = captureShell.scrollWidth || captureShell.offsetWidth || 760;
        var opt = {
          margin: options.margin || [8, 8, 8, 8],
          filename: filename,
          image: { type: 'jpeg', quality: 0.96 },
          html2canvas: {
            scale: options.scale || 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: options.backgroundColor || '#fffdf9',
            logging: false,
            imageTimeout: 8000,
            scrollX: 0,
            scrollY: 0,
            windowWidth: captureWidth,
            width: captureWidth,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: {
            mode: ['css', 'legacy'],
            avoid: options.pagebreakAvoid || [
              '.org-pitch-tile',
              '.pitch-stat',
              '.sponsor-pitch-cta',
              '.org-pitch-hero-showcase',
            ],
          },
        };
        return html2pdf()
          .set(opt)
          .from(captureShell)
          .outputPdf('blob')
          .then(function (blob) {
            if (!blob) throw new Error('empty pdf');
            forceDownloadBlob(blob, filename);
            if (typeof options.onSuccess === 'function') options.onSuccess();
          });
      })
      .catch(function (err) {
        console.error('[hub-pitch-pdf]', err);
        window.alert(
          'Could not download the PDF automatically. Your browser print dialog will open — choose “Save as PDF”.'
        );
        window.print();
      })
      .finally(function () {
        restoreImages();
        if (cloneMount && cloneMount.cleanup) cloneMount.cleanup();
        shell.classList.remove('hub-pitch-pdf-capture');
        hideNodes.forEach(function (el) {
          el.style.display = el.getAttribute('data-pdf-was-hidden') || '';
          el.removeAttribute('data-pdf-was-hidden');
        });
        setButtonsBusy(buttons, false);
      });
  }

  function bindButtons(options) {
    options = options || {};
    var ids = options.buttonIds || ['pitch-download-pdf', 'pitch-download-pdf-cta'];
    var buttons = ids
      .map(function (id) {
        return document.getElementById(id);
      })
      .filter(Boolean);
    if (!buttons.length) return;

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        downloadFromShell({
          filename: options.filename,
          shellSelector: options.shellSelector,
          hideSelectors: options.hideSelectors,
          imageHook: options.imageHook,
          pagebreakAvoid: options.pagebreakAvoid,
          buttons: buttons,
          onSuccess: options.onSuccess,
        });
      });
    });
  }

  global.HubPitchPdf = {
    downloadFromShell: downloadFromShell,
    bindButtons: bindButtons,
    loadHtml2PdfLibrary: loadHtml2PdfLibrary,
  };
})(window);
