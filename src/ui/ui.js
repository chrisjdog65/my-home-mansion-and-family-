// ───────────────────────────────────────────────────────────────────────────
// All of the 2D interface: menus, HUD, prompts, minimap, dialogue, journal.
// ───────────────────────────────────────────────────────────────────────────
import { BINDINGS } from '../core/input.js';

const $ = (id) => document.getElementById(id);

const SETTING_DEFS = [
  { key: 'fov', label: 'Field of view', type: 'range', min: 60, max: 105, step: 1, fmt: (v) => `${v}°` },
  { key: 'sensitivity', label: 'Mouse sensitivity', type: 'range', min: 0.2, max: 3, step: 0.05, fmt: (v) => v.toFixed(2) },
  { key: 'invertY', label: 'Invert vertical look', type: 'bool' },
  { key: 'headBob', label: 'Head bob', type: 'bool' },
  { key: 'quality', label: 'Detail', type: 'select', options: [[0, 'Low'], [1, 'Medium'], [2, 'High']] },
  { key: 'shadows', label: 'Shadows', type: 'select', options: [[0, 'Off'], [1, 'Soft'], [2, 'High']] },
  { key: 'bloom', label: 'Bloom', type: 'bool' },
  { key: 'sharpness', label: 'Image sharpness', type: 'range', min: 0, max: 1, step: 0.05, fmt: (v) => (v ? v.toFixed(2) : 'off') },
  { key: 'renderScale', label: 'Render scale', type: 'range', min: 0.5, max: 1.6, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'grass', label: 'Grass density', type: 'range', min: 0, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'volume', label: 'Volume', type: 'range', min: 0, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'music', label: 'Music', type: 'range', min: 0, max: 1, step: 0.05, fmt: (v) => (v ? `${Math.round(v * 100)}%` : 'off') },
  { key: 'timeScale', label: 'Time of day speed', type: 'range', min: 0, max: 6, step: 0.25, fmt: (v) => (v ? `${v}×` : 'frozen') },
  { key: 'showFps', label: 'Performance readout', type: 'bool' },
];

export class UI {
  constructor(settings) {
    this.settings = settings;
    this.el = {
      loader: $('loader'), loadbar: $('loadbar'), loadtext: $('loadtext'),
      menu: $('menu'), hud: $('hud'), pause: $('pause'), journal: $('journal'),
      prompt: $('prompt'), promptText: $('prompt-text'), sub: $('subprompt'),
      crosshair: $('crosshair'), clock: $('clock'), place: $('place'),
      minimap: $('minimap'), objectives: $('objective-list'), toasts: $('toasts'),
      dialogue: $('dialogue'), dName: $('d-name'), dText: $('d-text'), dOptions: $('d-options'),
      portrait: $('portrait'), vehicle: $('vehicle-hud'), speed: $('speed'),
      gear: $('gear'), vName: $('v-name'), held: $('held'), heldName: $('held-name'),
      fps: $('fps'), compass: $('compass-strip'),
    };
    this.map = this.el.minimap.getContext('2d');
    this.pctx = this.el.portrait.getContext('2d');
    this.hidden = false;
    this._toasts = [];
    this.buildControls();
    this.buildSettings($('settingslist'));
    this.buildSettings($('pause-settings'));
    this.buildCompass();

    for (const tab of document.querySelectorAll('.tab')) {
      tab.onclick = () => {
        document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.tabpage').forEach((p) => p.classList.toggle('active', p.dataset.page === tab.dataset.tab));
      };
    }
  }

  // ── screens ─────────────────────────────────────────────────────────────
  progress(p, text) {
    this.el.loadbar.style.width = `${Math.round(p * 100)}%`;
    if (text) this.el.loadtext.textContent = text;
  }
  showLoader(v) {
    this.el.loader.classList.toggle('hidden', !v);
    if (!v && this._tipT) { clearInterval(this._tipT); this._tipT = null; }
  }

