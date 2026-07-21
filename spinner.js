/**
 * World Spinner — spherical type, p5 + opentype.js, SVG export
 */

const STATE = {
  font: null,
  fontName: "—",
  text: "GMC",
  fontSize: 244,
  spin: (359 * Math.PI) / 180,
  spinSpeed: 0,
  playing: false,
  horizontalArcDeg: 360,
  verticalArcDeg: 120,
  sphereR: 1,
  focal: 740,
  camZ: 510,
  tiltXDeg: 14,
  tiltYDeg: 0,
  /** #rrggbb — main type fill and SVG export */
  typeColorHex: "#5718C0",
  echoCount: 0,
  echoStep: 0.005,
  echoAlpha: 0.05,
  curveSteps: 24,
  circlePad: 0.92,
  snapDeg: 15,
  /** OpenType variation axis tag → value (variable fonts only). */
  variations: { wght: 900 },
  /** 0–100: procedural displacement map strength (warps projected outline). */
  displacementAmount: 0,
  /** 0–100: spatial frequency of the map (higher = finer detail). */
  displacementScale: 48,
  /** 0–100: time animation of the map (0 = static for current spin only). */
  displacementAnimate: 0,
  /** 0–100: multiplier on time drift (higher = faster crawling displacement). */
  displacementSpeed: 50,
  /** 0–100: blend in checkerboard sign flip per cell (halftone field / shattered glass). */
  displacementChecker: 0,
  /** 0–100: checker cell size (larger = bigger squares). */
  displacementCheckerSize: 45,
  /** Halftone field SVG behind type (masked to sphere in CSS). */
  vasarelyEnabled: true,
  /** 1px ring around the sphere clip (canvas + SVG export). */
  sphereMaskStrokeEnabled: false,
  /** Frosted glass overlay on sphere (CSS backdrop-filter). */
  glassEnabled: false,
  glassBlur: 0,
  glassFrost: 0,
  glassShine: 0,
  glassBlurText: false,
  glassBlurBlobs: false,
  /** Screen-space scale of projected type from sphere center (1 = default). */
  typeRadialScale: 1,
  /** Extra Z on type shell before projection (+ = toward camera, larger silhouette). */
  typeZOffset: 0,
  /** Screen-space scale of mapped field from sphere center (1 = default). */
  fieldRadialScale: 1,
  /** Scales checker quads + halftone dots on the field (“closer” = larger). */
  fieldElementScale: 1,
};

let contoursCache = null;
let cacheKey = "";
let pInst = null;
/** When set, export pipeline controls dimensions, time, and playback. */
let exportMode = null;

function getExportTimeMs(fallbackMs) {
  if (exportMode && !exportMode.liveEmbed && typeof exportMode.timeMs === "number") {
    return exportMode.timeMs;
  }
  return fallbackMs;
}

function isExportMode() {
  return !!exportMode;
}

/** Last font bytes the user can persist (upload or picked from saved list). Not set for bundled only. */
let lastFontBuffer = null;
let lastFontLabel = "";

const IDB_NAME = "world-spinner";
const IDB_VER = 2;
const IDB_STORE = "fonts";
const IDB_PRESETS = "presets";
const DEFAULT_FONT_ID = window.GMC_DEFAULT_FONT_ID || "bundled-focal-regular";

function normalizeFontSelectId(id) {
  if (!id || id === "__bundled__") return DEFAULT_FONT_ID;
  return id;
}

function bundledFontDefById(id) {
  return (window.GMC_BUNDLED_FONTS || []).find((f) => f.id === id) || null;
}

function copyFontBuffer(buf) {
  if (!buf) return null;
  if (buf instanceof ArrayBuffer) return buf.byteLength ? buf.slice(0) : null;
  if (ArrayBuffer.isView(buf)) {
    const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    return u8.slice().buffer;
  }
  return null;
}

function base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function getBundledFontBytes(def) {
  if (!def) return null;
  try {
    const res = await fetch(def.path);
    if (res.ok) return await res.arrayBuffer();
  } catch (_) {}
  const b64 = window.GMC_BUNDLED_FONT_DATA?.[def.id];
  if (b64) return base64ToArrayBuffer(b64);
  return null;
}

function waitForOpentype(maxMs = 20000) {
  return new Promise((resolve, reject) => {
    if (globalThis.opentype?.parse) {
      resolve();
      return;
    }
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      cleanup();
      if (ok) resolve();
      else reject(new Error("OpenType parser not loaded"));
    };
    const onReady = () => finish(!!globalThis.opentype?.parse);
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("opentype-ready", onReady);
    };
    window.addEventListener("opentype-ready", onReady);
    const t0 = Date.now();
    const poll = () => {
      if (globalThis.opentype?.parse) {
        finish(true);
        return;
      }
      if (Date.now() - t0 > maxMs) {
        finish(false);
        return;
      }
      requestAnimationFrame(poll);
    };
    const timer = setTimeout(() => finish(!!globalThis.opentype?.parse), maxMs);
    poll();
  });
}

/** Last chosen named preset (IndexedDB id) — reapplied on reload for the same origin. */
const LS_LAST_PRESET_ID = "world-spinner-last-preset-id";
const LS_LAST_FONT_ID = "world-spinner-last-font-id";
const LS_CANVAS_BG = "world-spinner-canvas-bg";
const LS_EXPORT_BG = "gmc_export_bg";

function rememberActiveFontId(id) {
  try {
    if (id) localStorage.setItem(LS_LAST_FONT_ID, id);
    else localStorage.removeItem(LS_LAST_FONT_ID);
  } catch (_) {
    /* quota / private mode */
  }
}

function getStoredActiveFontId() {
  try {
    return localStorage.getItem(LS_LAST_FONT_ID);
  } catch (_) {
    return null;
  }
}

function getStoredActivePresetId() {
  try {
    return localStorage.getItem(LS_LAST_PRESET_ID) || "";
  } catch (_) {
    return "";
  }
}

function rememberActivePresetId(id) {
  try {
    if (id) localStorage.setItem(LS_LAST_PRESET_ID, id);
    else localStorage.removeItem(LS_LAST_PRESET_ID);
  } catch (_) {
    /* quota / private mode */
  }
}

function clearStoredPresetIdIfMatch(id) {
  try {
    if (localStorage.getItem(LS_LAST_PRESET_ID) === id) localStorage.removeItem(LS_LAST_PRESET_ID);
  } catch (_) {}
}

async function restoreLastActivePreset() {
  let lastId = null;
  try {
    lastId = localStorage.getItem(LS_LAST_PRESET_ID);
  } catch (_) {}
  if (!lastId) {
    lastId = window.GMC_BUNDLED_DEFAULT_PRESET_ID || null;
  }
  if (!lastId) return;
  let rec;
  try {
    rec = await idbGetPreset(lastId);
  } catch (e) {
    console.warn(e);
    return;
  }
  if (!rec) {
    rememberActivePresetId("");
    return;
  }
  await applyPresetRecord(rec, { applyFont: false });
  rememberActivePresetId(lastId);
  await refreshPresetSelect(lastId);
  const nameEl = document.getElementById("preset-name");
  if (nameEl && rec.name) nameEl.value = rec.name;
}

async function restoreLastActiveFont() {
  let fontId = normalizeFontSelectId(getStoredActiveFontId());
  if (fontId !== DEFAULT_FONT_ID) {
    try {
      const fr = await idbGetFont(fontId);
      if (!copyFontBuffer(fr?.buffer)) fontId = null;
    } catch (e) {
      console.warn(e);
      fontId = null;
    }
  }
  if (!fontId) fontId = (await getMostRecentlySavedFontId()) || DEFAULT_FONT_ID;
  fontId = normalizeFontSelectId(fontId);
  await refreshSavedFontSelect(fontId);
  const fs = document.getElementById("saved-font-select");
  if (!fs) return;
  const useFont = [...fs.options].some((o) => o.value === fontId) ? fontId : DEFAULT_FONT_ID;
  fs.value = useFont;
  await activateFontSelection(useFont);
  rememberActiveFontId(useFont);
}

function openFontDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(IDB_PRESETS)) {
        db.createObjectStore(IDB_PRESETS, { keyPath: "id" });
      }
    };
  });
}

function idbListFonts() {
  return openFontDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const q = tx.objectStore(IDB_STORE).getAll();
        q.onsuccess = () => {
          const rows = q.result || [];
          rows.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
          resolve(rows);
        };
        q.onerror = () => reject(q.error);
      })
  );
}

function idbGetFont(id) {
  return openFontDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const q = tx.objectStore(IDB_STORE).get(id);
        q.onsuccess = () => resolve(q.result);
        q.onerror = () => reject(q.error);
      })
  );
}

function idbPutFont(rec) {
  return openFontDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(rec);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function idbDeleteFont(id) {
  return openFontDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

/** Newest by `savedAt` among user-saved fonts (excludes project-bundled fonts). */
async function getMostRecentlySavedFontId() {
  try {
    const rows = await idbListFonts();
    const user = rows.find((r) => !r.bundled);
    const id = user?.id;
    return typeof id === "string" && id.length ? id : null;
  } catch (e) {
    console.warn(e);
    return null;
  }
}

function idbListPresets() {
  return openFontDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_PRESETS, "readonly");
        const q = tx.objectStore(IDB_PRESETS).getAll();
        q.onsuccess = () => {
          const rows = q.result || [];
          rows.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
          resolve(rows);
        };
        q.onerror = () => reject(q.error);
      })
  );
}

function idbGetPreset(id) {
  return openFontDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_PRESETS, "readonly");
        const q = tx.objectStore(IDB_PRESETS).get(id);
        q.onsuccess = () => resolve(q.result);
        q.onerror = () => reject(q.error);
      })
  );
}

function idbPutPreset(rec) {
  return openFontDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_PRESETS, "readwrite");
        tx.objectStore(IDB_PRESETS).put(rec);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function idbDeletePreset(id) {
  return openFontDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_PRESETS, "readwrite");
        tx.objectStore(IDB_PRESETS).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

const PRESET_EXPORT_FORMAT = "gmc-pattern-presets";
const PRESET_EXPORT_VERSION = 1;
const VALID_PRESET_SCHEMAS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

function isValidPresetRecord(rec) {
  return (
    rec &&
    typeof rec === "object" &&
    typeof rec.name === "string" &&
    VALID_PRESET_SCHEMAS.has(rec.schema)
  );
}

function extractPresetsFromImportPayload(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.presets)) return data.presets;
  if (isValidPresetRecord(data)) return [data];
  return [];
}

async function exportPresetsToFile() {
  const presetMsg = document.getElementById("preset-msg");
  let rows = [];
  try {
    rows = await idbListPresets();
  } catch (err) {
    console.warn(err);
    if (presetMsg) presetMsg.textContent = "Could not read presets.";
    return;
  }
  if (!rows.length) {
    if (presetMsg) presetMsg.textContent = "No presets to export — save one first.";
    return;
  }
  const payload = {
    format: PRESET_EXPORT_FORMAT,
    version: PRESET_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    presets: rows,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gmc-pattern-presets-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  if (presetMsg) presetMsg.textContent = `Exported ${rows.length} preset${rows.length === 1 ? "" : "s"}.`;
}

async function importPresetsFromFile(file) {
  const presetMsg = document.getElementById("preset-msg");
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (err) {
    console.warn(err);
    if (presetMsg) presetMsg.textContent = "Import failed — invalid JSON.";
    return;
  }
  const raw = extractPresetsFromImportPayload(data);
  try {
    const { imported, skipped } = await idbMergePresets(raw, { regenerateIds: true });
    if (!imported) {
      if (presetMsg) {
        presetMsg.textContent =
          skipped > 0 ? "Import failed — no valid presets in file." : "No presets imported.";
      }
      return;
    }
    const rows = await idbListPresets();
    const lastId = rows[0]?.id || "";
    if (lastId) await refreshPresetSelect(lastId);
    if (presetMsg) {
      presetMsg.textContent =
        skipped > 0
          ? `Imported ${imported} preset${imported === 1 ? "" : "s"} (${skipped} skipped).`
          : `Imported ${imported} preset${imported === 1 ? "" : "s"}.`;
    }
  } catch (err) {
    console.warn(err);
    if (presetMsg) presetMsg.textContent = "Import failed — could not write to IndexedDB.";
  }
}

async function idbMergePresets(records, { regenerateIds = false } = {}) {
  const valid = records.filter(isValidPresetRecord);
  let imported = 0;
  let skipped = records.length - valid.length;
  let lastId = "";

  for (const rec of valid) {
    const id = regenerateIds ? crypto.randomUUID() : rec.id || crypto.randomUUID();
    if (!regenerateIds) {
      try {
        const existing = await idbGetPreset(id);
        if (existing) continue;
      } catch (err) {
        console.warn(err);
      }
    }
    const { id: _oldId, ...body } = rec;
    await idbPutPreset({
      ...body,
      id,
      name: (rec.name || "").trim() || "Imported",
      savedAt: typeof rec.savedAt === "number" ? rec.savedAt : Date.now(),
    });
    imported += 1;
    lastId = id;
  }

  return { imported, skipped, lastId };
}

/** Legacy IndexedDB font UUIDs from before bundled fonts shipped with the project. */
const LEGACY_PRESET_FONT_IDS = {
  "33e0c32f-0ecb-4e8f-ad99-61dacaa805d1": "bundled-focal-extrabold",
  "e4932864-c832-4107-aa9f-c78d83f26451": "bundled-focal-bold",
};

function bundledFontByKey(key) {
  return (window.GMC_BUNDLED_FONTS || []).find((f) => f.key === key) || null;
}

function bundledFontKeyForId(id) {
  const def = (window.GMC_BUNDLED_FONTS || []).find((f) => f.id === id);
  return def?.key || null;
}

function resolvePresetFontSelect(rec) {
  if (rec?.fontBundledKey) {
    const def = bundledFontByKey(rec.fontBundledKey);
    if (def) return def.id;
  }
  const sel = rec?.fontSelect || DEFAULT_FONT_ID;
  return LEGACY_PRESET_FONT_IDS[sel] || normalizeFontSelectId(sel);
}

async function mergeBundledFonts() {
  const list = window.GMC_BUNDLED_FONTS;
  if (!list?.length) return;
  for (const def of list) {
    try {
      const buffer = await getBundledFontBytes(def);
      if (!buffer?.byteLength) {
        console.warn(`Bundled font unavailable: ${def.id}`);
        continue;
      }
      let savedAt = Date.now();
      try {
        const existing = await idbGetFont(def.id);
        if (existing?.savedAt) savedAt = existing.savedAt;
      } catch (_) {}
      await idbPutFont({
        id: def.id,
        name: def.name,
        buffer: copyFontBuffer(buffer),
        savedAt,
        bundled: true,
      });
    } catch (err) {
      console.warn(err);
    }
  }
}

async function mergeBundledPresets() {
  const bundled = window.GMC_BUNDLED_PRESETS;
  if (!bundled) return { imported: 0 };
  const raw = extractPresetsFromImportPayload(bundled);
  let imported = 0;
  for (const rec of raw.filter(isValidPresetRecord)) {
    const id = rec.id;
    if (!id) continue;
    const { id: _oldId, ...body } = rec;
    await idbPutPreset({
      ...body,
      id,
      name: (rec.name || "").trim() || "Bundled",
      savedAt: typeof rec.savedAt === "number" ? rec.savedAt : Date.now(),
    });
    imported += 1;
  }
  return { imported };
}

async function refreshSavedFontSelect(selectedId) {
  const sel = document.getElementById("saved-font-select");
  if (!sel) return;
  let rows = [];
  try {
    rows = await idbListFonts();
  } catch (e) {
    console.warn(e);
  }
  const keep = normalizeFontSelectId(selectedId || sel.value || DEFAULT_FONT_ID);
  sel.innerHTML = "";
  const bundledNames = new Map((window.GMC_BUNDLED_FONTS || []).map((f) => [f.id, f.name]));
  const defaultRow = rows.find((r) => r.id === DEFAULT_FONT_ID);
  const ordered = defaultRow ? [defaultRow, ...rows.filter((r) => r.id !== DEFAULT_FONT_ID)] : rows;
  for (const r of ordered) {
    const o = document.createElement("option");
    o.value = r.id;
    const label = bundledNames.get(r.id) || r.name || "Untitled";
    o.textContent = bundledNames.has(r.id) ? `Bundled · ${label}` : label;
    sel.appendChild(o);
  }
  const ok = [...sel.options].some((opt) => opt.value === keep);
  sel.value = ok ? keep : ordered[0]?.id || DEFAULT_FONT_ID;
}

function typingTarget(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") {
    const t = el.type;
    return t === "text" || t === "search" || t === "email" || t === "url" || t === "password" || t === "number";
  }
  return el.isContentEditable === true;
}

