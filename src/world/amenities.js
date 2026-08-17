// ───────────────────────────────────────────────────────────────────────────
// The fun rooms: movie theater, bowling alley, basketball court, gym,
// gaming rooms, laundry, garage and workshop.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { boxMesh, mesh } from './build.js';
import { Kit, barstool, gamesConsole, panelMaterial, segRow, wallClock } from './furniture.js';

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

  // lit poster case beside the snack bar — every screen in this house should
  // be showing something
  // (sits just proud of the acoustic panelling, which runs at x1 - 0.2)
  const pz = R.z - R.d / 2 + 2.9;
  B.box(0.08, 1.32, 0.92, M.get('blackMetal'), x1 - 0.27, y + 2.0, pz, { tile: 0.3 });
  B.box(0.03, 1.2, 0.8, posterMaterial(M), x1 - 0.315, y + 2.0, pz);

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

  const dark = M.paint(0x1b2028, 0.7, 'gutterwall');
  const mask = M.paint(0x2a3140, 0.75, 'masking');
  const trim = M.paint(0x2c2318, 0.5, 'arrow');

  for (let li = 0; li < laneZ.length; li++) {
    const lz = laneZ[li];
    // lane bed
    B.box(foulX - pinX, 0.1, 1.06, M.get('laneWood'), (pinX + foulX) / 2, y + 0.05, lz, { tile: 1.5 });
    // one collider covering pin deck → lane → approach so nothing drops through
    world.collider(foulX - pinX + 5.6, 0.14, 1.5, (pinX + foulX) / 2 + 1.2, y + 0.04, lz);
    // gutters: a trough with a lip either side, not a painted stripe
    for (const s of [-1, 1]) {
      B.box(foulX - pinX, 0.1, 0.24, M.get('darkPlastic'), (pinX + foulX) / 2, y - 0.01, lz + s * 0.66, { tile: 1 });
      world.collider(foulX - pinX, 0.1, 0.24, (pinX + foulX) / 2, y - 0.02, lz + s * 0.66);
      B.box(foulX - pinX, 0.11, 0.03, dark, (pinX + foulX) / 2, y + 0.045, lz + s * 0.545, { tile: 1 });
      B.box(foulX - pinX, 0.08, 0.05, dark, (pinX + foulX) / 2, y + 0.045, lz + s * 0.795, { tile: 1 });
      B.box(foulX - pinX, 0.5, 0.08, dark, (pinX + foulX) / 2, y + 0.25, lz + s * 0.82, { tile: 1 });
      world.collider(foulX - pinX, 0.5, 0.08, (pinX + foulX) / 2, y + 0.25, lz + s * 0.82);
      // kickback panels flanking the pin deck, where the pins fly off
      B.box(2.0, 1.0, 0.1, mask, pinX - 0.45, y + 0.6, lz + s * 0.79, { tile: 0.7 });
      world.collider(2.0, 1.0, 0.1, pinX - 0.45, y + 0.6, lz + s * 0.79);
    }
    // approach
    B.box(3.6, 0.1, 2.4, M.get('maple'), foulX + 1.8, y + 0.05, lz, { tile: 1.4 });
    world.collider(3.6, 0.14, 2.4, foulX + 1.8, y + 0.04, lz);
    // pin deck & backstop
    B.box(1.6, 0.12, 1.4, M.paint(0xe9e4d8, 0.4, 'pindeck'), pinX - 0.4, y + 0.06, lz, { tile: 0.6 });
    B.box(0.4, 2.6, 1.9, M.paint(0x11151b, 0.9, 'backstop'), pinX - 1.4, y + 1.3, lz, { tile: 0.8 });
    world.collider(0.4, 2.6, 1.9, pinX - 1.4, y + 1.3, lz);
    // masking unit: the fascia that hides the pinsetter, with the machine
    // itself sitting on top of it and the lane number lit on the front
    B.box(0.22, 1.6, 1.88, mask, pinX - 0.5, y + 1.9, lz, { tile: 0.8 });
    B.box(0.07, 0.2, 1.88, M.emissive(li ? 0x3fd0ff : 0xff3f8a, 1.6), pinX - 0.36, y + 2.6, lz, { tile: 0.4 });
    B.box(0.03, 0.42, 0.42, laneNumberMaterial(M, li + 1), pinX - 0.375, y + 1.9, lz);
    B.box(0.95, 0.85, 1.9, M.get('steel'), pinX - 0.9, y + 3.15, lz, { tile: 0.6 });
    B.box(0.5, 0.3, 1.5, M.get('blackMetal'), pinX - 0.45, y + 3.7, lz, { tile: 0.4 });
    // foul line, then the approach dots and the range-finder arrows
    B.box(0.06, 0.008, 1.56, M.paint(0x8c2f22, 0.5, 'foul'), foulX, y + 0.104, lz, { tile: 0.2 });
    for (let i = 0; i < 7; i++) {
      const dz = lz - 0.42 + i * 0.14;
      B.box(0.07, 0.006, 0.07, trim, foulX + 0.9, y + 0.104, dz, { tile: 0.2 });
      if (i % 2 === 1 && i < 6) B.box(0.07, 0.006, 0.07, trim, foulX + 2.1, y + 0.104, dz, { tile: 0.2 });
      // arrows step further down the lane towards the middle of the spread
      B.box(0.24, 0.006, 0.065, trim, foulX - 3.7 - (3 - Math.abs(i - 3)) * 0.62, y + 0.104, dz, { tile: 0.2 });
    }
    // the ten spots the pins stand on
    for (let row = 0; row < 4; row++) {
      for (let c = 0; c <= row; c++) {
        B.box(0.06, 0.005, 0.06, M.paint(0x9a3a2c, 0.5, 'pinspot'),
          pinX - row * 0.265, y + 0.124, lz + (c - row / 2) * 0.305, { tile: 0.2 });
      }
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
    // score monitor hanging over the lane, showing an actual game
    const ceilY = y + (R.h || 5.4);
    for (const s of [-1, 1]) B.box(0.04, ceilY - y - 3.85, 0.04, M.get('blackMetal'), foulX - 1.2, (ceilY + y + 3.85) / 2, lz + s * 0.55, { tile: 0.2 });
    B.box(0.1, 0.9, 1.5, M.get('blackMetal'), foulX - 1.2, y + 3.4, lz, { tile: 0.5 });
    B.box(0.03, 0.8, 1.4, scoreMaterial(M, li), foulX - 1.14, y + 3.4, lz);
    world.spot(`bowlingApproach${lz > R.z ? 'B' : 'A'}`, foulX + 1.4, y, lz, { rotY: -Math.PI / 2, tag });
  }

  // ball return: rack, cradle rails, the lift housing the balls come up
  // through, and a hood over the lot
  const rx = foulX + 3.0;
  const retMat = M.paint(0x1d2530, 0.5, 'return');
  B.box(1.2, 0.85, 1.6, retMat, rx, y + 0.42, R.z, { tile: 0.6 });
  world.collider(1.2, 0.85, 1.6, rx, y + 0.42, R.z);
  for (const s of [-1, 1]) B.box(0.05, 0.05, 1.56, M.get('chrome'), rx + s * 0.2, y + 0.87, R.z, { tile: 0.2 });
  B.box(0.7, 1.15, 0.9, retMat, rx - 0.95, y + 0.575, R.z, { tile: 0.5 });
  world.collider(0.7, 1.15, 0.9, rx - 0.95, y + 0.575, R.z);
  B.box(0.08, 0.34, 0.34, M.get('blackMetal'), rx - 0.62, y + 0.72, R.z, { tile: 0.2 });   // ball exit
  B.box(0.55, 0.1, 1.7, retMat, rx - 0.5, y + 1.2, R.z, { tile: 0.4 });                    // hood
  B.box(0.5, 0.06, 1.6, M.emissive(0xffd9a0, 0.9), rx - 0.5, y + 1.13, R.z, { tile: 0.3 });
  B.box(0.3, 0.26, 0.3, M.get('blackMetal'), rx - 0.95, y + 1.3, R.z - 0.5, { tile: 0.3 }); // hand blower
  B.box(0.2, 0.03, 0.2, M.emissive(0x6fd3ff, 1.0), rx - 0.95, y + 1.16, R.z - 0.5, { tile: 0.2 });
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
  // scoreboard, mid-game — the display goes on the court side of the housing,
  // not the wall side, or the whole thing reads as a black slab
  B.box(3.2, 1.4, 0.2, M.get('blackMetal'), R.x, y + 4.4, R.z - R.d / 2 + 0.4, { tile: 0.6 });
  B.box(2.9, 1.1, 0.06, scoreboardMaterial(M), R.x, y + 4.4, R.z - R.d / 2 + 0.53);

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
  // markings on the play side: the shooter's square as an outline (a solid
  // block is a target, not a backboard) inside the painted perimeter border
  const border = M.paint(0xf0f0ee, 0.55, 'bbline');
  const sq = M.paint(0xd0342c, 0.5, 'bbsquare');
  for (const t of [-1, 1]) {
    B.box(0.02, 0.05, 1.8, border, x - s * 0.035, y + 3.4 + t * 0.5, z, { tile: 0.3 });
    B.box(0.02, 1.05, 0.05, border, x - s * 0.035, y + 3.4, z + t * 0.875, { tile: 0.3 });
    B.box(0.02, 0.045, 0.59, sq, x - s * 0.04, y + 3.22 + t * 0.2, z, { tile: 0.3 });
    B.box(0.02, 0.45, 0.045, sq, x - s * 0.04, y + 3.22, z + t * 0.272, { tile: 0.3 });
  }
  world.collider(0.12, 1.05, 1.8, x, y + 3.4, z);
  // rim + the bracket that ties it back to the board
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.022, 8, 24), M.solid(0xd1461f, 0.4, 0.8));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(x - s * 0.29, y + 3.05, z);
  world.addProp(rim);
  B.box(0.12, 0.09, 0.3, M.solid(0xd1461f, 0.4, 0.8), x - s * 0.05, y + 3.03, z, { tile: 0.2 });
  // net: twelve tapering strands hung off the rim, tied together by two rows
  // of mesh, so a made basket actually snaps through something
  const nx = x - s * 0.29, ny = y + 3.05;
  const cord = M.paint(0xf4f4f0, 0.9, 'net');
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    B.box(0.013, 0.44, 0.013, cord, nx + Math.cos(a) * 0.19, ny - 0.21, z + Math.sin(a) * 0.19,
      { rotY: -a, rotZ: -0.19 });
  }
  for (const [dy, r] of [[-0.13, 0.21], [-0.3, 0.17]]) {
    for (let i = 0; i < 12; i++) {
      const a = ((i + 0.5) / 12) * Math.PI * 2;
      B.box(0.52 * r, 0.012, 0.012, cord, nx + Math.cos(a) * r, ny + dy, z + Math.sin(a) * r, { rotY: Math.PI / 2 - a });
    }
  }

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

  const black = M.get('blackMetal'), chrome = M.get('chrome'), rubber = M.get('rubber');

  // treadmill
  const b = { x: x + 2.6, y, z: z - 2.6, r: Math.PI };
  k.p(b, 0, 0.2, 0, 0.9, 0.4, 1.8, black, 0.6);
  k.p(b, 0, 0.42, 0.1, 0.75, 0.05, 1.5, rubber, 0.7);
  k.p(b, 0, 0.9, -0.75, 0.9, 1.0, 0.1, M.get('darkPlastic'), 0.5);
  k.p(b, 0, 1.25, -0.715, 0.55, 0.34, 0.04, treadmillPanel(M), 0);
  for (const s of [-1, 1]) k.p(b, s * 0.4, 1.02, -0.6, 0.06, 0.06, 0.34, chrome, 0.2);   // side rails
  k.pc(b, 0, 0.6, 0, 0.95, 1.4, 1.9);

  // squat rack on a lifting platform, bar loaded with bumper plates
  B.box(2.5, 0.05, 2.4, M.get('maple'), x - 2.6, y + 0.075, z - 1.0, { tile: 1.0 });
  for (const s of [-1, 1]) {
    B.box(0.1, 2.4, 0.1, M.paint(0xb3121a, 0.5, 'rack'), x - 2.6 + s * 0.7, y + 1.2, z - 1.4, { tile: 0.3 });
    B.box(0.5, 0.06, 0.08, M.paint(0xb3121a, 0.5, 'rack'), x - 2.6 + s * 0.9, y + 1.42, z - 1.4, { tile: 0.2 });
    world.collider(0.14, 2.4, 0.14, x - 2.6 + s * 0.7, y + 1.2, z - 1.4);
  }
  B.box(0.1, 0.06, 1.4, M.paint(0xb3121a, 0.5, 'rack'), x - 2.6, y + 2.34, z - 1.4, { tile: 0.3 });
  B.box(2.0, 0.055, 0.055, chrome, x - 2.6, y + 1.5, z - 1.4, { tile: 0.3 });
  for (const s of [-1, 1]) {
    plate(B, rubber, x - 2.6 + s * 0.82, y + 1.5, z - 1.4, 0.22, 0.055);
    plate(B, M.solid(0x1b2a3a, 0.85), x - 2.6 + s * 0.9, y + 1.5, z - 1.4, 0.2, 0.05);
  }
  // bench in the rack, on proper feet
  B.box(0.4, 0.14, 1.3, M.get('leather'), x - 2.6, y + 0.5, z - 0.5, { tile: 0.4 });
  B.box(0.36, 0.16, 0.4, M.get('leather'), x - 2.6, y + 0.56, z - 1.05, { tile: 0.4 });
  for (const s of [-1, 1]) B.box(0.34, 0.42, 0.09, black, x - 2.6, y + 0.22, z - 0.5 + s * 0.55, { tile: 0.3 });
  world.collider(0.5, 0.65, 1.5, x - 2.6, y + 0.35, z - 0.6);

  // plate tree by the platform
  const px = x - 4.8, pz = z - 2.3;
  B.box(0.5, 0.08, 0.5, black, px, y + 0.09, pz, { tile: 0.3 });
  B.box(0.12, 1.35, 0.12, M.paint(0xb3121a, 0.5, 'rack'), px, y + 0.72, pz, { tile: 0.3 });
  for (let i = 0; i < 3; i++) {
    B.box(0.32, 0.06, 0.06, black, px + 0.2, y + 0.4 + i * 0.38, pz, { tile: 0.2 });
    plate(B, i === 1 ? M.solid(0x1b2a3a, 0.85) : rubber, px + 0.28, y + 0.4 + i * 0.38, pz, 0.22 - i * 0.03, 0.06);
  }
  world.collider(0.6, 1.4, 0.6, px, y + 0.7, pz);

  // cable machine against the west wall
  const cx = x - R.w / 2 + 0.65, cz = z + 1.7;
  for (const s of [-1, 1]) {
    B.box(0.1, 2.4, 0.12, black, cx, y + 1.2, cz + s * 0.6, { tile: 0.3 });
    B.box(0.12, 0.12, 0.12, chrome, cx, y + 2.28, cz + s * 0.6, { tile: 0.2 });
    B.box(0.02, 1.3, 0.02, chrome, cx, y + 1.6, cz + s * 0.6, { tile: 0.2 });
    B.box(0.16, 0.05, 0.05, chrome, cx, y + 0.94, cz + s * 0.6, { tile: 0.2 });
  }
  B.box(0.1, 0.12, 1.32, black, cx, y + 2.34, cz, { tile: 0.3 });
  B.box(0.34, 1.15, 0.46, M.get('steel'), cx - 0.12, y + 0.62, cz, { tile: 0.5 });
  for (let i = 0; i < 7; i++) B.box(0.36, 0.03, 0.48, black, cx - 0.12, y + 0.24 + i * 0.15, cz, { tile: 0.2 });
  world.collider(0.6, 2.4, 1.4, cx - 0.05, y + 1.2, cz);

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
  for (const s of [-1, 1]) B.box(0.08, 0.75, 0.6, black, x + s * 0.95, y + 0.38, z + R.d / 2 - 0.75, { tile: 0.3 });

  // kettlebells lined up beside the dumbbells
  for (let i = 0; i < 4; i++) {
    const kx = x + 1.4 + i * 0.34, kz = z + R.d / 2 - 0.7;
    B.box(0.19, 0.17, 0.19, M.solid([0x2f81ff, 0x6ab04c, 0xf0b429, 0xb3121a][i], 0.7), kx, y + 0.09, kz, { tile: 0.2 });
    B.box(0.15, 0.09, 0.06, black, kx, y + 0.21, kz, { tile: 0.2 });
  }

  // exercise bike, turned to face the mirror wall
  const bk = { x: x + 4.0, y, z: z - 0.7, r: 0 };
  k.p(bk, 0, 0.06, 0, 0.5, 0.12, 1.15, black, 0.4);
  k.p(bk, 0, 0.5, 0.14, 0.1, 0.86, 0.14, black, 0.4);
  k.p(bk, 0, 0.62, 0.34, 0.07, 0.7, 0.07, chrome, 0.2);
  k.p(bk, 0, 0.99, 0.34, 0.18, 0.08, 0.32, M.get('leather'), 0.3);
  k.p(bk, 0, 0.7, -0.36, 0.08, 0.9, 0.08, black, 0.3);
  k.p(bk, 0, 1.12, -0.4, 0.52, 0.05, 0.05, chrome, 0.2);
  k.p(bk, 0, 1.24, -0.36, 0.26, 0.17, 0.03, treadmillPanel(M), 0);
  k.p(bk, 0, 0.3, -0.06, 0.36, 0.05, 0.05, black, 0.2);
  plate(B, M.get('darkPlastic'), bk.x, y + 0.42, bk.z - 0.16, 0.26, 0.07);
  k.pc(bk, 0, 0.55, 0, 0.6, 1.1, 1.25);

  // water cooler against the east wall by the door
  const wx = x + R.w / 2 - 0.32, wz = z - R.d / 2 + 1.5;
  B.box(0.36, 1.0, 0.36, M.get('darkPlastic'), wx, y + 0.5, wz, { tile: 0.3 });
  B.box(0.3, 0.46, 0.3, M.get('water'), wx, y + 1.23, wz, { tile: 0.3 });
  for (const s of [-1, 1]) B.box(0.05, 0.05, 0.1, chrome, wx + s * 0.08, y + 0.78, wz - 0.2, { tile: 0.2 });
  world.collider(0.4, 1.5, 0.4, wx, y + 0.75, wz);

  // rolled mats stood on end in the far corner
  for (let i = 0; i < 3; i++) {
    B.box(0.26, 0.92, 0.26, M.solid([0x2b6a8a, 0x6ab04c, 0x8a5b9a][i], 0.95),
      x - R.w / 2 + 0.55 + i * 0.3, y + 0.51, z + R.d / 2 - 0.5 - (i % 2) * 0.26,
      { rotY: i * 0.4, tile: 0.3 });
  }

  wallClock(k, x + R.w / 2 - 0.16, y + 2.4, z - 1.4, -Math.PI / 2, { hour: 7, minute: 25 });
  world.spot('gym', x, y, z);
}

