// ───────────────────────────────────────────────────────────────────────────
// Procedural people.
//
// A character is a jointed rig — hips → torso → neck → head, plus arms[] and
// legs[] — hung with primitives that are *merged per material*, so a whole
// person costs a dozen-odd draw calls instead of a hundred.  Everything is
// authored against a 1.75 m adult ("one unit") and the rig group is scaled to
// the spec's height, which keeps every number below readable.
//
// The skeleton's names are load-bearing: the animation here and every caller
// reach for hips / torso / neck / head / arms[] / legs[].
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, damp, lerp } from '../core/rng.js';

const TAU = Math.PI * 2;
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _t = new THREE.Vector3();
const _sc = new THREE.Vector3();
const _mx = new THREE.Matrix4();

// ── primitives ─────────────────────────────────────────────────────────────
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const sph = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
/** Open-bottomed dome — skulls, hair caps and eyelids are all half spheres. */
const dome = (r, theta = 0.58, w = 12, h = 7) =>
  new THREE.SphereGeometry(r, w, h, 0, TAU, 0, Math.PI * theta);
const cyl = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, false);
const capg = (r, h) => new THREE.CapsuleGeometry(r, h, 3, 8);

const wrapPi = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

/** 1 at `c`, easing to 0 at ±w·π/2.  Every gait event is one of these. */
const bump = (ph, c, w) => {
  const d = wrapPi(ph - c) / w;
  return Math.abs(d) >= Math.PI / 2 ? 0 : Math.cos(d);
};

const tint = (hex, f) => {
  const c = new THREE.Color(hex);
  if (f >= 1) c.lerp(new THREE.Color(0xffffff), Math.min(f - 1, 1));
  else c.multiplyScalar(f);
  return c.getHex();
};
const mixc = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

/**
 * Collects primitives per material inside one rig group and merges them on
 * flush().  Thirty spheres and boxes make a head; one mesh draws it.
 */
class Bin {
  constructor(group) { this.group = group; this.map = new Map(); }

  add(geo, mat, o = {}) {
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ');
    _q.setFromEuler(_e);
    _t.set(o.x || 0, o.y || 0, o.z || 0);
    _sc.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
    _mx.compose(_t, _q, _sc);
    geo.applyMatrix4(_mx);
    let arr = this.map.get(mat);
    if (!arr) this.map.set(mat, (arr = []));
    arr.push(geo);
    return this;
  }

  /** One merged mesh per material; hands back the mesh built for `want`. */
  flush(want = null) {
    let found = null;
    for (const [mat, list] of this.map) {
      const geo = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (!geo) continue;
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
      if (mat === want) found = m;
    }
    this.map.clear();
    return found;
  }
}

// ── poses ──────────────────────────────────────────────────────────────────
// Angles are radians on the rig; hipY is an absolute height in metres (chairs
// and beds are real-world sized, so a child's hips sit on the same cushion as
// an adult's — their feet just dangle).
const POSE_BASE = {
  hipY: null, drop: 0, pitch: 0, roll: 0, yaw: 0,
  torsoX: 0.02, torsoZ: 0,
  hip: -0.02, spread: 0.02, knee: 0.05, ankle: 0, splay: 0,
  armX: -0.02, armZ: 0.085, elbow: -0.14, wrist: 0,
  headX: 0,
};

const POSES = {
  stand: {},
  // chair / sofa / bench
  sit: { hipY: 0.55, torsoX: 0.05, hip: -1.40, knee: 1.42, ankle: 0.16, spread: 0.05, splay: 0.05, armX: -0.38, elbow: -0.52, armZ: 0.14 },
  // slouched back into cushions, legs out
  lounge: { hipY: 0.50, torsoX: -0.16, hip: -1.16, knee: 1.02, ankle: 0.1, spread: 0.06, splay: 0.08, armX: -0.26, elbow: -0.42, armZ: 0.2 },
  // up on a barstool, feet on the rail
  perch: { hipY: 0.74, torsoX: 0.07, hip: -1.25, knee: 1.05, ankle: 0.1, spread: 0.06, splay: 0.06, armX: -0.5, elbow: -0.62, armZ: 0.14 },
  // sitting at a desk / keyboard / dinner table
  desk: { hipY: 0.54, torsoX: 0.19, hip: -1.46, knee: 1.5, ankle: 0.2, spread: 0.05, armX: -0.88, elbow: -0.95, armZ: 0.1, headX: 0.06 },
  // cross-legged on the floor or a rug
  floor: { hipY: 0.21, torsoX: 0.1, hip: -1.28, knee: 1.95, ankle: 0.1, spread: 0.02, splay: 0.34, armX: -0.46, elbow: -0.66, armZ: 0.26 },
  // on their back — head towards local −z, so face the character *away*
  // from the headboard when you park them on a bed
  lie: { hipY: 0.63, pitch: -1.44, torsoX: 0.07, hip: 0.06, knee: 0.14, ankle: -0.16, splay: 0.06, armX: -0.06, elbow: -0.28, armZ: 0.19, headX: 0.22 },
  // prone in the water, head up
  swim: { hipY: 0.44, pitch: 1.22, torsoX: -0.24, hip: -0.14, knee: 0.34, ankle: -0.2, armX: -1.0, elbow: -0.5, armZ: 0.34, headX: -0.35 },
  // hip against a counter or rail, weight on one leg
  lean: { drop: 0.02, torsoX: 0.14, hip: -0.08, knee: 0.14, armX: -0.7, elbow: -0.6, armZ: 0.16 },
  // working at the counter / hob / sink — forearms up, shoulders forward
  work: { drop: 0.015, torsoX: 0.12, hip: -0.05, knee: 0.1, armX: -0.82, elbow: -0.92, armZ: 0.11 },
  // holding a ball, knees loaded
  shoot: { drop: 0.045, torsoX: 0.06, hip: -0.18, knee: 0.34, ankle: -0.1, armX: -1.85, elbow: -1.45, armZ: 0.3 },
  // book / tablet / controller held up
  read: { hipY: 0.55, torsoX: 0.1, hip: -1.4, knee: 1.44, ankle: 0.16, spread: 0.05, splay: 0.06, armX: -0.92, elbow: -1.3, armZ: 0.18, headX: 0.12 },
  // crouched down over something on the ground
  crouch: { hipY: 0.42, torsoX: 0.24, hip: -1.15, knee: 1.75, ankle: -0.4, spread: 0.08, splay: 0.16, armX: -0.7, elbow: -0.9, armZ: 0.18, headX: 0.1 },
};

