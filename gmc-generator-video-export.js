/** Deterministic MP4 export for the 2D generator. Requires WebCodecs (Chrome/Edge). */
(function () {
  const button = document.getElementById('btn-mp4');
  const durationInput = document.getElementById('video-duration');
  const fpsInput = document.getElementById('video-fps');
  const sizeSelect = document.getElementById('video-size');
  const customWrap = document.getElementById('video-custom-wrap');
  const customSizeInput = document.getElementById('video-custom-size');
  const qualitySelect = document.getElementById('video-quality');
  const bgSelect = document.getElementById('video-bg');
  const status = document.getElementById('video-export-status');
  const progressWrap = document.getElementById('video-export-progress');
  const progressBar = document.getElementById('video-export-progress-bar');
  if (!button || !durationInput || !fpsInput || !status) return;

  const STORAGE_KEY = 'gmc-2d-video-export';
  const QUALITY = {
    draft: { coeff: 0.08, min: 2_000_000 },
    standard: { coeff: 0.18, min: 8_000_000 },
    high: { coeff: 0.28, min: 16_000_000 },
  };

  const settingEls = [
    durationInput,
    fpsInput,
    sizeSelect,
    customSizeInput,
    qualitySelect,
    bgSelect,
  ].filter(Boolean);

  function setProgress(pct) {
    const clamped = Math.min(100, Math.max(0, pct));
    if (progressWrap) {
      progressWrap.hidden = clamped <= 0;
      progressWrap.setAttribute('aria-valuenow', String(Math.round(clamped)));
    }
    if (progressBar) progressBar.style.width = `${clamped}%`;
  }

  function setStatus(message, progressPct) {
    status.textContent = message || '';
    if (progressPct != null) setProgress(progressPct);
  }

  function resetProgressLater() {
    setTimeout(() => setProgress(0), 2000);
  }

  function setBusy(busy) {
    button.disabled = busy;
    settingEls.forEach((el) => {
      el.disabled = busy;
    });
    button.textContent = busy ? 'Exporting…' : 'Export MP4';
  }

  function evenDimension(value) {
    return Math.max(2, Math.floor(value / 2) * 2);
  }

  function nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  async function waitForEncoderQueue(encoder, maxQueue = 2) {
    while (encoder.encodeQueueSize > maxQueue) {
      await new Promise((resolve) => {
        if (encoder.encodeQueueSize <= maxQueue) resolve();
        else encoder.addEventListener('dequeue', resolve, { once: true });
      });
    }
  }

  function syncCustomVisibility() {
    if (!customWrap || !sizeSelect) return;
    customWrap.hidden = sizeSelect.value !== 'custom';
  }

  function readSettings() {
    const duration = Math.max(1, Math.min(30, Number(durationInput.value) || 3));
    const fps = Math.max(12, Math.min(60, Math.round(Number(fpsInput.value) || 24)));
    const sizeMode = sizeSelect ? sizeSelect.value : '2000';
    let targetPx = 2000;
    if (sizeMode === 'live') targetPx = 0;
    else if (sizeMode === 'custom') {
      targetPx = Math.max(256, Math.min(4096, Math.round(Number(customSizeInput?.value) || 2400)));
    } else {
      targetPx = Math.max(256, Math.min(4096, parseInt(sizeMode, 10) || 2000));
    }
    const quality = QUALITY[qualitySelect?.value] ? qualitySelect.value : 'standard';
    const background = bgSelect?.value === 'white' ? '#ffffff' : '#000000';

    durationInput.value = String(duration);
    fpsInput.value = String(fps);
    if (customSizeInput && sizeMode === 'custom') customSizeInput.value = String(targetPx);

    return { duration, fps, sizeMode, targetPx, quality, background };
  }

  function persistSettings() {
    try {
      const s = readSettings();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          duration: s.duration,
          fps: s.fps,
          size: sizeSelect?.value || '2000',
          custom: customSizeInput?.value || '2400',
          quality: qualitySelect?.value || 'standard',
          bg: bgSelect?.value || 'black',
        })
      );
    } catch (_) {
      // Ignore private-mode / quota errors.
    }
  }

  function restoreSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.duration != null) durationInput.value = String(data.duration);
      if (data.fps != null) fpsInput.value = String(data.fps);
      if (sizeSelect && data.size) sizeSelect.value = data.size;
      if (customSizeInput && data.custom) customSizeInput.value = String(data.custom);
      if (qualitySelect && data.quality) qualitySelect.value = data.quality;
      if (bgSelect && data.bg) bgSelect.value = data.bg;
    } catch (_) {
      // Ignore corrupt storage.
    }
    syncCustomVisibility();
  }

  function videoBitrate(width, height, fps, qualityKey, scale = 1) {
    const q = QUALITY[qualityKey] || QUALITY.standard;
    const pixels = width * height;
    const raw = Math.round(pixels * fps * q.coeff * scale);
    const floor = pixels >= 3840 * 3840 ? 12_000_000 : q.min;
    const cap = pixels >= 3840 * 3840 ? 80_000_000 : 50_000_000;
    return Math.max(floor, Math.min(cap, raw));
  }

  async function configureEncoder(encoder, width, height, fps, qualityKey) {
    const pixels = width * height;
    const is4K = pixels >= 3840 * 3840;
    const isLarge = pixels >= 1920 * 1920;
    /* 3840² needs H.264 Level 6.0+ (57600 macroblocks/frame > Level 5.2 limit). */
    const codecs = is4K
      ? ['avc1.64003C', 'avc1.64003E', 'avc1.640034', 'avc1.640033', 'avc1.640028', 'avc1.42001f']
      : isLarge
        ? ['avc1.640034', 'avc1.640033', 'avc1.640028', 'avc1.4d0034', 'avc1.42001f']
        : ['avc1.640028', 'avc1.4d0034', 'avc1.42001f'];

    for (const bitrateScale of [1, 0.75, 0.5, 0.35]) {
      const bitrate = videoBitrate(width, height, fps, qualityKey, bitrateScale);
      for (const codec of codecs) {
        const candidates = [
          { codec, width, height, bitrate, framerate: fps, bitrateMode: 'constant', hardwareAcceleration: 'prefer-hardware' },
          { codec, width, height, bitrate, framerate: fps, hardwareAcceleration: 'prefer-hardware' },
          { codec, width, height, bitrate, framerate: fps, bitrateMode: 'constant' },
          { codec, width, height, bitrate, framerate: fps },
          { codec, width, height, bitrate, bitrateMode: 'constant' },
          { codec, width, height, bitrate },
        ];
        for (const config of candidates) {
          try {
            const support = await VideoEncoder.isConfigSupported(config);
            if (!support.supported) continue;
            encoder.configure(support.config || config);
            if (encoder.state === 'configured') return codec;
          } catch (_) {
            // Try the next H.264 profile/configuration.
          }
        }
      }
    }
    return null;
  }

  async function setupWebmPipeline(width, height, fps, qualityKey) {
    const { Muxer, ArrayBufferTarget } = await import('https://esm.sh/webm-muxer@4.0.1');
    const profiles = [
      { muxCodec: 'V_VP9', codec: 'vp09.00.10.08' },
      { muxCodec: 'V_VP8', codec: 'vp8' },
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
        error: (error) => {
          encoderError = error;
        },
      });

      for (const bitrateScale of [1, 0.75, 0.5]) {
        const bitrate = videoBitrate(width, height, fps, qualityKey, bitrateScale);
        const candidates = [
          { codec: profile.codec, width, height, bitrate, framerate: fps, bitrateMode: 'constant' },
          { codec: profile.codec, width, height, bitrate, framerate: fps },
          { codec: profile.codec, width, height, bitrate, bitrateMode: 'constant' },
          { codec: profile.codec, width, height, bitrate },
        ];
        for (const config of candidates) {
          try {
            const support = await VideoEncoder.isConfigSupported(config);
            if (!support.supported) continue;
            encoder.configure(support.config || config);
            if (encoder.state === 'configured') {
              return {
                encoder,
                usedFallback: true,
                getError: () => encoderError,
                finish: async () => {
                  if (encoderError) throw encoderError;
                  await encoder.flush();
                  muxer.finalize();
                  return {
                    blob: new Blob([target.buffer], { type: 'video/webm' }),
                    ext: 'webm',
                    label: profile.muxCodec === 'V_VP9' ? 'WebM · VP9' : 'WebM · VP8',
                  };
                },
              };
            }
          } catch (_) {
            // Try next WebM profile/config.
          }
        }
      }

      try {
        encoder.close();
      } catch (_) {
        // Ignore closed encoder.
      }
    }
    return null;
  }

  async function setupVideoPipeline(width, height, fps, qualityKey) {
    let Muxer;
    let ArrayBufferTarget;
    try {
      ({ Muxer, ArrayBufferTarget } = await import('https://esm.sh/mp4-muxer@5.1.3'));
    } catch (_) {
      throw new Error('Could not load MP4 encoder (blocked network?). Try Chrome/Edge again.');
    }

    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: { codec: 'avc', width, height },
      fastStart: 'in-memory',
    });
    let encoderError = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (error) => {
        encoderError = error;
      },
    });

    const codec = await configureEncoder(encoder, width, height, fps, qualityKey);
    if (codec) {
      return {
        encoder,
        usedFallback: false,
        getError: () => encoderError,
        finish: async () => {
          if (encoderError) throw encoderError;
          await encoder.flush();
          muxer.finalize();
          return {
            blob: new Blob([target.buffer], { type: 'video/mp4' }),
            ext: 'mp4',
            label: 'MP4',
          };
        },
      };
    }

    try {
      encoder.close();
    } catch (_) {
      // Ignore closed encoder.
    }

    const webm = await setupWebmPipeline(width, height, fps, qualityKey);
    if (webm) return webm;
    throw new Error('This browser cannot encode video at the selected size. Try 2000² or Chrome/Edge.');
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    /* Prefer top document so downloads still fire from the 2D iframe tab. */
    let host = document.body;
    try {
      if (window.top && window.top !== window && window.top.document?.body) {
        host = window.top.document.body;
      }
    } catch (_) {
      // Cross-origin top — stay in this frame.
    }
    host.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  /** Pixel size for high-res MP4 frames (0 = live canvas). Cap keeps H.264 encodable. */
  function resolveExportPx(targetPx) {
    const MAX_EXPORT_PX = 4096;
    if (targetPx > 0) return evenDimension(Math.min(MAX_EXPORT_PX, targetPx));
    const sourceCanvas = document.getElementById('c');
    const liveW = sourceCanvas?.width || 0;
    const liveH = sourceCanvas?.height || 0;
    const livePx = Math.max(liveW, liveH);
    if (livePx > 0) return evenDimension(Math.min(MAX_EXPORT_PX, livePx));
    const cols = Math.max(1, parseInt(document.getElementById('cols')?.value, 10) || 40);
    const cell = parseInt(document.getElementById('cellSize')?.value, 10) || 36;
    return evenDimension(Math.min(MAX_EXPORT_PX, cols * cell));
  }

  async function exportMp4() {
    const { duration, fps, targetPx, quality, background } = readSettings();
    persistSettings();

    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
      throw new Error('MP4 export needs Chrome or Edge with WebCodecs enabled.');
    }

    const sourceCanvas = document.getElementById('c');
    if (!sourceCanvas) throw new Error('2D canvas is unavailable.');

    const originalTime = animTime;
    const drawOpts = targetPx > 0 ? { exportPx: resolveExportPx(targetPx) } : undefined;
    const sizeLabel = drawOpts?.exportPx || 'live';
    const totalFrames = Math.max(1, Math.round(duration * fps));
    const frameDurationUs = Math.round(1_000_000 / fps);
    let encoder = null;

    window.GMCGeneratorExporting = true;
    setBusy(true);
    setProgress(1);

    try {
      setStatus(`Preparing encoder · ${sizeLabel}${drawOpts ? 'px' : ''}…`, 4);
      /* Let the button/status paint before the first heavy frame. */
      await nextPaint();
      await nextPaint();
      draw(currentSeed, drawOpts);

      const srcW = Math.max(2, sourceCanvas.width);
      const srcH = Math.max(2, sourceCanvas.height);
      const scale = Math.min(1, 4096 / Math.max(srcW, srcH));
      const width = evenDimension(srcW * scale);
      const height = evenDimension(srcH * scale);
      const encodeCanvas = document.createElement('canvas');
      encodeCanvas.width = width;
      encodeCanvas.height = height;
      const encodeCtx = encodeCanvas.getContext('2d', { alpha: false });
      if (!encodeCtx) throw new Error('Could not create export canvas.');

      setStatus('Loading encoder…', 6);
      const pipeline = await setupVideoPipeline(width, height, fps, quality);
      encoder = pipeline.encoder;
      if (pipeline.usedFallback) {
        setStatus(`H.264 unavailable at ${width}×${height} — using WebM…`, 7);
        await nextPaint();
      }
      setStatus(`Rendering 0 / ${totalFrames} · ${width}×${height}`, 8);

      for (let index = 0; index < totalFrames; index += 1) {
        const pipelineError = pipeline.getError();
        if (pipelineError) throw pipelineError;
        animTime = (index / totalFrames) * duration;
        draw(currentSeed, drawOpts);
        encodeCtx.fillStyle = background;
        encodeCtx.fillRect(0, 0, width, height);
        encodeCtx.drawImage(sourceCanvas, 0, 0, width, height);

        const frame = new VideoFrame(encodeCanvas, {
          timestamp: Math.round((index * 1_000_000) / fps),
          duration: frameDurationUs,
        });
        await waitForEncoderQueue(encoder);
        encoder.encode(frame, { keyFrame: index % fps === 0 });
        frame.close();

        const framePct = 8 + ((index + 1) / totalFrames) * 82;
        if (index % Math.max(1, Math.round(fps / 4)) === 0 || index === totalFrames - 1) {
          const pct = Math.round(((index + 1) / totalFrames) * 100);
          setStatus(`Rendering ${index + 1} / ${totalFrames} (${pct}%) · ${width}×${height}`, framePct);
          await nextPaint();
        } else {
          setProgress(framePct);
        }
      }

      setStatus('Finalizing video…', 94);
      const result = await pipeline.finish();
      const filename = `gmc_2d_${currentSeed}_${duration}s_${fps}fps_${width}x${height}.${result.ext}`;
      download(result.blob, filename);
      const savedAs = result.label === 'MP4' ? 'MP4' : `${result.label} (H.264 unavailable at this size)`;
      setStatus(`Saved ${savedAs} · ${duration}s · ${fps} fps · ${width}×${height} · ${quality}`, 100);
      resetProgressLater();
    } finally {
      if (encoder && encoder.state !== 'closed') {
        try {
          encoder.close();
        } catch (_) {
          // Encoder may already be closed after a WebCodecs error.
        }
      }
      animTime = originalTime;
      draw(currentSeed);
      window.GMCGeneratorExporting = false;
      setBusy(false);
    }
  }

  restoreSettings();
  settingEls.forEach((el) => {
    el.addEventListener('change', () => {
      syncCustomVisibility();
      persistSettings();
    });
  });
  sizeSelect?.addEventListener('input', syncCustomVisibility);

  button.addEventListener('click', () => {
    exportMp4().catch((error) => {
      console.warn(error);
      setStatus(error?.message || 'MP4 export failed.', 0);
    });
  });
})();
