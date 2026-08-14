// ───────────────────────────────────────────────────────────────────────────
// The fun rooms: movie theater, bowling alley, basketball court, gym,
// gaming rooms, laundry, garage and workshop.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { boxMesh, mesh } from './build.js';
import { Kit, barstool } from './furniture.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ── movie theater ──────────────────────────────────────────────────────────
export function theater(k, R) {
  const { world, M, B } = k;
  const y = R.y, x0 = R.x - R.w / 2, x1 = R.x + R.w / 2;

  // acoustic panelling
  for (let i = 0; i < 14; i++) {
    const zz = R.z - R.d / 2 + 0.4 + i * (R.d / 14);
    B.box(0.06, 3.0, 0.5, M.paint(0x3b1f2b, 0.92, 'acoustic'), x0 + 0.2, y + 1.9, zz, { tile: 0.6 });
    B.box(0.06, 3.0, 0.5, M.paint(0x3b1f2b, 0.92, 'acoustic'), x1 - 0.2, y + 1.9, zz, { tile: 0.6 });
  }

  // screen wall (west end)
  const sx = x0 + 0.5;
  B.box(0.3, 5.0, R.d - 1.0, M.paint(0x0b0a0c, 0.95, 'screenwall'), sx - 0.2, y + 2.6, R.z, { tile: 1 });
  const screenMat = M.get('screenOff').clone();
  screenMat.name = 'cinema';
  const scr = boxMesh(0.06, 3.6, R.d - 3.2, screenMat, sx, y + 2.5, R.z, { cast: false });
  world.addProp(scr);
  // slim light bezel so the screen still reads as a screen when it's off —
  // black-on-black it vanished into the screen wall
  const bezel = M.paint(0xd6dade, 0.55, 'bezel');
  for (const s of [-1, 1]) {
    B.box(0.1, 0.08, R.d - 3.2 + 0.16, bezel, sx, y + 2.5 + s * 1.84, R.z, { tile: 0.4 });
    B.box(0.1, 3.6, 0.08, bezel, sx, y + 2.5, R.z + s * ((R.d - 3.2) / 2 + 0.04), { tile: 0.4 });
  }
  const screen = { mesh: scr, mat: screenMat, on: false, kind: 'cinema' };
  world.screens.push(screen);

  // curtains either side
  for (const s of [-1, 1]) {
    B.box(0.35, 4.2, 1.2, M.paint(0x6d1024, 0.95, 'velvet'), sx + 0.1, y + 2.2, R.z + s * ((R.d - 3.0) / 2), { tile: 0.9 });
  }

  // tiered seating: 4 rows climbing away from the screen.  The room's only
  // door is on the south wall, so a flat ~1.9 m aisle runs the length of it —
  // every tier stops at `zA`, and each raised tier drops a recessed corner
  // stair down to the aisle (0.4 m risers, under the player's 0.52 step-up).
  const rows = 4, riser = 0.4;
  const zN = R.z - R.d / 2 + 0.6;                   // north edge of the tiers
  const zA = R.z + R.d / 2 - 2.0;                   // south edge — the aisle starts here
  for (let r = 0; r < rows; r++) {
    const px = x0 + 6.0 + r * 3.4;
    const step = r * riser;
    const cyTier = y + (step - riser) / 2;          // tier top lands exactly on `step`
    const slab = (w, d, sx2, sz2) => {
      B.box(w, riser + step, d, M.get('theaterCarpet'), sx2, cyTier, sz2, { tile: 1.6 });
      world.collider(w, riser + step, d, sx2, cyTier, sz2);
    };
    const nd = Math.max(0, r - 1) * 0.45;           // recessed stair notch depth
    slab(3.4, (zA - nd) - zN, px, (zN + zA - nd) / 2);
    if (nd > 0) {
      slab(2.3, nd, px - 0.55, zA - nd / 2);        // tier continues west of the notch
      for (let i = 0; i < r - 1; i++) {             // steps descend south to the aisle
        const st = riser * (r - 1 - i);
        const sz = zA - nd + (i + 0.5) * 0.45;
        B.box(1.1, st + riser, 0.45, M.get('theaterCarpet'), px + 1.15, y + (st - riser) / 2, sz, { tile: 1.6 });
        world.collider(1.1, st + riser, 0.45, px + 1.15, y + (st - riser) / 2, sz);
      }
    }
    const seats = 5, s0 = zN + 0.8, s1 = zA - 1.1;  // seats stay clear of the notches
    for (let s = 0; s < seats; s++) {
      const sz = s0 + (s + 0.5) * ((s1 - s0) / seats);
      recliner(k, px, y + step, sz, -Math.PI / 2);
    }
    // step lighting
    world.addLight({ pos: V(px - 1.6, y + step + 0.2, R.z - R.d / 2 + 0.6), color: 0xff9a5a, intensity: 3, distance: 5, lamp: true });
  }

  // projector + booth
  B.box(0.7, 0.34, 0.5, M.get('blackMetal'), x1 - 1.4, y + 3.6, R.z, { tile: 0.4 });
  B.box(0.16, 0.16, 0.16, M.emissive(0x9fd8ff, 1.2), x1 - 1.75, y + 3.6, R.z, { tile: 0.2 });
  // beam
  const beamGeo = new THREE.ConeGeometry(1.9, x1 - 1.75 - sx, 4, 1, true);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
    color: 0xbfe0ff, transparent: true, opacity: 0.045, side: THREE.DoubleSide, depthWrite: false,
  }));
  beam.rotation.z = Math.PI / 2;
  beam.position.set((sx + x1 - 1.75) / 2, y + 3.2, R.z);
  beam.visible = false;
  world.addProp(beam);

  // popcorn machine + snack bar
  B.box(1.0, 0.9, 0.6, M.paint(0xb3121a, 0.5, 'popcorn'), x1 - 1.0, y + 0.45, R.z - R.d / 2 + 1.2, { tile: 0.5 });
  B.box(0.9, 0.8, 0.55, M.get('glass'), x1 - 1.0, y + 1.35, R.z - R.d / 2 + 1.2, { tile: 0.5 });
  B.box(1.0, 0.14, 0.6, M.emissive(0xffd27a, 1.2), x1 - 1.0, y + 1.85, R.z - R.d / 2 + 1.2, { tile: 0.4 });
  world.collider(1.0, 1.9, 0.6, x1 - 1.0, y + 0.95, R.z - R.d / 2 + 1.2);

  world.spot('theaterSeat', x0 + 9.4, y, R.z, { rotY: -Math.PI / 2 });
  world.addInteract({
    pos: V(x0 + 7.6, y + 1.1, R.z), radius: 4.0,
    label: () => (screen.on ? 'Stop the movie' : 'Start movie night'),
    onUse: () => {
      screen.on = !screen.on;
      beam.visible = screen.on;
      world.lights.forEach((l) => { if (l.room === R.name) l.on = !screen.on; });
      return screen.on ? 'movie' : 'click';
    },
    kind: 'theater', data: screen,
  });
  return screen;
}