/**
 * A weight plate: two squares at 45° to each other make a regular octagon —
 * near enough to a disc for a fraction of the triangles of a cylinder.  The
 * squares are sized so their corners land on radius r (2r would give a star).
 */
function plate(B, mat, x, y, z, r, t = 0.05) {
  const s = r * Math.SQRT2;
  B.box(t, s, s, mat, x, y, z, { tile: 0.2 });
  B.box(t, s, s, mat, x, y, z, { rotX: Math.PI / 4, tile: 0.2 });
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

  // media unit under the TV, with the console on it.  Screen time is a thing
  // that gets taken away, so the console is its own hideable group and every
  // one in the house is published on `world.consoles`.
  const plX = x - R.w / 2 + 0.42;
  B.box(0.5, 0.46, 1.7, M.paint(0x14171d, 0.5, 'mediaunit'), plX, y + 0.23, z, { tile: 0.5 });
  B.box(0.56, 0.05, 1.76, M.get('blackMetal'), plX, y + 0.48, z, { tile: 0.4 });
  B.box(0.44, 0.03, 1.5, M.emissive(rgb[id % 4], 0.9), plX + 0.04, y + 0.02, z, { tile: 0.3 });
  world.collider(0.56, 0.52, 1.76, plX, y + 0.26, z);
  gamesConsole(k, plX, y + 0.505, z - 0.25, { rotY: Math.PI / 2, room: R.name, led: rgb[id % 4] });

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
  const steel = M.get('steel'), black = M.get('blackMetal'), chrome = M.get('chrome');
  const bz = R.z + R.d / 2 - 0.7;
  B.box(R.w - 2.0, 0.9, 0.8, M.paint(0x3a4550, 0.55, 'wbench'), R.x, y + 0.45, bz, { tile: 0.7 });
  B.box(R.w - 2.0, 0.07, 0.86, M.get('maple'), R.x, y + 0.93, bz, { tile: 0.9 });
  world.collider(R.w - 2.0, 0.95, 0.86, R.x, y + 0.47, bz);
  B.box(1.2, 0.7, 0.5, steel, R.x - 1.4, y + 1.3, bz, { tile: 0.4 });
  // drawer bank under the bench
  for (let i = 0; i < 4; i++) {
    B.box(0.86, 0.18, 0.03, M.paint(0x4a5762, 0.5, 'wdrawer'), R.x + 1.5, y + 0.22 + i * 0.2, bz - 0.41, { tile: 0.3 });
    B.box(0.4, 0.03, 0.03, chrome, R.x + 1.5, y + 0.22 + i * 0.2, bz - 0.44, { tile: 0.2 });
  }
  // engineer's vice bolted to the corner of the bench
  const vx = R.x - 2.0;
  B.box(0.24, 0.14, 0.24, black, vx, y + 1.03, bz - 0.2, { tile: 0.2 });
  B.box(0.26, 0.18, 0.07, black, vx, y + 1.17, bz - 0.29, { tile: 0.2 });
  B.box(0.26, 0.18, 0.07, black, vx, y + 1.17, bz - 0.11, { tile: 0.2 });
  B.box(0.05, 0.05, 0.34, chrome, vx, y + 1.17, bz - 0.02, { tile: 0.2 });
  B.box(0.22, 0.04, 0.04, chrome, vx, y + 1.17, bz + 0.14, { tile: 0.2 });
  // pegboard of tools on the wall behind the bench
  const pz = R.z + R.d / 2 - 0.14;
  B.box(R.w - 2.4, 1.3, 0.06, M.paint(0xb9c0c6, 0.6, 'pegboard'), R.x, y + 1.85, pz, { tile: 0.8 });
  const tools = [0x8a8f96, 0xd0342c, 0x2f81ff, 0xf0b429, 0x6ab04c];
  for (let i = 0; i < 12; i++) {
    B.box(0.12, 0.32, 0.05, M.solid(tools[i % 5], 0.5, 0.6),
      R.x - 1.9 + Math.floor(i / 3) * 1.25, y + 1.45 + (i % 3) * 0.4, pz - 0.07, { tile: 0.2 });
  }
  // parts shelving down the west wall
  const sx = R.x - R.w / 2 + 0.42;
  for (let s = 0; s < 4; s++) {
    B.box(0.55, 0.05, 3.4, steel, sx, y + 0.42 + s * 0.6, R.z + 1.4, { tile: 0.5 });
    for (let i = 0; i < 5; i++) {
      B.box(0.42, 0.24, 0.5, M.paint([0xb08968, 0xa8b2bb, 0xddb892, 0xcfd8c9, 0x9c6644][(i + s) % 5], 0.85, 'bin'),
        sx, y + 0.57 + s * 0.6, R.z - 0.1 + i * 0.65, { tile: 0.3 });
    }
  }
  for (const s of [-1, 1]) B.box(0.06, 2.4, 0.06, steel, sx, y + 1.2, R.z + 1.4 + s * 1.65, { tile: 0.3 });
  world.collider(0.6, 2.4, 3.4, sx, y + 1.2, R.z + 1.4);
  // rolling tool chest by the door
  const tx = R.x - R.w / 2 + 1.1, tz = R.z - R.d / 2 + 1.4;
  B.box(0.9, 0.88, 0.55, M.paint(0xb3121a, 0.45, 'toolchest'), tx, y + 0.56, tz, { tile: 0.4 });
  for (let i = 0; i < 4; i++) {
    B.box(0.82, 0.17, 0.03, M.paint(0x8e0f16, 0.45, 'toolchestface'), tx, y + 0.26 + i * 0.2, tz + 0.28, { tile: 0.3 });
    B.box(0.38, 0.03, 0.03, chrome, tx, y + 0.26 + i * 0.2, tz + 0.31, { tile: 0.2 });
  }
  for (const ox of [-0.34, 0.34]) for (const oz of [-0.2, 0.2]) B.box(0.1, 0.12, 0.1, black, tx + ox, y + 0.06, tz + oz, { tile: 0.2 });
  world.collider(0.95, 1.0, 0.6, tx, y + 0.5, tz);
  // sawhorses with a stack of boards across them
  for (const hz of [R.z - 1.6, R.z + 0.2]) {
    for (const ox of [-0.5, 0.5]) for (const oz of [-0.22, 0.22]) {
      B.box(0.07, 0.72, 0.07, M.get('maple'), R.x + 0.6 + ox, y + 0.36, hz + oz, { tile: 0.3 });
    }
    B.box(1.2, 0.09, 0.12, M.get('maple'), R.x + 0.6, y + 0.77, hz, { tile: 0.4 });
  }
  for (let i = 0; i < 4; i++) {
    B.box(0.9, 0.045, 2.6, M.get('maple'), R.x + 0.6 + (i % 2) * 0.06, y + 0.85 + i * 0.05, R.z - 0.7, { tile: 0.6 });
  }
  world.collider(1.3, 0.95, 2.8, R.x + 0.6, y + 0.48, R.z - 0.7);
  // plant room: furnace, flue, hot water cylinder and its pipe run
  const fx = R.x + R.w / 2 - 1.0, fz = R.z - R.d / 2 + 1.0;
  B.box(1.2, 1.9, 1.0, steel, fx, y + 0.95, fz, { tile: 0.6 });
  B.box(0.5, 2.6, 0.5, steel, fx, y + 3.0, fz, { tile: 0.5 });
  B.box(0.9, 0.5, 0.06, black, fx, y + 1.2, fz - 0.53, { tile: 0.3 });
  B.box(0.16, 0.1, 0.03, M.emissive(0x6ab04c, 1.0), fx - 0.3, y + 1.2, fz - 0.57, { tile: 0.2 });
  world.collider(1.2, 1.9, 1.0, fx, y + 0.95, fz);
  B.box(0.74, 1.7, 0.74, steel, fx, y + 0.85, fz + 1.5, { tile: 0.5 });
  B.box(0.5, 0.12, 0.5, M.paint(0x2c3540, 0.6, 'heatercap'), fx, y + 1.76, fz + 1.5, { tile: 0.3 });
  world.collider(0.78, 1.7, 0.78, fx, y + 0.85, fz + 1.5);
  for (const [ox, c] of [[-0.22, 0xb87333], [0.0, 0xb87333], [0.22, 0x8a8f96]]) {
    B.box(0.05, 2.6, 0.05, M.solid(c, 0.35, 0.8), fx + ox, y + 3.0, fz + 1.5, { tile: 0.2 });
    B.box(0.05, 0.05, 1.5, M.solid(c, 0.35, 0.8), fx + ox, y + 4.28, fz + 0.8, { tile: 0.2 });
  }
  world.spot('workshop', R.x, y, R.z - 2.6);
}