function decodeOpenTypeTag(n) {
  const u = n >>> 0;
  return String.fromCharCode((u >> 24) & 255, (u >> 16) & 255, (u >> 8) & 255, u & 255).replace(
    /\0/g,
    ""
  );
}

function fvarAxisTag(a) {
  if (a == null) return "";
  if (typeof a.axisTag === "string") return a.axisTag;
  if (typeof a.tag === "string") return a.tag;
  if (typeof a.axisTag === "number") return decodeOpenTypeTag(a.axisTag);
  if (typeof a.tag === "number") return decodeOpenTypeTag(a.tag);
  return "";
}

const AXIS_LABELS = {
  wght: "Weight (wght)",
  wdth: "Width (wdth)",
  opsz: "Optical size (opsz)",
  slnt: "Slant (slnt)",
  ital: "Italic (ital)",
};

function axisDisplayName(tag) {
  return AXIS_LABELS[tag] || `${tag}`;
}

function vfAxisStep(min, max) {
  const span = max - min;
  if (span <= 0) return 1;
  if (span <= 1) return 0.001;
  if (span <= 10) return 0.01;
  if (span <= 80) return 0.1;
  if (span <= 400) return 1;
  return Math.max(1, Math.round(span / 200));
}

function formatVariationValue(v) {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v - Math.round(v)) < 1e-4) return String(Math.round(v));
  return v.toFixed(2);
}

function variationsKey() {
  const axes = STATE.font?.tables?.fvar?.axes;
  if (!axes?.length) return "";
  const parts = [];
  for (const a of axes) {
    const t = fvarAxisTag(a);
    if (!t) continue;
    parts.push([t, STATE.variations[t]]);
  }
  parts.sort((x, y) => x[0].localeCompare(y[0]));
  return parts.map((p) => `${p[0]}:${p[1]}`).join("|");
}

function syncVariationStateFromFont() {
  const axes = STATE.font?.tables?.fvar?.axes;
  if (!axes?.length) {
    STATE.variations = {};
    renderAxisControls();
    contoursCache = null;
    cacheKey = "";
    return;
  }
  const next = {};
  for (const a of axes) {
    const tag = fvarAxisTag(a);
    if (!tag) continue;
    const min = Number.isFinite(a.minValue) ? a.minValue : 0;
    const max = Number.isFinite(a.maxValue) ? a.maxValue : Math.max(1000, min + 1);
    const def = Number.isFinite(a.defaultValue) ? a.defaultValue : (min + max) / 2;
    let v = STATE.variations[tag];
    if (typeof v !== "number" || Number.isNaN(v)) v = def;
    next[tag] = Math.min(max, Math.max(min, v));
  }
  STATE.variations = next;
  contoursCache = null;
  cacheKey = "";
  renderAxisControls();
}

function renderAxisControls() {
  const section = document.getElementById("vf-section");
  const wrap = document.getElementById("vf-axes");
  const hint = document.getElementById("vf-hint");
  if (!section || !wrap) return;
  wrap.innerHTML = "";
  const axes = STATE.font?.tables?.fvar?.axes;
  if (!axes?.length) {
    section.hidden = true;
    if (hint) hint.textContent = "";
    return;
  }
  section.hidden = false;
  if (hint) {
    hint.textContent =
      "Registered axes for this font. Outlines update when the font includes gvar or CFF2 variation data.";
  }
  for (let i = 0; i < axes.length; i++) {
    const a = axes[i];
    const tag = fvarAxisTag(a);
    if (!tag) continue;
    const min = Number.isFinite(a.minValue) ? a.minValue : 0;
    const max = Number.isFinite(a.maxValue) ? a.maxValue : Math.max(1000, min + 1);
    const def = Number.isFinite(a.defaultValue) ? a.defaultValue : (min + max) / 2;
    const val = STATE.variations[tag] ?? def;
    const step = vfAxisStep(min, max);
    const idSafe = tag.replace(/[^a-zA-Z0-9_-]/g, "_") || `ax${i}`;
    const field = document.createElement("div");
    field.className = "field";
    const labelRow = document.createElement("div");
    labelRow.className = "range-row";
    const lbl = document.createElement("label");
    lbl.setAttribute("for", `vf-${idSafe}`);
    lbl.textContent = axisDisplayName(tag);
    const valSpan = document.createElement("span");
    valSpan.className = "val";
    valSpan.id = `vf-val-${idSafe}`;
    valSpan.textContent = formatVariationValue(val);
    labelRow.appendChild(lbl);
    labelRow.appendChild(valSpan);
    const input = document.createElement("input");
    input.type = "range";
    input.id = `vf-${idSafe}`;
    input.className = "vf-axis";
    input.dataset.axisTag = tag;
    input.dataset.valId = idSafe;
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(val);
    field.appendChild(labelRow);
    field.appendChild(input);
    wrap.appendChild(field);
  }
}

function flattenCommands(commands, steps) {
  const contours = [];
  let cur = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;

  const addLine = (x1, y1, x2, y2, n) => {
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      cur.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
    }
  };

  const cubic = (x0, y0, x1, y1, x2, y2, x3, y3, n) => {
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const mt = 1 - t;
      const x =
        mt * mt * mt * x0 +
        3 * mt * mt * t * x1 +
        3 * mt * t * t * x2 +
        t * t * t * x3;
      const y =
        mt * mt * mt * y0 +
        3 * mt * mt * t * y1 +
        3 * mt * t * t * y2 +
        t * t * t * y3;
      cur.push({ x, y });
    }
  };

  const quad = (x0, y0, x1, y1, x2, y2, n) => {
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const mt = 1 - t;
      const x = mt * mt * x0 + 2 * mt * t * x1 + t * t * x2;
      const y = mt * mt * y0 + 2 * mt * t * y1 + t * t * y2;
      cur.push({ x, y });
    }
  };

  for (const cmd of commands) {
    switch (cmd.type) {
      case "M":
        if (cur.length) {
          contours.push(cur);
          cur = [];
        }
        cx = cmd.x;
        cy = cmd.y;
        sx = cx;
        sy = cy;
        cur.push({ x: cx, y: cy });
        break;
      case "L":
        addLine(cx, cy, cmd.x, cmd.y, Math.max(1, steps >> 1));
        cx = cmd.x;
        cy = cmd.y;
        break;
      case "H":
        addLine(cx, cy, cmd.x, cy, Math.max(1, steps >> 1));
        cx = cmd.x;
        break;
      case "V":
        addLine(cx, cy, cx, cmd.y, Math.max(1, steps >> 1));
        cy = cmd.y;
        break;
      case "C":
        cubic(cx, cy, cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y, steps);
        cx = cmd.x;
        cy = cmd.y;
        break;
      case "Q":
        quad(cx, cy, cmd.x1, cmd.y1, cmd.x, cmd.y, steps);
        cx = cmd.x;
        cy = cmd.y;
        break;
      case "Z":
        if (cur.length > 1) {
          addLine(cx, cy, sx, sy, Math.max(1, steps >> 1));
        }
        contours.push(cur);
        cur = [];
        cx = sx;
        cy = sy;
        break;
      default:
        break;
    }
  }
  if (cur.length) contours.push(cur);
  return contours;
}

function getVariationMapForFont(otFont) {
  const axes = otFont?.tables?.fvar?.axes;
  if (!axes?.length) return null;
  const out = {};
  for (const a of axes) {
    const tag = fvarAxisTag(a);
    if (!tag) continue;
    const min = Number.isFinite(a.minValue) ? a.minValue : 0;
    const max = Number.isFinite(a.maxValue) ? a.maxValue : Math.max(1000, min + 1);
    const def = Number.isFinite(a.defaultValue) ? a.defaultValue : (min + max) / 2;
    let v = STATE.variations[tag];
    if (typeof v !== "number" || Number.isNaN(v)) v = def;
    out[tag] = Math.min(max, Math.max(min, v));
  }
  return Object.keys(out).length ? out : null;
}

function getFontPath(otFont, str, size) {
  const vars = getVariationMapForFont(otFont);
  if (vars && otFont.variation) {
    try {
      return otFont.getPath(str, 0, 0, size, { variation: vars });
    } catch (e) {
      console.warn(e);
    }
  }
  return otFont.getPath(str, 0, 0, size);
}

function buildContoursFromFont(otFont, str, size) {
  const path = getFontPath(otFont, str, size);
  if (!path.commands || path.commands.length === 0) {
    return { contours: [], halfW: 1, halfH: 1 };
  }
  const box = path.getBoundingBox();
  if (
    !Number.isFinite(box.x1) ||
    !Number.isFinite(box.x2) ||
    (Math.abs(box.x2 - box.x1) < 1e-6 && Math.abs(box.y2 - box.y1) < 1e-6)
  ) {
    return { contours: [], halfW: 1, halfH: 1 };
  }
  const cx = (box.x1 + box.x2) / 2;
  const cy = (box.y1 + box.y2) / 2;
  const raw = flattenCommands(path.commands, STATE.curveSteps);
  const shifted = raw.map((loop) =>
    loop.map((p) => ({ x: p.x - cx, y: -(p.y - cy) }))
  );
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const loop of shifted) {
    for (const p of loop) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  }
  const bw = Math.max(maxX - minX, 1);
  const bh = Math.max(maxY - minY, 1);
  return { contours: shifted, halfW: bw / 2, halfH: bh / 2 };
}

function horizArcRad() {
  return (STATE.horizontalArcDeg * Math.PI) / 180;
}

function vertArcRad() {
  return (STATE.verticalArcDeg * Math.PI) / 180;
}

function tiltXRad() {
  return (STATE.tiltXDeg * Math.PI) / 180;
}

function tiltYRad() {
  return (STATE.tiltYDeg * Math.PI) / 180;
}

