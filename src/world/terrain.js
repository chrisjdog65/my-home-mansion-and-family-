// ───────────────────────────────────────────────────────────────────────────
// The land: lawn, hills, the mountain range on the southern horizon, trees,
// and the sky dome that drives the whole lighting model.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { makeNoise2D, fbm, clamp, smoothstep } from '../core/rng.js';
import { makeRng } from '../core/rng.js';
import { planarUV } from './build.js';
import { Atmosphere } from './atmosphere.js';
import { plantGrass } from './vegetation.js';
import { HOUSE, SLAB_HOLES } from './plan.js';

const noise = makeNoise2D(31415);

// House pad: flat ground inside this rectangle (plus a soft skirt).
const PAD = { x0: -46, x1: 46, z0: -34, z1: 34 };

/** Smooth elliptical hollow — used to dig the pool and the pond out of the lawn. */
function basin(x, z, cx, cz, rx, rz, depth) {
  const t = Math.hypot((x - cx) / rx, (z - cz) / rz);
  if (t >= 1) return 0;
  return depth * (1 - smoothstep(0.5, 1, t));
}

function rawHeight(x, z) {
  // distance outside the flat pad, 0 → 1 over 46 m
  const dx = Math.max(0, Math.max(PAD.x0 - x, x - PAD.x1));
  const dz = Math.max(0, Math.max(PAD.z0 - z, z - PAD.z1));
  const out = Math.hypot(dx, dz);
  const k = smoothstep(0, 46, out);
  if (k <= 0) return 0;
  const rolling = fbm(noise, x * 0.004, z * 0.004, 4) * 9;
  const fine = fbm(noise, x * 0.02, z * 0.02, 3) * 1.4;
  // the ground climbs towards the mountains in the south
  const rise = smoothstep(60, 260, z) * 42;
  return (rolling + fine + rise) * k;
}

/**
 * Anything with a poured slab on it — the skate park, the picnic terrace, the
 * shed — sits on level ground. Without this the collision mesh's coarse grid
 * pokes up through the slab and you walk up bumps you cannot see.
 */
const LEVELLED = [
  { x0: 7, x1: 45, z0: 48, z1: 77, rx: 26, rz: 62 },      // skate park
  { x0: 12, x1: 32, z0: 30, z1: 46, rx: 22, rz: 40 },     // picnic area
  { x0: -45, x1: -31, z0: 18, z1: 34, rx: -38, rz: 26 },  // shed
];
const FEATHER = 5;
const levelY = LEVELLED.map(() => null);

function levelness(x, z, r) {
  const dx = Math.max(0, Math.max(r.x0 - x, x - r.x1));
  const dz = Math.max(0, Math.max(r.z0 - z, z - r.z1));
  return 1 - smoothstep(0, FEATHER, Math.hypot(dx, dz));
}

export function groundHeight(x, z) {
  let h = rawHeight(x, z);
  for (let i = 0; i < LEVELLED.length; i++) {
    const r = LEVELLED[i];
    const k = levelness(x, z, r);
    if (k <= 0) continue;
    if (levelY[i] === null) levelY[i] = rawHeight(r.rx, r.rz);
    h += (levelY[i] - h) * k;
  }
  // hollows so the grass doesn't cap the water
  h -= basin(x, z, 0, 23, 11.5, 8.5, 3.6);      // swimming pool
  h -= basin(x, z, 13.5, 22, 4.4, 4.4, 1.6);    // hot tub
  h -= basin(x, z, -22, 48, 13, 10, 1.5);       // pond
  h -= basin(x, z, 18, 66, 8.4, 8.4, 3.4);      // skate bowl
  return h;
}

