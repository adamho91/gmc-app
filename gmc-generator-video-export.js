/** Deterministic MP4 export for the 2D generator. Requires WebCodecs (Chrome/Edge). */
(function () {
  const button = document.getElementById('btn-mp4');
  const durationInput = document.getElementById('video-duration');
  const fpsInput = document.getElementById('video-fps');
  const status = document.getElementById('video-export-status');
  if (!button || !durationInput || !fpsInput || !status) return;

  /* Match the 3D exporter’s high-res default; never downscale a larger live canvas. */
  const EXPORT_MIN_PX = 2000;

  function setStatus(message) {
    status.textContent = message || '';
  }

  function setBusy(busy) {
    button.disabled = busy;
    durationInput.disabled = busy;
    fpsInput.disabled = busy;
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

  async function configureEncoder(encoder, width, height, fps) {
    const bitrate = Math.max(8_000_000, Math.round(width * height * fps * 0.18));
    const codecs = ['avc1.640028', 'avc1.4d0034', 'avc1.42001f'];
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

  /** Temporarily enlarge cell size so the grid renders at export resolution. */
  function beginHighResRender() {
    const colsEl = document.getElementById('cols');
    const cellEl = document.getElementById('cellSize');
    if (!colsEl || !cellEl) return () => {};

    const cols = Math.max(1, parseInt(colsEl.value, 10) || 25);
    const originalCell = cellEl.value;
    const livePx = cols * (parseInt(originalCell, 10) || 36);
    const targetPx = Math.max(livePx, EXPORT_MIN_PX);
    let exportCell = Math.max(1, Math.round(targetPx / cols));
    /* Keep width/height even for H.264. */
    while ((cols * exportCell) % 2 !== 0) exportCell += 1;
    cellEl.value = String(exportCell);

    return () => {
      cellEl.value = originalCell;
    };
  }

  async function exportMp4() {
    const duration = Math.max(1, Math.min(30, Number(durationInput.value) || 3));
    const fps = Math.max(12, Math.min(60, Math.round(Number(fpsInput.value) || 30)));
    durationInput.value = String(duration);
    fpsInput.value = String(fps);

    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
      throw new Error('MP4 export needs Chrome or Edge with WebCodecs enabled.');
    }

    const sourceCanvas = document.getElementById('c');
    if (!sourceCanvas) throw new Error('2D canvas is unavailable.');

    const originalTime = animTime;
    const restoreCell = beginHighResRender();
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

      const codec = await configureEncoder(encoder, width, height, fps);
      if (!codec) throw new Error('This browser cannot encode H.264 MP4 at the selected size.');

      for (let index = 0; index < totalFrames; index += 1) {
        if (encoderError) throw encoderError;
        animTime = (index / totalFrames) * duration;
        draw(currentSeed);
        encodeCtx.fillStyle = '#000000';
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
      setStatus(`Saved MP4 · ${duration}s · ${fps} fps · ${width}×${height}`);
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

  button.addEventListener('click', () => {
    exportMp4().catch((error) => {
      console.warn(error);
      setStatus(error?.message || 'MP4 export failed.');
    });
  });
})();