function hexToRgb(hex) {
  const h = String(hex || "").replace(/^#/, "");
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function hexToP5Color(p, hex, alpha255) {
  const { r, g, b } = hexToRgb(hex);
  return p.color(r, g, b, alpha255 ?? 255);
}

/**
 * Half of the horizontal arc (radians) used for longitude mapping.
 * Arcs slightly above 180° push the left/right extremes past the sphere limb onto the far
 * hemisphere — it reads like type on the wrong side of the bubble. Very wide arcs (330°+)
 * skip clamping so intentional full-wrap looks stay possible.
 */
function horizHalfArcForMapping() {
  const half = horizArcRad() * 0.5;
  if (STATE.horizontalArcDeg <= 180) return half;
  if (STATE.horizontalArcDeg >= 330) return half;
  return Math.min(half, Math.PI / 2 - 0.06);
}

/**
 * @param zExtra Added to z3 after tilt (type-only offset); use 0 for field / patch sampling.
 */
function projectPointCore(x, y, spinOff, halfW, halfH, zExtra) {
  const nx = x / halfW;
  const ny = y / halfH;
  /* Negative nx: map type as an outer decal facing the camera (avoids mirror-reversed glyphs). */
  const theta = -nx * horizHalfArcForMapping() + spinOff;
  const phi = ny * (vertArcRad() * 0.5);
  const R = STATE.sphereR * 220;
  const cosP = Math.cos(phi);
  let x3 = R * cosP * Math.sin(theta);
  let y3 = R * Math.sin(phi);
  let z3 = R * cosP * Math.cos(theta);

  const tx = tiltXRad();
  const cosX = Math.cos(tx);
  const sinX = Math.sin(tx);
  let y3r = y3 * cosX - z3 * sinX;
  let z3r = y3 * sinX + z3 * cosX;
  y3 = y3r;
  z3 = z3r;

  const ty = tiltYRad();
  const cosY = Math.cos(ty);
  const sinY = Math.sin(ty);
  const x3r = x3 * cosY + z3 * sinY;
  const z3r2 = -x3 * sinY + z3 * cosY;
  x3 = x3r;
  z3 = z3r2;

  z3 += zExtra ?? 0;

  const denom = STATE.camZ - z3;
  if (denom < 40) return null;
  const s = STATE.focal / denom;
  /* Flip screen Y so type reads upright on the front hemisphere (OpenType Y-up + latitude map + tilt). */
  return { sx: x3 * s, sy: -y3 * s, z3 };
}

function projectPoint(x, y, spinOff, halfW, halfH) {
  return projectPointCore(x, y, spinOff, halfW, halfH, STATE.typeZOffset);
}

/**
 * Patch / field: same lens as type but no type-only Z shift.
 */
function projectPatchPoint(nx, ny, spinOff) {
  const pr = projectPointCore(nx, ny, spinOff, 1, 1, 0);
  if (!pr) return null;
  const denom = STATE.camZ - pr.z3;
  if (denom < 40) return null;
  const scale = STATE.focal / denom;
  return { sx: pr.sx, sy: pr.sy, z3: pr.z3, scale };
}

function applyTypeRadialToProjected(pr) {
  if (!pr) return pr;
  const k = STATE.typeRadialScale;
  if (Math.abs(k - 1) < 1e-9) return pr;
  return { sx: pr.sx * k, sy: pr.sy * k, z3: pr.z3 };
}

function ensureContours() {
  if (!STATE.font) return null;
  const key = [
    STATE.text,
    STATE.fontSize,
    STATE.font.names?.fullName?.en || STATE.font.postScriptName || STATE.fontName,
    STATE.curveSteps,
    variationsKey(),
  ].join("|");
  if (contoursCache && cacheKey === key) return contoursCache;
  try {
    contoursCache = buildContoursFromFont(STATE.font, STATE.text, STATE.fontSize);
    cacheKey = key;
    return contoursCache;
  } catch (e) {
    console.warn(e);
    return null;
  }
}

/** Multi-octave sine field — smooth pseudo-noise for displacement. */
function displacementFieldSample(x, y, t) {
  let s = 0;
  let f = 1;
  let a = 1;
  for (let i = 0; i < 4; i++) {
    s += a * Math.sin(f * x + t * (0.72 + i * 0.11)) * Math.cos(f * y * 1.02 - t * 0.38);
    f *= 2.08;
    a *= 0.48;
  }
  return Math.max(-1, Math.min(1, s * 0.5));
}

function checkerDisplacementBlend(sx, sy, rad) {
  const mix = STATE.displacementChecker / 100;
  if (mix <= 0) return 1;
  const sizeT = STATE.displacementCheckerSize / 100;
  const cell = Math.max(rad * (0.07 + sizeT * 0.38), 3);
  const ix = Math.floor(sx / cell);
  const iy = Math.floor(sy / cell);
  const phase = (ix + iy) & 1 ? -1 : 1;
  return 1 + mix * (phase - 1);
}

function applyDisplacementToProjected(pr, rad, spinOff, timeMs) {
  const amt = STATE.displacementAmount / 100;
  if (!pr || amt <= 0) return pr;
  const scaleBase = 0.022 + (STATE.displacementScale / 100) * 0.22;
  const nx = pr.sx * scaleBase;
  const ny = pr.sy * scaleBase;
  const spd = Math.pow(2, (STATE.displacementSpeed - 50) / 25);
  const anim = (STATE.displacementAnimate / 100) * timeMs * 0.0018 * spd;
  const t = spinOff * 1.12 + anim;
  let dxN = displacementFieldSample(nx, ny, t);
  let dyN = displacementFieldSample(nx + 4.2, ny + 6.1, t + 1.7);
  const chk = checkerDisplacementBlend(pr.sx, pr.sy, rad);
  dxN *= chk;
  dyN *= chk;
  const ampPx = amt * rad * 0.15;
  return {
    sx: pr.sx + dxN * ampPx,
    sy: pr.sy + dyN * ampPx,
    z3: pr.z3,
  };
}

function loopToSegments(loop, halfW, halfH, spinOff, rad, timeMs, layoutScale = 1) {
  const paths = [];
  let seg = [];
  for (const pt of loop) {
    const pr = projectPoint(pt.x, pt.y, spinOff, halfW, halfH);
    if (!pr) {
      if (seg.length >= 3) paths.push(scaleProjectedSegment(seg, layoutScale));
      seg = [];
    } else {
      const displaced = applyDisplacementToProjected(pr, rad, spinOff, timeMs);
      seg.push(applyTypeRadialToProjected(displaced));
    }
  }
  if (seg.length >= 3) paths.push(scaleProjectedSegment(seg, layoutScale));
  return paths;
}

function fmt(n) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function segmentToPathD(seg, ox, oy) {
  let d = `M ${fmt(ox + seg[0].sx)} ${fmt(oy + seg[0].sy)}`;
  for (let i = 1; i < seg.length; i++) {
    d += ` L ${fmt(ox + seg[i].sx)} ${fmt(oy + seg[i].sy)}`;
  }
  d += " Z";
  return d;
}

function setCanvasFillFromP5Color(ctx, p, fillC) {
  const col = p.color(fillC);
  const lv = col.levels || [0, 0, 0, 255];
  const r = lv[0];
  const g = lv[1];
  const b = lv[2];
  const a = (lv[3] != null ? lv[3] : 255) / 255;
  ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
}

/**
 * One compound path + even-odd fill so counters (O, P, B, etc.) stay open instead of
 * each contour being filled separately (which paints holes solid).
 */
function drawContoursProjected(p, spinOff, fillC, rad, timeMs) {
  const data = ensureContours();
  if (!data) return;
  const { contours, halfW, halfH } = data;
  const ctx = p.drawingContext;
  if (!ctx?.beginPath) return;

  const layoutScale = shouldApplyViewportLayoutScale()
    ? getViewportLayoutScale(p.width, p.height)
    : 1;

  setCanvasFillFromP5Color(ctx, p, fillC);
  ctx.beginPath();
  for (const loop of contours) {
    const segs = loopToSegments(loop, halfW, halfH, spinOff, rad, timeMs, layoutScale);
    for (const seg of segs) {
      if (seg.length < 3) continue;
      ctx.moveTo(seg[0].sx, seg[0].sy);
      for (let i = 1; i < seg.length; i++) {
        ctx.lineTo(seg[i].sx, seg[i].sy);
      }
      ctx.closePath();
    }
  }
  const prevRule = ctx.fillRule;
  ctx.fillRule = "evenodd";
  ctx.fill();
  ctx.fillRule = prevRule;
}

function syncCanvasBackground() {
  const stored = readStoredExportBackground();
  if (stored) {
    const sphereA = document.getElementById("sphere-bg-a");
    const sphereB = document.getElementById("sphere-bg-b");
    const transparent = document.getElementById("export-bg-transparent");
    const color = document.getElementById("export-bg-color");
    if (transparent) transparent.checked = stored.transparent;
    if (color && stored.color) color.value = stored.color;
    if (sphereA && stored.sphereA) sphereA.value = stored.sphereA;
    if (sphereB && stored.sphereB) sphereB.value = stored.sphereB;
    syncBackgroundPreviews();
    return;
  }
  const wrap = document.getElementById("canvas-wrap");
  if (!wrap) return;
  let mode = "checker";
  try {
    const legacy = localStorage.getItem(LS_CANVAS_BG);
    if (legacy === "white" || legacy === "checker") mode = legacy;
  } catch (_) {}
  applyExportBackgroundPreview(
    mode === "checker" ? { transparent: true, color: "#ffffff" } : { transparent: false, color: "#ffffff" }
  );
  if (typeof window.Vasarely?.draw === "function") window.Vasarely.draw();
  if (pInst) pInst.redraw();
}

function readExportBackgroundFromDom() {
  const transparent = !!document.getElementById("export-bg-transparent")?.checked;
  const color = document.getElementById("export-bg-color")?.value || "#ffffff";
  return { transparent, color };
}

function readSphereInteriorFromDom() {
  return {
    colorA: document.getElementById("sphere-bg-a")?.value || "#f8f8f4",
    colorB: document.getElementById("sphere-bg-b")?.value || "#e4e4de",
  };
}

function readAllBackgroundSettings() {
  const canvas = readExportBackgroundFromDom();
  const sphere = readSphereInteriorFromDom();
  return { ...canvas, sphereA: sphere.colorA, sphereB: sphere.colorB };
}

function readStoredExportBackground() {
  try {
    const raw = localStorage.getItem(LS_EXPORT_BG);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return null;
    return {
      transparent: !!data.transparent,
      color: typeof data.color === "string" ? data.color : "#ffffff",
      sphereA: typeof data.sphereA === "string" ? data.sphereA : "#f8f8f4",
      sphereB: typeof data.sphereB === "string" ? data.sphereB : "#e4e4de",
    };
  } catch (_) {
    return null;
  }
}

function rememberExportBackground(bg) {
  try {
    const canvas = bg.transparent !== undefined ? bg : readExportBackgroundFromDom();
    const sphere = readSphereInteriorFromDom();
    localStorage.setItem(
      LS_EXPORT_BG,
      JSON.stringify({
        transparent: !!canvas.transparent,
        color: canvas.color || "#ffffff",
        sphereA: bg.sphereA ?? sphere.colorA,
        sphereB: bg.sphereB ?? sphere.colorB,
      })
    );
  } catch (_) {}
}

function getLiveSphereInteriorColors() {
  if (exportMode?.sphereInterior) return exportMode.sphereInterior;
  return readSphereInteriorFromDom();
}

function getLiveExportBackground() {
  if (exportMode) {
    return {
      transparent: !!exportMode.transparentBg,
      color: exportMode.exportBgColor || "#ffffff",
    };
  }
  return readExportBackgroundFromDom();
}

function applyExportBackgroundPreview(bg) {
  const wrap = document.getElementById("canvas-wrap");
  if (!wrap) return;
  wrap.classList.remove("bg-checker", "bg-white");
  wrap.style.background = "";
  const cb = document.getElementById("canvas-bg-checker");
  if (bg?.transparent) {
    wrap.classList.add("bg-checker");
    if (cb) cb.checked = true;
  } else {
    if (cb) cb.checked = false;
    wrap.style.background = bg?.color || "#ffffff";
  }
}

function syncBackgroundPreviews() {
  applyExportBackgroundPreview(readExportBackgroundFromDom());
  rememberExportBackground(readAllBackgroundSettings());
  if (typeof window.Vasarely?.draw === "function") window.Vasarely.draw();
  if (pInst) pInst.redraw();
}

function setCanvasBackgroundMode(mode) {
  const transparent = document.getElementById("export-bg-transparent");
  const color = document.getElementById("export-bg-color");
  const next = mode === "white" ? "white" : "checker";
  if (transparent) transparent.checked = next === "checker";
  if (next === "white" && color && !color.value) color.value = "#ffffff";
  const bg = readExportBackgroundFromDom();
  applyExportBackgroundPreview(bg);
  rememberExportBackground(readAllBackgroundSettings());
  try {
    localStorage.setItem(LS_CANVAS_BG, next);
  } catch (_) {}
}

function layoutMetrics(w, h) {
  const cx = w * 0.5;
  const cy = h * 0.48;
  const rad = Math.min(w, h) * 0.42 * STATE.circlePad;
  return { cx, cy, rad };
}

function shouldApplyViewportLayoutScale() {
  if (!exportMode) return true;
  return !!exportMode.liveEmbed;
}

function getViewportLayoutScale(w, h) {
  const { rad } = layoutMetrics(w, h);
  if (!Number.isFinite(rad) || rad <= 0) return 1;
  /* Projected sphere limb radius in px (fixed by lens, independent of viewport). */
  const R = STATE.sphereR * 220;
  const denomSq = STATE.camZ * STATE.camZ - R * R;
  if (denomSq <= 0) return 1;
  const limb = (STATE.focal * R) / Math.sqrt(denomSq);
  if (!Number.isFinite(limb) || limb <= 0) return 1;
  /* Shrink content so the projected sphere never overflows the clip circle; never enlarge. */
  return Math.min(1, rad / limb);
}

function scaleProjectedSegment(seg, layoutScale) {
  if (!seg || layoutScale === 1) return seg;
  return seg.map((p) => ({ sx: p.sx * layoutScale, sy: p.sy * layoutScale }));
}

function resizeCanvasFromWrap() {
  if (!pInst) return;
  if (exportMode?.liveEmbed) {
    syncEmbedLayout();
    return;
  }
  if (exportMode && !exportMode.liveEmbed) return;
  const wrap = document.getElementById("canvas-wrap");
  if (!wrap) return;
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  if (w <= 0 || h <= 0) return;
  if (pInst.width === w && pInst.height === h) return;
  pInst.resizeCanvas(w, h);
  if (typeof window.Vasarely?.draw === "function") window.Vasarely.draw();
}

let canvasWrapResizeObserver = null;

function watchCanvasWrapResize() {
  if (canvasWrapResizeObserver) return;
  const wrap = document.getElementById("canvas-wrap");
  if (!wrap || typeof ResizeObserver === "undefined") return;
  canvasWrapResizeObserver = new ResizeObserver(() => {
    resizeCanvasFromWrap();
  });
  canvasWrapResizeObserver.observe(wrap);
}

function syncGlassOverlay() {
  const glass = document.getElementById("sphere-glass");
  const wrap = document.getElementById("canvas-wrap");
  if (!wrap) return;

  const setContentFilter = (el, on) => {
    if (!el) return;
    el.style.filter = on ? `blur(${blur}px) saturate(${saturate})` : "";
  };

  if (exportMode && !exportMode.liveEmbed) {
    setContentFilter(document.getElementById("vas-c"), false);
    setContentFilter(document.getElementById("vas-c-front"), false);
    setContentFilter(document.querySelector("#text-layer canvas.p5Canvas"), false);
    if (glass) glass.classList.add("is-hidden");
    return;
  }

  const active = STATE.glassEnabled;
  const showTextBlur = active && STATE.glassBlurText;
  const showBlobsBlur = active && STATE.glassBlurBlobs;
  const blur = STATE.glassBlur;
  const frost = STATE.glassFrost / 100;
  const saturate = 1.12 + frost * 0.2;

  setContentFilter(document.getElementById("vas-c"), showBlobsBlur);
  setContentFilter(document.getElementById("vas-c-front"), showBlobsBlur);
  setContentFilter(document.querySelector("#text-layer canvas.p5Canvas"), showTextBlur);

  document.getElementById("glass-text")?.remove();
  document.getElementById("glass-blobs-back")?.remove();
  document.getElementById("glass-blobs-front")?.remove();

  if (active) {
    wrap.style.setProperty("--glass-frost", String(frost * 0.55));
    wrap.style.setProperty("--glass-frost-mid", String(frost * 0.2));
    wrap.style.setProperty("--glass-shine", String(STATE.glassShine / 100));
    wrap.style.setProperty("--glass-rim", String(0.2 + STATE.glassShine / 300));
  }

  if (glass) {
    glass.classList.toggle("is-hidden", !active);
    glass.classList.toggle("has-mask-stroke", active && STATE.sphereMaskStrokeEnabled);
  }
}

/** Single source for sphere + projection; halftone field reads this when mapping to the bubble. */
window.WorldSpinnerSphere = {
  layoutMetrics,
  projectPatchPoint,
  getSpin: () => STATE.spin,
  getWrapSize() {
    if (exportMode) {
      if (exportMode.liveEmbed) {
        const el = document.getElementById("canvas-wrap");
        const w = el?.clientWidth || exportMode.width;
        const h = el?.clientHeight || exportMode.height;
        return {
          w: w > 0 ? w : exportMode.width,
          h: h > 0 ? h : exportMode.height,
        };
      }
      return { w: exportMode.width, h: exportMode.height };
    }
    const el = document.getElementById("canvas-wrap");
    return { w: el?.clientWidth || 800, h: el?.clientHeight || 600 };
  },
  getFieldScales: () => ({
    radial: STATE.fieldRadialScale,
    element: STATE.fieldElementScale,
  }),
  /** Viewport shrink factor (min edge / 760, capped at 1) — same scale the type layer uses. */
  getLayoutScale() {
    if (!shouldApplyViewportLayoutScale()) return 1;
    const { w, h } = this.getWrapSize();
    return getViewportLayoutScale(w, h);
  },
  /** True only during transparent export (flat halftone matte). Not tied to canvas preview transparency. */
  isExportTransparentBg: () => !!exportMode?.transparentBg,
  getExportBackground: () => getLiveExportBackground(),
  getSphereInteriorColors: () => getLiveSphereInteriorColors(),
  getAnimTimeSec() {
    if (exportMode && !exportMode.liveEmbed && typeof exportMode.timeMs === "number") {
      return exportMode.timeMs / 1000;
    }
    if (pInst) return pInst.millis() / 1000;
    return performance.now() / 1000;
  },
};

/** Match `#tilt` / `#tilt-y` in index.html */
const TILT_SLIDER_MIN = -80;
const TILT_SLIDER_MAX = 85;

function clientToCanvasPixels(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const w = canvas.width;
  const h = canvas.height;
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: ((clientX - rect.left) / rect.width) * w,
    y: ((clientY - rect.top) / rect.height) * h,
  };
}

/**
 * Drag on the sphere: turntable mapping (dy→tilt X, dx→tilt Y), hit-test inside circle,
 * pointer capture, incremental deltas, hard clamp. Sensitivity scales with on-screen radius.
 */
function bindSphereTiltCanvasDrag(getP, canvas) {
  if (!canvas || canvas.dataset.sphereTiltBound) return;
  canvas.dataset.sphereTiltBound = "1";
  canvas.style.touchAction = "none";

  let capturedId = null;
  let lastCX = 0;
  let lastCY = 0;

  function syncTiltUi() {
    const tx = document.getElementById("tilt");
    const ty = document.getElementById("tilt-y");
    const vx = Math.round(STATE.tiltXDeg);
    const vy = Math.round(STATE.tiltYDeg);
    if (tx) tx.value = String(vx);
    if (ty) ty.value = String(vy);
    const lx = document.getElementById("tilt-val");
    const ly = document.getElementById("tilt-y-val");
    if (lx) lx.textContent = `${vx}°`;
    if (ly) ly.textContent = `${vy}°`;
  }

  function degPerPixel(radPx) {
    return 78 / Math.max(radPx, 24);
  }

  function applyMove(dxPx, dyPx) {
    const p = getP();
    if (!p) return;
    const { rad } = layoutMetrics(p.width, p.height);
    const k = degPerPixel(rad);
    STATE.tiltXDeg -= dyPx * k;
    STATE.tiltYDeg += dxPx * k;
    STATE.tiltXDeg = Math.min(TILT_SLIDER_MAX, Math.max(TILT_SLIDER_MIN, STATE.tiltXDeg));
    STATE.tiltYDeg = Math.min(TILT_SLIDER_MAX, Math.max(TILT_SLIDER_MIN, STATE.tiltYDeg));
    syncTiltUi();
    p.redraw();
  }

  function pointInSphere(clientX, clientY) {
    const p = getP();
    if (!p) return false;
    const { cx, cy, rad } = layoutMetrics(p.width, p.height);
    const pt = clientToCanvasPixels(canvas, clientX, clientY);
    return Math.hypot(pt.x - cx, pt.y - cy) <= rad;
  }

  function updateHoverCursor(ev) {
    if (capturedId !== null) return;
    if (ev.buttons) return;
    canvas.style.cursor = pointInSphere(ev.clientX, ev.clientY) ? "grab" : "";
  }

  canvas.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    if (!pointInSphere(ev.clientX, ev.clientY)) return;
    capturedId = ev.pointerId;
    lastCX = ev.clientX;
    lastCY = ev.clientY;
    canvas.setPointerCapture(ev.pointerId);
    canvas.style.cursor = "grabbing";
  });

  canvas.addEventListener("pointermove", (ev) => {
    if (capturedId !== null && ev.pointerId === capturedId) {
      const list =
        typeof ev.getCoalescedEvents === "function" && ev.getCoalescedEvents().length > 0
          ? ev.getCoalescedEvents()
          : [ev];
      let accX = 0;
      let accY = 0;
      let px = lastCX;
      let py = lastCY;
      for (const ce of list) {
        accX += ce.clientX - px;
        accY += ce.clientY - py;
        px = ce.clientX;
        py = ce.clientY;
      }
      lastCX = px;
      lastCY = py;
      if (accX !== 0 || accY !== 0) applyMove(accX, accY);
      return;
    }
    updateHoverCursor(ev);
  });

  function endCapture(ev) {
    if (capturedId === null || ev.pointerId !== capturedId) return;
    try {
      canvas.releasePointerCapture(capturedId);
    } catch (_) {
      /* already released */
    }
    capturedId = null;
    canvas.style.cursor = pointInSphere(ev.clientX, ev.clientY) ? "grab" : "";
  }

  canvas.addEventListener("pointerup", endCapture);
  canvas.addEventListener("pointercancel", endCapture);
  canvas.addEventListener("lostpointercapture", (ev) => {
    if (ev.pointerId === capturedId) capturedId = null;
  });

  canvas.addEventListener("dblclick", (ev) => {
    if (!pointInSphere(ev.clientX, ev.clientY)) return;
    ev.preventDefault();
    STATE.tiltXDeg = 14;
    STATE.tiltYDeg = 0;
    syncTiltUi();
    const p = getP();
    if (p) p.redraw();
  });
}

