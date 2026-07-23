/** Embed-code export for the 2D generator (live iframe player). */
(function () {
  const button = document.getElementById('btn-embed');
  const modal = document.getElementById('embed-modal');
  const hostInput = document.getElementById('embed-host');
  const widthInput = document.getElementById('embed-display-w');
  const heightInput = document.getElementById('embed-display-h');
  const status = document.getElementById('embed-status');
  const textArea = document.getElementById('embed-text');
  const copyBtn = document.getElementById('embed-copy');
  const regenBtn = document.getElementById('embed-regenerate');
  const closeBtn = document.getElementById('embed-close');
  if (!button || !modal || !textArea) return;

  const HOST_KEY = 'gmc-2d-embed-host';
  const SIZE_KEY = 'gmc-2d-embed-size';

  function setStatus(message) {
    if (status) status.textContent = message || '';
  }

  function evenDimension(value) {
    return Math.max(2, Math.floor(value / 2) * 2);
  }

  function encodeConfig(state) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
  }

  function detectHostUrl() {
    try {
      const { protocol, origin } = location;
      if (protocol === 'http:' || protocol === 'https:') {
        if (!/^(localhost|127\.0\.0\.1)$/i.test(location.hostname)) return origin;
      }
    } catch (_) {}
    try {
      return localStorage.getItem(HOST_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  function rememberHost(url) {
    const clean = String(url || '').replace(/\/+$/, '');
    if (!clean) return;
    try {
      localStorage.setItem(HOST_KEY, clean);
    } catch (_) {}
  }

  function readDisplaySize() {
    const w = evenDimension(Math.max(200, Math.min(2400, Number(widthInput?.value) || 800)));
    const h = evenDimension(Math.max(200, Math.min(2400, Number(heightInput?.value) || w)));
    if (widthInput) widthInput.value = String(w);
    if (heightInput) heightInput.value = String(h);
    try {
      localStorage.setItem(SIZE_KEY, JSON.stringify({ w, h }));
    } catch (_) {}
    return { w, h };
  }

  function restoreUi() {
    if (hostInput && !hostInput.value) hostInput.value = detectHostUrl();
    try {
      const raw = localStorage.getItem(SIZE_KEY);
      if (raw) {
        const { w, h } = JSON.parse(raw);
        if (widthInput && w) widthInput.value = String(w);
        if (heightInput && h) heightInput.value = String(h);
      } else if (typeof canvas !== 'undefined' && canvas?.width) {
        const side = Math.min(900, evenDimension(canvas.width));
        if (widthInput) widthInput.value = String(side);
        if (heightInput) heightInput.value = String(side);
      }
    } catch (_) {}
  }

  function buildPlayerUrl(host, payload) {
    const base = String(host || '').replace(/\/+$/, '');
    return `${base}/gmc-generator.html?embed=1&c=${encodeURIComponent(payload)}`;
  }

  function buildIframeEmbed(payload, host, w, h) {
    const src = buildPlayerUrl(host, payload);
    const ratio = ((h / w) * 100).toFixed(4);
    return `<!-- GMC Generator · live 2D · ${w}×${h} -->
<!-- Player loads from ${host} -->
<div class="gmc-2d-embed" style="width:100%;max-width:${w}px;margin:0 auto;position:relative;line-height:0;background:transparent">
  <div style="width:100%;padding-top:${ratio}%;pointer-events:none" aria-hidden="true"></div>
  <iframe
    src="${src}"
    title="GMC Generator"
    width="${w}"
    height="${h}"
    style="position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:transparent"
    allow="autoplay"
  ></iframe>
</div>`;
  }

  function generate() {
    if (typeof captureState !== 'function') {
      setStatus('Generator state is unavailable.');
      return;
    }
    const host = String(hostInput?.value || detectHostUrl() || '').trim().replace(/\/+$/, '');
    if (hostInput) hostInput.value = host;
    if (!host) {
      setStatus('Set a player base URL (your hosted app origin, e.g. https://gmc-app-theta.vercel.app).');
      textArea.value = '';
      return;
    }
    if (!/^https?:\/\//i.test(host)) {
      setStatus('Player base URL must start with http:// or https://.');
      textArea.value = '';
      return;
    }

    rememberHost(host);
    const { w, h } = readDisplaySize();
    const payload = encodeConfig(captureState());
    textArea.value = buildIframeEmbed(payload, host, w, h);
    setStatus(`Ready · ${w}×${h} · paste into an HTML embed`);
  }

  function openModal() {
    restoreUi();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    generate();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  button.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  regenBtn?.addEventListener('click', generate);
  hostInput?.addEventListener('change', () => {
    rememberHost(hostInput.value);
    generate();
  });
  widthInput?.addEventListener('change', generate);
  heightInput?.addEventListener('change', generate);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  copyBtn?.addEventListener('click', () => {
    if (!textArea.value) return;
    textArea.select();
    navigator.clipboard.writeText(textArea.value).catch(() => document.execCommand('copy'));
    const prev = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = prev;
    }, 1500);
  });

  restoreUi();
})();
