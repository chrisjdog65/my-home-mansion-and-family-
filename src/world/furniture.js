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

// ── moving parts ───────────────────────────────────────────────────────────
/**
 * Every drawer, cabinet door and curtain in the house animates off ONE
 * updater per world.  A closure per panel would put a few hundred callbacks
 * in the frame loop, almost all of them doing nothing; a part here sleeps the
 * moment it reaches its target.  `t` runs 0 (shut) → 1 (open).
 */
export function movingPart(world, apply, speed = 2.6) {
  let list = world.movingParts;
  if (!list) {
    list = world.movingParts = [];
    world.onUpdate((dt) => {
      for (const m of list) {
        if (m.t === m.target) continue;
        const d = m.target - m.t;
        m.t += Math.sign(d) * Math.min(Math.abs(d), dt * m.speed);
        m.apply(m.t);
      }
    });
  }
  const part = {
    t: 0, target: 0, speed, apply,
    toggle() { this.target = this.target ? 0 : 1; return this.target; },
  };
  list.push(part);
  return part;
}

/**
 * A drawer that really pulls out.  The front is a prop — the static batch is
 * merged and can't move — and the box behind it is three thin boards, which
 * is all you ever see of it.
 */
export function drawer(k, x, y, z, o = {}) {
  const M = k.M, r = o.rotY || 0, rng = k.rng;
  const w = o.w ?? 0.48, h = o.h ?? 0.18, out = o.out ?? 0.3;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = r;
  g.add(boxMesh(w, h, 0.025, o.face || M.paint(0xe2dccf, 0.5), 0, 0, 0, { tile: 0.4, cast: false }));
  g.add(boxMesh(w * 0.34, 0.02, 0.03, M.get('gold'), 0, 0, 0.025, { cast: false }));
  g.add(boxMesh(w - 0.05, 0.014, out, M.get('maple'), 0, -h / 2 + 0.02, -out / 2 - 0.03, { tile: 0.3, cast: false }));
  // something inside, so pulling it open is worth doing once
  for (let i = 0, n = rng.int(1, 2); i < n; i++) {
    const iw = rng.range(0.06, 0.16), ih = rng.range(0.03, 0.06);
    g.add(boxMesh(iw, ih, rng.range(0.08, 0.18), M.solid(rng.pick([0x8c3b3b, 0x2f4f6b, 0x6b5330, 0xa8895b, 0x3f5c3a]), 0.75),
      rng.range(-w / 2 + 0.1, w / 2 - 0.1), -h / 2 + 0.03 + ih / 2, -out * rng.range(0.25, 0.7), { cast: false }));
  }
  k.world.addProp(g);
  const part = movingPart(k.world, (t) => {
    g.position.set(x + Math.sin(r) * t * out, y, z + Math.cos(r) * t * out);
  }, 3.2);
  if (o.interact !== false) {
    k.world.addInteract({
      pos: new THREE.Vector3(x + Math.sin(r) * 0.12, y, z + Math.cos(r) * 0.12), radius: o.radius ?? 1.5,
      label: () => (part.target ? 'Close the drawer' : (o.label || 'Open the drawer')),
      onUse: () => { part.toggle(); return o.sound || 'creak'; },
    });
  }
  return part;
}

/**
 * A hinged panel — cabinet door, wardrobe leaf, fridge door.  `side` is which
 * edge the hinge is on (-1 = the panel's own -x edge), and the leaf always
 * swings out of the carcass, never through it.
 */
export function hingePanel(k, x, y, z, o = {}) {
  const M = k.M, r = o.rotY || 0, side = o.side ?? -1;
  const w = o.w ?? 0.5, h = o.h ?? 1.2, swing = o.swing ?? 1.85;
  const g = new THREE.Group();
  g.position.set(x + Math.cos(r) * side * w / 2, y, z - Math.sin(r) * side * w / 2);
  g.rotation.y = r;
  g.add(boxMesh(w, h, o.t ?? 0.035, o.face || M.paint(0xefe9dd, 0.45), -side * w / 2, 0, 0, { tile: 0.5, cast: false }));
  if (o.handle !== false) {
    g.add(boxMesh(0.03, o.handleH ?? Math.min(0.5, h * 0.34), 0.03, o.handleMat || M.get('gold'),
      -side * (w - 0.09), o.handleY ?? 0, 0.035, { cast: false }));
  }
  k.world.addProp(g);
  const part = movingPart(k.world, (t) => { g.rotation.y = r + t * swing * side; }, o.speed ?? 2.4);
  if (o.label) {
    k.world.addInteract({
      pos: new THREE.Vector3(x + Math.sin(r) * 0.1, y, z + Math.cos(r) * 0.1), radius: o.radius ?? 1.8,
      label: () => (part.target ? (o.closeLabel || 'Close it') : o.label),
      onUse: () => { part.toggle(); return o.sound || 'latch'; },
    });
  }
  return part;
}

/** One handle for several panels — a wardrobe or a fridge opens as a unit. */
export function openTogether(k, parts, x, y, z, o = {}) {
  k.world.addInteract({
    pos: new THREE.Vector3(x, y, z), radius: o.radius ?? 2.0,
    label: () => (parts[0].target ? (o.close || 'Close it') : (o.open || 'Open it')),
    onUse: () => {
      const t = parts[0].target ? 0 : 1;
      for (const p of parts) p.target = t;
      if (o.onToggle) o.onToggle(!!t);
      return o.sound || 'latch';
    },
  });
}

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
  // a throw folded over the foot and scatter cushions against the pillows —
  // an unbroken duvet slab is what made every bed in the house read as unused
  const thr = M.paint(o.throw ?? 0xb5a181, 0.96, 'bedthrow');
  k.p(b, 0, 0.6, d / 2 - 0.42, w + 0.04, 0.05, 0.5, thr, 0.6);
  k.p(b, 0, 0.48, d / 2 - 0.2, w + 0.04, 0.22, 0.06, thr, 0.5);
  for (const s of [-1, 1]) {
    k.p(b, s * w * 0.27, 0.72, -d / 2 + 0.52, 0.32, 0.32, 0.12, M.paint(o.cushion ?? 0x9aa8b4, 0.95, 'bedcushion'), 0.4);
  }
  k.pc(b, 0, 0.35, 0, w + 0.2, 0.7, d + 0.2);
  // You can lie on it.  Standing up steps you the way you are facing, and the
  // bed is boxed in on three sides — nightstands at the head, a bench at the
  // foot — so the seat goes in the foot corner and faces off the open side.
  const [sx, sz] = k.L(w / 2 - 0.3, d / 2 - 0.35, x, z, b.r);
  k.world.addInteract({
    pos: new THREE.Vector3(sx, y + 0.8, sz), radius: 1.9, label: o.seatLabel || 'Lie down',
    kind: 'seat', seat: { x: sx, y: y + 0.36, z: sz, rotY: b.r + Math.PI / 2 },
  });
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
  // ladder up the foot end, and a soft toy left on the top bunk
  for (let i = 0; i < 4; i++) k.p(b, -0.5, 0.55 + i * 0.42, 0.95, 0.9, 0.05, 0.05, frame, 0.3);
  k.p(b, 0.2, 2.03, 0.3, 0.22, 0.24, 0.2, M.paint(0xd8a05e, 0.95, 'plush'), 0.3);
  k.pc(b, 0, 1.2, 0, 1.2, 2.4, 2.1);
  // the bottom bunk takes you; the top one is a climb the player can't do
  const [sx, sz] = k.L(0, 0.62, x, z, b.r);
  k.world.addInteract({
    pos: new THREE.Vector3(sx, y + 0.9, sz), radius: 1.7, label: 'Climb into the bunk',
    kind: 'seat', seat: { x: sx, y: y + 0.36, z: sz, rotY: b.r },
  });
  return b;
}

// ── casegoods ──────────────────────────────────────────────────────────────
export function nightstand(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  k.p(b, 0, 0.28, 0, 0.55, 0.56, 0.45, M.get('walnut'), 0.7);
  k.p(b, 0, 0.18, 0.23, 0.48, 0.16, 0.02, M.paint(0xd8d2c6, 0.5), 0.4);
  k.pc(b, 0, 0.28, 0, 0.6, 0.6, 0.5);
  // the top drawer opens — the bottom one is a face, nobody opens both
  const [ndx, ndz] = k.L(0, 0.235, x, z, b.r);
  drawer(k, ndx, y + 0.4, ndz, { rotY: b.r, w: 0.48, h: 0.16, out: 0.26, radius: 1.3, face: M.paint(0xd8d2c6, 0.5) });
  if (o.lamp !== false) tableLamp(k, ...k.L(0, 0, x, z, b.r), y + 0.56, { rotY: b.r });
  // a book and a glass of water, because a bare nightstand is a shop display
  if (o.clutter !== false) {
    k.p(b, 0.17, 0.585, 0.02, 0.14, 0.05, 0.2, M.solid(k.rng.pick([0x8c3b3b, 0x2f4f6b, 0x3f5c3a]), 0.7), 0.2);
    k.p(b, -0.18, 0.62, 0.1, 0.07, 0.12, 0.07, M.get('glass'), 0.2);
  }
  return b;
}

