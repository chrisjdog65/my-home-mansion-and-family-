// ───────────────────────────────────────────────────────────────────────────
// Walks the finished room list and fills every one of them with furniture
// appropriate to what it is.
//
// Two passes per room: the layout (what the room is *for*) and then a
// detailing pass — lamps, rugs, wall treatment, the clutter that says someone
// lives here.  Anything hung on a wall or parked against one is checked
// against the plan's doorways first: `k.openings` holds every opening in the
// house, so a shelf on a shared wall dodges the neighbour's door too.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { makeRng } from '../core/rng.js';
import { Batcher } from './build.js';
import {
  Kit, bed, bunkBed, nightstand, dresser, wardrobe, bookshelf, desk, officeChair,
  diningChair, sofa, sectional, armchair, coffeeTable, rug, tv, tvUnit, fireplace,
  counterRun, island, fridge, range, vanity, toilet, bathtub, shower, plant,
  artwork, curtains, barstool, tableLamp,
  // the detailing kit
  sideTable, consoleTable, bench, floorLamp, sconce, lightSwitch, pictureRail,
  wallShelf, tallMirror, poster, bookStack, magazines, vase, fruitBowl, photoFrame,
  wastebasket, laundryBasket, umbrellaStand, coatHooks, radio, boardGame, toyBox,
  softToy, canopy, sportsRack, trophyShelf, dressingTable, wallClock,
  // family life: the table laid, the birthday box, homework and cooking
  placeSetting, servingDish, jug, openBook, cake, balloons, bunting, presents,
  partyHat, paperCup, banner, pencilPot, schoolBag, tablet, gamesConsole,
  cookPot, utensilCrock, mixingBowl, choppingBoard,
} from './furniture.js';
import { theater, bowling, court, gym, gamingRoom, laundry, garage, workshop } from './amenities.js';
import { groundHeight } from './terrain.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// rooms that get a switch plate beside their door.  The theater flips its own
// lights when the film starts, so a second switch there only fights it.
const SWITCHED = new Set([
  'bedroom', 'bath', 'great', 'family', 'kitchen', 'dining', 'library', 'music',
  'foyer', 'sunroom', 'mud', 'pantry', 'storage', 'gaming', 'laundry', 'workshop',
  'garage', 'gym', 'stairhall', 'court', 'bowling',
]);

export function furnishAll(world) {
  const k = new Kit(world);
  const rng = makeRng(4242);
  k.openings = collectOpenings(world);
  k.bounds = houseBounds(world);
  // the consoles register themselves as they are built, from two files
  world.consoles = world.consoles || [];
  let gamingId = 0;

  for (const R of world.rooms) {
    const t = R.type;
    // every room draws from its own seeded stream, so the twenty guest rooms
    // stop rhyming without any of them changing between loads
    const rr = roomRng(R);
    switch (t) {
      case 'bedroom': bedroom(k, R, rr); break;
      case 'bath': bathroom(k, R, rr); break;
      case 'gaming': gamingRoom(k, R, gamingId++); break;
      case 'theater': theater(k, R); break;
      case 'bowling': bowling(k, R); break;
      case 'court': court(k, R); break;
      case 'gym': gym(k, R); break;
      case 'laundry': laundry(k, R); break;
      case 'garage': garage(k, R); break;
      case 'workshop': workshop(k, R); break;
      case 'great': greatRoom(k, R, rr); break;
      case 'family': familyRoom(k, R, rr); break;
      case 'kitchen': kitchen(k, R, rr); break;
      case 'dining': dining(k, R, rr); break;
      case 'library': library(k, R, rr); break;
      case 'music': music(k, R, rr); break;
      case 'foyer': foyer(k, R, rr); break;
      case 'sunroom': sunroom(k, R, rr); break;
      case 'mud': mud(k, R, rr); break;
      case 'stairhall': stairHall(k, R, rr); break;
      case 'corridor': gallery(k, R, rr); break;
      case 'pantry': case 'storage': storage(k, R, rr); break;
      default: break;
    }
    if (SWITCHED.has(t)) roomSwitch(k, R);
    // a little life everywhere — but not in narrow rooms, where the corner
    // pot lands on the nightstands; the family room's west corner holds the
    // bookshelf, so its plant takes the east corner instead
    if (['bedroom', 'great', 'family', 'library', 'foyer', 'dining', 'sunroom', 'music'].includes(t) && R.w >= 7) {
      const px = t === 'family' ? R.x + R.w / 2 - 0.9 : R.x - R.w / 2 + 0.9;
      plant(k, px, R.y, R.z + R.d / 2 - 0.9, rng.range(0.9, 1.3));
    }
  }
  outdoorSpots(world);
  return k;
}

/**
 * Set dressing that is switched on and off — a laid table, a party — is
 * merged into a group of its own instead of the house-wide static batch: the
 * kit writes into a private Batcher, so the whole set is a handful of draw
 * calls that one `visible` flag turns off.
 */
function grouped(k, name, build) {
  const grp = new THREE.Group();
  grp.name = name;
  const prev = k.B;
  k.B = new Batcher(name);
  try {
    build(grp);
  } finally {
    k.B.flush(grp);
    k.B = prev;
  }
  k.world.addProp(grp);
  return grp;
}

/**
 * Places outdoors the family sits at together.  backyard.js builds the picnic
 * tables (and their seats) after this pass runs, but the slab is levelled
 * ground at a height the terrain function already knows, so the spots can be
 * published here — facing across the table, which is the way you sit at one.
 */
function outdoorSpots(world) {
  const cx = 22, cz = 40, y = groundHeight(cx, cz) + 0.12;   // matches picnicArea()
  const tx = cx - 2.4;                                       // the western of the two tables
  world.spot('picnicSeatA', tx - 1.05, y, cz, { rotY: Math.PI / 2 });
  world.spot('picnicSeatB', tx + 1.05, y, cz, { rotY: -Math.PI / 2 });
  world.spot('picnicTable', tx, y, cz);
}

// ── doorways, walls, seeds ─────────────────────────────────────────────────
/** Every opening in the house, in the plane of the wall it is cut through. */
function collectOpenings(world) {
  const list = [];
  for (const R of world.rooms) {
    for (const dd of R.def?.doors || []) {
      const half = dd.w / 2, h = dd.w > 1.6 ? 2.7 : 2.25;   // matches mansion.js
      if (dd.side === 'n' || dd.side === 's') {
        list.push({
          floor: R.floor, axis: 'z', h,
          line: dd.side === 'n' ? R.z - R.d / 2 : R.z + R.d / 2,
          lo: R.x + dd.at - half, hi: R.x + dd.at + half,
        });
      } else {
        list.push({
          floor: R.floor, axis: 'x', h,
          line: dd.side === 'w' ? R.x - R.w / 2 : R.x + R.w / 2,
          lo: R.z + dd.at - half, hi: R.z + dd.at + half,
        });
      }
    }
  }
  return list;
}

function houseBounds(world) {
  const b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const R of world.rooms) {
    b.x0 = Math.min(b.x0, R.x - R.w / 2); b.x1 = Math.max(b.x1, R.x + R.w / 2);
    b.z0 = Math.min(b.z0, R.z - R.d / 2); b.z1 = Math.max(b.z1, R.z + R.d / 2);
  }
  return b;
}

/** Stable per-room seed: the name is unique and never moves. */
function roomRng(R) {
  let h = 2166136261;
  for (const s of `${R.name}|${R.floor}`) h = Math.imul(h ^ s.charCodeAt(0), 16777619);
  return makeRng(h >>> 0);
}

const wallLine = (R, side) => (
  side === 'n' ? R.z - R.d / 2 : side === 's' ? R.z + R.d / 2
    : side === 'w' ? R.x - R.w / 2 : R.x + R.w / 2);

/** A point on one of the room's walls. `along` runs from the wall's centre,
 *  `inset` is how far in from the plaster. Returns [x, z, rotY-facing-in]. */
function onWall(R, side, along, inset = 0) {
  const hw = R.w / 2 - 0.06, hd = R.d / 2 - 0.06;
  if (side === 'n') return [R.x + along, R.z - hd + inset, 0];
  if (side === 's') return [R.x + along, R.z + hd - inset, Math.PI];
  if (side === 'w') return [R.x - hw + inset, R.z + along, Math.PI / 2];
  return [R.x + hw - inset, R.z + along, -Math.PI / 2];
}

/** Exterior walls carry the window grid: nothing gets hung on them. */
function exterior(k, R, side) {
  const b = k.bounds, l = wallLine(R, side);
  return side === 'n' ? Math.abs(l - b.z0) < 0.4 : side === 's' ? Math.abs(l - b.z1) < 0.4
    : side === 'w' ? Math.abs(l - b.x0) < 0.4 : Math.abs(l - b.x1) < 0.4;
}

/** Is the stretch [c ± half] of this wall clear of every doorway in it? */
function wallFree(k, R, side, c, half, pad = 0.4) {
  const horiz = side === 'n' || side === 's';
  const line = wallLine(R, side);
  for (const o of k.openings) {
    if (o.floor !== R.floor || o.axis !== (horiz ? 'z' : 'x')) continue;
    if (Math.abs(o.line - line) > 0.4) continue;
    if (c + half + pad > o.lo && c - half - pad < o.hi) return false;
  }
  return true;
}

/**
 * The spot to hang or park something: null when a doorway (or a window wall)
 * is in the way.  `c` is a world coordinate along the wall — X for n/s walls,
 * Z for e/w.  Everything wall-bound in this file goes through here.
 */
function wallSpot(k, R, side, c, half, o = {}) {
  if (!o.windows && exterior(k, R, side)) return null;
  if (Math.abs(c - (side === 'n' || side === 's' ? R.x : R.z)) + half > (side === 'n' || side === 's' ? R.w : R.d) / 2 - 0.25) return null;
  if (!wallFree(k, R, side, c, half, o.pad ?? 0.35)) return null;
  const along = (side === 'n' || side === 's') ? c - R.x : c - R.z;
  return onWall(R, side, along, o.inset ?? 0.04);
}

/**
 * Is there really a room wall on the far side of this stretch?  The gallery
 * band runs the width of the house, and in places (the great room void, the
 * stair hall) its "wall" is a railing or nothing at all.
 */
function backedByRoom(k, R, side, c) {
  const line = wallLine(R, side);
  return k.world.rooms.some((r) => r.floor === R.floor && r.type !== 'corridor' &&
    c > r.x - r.w / 2 + 0.3 && c < r.x + r.w / 2 - 0.3 &&
    Math.abs((side === 'n' ? r.z + r.d / 2 : r.z - r.d / 2) - line) < 0.4);
}

/** Above the tallest opening in the room, below the ceiling by a hand's width. */
function railHeight(k, R) {
  let top = 2.25;
  for (const o of k.openings) {
    if (o.floor !== R.floor) continue;
    const near = o.axis === 'z'
      ? (Math.abs(o.line - (R.z - R.d / 2)) < 0.4 || Math.abs(o.line - (R.z + R.d / 2)) < 0.4) && o.hi > R.x - R.w / 2 && o.lo < R.x + R.w / 2
      : (Math.abs(o.line - (R.x - R.w / 2)) < 0.4 || Math.abs(o.line - (R.x + R.w / 2)) < 0.4) && o.hi > R.z - R.d / 2 && o.lo < R.z + R.d / 2;
    if (near) top = Math.max(top, o.h);
  }
  return Math.min((R.h || 3.8) - 0.55, top + 0.22);
}

/** Picture rail all the way round, skipping the window walls. */
function railRound(k, R, extraSkip = []) {
  const skip = ['n', 's', 'e', 'w'].filter((s) => exterior(k, R, s) || extraSkip.includes(s));
  if (skip.length === 4) return;
  pictureRail(k, R, { h: railHeight(k, R), skip });
}

/** The switch plate beside the room's own door, on the wider side of it. */
function roomSwitch(k, R) {
  const dd = (R.def?.doors || [])[0];
  if (!dd) return;
  const span = (dd.side === 'n' || dd.side === 's') ? R.w : R.d;
  const half = dd.w / 2;
  const side = (dd.at - half - 0.5 > -span / 2) ? -1 : 1;
  const at = dd.at + side * (half + 0.3);
  if (Math.abs(at) > span / 2 - 0.25) return;
  const [x, z, rotY] = onWall(R, dd.side, at, 0.02);
  lightSwitch(k, R, x, R.y + 1.16, z, { rotY });
}

