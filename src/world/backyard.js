// ───────────────────────────────────────────────────────────────────────────
// The grounds: terrace, pool + hot tub, pond with a running waterfall,
// picnic area, skate park, shed, driveway and fencing.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { boxMesh, mesh, planarUV } from './build.js';
import { rectSubtract } from './mansion.js';
import { makeRng, clamp, smoothstep } from '../core/rng.js';
import { groundHeight } from './terrain.js';
import { Kit, diningChair, armchair, plant } from './furniture.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildBackyard(world) {
  const k = new Kit(world);
  const M = world.mats, B = world.static;
  const rng = makeRng(31337);

  terrace(world, k, M, B);
  pool(world, k, M, B);
  hotTub(world, k, M, B);
  pondAndFalls(world, k, M, B, rng);
  picnicArea(world, k, M, B);
  skatePark(world, k, M, B);
  shed(world, k, M, B);
  driveway(world, k, M, B);
  fencing(world, k, M, B, rng);
  return k;
}

// ── terrace ────────────────────────────────────────────────────────────────
function terrace(world, k, M, B) {
  const deck = { x0: -34, x1: 26, z0: 13, z1: 33 };
  const holes = [
    { x0: -7, x1: 7, z0: 18.5, z1: 27.5 },     // pool
    { x0: 11, x1: 16, z0: 19.5, z1: 24.5 },    // hot tub
  ];
  for (const r of rectSubtract(deck, holes)) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    B.box(w, 0.3, d, M.get('paver'), (r.x0 + r.x1) / 2, -0.14, (r.z0 + r.z1) / 2, { tile: 1.2 });
    world.collider(w, 0.3, d, (r.x0 + r.x1) / 2, -0.14, (r.z0 + r.z1) / 2);
  }
  // steps down to the lawn
  for (let i = 0; i < 3; i++) {
    B.box(24, 0.18, 0.5, M.get('stone'), -6, -0.09 - i * 0.18, 33.2 + i * 0.5, { tile: 1 });
    world.collider(24, 0.24, 0.5, -6, -0.12 - i * 0.18, 33.2 + i * 0.5);
  }

  // pergola over the outdoor lounge
  const px = -22, pz = 20;
  for (const [ox, oz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) {
    B.box(0.24, 3.2, 0.24, M.get('walnut'), px + ox, 1.6, pz + oz, { tile: 1 });
    world.collider(0.3, 3.2, 0.3, px + ox, 1.6, pz + oz);
  }
  for (let i = 0; i < 9; i++) B.box(8.6, 0.14, 0.14, M.get('walnut'), px, 3.2, pz - 3 + i * 0.75, { tile: 1 });
  B.box(0.16, 0.2, 6.4, M.get('walnut'), px - 4, 3.32, pz, { tile: 1 });
  B.box(0.16, 0.2, 6.4, M.get('walnut'), px + 4, 3.32, pz, { tile: 1 });
  // string lights
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    B.box(0.07, 0.11, 0.07, M.emissiveDim(0xffd9a0, 2.6), px - 4 + t * 8, 3.0 + Math.sin(t * Math.PI) * -0.22, pz - 3, { tile: 0.2 });
    B.box(0.07, 0.11, 0.07, M.emissiveDim(0xffd9a0, 2.6), px - 4 + t * 8, 3.0 + Math.sin(t * Math.PI) * -0.22, pz + 3, { tile: 0.2 });
  }
  world.addLight({ pos: V(px, 2.9, pz), color: 0xffc98a, intensity: 50, distance: 18, decay: 1.7, outdoor: true });

  // outdoor lounge furniture
  const lounge = M.paint(0x8d857a, 0.9, 'wicker');
  for (let i = 0; i < 2; i++) {
    const b = { x: px - 1.6 + i * 3.2, y: 0.02, z: pz, r: i ? Math.PI / 2 : -Math.PI / 2 };
    k.p(b, 0, 0.22, 0, 2.0, 0.36, 0.85, lounge, 0.8);
    k.p(b, 0, 0.46, 0, 1.8, 0.14, 0.7, M.paint(0xe4dfd2, 0.95, 'cushion'), 0.6);
    k.p(b, 0, 0.62, -0.36, 2.0, 0.6, 0.14, lounge, 0.8);
    k.pc(b, 0, 0.4, 0, 2.0, 0.8, 0.9);
    world.addInteract({ pos: V(b.x, 0.5, b.z), radius: 1.8, label: 'Sit down', kind: 'seat', seat: { x: b.x, y: 0.55, z: b.z, rotY: b.r } });
  }
  B.box(1.1, 0.36, 1.1, M.get('stone'), px, 0.2, pz, { tile: 0.6 });   // fire table
  world.spot('terrace', px, 0, pz + 2);

  // sun loungers by the pool
  for (let i = 0; i < 4; i++) {
    const lx = -11.5, lz = 19 + i * 2.2;
    const b = { x: lx, y: 0.02, z: lz, r: Math.PI / 2 };
    k.p(b, 0, 0.4, 0, 1.9, 0.1, 0.7, M.paint(0xf0ece2, 0.9, 'lounger'), 0.6);
    k.p(b, -0.7, 0.62, 0, 0.6, 0.1, 0.7, M.paint(0xf0ece2, 0.9, 'lounger'), 0.6, { });
    for (const ox of [-0.8, 0.8]) k.p(b, ox, 0.2, 0, 0.06, 0.4, 0.6, M.get('chrome'), 0.3);
    k.pc(b, 0, 0.3, 0, 2.0, 0.6, 0.75);
    world.addInteract({ pos: V(lx, 0.5, lz), radius: 1.6, label: 'Lie down', kind: 'seat', seat: { x: lx, y: 0.62, z: lz, rotY: Math.PI / 2 } });
  }
  // umbrella
  B.box(0.09, 2.6, 0.09, M.get('chrome'), -13.6, 1.3, 22, { tile: 0.3 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    B.box(2.4, 0.06, 0.9, M.paint(0xd8dfe4, 0.9, 'umbrella'), -13.6 + Math.cos(a) * 1.1, 2.5, 22 + Math.sin(a) * 1.1, { rotY: -a, rotX: 0.16, tile: 0.6 });
  }
}

