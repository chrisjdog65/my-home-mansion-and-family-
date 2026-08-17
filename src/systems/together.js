// ───────────────────────────────────────────────────────────────────────────
// Doing things together.
//
// The family have their own day, but the point of the house is the people in
// it — so you can ask any of them to come and do something with you. An
// activity sends them to a place, waits for you both to get there, runs for a
// while, and leaves you a little closer than you were.
//
// Each entry is: who can be asked, when it makes sense, where it happens, and
// what the two of you actually do when you arrive.
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const ACTIVITIES = [
  {
    id: 'drive', label: 'Go for a drive', ask: 'Fancy a drive?',
    who: ['kaelie', 'james', 'chloie'],
    node: 'out_drive', spot: 'driveway', opts: { pose: 'stand' },
    meet: 'Meet {name} on the front drive',
    yes: { kaelie: "Go on then. You're driving.", james: 'Can we take the loud one?', chloie: 'Shotgun! Wait — can I say shotgun?' },
    // she gets in when you do; the activity runs while the car is moving
    ride: true,
    doing: 'out for a drive with you',
    done: { kaelie: 'That was nice. We should do that more often.', james: 'That was SO fast.', chloie: 'I saw a deer. I definitely saw a deer.' },
  },
  {
    id: 'bowl', label: 'Go bowling downstairs', ask: 'Two games, best of three?',
    who: ['kaelie', 'james', 'chloie'],
    node: 'r_Bowling Alley', spot: 'bowlingAlley', opts: { pose: 'stand', tag: 'bowling' },
    meet: 'Meet {name} at the bowling alley',
    yes: { kaelie: "I'll beat you. I always beat you.", james: "I'm using the heavy one.", chloie: 'I get the bumpers!' },
    stay: 90, beat: 'swing', beatEvery: 9,
    doing: 'bowling with you',
    done: { kaelie: 'Told you.', james: 'Rematch. Right now.', chloie: 'I got THREE down that time!' },
  },
  {
    id: 'movie', label: 'Watch a film in the theater', ask: 'Movie night?',
    who: ['kaelie', 'james', 'chloie'],
    node: 'r_Movie Theater', spot: 'theaterSeat', opts: { pose: 'lounge', tag: 'movie' },
    meet: 'Meet {name} in the theater',
    yes: { kaelie: "I'll bring something to drink.", james: 'I already know what we\'re watching.', chloie: 'The good seat is MINE.' },
    stay: 120, needs: 'theater',
    doing: 'watching a film with you',
    done: { kaelie: 'That was lovely. Do not tell me you were asleep.', james: 'The ending was better the second time.', chloie: 'I liked the bit with the horse.' },
  },
  {
    id: 'swim', label: 'Go for a swim', ask: 'Pool?',
    who: ['kaelie', 'james', 'chloie'],
    node: 'out_pool', spot: 'poolWater', opts: { pose: 'swim', tag: 'pool' },
    meet: 'Meet {name} at the pool', day: [8, 20],
    yes: { kaelie: 'Give me two minutes.', james: 'Bombing. Obviously.', chloie: 'YES. Watch my cannonball!' },
    stay: 90,
    doing: 'swimming with you',
    done: { kaelie: 'That water is perfect this time of day.', james: 'Did you see that one? Did you?', chloie: 'My fingers went all wrinkly.' },
  },
  {
    id: 'hottub', label: 'Sit in the hot tub', ask: 'Hot tub, ten minutes?',
    who: ['kaelie'],
    node: 'out_hottub', spot: 'hotTub', opts: { pose: 'sit', tag: 'hottub' },
    meet: 'Meet Kaelie at the hot tub', day: [16, 24],
    yes: { kaelie: 'Now that is a good idea.' },
    stay: 120,
    doing: 'sitting in the hot tub with you',
    done: { kaelie: 'I could stay out here all night. Look at those stars.' },
  },
  {
    id: 'picnic', label: 'Hang out at the picnic area', ask: 'Sit outside for a bit?',
    who: ['kaelie', 'james', 'chloie'],
    // the bench is 2.5 cm taller than a dining chair, so lift them onto it
    node: 'out_picnic', spot: 'picnicSeatA', opts: { pose: 'dine', tag: 'picnic', dy: 0.03 },
    meet: 'Meet {name} at the picnic table', day: [8, 20],
    yes: { kaelie: 'Grab the blanket, it gets cold up here.', james: 'Only if we can eat outside.', chloie: 'Can I bring my drawing things?' },
    stay: 100,
    doing: 'sitting outside with you',
    done: { kaelie: 'This is my favourite spot on the whole property.', james: 'We should camp out here.', chloie: 'I drew the mountains. And you.' },
  },
  {
    id: 'cook', label: 'Cook something together', ask: 'Give me a hand with dinner?',
    who: ['kaelie', 'james', 'chloie'],
    node: 'r_Kitchen', spot: 'cookA', opts: { pose: 'work', tag: 'cooking' },
    meet: 'Meet {name} in the kitchen',
    yes: { kaelie: "You're chopping, I'm doing the rest.", james: 'Can I do the fire bit?', chloie: 'I want to stir!' },
    stay: 110, beat: 'stir', beatEvery: 5, dinner: true,
    doing: 'cooking with you',
    done: { kaelie: "That's dinner. Call the others.", james: 'I did most of that.', chloie: 'I stirred it the WHOLE time.' },
  },
  {
    id: 'hoops', label: 'Shoot some hoops', ask: 'First to five?',
    who: ['james', 'kaelie'],
    node: 'r_Basketball Court', spot: 'court', opts: { pose: 'shoot', tag: 'court' },
    meet: 'Meet {name} on the court',
    yes: { james: 'Check ball.', kaelie: 'I will regret this, but fine.' },
    stay: 90, beat: 'shoot', beatEvery: 6,
    doing: 'playing basketball with you',
    done: { james: 'Best of five. Come on.', kaelie: 'My shoulder. Do not laugh.' },
  },
  {
    id: 'frogs', label: 'Go and look for frogs', ask: 'Shall we go and find those frogs?',
    who: ['chloie'],
    node: 'out_pond', spot: 'pond', opts: { pose: 'crouch', tag: 'pond' },
    meet: 'Meet Chloie at the pond', day: [8, 19],
    yes: { chloie: 'I KNEW you would say yes.' },
    stay: 90, beat: 'point', beatEvery: 7,
    doing: 'frog hunting with you',
    done: { chloie: 'That is four. Four frogs. They all have names now.' },
  },
  {
    id: 'homework', label: 'Help with homework', ask: 'Come on, let\'s get it done.',
    who: ['james', 'chloie'],
    node: null,                              // resolved per child, below
    opts: { pose: 'homework', tag: 'homework' },
    meet: 'Sit with {name} at their desk',
    yes: { james: 'Fine. But only the maths.', chloie: 'Can you do the spellings with me?' },
    stay: 110, beat: 'write', beatEvery: 3,
    doing: 'doing homework with you',
    done: { james: "Done. That wasn't as bad as I said it was.", chloie: 'I got all my spellings right!' },
    bond: 2,
  },
  {
    id: 'skate', label: 'Come to the skate park', ask: 'Show me what you\'ve got.',
    who: ['james'],
    node: 'out_skate', spot: 'skatepark', opts: { pose: 'stand', tag: 'skate' },
    meet: 'Meet James at the skate park', day: [8, 20],
    yes: { james: 'Watch this. Actually watch, this time.' },
    stay: 90, beat: 'cheer', beatEvery: 8,
    doing: 'skating with you',
    done: { james: 'I nearly landed it. You saw. That was nearly.' },
  },
];