  /** Something to read while four floors get built. */
  startTips() {
    const tips = [
      'The house is generated from scratch every time you load it — <b>54 rooms</b>, no two bedrooms furnished quite the same.',
      'Kaelie, James and Chloie keep their own schedules. Look for them where they<b>&rsquo;d actually be</b> at this hour.',
      'Pick up the skateboard at the park and press <b>F</b> to drop in. The bowl trades height for speed.',
      'Every light in the house is a real light — the fireplace, the cinema screen, the RGB in the gaming rooms.',
      'Scroll the mouse wheel to <b>wind time forward</b>. The mountains are worth seeing at dusk.',
      'Press <b>H</b> to hide the interface, then <b>P</b> to save a screenshot.',
      'Both cars drive. The Lambo will get you down the drive a lot faster than the truck.',
      'Jump at a ledge and you<b>&rsquo;ll pull yourself up</b> — handy around the pool and the skate park.',
    ];
    let i = Math.floor(Math.random() * tips.length);
    const el = $('loadtip');
    if (!el) return;
    const show = () => { el.innerHTML = tips[i % tips.length]; i++; };
    show();
    this._tipT = setInterval(show, 4200);
  }
  showMenu(v) { this.el.menu.classList.toggle('hidden', !v); }
  showHud(v) { this.el.hud.classList.toggle('hidden', !v || this.hidden); }
  showPause(v) { this.el.pause.classList.toggle('hidden', !v); }
  showJournal(v) { this.el.journal.classList.toggle('hidden', !v); }
  toggleHudVisibility() {
    this.hidden = !this.hidden;
    this.el.hud.classList.toggle('hidden', this.hidden);
    return this.hidden;
  }

  // ── settings & controls lists ───────────────────────────────────────────
  buildControls() {
    const wrap = $('keylist');
    wrap.innerHTML = '';
    const extra = [
      ['Left mouse', 'Throw / use held item'],
      ['Right mouse', 'Zoom in'],
      ['Mouse wheel', 'Cycle time of day'],
    ];
    for (const [, codes, desc] of BINDINGS) {
      const row = document.createElement('div');
      row.className = 'keyrow';
      row.innerHTML = codes.slice(0, 2).map((c) => `<span class="key">${pretty(c)}</span>`).join('') + `<b>${desc}</b>`;
      wrap.appendChild(row);
    }
    for (const [k, desc] of extra) {
      const row = document.createElement('div');
      row.className = 'keyrow';
      row.innerHTML = `<span class="key">${k}</span><b>${desc}</b>`;
      wrap.appendChild(row);
    }
  }

  buildSettings(root) {
    if (!root) return;
    root.innerHTML = '';
    for (const def of SETTING_DEFS) {
      const row = document.createElement('div');
      row.className = 'setrow';
      const label = document.createElement('span');
      label.textContent = def.label;
      row.appendChild(label);

      if (def.type === 'range') {
        const input = document.createElement('input');
        input.type = 'range'; input.min = def.min; input.max = def.max; input.step = def.step;
        input.value = this.settings[def.key];
        const val = document.createElement('span');
        val.className = 'val';
        val.textContent = def.fmt(+input.value);
        input.oninput = () => {
          const v = +input.value;
          val.textContent = def.fmt(v);
          this.settings.set(def.key, v);
          this.syncAll(def.key, v);
        };
        row.append(input, val);
        row._input = input; row._val = val;
      } else if (def.type === 'bool') {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!this.settings[def.key];
        input.onchange = () => { this.settings.set(def.key, input.checked); this.syncAll(def.key, input.checked); };
        row.appendChild(input);
        row._input = input;
      } else {
        const sel = document.createElement('select');
        for (const [v, name] of def.options) {
          const o = document.createElement('option');
          o.value = v; o.textContent = name;
          sel.appendChild(o);
        }
        sel.value = this.settings[def.key];
        sel.onchange = () => { this.settings.set(def.key, +sel.value); this.syncAll(def.key, +sel.value); };
        const spacer = document.createElement('span');
        row.append(sel, spacer);
        row._input = sel;
      }
      row.dataset.key = def.key;
      root.appendChild(row);
    }

    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:10px; margin-top:12px';
    const reset = document.createElement('button');
    reset.className = 'reset-defaults';
    reset.textContent = 'Reset to defaults';
    reset.onclick = () => {
      this.settings.reset();
      // notify every subscriber, then repaint both panels
      for (const def of SETTING_DEFS) this.settings.set(def.key, this.settings[def.key]);
      this.buildSettings($('settingslist'));
      this.buildSettings($('pause-settings'));
    };
    const wipe = document.createElement('button');
    wipe.className = 'reset-defaults';
    wipe.textContent = 'Reset progress';
    wipe.onclick = () => this.onResetProgress?.();
    row.append(reset, wipe);
    root.appendChild(row);
  }

