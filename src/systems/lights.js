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
    this._slots = [];   // reusable {L, d} records so update() never allocates
  }

  /** night: outdoor lights only matter after dark. */
  update(cameraPos, night, dt = 0.016) {
    const list = this._scored;
    let n = 0;
    for (const L of this.world.lights) {
      if (!L.on) continue;
      if (L.outdoor && !night && !L.pool) continue;
      if (L.night && !night) continue;
      const d = L.pos.distanceToSquared(cameraPos);
      if (d > (L.distance + 12) ** 2) continue;
      let rec = this._slots[n];
      if (!rec) rec = this._slots[n] = { L: null, d: 0 };
      rec.L = L; rec.d = d;
      list[n++] = rec;
    }
    list.length = n;
    list.sort((a, b) => a.d - b.d);

    for (let i = 0; i < this.pool.length; i++) {
      const slot = this.pool[i];
      const p = slot.light;
      const s = i < n ? list[i].L : null;
      if (slot.src !== s) {
        // new fixture in this slot — jump position, fade the brightness in
        slot.src = s;
        if (s) {
          p.position.copy(s.pos);
          p.color.setHex(s.color);
          p.distance = s.distance;
          p.decay = s.decay ?? 2;
          p.intensity = 0;
        }
      }
      slot.target = s ? s.intensity : 0;
      p.intensity = damp(p.intensity, slot.target, 9, dt);
      if (!s && p.intensity < 0.01) p.intensity = 0;
    }
  }
}
