// ───────────────────────────────────────────────────────────────────────────
// Light manager.  The house declares ~200 light sources; only the handful
// nearest the camera are ever real GPU lights.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';

export class LightManager {
  constructor(scene, world, settings, count = 10) {
    this.world = world;
    this.settings = settings;
    this.pool = [];
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 2);
      l.visible = false;
      scene.add(l);
      this.pool.push(l);
    }
    this.shadowLight = new THREE.PointLight(0xffffff, 0, 12, 2);
    this.shadowLight.castShadow = true;
    this.shadowLight.shadow.mapSize.set(512, 512);
    this.shadowLight.shadow.bias = -0.004;
    this.shadowLight.visible = false;
    scene.add(this.shadowLight);
    this._scored = [];
  }

  /** night: outdoor lights only matter after dark. */
  update(cameraPos, night) {
    const list = this._scored;
    list.length = 0;
    for (const L of this.world.lights) {
      if (!L.on) continue;
      if (L.outdoor && !night && !L.pool) continue;
      if (L.night && !night) continue;
      const d = L.pos.distanceToSquared(cameraPos);
      if (d > (L.distance + 12) ** 2) continue;
      list.push({ L, d });
    }
    list.sort((a, b) => a.d - b.d);

    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      const s = list[i];
      if (!s) { p.visible = false; p.intensity = 0; continue; }
      p.visible = true;
      p.position.copy(s.L.pos);
      p.color.setHex(s.L.color);
      p.intensity = s.L.intensity;
      p.distance = s.L.distance;
      p.decay = s.L.decay ?? 2;
    }
  }
}
