// ───────────────────────────────────────────────────────────────────────────
// The mansion shell: slabs, walls, doors, windows, stairs, roof.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { wallWithOpenings, stairs, railing, planarUV, boxMesh } from './build.js';
import {
  HOUSE, CORR, NORTH, SOUTH, WALL_T, FLOORS, FLOOR_ROOMS,
  SLAB_HOLES, GLASS_SPANS,
} from './plan.js';

const EPS = 0.01;

// Terrace openings in the south shell, in wall-local (= world x) coordinates:
// the family room's pair sits west of the great room's curtain wall, the
// sunroom's east of its own.  nav.js walks the family through both.
const TERRACE = [
  { x: -13.5, w: 2.4, h: 2.5, room: 'Family Room' },
  { x: 10.4, w: 2.4, h: 2.5, room: 'Breakfast Sunroom' },
];

// Rooms formal enough to earn wainscoting — everywhere else it's noise.
const FORMAL = new Set(['dining', 'library', 'foyer', 'great']);

// ── rectangle subtraction (slab holes) ─────────────────────────────────────
export function rectSubtract(rect, holes) {
  let out = [rect];
  for (const h of holes) {
    const next = [];
    for (const r of out) {
      if (h.x1 <= r.x0 + EPS || h.x0 >= r.x1 - EPS || h.z1 <= r.z0 + EPS || h.z0 >= r.z1 - EPS) {
        next.push(r); continue;
      }
      if (h.z0 > r.z0 + EPS) next.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: h.z0 });
      if (h.z1 < r.z1 - EPS) next.push({ x0: r.x0, x1: r.x1, z0: h.z1, z1: r.z1 });
      const zA = Math.max(r.z0, h.z0), zB = Math.min(r.z1, h.z1);
      if (h.x0 > r.x0 + EPS) next.push({ x0: r.x0, x1: h.x0, z0: zA, z1: zB });
      if (h.x1 < r.x1 - EPS) next.push({ x0: h.x1, x1: r.x1, z0: zA, z1: zB });
    }
    out = next;
  }
  return out.filter((r) => r.x1 - r.x0 > 0.05 && r.z1 - r.z0 > 0.05);
}

const cx = (r) => (r.x0 + r.x1) / 2;
const cz = (r) => (r.z0 + r.z1) / 2;
const rw = (r) => r.x1 - r.x0;
const rd = (r) => r.z1 - r.z0;

