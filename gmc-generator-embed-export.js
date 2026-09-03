/** Embed-code export for the 2D generator — live iframe or lite inline animation. */
(function () {
  const button = document.getElementById('btn-embed');
  const modal = document.getElementById('embed-modal');
  const hostInput = document.getElementById('embed-host');
  const hostField = document.getElementById('embed-host-field');
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
  const MODE_KEY = 'gmc-2d-embed-mode';

  function setStatus(message) {
    if (status) status.textContent = message || '';
  }

  function evenDimension(value) {
    return Math.max(2, Math.floor(value / 2) * 2);
  }

  function encodeConfig(state) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
  }

  function getEmbedMode() {
    return document.querySelector('input[name="embed-mode"]:checked')?.value || 'lite';
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

  function syncModeUi() {
    const mode = getEmbedMode();
    if (hostField) hostField.hidden = mode !== 'live';
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch (_) {}
  }

  function restoreUi() {
    if (hostInput && !hostInput.value) hostInput.value = detectHostUrl();
    try {
      const mode = localStorage.getItem(MODE_KEY);
      if (mode) {
        const radio = document.querySelector(`input[name="embed-mode"][value="${mode}"]`);
        if (radio) radio.checked = true;
      }
    } catch (_) {}
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
    syncModeUi();
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

  function num(state, key, fallback) {
    const v = Number(state[key]);
    return Number.isFinite(v) ? v : fallback;
  }

  function resolveLitePalette(state) {
    const style = state.checkerStyle || 'light';
    let bg = '#ffffff';
    if (style === 'dark') bg = '#000000';
    else if (style === 'light') bg = '#ffffff';
    else if (typeof PALETTES !== 'undefined' && PALETTES[state.palette]?.bgA) {
      bg = PALETTES[state.palette].bgA;
    }

    let families = [
      ['#D5B8FF', '#AB77FF', '#5718C0', '#5718C0', '#AB77FF'],
      ['#C5E9FF', '#5FB5FE', '#115EF3', '#115EF3', '#5FB5FE'],
      ['#E5ECE7', '#99EDFF', '#98AFAC', '#98AFAC', '#99EDFF'],
      ['#F1FFD2', '#ADFF00', '#004012', '#004012', '#ADFF00'],
      ['#D9D7CC', '#FFFF00', '#403700', '#403700', '#FFFF00'],
      ['#FFC4DB', '#F57EC3', '#EC0648', '#EC0648', '#F57EC3'],
    ];
    try {
      if (typeof PALETTES !== 'undefined' && state.palette && PALETTES[state.palette]?.families) {
        families = PALETTES[state.palette].families.map((fam) => fam.slice(0, 5));
      } else if (typeof FAL_COLUMNS !== 'undefined' && typeof falTonalRamp === 'function') {
        families = FAL_COLUMNS.map((col) => falTonalRamp(col).slice(0, 5));
      }
    } catch (_) {}

    return { bg, families };
  }

  /** Self-contained canvas snippet — meta-node animation only (no iframe / full app). */
  function buildLiteAnimationEmbed(state, w, h) {
    const seed = Number(state.seed) || 1;
    const chains = Math.max(1, Math.round(num(state, 'metaChains', 1)));
    const nodes = Math.max(2, Math.round(num(state, 'metaNodes', 3)));
    const size = num(state, 'metaSize', 0.045);
    const sVar = num(state, 'metaSVar', 0.6);
    const step = num(state, 'metaStep', 0.105);
    const ring = num(state, 'metaRing', 0.62);
    const opacity = num(state, 'metaOpacity', 1);
    const drift = num(state, 'metaDrift', 0.06);
    const pulse = num(state, 'metaPulse', 0.44);
    const flow = num(state, 'metaFlow', 0.3);
    const metaColor = state.metaColor || 'random';
    const metaStroke = state.metaStroke || 'family_random';
    const { bg, families } = resolveLitePalette(state);
    const ratio = ((h / w) * 100).toFixed(4);

    const cfg = {
      seed,
      w,
      h,
      bg,
      families,
      chains,
      nodes,
      size,
      sVar,
      step,
      ring,
      opacity,
      drift,
      pulse,
      flow,
      metaColor,
      metaStroke,
    };

    const cfgJson = JSON.stringify(cfg);

    return `<!-- GMC · lite meta animation · ${w}×${h} · self-contained -->
<div class="gmc-lite" style="width:100%;max-width:${w}px;margin:0 auto;position:relative;line-height:0;background:transparent">
  <div style="width:100%;padding-top:${ratio}%;pointer-events:none" aria-hidden="true"></div>
  <canvas id="gmc-lite-c" width="${w}" height="${h}" style="position:absolute;inset:0;width:100%;height:100%;display:block;background:transparent"></canvas>
</div>
<script>
(function(){
  var C=${cfgJson};
  var canvas=document.getElementById("gmc-lite-c");
  if(!canvas)return;
  var ctx=canvas.getContext("2d");
  var W=C.w,H=C.h,t0=performance.now();

  function mulberry(seed){
    var s=seed>>>0||1;
    return function(){
      s^=s<<13;s^=s>>>17;s^=s<<5;
      return (s>>>0)/4294967296;
    };
  }

  function strokeFor(fam,ch,cri){
    var mode=C.metaStroke;
    if(mode==="ends")return fam[[0,4,3][ch%3]]||fam[0];
    if(mode==="deep")return fam[0];
    if(mode==="black")return"#000000";
    if(mode==="family_random")return fam[cri(0,fam.length-1)];
    if(mode==="mix_deep"){var opts=[0,3,4].filter(function(i){return i<fam.length;});return fam[opts[cri(0,opts.length-1)]];}
    return fam[Math.min(3,fam.length-1)];
  }

  function frame(now){
    requestAnimationFrame(frame);
    var time=(now-t0)/1000;
    var rand=mulberry(C.seed^0xDEAD);
    function rr(a,b){return a+rand()*(b-a);}
    function ri(a,b){return Math.floor(rr(a,b+0.9999));}

    ctx.clearRect(0,0,W,H);
    ctx.fillStyle=C.bg;
    ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=C.opacity;

    for(var ch=0;ch<C.chains;ch++){
      var fam;
      if(C.metaColor==="single")fam=C.families[0];
      else if(C.metaColor==="random")fam=C.families[ri(0,C.families.length-1)];
      else fam=C.families[ch%C.families.length];
      var fill=C.metaColor==="random"?fam[ri(0,Math.min(2,fam.length-1))]:fam[Math.min(1,fam.length-1)];
      var stroke=strokeFor(fam,ch,ri);
      var x=rr(0.05,0.95)*W;
      var y=rr(0.05,0.95)*H;
      var angle=rr(0,Math.PI*2)+time*C.flow*0.35;
      var stepPx=C.step*W;
      var maxR=Math.max(2,C.size*W*(1+C.sVar*0.8)*(C.pulse>0?1.16:1));
      var edge=maxR+(C.ring>0?maxR*0.14:0);

      for(var n=0;n<C.nodes;n++){
        var phase=rr(0,Math.PI*2);
        var r=C.size*W*(1+rr(-C.sVar*0.6,C.sVar*0.8));
        if(C.pulse>0)r*=1+Math.sin(time*C.pulse*2.2+phase)*0.16;
        r=Math.max(2,r);
        var isRing=rand()<C.ring;
        var px=x,py=y;
        if(C.drift>0){
          var amp=stepPx*0.28*C.drift;
          px+=Math.sin(time*C.drift*1.3+phase)*amp;
          py+=Math.cos(time*C.drift*1.1+phase*1.7)*amp;
        }
        var pad=r+(isRing?Math.max(1,r*0.28)*0.5:0);
        px=Math.max(pad,Math.min(W-pad,px));
        py=Math.max(pad,Math.min(H-pad,py));

        ctx.beginPath();
        ctx.arc(px,py,r,0,Math.PI*2);
        if(isRing){
          var lw=Math.max(1,r*0.28);
          ctx.fillStyle=C.bg;
          ctx.fill();
          ctx.lineWidth=lw;
          ctx.strokeStyle=stroke;
          ctx.stroke();
        }else{
          ctx.fillStyle=fill;
          ctx.fill();
        }

        angle+=rr(-0.9,0.9);
        var dist=stepPx*rr(0.7,1.4);
        x+=Math.cos(angle)*dist;
        y+=Math.sin(angle)*dist;
        x=Math.max(edge,Math.min(W-edge,x));
        y=Math.max(edge,Math.min(H-edge,y));
      }
    }
    ctx.globalAlpha=1;
  }
  requestAnimationFrame(frame);
})();
<\/script>`;
  }

  function generate() {
    if (typeof captureState !== 'function') {
      setStatus('Generator state is unavailable.');
      return;
    }
    const mode = getEmbedMode();
    const { w, h } = readDisplaySize();
    const state = captureState();

    if (mode === 'lite') {
      textArea.value = buildLiteAnimationEmbed(state, w, h);
      setStatus(`Lite animation · ${w}×${h} · self-contained (no host URL)`);
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
    const payload = encodeConfig(state);
    textArea.value = buildIframeEmbed(payload, host, w, h);
    setStatus(`Live player · ${w}×${h} · paste into an HTML embed`);
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
  document.querySelectorAll('input[name="embed-mode"]').forEach((el) => {
    el.addEventListener('change', () => {
      syncModeUi();
      generate();
    });
  });
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
