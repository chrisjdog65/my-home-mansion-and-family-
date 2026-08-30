// ───────────────────────────────────────────────────────────────────────────
// The truck and the Lamborghini — built from panels, and both drivable from
// the driver's seat in first person.
//
// Bodywork is authored as small boxes and merged per material at build time
// (one Batcher per vehicle), so a car carrying a couple of hundred panels of
// shut-lines, arches and cockpit trim still draws in a handful of calls.
// Only the parts that move — wheels, steering wheel, head lamps — stay as
// individual objects.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batcher } from './build.js';
import { clamp, damp } from '../core/rng.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/**
 * Batcher.flush() splits each material into ~22 m cells, which is right for a
 * house and wrong for a car: a body straddles its own origin, so every
 * material comes out as four meshes instead of one.  Merge each material in a
 * single go instead — a whole vehicle then draws in about a dozen calls.
 */
function flushBody(B, parent, name) {
  for (const [mat, list] of B.buckets) {
    if (!list.length) continue;
    let merged = null;
    try { merged = mergeGeometries(list, false); } catch (e) { merged = null; }
    if (!merged) {                       // fall back to individual meshes
      for (const geo of list) parent.add(new THREE.Mesh(geo, mat));
      continue;
    }
    merged.computeBoundingSphere();
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = `${name}:${mat.name || 'mat'}`;
    parent.add(m);
    for (const geo of list) geo.dispose();
  }
  B.buckets.clear();
  return parent;
}

/**
 * The shared `carGlass` is nearly black at 0.55 opacity: acceptable as a slab
 * seen from the outside, but it turns the cockpit into a cave the moment you
 * sit in it.  Vehicles get their own panes, and never write depth so the
 * interior behind them sorts correctly.
 */
let _pane = null, _paneTint = null;
function pane(tinted = false) {
  if (tinted) {
    return (_paneTint ||= new THREE.MeshPhysicalMaterial({
      color: 0x2a3540, metalness: 0.15, roughness: 0.06, transparent: true,
      opacity: 0.42, envMapIntensity: 1.8, depthWrite: false,
    }));
  }
  return (_pane ||= new THREE.MeshPhysicalMaterial({
    color: 0x7f96a6, metalness: 0.1, roughness: 0.05, transparent: true,
    opacity: 0.24, envMapIntensity: 1.6, depthWrite: false,
  }));
}

/**
 * Per-vehicle lamp materials.  These have their emissiveIntensity driven every
 * frame, so they must NOT be the shared cached `M.emissive`/`M.emissiveDim`
 * instances — those are handed to every fixture in the house, and mutating one
 * would light the whole estate whenever somebody touched the brakes.
 */
function lampMaterials() {
  const m = (color, emissive, intensity, rough = 0.34) => new THREE.MeshStandardMaterial({
    color, emissive: new THREE.Color(emissive), emissiveIntensity: intensity,
    roughness: rough, metalness: 0,
  });
  return {
    brake: m(0x2c0a08, 0xff2a1c, 0.55),
    reverse: m(0x1a1c1f, 0xeaf4ff, 0.10),
    head: m(0x1b1d20, 0xfff2d8, 0.25, 0.28),
    bar: m(0x1b1d20, 0xdff0ff, 0.12, 0.3),
    dash: m(0x0e1014, 0x64c8ff, 0.55, 0.42),
  };
}

/**
 * Two forward-facing spot lights parented to the body.  Built once, at zero
 * intensity, and left in the scene forever: three bakes the visible light
 * count into every shader program, so toggling `visible` would recompile the
 * world every time somebody flicked the switch.  Brightness is the only thing
 * that ever changes.
 */
function addHeadlamps(g, x, y, z, drop, distance, angle) {
  const out = [];
  for (const s of [-1, 1]) {
    const l = new THREE.SpotLight(0xfff0d2, 0, distance, angle, 0.55, 1.2);
    l.position.set(s * x, y, z);
    l.castShadow = false;
    const t = new THREE.Object3D();
    t.position.set(s * x * 2.1, y - drop, z + 16);
    g.add(t, l);
    l.target = t;
    out.push(l);
  }
  return out;
}

/**
 * Body-coloured arch over a wheel.  Without one the top of the tyre simply
 * disappears into a flat flank; the arch flares proud of the bodyside so the
 * tyre tucks *into* something.  Segments are laid around the wheel axis.
 */
function fenderArch(B, mat, cx, cy, cz, r, w, thick = 0.11, spread = 2.3, segs = 6) {
  const seg = ((r * spread) / (segs - 1)) * 1.4;
  for (let i = 0; i < segs; i++) {
    const a = -spread / 2 + (i / (segs - 1)) * spread;
    B.box(w, thick, seg, mat, cx, cy + Math.cos(a) * r, cz + Math.sin(a) * r, { rotX: a });
  }
}

