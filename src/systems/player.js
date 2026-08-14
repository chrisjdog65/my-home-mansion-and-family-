// ───────────────────────────────────────────────────────────────────────────
// First person movement: capsule vs. octree, stair stepping, crouch, sprint,
// swimming, sitting, head bob and camera lean.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import { clamp, damp, lerp } from '../core/rng.js';

const STAND_H = 1.78, CROUCH_H = 1.12, RADIUS = 0.32;
const EYE_OFFSET = -0.14;                 // eye sits just below the capsule top
const GRAVITY = 26;
const UP = new THREE.Vector3(0, 1, 0);
const SKATE_TOP = 11.5, SKATE_PUSH = 6.2;

export class Player {
  constructor(world, camera, input, settings) {
    this.world = world;
    this.camera = camera;
    this.input = input;
    this.settings = settings;

    this.capsule = new Capsule(
      new THREE.Vector3(0, RADIUS, 0),
      new THREE.Vector3(0, STAND_H - RADIUS, 0),
      RADIUS,
    );
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.height = STAND_H;
    this.onGround = false;
    this.crouching = false;
    this.sprinting = false;
    this.inWater = null;
    this.submerged = 0;
    this.bob = 0;
    this.bobAmount = 0;
    this.lean = 0;
    this.stepDistance = 0;
    this.lastStep = 0;
    this.mode = 'walk';       // walk | sit | drive
    this.seat = null;
    this.vehicle = null;
    this.landImpact = 0;
    this.fallSpeed = 0;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this._jumped = false;
    this.skating = false;
    this.board = null;
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._box = new THREE.Box3();
  }

