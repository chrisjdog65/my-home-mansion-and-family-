// ───────────────────────────────────────────────────────────────────────────
// Instanced grass: thousands of blade tufts scattered over the lawn in a
// single draw call, with a light wind sway in the vertex shader. This is what
// stops the yard reading as a green billiard table.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng } from '../core/rng.js';
import { groundHeight } from './terrain.js';

// Nothing grows through concrete, water or the house.
const KEEPOUT = [
  { x0: -32, x1: 32, z0: -15.5, z1: 15.5 },   // house + skirt
  { x0: -17, x1: 21, z0: 13, z1: 33.5 },      // pool terrace + hot tub
  { x0: 5, x1: 47, z0: 46, z1: 79 },          // skate park
  { x0: 10, x1: 34, z0: 28, z1: 48 },         // picnic terrace
  { x0: -47, x1: -29, z0: 16, z1: 36 },       // shed
  { x0: 0, x1: 12, z0: -60, z1: -13 },        // straight drive
  { x0: 1, x1: 28, z0: -28, z1: -13 },        // parking apron
  // The guest house, kept as three rectangles rather than one box so the L's
  // courtyard between the garage and the front door keeps its lawn.
  { x0: 37, x1: 54, z0: -40, z1: -14 },       // guest house + skirt
  { x0: 28, x1: 41, z0: -40, z1: -22 },       // its garage + skirt
  { x0: 17, x1: 31, z0: -41, z1: -23 },       // the forecourt
];
const KEEPOUT_R = [
  { x: -22, z: 48, r: 15 },                   // pond
  { x: -8, z: -26, r: 14 },                   // drive loop
];

function blocked(x, z) {
  for (const k of KEEPOUT) if (x > k.x0 && x < k.x1 && z > k.z0 && z < k.z1) return true;
  for (const k of KEEPOUT_R) if (Math.hypot(x - k.x, z - k.z) < k.r) return true;
  return false;
}

function bladeCanvas() {
  const W = 64, H = 64;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const rng = makeRng(909);
  for (let i = 0; i < 9; i++) {
    const x0 = 6 + i * 6 + rng.range(-2, 2);
    const lean = rng.range(-6, 6);
    const h = H * rng.range(0.55, 0.98);
    const g = ctx.createLinearGradient(0, H, 0, H - h);
    g.addColorStop(0, '#3d6428');
    g.addColorStop(1, '#7fa348');
    ctx.strokeStyle = g;
    ctx.lineWidth = rng.range(2.4, 4.2);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, H);
    ctx.quadraticCurveTo(x0 + lean * 0.4, H - h * 0.6, x0 + lean, H - h);
    ctx.stroke();
  }
  return c;
}

export function plantGrass(world, count = 7000) {
  const rng = makeRng(13579);

  const tex = new THREE.CanvasTexture(bladeCanvas());
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    map: tex, alphaTest: 0.4, side: THREE.DoubleSide,
    roughness: 0.95, metalness: 0,
  });

  // wind sway — bend the tops, leave the roots planted
  const uTime = { value: 0 };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  float gPhase = instanceMatrix[3][0] * 1.71 + instanceMatrix[3][2] * 2.33;
  float gBend = uv.y * uv.y;
  transformed.x += gBend * (sin(uTime * 1.8 + gPhase) * 0.055 + sin(uTime * 3.9 + gPhase * 1.7) * 0.022);
  transformed.z += gBend * cos(uTime * 1.5 + gPhase) * 0.03;
#endif`);
    // A tuft is two upright quads, so every one of its normals lies flat in the
    // horizontal plane and the sun — 58° up at noon — only grazes them. Left
    // alone the tufts shade at roughly a third of the lawn they stand in and
    // read as dirt speckles on it. Leaning them half-way to world up sits them
    // in the grass while keeping some blade-to-blade variation; all the way and
    // they shade identically to the ground and there is no point drawing them.
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
// after the include, so DOUBLE_SIDED has already flipped the back faces
normal = normalize(mix(normal, (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz, 0.55));`);
  };

  const quad = new THREE.PlaneGeometry(0.52, 0.44, 1, 2);
  quad.translate(0, 0.22, 0);
  const quad2 = quad.clone().rotateY(Math.PI / 2);
  const tuft = mergeGeometries([quad, quad2]);

  const mesh = new THREE.InstancedMesh(tuft, mat, count);
  mesh.name = 'grassTufts';
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;      // one draw either way; the bounds math isn't worth it

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const scl = new THREE.Vector3();
  const p = new THREE.Vector3();
  const tint = new THREE.Color();
  let placed = 0, guard = 0;
  while (placed < count && guard++ < count * 12) {
    // denser near the middle of the grounds, thinning outwards
    const a = rng() * Math.PI * 2;
    const r = Math.pow(rng(), 0.62) * 95;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 1.15 + 14;
    if (blocked(x, z)) continue;
    const y = groundHeight(x, z);
    if (y > 6) continue;                       // no tufts up the mountainside
    p.set(x, y - 0.02, z);
    q.setFromAxisAngle(up, rng() * Math.PI * 2);
    const s = rng.range(0.65, 1.55);
    scl.set(s, s * rng.range(0.8, 1.25), s);
    m4.compose(p, q, scl);
    mesh.setMatrixAt(placed, m4);
    // This multiplies the blade texture, and that texture is much brighter than
    // the turf underneath: its strokes run #3d6428 → #7fa348, which decodes to
    // about 0.23 of linear green where the lawn's own map sits at 0.107. So a
    // jitter about white is not neutral here — it puts every tuft at twice the
    // lawn's albedo (and 3.6× in red) and the yard reads as pale speckles.
    // Roughly 0.36/0.56/0.25 brings the product back onto the ground it stands
    // in — a shade brighter and more saturated than the averaged turf, which is
    // what a blade catching the light actually looks like. setRGB writes
    // straight into the linear working space, so these are the multipliers.
    const v = rng.range(0.82, 1.18);
    tint.setRGB(v * 0.36, v * 0.56, v * 0.25);
    mesh.setColorAt(placed, tint);
    placed++;
  }
  mesh.count = placed;
  mesh.userData.placed = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  world.scene.add(mesh);
  world.onUpdate((dt) => { uTime.value += dt; });
  return mesh;
}

/**
 * The tufts are scattered in a random order, so simply drawing fewer of them
 * thins the lawn evenly — a density slider costs nothing at runtime.
 */
export function setGrassDensity(mesh, fraction) {
  if (!mesh) return;
  mesh.count = Math.round((mesh.userData.placed || 0) * Math.max(0, Math.min(1, fraction)));
}