export function tableLamp(k, x, z, y, o = {}) {
  const M = k.M;
  k.box(0.09, 0.28, 0.09, M.get('gold'), x, y + 0.14, z, { tile: 0.3 });
  k.box(0.11, 0.05, 0.11, M.get('gold'), x, y + 0.3, z, { tile: 0.2 });
  // a shade is cloth stretched on a taper, not a glowing brick: three stacked
  // rings of real fabric, with the bulb spilling out of the open ends
  const cloth = shadeFabric(M);
  k.box(0.34, 0.1, 0.34, cloth, x, y + 0.35, z, { tile: 0.3 });
  k.box(0.3, 0.09, 0.3, cloth, x, y + 0.44, z, { tile: 0.3 });
  k.box(0.26, 0.09, 0.26, cloth, x, y + 0.53, z, { tile: 0.3 });
  // the bulb is a prop, not batched geometry: switching the lamp off has to
  // put the glow out as well as the light, or the shade keeps burning at night
  const bulb = boxMesh(0.24, 0.3, 0.24, M.emissive(0xffdca8, 1.4), x, y + 0.44, z, { cast: false });
  k.world.addProp(bulb);
  const light = k.world.addLight({ pos: new THREE.Vector3(x, y + 0.42, z), color: 0xffd39a, intensity: 6, distance: 6.5, lamp: true });
  lampSwitch(k, light, bulb, x, y + 0.45, z, 1.4);
  return light;
}

/** Pull-cord shared by every lamp: kills the bulb and the light together. */
export function lampSwitch(k, light, bulb, x, y, z, radius = 1.5) {
  k.world.addInteract({
    pos: new THREE.Vector3(x, y, z), radius,
    label: () => (light.on ? 'Turn off the lamp' : 'Turn on the lamp'),
    onUse: () => { light.on = !light.on; bulb.visible = light.on; return 'click'; },
  });
}

/** Linen with a warm bulb behind it — shared by every shade in the house. */
function shadeFabric(M) {
  const key = 'cloth:lampshade';
  if (M.cache.has(key)) return M.cache.get(key);
  const m = M.get('fabric').clone();
  m.color = new THREE.Color(0xf6e6c8);
  m.emissive = new THREE.Color(0xffcf8a);
  m.emissiveIntensity = 0.5;
  m.roughness = 0.96;
  m.name = key;
  M.cache.set(key, m);
  M.all.push(m);
  return m;
}

export function dresser(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w || 1.8;
  k.p(b, 0, 0.45, 0, w, 0.9, 0.52, M.get('walnut'), 0.9);
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
    if (i === 2 && s === -1) continue;                 // that one really opens
    k.p(b, s * w * 0.24, 0.2 + i * 0.27, 0.27, w * 0.44, 0.22, 0.02, M.paint(0xe2dccf, 0.5), 0.4);
    k.p(b, s * w * 0.24, 0.2 + i * 0.27, 0.29, 0.16, 0.02, 0.03, M.get('gold'), 0.3);
  }
  const [dx, dz] = k.L(-w * 0.24, 0.28, x, z, b.r);
  drawer(k, dx, y + 0.74, dz, { rotY: b.r, w: w * 0.44, h: 0.22, out: 0.34 });
  k.pc(b, 0, 0.45, 0, w, 0.9, 0.55);
  return b;
}

