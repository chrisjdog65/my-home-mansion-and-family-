// ───────────────────────────────────────────────────────────────────────────
// Walks the finished room list and fills every one of them with furniture
// appropriate to what it is.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { makeRng } from '../core/rng.js';
import {
  Kit, bed, bunkBed, nightstand, dresser, wardrobe, bookshelf, desk, officeChair,
  diningChair, sofa, sectional, armchair, coffeeTable, rug, tv, tvUnit, fireplace,
  counterRun, island, fridge, range, vanity, toilet, bathtub, shower, plant,
  artwork, curtains, barstool, tableLamp,
} from './furniture.js';
import { theater, bowling, court, gym, gamingRoom, laundry, garage, workshop } from './amenities.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function furnishAll(world) {
  const k = new Kit(world);
  const rng = makeRng(4242);
  let gamingId = 0;

  for (const R of world.rooms) {
    const t = R.type;
    switch (t) {
      case 'bedroom': bedroom(k, R, rng); break;
      case 'bath': bathroom(k, R, rng); break;
      case 'gaming': gamingRoom(k, R, gamingId++); break;
      case 'theater': theater(k, R); break;
      case 'bowling': bowling(k, R); break;
      case 'court': court(k, R); break;
      case 'gym': gym(k, R); break;
      case 'laundry': laundry(k, R); break;
      case 'garage': garage(k, R); break;
      case 'workshop': workshop(k, R); break;
      case 'great': greatRoom(k, R); break;
      case 'family': familyRoom(k, R); break;
      case 'kitchen': kitchen(k, R); break;
      case 'dining': dining(k, R); break;
      case 'library': library(k, R); break;
      case 'music': music(k, R); break;
      case 'foyer': foyer(k, R); break;
      case 'sunroom': sunroom(k, R); break;
      case 'mud': mud(k, R); break;
      case 'pantry': case 'storage': storage(k, R, rng); break;
      default: break;
    }
    // a little life everywhere — but not in narrow rooms, where the corner
    // pot lands on the nightstands; the family room's west corner holds the
    // bookshelf, so its plant takes the east corner instead
    if (['bedroom', 'great', 'family', 'library', 'foyer', 'dining', 'sunroom', 'music'].includes(t) && R.w >= 7) {
      const px = t === 'family' ? R.x + R.w / 2 - 0.9 : R.x - R.w / 2 + 0.9;
      plant(k, px, R.y, R.z + R.d / 2 - 0.9, rng.range(0.9, 1.3));
    }
  }
  return k;
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
    bed(k, bx, R.y, bz, { size, rotY: north ? 0 : Math.PI, duvet: pal.duvet, sheet: pal.sheet });
    nightstand(k, bx - 1.5, R.y, bz - inward * 0.4, { rotY: north ? 0 : Math.PI });
    if (R.w > 7) nightstand(k, bx + 1.5, R.y, bz - inward * 0.4, { rotY: north ? 0 : Math.PI, lamp: false });
  }
  rug(k, R.x, R.y, R.z + inward * -0.4, Math.min(4.2, R.w - 2), Math.min(3.4, R.d - 3), pal.rug);

  // opposite wall: dresser + TV, wardrobe. `inward` points from the window
  // wall into the room, so the far wall is +inward, not -inward — and it is
  // also the wall the entry door is on, so re-derive the door span from the
  // plan and keep the row clear of it (leaf half-width + 0.4 m swing margin).
  const farZ = north ? R.z + R.d / 2 : R.z - R.d / 2;
  const dDef = (R.def?.doors || []).find((dd) => dd.side === (north ? 's' : 'n'));
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
    const dx = R.x + R.w / 2 - 1.4;
    desk(k, dx, R.y, wallZ + inward * 0.55, { rotY: north ? 0 : Math.PI, w: 1.4 });
    officeChair(k, dx, R.y, wallZ + inward * 1.35, { rotY: north ? Math.PI : 0, color: owner === 'james' ? 0x2f6fb5 : 0xb56fa8 });
    // shelf back tight to the west wall, shifted off the wall's door span
    bookshelf(k, R.x - R.w / 2 + 0.35, R.y, R.z - inward * 1.8, { rotY: Math.PI / 2, w: 1.4, h: 1.8 });
    // toys
    for (let i = 0; i < 5; i++) {
      k.box(0.22, 0.22, 0.22, k.M.solid(rng.pick([0xd0342c, 0x2f81ff, 0xf0b429, 0x6ab04c]), 0.6),
        R.x - R.w / 2 + 1.6 + i * 0.35, R.y + 0.11, R.z + inward * 1.4, { rotY: rng() * 3, tile: 0.2 });
    }
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
  if (!owner && R.name !== 'Bunk Room') {
    // window-end corner east of the bed, kept clear of the side wall, the bed
    // and the east nightstand (which exists when R.w > 7)
    const cornerMin = R.w > 7 ? 2.55 : 1.95;
    const cornerX = R.x + Math.min(Math.max(R.w / 2 - 1.4, cornerMin), R.w / 2 - 0.85);
    const cornerOk = R.w / 2 - 0.85 >= cornerMin;
    const variant = rng.pick(cornerOk ? ['reading', 'desk', 'bench', 'bean'] : ['bench', 'bean']);
    if (variant === 'reading') {
      // reading chair + floor lamp in the window-end corner
      armchair(k, cornerX, R.y, wallZ + inward * 1.25, { rotY: north ? 0 : Math.PI, color: pal.rug });
      const lx = R.x + R.w / 2 - 0.55, lz = wallZ + inward * 0.55;
      k.box(0.26, 0.04, 0.26, M.get('blackMetal'), lx, R.y + 0.02, lz, { tile: 0.2 });
      k.box(0.05, 1.5, 0.05, M.get('blackMetal'), lx, R.y + 0.77, lz, { tile: 0.2 });
      k.box(0.32, 0.3, 0.32, M.emissive(0xffe0b0, 0.9), lx, R.y + 1.62, lz, { tile: 0.4 });
      k.world.addLight({ pos: V(lx, R.y + 1.6, lz), color: 0xffd39a, intensity: 6, distance: 6.5, lamp: true });
    } else if (variant === 'desk') {
      // small desk + chair under the window
      desk(k, cornerX, R.y, wallZ + inward * 0.55, { rotY: north ? 0 : Math.PI, w: 1.3 });
      officeChair(k, cornerX, R.y, wallZ + inward * 1.3, { rotY: north ? Math.PI : 0, color: pal.art });
    } else if (variant === 'bench') {
      // upholstered bench at the foot of the bed
      const bnz = bz + inward * 1.55;
      k.box(1.3, 0.16, 0.42, M.paint(pal.rug, 0.9, 'bench'), bx, R.y + 0.36, bnz, { tile: 0.5 });
      for (const s of [-1, 1]) k.box(0.06, 0.28, 0.36, M.get('walnut'), bx + s * 0.55, R.y + 0.14, bnz, { tile: 0.3 });
      k.col(1.3, 0.5, 0.45, bx, R.y + 0.25, bnz);
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
  const wins = (k.world.windowMap || []).filter((wn) =>
    wn.floor === R.floor && wn.side === (north ? 'n' : 's') &&
    wn.x > R.x - R.w / 2 + 0.2 && wn.x < R.x + R.w / 2 - 0.2);
  if (wins.length) {
    for (const wn of wins) curtains(k, wn.x, R.y, wallZ + inward * 0.22, Math.min(3.2, (wn.w || 2.1) + 1.0), north ? 0 : Math.PI, curCol);
  } else {
    curtains(k, R.x, R.y, wallZ + inward * 0.22, Math.min(3.2, R.w * 0.5), north ? 0 : Math.PI, curCol);
  }
  if (owner) k.world.spot(`room_${owner}`, R.x, R.y, R.z);
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
    k.box(0.5, 0.62, 0.4, M.paint(0xd8dde1, 0.85, 'hamper'), hx, R.y + 0.31, doorWallZ - inward * 0.4, { tile: 0.4 });
    k.col(0.5, 0.62, 0.4, hx, R.y + 0.31, doorWallZ - inward * 0.4);
  }
}

