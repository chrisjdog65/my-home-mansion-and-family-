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
  jug, tableLamp, sconce, radio, openBook, barstool,
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

  dressLiving(k, P, R.living);
  dressDining(k, P, R.dining);
  dressKitchen(k, P, R.kitchen);
  dressHall(k, P, R.hall);
  dressShowerRoom(k, P, R.shower);
  dressUtility(k, P, R.utility);
  dressBedTwo(k, P, R.bed2);
  dressFamilyBath(k, P, R.bath);
  dressLanding(k, P, R.landing);
  dressBedOne(k, P, R.bed1);
  dressEnsuite(k, P, R.ensuite);
  dressGarage(k, P, R.garage);

  // ── 6b. second fix: the things that say somebody lives here ──────────────
  secondFix(world, k, P);

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

/** Baseboard along a run, stopping short of every opening that reaches it. */
function trimRun(k, mat, alongZ, pos, a0, a1, y, th, td, openings) {
  const cuts = openings
    .filter((o) => (o.y0 ?? 0) < 0.4)
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
    { at: -32.20, w: 1.10, y0: 0, y1: 2.30, door: 'inner' },  // through to the garage
    { at: -22.0, w: 1.30, y0: 0, y1: 2.40, door: 'front' },
    { at: -18.6, w: 1.6, y0: sill, y1: head },
  ];

  // north
  runX(world, k, HZ0 + TO / 2, HX0, HX1, y, h, TO, P.stone, N, { col: false, tile: 2.6 });
  runX(world, k, HZ0 + TO + TI / 2, HX0, HX1, y, h, TI, P.wall, N, { col: false });
  wallCols(world, (HX0 + HX1) / 2, HZ0 + TE / 2, HX1 - HX0, h, TE + 0.02,
    localOpenings(N, (HX0 + HX1) / 2, false), 0, y);
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
    [{ at: -32.20, w: 1.10, y0: 0, y1: 2.30 }], { col: false });

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
  wallCols(world, 45.5, HZ0 + TE / 2, HX1 - HX0, h, TE + 0.02,
    localOpenings(N, 45.5, false), 0, y);

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
  // The hall's west wall carries the stair for its northern four metres, so
  // its one doorway sits south of the flight — a door any further north would
  // open straight into the side of the treads.  The utility beyond it is the
  // service lobby: hall on one side, garage on the other, shower room through
  // the wall at the back.
  runZ(world, k, 45.90, IZ0, -31.13, F0, gh, TP, P.wall, [D(-32.20)]);
  runX(world, k, -34.13, IX0, 45.83, F0, gh, TP, P.wall, [D(44.30)]);    // shower / utility
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
  case1(true, 45.90, -32.20, 1.10, 2.30);
  case1(false, -34.13, 44.30, 1.10, 2.30);
  case1(false, -31.20, 49.0, 2.40, 2.60);

  // Wet-room dados, run wall by wall.  The tiling stops 1.27 m up — under
  // every cill in these rooms — and no side that carries a door gets any, or
  // a two-centimetre band would run straight across the opening.
  const H = 1.15, MID = 0.695;
  const dado = (sides, x0, x1, z0, z1, y) => {
    if (sides.includes('n')) k.box(x1 - x0, H, 0.02, P.tile, (x0 + x1) / 2, y + MID, z0 + 0.02, { tile: 0.8 });
    if (sides.includes('s')) k.box(x1 - x0, H, 0.02, P.tile, (x0 + x1) / 2, y + MID, z1 - 0.02, { tile: 0.8 });
    if (sides.includes('w')) k.box(0.02, H, z1 - z0, P.tile, x0 + 0.02, y + MID, (z0 + z1) / 2, { tile: 0.8 });
    if (sides.includes('e')) k.box(0.02, H, z1 - z0, P.tile, x1 - 0.02, y + MID, (z0 + z1) / 2, { tile: 0.8 });
  };
  dado(['n', 's', 'w'], IX0, 45.83, IZ0, -34.20, F0);          // shower room
  dado(['n', 's', 'w'], IX0, 45.83, -31.13, -25.74, F1);       // family bathroom
  dado(['w'], 47.47, IX1, -21.36, IZ1, F1);                    // ensuite
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
    k.box(w, 0.03, d, P.ceil, x, C0 + 0.015, z, { tile: 2.0 });       // seen from below
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
    // A box rotated about Z by +θ lifts its own +x end, so the WEST slab
    // (s = -1, ridge to its east) takes +θ and the east slab −θ: rotZ = −s·θ.
    // Signing this the other way round gives a butterfly roof that drains
    // into the ridge, which is not a thing.
    const tilt = -s * slope;
    k.box(rake, o.thick, lenZ, shingle, cxp, cyp, cz, { rotZ: tilt, tile: 1.4 });

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
    const uMid = Math.abs(edge - o.rx) - 0.4;
    const xMid = o.rx + s * uMid;
    const yMid = o.ry - o.drop * uMid - vt / 2;
    const dn = 0.20;
    k.box(1.2, 0.05, lenZ, P.board,
      xMid - s * dn * Math.sin(slope), yMid - dn * Math.cos(slope), cz,
      { rotZ: tilt, tile: 0.8 });
    const fx = edge + s * 0.06;
    const fTop = o.ry - o.drop * Math.abs(fx - o.rx);
    k.box(0.07, 0.34, lenZ, P.board, fx, fTop - 0.15, cz, { tile: 0.7 });
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

  // Guard rail down the open side of the void.  The well is barely wider than
  // the flight, so its south end is the stair mouth: railing that off would
  // fence the landing away from the stair it belongs to, and the newel plus
  // the raking balustrade already close the two hand's-breadth slivers left
  // either side of the top tread.
  railing(world, post, rail, WELL.x1, F1, (WELL.z0 + WELL.z1) / 2, WELL.z1 - WELL.z0, HALF, 1.05, 0.85);

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
  set(R.bed1, C1, [[42.5, -22.6], [44.8, -18.4]],
    [[40.2, -24.8], [40.2, -17.4], [45.6, -17.0], [49.6, -23.6]], 'flush', warm, { i: 13 });
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
  outLamp(k, 38.86, F0 + 2.30, -22.0, 0.34);
  world.addLight({ pos: V(38.3, F0 + 2.2, -22.0), color: 0xffd39a, intensity: 26, decay: 1.8, distance: 12, outdoor: true, night: true });
  outLamp(k, 52.14, F0 + 2.50, -19.6, 0.34);
  world.addLight({ pos: V(52.7, F0 + 2.4, -19.6), color: 0xffd39a, intensity: 26, decay: 1.8, distance: 12, outdoor: true, night: true });
  for (const z of [-34.6, -27.4]) {
    k.box(0.30, 0.16, 0.24, P.black, GX0 - 0.16, 3.55, z, { tile: 0.3 });
    k.box(0.24, 0.10, 0.05, k.M.emissive(0xffe0b0, 2.4), GX0 - 0.30, 3.50, z, { tile: 0.2 });
    world.addLight({ pos: V(GX0 - 0.9, 3.35, z), color: 0xffd9a0, intensity: 34, decay: 1.8, distance: 15, outdoor: true, night: true });
  }
}