export function wardrobe(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w || 1.6, h = o.h || 2.3;
  k.p(b, 0, h / 2, 0, w, h, 0.62, M.get('walnut'), 1);
  // hanging rail and a row of shirts, seen once the leaves swing back
  k.p(b, 0, h - 0.35, 0, w - 0.12, 0.04, 0.04, M.get('chrome'), 0.3);
  for (let i = 0; i < 7; i++) {
    k.p(b, -w / 2 + 0.16 + i * ((w - 0.32) / 6), h - 0.75, 0.02, 0.1, 0.66, 0.3,
      M.paint(k.rng.pick([0x2f6fb5, 0x8a5b3a, 0x6b7a54]), 0.9, 'coat'), 0.4);
  }
  const leaves = [];
  for (const s of [-1, 1]) {
    const [lx, lz] = k.L(s * w * 0.25, 0.32, x, z, b.r);
    leaves.push(hingePanel(k, lx, y + h / 2, lz, {
      rotY: b.r, w: w * 0.46, h: h - 0.1, side: s, face: M.paint(0xefe9dd, 0.45), handleY: -h * 0.05,
    }));
  }
  const [hx, hz] = k.L(0, 0.4, x, z, b.r);
  openTogether(k, leaves, hx, y + 1.2, hz, { open: 'Open the wardrobe', close: 'Close the wardrobe', radius: 1.9 });
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
    // books: spines of every height, the odd leaner and a flat stack, because
    // nobody's shelf is a solid wall of identical blocks
    const hues = [0x8c3b3b, 0x2f4f6b, 0x3f5c3a, 0x6b5330, 0x4a3355, 0x2b2b2b, 0xa8895b];
    let ox = -w / 2 + 0.06;
    while (ox < w / 2 - 0.1) {
      const bw = rng.range(0.03, 0.075), bh = rng.range(0.22, 0.34);
      const dep = rng.range(0.2, 0.28);
      const mat = k.M.solid(rng.pick(hues), 0.7);
      if (rng.chance(0.07) && ox < w / 2 - 0.32) {
        const sw = rng.range(0.15, 0.22);                 // a stack laid flat
        for (let s = 0, n = rng.int(2, 3); s < n; s++) {
          k.p(b, ox + sw / 2, sy + 0.045 + s * 0.05, 0.02, sw, 0.045, rng.range(0.2, 0.26),
            k.M.solid(rng.pick(hues), 0.7), 0.3);
        }
        ox += sw + 0.03;
        continue;
      }
      if (rng.chance(0.86)) {
        if (rng.chance(0.1)) {                            // a leaner
          const [wx, wz] = k.L(ox + bw / 2, 0.02, b.x, b.z, b.r);
          k.B.box(bw, bh, dep, mat, wx, b.y + sy + 0.028 + bh / 2, wz, { rotY: b.r, rotZ: 0.17, tile: 0.3 });
          ox += bw + bh * 0.17;
          continue;
        }
        k.p(b, ox + bw / 2, sy + 0.02 + bh / 2, 0.02, bw, bh, dep, mat, 0.3);
      }
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
  if (o.seat !== false) {
    k.world.addInteract({
      pos: new THREE.Vector3(x, y + 0.55, z), radius: 1.4, label: 'Sit at the desk',
      kind: 'seat', seat: { x, y: y + 0.5, z, rotY: b.r },
    });
  }
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
  // every chair in the house is a chair you can actually sit in; stand() fans
  // out from behind the seat, so a chair pushed under a table still lets go
  if (o.seat !== false) {
    k.world.addInteract({
      pos: new THREE.Vector3(x, y + 0.55, z), radius: 1.3, label: 'Sit down',
      kind: 'seat', seat: { x, y: y + 0.5, z, rotY: b.r },
    });
  }
  return b;
}

// ── seating ────────────────────────────────────────────────────────────────
export function sofa(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w || 2.4, d = o.d || 0.95;
  const up = o.color !== undefined ? M.solid(o.color, 0.9) : M.get('fabric');
  const cush = M.paint(o.cushion ?? 0xe8e4db, 0.95);
  k.p(b, 0, 0.22, 0, w, 0.3, d, up, 1);
  k.p(b, 0, 0.62, -d / 2 + 0.14, w, 0.66, 0.28, up, 1);
  // separate seat and back cushions with a seam between each — one slab of
  // upholstery across the whole frame is what makes a sofa read as a box
  const n = w >= 2.6 ? 3 : 2, cw = (w - 0.34) / n;
  for (let i = 0; i < n; i++) {
    const ox = -(w - 0.34) / 2 + (i + 0.5) * cw;
    k.p(b, ox, 0.45, 0.02, cw - 0.05, 0.18, d - 0.28, cush, 0.8);
    k.p(b, ox, 0.74, -d / 2 + 0.36, cw - 0.07, 0.38, 0.18, cush, 0.7);
  }
  for (const s of [-1, 1]) k.p(b, s * (w / 2 - 0.13), 0.5, 0, 0.26, 0.5, d, up, 1);
  for (const [ox, oz] of [[-w / 2 + 0.16, -d / 2 + 0.14], [w / 2 - 0.16, -d / 2 + 0.14], [-w / 2 + 0.16, d / 2 - 0.14], [w / 2 - 0.16, d / 2 - 0.14]])
    k.p(b, ox, 0.05, oz, 0.07, 0.12, 0.07, M.get('walnut'), 0.3);
  // throw pillows, propped against the back cushions
  for (const s of [-1, 1]) k.p(b, s * (w / 2 - 0.45), 0.72, -d / 2 + 0.56, 0.4, 0.4, 0.14, M.paint(o.pillow ?? 0xb5c4cf, 0.95), 0.5);
  // a blanket thrown over one arm and left hanging
  if (o.blanket !== false) {
    const bl = M.paint(o.blanket ?? 0xb5a181, 0.96, 'throw');
    const ax = w / 2 - 0.14;
    k.p(b, ax, 0.765, 0.02, 0.3, 0.05, d - 0.26, bl, 0.5);      // over the arm
    k.p(b, ax - 0.21, 0.62, 0.12, 0.14, 0.34, 0.44, bl, 0.5);   // falling inside
    k.p(b, ax + 0.15, 0.52, 0.06, 0.05, 0.54, 0.4, bl, 0.5);    // and outside
  }
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
  sofa(k, ax, y, az, { ...o, w: 2.4, rotY: r + Math.PI / 2, blanket: false });
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
  const base = o.cabinet ?? 0x2f3a42;
  const cab = M.paint(base, 0.5, 'cab');
  const face = M.paint(shade(base, 1.1), 0.45, 'cabface');
  const seam = M.paint(shade(base, 0.5), 0.7, 'cabseam');   // shadow line between doors
  const pull = M.get('chrome');
  k.p(b, 0, 0.5, 0, len, 0.8, 0.62, cab, 0.9);              // carcass, up on a plinth
  k.p(b, 0, 0.05, -0.04, len, 0.1, 0.54, seam, 0.4);        // toe kick, set back in shadow
  k.p(b, 0, 0.9, 0, len, 0.05, 0.66, M.get('marble'), 1.2);
  const doors = Math.max(2, Math.round(len / 0.62));
  const bay = len / doors;
  for (let i = 0; i < doors; i++) {
    const ox = -len / 2 + (i + 0.5) * bay;
    if (i === 0 && o.drawers !== false) {
      for (let dr = 0; dr < 3; dr++) {                      // drawer bank at one end
        const dy = 0.24 + dr * 0.26;
        if (dr === 2) {                                     // the cutlery drawer opens
          const [dx, dz] = k.L(ox, 0.33, x, z, b.r);
          drawer(k, dx, y + dy, dz, { rotY: b.r, w: bay - 0.045, h: 0.22, out: 0.36, face, label: 'Open the drawer' });
          continue;
        }
        k.p(b, ox, dy, 0.32, bay - 0.045, 0.22, 0.02, face, 0.5);
        k.p(b, ox, dy, 0.345, bay * 0.5, 0.02, 0.03, pull, 0.2);
      }
    } else if (i === 1 && o.drawers !== false) {            // one cupboard swings
      const [cx2, cz2] = k.L(ox, 0.33, x, z, b.r);
      hingePanel(k, cx2, y + 0.5, cz2, {
        rotY: b.r, w: bay - 0.045, h: 0.74, side: 1, face, handleMat: pull, handleH: 0.22,
        label: 'Open the cupboard', closeLabel: 'Close the cupboard', radius: 1.6,
      });
    } else {
      k.p(b, ox, 0.5, 0.32, bay - 0.045, 0.74, 0.02, face, 0.5);
      k.p(b, ox, 0.79, 0.345, 0.22, 0.02, 0.03, pull, 0.2);
    }
    if (i) k.p(b, ox - bay / 2, 0.5, 0.325, 0.014, 0.78, 0.025, seam, 0.2);
  }
  if (o.upper !== false) {
    k.p(b, 0, 1.95, -0.16, len, 0.9, 0.35, cab, 0.9);
    for (let i = 0; i < doors; i++) {
      const ox = -len / 2 + (i + 0.5) * bay;
      k.p(b, ox, 1.95, 0.02, bay - 0.045, 0.84, 0.02, face, 0.5);
      k.p(b, ox, 1.6, 0.045, 0.2, 0.02, 0.03, pull, 0.2);
      if (i) k.p(b, ox - bay / 2, 1.95, 0.025, 0.014, 0.84, 0.025, seam, 0.2);
    }
    // light valance: a rail under the wall units hiding a warm strip that
    // washes the worktop the way real under-cabinet lighting does
    k.p(b, 0, 1.47, 0.0, len, 0.07, 0.32, cab, 0.5);
    k.p(b, 0, 1.435, -0.1, len - 0.14, 0.03, 0.15, M.emissive(0xffe6bd, 1.1), 0.3);
  }
  k.p(b, 0, 1.25, -0.2, len, 0.6, 0.03, M.get('tile'), 0.5);   // backsplash
  k.pc(b, 0, 0.45, 0, len, 0.92, 0.66);
}

export function island(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w || 3.6, d = o.d || 1.3;
  const stone = M.get('marble'), steel = M.get('steel'), chrome = M.get('chrome');
  const tw = w + 0.24, td = d + 0.24;
  const sw = 0.86, sd = 0.5, sz = -0.15;                    // the sink cut-out
  k.p(b, 0, 0.35, 0, w, 0.7, d, M.paint(0x27303a, 0.5, 'island'), 1);
  // worktop and cabinet band are mitred round the cut-out so the basin is a
  // real hole with a steel liner in it, not a chrome plate laid on the stone
  const ring = (oy, h, ww, dd, mat, tl) => {
    k.p(b, 0, oy, (sz - sd / 2 - dd / 2) / 2, ww, h, sz - sd / 2 + dd / 2, mat, tl);
    k.p(b, 0, oy, (sz + sd / 2 + dd / 2) / 2, ww, h, dd / 2 - sz - sd / 2, mat, tl);
    for (const s of [-1, 1]) k.p(b, s * (ww / 2 + sw / 2) / 2, oy, sz, ww / 2 - sw / 2, h, sd, mat, tl);
  };
  ring(0.79, 0.18, w, d, M.paint(0x27303a, 0.5, 'island'), 1);
  ring(0.92, 0.06, tw, td, stone, 1.4);
  for (const s of [-1, 1]) {
    k.p(b, s * (sw / 2 - 0.015), 0.83, sz, 0.03, 0.24, sd, steel, 0.3);   // basin walls
    k.p(b, 0, 0.83, sz + s * (sd / 2 - 0.015), sw, 0.24, 0.03, steel, 0.3);
  }
  k.p(b, 0, 0.715, sz, sw - 0.06, 0.03, sd - 0.06, steel, 0.3);           // basin floor
  k.p(b, 0, 0.735, sz, 0.08, 0.012, 0.08, M.get('darkPlastic'), 0.2);     // waste
  k.p(b, 0, 1.1, sz - 0.36, 0.05, 0.34, 0.05, chrome, 0.2);               // gooseneck mixer
  k.p(b, 0, 1.29, sz - 0.29, 0.05, 0.06, 0.2, chrome, 0.2);
  k.p(b, 0, 1.24, sz - 0.19, 0.045, 0.12, 0.045, chrome, 0.2);
  k.p(b, 0.11, 1.0, sz - 0.36, 0.03, 0.03, 0.13, chrome, 0.2);            // lever
  tap(k, ...k.L(0, sz - 0.19, x, z, b.r), y + 1.18, { h: 0.45, label: 'Run the tap' });
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
  const steel = M.get('steel'), chrome = M.get('chrome');
  const gap = M.paint(0x23272c, 0.6, 'appliancegap');
  // the carcass is a shell, not a solid block — swing the doors on a block and
  // all you have opened is a view of steel
  k.p(b, 0, 1.05, -0.34, 1.1, 2.1, 0.04, steel, 1);                          // back
  for (const s of [-1, 1]) k.p(b, s * 0.53, 1.05, 0, 0.04, 2.1, 0.72, steel, 1);
  k.p(b, 0, 2.08, 0, 1.1, 0.04, 0.72, steel, 1);
  k.p(b, 0, 0.02, 0, 1.1, 0.04, 0.72, steel, 1);
  k.p(b, 0, 0.77, 0, 1.02, 0.05, 0.68, steel, 0.6);                          // freezer deck
  // shelves and food inside, lit by a strip that comes on with the doors
  for (const sy of [0.95, 1.35, 1.75]) k.p(b, 0, sy, 0.02, 1.0, 0.03, 0.6, M.get('glass'), 0.4);
  for (let i = 0; i < 9; i++) {
    const sy = [1.0, 1.4, 1.8][i % 3];
    k.p(b, -0.38 + Math.floor(i / 3) * 0.36, sy + 0.09, -0.1 + (i % 3) * 0.12, 0.14, 0.18, 0.14,
      M.solid(k.rng.pick([0xd0342c, 0xf0b429, 0x6ab04c, 0xe8e4db, 0x8a5b3a]), 0.6), 0.2);
  }
  const [gx, gz] = k.L(0, 0, x, z, b.r);
  const glow = boxMesh(0.9, 0.05, 0.5, M.emissive(0xfff2d8, 1.6), gx, y + 2.02, gz, { cast: false });
  glow.visible = false;
  k.world.addProp(glow);
  // French doors over a freezer drawer, each read by its shadow gap.  The bar
  // handles ride on the leaves — a handle left behind in the batch is the
  // tell-tale of a door that only pretends to open.
  const doors = [];
  for (const s of [-1, 1]) {
    const [dx, dz] = k.L(s * 0.27, 0.37, x, z, b.r);
    doors.push(hingePanel(k, dx, y + 1.42, dz, {
      rotY: b.r, w: 0.52, h: 1.24, side: s, t: 0.05, face: steel, swing: 1.7,
      handleMat: chrome, handleH: 0.86, speed: 2.0,
    }));
  }
  const [fhx, fhz] = k.L(0, 0.45, x, z, b.r);
  openTogether(k, doors, fhx, y + 1.4, fhz, {
    open: 'Open the fridge', close: 'Close the fridge', radius: 2.2,
    onToggle: (on) => { glow.visible = on; },
  });
  k.p(b, 0, 1.42, 0.372, 0.016, 1.24, 0.02, gap, 0.2);                     // between the doors
  k.p(b, 0, 0.77, 0.372, 1.06, 0.02, 0.02, gap, 0.2);                      // fridge / freezer split
  k.p(b, 0, 0.42, 0.37, 1.06, 0.64, 0.03, steel, 0.8);                     // freezer drawer
  k.p(b, 0, 0.63, 0.405, 0.74, 0.035, 0.04, chrome, 0.2);
  for (const t of [-1, 1]) k.p(b, t * 0.36, 0.63, 0.392, 0.035, 0.04, 0.05, chrome, 0.2);
  // ice & water dispenser, sunk into the left door under a lit panel
  k.p(b, -0.3, 1.56, 0.358, 0.26, 0.36, 0.03, M.paint(0x14171b, 0.5, 'dispenser'), 0.3);
  k.p(b, -0.3, 1.62, 0.372, 0.16, 0.02, 0.02, chrome, 0.2);
  k.p(b, -0.3, 1.84, 0.388, 0.24, 0.08, 0.012, appliancePanel(M, 'fridge'), 0);
  k.pc(b, 0, 1.05, 0, 1.15, 2.1, 0.75);
}

export function range(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const steel = M.get('steel'), black = M.get('blackMetal'), chrome = M.get('chrome');
  k.p(b, 0, 0.45, 0, 1.1, 0.9, 0.65, steel, 0.8);
  k.p(b, 0, 0.91, 0, 1.1, 0.03, 0.65, black, 0.6);
  // hobs: a sunk burner under a cast-iron cross grate, not a flat black square
  for (const ox of [-0.3, 0.0, 0.3]) for (const oz of [-0.16, 0.16]) {
    k.p(b, ox, 0.927, oz, 0.2, 0.014, 0.2, M.paint(0x15171a, 0.45, 'burner'), 0.2);
    k.p(b, ox, 0.943, oz, 0.21, 0.018, 0.035, black, 0.2);
    k.p(b, ox, 0.943, oz, 0.035, 0.018, 0.21, black, 0.2);
    k.p(b, ox, 0.95, oz, 0.07, 0.03, 0.07, chrome, 0.2);
  }
  // oven door: a glazed window in a steel frame under a full-width bar handle
  k.p(b, 0, 0.44, 0.335, 1.04, 0.62, 0.03, steel, 0.5);
  k.p(b, 0, 0.45, 0.355, 0.82, 0.4, 0.02, M.get('carGlass'), 0.4);
  k.p(b, 0, 0.79, 0.375, 1.0, 0.04, 0.045, chrome, 0.3);
  for (const s of [-1, 1]) k.p(b, s * 0.47, 0.79, 0.355, 0.04, 0.04, 0.05, chrome, 0.2);
  // control rail: knobs either side of the oven timer
  k.p(b, 0, 0.865, 0.34, 1.1, 0.075, 0.02, black, 0.3);
  for (const ox of [-0.46, -0.34, 0.34, 0.46]) k.p(b, ox, 0.865, 0.355, 0.075, 0.055, 0.025, chrome, 0.2);
  k.p(b, 0, 0.865, 0.356, 0.28, 0.055, 0.012, appliancePanel(M, 'oven'), 0);
  k.p(b, 0, 2.0, -0.06, 1.2, 0.7, 0.55, steel, 0.8);                       // hood
  k.p(b, 0, 1.67, -0.06, 1.0, 0.04, 0.42, M.emissive(0xffe6bd, 0.9), 0.3); // hood lights
  k.p(b, 0, (2.35 + (o.ceil ?? 3.78)) / 2, -0.1, 0.5, (o.ceil ?? 3.78) - 2.35, 0.4, steel, 0.6);
  // the oven lights up behind its glass when you put it on
  const [ox2, oz2] = k.L(0, 0.34, x, z, b.r);
  const oven = boxMesh(0.78, 0.36, 0.02, M.emissive(0xff9a3c, 1.5), ox2, y + 0.45, oz2, { rotY: b.r, cast: false });
  oven.visible = false;
  k.world.addProp(oven);
  k.world.addInteract({
    pos: new THREE.Vector3(ox2, y + 0.5, oz2), radius: 1.8,
    label: () => (oven.visible ? 'Turn the oven off' : 'Preheat the oven'),
    onUse: () => { oven.visible = !oven.visible; return 'click'; },
  });
  k.pc(b, 0, 0.45, 0, 1.1, 0.95, 0.68);
}

// ── bathroom ───────────────────────────────────────────────────────────────
export function vanity(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w || 1.5;
  const chrome = M.get('chrome');
  const porcelain = M.paint(0xfbfcfd, 0.28, 'porcelain');
  k.p(b, 0, 0.47, 0, w, 0.74, 0.55, M.paint(0x3d4a52, 0.5, 'vanity'), 0.8);
  k.p(b, 0, 0.05, -0.03, w, 0.1, 0.49, M.paint(0x1d252a, 0.7, 'vanitykick'), 0.4);
  for (const s of [-1, 1]) {                                     // doors + pulls
    k.p(b, s * w * 0.25, 0.47, 0.285, w * 0.46, 0.66, 0.02, M.paint(0x475761, 0.45, 'vanityface'), 0.5);
    k.p(b, s * 0.07, 0.68, 0.31, 0.03, 0.03, 0.05, M.get('gold'), 0.2);
  }
  k.p(b, 0, 0.87, 0, w + 0.06, 0.06, 0.58, M.get('marble'), 1);
  // a basin with a bottom you can see into: four porcelain walls on the stone
  k.p(b, 0, 0.915, 0, 0.46, 0.03, 0.32, porcelain, 0.3);
  for (const s of [-1, 1]) {
    k.p(b, s * 0.245, 0.96, 0, 0.03, 0.12, 0.36, porcelain, 0.3);
    k.p(b, 0, 0.96, s * 0.18, 0.52, 0.12, 0.03, porcelain, 0.3);
  }
  k.p(b, 0, 0.935, 0, 0.05, 0.014, 0.05, chrome, 0.2);           // waste
  k.p(b, 0, 1.13, -0.19, 0.04, 0.4, 0.04, chrome, 0.2);          // mixer
  k.p(b, 0, 1.31, -0.11, 0.04, 0.04, 0.2, chrome, 0.2);
  k.p(b, 0.08, 1.31, -0.19, 0.03, 0.03, 0.1, chrome, 0.2);
  k.p(b, 0, 1.75, -0.26, w - 0.1, 1.2, 0.03, M.get('mirror'), 1);
  k.p(b, 0, 2.42, -0.2, w - 0.4, 0.06, 0.14, M.emissive(0xf6f9ff, 1.8), 0.4);
  tap(k, ...k.L(0, -0.03, x, z, b.r), y + 1.29, { h: 0.34, radius: 1.4 });
  // soap, a tumbler of brushes and a folded hand towel on the stone
  k.p(b, w * 0.28, 0.96, -0.02, 0.07, 0.11, 0.07, M.paint(0xd8e3ea, 0.4, 'soap'), 0.2);
  k.p(b, -w * 0.3, 0.96, -0.02, 0.08, 0.12, 0.08, M.get('chrome'), 0.2);
  k.p(b, -w * 0.3, 1.06, -0.02, 0.05, 0.1, 0.05, M.solid(0x3f6ea8, 0.8), 0.2);
  k.p(b, w * 0.36, 0.93, 0.14, 0.24, 0.05, 0.18, M.paint(0xe8eef2, 0.95, 'towel'), 0.3);
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
  const leaf = new THREE.PlaneGeometry(0.14 * scale, 0.75 * scale);
  for (let i = 0; i < 14; i++) {
    const a = rng() * Math.PI * 2, tilt = rng.range(0.2, 0.9);
    batched(k, leaf, M.get('foliage'),
      x + Math.cos(a) * 0.1 * scale, y + 0.74 * scale, z + Math.sin(a) * 0.1 * scale,
      tilt * (rng() - 0.5), a, tilt);
  }
  leaf.dispose();
}

const _bm = new THREE.Matrix4();
const _be = new THREE.Euler();
const _bq = new THREE.Quaternion();
const _bp = new THREE.Vector3();
const _bs = new THREE.Vector3(1, 1, 1);

/**
 * Drops a non-box geometry — a leaf, a piece of fruit, a ball — into the
 * merged static batch.  A Group of fourteen leaf planes per pot is fourteen
 * draw calls of nothing, and this house has forty pots in it.
 */
function batched(k, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  _be.set(rx, ry, rz);
  _bq.setFromEuler(_be);
  _bm.compose(_bp.set(x, y, z), _bq, _bs);
  k.B.add(geo, mat, _bm);
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
  return panelMaterial(M, `artcv:${color}:${seed}`, 128, 96, (ctx) => {
    const rng = makeRng(seed);
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
  }, { roughness: 0.85 });
}

// ── occasional furniture ───────────────────────────────────────────────────
export function sideTable(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w ?? 0.55, h = o.h ?? 0.56;
  k.p(b, 0, h, 0, w, 0.05, w, o.top || M.get('walnut'), 0.5);
  if (o.pedestal) {
    k.p(b, 0, h / 2, 0, 0.1, h, 0.1, M.get('blackMetal'), 0.3);
    k.p(b, 0, 0.03, 0, w * 0.72, 0.05, w * 0.72, M.get('blackMetal'), 0.3);
  } else {
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      k.p(b, ox * (w / 2 - 0.06), h / 2, oz * (w / 2 - 0.06), 0.05, h, 0.05, M.get('walnut'), 0.3);
    }
    k.p(b, 0, h * 0.38, 0, w - 0.14, 0.04, w - 0.14, M.get('walnut'), 0.4);   // lower shelf
  }
  k.pc(b, 0, h / 2, 0, w, h + 0.06, w);
  if (o.lamp) tableLamp(k, ...k.L(0, 0, x, z, b.r), y + h + 0.03, { rotY: b.r });
  return b;
}

