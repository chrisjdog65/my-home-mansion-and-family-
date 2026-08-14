// ───────────────────────────────────────────────────────────────────────────
// Furniture kit.  Every builder takes (kit, x, y, z, opts) with y = floor
// level and rotY in radians, and writes into the static batch (plus colliders
// for anything you can bump into).
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { boxMesh, mesh } from './build.js';
import { makeRng } from '../core/rng.js';

export class Kit {
  constructor(world) {
    this.world = world;
    this.M = world.mats;
    this.B = world.static;
    this.rng = makeRng(90210);
  }

  // local→world helper for rotated furniture groups
  L(ox, oz, x, z, rotY) {
    const c = Math.cos(rotY), s = Math.sin(rotY);
    return [x + ox * c + oz * s, z - ox * s + oz * c];
  }

  box(w, h, d, mat, x, y, z, opts = {}) { this.B.box(w, h, d, mat, x, y, z, opts); return this; }
  col(w, h, d, x, y, z, rotY = 0) { this.world.collider(w, h, d, x, y, z, rotY); return this; }

  /** Box positioned in the local frame of a piece of furniture. */
  p(base, ox, oy, oz, w, h, d, mat, tile = 0.8) {
    const [x, z] = this.L(ox, oz, base.x, base.z, base.r);
    this.B.box(w, h, d, mat, x, base.y + oy, z, { rotY: base.r, tile });
    return this;
  }
  pc(base, ox, oy, oz, w, h, d) {
    const [x, z] = this.L(ox, oz, base.x, base.z, base.r);
    this.world.collider(w, h, d, x, base.y + oy, z, base.r);
    return this;
  }

  cyl(r1, r2, h, mat, x, y, z, seg = 14) {
    const g = new THREE.CylinderGeometry(r1, r2, h, seg);
    return mesh(g, mat, x, y, z);
  }
}

const B = (x, y, z, r = 0) => ({ x, y, z, r });

// ── beds ───────────────────────────────────────────────────────────────────
export function bed(k, x, y, z, o = {}) {
  const M = k.M, b = B(x, y, z, o.rotY || 0);
  const size = o.size || 'king';
  const dims = { king: [2.0, 2.1], queen: [1.6, 2.05], twin: [1.0, 1.95] }[size];
  const [w, d] = dims;
  const frame = o.frame || M.get('walnut');
  const sheets = M.paint(o.sheet ?? 0xf3f1ec, 0.94, 'sheet');
  const duvet = M.paint(o.duvet ?? 0xdfe3e8, 0.95, 'duvet');
  const pillow = M.paint(0xfbfaf7, 0.96, 'pillow');

  k.p(b, 0, 0.18, 0, w + 0.12, 0.36, d + 0.12, frame, 1.2);      // base
  k.p(b, 0, 0.44, 0, w, 0.22, d, sheets, 1.2);                    // mattress
  k.p(b, 0, 0.56, 0.22, w, 0.09, d * 0.72, duvet, 1.2);           // duvet
  k.p(b, 0, 0.62, -d / 2 + 0.32, w * 0.42, 0.13, 0.44, pillow, 0.6);
  k.p(b, -w * 0.25, 0.62, -d / 2 + 0.32, w * 0.42, 0.13, 0.44, pillow, 0.6);
  k.p(b, w * 0.25, 0.62, -d / 2 + 0.32, w * 0.42, 0.13, 0.44, pillow, 0.6);
  k.p(b, 0, 0.75, -d / 2 - 0.06, w + 0.2, 1.5, 0.1, frame, 1.2);  // headboard
  k.pc(b, 0, 0.35, 0, w + 0.2, 0.7, d + 0.2);
  return b;
}

export function bunkBed(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const frame = M.get('steel');
  for (const h of [0.5, 1.85]) {
    k.p(b, 0, h, 0, 1.05, 0.14, 2.0, M.paint(0xf2efe8, 0.94), 1);
    k.p(b, 0, h + 0.12, 0.1, 1.0, 0.08, 1.5, M.paint(0xa8c4e0, 0.95), 1);
  }
  for (const ox of [-0.5, 0.5]) for (const oz of [-0.95, 0.95]) k.p(b, ox, 1.2, oz, 0.07, 2.4, 0.07, frame, 1);
  k.p(b, 0.55, 1.4, 0, 0.05, 1.4, 1.9, frame, 1);
  k.pc(b, 0, 1.2, 0, 1.2, 2.4, 2.1);
  return b;
}

