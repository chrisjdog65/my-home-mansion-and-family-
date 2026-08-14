// ───────────────────────────────────────────────────────────────────────────
// Anything with a screen — TVs, monitors, the cinema — shares one animated
// canvas per kind, so 30 displays cost three small texture updates.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { makeRng } from '../core/rng.js';

const KINDS = {
  tv: { w: 192, h: 108, fps: 8 },
  pc: { w: 192, h: 120, fps: 10 },
  cinema: { w: 256, h: 120, fps: 12 },
};

export class ScreenFx {
  constructor(world) {
    this.world = world;
    this.chan = {};
    this.rng = makeRng(2468);
    for (const [kind, cfg] of Object.entries(KINDS)) {
      const c = document.createElement('canvas');
      c.width = cfg.w; c.height = cfg.h;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      // keep mipmaps: point-sampling a 192px canvas from across the room
      // crawls and shimmers; regenerating mips at 8-12 fps is negligible
      tex.anisotropy = 4;
      this.chan[kind] = { canvas: c, ctx: c.getContext('2d'), tex, t: 0, acc: 0, cfg };
    }
  }

  update(dt, time) {
    let anyOn = false;
    for (const s of this.world.screens) if (s.on) { anyOn = true; break; }
    if (!anyOn) {
      for (const s of this.world.screens) if (s._wasOn) { this.setOff(s); }
      return;
    }
    for (const [kind, ch] of Object.entries(this.chan)) {
      ch.acc += dt;
      if (ch.acc < 1 / ch.cfg.fps) continue;
      ch.acc = 0;
      ch.t += 1 / ch.cfg.fps;
      this.draw(kind, ch, time);
      ch.tex.needsUpdate = true;
    }
    for (const s of this.world.screens) {
      if (s.on && !s._wasOn) this.setOn(s);
      else if (!s.on && s._wasOn) this.setOff(s);
    }
  }

  setOn(s) {
    const ch = this.chan[s.kind] || this.chan.tv;
    s.mat.map = ch.tex;
    s.mat.emissiveMap = ch.tex;
    s.mat.emissive = new THREE.Color(0xffffff);
    s.mat.emissiveIntensity = s.kind === 'cinema' ? 1.5 : 1.15;
    s.mat.color = new THREE.Color(0x000000);
    s.mat.needsUpdate = true;
    s._wasOn = true;
    if (!s.light) {
      s.light = { pos: s.mesh.position.clone(), color: 0x8fb4ff, intensity: 9, distance: 8, on: true, screen: true };
      this.world.lights.push(s.light);
      s.light.id = this.world.lights.length - 1;
    }
    s.light.on = true;
  }

  setOff(s) {
    s.mat.map = null;
    s.mat.emissiveMap = null;
    s.mat.emissive = new THREE.Color(0x000000);
    s.mat.color = new THREE.Color(0x07090c);
    s.mat.needsUpdate = true;
    s._wasOn = false;
    if (s.light) s.light.on = false;
  }

  draw(kind, ch, time) {
    const { ctx: c, cfg } = ch;
    const W = cfg.w, H = cfg.h, t = ch.t;
    if (kind === 'pc') {
      // a desktop with a game window
      c.fillStyle = '#0b1220'; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) {
        const y = (i * 13 + t * 24) % H;
        c.fillStyle = `hsla(${(i * 24 + t * 60) % 360},80%,60%,.16)`;
        c.fillRect(0, y, W, 2);
      }
      c.fillStyle = '#111a2b'; c.fillRect(8, 10, W - 16, H - 26);
      c.strokeStyle = '#2f81ff'; c.lineWidth = 1; c.strokeRect(8, 10, W - 16, H - 26);
      for (let i = 0; i < 7; i++) {
        const x = 16 + ((i * 31 + t * 40) % (W - 40));
        c.fillStyle = ['#4fc3f7', '#ffb74d', '#81c784', '#e57373'][i % 4];
        c.fillRect(x, 24 + Math.sin(t * 2 + i) * 14 + 30, 10, 10);
      }
      c.fillStyle = '#1b2436'; c.fillRect(0, H - 14, W, 14);
      for (let i = 0; i < 6; i++) { c.fillStyle = '#3a4a63'; c.fillRect(6 + i * 16, H - 11, 11, 8); }
    } else if (kind === 'cinema') {
      // a moody letterboxed movie
      const g = c.createLinearGradient(0, 0, W, H);
      const hue = (t * 12) % 360;
      g.addColorStop(0, `hsl(${hue},55%,22%)`);
      g.addColorStop(0.55, `hsl(${(hue + 40) % 360},60%,40%)`);
      g.addColorStop(1, `hsl(${(hue + 90) % 360},50%,14%)`);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(0,0,0,.85)';
      c.fillRect(0, 0, W, 12); c.fillRect(0, H - 12, W, 12);
      c.fillStyle = 'rgba(0,0,0,.55)';
      for (let i = 0; i < 4; i++) {
        const x = (t * 26 + i * 70) % (W + 60) - 30;
        c.beginPath(); c.ellipse(x, H * 0.62, 26, 34, 0, 0, 7); c.fill();
      }
      c.fillStyle = 'rgba(255,255,255,.10)';
      c.fillRect(0, 0, W, H * 0.4);
    } else {
      // ordinary telly: shifting colour field with a news bar
      const hue = (t * 30) % 360;
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `hsl(${hue},60%,45%)`);
      g.addColorStop(1, `hsl(${(hue + 60) % 360},60%,25%)`);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(0,0,0,.35)';
      c.beginPath(); c.arc(W * 0.35, H * 0.5, 26 + Math.sin(t * 3) * 4, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.22)';
      c.fillRect(W * 0.55, H * 0.3, 60, 34);
      c.fillStyle = 'rgba(10,12,18,.8)'; c.fillRect(0, H - 18, W, 18);
      c.fillStyle = '#e8c37a';
      c.fillRect(6, H - 13, 40 + ((t * 30) % 60), 7);
    }
  }
}