function outLamp(k, x, y, z, w) {
  k.box(0.06, 0.36, 0.16, k.M.get('blackMetal'), x, y + 0.20, z, { tile: 0.3 });
  k.box(w, 0.34, w, k.M.get('blackMetal'), x, y, z, { tile: 0.3 });
  k.box(w - 0.10, 0.26, w - 0.10, k.M.emissive(0xffcf8a, 2.0), x, y, z, { tile: 0.2 });
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
  leaf(world, k, { x: HX0 + TE / 2, y: F0, z: -32.20, w: 1.04, h: 2.22, rotY: HALF, side: 1, face: d, label: 'Open the door to the garage' });
  leaf(world, k, { x: 36.50, y: F0, z: GZ1 - GE / 2, w: 1.04, h: 2.22, rotY: 0, side: -1, face: d, label: 'Open the garage side door' });

  // ground floor: the hall into the utility, and the utility into the shower room
  leaf(world, k, { x: 45.90, y: F0, z: -32.20, w: 1.04, h: 2.22, rotY: HALF, side: -1, face: d, label: 'Open the utility door' });
  leaf(world, k, { x: 44.30, y: F0, z: -34.13, w: 1.04, h: 2.22, rotY: 0, side: -1, face: d, label: 'Open the shower room door' });

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
    // The pivot group is turned a quarter turn to stand in a wall that runs
    // along Z, which swaps the sense of its own +x: local +x comes out as
    // world −z.  So a leaf hinged on the jamb at +s reaches back to the middle
    // along local +s, not −s, and it swings out over the terrace on −s.
    const leafW = W / 2 - 0.05, leafH = H - 0.07, dir = s;
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
      pivot.rotation.y = HALF - door.t * 1.7 * s;
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
  wallCols(world, 34.5, GZ0 + GE / 2, GX1 - GX0, h, GE + 0.02,
    localOpenings(N, 34.5, false), 0, y);

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
function dressLiving(k, P, R) {
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
  umbrellaStand(k, 39.72, F0, -17.95);
  plant(k, 40.2, F0, -16.9, 1.15);
  wastebasket(k, 51.2, F0, -21.6, {});

  // curtains hang on the two south windows and the west one
  curtains(k, 41.8, CUR0, IZ1 - 0.22, 2.2, Math.PI, 0xbfb4a6);
  curtains(k, 49.2, CUR0, IZ1 - 0.22, 2.2, Math.PI, 0xbfb4a6);
  curtains(k, IX0 + 0.22, CUR0, -18.6, 1.9, Math.PI / 2, 0xbfb4a6);

  // a mantel that is lived on
  k.box(0.16, 0.26, 0.10, M.paint(0xc9d4cb, 0.5, 'ghMantelPot'), 44.6, F0 + 1.63, -16.86, { tile: 0.2 });
  photoFrame(k, 46.3, F0 + 1.50, -16.86, { rotY: Math.PI, seed: 1 });
  lightSwitch(k, R, IX0 + 0.06, F0 + 1.15, -21.25, { rotY: Math.PI / 2 });
}

function dressDining(k, P, R) {
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
  wallShelf(k, 51.55, F0 + 1.75, -26.8, { rotY: -Math.PI / 2, w: 1.1, items: 3 });
  plant(k, 51.0, F0, -23.6, 1.05);
  curtains(k, IX1 - 0.22, CUR0, -25.2, 2.1, -Math.PI / 2, 0xa8b2bb);
}

function dressKitchen(k, P, R) {
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
  wallShelf(k, 39.44, F0 + 1.80, -28.10, { rotY: Math.PI / 2, w: 1.0, items: 2 });
  wastebasket(k, 47.30, F0, -30.55, { metal: true });
  plant(k, 40.20, F0, -27.85, 0.95);
  wallClock(k, 50.70, F0 + 2.30, -31.09, 0, { hour: 8, minute: 20 });
  lightSwitch(k, R, 47.62, F0 + 1.15, -31.09, { rotY: 0 });
}

function dressHall(k, P, R) {
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
  lightSwitch(k, R, 47.60, F0 + 1.15, -31.31, { rotY: Math.PI });
}

function dressShowerRoom(k, P, R) {
  shower(k, 40.30, F0, -36.90, { w: 1.6, d: 1.4 });
  toilet(k, 44.90, F0, -37.30, { rotY: 0 });
  vanity(k, 42.60, F0, -34.50, { rotY: Math.PI, w: 1.4 });
  laundryBasket(k, 45.30, F0, -34.70, {});
  wastebasket(k, 44.10, F0, -34.60, {});
  // towel rail and a folded stack
  k.box(0.05, 0.05, 0.9, P.chrome, IX0 + 0.10, F0 + 1.45, -35.35, { tile: 0.3 });
  for (const dz of [-0.25, 0.25]) {
    k.box(0.10, 0.62, 0.34, k.M.paint(0xe8eef2, 0.95, 'ghTowel'), IX0 + 0.14, F0 + 1.16, -35.35 + dz, { tile: 0.4 });
  }
  k.box(0.24, 0.16, 0.34, k.M.paint(0xe8eef2, 0.95, 'ghTowel'), 44.90, F0 + 0.87, -37.54, { tile: 0.3 });
  rug(k, 42.60, F0, -35.40, 1.3, 0.8, 0xcbd6d8);
  lightSwitch(k, R, 45.72, F0 + 1.15, -35.10, { rotY: -Math.PI / 2 });
}

function dressUtility(k, P, R) {
  const M = k.M;
  const app = M.paint(0xeceef0, 0.42, 'ghAppliance');
  const back = -33.75;
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
      40.20 + i * 0.36, F0 + 1.71, back - 0.10, { tile: 0.2 });
    k.box(0.24, 0.18, 0.22, M.paint(0x9a8b78, 0.9, 'ghSack'), 40.20 + i * 0.36, F0 + 2.12, back - 0.10, { tile: 0.2 });
  }
  k.box(0.56, 0.86, 0.36, M.paint(0xf0f2f4, 0.4, 'ghBoiler'), 45.35, F0 + 1.72, back - 0.02, { tile: 0.4 });
  k.box(0.12, 0.70, 0.12, P.chrome, 45.35, F0 + 2.50, back - 0.02, { tile: 0.3 });
  k.col(0.60, 0.90, 0.40, 45.35, F0 + 1.72, back - 0.02);
  laundryBasket(k, 43.40, F0, -31.60, {});
  // boots kicked off against the west wall, clear of the two door swings
  for (const bz of [-33.25, -33.00]) {
    k.box(0.16, 0.28, 0.30, M.solid(bz < -33.1 ? 0x2f4f6b : 0x3f5c3a, 0.7), 39.70, F0 + 0.14, bz, { tile: 0.2 });
  }
  wastebasket(k, 45.30, F0, -31.40, { metal: true });
  lightSwitch(k, R, 45.72, F0 + 1.15, -31.45, { rotY: -Math.PI / 2 });
}

function dressBedTwo(k, P, R) {
  bed(k, 44.63, F1, -34.80, { size: 'queen', rotY: -Math.PI / 2, duvet: 0xc8d3cb, sheet: 0xf6f4ef, cushion: 0x8a8172 });
  nightstand(k, 45.40, F1, -36.05, { rotY: -Math.PI / 2 });
  nightstand(k, 45.40, F1, -33.60, { rotY: -Math.PI / 2, lamp: false });
  wardrobe(k, 40.50, F1, -31.58, { rotY: Math.PI, w: 1.8, h: 2.3 });
  dresser(k, 43.60, F1, -31.53, { rotY: Math.PI, w: 1.6 });
  tv(k, 43.60, F1, -31.36, { rotY: Math.PI, w: 1.2, h: 1.55, wall: true });
  desk(k, 39.78, F1, -34.50, { rotY: Math.PI / 2, w: 1.4, d: 0.68 });
  officeChair(k, 40.85, F1, -34.50, { rotY: -Math.PI / 2, color: 0x6b7a54 });
  tableLamp(k, 39.78, -35.05, F1 + 0.765, {});
  bookStack(k, 39.78, F1 + 0.765, -33.95, { n: 3, w: 0.22 });
  rug(k, 42.60, F1, -34.60, 3.2, 2.6, 0x6a7684);
  bookshelf(k, 39.62, F1, -36.60, { rotY: Math.PI / 2, w: 1.3, h: 1.7 });
  floorLamp(k, 44.60, F1, -33.40, { h: 1.5 });
  artwork(k, 42.60, F1 + 2.05, -31.24, 1.1, 0.8, Math.PI, 0x37485c);
  photoFrame(k, 43.60, F1 + 0.92, -31.82, { rotY: Math.PI, seed: 0 });
  wastebasket(k, 40.90, F1, -33.30, {});
  curtains(k, 41.2, CUR1, IZ0 + 0.22, 1.9, 0, 0xbfb4a6);
  curtains(k, 44.0, CUR1, IZ0 + 0.22, 1.7, 0, 0xbfb4a6);
  lightSwitch(k, R, 45.74, F1 + 1.15, -31.60, { rotY: -Math.PI / 2 });
}

function dressFamilyBath(k, P, R) {
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
  lightSwitch(k, R, 45.74, F1 + 1.15, -29.45, { rotY: -Math.PI / 2 });
}

function dressLanding(k, P, R) {
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
  lightSwitch(k, R, 48.05, F1 + 1.15, -25.80, { rotY: Math.PI });
}

function dressBedOne(k, P, R) {
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
  bookshelf(k, 50.30, F1, -25.42, { rotY: 0, w: 1.5, h: 1.8 });
  desk(k, 51.20, F1, -22.60, { rotY: -Math.PI / 2, w: 1.4, d: 0.68 });
  officeChair(k, 50.10, F1, -22.60, { rotY: Math.PI / 2, color: 0x37485c });
  bookStack(k, 51.20, F1 + 0.765, -23.10, { n: 3, w: 0.22 });
  photoFrame(k, 45.84, F1 + 0.92, -16.85, { rotY: Math.PI, seed: 2 });
  artwork(k, 39.42, F1 + 2.10, -21.90, 1.2, 0.85, Math.PI / 2, 0x4b5a68);
  wastebasket(k, 44.60, F1, -19.20, {});
  plant(k, 47.00, F1, -24.60, 1.15);
  curtains(k, 41.4, CUR1, IZ1 - 0.22, 2.0, Math.PI, 0xc9bcae);
  curtains(k, IX0 + 0.22, CUR1, -18.6, 1.9, Math.PI / 2, 0xc9bcae);
  curtains(k, IX0 + 0.22, CUR1, -22.5, 1.7, Math.PI / 2, 0xc9bcae);
  lightSwitch(k, R, 48.05, F1 + 1.15, -25.56, { rotY: 0 });
}

