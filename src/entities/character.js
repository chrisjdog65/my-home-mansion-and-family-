// ───────────────────────────────────────────────────────────────────────────
// Procedural characters: a jointed body built from primitives with a walk
// cycle, idle breathing, head tracking, sitting and a few gestures.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { clamp, damp, lerp } from '../core/rng.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function part(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

const box = (w, h, d, r = 0) => new THREE.BoxGeometry(w, h, d);
const cap = (r, h) => new THREE.CapsuleGeometry(r, h, 4, 10);

export class Character {
  /**
   * spec: { name, height, skin, hair, shirt, pants, shoes, hairStyle, build }
   */
  constructor(world, spec) {
    this.world = world;
    this.spec = spec;
    this.name = spec.name;
    const M = world.mats;
    const S = spec.height / 1.75;              // scale everything off 1.75 m

    const skin = M.solid(spec.skin, 0.66);
    const hairM = M.solid(spec.hair, 0.82);
    const shirt = M.solid(spec.shirt, 0.85);
    const pants = M.solid(spec.pants, 0.88);
    const shoes = M.solid(spec.shoes ?? 0x2b2b2b, 0.7);
    const eyeW = M.solid(0xf6f8fa, 0.3);
    const eyeD = M.solid(0x2a2018, 0.25);

    this.root = new THREE.Group();
    this.root.name = `npc:${spec.name}`;
    this.S = S;

    // hips is the animation root
    this.hips = new THREE.Group();
    this.hips.position.y = 0.92 * S;
    this.root.add(this.hips);

    const bw = (spec.build ?? 1);
    part(this.hips, box(0.30 * S * bw, 0.22 * S, 0.20 * S), pants, 0, 0, 0);

    this.torso = new THREE.Group();
    this.torso.position.y = 0.12 * S;
    this.hips.add(this.torso);
    part(this.torso, box(0.34 * S * bw, 0.44 * S, 0.21 * S), shirt, 0, 0.22 * S, 0);
    part(this.torso, box(0.36 * S * bw, 0.14 * S, 0.22 * S), shirt, 0, 0.44 * S, 0);   // shoulders

    // head
    this.neck = new THREE.Group();
    this.neck.position.y = 0.5 * S;
    this.torso.add(this.neck);
    part(this.neck, cap(0.045 * S, 0.06 * S), skin, 0, 0.03 * S, 0);
    this.head = new THREE.Group();
    this.head.position.y = 0.1 * S;
    this.neck.add(this.head);
    part(this.head, box(0.17 * S, 0.21 * S, 0.18 * S), skin, 0, 0.08 * S, 0);
    // face
    part(this.head, box(0.035 * S, 0.035 * S, 0.02 * S), eyeW, -0.042 * S, 0.10 * S, 0.093 * S);
    part(this.head, box(0.035 * S, 0.035 * S, 0.02 * S), eyeW, 0.042 * S, 0.10 * S, 0.093 * S);
    part(this.head, box(0.016 * S, 0.018 * S, 0.02 * S), eyeD, -0.042 * S, 0.10 * S, 0.101 * S);
    part(this.head, box(0.016 * S, 0.018 * S, 0.02 * S), eyeD, 0.042 * S, 0.10 * S, 0.101 * S);
    part(this.head, box(0.03 * S, 0.03 * S, 0.03 * S), skin, 0, 0.07 * S, 0.096 * S);        // nose
    this.mouth = part(this.head, box(0.06 * S, 0.012 * S, 0.015 * S), M.solid(0x8f5a52, 0.5), 0, 0.035 * S, 0.093 * S);

    // hair
    const style = spec.hairStyle || 'short';
    part(this.head, box(0.185 * S, 0.06 * S, 0.195 * S), hairM, 0, 0.185 * S, 0);
    if (style === 'long') {
      part(this.head, box(0.19 * S, 0.34 * S, 0.06 * S), hairM, 0, 0.06 * S, -0.085 * S);
      part(this.head, box(0.05 * S, 0.26 * S, 0.14 * S), hairM, -0.088 * S, 0.08 * S, -0.01 * S);
      part(this.head, box(0.05 * S, 0.26 * S, 0.14 * S), hairM, 0.088 * S, 0.08 * S, -0.01 * S);
    } else if (style === 'ponytail') {
      part(this.head, box(0.19 * S, 0.2 * S, 0.06 * S), hairM, 0, 0.11 * S, -0.085 * S);
      const tail = part(this.head, cap(0.035 * S, 0.24 * S), hairM, 0, 0.02 * S, -0.13 * S);
      tail.rotation.x = 0.28;
      this.tail = tail;
    } else if (style === 'bob') {
      part(this.head, box(0.2 * S, 0.2 * S, 0.2 * S), hairM, 0, 0.12 * S, -0.012 * S);
    } else {
      part(this.head, box(0.175 * S, 0.09 * S, 0.185 * S), hairM, 0, 0.145 * S, -0.005 * S);
    }

    // arms
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(s * 0.21 * S * bw, 0.42 * S, 0);
      this.torso.add(sh);
      part(sh, cap(0.045 * S, 0.2 * S), shirt, 0, -0.13 * S, 0);
      const el = new THREE.Group();
      el.position.y = -0.25 * S;
      sh.add(el);
      part(el, cap(0.04 * S, 0.18 * S), skin, 0, -0.12 * S, 0);
      const hand = part(el, box(0.07 * S, 0.1 * S, 0.05 * S), skin, 0, -0.26 * S, 0);
      this.arms.push({ sh, el, hand, side: s });
    }

