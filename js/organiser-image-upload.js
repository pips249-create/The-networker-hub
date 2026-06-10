/**
 * File pick + clipboard paste for organiser logo / event photo zones.
 * Flags low-resolution logos before upload.
 */
(function (global) {
  const MAX_BYTES = 2 * 1024 * 1024;
  const MIN_LONG_EDGE = 800;
  const MIN_SHORT_EDGE = 400;

  function logoResolutionWarning(width, height) {
    const w = Number(width) || 0;
    const h = Number(height) || 0;
    if (w <= 0 || h <= 0) return null;
    const longEdge = Math.max(w, h);
    const shortEdge = Math.min(w, h);
    if (longEdge >= MIN_LONG_EDGE && shortEdge >= MIN_SHORT_EDGE) return null;
    return (
      'This logo is ' +
      w +
      '×' +
      h +
      'px and may look blurry on your profile. Please use a higher-resolution image — at least ' +
      MIN_LONG_EDGE +
      'px on the longest side and ' +
      MIN_SHORT_EDGE +
      'px on the shortest.'
    );
  }

  function measureImageFile(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read image dimensions'));
      };
      img.src = url;
    });
  }

  function measureImageUrl(src) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = function () {
        reject(new Error('Could not load image'));
      };
      img.crossOrigin = 'anonymous';
      img.src = src;
    });
  }

  function updateLogoQualityHint(el, width, height) {
    if (!el) return;
    const msg = logoResolutionWarning(width, height);
    if (msg) {
      el.textContent = msg;
      el.hidden = false;
      el.classList.add('is-visible');
      return;
    }
    el.textContent = '';
    el.hidden = true;
    el.classList.remove('is-visible');
  }

  function clearLogoQualityHint(el) {
    if (!el) return;
    el.textContent = '';
    el.hidden = true;
    el.classList.remove('is-visible');
  }

  async function checkLogoFileQuality(file, hintEl) {
    if (!file || !hintEl) return;
    try {
      const dims = await measureImageFile(file);
      updateLogoQualityHint(hintEl, dims.width, dims.height);
    } catch {
      clearLogoQualityHint(hintEl);
    }
  }

  async function checkLogoUrlQuality(url, hintEl) {
    const src = String(url || '').trim();
    if (!src || !/^https?:\/\//i.test(src)) {
      clearLogoQualityHint(hintEl);
      return;
    }
    try {
      const dims = await measureImageUrl(src);
      updateLogoQualityHint(hintEl, dims.width, dims.height);
    } catch {
      clearLogoQualityHint(hintEl);
    }
  }

  function bindLogoUrlQualityCheck(urlInput, hintEl, hasFile) {
    if (!urlInput || !hintEl) return;
    urlInput.addEventListener('blur', function () {
      if (typeof hasFile === 'function' && hasFile()) return;
      checkLogoUrlQuality(urlInput.value, hintEl);
    });
    urlInput.addEventListener('input', function () {
      if (!urlInput.value.trim()) clearLogoQualityHint(hintEl);
    });
  }

  function acceptImageFile(file, onFile, qualityHintEl) {
    if (!file || !String(file.type || '').startsWith('image/')) return false;
    if (file.size > MAX_BYTES) {
      alert('Image must be under 2MB');
      return false;
    }
    onFile(file);
    if (qualityHintEl) checkLogoFileQuality(file, qualityHintEl);
    return true;
  }

  function fileFromClipboardEvent(e) {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return null;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image') === 0) {
        return items[i].getAsFile();
      }
    }
    return null;
  }

  /**
   * @param {{ zone: HTMLElement, fileInput?: HTMLInputElement, onFile: (file: File) => void, qualityHintEl?: HTMLElement }} opts
   */
  function bindImageUpload(opts) {
    const zone = opts.zone;
    const fileInput = opts.fileInput;
    const onFile = opts.onFile;
    const qualityHintEl = opts.qualityHintEl;
    if (!zone || typeof onFile !== 'function') return;

    if (fileInput) {
      zone.addEventListener('click', function () {
        fileInput.click();
      });
      fileInput.addEventListener('change', function () {
        const file = fileInput.files && fileInput.files[0];
        if (file) acceptImageFile(file, onFile, qualityHintEl);
      });
    }

    zone.addEventListener('paste', function (e) {
      const file = fileFromClipboardEvent(e);
      if (!file) return;
      e.preventDefault();
      acceptImageFile(file, onFile, qualityHintEl);
    });

    zone.addEventListener('dragover', function (e) {
      e.preventDefault();
      zone.classList.add('is-dragover');
    });
    zone.addEventListener('dragleave', function () {
      zone.classList.remove('is-dragover');
    });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('is-dragover');
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) acceptImageFile(file, onFile, qualityHintEl);
    });
  }

  global.hubBindImageUpload = bindImageUpload;
  global.hubLogoResolutionWarning = logoResolutionWarning;
  global.hubUpdateLogoQualityHint = updateLogoQualityHint;
  global.hubClearLogoQualityHint = clearLogoQualityHint;
  global.hubCheckLogoFileQuality = checkLogoFileQuality;
  global.hubCheckLogoUrlQuality = checkLogoUrlQuality;
  global.hubBindLogoUrlQualityCheck = bindLogoUrlQualityCheck;
  global.hubMeasureImageUrl = measureImageUrl;
})(window);
