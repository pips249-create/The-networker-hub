(function () {
    var WORDS = ["event", "opportunity", "group", "attendee", "connection"];
    var word = document.getElementById("tnh-upgrade-banner-word");
    if (!word || !WORDS.length) return;
    var reduce = false;
    try {
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {}
    if (reduce) {
      word.textContent = WORDS.join(", ");
      word.classList.remove("is-fading");
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
      }, 180);
    }, 3200);
  })();
