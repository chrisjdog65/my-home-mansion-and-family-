// ───────────────────────────────────────────────────────────────────────────
// The guest house and its four-bay garage, off the mansion's north-east
// corner, facing the drive.
//
//   GUEST HOUSE  x 39..52   z -38..-16   two storeys, gable roof, ridge N–S
//   GARAGE       x 30..39   z -38..-24   single storey, doors facing WEST
//
// The two share the wall at x = 39: the garage's east wall is the house's
// west wall, and a personnel door lets you walk out of a bay straight into
// the utility room.  Everything is authored as boxes and merged per material
// by the world's static batcher, exactly as the mansion is.
//
// Levels.  The ground is dead flat here, so the whole L stands on one plinth
// with its top at y = 0.15; the first floor is at 3.20 and both storeys have
// a 3 m ceiling.  A straight flight of sixteen risers connects them through a
// stairwell that is open all the way to the first-floor ceiling — the hole is
// cut out of the slab, the ceiling board and the walking surface alike, and
// the trimmer round it is the collider you stand on.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { wallWithOpenings, panelize, railing, boxMesh, planarUV } from './build.js';
import { rectSubtract } from './mansion.js';
import { groundHeight } from './terrain.js';
import {
  Kit, bed, nightstand, dresser, wardrobe, bookshelf, desk, officeChair,
  diningChair, sofa, armchair, coffeeTable, rug, tv, fireplace, counterRun,
  island, fridge, range, vanity, toilet, bathtub, shower, plant, artwork,
  sideTable, consoleTable, bench, floorLamp, lightSwitch, wallShelf,
  tallMirror, bookStack, magazines, vase, fruitBowl, photoFrame, wastebasket,
  laundryBasket, umbrellaStand, coatHooks, wallClock, curtains, hingePanel,
  cookPot, utensilCrock, mixingBowl, choppingBoard, placeSetting, servingDish,
  jug, tableLamp,
} from './furniture.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const HALF = Math.PI / 2;

// ── the plan, in world coordinates ─────────────────────────────────────────
const HX0 = 39, HX1 = 52, HZ0 = -38, HZ1 = -16;      // house, outer faces
const GX0 = 30, GX1 = 39, GZ0 = -38, GZ1 = -24;      // garage, outer faces

const TO = 0.22, TI = 0.10, TE = TO + TI;            // house wall leaves
const GO = 0.20, GI = 0.08, GE = GO + GI;            // garage wall leaves
const SKIN = 0.12;                                   // garage face of the party wall
const TP = 0.14;                                     // interior partitions

// interior faces
const IX0 = HX0 + TE, IX1 = HX1 - TE;                // 39.32 .. 51.68
const IZ0 = HZ0 + TE, IZ1 = HZ1 - TE;                // -37.68 .. -16.32
const GIX0 = GX0 + GE, GIX1 = GX1 - SKIN;            // 30.28 .. 38.88
const GIZ0 = GZ0 + GE, GIZ1 = GZ1 - GE;              // -37.72 .. -24.28

const F0 = 0.15;              // ground floor walking surface
const F1 = 3.20;              // first floor walking surface
const CH = 2.97;              // clear ceiling height (both storeys)
const C0 = F0 + CH;           // 3.12 — ground ceiling underside
const C1 = F1 + 3.00;         // 6.20 — first ceiling underside
const WTOP = 6.60;            // head of the first-storey walls
const GHEAD = 4.05;           // head of the garage walls
const GC = 3.65;              // garage ceiling underside

// roof: ridge runs north–south, so the gables face north and south
const RIDGE_X = 45.5, RIDGE_Y = 9.70;
const R_X0 = 38.5, R_X1 = 52.5, R_Z0 = -38.6, R_Z1 = -15.4;
const R_T = 0.26;
const R_DROP = (RIDGE_Y - 6.60) / (RIDGE_X - R_X0);   // 0.442857 per metre

// garage roof: lower, same idea, ridge at x 34.5
const GR_X = 34.5, GR_Y = 5.70;
const GR_X0 = 29.4, GR_X1 = 39.1, GR_Z0 = -38.6, GR_Z1 = -23.4;
const GR_T = 0.24;
const GR_DROP = (GR_Y - 4.05) / (GR_X - GR_X0);       // 0.323529

// stair: sixteen risers from 0.15 to 3.20, climbing south
const ST_N = 16, ST_RISE = (F1 - F0) / ST_N, ST_RUN = 0.27, ST_W = 1.30;
const ST_X = 46.75, ST_Z0 = -37.60;
const WELL = { x0: 45.97, x1: 47.60, z0: IZ0, z1: ST_Z0 + ST_N * ST_RUN };  // -33.28

// curtain poles hang 3.15 above the y they are given, and these ceilings are
// 3 m — so the pole is set half a metre below the floor it belongs to.
const CUR0 = F0 - 0.50, CUR1 = F1 - 0.50;

const WARM = 0xffd9a8, BRIGHT = 0xf4f8ff;

export function buildGuestHouse(world) {
  const M = world.mats;
  const B = world.static;
  const k = new Kit(world);

  const P = {
    stone: M.get('stone'),
    stucco: M.get('stucco'),
    shingle: M.get('shingle'),
    concrete: M.get('concrete'),
    polished: M.get('polishedConcrete'),
    paver: M.get('paver'),
    glass: M.get('glass'),
    oak: M.get('oakFloor'),
    tile: M.get('tile'),
    walnut: M.get('walnut'),
    steel: M.get('steel'),
    chrome: M.get('chrome'),
    black: M.get('blackMetal'),
    gold: M.get('gold'),
    brick: M.get('brick'),
    wall: M.paint(0xf2ede3, 0.66, 'ghWall'),
    wetWall: M.paint(0xe6ece9, 0.5, 'ghWetWall'),
    ceil: M.paint(0xf7f5f1, 0.92, 'ghCeil'),
    trim: M.paint(0xf7f4ee, 0.5, 'ghTrim'),
    board: M.paint(0x5f6b63, 0.7, 'ghBoard'),
    garageWall: M.paint(0xdfe0dc, 0.78, 'ghGarageWall'),
    door: M.paint(0xeae4d8, 0.45, 'ghDoorLeaf'),
    frontDoor: M.paint(0x33474a, 0.4, 'ghFrontDoor'),
    slat: M.paint(0xd7d3ca, 0.55, 'ghGarageDoor'),
  };

  const GY = groundHeight(45.5, -27);          // the pad is level; ~0

  // ── 1. plinth, slabs and floor finishes ──────────────────────────────────
  plinth(world, k, P, GY);

  // ── 2. shell ─────────────────────────────────────────────────────────────
  const win = [];                              // every pane, for glazing + curtains
  houseGroundShell(world, k, P, win);
  houseFirstShell(world, k, P, win);
  garageShell(world, k, P, win);
  for (const g of win) glaze(world, k, P, g);

  // ── 3. partitions ────────────────────────────────────────────────────────
  partitions(world, k, P);

  // ── 4. floors above, ceilings, roof ──────────────────────────────────────
  upperStructure(world, k, P);
  roofs(world, k, P);

  // ── 5. the stair ─────────────────────────────────────────────────────────
  stairFlight(world, k, P);

  // ── 6. rooms, then lights, then the furniture ────────────────────────────
  const R = registerRooms(world);
  lighting(world, k, P, R);
  doors(world, k, P);
  garageDoors(world, k, P);

  dressLiving(world, k, P, R.living);
  dressDining(world, k, P, R.dining);
  dressKitchen(world, k, P, R.kitchen);
  dressHall(world, k, P, R.hall);
  dressShowerRoom(world, k, P, R.shower);
  dressUtility(world, k, P, R.utility);
  dressBedTwo(world, k, P, R.bed2);
  dressFamilyBath(world, k, P, R.bath);
  dressLanding(world, k, P, R.landing);
  dressBedOne(world, k, P, R.bed1);
  dressEnsuite(world, k, P, R.ensuite);
  dressGarage(world, k, P, R.garage);

  // ── 7. spots and navigation ──────────────────────────────────────────────
  world.spot('guestHouse', 37.4, GY, -22.0);
  world.spot('guestGarage', 34.5, F0, -30.6);
  world.spot('guestLiving', 45.5, F0, -19.6);
  world.spot('guestBed', 42.5, F1, -22.4);

  navigation(world, GY);
  return world;
}

// ───────────────────────────────────────────────────────────────────────────
// Wall construction.
//
// Every wall is authored as a run between two coordinates with its openings
// given in world space; `runX` lies along X (rotY 0), `runZ` along Z (rotY
// π/2).  Both draw the visible leaf and, when asked, register the collider
// panels that `panelize` works out for the same set of holes — so a doorway
// is a hole in the collision mesh, not just in the picture.
// ───────────────────────────────────────────────────────────────────────────
function localOpenings(openings, centre, alongZ) {
  return openings.map((o) => ({
    x: alongZ ? centre - o.at : o.at - centre,
    w: o.w, y0: o.y0, y1: o.y1,
  }));
}

function wallCols(world, cx, cz, len, h, t, ops, rotY, baseY) {
  for (const [a0, a1, y0, y1] of panelize(len, h, ops)) {
    if (a1 - a0 < 0.04 || y1 - y0 < 0.04) continue;
    const lx = (a0 + a1) / 2;
    world.collider(a1 - a0, y1 - y0, t,
      cx + Math.cos(rotY) * lx, baseY + (y0 + y1) / 2, cz - Math.sin(rotY) * lx, rotY);
  }
}

/** Wall lying along X at z = pos, spanning x0..x1. */
function runX(world, k, pos, x0, x1, baseY, h, t, mat, openings = [], o = {}) {
  const cx = (x0 + x1) / 2, len = x1 - x0;
  const ops = localOpenings(openings, cx, false);
  wallWithOpenings(k.B, mat, cx, pos, len, h, t, ops, 0, o.tile ?? 2.2, baseY);
  if (o.col !== false) wallCols(world, cx, pos, len, h, o.colT ?? t, ops, 0, baseY);
}

/** Wall lying along Z at x = pos, spanning z0..z1. */
function runZ(world, k, pos, z0, z1, baseY, h, t, mat, openings = [], o = {}) {
  const cz = (z0 + z1) / 2, len = z1 - z0;
  const ops = localOpenings(openings, cz, true);
  wallWithOpenings(k.B, mat, pos, cz, len, h, t, ops, HALF, o.tile ?? 2.2, baseY);
  if (o.col !== false) wallCols(world, pos, cz, len, h, o.colT ?? t, ops, HALF, baseY);
}