function buildTypeSpherePathMarkup() {
  const p = pInst;
  if (!p) return null;
  const w = p.width;
  const h = p.height;
  const { cx, cy, rad } = layoutMetrics(w, h);
  const data = ensureContours();
  if (!data) return null;

  const bg = "#ffffff";
  const ink = STATE.typeColorHex || "#000000";
  const { r: gr, g: gg, b: gb } = hexToRgb(ink);
  const inkGhost = `rgba(${gr},${gg},${gb},${STATE.echoAlpha})`;

  const { contours, halfW, halfH } = data;
  const pathElements = [];
  const exportMs = getExportTimeMs(typeof performance !== "undefined" ? performance.now() : 0);

  const appendLayer = (spinOff, fill) => {
    const dParts = [];
    for (const loop of contours) {
      const segs = loopToSegments(loop, halfW, halfH, spinOff, rad, exportMs);
      for (const seg of segs) {
        if (seg.length < 3) continue;
        dParts.push(segmentToPathD(seg, cx, cy));
      }
    }
    if (!dParts.length) return;
    pathElements.push(
      `<path fill="${fill}" fill-rule="evenodd" stroke="none" d="${dParts.join(" ")}"/>`
    );
  };

  for (let e = (exportMode?.suppressEcho ? 0 : STATE.echoCount); e >= 1; e--) {
    appendLayer(STATE.spin - e * STATE.echoStep, inkGhost);
  }
  appendLayer(STATE.spin, ink);

  return {
    w,
    h,
    cx,
    cy,
    rad,
    bg,
    ink,
    pathMarkup: pathElements.join("\n    "),
  };
}

function buildSVGDocument() {
  const b = buildTypeSpherePathMarkup();
  if (!b) return "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${b.w}" height="${b.h}" viewBox="0 0 ${b.w} ${b.h}">
  <rect width="100%" height="100%" fill="${b.bg}"/>
  <defs>
    <clipPath id="ws-sphere">
      <circle cx="${fmt(b.cx)}" cy="${fmt(b.cy)}" r="${fmt(b.rad)}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#ws-sphere)">
    ${b.pathMarkup}
  </g>
  ${
    STATE.sphereMaskStrokeEnabled
      ? `<circle cx="${fmt(b.cx)}" cy="${fmt(b.cy)}" r="${fmt(b.rad)}" fill="none" stroke="#000000" stroke-width="1"/>`
      : ""
  }
</svg>`;
}

/** Scale halftone field patch content into canvas pixel space when viewBox size differs (e.g. flat grid). */
function scaleVasFragmentToCanvas(innerHtml, vasWAttr, vasHAttr, cw, ch) {
  if (!innerHtml) return "";
  const vw = parseFloat(String(vasWAttr), 10);
  const vh = parseFloat(String(vasHAttr), 10);
  if (!Number.isFinite(vw) || !Number.isFinite(vh) || vw <= 0 || vh <= 0 || !cw || !ch) return innerHtml;
  if (Math.abs(vw - cw) < 0.5 && Math.abs(vh - ch) < 0.5) return innerHtml;
  return `<g transform="scale(${cw / vw} ${ch / vh})">${innerHtml}</g>`;
}

function buildExportSVGDocument(options = {}) {
  const layers = options.layers || "all";
  const background = options.background || { transparent: false, color: "#ffffff" };
  const showHalftone = layers === "all" || layers === "halftone" || layers === "type-halftone";
  const showType = layers === "all" || layers === "type" || layers === "type-halftone";
  const showOver = layers === "all" || layers === "over-dots";

  const b = showType ? buildTypeSpherePathMarkup() : null;
  const parts =
    showHalftone || showOver
      ? typeof window.Vasarely?.getExportParts === "function"
        ? window.Vasarely.getExportParts()
        : null
      : null;

  const cw = exportMode?.width || b?.w || parseFloat(parts?.width) || 1200;
  const ch = exportMode?.height || b?.h || parseFloat(parts?.height) || 1200;
  if (!b && !parts) return "";

  const cx = b?.cx ?? cw / 2;
  const cy = b?.cy ?? ch / 2;
  const rad = b?.rad ?? Math.min(cw, ch) * 0.42;
  const pathMarkup = b?.pathMarkup || "";

  let checkerLayer = "";
  let backDotsLayer = "";
  let frontLayer = "";
  if (parts && showHalftone) {
    checkerLayer = scaleVasFragmentToCanvas(parts.checkerGroup, parts.width, parts.height, cw, ch);
    backDotsLayer = scaleVasFragmentToCanvas(parts.halftoneBackGroup, parts.width, parts.height, cw, ch);
  }
  if (parts && showOver) {
    const frontWrapped = parts.halftoneFrontFragment
      ? `<g shape-rendering="geometricPrecision">${parts.halftoneFrontFragment}</g>`
      : "";
    frontLayer = scaleVasFragmentToCanvas(frontWrapped, parts.width, parts.height, cw, ch);
  }

  const bgRect = background.transparent
    ? ""
    : `<rect width="100%" height="100%" fill="${background.color || "#ffffff"}"/>`;

  const typeBlock =
    showType && pathMarkup
      ? `<defs>
    <clipPath id="ws-sphere-stack">
      <circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(rad)}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#ws-sphere-stack)">
    ${pathMarkup}
  </g>`
      : "";

  const maskStroke =
    showType && b && STATE.sphereMaskStrokeEnabled
      ? `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(rad)}" fill="none" stroke="#000000" stroke-width="1"/>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}" viewBox="0 0 ${cw} ${ch}">
  ${bgRect}
  ${checkerLayer}
  ${backDotsLayer}
  ${typeBlock}
  ${frontLayer}
  ${maskStroke}
</svg>`;
}