// ── swimming pool ──────────────────────────────────────────────────────────
function pool(world, k, M, B) {
  const P = { x0: -7, x1: 7, z0: 18.5, z1: 27.5 };
  const depthShallow = -1.1, depthDeep = -2.4;
  const w = P.x1 - P.x0, d = P.z1 - P.z0;

  // basin: sloping floor built from strips
  const strips = 10;
  for (let i = 0; i < strips; i++) {
    const t = i / (strips - 1);
    const zz = P.z0 + (i + 0.5) * (d / strips);
    const yy = depthShallow + (depthDeep - depthShallow) * t;
    B.box(w, 0.25, d / strips + 0.02, M.get('poolTile'), 0, yy, zz, { tile: 1 });
    world.collider(w, 0.3, d / strips + 0.02, 0, yy - 0.03, zz);
  }
  // walls
  B.box(w + 0.6, 2.9, 0.3, M.get('poolTile'), 0, -1.3, P.z0 - 0.15, { tile: 1 });
  B.box(w + 0.6, 2.9, 0.3, M.get('poolTile'), 0, -1.3, P.z1 + 0.15, { tile: 1 });
  B.box(0.3, 2.9, d + 0.6, M.get('poolTile'), P.x0 - 0.15, -1.3, (P.z0 + P.z1) / 2, { tile: 1 });
  B.box(0.3, 2.9, d + 0.6, M.get('poolTile'), P.x1 + 0.15, -1.3, (P.z0 + P.z1) / 2, { tile: 1 });
  world.collider(w + 0.6, 2.9, 0.3, 0, -1.3, P.z0 - 0.15);
  world.collider(w + 0.6, 2.9, 0.3, 0, -1.3, P.z1 + 0.15);
  world.collider(0.3, 2.9, d + 0.6, P.x0 - 0.15, -1.3, (P.z0 + P.z1) / 2);
  world.collider(0.3, 2.9, d + 0.6, P.x1 + 0.15, -1.3, (P.z0 + P.z1) / 2);

  // coping
  for (const [cx2, cz2, cw, cd] of [[0, P.z0 - 0.3, w + 1.2, 0.6], [0, P.z1 + 0.3, w + 1.2, 0.6],
    [P.x0 - 0.3, (P.z0 + P.z1) / 2, 0.6, d + 1.2], [P.x1 + 0.3, (P.z0 + P.z1) / 2, 0.6, d + 1.2]]) {
    B.box(cw, 0.16, cd, M.get('paver'), cx2, 0.08, cz2, { tile: 0.8 });
    world.collider(cw, 0.2, cd, cx2, 0.06, cz2);
  }

  // steps in the shallow end
  for (let i = 0; i < 3; i++) {
    B.box(3.0, 0.3, 0.5, M.get('poolTile'), -4, -0.15 - i * 0.3, P.z0 + 0.5 + i * 0.5, { tile: 0.6 });
    world.collider(3.0, 0.34, 0.5, -4, -0.15 - i * 0.3, P.z0 + 0.5 + i * 0.5);
  }

  const surface = makeWater(world, w - 0.1, d - 0.1, 0, -0.16, (P.z0 + P.z1) / 2, 0x1c7fa8, 0.86);
  world.water(V(P.x0, -3.0, P.z0), V(P.x1, 0, P.z1), -0.16, 'pool');

  // diving board
  B.box(0.5, 0.5, 0.6, M.get('chrome'), 4.6, 0.3, P.z1 + 0.9, { tile: 0.3 });
  B.box(0.6, 0.09, 2.6, M.paint(0xf2f4f6, 0.5, 'board'), 4.6, 0.62, P.z1 - 0.4, { tile: 0.5 });
  world.collider(0.6, 0.14, 2.6, 4.6, 0.62, P.z1 - 0.4);

  // pool lights
  for (const zz of [20.5, 25.5]) {
    world.addLight({ pos: V(0, -0.5, zz), color: 0x39c6ff, intensity: 34, distance: 15, decay: 1.7, outdoor: true, pool: true });
  }
  world.spot('poolEdge', -4, 0, P.z0 - 1.2);
  world.spot('poolWater', 0, -0.4, 22);
  return surface;
}

function hotTub(world, k, M, B) {
  const cxp = 13.5, czp = 22;
  // shell — segments a touch wider than the chord so the ring closes
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    B.box(1.18, 1.0, 0.3, M.get('stone'), cxp + Math.cos(a) * 2.05, 0.2, czp + Math.sin(a) * 2.05, { rotY: Math.PI / 2 - a, tile: 0.7 });
    world.collider(1.24, 1.0, 0.34, cxp + Math.cos(a) * 2.05, 0.2, czp + Math.sin(a) * 2.05, Math.PI / 2 - a);
  }
  B.box(4.6, 0.3, 4.6, M.get('poolTile'), cxp, -0.9, czp, { tile: 0.8 });
  world.collider(4.6, 0.3, 4.6, cxp, -0.9, czp);
  // bench seat inside
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    B.box(1.2, 0.3, 0.5, M.get('poolTile'), cxp + Math.cos(a) * 1.65, -0.55, czp + Math.sin(a) * 1.65, { rotY: Math.PI / 2 - a, tile: 0.5 });
    world.collider(1.2, 0.3, 0.5, cxp + Math.cos(a) * 1.65, -0.55, czp + Math.sin(a) * 1.65, Math.PI / 2 - a);
  }

  const surf = makeWater(world, 3.8, 3.8, cxp, 0.32, czp, 0x2ea3b8, 0.8, true);
  world.water(V(cxp - 2.1, -0.8, czp - 2.1), V(cxp + 2.1, 1, czp + 2.1), 0.32, 'hottub');

  // steam — soft gradient puffs, not bare quads (those read as glass shards)
  const steam = new THREE.Group();
  const smat = new THREE.MeshBasicMaterial({
    map: steamTexture(), color: 0xdff0f5, transparent: true, opacity: 0.16,
    depthWrite: false, side: THREE.DoubleSide,
  });
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), smat);
    s.position.set(cxp + (Math.random() - 0.5) * 3, 0.5 + Math.random() * 1.2, czp + (Math.random() - 0.5) * 3);
    s.userData.scale = 0.8 + Math.random() * 0.7;
    s.userData.spin = (Math.random() - 0.5) * 0.5;
    steam.add(s);
  }
  world.addProp(steam);
  world.onUpdate((dt, t) => {
    for (let i = 0; i < steam.children.length; i++) {
      const s = steam.children[i];
      s.position.y += dt * 0.22;
      if (s.position.y > 2.4) s.position.y = 0.42;
      s.scale.setScalar(s.userData.scale * (0.7 + (s.position.y - 0.42) * 0.3));   // wisps widen as they rise
      s.lookAt(world.cameraPos || V(0, 2, 0));
      s.rotation.z = s.userData.spin * t + i;
    }
  });
  world.addLight({ pos: V(cxp, 0.1, czp), color: 0x49d2e0, intensity: 24, distance: 12, decay: 1.7, outdoor: true, pool: true });
  world.spot('hotTub', cxp, 0, czp - 3.2);
}