/** Baseboard and cornice along a run, stopping short of every doorway. */
function trimRun(k, mat, alongZ, pos, a0, a1, y, th, td, openings) {
  const cuts = openings
    .filter((o) => (o.y0 ?? 0) < y - (y > 2 ? 99 : 0) || true)
    .map((o) => [o.at - o.w / 2, o.at + o.w / 2]);
  const spans = [];
  let cur = a0;
  for (const [b0, b1] of cuts.sort((p, q) => p[0] - q[0])) {
    if (b0 > cur + 0.05) spans.push([cur, b0]);
    cur = Math.max(cur, b1);
  }
  if (cur < a1 - 0.05) spans.push([cur, a1]);
  for (const [s0, s1] of spans) {
    const c = (s0 + s1) / 2, l = s1 - s0;
    if (alongZ) k.box(td, th, l, mat, pos, y, c, { tile: 0.6 });
    else k.box(l, th, td, mat, c, y, pos, { tile: 0.6 });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Plinth, slabs, floor finishes.
// ───────────────────────────────────────────────────────────────────────────
function plinth(world, k, P, GY) {
  const houseOut = { x0: HX0 - 0.35, x1: HX1 + 0.35, z0: HZ0 - 0.35, z1: HZ1 + 0.35 };
  const garOut = { x0: GX0 - 0.35, x1: GX1 + 0.35, z0: GZ0 - 0.35, z1: GZ1 + 0.35 };
  const houseIn = { x0: IX0, x1: IX1, z0: IZ0, z1: IZ1 };
  const garIn = { x0: GIX0, x1: GIX1, z0: GIZ0, z1: GIZ1 };

  // the exposed base course is the ring outside the finished floor; the top
  // is the walking surface, so it abuts the finish instead of overlapping it
  for (const r of [...rectSubtract(houseOut, [houseIn]), ...rectSubtract(garOut, [garIn])]) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const x = (r.x0 + r.x1) / 2, z = (r.z0 + r.z1) / 2;
    k.box(w, 0.55, d, P.stone, x, GY - 0.125, z, { tile: 1.2 });
    world.collider(w, 0.55, d, x, GY - 0.125, z);
  }
  // structural slab under both interiors, its top hidden by the finish
  for (const r of [houseIn, garIn]) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const x = (r.x0 + r.x1) / 2, z = (r.z0 + r.z1) / 2;
    k.box(w, 0.50, d, P.concrete, x, GY - 0.15, z, { tile: 2.4 });
    world.collider(w, 0.55, d, x, GY - 0.125, z);
  }

  // ground floor finishes — 0.10 to 0.15, so the top is the walking surface
  const fin = (mat, x0, x1, z0, z1, tile) =>
    k.box(x1 - x0, 0.05, z1 - z0, mat, (x0 + x1) / 2, F0 - 0.025, (z0 + z1) / 2, { tile });
  fin(P.tile, IX0, 45.83, IZ0, -34.20, 0.9);              // shower room
  fin(P.tile, IX0, 45.83, -34.06, -31.13, 0.9);           // utility
  fin(P.oak, 45.97, IX1, IZ0, -31.13, 1.4);               // hall
  fin(P.oak, IX0, IX1, -31.13, IZ1, 1.4);                 // kitchen / dining / living
  fin(P.polished, GIX0, GIX1, GIZ0, GIZ1, 2.4);           // garage

  // a shallow apron the cars run up, plus the pads at the two outside doors
  k.box(1.5, 0.16, 14.6, P.concrete, 29.40, GY + 0.005, -31.0, { rotZ: 0.0865, tile: 1.6 });
  for (let i = 0; i < 3; i++) {
    const cx = 28.90 + i * 0.5, top = GY + 0.041 + i * 0.0435;
    world.collider(0.5, 0.30, 14.6, cx, top - 0.15, -31.0);
  }
  step(world, k, P, 38.00, GY, -22.0, 1.5, 2.6);          // front door
  step(world, k, P, 53.95, GY, -19.6, 3.2, 4.4);          // french doors / terrace
  step(world, k, P, 36.50, GY, -23.05, 1.7, 1.2);         // garage side door
  // a short paved walk out towards the forecourt
  k.box(4.4, 0.22, 1.8, P.paver, 35.45, GY - 0.10, -22.0, { tile: 1.2 });
  world.collider(4.4, 0.24, 1.8, 35.45, GY - 0.11, -22.0);
  k.box(1.6, 0.22, 1.9, P.paver, 36.50, GY - 0.10, -22.85, { tile: 1.2 });
  world.collider(1.6, 0.24, 1.9, 36.50, GY - 0.11, -22.85);
}

function step(world, k, P, x, gy, z, w, d) {
  k.box(w, 0.30, d, P.paver, x, gy - 0.07, z, { tile: 1.0 });
  world.collider(w, 0.30, d, x, gy - 0.07, z);
}

// ───────────────────────────────────────────────────────────────────────────
// The house shell.  Each elevation is an outer leaf of stone (ground) or
// stucco (first), an inner leaf of paint, one collider through the pair, and
// a cill band at the storey head.  Openings are collected into `win` so the
// glazing pass can put a real frame and pane in every hole.
// ───────────────────────────────────────────────────────────────────────────
function houseGroundShell(world, k, P, win) {
  const y = F0, h = F1 - F0;                    // 0.15 → 3.20
  const sill = 0.90, head = 2.45;

  const N = [
    { at: 42.0, w: 0.9, y0: 1.45, y1: head },          // shower room, high & obscure
    { at: 49.6, w: 1.6, y0: sill, y1: head },          // hall
  ];
  const S = [
    { at: 41.8, w: 1.9, y0: sill, y1: head },
    { at: 49.2, w: 1.9, y0: sill, y1: head },
  ];
  const E = [
    { at: -34.5, w: 1.2, y0: sill, y1: head },         // hall
    { at: -28.8, w: 1.8, y0: sill, y1: head },         // kitchen
    { at: -25.2, w: 1.8, y0: sill, y1: head },         // dining
    { at: -22.2, w: 1.4, y0: sill, y1: head },         // living
    { at: -19.6, w: 2.40, y0: 0, y1: 2.55, door: 'french' },
  ];
  const W = [
    { at: -32.6, w: 1.10, y0: 0, y1: 2.30, door: 'inner' },   // through to the garage
    { at: -22.0, w: 1.30, y0: 0, y1: 2.40, door: 'front' },
    { at: -18.6, w: 1.6, y0: sill, y1: head },
  ];

  // north
  runX(world, k, HZ0 + TO / 2, HX0, HX1, y, h, TO, P.stone, N, { col: false, tile: 2.6 });
  runX(world, k, HZ0 + TO + TI / 2, HX0, HX1, y, h, TI, P.wall, N, { col: false });
  runX(world, k, HZ0 + TE / 2, HX0, HX1, y, h, TE + 0.02, P.wall, N, { tile: 2.2, colT: TE + 0.02 });
  // south
  runX(world, k, HZ1 - TO / 2, HX0, HX1, y, h, TO, P.stone, S, { col: false, tile: 2.6 });
  runX(world, k, HZ1 - TO - TI / 2, HX0, HX1, y, h, TI, P.wall, S, { col: false });
  wallCols(world, (HX0 + HX1) / 2, HZ1 - TE / 2, HX1 - HX0, h, TE + 0.02,
    localOpenings(S, (HX0 + HX1) / 2, false), 0, y);
  // east
  runZ(world, k, HX1 - TO / 2, HZ0, HZ1, y, h, TO, P.stone, E, { col: false, tile: 2.6 });
  runZ(world, k, HX1 - TO - TI / 2, HZ0, HZ1, y, h, TI, P.wall, E, { col: false });
  wallCols(world, HX1 - TE / 2, (HZ0 + HZ1) / 2, HZ1 - HZ0, h, TE + 0.02,
    localOpenings(E, (HZ0 + HZ1) / 2, true), HALF, y);
  // west (the stretch from z -38 to -24 is the party wall with the garage)
  runZ(world, k, HX0 + TO / 2, HZ0, HZ1, y, h, TO, P.stone, W, { col: false, tile: 2.6 });
  runZ(world, k, HX0 + TO + TI / 2, HZ0, HZ1, y, h, TI, P.wall, W, { col: false });
  wallCols(world, HX0 + TE / 2, (HZ0 + HZ1) / 2, HZ1 - HZ0, h, TE + 0.02,
    localOpenings(W, (HZ0 + HZ1) / 2, true), HALF, y);
  // the garage's face of that wall gets its own painted skin
  runZ(world, k, GX1 - SKIN / 2, GZ0, GZ1, y, h, SKIN, P.garageWall,
    [{ at: -32.6, w: 1.10, y0: 0, y1: 2.30 }], { col: false });

  push(win, N, HZ0 + TE / 2, 0, y, 'n');
  push(win, S, HZ1 - TE / 2, 0, y, 's');
  push(win, E, HX1 - TE / 2, HALF, y, 'e');
  push(win, W, HX0 + TE / 2, HALF, y, 'w');

  // baseboard and cornice on the inner faces
  const bs = P.trim;
  trimRun(k, bs, false, HZ0 + TE + 0.02, IX0, IX1, y + 0.07, 0.14, TI + 0.04, N);
  trimRun(k, bs, false, HZ1 - TE - 0.02, IX0, IX1, y + 0.07, 0.14, TI + 0.04, S);
  trimRun(k, bs, true, HX1 - TE - 0.02, HZ0 + TE, HZ1 - TE, y + 0.07, 0.14, TI + 0.04, E);
  trimRun(k, bs, true, HX0 + TE + 0.02, HZ0 + TE, HZ1 - TE, y + 0.07, 0.14, TI + 0.04, W);
  k.box(IX1 - IX0, 0.09, 0.10, bs, 45.5, C0 - 0.05, IZ0 + 0.05, { tile: 0.6 });
  k.box(IX1 - IX0, 0.09, 0.10, bs, 45.5, C0 - 0.05, IZ1 - 0.05, { tile: 0.6 });
  k.box(0.10, 0.09, IZ1 - IZ0, bs, IX0 + 0.05, C0 - 0.05, -27.0, { tile: 0.6 });
  k.box(0.10, 0.09, IZ1 - IZ0, bs, IX1 - 0.05, C0 - 0.05, -27.0, { tile: 0.6 });

  // storey band, wrapped right round the outside
  for (const [px, pz, w, d] of [
    [45.5, HZ0 - 0.06, HX1 - HX0 + 0.5, 0.36],
    [45.5, HZ1 + 0.06, HX1 - HX0 + 0.5, 0.36],
    [HX0 - 0.06, -27.0, 0.36, HZ1 - HZ0 + 0.5],
    [HX1 + 0.06, -27.0, 0.36, HZ1 - HZ0 + 0.5],
  ]) k.box(w, 0.20, d, P.trim, px, F1 - 0.02, pz, { tile: 1.0 });
}

function houseFirstShell(world, k, P, win) {
  const y = F1, h = WTOP - F1;                    // 3.20 → 6.60
  const sill = 0.85, head = 2.55;
  const hi = 1.30;                               // over the garage roof

  const N = [
    { at: 41.2, w: 1.5, y0: sill, y1: head },
    { at: 44.0, w: 1.3, y0: sill, y1: head },
    { at: 46.7, w: 1.2, y0: sill, y1: head },     // down onto the stair
    { at: 49.8, w: 1.4, y0: sill, y1: head },
  ];
  const S = [
    { at: 41.4, w: 1.7, y0: sill, y1: head },
    { at: 43.7, w: 1.3, y0: sill, y1: head },
    { at: 49.9, w: 0.9, y0: sill, y1: head },     // ensuite
  ];
  const E = [
    { at: -35.0, w: 1.4, y0: sill, y1: head },
    { at: -29.0, w: 1.4, y0: sill, y1: head },
    { at: -23.4, w: 1.4, y0: sill, y1: head },
    { at: -19.0, w: 1.0, y0: sill, y1: head },
  ];
  const W = [
    { at: -34.5, w: 1.2, y0: hi, y1: head },      // clears the garage roof
    { at: -28.4, w: 1.2, y0: hi, y1: head },
    { at: -22.5, w: 1.4, y0: sill, y1: head },
    { at: -18.6, w: 1.6, y0: sill, y1: head },
  ];

  runX(world, k, HZ0 + TO / 2, HX0, HX1, y, h, TO, P.stucco, N, { col: false, tile: 2.6 });
  runX(world, k, HZ0 + TO + TI / 2, HX0, HX1, y, h, TI, P.wall, N, { col: false });
  runX(world, k, HZ0 + TE / 2, HX0, HX1, y, h, TE + 0.02, P.wall, N, { tile: 2.2 });

  runX(world, k, HZ1 - TO / 2, HX0, HX1, y, h, TO, P.stucco, S, { col: false, tile: 2.6 });
  runX(world, k, HZ1 - TO - TI / 2, HX0, HX1, y, h, TI, P.wall, S, { col: false });
  wallCols(world, 45.5, HZ1 - TE / 2, HX1 - HX0, h, TE + 0.02,
    localOpenings(S, 45.5, false), 0, y);

  runZ(world, k, HX1 - TO / 2, HZ0, HZ1, y, h, TO, P.stucco, E, { col: false, tile: 2.6 });
  runZ(world, k, HX1 - TO - TI / 2, HZ0, HZ1, y, h, TI, P.wall, E, { col: false });
  wallCols(world, HX1 - TE / 2, -27.0, HZ1 - HZ0, h, TE + 0.02,
    localOpenings(E, -27.0, true), HALF, y);

  runZ(world, k, HX0 + TO / 2, HZ0, HZ1, y, h, TO, P.stucco, W, { col: false, tile: 2.6 });
  runZ(world, k, HX0 + TO + TI / 2, HZ0, HZ1, y, h, TI, P.wall, W, { col: false });
  wallCols(world, HX0 + TE / 2, -27.0, HZ1 - HZ0, h, TE + 0.02,
    localOpenings(W, -27.0, true), HALF, y);

  push(win, N, HZ0 + TE / 2, 0, y, 'n');
  push(win, S, HZ1 - TE / 2, 0, y, 's');
  push(win, E, HX1 - TE / 2, HALF, y, 'e');
  push(win, W, HX0 + TE / 2, HALF, y, 'w');

  const bs = P.trim;
  trimRun(k, bs, false, HZ0 + TE + 0.02, IX0, IX1, y + 0.07, 0.14, TI + 0.04, N);
  trimRun(k, bs, false, HZ1 - TE - 0.02, IX0, IX1, y + 0.07, 0.14, TI + 0.04, S);
  trimRun(k, bs, true, HX1 - TE - 0.02, IZ0, IZ1, y + 0.07, 0.14, TI + 0.04, E);
  trimRun(k, bs, true, HX0 + TE + 0.02, IZ0, IZ1, y + 0.07, 0.14, TI + 0.04, W);
  k.box(IX1 - IX0, 0.09, 0.10, bs, 45.5, C1 - 0.05, IZ0 + 0.05, { tile: 0.6 });
  k.box(IX1 - IX0, 0.09, 0.10, bs, 45.5, C1 - 0.05, IZ1 - 0.05, { tile: 0.6 });
  k.box(0.10, 0.09, IZ1 - IZ0, bs, IX0 + 0.05, C1 - 0.05, -27.0, { tile: 0.6 });
  k.box(0.10, 0.09, IZ1 - IZ0, bs, IX1 - 0.05, C1 - 0.05, -27.0, { tile: 0.6 });
}