function buildCombinedSVGDocument() {
  return buildExportSVGDocument({
    layers: "all",
    background: { transparent: false, color: "#ffffff" },
  });
}

let exportFeedbackTimer = 0;
function flashExportFeedback(msg) {
  const el = document.getElementById("export-feedback");
  if (!el) return;
  el.textContent = msg;
  clearTimeout(exportFeedbackTimer);
  exportFeedbackTimer = setTimeout(() => {
    el.textContent = "";
  }, 3200);
}

async function copySvgToClipboard(svgString, successMsg) {
  if (!svgString) {
    flashExportFeedback("Nothing to copy (load a font / draw the field first).");
    return;
  }
  try {
    await navigator.clipboard.writeText(svgString);
    flashExportFeedback(successMsg || "Copied SVG to clipboard.");
  } catch (err) {
    console.warn(err);
    flashExportFeedback("Clipboard failed — use HTTPS or allow clipboard access.");
  }
}

function sketch(p) {
  p.setup = function () {
    const wrap = document.getElementById("canvas-wrap");
    let w = wrap?.clientWidth || (isEmbedPage() ? window.innerWidth : 0) || 800;
    let h = wrap?.clientHeight || (isEmbedPage() ? window.innerHeight : 0) || 600;
    if (isEmbedPage() && document.documentElement.classList.contains("gmc-embed-loading") && !isEmbedLayoutSane(w, h)) {
      w = 64;
      h = 64;
    }
    p.createCanvas(w, h);
    pInst = p;
    if (isEmbedPage() && document.documentElement.classList.contains("gmc-embed-loading")) {
      p.noLoop();
    }
    const pc = wrap?.querySelector?.("canvas.p5Canvas");
    if (pc) {
      pc.style.position = "relative";
      pc.style.zIndex = "1";
      pc.style.background = "transparent";
    }
    bindSphereTiltCanvasDrag(() => pInst, p.canvas);
  };

  p.windowResized = function () {
    if (exportMode?.liveEmbed) {
      syncEmbedLayout();
      return;
    }
    resizeCanvasFromWrap();
  };

  p.draw = function () {
    const w = p.width;
    const h = p.height;
    const { cx, cy, rad } = layoutMetrics(w, h);

    if (STATE.playing && (!exportMode || exportMode.liveEmbed)) {
      STATE.spin += STATE.spinSpeed;
    }

    const degNorm = ((((STATE.spin * 180) / Math.PI) % 360) + 360) % 360;
    const al = document.getElementById("angle-label");
    if (al) al.textContent = `${Math.round(degNorm)}°`;

    const inkHex = STATE.typeColorHex || "#000000";
    const inkGhost = hexToP5Color(p, inkHex, STATE.echoAlpha * 255);

    const wrap = document.getElementById("canvas-wrap");
    const vas = document.getElementById("vas-c");
    const vasFront = document.getElementById("vas-c-front");
    if (wrap) {
      wrap.style.setProperty("--sphere-r", `${rad}px`);
      wrap.style.setProperty("--sphere-x", `${cx}px`);
      wrap.style.setProperty("--sphere-y", `${cy}px`);
      if (vas) {
        if (STATE.vasarelyEnabled) {
          vas.style.display = "block";
          if (vasFront) vasFront.style.display = "block";
        } else {
          vas.style.display = "none";
          if (vasFront) vasFront.style.display = "none";
        }
      }
      syncGlassOverlay();
    }

    p.clear();
    p.push();
    p.translate(cx, cy);

    const ctx = p.drawingContext;
    if (ctx && ctx.save) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.clip();
      if (!STATE.vasarelyEnabled) {
        const sphere = getLiveSphereInteriorColors();
        ctx.fillStyle = sphere.colorA || "#f8f8f4";
        ctx.fill();
      }
    }

    const tms = getExportTimeMs(p.millis());
    const echoN = exportMode?.suppressEcho ? 0 : STATE.echoCount;
    for (let e = echoN; e >= 1; e--) {
      const off = STATE.spin - e * STATE.echoStep;
      drawContoursProjected(p, off, inkGhost, rad, tms);
    }

    drawContoursProjected(p, STATE.spin, hexToP5Color(p, inkHex), rad, tms);

    if (ctx && ctx.restore) ctx.restore();

    if (
      STATE.vasarelyEnabled &&
      typeof window.Vasarely?.draw === "function" &&
      document.getElementById("vaz-sphere")?.checked !== false
    ) {
      window.Vasarely.draw();
    }

    if (STATE.sphereMaskStrokeEnabled) {
      p.noFill();
      p.stroke(hexToP5Color(p, "#000000"));
      p.strokeWeight(1);
      p.circle(0, 0, rad * 2);
    }

    p.pop();
  };
}

function mountP5() {
  const inst = new p5(sketch, "text-layer");
  watchCanvasWrapResize();
  return inst;
}

function loadFontFromBuffer(buffer, name, onDone) {
  try {
    const ot = typeof globalThis !== "undefined" ? globalThis.opentype : null;
    if (!ot || typeof ot.parse !== "function") {
      onDone?.(new Error("OpenType parser not loaded yet (check network / module script)."));
      return;
    }
    const f = ot.parse(buffer);
    STATE.font = f;
    STATE.fontName = name || "Uploaded";
    contoursCache = null;
    cacheKey = "";
    syncVariationStateFromFont();
    onDone?.(null);
  } catch (err) {
    onDone?.(err);
  }
}

function applyBundledFont() {
  return activateFontSelection(DEFAULT_FONT_ID);
}

/** Network path when fetch works; base64 in bundled-font-data.js is the offline fallback. */
const DEFAULT_FONT_SOURCES = [
  { url: "fonts/FocalText-Regular.otf", label: "Focal Text Regular", id: DEFAULT_FONT_ID },
  {
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf",
    label: "Inter VF",
  },
];

function loadDefaultFont() {
  const st = () => document.getElementById("font-status");
  const trySource = (i) => {
    if (i >= DEFAULT_FONT_SOURCES.length) {
      if (st())
        st().textContent =
          "No bundled font loaded. Reload the page or upload a .otf/.ttf.";
      return Promise.reject(new Error("default font"));
    }
    const source = DEFAULT_FONT_SOURCES[i];
    const { url, label } = source;
    const fromNet = url.startsWith("http");
    const fromEmbed = source.id ? window.GMC_BUNDLED_FONT_DATA?.[source.id] : null;
    const loadBuf = (buf) =>
      new Promise((resolve, reject) => {
        loadFontFromBuffer(buf, label, (e) => {
          if (e) {
            if (st()) st().textContent = String(e);
            reject(e);
            return;
          }
          if (st()) {
            const base =
              label === "Inter VF"
                ? `${STATE.fontName} · Arial-like starter (OFL)`
                : `${STATE.fontName} · bundled`;
            st().textContent = fromNet ? `${base} (loaded from network)` : base;
          }
          if (pInst) pInst.redraw();
          resolve();
        });
      });
    if (fromEmbed) {
      return loadBuf(base64ToArrayBuffer(fromEmbed)).catch(() => trySource(i + 1));
    }
    return fetch(url, { mode: "cors", cache: "default" })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      })
      .then((buf) => loadBuf(buf))
      .catch(() => trySource(i + 1));
  };
  if (st()) st().textContent = "Loading default font…";
  return trySource(0);
}

function collectPresetBody() {
  const fs = document.getElementById("saved-font-select");
  const fontSelect = normalizeFontSelectId(fs?.value || DEFAULT_FONT_ID);
  const fontBundledKey = bundledFontKeyForId(fontSelect);
  return {
    text: STATE.text,
    fontSelect,
    ...(fontBundledKey ? { fontBundledKey } : {}),
    playing: STATE.playing,
    spin: STATE.spin,
    fontSize: STATE.fontSize,
    spinSpeed: STATE.spinSpeed,
    horizontalArcDeg: STATE.horizontalArcDeg,
    verticalArcDeg: STATE.verticalArcDeg,
    sphereR: STATE.sphereR,
    focal: STATE.focal,
    camZ: STATE.camZ,
    tiltXDeg: STATE.tiltXDeg,
    tiltYDeg: STATE.tiltYDeg,
    typeColorHex: STATE.typeColorHex,
    echoCount: STATE.echoCount,
    echoStep: STATE.echoStep,
    echoAlpha: STATE.echoAlpha,
    curveSteps: STATE.curveSteps,
    circlePad: STATE.circlePad,
    snapDeg: STATE.snapDeg,
    variations: { ...STATE.variations },
    displacementAmount: STATE.displacementAmount,
    displacementScale: STATE.displacementScale,
    displacementAnimate: STATE.displacementAnimate,
    displacementSpeed: STATE.displacementSpeed,
    displacementChecker: STATE.displacementChecker,
    displacementCheckerSize: STATE.displacementCheckerSize,
    vasarelyEnabled: STATE.vasarelyEnabled,
    typeRadialScale: STATE.typeRadialScale,
    typeZOffset: STATE.typeZOffset,
    fieldRadialScale: STATE.fieldRadialScale,
    fieldElementScale: STATE.fieldElementScale,
    sphereMaskStrokeEnabled: STATE.sphereMaskStrokeEnabled,
    glassEnabled: STATE.glassEnabled,
    glassBlur: STATE.glassBlur,
    glassFrost: STATE.glassFrost,
    glassShine: STATE.glassShine,
    glassBlurText: STATE.glassBlurText,
    glassBlurBlobs: STATE.glassBlurBlobs,
  };
}

function pushStateToDom() {
  const ti = document.getElementById("text-input");
  if (ti) ti.value = STATE.text;

  const setR = (id, v, lid, fmt) => {
    const el = document.getElementById(id);
    if (el) el.value = String(v);
    if (lid) setVal(lid, fmt(v));
  };

  setR("font-size", STATE.fontSize, "fs-val", (v) => String(v));
  const speedRaw = Math.max(0, Math.min(40, Math.round(STATE.spinSpeed * 1000)));
  setR("speed", speedRaw, "speed-val", (v) => (Number(v) / 1000).toFixed(3));
  setR("arc-h", STATE.horizontalArcDeg, "arc-h-val", (v) => `${v}°`);
  setR("arc-v", STATE.verticalArcDeg, "arc-v-val", (v) => `${v}°`);
  setR("focal", STATE.focal, "focal-val", (v) => String(v));
  setR("cam", STATE.camZ, "cam-val", (v) => String(v));
  setR("type-radial", Math.round(STATE.typeRadialScale * 100), "type-radial-val", (v) => (Number(v) / 100).toFixed(2));
  setR("type-zoff", STATE.typeZOffset, "type-zoff-val", (v) => String(Math.round(Number(v))));
  setR("field-radial", Math.round(STATE.fieldRadialScale * 100), "field-radial-val", (v) => (Number(v) / 100).toFixed(2));
  setR("field-el-scale", Math.round(STATE.fieldElementScale * 100), "field-el-scale-val", (v) => (Number(v) / 100).toFixed(2));
  setR("tilt", STATE.tiltXDeg, "tilt-val", (v) => `${v}°`);
  setR("tilt-y", STATE.tiltYDeg, "tilt-y-val", (v) => `${v}°`);
  setR("glass-blur", STATE.glassBlur, "glass-blur-val", (v) => `${v}px`);
  setR("glass-frost", STATE.glassFrost, "glass-frost-val", (v) => `${v}%`);
  setR("glass-shine", STATE.glassShine, "glass-shine-val", (v) => `${v}%`);
  const tc = document.getElementById("type-color");
  if (tc) tc.value = /^#[0-9a-fA-F]{6}$/.test(STATE.typeColorHex) ? STATE.typeColorHex : "#5718C0";
  setR("echo-n", STATE.echoCount, "echo-n-val", (v) => String(Math.round(Number(v))));
  const echoStepR = Math.max(5, Math.min(120, Math.round(STATE.echoStep * 1000)));
  setR("echo-step", echoStepR, "echo-step-val", (v) => (Number(v) / 1000).toFixed(3));
  const echoAR = Math.max(5, Math.min(80, Math.round(STATE.echoAlpha * 100)));
  setR("echo-a", echoAR, "echo-a-val", (v) => `${v}%`);
  setR("curve", STATE.curveSteps, "curve-val", (v) => String(Math.round(Number(v))));
  const padR = Math.max(70, Math.min(100, Math.round(STATE.circlePad * 100)));
  setR("pad", padR, "pad-val", (v) => `${v}%`);

  setR("displacement", STATE.displacementAmount, "displacement-val", (v) => `${v}%`);
  setR("displacement-scale", STATE.displacementScale, "displacement-scale-val", (v) => `${v}%`);
  setR("displacement-anim", STATE.displacementAnimate, "displacement-anim-val", (v) => `${v}%`);
  setR("displacement-speed", STATE.displacementSpeed, "displacement-speed-val", (v) => `${v}%`);
  setR("displacement-checker", STATE.displacementChecker, "displacement-checker-val", (v) => `${v}%`);
  setR(
    "displacement-checker-size",
    STATE.displacementCheckerSize,
    "displacement-checker-size-val",
    (v) => `${v}%`
  );

  const deg = Math.round(((((STATE.spin * 180) / Math.PI) % 360) + 360) % 360);
  setR("angle-slider", deg, "angle-label", (v) => `${Math.round(Number(v))}°`);

  const tb = document.getElementById("toggle-play");
  if (tb) tb.textContent = STATE.playing ? "Pause" : "Play";

  const vasT = document.getElementById("vas-toggle");
  if (vasT) vasT.checked = STATE.vasarelyEnabled;
  const sms = document.getElementById("sphere-mask-stroke");
  if (sms) sms.checked = STATE.sphereMaskStrokeEnabled;
  const ge = document.getElementById("glass-enabled");
  if (ge) ge.checked = STATE.glassEnabled;
  const gbt = document.getElementById("glass-blur-text");
  if (gbt) gbt.checked = STATE.glassBlurText;
  const gbb = document.getElementById("glass-blur-blobs");
  if (gbb) gbb.checked = STATE.glassBlurBlobs;
  syncGlassOverlay();
}