// ── casegoods ──────────────────────────────────────────────────────────────
export function nightstand(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  k.p(b, 0, 0.28, 0, 0.55, 0.56, 0.45, M.get('walnut'), 0.7);
  k.p(b, 0, 0.4, 0.23, 0.48, 0.16, 0.02, M.paint(0xd8d2c6, 0.5), 0.4);
  k.p(b, 0, 0.18, 0.23, 0.48, 0.16, 0.02, M.paint(0xd8d2c6, 0.5), 0.4);
  k.p(b, 0, 0.4, 0.25, 0.1, 0.02, 0.03, M.get('gold'), 0.3);
  k.pc(b, 0, 0.28, 0, 0.6, 0.6, 0.5);
  if (o.lamp !== false) tableLamp(k, ...k.L(0, 0, x, z, b.r), y + 0.56, { rotY: b.r });
  return b;
}

export function tableLamp(k, x, z, y, o = {}) {
  const M = k.M;
  k.box(0.09, 0.28, 0.09, M.get('gold'), x, y + 0.14, z, { tile: 0.3 });
  k.box(0.3, 0.26, 0.3, M.emissive(0xffe0b0, 0.9), x, y + 0.42, z, { tile: 0.4 });
  k.world.addLight({ pos: new THREE.Vector3(x, y + 0.42, z), color: 0xffd39a, intensity: 6, distance: 6.5, lamp: true });
}

export function dresser(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w || 1.8;
  k.p(b, 0, 0.45, 0, w, 0.9, 0.52, M.get('walnut'), 0.9);
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
    k.p(b, s * w * 0.24, 0.2 + i * 0.27, 0.27, w * 0.44, 0.22, 0.02, M.paint(0xe2dccf, 0.5), 0.4);
    k.p(b, s * w * 0.24, 0.2 + i * 0.27, 0.29, 0.16, 0.02, 0.03, M.get('gold'), 0.3);
  }
  k.pc(b, 0, 0.45, 0, w, 0.9, 0.55);
  return b;
}

export function wardrobe(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w || 1.6, h = o.h || 2.3;
  k.p(b, 0, h / 2, 0, w, h, 0.62, M.get('walnut'), 1);
  for (const s of [-1, 1]) k.p(b, s * w * 0.25, h / 2, 0.32, w * 0.46, h - 0.1, 0.02, M.paint(0xefe9dd, 0.45), 0.6);
  for (const s of [-1, 1]) k.p(b, s * 0.06, h / 2, 0.35, 0.03, 0.4, 0.03, M.get('gold'), 0.3);
  k.pc(b, 0, h / 2, 0, w, h, 0.65);
  return b;
}

export function bookshelf(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w || 1.8, h = o.h || 2.4, rng = k.rng;
  k.p(b, 0, h / 2, -0.16, w, h, 0.04, M.get('walnut'), 1);
  for (const s of [-1, 1]) k.p(b, s * w / 2, h / 2, 0, 0.05, h, 0.34, M.get('walnut'), 1);
  const shelves = Math.max(3, Math.round(h / 0.42));
  for (let i = 0; i <= shelves; i++) {
    const sy = (i / shelves) * (h - 0.06) + 0.03;
    k.p(b, 0, sy, 0, w, 0.04, 0.34, M.get('walnut'), 1);
    if (i === shelves) continue;
    // books
    let ox = -w / 2 + 0.06;
    while (ox < w / 2 - 0.1) {
      const bw = rng.range(0.03, 0.075), bh = rng.range(0.22, 0.34);
      const hue = rng.pick([0x8c3b3b, 0x2f4f6b, 0x3f5c3a, 0x6b5330, 0x4a3355, 0x2b2b2b, 0xa8895b]);
      if (rng.chance(0.86)) k.p(b, ox + bw / 2, sy + 0.02 + bh / 2, 0.02, bw, bh, rng.range(0.2, 0.28), k.M.solid(hue, 0.7), 0.3);
      ox += bw + 0.006;
    }
  }
  k.pc(b, 0, h / 2, 0, w, h, 0.38);
  return b;
}

