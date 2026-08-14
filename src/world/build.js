// ───────────────────────────────────────────────────────────────────────────
// Construction kit.
//
// Architecture is authored as thousands of small boxes and then *merged per
// material* so the whole mansion draws in a few dozen calls.  UVs are
// projected in world space, which gives every wall, floor and stair the same
// texel density no matter how big it is.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();

/** Project UVs in world space so tiling never stretches. */
export function planarUV(geo, tile = 1, matrix = null) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  if (!nor) geo.computeVertexNormals();
  const uv = new Float32Array(pos.count * 2);
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  const nm = matrix ? new THREE.Matrix3().getNormalMatrix(matrix) : null;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(geo.attributes.normal, i);
    if (matrix) { p.applyMatrix4(matrix); n.applyMatrix3(nm).normalize(); }
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    let u, v;
    if (ay >= ax && ay >= az) { u = p.x; v = p.z; }
    else if (ax >= az) { u = p.z; v = p.y; }
    else { u = p.x; v = p.y; }
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** Collects geometry per material and merges on flush(). */
export class Batcher {
  constructor(name = 'batch') {
    this.name = name;
    this.buckets = new Map();   // material -> geometry[]
    this.group = new THREE.Group();
    this.group.name = name;
  }

  add(geo, material, matrix = null) {
    const g = matrix ? geo.clone().applyMatrix4(matrix) : geo;
    let arr = this.buckets.get(material);
    if (!arr) this.buckets.set(material, (arr = []));
    arr.push(g);
    return this;
  }

  /**
   * Box helper.
   * opts: { tile, rotY, rotX, rotZ, uvWorld }
   */
  box(w, h, d, material, x, y, z, opts = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    _e.set(opts.rotX || 0, opts.rotY || 0, opts.rotZ || 0, 'YXZ');
    _q.setFromEuler(_e);
    _m.compose(_v.set(x, y, z), _q, new THREE.Vector3(1, 1, 1));
    if (opts.tile) planarUV(geo, opts.tile, _m);
    this.add(geo, material, _m);
    return this;
  }

  flush(parent) {
    // Merge per material *and* per ~22 m cell: one estate-wide mesh per
    // material has a 400 m bounding sphere, so standing in a basement bathroom
    // still vertex-processes every tree — cells give frustum culling something
    // to reject. Extra draws share the material, so they cost almost nothing.
    const CELL = 22, BAND = 6;
    const box = new THREE.Box3();
    for (const [mat, list] of this.buckets) {
      if (!list.length) continue;
      const cells = new Map();
      for (const g of list) {
        box.setFromBufferAttribute(g.attributes.position);
        const cx = Math.floor((box.min.x + box.max.x) / 2 / CELL);
        const cy = Math.floor((box.min.y + box.max.y) / 2 / BAND);
        const cz = Math.floor((box.min.z + box.max.z) / 2 / CELL);
        const key = `${cx}|${cy}|${cz}`;
        let arr = cells.get(key);
        if (!arr) cells.set(key, (arr = []));
        arr.push(g);
      }
      for (const arr of cells.values()) {
        let merged;
        try {
          merged = mergeGeometries(arr, false);
        } catch (e) {
          merged = null;
        }
        if (!merged) {                     // fall back to individual meshes
          for (const g of arr) parent.add(new THREE.Mesh(g, mat));
          continue;
        }
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = `${this.name}:${mat.name || 'mat'}`;
        parent.add(mesh);
        for (const g of arr) g.dispose();
      }
    }
    this.buckets.clear();
    return parent;
  }
}

/** Simple mesh helper used for props that stay individual objects. */
export function mesh(geo, mat, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (opts.rotY) m.rotation.y = opts.rotY;
  if (opts.rotX) m.rotation.x = opts.rotX;
  if (opts.rotZ) m.rotation.z = opts.rotZ;
  m.castShadow = opts.cast !== false;
  m.receiveShadow = opts.receive !== false;
  if (opts.name) m.name = opts.name;
  return m;
}

export function boxMesh(w, h, d, mat, x, y, z, opts = {}) {
  const g = new THREE.BoxGeometry(w, h, d, opts.seg || 1, opts.seg || 1, opts.seg || 1);
  if (opts.tile) planarUV(g, opts.tile);
  return mesh(g, mat, x, y, z, opts);
}

/**
 * A wall segment with rectangular openings punched out of it (doors, windows,
 * pass-throughs).  Runs along X, centred on (x,z), thickness on Z.
 * openings: [{ x: centreOffset, w, y0, y1 }]
 */
export function wallWithOpenings(batch, mat, cx, cz, len, height, thick, openings = [], rotY = 0, tile = 2, baseY = 0) {
  const cuts = openings
    .map((o) => ({ a: o.x - o.w / 2, b: o.x + o.w / 2, y0: o.y0 ?? 0, y1: o.y1 ?? 2.1 }))
    .sort((p, q) => p.a - q.a);

  const half = len / 2;
  const put = (x0, x1, y0, y1) => {
    if (x1 - x0 < 0.004 || y1 - y0 < 0.004) return;
    const w = x1 - x0, h = y1 - y0;
    const lx = (x0 + x1) / 2;           // local along-wall centre
    const wx = cx + Math.cos(rotY) * lx;
    const wz = cz - Math.sin(rotY) * lx;
    batch.box(w, h, thick, mat, wx, baseY + (y0 + y1) / 2, wz, { rotY, tile });
  };

  // full-height strips between the openings
  let cursor = -half;
  for (const c of cuts) {
    const a = Math.max(-half, c.a), b = Math.min(half, c.b);
    if (a > cursor) put(cursor, a, 0, height);
    // above / below the opening
    put(a, b, 0, Math.min(c.y0, height));
    put(a, b, Math.min(c.y1, height), height);
    cursor = Math.max(cursor, b);
  }
  if (cursor < half) put(cursor, half, 0, height);
}

/** Straight run of stairs along +Z, `steps` risers of `rise` × `run`. */
export function stairs(batch, mat, x, y, z, width, steps, rise, run, rotY = 0, tile = 1.2) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  for (let i = 0; i < steps; i++) {
    const lz = (i + 0.5) * run;
    const h = (i + 1) * rise;
    batch.box(width, h, run, mat,
      x + s * lz, y + h / 2, z + c * lz, { rotY, tile });
  }
  return { top: y + steps * rise, length: steps * run };
}

/**
 * Railing: posts + top rail along X. Takes the world rather than a batch so it
 * can register collision — a guard rail you can walk through is worse than no
 * rail at all.
 */
export function railing(world, matPost, matRail, cx, y, cz, len, rotY = 0, h = 1.05, spacing = 0.9) {
  const batch = world.static;
  const n = Math.max(2, Math.round(len / spacing));
  for (let i = 0; i <= n; i++) {
    const lx = -len / 2 + (i / n) * len;
    batch.box(0.05, h, 0.05, matPost,
      cx + Math.cos(rotY) * lx, y + h / 2, cz - Math.sin(rotY) * lx, { rotY, tile: 1 });
  }
  batch.box(len, 0.07, 0.11, matRail, cx, y + h, cz, { rotY, tile: 1 });
  batch.box(len, 0.05, 0.05, matRail, cx, y + h * 0.45, cz, { rotY, tile: 1 });
  world.collider(len, h, 0.14, cx, y + h / 2, cz, rotY);
}

export const deg = (d) => (d * Math.PI) / 180;
