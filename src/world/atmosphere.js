// ───────────────────────────────────────────────────────────────────────────
// Atmosphere extras the Preetham sky can't provide: a star field and a moon
// for the night, and a drifting cloud layer for the day. All procedural,
// driven by SkySystem so they follow the sun.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { makeRng } from '../core/rng.js';

function softBlobCanvas(rng, blobs, size = 256) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  for (let i = 0; i < blobs; i++) {
    const x = size * (0.18 + rng() * 0.64), y = size * (0.3 + rng() * 0.4);
    const r = size * (0.10 + rng() * 0.16);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.24 + rng() * 0.2})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return c;
}

function moonCanvas() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.48);
  g.addColorStop(0, 'rgba(236,240,248,1)');
  g.addColorStop(0.72, 'rgba(214,222,236,0.96)');
  g.addColorStop(0.88, 'rgba(190,202,222,0.5)');
  g.addColorStop(1, 'rgba(180,195,220,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // maria — the grey blotches that make it read as the moon, not a lamp
  const rng = makeRng(51);
  ctx.fillStyle = 'rgba(150,160,180,0.32)';
  for (let i = 0; i < 7; i++) {
    const a = rng() * Math.PI * 2, r = rng() * S * 0.24;
    ctx.beginPath();
    ctx.ellipse(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r,
      S * (0.05 + rng() * 0.08), S * (0.04 + rng() * 0.06), rng() * 3, 0, 7);
    ctx.fill();
  }
  return c;
}

export class Atmosphere {
  constructor(scene) {
    const rng = makeRng(4242);

    // ── stars ───────────────────────────────────────────────────────────
    const N = 1100, R = 1900;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // upper hemisphere only, thinning towards the horizon
      const y = 0.06 + Math.pow(rng(), 0.7) * 0.94;
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      pos[i * 3] = Math.cos(a) * r * R;
      pos[i * 3 + 1] = y * R;
      pos[i * 3 + 2] = Math.sin(a) * r * R;
      const mag = 0.35 + Math.pow(rng(), 2.2) * 0.65;      // few bright, many dim
      const warm = rng();
      col[i * 3] = mag * (warm > 0.8 ? 1.0 : 0.82);
      col[i * 3 + 1] = mag * 0.88;
      col[i * 3 + 2] = mag * (warm > 0.8 ? 0.78 : 1.0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({
      size: 2.6, sizeAttenuation: false, vertexColors: true,
      transparent: true, opacity: 0, depthWrite: false, fog: false,
    }));
    this.stars.name = 'stars';
    this.stars.renderOrder = -1;
    scene.add(this.stars);

    // ── moon ────────────────────────────────────────────────────────────
    const moonTex = new THREE.CanvasTexture(moonCanvas());
    moonTex.colorSpace = THREE.SRGBColorSpace;
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonTex, transparent: true, opacity: 0, depthWrite: false, fog: false,
    }));
    this.moon.scale.setScalar(130);
    this.moon.name = 'moonDisc';
    scene.add(this.moon);

    // ── clouds ──────────────────────────────────────────────────────────
    this.clouds = [];
    this.cloudMats = [];
    const variants = [];
    for (let v = 0; v < 3; v++) {
      const tex = new THREE.CanvasTexture(softBlobCanvas(rng, 9 + v * 3));
      tex.colorSpace = THREE.SRGBColorSpace;
      variants.push(tex);
    }
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: variants[i % 3], transparent: true, opacity: 0.5,
        depthWrite: false, fog: false, side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rng() * Math.PI * 2;
      const s = 260 + rng() * 460;
      m.scale.set(s, s * (0.55 + rng() * 0.4), 1);
      m.position.set((rng() - 0.5) * 2600, 300 + rng() * 160, (rng() - 0.5) * 2600);
      m.renderOrder = -1;
      m.userData.drift = 3.5 + rng() * 4.5;
      scene.add(m);
      this.clouds.push(m);
      this.cloudMats.push(mat);
    }
    this._tint = new THREE.Color();
  }

  /** Called from SkySystem.setTime with the sun state. */
  setSun(dir, day, dusk) {
    const night = 1 - day;
    this.stars.material.opacity = night * night * 0.95;
    this.stars.visible = day < 0.55;

    this.moon.position.set(-dir.x, Math.max(0.12, -dir.y + 0.55), -dir.z).normalize().multiplyScalar(1850);
    this.moon.material.opacity = Math.min(1, night * 1.3);
    this.moon.visible = day < 0.75;

    // clouds: white at noon, fire at dusk, faint slate blue at night
    this._tint.setRGB(
      0.30 + day * 0.70 + dusk * 0.05,
      0.33 + day * 0.66 - dusk * 0.10,
      0.42 + day * 0.58 - dusk * 0.26,
    );
    const op = 0.14 + day * 0.2 + dusk * 0.12;
    for (const mat of this.cloudMats) {
      mat.color.copy(this._tint);
      mat.opacity = op;
    }
  }

  update(dt) {
    this.stars.rotation.y += dt * 0.0035;
    for (const c of this.clouds) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 1500) c.position.x = -1500;
    }
  }
}