/** Soft radial white blob — the shared billboard texture for steam wisps. */
let _steamTex = null;
function steamTexture() {
  if (_steamTex) return _steamTex;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.04, S / 2, S / 2, S * 0.48);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.32)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  _steamTex = new THREE.CanvasTexture(c);
  _steamTex.colorSpace = THREE.SRGBColorSpace;
  return _steamTex;
}

/** Animated water surface — two scrolling normal maps over a physical material. */
export function makeWater(world, w, d, x, y, z, color = 0x1c7fa8, opacity = 0.86, circle = false) {
  const M = world.mats;
  const set = M.tex.get('ripple', { size: 256, strength: 2.2, rough: [0.05, 0.05] });
  const mat = new THREE.MeshPhysicalMaterial({
    color, transparent: true, opacity, roughness: 0.06, metalness: 0.02,
    normalMap: set.normalMap.clone(), envMapIntensity: 2.0,
    clearcoat: 1, clearcoatRoughness: 0.02, side: THREE.DoubleSide,
  });
  mat.normalMap.wrapS = mat.normalMap.wrapT = THREE.RepeatWrapping;
  mat.normalMap.repeat.set(Math.max(2, w / 3), Math.max(2, d / 3));
  mat.normalScale.set(0.55, 0.55);

  const geo = circle ? new THREE.CircleGeometry(w / 2, 40) : new THREE.PlaneGeometry(w, d, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.receiveShadow = false;
  world.addProp(m);
  world.onUpdate((dt, t) => {
    mat.normalMap.offset.set((t * 0.021) % 1, (t * 0.014) % 1);
    m.position.y = y + Math.sin(t * 0.9) * 0.012;
  });
  return m;
}

// ── pond & waterfall ───────────────────────────────────────────────────────
function pondAndFalls(world, k, M, B, rng) {
  const cxp = -22, czp = 48, rx = 12, rz = 9;

  // basin dug into the lawn: ring of stone + a flat bed below the water line
  B.box(rx * 2, 1.6, rz * 2, M.get('rock'), cxp, -1.6, czp, { tile: 2.4 });
  world.collider(rx * 2, 1.6, rz * 2, cxp, -1.6, czp);
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2;
    const px = cxp + Math.cos(a) * (rx + 0.5), pz = czp + Math.sin(a) * (rz + 0.5);
    const gy = groundHeight(px, pz);
    const s = rng.range(0.7, 1.7);
    B.box(1.5 * s, 0.9 * s, 1.2 * s, M.get('rock'), px, gy + 0.1, pz, { rotY: rng() * 3, tile: 1.2 });
    world.collider(1.4 * s, 1.0 * s, 1.1 * s, px, gy + 0.1, pz, 0);
  }
  // reeds
  for (let i = 0; i < 90; i++) {
    const a = rng() * Math.PI * 2, r = rng.range(0.86, 1.0);
    const px = cxp + Math.cos(a) * rx * r, pz = czp + Math.sin(a) * rz * r;
    B.box(0.06, rng.range(0.8, 1.7), 0.06, M.get('foliage'), px, groundHeight(px, pz) + 0.55, pz, { rotY: rng() * 3, rotZ: rng.range(-0.2, 0.2), tile: 0.3 });
  }

  makeWater(world, rx * 2 - 0.6, rz * 2 - 0.6, cxp, -0.35, czp, 0x2a6b62, 0.9);
  world.water(V(cxp - rx, -1.0, czp - rz), V(cxp + rx, 0, czp + rz), -0.35, 'pond');

  // ── the waterfall cliff at the back of the pond ──
  const wx = cxp, wz = czp + rz + 1.5;   // close enough that the curtain lands in the water
  for (let i = 0; i < 22; i++) {
    const a = rng.range(-1.5, 1.5);
    const s = rng.range(1.4, 3.6);
    const px = wx + a * 4.4, pz = wz + rng.range(-1.4, 1.8);
    const h = clamp(5.2 - Math.abs(a) * 1.7, 1.2, 5.6) * rng.range(0.7, 1.15);
    const gy = groundHeight(px, pz);
    B.box(s, h, s * 0.8, M.get('rock'), px, gy + h / 2 - 0.3, pz, { rotY: rng() * 3, tile: 1.6 });
    world.collider(s, h, s * 0.8, px, gy + h / 2 - 0.3, pz, 0);
  }
  // ledge the water pours off
  B.box(5.0, 0.5, 2.4, M.get('rock'), wx, 4.4, wz - 0.6, { tile: 1.4 });
  world.collider(5.0, 0.5, 2.4, wx, 4.4, wz - 0.6);
  // upper stream
  makeWater(world, 4.4, 3.0, wx, 4.68, wz - 0.4, 0x2f7f76, 0.85);

  // falling curtain of water
  const fallMat = new THREE.MeshPhysicalMaterial({
    color: 0xa8dcea, transparent: true, opacity: 0.62, roughness: 0.05,
    metalness: 0, side: THREE.DoubleSide, envMapIntensity: 2.2,
  });
  const fallSet = M.tex.get('ripple', { size: 256, strength: 2.6 });
  fallMat.normalMap = fallSet.normalMap.clone();
  fallMat.normalMap.wrapS = fallMat.normalMap.wrapT = THREE.RepeatWrapping;
  fallMat.normalMap.repeat.set(1.2, 3.0);
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.9, 6, 12), fallMat);
  fall.position.set(wx, 2.2, wz - 1.75);
  fall.rotation.x = 0.06;
  world.addProp(fall);
  world.onUpdate((dt, t) => { fallMat.normalMap.offset.y = -(t * 1.5) % 1; fallMat.normalMap.offset.x = Math.sin(t * 0.4) * 0.03; });

  // spray at the base
  const spray = new THREE.Group();
  const sprayMat = new THREE.MeshBasicMaterial({ color: 0xe6f7ff, transparent: true, opacity: 0.16, depthWrite: false });
  for (let i = 0; i < 22; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), sprayMat);
    s.position.set(wx + (rng() - 0.5) * 5, rng() * 1.4, wz - 2.2 + (rng() - 0.5) * 1.6);
    s.userData.seed = rng() * 10;
    spray.add(s);
  }
  world.addProp(spray);
  world.onUpdate((dt, t) => {
    for (const s of spray.children) {
      s.position.y = 0.15 + ((t * 0.7 + s.userData.seed) % 1.4);
      s.material.opacity = 0.2 * (1 - ((t * 0.7 + s.userData.seed) % 1.4) / 1.4);
      s.lookAt(world.cameraPos || V(0, 2, 0));
    }
  });

  // stepping stones + a little bridge
  for (let i = 0; i < 5; i++) {
    B.box(1.5, 0.4, 1.2, M.get('rock'), cxp - 6 + i * 3, 0.06, czp - rz - 1.6, { rotY: rng(), tile: 1 });
    world.collider(1.5, 0.5, 1.2, cxp - 6 + i * 3, 0.02, czp - rz - 1.6);
  }
  // arched bridge — the deck springs from one bank and lands on the other
  const bx = cxp + rx - 2, bz0 = czp - 5, bspan = 9.6;
  const gA = groundHeight(bx, bz0), gB = groundHeight(bx, bz0 + bspan);
  const deckY = (t) => gA + (gB - gA) * t + 0.05 + Math.sin(t * Math.PI) * 0.45;
  const deckAng = (t) => Math.atan2(gB - gA + Math.cos(t * Math.PI) * Math.PI * 0.45, bspan);
  for (let i = 0; i < 9; i++) {
    const t = i / 8, zz = bz0 + t * bspan, y = deckY(t);
    B.box(1.6, 0.12, 1.28, M.get('walnut'), bx, y, zz, { rotX: -deckAng(t), tile: 0.6 });
    world.collider(1.6, 0.2, 1.25, bx, y - 0.02, zz);
  }
  // short approach planks resting on the banks
  for (const ze of [bz0 - 1.0, bz0 + bspan + 1.0]) {
    const gy = groundHeight(bx, ze);
    B.box(1.6, 0.12, 1.0, M.get('walnut'), bx, gy + 0.05, ze, { tile: 0.6 });
    world.collider(1.6, 0.18, 1.0, bx, gy + 0.03, ze);
  }
  // railings follow the arc: a post on every plank, rail lengths tilted between
  for (const s of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const t = i / 8, zz = bz0 + t * bspan, y = deckY(t);
      B.box(0.07, 0.85, 0.07, M.get('walnut'), bx + s * 0.72, y + 0.48, zz, { tile: 0.4 });
      if (i < 8) {
        const y2 = deckY((i + 1) / 8);
        const len = Math.hypot(bspan / 8, y2 - y) + 0.06;
        const ang = Math.atan2(y2 - y, bspan / 8);
        for (const hh of [0.42, 0.9]) {
          B.box(0.06, 0.07, len, M.get('walnut'), bx + s * 0.72, (y + y2) / 2 + hh, zz + bspan / 16, { rotX: -ang, tile: 0.5 });
        }
      }
    }
    world.collider(0.1, 1.4, bspan + 0.3, bx + s * 0.72, (gA + gB) / 2 + 0.7, bz0 + bspan / 2);
  }

  world.spot('pond', cxp + 2, 0, czp - rz - 3);
  world.spot('waterfall', wx, 0, wz - 5);
  world.addLight({ pos: V(wx, 1.2, wz - 3), color: 0x6fd8e8, intensity: 26, distance: 16, decay: 1.7, outdoor: true, pool: true });
}

