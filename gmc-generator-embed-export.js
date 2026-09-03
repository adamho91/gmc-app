/** Embed-code export for the 2D generator — live iframe or lite inline animation. */
(function () {
  const button = document.getElementById('btn-embed');
  const modal = document.getElementById('embed-modal');
  const hostInput = document.getElementById('embed-host');
  const hostField = document.getElementById('embed-host-field');
  const sizeRow = document.getElementById('embed-size-row');
  const fullscreenInput = document.getElementById('embed-fullscreen');
  const flowInInput = document.getElementById('embed-flow-in');
  const randomSeedInput = document.getElementById('embed-random-seed');
  const randomField = document.getElementById('embed-random-field');
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
  const FULL_KEY = 'gmc-2d-embed-fullscreen';
  const FLOW_KEY = 'gmc-2d-embed-flow-in';
  const RANDOM_KEY = 'gmc-2d-embed-random-seed';

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

  function isFullscreen() {
    return !!fullscreenInput?.checked;
  }

  function isFlowIn() {
    return !!flowInInput?.checked;
  }

  function isRandomOnLoad() {
    return !!randomSeedInput?.checked;
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
    const full = isFullscreen();
    if (hostField) hostField.hidden = mode !== 'live';
    if (sizeRow) sizeRow.hidden = full;
    if (randomField) randomField.hidden = mode !== 'lite';
    try {
      localStorage.setItem(MODE_KEY, mode);
      localStorage.setItem(FULL_KEY, full ? '1' : '0');
      localStorage.setItem(FLOW_KEY, isFlowIn() ? '1' : '0');
      localStorage.setItem(RANDOM_KEY, isRandomOnLoad() ? '1' : '0');
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
      if (fullscreenInput) fullscreenInput.checked = localStorage.getItem(FULL_KEY) === '1';
    } catch (_) {}
    try {
      if (flowInInput) flowInInput.checked = localStorage.getItem(FLOW_KEY) === '1';
    } catch (_) {}
    try {
      if (randomSeedInput) randomSeedInput.checked = localStorage.getItem(RANDOM_KEY) === '1';
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

  function buildPlayerUrl(host, payload, fullscreen, flowIn) {
    const base = String(host || '').replace(/\/+$/, '');
    const fill = fullscreen ? '&fill=1' : '';
    const flow = flowIn ? '&flow=1' : '';
    return `${base}/gmc-generator.html?embed=1${fill}${flow}&c=${encodeURIComponent(payload)}`;
  }

  function buildIframeEmbed(payload, host, w, h, fullscreen, flowIn) {
    const src = buildPlayerUrl(host, payload, fullscreen, flowIn);
    if (fullscreen) {
      return `<!-- GMC Generator · live 2D · full browser screen${flowIn ? ' · flow-in' : ''} -->
<!-- Player loads from ${host} -->
<div class="gmc-2d-embed gmc-2d-embed--fullscreen" style="position:fixed;inset:0;width:100%;height:100%;margin:0;line-height:0;background:transparent;z-index:0;pointer-events:none" aria-hidden="true">
  <iframe
    src="${src}"
    title="GMC Generator"
    style="position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:transparent;pointer-events:none"
    allow="autoplay"
    tabindex="-1"
  ></iframe>
</div>`;
    }
    const ratio = ((h / w) * 100).toFixed(4);
    return `<!-- GMC Generator · live 2D · ${w}×${h}${flowIn ? ' · flow-in' : ''} -->
<!-- Player loads from ${host} -->
<div class="gmc-2d-embed" style="width:100%;max-width:${w}px;margin:0 auto;position:relative;line-height:0;background:transparent;aspect-ratio:${w} / ${h}">
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
    let bgA = '#FFFFFF';
    let bgB = '#E5ECE7';
    if (style === 'dark') {
      bgA = '#403700';
      bgB = '#000000';
    } else if (style === 'color' && typeof PALETTES !== 'undefined' && PALETTES[state.palette]) {
      bgA = PALETTES[state.palette].bgA || bgA;
      bgB = PALETTES[state.palette].bgB || bgB;
    }

    let families = [
      ['#d5b8ff', '#c49eff', '#b384ff', '#9a64f2', '#793ed9', '#5718C0'],
      ['#c5e9ff', '#9cd4ff', '#73bffe', '#4fa4fc', '#3081f7', '#0b5fff'],
      ['#e5ece7', '#c7ecf1', '#a8edfa', '#99e1ee', '#98c8cd', '#6a9a9f'],
      ['#f1ffd2', '#d6ff7e', '#bbff2a', '#8ad904', '#458c0b', '#2d5c08'],
      ['#d9d7cc', '#e8e77a', '#f7f729', '#d9d700', '#8c8700', '#5c5a00'],
      ['#ffc4db', '#fba8d1', '#f78cc8', '#f366aa', '#f03679', '#c01050'],
    ];
    let allFamilies = families.map((fam) => fam.slice());
    try {
      if (typeof FAL_COLUMNS !== 'undefined' && typeof falTonalRamp === 'function') {
        allFamilies = FAL_COLUMNS.map((col) => falTonalRamp(col).slice());
      }
      if (typeof PALETTES !== 'undefined' && state.palette && PALETTES[state.palette]?.families) {
        families = PALETTES[state.palette].families.map((fam) => fam.slice());
        if (state.palette === 'fal_random' || !allFamilies.length) {
          allFamilies = families.map((fam) => fam.slice());
        }
      } else if (allFamilies.length) {
        families = allFamilies.slice(0, 6).map((fam) => fam.slice());
      }
    } catch (_) {}

    return { bgA, bgB, families, allFamilies };
  }

  function bool(state, key, fallback) {
    if (state[key] === undefined) return fallback;
    return !!state[key];
  }

  /** Self-contained canvas — checker + dots + meta animation (no iframe / full app). */
  function buildLiteAnimationEmbed(state, w, h, fullscreen, flowIn, randomOnLoad) {
    const seed = Number(state.seed) || 1;
    const cols = Math.max(4, Math.round(num(state, 'cols', 35)));
    const rows = Math.max(4, Math.round(num(state, 'rows', Math.round(cols * (h / w)))));
    const { bgA, bgB, families, allFamilies } = resolveLitePalette(state);
    const ratio = ((h / w) * 100).toFixed(4);
    const uid = `gmc-lite-${seed.toString(36)}-${Math.abs((w * 1000 + h) | 0).toString(36)}`;

    const cfg = {
      seed,
      w,
      h,
      cols,
      rows,
      fullscreen: !!fullscreen,
      flowIn: !!flowIn,
      randomOnLoad: !!randomOnLoad,
      bgA,
      bgB,
      families,
      allFamilies: allFamilies && allFamilies.length ? allFamilies : families,
      checkerGrid: bool(state, 'checkerGrid', true),
      checkerVar: num(state, 'checkerVar', 0),
      blobCount: Math.max(0, Math.round(num(state, 'blobCount', 10))),
      rMin: num(state, 'rMin', 0.05),
      rMax: num(state, 'rMax', 0.4),
      blobShape: num(state, 'blobShape', 1.7),
      softness: num(state, 'softness', 2.6),
      megaCount: Math.max(0, Math.round(num(state, 'megaCount', 3))),
      megaScale: num(state, 'megaScale', 0.55),
      megaLobes: Math.max(1, Math.round(num(state, 'megaLobes', 3))),
      lobeScatter: num(state, 'lobeScatter', 0.37),
      megaShape: num(state, 'megaShape', 1.4),
      cVar: num(state, 'cVar', 0.14),
      dotMax: num(state, 'dotMax', 0.58),
      dotMin: num(state, 'dotMin', 0.28),
      dotOsc: bool(state, 'dotOsc', true),
      dotOscSpeed: num(state, 'dotOscSpeed', 0.2),
      dotOscAmt: num(state, 'dotOscAmt', 0.2),
      dotOscWave: num(state, 'dotOscWave', 7.1),
      warpType: state.warpType || 'bulge',
      warpStr: num(state, 'warpStr', 0),
      warpCX: num(state, 'warpCX', 0.29),
      warpCY: num(state, 'warpCY', 0.15),
      warpSize: num(state, 'warpSize', 1),
      compBulge: num(state, 'compBulge', 1),
      warpOsc: bool(state, 'warpOsc', false),
      warpOscSpeed: num(state, 'warpOscSpeed', 0.17),
      warpOscAmt: num(state, 'warpOscAmt', 0.4),
      warpOscWave: num(state, 'warpOscWave', 2.5),
      metaMode: state.metaMode || 'over',
      chains: Math.max(0, Math.round(num(state, 'metaChains', 1))),
      nodes: Math.max(1, Math.round(num(state, 'metaNodes', 3))),
      size: num(state, 'metaSize', 0.045),
      sVar: num(state, 'metaSVar', 0.6),
      step: num(state, 'metaStep', 0.105),
      ring: num(state, 'metaRing', 0.62),
      opacity: num(state, 'metaOpacity', 1),
      drift: num(state, 'metaDrift', 0.06),
      pulse: num(state, 'metaPulse', 0.44),
      flow: num(state, 'metaFlow', 0.3),
      metaColor: state.metaColor || 'random',
      metaStroke: state.metaStroke || 'family_random',
      ovCount: Math.max(0, Math.round(num(state, 'ovCount', 0))),
      ovSize: num(state, 'ovSize', 0.35),
      ovOpacity: num(state, 'ovOpacity', 0.45),
      ovSoft: num(state, 'ovSoft', 2),
    };

    const cfgJson = JSON.stringify(cfg);
    const sizeLabel = fullscreen ? 'full browser screen' : `${w}×${h}`;
    const flowLabel = flowIn ? ' · flow-in' : '';
    const randomLabel = randomOnLoad ? ' · randomize' : '';
    const wrapStyle = fullscreen
      ? 'position:fixed;inset:0;width:100%;height:100%;margin:0;line-height:0;background:transparent;z-index:0;pointer-events:none;overflow:hidden'
      : `width:100%;max-width:${w}px;margin:0 auto;position:relative;line-height:0;background:transparent;aspect-ratio:${w} / ${h}`;
    const canvasStyle = fullscreen
      ? 'display:block;background:transparent;pointer-events:none;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:none;max-height:none'
      : 'position:absolute;inset:0;width:100%;height:100%;display:block;background:transparent;object-fit:contain';
    const aspectPad = fullscreen
      ? ''
      : `\n  <div style="width:100%;padding-top:${ratio}%;pointer-events:none" aria-hidden="true"></div>`;

    return `<!-- GMC · lite field + animation · ${sizeLabel}${flowLabel}${randomLabel} · self-contained -->
<div class="gmc-lite${fullscreen ? ' gmc-lite--fullscreen' : ''}" style="${wrapStyle}"${fullscreen ? ' aria-hidden="true"' : ''}>${aspectPad}
  <canvas id="${uid}" width="${w}" height="${h}" style="${canvasStyle}"></canvas>
</div>
<script>
(function(){
  var C=${cfgJson};
  var canvas=document.getElementById("${uid}");
  if(!canvas)return;
  var ctx=canvas.getContext("2d");
  if(C.randomOnLoad){
    C.seed=((Math.random()*0xFFFFFF)|0)||1;
    var pool=(C.allFamilies&&C.allFamilies.length?C.allFamilies:C.families).slice();
    for(var pi=pool.length-1;pi>0;pi--){
      var pj=(Math.random()*(pi+1))|0;
      var ptmp=pool[pi];pool[pi]=pool[pj];pool[pj]=ptmp;
    }
    C.families=pool.slice(0,Math.min(6,pool.length));
  }
  var W=C.w,H=C.h,COLS=C.cols,ROWS=C.rows,CS=W/COLS,t0=performance.now();
  var designAspect=(C.w>0&&C.h>0)?(C.w/C.h):1;
  var designCols=COLS;
  var designRows=Math.max(4,ROWS);

  function viewportSize(){
    var vv=window.visualViewport;
    var cssW=Math.max(1,Math.floor((vv&&vv.width)||document.documentElement.clientWidth||window.innerWidth||1));
    var cssH=Math.max(1,Math.floor((vv&&vv.height)||document.documentElement.clientHeight||window.innerHeight||1));
    return{cssW:cssW,cssH:cssH};
  }

  function lockElSize(el,w,h){
    el.style.setProperty("width",w+"px","important");
    el.style.setProperty("height",h+"px","important");
    el.style.setProperty("max-width","none","important");
    el.style.setProperty("max-height","none","important");
    el.style.setProperty("min-width",w+"px","important");
    el.style.setProperty("min-height",h+"px","important");
    el.style.setProperty("object-fit","fill","important");
  }

  function fit(){
    var dpr=Math.min(2,window.devicePixelRatio||1);
    var cssW,cssH,cw,ch;
    if(C.fullscreen){
      var vp=viewportSize();
      /* Cover viewport with design aspect — never stretch portrait (keeps circles round). */
      if(vp.cssW/Math.max(1,vp.cssH)>designAspect){
        cssW=vp.cssW;
        cssH=Math.max(1,Math.floor(vp.cssW/designAspect));
      }else{
        cssH=vp.cssH;
        cssW=Math.max(1,Math.floor(vp.cssH*designAspect));
      }
      cw=Math.max(2,Math.floor(cssW*dpr/2)*2);
      ch=Math.max(2,Math.floor(cssH*dpr/2)*2);
      /* Keep original grid density (same spaciness as desktop), just scale pixels. */
      COLS=designCols;
      ROWS=designRows;
      CS=cw/COLS;
      lockElSize(canvas,cssW,cssH);
      canvas.style.setProperty("left","50%","important");
      canvas.style.setProperty("top","50%","important");
      canvas.style.setProperty("right","auto","important");
      canvas.style.setProperty("bottom","auto","important");
      canvas.style.setProperty("transform","translate(-50%,-50%)","important");
      canvas.style.setProperty("position","absolute","important");
    }else{
      var parent=canvas.parentElement;
      var rect=parent?parent.getBoundingClientRect():null;
      var boxW=Math.max(1,Math.floor((rect&&rect.width)||C.w));
      var boxH=Math.max(1,Math.floor((rect&&rect.height)||C.h));
      var boxAspect=boxW/Math.max(1,boxH);
      if(boxAspect>designAspect){cssH=boxH;cssW=Math.max(1,Math.floor(boxH*designAspect));}
      else{cssW=boxW;cssH=Math.max(1,Math.floor(boxW/Math.max(0.0001,designAspect)));}
      cw=Math.max(2,Math.floor(cssW*dpr/2)*2);
      ch=Math.max(2,Math.floor(cssH*dpr/2)*2);
      COLS=designCols;
      ROWS=designRows;
      CS=cw/COLS;
      lockElSize(canvas,cssW,cssH);
      canvas.style.setProperty("left",((boxW-cssW)/2)+"px","important");
      canvas.style.setProperty("top",((boxH-cssH)/2)+"px","important");
      canvas.style.setProperty("right","auto","important");
      canvas.style.setProperty("bottom","auto","important");
      canvas.style.setProperty("transform","none","important");
      canvas.style.setProperty("position","absolute","important");
    }
    if(cw===canvas.width&&ch===canvas.height&&W===cw&&H===ch)return;
    canvas.width=cw;canvas.height=ch;
    W=cw;H=ch;
  }
  fit();
  window.addEventListener("resize",fit);
  window.addEventListener("orientationchange",function(){setTimeout(fit,50);});
  if(window.visualViewport){
    window.visualViewport.addEventListener("resize",fit);
    window.visualViewport.addEventListener("scroll",fit);
  }
  if(typeof ResizeObserver!=="undefined"&&canvas.parentElement){
    try{new ResizeObserver(fit).observe(canvas.parentElement);}catch(_){}
  }

  function xorshift(seed){
    var s=seed>>>0||1;
    return function(){s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};
  }
  function hexRgb(h){
    h=String(h).replace("#","");
    if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var v=parseInt(h,16);
    return [(v>>16)&255,(v>>8)&255,v&255];
  }
  function lerpHex(a,b,t){
    var A=hexRgb(a),B=hexRgb(b);
    var r=Math.round(A[0]+(B[0]-A[0])*t),g=Math.round(A[1]+(B[1]-A[1])*t),bl=Math.round(A[2]+(B[2]-A[2])*t);
    return "#"+((1<<24)+(r<<16)+(g<<8)+bl).toString(16).slice(1);
  }
  function inflColor(infl,fam){
    var p=(1-infl)*(fam.length-1),lo=Math.floor(p),hi=Math.min(fam.length-1,lo+1);
    return lerpHex(fam[hi],fam[lo],p-lo);
  }
  function strokeFor(fam,ch,ri){
    var m=C.metaStroke;
    if(m==="ends")return fam[[0,4,3][ch%3]]||fam[0];
    if(m==="deep")return fam[0];
    if(m==="black")return"#000";
    if(m==="family_random")return fam[ri(0,fam.length-1)];
    if(m==="mix_deep"){var o=[0,3,4].filter(function(i){return i<fam.length;});return fam[o[ri(0,o.length-1)]];}
    return fam[Math.min(3,fam.length-1)];
  }

  /* Fast staggered clump reveal — checker first, then dots by blob clumps. */
  var FLOW_DUR=0.78,FLOW_CLUMP=5,FLOW_RISE=0.22;
  function clumpHash(cx,cy){
    var h=((cx*73856093)^(cy*19349663)^(C.seed*83492791))>>>0;
    return (h%10000)/10000;
  }
  function flowAppear(col,row,bias,tNow){
    if(!C.flowIn)return 1;
    var cx=Math.floor(col/FLOW_CLUMP),cy=Math.floor(row/FLOW_CLUMP);
    var n=clumpHash(cx,cy);
    var lx=col-cx*FLOW_CLUMP,ly=row-cy*FLOW_CLUMP;
    var local=((lx+ly*0.65)/(FLOW_CLUMP*1.65))*0.07;
    var start=(n*0.52+local+(bias||0))*FLOW_DUR;
    var t=((tNow||0)-start)/FLOW_RISE;
    if(t<=0)return 0;
    if(t>=1)return 1;
    return 1-Math.pow(1-t,3);
  }

  function frame(now){
    requestAnimationFrame(frame);
    var time=(now-t0)/1000;
    var rand=xorshift(C.seed);
    function rr(a,b){return a+rand()*(b-a);}
    function ri(a,b){return Math.floor(rr(a,b+0.9999));}

    var warpOscOn=C.warpOsc&&C.warpOscAmt>0;
    var warpPhase=warpOscOn?time*C.warpOscSpeed*2.5:0;
    var breathe=warpOscOn?Math.sin(warpPhase)*C.warpOscAmt:0;
    var clamp01=function(v){return Math.max(0,Math.min(1,v));};
    var effStr=clamp01(C.warpStr*(1+breathe*0.85));
    var effSize=clamp01(C.warpSize*(1+breathe*0.65));
    var effBulge=C.compBulge+breathe*0.35;
    var effCX=clamp01(C.warpCX+(warpOscOn?Math.sin(warpPhase*0.7)*C.warpOscAmt*0.06:0));
    var effCY=clamp01(C.warpCY+(warpOscOn?Math.cos(warpPhase*0.9)*C.warpOscAmt*0.06:0));

    function compWarp(nx,ny){
      if(!effBulge)return{px:nx*W,py:ny*H};
      var dx=nx-effCX,dy=ny-effCY,dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<1e-4)return{px:nx*W,py:ny*H};
      var maxDist=Math.sqrt(effCX*effCX+effCY*effCY)*1.2+0.01;
      var t=dist/maxDist,r2;
      if(effBulge>0)r2=dist*(1+effBulge*t*t*2.2);
      else{r2=dist*(1+effBulge*t*1.8);r2=Math.max(0,r2);}
      var s=r2/dist;
      return{px:(effCX+dx*s)*W,py:(effCY+dy*s)*H};
    }
    function warpAt(nx,ny){
      if(C.warpType==="none"||(effStr<=0&&effSize<=0))return{sx:1,sy:1,ang:0,sz:1};
      var dx=nx-effCX,dy=ny-effCY,dist=Math.sqrt(dx*dx+dy*dy),ang=Math.atan2(dy,dx);
      var sx=1,sy=1,dotAng=0,sz=1;
      if(C.warpType==="bulge"){
        var f=Math.exp(-dist*dist*2.5);
        sx=1+effStr*f*3.5;sy=Math.max(0.05,1-effStr*f*1.2);dotAng=ang;sz=1+effSize*f*3;
      }
      if(warpOscOn&&C.warpOscWave>0){
        var rdx=nx-0.5,rdy=ny-0.5,rd=Math.sqrt(rdx*rdx+rdy*rdy);
        var rip=1+Math.sin(warpPhase-rd*C.warpOscWave*Math.PI*2)*C.warpOscAmt*0.35;
        sx*=rip;sy*=rip;sz*=rip;
      }
      return{sx:Math.max(0.1,sx),sy:Math.max(0.1,sy),ang:dotAng,sz:Math.max(0.1,sz)};
    }
    function influence(b,nx,ny){
      var dx=nx-b.cx,dy=ny-b.cy,cos=Math.cos(b.angle),sin=Math.sin(b.angle);
      var lx=(dx*cos+dy*sin)/(b.r*b.stretch),ly=(-dx*sin+dy*cos)/(b.r/b.stretch);
      var s=b.isMega?C.megaShape:C.blobShape;
      var d=Math.pow(Math.pow(Math.abs(lx),s*2)+Math.pow(Math.abs(ly),s*2),1/(s*2));
      return Math.max(0,1-Math.pow(d,C.softness));
    }

    /* --- blobs / mega / overlays / cell scales (same RNG order as main app) --- */
    var blobs=[];
    for(var i=0;i<C.blobCount;i++){
      var famIdx=(blobs.length===0||rand()<C.cVar)?ri(0,C.families.length-1):blobs[ri(0,blobs.length-1)].famIdx;
      blobs.push({cx:rr(0.04,0.96),cy:rr(0.04,0.96),r:rr(C.rMin,C.rMax),famIdx:famIdx,stretch:rr(0.75,1.35),angle:rr(0,Math.PI)});
    }
    var mega=[];
    for(var m=0;m<C.megaCount;m++){
      var ax=rr(0.1,0.9),ay=rr(0.1,0.9),mf=ri(0,C.families.length-1);
      for(var l=0;l<C.megaLobes;l++){
        var a=(l/C.megaLobes)*Math.PI*2+rr(-0.4,0.4),dist=rr(0,C.lobeScatter*C.megaScale*0.8);
        mega.push({cx:ax+Math.cos(a)*dist,cy:ay+Math.sin(a)*dist,r:C.megaScale*rr(0.55,1),famIdx:mf,stretch:rr(0.7,1.4),angle:rr(0,Math.PI),isMega:true});
      }
    }
    var units=blobs.concat(mega);
    var ovBlobs=[];
    for(var oi=0;oi<C.ovCount;oi++){
      var ofam=C.families[ri(0,C.families.length-1)];
      ovBlobs.push({
        cx:rr(0.05,0.95),cy:rr(0.05,0.95),
        r:rr(C.ovSize*0.5,C.ovSize*1.3),
        stretch:rr(0.6,1.6),angle:rr(0,Math.PI),
        color:ofam[ri(1,Math.max(1,ofam.length-2))]
      });
    }
    var cellScale=[];
    for(var csr=0;csr<ROWS;csr++){
      for(var csc=0;csc<COLS;csc++){
        cellScale.push(C.checkerVar>0?Math.max(0.15,rr(1-C.checkerVar*0.7,1+C.checkerVar*0.7)):1);
      }
    }

    ctx.clearRect(0,0,W,H);
    ctx.globalCompositeOperation="source-over";
    ctx.globalAlpha=1;
    ctx.fillStyle=C.bgA;
    ctx.fillRect(0,0,W,H);

    if(C.checkerGrid){
      for(var row=0;row<ROWS;row++){
        for(var col=0;col<COLS;col++){
          var appear=flowAppear(col,row,0,time);
          if(appear<=0.01)continue;
          var sc=cellScale[row*COLS+col];
          var fill=(row+col)%2===0?C.bgA:C.bgB;
          var nx=(col+0.5)/COLS,ny=(row+0.5)/ROWS,p=compWarp(nx,ny);
          var cw=CS*sc*appear,ch=CS*sc*appear;
          ctx.fillStyle=fill;
          ctx.fillRect(p.px-cw/2,p.py-ch/2,cw,ch);
        }
      }
    }

    if(C.metaMode!=="replace"){
      var unitCount=Math.max(1,units.length);
      for(var u=0;u<units.length;u++){
        var unit=units[u],family=C.families[unit.famIdx];
        var unitBias=0.1+(u/unitCount)*0.38;
        var pad=unit.r*Math.max(unit.stretch,1/unit.stretch)*1.6;
        var c0=Math.max(0,Math.floor((unit.cx-pad)*COLS));
        var c1=Math.min(COLS-1,Math.ceil((unit.cx+pad)*COLS));
        var r0=Math.max(0,Math.floor((unit.cy-pad)*ROWS));
        var r1=Math.min(ROWS-1,Math.ceil((unit.cy+pad)*ROWS));
        for(var row2=r0;row2<=r1;row2++){
          for(var col2=c0;col2<=c1;col2++){
            var nx2=(col2+0.5)/COLS,ny2=(row2+0.5)/ROWS;
            var infl=influence(unit,nx2,ny2);
            if(infl<0.006)continue;
            var appearD=flowAppear(col2,row2,unitBias,time);
            if(appearD<=0.02)continue;
            var baseR=CS*0.5*(C.dotMin+(C.dotMax-C.dotMin)*infl);
            if(C.dotOsc&&C.dotOscAmt>0){
              var rdx=nx2-0.5,rdy=ny2-0.5,rdist=Math.sqrt(rdx*rdx+rdy*rdy);
              var osc=1+Math.sin(time*C.dotOscSpeed*2.5-rdist*C.dotOscWave*Math.PI*2)*C.dotOscAmt;
              baseR*=Math.max(0,osc);
            }
            baseR*=appearD;
            if(baseR<0.4)continue;
            var fill2=inflColor(infl,family);
            var pw=compWarp(nx2,ny2),wv=warpAt(nx2,ny2);
            var rx=baseR*wv.sz*wv.sx,ry=baseR*wv.sz*wv.sy;
            ctx.save();
            ctx.translate(pw.px,pw.py);
            if(wv.ang)ctx.rotate(wv.ang);
            ctx.beginPath();
            ctx.ellipse(0,0,Math.max(0.3,rx),Math.max(0.3,ry),0,0,Math.PI*2);
            ctx.fillStyle=fill2;
            ctx.fill();
            ctx.restore();
          }
        }
      }
    }

    if(ovBlobs.length){
      var ovAppear=C.flowIn?Math.max(0,Math.min(1,(time-FLOW_DUR*0.35)/0.3)):1;
      ovAppear=ovAppear<=0?0:(ovAppear>=1?1:1-Math.pow(1-ovAppear,3));
      if(ovAppear>0.01){
        ctx.globalCompositeOperation="multiply";
        for(var obi=0;obi<ovBlobs.length;obi++){
          var ob=ovBlobs[obi];
          var orx=ob.r*ob.stretch*W*ovAppear;
          var ory=(ob.r/ob.stretch)*H*ovAppear;
          var ocx=ob.cx*W,ocy=ob.cy*H;
          var rgb=hexRgb(ob.color);
          var nSoft=C.ovSoft||2;
          ctx.save();
          ctx.translate(ocx,ocy);
          ctx.rotate(ob.angle);
          ctx.beginPath();
          for(var si=0;si<=120;si++){
            var st=(si/120)*Math.PI*2,ct=Math.cos(st),ss=Math.sin(st);
            var sx=Math.sign(ct)*Math.pow(Math.abs(ct),2/nSoft)*orx;
            var sy=Math.sign(ss)*Math.pow(Math.abs(ss),2/nSoft)*ory;
            if(si===0)ctx.moveTo(sx,sy);else ctx.lineTo(sx,sy);
          }
          ctx.closePath();
          ctx.fillStyle="rgba("+rgb[0]+","+rgb[1]+","+rgb[2]+","+C.ovOpacity+")";
          ctx.fill();
          ctx.restore();
        }
        ctx.globalCompositeOperation="source-over";
      }
    }

    if(C.metaMode!=="off"&&C.chains>0){
      var crand=xorshift(C.seed^0xDEAD);
      function crr(a,b){return a+crand()*(b-a);}
      function cri(a,b){return Math.floor(crr(a,b+0.9999));}
      var metaAppear=C.flowIn?Math.max(0,Math.min(1,(time-FLOW_DUR*0.55)/0.28)):1;
      metaAppear=metaAppear<=0?0:(metaAppear>=1?1:1-Math.pow(1-metaAppear,3));
      if(metaAppear>0.01){
      ctx.globalAlpha=C.opacity;
      for(var ch=0;ch<C.chains;ch++){
        var fam;
        if(C.metaColor==="single")fam=C.families[0];
        else if(C.metaColor==="random")fam=C.families[cri(0,C.families.length-1)];
        else fam=C.families[ch%C.families.length];
        var fillN=C.metaColor==="random"?fam[cri(0,Math.min(2,fam.length-1))]:fam[Math.min(1,fam.length-1)];
        var stroke=strokeFor(fam,ch,cri);
        var x=crr(0.05,0.95)*W,y=crr(0.05,0.95)*H;
        var angle=crr(0,Math.PI*2)+time*C.flow*0.35;
        var stepPx=C.step*W;
        var maxR=Math.max(2,C.size*W*(1+C.sVar*0.8)*(C.pulse>0?1.16:1));
        var edge=maxR+(C.ring>0?maxR*0.14:0);
        for(var n=0;n<C.nodes;n++){
          var phase=crr(0,Math.PI*2);
          var r=C.size*W*(1+crr(-C.sVar*0.6,C.sVar*0.8));
          if(C.pulse>0)r*=1+Math.sin(time*C.pulse*2.2+phase)*0.16;
          r=Math.max(2,r)*metaAppear;
          var isRing=crand()<C.ring;
          var px=x,py=y;
          if(C.drift>0){
            var amp=stepPx*0.28*C.drift;
            px+=Math.sin(time*C.drift*1.3+phase)*amp;
            py+=Math.cos(time*C.drift*1.1+phase*1.7)*amp;
          }
          var npad=r+(isRing?Math.max(1,r*0.28)*0.5:0);
          px=Math.max(npad,Math.min(W-npad,px));
          py=Math.max(npad,Math.min(H-npad,py));
          ctx.beginPath();
          ctx.arc(px,py,r,0,Math.PI*2);
          if(isRing){
            var lw=Math.max(1,r*0.28);
            ctx.fillStyle=C.bgA;
            ctx.fill();
            ctx.lineWidth=lw;
            ctx.strokeStyle=stroke;
            ctx.stroke();
          }else{
            ctx.fillStyle=fillN;
            ctx.fill();
          }
          angle+=crr(-0.9,0.9);
          var distN=stepPx*crr(0.7,1.4);
          x+=Math.cos(angle)*distN;
          y+=Math.sin(angle)*distN;
          x=Math.max(edge,Math.min(W-edge,x));
          y=Math.max(edge,Math.min(H-edge,y));
        }
      }
      }
      ctx.globalAlpha=1;
    }
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
    const full = isFullscreen();
    const flow = isFlowIn() || !!document.getElementById('flowIn')?.checked;
    const randomize = mode === 'lite' && isRandomOnLoad();
    const { w, h } = readDisplaySize();
    const state = captureState();
    const flowNote = flow ? ' · flow-in' : '';
    const randomNote = randomize ? ' · randomize on refresh' : '';

    if (mode === 'lite') {
      textArea.value = buildLiteAnimationEmbed(state, w, h, full, flow, randomize);
      setStatus(full
        ? `Lite field + animation · full browser screen${flowNote}${randomNote} · self-contained (no host URL)`
        : `Lite field + animation · ${w}×${h}${flowNote}${randomNote} · self-contained (no host URL)`);
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
    textArea.value = buildIframeEmbed(payload, host, w, h, full, flow);
    setStatus(full
      ? `Live player · full browser screen${flowNote} · paste into an HTML embed`
      : `Live player · ${w}×${h}${flowNote} · paste into an HTML embed`);
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
  fullscreenInput?.addEventListener('change', () => {
    syncModeUi();
    generate();
  });
  flowInInput?.addEventListener('change', () => {
    syncModeUi();
    generate();
  });
  randomSeedInput?.addEventListener('change', () => {
    syncModeUi();
    generate();
  });
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