function dressEnsuite(k, P, R) {
  vanity(k, 50.20, F1, -21.05, { rotY: 0, w: 1.5 });
  shower(k, 48.30, F1, -17.05, { w: 1.4, d: 1.4, rotY: Math.PI });
  toilet(k, 51.32, F1, -19.40, { rotY: -Math.PI / 2 });
  wastebasket(k, 47.85, F1, -20.70, {});
  rug(k, 49.60, F1, -19.40, 1.2, 0.8, 0xd6dee2);
  k.box(0.05, 0.05, 0.90, P.chrome, 47.62, F1 + 1.40, -18.90, { tile: 0.3 });
  k.box(0.10, 0.62, 0.34, k.M.paint(0xe8eef2, 0.95, 'ghTowel'), 47.66, F1 + 1.11, -18.90, { tile: 0.4 });
  lightSwitch(k, R, 47.53, F1 + 1.15, -20.20, { rotY: Math.PI / 2 });
}

function dressGarage(k, P, R) {
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
    k.box(0.05, 0.30 + (i % 3) * 0.08, 0.07, M.solid(tools[i % 5], 0.6), GIX1 - 0.08, F0 + 1.72, tz, { tile: 0.2 });
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
  // a tool chest, tyres, a bike and a bin, all pushed into the corners the
  // cars do not use
  k.box(0.70, 0.95, 1.20, M.paint(0xb3231f, 0.45, 'ghToolChest'), 37.80, F0 + 0.48, -25.10, { tile: 0.5 });
  for (let i = 0; i < 4; i++) k.box(0.66, 0.06, 1.10, P.black, 37.80, F0 + 0.24 + i * 0.20, -25.06, { tile: 0.3 });
  k.col(0.74, 1.00, 1.24, 37.80, F0 + 0.48, -25.10);
  for (let i = 0; i < 3; i++) {
    k.box(0.66, 0.22, 0.66, M.get('rubber'), 31.40, F0 + 0.11 + i * 0.22, -37.30, { tile: 0.3 });
  }
  k.col(0.70, 0.70, 0.70, 31.40, F0 + 0.35, -37.30);
  bikeAgainstWall(k, P, 31.10, F0, -25.40);
  k.box(0.56, 0.90, 0.56, M.paint(0x3b4750, 0.6, 'ghBin'), 30.80, F0 + 0.45, -36.30, { tile: 0.4 });
  k.box(0.60, 0.06, 0.60, M.paint(0x2a333a, 0.6, 'ghBinLid'), 30.80, F0 + 0.93, -36.30, { tile: 0.3 });
  k.col(0.60, 0.96, 0.60, 30.80, F0 + 0.48, -36.30);
  // bay markings on the slab
  for (const z of [-34.26, -31.00, -27.74]) {
    k.box(6.4, 0.012, 0.10, M.paint(0xe8e4d6, 0.8, 'ghBayLine'), 34.2, F0 + 0.006, z, { tile: 0.6 });
  }
  wallClock(k, 34.5, F0 + 2.60, GIZ0 + 0.06, 0, { hour: 4, minute: 50 });
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
}

// ───────────────────────────────────────────────────────────────────────────
// Second fix.
//
// The shell, the fitted joinery and the big furniture are all in above.  This
// pass is everything you would only notice once you had lived here a week:
// the logs by the hearth, the game nobody has finished, the kettle, the boots
// inside the front door, the ladder the garage swallowed.  Every piece is
// somewhere a person actually put it — the rule for the whole section is that
// if you cannot say who left it there and why, it does not go in.
//
// Placement rules that everything below obeys:
//   • it stands on a real surface — worktops at F+0.93, the island at F+0.95,
//     the dining table at F+0.785, consoles at F+0.88, dressers at F+0.90;
//   • it clears the door swings, the stair, the bay openings and the aisles;
//   • anything you would walk into gets a collider, anything you would knock
//     over with your hand does not;
//   • every lamp declares its light AND carries a lit body, and anything
//     hanging on plaster stays under an intensity of 1.
// ───────────────────────────────────────────────────────────────────────────
function secondFix(world, k, P) {
  livingSecond(k, P);
  kitchenSecond(k, P);
  diningSecond(world, k, P);
  hallSecond(k, P);
  showerSecond(k, P);
  utilitySecond(k, P);
  bedTwoSecond(k, P);
  familyBathSecond(k, P);
  landingSecond(k, P);
  bedOneSecond(k, P);
  ensuiteSecond(k, P);
  garageSecond(k, P);
}

// ── the living room ────────────────────────────────────────────────────────
function livingSecond(k, P) {
  // Sconces either side of the chimney breast.  Anything this close to
  // plaster stays under 1: at a third of a metre even a modest bulb burns a
  // white disc into the wall behind it and the whole gable goes flat.
  for (const x of [43.90, 47.10]) {
    sconce(k, x, F0 + 1.85, IZ1 - 0.03, Math.PI, { intensity: 0.9 });
  }

  logBasket(k, P, 43.60, F0, -16.72);          // west of the hearth, off the rug
  fireIrons(k, P, 47.05, F0, -16.80);          // east of it, where the hand falls

  // Four moves old and white is a pawn up.  It shares the coffee table with
  // the magazines and the book stack that were already on it, so it sits in
  // the gap between them rather than on top of either.
  chessSet(k, 45.30, F0 + 0.43, -18.25);

  // The record player lives on the console under the window; the sleeves
  // stand on the shelf below it, which is exactly what that shelf is for.
  radio(k, 39.62, F0 + 0.88, -20.40, { rotY: HALF });
  records(k, 39.62, F0 + 0.241, -20.94, 7);

  // The front door end: a mat clear of the leaf's swing, the boots that came
  // off on it, and the chest under the east window with the games on top.
  rug(k, 40.35, F0, -22.00, 1.10, 0.80, 0x4f4941);
  bootPair(k, 39.58, F0, -22.72, { color: 0x35424b });
  blanketChest(k, P, 51.40, F0, -22.35);
}

// ── the kitchen ────────────────────────────────────────────────────────────
function kitchenSecond(k, P) {
  const M = k.M;
  const back = -30.78, cy = F0 + 0.93, iy = F0 + 0.95;

  // The stretch of worktop between the bowl and the board is the one nobody
  // cooks on, so it is where the kettle and the tea things end up.
  k.box(0.20, 0.26, 0.20, P.steel, 41.30, cy + 0.13, back - 0.02, { tile: 0.2 });
  k.box(0.06, 0.05, 0.15, P.black, 41.17, cy + 0.19, back - 0.02, { tile: 0.1 });
  k.box(0.09, 0.03, 0.09, P.black, 41.30, cy + 0.27, back - 0.02, { tile: 0.1 });
  knifeBlock(k, P, 41.78, cy, back - 0.04);
  for (let i = 0; i < 3; i++) {
    const c = [0xd8cfbe, 0xc9d4cb, 0xdfe3e8][i];
    k.box(0.13, 0.19, 0.13, M.paint(c, 0.4, `ghJar${i}`), 42.02 + i * 0.18, cy + 0.095, back - 0.06, { tile: 0.15 });
    k.box(0.135, 0.02, 0.135, P.walnut, 42.02 + i * 0.18, cy + 0.20, back - 0.06, { tile: 0.1 });
  }
  // coffee machine on the short run, cup already under the group head
  k.box(0.30, 0.34, 0.30, M.paint(0x2b2f35, 0.4, 'ghEspresso'), 45.72, cy + 0.17, back - 0.02, { tile: 0.2 });
  k.box(0.24, 0.04, 0.18, P.chrome, 45.72, cy + 0.09, back + 0.09, { tile: 0.1 });
  k.box(0.05, 0.09, 0.05, P.chrome, 45.72, cy + 0.20, back + 0.10, { tile: 0.1 });
  mug(k, 45.72, cy + 0.11, back + 0.11, 0xe8e4db);
  // a tea towel over the oven rail — the one thing always hanging on a range
  k.box(0.28, 0.34, 0.03, M.paint(0x9fc6d4, 0.95, 'ghTeaTowel'), 44.40, F0 + 0.63, back + 0.40, { tile: 0.2 });

  // The island: the recipe propped where whoever is on a stool can read it,
  // two mugs at the west end, the rack of plates draining east of the basin.
  openBook(k, 46.60, iy, -28.58, { rotY: Math.PI, stand: true, color: 0x8c3b3b, w: 0.16 });
  mug(k, 44.52, iy, -28.62, 0xd0342c);
  mug(k, 44.74, iy, -28.54, 0xe8e4db);
  dishRack(k, P, 46.35, iy, -29.12);

  // herbs on the cill of the east window, and a second shelf over the first
  plant(k, 51.66, F0 + 0.905, -29.24, 0.34);
  plant(k, 51.66, F0 + 0.905, -28.86, 0.30);
  wallShelf(k, 39.44, F0 + 2.24, -28.10, { rotY: HALF, w: 1.0, items: 2 });
}