// ── Ford F-350 style crew-cab, lifted, with a light bar ────────────────────
export function buildTruck(world, x, z, rotY = 0) {
  const M = world.mats;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const B = new Batcher('truck');
  const P = (w, h, d, mat, px, py, pz, o) => B.box(w, h, d, mat, px, py, pz, o || {});

  const body = M.get('carPaintBlue');
  const trim = M.get('blackMetal');
  const chrome = M.get('chrome');
  const dark = M.get('darkPlastic');
  const rubber = M.get('rubber');
  const leather = M.get('leather');
  const glass = pane();
  const sideGlass = pane(true);
  const lamps = lampMaterials();

  // ── chassis, running gear ────────────────────────────────────────────────
  P(2.15, 0.5, 5.9, body, 0, 1.02, 0);                       // main body slab
  for (const s of [-1, 1]) {
    P(0.08, 0.20, 3.0, trim, s * 1.10, 0.86, 0.25);          // rocker panel
    P(0.30, 0.07, 2.15, trim, s * 1.20, 0.72, 0.45);         // running board
    P(0.09, 0.09, 2.30, chrome, s * 1.33, 0.70, 0.45);       // nerf bar
    for (const bz of [-0.4, 1.3]) P(0.07, 0.22, 0.11, trim, s * 1.14, 0.82, bz);
    P(0.14, 0.14, 0.5, chrome, s * 0.7, 0.95, -3.1);         // exhaust tip
    // mud flaps, behind each axle
    P(0.36, 0.44, 0.03, rubber, s * 1.06, 0.40, 1.20);
    P(0.36, 0.44, 0.03, rubber, s * 1.06, 0.40, -2.50);
  }

  // ── bed: an open box, not a solid block ─────────────────────────────────
  P(2.0, 0.10, 2.30, rubber, 0, 1.32, -1.62);                // bed floor
  P(1.84, 0.42, 0.14, body, 0, 1.53, -0.54);                 // bulkhead
  for (const s of [-1, 1]) {
    P(0.16, 0.42, 2.30, body, s * 0.92, 1.53, -1.62);        // bed side
    P(0.20, 0.06, 2.34, chrome, s * 0.92, 1.77, -1.62);      // bed rail cap
  }
  P(1.70, 0.24, 0.36, chrome, 0, 1.58, -0.98);               // cross-bed toolbox
  P(1.78, 0.60, 0.12, body, 0, 1.42, -2.80);                 // tailgate
  P(1.82, 0.06, 0.16, chrome, 0, 1.74, -2.80);               // tailgate cap
  P(2.15, 0.2, 0.3, chrome, 0, 0.86, -3.02);                 // rear bumper
  for (const s of [-1, 1]) {
    P(0.20, 0.56, 0.14, body, s * 0.94, 1.42, -2.80);        // lamp pod
    P(0.16, 0.40, 0.08, lamps.brake, s * 0.94, 1.48, -2.88);
    P(0.16, 0.11, 0.08, lamps.reverse, s * 0.94, 1.22, -2.88);
  }
  P(0.26, 0.07, 0.06, lamps.brake, 0, 2.58, -0.83);          // high-mount stop lamp

  // ── cab: separate inset panes, real pillars, a roof that caps it ────────
  // The old cab was one transparent box under a roof slab wider than the glass
  // — a fishbowl with a hovering plank on top.
  for (const s of [-1, 1]) {
    P(0.09, 0.80, 2.52, body, s * 1.005, 1.66, 0.52);        // door skins
    P(0.12, 0.05, 2.50, chrome, s * 1.00, 2.07, 0.53);       // window sill
    P(0.10, 0.74, 0.10, body, s * 0.99, 2.34, 1.60, { rotX: -0.571 });  // A-pillar
    P(0.09, 0.60, 0.11, body, s * 1.00, 2.34, 0.52);         // B-pillar
    P(0.10, 0.60, 0.10, body, s * 1.00, 2.34, -0.75);        // C-pillar
    P(0.05, 0.56, 1.225, sideGlass, s * 1.005, 2.34, 1.1875);  // front door glass
    P(0.05, 0.56, 1.28, sideGlass, s * 1.005, 2.34, -0.08);  // rear door glass
  }
  P(2.02, 0.80, 0.09, body, 0, 1.66, -0.755);                // cab rear wall
  P(2.02, 0.80, 0.09, body, 0, 1.66, 1.775);                 // cowl / firewall
  P(1.94, 0.60, 0.05, sideGlass, 0, 2.34, -0.755);           // rear screen
  P(1.90, 0.66, 0.05, glass, 0, 2.34, 1.60, { rotX: -0.571 });  // raked windscreen
  P(2.12, 0.10, 2.25, body, 0, 2.67, 0.315);                 // roof, capping the glass

  // shut-lines and handles — a flank with no seams reads as a slab
  for (const s of [-1, 1]) {
    for (const sz of [1.74, 0.52, -0.70]) P(0.03, 0.76, 0.03, trim, s * 1.048, 1.66, sz);
    P(0.03, 0.03, 2.44, trim, s * 1.048, 1.29, 0.52);
    for (const hz of [1.34, 0.14]) P(0.05, 0.07, 0.28, chrome, s * 1.08, 1.88, hz);
  }

  // ── hood, grille, lighting ──────────────────────────────────────────────
  P(2.1, 0.55, 1.9, body, 0, 1.5, 2.35);
  P(0.70, 0.10, 0.70, body, 0, 1.82, 2.45);                  // hood scoop
  P(0.60, 0.09, 0.10, trim, 0, 1.84, 2.11);                  // scoop mouth
  P(2.05, 0.62, 0.18, trim, 0, 1.45, 3.28);                  // grille
  for (let i = 0; i < 5; i++) P(1.9, 0.06, 0.06, chrome, 0, 1.25 + i * 0.11, 3.36);
  P(2.2, 0.24, 0.35, chrome, 0, 0.95, 3.36);                 // bumper
  for (const s of [-1, 1]) {
    P(0.45, 0.22, 0.10, lamps.head, s * 0.75, 1.52, 3.38);   // headlights
    P(0.16, 0.10, 0.08, lamps.head, s * 0.62, 0.95, 3.55);   // fog lamps
    // tow mirrors on a stalk
    P(0.16, 0.06, 0.10, trim, s * 1.12, 2.15, 1.66);
    P(0.09, 0.34, 0.22, trim, s * 1.22, 2.18, 1.66);
    P(0.02, 0.28, 0.18, M.get('mirror'), s * 1.27, 2.18, 1.66);
  }
  // roof light bar
  P(1.5, 0.14, 0.16, trim, 0, 2.84, 1.15);
  for (const s of [-1, 1]) P(0.08, 0.12, 0.10, trim, s * 0.6, 2.77, 1.15);
  for (let i = 0; i < 6; i++) P(0.18, 0.10, 0.10, lamps.bar, -0.6 + i * 0.24, 2.84, 1.08);

  // fender flares — the tyres used to end at a flat slab
  for (const [wx, wz] of [[-1.02, 1.95], [1.02, 1.95], [-1.02, -1.75], [1.02, -1.75]]) {
    fenderArch(B, body, wx, 0.62, wz, 0.76, 0.44, 0.12);
  }

  // ── cockpit ─────────────────────────────────────────────────────────────
  P(1.86, 0.04, 2.40, rubber, 0, 1.30, 0.52);                // floor mat
  P(1.92, 0.36, 0.40, dark, 0, 1.90, 1.55);                  // dash
  P(1.90, 0.26, 0.10, dark, 0, 1.60, 1.70);                  // lower dash
  // Left-hand drive.  The camera enters at heading + π, which puts the body's
  // local +X on the driver's left — so the seat belongs at +X and the console
  // falls to their right.
  P(0.66, 0.06, 0.32, dark, 0.46, 2.14, 1.44, { rotX: -0.15 });    // binnacle hood
  P(0.60, 0.13, 0.28, lamps.dash, 0.46, 2.04, 1.48, { rotX: -0.2 });  // cluster
  P(0.34, 0.24, 0.04, lamps.dash, -0.12, 1.98, 1.34);        // centre screen
  P(0.32, 0.34, 0.90, dark, -0.02, 1.45, 1.00);              // centre console
  P(0.05, 0.26, 0.05, dark, 0.06, 1.74, 1.22);               // gear lever
  P(0.09, 0.08, 0.09, leather, 0.06, 1.88, 1.22);            // shift knob
  for (const px of [0.30, 0.52]) P(0.10, 0.03, 0.16, dark, px, 1.34, 1.62, { rotX: -0.3 });  // pedals
  for (const s of [-1, 1]) {
    P(0.05, 0.72, 2.30, leather, s * 0.955, 1.64, 0.52);     // door card
    P(0.09, 0.07, 0.60, dark, s * 0.925, 1.90, 0.90);        // armrest
    P(0.58, 0.12, 0.54, leather, s * 0.45, 1.60, 0.78);      // seat base
    P(0.58, 0.80, 0.10, leather, s * 0.45, 1.98, 0.40);      // seat back
    P(0.26, 0.20, 0.09, leather, s * 0.45, 2.42, 0.42);      // head rest
  }
  P(0.04, 0.10, 0.04, trim, 0, 2.56, 1.28);                  // mirror stalk
  P(0.32, 0.09, 0.03, M.get('mirror'), 0, 2.50, 1.26);       // rear-view mirror

  flushBody(B, g, 'truck');

  const wheels = addWheels(g, M, 0.62, 0.34, [[-1.02, 1.95], [1.02, 1.95], [-1.02, -1.75], [1.02, -1.75]]);

  // steering wheel stays a live object so it can turn
  const wheelG = new THREE.Group();
  wheelG.position.set(0.46, 1.98, 1.30);
  wheelG.rotation.x = -0.52;
  wheelG.add(new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.03, 8, 22), leather));
  wheelG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), dark));
  g.add(wheelG);

  const beams = addHeadlamps(g, 0.74, 1.50, 3.30, 1.05, 52, 0.56);

  world.addProp(g);
  return makeVehicle(world, {
    name: 'Ford F-350 Super Duty', group: g, wheels, steerWheel: wheelG,
    lamps, beams, beamPower: 34,
    seat: V(0.46, 2.14, 0.80), radius: 1.9,
    halfW: 1.12, halfH: 1.4, halfD: 3.2, wheelbase: 3.7, track: 2.04,
    maxSpeed: 26, accel: 12, brake: 14, grip: 1.35, mass: 3,
    steerRate: 5.0, rollGain: 0.20, pitchGain: 0.075, drag: 0.16,
    slipLimit: 13, slipGain: 0.14, reverseMax: 0.34, reverseAccel: 0.5,
    travel: 0.075,
    engine: { base: 62, rev: 1.9, growl: 0.55 },
  }, x, z, rotY);
}

