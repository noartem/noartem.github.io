(function () {
  var docEl = document.documentElement;
  var header = document.querySelector(".site-header");
  var main = document.querySelector("main");
  if (!header || !main) return;

  var compact = false;
  var morphDist = 320; // scroll distance over which the hero morphs into the bar
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function smooth(t) {
    return t * t * (3 - 2 * t);
  }

  // Measure the real heights so the morph distance follows fonts and breakpoints.
  function measure() {
    var restore = compact;
    docEl.classList.add("compact");
    docEl.style.setProperty("--p", "1");
    var compactH = header.offsetHeight;
    if (!restore) docEl.classList.remove("compact");
    docEl.style.setProperty("--p", "0");
    var pad = parseFloat(getComputedStyle(main).paddingTop) || 0;
    morphDist = Math.max(60, pad - compactH);
  }

  function update() {
    var t = clamp01(window.scrollY / morphDist);
    var p = reduceMotion ? t : smooth(t);
    docEl.style.setProperty("--p", String(p));
    var should = window.scrollY > morphDist;
    if (should !== compact) {
      compact = should;
      docEl.classList.toggle("compact", compact);
    }
  }

  function onScroll() {
    update();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () {
    measure();
    update();
  }, { passive: true });
  window.addEventListener("load", function () {
    measure();
    update();
  });
  var avatarImg = header.querySelector("img");
  if (avatarImg && !avatarImg.complete) {
    avatarImg.addEventListener("load", function () {
      measure();
      update();
    });
  }

  measure();
  update();
})();

  (function () {
  var docEl = document.documentElement;
  var THEME_KEY = "theme";
  var schemeQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function applyTheme(mode) {
    var dark = mode === "dark" || (mode === "system" && schemeQuery && schemeQuery.matches);
    if (dark) docEl.setAttribute("data-theme", "dark");
    else docEl.removeAttribute("data-theme");
    var buttons = document.querySelectorAll("[data-theme-option]");
    for (var i = 0; i < buttons.length; i++) {
      var active = buttons[i].getAttribute("data-theme-option") === mode;
      buttons[i].classList.toggle("active", active);
      buttons[i].setAttribute("aria-pressed", String(active));
    }
  }

  try {
    var stored = localStorage.getItem(THEME_KEY);
  } catch (e) {}
  var mode = stored === "light" || stored === "dark" ? stored : "system";
  applyTheme(mode);
  if (schemeQuery.addEventListener) {
    schemeQuery.addEventListener("change", function () {
      applyTheme(mode);
    });
  }
  document.addEventListener("click", function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest("[data-theme-option]") : null;
    if (!btn) return;
    var next = btn.getAttribute("data-theme-option");
    mode = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {}
    applyTheme(mode);
  });
})();
