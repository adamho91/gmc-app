/**
 * Vector SVG export helpers — animated SMIL, sequence ZIP, site embed snippets.
 */
(function () {
  function padFrame(n, width) {
    return String(n).padStart(width, "0");
  }

  function svgInnerBody(svgDoc) {
    const m = String(svgDoc).match(/<svg[\s\S]*?>([\s\S]*)<\/svg>\s*$/i);
    return m ? m[1].trim() : String(svgDoc).trim();
  }

  /** Prefix ids / url(#id) so stacked frame groups do not clash. */
  function uniquifySvgFragment(inner, suffix) {
    return inner
      .replace(/\bid="([^"]+)"/g, `id="$1-${suffix}"`)
      .replace(/url\(#([^)]+)\)/g, `url(#$1-${suffix})`);
  }

  function buildAnimatedSvg(frameInners, options) {
    const { width, height, duration, fps } = options;
    const n = frameInners.length;
    if (!n) return "";
    const dur = duration ?? n / (fps || 30);
    const groups = frameInners.map((inner, i) => {
      const values = Array.from({ length: n }, (_, j) => (j === i ? 1 : 0)).join(";");
      const body = uniquifySvgFragment(inner, `f${i}`);
      return `<g opacity="${i === 0 ? 1 : 0}">
    <animate attributeName="opacity" values="${values}" dur="${dur}s" repeatCount="indefinite" calcMode="discrete"/>
    ${body}
  </g>`;
    }).join("\n  ");
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block">
  ${groups}
</svg>`;
  }

  function prepareSvgForInlineHtml(svgDoc) {
    return String(svgDoc)
      .replace(/<\?xml[^?]*\?>\s*/i, "")
      .trim();
  }

  function encodeEmbedConfig(config) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(config))));
  }

  function buildEmbedPlayerUrl(hostBase, payload) {
    const base = String(hostBase || "").replace(/\/+$/, "");
    const cfg = encodeURIComponent(payload);
    return `${base}/index.html?embed=1&c=${cfg}`;
  }

  function buildRelativePlayerUrl(packageDir, payload) {
    const dir = String(packageDir || "gmc-pattern-embed").replace(/^\/+|\/+$/g, "");
    const cfg = encodeURIComponent(payload);
    return `./${dir}/index.html?embed=1&c=${cfg}`;
  }

  /** Live mini player — iframe runs the same render loop as the canvas preview. */
  function buildIframeLoopEmbed(payload, opts) {
    const w = opts.displayWidth;
    const h = opts.displayHeight;
    const layer = opts.layerId || "all";
    const rotations = opts.rotations ?? 1;
    const meta = `${opts.duration}s · ${opts.fps} fps · ${rotations} rot · ${layer} · ${w}×${h}`;

    let src;
    let header;
    if (opts.playerSrc) {
      src = opts.playerSrc;
      header = `<!-- GMC Pattern · live seamless loop · ${meta} -->`;
    } else if (opts.hostUrl) {
      src = buildEmbedPlayerUrl(opts.hostUrl, payload);
      header = `<!-- GMC Pattern · live seamless loop · ${meta} -->
<!-- Player loads from ${opts.hostUrl} (auto-detected from this app) -->`;
    } else if (opts.packageDir) {
      src = buildRelativePlayerUrl(opts.packageDir, payload);
      const dir = String(opts.packageDir).replace(/^\/+|\/+$/g, "");
      header = `<!-- GMC Pattern · live seamless loop · ${meta} -->
<!-- 1) Download "Embed package" in the app and upload the ${dir}/ folder to your site -->
<!-- 2) If needed, change the iframe src path to match where you uploaded it -->`;
    } else {
      throw new Error("Embed player URL could not be resolved.");
    }

    return `${header}
<div class="gmc-pattern-loop" style="width:100%;max-width:${w}px;margin:0 auto;line-height:0;background:transparent">
  <iframe
    src="${src}"
    title="GMC Pattern"
    width="${w}"
    height="${h}"
    style="width:100%;aspect-ratio:${w}/${h};border:0;display:block;background:transparent"
    loading="lazy"
    allow="autoplay"
  ></iframe>
</div>`;
  }

  function buildManifest(opts) {
    return JSON.stringify(
      {
        format: "gmc-svg-sequence",
        version: 1,
        width: opts.width,
        height: opts.height,
        fps: opts.fps,
        duration: opts.duration,
        frameCount: opts.frameCount,
        layers: opts.layers || "all",
        files: opts.files || [],
      },
      null,
      2
    );
  }

  async function zipSvgSequence(frames, opts) {
    const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");
    const zip = new JSZip();
    const folder = zip.folder("frames");
    const files = [];
    const pad = String(Math.max(4, String(frames.length - 1).length));
    frames.forEach((svg, i) => {
      const name = `frame_${padFrame(i, pad)}.svg`;
      folder.file(name, svg);
      files.push(name);
    });
    zip.file(
      "manifest.json",
      buildManifest({
        width: opts.width,
        height: opts.height,
        fps: opts.fps,
        duration: opts.duration,
        frameCount: frames.length,
        layers: opts.layers,
        files,
      })
    );
    zip.file(
      "README.txt",
      [
        "GMC Pattern — SVG sequence (vector, lossless)",
        "",
        "Upload the frames/ folder + manifest.json to your host.",
        "Use embed code from the app, or drop frames into After Effects / Cavalry.",
        "",
        `Frames: ${frames.length} @ ${opts.fps} fps · ${opts.width}×${opts.height}`,
      ].join("\n")
    );
    return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  }

  function assetBaseName(opts, layerId) {
    const layerSuffix = layerId && layerId !== "all" ? `-${layerId}` : "";
    return `gmc-pattern${layerSuffix}-${opts.width}x${opts.height}-${opts.duration}s-${opts.fps}fps`;
  }

  function buildEmbedCode(type, opts) {
    const base = assetBaseName(opts, opts.layerId);
    const w = opts.width;
    const h = opts.height;
    const fps = opts.fps;
    const duration = opts.duration;
    const count = opts.frameCount || Math.round(duration * fps);
    const bg = opts.bgColor || "#ffffff";
    const padWidth = Math.max(4, String(count - 1).length);

    switch (type) {
      case "video":
        return `<!-- Upload ${base}.mp4 (and optional .webm) to your CDN -->
<div class="gmc-loop" style="width:100%;max-width:${w}px;aspect-ratio:${w}/${h};background:${bg}">
  <video
    src="./${base}.mp4"
    width="${w}"
    height="${h}"
    autoplay
    loop
    muted
    playsinline
    style="display:block;width:100%;height:100%;object-fit:contain"
  ></video>
</div>`;

      case "lottie":
        return `<!-- Upload ${base}.lottie.json · requires lottie-web -->
<div id="gmc-lottie" style="width:100%;max-width:${w}px;aspect-ratio:${w}/${h}"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"><\/script>
<script>
(function () {
  const el = document.getElementById("gmc-lottie");
  lottie.loadAnimation({
    container: el,
    renderer: "svg",
    loop: true,
    autoplay: true,
    path: "./${base}.lottie.json",
  });
})();
<\/script>`;

      case "svg-inline":
        return `<!-- Paste exported SVG inline, or use <img src="./${base}-frame.svg"> -->
<div class="gmc-static" style="width:100%;max-width:${w}px;aspect-ratio:${w}/${h};line-height:0">
  <!-- Replace with your single-frame SVG markup -->
  <img src="./${base}-frame.svg" width="${w}" height="${h}" alt="" style="width:100%;height:auto;display:block" />
</div>`;

      case "svg-animated":
        return `<!-- Upload ${base}.animated.svg (vector SMIL — hi-fi, single file) -->
<div class="gmc-animated" style="width:100%;max-width:${w}px;aspect-ratio:${w}/${h};line-height:0">
  <object
    type="image/svg+xml"
    data="./${base}.animated.svg"
    width="${w}"
    height="${h}"
    style="width:100%;height:100%;display:block"
  ></object>
</div>`;

      case "svg-sequence":
        return `<!-- Upload unzipped frames/ folder next to this page (see manifest.json) -->
<div id="gmc-svg-seq" style="width:100%;max-width:${w}px;aspect-ratio:${w}/${h};line-height:0"></div>
<script>
(function () {
  const FPS = ${fps};
  const COUNT = ${count};
  const PAD = ${padWidth};
  const PREFIX = "./frames/frame_";
  const root = document.getElementById("gmc-svg-seq");
  const img = document.createElement("img");
  img.alt = "";
  img.width = ${w};
  img.height = ${h};
  img.style.cssText = "width:100%;height:100%;display:block;object-fit:contain";
  root.appendChild(img);
  let i = 0;
  const pad = (n) => String(n).padStart(PAD, "0");
  img.src = PREFIX + pad(0) + ".svg";
  setInterval(function () {
    i = (i + 1) % COUNT;
    img.src = PREFIX + pad(i) + ".svg";
  }, 1000 / FPS);
})();
<\/script>`;

      default:
        return "";
    }
  }

  window.GMCSvgExport = {
    svgInnerBody,
    uniquifySvgFragment,
    buildAnimatedSvg,
    prepareSvgForInlineHtml,
    encodeEmbedConfig,
    buildEmbedPlayerUrl,
    buildRelativePlayerUrl,
    buildIframeLoopEmbed,
    zipSvgSequence,
    buildEmbedCode,
    assetBaseName,
  };
})();