export function buildTerrain(world) {
  const M = world.mats;
  const scene = world.scene;

  // ── lawn / near ground (also the collision surface) ─────────────────────
  const NEAR = 220, SEG = 96;
  const g = new THREE.PlaneGeometry(NEAR * 2, NEAR * 2, SEG, SEG);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
  }
  g.computeVertexNormals();
  planarUV(g, 3.0);
  // Two cuts in the turf.
  //
  // The skate pad: at this vertex density the lawn caps the bowl with green
  // triangles you can see from the rim.
  //
  // And the stairwells.  Everywhere else inside the house the ground slab
  // sits over the lawn and hides it — but a slab hole is deliberately open,
  // and the lawn sheeted straight across it, so walking down to the basement
  // you met a wall of grass. Only the holes need cutting, which keeps every
  // blade at the foot of the walls where it belongs.
  {
    const wells = (SLAB_HOLES.ground || []).map((r) => ({
      x0: Math.max(HOUSE.x0, r.x0 - 1.0), x1: Math.min(HOUSE.x1, r.x1 + 1.0),
      z0: Math.max(HOUSE.z0, r.z0 - 1.0), z1: Math.min(HOUSE.z1, r.z1 + 1.0),
    }));
    const idx = g.index.array;
    const keep = [];
    for (let i = 0; i < idx.length; i += 3) {
      let cx = 0, cz = 0;
      let nx = Infinity, xx = -Infinity, nz = Infinity, xz = -Infinity;
      for (let k = 0; k < 3; k++) {
        const px = pos.getX(idx[i + k]), pz = pos.getZ(idx[i + k]);
        cx += px; cz += pz;
        if (px < nx) nx = px; if (px > xx) xx = px;
        if (pz < nz) nz = pz; if (pz > xz) xz = pz;
      }
      cx /= 3; cz /= 3;
      if (cx > 10 && cx < 42 && cz > 50 && cz < 74) continue;
      // a triangle goes if it overlaps a well at all, not just if its centre
      // does — at 4.6 m to a cell, a centre test leaves the corners behind
      let overWell = false;
      for (const w of wells) {
        if (xx > w.x0 && nx < w.x1 && xz > w.z0 && nz < w.z1) { overWell = true; break; }
      }
      if (overWell) continue;
      keep.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    g.setIndex(keep);
  }
  const ground = new THREE.Mesh(g, M.get('grass'));
  ground.receiveShadow = true;
  ground.name = 'lawn';
  scene.add(ground);

  // ── collision surface ───────────────────────────────────────────────────
  // Two grids. The near one is fine enough to cut the house's footprint out
  // cleanly: the lawn's collider used to run straight under the mansion, so
  // the basement stairwell was floored at ground level — you walked out over
  // the void and could never get downstairs. Inside the walls the house's own
  // slabs carry you, and its stair holes are finally open.
  const cutGrid = (size, segs, dropTri) => {
    const cg = new THREE.PlaneGeometry(size, size, segs, segs);
    cg.rotateX(-Math.PI / 2);
    const cp = cg.attributes.position;
    for (let i = 0; i < cp.count; i++) cp.setY(i, groundHeight(cp.getX(i), cp.getZ(i)) - 0.06);
    const idx = cg.index.array;
    const keep = [];
    const xs = [0, 0, 0], zs = [0, 0, 0];
    for (let i = 0; i < idx.length; i += 3) {
      for (let k = 0; k < 3; k++) { xs[k] = cp.getX(idx[i + k]); zs[k] = cp.getZ(idx[i + k]); }
      if (dropTri(xs, zs)) continue;
      keep.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    cg.setIndex(keep);
    cg.computeVertexNormals();
    world.colliderRoot.add(new THREE.Mesh(cg, world.colliderMat));
  };

  const NEARC = 60;    // half-extent of the fine grid, in metres
  const inHouse = (x, z) => x >= HOUSE.x0 && x <= HOUSE.x1 && z >= HOUSE.z0 && z <= HOUSE.z1;
  // A triangle is dropped only when all three corners are inside the house,
  // so the ground is never missing on the outside of a wall.
  cutGrid(NEARC * 2, 80, (xs, zs) => inHouse(xs[0], zs[0]) && inHouse(xs[1], zs[1]) && inHouse(xs[2], zs[2]));
  // the far ring keeps whatever the fine grid does not already cover
  cutGrid(NEAR * 2, 44, (xs, zs) => xs.every((x, k) => Math.abs(x) < NEARC && Math.abs(zs[k]) < NEARC));

  // ── distant terrain ring ────────────────────────────────────────────────
  const far = new THREE.PlaneGeometry(2400, 2400, 120, 120);
  far.rotateX(-Math.PI / 2);
  const fp = far.attributes.position;
  const colors = new Float32Array(fp.count * 3);
  const cRock = new THREE.Color(0x726c5e), cGrass = new THREE.Color(0x4a6a3e), cSnow = new THREE.Color(0xe4ecf3);
  const tmp = new THREE.Color();
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), z = fp.getZ(i);
    const d = Math.hypot(x, z);
    let h = groundHeight(x, z);
    if (d > 200) {
      const t = smoothstep(200, 620, d);
      const ridge = (1 - Math.abs(fbm(noise, x * 0.0022, z * 0.0022, 5))) ** 2;
      const ridge2 = (1 - Math.abs(fbm(noise, x * 0.006 + 40, z * 0.006 - 20, 4))) ** 2;
      // taller towards the south so the back yard gets the view
      const southBias = 0.55 + 0.75 * smoothstep(-100, 500, z);
      h += (ridge * 300 + ridge2 * 90) * t * southBias;
    }
    fp.setY(i, h);
    // rock takes over low so the middle distance is scrub and stone, not a
    // smooth green wall filling the southern sky; noise breaks the banding
    const vary = fbm(noise, x * 0.01 + 9, z * 0.01 - 4, 3) * 0.5 + 0.5;
    const snow = smoothstep(235, 380, h);
    const rock = smoothstep(14, 110, h) * (0.75 + vary * 0.35);
    tmp.copy(cGrass).lerp(cRock, Math.min(1, rock)).lerp(cSnow, snow);
    const k = 0.92 + vary * 0.28;
    colors[i * 3] = tmp.r * k; colors[i * 3 + 1] = tmp.g * k; colors[i * 3 + 2] = tmp.b * k;
  }
  far.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // Punch the middle out.  Inside the lawn's own square this plane is just
  // groundHeight again — the same shape drawn twice — and being 20 m to a
  // cell it could not be cut around anything. Sitting 0.4 m under the floor
  // it filled the basement stairwell with one big green quad: the grass you
  // hit on the way down. The lawn covers everything inside this radius, so
  // nothing is lost and a good deal of overdraw goes with it.
  {
    const INNER = 150;
    const fidx = far.index.array;
    const keep = [];
    for (let i = 0; i < fidx.length; i += 3) {
      let cx = 0, cz = 0;
      for (let k = 0; k < 3; k++) { cx += fp.getX(fidx[i + k]); cz += fp.getZ(fidx[i + k]); }
      if (Math.hypot(cx / 3, cz / 3) < INNER) continue;
      keep.push(fidx[i], fidx[i + 1], fidx[i + 2]);
    }
    far.setIndex(keep);
  }
  far.computeVertexNormals();
  // flat shading keeps the low-poly ridges reading as rock faces instead of
  // smooth-shaded soft-serve
  const farMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, flatShading: true });
  const farMesh = new THREE.Mesh(far, farMat);
  farMesh.position.y = -0.4;
  farMesh.receiveShadow = false;
  farMesh.name = 'mountains';
  scene.add(farMesh);

  // ── trees & grass ───────────────────────────────────────────────────────
  plantTrees(world);
  world.grass = plantGrass(world);

  return ground;
}

