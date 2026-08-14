// ───────────────────────────────────────────────────────────────────────────
// Procedural audio — no files, everything is synthesised with the WebAudio
// graph: footsteps that change with the surface, water, fire, doors, engines.
// ───────────────────────────────────────────────────────────────────────────

export class Audio {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.ready = false;
    this.emitters = [];
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.settings.volume;
    // gentle bus compression so nothing clips
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 4;
    this.comp.connect(this.ctx.destination);
    this.master.connect(this.comp);

    this.noiseBuf = this.makeNoise(2.0);
    this.ready = true;
    this.ambience();
    this.settings.onChange((k, v) => { if (k === 'volume') this.master.gain.value = v; });
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }

  makeNoise(seconds) {
    const n = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;      // slightly brown
      d[i] = w * 0.7 + last * 3;
    }
    return buf;
  }

  // ── one-shots ───────────────────────────────────────────────────────────
  blip({ freq = 440, type = 'sine', dur = 0.12, gain = 0.2, sweep = 0, at = 0 }) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + sweep), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise({ dur = 0.12, gain = 0.2, freq = 900, q = 1, type = 'bandpass', at = 0, sweep = 0 }) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + at;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + sweep), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t); s.stop(t + dur + 0.05);
  }

  play(name, opt = {}) {
    if (!this.ready) return;
    switch (name) {
      case 'step': {
        const surf = opt.surface || 'wood';
        const cfg = {
          wood: { freq: 620, dur: 0.09, gain: 0.10, q: 1.4 },
          carpet: { freq: 320, dur: 0.11, gain: 0.055, q: 0.7 },
          tile: { freq: 1500, dur: 0.07, gain: 0.10, q: 2.6 },
          grass: { freq: 900, dur: 0.13, gain: 0.07, q: 0.8 },
          concrete: { freq: 1100, dur: 0.08, gain: 0.10, q: 1.8 },
          water: { freq: 700, dur: 0.24, gain: 0.12, q: 0.5 },
        }[surf] || { freq: 600, dur: 0.09, gain: 0.09, q: 1.2 };
        this.noise({ ...cfg, gain: cfg.gain * (opt.loud ? 1.7 : 1), sweep: -cfg.freq * 0.5 });
        this.blip({ freq: 90 + Math.random() * 20, type: 'sine', dur: 0.07, gain: 0.05, sweep: -40 });
        break;
      }
      case 'jump': this.blip({ freq: 240, type: 'sine', dur: 0.14, gain: 0.08, sweep: 120 }); break;
      case 'land': this.noise({ freq: 260, dur: 0.16, gain: 0.16, q: 0.6, sweep: -160 }); break;
      case 'creak': this.blip({ freq: 420, type: 'sawtooth', dur: 0.5, gain: 0.045, sweep: -180 }); break;
      case 'latch': this.noise({ freq: 2400, dur: 0.05, gain: 0.12, q: 3 }); break;
      case 'click': this.blip({ freq: 1200, type: 'square', dur: 0.035, gain: 0.05, sweep: -400 }); break;
      case 'tvon': this.noise({ freq: 3000, dur: 0.3, gain: 0.05, q: 0.4, sweep: -2400 }); this.blip({ freq: 660, dur: 0.2, gain: 0.05, sweep: 220 }); break;
      case 'pcon':
        this.blip({ freq: 523, dur: 0.14, gain: 0.06 });
        this.blip({ freq: 784, dur: 0.18, gain: 0.06, at: 0.13 });
        this.blip({ freq: 1046, dur: 0.3, gain: 0.05, at: 0.29 });
        break;
      case 'movie':
        this.blip({ freq: 130, type: 'sawtooth', dur: 1.6, gain: 0.05, sweep: 60 });
        this.blip({ freq: 196, type: 'triangle', dur: 1.4, gain: 0.04, at: 0.2 });
        break;
      case 'fire': this.noise({ freq: 400, dur: 0.7, gain: 0.09, q: 0.4, sweep: 500 }); break;
      case 'splash':
        this.noise({ freq: 1400, dur: 0.45, gain: 0.22, q: 0.4, sweep: -1200 });
        this.noise({ freq: 500, dur: 0.7, gain: 0.1, q: 0.6, sweep: -300, at: 0.04 });
        break;
      case 'bounce': this.blip({ freq: 180 + Math.random() * 60, type: 'sine', dur: 0.16, gain: 0.10 * (opt.gain ?? 1), sweep: -90 }); break;
      case 'pin': {
        const g = opt.gain ?? 1;
        this.noise({ freq: 1800, dur: 0.16, gain: 0.16 * g, q: 2.4, sweep: -900 });
        this.blip({ freq: 300, dur: 0.2, gain: 0.07 * g, sweep: -160 });
        break;
      }
      case 'roll': this.noise({ freq: 120, dur: 1.4, gain: 0.07, q: 0.5, type: 'lowpass' }); break;
      case 'swish': this.noise({ freq: 2600, dur: 0.3, gain: 0.1, q: 0.6, sweep: -2000 }); break;
      case 'pickup': this.blip({ freq: 700, dur: 0.09, gain: 0.06, sweep: 300 }); break;
      case 'engine': this.blip({ freq: 70, type: 'sawtooth', dur: 0.6, gain: 0.1, sweep: 60 }); break;
      case 'chime':
        this.blip({ freq: 880, dur: 0.5, gain: 0.06 });
        this.blip({ freq: 1320, dur: 0.7, gain: 0.045, at: 0.09 });
        break;
      case 'ui': this.blip({ freq: 900, type: 'triangle', dur: 0.05, gain: 0.04 }); break;
      default: break;
    }
  }

  // ── continuous beds ─────────────────────────────────────────────────────
  ambience() {
    const mk = (freq, q, gain, type = 'bandpass') => {
      const s = this.ctx.createBufferSource();
      s.buffer = this.noiseBuf; s.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = this.ctx.createGain(); g.gain.value = 0;
      s.connect(f).connect(g).connect(this.master);
      s.start();
      return g;
    };
    this.wind = mk(420, 0.5, 0);
    this.waterfall = mk(1500, 0.35, 0);
    this.interior = mk(180, 0.6, 0, 'lowpass');
    this.engineGain = null;

    // birds during the day
    this.birdTimer = 0;
  }

  /** Called every frame with what the player can hear. */
  update(dt, ctx) {
    if (!this.ready) return;
    const out = ctx.outside ? 1 : 0.12;
    const target = (0.055 * out) * (1 - ctx.submerged * 0.9);
    this.wind.gain.value += (target - this.wind.gain.value) * Math.min(1, dt * 2);

    const wf = Math.max(0, 1 - ctx.waterfallDistance / 42);
    this.waterfall.gain.value += ((wf * wf * 0.34) - this.waterfall.gain.value) * Math.min(1, dt * 2);

    const inside = ctx.outside ? 0 : 0.02;
    this.interior.gain.value += (inside - this.interior.gain.value) * Math.min(1, dt * 2);

    if (ctx.outside && ctx.day) {
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        this.birdTimer = 2.4 + Math.random() * 6;
        const base = 1800 + Math.random() * 1400;
        for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) {
          this.blip({ freq: base * (1 + Math.random() * 0.4), type: 'sine', dur: 0.07, gain: 0.022, sweep: 400, at: i * 0.09 });
        }
      }
    }
  }

  startEngine() {
    if (!this.ready || this.engineGain) return;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    const o2 = this.ctx.createOscillator();
    o2.type = 'square';
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 3;
    const g = this.ctx.createGain(); g.gain.value = 0;
    o.connect(f); o2.connect(f); f.connect(g).connect(this.master);
    o.start(); o2.start();
    this.engineGain = g; this.engineOsc = o; this.engineOsc2 = o2; this.engineFilter = f;
  }
  stopEngine() {
    if (!this.engineGain) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0, t, 0.1);
    const o = this.engineOsc, o2 = this.engineOsc2;
    setTimeout(() => { try { o.stop(); o2.stop(); } catch (_) {} }, 400);
    this.engineGain = null;
  }
  engine(rpm, load) {
    if (!this.engineGain) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.06);
    this.engineOsc2.frequency.setTargetAtTime(rpm * 0.5, t, 0.06);
    this.engineFilter.frequency.setTargetAtTime(500 + rpm * 6 + load * 900, t, 0.08);
    this.engineGain.gain.setTargetAtTime(0.05 + load * 0.06, t, 0.1);
  }
}