export function consoleTable(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w ?? 1.4, d = o.d ?? 0.4, h = o.h ?? 0.85;
  k.p(b, 0, h, 0, w, 0.06, d, o.top || M.get('walnut'), 0.8);
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    k.p(b, s * (w / 2 - 0.08), h / 2, t * (d / 2 - 0.06), 0.07, h, 0.07, M.get('walnut'), 0.4);
  }
  k.p(b, 0, h * 0.26, 0, w - 0.2, 0.04, d - 0.1, M.get('walnut'), 0.5);
  k.pc(b, 0, h / 2, 0, w, h, d);
  return b;
}

/** Upholstered bench — foot of the bed, foyer, mud room. You can sit on it. */
export function bench(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w ?? 1.4, d = o.d ?? 0.44, h = o.h ?? 0.45;
  k.p(b, 0, h, 0, w, 0.16, d, M.paint(o.color ?? 0x8a8172, 0.92, 'benchpad'), 0.5);
  for (const s of [-1, 1]) k.p(b, s * (w / 2 - 0.09), (h - 0.08) / 2, 0, 0.07, h - 0.08, d - 0.08, M.get('walnut'), 0.3);
  if (o.rack) {                                     // luggage rack slats underneath
    for (let i = 0; i < 4; i++) k.p(b, 0, h * 0.42, -d / 2 + 0.08 + i * ((d - 0.16) / 3), w - 0.2, 0.03, 0.05, M.get('walnut'), 0.3);
  }
  k.pc(b, 0, h / 2, 0, w, h + 0.1, d);
  k.world.addInteract({
    pos: new THREE.Vector3(x, y + h, z), radius: 1.5, label: 'Sit down',
    kind: 'seat', seat: { x, y: y + h + 0.04, z, rotY: b.r },
  });
  return b;
}

