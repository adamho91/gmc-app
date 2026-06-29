/**
 * Build Lottie 5.x JSON from raster frame sequence.
 */
(function () {
  function parseDataUrl(dataUrl) {
    const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
    if (m) return { mime: m[1], base64: m[2] };
    const i = dataUrl.indexOf("base64,");
    return {
      mime: "image/png",
      base64: i >= 0 ? dataUrl.slice(i + 7) : dataUrl,
    };
  }

  function buildLottieFromFrames(frames, options) {
    const { width, height, fps, layerName } = options;
    const totalFrames = frames.length;
    const halfW = width / 2;
    const halfH = height / 2;
    const center = [halfW, halfH, 0];

    const assets = frames.map((dataUrl, idx) => {
      const { mime, base64 } = parseDataUrl(dataUrl);
      return {
        id: `img_${idx}`,
        w: width,
        h: height,
        u: "",
        p: `data:${mime};base64,${base64}`,
        e: 1,
      };
    });

    const layers = frames.map((_, idx) => ({
      ind: idx + 1,
      ty: 2,
      nm: idx === 0 && layerName ? layerName : `Frame ${idx}`,
      refId: `img_${idx}`,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: center },
        a: { a: 0, k: center },
        s: { a: 0, k: [100, 100, 100] },
      },
      ip: idx,
      op: idx + 1,
      st: 0,
    }));

    return {
      v: "5.7.4",
      fr: fps,
      ip: 0,
      op: totalFrames,
      w: width,
      h: height,
      nm: layerName || "GMC Pattern",
      assets,
      layers,
    };
  }

  function downloadJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function estimateJsonBytes(frameCount, width, height, captureOpts = {}) {
    const format = captureOpts.format || "image/webp";
    const quality = captureOpts.quality ?? captureOpts.jpegQuality ?? 0.88;
    if (format === "image/png") {
      const perFrame = Math.ceil((width * height * 4) / 3) + 200;
      return frameCount * perFrame + 4096;
    }
    if (format === "image/webp") {
      const bpp = 0.035 + quality * 0.1;
      const perFrame = Math.ceil(width * height * bpp) + 100;
      return frameCount * perFrame + 4096;
    }
    const bpp = 0.06 + quality * 0.14;
    const perFrame = Math.ceil(width * height * bpp) + 120;
    return frameCount * perFrame + 4096;
  }

  window.GMCLottieExport = {
    buildLottieFromFrames,
    downloadJson,
    estimateJsonBytes,
  };
})();