// ── Lamborghini style mid-engine supercar ──────────────────────────────────
export function buildLambo(world, x, z, rotY = 0) {
  const M = world.mats;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const B = new Batcher('lambo');
  const P = (w, h, d, mat, px, py, pz, o) => B.box(w, h, d, mat, px, py, pz, o || {});

  const body = M.get('carPaintYellow');
  const trim = M.get('blackMetal');
  const chrome = M.get('chrome');
  const steel = M.get('steel');
  const dark = M.get('darkPlastic');
  const rubber = M.get('rubber');
  const leather = M.get('leather');
  const glass = pane();
  const sideGlass = pane(true);
  const lamps = lampMaterials();

  // ── tub, nose, tail ─────────────────────────────────────────────────────
  P(1.95, 0.34, 4.4, body, 0, 0.52, 0);                       // main tub
  P(1.86, 0.14, 1.16, body, 0, 0.71, 1.63, { rotX: 0.138 });  // bonnet, falling to the nose
  P(1.80, 0.10, 0.20, body, 0, 0.74, 1.02);                   // scuttle
  P(1.5, 0.22, 0.24, trim, 0, 0.44, 2.24);                    // splitter
  for (const s of [-1, 1]) P(0.36, 0.14, 0.10, trim, s * 0.62, 0.52, 2.22);  // nose ducts
  P(1.9, 0.26, 0.90, body, 0, 0.78, -1.80);                   // engine deck
  P(1.86, 0.28, 0.10, body, 0, 0.72, -2.24);                  // tail panel
  P(1.5, 0.24, 0.26, trim, 0, 0.44, -2.30);                   // diffuser
  for (let i = 0; i < 5; i++) P(0.05, 0.22, 0.28, steel, -0.5 + i * 0.25, 0.45, -2.31);  // diffuser fins
  P(1.6, 0.08, 0.42, trim, 0, 1.10, -2.20, { rotX: 0.18 });   // wing
  for (const s of [-1, 1]) {
    P(0.08, 0.26, 0.10, trim, s * 0.68, 0.97, -2.16);         // wing upright
    P(0.14, 0.14, 0.16, chrome, s * 0.30, 0.62, -2.36);       // exhaust
    P(0.48, 0.10, 0.06, lamps.brake, s * 0.58, 0.78, -2.31);
    P(0.14, 0.08, 0.06, lamps.reverse, s * 0.26, 0.62, -2.31);
    P(0.44, 0.10, 0.12, lamps.head, s * 0.60, 0.70, 2.14, { rotY: s * 0.12 });
  }

  // ── cabin: thin raked screen, pillars, roof ─────────────────────────────
  P(1.62, 1.039, 0.05, glass, 0, 0.95, 0.575, { rotX: -1.155 });  // windscreen
  P(1.62, 0.10, 1.15, body, 0, 1.21, -0.475);                 // roof
  P(1.5, 0.841, 0.05, sideGlass, 0, 1.03, -1.45, { rotX: 1.257 });  // engine cover glass
  for (let i = 0; i < 4; i++) {                               // louvres, proud of the glass
    const t = -0.30 + i * 0.20;
    P(1.44, 0.04, 0.05, trim, 0, 1.03 + t * 0.309 + 0.033, -1.45 + t * 0.951 - 0.011, { rotX: 1.257 });
  }
  for (const s of [-1, 1]) {
    P(0.10, 1.05, 0.09, body, s * 0.80, 0.95, 0.575, { rotX: -1.155 });  // A-pillar
    P(0.09, 0.36, 0.10, body, s * 0.79, 1.00, -1.00);         // B-pillar
    P(0.05, 0.34, 1.47, sideGlass, s * 0.78, 1.00, -0.265);   // side glass, tucked under the A-pillar
    P(0.24, 0.28, 1.90, body, s * 0.94, 0.78, -0.45);         // rear haunch
    // door mirror, grown off the door top rather than floating beside it
    P(0.14, 0.06, 0.08, trim, s * 0.99, 0.72, 0.62);
    P(0.06, 0.16, 0.14, trim, s * 1.06, 0.80, 0.62);
    P(0.03, 0.12, 0.11, M.get('mirror'), s * 1.10, 0.80, 0.62);
  }

  // ── flanks: shut-lines, sill, the signature side scoop ──────────────────
  for (const s of [-1, 1]) {
    P(0.09, 0.14, 2.40, trim, s * 0.99, 0.40, 0.0);           // sill / rocker
    for (const sz of [0.92, -0.30]) P(0.03, 0.30, 0.03, trim, s * 0.988, 0.55, sz);
    P(0.03, 0.03, 1.24, trim, s * 0.988, 0.39, 0.31);
    P(0.03, 0.05, 0.20, trim, s * 0.988, 0.62, 0.06);         // flush handle
    // scoop: a dark slot in the haunch behind a body-coloured leading fin
    P(0.10, 0.24, 0.92, trim, s * 0.92, 0.72, -0.55);
    P(0.14, 0.26, 0.36, body, s * 0.95, 0.74, 0.10, { rotY: s * 0.30 });
    for (let i = 0; i < 2; i++) P(0.05, 0.20, 0.05, steel, s * 0.965, 0.72, -0.36 - i * 0.34);
  }

  // fender arches over both axles
  fenderArch(B, body, -0.92, 0.36, 1.40, 0.46, 0.30, 0.09, 2.2, 5);
  fenderArch(B, body, 0.92, 0.36, 1.40, 0.46, 0.30, 0.09, 2.2, 5);
  fenderArch(B, body, -0.95, 0.36, -1.35, 0.47, 0.32, 0.09, 2.2, 5);
  fenderArch(B, body, 0.95, 0.36, -1.35, 0.47, 0.32, 0.09, 2.2, 5);

  // ── cockpit ─────────────────────────────────────────────────────────────
  P(1.50, 0.04, 1.40, rubber, 0, 0.70, 0.10);                 // floor
  // the dash top has to sit below the driver's eye or there is nothing to see
  P(1.50, 0.18, 0.32, dark, 0, 0.78, 0.92);                   // dash
  P(0.50, 0.05, 0.26, dark, 0.35, 0.935, 0.86, { rotX: -0.2 });    // binnacle hood
  P(0.44, 0.12, 0.22, lamps.dash, 0.35, 0.855, 0.88, { rotX: -0.25 });
  P(0.26, 0.16, 0.04, lamps.dash, -0.12, 0.82, 0.76);         // centre screen
  P(0.26, 0.20, 0.90, dark, -0.02, 0.78, 0.35);               // centre console
  P(0.16, 0.03, 0.16, chrome, -0.02, 0.885, 0.30);            // open shift gate
  P(0.03, 0.16, 0.03, steel, -0.02, 0.95, 0.30);
  for (const px of [0.25, 0.45]) P(0.09, 0.03, 0.14, dark, px, 0.74, 0.72, { rotX: -0.3 });  // pedals
  P(1.50, 0.26, 0.08, dark, 0, 0.86, -0.62);                  // bulkhead behind the seats
  for (const s of [-1, 1]) {
    P(0.05, 0.30, 1.20, leather, s * 0.74, 0.82, 0.10);       // door card
    P(0.46, 0.10, 0.50, leather, s * 0.38, 0.67, 0.06);       // seat base
    P(0.46, 0.44, 0.09, leather, s * 0.38, 0.94, -0.28);      // seat back
    P(0.22, 0.12, 0.08, leather, s * 0.38, 1.10, -0.30);      // head rest
  }
  P(0.26, 0.07, 0.03, M.get('mirror'), 0, 1.10, 0.42);        // rear-view mirror

  flushBody(B, g, 'lambo');

  // gunmetal rims — near-black discs vanished against the tyres
  const wheels = addWheels(g, M, 0.36, 0.22,
    [[-0.92, 1.4], [0.92, 1.4], [-0.95, -1.35], [0.95, -1.35]], 0x8a9098);

  const wheelG = new THREE.Group();
  wheelG.position.set(0.35, 0.86, 0.62);
  wheelG.rotation.x = -0.62;
  wheelG.add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.024, 8, 20), leather));
  wheelG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8), dark));
  g.add(wheelG);

  const beams = addHeadlamps(g, 0.60, 0.68, 2.05, 0.48, 46, 0.5);

  world.addProp(g);
  return makeVehicle(world, {
    name: 'Lamborghini', group: g, wheels, steerWheel: wheelG,
    lamps, beams, beamPower: 30,
    seat: V(0.35, 0.95, 0.05), radius: 1.5,
    halfW: 1.02, halfH: 0.72, halfD: 2.35, wheelbase: 2.75, track: 1.87,
    maxSpeed: 62, accel: 26, brake: 32, grip: 2.5, mass: 1.4,
    steerRate: 11.0, rollGain: 0.075, pitchGain: 0.05, drag: 0.19,
    slipLimit: 27, slipGain: 0.26, reverseMax: 0.22, reverseAccel: 0.42,
    travel: 0.04,
    engine: { base: 110, rev: 3.2, growl: 0.3 },
  }, x, z, rotY);
}