// ───────────────────────────────────────────────────────────────────────────
export function buildMansion(world) {
  const M = world.mats;
  const B = world.static;

  const matStruct = M.get('concrete');
  const matStone = M.get('stone');
  const matStucco = M.get('stucco');
  const matWall = M.get('wall');
  const matTrim = M.paint(0xf7f4ee, 0.5, 'trim');
  const matCeil = M.paint(0xf6f4f0, 0.92, 'ceiling');
  const matGlass = M.get('glass');
  const matWalnut = M.get('walnut');
  const matSteel = M.get('steel');

  const floorMat = (name) => {
    try { return M.get(name); } catch (e) { return M.get('oakFloor'); }
  };

  // world-space window centres, so furnish.js can hang curtains on real glass
  world.windowMap = [];

  // ── per level ────────────────────────────────────────────────────────────
  for (const F of FLOORS) {
    const rooms = FLOOR_ROOMS[F.key] || [];
    const holes = SLAB_HOLES[F.key] || [];
    const y = F.y;

    // Every opening on this level, in world space, so a shared wall is punched
    // from both sides no matter which room declared the door.
    const cuts = [];
    for (const R of rooms) {
      for (const dr of R.doors || []) {
        const axis = (dr.side === 'w' || dr.side === 'e') ? 'x' : 'z';
        const coord = dr.side === 'n' ? R.z0 : dr.side === 's' ? R.z1 : dr.side === 'w' ? R.x0 : R.x1;
        const pos = axis === 'z' ? cx(R) + dr.at : cz(R) + dr.at;
        cuts.push({ axis, coord, pos, w: dr.w, h: dr.w > 1.6 ? 2.7 : 2.25, owner: R, side: dr.side, dr });
      }
    }
    // the second-floor gallery railing at z ≈ 2.15 is meant to overlook the
    // double-height great room — open the upper storey of its north wall.
    // The wall stays visually solid to 4.35 and past the archway header; the
    // collider keeps a parapet to 1.1 m above the gallery floor (y 5.3) so
    // the void railing, not an invisible wall, is what stops a lean.
    if (F.key === 'ground') {
      const GR = rooms.find((r) => r.type === 'great' && r.tall);
      if (GR) {
        const door = (GR.doors || []).find((dd) => dd.side === 'n');
        const ox0 = GR.x0 + 1;
        const ox1 = door ? cx(GR) + door.at - door.w / 2 - 0.3 : GR.x1 - 1;
        cuts.push({
          axis: 'z', coord: GR.z0, pos: (ox0 + ox1) / 2, w: ox1 - ox0,
          y0: 4.35, h: 7.6, colY0: 5.3, owner: null, side: 'n', only: GR,
        });
      }
    }
    F._cuts = cuts;

    // structural slab (also the collision floor)
    for (const r of rectSubtract({ ...HOUSE }, holes)) {
      B.box(rw(r), 0.4, rd(r), matStruct, cx(r), y - 0.2, cz(r), { tile: 3 });
      world.collider(rw(r), 0.4, rd(r), cx(r), y - 0.2, cz(r));
    }

    // A cut slab shows its speckled concrete edge all round every void.  Line
    // each hole with a fascia board, top flush with the finished floor —
    // stretches buried inside a wall or a stair simply never show.
    for (const hl of holes) {
      const fy = y - 0.22, ft = 0.05, hw = hl.x1 - hl.x0, hd = hl.z1 - hl.z0;
      const hx = (hl.x0 + hl.x1) / 2, hz = (hl.z0 + hl.z1) / 2;
      B.box(hw, 0.44, ft, matTrim, hx, fy, hl.z0 + ft / 2, { tile: 1 });
      B.box(hw, 0.44, ft, matTrim, hx, fy, hl.z1 - ft / 2, { tile: 1 });
      B.box(ft, 0.44, hd, matTrim, hl.x0 + ft / 2, fy, hz, { tile: 1 });
      B.box(ft, 0.44, hd, matTrim, hl.x1 - ft / 2, fy, hz, { tile: 1 });
    }

    // corridor / gallery finish where it isn't a room
    const band = { x0: HOUSE.x0, x1: HOUSE.x1, z0: F.key === 'basement' ? -1.6 : CORR.z0, z1: F.key === 'basement' ? 1.6 : CORR.z1 };
    for (const r of rectSubtract(band, holes)) {
      const m = F.key === 'basement' ? M.get('polishedConcrete') : M.get('marble');
      B.box(rw(r), 0.04, rd(r), m, cx(r), y + 0.02, cz(r), { tile: 2 });
    }
    // the ceiling also dodges any stairwell descending from the level above,
    // or the camera clips through it on every trip up or down.  On the top
    // floor nothing exists above — stairs arrive through the FLOOR there, so
    // its own holes must not be punched through the ceiling as well
    const above = nextKey(F.key);
    const wellsAbove = (SLAB_HOLES[above] || [])
      .filter((h) => h.x0 < band.x1 && h.x1 > band.x0 && h.z0 < band.z1 && h.z1 > band.z0)
      .map((h) => ({ x0: h.x0 - 0.3, x1: h.x1 + 0.3, z0: h.z0 - 0.3, z1: h.z1 + 0.3 }));
    for (const r of rectSubtract(band, above ? [...holes, ...wellsAbove] : [])) {
      B.box(rw(r), 0.05, rd(r), matCeil, cx(r), y + F.ceil, cz(r), { tile: 2 });
    }

    // ── rooms ──────────────────────────────────────────────────────────────
    for (const R of rooms) {
      const w = rw(R), d = rd(R), x = cx(R), z = cz(R);
      const isTall = !!R.tall;
      const ceilY = y + (isTall ? F.ceil + 4.2 : F.ceil);

      // floor finish (minus any stairwell that drops through it)
      for (const fr of rectSubtract({ x0: R.x0 + WALL_T, x1: R.x1 - WALL_T, z0: R.z0 + WALL_T, z1: R.z1 - WALL_T }, holes)) {
        B.box(rw(fr), 0.045, rd(fr), floorMat(R.floor), cx(fr), y + 0.022, cz(fr), { tile: R.floor === 'marble' ? 1.6 : 1.4 });
      }

      // ceiling (skip only where a void substantially continues up — a corner
      // graze from a stairwell must not delete the whole room's ceiling)
      const voidAbove = (SLAB_HOLES[nextKey(F.key)] || []).some((hl) => {
        const ox = Math.min(R.x1, hl.x1) - Math.max(R.x0, hl.x0);
        const oz = Math.min(R.z1, hl.z1) - Math.max(R.z0, hl.z0);
        return ox > 0 && oz > 0 && ox * oz > 0.15 * w * d;
      });
      if (!voidAbove || isTall) {
        B.box(w, 0.05, d, matCeil, x, ceilY, z, { tile: 2 });
      }

      // baseboard + crown
      const wallCol = M.paint(R.wall, R.type === 'gaming' ? 0.75 : 0.66, `wall_${R.name}`);
      buildRoomWalls(world, R, F, wallCol, matTrim, cuts);

      world.addRoom({
        name: R.name, type: R.type, floor: F.key, floorName: F.name,
        x, z, w, d, y, h: isTall ? F.ceil + 4.2 : F.ceil, def: R,
      });

      // ceiling lights: one per ~30 m²
      const n = Math.max(1, Math.min(6, Math.round((w * d) / 34)));
      for (let i = 0; i < n; i++) {
        const lx = n === 1 ? x : R.x0 + ((i + 0.5) / n) * w;
        const ly = y + (isTall ? F.ceil + 2.6 : F.ceil) - 0.85;
        world.addLight({
          pos: new THREE.Vector3(lx, ly, z),
          color: lightColor(R.type), intensity: lightPower(R.type), decay: 1.85,
          distance: Math.max(9, Math.min(22, Math.hypot(w, d) * 0.85)),
          room: R.name, floor: F.key,
        });
        // the visible housing hangs from the real ceiling — a long pendant in
        // tall rooms — while the virtual light stays lower so the room reads lit
        const fy = isTall ? ceilY - 2.9 : ceilY - 0.28;
        addFixture(world, R.type, lx, fy, z, ceilY);
      }
    }

    // corridor lights
    if (F.key !== 'ground' || true) {
      for (let lx = HOUSE.x0 + 5; lx <= HOUSE.x1 - 5; lx += 9) {
        if (holes.some((h) => lx > h.x0 && lx < h.x1)) continue;
        world.addLight({
          pos: new THREE.Vector3(lx, y + F.ceil - 0.8, 0), color: 0xffdcb4,
          intensity: 11, decay: 1.85, distance: 14, room: 'Gallery', floor: F.key,
        });
        addFixture(world, 'corridor', lx, y + F.ceil - 0.3, 0, y + F.ceil);
      }
    }

    buildExteriorShell(world, F, matStone, matStucco, matWall, matGlass, matTrim);
  }

  // the galleries are places too — register them so the HUD stops calling the
  // middle of the house 'The Grounds'.  Registered LAST so roomAt()'s
  // smallest-area preference keeps picking the real rooms where they overlap.
  const galleryNames = {
    basement: 'Lower Gallery', ground: 'Grand Gallery',
    second: 'Second-Floor Gallery', third: 'Third-Floor Gallery',
  };
  for (const F of FLOORS) {
    world.addRoom({
      name: galleryNames[F.key], type: 'corridor', floor: F.key, floorName: F.name,
      x: 0, z: 0, w: HOUSE.x1 - HOUSE.x0,
      d: F.key === 'basement' ? 3.2 : CORR.z1 - CORR.z0,
      y: F.y, h: F.ceil,
      def: { floor: F.key === 'basement' ? 'polishedConcrete' : 'marble' },
    });
  }

  buildStairs(world);
  buildRoof(world);
  buildFoyerFeature(world);
  buildTerraceDoors(world);
  if (FLOOR_ROOMS.ground.some((r) => r.garageDoors)) buildGarageDoors(world);

  return world;
}

function nextKey(k) {
  const order = ['basement', 'ground', 'second', 'third'];
  return order[order.indexOf(k) + 1];
}

function lightColor(type) {
  switch (type) {
    case 'theater': return 0xffa070;
    case 'gaming': return 0x8fb7ff;
    case 'bath': return 0xf4f7ff;
    case 'court': return 0xf2f6ff;
    case 'bowling': return 0xffd8a8;
    case 'garage': case 'workshop': case 'storage': return 0xf0f4ff;
    default: return 0xffe6cc;
  }
}
function lightPower(type) {
  switch (type) {
    case 'theater': return 7;
    case 'court': return 34;
    case 'bowling': return 18;
    case 'great': return 24;
    case 'garage': case 'workshop': case 'storage': return 18;
    case 'gym': return 26;
    case 'gaming': return 7;
    case 'bath': return 9;              // baths also have a vanity light
    default: return 14;
  }
}

// ── fixtures ───────────────────────────────────────────────────────────────
// `y` anchors the visible housing; `ceilY` is the real ceiling it hangs from.
function addFixture(world, type, x, y, z, ceilY = y + 0.2) {
  const M = world.mats, B = world.static;
  if (type === 'theater') {
    // recessed can, flush with the ceiling — no stem
    B.box(0.22, 0.1, 0.22, M.emissive(0xff8a5c, 1.4), x, ceilY - 0.06, z, { tile: 1 });
    return;
  }
  // a thin drop rod ties the housing to the ceiling instead of floating free
  if (ceilY - y > 0.14) {
    B.box(0.04, ceilY - y, 0.04, M.get('blackMetal'), x, (y + ceilY) / 2, z, { tile: 0.5 });
  }
  if (type === 'court' || type === 'garage' || type === 'workshop' || type === 'storage' || type === 'gym') {
    B.box(2.4, 0.09, 0.34, M.get('steel'), x, y + 0.1, z, { tile: 1 });
    B.box(2.3, 0.06, 0.28, M.emissive(0xf4f8ff, 1.9), x, y + 0.03, z, { tile: 1 });
  } else if (type === 'corridor') {
    B.box(0.3, 0.06, 0.3, M.get('gold'), x, y + 0.16, z, { tile: 1 });
    B.box(0.24, 0.16, 0.24, M.emissive(0xffd9a8, 1.6), x, y + 0.02, z, { tile: 1 });
  } else {
    B.box(0.55, 0.05, 0.55, M.get('chrome'), x, y + 0.14, z, { tile: 1 });
    B.box(0.46, 0.14, 0.46, M.emissive(0xfff0d8, 1.5), x, y + 0.02, z, { tile: 1 });
  }
}

