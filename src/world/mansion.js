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

  const floorMat = (name, w, d) => {
    const key = name === 'rubberFloor' ? 'rubber' : name;
    try { return M.get(key); } catch (e) { return M.get('oakFloor'); }
  };

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
    F._cuts = cuts;

    // structural slab (also the collision floor)
    for (const r of rectSubtract({ ...HOUSE }, holes)) {
      B.box(rw(r), 0.4, rd(r), matStruct, cx(r), y - 0.2, cz(r), { tile: 3 });
      world.collider(rw(r), 0.4, rd(r), cx(r), y - 0.2, cz(r));
    }

    // corridor / gallery finish where it isn't a room
    const corridorRects = rectSubtract(
      { x0: HOUSE.x0, x1: HOUSE.x1, z0: F.key === 'basement' ? -1.6 : CORR.z0, z1: F.key === 'basement' ? 1.6 : CORR.z1 },
      holes,
    );
    for (const r of corridorRects) {
      const m = F.key === 'basement' ? M.get('polishedConcrete') : M.get('marble');
      B.box(rw(r), 0.04, rd(r), m, cx(r), y + 0.02, cz(r), { tile: 2 });
      if (F.key !== 'ground' || true) {
        B.box(rw(r), 0.05, rd(r), matCeil, cx(r), y + F.ceil, cz(r), { tile: 2 });
      }
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

      // ceiling (skip where a void continues up)
      const voidAbove = (SLAB_HOLES[nextKey(F.key)] || []).some(
        (h) => h.x0 < R.x1 - 0.2 && h.x1 > R.x0 + 0.2 && h.z0 < R.z1 - 0.2 && h.z1 > R.z0 + 0.2,
      );
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
        const ly = y + (isTall ? F.ceil + 2.6 : F.ceil) - 0.28;
        world.addLight({
          pos: new THREE.Vector3(lx, ly, z),
          color: lightColor(R.type), intensity: lightPower(R.type),
          distance: Math.max(9, Math.min(20, Math.hypot(w, d) * 0.8)),
          room: R.name, floor: F.key,
        });
        // the fixture itself
        addFixture(world, R.type, lx, ly, z);
      }
    }

    // corridor lights
    if (F.key !== 'ground' || true) {
      for (let lx = HOUSE.x0 + 5; lx <= HOUSE.x1 - 5; lx += 9) {
        if (holes.some((h) => lx > h.x0 && lx < h.x1)) continue;
        world.addLight({
          pos: new THREE.Vector3(lx, y + F.ceil - 0.3, 0), color: 0xffdcb4,
          intensity: 16, distance: 13, room: 'Gallery', floor: F.key,
        });
        addFixture(world, 'corridor', lx, y + F.ceil - 0.3, 0);
      }
    }

    buildExteriorShell(world, F, matStone, matStucco, matWall, matGlass, matTrim);
  }

  buildStairs(world);
  buildRoof(world);
  buildFoyerFeature(world);

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
    case 'theater': return 11;
    case 'court': return 46;
    case 'bowling': return 26;
    case 'great': return 34;
    case 'garage': case 'workshop': case 'storage': return 26;
    case 'gaming': return 10;
    default: return 20;
  }
}

// ── fixtures ───────────────────────────────────────────────────────────────
function addFixture(world, type, x, y, z) {
  const M = world.mats, B = world.static;
  if (type === 'court' || type === 'garage' || type === 'workshop' || type === 'storage' || type === 'gym') {
    B.box(2.4, 0.09, 0.34, M.get('steel'), x, y + 0.1, z, { tile: 1 });
    B.box(2.3, 0.06, 0.28, M.emissive(0xf4f8ff, 2.6), x, y + 0.03, z, { tile: 1 });
  } else if (type === 'corridor') {
    B.box(0.3, 0.06, 0.3, M.get('gold'), x, y + 0.16, z, { tile: 1 });
    B.box(0.24, 0.16, 0.24, M.emissive(0xffd9a8, 2.2), x, y + 0.02, z, { tile: 1 });
  } else if (type === 'theater') {
    B.box(0.22, 0.1, 0.22, M.emissive(0xff8a5c, 1.4), x, y, z, { tile: 1 });
  } else {
    B.box(0.55, 0.05, 0.55, M.get('chrome'), x, y + 0.14, z, { tile: 1 });
    B.box(0.46, 0.14, 0.46, M.emissive(0xfff0d8, 2.0), x, y + 0.02, z, { tile: 1 });
  }
}