function isSphereTabActive() {
  const view = document.getElementById("view-sphere");
  return !!view && view.classList.contains("is-active") && !view.hidden;
}

async function loadPresetBySlot(slot) {
  if (slot < 0 || slot > 8) return;
  let rows = [];
  try {
    rows = await idbListPresets();
  } catch (e) {
    console.warn(e);
    return;
  }
  rows.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  const rec = rows[slot];
  if (!rec) return;
  const presetMsg = document.getElementById("preset-msg");
  try {
    const full = await idbGetPreset(rec.id);
    if (!full) return;
    await applyPresetRecord(full);
    rememberActivePresetId(rec.id);
    const nameEl = document.getElementById("preset-name");
    if (nameEl) nameEl.value = full.name || "";
    await refreshPresetSelect(rec.id);
    if (presetMsg) presetMsg.textContent = `Loaded · ${full.name || "Untitled"} [${slot + 1}]`;
  } catch (err) {
    console.warn(err);
    if (presetMsg) presetMsg.textContent = "Could not load preset.";
  }
}

async function deletePresetById(id) {
  const presetMsg = document.getElementById("preset-msg");
  if (!id) {
    if (presetMsg) presetMsg.textContent = "Choose a preset to delete.";
    return;
  }
  try {
    await idbDeletePreset(id);
    clearStoredPresetIdIfMatch(id);
    await refreshPresetSelect("");
    if (presetMsg) presetMsg.textContent = "Preset removed.";
  } catch (err) {
    console.warn(err);
    if (presetMsg) presetMsg.textContent = "Could not delete preset.";
  }
}

async function refreshPresetSelect(selectedId) {
  let rows = [];
  try {
    rows = await idbListPresets();
  } catch (e) {
    console.warn(e);
  }
  const keep =
    selectedId !== undefined && selectedId !== null ? selectedId : getStoredActivePresetId();

  const list = document.getElementById("canvas-preset-list");
  if (!list) return;
  list.innerHTML = "";
  if (!rows.length) {
    list.innerHTML = '<div class="canvas-preset-empty">no presets saved</div>';
    return;
  }

  rows.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  const presetMsg = document.getElementById("preset-msg");

  rows.forEach((r, i) => {
    const row = document.createElement("div");
    row.className = "canvas-preset-item" + (r.id === keep ? " is-active" : "");
    row.dataset.id = r.id;

    const loadBtn = document.createElement("button");
    loadBtn.type = "button";
    loadBtn.className = "canvas-preset-load";
    const label = r.name || "Untitled";
    const slot = i < 9 ? i + 1 : null;
    loadBtn.textContent = slot ? `${slot} · ${label}` : label;
    loadBtn.title = slot ? `[${slot}] ${label}` : label;
    loadBtn.addEventListener("click", async () => {
      try {
        const rec = await idbGetPreset(r.id);
        if (!rec) return;
        await applyPresetRecord(rec);
        rememberActivePresetId(r.id);
        const nameEl = document.getElementById("preset-name");
        if (nameEl) nameEl.value = r.name || "";
        await refreshPresetSelect(r.id);
        if (presetMsg) presetMsg.textContent = `Loaded · ${r.name || "Untitled"}`;
      } catch (err) {
        console.warn(err);
        if (presetMsg) presetMsg.textContent = "Could not load preset.";
      }
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "canvas-preset-del";
    delBtn.textContent = "×";
    delBtn.title = "Delete";
    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const label = r.name || "Untitled";
      if (!confirm(`Delete "${label}"?`)) return;
      await deletePresetById(r.id);
    });

    row.appendChild(loadBtn);
    row.appendChild(delBtn);
    list.appendChild(row);
  });
}

async function activateFontSelection(fontSelectValue) {
  if (fontSelectValue === "__bundled__") {
    await loadDefaultFont().catch(() => {});
    lastFontBuffer = null;
    lastFontLabel = "";
    return;
  }
  const fr = await idbGetFont(fontSelectValue);
  if (!fr?.buffer) {
    await loadDefaultFont().catch(() => {});
    lastFontBuffer = null;
    lastFontLabel = "";
    return;
  }
  const buf = fr.buffer.slice(0);
  lastFontBuffer = buf;
  lastFontLabel = fr.name || "Saved";
  loadFontFromBuffer(buf, lastFontLabel, (err) => {
    if (err) console.warn(err);
    const st = document.getElementById("font-status");
    if (st && !err) st.textContent = STATE.fontName;
    if (pInst) pInst.redraw();
  });
}

async function applyPresetRecord(rec, { applyFont = true } = {}) {
  if (
    !rec ||
    (rec.schema !== 1 &&
      rec.schema !== 2 &&
      rec.schema !== 3 &&
      rec.schema !== 4 &&
      rec.schema !== 5 &&
      rec.schema !== 6 &&
      rec.schema !== 7 &&
      rec.schema !== 8 &&
      rec.schema !== 9 &&
      rec.schema !== 10)
  ) {
    return;
  }

  STATE.text = rec.text ?? "GMC";
  STATE.playing = rec.playing ?? false;
  STATE.spin =
    typeof rec.spin === "number" ? rec.spin : (359 * Math.PI) / 180;
  STATE.fontSize = rec.fontSize ?? 244;
  STATE.spinSpeed = rec.spinSpeed ?? 0;
  STATE.horizontalArcDeg = rec.horizontalArcDeg ?? 360;
  STATE.verticalArcDeg = rec.verticalArcDeg ?? 120;
  STATE.sphereR = rec.sphereR ?? 1;
  STATE.focal = rec.focal ?? 740;
  STATE.camZ = rec.camZ ?? 510;
  STATE.tiltXDeg = rec.tiltXDeg ?? 14;
  STATE.tiltYDeg = rec.tiltYDeg ?? 0;
  if (rec.schema >= 8 && typeof rec.typeColorHex === "string" && /^#[0-9a-fA-F]{6}$/.test(rec.typeColorHex)) {
    STATE.typeColorHex = rec.typeColorHex;
  } else {
    STATE.typeColorHex = "#5718C0";
  }
  STATE.echoCount = rec.echoCount ?? 0;
  STATE.echoStep = rec.echoStep ?? 0.005;
  STATE.echoAlpha = rec.echoAlpha ?? 0.05;
  STATE.curveSteps = rec.curveSteps ?? 24;
  STATE.circlePad = rec.circlePad ?? 0.92;
  STATE.snapDeg = rec.snapDeg ?? 15;
  STATE.displacementAmount = rec.displacementAmount ?? 0;
  STATE.displacementScale = rec.displacementScale ?? 48;
  STATE.displacementAnimate = rec.displacementAnimate ?? 0;
  STATE.displacementSpeed = rec.displacementSpeed ?? 50;
  STATE.displacementChecker = rec.displacementChecker ?? 0;
  STATE.displacementCheckerSize = rec.displacementCheckerSize ?? 45;
  if (rec.schema >= 6 && typeof rec.vasarelyEnabled === "boolean") {
    STATE.vasarelyEnabled = rec.vasarelyEnabled;
  }
  if (rec.schema >= 7) {
    if (typeof rec.typeRadialScale === "number") STATE.typeRadialScale = rec.typeRadialScale;
    if (typeof rec.typeZOffset === "number") STATE.typeZOffset = rec.typeZOffset;
    if (typeof rec.fieldRadialScale === "number") STATE.fieldRadialScale = rec.fieldRadialScale;
    if (typeof rec.fieldElementScale === "number") STATE.fieldElementScale = rec.fieldElementScale;
  }
  STATE.sphereMaskStrokeEnabled = rec.sphereMaskStrokeEnabled === true;
  if (rec.schema >= 9) {
    STATE.glassEnabled = rec.glassEnabled === true;
    STATE.glassBlur = typeof rec.glassBlur === "number" ? rec.glassBlur : 0;
    STATE.glassFrost = typeof rec.glassFrost === "number" ? rec.glassFrost : 0;
    STATE.glassShine = typeof rec.glassShine === "number" ? rec.glassShine : 0;
  } else {
    STATE.glassEnabled = false;
    STATE.glassBlur = 0;
    STATE.glassFrost = 0;
    STATE.glassShine = 0;
  }
  if (rec.schema >= 10) {
    STATE.glassBlurText = rec.glassBlurText === true;
    STATE.glassBlurBlobs = rec.glassBlurBlobs === true;
  } else {
    STATE.glassBlurText = false;
    STATE.glassBlurBlobs = false;
  }

  contoursCache = null;
  cacheKey = "";

  if (applyFont) {
    const wanted = resolvePresetFontSelect(rec);
    await refreshSavedFontSelect(wanted);
    const fs = document.getElementById("saved-font-select");
    if (fs) {
      const useFont = [...fs.options].some((o) => o.value === wanted) ? wanted : "__bundled__";
      fs.value = useFont;
      await activateFontSelection(useFont);
      rememberActiveFontId(useFont);
    }
  }

  if (rec.schema >= 2 && rec.variations && typeof rec.variations === "object") {
    for (const k of Object.keys(rec.variations)) {
      if (typeof rec.variations[k] === "number") STATE.variations[k] = rec.variations[k];
    }
    syncVariationStateFromFont();
  }

  pushStateToDom();
  if (pInst) pInst.redraw();
}

