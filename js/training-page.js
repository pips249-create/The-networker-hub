/**
 * Browse training — preview cards (coming soon; no live listings yet).
 */
(function () {
  var SESSIONS = [
    {
      type: 'WORKSHOP',
      typeClass: 'workshop',
      price: 'Free',
      host: 'Apex Events UK',
      rating: '3.5',
      reviews: 415,
      title: 'Pitch mastery — Workshop',
      tags: 'Workshop · Networking · London · In person',
      date: 'Fri 03 Apr · 9:00',
      location: 'London',
      spots: '3 spots',
    },
    {
      type: 'SEMINAR',
      typeClass: 'seminar',
      price: '£69.20',
      host: 'Meridian Business Group',
      rating: '4.2',
      reviews: 287,
      title: 'Executive presence — Seminar',
      tags: 'Seminar · Leadership · Manchester · In person',
      date: 'Tue 14 Apr · 14:00',
      location: 'Manchester',
      spots: '12 spots',
    },
    {
      type: 'MASTERCLASS',
      typeClass: 'masterclass',
      price: '£83.02',
      host: 'Catalyst Collective',
      rating: '4.8',
      reviews: 152,
      title: 'Negotiation edge — Masterclass',
      tags: 'Masterclass · Sales · Birmingham · Hybrid',
      date: 'Wed 22 Apr · 10:30',
      location: 'Birmingham',
      spots: '8 spots',
    },
    {
      type: 'WORKSHOP',
      typeClass: 'workshop',
      price: 'Free',
      host: 'Summit Path Ltd',
      rating: '3.9',
      reviews: 98,
      title: 'Storytelling for leaders — Workshop',
      tags: 'Workshop · Communications · Leeds · In person',
      date: 'Mon 27 Apr · 9:00',
      location: 'Leeds',
      spots: '5 spots',
    },
    {
      type: 'SEMINAR',
      typeClass: 'seminar',
      price: '£12.50',
      host: 'Northline Partners',
      rating: '4.0',
      reviews: 214,
      title: 'Financial clarity — Seminar',
      tags: 'Seminar · Finance · Bristol · Online',
      date: 'Thu 30 Apr · 11:00',
      location: 'Online',
      spots: '24 spots',
    },
    {
      type: 'MASTERCLASS',
      typeClass: 'masterclass',
      price: '£95.00',
      host: 'Bridge & Co.',
      rating: '4.6',
      reviews: 63,
      title: 'Brand authority — Masterclass',
      tags: 'Masterclass · Marketing · London · In person',
      date: 'Sat 02 May · 13:00',
      location: 'London',
      spots: '6 spots',
    },
    {
      type: 'WORKSHOP',
      typeClass: 'workshop',
      price: '£25.00',
      host: 'Guild Training UK',
      rating: '3.7',
      reviews: 441,
      title: 'Public speaking basics — Workshop',
      tags: 'Workshop · Skills · Edinburgh · In person',
      date: 'Wed 06 May · 18:00',
      location: 'Edinburgh',
      spots: '15 spots',
    },
    {
      type: 'SEMINAR',
      typeClass: 'seminar',
      price: 'Free',
      host: 'Harbor Learning',
      rating: '4.1',
      reviews: 176,
      title: 'Team dynamics — Seminar',
      tags: 'Seminar · HR · Cardiff · In person',
      date: 'Fri 08 May · 10:00',
      location: 'Cardiff',
      spots: '9 spots',
    },
  ];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cardHtml(s) {
    return (
      '<article class="training-card" aria-hidden="true">' +
      '<div class="training-card-media">' +
      '<span class="training-card-type training-card-type--' +
      escapeHtml(s.typeClass) +
      '">' +
      escapeHtml(s.type) +
      '</span>' +
      '<span class="training-card-price">' +
      escapeHtml(s.price) +
      '</span>' +
      '</div>' +
      '<div class="training-card-body">' +
      '<p class="training-card-host">' +
      escapeHtml(s.host) +
      ' <span class="star" aria-hidden="true">★</span> ' +
      escapeHtml(s.rating) +
      ' (' +
      escapeHtml(String(s.reviews)) +
      ')</p>' +
      '<h3 class="training-card-title">' +
      escapeHtml(s.title) +
      '</h3>' +
      '<p class="training-card-tags">' +
      escapeHtml(s.tags) +
      '</p>' +
      '<p class="training-card-detail"><span class="ico" aria-hidden="true">📅</span> ' +
      escapeHtml(s.date) +
      '</p>' +
      '<p class="training-card-detail"><span class="ico" aria-hidden="true">📍</span> ' +
      escapeHtml(s.location) +
      '</p>' +
      '<p class="training-card-spots"><span class="ico" aria-hidden="true">👥</span> ' +
      escapeHtml(s.spots) +
      '</p>' +
      '</div></article>'
    );
  }

  var grid = document.getElementById('training-grid');
  if (!grid) return;
  grid.innerHTML = SESSIONS.map(cardHtml).join('');
})();
