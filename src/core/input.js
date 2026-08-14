// ───────────────────────────────────────────────────────────────────────────
// Input: keyboard, mouse look with pointer lock, gamepad, and a small
// "action" layer so gameplay code never touches raw key codes.
// ───────────────────────────────────────────────────────────────────────────

export const BINDINGS = [
  ['forward', ['KeyW', 'ArrowUp'], 'Move forward'],
  ['back', ['KeyS', 'ArrowDown'], 'Move back'],
  ['left', ['KeyA', 'ArrowLeft'], 'Strafe left'],
  ['right', ['KeyD', 'ArrowRight'], 'Strafe right'],
  ['sprint', ['ShiftLeft', 'ShiftRight'], 'Sprint'],
  ['jump', ['Space'], 'Jump / swim up'],
  ['crouch', ['KeyC', 'ControlLeft'], 'Crouch / swim down'],
  ['interact', ['KeyE'], 'Interact · talk · sit'],
  ['drop', ['KeyG'], 'Drop held item'],
  ['vehicle', ['KeyF'], 'Enter / exit vehicle'],
  ['flashlight', ['KeyL'], 'Toggle lights in room'],
  ['journal', ['Tab'], 'Journal'],
  ['photo', ['KeyH'], 'Hide HUD (photo mode)'],
  ['screenshot', ['KeyP'], 'Save screenshot'],
  ['pause', ['Escape'], 'Pause'],
];

export class Input {
  constructor(dom, settings) {
    this.dom = dom;
    this.settings = settings;
    this.keys = new Set();
    this.pressed = new Set();     // edge-triggered, cleared each frame
    this.released = new Set();
    this.mouse = { dx: 0, dy: 0, left: false, right: false, leftPressed: false, rightPressed: false, wheel: 0 };
    this.locked = false;
    this.enabled = true;

    this._map = new Map();
    for (const [action, codes] of BINDINGS) for (const c of codes) this._map.set(c, action);

    addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (e.repeat) return;
      const a = this._map.get(e.code);
      if (a) { this.keys.add(a); this.pressed.add(a); }
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => {
      const a = this._map.get(e.code);
      if (a) { this.keys.delete(a); this.released.add(a); }
    });
    addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });

    dom.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('wheel', (e) => { if (this.locked) { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); } }, { passive: false });

    addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      const s = this.settings.sensitivity * 0.0016;
      this.mouse.dx += e.movementX * s;
      this.mouse.dy += e.movementY * s * (this.settings.invertY ? -1 : 1);
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('pointerlockerror', () => { this.onLockChange?.(false); });
  }

  requestLock() {
    const p = this.dom.requestPointerLock?.({ unadjustedMovement: true });
    if (p && p.catch) p.catch(() => this.dom.requestPointerLock());
  }
  exitLock() { document.exitPointerLock?.(); }

  down(a) { return this.enabled && this.keys.has(a); }
  hit(a) { return this.enabled && this.pressed.has(a); }
  up(a) { return this.released.has(a); }

  /** Movement axes in local space (x = strafe, y = forward). */
  axes() {
    let x = 0, y = 0;
    if (this.down('forward')) y += 1;
    if (this.down('back')) y -= 1;
    if (this.down('right')) x += 1;
    if (this.down('left')) x -= 1;
    const gp = this.gamepad();
    if (gp) {
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      x += dz(gp.axes[0]); y -= dz(gp.axes[1]);
    }
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  gamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  /** Called once per frame *after* systems have read the state. */
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouse.dx = this.mouse.dy = 0;
    this.mouse.wheel = 0;
    this.mouse.leftPressed = this.mouse.rightPressed = false;
  }
}

// ── settings, persisted in localStorage ────────────────────────────────────
const DEFAULTS = {
  fov: 75,
  sensitivity: 1.0,
  invertY: false,
  headBob: true,
  shadows: 2,          // 0 off, 1 low, 2 high
  bloom: true,
  ssao: true,
  renderScale: 1.0,
  quality: 2,          // 0 low, 1 med, 2 high
  volume: 0.7,
  showFps: false,
  timeScale: 1.0,      // day/night speed multiplier
};

export class Settings {
  constructor() {
    Object.assign(this, DEFAULTS);
    try {
      const raw = localStorage.getItem('home.settings');
      if (raw) Object.assign(this, JSON.parse(raw));
    } catch (_) { /* private mode — just use defaults */ }
    this._subs = [];
  }
  set(k, v) { this[k] = v; this.save(); this._subs.forEach((f) => f(k, v)); }
  onChange(f) { this._subs.push(f); }
  save() {
    try {
      const o = {}; for (const k of Object.keys(DEFAULTS)) o[k] = this[k];
      localStorage.setItem('home.settings', JSON.stringify(o));
    } catch (_) { /* ignore */ }
  }
  reset() { Object.assign(this, DEFAULTS); this.save(); }
}