// ── painted displays ───────────────────────────────────────────────────────
// A lit rectangle with nothing on it reads as a bug, so every screen down here
// shows something real: a scoreline, a lane number, a workout profile.  Each
// one is a ≤256 px canvas, painted once and cached in the material library.

/** Centred run of seven-segment figures. */
function seg(c, str, cx, y, w, h, gap, t) {
  segRow(c, cx - (str.length * (w + gap) - gap) / 2, y, str, w, h, gap, t);
}

const SCORELINES = [
  { name: 'JAMES', balls: [['X', ''], ['7', '/'], ['9', '-'], ['X', ''], ['8', '/'], ['6', '2']], totals: [20, 39, 48, 68, 84, 92] },
  { name: 'CHLOIE', balls: [['8', '-'], ['9', '/'], ['7', '1'], ['X', ''], ['5', '/'], ['3', '4']], totals: [8, 25, 33, 53, 66, 73] },
  { name: 'KAELIE', balls: [['X', ''], ['X', ''], ['8', '/'], ['7', '2'], ['9', '-'], ['-', '-']], totals: [28, 48, 65, 74, 83, 83] },
  { name: 'YOU', balls: [['9', '-'], ['8', '/'], ['X', ''], ['6', '3'], ['7', '/'], ['X', '']], totals: [9, 29, 48, 57, 77] },
];