  /** One-time card on a player's first run. */
  showHint() {
    const el = document.createElement('div');
    el.id = 'hint';
    el.innerHTML = `<h3>Make yourself at home</h3>
      <div class="hint-grid">
        <span class="key">WASD</span><b>Walk — hold Shift to run</b>
        <span class="key">Mouse</span><b>Look around · right button zooms</b>
        <span class="key">E</span><b>Interact: talk, sit, open, pick things up</b>
        <span class="key">F</span><b>Get in a car · drop in on the skateboard</b>
        <span class="key">Space</span><b>Jump — at a ledge you'll pull yourself up</b>
        <span class="key">Tab</span><b>Journal: family, rooms, objectives</b>
        <span class="key">L</span><b>Flashlight</b>
        <span class="key">Wheel</span><b>Wind the time of day forward</b>
      </div>
      <small>Click anywhere to start exploring</small>`;
    document.body.appendChild(el);
    const close = () => { el.remove(); removeEventListener('keydown', close); };
    el.onclick = close;
    addEventListener('keydown', close, { once: true });
    setTimeout(close, 15000);
  }

  /** Keep the two copies of the settings panel in step. */
  syncAll(key, value) {
    for (const row of document.querySelectorAll(`.setrow[data-key="${key}"]`)) {
      const input = row._input;
      if (!input) continue;
      if (input.type === 'checkbox') input.checked = !!value;
      else input.value = value;
      if (row._val) {
        const def = SETTING_DEFS.find((d) => d.key === key);
        if (def?.fmt) row._val.textContent = def.fmt(+value);
      }
    }
  }

  // ── HUD bits ────────────────────────────────────────────────────────────
  setPrompt(text, sub) {
    if (text) {
      this.el.prompt.classList.remove('hidden');
      this.el.promptText.textContent = text;
      this.el.crosshair.classList.add('hot');
    } else {
      this.el.prompt.classList.add('hidden');
      this.el.crosshair.classList.remove('hot');
    }
    if (sub) { this.el.sub.classList.remove('hidden'); this.el.sub.textContent = sub; }
    else this.el.sub.classList.add('hidden');
  }

  setClock(time, place) {
    this.el.clock.textContent = time;
    this.el.place.textContent = place;
  }

  setHeld(name) {
    this.el.held.classList.toggle('hidden', !name);
    if (name) this.el.heldName.textContent = name;
  }

  setVehicle(v) {
    this.el.vehicle.classList.toggle('hidden', !v);
    if (v) {
      this.el.speed.textContent = Math.round(Math.abs(v.speed) * 2.237);
      this.el.gear.textContent = v.speed < -0.4 ? 'R' : v.speed > 0.4 ? 'D' : 'N';
      this.el.vName.textContent = v.name;
    }
  }

  setCrosshairWide(v) { this.el.crosshair.classList.toggle('wide', v); }

