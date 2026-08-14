// ───────────────────────────────────────────────────────────────────────────
// The truck and the Lamborghini — built from panels, and both drivable from
// the driver's seat in first person.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { boxMesh } from './build.js';
import { clamp, damp } from '../core/rng.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function panel(group, w, h, d, mat, x, y, z, o = {}) {
  const m = boxMesh(w, h, d, mat, x, y, z, o);
  group.add(m);
  return m;
}

// ── Ford F-350 style crew-cab, lifted, with a light bar ────────────────────
export function buildTruck(world, x, z, rotY = 0) {
  const M = world.mats;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const body = M.get('carPaintBlue');
  const trim = M.get('blackMetal');
  const chrome = M.get('chrome');
  const glass = M.get('carGlass');

  // frame & bed
  panel(g, 2.15, 0.5, 5.9, body, 0, 1.02, 0);
  panel(g, 2.0, 0.55, 2.3, body, 0, 1.42, -1.62);           // bed sides
  panel(g, 1.7, 0.45, 2.05, M.get('rubber'), 0, 1.4, -1.62);// bed liner
  panel(g, 2.05, 0.6, 0.14, body, 0, 1.42, -2.78);          // tailgate
  panel(g, 2.15, 0.2, 0.3, chrome, 0, 0.86, -3.02);         // rear bumper
  // cab
  panel(g, 2.1, 0.95, 2.5, body, 0, 1.72, 0.55);
  panel(g, 1.95, 0.7, 2.3, glass, 0, 2.3, 0.6);
  panel(g, 2.02, 0.12, 2.35, body, 0, 2.66, 0.6);           // roof
  // hood & grille
  panel(g, 2.1, 0.55, 1.9, body, 0, 1.5, 2.35);
  panel(g, 2.05, 0.62, 0.18, trim, 0, 1.45, 3.28);
  for (let i = 0; i < 5; i++) panel(g, 1.9, 0.06, 0.06, chrome, 0, 1.25 + i * 0.11, 3.36);
  panel(g, 2.2, 0.24, 0.35, chrome, 0, 0.95, 3.36);         // bumper
  for (const s of [-1, 1]) {
    panel(g, 0.45, 0.22, 0.1, M.emissive(0xfff2d8, 1.4), s * 0.75, 1.52, 3.38);   // headlights
    panel(g, 0.4, 0.2, 0.08, M.emissive(0xd0342c, 1.0), s * 0.8, 1.55, -3.05);    // tail lights
    panel(g, 0.12, 0.34, 0.2, trim, s * 1.15, 2.2, 1.6);                          // mirrors
  }
  // light bar + exhaust + steps
  panel(g, 1.5, 0.14, 0.16, trim, 0, 2.78, 1.2);
  for (let i = 0; i < 6; i++) panel(g, 0.18, 0.1, 0.12, M.emissive(0xdff0ff, 1.2), -0.6 + i * 0.24, 2.78, 1.14);
  for (const s of [-1, 1]) {
    panel(g, 0.1, 0.1, 1.9, chrome, s * 1.05, 0.72, 0.4);
    panel(g, 0.14, 0.14, 0.5, chrome, s * 0.7, 0.95, -3.1);
  }

  const wheels = addWheels(g, M, 0.62, 0.34, [[-1.02, 1.95], [1.02, 1.95], [-1.02, -1.75], [1.02, -1.75]], 0.62);

  // interior: dash, wheel, seats
  panel(g, 1.9, 0.35, 0.4, M.get('darkPlastic'), 0, 1.9, 1.55);
  panel(g, 0.7, 0.1, 0.35, M.emissive(0x64c8ff, 0.5), -0.45, 2.02, 1.5);
  const wheelG = new THREE.Group();
  wheelG.position.set(-0.45, 2.02, 1.28);
  wheelG.rotation.x = -0.5;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.028, 8, 22), M.get('leather'));
  wheelG.add(rim);
  wheelG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8), M.get('darkPlastic')));
  g.add(wheelG);
  for (const s of [-1, 1]) {
    panel(g, 0.55, 0.1, 0.5, M.get('leather'), s * 0.45, 1.55, 0.75);
    panel(g, 0.55, 0.7, 0.1, M.get('leather'), s * 0.45, 1.9, 0.5);
  }

  world.addProp(g);
  return makeVehicle(world, {
    name: 'Ford F-350 Super Duty', group: g, wheels, steerWheel: wheelG,
    seat: V(-0.45, 1.72, 0.72), radius: 1.9,
    maxSpeed: 26, accel: 12, brake: 26, grip: 1.5, mass: 3,
    engine: { base: 62, rev: 1.9, growl: 0.55 },
  }, x, z, rotY);
}