export function desk(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w || 1.6, d = o.d || 0.7;
  k.p(b, 0, 0.74, 0, w, 0.05, d, o.top || M.get('walnut'), 0.9);
  for (const s of [-1, 1]) k.p(b, s * (w / 2 - 0.06), 0.37, 0, 0.06, 0.74, d - 0.08, M.get('blackMetal'), 0.6);
  k.pc(b, 0, 0.4, 0, w, 0.78, d);
  return b;
}

export function officeChair(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const c = o.color !== undefined ? M.solid(o.color, 0.6) : M.get('leather');
  k.p(b, 0, 0.45, 0, 0.55, 0.09, 0.52, c, 0.5);
  k.p(b, 0, 0.78, -0.24, 0.5, 0.66, 0.09, c, 0.5);
  for (const s of [-1, 1]) k.p(b, s * 0.3, 0.63, 0, 0.07, 0.06, 0.36, M.get('darkPlastic'), 0.4);
  k.p(b, 0, 0.25, 0, 0.07, 0.34, 0.07, M.get('chrome'), 0.3);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    k.p(b, Math.cos(a) * 0.22, 0.06, Math.sin(a) * 0.22, 0.3, 0.05, 0.07, M.get('darkPlastic'), 0.3);
  }
  k.pc(b, 0, 0.4, 0, 0.6, 0.9, 0.6);
  return b;
}

export function diningChair(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const wood = M.get('walnut'), pad = M.get('fabric');
  k.p(b, 0, 0.45, 0, 0.46, 0.06, 0.46, wood, 0.5);
  k.p(b, 0, 0.5, 0, 0.42, 0.06, 0.42, pad, 0.5);
  k.p(b, 0, 0.78, -0.21, 0.44, 0.62, 0.05, wood, 0.5);
  for (const [ox, oz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]])
    k.p(b, ox, 0.22, oz, 0.05, 0.44, 0.05, wood, 0.4);
  k.pc(b, 0, 0.4, 0, 0.5, 0.8, 0.5);
  return b;
}

// ── seating ────────────────────────────────────────────────────────────────
export function sofa(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w || 2.4, d = o.d || 0.95;
  const up = o.color !== undefined ? M.solid(o.color, 0.9) : M.get('fabric');
  k.p(b, 0, 0.22, 0, w, 0.3, d, up, 1);
  k.p(b, 0, 0.45, 0.02, w - 0.34, 0.18, d - 0.28, M.paint(o.cushion ?? 0xe8e4db, 0.95), 0.8);
  k.p(b, 0, 0.62, -d / 2 + 0.14, w, 0.66, 0.28, up, 1);
  for (const s of [-1, 1]) k.p(b, s * (w / 2 - 0.13), 0.5, 0, 0.26, 0.5, d, up, 1);
  for (const [ox, oz] of [[-w / 2 + 0.16, -d / 2 + 0.14], [w / 2 - 0.16, -d / 2 + 0.14], [-w / 2 + 0.16, d / 2 - 0.14], [w / 2 - 0.16, d / 2 - 0.14]])
    k.p(b, ox, 0.05, oz, 0.07, 0.12, 0.07, M.get('walnut'), 0.3);
  // throw pillows
  for (const s of [-1, 1]) k.p(b, s * (w / 2 - 0.45), 0.62, -d / 2 + 0.3, 0.4, 0.4, 0.14, M.paint(o.pillow ?? 0xb5c4cf, 0.95), 0.5);
  k.pc(b, 0, 0.42, 0, w, 0.85, d);
  k.world.addInteract({
    pos: new THREE.Vector3(x, y + 0.5, z), radius: 2.0, label: 'Sit down',
    kind: 'seat', seat: { x, y: y + 0.52, z, rotY: b.r },
  });
  return b;
}

export function sectional(k, x, y, z, o = {}) {
  const r = o.rotY || 0;
  sofa(k, x, y, z, { ...o, w: o.w || 3.4, rotY: r });
  const [ax, az] = k.L((o.w || 3.4) / 2 - 0.5, 1.4, x, z, r);
  sofa(k, ax, y, az, { ...o, w: 2.4, rotY: r + Math.PI / 2 });
}