    // legs
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.09 * S, -0.06 * S, 0);
      this.hips.add(hip);
      part(hip, cap(0.055 * S, 0.24 * S), pants, 0, -0.17 * S, 0);
      const knee = new THREE.Group();
      knee.position.y = -0.36 * S;
      hip.add(knee);
      part(knee, cap(0.048 * S, 0.24 * S), pants, 0, -0.16 * S, 0);
      const foot = part(knee, box(0.09 * S, 0.06 * S, 0.2 * S), shoes, 0, -0.34 * S, 0.04 * S);
      this.legs.push({ hip, knee, foot, side: s });
    }

    world.addProp(this.root);

    // state
    this.pos = this.root.position;
    this.heading = 0;
    this.speed = 0;
    this.phase = 0;
    this.sitting = false;
    this.gesture = null;
    this.gestureT = 0;
    this.lookAt = null;
    this.blink = 0;
  }

  setPose(sitting) {
    this.sitting = sitting;
  }

  playGesture(name, time = 1.6) { this.gesture = name; this.gestureT = time; }

  update(dt, t, playerPos) {
    const S = this.S;
    const walk = clamp(this.speed / 2.6, 0, 1.4);
    this.phase += dt * (2.2 + walk * 5.2);

    // body height & bob
    const bob = this.sitting ? 0 : Math.sin(this.phase * 2) * 0.014 * walk * S;
    this.hips.position.y = (this.sitting ? 0.58 : 0.92) * S + bob;
    this.hips.rotation.z = Math.sin(this.phase) * 0.02 * walk;
    this.torso.rotation.y = damp(this.torso.rotation.y, -Math.sin(this.phase) * 0.12 * walk, 12, dt);
    this.torso.rotation.x = damp(this.torso.rotation.x, this.sitting ? 0.06 : walk * 0.08, 8, dt);

    // legs
    for (const L of this.legs) {
      if (this.sitting) {
        L.hip.rotation.x = damp(L.hip.rotation.x, -1.45, 10, dt);
        L.knee.rotation.x = damp(L.knee.rotation.x, 1.5, 10, dt);
      } else {
        const ph = this.phase + (L.side > 0 ? Math.PI : 0);
        const target = Math.sin(ph) * 0.62 * walk;
        L.hip.rotation.x = damp(L.hip.rotation.x, target, 16, dt);
        L.knee.rotation.x = damp(L.knee.rotation.x, Math.max(0, -Math.cos(ph)) * 0.8 * walk, 16, dt);
      }
    }

    // arms
    for (const A of this.arms) {
      let shX = 0, shZ = 0.08 * A.side, elX = 0;
      if (this.gesture === 'wave' && A.side > 0) {
        shX = -2.3; shZ = -0.5; elX = -0.4 + Math.sin(t * 11) * 0.55;
      } else if (this.gesture === 'hug') {
        shX = -1.1; shZ = -0.7 * A.side; elX = -1.2;
      } else if (this.gesture === 'highfive' && A.side > 0) {
        shX = -2.6; shZ = -0.2; elX = -0.2;
      } else if (this.gesture === 'point') {
        if (A.side > 0) { shX = -1.5; shZ = -0.1; }
      } else if (this.sitting) {
        shX = -0.5; elX = -0.9; shZ = 0.14 * A.side;
      } else {
        const ph = this.phase + (A.side > 0 ? 0 : Math.PI);
        shX = Math.sin(ph) * -0.5 * walk;
        elX = -0.15 - Math.max(0, Math.sin(ph)) * 0.35 * walk;
      }
      A.sh.rotation.x = damp(A.sh.rotation.x, shX, 12, dt);
      A.sh.rotation.z = damp(A.sh.rotation.z, shZ, 12, dt);
      A.el.rotation.x = damp(A.el.rotation.x, elX, 12, dt);
    }

    // head look
    if (this.lookAt) {
      const dx = this.lookAt.x - this.pos.x, dz = this.lookAt.z - this.pos.z;
      const want = Math.atan2(dx, dz) - this.heading;
      const yaw = clamp(((want + Math.PI) % (Math.PI * 2)) - Math.PI, -1.1, 1.1);
      const dy = (this.lookAt.y - (this.pos.y + 1.55 * S));
      this.neck.rotation.y = damp(this.neck.rotation.y, yaw, 8, dt);
      this.neck.rotation.x = damp(this.neck.rotation.x, clamp(-dy * 0.25, -0.5, 0.5), 8, dt);
    } else {
      this.neck.rotation.y = damp(this.neck.rotation.y, Math.sin(t * 0.4 + this.S) * 0.16, 3, dt);
      this.neck.rotation.x = damp(this.neck.rotation.x, 0, 4, dt);
    }

    if (this.tail) this.tail.rotation.z = Math.sin(this.phase * 1.6) * 0.14 * (0.3 + walk);

    // blink
    this.blink -= dt;
    if (this.blink < 0) { this.blink = 2 + Math.random() * 4; }
    const blinking = this.blink < 0.12;
    this.head.children.forEach((c, i) => { if (i >= 1 && i <= 4) c.scale.y = blinking ? 0.15 : 1; });

    this.root.rotation.y = this.heading;

    if (this.gestureT > 0) {
      this.gestureT -= dt;
      if (this.gestureT <= 0) this.gesture = null;
    }
  }

  /** Eye-level point for dialogue focus. */
  eyePos(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + (this.sitting ? 1.15 : 1.62) * this.S, this.pos.z);
  }
}