export function floorLamp(k, x, y, z, o = {}) {
  const M = k.M, h = o.h ?? 1.5, sw = o.shade ?? 0.42;
  k.box(0.3, 0.05, 0.3, M.get('blackMetal'), x, y + 0.025, z, { tile: 0.2 });
  k.box(0.05, h, 0.05, M.get('blackMetal'), x, y + h / 2, z, { tile: 0.2 });
  const cloth = shadeFabric(M);
  k.box(sw, 0.12, sw, cloth, x, y + h + 0.06, z, { tile: 0.3 });
  k.box(sw - 0.05, 0.11, sw - 0.05, cloth, x, y + h + 0.17, z, { tile: 0.3 });
  k.box(sw - 0.1, 0.1, sw - 0.1, cloth, x, y + h + 0.27, z, { tile: 0.3 });
  const bulb = boxMesh(sw - 0.14, 0.36, sw - 0.14, M.emissive(0xffdca8, 1.4), x, y + h + 0.16, z, { cast: false });
  k.world.addProp(bulb);
  const light = k.world.addLight({
    pos: new THREE.Vector3(x, y + h + 0.1, z), color: o.color ?? 0xffd39a,
    intensity: o.intensity ?? 7, distance: 8, lamp: true,
  });
  lampSwitch(k, light, bulb, x, y + 1.25, z, 1.9);
  k.col(0.3, h, 0.3, x, y + h / 2, z);
  return light;
}

/** Wall sconce — the pair that flank a fireplace, a mirror or a bed. */
export function sconce(k, x, y, z, rotY = 0, o = {}) {
  const M = k.M;
  const nx = Math.sin(rotY), nz = Math.cos(rotY);
  k.box(0.12, 0.22, 0.05, M.get('gold'), x, y, z, { rotY, tile: 0.2 });
  k.box(0.06, 0.06, 0.14, M.get('gold'), x + nx * 0.07, y + 0.06, z + nz * 0.07, { rotY, tile: 0.2 });
  k.box(0.22, 0.2, 0.22, shadeFabric(M), x + nx * 0.15, y + 0.16, z + nz * 0.15, { rotY, tile: 0.2 });
  const bulb = boxMesh(0.15, 0.24, 0.15, M.emissive(0xffdca8, 1.3), x + nx * 0.15, y + 0.16, z + nz * 0.15, { cast: false });
  k.world.addProp(bulb);
  const light = k.world.addLight({
    pos: new THREE.Vector3(x + nx * 0.3, y + 0.2, z + nz * 0.3),
    color: 0xffd39a, intensity: o.intensity ?? 5, distance: 6.5, lamp: true,
  });
  lampSwitch(k, light, bulb, x + nx * 0.15, y, z + nz * 0.15, 1.7);
  return light;
}

/**
 * The switch by the door.  It flips whatever the plan declared for this room
 * — mansion.js tags every ceiling fixture with the room it hangs in — and
 * leaves the lamps alone, so you can kill the overheads and read by one lamp.
 */
export function lightSwitch(k, R, x, y, z, o = {}) {
  const M = k.M, rotY = o.rotY || 0;
  const plate = M.paint(0xf6f4ee, 0.4, 'switchplate');
  k.box(0.1, 0.14, 0.02, plate, x, y, z, { rotY, tile: 0.1 });
  k.box(0.05, 0.07, 0.03, plate, x + 0.014 * Math.sin(rotY), y, z + 0.014 * Math.cos(rotY), { rotY, tile: 0.1 });
  const lights = k.world.lights.filter((l) => l.room === R.name && l.floor === R.floor);
  const st = { on: true };
  k.world.addInteract({
    pos: new THREE.Vector3(x, y, z), radius: 1.7,
    label: () => (st.on ? 'Lights off' : 'Lights on'),
    onUse: () => { st.on = !st.on; for (const l of lights) l.on = st.on; return 'click'; },
  });
}

/** A tap that runs: a thread of water into the basin and a small splash. */
export function tap(k, x, z, y, o = {}) {
  const h = o.h ?? 0.4;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.add(boxMesh(0.028, h, 0.028, k.M.get('water'), 0, -h / 2, 0, { cast: false }));
  g.add(boxMesh(0.16, 0.006, 0.16, k.M.get('water'), 0, -h, 0, { cast: false }));
  g.visible = false;
  k.world.addProp(g);
  k.world.addInteract({
    pos: new THREE.Vector3(x, y - h * 0.4, z), radius: o.radius ?? 1.5,
    label: () => (g.visible ? 'Turn off the tap' : (o.label || 'Run the tap')),
    onUse: () => { g.visible = !g.visible; return g.visible ? 'splash' : 'click'; },
  });
}

// ── wall treatment ─────────────────────────────────────────────────────────
/** Moulding right round the room — what the bare wall above the furniture
 *  line was missing.  Hung above the tallest opening so it never crosses one. */
export function pictureRail(k, R, o = {}) {
  const M = k.M, y = R.y + (o.h ?? 2.5), skip = o.skip || [];
  const m = M.paint(o.color ?? 0xf3efe6, 0.72, 'picrail');
  const hw = R.w / 2 - 0.07, hd = R.d / 2 - 0.07;
  if (!skip.includes('n')) k.box(R.w - 0.14, 0.08, 0.05, m, R.x, y, R.z - hd, { tile: 0.3 });
  if (!skip.includes('s')) k.box(R.w - 0.14, 0.08, 0.05, m, R.x, y, R.z + hd, { tile: 0.3 });
  if (!skip.includes('w')) k.box(0.05, 0.08, R.d - 0.14, m, R.x - hw, y, R.z, { tile: 0.3 });
  if (!skip.includes('e')) k.box(0.05, 0.08, R.d - 0.14, m, R.x + hw, y, R.z, { tile: 0.3 });
}