// ── picnic area ────────────────────────────────────────────────────────────
function picnicArea(world, k, M, B) {
  const cxp = 22, czp = 40;
  // flagstone pad
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    B.box(2.2, 0.12, 2.2, M.get('stone'), cxp - 4.4 + i * 2.3, groundHeight(cxp, czp) + 0.06, czp - 4.4 + j * 2.3, { tile: 1.1 });
  }
  const gy = groundHeight(cxp, czp) + 0.12;
  world.collider(12, 0.3, 12, cxp, gy - 0.14, czp);

  // picnic table with attached benches
  for (const off of [-2.4, 2.4]) {
    const b = { x: cxp + off, y: gy, z: czp, r: 0 };
    k.p(b, 0, 0.75, 0, 1.5, 0.08, 2.4, M.get('walnut'), 0.8);
    for (const oz of [-1.0, 1.0]) k.p(b, 0, 0.38, oz, 1.4, 0.1, 0.12, M.get('walnut'), 0.4);
    for (const s of [-1, 1]) {
      k.p(b, s * 1.05, 0.45, 0, 0.4, 0.07, 2.3, M.get('walnut'), 0.6);
      k.p(b, s * 1.05, 0.22, 0, 0.1, 0.44, 0.1, M.get('walnut'), 0.3);
      world.addInteract({ pos: V(b.x + s * 1.05, gy + 0.5, czp), radius: 1.4, label: 'Sit down', kind: 'seat', seat: { x: b.x + s * 1.05, y: gy + 0.52, z: czp, rotY: s > 0 ? Math.PI / 2 : -Math.PI / 2 } });
    }
    k.pc(b, 0, 0.4, 0, 2.6, 0.8, 2.4);
  }

  // grill
  B.box(1.3, 0.9, 0.7, M.get('steel'), cxp + 5.6, gy + 0.45, czp - 2, { tile: 0.5 });
  B.box(1.4, 0.16, 0.8, M.get('blackMetal'), cxp + 5.6, gy + 0.98, czp - 2, { tile: 0.4 });
  world.collider(1.4, 1.0, 0.8, cxp + 5.6, gy + 0.5, czp - 2);

  // fire pit
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    B.box(0.7, 0.44, 0.4, M.get('stone'), cxp + Math.cos(a) * 1.5, gy + 0.22, czp + 5.5 + Math.sin(a) * 1.5, { rotY: Math.PI / 2 - a, tile: 0.6 });
    world.collider(0.7, 0.44, 0.4, cxp + Math.cos(a) * 1.5, gy + 0.22, czp + 5.5 + Math.sin(a) * 1.5, Math.PI / 2 - a);
  }
  const logs = new THREE.Group();
  logs.position.set(cxp, gy + 0.1, czp + 5.5);
  for (let i = 0; i < 5; i++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 1.0, 7), M.solid(0x4a3524, 0.95));
    l.rotation.set(0.2, (i / 5) * Math.PI, Math.PI / 2 - 0.25);
    l.position.set(0, 0.12, 0);
    logs.add(l);
  }
  const flames = [];
  for (let i = 0; i < 8; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 6),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffb347 : 0xff6a1e, transparent: true, opacity: 0.7, depthWrite: false }));
    f.position.set((Math.random() - 0.5) * 0.7, 0.4, (Math.random() - 0.5) * 0.7);
    logs.add(f); flames.push(f);
  }
  const fireLight = new THREE.PointLight(0xff8a3c, 0, 14, 2);
  fireLight.position.set(0, 0.9, 0);
  logs.add(fireLight);
  logs.visible = false;
  world.addProp(logs);
  world.onUpdate((dt, t) => {
    if (!logs.visible) return;
    flames.forEach((f, i) => {
      const s = 0.6 + Math.abs(Math.sin(t * (3.2 + i * 0.6) + i)) * 0.8;
      f.scale.set(1, s, 1); f.material.opacity = 0.4 + s * 0.3;
    });
    fireLight.intensity = 9 + Math.sin(t * 8.1) * 2.4;
  });
  world.addInteract({
    pos: V(cxp, gy + 0.4, czp + 5.5), radius: 2.6,
    label: () => (logs.visible ? 'Put out the fire pit' : 'Light the fire pit'),
    onUse: () => { logs.visible = !logs.visible; return logs.visible ? 'fire' : 'click'; },
  });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    world.addInteract({
      pos: V(cxp + Math.cos(a) * 2.6, gy + 0.4, czp + 5.5 + Math.sin(a) * 2.6), radius: 1.4, label: 'Sit by the fire',
      kind: 'seat', seat: { x: cxp + Math.cos(a) * 2.6, y: gy + 0.45, z: czp + 5.5 + Math.sin(a) * 2.6, rotY: -a + Math.PI },
    });
    B.box(0.5, 0.42, 0.5, M.get('walnut'), cxp + Math.cos(a) * 2.6, gy + 0.21, czp + 5.5 + Math.sin(a) * 2.6, { rotY: -a, tile: 0.4 });
  }
  world.spot('picnic', cxp, gy, czp - 3);
  world.spot('firePit', cxp, gy, czp + 3.0);
}

