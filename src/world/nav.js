// ───────────────────────────────────────────────────────────────────────────
// Navigation graph.
//
// Corridor spines per floor, a node in every room, a pair of nodes in every
// doorway (one each side, so a route enters an opening square-on instead of
// clipping the jamb), the stairs stitched between levels with an approach node
// at each mouth, and a hand-linked outdoor graph that keeps the family off the
// water.  Dijkstra gives the route; a string-pull and a corner round-off
// against the collision octree turn it into something walkable.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { HOUSE, CORR, FLOORS, SLAB_HOLES } from './plan.js';

const _ray = new THREE.Ray();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

const JAMB = 0.72;          // how far either side of a wall a door node sits
const BODY = 0.34;          // shoulder half-width used by the clearance tests
const EYES = [0.45, 1.25];  // heights the clearance rays are cast at

export function buildNav(world) {
  const spine = {};        // floorKey → ordered corridor node list

  for (const F of FLOORS) {
    const list = [];
    for (let x = HOUSE.x0 + 3; x <= HOUSE.x1 - 3; x += 4) {
      // skip corridor positions that fall in a stairwell
      if (F.key === 'ground' && x > -28.6 && x < -20.8) continue;
      // the third-floor service stair eats the middle of the gallery
      const z = F.key === 'third' && x > 15.0 && x < 23.8 ? -1.4 : 0;
      list.push(world.navNode(`c_${F.key}_${x}`, x, F.y, z, ['corridor', F.key]));
    }
    for (let i = 1; i < list.length; i++) world.navLink(list[i - 1], list[i]);
    spine[F.key] = list;
  }

  const nearestSpine = (floorKey, x) => {
    const list = spine[floorKey] || [];
    let best = null, bd = Infinity;
    for (const n of list) {
      const d = Math.abs(n.pos.x - x);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  };

  const corridorHalf = (floorKey) => (floorKey === 'basement' ? 1.6 : CORR.z1);
  const inCorridor = (floorKey, z) => Math.abs(z) <= corridorHalf(floorKey) + 0.35;

  /** True where the slab has been cut away — a node there hangs over a void. */
  const inHole = (floorKey, x, z, pad = 0.25) => {
    for (const h of SLAB_HOLES[floorKey] || []) {
      if (x > h.x0 - pad && x < h.x1 + pad && z > h.z0 - pad && z < h.z1 + pad) return true;
    }
    return false;
  };

  /** Slide a point along a wall until it is off the void, or give up. */
  const slideOut = (floorKey, x, z, alongX) => {
    if (!inHole(floorKey, x, z)) return [x, z];
    for (let d = 0.4; d <= 2.4; d += 0.4) {
      for (const s of [-1, 1]) {
        const nx = alongX ? x + s * d : x;
        const nz = alongX ? z : z + s * d;
        if (!inHole(floorKey, nx, nz)) return [nx, nz];
      }
    }
    return null;
  };

  const roomAtXZ = (floorKey, x, z) => {
    let best = null, bestArea = Infinity;
    for (const r of world.rooms) {
      if (r.floor !== floorKey || r.type === 'corridor' || !r.navNode) continue;
      if (Math.abs(x - r.x) > r.w / 2 || Math.abs(z - r.z) > r.d / 2) continue;
      const a = r.w * r.d;
      if (a < bestArea) { bestArea = a; best = r; }
    }
    return best;
  };

  // ── rooms ────────────────────────────────────────────────────────────────
  // Pass one drops a node in every room, so pass two can wire doorways
  // straight into whatever room is on the other side of them.
  const rooms = [];
  for (const R of world.rooms) {
    // A detached building's rooms must never be wired to the mansion's own
    // gallery spine: the guest house is forty metres away through two
    // exterior walls, and the family would path straight through them. Such
    // buildings carry their own nodes and links. This tests the room's
    // position rather than trusting a flag, so a new outbuilding cannot join
    // the spine by forgetting to set one.
    const detached = R.detached || R.type === 'shed'
      || R.x < HOUSE.x0 || R.x > HOUSE.x1 || R.z < HOUSE.z0 || R.z > HOUSE.z1;
    if (!R.floor || !spine[R.floor] || detached) continue;
    if (R.type === 'corridor') {
      // the galleries *are* the spine; one node on it is enough
      const n = world.navNode(`r_${R.name}`, 0, R.y, 0, ['room', 'corridor']);
      n.room = R;
      R.navNode = n;
      world.navLink(n, nearestSpine(R.floor, 0));
      continue;
    }
    // A room's middle is not always somewhere you can stand: the kitchen's is
    // the island, the theatre's is the third tier of seating and the bowling
    // alley's is halfway down a lane.
    let cx = R.x, cz = R.z;
    if (R.type === 'kitchen') { cx = R.x + 3; cz = R.z + 1.5; }
    else if (R.type === 'theater') { cx = R.x + 6; cz = R.z + R.d / 2 - 1.1; }
    else if (R.type === 'bowling' && world.spots.bowlingAlley) {
      cx = world.spots.bowlingAlley.pos.x;
      cz = world.spots.bowlingAlley.pos.z;
    }
    if (inHole(R.floor, cx, cz)) {
      // a stairwell has eaten the middle of the room: back off towards the
      // solid end rather than parking the family over the well
      const dir = R.z < 0 ? -1 : 1;
      for (let i = 0; i < 8 && inHole(R.floor, cx, cz); i++) cz += dir * 0.8;
    }
    const centre = world.navNode(`r_${R.name}`, cx, R.y, cz, ['room', R.type]);
    centre.room = R;
    R.navNode = centre;
    rooms.push({ R, centre });
  }

  // ── doorways ─────────────────────────────────────────────────────────────
  for (const { R, centre } of rooms) {
    const doors = R.def?.doors || [];
    let linked = false;

    for (const dr of doors) {
      const side = dr.side;
      let ix, iz, ox, oz, alongX;
      if (side === 'n' || side === 's') {
        const wallZ = side === 'n' ? R.z - R.d / 2 : R.z + R.d / 2;
        const sgn = side === 'n' ? -1 : 1;
        ix = ox = R.x + (dr.at || 0);
        iz = wallZ - sgn * JAMB;
        oz = wallZ + sgn * JAMB;
        alongX = true;
      } else {
        const wallX = side === 'w' ? R.x - R.w / 2 : R.x + R.w / 2;
        const sgn = side === 'w' ? -1 : 1;
        iz = oz = R.z + (dr.at || 0);
        ix = wallX - sgn * JAMB;
        ox = wallX + sgn * JAMB;
        alongX = false;
      }

      const inside = slideOut(R.floor, ix, iz, alongX);
      const outside = slideOut(R.floor, ox, oz, alongX);
      if (!inside || !outside) continue;

      // Is there anywhere to go on the far side?  A door that opens onto the
      // gallery counts whichever wall it is in — the stair hall's only opening
      // is on its east side, and without this it is an island.
      const far = roomAtXZ(R.floor, outside[0], outside[1]);
      const toCorridor = inCorridor(R.floor, outside[1]) && Math.abs(outside[0]) < HOUSE.x1;
      // anything else is an exterior door; the outdoor graph wires those by hand
      if (!far && !toCorridor) continue;

      const dIn = world.navNode(`d_${R.name}_${side}`, inside[0], R.y, inside[1], ['door']);
      const dOut = world.navNode(`t_${R.name}_${side}`, outside[0], R.y, outside[1], ['door']);
      world.navLink(centre, dIn);
      world.navLink(dIn, dOut);
      if (far) world.navLink(dOut, far.navNode);
      if (toCorridor) world.navLink(dOut, nearestSpine(R.floor, outside[0]));
      linked = true;
    }

    // Rooms whose plan has no usable door (or whose only opening is buried in
    // a stairwell) still need to be reachable — hang them off the gallery.
    if (!linked) {
      const z = R.z < 0 ? R.z + R.d / 2 - JAMB : R.z - R.d / 2 + JAMB;
      const p = slideOut(R.floor, R.x, z, true);
      if (p) {
        const n = world.navNode(`d_${R.name}_fallback`, p[0], R.y, p[1], ['door']);
        world.navLink(centre, n);
        world.navLink(n, nearestSpine(R.floor, p[0]));
      } else {
        world.navLink(centre, nearestSpine(R.floor, R.x));
      }
    }
  }

  // ── stairs ───────────────────────────────────────────────────────────────
  for (const L of world.stairLinks) {
    const a = world.navNode(`s_a_${L.a.x.toFixed(0)}_${L.a.y}`, L.a.x, L.a.y, L.a.z, ['stair']);
    const b = world.navNode(`s_b_${L.b.x.toFixed(0)}_${L.b.y}`, L.b.x, L.b.y, L.b.z, ['stair']);
    const mid = L.via || null;
    if (mid) {
      const v = world.navNode(`s_v_${L.a.x.toFixed(0)}`, mid.x, mid.y, mid.z, ['stair']);
      world.navLink(a, v); world.navLink(v, b);
    } else {
      world.navLink(a, b);
    }
    // An approach node a stride back from each mouth: without it the route
    // arrives at the treads diagonally and walks through the newel post.
    const fa = floorKeyFor(L.a.y), fb = floorKeyFor(L.b.y);
    const towardA = _a.set(L.a.x - (mid || L.b).x, 0, L.a.z - (mid || L.b).z);
    if (towardA.lengthSq() < 1e-4) towardA.set(0, 0, 1);
    towardA.normalize().multiplyScalar(1.3);
    const towardB = _b.set(L.b.x - (mid || L.a).x, 0, L.b.z - (mid || L.a).z);
    if (towardB.lengthSq() < 1e-4) towardB.set(0, 0, -1);
    towardB.normalize().multiplyScalar(1.3);

    const apA = world.navNode(`s_ap_a_${L.a.x.toFixed(0)}_${L.a.y}`,
      L.a.x + towardA.x, L.a.y, L.a.z + towardA.z, ['stair']);
    const apB = world.navNode(`s_ap_b_${L.b.x.toFixed(0)}_${L.b.y}`,
      L.b.x + towardB.x, L.b.y, L.b.z + towardB.z, ['stair']);
    world.navLink(a, apA);
    world.navLink(b, apB);
    world.navLink(apA, nearestSpine(fa, apA.pos.x));
    world.navLink(apB, nearestSpine(fb, apB.pos.x));
  }

  // ── outdoors ─────────────────────────────────────────────────────────────
  // Fixed positions are fallbacks; where the landscape published a spot we use
  // it, so these nodes sit on the actual terrain height.
  const spot = (name, x, y, z) => {
    const s = world.spots[name];
    return s ? [s.pos.x, s.pos.y, s.pos.z] : [x, y, z];
  };
  const outside = {
    out_porch: spot('frontPorch', 0, 0.2, -15.0),
    out_drive: spot('driveway', 6, 0, -22),
    out_backdoorW: [-13.5, 0, 14.4],
    out_backdoorE: [10.4, 0, 14.4],
    out_terraceMid: [0, 0, 16.2],
    out_terraceW: spot('terrace', -22, 0, 18.5),
    out_terraceE: [18, 0, 17.5],
    out_pool: [-9.5, 0, 17.2],
    out_poollounge: [-11.5, 0, 23],
    out_poolsteps: spot('poolEdge', -4, 0, 17.3),
    // in the shallow end: the swim pose floats the body up to the surface
    out_poolwater: [-4, -0.55, 20.6],
    out_hottub: spot('hotTub', 13.5, 0, 18.8),
    out_shed: spot('shed', -38, 0, 22),
    out_lawnW: [-20, 0, 30],
    out_lawnE: [18, 0, 30],
    out_lawn: [0, 0, 36],
    out_pond: spot('pond', -20, 0, 38),
    out_waterfall: spot('waterfall', -22, 0, 52),
    out_picnic: spot('picnic', 22, 0, 37),
    out_firepit: spot('firePit', 22, 0, 45),
    out_skate: spot('skatepark', 20, 0, 55),
    out_bowl: spot('skateBowl', 20, 0, 60),
    // out to the guest house, by way of the apron's north-east corner: the
    // direct chord from out_drive skims the lamp post at (13.5, -22) and the
    // string-pull's line test keeps failing on it
    out_apronNE: [25, 0, -25],
    out_guestdrive: [24, 0, -31],
    out_guestcourt: [35, 0, -20],
  };
  const nodes = {};
  for (const n in outside) {
    const [x, y, z] = outside[n];
    nodes[n] = world.navNode(n, x, y, z, ['outside']);
  }
  const link = (a, b) => world.navLink(nodes[a], nodes[b]);
  // front
  link('out_porch', 'out_drive');
  // back doors onto the terrace
  link('out_backdoorW', 'out_terraceMid');
  link('out_backdoorW', 'out_pool');
  link('out_backdoorW', 'out_terraceW');
  link('out_backdoorE', 'out_terraceMid');
  link('out_backdoorE', 'out_hottub');
  // terrace: everything routes north of the pool rather than over it
  link('out_terraceMid', 'out_pool');
  link('out_terraceMid', 'out_poolsteps');
  link('out_terraceMid', 'out_terraceE');
  link('out_pool', 'out_terraceW');
  link('out_pool', 'out_poollounge');
  link('out_pool', 'out_poolsteps');
  link('out_poolsteps', 'out_poolwater');
  link('out_terraceE', 'out_hottub');
  link('out_terraceE', 'out_lawnE');
  link('out_terraceW', 'out_shed');
  link('out_terraceW', 'out_lawnW');
  // yard
  link('out_lawnW', 'out_pond');
  link('out_lawnW', 'out_lawn');
  link('out_lawnE', 'out_lawn');
  link('out_lawnE', 'out_picnic');
  link('out_lawn', 'out_pond');
  link('out_lawn', 'out_picnic');
  link('out_pond', 'out_waterfall');
  link('out_picnic', 'out_firepit');
  link('out_picnic', 'out_skate');
  link('out_skate', 'out_bowl');
  // the guest house sits off the north-east corner; its forecourt runs into
  // the parking apron, so the walk out to it starts at the drive
  link('out_drive', 'out_apronNE');
  link('out_apronNE', 'out_guestdrive');
  link('out_guestdrive', 'out_guestcourt');
  const byName = (n) => world.nav.nodes.find((x) => x.name === n);
  const ghFront = byName('gh_front');
  if (ghFront) world.navLink(nodes.out_guestcourt, ghFront);
  const ghGarage = byName('gh_garage');
  if (ghGarage) world.navLink(nodes.out_guestdrive, ghGarage);

  // front door ties to the foyer, back doors to the rooms they open from
  const room = (name) => world.rooms.find((r) => r.name === name)?.navNode;
  const foyer = room('Grand Foyer');
  if (foyer) world.navLink(nodes.out_porch, foyer);
  const family = room('Family Room');
  if (family) world.navLink(nodes.out_backdoorW, family);
  const great = room('Great Room');
  if (great) world.navLink(nodes.out_backdoorW, great);
  const sun = room('Breakfast Sunroom');
  if (sun) world.navLink(nodes.out_backdoorE, sun);
  const garage = room('Garage');
  if (garage) world.navLink(nodes.out_drive, garage);

  world.navIndex = new Map(world.nav.nodes.map((n) => [n.name, n]));
  return world.nav;
}

function floorKeyFor(y) {
  let best = FLOORS[0];
  for (const F of FLOORS) if (Math.abs(F.y - y) < Math.abs(best.y - y)) best = F;
  return best.key;
}

/** Nearest graph node to a world position (same-floor preferred). */
export function nearestNode(world, pos) {
  let best = null, bd = Infinity;
  for (const n of world.nav.nodes) {
    const dy = Math.abs(n.pos.y - pos.y);
    const d = n.pos.distanceToSquared(pos) + dy * dy * 40;
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

/**
 * Can a body of BODY width walk straight from a to b?  Three parallel rays at
 * two heights: one down the middle would happily thread a doorway diagonally
 * and drag the family's shoulders through the jamb.
 */
export function clearLine(world, a, b) {
  if (!world.octree) return false;
  if (Math.abs(a.y - b.y) > 0.45) return false;            // never smooth across floors
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.05) return true;
  const ux = dx / len, uz = dz / len;
  const nx = -uz, nz = ux;
  for (const off of [-BODY, 0, BODY]) {
    for (const h of EYES) {
      _ray.origin.set(a.x + nx * off, a.y + h, a.z + nz * off);
      _ray.direction.set(ux, 0, uz);
      const hit = world.octree.rayIntersect(_ray);
      if (hit && hit.distance < len - 0.05) return false;
    }
  }
  return true;
}

/** Drop waypoints the walker can see past, then ease the remaining corners. */
function smooth(world, pts) {
  if (pts.length < 3) return pts;
  const pulled = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    for (; j > i + 1; j--) if (clearLine(world, pts[i], pts[j])) break;
    pulled.push(pts[j]);
    i = j;
  }
  if (pulled.length < 3) return pulled;
  // one Chaikin pass: cut each corner in half where the shortcut is clear, so
  // they lean into turns instead of pivoting on the spot
  const out = [pulled[0]];
  for (let k = 1; k < pulled.length - 1; k++) {
    const a = pulled[k - 1], b = pulled[k], c = pulled[k + 1];
    const p = b.clone().lerp(a, 0.3);
    const q = b.clone().lerp(c, 0.3);
    if (clearLine(world, p, q)) out.push(p, q);
    else out.push(b);
  }
  out.push(pulled[pulled.length - 1]);
  return out;
}

/** Dijkstra over the graph; returns an array of Vector3 waypoints. */
export function findPath(world, from, to) {
  const start = nearestNode(world, from);
  const goal = nearestNode(world, to);
  if (!start || !goal) return [to.clone()];
  if (start === goal) return smooth(world, [from.clone(), to.clone()]).slice(1);

  const dist = new Map([[start.i, 0]]);
  const prev = new Map();
  const seen = new Set();
  const queue = [start.i];

  while (queue.length) {
    // small graph — linear scan is fine
    let bi = 0;
    for (let i = 1; i < queue.length; i++) if (dist.get(queue[i]) < dist.get(queue[bi])) bi = i;
    const cur = queue.splice(bi, 1)[0];
    if (seen.has(cur)) continue;
    seen.add(cur);
    if (cur === goal.i) break;
    for (const nb of world.nav.edges.get(cur) || []) {
      if (seen.has(nb)) continue;
      const w = world.nav.nodes[cur].pos.distanceTo(world.nav.nodes[nb].pos);
      const nd = dist.get(cur) + w;
      if (nd < (dist.get(nb) ?? Infinity)) {
        dist.set(nb, nd);
        prev.set(nb, cur);
        queue.push(nb);
      }
    }
  }

  if (!prev.has(goal.i) && start.i !== goal.i) return [to.clone()];
  const path = [];
  let cur = goal.i;
  while (cur !== undefined && cur !== start.i) {
    path.unshift(world.nav.nodes[cur].pos.clone());
    cur = prev.get(cur);
  }
  path.push(to.clone());
  // smooth from where they actually stand, then drop that first point again —
  // it is the walker's own feet, not a waypoint
  return smooth(world, [from.clone(), ...path]).slice(1);
}