export function armchair(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const up = o.color !== undefined ? M.solid(o.color, 0.85) : M.get('leather');
  k.p(b, 0, 0.22, 0, 0.95, 0.3, 0.9, up, 0.8);
  k.p(b, 0, 0.45, 0.02, 0.66, 0.16, 0.66, M.paint(0xe6e1d6, 0.95), 0.6);
  k.p(b, 0, 0.66, -0.36, 0.95, 0.76, 0.2, up, 0.8);
  for (const s of [-1, 1]) k.p(b, s * 0.38, 0.5, 0, 0.2, 0.5, 0.9, up, 0.8);
  k.pc(b, 0, 0.45, 0, 1.0, 0.9, 0.95);
  k.world.addInteract({
    pos: new THREE.Vector3(x, y + 0.5, z), radius: 1.8, label: 'Sit down',
    kind: 'seat', seat: { x, y: y + 0.52, z, rotY: b.r },
  });
  return b;
}

export function coffeeTable(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w || 1.3, d = o.d || 0.7;
  k.p(b, 0, 0.4, 0, w, 0.06, d, o.top || M.get('walnut'), 0.7);
  k.p(b, 0, 0.16, 0, w - 0.3, 0.04, d - 0.2, M.get('walnut'), 0.7);
  for (const [ox, oz] of [[-w / 2 + 0.1, -d / 2 + 0.1], [w / 2 - 0.1, -d / 2 + 0.1], [-w / 2 + 0.1, d / 2 - 0.1], [w / 2 - 0.1, d / 2 - 0.1]])
    k.p(b, ox, 0.2, oz, 0.07, 0.4, 0.07, M.get('blackMetal'), 0.3);
  k.pc(b, 0, 0.22, 0, w, 0.45, d);
  return b;
}

export function rug(k, x, y, z, w, d, color, rotY = 0) {
  const M = k.M;
  k.box(w, 0.018, d, M.paint(color, 0.97, `rug${color}`), x, y + 0.055, z, { rotY, tile: 1.2 });
  k.box(w - 0.3, 0.02, d - 0.3, M.paint(shade(color, 1.12), 0.97, `rugi${color}`), x, y + 0.058, z, { rotY, tile: 1.2 });
}
function shade(c, f) {
  const r = Math.min(255, ((c >> 16) & 255) * f) | 0, g = Math.min(255, ((c >> 8) & 255) * f) | 0, b2 = Math.min(255, (c & 255) * f) | 0;
  return (r << 16) | (g << 8) | b2;
}

// ── screens ────────────────────────────────────────────────────────────────
export function tv(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w || 1.9, h = w * 0.56;
  k.p(b, 0, o.h ?? 1.5, 0, w + 0.06, h + 0.06, 0.05, M.get('blackMetal'), 0.5);
  const screenMat = M.get('screenOff').clone();
  screenMat.name = 'screen';
  const [sx, sz] = k.L(0, 0.04, x, z, b.r);
  const scr = boxMesh(w, h, 0.012, screenMat, sx, y + (o.h ?? 1.5), sz, { rotY: b.r, cast: false });
  k.world.addProp(scr);
  const screen = { mesh: scr, mat: screenMat, on: false, kind: o.kind || 'tv' };
  k.world.screens.push(screen);
  k.world.addInteract({
    pos: new THREE.Vector3(x, y + (o.h ?? 1.5), z), radius: 2.8,
    label: () => (screen.on ? 'Turn off TV' : 'Turn on TV'),
    kind: 'screen', data: screen,
    onUse: () => { screen.on = !screen.on; return screen.on ? 'tvon' : 'click'; },
  });
  if (!o.wall) {
    k.p(b, 0, (o.h ?? 1.5) - h / 2 - 0.2, 0, 0.4, 0.4, 0.24, M.get('blackMetal'), 0.4);
  }
  return screen;
}

