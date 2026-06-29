/**
 * Halftone field — checker + blobs as SVG (background for World Spinner).
 * Root #vas-c is an <svg>; sphere masking is applied via CSS on the parent wrap.
 */
(function () {
  const svg = document.getElementById("vas-c");
  const svgFront = document.getElementById("vas-c-front");
  if (!svg || svg.namespaceURI !== "http://www.w3.org/2000/svg") return;

  const FAL_BASE = {
    bgA: "#f5f4f0",
    bgB: "#181818",
    families: [
      [
        "#EDE7FF",
        "#D5BBFF",
        "#C094FF",
        "#AB77FF",
        "#8539CF",
        "#5718C0",
        "#3A0F82",
        "#1A0740",
      ],
      [
        "#E2F4FF",
        "#C5E9FF",
        "#7FCDFE",
        "#3FB5FE",
        "#2889F9",
        "#115EF3",
        "#0B3FA8",
        "#041E52",
      ],
      [
        "#F4F7F5",
        "#E5ECE7",
        "#BDF3FB",
        "#99EDFF",
        "#8EC5C8",
        "#98AFAC",
        "#6E8582",
        "#2D3937",
      ],
      [
        "#FBFFF0",
        "#F1FFD2",
        "#D9FF7A",
        "#ADFF00",
        "#7AD420",
        "#298020",
        "#004012",
        "#001A07",
      ],
      [
        "#EFEDE6",
        "#D9D7CC",
        "#EDE88A",
        "#FFFF66",
        "#FFFF00",
        "#9E8B24",
        "#403700",
        "#181400",
      ],
      [
        "#FFF0F5",
        "#FFC4D8",
        "#FFB2D0",
        "#F57EC3",
        "#F14B8A",
        "#EC0649",
        "#A80433",
        "#4E0118",
      ],
    ],
  };

  let FAL_PALETTE_META = [{ id: "fal", label: "fal brand" }];

  function clonePal(p) {
    return { bgA: p.bgA, bgB: p.bgB, families: p.families.map((f) => f.slice()) };
  }

  function rotFams(fams, n) {
    const a = fams.map((f) => f.slice());
    const k = ((n % a.length) + a.length) % a.length;
    return a.slice(k).concat(a.slice(0, k));
  }

  function pickFams(fams, idxs) {
    return idxs.map((i) => fams[i % fams.length].slice());
  }

  function revFams(fams) {
    return fams.map((f) => f.slice().reverse());
  }

  function sliceFams(fams, start, len) {
    return fams.map((f) => {
      const s = f.slice(start, start + len);
      return s.length >= 5 ? s : f.slice(0, 5);
    });
  }

  function buildFalPalettes() {
    const F = FAL_BASE.families;
    const fam = (...idxs) => pickFams(F, idxs);
    const palettes = { fal: clonePal(FAL_BASE) };
    FAL_PALETTE_META = [{ id: "fal", label: "fal brand" }];

    const add = (id, label, spec) => {
      palettes[id] = {
        bgA: spec.bgA ?? FAL_BASE.bgA,
        bgB: spec.bgB ?? FAL_BASE.bgB,
        families: spec.families,
      };
      FAL_PALETTE_META.push({ id, label });
    };

    add("fal_azure", "fal · Azure wave", { bgA: F[1][0], bgB: F[1][7], families: fam(1, 2, 1, 0, 2, 5) });
    add("fal_violet", "fal · Violet core", { bgA: F[0][0], bgB: F[0][7], families: fam(0, 0, 1, 5, 0, 2) });
    add("fal_lime", "fal · Lime pulse", { bgA: F[3][0], bgB: F[3][7], families: fam(3, 3, 4, 1, 3, 0) });
    add("fal_gold", "fal · Gold field", { bgA: F[4][0], bgB: F[4][7], families: fam(4, 4, 3, 5, 4, 2) });
    add("fal_rose", "fal · Rose bloom", { bgA: F[5][0], bgB: F[5][7], families: fam(5, 5, 4, 0, 5, 1) });
    add("fal_sage", "fal · Sage mist", { bgA: F[2][1], bgB: F[2][7], families: fam(2, 2, 1, 3, 2, 4) });
    add("fal_cool", "fal · Cool spectrum", { bgA: F[2][0], bgB: F[0][7], families: fam(0, 1, 2, 0, 1, 2) });
    add("fal_warm", "fal · Warm spectrum", { bgA: F[4][0], bgB: F[5][7], families: fam(3, 4, 5, 3, 4, 5) });
    add("fal_pastel", "fal · Pastel drift", { bgA: FAL_BASE.bgA, bgB: F[0][5], families: sliceFams(F, 0, 5) });
    add("fal_deep", "fal · Deep ink", { bgA: F[2][2], bgB: FAL_BASE.bgB, families: sliceFams(F, 3, 5) });
    add("fal_reversed", "fal · Reversed ramps", { families: revFams(F.map((f) => f.slice())) });
    add("fal_shift_1", "fal · Family shift +1", { families: rotFams(F.map((f) => f.slice()), 1) });
    add("fal_shift_2", "fal · Family shift +2", { families: rotFams(F.map((f) => f.slice()), 2) });
    add("fal_shift_3", "fal · Family shift +3", { families: rotFams(F.map((f) => f.slice()), 3) });
    add("fal_prism", "fal · Prism", { bgA: F[0][1], bgB: F[1][7], families: fam(0, 1, 3, 4, 5, 2) });
    add("fal_cream", "fal · Soft cream", { bgA: F[2][1], bgB: F[4][6], families: fam(4, 2, 0, 4, 2, 5) });
    add("fal_midnight", "fal · Midnight", { bgA: F[0][6], bgB: F[1][7], families: fam(0, 1, 0, 5, 1, 2) });
    add("fal_electric", "fal · Electric", {
      bgA: F[1][2],
      bgB: F[3][6],
      families: revFams(fam(1, 3, 1, 3, 0, 5)),
    });
    add("fal_bloom", "fal · Bloom", { bgA: F[5][1], bgB: F[4][5], families: fam(5, 4, 5, 2, 4, 0) });
    add("fal_dusk", "fal · Dusk", { bgA: F[0][2], bgB: F[5][7], families: fam(5, 0, 5, 1, 0, 2) });

    return palettes;
  }

  const PALETTES = buildFalPalettes();

  const FAL_FLAT = [...new Set(FAL_BASE.families.flat().concat(["#000000", "#FFFFFF"]))];

  function pickMetaStroke(metaStroke, fam, ch, metaColor, cri) {
    switch (metaStroke) {
      case "ends":
        return fam[[0, 4, 3][ch % 3]];
      case "deep":
        return fam[0];
      case "mix_deep": {
        const opts = [0, 3, 4].filter((i) => i < fam.length);
        return fam[opts[cri(0, opts.length - 1)]];
      }
      case "family_random":
        return fam[cri(0, fam.length - 1)];
      case "all_swatches":
        return FAL_FLAT[cri(0, FAL_FLAT.length - 1)];
      case "black":
        return "#000000";
      case "legacy_mid":
        if (metaColor === "single") return fam[3];
        if (metaColor === "random") return fam[cri(2, 4)];
        return fam[3];
      default:
        return fam[0];
    }
  }

  function palettePreviewColors(pal) {
    const out = [pal.bgA];
    const fams = pal.families || [];
    const picks = fams.length <= 5 ? fams.map((_, i) => i) : [0, 1, 2, 4, 5].map((i) => i % fams.length);
    for (const i of picks) {
      const fam = fams[i];
      if (!fam?.length) continue;
      const mid = fam[Math.floor(fam.length / 2)];
      if (mid && mid.toLowerCase() !== out[out.length - 1]?.toLowerCase()) out.push(mid);
    }
    if (pal.bgB && pal.bgB.toLowerCase() !== out[out.length - 1]?.toLowerCase()) out.push(pal.bgB);
    return out.slice(0, 7);
  }

  function syncCanvasPaletteActive(id) {
    const list = document.getElementById("canvas-palette-list");
    if (!list) return;
    list.querySelectorAll(".palette-option").forEach((btn) => {
      const on = btn.dataset.paletteId === id;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function populateCanvasPalette() {
    const list = document.getElementById("canvas-palette-list");
    const sel = document.getElementById("vaz-palette");
    if (!list || !sel) return;
    const cur = sel.value;
    list.innerHTML = "";
    for (const { id, label } of FAL_PALETTE_META) {
      const pal = PALETTES[id];
      if (!pal) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "palette-option" + (id === cur ? " is-active" : "");
      btn.dataset.paletteId = id;
      btn.title = label;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-label", label);
      btn.setAttribute("aria-selected", id === cur ? "true" : "false");

      const swatches = document.createElement("span");
      swatches.className = "palette-swatches";
      swatches.setAttribute("aria-hidden", "true");
      for (const c of palettePreviewColors(pal)) {
        const s = document.createElement("span");
        s.className = "palette-swatch";
        s.style.backgroundColor = c;
        swatches.appendChild(s);
      }
      btn.appendChild(swatches);

      const lab = document.createElement("span");
      lab.className = "palette-label";
      lab.textContent = label.replace(/^fal · /, "");
      btn.appendChild(lab);

      btn.addEventListener("click", () => {
        if (sel.value === id) return;
        sel.value = id;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      });
      list.appendChild(btn);
    }
  }

  function populatePaletteSelect() {
    const sel = document.getElementById("vaz-palette");
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = "";
    for (const { id, label } of FAL_PALETTE_META) {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = label;
      sel.appendChild(o);
    }
    const ok = FAL_PALETTE_META.some((m) => m.id === cur);
    sel.value = ok ? cur : "fal";
    populateCanvasPalette();
    syncCanvasPaletteActive(sel.value);
  }

  let rng = 1;
  function seedRng(s) {
    rng = (s >>> 0) || 1;
  }
  function rand() {
    rng ^= rng << 13;
    rng ^= rng >> 17;
    rng ^= rng << 5;
    return (rng >>> 0) / 4294967296;
  }
  function rr(a, b) {
    return a + rand() * (b - a);
  }
  function ri(a, b) {
    return Math.floor(rr(a, b + 0.9999));
  }

  const _cc = {};
  const _tc = document.createElement("canvas");
  _tc.width = _tc.height = 1;
  const _tx = _tc.getContext("2d");
  function parseColor(c) {
    if (_cc[c]) return _cc[c];
    _tx.clearRect(0, 0, 1, 1);
    _tx.fillStyle = c;
    _tx.fillRect(0, 0, 1, 1);
    const d = _tx.getImageData(0, 0, 1, 1).data;
    return (_cc[c] = [d[0], d[1], d[2]]);
  }
  function lerpColor(ca, cb, t) {
    const a = parseColor(ca),
      b = parseColor(cb);
    return `rgb(${Math.round(a[0] + t * (b[0] - a[0]))},${Math.round(a[1] + t * (b[1] - a[1]))},${Math.round(
      a[2] + t * (b[2] - a[2])
    )})`;
  }

  let currentSeed = (Date.now() & 0xffffff) >>> 0;

  function readNum(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const n = parseFloat(el.value, 10);
    return Number.isFinite(n) ? n : fallback;
  }
  function readInt(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const n = parseInt(el.value, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  /** Stable [0,1) per cell; does not advance main blob RNG. */
  function cellHash01(col, row, salt) {
    let h = (currentSeed + (salt >>> 0)) >>> 0;
    h = Math.imul(h ^ col, 0x85ebca6b);
    h = Math.imul(h ^ row, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function pickDotFront(col, row, infl, frontPct, frontBias) {
    const f = Math.max(0, Math.min(1, frontPct / 100));
    const b = Math.max(0, Math.min(1, frontBias / 100));
    if (f <= 0 && b <= 0) return false;
    const u = cellHash01(col, row, 0x46524e54);
    const t = Math.min(1, f + b * infl * 0.52);
    return u < t;
  }

  function applyRunoff(x, y, cx, cy, W, H, runoffPct) {
    const k = (runoffPct / 100) * Math.min(W, H) * 0.045;
    if (k < 1e-6) return { x, y };
    const dx = x - cx,
      dy = y - cy;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return { x, y };
    return { x: x + (dx / len) * k, y: y + (dy / len) * k };
  }

  function dotSvgFragment(px, py, rx, ry, angRad, fill, fmtFn) {
    const deg = ((angRad * 180) / Math.PI).toFixed(2);
    if (Math.abs(angRad) < 1e-8) {
      return `<ellipse cx="${fmtFn(px)}" cy="${fmtFn(py)}" rx="${fmtFn(rx)}" ry="${fmtFn(ry)}" fill="${fill}"/>`;
    }
    return `<g transform="translate(${fmtFn(px)},${fmtFn(py)}) rotate(${deg})"><ellipse cx="0" cy="0" rx="${fmtFn(rx)}" ry="${fmtFn(
      ry
    )}" fill="${fill}"/></g>`;
  }

  function draw(newSeed) {
    if (newSeed !== undefined) currentSeed = newSeed >>> 0;
    seedRng(currentSeed);

    const COLS = readInt("vaz-cols", 8);
    const ROWS = readInt("vaz-rows", 8);
    const CS = readInt("vaz-cell", 128);
    const bCount = readInt("vaz-blobs", 4);
    const rMin = readNum("vaz-rmin", 0.16);
    const rMax = readNum("vaz-rmax", 0.36);
    const shape = readNum("vaz-shape", 1);
    const soft = readNum("vaz-soft", 2.2);
    const mCount = readInt("vaz-mega", 2);
    const megaScale = readNum("vaz-megascale", 0.52);
    const megaLobes = readInt("vaz-lobes", 4);
    const lobeScatter = readNum("vaz-lscatter", 0.55);
    const megaShape = readNum("vaz-megashape", 1);
    const dotMax = readNum("vaz-dotmax", 0.82);
    const dotMin = readNum("vaz-dotmin", 0.05);
    const cVar = readNum("vaz-cvar", 0.65);
    const palName = (document.getElementById("vaz-palette") || {}).value || "fal";
    const checkerStyle = (document.getElementById("vaz-checker") || {}).value || "light";
    const checkerGrid = document.getElementById("vaz-checker-grid")?.checked === true;
    const checkerVar = readNum("vaz-checkervar", 0.12);
    const warpType = (document.getElementById("vaz-warp") || {}).value || "none";
    const warpStr = readNum("vaz-warpstr", 0.45);
    const warpCX = readNum("vaz-warpcx", 0.5);
    const warpCY = readNum("vaz-warpcy", 0.5);
    const warpSize = readNum("vaz-warpsz", 0.45);
    const compBulge = readNum("vaz-bulge", 0);
    const frontPct = readNum("vaz-front-pct", 0);
    const frontBias = readNum("vaz-front-bias", 0);
    const frontRunoff = readNum("vaz-front-runoff", 0);
    const metaMode = (document.getElementById("vaz-meta-mode") || {}).value || "off";
    const metaChains = readInt("vaz-meta-chains", 2);
    const metaNodes = readInt("vaz-meta-nodes", 8);
    const metaSize = readNum("vaz-meta-size", 0.04);
    const metaSVar = readNum("vaz-meta-svar", 0.6);
    const metaStep = readNum("vaz-meta-step", 0.07);
    const metaRing = readNum("vaz-meta-ring", 0.85);
    const metaOpacity = readNum("vaz-meta-opacity", 1);
    const metaDrift = readNum("vaz-meta-drift", 0.12);
    const metaPulse = readNum("vaz-meta-pulse", 0.11);
    const metaFlow = readNum("vaz-meta-flow", 0.14);
    const metaColor = (document.getElementById("vaz-meta-color") || {}).value || "pal";
    const metaStroke = (document.getElementById("vaz-meta-stroke") || {}).value || "mix_deep";

    const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2);
    const S = window.WorldSpinnerSphere;
    const animTime =
      S && typeof S.getAnimTimeSec === "function" ? S.getAnimTimeSec() : performance.now() / 1000;
    const sphereMap =
      S &&
      typeof S.projectPatchPoint === "function" &&
      document.getElementById("vaz-sphere")?.checked !== false;

    const pal = PALETTES[palName] || PALETTES.fal;

    let bgA = pal.bgA,
      bgB = pal.bgB;
    if (checkerStyle === "bw") {
      bgA = "#f2f2ee";
      bgB = "#141414";
    }
    if (checkerStyle === "dark") {
      bgA = "#1c1c1c";
      bgB = "#0a0a0a";
    }
    if (checkerStyle === "light") {
      bgA = "#f8f8f4";
      bgB = "#e4e4de";
    }
    if (checkerStyle === "color") {
      const f = pal.families[0];
      bgA = lerpColor(f[0], "#ffffff", 0.4);
      bgB = lerpColor(f[f.length - 1], "#000000", 0.4);
    }

    const exportBg = S?.getSphereInteriorColors?.();
    if (exportBg?.colorA) {
      bgA = exportBg.colorA;
      bgB = exportBg.colorB || exportBg.colorA;
    }

    const blobs = [];
    for (let i = 0; i < bCount; i++) {
      const famIdx =
        blobs.length === 0 || rand() < cVar ? ri(0, pal.families.length - 1) : blobs[ri(0, blobs.length - 1)].famIdx;
      blobs.push({
        cx: rr(0.04, 0.96),
        cy: rr(0.04, 0.96),
        r: rr(rMin, rMax),
        famIdx,
        stretch: rr(0.75, 1.35),
        angle: rr(0, Math.PI),
      });
    }

    const megaBlobs = [];
    for (let m = 0; m < mCount; m++) {
      const ax = rr(0.1, 0.9),
        ay = rr(0.1, 0.9);
      const famIdx = ri(0, pal.families.length - 1);
      for (let l = 0; l < megaLobes; l++) {
        const a = (l / megaLobes) * Math.PI * 2 + rr(-0.4, 0.4);
        const dist = rr(0, lobeScatter * megaScale * 0.8);
        megaBlobs.push({
          cx: ax + Math.cos(a) * dist,
          cy: ay + Math.sin(a) * dist,
          r: megaScale * rr(0.55, 1.0),
          famIdx,
          stretch: rr(0.7, 1.4),
          angle: rr(0, Math.PI),
          isMega: true,
        });
      }
    }

    const allUnits = blobs.concat(megaBlobs);

    function unitInfluence(b, nx, ny) {
      const dx = nx - b.cx,
        dy = ny - b.cy;
      const cos = Math.cos(b.angle),
        sin = Math.sin(b.angle);
      const lx = (dx * cos + dy * sin) / (b.r * b.stretch);
      const ly = (-dx * sin + dy * cos) / (b.r / b.stretch);
      const s = b.isMega ? megaShape : shape;
      const dSup = Math.pow(Math.pow(Math.abs(lx), s * 2) + Math.pow(Math.abs(ly), s * 2), 1 / (s * 2));
      return Math.max(0, 1 - Math.pow(dSup, soft));
    }
    function inflToColor(infl, family) {
      const fPos = (1 - infl) * (family.length - 1);
      const fLo = Math.floor(fPos);
      const fHi = Math.min(family.length - 1, fLo + 1);
      return lerpColor(family[fHi], family[fLo], fPos - fLo);
    }

    const Wflat = COLS * CS;
    const Hflat = ROWS * CS;

    function compWarp(nx, ny) {
      if (compBulge === 0) return { px: nx * Wflat, py: ny * Hflat };
      const dx = nx - warpCX,
        dy = ny - warpCY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.0001) return { px: nx * Wflat, py: ny * Hflat };
      const maxDist = Math.sqrt(warpCX * warpCX + warpCY * warpCY) * 1.2 + 0.01;
      const t = dist / maxDist;
      let r2;
      if (compBulge > 0) r2 = dist * (1 + compBulge * t * t * 2.2);
      else r2 = Math.max(0, dist * (1 + compBulge * t * 1.8));
      const scale = r2 / dist;
      const wx = warpCX + dx * scale,
        wy = warpCY + dy * scale;
      return { px: wx * Wflat, py: wy * Hflat };
    }

    /** Composition bulge only: fixed anchor at patch center (0.5,0.5) — matches sphere focus. */
    function compWarpNuNv(nu, nv) {
      if (compBulge === 0) return { nu, nv };
      const bx = 0.5,
        by = 0.5;
      const dx = nu - bx,
        dy = nv - by;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.0001) return { nu, nv };
      const maxDist = Math.sqrt(bx * bx + by * by) * 1.2 + 0.01;
      const t = dist / maxDist;
      let r2;
      if (compBulge > 0) r2 = dist * (1 + compBulge * t * t * 2.2);
      else r2 = Math.max(0, dist * (1 + compBulge * t * 1.8));
      const fac = r2 / dist;
      return { nu: bx + dx * fac, nv: by + dy * fac };
    }

    function warpCore(nx, ny, cx, cy) {
      if (warpType === "none") return { sx: 1, sy: 1, ang: 0, sz: 1 };
      const dx0 = nx - cx,
        dy0 = ny - cy;
      const dist = Math.hypot(dx0, dy0);
      const ang = Math.atan2(dy0, dx0);
      let sx = 1,
        sy = 1,
        dotAng = 0,
        sz = 1;
      switch (warpType) {
        case "bulge": {
          const falloff = Math.exp(-dist * dist * 2.5);
          sx = 1 + warpStr * falloff * 3.5;
          sy = Math.max(0.05, 1 - warpStr * falloff * 1.2);
          dotAng = ang;
          sz = 1 + warpSize * falloff * 3.0;
          break;
        }
        case "tunnel": {
          sx = 1 + warpStr * dist * 1.5;
          sy = Math.max(0.15, 1 - warpStr * dist * 0.4);
          dotAng = ang;
          sz = Math.max(0.2, 1 - warpSize * dist * 1.8);
          break;
        }
        case "wave_h": {
          const wave = Math.sin(ny * Math.PI * 3 + nx * Math.PI);
          sx = 1 + warpStr * wave * 0.8;
          sy = 1 - warpStr * wave * 0.5;
          sz = 1 + warpSize * Math.abs(wave) * 0.6;
          dotAng = warpStr * wave * 0.4;
          break;
        }
        case "wave_v": {
          const wave = Math.sin(nx * Math.PI * 3 + ny * Math.PI);
          sx = 1 - warpStr * wave * 0.5;
          sy = 1 + warpStr * wave * 0.8;
          sz = 1 + warpSize * Math.abs(wave) * 0.6;
          dotAng = warpStr * wave * 0.4;
          break;
        }
        case "saddle": {
          const sdx = nx - cx,
            sdy = ny - cy;
          sx = 1 + warpStr * sdy * sdy * 3;
          sy = 1 + warpStr * sdx * sdx * 3;
          sz = Math.max(0.15, 1 - warpSize * dist * dist * 2);
          dotAng = warpStr * sdx * sdy * 1.5;
          break;
        }
        default:
          break;
      }
      return { sx: Math.max(0.1, sx), sy: Math.max(0.1, sy), ang: dotAng, sz: Math.max(0.1, sz) };
    }

    function warpAt(nx, ny) {
      let w = warpCore(nx, ny, warpCX, warpCY);
      w.sx = Math.max(0.08, w.sx);
      w.sy = Math.max(0.08, w.sy);
      w.sz = Math.max(0.08, w.sz);
      return w;
    }

    const cellScale = new Float32Array(ROWS * COLS);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const v = checkerVar > 0 ? rr(1 - checkerVar * 0.7, 1 + checkerVar * 0.7) : 1.0;
        cellScale[row * COLS + col] = Math.max(0.15, v);
      }
    }

    let checkerEls;
    let dotElsBack = [];
    let dotElsFront = [];
    let canvasW = Wflat;
    let projectNuNv = (nu, nv) => {
      const { px, py } = compWarp(nu, nv);
      return { x: px, y: py, scale: 1 };
    };
    const drawDots = metaMode !== "replace";

    if (sphereMap) {
      const { w: WW, h: HH } = S.getWrapSize();
      canvasW = WW;
      const { cx, cy } = S.layoutMetrics(WW, HH);
      const spin = S.getSpin();
      const s0 = Math.max(S.projectPatchPoint(0, 0, spin)?.scale || 1, 1e-6);
      const fSc =
        typeof S.getFieldScales === "function" ? S.getFieldScales() : { radial: 1, element: 1 };
      const frs = Number.isFinite(fSc.radial) ? fSc.radial : 1;
      const fes = Number.isFinite(fSc.element) ? fSc.element : 1;

      function toScreen(nu, nv) {
        const { nu: nw, nv: vw } = compWarpNuNv(nu, nv);
        const nx = 2 * nw - 1;
        const ny = 2 * vw - 1;
        const pr = S.projectPatchPoint(nx, ny, spin);
        if (!pr) return null;
        return { x: cx + pr.sx * frs, y: cy + pr.sy * frs, scale: pr.scale };
      }

      projectNuNv = (nu, nv) => {
        const p = toScreen(nu, nv);
        if (!p) return null;
        return { x: p.x, y: p.y, scale: (p.scale / s0) * fes };
      };

      svg.setAttribute("viewBox", `0 0 ${WW} ${HH}`);
      svg.setAttribute("width", String(WW));
      svg.setAttribute("height", String(HH));

      checkerEls = [`<rect width="${WW}" height="${HH}" fill="${bgA}"/>`];
      if (checkerGrid) {
        for (let row = 0; row < ROWS; row++) {
          for (let col = 0; col < COLS; col++) {
            const sc = cellScale[row * COLS + col];
            const fill = (row + col) % 2 === 0 ? bgA : bgB;
            const nuC = (col + 0.5) / COLS,
              nvC = (row + 0.5) / ROWS;
            const du = (0.5 * sc) / COLS,
              dv = (0.5 * sc) / ROWS;
            const corners = [
              [nuC - du, nvC - dv],
              [nuC + du, nvC - dv],
              [nuC + du, nvC + dv],
              [nuC - du, nvC + dv],
            ];
            const cornerPts = [];
            let bad = false;
            for (let i = 0; i < 4; i++) {
              const p = toScreen(corners[i][0], corners[i][1]);
              if (!p) {
                bad = true;
                break;
              }
              cornerPts.push([p.x, p.y]);
            }
            if (bad) continue;
            const mx = cornerPts.reduce((a, c) => a + c[0], 0) / 4;
            const my = cornerPts.reduce((a, c) => a + c[1], 0) / 4;
            const ptsStr = cornerPts
              .map(([px, py]) => {
                const x = mx + (px - mx) * fes;
                const y = my + (py - my) * fes;
                return `${fmt(x)},${fmt(y)}`;
              })
              .join(" ");
            checkerEls.push(`<polygon points="${ptsStr}" fill="${fill}"/>`);
          }
        }
      }

      if (drawDots) {
      for (const unit of allUnits) {
        const family = pal.families[unit.famIdx];
        const pad = unit.r * Math.max(unit.stretch, 1 / unit.stretch) * 1.6;
        const c0 = Math.max(0, Math.floor((unit.cx - pad) * COLS));
        const c1 = Math.min(COLS - 1, Math.ceil((unit.cx + pad) * COLS));
        const r0 = Math.max(0, Math.floor((unit.cy - pad) * ROWS));
        const r1 = Math.min(ROWS - 1, Math.ceil((unit.cy + pad) * ROWS));
        for (let row = r0; row <= r1; row++) {
          for (let col = c0; col <= c1; col++) {
            const nu = (col + 0.5) / COLS,
              nv = (row + 0.5) / ROWS;
            const infl = unitInfluence(unit, nu, nv);
            if (infl < 0.006) continue;
            let baseR = CS * 0.5 * (dotMin + (dotMax - dotMin) * infl);
            if (baseR < 0.4) continue;
            const fill = inflToColor(infl, family);
            const p = toScreen(nu, nv);
            if (!p) continue;
            const w = warpAt(nu, nv);
            const px = p.scale / s0;
            const rx = baseR * px * w.sz * w.sx * fes;
            const ry = baseR * px * w.sz * w.sy * fes;
            const isFront = pickDotFront(col, row, infl, frontPct, frontBias);
            let qx = p.x,
              qy = p.y;
            if (isFront && frontRunoff > 0) {
              const rr = applyRunoff(p.x, p.y, cx, cy, WW, HH, frontRunoff);
              qx = rr.x;
              qy = rr.y;
            }
            const frag = dotSvgFragment(qx, qy, rx, ry, w.ang, fill, fmt);
            if (isFront) dotElsFront.push(frag);
            else dotElsBack.push(frag);
          }
        }
      }
      }

      const out = document.getElementById("vaz-grid-out");
      if (out) out.textContent = `${WW}×${HH} · sphere patch`;
    } else {
      svg.setAttribute("viewBox", `0 0 ${Wflat} ${Hflat}`);
      svg.setAttribute("width", String(Wflat));
      svg.setAttribute("height", String(Hflat));

      const skipFlatMatte = !sphereMap && S?.isExportTransparentBg?.();
      checkerEls = skipFlatMatte ? [] : [`<rect width="${Wflat}" height="${Hflat}" fill="${bgA}"/>`];
      if (checkerGrid) {
        for (let row = 0; row < ROWS; row++) {
          for (let col = 0; col < COLS; col++) {
            const sc = cellScale[row * COLS + col];
            const fill = (row + col) % 2 === 0 ? bgA : bgB;
            const nx = (col + 0.5) / COLS,
              ny = (row + 0.5) / ROWS;
            const { px, py } = compWarp(nx, ny);
            const cw = CS * sc,
              ch = CS * sc;
            const x = px - cw / 2,
              y = py - ch / 2;
            checkerEls.push(
              `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(cw)}" height="${fmt(ch)}" fill="${fill}"/>`
            );
          }
        }
      }

      if (drawDots) {
      for (const unit of allUnits) {
        const family = pal.families[unit.famIdx];
        const pad = unit.r * Math.max(unit.stretch, 1 / unit.stretch) * 1.6;
        const c0 = Math.max(0, Math.floor((unit.cx - pad) * COLS));
        const c1 = Math.min(COLS - 1, Math.ceil((unit.cx + pad) * COLS));
        const r0 = Math.max(0, Math.floor((unit.cy - pad) * ROWS));
        const r1 = Math.min(ROWS - 1, Math.ceil((unit.cy + pad) * ROWS));
        for (let row = r0; row <= r1; row++) {
          for (let col = c0; col <= c1; col++) {
            const nx = (col + 0.5) / COLS,
              ny = (row + 0.5) / ROWS;
            const infl = unitInfluence(unit, nx, ny);
            if (infl < 0.006) continue;
            let baseR = CS * 0.5 * (dotMin + (dotMax - dotMin) * infl);
            if (baseR < 0.4) continue;
            const fill = inflToColor(infl, family);
            const { px, py } = compWarp(nx, ny);
            const w = warpAt(nx, ny);
            const rx = baseR * w.sz * w.sx;
            const ry = baseR * w.sz * w.sy;
            const isFront = pickDotFront(col, row, infl, frontPct, frontBias);
            const fcx = Wflat * 0.5,
              fcy = Hflat * 0.5;
            let qx = px,
              qy = py;
            if (isFront && frontRunoff > 0) {
              const rr = applyRunoff(px, py, fcx, fcy, Wflat, Hflat, frontRunoff);
              qx = rr.x;
              qy = rr.y;
            }
            const frag = dotSvgFragment(qx, qy, rx, ry, w.ang, fill, fmt);
            if (isFront) dotElsFront.push(frag);
            else dotElsBack.push(frag);
          }
        }
      }
      }

      const out = document.getElementById("vaz-grid-out");
      if (out) out.textContent = `${Wflat} × ${Hflat} · flat`;
    }

    let metaEls = [];
    if (metaMode !== "off") {
      let cr = (currentSeed ^ 0xdead) >>> 0 || 1;
      function crand() {
        cr ^= cr << 13;
        cr ^= cr >> 17;
        cr ^= cr << 5;
        return (cr >>> 0) / 4294967296;
      }
      function crr(a, b) {
        return a + crand() * (b - a);
      }
      function cri(a, b) {
        return Math.floor(crr(a, b + 0.9999));
      }

      const ringFill = "#FFFFFF";
      for (let ch = 0; ch < metaChains; ch++) {
        let fam;
        if (metaColor === "single") fam = pal.families[0];
        else if (metaColor === "random") fam = pal.families[cri(0, pal.families.length - 1)];
        else fam = pal.families[ch % pal.families.length];
        const fillColor = metaColor === "random" ? fam[cri(0, 2)] : fam[1];
        const strokeColor = pickMetaStroke(metaStroke, fam, ch, metaColor, cri);

        let nu = crr(0.05, 0.95);
        let nv = crr(0.05, 0.95);
        let angle = crr(0, Math.PI * 2) + animTime * metaFlow * 0.35;

        for (let n = 0; n < metaNodes; n++) {
          const phase = crr(0, Math.PI * 2);
          let r = metaSize * canvasW * (1 + crr(-metaSVar * 0.6, metaSVar * 0.8));
          if (metaPulse > 0) r *= 1 + Math.sin(animTime * metaPulse * 2.2 + phase) * 0.16;
          const isRing = crand() < metaRing;

          let qNu = nu;
          let qNv = nv;
          if (metaDrift > 0) {
            const amp = metaStep * 0.28 * metaDrift;
            qNu += Math.sin(animTime * metaDrift * 1.3 + phase) * amp;
            qNv += Math.cos(animTime * metaDrift * 1.1 + phase * 1.7) * amp;
          }

          const pr = projectNuNv(qNu, qNv);
          if (pr) {
            const nr = Math.max(2, r * (pr.scale ?? 1));
            if (isRing) {
              const lw = Math.max(1, nr * 0.28);
              metaEls.push(
                `<circle cx="${fmt(pr.x)}" cy="${fmt(pr.y)}" r="${fmt(nr)}" fill="${ringFill}" stroke="${strokeColor}" stroke-width="${fmt(lw)}"/>`
              );
            } else {
              metaEls.push(`<circle cx="${fmt(pr.x)}" cy="${fmt(pr.y)}" r="${fmt(nr)}" fill="${fillColor}"/>`);
            }
          }

          angle += crr(-0.9, 0.9);
          const dist = metaStep * crr(0.7, 1.4);
          nu += Math.cos(angle) * dist;
          nv += Math.sin(angle) * dist;
          nu = Math.max(0.02, Math.min(0.98, nu));
          nv = Math.max(0.02, Math.min(0.98, nv));
        }
      }
      if (metaEls.length && metaOpacity < 1) {
        metaEls = [`<g opacity="${metaOpacity.toFixed(3)}">${metaEls.join("")}</g>`];
      }
    }

    let backJoin = dotElsBack;
    let frontJoin = dotElsFront;
    if (metaMode === "over" || metaMode === "replace") {
      frontJoin = frontJoin.concat(metaEls);
    }
    if (!svgFront || (frontPct <= 0 && frontBias <= 0 && metaMode === "off")) {
      backJoin = dotElsBack.concat(dotElsFront);
      frontJoin = [];
    }

    svg.innerHTML =
      `<g shape-rendering="crispEdges">${checkerEls.join("")}</g>` +
      `<g shape-rendering="geometricPrecision">${backJoin.join("")}</g>`;

    if (svgFront && svgFront.namespaceURI === "http://www.w3.org/2000/svg") {
      const vb = svg.getAttribute("viewBox") || "0 0 1 1";
      const sw = svg.getAttribute("width") || "1";
      const sh = svg.getAttribute("height") || "1";
      svgFront.setAttribute("viewBox", vb);
      svgFront.setAttribute("width", sw);
      svgFront.setAttribute("height", sh);
      svgFront.innerHTML = frontJoin.length
        ? `<g shape-rendering="geometricPrecision">${frontJoin.join("")}</g>`
        : "";
    }

    if (typeof window.onVasarelyFrame === "function") window.onVasarelyFrame();
  }

  const SLIDER_MAP = {
    "vaz-cols": "vaz-v-cols",
    "vaz-rows": "vaz-v-rows",
    "vaz-cell": "vaz-v-cell",
    "vaz-checkervar": "vaz-v-checkervar",
    "vaz-blobs": "vaz-v-blobs",
    "vaz-rmin": "vaz-v-rmin",
    "vaz-rmax": "vaz-v-rmax",
    "vaz-shape": "vaz-v-shape",
    "vaz-soft": "vaz-v-soft",
    "vaz-mega": "vaz-v-mega",
    "vaz-megascale": "vaz-v-megascale",
    "vaz-lobes": "vaz-v-lobes",
    "vaz-lscatter": "vaz-v-lscatter",
    "vaz-megashape": "vaz-v-megashape",
    "vaz-dotmax": "vaz-v-dotmax",
    "vaz-dotmin": "vaz-v-dotmin",
    "vaz-cvar": "vaz-v-cvar",
    "vaz-warpstr": "vaz-v-warpstr",
    "vaz-warpcx": "vaz-v-warpcx",
    "vaz-warpcy": "vaz-v-warpcy",
    "vaz-warpsz": "vaz-v-warpsz",
    "vaz-bulge": "vaz-v-bulge",
    "vaz-front-pct": "vaz-v-front-pct",
    "vaz-front-bias": "vaz-v-front-bias",
    "vaz-front-runoff": "vaz-v-front-runoff",
    "vaz-meta-chains": "vaz-v-meta-chains",
    "vaz-meta-nodes": "vaz-v-meta-nodes",
    "vaz-meta-size": "vaz-v-meta-size",
    "vaz-meta-svar": "vaz-v-meta-svar",
    "vaz-meta-step": "vaz-v-meta-step",
    "vaz-meta-ring": "vaz-v-meta-ring",
    "vaz-meta-opacity": "vaz-v-meta-opacity",
    "vaz-meta-drift": "vaz-v-meta-drift",
    "vaz-meta-pulse": "vaz-v-meta-pulse",
    "vaz-meta-flow": "vaz-v-meta-flow",
  };

  function syncLabel(sliderId) {
    const el = document.getElementById(sliderId);
    const lid = SLIDER_MAP[sliderId];
    const vl = lid ? document.getElementById(lid) : null;
    if (!el || !vl) return;
    const step = parseFloat(el.step);
    vl.textContent = parseFloat(el.value).toFixed(step > 0 && step < 1 ? 2 : 0);
  }

  const LS_VAS_LOCAL = "world-spinner-vasarely-local";
  const VAS_SNAPSHOT_V = 3;
  let persistVasTimer = 0;

  function captureLocalSnapshot() {
    const snap = { v: VAS_SNAPSHOT_V, seed: currentSeed };
    for (const id of Object.keys(SLIDER_MAP)) {
      const el = document.getElementById(id);
      if (el && "value" in el) snap[id] = el.value;
    }
    for (const id of ["vaz-palette", "vaz-checker", "vaz-warp", "vaz-meta-mode", "vaz-meta-color", "vaz-meta-stroke"]) {
      const el = document.getElementById(id);
      if (el && "value" in el) snap[id] = el.value;
    }
    for (const id of ["vaz-sphere", "vaz-checker-grid"]) {
      const el = document.getElementById(id);
      if (el) snap[id] = !!el.checked;
    }
    for (const id of ["vaz-tw", "vaz-th", "vaz-tcell"]) {
      const el = document.getElementById(id);
      if (el && "value" in el) snap[id] = el.value;
    }
    return snap;
  }

  function applyLocalSnapshot(snap) {
    if (!snap || typeof snap !== "object") return false;
    const setIf = (id, val) => {
      const el = document.getElementById(id);
      if (!el || val === undefined) return;
      if (typeof val === "boolean" && "checked" in el) el.checked = val;
      else if ("value" in el) el.value = String(val);
    };

    Object.keys(SLIDER_MAP).forEach((id) => {
      if (snap[id] !== undefined) setIf(id, snap[id]);
    });
    ["vaz-palette", "vaz-checker", "vaz-warp", "vaz-meta-mode", "vaz-meta-color", "vaz-meta-stroke"].forEach((id) => {
      if (snap[id] !== undefined) setIf(id, snap[id]);
    });
    ["vaz-sphere", "vaz-checker-grid"].forEach((id) => {
      if (snap[id] !== undefined) setIf(id, snap[id]);
    });
    ["vaz-tw", "vaz-th", "vaz-tcell"].forEach((id) => {
      if (snap[id] !== undefined) setIf(id, snap[id]);
    });

    Object.keys(SLIDER_MAP).forEach(syncLabel);
    if (snap["vaz-palette"]) syncCanvasPaletteActive(snap["vaz-palette"]);

    let seed = currentSeed;
    if (typeof snap.seed === "number" && (snap.seed >>> 0) === snap.seed) seed = snap.seed >>> 0;
    draw(seed);
    return true;
  }

  function persistVasLocalNow() {
    persistVasTimer = 0;
    try {
      localStorage.setItem(LS_VAS_LOCAL, JSON.stringify(captureLocalSnapshot()));
    } catch (_) {}
  }

  function schedulePersistVasLocal() {
    clearTimeout(persistVasTimer);
    persistVasTimer = setTimeout(persistVasLocalNow, 160);
  }

  function restoreVasLocal() {
    let raw;
    try {
      raw = localStorage.getItem(LS_VAS_LOCAL);
    } catch (_) {
      return false;
    }
    if (!raw) return false;
    let snap;
    try {
      snap = JSON.parse(raw);
    } catch (_) {
      return false;
    }
    if (!snap || typeof snap !== "object") return false;
    if (snap.v !== undefined && snap.v !== VAS_SNAPSHOT_V) return false;

    const setIf = (id, val) => {
      if (val === undefined || val === null) return;
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === "checkbox") {
        el.checked = !!val;
        return;
      }
      if ("value" in el) el.value = String(val);
    };

    for (const id of Object.keys(SLIDER_MAP)) {
      if (snap[id] !== undefined) setIf(id, snap[id]);
    }
    ["vaz-palette", "vaz-checker", "vaz-warp", "vaz-meta-mode", "vaz-meta-color", "vaz-meta-stroke"].forEach((id) => {
      if (snap[id] !== undefined) {
        if (id === "vaz-palette" && !PALETTES[snap[id]]) setIf(id, "fal");
        else setIf(id, snap[id]);
      }
    });
    ["vaz-sphere", "vaz-checker-grid"].forEach((id) => {
      if (snap[id] !== undefined) setIf(id, snap[id]);
    });
    ["vaz-tw", "vaz-th", "vaz-tcell"].forEach((id) => {
      if (snap[id] !== undefined) setIf(id, snap[id]);
    });

    Object.keys(SLIDER_MAP).forEach(syncLabel);

    let seed = currentSeed;
    if (typeof snap.seed === "number" && (snap.seed >>> 0) === snap.seed) seed = snap.seed >>> 0;
    draw(seed);
    return true;
  }

  function wire() {
    populatePaletteSelect();
    document.getElementById("vaz-gen")?.addEventListener("click", () => {
      draw((Math.random() * 0xffffff) >>> 0);
      persistVasLocalNow();
    });
    document.getElementById("vaz-fit")?.addEventListener("click", () => {
      const tw = Math.max(32, parseInt(document.getElementById("vaz-tw")?.value, 10) || 1200);
      const th = Math.max(32, parseInt(document.getElementById("vaz-th")?.value, 10) || 1200);
      const want = Math.max(1, parseInt(document.getElementById("vaz-tcell")?.value, 10) || 1);
      let cols = Math.round(tw / want);
      let rows = Math.round(th / want);
      cols = Math.min(256, Math.max(8, cols));
      rows = Math.min(256, Math.max(8, rows));
      let cs = Math.round((tw / cols + th / rows) / 2);
      cs = Math.min(128, Math.max(4, cs));
      const ce = document.getElementById("vaz-cols");
      const re = document.getElementById("vaz-rows");
      const se = document.getElementById("vaz-cell");
      if (ce) ce.value = String(cols);
      if (re) re.value = String(rows);
      if (se) se.value = String(cs);
      Object.keys(SLIDER_MAP).forEach(syncLabel);
      draw();
      persistVasLocalNow();
    });

    Object.keys(SLIDER_MAP).forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", () => {
        syncLabel(id);
        draw();
        schedulePersistVasLocal();
      });
    });

    ["vaz-palette", "vaz-checker", "vaz-warp", "vaz-meta-mode", "vaz-meta-color", "vaz-meta-stroke"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => {
        if (id === "vaz-palette") syncCanvasPaletteActive(document.getElementById("vaz-palette")?.value || "fal");
        draw();
        schedulePersistVasLocal();
      });
    });
    document.getElementById("vaz-checker-grid")?.addEventListener("change", () => {
      draw();
      schedulePersistVasLocal();
    });
    document.getElementById("vaz-sphere")?.addEventListener("change", () => {
      draw();
      schedulePersistVasLocal();
      if (document.getElementById("vaz-sphere")?.checked === false && typeof window.onVasarelyFrame === "function") {
        window.onVasarelyFrame();
      }
    });

    if (!restoreVasLocal()) {
      Object.keys(SLIDER_MAP).forEach(syncLabel);
      draw(currentSeed);
    }
    syncCanvasPaletteActive(document.getElementById("vaz-palette")?.value || "fal");

    let metaAnimLast = 0;
    function metaAnimLoop(now) {
      requestAnimationFrame(metaAnimLoop);
      const mode = document.getElementById("vaz-meta-mode")?.value;
      if (mode === "off") return;
      const drift = readNum("vaz-meta-drift", 0);
      const pulse = readNum("vaz-meta-pulse", 0);
      const flow = readNum("vaz-meta-flow", 0);
      if (drift <= 0 && pulse <= 0 && flow <= 0) return;
      if (document.getElementById("vaz-sphere")?.checked !== false) return;
      if (now - metaAnimLast < 32) return;
      metaAnimLast = now;
      draw();
    }
    requestAnimationFrame(metaAnimLoop);
  }

  function getExportParts() {
    const gs = svg.querySelectorAll(":scope > g");
    return {
      checkerGroup: gs[0]?.outerHTML || "",
      halftoneBackGroup: gs[1]?.outerHTML || "",
      halftoneFrontFragment: svgFront?.innerHTML || "",
      viewBox: svg.getAttribute("viewBox") || "0 0 1 1",
      width: svg.getAttribute("width") || "1",
      height: svg.getAttribute("height") || "1",
    };
  }

  window.Vasarely = {
    draw,
    captureLocalSnapshot,
    applyLocalSnapshot,
    getSeed: () => currentSeed,
    setSeed: (s) => draw(s),
    /** Full SVG document string (same coordinate system as viewBox). */
    getSVGDocument: () => {
      const vb = svg.getAttribute("viewBox") || "0 0 1 1";
      const inner = svg.innerHTML;
      return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${svg.getAttribute("width") || 1}" height="${svg.getAttribute("height") || 1}">${inner}</svg>`;
    },
    /** Checker + back halftone + front halftone fragments for compositing (e.g. with type). */
    getExportParts,
    /** Back-layer halftone ellipses + front-layer ellipses only (no checker). */
    getHalftoneDotsSVGDocument: () => {
      const p = getExportParts();
      const front = p.halftoneFrontFragment
        ? `<g shape-rendering="geometricPrecision">${p.halftoneFrontFragment}</g>`
        : "";
      return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="${p.viewBox}" width="${p.width}" height="${p.height}">${p.halftoneBackGroup}${front}</svg>`;
    },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();