function recliner(k, x, y, z, rotY) {
  const { M } = k;
  const b = { x, y, z, r: rotY };
  const lea = M.get('leather');
  k.p(b, 0, 0.24, 0, 0.9, 0.34, 0.8, lea, 0.6);
  k.p(b, 0, 0.46, 0.04, 0.72, 0.14, 0.66, M.paint(0x2a1b18, 0.85, 'seatpad'), 0.5);
  k.p(b, -0.42, 0.72, 0, 0.14, 0.9, 0.8, lea, 0.6);
  for (const s of [-1, 1]) k.p(b, 0.02, 0.5, s * 0.44, 0.86, 0.24, 0.12, lea, 0.5);
  k.pc(b, 0, 0.45, 0, 0.95, 0.95, 0.85);
  k.world.addInteract({ pos: V(x, y + 0.6, z), radius: 1.5, label: 'Take a seat', kind: 'seat', seat: { x, y: y + 0.62, z, rotY } });
}

// ── bowling alley ──────────────────────────────────────────────────────────
export function bowling(k, R) {
  const { world, M, B } = k;
  const y = R.y;
  const pinX = R.x - R.w / 2 + 2.0;
  const foulX = pinX + 16.0;
  const laneZ = [R.z - 2.6, R.z + 2.6];

  for (const lz of laneZ) {
    // lane bed
    B.box(foulX - pinX, 0.1, 1.06, M.get('laneWood'), (pinX + foulX) / 2, y + 0.05, lz, { tile: 1.5 });
    // one collider covering pin deck → lane → approach so nothing drops through
    world.collider(foulX - pinX + 5.6, 0.14, 1.5, (pinX + foulX) / 2 + 1.2, y + 0.04, lz);
    // gutters
    for (const s of [-1, 1]) {
      B.box(foulX - pinX, 0.1, 0.24, M.get('darkPlastic'), (pinX + foulX) / 2, y - 0.01, lz + s * 0.66, { tile: 1 });
      world.collider(foulX - pinX, 0.1, 0.24, (pinX + foulX) / 2, y - 0.02, lz + s * 0.66);
      B.box(foulX - pinX, 0.5, 0.08, M.paint(0x1b2028, 0.7, 'gutterwall'), (pinX + foulX) / 2, y + 0.25, lz + s * 0.82, { tile: 1 });
      world.collider(foulX - pinX, 0.5, 0.08, (pinX + foulX) / 2, y + 0.25, lz + s * 0.82);
    }
    // approach
    B.box(3.6, 0.1, 2.4, M.get('maple'), foulX + 1.8, y + 0.05, lz, { tile: 1.4 });
    world.collider(3.6, 0.14, 2.4, foulX + 1.8, y + 0.04, lz);
    // pin deck & backstop
    B.box(1.6, 0.12, 1.4, M.paint(0xe9e4d8, 0.4, 'pindeck'), pinX - 0.4, y + 0.06, lz, { tile: 0.6 });
    B.box(0.4, 2.6, 1.9, M.paint(0x11151b, 0.9, 'backstop'), pinX - 1.4, y + 1.3, lz, { tile: 0.8 });
    world.collider(0.4, 2.6, 1.9, pinX - 1.4, y + 1.3, lz);
    // arrows on the lane
    for (let i = 0; i < 7; i++) {
      B.box(0.22, 0.005, 0.06, M.paint(0x2c2318, 0.5, 'arrow'), foulX - 4.2, y + 0.104, lz - 0.42 + i * 0.14, { tile: 0.2 });
    }
    // pins
    const tag = `pins${lz.toFixed(1)}`;
    world.pinTags = world.pinTags || [];
    world.pinTags.push(tag);
    let idx = 0;
    for (let row = 0; row < 4; row++) {
      for (let c = 0; c <= row; c++) {
        const px = pinX - row * 0.265;
        const pz = lz + (c - row / 2) * 0.305;
        world.propSpawns.push({ kind: 'pin', x: px, y: y + 0.23, z: pz, tag });
        idx++;
      }
    }
    // score monitor hanging over the lane
    B.box(0.1, 0.9, 1.5, M.get('blackMetal'), foulX - 1.2, y + 3.4, lz, { tile: 0.5 });
    const scr = boxMesh(0.03, 0.8, 1.4, M.emissive(0x2a6fbf, 0.9), foulX - 1.14, y + 3.4, lz, { cast: false });
    world.addProp(scr);
    world.spot(`bowlingApproach${lz > R.z ? 'B' : 'A'}`, foulX + 1.4, y, lz, { rotY: -Math.PI / 2, tag });
  }

  // ball return + rack
  const rx = foulX + 3.0;
  B.box(1.2, 0.85, 1.6, M.paint(0x1d2530, 0.5, 'return'), rx, y + 0.42, R.z, { tile: 0.6 });
  world.collider(1.2, 0.85, 1.6, rx, y + 0.42, R.z);
  for (let i = 0; i < 4; i++) {
    world.propSpawns.push({
      kind: 'bowlingball', x: rx, y: y + 1.05, z: R.z - 0.6 + i * 0.4,
      color: [0x11223a, 0x5a1030, 0x0f3b2e, 0x3a2a05][i],
    });
  }
  // spectator stools along the back wall, turned to face the lanes and kept
  // clear of the approach platforms (which reach foulX + 3.6, R.z ± 1.4..3.8)
  for (const dz of [-5.1, -4.2, 4.2, 5.1]) barstool(k, R.x + R.w / 2 - 0.5, R.z + dz, y, { rotY: -Math.PI / 2 });
  // neon
  B.box(0.1, 0.2, R.d - 2, M.emissive(0xff3f8a, 2.4), R.x - R.w / 2 + 0.3, y + 3.6, R.z, { tile: 0.5 });
  B.box(0.1, 0.2, R.d - 2, M.emissive(0x3fd0ff, 2.4), R.x + R.w / 2 - 0.3, y + 3.6, R.z, { tile: 0.5 });
  world.spot('bowlingAlley', foulX + 1.4, y, R.z);
}

