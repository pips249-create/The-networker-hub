/**
 * Public ranking badge share page — preview + website embed code.
 * /rankings/badge?id=<organiserId> or ?slug=<slug>
 */
(function () {
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function params() {
    try {
      return new URLSearchParams(location.search || '');
    } catch (e) {
      return new URLSearchParams();
    }
  }

  function origin() {
    return (location.origin || 'https://www.thenetworkerhub.com').replace(/\/$/, '');
  }

  function normalizeTier(raw) {
    var t = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
    if (t === 'top10' || t === '10') return 'top10';
    if (t === 'top25' || t === '25') return 'top25';
    if (t === 'top50' || t === '50') return 'top50';
    return 'top50';
  }

  function badgeImageUrl(tier, periodLabel) {
    var q = new URLSearchParams();
    q.set('tier', normalizeTier(tier));
    if (periodLabel) q.set('period', String(periodLabel).trim());
    q.set('v', '2');
    return origin() + '/api/ranking-badge?' + q.toString();
  }

  function embedHtml(entry) {
    var org = entry.organiser || {};
    var profileUrl =
      org.profilePath && org.profilePath.indexOf('http') === 0
        ? org.profilePath
        : origin() + (org.profilePath || '/rankings');
    var rankingsUrl = origin() + '/rankings';
    var name = org.name || 'Our group';
    var tier = normalizeTier(entry.tier);
    var period = entry.periodLabel || '';
    var alt =
      name +
      ' — ' +
      String(entry.cardLabel || entry.displayLabel || 'Top ranking') +
      ' on The Networker Hub';
    var img = badgeImageUrl(tier, period);

    return (
      '<a href="' +
      profileUrl +
      '" target="_blank" rel="noopener noreferrer" title="' +
      alt.replace(/"/g, '&quot;') +
      '">' +
      '<img src="' +
      img +
      '" alt="' +
      alt.replace(/"/g, '&quot;') +
      '" width="340" height="120" style="border:0;display:inline-block;max-width:100%;height:auto;" />' +
      '</a><br />' +
      '<a href="' +
      rankingsUrl +
      '" target="_blank" rel="noopener noreferrer" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#64748b;text-decoration:underline;">' +
      'See the monthly leaderboard on The Networker Hub</a>'
    );
  }

  function findEntry(entries, q) {
    var id = String(q.get('id') || q.get('organiser') || q.get('organiserId') || '').trim();
    var slug = String(q.get('slug') || '').trim().toLowerCase();
    var list = entries || [];
    for (var i = 0; i < list.length; i++) {
      var org = list[i].organiser || {};
      if (id && String(org.id || '') === id) return list[i];
      if (slug && String(org.slug || '').toLowerCase() === slug) return list[i];
    }
    return null;
  }

  function setStatus(message) {
    var status = document.getElementById('badge-share-status');
    if (status) {
      status.hidden = false;
      status.textContent = message;
    }
    var content = document.getElementById('badge-share-content');
    if (content) content.hidden = true;
  }

  function paint(entry) {
    var org = entry.organiser || {};
    var status = document.getElementById('badge-share-status');
    var content = document.getElementById('badge-share-content');
    var preview = document.getElementById('badge-share-preview');
    var meta = document.getElementById('badge-share-meta');
    var code = document.getElementById('badge-share-code');
    var profile = document.getElementById('badge-share-profile');
    var title = document.getElementById('badge-share-title');
    var lede = document.getElementById('badge-share-lede');

    if (status) status.hidden = true;
    if (content) content.hidden = false;

    var badgeLabel = entry.cardLabel || entry.displayLabel || 'Top ranking';
    var name = org.name || 'Networking group';
    if (title) title.textContent = name + ' — ' + badgeLabel;
    if (lede) {
      lede.textContent =
        'Embed this ' +
        badgeLabel +
        ' badge on your website. It links to your Hub profile and the monthly leaderboard.';
    }

    document.title = name + ' ranking badge – The Networker Hub';

    var profileUrl =
      org.profilePath && org.profilePath.indexOf('http') === 0
        ? org.profilePath
        : origin() + (org.profilePath || '/rankings');

    if (preview) {
      preview.innerHTML =
        '<img src="' +
        esc(badgeImageUrl(entry.tier, entry.periodLabel)) +
        '" alt="' +
        esc(badgeLabel) +
        '" width="340" height="120" />';
    }
    if (meta) {
      meta.textContent =
        '#' +
        entry.rank +
        ' of ' +
        (entry.totalRanked || '—') +
        ' rated groups' +
        (entry.periodLabel ? ' · ' + entry.periodLabel : '');
    }
    if (code) code.value = embedHtml(entry);
    if (profile) {
      profile.href = profileUrl;
      profile.textContent = 'View profile';
    }

    try {
      var ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) ogImage.setAttribute('content', badgeImageUrl(entry.tier, entry.periodLabel));
      var ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', name + ' — ' + badgeLabel);
      var ogUrl = document.querySelector('meta[property="og:url"]');
      if (ogUrl) ogUrl.setAttribute('content', location.href.split('#')[0]);
    } catch (e) {
      /* ignore */
    }
  }

  function bindCopy() {
    var btn = document.getElementById('badge-share-copy');
    var code = document.getElementById('badge-share-code');
    if (!btn || !code) return;
    btn.addEventListener('click', function () {
      var text = code.value || '';
      function done() {
        var prev = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(function () {
          btn.textContent = prev;
        }, 1600);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {
          code.select();
          document.execCommand('copy');
          done();
        });
      } else {
        code.select();
        document.execCommand('copy');
        done();
      }
    });
  }

  function load() {
    var q = params();
    if (!q.get('id') && !q.get('organiser') && !q.get('organiserId') && !q.get('slug')) {
      setStatus('Open this page from your ranking email or organiser dashboard to load your badge.');
      return;
    }

    fetch('/api/rankings', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        var entries = (data && data.entries) || [];
        // Attach totalRanked from snapshot when missing on entry
        var total = data && data.snapshot && data.snapshot.total_ranked;
        entries = entries.map(function (entry) {
          if (entry.totalRanked == null && total != null) {
            return Object.assign({}, entry, { totalRanked: total });
          }
          return entry;
        });
        var entry = findEntry(entries, q);
        if (!entry) {
          setStatus(
            'No current ranking badge found for this group. Badges refresh monthly for the Top 50.'
          );
          return;
        }
        paint(entry);
      })
      .catch(function () {
        setStatus('Could not load rankings. Please try again shortly.');
      });
  }

  bindCopy();
  load();
})();