// ── the dining room ────────────────────────────────────────────────────────
function diningSecond(world, k, P) {
  const tz = -25.30;
  // A pair of candles lit down the middle of the laid table, between the
  // dish and the jug that were already there.  One small warm source between
  // them is enough — the pendant overhead is doing the work.
  for (const x of [44.55, 46.25]) candlestick(k, P, x, F0 + 0.785, tz);
  world.addLight({ pos: V(45.40, F0 + 1.16, tz), color: 0xffb066, intensity: 1.5, decay: 2, distance: 4.5 });

  // the bottle somebody opened before they sat down, on the dresser
  wineBottle(k, 39.72, F0 + 0.91, -25.02);
  wineGlass(k, 39.78, F0 + 0.91, -24.86);
  wineGlass(k, 39.78, F0 + 0.91, -24.72);
  for (const z of [-25.55, -23.65]) sconce(k, IX0 + 0.03, F0 + 1.95, z, HALF, { intensity: 0.9 });
}

// ── the stair hall ─────────────────────────────────────────────────────────
function hallSecond(k, P) {
  const M = k.M;
  // Pictures climbing the flight.  The stairwell is open to the first-floor
  // ceiling, so the run keeps going up past the storey line instead of
  // stopping dead at three metres the way a hung wall normally has to.
  for (const [z, y, w, h, c] of [
    [-36.50, 2.48, 0.70, 0.55, 0x4b5a68],
    [-35.60, 3.11, 0.55, 0.75, 0x6b5b45],
    [-34.70, 3.75, 0.70, 0.55, 0x5a6b57],
  ]) artwork(k, 45.99, y, z, w, h, HALF, c);

  // a lamp on the console in front of the mirror, the dish the keys land in,
  // and the post nobody has opened yet
  tableLamp(k, 51.42, -33.00, F0 + 0.88);
  k.box(0.16, 0.035, 0.16, M.paint(0x9aa8b4, 0.4, 'ghKeyDish'), 51.42, F0 + 0.90, -32.70, { tile: 0.1 });
  for (let i = 0; i < 3; i++) {
    k.box(0.20, 0.006, 0.13, M.paint([0xf2ede1, 0xe8e4db, 0xf6f2e6][i], 0.85, `ghPost${i}`),
      51.42, F0 + 0.886 + i * 0.007, -33.32 + i * 0.012, { rotY: 0.12 - i * 0.14, tile: 0.1 });
  }
  rug(k, 49.40, F0, -34.60, 1.10, 4.00, 0x6b4f3a);
  void P;
}

// ── the ground-floor shower room ───────────────────────────────────────────
function showerSecond(k, P) {
  robeHook(k, P, 45.81, F0 + 1.70, -36.20, -HALF, 0x7a8b93);
  rollHolder(k, P, 45.55, F0 + 0.74, IZ0 + 0.02, 0);
  // a shelf over the cistern with the spares rolled on it
  k.box(0.86, 0.04, 0.24, P.walnut, 44.90, F0 + 1.58, IZ0 + 0.12, { tile: 0.3 });
  for (const s of [-1, 1]) k.box(0.04, 0.14, 0.18, P.chrome, 44.90 + s * 0.34, F0 + 1.50, IZ0 + 0.12, { tile: 0.2 });
  towelRolls(k, 44.90, F0 + 1.60, IZ0 + 0.12, { n: 3 });
}

// ── the utility ────────────────────────────────────────────────────────────
function utilitySecond(k, P) {
  const M = k.M;
  // The corner past the machines, which is where the mop, the broom and the
  // bucket live in every house.  Both poles lean on the wall itself and their
  // feet stand clear of the skirting.
  leanTool(k, 39.47, F0, -31.75, { head: 'mop' });
  leanTool(k, 39.47, F0, -31.58, { head: 'broom', h: 1.30 });
  k.box(0.30, 0.28, 0.30, M.paint(0x3f6ea8, 0.55, 'ghBucket'), 39.90, F0 + 0.14, -32.05, { tile: 0.2 });
  k.box(0.33, 0.03, 0.33, M.paint(0x2f5a86, 0.6, 'ghBucketRim'), 39.90, F0 + 0.28, -32.05, { tile: 0.2 });

  // the board folded against the wall between the two doors, and the corkboard
  // the whole house runs off
  ironingBoard(k, P, 42.30, F0, -31.52);
  noticeBoard(k, P, 44.60, F0 + 1.72, -31.30, Math.PI);
}

// ── bedroom two ────────────────────────────────────────────────────────────
function bedTwoSecond(k, P) {
  // Reading sconces over the bed head, clear of the headboard's top rail;
  // one side has the nightstand lamp, the other has nothing, so both guests
  // get a light they can turn off without getting up.
  for (const z of [-35.45, -34.15]) sconce(k, 45.79, F1 + 1.75, z, -HALF, { intensity: 0.9 });

  // A guest's case, still open on the rack at the foot of the bed, and the
  // slippers that came out of it first.
  luggageRack(k, P, 42.85, F1, -34.85);
  suitcase(k, 42.85, F1 + 0.47, -34.85, { color: 0x6b4a33 });
  slippers(k, 43.28, F1, -35.35, 0x4a3355);
  jug(k, 44.10, F1 + 0.91, -31.52, { scale: 0.9, fill: 0xdfe8ee });
}

// ── the family bathroom ────────────────────────────────────────────────────
function familyBathSecond(k, P) {
  bathRack(k, P, 39.80, F1 + 0.62, -26.60);
  robeHook(k, P, 43.00, F1 + 1.70, -25.76, Math.PI, 0x6b7a54);
  rollHolder(k, P, 45.79, F1 + 0.74, -30.30, -HALF);
  // a stool with the clean towels folded on it, and something green in the
  // corner the bath does not reach
  k.box(0.38, 0.40, 0.38, P.walnut, 41.80, F1 + 0.20, -26.45, { tile: 0.3 });
  k.box(0.42, 0.04, 0.42, P.walnut, 41.80, F1 + 0.42, -26.45, { tile: 0.3 });
  k.col(0.44, 0.46, 0.44, 41.80, F1 + 0.22, -26.45);
  towelRolls(k, 41.80, F1 + 0.44, -26.45, { n: 2, color: 0xdfe8ec });
  plant(k, 44.55, F1, -29.35, 0.85);
}

// ── the landing ────────────────────────────────────────────────────────────
function landingSecond(k, P) {
  // A linen chest under the north window with a lamp on it: the landing is
  // long and its two ceiling fittings both sit south of here.
  dresser(k, 49.80, F1, -37.32, { rotY: 0, w: 1.40 });
  tableLamp(k, 49.80, -37.30, F1 + 0.90);
  photoFrame(k, 49.20, F1 + 0.91, -37.28, { rotY: 0, seed: 3 });
  towelRolls(k, 51.35, F1 + 0.53, -28.70, { n: 2, alongZ: true, color: 0xe8eef2 });
  plant(k, 48.30, F1, -37.30, 1.05);
  void P;
}

// ── bedroom one ────────────────────────────────────────────────────────────
function bedOneSecond(k, P) {
  for (const x of [40.90, 44.10]) sconce(k, x, F1 + 1.55, -25.575, 0, { intensity: 0.9 });

  // The armchair by the west window gets a footstool; the tray somebody
  // carried up sits on the end of the bench, not in the middle of it.
  k.box(0.50, 0.18, 0.42, k.M.paint(0x7b8a92, 0.9, 'ghFootstool'), 41.45, F1 + 0.31, -18.60, { tile: 0.3 });
  for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    k.box(0.05, 0.24, 0.05, P.walnut, 41.45 + ox * 0.19, F1 + 0.12, -18.60 + oz * 0.15, { tile: 0.2 });
  }
  k.col(0.52, 0.40, 0.44, 41.45, F1 + 0.20, -18.60);
  teaTray(k, P, 43.05, F1 + 0.53, -22.55);

  // a book left face-down on the duvet, and the glasses on the nightstand
  openBook(k, 42.90, F1 + 0.63, -23.90, { rotY: 0.3, color: 0x3f5c3a });
  readingGlasses(k, P, 44.02, F1 + 0.56, -25.02);
  tallMirror(k, 47.30, F1, -20.20, { rotY: -HALF, w: 0.80, h: 1.60, base: 0.55 });
}