// ── Lamborghini style mid-engine supercar ──────────────────────────────────
export function buildLambo(world, x, z, rotY = 0) {
  const M = world.mats;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const body = M.get('carPaintYellow');
  const trim = M.get('blackMetal');
  const glass = M.get('carGlass');

  panel(g, 1.95, 0.34, 4.4, body, 0, 0.52, 0);                       // main tub
  panel(g, 1.85, 0.22, 1.7, body, 0, 0.76, 1.2, { rotX: -0.12 });    // bonnet slope
  panel(g, 1.7, 0.42, 1.5, glass, 0, 0.98, 0.25, { rotX: 0.34 });    // windscreen
  panel(g, 1.6, 0.3, 1.3, body, 0, 1.14, -0.55);                     // roof
  panel(g, 1.5, 0.36, 0.9, glass, 0, 0.98, -1.25, { rotX: -0.42 });  // rear glass
  panel(g, 1.9, 0.3, 1.1, body, 0, 0.72, -1.6);                      // engine deck
  for (const s of [-1, 1]) {
    panel(g, 0.22, 0.34, 1.9, body, s * 0.95, 0.82, -0.4);           // shoulders
    panel(g, 0.5, 0.16, 0.34, trim, s * 0.86, 0.72, -0.2);           // side intake
    panel(g, 0.42, 0.1, 0.14, M.emissive(0xffffff, 1.6), s * 0.62, 0.72, 2.16);
    panel(g, 0.5, 0.08, 0.1, M.emissive(0xd0342c, 1.4), s * 0.6, 0.8, -2.2);
    panel(g, 0.1, 0.22, 0.14, trim, s * 1.06, 0.98, 0.55);           // mirror
  }
  panel(g, 1.6, 0.1, 0.4, trim, 0, 1.06, -2.15, { rotX: 0.2 });      // wing
  for (const s of [-1, 1]) panel(g, 0.09, 0.24, 0.1, trim, s * 0.7, 0.94, -2.12);
  panel(g, 1.5, 0.22, 0.24, trim, 0, 0.44, 2.24);                    // splitter
  panel(g, 1.3, 0.26, 0.2, trim, 0, 0.5, -2.28);                     // diffuser
  for (const s of [-1, 1]) panel(g, 0.16, 0.16, 0.16, M.get('chrome'), s * 0.3, 0.62, -2.34);

  const wheels = addWheels(g, M, 0.36, 0.22, [[-0.92, 1.4], [0.92, 1.4], [-0.95, -1.35], [0.95, -1.35]], 0.36, 0x1a1c20);

  // cockpit
  panel(g, 1.5, 0.22, 0.34, M.get('darkPlastic'), 0, 0.82, 0.86);
  panel(g, 0.5, 0.12, 0.3, M.emissive(0xff6a2a, 0.6), -0.35, 0.9, 0.82);
  const wheelG = new THREE.Group();
  wheelG.position.set(-0.35, 0.88, 0.64);
  wheelG.rotation.x = -0.62;
  wheelG.add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.024, 8, 20), M.get('leather')));
  g.add(wheelG);
  for (const s of [-1, 1]) {
    panel(g, 0.46, 0.08, 0.5, M.get('leather'), s * 0.38, 0.62, 0.1);
    panel(g, 0.46, 0.6, 0.09, M.get('leather'), s * 0.38, 0.9, -0.16);
  }

  world.addProp(g);
  return makeVehicle(world, {
    name: 'Lamborghini', group: g, wheels, steerWheel: wheelG,
    seat: V(-0.35, 0.78, 0.1), radius: 1.5,
    maxSpeed: 62, accel: 26, brake: 34, grip: 2.5, mass: 1.4,
    engine: { base: 110, rev: 3.2, growl: 0.3 },
  }, x, z, rotY);
}

function addWheels(g, M, r, width, spots, lift, rimColor = 0xc8ccd2) {
  const rubber = M.get('rubber');
  const rim = M.solid(rimColor, 0.25, 1);
  const out = [];
  for (const [ox, oz] of spots) {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, width, 20), rubber);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, width + 0.02, 16), rim);
    disc.rotation.z = Math.PI / 2;
    w.add(tyre, disc);
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(width + 0.03, r * 1.1, 0.05), rim);
      sp.rotation.x = (i / 5) * Math.PI;
      w.add(sp);
    }
    w.position.set(ox, r, oz);
    g.add(w);
    out.push({ obj: w, steer: oz > 0, radius: r });
  }
  return out;
}

