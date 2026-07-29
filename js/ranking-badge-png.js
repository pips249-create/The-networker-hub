/**
 * Client-side PNG download from ranking badge SVG (no server image library).
 */
(function (global) {
  function downloadDataUrl(dataUrl, filename) {
    var link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename || 'ranking-badge.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function svgToPngDataUrl(svgText, width, height) {
    return new Promise(function (resolve, reject) {
      var blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = width || 680;
          canvas.height = height || 240;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/png'));
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('badge_image_failed'));
      };
      img.src = url;
    });
  }

  function downloadRankingBadgePng(imageUrl, filename) {
    return fetch(String(imageUrl || ''), { credentials: 'same-origin', cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('badge_fetch_failed');
        return res.text();
      })
      .then(function (svg) {
        return svgToPngDataUrl(svg, 680, 240);
      })
      .then(function (dataUrl) {
        downloadDataUrl(dataUrl, filename || 'networker-ranking-badge.png');
        return dataUrl;
      });
  }

  global.HubRankingBadgePng = {
    download: downloadRankingBadgePng,
    svgToPngDataUrl: svgToPngDataUrl,
  };
})(typeof window !== 'undefined' ? window : globalThis);