// ── skate park ─────────────────────────────────────────────────────────────
function skatePark(world, k, M, B) {
  const cxp = 26, czp = 62;
  const conc = M.get('polishedConcrete');
  const gy = groundHeight(cxp, czp);

  const top = gy + 0.3;
  const bx = cxp - 8, bz = czp + 4, R = 6.4;      // the bowl

  // Pad, with the bowl's footprint cut out of it — a solid slab here would
  // fill the dish in and there would be nothing to drop into.
  for (const r of rectSubtract(
    { x0: cxp - 17, x1: cxp + 17, z0: czp - 13, z1: czp + 13 },
    [{ x0: bx - R, x1: bx + R, z0: bz - R, z1: bz + R }],
  )) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    B.box(w, 0.4, d, conc, (r.x0 + r.x1) / 2, gy + 0.1, (r.z0 + r.z1) / 2, { tile: 2.4 });
    world.collider(w, 0.4, d, (r.x0 + r.x1) / 2, gy + 0.1, (r.z0 + r.z1) / 2);
  }

  // ── the bowl: a square dish, so its rim meets the cut-out exactly ──
  const bowlMesh = new THREE.Mesh(bowlGeometry(R, 2.6, 24), conc);
  bowlMesh.position.set(bx, top, bz);
  bowlMesh.receiveShadow = true;
  world.staticRoot.add(bowlMesh);
  const bowlCol = new THREE.Mesh(bowlGeometry(R, 2.6, 14), world.colliderMat);
  bowlCol.position.copy(bowlMesh.position);
  world.colliderRoot.add(bowlCol);
  // coping along all four lips
  for (const s of [-1, 1]) {
    B.box(R * 2 + 0.16, 0.1, 0.16, M.get('chrome'), bx, top + 0.03, bz + s * R, { tile: 0.3 });
    B.box(0.16, 0.1, R * 2 + 0.16, M.get('chrome'), bx + s * R, top + 0.03, bz, { tile: 0.3 });
  }

  // ── quarter pipe ──
  quarterPipe(world, k, conc, cxp + 11, top, czp - 6, 8.0, 2.4, Math.PI);
  quarterPipe(world, k, conc, cxp + 11, top, czp + 6, 8.0, 2.4, 0);

  // ── funbox with ledges + rails ──
  const fx = cxp + 1, fz = czp - 8;
  B.box(5.0, 0.7, 3.4, conc, fx, top + 0.35, fz, { tile: 1.2 });
  world.collider(5.0, 0.7, 3.4, fx, top + 0.35, fz);
  for (const s of [-1, 1]) {
    // banked approaches
    for (let i = 0; i < 8; i++) {
      const t = i / 8;
      B.box(5.0, 0.7 * (1 - t) + 0.06, 0.32, conc, fx, top + (0.7 * (1 - t)) / 2, fz + s * (1.7 + i * 0.3), { tile: 0.8 });
      world.collider(5.0, 0.7 * (1 - t) + 0.06, 0.32, fx, top + (0.7 * (1 - t)) / 2, fz + s * (1.7 + i * 0.3));
    }
    B.box(5.2, 0.12, 0.12, M.get('chrome'), fx, top + 0.76, fz + s * 1.65, { tile: 0.3 });
  }
  // flat rail
  for (const s of [-1, 1]) {
    B.box(0.09, 0.5, 0.09, M.get('blackMetal'), cxp - 3 + s * 3, top + 0.25, czp - 2, { tile: 0.2 });
  }
  B.box(6.2, 0.09, 0.09, M.get('chrome'), cxp - 3, top + 0.52, czp - 2, { tile: 0.3 });
  world.collider(6.2, 0.16, 0.16, cxp - 3, top + 0.52, czp - 2);
  // kicker
  for (let i = 0; i < 10; i++) {
    const t = i / 10;
    B.box(2.4, 0.9 * t + 0.05, 0.26, conc, cxp - 3, top + (0.9 * t) / 2, czp + 9 - i * 0.26, { tile: 0.6 });
    world.collider(2.4, 0.9 * t + 0.05, 0.26, cxp - 3, top + (0.9 * t) / 2, czp + 9 - i * 0.26);
  }
  // grind ledge
  B.box(4.0, 0.45, 0.7, conc, cxp + 6, top + 0.22, czp + 11, { tile: 0.8 });
  B.box(4.1, 0.06, 0.76, M.get('chrome'), cxp + 6, top + 0.47, czp + 11, { tile: 0.4 });
  world.collider(4.0, 0.5, 0.7, cxp + 6, top + 0.22, czp + 11);

  // floodlights + fence — two heads per mast: one washes the near ramps, one
  // is thrown out over the pad so the flat actually reads as floodlit
  for (const s of [-1, 1]) {
    B.box(0.24, 7.0, 0.24, M.get('blackMetal'), cxp + s * 15, top + 3.5, czp - 11, { tile: 0.6 });
    B.box(1.2, 0.4, 0.5, M.emissiveDim(0xf0f6ff, 2.0), cxp + s * 15, top + 6.9, czp - 10.6, { rotX: 0.35, tile: 0.4 });
    B.box(1.0, 0.35, 0.5, M.emissiveDim(0xf0f6ff, 2.0), cxp + s * 15, top + 6.35, czp - 10.55, { rotX: 0.7, tile: 0.4 });
    world.addLight({ pos: V(cxp + s * 14, top + 6.2, czp - 9.4), color: 0xeaf2ff, intensity: 26, distance: 26, decay: 1.5, outdoor: true, night: true });
    world.addLight({ pos: V(cxp + s * 9, top + 5.0, czp - 2.5), color: 0xeaf2ff, intensity: 26, distance: 26, decay: 1.5, outdoor: true, night: true });
    world.collider(0.3, 7.0, 0.3, cxp + s * 15, top + 3.5, czp - 11);
  }
  world.spot('skatepark', cxp - 8, top, czp - 4);
  world.spot('skateBowl', cxp - 8, top, czp + 4);

  // a skateboard you can carry around
  world.propSpawns.push({ kind: 'skateboard', x: cxp - 2, y: top + 0.3, z: czp - 4 });
}