function plantTrees(world) {
  const rng = makeRng(777);
  const B = world.static;
  const M = world.mats;
  const bark = M.get('bark'), leaf = M.get('foliage');
  const keepOut = (x, z) =>
    (x > -44 && x < 44 && z > -80 && z < 80);   // house, drive, yard, skate park

  for (let i = 0; i < 420; i++) {
    const a = rng() * Math.PI * 2;
    const r = 52 + rng() ** 0.6 * 150;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 1.2 + 30;
    if (keepOut(x, z)) continue;
    const y = groundHeight(x, z);
    if (y > 120) continue;
    const pine = rng.chance(0.62);
    const s = rng.range(0.8, 1.7);
    if (pine) {
      B.box(0.42 * s, 4.2 * s, 0.42 * s, bark, x, y + 2.1 * s, z, { tile: 1 });
      for (let t = 0; t < 4; t++) {
        const w = (4.2 - t * 0.85) * s;
        B.box(w, 0.1 * s, w, leaf, x, y + (2.6 + t * 1.5) * s, z, { rotY: rng() * 3, tile: 1.6 });
        B.box(w * 0.72, 1.5 * s, w * 0.72, leaf, x, y + (3.2 + t * 1.5) * s, z, { rotY: rng() * 3, tile: 1.6 });
      }
    } else {
      B.box(0.5 * s, 3.6 * s, 0.5 * s, bark, x, y + 1.8 * s, z, { tile: 1 });
      for (let t = 0; t < 3; t++) {
        const w = (5.0 - Math.abs(t - 1) * 1.4) * s;
        B.box(w, 2.0 * s, w * 0.9, leaf, x + rng.range(-0.5, 0.5), y + (4.0 + t * 1.4) * s, z + rng.range(-0.5, 0.5), { rotY: rng() * 3, tile: 2 });
      }
    }
    if (r < 110) world.collider(1.0, 5 * s, 1.0, x, y + 2.5 * s, z);
  }

  // ornamental trees close to the house (none near the shed — a canopy
  // through its roof reads terribly from inside)
  for (const [x, z] of [[-38, -20], [38, -20], [-42, 12], [40, 22], [-34, 46], [34, 46]]) {
    const y = groundHeight(x, z);
    B.box(0.45, 3.2, 0.45, bark, x, y + 1.6, z, { tile: 1 });
    for (let t = 0; t < 3; t++) {
      B.box(4.4 - t * 0.9, 1.6, 4.2 - t * 0.9, leaf, x, y + 3.4 + t * 1.2, z, { rotY: t * 0.7, tile: 2 });
    }
    world.collider(0.9, 3.2, 0.9, x, y + 1.6, z);
  }
}