function setVal(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function wireUI() {
  syncCanvasBackground();
  const canvasBgChecker = document.getElementById("canvas-bg-checker");
  if (canvasBgChecker) {
    canvasBgChecker.addEventListener("change", () => {
      setCanvasBackgroundMode(canvasBgChecker.checked ? "checker" : "white");
    });
  }

  const bindRange = (id, apply, labelId, fmt) => {
    const el = document.getElementById(id);
    if (!el) return;
    const sync = () => {
      apply(el.value);
      if (labelId) setVal(labelId, fmt(el.value));
      if (pInst) pInst.redraw();
    };
    el.addEventListener("input", sync);
    sync();
  };

  document.getElementById("text-input").addEventListener("input", (e) => {
    STATE.text = e.target.value;
    contoursCache = null;
    cacheKey = "";
    if (pInst) pInst.redraw();
  });

  const vfAxesEl = document.getElementById("vf-axes");
  if (vfAxesEl) {
    vfAxesEl.addEventListener("input", (e) => {
      const t = e.target;
      if (!t.classList?.contains("vf-axis")) return;
      const tag = t.dataset.axisTag;
      if (!tag) return;
      STATE.variations[tag] = Number(t.value);
      const vid = t.dataset.valId;
      if (vid) {
        const lab = document.getElementById(`vf-val-${vid}`);
        if (lab) lab.textContent = formatVariationValue(Number(t.value));
      }
      contoursCache = null;
      cacheKey = "";
      if (pInst) pInst.redraw();
    });
  }

  document.getElementById("font-file").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const buf = reader.result;
      lastFontBuffer = buf.slice(0);
      lastFontLabel = file.name.replace(/\.[^.]+$/, "");
      loadFontFromBuffer(buf, lastFontLabel, (err) => {
        const st = document.getElementById("font-status");
        if (st) st.textContent = err ? "Parse error" : STATE.fontName;
        if (pInst) pInst.redraw();
      });
      const sn = document.getElementById("save-font-name");
      if (sn && !sn.value) sn.placeholder = lastFontLabel;
    };
    reader.readAsArrayBuffer(file);
  });

  document.getElementById("saved-font-select").addEventListener("change", async (e) => {
    try {
      await activateFontSelection(e.target.value);
      rememberActiveFontId(e.target.value);
    } catch (err) {
      console.warn(err);
    }
    if (pInst) pInst.redraw();
  });

  document.getElementById("save-font-btn").addEventListener("click", async () => {
    const st = document.getElementById("font-status");
    if (!lastFontBuffer) {
      if (st) st.textContent = "Upload a font or pick a saved one first";
      return;
    }
    const nameEl = document.getElementById("save-font-name");
    const name = (nameEl?.value || "").trim() || lastFontLabel || "My font";
    try {
      const rows = await idbListFonts();
      const existing = rows.find((r) => (r.name || "").trim().toLowerCase() === name.toLowerCase());
      const id = existing?.id || crypto.randomUUID();
      await idbPutFont({
        id,
        name,
        buffer: lastFontBuffer.slice(0),
        savedAt: Date.now(),
      });
      await refreshSavedFontSelect(id);
      rememberActiveFontId(id);
      if (st) st.textContent = `Saved · ${name}`;
      if (nameEl) nameEl.value = "";
    } catch (err) {
      console.warn(err);
      if (st) st.textContent = "Could not save (IndexedDB?)";
    }
  });

  document.getElementById("delete-saved-font").addEventListener("click", async () => {
    const sel = document.getElementById("saved-font-select");
    const id = sel?.value;
    const st = document.getElementById("font-status");
    if (!id || id === "__bundled__") {
      if (st) st.textContent = "Pick a saved font to remove";
      return;
    }
    try {
      await idbDeleteFont(id);
      const nextId = await getMostRecentlySavedFontId();
      await refreshSavedFontSelect(nextId || "__bundled__");
      const nextFont = document.getElementById("saved-font-select")?.value || "__bundled__";
      await activateFontSelection(nextFont);
      rememberActiveFontId(nextFont);
      if (st) st.textContent = nextId ? "Removed — using next saved font" : "Removed — bundled font";
    } catch (err) {
      console.warn(err);
      if (st) st.textContent = "Could not remove";
    }
  });

  bindRange(
    "font-size",
    (v) => {
      STATE.fontSize = Number(v);
    },
    "fs-val",
    (v) => String(v)
  );

  bindRange(
    "speed",
    (v) => {
      STATE.spinSpeed = Number(v) / 1000;
    },
    "speed-val",
    (v) => (Number(v) / 1000).toFixed(3)
  );

  bindRange(
    "arc-h",
    (v) => {
      STATE.horizontalArcDeg = Number(v);
    },
    "arc-h-val",
    (v) => `${v}°`
  );

  bindRange(
    "arc-v",
    (v) => {
      STATE.verticalArcDeg = Number(v);
    },
    "arc-v-val",
    (v) => `${v}°`
  );

  bindRange(
    "focal",
    (v) => {
      STATE.focal = Number(v);
    },
    "focal-val",
    (v) => String(v)
  );

  bindRange(
    "cam",
    (v) => {
      STATE.camZ = Number(v);
    },
    "cam-val",
    (v) => String(v)
  );

  bindRange(
    "type-radial",
    (v) => {
      STATE.typeRadialScale = Number(v) / 100;
    },
    "type-radial-val",
    (v) => (Number(v) / 100).toFixed(2)
  );

  bindRange(
    "type-zoff",
    (v) => {
      STATE.typeZOffset = Number(v);
    },
    "type-zoff-val",
    (v) => String(Math.round(Number(v)))
  );

  bindRange(
    "field-radial",
    (v) => {
      STATE.fieldRadialScale = Number(v) / 100;
    },
    "field-radial-val",
    (v) => (Number(v) / 100).toFixed(2)
  );

  bindRange(
    "field-el-scale",
    (v) => {
      STATE.fieldElementScale = Number(v) / 100;
    },
    "field-el-scale-val",
    (v) => (Number(v) / 100).toFixed(2)
  );

  bindRange(
    "tilt",
    (v) => {
      STATE.tiltXDeg = Number(v);
    },
    "tilt-val",
    (v) => `${v}°`
  );

  bindRange(
    "tilt-y",
    (v) => {
      STATE.tiltYDeg = Number(v);
    },
    "tilt-y-val",
    (v) => `${v}°`
  );

  const bindGlassRange = (id, apply, labelId, fmt) => {
    const el = document.getElementById(id);
    if (!el) return;
    const sync = () => {
      apply(el.value);
      if (labelId) setVal(labelId, fmt(el.value));
      syncGlassOverlay();
    };
    el.addEventListener("input", sync);
    sync();
  };

  bindGlassRange(
    "glass-blur",
    (v) => {
      STATE.glassBlur = Number(v);
    },
    "glass-blur-val",
    (v) => `${v}px`
  );

  bindGlassRange(
    "glass-frost",
    (v) => {
      STATE.glassFrost = Number(v);
    },
    "glass-frost-val",
    (v) => `${v}%`
  );

  bindGlassRange(
    "glass-shine",
    (v) => {
      STATE.glassShine = Number(v);
    },
    "glass-shine-val",
    (v) => `${v}%`
  );

  const typeColorEl = document.getElementById("type-color");
  if (typeColorEl) {
    const syncTypeColor = () => {
      const v = typeColorEl.value;
      if (/^#[0-9a-fA-F]{6}$/.test(v)) STATE.typeColorHex = v;
      if (pInst) pInst.redraw();
    };
    typeColorEl.addEventListener("input", syncTypeColor);
    typeColorEl.addEventListener("change", syncTypeColor);
  }

  bindRange(
    "echo-n",
    (v) => {
      STATE.echoCount = Math.max(0, Math.round(Number(v)));
    },
    "echo-n-val",
    (v) => String(Math.round(Number(v)))
  );

  bindRange(
    "echo-step",
    (v) => {
      STATE.echoStep = Number(v) / 1000;
    },
    "echo-step-val",
    (v) => (Number(v) / 1000).toFixed(3)
  );

  bindRange(
    "echo-a",
    (v) => {
      STATE.echoAlpha = Number(v) / 100;
    },
    "echo-a-val",
    (v) => `${v}%`
  );

  bindRange(
    "displacement",
    (v) => {
      STATE.displacementAmount = Number(v);
    },
    "displacement-val",
    (v) => `${v}%`
  );

  bindRange(
    "displacement-scale",
    (v) => {
      STATE.displacementScale = Number(v);
    },
    "displacement-scale-val",
    (v) => `${v}%`
  );

  bindRange(
    "displacement-anim",
    (v) => {
      STATE.displacementAnimate = Number(v);
    },
    "displacement-anim-val",
    (v) => `${v}%`
  );

  bindRange(
    "displacement-speed",
    (v) => {
      STATE.displacementSpeed = Number(v);
    },
    "displacement-speed-val",
    (v) => `${v}%`
  );

  bindRange(
    "displacement-checker",
    (v) => {
      STATE.displacementChecker = Number(v);
    },
    "displacement-checker-val",
    (v) => `${v}%`
  );

  bindRange(
    "displacement-checker-size",
    (v) => {
      STATE.displacementCheckerSize = Number(v);
    },
    "displacement-checker-size-val",
    (v) => `${v}%`
  );

  bindRange(
    "curve",
    (v) => {
      STATE.curveSteps = Math.max(3, Math.round(Number(v)));
    },
    "curve-val",
    (v) => String(Math.round(Number(v)))
  );

  bindRange(
    "pad",
    (v) => {
      STATE.circlePad = Number(v) / 100;
    },
    "pad-val",
    (v) => `${v}%`
  );

  document.getElementById("toggle-play").addEventListener("click", () => {
    STATE.playing = !STATE.playing;
    document.getElementById("toggle-play").textContent = STATE.playing ? "Pause" : "Play";
    if (pInst) pInst.redraw();
  });

  const as = document.getElementById("angle-slider");
  as.addEventListener("input", (e) => {
    const deg = Number(e.target.value);
    STATE.spin = (deg * Math.PI) / 180;
    STATE.playing = false;
    document.getElementById("toggle-play").textContent = "Play";
    if (pInst) pInst.redraw();
  });

  const snap = (deg) => {
    STATE.playing = false;
    document.getElementById("toggle-play").textContent = "Play";
    STATE.spin = (deg * Math.PI) / 180;
    document.getElementById("angle-slider").value = String(deg);
    if (pInst) pInst.redraw();
  };

  document.getElementById("snap-0").addEventListener("click", () => snap(0));
  document.getElementById("snap-45").addEventListener("click", () => snap(45));
  document.getElementById("snap-90").addEventListener("click", () => snap(90));
  document.getElementById("snap-180").addEventListener("click", () => snap(180));

  document.getElementById("copy-svg-type")?.addEventListener("click", () => {
    copySvgToClipboard(buildSVGDocument(), "Copied type sphere SVG.");
  });
  document.getElementById("copy-svg-halftone")?.addEventListener("click", () => {
    const fn = window.Vasarely?.getHalftoneDotsSVGDocument;
    copySvgToClipboard(typeof fn === "function" ? fn() : "", "Copied halftone dots SVG.");
  });
  document.getElementById("copy-svg-both")?.addEventListener("click", () => {
    copySvgToClipboard(buildCombinedSVGDocument(), "Copied combined SVG.");
  });

  const vasT = document.getElementById("vas-toggle");
  if (vasT) {
    vasT.addEventListener("change", () => {
      STATE.vasarelyEnabled = vasT.checked;
      if (pInst) pInst.redraw();
    });
  }
  const sms = document.getElementById("sphere-mask-stroke");
  if (sms) {
    sms.addEventListener("change", () => {
      STATE.sphereMaskStrokeEnabled = sms.checked;
      syncGlassOverlay();
      if (pInst) pInst.redraw();
    });
  }

  const ge = document.getElementById("glass-enabled");
  if (ge) {
    ge.addEventListener("change", () => {
      STATE.glassEnabled = ge.checked;
      syncGlassOverlay();
    });
  }

  const gbt = document.getElementById("glass-blur-text");
  if (gbt) {
    gbt.addEventListener("change", () => {
      STATE.glassBlurText = gbt.checked;
      syncGlassOverlay();
    });
  }

  const gbb = document.getElementById("glass-blur-blobs");
  if (gbb) {
    gbb.addEventListener("change", () => {
      STATE.glassBlurBlobs = gbb.checked;
      syncGlassOverlay();
    });
  }

  const presetMsg = () => document.getElementById("preset-msg");

  document.getElementById("save-preset-btn")?.addEventListener("click", async () => {
    const nameEl = document.getElementById("preset-name");
    const name =
      (nameEl?.value || "").trim() ||
      `Look · ${new Date().toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}`;
    const id = crypto.randomUUID();
    try {
      await idbPutPreset({
        id,
        name,
        savedAt: Date.now(),
        schema: 10,
        ...collectPresetBody(),
      });
      rememberActivePresetId(id);
      await refreshPresetSelect(id);
      if (nameEl) nameEl.value = name;
      if (presetMsg()) presetMsg().textContent = `Saved · ${name}`;
    } catch (err) {
      console.warn(err);
      if (presetMsg()) presetMsg().textContent = "Could not save preset (IndexedDB?).";
    }
  });

  document.getElementById("preset-name")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("save-preset-btn")?.click();
  });

  document.getElementById("export-presets-btn")?.addEventListener("click", () => {
    exportPresetsToFile().catch((err) => console.warn(err));
  });

  document.getElementById("import-presets-btn")?.addEventListener("click", () => {
    document.getElementById("import-presets-file")?.click();
  });

  document.getElementById("import-presets-file")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      try {
        await importPresetsFromFile(file);
      } catch (err) {
        console.warn(err);
        if (presetMsg()) presetMsg().textContent = "Import failed.";
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && typingTarget(e.target)) {
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      STATE.playing = !STATE.playing;
      const btn = document.getElementById("toggle-play");
      if (btn) btn.textContent = STATE.playing ? "Pause" : "Play";
      if (pInst) pInst.redraw();
    }
    if (!STATE.playing && (e.key === "ArrowLeft" || e.key === "ArrowRight") && !typingTarget(e.target)) {
      e.preventDefault();
      const step = ((STATE.snapDeg * Math.PI) / 180) * (e.key === "ArrowLeft" ? -1 : 1);
      STATE.spin += step;
      const deg = Math.round(((((STATE.spin * 180) / Math.PI) % 360) + 360) % 360);
      const slider = document.getElementById("angle-slider");
      if (slider) slider.value = String(deg);
      if (pInst) pInst.redraw();
    }
    if (
      !typingTarget(e.target) &&
      isSphereTabActive() &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      e.key >= "1" &&
      e.key <= "9"
    ) {
      e.preventDefault();
      loadPresetBySlot(parseInt(e.key, 10) - 1);
    }
  });
}

function getCanvasBackgroundMode() {
  const bg = readExportBackgroundFromDom();
  if (bg.transparent) return "checker";
  if ((bg.color || "").toLowerCase() === "#ffffff") return "white";
  return bg;
}

function drawExportBackground(ctx, w, h, bg) {
  if (bg && typeof bg === "object") {
    if (bg.transparent) {
      ctx.clearRect(0, 0, w, h);
      return;
    }
    ctx.fillStyle = bg.color || "#ffffff";
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (bg === "white") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const size = 16;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#d4d4d4";
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      const ix = Math.floor(x / size);
      const iy = Math.floor(y / size);
      if ((ix + iy) % 2 === 0) ctx.fillRect(x, y, size, size);
    }
  }
}

