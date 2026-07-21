const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

// ── fal brand palette — guideline anchors + interpolated steps (piecewise deep→mid→light) ──
const FAL_ANCHORS = [
  ['#5718C0', '#AB77FF', '#D5B8FF'], // purple
  ['#115EF3', '#5FB5FE', '#C5E9FF'], // blue
  ['#98AFAC', '#99EDFF', '#E5ECE7'], // sage / turquoise / light sage
  ['#004012', '#ADFF00', '#F1FFD2'], // dark green / chartreuse / light green
  ['#403700', '#FFFF00', '#D9D7CC'], // brown / yellow / light brown
  ['#EC0648', '#F57EC3', '#FFC4DB'], // red / pink / light pink
];

function hexToRgb(h) {
  const s = h.replace('#', '');
  const v = parseInt(s.length === 3 ? s.split('').map((ch) => ch + ch).join('') : s, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function lerpHex(ca, cb, t) {
  const a = hexToRgb(ca), b = hexToRgb(cb);
  const r = Math.round(a[0] + t * (b[0] - a[0]));
  const g = Math.round(a[1] + t * (b[1] - a[1]));
  const bl = Math.round(a[2] + t * (b[2] - a[2]));
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

/** Six stops per hue: 3 guideline anchors + 3 lerped steps; order light→dark for halftone families. */
function expandFalColumn(deep, mid, light) {
  function along(t) {
    if (t <= 0.5) return lerpHex(deep, mid, t * 2);
    return lerpHex(mid, light, (t - 0.5) * 2);
  }
  const ts = [0, 0.2, 0.4, 0.6, 0.8, 1];
  const darkToLight = ts.map(along);
  return darkToLight.slice().reverse();
}

const FAL_COLUMNS = FAL_ANCHORS.map(([d, m, l]) => expandFalColumn(d, m, l));
const FAL_FLAT = [...new Set(FAL_COLUMNS.flat().concat(['#000000', '#FFFFFF']))];

/** Stroke color for DR node chains (fills stay white). */
function pickMetaStroke(metaStroke, fam, ch, metaColor, cri) {
  switch (metaStroke) {
    case 'ends':
      return fam[[0, 4, 3][ch % 3]];
    case 'deep':
      return fam[0];
    case 'mix_deep': {
      const opts = [0, 3, 4].filter((i) => i < fam.length);
      return fam[opts[cri(0, opts.length - 1)]];
    }
    case 'family_random':
      return fam[cri(0, fam.length - 1)];
    case 'all_swatches':
      return FAL_FLAT[cri(0, FAL_FLAT.length - 1)];
    case 'black':
      return '#000000';
    case 'legacy_mid':
      if (metaColor === 'single') return fam[3];
      if (metaColor === 'random') return fam[cri(2, 4)];
      return fam[3];
    default:
      return fam[0];
  }
}

/** Expanded columns pass through; legacy 3-stop anchors become a short 5-stop ramp. */
function falTonalRamp(col) {
  if (col.length > 3) return col.slice();
  const [deep, mid, light] = col;
  return [light, light, mid, deep, deep];
}

// ── Palettes ──────────────────────────────────────────────────────────────────
const PALETTES = {
  // Smooth per-hue ramps (tonal): each family stays in one brand column
  fal_tonal: {
    bgA: '#E5ECE7',
    bgB: '#004012',
    families: FAL_COLUMNS.map(falTonalRamp),
  },
  // High-contrast jumps: dark secondaries, accent purple, primaries, black/white
  fal_contrast: {
    bgA: '#FFFFFF',
    bgB: '#000000',
    families: [
      ['#000000', '#ADFF00', '#004012', '#F1FFD2', '#ADFF00'],
      ['#5718C0', '#FFFF00', '#403700', '#AB77FF', '#FFFFFF'],
      ['#115EF3', '#FFFFFF', '#EC0648', '#5FB5FE', '#000000'],
      ['#004012', '#99EDFF', '#98AFAC', '#F1FFD2', '#ADFF00'],
      ['#EC0648', '#FFFFFF', '#5718C0', '#FFC4DB', '#000000'],
      ['#403700', '#FFFF00', '#EC0648', '#D9D7CC', '#115EF3'],
    ],
  },
  fal_random: null,
};

function buildRandomPalette() {
  const cols = FAL_COLUMNS.map((c, i) => ({ c, i }));
  for (let i = cols.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cols[i], cols[j]] = [cols[j], cols[i]];
  }
  const families = cols.slice(0, 6).map(({ c }) => falTonalRamp(c));
  const bgPool = ['#115EF3', '#99EDFF', '#004012', '#403700', '#E5ECE7', '#D9D7CC', '#FFFFFF', '#000000'];
  let iA = ri(0, bgPool.length - 1);
  let iB = ri(0, bgPool.length - 1);
  let guard = 0;
  while (iB === iA && bgPool.length > 1 && guard++ < 16) iB = ri(0, bgPool.length - 1);
  return { bgA: bgPool[iA], bgB: bgPool[iB], families };
}

// ── RNG ───────────────────────────────────────────────────────────────────────
let rng = 1;
function seedRng(s) { rng = (s >>> 0) || 1; }
function rand() { rng ^= rng<<13; rng ^= rng>>17; rng ^= rng<<5; return (rng>>>0)/4294967296; }
function rr(a,b) { return a + rand()*(b-a); }
function ri(a,b) { return Math.floor(rr(a, b+0.9999)); }

// ── Color helpers ─────────────────────────────────────────────────────────────
const _cc = {};
const _tc = document.createElement('canvas');
_tc.width = _tc.height = 1;
const _tx = _tc.getContext('2d');
function parseColor(c) {
  if (_cc[c]) return _cc[c];
  _tx.clearRect(0,0,1,1); _tx.fillStyle = c; _tx.fillRect(0,0,1,1);
  const d = _tx.getImageData(0,0,1,1).data;
  return _cc[c] = [d[0],d[1],d[2]];
}
function lerpColor(ca, cb, t) {
  const a = parseColor(ca), b = parseColor(cb);
  return `rgb(${Math.round(a[0]+t*(b[0]-a[0]))},${Math.round(a[1]+t*(b[1]-a[1]))},${Math.round(a[2]+t*(b[2]-a[2]))})`;
}

// ── Main Draw ─────────────────────────────────────────────────────────────────
let currentSeed = Date.now() & 0xFFFFFF;
let animTime = 0;

function draw(newSeed) {
  if (newSeed !== undefined) currentSeed = newSeed;
  seedRng(currentSeed);

  // Read all controls
  const COLS       = parseInt(document.getElementById('cols').value);
  const CS         = parseInt(document.getElementById('cellSize').value);
  const ROWS       = COLS;
  const bCount     = parseInt(document.getElementById('blobCount').value);
  const rMin       = parseFloat(document.getElementById('rMin').value);
  const rMax       = parseFloat(document.getElementById('rMax').value);
  const shape      = parseFloat(document.getElementById('blobShape').value);
  const soft       = parseFloat(document.getElementById('softness').value);
  const mCount     = parseInt(document.getElementById('megaCount').value);
  const megaScale  = parseFloat(document.getElementById('megaScale').value);
  const megaLobes  = parseInt(document.getElementById('megaLobes').value);
  const lobeScatter= parseFloat(document.getElementById('lobeScatter').value);
  const megaShape  = parseFloat(document.getElementById('megaShape').value);
  const dotMax     = parseFloat(document.getElementById('dotMax').value);
  const dotMin     = parseFloat(document.getElementById('dotMin').value);
  const dotOsc     = document.getElementById('dotOsc').checked;
  const dotOscSpeed= parseFloat(document.getElementById('dotOscSpeed').value);
  const dotOscAmt  = parseFloat(document.getElementById('dotOscAmt').value);
  const dotOscWave = parseFloat(document.getElementById('dotOscWave').value);
  const ovCount    = parseInt(document.getElementById('ovCount').value);
  const ovSize     = parseFloat(document.getElementById('ovSize').value);
  const ovOpacity  = parseFloat(document.getElementById('ovOpacity').value);
  const ovSoft     = parseFloat(document.getElementById('ovSoft').value);
  const patType    = document.getElementById('patType').value;
  const patScale   = parseInt(document.getElementById('patScale').value);
  const patDensity = parseFloat(document.getElementById('patDensity').value);
  const patOpacity = parseFloat(document.getElementById('patOpacity').value);
  const patColorId = document.getElementById('patColor').value;
  const patBlend   = document.getElementById('patBlend').value;
  const cVar       = parseFloat(document.getElementById('cVar').value);
  const palName    = document.getElementById('palette').value;
  const checkerStyle = document.getElementById('checkerStyle').value;
  const checkerVar   = parseFloat(document.getElementById('checkerVar').value);
  const warpType     = document.getElementById('warpType').value;
  const warpStr      = parseFloat(document.getElementById('warpStr').value);
  const warpCX       = parseFloat(document.getElementById('warpCX').value);
  const warpCY       = parseFloat(document.getElementById('warpCY').value);
  const warpSize     = parseFloat(document.getElementById('warpSize').value);
  const compBulge    = parseFloat(document.getElementById('compBulge').value);
  const warpOsc      = document.getElementById('warpOsc').checked;
  const warpOscSpeed = parseFloat(document.getElementById('warpOscSpeed').value);
  const warpOscAmt   = parseFloat(document.getElementById('warpOscAmt').value);
  const warpOscWave  = parseFloat(document.getElementById('warpOscWave').value);
  const metaMode     = document.getElementById('metaMode').value;
  const metaChains   = parseInt(document.getElementById('metaChains').value);
  const metaNodes    = parseInt(document.getElementById('metaNodes').value);
  const metaSize     = parseFloat(document.getElementById('metaSize').value);
  const metaSVar     = parseFloat(document.getElementById('metaSVar').value);
  const metaStep     = parseFloat(document.getElementById('metaStep').value);
  const metaRing     = parseFloat(document.getElementById('metaRing').value);
  const metaOpacity  = parseFloat(document.getElementById('metaOpacity').value);
  const metaColor    = document.getElementById('metaColor').value;
  const metaStroke   = document.getElementById('metaStroke').value;
  const metaDrift    = parseFloat(document.getElementById('metaDrift').value);
  const metaPulse    = parseFloat(document.getElementById('metaPulse').value);
  const metaFlow     = parseFloat(document.getElementById('metaFlow').value);

  const W = COLS * CS;
  const H = ROWS * CS;
  canvas.width = W;
  canvas.height = H;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  let effWarpStr = warpStr;
  let effWarpSize = warpSize;
  let effCompBulge = compBulge;
  let effWarpCX = warpCX;
  let effWarpCY = warpCY;
  let warpTimePhase = 0;
  const warpAnimOn = warpOsc && warpOscAmt > 0;
  if (warpAnimOn) {
    warpTimePhase = animTime * warpOscSpeed * 2.5;
    const breathe = Math.sin(warpTimePhase) * warpOscAmt;
    effWarpStr = clamp01(warpStr * (1 + breathe * 0.85));
    effWarpSize = clamp01(warpSize * (1 + breathe * 0.65));
    effCompBulge = compBulge + breathe * 0.35;
    effWarpCX = clamp01(warpCX + Math.sin(warpTimePhase * 0.7) * warpOscAmt * 0.06);
    effWarpCY = clamp01(warpCY + Math.cos(warpTimePhase * 0.9) * warpOscAmt * 0.06);
  }

  const pal = palName === 'fal_random' ? buildRandomPalette() : PALETTES[palName];

  // Checker bg colors (fal hexes only for solid modes; tint blends toward #FFFFFF / #000000)
  let bgA = pal.bgA, bgB = pal.bgB;
  if (checkerStyle === 'dark')  { bgA = '#403700'; bgB = '#000000'; }
  if (checkerStyle === 'light') { bgA = '#FFFFFF'; bgB = '#E5ECE7'; }
  if (checkerStyle === 'color') {
    const f = pal.families[0];
    bgA = lerpColor(f[0], '#FFFFFF', 0.4);
    bgB = lerpColor(f[f.length - 1], '#000000', 0.4);
  }

  // ── Build blobs ───────────────────────────────────────────────────────────
  const blobs = [];
  for (let i = 0; i < bCount; i++) {
    const famIdx = (blobs.length === 0 || rand() < cVar) ? ri(0, pal.families.length-1) : blobs[ri(0,blobs.length-1)].famIdx;
    blobs.push({ cx:rr(0.04,0.96), cy:rr(0.04,0.96), r:rr(rMin,rMax), famIdx, stretch:rr(0.75,1.35), angle:rr(0,Math.PI) });
  }

  // ── Build mega blobs ──────────────────────────────────────────────────────
  const megaBlobs = [];
  for (let m = 0; m < mCount; m++) {
    const ax = rr(0.1,0.9), ay = rr(0.1,0.9);
    const famIdx = ri(0, pal.families.length-1);
    for (let l = 0; l < megaLobes; l++) {
      const a = (l/megaLobes)*Math.PI*2 + rr(-0.4,0.4);
      const dist = rr(0, lobeScatter*megaScale*0.8);
      megaBlobs.push({
        cx: ax + Math.cos(a)*dist,
        cy: ay + Math.sin(a)*dist,
        r: megaScale*rr(0.55,1.0),
        famIdx, stretch:rr(0.7,1.4), angle:rr(0,Math.PI), isMega: true
      });
    }
  }

  const allUnits = [...blobs, ...megaBlobs];

  // ── Helpers ───────────────────────────────────────────────────────────────
  function unitInfluence(b, nx, ny) {
    const dx = nx-b.cx, dy = ny-b.cy;
    const cos = Math.cos(b.angle), sin = Math.sin(b.angle);
    const lx = (dx*cos + dy*sin)/(b.r*b.stretch);
    const ly = (-dx*sin + dy*cos)/(b.r/b.stretch);
    const s = b.isMega ? megaShape : shape;
    const dSup = Math.pow(Math.pow(Math.abs(lx),s*2)+Math.pow(Math.abs(ly),s*2), 1/(s*2));
    return Math.max(0, 1-Math.pow(dSup, soft));
  }
  function inflToColor(infl, family) {
    const fPos = (1-infl)*(family.length-1);
    const fLo = Math.floor(fPos);
    const fHi = Math.min(family.length-1, fLo+1);
    return lerpColor(family[fHi], family[fLo], fPos-fLo);
  }

  // ── Build overlay blobs ───────────────────────────────────────────────────
  const ovBlobs = [];
  for (let i = 0; i < ovCount; i++) {
    const fam = pal.families[ri(0, pal.families.length-1)];
    ovBlobs.push({
      cx: rr(0.05,0.95), cy: rr(0.05,0.95),
      r: rr(ovSize*0.5, ovSize*1.3),
      stretch: rr(0.6,1.6), angle: rr(0,Math.PI),
      color: fam[ri(1, fam.length-2)]
    });
  }

  // ── SVG accumulator ───────────────────────────────────────────────────────
  const svgEls = [];

  // ── Per-cell size variance map ────────────────────────────────────────────
  // Each cell gets a random scale factor. At checkerVar=0 all are 1.0.
  // At checkerVar=1 sizes range from ~0.3 to ~1.7, giving a chaotic mosaic feel.
  const cellScale = new Float32Array(ROWS * COLS);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const v = checkerVar > 0 ? rr(1 - checkerVar * 0.7, 1 + checkerVar * 0.7) : 1.0;
      cellScale[row * COLS + col] = Math.max(0.15, v);
    }
  }

  // ── Composition bulge: maps normalised grid pos → actual canvas px ───────
  // Positive = fisheye outward bulge, negative = pinch/concave.
  function compWarp(nx, ny) {
    if (effCompBulge === 0) return { px: nx * W, py: ny * H };
    const dx = nx - effWarpCX, dy = ny - effWarpCY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 0.0001) return { px: nx * W, py: ny * H };
    const maxDist = Math.sqrt(effWarpCX*effWarpCX + effWarpCY*effWarpCY) * 1.2 + 0.01;
    const t = dist / maxDist;
    let r2;
    if (effCompBulge > 0) {
      r2 = dist * (1 + effCompBulge * t * t * 2.2);
    } else {
      r2 = dist * (1 + effCompBulge * t * 1.8);
      r2 = Math.max(r2, 0);
    }
    const scale = r2 / dist;
    const wx = effWarpCX + dx * scale;
    const wy = effWarpCY + dy * scale;
    return { px: wx * W, py: wy * H };
  }

  // ── 1. Draw checker BG ────────────────────────────────────────────────────
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // First flood-fill the whole canvas with bgA so gaps between scaled cells are filled
  ctx.fillStyle = bgA;
  ctx.fillRect(0, 0, W, H);
  svgEls.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${bgA}"/>`);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const sc = cellScale[row * COLS + col];
      const fill = (row+col)%2===0 ? bgA : bgB;
      const nx = (col+0.5)/COLS, ny = (row+0.5)/ROWS;
      const { px, py } = compWarp(nx, ny);
      const cw = CS * sc, ch = CS * sc;
      const x = px - cw/2, y = py - ch/2;
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, cw, ch);
      svgEls.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cw.toFixed(1)}" height="${ch.toFixed(1)}" fill="${fill}"/>`);
    }
  }

  // ── Warp field: returns { scaleX, scaleY, angle } per cell position (nx,ny in 0..1) ──
  // scaleX/scaleY stretch the dot ellipse axes; angle rotates it.
  // Combined they create the perspective-foreshortening illusion.
  function warpAt(nx, ny) {
    if (warpType === 'none') return { sx:1, sy:1, ang:0, sz:1 };
    const dx = nx - effWarpCX, dy = ny - effWarpCY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const ang = Math.atan2(dy, dx);
    let sx = 1, sy = 1, dotAng = 0, sz = 1;
    const phase = warpTimePhase * 0.55;

    switch (warpType) {
      case 'bulge': {
        const falloff = Math.exp(-dist * dist * 2.5);
        const radialStretch = 1 + effWarpStr * falloff * 3.5;
        const tangStretch   = 1 - effWarpStr * falloff * 1.2;
        sx = radialStretch; sy = Math.max(0.05, tangStretch);
        dotAng = ang;
        sz = 1 + effWarpSize * falloff * 3.0;
        break;
      }
      case 'tunnel': {
        const falloff = dist;
        const radialStretch = 1 + effWarpStr * falloff * 1.5;
        const tangStretch   = 1 - effWarpStr * falloff * 0.4;
        sx = radialStretch; sy = Math.max(0.15, tangStretch);
        dotAng = ang;
        sz = Math.max(0.2, 1 - effWarpSize * dist * 1.8);
        break;
      }
      case 'wave_h': {
        const wave = Math.sin(ny * Math.PI * 3 + nx * Math.PI + phase);
        sx = 1 + effWarpStr * wave * 0.8;
        sy = 1 - effWarpStr * wave * 0.5;
        sz = 1 + effWarpSize * Math.abs(wave) * 0.6;
        dotAng = effWarpStr * wave * 0.4;
        break;
      }
      case 'wave_v': {
        const wave = Math.sin(nx * Math.PI * 3 + ny * Math.PI + phase);
        sx = 1 - effWarpStr * wave * 0.5;
        sy = 1 + effWarpStr * wave * 0.8;
        sz = 1 + effWarpSize * Math.abs(wave) * 0.6;
        dotAng = effWarpStr * wave * 0.4;
        break;
      }
      case 'diagonal': {
        const t = nx * 0.7 + ny * 0.3;
        const persp = 0.3 + t * 0.7;
        sx = 1 + effWarpStr * (1 - persp) * 1.2;
        sy = 1 - effWarpStr * (1 - persp) * 0.4;
        sz = Math.max(0.2, persp + effWarpSize * (1-persp));
        dotAng = effWarpStr * 0.3;
        break;
      }
      case 'saddle': {
        const sdx = nx - effWarpCX, sdy = ny - effWarpCY;
        sx = 1 + effWarpStr * sdy * sdy * 3;
        sy = 1 + effWarpStr * sdx * sdx * 3;
        sz = 1 - effWarpSize * (sdx*sdx + sdy*sdy) * 2;
        sz = Math.max(0.15, sz);
        dotAng = effWarpStr * sdx * sdy * 1.5;
        break;
      }
    }

    if (warpAnimOn && warpType !== 'none' && warpOscWave > 0) {
      const rdx = nx - 0.5, rdy = ny - 0.5;
      const rdist = Math.sqrt(rdx*rdx + rdy*rdy);
      const ripple = 1 + Math.sin(warpTimePhase - rdist * warpOscWave * Math.PI * 2) * warpOscAmt * 0.35;
      sx *= ripple;
      sy *= ripple;
      sz *= ripple;
    }

    return { sx: Math.max(0.1, sx), sy: Math.max(0.1, sy), ang: dotAng, sz: Math.max(0.1, sz) };
  }

  // ── 2. Draw halftone dot layers (skipped if node chains replace) ─────────
  if (metaMode !== 'replace') {
    ctx.globalCompositeOperation = 'source-over';
    for (const unit of allUnits) {
      const family = pal.families[unit.famIdx];
      const pad = unit.r * Math.max(unit.stretch, 1/unit.stretch) * 1.6;
      const c0 = Math.max(0, Math.floor((unit.cx-pad)*COLS));
      const c1 = Math.min(COLS-1, Math.ceil((unit.cx+pad)*COLS));
      const r0 = Math.max(0, Math.floor((unit.cy-pad)*ROWS));
      const r1 = Math.min(ROWS-1, Math.ceil((unit.cy+pad)*ROWS));
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const nx = (col+0.5)/COLS, ny = (row+0.5)/ROWS;
          const infl = unitInfluence(unit, nx, ny);
          if (infl < 0.006) continue;
          let baseR = CS*0.5*(dotMin+(dotMax-dotMin)*infl);
          // Oscillate dots in & out — a radial ripple emanating from the canvas
          // centre. dotOscWave controls how many concentric bands; speed sets the
          // rate; amount sets how deeply each dot shrinks/swells (1 = fully out).
          if (dotOsc && dotOscAmt > 0) {
            const rdx = nx - 0.5, rdy = ny - 0.5;
            const rdist = Math.sqrt(rdx*rdx + rdy*rdy);
            const phase = rdist * dotOscWave * Math.PI * 2;
            const oscMul = 1 + Math.sin(animTime * dotOscSpeed * 2.5 - phase) * dotOscAmt;
            baseR *= Math.max(0, oscMul);
          }
          if (baseR < 0.4) continue;
          const fill = inflToColor(infl, family);
          const { px, py } = compWarp(nx, ny);
          const w = warpAt(nx, ny);
          const rx = baseR * w.sz * w.sx;
          const ry = baseR * w.sz * w.sy;
          ctx.save();
          ctx.translate(px, py);
          if (w.ang !== 0) ctx.rotate(w.ang);
          ctx.beginPath();
          ctx.ellipse(0, 0, Math.max(0.3, rx), Math.max(0.3, ry), 0, 0, Math.PI*2);
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.restore();
          if (w.ang !== 0) {
            const deg = (w.ang*180/Math.PI).toFixed(2);
            svgEls.push(`<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" transform="rotate(${deg},${px.toFixed(1)},${py.toFixed(1)})" fill="${fill}"/>`);
          } else {
            svgEls.push(`<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="${fill}"/>`);
          }
        }
      }
    }
  }

  // ── 2b. DR-style node chains ───────────────────────────────────────────────
  // Each chain is a random walk of circles connected by tangent bridge tubes.
  // Circles vary in size. Some are filled, some are rings (hollow). Connectors
  // are rectangles bridging the gap between adjacent node edges — exactly the
  // Designers Republic / TDR visual language.
  if (metaMode !== 'off') {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = metaOpacity;

    // SVG collector for node chains — the whole layer shares metaOpacity via a <g>.
    // Animation (drift/pulse/flow) bakes into whatever the current frame is, so
    // exporting simply captures the most recent frame.
    const metaEls = [];

    // Build chains using seeded RNG (already seeded at top of draw())
    // We need a separate local rng so chains don't disturb blob layout seed
    let cr = (currentSeed ^ 0xDEAD) >>> 0 || 1;
    function crand() { cr^=cr<<13; cr^=cr>>17; cr^=cr<<5; return (cr>>>0)/4294967296; }
    function crr(a,b) { return a+crand()*(b-a); }
    function cri(a,b) { return Math.floor(crr(a,b+0.9999)); }

    for (let ch = 0; ch < metaChains; ch++) {
      let fam;
      if (metaColor === 'single') {
        fam = pal.families[0];
      } else if (metaColor === 'random') {
        fam = pal.families[cri(0, pal.families.length - 1)];
      } else {
        fam = pal.families[ch % pal.families.length];
      }
      const fillColor = metaColor === 'random' ? fam[cri(0, 2)] : fam[1];
      const strokeColor = pickMetaStroke(metaStroke, fam, ch, metaColor, cri);

      // Random walk — start position and direction.
      // Flow Speed slowly reorients the whole chain over time (animTime),
      // making it morph/wander while keeping its seeded shape.
      let x = crr(0.05, 0.95) * W;
      let y = crr(0.05, 0.95) * H;
      let angle = crr(0, Math.PI*2) + animTime * metaFlow * 0.35;
      const stepPx = metaStep * W;

      const nodes = [];
      for (let n = 0; n < metaNodes; n++) {
        // Per-node phase keeps each node's motion independent but stable.
        const phase = crr(0, Math.PI*2);
        // Vary size with metaSVar, then Pulse Speed breathes the radius.
        const baseSize = metaSize * W;
        let r = baseSize * (1 + crr(-metaSVar*0.6, metaSVar*0.8));
        if (metaPulse > 0) r *= 1 + Math.sin(animTime * metaPulse * 2.2 + phase) * 0.16;
        // Decide: ring or filled (metaRing = probability of ring)
        const isRing = crand() < metaRing;
        // Drift Speed gently sways each node around its walk position.
        let nx2 = x, ny2 = y;
        if (metaDrift > 0) {
          const amp = stepPx * 0.28 * metaDrift;
          nx2 += Math.sin(animTime * metaDrift * 1.3 + phase) * amp;
          ny2 += Math.cos(animTime * metaDrift * 1.1 + phase * 1.7) * amp;
        }
        nodes.push({ x: nx2, y: ny2, r: Math.max(2, r), isRing });

        // Step to next node — slight direction drift
        angle += crr(-0.9, 0.9);
        const dist = stepPx * crr(0.7, 1.4);
        x += Math.cos(angle) * dist;
        y += Math.sin(angle) * dist;
        // Soft bounce off edges
        x = Math.max(0.02*W, Math.min(0.98*W, x));
        y = Math.max(0.02*H, Math.min(0.98*H, y));
      }

      // Draw nodes — filled = palette color; rings punch checker + stroke from Node stroke
      for (const node of nodes) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI*2);
        if (node.isRing) {
          const lw = Math.max(1, node.r * 0.28);
          ctx.fillStyle = bgA;
          ctx.fill();
          ctx.lineWidth = lw;
          ctx.strokeStyle = strokeColor;
          ctx.stroke();
          // SVG ring radius is shrunk by half the stroke width so the stroked
          // outer edge lines up with the canvas (which strokes centered on the path).
          metaEls.push(`<circle cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${node.r.toFixed(1)}" fill="${bgA}" stroke="${strokeColor}" stroke-width="${lw.toFixed(2)}"/>`);
        } else {
          ctx.fillStyle = fillColor;
          ctx.fill();
          metaEls.push(`<circle cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${node.r.toFixed(1)}" fill="${fillColor}"/>`);
        }
      }
    }

    if (metaEls.length) {
      svgEls.push(`<g opacity="${metaOpacity.toFixed(3)}">${metaEls.join('')}</g>`);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── 3. Draw overlay blobs (multiply) ─────────────────────────────────────
  ctx.globalCompositeOperation = 'multiply';
  for (const ob of ovBlobs) {
    const rx = ob.r*ob.stretch*W;
    const ry = (ob.r/ob.stretch)*H;
    const cx2 = ob.cx*W, cy2 = ob.cy*H;
    const [r2,g2,b2] = parseColor(ob.color);
    const n = ovSoft;

    ctx.save();
    ctx.translate(cx2, cy2);
    ctx.rotate(ob.angle);
    ctx.beginPath();
    // Build the superellipse once; reuse the exact same points for SVG so the
    // shape — including the concave/pinched "inverse bulge" when ovSoft < 2 — matches.
    const ovPts = [];
    for (let i = 0; i <= 120; i++) {
      const t = (i/120)*Math.PI*2;
      const ct = Math.cos(t), st = Math.sin(t);
      const x = Math.sign(ct)*Math.pow(Math.abs(ct),2/n)*rx;
      const y = Math.sign(st)*Math.pow(Math.abs(st),2/n)*ry;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      ovPts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(${r2},${g2},${b2},${ovOpacity})`;
    ctx.fill();
    ctx.restore();

    const deg = (ob.angle*180/Math.PI).toFixed(2);
    svgEls.push(`<polygon points="${ovPts.join(' ')}" transform="translate(${cx2.toFixed(1)},${cy2.toFixed(1)}) rotate(${deg})" fill="${ob.color}" fill-opacity="${ovOpacity.toFixed(3)}" style="mix-blend-mode:multiply"/>`);
  }

  // ── 4. Draw pattern swatch ────────────────────────────────────────────────
  if (patType !== 'none') {
    // Resolve color
    let patRaw = '#000000';
    if (patColorId === 'white') patRaw = '#ffffff';
    else if (patColorId === 'random') patRaw = pal.families[ri(0,pal.families.length-1)][ri(1,3)];
    else if (patColorId.startsWith('pal')) patRaw = pal.families[parseInt(patColorId.slice(3)) % pal.families.length][2];

    const T = patScale;
    const D = patDensity;
    const sw = Math.max(0.5, D*T*0.18);

    // Some patterns need a 2x tile
    let tSize = T;
    if (patType === 'dots_offset' || patType === 'dense_dots') tSize = T*2;

    const tile = document.createElement('canvas');
    tile.width = tile.height = tSize;
    const tc = tile.getContext('2d');
    tc.clearRect(0, 0, tSize, tSize);
    tc.fillStyle = patRaw;
    tc.strokeStyle = patRaw;
    tc.lineWidth = sw;

    switch (patType) {
      case 'dots': {
        tc.beginPath(); tc.arc(T/2,T/2,D*T*0.42,0,Math.PI*2); tc.fill(); break;
      }
      case 'dots_offset': {
        const r3 = D*T*0.36;
        [[T/2,T/2],[T*3/2,T/2],[T,T*3/2],[0,T*3/2],[T*2,T*3/2]].forEach(([x,y])=>{
          tc.beginPath(); tc.arc(x,y,r3,0,Math.PI*2); tc.fill();
        }); break;
      }
      case 'dense_dots': {
        const r3 = D*T*0.3;
        for (let dy=0;dy<2;dy++) for (let dx=0;dx<2;dx++) {
          tc.beginPath(); tc.arc(T/2+dx*T,T/2+dy*T,r3,0,Math.PI*2); tc.fill();
        } break;
      }
      case 'rings': {
        tc.lineWidth = Math.max(0.5,T*0.08);
        tc.beginPath(); tc.arc(T/2,T/2,D*T*0.42,0,Math.PI*2); tc.stroke(); break;
      }
      case 'lines_h': {
        tc.beginPath(); tc.moveTo(0,T/2); tc.lineTo(T,T/2); tc.stroke(); break;
      }
      case 'lines_v': {
        tc.beginPath(); tc.moveTo(T/2,0); tc.lineTo(T/2,T); tc.stroke(); break;
      }
      case 'lines_45': {
        [[-T/2,T*1.5],[T/2,T*1.5],[T*3/2,T*1.5]].forEach(([ox,oy])=>{
          tc.beginPath(); tc.moveTo(ox,oy); tc.lineTo(ox+T*2,oy-T*2); tc.stroke();
        }); break;
      }
      case 'crosshatch': {
        tc.beginPath(); tc.moveTo(0,T/2); tc.lineTo(T,T/2); tc.stroke();
        tc.beginPath(); tc.moveTo(T/2,0); tc.lineTo(T/2,T); tc.stroke(); break;
      }
      case 'diamonds': {
        const s = T*D*0.42;
        tc.beginPath();
        tc.moveTo(T/2,T/2-s); tc.lineTo(T/2+s,T/2);
        tc.lineTo(T/2,T/2+s); tc.lineTo(T/2-s,T/2);
        tc.closePath(); tc.fill(); break;
      }
      case 'triangles': {
        const s = T*D*0.48;
        tc.beginPath();
        tc.moveTo(T/2,T/2-s);
        tc.lineTo(T/2+s,T/2+s*0.7);
        tc.lineTo(T/2-s,T/2+s*0.7);
        tc.closePath(); tc.fill(); break;
      }
      case 'checks': {
        const s = T*D*0.5;
        tc.fillRect(T/2-s/2,T/2-s/2,s,s); break;
      }
      case 'waves': {
        tc.beginPath();
        tc.moveTo(0,T/2);
        tc.bezierCurveTo(T*0.25,T/2-T*D*0.4, T*0.75,T/2+T*D*0.4, T,T/2);
        tc.stroke(); break;
      }
      case 'zigzag': {
        tc.beginPath();
        tc.moveTo(0,T/2);
        tc.lineTo(T/4,T/2-T*D*0.4);
        tc.lineTo(T/2,T/2);
        tc.lineTo(T*3/4,T/2+T*D*0.4);
        tc.lineTo(T,T/2);
        tc.stroke(); break;
      }
      case 'confetti': {
        const n2 = Math.max(1, Math.round(D*8));
        const s2 = T*D*0.18;
        for (let i=0;i<n2;i++) {
          const fx = (i*137.508+31)%T;
          const fy = (i*97.3+17)%T;
          const ang = (i*72.1)%(Math.PI*2);
          tc.save(); tc.translate(fx,fy); tc.rotate(ang);
          tc.fillRect(-s2,-s2*0.4,s2*2,s2*0.8); tc.restore();
        }
        break;
      }
    }

    // Stamp across canvas
    const pat = ctx.createPattern(tile, 'repeat');
    ctx.globalCompositeOperation = patBlend;
    ctx.globalAlpha = patOpacity;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // SVG embed via data URL
    const tileDataUrl = tile.toDataURL();
    svgEls.push(
      `<defs><pattern id="swatchpat" x="0" y="0" width="${tSize}" height="${tSize}" patternUnits="userSpaceOnUse">` +
      `<image href="${tileDataUrl}" width="${tSize}" height="${tSize}"/>` +
      `</pattern></defs>` +
      `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#swatchpat)" fill-opacity="${patOpacity.toFixed(3)}" style="mix-blend-mode:${patBlend}"/>`
    );
  }

  canvas._svgData = { els: svgEls, W, H };
}

