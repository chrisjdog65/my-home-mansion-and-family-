// ───────────────────────────────────────────────────────────────────────────
// Game: builds the world, runs the loop, owns the glue between systems.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';

import { Engine } from './core/engine.js';
import { Input, Settings } from './core/input.js';
import { Materials } from './core/materials.js';
import { clamp, damp, makeRng } from './core/rng.js';

import { World } from './world/world.js';
import { buildMansion } from './world/mansion.js';
import { furnishAll } from './world/furnish.js';
import { buildTerrain, SkySystem, groundHeight } from './world/terrain.js';
import { buildBackyard } from './world/backyard.js';
import { buildTruck, buildLambo, updateVehicle, resetVehicle } from './world/vehicles.js';
import { buildNav } from './world/nav.js';
import { BEDROOM_COUNT, BATH_COUNT } from './world/plan.js';

import { Player } from './systems/player.js';
import { Props } from './systems/props.js';
import { LightManager } from './systems/lights.js';
import { Interaction } from './systems/interaction.js';
import { Audio } from './systems/audio.js';

import { createFamily } from './entities/family.js';
import { UI } from './ui/ui.js';
import { ScreenFx } from './systems/screenfx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class Game {
  constructor(canvas) {
    this.settings = new Settings();
    this.engine = new Engine(canvas, this.settings);
    this.input = new Input(canvas, this.settings);
    this.ui = new UI(this.settings);
    this.audio = new Audio(this.settings);

    this.state = 'loading';       // loading | menu | play | pause | journal
    this.time = 0;
    this.discovered = new Set();
    this.objectives = [];
    this._acc = 0;
    this._frames = 0;
    this._fpsT = 0;
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();

    // Releasing the mouse pauses — unless we let it go on purpose to show the
    // journal or a conversation.
    this.input.onLockChange = (locked) => {
      if (!locked && this.state === 'play' && !this.dialogue && !this.journalOpen) this.pause(true);
    };
    addEventListener('keydown', (e) => {
      if (e.code !== 'Escape') return;
      if (this.dialogue) { this.endDialogue(); e.preventDefault(); }
      else if (this.journalOpen) { this.journalOpen = false; this.ui.showJournal(false); this.input.requestLock(); }
    });
    this.settings.onChange((k) => {
      if (k === 'quality') this.mats?.setQuality(this.settings.quality);
      if (k === 'shadows') this.applyShadowQuality();
    });
  }

  // ── build ───────────────────────────────────────────────────────────────
  async load() {
    const step = async (p, text, fn) => {
      this.ui.progress(p, text);
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      return fn?.();
    };

    await step(0.05, 'Mixing paint and milling timber…', () => {
      this.mats = new Materials(this.engine.renderer);
      this.world = new World(this.engine.scene, this.mats);
      this.engine.scene.fog = new THREE.Fog(0xbdd3e8, 700, 2600);
    });

    await step(0.18, 'Raising four floors…', () => buildMansion(this.world));
    await step(0.40, 'Moving the furniture in…', () => furnishAll(this.world));
    await step(0.56, 'Landscaping the grounds…', () => buildTerrain(this.world));
    await step(0.68, 'Filling the pool, starting the waterfall…', () => buildBackyard(this.world));
    await step(0.76, 'Parking the truck and the Lambo…', () => {
      this.truck = buildTruck(this.world, 12, -22, Math.PI);
      this.lambo = buildLambo(this.world, 25.5, -18.5, Math.PI);
    });

    await step(0.84, 'Squaring up the collision…', () => {
      this.world.build();
      this.sky = new SkySystem(this.engine, this.world);
      this.sky.setTime(8.4);
      this.sky.updateEnv(true);
    });

    await step(0.90, 'Waking the family…', () => {
      this.props = new Props(this.world);
      this.spawnProps();
      buildNav(this.world);
      this.family = createFamily(this.world);
      this.lights = new LightManager(this.engine.scene, this.world, this.settings, 10);
      this.screenFx = new ScreenFx(this.world);
    });

    await step(0.97, 'Unlocking the front door…', () => {
      this.player = new Player(this.world, this.engine.camera, this.input, this.settings);
      this.player.teleport(0, 0.25, -20, Math.PI);
      this.interaction = new Interaction(this.world, this.engine.camera, this.player, this.props);
      this.interaction.family = this.family;
      this.setupObjectives();
      this.applyShadowQuality();
      this.mats.setQuality(this.settings.quality);
    });

    this.ui.progress(1, 'Welcome home');
    await new Promise((r) => setTimeout(r, 260));
    this.ui.showLoader(false);
    this.ui.showMenu(true);
    this.state = 'menu';
    this.wireMenu();
  }

  applyShadowQuality() {
    const s = this.settings.shadows;
    const r = this.engine.renderer;
    r.shadowMap.enabled = s > 0;
    r.shadowMap.type = s > 1 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (this.sky) {
      this.sky.sun.shadow.mapSize.setScalar(s > 1 ? 2048 : 1024);
      if (this.sky.sun.shadow.map) { this.sky.sun.shadow.map.dispose(); this.sky.sun.shadow.map = null; }
    }
    this.engine.scene.traverse((o) => { if (o.isMesh) o.material.needsUpdate = false; });
  }

  spawnProps() {
    const M = this.mats;
    for (const s of this.world.propSpawns) {
      if (s.kind === 'pin') {
        const g = new THREE.Group();
        // the group origin sits at the sphere centre, 0.13 above the pin's base
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.38, 12), M.paint(0xfbfaf6, 0.28, 'pin'));
        body.position.y = 0.06;
        const neck = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), M.paint(0xfbfaf6, 0.28, 'pin'));
        neck.position.y = 0.27;
        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.045, 12), M.solid(0xd0342c, 0.4));
        stripe.position.y = 0.18;
        g.add(body, neck, stripe);
        g.position.set(s.x, s.y, s.z);
        g.castShadow = true;
        this.props.add({ mesh: g, radius: 0.13, mass: 0.5, bounce: 0.2, upright: true, tag: s.tag, name: 'pin', canGrab: false });
      } else if (s.kind === 'bowlingball') {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.108, 20, 16), M.solid(s.color, 0.1, 0.2));
        m.castShadow = true;
        m.position.set(s.x, s.y, s.z);
        this.props.add({ mesh: m, radius: 0.108, mass: 6, bounce: 0.18, friction: 0.35, name: 'bowling ball', tag: 'ball' });
      } else if (s.kind === 'basketball') {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.122, 20, 16), M.solid(0xd1611f, 0.85));
        m.castShadow = true;
        m.position.set(s.x, s.y, s.z);
        this.props.add({ mesh: m, radius: 0.122, mass: 0.7, bounce: 0.74, friction: 1.4, name: 'basketball', tag: 'basketball' });
      } else if (s.kind === 'skateboard') {
        const g = new THREE.Group();
        const deck = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.82), M.solid(0x2b3a4a, 0.6));
        deck.position.y = 0.08;
        g.add(deck);
        for (const oz of [-0.28, 0.28]) for (const ox of [-0.1, 0.1]) {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 10), M.solid(0xe8e2d2, 0.5));
          w.rotation.z = Math.PI / 2;
          w.position.set(ox, 0.032, oz);
          g.add(w);
        }
        g.position.set(s.x, s.y, s.z);
        this.props.add({ mesh: g, radius: 0.2, mass: 1.4, bounce: 0.25, friction: 1.2, name: 'skateboard', tag: 'skate' });
      }
    }
    // a few loose things around the house
    const rng = makeRng(5150);
    const spots = [
      ['pillow', -22, 0.6, 6, 0xd8dee6],
      ['apple', -2, 1.1, 10.2, 0xd0342c],
      ['book', -25, 0.9, -6, 0x3f5c6b],
      ['mug', -1.2, 1.0, 9.6, 0xe8e2d6],
    ];
    for (const [name, x, y, z, col] of spots) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), M.solid(col, 0.7));
      m.scale.set(1, name === 'book' ? 0.35 : 1, name === 'book' ? 1.4 : 1);
      m.position.set(x, y, z);
      m.castShadow = true;
      this.props.add({ mesh: m, radius: 0.1, mass: 0.4, bounce: 0.3, name });
    }
  }

  // ── objectives ──────────────────────────────────────────────────────────
  setupObjectives() {
    const o = (id, text, hint) => ({ id, text, hint, done: false });
    this.objectives = [
      o('greet', 'Find Kaelie and say good morning', 'She is usually in the kitchen early on'),
      o('kids', 'Catch up with James and Chloie', 'Try their rooms, the gaming room or the yard'),
      o('fire', 'Light the fire in the great room', 'Walk up to the stone hearth'),
      o('pc', 'Boot up a gaming PC', 'Second floor and the third-floor loft'),
      o('movie', 'Start movie night in the theater', 'Lower level, west end'),
      o('hoop', 'Sink a basket on the home court', 'Grab the ball, aim, left click'),
      o('strike', 'Knock all ten pins down', 'Bowling alley, lower level'),
      o('swim', 'Get in the pool', 'Out on the back terrace'),
      o('bowl', 'Drop into the skate bowl', 'Far end of the back yard'),
      o('drive', 'Take the Lamborghini down the drive', 'Press F next to it'),
    ];
    this.ui.setObjectives(this.objectives);
  }

  complete(id, title) {
    const ob = this.objectives.find((x) => x.id === id);
    if (!ob || ob.done) return;
    ob.done = true;
    this.ui.setObjectives(this.objectives);
    this.ui.toast(title || ob.text, 'Objective complete');
    this.audio.play('chime');
  }

  // ── menu / state ────────────────────────────────────────────────────────
  wireMenu() {
    document.getElementById('btn-play').onclick = () => this.start();
    document.getElementById('btn-resume').onclick = () => this.pause(false);
    document.getElementById('btn-quit').onclick = () => {
      this.state = 'menu';
      this.ui.showPause(false); this.ui.showHud(false); this.ui.showMenu(true);
      this.input.exitLock();
    };
    document.querySelector('.about').insertAdjacentHTML('beforeend',
      `<p style="margin-top:14px;color:#7c8794;font-size:12px">${BEDROOM_COUNT} bedrooms · ${BATH_COUNT} bathrooms · 4 levels · everything below is generated at load time.</p>`);
  }

  start() {
    this.audio.init(); this.audio.resume();
    this.ui.showMenu(false);
    this.ui.showHud(true);
    this.state = 'play';
    this.input.requestLock();
    this.ui.toast('Welcome home', 'WASD to move · E to interact');
  }

  pause(v) {
    if (v && this.state === 'play') {
      this.state = 'pause';
      this.ui.showPause(true);
      this.input.exitLock();
    } else if (!v && this.state === 'pause') {
      this.state = 'play';
      this.ui.showPause(false);
      this.input.requestLock();
      this.audio.resume();
    }
  }

  // ── dialogue ────────────────────────────────────────────────────────────
  startDialogue(member) {
    this.dialogue = member;
    member.talking = true;
    this.player.dialogue = true;
    const kindFor = () => {
      const h = this.sky.time;
      if (h > 21 || h < 6) return 'night';
      const room = this.world.roomAt(member.char.pos);
      if (room?.type === 'kitchen' && member.spec.lines.kitchen) return 'kitchen';
      if (room?.type === 'court' && member.spec.lines.court) return 'court';
      if (member.spec.lines.pool && member.char.pos.z > 16 && member.char.pos.z < 30) return 'pool';
      return 'idle';
    };
    const show = (text) => {
      this.ui.showDialogue(member, text, [
        { label: 'Keep talking', action: () => { show(member.say(kindFor())); this.audio.play('ui'); } },
        {
          label: 'Give a hug',
          action: () => {
            member.char.playGesture('hug', 2.2);
            show(`${member.name} hugs you back.`);
            this.audio.play('ui');
            if (member.id === 'kaelie') this.complete('greet', 'Good morning, Kaelie');
            this.hugged = this.hugged || new Set();
            this.hugged.add(member.id);
            if (this.hugged.has('james') && this.hugged.has('chloie')) this.complete('kids');
          },
        },
        { label: 'What are you up to?', action: () => { show(`${member.name} is ${member.activity}.`); this.audio.play('ui'); } },
        { label: 'See you later', action: () => this.endDialogue() },
      ]);
    };
    member.char.playGesture('wave', 1.4);
    show(member.say(kindFor()));
    if (member.id === 'kaelie') this.complete('greet');
    this.metFamily = this.metFamily || new Set();
    this.metFamily.add(member.id);
    if (this.metFamily.has('james') && this.metFamily.has('chloie')) this.complete('kids');
    this.input.exitLock();
  }

  endDialogue() {
    if (this.dialogue) this.dialogue.talking = false;
    this.dialogue = null;
    this.player.dialogue = false;
    this.ui.hideDialogue();
    if (this.state === 'play') this.input.requestLock();
  }

  playPiano() {
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 659.25, 587.33, 523.25];
    notes.forEach((f, i) => this.audio.blip({ freq: f, type: 'triangle', dur: 0.5, gain: 0.05, at: i * 0.22 }));
    this.ui.toast('You play a few bars', 'Chloie claps from somewhere upstairs');
  }

  // ── loop ────────────────────────────────────────────────────────────────
  frame(dt) {
    this.time += dt;
    const playing = this.state === 'play';
    this.input.enabled = playing && !this.dialogue;

    if (playing) this.update(dt);
    else if (this.state === 'menu') this.updateMenuCamera(dt);

    for (const fn of this.world.updaters) fn(dt, this.time);
    this.engine.render(dt);
    this.input.endFrame();

    // fps readout
    this._frames++;
    this._fpsT += dt;
    if (this._fpsT > 0.5) {
      const info = this.engine.renderer.info.render;
      this.ui.setFps(`${Math.round(this._frames / this._fpsT)} fps\n${info.calls} calls · ${(info.triangles / 1000).toFixed(0)}k tris`);
      this._frames = 0; this._fpsT = 0;
    }
  }

  updateMenuCamera(dt) {
    const t = this.time * 0.06;
    const cam = this.engine.camera;
    cam.position.set(Math.sin(t) * 62, 16 + Math.sin(t * 0.7) * 4, Math.cos(t) * 62 + 8);
    cam.lookAt(0, 6, 0);
    if (this.sky) this.sky.update(dt, cam.position, 1);
    if (this.lights) this.lights.update(cam.position, this.sky.night);
    this.world.cameraPos = cam.position;
  }

  update(dt) {
    const P = this.player, W = this.world, inp = this.input;

    // global keys
    if (inp.hit('pause')) { this.dialogue ? this.endDialogue() : this.pause(true); }
    if (inp.hit('journal')) {
      this.journalOpen = !this.journalOpen;
      this.ui.showJournal(this.journalOpen);
      if (this.journalOpen) {
        this.ui.updateJournal(this.family, W, this.objectives, this.discovered);
        this.input.exitLock();
      } else this.input.requestLock();
    }
    if (inp.hit('photo')) this.ui.toggleHudVisibility();
    if (inp.hit('screenshot')) this.engine.screenshot(`home-${Date.now()}.png`);
    if (inp.mouse.wheel) this.sky.setTime(this.sky.time + inp.mouse.wheel * 0.5);

    // ── player ──
    P.update(dt);
    if (P.mode === 'drive' && P.vehicle) {
      updateVehicle(P.vehicle, W, dt, P.vehicleControls());
      const v = P.vehicle;
      this.audio.engine(v.engine.base + Math.abs(v.speed) * v.engine.rev * 6, clamp(Math.abs(v.speed) / v.maxSpeed, 0, 1));
      this.ui.setVehicle(v);
      if (inp.hit('vehicle')) { P.exitVehicle(); this.audio.stopEngine(); this.ui.setVehicle(null); }
      if (v === this.lambo && v.pos.distanceTo(v.home) > 45) this.complete('drive', 'You took the Lambo out');
    } else {
      this.ui.setVehicle(null);
      if (P.mode === 'sit' && (inp.hit('interact') || inp.hit('jump'))) P.stand();
    }
    P.syncCamera(dt);
    W.cameraPos = this.engine.camera.position;

    // ── footsteps ──
    if (P.mode === 'walk' && P.onGround && P.stepDistance - P.lastStep > (P.sprinting ? 2.1 : 1.55)) {
      P.lastStep = P.stepDistance;
      this.audio.play('step', { surface: this.surfaceUnder(), loud: P.sprinting });
    }
    if (P.landImpact > 0.25 && !this._landed) { this.audio.play('land'); this._landed = true; }
    if (P.landImpact < 0.05) this._landed = false;
    if (inp.hit('jump') && P.onGround && P.mode === 'walk') this.audio.play('jump');

    // water entry
    const wasWater = this._inWater;
    this._inWater = !!P.inWater;
    if (this._inWater && !wasWater) this.audio.play('splash');
    if (P.inWater?.name === 'pool') this.complete('swim', 'Nothing better than the pool');
    this.engine.setUnderwater(P.submerged);

    // ── interaction ──
    const target = this.dialogue ? null : this.interaction.pick();
    const label = this.interaction.labelFor(target);
    let sub = null;
    if (this.props.held) sub = 'Left click to throw · G to drop';
    else if (P.mode === 'sit') sub = 'E or Space to stand up';
    this.ui.setPrompt(this.dialogue ? null : label, this.dialogue ? null : sub);

    if (inp.hit('interact') && target && P.mode !== 'sit') {
      const sound = this.interaction.use(target, this);
      if (sound) this.audio.play(sound);
      if (target.kind === 'theater') this.complete('movie');
      if (target.kind === 'pc') this.complete('pc');
      if (target.kind === 'fire' && target.data?.on) this.complete('fire');
    }
    if (inp.hit('vehicle') && target?.kind === 'vehicle' && P.mode === 'walk') {
      this.interaction.use(target, this);
      this.audio.play('engine');
    }

    // held item
    if (this.props.held) {
      this.props.updateHeld(this.engine.camera, dt);
      if (inp.mouse.leftPressed) {
        const dir = this._tmp.set(0, 0, -1).applyQuaternion(this.engine.camera.quaternion);
        const power = this.props.held.tag === 'ball' ? 15 : this.props.held.tag === 'basketball' ? 10.5 : 9;
        const p = this.props.drop(dir.multiplyScalar(power).add(this._tmp2.set(0, 1.6, 0)));
        this.ui.setHeld(null);
        this.audio.play(p.tag === 'ball' ? 'roll' : 'swish');
        this.thrown = p;
      } else if (inp.hit('drop')) {
        this.props.drop(null);
        this.ui.setHeld(null);
      }
    }
    this.ui.setCrosshairWide(!!this.props.held);

    // ── props & scoring ──
    this.props.update(dt, (p, impact) => {
      if (p.tag === 'pin') this.audio.play('pin');
      else this.audio.play('bounce', { gain: clamp(impact / 8, 0.15, 1) });
    });
    this.checkBasket();
    for (const tag of W.pinTags || []) {
      if (this.props.countKnocked(tag) >= 10) this.complete('strike', 'Strike!');
    }
    // reset pins when you walk back to the approach
    for (const key of ['bowlingApproachA', 'bowlingApproachB']) {
      const s = W.spots[key];
      if (s && P.position.distanceTo(s.pos) < 1.6 && this._pinResetCooldown <= 0) {
        if (this.props.countKnocked(s.tag) > 0) {
          this.props.resetGroup(s.tag);
          this.props.resetGroup('ball');
          this.ui.toast('Pins reset', 'Rack them up');
          this._pinResetCooldown = 6;
        }
      }
    }
    this._pinResetCooldown = Math.max(0, (this._pinResetCooldown || 0) - dt);

    // skate bowl
    const bowl = W.spots.skateBowl;
    if (bowl && Math.hypot(P.position.x - bowl.pos.x, P.position.z - bowl.pos.z) < 5.6 && P.position.y < bowl.pos.y - 1.0) {
      this.complete('bowl', 'Dropped into the bowl');
    }

    // ── doors ──
    for (const d of W.doors) {
      d.t = damp(d.t, d.open ? 1 : 0, 7, dt);
      d.pivot.rotation.y = d.rotY + d.t * (Math.PI / 2) * (d.side === 'n' || d.side === 'w' ? 1 : -1);
    }

    // ── family, world, lights ──
    const hour = this.sky.time;
    for (const f of this.family) f.update(dt, this.time, hour, this.engine.camera.position);
    this.sky.update(dt, P.position, this.settings.timeScale);
    this.lights.update(this.engine.camera.position, this.sky.night);
    this.screenFx.update(dt, this.time);

    // vehicles idle
    for (const v of W.vehicles) if (!v.occupied) updateVehicle(v, W, dt, null);

    // ── HUD ──
    const room = W.roomAt(P.position);
    const place = room ? room.name : this.placeOutside(P.position);
    if (room && !this.discovered.has(room.name)) {
      this.discovered.add(room.name);
      this.ui.toast(room.name, room.floorName || 'Discovered');
    }
    this.ui.setClock(this.sky.clockString(), place);
    this.ui.setHeading(P.yaw);
    this.ui.drawMinimap(W, P, this.family);

    // ── audio bed ──
    const wf = W.spots.waterfall;
    this.audio.update(dt, {
      outside: !room,
      day: !this.sky.night,
      submerged: P.submerged,
      waterfallDistance: wf ? P.position.distanceTo(wf.pos) : 999,
    });

    // zoom
    const zoom = inp.mouse.right && P.mode !== 'drive';
    this.engine.camera.fov = damp(this.engine.camera.fov, zoom ? this.settings.fov * 0.62 : this.settings.fov, 12, dt);
    this.engine.camera.updateProjectionMatrix();
  }

  placeOutside(p) {
    const named = [
      ['Skate Park', 26, 62, 20], ['The Pond', -22, 48, 16], ['Waterfall', -22, 60, 12],
      ['Picnic Area', 22, 40, 12], ['Pool Terrace', 0, 22, 16], ['Hot Tub', 13.5, 22, 5],
      ['Garden Shed', -38, 26, 8], ['Front Drive', 6, -30, 28], ['Back Lawn', 0, 40, 40],
    ];
    let best = 'The Grounds', bd = Infinity;
    for (const [name, x, z, r] of named) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < r && d < bd) { bd = d; best = name; }
    }
    return best;
  }

  surfaceUnder() {
    const P = this.player;
    if (P.inWater) return 'water';
    const room = this.world.roomAt(P.position);
    if (!room) return P.position.y < 0.3 && Math.abs(P.position.x) < 40 && P.position.z < -12 ? 'concrete' : 'grass';
    const f = room.def?.floor || 'oakFloor';
    if (f === 'carpet' || f === 'theaterCarpet') return 'carpet';
    if (f === 'tile' || f === 'marble' || f === 'poolTile') return 'tile';
    if (f.includes('oncrete') || f === 'rubberFloor') return 'concrete';
    return 'wood';
  }

  checkBasket() {
    for (const p of this.props.list) {
      if (p.tag !== 'basketball' || p === this.props.held) continue;
      for (const h of this.world.hoops) {
        const above = p._above ?? {};
        const dx = p.pos.x - h.center.x, dz = p.pos.z - h.center.z;
        const near = Math.hypot(dx, dz) < h.r * 1.1;
        const key = `${h.center.x.toFixed(1)}`;
        if (near && p.pos.y > h.center.y && p.velocity.y < 0) { above[key] = true; }
        else if (near && p.pos.y < h.center.y - 0.1 && above[key]) {
          above[key] = false;
          this.complete('hoop', 'Swish');
          this.audio.play('swish');
          this.ui.toast('Bucket!', 'Nothing but net');
        } else if (!near) above[key] = false;
        p._above = above;
      }
    }
  }
}