// ── drivable vehicle controller ────────────────────────────────────────────
function makeVehicle(world, cfg, x, z, rotY) {
  const v = Object.assign({
    pos: V(x, 0, z), heading: rotY, speed: 0, steer: 0, wheelSpin: 0,
    grounded: true, vy: 0, occupied: false,
  }, cfg);
  v.home = V(x, 0, z);
  v.homeHeading = rotY;

  world.vehicles.push(v);
  world.addInteract({
    pos: v.pos, radius: 3.4, dynamic: true,
    label: () => `Get in the ${v.name}`,
    kind: 'vehicle', data: v,
  });
  return v;
}

const _ray = new THREE.Ray();
const _down = V(0, -1, 0);
const _sphere = new THREE.Sphere(V(), 1);
const _fwd = new THREE.Vector3();

export function updateVehicle(v, world, dt, ctrl) {
  const throttle = ctrl ? ctrl.throttle : 0;
  const steerIn = ctrl ? ctrl.steer : 0;
  const braking = ctrl ? ctrl.brake : (Math.abs(v.speed) > 0.1);

  // longitudinal
  if (throttle > 0) v.speed += v.accel * throttle * dt * (1 - clamp(v.speed / v.maxSpeed, 0, 0.92));
  else if (throttle < 0) v.speed += v.accel * throttle * dt * 0.7;
  if (braking) v.speed = damp(v.speed, 0, v.brake * 0.35, dt);
  v.speed = damp(v.speed, 0, 0.7, dt);                    // rolling resistance
  v.speed = clamp(v.speed, -v.maxSpeed * 0.35, v.maxSpeed);

  // steering: less authority at speed, none when stopped
  const authority = clamp(Math.abs(v.speed) / 6, 0, 1) * (1 - clamp(Math.abs(v.speed) / (v.maxSpeed * 1.6), 0, 0.6));
  v.steer = damp(v.steer, steerIn, 9, dt);
  v.heading -= v.steer * authority * v.grip * dt * Math.sign(v.speed || 1);

  _fwd.set(Math.sin(v.heading), 0, Math.cos(v.heading));
  const step = v.speed * dt;
  v.pos.addScaledVector(_fwd, step);

  // ground follow
  _ray.origin.set(v.pos.x, v.pos.y + 4, v.pos.z);
  _ray.direction.copy(_down);
  const hit = world.octree.rayIntersect(_ray);
  const groundY = hit ? hit.position.y : null;
  if (groundY !== null && v.pos.y + 4 - hit.distance > -50) {
    const target = groundY;
    if (v.pos.y < target + 0.05) { v.pos.y = damp(v.pos.y, target, 16, dt); v.vy = 0; v.grounded = true; }
    else { v.vy -= 22 * dt; v.pos.y += v.vy * dt; v.grounded = false; if (v.pos.y < target) { v.pos.y = target; v.vy = 0; v.grounded = true; } }
  } else {
    v.vy -= 22 * dt; v.pos.y += v.vy * dt;
    if (v.pos.y < -20) { resetVehicle(v); }
  }

  // body collision
  _sphere.center.set(v.pos.x, v.pos.y + v.radius * 0.8, v.pos.z);
  _sphere.radius = v.radius;
  const c = world.octree.sphereIntersect(_sphere);
  if (c && Math.abs(c.normal.y) < 0.6) {
    v.pos.addScaledVector(c.normal, c.depth);
    const into = _fwd.dot(c.normal);
    if (into < -0.2) v.speed *= 0.35;
    else v.speed *= 0.9;
  }

  // visuals
  v.group.position.copy(v.pos);
  v.group.rotation.y = v.heading;
  v.group.rotation.z = damp(v.group.rotation.z, -v.steer * clamp(Math.abs(v.speed) / v.maxSpeed, 0, 1) * 0.09, 6, dt);
  v.wheelSpin += (v.speed / 0.4) * dt;
  for (const w of v.wheels) {
    w.obj.rotation.x = v.wheelSpin;
    w.obj.rotation.y = w.steer ? -v.steer * 0.5 : 0;
  }
  if (v.steerWheel) v.steerWheel.rotation.z = -v.steer * 2.2;
}

export function resetVehicle(v) {
  v.pos.copy(v.home);
  v.heading = v.homeHeading;
  v.speed = 0; v.vy = 0;
}