// ── Wiring ────────────────────────────────────────────────────────────────────
const SLIDERS = {
  cols:'v-cols', cellSize:'v-cell', checkerVar:'v-checker-var', blobCount:'v-blobs',
  rMin:'v-rmin', rMax:'v-rmax', blobShape:'v-shape', softness:'v-soft',
  megaCount:'v-mega', megaScale:'v-megascale', megaLobes:'v-lobes', lobeScatter:'v-lscatter', megaShape:'v-megashape',
  dotMax:'v-dotmax', dotMin:'v-dotmin',
  dotOscSpeed:'v-dotoscspeed', dotOscAmt:'v-dotoscamt', dotOscWave:'v-dotoscwave',
  metaChains:'v-meta-chains', metaNodes:'v-meta-nodes', metaSize:'v-meta-size',
  metaSVar:'v-meta-svar', metaStep:'v-meta-step',
  metaRing:'v-meta-ring', metaOpacity:'v-meta-opacity',
  metaDrift:'v-meta-drift', metaPulse:'v-meta-pulse', metaFlow:'v-meta-flow',
  warpStr:'v-warp-str', warpCX:'v-warp-cx', warpCY:'v-warp-cy', warpSize:'v-warp-size', compBulge:'v-comp-bulge',
  warpOscSpeed:'v-warp-oscspeed', warpOscAmt:'v-warp-oscamt', warpOscWave:'v-warp-oscwave',
  ovCount:'v-ov-count', ovSize:'v-ov-size', ovOpacity:'v-ov-opacity', ovSoft:'v-ov-soft',
  patScale:'v-pat-scale', patDensity:'v-pat-density', patOpacity:'v-pat-opacity',
  cVar:'v-cvar'
};
for (const [id, valId] of Object.entries(SLIDERS)) {
  const el = document.getElementById(id);
  const vl = document.getElementById(valId);
  if (!el || !vl) continue;
  el.addEventListener('input', () => {
    vl.textContent = parseFloat(el.value).toFixed(el.step && parseFloat(el.step) < 1 ? 2 : 0);
    draw();
  });
}

