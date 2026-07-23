/**
 * Dial sliders — same interaction/look as the glitch dust maker, purple theme.
 * Replaces every range input inside a .field (3D app) or .ctrl (2D generator)
 * row with a pill-shaped dial: label inside on the left, value on the right,
 * purple fill showing the position. The original input stays in the DOM
 * (hidden) and keeps receiving `input` events, so existing bindings work.
 * A rAF loop mirrors programmatic changes (preset loads, spin animation).
 */
(function () {
  "use strict";

  /* Live embeds hide all controls — skip the work entirely. */
  if (
    document.documentElement.classList.contains("gmc-embed") ||
    document.documentElement.classList.contains("gmc-2d-embed")
  ) {
    return;
  }

  var registry = [];

  function decimalsForStep(step) {
    var s = String(step);
    var dot = s.indexOf(".");
    return dot === -1 ? 0 : s.length - dot - 1;
  }

  function roundToStep(value, min, max, step) {
    var n = Math.round((value - min) / step);
    var v = min + n * step;
    var d = decimalsForStep(step);
    return Math.max(min, Math.min(max, Number(v.toFixed(d))));
  }

  function formatValue(value, step) {
    return value.toFixed(decimalsForStep(step));
  }

  function hashMarks(min, max, step) {
    var discreteSteps = (max - min) / step;
    var marks = [];
    if (discreteSteps <= 10) {
      for (var i = 1; i < discreteSteps; i++) {
        marks.push({ left: ((i * step) / (max - min)) * 100 });
      }
      return marks;
    }
    for (var j = 1; j <= 9; j++) marks.push({ left: j * 10 });
    return marks;
  }

  function snapClickValue(raw, min, max, step) {
    var steps = (max - min) / step;
    if (steps <= 10) return roundToStep(raw, min, max, step);
    var decile = Math.round(((raw - min) / (max - min)) * 10) / 10;
    return roundToStep(min + decile * (max - min), min, max, step);
  }

  /** Label + value discovery for the two markup styles in this app. */
  function analyzeRow(input, row) {
    var rangeRow = row.querySelector(":scope > .range-row");
    if (rangeRow) {
      /* 3D app / vf axes: .range-row holds <label> and <span class="val"> */
      var lab = rangeRow.querySelector("label");
      return {
        hideEl: rangeRow,
        labelText: lab ? lab.textContent.trim() : input.id,
        valEl: rangeRow.querySelector(".val"),
        valSuffix: "",
      };
    }
    var label = row.querySelector(":scope > label");
    if (label) {
      /* 2D generator: <label>Cell Size <span id="v-cell">36</span>px</label> */
      var span = label.querySelector("span");
      var labelText = "";
      var suffix = "";
      var seenSpan = false;
      label.childNodes.forEach(function (node) {
        if (node === span) {
          seenSpan = true;
          return;
        }
        if (node.nodeType === Node.TEXT_NODE) {
          if (seenSpan) suffix += node.textContent;
          else labelText += node.textContent;
        }
      });
      return {
        hideEl: label,
        labelText: labelText.trim() || input.id,
        valEl: span || null,
        valSuffix: suffix.trim(),
      };
    }
    return null;
  }

  function initDialSlider(input) {
    if (input.dataset.dialReady === "true") return;
    var row = input.closest(".field") || input.closest(".ctrl") || input.closest(".osc-slider");
    if (!row) return;
    var info = analyzeRow(input, row);
    if (!info) return;

    var min = Number(input.min);
    var max = Number(input.max);
    var step = Number(input.step) || 1;
    if (!isFinite(min) || !isFinite(max) || max <= min) return;

    row.classList.add("dial-row");
    if (info.hideEl) info.hideEl.classList.add("dial-hidden");
    input.classList.add("dial-source");
    input.tabIndex = -1;

    var wrap = document.createElement("div");
    wrap.className = "dial-slider-wrap";

    var track = document.createElement("div");
    track.className = "dial-slider";
    track.setAttribute("role", "slider");
    track.setAttribute("aria-valuemin", String(min));
    track.setAttribute("aria-valuemax", String(max));
    track.setAttribute("aria-label", info.labelText);

    var marksEl = document.createElement("div");
    marksEl.className = "dial-hashmarks";
    hashMarks(min, max, step).forEach(function (mark) {
      var m = document.createElement("div");
      m.className = "dial-hashmark";
      m.style.left = mark.left + "%";
      marksEl.appendChild(m);
    });

    var fill = document.createElement("div");
    fill.className = "dial-fill";

    var handle = document.createElement("div");
    handle.className = "dial-handle";

    var name = document.createElement("span");
    name.className = "dial-label";
    name.textContent = info.labelText;

    var value = document.createElement("span");
    value.className = "dial-value";

    track.append(marksEl, fill, handle, name, value);
    wrap.appendChild(track);
    input.before(wrap);

    var dragging = false;
    var clickMode = true;
    var downPos = null;
    var lastValue = null;
    var lastValText = null;

    function percent(v) {
      return ((v - min) / (max - min)) * 100;
    }

    function displayText(v) {
      /* Mirror the app's own value label so formatting stays exact. */
      if (info.valEl) {
        var t = info.valEl.textContent.trim();
        if (t && t !== "—") return t + (info.valSuffix ? info.valSuffix : "");
      }
      return formatValue(v, step);
    }

    function setVisual(v, active) {
      var p = Math.max(0, Math.min(100, percent(v)));
      fill.style.width = p + "%";
      handle.style.left = "max(4px, calc(" + p + "% - 7px))";
      track.classList.toggle("dial-slider-active", !!active);
      value.textContent = displayText(v);
      track.setAttribute("aria-valuenow", String(v));
      lastValue = String(input.value);
      lastValText = info.valEl ? info.valEl.textContent : null;
    }

    function commit(v, live) {
      var next = roundToStep(v, min, max, step);
      var active = live || dragging || track.matches(":hover");
      if (Number(input.value) !== next) {
        input.value = String(next);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      setVisual(Number(input.value), active);
    }

    function valueFromX(clientX) {
      var rect = track.getBoundingClientRect();
      var t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return min + t * (max - min);
    }

    track.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      track.setPointerCapture(e.pointerId);
      dragging = false;
      clickMode = true;
      downPos = { x: e.clientX, y: e.clientY };
      setVisual(Number(input.value), true);
    });

    track.addEventListener("pointermove", function (e) {
      if (!downPos) return;
      var dx = e.clientX - downPos.x;
      var dy = e.clientY - downPos.y;
      if (clickMode && Math.hypot(dx, dy) > 3) {
        clickMode = false;
        dragging = true;
        track.classList.add("dial-dragging");
      }
      if (!clickMode) commit(valueFromX(e.clientX), true);
    });

    function endPointer(e) {
      if (!downPos) return;
      if (clickMode) {
        commit(snapClickValue(valueFromX(e.clientX), min, max, step), false);
      } else {
        commit(valueFromX(e.clientX), false);
      }
      dragging = false;
      clickMode = false;
      downPos = null;
      track.classList.remove("dial-dragging");
      setVisual(Number(input.value), false);
      try {
        track.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }

    track.addEventListener("pointerup", endPointer);
    track.addEventListener("pointercancel", endPointer);

    track.addEventListener("mouseenter", function () {
      setVisual(Number(input.value), true);
    });
    track.addEventListener("mouseleave", function () {
      if (!downPos) setVisual(Number(input.value), false);
    });

    input.addEventListener("input", function () {
      setVisual(Number(input.value), dragging || track.matches(":hover"));
    });

    setVisual(Number(input.value), false);
    input.dataset.dialReady = "true";

    registry.push(function syncIfChanged() {
      if (!row.isConnected) return false;
      var valText = info.valEl ? info.valEl.textContent : null;
      if (String(input.value) !== lastValue || valText !== lastValText) {
        setVisual(Number(input.value), dragging || track.matches(":hover"));
      }
      return true;
    });
  }

  function initAllDialSliders() {
    document
      .querySelectorAll(
        '.field > input[type="range"], .ctrl > input[type="range"], .osc-slider > input[type="range"]'
      )
      .forEach(initDialSlider);
  }

  /* Mirror programmatic updates (preset loads, spin animation, setR). */
  function tick() {
    for (var i = registry.length - 1; i >= 0; i--) {
      if (!registry[i]()) registry.splice(i, 1);
    }
    requestAnimationFrame(tick);
  }

  function start() {
    initAllDialSliders();
    /* Variable font axes render after the font loads — pick them up too. */
    new MutationObserver(initAllDialSliders).observe(document.body, {
      childList: true,
      subtree: true,
    });
    requestAnimationFrame(tick);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