// ── sky & sun ──────────────────────────────────────────────────────────────
export class SkySystem {
  constructor(engine, world) {
    this.engine = engine;
    this.world = world;
    const scene = engine.scene;

    this.sky = new Sky();
    this.sky.scale.setScalar(20000);
    scene.add(this.sky);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 3.2;
    u.rayleigh.value = 2.2;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.82;

    this.sun = new THREE.DirectionalLight(0xfff2df, 3.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 260;
    // A tight frustum is worth more than a big map: 104 m across at 2048 is
    // 5 cm a texel, where the old 140 m box gave nearly 7.
    const S = 52;
    Object.assign(this.sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S });
    this.sun.shadow.camera.updateProjectionMatrix();   // the ortho camera never recomputes on its own
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.06;   // large flat slabs banded at 0.035
    this.sunTarget = new THREE.Object3D();
    scene.add(this.sun, this.sunTarget);
    this.sun.target = this.sunTarget;

    this.hemi = new THREE.HemisphereLight(0xbcd6f2, 0x5b5346, 0.55);
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.12);
    scene.add(this.ambient);

    this.moon = new THREE.DirectionalLight(0x9db8e0, 0.0);
    scene.add(this.moon);

    this.pmrem = new THREE.PMREMGenerator(engine.renderer);
    this.pmrem.compileEquirectangularShader();
    this._envScene = new THREE.Scene();
    this._envSky = new Sky();
    this._envSky.scale.setScalar(1000);
    this._envScene.add(this._envSky);

    this.atmosphere = new Atmosphere(scene);
    this._sunDir = new THREE.Vector3();