// ── basketball court ───────────────────────────────────────────────────────
export function court(k, R) {
  const { world, M, B } = k;
  const y = R.y;
  const lineMat = M.paint(0x9c2b21, 0.4, 'courtline');
  // lines hug the slab (bottom ~0.045 above it) instead of hovering visibly
  const line = (w, d, x, z) => B.box(w, 0.006, d, lineMat, x, y + 0.048, z, { tile: 0.5 });

  // boundary + centre
  line(R.w - 2.0, 0.08, R.x, R.z - (R.d - 1.4) / 2);
  line(R.w - 2.0, 0.08, R.x, R.z + (R.d - 1.4) / 2);
  line(0.08, R.d - 1.4, R.x - (R.w - 2.0) / 2, R.z);
  line(0.08, R.d - 1.4, R.x + (R.w - 2.0) / 2, R.z);
  line(0.08, R.d - 1.4, R.x, R.z);
  ringLine(k, R.x, y + 0.048, R.z, 1.8, lineMat);

  for (const s of [-1, 1]) {
    const hx = R.x + s * (R.w / 2 - 1.6);
    // key
    line(0.08, 4.9, hx - s * 2.9, R.z);
    line(5.8, 0.08, hx - s * 2.9, R.z - 2.45);
    line(5.8, 0.08, hx - s * 2.9, R.z + 2.45);
    ringLine(k, hx - s * 5.8, y + 0.048, R.z, 1.8, lineMat);
    hoop(k, hx, y, R.z, s);
  }

  // bleachers on the north wall
  for (let r = 0; r < 3; r++) {
    B.box(R.w * 0.34, 0.42, 0.7, M.paint(0x2f3a45, 0.7, 'bleacher'), R.x, y + 0.21 + r * 0.42, R.z - R.d / 2 + 0.9 + r * 0.7, { tile: 0.6 });
    world.collider(R.w * 0.34, 0.42 + r * 0.42, 0.7, R.x, y + (0.42 + r * 0.42) / 2, R.z - R.d / 2 + 0.9 + r * 0.7);
  }
  // scoreboard
  B.box(3.2, 1.4, 0.2, M.get('blackMetal'), R.x, y + 4.4, R.z - R.d / 2 + 0.4, { tile: 0.6 });
  B.box(2.9, 1.1, 0.06, M.emissive(0xff5a2a, 1.6), R.x, y + 4.4, R.z - R.d / 2 + 0.28, { tile: 0.4 });

  world.propSpawns.push({ kind: 'basketball', x: R.x, y: y + 0.6, z: R.z + 2 });
  world.propSpawns.push({ kind: 'basketball', x: R.x + 1.2, y: y + 0.6, z: R.z + 2 });
  world.spot('court', R.x, y, R.z);
}

