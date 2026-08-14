// ───────────────────────────────────────────────────────────────────────────
// Dynamic props: everything you can pick up, throw, bounce or knock over.
// Sphere colliders against the world octree, plus sphere↔sphere impulses.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { clamp } from '../core/rng.js';

const GRAVITY = 18;   // heavier than life, but a thrown ball still arcs

export class Props {
  constructor(world) {
    this.world = world;
    this.list = [];
    this.held = null;
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._sphere = new THREE.Sphere(new THREE.Vector3(), 1);
  }

  add(opts) {
    const p = Object.assign({
      radius: 0.12, mass: 1, bounce: 0.42, friction: 2.6, spin: new THREE.Vector3(),
      velocity: new THREE.Vector3(), grounded: false, canGrab: true, name: 'Object',
      upright: false, knocked: false, sound: null, home: null, restY: 0, age: 0,
    }, opts);
    p.mesh.matrixAutoUpdate = true;
    p.pos = p.mesh.position;
    if (!p.home) p.home = p.pos.clone();
    p.restY = p.home.y;
    this.world.addProp(p.mesh);
    this.list.push(p);
    if (p.canGrab) {
      this.world.addInteract({
        pos: p.pos, radius: 2.0, dynamic: true,
        label: () => `Pick up the ${p.name}`,
        kind: 'prop', data: p,
      });
    }
    return p;
  }

  grab(p) {
    if (this.held) this.drop();
    this.held = p;
    p.velocity.set(0, 0, 0);
    p.knocked = false;
    return p;
  }

  drop(impulse = null) {
    const p = this.held;
    if (!p) return null;
    this.held = null;
    if (impulse) p.velocity.copy(impulse);
    else p.velocity.set(0, 0, 0);
    return p;
  }

  /** Keeps the held object floating in front of the camera. */
  updateHeld(camera, dt) {
    const p = this.held;
    if (!p) return;
    const target = this._v.set(0, -0.16, -0.75).applyQuaternion(camera.quaternion).add(camera.position);
    p.pos.lerp(target, 1 - Math.exp(-18 * dt));
    p.mesh.quaternion.slerp(camera.quaternion, 1 - Math.exp(-10 * dt));
  }

  /**
   * Capsule-vs-sphere: the player's boots push props aside (and wake them).
   * @returns {boolean} whether the player is touching this prop
   */
  playerPush(p, capsule, playerVelocity) {
    const seg = this._v2.subVectors(capsule.end, capsule.start);
    const t = clamp(this._v.subVectors(p.pos, capsule.start).dot(seg) / seg.lengthSq(), 0, 1);
    this._v.copy(capsule.start).addScaledVector(seg, t);
    const d = this._v.subVectors(p.pos, this._v);
    const r = p.radius + capsule.radius;
    const l2 = d.lengthSq();
    if (l2 >= r * r || l2 < 1e-8) return false;
    const l = Math.sqrt(l2);
    d.multiplyScalar(1 / l);
    p.pos.addScaledVector(d, r - l);
    const push = playerVelocity ? Math.max(0, playerVelocity.dot(d)) : 0;
    p.velocity.addScaledVector(d, push + 0.6);
    p.sleeping = false;
    if (p.upright && p.age > 0.5 && push > 1.0) p.knocked = true;
    return true;
  }

