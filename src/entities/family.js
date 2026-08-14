// ───────────────────────────────────────────────────────────────────────────
// Kaelie, James and Chloie: who they are, where they go, and what they say.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Character } from './character.js';
import { findPath } from '../world/nav.js';
import { clamp, damp, makeRng } from '../core/rng.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const FAMILY = [
  {
    id: 'kaelie', name: 'Kaelie', role: 'Your wife', colorKey: 'k',
    height: 1.68, skin: 0xe8c0a4, hair: 0x5b3a26, hairStyle: 'long',
    shirt: 0xc96f8a, pants: 0x2f3a4a, shoes: 0xe4dbd0, build: 0.94,
    schedule: [
      [6, 'r_Kitchen', 'making coffee'],
      [8, 'r_Breakfast Sunroom', 'reading in the sun'],
      [10, 'r_Great Room', 'on a call by the fire'],
      [12, 'r_Kitchen', 'putting lunch together'],
      [14, 'out_terraceW', 'sitting on the terrace'],
      [16, 'r_Great Room', 'sorting the week out'],
      [18, 'r_Kitchen', 'starting dinner'],
      [20, 'r_Family Room', 'watching something with the kids'],
      [22, 'r_Master Bedroom', 'turning in'],
    ],
    lines: {
      idle: [
        'There you are. This house still surprises me some mornings.',
        'The mountains are unreal today — go look out the back windows.',
        'I love that we did the fireplace in stone. Best decision we made.',
        'Kids are somewhere. Probably a screen involved.',
      ],
      kitchen: ['Dinner in about an hour. Do not let James near the good pan.', 'Taste this.'],
      night: ['Long day. Come sit with me for a minute.'],
    },
  },
  {
    id: 'james', name: 'James', role: 'Your son, 11', colorKey: 'j',
    height: 1.42, skin: 0xecc7a8, hair: 0x3b2a1c, hairStyle: 'short',
    shirt: 0x2f6fb5, pants: 0x39424f, shoes: 0xd4463a, build: 0.86, headScale: 1.14,
    schedule: [
      [7, "r_James's Room", 'still waking up'],
      [9, 'r_Gaming Room', 'queued into a match'],
      [11, 'r_Basketball Court', 'shooting hoops'],
      [13, 'r_Kitchen', 'raiding the fridge'],
      [15, 'out_skate', 'dropping into the bowl'],
      [17, 'r_Bowling Alley', 'trying to beat his high score'],
      [19, 'r_Movie Theater', 'picking tonight\'s movie'],
      [21, 'r_Gaming Room', '"one more game"'],
      [22, "r_James's Room", 'supposed to be asleep'],
    ],
    lines: {
      idle: [
        'Dad! Watch this — I nearly landed a kickflip yesterday.',
        'Can we do movie night? I already picked one.',
        'I built a whole base in the game. It has a bowling alley too.',
        'Bet you can\'t beat me at HORSE.',
      ],
      court: ['Come on, first to five!', 'Check ball.'],
      night: ['Five more minutes. Please.'],
    },
  },
  {
    id: 'chloie', name: 'Chloie', role: 'Your daughter, 8', colorKey: 'c',
    height: 1.26, skin: 0xf0cdb0, hair: 0x8a5a34, hairStyle: 'ponytail',
    shirt: 0xdba0d8, pants: 0x6a5a8a, shoes: 0xf2f0ea, build: 0.82, headScale: 1.24,
    schedule: [
      [7, "r_Chloie's Room", 'reorganising her animals'],
      [9, 'out_pond', 'looking for frogs'],
      [11, 'out_pool', 'in the pool already'],
      [13, 'r_Kitchen', 'asking for snacks'],
      [15, 'out_picnic', 'colouring at the picnic table'],
      [17, 'r_Family Room', 'building a blanket fort'],
      [19, 'r_Movie Theater', 'saving the good seat'],
      [21, "r_Chloie's Room", 'reading with a torch'],
    ],
    lines: {
      idle: [
        'Daddy! There are THREE frogs in the pond. I named them.',
        'Can we go in the hot tub? Please please please.',
        'I drew the house. You are the tall one.',
        'The waterfall is my favourite part of the whole yard.',
      ],
      pool: ['Watch my cannonball!', 'The water is perfect.'],
      night: ['Can you read one more chapter?'],
    },
  },
];

