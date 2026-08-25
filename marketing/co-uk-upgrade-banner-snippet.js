/**
 * WordPress paste — co.uk upgrade banner (Custom JS version)
 *
 * Why JS: Simple Custom CSS & JS HTML snippets are not appearing on
 * the-networker.co.uk (NitroPack / head injection). JS snippets do load.
 *
 * Install:
 * 1. Custom CSS & JS → Add Custom JS Code (NOT HTML)
 * 2. Title: Hub 2026 banner
 * 3. Paste this ENTIRE file
 * 4. Where on page: Header · In Frontend · Active
 * 5. Update → NitroPack → Purge cache → hard-refresh homepage
 * 6. Deactivate any old Hub 2026 HTML snippet so you only have this one
 */
(function () {
  if (window.__tnhUpgradeBannerLoaded) return;
  window.__tnhUpgradeBannerLoaded = true;

  function ready(fn) {
    if (document.body) fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    if (document.getElementById("tnh-upgrade-banner")) return;

    // Fonts
    if (!document.getElementById("tnh-upgrade-banner-fonts")) {
      var pre1 = document.createElement("link");
      pre1.rel = "preconnect";
      pre1.href = "https://fonts.googleapis.com";
      document.head.appendChild(pre1);
      var pre2 = document.createElement("link");
      pre2.rel = "preconnect";
      pre2.href = "https://fonts.gstatic.com";
      pre2.crossOrigin = "anonymous";
      document.head.appendChild(pre2);
      var fonts = document.createElement("link");
      fonts.id = "tnh-upgrade-banner-fonts";
      fonts.rel = "stylesheet";
      fonts.href =
        "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,500;9..40,600;9..40,700;9..40,800&family=DM+Serif+Display:ital@0;1&display=swap";
      document.head.appendChild(fonts);
    }

    // CSS
    if (!document.getElementById("tnh-upgrade-banner-style")) {
      var style = document.createElement("style");
      style.id = "tnh-upgrade-banner-style";
      style.textContent =
        '#tnh-upgrade-banner.tnh-upgrade-banner{--tnh-ink:#1a1030;--tnh-cream:#fff8ef;--tnh-gold:#ffe08a;position:relative!important;display:block!important;width:100%!important;max-width:none!important;margin:0!important;padding:0!important;box-sizing:border-box!important;z-index:100000!important;overflow:hidden!important;background:linear-gradient(105deg,#2a1848 0%,#6b3488 38%,#c48420 72%,#e8b45a 100%)!important;color:#fff8ef!important;font-family:"DM Sans","Helvetica Neue",Arial,sans-serif!important;font-style:normal!important;line-height:normal!important;text-align:left!important;border:0!important;border-radius:0!important;box-shadow:none!important}' +
        "#tnh-upgrade-banner.tnh-upgrade-banner[hidden]{display:none!important}" +
        "#tnh-upgrade-banner *,#tnh-upgrade-banner *::before,#tnh-upgrade-banner *::after{box-sizing:border-box!important}" +
        "#tnh-upgrade-banner .tnh-upgrade-banner__glow{position:absolute!important;border-radius:50%!important;pointer-events:none!important;filter:blur(2px);opacity:.85}" +
        "#tnh-upgrade-banner .tnh-upgrade-banner__glow--1{width:280px!important;height:280px!important;top:-160px!important;left:-40px!important;background:radial-gradient(circle,rgba(255,220,140,.45) 0%,transparent 68%)!important;animation:tnh-banner-drift 7s ease-in-out infinite alternate}" +
        "#tnh-upgrade-banner .tnh-upgrade-banner__glow--2{width:320px!important;height:320px!important;top:-180px!important;right:-60px!important;background:radial-gradient(circle,rgba(255,255,255,.28) 0%,transparent 70%)!important;animation:tnh-banner-drift 9s ease-in-out infinite alternate-reverse}" +
        "@keyframes tnh-banner-drift{from{transform:translate(0,0)}to{transform:translate(18px,10px)}}" +
        "#tnh-upgrade-banner .tnh-upgrade-banner__inner{position:relative!important;max-width:1120px!important;margin:0 auto!important;padding:26px 24px!important;display:grid!important;grid-template-columns:minmax(150px,.85fr) minmax(240px,1.7fr) auto!important;align-items:center!important;gap:14px 32px!important;background:transparent!important;border:0!important}" +
        "#tnh-upgrade-banner .tnh-upgrade-banner__col--status{min-width:0!important}" +
        "#tnh-upgrade-banner a.tnh-upgrade-banner__logo-link{display:inline-block!important;margin:0 0 8px!important;padding:0!important;text-decoration:none!important;border:0!important;background:none!important;line-height:0!important}" +
        "#tnh-upgrade-banner .tnh-upgrade-banner__logo-chip{display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:6px 10px!important;border-radius:10px!important;background:#fff8ef!important;box-shadow:0 4px 14px rgba(26,16,48,.18)!important;border:0!important}" +
        "#tnh-upgrade-banner img.tnh-upgrade-banner__logo{display:block!important;width:auto!important;max-width:148px!important;height:44px!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:none!important;object-fit:contain!important}" +
        '#tnh-upgrade-banner .tnh-upgrade-banner__status{margin:0!important;padding:0!important;font-family:"DM Sans","Helvetica Neue",Arial,sans-serif!important;font-size:11px!important;font-weight:800!important;font-style:normal!important;letter-spacing:.12em!important;text-transform:uppercase!important;color:rgba(255,248,239,.88)!important;line-height:1.3!important;background:none!important;border:0!important}' +
        '#tnh-upgrade-banner .tnh-upgrade-banner__date{margin:5px 0 0!important;padding:0!important;font-family:"DM Sans","Helvetica Neue",Arial,sans-serif!important;font-size:clamp(.92rem,1.7vw,1.05rem)!important;font-weight:700!important;font-style:normal!important;line-height:1.25!important;color:#fffdf8!important;letter-spacing:-.015em!important;text-transform:none!important;background:none!important;border:0!important}' +
        "#tnh-upgrade-banner .tnh-upgrade-banner__date strong{color:#ffe08a!important;font-weight:800!important;font-style:normal!important}" +
        "#tnh-upgrade-banner .tnh-upgrade-banner__col--hero{min-width:0!important;text-align:center!important}" +
        '#tnh-upgrade-banner .tnh-upgrade-banner__headline{margin:0!important;padding:0!important;font-family:"DM Serif Display",Georgia,serif!important;font-size:clamp(1.85rem,4vw,2.55rem)!important;font-weight:400!important;font-style:normal!important;line-height:1.12!important;color:#fffdf8!important;letter-spacing:-.025em!important;text-transform:none!important;text-shadow:0 2px 18px rgba(26,16,48,.25);background:none!important;border:0!important}' +
        "#tnh-upgrade-banner .tnh-upgrade-banner__word{display:inline-block!important;min-width:7.5ch!important;color:#ffe08a!important;font-style:italic!important;font-weight:400!important;text-align:left!important;transition:opacity .12s ease,transform .12s ease}" +
        "#tnh-upgrade-banner .tnh-upgrade-banner__word.is-fading{opacity:0;transform:translateY(5px)}" +
        "#tnh-upgrade-banner .tnh-upgrade-banner__col--cta{justify-self:end!important}" +
        '#tnh-upgrade-banner a.tnh-upgrade-banner__cta{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:10px!important;padding:14px 22px!important;border:0!important;border-radius:999px!important;background:#fff8ef!important;color:#1a1030!important;font-family:"DM Sans","Helvetica Neue",Arial,sans-serif!important;font-size:14px!important;font-weight:800!important;font-style:normal!important;letter-spacing:-.01em!important;text-decoration:none!important;text-transform:none!important;white-space:nowrap!important;box-shadow:0 0 0 1px rgba(255,255,255,.35),0 10px 28px rgba(26,16,48,.28)!important;transition:transform .15s ease,background .15s ease,box-shadow .15s ease;animation:tnh-banner-cta-pulse 2.8s ease-in-out infinite}' +
        "#tnh-upgrade-banner a.tnh-upgrade-banner__cta:hover,#tnh-upgrade-banner a.tnh-upgrade-banner__cta:focus{background:#ffe08a!important;color:#1a1030!important;transform:translateY(-2px) scale(1.02);box-shadow:0 14px 32px rgba(26,16,48,.35)!important;animation:none}" +
        "@keyframes tnh-banner-cta-pulse{0%,100%{box-shadow:0 0 0 1px rgba(255,255,255,.35),0 10px 28px rgba(26,16,48,.28)}50%{box-shadow:0 0 0 4px rgba(255,224,138,.35),0 12px 30px rgba(26,16,48,.32)}}" +
        '@media (max-width:820px){#tnh-upgrade-banner .tnh-upgrade-banner__inner{grid-template-columns:1fr auto!important;grid-template-areas:"status cta" "hero hero";padding:22px 18px!important;gap:10px 16px!important}#tnh-upgrade-banner .tnh-upgrade-banner__col--status{grid-area:status}#tnh-upgrade-banner img.tnh-upgrade-banner__logo{height:38px!important;max-width:128px!important}#tnh-upgrade-banner .tnh-upgrade-banner__col--hero{grid-area:hero;text-align:left!important}#tnh-upgrade-banner .tnh-upgrade-banner__col--cta{grid-area:cta;justify-self:end!important;align-self:center!important}}' +
        '@media (max-width:520px){#tnh-upgrade-banner .tnh-upgrade-banner__inner{grid-template-columns:1fr!important;grid-template-areas:"status" "hero" "cta"}#tnh-upgrade-banner .tnh-upgrade-banner__col--cta{justify-self:start!important}#tnh-upgrade-banner a.tnh-upgrade-banner__cta{width:100%!important;justify-content:center!important}#tnh-upgrade-banner .tnh-upgrade-banner__headline{font-size:1.55rem!important}#tnh-upgrade-banner .tnh-upgrade-banner__word{min-width:0!important}}' +
        "@media (prefers-reduced-motion:reduce){#tnh-upgrade-banner .tnh-upgrade-banner__glow,#tnh-upgrade-banner a.tnh-upgrade-banner__cta,#tnh-upgrade-banner .tnh-upgrade-banner__word{animation:none!important;transition:none!important}}";
      document.head.appendChild(style);
    }

    // Banner HTML
    var wrap = document.createElement("div");
    wrap.innerHTML =
      '<aside class="tnh-upgrade-banner" id="tnh-upgrade-banner" role="region" aria-label="Announcement">' +
      '<span class="tnh-upgrade-banner__glow tnh-upgrade-banner__glow--1" aria-hidden="true"></span>' +
      '<span class="tnh-upgrade-banner__glow tnh-upgrade-banner__glow--2" aria-hidden="true"></span>' +
      '<div class="tnh-upgrade-banner__inner">' +
      '<div class="tnh-upgrade-banner__col tnh-upgrade-banner__col--status">' +
      '<a class="tnh-upgrade-banner__logo-link" href="https://www.thenetworkeruk.com/?utm_source=the-networker.co.uk&utm_medium=banner&utm_campaign=soft_launch_2026&utm_content=logo" target="_blank" rel="noopener">' +
      '<span class="tnh-upgrade-banner__logo-chip">' +
      '<img class="tnh-upgrade-banner__logo" src="https://www.thenetworkeruk.com/assets/logo-networker-uk-transparent.png?v=20260825banner" width="140" height="65" alt="The Networker UK">' +
      "</span></a>" +
      '<p class="tnh-upgrade-banner__status">We&rsquo;re upgrading</p>' +
      '<p class="tnh-upgrade-banner__date">Browse from <strong>25 August</strong></p>' +
      "</div>" +
      '<div class="tnh-upgrade-banner__col tnh-upgrade-banner__col--hero">' +
      '<p class="tnh-upgrade-banner__headline">Find your next ' +
      '<span class="tnh-upgrade-banner__word" id="tnh-upgrade-banner-word" aria-live="polite">event</span></p>' +
      "</div>" +
      '<div class="tnh-upgrade-banner__col tnh-upgrade-banner__col--cta">' +
      '<a class="tnh-upgrade-banner__cta" href="https://www.thenetworkeruk.com/peek?utm_source=the-networker.co.uk&utm_medium=banner&utm_campaign=soft_launch_2026&utm_content=peek" target="_blank" rel="noopener">' +
      'Sneak Peek <span aria-hidden="true">&rarr;</span></a>' +
      "</div></div></aside>";

    var banner = wrap.firstChild;

    // Sit above the purple Elementor header
    var site = document.getElementById("c27-site-wrapper");
    if (site && site.parentNode) {
      site.parentNode.insertBefore(banner, site);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }

    // Rotate words
    var WORDS = ["event", "opportunity", "group", "attendee", "connection"];
    var word = document.getElementById("tnh-upgrade-banner-word");
    if (!word || !WORDS.length) return;
    var reduce = false;
    try {
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {}
    if (reduce) {
      word.textContent = WORDS.join(", ");
      return;
    }
    var i = 0;
    word.textContent = WORDS[0];
    window.setInterval(function () {
      i = (i + 1) % WORDS.length;
      word.classList.add("is-fading");
      window.setTimeout(function () {
        word.textContent = WORDS[i];
        word.classList.remove("is-fading");
      }, 120);
    }, 2000);
  });
})();