/** Shelf on brackets with a few things on it. */
export function wallShelf(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M, rng = k.rng;
  const w = o.w ?? 1.1, d = o.d ?? 0.24;
  k.p(b, 0, 0, 0, w, 0.045, d, M.get('walnut'), 0.5);
  for (const s of [-1, 1]) k.p(b, s * (w / 2 - 0.14), -0.1, -d * 0.1, 0.04, 0.18, d - 0.08, M.get('blackMetal'), 0.2);
  const hues = [0x8c3b3b, 0x2f4f6b, 0x3f5c3a, 0x6b5330, 0x4a3355, 0xa8895b];
  for (let i = 0, n = o.items ?? 3; i < n; i++) {
    const ox = -w / 2 + (i + 0.5) * (w / n);
    if (rng.chance(0.55)) {                       // a short run of books
      for (let j = 0, m2 = rng.int(3, 5); j < m2; j++) {
        const bh = rng.range(0.18, 0.26);
        k.p(b, ox - 0.08 + j * 0.05, 0.025 + bh / 2, 0, 0.045, bh, rng.range(0.14, 0.2), M.solid(rng.pick(hues), 0.7), 0.2);
      }
    } else if (rng.chance(0.5)) {                 // a pot
      k.p(b, ox, 0.11, 0, 0.16, 0.17, 0.16, M.paint(rng.pick([0xc9d4cb, 0xd8cfbe, 0x9aa8b4]), 0.5, 'shelfpot'), 0.2);
    } else {                                      // a small framed picture
      k.p(b, ox, 0.13, -0.03, 0.2, 0.24, 0.03, M.get('gold'), 0.2);
      k.p(b, ox, 0.13, -0.005, 0.16, 0.2, 0.01, M.solid(rng.pick(hues), 0.8), 0.2);
    }
  }
}

/** Tall mirror — hung in the formal rooms, leaned in the bedrooms. */
export function tallMirror(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w ?? 0.9, h = o.h ?? 1.9, base = o.base ?? 0.25;
  k.p(b, 0, base + h / 2, 0, w + 0.1, h + 0.1, 0.06, o.frame || M.get('gold'), 0.5);
  k.p(b, 0, base + h / 2, 0.045, w, h, 0.02, M.get('mirror'), 1);
  if (o.lean) k.pc(b, 0, base + h / 2, 0.05, w + 0.1, h, 0.24);
}

/** A pinned-up poster: flat blocks of colour on paper, no frame. */
export function poster(k, x, y, z, o = {}) {
  const M = k.M, w = o.w ?? 0.7, h = o.h ?? 1.0, seed = o.seed ?? 1;
  const hue = o.hue ?? 0.6;
  const mat = panelMaterial(M, `poster:${seed}:${hue.toFixed(2)}`, 96, 128, (c, cw, ch) => {
    const rng = makeRng((seed * 2654435761) >>> 0);
    const H = (d) => `hsl(${(((hue + d) % 1) * 360).toFixed(0)},${rng.int(55, 90)}%,${rng.int(30, 62)}%)`;
    c.fillStyle = H(0); c.fillRect(0, 0, cw, ch);
    c.fillStyle = H(0.5);
    c.beginPath(); c.arc(cw * 0.5, ch * rng.range(0.3, 0.45), cw * rng.range(0.24, 0.36), 0, Math.PI * 2); c.fill();
    c.fillStyle = H(0.12);
    for (let i = 0, n = rng.int(2, 4); i < n; i++) c.fillRect(cw * 0.1, ch * (0.6 + i * 0.09), cw * rng.range(0.3, 0.8), ch * 0.045);
    c.fillStyle = H(0.35);
    c.fillRect(0, ch - 12, cw, 12);
  }, { roughness: 0.92 });
  k.box(w, h, 0.012, mat, x, y, z, { rotY: o.rotY || 0 });
}

// ── small dressing ─────────────────────────────────────────────────────────
export function bookStack(k, x, y, z, o = {}) {
  const M = k.M, rng = k.rng, n = o.n ?? rng.int(2, 4);
  const hues = [0x8c3b3b, 0x2f4f6b, 0x3f5c3a, 0x6b5330, 0x4a3355, 0xa8895b];
  let yy = y;
  for (let i = 0; i < n; i++) {
    const w = (o.w ?? 0.24) * rng.range(0.86, 1), h = rng.range(0.035, 0.055);
    k.box(w, h, w * 0.72, M.solid(rng.pick(hues), 0.7), x + rng.range(-0.02, 0.02), yy + h / 2, z + rng.range(-0.02, 0.02),
      { rotY: (o.rotY || 0) + rng.range(-0.2, 0.2), tile: 0.2 });
    yy += h;
  }
  return yy;
}

export function magazines(k, x, y, z, o = {}) {
  const M = k.M, rng = k.rng;
  for (let i = 0, n = o.n ?? 3; i < n; i++) {
    k.box(0.24, 0.008, 0.32, M.solid(rng.pick([0xd0342c, 0xf0b429, 0x2f81ff, 0xe8e4db]), 0.55),
      x + rng.range(-0.05, 0.05), y + 0.005 + i * 0.009, z + rng.range(-0.05, 0.05),
      { rotY: (o.rotY || 0) + rng.range(-0.4, 0.4), tile: 0.2 });
  }
}

export function vase(k, x, y, z, o = {}) {
  const M = k.M, s = o.scale ?? 1, col = o.color ?? 0xc9d4cb;
  k.box(0.16 * s, 0.1 * s, 0.16 * s, M.paint(col, 0.4, `vase${col}`), x, y + 0.05 * s, z, { tile: 0.2 });
  k.box(0.13 * s, 0.22 * s, 0.13 * s, M.paint(col, 0.4, `vase${col}`), x, y + 0.2 * s, z, { tile: 0.2 });
  k.box(0.15 * s, 0.05 * s, 0.15 * s, M.paint(col, 0.4, `vase${col}`), x, y + 0.33 * s, z, { tile: 0.2 });
  if (o.stems !== false) {                        // a few stems standing out of it
    const leaf = new THREE.PlaneGeometry(0.08 * s, 0.34 * s);
    for (let i = 0, n = 4; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      batched(k, leaf, M.get('foliage'),
        x + Math.cos(a) * 0.04 * s, y + 0.51 * s, z + Math.sin(a) * 0.04 * s,
        0.3 * Math.cos(a), a, 0.3);
    }
    leaf.dispose();
  }
}

export function fruitBowl(k, x, y, z, o = {}) {
  const M = k.M;
  k.box(0.32, 0.09, 0.32, M.paint(o.color ?? 0xd8cfbe, 0.4, 'bowl'), x, y + 0.045, z, { tile: 0.2 });
  const fruit = new THREE.SphereGeometry(0.055, 8, 6);
  for (let i = 0; i < 5; i++) {
    batched(k, fruit, M.solid([0xd0342c, 0xf0b429, 0x6ab04c][i % 3], 0.5),
      x - 0.06 + (i % 3) * 0.06, y + 0.12 + (i > 2 ? 0.05 : 0), z - 0.04 + Math.floor(i / 3) * 0.07);
  }
  fruit.dispose();
}

/**
 * A photo standing on a surface — the family is on the sideboards too.  These
 * draw from a small shared pool of canvases: a unique painting per frame is
 * right for the walls, but forty one-off textures for forty snapshots is not.
 */
export function photoFrame(k, x, y, z, o = {}) {
  const M = k.M, w = o.w ?? 0.18, h = o.h ?? 0.22, r = o.rotY || 0;
  k.box(w + 0.03, h + 0.03, 0.02, o.frame || M.get('gold'), x, y + h / 2, z, { rotY: r, tile: 0.2 });
  const pick = (o.seed ?? k.rng.int(0, 3)) * 7;
  k.box(w, h, 0.012, artMaterial(M, o.color ?? 0x4b5a68, pick, 0, 0), x + 0.014 * Math.sin(r), y + h / 2, z + 0.014 * Math.cos(r), { rotY: r });
  k.box(0.02, h * 0.7, 0.02, M.get('walnut'), x - 0.05 * Math.sin(r), y + h * 0.35, z - 0.05 * Math.cos(r), { rotY: r, tile: 0.2 });
}

export function wastebasket(k, x, y, z, o = {}) {
  const M = k.M, w = o.w ?? 0.28, h = o.h ?? 0.34;
  const m = o.metal ? M.get('blackMetal') : M.paint(0x8a8172, 0.7, 'bin');
  k.box(w, h, w, m, x, y + h / 2, z, { tile: 0.2 });
  k.box(w + 0.03, 0.03, w + 0.03, m, x, y + h, z, { tile: 0.2 });
  k.col(w + 0.04, h, w + 0.04, x, y + h / 2, z);
}

export function laundryBasket(k, x, y, z, o = {}) {
  const M = k.M, w = o.w ?? 0.46, d = o.d ?? 0.36, h = o.h ?? 0.44;
  const weave = M.paint(0xd9cbb4, 0.9, 'wicker');
  k.box(w, h, d, weave, x, y + h / 2, z, { rotY: o.rotY || 0, tile: 0.25 });
  k.box(w + 0.04, 0.04, d + 0.04, weave, x, y + h, z, { rotY: o.rotY || 0, tile: 0.25 });
  // laundry spilling over the rim
  k.box(w - 0.08, 0.14, d - 0.08, M.paint(0xe8eef2, 0.95, 'linen'), x, y + h + 0.04, z, { rotY: o.rotY || 0, tile: 0.3 });
  k.col(w, h, d, x, y + h / 2, z, o.rotY || 0);
}

