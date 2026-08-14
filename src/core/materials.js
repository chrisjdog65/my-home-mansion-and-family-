// ───────────────────────────────────────────────────────────────────────────
// Material library.  Every named material is built once and shared; `tiled()`
// hands back a cheap variant with different UV repeats (the canvas source is
// shared so the GPU only ever stores one copy of each texture).
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { TextureFactory } from './textures.js';

export class Materials {
  constructor(renderer, envMap) {
    this.tex = new TextureFactory(renderer);
    this.env = envMap || null;
    this.cache = new Map();
    this.all = [];
    this.dimmable = [];        // emissives whose brightness follows the sun
    this._defs = defs(this.tex);
  }

  /** Shared material by name. */
  get(name) {
    if (this.cache.has(name)) return this.cache.get(name);
    const def = this._defs[name];
    if (!def) throw new Error(`unknown material "${name}"`);
    const m = def();
    m.name = name;
    if (this.env && m.envMap === undefined) { /* physical/standard read scene env */ }
    this.cache.set(name, m);
    this.all.push(m);
    return m;
  }

  /** Variant of a textured material with the given UV repeat. */
  tiled(name, u, v = u) {
    const key = `${name}@${u.toFixed(2)}x${v.toFixed(2)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const base = this.get(name);
    const m = base.clone();
    for (const slot of ['map', 'normalMap', 'roughnessMap', 'aoMap', 'metalnessMap', 'emissiveMap']) {
      if (m[slot]) {
        const t = m[slot].clone();
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(u, v);
        t.needsUpdate = true;
        m[slot] = t;
      }
    }
    m.name = key;
    this.cache.set(key, m);
    this.all.push(m);
    return m;
  }

  /** Tiled to a real-world size: `surface('oakFloor', width, depth, 1.6)`. */
  surface(name, w, h, tileMeters = 2) {
    return this.tiled(name, Math.max(0.25, w / tileMeters), Math.max(0.25, h / tileMeters));
  }

  /** Flat-coloured painted variant (walls, trim, cabinets…). */
  paint(hex, roughness = 0.62, name = null) {
    const key = `paint:${hex}:${roughness}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const t = this.tex.get('drywall', { size: 128, strength: 0.7, rough: [0.8, 0.1] });
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex), roughness, metalness: 0,
      map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.25, 0.25),
    });
    m.name = name || key;
    this.cache.set(key, m);
    this.all.push(m);
    return m;
  }

  /** Plain colour, no texture — used for small props where detail is wasted. */
  solid(hex, roughness = 0.6, metalness = 0) {
    const key = `solid:${hex}:${roughness}:${metalness}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness, metalness });
    this.cache.set(key, m); this.all.push(m);
    return m;
  }

  emissive(hex, intensity = 1.4) {
    const key = `emis:${hex}:${intensity}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const m = new THREE.MeshStandardMaterial({
      color: 0x111111, emissive: new THREE.Color(hex), emissiveIntensity: intensity,
      roughness: 0.4, metalness: 0,
    });
    this.cache.set(key, m); this.all.push(m);
    return m;
  }

  /**
   * Emissive that follows the sun: lamp heads, floodlights and headlights
   * shouldn't blaze at noon. SkySystem drives these via `dimmable`.
   */
  emissiveDim(hex, intensity = 1.4) {
    const key = `emisdim:${hex}:${intensity}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const m = new THREE.MeshStandardMaterial({
      color: 0x1b1d20, emissive: new THREE.Color(hex), emissiveIntensity: intensity,
      roughness: 0.4, metalness: 0,
    });
    m.userData.baseEmissive = intensity;
    this.dimmable.push(m);
    this.cache.set(key, m); this.all.push(m);
    return m;
  }

  setQuality(q) {
    // q: 0 low, 1 medium, 2 high — drops normal maps on low-end hardware.
    // Remember each material's authored strength: forcing 1.0 here would turn
    // polished marble and painted walls into lumpy plaster.
    for (const m of this.all) {
      if (!m.normalMap || !m.normalScale) continue;
      if (!m.userData.authoredNormal) m.userData.authoredNormal = m.normalScale.clone();
      if (q === 0) m.normalScale.setScalar(0);
      else m.normalScale.copy(m.userData.authoredNormal);
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
function defs(tex) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const T = (n, opt) => tex.get(n, opt);

  return {
    // ── floors
    // the two floors you spend the most time looking at get a denser source
    oakFloor: () => std({ ...T('oakFloor', { size: 768, strength: 1.6, rough: [0.44, 0.3] }), metalness: 0, roughness: 0.5 }),
    walnutFloor: () => std({ ...T('walnut', { size: 512, strength: 1.4, rough: [0.5, 0.3] }), roughness: 0.58 }),
    marble: () => new THREE.MeshPhysicalMaterial({ ...T('marble', { size: 768, strength: 0.7, rough: [0.2, 0.14] }), metalness: 0, roughness: 0.24, clearcoat: 0.3, clearcoatRoughness: 0.14, normalScale: new THREE.Vector2(0.3, 0.3) }),
    carpet: () => std({ ...T('carpet', { size: 256, strength: 1.6, rough: [0.94, 0.1] }), roughness: 0.95 }),
    theaterCarpet: () => std({ ...T('theaterCarpet', { size: 256, strength: 1.5, rough: [0.95, 0.08] }), roughness: 0.96 }),
    tile: () => new THREE.MeshPhysicalMaterial({ ...T('tile', { size: 256, strength: 1.4, rough: [0.26, 0.22] }), roughness: 0.3, clearcoat: 0.25, clearcoatRoughness: 0.12, normalScale: new THREE.Vector2(0.6, 0.6) }),
    poolTile: () => new THREE.MeshPhysicalMaterial({ ...T('poolTile', { size: 256, strength: 1.3, rough: [0.24, 0.18] }), roughness: 0.28, clearcoat: 0.3, normalScale: new THREE.Vector2(0.6, 0.6) }),
    paver: () => std({ ...T('flagstone', { size: 512, strength: 1.3, rough: [0.62, 0.24] }), metalness: 0, roughness: 0.68, normalScale: new THREE.Vector2(0.7, 0.7) }),
    concrete: () => std({ ...T('concrete', { size: 256, strength: 1.1, rough: [0.82, 0.25] }), roughness: 0.85 }),
    polishedConcrete: () => new THREE.MeshPhysicalMaterial({ ...T('concrete', { size: 256, strength: 0.8, rough: [0.35, 0.2] }), roughness: 0.35, clearcoat: 0.3 }),
    laneWood: () => new THREE.MeshPhysicalMaterial({ ...T('laneWood', { size: 512, strength: 0.5, rough: [0.14, 0.08] }), roughness: 0.16, clearcoat: 0.7, clearcoatRoughness: 0.1, normalScale: new THREE.Vector2(0.4, 0.4) }),
    courtWood: () => new THREE.MeshPhysicalMaterial({ ...T('courtWood', { size: 512, strength: 0.8, rough: [0.24, 0.12] }), roughness: 0.26, clearcoat: 0.5, clearcoatRoughness: 0.12, normalScale: new THREE.Vector2(0.5, 0.5) }),
    asphalt: () => std({ ...T('asphalt', { size: 256, strength: 1.5, rough: [0.9, 0.2] }), roughness: 0.92 }),
    gravel: () => std({ ...T('gravel', { size: 256, strength: 1.9, rough: [0.95, 0.15] }), roughness: 0.96 }),
    grass: () => std({ ...T('grass', { size: 256, strength: 1.4, rough: [0.92, 0.15] }), roughness: 0.94 }),
    rock: () => std({ ...T('mountainRock', { size: 256, strength: 1.7, rough: [0.9, 0.2] }), roughness: 0.92 }),

    // ── walls & structure
    wall: () => std({ ...T('drywall', { size: 256, strength: 0.6, rough: [0.78, 0.12] }), color: 0xf2efe9, roughness: 0.8 }),
    stone: () => std({ ...T('fieldstone', { size: 512, strength: 2.0, rough: [0.86, 0.25] }), color: 0xd6cfc2, roughness: 0.9 }),
    brick: () => std({ ...T('brick', { size: 256, strength: 1.8, rough: [0.88, 0.2] }), roughness: 0.9 }),
    shingle: () => std({ ...T('shingle', { size: 256, strength: 1.6, rough: [0.9, 0.15] }), roughness: 0.92 }),
    stucco: () => std({ ...T('concrete', { size: 256, strength: 1.2, rough: [0.85, 0.15] }), color: 0xe8e1d4, roughness: 0.88 }),

    // ── furniture
    // satin, not lacquered — at roughness 0.44 the grain's normal noise
    // smeared into a "flowing chocolate" highlight across the stair
    walnut: () => std({ ...T('walnut', { size: 512, strength: 0.9, rough: [0.52, 0.18] }), roughness: 0.56, normalScale: new THREE.Vector2(0.6, 0.6) }),
    maple: () => std({ ...T('maple', { size: 512, strength: 1.2, rough: [0.45, 0.25] }), roughness: 0.5 }),
    fabric: () => std({ ...T('fabric', { size: 256, strength: 1.2, rough: [0.9, 0.12] }), roughness: 0.92 }),
    leather: () => std({ ...T('leather', { size: 256, strength: 0.85, rough: [0.5, 0.3] }), roughness: 0.52 }),
    steel: () => std({ ...T('brushedMetal', { size: 256, strength: 0.9, rough: [0.34, 0.18] }), metalness: 1, roughness: 0.4, normalScale: new THREE.Vector2(0.3, 0.3) }),

    chrome: () => std({ color: 0xf2f4f7, metalness: 1, roughness: 0.12 }),
    blackMetal: () => std({ color: 0x1b1d20, metalness: 0.9, roughness: 0.4 }),
    darkPlastic: () => std({ color: 0x24262b, metalness: 0.1, roughness: 0.55 }),
    rubber: () => std({ color: 0x14161a, metalness: 0, roughness: 0.95 }),
    rubberFloor: () => std({ ...T('tile', { size: 256, strength: 0.9, rough: [0.88, 0.1] }), color: 0x2e343b, roughness: 0.9 }),
    gold: () => std({ color: 0xd9b26a, metalness: 1, roughness: 0.22 }),

    // near-clear with a restrained reflection — at 0.24/1.6 every pane read
    // as a glowing milk-white sheet and the yard was invisible from indoors
    glass: () => new THREE.MeshPhysicalMaterial({
      color: 0xd6e4ec, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.13,
      envMapIntensity: 0.7, side: THREE.DoubleSide, depthWrite: false,
    }),
    mirror: () => std({ color: 0xdfe6ee, metalness: 1, roughness: 0.08 }),
    screenOff: () => std({ color: 0x2c3138, metalness: 0.5, roughness: 0.2 }),

    carPaintRed: () => new THREE.MeshPhysicalMaterial({ color: 0xb3121a, metalness: 0.85, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.03 }),
    carPaintYellow: () => new THREE.MeshPhysicalMaterial({ color: 0xf5c518, metalness: 0.7, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.03 }),
    carPaintBlue: () => new THREE.MeshPhysicalMaterial({ color: 0x14314f, metalness: 0.85, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04 }),
    carGlass: () => new THREE.MeshPhysicalMaterial({ color: 0x0d1218, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.55, envMapIntensity: 2 }),

    water: () => new THREE.MeshPhysicalMaterial({
      color: 0x1d6f8f, metalness: 0.1, roughness: 0.06, transparent: true, opacity: 0.82,
      transmission: 0, envMapIntensity: 1.8, clearcoat: 1, clearcoatRoughness: 0.02,
    }),

    foliage: () => std({ color: 0x3d7a41, roughness: 0.88, metalness: 0, side: THREE.DoubleSide }),
    bark: () => std({ ...T('walnut', { size: 256, strength: 3.2, rough: [0.94, 0.1] }), color: 0x6a5340, roughness: 0.95 }),
  };
}
