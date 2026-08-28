(function () {
        var params = new URLSearchParams(window.location.search);
        var path = (window.location.pathname || '').replace(/\/+$/, '');
        var match = path.match(/\/events\/([^/]+)$/i);
        var slug =
          match && match[1] && match[1] !== 'event.html' && match[1] !== 'index.html'
            ? decodeURIComponent(match[1])
            : String(params.get('slug') || '').trim();
        var id = String(params.get('id') || '').trim();
        if (!id && !slug) return;
        var apiUrl = id
          ? '/api/hub-listings?id=' + encodeURIComponent(id)
          : '/api/hub-listings?slug=' + encodeURIComponent(slug);
        window.hubEventDetailPromise = fetch(apiUrl)
          .then(function (res) {
            return res.json();
          })
          .then(function (data) {
            return { data: data };
          })
          .catch(function (error) {
            return { error: error };
          });
      })();