function ringLine(k, x, y, z, r, mat) {
  // many short segments so the circle reads round, not as chunky dashes
  const n = 60;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    k.B.box(0.2, 0.006, 0.08, mat, x + Math.cos(a) * r, y, z + Math.sin(a) * r, { rotY: Math.PI / 2 - a, tile: 0.3 });
  }
}

function hoop(k, x, y, z, s) {
  const { world, M, B } = k;
  // pole + arm
  B.box(0.26, 3.9, 0.26, M.get('blackMetal'), x + s * 1.1, y + 1.95, z, { tile: 0.4 });
  world.collider(0.3, 3.9, 0.3, x + s * 1.1, y + 1.95, z);
  B.box(1.3, 0.2, 0.2, M.get('blackMetal'), x + s * 0.5, y + 3.7, z, { tile: 0.3 });
  // backboard
  B.box(0.06, 1.05, 1.8, M.get('glass'), x, y + 3.4, z, { tile: 0.6 });
  B.box(0.08, 1.09, 1.84, M.paint(0xe8e8e8, 0.5, 'bbframe'), x + s * 0.03, y + 3.4, z, { tile: 0.5 });
  B.box(0.02, 0.45, 0.59, M.paint(0xd0342c, 0.5, 'bbsquare'), x - s * 0.04, y + 3.22, z, { tile: 0.3 });
  world.collider(0.12, 1.05, 1.8, x, y + 3.4, z);
  // rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.022, 8, 24), M.solid(0xd1461f, 0.4, 0.8));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(x - s * 0.29, y + 3.05, z);
  world.addProp(rim);
  // net
  const net = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.15, 0.42, 14, 3, true),
    new THREE.MeshBasicMaterial({ color: 0xf2f2f2, wireframe: true, transparent: true, opacity: 0.55 }),
  );
  net.position.set(x - s * 0.29, y + 2.84, z);
  world.addProp(net);

  world.spot(s < 0 ? 'hoopWest' : 'hoopEast', x - s * 3.5, y, z, { hoop: V(x - s * 0.29, y + 3.05, z) });
  world.hoops = world.hoops || [];
  world.hoops.push({ center: V(x - s * 0.29, y + 3.05, z), r: 0.23 });
}