function addWheels(g, M, r, width, spots, rimColor = 0xc8ccd2) {
  const rubber = M.get('rubber');
  const rim = M.solid(rimColor, 0.25, 1);
  // Geometry is built once and shared by all four corners; the face and its
  // five spokes merge into a single rim, because twenty spoke draw calls a car
  // is a lot for something you only ever see as a blur.
  const tyreGeo = new THREE.CylinderGeometry(r, r, width, 20).rotateZ(Math.PI / 2);
  const parts = [new THREE.CylinderGeometry(r * 0.62, r * 0.62, width + 0.02, 16).rotateZ(Math.PI / 2)];
  for (let i = 0; i < 5; i++) parts.push(new THREE.BoxGeometry(width + 0.03, r * 1.1, 0.05).rotateX((i / 5) * Math.PI));
  let rimGeo = null;
  try { rimGeo = mergeGeometries(parts, false); } catch (e) { rimGeo = null; }
  if (rimGeo) for (const p of parts) p.dispose();

  const out = [];
  for (const [ox, oz] of spots) {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(tyreGeo, rubber);
    tyre.castShadow = true;
    w.add(tyre);
    if (rimGeo) w.add(new THREE.Mesh(rimGeo, rim));
    else for (const p of parts) w.add(new THREE.Mesh(p, rim));
    w.position.set(ox, r, oz);
    g.add(w);
    out.push({ obj: w, steer: oz > 0, radius: r, ox, oz, baseY: r, travel: 0, groundY: null, spin: 0 });
  }
  return out;
}