/** Three things on top of a case piece, drawn from the room's own stream. */
function dressTop(k, x, y, z, rng, o = {}) {
  const r = o.rotY ?? 0, w = o.w ?? 1.4, n = o.n ?? 3;
  const kinds = o.kinds || ['photo', 'vase', 'books', 'bowl', 'mags'];
  for (let i = 0; i < n; i++) {
    const ox = -w / 2 + (i + 0.5) * (w / n);
    const px = x + Math.cos(r) * ox, pz = z - Math.sin(r) * ox;
    switch (rng.pick(kinds)) {
      case 'photo': photoFrame(k, px, y, pz, { rotY: r, color: rng.pick([0x37485c, 0x6b5b45, 0x5a6b57, 0x7a4b96]) }); break;
      case 'vase': vase(k, px, y, pz, { scale: rng.range(0.7, 1.15), color: rng.pick([0xc9d4cb, 0xd8cfbe, 0x9aa8b4]) }); break;
      case 'books': bookStack(k, px, y, pz, { rotY: r, n: rng.int(2, 4) }); break;
      case 'bowl': fruitBowl(k, px, y, pz, {}); break;
      case 'mags': magazines(k, px, y, pz, { rotY: r, n: rng.int(2, 4) }); break;
      default: break;
    }
  }
}

/** Curtains on every window pane this room owns on the given facade. */
function dressWindows(k, R, side, color, wide = 3.2) {
  const inward = side === 'n' ? 1 : -1;
  const wallZ = wallLine(R, side);
  const wins = (k.world.windowMap || []).filter((wn) =>
    wn.floor === R.floor && wn.side === side &&
    wn.x > R.x - R.w / 2 + 0.2 && wn.x < R.x + R.w / 2 - 0.2);
  for (const wn of wins) {
    curtains(k, wn.x, R.y, wallZ + inward * 0.28, Math.min(wide, (wn.w || 2.1) + 1.0), side === 'n' ? 0 : Math.PI, color);
  }
  return wins.length;
}

// ── bedrooms ───────────────────────────────────────────────────────────────
function bedroom(k, R, rng) {
  const M = k.M;
  const north = R.z < 0;                     // which way the window wall faces
  const wallZ = north ? R.z - R.d / 2 : R.z + R.d / 2;
  const inward = north ? 1 : -1;
  const owner = R.def?.owner;

  const palettes = {
    you: { duvet: 0xd8dee6, sheet: 0xf7f6f2, rug: 0x6a7684, art: 0x37485c },
    james: { duvet: 0x2f6fb5, sheet: 0xeef4fb, rug: 0x25456e, art: 0x1d3b63 },
    chloie: { duvet: 0xdba0d8, sheet: 0xfdf3fb, rug: 0x8d5ea8, art: 0x7a4b96 },
  };
  const pal = palettes[owner] || {
    duvet: rng.pick([0xdfe3e8, 0xd9cfc0, 0xc8d3cb, 0xe0d3d8]),
    sheet: 0xf6f4ef, rug: rng.pick([0x8a8172, 0x6e7a80, 0x8b7d8f]), art: rng.pick([0x4b5a68, 0x6b5b45, 0x5a6b57]),
  };

  const size = owner === 'you' ? 'king' : (owner ? 'twin' : rng.pick(['queen', 'king', 'queen']));
  const bx = R.x, bz = wallZ + inward * 1.45;
  if (R.name === 'Bunk Room') {
    bunkBed(k, R.x - 1.6, R.y, bz, { rotY: north ? 0 : Math.PI });
    bunkBed(k, R.x + 1.6, R.y, bz, { rotY: north ? 0 : Math.PI });
  } else {
    bed(k, bx, R.y, bz, { size, rotY: north ? 0 : Math.PI, duvet: pal.duvet, sheet: pal.sheet, cushion: pal.rug });
    nightstand(k, bx - 1.5, R.y, bz - inward * 0.4, { rotY: north ? 0 : Math.PI });
    if (R.w > 7) nightstand(k, bx + 1.5, R.y, bz - inward * 0.4, { rotY: north ? 0 : Math.PI, lamp: false });
  }
  rug(k, R.x, R.y, R.z + inward * -0.4, Math.min(4.2, R.w - 2), Math.min(3.4, R.d - 3), pal.rug);

  // opposite wall: dresser + TV, wardrobe. `inward` points from the window
  // wall into the room, so the far wall is +inward, not -inward — and it is
  // also the wall the entry door is on, so re-derive the door span from the
  // plan and keep the row clear of it (leaf half-width + 0.4 m swing margin).
  const farZ = north ? R.z + R.d / 2 : R.z - R.d / 2;
  const farSide = north ? 's' : 'n';
  const dDef = (R.def?.doors || []).find((dd) => dd.side === farSide);
  const doorX = R.x + (dDef?.at ?? 0);
  const clear = (dDef?.w ?? 1.0) / 2 + 0.4;
  const westRun = (doorX - clear) - (R.x - R.w / 2 + 0.25);
  const eastRun = (R.x + R.w / 2 - 2.1) - (doorX + clear); // stops at the wardrobe corner
  const side = westRun >= eastRun ? -1 : 1;
  const dw = Math.min(2.2, R.w * 0.3, Math.max(westRun, eastRun));
  const dx = doorX + side * (clear + dw / 2);
  dresser(k, dx, R.y, farZ - inward * 0.4, { rotY: north ? Math.PI : 0, w: dw });
  tv(k, dx, R.y, farZ - inward * 0.17, { rotY: north ? Math.PI : 0, w: Math.min(1.5, dw - 0.2), h: 1.55, wall: true });
  // wardrobe holds the far corner, swinging onto the side wall when the
  // doorway crowds it (narrow rooms, offset doors)
  const cornerFits = R.x + R.w / 2 - 1.95 > doorX + clear;
  if (cornerFits) wardrobe(k, R.x + R.w / 2 - 1.1, R.y, farZ - inward * 0.45, { rotY: north ? Math.PI : 0 });
  else wardrobe(k, R.x + R.w / 2 - 0.45, R.y, farZ - inward * 1.15, { rotY: -Math.PI / 2 });

  // desk under the window for the kids
  if (owner === 'james' || owner === 'chloie') {
    const kx = R.x + R.w / 2 - 1.4;
    desk(k, kx, R.y, wallZ + inward * 0.55, { rotY: north ? 0 : Math.PI, w: 1.4 });
    officeChair(k, kx, R.y, wallZ + inward * 1.35, { rotY: north ? Math.PI : 0, color: owner === 'james' ? 0x2f6fb5 : 0xb56fa8 });
    // shelf back tight to the west wall, shifted off the wall's door span
    bookshelf(k, R.x - R.w / 2 + 0.35, R.y, R.z - inward * 1.8, { rotY: Math.PI / 2, w: 1.4, h: 1.8 });
    // toys
    for (let i = 0; i < 5; i++) {
      k.box(0.22, 0.22, 0.22, k.M.solid(rng.pick([0xd0342c, 0x2f81ff, 0xf0b429, 0x6ab04c]), 0.6),
        R.x - R.w / 2 + 1.6 + i * 0.35, R.y + 0.11, R.z + inward * 1.4, { rotY: rng() * 3, tile: 0.2 });
    }
    // a lamp and something built on the desk
    tableLamp(k, kx - 0.5, wallZ + inward * 0.55, R.y + 0.79);
    bookStack(k, kx + 0.45, R.y + 0.77, wallZ + inward * 0.5, { n: 3, w: 0.22 });
  } else if (owner === 'you') {
    armchair(k, R.x - R.w / 2 + 1.8, R.y, R.z + inward * 1.2, { rotY: Math.PI / 2 });
    coffeeTable(k, R.x - R.w / 2 + 3.2, R.y, R.z + inward * 1.2, { w: 0.7, d: 0.7 });
    bookshelf(k, dx - dw / 2 - 0.95, R.y, farZ - inward * 0.22, { rotY: north ? Math.PI : 0, w: 1.6, h: 2.1 });
  } else if (R.w > 7.5) {
    armchair(k, R.x + R.w / 2 - 1.6, R.y, R.z, { rotY: north ? -Math.PI / 2 : Math.PI / 2 });
  }

  // one seeded touch per generic bedroom so the twenty of them stop rhyming.
  // Everything lands at the window end or the west wall — well clear of the
  // entry door span on the far wall.
  let variant = null;
  if (!owner && R.name !== 'Bunk Room') {
    // window-end corner east of the bed, kept clear of the side wall, the bed
    // and the east nightstand (which exists when R.w > 7)
    const cornerMin = R.w > 7 ? 2.55 : 1.95;
    const cornerX = R.x + Math.min(Math.max(R.w / 2 - 1.4, cornerMin), R.w / 2 - 0.85);
    const cornerOk = R.w / 2 - 0.85 >= cornerMin;
    variant = rng.pick(cornerOk ? ['reading', 'desk', 'bench', 'bean'] : ['bench', 'bean']);
    if (variant === 'reading') {
      // reading chair + floor lamp in the window-end corner
      armchair(k, cornerX, R.y, wallZ + inward * 1.25, { rotY: north ? 0 : Math.PI, color: pal.rug });
      floorLamp(k, R.x + R.w / 2 - 0.55, R.y, wallZ + inward * 0.55, { h: 1.5 });
    } else if (variant === 'desk') {
      // small desk + chair under the window
      desk(k, cornerX, R.y, wallZ + inward * 0.55, { rotY: north ? 0 : Math.PI, w: 1.3 });
      officeChair(k, cornerX, R.y, wallZ + inward * 1.3, { rotY: north ? Math.PI : 0, color: pal.art });
      tableLamp(k, cornerX - 0.45, wallZ + inward * 0.5, R.y + 0.79);
    } else if (variant === 'bench') {
      // upholstered bench at the foot of the bed
      bench(k, bx, R.y, bz + inward * 1.55, { w: 1.4, rotY: north ? 0 : Math.PI, color: pal.rug });
    } else {
      // play rug + beanbag against the west wall for the kid-adjacent rooms
      const px = R.x - R.w / 2 + 1.1, pz = R.z + inward * 0.3;
      rug(k, px, R.y, pz, 1.7, 1.7, pal.duvet);
      k.box(0.75, 0.32, 0.75, M.solid(pal.art, 0.95), px, R.y + 0.16, pz, { tile: 0.4 });
      k.box(0.55, 0.2, 0.55, M.solid(pal.rug, 0.95), px, R.y + 0.4, pz, { tile: 0.3 });
      k.col(0.8, 0.55, 0.8, px, R.y + 0.3, pz);
    }
  }

  // artwork goes on the entry wall opposite the dresser, if that stretch of
  // wall (door to wardrobe/corner) still has room for it
  const artLo = side < 0 ? doorX + (clear - 0.3) : R.x - R.w / 2 + 0.35;
  const artHi = side < 0 ? R.x + R.w / 2 - (cornerFits ? 2.0 : 0.85) : doorX - (clear - 0.3);
  if (artHi - artLo > 1.2) artwork(k, (artLo + artHi) / 2, R.y + 1.9, farZ - inward * 0.1, 1.0, 0.7, north ? Math.PI : 0, pal.art);
  // curtains hang centred on each actual window pane — the facade grid slides
  // panes around partitions, so read the published map; fall back to the room
  // centre when the map has nothing for this wall
  const curCol = rng.pick([0xbfb4a6, 0xa8b2bb, 0xc9bcae]);
  if (!dressWindows(k, R, north ? 'n' : 's', curCol)) {
    curtains(k, R.x, R.y, wallZ + inward * 0.22, Math.min(3.2, R.w * 0.5), north ? 0 : Math.PI, curCol);
  }
  if (owner) k.world.spot(`room_${owner}`, R.x, R.y, R.z);

  // ── detailing ────────────────────────────────────────────────────────────
  railRound(k, R);
  // these rooms are eight metres by eleven: bed at the window end, dresser at
  // the door end and nothing whatever in between.  Fill the middle.
  if (!owner && R.w >= 7) {
    // the beanbag already owns the west wall in those rooms, so the chair
    // takes the other side; `inx` is whichever way is into the room from it
    const cw = variant === 'bean' ? 'e' : 'w', inx = cw === 'w' ? 1 : -1;
    const sp = wallSpot(k, R, cw, R.z + inward * 1.9, 1.2, { windows: true, inset: 1.05, pad: 0.7 });
    if (sp) {
      armchair(k, sp[0], R.y, sp[1], { rotY: sp[2], color: pal.art });
      sideTable(k, sp[0] + inx * 0.25, R.y, sp[1] - inward * 1.15, { w: 0.5, lamp: rng.chance(0.5) });
      floorLamp(k, sp[0] - inx * 0.45, R.y, sp[1] + inward * 1.2, { h: 1.5 });
      wastebasket(k, sp[0] + inx * 0.15, R.y, sp[1] + inward * 1.5, {});
    }
  }
  // a bench at the foot of every bed that hasn't got one already
  if (owner && R.name !== 'Bunk Room') {
    bench(k, bx, R.y, bz + inward * 1.7, {
      w: owner === 'you' ? 1.8 : 1.3, rack: owner === 'you',
      rotY: north ? 0 : Math.PI, color: pal.rug,
    });
  }
  // the dresser top, a mirror over it and a bin beside it
  dressTop(k, dx, R.y + 0.9, farZ - inward * 0.4, rng, { rotY: north ? Math.PI : 0, w: dw - 0.4, n: 2, kinds: ['photo', 'vase', 'books'] });
  const bin = wallSpot(k, R, farSide, dx + (dw / 2 + 0.4) * side, 0.2, { windows: true, inset: 0.3, pad: 0.45 });
  if (bin) wastebasket(k, bin[0], R.y, bin[1], { color: pal.rug });
  // the basket goes on the side wall: the door wall is dresser, door and
  // wardrobe from end to end
  const lb = wallSpot(k, R, 'w', R.z + inward * 3.6, 0.3, { windows: true, inset: 0.3, pad: 0.5 });
  if (lb) laundryBasket(k, lb[0], R.y, lb[1], { rotY: lb[2] });

  // walls: a picture on each side wall, a clock, a shelf, a leaning mirror
  // the west picture hangs down at the window end — the kids' bookshelf backs
  // onto that wall a couple of metres further in
  for (const [ws, zo] of [['w', -3.4], ['e', 2.6]]) {
    const sp = wallSpot(k, R, ws, R.z + inward * zo, 0.65);
    if (sp) artwork(k, sp[0], R.y + 2.0, sp[1], rng.range(0.8, 1.15), rng.range(0.6, 0.85), sp[2], pal.art);
  }
  const cs = wallSpot(k, R, 'w', R.z + inward * 1.2, 0.25);
  if (cs) wallClock(k, cs[0], R.y + 2.12, cs[1], cs[2], { hour: rng.int(1, 12), minute: rng.int(0, 55) });
  const sh = wallSpot(k, R, 'e', R.z + inward * 0.4, 0.7, { inset: 0.14 });
  if (sh) wallShelf(k, sh[0], R.y + 1.55, sh[1], { rotY: sh[2], w: 1.1 });
  const mi = owner ? null : wallSpot(k, R, 'w', R.z + inward * 3.4, 0.6, { inset: 0.2 });
  if (mi && rng.chance(0.6)) tallMirror(k, mi[0], R.y, mi[1], { rotY: mi[2], lean: true, h: 1.7, frame: M.get('walnut') });
  // sconces on the side walls (never the window wall — the panes start at
  // 0.95 m and a sconce would hang in the middle of one)
  for (const s of [-1, 1]) {
    const sp = wallSpot(k, R, s < 0 ? 'w' : 'e', R.z + inward * (s < 0 ? -0.8 : -3.2), 0.25);
    if (sp && rng.chance(0.55)) sconce(k, sp[0], R.y + 2.0, sp[1], sp[2]);
  }
  if (rng.chance(0.4)) radio(k, dx + (dw / 2 - 0.3) * -side, R.y + 0.9, farZ - inward * 0.4, { rotY: north ? Math.PI : 0 });

  if (owner === 'james') jamesRoom(k, R, rng, { inward, wallZ, farSide });
  if (owner === 'chloie') chloieRoom(k, R, rng, { north, inward, wallZ, bx, bz });
  if (owner === 'you') masterSuite(k, R, { inward, pal });
  if (R.name === 'Bunk Room') {
    toyBox(k, R.x - R.w / 2 + 1.2, R.y, R.z + inward * 1.2, { rotY: inward > 0 ? 0 : Math.PI, color: 0x6ab04c });
    for (let i = 0; i < 3; i++) softToy(k, R.x - 2.4 + i * 0.5, R.y, R.z + inward * 2.6, { scale: 0.9, color: [0xd8a05e, 0xe86fa8, 0x6ab04c][i] });
    const sr = wallSpot(k, R, 'e', R.z + inward * 1.6, 0.6, { inset: 0.1 });
    if (sr) sportsRack(k, sr[0], R.y + 1.7, sr[1], { rotY: sr[2], w: 1.0 });
  }
}