export function tvUnit(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w || 2.4;
  k.p(b, 0, 0.28, 0, w, 0.56, 0.45, M.get('walnut'), 0.9);
  k.p(b, 0, 0.3, 0.23, w - 0.2, 0.3, 0.02, M.get('darkPlastic'), 0.4);
  k.pc(b, 0, 0.28, 0, w, 0.6, 0.5);
}

// ── fireplaces ─────────────────────────────────────────────────────────────
export function fireplace(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w || 3.0, h = o.h || 3.4;
  const stone = o.stone || M.get('stone');
  k.p(b, 0, h / 2, -0.2, w, h, 0.5, stone, 1.6);
  k.p(b, 0, 0.55, 0.02, w * 0.52, 1.0, 0.28, M.get('blackMetal'), 0.6);      // firebox surround
  k.p(b, 0, 1.35, 0.12, w * 0.86, 0.14, 0.42, M.get('walnut'), 0.8);          // mantel
  k.p(b, 0, 0.1, 0.3, w, 0.14, 0.9, stone, 1.2);                             // hearth
  k.pc(b, 0, h / 2, -0.1, w, h, 0.7);

  // fire
  const grp = new THREE.Group();
  const [fx, fz] = k.L(0, 0.03, x, z, b.r);
  grp.position.set(fx, y + 0.18, fz);
  grp.rotation.y = b.r;
  const logMat = M.solid(0x3a2a1c, 0.95);
  for (let i = 0; i < 4; i++) {
    const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.8, 7), logMat);
    lg.rotation.set(0, i * 0.5, Math.PI / 2 + (i % 2 ? 0.1 : -0.1));
    lg.position.set((i - 1.5) * 0.1, 0.06 + (i % 2) * 0.08, 0);
    grp.add(lg);
  }
  const flames = [];
  for (let i = 0; i < 9; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.5, 6),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffab3c : 0xff6a1e, transparent: true, opacity: 0.75, depthWrite: false }));
    f.position.set((k.rng() - 0.5) * 0.6, 0.28, (k.rng() - 0.5) * 0.16);
    grp.add(f); flames.push(f);
  }
  const light = new THREE.PointLight(0xff8330, 0, 9, 2);
  light.position.set(0, 0.6, 0.2);
  grp.add(light);
  k.world.addProp(grp);

  const fire = { on: o.lit === true, grp, flames, light };
  grp.visible = fire.on;
  k.world.onUpdate((dt, t) => {
    if (!fire.on) return;
    for (let i = 0; i < flames.length; i++) {
      const f = flames[i];
      const s = 0.7 + Math.abs(Math.sin(t * (3 + i * 0.7) + i)) * 0.7;
      f.scale.set(0.8 + s * 0.3, s, 0.8 + s * 0.3);
      f.material.opacity = 0.45 + s * 0.35;
    }
    light.intensity = 5.5 + Math.sin(t * 9.3) * 1.4 + Math.sin(t * 4.1) * 1.0;
  });
  k.world.addInteract({
    pos: new THREE.Vector3(x, y + 0.9, z), radius: 2.4, kind: 'fire', data: fire,
    label: () => (fire.on ? 'Put out the fire' : 'Light the fire'),
    onUse: () => { fire.on = !fire.on; grp.visible = fire.on; return fire.on ? 'fire' : 'click'; },
  });
  return fire;
}

// ── kitchen ────────────────────────────────────────────────────────────────
export function counterRun(k, x, y, z, len, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const cab = M.paint(o.cabinet ?? 0x2f3a42, 0.5, 'cab');
  k.p(b, 0, 0.44, 0, len, 0.88, 0.62, cab, 0.9);
  k.p(b, 0, 0.9, 0, len, 0.05, 0.66, M.get('marble'), 1.2);
  const doors = Math.max(2, Math.round(len / 0.62));
  for (let i = 0; i < doors; i++) {
    const ox = -len / 2 + (i + 0.5) * (len / doors);
    k.p(b, ox, 0.46, 0.32, len / doors - 0.03, 0.76, 0.02, M.paint(shade(o.cabinet ?? 0x2f3a42, 1.1), 0.45), 0.5);
    k.p(b, ox, 0.76, 0.34, 0.24, 0.02, 0.03, M.get('chrome'), 0.2);
  }
  if (o.upper !== false) {
    k.p(b, 0, 1.95, -0.16, len, 0.9, 0.35, cab, 0.9);
    for (let i = 0; i < doors; i++) {
      const ox = -len / 2 + (i + 0.5) * (len / doors);
      k.p(b, ox, 1.95, 0.02, len / doors - 0.03, 0.84, 0.02, M.paint(shade(o.cabinet ?? 0x2f3a42, 1.1), 0.45), 0.5);
    }
  }
  k.p(b, 0, 1.25, -0.2, len, 0.6, 0.03, M.get('tile'), 0.5);   // backsplash
  k.pc(b, 0, 0.45, 0, len, 0.92, 0.66);
}