function push(win, list, pos, rotY, baseY, side) {
  for (const o of list) {
    if (o.door) continue;
    win.push({ ...o, pos, rotY, baseY, side });
  }
}

/**
 * A pane in a hole: glass (solid, like every other window in this world), a
 * frame with a mullion and a transom, a lined reveal and a stone cill outside.
 */
function glaze(world, k, P, g) {
  const gh = g.y1 - g.y0, y = g.baseY + (g.y0 + g.y1) / 2;
  const cs = Math.cos(g.rotY), sn = Math.sin(g.rotY);
  const alongZ = g.rotY !== 0;
  const px = alongZ ? g.pos : g.at;
  const pz = alongZ ? g.at : g.pos;
  const nx = g.side === 'w' ? -1 : g.side === 'e' ? 1 : 0;
  const nz = g.side === 'n' ? -1 : g.side === 's' ? 1 : 0;
  const off = (d) => [px + cs * d, pz - sn * d];   // slide along the wall

  k.box(g.w - 0.10, gh - 0.10, 0.03, P.glass, px, y, pz, { rotY: g.rotY, tile: 1 });
  world.collider(g.w, gh, 0.10, px, y, pz, g.rotY);

  k.box(g.w, 0.09, 0.22, P.trim, px, g.baseY + g.y0 + 0.045, pz, { rotY: g.rotY, tile: 1 });
  k.box(g.w, 0.09, 0.22, P.trim, px, g.baseY + g.y1 - 0.045, pz, { rotY: g.rotY, tile: 1 });
  for (const s of [-1, 1]) {
    const [jx, jz] = off(s * (g.w / 2 - 0.045));
    k.box(0.09, gh, 0.22, P.trim, jx, y, jz, { rotY: g.rotY, tile: 1 });
  }
  k.box(0.06, gh - 0.16, 0.15, P.trim, px, y, pz, { rotY: g.rotY, tile: 1 });          // mullion
  k.box(g.w - 0.16, 0.05, 0.15, P.trim, px, g.baseY + g.y0 + gh * 0.62, pz, { rotY: g.rotY, tile: 1 });
  // outside cill and a shallow head drip
  k.box(g.w + 0.32, 0.08, 0.46, P.stone,
    px + nx * 0.16, g.baseY + g.y0 - 0.03, pz + nz * 0.16, { rotY: g.rotY, tile: 0.8 });
  k.box(g.w + 0.32, 0.08, 0.40, P.stone,
    px + nx * 0.13, g.baseY + g.y1 + 0.05, pz + nz * 0.13, { rotY: g.rotY, tile: 0.8 });
  // inside cill board
  k.box(g.w + 0.18, 0.05, 0.24, P.trim,
    px - nx * 0.14, g.baseY + g.y0 - 0.02, pz - nz * 0.14, { rotY: g.rotY, tile: 0.6 });
}

// ───────────────────────────────────────────────────────────────────────────
// Interior partitions.  All of them are one 0.14 leaf carrying paint on both
// faces; the wet rooms get a tiled dado over the top of it.
// ───────────────────────────────────────────────────────────────────────────
function partitions(world, k, P) {
  const gh = F1 - F0, fh = WTOP - F1;
  const D = (at, w = 1.10, y1 = 2.30) => ({ at, w, y0: 0, y1 });

  // ── ground ──
  // hall's west wall: shower room and utility open off it, and it is what the
  // first-floor bedroom wall stands on
  runZ(world, k, 45.90, IZ0, -31.13, F0, gh, TP, P.wall, [D(-35.9), D(-32.6)]);
  runX(world, k, -34.13, IX0, 45.83, F0, gh, TP, P.wall, []);            // shower / utility
  runX(world, k, -31.20, IX0, IX1, F0, gh, TP, P.wall,
    [{ at: 49.0, w: 2.40, y0: 0, y1: 2.60 }]);                           // north block / open plan

  // ── first ──
  runZ(world, k, 45.90, IZ0, -25.60, F1, fh, TP, P.wall, [D(-32.4), D(-28.5)]);
  runX(world, k, -31.20, IX0, 45.83, F1, fh, TP, P.wall, []);            // bed 2 / bathroom
  runX(world, k, -25.67, IX0, IX1, F1, fh, TP, P.wall, [D(48.8)]);       // landing / bed 1
  runZ(world, k, 47.40, -21.50, IZ1, F1, fh, TP, P.wall, []);            // ensuite west
  runX(world, k, -21.43, 47.33, IX1, F1, fh, TP, P.wall, [D(48.4)]);     // ensuite north

  // door casings, so every opening reads as joinery rather than a hole
  const case1 = (alongZ, pos, at, w, h) => {
    for (const s of [-1, 1]) {
      if (alongZ) k.box(TP + 0.06, h + 0.08, 0.09, P.trim, pos, F0 + (h + 0.08) / 2, at + s * (w / 2 + 0.045), { tile: 0.5 });
      else k.box(0.09, h + 0.08, TP + 0.06, P.trim, at + s * (w / 2 + 0.045), F0 + (h + 0.08) / 2, pos, { tile: 0.5 });
    }
    if (alongZ) k.box(TP + 0.06, 0.09, w + 0.18, P.trim, pos, F0 + h + 0.045, at, { tile: 0.5 });
    else k.box(w + 0.18, 0.09, TP + 0.06, P.trim, at, F0 + h + 0.045, pos, { tile: 0.5 });
  };
  case1(true, 45.90, -35.9, 1.10, 2.30);
  case1(true, 45.90, -32.6, 1.10, 2.30);
  case1(false, -31.20, 49.0, 2.40, 2.60);

  // wet-room dados
  const dado = (x0, x1, z0, z1, y) => {
    k.box(x1 - x0, 1.30, 0.02, P.tile, (x0 + x1) / 2, y + 0.80, z0 + 0.02, { tile: 0.8 });
    k.box(x1 - x0, 1.30, 0.02, P.tile, (x0 + x1) / 2, y + 0.80, z1 - 0.02, { tile: 0.8 });
    k.box(0.02, 1.30, z1 - z0, P.tile, x0 + 0.02, y + 0.80, (z0 + z1) / 2, { tile: 0.8 });
    k.box(0.02, 1.30, z1 - z0, P.tile, x1 - 0.02, y + 0.80, (z0 + z1) / 2, { tile: 0.8 });
  };
  dado(IX0, 45.83, IZ0, -34.20, F0);          // shower room
  dado(IX0, 45.83, -31.13, -25.74, F1);       // family bathroom
  dado(47.47, IX1, -21.36, IZ1, F1);          // ensuite
}

// ───────────────────────────────────────────────────────────────────────────
// The floor between the storeys, the two ceilings, and the trimmer round the
// stairwell.  The well is subtracted from the slab, the finish AND the ground
// ceiling — floor one of them over and you have a stair into a lid.
// ───────────────────────────────────────────────────────────────────────────
function upperStructure(world, k, P) {
  const shell = { x0: IX0, x1: IX1, z0: IZ0, z1: IZ1 };
  const holes = [WELL];

  for (const r of rectSubtract(shell, holes)) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const x = (r.x0 + r.x1) / 2, z = (r.z0 + r.z1) / 2;
    world.collider(w, 0.30, d, x, F1 - 0.15, z);                      // the slab you stand on
    k.box(w, 0.03, d, P.ceil, x, C0 - 0.015, z, { tile: 2.0 });       // seen from below
  }
  // finishes on the first floor
  const fin = (mat, x0, x1, z0, z1, tile) => {
    for (const r of rectSubtract({ x0, x1, z0, z1 }, holes)) {
      k.box(r.x1 - r.x0, 0.05, r.z1 - r.z0, mat,
        (r.x0 + r.x1) / 2, F1 - 0.025, (r.z0 + r.z1) / 2, { tile });
    }
  };
  fin(P.oak, IX0, 45.83, IZ0, -31.27, 1.4);            // bedroom two
  fin(P.tile, IX0, 45.83, -31.13, -25.74, 0.9);        // family bathroom
  fin(P.oak, 45.97, IX1, IZ0, -25.74, 1.4);            // landing
  fin(P.oak, IX0, IX1, -25.60, IZ1, 1.4);              // bedroom one
  fin(P.tile, 47.47, IX1, -21.36, IZ1, 0.9);           // ensuite (over the oak)

  // trimmer boards round the well — they are exactly the depth of the slab,
  // so the edge you can see is the edge you walk on
  const t = 0.05, hw = WELL.x1 - WELL.x0, hd = WELL.z1 - WELL.z0;
  const hx = (WELL.x0 + WELL.x1) / 2, hz = (WELL.z0 + WELL.z1) / 2;
  k.box(hw, 0.30, t, P.trim, hx, F1 - 0.15, WELL.z1 - t / 2, { tile: 0.8 });
  k.box(t, 0.30, hd, P.trim, WELL.x0 + t / 2, F1 - 0.15, hz, { tile: 0.8 });
  k.box(t, 0.30, hd, P.trim, WELL.x1 - t / 2, F1 - 0.15, hz, { tile: 0.8 });

  // first-floor ceiling — unbroken, the stairwell included
  k.box(IX1 - IX0, 0.05, IZ1 - IZ0, P.ceil, 45.5, C1 + 0.025, -27.0, { tile: 2.0 });
  world.collider(IX1 - IX0, 0.14, IZ1 - IZ0, 45.5, C1 + 0.07, -27.0);

  // garage ceiling
  k.box(GIX1 - GIX0, 0.05, GIZ1 - GIZ0, P.ceil, (GIX0 + GIX1) / 2, GC + 0.025, (GIZ0 + GIZ1) / 2, { tile: 2.0 });
  world.collider(GIX1 - GIX0, 0.14, GIZ1 - GIZ0, (GIX0 + GIX1) / 2, GC + 0.07, (GIZ0 + GIZ1) / 2);
}

// ───────────────────────────────────────────────────────────────────────────
// Roofs.
//
// Two pitched slabs per building, fascia and boarded soffit at the eaves, and
// — the part that matters — a closed gable at each end.  An open gable shows
// the sky from inside the bedroom, which is exactly the bug that was just
// fixed on the shed, so the ends are filled with an extruded polygon cut to
// the roof's own underside rather than a triangle guessed at.
// ───────────────────────────────────────────────────────────────────────────
function roofs(world, k, P) {
  pitched(world, k, P, {
    rx: RIDGE_X, ry: RIDGE_Y, x0: R_X0, x1: R_X1, z0: R_Z0, z1: R_Z1,
    thick: R_T, drop: R_DROP, wallX0: HX0, wallX1: HX1,
    gables: [{ z: HZ0 - 0.20, d: 0.34 }, { z: HZ1 - 0.14, d: 0.34 }],
    gableHalf: 6.65, gableBase: 6.30, gableMat: P.stucco,
  });
  pitched(world, k, P, {
    rx: GR_X, ry: GR_Y, x0: GR_X0, x1: GR_X1, z0: GR_Z0, z1: GR_Z1,
    thick: GR_T, drop: GR_DROP, wallX0: GX0, wallX1: GX1, eastEave: false,
    gables: [{ z: GZ0 - 0.20, d: 0.34 }, { z: GZ1 - 0.14, d: 0.34 }],
    gableHalf: 4.65, gableBase: 3.85, gableMat: P.stucco,
  });

  // chimney: an external stack on the house's south gable, serving the living
  // room fire below it
  k.box(1.40, 10.8, 0.80, P.brick, 45.5, 5.45, -15.80, { tile: 1.2 });
  k.box(1.66, 0.26, 1.06, P.stone, 45.5, 10.96, -15.80, { tile: 0.8 });
  for (const s of [-1, 1]) k.box(0.26, 0.44, 0.26, P.stone, 45.5 + s * 0.42, 11.3, -15.80, { tile: 0.4 });
  world.collider(1.40, 10.8, 0.80, 45.5, 5.45, -15.80);
}