// ── room walls ─────────────────────────────────────────────────────────────
function buildRoomWalls(world, R, F, wallCol, matTrim, cuts) {
  const B = world.static;
  const y = F.y;
  const h = R.tall ? F.ceil + 4.2 : F.ceil;
  const sides = ['n', 's', 'w', 'e'];
  // the gallery band this level actually has (the basement's is narrower)
  const cor0 = F.key === 'basement' ? -1.6 : CORR.z0;
  const cor1 = F.key === 'basement' ? 1.6 : CORR.z1;
  const matGallery = world.mats.paint(0xe6e0d3, 0.66, 'gallery');
  const formal = FORMAL.has(R.type);

  for (const side of sides) {
    // exterior faces are handled by the shell
    if (side === 'n' && Math.abs(R.z0 - HOUSE.z0) < 0.2) continue;
    if (side === 's' && Math.abs(R.z1 - HOUSE.z1) < 0.2) continue;
    if (side === 'w' && Math.abs(R.x0 - HOUSE.x0) < 0.2) continue;
    if (side === 'e' && Math.abs(R.x1 - HOUSE.x1) < 0.2) continue;

    let px, pz, len, rotY, axis, coord, from, to;
    if (side === 'n') { px = cx(R); pz = R.z0 + WALL_T / 2; len = rw(R); rotY = 0; axis = 'z'; coord = R.z0; from = R.x0; to = R.x1; }
    else if (side === 's') { px = cx(R); pz = R.z1 - WALL_T / 2; len = rw(R); rotY = 0; axis = 'z'; coord = R.z1; from = R.x0; to = R.x1; }
    else if (side === 'w') { px = R.x0 + WALL_T / 2; pz = cz(R); len = rd(R); rotY = Math.PI / 2; axis = 'x'; coord = R.x0; from = R.z0; to = R.z1; }
    else { px = R.x1 - WALL_T / 2; pz = cz(R); len = rd(R); rotY = Math.PI / 2; axis = 'x'; coord = R.x1; from = R.z0; to = R.z1; }
    // unit vector from the wall centreline into the room
    const inx = side === 'w' ? 1 : side === 'e' ? -1 : 0;
    const inz = side === 'n' ? 1 : side === 's' ? -1 : 0;

    const openings = [];
    const colOpenings = [];
    for (const c of cuts) {
      if (c.only && c.only !== R) continue;
      if (c.axis !== axis || Math.abs(c.coord - coord) > 0.25) continue;
      if (c.pos < from - 0.05 || c.pos > to + 0.05) continue;
      const world0 = axis === 'z' ? cx(R) : cz(R);
      const local = (axis === 'x' ? -(c.pos - world0) : (c.pos - world0));
      const o = { x: local, w: c.w, y0: c.y0 || 0, y1: Math.min(c.h, h - 0.2) };
      openings.push(o);
      // an overlook keeps a collider parapet where the wall visually opens
      colOpenings.push(c.colY0 === undefined ? o : { ...o, y0: c.colY0 });
      // only the room that declared the door hangs the leaf
      if (c.owner === R && !c._placed) {
        c._placed = true;
        registerDoor(world, R, F, side, c.dr, px, pz, rotY, local);
      }
    }

    // A wall on the gallery band has no room behind it, so painting both faces
    // in the room's colour hangs the Gaming Room's near-black in the corridor.
    // Two back-to-back leaves instead — one collider still covers the pair.
    const onCorridor = (side === 's' && Math.abs(R.z1 - cor0) < 0.2) ||
                       (side === 'n' && Math.abs(R.z0 - cor1) < 0.2);
    if (onCorridor) {
      const q = WALL_T / 4;
      wallWithOpenings(B, wallCol, px + inx * q, pz + inz * q, len, h, WALL_T / 2, openings, rotY, 2.2, y);
      wallWithOpenings(B, matGallery, px - inx * q, pz - inz * q, len, h, WALL_T / 2, openings, rotY, 2.2, y);
    } else {
      wallWithOpenings(B, wallCol, px, pz, len, h, WALL_T, openings, rotY, 2.2, y);
    }
    wallColliders(world, px, pz, len, h, WALL_T, colOpenings, rotY, y);

    // baseboard + crown, stopped where an opening actually reaches them
    trimRun(B, matTrim, px, pz, len, rotY, y + 0.065, 0.13, WALL_T + 0.03, openings, (o) => o.y0 < 0.3);
    trimRun(B, matTrim, px, pz, len, rotY, y + h - 0.045, 0.09, WALL_T + 0.03, openings, (o) => o.y1 > h - 0.25);

    // casings on the room face — the neighbour's leaf cases its own side,
    // except on the gallery, where this wall is both faces
    const fx = px + inx * (WALL_T / 2), fz = pz + inz * (WALL_T / 2);
    for (const o of openings) {
      if (o.y0 > 0.3 || o.w > 3.2) continue;
      doorCasing(B, matTrim, fx, fz, rotY, y, o);
      if (onCorridor) doorCasing(B, matTrim, px - inx * (WALL_T / 2), pz - inz * (WALL_T / 2), rotY, y, o);
    }
    if (formal) wainscotRun(B, matTrim, fx, fz, len, rotY, y, openings);
  }
}

// Slim trim surround standing proud of one face of a door opening.
function doorCasing(B, mat, px, pz, rotY, baseY, o) {
  const W = 0.09, T = 0.04, top = o.y1 + W;
  const at = (lx, cy, bw, bh) => B.box(bw, bh, T, mat,
    px + Math.cos(rotY) * lx, baseY + cy, pz - Math.sin(rotY) * lx, { rotY, tile: 1 });
  at(o.x - o.w / 2 - W / 2, top / 2, W, top);
  at(o.x + o.w / 2 + W / 2, top / 2, W, top);
  at(o.x, o.y1 + W / 2, o.w + W * 2, W);
}

// Chair rail plus stiles on a coarse pitch: wainscoting for three boxes a
// metre.  Anything that reaches the rail height breaks the run.
function wainscotRun(B, mat, px, pz, len, rotY, baseY, openings) {
  const RAIL = 0.95, T = 0.05, base = 0.14, half = len / 2;
  const reaches = (o) => (o.y0 ?? 0) < RAIL + 0.08;
  trimRun(B, mat, px, pz, len, rotY, baseY + RAIL, 0.07, T, openings, reaches);
  const n = Math.max(1, Math.round(len / 1.2));
  for (let i = 0; i <= n; i++) {
    const lx = -half + (i / n) * len;
    if (openings.some((o) => reaches(o) && Math.abs(lx - o.x) < o.w / 2 + 0.1)) continue;
    B.box(0.09, RAIL - base - 0.035, T * 0.7, mat,
      px + Math.cos(rotY) * lx, baseY + (RAIL - 0.035 + base) / 2, pz - Math.sin(rotY) * lx, { rotY, tile: 1 });
  }
}

