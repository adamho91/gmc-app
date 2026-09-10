/**
 * Drag + resize for floating HUD panels / modal dialogs.
 * Drag from title/handle; resize from bottom-right grip. Geometry persists in localStorage.
 */
(function (global) {
  const MIN_W = 160;
  const MIN_H = 120;

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function boundsRect(el) {
    if (!el || el === document.documentElement || el === document.body) {
      return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    }
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  function readStored(key) {
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return null;
      return data;
    } catch (_) {
      return null;
    }
  }

  function writeStored(key, data) {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (_) {}
  }

  function ensureAbsolute(panel, boundsEl) {
    const cs = getComputedStyle(panel);
    if (cs.position === "absolute" || cs.position === "fixed") return;
    const br = boundsRect(boundsEl);
    const pr = panel.getBoundingClientRect();
    panel.style.position = boundsEl && boundsEl !== document.documentElement ? "absolute" : "fixed";
    panel.style.left = `${Math.round(pr.left - br.left)}px`;
    panel.style.top = `${Math.round(pr.top - br.top)}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.margin = "0";
    if (!panel.style.width) panel.style.width = `${Math.round(pr.width)}px`;
  }

  function applyGeometry(panel, geo, boundsEl, minW, minH) {
    if (!geo) return;
    const br = boundsRect(boundsEl);
    const w = clamp(Number(geo.w) || panel.offsetWidth || minW, minW, Math.max(minW, br.width - 8));
    const h = clamp(Number(geo.h) || panel.offsetHeight || minH, minH, Math.max(minH, br.height - 8));
    const left = clamp(Number(geo.x) || 0, 0, Math.max(0, br.width - w));
    const top = clamp(Number(geo.y) || 0, 0, Math.max(0, br.height - h));
    panel.style.position = boundsEl && boundsEl !== document.documentElement ? "absolute" : "fixed";
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.margin = "0";
    panel.style.width = `${Math.round(w)}px`;
    panel.style.height = `${Math.round(h)}px`;
    panel.style.maxWidth = "none";
    panel.style.maxHeight = "none";
  }

  function currentGeometry(panel, boundsEl) {
    const br = boundsRect(boundsEl);
    const pr = panel.getBoundingClientRect();
    return {
      x: pr.left - br.left,
      y: pr.top - br.top,
      w: pr.width,
      h: pr.height,
    };
  }

  function isInteractiveTarget(el, handle) {
    if (!el || !handle) return false;
    if (el === handle || handle.contains(el)) {
      const tag = (el.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || tag === "button" || tag === "a") return true;
      if (el.isContentEditable) return true;
    }
    return false;
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function enableFloatPanel(panel, options = {}) {
    if (!panel || panel.dataset.gmcFloatReady === "1") return panel;
    panel.dataset.gmcFloatReady = "1";
    panel.classList.add("gmc-float-panel");

    const minW = options.minWidth || MIN_W;
    const minH = options.minHeight || MIN_H;
    const storageKey = options.storageKey || "";
    const boundsEl =
      options.boundsEl ||
      panel.closest("#canvas-wrap") ||
      panel.closest("#canvas-area") ||
      panel.parentElement ||
      document.documentElement;

    let handle =
      (typeof options.handle === "string"
        ? panel.querySelector(options.handle)
        : options.handle) ||
      panel.querySelector(
        ".canvas-hud-title, .embed-modal-title, .export-embed-title, .gmc-preset-modal-title, .gmc-float-handle"
      );
    if (!handle) {
      handle = document.createElement("div");
      handle.className = "gmc-float-handle";
      handle.textContent = "Drag";
      panel.insertBefore(handle, panel.firstChild);
    }
    handle.classList.add("gmc-float-handle");
    handle.title = handle.title || "Drag to move";

    let grip = panel.querySelector(":scope > .gmc-float-resize");
    if (!grip) {
      grip = document.createElement("div");
      grip.className = "gmc-float-resize";
      grip.title = "Drag to resize";
      panel.appendChild(grip);
    }

    const stored = readStored(storageKey);
    function tryApplyStored() {
      if (!stored || !Number.isFinite(stored.w) || !Number.isFinite(stored.h)) return;
      if (!isVisible(panel) && !isVisible(boundsEl)) return;
      applyGeometry(panel, stored, boundsEl, minW, minH);
    }
    tryApplyStored();
    if (stored && !isVisible(panel)) {
      const host = boundsEl && boundsEl !== document.documentElement ? boundsEl : panel;
      const mo = new MutationObserver(() => {
        if (!isVisible(panel)) return;
        tryApplyStored();
        mo.disconnect();
      });
      mo.observe(host, { attributes: true, attributeFilter: ["style", "class", "hidden"] });
      if (host !== panel) mo.observe(panel, { attributes: true, attributeFilter: ["style", "class", "hidden"] });
    }

    function persist() {
      writeStored(storageKey, currentGeometry(panel, boundsEl));
    }

    function onDragStart(ev) {
      if (ev.button != null && ev.button !== 0) return;
      const target = ev.target;
      if (target.closest && target.closest(".gmc-float-resize")) return;
      if (isInteractiveTarget(target, handle) && target !== handle) return;
      if (!handle.contains(target) && target !== handle) return;

      ev.preventDefault();
      ensureAbsolute(panel, boundsEl);
      const br = boundsRect(boundsEl);
      const start = currentGeometry(panel, boundsEl);
      const originX = ev.clientX;
      const originY = ev.clientY;
      panel.classList.add("is-dragging");

      function onMove(e) {
        const dx = e.clientX - originX;
        const dy = e.clientY - originY;
        const w = start.w;
        const h = start.h;
        const x = clamp(start.x + dx, 0, Math.max(0, br.width - w));
        const y = clamp(start.y + dy, 0, Math.max(0, br.height - h));
        panel.style.left = `${Math.round(x)}px`;
        panel.style.top = `${Math.round(y)}px`;
        panel.style.right = "auto";
        panel.style.bottom = "auto";
      }

      function onUp() {
        panel.classList.remove("is-dragging");
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        persist();
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    }

    function onResizeStart(ev) {
      if (ev.button != null && ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      ensureAbsolute(panel, boundsEl);
      const br = boundsRect(boundsEl);
      const start = currentGeometry(panel, boundsEl);
      const originX = ev.clientX;
      const originY = ev.clientY;
      panel.classList.add("is-resizing");

      function onMove(e) {
        const w = clamp(start.w + (e.clientX - originX), minW, Math.max(minW, br.width - start.x - 4));
        const h = clamp(start.h + (e.clientY - originY), minH, Math.max(minH, br.height - start.y - 4));
        panel.style.width = `${Math.round(w)}px`;
        panel.style.height = `${Math.round(h)}px`;
        panel.style.maxWidth = "none";
        panel.style.maxHeight = "none";
      }

      function onUp() {
        panel.classList.remove("is-resizing");
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        persist();
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    }

    handle.addEventListener("pointerdown", onDragStart);
    grip.addEventListener("pointerdown", onResizeStart);

    return panel;
  }

  function enableAll(list) {
    (list || []).forEach((item) => {
      if (!item) return;
      if (item.el) enableFloatPanel(item.el, item);
      else if (item.nodeType === 1) enableFloatPanel(item);
    });
  }

  global.GMCFloatPanels = { enable: enableFloatPanel, enableAll };
})(window);