/** The overhead monitor: two scorelines, ten frames, mid-game. */
function scoreMaterial(M, lane) {
  return panelMaterial(M, `bowlscore:${lane}`, 256, 144, (c, w, h) => {
    c.fillStyle = '#071019'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#123a63'; c.fillRect(0, 0, w, 20);
    c.fillStyle = '#ff7a2a'; c.fillRect(6, 5, 11, 11);
    c.fillStyle = '#eaf3ff'; segRow(c, 23, 5, String(lane + 1), 8, 11, 3, 2);
    c.font = 'bold 10px monospace';
    c.fillStyle = '#9dc8f0'; c.fillText('LANE', 38, 14);
    const nameW = 52, fw = (w - nameW - 4) / 10;
    for (let i = 0; i < 10; i++) {                       // frame numbers
      const fx = nameW + i * fw;
      c.fillStyle = '#0e2743'; c.fillRect(fx, 22, fw - 2, 13);
      c.fillStyle = '#6fa8dc'; seg(c, String(i + 1), fx + (fw - 2) / 2, 24, 5, 9, 2, 1);
    }
    const mark = (ch, mx, my, s) => {
      if (!ch) return;
      c.fillStyle = '#f4f8ff';
      if (ch === 'X' || ch === '/') {
        c.save(); c.translate(mx + s / 2, my + s / 2);
        for (const a of ch === 'X' ? [0.79, -0.79] : [-0.79]) {
          c.rotate(a); c.fillRect(-s * 0.45, -1, s * 0.9, 2); c.rotate(-a);
        }
        c.restore();
      } else if (ch === '-') c.fillRect(mx + 1.5, my + s / 2 - 1, s - 3, 2);
      else segRow(c, mx + 1.5, my + 1, ch, 5, 7, 1, 1);
    };
    for (let p = 0; p < 2; p++) {
      const row = SCORELINES[(lane * 2 + p) % SCORELINES.length], ry = 37 + p * 52;
      c.fillStyle = p ? '#0b1c2e' : '#102539'; c.fillRect(0, ry, w, 50);
      c.fillStyle = '#e8b34a'; c.fillRect(4, ry + 5, 44, 4);
      c.fillStyle = '#dce9f7'; c.font = 'bold 11px monospace';
      c.fillText(row.name, 4, ry + 26);
      for (let i = 0; i < 10; i++) {
        const fx = nameW + i * fw;
        c.strokeStyle = '#2b587f'; c.lineWidth = 1;
        c.strokeRect(fx + 0.5, ry + 0.5, fw - 2, 48);
        const balls = row.balls[i];
        if (!balls) continue;
        c.strokeRect(fx + 0.5, ry + 0.5, 8, 8);
        c.strokeRect(fx + 9.5, ry + 0.5, 8, 8);
        mark(balls[0], fx + 0.5, ry + 0.5, 8);
        mark(balls[1], fx + 9.5, ry + 0.5, 8);
        if (row.totals[i] === undefined) {               // the frame in play
          c.fillStyle = 'rgba(255,122,42,.3)'; c.fillRect(fx + 1, ry + 10, fw - 3, 38);
          continue;
        }
        c.fillStyle = '#ffd27a'; seg(c, String(row.totals[i]), fx + 9, ry + 20, 6, 14, 2, 2);
      }
    }
  }, { glow: 1.15 });
}