async function svgElementToImage(svgEl, w, h) {
  if (!svgEl) return null;
  const clone = svgEl.cloneNode(true);
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function readEmbedBackground(background) {
  const canvasBg = background
    ? { transparent: !!background.transparent, color: background.color || "#ffffff" }
    : readExportBackgroundFromDom();
  const sphere =
    background?.sphereA !== undefined
      ? { colorA: background.sphereA || "#f8f8f4", colorB: background.sphereB || "#e4e4de" }
      : readSphereInteriorFromDom();
  return { canvasBg, sphere };
}

function beginExport({ width, height, transparentBg = false, background }) {
  const { canvasBg, sphere } = readEmbedBackground(background);
  const snapshot = {
    playing: STATE.playing,
    spin: STATE.spin,
    echoCount: STATE.echoCount,
    canvasW: pInst?.width || 0,
    canvasH: pInst?.height || 0,
  };
  STATE.playing = false;
  exportMode = {
    width,
    height,
    timeMs: 0,
    suppressEcho: true,
    transparentBg: !!canvasBg.transparent,
    exportBgColor: canvasBg.color || "#ffffff",
    sphereInterior: sphere,
  };
  if (pInst) pInst.resizeCanvas(width, height);
  return snapshot;
}

/** Live site embed — preset playback (spin speed, echo, displacement); export timing not used. */
function beginEmbedDisplay({ width, height, background }) {
  const { canvasBg, sphere } = readEmbedBackground(background);
  const snapshot = {
    playing: STATE.playing,
    spin: STATE.spin,
    echoCount: STATE.echoCount,
    canvasW: pInst?.width || 0,
    canvasH: pInst?.height || 0,
  };
  exportMode = {
    width,
    height,
    liveEmbed: true,
    transparentBg: !!canvasBg.transparent,
    exportBgColor: canvasBg.color || "#ffffff",
    sphereInterior: sphere,
  };
  if (pInst) pInst.resizeCanvas(width, height);
  return snapshot;
}

function endExport(snapshot) {
  exportMode = null;
  if (snapshot) {
    STATE.playing = snapshot.playing;
    STATE.spin = snapshot.spin;
    STATE.echoCount = snapshot.echoCount;
    if (pInst && snapshot.canvasW > 0 && snapshot.canvasH > 0) {
      pInst.resizeCanvas(snapshot.canvasW, snapshot.canvasH);
    }
  }
  syncGlassOverlay();
  if (typeof window.Vasarely?.draw === "function") window.Vasarely.draw();
  if (pInst) pInst.redraw();
}

function renderExportFrame(spin, timeMs) {
  if (!pInst) return;
  exportMode.timeMs = timeMs;
  STATE.spin = spin;
  if (STATE.vasarelyEnabled && typeof window.Vasarely?.draw === "function") {
    window.Vasarely.draw();
  }
  pInst.redraw();
}

async function compositeExportFrame(targetCanvas, bg, options = {}) {
  const layers = options.layers || "all";
  const w = targetCanvas.width;
  const h = targetCanvas.height;
  const ctx = targetCanvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const showHalftone = layers === "all" || layers === "halftone" || layers === "type-halftone";
  const showType = layers === "all" || layers === "type" || layers === "type-halftone";
  const showOver = layers === "all" || layers === "over-dots";

  if (bg && typeof bg === "object") {
    drawExportBackground(ctx, w, h, bg);
  } else {
    drawExportBackground(ctx, w, h, bg || getCanvasBackgroundMode());
  }

  const vas = document.getElementById("vas-c");
  const vasFront = document.getElementById("vas-c-front");
  const p5Canvas = document.querySelector("#text-layer canvas.p5Canvas");

  if (showHalftone && STATE.vasarelyEnabled && vas) {
    const backImg = await svgElementToImage(vas, w, h);
    if (backImg) ctx.drawImage(backImg, 0, 0, w, h);
  }

  if (showType && p5Canvas) ctx.drawImage(p5Canvas, 0, 0, w, h);

  if (showOver && STATE.vasarelyEnabled && vasFront?.innerHTML) {
    const frontImg = await svgElementToImage(vasFront, w, h);
    if (frontImg) ctx.drawImage(frontImg, 0, 0, w, h);
  }
}

let embedExportSnapshot = null;
let embedResizeObserver = null;

function getEmbedContainerSize() {
  const wrap = document.getElementById("canvas-wrap");
  const w = wrap?.clientWidth || window.innerWidth || 480;
  const h = wrap?.clientHeight || window.innerHeight || 480;
  return {
    width: Math.max(64, Math.round(w)),
    height: Math.max(64, Math.round(h)),
  };
}

function syncEmbedLayout() {
  if (!exportMode?.liveEmbed || !pInst) return false;
  const { width, height } = getEmbedContainerSize();
  if (width <= 0 || height <= 0) return false;
  const unchanged =
    exportMode.width === width &&
    exportMode.height === height &&
    pInst.width === width &&
    pInst.height === height;
  if (unchanged) return true;
  exportMode.width = width;
  exportMode.height = height;
  pInst.resizeCanvas(width, height);
  if (typeof window.Vasarely?.draw === "function") window.Vasarely.draw();
  pInst.redraw();
  syncGlassOverlay();
  return true;
}

function isEmbedLayoutSane(width, height) {
  if (!width || !height || width < 80 || height < 80) return false;
  const ratio = width / height;
  return ratio >= 0.55 && ratio <= 1.8;
}

function waitForEmbedLayoutReady(maxMs = 20000) {
  const start = performance.now();
  const stableNeeded = 3;
  let lastGood = null;
  let stableFrames = 0;
  return new Promise((resolve) => {
    let ro = null;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      ro?.disconnect();
      syncEmbedLayout();
      resolve();
    };
    const check = () => {
      const { width, height } = getEmbedContainerSize();
      if (isEmbedLayoutSane(width, height)) {
        if (lastGood?.width === width && lastGood?.height === height) {
          stableFrames += 1;
        } else {
          lastGood = { width, height };
          stableFrames = 1;
        }
        if (stableFrames >= stableNeeded) {
          finish();
          return true;
        }
      } else {
        lastGood = null;
        stableFrames = 0;
      }
      if (performance.now() - start > maxMs) {
        if (isEmbedLayoutSane(width, height)) {
          finish();
        } else {
          console.warn("GMC embed: layout still unstable after timeout — waiting for resize");
          return false;
        }
        return true;
      }
      return false;
    };
    const wrap = document.getElementById("canvas-wrap");
    if (wrap && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        if (!settled) syncEmbedLayout();
        check();
      });
      ro.observe(wrap);
      if (wrap.parentElement) ro.observe(wrap.parentElement);
      let node = wrap.parentElement;
      while (node && node !== document.body) {
        ro.observe(node);
        node = node.parentElement;
      }
    }
    window.addEventListener("resize", check, { passive: true });
    const tick = () => {
      if (!check()) requestAnimationFrame(tick);
    };
    requestAnimationFrame(() => requestAnimationFrame(tick));
  });
}

async function revealEmbedPlayer() {
  syncEmbedLayout();
  const { width, height } = getEmbedContainerSize();
  if (pInst && (pInst.width !== width || pInst.height !== height)) {
    pInst.resizeCanvas(width, height);
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  syncEmbedLayout();
  if (typeof window.Vasarely?.draw === "function") window.Vasarely.draw();
  if (pInst) {
    pInst.redraw();
    pInst.loop();
  }
  syncGlassOverlay();
  document.documentElement.classList.remove("gmc-embed-loading");
  document.documentElement.classList.add("gmc-embed-ready");
}

async function bootEmbedFromConfig(config) {
  if (!config?.export) return;

  document.documentElement.classList.add("gmc-embed-loading");
  document.documentElement.classList.remove("gmc-embed-ready");

  if (config.baked?.contours) {
    contoursCache = {
      contours: config.baked.contours,
      halfW: config.baked.halfW,
      halfH: config.baked.halfH,
    };
    cacheKey = "embed-baked";
  }

  if (config.preset) {
    await applyPresetRecord({ schema: 10, ...config.preset }, { applyFont: false });
  }

  if (!pInst) {
    mountP5();
    pInst?.noLoop();
  }

  if (!config.baked?.contours) {
    await mergeBundledFonts();
    if (config.preset) {
      await applyPresetRecord({ schema: 10, ...config.preset }, { applyFont: true });
    }
  }

  if (config.vas) window.Vasarely?.applyLocalSnapshot?.(config.vas);

  const bg = config.export?.background;
  if (bg) {
    applyExportBackgroundPreview({
      transparent: !!bg.transparent,
      color: bg.color || "#ffffff",
    });
  }

  await waitForEmbedLayoutReady();
  startEmbedLoop(config.export);
  await revealEmbedPlayer();
}

async function bootEmbedPage() {
  wireUI();
  const config = parseEmbedConfigFromHash();
  await bootEmbedFromConfig(config);
}

function startEmbedLayoutWatch() {
  stopEmbedLayoutWatch();
  const wrap = document.getElementById("canvas-wrap");
  if (!wrap || typeof ResizeObserver === "undefined") return;
  embedResizeObserver = new ResizeObserver(() => {
    syncEmbedLayout();
  });
  embedResizeObserver.observe(wrap);
  if (wrap.parentElement) embedResizeObserver.observe(wrap.parentElement);
}

function stopEmbedLayoutWatch() {
  embedResizeObserver?.disconnect();
  embedResizeObserver = null;
}

function isEmbedPage() {
  return document.documentElement.classList.contains("gmc-embed");
}

function decodeEmbedConfigPayload(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch (_) {
    return null;
  }
}

function parseEmbedConfigFromHash() {
  if (typeof window.__GMC_EMBED_CONFIG__ === "string" && window.__GMC_EMBED_CONFIG__) {
    return decodeEmbedConfigPayload(window.__GMC_EMBED_CONFIG__);
  }
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get("c");
  if (fromQuery) return decodeEmbedConfigPayload(fromQuery);
  return decodeEmbedConfigPayload(location.hash.slice(1));
}

function computeEmbedRenderSize(exportOpts) {
  const sw = Math.max(64, exportOpts.width || 480);
  const sh = Math.max(64, exportOpts.height || 480);
  const maxEdge = exportOpts.embedMaxEdge;
  if (!maxEdge) {
    return { width: sw, height: sh };
  }
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  return {
    width: Math.max(64, Math.round(sw * scale)),
    height: Math.max(64, Math.round(sh * scale)),
  };
}

function applyEmbedCanvasBackground(bg) {
  applyExportBackgroundPreview(bg);
}

function stopEmbedLoop() {
  stopEmbedLayoutWatch();
  if (embedExportSnapshot) {
    endExport(embedExportSnapshot);
    embedExportSnapshot = null;
  }
}

function startEmbedLoop(exportOpts) {
  if (!exportOpts || !pInst) return;
  stopEmbedLoop();

  const { background } = exportOpts;
  const container = getEmbedContainerSize();

  applyEmbedCanvasBackground(background);
  embedExportSnapshot = beginEmbedDisplay({
    width: container.width,
    height: container.height,
    background: background || { transparent: false, color: "#ffffff" },
  });

  startEmbedLayoutWatch();

  if (typeof window.Vasarely?.draw === "function") window.Vasarely.draw();
  if (pInst) pInst.redraw();
}

function captureEmbedConfig(exportOpts) {
  return {
    v: 1,
    preset: collectPresetBody(),
    vas: typeof window.Vasarely?.captureLocalSnapshot === "function" ? window.Vasarely.captureLocalSnapshot() : null,
    export: exportOpts,
  };
}

function roundForEmbed(n, places) {
  if (typeof n !== "number" || !Number.isFinite(n)) return n;
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

function captureProceduralEmbedPayload(exportOpts) {
  const config = captureEmbedConfig(exportOpts);
  const p = config.preset;
  if (p) {
    p.spin = roundForEmbed(p.spin, 4);
    p.tiltXDeg = roundForEmbed(p.tiltXDeg, 3);
    p.tiltYDeg = roundForEmbed(p.tiltYDeg, 3);
    p.spinSpeed = roundForEmbed(p.spinSpeed, 5);
    p.echoStep = roundForEmbed(p.echoStep, 4);
    p.echoAlpha = roundForEmbed(p.echoAlpha, 3);
  }
  const data = ensureContours();
  if (data?.contours) {
    config.baked = {
      contours: data.contours,
      halfW: roundForEmbed(data.halfW, 2),
      halfH: roundForEmbed(data.halfH, 2),
    };
  }
  return config;
}

async function initEmbedInline() {
  await bootEmbedFromConfig(parseEmbedConfigFromHash());
}

window.GMCEmbedBoot = function () {
  if (!window.__GMC_EMBED_INLINE__) return;
  initEmbedInline().catch((err) => console.warn(err));
};
async function initEmbedFromHash() {
  await bootEmbedFromConfig(parseEmbedConfigFromHash());
}

window.GMCExport = {
  beginExport,
  endExport,
  renderExportFrame,
  compositeExportFrame,
  buildExportSVGDocument,
  getCanvasBackgroundMode,
  getLiveExportBackground,
  getLiveSphereInteriorColors,
  applyExportBackgroundPreview,
  syncBackgroundPreviews,
  readExportBackgroundFromDom,
  readSphereInteriorFromDom,
  readAllBackgroundSettings,
  readStoredExportBackground,
  rememberExportBackground,
  buildTypeSpherePathMarkup,
  captureEmbedConfig,
  captureProceduralEmbedPayload,
  startEmbedLoop,
  stopEmbedLoop,
  getSpin: () => STATE.spin,
  getHorizontalArcDeg: () => STATE.horizontalArcDeg,
  isTransparentBg: () => !!exportMode?.transparentBg,
};

window.addEventListener("load", () => {
  if (window.__GMC_EMBED_INLINE__) return;
  window.onVasarelyFrame = function () {
    if (document.getElementById("vaz-sphere")?.checked !== false) return;
    if (pInst) pInst.redraw();
  };
  if (isEmbedPage()) {
    bootEmbedPage().catch((err) => console.warn(err));
    return;
  }
  wireUI();
  mountP5();
  mergeBundledFonts()
    .then(() => mergeBundledPresets())
    .then(() => refreshPresetSelect())
    .then(() => restoreLastActivePreset())
    .then(() => restoreLastActiveFont())
    .catch((err) => {
      console.warn(err);
      return mergeBundledFonts()
        .then(() => mergeBundledPresets())
        .then(() => refreshPresetSelect())
        .then(() => restoreLastActivePreset())
        .then(() => restoreLastActiveFont());
    })
    .finally(() => {
      pushStateToDom();
      resizeCanvasFromWrap();
      if (pInst) pInst.redraw();
      if (typeof window.Vasarely?.draw === "function") window.Vasarely.draw();
    });
});