// James: sports gear, posters, a desk he actually works at.
function jamesRoom(k, R, rng, C) {
  const { inward, wallZ, farSide } = C;
  // the west wall reads clock, trophies, kit — each in its own metre of wall
  const sp = wallSpot(k, R, 'w', R.z + inward * 4.2, 0.7, { inset: 0.12 });
  if (sp) sportsRack(k, sp[0], R.y + 1.7, sp[1], { rotY: sp[2], w: 1.1 });
  const tr = wallSpot(k, R, 'w', R.z + inward * 2.4, 0.7, { inset: 0.13 });
  if (tr) trophyShelf(k, tr[0], R.y + 1.75, tr[1], { rotY: tr[2], w: 1.2 });
  // posters down the side wall — the door wall is dresser, television and
  // wardrobe from end to end, and a poster behind a telly is no poster
  for (let i = 0; i < 3; i++) {
    const sp = wallSpot(k, R, 'e', R.z + inward * (-1.2 - i * 0.8), 0.4);
    if (sp) poster(k, sp[0], R.y + 1.95, sp[1], { rotY: sp[2], w: 0.72, h: 1.0, seed: 11 + i, hue: [0.58, 0.06, 0.34][i] });
  }
  // kit bag, ball and a skateboard leaning by the door
  const bag = wallSpot(k, R, farSide, R.x - R.w / 2 + 2.4, 0.4, { windows: true, inset: 0.35, pad: 0.5 });
  if (bag) {
    k.box(0.62, 0.34, 0.34, k.M.paint(0x1d3b63, 0.85, 'kitbag'), bag[0], R.y + 0.17, bag[1], { rotY: bag[2], tile: 0.3 });
    k.col(0.62, 0.34, 0.36, bag[0], R.y + 0.17, bag[1], bag[2]);
  }
  k.box(0.22, 0.8, 0.06, k.M.solid(0x2f6fb5, 0.5), R.x - R.w / 2 + 0.5, R.y + 0.42, R.z + inward * 2.4, { rotZ: 0.22, tile: 0.2 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 9), k.M.solid(0xd4762c, 0.75));
  ball.position.set(R.x - R.w / 2 + 1.6, R.y + 0.12, R.z + inward * 3.4);
  k.world.addProp(ball);
  // a model on the desk, and the bed made with a team blanket
  const kx = R.x + R.w / 2 - 1.4;
  k.box(0.1, 0.28, 0.1, k.M.solid(0xe8e4db, 0.5), kx + 0.2, R.y + 0.9, wallZ + inward * 0.4, { tile: 0.2 });
  k.box(0.26, 0.05, 0.05, k.M.solid(0xd0342c, 0.5), kx + 0.2, R.y + 0.86, wallZ + inward * 0.4, { tile: 0.2 });
  // homework happens at that desk, so give him the things to do it with
  homeworkDesk(k, R, 'james', inward, wallZ);
  // a football, left where he kicked his bag off
  const foot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 9), k.M.solid(0xf2f0ea, 0.7));
  foot.position.set(kx - 1.7, R.y + 0.11, wallZ + inward * 1.0);
  k.world.addProp(foot);
  // the console on a shelf on the far wall — the one thing in this room a
  // parent takes away, so it goes up as its own hideable object
  const cs = wallSpot(k, R, 'w', R.z + inward * 0.7, 0.62, { inset: 0.16 });
  if (cs) {
    wallShelf(k, cs[0], R.y + 1.15, cs[1], { rotY: cs[2], w: 1.2, d: 0.3, items: 0 });
    gamesConsole(k, cs[0] + 0.02 * Math.sin(cs[2]), R.y + 1.175, cs[1] + 0.02 * Math.cos(cs[2]),
      { rotY: cs[2], room: R.name, owner: 'james', led: 0x2f6fb5 });
  }
}

/**
 * The homework corner.  bedroom() already stands the desk under the window
 * and the chair in front of it — the chair carries the seat interactable —
 * and this is what is on and around it.  The chair's position is published so
 * the game can sit a child down at it and help with the spellings.
 */
function homeworkDesk(k, R, owner, inward, wallZ) {
  const kx = R.x + R.w / 2 - 1.4;                 // matches the desk in bedroom()
  const dz = wallZ + inward * 0.55;               // the desk's own centre
  const ty = R.y + 0.765;                         // and its top
  const face = inward > 0 ? Math.PI : 0;          // the way a child at it looks
  const small = owner === 'chloie';
  openBook(k, kx + 0.02, ty, dz + inward * 0.12, { rotY: face, color: small ? 0x8d5ea8 : 0x2f4f6b });
  pencilPot(k, kx + 0.24, ty, dz + inward * 0.14, { crayon: small, color: small ? 0xe86fa8 : 0x9aa8b4 });
  if (small) {
    // her own drawings taped over the desk: this end of the window wall is
    // solid plaster — the room's one pane is away at the other end of it
    for (let i = 0; i < 3; i++) {
      poster(k, kx - 0.3 + i * 0.44, R.y + 1.62 + (i % 2) * 0.44, wallZ + inward * 0.1,
        { rotY: face + Math.PI, w: 0.3, h: 0.38, seed: 60 + i, hue: 0.78 + i * 0.07 });
    }
  }
  // each of them has a screen of their own on the desk — hers instead of a
  // console, his alongside one — and it is the thing that gets taken away
  tablet(k, kx - 0.26, ty, dz + inward * 0.1, { rotY: face, owner, room: R.name });
  schoolBag(k, kx - 0.95, R.y, dz + inward * 0.45, { rotY: face, color: small ? 0xb56fa8 : 0x2f6fb5 });
  k.world.spot(`${owner}Desk`, kx, R.y, wallZ + inward * 1.3, { rotY: face });
}