export function umbrellaStand(k, x, y, z, o = {}) {
  const M = k.M, rng = k.rng;
  k.box(0.3, 0.6, 0.3, M.get('blackMetal'), x, y + 0.3, z, { tile: 0.25 });
  for (let i = 0; i < 3; i++) {
    const a = rng() * Math.PI * 2;
    k.box(0.06, 0.95, 0.06, M.solid(rng.pick([0x2f4f6b, 0x8c3b3b, 0x3f5c3a]), 0.8),
      x + Math.cos(a) * 0.06, y + 0.62, z + Math.sin(a) * 0.06, { rotZ: Math.cos(a) * 0.09, rotX: Math.sin(a) * 0.09, tile: 0.2 });
  }
  k.col(0.34, 0.6, 0.34, x, y + 0.3, z);
}

export function coatHooks(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M, rng = k.rng;
  const w = o.w ?? 1.4, n = o.n ?? 4;
  k.p(b, 0, 0, -0.02, w, 0.16, 0.04, M.get('walnut'), 0.5);
  for (let i = 0; i < n; i++) {
    const ox = -w / 2 + (i + 0.5) * (w / n);
    k.p(b, ox, 0, 0.04, 0.04, 0.04, 0.1, M.get('chrome'), 0.2);
    if (!rng.chance(o.full ?? 0.7)) continue;
    k.p(b, ox, -0.36, 0.08, 0.34, 0.66, 0.14, M.paint(rng.pick([0x2f6fb5, 0xb56fa8, 0x6b7a54, 0x8a5b3a, 0x37485c]), 0.9, 'coat'), 0.3);
  }
}

/** Record player / radio — something to put on that the game can hook later. */
export function radio(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w ?? 0.44;
  k.p(b, 0, 0.07, 0, w, 0.14, 0.32, M.get('walnut'), 0.4);
  k.p(b, 0, 0.15, -0.02, w - 0.06, 0.02, 0.26, M.paint(0x1b1d20, 0.5, 'platter'), 0.2);
  k.p(b, 0, 0.165, -0.02, 0.09, 0.01, 0.09, M.get('gold'), 0.2);
  k.p(b, w / 2 - 0.06, 0.17, 0.08, 0.03, 0.02, 0.2, M.get('chrome'), 0.2);   // tone arm
  for (const s of [-1, 1]) k.p(b, s * (w / 2 - 0.07), 0.05, 0.15, 0.05, 0.05, 0.02, M.get('gold'), 0.2);
  k.world.addInteract({
    pos: new THREE.Vector3(x, y + 0.2, z), radius: 1.6,
    label: o.label || 'Put a record on', onUse: () => 'click',
  });
}

export function boardGame(k, x, y, z, o = {}) {
  const M = k.M, rng = k.rng, r = o.rotY || 0;
  k.box(0.4, 0.05, 0.3, M.solid(rng.pick([0x8c3b3b, 0x2f4f6b, 0x3f5c3a]), 0.7), x, y + 0.025, z, { rotY: r, tile: 0.2 });
  k.box(0.36, 0.02, 0.26, M.paint(0xe8e4db, 0.6, 'boardtop'), x, y + 0.06, z, { rotY: r, tile: 0.2 });
  for (let i = 0; i < 4; i++) {
    k.box(0.03, 0.04, 0.03, M.solid([0xd0342c, 0xf0b429, 0x2f81ff, 0x6ab04c][i], 0.6),
      x + rng.range(-0.14, 0.14), y + 0.09, z + rng.range(-0.1, 0.1), { tile: 0.1 });
  }
}

// ── kids' rooms ────────────────────────────────────────────────────────────
export function toyBox(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M, rng = k.rng;
  const w = o.w ?? 0.9, d = o.d ?? 0.5, h = o.h ?? 0.5;
  k.p(b, 0, h / 2, 0, w, h, d, M.paint(o.color ?? 0xd8a05e, 0.75, 'toybox'), 0.5);
  k.p(b, 0, h + 0.03, 0, w + 0.05, 0.06, d + 0.05, M.get('maple'), 0.5);
  for (let i = 0; i < 4; i++) {                    // toys spilling out beside it
    k.p(b, -w / 2 + 0.15 + i * 0.22, 0.09, d / 2 + rng.range(0.16, 0.34), 0.17, 0.17, 0.17,
      M.solid(rng.pick([0xd0342c, 0x2f81ff, 0xf0b429, 0x6ab04c, 0xe86fa8]), 0.7), 0.2);
  }
  k.pc(b, 0, h / 2, 0, w, h + 0.1, d);
}

/** A soft toy: body, head, two ears — three boxes and it reads across a room. */
export function softToy(k, x, y, z, o = {}) {
  const M = k.M, s = o.scale ?? 1, r = o.rotY || 0;
  const fur = M.paint(o.color ?? 0xd8a05e, 0.95, `plush${o.color ?? 0}`);
  k.box(0.2 * s, 0.22 * s, 0.16 * s, fur, x, y + 0.11 * s, z, { rotY: r, tile: 0.2 });
  k.box(0.16 * s, 0.15 * s, 0.14 * s, fur, x, y + 0.29 * s, z, { rotY: r, tile: 0.2 });
  for (const sg of [-1, 1]) {
    k.box(0.06 * s, 0.07 * s, 0.04 * s, fur, x + Math.cos(r) * sg * 0.07 * s, y + 0.38 * s, z - Math.sin(r) * sg * 0.07 * s, { rotY: r, tile: 0.1 });
  }
}

/** Bed canopy: four posts and a fabric roof with drapes at the corners. */
export function canopy(k, x, y, z, o = {}) {
  const M = k.M, w = o.w ?? 1.5, d = o.d ?? 2.2, h = o.h ?? 2.0;
  const post = M.get('maple'), veil = M.paint(o.color ?? 0xfbe6f4, 0.96, 'veil');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.box(0.06, h, 0.06, post, x + sx * w / 2, y + h / 2, z + sz * d / 2, { tile: 0.3 });
    k.box(0.16, h * 0.8, 0.1, veil, x + sx * (w / 2 - 0.05), y + h * 0.5, z + sz * (d / 2 - 0.05), { tile: 0.5 });
  }
  k.box(w + 0.12, 0.06, d + 0.12, veil, x, y + h, z, { tile: 0.6 });
  for (const sx of [-1, 1]) k.box(0.06, 0.06, d, post, x + sx * w / 2, y + h - 0.03, z, { tile: 0.3 });
}

/** Wall rack of sports gear — balls in a cradle, a bat and a helmet. */
export function sportsRack(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w ?? 1.0;
  k.p(b, 0, 0, -0.02, w, 0.05, 0.04, M.get('maple'), 0.4);
  k.p(b, 0, -0.55, -0.02, w, 0.05, 0.04, M.get('maple'), 0.4);
  for (const s of [-1, 1]) k.p(b, s * w / 2, -0.28, -0.02, 0.05, 0.62, 0.04, M.get('maple'), 0.4);
  const [gx, gz] = k.L(0, 0.14, x, z, b.r);
  for (const [r2, col, ox] of [[0.12, 0xd4762c, -0.3], [0.11, 0xe8e4db, 0.0], [0.1, 0xf0b429, 0.28]]) {
    const ball = new THREE.SphereGeometry(r2, 12, 9);
    batched(k, ball, M.solid(col, 0.75), gx + Math.cos(b.r) * ox, y - 0.42 + r2, gz - Math.sin(b.r) * ox);
    ball.dispose();
  }
  k.p(b, -w / 2 + 0.12, -0.3, 0.1, 0.07, 0.8, 0.07, M.get('maple'), 0.3);      // bat
  k.p(b, w / 2 - 0.16, 0.2, 0.08, 0.24, 0.2, 0.24, M.solid(0x2f6fb5, 0.6), 0.2); // helmet
}

/** Shelf of trophies and medals — the thing that makes a kid's room theirs. */
export function trophyShelf(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M, rng = k.rng;
  const w = o.w ?? 1.2, gold = M.get('gold');
  k.p(b, 0, 0, 0, w, 0.05, 0.22, M.get('maple'), 0.4);
  for (let i = 0, n = 4; i < n; i++) {
    const ox = -w / 2 + (i + 0.5) * (w / n), s = rng.range(0.8, 1.3);
    k.p(b, ox, 0.05 + 0.03 * s, 0, 0.12 * s, 0.05 * s, 0.12 * s, M.get('walnut'), 0.2);
    k.p(b, ox, 0.12 * s + 0.05, 0, 0.04, 0.1 * s, 0.04, gold, 0.2);
    k.p(b, ox, 0.22 * s + 0.05, 0, 0.13 * s, 0.13 * s, 0.1 * s, gold, 0.2);
  }
}