/** Lane number on the masking unit. */
function laneNumberMaterial(M, n) {
  return panelMaterial(M, `lane:${n}`, 64, 64, (c, w) => {
    c.fillStyle = '#0c1119'; c.fillRect(0, 0, w, w);
    c.strokeStyle = '#3fd0ff'; c.lineWidth = 3; c.strokeRect(4, 4, w - 8, w - 8);
    c.fillStyle = '#ffd27a'; seg(c, String(n), w / 2, 15, 22, 34, 5, 4);
  }, { glow: 1.3 });
}

/** Court scoreboard, three minutes into the fourth. */
function scoreboardMaterial(M) {
  return panelMaterial(M, 'scoreboard:court', 256, 96, (c, w, h) => {
    c.fillStyle = '#0a0c10'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1a2029'; c.fillRect(0, 0, w, 16);
    c.strokeStyle = '#39424e'; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2);
    c.font = 'bold 11px monospace'; c.fillStyle = '#8b96a5';
    c.fillText('HOME', 26, 12); c.fillText('GUEST', 182, 12);
    c.fillStyle = '#ff5a2a';
    seg(c, '68', 52, 26, 30, 50, 9, 6);
    seg(c, '64', 204, 26, 30, 50, 9, 6);
    c.fillStyle = '#12161c'; c.fillRect(102, 20, 52, 68);
    c.fillStyle = '#ffd27a'; seg(c, '4', 128, 24, 16, 26, 4, 3);
    c.fillStyle = '#6fd3ff'; seg(c, '724', 130, 58, 12, 22, 3, 2);
    c.fillRect(122, 64, 3, 3); c.fillRect(122, 73, 3, 3);      // clock colon
    c.fillStyle = '#e8b34a';
    for (let i = 0; i < 4; i++) c.fillRect(20 + i * 9, 82, 6, 5);
    for (let i = 0; i < 2; i++) c.fillRect(196 + i * 9, 82, 6, 5);
  }, { glow: 1.5 });
}