// Chloie: canopy, soft toys, drawings taped to the wall.
function chloieRoom(k, R, rng, C) {
  const { north, inward, wallZ, bx, bz } = C;
  canopy(k, bx, R.y, bz, { w: 1.5, d: 2.3, h: 2.05, color: 0xfbe6f4 });
  for (let i = 0; i < 4; i++) {
    softToy(k, bx - 0.5 + i * 0.34, R.y + 0.66, bz + (i % 2 ? 0.5 : 0.75),
      { scale: rng.range(0.7, 1.0), color: rng.pick([0xd8a05e, 0xe86fa8, 0xf0b429, 0x9bd1e8]), rotY: rng() * 3 });
  }
  toyBox(k, R.x - R.w / 2 + 1.3, R.y, R.z + inward * 3.4, { rotY: north ? 0 : Math.PI, color: 0xe86fa8 });
  // her drawings, taped up in a block on the side wall — the door wall is all
  // dresser and television
  for (let i = 0; i < 6; i++) {
    const sp = wallSpot(k, R, 'e', R.z + inward * (-1.0 - (i % 3) * 0.62), 0.28, { pad: 0.3 });
    if (!sp) continue;
    poster(k, sp[0], R.y + 1.5 + Math.floor(i / 3) * 0.5, sp[1], {
      rotY: sp[2], w: 0.34, h: 0.42, seed: 40 + i, hue: rng(),
    });
  }
  // a little table set for two
  const tx = R.x - R.w / 2 + 1.5, tz = R.z + inward * 0.6;
  sideTable(k, tx, R.y, tz, { w: 0.7, h: 0.42 });
  for (const s of [-1, 1]) {
    k.box(0.34, 0.06, 0.34, k.M.paint(0xf0c8e4, 0.9, 'stool'), tx + s * 0.62, R.y + 0.28, tz, { tile: 0.2 });
    for (const [ox, oz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) {
      k.box(0.04, 0.28, 0.04, k.M.get('maple'), tx + s * 0.62 + ox, R.y + 0.14, tz + oz, { tile: 0.2 });
    }
    k.col(0.38, 0.32, 0.38, tx + s * 0.62, R.y + 0.16, tz);
  }
  softToy(k, tx, R.y + 0.47, tz, { scale: 0.7, color: 0xf0b429 });
  // fairy lights strung above the window
  k.box(Math.min(3.4, R.w - 2), 0.03, 0.03, k.M.emissive(0xffe0b0, 1.2), R.x, R.y + 2.5, wallZ + inward * 0.16, { tile: 0.2 });
  // she does her homework here too — crayons rather than a tablet
  homeworkDesk(k, R, 'chloie', inward, wallZ);
  k.world.spot('chloiePlay', tx, R.y, tz);
}

// The master: a sitting area, a dressing table and somewhere to put a case.
function masterSuite(k, R, C) {
  const { inward, pal } = C;
  armchair(k, R.x - R.w / 2 + 1.8, R.y, R.z + inward * 2.9, { rotY: Math.PI / 2 });
  rug(k, R.x - R.w / 2 + 2.6, R.y, R.z + inward * 2.05, 3.4, 3.6, pal.rug);
  floorLamp(k, R.x - R.w / 2 + 0.7, R.y, R.z + inward * 3.9, { h: 1.6 });
  sideTable(k, R.x - R.w / 2 + 1.9, R.y, R.z + inward * 4.0, { w: 0.55, lamp: false });
  magazines(k, R.x - R.w / 2 + 3.2, R.y + 0.44, R.z + inward * 1.2, { n: 3 });
  const dt = wallSpot(k, R, 'e', R.z + inward * 3.2, 0.9, { inset: 0.3, pad: 0.8 });
  if (dt) dressingTable(k, dt[0], R.y, dt[1], { rotY: dt[2], w: 1.3, stool: pal.duvet });
  // the cheval mirror goes down by the window, not next to the dressing
  // table's own glass — two mirrors side by side read as a shop fitting
  const mi = wallSpot(k, R, 'e', R.z - inward * 2.0, 0.6, { inset: 0.16 });
  if (mi) tallMirror(k, mi[0], R.y, mi[1], { rotY: mi[2], lean: true, h: 1.8 });
  k.world.spot('masterSitting', R.x - R.w / 2 + 2.6, R.y, R.z + inward * 2.0);
}

// ── bathrooms ──────────────────────────────────────────────────────────────
function bathroom(k, R, rng) {
  const M = k.M;
  const north = R.z < 0;
  const inward = north ? 1 : -1;                       // window wall → into the room
  const wallZ = north ? R.z - R.d / 2 : R.z + R.d / 2; // facade (window) end
  const zi = (f) => wallZ + inward * f;                // f metres in from that end
  const wide = R.w > 5;
  const xW = R.x - R.w / 2, xE = R.x + R.w / 2;
  // the room's only door sits on the corridor wall — re-derive its span from
  // the plan (leaf half-width + 0.4 m swing) and gather every fixture at the
  // window end so these long rooms read as a bathroom, not an empty corridor
  const dDef = (R.def?.doors || []).find((dd) => dd.side === (north ? 's' : 'n'));
  const doorX = R.x + (dDef?.at ?? 0);
  const doorClear = (dDef?.w ?? 0.9) / 2 + 0.4;
  const doorWallZ = north ? R.z + R.d / 2 : R.z - R.d / 2;
  const doorSide = north ? 's' : 'n';

  // shower in the west corner of the window end, tiled back against the wall
  const shX = xW + (wide ? 1.0 : 0.9);
  shower(k, shX, R.y, zi(0.9), { rotY: north ? 0 : Math.PI, w: wide ? 1.6 : 1.3, d: wide ? 1.4 : 1.2 });
  if (wide) {
    // freestanding tub under the windows, bath mat alongside
    bathtub(k, R.x + 0.7, R.y, zi(0.72), { rotY: 0 });
    k.box(1.3, 0.024, 0.6, M.paint(0xdde7ea, 0.96, 'bathmat'), R.x + 0.7, R.y + 0.06, zi(1.55), { tile: 0.5 });
  } else {
    k.box(0.9, 0.024, 0.55, M.paint(0xdde7ea, 0.96, 'bathmat'), shX, R.y + 0.06, zi(1.85), { tile: 0.5 });
  }
  // vanity backs onto the east wall facing the room
  vanity(k, xE - 0.45, R.y, zi(wide ? 2.4 : 2.2), { rotY: -Math.PI / 2, w: wide ? 2.0 : 1.3 });
  if (wide) {
    // his-and-hers: a second vanity plus a framed mirror on the west wall
    vanity(k, xW + 0.45, R.y, zi(2.9), { rotY: Math.PI / 2, w: 1.6 });
    k.box(0.05, 1.35, 0.95, M.get('gold'), xW + 0.17, R.y + 1.75, zi(4.6), { tile: 0.4 });
    k.box(0.04, 1.2, 0.8, M.get('mirror'), xW + 0.21, R.y + 1.75, zi(4.6), { tile: 0.6 });
    // toilet on the east wall past the vanity, out of the door sightline
    toilet(k, xE - 0.5, R.y, zi(3.9), { rotY: -Math.PI / 2 });
  } else {
    toilet(k, xW + 0.45, R.y, zi(2.5), { rotY: Math.PI / 2 });
  }
  // towel bar: chrome rod on wall brackets, towels draped over it
  const tbz = zi(wide ? 0.8 : 0.9);
  k.box(0.04, 0.04, 1.0, M.get('chrome'), xE - 0.26, R.y + 1.25, tbz, { tile: 0.2 });
  for (const s of [-1, 1]) k.box(0.2, 0.05, 0.05, M.get('chrome'), xE - 0.15, R.y + 1.25, tbz + s * 0.42, { tile: 0.2 });
  for (let i = 0; i < 2; i++) {
    k.box(0.12, 0.5, 0.34, M.paint(rng.pick([0xe8eef2, 0xd7e3e8]), 0.95, 'towel'),
      xE - 0.28, R.y + 1.03, tbz + (i ? 0.22 : -0.22), { tile: 0.3 });
  }
  // hamper tucked beside the door, outside the leaf swing
  const hx = doorX - doorClear - 0.35;
  if (hx - 0.3 > xW + 0.2) {
    laundryBasket(k, hx, R.y, doorWallZ - inward * 0.35, { w: 0.5, d: 0.4, h: 0.6, color: 0xd8dde1 });
  }

  // ── detailing ────────────────────────────────────────────────────────────
  // shelf of bottles and folded towels over the toilet, and a bin under it
  const tSide = wide ? 'e' : 'w', tz = zi(wide ? 3.9 : 2.5);
  const sp = wallSpot(k, R, tSide, tz, 0.6, { windows: true, inset: 0.14 });
  if (sp) {
    wallShelf(k, sp[0], R.y + 1.65, sp[1], { rotY: sp[2], w: 1.0, items: 3 });
    wallShelf(k, sp[0], R.y + 2.05, sp[1], { rotY: sp[2], w: 1.0, items: 2 });
  }
  const bs = wallSpot(k, R, tSide, tz + inward * 0.85, 0.2, { windows: true, inset: 0.24 });
  if (bs) wastebasket(k, bs[0], R.y, bs[1], { w: 0.24, h: 0.3, metal: true });
  // robe hooks by the door and a picture on the way in
  const hk = wallSpot(k, R, doorSide, doorX + (hx - 0.3 > xW + 0.2 ? doorClear + 0.6 : -doorClear - 0.6), 0.45);
  if (hk) coatHooks(k, hk[0], R.y + 1.75, hk[1], { rotY: hk[2], w: 0.9, n: 3, full: 0.5 });
  const ar = wallSpot(k, R, doorSide, R.x + (wide ? 1.6 : 1.1), 0.4);
  if (ar) artwork(k, ar[0], R.y + 1.95, ar[1], 0.6, 0.8, ar[2], rng.pick([0x4b6b7a, 0x6b7a54, 0x7a6b8c]));
  // these rooms are ten metres deep with every fixture at one end — a runner
  // and a towel ladder give the walk in from the door something to look at
  rug(k, R.x, R.y, zi(6.6), Math.min(1.7, R.w - 1.8), 2.8, 0x9fb3bd);
  const ld = wallSpot(k, R, wide ? 'w' : 'e', zi(6.0), 0.4, { windows: true, inset: 0.2, pad: 0.5 });
  if (ld) {
    for (const s of [-1, 1]) k.box(0.05, 1.7, 0.05, M.get('maple'), ld[0] - 0.05 * Math.sin(ld[2]), R.y + 0.85, ld[1] + s * 0.3 - 0.05 * Math.cos(ld[2]), { rotX: 0.06, tile: 0.2 });
    for (let i = 0; i < 4; i++) {
      k.box(0.06, 0.05, 0.66, M.get('maple'), ld[0], R.y + 0.5 + i * 0.4, ld[1], { rotY: ld[2], tile: 0.2 });
      if (i % 2) k.box(0.16, 0.5, 0.3, M.paint(rng.pick([0xe8eef2, 0xd7e3e8]), 0.95, 'towel'), ld[0] + 0.07 * Math.sin(ld[2]), R.y + 0.26 + i * 0.4, ld[1] + 0.07 * Math.cos(ld[2]), { rotY: ld[2], tile: 0.3 });
    }
    k.col(0.3, 1.7, 0.7, ld[0], R.y + 0.85, ld[1], ld[2]);
  }
  // something green by the window, and a stool in the big ones
  plant(k, wide ? R.x - 1.6 : R.x + R.w / 2 - 0.6, R.y, zi(wide ? 0.9 : 3.4), rng.range(0.6, 0.9));
  if (wide) {
    sideTable(k, R.x + 0.7, R.y, zi(2.4), { w: 0.42, h: 0.44, pedestal: true });
    k.box(0.3, 0.14, 0.24, M.paint(0xe8eef2, 0.95, 'towel'), R.x + 0.7, R.y + 0.52, zi(2.4), { tile: 0.2 });
    const cl = wallSpot(k, R, doorSide, R.x - 1.4, 0.25);
    if (cl) wallClock(k, cl[0], R.y + 2.2, cl[1], cl[2], { hour: rng.int(1, 12), minute: rng.int(0, 55), d: 0.28 });
  }
}

// ── living spaces ──────────────────────────────────────────────────────────
function greatRoom(k, R, rng) {
  const M = k.M;
  fireplace(k, R.x - R.w / 2 + 3.4, R.y, R.z - R.d / 2 + 0.5, { rotY: 0, w: 3.6, h: 7.4 });
  rug(k, R.x - 1.0, R.y, R.z, 5.6, 4.2, 0x7d6f5f);
  sectional(k, R.x - 2.2, R.y, R.z + 1.2, { w: 3.6, rotY: Math.PI, color: 0xd9d3c8, pillow: 0x9aa8b4 });
  armchair(k, R.x + 1.8, R.y, R.z - 0.8, { rotY: -Math.PI / 2 });
  armchair(k, R.x + 1.8, R.y, R.z + 1.6, { rotY: -Math.PI / 2 });
  coffeeTable(k, R.x - 1.4, R.y, R.z + 0.2, { w: 1.6, d: 0.9 });
  // hung on the chimney breast: the stone face sits at z0 + 0.55 (fireplace
  // base z0 + 0.5, stone slab centred -0.2 with 0.5 depth), so at 0.58 the
  // set's 0.05-deep frame rests on the stone ~0.03 proud instead of floating
  tv(k, R.x - R.w / 2 + 3.4, R.y, R.z - R.d / 2 + 0.58, { rotY: 0, w: 2.2, h: 2.7, wall: true });
  // grand piano corner + double height drapes
  piano(k, R.x + R.w / 2 - 3.0, R.y, R.z + R.d / 2 - 3.0, Math.PI * 0.15);
  for (let i = 0; i < 3; i++) {
    const colX = R.x - R.w / 2 + 1.0 + i * (R.w - 2) / 2;
    k.box(0.4, 7.6, 0.4, M.get('stone'), colX, R.y + 3.8, R.z + R.d / 2 - 0.6, { tile: 1.4 });
    k.col(0.45, 7.6, 0.45, colX, R.y + 3.8, R.z + R.d / 2 - 0.6);
  }
  k.world.spot('greatRoom', R.x - 1.0, R.y, R.z + 0.6);
  k.world.spot('fireplaceSeat', R.x - 2.2, R.y, R.z + 1.2);

  // ── detailing ────────────────────────────────────────────────────────────
  // a layered rug under the seating, and the sofa table behind it
  rug(k, R.x - 1.6, R.y + 0.01, R.z + 0.9, 3.0, 2.2, 0x5d5346);
  // clear of the metre you step into when you get up off the sectional
  consoleTable(k, R.x - 2.2, R.y, R.z + 2.7, { w: 2.6, d: 0.42, rotY: Math.PI });
  dressTop(k, R.x - 2.2, R.y + 0.91, R.z + 2.7, rng, { rotY: Math.PI, w: 2.0, kinds: ['photo', 'vase', 'books'] });
  sideTable(k, R.x - 4.3, R.y, R.z + 1.2, { w: 0.6, lamp: true });
  sideTable(k, R.x + 3.0, R.y, R.z + 0.4, { w: 0.6, lamp: true });
  floorLamp(k, R.x + 3.1, R.y, R.z - 1.6, { h: 1.6 });
  // bookcases flanking the chimney breast, sconces above them
  for (const s of [-1, 1]) {
    const bx = R.x - R.w / 2 + 3.4 + s * 2.9;
    const sp = wallSpot(k, R, 'n', bx, 1.0, { windows: true, inset: 0.24, pad: 0.5 });
    if (sp) bookshelf(k, sp[0], R.y, sp[1], { w: 1.8, h: 2.4 });
    const sc = wallSpot(k, R, 'n', bx, 0.2, { windows: true });
    if (sc) sconce(k, sc[0], R.y + 2.9, sc[1], sc[2], { intensity: 6 });
  }
  // the east wall: a big canvas and a drinks cabinet
  const art = wallSpot(k, R, 'e', R.z - 3.2, 1.0);
  if (art) artwork(k, art[0], R.y + 2.6, art[1], 1.9, 1.3, art[2], 0x4b5a68);
  const bar = wallSpot(k, R, 'e', R.z + 3.4, 0.9, { inset: 0.3, pad: 0.6 });
  if (bar) {
    consoleTable(k, bar[0], R.y, bar[1], { w: 1.6, d: 0.45, rotY: bar[2] });
    dressTop(k, bar[0], R.y + 0.91, bar[1], rng, { rotY: bar[2], w: 1.2, n: 2, kinds: ['vase', 'bowl'] });
    radio(k, bar[0] - 0.35, R.y + 0.91, bar[1] + 0.3, { rotY: bar[2], label: 'Put a record on' });
  }
  // things left on the coffee table, and a bin by the piano
  magazines(k, R.x - 1.8, R.y + 0.44, R.z + 0.2, { n: 4 });
  boardGame(k, R.x - 0.9, R.y + 0.44, R.z + 0.3, { rotY: 0.4 });
  wastebasket(k, R.x + R.w / 2 - 1.0, R.y, R.z + R.d / 2 - 1.2, { metal: true });
  plant(k, R.x + R.w / 2 - 1.4, R.y, R.z - 3.6, 1.8);
  // full-height drapes at the glass wall, between the columns
  for (const s of [-1, 1]) curtains(k, R.x + s * 2.5, R.y, R.z + R.d / 2 - 0.95, 3.6, Math.PI, 0xc9bcae);
}

function familyRoom(k, R, rng) {
  // off-centre: the room's corridor door is dead-centre on this wall
  fireplace(k, R.x - 3.2, R.y, R.z - R.d / 2 + 0.5, { rotY: 0, w: 2.4, h: 2.6 });
  rug(k, R.x, R.y, R.z + 0.6, 4.4, 3.2, 0x6f6355);
  sofa(k, R.x, R.y, R.z + 2.4, { w: 2.8, rotY: Math.PI, color: 0x8c94a0, cushion: 0xdfe3e8 });
  armchair(k, R.x - 2.4, R.y, R.z + 0.6, { rotY: -Math.PI / 2, color: 0x7a6a58 });
  armchair(k, R.x + 2.4, R.y, R.z + 0.6, { rotY: Math.PI / 2, color: 0x7a6a58 });
  coffeeTable(k, R.x, R.y, R.z + 1.2);
  // TV wall on the east end — clear of the fireplace and of the kitchen
  // opening at R.z ± 1.1 on that wall
  tvUnit(k, R.x + R.w / 2 - 0.4, R.y, R.z - 3.2, { rotY: -Math.PI / 2, w: 2.2 });
  tv(k, R.x + R.w / 2 - 0.5, R.y, R.z - 3.2, { rotY: -Math.PI / 2, w: 1.9, h: 1.4 });
  bookshelf(k, R.x - R.w / 2 + 0.35, R.y, R.z + R.d / 2 - 2.0, { rotY: Math.PI / 2, w: 2.0, h: 2.2 });
  k.world.spot('familyRoom', R.x, R.y, R.z + 1.6);

  // ── detailing ────────────────────────────────────────────────────────────
  railRound(k, R);
  rug(k, R.x, R.y + 0.01, R.z + 1.6, 2.6, 1.8, 0x574d42);
  consoleTable(k, R.x, R.y, R.z + 3.9, { w: 2.4, d: 0.4, rotY: Math.PI });
  dressTop(k, R.x, R.y + 0.91, R.z + 3.9, rng, { rotY: Math.PI, w: 1.8 });
  sideTable(k, R.x - 1.9, R.y, R.z + 2.6, { w: 0.55, lamp: true });
  sideTable(k, R.x + 1.9, R.y, R.z + 2.6, { w: 0.55, lamp: true });
  floorLamp(k, R.x + 3.4, R.y, R.z + 2.0, { h: 1.55 });
  // the games and the toy basket live under the TV
  boardGame(k, R.x - 0.3, R.y + 0.44, R.z + 1.2, { rotY: 0.2 });
  magazines(k, R.x + 0.45, R.y + 0.44, R.z + 1.15, { n: 3 });
  laundryBasket(k, R.x + R.w / 2 - 0.9, R.y, R.z - 1.6, { color: 0xcfd8c9 });
  wastebasket(k, R.x - R.w / 2 + 0.8, R.y, R.z - 2.4, {});
  // walls
  for (const s of [-1, 1]) {
    const sp = wallSpot(k, R, 'n', R.x + s * 2.2, 0.35, { windows: true });
    if (sp) sconce(k, sp[0], R.y + 2.0, sp[1], sp[2]);
  }
  const art = wallSpot(k, R, 'w', R.z - 2.6, 0.9);
  if (art) artwork(k, art[0], R.y + 2.05, art[1], 1.4, 1.0, art[2], 0x5a6b57);
  const cl = wallSpot(k, R, 'n', R.x + 2.6, 0.25, { windows: true });
  if (cl) wallClock(k, cl[0], R.y + 2.3, cl[1], cl[2], { hour: 4, minute: 20 });
  const sh = wallSpot(k, R, 'w', R.z + 1.4, 0.7, { inset: 0.14 });
  if (sh) wallShelf(k, sh[0], R.y + 1.7, sh[1], { rotY: sh[2], w: 1.2 });
  dressWindows(k, R, R.z > 0 ? 's' : 'n', 0xbfb4a6, 3.0);
  plant(k, R.x + R.w / 2 - 1.2, R.y, R.z + R.d / 2 - 2.6, 1.1);
}

function piano(k, x, y, z, rotY) {
  const M = k.M, b = { x, y, z, r: rotY };
  const body = M.paint(0x0b0c0e, 0.18, 'pianoblack');
  k.p(b, 0, 0.72, 0, 1.5, 0.28, 2.1, body, 1);
  k.p(b, 0, 0.9, -0.6, 1.5, 0.06, 0.9, body, 1);
  k.p(b, 0, 0.62, 1.02, 1.42, 0.1, 0.3, M.paint(0xf7f5f0, 0.3, 'keys'), 0.4);
  for (let i = 0; i < 18; i++) k.p(b, -0.66 + i * 0.078, 0.68, 0.97, 0.03, 0.06, 0.18, body, 0.2);
  for (const [ox, oz] of [[-0.6, -0.85], [0.6, -0.85], [0, 0.9]]) k.p(b, ox, 0.36, oz, 0.09, 0.72, 0.09, body, 0.3);
  k.pc(b, 0, 0.5, 0, 1.6, 1.0, 2.2);
  // the stool is part of the instrument — you can sit at it and play
  const [sx, sz] = k.L(0, 1.5, x, z, rotY);
  k.p(b, 0, 0.52, 1.5, 0.62, 0.1, 0.34, M.get('leather'), 0.4);
  for (const [ox, oz] of [[-0.25, 1.36], [0.25, 1.36], [-0.25, 1.64], [0.25, 1.64]]) {
    k.p(b, ox, 0.24, oz, 0.05, 0.46, 0.05, M.get('walnut'), 0.3);
  }
  k.pc(b, 0, 0.3, 1.5, 0.66, 0.6, 0.4);
  k.world.addInteract({
    pos: V(sx, y + 0.6, sz), radius: 1.4, label: 'Sit at the piano',
    kind: 'seat', seat: { x: sx, y: y + 0.56, z: sz, rotY: rotY + Math.PI },
  });
  k.world.addInteract({
    pos: V(x, y + 0.9, z), radius: 2.0, label: 'Play the piano', kind: 'piano',
  });
}

function kitchen(k, R, rng) {
  const M = k.M;
  const backZ = R.z + R.d / 2 - 0.4;
  counterRun(k, R.x - 2.6, R.y, backZ, 5.4, { rotY: Math.PI });
  range(k, R.x + 1.2, R.y, backZ, { rotY: Math.PI });
  fridge(k, R.x + 3.4, R.y, backZ, { rotY: Math.PI });
  // east run backs onto the east wall, south of the sunroom archway (which
  // spans R.z ± 1.1 on that wall)
  counterRun(k, R.x + R.w / 2 - 0.48, R.y, R.z + 2.8, 3.0, { rotY: -Math.PI / 2, upper: false });
  island(k, R.x - 0.6, R.y, R.z - 1.0, { w: 3.4, d: 1.2 });
  // fruit bowl + kettle on the island
  fruitBowl(k, R.x - 1.4, R.y + 0.95, R.z - 1.0, {});
  k.world.spot('kitchen', R.x - 0.6, R.y, R.z + 0.6);
  k.world.spot('kitchenIsland', R.x - 0.6, R.y, R.z - 2.0);

  // ── detailing ────────────────────────────────────────────────────────────
  // a dresser run on the west wall, well north of the family-room opening
  const wr = wallSpot(k, R, 'w', R.z - 3.6, 1.5, { inset: 0.48, pad: 0.55 });
  const ws = wallSpot(k, R, 'w', R.z - 3.6, 1.5, { inset: 0.14, pad: 0.55 });
  if (wr && ws) {
    counterRun(k, wr[0], R.y, wr[1], 3.0, { rotY: wr[2], upper: false, cabinet: 0x3a4650 });
    wallShelf(k, ws[0], R.y + 1.5, ws[1], { rotY: ws[2], w: 1.6, items: 4 });
    wallShelf(k, ws[0], R.y + 1.95, ws[1], { rotY: ws[2], w: 1.6, items: 3 });
  }
  // worktop clutter: kettle, coffee jug, knife block, chopping board, jars
  const cy = R.y + 0.93;
  k.box(0.2, 0.28, 0.2, M.get('steel'), R.x - 4.4, cy + 0.14, backZ - 0.04, { tile: 0.2 });
  k.box(0.16, 0.3, 0.2, M.paint(0x2b2f35, 0.4, 'coffee'), R.x - 3.7, cy + 0.15, backZ - 0.04, { tile: 0.2 });
  k.box(0.14, 0.24, 0.16, M.get('walnut'), R.x - 3.1, cy + 0.12, backZ - 0.06, { tile: 0.2 });
  for (let i = 0; i < 4; i++) {
    k.box(0.03, 0.14, 0.03, M.get('chrome'), R.x - 3.13 + i * 0.03, cy + 0.3, backZ - 0.06, { tile: 0.1 });
  }
  k.box(0.42, 0.03, 0.3, M.get('maple'), R.x - 2.2, cy + 0.02, backZ - 0.02, { tile: 0.3 });
  for (let i = 0; i < 3; i++) {
    k.box(0.14, 0.2, 0.14, M.paint([0xd8cfbe, 0xc9d4cb, 0xdfe3e8][i], 0.4, 'jar'), R.x - 1.4 + i * 0.2, cy + 0.1, backZ - 0.08, { tile: 0.2 });
  }
  // a tea towel over the oven rail, herbs on the sill, a bin by the island
  k.box(0.3, 0.34, 0.03, M.paint(0x9fc6d4, 0.95, 'teatowel'), R.x + 1.2, R.y + 0.62, backZ + 0.36, { tile: 0.2 });
  plant(k, R.x - 5.2, R.y + 0.95, backZ - 0.1, 0.45);
  plant(k, R.x - 4.9, R.y + 0.95, backZ - 0.1, 0.4);
  wastebasket(k, R.x + 1.6, R.y, R.z - 1.0, { w: 0.34, h: 0.5, metal: true });
  // a runner in front of the sink and something on the walls
  rug(k, R.x - 0.6, R.y, R.z - 2.2, 2.6, 0.8, 0x6b7a54);
  const cl = wallSpot(k, R, 'n', R.x + 3.4, 0.3);
  if (cl) wallClock(k, cl[0], R.y + 2.4, cl[1], cl[2], { hour: 8, minute: 15, d: 0.4 });
  const ar = wallSpot(k, R, 'n', R.x - 3.4, 0.8);
  if (ar) artwork(k, ar[0], R.y + 2.0, ar[1], 1.0, 0.7, ar[2], 0x6b5b45);

  // ── cooking together ─────────────────────────────────────────────────────
  // Two of you at one island: the board and the recipe at the east end, the
  // bowl and the utensils at the west, the sink between them.  The barstools
  // are on the south face, so the cooks work the north one — which is where
  // the runner is, and where there is 1.6 m between them.
  const ix = R.x - 0.6, iz = R.z - 1.0, iy = R.y + 0.95;       // the island worktop
  choppingBoard(k, ix + 0.85, iy, iz + 0.25, { rotY: 0 });
  openBook(k, ix + 1.3, iy, iz - 0.25, { rotY: 0, stand: true, color: 0x8c3b3b, w: 0.16 });
  mixingBowl(k, ix - 1.25, iy, iz + 0.3, { color: 0xdfe3e8 });
  utensilCrock(k, ix - 1.55, iy, iz - 0.3, {});
  // something on the hob: a front burner of the range, which faces the room
  cookPot(k, R.x + 1.5, R.y + 0.96, backZ - 0.16, {});
  k.world.spot('cookA', ix - 0.9, R.y, iz - 1.35, { rotY: 0 });
  k.world.spot('cookB', ix + 0.7, R.y, iz - 1.35, { rotY: 0 });
  void rng;
}

function dining(k, R, rng) {
  const M = k.M;
  const b = { x: R.x, y: R.y, z: R.z, r: 0 };
  // rug first, so the table stands on it
  rug(k, R.x, R.y, R.z, 4.6, 3.0, 0x6b4f3a);
  k.p(b, 0, 0.74, 0, 3.0, 0.08, 1.3, M.get('walnut'), 1.2);
  for (const [ox, oz] of [[-1.3, -0.5], [1.3, -0.5], [-1.3, 0.5], [1.3, 0.5]]) k.p(b, ox, 0.37, oz, 0.12, 0.74, 0.12, M.get('walnut'), 0.5);
  k.pc(b, 0, 0.4, 0, 3.0, 0.8, 1.3);
  // Every chair carries its own seat interactable (diningChair does that), and
  // the whole ring is collected for `world.diningSet.seats` — the four middle
  // places first, because those are the four that get laid.
  const laid = [], spare = [];
  for (let i = 0; i < 4; i++) {
    const cx = R.x - 1.1 + i * 0.73;
    for (const s of [-1, 1]) {
      const rotY = s < 0 ? 0 : Math.PI;                 // always facing the table
      diningChair(k, cx, R.y, R.z + s * 1.05, { rotY });
      (i === 1 || i === 2 ? laid : spare).push({ pos: V(cx, R.y, R.z + s * 1.05), rotY });
    }
  }
  // the two carvers, turned in: at ∓π/2 they sat looking at the wall
  for (const s of [-1, 1]) {
    const rotY = s < 0 ? Math.PI / 2 : -Math.PI / 2;
    diningChair(k, R.x + s * 1.9, R.y, R.z, { rotY });
    spare.push({ pos: V(R.x + s * 1.9, R.y, R.z), rotY });
  }
  // centrepiece + chandelier
  vase(k, R.x, R.y + 0.78, R.z, { scale: 1.2, color: 0xc9d4cb });
  for (let i = 0; i < 3; i++) {
    k.box(0.03, 0.9, 0.03, M.get('gold'), R.x - 0.8 + i * 0.8, R.y + 3.3, R.z, { tile: 0.2 });
    k.box(0.5, 0.14, 0.5, M.emissive(0xffdca8, 2.0), R.x - 0.8 + i * 0.8, R.y + 2.8, R.z, { tile: 0.3 });
  }
  // sideboard
  k.box(2.4, 0.9, 0.5, M.get('walnut'), R.x, R.y + 0.45, R.z - R.d / 2 + 0.5, { tile: 0.9 });
  k.world.collider(2.4, 0.9, 0.5, R.x, R.y + 0.45, R.z - R.d / 2 + 0.5);
  artwork(k, R.x, R.y + 2.0, R.z - R.d / 2 + 0.3, 1.6, 1.0, 0, 0x5a4a3f);
  k.world.spot('dining', R.x, R.y, R.z + 1.8);

  // ── detailing ────────────────────────────────────────────────────────────
  railRound(k, R);
  // the sideboard laid out: candlesticks, photographs, a bowl
  const sz = R.z - R.d / 2 + 0.5;
  dressTop(k, R.x, R.y + 0.9, sz, rng, { rotY: 0, w: 1.9, n: 3, kinds: ['photo', 'bowl', 'vase'] });
  for (const s of [-1, 1]) {
    k.box(0.06, 0.34, 0.06, M.get('gold'), R.x + s * 1.05, R.y + 1.07, sz, { tile: 0.2 });
    k.box(0.03, 0.16, 0.03, M.paint(0xf6f0dc, 0.8, 'candle'), R.x + s * 1.05, R.y + 1.32, sz, { tile: 0.1 });
  }
  // a second serving cabinet with a mirror over it, on whichever wall is free
  const cab = wallSpot(k, R, 'e', R.z - 2.4, 1.1, { inset: 0.3, pad: 0.6 });
  const cabW = wallSpot(k, R, 'e', R.z - 2.4, 1.1, { inset: 0.06, pad: 0.6 });
  if (cab && cabW) {
    consoleTable(k, cab[0], R.y, cab[1], { w: 2.0, d: 0.45, rotY: cab[2] });
    dressTop(k, cab[0], R.y + 0.91, cab[1], rng, { rotY: cab[2], w: 1.5, n: 2, kinds: ['vase', 'books'] });
    tallMirror(k, cabW[0], R.y + 1.15, cabW[1], { rotY: cabW[2], w: 1.1, h: 1.3, base: 0 });
  }
  const wine = wallSpot(k, R, 'e', R.z + 2.6, 0.7, { inset: 0.24, pad: 0.6 });
  if (wine) {
    // wine rack: a grid of bottle ends in a walnut case
    k.box(0.42, 1.1, 1.2, M.get('walnut'), wine[0], R.y + 0.55, wine[1], { rotY: wine[2], tile: 0.5 });
    for (let i = 0; i < 12; i++) {
      k.box(0.06, 0.08, 0.08, M.solid(rng.pick([0x2b3a24, 0x3a2b24, 0x1f2b30]), 0.4),
        wine[0] - 0.2 * Math.sin(wine[2]), R.y + 0.3 + Math.floor(i / 4) * 0.24, wine[1] - 0.4 + (i % 4) * 0.26, { rotY: wine[2], tile: 0.1 });
    }
    k.col(0.45, 1.1, 1.25, wine[0], R.y + 0.55, wine[1], wine[2]);
  }
  for (const s of [-1, 1]) {
    const sc = wallSpot(k, R, 'w', R.z + s * 2.8, 0.3);
    if (sc) sconce(k, sc[0], R.y + 2.1, sc[1], sc[2]);
    const ar = wallSpot(k, R, 'w', R.z + s * 1.0, 0.7);
    if (ar) artwork(k, ar[0], R.y + 2.0, ar[1], 0.9, 1.2, ar[2], rng.pick([0x5a4a3f, 0x4b5a68, 0x6b5b45]));
  }
  dressWindows(k, R, 'n', 0xa8b2bb, 3.0);
  plant(k, R.x + R.w / 2 - 1.2, R.y, R.z - R.d / 2 + 1.4, 1.5);
  wastebasket(k, R.x - R.w / 2 + 0.9, R.y, R.z - R.d / 2 + 1.0, {});

  // ── the family sits down ─────────────────────────────────────────────────
  layTable(k, R, laid, spare);
  partyKit(k, R, cab);
}

/**
 * The table laid.  Four places — the middle chair either side, which is where
 * four people actually sit — plus what goes down the middle of the table.  It
 * all lives in one group so the game can lay the table and clear it again.
 */
function layTable(k, R, laid, spare) {
  const ty = R.y + 0.78;                                  // the top of the table
  const grp = grouped(k, 'diningSet', () => {
    for (const s of laid) {
      // a setting sits 0.63 m in front of its chair, the way that chair faces
      placeSetting(k, s.pos.x + Math.sin(s.rotY) * 0.63, ty, s.pos.z + Math.cos(s.rotY) * 0.63,
        { rotY: s.rotY, napkin: 0xc9d4cb });
    }
    // down the centre, clear of the vase at the middle and the cake's corner
    jug(k, R.x - 1.15, ty, R.z, {});
    servingDish(k, R.x - 0.72, ty, R.z, { food: 0xc9873f });
    servingDish(k, R.x + 0.72, ty, R.z, { w: 0.3, d: 0.22, food: 0x6b7a54, lid: false });
  });
  k.world.diningSet = { group: grp, seats: [...laid, ...spare] };
}

/**
 * The birthday box.  Nobody wants bunting up all year, so the whole party is
 * one hidden group the game raises and strikes.  Nothing in it stands on the
 * floor — the cake and the presents sit on furniture that already carries a
 * collider, the rest is overhead — so it adds no collision of its own.
 */
function partyKit(k, R, cab) {
  const ty = R.y + 0.78;
  const cakeAt = V(R.x + 1.18, ty, R.z);
  const grp = grouped(k, 'party', () => {
    // two swags across the room, either side of the chandelier
    for (const s of [-1, 1]) bunting(k, R.x, R.y + 2.95, R.z + s * 2.3, R.w - 0.5, { n: 14, sag: 0.34 });
    // a cluster tied to the back of each carver chair
    for (const s of [-1, 1]) balloons(k, R.x + s * 2.1, R.y + 1.05, R.z, { n: 5, h: 1.05, seed: s < 0 ? 0 : 2 });
    // the banner goes on the pantry wall, which is the one this room looks
    // down; failing that, high on the facade above the window heads
    const wall = wallSpot(k, R, 'e', R.z, 1.3, { inset: 0.05 });
    if (wall) banner(k, wall[0], R.y + 2.2, wall[1], { rotY: wall[2], w: 2.4 });
    else {
      const nw = wallSpot(k, R, 'n', R.x, 1.3, { windows: true, inset: 0.05 });
      if (nw) banner(k, nw[0], R.y + 3.1, nw[1], { rotY: nw[2], w: 2.4 });
    }
    // the cake, at the end of the table nobody is sitting at
    cake(k, cakeAt.x, ty, cakeAt.z, { candles: 8 });
    // hats and cups: one of each per laid place, the spare hats at the ends
    for (let i = 0; i < 4; i++) {
      const px = R.x - 0.37 + (i % 2) * 0.73, s = i < 2 ? -1 : 1;
      // the cup goes above the fork — the setting's own glass has the other side
      paperCup(k, px - s * 0.19, ty, R.z + s * 0.23, { color: [0xe23b57, 0xf5c518, 0x2f81ff, 0x6ab04c][i] });
      partyHat(k, px, ty, R.z + s * 0.6, { color: [0xf5c518, 0xe86fa8, 0x6ab04c, 0xe23b57][i], lying: i % 2 === 0 });
    }
    for (const s of [-1, 1]) partyHat(k, R.x - 1.34, ty, R.z + s * 0.45, { color: 0x2f81ff, lying: s < 0 });
    // presents on the serving cabinet, or on the sideboard if there isn't one
    if (cab) {
      presents(k, cab[0], R.y + 0.885, cab[1] - 0.78, { rotY: cab[2], n: 3 });
      presents(k, cab[0], R.y + 0.885, cab[1] + 0.8, { rotY: cab[2], n: 1, w: 0.26, seed: 2 });
    } else {
      presents(k, R.x - 0.95, R.y + 0.9, R.z - R.d / 2 + 0.5, { n: 3 });
    }
  });
  grp.visible = false;
  // eight candles are a real light source: a small warm pool that only burns
  // while the cake is out
  const candlelight = k.world.addLight({
    pos: V(cakeAt.x, ty + 0.34, cakeAt.z),
    color: 0xffb96a, intensity: 1.7, distance: 2.8, on: false,
  });
  k.world.party = {
    group: grp,
    cakeSpot: cakeAt,
    show(on) {
      grp.visible = on !== false;
      candlelight.on = grp.visible;
    },
  };
}

function library(k, R, rng) {
  const M = k.M;
  // west wall run, backs tight to the wall and split around the west door
  // (its leaf is at R.z ± 0.7)
  for (const zz of [R.z - 3.7, R.z - 1.85, R.z + 1.75, R.z + 3.6]) {
    bookshelf(k, R.x - R.w / 2 + 0.35, R.y, zz, { rotY: Math.PI / 2, w: 1.8, h: 2.6 });
  }
  bookshelf(k, R.x, R.y, R.z - R.d / 2 + 0.4, { w: 2.4, h: 2.6 });
  desk(k, R.x + 1.4, R.y, R.z + 1.0, { rotY: Math.PI, w: 1.9, d: 0.85 });
  officeChair(k, R.x + 1.4, R.y, R.z + 2.0, { rotY: 0 });
  armchair(k, R.x + 1.6, R.y, R.z - 2.4, { rotY: Math.PI });
  rug(k, R.x + 0.6, R.y, R.z, 3.4, 2.6, 0x6b4f3a);
  tableLamp(k, R.x + 1.4, R.z + 0.7, R.y + 0.79);
  k.world.spot('library', R.x + 1.0, R.y, R.z);

  // ── detailing ────────────────────────────────────────────────────────────
  railRound(k, R, ['w', 's']);   // the west wall is 2.6 m of shelving, the south is the door run
  // a second chair by the first, a lamp between them, books left about
  armchair(k, R.x + 3.2, R.y, R.z - 2.4, { rotY: Math.PI, color: 0x5a4a3f });
  sideTable(k, R.x + 2.4, R.y, R.z - 2.9, { w: 0.55 });
  bookStack(k, R.x + 2.4, R.y + 0.6, R.z - 2.9, { n: 3 });
  floorLamp(k, R.x + 3.4, R.y, R.z - 3.6, { h: 1.6 });
  bookStack(k, R.x + 1.9, R.y + 0.77, R.z + 1.0, { n: 4 });
  magazines(k, R.x + 0.9, R.y + 0.77, R.z + 1.0, { n: 2 });
  bookStack(k, R.x - R.w / 2 + 1.4, R.y, R.z + 0.2, { n: 4, w: 0.3 });
  // a library ladder against the shelves, a globe, a bin and a gramophone
  const lx = R.x - R.w / 2 + 1.05;
  for (const s of [-1, 1]) k.box(0.06, 2.3, 0.06, M.get('walnut'), lx + s * 0.02, R.y + 1.15, R.z - 0.8 + s * 0.34, { rotX: 0.1, tile: 0.3 });
  for (let i = 0; i < 5; i++) k.box(0.5, 0.04, 0.05, M.get('walnut'), lx, R.y + 0.4 + i * 0.42, R.z - 0.8 + (i - 2) * 0.02, { rotY: Math.PI / 2, tile: 0.2 });
  k.col(0.2, 2.3, 0.8, lx, R.y + 1.15, R.z - 0.8);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), M.solid(0x3f6ea8, 0.7));
  globe.position.set(R.x + 3.0, R.y + 0.95, R.z + 2.6);
  k.world.addProp(globe);
  k.box(0.06, 0.7, 0.06, M.get('walnut'), R.x + 3.0, R.y + 0.35, R.z + 2.6, { tile: 0.2 });
  k.box(0.34, 0.05, 0.34, M.get('walnut'), R.x + 3.0, R.y + 0.03, R.z + 2.6, { tile: 0.2 });
  k.col(0.36, 1.2, 0.36, R.x + 3.0, R.y + 0.6, R.z + 2.6);
  wastebasket(k, R.x + 2.6, R.y, R.z + 1.4, { metal: true });
  radio(k, R.x + R.w / 2 - 0.9, R.y + 0.9, R.z + 3.4, { rotY: -Math.PI / 2 });
  consoleTable(k, R.x + R.w / 2 - 0.7, R.y, R.z + 3.4, { w: 1.4, d: 0.42, rotY: -Math.PI / 2 });
  const ar = wallSpot(k, R, 'e', R.z - 1.2, 0.8);
  if (ar) artwork(k, ar[0], R.y + 2.0, ar[1], 1.1, 0.8, ar[2], 0x4a3f5c);
  for (const s of [-1, 1]) {
    const sc = wallSpot(k, R, 'e', R.z + s * 3.4, 0.3);
    if (sc) sconce(k, sc[0], R.y + 2.15, sc[1], sc[2]);
  }
  dressWindows(k, R, 'n', 0x8c7f6e, 2.8);
  void rng;
}