// ── drivable vehicle controller ────────────────────────────────────────────
function makeVehicle(world, cfg, x, z, rotY) {
  const v = Object.assign({
    pos: V(x, 0, z), heading: rotY, speed: 0, steer: 0, slip: 0, roll: 0,
    grounded: true, vy: 0, occupied: false, pitch: 0,
    steerRate: 9, rollGain: 0.12, pitchGain: 0.05,
    slipLimit: 26, slipGain: 0.2, reverseMax: 0.35, reverseAccel: 0.5,
    travel: 0.06, track: 2, beamPower: 30, drag: 0.2,
  }, cfg);
  v.home = V(x, 0, z);
  v.homeHeading = rotY;
  v.seatLocal = v.seat.clone();          // fixed anchor; `seat` is republished
  v.seat = v.seat.clone();               // each frame so the camera rides the body
  for (const w of v.wheels) w.spin = 0;

  // Lights: `lightsOn` follows the sun until somebody overrides it.  Key
  // handling lives in game.js, so the switch is exposed as a method here.
  v.lightsOn = true;
  v.lightsAuto = true;
  v.setLights = (on) => { v.lightsOn = !!on; v.lightsAuto = false; };
  v.toggleLights = () => v.setLights(!v.lightsOn);
  // A sun-driven material used purely as a clock — SkySystem scales every
  // `dimmable` by 0.12 + 0.88 * (1 - day), so reading one back tells us how
  // dark it is without reaching across into the sky system.
  v.dayRef = world.mats.emissiveDim(0xfff2d8, 1.4);

  // solid to the player — an OBB blocker that tracks the body.  `vehicle` is
  // the back-reference the other car reads when it runs into this one.
  v.blocker = world.addBlocker({
    pos: V(x, v.halfH, z), rotY,
    halfW: v.halfW, halfH: v.halfH, halfD: v.halfD, active: true,
    vehicle: v,
  });

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
const _fwd = new THREE.Vector3();       // where the body points
const _dir = new THREE.Vector3();       // where it is actually travelling
const _side = new THREE.Vector3();
const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();

const _axX = [0, 0, 0, 0], _axZ = [0, 0, 0, 0];   // the four candidate SAT axes
const _bhit = { blocker: null, normal: new THREE.Vector3(), depth: 0 };

/**
 * Door leaves and parked cars are props, not octree geometry — they exist only
 * as OBBs in `world.blockers` — so a sub-step that tested the octree alone drove
 * straight through the closed garage door and through the other car.
 *
 * Separating-axis test in the XZ plane against the vehicle's own footprint
 * rather than its body sphere: the sphere is deliberately fat across the car but
 * much shorter than it (truck radius 1.9 vs halfD 3.2), so a sphere test would
 * bury the bonnet a metre inside the door before it stopped.  Returns the
 * shallowest overlap found, or null.
 */
function blockerHit(v, world) {
  const axX = Math.cos(v.heading), axZ = -Math.sin(v.heading);   // body local +X
  const azX = Math.sin(v.heading), azZ = Math.cos(v.heading);    // body local +Z
  const top = v.pos.y + v.halfH * 2;
  let best = null, bestDepth = Infinity, bestX = 0, bestZ = 0;
  for (const b of world.blockers) {
    if (b.active === false || b === v.blocker) continue;         // never our own body
    if (b.pos.y - b.halfH > top || b.pos.y + b.halfH < v.pos.y) continue;
    const bxX = Math.cos(b.rotY), bxZ = -Math.sin(b.rotY);
    const bzX = Math.sin(b.rotY), bzZ = Math.cos(b.rotY);
    _axX[0] = axX; _axZ[0] = axZ; _axX[1] = azX; _axZ[1] = azZ;
    _axX[2] = bxX; _axZ[2] = bxZ; _axX[3] = bzX; _axZ[3] = bzZ;
    const dx = b.pos.x - v.pos.x, dz = b.pos.z - v.pos.z;
    let depth = Infinity, nx = 0, nz = 0;
    for (let i = 0; i < 4; i++) {
      const px = _axX[i], pz = _axZ[i];
      const ra = Math.abs(axX * px + axZ * pz) * v.halfW + Math.abs(azX * px + azZ * pz) * v.halfD;
      const rb = Math.abs(bxX * px + bxZ * pz) * b.halfW + Math.abs(bzX * px + bzZ * pz) * b.halfD;
      const along = dx * px + dz * pz;
      const overlap = ra + rb - Math.abs(along);
      if (overlap <= 0) { depth = 0; break; }                    // daylight on this axis
      if (overlap < depth) {
        depth = overlap;
        nx = along > 0 ? -px : px; nz = along > 0 ? -pz : pz;    // push us off it
      }
    }
    if (depth > 0 && depth < bestDepth) { bestDepth = depth; best = b; bestX = nx; bestZ = nz; }
  }
  if (!best) return null;
  _bhit.blocker = best;
  _bhit.normal.set(bestX, 0, bestZ);
  _bhit.depth = bestDepth;
  return _bhit;
}

/** 0 at noon, 1 in the dead of night. */
function darkness(v) {
  const m = v.dayRef;
  const base = m && m.userData ? m.userData.baseEmissive : 0;
  if (!base) return 0;
  return clamp((m.emissiveIntensity / base - 0.12) / 0.88, 0, 1);
}

export function updateVehicle(v, world, dt, ctrl) {
  const throttle = ctrl ? ctrl.throttle : 0;
  const steerIn = ctrl ? ctrl.steer : 0;
  const handbrake = ctrl ? !!ctrl.brake : (Math.abs(v.speed) > 0.1);

  // ── longitudinal: forward, braking and a distinctly lazier reverse ──────
  if (throttle > 0) {
    if (v.speed < -0.2) v.speed += v.brake * 0.9 * dt;                       // stop the roll-back first
    else v.speed += v.accel * throttle * dt * (1 - clamp(v.speed / v.maxSpeed, 0, 0.92));
  } else if (throttle < 0) {
    if (v.speed > 0.2) v.speed -= v.brake * 0.75 * dt * -throttle;           // pulling back = brakes
    else {
      const revMax = v.maxSpeed * v.reverseMax;
      v.speed += v.accel * v.reverseAccel * throttle * dt * (1 - clamp(-v.speed / revMax, 0, 0.9));
    }
  }
  const braking = handbrake || (throttle < 0 && v.speed > 0.4);
  if (handbrake) v.speed = damp(v.speed, 0, v.brake * 0.35, dt);
  v.speed = damp(v.speed, 0, v.drag, dt);                 // rolling resistance + drag
  v.speed = clamp(v.speed, -v.maxSpeed * v.reverseMax, v.maxSpeed);

  // ── steering: less authority at speed, none when stopped ────────────────
  const authority = clamp(Math.abs(v.speed) / 6, 0, 1) * (1 - clamp(Math.abs(v.speed) / (v.maxSpeed * 1.6), 0, 0.6));
  v.steer = damp(v.steer, steerIn, v.steerRate, dt);
  const yawRate = v.steer * authority * v.grip * Math.sign(v.speed || 1);
  v.heading -= yawRate * dt;

  // slip: past the tyres' lateral limit the tail steps out and the car keeps
  // travelling where it was pointed a moment ago, then hooks back up.
  const lateral = Math.abs(yawRate * v.speed);
  const excess = v.speed > 3 ? clamp((lateral - v.slipLimit) / v.slipLimit, 0, 1.3) : 0;
  const slipTarget = Math.sign(yawRate || 1) * excess * v.slipGain;
  v.slip = damp(v.slip, slipTarget, excess > 0.02 ? 5.5 : 3.4, dt);

  _fwd.set(Math.sin(v.heading), 0, Math.cos(v.heading));
  const md = v.heading + v.slip;
  _dir.set(Math.sin(md), 0, Math.cos(md));
  _side.set(Math.cos(v.heading), 0, -Math.sin(v.heading));   // body local +X

  // move in sub-steps so a flat-out Lambo can't skip through a wall between
  // frames, testing the body sphere against the world and the footprint against
  // door leaves and the other car as it goes
  let remaining = v.speed * dt;
  const stepLen = Math.max(0.5, v.radius * 0.7) * Math.sign(remaining || 1);
  while (remaining !== 0) {
    const step = Math.abs(remaining) > Math.abs(stepLen) ? stepLen : remaining;
    v.pos.addScaledVector(_dir, step);
    remaining -= step;
    _sphere.center.set(v.pos.x, v.pos.y + v.radius * 0.8, v.pos.z);
    _sphere.radius = v.radius;
    const c = world.octree.sphereIntersect(_sphere);
    if (c && Math.abs(c.normal.y) < 0.6) {
      v.pos.addScaledVector(c.normal, c.depth);
      const into = _dir.dot(c.normal) * Math.sign(v.speed || 1);
      v.speed *= into < -0.2 ? 0.2 : Math.pow(0.9, dt * 60);
      v.slip = damp(v.slip, 0, 20, dt);
      break;
    }
    const bh = blockerHit(v, world);
    if (bh) {
      v.pos.addScaledVector(bh.normal, bh.depth);
      const into = _dir.dot(bh.normal) * Math.sign(v.speed || 1);
      // a parked car is not a wall: shove it along its own axis, split by mass,
      // or ramming the Lambo with the truck reads as hitting a bollard
      const other = bh.blocker.vehicle;
      if (other && into < -0.2) {
        const along = -(bh.normal.x * Math.sin(other.heading) + bh.normal.z * Math.cos(other.heading));
        other.speed += Math.abs(v.speed) * (-into) * along * (v.mass / (v.mass + other.mass));
      }
      v.speed *= into < -0.2 ? 0.2 : Math.pow(0.9, dt * 60);
      v.slip = damp(v.slip, 0, 20, dt);
      break;
    }
  }

  // ── ground follow: one ray under each wheel ─────────────────────────────
  const sample = (lx, lz) => {
    _ray.origin.set(
      v.pos.x + _side.x * lx + _fwd.x * lz, v.pos.y + 4,
      v.pos.z + _side.z * lx + _fwd.z * lz);
    _ray.direction.copy(_down);
    const hit = world.octree.rayIntersect(_ray);
    return hit ? hit.position.y : null;
  };
  let fl = null, fr = null, rl = null, rr = null;
  for (const w of v.wheels) {
    w.groundY = sample(w.ox, w.oz);
    if (w.oz > 0) { if (w.ox < 0) fl = w.groundY; else fr = w.groundY; }
    else if (w.ox < 0) rl = w.groundY; else rr = w.groundY;
  }
  const avg = (a, b) => (a !== null && b !== null ? (a + b) / 2 : a !== null ? a : b);
  const frontY = avg(fl, fr), rearY = avg(rl, rr);
  const leftY = avg(fl, rl), rightY = avg(fr, rr);
  const groundY = avg(frontY, rearY);

  if (groundY !== null) {
    if (v.pos.y < groundY + 0.05) { v.pos.y = damp(v.pos.y, groundY, 16, dt); v.vy = 0; v.grounded = true; }
    else { v.vy -= 22 * dt; v.pos.y += v.vy * dt; v.grounded = false; if (v.pos.y < groundY) { v.pos.y = groundY; v.vy = 0; v.grounded = true; } }
  } else {
    v.vy -= 22 * dt; v.pos.y += v.vy * dt;
    if (v.pos.y < -20) { resetVehicle(v); }
  }
  const slopePitch = (v.grounded && frontY !== null && rearY !== null)
    ? Math.atan2(rearY - frontY, v.wheelbase) : 0;
  const slopeRoll = (v.grounded && leftY !== null && rightY !== null)
    ? clamp(Math.atan2(rightY - leftY, v.track), -0.22, 0.22) : 0;

  // weight transfer: nose lifts under throttle, dips under braking
  const speedFrac = clamp(v.speed / v.maxSpeed, -1, 1);
  const accelPitch = clamp(
    (throttle > 0 ? -throttle : 0) * v.pitchGain
    + (braking ? speedFrac * v.pitchGain * 1.5 : 0), -v.pitchGain * 1.6, v.pitchGain * 1.6);
  v.pitch = clamp(damp(v.pitch, slopePitch + accelPitch, 7, dt), -0.42, 0.42);

  // roll: the terrain underneath plus load transfer through the corner
  const cornerRoll = -v.steer * clamp(Math.abs(v.speed) / v.maxSpeed, 0, 1) * v.rollGain
    - v.slip * v.rollGain * 1.6;
  v.roll = damp(v.roll, clamp(slopeRoll + cornerRoll, -0.26, 0.26), 6, dt);

  // ── visuals ─────────────────────────────────────────────────────────────
  v.group.position.copy(v.pos);
  v.group.rotation.set(v.pitch, v.heading, v.roll);

  // The camera reads `v.seat` and only applies the heading, so republish the
  // seat with the body's pitch and roll folded in (and the heading divided
  // back out) — otherwise the cockpit swings through the driver on a slope.
  _quat.setFromEuler(_euler.set(v.pitch, v.heading, v.roll));
  v.seat.copy(v.seatLocal).applyQuaternion(_quat).applyAxisAngle(UP, -v.heading);

  // per-wheel suspension travel: each wheel reaches for its own patch of
  // ground, clamped to a few centimetres so nothing detaches from the arch
  const sp = Math.sin(v.pitch), sr = Math.sin(v.roll);
  for (const w of v.wheels) {
    let t = 0;
    if (w.groundY !== null && v.grounded) {
      t = clamp(w.groundY - (v.pos.y + w.ox * sr - w.oz * sp), -v.travel, v.travel);
    }
    w.travel = damp(w.travel, t, 11, dt);
    w.obj.position.y = w.baseY + w.travel;
    w.spin += (v.speed / w.radius) * dt;
    w.obj.rotation.x = w.spin;
    w.obj.rotation.y = w.steer ? -v.steer * 0.5 : 0;
  }
  if (v.steerWheel) v.steerWheel.rotation.z = -v.steer * 2.2;

  // ── lamps ───────────────────────────────────────────────────────────────
  const L = v.lamps;
  if (L) {
    const dark = darkness(v);
    if (v.lightsAuto) v.lightsOn = dark > 0.45;
    const lit = v.lightsOn && v.occupied;
    L.brake.emissiveIntensity = damp(L.brake.emissiveIntensity, braking ? 3.6 : (lit ? 1.0 : 0.45), 20, dt);
    L.reverse.emissiveIntensity = damp(L.reverse.emissiveIntensity, v.speed < -0.4 ? 2.8 : 0.08, 20, dt);
    L.head.emissiveIntensity = damp(L.head.emissiveIntensity, lit ? 2.6 : 0.12 + dark * 0.3, 10, dt);
    L.bar.emissiveIntensity = damp(L.bar.emissiveIntensity, lit ? 2.0 : 0.08, 10, dt);
    L.dash.emissiveIntensity = damp(L.dash.emissiveIntensity, v.occupied ? 1.4 : 0.25, 8, dt);
    if (v.beams) {
      const want = lit ? v.beamPower : 0;
      for (const b of v.beams) b.intensity = damp(b.intensity, want, 8, dt);
    }
  }

  // keep the player-collision box glued to the body (inactive while driven —
  // the driver shouldn't collide with their own car)
  v.blocker.pos.set(v.pos.x, v.pos.y + v.halfH, v.pos.z);
  v.blocker.rotY = v.heading;
  v.blocker.active = !v.occupied;
}

export function resetVehicle(v) {
  v.pos.copy(v.home);
  v.heading = v.homeHeading;
  v.speed = 0; v.vy = 0; v.pitch = 0; v.roll = 0; v.slip = 0; v.steer = 0;
  for (const w of v.wheels) w.travel = 0;
  v.seat.copy(v.seatLocal);
}