  teleport(x, y, z, yaw = 0) {
    this.capsule.start.set(x, y + RADIUS, z);
    this.capsule.end.set(x, y + this.height - RADIUS, z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
  }

  get position() { return this.capsule.start; }
  feet(out = new THREE.Vector3()) {
    return out.copy(this.capsule.start).setY(this.capsule.start.y - RADIUS);
  }
  eye(out = new THREE.Vector3()) {
    return out.copy(this.capsule.end).setY(this.capsule.end.y + RADIUS + EYE_OFFSET);
  }

  look(dt) {
    const m = this.input.mouse;
    this.yaw -= m.dx;
    this.pitch -= m.dy;
    const gp = this.input.enabled ? this.input.gamepad() : null;
    if (gp) {
      const dz = (v) => (Math.abs(v) < 0.2 ? 0 : v);
      const s = this.settings.sensitivity * 2.6 * dt;
      this.yaw -= dz(gp.axes[2]) * s;
      this.pitch -= dz(gp.axes[3]) * s * (this.settings.invertY ? -1 : 1);
    }
    this.pitch = clamp(this.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
  }

  update(dt, interaction) {
    this.look(dt);
    if (this.mode === 'sit') return this.updateSeated(dt);
    if (this.mode === 'drive') return this.updateDriving(dt);
    this.updateWalk(dt);
  }

  // ── walking / swimming ──────────────────────────────────────────────────
  updateWalk(dt) {
    const inp = this.input;
    const water = this.world.inWater(this.capsule.start);
    this.inWater = water;
    const eyeY = this.capsule.end.y + RADIUS + EYE_OFFSET;
    this.submerged = water ? clamp((water.surfaceY - eyeY) * 3 + 0.5, 0, 1) : 0;

    // crouch
    const wantCrouch = inp.down('crouch') && !water;
    if (wantCrouch !== this.crouching) {
      if (!wantCrouch && !this.headroom()) {
        // blocked — stay crouched
      } else this.crouching = wantCrouch;
    }
    const targetH = this.crouching ? CROUCH_H : STAND_H;
    this.height = damp(this.height, targetH, 12, dt);
    this.capsule.end.y = this.capsule.start.y - RADIUS + this.height - RADIUS;

    // wish direction
    const ax = inp.axes();
    this._fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = this._v.set(0, 0, 0)
      .addScaledVector(this._fwd, ax.y)
      .addScaledVector(this._right, ax.x);
    const moving = wish.lengthSq() > 0.0001;
    if (moving) wish.normalize();

    this.sprinting = inp.down('sprint') && ax.y > 0.1 && !this.crouching;

    if (water) {
      // swimming: move where you look, float towards the surface
      const speed = this.sprinting ? 4.6 : 3.0;
      const dir = this._v.set(0, 0, 0);
      if (moving) {
        const pitchDir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
        dir.addScaledVector(pitchDir, ax.y).addScaledVector(this._right, ax.x);
        if (dir.lengthSq() > 0) dir.normalize();
      }
      if (inp.down('jump')) dir.y += 1;
      if (inp.down('crouch')) dir.y -= 1;
      this.velocity.lerp(dir.multiplyScalar(speed), 1 - Math.exp(-4.5 * dt));
      // buoyancy holds you at the surface
      const depth = water.surfaceY - (this.capsule.start.y - RADIUS + this.height * 0.72);
      this.velocity.y += clamp(depth, -0.6, 1.2) * 5.5 * dt;
      this.velocity.multiplyScalar(Math.max(0, 1 - 1.6 * dt));
      this.onGround = false;
    } else if (this.skating) {
      // A board carries its speed: you steer by leaning where you look and
      // push to build up, so the bowl's transitions trade height for speed
      // the way they should.
      const vx = this.velocity.x, vz = this.velocity.z;
      const spd = Math.hypot(vx, vz);
      if (this.onGround) {
        if (spd > 0.35) {
          const carve = 1 - Math.exp(-2.6 * dt);
          this.velocity.x += (this._fwd.x * spd - vx) * carve;
          this.velocity.z += (this._fwd.z * spd - vz) * carve;
        }
        if (ax.y > 0.1 && spd < SKATE_TOP) {
          this.velocity.addScaledVector(this._fwd, SKATE_PUSH * ax.y * dt);
        } else if (ax.y < -0.1) {                       // drag a foot to slow
          const b = Math.max(0, 1 - 3.4 * dt);
          this.velocity.x *= b; this.velocity.z *= b;
        }
        if (inp.down('crouch')) {                       // hard brake
          const b = Math.max(0, 1 - 5.5 * dt);
          this.velocity.x *= b; this.velocity.z *= b;
        }
        const roll = Math.max(0, 1 - 0.16 * dt);        // near-frictionless
        this.velocity.x *= roll; this.velocity.z *= roll;
      }
      if (inp.hit('jump')) this.jumpBuffer = 0.14;
      if (this.jumpBuffer > 0 && (this.onGround || this.coyote > 0)) {
        this.velocity.y = 6.6;                          // ollie
        this.onGround = false;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this._jumped = true;
      }
    } else {
      const base = this.crouching ? 2.0 : this.sprinting ? 6.4 : 3.6;
      const accel = this.onGround ? 42 : 9;
      const target = this._v.copy(wish).multiplyScalar(base);
      this.velocity.x = damp(this.velocity.x, target.x, accel / 6, dt);
      this.velocity.z = damp(this.velocity.z, target.z, accel / 6, dt);
      if (this.onGround && !moving) {
        this.velocity.x = damp(this.velocity.x, 0, 14, dt);
        this.velocity.z = damp(this.velocity.z, 0, 14, dt);
      }
      // a jump pressed a moment early or a moment after stepping off a ledge
      // still fires — without the grace windows it reads as eaten input
      if (inp.hit('jump')) this.jumpBuffer = 0.14;
      if (this.jumpBuffer > 0 && (this.onGround || this.coyote > 0)) {
        this.velocity.y = 7.4;
        this.onGround = false;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this._jumped = true;
      } else if (this.jumpBuffer > 0 && !this.onGround && this.tryMantle()) {
        this.jumpBuffer = 0;
      }
    }
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    // integrate (sub-stepped so fast movement can't tunnel, and gravity is
    // applied per sub-step so jump height doesn't drift with frame rate)
    const steps = Math.min(5, Math.ceil((this.velocity.length() * dt) / 0.28) || 1);
    const h = dt / steps;
    this.coyote = this.onGround ? 0.18 : Math.max(0, this.coyote - dt);
    const wasGrounded = this.onGround;
    for (let i = 0; i < steps; i++) {
      if (!water) this.velocity.y -= GRAVITY * h;
      const bx = this.capsule.start.x, bz = this.capsule.start.z;
      this._v.copy(this.velocity).multiplyScalar(h);
      const wantX = this._v.x, wantZ = this._v.z;
      this.capsule.translate(this._v);
      this.collide();
      // if a kerb, threshold or stair nosing ate the movement, step over it
      const gotX = this.capsule.start.x - bx, gotZ = this.capsule.start.z - bz;
      const want = Math.hypot(wantX, wantZ);
      if (want > 1e-4 && Math.hypot(gotX, gotZ) < want * 0.55 && (this.onGround || this.coyote > 0 || water)) {
        this.tryStepUp(wantX - gotX, wantZ - gotZ);
      }
    }
    // walking down stairs: glue to the treads instead of skipping airborne
    if (wasGrounded && !this.onGround && !this._jumped && !water && this.velocity.y <= 0.01) {
      this.snapDown();
    }
    if (this.onGround) this._jumped = false;

    // footsteps + head bob
    const speedXZ = Math.hypot(this.velocity.x, this.velocity.z);
    this.stepDistance += speedXZ * dt;
    // no walking bob on a board — at skating speed it's nauseating
    this.bobAmount = damp(this.bobAmount, this.onGround && !this.skating ? clamp(speedXZ / 6, 0, 1) : 0, 8, dt);
    this.bob += dt * speedXZ * 1.9;
  }

  /**
   * Lift → move → drop. Capsule-vs-triangle collision alone treats a 20 cm kerb
   * as a wall, so stairs, thresholds and pool coping need an explicit step.
   */
  tryStepUp(dx, dz) {
    const STEP = 0.52;
    const oct = this.world.octree;
    const s0 = this.capsule.start.clone(), e0 = this.capsule.end.clone();
    const restore = () => { this.capsule.start.copy(s0); this.capsule.end.copy(e0); };

    this.capsule.translate(this._v.set(0, STEP, 0));
    if (oct.capsuleIntersect(this.capsule)) { restore(); return false; }
    this.capsule.translate(this._v.set(dx, 0, dz));
    if (oct.capsuleIntersect(this.capsule)) { restore(); return false; }

    for (let drop = 0; drop <= STEP + 0.05; drop += 0.045) {
      this.capsule.translate(this._v.set(0, -0.045, 0));
      const hit = oct.capsuleIntersect(this.capsule);
      if (hit) {
        if (hit.normal.y < 0.42) { restore(); return false; }   // landed on a wall, not a step
        this.capsule.translate(this._v.copy(hit.normal).multiplyScalar(hit.depth + 0.001));
        this.onGround = true;
        if (this.velocity.y < 0) this.velocity.y = 0;
        return true;
      }
    }
    restore();
    return false;
  }

  headroom() {
    const c = this.capsule.clone();
    c.end.y = c.start.y - RADIUS + STAND_H - RADIUS;
    return !this.world.octree.capsuleIntersect(c);
  }

  /** Step onto the board — carried in hand until now. */
  startSkating(board) {
    this.skating = true;
    this.board = board;
    this.crouching = false;
  }
  stopSkating() {
    this.skating = false;
    const b = this.board;
    this.board = null;
    // shed the speed you were carrying, or you keep sliding on your boots
    this.velocity.x *= 0.3; this.velocity.z *= 0.3;
    return b;
  }

  /**
   * Jump at a ledge too tall to step onto and you pull yourself up. Only runs
   * on a jump press against something solid, so it never fires by accident.
   */
  tryMantle() {
    const oct = this.world.octree;
    const s0 = this.capsule.start.clone(), e0 = this.capsule.end.clone();
    const restore = () => { this.capsule.start.copy(s0); this.capsule.end.copy(e0); };
    const reach = this._v.set(this._fwd.x, 0, this._fwd.z).multiplyScalar(0.62);
    if (reach.lengthSq() < 1e-6) return false;

    // is there actually a wall in front to pull up on?
    this.capsule.translate(reach);
    const blocked = oct.capsuleIntersect(this.capsule);
    restore();
    if (!blocked || blocked.normal.y > 0.42) return false;

    for (let lift = 0.55; lift <= 1.5; lift += 0.075) {
      this.capsule.start.set(s0.x, s0.y + lift, s0.z);
      this.capsule.end.set(e0.x, e0.y + lift, e0.z);
      if (oct.capsuleIntersect(this.capsule)) continue;      // no headroom yet
      this.capsule.translate(reach);
      if (oct.capsuleIntersect(this.capsule)) { restore(); continue; }
      // there must be something solid to land on just below
      const probe = this.capsule.clone();
      probe.translate(this._v2.set(0, -0.14, 0));
      const floor = oct.capsuleIntersect(probe);
      if (!floor || floor.normal.y < 0.5) { restore(); continue; }
      this.velocity.set(0, 0.6, 0);
      this.onGround = false;
      this._jumped = true;
      this.landImpact = 0;
      return true;
    }
    restore();
    return false;
  }

  /**
   * Descending a stair at walking speed out-runs gravity, so without this the
   * player skips airborne off every tread — killing footsteps and head bob.
   * Sweep a short way down; if ground is there, stand on it.
   */
  snapDown() {
    const oct = this.world.octree;
    const s0 = this.capsule.start.clone(), e0 = this.capsule.end.clone();
    const MAX = 0.42;
    for (let d = 0; d < MAX; d += 0.06) {
      this.capsule.translate(this._v.set(0, -0.06, 0));
      const hit = oct.capsuleIntersect(this.capsule);
      if (hit) {
        if (hit.normal.y < 0.42) break;   // a wall, not a tread
        this.capsule.translate(this._v.copy(hit.normal).multiplyScalar(hit.depth + 0.001));
        this.onGround = true;
        if (this.velocity.y < 0) this.velocity.y = 0;
        return true;
      }
    }
    this.capsule.start.copy(s0);
    this.capsule.end.copy(e0);
    return false;
  }

  collide() {
    const oct = this.world.octree;
    let grounded = false;
    for (let i = 0; i < 3; i++) {
      const hit = oct.capsuleIntersect(this.capsule);
      if (!hit) break;
      if (hit.normal.y > 0.42) {
        grounded = true;
        this.velocity.addScaledVector(hit.normal, -hit.normal.dot(this.velocity));
      } else {
        const d = hit.normal.dot(this.velocity);
        if (d < 0) this.velocity.addScaledVector(hit.normal, -d);
      }
      this.capsule.translate(this._v.copy(hit.normal).multiplyScalar(hit.depth + 0.0008));
    }
    // dynamic blockers (closed doors, parked cars)
    for (const b of this.world.blockers) {
      if (b.active === false) continue;
      this.resolveBox(b);
    }
    if (grounded && !this.onGround) {
      this.landImpact = clamp(this.fallSpeed / 14, 0, 1);
    }
    this.fallSpeed = grounded ? 0 : Math.max(this.fallSpeed, -this.velocity.y);
    this.onGround = grounded;
  }

  /** Capsule vs. rotated box (used for door leaves and vehicle bodies). */
  resolveBox(b) {
    const c = Math.cos(-b.rotY), s = Math.sin(-b.rotY);
    for (const p of [this.capsule.start, this.capsule.end]) {
      const dx = p.x - b.pos.x, dz = p.z - b.pos.z;
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      const ly = p.y - b.pos.y;
      const px = clamp(lx, -b.halfW, b.halfW);
      const py = clamp(ly, -b.halfH, b.halfH);
      const pz = clamp(lz, -b.halfD, b.halfD);
      const ox = lx - px, oy = ly - py, oz = lz - pz;
      const d2 = ox * ox + oy * oy + oz * oz;
      if (d2 > this.capsule.radius * this.capsule.radius) continue;
      let nx, ny, nz, depth;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        nx = ox / d; ny = oy / d; nz = oz / d;
        depth = this.capsule.radius - d;
      } else {
        // centre inside the box — push out along the shallowest axis
        const ex = b.halfW - Math.abs(lx), ey = b.halfH - Math.abs(ly), ez = b.halfD - Math.abs(lz);
        if (ex < ey && ex < ez) { nx = Math.sign(lx) || 1; ny = 0; nz = 0; depth = ex + this.capsule.radius; }
        else if (ez < ey) { nx = 0; ny = 0; nz = Math.sign(lz) || 1; depth = ez + this.capsule.radius; }
        else { nx = 0; ny = Math.sign(ly) || 1; nz = 0; depth = ey + this.capsule.radius; }
      }
      // back to world space
      const wc = Math.cos(b.rotY), ws = Math.sin(b.rotY);
      const wx = nx * wc - nz * ws;
      const wz = nx * ws + nz * wc;
      this._v.set(wx * depth, ny * depth, wz * depth);
      this.capsule.translate(this._v);
      const vn = this.velocity.x * wx + this.velocity.y * ny + this.velocity.z * wz;
      if (vn < 0) {
        this.velocity.x -= wx * vn; this.velocity.y -= ny * vn; this.velocity.z -= wz * vn;
      }
    }
  }

  // ── sitting ─────────────────────────────────────────────────────────────
  sit(seat) {
    this.seat = seat;
    this.mode = 'sit';
    this.velocity.set(0, 0, 0);
    this.seatYaw = seat.rotY !== undefined ? seat.rotY + Math.PI : this.yaw;
  }
  stand() {
    if (this.mode === 'sit' && this.seat) {
      // Step out behind the seat, fanning outwards until somewhere is clear —
      // bar stools face a counter, and a blind step would land inside it.
      const s = this.seat;
      const spots = [];
      for (let i = 0; i < 8; i++) {
        const a = this.seatYaw + Math.PI + ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI) / 4;
        spots.push([s.x + Math.sin(a) * 0.95, s.z + Math.cos(a) * 0.95]);
      }
      spots.push([s.x, s.z]);
      for (const [x, z] of spots) {
        this.teleport(x, s.y - 0.1, z, this.yaw);
        if (!this.world.octree.capsuleIntersect(this.capsule)) break;
      }
    }
    this.mode = 'walk';
    this.seat = null;
    if (this.vehicle) { this.vehicle.occupied = false; this.vehicle = null; }
  }
  updateSeated(dt) {
    const s = this.seat;
    this.capsule.start.set(s.x, s.y + RADIUS, s.z);
    this.capsule.end.set(s.x, s.y + 0.72, s.z);
    this.height = 0.9;
    this.bobAmount = damp(this.bobAmount, 0, 10, dt);
  }