function music(k, R, rng) {
  piano(k, R.x, R.y, R.z, 0);
  armchair(k, R.x + 2.4, R.y, R.z + 1.4, { rotY: Math.PI });
  rug(k, R.x, R.y, R.z, 4.0, 3.2, 0x5c4c58);
  artwork(k, R.x, R.y + 2.0, R.z - R.d / 2 + 0.3, 1.4, 0.9, 0, 0x3d3550);
  // ── detailing ──
  railRound(k, R);
  floorLamp(k, R.x - 2.6, R.y, R.z - 1.6, { h: 1.6 });
  sideTable(k, R.x + 3.1, R.y, R.z + 1.4, { w: 0.5, lamp: true });
  // a music stand and a case propped against the wall
  k.box(0.05, 1.1, 0.05, k.M.get('blackMetal'), R.x - 1.6, R.y + 0.55, R.z + 1.6, { tile: 0.2 });
  k.box(0.5, 0.36, 0.04, k.M.get('blackMetal'), R.x - 1.6, R.y + 1.16, R.z + 1.6, { rotX: -0.35, tile: 0.2 });
  k.box(0.42, 1.2, 0.24, k.M.paint(0x3a2b24, 0.6, 'case'), R.x - R.w / 2 + 0.7, R.y + 0.6, R.z + 2.4, { rotZ: 0.12, tile: 0.3 });
  k.col(0.45, 1.2, 0.3, R.x - R.w / 2 + 0.7, R.y + 0.6, R.z + 2.4);
  const sh = wallSpot(k, R, 'e', R.z - 1.6, 0.7, { inset: 0.14 });
  if (sh) wallShelf(k, sh[0], R.y + 1.6, sh[1], { rotY: sh[2], w: 1.2 });
  void rng;
}

