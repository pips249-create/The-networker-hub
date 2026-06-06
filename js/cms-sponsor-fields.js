/**
 * Sponsor Hub field helpers — subtitle/image_url vs title/logo_url schema variants.
 */
(function () {
  function tagline(block) {
    if (!block) return '';
    var title = String(block.title || '').trim();
    if (title && title.toLowerCase() !== 'sponsor hub') return title;
    var subtitle = String(block.subtitle || '').trim();
    if (subtitle) return subtitle;
    var temp = document.createElement('div');
    temp.innerHTML = String(block.body || '');
    var h3 = temp.querySelector('h3');
    return h3 ? h3.textContent.trim() : '';
  }

  function logoUrl(block) {
    if (!block) return '';
    return String(block.logo_url || block.image_url || '').trim();
  }

  function companyName(block) {
    if (!block) return '';
    return String(block.company_name || '').trim();
  }

  function isLogoUrl(url) {
    var u = String(url || '').trim();
    return /^(https?:|\/|data:image\/)/i.test(u);
  }

  function sampleBackgroundFromImage(img) {
    try {
      var canvas = document.createElement('canvas');
      var size = 24;
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, size, size);
      var data = ctx.getImageData(0, 0, size, size).data;
      var r = 0;
      var g = 0;
      var b = 0;
      var n = 0;
      for (var i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 40) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
      if (!n) return null;
      return (
        'rgb(' +
        Math.round(r / n) +
        ',' +
        Math.round(g / n) +
        ',' +
        Math.round(b / n) +
        ')'
      );
    } catch (e) {
      return null;
    }
  }

  function applyLogoBand(wrap, img, hasLogo) {
    if (!wrap) return;
    wrap.classList.add('sponsor-logo-band');
    wrap.classList.toggle('has-logo', Boolean(hasLogo));

    if (!hasLogo || !img) {
      wrap.style.backgroundColor = '';
      return;
    }

    img.classList.add('sponsor-logo--full');
    if (!img.crossOrigin) img.crossOrigin = 'anonymous';

    function paint() {
      var bg = sampleBackgroundFromImage(img);
      wrap.style.backgroundColor = bg || '#f3f4f6';
    }

    if (img.complete && img.naturalWidth) paint();
    else {
      img.addEventListener('load', paint, { once: true });
      img.addEventListener(
        'error',
        function () {
          wrap.style.backgroundColor = '#f3f4f6';
        },
        { once: true }
      );
    }
  }

  window.CmsSponsorFields = {
    tagline: tagline,
    logoUrl: logoUrl,
    companyName: companyName,
    isLogoUrl: isLogoUrl,
    applyLogoBand: applyLogoBand,
  };
})();