  update(dt, onImpact, playerCapsule = null, playerVelocity = null) {
    const oct = this.world.octree;
    for (const p of this.list) {
      if (p === this.held) continue;
      p.age += dt;
      const speed2 = p.velocity.lengthSq();
      if (p.sleeping && speed2 < 0.0004) {
        // still kickable while asleep — the touch is what wakes it
        if (!(playerCapsule && this.playerPush(p, playerCapsule, playerVelocity))) continue;
      }

      p.velocity.y -= GRAVITY * dt;
      // air drag
      p.velocity.multiplyScalar(Math.max(0, 1 - 0.12 * dt));

      // sub-step so a thrown ball can't pass through a wall between frames
      const steps = Math.min(6, Math.ceil((p.velocity.length() * dt) / (p.radius * 0.8)) || 1);
      const h = dt / steps;
      p.grounded = false;
      for (let s = 0; s < steps; s++) {
        p.pos.addScaledVector(p.velocity, h);
        this._sphere.center.copy(p.pos);
        this._sphere.radius = p.radius;
        const hit = oct.sphereIntersect(this._sphere);
        if (!hit) continue;
        const vn = p.velocity.dot(hit.normal);
        if (vn < 0) {
          const impact = -vn;
          // gentle contacts settle dead — bouncing the per-frame gravity
          // impulse forever would keep resting props micro-hopping
          const e = impact > 1.0 ? p.bounce : 0;
          p.velocity.addScaledVector(hit.normal, -(1 + e) * vn);
          if (impact > 1.4 && onImpact) onImpact(p, impact, hit.normal);
          // an upright object only topples from a sideways knock, never from
          // settling onto the floor
          if (p.upright && impact > 1.2 && Math.abs(hit.normal.y) < 0.7 && p.age > 0.5) p.knocked = true;
        }
        p.pos.addScaledVector(hit.normal, hit.depth + 0.001);
        // ground friction
        if (hit.normal.y > 0.6) {
          const f = Math.max(0, 1 - p.friction * dt);
          p.velocity.x *= f; p.velocity.z *= f;
          p.grounded = true;
        }
      }

      // the player's boots: walking into a ball nudges it, walking into a
      // pin knocks it flying
      if (playerCapsule) this.playerPush(p, playerCapsule, playerVelocity);

      // roll / tumble
      if (p.upright) {
        const lean = clamp(p.velocity.length() * 0.5, 0, 1);
        if (p.knocked) {
          p.mesh.rotation.z = THREE.MathUtils.lerp(p.mesh.rotation.z, Math.PI / 2, dt * 6);
          p.mesh.rotation.y += p.velocity.x * dt * 0.5;
        } else {
          p.mesh.rotation.z = THREE.MathUtils.lerp(p.mesh.rotation.z, lean * 0.15, dt * 6);
        }
      } else if (speed2 > 0.02) {
        // rolling axis is up × v — for travel +x the ball turns about −z
        const axis = this._v2.set(p.velocity.z, 0, -p.velocity.x);
        if (axis.lengthSq() > 1e-6) {
          axis.normalize();
          p.mesh.rotateOnWorldAxis(axis, (p.velocity.length() / p.radius) * dt);
        }
      }

      p.sleeping = p.grounded && p.velocity.lengthSq() < 0.0008;
      if (p.sleeping) p.velocity.set(0, 0, 0);

      // safety net: anything that escapes the world goes home
      if (p.pos.y < -40 || Math.abs(p.pos.x) > 400 || Math.abs(p.pos.z) > 500) this.reset(p);
    }

    // sphere↔sphere
    for (let i = 0; i < this.list.length; i++) {
      const a = this.list[i];
      if (a === this.held) continue;
      for (let j = i + 1; j < this.list.length; j++) {
        const b = this.list[j];
        if (b === this.held) continue;
        const d = this._v.subVectors(b.pos, a.pos);
        const r = a.radius + b.radius;
        const l2 = d.lengthSq();
        if (l2 > r * r || l2 < 1e-8) continue;
        const l = Math.sqrt(l2);
        d.multiplyScalar(1 / l);
        const overlap = (r - l) / 2;
        a.pos.addScaledVector(d, -overlap);
        b.pos.addScaledVector(d, overlap);
        const va = a.velocity.dot(d), vb = b.velocity.dot(d);
        const ma = a.mass, mb = b.mass;
        const impulse = (2 * (va - vb)) / (ma + mb);
        a.velocity.addScaledVector(d, -impulse * mb);
        b.velocity.addScaledVector(d, impulse * ma);
        a.sleeping = b.sleeping = false;
        if (Math.abs(va - vb) > 1.2) {
          if (a.upright && a.age > 0.5) a.knocked = true;
          if (b.upright && b.age > 0.5) b.knocked = true;
          onImpact?.(b, Math.abs(va - vb), d);
        }
      }
    }
  }

  reset(p) {
    p.pos.copy(p.home);
    p.velocity.set(0, 0, 0);
    p.mesh.rotation.set(0, 0, 0);
    p.knocked = false;
    p.sleeping = false;
    p.age = 0;
  }

  resetGroup(tag) {
    for (const p of this.list) if (p.tag === tag) this.reset(p);
  }

  countKnocked(tag) {
    let n = 0;
    for (const p of this.list) if (p.tag === tag && (p.knocked || p.pos.y < p.restY - 0.25)) n++;
    return n;
  }
}