function foyer(k, R, rng) {
  const M = k.M;
  // console table + mirror flanking the door
  for (const s of [-1, 1]) {
    consoleTable(k, R.x + s * 3.4, R.y, R.z - R.d / 2 + 0.6, { w: 1.4, d: 0.42 });
    k.box(1.1, 1.6, 0.05, M.get('mirror'), R.x + s * 3.4, R.y + 1.9, R.z - R.d / 2 + 0.42, { tile: 0.8 });
    plant(k, R.x + s * 4.8, R.y, R.z - R.d / 2 + 0.9, 1.4);
    dressTop(k, R.x + s * 3.4, R.y + 0.91, R.z - R.d / 2 + 0.6, rng, { w: 1.0, n: 2, kinds: ['bowl', 'photo', 'vase'] });
  }
  // family photo wall going up the stair
  const colors = [0x3f5c6b, 0x6b543f, 0x4a3f5c, 0x3f6b4d, 0x6b3f4a];
  for (let i = 0; i < 5; i++) {
    // west wall — the canvas must face east into the room
    artwork(k, R.x - 5.9, R.y + 2.0 + i * 0.55, R.z - 4.0 + i * 1.1, 0.7, 0.5, Math.PI / 2, colors[i]);
  }
  k.world.spot('foyerCentre', R.x, R.y, R.z - 5.0);

  // ── detailing ────────────────────────────────────────────────────────────
  // a runner from the front door to the foot of the stair, layered on a rug
  rug(k, R.x, R.y, R.z - 6.0, 5.0, 3.0, 0x6b5a4a);
  rug(k, R.x, R.y + 0.01, R.z - 6.0, 2.0, 2.6, 0x7d2a33);
  umbrellaStand(k, R.x - 2.3, R.y, R.z - R.d / 2 + 0.55);
  // bench and hooks on the east wall, well north of the gallery arch
  const bn = wallSpot(k, R, 'e', R.z - 5.6, 1.0, { inset: 0.3, pad: 0.8 });
  if (bn) {
    bench(k, bn[0], R.y, bn[1], { w: 1.6, rotY: bn[2], color: 0x8a7f6c, rack: true });
    coatHooks(k, bn[0] - 0.24 * Math.sin(bn[2]), R.y + 1.75, bn[1] - 0.24 * Math.cos(bn[2]), { rotY: bn[2], w: 1.4, n: 4 });
  }
  const cl = wallSpot(k, R, 'e', R.z - 8.4, 0.3);
  if (cl) wallClock(k, cl[0], R.y + 2.4, cl[1], cl[2], { hour: 9, minute: 5, d: 0.44 });
  const ar = wallSpot(k, R, 'e', R.z - 2.6, 1.0);
  if (ar) artwork(k, ar[0], R.y + 2.4, ar[1], 1.4, 1.9, ar[2], 0x3f5c6b);
  // lamps either side of the stair mouth, clear of the newel posts
  for (const s of [-1, 1]) floorLamp(k, R.x + s * 2.7, R.y, R.z - 4.2, { h: 1.65 });
  for (const s of [-1, 1]) {
    const sc = wallSpot(k, R, 'w', R.z - 5.4 + s * 1.4, 0.3);
    if (sc) sconce(k, sc[0], R.y + 2.6, sc[1], sc[2], { intensity: 6 });
  }
}