// ── gym ────────────────────────────────────────────────────────────────────
export function gym(k, R) {
  const { world, M, B } = k;
  const y = R.y, x = R.x, z = R.z;
  // mirror wall — two runs flanking the doorway (the room's only door is
  // centred on this wall: 1.4 m leaf + 0.5 m clearance each side)
  for (const s of [-1, 1]) {
    B.box(R.w / 2 - 1.7, 2.4, 0.05, M.get('mirror'), x + s * (R.w / 4 + 0.35), y + 1.5, z - R.d / 2 + 0.14, { tile: 2 });
  }
  // rubber flooring already from the room; add mats
  B.box(2.0, 0.04, 1.2, M.paint(0x2b6a8a, 0.95, 'mat'), x - 2.4, y + 0.07, z + 1.6, { tile: 0.8 });

  // treadmill
  const b = { x: x + 2.6, y, z: z - 2.6, r: Math.PI };
  k.p(b, 0, 0.2, 0, 0.9, 0.4, 1.8, M.get('blackMetal'), 0.6);
  k.p(b, 0, 0.42, 0.1, 0.75, 0.05, 1.5, M.get('rubber'), 0.7);
  k.p(b, 0, 0.9, -0.75, 0.9, 1.0, 0.1, M.get('darkPlastic'), 0.5);
  k.p(b, 0, 1.25, -0.72, 0.55, 0.34, 0.05, M.emissive(0x2f81ff, 0.7), 0.3);
  k.pc(b, 0, 0.6, 0, 0.95, 1.4, 1.9);

  // squat rack + bench
  for (const s of [-1, 1]) {
    B.box(0.1, 2.4, 0.1, M.paint(0xb3121a, 0.5, 'rack'), x - 2.6 + s * 0.7, y + 1.2, z - 1.4, { tile: 0.3 });
    world.collider(0.14, 2.4, 0.14, x - 2.6 + s * 0.7, y + 1.2, z - 1.4);
  }
  B.box(1.7, 0.06, 0.06, M.get('chrome'), x - 2.6, y + 1.5, z - 1.4, { tile: 0.3 });
  B.box(0.4, 0.14, 1.3, M.get('leather'), x - 2.6, y + 0.5, z - 0.6, { tile: 0.4 });
  B.box(0.16, 0.42, 0.16, M.get('blackMetal'), x - 2.6, y + 0.22, z - 0.6, { tile: 0.3 });
  world.collider(0.5, 0.6, 1.4, x - 2.6, y + 0.35, z - 0.6);

  // dumbbell rack
  B.box(1.8, 0.1, 0.5, M.get('blackMetal'), x, y + 0.55, z + R.d / 2 - 0.8, { tile: 0.4 });
  B.box(1.8, 0.1, 0.5, M.get('blackMetal'), x, y + 0.25, z + R.d / 2 - 0.7, { tile: 0.4 });
  for (let i = 0; i < 6; i++) {
    for (const yy of [0.66, 0.36]) {
      const dx = x - 0.75 + i * 0.3;
      B.box(0.1, 0.1, 0.34, M.get('chrome'), dx, y + yy, z + R.d / 2 - (yy > 0.5 ? 0.8 : 0.7), { tile: 0.2 });
      for (const s of [-1, 1]) B.box(0.2, 0.2, 0.1, M.get('rubber'), dx, y + yy, z + R.d / 2 - (yy > 0.5 ? 0.8 : 0.7) + s * 0.2, { tile: 0.2 });
    }
  }
  world.collider(1.9, 0.9, 0.7, x, y + 0.45, z + R.d / 2 - 0.75);
  world.spot('gym', x, y, z);
}