/** The nav node an activity uses for a particular person. */
export function nodeFor(act, member) {
  if (act.id === 'homework') return member.id === 'james' ? "r_James's Room" : "r_Chloie's Room";
  return act.node;
}
export function spotFor(act, member) {
  if (act.id === 'homework') return member.id === 'james' ? 'jamesDesk' : 'chloieDesk';
  return act.spot;
}

/** Which activities make sense for this person, right now. */
export function offeredTo(game, member) {
  const h = game.sky.time;
  return ACTIVITIES.filter((a) => {
    if (!a.who.includes(member.id)) return false;
    if (a.day && (h < a.day[0] || h > a.day[1])) return false;
    if (a.id === 'homework' && (h < 15 || h > 20)) return false;
    return true;
  });
}

// ───────────────────────────────────────────────────────────────────────────
export class Together {
  constructor(game) {
    this.game = game;
    this.activities = ACTIVITIES;
    this.current = null;      // { act, member, phase, timer }
    this._v = new THREE.Vector3();
  }

  /** What this person could be asked to do right now. */
  offered(member) { return offeredTo(this.game, member); }

  /** The place an activity would happen, for anyone who needs to know. */
  placeOf(act, member) {
    return this.game.world.spots[spotFor(act, member)] || this.game.world.navIndex?.get(nodeFor(act, member));
  }

