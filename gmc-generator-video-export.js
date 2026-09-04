/** Deterministic MP4 / WebM export for the 2D generator. MP4 uses WebM→H.264 transcode (CloudConvert-style) or direct JPEG encode at 4K. */
(function () {
  const PIXELS_4K = 3840 * 3840;
  /** Browser WebCodecs WebM tends to corrupt past ~2K / multi-megapixel long encodes. */
  const WEBM_BRIDGE_MAX_EDGE = 2048;
  const WEBM_BRIDGE_MAX_PIXELS = 2048 * 2048;
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

  function setEncodingActive(active) {
    if (progressWrap) progressWrap.classList.toggle('is-encoding', active);
  }

  function formatElapsed(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${totalSeconds}s`;
  }

  function createFfmpegStageTracker({ onProgress, label, startPct, endPct, totalFrames, fps = 24 }) {
    const startedAt = Date.now();
    let lastFrame = 0;
    let lastRatio = 0;
    let tickTimer = null;

    const pctFromRatio = (ratio) => startPct + Math.min(1, Math.max(0, ratio)) * (endPct - startPct);

    const emit = () => {
      const elapsed = formatElapsed(Date.now() - startedAt);
      let detail = label;
      if (totalFrames && lastFrame > 0) {
        detail += ` · ${lastFrame}/${totalFrames} frames`;
      } else if (lastRatio > 0) {
        detail += ` · ${Math.round(lastRatio * 100)}%`;
      }
      detail += ` · ${elapsed} elapsed`;
      const idleCreep = Math.min(0.12, (Date.now() - startedAt) / 180000);
      const ratio = lastRatio > 0 ? lastRatio : idleCreep;
      onProgress?.(detail, pctFromRatio(ratio));
    };

    const logHandler = ({ message }) => {
      const frameMatch = message.match(/frame=\s*(\d+)/);
      if (!frameMatch) return;
      lastFrame = parseInt(frameMatch[1], 10);
      if (totalFrames > 0) {
        lastRatio = Math.max(lastRatio, lastFrame / totalFrames);
        emit();
      }
    };

    const progressHandler = ({ progress, time }) => {
      if (progress > 0) {
        lastRatio = Math.max(lastRatio, progress);
        emit();
        return;
      }
      if (time > 0 && totalFrames > 0 && fps > 0) {
        const durationUs = (totalFrames / fps) * 1_000_000;
        if (durationUs > 0) {
          lastRatio = Math.max(lastRatio, time / durationUs);
          emit();
        }
      }
    };

    return {
      start(ffmpeg) {
        ffmpeg.on('log', logHandler);
        ffmpeg.on('progress', progressHandler);
        tickTimer = setInterval(emit, 1000);
        emit();
      },
      stop(ffmpeg) {
        ffmpeg.off('log', logHandler);
        ffmpeg.off('progress', progressHandler);
        if (tickTimer) {
          clearInterval(tickTimer);
          tickTimer = null;
        }
      },
    };
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
    const longest = Math.max(width, height);
    const hiRes = pixels >= 2560 * 2560 || longest >= 2560;
    const raw = Math.round(pixels * fps * q.coeff * scale);
    const floor = hiRes ? 12_000_000 : q.min;
    const cap = hiRes ? 80_000_000 : 50_000_000;
    return Math.max(floor, Math.min(cap, raw));
  }

  function shouldUseWebmBridge(width, height) {
    const pixels = width * height;
    const longest = Math.max(width, height);
    if (longest > WEBM_BRIDGE_MAX_EDGE) return false;
    if (pixels > WEBM_BRIDGE_MAX_PIXELS) return false;
    if (pixels >= PIXELS_4K) return false;
    return true;
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

  function canvasToJpegBlob(canvas, quality = 0.9) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not encode frame JPEG.'));
      }, 'image/jpeg', quality);
    });
  }

  function readFfmpegBytes(data) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (bytes.byteLength < 1024) {
      throw new Error('MP4 encode produced an empty file. Try WebM or a smaller size.');
    }
    return bytes;
  }

  function looksLikeMp4(bytes) {
    return bytes.byteLength >= 8
      && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  }

  async function cleanupFfmpegFiles(ffmpeg, names) {
    for (const name of names) {
      try {
        await ffmpeg.deleteFile(name);
      } catch (_) {
        // Ignore missing temp files.
      }
    }
  }

  async function encodeMp4FromFrames({
    ffmpeg,
    fetchFile,
    width,
    height,
    fps,
    qualityKey,
    totalFrames,
    duration,
    encodeCanvas,
    encodeCtx,
    sourceCanvas,
    drawOpts,
    background,
    onProgress,
  }) {
    const crf = qualityKey === 'high' ? '18' : qualityKey === 'draft' ? '28' : '23';
    const pad = Math.max(4, String(totalFrames - 1).length);
    const framePattern = `frame%0${pad}d.jpg`;
    const frameNames = [];
    const pixels = width * height;
    const longest = Math.max(width, height);
    const preset = longest >= 3000 || pixels >= 2560 * 2560
      ? 'ultrafast'
      : pixels >= 1920 * 1920
        ? 'veryfast'
        : 'medium';
    const jpegQuality = longest >= 3000 || pixels >= 2560 * 2560 ? 0.92 : 0.9;
    const gop = Math.max(12, Math.round(fps * 2));

    for (let index = 0; index < totalFrames; index += 1) {
      animTime = (index / totalFrames) * duration;
      draw(currentSeed, drawOpts);
      if (sourceCanvas.width !== width || sourceCanvas.height !== height) {
        throw new Error(`Export frame size mismatch (${sourceCanvas.width}×${sourceCanvas.height} ≠ ${width}×${height}).`);
      }
      encodeCtx.fillStyle = background;
      encodeCtx.fillRect(0, 0, width, height);
      encodeCtx.drawImage(sourceCanvas, 0, 0, width, height);

      const frameName = `frame${String(index).padStart(pad, '0')}.jpg`;
      frameNames.push(frameName);
      await ffmpeg.writeFile(frameName, await fetchFile(await canvasToJpegBlob(encodeCanvas, jpegQuality)));

      const framePct = 8 + ((index + 1) / totalFrames) * 67;
      if (index % Math.max(1, Math.round(fps / 4)) === 0 || index === totalFrames - 1) {
        const pct = Math.round(((index + 1) / totalFrames) * 100);
        onProgress(`rendering ${index + 1} / ${totalFrames} (${pct}%) · ${width}×${height}`, framePct);
        await nextPaint();
      }
    }

    onProgress('encoding H.264…', 78);
    setEncodingActive(true);
    const logs = [];
    const logHandler = ({ message }) => logs.push(message);
    const stageTracker = createFfmpegStageTracker({
      onProgress,
      label: 'encoding H.264',
      startPct: 78,
      endPct: 98,
      totalFrames,
      fps,
    });

    ffmpeg.on('log', logHandler);
    stageTracker.start(ffmpeg);

    const encodeArgs = [
      '-framerate', String(fps),
      '-start_number', '0',
      '-i', framePattern,
      '-c:v', 'libx264',
      '-preset', preset,
      '-crf', crf,
      '-g', String(gop),
      '-keyint_min', String(Math.max(1, Math.round(fps))),
      '-pix_fmt', 'yuv420p',
      '-profile:v', 'high',
      '-level', '5.1',
      '-movflags', '+faststart',
      '-an',
      'output.mp4',
    ];

    let exitCode = -1;
    try {
      exitCode = await ffmpeg.exec(encodeArgs);
    } finally {
      stageTracker.stop(ffmpeg);
      ffmpeg.off('log', logHandler);
      setEncodingActive(false);
      await cleanupFfmpegFiles(ffmpeg, frameNames);
    }

    let bytes;
    try {
      bytes = readFfmpegBytes(await ffmpeg.readFile('output.mp4'));
    } catch (error) {
      const tail = logs.slice(-4).join(' · ');
      throw new Error(tail || error?.message || 'MP4 encode failed. Try WebM or a smaller size.');
    } finally {
      await cleanupFfmpegFiles(ffmpeg, ['output.mp4']);
    }

    if (!looksLikeMp4(bytes)) {
      const tail = logs.slice(-4).join(' · ');
      throw new Error(tail || 'MP4 encode failed. Try WebM or a smaller size.');
    }
    if (exitCode !== 0) {
      console.warn('ffmpeg exited with code', exitCode, logs.slice(-8).join('\n'));
    }
    return new Blob([bytes], { type: 'video/mp4' });
  }

  /** CloudConvert-style: ffmpeg -i input.webm -c:v libx264 -crf 23 -movflags +faststart output.mp4 */
  async function transcodeWebmToMp4(ffmpeg, fetchFile, webmBlob, qualityKey, onProgress) {
    const crf = qualityKey === 'high' ? '18' : qualityKey === 'draft' ? '28' : '23';
    await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));

    const logs = [];
    const logHandler = ({ message }) => logs.push(message);
    setEncodingActive(true);
    const stageTracker = createFfmpegStageTracker({
      onProgress,
      label: 'converting WebM → MP4',
      startPct: 78,
      endPct: 98,
      totalFrames: 0,
    });

    ffmpeg.on('log', logHandler);
    stageTracker.start(ffmpeg);
    try {
      await ffmpeg.exec([
        '-i', 'input.webm',
        '-c:v', 'libx264',
        '-crf', crf,
        '-movflags', '+faststart',
        'output.mp4',
      ]);
    } finally {
      stageTracker.stop(ffmpeg);
      ffmpeg.off('log', logHandler);
      setEncodingActive(false);
      await cleanupFfmpegFiles(ffmpeg, ['input.webm']);
    }

    let bytes;
    try {
      bytes = readFfmpegBytes(await ffmpeg.readFile('output.mp4'));
    } catch (error) {
      const tail = logs.slice(-4).join(' · ');
      throw new Error(tail || error?.message || 'MP4 transcode failed.');
    } finally {
      await cleanupFfmpegFiles(ffmpeg, ['output.mp4']);
    }

    if (!looksLikeMp4(bytes)) {
      const tail = logs.slice(-4).join(' · ');
      throw new Error(tail || 'MP4 transcode failed.');
    }
    return new Blob([bytes], { type: 'video/mp4' });
  }

  async function renderFrameSequence({
    pipeline,
    encoder,
    totalFrames,
    duration,
    fps,
    frameDurationUs,
    width,
    height,
    encodeCanvas,
    encodeCtx,
    sourceCanvas,
    drawOpts,
    background,
    onFrame,
  }) {
    for (let index = 0; index < totalFrames; index += 1) {
      const pipelineError = pipeline.getError();
      if (pipelineError) throw pipelineError;
      animTime = (index / totalFrames) * duration;
      draw(currentSeed, drawOpts);
      if (sourceCanvas.width !== width || sourceCanvas.height !== height) {
        throw new Error(`Export frame size mismatch (${sourceCanvas.width}×${sourceCanvas.height} ≠ ${width}×${height}).`);
      }
      encodeCtx.fillStyle = background;
      encodeCtx.fillRect(0, 0, width, height);
      encodeCtx.drawImage(sourceCanvas, 0, 0, width, height);

      const frame = new VideoFrame(encodeCanvas, {
        timestamp: Math.round((index * 1_000_000) / fps),
        duration: frameDurationUs,
      });
      await waitForEncoderQueue(encoder);
      const pipelineErrorAfter = pipeline.getError();
      if (pipelineErrorAfter) {
        frame.close();
        throw pipelineErrorAfter;
      }
      encoder.encode(frame, { keyFrame: index % fps === 0 });
      frame.close();

      await onFrame(index, totalFrames, width, height);
    }
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

  function readCanvasAspect() {
    const widthInput = document.getElementById('canvasWidth');
    const heightInput = document.getElementById('canvasHeight');
    const sourceCanvas = document.getElementById('c');
    const w = Math.max(2, Number(widthInput?.value) || sourceCanvas?.width || 1440);
    const h = Math.max(2, Number(heightInput?.value) || sourceCanvas?.height || w);
    return { width: w, height: h };
  }

  /** Export dimensions for video frames (0 = live canvas). Preserve the current canvas aspect. */
  function resolveExportSize(targetPx) {
    const MAX_EXPORT_PX = 4096;
    if (targetPx > 0) {
      const aspect = readCanvasAspect();
      const longest = Math.max(aspect.width, aspect.height);
      const scale = longest > 0 ? Math.min(1, MAX_EXPORT_PX / longest) * (Math.min(MAX_EXPORT_PX, targetPx) / longest) : 1;
      const width = evenDimension(aspect.width * scale);
      const height = evenDimension(aspect.height * scale);
      return {
        width: Math.max(2, width),
        height: Math.max(2, height),
      };
    }
    const sourceCanvas = document.getElementById('c');
    const liveW = sourceCanvas?.width || 0;
    const liveH = sourceCanvas?.height || 0;
    if (liveW > 0 && liveH > 0) {
      const scale = Math.min(1, MAX_EXPORT_PX / Math.max(liveW, liveH));
      return {
        width: evenDimension(liveW * scale),
        height: evenDimension(liveH * scale),
      };
    }
    const cols = Math.max(1, parseInt(document.getElementById('cols')?.value, 10) || 40);
    const aspect = readCanvasAspect();
    const longest = Math.max(aspect.width, aspect.height, 1);
    const fallbackLongest = cols * (parseInt(document.getElementById('cellSize')?.value, 10) || 36);
    const scale = fallbackLongest > 0 ? Math.min(1, MAX_EXPORT_PX / fallbackLongest) : 1;
    return {
      width: evenDimension(aspect.width * scale),
      height: evenDimension(aspect.height * scale),
    };
  }

  function mp4PhaseLabel(phase, detail) {
    return `Step ${phase} · ${detail}`;
  }

  async function exportVideo(format) {
    const { duration, fps, targetPx, quality, background } = readSettings();
    persistSettings();

    if (format === 'webm' && (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined')) {
      throw new Error('WebM export needs Chrome or Edge with WebCodecs enabled.');
    }

    const sourceCanvas = document.getElementById('c');
    if (!sourceCanvas) throw new Error('2D canvas is unavailable.');

    const originalTime = animTime;
    const exportSize = resolveExportSize(targetPx);
    const drawOpts = targetPx > 0 ? { exportWidth: exportSize.width, exportHeight: exportSize.height } : undefined;
    const sizeLabel = targetPx > 0 ? `${exportSize.width}×${exportSize.height}` : 'live';
    const totalFrames = Math.max(1, Math.round(duration * fps));
    const frameDurationUs = Math.round(1_000_000 / fps);
    const formatLabel = format === 'webm' ? 'WebM' : 'MP4';
    let encoder = null;

    window.GMCGeneratorExporting = true;
    setBusy(true, format);
    setProgress(1);

    try {
      setStatus(`Preparing ${formatLabel} · ${sizeLabel}…`, 4);
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

      if (format === 'mp4') {
        const { fetchFile } = await import('https://esm.sh/@ffmpeg/util@0.12.1');
        const useWebmTranscode = shouldUseWebmBridge(width, height);

        if (useWebmTranscode) {
          if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
            throw new Error('MP4 export needs Chrome or Edge with WebCodecs enabled.');
          }

          setStatus(mp4PhaseLabel('1/2', 'WebM · loading encoder…'), 6);
          const pipeline = await setupVideoPipeline(format, width, height, fps, quality);
          encoder = pipeline.encoder;
          setStatus(mp4PhaseLabel('1/2', `WebM · rendering 0 / ${totalFrames} · ${width}×${height}`), 8);

          await renderFrameSequence({
            pipeline,
            encoder,
            totalFrames,
            duration,
            fps,
            frameDurationUs,
            width,
            height,
            encodeCanvas,
            encodeCtx,
            sourceCanvas,
            drawOpts,
            background,
            onFrame: async (index, frames, w, h) => {
              const framePct = 8 + ((index + 1) / frames) * 67;
              if (index % Math.max(1, Math.round(fps / 4)) === 0 || index === frames - 1) {
                const pct = Math.round(((index + 1) / frames) * 100);
                setStatus(mp4PhaseLabel('1/2', `WebM · rendering ${index + 1} / ${frames} (${pct}%) · ${w}×${h}`), framePct);
                await nextPaint();
              } else {
                setProgress(framePct);
              }
            },
          });

          setStatus(mp4PhaseLabel('1/2', 'WebM · finalizing…'), 76);
          const webmResult = await pipeline.finish();
          if (encoder && encoder.state !== 'closed') {
            try { encoder.close(); } catch (_) { /* ignore */ }
            encoder = null;
          }
          const minWebmBytes = Math.max(32_768, totalFrames * 256);
          const webmLooksBad = !webmResult?.blob || webmResult.blob.size < minWebmBytes;

          setStatus(mp4PhaseLabel('2/2', 'MP4 · loading transcoder…'), 78);
          const ffmpeg = await loadFfmpeg((msg, pct) => setStatus(mp4PhaseLabel('2/2', msg), pct));
          let downloadBlob;
          try {
            if (webmLooksBad) {
              throw new Error('WebM encode produced a tiny/corrupt file');
            }
            downloadBlob = await transcodeWebmToMp4(ffmpeg, fetchFile, webmResult.blob, quality, (msg, pct) => {
              setStatus(mp4PhaseLabel('2/2', `MP4 · ${msg}`), pct);
            });
          } catch (transcodeError) {
            console.warn('WebM path failed, falling back to direct MP4 encode', transcodeError);
            setStatus(mp4PhaseLabel('1/2', 'retry · rendering frames for MP4…'), 8);
            downloadBlob = await encodeMp4FromFrames({
              ffmpeg,
              fetchFile,
              width,
              height,
              fps,
              qualityKey: quality,
              totalFrames,
              duration,
              encodeCanvas,
              encodeCtx,
              sourceCanvas,
              drawOpts,
              background,
              onProgress: (msg, pct) => {
                const phase = msg.startsWith('encoding') ? '2/2' : '1/2';
                setStatus(mp4PhaseLabel(phase, msg), pct);
              },
            });
          }

          const filename = `gmc_2d_${currentSeed}_${duration}s_${fps}fps_${width}x${height}.mp4`;
          download(downloadBlob, filename);
          setStatus(`Saved MP4 · ${duration}s · ${fps} fps · ${width}×${height} · ${quality}`, 100);
          resetProgressLater();
          return;
        }

        setStatus(mp4PhaseLabel('1/2', `JPEG frames · ${width}×${height} (high-res path)…`), 6);
        const ffmpeg = await loadFfmpeg((msg, pct) => setStatus(mp4PhaseLabel('1/2', msg), pct));
        setStatus(mp4PhaseLabel('1/2', `rendering 0 / ${totalFrames} · ${width}×${height}`), 8);
        const downloadBlob = await encodeMp4FromFrames({
          ffmpeg,
          fetchFile,
          width,
          height,
          fps,
          qualityKey: quality,
          totalFrames,
          duration,
          encodeCanvas,
          encodeCtx,
          sourceCanvas,
          drawOpts,
          background,
          onProgress: (msg, pct) => {
            const phase = msg.startsWith('encoding') ? '2/2' : '1/2';
            setStatus(mp4PhaseLabel(phase, msg), pct);
          },
        });
        const filename = `gmc_2d_${currentSeed}_${duration}s_${fps}fps_${width}x${height}.mp4`;
        download(downloadBlob, filename);
        setStatus(`Saved MP4 · ${duration}s · ${fps} fps · ${width}×${height} · ${quality}`, 100);
        resetProgressLater();
        return;
      }

      setStatus(`Loading ${formatLabel} encoder…`, 6);
      const pipeline = await setupVideoPipeline(format, width, height, fps, quality);
      encoder = pipeline.encoder;
      setStatus(`Rendering 0 / ${totalFrames} · ${width}×${height}`, 8);

      await renderFrameSequence({
        pipeline,
        encoder,
        totalFrames,
        duration,
        fps,
        frameDurationUs,
        width,
        height,
        encodeCanvas,
        encodeCtx,
        sourceCanvas,
        drawOpts,
        background,
        onFrame: async (index, frames, w, h) => {
          const framePct = 8 + ((index + 1) / frames) * 74;
          if (index % Math.max(1, Math.round(fps / 4)) === 0 || index === frames - 1) {
            const pct = Math.round(((index + 1) / frames) * 100);
            setStatus(`Rendering ${index + 1} / ${frames} (${pct}%) · ${w}×${h}`, framePct);
            await nextPaint();
          } else {
            setProgress(framePct);
          }
        },
      });

      setStatus(`Finalizing ${formatLabel}…`, 94);
      const result = await pipeline.finish();
      const filename = `gmc_2d_${currentSeed}_${duration}s_${fps}fps_${width}x${height}.${result.ext}`;
      download(result.blob, filename);
      setStatus(`Saved ${result.label} · ${duration}s · ${fps} fps · ${width}×${height} · ${quality}`, 100);
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
      setEncodingActive(false);
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