// ── gaming rooms ───────────────────────────────────────────────────────────
export function gamingRoom(k, R, id) {
  const { world, M, B } = k;
  const y = R.y, x = R.x, z = R.z;
  const rgb = [0x2f7bff, 0xff2f7b, 0x7bff2f, 0xff8a2f];

  // battlestation desk against the south (window) wall
  const dz = z + R.d / 2 - 1.2;
  const b = { x, y, z: dz, r: Math.PI };
  k.p(b, 0, 0.75, 0, 3.2, 0.06, 0.85, M.paint(0x14171d, 0.4, 'gdesk'), 0.9);
  for (const s of [-1, 1]) k.p(b, s * 1.5, 0.37, 0, 0.08, 0.75, 0.75, M.get('blackMetal'), 0.5);
  k.pc(b, 0, 0.4, 0, 3.3, 0.8, 0.9);

  // triple monitors
  const screens = [];
  for (let i = -1; i <= 1; i++) {
    const ang = -i * 0.34;
    const mx = x + i * 0.72;
    const mz = dz - Math.abs(i) * 0.14;
    B.box(0.72, 0.44, 0.03, M.get('blackMetal'), mx, y + 1.15, mz, { rotY: ang, tile: 0.3 });
    const scrMat = M.get('screenOff').clone(); scrMat.name = `pc${id}_${i}`;
    const scr = boxMesh(0.68, 0.4, 0.012, scrMat, mx, y + 1.15, mz + 0.025, { rotY: ang, cast: false });
    world.addProp(scr);
    const sObj = { mesh: scr, mat: scrMat, on: false, kind: 'pc' };
    world.screens.push(sObj); screens.push(sObj);
    B.box(0.1, 0.28, 0.1, M.get('blackMetal'), mx, y + 0.88, mz - 0.06, { tile: 0.2 });
    B.box(0.28, 0.02, 0.22, M.get('blackMetal'), mx, y + 0.79, mz - 0.06, { tile: 0.2 });
  }

  // the tower — glass side panel, RGB fans, water cooling
  const tx = x + 1.9, tz = dz - 0.1;
  B.box(0.26, 0.55, 0.55, M.paint(0x0d1014, 0.35, 'case'), tx, y + 1.05, tz, { tile: 0.4 });
  B.box(0.02, 0.5, 0.5, M.get('carGlass'), tx - 0.14, y + 1.05, tz, { tile: 0.3 });
  for (let i = 0; i < 3; i++) {
    const fan = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 20), M.emissive(rgb[i % 4], 3.2));
    fan.position.set(tx - 0.1, y + 0.88 + i * 0.17, tz + 0.12);
    fan.rotation.y = Math.PI / 2;
    world.addProp(fan);
    world.onUpdate((dt, t) => { fan.rotation.z = t * (3 + i); });
  }
  B.box(0.24, 0.05, 0.5, M.emissive(0x00e5ff, 2.2), tx, y + 0.79, tz, { tile: 0.3 });
  world.collider(0.3, 0.6, 0.6, tx, y + 1.05, tz);

  // keyboard, mouse, headset, mug
  B.box(0.46, 0.02, 0.16, M.emissive(rgb[id % 4], 1.1), x, y + 0.79, dz + 0.28, { tile: 0.2 });
  B.box(0.07, 0.03, 0.11, M.emissive(0xff2f7b, 1.0), x + 0.42, y + 0.8, dz + 0.28, { tile: 0.2 });
  B.box(0.2, 0.22, 0.1, M.get('darkPlastic'), x - 1.2, y + 0.88, dz + 0.1, { tile: 0.2 });
  B.box(0.09, 0.11, 0.09, M.paint(0xe8e2d6, 0.4, 'mug'), x - 0.9, y + 0.83, dz + 0.24, { tile: 0.2 });

  // chair
  const chair = { x, y, z: dz - 1.0, r: 0 };
  k.p(chair, 0, 0.47, 0, 0.6, 0.1, 0.55, M.paint(0x14171d, 0.6, 'gchair'), 0.4);
  k.p(chair, 0, 0.95, -0.26, 0.58, 0.9, 0.12, M.paint(0x14171d, 0.6, 'gchair'), 0.4);
  for (const s of [-1, 1]) k.p(chair, s * 0.27, 0.9, -0.24, 0.06, 0.8, 0.14, M.emissive(rgb[id % 4], 1.4), 0.3);
  k.p(chair, 0, 0.25, 0, 0.08, 0.34, 0.08, M.get('chrome'), 0.2);
  k.p(chair, 0, 0.05, 0, 0.62, 0.06, 0.62, M.get('darkPlastic'), 0.3);
  k.pc(chair, 0, 0.5, 0, 0.65, 1.0, 0.6);

  // LED strip round the ceiling
  for (const s of [-1, 1]) {
    B.box(R.w - 0.6, 0.05, 0.05, M.emissive(rgb[id % 4], 2.6), x, y + R.h - 0.22, z + s * (R.d / 2 - 0.25), { tile: 0.4 });
  }
  // collectibles shelf runs down the east wall — the north wall holds the
  // room's centred door, so nothing hangs there
  const shX = x + R.w / 2 - 0.3;
  B.box(0.28, 0.05, R.d - 2.4, M.paint(0x1b1f27, 0.5, 'shelf'), shX, y + 1.7, z, { tile: 0.4 });
  for (let i = 0; i < 8; i++) {
    B.box(0.12, 0.22, 0.12, M.emissive([0x4fc3f7, 0xffb74d, 0xba68c8, 0x81c784][i % 4], 0.5),
      shX, y + 1.84, z - (R.d - 3.4) / 2 + i * ((R.d - 3.4) / 7), { tile: 0.2 });
  }

  // console TV on the west wall, clear of the doorway and of the shelf
  const tvMat = M.get('screenOff').clone(); tvMat.name = `gtv${id}`;
  const tvX = x - R.w / 2 + 0.2;
  B.box(0.06, 1.0, 1.7, M.get('blackMetal'), tvX, y + 1.6, z, { tile: 0.4 });
  const gtv = boxMesh(0.02, 0.9, 1.6, tvMat, tvX + 0.06, y + 1.6, z, { cast: false });
  world.addProp(gtv);
  const gScreen = { mesh: gtv, mat: tvMat, on: false, kind: 'tv' };
  world.screens.push(gScreen);

  const powerOn = () => {
    const on = !screens[0].on;
    for (const s of screens) s.on = on;
    gScreen.on = on;
    return on ? 'pcon' : 'click';
  };
  world.addInteract({
    pos: V(x, y + 1.0, dz - 0.7), radius: 2.4,
    label: () => (screens[0].on ? 'Shut down the rig' : 'Boot the gaming PC'),
    onUse: powerOn, kind: 'pc', data: screens[0],
  });
  world.addInteract({ pos: V(chair.x, y + 0.6, chair.z), radius: 1.5, label: 'Sit at the PC', kind: 'seat', seat: { x: chair.x, y: y + 0.6, z: chair.z, rotY: Math.PI } });
  world.spot(`gaming${id}`, chair.x, y, chair.z, { rotY: Math.PI });
  world.addLight({ pos: V(x, y + 1.4, dz), color: rgb[id % 4], intensity: 10, distance: 8, lamp: true });
}

