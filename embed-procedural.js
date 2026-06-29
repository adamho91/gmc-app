/*! GMC procedural embed — loads live player scripts from __GMC_EMBED_BASE__ */
(function () {
  var cfg = window.__GMC_EMBED_CONFIG__;
  var base = String(window.__GMC_EMBED_BASE__ || "").replace(/\/+$/, "");
  var mount = document.getElementById("gmc-pe-mount");
  if (!cfg || !base || !mount) {
    console.warn("GMC embed: missing config, base URL, or #gmc-pe-mount");
    return;
  }

  document.documentElement.classList.add("gmc-embed", "gmc-embed-inline");

  mount.innerHTML =
    '<div id="canvas-wrap" class="bg-checker">' +
    '<div id="blobs-back-layer"><svg id="vas-c" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true"></svg></div>' +
    '<div id="text-layer"></div>' +
    '<div id="blobs-front-layer"><svg id="vas-c-front" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true"></svg></div>' +
    "</div>";

  var scripts = [
    "https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js",
    base + "/vasarely.js",
    base + "/presets.js",
    base + "/spinner.js",
  ];
  if (!window.__GMC_EMBED_BAKED__) {
    scripts.splice(2, 0, base + "/bundled-font-data.js", base + "/bundled-fonts.js");
  }

  function load(i) {
    if (i >= scripts.length) {
      if (typeof window.GMCEmbedBoot === "function") window.GMCEmbedBoot();
      return;
    }
    var s = document.createElement("script");
    s.src = scripts[i];
    s.crossOrigin = "anonymous";
    s.onload = function () {
      load(i + 1);
    };
    s.onerror = function () {
      console.warn("GMC embed: failed to load", scripts[i]);
      load(i + 1);
    };
    document.head.appendChild(s);
  }

  load(0);
})();
