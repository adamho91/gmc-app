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

  function setStatus(message) {
    status.textContent = message || '';
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
    const fps = Math.max(12, Math.min(60, Math.round(Number(fpsInput.value) || 30)));
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

  async function configureEncoder(encoder, width, height, fps, qualityKey) {
    const q = QUALITY[qualityKey] || QUALITY.standard;
    const pixels = width * height;
    const bitrate = Math.max(
      q.min,
      Math.round(pixels * fps * q.coeff),
      pixels >= 3840 * 3840 ? 40_000_000 : 0
    );
    /* Prefer High@5.1 / 5.2 for 4K; fall back to lower levels. */
    const codecs =
      pixels >= 1920 * 1920
        ? ['avc1.640034', 'avc1.640033', 'avc1.640028', 'avc1.4d0034', 'avc1.42001f']
        : ['avc1.640028', 'avc1.4d0034', 'avc1.42001f'];
    for (const codec of codecs) {
      const candidates = [
        { codec, width, height, bitrate, framerate: fps, bitrateMode: 'constant' },
        { codec, width, height, bitrate, framerate: fps },
      ];
      for (const config of candidates) {
        try {
          const support = await VideoEncoder.isConfigSupported(config);
          if (!support.supported) continue;
          encoder.configure(config);
          if (encoder.state === 'configured') return codec;
        } catch (_) {
          // Try the next H.264 profile/configuration.
        }
      }
    }
    return null;
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  /** Temporarily enlarge cell size so the grid renders at the chosen resolution. */
  function beginSizedRender(targetPx) {
    const colsEl = document.getElementById('cols');
    const cellEl = document.getElementById('cellSize');
    if (!colsEl || !cellEl) return () => {};

    const cols = Math.max(1, parseInt(colsEl.value, 10) || 25);
    const originalCell = cellEl.value;
    const livePx = cols * (parseInt(originalCell, 10) || 36);
    const desired = targetPx > 0 ? targetPx : livePx;
    let exportCell = Math.max(1, Math.round(desired / cols));
    while ((cols * exportCell) % 2 !== 0) exportCell += 1;
    cellEl.value = String(exportCell);

    return () => {
      cellEl.value = originalCell;
    };
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
    const restoreCell = beginSizedRender(targetPx);
    const totalFrames = Math.max(1, Math.round(duration * fps));
    const frameDurationUs = Math.round(1_000_000 / fps);
    let encoderError = null;
    let encoder = null;

    window.GMCGeneratorExporting = true;
    setBusy(true);

    try {
      setStatus('Preparing encoder…');
      draw(currentSeed);

      const width = evenDimension(sourceCanvas.width);
      const height = evenDimension(sourceCanvas.height);
      const encodeCanvas = document.createElement('canvas');
      encodeCanvas.width = width;
      encodeCanvas.height = height;
      const encodeCtx = encodeCanvas.getContext('2d', { alpha: false });

      const { Muxer, ArrayBufferTarget } = await import('https://esm.sh/mp4-muxer@5.1.3');
      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: { codec: 'avc', width, height },
        fastStart: 'in-memory',
      });

      encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (error) => {
          encoderError = error;
        },
      });

      const codec = await configureEncoder(encoder, width, height, fps, quality);
      if (!codec) throw new Error('This browser cannot encode H.264 MP4 at the selected size.');

      for (let index = 0; index < totalFrames; index += 1) {
        if (encoderError) throw encoderError;
        animTime = (index / totalFrames) * duration;
        draw(currentSeed);
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

        if (index % Math.max(1, Math.round(fps / 4)) === 0 || index === totalFrames - 1) {
          setStatus(`Rendering ${index + 1} / ${totalFrames} · ${width}×${height}`);
          await nextPaint();
        }
      }

      if (encoderError) throw encoderError;
      setStatus('Finalizing MP4…');
      await encoder.flush();
      muxer.finalize();

      const filename = `gmc_2d_${currentSeed}_${duration}s_${fps}fps_${width}x${height}.mp4`;
      download(new Blob([target.buffer], { type: 'video/mp4' }), filename);
      setStatus(`Saved · ${duration}s · ${fps} fps · ${width}×${height} · ${quality}`);
    } finally {
      if (encoder && encoder.state !== 'closed') {
        try {
          encoder.close();
        } catch (_) {
          // Encoder may already be closed after a WebCodecs error.
        }
      }
      restoreCell();
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
      setStatus(error?.message || 'MP4 export failed.');
    });
  });
})();