// ── laundry ────────────────────────────────────────────────────────────────
export function laundry(k, R) {
  const { world, M, B } = k;
  const y = R.y, z0 = R.z - R.d / 2;
  // the room's only door is centred on the corridor (north) wall, so the
  // washer/dryer run lives against the west wall instead, facing east
  const wx = R.x - R.w / 2 + 0.53;
  for (let i = 0; i < 2; i++) {
    const z = z0 + 1.0 + i * 1.15;
    B.box(0.75, 1.0, 0.9, M.paint(i ? 0xe9edf1 : 0xd8e2ea, 0.35, 'appliance'), wx, y + 0.5, z, { tile: 0.5 });
    B.box(0.06, 0.5, 0.5, M.get('carGlass'), wx + 0.38, y + 0.55, z, { tile: 0.3 });
    B.box(0.1, 0.14, 0.86, M.get('darkPlastic'), wx + 0.36, y + 0.94, z, { tile: 0.3 });
    B.box(0.06, 0.06, 0.2, M.emissive(0x6fd3ff, 1.0), wx + 0.4, y + 0.94, z - 0.28, { tile: 0.2 });
    world.collider(0.8, 1.05, 0.95, wx, y + 0.5, z);
  }
  // folding counter over the machines + upper cabinet on the same wall
  B.box(0.65, 0.06, 2.6, M.get('marble'), wx, y + 1.06, z0 + 1.55, { tile: 0.8 });
  B.box(0.35, 0.9, 2.6, M.paint(0xdfe4e8, 0.5, 'lcab'), wx - 0.18, y + 2.0, z0 + 1.55, { tile: 0.6 });
  // drying rail on the corridor wall east of the door, on proper brackets
  B.box(1.6, 0.04, 0.04, M.get('chrome'), R.x + 1.8, y + 1.9, z0 + 0.32, { tile: 0.2 });
  for (const s of [-1, 1]) {
    B.box(0.05, 0.05, 0.3, M.get('chrome'), R.x + 1.8 + s * 0.7, y + 1.9, z0 + 0.21, { tile: 0.2 });
  }
  // baskets under the rail, clear of the door swing
  for (let i = 0; i < 3; i++) {
    B.box(0.5, 0.34, 0.36, M.paint([0xc9d6df, 0xe0d3c4, 0xcfd8c9][i], 0.85, 'basket'), R.x + 1.4 + i * 0.6, y + 0.18, z0 + 0.85, { tile: 0.3 });
  }
  world.spot('laundry', R.x, y, R.z);
}

