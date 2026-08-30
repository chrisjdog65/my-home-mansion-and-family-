// ───────────────────────────────────────────────────────────────────────────
// Light manager.  The house declares ~200 light sources; only the handful
// nearest the camera are ever real GPU lights. The pool keeps a constant
// visible-light count (unused slots just run at zero intensity): in three the
// visible point-light count is baked into every shader program, so letting it
// fluctuate forces a recompile hitch each time a light crossed the cutoff.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { damp } from '../core/rng.js';

export class LightManager {
  constructor(scene, world, settings, count = 10) {
    this.world = world;
    this.settings = settings;
    this.pool = [];
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 2);
      l.visible = true;
      scene.add(l);
      this.pool.push({ light: l, src: null, target: 0 });
    }
    this._scored = [];
    this._slots = [];   // reusable {L, d, k} records so update() never allocates
    this._frame = 0;
  }

  /** night: outdoor lights only matter after dark. */
  update(cameraPos, night, dt = 0.016) {
    const list = this._scored;
    const frame = ++this._frame;
    // stamp the sitting tenants before scoring so they can be favoured below
    for (const slot of this.pool) if (slot.src) slot.src._lmHeld = frame;

    let n = 0;
    for (const L of this.world.lights) {
      if (!L.on) continue;
      if (L.outdoor && !night && !L.pool) continue;
      if (L.night && !night) continue;
      const d = L.pos.distanceToSquared(cameraPos);
      if (d > (L.distance + 12) ** 2) continue;
      let rec = this._slots[n];
      if (!rec) rec = this._slots[n] = { L: null, d: 0, k: 0 };
      rec.L = L; rec.d = d;
      // A fixture already in the pool scores as if it stood 15% nearer than it
      // does (0.85² in squared distance), so the two either side of the cutoff
      // cannot trade the last slot back and forth as you drift between them.
      rec.k = L._lmHeld === frame ? d * 0.7225 : d;
      list[n++] = rec;
    }
    list.length = n;
    list.sort((a, b) => a.k - b.k);

    // The shortlist is exactly the nearest pool.length — no more. Merely being
    // in range reaches 12 m past a fixture's own falloff and straight through
    // walls, so "still on the list" is not enough to hold a slot: it would let
    // a lamp two rooms away starve the one directly overhead.
    const cap = Math.min(n, this.pool.length);
    for (let i = 0; i < cap; i++) list[i].L._lmKeep = frame;

    // Slots are sticky. Binding slot i to list[i] meant that whenever two
    // fixtures swapped distance order — which happens every time you cross the
    // bisector between two lamps, i.e. constantly while walking a corridor —
    // both slots saw a new source, both reset to zero intensity and both damped
    // back in. The bulbs blinked as you walked past them.
    for (const slot of this.pool) {
      if (slot.src && slot.src._lmKeep !== frame) slot.src = null;
    }
    let free = 0;
    for (let i = 0; i < cap; i++) {
      const L = list[i].L;
      if (L._lmHeld === frame) continue;       // kept the slot it already had
      while (free < this.pool.length && this.pool[free].src) free++;
      if (free >= this.pool.length) break;
      const slot = this.pool[free++];
      slot.src = L;
      slot.light.intensity = 0;                // genuinely new — fade it in
    }

    for (const slot of this.pool) {
      const s = slot.src;
      const p = slot.light;
      if (s) {
        // re-read every frame rather than only on assignment: a fixture that
        // rides a moving prop would otherwise light where it used to be
        p.position.copy(s.pos);
        p.color.setHex(s.color);
        p.distance = s.distance;
        p.decay = s.decay ?? 2;
      }
      slot.target = s ? s.intensity : 0;
      p.intensity = damp(p.intensity, slot.target, 9, dt);
      if (!s && p.intensity < 0.01) p.intensity = 0;
    }
  }
}