// ── room walls ─────────────────────────────────────────────────────────────
function buildRoomWalls(world, R, F, wallCol, matTrim, cuts) {
  const B = world.static;
  const y = F.y;
  const h = R.tall ? F.ceil + 4.2 : F.ceil;
  const sides = ['n', 's', 'w', 'e'];

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

    const openings = [];
    for (const c of cuts) {
      if (c.axis !== axis || Math.abs(c.coord - coord) > 0.25) continue;
      if (c.pos < from - 0.05 || c.pos > to + 0.05) continue;
      const world0 = axis === 'z' ? cx(R) : cz(R);
      const local = (axis === 'x' ? -(c.pos - world0) : (c.pos - world0));
      openings.push({ x: local, w: c.w, y0: 0, y1: Math.min(c.h, h - 0.2) });
      // only the room that declared the door hangs the leaf
      if (c.owner === R && !c._placed) {
        c._placed = true;
        registerDoor(world, R, F, side, c.dr, px, pz, rotY, local);
      }
    }

    wallWithOpenings(B, wallCol, px, pz, len, h, WALL_T, openings, rotY, 2.2, y);
    wallColliders(world, px, pz, len, h, WALL_T, openings, rotY, y);

    // baseboard
    B.box(len, 0.13, WALL_T + 0.03, matTrim, px, y + 0.065, pz, { rotY, tile: 1 });
  }
}