/** Dressing table: a slim desk under a mirror, with its own stool. */
export function dressingTable(k, x, y, z, o = {}) {
  const b = B(x, y, z, o.rotY || 0), M = k.M;
  const w = o.w ?? 1.3;
  k.p(b, 0, 0.74, 0, w, 0.06, 0.45, M.get('walnut'), 0.7);
  for (const s of [-1, 1]) k.p(b, s * (w / 2 - 0.07), 0.37, 0, 0.07, 0.74, 0.4, M.get('walnut'), 0.4);
  k.p(b, 0, 1.32, -0.19, w - 0.3, 1.0, 0.04, M.get('gold'), 0.5);
  k.p(b, 0, 1.32, -0.16, w - 0.4, 0.9, 0.02, M.get('mirror'), 0.8);
  // bottles and a jewellery tray on the top
  k.p(b, -w / 2 + 0.2, 0.83, 0.02, 0.07, 0.14, 0.07, M.paint(0xd8bfd8, 0.35, 'bottle'), 0.2);
  k.p(b, -w / 2 + 0.32, 0.8, -0.02, 0.06, 0.1, 0.06, M.paint(0xf0d8b0, 0.35, 'bottle'), 0.2);
  k.p(b, w / 2 - 0.26, 0.79, 0.02, 0.2, 0.04, 0.14, M.get('gold'), 0.2);
  k.pc(b, 0, 0.4, 0, w, 0.8, 0.45);
  const [sx, sz] = k.L(0, 0.62, x, z, b.r);
  k.p(b, 0, 0.44, 0.62, 0.42, 0.12, 0.36, M.paint(o.stool ?? 0xd8dee6, 0.92, 'stoolpad'), 0.4);
  for (const [ox, oz] of [[-0.16, 0.5], [0.16, 0.5], [-0.16, 0.74], [0.16, 0.74]]) k.p(b, ox, 0.19, oz, 0.04, 0.38, 0.04, M.get('walnut'), 0.3);
  k.world.addInteract({
    pos: new THREE.Vector3(sx, y + 0.5, sz), radius: 1.4, label: 'Sit down',
    kind: 'seat', seat: { x: sx, y: y + 0.48, z: sz, rotY: b.r + Math.PI },
  });
}

// ── painted panels ─────────────────────────────────────────────────────────
/**
 * A material with a small canvas painted on it, cached in the material library
 * like everything else.  `glow` turns it into a lit display: the paint becomes
 * the emissive map, which is how a scoreboard or an oven timer reads at night
 * without a light of its own.  Keep the canvases tiny — these are read from a
 * couple of metres away, not inspected.
 */
export function panelMaterial(M, key, w, h, draw, o = {}) {
  if (M.cache.has(key)) return M.cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({
    map, roughness: o.roughness ?? 0.4, metalness: o.metalness ?? 0,
  });
  if (o.glow) {
    m.emissiveMap = map;
    m.emissive = new THREE.Color(0xffffff);
    m.emissiveIntensity = o.glow;
    m.color = new THREE.Color(0x0a0b0d);
  }
  m.name = key;
  M.cache.set(key, m);
  M.all.push(m);
  return m;
}

const SEG7 = {
  0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg',
  5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g',
};

/** One seven-segment figure, drawn as rectangles so it stays crisp when small. */
export function seg7(ctx, x, y, w, h, ch, t = 2) {
  const on = SEG7[ch];
  if (!on) return;
  const half = (h - t) / 2;
  const put = (c, X, Y, W, H) => { if (on.includes(c)) ctx.fillRect(x + X, y + Y, W, H); };
  put('a', t, 0, w - 2 * t, t);
  put('g', t, half, w - 2 * t, t);
  put('d', t, h - t, w - 2 * t, t);
  put('f', 0, t, t, half - t);
  put('b', w - t, t, t, half - t);
  put('e', 0, half + t, t, half - t);
  put('c', w - t, half + t, t, half - t);
}

/** A run of seven-segment figures; anything not a digit just spaces along. */
export function segRow(ctx, x, y, str, w, h, gap = 2, t = 2) {
  for (let i = 0; i < str.length; i++) seg7(ctx, x + i * (w + gap), y, w, h, str[i], t);
}

/** The little lit strips on appliance fronts. */
function appliancePanel(M, kind) {
  return panelMaterial(M, `panel:${kind}`, 128, 32, (c, w, h) => {
    c.fillStyle = '#0b0d10'; c.fillRect(0, 0, w, h);
    if (kind === 'oven') {
      c.fillStyle = '#ff8a2a';
      segRow(c, 30, 7, '350', 14, 18, 5, 3);
      c.fillRect(87, 8, 4, 4);                       // degree mark
      c.fillRect(6, 12, 14, 3); c.fillRect(6, 18, 10, 3);
    } else {
      c.fillStyle = '#6fd3ff';
      segRow(c, 8, 8, '38', 13, 17, 5, 3);
      c.fillStyle = '#2b3a46';
      for (let i = 0; i < 3; i++) c.fillRect(50 + i * 26, 9, 20, 15);
      c.fillStyle = '#6fd3ff'; c.fillRect(50, 9, 20, 15);
    }
  }, { glow: kind === 'oven' ? 1.1 : 0.9 });
}

/** Round wall clock in a slim bezel — the face (hands and all) is painted. */
export function wallClock(k, x, y, z, rotY = 0, o = {}) {
  const M = k.M, d = o.d || 0.34, hour = o.hour ?? 10, minute = o.minute ?? 8;
  k.box(d + 0.05, d + 0.05, 0.05, M.get('blackMetal'), x, y, z, { rotY, tile: 0.2 });
  const face = panelMaterial(M, `clock:${hour}:${minute}`, 128, 128, (c, w) => {
    const R = w / 2;
    c.fillStyle = '#15181c'; c.fillRect(0, 0, w, w);
    c.beginPath(); c.arc(R, R, R - 4, 0, Math.PI * 2);
    c.fillStyle = '#f4f2ec'; c.fill();
    c.lineWidth = 3; c.strokeStyle = '#2a2f36'; c.stroke();
    const spoke = (ang, from, len, wd) => {
      c.save(); c.translate(R, R); c.rotate(ang);
      c.fillRect(-wd / 2, -from, wd, len);
      c.restore();
    };
    c.fillStyle = '#20242a';
    for (let i = 0; i < 12; i++) spoke((i / 12) * Math.PI * 2, R - 10, i % 3 === 0 ? 13 : 7, i % 3 === 0 ? 5 : 3);
    spoke(((hour % 12) + minute / 60) / 12 * Math.PI * 2, R * 0.5, R * 0.5 + 6, 7);
    spoke((minute / 60) * Math.PI * 2, R * 0.76, R * 0.76 + 6, 5);
    c.fillStyle = '#b3352a';
    spoke((40 / 60) * Math.PI * 2, R * 0.8, R * 0.86, 2);
    c.fillStyle = '#20242a';
    c.beginPath(); c.arc(R, R, 5, 0, Math.PI * 2); c.fill();
  }, { roughness: 0.5 });
  k.box(d, d, 0.02, face, x + 0.035 * Math.sin(rotY), y, z + 0.035 * Math.cos(rotY), { rotY });
}

/**
 * Curtains you can draw.  The pole stays in the static batch; the two panels
 * are props that slide along it and stretch as they close (one box scaled on
 * its own axis, rather than two boxes of different widths).
 */
export function curtains(k, x, y, z, w, rotY, color = 0xb9ada0) {
  const M = k.M;
  const cos = Math.cos(rotY), sin = Math.sin(rotY);
  const pw = w * 0.52;                                   // panel width, drawn
  k.box(w + 0.4, 0.05, 0.05, M.get('blackMetal'), x, y + 3.15, z, { rotY, tile: 0.3 });
  for (const s of [-1, 1]) {
    k.box(0.09, 0.09, 0.09, M.get('gold'), x + cos * s * (w / 2 + 0.22), y + 3.15, z - sin * s * (w / 2 + 0.22), { rotY, tile: 0.2 });
  }
  const cloth = M.paint(color, 0.96, `cur${color}`);
  const panels = [];
  for (const s of [-1, 1]) {
    const m = boxMesh(pw, 2.5, 0.1, cloth, x, y + 1.9, z, { rotY, tile: 1, cast: false });
    k.world.addProp(m);
    panels.push({ m, s, open: s * (w / 2 - pw * 0.29), shut: s * pw * 0.48 });
  }
  const place = (t) => {
    for (const p of panels) {
      const off = p.open + (p.shut - p.open) * t;
      p.m.position.set(x + cos * off, y + 1.9, z - sin * off);
      p.m.scale.x = 0.56 + 0.44 * t;                     // bunched → hanging flat
    }
  };
  const part = movingPart(k.world, place, 1.6);
  place(0);
  k.world.addInteract({
    pos: new THREE.Vector3(x, y + 1.6, z), radius: 2.2,
    label: () => (part.target ? 'Open the curtains' : 'Draw the curtains'),
    onUse: () => { part.toggle(); return 'creak'; },
  });
}