// A horizontal trim box along a wall, cut where the given openings reach it —
// doorways break the baseboard, only full-height cuts break the crown.
function trimRun(B, mat, px, pz, len, rotY, cy, th, td, openings, reaches) {
  const cuts = openings.filter(reaches)
    .map((o) => ({ a: o.x - o.w / 2, b: o.x + o.w / 2 }))
    .sort((p, q) => p.a - q.a);
  const half = len / 2;
  const put = (x0, x1) => {
    if (x1 - x0 < 0.08) return;
    const lx = (x0 + x1) / 2;
    B.box(x1 - x0, th, td, mat, px + Math.cos(rotY) * lx, cy, pz - Math.sin(rotY) * lx, { rotY, tile: 1 });
  };
  let cursor = -half;
  for (const c of cuts) {
    const a = Math.max(-half, c.a), b = Math.min(half, c.b);
    if (a > cursor) put(cursor, a);
    cursor = Math.max(cursor, b);
  }
  if (cursor < half) put(cursor, half);
}

function wallColliders(world, px, pz, len, h, t, openings, rotY, baseY) {
  const cuts = openings
    .map((o) => ({ a: o.x - o.w / 2, b: o.x + o.w / 2, y0: o.y0 ?? 0, y1: o.y1 }))
    .sort((p, q) => p.a - q.a);
  const half = len / 2;
  const put = (x0, x1, y0, y1) => {
    if (x1 - x0 < 0.02 || y1 - y0 < 0.02) return;
    const lx = (x0 + x1) / 2;
    world.collider(x1 - x0, y1 - y0, t, px + Math.cos(rotY) * lx, baseY + (y0 + y1) / 2, pz - Math.sin(rotY) * lx, rotY);
  };
  let cursor = -half;
  for (const c of cuts) {
    const a = Math.max(-half, c.a), b = Math.min(half, c.b);
    if (a > cursor) put(cursor, a, 0, h);
    put(a, b, 0, Math.min(c.y0, h));            // spandrel below a window
    put(a, b, Math.min(c.y1, h), h);            // header above the opening
    cursor = Math.max(cursor, b);
  }
  if (cursor < half) put(cursor, half, 0, h);
}

// ── doors ──────────────────────────────────────────────────────────────────
function registerDoor(world, R, F, side, dr, px, pz, rotY, local) {
  if (dr.w > 1.6) return;                       // wide openings are archways
  const M = world.mats;
  const wx = px + Math.cos(rotY) * local;
  const wz = pz - Math.sin(rotY) * local;

  const leafW = dr.w - 0.04, leafH = 2.2;
  const pivot = new THREE.Group();
  // hinge on the left edge of the opening
  const hx = wx + Math.cos(rotY) * (-leafW / 2);
  const hz = wz - Math.sin(rotY) * (-leafW / 2);
  pivot.position.set(hx, F.y, hz);
  pivot.rotation.y = rotY;

  const leaf = boxMesh(leafW, leafH, 0.045, M.get('walnut'), leafW / 2, leafH / 2 + 0.02, 0, { tile: 1.1 });
  const panel = boxMesh(leafW * 0.7, leafH * 0.36, 0.055, M.paint(0xf2ece0, 0.5), leafW / 2, leafH * 0.72, 0, { tile: 1 });
  const panel2 = boxMesh(leafW * 0.7, leafH * 0.36, 0.055, M.paint(0xf2ece0, 0.5), leafW / 2, leafH * 0.3, 0, { tile: 1 });
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), M.get('gold'));
  knob.position.set(leafW - 0.1, 1.05, 0.06);
  const knob2 = knob.clone(); knob2.position.z = -0.06;
  pivot.add(leaf, panel, panel2, knob, knob2);
  world.addProp(pivot);

  const door = {
    pivot, open: false, t: 0, room: R.name, w: leafW,
    center: new THREE.Vector3(wx, F.y + 1.1, wz),
    rotY, side,
  };
  world.doors.push(door);

  // closed doors block movement
  world.addBlocker({
    get active() { return door.t < 0.35; },
    center: door.center,
    halfW: leafW / 2, halfH: leafH / 2, halfD: 0.09,
    rotY,
    pos: new THREE.Vector3(wx, F.y + leafH / 2, wz),
  });

  world.addInteract({
    pos: door.center, radius: 2.2,
    label: () => (door.open ? 'Close door' : 'Open door'),
    onUse: () => { door.open = !door.open; return door.open ? 'creak' : 'latch'; },
    kind: 'door', data: door,
  });
}

