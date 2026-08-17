// ───────────────────────────────────────────────────────────────────────────
// Kaelie, James and Chloie: who they are, where they go, what they do when
// they get there, and what they say about it.
//
// A schedule entry is [hour, navNode, activity, opts] where opts describes the
// *activity itself* — which spot in the room to stand on, which way to face,
// which pose to hold and which gesture to play now and then.  Without that
// last part they walk to the middle of a room and stand there like furniture.
//
//   spot   named world spot to finish on (falls back to the nav node)
//   off    [dx, dz] from that spot — one cushion over, the far bench
//   dy/y   height offset / absolute height (theatre tiers, the pool)
//   face   heading in radians; otherwise the spot's rotY, or whatever it
//          is pointing at (a hoop), or the direction they walked in from
//   pose   a Character pose: sit, desk, lie, swim, work, lean, floor…
//   beat   a gesture played every `every` seconds while they are there
//   tag    which pocket of dialogue this activity unlocks
// ───────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Character } from './character.js';
import { findPath } from '../world/nav.js';
import { clamp, damp, makeRng } from '../core/rng.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const N = Math.PI;          // shorthand for the facings below

export const FAMILY = [
  {
    id: 'kaelie', name: 'Kaelie', role: 'Your wife', colorKey: 'k',
    height: 1.68, skin: 0xe8c0a4, hair: 0x5b3a26, hairStyle: 'long',
    shirt: 0xc96f8a, pants: 0x2f3a4a, shoes: 0xe4dbd0, build: 0.94,
    // face: green-hazel eyes, a narrow face, a dry half-smile
    outfit: 'dress', eyeColor: 0x5f7d5c, faceWidth: 0.96, faceRound: 0.98,
    browAngle: 0.17, noseSize: 0.92, smile: 0.34, lashes: true,
    lipColor: 0xbe7a74, laces: 0xe8e2d6,
    schedule: [
      [6, 'r_Kitchen', 'making coffee',
        { spot: 'kitchen', off: [-2.0, 3.5], face: 0, pose: 'work', tag: 'coffee', beat: 'stir', every: 7 }],
      [7.5, 'r_Kitchen', 'putting breakfast out',
        { spot: 'kitchenIsland', face: 0, pose: 'work', tag: 'breakfast', beat: 'stir', every: 9 }],
      [8.5, 'r_Breakfast Sunroom', 'reading in the sun',
        { spot: 'sunroom', off: [-0.81, 1.41], face: 2.36, pose: 'read', tag: 'reading' }],
      [10, 'r_Great Room', 'on a call by the fire',
        { spot: 'fireplaceSeat', off: [0.7, 0], face: N, pose: 'sit', tag: 'call' }],
      [11.5, 'r_Library & Study', 'sorting the week out',
        { spot: 'library', off: [0.4, 2.0], face: N, pose: 'desk', tag: 'desk' }],
      [12.5, 'r_Kitchen', 'putting lunch together',
        { spot: 'kitchen', off: [-2.0, 3.5], face: 0, pose: 'work', tag: 'lunch', beat: 'stir', every: 6 }],
      [13.25, 'r_Dining Hall', 'sitting down to lunch',
        { spot: 'dining', off: [-1.1, -2.85], face: 0, pose: 'sit', tag: 'table' }],
      [14.5, 'out_terraceW', 'sitting out on the terrace',
        { spot: 'terrace', off: [-1.6, -2], face: -N / 2, pose: 'sit', tag: 'terrace' }],
      [16, 'out_poollounge', 'watching Chloie swim',
        { off: [0, -1.8], face: N / 2, pose: 'lounge', tag: 'poolside' }],
      [17, 'r_Laundry & Mud', 'folding the washing',
        { spot: 'laundry', off: [-1.4, -3.8], face: -N / 2, pose: 'work', tag: 'laundry', beat: 'stir', every: 8 }],
      [18, 'r_Kitchen', 'starting dinner',
        { spot: 'kitchen', off: [1.8, 3.5], face: 0, pose: 'work', tag: 'dinner', beat: 'stir', every: 5 }],
      [19.5, 'r_Dining Hall', 'getting everyone to the table',
        { spot: 'dining', off: [-1.1, -2.85], face: 0, pose: 'sit', tag: 'table' }],
      [20.5, 'r_Family Room', 'watching something with the kids',
        { spot: 'familyRoom', off: [0.4, 0.8], face: N, pose: 'lounge', tag: 'watching' }],
      [21.75, 'r_Master Bedroom', 'reading before bed',
        { off: [0.8, -3.6], face: 0, pose: 'sit', tag: 'bed' }],
      [22.75, 'r_Master Bedroom', 'asleep',
        { off: [0, -4.3], face: 0, pose: 'lie', tag: 'asleep' }],
    ],
    lines: {
      idle: [
        'There you are. This house still surprises me some mornings.',
        'The mountains are unreal today — go and look out the back windows.',
        'I love that we did the fireplace in stone. Best decision we made.',
        'Kids are somewhere. Probably a screen involved.',
        "You've got that look. What did you break?",
        'Twelve bedrooms and we all still end up in the same room.',
        "I found James's socks in the bowling alley. I've stopped asking.",
        'Come here a minute. You look like you need five minutes of nothing.',
        'Chloie has renamed the frogs again. There is a hierarchy now.',
        'If you go past the shed, the good secateurs are still out there.',
        'Blanket weather. Which is half the reason I like this time of year.',
        'Whatever you are about to suggest — yes, but after dinner.',
        'The valley had frost on it this morning. Properly autumn now.',
      ],
      morning: [
        'Morning. Coffee is on, and it is strong for a reason.',
        'The light in this valley at seven. Honestly.',
        'Nobody is up yet. Fifteen minutes of quiet, then it starts.',
        'Did you sleep? You were still awake when I gave up on you.',
      ],
      midday: [
        'Lunch is whatever people can carry. It is that kind of day.',
        "Half the day gone and I've achieved a load of towels.",
        'Take those two outside for an hour. Please.',
      ],
      evening: [
        'Dinner in about an hour. Do not let James near the good pan.',
        'Pour something. You have earned it, or you will have by the time you sit.',
        'Everyone at the table tonight. I have said it, so it is law.',
        'Look at that light on the ridge. That is the whole reason we are here.',
      ],
      night: [
        'Long day. Come and sit with me for a minute.',
        'They are both still awake. I can hear James negotiating.',
        'Lock the terrace door if you go past it.',
        'Leave the hall light on. Chloie still checks.',
        'Bed. The mountains will still be there tomorrow.',
      ],
      kitchen: [
        'Dinner in about an hour. Do not let James near the good pan.',
        'Taste this.',
        'Pass me the good knife — the one you keep putting in the wrong drawer.',
        'If you are going to eat standing over the sink, at least sit down.',
      ],
      court: [
        'I have watched about four hundred free throws today.',
        'Go on, play him. He needs someone who might actually beat him.',
      ],
      pool: [
        "The water is warmer than it looks. Ask Chloie, she's been in since ten.",
        'I am not swimming. I am supervising, which is harder.',
      ],
      outside: [
        'Smell that. That is the whole reason we moved out here.',
        'The grass wants cutting, and it is not going to be me.',
        'Come and see the light on the ridge before it goes.',
      ],
      rooms: {
        'Great Room': [
          'This room in the evening with the fire going — that is the whole house.',
          'The piano is out of tune again. Nobody admits to playing it.',
        ],
        'Breakfast Sunroom': [
          'Best seat in the house before nine.',
          'I could sit in here all day and call it work.',
        ],
        'Family Room': [
          'Fort season. Do not sit on the grey cushion, it is load-bearing.',
          'This is where everyone actually ends up.',
        ],
        'Dining Hall': [
          'Sit down properly. We never use this room and it is a beautiful room.',
          'Everyone at the table. Yes, everyone.',
        ],
        'Library & Study': [
          'Ten minutes and the week will be sorted.',
          'Half these books came with the house. Some of them are wonderful.',
        ],
        'Master Bedroom': [
          'The view from this bed still gets me.',
          'Shut the door. Two minutes of nobody needing anything.',
        ],
        'Movie Theater': [
          'Whatever they picked, I am asleep by the second act.',
          'I like this bit. Do not talk.',
        ],
        'Laundry & Mud': [
          'Nine people worth of washing and there are four of us.',
          'Whose is this? It is not any of ours.',
        ],
        'Bowling Alley': ['I hold the house record and I intend to keep it.'],
        'Home Gym': ['Twenty minutes, then I stop pretending.'],
        'Grand Foyer': ['Somebody has left shoes in the middle of the hall again.'],
        'Basketball Court': ['If a ball comes through the ceiling I am blaming you.'],
      },
      doing: {
        coffee: [
          'First cup. Do not talk to me about anything structural yet.',
          'Two minutes and there is one for you.',
        ],
        breakfast: [
          'Eat something before you go anywhere.',
          "James has had cereal three times. That's not breakfast, that's a hobby.",
        ],
        reading: [
          'Ten more pages and I am all yours.',
          'This one is very sad and I am enjoying it enormously.',
        ],
        call: ['One minute — I am nearly off.', 'Work. It can keep.'],
        desk: ['Bills, calendar, the school thing. Riveting.', 'I am making a list. You are on it.'],
        lunch: ['Sandwiches. Ambitious, I know.'],
        table: ['Sit down with me. Five minutes.', 'Somebody has to eat this while it is hot.'],
        terrace: ['Sit. The view does the rest.', 'This is my favourite hour out here.'],
        poolside: [
          'She has done that cannonball eleven times and I have watched all eleven.',
          'I am staying dry. That is the whole plan.',
        ],
        laundry: ['If you want a clean shirt for tomorrow, now is the moment to say.'],
        dinner: [
          'Twenty minutes. Do not let anyone start on the bread.',
          'Taste that and tell me it needs salt. It needs salt.',
        ],
        watching: ['They picked it. I am here for the company.', 'Sit down, you are in the screen.'],
        bed: ['Two chapters, then the light goes off. Mine, not yours.'],
        asleep: ['Mm. Come to bed.', 'What time is it? No — do not tell me.'],
      },
      seen: {
        fire: [
          'You lit it. That is the evening decided, then.',
          'The fire makes this whole room. Well done, you.',
        ],
        movie: ['The theater is on downstairs. I suppose we are all going down.'],
        pc: ['Somebody left a machine running. Oh. It was you.'],
      },
    },
  },
  {
    id: 'james', name: 'James', role: 'Your son, 11', colorKey: 'j',
    height: 1.42, skin: 0xecc7a8, hair: 0x3b2a1c, hairStyle: 'short',
    shirt: 0x2f6fb5, pants: 0x39424f, shoes: 0xd4463a, build: 0.86, headScale: 1.14,
    // his mother's jaw, freckles across the nose, hazel eyes between the two
    outfit: 'tee', eyeColor: 0x6d5c3a, faceWidth: 1.02, faceRound: 1.12,
    browAngle: 0.07, noseSize: 0.88, smile: 0.3, freckles: true, lashes: false,
    laces: 0xf6f4ee,
    schedule: [
      [7, "r_James's Room", 'still asleep', { off: [0, 4.3], face: N, pose: 'lie', tag: 'wake' }],
      [7.75, "r_James's Room", "hunting for yesterday's socks",
        { off: [0, 1.2], pose: 'crouch', tag: 'room', beat: 'point', every: 9 }],
      [8.5, 'r_Kitchen', 'inhaling cereal',
        { spot: 'kitchen', off: [0, -0.45], face: N, pose: 'perch', tag: 'cereal' }],
      [9.5, 'r_Gaming Room', 'queued into a match',
        { spot: 'gaming0', pose: 'desk', tag: 'game' }],
      [11, 'r_Basketball Court', 'shooting hoops',
        { spot: 'hoopWest', pose: 'shoot', tag: 'hoops', beat: 'shoot', every: 4.5 }],
      [12.5, 'r_Kitchen', 'raiding the fridge',
        { spot: 'kitchen', off: [3.4, 3.2], face: 0, pose: 'lean', tag: 'raid' }],
      [13.5, 'r_Dining Hall', 'at the table, mostly',
        { spot: 'dining', off: [-0.37, -2.85], face: 0, pose: 'sit', tag: 'table' }],
      [14.5, 'out_skate', 'dropping into the bowl',
        { spot: 'skatepark', pose: 'stand', tag: 'skate', beat: 'cheer', every: 8 }],
      [16, 'r_Bowling Alley', 'trying to beat his high score',
        { spot: 'bowlingApproachA', pose: 'stand', tag: 'bowl', beat: 'swing', every: 6 }],
      [17.5, 'out_lawn', 'kicking a ball about the lawn',
        { pose: 'stand', tag: 'ball', beat: 'cheer', every: 7 }],
      [19, 'r_Movie Theater', "picking tonight's movie",
        { spot: 'theaterSeat', off: [0, 0.6], dy: 0.4, pose: 'lounge', tag: 'movie' }],
      [21, 'r_Gaming Room', '"one more game"',
        { spot: 'gaming0', pose: 'desk', tag: 'game' }],
      [22, "r_James's Room", 'supposed to be asleep',
        { off: [0, 4.3], face: N, pose: 'lie', tag: 'bed' }],
    ],
    lines: {
      idle: [
        'Dad! Watch this — I nearly landed a kickflip yesterday.',
        'Can we do movie night? I already picked one.',
        'I built a whole base in the game. It has a bowling alley too.',
        "Bet you can't beat me at HORSE.",
        'Did you know a hoop is exactly ten feet? I measured ours. It is.',
        'Chloie put a frog in a bucket and named it after me. I said thanks.',
        'The Lambo is faster but the truck can go anywhere. So it depends.',
        'Can I have a snack? I already had one. Can I have another one?',
        "I'm going to be really tall. Taller than you, probably.",
        'One time I bowled a strike with my eyes shut. You were not there.',
        'If I clean my room can I stay up? What if I half clean it?',
        'Race you to the pool. Go — I said go!',
        'It gets dark so early now. That is basically more evening.',
      ],
      morning: [
        'Five more minutes. Five real minutes.',
        'It is not a school day. Tell me it is not a school day.',
        'I dreamed I could dunk and it felt completely real.',
      ],
      midday: [
        'Can we go outside? Everyone is inside and it is weird.',
        'I ate already. I might eat again though.',
      ],
      evening: [
        'Movie night movie night movie night.',
        'One more game and then I will do it. Promise.',
        'Can I stay up? It is basically the weekend.',
      ],
      night: [
        'Five more minutes. Please.',
        'I am not even tired. That is just a fact.',
        'Can I read with the torch? Chloie gets to.',
      ],
      kitchen: [
        'Is there anything? There is never anything.',
        'Can I make a sandwich? A big one?',
        'I can reach the top shelf now. Watch.',
      ],
      court: [
        'Come on, first to five!',
        'Check ball.',
        'That was in. That was so in.',
        'Watch this one. Okay — watch this one.',
      ],
      pool: [
        'Cannonball! Move, move, move.',
        'The deep end is like nine feet. I touched the bottom once.',
      ],
      outside: [
        'The bowl is so fast today.',
        'I found a stick that is basically a sword.',
        'Can we camp out here? Just once?',
      ],
      rooms: {
        "James's Room": [
          'My room is not messy, it is organised by where things landed.',
          'This is my base. You can come in, though.',
        ],
        'Gaming Room': [
          'I am so close to the next rank. So close.',
          'You can be player two. You will be bad at it, but you can.',
        ],
        'Bowling Alley': [
          'My high score is 142. Okay, 138. I rounded.',
          'You get one throw. Make it count.',
        ],
        'Movie Theater': [
          'I picked the one with the big ship in it.',
          'The best bit is coming. Do not blink.',
        ],
        'Home Gym': ['I can do eight press-ups. Eight!'],
        'Great Room': ['Am I allowed to slide on this floor? In socks?'],
        'Family Room': ['We are building a fort. You can be in it if you help.'],
        'Garage': ['When I am seventeen, that one. The yellow one.'],
        'Kitchen': ['Is there anything? There is never anything.'],
      },
      doing: {
        wake: ['Five more minutes. Five real ones.', 'Is it morning morning?'],
        room: ['I am looking for a sock. It is definitely in here.'],
        cereal: ['I had three bowls. Two. It was two.'],
        game: ['I am so close to the next rank.', 'Do not talk for one second — okay, now.'],
        hoops: ['First to five, come on!', 'Watch this one. Okay, watch this one.'],
        raid: ['I am just looking. Looking is allowed.'],
        table: ['Can I be excused? I ate loads.'],
        skate: ['I nearly landed it. Did you see? I nearly landed it.'],
        bowl: ['If I get this spare I win. I probably win.'],
        ball: ['Go long! Dad, go long!'],
        movie: ['I picked the one with the ship. It is so good.'],
        bed: ['I am not asleep. I am resting my eyes with a torch.'],
      },
      seen: {
        pc: ['You booted the rig! Are you playing? Can I watch?'],
        movie: ['The theater is ON. I am getting the good seat.'],
        fire: ['The fire is going! Can we do marshmallows? Inside?'],
      },
    },
  },
  {
    id: 'chloie', name: 'Chloie', role: 'Your daughter, 8', colorKey: 'c',
    height: 1.26, skin: 0xf0cdb0, hair: 0x8a5a34, hairStyle: 'ponytail',
    shirt: 0xdba0d8, pants: 0x6a5a8a, shoes: 0xf2f0ea, build: 0.82, headScale: 1.24,
    // her mother's eyes exactly, a very round face, permanently delighted
    outfit: 'skirt', eyeColor: 0x5f7d5c, faceWidth: 1.05, faceRound: 1.26,
    browAngle: 0.04, noseSize: 0.78, smile: 0.52, freckles: true, lashes: true,
    lipColor: 0xc9827c, laces: 0xf6d4ea,
    schedule: [
      [7, "r_Chloie's Room", 'still asleep, mostly', { off: [0, 4.3], face: N, pose: 'lie', tag: 'asleep' }],
      [8, "r_Chloie's Room", 'reorganising her animals',
        { off: [-0.75, -0.1], pose: 'floor', tag: 'animals', beat: 'clap', every: 8 }],
      [9, 'out_pond', 'looking for frogs',
        { spot: 'pond', pose: 'crouch', tag: 'frogs', beat: 'point', every: 6 }],
      [10.5, 'out_poolwater', 'in the pool already',
        { y: -0.75, off: [1, 0.4], pose: 'swim', tag: 'swim' }],
      [12.5, 'r_Kitchen', 'asking for snacks',
        { spot: 'kitchen', off: [0, 1.2], face: 0, pose: 'stand', tag: 'snack', beat: 'point', every: 9 }],
      [13.25, 'r_Dining Hall', 'kneeling on her chair at lunch',
        { spot: 'dining', off: [-1.1, -0.75], face: N, pose: 'sit', tag: 'table' }],
      [14.5, 'out_picnic', 'colouring at the picnic table',
        { spot: 'picnic', off: [-1.35, 3], face: -N / 2, pose: 'desk', tag: 'colouring' }],
      [16, 'out_waterfall', 'building a fairy house by the falls',
        { spot: 'waterfall', pose: 'crouch', tag: 'fairy', beat: 'point', every: 7 }],
      [17.5, 'r_Family Room', 'building a blanket fort',
        // on the rug, west of the coffee table and clear of the sofa
        { spot: 'familyRoom', off: [-1.8, 0.4], pose: 'floor', tag: 'fort', beat: 'clap', every: 7 }],
      [19, 'r_Movie Theater', 'saving the good seat',
        { spot: 'theaterSeat', off: [0, -0.8], dy: 0.4, pose: 'sit', tag: 'movie' }],
      [21, "r_Chloie's Room", 'reading with a torch',
        { off: [0, 3.6], face: N, pose: 'sit', tag: 'read' }],
      [22, "r_Chloie's Room", 'asleep with the light on', { off: [0, 4.3], face: N, pose: 'lie', tag: 'asleep' }],
    ],
    lines: {
      idle: [
        'Daddy! There are THREE frogs in the pond. I named them.',
        'Can we go in the hot tub? Please please please.',
        'I drew the house. You are the tall one.',
        'The waterfall is my favourite part of the whole entire yard.',
        'I can do a handstand for four seconds. Nearly five.',
        'My animals are in a line by height. It took ages.',
        'James says the basement is haunted but it is only the pipes.',
        'Do you want to hear a joke? It is quite a long one.',
        'I am not tired. My eyes are just having a rest.',
        'Can I have a pony? It could live in the shed.',
        'You are my favourite. Do not tell Mum I said favourite.',
        'I found a stone shaped exactly like a heart. Look!',
        'The leaves went orange all at once. I checked every day.',
      ],
      morning: [
        'Good morning! I have been awake for AGES.',
        'Can I have pancakes? Or toast. Toast is fine.',
        'It was cold this morning so I wore two socks on one foot.',
      ],
      midday: [
        'Is it lunch? Is it nearly lunch?',
        'I want to show you something. It is outside. It is a bit far.',
      ],
      evening: [
        'Can I stay up? I will be so quiet.',
        'Pick me up? Just for a bit.',
        'The sky went pink. I made everyone come and look.',
      ],
      night: [
        'Can you read one more chapter?',
        'Leave the light on the little bit.',
        'Tuck me in the tight way.',
      ],
      pool: [
        'Watch my cannonball!',
        'The water is perfect.',
        'I can nearly touch the bottom. Nearly!',
        'Look, look — I am a starfish!',
      ],
      kitchen: [
        'Can I have a snack? A small one. Or a big one.',
        'I am helping. I am mostly helping.',
      ],
      court: ['I am on your team. We are winning.'],
      outside: [
        'I am collecting stones. These are the good ones.',
        'There is a bird who lives in that tree and I named him Gerald.',
        'Can we go to the waterfall? It is not far. It is a bit far.',
      ],
      rooms: {
        "Chloie's Room": [
          'This is Bluebell. She is in charge of all the others.',
          'Do not move anything, it is all in an order.',
        ],
        'Family Room': [
          'The fort has a door and a window and one rule.',
          'Sit in the fort with me. You have to crawl in.',
        ],
        'Movie Theater': [
          'I saved you a seat. This one. Sit here.',
          'Is it scary? Tell me if it is going to be scary.',
        ],
        'Great Room': ['I played the piano. It was a real song, sort of.'],
        'Breakfast Sunroom': ['It is warm in here like being a cat.'],
        'Master Bedroom': ['Can I sleep in your bed? Only if there is thunder.'],
        'Bowling Alley': ['I use two hands and I still win sometimes.'],
        'Kitchen': ['Can I have a snack? I did ask nicely.'],
        'Grand Foyer': ['This bit echoes. Listen — HELLO!'],
      },
      doing: {
        asleep: ['Mmmm. Is it morning?', 'Five more minutes like James gets.'],
        animals: ['They all have jobs. Bluebell does the talking.'],
        frogs: ['Shhh. If you are loud they hide. Walk like a heron.', 'Three frogs. THREE!'],
        swim: ['Watch my cannonball!', 'I can nearly touch the bottom.'],
        snack: ['Can I have a snack? I did ask nicely.'],
        table: ['I ate the middle bit of it.'],
        colouring: ['This is our house but with a dragon on it.'],
        fairy: ['I am building a fairy house. That part is the door.'],
        fort: ['The fort has a password. You have to say it.'],
        movie: ['I saved you a seat. This one.'],
        read: ['One more chapter. A short one. Please?'],
      },
      seen: {
        fire: ['You made the fire! It is like a real fireplace. It IS a real fireplace.'],
        movie: ['The big screen is on! I am getting my blanket.'],
        pc: ['James is going to be SO happy the computer is on.'],
      },
    },
  },
];