  // ── driving ─────────────────────────────────────────────────────────────
  drive(v) {
    if (this.vehicle && this.vehicle !== v) this.vehicle.occupied = false;
    this.vehicle = v;
    this.mode = 'drive';
    v.occupied = true;
    this.yaw = v.heading + Math.PI;
    this.velocity.set(0, 0, 0);
  }
  exitVehicle() {
    const v = this.vehicle;
    if (!v) return;
    v.occupied = false;
    const side = new THREE.Vector3(Math.cos(v.heading), 0, -Math.sin(v.heading)).multiplyScalar(-2.3);
    this.teleport(v.pos.x + side.x, v.pos.y + 0.6, v.pos.z + side.z, this.yaw);
    this.mode = 'walk';
    this.vehicle = null;
  }
  updateDriving(dt) {
    const v = this.vehicle;
    if (!v) { this.mode = 'walk'; return; }
    const seat = this._v.copy(v.seat).applyAxisAngle(UP, v.heading).add(v.pos);
    this.capsule.start.copy(seat);
    this.capsule.end.copy(seat).setY(seat.y + 0.4);
    this.bobAmount = 0;
  }

  vehicleControls() {
    const inp = this.input;
    const ax = inp.axes();
    return { throttle: ax.y, steer: ax.x, brake: inp.down('jump') };
  }

