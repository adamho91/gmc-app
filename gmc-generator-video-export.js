/** Deterministic MP4 / WebM export for the 2D generator. MP4 renders WebM first, then transcodes. */
(function () {
  const mp4Button = document.getElementById('btn-mp4');
  const webmButton = document.getElementById('btn-webm');
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
  if (!mp4Button || !webmButton || !durationInput || !fpsInput || !status) return;

  const STORAGE_KEY = 'gmc-2d-video-export';
  const QUALITY = {
    draft: { coeff: 0.08, min: 2_000_000 },
    standard: { coeff: 0.18, min: 8_000_000 },
    high: { coeff: 0.28, min: 16_000_000 },
  };

  const exportButtons = [mp4Button, webmButton];
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

  function setBusy(busy, activeFormat) {
    exportButtons.forEach((btn) => {
      btn.disabled = busy;
    });
    settingEls.forEach((el) => {
      el.disabled = busy;
    });
    mp4Button.textContent = busy && activeFormat === 'mp4' ? 'Exporting…' : 'MP4';
    webmButton.textContent = busy && activeFormat === 'webm' ? 'Exporting…' : 'WebM';
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

  async function setupVideoPipeline(format, width, height, fps, qualityKey) {
    const pipeline = await setupWebmPipeline(width, height, fps, qualityKey);
    if (!pipeline) {
      throw new Error('This browser cannot encode WebM at the selected size. Try Chrome/Edge.');
    }
    return pipeline;
  }

  let ffmpegLoader = null;

  const FFMPEG_VENDOR = new URL('vendor/ffmpeg/index.js', document.baseURI).href.replace(/index\.js$/, '');

  async function loadFfmpeg(onStatus) {
    if (!ffmpegLoader) {
      ffmpegLoader = (async () => {
        onStatus?.('MP4 · loading transcoder…', 80);
        const { FFmpeg } = await import(`${FFMPEG_VENDOR}index.js`);
        const { toBlobURL } = await import('https://esm.sh/@ffmpeg/util@0.12.1');
        const ffmpeg = new FFmpeg();
        const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
          classWorkerURL: `${FFMPEG_VENDOR}worker.js`,
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        return ffmpeg;
      })();
    }
    return ffmpegLoader;
  }

  function h264LevelForSize(width, height) {
    const macroblocks = Math.ceil(width / 16) * Math.ceil(height / 16);
    if (macroblocks > 36_864) return '6.0';
    if (macroblocks > 8_704) return '5.1';
    return '4.0';
  }

  async function transcodeWebmToMp4(webmBlob, qualityKey, width, height, fps, onProgress) {
    const ffmpeg = await loadFfmpeg((msg, pct) => onProgress?.(msg, pct));
    const { fetchFile } = await import('https://esm.sh/@ffmpeg/util@0.12.1');
    const crf = qualityKey === 'high' ? '18' : qualityKey === 'draft' ? '28' : '23';
    const level = h264LevelForSize(width, height);

    const handleProgress = ({ progress }) => {
      const pct = 78 + Math.min(20, Math.max(0, progress) * 20);
      onProgress?.(`MP4 · converting WebM → MP4 (${Math.round(progress * 100)}%)…`, pct);
    };

    ffmpeg.on('progress', handleProgress);
    try {
      await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));
      const exitCode = await ffmpeg.exec([
        '-i', 'input.webm',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', crf,
        '-pix_fmt', 'yuv420p',
        '-profile:v', 'high',
        '-level', level,
        '-tag:v', 'avc1',
        '-colorspace', 'bt709',
        '-color_primaries', 'bt709',
        '-color_trc', 'bt709',
        '-movflags', '+faststart',
        '-r', String(fps),
        '-vsync', 'cfr',
        '-f', 'mp4',
        'output.mp4',
      ]);
      if (exitCode !== 0) {
        throw new Error('MP4 transcode failed. Try WebM or a smaller size.');
      }
    } finally {
      ffmpeg.off('progress', handleProgress);
    }
    const data = await ffmpeg.readFile('output.mp4');
    try {
      await ffmpeg.deleteFile('input.webm');
      await ffmpeg.deleteFile('output.mp4');
    } catch (_) {
      // Ignore cleanup errors between exports.
    }
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (bytes.byteLength < 1024) {
      throw new Error('MP4 transcode produced an empty file. Try WebM or a smaller size.');
    }
    return new Blob([bytes], { type: 'video/mp4' });
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

  /** Pixel size for high-res video frames (0 = live canvas). Cap keeps encoders stable. */
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

  function mp4PhaseLabel(phase, detail) {
    return `Step ${phase} · ${detail}`;
  }

  async function exportVideo(format) {
    const { duration, fps, targetPx, quality, background } = readSettings();
    persistSettings();

    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
      throw new Error('Video export needs Chrome or Edge with WebCodecs enabled.');
    }

    const sourceCanvas = document.getElementById('c');
    if (!sourceCanvas) throw new Error('2D canvas is unavailable.');

    const originalTime = animTime;
    const drawOpts = targetPx > 0 ? { exportPx: resolveExportPx(targetPx) } : undefined;
    const sizeLabel = drawOpts?.exportPx || 'live';
    const totalFrames = Math.max(1, Math.round(duration * fps));
    const frameDurationUs = Math.round(1_000_000 / fps);
    const formatLabel = format === 'webm' ? 'WebM' : 'MP4';
    let encoder = null;

    window.GMCGeneratorExporting = true;
    setBusy(true, format);
    setProgress(1);

    try {
      setStatus(
        format === 'mp4'
          ? mp4PhaseLabel('1/2', `WebM · preparing · ${sizeLabel}${drawOpts ? 'px' : ''}…`)
          : `Preparing ${formatLabel} · ${sizeLabel}${drawOpts ? 'px' : ''}…`,
        4
      );
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

      setStatus(
        format === 'mp4'
          ? mp4PhaseLabel('1/2', 'WebM · loading encoder…')
          : `Loading ${formatLabel} encoder…`,
        6
      );
      const pipeline = await setupVideoPipeline(format, width, height, fps, quality);
      encoder = pipeline.encoder;
      setStatus(
        format === 'mp4'
          ? mp4PhaseLabel('1/2', `WebM · rendering 0 / ${totalFrames} · ${width}×${height}`)
          : `Rendering 0 / ${totalFrames} · ${width}×${height}`,
        8
      );

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

        const renderCap = format === 'mp4' ? 75 : 82;
        const framePct = 8 + ((index + 1) / totalFrames) * (renderCap - 8);
        if (index % Math.max(1, Math.round(fps / 4)) === 0 || index === totalFrames - 1) {
          const pct = Math.round(((index + 1) / totalFrames) * 100);
          setStatus(
            format === 'mp4'
              ? mp4PhaseLabel('1/2', `WebM · rendering ${index + 1} / ${totalFrames} (${pct}%) · ${width}×${height}`)
              : `Rendering ${index + 1} / ${totalFrames} (${pct}%) · ${width}×${height}`,
            framePct
          );
          await nextPaint();
        } else {
          setProgress(framePct);
        }
      }

      setStatus(
        format === 'mp4'
          ? mp4PhaseLabel('1/2', 'WebM · finalizing…')
          : `Finalizing ${formatLabel}…`,
        format === 'mp4' ? 76 : 94
      );
      const result = await pipeline.finish();
      let downloadBlob = result.blob;
      let downloadExt = result.ext;
      let savedLabel = result.label;

      if (format === 'mp4') {
        setStatus(mp4PhaseLabel('2/2', 'MP4 · converting WebM → MP4…'), 78);
        downloadBlob = await transcodeWebmToMp4(result.blob, quality, width, height, fps, (msg, pct) => {
          setStatus(mp4PhaseLabel('2/2', msg), pct);
        });
        downloadExt = 'mp4';
        savedLabel = 'MP4';
      }

      const filename = `gmc_2d_${currentSeed}_${duration}s_${fps}fps_${width}x${height}.${downloadExt}`;
      download(downloadBlob, filename);
      setStatus(`Saved ${savedLabel} · ${duration}s · ${fps} fps · ${width}×${height} · ${quality}`, 100);
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

  mp4Button.addEventListener('click', () => {
    exportVideo('mp4').catch((error) => {
      console.warn(error);
      setStatus(error?.message || 'MP4 export failed.', 0);
    });
  });

  webmButton.addEventListener('click', () => {
    exportVideo('webm').catch((error) => {
      console.warn(error);
      setStatus(error?.message || 'WebM export failed.', 0);
    });
  });
})();
