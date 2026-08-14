// ───────────────────────────────────────────────────────────────────────────
// Procedural texture factory.
//
// Every surface in the house is authored here in a 2D canvas and then turned
// into a colour / normal / roughness set, so the game ships with no image
// downloads at all but still gets crisp, high-frequency detail up close.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { makeRng, makeNoise2D, fbm, clamp, lerp } from './rng.js';

const noise = makeNoise2D(20240817);
const nz = (x, y) => (noise(x, y) + 1) * 0.5;              // 0..1
const fb = (x, y, o = 4) => (fbm(noise, x, y, o) + 1) * 0.5;

// ── generators ─────────────────────────────────────────────────────────────
// Each generator paints the colour canvas and fills a height field (0..1)
// which is converted into a normal map and (optionally) a roughness map.

const GEN = {
  // ---------------------------------------------------------------- woods
  oakFloor(ctx, S, h, rng) {
    const plankH = S / 6;
    for (let y = 0; y < S; y++) {
      const plank = Math.floor(y / plankH);
      const tone = 0.82 + 0.18 * nz(plank * 12.3, 3.1);
      const off = nz(plank * 5.7, 9.2) * S;
      for (let x = 0; x < S; x++) {
        const gx = (x + off) / S;
        // long grain: stretched fbm + fine rings
        const grain = fb(gx * 3.5, (y / S) * 46, 5);
        const rings = Math.sin((gx * 26 + grain * 5.5) * Math.PI) * 0.5 + 0.5;
        let v = 0.62 * tone + grain * 0.22 + rings * 0.10;
        const inPlankY = y - plank * plankH;
        const seam = inPlankY < 1.2 ? 0.45 : 1;                 // groove between boards
        const endSeam = ((x + off) % (S * 0.9) < 1.4) ? 0.5 : 1;
        v *= seam * endSeam;
        px(ctx, x, y, 168 * v, 118 * v, 72 * v);
        h[y * S + x] = clamp(v * 0.9 + grain * 0.1, 0, 1);
      }
    }
  },

  walnut(ctx, S, h) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const g = fb((x / S) * 2.2, (y / S) * 30, 5);
      const rings = Math.sin(((x / S) * 15 + g * 6) * Math.PI) * 0.5 + 0.5;
      const v = 0.42 + g * 0.28 + rings * 0.14;
      px(ctx, x, y, 92 * v, 58 * v, 36 * v);
      h[y * S + x] = v;
    }
  },

  maple(ctx, S, h) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const g = fb((x / S) * 2, (y / S) * 40, 4);
      const v = 0.78 + g * 0.2;
      px(ctx, x, y, 224 * v, 186 * v, 132 * v);
      h[y * S + x] = v;
    }
  },

  // ---------------------------------------------------------------- stone
  marble(ctx, S, h) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const warp = fb(x / S * 3, y / S * 3, 4) * 2.4;
      const vein = Math.abs(Math.sin((x / S * 3.1 + y / S * 1.7 + warp) * Math.PI * 2));
      const fine = fb(x / S * 9, y / S * 9, 3);
      const v = clamp(0.88 - Math.pow(1 - vein, 14) * 0.55 + fine * 0.06, 0, 1);
      px(ctx, x, y, 236 * v, 236 * v, 232 * v);
      h[y * S + x] = 0.5 + (1 - v) * 0.2;
    }
  },

  fieldstone(ctx, S, h, rng) {
    ctx.fillStyle = '#3b3833'; ctx.fillRect(0, 0, S, S);
    const rows = 7;
    for (let r = 0; r < rows; r++) {
      const y = (r / rows) * S, hh = S / rows;
      let x = -rng() * 40;
      while (x < S) {
        const w = S / 7 * rng.range(0.7, 1.6);
        const g = rng.range(0.42, 0.72);
        roundRect(ctx, x + 1.5, y + 1.5, w - 3, hh - 3, 4);
        const grd = ctx.createLinearGradient(x, y, x + w, y + hh);
        grd.addColorStop(0, rgb(150 * g, 143 * g, 133 * g));
        grd.addColorStop(1, rgb(112 * g, 106 * g, 98 * g));
        ctx.fillStyle = grd; ctx.fill();
        x += w;
      }
    }
    // speckle + height from luminance
    const d = ctx.getImageData(0, 0, S, S);
    for (let i = 0; i < S * S; i++) {
      const x = i % S, y = (i / S) | 0;
      const n = fb(x / S * 26, y / S * 26, 3);
      const k = 0.82 + n * 0.36;
      d.data[i * 4] *= k; d.data[i * 4 + 1] *= k; d.data[i * 4 + 2] *= k;
      h[i] = clamp((d.data[i * 4] / 255) * 0.85 + n * 0.15, 0, 1);
    }
    ctx.putImageData(d, 0, 0);
  },

  brick(ctx, S, h, rng) {
    ctx.fillStyle = '#b9ad9c'; ctx.fillRect(0, 0, S, S);          // mortar
    const rows = 12, bh = S / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (S / 8);
      for (let c = -1; c < 8; c++) {
        const x = c * (S / 4) + off, y = r * bh;
        const t = rng.range(0.72, 1.05);
        ctx.fillStyle = rgb(146 * t, 74 * t, 58 * t);
        ctx.fillRect(x + 1.5, y + 1.5, S / 4 - 3, bh - 3);
      }
    }
    lumHeight(ctx, S, h, 0.9);
  },

  concrete(ctx, S, h) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = fb(x / S * 8, y / S * 8, 5) * 0.5 + fb(x / S * 40, y / S * 40, 2) * 0.5;
      const v = 0.58 + n * 0.22;
      px(ctx, x, y, 168 * v, 168 * v, 165 * v);
      h[y * S + x] = v;
    }
  },

  asphalt(ctx, S, h) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = fb(x / S * 34, y / S * 34, 4);
      const g = fb(x / S * 90, y / S * 90, 2);
      const v = 0.60 + n * 0.15 + (g > 0.72 ? 0.13 : 0);
      px(ctx, x, y, 132 * v * 1.02, 130 * v, 136 * v);
      h[y * S + x] = v;
    }
  },

  gravel(ctx, S, h, rng) {
    ctx.fillStyle = '#6d6660'; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) {
      const x = rng() * S, y = rng() * S, r = rng.range(1.2, 4.2), t = rng.range(0.55, 1.15);
      ctx.beginPath(); ctx.ellipse(x, y, r, r * rng.range(.6, 1), rng() * 3, 0, 7);
      ctx.fillStyle = rgb(150 * t, 143 * t, 132 * t); ctx.fill();
    }
    lumHeight(ctx, S, h, 1);
  },

  // ---------------------------------------------------------------- soft
  carpet(ctx, S, h, rng) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = fb(x / S * 60, y / S * 60, 3);
      const f = nz(x * 1.7, y * 1.7);
      const v = 0.62 + n * 0.2 + f * 0.18;
      px(ctx, x, y, 210 * v, 205 * v, 196 * v);
      h[y * S + x] = v;
    }
  },

  theaterCarpet(ctx, S, h, rng) {
    ctx.fillStyle = '#2a1420'; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(196,150,70,.55)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const cx = (i + .5) * S / 4, cy = (j + .5) * S / 4;
      ctx.beginPath();
      for (let a = 0; a <= 32; a++) {
        const t = a / 32 * Math.PI * 2;
        const r = S / 11 * (1 + 0.34 * Math.sin(t * 5));
        ctx[a ? 'lineTo' : 'moveTo'](cx + Math.cos(t) * r, cy + Math.sin(t) * r);
      }
      ctx.closePath(); ctx.stroke();
    }
    const d = ctx.getImageData(0, 0, S, S);
    for (let i = 0; i < S * S; i++) {
      const x = i % S, y = (i / S) | 0, n = nz(x * 2.1, y * 2.1);
      const k = 0.8 + n * 0.4;
      d.data[i * 4] *= k; d.data[i * 4 + 1] *= k; d.data[i * 4 + 2] *= k;
      h[i] = 0.5 + n * 0.5;
    }
    ctx.putImageData(d, 0, 0);
  },

  fabric(ctx, S, h) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const weave = (Math.sin(x * 0.9) * Math.sin(y * 0.9)) * 0.5 + 0.5;
      const n = fb(x / S * 24, y / S * 24, 3);
      const v = 0.66 + weave * 0.2 + n * 0.14;
      px(ctx, x, y, 220 * v, 216 * v, 208 * v);
      h[y * S + x] = weave * 0.7 + n * 0.3;
    }
  },

  leather(ctx, S, h) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const cell = fb(x / S * 30, y / S * 30, 4);
      const crack = Math.pow(Math.abs(Math.sin(cell * 12)), 6);
      const v = 0.5 + cell * 0.24 - crack * 0.2;
      px(ctx, x, y, 96 * v, 66 * v, 50 * v);
      h[y * S + x] = clamp(v, 0, 1);
    }
  },

  // ---------------------------------------------------------------- house
  drywall(ctx, S, h) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = fb(x / S * 22, y / S * 22, 4) * 0.6 + fb(x / S * 90, y / S * 90, 2) * 0.4;
      const v = 0.9 + n * 0.09;
      px(ctx, x, y, 246 * v, 244 * v, 240 * v);
      h[y * S + x] = 0.5 + n * 0.28;
    }
  },

  tile(ctx, S, h) {
    const n2 = 4, t = S / n2;
    ctx.fillStyle = '#cfd3d6'; ctx.fillRect(0, 0, S, S);          // grout
    for (let i = 0; i < n2; i++) for (let j = 0; j < n2; j++) {
      const g = ctx.createLinearGradient(i * t, j * t, (i + 1) * t, (j + 1) * t);
      const v = 0.94 + nz(i * 7.3, j * 3.1) * 0.06;
      g.addColorStop(0, rgb(246 * v, 247 * v, 248 * v));
      g.addColorStop(1, rgb(226 * v, 230 * v, 234 * v));
      ctx.fillStyle = g; ctx.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
    }
    lumHeight(ctx, S, h, 1);
  },

  poolTile(ctx, S, h) {
    const n2 = 8, t = S / n2;
    ctx.fillStyle = '#dfe8ec'; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < n2; i++) for (let j = 0; j < n2; j++) {
      const v = 0.86 + nz(i * 3.7, j * 5.1) * 0.2;
      ctx.fillStyle = rgb(96 * v, 176 * v, 196 * v);
      ctx.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
    }
    lumHeight(ctx, S, h, 1);
  },

  shingle(ctx, S, h, rng) {
    ctx.fillStyle = '#33302e'; ctx.fillRect(0, 0, S, S);
    const rows = 10, rh = S / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = -1; c < 6; c++) {
        const x = c * (S / 5) + (r % 2) * (S / 10), y = r * rh;
        const t = rng.range(0.7, 1.15);
        ctx.fillStyle = rgb(64 * t, 62 * t, 60 * t);
        ctx.fillRect(x + 1, y, S / 5 - 2, rh * 1.6);
      }
    }
    lumHeight(ctx, S, h, 0.8);
  },

  // ---------------------------------------------------------------- ground
  grass(ctx, S, h, rng) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const patch = fb(x / S * 5, y / S * 5, 4);
      const blade = nz(x * 2.3, y * 2.3);
      const v = 0.45 + patch * 0.3 + blade * 0.25;
      px(ctx, x, y, 74 * v * 0.9, 128 * v, 58 * v * 0.9);
      h[y * S + x] = blade * 0.6 + patch * 0.4;
    }
    // a few dry stalks for break-up
    ctx.__flush();
    for (let i = 0; i < 900; i++) {
      const x = rng() * S, y = rng() * S;
      ctx.strokeStyle = `rgba(${140 + rng() * 40},${150 + rng() * 40},70,.30)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rng.range(-2, 2), y - rng.range(2, 6)); ctx.stroke();
    }
  },

  mountainRock(ctx, S, h) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const strata = Math.sin((y / S * 9 + fb(x / S * 3, y / S * 3, 3) * 3) * Math.PI) * .5 + .5;
      const n = fb(x / S * 14, y / S * 14, 5);
      const v = 0.42 + n * 0.3 + strata * 0.16;
      px(ctx, x, y, 118 * v, 112 * v, 108 * v);
      h[y * S + x] = v;
    }
  },

  // ---------------------------------------------------------------- misc
  brushedMetal(ctx, S, h) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const streak = nz(x * 0.35, y * 9.5);
      const v = 0.68 + streak * 0.3;
      px(ctx, x, y, 205 * v, 208 * v, 212 * v);
      h[y * S + x] = streak;
    }
  },

  laneWood(ctx, S, h) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const board = Math.floor(x / (S / 16));
      const g = fb(board * 3.3, (y / S) * 50, 4);
      const seam = (x % (S / 16)) < 1 ? 0.6 : 1;
      const v = (0.72 + g * 0.22) * seam;
      px(ctx, x, y, 216 * v, 172 * v, 108 * v);
      h[y * S + x] = v;
    }
  },

  ripple(ctx, S, h) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const w1 = Math.sin((u * 12 + fb(u * 4, v * 4, 3) * 4) * Math.PI * 2);
      const w2 = Math.sin((v * 9 - fb(u * 3 + 5, v * 3, 3) * 5) * Math.PI * 2);
      const val = 0.5 + (w1 * 0.28 + w2 * 0.22) * 0.5;
      px(ctx, x, y, 40 * val, 90 * val, 110 * val);
      h[y * S + x] = val;
    }
  },

  courtWood(ctx, S, h) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const board = Math.floor(y / (S / 10));
      const g = fb((x / S) * 2, board * 4.1 + (y / S) * 30, 4);
      const seam = (y % (S / 10)) < 1 ? 0.65 : 1;
      const v = (0.74 + g * 0.2) * seam;
      px(ctx, x, y, 214 * v, 168 * v, 106 * v);
      h[y * S + x] = v;
    }
  },
};

// ── helpers ────────────────────────────────────────────────────────────────
function rgb(r, g, b) { return `rgb(${r | 0},${g | 0},${b | 0})`; }

// Per-pixel writes go through a staging ImageData (thousands of 1x1 fillRects
// would cost hundreds of milliseconds per texture).
function px(ctx, x, y, r, g, b) {
  const d = ctx.__img.data, i = (y * ctx.__size + x) * 4;
  d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  ctx.__dirty = true;
}
function roundRect(ctx, x, y, w, hh, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r);
  ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function lumHeight(ctx, S, h, k) {
  const d = ctx.getImageData(0, 0, S, S).data;
  for (let i = 0; i < S * S; i++) h[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.6 + d[i * 4 + 2] * 0.1) / 255 * k;
}

function normalFromHeight(h, S, strength) {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const at = (x, y) => h[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    let nx = -dx, ny = -dy, nzv = 1;
    const len = Math.hypot(nx, ny, nzv);
    const i = (y * S + x) * 4;
    img.data[i] = (nx / len * 0.5 + 0.5) * 255;
    img.data[i + 1] = (ny / len * 0.5 + 0.5) * 255;
    img.data[i + 2] = (nzv / len * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function roughFromHeight(h, S, base, contrast) {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const v = clamp(base + (h[i] - 0.5) * contrast, 0.02, 1) * 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ── public factory ─────────────────────────────────────────────────────────
export class TextureFactory {
  constructor(renderer) {
    this.aniso = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    this.cache = new Map();
  }

  /**
   * @param {string} name  key in GEN
   * @param {object} o     { size, repeat:[u,v], strength, rough:[base,contrast], srgb }
   */
  get(name, o = {}) {
    const size = o.size || 256;
    const key = `${name}|${size}|${o.repeat || ''}|${o.strength || ''}|${o.rough || ''}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const gen = GEN[name];
    if (!gen) throw new Error(`unknown texture "${name}"`);

    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.__size = size;
    ctx.__img = ctx.createImageData(size, size);
    ctx.__dirty = false;
    ctx.__flush = () => { if (ctx.__dirty) { ctx.putImageData(ctx.__img, 0, 0); ctx.__dirty = false; } };
    const h = new Float32Array(size * size);
    gen(ctx, size, h, makeRng(hash(name)));
    ctx.__flush();

    const rep = o.repeat || [1, 1];
    const map = new THREE.CanvasTexture(c);
    const normalMap = new THREE.CanvasTexture(normalFromHeight(h, size, o.strength ?? 2.0));
    const rr = o.rough || [0.75, 0.35];
    const roughnessMap = new THREE.CanvasTexture(roughFromHeight(h, size, rr[0], rr[1]));

    for (const t of [map, normalMap, roughnessMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rep[0], rep[1]);
      t.anisotropy = this.aniso;
      t.needsUpdate = true;
    }
    map.colorSpace = THREE.SRGBColorSpace;

    const set = { map, normalMap, roughnessMap };
    this.cache.set(key, set);
    return set;
  }

  /** Same maps, different tiling — cheap because canvases are shared. */
  tiled(name, u, v, o = {}) {
    const base = this.get(name, o);
    const out = {};
    for (const k of Object.keys(base)) {
      const t = base[k].clone();
      t.repeat.set(u, v);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = this.aniso;
      t.needsUpdate = true;
      out[k] = t;
    }
    return out;
  }
}

function hash(s) { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }

export const TEXTURE_NAMES = Object.keys(GEN);