// ── garage ─────────────────────────────────────────────────────────────────
export function garage(k, R) {
  const { world, M, B } = k;
  const y = R.y;
  // work bench along the east wall
  const bx = R.x + R.w / 2 - 0.6;
  B.box(0.7, 0.9, 5.0, M.paint(0x2c3540, 0.5, 'bench'), bx, y + 0.45, R.z, { tile: 0.7 });
  B.box(0.76, 0.07, 5.0, M.get('maple'), bx, y + 0.93, R.z, { tile: 0.8 });
  world.collider(0.76, 0.95, 5.0, bx, y + 0.47, R.z);
  B.box(0.1, 1.3, 4.4, M.paint(0xb9c0c6, 0.6, 'pegboard'), bx + 0.3, y + 1.8, R.z, { tile: 0.8 });
  // tools on the pegboard
  const tools = [0x8a8f96, 0xd0342c, 0x2f81ff, 0xf0b429, 0x6ab04c];
  for (let i = 0; i < 12; i++) {
    B.box(0.05, 0.34, 0.12, M.solid(tools[i % 5], 0.5, 0.6), bx + 0.22, y + 1.4 + (i % 3) * 0.42, R.z - 1.9 + Math.floor(i / 3) * 1.0, { tile: 0.2 });
  }
  // shelving + boxes
  for (let s = 0; s < 3; s++) {
    B.box(2.4, 0.06, 0.6, M.get('steel'), R.x - 2.2, y + 0.5 + s * 0.7, R.z + R.d / 2 - 0.5, { tile: 0.5 });
    for (let i = 0; i < 3; i++) {
      B.box(0.6, 0.42, 0.45, M.paint([0xb08968, 0x9c6644, 0xddb892][i], 0.85, 'boxc'), R.x - 3.0 + i * 0.8, y + 0.74 + s * 0.7, R.z + R.d / 2 - 0.5, { tile: 0.3 });
    }
  }
  world.collider(2.4, 2.4, 0.6, R.x - 2.2, y + 1.2, R.z + R.d / 2 - 0.5);
  world.spot('garage', R.x, y, R.z);
}

// ── workshop ───────────────────────────────────────────────────────────────
export function workshop(k, R) {
  const { world, M, B } = k;
  const y = R.y;
  B.box(R.w - 2.0, 0.9, 0.8, M.paint(0x3a4550, 0.55, 'wbench'), R.x, y + 0.45, R.z + R.d / 2 - 0.7, { tile: 0.7 });
  B.box(R.w - 2.0, 0.07, 0.86, M.get('maple'), R.x, y + 0.93, R.z + R.d / 2 - 0.7, { tile: 0.9 });
  world.collider(R.w - 2.0, 0.95, 0.86, R.x, y + 0.47, R.z + R.d / 2 - 0.7);
  B.box(1.2, 0.7, 0.5, M.get('steel'), R.x - 1.4, y + 1.3, R.z + R.d / 2 - 0.7, { tile: 0.4 });
  // furnace / mechanical
  B.box(1.2, 1.9, 1.0, M.get('steel'), R.x + R.w / 2 - 1.0, y + 0.95, R.z - R.d / 2 + 1.0, { tile: 0.6 });
  B.box(0.5, 2.6, 0.5, M.get('steel'), R.x + R.w / 2 - 1.0, y + 3.0, R.z - R.d / 2 + 1.0, { tile: 0.5 });
  world.collider(1.2, 1.9, 1.0, R.x + R.w / 2 - 1.0, y + 0.95, R.z - R.d / 2 + 1.0);
}
