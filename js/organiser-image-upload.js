/**
 * File pick + clipboard paste for organiser logo / event photo zones.
 * Flags low-resolution logos before upload.
 */
(function (global) {
  const MAX_BYTES = 2 * 1024 * 1024;
  const COMPRESS_ABOVE_BYTES = 350 * 1024;
  const MIN_LONG_EDGE = 800;
  const MIN_SHORT_EDGE = 400;

  function isImageFile(file) {
    if (!file) return false;
    const type = String(file.type || '').toLowerCase();
    if (type.startsWith('image/')) return true;
    return /\.(heic|heif)$/i.test(String(file.name || ''));
  }

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

  function eventCoverResolutionWarning(width, height) {
    const w = Number(width) || 0;
    const h = Number(height) || 0;
    if (w <= 0 || h <= 0) return null;
    const longEdge = Math.max(w, h);
    const shortEdge = Math.min(w, h);
    if (longEdge >= 1200 && shortEdge >= 720) return null;
    return (
      'This image is ' +
      w +
      '×' +
      h +
      'px and may look soft on the events browse page. Use a landscape photo at least 1200×750px for a sharp listing card.'
    );
  }

  function loadImageFile(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read image'));
      };
      img.src = url;
    });
  }

  function measureImageFile(file) {
    return loadImageFile(file).then(function (img) {
      return { width: img.naturalWidth, height: img.naturalHeight };
    });
  }

  function scaledDimensions(width, height, maxLongEdge) {
    const long = Math.max(width, height);
    if (long <= maxLongEdge) return { width: width, height: height };
    const scale = maxLongEdge / long;
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(
        function (blob) {
          if (blob) resolve(blob);
          else reject(new Error('Could not compress image'));
        },
        type,
        quality
      );
    });
  }

  async function compressImageFile(file, maxBytes) {
    if (file.size <= maxBytes) return file;

    const img = await loadImageFile(file);
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    let maxLongEdge = Math.min(Math.max(srcW, srcH), 2400);
    const qualities = [0.88, 0.78, 0.68, 0.58, 0.48, 0.38];
    const outputType = 'image/jpeg';

    while (maxLongEdge >= 320) {
      const dims = scaledDimensions(srcW, srcH, maxLongEdge);
      const canvas = document.createElement('canvas');
      canvas.width = dims.width;
      canvas.height = dims.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not compress image');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, dims.width, dims.height);
      ctx.drawImage(img, 0, 0, dims.width, dims.height);

      for (let i = 0; i < qualities.length; i++) {
        const blob = await canvasToBlob(canvas, outputType, qualities[i]);
        if (blob.size <= maxBytes) {
          const base = String(file.name || 'image').replace(/\.[^.]+$/, '') || 'image';
          return new File([blob], base + '.jpg', { type: outputType, lastModified: Date.now() });
        }
      }
      maxLongEdge = Math.round(maxLongEdge * 0.8);
    }

    throw new Error('Could not compress image');
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

  function updateEventCoverQualityHint(el, width, height) {
    if (!el) return;
    const msg = eventCoverResolutionWarning(width, height);
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

  async function checkEventCoverFileQuality(file, hintEl) {
    if (!file || !hintEl) return;
    try {
      const dims = await measureImageFile(file);
      updateEventCoverQualityHint(hintEl, dims.width, dims.height);
    } catch {
      if (hintEl) {
        hintEl.textContent = '';
        hintEl.hidden = true;
        hintEl.classList.remove('is-visible');
      }
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

  async function acceptImageFile(file, onFile, qualityHintEl, options) {
    if (!isImageFile(file)) return false;
    const maxBytes =
      options && options.maxBytes != null ? Number(options.maxBytes) : MAX_BYTES;
    const compressAbove =
      options && options.compressAboveBytes != null
        ? Number(options.compressAboveBytes)
        : COMPRESS_ABOVE_BYTES;
    let ready = file;
    if (file.size > compressAbove) {
      try {
        ready = await compressImageFile(file, maxBytes);
      } catch {
        const heic = /\.(heic|heif)$/i.test(String(file.name || ''));
        alert(
          heic
            ? 'This iPhone photo could not be read here. On your iPhone go to Settings → Camera → Formats → Most Compatible, then take or choose a JPEG photo — or paste an image URL instead.'
            : 'This image is too large and could not be compressed automatically. Try a smaller file or paste a URL instead.'
        );
        return false;
      }
    }
    onFile(ready);
    if (qualityHintEl) {
      if (options && options.coverQuality) checkEventCoverFileQuality(ready, qualityHintEl);
      else checkLogoFileQuality(ready, qualityHintEl);
    }
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
   * @param {{ zone: HTMLElement, fileInput?: HTMLInputElement, onFile: (file: File) => void, qualityHintEl?: HTMLElement, uploadOptions?: object }} opts
   */
  function bindImageUpload(opts) {
    const zone = opts.zone;
    const fileInput = opts.fileInput;
    const onFile = opts.onFile;
    const qualityHintEl = opts.qualityHintEl;
    const uploadOptions = opts.uploadOptions || null;
    if (!zone || typeof onFile !== 'function') return;

    if (fileInput) {
      zone.addEventListener('click', function () {
        fileInput.click();
      });
      fileInput.addEventListener('change', function () {
        const file = fileInput.files && fileInput.files[0];
        if (file) void acceptImageFile(file, onFile, qualityHintEl, uploadOptions);
      });
    }

    zone.addEventListener('paste', function (e) {
      const file = fileFromClipboardEvent(e);
      if (!file) return;
      e.preventDefault();
      void acceptImageFile(file, onFile, qualityHintEl, uploadOptions);
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
      if (file) void acceptImageFile(file, onFile, qualityHintEl, uploadOptions);
    });
  }

  global.hubBindImageUpload = bindImageUpload;
  global.hubLogoResolutionWarning = logoResolutionWarning;
  global.hubUpdateLogoQualityHint = updateLogoQualityHint;
  global.hubClearLogoQualityHint = clearLogoQualityHint;
  global.hubCheckLogoFileQuality = checkLogoFileQuality;
  global.hubCheckLogoUrlQuality = checkLogoUrlQuality;
  global.hubCheckEventCoverFileQuality = checkEventCoverFileQuality;
  global.hubBindLogoUrlQualityCheck = bindLogoUrlQualityCheck;
  global.hubMeasureImageUrl = measureImageUrl;
  global.hubPrepareImageFile = compressImageFile;
  global.hubIsImageFile = isImageFile;
})(window);