/**
 * A square dish — flat in the middle, curving up to a square rim at y = 0, so
 * it drops straight into a rectangular hole cut in the pad. `n` is the number
 * of quads per side.
 */
function bowlGeometry(half, depth, n = 24) {
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const x = -half + (i / n) * half * 2;
      const z = -half + (j / n) * half * 2;
      const t = Math.max(Math.abs(x), Math.abs(z)) / half;   // 0 centre → 1 rim
      pos.push(x, -depth * Math.cos((t * Math.PI) / 2), z);
      uv.push(x / 2, z / 2);
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * (n + 1) + j, b = a + n + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function quarterPipe(world, k, mat, x, y, z, width, height, rotY) {
  const B = k.B;
  const n = 12;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const y0 = height * (1 - Math.cos(t0 * Math.PI / 2));
    const y1 = height * (1 - Math.cos(t1 * Math.PI / 2));
    const z0 = height * Math.sin(t0 * Math.PI / 2);
    const z1 = height * Math.sin(t1 * Math.PI / 2);
    const cy = (y0 + y1) / 2, czl = (z0 + z1) / 2;
    const dy = y1 - y0, dz = z1 - z0;
    const len = Math.hypot(dy, dz);
    const ang = Math.atan2(dy, dz);
    const wx = x + Math.sin(rotY) * czl, wz = z + Math.cos(rotY) * czl;
    B.box(width, 0.22, len + 0.05, mat, wx, y + cy, wz, { rotY, rotX: -ang, tile: 1 });
    world.collider(width, 0.3, len + 0.05, wx, y + cy, wz, rotY);
  }
  // deck + coping
  const dz2 = height;
  B.box(width, 0.4, 1.6, mat, x + Math.sin(rotY) * (dz2 + 0.8), y + height - 0.2, z + Math.cos(rotY) * (dz2 + 0.8), { rotY, tile: 1 });
  world.collider(width, 0.4, 1.6, x + Math.sin(rotY) * (dz2 + 0.8), y + height - 0.2, z + Math.cos(rotY) * (dz2 + 0.8), rotY);
  B.box(width, 0.11, 0.11, k.M.get('chrome'), x + Math.sin(rotY) * dz2, y + height + 0.03, z + Math.cos(rotY) * dz2, { rotY, tile: 0.3 });
}