    this.time = 8.5;          // hours
    this.dayLength = 24 * 60; // seconds of real time for a full day
    this._lastEnv = -99;
    this.setTime(this.time);
  }

  sunDirection(hour) {
    // rises in the east, crosses the southern sky, sets in the west
    const t = ((hour - 6) / 12) * Math.PI;         // 0 at sunrise, π at sunset
    const elev = Math.sin(t) * 1.02;
    const az = -0.42 + (t / Math.PI) * (Math.PI + 0.84);   // ENE → south → WNW
    const c = Math.cos(elev);
    return this._sunDir.set(Math.cos(az) * c, Math.sin(elev), Math.sin(az) * c).normalize();
  }

  setTime(hour) {
    this.time = ((hour % 24) + 24) % 24;
    const dir = this.sunDirection(this.time);
    this.dir = dir;
    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(dir);

    const day = clamp(dir.y * 3.2, 0, 1);
    const dusk = clamp(1 - Math.abs(dir.y) * 6, 0, 1);

    this.sun.position.copy(dir).multiplyScalar(160);
    this.sun.intensity = 3.1 * day;
    this.sun.color.setRGB(1, 0.94 - dusk * 0.18, 0.86 - dusk * 0.36);
    this.sun.visible = day > 0.01;

    this.moon.position.set(-dir.x * 160, Math.abs(dir.y) * 90 + 40, -dir.z * 160);
    this.moon.intensity = 1.15 * (1 - day);

    // Sky fill is kept deliberately low: without it every interior washes out,
    // and the house is meant to be lit by its own fixtures.
    this.hemi.intensity = 0.28 + 0.3 * day;
    this.hemi.color.setHex(day > 0.3 ? 0xa8c6e8 : 0x2c3a56);
    this.hemi.groundColor.setHex(0x4a4238);
    this.ambient.intensity = 0.08 + 0.04 * day;

    u.turbidity.value = 2.6 + dusk * 5.5;
    u.rayleigh.value = 1.4 + dusk * 2.6 + (1 - day) * 0.6;
    u.mieCoefficient.value = 0.004 + dusk * 0.016;

    this.engine.renderer.toneMappingExposure = 0.62 + day * 0.16;
    this.night = day < 0.18;
    this.atmosphere.setSun(dir, day, dusk);

    // lamp heads, floodlights and headlights come up with the dark
    const glow = 0.12 + 0.88 * (1 - day);
    for (const m of this.world.mats.dimmable) m.emissiveIntensity = m.userData.baseEmissive * glow;

    // haze on the horizon follows the sky
    const fog = this.engine.scene.fog;
    if (fog) {
      const dayC = 0.62 + day * 0.24;
      fog.color.setRGB(
        (0.09 + 0.60 * day + dusk * 0.26) * dayC,
        (0.12 + 0.65 * day + dusk * 0.12) * dayC,
        (0.20 + 0.70 * day) * dayC,
      );
      this.engine.renderer.setClearColor(fog.color);
    }
  }

  /** Refresh the image-based lighting (expensive — only a few times a day). */
  updateEnv(force = false) {
    if (!force && Math.abs(this.time - this._lastEnv) < 1.2) return;
    this._lastEnv = this.time;
    const u = this._envSky.material.uniforms;
    const s = this.sky.material.uniforms;
    for (const kk of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) u[kk].value = s[kk].value;
    u.sunPosition.value.copy(s.sunPosition.value);
    const rt = this.pmrem.fromScene(this._envScene, 0.04, 0.1, 1000);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.engine.scene.environment = rt.texture;
    // restrained: full-sky IBL indoors is what washed the kitchen and every
    // bathroom out to a white void at midday
    this.engine.scene.environmentIntensity = 0.14 + clamp(this.dir.y, 0, 1) * 0.2;
  }

  update(dt, playerPos, timeScale = 1) {
    this.setTime(this.time + (dt / this.dayLength) * 24 * timeScale);
    this.updateEnv();
    this.atmosphere.update(dt);
    // keep the shadow frustum on the player
    this.sunTarget.position.copy(playerPos);
    this.sun.position.copy(playerPos).addScaledVector(this.dir, 120);
    this.sun.target.updateMatrixWorld();
  }

  clockString() {
    const h = Math.floor(this.time), m = Math.floor((this.time % 1) * 60);
    const ampm = h < 12 ? 'AM' : 'PM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
  }
}