  buildCompass() {
    const marks = ['N', '', 'NE', '', 'E', '', 'SE', '', 'S', '', 'SW', '', 'W', '', 'NW', ''];
    let html = '';
    for (let rep = 0; rep < 3; rep++) {
      for (const m of marks) html += `<span style="width:40px">${m || '·'}</span>`;
    }
    this.el.compass.innerHTML = html;
    this._compassWidth = 40 * 16;
  }
  setHeading(yaw, tracked = null, from = null) {
    // yaw is unbounded — double-wrap so JS's signed % can't walk the strip
    // off its three-repetition band after a few full turns
    const deg = ((((-yaw * 180) / Math.PI) % 360) + 360) % 360;
    const px = (deg / 360) * this._compassWidth;
    // the needle sits at 140, mid-strip; a mark's glyph is centred in its own
    // 40 px cell, so line the cell's centre up rather than its left edge
    this.el.compass.style.transform = `translateX(${-px - this._compassWidth + 120}px)`;

    // a pip on the compass for whatever you still have to do
    if (!this._pip) {
      this._pip = document.createElement('div');
      this._pip.id = 'obj-pip';
      this.el.compass.parentElement.appendChild(this._pip);
    }
    if (!tracked || !tracked.where || !from) { this._pip.style.display = 'none'; this.setTrack(null); return; }
    // in the same sense as yaw — you face (−sin yaw, −cos yaw), so turning
    // right counts yaw down and the pip has to walk left with the letters
    const bearing = Math.atan2(-(tracked.where.x - from.x), -(tracked.where.z - from.z));
    let rel = ((yaw - bearing + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    // the strip runs 640 px to the turn, so the 140 px either side of the
    // needle are worth this much — anything else and the pip drifts off the
    // letters it is meant to sit over
    const half = 140 / (this._compassWidth / (Math.PI * 2));
    if (Math.abs(rel) > half) { this._pip.style.display = 'none'; }
    else {
      this._pip.style.display = 'block';
      this._pip.style.left = `calc(50% + ${(rel / half) * 140}px)`;
    }
    this.setTrack(tracked, Math.round(from.distanceTo(tracked.where)));
  }

  setTrack(o, dist) {
    if (!this._track) {
      this._track = document.createElement('div');
      this._track.id = 'tracker';
      this.el.hud.appendChild(this._track);
    }
    this._track.classList.toggle('hidden', !o);
    if (o) this._track.innerHTML = `<b>${o.text}</b><small>${dist} m${o.hint ? ` · ${o.hint}` : ''}</small>`;
  }

  /** Full-screen fade, used when you turn in for the night. */
  fade(to, ms) {
    if (!this._fade) {
      this._fade = document.createElement('div');
      this._fade.id = 'fadeout';
      document.body.appendChild(this._fade);
    }
    this._fade.style.transition = `opacity ${ms}ms ease`;
    this._fade.style.opacity = String(to);
    this._fade.style.pointerEvents = to > 0.5 ? 'auto' : 'none';
  }

  toast(title, sub) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
    this.el.toasts.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .4s, transform .4s';
      el.style.opacity = '0'; el.style.transform = 'translateX(20px)';
      setTimeout(() => el.remove(), 420);
    }, 4200);
  }

  setObjectives(list) {
    this.el.objectives.innerHTML = list
      .map((o) => `<li class="${o.done ? 'done' : ''}">${o.text}</li>`)
      .join('');
  }

  // ── dialogue ────────────────────────────────────────────────────────────
  showDialogue(member, text, options) {
    this.el.dialogue.classList.remove('hidden');
    this.el.dName.textContent = `${member.name} — ${member.spec.role}`;
    this.el.dText.textContent = text;
    this.el.dOptions.innerHTML = '';
    for (const o of options) {
      const b = document.createElement('button');
      b.textContent = o.label;
      b.onclick = (e) => { e.stopPropagation(); o.action(); };
      this.el.dOptions.appendChild(b);
    }
    this.drawPortrait(member.spec);
  }
  hideDialogue() { this.el.dialogue.classList.add('hidden'); }

  drawPortrait(spec) {
    const c = this.pctx, S = 128;
    c.clearRect(0, 0, S, S);
    const grd = c.createLinearGradient(0, 0, 0, S);
    grd.addColorStop(0, '#20262f'); grd.addColorStop(1, '#12161c');
    c.fillStyle = grd; c.fillRect(0, 0, S, S);
    const hex = (v) => `#${v.toString(16).padStart(6, '0')}`;
    // shoulders
    c.fillStyle = hex(spec.shirt);
    c.beginPath(); c.ellipse(64, 132, 46, 34, 0, 0, 7); c.fill();
    // hair back
    c.fillStyle = hex(spec.hair);
    c.beginPath(); c.ellipse(64, 62, 34, 40, 0, 0, 7); c.fill();
    // face
    c.fillStyle = hex(spec.skin);
    c.beginPath(); c.ellipse(64, 64, 26, 32, 0, 0, 7); c.fill();
    // fringe
    c.fillStyle = hex(spec.hair);
    c.beginPath(); c.ellipse(64, 38, 28, 18, 0, 0, 7); c.fill();
    // eyes + mouth
    c.fillStyle = '#f7f9fb';
    c.beginPath(); c.ellipse(54, 62, 6, 4, 0, 0, 7); c.ellipse(74, 62, 6, 4, 0, 0, 7); c.fill();
    c.fillStyle = '#2b211a';
    c.beginPath(); c.arc(54, 62, 2.6, 0, 7); c.arc(74, 62, 2.6, 0, 7); c.fill();
    c.strokeStyle = '#8f5a52'; c.lineWidth = 2.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(56, 82); c.quadraticCurveTo(64, 88, 72, 82); c.stroke();
  }

  // ── minimap ─────────────────────────────────────────────────────────────
  drawMinimap(world, player, family, scale = 2.0) {
    const c = this.map, S = 260, R = S / 2;
    c.clearRect(0, 0, S, S);
    c.save();
    c.beginPath(); c.arc(R, R, R - 2, 0, 7); c.clip();
    c.fillStyle = 'rgba(10,13,18,.72)'; c.fillRect(0, 0, S, S);

    const px = player.position.x, pz = player.position.z, py = player.position.y;
    c.translate(R, R);
    c.rotate(player.yaw);
    c.translate(-px * scale, -pz * scale);

    // rooms on this floor
    c.lineWidth = 1;
    for (const r of world.rooms) {
      if (Math.abs(r.y - (py - 0.9)) > 2.6) continue;
      const here = Math.abs(px - r.x) < r.w / 2 && Math.abs(pz - r.z) < r.d / 2;
      c.fillStyle = here ? 'rgba(232,195,122,.30)' : 'rgba(255,255,255,.11)';
      c.strokeStyle = here ? 'rgba(232,195,122,.9)' : 'rgba(255,255,255,.26)';
      c.fillRect((r.x - r.w / 2) * scale, (r.z - r.d / 2) * scale, r.w * scale, r.d * scale);
      c.strokeRect((r.x - r.w / 2) * scale, (r.z - r.d / 2) * scale, r.w * scale, r.d * scale);
    }
    // family dots
    const cols = { kaelie: '#e78ba7', james: '#6fb5f0', chloie: '#b58cf0' };
    for (const f of family) {
      if (Math.abs(f.char.pos.y - (py - 0.9)) > 3.2) continue;
      c.fillStyle = cols[f.id] || '#fff';
      c.beginPath(); c.arc(f.char.pos.x * scale, f.char.pos.z * scale, 3.4, 0, 7); c.fill();
    }
    c.restore();

    // player arrow (always centred, pointing up)
    c.save();
    c.translate(R, R);
    c.fillStyle = '#e8c37a';
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 1;
    c.beginPath(); c.arc(R, R, R - 2, 0, 7); c.stroke();
  }

  // ── journal ─────────────────────────────────────────────────────────────
  updateJournal(family, world, objectives, discovered, game = null) {
    const day = game ? `<div class="jrow"><b>Day ${game.day}</b><small>${game.birthdayToday()
      ? `It's ${family.find((f) => f.id === game.birthdayToday())?.name}'s birthday today` : 'Nothing special on'}</small></div>` : '';
    $('j-family').innerHTML = day + family.map((f) => {
      const b = game ? Math.min(5, Math.floor((game.bond?.[f.id] || 0) / 4)) : 0;
      const hearts = game ? `<span class="bond">${'♥'.repeat(b)}${'♡'.repeat(5 - b)}</span>` : '';
      // ask the game rather than re-deriving it, or the journal and the house
      // disagree on the day the console comes back
      const gr = game?.isGrounded(f.id) ? ' · no screens today' : '';
      return `<div class="jrow"><b>${f.name}</b> — ${f.spec.role} ${hearts}<small>${f.activity}${gr}</small></div>`;
    }).join('');
    const byFloor = {};
    for (const name of discovered) {
      const r = world.rooms.find((x) => x.name === name);
      const key = r ? r.floorName || r.floor : 'Grounds';
      (byFloor[key] = byFloor[key] || []).push(name);
    }
    $('j-rooms').innerHTML = Object.entries(byFloor).map(([f, list]) =>
      `<div class="jrow"><b>${f}</b><small>${list.join(' · ')}</small></div>`).join('')
      || '<div class="jrow"><small>Nothing yet — go explore.</small></div>';
    $('j-obj').innerHTML = objectives.map((o) =>
      `<div class="jrow">${o.done ? '✔' : '○'} ${o.text}<small>${o.hint || ''}</small></div>`).join('');
  }

  setFps(text) {
    this.el.fps.textContent = this.settings.showFps ? text : '';
  }
}

function pretty(code) {
  return code
    .replace('Key', '').replace('Arrow', '').replace('Digit', '')
    .replace('ControlLeft', 'Ctrl').replace('ShiftLeft', 'Shift').replace('ShiftRight', 'Shift')
    .replace('Escape', 'Esc').replace('Space', '␣');
}