// ── shed ───────────────────────────────────────────────────────────────────
function shed(world, k, M, B) {
  const x = -38, z = 26, w = 7.0, d = 5.0, h = 2.9;
  const gy = groundHeight(x, z);
  const wood = M.paint(0x5d6b52, 0.85, 'shedwood');
  const trim = M.paint(0xe8e6df, 0.7, 'shedtrim');

  B.box(w + 0.6, 0.3, d + 0.6, M.get('concrete'), x, gy + 0.05, z, { tile: 1.2 });
  world.collider(w + 0.6, 0.3, d + 0.6, x, gy + 0.05, z);
  const y = gy + 0.2;
  // walls with a doorway on the south face
  B.box(w, h, 0.16, wood, x, y + h / 2, z - d / 2, { tile: 1.6 });
  world.collider(w, h, 0.2, x, y + h / 2, z - d / 2);
  for (const s of [-1, 1]) {
    B.box(0.16, h, d, wood, x + s * w / 2, y + h / 2, z, { tile: 1.6 });
    world.collider(0.2, h, d, x + s * w / 2, y + h / 2, z);
    B.box((w - 2.2) / 2, h, 0.16, wood, x + s * (w / 2 - (w - 2.2) / 4), y + h / 2, z + d / 2, { tile: 1.6 });
    world.collider((w - 2.2) / 2, h, 0.2, x + s * (w / 2 - (w - 2.2) / 4), y + h / 2, z + d / 2);
  }
  B.box(2.2, h - 2.2, 0.16, wood, x, y + h - (h - 2.2) / 2, z + d / 2, { tile: 1.2 });
  // gable roof
  for (const s of [-1, 1]) {
    B.box(w + 0.8, 0.16, d * 0.62, M.get('shingle'), x, y + h + 0.55, z + s * d * 0.26, { rotX: s * 0.62, tile: 1.2 });
    world.collider(w + 0.8, 0.2, d * 0.62, x, y + h + 0.55, z + s * d * 0.26, 0);
  }
  B.box(w + 0.8, 0.14, 0.3, trim, x, y + h + 1.1, z, { tile: 0.6 });
  B.box(2.4, 0.12, 0.5, trim, x, y + 2.3, z + d / 2 + 0.1, { tile: 0.5 });
  // Gable ends.  The side walls stop at the wall head and the roof climbs on
  // past them, so both ends stood open — from inside you looked straight out
  // at the sky through the triangle. Stepped boards close it.
  for (const s of [-1, 1]) {
    const steps = 7, rise = 1.5;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps, t1 = (i + 1) / steps;
      B.box(0.17, rise / steps + 0.02, d * (1 - t1) + 0.12, wood,
        x + s * w / 2, y + h + rise * (t0 + t1) / 2, z, { tile: 1.2 });
    }
  }
  // and a boarded soffit so the shingles are not the ceiling from inside
  for (const s of [-1, 1]) {
    B.box(w - 0.1, 0.08, d * 0.6, M.paint(0x7a8570, 0.9, 'shedsoffit'),
      x, y + h + 0.42, z + s * d * 0.25, { rotX: s * 0.62, tile: 1.0 });
  }

  // ── contents: mower, trimmer, tools, fuel, bags ──
  const rmat = M.paint(0xd0342c, 0.5, 'mower');
  const mb = { x: x - 1.6, y, z: z + 0.4, r: 0.3 };
  k.p(mb, 0, 0.42, 0, 1.1, 0.5, 1.4, rmat, 0.6);
  k.p(mb, 0, 0.72, -0.2, 1.0, 0.3, 0.5, M.get('blackMetal'), 0.5);
  k.p(mb, 0, 0.95, 0.7, 1.0, 0.06, 0.06, M.get('blackMetal'), 0.3);
  k.p(mb, 0, 0.7, 0.55, 0.06, 0.5, 0.5, M.get('blackMetal'), 0.3);
  for (const [ox, oz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.55], [0.5, 0.55]]) {
    k.p(mb, ox, 0.2, oz, 0.4, 0.4, 0.16, M.get('rubber'), 0.3);
  }
  k.pc(mb, 0, 0.5, 0, 1.3, 1.0, 1.6);

  // shelving + wall tools
  B.box(w - 1.0, 0.06, 0.45, M.get('maple'), x, y + 1.5, z - d / 2 + 0.32, { tile: 0.7 });
  B.box(w - 1.0, 0.06, 0.45, M.get('maple'), x, y + 2.1, z - d / 2 + 0.32, { tile: 0.7 });
  const cans = [0xd0342c, 0x2f81ff, 0xf0b429];
  for (let i = 0; i < 6; i++) {
    B.box(0.3, 0.4, 0.28, M.solid(cans[i % 3], 0.6), x - 2.2 + i * 0.9, y + 1.75, z - d / 2 + 0.32, { tile: 0.2 });
    B.box(0.26, 0.3, 0.24, M.paint(0x9a8b78, 0.9, 'sack'), x - 2.2 + i * 0.9, y + 2.3, z - d / 2 + 0.32, { tile: 0.2 });
  }
  // Long-handled tools, stood against the west wall.  They used to stand in
  // the plane of the doorway — three of them squarely in the 2.2 m opening —
  // which read from outside as junk dumped across the entrance.
  const tools = [0x8a8f96, 0x6b5330, 0x2f81ff, 0xd0342c];
  const rail = M.paint(0x6b5330, 0.85, 'toolrail');
  B.box(0.06, 0.08, 3.6, rail, x - w / 2 + 0.3, y + 1.85, z, { tile: 0.4 });
  for (let i = 0; i < 7; i++) {
    const tz = z - 1.55 + i * 0.52;
    B.box(0.12, 1.8, 0.09, M.solid(tools[i % 4], 0.6), x - w / 2 + 0.26, y + 0.9, tz,
      { rotX: 0.07 * (i % 3 - 1), tile: 0.3 });
    // the head — a blade, a fork, a brush — sat on the floor at the bottom
    B.box(0.16, 0.1, 0.2, M.solid(tools[(i + 2) % 4], 0.6), x - w / 2 + 0.3, y + 0.05, tz, { tile: 0.15 });
  }
  // wheelbarrow — tub on sloped handle rails: wheel at the nose, legs at the
  // handle end, so it parks on the floor instead of floating
  const wbx = x + 2.2, wbz = z - 0.6, frame = M.get('blackMetal');
  B.box(0.9, 0.3, 0.6, M.paint(0x2f81ff, 0.6, 'barrow'), wbx, y + 0.46, wbz, { rotX: -0.2, tile: 0.4 });
  for (const s of [-1, 1]) {
    B.box(0.05, 0.06, 1.7, frame, wbx + s * 0.24, y + 0.33, wbz + 0.25, { rotX: -0.22, tile: 0.3 });  // handle rails
    B.box(0.05, 0.38, 0.05, frame, wbx + s * 0.24, y + 0.19, wbz + 0.55, { tile: 0.2 });              // rear legs
  }
  B.box(0.1, 0.34, 0.34, M.get('rubber'), wbx, y + 0.17, wbz - 0.55, { tile: 0.2 });                  // front wheel
  world.collider(0.9, 0.9, 1.9, wbx, y + 0.45, wbz + 0.2);

  world.addLight({ pos: V(x, y + h - 0.4, z), color: 0xffe0b0, intensity: 14, distance: 9, room: 'Shed' });
  world.addRoom({ name: 'Garden Shed', type: 'shed', floor: 'ground', floorName: 'Grounds', x, z, y, w, d, h });
  world.spot('shed', x, y, z + d / 2 + 2);
}