const timeKey = (h) => (h >= 5 && h < 11 ? 'morning' : h < 16 ? 'midday' : h < 21 ? 'evening' : 'night');

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
    this.tag = null;
    this.hour = 8;
    this.speed = 0;
    this.wantSpeed = spec.walkSpeed ?? (spec.id === 'kaelie' ? 1.45 : 1.8);
    this.talking = false;
    this.wasTalking = false;
    this.lastLine = null;
    this.idleTimer = 0;
    this.beatTimer = 2;
    this.entry = null;
    this.opts = {};
    this.faceTarget = null;
    this.arrived = false;
    this.plan = null;           // set while the player has invited them along
    this.riding = null;         // vehicle they are a passenger in

    const home = world.navIndex?.get(spec.schedule[0][1]);
    this.char.pos.copy(home ? home.pos : V(0, 0, 0));
    this.char.pos.y = home ? home.pos.y : 0;
    this.currentGoal = spec.schedule[0][1];
  }

  goalForTime(hour) {
    const s = this.spec.schedule;
    let pick = s[s.length - 1];
    for (const e of s) if (hour >= e[0]) pick = e;
    // told there had been enough screens for today: they sulk off somewhere
    // else instead of queueing into another match
    if (this.groundedNow && pick[1] === 'r_Gaming Room') return this.sulkInstead(hour);
    return pick;
  }

  /**
   * Where a grounded child goes when the gaming room is off the table.  The
   * two entries are built once and handed back the same way a schedule entry
   * is — `update()` compares them by identity to decide whether to re-route.
   */
  sulkInstead(hour) {
    if (!this._sulk) {
      this._sulk = {
        room: [0, `r_${this.spec.name}'s Room`, 'sulking about the console',
          { off: [0, 1.2], pose: 'sulk', tag: 'sulk' }],
        down: [0, 'r_Family Room', 'in a mood about the console',
          { spot: 'familyRoom', pose: 'sulk', tag: 'sulk' }],
      };
    }
    return (hour >= 20 || hour < 8) ? this._sulk.room : this._sulk.down;
  }

  /** Where in the room the activity actually happens. */
  anchorFor(opts, node) {
    const s = opts.spot ? this.world.spots?.[opts.spot] : null;
    // `at` places them on an exact point — a named chair at the table, say,
    // rather than somewhere near a room's spot
    const base = opts.at || (s ? s.pos : node?.pos);
    if (!base) return null;
    const p = base.clone();
    if (opts.off) { p.x += opts.off[0]; p.z += opts.off[1]; }
    if (opts.dy) p.y += opts.dy;
    if (opts.y !== undefined) p.y = opts.y;
    return p;
  }

  /** Which way to stand once they are there. */
  faceFor(opts, anchor) {
    if (typeof opts.face === 'number') return opts.face;
    const s = opts.spot ? this.world.spots?.[opts.spot] : null;
    if (s && s.hoop) return Math.atan2(s.hoop.x - anchor.x, s.hoop.z - anchor.z);
    if (s && typeof s.rotY === 'number') return s.rotY;
    return null;
  }

  /**
   * Take them off their own schedule and send them somewhere with you.
   * The schedule keeps running underneath; `clearPlan()` hands them back to
   * whatever they were supposed to be doing at this hour.
   */
  sendTo(nodeName, opts = {}, activity = null) {
    this.plan = { node: nodeName, opts, activity, entry: [0, nodeName, activity, opts] };
    this.entry = null;
    this.arrived = false;
    this.setDestination(nodeName, opts);
  }

  clearPlan() {
    if (!this.plan) return;
    this.plan = null;
    this.entry = null;          // forces a fresh route to the current goal
    this.arrived = false;
  }

  /** Standing on the spot they were sent to. */
  get atPlan() {
    if (!this.plan) return false;
    if (this.path.length) return false;
    return !this.target || this.char.pos.distanceTo(this.target) < 1.1;
  }

  setDestination(nodeName, opts = {}) {
    const node = this.world.navIndex?.get(nodeName);
    if (!node) return;
    this.path = findPath(this.world, this.char.pos, node.pos);
    const anchor = this.anchorFor(opts, node);
    if (anchor) {
      // walk the last couple of metres to the sofa / counter / hoop itself
      if (anchor.distanceTo(node.pos) > 0.25) this.path.push(anchor);
      this.target = anchor;
    } else {
      this.target = node.pos.clone();
    }
    this.faceTarget = anchor ? this.faceFor(opts, anchor) : null;
  }

  update(dt, t, hour, playerPos) {
    const c = this.char;
    this.hour = hour;

    // riding along: glued to the passenger seat, everything else on hold
    if (this.riding) {
      const v = this.riding;
      const s = Math.sin(v.heading), co = Math.cos(v.heading);
      const off = v.passengerSeat || { x: 0.55, y: v.halfH ? v.halfH * 0.9 : 0.8, z: 0.1 };
      c.pos.set(v.pos.x + off.x * co + off.z * s, v.pos.y + off.y, v.pos.z - off.x * s + off.z * co);
      c.heading = v.heading;
      c.speed = 0;
      c.setPose('passenger');
      c.lookAt = null;
      c.update(dt, t, playerPos);
      return;
    }
    // A conversation parks them where they stand; when it ends they need a
    // fresh route, or they would walk to the goal in a straight line.
    const justFinishedTalking = !this.talking && this.wasTalking;
    this.wasTalking = this.talking;

    // an invitation from the player outranks the day's schedule
    const entry = this.plan ? this.plan.entry : this.goalForTime(hour);
    const opts = entry[3] || {};

    if (!this.talking) {
      this.activity = entry[2];
      this.tag = opts.tag || null;
      if (entry !== this.entry) {
        this.entry = entry;
        this.currentGoal = entry[1];
        this.opts = opts;
        this.setDestination(entry[1], opts);
      } else if (justFinishedTalking) {
        this.setDestination(entry[1], opts);
      } else if (!this.path.length && !opts.pose) {
        // no activity here: drift about the room so they aren't a statue
        this.idleTimer -= dt;
        if (this.idleTimer <= 0) {
          this.idleTimer = this.rng.range(6, 15);
          const node = this.world.navIndex?.get(entry[1]);
          if (node) {
            // a tight wander keeps them out of the kitchen island and other
            // furniture parked near room centres
            const p = node.pos.clone();
            p.x += this.rng.range(-1.5, 1.5);
            p.z += this.rng.range(-1.5, 1.5);
            this.path = [p];
            this.target = p;
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
      // the last waypoint is an activity anchor — stand on it properly
      const reach = this.path.length === 1 ? 0.16 : 0.45;
      if (d < reach) {
        this.path.shift();
      } else {
        moving = true;
        const want = Math.atan2(dx, dz);
        c.heading = angleDamp(c.heading, want, 7, dt);
        // ease off over the last stride instead of stopping dead
        const slow = this.path.length === 1 ? clamp(d / 1.1, 0.28, 1) : 1;
        this.speed = damp(this.speed, this.wantSpeed * slow, 5, dt);
        const step = Math.min(this.speed * dt, d);
        c.pos.x += Math.sin(c.heading) * step;
        c.pos.z += Math.cos(c.heading) * step;
        c.pos.y = damp(c.pos.y, wp.y, 6, dt);
      }
    }
    if (!moving) this.speed = damp(this.speed, 0, 8, dt);
    c.speed = this.speed;

    // ── the activity itself ──
    const dTarget = this.target
      ? Math.hypot(c.pos.x - this.target.x, c.pos.z - this.target.z) : 99;
    const nearAnchor = !this.path.length && dTarget < 1.3;
    // caught halfway across the hall, they still turn and talk to you
    const settled = nearAnchor || this.talking;
    this.arrived = nearAnchor;
    c.setPose(nearAnchor ? (opts.pose || 'stand') : 'stand');

    if (settled) {
      let face = this.faceTarget;
      // standing conversations turn to face you; a seated one just looks over
      const standing = !opts.pose || opts.pose === 'stand' || opts.pose === 'lean';
      if (this.talking && standing) face = Math.atan2(playerPos.x - c.pos.x, playerPos.z - c.pos.z);
      if (face !== null && face !== undefined) c.heading = angleDamp(c.heading, face, 4, dt);

      if (opts.beat && !this.talking) {
        this.beatTimer -= dt;
        if (this.beatTimer <= 0) {
          this.beatTimer = (opts.every || 7) * this.rng.range(0.75, 1.35);
          c.playGesture(opts.beat, opts.beatTime || 1.5);
        }
      }
    }

    // look at the player when close
    const dp = c.pos.distanceTo(playerPos);
    c.lookAt = dp < 7 ? playerPos : null;
    if (this.talking) c.lookAt = playerPos;
    c.speaking = this.talking;

    c.update(dt, t, playerPos);
  }

  /** Switches the player has flipped that these three would notice. */
  playerDid() {
    if (!this._switches) {
      this._switches = (this.world.interactables || [])
        .filter((i) => i.data && (i.kind === 'fire' || i.kind === 'theater' || i.kind === 'pc'));
    }
    const out = new Set();
    for (const i of this._switches) {
      if (i.data.on) out.add(i.kind === 'theater' ? 'movie' : i.kind);
    }
    return out;
  }

  /**
   * Builds a pool out of everything true about this moment — the room, the
   * hour, what they are in the middle of doing, what you have switched on —
   * and picks a line that isn't the one they just said.
   */
  say(kind = 'idle') {
    const L = this.spec.lines;
    const pool = [];
    const add = (arr, n = 1) => {
      if (!arr || !arr.length) return;
      for (let i = 0; i < n; i++) pool.push(...arr);
    };
    const room = this.world.roomAt ? this.world.roomAt(this.char.pos) : null;

    add(L.idle, 1);
    if (kind && kind !== 'idle') add(L[kind], 3);
    add(L.rooms && L.rooms[room?.name], 3);
    add(L.doing && L.doing[this.tag], 3);
    add(L[timeKey(this.hour)], 2);
    if (!room) add(L.outside, 2);
    for (const k of this.playerDid()) add(L.seen && L.seen[k], 2);
    if (!pool.length) add(L.idle, 1);
    if (!pool.length) return `${this.name} smiles at you.`;

    let line = pool[Math.floor(Math.random() * pool.length)];
    for (let i = 0; i < 8 && line === this.lastLine && pool.length > 1; i++) {
      line = pool[Math.floor(Math.random() * pool.length)];
    }
    this.lastLine = line;
    return line;
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
 * of them to the same room (movie night, lunch), and without a separation pass
 * they end up standing inside one another.  Anyone parked in an activity pose
 * is anchored to real furniture, so they hold their ground and the other one
 * gives way.
 */
export function separateFamily(members) {
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const A = members[i].char, B = members[j].char;
      if (Math.abs(A.pos.y - B.pos.y) > 1.5) continue;
      const aFixed = A.pose !== 'stand', bFixed = B.pose !== 'stand';
      if (aFixed && bFixed) continue;              // both on their own anchors
      const dx = B.pos.x - A.pos.x, dz = B.pos.z - A.pos.z;
      const d = Math.hypot(dx, dz);
      const MIN = aFixed || bFixed ? 0.5 : 0.62;
      if (d >= MIN || d < 1e-4) continue;
      const push = MIN - d;
      const nx = dx / d, nz = dz / d;
      const aShare = aFixed ? 0 : bFixed ? 1 : 0.5;
      A.pos.x -= nx * push * aShare; A.pos.z -= nz * push * aShare;
      B.pos.x += nx * push * (1 - aShare); B.pos.z += nz * push * (1 - aShare);
    }
  }
}