function pitched(world, k, P, o) {
  const shingle = P.shingle;
  const lenZ = o.z1 - o.z0, cz = (o.z0 + o.z1) / 2;
  const vt = o.thick / Math.cos(Math.atan(o.drop));     // vertical thickness

  const sides = [{ s: -1, edge: o.x0 }, { s: 1, edge: o.x1 }];
  for (const { s, edge } of sides) {
    const run = Math.abs(edge - o.rx);
    const slope = Math.atan(o.drop);
    const rake = Math.hypot(run, o.drop * run);
    const cxp = (o.rx + edge) / 2;
    const cyp = o.ry - (o.drop * run) / 2;
    k.box(rake, o.thick, lenZ, shingle, cxp, cyp, cz, { rotZ: s * slope, tile: 1.4 });

    // stepped colliders, four bands across the slope
    for (let i = 0; i < 4; i++) {
      const a = o.rx + s * (run * i) / 4, b = o.rx + s * (run * (i + 1)) / 4;
      const x0 = Math.min(a, b), x1 = Math.max(a, b);
      const ym = o.ry - o.drop * Math.abs((x0 + x1) / 2 - o.rx);
      world.collider(x1 - x0, 0.30, lenZ, (x0 + x1) / 2, ym - 0.15, cz);
    }

    // eaves: only where the roof really overhangs (the garage dies into the
    // house wall on its east side and gets no fascia there)
    const overhangs = s < 0 ? true : (o.eastEave !== false);
    if (!overhangs) continue;
    const wallFace = s < 0 ? o.wallX0 : o.wallX1;
    const uMid = Math.abs(edge - o.rx) - 0.4;
    const xMid = o.rx + s * uMid;
    const yMid = o.ry - o.drop * uMid - vt / 2;
    const dn = 0.20;
    k.box(1.2, 0.05, lenZ, P.board,
      xMid + s * dn * Math.sin(slope), yMid - dn * Math.cos(slope), cz,
      { rotZ: s * slope, tile: 0.8 });
    const fx = edge + s * 0.06;
    const fTop = o.ry - o.drop * Math.abs(fx - o.rx);
    k.box(0.07, 0.34, lenZ, P.board, fx, fTop - 0.15, cz, { tile: 0.7 });
    void wallFace;
  }

  // closed gable ends
  for (const g of o.gables) {
    const shape = new THREE.Shape();
    const hw = o.gableHalf;
    const v = (u) => (o.ry - o.drop * Math.abs(u) - vt) - o.gableBase;
    shape.moveTo(-hw, 0);
    shape.lineTo(hw, 0);
    shape.lineTo(hw, Math.max(0.02, v(hw)));
    shape.lineTo(0, v(0));
    shape.lineTo(-hw, Math.max(0.02, v(-hw)));
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: g.d, bevelEnabled: false });
    planarUV(geo, 2.2);
    const m = new THREE.Mesh(geo, o.gableMat);
    m.position.set(o.rx, o.gableBase, g.z);
    m.castShadow = m.receiveShadow = true;
    world.staticRoot.add(m);
    // barge board along the rake, and a collider so the end is solid
    world.collider(hw * 2, v(0) - 0.1, g.d + 0.08, o.rx, o.gableBase + (v(0) - 0.1) / 2 + 0.05, g.z + g.d / 2);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// The stair.  Solid stepped colliders under real joinery: tread, riser, two
// stringers, a soffit board, balusters and a raking handrail on the open
// side.  The wall side needs none — it is the bedroom partition.
// ───────────────────────────────────────────────────────────────────────────
function stairFlight(world, k, P) {
  const tread = P.walnut;
  const riser = k.M.paint(0xf1ead9, 0.6, 'ghRiser');
  const soffit = P.ceil;
  const post = P.black, rail = P.gold;

  for (let i = 0; i < ST_N; i++) {
    const h = (i + 1) * ST_RISE;
    const z = ST_Z0 + (i + 0.5) * ST_RUN;
    world.collider(ST_W, h, ST_RUN, ST_X, F0 + h / 2, z);
    k.box(ST_W, 0.05, ST_RUN + 0.035, tread, ST_X, F0 + h - 0.025, z - 0.018, { tile: 1.1 });
    k.box(ST_W, ST_RISE - 0.05, 0.04, riser, ST_X,
      F0 + i * ST_RISE + (ST_RISE - 0.05) / 2, ST_Z0 + i * ST_RUN + 0.02, { tile: 1 });
  }

  const climb = ST_N * ST_RISE, reach = ST_N * ST_RUN;
  const slope = Math.atan2(climb, reach), rakeLen = Math.hypot(climb, reach);
  const rake = (w, th, ox, drop, mat) => {
    const d = drop + th / 2;
    k.box(w, th, rakeLen + 0.12, mat,
      ST_X + ox, F0 + climb / 2 - d * Math.cos(slope), ST_Z0 + reach / 2 + d * Math.sin(slope),
      { rotX: -slope, tile: 1 });
  };
  for (const s of [-1, 1]) rake(0.07, 0.30, s * (ST_W / 2 + 0.035), 0.02, tread);
  rake(ST_W + 0.06, 0.06, 0, 0.32, soffit);

  // balustrade on the open (east) side of the flight
  const bx = ST_X + ST_W / 2 + 0.035;
  for (let i = 0; i < ST_N; i += 2) {
    const h = (i + 1) * ST_RISE;
    k.box(0.05, 0.98, 0.05, post, bx, F0 + h + 0.49, ST_Z0 + (i + 0.5) * ST_RUN, { tile: 0.4 });
  }
  k.box(0.09, 0.09, rakeLen, rail, bx, F0 + climb / 2 + 1.0, ST_Z0 + reach / 2,
    { rotX: -slope, tile: 0.5 });
  for (const [nz, ny] of [[ST_Z0 - 0.10, 0], [ST_Z0 + reach + 0.10, climb]]) {
    k.box(0.14, 1.12, 0.14, post, bx, F0 + ny + 0.56, nz, { tile: 0.4 });
    k.box(0.18, 0.09, 0.18, rail, bx, F0 + ny + 1.16, nz, { tile: 0.4 });
  }
  // step lights let into the stringer, because the well only has one window
  for (let i = 2; i < ST_N; i += 5) {
    const z = ST_Z0 + (i + 0.5) * ST_RUN, y = F0 + (i + 1) * ST_RISE + 0.13;
    k.box(0.03, 0.07, 0.16, k.M.emissive(WARM, 1.5), bx + 0.04, y, z, { tile: 0.2 });
    world.addLight({ pos: V(bx + 0.38, y + 0.05, z), color: 0xffd0a0, intensity: 0.45, decay: 2, distance: 2.9 });
  }

  // guard rails round the void on the landing
  railing(world, post, rail, WELL.x1, F1, (WELL.z0 + WELL.z1) / 2, WELL.z1 - WELL.z0, HALF, 1.05, 0.85);
  railing(world, post, rail, (WELL.x0 + WELL.x1) / 2, F1, WELL.z1, WELL.x1 - WELL.x0, 0, 1.05, 0.8);

  world.spot('guestStairBottom', ST_X, F0, ST_Z0 - 0.9);
  world.spot('guestStairTop', ST_X, F1, WELL.z1 + 0.9);
}

// ───────────────────────────────────────────────────────────────────────────
// Rooms.  Registered on their own floor keys so the mansion's corridor-spine
// navigation leaves them alone; the HUD reads floorName.
// ───────────────────────────────────────────────────────────────────────────
function room(world, name, type, x0, x1, z0, z1, y, floor, floorMat, h) {
  return world.addRoom({
    name, type, floor, floorName: 'Guest House',
    x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0,
    y, h: h ?? CH, def: { floor: floorMat },
  });
}