// ── exterior shell ─────────────────────────────────────────────────────────
function buildExteriorShell(world, F, matStone, matStucco, matWall, matGlass, matTrim) {
  const B = world.static, M = world.mats;
  const y = F.y;
  const h = F.ceil + 0.4;
  const outer = F.key === 'ground' || F.key === 'basement' ? matStone : matStucco;
  const T_OUT = 0.24, T_IN = 0.12;

  const sides = [
    { key: 'n', px: 0, pz: HOUSE.z0, len: HOUSE.x1 - HOUSE.x0, rotY: 0, out: -1 },
    { key: 's', px: 0, pz: HOUSE.z1, len: HOUSE.x1 - HOUSE.x0, rotY: 0, out: 1 },
    { key: 'w', px: HOUSE.x0, pz: 0, len: HOUSE.z1 - HOUSE.z0, rotY: Math.PI / 2, out: -1 },
    { key: 'e', px: HOUSE.x1, pz: 0, len: HOUSE.z1 - HOUSE.z0, rotY: Math.PI / 2, out: 1 },
  ];

  for (const s of sides) {
    const openings = [];
    const glass = [];

    if (F.key !== 'basement') {
      const half = s.len / 2;
      // doors and curtain spans go in first so the window grid can dodge them
      if (s.key === 'n' && F.key === 'ground') {
        openings.push({ x: 0, w: 2.6, y0: 0, y1: 2.7 });        // front door
        openings.push({ x: 25.5, w: 8.4, y0: 0, y1: 3.0 });     // garage
      }
      if (s.key === 's' && F.key === 'ground') {
        for (const t of TERRACE) openings.push({ x: t.x, w: t.w, y0: 0, y1: t.h });
      }
      for (const g of GLASS_SPANS[F.key] || []) {
        if (s.key !== 's') continue;
        const c = (g.x0 + g.x1) / 2, w = g.x1 - g.x0;
        openings.push({ x: c, w, y0: 0.12, y1: F.ceil - 0.1 });
        glass.push({ x: c, w, y0: 0.12, y1: F.ceil - 0.1, curtain: true });
      }

      // interior partitions meeting this facade, in wall-local coordinates —
      // a wall arriving edge-on through the middle of a pane reads terribly
      const parts = [];
      for (const R of FLOOR_ROOMS[F.key] || []) {
        const touches =
          s.key === 'n' ? Math.abs(R.z0 - HOUSE.z0) < 0.2 :
          s.key === 's' ? Math.abs(R.z1 - HOUSE.z1) < 0.2 :
          s.key === 'w' ? Math.abs(R.x0 - HOUSE.x0) < 0.2 : Math.abs(R.x1 - HOUSE.x1) < 0.2;
        if (!touches) continue;
        for (const b of (s.key === 'n' || s.key === 's') ? [R.x0, R.x1] : [-R.z1, -R.z0]) {
          if (b > -half + 0.3 && b < half - 0.3) parts.push(b);
        }
      }
      parts.sort((a, b) => a - b);
      const segs = [];
      { let a = -half; for (const b of [...parts, half]) { if (b - a > 0.1) segs.push([a, b]); a = b; } }

      const WIN = 1.05 + 0.15;                    // pane half-width + clearance
      const fits = (q) => parts.every((b) => Math.abs(q - b) >= WIN - EPS) &&
        openings.every((o) => Math.abs(q - o.x) >= 1.05 + o.w / 2 + 0.25);

      const step = 4.4;
      for (let p = -half + step / 2; p < half; p += step) {
        // front door
        if (s.key === 'n' && Math.abs(p) < 4.6 && F.key === 'ground') continue;
        // garage doors
        if (s.key === 'n' && F.key === 'ground' && p > 20 && p < 30) continue;
        if (s.key === 's' && (GLASS_SPANS[F.key] || []).some((g) => p > g.x0 - 2.2 && p < g.x1 + 2.2)) continue;
        let q = p;
        if (!parts.every((b) => Math.abs(p - b) >= WIN)) {
          // straddles a partition — slide to the nearest clear spot in the
          // same room, or leave the bay blank rather than bunch the grid
          let best = null;
          for (const [a, b] of segs) {
            if (b - a < WIN * 2) continue;
            const c = Math.min(Math.max(p, a + WIN), b - WIN);
            if (Math.abs(c - p) > 2.2 || !fits(c)) continue;
            if (best === null || Math.abs(c - p) < Math.abs(best - p)) best = c;
          }
          if (best === null) continue;
          q = best;
        }
        openings.push({ x: q, w: 2.1, y0: 0.95, y1: 2.85 });
        glass.push({ x: q, w: 2.1, y0: 0.95, y1: 2.85 });
      }
    }

    const outPz = s.key === 'n' ? HOUSE.z0 - T_OUT / 2 : s.key === 's' ? HOUSE.z1 + T_OUT / 2 : 0;
    const outPx = s.key === 'w' ? HOUSE.x0 - T_OUT / 2 : s.key === 'e' ? HOUSE.x1 + T_OUT / 2 : 0;
    const inPz = s.key === 'n' ? HOUSE.z0 + T_IN / 2 : s.key === 's' ? HOUSE.z1 - T_IN / 2 : 0;
    const inPx = s.key === 'w' ? HOUSE.x0 + T_IN / 2 : s.key === 'e' ? HOUSE.x1 - T_IN / 2 : 0;

    wallWithOpenings(B, outer, outPx, outPz, s.len, h, T_OUT, openings, s.rotY, 2.6, y);
    // the inner face takes each room's own paint, run by run — one generic
    // white sheet per facade bleached the theater and the bowling alley
    {
      const half = s.len / 2;
      const runs = [];
      for (const R of FLOOR_ROOMS[F.key] || []) {
        const touches =
          s.key === 'n' ? Math.abs(R.z0 - HOUSE.z0) < 0.2 :
          s.key === 's' ? Math.abs(R.z1 - HOUSE.z1) < 0.2 :
          s.key === 'w' ? Math.abs(R.x0 - HOUSE.x0) < 0.2 : Math.abs(R.x1 - HOUSE.x1) < 0.2;
        if (!touches) continue;
        const [a, b] = (s.key === 'n' || s.key === 's') ? [R.x0, R.x1] : [-R.z1, -R.z0];
        runs.push({
          a: Math.max(a, -half), b: Math.min(b, half), formal: FORMAL.has(R.type),
          mat: M.paint(R.wall, R.type === 'gaming' ? 0.75 : 0.66, `wall_${R.name}`),
        });
      }
      runs.sort((p, q) => p.a - q.a);
      // whatever no room claims (partition thickness, corridor ends) stays white
      const fills = [];
      let cur = -half;
      for (const r of runs) {
        if (r.a > cur + 0.02) fills.push({ a: cur, b: r.a, mat: matWall });
        cur = Math.max(cur, r.b);
      }
      if (cur < half - 0.02) fills.push({ a: cur, b: half, mat: matWall });
      // unit vector from the shell's inner leaf into the rooms behind it
      const inx = s.key === 'w' ? 1 : s.key === 'e' ? -1 : 0;
      const inz = s.key === 'n' ? 1 : s.key === 's' ? -1 : 0;
      for (const r of [...runs, ...fills]) {
        const c = (r.a + r.b) / 2;
        const sub = openings
          .filter((o) => o.x + o.w / 2 > r.a + EPS && o.x - o.w / 2 < r.b - EPS)
          .map((o) => ({ ...o, x: o.x - c }));
        wallWithOpenings(B, r.mat, inPx + Math.cos(s.rotY) * c, inPz - Math.sin(s.rotY) * c,
          r.b - r.a, h, T_IN, sub, s.rotY, 2.4, y);
        // the formal rooms' wainscot has to carry across the shell too, or it
        // stops dead at every outside wall
        if (r.formal) {
          wainscotRun(B, matTrim, inPx + inx * (T_IN / 2) + Math.cos(s.rotY) * c,
            inPz + inz * (T_IN / 2) - Math.sin(s.rotY) * c, r.b - r.a, s.rotY, y, sub);
        }
      }
    }
    wallColliders(world, (outPx + inPx) / 2, (outPz + inPz) / 2, s.len, h, T_OUT + T_IN + 0.1, openings, s.rotY, y);

    // rooms shouldn't go bare where the shell stands in for their perimeter
    // walls — baseboard + crown on the inner face, cut at doors and curtains
    trimRun(B, matTrim, inPx, inPz, s.len, s.rotY, y + 0.065, 0.13, T_IN + 0.03, openings, (o) => o.y0 < 0.3);
    trimRun(B, matTrim, inPx, inPz, s.len, s.rotY, y + F.ceil - 0.045, 0.09, T_IN + 0.03, openings, (o) => o.y1 > F.ceil - 0.25);

    // glazing + frames
    for (const g of glass) {
      const gx = (s.key === 'w' ? HOUSE.x0 : s.key === 'e' ? HOUSE.x1 : 0) + Math.cos(s.rotY) * g.x;
      const gz = (s.key === 'n' ? HOUSE.z0 : s.key === 's' ? HOUSE.z1 : 0) - Math.sin(s.rotY) * g.x;
      const gh = g.y1 - g.y0;
      // publish where the pane actually ended up, so curtains find real glass
      if (!g.curtain) world.windowMap.push({ floor: F.key, side: s.key, x: gx, z: gz, w: g.w });
      B.box(g.w - 0.08, gh - 0.08, 0.03, matGlass, gx, y + (g.y0 + g.y1) / 2, gz, { rotY: s.rotY, tile: 1 });
      world.collider(g.w, gh, 0.06, gx, y + (g.y0 + g.y1) / 2, gz, s.rotY);   // glass is solid
      // frame
      const fm = matTrim;
      B.box(g.w, 0.09, 0.16, fm, gx, y + g.y0, gz, { rotY: s.rotY, tile: 1 });
      B.box(g.w, 0.09, 0.16, fm, gx, y + g.y1, gz, { rotY: s.rotY, tile: 1 });
      B.box(0.09, gh, 0.16, fm, gx + Math.cos(s.rotY) * (-g.w / 2), y + (g.y0 + g.y1) / 2, gz - Math.sin(s.rotY) * (-g.w / 2), { rotY: s.rotY, tile: 1 });
      B.box(0.09, gh, 0.16, fm, gx + Math.cos(s.rotY) * (g.w / 2), y + (g.y0 + g.y1) / 2, gz - Math.sin(s.rotY) * (g.w / 2), { rotY: s.rotY, tile: 1 });
      if (g.curtain) {
        const n = Math.max(1, Math.round(g.w / 2.6));
        for (let i = 1; i < n; i++) {
          const mx = -g.w / 2 + (i / n) * g.w;
          B.box(0.1, gh, 0.18, fm, gx + Math.cos(s.rotY) * mx, y + (g.y0 + g.y1) / 2, gz - Math.sin(s.rotY) * mx, { rotY: s.rotY, tile: 1 });
        }
      } else {
        B.box(0.06, gh, 0.14, fm, gx, y + (g.y0 + g.y1) / 2, gz, { rotY: s.rotY, tile: 1 });
        B.box(g.w, 0.06, 0.14, fm, gx, y + (g.y0 + g.y1) / 2, gz, { rotY: s.rotY, tile: 1 });
        // sill
        B.box(g.w + 0.3, 0.07, 0.42, matTrim, gx, y + g.y0 - 0.04, gz + (s.key === 'n' ? -0.12 : s.key === 's' ? 0.12 : 0), { rotY: s.rotY, tile: 1 });
      }
    }

    // storey band / cornice
    if (F.key !== 'basement') {
      B.box(s.len + 0.6, 0.22, T_OUT + 0.34, matTrim, outPx, y + h - 0.12, outPz, { rotY: s.rotY, tile: 1 });
    }
  }
}