['checkerStyle','palette','patType','patColor','patBlend','warpType','metaMode','metaColor','metaStroke'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => { saveCurrentState(); draw(); });
});

document.getElementById('dotOsc').addEventListener('change', () => { saveCurrentState(); draw(); });
document.getElementById('warpOsc').addEventListener('change', () => { saveCurrentState(); draw(); });

document.getElementById('btn-gen').addEventListener('click', () => {
  draw(Math.floor(Math.random() * 0xFFFFFF));
});
document.getElementById('btn-save').addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = `gmc_${currentSeed}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
});
function buildSvgString() {
  const d = canvas._svgData;
  if (!d) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${d.W}" height="${d.H}" viewBox="0 0 ${d.W} ${d.H}">\n${d.els.join('\n')}\n</svg>`;
}

document.getElementById('btn-svg').addEventListener('click', () => {
  const svgStr = buildSvgString();
  if (!svgStr) return;
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.download = `gmc_${currentSeed}.svg`;
  a.href = URL.createObjectURL(blob);
  a.click();
});
document.getElementById('btn-svg-copy').addEventListener('click', () => {
  const svgStr = buildSvgString();
  if (!svgStr) return;
  const btn = document.getElementById('btn-svg-copy');
  const done = () => { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy SVG', 1500); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(svgStr).then(done).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = svgStr; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } finally { document.body.removeChild(ta); }
    });
  } else {
    const ta = document.createElement('textarea');
    ta.value = svgStr; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } finally { document.body.removeChild(ta); }
  }
});