// ── driveway & front ───────────────────────────────────────────────────────
function driveway(world, k, M, B) {
  const asphalt = M.get('asphalt');
  // main run out to the road
  B.box(12, 0.16, 46, asphalt, 6, 0.02, -36, { tile: 3 });
  world.collider(12, 0.2, 46, 6, 0.0, -36);
  // the lawn falls away beyond the pad, so the last stretch to the front gate
  // rides the ground down
  const roadY = (z) => 0.02 + (groundHeight(6, z) + 0.12 - 0.02) * smoothstep(60, 74, -z);
  for (let i = 0; i < 8; i++) {
    const z0 = -59 - i * 1.95, z1 = z0 - 1.95;
    const y0 = roadY(z0), y1 = roadY(z1);
    B.box(12, 0.16, Math.hypot(1.95, y1 - y0) + 0.06, asphalt, 6, (y0 + y1) / 2, (z0 + z1) / 2, { rotX: -Math.atan2(y0 - y1, 1.95), tile: 3 });
    world.collider(12, 0.22, 2.0, 6, (y0 + y1) / 2 - 0.02, (z0 + z1) / 2);
  }
  // apron in front of the garage
  B.box(26, 0.16, 14, asphalt, 14, 0.02, -20, { tile: 3 });
  world.collider(26, 0.2, 14, 14, 0.0, -20);
  // circular turnaround
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    B.box(6.2, 0.16, 6.2, asphalt, -8 + Math.cos(a) * 9, 0.02, -26 + Math.sin(a) * 9, { rotY: -a, tile: 3 });
    world.collider(6.2, 0.2, 6.2, -8 + Math.cos(a) * 9, 0.0, -26 + Math.sin(a) * 9, -a);
  }
  // island of grass with a fountain in the middle of the turnaround
  B.box(7.2, 0.4, 7.2, M.get('grass'), -8, 0.12, -26, { tile: 1.4 });
  world.collider(7.2, 0.4, 7.2, -8, 0.12, -26);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    B.box(0.7, 0.7, 0.4, M.get('stone'), -8 + Math.cos(a) * 1.9, 0.55, -26 + Math.sin(a) * 1.9, { rotY: Math.PI / 2 - a, tile: 0.5 });
  }
  B.box(0.5, 1.6, 0.5, M.get('stone'), -8, 1.1, -26, { tile: 0.5 });
  B.box(1.5, 0.16, 1.5, M.get('stone'), -8, 1.9, -26, { tile: 0.5 });
  world.collider(1.4, 1.9, 1.4, -8, 0.95, -26);
  makeWater(world, 3.6, 3.6, -8, 0.42, -26, 0x2b7f9c, 0.85);

  // walkway to the front door (ends where the porch begins)
  B.box(4.0, 0.16, 7.4, M.get('stone'), 0, 0.03, -21.3, { tile: 1.4 });
  world.collider(4.0, 0.2, 7.4, 0, 0.0, -21.3);
  // shallow step off the walkway onto the porch
  B.box(4.0, 0.12, 0.6, M.get('stone'), 0, 0.0, -17.55, { tile: 1 });
  world.collider(4.0, 0.16, 0.6, 0, -0.02, -17.55);
  // porch — finish floor just below the foyer slab, edge clear of the door swing
  B.box(14, 0.35, 4.3, M.get('stone'), 0, -0.15, -15.3, { tile: 1.4 });
  world.collider(14, 0.35, 4.3, 0, -0.15, -15.3);
  for (const s of [-1, 1]) {
    B.box(0.6, 5.2, 0.6, M.get('stone'), s * 5.4, 2.62, -15.6, { tile: 1 });
    world.collider(0.7, 5.2, 0.7, s * 5.4, 2.62, -15.6);
    plant(k, s * 3.6, 0.03, -15.0, 1.2);
  }
  B.box(13.4, 0.5, 5.0, M.get('shingle'), 0, 5.4, -15.4, { tile: 1.2 });
  world.addLight({ pos: V(0, 4.4, -14.6), color: 0xffd9a0, intensity: 48, distance: 16, decay: 1.7, outdoor: true, night: true });
  for (const s of [-1, 1]) {
    B.box(0.24, 0.5, 0.24, M.emissiveDim(0xffcf8a, 1.6), s * 1.9, 2.5, -13.3, { tile: 0.2 });
  }
  // lamp posts along the drive — the west row sits wide of the front walkway
  // (x -2..2), which would otherwise get a post dead-centre in the path
  for (let i = 0; i < 6; i++) {
    const z = -22 - i * 8;
    for (const s of [-1, 1]) {
      const x = s > 0 ? 6 + 7.5 : 6 - 9.6;
      B.box(0.18, 3.4, 0.18, M.get('blackMetal'), x, 1.7, z, { tile: 0.4 });
      B.box(0.4, 0.5, 0.4, M.emissiveDim(0xffd79a, 2.2), x, 3.6, z, { tile: 0.3 });
      world.collider(0.24, 3.4, 0.24, x, 1.7, z);
      world.addLight({ pos: V(x, 3.5, z), color: 0xffc98a, intensity: 48, distance: 17, decay: 1.7, outdoor: true, night: true });
    }
  }
  world.spot('driveway', 6, 0, -22);
  world.spot('frontPorch', 0, 0.2, -15.5);
}

function fencing(world, k, M, B, rng) {
  const post = M.paint(0x6b6157, 0.9, 'fence');
  const runs = [
    { x0: -70, x1: 70, z: 78, axis: 'x' },
    { x0: -70, x1: 70, z: -74, axis: 'x' },
    { z0: -74, z1: 78, x: -70, axis: 'z' },
    { z0: -74, z1: 78, x: 70, axis: 'z' },
  ];
  for (const r of runs) {
    const len = r.axis === 'x' ? r.x1 - r.x0 : r.z1 - r.z0;
    const n = Math.floor(len / 3);
    const inGate = (v) => r.axis === 'x' && r.z < 0 && v > 0.5 && v < 11.8;   // gate at the drive
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = r.axis === 'x' ? r.x0 + t * len : r.x;
      const z = r.axis === 'x' ? r.z : r.z0 + t * len;
      if (inGate(x)) continue;
      const gy = groundHeight(x, z);
      B.box(0.16, 1.5, 0.16, post, x, gy + 0.75, z, { tile: 0.4 });
      if (i < n) {
        const nx = r.axis === 'x' ? x + len / n : x;
        const nz = r.axis === 'x' ? z : z + len / n;
        if (inGate(nx)) continue;
        const gy2 = groundHeight(nx, nz);
        for (const hh of [0.55, 1.05]) {
          B.box(r.axis === 'x' ? len / n : 0.08, 0.1, r.axis === 'x' ? 0.08 : len / n, post,
            (x + nx) / 2, (gy + gy2) / 2 + hh, (z + nz) / 2, { tile: 0.5 });
        }
        world.collider(r.axis === 'x' ? len / n : 0.14, 1.5, r.axis === 'x' ? 0.14 : len / n,
          (x + nx) / 2, (gy + gy2) / 2 + 0.75, (z + nz) / 2);
      }
    }
  }

  // gate pillars on the fence-post grid either side of the drive, iron
  // leaves swung open against the fence
  const bay = 140 / 46, gcx = 25 * bay - 70;
  const iron = M.get('blackMetal');
  for (const s of [-1, 1]) {
    const gx = gcx + s * 2 * bay;
    const gy = groundHeight(gx, -74);
    B.box(0.55, 2.4, 0.55, M.get('stone'), gx, gy + 1.2, -74, { tile: 0.8 });
    B.box(0.8, 0.18, 0.8, M.get('stone'), gx, gy + 2.49, -74, { tile: 0.6 });
    world.collider(0.6, 2.6, 0.6, gx, gy + 1.3, -74);
    const open = 2.95;                 // swung right back and parked against the fence
    const dxv = -s * Math.cos(open), dzv = Math.sin(open);
    const rotY = Math.atan2(-dzv, dxv);
    for (const hh of [0.32, 1.42]) {
      B.box(5.6, 0.08, 0.06, iron, gx + dxv * 2.8, gy + hh, -74 + dzv * 2.8, { rotY, tile: 0.5 });
    }
    for (let j = 0; j < 12; j++) {
      const dd = 0.3 + j * 0.46;
      B.box(0.05, 1.5, 0.05, iron, gx + dxv * dd, gy + 0.85, -74 + dzv * dd, { tile: 0.3 });
    }
    world.collider(5.6, 1.7, 0.12, gx + dxv * 2.8, gy + 0.85, -74 + dzv * 2.8, rotY);
  }
}