// ── the ensuite ────────────────────────────────────────────────────────────
function ensuiteSecond(k, P) {
  // Towel shelf on the east wall — south of the window, not across it: the
  // pane runs z −19.5 → −18.5 and a shelf hung on the glass is the sort of
  // thing you only see once it is built.
  k.box(0.24, 0.04, 0.90, P.walnut, 51.55, F1 + 1.45, -17.95, { tile: 0.3 });
  for (const s of [-1, 1]) k.box(0.18, 0.14, 0.04, P.chrome, 51.55, F1 + 1.37, -17.95 + s * 0.36, { tile: 0.2 });
  towelRolls(k, 51.55, F1 + 1.47, -17.95, { n: 3, alongZ: true });
  robeHook(k, P, 47.49, F1 + 1.66, -19.60, HALF, 0x8a7f6d);
  plant(k, 49.90, F1 + 0.855, -16.30, 0.34);
}

// ── the garage ─────────────────────────────────────────────────────────────
function garageSecond(k, P) {
  // Everything here goes down the east strip, behind where a bonnet stops:
  // the four bays keep x 30.3 → 35.2 clear, the bench and the racking own the
  // wall itself, so the metre and a half between them is the workshop.
  chestFreezer(k, P, 36.95, F0, -36.35);
  jerryCan(k, 38.25, F0, -37.30, 0xd0342c);
  jerryCan(k, 38.56, F0, -37.30, 0x2f6f4a);
  oilDrum(k, P, 36.90, F0, -34.60);
  hoseReel(k, P, 35.10, F0 + 1.75, GIZ0 + 0.02);

  // a job half set up in front of the bench: two horses, a plank across them,
  // the stool pulled round and the jack left where it was last used
  sawhorse(k, P, 36.90, F0, -29.60);
  sawhorse(k, P, 36.90, F0, -28.40);
  k.box(0.28, 0.045, 2.10, P.walnut, 36.90, F0 + 0.80, -29.00, { tile: 0.6 });
  barstool(k, 37.55, -27.30, F0, { rotY: HALF });
  floorJack(k, P, 36.60, F0, -26.60);
  for (const z of [-27.10, -26.10]) axleStand(k, P, 35.95, F0, z);

  // the ladder against the south wall, south of where a car in bay four ends
  stepLadder(k, P, 33.20, F0, -24.80);
  extinguisher(k, P, 38.86, F0 + 1.15, -31.30, -HALF);
  // the year, pinned to the pegboard over the bench
  wallCalendar(k, P, 38.82, F0 + 2.02, -29.60, -HALF);
}

// ───────────────────────────────────────────────────────────────────────────
// The pieces themselves.  All boxes, all batched, colliders only where a
// player could walk into the thing.
// ───────────────────────────────────────────────────────────────────────────

/** A basket of split logs — the fire above it is a real one. */
function logBasket(k, P, x, y, z) {
  const M = k.M;
  const wire = M.paint(0x2f3238, 0.6, 'ghLogBasket');
  const bark = M.get('bark');
  const cut = M.paint(0xc7a878, 0.9, 'ghLogEnd');
  for (const [dx, dz, w, d] of [[0, -0.25, 0.52, 0.04], [0, 0.25, 0.52, 0.04], [-0.25, 0, 0.04, 0.54], [0.25, 0, 0.04, 0.54]]) {
    k.box(w, 0.34, d, wire, x + dx, y + 0.17, z + dz, { tile: 0.3 });
  }
  k.box(0.50, 0.03, 0.50, wire, x, y + 0.02, z, { tile: 0.3 });
  // Split logs, stacked with a gap between each and both sawn ends showing:
  // packed tight they merge into one brown slab the moment they are batched.
  for (const [ox, oy, oz, r, len] of [
    [-0.06, 0.20, -0.13, 0.10, 0.40], [0.04, 0.20, 0.05, -0.08, 0.42],
    [-0.02, 0.33, -0.05, 0.26, 0.38], [0.05, 0.34, 0.12, -0.20, 0.36],
    [-0.04, 0.45, 0.02, 0.55, 0.34],
  ]) {
    k.box(len, 0.11, 0.11, bark, x + ox, y + oy, z + oz, { rotY: r, rotZ: 0.03, tile: 0.2 });
    for (const s of [-1, 1]) {
      k.box(0.03, 0.105, 0.105, cut,
        x + ox + s * (len / 2) * Math.cos(r), y + oy + 0.004, z + oz - s * (len / 2) * Math.sin(r),
        { rotY: r, tile: 0.1 });
    }
  }
  k.col(0.56, 0.46, 0.58, x, y + 0.23, z);
  void P;
}

/** Poker, brush and shovel on their stand, at the hand-side of the hearth. */
function fireIrons(k, P, x, y, z) {
  const M = k.M;
  const iron = M.paint(0x1e2124, 0.45, 'ghFireIron');
  k.box(0.18, 0.025, 0.18, iron, x, y + 0.012, z, { tile: 0.15 });
  k.box(0.03, 0.86, 0.03, iron, x, y + 0.44, z, { tile: 0.2 });
  k.box(0.15, 0.03, 0.15, iron, x, y + 0.88, z, { tile: 0.15 });
  k.box(0.05, 0.05, 0.05, P.gold, x, y + 0.91, z, { tile: 0.1 });
  const tools = [[-0.055, 0.02], [0.05, -0.03], [0.01, 0.055]];
  for (let i = 0; i < 3; i++) {
    const [ox, oz] = tools[i];
    k.box(0.022, 0.66, 0.022, iron, x + ox, y + 0.50, z + oz, { tile: 0.15 });
    k.box(0.03, 0.06, 0.03, P.gold, x + ox, y + 0.85, z + oz, { tile: 0.1 });
    if (i === 0) k.box(0.02, 0.06, 0.09, iron, x + ox, y + 0.20, z + oz + 0.03, { tile: 0.1 });   // poker crook
    if (i === 1) k.box(0.10, 0.03, 0.11, iron, x + ox, y + 0.18, z + oz, { tile: 0.1 });          // shovel pan
    if (i === 2) k.box(0.08, 0.13, 0.05, M.paint(0x6b5330, 0.9, 'ghHearthBrush'), x + ox, y + 0.22, z + oz, { tile: 0.1 });
  }
}

/**
 * A game four moves old: the queens have come off, white is a pawn up and
 * black is about to lose the exchange.  The taken men lie beside the board,
 * which is the whole difference between a game and a set on display.
 */
function chessSet(k, x, y, z) {
  const M = k.M;
  const s = 0.34, sq = s / 8;
  const cream = M.paint(0xe9e0cc, 0.45, 'ghChessCream');
  const ebony = M.paint(0x2e2823, 0.45, 'ghChessEbony');
  k.box(s + 0.05, 0.026, s + 0.05, M.get('walnut'), x, y + 0.013, z, { tile: 0.2 });
  k.box(s, 0.006, s, cream, x, y + 0.029, z, { tile: 0.2 });
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    if ((i + j) % 2 === 0) continue;
    k.box(sq, 0.004, sq, ebony, x - s / 2 + (i + 0.5) * sq, y + 0.033, z - s / 2 + (j + 0.5) * sq, { tile: 0.1 });
  }
  const men = [
    [4, 0, 0, 0.055], [0, 0, 0, 0.036], [7, 0, 0, 0.036], [2, 2, 0, 0.044],
    [0, 1, 0, 0.026], [1, 1, 0, 0.026], [5, 1, 0, 0.026], [6, 1, 0, 0.026], [7, 1, 0, 0.026], [3, 3, 0, 0.026],
    [4, 7, 1, 0.055], [7, 7, 1, 0.036], [5, 5, 1, 0.044],
    [0, 6, 1, 0.026], [1, 6, 1, 0.026], [5, 6, 1, 0.026], [6, 6, 1, 0.026], [3, 4, 1, 0.026],
  ];
  for (const [f, r, black, h] of men) {
    const mat = black ? ebony : cream;
    const px = x - s / 2 + (f + 0.5) * sq, pz = z - s / 2 + (r + 0.5) * sq;
    k.box(sq * 0.6, h, sq * 0.6, mat, px, y + 0.035 + h / 2, pz, { tile: 0.1 });
    k.box(sq * 0.38, 0.012, sq * 0.38, mat, px, y + 0.041 + h, pz, { tile: 0.1 });
  }
  for (let i = 0; i < 4; i++) {
    k.box(0.05, 0.026, 0.026, i < 2 ? cream : ebony, x + s / 2 + 0.05, y + 0.048, z - 0.09 + i * 0.06,
      { rotY: 0.2 - i * 0.1, tile: 0.1 });
  }
}

