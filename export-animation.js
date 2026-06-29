/**
 * Seamless loop export — Lottie JSON + MP4 at custom duration and dimensions.
 */
(function () {
  const TWO_PI = Math.PI * 2;
  let exportRunning = false;

  const LOTTIE_QUALITY = {
    compact: { maxEdge: 512, format: "image/webp", quality: 0.82, lottieFps: 0 },
    balanced: { maxEdge: 720, format: "image/webp", quality: 0.9, lottieFps: 0 },
    sharp: { maxEdge: 960, format: "image/webp", quality: 0.94, lottieFps: 0 },
    light: { maxEdge: 640, format: "image/webp", quality: 0.86, lottieFps: 15 },
    full: { maxEdge: 0, format: "image/png", quality: 1, lottieFps: 0 },
  };

  const LOTTIE_LAYER_MODES = {
    all: { id: "all", label: "All layers" },
    type: { id: "type", label: "Type sphere" },
    halftone: { id: "halftone", label: "Halftone field" },
    "type-halftone": { id: "type-halftone", label: "Type + halftone" },
    "over-dots": { id: "over-dots", label: "Over dots" },
  };

  let webpEncodeSupported = null;

  function supportsWebPEncode() {
    if (webpEncodeSupported !== null) return webpEncodeSupported;
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 2;
      webpEncodeSupported = c.toDataURL("image/webp").startsWith("data:image/webp");
    } catch (_) {
      webpEncodeSupported = false;
    }
    return webpEncodeSupported;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(msg) {
    const el = $("export-status");
    if (el) el.textContent = msg;
  }

  function setProgress(pct) {
    const wrap = $("export-progress");
    const bar = $("export-progress-bar");
    if (wrap) wrap.hidden = pct <= 0;
    if (bar) bar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  }

  function setButtonsDisabled(disabled) {
    $("export-lottie-btn")?.toggleAttribute("disabled", disabled);
    $("export-mp4-btn")?.toggleAttribute("disabled", disabled);
    $("export-svg-seq-btn")?.toggleAttribute("disabled", disabled);
    $("export-svg-anim-btn")?.toggleAttribute("disabled", disabled);
    $("export-embed-btn")?.toggleAttribute("disabled", disabled);
  }

  let lastExportMeta = null;

  function evenDim(n) {
    const v = Math.max(2, Math.round(n));
    return v % 2 === 0 ? v : v - 1;
  }

  function scaleToMaxEdge(width, height, maxEdge) {
    if (!maxEdge || Math.max(width, height) <= maxEdge) {
      return { width: evenDim(width), height: evenDim(height) };
    }
    const scale = maxEdge / Math.max(width, height);
    return {
      width: evenDim(width * scale),
      height: evenDim(height * scale),
    };
  }

  function readExportBackground() {
    const transparent = !!$("export-bg-transparent")?.checked;
    const color = $("export-bg-color")?.value || "#ffffff";
    const sphereA = $("sphere-bg-a")?.value || "#f8f8f4";
    const sphereB = $("sphere-bg-b")?.value || "#e4e4de";
    return { transparent, color, sphereA, sphereB };
  }

  function readExportOptions() {
    const duration = Math.max(0.5, Math.min(30, parseFloat($("export-duration")?.value) || 3));
    const fps = Math.max(1, Math.min(60, parseInt($("export-fps")?.value, 10) || 30));
    const rotations = Math.max(1, Math.min(8, parseInt($("export-rotations")?.value, 10) || 1));
    const width = Math.max(256, Math.min(4096, parseInt($("export-width")?.value, 10) || 1200));
    const height = Math.max(256, Math.min(4096, parseInt($("export-height")?.value, 10) || 1200));
    const totalFrames = Math.max(1, Math.round(duration * fps));
    return { duration, fps, rotations, width, height, totalFrames };
  }

  function readLottieCaptureOptions(opts) {
    const preset = LOTTIE_QUALITY[$("export-lottie-quality")?.value] || LOTTIE_QUALITY.balanced;
    const scaled = scaleToMaxEdge(opts.width, opts.height, preset.maxEdge);
    let format = preset.format;
    if (format === "image/webp" && !supportsWebPEncode()) format = "image/jpeg";
    return {
      outputWidth: scaled.width,
      outputHeight: scaled.height,
      format,
      quality: preset.quality,
      lottieFps: preset.lottieFps > 0 ? preset.lottieFps : opts.fps,
    };
  }

  function readLottieLayerModes() {
    const splitAll = !!$("export-lottie-split-all")?.checked;
    if (splitAll) return ["type", "halftone", "type-halftone", "over-dots", "all"];
    const mode = $("export-lottie-content")?.value || "all";
    return LOTTIE_LAYER_MODES[mode] ? [mode] : ["all"];
  }

  function exportFilename(ext, opts, layerId) {
    const { width, height, duration, fps } = opts;
    const layerSuffix = layerId && layerId !== "all" ? `-${layerId}` : "";
    const base = `gmc-pattern${layerSuffix}-${width}x${height}-${duration}s-${fps}fps`;
    return ext === "lottie" ? `${base}.lottie.json` : `${base}.${ext}`;
  }

  function frameToDataUrl(srcCanvas, format, quality, exportBackground, flattenVideoMatte) {
    const useLossy = format === "image/jpeg" || format === "image/webp";
    let frameCanvas = srcCanvas;
    if (useLossy && exportBackground.transparent) {
      const flat = document.createElement("canvas");
      flat.width = srcCanvas.width;
      flat.height = srcCanvas.height;
      const flatCtx = flat.getContext("2d");
      flatCtx.fillStyle = exportBackground.color || "#ffffff";
      flatCtx.fillRect(0, 0, flat.width, flat.height);
      flatCtx.drawImage(srcCanvas, 0, 0);
      frameCanvas = flat;
    } else if (flattenVideoMatte && exportBackground.transparent) {
      const flat = document.createElement("canvas");
      flat.width = srcCanvas.width;
      flat.height = srcCanvas.height;
      const flatCtx = flat.getContext("2d");
      flatCtx.fillStyle = "#000000";
      flatCtx.fillRect(0, 0, flat.width, flat.height);
      flatCtx.drawImage(srcCanvas, 0, 0);
      frameCanvas = flat;
    } else if (useLossy && !exportBackground.transparent) {
      const flat = document.createElement("canvas");
      flat.width = srcCanvas.width;
      flat.height = srcCanvas.height;
      const flatCtx = flat.getContext("2d");
      flatCtx.fillStyle = exportBackground.color || "#ffffff";
      flatCtx.fillRect(0, 0, flat.width, flat.height);
      flatCtx.drawImage(srcCanvas, 0, 0);
      frameCanvas = flat;
    }
    if (format === "image/png") return frameCanvas.toDataURL("image/png");
    if (format === "image/webp") return frameCanvas.toDataURL("image/webp", quality);
    return frameCanvas.toDataURL("image/jpeg", quality);
  }

  function readVectorLayerModes() {
    const splitAll = !!$("export-lottie-split-all")?.checked;
    if (splitAll) return ["type", "halftone", "type-halftone", "over-dots", "all"];
    const mode = $("export-lottie-content")?.value || "all";
    return LOTTIE_LAYER_MODES[mode] ? [mode] : ["all"];
  }

  async function captureSvgFrames(opts, onProgress, captureOpts) {
    const exp = window.GMCExport;
    if (!exp?.buildExportSVGDocument) throw new Error("SVG export API not ready");

    const { duration, fps, rotations, width, height, totalFrames } = opts;
    const exportBackground = captureOpts.exportBackground ?? readExportBackground();
    const layerModes = captureOpts.layerModes || ["all"];
    const multiLayer = layerModes.length > 1;
    const framesByLayer = Object.fromEntries(layerModes.map((m) => [m, []]));
    const spinStart = exp.getSpin();
    const snapshot = exp.beginExport({
      width,
      height,
      background: exportBackground,
    });

    try {
      for (let i = 0; i < totalFrames; i++) {
        const progress = i / totalFrames;
        const spin = spinStart + TWO_PI * rotations * progress;
        const timeMs = progress * duration * 1000;
        exp.renderExportFrame(spin, timeMs);

        for (const layerMode of layerModes) {
          const doc = exp.buildExportSVGDocument({
            layers: layerMode,
            background: exportBackground,
          });
          framesByLayer[layerMode].push(doc || "");
        }

        if (onProgress) onProgress((i + 1) / totalFrames);
        if (i % 2 === 0) await yieldToBrowser();
      }
    } finally {
      exp.endExport(snapshot);
    }

    if (multiLayer) {
      return { framesByLayer, width, height, layerModes };
    }
    const singleMode = layerModes[0] || "all";
    return {
      frames: framesByLayer[singleMode],
      width,
      height,
      layerModes,
    };
  }

  async function yieldToBrowser() {
    await new Promise((r) => setTimeout(r, 0));
  }

  function rememberExportMeta(meta) {
    lastExportMeta = meta;
    try {
      sessionStorage.setItem("gmc_last_export_meta", JSON.stringify(meta));
    } catch (_) {}
  }

  const EMBED_DISPLAY_MAX = 480;
  const EMBED_MAX_CHARS = 50000;
  const EMBED_PACKAGE_DIR = "gmc-pattern-embed";
  const LS_EMBED_HOST = "gmc_embed_host_url";

  function resolveEmbedHostUrl() {
    const el = $("export-embed-host");
    let v = (el?.value || "").trim();
    if (v) return v.replace(/\/+$/, "");
    try {
      v = (sessionStorage.getItem(LS_EMBED_HOST) || "").trim();
      if (v) {
        if (el) el.value = v;
        return v.replace(/\/+$/, "");
      }
    } catch (_) {}
    if (/^https?:/i.test(location.protocol)) {
      const dir = location.pathname.replace(/\/[^/]*$/, "");
      v = `${location.origin}${dir}`;
      if (el) el.placeholder = v;
      return v.replace(/\/+$/, "");
    }
    return "";
  }

  function readEmbedHostUrl() {
    return resolveEmbedHostUrl();
  }

  function rememberEmbedHostUrl(url) {
    try {
      sessionStorage.setItem(LS_EMBED_HOST, url);
    } catch (_) {}
  }

  const EMBED_HOST_FILES = [
    "index.html",
    "embed-procedural.js",
    "spinner.js",
    "vasarely.js",
    "bundled-fonts.js",
    "bundled-font-data.js",
    "presets.js",
    "export-animation.js",
    "svg-export.js",
    "lottie-export.js",
  ];

  async function downloadEmbedHostZip() {
    if (!/^https?:/i.test(location.protocol)) {
      setStatus("Open the app via a local server (npm run dev) to download the embed package.");
      return;
    }
    const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");
    const zip = new JSZip();
    const folder = zip.folder(EMBED_PACKAGE_DIR);
    setStatus("Packaging embed files…");
    for (const name of EMBED_HOST_FILES) {
      const res = await fetch(name, { cache: "no-cache" });
      if (!res.ok) throw new Error(`Missing ${name} — run from project root.`);
      folder.file(name, await res.text());
    }
    folder.file(
      "README.txt",
      [
        "GMC Pattern — embed package",
        "",
        "Upload this entire folder to your website (Webflow assets, Netlify, etc.).",
        "Paste the embed HTML from the app into your page.",
        "If the iframe 404s, update the src path to match where you uploaded this folder.",
        "",
        "Tip: if you export embed code while the app is hosted online, the iframe can",
        "point at that URL directly — no upload needed.",
      ].join("\n")
    );
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${EMBED_PACKAGE_DIR}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus(`Saved ${EMBED_PACKAGE_DIR}.zip — upload the folder, then paste embed code.`);
  }

  function generateLoopEmbedCode() {
    const exp = window.GMCExport;
    const svgExp = window.GMCSvgExport;
    if (!exp?.captureEmbedConfig || !svgExp?.encodeEmbedConfig) {
      throw new Error("Export modules not loaded");
    }

    const opts = readExportOptions();
    const exportBackground = readExportBackground();
    const layerId = $("export-lottie-content")?.value || "all";
    const displayW = Math.min(EMBED_DISPLAY_MAX, opts.width);
    const displayH = Math.max(1, Math.round(displayW * (opts.height / opts.width)));

    const config = exp.captureEmbedConfig({
      duration: opts.duration,
      fps: opts.fps,
      rotations: opts.rotations,
      width: opts.width,
      height: opts.height,
      layers: layerId,
      background: exportBackground,
      embedMaxEdge: EMBED_DISPLAY_MAX,
    });

    const payload = svgExp.encodeEmbedConfig(config);
    if (payload.length > 12000) {
      console.warn("Embed config is large — some hosts may truncate long URLs.");
    }

    const embedOpts = {
      displayWidth: displayW,
      displayHeight: displayH,
      duration: opts.duration,
      fps: opts.fps,
      rotations: opts.rotations,
      layerId,
    };

    const hostUrl = resolveEmbedHostUrl();
    if (!hostUrl || !/^https?:\/\//i.test(hostUrl)) {
      throw new Error(
        "Live iframe needs a hosted player URL. Use Inline mode (default), or open the app over http:// and regenerate, or set Custom player URL."
      );
    }
    rememberEmbedHostUrl(hostUrl);
    return svgExp.buildIframeLoopEmbed(payload, { ...embedOpts, hostUrl });
  }

  async function generateProceduralEmbedCode() {
    const exp = window.GMCExport;
    const svgExp = window.GMCSvgExport;
    if (!exp?.captureProceduralEmbedPayload || !svgExp?.encodeEmbedConfig) {
      throw new Error("Export modules not loaded");
    }

    let hostUrl = resolveEmbedHostUrl();
    let hostPlaceholder = false;
    if (!hostUrl || !/^https?:\/\//i.test(hostUrl)) {
      hostUrl = "https://YOUR-GMC-HOST.example";
      hostPlaceholder = true;
    } else {
      rememberEmbedHostUrl(hostUrl);
    }

    const opts = readExportOptions();
    const exportBackground = readExportBackground();
    const layerId = $("export-lottie-content")?.value || "all";
    const displayW = Math.min(EMBED_DISPLAY_MAX, opts.width);
    const displayH = Math.max(1, Math.round(displayW * (opts.height / opts.width)));

    const config = exp.captureProceduralEmbedPayload({
      duration: opts.duration,
      fps: opts.fps,
      rotations: opts.rotations,
      width: opts.width,
      height: opts.height,
      layers: layerId,
      background: exportBackground,
      embedMaxEdge: EMBED_DISPLAY_MAX,
    });

    if (!config.baked?.contours) {
      throw new Error("Could not bake type outlines — load a font and wait for the sphere to render first.");
    }

    const payload = svgExp.encodeEmbedConfig(config);

    let bootScript = "";
    try {
      const res = await fetch("embed-procedural.js", { cache: "no-cache" });
      if (res.ok) bootScript = await res.text();
    } catch (e) {
      console.warn(e);
    }
    if (!bootScript) {
      throw new Error("embed-procedural.js not found — open the app via a local server (npm run dev).");
    }

    const code = svgExp.buildProceduralEmbedHtml({
      payload,
      hostUrl,
      hostPlaceholder,
      displayWidth: displayW,
      displayHeight: displayH,
      bootScript,
    });

    if (code.length > EMBED_MAX_CHARS) {
      throw new Error(
        `Embed is ${code.length.toLocaleString()} characters (max ${EMBED_MAX_CHARS.toLocaleString()}). Try shorter text or a simpler preset.`
      );
    }

    return { code, chars: code.length, hostUrl, hostPlaceholder, displayW, displayH, layerId };
  }

  function getEmbedModalMode() {
    return document.querySelector('input[name="export-embed-mode"]:checked')?.value || "inline";
  }

  function embedCodeModeLabel() {
    if (getEmbedModalMode() === "inline") {
      return { mode: "inline" };
    }
    const hostUrl = resolveEmbedHostUrl();
    if (hostUrl && /^https?:\/\//i.test(hostUrl)) {
      return { mode: "hosted", hostUrl };
    }
    return { mode: "iframe-needs-host" };
  }

  async function showEmbedModal() {
    const modal = $("export-embed-modal");
    const ta = $("export-embed-text");
    const status = $("export-embed-status");
    if (!modal || !ta) return;

    modal.style.display = "flex";
    resolveEmbedHostUrl();

    const mode = getEmbedModalMode();
    const o = readExportOptions();
    const layer = $("export-lottie-content")?.value || "all";

    try {
      if (mode === "inline") {
        ta.value = "";
        if (status) status.textContent = "Building procedural embed…";
        setButtonsDisabled(true);
        const result = await generateProceduralEmbedCode();
        ta.value = result.code;
        if (status) {
          const hostNote = result.hostPlaceholder
            ? ` · replace YOUR-GMC-HOST in the code`
            : ` · player at ${result.hostUrl}`;
          status.textContent = `Ready — ${result.chars.toLocaleString()} chars · paste into Webflow Embed${hostNote} · ${result.displayW}×${result.displayH}`;
        }
      } else {
        ta.value = generateLoopEmbedCode();
        const info = embedCodeModeLabel();
        const size = `mini ${Math.min(EMBED_DISPLAY_MAX, o.width)}px wide`;
        const timing = `${o.duration}s @ ${o.fps} fps · ${o.rotations} rotation(s) · ${layer}`;
        if (status) {
          if (info.mode === "hosted") {
            status.textContent = `Ready — iframe loads from ${info.hostUrl} · ${timing} · ${size}`;
          } else {
            status.textContent = `Set Custom player URL (hosted app), then Regenerate · ${timing}`;
          }
        }
      }
    } catch (err) {
      console.warn(err);
      ta.value = "";
      if (status) status.textContent = `Failed — ${err.message || err}`;
    } finally {
      setButtonsDisabled(false);
    }
  }

  function hideEmbedModal() {
    const modal = $("export-embed-modal");
    if (modal) modal.style.display = "none";
  }

  async function runSvgExport(kind) {
    if (exportRunning) return;
    const exp = window.GMCExport;
    const svg = window.GMCSvgExport;
    if (!exp || !svg) {
      setStatus("SVG export modules not loaded.");
      return;
    }

    const opts = readExportOptions();
    const layerModes = readVectorLayerModes();
    const exportBackground = readExportBackground();

    if (kind === "animated" && opts.totalFrames > 72) {
      const ok = confirm(
        `Animated SVG with ${opts.totalFrames} vector frames may be very large. Continue, or cancel and lower FPS/duration?`
      );
      if (!ok) return;
    }

    exportRunning = true;
    setButtonsDisabled(true);
    setProgress(1);
    setStatus(`Rendering ${opts.totalFrames} vector frames…`);

    try {
      const captureResult = await captureSvgFrames(
        opts,
        (p) => {
          setProgress(p * 0.88);
          setStatus(`Vector frame ${Math.round(p * opts.totalFrames)} / ${opts.totalFrames}…`);
        },
        { exportBackground, layerModes }
      );

      const modes = captureResult.layerModes || ["all"];
      const downloads = [];

      for (const mode of modes) {
        const frames = captureResult.framesByLayer
          ? captureResult.framesByLayer[mode]
          : captureResult.frames;
        if (!frames?.length || !frames[0]) continue;

        const base = svg.assetBaseName(opts, mode);
        if (kind === "sequence") {
          setStatus(`Zipping ${frames.length} SVGs (${mode})…`);
          setProgress(92);
          const blob = await svg.zipSvgSequence(frames, {
            width: opts.width,
            height: opts.height,
            fps: opts.fps,
            duration: opts.duration,
            layers: mode,
          });
          downloads.push({ blob, filename: `${base}-svg-sequence.zip` });
          rememberExportMeta({
            width: opts.width,
            height: opts.height,
            fps: opts.fps,
            duration: opts.duration,
            frameCount: frames.length,
            layerId: mode,
            bgColor: exportBackground.transparent ? "transparent" : exportBackground.color,
            lastType: "svg-sequence",
            baseName: base,
          });
        } else {
          setStatus(`Building animated SVG (${mode})…`);
          setProgress(92);
          const inners = frames.map((f) => svg.svgInnerBody(f));
          const animated = svg.buildAnimatedSvg(inners, {
            width: opts.width,
            height: opts.height,
            fps: opts.fps,
            duration: opts.duration,
          });
          const blob = new Blob([animated], { type: "image/svg+xml;charset=utf-8" });
          downloads.push({ blob, filename: `${base}.animated.svg` });
          rememberExportMeta({
            width: opts.width,
            height: opts.height,
            fps: opts.fps,
            duration: opts.duration,
            frameCount: frames.length,
            layerId: mode,
            bgColor: exportBackground.transparent ? "transparent" : exportBackground.color,
            lastType: "svg-animated",
            baseName: base,
          });
        }
      }

      if (!downloads.length) throw new Error("No SVG frames rendered — enable halftone field or load a font.");

      setProgress(98);
      await downloadFiles(downloads);
      const mb = (downloads.reduce((s, d) => s + d.blob.size, 0) / (1024 * 1024)).toFixed(1);
      setStatus(
        kind === "sequence"
          ? `Saved SVG sequence · ${opts.totalFrames} frames · ${opts.width}×${opts.height} · ~${mb} MB`
          : `Saved animated SVG · ${opts.totalFrames} frames · ${opts.width}×${opts.height} · ~${mb} MB`
      );
      setProgress(100);
    } catch (err) {
      console.warn(err);
      setStatus(`Export failed — ${err.message || err}`);
      setProgress(0);
    } finally {
      exportRunning = false;
      setButtonsDisabled(false);
      setTimeout(() => setProgress(0), 2000);
    }
  }

  async function captureFrames(opts, onProgress, captureOpts) {
    captureOpts = captureOpts || {};
    const exp = window.GMCExport;
    if (!exp) throw new Error("Export API not ready");

    const { duration, fps, rotations, width, height, totalFrames } = opts;
    const outputWidth = captureOpts.outputWidth ?? width;
    const outputHeight = captureOpts.outputHeight ?? height;
    const exportBackground = captureOpts.exportBackground ?? readExportBackground();
    const format = exportBackground.transparent
      ? "image/png"
      : (captureOpts.format ?? "image/png");
    const quality = captureOpts.quality ?? 0.92;
    const layerModes = captureOpts.layerModes || ["all"];
    const multiLayer = layerModes.length > 1;
    const framesByLayer = Object.fromEntries(layerModes.map((m) => [m, []]));
    const spinStart = exp.getSpin();
    const snapshot = exp.beginExport({
      width,
      height,
      background: exportBackground,
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const needsScale = outputWidth !== width || outputHeight !== height;
    const outCanvas = needsScale ? document.createElement("canvas") : canvas;
    if (needsScale) {
      outCanvas.width = outputWidth;
      outCanvas.height = outputHeight;
    }
    const outCtx = needsScale ? outCanvas.getContext("2d", { alpha: true }) : null;
    if (outCtx) {
      outCtx.imageSmoothingEnabled = false;
    }

    try {
      for (let i = 0; i < totalFrames; i++) {
        const progress = i / totalFrames;
        const spin = spinStart + TWO_PI * rotations * progress;
        const timeMs = progress * duration * 1000;

        exp.renderExportFrame(spin, timeMs);

        for (const layerMode of layerModes) {
          await exp.compositeExportFrame(canvas, exportBackground, { layers: layerMode });

          const src = needsScale ? outCanvas : canvas;
          if (needsScale) {
            outCtx.clearRect(0, 0, outputWidth, outputHeight);
            outCtx.drawImage(canvas, 0, 0, outputWidth, outputHeight);
          }

          framesByLayer[layerMode].push(
            frameToDataUrl(
              src,
              format,
              quality,
              exportBackground,
              !!captureOpts.flattenVideoMatte
            )
          );
        }

        if (onProgress) onProgress((i + 1) / totalFrames);
        if (i % 2 === 0) await yieldToBrowser();
      }
    } finally {
      exp.endExport(snapshot);
    }

    if (multiLayer) {
      return { framesByLayer, width: outputWidth, height: outputHeight, layerModes };
    }
    const singleMode = layerModes[0] || "all";
    return {
      frames: framesByLayer[singleMode],
      width: outputWidth,
      height: outputHeight,
      layerModes,
    };
  }

  async function waitForEncoderQueue(encoder, maxQueue = 2) {
    while (encoder.encodeQueueSize > maxQueue) {
      await new Promise((resolve) => {
        if (encoder.encodeQueueSize <= maxQueue) resolve();
        else encoder.addEventListener("dequeue", () => resolve(), { once: true });
      });
    }
  }

  async function encodeMp4WebCodecs(frames, opts) {
    const width = evenDim(opts.width);
    const height = evenDim(opts.height);
    const fps = opts.fps;
    if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") {
      return null;
    }

    const { Muxer, ArrayBufferTarget } = await import("https://esm.sh/mp4-muxer@5.1.3");
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: { codec: "avc", width, height },
      fastStart: "in-memory",
    });

    let encoderError = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        encoderError = e;
      },
    });

    const bitrate = Math.max(500_000, Math.round(width * height * fps * 0.08));
    const codecCandidates = ["avc1.42001f", "avc1.4d0034", "avc1.640028"];
    let configuredCodec = null;

    for (const codec of codecCandidates) {
      const configs = [
        { codec, width, height, bitrate, framerate: fps, bitrateMode: "constant" },
        { codec, width, height, bitrate, bitrateMode: "constant" },
      ];
      for (const config of configs) {
        const support = await VideoEncoder.isConfigSupported(config);
        if (!support.supported) continue;
        try {
          encoder.configure(config);
          if (encoder.state === "closed") continue;
          configuredCodec = codec;
          break;
        } catch (_) {
          /* try next config */
        }
      }
      if (configuredCodec) break;
    }

    if (!configuredCodec || encoder.state !== "configured") {
      try {
        encoder.close();
      } catch (_) {
        /* already closed */
      }
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    const frameDurationUs = Math.round(1_000_000 / fps);

    try {
      for (let i = 0; i < frames.length; i++) {
        if (encoderError) throw encoderError;
        if (encoder.state !== "configured") {
          throw encoderError || new Error("VideoEncoder closed unexpectedly");
        }

        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = () => rej(new Error(`Failed to load export frame ${i + 1}`));
          img.src = frames[i];
        });
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const frame = new VideoFrame(canvas, {
          timestamp: Math.round((i * 1_000_000) / fps),
          duration: frameDurationUs,
        });
        await waitForEncoderQueue(encoder);
        encoder.encode(frame, { keyFrame: i % fps === 0 });
        frame.close();
      }

      if (encoderError) throw encoderError;
      await encoder.flush();
      muxer.finalize();
      return new Blob([target.buffer], { type: "video/mp4" });
    } catch (err) {
      console.warn("WebCodecs MP4 encode failed:", err);
      return null;
    } finally {
      if (encoder.state !== "closed") {
        try {
          encoder.close();
        } catch (_) {
          /* ignore */
        }
      }
    }
  }

  async function encodeWebmWebCodecs(frames, opts) {
    const width = evenDim(opts.width);
    const height = evenDim(opts.height);
    const fps = opts.fps;
    if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") {
      return null;
    }

    const { Muxer, ArrayBufferTarget } = await import("https://esm.sh/webm-muxer@4.0.1");
    const bitrate = Math.max(500_000, Math.round(width * height * fps * 0.08));
    const profiles = [
      { muxCodec: "V_VP9", codec: "vp09.00.10.08" },
      { muxCodec: "V_VP8", codec: "vp8" },
    ];

    for (const profile of profiles) {
      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: { codec: profile.muxCodec, width, height, frameRate: fps },
      });

      let encoderError = null;
      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => {
          encoderError = e;
        },
      });

      const configs = [
        { codec: profile.codec, width, height, bitrate, framerate: fps, bitrateMode: "constant" },
        { codec: profile.codec, width, height, bitrate, bitrateMode: "constant" },
      ];
      let configured = false;
      for (const config of configs) {
        const support = await VideoEncoder.isConfigSupported(config);
        if (!support.supported) continue;
        try {
          encoder.configure(config);
          if (encoder.state !== "closed") configured = true;
          break;
        } catch (_) {
          /* try next config */
        }
      }

      if (!configured || encoder.state !== "configured") {
        try {
          encoder.close();
        } catch (_) {
          /* already closed */
        }
        continue;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      const frameDurationUs = Math.round(1_000_000 / fps);

      try {
        for (let i = 0; i < frames.length; i++) {
          if (encoderError) throw encoderError;
          if (encoder.state !== "configured") {
            throw encoderError || new Error("VideoEncoder closed unexpectedly");
          }

          const img = new Image();
          await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = () => rej(new Error(`Failed to load export frame ${i + 1}`));
            img.src = frames[i];
          });
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const frame = new VideoFrame(canvas, {
            timestamp: Math.round((i * 1_000_000) / fps),
            duration: frameDurationUs,
          });
          await waitForEncoderQueue(encoder);
          encoder.encode(frame, { keyFrame: i % fps === 0 });
          frame.close();
        }

        if (encoderError) throw encoderError;
        await encoder.flush();
        muxer.finalize();
        return new Blob([target.buffer], { type: "video/webm" });
      } catch (err) {
        console.warn(`WebCodecs WebM encode failed (${profile.codec}):`, err);
      } finally {
        if (encoder.state !== "closed") {
          try {
            encoder.close();
          } catch (_) {
            /* ignore */
          }
        }
      }
    }

    return null;
  }

  async function encodeWebmMediaRecorder(frames, opts) {
    const { width, height, fps } = opts;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const stream = canvas.captureStream(fps);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: width * height * fps * 0.15,
    });
    const chunks = [];

    const done = new Promise((resolve) => {
      recorder.ondataavailable = (e) => {
        if (e.data?.size) chunks.push(e.data);
      };
      recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
    });

    recorder.start();
    const frameDelay = 1000 / fps;

    for (let i = 0; i < frames.length; i++) {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = frames[i];
      });
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const track = stream.getVideoTracks()[0];
      if (track?.requestFrame) track.requestFrame();
      await new Promise((r) => setTimeout(r, frameDelay));
    }

    recorder.stop();
    return done;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadFiles(files) {
    for (let i = 0; i < files.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 350));
      downloadBlob(files[i].blob, files[i].filename);
    }
  }

  async function runExport(kind) {
    if (exportRunning) return;
    const exp = window.GMCExport;
    const lottie = window.GMCLottieExport;
    if (!exp || !lottie) {
      setStatus("Export modules not loaded.");
      return;
    }

    const opts = readExportOptions();
    const lottieCapture = kind === "lottie" ? readLottieCaptureOptions(opts) : null;
    const lottieLayerModes = kind === "lottie" ? readLottieLayerModes() : ["all"];
    const lottieFps = lottieCapture?.lottieFps || opts.fps;
    const lottieFrameCount =
      kind === "lottie" && lottieFps < opts.fps
        ? Math.max(1, Math.round(opts.duration * lottieFps))
        : opts.totalFrames;
    const captureOptsBase =
      kind === "lottie"
        ? {
            ...lottieCapture,
            exportBackground: readExportBackground(),
            layerModes: lottieLayerModes,
          }
        : { exportBackground: readExportBackground(), flattenVideoMatte: true, layerModes: ["all"] };
    const renderOpts =
      kind === "lottie" && lottieFrameCount !== opts.totalFrames
        ? { ...opts, totalFrames: lottieFrameCount, fps: lottieFps }
        : opts;

    if (exp.getHorizontalArcDeg?.() < 359) {
      setStatus("Tip: set horizontal arc to 360° for a perfect loop.");
    }

    if (kind === "lottie") {
      const estMb =
        lottie.estimateJsonBytes(
          lottieFrameCount * lottieLayerModes.length,
          lottieCapture.outputWidth,
          lottieCapture.outputHeight,
          lottieCapture
        ) / (1024 * 1024);
      if (estMb > 40) {
        const ok = confirm(
          `Lottie export may be ~${estMb.toFixed(0)} MB (${lottieFrameCount} frames × ${lottieLayerModes.length} layer file(s) at ${lottieCapture.outputWidth}×${lottieCapture.outputHeight}). Continue?`
        );
        if (!ok) return;
      }
    }

    exportRunning = true;
    setButtonsDisabled(true);
    setProgress(1);
    setStatus(`Rendering ${renderOpts.totalFrames} frames…`);

    try {
      const captureResult = await captureFrames(
        renderOpts,
        (p) => {
          setProgress(p * (kind === "lottie" ? 0.85 : 0.7));
          setStatus(`Rendering frame ${Math.round(p * renderOpts.totalFrames)} / ${renderOpts.totalFrames}…`);
        },
        captureOptsBase
      );

      if (kind === "lottie") {
        setStatus("Building Lottie JSON…");
        setProgress(90);
        const downloads = [];
        const modes = captureResult.layerModes || ["all"];
        const outW = captureResult.width;
        const outH = captureResult.height;

        for (const mode of modes) {
          const frames = captureResult.framesByLayer
            ? captureResult.framesByLayer[mode]
            : captureResult.frames;
          if (!frames?.length) continue;
          const json = lottie.buildLottieFromFrames(frames, {
            width: outW,
            height: outH,
            fps: lottieFps,
            layerName: LOTTIE_LAYER_MODES[mode]?.label || mode,
          });
          const mb = (JSON.stringify(json).length / (1024 * 1024)).toFixed(1);
          downloads.push({
            json,
            filename: exportFilename("lottie", { ...opts, width: outW, height: outH, fps: lottieFps }, mode),
            mb,
            mode,
          });
        }

        for (let i = 0; i < downloads.length; i++) {
          if (i > 0) await new Promise((r) => setTimeout(r, 350));
          lottie.downloadJson(downloads[i].json, downloads[i].filename);
        }

        const totalMb = downloads.reduce((s, d) => s + parseFloat(d.mb), 0).toFixed(1);
        const label =
          downloads.length > 1
            ? `${downloads.length} files · ~${totalMb} MB total`
            : `~${downloads[0].mb} MB`;
        setStatus(`Saved Lottie · ${lottieFrameCount} frames · ${outW}×${outH} · ${label}`);
        rememberExportMeta({
          width: outW,
          height: outH,
          fps: lottieFps,
          duration: opts.duration,
          frameCount: lottieFrameCount,
          layerId: downloads[0]?.mode || "all",
          bgColor: readExportBackground().transparent ? "transparent" : readExportBackground().color,
          lastType: "lottie",
          baseName: window.GMCSvgExport?.assetBaseName(
            { ...opts, width: outW, height: outH, fps: lottieFps },
            downloads[0]?.mode
          ),
        });
      } else {
        const { frames, width: outW, height: outH } = captureResult;
        setStatus("Encoding MP4…");
        setProgress(70);
        const mp4Blob = await encodeMp4WebCodecs(frames, opts);

        setStatus("Encoding WebM…");
        setProgress(85);
        let webmBlob = await encodeWebmWebCodecs(frames, opts);
        if (!webmBlob) {
          webmBlob = await encodeWebmMediaRecorder(frames, opts);
        }

        const downloads = [];
        if (mp4Blob) {
          downloads.push({ blob: mp4Blob, filename: exportFilename("mp4", opts) });
        }
        if (webmBlob) {
          downloads.push({ blob: webmBlob, filename: exportFilename("webm", opts) });
        }
        if (!downloads.length) {
          throw new Error("Video encoding is not supported in this browser.");
        }

        await downloadFiles(downloads);
        const labels = downloads.map((d) => d.filename.split(".").pop().toUpperCase());
        setStatus(`Saved ${labels.join(" + ")} · ${opts.duration}s · ${opts.fps} fps`);
        rememberExportMeta({
          width: opts.width,
          height: opts.height,
          fps: opts.fps,
          duration: opts.duration,
          frameCount: opts.totalFrames,
          layerId: "all",
          bgColor: readExportBackground().transparent ? "transparent" : readExportBackground().color,
          lastType: "video",
          baseName: window.GMCSvgExport?.assetBaseName(opts, "all"),
        });
      }
      setProgress(100);
    } catch (err) {
      console.warn(err);
      setStatus(`Export failed — ${err.message || err}`);
      setProgress(0);
    } finally {
      exportRunning = false;
      setButtonsDisabled(false);
      setTimeout(() => setProgress(0), 2000);
    }
  }

  function wireSizePresets() {
    const presets = [$("export-size-1200"), $("export-size-2000")].filter(Boolean);
    const wEl = $("export-width");
    const hEl = $("export-height");

    presets.forEach((btn) => {
      btn.addEventListener("click", () => {
        const w = btn.dataset.w;
        const h = btn.dataset.h;
        if (wEl) wEl.value = w;
        if (hEl) hEl.value = h;
        presets.forEach((b) => b.classList.toggle("is-active", b === btn));
      });
    });

    const syncActive = () => {
      const w = wEl?.value;
      const h = hEl?.value;
      presets.forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.w === w && btn.dataset.h === h);
      });
    };
    wEl?.addEventListener("input", syncActive);
    hEl?.addEventListener("input", syncActive);
  }

  function wireExportBackground() {
    const transparent = $("export-bg-transparent");
    const color = $("export-bg-color");
    const sphereA = $("sphere-bg-a");
    const sphereB = $("sphere-bg-b");
    const exp = () => window.GMCExport;

    const restore = () => {
      try {
        const stored = exp()?.readStoredExportBackground?.();
        if (!stored) return;
        if (transparent) transparent.checked = stored.transparent;
        if (color && stored.color) color.value = stored.color;
        if (sphereA && stored.sphereA) sphereA.value = stored.sphereA;
        if (sphereB && stored.sphereB) sphereB.value = stored.sphereB;
      } catch (_) {}
    };

    const sync = () => {
      if (color) color.disabled = !!transparent?.checked;
      exp()?.syncBackgroundPreviews?.();
    };

    restore();
    transparent?.addEventListener("change", sync);
    color?.addEventListener("input", sync);
    color?.addEventListener("change", sync);
    sphereA?.addEventListener("input", sync);
    sphereA?.addEventListener("change", sync);
    sphereB?.addEventListener("input", sync);
    sphereB?.addEventListener("change", sync);
    sync();
  }

  function wireLottieLayers() {
    const split = $("export-lottie-split-all");
    const content = $("export-lottie-content");
    const sync = () => {
      if (content) content.disabled = !!split?.checked;
    };
    split?.addEventListener("change", sync);
    sync();
  }

  function wireExportUi() {
    wireSizePresets();
    wireExportBackground();
    wireLottieLayers();
    $("export-lottie-btn")?.addEventListener("click", () => runExport("lottie"));
    $("export-mp4-btn")?.addEventListener("click", () => runExport("mp4"));
    $("export-svg-seq-btn")?.addEventListener("click", () => runSvgExport("sequence"));
    $("export-svg-anim-btn")?.addEventListener("click", () => runSvgExport("animated"));
    $("export-embed-btn")?.addEventListener("click", () => {
      showEmbedModal().catch((err) => console.warn(err));
    });
    $("export-embed-regenerate")?.addEventListener("click", () => {
      showEmbedModal().catch((err) => console.warn(err));
    });
    document.querySelectorAll('input[name="export-embed-mode"]').forEach((el) => {
      el.addEventListener("change", () => {
        showEmbedModal().catch((err) => console.warn(err));
      });
    });
    $("export-embed-host")?.addEventListener("change", () => {
      const v = readEmbedHostUrl();
      if (v) rememberEmbedHostUrl(v);
      if (getEmbedModalMode() === "iframe") {
        showEmbedModal().catch((err) => console.warn(err));
      }
    });
    $("export-embed-host-zip")?.addEventListener("click", () => {
      downloadEmbedHostZip().catch((err) => {
        console.warn(err);
        setStatus(`Host ZIP failed — ${err.message || err}`);
      });
    });
    $("export-embed-copy")?.addEventListener("click", () => {
      const ta = $("export-embed-text");
      if (!ta) return;
      ta.select();
      navigator.clipboard.writeText(ta.value).catch(() => document.execCommand("copy"));
      const btn = $("export-embed-copy");
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => {
          btn.textContent = prev;
        }, 1500);
      }
    });
    $("export-embed-close")?.addEventListener("click", hideEmbedModal);
    $("export-embed-modal")?.addEventListener("click", (e) => {
      if (e.target?.id === "export-embed-modal") hideEmbedModal();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireExportUi);
  } else {
    wireExportUi();
  }
})();
