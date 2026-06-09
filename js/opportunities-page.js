/**
 * Opportunities — preview cards (coming soon; no live listings yet).
 */
(function () {
  var LISTINGS = [
    {
      type: 'SPONSORSHIP',
      typeClass: 'sponsor',
      value: '£2,500',
      host: 'London Business Network',
      title: 'Annual gala — Title sponsor',
      tags: 'Sponsorship · Events · London · In person',
      date: 'Closes Fri 18 Apr',
      location: 'London',
    },
    {
      type: 'PARTNERSHIP',
      typeClass: 'partner',
      value: 'Revenue share',
      host: 'Midlands Connect',
      title: 'Referral partnership — B2B services',
      tags: 'Partnership · Referrals · Birmingham · Hybrid',
      date: 'Open · Rolling',
      location: 'West Midlands',
    },
    {
      type: 'SPEAKING',
      typeClass: 'speaking',
      value: 'Paid slot',
      host: 'Northern Leaders Forum',
      title: 'Keynote speaker — Growth summit',
      tags: 'Speaking · Leadership · Manchester · In person',
      date: 'Apply by Mon 28 Apr',
      location: 'Manchester',
    },
    {
      type: 'SPONSORSHIP',
      typeClass: 'sponsor',
      value: '£800',
      host: 'Bristol Entrepreneurs',
      title: 'Monthly breakfast — Exhibition stand',
      tags: 'Sponsorship · Networking · Bristol · In person',
      date: 'Closes Wed 09 Apr',
      location: 'Bristol',
    },
    {
      type: 'PARTNERSHIP',
      typeClass: 'partner',
      value: 'Co-marketing',
      host: 'Scottish SME Alliance',
      title: 'Joint webinar series partner',
      tags: 'Partnership · Marketing · Edinburgh · Online',
      date: 'Open · Rolling',
      location: 'Scotland',
    },
    {
      type: 'SPEAKING',
      typeClass: 'speaking',
      value: 'Free slot',
      host: 'Cardiff Chamber',
      title: 'Panel guest — Digital transformation',
      tags: 'Speaking · Technology · Cardiff · In person',
      date: 'Apply by Thu 01 May',
      location: 'Cardiff',
    },
  ];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cardHtml(item) {
    return (
      '<article class="opportunities-card" aria-hidden="true">' +
      '<div class="opportunities-card-media">' +
      '<span class="opportunities-card-type opportunities-card-type--' +
      escapeHtml(item.typeClass) +
      '">' +
      escapeHtml(item.type) +
      '</span>' +
      '<span class="opportunities-card-value">' +
      escapeHtml(item.value) +
      '</span>' +
      '</div>' +
      '<div class="opportunities-card-body">' +
      '<p class="opportunities-card-host">' +
      escapeHtml(item.host) +
      '</p>' +
      '<h3 class="opportunities-card-title">' +
      escapeHtml(item.title) +
      '</h3>' +
      '<p class="opportunities-card-tags">' +
      escapeHtml(item.tags) +
      '</p>' +
      '<p class="opportunities-card-detail"><span class="ico" aria-hidden="true">📅</span> ' +
      escapeHtml(item.date) +
      '</p>' +
      '<p class="opportunities-card-detail"><span class="ico" aria-hidden="true">📍</span> ' +
      escapeHtml(item.location) +
      '</p>' +
      '</div></article>'
    );
  }

  var grid = document.getElementById('opportunities-grid');
  if (!grid) return;
  grid.innerHTML = LISTINGS.map(cardHtml).join('');
})();
