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
  ['flashlight', ['KeyL'], 'Flashlight'],
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
    this.fallback = false;   // true once pointer lock has been refused
    this.dragging = false;

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
      if (!this.locked) {
        // playing but unlocked (a transient lock refusal) — a click re-locks
        if (!this.fallback && this.wantLock && e.button === 0) { this.requestLock(); return; }
        // drag-to-look fallback (sandboxed frames, browsers that refuse the lock)
        if (this.fallback && e.button === 0) {
          this.dragging = true;
          this._dragX = e.clientX; this._dragY = e.clientY;
          this._dragMoved = 0; this._dragStart = performance.now();
        }
        if (this.fallback && e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
        return;
      }
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        if (this.dragging) {
          // a press that barely moved is a click, not a look
          if (this._dragMoved < 6 && performance.now() - this._dragStart < 350) {
            this.mouse.leftPressed = true;
          }
          this.dragging = false;
        }
        this.mouse.left = false;
      }
      if (e.button === 2) this.mouse.right = false;
    });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('wheel', (e) => { if (this.locked || this.fallback) { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); } }, { passive: false });

    addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      const s = this.settings.sensitivity * 0.0016;
      if (this.locked) {
        this.mouse.dx += e.movementX * s;
        this.mouse.dy += e.movementY * s * (this.settings.invertY ? -1 : 1);
      } else if (this.dragging) {
        const dx = e.clientX - this._dragX, dy = e.clientY - this._dragY;
        this._dragX = e.clientX; this._dragY = e.clientY;
        this._dragMoved += Math.abs(dx) + Math.abs(dy);
        this.mouse.dx += dx * s * 1.5;
        this.mouse.dy += dy * s * 1.5 * (this.settings.invertY ? -1 : 1);
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (this.locked) this._everLocked = true;
      this.onLockChange?.(this.locked);
    });
    // Chromium refuses a lock requested within ~1.25 s of an Esc-unlock. If
    // the lock has ever worked, that refusal is transient — retry shortly
    // instead of permanently downgrading to drag-look.
    document.addEventListener('pointerlockerror', () => {
      if (!this._everLocked) { this.useFallback(); return; }
      clearTimeout(this._retryT);
      this._retryT = setTimeout(() => {
        if (!this.locked && this.wantLock) this.requestLock();
      }, 1400);
    });
  }

  /**
   * Phones and tablets get an on-screen stick, a look pad on the right half
   * of the screen, and three buttons. Pointer lock doesn't exist there, so
   * without this the game is unplayable on a phone.
   */
  enableTouch() {
    if (this.touch) return;
    this.touch = { x: 0, y: 0 };
    this.fallback = true;                 // never ask for pointer lock again
    document.getElementById('touch')?.classList.remove('hidden');

    const stick = document.getElementById('stick');
    const nub = document.getElementById('stick-nub');
    let stickId = null, sx = 0, sy = 0;
    const R = 46;
    stick?.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      stickId = t.identifier;
      const r = stick.getBoundingClientRect();
      sx = r.left + r.width / 2; sy = r.top + r.height / 2;
      e.preventDefault();
    }, { passive: false });
    const moveStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stickId) continue;
        let dx = t.clientX - sx, dy = t.clientY - sy;
        const l = Math.hypot(dx, dy);
        if (l > R) { dx *= R / l; dy *= R / l; }
        this.touch.x = dx / R; this.touch.y = -dy / R;
        nub.style.transform = `translate(${dx}px, ${dy}px)`;
        e.preventDefault();
      }
    };
    stick?.addEventListener('touchmove', moveStick, { passive: false });
    const endStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stickId) continue;
        stickId = null;
        this.touch.x = this.touch.y = 0;
        nub.style.transform = '';
      }
    };
    stick?.addEventListener('touchend', endStick);
    stick?.addEventListener('touchcancel', endStick);

    // look: drag anywhere on the right half that isn't a control
    let lookId = null, lx = 0, ly = 0, moved = 0;
    addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        if (lookId !== null || t.clientX < innerWidth * 0.4) continue;
        if (t.target.closest?.('#touch-buttons, #stick')) continue;
        lookId = t.identifier; lx = t.clientX; ly = t.clientY; moved = 0;
      }
    }, { passive: true });
    addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== lookId) continue;
        const dx = t.clientX - lx, dy = t.clientY - ly;
        lx = t.clientX; ly = t.clientY;
        moved += Math.abs(dx) + Math.abs(dy);
        const s = this.settings.sensitivity * 0.0032;
        this.mouse.dx += dx * s;
        this.mouse.dy += dy * s * (this.settings.invertY ? -1 : 1);
      }
    }, { passive: true });
    addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== lookId) continue;
        if (moved < 10) this.mouse.leftPressed = true;   // a tap throws / uses
        lookId = null;
      }
    }, { passive: true });

    const hold = (id, action) => {
      const el = document.getElementById(id);
      if (!el) return;
      const on = (e) => {
        this.keys.add(action); this.pressed.add(action);
        el.classList.add('on'); e.preventDefault();
      };
      const off = (e) => { this.keys.delete(action); el.classList.remove('on'); e.preventDefault(); };
      el.addEventListener('touchstart', on, { passive: false });
      el.addEventListener('touchend', off, { passive: false });
      el.addEventListener('touchcancel', off, { passive: false });
    };
    hold('tb-jump', 'jump');
    hold('tb-use', 'interact');
    hold('tb-sprint', 'sprint');
  }

  /** Pointer lock is unavailable — switch to hold-and-drag looking. */
  useFallback() {
    if (this.fallback) return;
    this.fallback = true;
    this.dragging = false;
    this.onFallback?.();
  }

  requestLock() {
    if (this.fallback) return;
    this.wantLock = true;
    try {
      const p = this.dom.requestPointerLock?.({ unadjustedMovement: true });
      if (p && p.catch) {
        p.catch(() => {
          try { this.dom.requestPointerLock(); } catch (_) { if (!this._everLocked) this.useFallback(); }
        });
      }
    } catch (_) {
      if (!this._everLocked) this.useFallback();
    }
  }
  exitLock() { this.wantLock = false; if (!this.fallback) document.exitPointerLock?.(); }

  down(a) { return this.enabled && this.keys.has(a); }
  hit(a) { return this.enabled && this.pressed.has(a); }
  up(a) { return this.released.has(a); }

  /** Movement axes in local space (x = strafe, y = forward). */
  axes() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0, y = 0;
    if (this.down('forward')) y += 1;
    if (this.down('back')) y -= 1;
    if (this.down('right')) x += 1;
    if (this.down('left')) x -= 1;
    if (this.touch) { x += this.touch.x; y += this.touch.y; }
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
  renderScale: 1.0,
  quality: 2,          // 0 low, 1 med, 2 high
  sharpness: 0.35,     // unsharp mask strength in the grade pass
  grass: 1.0,          // fraction of the grass tufts drawn
  volume: 0.7,
  music: 0.5,
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