// ── stairs ─────────────────────────────────────────────────────────────────
// A flight is authored twice over: the collider stack stays a solid stepped
// prism (the player's step-up reads it, and nobody can stand on a 5 cm board),
// while the visible stair is joinery — tread, riser, stringer, soffit.
//
// `o` describes the flight in its own frame: it starts at (x,y,z) and climbs
// along local +Z, which rotY turns into whichever way the run actually goes.
function flightPut(B, o, w, hgt, d, mat, lx, ly, lz, rotX = 0) {
  const c = Math.cos(o.rotY || 0), s = Math.sin(o.rotY || 0);
  B.box(w, hgt, d, mat, o.x + c * lx + s * lz, o.y + ly, o.z - s * lx + c * lz,
    { rotY: o.rotY || 0, rotX, tile: o.tile || 1.1 });
}

// A board laid on the rake, `drop` below the line the nosings run along.
function rakeBoard(B, o, mat, w, thick, lx, drop) {
  const climb = o.steps * o.rise, reach = o.steps * o.run;
  const slope = Math.atan2(climb, reach), d = drop + thick / 2;
  flightPut(B, o, w, thick, Math.hypot(reach, climb) + 0.12, mat, lx,
    climb / 2 - d * Math.cos(slope), reach / 2 + d * Math.sin(slope), -slope);
}

function stairFlight(B, o) {
  const TB = 0.05, NOSE = 0.035;
  for (let i = 0; i < o.steps; i++) {
    flightPut(B, o, o.w, TB, o.run + NOSE, o.tread, 0,
      (i + 1) * o.rise - TB / 2, (i + 0.5) * o.run - NOSE / 2);
    flightPut(B, o, o.w, o.rise - TB, 0.04, o.riser, 0,
      i * o.rise + (o.rise - TB) / 2, i * o.run + 0.02);
  }
  for (const s of [-1, 1]) rakeBoard(B, o, o.stringer, 0.07, 0.34, s * (o.w / 2 + 0.035), 0);
  if (o.soffit) rakeBoard(B, o, o.soffit, o.w + 0.07, 0.06, 0, 0.34);
}