// ── Preset & State System ─────────────────────────────────────────────────────

const ALL_SLIDER_IDS = Object.keys(SLIDERS);
const META_STROKE_IDS = new Set(['ends', 'deep', 'mix_deep', 'family_random', 'all_swatches', 'black', 'legacy_mid']);
const ALL_SELECT_IDS = ['checkerStyle','palette','patType','patColor','patBlend','warpType','metaMode','metaColor','metaStroke'];
const ALL_CHECKBOX_IDS = ['dotOsc', 'warpOsc'];
const LS_STATE_KEY   = 'gmc_state';
const LS_PRESETS_KEY = 'gmc_presets';
const IDB_NAME = 'gmc-generator';
const IDB_VER = 1;
const IDB_PRESETS = 'presets';

let activePresetName = null;
let presetsStore = {};

function presetMsg(text) {
  const el = document.getElementById('preset-msg');
  if (el) el.textContent = text || '';
}

function openPresetsDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_PRESETS)) {
        db.createObjectStore(IDB_PRESETS, { keyPath: 'name' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbReadAllPresets() {
  const db = await openPresetsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_PRESETS, 'readonly');
    const req = tx.objectStore(IDB_PRESETS).getAll();
    req.onsuccess = () => {
      const out = {};
      for (const row of req.result || []) out[row.name] = row.state;
      resolve(out);
    };
    req.onerror = () => reject(req.error);
  });
}