function registerRooms(world) {
  const G = 'guestGround', U = 'guestFirst';
  return {
    // biggest first: roomAt() prefers the smallest rectangle, so the ensuite
    // wins inside the bedroom it is carved out of
    living: room(world, 'Guest Living Room', 'family', IX0, IX1, -23.00, IZ1, F0, G, 'oakFloor'),
    dining: room(world, 'Guest Dining Room', 'dining', IX0, IX1, -27.40, -23.00, F0, G, 'oakFloor'),
    kitchen: room(world, 'Guest Kitchen', 'kitchen', IX0, IX1, -31.13, -27.40, F0, G, 'oakFloor'),
    hall: room(world, 'Guest Hall', 'stairhall', 45.97, IX1, IZ0, -31.13, F0, G, 'oakFloor'),
    shower: room(world, 'Guest Shower Room', 'bath', IX0, 45.83, IZ0, -34.20, F0, G, 'tile'),
    utility: room(world, 'Guest Utility', 'laundry', IX0, 45.83, -34.06, -31.13, F0, G, 'tile'),
    garage: room(world, 'Guest Garage', 'garage', GIX0, GIX1, GIZ0, GIZ1, F0, G, 'polishedConcrete', 3.50),
    bed1: room(world, 'Guest Bedroom One', 'bedroom', IX0, IX1, -25.60, IZ1, F1, U, 'oakFloor'),
    bed2: room(world, 'Guest Bedroom Two', 'bedroom', IX0, 45.83, IZ0, -31.27, F1, U, 'oakFloor'),
    bath: room(world, 'Guest Bathroom', 'bath', IX0, 45.83, -31.13, -25.74, F1, U, 'tile'),
    landing: room(world, 'Guest Landing', 'corridor', 45.97, IX1, IZ0, -25.74, F1, U, 'oakFloor'),
    ensuite: room(world, 'Guest Ensuite', 'bath', 47.47, IX1, -21.36, IZ1, F1, U, 'tile'),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Lighting.
//
// The calibration from the mansion: a fitting three metres up wants I ≈ 14, a
// perimeter wash 4–5, and nothing sitting on plaster may go above 1.  Every
// declared light gets a body here — the ceiling fittings are pendants or
// flush plates, the washes are recessed cans, and the garage runs strips.
// ───────────────────────────────────────────────────────────────────────────
function pendant(k, world, x, z, ceilY, o) {
  k.box(0.05, 0.34, 0.05, k.M.get('blackMetal'), x, ceilY - 0.17, z, { tile: 0.3 });
  k.box(0.34, 0.22, 0.34, k.M.get('gold'), x, ceilY - 0.45, z, { tile: 0.3 });
  k.box(0.27, 0.06, 0.27, k.M.emissive(o.glass, 1.8), x, ceilY - 0.58, z, { tile: 0.2 });
  world.addLight({
    pos: V(x, ceilY - 0.52, z), color: o.color, intensity: o.i ?? 14,
    decay: 2, distance: o.dist ?? 11, room: o.room, floor: o.floor,
  });
}

function flush(k, world, x, z, ceilY, o) {
  k.box(0.52, 0.05, 0.52, k.M.get('chrome'), x, ceilY - 0.025, z, { tile: 0.4 });
  k.box(0.44, 0.11, 0.44, k.M.emissive(o.glass, 1.6), x, ceilY - 0.085, z, { tile: 0.3 });
  world.addLight({
    pos: V(x, ceilY - 0.16, z), color: o.color, intensity: o.i ?? 13,
    decay: 2, distance: o.dist ?? 10, room: o.room, floor: o.floor,
  });
}

function strip(k, world, x, z, ceilY, o) {
  k.box(2.4, 0.09, 0.34, k.M.get('steel'), x, ceilY - 0.06, z, { tile: 1 });
  k.box(2.3, 0.06, 0.28, k.M.emissive(o.glass, 1.9), x, ceilY - 0.13, z, { tile: 1 });
  world.addLight({
    pos: V(x, ceilY - 0.22, z), color: o.color, intensity: o.i ?? 15,
    decay: 2, distance: o.dist ?? 12, room: o.room, floor: o.floor,
  });
}

/** A recessed can near a wall — the wash that keeps corners off black. */
function can(k, world, x, z, ceilY, o) {
  k.box(0.19, 0.04, 0.19, k.M.get('chrome'), x, ceilY - 0.02, z, { tile: 0.2 });
  k.box(0.14, 0.07, 0.14, k.M.emissive(o.glass, 1.5), x, ceilY - 0.06, z, { tile: 0.2 });
  world.addLight({
    pos: V(x, ceilY - 0.13, z), color: o.color, intensity: o.i ?? 4.4,
    decay: 2, distance: 7, room: o.room, floor: o.floor,
  });
}

function lighting(world, k, P, R) {
  const warm = { color: 0xffdcb4, glass: WARM };
  const bright = { color: 0xf4f8ff, glass: BRIGHT };
  const cook = { color: 0xfff2e4, glass: BRIGHT };

  const set = (R2, ceilY, fixtures, washes, kind, tone, io) => {
    const o = { ...tone, room: R2.name, floor: R2.floor, ...(io || {}) };
    for (const [x, z] of fixtures) {
      if (kind === 'flush') flush(k, world, x, z, ceilY, o);
      else if (kind === 'strip') strip(k, world, x, z, ceilY, o);
      else pendant(k, world, x, z, ceilY, o);
    }
    for (const [x, z] of washes) can(k, world, x, z, ceilY, { ...o, i: 4.4 });
  };

  // ── ground ──
  set(R.living, C0, [[43.0, -19.6], [48.6, -19.6]],
    [[40.4, -22.0], [40.4, -17.4], [50.6, -22.0], [50.6, -17.4], [45.5, -17.0]], 'flush', warm);
  set(R.dining, C0, [[45.4, -25.30]],
    [[40.5, -26.6], [40.5, -23.8], [50.5, -26.6], [50.5, -23.8]], 'pendant', warm, { i: 15, dist: 12 });
  set(R.kitchen, C0, [[42.2, -29.2], [49.4, -29.2]],
    [[40.4, -30.6], [44.8, -30.6], [50.8, -30.6], [40.6, -27.9]], 'flush', cook, { i: 15 });
  set(R.hall, C0, [[49.6, -34.4]],
    [[47.0, -32.0], [51.0, -32.0], [51.0, -36.8], [48.2, -36.9]], 'pendant', warm);
  set(R.shower, C0, [[42.6, -35.9]],
    [[40.3, -36.9], [44.6, -36.9], [40.3, -34.7], [44.6, -34.7]], 'flush', bright, { i: 12 });
  set(R.utility, C0, [[42.6, -32.6]], [[40.2, -32.6], [45.0, -32.6]], 'flush', bright, { i: 12 });
  set(R.garage, GC, [[34.0, -36.0], [34.0, -32.7], [34.0, -29.4], [34.0, -26.1]],
    [[37.9, -34.0], [37.9, -28.0], [31.4, -31.0]], 'strip', bright, { i: 16, dist: 13 });

  // ── first ──
  set(R.bed2, C1, [[42.6, -35.6], [42.6, -32.6]],
    [[40.2, -36.9], [40.2, -32.2], [44.9, -36.9], [44.6, -32.2]], 'flush', warm, { i: 13 });
  set(R.bath, C1, [[42.6, -28.4]],
    [[40.3, -30.4], [40.3, -26.5], [44.9, -30.4], [44.9, -26.5]], 'flush', bright, { i: 12 });
  set(R.landing, C1, [[49.6, -35.6], [49.6, -28.4]],
    [[47.0, -31.5], [51.1, -31.5], [51.1, -26.5], [47.0, -26.5]], 'flush', warm, { i: 13 });
  set(R.bed1, C1, [[42.5, -22.6], [48.4, -20.0]],
    [[40.2, -24.8], [40.2, -17.4], [45.0, -17.0], [46.6, -24.4]], 'flush', warm, { i: 13 });
  set(R.ensuite, C1, [[49.5, -18.9]],
    [[48.2, -20.7], [50.9, -20.7], [48.2, -17.1], [50.9, -17.1]], 'flush', bright, { i: 12 });

  // stairwell lantern: the well is two storeys tall and the landing fittings
  // sit outside it, so it hangs its own
  k.box(0.05, 1.9, 0.05, P.black, ST_X, C1 - 0.95, -35.6, { tile: 0.4 });
  k.box(0.34, 0.5, 0.34, P.gold, ST_X, C1 - 2.15, -35.6, { tile: 0.3 });
  k.box(0.26, 0.08, 0.26, k.M.emissive(WARM, 2.2), ST_X, C1 - 2.42, -35.6, { tile: 0.2 });
  world.addLight({ pos: V(ST_X, C1 - 2.5, -35.6), color: 0xffdcb4, intensity: 18, decay: 1.9, distance: 15, room: R.hall.name, floor: R.hall.floor });

  // outside: a lantern over each outside door and a pair of floods on the
  // garage, which is the face that looks at the drive
  outLamp(k, world, 38.86, F0 + 2.30, -22.0, 0.34, 0.06);
  world.addLight({ pos: V(38.3, F0 + 2.2, -22.0), color: 0xffd39a, intensity: 26, decay: 1.8, distance: 12, outdoor: true, night: true });
  outLamp(k, world, 52.14, F0 + 2.50, -19.6, 0.34, 0.06);
  world.addLight({ pos: V(52.7, F0 + 2.4, -19.6), color: 0xffd39a, intensity: 26, decay: 1.8, distance: 12, outdoor: true, night: true });
  for (const z of [-34.6, -27.4]) {
    k.box(0.30, 0.16, 0.24, P.black, GX0 - 0.16, 3.55, z, { tile: 0.3 });
    k.box(0.24, 0.10, 0.05, k.M.emissive(0xffe0b0, 2.4), GX0 - 0.30, 3.50, z, { tile: 0.2 });
    world.addLight({ pos: V(GX0 - 0.9, 3.35, z), color: 0xffd9a0, intensity: 34, decay: 1.8, distance: 15, outdoor: true, night: true });
  }
}

function outLamp(k, world, x, y, z, w, d) {
  k.box(0.06, 0.36, 0.16, k.M.get('blackMetal'), x, y + 0.20, z, { tile: 0.3 });
  k.box(w, 0.34, w, k.M.get('blackMetal'), x, y, z, { tile: 0.3 });
  k.box(w - 0.10, 0.26, w - 0.10, k.M.emissive(0xffcf8a, 2.0), x, y, z, { tile: 0.2 });
  void d;
}

// ───────────────────────────────────────────────────────────────────────────
// Doors.  Nine hinged leaves and a pair of glazed french doors, each with a
// blocker that stands in the opening while it is shut.
// ───────────────────────────────────────────────────────────────────────────
function leaf(world, k, o) {
  const part = hingePanel(k, o.x, o.y + o.h / 2 + 0.03, o.z, {
    rotY: o.rotY, w: o.w, h: o.h, side: o.side ?? -1, t: 0.05,
    face: o.face, handleMat: k.M.get('gold'), handleH: 0.26, handleY: -0.12,
    label: o.label || 'Open the door', closeLabel: 'Close the door',
    radius: o.radius ?? 2.0, swing: o.swing ?? 1.72, speed: 2.3,
  });
  world.addBlocker({
    get active() { return part.t < 0.35; },
    pos: V(o.x, o.y + o.h / 2 + 0.03, o.z),
    halfW: o.w / 2, halfH: o.h / 2, halfD: 0.08, rotY: o.rotY,
  });
  return part;
}

function doors(world, k, P) {
  const d = P.door;
  // front door, off the forecourt side
  leaf(world, k, { x: HX0 + TE / 2, y: F0, z: -22.0, w: 1.22, h: 2.32, rotY: HALF, side: -1, face: P.frontDoor, label: 'Open the front door', radius: 2.4 });
  k.box(0.34, 2.44, 0.16, P.trim, HX0 + 0.04, F0 + 1.22, -22.0 - 0.73, { tile: 0.6 });
  k.box(0.34, 2.44, 0.16, P.trim, HX0 + 0.04, F0 + 1.22, -22.0 + 0.73, { tile: 0.6 });
  k.box(0.60, 0.14, 1.90, P.board, HX0 - 0.24, F0 + 2.62, -22.0, { tile: 0.8 });   // little porch hood
  for (const s of [-1, 1]) k.box(0.44, 0.08, 0.08, P.board, HX0 - 0.18, F0 + 2.36, -22.0 + s * 0.8, { rotZ: 0.5, tile: 0.4 });

  // utility → garage, and the garage's own side door onto the path
  leaf(world, k, { x: HX0 + TE / 2, y: F0, z: -32.6, w: 1.04, h: 2.22, rotY: HALF, side: 1, face: d, label: 'Open the door to the garage' });
  leaf(world, k, { x: 36.50, y: F0, z: GZ1 - GE / 2, w: 1.04, h: 2.22, rotY: 0, side: -1, face: d, label: 'Open the garage side door' });

  // ground floor, off the hall
  leaf(world, k, { x: 45.90, y: F0, z: -35.9, w: 1.04, h: 2.22, rotY: HALF, side: -1, face: d, label: 'Open the shower room door' });
  leaf(world, k, { x: 45.90, y: F0, z: -32.6, w: 1.04, h: 2.22, rotY: HALF, side: 1, face: d, label: 'Open the utility door' });

  // first floor
  leaf(world, k, { x: 45.90, y: F1, z: -32.4, w: 1.04, h: 2.22, rotY: HALF, side: -1, face: d, label: 'Open the bedroom door' });
  leaf(world, k, { x: 45.90, y: F1, z: -28.5, w: 1.04, h: 2.22, rotY: HALF, side: 1, face: d, label: 'Open the bathroom door' });
  leaf(world, k, { x: 48.80, y: F1, z: -25.67, w: 1.04, h: 2.22, rotY: 0, side: -1, face: d, label: 'Open the bedroom door' });
  leaf(world, k, { x: 48.40, y: F1, z: -21.43, w: 1.04, h: 2.22, rotY: 0, side: 1, face: d, label: 'Open the ensuite door' });

  frenchDoors(world, k, P);
}

/** The pair onto the east lawn: rails, stiles and glass, hinged at the jambs. */
function frenchDoors(world, k, P) {
  const zc = -19.6, x = HX1 - TE / 2, W = 2.40, H = 2.55;
  for (const s of [-1, 1]) {
    const leafW = W / 2 - 0.05, leafH = H - 0.07, dir = -s;
    const pivot = new THREE.Group();
    pivot.position.set(x, F0, zc + s * (W / 2 - 0.03));
    pivot.rotation.y = HALF;
    const mid = dir * leafW / 2, top = leafH + 0.03, stile = 0.10;
    pivot.add(
      boxMesh(leafW, 0.18, 0.055, P.trim, mid, 0.12, 0, { tile: 1 }),
      boxMesh(leafW, 0.10, 0.055, P.trim, mid, top - 0.05, 0, { tile: 1 }),
      boxMesh(stile, leafH, 0.055, P.trim, dir * stile / 2, leafH / 2 + 0.03, 0, { tile: 1 }),
      boxMesh(stile, leafH, 0.055, P.trim, dir * (leafW - stile / 2), leafH / 2 + 0.03, 0, { tile: 1 }),
      boxMesh(leafW - stile * 2, 0.07, 0.06, P.trim, mid, 1.05, 0, { tile: 1 }),
      boxMesh(leafW - stile * 2, 0.05, 0.06, P.trim, mid, 1.75, 0, { tile: 1 }),
      boxMesh(leafW - stile * 2, leafH - 0.30, 0.02, P.glass, mid, leafH / 2 + 0.05, 0, { tile: 1 }),
    );
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.28, 8), P.gold);
    handle.position.set(dir * (leafW - 0.14), 1.12, 0.06);
    pivot.add(handle);
    world.addProp(pivot);

    const door = { open: false, t: 0 };
    world.onUpdate((dt) => {
      door.t += ((door.open ? 1 : 0) - door.t) * Math.min(1, dt * 2.4);
      pivot.rotation.y = HALF + door.t * 1.7 * s;
    });
    world.addBlocker({
      get active() { return door.t < 0.35; },
      pos: V(x, F0 + leafH / 2, zc + s * (W / 4)),
      halfW: leafW / 2, halfH: leafH / 2, halfD: 0.09, rotY: HALF,
    });
    world.addInteract({
      pos: V(x, F0 + 1.15, zc + s * (W / 4)), radius: 2.4,
      label: () => (door.open ? 'Close the french doors' : 'Open the french doors'),
      onUse: () => { door.open = !door.open; return door.open ? 'creak' : 'latch'; },
    });
  }
  // reveal lining + a transom light over the pair
  for (const s of [-1, 1]) k.box(0.44, H + 0.10, 0.10, P.trim, x, F0 + (H + 0.10) / 2, zc + s * (W / 2 + 0.05), { tile: 0.6 });
  k.box(0.44, 0.10, W + 0.20, P.trim, x, F0 + H + 0.05, zc, { tile: 0.6 });
}