/** Sleeves stood on edge, the way records are actually kept. */
function records(k, x, y, z, n) {
  const M = k.M;
  const cols = [0x8c3b3b, 0x2f4f6b, 0x3f5c3a, 0x6b5330, 0x4a3355, 0xa8895b, 0x2b2b2b];
  for (let i = 0; i < n; i++) {
    k.box(0.30, 0.30, 0.010, M.solid(cols[i % cols.length], 0.72), x, y + 0.15, z + i * 0.014,
      { rotZ: 0.02, tile: 0.15 });
  }
}

/** A pair of boots, toes into the room, kicked off against the wall. */
function bootPair(k, x, y, z, o = {}) {
  const M = k.M;
  const col = M.paint(o.color ?? 0x2f4f6b, 0.7, `ghBoot${o.color ?? 0}`);
  const sole = M.paint(0x22262a, 0.92, 'ghBootSole');
  for (const s of [-1, 1]) {
    const bz = z + s * 0.085;
    k.box(0.13, 0.30, 0.14, col, x, y + 0.18, bz, { rotZ: s * 0.05, tile: 0.2 });
    k.box(0.24, 0.10, 0.14, col, x + 0.08, y + 0.06, bz, { rotY: s * 0.09, tile: 0.2 });
    k.box(0.25, 0.03, 0.15, sole, x + 0.08, y + 0.014, bz, { rotY: s * 0.09, tile: 0.2 });
  }
}

/** Blanket chest under a window, with what a house keeps in one on top. */
function blanketChest(k, P, x, y, z) {
  const M = k.M;
  const body = M.paint(0x6f6355, 0.7, 'ghChest');
  k.box(0.46, 0.46, 1.10, body, x, y + 0.23, z, { tile: 0.6 });
  k.box(0.50, 0.05, 1.14, P.walnut, x, y + 0.485, z, { tile: 0.5 });
  for (const s of [-1, 1]) k.box(0.47, 0.03, 0.03, P.gold, x, y + 0.30, z + s * 0.42, { tile: 0.2 });
  k.col(0.50, 0.52, 1.14, x, y + 0.26, z);
  k.box(0.30, 0.05, 0.42, M.solid(0x2f4f6b, 0.72), x, y + 0.535, z - 0.28, { rotY: 0.12, tile: 0.2 });
  k.box(0.28, 0.05, 0.40, M.solid(0x8c3b3b, 0.72), x, y + 0.585, z - 0.30, { rotY: -0.08, tile: 0.2 });
  k.box(0.36, 0.12, 0.44, M.paint(0xb5a181, 0.96, 'ghChestThrow'), x, y + 0.57, z + 0.28, { tile: 0.3 });
}

/** Candle in a stick, lit — the flame is its own emissive body. */
function candlestick(k, P, x, y, z) {
  const M = k.M;
  k.box(0.09, 0.02, 0.09, P.gold, x, y + 0.01, z, { tile: 0.1 });
  k.box(0.028, 0.20, 0.028, P.gold, x, y + 0.12, z, { tile: 0.1 });
  k.box(0.055, 0.02, 0.055, P.gold, x, y + 0.23, z, { tile: 0.1 });
  k.box(0.026, 0.15, 0.026, M.paint(0xf2ead6, 0.7, 'ghCandle'), x, y + 0.315, z, { tile: 0.1 });
  k.box(0.018, 0.035, 0.018, M.emissive(0xffb347, 2.4), x, y + 0.408, z, { tile: 0.1 });
}

function wineBottle(k, x, y, z) {
  const M = k.M;
  const g = M.paint(0x1f3a2a, 0.25, 'ghBottle');
  k.box(0.08, 0.20, 0.08, g, x, y + 0.10, z, { tile: 0.1 });
  k.box(0.055, 0.06, 0.055, g, x, y + 0.22, z, { tile: 0.1 });
  k.box(0.032, 0.11, 0.032, g, x, y + 0.30, z, { tile: 0.1 });
  k.box(0.034, 0.04, 0.034, M.paint(0x8c3b3b, 0.6, 'ghFoil'), x, y + 0.37, z, { tile: 0.1 });
  k.box(0.083, 0.07, 0.083, M.paint(0xe8e0cc, 0.75, 'ghLabel'), x, y + 0.10, z, { tile: 0.1 });
}

function wineGlass(k, x, y, z) {
  const M = k.M, g = M.get('glass');
  k.box(0.07, 0.01, 0.07, g, x, y + 0.005, z, { tile: 0.1 });
  k.box(0.012, 0.08, 0.012, g, x, y + 0.05, z, { tile: 0.1 });
  k.box(0.07, 0.10, 0.07, g, x, y + 0.14, z, { tile: 0.1 });
  k.box(0.062, 0.025, 0.062, M.paint(0x7a1f2b, 0.3, 'ghWine'), x, y + 0.115, z, { tile: 0.1 });
}

function mug(k, x, y, z, color) {
  const M = k.M, m = M.paint(color, 0.4, `ghMug${color}`);
  k.box(0.08, 0.09, 0.08, m, x, y + 0.045, z, { tile: 0.1 });
  k.box(0.025, 0.05, 0.03, m, x + 0.05, y + 0.055, z, { tile: 0.1 });
}

/** Knife block, leaned back on its wedge, five handles standing out of it. */
function knifeBlock(k, P, x, y, z) {
  k.box(0.14, 0.24, 0.16, P.walnut, x, y + 0.135, z + 0.01, { rotX: -0.14, tile: 0.15 });
  for (let i = 0; i < 5; i++) {
    k.box(0.02, 0.10, 0.02, P.black, x - 0.05 + i * 0.025, y + 0.295, z + 0.045, { rotX: -0.14, tile: 0.1 });
  }
}

/** Plates draining beside a sink. */
function dishRack(k, P, x, y, z) {
  const M = k.M;
  k.box(0.40, 0.025, 0.30, P.chrome, x, y + 0.013, z, { tile: 0.2 });
  for (let i = 0; i < 5; i++) k.box(0.012, 0.10, 0.28, P.chrome, x - 0.14 + i * 0.07, y + 0.06, z, { tile: 0.1 });
  for (let i = 0; i < 3; i++) {
    k.box(0.018, 0.19, 0.19, M.paint(0xf7f5f0, 0.32, 'china'), x - 0.105 + i * 0.07, y + 0.115, z, { tile: 0.1 });
  }
  k.box(0.09, 0.10, 0.09, M.paint(0xd0342c, 0.4, `ghMug${0xd0342c}`), x + 0.13, y + 0.06, z + 0.02, { rotZ: 0.5, tile: 0.1 });
}

/** Towels rolled and stacked on a shelf; `alongZ` for a shelf that runs in z. */
function towelRolls(k, x, y, z, o = {}) {
  const M = k.M, n = o.n ?? 3, col = o.color ?? 0xe8eef2;
  const m = M.paint(col, 0.95, `ghRoll${col}`);
  const band = M.paint(0xb9c8d2, 0.95, 'ghRollBand');
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 0.20;
    const px = o.alongZ ? x : x + off, pz = o.alongZ ? z + off : z;
    k.box(o.alongZ ? 0.17 : 0.16, 0.15, o.alongZ ? 0.16 : 0.17, m, px, y + 0.075, pz, { tile: 0.15 });
    k.box(o.alongZ ? 0.175 : 0.05, 0.06, o.alongZ ? 0.05 : 0.175, band, px, y + 0.075, pz, { tile: 0.1 });
  }
}

/** A hook with a robe on it — the plate sits on the wall, the robe hangs. */
function robeHook(k, P, x, y, z, rotY, color) {
  const M = k.M;
  const nx = Math.sin(rotY), nz = Math.cos(rotY);
  const cx = Math.cos(rotY), cz = -Math.sin(rotY);      // along the wall
  k.box(0.20, 0.05, 0.03, P.chrome, x, y, z, { rotY, tile: 0.1 });
  for (const s of [-1, 1]) {
    k.box(0.03, 0.03, 0.08, P.chrome, x + nx * 0.04 + cx * s * 0.06, y - 0.012, z + nz * 0.04 + cz * s * 0.06,
      { rotY, tile: 0.1 });
  }
  const cloth = M.paint(color, 0.94, `ghRobe${color}`);
  k.box(0.34, 0.55, 0.10, cloth, x + nx * 0.08, y - 0.32, z + nz * 0.08, { rotY, tile: 0.3 });
  k.box(0.27, 0.44, 0.09, cloth, x + nx * 0.08, y - 0.75, z + nz * 0.08, { rotY, tile: 0.3 });
  k.box(0.05, 0.26, 0.05, cloth, x + nx * 0.10 + cx * 0.15, y - 0.58, z + nz * 0.10 + cz * 0.15, { rotY, tile: 0.2 });
}