function sunroom(k, R, rng) {
  const M = k.M;
  const b = { x: R.x, y: R.y, z: R.z + 0.6, r: 0 };
  rug(k, R.x, R.y, R.z + 0.6, 3.2, 3.2, 0x9aa88c);
  k.p(b, 0, 0.74, 0, 1.5, 0.07, 1.5, M.get('maple'), 0.9);
  for (const [ox, oz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) k.p(b, ox, 0.37, oz, 0.08, 0.74, 0.08, M.get('maple'), 0.4);
  k.pc(b, 0, 0.4, 0, 1.5, 0.8, 1.5);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    diningChair(k, R.x + Math.cos(a) * 1.15, R.y, R.z + 0.6 + Math.sin(a) * 1.15, { rotY: -a + Math.PI / 2 });
  }
  plant(k, R.x - R.w / 2 + 1.0, R.y, R.z - 1.6, 1.5);
  plant(k, R.x + R.w / 2 - 1.0, R.y, R.z - 1.6, 1.2);
  k.world.spot('sunroom', R.x, R.y, R.z);

  // ── detailing ────────────────────────────────────────────────────────────
  // a pair of loungers facing the glass — pushed west of the terrace door, so
  // the way out to the pool stays open
  for (const s of [-1, 1]) {
    armchair(k, R.x - 1.5 + s * 0.9, R.y, R.z + 3.6, { rotY: 0, color: 0xcfd8c9 });
  }
  sideTable(k, R.x - 1.5, R.y, R.z + 3.7, { w: 0.6 });
  magazines(k, R.x - 1.5, R.y + 0.6, R.z + 3.7, { n: 3 });
  floorLamp(k, R.x - 3.0, R.y, R.z + 3.6, { h: 1.5 });
  curtains(k, R.x - 1.6, R.y, R.z + R.d / 2 - 0.35, 4.0, Math.PI, 0xd8d2c6);
  fruitBowl(k, R.x, R.y + 0.78, R.z + 0.6, {});
  // a potting shelf and a whole crowd of plants — it is the garden room
  const sp = wallSpot(k, R, 'w', R.z + 3.6, 0.9, { inset: 0.16, pad: 0.6 });
  if (sp) {
    wallShelf(k, sp[0], R.y + 1.3, sp[1], { rotY: sp[2], w: 1.4, items: 3 });
    wallShelf(k, sp[0], R.y + 1.75, sp[1], { rotY: sp[2], w: 1.4, items: 3 });
  }
  for (const [px, pz, s] of [[R.x - 3.0, R.z + 2.2, 1.9], [R.x + 3.2, R.z - 3.2, 1.3], [R.x - 2.8, R.z - 3.6, 0.8], [R.x + 3.3, R.z + 1.0, 1.1]]) {
    plant(k, px, R.y, pz, s);
  }
  // watering can by the terrace door
  k.box(0.24, 0.24, 0.18, M.paint(0x6b7a54, 0.6, 'can'), R.x - 3.4, R.y + 0.12, R.z + 2.2, { tile: 0.2 });
  k.box(0.3, 0.04, 0.04, M.paint(0x6b7a54, 0.6, 'can'), R.x - 3.2, R.y + 0.22, R.z + 2.2, { rotZ: 0.4, tile: 0.2 });
  const cl = wallSpot(k, R, 'n', R.x - 2.2, 0.25);
  if (cl) wallClock(k, cl[0], R.y + 2.3, cl[1], cl[2], { hour: 11, minute: 40 });
  void rng;
}

