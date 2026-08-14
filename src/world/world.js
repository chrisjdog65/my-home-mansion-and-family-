// ───────────────────────────────────────────────────────────────────────────
// The World is the registry every builder writes into: static geometry
// batches, collision geometry, room volumes, lights, interactables, nav nodes
// and dynamic props.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { Batcher } from './build.js';

export class World {
  constructor(scene, mats) {
    this.scene = scene;
    this.mats = mats;

    this.static = new Batcher('static');
    this.collide = new Batcher('collide');
    this.staticRoot = new THREE.Group(); this.staticRoot.name = 'architecture';
    this.propRoot = new THREE.Group(); this.propRoot.name = 'props';
    this.colliderRoot = new THREE.Group(); this.colliderRoot.name = 'colliders';
    this.colliderRoot.visible = false;
    scene.add(this.staticRoot, this.propRoot, this.colliderRoot);

    this.colliderMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true });

    this.rooms = [];             // { name, floor, x, z, w, d, y, type, tags }
    this.lights = [];            // { pos, color, intensity, distance, on, roomId }
    this.interactables = [];     // { mesh|pos, radius, label, onUse, ... }
    this.blockers = [];          // dynamic OBB colliders (doors, vehicles)
    this.doors = [];
    this.updaters = [];          // per-frame callbacks
    this.nav = { nodes: [], edges: new Map() };
    this.stairLinks = [];
    this.waterVolumes = [];      // { min:Vector3, max:Vector3, surfaceY }
    this.screens = [];
    this.propSpawns = [];        // dynamic props, created once the world is built
    this.vehicles = [];
    this.hoops = [];
    this.spots = {};             // named points of interest for NPCs & objectives

    this.octree = new Octree();
  }

  // ── registration helpers ────────────────────────────────────────────────
  addRoom(def) {
    def.id = this.rooms.length;
    def.center = new THREE.Vector3(def.x, def.y + 1.2, def.z);
    this.rooms.push(def);
    return def;
  }

  roomAt(pos) {
    let best = null, bestArea = Infinity;
    for (const r of this.rooms) {
      if (pos.y < r.y - 1.6 || pos.y > r.y + (r.h || 4.0)) continue;
      if (Math.abs(pos.x - r.x) > r.w / 2 || Math.abs(pos.z - r.z) > r.d / 2) continue;
      const a = r.w * r.d;
      if (a < bestArea) { bestArea = a; best = r; }
    }
    return best;
  }

  /** Registers a box collider (rotated about Y) for the static octree. */
  collider(w, h, d, x, y, z, rotY = 0) {
    this.collide.box(w, h, d, this.colliderMat, x, y, z, { rotY });
    return this;
  }

  addLight(def) {
    const l = Object.assign({
      color: 0xffd9ac, intensity: 1.0, distance: 9, on: true,
      decay: 2, castShadow: false, group: null,
    }, def);
    l.id = this.lights.length;
    this.lights.push(l);
    return l;
  }

  addInteract(def) {
    const i = Object.assign({ radius: 2.6, label: 'Use', prompt: null, once: false, used: false }, def);
    i.id = this.interactables.length;
    this.interactables.push(i);
    return i;
  }

  addBlocker(obj) { this.blockers.push(obj); return obj; }
  onUpdate(fn) { this.updaters.push(fn); return fn; }

  addProp(obj) { this.propRoot.add(obj); return obj; }

  /** Named point used by NPC schedules & objectives. */
  spot(name, x, y, z, extra = {}) {
    this.spots[name] = Object.assign({ name, pos: new THREE.Vector3(x, y, z) }, extra);
    return this.spots[name];
  }

  navNode(name, x, y, z, tags = []) {
    const n = { name, pos: new THREE.Vector3(x, y, z), tags, i: this.nav.nodes.length };
    this.nav.nodes.push(n);
    this.nav.edges.set(n.i, []);
    return n;
  }
  navLink(a, b) {
    if (!a || !b) return;
    this.nav.edges.get(a.i).push(b.i);
    this.nav.edges.get(b.i).push(a.i);
  }

  water(min, max, surfaceY, name = 'water') {
    const v = { min, max, surfaceY, name };
    this.waterVolumes.push(v);
    return v;
  }
  inWater(p) {
    for (const v of this.waterVolumes) {
      if (p.x > v.min.x && p.x < v.max.x && p.z > v.min.z && p.z < v.max.z &&
          p.y > v.min.y && p.y < v.surfaceY) return v;
    }
    return null;
  }

  // ── finalise ────────────────────────────────────────────────────────────
  build() {
    this.static.flush(this.staticRoot);
    this.collide.flush(this.colliderRoot);
    this.rebuildOctree();
  }

  rebuildOctree() {
    this.octree = new Octree();
    this.octree.fromGraphNode(this.colliderRoot);
  }
}