function buildStairs(world) {
  const M = world.mats, B = world.static;
  const tread = M.get('walnut'), rail = M.get('gold'), post = M.get('blackMetal');
  const riser = M.paint(0xf1ead9, 0.6, 'stairRiser');
  const soffit = M.paint(0xf6f4f0, 0.92, 'ceiling');

  // ── Grand stair: one straight run up the middle of the foyer ────────────
  {
    const rise = 4.2 / 24, run = 0.29, W = 2.6, z0 = -9.4, N = 24;
    for (let i = 0; i < N; i++) {
      const h = (i + 1) * rise;
      world.collider(W, h, run, 0, h / 2, z0 + (i + 0.5) * run);
    }
    stairFlight(B, { x: 0, y: 0, z: z0, steps: N, rise, run, w: W, tread, riser, stringer: tread, soffit, tile: 1.2 });
    const topZ = z0 + N * run;
    // carpet runner
    for (let i = 0; i < N; i++) {
      B.box(W - 0.9, 0.012, run, M.paint(0x7d2a33, 0.95, 'runner'), 0, (i + 1) * rise + 0.007, z0 + (i + 0.5) * run, { tile: 0.8 });
    }
    for (const s of [-1, 1]) {
      // balusters stand on the stringer, not on the treads
      const bx = s * (W / 2 + 0.035);
      for (let i = 0; i < N; i += 2) {
        const h = (i + 1) * rise;
        B.box(0.05, 1.0, 0.05, post, bx, h + 0.5, z0 + (i + 0.5) * run, { tile: 0.4 });
      }
      const len = Math.hypot(N * run, 4.2);
      B.box(0.09, 0.09, len, rail, bx, 2.1 + 1.0, (z0 + topZ) / 2, { rotX: -Math.atan2(4.2, N * run), tile: 0.5 });
      // newels: a heavier post where the handrail starts and lands
      for (const [nz, ny] of [[z0 - 0.08, 0], [topZ + 0.08, 4.2]]) {
        B.box(0.15, 1.16, 0.15, post, bx, ny + 0.58, nz, { tile: 0.4 });
        B.box(0.19, 0.09, 0.19, rail, bx, ny + 1.2, nz, { tile: 0.4 });
      }
    }
    // upper gallery railing along the void's south rim — split at x ±1.5 so
    // the stair mouth stays open.  The void's east and west sides are solid
    // bedroom walls at x ±6, so they need (and get) no rails.
    for (const s of [-1, 1]) railing(world, post, rail, s * 3.75, 4.2, -2.35, 4.5, 0, 1.05);
    world.spot('grandStairBottom', 0, 0, -10.6);
    world.spot('grandStairTop', 0, 4.2, -1.4);
    world.stairLinks = world.stairLinks || [];
    world.stairLinks.push({ a: new THREE.Vector3(0, 0, -10.4), b: new THREE.Vector3(0, 4.2, -1.6) });
  }

  // ── Service stair: second → third, in the south half of the gallery ─────
  {
    const rise = 4.2 / 24, run = 0.29, W = 1.5, zc = 1.1, x0 = 16.2, N = 24;
    for (let i = 0; i < N; i++) {
      const h = rise * (i + 1);
      world.collider(run, h, W, x0 + (i + 0.5) * run, 4.2 + h / 2, zc);
    }
    stairFlight(B, {
      x: x0, y: 4.2, z: zc, rotY: Math.PI / 2, steps: N, rise, run, w: W,
      tread, riser, stringer: tread, soffit, tile: 1.2,
    });
    railing(world, post, rail, x0 + 3.5, 4.2, zc - 0.8, 7.2, 0, 1.0);
    railing(world, post, rail, 19.4, 8.4, 0.3, 8.0, 0, 1.05);
    railing(world, post, rail, 15.35, 8.4, 1.1, 1.5, Math.PI / 2, 1.05);   // west edge of the well
    world.spot('thirdStairBottom', 15.4, 4.2, zc);
    world.spot('thirdStairTop', 23.6, 8.4, zc);
    world.stairLinks.push({ a: new THREE.Vector3(15.6, 4.2, zc), b: new THREE.Vector3(23.6, 8.4, zc) });
  }

  // ── Lower-level stair: ground → basement, U-shaped inside the stair hall ─
  {
    const steps = 30, total = 6.0, rise = total / steps, run = 0.26, W = 1.4;
    // flight A heads west at z = -0.9
    for (let i = 0; i < 17; i++) {
      const yTop = -rise * (i + 1);
      B.box(run, 0.24, W, tread, -21.6 - (i + 0.5) * run, yTop + 0.12, -0.9, { tile: 1.1 });
      world.collider(run, 0.24, W, -21.6 - (i + 0.5) * run, yTop + 0.12, -0.9);
    }
    const landY = -rise * 17;
    B.box(1.7, 0.24, 3.6, tread, -26.8, landY + 0.12, 0, { tile: 1.2 });
    world.collider(1.7, 0.24, 3.6, -26.8, landY + 0.12, 0);
    // flight B heads back east at z = +0.9
    for (let i = 0; i < 13; i++) {
      const yTop = landY - rise * (i + 1);
      B.box(run, 0.24, W, tread, -25.9 + (i + 0.5) * run, yTop + 0.12, 0.9, { tile: 1.1 });
      world.collider(run, 0.24, W, -25.9 + (i + 0.5) * run, yTop + 0.12, 0.9);
    }
    // Skirt boards down both flights.  These treads are already thick enough
    // to close their own risers, so they only want a stringer: A climbs east
    // out of the landing, B climbs west into it.
    const flightA = { x: -21.6 - 17 * run, y: 0.24 - 17 * rise, z: -0.9, rotY: Math.PI / 2, steps: 17, rise, run };
    const flightB = { x: -25.9 + 13 * run, y: landY + 0.24 - 13 * rise, z: 0.9, rotY: -Math.PI / 2, steps: 13, rise, run };
    for (const f of [flightA, flightB]) {
      for (const s of [-1, 1]) rakeBoard(B, f, tread, 0.07, 0.3, s * (W / 2 + 0.035), 0);
    }

    // guard the open well from the hall floor (hole x -27.9..-21.6, z ±1.9) —
    // posts on the slab, the flight-A mouth at the east end left open
    railing(world, post, rail, -24.75, 0, -1.95, 6.3, 0, 1.0);
    railing(world, post, rail, -24.75, 0, 1.95, 6.3, 0, 1.0);
    railing(world, post, rail, -27.95, 0, 0, 3.9, Math.PI / 2, 1.0);
    // The mouth is left wide enough that walking straight in through the
    // hall's archway puts you on flight A — the old 1.4 m slot sat off the
    // arch's centreline, so the way down read as walled off.
    railing(world, post, rail, -21.55, 0, 1.125, 1.55, Math.PI / 2, 1.0);  // drop over flight B
    world.spot('basementStairTop', -20.6, 0, -0.9);
    world.spot('basementStairBottom', -22.2, -6.0, 0.9);
    world.stairLinks.push({ a: new THREE.Vector3(-20.8, 0, -0.9), b: new THREE.Vector3(-22.2, -6.0, 0.9), via: new THREE.Vector3(-26.8, -3.4, 0) });
  }

  // Great room void railing
  railing(world, post, rail, -24, 4.2, 2.15, 11.6, 0, 1.05);
}

// ── roof ───────────────────────────────────────────────────────────────────
function buildRoof(world) {
  const M = world.mats, B = world.static;
  const shingle = M.get('shingle');
  const eave = 12.6, ridge = 17.2;
  const halfD = (HOUSE.z1 - HOUSE.z0) / 2 + 1.0;
  const slope = Math.atan2(ridge - eave, halfD);
  const slabLen = Math.hypot(ridge - eave, halfD);
  const len = HOUSE.x1 - HOUSE.x0 + 2.0;

  for (const sgn of [-1, 1]) {
    const cxp = 0;
    const czp = sgn * halfD / 2;
    const cyp = (eave + ridge) / 2;
    B.box(len, 0.3, slabLen, shingle, cxp, cyp, czp, { rotX: sgn * slope, tile: 1.4 });
    world.collider(len, 0.3, slabLen, cxp, cyp, czp, 0);
  }
  // gable ends
  for (const sgn of [-1, 1]) {
    const x = sgn * (HOUSE.x1 + 0.4);
    const shape = new THREE.Shape();
    shape.moveTo(-halfD, 0); shape.lineTo(halfD, 0); shape.lineTo(0, ridge - eave); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false });
    planarUV(geo, 2.2);
    const m = new THREE.Mesh(geo, M.get('stucco'));
    m.rotation.y = Math.PI / 2;
    m.position.set(x, eave, 0);
    m.castShadow = m.receiveShadow = true;
    world.staticRoot.add(m);
  }
  // ridge cap + chimneys — shafts start at y 12.0, above the third-floor
  // ceiling, so they live in the attic and the sky, not in the bedrooms
  B.box(len, 0.24, 0.5, M.get('stone'), 0, ridge + 0.05, 0, { tile: 1 });
  for (const [x, z] of [[-24, 7], [-12, -8], [10, 9]]) {
    B.box(1.7, 4.7, 1.4, M.get('brick'), x, 14.35, z, { tile: 1.2 });
    B.box(2.0, 0.3, 1.7, M.get('stone'), x, 16.8, z, { tile: 1 });
    world.collider(1.7, 4.7, 1.4, x, 14.35, z);
  }
}

// ── garage doors ───────────────────────────────────────────────────────────
// The shell leaves an 8.4 m bay in the north face; the plan promises doors,
// so two sectional leaves slide up under the ceiling rather than swing.
function buildGarageDoors(world) {
  const M = world.mats, B = world.static;
  const matSlat = M.paint(0xd9d5cc, 0.55, 'garageDoor');
  B.box(0.22, 3.0, 0.34, M.get('stone'), 25.5, 1.5, HOUSE.z0, { tile: 1 });   // pier between the bays
  world.collider(0.22, 3.0, 0.34, 25.5, 1.5, HOUSE.z0);

  for (const bx of [23.4, 27.6]) {
    const leafW = 4.06, leafH = 2.96, slats = 6, sh = leafH / slats;
    const g = new THREE.Group();
    g.position.set(bx, 0, HOUSE.z0 + 0.02);
    for (let i = 0; i < slats; i++) {
      g.add(boxMesh(leafW, sh - 0.025, 0.055, matSlat, 0, (i + 0.5) * sh, 0, { tile: 1.1 }));
    }
    g.add(boxMesh(0.5, 0.06, 0.05, M.get('steel'), 0, 0.92, 0.05));           // lift handle
    world.addProp(g);

    const door = { open: false, t: 0 };
    world.onUpdate((dt) => {
      door.t += ((door.open ? 1 : 0) - door.t) * Math.min(1, dt * 2.5);
      g.position.y = door.t * (leafH - 0.12);
    });
    world.addBlocker({
      get active() { return door.t < 0.5; },
      pos: new THREE.Vector3(bx, leafH / 2, HOUSE.z0 + 0.02),
      halfW: leafW / 2, halfH: leafH / 2, halfD: 0.1, rotY: 0,
    });
    world.addInteract({
      pos: new THREE.Vector3(bx, 1.2, HOUSE.z0 + 0.02), radius: 2.8,
      label: () => (door.open ? 'Close the garage door' : 'Open the garage door'),
      onUse: () => { door.open = !door.open; return door.open ? 'creak' : 'latch'; },
      kind: 'garageDoor', data: door,
    });
  }
}