function rollHolder(k, P, x, y, z, rotY) {
  const nx = Math.sin(rotY), nz = Math.cos(rotY);
  k.box(0.06, 0.10, 0.02, P.chrome, x, y, z, { rotY, tile: 0.1 });
  k.box(0.03, 0.03, 0.12, P.chrome, x + nx * 0.07, y, z + nz * 0.07, { rotY, tile: 0.1 });
  k.box(0.12, 0.12, 0.12, k.M.paint(0xf7f5ee, 0.9, 'ghRollPaper'), x + nx * 0.13, y, z + nz * 0.13, { rotY, tile: 0.1 });
}

/** Mop or broom, leaning on the wall with its foot clear of the skirting. */
function leanTool(k, x, y, z, o = {}) {
  const M = k.M, h = o.h ?? 1.34, tilt = o.tilt ?? 0.16;
  const dx = (h / 2) * Math.sin(tilt);                  // the foot stands out this far
  k.box(0.035, h, 0.035, M.get('maple'), x, y + (h / 2) * Math.cos(tilt), z, { rotZ: tilt, tile: 0.2 });
  if (o.head === 'mop') {
    k.box(0.14, 0.22, 0.14, M.paint(0xb9c2c8, 0.95, 'ghMopHead'), x + dx, y + 0.11, z, { tile: 0.2 });
  } else {
    k.box(0.30, 0.08, 0.09, M.get('walnut'), x + dx, y + 0.16, z, { tile: 0.2 });
    k.box(0.28, 0.13, 0.08, M.paint(0x9a8b78, 0.9, 'ghBristle'), x + dx, y + 0.065, z, { tile: 0.2 });
  }
}

/** The board, folded and stood against the wall with its legs shut. */
function ironingBoard(k, P, x, y, z) {
  const M = k.M, h = 1.30, tilt = 0.13;
  const c = Math.cos(tilt), s = Math.sin(tilt);
  k.box(0.38, h, 0.05, M.paint(0xd7e3e8, 0.9, 'ghIroningTop'), x, y + (h / 2) * c, z + (h / 2) * s,
    { rotX: tilt, tile: 0.4 });
  for (const sx of [-1, 1]) {
    k.box(0.035, h - 0.24, 0.035, P.steel, x + sx * 0.10, y + ((h - 0.24) / 2) * c + 0.10, z + ((h - 0.24) / 2) * s - 0.05,
      { rotX: tilt, tile: 0.2 });
  }
  k.col(0.44, h, 0.28, x, y + h / 2, z + 0.06);
}

/** Cork board: the school letter, the takeaway menu, two lists. */
function noticeBoard(k, P, x, y, z, rotY) {
  const M = k.M;
  const nx = Math.sin(rotY), nz = Math.cos(rotY);
  const cx = Math.cos(rotY), cz = -Math.sin(rotY);
  k.box(0.62, 0.46, 0.03, P.walnut, x, y, z, { rotY, tile: 0.3 });
  k.box(0.54, 0.38, 0.02, M.paint(0xc9a06a, 0.9, 'ghCork'), x + nx * 0.02, y, z + nz * 0.02, { rotY, tile: 0.2 });
  const pins = [[-0.16, 0.08, 0xf6f2e6], [0.07, 0.10, 0xd7e3e8], [0.15, -0.08, 0xf0e2c0], [-0.09, -0.09, 0xe8eef2]];
  for (const [ox, oy, c] of pins) {
    k.box(0.13, 0.11, 0.006, M.solid(c, 0.9), x + nx * 0.035 + cx * ox, y + oy, z + nz * 0.035 + cz * ox,
      { rotY, tile: 0.1 });
  }
}

/** Folding rack for a case, the kind that lives at the foot of a guest bed. */
function luggageRack(k, P, x, y, z) {
  const M = k.M;
  const strap = M.paint(0x6b5330, 0.85, 'ghStrap');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.box(0.05, 0.46, 0.05, P.walnut, x + sx * 0.26, y + 0.23, z + sz * 0.20, { rotZ: sx * 0.10, tile: 0.2 });
  }
  for (const sz of [-1, 1]) k.box(0.58, 0.04, 0.04, P.walnut, x, y + 0.44, z + sz * 0.20, { tile: 0.2 });
  for (let i = 0; i < 4; i++) k.box(0.56, 0.02, 0.06, strap, x, y + 0.46, z - 0.15 + i * 0.10, { tile: 0.2 });
  k.col(0.62, 0.50, 0.50, x, y + 0.25, z);
}

/** A case still open, half unpacked. */
function suitcase(k, x, y, z, o = {}) {
  const M = k.M;
  const hide = M.paint(o.color ?? 0x6b4a33, 0.6, `ghCase${o.color ?? 0}`);
  const trim = M.paint(0x2f2a24, 0.6, 'ghCaseTrim');
  const lin = M.paint(0xe8eef2, 0.95, 'ghCaseLinen');
  k.box(0.60, 0.18, 0.42, hide, x, y + 0.09, z, { tile: 0.3 });
  k.box(0.62, 0.03, 0.44, trim, x, y + 0.185, z, { tile: 0.2 });
  k.box(0.48, 0.06, 0.32, lin, x, y + 0.20, z + 0.02, { tile: 0.2 });
  k.box(0.30, 0.05, 0.24, M.solid(0x2f6fb5, 0.9), x - 0.08, y + 0.245, z + 0.02, { rotY: 0.2, tile: 0.2 });
  // the lid, hinged at the back and standing open
  const a = 1.1, ca = Math.cos(a), sa = Math.sin(a);
  k.box(0.60, 0.05, 0.42, hide, x, y + 0.19 + 0.21 * sa, z - 0.21 - 0.21 * ca, { rotX: a, tile: 0.3 });
}

function slippers(k, x, y, z, color) {
  const M = k.M, m = M.paint(color, 0.92, `ghSlipper${color}`);
  for (const s of [-1, 1]) {
    k.box(0.11, 0.05, 0.26, m, x + s * 0.07, y + 0.025, z + s * 0.02, { rotY: s * 0.14, tile: 0.15 });
    k.box(0.11, 0.08, 0.11, m, x + s * 0.07, y + 0.06, z + s * 0.02 - 0.07, { rotY: s * 0.14, tile: 0.15 });
  }
}

/** The board across the bath: a book, a candle, the sponge. */
function bathRack(k, P, x, y, z) {
  const M = k.M;
  k.box(1.02, 0.03, 0.16, M.get('maple'), x, y, z, { tile: 0.3 });
  for (const s of [-1, 1]) k.box(0.05, 0.05, 0.16, M.get('maple'), x + s * 0.46, y - 0.035, z, { tile: 0.2 });
  openBook(k, x - 0.17, y + 0.015, z, { rotY: HALF, color: 0x4a3355, w: 0.14, d: 0.19 });
  k.box(0.07, 0.09, 0.07, M.paint(0xe8e4db, 0.5, 'ghBathCandle'), x + 0.20, y + 0.06, z, { tile: 0.1 });
  k.box(0.02, 0.03, 0.02, M.emissive(0xffb347, 2.2), x + 0.20, y + 0.12, z, { tile: 0.1 });
  k.box(0.11, 0.07, 0.11, M.paint(0xf0d8b0, 0.92, 'ghSponge'), x + 0.37, y + 0.05, z, { tile: 0.1 });
  void P;
}

/** Tea for two, carried up and left on the end of the bench. */
function teaTray(k, P, x, y, z) {
  const M = k.M;
  const china = M.paint(0xf7f5f0, 0.32, 'china');
  k.box(0.44, 0.02, 0.32, P.walnut, x, y + 0.01, z, { tile: 0.2 });
  for (const s of [-1, 1]) k.box(0.44, 0.04, 0.02, P.walnut, x, y + 0.03, z + s * 0.15, { tile: 0.1 });
  k.box(0.17, 0.14, 0.15, china, x - 0.10, y + 0.09, z, { tile: 0.1 });
  k.box(0.05, 0.03, 0.08, china, x - 0.20, y + 0.11, z, { tile: 0.1 });
  k.box(0.06, 0.035, 0.06, P.gold, x - 0.10, y + 0.175, z, { tile: 0.1 });
  for (const s of [-1, 1]) mug(k, x + 0.12, y + 0.02, z + s * 0.08, 0xf7f5f0);
}