// ───────────────────────────────────────────────────────────────────────────
// The four bay doors.
//
// Same contract as the mansion's pair — a group of slats, one updater, a
// blocker that is live while the door is down, and an interact that toggles
// it — but these run on a track: up the opening, round a quarter circle and
// back under the ceiling, so a raised door lies inside the garage instead of
// disappearing through the roof.
// ───────────────────────────────────────────────────────────────────────────
function garageDoors(world, k, P) {
  const H = 2.55, RAD = 0.40, ARC = (Math.PI * RAD) / 2;
  const plane = GIX0 + 0.04;                       // just inside the reveal
  const bays = [-35.89, -32.63, -29.37, -26.11];
  const leafW = 2.92, slats = 7, sh = H / slats, travel = H + 0.30;

  const track = (L) => {
    if (L < H - RAD) return { x: 0, y: L, a: 0 };
    if (L < H - RAD + ARC) {
      const a = (L - (H - RAD)) / RAD;
      return { x: RAD * (1 - Math.cos(a)), y: H - RAD + RAD * Math.sin(a), a };
    }
    return { x: RAD + (L - (H - RAD + ARC)), y: H, a: HALF };
  };

  // piers and the head beam that the doors hang under
  for (const z of [-37.52, -34.26, -31.00, -27.74, -24.48]) {
    k.box(0.34, H + 0.30, 0.44, P.stone, GX0 - 0.06, F0 + (H + 0.30) / 2, z, { tile: 0.8 });
    world.collider(0.34, H + 0.30, 0.44, GX0 - 0.06, F0 + (H + 0.30) / 2, z);
  }
  k.box(0.36, 0.34, GZ1 - GZ0 + 0.4, P.stone, GX0 - 0.07, F0 + H + 0.20, -31.0, { tile: 0.8 });

  for (const bz of bays) {
    const g = new THREE.Group();
    g.position.set(plane, F0, bz);
    const meshes = [];
    for (let i = 0; i < slats; i++) {
      const m = boxMesh(0.06, sh - 0.02, leafW, P.slat, 0, 0, 0, { tile: 1.1, cast: false });
      g.add(m); meshes.push(m);
    }
    const grab = boxMesh(0.05, 0.06, 0.6, k.M.get('steel'), -0.05, 0.95, 0, { cast: false });
    g.add(grab); meshes.push(grab);
    world.addProp(g);

    const door = { open: false, t: 0 };
    world.onUpdate((dt) => {
      door.t += ((door.open ? 1 : 0) - door.t) * Math.min(1, dt * 2.2);
      for (let i = 0; i < slats; i++) {
        const p = track((i + 0.5) * sh + door.t * travel);
        meshes[i].position.set(p.x, p.y, 0);
        meshes[i].rotation.z = -p.a;
      }
      const gp = track(0.95 + door.t * travel);
      grab.position.set(gp.x - 0.05 * Math.cos(gp.a), gp.y, 0);
      grab.rotation.z = -gp.a;
    });
    world.addBlocker({
      get active() { return door.t < 0.5; },
      pos: V(plane, F0 + H / 2, bz),
      halfW: leafW / 2, halfH: H / 2, halfD: 0.09, rotY: HALF,
    });
    world.addInteract({
      pos: V(GX0 - 0.05, F0 + 1.2, bz), radius: 3.0,
      label: () => (door.open ? 'Close the garage door' : 'Open the garage door'),
      onUse: () => { door.open = !door.open; return door.open ? 'creak' : 'latch'; },
      kind: 'garageDoor', data: door,
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// The garage shell.
// ───────────────────────────────────────────────────────────────────────────
function garageShell(world, k, P, win) {
  const y = F0, h = GHEAD - F0;
  const bays = [-35.89, -32.63, -29.37, -26.11];
  const W = bays.map((at) => ({ at, w: 2.86, y0: 0, y1: 2.55, door: 'bay' }));
  const N = [
    { at: 32.4, w: 1.0, y0: 1.90, y1: 2.90 },
    { at: 36.6, w: 1.0, y0: 1.90, y1: 2.90 },
  ];
  const S = [
    { at: 32.4, w: 1.0, y0: 1.90, y1: 2.90 },
    { at: 36.5, w: 1.10, y0: 0, y1: 2.30, door: 'side' },
  ];

  runZ(world, k, GX0 + GO / 2, GZ0, GZ1, y, h, GO, P.stone, W, { col: false, tile: 2.4 });
  runZ(world, k, GX0 + GO + GI / 2, GZ0, GZ1, y, h, GI, P.garageWall, W, { col: false });
  wallCols(world, GX0 + GE / 2, -31.0, GZ1 - GZ0, h, GE + 0.02, localOpenings(W, -31.0, true), HALF, y);

  runX(world, k, GZ0 + GO / 2, GX0, GX1, y, h, GO, P.stone, N, { col: false, tile: 2.4 });
  runX(world, k, GZ0 + GO + GI / 2, GX0, GX1, y, h, GI, P.garageWall, N, { col: false });
  runX(world, k, GZ0 + GE / 2, GX0, GX1, y, h, GE + 0.02, P.garageWall, N, { tile: 2.2 });

  runX(world, k, GZ1 - GO / 2, GX0, GX1, y, h, GO, P.stone, S, { col: false, tile: 2.4 });
  runX(world, k, GZ1 - GO - GI / 2, GX0, GX1, y, h, GI, P.garageWall, S, { col: false });
  wallCols(world, 34.5, GZ1 - GE / 2, GX1 - GX0, h, GE + 0.02, localOpenings(S, 34.5, false), 0, y);

  push(win, N, GZ0 + GE / 2, 0, y, 'n');
  push(win, S, GZ1 - GE / 2, 0, y, 's');

  // storey band and a kicker course, so the garage reads as part of the house
  k.box(GX1 - GX0 + 0.4, 0.18, 0.34, P.trim, 34.5, GHEAD - 0.10, GZ0 - 0.06, { tile: 0.8 });
  k.box(GX1 - GX0 + 0.4, 0.18, 0.34, P.trim, 34.5, GHEAD - 0.10, GZ1 + 0.06, { tile: 0.8 });
  k.box(0.34, 0.18, GZ1 - GZ0 + 0.4, P.trim, GX0 - 0.06, GHEAD - 0.10, -31.0, { tile: 0.8 });
}

// ───────────────────────────────────────────────────────────────────────────
// Furnishing.
// ───────────────────────────────────────────────────────────────────────────
function dressLiving(world, k, P, R) {
  const M = k.M;
  fireplace(k, 45.5, F0, -16.77, { rotY: Math.PI, w: 2.4, h: 2.85 });
  tv(k, 45.5, F0, -16.90, { rotY: Math.PI, w: 1.4, h: 2.02, wall: true });

  sofa(k, 45.4, F0, -19.5, { rotY: 0, w: 2.8, color: 0x6d7a80, cushion: 0xe8e4db, pillow: 0xb5c4cf });
  armchair(k, 42.7, F0, -18.4, { rotY: 1.09, color: 0x8a7f6d });
  armchair(k, 48.2, F0, -18.4, { rotY: -1.09, color: 0x8a7f6d });
  coffeeTable(k, 45.4, F0, -18.3, { w: 1.4, d: 0.8 });
  rug(k, 45.4, F0, -18.7, 4.8, 3.4, 0x7a6a58);
  magazines(k, 45.7, F0 + 0.43, -18.3, { n: 3 });
  bookStack(k, 44.9, F0 + 0.43, -18.4, { n: 3, w: 0.22 });

  sideTable(k, 41.6, F0, -19.9, { w: 0.55, lamp: true });
  floorLamp(k, 49.8, F0, -20.2, { h: 1.55 });
  bookshelf(k, 51.50, F0, -17.4, { rotY: -Math.PI / 2, w: 1.6, h: 2.0 });
  consoleTable(k, 39.62, F0, -20.4, { rotY: Math.PI / 2, w: 1.4, d: 0.42 });
  vase(k, 39.62, F0 + 0.88, -20.0, { scale: 1.1, color: 0xc9d4cb });
  photoFrame(k, 39.62, F0 + 0.88, -20.8, { rotY: Math.PI / 2, seed: 2 });
  artwork(k, 39.42, F0 + 2.00, -20.4, 1.1, 0.8, Math.PI / 2, 0x4b5a68);
  coatHooks(k, 39.40, F0 + 1.66, -17.1, { rotY: Math.PI / 2, w: 1.2, n: 4 });
  umbrellaStand(k, 39.75, F0, -21.5);
  plant(k, 40.2, F0, -16.9, 1.15);
  wastebasket(k, 51.2, F0, -21.6, {});

  // curtains hang on the two south windows and the west one
  curtains(k, 41.8, CUR0, IZ1 - 0.22, 2.2, Math.PI, 0xbfb4a6);
  curtains(k, 49.2, CUR0, IZ1 - 0.22, 2.2, Math.PI, 0xbfb4a6);
  curtains(k, IX0 + 0.22, CUR0, -18.6, 1.9, Math.PI / 2, 0xbfb4a6);

  // a mantel that is lived on
  k.box(0.16, 0.26, 0.10, M.paint(0xc9d4cb, 0.5, 'ghMantelPot'), 44.6, F0 + 1.63, -16.86, { tile: 0.2 });
  photoFrame(k, 46.3, F0 + 1.50, -16.86, { rotY: Math.PI, seed: 1 });
  wallClock(k, 51.58, F0 + 2.15, -19.6 - 2.9, -Math.PI / 2, { hour: 8, minute: 20 });
  lightSwitch(k, R, IX0 + 0.06, F0 + 1.15, -21.3, { rotY: Math.PI / 2 });
}

function dressDining(world, k, P, R) {
  const M = k.M;
  const tx = 45.4, tz = -25.30;
  k.box(2.30, 0.07, 1.10, P.walnut, tx, F0 + 0.75, tz, { tile: 1.0 });
  k.box(2.00, 0.10, 0.86, P.walnut, tx, F0 + 0.66, tz, { tile: 1.0 });
  for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    k.box(0.09, 0.72, 0.09, P.walnut, tx + ox * 0.98, F0 + 0.36, tz + oz * 0.42, { tile: 0.4 });
  }
  k.col(2.30, 0.80, 1.10, tx, F0 + 0.40, tz);

  for (const [ox, oz, r] of [[-0.75, -0.92, 0], [0.0, -0.92, 0], [0.75, -0.92, 0],
    [-0.75, 0.92, Math.PI], [0.0, 0.92, Math.PI], [0.75, 0.92, Math.PI]]) {
    diningChair(k, tx + ox, F0, tz + oz, { rotY: r });
  }
  for (const [ox, oz, r] of [[-0.72, -0.34, 0], [0.0, -0.34, 0], [0.72, -0.34, 0],
    [-0.72, 0.34, Math.PI], [0.0, 0.34, Math.PI], [0.72, 0.34, Math.PI]]) {
    placeSetting(k, tx + ox, F0 + 0.785, tz + oz, { rotY: r });
  }
  servingDish(k, tx - 0.34, F0 + 0.785, tz, { w: 0.36, d: 0.26 });
  jug(k, tx + 0.36, F0 + 0.785, tz, {});
  vase(k, tx, F0 + 0.785, tz, { scale: 0.8, color: 0xd8cfbe });

  dresser(k, 39.72, F0, -25.60, { rotY: Math.PI / 2, w: 1.8 });
  fruitBowl(k, 39.72, F0 + 0.91, -25.60, {});
  photoFrame(k, 39.72, F0 + 0.91, -26.30, { rotY: Math.PI / 2, seed: 3 });
  artwork(k, 39.42, F0 + 2.05, -24.6, 1.2, 0.85, Math.PI / 2, 0x6b5b45);
  wallShelf(k, 51.55, F0 + 1.75, -26.9, { rotY: -Math.PI / 2, w: 1.1, items: 3 });
  plant(k, 51.0, F0, -23.6, 1.05);
  curtains(k, IX1 - 0.22, CUR0, -25.2, 2.1, -Math.PI / 2, 0xa8b2bb);
  void M; void R; void world;
}

function dressKitchen(world, k, P, R) {
  const back = -30.78;
  counterRun(k, 41.60, F0, back, 4.2, { rotY: 0, cabinet: 0x33414a });
  range(k, 44.40, F0, back, { rotY: 0, ceil: CH });
  counterRun(k, 46.40, F0, back, 2.0, { rotY: 0, cabinet: 0x33414a, drawers: false });
  fridge(k, 39.72, F0, -29.60, { rotY: Math.PI / 2 });
  island(k, 45.60, F0, -28.90, { w: 3.0, d: 1.15 });
  wardrobe(k, 51.33, F0, -30.50, { rotY: -Math.PI / 2, w: 1.2, h: 2.3 });

  choppingBoard(k, 42.80, F0 + 0.93, back + 0.02, { rotY: 0 });
  mixingBowl(k, 40.30, F0 + 0.93, back + 0.02, { scale: 1.0 });
  utensilCrock(k, 43.60, F0 + 0.93, back - 0.06, { n: 5 });
  cookPot(k, 44.40, F0 + 0.95, back - 0.16, {});
  fruitBowl(k, 46.10, F0 + 0.93, back + 0.02, {});
  bookStack(k, 46.90, F0 + 0.93, back + 0.02, { n: 2, w: 0.2 });
  wallShelf(k, 51.55, F0 + 1.80, -28.0, { rotY: -Math.PI / 2, w: 1.0, items: 2 });
  wastebasket(k, 47.30, F0, -30.55, { metal: true });
  plant(k, 40.10, F0, -27.90, 0.95);
  lightSwitch(k, R, 48.10, F0 + 1.15, -31.06, { rotY: Math.PI });
  void P; void world;
}

function dressHall(world, k, P, R) {
  consoleTable(k, 51.42, F0, -33.0, { rotY: -Math.PI / 2, w: 1.4, d: 0.42 });
  tallMirror(k, 51.62, F0, -33.0, { rotY: -Math.PI / 2, w: 0.8, h: 1.3, base: 1.05 });
  vase(k, 51.42, F0 + 0.88, -32.5, { scale: 0.9, color: 0x9aa8b4 });
  bookStack(k, 51.42, F0 + 0.88, -33.5, { n: 2, w: 0.2 });
  coatHooks(k, 51.60, F0 + 1.70, -36.1, { rotY: -Math.PI / 2, w: 1.4, n: 4 });
  umbrellaStand(k, 51.30, F0, -37.20);
  bench(k, 49.60, F0, -37.36, { rotY: Math.PI, w: 1.6, color: 0x8a8172, rack: true });
  wallClock(k, 47.90, F0 + 2.20, IZ0 + 0.06, 0, { hour: 9, minute: 35 });
  artwork(k, 51.58, F0 + 2.05, -31.9, 0.9, 0.7, -Math.PI / 2, 0x5a6b57);
  plant(k, 51.20, F0, -31.60, 1.0);
  curtains(k, IX1 - 0.22, CUR0, -34.5, 1.5, -Math.PI / 2, 0xc9bcae);
  lightSwitch(k, R, 47.90, F0 + 1.15, -31.20 - 0.09, { rotY: 0 });
  void P; void world;
}

function dressShowerRoom(world, k, P, R) {
  shower(k, 40.30, F0, -36.90, { w: 1.6, d: 1.4 });
  toilet(k, 44.90, F0, -37.30, { rotY: 0 });
  vanity(k, 42.60, F0, -34.50, { rotY: Math.PI, w: 1.4 });
  laundryBasket(k, 45.30, F0, -34.70, {});
  wastebasket(k, 44.10, F0, -34.60, {});
  // towel rail and a folded stack
  k.box(0.05, 0.05, 0.9, P.chrome, IX0 + 0.10, F0 + 1.45, -35.9, { tile: 0.3 });
  for (const dz of [-0.25, 0.25]) {
    k.box(0.10, 0.62, 0.34, k.M.paint(0xe8eef2, 0.95, 'ghTowel'), IX0 + 0.14, F0 + 1.16, -35.9 + dz, { tile: 0.4 });
  }
  k.box(0.24, 0.16, 0.34, k.M.paint(0xe8eef2, 0.95, 'ghTowel'), 44.90, F0 + 0.60, -36.20, { tile: 0.3 });
  rug(k, 42.60, F0, -35.40, 1.3, 0.8, 0xcbd6d8);
  lightSwitch(k, R, 45.72, F0 + 1.15, -35.30, { rotY: -Math.PI / 2 });
  void world;
}

function dressUtility(world, k, P, R) {
  const M = k.M;
  const app = M.paint(0xeceef0, 0.42, 'ghAppliance');
  const back = -33.80;
  for (const x of [40.10, 40.85]) {
    k.box(0.66, 0.86, 0.62, app, x, F0 + 0.43, back, { tile: 0.5 });
    k.box(0.36, 0.36, 0.03, M.get('carGlass'), x, F0 + 0.46, back + 0.32, { tile: 0.3 });
    k.box(0.60, 0.10, 0.03, P.chrome, x, F0 + 0.79, back + 0.32, { tile: 0.2 });
    k.col(0.70, 0.90, 0.66, x, F0 + 0.45, back);
  }
  // worktop across them, and a butler sink at the end
  k.box(2.60, 0.05, 0.66, P.walnut, 41.40, F0 + 0.89, back, { tile: 0.8 });
  k.box(0.62, 0.34, 0.52, M.paint(0xfbfcfd, 0.3, 'porcelain'), 42.20, F0 + 0.72, back, { tile: 0.4 });
  k.box(0.05, 0.30, 0.05, P.chrome, 42.20, F0 + 1.06, back - 0.22, { tile: 0.2 });
  k.box(0.05, 0.05, 0.20, P.chrome, 42.20, F0 + 1.20, back - 0.13, { tile: 0.2 });
  k.col(2.60, 0.92, 0.68, 41.40, F0 + 0.46, back);
  // shelves and a boiler
  for (const y of [1.55, 2.00]) {
    k.box(2.60, 0.05, 0.34, P.walnut, 41.40, F0 + y, back - 0.10, { tile: 0.6 });
  }
  for (let i = 0; i < 7; i++) {
    k.box(0.22, 0.26, 0.20, M.solid([0x6ab04c, 0x2f81ff, 0xf0b429, 0xd0342c][i % 4], 0.6),
      40.00 + i * 0.36, F0 + 1.71, back - 0.10, { tile: 0.2 });
    k.box(0.24, 0.18, 0.22, M.paint(0x9a8b78, 0.9, 'ghSack'), 40.00 + i * 0.36, F0 + 2.12, back - 0.10, { tile: 0.2 });
  }
  k.box(0.56, 0.86, 0.36, M.paint(0xf0f2f4, 0.4, 'ghBoiler'), 44.90, F0 + 1.72, back - 0.02, { tile: 0.4 });
  k.box(0.12, 0.70, 0.12, P.chrome, 44.90, F0 + 2.50, back - 0.02, { tile: 0.3 });
  laundryBasket(k, 44.60, F0, -32.10, {});
  coatHooks(k, 39.44, F0 + 1.70, -33.10, { rotY: Math.PI / 2, w: 1.2, n: 3 });
  for (let i = 0; i < 3; i++) {
    k.box(0.16, 0.28, 0.30, M.solid([0x2f4f6b, 0x3f5c3a, 0x6b5330][i], 0.7),
      39.70, F0 + 0.14, -32.4 + i * 0.26, { tile: 0.2 });
  }
  wastebasket(k, 45.30, F0, -31.55, { metal: true });
  lightSwitch(k, R, 45.72, F0 + 1.15, -32.05, { rotY: -Math.PI / 2 });
  void world;
}

function dressBedTwo(world, k, P, R) {
  bed(k, 44.63, F1, -34.80, { size: 'queen', rotY: -Math.PI / 2, duvet: 0xc8d3cb, sheet: 0xf6f4ef, cushion: 0x8a8172 });
  nightstand(k, 45.40, F1, -36.05, { rotY: -Math.PI / 2 });
  nightstand(k, 45.40, F1, -33.60, { rotY: -Math.PI / 2, lamp: false });
  wardrobe(k, 40.50, F1, -31.58, { rotY: Math.PI, w: 1.8, h: 2.3 });
  dresser(k, 43.60, F1, -31.53, { rotY: Math.PI, w: 1.6 });
  tv(k, 43.60, F1, -31.36, { rotY: Math.PI, w: 1.2, h: 1.55, wall: true });
  desk(k, 39.78, F1, -34.50, { rotY: Math.PI / 2, w: 1.4, d: 0.68 });
  officeChair(k, 40.85, F1, -34.50, { rotY: -Math.PI / 2, color: 0x6b7a54 });
  tableLamp(k, 39.78, -35.05, F1 + 0.79, {});
  bookStack(k, 39.78, F1 + 0.77, -33.95, { n: 3, w: 0.22 });
  rug(k, 42.60, F1, -34.60, 3.2, 2.6, 0x6a7684);
  bookshelf(k, 39.62, F1, -36.60, { rotY: Math.PI / 2, w: 1.3, h: 1.7 });
  floorLamp(k, 44.90, F1, -32.60, { h: 1.5 });
  artwork(k, 42.60, F1 + 2.05, -31.24, 1.1, 0.8, Math.PI, 0x37485c);
  photoFrame(k, 43.60, F1 + 0.92, -31.82, { rotY: Math.PI, seed: 0 });
  wastebasket(k, 40.90, F1, -33.30, {});
  curtains(k, 41.2, CUR1, IZ0 + 0.22, 1.9, 0, 0xbfb4a6);
  curtains(k, 44.0, CUR1, IZ0 + 0.22, 1.7, 0, 0xbfb4a6);
  lightSwitch(k, R, 45.74, F1 + 1.15, -31.90, { rotY: -Math.PI / 2 });
  void P; void world;
}

function dressFamilyBath(world, k, P, R) {
  const M = k.M;
  bathtub(k, 39.80, F1, -26.75, { rotY: Math.PI / 2 });
  shower(k, 44.60, F1, -26.44, { w: 1.5, d: 1.4, rotY: Math.PI });
  vanity(k, 42.00, F1, -30.80, { rotY: 0, w: 1.8 });
  toilet(k, 44.90, F1, -30.70, { rotY: 0 });
  laundryBasket(k, 45.20, F1, -28.60, {});
  wastebasket(k, 43.20, F1, -30.60, {});
  rug(k, 41.60, F1, -28.20, 1.6, 1.0, 0xcbd6d8);
  // heated rail with towels, and a shelf of bottles over the bath
  k.box(0.06, 1.00, 0.06, P.chrome, 41.10, F1 + 1.35, -25.90, { tile: 0.3 });
  for (let i = 0; i < 4; i++) {
    k.box(0.60, 0.05, 0.05, P.chrome, 41.10, F1 + 0.95 + i * 0.26, -25.90, { tile: 0.2 });
  }
  k.box(0.44, 0.60, 0.11, M.paint(0xe8eef2, 0.95, 'ghTowel'), 41.10, F1 + 1.25, -25.98, { tile: 0.4 });
  k.box(1.10, 0.05, 0.20, P.walnut, 39.60, F1 + 1.55, -26.75, { rotY: Math.PI / 2, tile: 0.5 });
  for (let i = 0; i < 4; i++) {
    k.box(0.08, 0.18, 0.08, M.solid([0x6ab04c, 0x3f6ea8, 0xd8e3ea, 0xb56fa8][i], 0.5),
      39.60, F1 + 1.67, -27.15 + i * 0.26, { tile: 0.1 });
  }
  lightSwitch(k, R, 45.74, F1 + 1.15, -29.20, { rotY: -Math.PI / 2 });
  void world;
}

function dressLanding(world, k, P, R) {
  bookshelf(k, 51.50, F1, -32.00, { rotY: -Math.PI / 2, w: 1.8, h: 1.9 });
  consoleTable(k, 51.45, F1, -26.80, { rotY: -Math.PI / 2, w: 1.2, d: 0.40 });
  vase(k, 51.45, F1 + 0.88, -26.80, { scale: 1.0, color: 0xd8cfbe });
  bench(k, 51.35, F1, -29.00, { rotY: -Math.PI / 2, w: 1.4, d: 0.44, color: 0x6e7a80 });
  wardrobe(k, 47.00, F1, -26.05, { rotY: Math.PI, w: 1.6, h: 2.3 });
  rug(k, 49.4, F1, -30.4, 1.8, 5.6, 0x7d6a58);
  artwork(k, 51.58, F1 + 2.05, -33.60, 0.9, 0.7, -Math.PI / 2, 0x5a6b57);
  artwork(k, 48.60, F1 + 2.05, IZ0 + 0.10, 0.9, 0.7, 0, 0x6b5b45);
  photoFrame(k, 51.45, F1 + 0.88, -27.40, { rotY: -Math.PI / 2, seed: 1 });
  plant(k, 46.60, F1, -27.20, 1.0);
  wastebasket(k, 51.20, F1, -26.10, {});
  curtains(k, IX1 - 0.22, CUR1, -35.0, 1.7, -Math.PI / 2, 0xc9bcae);
  curtains(k, IX1 - 0.22, CUR1, -29.0, 1.7, -Math.PI / 2, 0xc9bcae);
  lightSwitch(k, R, 48.10, F1 + 1.15, -25.72, { rotY: Math.PI });
  void P; void world;
}

function dressBedOne(world, k, P, R) {
  bed(k, 42.50, F1, -24.49, { size: 'king', rotY: 0, duvet: 0xd8dee6, sheet: 0xf7f6f2, cushion: 0x6a7684, throw: 0x9c8b70 });
  nightstand(k, 40.90, F1, -24.90, { rotY: 0 });
  nightstand(k, 44.10, F1, -24.90, { rotY: 0, lamp: false });
  bench(k, 42.50, F1, -22.55, { rotY: 0, w: 1.8, color: 0x8a8172, rack: true });
  rug(k, 42.50, F1, -22.20, 4.2, 3.2, 0x6a7684);
  wardrobe(k, 39.63, F1, -20.45, { rotY: Math.PI / 2, w: 1.6, h: 2.3 });
  dresser(k, 45.84, F1, -16.58, { rotY: Math.PI, w: 1.8 });
  tv(k, 45.84, F1, -16.45, { rotY: Math.PI, w: 1.4, h: 1.62, wall: true });
  armchair(k, 40.45, F1, -18.60, { rotY: Math.PI / 2, color: 0x7b8a92 });
  sideTable(k, 40.60, F1, -17.40, { w: 0.5, lamp: true });
  floorLamp(k, 41.60, F1, -19.80, { h: 1.55 });
  bookshelf(k, 51.40, F1, -23.60, { rotY: -Math.PI / 2, w: 1.5, h: 1.8 });
  desk(k, 50.90, F1, -19.60, { rotY: -Math.PI / 2, w: 1.4, d: 0.68 });
  officeChair(k, 49.90, F1, -19.60, { rotY: Math.PI / 2, color: 0x37485c });
  bookStack(k, 50.90, F1 + 0.77, -20.10, { n: 3, w: 0.22 });
  photoFrame(k, 45.84, F1 + 0.92, -16.85, { rotY: Math.PI, seed: 2 });
  artwork(k, 39.42, F1 + 2.10, -21.90, 1.2, 0.85, Math.PI / 2, 0x4b5a68);
  wastebasket(k, 44.60, F1, -19.20, {});
  plant(k, 47.00, F1, -24.60, 1.15);
  curtains(k, 41.4, CUR1, IZ1 - 0.22, 2.0, Math.PI, 0xc9bcae);
  curtains(k, IX0 + 0.22, CUR1, -18.6, 1.9, Math.PI / 2, 0xc9bcae);
  curtains(k, IX0 + 0.22, CUR1, -22.5, 1.7, Math.PI / 2, 0xc9bcae);
  lightSwitch(k, R, 48.10, F1 + 1.15, -25.48, { rotY: 0 });
  void P; void world;
}

function dressEnsuite(world, k, P, R) {
  vanity(k, 50.20, F1, -21.05, { rotY: 0, w: 1.5 });
  shower(k, 48.30, F1, -17.05, { w: 1.4, d: 1.4, rotY: Math.PI });
  toilet(k, 51.35, F1, -19.40, { rotY: -Math.PI / 2 });
  wastebasket(k, 47.85, F1, -20.70, {});
  rug(k, 49.60, F1, -19.40, 1.2, 0.8, 0xd6dee2);
  k.box(0.05, 0.05, 0.90, P.chrome, 47.62, F1 + 1.40, -18.90, { tile: 0.3 });
  k.box(0.10, 0.62, 0.34, k.M.paint(0xe8eef2, 0.95, 'ghTowel'), 47.66, F1 + 1.11, -18.90, { tile: 0.4 });
  lightSwitch(k, R, 47.56, F1 + 1.15, -21.05, { rotY: Math.PI / 2 });
  void world;
}

function dressGarage(world, k, P, R) {
  const M = k.M;
  const bx = GIX1 - 0.36;                       // bench against the east wall
  const b0 = -30.6, b1 = -25.4;
  k.box(0.72, 0.07, b1 - b0, P.walnut, bx, F0 + 0.92, (b0 + b1) / 2, { tile: 0.8 });
  k.box(0.62, 0.72, b1 - b0 - 0.2, M.paint(0x4a5560, 0.6, 'ghBenchCab'), bx, F0 + 0.52, (b0 + b1) / 2, { tile: 0.7 });
  for (let i = 0; i < 4; i++) {
    k.box(0.03, 0.46, 0.62, M.paint(0x5b6874, 0.5, 'ghBenchDoor'), bx - 0.33, F0 + 0.56, b0 + 0.5 + i * 1.05, { tile: 0.4 });
    k.box(0.03, 0.03, 0.16, P.chrome, bx - 0.36, F0 + 0.56, b0 + 0.5 + i * 1.05, { tile: 0.2 });
  }
  k.col(0.74, 0.96, b1 - b0, bx, F0 + 0.48, (b0 + b1) / 2);
  // vice, pegboard and a hanging rack of tools
  k.box(0.20, 0.22, 0.16, P.steel, bx - 0.18, F0 + 1.06, b0 + 0.5, { tile: 0.2 });
  k.box(0.06, 0.24, 0.06, P.steel, bx - 0.18, F0 + 1.24, b0 + 0.5, { tile: 0.2 });
  k.box(0.03, 1.20, b1 - b0, M.paint(0xb9a789, 0.85, 'ghPegboard'), GIX1 - 0.02, F0 + 1.70, (b0 + b1) / 2, { tile: 0.8 });
  const tools = [0x8a8f96, 0x6b5330, 0x2f81ff, 0xd0342c, 0xf0b429];
  for (let i = 0; i < 12; i++) {
    const tz = b0 + 0.35 + i * ((b1 - b0 - 0.7) / 11);
    k.box(0.05, 0.30 + (i % 3) * 0.08, 0.07, M.solid(tools[i % 4], 0.6), GIX1 - 0.08, F0 + 1.72, tz, { tile: 0.2 });
  }
  // shelving north of the bench
  for (const y of [0.5, 1.05, 1.60, 2.15]) {
    k.box(0.42, 0.05, 3.4, P.walnut, GIX1 - 0.23, F0 + y, -35.2, { tile: 0.7 });
  }
  for (const z of [-36.85, -33.55]) k.box(0.42, 2.30, 0.06, P.black, GIX1 - 0.23, F0 + 1.15, z, { tile: 0.4 });
  k.col(0.46, 2.35, 3.5, GIX1 - 0.23, F0 + 1.17, -35.2);
  for (let i = 0; i < 14; i++) {
    const yy = [0.62, 1.17, 1.72, 2.27][i % 4];
    k.box(0.30, 0.22, 0.28, M.solid([0xd0342c, 0x2f81ff, 0xf0b429, 0x6ab04c, 0x8a5b3a][i % 5], 0.6),
      GIX1 - 0.24, F0 + yy, -36.5 + (i % 7) * 0.44, { tile: 0.2 });
  }
  // a tool chest, tyres, a bike and a bin down the middle of the far bay
  k.box(0.70, 0.95, 1.20, M.paint(0xb3231f, 0.45, 'ghToolChest'), 37.80, F0 + 0.48, -24.90, { tile: 0.5 });
  for (let i = 0; i < 4; i++) k.box(0.66, 0.06, 1.10, P.black, 37.80, F0 + 0.24 + i * 0.20, -24.86, { tile: 0.3 });
  k.col(0.74, 1.00, 1.24, 37.80, F0 + 0.48, -24.90);
  for (let i = 0; i < 3; i++) {
    k.box(0.66, 0.22, 0.66, M.get('rubber'), 31.30, F0 + 0.11 + i * 0.22, -37.10, { tile: 0.3 });
  }
  k.col(0.70, 0.70, 0.70, 31.30, F0 + 0.35, -37.10);
  bikeAgainstWall(k, P, 31.10, F0, -25.10);
  k.box(0.56, 0.90, 0.56, M.paint(0x3b4750, 0.6, 'ghBin'), 30.90, F0 + 0.45, -37.00, { tile: 0.4 });
  k.box(0.60, 0.06, 0.60, M.paint(0x2a333a, 0.6, 'ghBinLid'), 30.90, F0 + 0.93, -37.00, { tile: 0.3 });
  k.col(0.60, 0.96, 0.60, 30.90, F0 + 0.48, -37.00);
  // bay markings on the slab
  for (const z of [-34.26, -31.00, -27.74]) {
    k.box(6.4, 0.012, 0.10, M.paint(0xe8e4d6, 0.8, 'ghBayLine'), 34.2, F0 + 0.006, z, { tile: 0.6 });
  }
  wallClock(k, 34.5, F0 + 2.60, GIZ0 + 0.06, 0, { hour: 4, minute: 50 });
  void R; void world;
}

function bikeAgainstWall(k, P, x, y, z) {
  const M = k.M;
  const frame = M.paint(0x1f6f4a, 0.45, 'ghBikeFrame');
  for (const dz of [-0.52, 0.52]) {
    k.box(0.06, 0.68, 0.68, M.get('rubber'), x, y + 0.34, z + dz, { tile: 0.3 });
    k.box(0.04, 0.30, 0.30, P.chrome, x, y + 0.34, z + dz, { tile: 0.2 });
  }
  k.box(0.05, 0.42, 1.00, frame, x + 0.04, y + 0.62, z, { tile: 0.4 });
  k.box(0.05, 0.44, 0.05, frame, x + 0.04, y + 0.50, z - 0.30, { rotX: 0.28, tile: 0.3 });
  k.box(0.36, 0.05, 0.05, P.black, x + 0.04, y + 0.95, z + 0.46, { tile: 0.2 });
  k.box(0.10, 0.06, 0.26, M.get('leather'), x + 0.04, y + 0.92, z - 0.24, { tile: 0.2 });
  k.col(0.30, 1.00, 1.30, x + 0.05, y + 0.50, z);
}

// ───────────────────────────────────────────────────────────────────────────
// Navigation.  gh_front sits on the path outside the front door and is joined
// only to the inside of the house — the link out to the driveway is somebody
// else's to make.
// ───────────────────────────────────────────────────────────────────────────
function navigation(world, GY) {
  const n = (name, x, y, z, tags) => world.navNode(name, x, y, z, tags);
  const front = n('gh_front', 37.60, GY, -22.0, ['outside', 'guest']);
  const living = n('gh_living', 45.20, F0, -19.80, ['room', 'guest']);
  const kitchen = n('gh_kitchen', 45.60, F0, -26.60, ['room', 'guest']);
  const pass = n('gh_pass', 49.00, F0, -31.20, ['door', 'guest']);
  const hall = n('gh_hall', 49.20, F0, -33.20, ['room', 'guest']);
  const utility = n('gh_utility', 42.60, F0, -32.60, ['room', 'guest']);
  const garage = n('gh_garage', 34.50, F0, -31.00, ['room', 'guest']);
  const landing = n('gh_landing', 49.30, F1, -33.20, ['room', 'guest']);
  const lsouth = n('gh_landing_s', 49.30, F1, -27.00, ['room', 'guest']);
  const bed1 = n('gh_bed1', 42.60, F1, -22.40, ['room', 'guest']);
  const bed2 = n('gh_bed2', 42.60, F1, -33.60, ['room', 'guest']);

  const link = (a, b) => world.navLink(a, b);
  link(front, living);
  link(living, kitchen);
  link(kitchen, pass);
  link(pass, hall);
  link(hall, utility);
  link(utility, garage);
  link(hall, landing);            // the flight
  link(landing, lsouth);
  link(landing, bed2);
  link(lsouth, bed1);

  world.stairLinks = world.stairLinks || [];
}