/** Cardio console — speed, elapsed time and the interval profile. */
function treadmillPanel(M) {
  return panelMaterial(M, 'panel:treadmill', 128, 80, (c, w, h) => {
    c.fillStyle = '#06131f'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#0d2c47'; c.fillRect(0, 0, w, 11);
    c.fillStyle = '#6fd3ff'; segRow(c, 6, 20, '64', 20, 32, 6, 4);
    c.fillStyle = '#ffd27a'; c.fillRect(27, 48, 4, 4);
    c.fillStyle = '#eaf3ff'; segRow(c, 6, 60, '1832', 9, 14, 3, 2);
    for (let i = 0; i < 13; i++) {
      const bh = 5 + Math.abs(Math.sin(i * 0.9)) * 24;
      c.fillStyle = i < 8 ? '#2f81ff' : '#173a63';
      c.fillRect(60 + i * 5, 68 - bh, 4, bh);
    }
    c.fillStyle = '#173a63'; c.fillRect(60, 70, 64, 2);
  }, { glow: 1.0 });
}

/** The poster in the lightbox outside the theater. */
function posterMaterial(M) {
  return panelMaterial(M, 'poster:nowshowing', 128, 192, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1b2740'); g.addColorStop(0.5, '#8a4331'); g.addColorStop(1, '#140e14');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f0a13c';
    c.beginPath(); c.arc(w * 0.52, h * 0.42, 24, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#241a24';                                  // ridge line
    c.beginPath();
    c.moveTo(0, h * 0.6); c.lineTo(w * 0.3, h * 0.43); c.lineTo(w * 0.52, h * 0.56);
    c.lineTo(w * 0.78, h * 0.38); c.lineTo(w, h * 0.58); c.lineTo(w, h); c.lineTo(0, h);
    c.closePath(); c.fill();
    c.fillStyle = '#15101a';                                  // a figure on the ridge
    c.fillRect(w * 0.46, h * 0.56, 5, 20);
    c.beginPath(); c.arc(w * 0.485, h * 0.55, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(8,8,12,.78)'; c.fillRect(0, h - 48, w, 48);
    c.fillStyle = '#e8c37a'; c.fillRect(10, h - 40, w - 20, 8);
    c.fillStyle = '#cfd6e0';
    for (let i = 0; i < 3; i++) c.fillRect(14, h - 26 + i * 6, w - 28 - i * 24, 3);
    c.fillStyle = '#ff6a1e'; c.fillRect(0, 0, w, 13);
    c.fillStyle = '#160a0c'; c.fillRect(9, 4, w - 18, 6);
  }, { glow: 0.75 });
}