function wallColliders(world, px, pz, len, h, t, openings, rotY, baseY) {
  const cuts = openings.map((o) => ({ a: o.x - o.w / 2, b: o.x + o.w / 2, y1: o.y1 })).sort((p, q) => p.a - q.a);
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
    put(a, b, Math.min(c.y1, h), h);
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
  const B = world.static;
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
      const step = 4.4, half = s.len / 2;
      for (let p = -half + step / 2; p < half; p += step) {
        // front door
        if (s.key === 'n' && Math.abs(p) < 4.6 && F.key === 'ground') continue;
        // garage doors
        if (s.key === 'n' && F.key === 'ground' && p > 20 && p < 30) continue;
        if (s.key === 's' && (GLASS_SPANS[F.key] || []).some((g) => p > g.x0 - 2.2 && p < g.x1 + 2.2)) continue;
        openings.push({ x: p, w: 2.1, y0: 0.95, y1: 2.85 });
        glass.push({ x: p, w: 2.1, y0: 0.95, y1: 2.85 });
      }
      if (s.key === 'n' && F.key === 'ground') {
        openings.push({ x: 0, w: 2.6, y0: 0, y1: 2.7 });        // front door
        openings.push({ x: 25.5, w: 8.4, y0: 0, y1: 3.0 });     // garage
      }
      if (s.key === 's' && F.key === 'ground') {
        openings.push({ x: -13.5, w: 2.4, y0: 0, y1: 2.5 });     // family room → terrace
        openings.push({ x: 10.4, w: 2.4, y0: 0, y1: 2.5 });      // sunroom → terrace
      }
      for (const g of GLASS_SPANS[F.key] || []) {
        if (s.key !== 's') continue;
        const c = (g.x0 + g.x1) / 2, w = g.x1 - g.x0;
        openings.push({ x: c, w, y0: 0.12, y1: F.ceil - 0.1 });
        glass.push({ x: c, w, y0: 0.12, y1: F.ceil - 0.1, curtain: true });
      }
    }

    const outPz = s.key === 'n' ? HOUSE.z0 - T_OUT / 2 : s.key === 's' ? HOUSE.z1 + T_OUT / 2 : 0;
    const outPx = s.key === 'w' ? HOUSE.x0 - T_OUT / 2 : s.key === 'e' ? HOUSE.x1 + T_OUT / 2 : 0;
    const inPz = s.key === 'n' ? HOUSE.z0 + T_IN / 2 : s.key === 's' ? HOUSE.z1 - T_IN / 2 : 0;
    const inPx = s.key === 'w' ? HOUSE.x0 + T_IN / 2 : s.key === 'e' ? HOUSE.x1 - T_IN / 2 : 0;

    wallWithOpenings(B, outer, outPx, outPz, s.len, h, T_OUT, openings, s.rotY, 2.6, y);
    wallWithOpenings(B, matWall, inPx, inPz, s.len, h, T_IN, openings, s.rotY, 2.4, y);
    wallColliders(world, (outPx + inPx) / 2, (outPz + inPz) / 2, s.len, h, T_OUT + T_IN + 0.1, openings, s.rotY, y);

    // glazing + frames
    for (const g of glass) {
      const gx = (s.key === 'w' ? HOUSE.x0 : s.key === 'e' ? HOUSE.x1 : 0) + Math.cos(s.rotY) * g.x;
      const gz = (s.key === 'n' ? HOUSE.z0 : s.key === 's' ? HOUSE.z1 : 0) - Math.sin(s.rotY) * g.x;
      const gh = g.y1 - g.y0;
      B.box(g.w - 0.08, gh - 0.08, 0.03, matGlass, gx, y + (g.y0 + g.y1) / 2, gz, { rotY: s.rotY, tile: 1 });
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
function buildStairs(world) {
  const M = world.mats, B = world.static;
  const tread = M.get('walnut'), rail = M.get('gold'), post = M.get('blackMetal');

  // ── Grand stair: one straight run up the middle of the foyer ────────────
  {
    const rise = 4.2 / 24, run = 0.29, W = 2.6, z0 = -9.4;
    for (let i = 0; i < 24; i++) {
      const h = (i + 1) * rise;
      const z = z0 + (i + 0.5) * run;
      B.box(W, h, run, tread, 0, h / 2, z, { tile: 1.2 });
      world.collider(W, h, run, 0, h / 2, z);
    }
    const topZ = z0 + 24 * run;
    // carpet runner
    for (let i = 0; i < 24; i++) {
      B.box(W - 0.9, 0.012, run, M.paint(0x7d2a33, 0.95, 'runner'), 0, (i + 1) * rise + 0.007, z0 + (i + 0.5) * run, { tile: 0.8 });
    }
    for (const s of [-1, 1]) {
      // stringer + banister following the slope
      for (let i = 0; i < 24; i += 2) {
        const h = (i + 1) * rise;
        B.box(0.08, 1.0, 0.08, post, s * (W / 2 - 0.06), h + 0.5, z0 + (i + 0.5) * run, { tile: 0.4 });
      }
      const len = Math.hypot(24 * run, 4.2);
      B.box(0.09, 0.09, len, rail, s * (W / 2 - 0.06), 2.1 + 1.0, (z0 + topZ) / 2, { rotX: -Math.atan2(4.2, 24 * run), tile: 0.5 });
    }
    // upper gallery railings around the void
    railing(B, post, rail, 0, 4.2, -2.5, 12.0, 0, 1.05);
    for (const s of [-1, 1]) railing(B, post, rail, s * 5.9, 4.2, -7.6, 10.4, Math.PI / 2, 1.05);
    world.spot('grandStairBottom', 0, 0, -10.6);
    world.spot('grandStairTop', 0, 4.2, -1.4);
    world.stairLinks = world.stairLinks || [];
    world.stairLinks.push({ a: new THREE.Vector3(0, 0, -10.4), b: new THREE.Vector3(0, 4.2, -1.6) });
  }

  // ── Service stair: second → third, in the south half of the gallery ─────
  {
    const rise = 4.2 / 24, run = 0.29, W = 1.5, zc = 1.1, x0 = 16.2;
    for (let i = 0; i < 24; i++) {
      const h = rise * (i + 1);
      B.box(run, h, W, tread, x0 + (i + 0.5) * run, 4.2 + h / 2, zc, { tile: 1.2 });
      world.collider(run, h, W, x0 + (i + 0.5) * run, 4.2 + h / 2, zc);
    }
    railing(B, post, rail, x0 + 3.5, 4.2, zc - 0.8, 7.2, 0, 1.0);
    railing(B, post, rail, 19.4, 8.4, 0.3, 8.0, 0, 1.05);
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
      world.collider(run, 0.6, W, -21.6 - (i + 0.5) * run, yTop - 0.18, -0.9);
    }
    const landY = -rise * 17;
    B.box(1.7, 0.24, 3.6, tread, -26.8, landY + 0.12, 0, { tile: 1.2 });
    world.collider(1.7, 0.6, 3.6, -26.8, landY - 0.18, 0);
    // flight B heads back east at z = +0.9
    for (let i = 0; i < 13; i++) {
      const yTop = landY - rise * (i + 1);
      B.box(run, 0.24, W, tread, -25.9 + (i + 0.5) * run, yTop + 0.12, 0.9, { tile: 1.1 });
      world.collider(run, 0.6, W, -25.9 + (i + 0.5) * run, yTop - 0.18, 0.9);
    }
    railing(B, post, rail, -24.6, 0, -0.05, 6.2, 0, 1.0);
    world.spot('basementStairTop', -20.6, 0, -0.9);
    world.spot('basementStairBottom', -22.2, -6.0, 0.9);
    world.stairLinks.push({ a: new THREE.Vector3(-20.8, 0, -0.9), b: new THREE.Vector3(-22.2, -6.0, 0.9), via: new THREE.Vector3(-26.8, -3.4, 0) });
  }

  // Great room void railing
  railing(B, post, rail, -24, 4.2, 2.6, 11.6, 0, 1.05);
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
  // ridge cap + chimneys
  B.box(len, 0.24, 0.5, M.get('stone'), 0, ridge + 0.05, 0, { tile: 1 });
  for (const [x, z] of [[-24, 7], [-12, -8], [10, 9]]) {
    B.box(1.7, 6.2, 1.4, M.get('brick'), x, 13.6, z, { tile: 1.2 });
    B.box(2.0, 0.3, 1.7, M.get('stone'), x, 16.8, z, { tile: 1 });
    world.collider(1.7, 6.2, 1.4, x, 13.6, z);
  }
}

// ── foyer showpiece ────────────────────────────────────────────────────────
function buildFoyerFeature(world) {
  const M = world.mats, B = world.static;
  // marble medallion in the entry floor
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.4, 48), M.get('gold'));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.055, -8);
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
  world.addLight({ pos: new THREE.Vector3(0, 6.6, -8), color: 0xffdcb0, intensity: 70, distance: 30, room: 'Grand Foyer', floor: 'ground' });

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