export function island(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w || 3.6, d = o.d || 1.3;
  k.p(b, 0, 0.44, 0, w, 0.88, d, M.paint(0x27303a, 0.5, 'island'), 1);
  k.p(b, 0, 0.92, 0, w + 0.24, 0.06, d + 0.24, M.get('marble'), 1.4);
  k.p(b, 0, 0.94, -0.15, 0.8, 0.03, 0.45, M.get('chrome'), 0.4);         // sink
  k.p(b, 0, 1.1, -0.32, 0.05, 0.34, 0.05, M.get('chrome'), 0.2);         // tap
  k.p(b, 0, 1.26, -0.24, 0.05, 0.04, 0.2, M.get('chrome'), 0.2);
  k.pc(b, 0, 0.46, 0, w + 0.24, 0.98, d + 0.24);
  for (let i = 0; i < 3; i++) barstool(k, ...k.L(-w / 3 + i * (w / 3), d / 2 + 0.55, x, z, b.r), y, { rotY: b.r });
  // pendant lights
  for (let i = 0; i < 3; i++) {
    const [px, pz] = k.L(-w / 3 + i * (w / 3), 0, x, z, b.r);
    k.box(0.02, 1.0, 0.02, M.get('blackMetal'), px, y + 3.1, pz, { tile: 0.2 });
    k.box(0.3, 0.26, 0.3, M.get('gold'), px, y + 2.5, pz, { tile: 0.3 });
    k.box(0.24, 0.05, 0.24, M.emissive(0xffe2b4, 2.4), px, y + 2.37, pz, { tile: 0.2 });
    k.world.addLight({ pos: new THREE.Vector3(px, y + 2.3, pz), color: 0xffd7a0, intensity: 9, distance: 7, lamp: true });
  }
}

export function barstool(k, x, z, y, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  k.p(b, 0, 0.68, 0, 0.36, 0.07, 0.36, M.get('leather'), 0.4);
  k.p(b, 0, 0.34, 0, 0.06, 0.68, 0.06, M.get('chrome'), 0.3);
  k.p(b, 0, 0.03, 0, 0.34, 0.05, 0.34, M.get('chrome'), 0.3);
  k.p(b, 0, 0.24, 0, 0.3, 0.03, 0.03, M.get('chrome'), 0.2);
  k.pc(b, 0, 0.4, 0, 0.4, 0.8, 0.4);
  k.world.addInteract({ pos: new THREE.Vector3(x, y + 0.7, z), radius: 1.4, label: 'Sit down', kind: 'seat', seat: { x, y: y + 0.7, z, rotY: b.r } });
}

export function fridge(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  k.p(b, 0, 1.05, 0, 1.1, 2.1, 0.72, M.get('steel'), 1);
  for (const s of [-1, 1]) {
    k.p(b, s * 0.27, 1.05, 0.37, 0.52, 2.02, 0.03, M.get('steel'), 0.8);
    k.p(b, s * 0.06, 1.3, 0.4, 0.04, 1.0, 0.05, M.get('chrome'), 0.2);
  }
  k.pc(b, 0, 1.05, 0, 1.15, 2.1, 0.75);
}