// ── terrace doors ──────────────────────────────────────────────────────────
// The shell leaves two 2.4 m holes in the south face for the family room and
// the sunroom.  Unfilled they show the pool straight through the wall and read
// as black rectangles after dark, so each gets a pair of French doors hinged
// at the outer jambs and swinging out onto the terrace.
function buildTerraceDoors(world) {
  const M = world.mats, B = world.static;
  const frame = M.paint(0xf2ece0, 0.5, 'frenchDoor');
  const matTrim = M.paint(0xf7f4ee, 0.5, 'trim');
  const glassMat = M.get('glass');

  for (const t of TERRACE) {
    // line the reveal, or the stone shell shows its raw cut edge
    for (const sx of [-1, 1]) {
      B.box(0.1, t.h + 0.1, 0.42, matTrim, t.x + sx * (t.w / 2 + 0.05), (t.h + 0.1) / 2, HOUSE.z1, { tile: 1 });
    }
    B.box(t.w + 0.2, 0.1, 0.42, matTrim, t.x, t.h + 0.05, HOUSE.z1, { tile: 1 });

    for (const s of [-1, 1]) {
      const leafW = t.w / 2 - 0.05, leafH = t.h - 0.07, dir = -s;
      const pivot = new THREE.Group();
      pivot.position.set(t.x + s * (t.w / 2 - 0.03), 0, HOUSE.z1 - 0.02);
      const mid = dir * leafW / 2, top = leafH + 0.03;
      const stile = 0.1;
      pivot.add(
        boxMesh(leafW, 0.16, 0.055, frame, mid, 0.11, 0, { tile: 1 }),                      // bottom rail
        boxMesh(leafW, 0.1, 0.055, frame, mid, top - 0.05, 0, { tile: 1 }),                 // top rail
        boxMesh(stile, leafH, 0.055, frame, dir * stile / 2, leafH / 2 + 0.03, 0, { tile: 1 }),
        boxMesh(stile, leafH, 0.055, frame, dir * (leafW - stile / 2), leafH / 2 + 0.03, 0, { tile: 1 }),
        boxMesh(leafW - stile * 2, 0.07, 0.06, frame, mid, 1.05, 0, { tile: 1 }),            // lock rail
        boxMesh(leafW - stile * 2, leafH - 0.28, 0.02, glassMat, mid, leafH / 2 + 0.05, 0, { tile: 1 }),
      );
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8), M.get('gold'));
      handle.position.set(dir * (leafW - 0.14), 1.12, 0.06);
      pivot.add(handle);
      world.addProp(pivot);

      // a south-wall leaf swings out to +Z, which is the sign game.js gives
      // 's' for the hinge on the west jamb and 'n' for the one on the east
      const door = {
        pivot, open: false, t: 0, room: t.room, w: leafW, rotY: 0,
        side: s < 0 ? 's' : 'n',
        center: new THREE.Vector3(t.x + s * (t.w / 4), 1.1, HOUSE.z1 - 0.02),
      };
      world.doors.push(door);
      world.addBlocker({
        get active() { return door.t < 0.35; },
        pos: new THREE.Vector3(t.x + s * (t.w / 4), leafH / 2, HOUSE.z1 - 0.02),
        halfW: leafW / 2, halfH: leafH / 2, halfD: 0.1, rotY: 0,
      });
      world.addInteract({
        pos: door.center, radius: 2.4,
        label: () => (door.open ? 'Close the terrace door' : 'Open the terrace door'),
        onUse: () => { door.open = !door.open; return door.open ? 'creak' : 'latch'; },
        kind: 'door', data: door,
      });
    }
  }
}

// ── foyer showpiece ────────────────────────────────────────────────────────
function buildFoyerFeature(world) {
  const M = world.mats, B = world.static;
  // marble medallion in the entry floor — sized to the clear strip between
  // the front doors (wall inner face z ≈ -12.88) and the grand stair (z -9.4)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.6, 48), M.get('gold'));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.055, -11.2);
  ring.receiveShadow = true;
  world.staticRoot.add(ring);

  // chandelier over the void
  const g = new THREE.Group();
  g.position.set(0, 7.4, -8);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8), M.get('gold'));
  stem.position.y = 0.8; g.add(stem);
  for (let tier = 0; tier < 3; tier++) {
    const r = 1.5 - tier * 0.42, yy = -tier * 0.42;
    const torus = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 8, 40), M.get('gold'));
    torus.rotation.x = Math.PI / 2; torus.position.y = yy; g.add(torus);
    const n = 10 + tier * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 8), M.emissive(0xffe6bb, 3.0));
      b.position.set(Math.cos(a) * r, yy - 0.14, Math.sin(a) * r);
      g.add(b);
    }
  }
  g.traverse((o) => { o.castShadow = false; });
  world.addProp(g);
  world.addLight({ pos: new THREE.Vector3(0, 6.6, -8), color: 0xffdcb0, intensity: 42, decay: 1.8, distance: 34, room: 'Grand Foyer', floor: 'ground' });

  world.spot('frontDoor', 0, 0, -12.0);
  world.spot('foyer', 0, 0, -7.0);

  // front double doors, hinged at the outer edges
  for (const s of [-1, 1]) {
    const leafW = 1.22, leafH = 2.6;
    const pivot = new THREE.Group();
    pivot.position.set(s * 1.28, 0, HOUSE.z0 + 0.02);
    const leaf = boxMesh(leafW, leafH, 0.07, M.get('walnut'), -s * leafW / 2, leafH / 2 + 0.03, 0, { tile: 1.2 });
    const glass = boxMesh(leafW * 0.5, leafH * 0.34, 0.09, M.get('glass'), -s * leafW / 2, leafH * 0.74, 0, { tile: 1 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 8), M.get('gold'));
    handle.position.set(-s * (leafW - 0.16), 1.1, 0.07);
    pivot.add(leaf, glass, handle);
    world.addProp(pivot);
    const door = { pivot, open: false, t: 0, room: 'Grand Foyer', rotY: 0, side: s < 0 ? 'n' : 's', w: leafW };
    world.doors.push(door);
    world.addBlocker({
      get active() { return door.t < 0.35; },
      pos: new THREE.Vector3(s * 0.66, 1.3, HOUSE.z0 + 0.02),
      halfW: leafW / 2, halfH: leafH / 2, halfD: 0.1, rotY: 0,
    });
    world.addInteract({
      pos: new THREE.Vector3(s * 0.66, 1.2, HOUSE.z0 + 0.02), radius: 2.4,
      label: () => (door.open ? 'Close the front door' : 'Open the front door'),
      onUse: () => { door.open = !door.open; return door.open ? 'creak' : 'latch'; },
      kind: 'door', data: door,
    });
  }
}