  /** Where the pair are meeting, for the HUD tracker. */
  get where() {
    const c = this.current;
    if (!c) return null;
    const s = this.game.world.spots[spotFor(c.act, c.member)];
    return s ? s.pos : c.member.char.pos;
  }

  start(act, member) {
    this.cancel(false);
    const node = nodeFor(act, member);
    const opts = { ...act.opts, spot: spotFor(act, member) };
    member.sendTo(node, opts, act.doing);
    member.char.setMood?.('happy');
    this.current = { act, member, phase: 'travel', timer: 0, ran: 0 };
    this.game.ui.toast(`${member.name} is coming`, act.meet.replace('{name}', member.name));
  }

  cancel(say = true) {
    const c = this.current;
    if (!c) return;
    if (c.member.riding) { c.member.riding = null; }
    c.member.clearPlan();
    c.member.char.setMood?.('neutral');
    if (say) this.game.ui.toast(`${c.member.name} heads off`, 'Maybe another time');
    this.current = null;
  }

  update(dt) {
    const c = this.current;
    if (!c) return;
    const g = this.game, P = g.player, m = c.member;
    const spot = g.world.spots[spotFor(c.act, m)];
    const here = spot ? spot.pos : m.char.pos;

    // ── getting there ──
    if (c.phase === 'travel') {
      const playerClose = P.position.distanceTo(here) < 6.5;
      const theirsClose = m.atPlan || m.char.pos.distanceTo(here) < 2.5;
      // a drive starts the moment you are both in the car
      if (c.act.ride && P.mode === 'drive' && P.vehicle && m.char.pos.distanceTo(P.vehicle.pos) < 6) {
        m.riding = P.vehicle;
        c.phase = 'doing';
        g.ui.toast(`${m.name} gets in`, 'Take her out — the drive loops past the gate');
        return;
      }
      if (playerClose && theirsClose) {
        c.phase = 'doing';
        g.ui.toast(`${c.act.label}`, `With ${m.name}`);
        m.char.playGesture?.('nod', 1.2);
      }
      return;
    }

    // ── doing it ──
    c.ran += dt;
    c.timer -= dt;
    if (c.timer <= 0 && c.act.beat) {
      c.timer = c.act.beatEvery || 8;
      m.char.playGesture?.(c.act.beat, 2.0);
    }

    if (c.act.ride) {
      // finished when you park up again
      if (P.mode !== 'drive') {
        m.riding = null;
        if (c.ran > 12) this.finish();
        else { c.phase = 'travel'; }
      }
      return;
    }

    // wandered off?
    if (P.position.distanceTo(here) > 14 && c.ran > 4) { this.cancel(); return; }
    if (c.ran >= (c.act.stay || 90)) this.finish();
  }

  finish() {
    const c = this.current;
    if (!c) return;
    const g = this.game, m = c.member;
    const line = (c.act.done && c.act.done[m.id]) || 'That was good.';
    g.ui.toast(`${m.name}: “${line}”`, c.act.label);
    g.addBond(m.id, c.act.bond || 1);
    m.char.playGesture?.('applaud', 1.4);
    if (c.act.dinner) g.callFamilyToDinner();
    if (c.act.needs === 'theater') { /* the projector is the player's to start */ }
    m.riding = null;
    m.clearPlan();
    m.char.setMood?.('happy');
    this.current = null;
    g.persist();
  }
}