export function range(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  k.p(b, 0, 0.45, 0, 1.1, 0.9, 0.65, M.get('steel'), 0.8);
  k.p(b, 0, 0.91, 0, 1.1, 0.03, 0.65, M.get('blackMetal'), 0.6);
  for (const ox of [-0.3, 0.0, 0.3]) for (const oz of [-0.16, 0.16])
    k.p(b, ox, 0.94, oz, 0.2, 0.02, 0.2, M.get('darkPlastic'), 0.2);
  k.p(b, 0, 0.5, 0.34, 0.9, 0.5, 0.02, M.get('carGlass'), 0.4);
  k.p(b, 0, 2.0, -0.06, 1.2, 0.7, 0.55, M.get('steel'), 0.8);              // hood
  k.pc(b, 0, 0.45, 0, 1.1, 0.95, 0.68);
}

// ── bathroom ───────────────────────────────────────────────────────────────
export function vanity(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w || 1.5;
  k.p(b, 0, 0.42, 0, w, 0.84, 0.55, M.paint(0x3d4a52, 0.5, 'vanity'), 0.8);
  k.p(b, 0, 0.87, 0, w + 0.06, 0.06, 0.58, M.get('marble'), 1);
  k.p(b, 0, 0.9, 0, 0.44, 0.04, 0.34, M.get('tile'), 0.4);
  k.p(b, 0, 1.06, -0.18, 0.04, 0.3, 0.04, M.get('chrome'), 0.2);
  k.p(b, 0, 1.2, -0.08, 0.04, 0.04, 0.2, M.get('chrome'), 0.2);
  k.p(b, 0, 1.75, -0.26, w - 0.1, 1.2, 0.03, M.get('mirror'), 1);
  k.p(b, 0, 2.42, -0.2, w - 0.4, 0.06, 0.14, M.emissive(0xf6f9ff, 1.8), 0.4);
  k.pc(b, 0, 0.45, 0, w, 0.9, 0.6);
  k.world.addLight({ pos: new THREE.Vector3(x, y + 2.3, z), color: 0xf2f6ff, intensity: 7, distance: 6, lamp: true });
}

export function toilet(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const p = M.paint(0xfbfcfd, 0.28, 'porcelain');
  k.p(b, 0, 0.2, 0.05, 0.38, 0.4, 0.55, p, 0.4);
  k.p(b, 0, 0.42, 0.08, 0.42, 0.06, 0.6, p, 0.4);
  k.p(b, 0, 0.5, -0.24, 0.44, 0.62, 0.2, p, 0.4);
  k.pc(b, 0, 0.35, 0, 0.5, 0.8, 0.7);
}

export function bathtub(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const p = M.paint(0xfbfcfd, 0.22, 'porcelain');
  k.p(b, 0, 0.3, 0, 1.9, 0.6, 0.9, p, 0.8);
  k.p(b, 0, 0.56, 0, 1.7, 0.1, 0.72, M.get('water'), 0.8);
  k.p(b, -0.85, 0.72, 0, 0.05, 0.3, 0.05, M.get('chrome'), 0.2);
  k.pc(b, 0, 0.3, 0, 1.9, 0.6, 0.9);
}

export function shower(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w || 1.4, d = o.d || 1.2;
  k.p(b, 0, 0.06, 0, w, 0.12, d, M.get('tile'), 0.5);
  k.p(b, 0, 1.2, -d / 2, w, 2.4, 0.04, M.get('tile'), 0.8);
  k.p(b, -w / 2, 1.2, 0, 0.04, 2.4, d, M.get('glass'), 0.8);
  k.p(b, 0, 1.2, d / 2, w, 2.4, 0.03, M.get('glass'), 0.8);
  k.p(b, 0, 2.1, -d / 2 + 0.2, 0.22, 0.04, 0.22, M.get('chrome'), 0.2);
  k.pc(b, 0, 1.2, 0, w, 2.4, d);
}

// ── misc dressing ──────────────────────────────────────────────────────────
export function plant(k, x, y, z, scale = 1) {
  const M = k.M, rng = k.rng;
  k.box(0.4 * scale, 0.42 * scale, 0.4 * scale, M.paint(0x9a8b78, 0.8, 'pot'), x, y + 0.21 * scale, z, { tile: 0.3 });
  const g = new THREE.Group();
  g.position.set(x, y + 0.42 * scale, z);
  for (let i = 0; i < 14; i++) {
    const a = rng() * Math.PI * 2, tilt = rng.range(0.2, 0.9);
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.14 * scale, 0.75 * scale), k.M.get('foliage'));
    leaf.position.set(Math.cos(a) * 0.1 * scale, 0.32 * scale, Math.sin(a) * 0.1 * scale);
    leaf.rotation.set(tilt * (rng() - 0.5), a, tilt);
    g.add(leaf);
  }
  k.world.addProp(g);
}