async function idbWritePreset(name, state) {
  const db = await openPresetsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_PRESETS, 'readwrite');
    tx.objectStore(IDB_PRESETS).put({ name, state, savedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDeletePreset(name) {
  const db = await openPresetsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_PRESETS, 'readwrite');
    tx.objectStore(IDB_PRESETS).delete(name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function migrateLegacyPresets() {
  let legacy = {};
  try {
    legacy = JSON.parse(localStorage.getItem(LS_PRESETS_KEY) || '{}');
  } catch (_) {}
  if (!legacy || typeof legacy !== 'object') return;
  const names = Object.keys(legacy);
  if (!names.length) return;
  for (const name of names) {
    presetsStore[name] = legacy[name];
    await idbWritePreset(name, legacy[name]);
  }
  try {
    localStorage.removeItem(LS_PRESETS_KEY);
  } catch (_) {}
}

async function mergeBundledGeneratorPresets() {
  const bundled = window.GMC_GENERATOR_BUNDLED_PRESETS;
  if (!Array.isArray(bundled) || !bundled.length) return;
  for (const entry of bundled) {
    const name = entry?.name;
    const state = entry?.state;
    if (!name || !state || typeof state !== 'object') continue;
    presetsStore[name] = state;
    try {
      await idbWritePreset(name, state);
    } catch (err) {
      console.warn(err);
    }
  }
}

async function initPresets() {
  try {
    presetsStore = await idbReadAllPresets();
  } catch (err) {
    console.warn(err);
    presetsStore = {};
  }
  if (!Object.keys(presetsStore).length) {
    try {
      await migrateLegacyPresets();
    } catch (err) {
      console.warn(err);
    }
  }
  try {
    await mergeBundledGeneratorPresets();
  } catch (err) {
    console.warn(err);
  }
  renderPresetList();
}

function loadPresets() {
  return presetsStore;
}

async function savePreset(name, state) {
  presetsStore[name] = state;
  await idbWritePreset(name, state);
}

async function deletePreset(name) {
  delete presetsStore[name];
  await idbDeletePreset(name);
}

function nextPresetName() {
  const names = new Set(Object.keys(presetsStore));
  let i = Object.keys(presetsStore).length + 1;
  while (names.has(`Preset ${i}`)) i += 1;
  return `Preset ${i}`;
}

function captureState() {
  const state = { seed: currentSeed };
  ALL_SLIDER_IDS.forEach(id => { const el = document.getElementById(id); if (el) state[id] = el.value; });
  ALL_SELECT_IDS.forEach(id => { const el = document.getElementById(id); if (el) state[id] = el.value; });
  ALL_CHECKBOX_IDS.forEach(id => { const el = document.getElementById(id); if (el) state[id] = el.checked; });
  return state;
}

function applyState(state) {
  ALL_SLIDER_IDS.forEach(id => {
    const el = document.getElementById(id);
    const vl = document.getElementById(SLIDERS[id]);
    if (el && state[id] !== undefined) {
      el.value = state[id];
      if (vl) vl.textContent = parseFloat(state[id]).toFixed(parseFloat(el.step) < 1 ? 2 : 0);
    }
  });
  ALL_SELECT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el || state[id] === undefined) return;
    el.value = state[id];
    if (id === 'palette' && el.value !== 'fal_tonal' && el.value !== 'fal_contrast' && el.value !== 'fal_random') {
      el.value = 'fal_tonal';
    }
    if (id === 'metaStroke' && !META_STROKE_IDS.has(el.value)) el.value = 'ends';
  });
  ALL_CHECKBOX_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el && state[id] !== undefined) el.checked = !!state[id];
  });
  if (state.seed !== undefined) currentSeed = state.seed;
  draw(currentSeed);
}

