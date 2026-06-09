/**
 * Home page — scroll reveals and home page partners strip.
 */
(function () {
  var SPONSOR_FALLBACK_SLOTS = [
    'events_sponsor_hub',
    'organisers_sponsor_hub',
    'opportunities_sponsor_hub',
    'academy_sponsor_hub',
    'sponsor_hub',
  ];

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function sponsorLogo(block) {
    if (window.CmsSponsorFields && window.CmsSponsorFields.logoUrl) {
      return window.CmsSponsorFields.logoUrl(block);
    }
    return String((block && (block.logo_url || block.image_url)) || '').trim();
  }

  function sponsorCompany(block) {
    if (window.CmsSponsorFields && window.CmsSponsorFields.companyName) {
      return window.CmsSponsorFields.companyName(block);
    }
    return String((block && block.company_name) || '').trim();
  }

  function sponsorCta(block) {
    var url = String((block && block.cta_url) || '').trim();
    if (/^(https?:|mailto:)/i.test(url)) return url;
    return '';
  }

  function initReveal() {
    var sections = document.querySelectorAll('.home-reveal');
    if (!sections.length) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sections.forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    if (!window.IntersectionObserver) {
      sections.forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -5% 0px' }
    );

    sections.forEach(function (el) {
      io.observe(el);
    });
  }

  function fetchCmsSlot(slot) {
    return fetch('/api/cms-block?slot=' + encodeURIComponent(slot), { cache: 'no-store' })
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return null;
      });
  }

  function partnerFromRow(p) {
    return {
      name: String(p.company_name || '').trim() || 'Partner',
      logo: String(p.logo_url || '').trim(),
      url: String(p.cta_url || '').trim(),
      label: String(p.cta_label || '').trim() || 'Visit website',
    };
  }

  function partnerItemHtml(p) {
    var inner =
      '<img src="' +
      esc(p.logo) +
      '" alt="' +
      esc(p.name) +
      '" loading="lazy" decoding="async" class="home-partner-logo" onerror="this.closest(\'.home-partner-item\').hidden=true" />';
    var title = esc(p.name) + (p.url ? ' — ' + esc(p.label) : '');
    if (/^(https?:|mailto:)/i.test(p.url)) {
      return (
        '<a class="home-partner-item" href="' +
        esc(p.url) +
        '" target="_blank" rel="noopener noreferrer" title="' +
        title +
        '">' +
        inner +
        '</a>'
      );
    }
    return '<div class="home-partner-item" title="' + title + '">' + inner + '</div>';
  }

  function renderPartners(partners) {
    var section = document.getElementById('home-partners');
    var track = document.getElementById('home-partners-logos');
    if (!section || !track || !partners.length) return;

    section.hidden = false;
    var items = partners.map(partnerItemHtml).join('');
    var useMarquee =
      partners.length > 5 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.classList.toggle('home-partners-track--marquee', useMarquee);
    track.classList.toggle('home-partners-track--static', !useMarquee);
    track.innerHTML = useMarquee ? items + items : items;
  }

  function loadPartners() {
    fetchCmsSlot('home_partners').then(function (data) {
      var partners = [];
      var seen = new Set();

      if (data && data.ok && data.active !== false && Array.isArray(data.partners)) {
        data.partners.forEach(function (p) {
          var row = partnerFromRow(p);
          if (!row.logo || seen.has(row.logo)) return;
          seen.add(row.logo);
          partners.push(row);
        });
      }

      if (partners.length) {
        renderPartners(partners);
        return;
      }

      return Promise.all(SPONSOR_FALLBACK_SLOTS.map(fetchCmsSlot)).then(function (results) {
        results.forEach(function (slotData) {
          if (!slotData || !slotData.ok || !slotData.block) return;
          var row = {
            name: sponsorCompany(slotData.block) || 'Partner',
            logo: sponsorLogo(slotData.block),
            url: sponsorCta(slotData.block),
            label: String(slotData.block.cta_label || '').trim() || 'Visit website',
          };
          if (!row.logo || seen.has(row.logo)) return;
          seen.add(row.logo);
          partners.push(row);
        });
        renderPartners(partners);
      });
    });
  }

  initReveal();
  loadPartners();
})();
