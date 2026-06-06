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

  window.CmsSponsorFields = {
    tagline: tagline,
    logoUrl: logoUrl,
    companyName: companyName,
  };
})();
