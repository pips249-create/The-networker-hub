/**
 * File pick + clipboard paste for organiser logo / event photo zones.
 */
(function (global) {
  const MAX_BYTES = 2 * 1024 * 1024;

  function acceptImageFile(file, onFile) {
    if (!file || !String(file.type || '').startsWith('image/')) return false;
    if (file.size > MAX_BYTES) {
      alert('Image must be under 2MB');
      return false;
    }
    onFile(file);
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
   * @param {{ zone: HTMLElement, fileInput?: HTMLInputElement, onFile: (file: File) => void }} opts
   */
  function bindImageUpload(opts) {
    const zone = opts.zone;
    const fileInput = opts.fileInput;
    const onFile = opts.onFile;
    if (!zone || typeof onFile !== 'function') return;

    if (fileInput) {
      zone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (file) acceptImageFile(file, onFile);
      });
    }

    zone.addEventListener('paste', (e) => {
      const file = fileFromClipboardEvent(e);
      if (!file) return;
      e.preventDefault();
      acceptImageFile(file, onFile);
    });

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('is-dragover');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('is-dragover');
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) acceptImageFile(file, onFile);
    });
  }

  global.hubBindImageUpload = bindImageUpload;
})(window);