// Sole extents in the ankle's frame — see the pelvis solve in update().
const FOOT_TOE = 0.166;
const FOOT_HEEL = -0.082;
// Peak hip swing, and its sine: stride length falls straight out of these.
const SWING = 0.46;
const SWING_SIN = Math.sin(SWING);

function poseTargets(name, out) {
  const src = POSES[name] || POSES.stand;
  for (const k in POSE_BASE) out[k] = src[k] !== undefined ? src[k] : POSE_BASE[k];
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
export class Character {
  /**
   * spec: { name, height, skin, hair, shirt, pants, shoes, hairStyle, build,
   *         headScale, outfit, eyeColor, faceWidth, faceRound, browAngle,
   *         noseSize, smile, freckles, lashes, legScale, armScale }
   */
  constructor(world, spec) {
    this.world = world;
    this.spec = spec;
    this.name = spec.name;
    const M = world.mats;
    const S = spec.height / 1.75;
    this.S = S;

    // ── proportions ────────────────────────────────────────────────────────
    const headScale = spec.headScale || 1;
    const kid = headScale > 1.04;
    const bw = spec.build ?? 1;                       // build (width)
    // children are not scaled-down adults: shorter limbs against a longer
    // torso and a rounder, wider face is what actually reads as "eight"
    const legK = spec.legScale ?? (kid ? 0.90 : 1);
    const armK = spec.armScale ?? (kid ? 0.93 : 1);
    const torsoK = spec.torsoScale ?? (kid ? 1.03 : 1);
    const fw = spec.faceWidth ?? (kid ? 1.03 : 1);
    const fr = spec.faceRound ?? (kid ? 1.18 : 1);
    const nose = spec.noseSize ?? (kid ? 0.85 : 1);
    const outfit = spec.outfit || 'shirt';
    const style = spec.hairStyle || 'short';

    const L = this.L = {
      ankle: 0.072, shin: 0.415 * legK, thigh: 0.425 * legK,
      upper: 0.285 * armK, fore: 0.245 * armK, torso: 0.435 * torsoK,
    };
    L.hipJoint = L.ankle + L.shin + L.thigh;
    this.hipBase = L.hipJoint + 0.035;

    // ── palette ────────────────────────────────────────────────────────────
    const skinHex = spec.skin;
    const skin = M.solid(skinHex, 0.68);
    const lidM = M.solid(tint(skinHex, 0.93), 0.7);
    const faceDark = M.solid(tint(skinHex, 0.66), 0.8);          // nostrils, freckles, lash line
    const hairM = M.solid(spec.hair, 0.86);
    const hairHi = M.solid(tint(spec.hair, 1.16), 0.8);
    const shirtM = M.solid(spec.shirt, 0.86);
    const shirtTrim = M.solid(tint(spec.shirt, 0.8), 0.82);
    const pantsM = M.solid(spec.pants, 0.9);
    const pantsTrim = M.solid(tint(spec.pants, 0.8), 0.9);
    const shoeHex = spec.shoes ?? 0x2b2b2b;
    const shoeM = M.solid(shoeHex, 0.72);
    const soleM = M.solid(tint(shoeHex, 0.5), 0.92);
    const laceM = M.solid(spec.laces ?? 0xf4f1e8, 0.85);
    const eyeW = M.solid(0xf7f9fa, 0.28);
    const irisM = M.solid(spec.eyeColor ?? 0x5b7a6a, 0.34);
    const pupilM = M.solid(0x181310, 0.3);
    const lipM = M.solid(spec.lipColor ?? mixc(skinHex, 0xb2544f, 0.55), 0.5);
    const mouthM = M.solid(mixc(skinHex, 0x6b3833, 0.75), 0.55);

    this.root = new THREE.Group();
    this.root.name = `npc:${spec.name}`;
    // authored at 1.75 m, worn at whatever height the spec asks for
    this.rig = new THREE.Group();
    this.rig.scale.setScalar(S);
    this.root.add(this.rig);

    // ── hips ───────────────────────────────────────────────────────────────
    this.hips = new THREE.Group();
    this.hips.position.y = this.hipBase;
    this.rig.add(this.hips);
    {
      const b = new Bin(this.hips);
      b.add(cyl(0.152 * bw, 0.138 * bw, 0.20, 10), pantsM, { y: -0.01, sz: 0.74 });
      b.add(sph(0.115 * bw), pantsM, { y: -0.05, z: -0.012, sx: 0.98, sy: 0.72, sz: 0.78 });
      // waistband — the one seam that stops a torso reading as a single tube
      b.add(cyl(0.158 * bw, 0.155 * bw, 0.05, 10), pantsTrim, { y: 0.082, sz: 0.75 });
      b.add(box(0.05, 0.045, 0.02), M.solid(0xcbb787, 0.35, 0.6), { y: 0.082, z: 0.115 * bw });
      b.flush();
    }

    // a skirt / dress hem hangs off the pelvis and swings with it
    this.skirt = null;
    if (outfit === 'dress' || outfit === 'skirt') {
      const hemM = M.solid(outfit === 'dress' ? spec.shirt : spec.pants, 0.88).clone();
      hemM.side = THREE.DoubleSide;                  // you can see up a cone from below
      const g = new THREE.Group();
      g.position.y = 0.03;
      this.hips.add(g);
      const hb = new Bin(g);
      const len = outfit === 'dress' ? 0.34 : 0.24;
      hb.add(cyl(0.17 * bw, 0.30 * bw, len, 14), hemM, { y: -len / 2 });
      hb.add(cyl(0.30 * bw, 0.295 * bw, 0.02, 14), M.solid(tint(outfit === 'dress' ? spec.shirt : spec.pants, 0.82), 0.9), { y: -len });
      hb.flush();
      this.skirt = g;
    }

    // ── torso ──────────────────────────────────────────────────────────────
    this.torso = new THREE.Group();
    this.torso.position.y = 0.06;
    this.hips.add(this.torso);
    {
      const b = new Bin(this.torso);
      const top = shirtM;
      b.add(cyl(0.146 * bw, 0.134 * bw, 0.19, 10), top, { y: 0.095, sz: 0.72 });          // waist → ribs
      b.add(cyl(0.160 * bw, 0.146 * bw, 0.21, 10), top, { y: 0.29, sz: 0.70 });           // chest
      b.add(cyl(0.152 * bw, 0.160 * bw, 0.06, 10), top, { y: 0.405, sz: 0.72 });          // yoke
      b.add(cyl(0.148 * bw, 0.163 * bw, 0.055, 10), top, { y: 0.012, sz: 0.73 });         // hem, flared
      // shoulders slope away from the neck instead of ending in a slab
      for (const s of [-1, 1]) {
        b.add(box(0.135 * bw, 0.07, 0.165), top, { x: s * 0.088 * bw, y: 0.402, rz: -s * 0.33 });
      }
      b.add(sph(0.06), top, { y: 0.42, z: -0.045, sy: 0.7, sz: 0.8 });                    // upper back
      // collar band + points, and a placket of buttons down the front
      b.add(cyl(0.066, 0.076, 0.05, 10), shirtTrim, { y: 0.443, sz: 0.92 });
      for (const s of [-1, 1]) {
        b.add(box(0.062, 0.014, 0.055), shirtTrim, { x: s * 0.036, y: 0.428, z: 0.062, rx: 0.55, rz: -s * 0.45 });
      }
      if (outfit !== 'tee') {
        for (let i = 0; i < 3; i++) {
          b.add(cyl(0.009, 0.009, 0.006, 6), shirtTrim, { y: 0.34 - i * 0.075, z: 0.105, rx: Math.PI / 2 });
        }
      }
      this.chest = b.flush(top);
    }

    // ── neck ───────────────────────────────────────────────────────────────
    this.neck = new THREE.Group();
    this.neck.position.y = 0.475;
    this.torso.add(this.neck);
    {
      const b = new Bin(this.neck);
      b.add(cyl(0.048, 0.058, 0.10, 8), skin, { y: 0.025, sz: 0.9 });
      b.add(sph(0.05), skin, { y: 0.075, sy: 0.8 });
      b.flush();
    }

    // long hair falls from the shoulders, not the skull: parented to the
    // torso so turning the head doesn't drag the whole mane through the neck
    if (style === 'long') {
      const g = new THREE.Group();
      g.position.set(0, 0.46, -0.03);
      this.torso.add(g);
      const b = new Bin(g);
      b.add(cyl(0.098, 0.078, 0.34, 8), hairM, { y: -0.15, z: -0.03, sz: 0.55 });
      b.add(sph(0.085), hairM, { y: -0.31, z: -0.03, sy: 0.7, sz: 0.55 });
      b.flush();
      this.hairFall = g;
    }

    // ── head ───────────────────────────────────────────────────────────────
    this.head = new THREE.Group();
    this.head.position.y = 0.055;
    this.head.scale.setScalar(headScale);
    this.neck.add(this.head);

    const eyeX = 0.0435 * fw, eyeY = 0.113, eyeZ = 0.0715;
    this.eyeY = 0;                       // filled in below (rest eye height)

    {
      const b = new Bin(this.head);
      const skullSX = fw * (0.99 + (fr - 1) * 0.10);
      const skullSY = 1.06 / fr;
      // cranium, occiput, brow, cheeks, jaw, chin — a skull, not a box
      b.add(sph(0.094, 14, 10), skin, { y: eyeY, sx: skullSX, sy: skullSY, sz: 1.0 });
      b.add(sph(0.072), skin, { y: 0.10, z: -0.042, sx: 0.95 * fw, sy: 1.0, sz: 0.9 });
      b.add(box(0.152 * fw, 0.034, 0.055), skin, { y: 0.1465, z: 0.058, rx: -0.16 });
      for (const s of [-1, 1]) {
        b.add(sph(0.040), skin, { x: s * 0.062 * fw, y: 0.101, z: 0.032, sx: 0.9, sy: 0.82, sz: 0.85 });
        b.add(sph(0.040 * (kid ? 1.2 : 1)), skin, { x: s * 0.055 * fw, y: 0.064, z: 0.05, sx: 0.95, sy: 0.85, sz: 0.72 });
        // ears with a lobe
        b.add(sph(0.027), skin, { x: s * 0.093 * fw, y: 0.099, z: -0.004, sx: 0.42, sy: 1.05, sz: 0.8 });
        b.add(sph(0.014), skin, { x: s * 0.091 * fw, y: 0.074, z: 0.0, sx: 0.45, sy: 0.9, sz: 0.8 });
      }
      b.add(box(0.128 * fw, 0.078, 0.14), skin, { y: 0.049, z: 0.008 });
      b.add(sph(0.037), skin, { y: 0.0225, z: 0.05, sx: 1.05 * fw, sy: 0.78, sz: 0.9 });
      b.add(sph(0.046), skin, { y: 0.057, z: 0.06, sx: 1.1 * fw, sy: 0.72, sz: 0.7 });     // muzzle
      // nose: bridge, ball, wings
      b.add(box(0.027, 0.052, 0.03), skin, { y: 0.114, z: 0.081, rx: 0.13 });
      b.add(sph(0.020 * nose), skin, { y: 0.0885, z: 0.0895, sx: 1.15, sy: 0.95, sz: 1.05 });
      for (const s of [-1, 1]) b.add(sph(0.0115 * nose), skin, { x: s * 0.0175, y: 0.0855, z: 0.0855, sy: 0.9 });
      // eyelid seams: a lower lid keeps the eyeball from reading as a bead
      for (const s of [-1, 1]) b.add(box(0.038 * fw, 0.009, 0.014), skin, { x: s * eyeX, y: eyeY - 0.0135, z: eyeZ + 0.008 });
      b.flush();

      // dark detail: nostrils, lash line, freckles
      const d = new Bin(this.head);
      for (const s of [-1, 1]) d.add(box(0.009, 0.007, 0.008), faceDark, { x: s * 0.0135, y: 0.0805, z: 0.0895 });
      if (spec.lashes !== false) {
        for (const s of [-1, 1]) {
          d.add(box(0.042 * fw, 0.006, 0.012), faceDark, { x: s * eyeX, y: eyeY + 0.0145, z: eyeZ + 0.007, rx: -0.35 });
        }
      }
      if (spec.freckles) {
        for (let i = 0; i < 8; i++) {
          const s = i < 4 ? -1 : 1;
          const j = i % 4;
          d.add(box(0.007, 0.006, 0.004), faceDark,
            { x: s * (0.022 + j * 0.013), y: 0.086 + (j % 2) * 0.011, z: 0.0885 - j * 0.004 });
        }
      }
      d.flush();

      // eyes: white, iris, pupil, catchlight — merged across both sides
      const w = new Bin(this.head);
      for (const s of [-1, 1]) {
        w.add(sph(0.0195, 10, 8), eyeW, { x: s * eyeX, y: eyeY, z: eyeZ, sx: 1.06, sy: 0.95, sz: 0.6 });
        w.add(sph(0.0034, 6, 5), eyeW, { x: s * eyeX + 0.005, y: eyeY + 0.005, z: 0.0885 });
      }
      w.flush();
      const ir = new Bin(this.head);
      for (const s of [-1, 1]) ir.add(cyl(0.0092, 0.0092, 0.005, 10), irisM, { x: s * eyeX, y: eyeY, z: 0.0845, rx: Math.PI / 2 });
      ir.flush();
      const pu = new Bin(this.head);
      for (const s of [-1, 1]) pu.add(cyl(0.0044, 0.0044, 0.005, 8), pupilM, { x: s * eyeX, y: eyeY, z: 0.0865, rx: Math.PI / 2 });
      pu.flush();

      // upper lids on their own pivots, so the blink actually closes them
      this.lids = [];
      for (const s of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(s * eyeX, eyeY + 0.001, eyeZ);
        this.head.add(g);
        const lb = new Bin(g);
        lb.add(dome(0.0225, 0.52, 10, 5), lidM, { sx: 1.08, sy: 1.0, sz: 0.66 });
        lb.flush();
        g.rotation.x = -0.2;
        this.lids.push(g);
      }

      // brows on a shared pivot so they can lift as one
      this.browG = new THREE.Group();
      this.head.add(this.browG);
      const brow = new Bin(this.browG);
      const ba = spec.browAngle ?? 0.12;
      for (const s of [-1, 1]) {
        brow.add(box(0.050 * fw, 0.0115, 0.018), hairM,
          { x: s * (eyeX + 0.002), y: eyeY + 0.033, z: eyeZ + 0.008, rz: -s * ba, rx: -0.2 });
      }
      brow.flush();
      this.browY = 0;

      // mouth: lips proud of the face, a soft line between them that curls up
      // at the corners.  The lower lip drops for speech.
      const mx = 0.0555, mz = 0.0845;
      const lipTop = new THREE.Group();
      this.head.add(lipTop);
      const lt = new Bin(lipTop);
      lt.add(box(0.052, 0.011, 0.018), lipM, { y: mx + 0.008, z: mz });
      lt.flush();
      const smile = spec.smile ?? 0.3;
      const line = new Bin(this.head);
      line.add(box(0.030, 0.005, 0.012), mouthM, { y: mx, z: mz + 0.004 });
      for (const s of [-1, 1]) {
        line.add(box(0.017, 0.005, 0.012), mouthM,
          { x: s * 0.0215, y: mx + smile * 0.008, z: mz + 0.003, rz: -s * smile });
      }
      line.flush();
      this.lipBot = new THREE.Group();
      this.lipBotY = mx - 0.011;
      this.lipBot.position.set(0, this.lipBotY, mz);
      this.head.add(this.lipBot);
      const lb2 = new Bin(this.lipBot);
      lb2.add(box(0.047, 0.014, 0.02), lipM, {});
      lb2.flush();
      this.mouth = this.lipBot;                     // legacy handle

      // ── hair ────────────────────────────────────────────────────────────
      // How far forward the face is at a given height — every piece of hair is
      // placed against this, so a fringe rests on the forehead instead of
      // hovering off it or sinking into the skull.
      const faceZ = (y) => {
        const t = (y - eyeY) / (0.094 * skullSY);
        return Math.abs(t) >= 1 ? 0 : 0.094 * Math.sqrt(1 - t * t);
      };
      const h = new Bin(this.head);
      const capR = 0.101 * fw;
      // The cap is a dome concentric with the skull, tilted back so the gap in
      // it lands on the face: a level dome wraps right round and buries the
      // eyes.  The rim is the hairline, and it sits just above the brows.
      h.add(dome(capR, 0.52, 14, 9), hairM, { y: eyeY, rx: -0.52, sx: 1.03, sy: 1.08, sz: 1.03 });
      const hairline = 0.174;   // a fringe hangs from here; the brows stay clear
      if (style === 'long') {
        h.add(sph(0.104), hairM, { y: 0.09, z: -0.04, sx: 1.0, sy: 1.2, sz: 0.95 });
        h.add(box(0.17 * fw, 0.04, 0.036), hairM, { y: hairline, z: faceZ(hairline) + 0.002, rx: 0.36 });
        for (const s of [-1, 1]) {
          // strands framing the face, tucked just outside the cheekbone
          h.add(box(0.044, 0.26, 0.07), hairM, { x: s * 0.094 * fw, y: 0.02, z: 0.012, rz: s * 0.05 });
          h.add(sph(0.032), hairM, { x: s * 0.092 * fw, y: -0.105, z: 0.008, sy: 0.85 });
        }
        h.add(box(0.055, 0.04, 0.032), hairHi, { x: -0.045 * fw, y: hairline + 0.012, z: faceZ(hairline) + 0.006, rz: 0.42 });
      } else if (style === 'ponytail') {
        h.add(sph(0.092), hairM, { y: 0.10, z: -0.045, sy: 1.05, sz: 0.85 });
        h.add(box(0.165 * fw, 0.04, 0.036), hairM, { y: hairline + 0.002, z: faceZ(hairline) + 0.002, rx: 0.44 });
        for (const s of [-1, 1]) {
          h.add(box(0.032, 0.11, 0.055), hairM, { x: s * 0.096 * fw, y: 0.115, z: 0.02 });
          h.add(box(0.05, 0.035, 0.03), hairHi, { x: s * 0.05 * fw, y: hairline + 0.016, z: faceZ(hairline) + 0.004, rz: s * 0.35 });
        }
      } else if (style === 'bob') {
        // a curtain of hair from ear, round the back, to ear
        for (let i = 0; i <= 10; i++) {
          const a = Math.PI / 2 + (i / 10) * Math.PI;
          h.add(box(0.052, 0.185, 0.052), hairM,
            { x: Math.sin(a) * 0.099 * fw, y: 0.05, z: Math.cos(a) * 0.099, ry: a });
        }
        h.add(box(0.17 * fw, 0.04, 0.036), hairM, { y: hairline, z: faceZ(hairline) + 0.002, rx: 0.4 });
      } else {
        // short: a swept fringe, a couple of tufts and sideburns
        h.add(box(0.16 * fw, 0.044, 0.042), hairM,
          { y: hairline + 0.004, z: faceZ(hairline) + 0.003, rx: 0.26, rz: 0.1 });
        h.add(box(0.09, 0.05, 0.07), hairM, { x: 0.038, y: hairline + 0.028, z: 0.036, rz: -0.28 });
        h.add(box(0.065, 0.045, 0.065), hairHi, { x: -0.032, y: hairline + 0.03, z: 0.02, rz: 0.32 });
        for (const s of [-1, 1]) h.add(box(0.022, 0.055, 0.05), hairM, { x: s * 0.09 * fw, y: 0.1, z: 0.012 });
        h.add(box(0.13 * fw, 0.055, 0.05), hairM, { y: 0.085, z: -0.062 });
      }
      h.flush();

      if (style === 'ponytail') {
        // the tail lives on its own pivot so it can bounce
        this.tail = new THREE.Group();
        this.tail.position.set(0, 0.132, -0.082);
        this.head.add(this.tail);
        const tb = new Bin(this.tail);
        tb.add(sph(0.036), hairM, { y: -0.005 });
        tb.add(capg(0.031, 0.17), hairM, { y: -0.11, z: -0.03, rx: -0.25 });
        tb.add(sph(0.027), hairM, { y: -0.205, z: -0.055 });
        tb.flush();
        const tie = new Bin(this.tail);
        tie.add(cyl(0.032, 0.032, 0.022, 8), M.solid(spec.shirt, 0.8), { y: 0.005, rx: 0.2 });
        tie.flush();
        this.tail.rotation.x = 0.35;
      }

      this.eyeY = this.hipBase + 0.06 + 0.475 + 0.055 + eyeY * headScale;
    }

    // ── arms ───────────────────────────────────────────────────────────────
    // sleeve length: a tee stops above the elbow, a shirt just past it
    const sleeve = spec.sleeve ?? (outfit === 'tee' ? 0.55 : outfit === 'dress' ? 0.72 : 0.92);
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(s * 0.185 * bw, 0.415, 0);
      this.torso.add(sh);
      {
        const b = new Bin(sh);
        b.add(sph(0.062 * bw), shirtM, { sy: 0.95 });                                   // deltoid
        b.add(cyl(0.049 * bw, 0.042 * bw, L.upper * sleeve, 8), shirtM, { y: -L.upper * sleeve / 2 });
        b.add(cyl(0.045 * bw, 0.044 * bw, 0.022, 8), shirtTrim, { y: -L.upper * sleeve });   // cuff
        if (sleeve < 0.99) {
          b.add(cyl(0.041 * bw, 0.038 * bw, L.upper * (1 - sleeve) + 0.01, 8), skin,
            { y: -L.upper * sleeve - (L.upper * (1 - sleeve)) / 2 });
        }
        b.flush();
      }
      const el = new THREE.Group();
      el.position.y = -L.upper;
      sh.add(el);
      {
        const b = new Bin(el);
        b.add(sph(0.041 * bw), skin, {});                                              // elbow
        b.add(cyl(0.040 * bw, 0.032 * bw, L.fore, 8), skin, { y: -L.fore / 2 });
        b.add(sph(0.031 * bw), skin, { y: -L.fore, sy: 0.85 });                        // wrist
        b.flush();
      }
      const wr = new THREE.Group();
      wr.position.y = -L.fore;
      el.add(wr);
      let hand = null;
      {
        const b = new Bin(wr);
        b.add(box(0.056 * bw, 0.072, 0.036), skin, { y: -0.038 });                     // palm
        b.add(sph(0.03), skin, { y: -0.072, sx: 1.0, sy: 0.62, sz: 0.62 });            // knuckles
        b.add(box(0.05, 0.05, 0.03), skin, { y: -0.094, rx: 0.12 });                   // fingers
        b.add(box(0.048, 0.012, 0.028), skin, { y: -0.083, z: 0.001 });
        b.add(capg(0.013, 0.028), skin, { x: -s * 0.031, y: -0.036, z: 0.012, rz: s * 0.5, rx: -0.3 });  // thumb
        hand = b.flush(skin);
      }
      this.arms.push({ sh, el, wrist: wr, hand, side: s });
    }

    // ── legs ───────────────────────────────────────────────────────────────
    const bare = outfit === 'skirt' && spec.tights === false;
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.082 * bw, -0.035, 0);
      this.hips.add(hip);
      {
        const b = new Bin(hip);
        b.add(sph(0.076 * bw), pantsM, { sy: 0.9 });
        b.add(cyl(0.076 * bw, 0.060 * bw, L.thigh, 8), pantsM, { y: -L.thigh / 2, sz: 0.92 });
        b.flush();
      }
      const knee = new THREE.Group();
      knee.position.y = -L.thigh;
      hip.add(knee);
      {
        const b = new Bin(knee);
        const legM = bare ? skin : pantsM;
        b.add(sph(0.056 * bw), legM, { sz: 0.92 });
        b.add(cyl(0.056 * bw, 0.040 * bw, L.shin, 8), legM, { y: -L.shin / 2, sz: 0.94 });
        if (!bare) {
          // turn-up at the ankle — trousers that end in a hem, not a stump
          b.add(cyl(0.048 * bw, 0.047 * bw, 0.05, 8), pantsTrim, { y: -L.shin + 0.055 });
        }
        b.add(cyl(0.040 * bw, 0.038 * bw, 0.05, 8), M.solid(0xf2f0e8, 0.9), { y: -L.shin + 0.015 });  // sock
        b.flush();
      }
      const ankle = new THREE.Group();
      ankle.position.y = -L.shin;
      knee.add(ankle);
      let foot = null;
      {
        const b = new Bin(ankle);
        b.add(box(0.082 * bw, 0.058, 0.20), shoeM, { y: -0.032, z: 0.030 });
        b.add(sph(0.042), shoeM, { y: -0.040, z: 0.122, sx: 0.98 * bw, sy: 0.62, sz: 1.0 });     // toe box
        b.add(box(0.078 * bw, 0.062, 0.07), shoeM, { y: -0.030, z: -0.048 });                    // heel counter
        b.add(cyl(0.038, 0.042, 0.032, 8), shoeM, { y: 0.002, sz: 1.15 });                       // collar
        foot = b.flush(shoeM);
        const c = new Bin(ankle);
        c.add(box(0.088 * bw, 0.024, 0.248), soleM, { y: -0.060, z: 0.042 });
        c.add(box(0.090 * bw, 0.014, 0.09), soleM, { y: -0.049, z: -0.045 });                    // heel block
        c.flush();
        const lc = new Bin(ankle);
        lc.add(box(0.042, 0.03, 0.055), laceM, { y: -0.004, z: 0.056, rx: 0.5 });                // tongue
        for (let i = 0; i < 3; i++) {
          lc.add(box(0.05, 0.007, 0.008), laceM, { y: -0.004 - i * 0.011, z: 0.05 + i * 0.024, rz: i % 2 ? 0.12 : -0.12 });
        }
        lc.flush();
      }
      this.legs.push({ hip, knee, ankle, foot, side: s });
    }

    world.addProp(this.root);

    // ── state ──────────────────────────────────────────────────────────────
    this.pos = this.root.position;
    this.heading = 0;
    this.speed = 0;
    this.phase = (spec.name.length * 1.31 + spec.height) % TAU;
    this.seed = (spec.name.charCodeAt(0) % 17) * 0.37;
    this.pose = 'stand';
    this.sitting = false;
    this.gesture = null;
    this.gestureT = 0;
    this.gestureDur = 1;
    this.gestureW = 0;
    this.lookAt = null;
    this.speaking = false;
    this.blink = 1.4;
    this._mouth = 0;
    this.walkW = 0;
    this.poseW = 0;
    this._hipY = this.hipBase;
    this._pose = poseTargets('stand', {});
    this._cur = poseTargets('stand', {});
    this._gazeT = 0;
    this._gazeY = 0;
    this._gazeX = 0;
    this._prevHeading = 0;
    this._bank = 0;
  }

  /**
   * Accepts the old boolean (`setPose(true)` = sitting) as well as any pose
   * name from POSES.
   */
  setPose(pose) {
    let p = pose;
    if (p === true) p = 'sit';
    else if (!p) p = 'stand';
    if (!POSES[p]) p = 'stand';
    if (p === this.pose) return;
    this.pose = p;
    this.sitting = p === 'sit' || p === 'desk' || p === 'read' || p === 'lounge'
      || p === 'floor' || p === 'perch';
  }

  playGesture(name, time = 1.6) {
    this.gesture = name;
    this.gestureT = time;
    this.gestureDur = Math.max(0.2, time);
  }

  // ── animation ────────────────────────────────────────────────────────────
  update(dt, t, playerPos) {
    dt = Math.min(dt, 0.06);
    const L = this.L;
    const spd = this.speed || 0;
    const standing = this.pose === 'stand';

    // Locomotion weight.  The cycle itself is never damped — only how much of
    // it is mixed in — which is what makes idle→walk a transition rather than
    // a switch.
    this.walkW = damp(this.walkW, standing ? clamp(spd / 1.5, 0, 1) : 0, spd > 0.15 ? 7 : 9, dt);
    const w = this.walkW;
    // Cadence comes from the stride the legs can actually take — an adult
    // covers 1.4 m a cycle, an eight-year-old barely 0.9, and getting this
    // wrong is what makes short characters moonwalk.
    const stride = 1.54 * (L.thigh + L.shin) * this.S;
    const cadence = clamp(spd / Math.max(0.4, stride), 0.55, 2.7);
    this.phase += dt * cadence * TAU;
    const ph = this.phase;

    // pose blend
    const tgt = poseTargets(this.pose, this._pose);
    const p = this._cur;
    for (const k in tgt) {
      if (k === 'hipY') continue;
      p[k] = damp(p[k], tgt[k], 7, dt);
    }
    this.poseW = damp(this.poseW, standing ? 0 : 1, 6, dt);

    // idle: a slow, two-rate weight shift plus breathing
    const it = t * 0.21 + this.seed;
    const shift = (Math.sin(it) * 0.62 + Math.sin(it * 0.43 + 1.7) * 0.38) * (1 - w);
    const breath = Math.sin(t * 0.95 + this.seed * 2);

    // ── legs ──
    let deepest = 0;
    for (const Lg of this.legs) {
      const side = Lg.side;
      const lp = ph + (side > 0 ? Math.PI : 0);
      // gait: heel strike at −π/2, toe-off at +π/2, swing through π
      const stance = clamp(Math.cos(lp) * 1.3 + 0.45, 0, 1);
      // Through stance the planted foot has to travel backwards at exactly the
      // walking speed, so the hip follows asin() of a linear ramp there; a
      // plain sine peaks half again as fast at mid-stance and the foot scrubs.
      const u = wrapPi(lp);
      const ramp = Math.asin(clamp(SWING_SIN * u / (Math.PI / 2), -1, 1));
      const gHip = lerp(SWING * Math.sin(lp), ramp, stance) - 0.04;
      // Knee: a small give as the weight lands, then the big swing flex.  Both
      // are kept clear of mid-stance — a knee still moving under a planted
      // foot drags it along the floor.
      const gKnee = 0.10 + 1.05 * bump(lp, Math.PI, 1.05) + 0.16 * bump(lp, -1.25, 0.6);
      // keep the sole flat through stance, then add the two contact events
      const flat = -(gHip + gKnee);
      const gAnk = flat * stance * 0.85
        + 0.46 * bump(lp, 1.32, 0.6)          // toe-off
        - 0.34 * bump(lp, -1.62, 0.62)        // heel strike
        - 0.14 * bump(lp, Math.PI, 1.0);      // swing clearance

      // idle: the loaded leg locks out, the free one softens
      const load = clamp(-shift * side, -1, 1);
      const iHip = p.hip + load * 0.035;
      const iKnee = p.knee + Math.max(0, -load) * 0.10;

      const hipX = lerp(iHip, gHip, w);
      const kneeX = Math.max(0, lerp(iKnee, gKnee, w));
      const ankX = lerp(p.ankle, gAnk, w);
      Lg.hip.rotation.x = hipX;
      Lg.hip.rotation.z = side * (p.spread + p.splay) + shift * 0.02 * side;
      Lg.hip.rotation.y = side * p.splay * 0.8;
      Lg.knee.rotation.x = kneeX;
      Lg.ankle.rotation.x = ankX;
      Lg.ankle.rotation.z = -side * p.splay * 0.5;

      // How far the sole hangs below the hip joint — measured at the toe *and*
      // the heel, because a foot rolling through toe-off would otherwise drive
      // its toe straight through the floorboards.  The pelvis then rides on
      // whichever foot is planted, which is where the walk's bounce comes from.
      const th = hipX + kneeX + ankX;
      const cth = Math.cos(th), sth = Math.sin(th);
      const depth = L.thigh * Math.cos(hipX) + L.shin * Math.cos(hipX + kneeX)
        + L.ankle * cth + Math.max(FOOT_TOE * sth, FOOT_HEEL * sth);
      if (depth > deepest) deepest = depth;
    }

    // ── pelvis ──
    const solved = deepest + 0.035;
    const sitTarget = tgt.hipY === null ? solved - tgt.drop : tgt.hipY / this.S;
    this._hipY = damp(this._hipY, sitTarget, 8, dt);
    this.hips.position.y = lerp(solved - p.drop, this._hipY, this.poseW);
    this.hips.position.x = shift * 0.016 * (1 - this.poseW);

    // turning banks the body a little — a torso that stays bolt upright
    // through a corner is the tell of a rig with no weight
    const turn = wrapPi(this.heading - this._prevHeading) / Math.max(dt, 1e-3);
    this._prevHeading = this.heading;
    this._bank = damp(this._bank, clamp(turn * 0.06, -0.16, 0.16) * w, 6, dt);

    this.hips.rotation.x = p.pitch;
    this.hips.rotation.y = p.yaw + Math.sin(ph) * 0.13 * w;                 // pelvis rotation
    this.hips.rotation.z = p.roll - shift * 0.045 * (1 - this.poseW)
      - Math.sin(ph + 0.6) * 0.05 * w + this._bank;

    // ── torso ──
    const lean = clamp(spd * 0.05, 0, 0.11) * w;
    this.torso.rotation.x = p.torsoX + lean + breath * 0.006;
    // shoulders counter-rotate against the pelvis (hips rotation is inherited,
    // so this has to cancel it first)
    this.torso.rotation.y = -Math.sin(ph) * 0.31 * w;
    this.torso.rotation.z = p.torsoZ - this._bank * 0.5;
    if (this.chest) {
      const br = 1 + breath * 0.012;
      this.chest.scale.set(br, 1 + breath * 0.005, 1 + breath * 0.018);
    }

    // ── head ──
    let gazeY = 0, gazeX = 0;
    if (this.lookAt) {
      const dx = this.lookAt.x - this.pos.x, dz = this.lookAt.z - this.pos.z;
      const want = wrapPi(Math.atan2(dx, dz) - this.heading);
      gazeY = clamp(want, -1.15, 1.15);
      const dy = this.lookAt.y - (this.pos.y + this.eyeY * this.S);
      const dist = Math.max(0.6, Math.hypot(dx, dz));
      gazeX = clamp(-Math.atan2(dy, dist), -0.5, 0.5);
      // past the neck's limit they turn the shoulders too
      this.torso.rotation.y += clamp((want - gazeY) * 0.55, -0.45, 0.45) * (1 - w);
    } else {
      // idle look-around: hold a direction for a few seconds, then pick another
      this._gazeT -= dt;
      if (this._gazeT <= 0) {
        this._gazeT = 2.4 + Math.random() * 5;
        this._gazeY = (Math.random() - 0.5) * (Math.random() < 0.3 ? 1.7 : 0.7);
        this._gazeX = (Math.random() - 0.5) * 0.34;
      }
      gazeY = this._gazeY * (1 - w * 0.7);
      gazeX = this._gazeX * (1 - w * 0.7);
    }
    this.neck.rotation.y = damp(this.neck.rotation.y, gazeY, 6, dt);
    // the head stays level: it undoes the torso's pitch and the walk's bob
    const levelX = -this.torso.rotation.x * 0.8 + p.headX;
    this.neck.rotation.x = damp(this.neck.rotation.x, clamp(levelX + gazeX, -0.7, 0.8), 7, dt);
    this.neck.rotation.z = damp(this.neck.rotation.z, -gazeY * 0.12 + shift * 0.02, 5, dt);
    this.neck.position.y = 0.475 + breath * 0.003;

    // ── arms ──
    const gk = this.gestureDur > 0 ? clamp(1 - this.gestureT / this.gestureDur, 0, 1) : 1;
    this.gestureW = damp(this.gestureW, this.gesture ? 1 : 0, 9, dt);
    for (const A of this.arms) {
      const ap = ph + (A.side > 0 ? 0 : Math.PI);        // opposes the leg on that side
      let x = lerp(p.armX, 0.42 * Math.sin(ap) + 0.05, w);
      let z = A.side * (p.armZ + 0.02 * w) + (this.pose === 'swim' ? 0 : shift * 0.02 * A.side);
      let el = lerp(p.elbow, -0.2 - 0.5 * Math.max(0, -Math.sin(ap)) - 0.1 * Math.max(0, Math.sin(ap)), w);
      let wr = p.wrist;
      let wz = 0;

      // pose flourishes: a swimmer strokes, a cook stirs, a shooter sets
      if (this.pose === 'swim') {
        const sp = t * 2.1 + (A.side > 0 ? 0 : Math.PI);
        x = -1.05 - Math.sin(sp) * 0.75;
        el = -0.45 - Math.max(0, Math.cos(sp)) * 0.6;
        z = A.side * (0.34 + Math.max(0, Math.sin(sp)) * 0.25);
      } else if (this.pose === 'work' && A.side > 0) {
        x = -0.86 + Math.sin(t * 2.6) * 0.09;
        el = -0.95 + Math.cos(t * 2.6) * 0.12;
        z = A.side * (0.12 + Math.sin(t * 2.6) * 0.05);
      } else if (this.pose === 'shoot') {
        x = -1.85 + Math.sin(t * 0.8 + A.side) * 0.05;
      } else if (this.pose === 'read' || this.pose === 'desk') {
        el += Math.sin(t * 3.1 + A.side * 1.4) * 0.03;
      }

      const g = this.gesture ? this.gestureArm(A, this.gesture, gk, t) : null;
      if (g) {
        const gw = this.gestureW;
        x = lerp(x, g.x, gw);
        z = lerp(z, g.z, gw);
        el = lerp(el, g.el, gw);
        wr = lerp(wr, g.wr || 0, gw);
        wz = lerp(0, g.wz || 0, gw);
      }

      A.sh.rotation.x = damp(A.sh.rotation.x, x, 14, dt);
      A.sh.rotation.z = damp(A.sh.rotation.z, z, 14, dt);
      A.el.rotation.x = damp(A.el.rotation.x, el, 14, dt);
      A.wrist.rotation.x = damp(A.wrist.rotation.x, wr, 16, dt);
      A.wrist.rotation.z = damp(A.wrist.rotation.z, wz, 16, dt);
    }

    // ── hair & hem ──
    if (this.tail) {
      this.tail.rotation.x = 0.35 + Math.sin(ph * 2 + 0.6) * 0.16 * (0.25 + w)
        + this.neck.rotation.x * 0.3;
      this.tail.rotation.z = Math.sin(ph + 0.4) * 0.12 * (0.2 + w) - this.neck.rotation.y * 0.25;
    }
    if (this.hairFall) {
      this.hairFall.rotation.x = -0.02 - Math.sin(ph * 2) * 0.05 * w;
      this.hairFall.rotation.z = Math.sin(ph + 0.9) * 0.07 * w;
    }
    if (this.skirt) {
      this.skirt.rotation.x = Math.sin(ph * 2 + 0.4) * 0.06 * w - lean * 0.5;
      this.skirt.rotation.z = -Math.sin(ph + 0.3) * 0.09 * w;
      this.skirt.scale.set(1 + w * 0.04, 1, 1 + w * 0.06);
    }

    // ── face ──
    this.blink -= dt;
    if (this.blink < 0) this.blink = 2.2 + Math.random() * 4.5;
    let close = 0;
    if (this.blink < 0.15) {
      const u = 1 - this.blink / 0.15;                 // 0 → 1 across the blink
      close = u < 0.4 ? u / 0.4 : 1 - (u - 0.4) / 0.6;
    }
    const lidRest = -0.2 + clamp(gazeX, -0.3, 0.3) * 0.5;
    for (const g of this.lids) g.rotation.x = lerp(lidRest, 1.42, close);

    if (this.browG) {
      const raise = (this.speaking ? 0.35 : 0)
        + (this.gesture === 'wave' || this.gesture === 'cheer' ? 0.7 : 0) * this.gestureW;
      this.browY = damp(this.browY, raise, 8, dt);
      this.browG.position.y = this.browY * 0.006;
      this.browG.rotation.x = -this.browY * 0.12;
    }
    if (this.lipBot) {
      const open = this.speaking
        ? clamp(0.42 + Math.sin(t * 17.3) * 0.34 + Math.sin(t * 9.7 + 1.2) * 0.24, 0, 1)
        : 0;
      this._mouth = damp(this._mouth, open, 22, dt);
      this.lipBot.position.y = this.lipBotY - this._mouth * 0.016;
      this.lipBot.rotation.x = this._mouth * 0.5;
    }

    this.root.rotation.y = this.heading;

    if (this.gestureT > 0) {
      this.gestureT -= dt;
      if (this.gestureT <= 0) this.gesture = null;
    }
  }

  /**
   * Per-gesture arm target. `k` runs 0→1 over the gesture, which is what lets
   * a wave wind up and a high five actually land.
   */
  gestureArm(A, name, k, t) {
    const s = A.side;
    const lead = s > 0;                       // right arm leads the one-armed ones
    switch (name) {
      case 'wave': {
        if (!lead) return { x: -0.12, z: s * 0.14, el: -0.3 };
        const swing = Math.sin(t * 9.5) * 0.55;
        return { x: -2.42, z: s * 0.36, el: -0.42 + Math.abs(swing) * 0.2, wr: 0, wz: swing };
      }
      case 'hug': {
        const close = 0.75 + Math.sin(clamp(k * 3.2, 0, Math.PI)) * 0.25;
        return { x: -1.28 * close, z: -s * 0.3 * close, el: -1.45 * close, wr: -0.3 };
      }
      case 'highfive': {
        if (!lead) return { x: -0.1, z: s * 0.13, el: -0.28 };
        const reach = k < 0.35 ? k / 0.35 : 1;
        return { x: -2.55 * reach - 0.1, z: s * 0.3, el: -0.3, wr: -0.55 };
      }
      case 'point': {
        if (!lead) return { x: -0.08, z: s * 0.12, el: -0.25 };
        return { x: -1.52, z: s * 0.06, el: -0.1, wr: -0.35 };
      }
      case 'clap': {
        const c = Math.abs(Math.sin(t * 7.5));
        return { x: -1.3, z: -s * (0.34 + c * 0.2), el: -1.55, wr: -0.4 };
      }
      case 'cheer': {
        const c = Math.sin(t * 6.2 + (lead ? 0 : 0.5));
        return { x: -2.85 - c * 0.15, z: s * (0.45 + c * 0.1), el: -0.3, wr: 0 };
      }
      case 'shoot': {
        // load, then extend — a jump shot in one line each way
        const set = k < 0.45 ? 1 : 1 - (k - 0.45) / 0.35;
        const rel = clamp((k - 0.45) / 0.35, 0, 1);
        return { x: -1.9 - rel * 0.9, z: s * (0.28 - rel * 0.1), el: -1.5 * set - 0.05, wr: -0.4 * rel };
      }
      case 'dribble': {
        if (!lead) return { x: -0.12, z: s * 0.16, el: -0.35 };
        return { x: -0.85 + Math.sin(t * 7) * 0.28, z: s * 0.18, el: -0.55, wr: 0.3 };
      }
      case 'stir': {
        if (!lead) return { x: -0.6, z: s * 0.2, el: -0.9 };
        return { x: -0.9 + Math.sin(t * 4) * 0.08, z: s * (0.16 + Math.cos(t * 4) * 0.08), el: -1.0, wr: 0.2 };
      }
      case 'swing': {
        if (!lead) return { x: -0.1, z: s * 0.14, el: -0.2 };
        return { x: 0.8 - Math.sin(k * Math.PI) * 2.6, z: s * 0.1, el: -0.12 };
      }
      case 'nod':
      default:
        return null;
    }
  }

  /**
   * Eye-level point for dialogue focus and the interaction ray.  Derived from
   * the live pelvis height and pitch, so it follows them into a chair, a bed
   * or the deep end.
   */
  eyePos(out = new THREE.Vector3()) {
    const above = (this.eyeY - this.hipBase) * Math.cos(this._cur.pitch || 0);
    return out.set(this.pos.x, this.pos.y + (this.hips.position.y + above) * this.S, this.pos.z);
  }
}