function mud(k, R, rng) {
  const M = k.M;
  k.box(R.w - 0.6, 0.06, 0.45, M.get('maple'), R.x, R.y + 0.5, R.z - R.d / 2 + 0.4, { tile: 0.6 });
  k.box(R.w - 0.6, 1.8, 0.3, M.paint(0xdfe4e8, 0.6, 'lockers'), R.x, R.y + 1.6, R.z - R.d / 2 + 0.3, { tile: 0.7 });
  for (let i = 0; i < 4; i++) {
    k.box(0.05, 0.05, 0.14, M.get('chrome'), R.x - 1.2 + i * 0.8, R.y + 1.7, R.z - R.d / 2 + 0.5, { tile: 0.2 });
    k.box(0.4, 0.7, 0.16, M.paint([0x2f6fb5, 0xb56fa8, 0x6b7a54, 0x8a5b3a][i], 0.9, 'coat'),
      R.x - 1.2 + i * 0.8, R.y + 1.3, R.z - R.d / 2 + 0.52, { tile: 0.3 });
  }
  for (let i = 0; i < 4; i++) {
    k.box(0.28, 0.12, 0.4, M.paint([0x2b2b2b, 0x8a3b2f, 0x2f4f6b, 0x6b5330][i], 0.8, 'shoe'),
      R.x - 1.2 + i * 0.8, R.y + 0.08, R.z - R.d / 2 + 0.8, { tile: 0.2 });
  }

  // ── detailing ────────────────────────────────────────────────────────────
  // the west wall is the solid one: hooks, a shelf for keys, a mirror
  const hk = wallSpot(k, R, 'w', R.z - 2.6, 0.7, { inset: 0.1 });
  if (hk) coatHooks(k, hk[0], R.y + 1.7, hk[1], { rotY: hk[2], w: 1.3, n: 4 });
  const sh = wallSpot(k, R, 'w', R.z - 0.6, 0.6, { inset: 0.14 });
  if (sh) wallShelf(k, sh[0], R.y + 1.5, sh[1], { rotY: sh[2], w: 1.0, items: 2 });
  const mi = wallSpot(k, R, 'w', R.z + 1.6, 0.5, { inset: 0.08 });
  if (mi) tallMirror(k, mi[0], R.y + 0.9, mi[1], { rotY: mi[2], w: 0.7, h: 1.2, base: 0, frame: M.get('walnut') });
  umbrellaStand(k, R.x + R.w / 2 - 0.5, R.y, R.z - R.d / 2 + 1.3);
  laundryBasket(k, R.x - R.w / 2 + 0.55, R.y, R.z + 2.6, { color: 0xcfd8c9 });
  // boot tray under the bench, a bag dropped on the floor
  k.box(1.4, 0.05, 0.4, M.paint(0x3a3f45, 0.7, 'boottray'), R.x, R.y + 0.03, R.z - R.d / 2 + 1.1, { tile: 0.3 });
  k.box(0.5, 0.3, 0.3, M.paint(0x6b7a54, 0.85, 'bag'), R.x + 0.6, R.y + 0.15, R.z + 1.6, { rotY: 0.5, tile: 0.3 });
  k.col(0.52, 0.3, 0.32, R.x + 0.6, R.y + 0.15, R.z + 1.6, 0.5);
  const cl = wallSpot(k, R, 'e', R.z + 3.4, 0.25);
  if (cl) wallClock(k, cl[0], R.y + 2.1, cl[1], cl[2], { hour: 7, minute: 50, d: 0.28 });
  void rng;
}

function storage(k, R, rng) {
  const M = k.M;
  // the run goes on the wall *opposite* the door: on the south-half rooms the
  // door is on the north wall, and a 2.6 m rack of shelving across it walled
  // the room off from the corridor
  const doorSide = (R.def?.doors || [])[0]?.side;
  const shelfZ = doorSide === 'n' ? R.z + R.d / 2 - 0.4 : R.z - R.d / 2 + 0.4;
  for (let s = 0; s < 4; s++) {
    k.box(R.w - 1.2, 0.06, 0.5, M.get('steel'), R.x, R.y + 0.45 + s * 0.62, shelfZ, { tile: 0.6 });
    for (let i = 0; i < 6; i++) {
      if (!rng.chance(0.75)) continue;
      k.box(0.5, 0.4, 0.4, M.paint(rng.pick([0xb08968, 0xddb892, 0xa8b2bb, 0xcfd8c9]), 0.85, 'crate'),
        R.x - (R.w - 2.4) / 2 + i * ((R.w - 2.4) / 5), R.y + 0.68 + s * 0.62, shelfZ, { tile: 0.3 });
    }
  }
  k.world.collider(R.w - 1.2, 2.6, 0.5, R.x, R.y + 1.3, shelfZ);

  // ── detailing ────────────────────────────────────────────────────────────
  // a second run of shelving down whichever side wall is solid, jars on it
  const sp = wallSpot(k, R, 'w', R.z + 1.0, 1.6, { inset: 0.32, pad: 0.6 })
    || wallSpot(k, R, 'e', R.z + 1.0, 1.6, { inset: 0.32, pad: 0.6 });
  if (sp) {
    for (let s = 0; s < 3; s++) {
      k.box(0.55, 0.05, 3.2, M.get('steel'), sp[0], R.y + 0.5 + s * 0.62, sp[1], { tile: 0.5 });
      for (let i = 0; i < 7; i++) {
        if (!rng.chance(0.7)) continue;
        k.box(0.18, 0.24, 0.18, M.paint(rng.pick([0xd8cfbe, 0xc9d4cb, 0xdfe3e8, 0xb08968]), 0.5, 'jar'),
          sp[0], R.y + 0.65 + s * 0.62, sp[1] - 1.3 + i * 0.44, { tile: 0.2 });
      }
    }
    k.col(0.55, 2.0, 3.2, sp[0], R.y + 1.0, sp[1]);
  }
  // step ladder and a broom at the shelved end, well away from the door
  const lx = R.x - R.w / 2 + 0.9, lz = shelfZ + (doorSide === 'n' ? -1.5 : 1.5);
  for (const s of [-1, 1]) k.box(0.06, 1.7, 0.06, M.get('maple'), lx + s * 0.22, R.y + 0.85, lz, { rotZ: s * 0.06, tile: 0.3 });
  for (let i = 0; i < 4; i++) k.box(0.5, 0.04, 0.16, M.get('maple'), lx, R.y + 0.3 + i * 0.4, lz, { tile: 0.2 });
  k.col(0.6, 1.7, 0.3, lx, R.y + 0.85, lz);
  k.box(0.05, 1.4, 0.05, M.get('maple'), R.x + R.w / 2 - 0.6, R.y + 0.7, lz, { rotZ: 0.12, tile: 0.2 });
  k.box(0.3, 0.1, 0.12, M.paint(0x6b5330, 0.9, 'broom'), R.x + R.w / 2 - 0.52, R.y + 0.06, lz, { tile: 0.2 });
  const wb = wallSpot(k, R, R.z < 0 ? 's' : 'n', R.x - R.w / 2 + 0.8, 0.3, { windows: true, inset: 0.3, pad: 0.5 });
  if (wb) wastebasket(k, wb[0], R.y, wb[1], { w: 0.34, h: 0.5, metal: true });
}

// ── circulation ────────────────────────────────────────────────────────────
/** The stair hall's north half is empty floor — the flights are all south. */
function stairHall(k, R, rng) {
  const zN = R.z - R.d / 2;
  rug(k, R.x, R.y, zN + 4.0, 3.6, 4.4, 0x6b5a4a);
  consoleTable(k, R.x, R.y, zN + 0.55, { w: 1.8, d: 0.44 });
  dressTop(k, R.x, R.y + 0.91, zN + 0.55, rng, { w: 1.3, n: 2, kinds: ['vase', 'photo', 'bowl'] });
  for (const s of [-1, 1]) plant(k, R.x + s * 2.6, R.y, zN + 0.9, 1.6);
  bench(k, R.x, R.y, zN + 6.6, { w: 1.6, color: 0x8a7f6c });
  floorLamp(k, R.x - 3.0, R.y, zN + 5.6, { h: 1.65 });
  const ar = wallSpot(k, R, 'e', zN + 9.4, 1.0);
  if (ar) artwork(k, ar[0], R.y + 2.2, ar[1], 1.3, 1.8, ar[2], 0x4a3f5c);
  const cl = wallSpot(k, R, 'e', zN + 3.2, 0.3);
  if (cl) wallClock(k, cl[0], R.y + 2.3, cl[1], cl[2], { hour: 10, minute: 10, d: 0.4 });
  for (const s of [-1, 1]) {
    const sc = wallSpot(k, R, 'e', zN + 2.0 + s * 0.9, 0.3);
    if (sc) sconce(k, sc[0], R.y + 2.5, sc[1], sc[2]);
  }
}

/**
 * The galleries: sixty metres of corridor per floor with nothing in them.
 * Everything here dodges the stairwells by hand — the grand stair mouth in
 * the middle and the service stair at the east end both open into the band.
 */
function gallery(k, R, rng) {
  // the grand stair mouth, the service stair and the stair hall all open into
  // the band; none of them wants a console table in it
  const clearOfStairs = (x) => x > -20 && Math.abs(x) > 7.5 && !(x > 14.5 && x < 24.5);
  const cols = [0x3f5c6b, 0x6b543f, 0x4a3f5c, 0x3f6b4d, 0x6b3f4a, 0x5a4a3f];
  let i = 0;
  for (let x = R.x - R.w / 2 + 4; x < R.x + R.w / 2 - 3; x += 4.5) {
    if (!clearOfStairs(x)) continue;
    // a picture on whichever side of the corridor has a room's wall behind it
    for (const side of ['n', 's']) {
      if (!backedByRoom(k, R, side, x)) continue;
      const sp = wallSpot(k, R, side, x, 0.6, { pad: 0.45, inset: i % 3 === 2 ? 0.14 : 0.04 });
      if (!sp) continue;
      if (i % 3 === 2) {
        wallShelf(k, sp[0], R.y + 1.5, sp[1], { rotY: sp[2], w: 1.0, items: 2 });
      } else {
        artwork(k, sp[0], R.y + 2.0, sp[1], rng.range(0.7, 1.0), rng.range(0.5, 0.8), sp[2], cols[i % cols.length]);
      }
      i++;
    }
    // and every third bay gets a table with a lamp, tight to the wall
    if (i % 3 === 0) {
      const side = rng.chance(0.5) ? 'n' : 's';
      const sp = backedByRoom(k, R, side, x) ? wallSpot(k, R, side, x, 0.8, { inset: 0.26, pad: 0.7 }) : null;
      if (sp) {
        consoleTable(k, sp[0], R.y, sp[1], { w: 1.3, d: 0.38, rotY: sp[2] });
        if (rng.chance(0.5)) tableLamp(k, sp[0], sp[1], R.y + 0.91, { rotY: sp[2] });
        else vase(k, sp[0], R.y + 0.91, sp[1], { scale: 1.1 });
      }
    }
  }
  // runners down the middle, in the stretches the stairs leave alone
  for (const cx of [-19, -12, 12, 27]) {
    if (!clearOfStairs(cx) || cx < R.x - R.w / 2 + 3 || cx > R.x + R.w / 2 - 3) continue;
    rug(k, cx, R.y, R.z, 5.0, 1.6, 0x6b4f3a);
  }
}