/** Reading glasses, folded, left where they were taken off. */
function readingGlasses(k, P, x, y, z) {
  const M = k.M;
  const frame = M.paint(0x3a3128, 0.4, 'ghSpecs');
  k.box(0.12, 0.008, 0.035, frame, x, y + 0.008, z, { rotY: 0.3, tile: 0.05 });
  for (const s of [-1, 1]) k.box(0.04, 0.006, 0.032, M.get('glass'), x + s * 0.032, y + 0.012, z + s * 0.010, { rotY: 0.3, tile: 0.05 });
  k.box(0.10, 0.006, 0.01, frame, x + 0.08, y + 0.006, z - 0.03, { rotY: 0.9, tile: 0.05 });
  void P;
}

// ── garage pieces ──────────────────────────────────────────────────────────
function chestFreezer(k, P, x, y, z) {
  const M = k.M;
  const shell = M.paint(0xe6e8ea, 0.45, 'ghFreezer');
  k.box(0.72, 0.80, 1.30, shell, x, y + 0.40, z, { tile: 0.5 });
  k.box(0.76, 0.06, 1.34, M.paint(0xdcdfe2, 0.45, 'ghFreezerLid'), x, y + 0.83, z, { tile: 0.4 });
  k.box(0.05, 0.04, 0.34, P.chrome, x + 0.36, y + 0.79, z, { tile: 0.2 });
  k.box(0.08, 0.04, 0.04, M.emissive(0x6fd3ff, 1.1), x - 0.28, y + 0.60, z + 0.66, { tile: 0.1 });
  k.col(0.76, 0.88, 1.34, x, y + 0.44, z);
}

function jerryCan(k, x, y, z, color) {
  const M = k.M, m = M.paint(color, 0.55, `ghJerry${color}`);
  k.box(0.20, 0.42, 0.34, m, x, y + 0.21, z, { tile: 0.2 });
  k.box(0.16, 0.05, 0.24, m, x, y + 0.44, z, { tile: 0.15 });
  k.box(0.03, 0.05, 0.20, m, x, y + 0.48, z - 0.02, { tile: 0.1 });
  k.box(0.05, 0.06, 0.05, M.get('darkPlastic'), x, y + 0.48, z + 0.10, { tile: 0.1 });
}

function oilDrum(k, P, x, y, z) {
  const M = k.M;
  const m = M.paint(0x2f6f4a, 0.55, 'ghDrum');
  const rib = M.paint(0x24593c, 0.6, 'ghDrumRib');
  k.box(0.56, 0.86, 0.56, m, x, y + 0.43, z, { tile: 0.4 });
  for (const oy of [0.28, 0.58]) k.box(0.59, 0.04, 0.59, rib, x, y + oy, z, { tile: 0.2 });
  k.box(0.60, 0.03, 0.60, P.steel, x, y + 0.865, z, { tile: 0.2 });
  k.box(0.10, 0.025, 0.10, P.chrome, x + 0.16, y + 0.89, z - 0.04, { tile: 0.1 });
  // the funnel somebody left standing on the lid
  k.box(0.18, 0.09, 0.18, M.paint(0xd0342c, 0.6, 'ghFunnel'), x - 0.13, y + 0.925, z + 0.07, { tile: 0.1 });
  k.box(0.05, 0.12, 0.05, M.paint(0xd0342c, 0.6, 'ghFunnel'), x - 0.13, y + 1.02, z + 0.07, { tile: 0.1 });
  k.col(0.60, 0.90, 0.60, x, y + 0.45, z);
}

function sawhorse(k, P, x, y, z) {
  k.box(0.10, 0.08, 0.90, P.walnut, x, y + 0.74, z, { tile: 0.3 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.box(0.055, 0.74, 0.055, P.walnut, x + sx * 0.20, y + 0.37, z + sz * 0.34,
      { rotZ: sx * 0.24, rotX: -sz * 0.10, tile: 0.2 });
  }
  k.col(0.52, 0.80, 0.94, x, y + 0.40, z);
}

/** Hose on its bracket, hung in a hank the way it comes off the reel. */
function hoseReel(k, P, x, y, z) {
  const M = k.M;
  const hose = M.paint(0x2f6f4a, 0.82, 'ghHose');
  k.box(0.40, 0.06, 0.06, P.black, x, y + 0.24, z + 0.05, { tile: 0.2 });
  for (const s of [-1, 1]) k.box(0.05, 0.30, 0.06, P.black, x + s * 0.18, y + 0.10, z + 0.05, { tile: 0.2 });
  for (let i = 0; i < 4; i++) {
    k.box(0.40 - i * 0.05, 0.06, 0.14 + i * 0.02, hose, x, y - i * 0.07, z + 0.13, { tile: 0.2 });
  }
  k.box(0.05, 0.05, 0.16, P.chrome, x + 0.16, y - 0.30, z + 0.13, { tile: 0.1 });
}

function floorJack(k, P, x, y, z) {
  const M = k.M;
  const body = M.paint(0xb3231f, 0.5, 'ghJack');
  k.box(0.26, 0.14, 0.62, body, x, y + 0.10, z, { tile: 0.2 });
  k.box(0.11, 0.10, 0.11, P.steel, x, y + 0.21, z - 0.08, { tile: 0.1 });
  k.box(0.05, 0.05, 0.78, P.black, x, y + 0.36, z + 0.36, { rotX: -0.5, tile: 0.2 });
  for (const s of [-1, 1]) {
    k.box(0.07, 0.07, 0.07, M.get('rubber'), x + s * 0.09, y + 0.035, z - 0.24, { tile: 0.1 });
    k.box(0.07, 0.07, 0.07, M.get('rubber'), x + s * 0.09, y + 0.035, z + 0.26, { tile: 0.1 });
  }
  k.col(0.30, 0.30, 0.70, x, y + 0.15, z);
}

function axleStand(k, P, x, y, z) {
  k.box(0.24, 0.03, 0.24, P.steel, x, y + 0.015, z, { tile: 0.15 });
  for (const s of [-1, 1]) {
    k.box(0.05, 0.36, 0.05, P.steel, x + s * 0.08, y + 0.18, z, { rotZ: s * 0.2, tile: 0.15 });
  }
  k.box(0.06, 0.24, 0.06, P.steel, x, y + 0.30, z, { tile: 0.15 });
  k.box(0.10, 0.04, 0.10, P.steel, x, y + 0.42, z, { tile: 0.1 });
}

function stepLadder(k, P, x, y, z) {
  const M = k.M, h = 2.20, tilt = 0.17;
  const c = Math.cos(tilt), s = Math.sin(tilt);
  const rail = M.paint(0x9aa2a8, 0.5, 'ghLadder');
  for (const sx of [-1, 1]) {
    k.box(0.06, h, 0.05, rail, x + sx * 0.22, y + (h / 2) * c, z + (h / 2) * s, { rotX: tilt, tile: 0.3 });
  }
  for (let i = 0; i < 7; i++) {
    const t = 0.18 + i * 0.30;
    k.box(0.44, 0.03, 0.10, rail, x, y + t * c, z + t * s, { rotX: tilt, tile: 0.2 });
  }
  k.col(0.50, h * 0.94, 0.36, x, y + h / 2, z + 0.20);
  void P;
}

function extinguisher(k, P, x, y, z, rotY) {
  const M = k.M;
  const nx = Math.sin(rotY), nz = Math.cos(rotY);
  k.box(0.10, 0.30, 0.03, P.black, x, y, z, { rotY, tile: 0.1 });
  k.box(0.16, 0.44, 0.16, M.paint(0xb3231f, 0.5, 'ghExt'), x + nx * 0.11, y - 0.02, z + nz * 0.11, { tile: 0.15 });
  k.box(0.07, 0.10, 0.07, P.black, x + nx * 0.11, y + 0.25, z + nz * 0.11, { tile: 0.1 });
  k.box(0.05, 0.05, 0.13, P.black, x + nx * 0.17, y + 0.27, z + nz * 0.17, { rotY, tile: 0.1 });
  k.box(0.10, 0.10, 0.012, M.paint(0xf6f2e6, 0.8, 'ghExtLabel'), x + nx * 0.19, y - 0.04, z + nz * 0.19, { rotY, tile: 0.1 });
}

function wallCalendar(k, P, x, y, z, rotY) {
  const M = k.M;
  const nx = Math.sin(rotY), nz = Math.cos(rotY);
  k.box(0.30, 0.40, 0.008, M.paint(0xf6f2e6, 0.85, 'ghCalendar'), x, y, z, { rotY, tile: 0.1 });
  k.box(0.28, 0.13, 0.010, M.paint(0x2f6fb5, 0.8, 'ghCalendarHead'), x + nx * 0.002, y + 0.13, z + nz * 0.002, { rotY, tile: 0.1 });
  for (let r = 0; r < 4; r++) {
    k.box(0.26, 0.012, 0.010, M.solid(0xb9b2a4, 0.9), x + nx * 0.002, y + 0.02 - r * 0.06, z + nz * 0.002, { rotY, tile: 0.1 });
  }
  void P;
}