function saveCurrentState() {
  try { localStorage.setItem(LS_STATE_KEY, JSON.stringify(captureState())); } catch(e) {}
}

function restoreState() {
  try { const raw = localStorage.getItem(LS_STATE_KEY); if (raw) { applyState(JSON.parse(raw)); return true; } } catch(e) {}
  return false;
}

function renderPresetList() {
  const list = document.getElementById('preset-list');
  if (!list) return;
  list.innerHTML = '';
  const presets = loadPresets();
  const names = Object.keys(presets).sort();
  if (names.length === 0) {
    list.innerHTML = '<div class="preset-empty">no presets saved</div>';
    return;
  }
  names.forEach((name, i) => {
    const row = document.createElement('div');
    row.className = 'preset-item' + (name === activePresetName ? ' active' : '');
    row.dataset.name = name;

    const loadBtn = document.createElement('button');
    loadBtn.className = 'preset-item-load';
    const slot = i < 9 ? i + 1 : null;
    loadBtn.textContent = slot ? `${slot} · ${name}` : name;
    loadBtn.title = slot ? `[${slot}] ${name}` : name;
    loadBtn.addEventListener('click', () => {
      activePresetName = name;
      applyState(presets[name]);
      const input = document.getElementById('preset-name-input');
      if (input) input.value = name;
      renderPresetList();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'preset-item-del';
    delBtn.textContent = '×';
    delBtn.title = 'Delete';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Delete "${name}"?`)) return;
      try {
        await deletePreset(name);
        if (activePresetName === name) activePresetName = null;
        renderPresetList();
        presetMsg(`Deleted · ${name}`);
      } catch (err) {
        console.warn(err);
        presetMsg('Could not delete preset.');
      }
    });

    row.appendChild(loadBtn);
    row.appendChild(delBtn);
    list.appendChild(row);
  });
}

document.getElementById('btn-preset-save').addEventListener('click', async () => {
  const input = document.getElementById('preset-name-input');
  let name = (input?.value || '').trim();
  if (!name) name = nextPresetName();
  try {
    await savePreset(name, captureState());
    activePresetName = name;
    if (input) input.value = name;
    renderPresetList();
    presetMsg(`Saved · ${name}`);
  } catch (err) {
    console.warn(err);
    presetMsg('Could not save preset.');
  }
});

document.getElementById('preset-name-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-preset-save')?.click();
});

function isTypingTarget(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === 'textarea') return true;
  if (tag === 'input') {
    const t = el.type;
    return !t || t === 'text' || t === 'search' || t === 'number' || t === 'email' || t === 'url' || t === 'password';
  }
  return !!el.isContentEditable;
}

function loadPresetBySlot(slot) {
  if (slot < 0 || slot > 8) return;
  const presets = loadPresets();
  const names = Object.keys(presets).sort();
  const name = names[slot];
  if (!name) return;
  activePresetName = name;
  applyState(presets[name]);
  const input = document.getElementById('preset-name-input');
  if (input) input.value = name;
  renderPresetList();
  presetMsg(`Loaded · ${name} [${slot + 1}]`);
}

window.addEventListener('message', (e) => {
  if (e.data?.type === 'gmc-load-preset-slot') {
    loadPresetBySlot(e.data.slot);
  }
});

document.addEventListener('keydown', (e) => {
  if (isTypingTarget(e.target)) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.shiftKey && (e.code === 'Digit1' || e.code === 'Digit2')) {
    e.preventDefault();
    window.parent.postMessage(
      { type: 'gmc-set-view', view: e.code === 'Digit1' ? '3d' : '2d' },
      '*'
    );
    return;
  }
  if (e.key >= '1' && e.key <= '9') {
    e.preventDefault();
    loadPresetBySlot(parseInt(e.key, 10) - 1);
  }
});

// ── Export / Import ───────────────────────────────────────────────────────────
function showModal(id) { document.getElementById(id).style.display = 'flex'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }

document.getElementById('btn-preset-export').addEventListener('click', () => {
  const presets = loadPresets();
  const state = (activePresetName && presets[activePresetName]) ? presets[activePresetName] : captureState();
  const name = activePresetName || 'untitled';
  const key = btoa(unescape(encodeURIComponent(JSON.stringify({ name, state }))));
  document.getElementById('export-text').value = key;
  showModal('export-modal');
});

document.getElementById('btn-export-copy').addEventListener('click', () => {
  const ta = document.getElementById('export-text');
  ta.select();
  navigator.clipboard.writeText(ta.value).catch(() => document.execCommand('copy'));
  const btn = document.getElementById('btn-export-copy');
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = 'Copy to Clipboard', 1500);
});
document.getElementById('btn-export-close').addEventListener('click', () => hideModal('export-modal'));

document.getElementById('btn-preset-import').addEventListener('click', () => {
  document.getElementById('import-text').value = '';
  document.getElementById('import-error').style.display = 'none';
  showModal('import-modal');
});
document.getElementById('btn-import-cancel').addEventListener('click', () => hideModal('import-modal'));
document.getElementById('btn-import-confirm').addEventListener('click', async () => {
  const raw = document.getElementById('import-text').value.trim();
  const errEl = document.getElementById('import-error');
  errEl.style.display = 'none';
  try {
    const payload = JSON.parse(decodeURIComponent(escape(atob(raw))));
    if (!payload.state) throw new Error('bad');
    let finalName = payload.name || 'imported';
    let i = 1;
    while (presetsStore[finalName]) finalName = `${payload.name || 'imported'} ${i++}`;
    await savePreset(finalName, payload.state);
    activePresetName = finalName;
    const input = document.getElementById('preset-name-input');
    if (input) input.value = finalName;
    renderPresetList();
    applyState(payload.state);
    presetMsg(`Imported · ${finalName}`);
    hideModal('import-modal');
  } catch(e) {
    errEl.textContent = 'Invalid key — could not parse.';
    errEl.style.display = 'block';
  }
});

['import-modal','export-modal'].forEach(id => {
  document.getElementById(id).addEventListener('click', e => { if (e.target.id === id) hideModal(id); });
});

// Auto-save state on every interaction
for (const id of Object.keys(SLIDERS)) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', saveCurrentState);
}
ALL_SELECT_IDS.forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', saveCurrentState);
});
ALL_CHECKBOX_IDS.forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', saveCurrentState);
});

// ── Animation loop — drives subtle node-chain motion ───────────────────────────
// Only redraws when chains are visible and at least one speed slider is > 0,
// so a fully-static config stays idle (no needless repaints).
let _animLast = null;
function animFrame(now) {
  requestAnimationFrame(animFrame);
  if (_animLast === null) _animLast = now;
  const dt = Math.min(0.05, (now - _animLast) / 1000);
  _animLast = now;
  const mode = document.getElementById('metaMode').value;
  const drift = parseFloat(document.getElementById('metaDrift').value);
  const pulse = parseFloat(document.getElementById('metaPulse').value);
  const flow  = parseFloat(document.getElementById('metaFlow').value);
  const dotOscOn = document.getElementById('dotOsc').checked &&
                   parseFloat(document.getElementById('dotOscSpeed').value) > 0 &&
                   parseFloat(document.getElementById('dotOscAmt').value) > 0;
  const warpOscOn = document.getElementById('warpOsc').checked &&
                    parseFloat(document.getElementById('warpOscSpeed').value) > 0 &&
                    parseFloat(document.getElementById('warpOscAmt').value) > 0;
  const chainsMoving = mode !== 'off' && (drift > 0 || pulse > 0 || flow > 0);
  if (chainsMoving || dotOscOn || warpOscOn) {
    animTime += dt;
    draw();
  }
}
requestAnimationFrame(animFrame);

// ── Init ──────────────────────────────────────────────────────────────────────
initPresets()
  .then(() => {
    if (restoreState()) return;
    const defName = window.GMC_GENERATOR_DEFAULT_PRESET;
    const defState = defName && presetsStore[defName];
    if (defState) {
      activePresetName = defName;
      const input = document.getElementById('preset-name-input');
      if (input) input.value = defName;
      applyState(defState);
      renderPresetList();
      return;
    }
    draw(currentSeed);
  })
  .catch((err) => {
    console.warn(err);
    renderPresetList();
    if (!restoreState()) draw(currentSeed);
  });