  // ── camera ──────────────────────────────────────────────────────────────
  syncCamera(dt) {
    const cam = this.camera;
    if (this.mode === 'drive' && this.vehicle) {
      // rigid attach — any smoothing here lags metres behind at speed and
      // puts the camera through the rear glass
      const v = this.vehicle;
      cam.position.copy(v.seat).applyAxisAngle(UP, v.heading).add(v.pos);
      cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      return;
    }

    const eye = this.eye(this._v);
    if (this.mode === 'sit') {
      eye.set(this.seat.x, this.seat.y + 0.68, this.seat.z);
    }
    // head bob + landing dip
    const b = this.settings.headBob ? this.bobAmount : 0;
    const bobY = Math.sin(this.bob * 2) * 0.035 * b;
    const bobX = Math.cos(this.bob) * 0.028 * b;
    this.landImpact = damp(this.landImpact, 0, 7, dt);
    eye.y += bobY - this.landImpact * 0.28;

    cam.position.lerp(eye, 1 - Math.exp(-30 * dt));
    const strafeLean = clamp((this.velocity.x * Math.cos(this.yaw) - this.velocity.z * Math.sin(this.yaw)) * 0.012, -0.05, 0.05);
    this.lean = damp(this.lean, strafeLean + bobX * 0.3, 8, dt);
    cam.rotation.set(this.pitch, this.yaw, this.lean, 'YXZ');
  }
}