export function artwork(k, x, y, z, w, h, rotY, color) {
  const M = k.M;
  k.box(w + 0.08, h + 0.08, 0.05, M.get('gold'), x, y, z, { rotY, tile: 0.4 });
  // canvas sits proud of the frame along its facing normal, whatever rotY is.
  // No `tile` here: the default 0..1 box UVs map the painted canvas edge to
  // edge, where world-projected UVs would crop it arbitrarily.
  k.box(w, h, 0.02, artMaterial(M, color, x, y, z), x + 0.045 * Math.sin(rotY), y, z + 0.045 * Math.cos(rotY), { rotY });
}

/**
 * Tiny procedural abstract — a few layered gradient bands and soft blob
 * strokes on a 128px canvas, seeded from the hanging spot so every picture in
 * the house is different but stable between loads.
 */
function artMaterial(M, color, x, y, z) {
  const seed = ((Math.round((x + 512) * 8) * 73856093) ^ (Math.round((z + 512) * 8) * 19349663) ^ (Math.round((y + 64) * 4) * 83492791) ^ color) >>> 0;
  const key = `artcv:${color}:${seed}`;
  if (M.cache.has(key)) return M.cache.get(key);
  const rng = makeRng(seed);
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 96;
  const ctx = cv.getContext('2d');
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(color).getHSL(hsl);
  const css = (dh, ds, dl, a = 1) => {
    const hh = (((hsl.h + dh) % 1) + 1) % 1;
    const ss = Math.min(1, Math.max(0, hsl.s + ds));
    const ll = Math.min(0.92, Math.max(0.08, hsl.l + dl));
    return `hsla(${(hh * 360).toFixed(0)},${(ss * 100).toFixed(0)}%,${(ll * 100).toFixed(0)}%,${a})`;
  };
  // 2-3 horizontal gradient bands
  const bands = rng.int(2, 3);
  let y0 = 0;
  for (let i = 0; i < bands; i++) {
    const y1 = i === bands - 1 ? 96 : Math.min(88, y0 + rng.range(20, 96 / bands + 16));
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, css(rng.range(-0.05, 0.05), rng.range(-0.1, 0.1), rng.range(0.06, 0.3)));
    g.addColorStop(1, css(rng.range(-0.08, 0.08), rng.range(-0.05, 0.15), rng.range(-0.18, 0.06)));
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, 128, Math.ceil(y1 - y0) + 1);
    y0 = y1;
  }
  // soft blob strokes over the bands
  for (let i = 0, n = rng.int(3, 5); i < n; i++) {
    const bx = rng.range(14, 114), by = rng.range(12, 84), r = rng.range(9, 26);
    const g = ctx.createRadialGradient(bx, by, r * 0.15, bx, by, r);
    g.addColorStop(0, css(rng.range(-0.14, 0.14), rng.range(0, 0.2), rng.range(-0.1, 0.28), rng.range(0.4, 0.75)));
    g.addColorStop(1, css(0, 0, 0, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(bx, by, r * rng.range(0.8, 1.6), r, rng.range(0, Math.PI), 0, Math.PI * 2);
    ctx.fill();
  }
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0 });
  m.name = key;
  M.cache.set(key, m);
  M.all.push(m);
  return m;
}

export function curtains(k, x, y, z, w, rotY, color = 0xb9ada0) {
  const M = k.M;
  for (const s of [-1, 1]) {
    k.box(w * 0.3, 2.5, 0.1, M.paint(color, 0.96, `cur${color}`), x + Math.cos(rotY) * s * (w / 2 - w * 0.15), y + 1.9, z - Math.sin(rotY) * s * (w / 2 - w * 0.15), { rotY, tile: 1 });
  }
  k.box(w + 0.4, 0.05, 0.05, M.get('blackMetal'), x, y + 3.15, z, { rotY, tile: 0.3 });
}