// ── living spaces ──────────────────────────────────────────────────────────
function greatRoom(k, R) {
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
}

function familyRoom(k, R) {
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
  k.world.addInteract({
    pos: new THREE.Vector3(x, y + 0.9, z), radius: 2.0, label: 'Play the piano', kind: 'piano',
  });
}

function kitchen(k, R) {
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
  k.box(0.34, 0.1, 0.34, M.paint(0xd8cfbe, 0.4, 'bowl'), R.x - 1.4, R.y + 1.0, R.z - 1.0, { tile: 0.2 });
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), M.solid([0xd0342c, 0xf0b429, 0x6ab04c][i % 3], 0.5));
    s.position.set(R.x - 1.5 + (i % 3) * 0.11, R.y + 1.06, R.z - 1.05 + Math.floor(i / 3) * 0.1);
    k.world.addProp(s);
  }
  k.world.spot('kitchen', R.x - 0.6, R.y, R.z + 0.6);
  k.world.spot('kitchenIsland', R.x - 0.6, R.y, R.z - 2.0);
}

function dining(k, R) {
  const M = k.M;
  const b = { x: R.x, y: R.y, z: R.z, r: 0 };
  k.p(b, 0, 0.74, 0, 3.0, 0.08, 1.3, M.get('walnut'), 1.2);
  for (const [ox, oz] of [[-1.3, -0.5], [1.3, -0.5], [-1.3, 0.5], [1.3, 0.5]]) k.p(b, ox, 0.37, oz, 0.12, 0.74, 0.12, M.get('walnut'), 0.5);
  k.pc(b, 0, 0.4, 0, 3.0, 0.8, 1.3);
  for (let i = 0; i < 4; i++) {
    diningChair(k, R.x - 1.1 + i * 0.73, R.y, R.z - 1.05, { rotY: 0 });
    diningChair(k, R.x - 1.1 + i * 0.73, R.y, R.z + 1.05, { rotY: Math.PI });
  }
  diningChair(k, R.x - 1.9, R.y, R.z, { rotY: -Math.PI / 2 });
  diningChair(k, R.x + 1.9, R.y, R.z, { rotY: Math.PI / 2 });
  // centrepiece + chandelier
  k.box(0.5, 0.3, 0.2, M.paint(0xc9d4cb, 0.6, 'vase'), R.x, R.y + 0.93, R.z, { tile: 0.2 });
  for (let i = 0; i < 3; i++) {
    k.box(0.03, 0.9, 0.03, M.get('gold'), R.x - 0.8 + i * 0.8, R.y + 3.3, R.z, { tile: 0.2 });
    k.box(0.5, 0.14, 0.5, M.emissive(0xffdca8, 2.0), R.x - 0.8 + i * 0.8, R.y + 2.8, R.z, { tile: 0.3 });
  }
  // sideboard
  k.box(2.4, 0.9, 0.5, M.get('walnut'), R.x, R.y + 0.45, R.z - R.d / 2 + 0.5, { tile: 0.9 });
  k.world.collider(2.4, 0.9, 0.5, R.x, R.y + 0.45, R.z - R.d / 2 + 0.5);
  artwork(k, R.x, R.y + 2.0, R.z - R.d / 2 + 0.3, 1.6, 1.0, 0, 0x5a4a3f);
  k.world.spot('dining', R.x, R.y, R.z + 1.8);
}

