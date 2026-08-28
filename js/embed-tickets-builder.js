(function () {
      var slugInput = document.getElementById('embed-slug');
      var codeEl = document.getElementById('embed-code');
      var preview = document.getElementById('embed-preview');
      var copyBtn = document.getElementById('embed-copy');
      var openLink = document.getElementById('embed-open');
      var origin = window.location.origin || 'https://www.thenetworkeruk.com';

      function slug() {
        return String(slugInput && slugInput.value || '')
          .trim()
          .replace(/^\/+|\/+$/g, '')
          .replace(/^events\//i, '');
      }

      function widgetUrl() {
        var s = slug();
        if (!s) return origin + '/embed/event';
        return origin + '/embed/event?slug=' + encodeURIComponent(s);
      }

      function snippet() {
        var src = widgetUrl();
        return (
          '<!-- The Networker UK ticket widget -->\n' +
          '<iframe\n' +
          '  src="' +
          src +
          '"\n' +
          '  title="Event tickets"\n' +
          '  loading="lazy"\n' +
          '  style="width:100%;max-width:420px;min-height:320px;border:0;overflow:hidden;display:block;"\n' +
          '></iframe>\n' +
          '<script>\n' +
          "window.addEventListener('message', function (e) {\n" +
          "  if (!e.data || e.data.source !== 'tnh-ticket-embed' || e.data.type !== 'resize') return;\n" +
          "  var frame = document.querySelector('iframe[src*=\"/embed/event\"]');\n" +
          '  if (frame && e.data.height) frame.style.height = e.data.height + \"px\";\n' +
          '});\n' +
          '</' +
          'script>'
        );
      }

      function refresh() {
        var src = widgetUrl();
        if (codeEl) codeEl.value = snippet();
        if (openLink) openLink.href = src;
        if (preview) {
          preview.src = slug() ? src : 'about:blank';
        }
      }

      if (slugInput) {
        slugInput.addEventListener('input', refresh);
        var q = new URLSearchParams(window.location.search || '');
        var fromQuery = String(q.get('slug') || '').trim();
        if (fromQuery) slugInput.value = fromQuery;
      }
      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          var text = codeEl ? codeEl.value : '';
          if (!text) return;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(
              function () {
                copyBtn.textContent = 'Copied';
                setTimeout(function () {
                  copyBtn.textContent = 'Copy embed code';
                }, 1600);
              },
              function () {
                codeEl.select();
                document.execCommand('copy');
              }
            );
          } else {
            codeEl.select();
            document.execCommand('copy');
          }
        });
      }
      window.addEventListener('message', function (e) {
        if (!e.data || e.data.source !== 'tnh-ticket-embed' || e.data.type !== 'resize') return;
        if (preview && e.data.height) preview.style.height = e.data.height + 'px';
      });
      refresh();
    })();