export class FamilyMember {
  constructor(world, spec) {
    this.world = world;
    this.spec = spec;
    this.id = spec.id;
    this.name = spec.name;
    this.char = new Character(world, spec);
    this.rng = makeRng(spec.name.length * 977 + 13);
    this.path = [];
    this.target = null;
    this.activity = 'about the house';
    this.speed = 0;
    this.wantSpeed = spec.id === 'kaelie' ? 1.35 : 1.6;
    this.talking = false;
    this.wasTalking = false;
    this.lastLine = -1;
    this.idleTimer = 0;
    this.stuck = 0;

    const home = world.navIndex?.get(spec.schedule[0][1]);
    this.char.pos.copy(home ? home.pos : V(0, 0, 0));
    this.char.pos.y = home ? home.pos.y : 0;
    this.currentGoal = spec.schedule[0][1];
  }

  goalForTime(hour) {
    const s = this.spec.schedule;
    let pick = s[s.length - 1];
    for (const e of s) if (hour >= e[0]) pick = e;
    return pick;
  }

  setDestination(nodeName) {
    const node = this.world.navIndex?.get(nodeName);
    if (!node) return;
    this.path = findPath(this.world, this.char.pos, node.pos);
    this.target = node;
  }

  update(dt, t, hour, playerPos) {
    const c = this.char;
    // A conversation parks them where they stand; when it ends they need a
    // fresh route, or they would walk to the goal in a straight line.
    const justFinishedTalking = !this.talking && this.wasTalking;
    this.wasTalking = this.talking;

    if (!this.talking) {
      const [, goal, activity] = this.goalForTime(hour);
      this.activity = activity;
      if (goal !== this.currentGoal) {
        this.currentGoal = goal;
        this.setDestination(goal);
      } else if (justFinishedTalking) {
        this.setDestination(this.currentGoal);
      } else if (!this.path.length) {
        // wander a little around the destination
        this.idleTimer -= dt;
        if (this.idleTimer <= 0) {
          this.idleTimer = this.rng.range(5, 13);
          const node = this.world.navIndex?.get(goal);
          if (node) {
            // a tight wander keeps them out of the kitchen island and other
            // furniture parked near room centres
            const p = node.pos.clone();
            p.x += this.rng.range(-1.5, 1.5);
            p.z += this.rng.range(-1.5, 1.5);
            this.path = [p];
          }
        }
      }
    } else {
      this.path.length = 0;      // hold position while talking
    }

    // follow the path
    let moving = false;
    if (this.path.length) {
      const wp = this.path[0];
      const dx = wp.x - c.pos.x, dz = wp.z - c.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.45) {
        this.path.shift();
      } else {
        moving = true;
        const want = Math.atan2(dx, dz);
        c.heading = angleDamp(c.heading, want, 7, dt);
        this.speed = damp(this.speed, this.wantSpeed, 5, dt);
        const step = Math.min(this.speed * dt, d);
        c.pos.x += Math.sin(c.heading) * step;
        c.pos.z += Math.cos(c.heading) * step;
        c.pos.y = damp(c.pos.y, wp.y, 6, dt);
      }
    }
    if (!moving) this.speed = damp(this.speed, 0, 8, dt);
    c.speed = this.speed;

    // look at the player when close
    const dp = c.pos.distanceTo(playerPos);
    c.lookAt = dp < 7 ? playerPos : null;
    if (this.talking) c.lookAt = playerPos;

    c.update(dt, t, playerPos);
  }

  say(kind = 'idle') {
    const pool = this.spec.lines[kind] || this.spec.lines.idle;
    let i = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && i === this.lastLine) i = (i + 1) % pool.length;
    this.lastLine = i;
    return pool[i];
  }
}

function angleDamp(a, b, lambda, dt) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * (1 - Math.exp(-lambda * dt));
}

export function createFamily(world) {
  return FAMILY.map((spec) => new FamilyMember(world, spec));
}

/**
 * Keep the family out of each other's shoes: the schedule regularly sends two
 * of them to the same node (movie night, lunch), and without a separation
 * pass they end up standing inside one another.
 */
export function separateFamily(members) {
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i].char.pos, b = members[j].char.pos;
      if (Math.abs(a.y - b.y) > 1.5) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const MIN = 0.62;
      if (d >= MIN || d < 1e-4) continue;
      const push = (MIN - d) / 2;
      const nx = dx / d, nz = dz / d;
      a.x -= nx * push; a.z -= nz * push;
      b.x += nx * push; b.z += nz * push;
    }
  }
}
