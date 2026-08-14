// ───────────────────────────────────────────────────────────────────────────
// Navigation graph.  Corridor spines per floor, a node in every room, and the
// stairs stitched between levels.  Dijkstra gives the family their routes.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { HOUSE, CORR, FLOORS } from './plan.js';

export function buildNav(world) {
  const spine = {};        // floorKey → ordered corridor node list

  for (const F of FLOORS) {
    const zc = 0;
    const list = [];
    for (let x = HOUSE.x0 + 3; x <= HOUSE.x1 - 3; x += 4) {
      // skip corridor positions that fall in a stairwell
      if (F.key === 'ground' && x > -28.6 && x < -20.8) continue;
      if (F.key === 'third' && x > 15.0 && x < 23.8) {
        list.push(world.navNode(`c_${F.key}_${x}`, x, F.y, -1.4, ['corridor', F.key]));
        continue;
      }
      list.push(world.navNode(`c_${F.key}_${x}`, x, F.y, zc, ['corridor', F.key]));
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

  // rooms
  for (const R of world.rooms) {
    if (!R.floor || !spine[R.floor]) continue;
    if (R.type === 'shed') continue;
    const doorZ = R.z < 0 ? R.z + R.d / 2 - 0.6 : R.z - R.d / 2 + 0.6;
    const door = world.navNode(`d_${R.name}`, R.x, R.y, doorZ, ['door']);
    const centre = world.navNode(`r_${R.name}`, R.x, R.y, R.z, ['room', R.type]);
    centre.room = R;
    R.navNode = centre;
    world.navLink(door, centre);
    world.navLink(door, nearestSpine(R.floor, R.x));
  }

  // stairs
  for (const L of world.stairLinks) {
    const a = world.navNode(`s_a_${L.a.x.toFixed(0)}_${L.a.y}`, L.a.x, L.a.y, L.a.z, ['stair']);
    const b = world.navNode(`s_b_${L.b.x.toFixed(0)}_${L.b.y}`, L.b.x, L.b.y, L.b.z, ['stair']);
    if (L.via) {
      const v = world.navNode(`s_v_${L.a.x.toFixed(0)}`, L.via.x, L.via.y, L.via.z, ['stair']);
      world.navLink(a, v); world.navLink(v, b);
    } else {
      world.navLink(a, b);
    }
    const fa = floorKeyFor(L.a.y), fb = floorKeyFor(L.b.y);
    world.navLink(a, nearestSpine(fa, L.a.x));
    world.navLink(b, nearestSpine(fb, L.b.x));
  }

  // outdoors: front door, terrace, yard
  const outside = [
    ['out_porch', 0, 0.2, -15.0],
    ['out_drive', 6, 0, -22],
    ['out_terraceW', -22, 0, 20],
    ['out_terraceE', 8, 0, 20],
    ['out_pool', -10, 0, 22],
    ['out_lawn', 0, 0, 36],
    ['out_pond', -20, 0, 38],
    ['out_picnic', 22, 0, 37],
    ['out_skate', 20, 0, 55],
    ['out_shed', -38, 0, 22],
    ['out_backdoorW', -13.5, 0, 14.4],
    ['out_backdoorE', 10.4, 0, 14.4],
  ];
  const nodes = {};
  for (const [n, x, y, z] of outside) nodes[n] = world.navNode(n, x, y, z, ['outside']);
  const link = (a, b) => world.navLink(nodes[a], nodes[b]);
  link('out_porch', 'out_drive');
  link('out_terraceW', 'out_terraceE');
  link('out_terraceW', 'out_pool');
  link('out_terraceE', 'out_lawn');
  link('out_lawn', 'out_pond');
  link('out_lawn', 'out_picnic');
  link('out_picnic', 'out_skate');
  link('out_terraceW', 'out_shed');
  // front door ties to the foyer
  const foyer = world.nav.nodes.find((n) => n.name === 'r_Grand Foyer');
  if (foyer) world.navLink(nodes.out_porch, foyer);
  // the back doors, so the family walks through the openings rather than walls
  link('out_backdoorW', 'out_terraceW');
  link('out_backdoorE', 'out_terraceE');
  const family = world.nav.nodes.find((n) => n.name === 'r_Family Room');
  if (family) world.navLink(nodes.out_backdoorW, family);
  const sun = world.nav.nodes.find((n) => n.name === 'r_Breakfast Sunroom');
  if (sun) world.navLink(nodes.out_backdoorE, sun);

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

/** Dijkstra over the graph; returns an array of Vector3 waypoints. */
export function findPath(world, from, to) {
  const start = nearestNode(world, from);
  const goal = nearestNode(world, to);
  if (!start || !goal) return [to.clone()];
  if (start === goal) return [to.clone()];

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
  return path;
}