function library(k, R) {
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
}

function music(k, R) {
  piano(k, R.x, R.y, R.z, 0);
  armchair(k, R.x + 2.4, R.y, R.z + 1.4, { rotY: Math.PI });
  rug(k, R.x, R.y, R.z, 4.0, 3.2, 0x5c4c58);
  artwork(k, R.x, R.y + 2.0, R.z - R.d / 2 + 0.3, 1.4, 0.9, 0, 0x3d3550);
}

function foyer(k, R) {
  const M = k.M;
  // console table + mirror flanking the door
  for (const s of [-1, 1]) {
    k.box(1.4, 0.85, 0.42, M.get('walnut'), R.x + s * 3.4, R.y + 0.42, R.z - R.d / 2 + 0.6, { tile: 0.7 });
    k.world.collider(1.4, 0.85, 0.42, R.x + s * 3.4, R.y + 0.42, R.z - R.d / 2 + 0.6);
    k.box(1.1, 1.6, 0.05, M.get('mirror'), R.x + s * 3.4, R.y + 1.9, R.z - R.d / 2 + 0.42, { tile: 0.8 });
    plant(k, R.x + s * 4.8, R.y, R.z - R.d / 2 + 0.9, 1.4);
  }
  // family photo wall going up the stair
  const colors = [0x3f5c6b, 0x6b543f, 0x4a3f5c, 0x3f6b4d, 0x6b3f4a];
  for (let i = 0; i < 5; i++) {
    // west wall — the canvas must face east into the room
    artwork(k, R.x - 5.9, R.y + 2.0 + i * 0.55, R.z - 4.0 + i * 1.1, 0.7, 0.5, Math.PI / 2, colors[i]);
  }
  k.world.spot('foyerCentre', R.x, R.y, R.z - 5.0);
}

function sunroom(k, R) {
  const M = k.M;
  const b = { x: R.x, y: R.y, z: R.z + 0.6, r: 0 };
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
}

function mud(k, R) {
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
}

function storage(k, R, rng) {
  const M = k.M;
  for (let s = 0; s < 4; s++) {
    k.box(R.w - 1.2, 0.06, 0.5, M.get('steel'), R.x, R.y + 0.45 + s * 0.62, R.z - R.d / 2 + 0.4, { tile: 0.6 });
    for (let i = 0; i < 6; i++) {
      if (!rng.chance(0.75)) continue;
      k.box(0.5, 0.4, 0.4, M.paint(rng.pick([0xb08968, 0xddb892, 0xa8b2bb, 0xcfd8c9]), 0.85, 'crate'),
        R.x - (R.w - 2.4) / 2 + i * ((R.w - 2.4) / 5), R.y + 0.68 + s * 0.62, R.z - R.d / 2 + 0.4, { tile: 0.3 });
    }
  }
  k.world.collider(R.w - 1.2, 2.6, 0.5, R.x, R.y + 1.3, R.z - R.d / 2 + 0.4);
}
