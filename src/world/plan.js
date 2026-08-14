// ───────────────────────────────────────────────────────────────────────────
// The floor plan.  Everything the architecture builder needs — rectangles in
// world metres, which side each door is on, what each room is made of.
//
//   +X = east   +Z = south (back yard, mountains)   -Z = north (front drive)
// ───────────────────────────────────────────────────────────────────────────

export const HOUSE = { x0: -30, x1: 30, z0: -13, z1: 13 };
export const CORR = { z0: -2.2, z1: 2.2 };          // central gallery band
export const NORTH = { z0: HOUSE.z0, z1: CORR.z0 };  // front rooms
export const SOUTH = { z0: CORR.z1, z1: HOUSE.z1 };  // back rooms
export const WALL_T = 0.12;

// Vertical stack: [basement, ground, second, third]
export const FLOORS = [
  { key: 'basement', y: -6.0, ceil: 5.4, name: 'Lower Level' },
  { key: 'ground', y: 0, ceil: 3.8, name: 'Main Floor' },
  { key: 'second', y: 4.2, ceil: 3.8, name: 'Second Floor' },
  { key: 'third', y: 8.4, ceil: 3.6, name: 'Third Floor' },
];

const N = (x0, x1) => ({ x0, x1, z0: NORTH.z0, z1: NORTH.z1 });
const S = (x0, x1) => ({ x0, x1, z0: SOUTH.z0, z1: SOUTH.z1 });

// door: side n|s|e|w, `at` = offset along that wall from the room centre.
const d = (side, at = 0, w = 1.15) => ({ side, at, w });

// ── GROUND ─────────────────────────────────────────────────────────────────
export const GROUND_ROOMS = [
  {
    name: 'Stair Hall', x0: -30, x1: -21, z0: HOUSE.z0, z1: CORR.z1, floor: 'marble', wall: 0xdcd6c9,
    doors: [d('e', 5.4, 4.0)], type: 'stairhall', open: true,
  },
  { name: 'Library & Study', ...N(-21, -13), floor: 'oakFloor', wall: 0x38434f, doors: [d('s', 0, 1.4), d('w', 0, 1.4)], type: 'library' },
  { name: 'Powder Room', ...N(-13, -9), floor: 'tile', wall: 0x7c6f8a, doors: [d('s', 0, 0.9)], type: 'bath' },
  { name: 'Mud Room', ...N(-9, -6), floor: 'tile', wall: 0xa9b4bd, doors: [d('s', 0, 1.0), d('e', 0, 1.1)], type: 'mud' },
  {
    name: 'Grand Foyer', x0: -6, x1: 6, z0: HOUSE.z0, z1: CORR.z1, floor: 'marble', wall: 0xe9e3d7,
    doors: [d('w', 5.4, 4.0), d('e', 5.4, 4.0)], type: 'foyer', open: true, tall: true,
  },
  { name: 'Dining Hall', ...N(6, 17), floor: 'walnutFloor', wall: 0x5b4a4f, doors: [d('s', 0, 2.6), d('w', 0, 1.6)], type: 'dining' },
  { name: "Butler's Pantry", ...N(17, 21), floor: 'tile', wall: 0xdad2c3, doors: [d('s', 0, 1.0)], type: 'pantry' },
  { name: 'Garage', ...N(21, 30), floor: 'polishedConcrete', wall: 0xbfc4c8, doors: [d('s', 0, 1.1), d('w', 0, 1.1)], type: 'garage', garageDoors: true },

  { name: 'Great Room', ...S(-30, -18), floor: 'oakFloor', wall: 0xe6ded0, doors: [d('n', 4.4, 2.6)], type: 'great', tall: true, glassSouth: true },
  { name: 'Family Room', ...S(-18, -8), floor: 'oakFloor', wall: 0xd8cfc0, doors: [d('n', 0, 2.6), d('w', 0, 2.4)], type: 'family' },
  { name: 'Kitchen', ...S(-8, 4), floor: 'tile', wall: 0xe8e6e0, doors: [d('n', 0, 2.6), d('w', 0, 2.2)], type: 'kitchen' },
  { name: 'Breakfast Sunroom', ...S(4, 12), floor: 'tile', wall: 0xf0ece1, doors: [d('n', 0, 1.6), d('w', 0, 2.2)], type: 'sunroom', glassSouth: true },
  { name: 'Pool Bath', ...S(12, 16), floor: 'poolTile', wall: 0x9fc6d4, doors: [d('n', 0, 0.9)], type: 'bath' },
  { name: 'Laundry & Mud', ...S(16, 22), floor: 'tile', wall: 0xcfd8dd, doors: [d('n', 0, 1.1)], type: 'laundry' },
  { name: 'Pantry & Storage', ...S(22, 30), floor: 'tile', wall: 0xd6d2c8, doors: [d('n', 0, 1.1)], type: 'storage' },
];

// ── SECOND ─────────────────────────────────────────────────────────────────
export const SECOND_ROOMS = [
  { name: 'Master Bedroom', ...N(-30, -19), floor: 'carpet', wall: 0xbfc7cf, doors: [d('s', 0, 1.4), d('e', 0, 1.0)], type: 'bedroom', owner: 'you' },
  { name: 'Master Bath', ...N(-19, -13.5), floor: 'marble', wall: 0xe4e9ec, doors: [d('s', 0, 0.95)], type: 'bath' },
  { name: 'Guest Room — Ridgeview', ...N(-13.5, -6), floor: 'carpet', wall: 0xcbbfae, doors: [d('s', 0, 1.0)], type: 'bedroom' },
  { name: 'Bedroom — East Wing', ...N(6, 14), floor: 'carpet', wall: 0xc7cbb8, doors: [d('s', 0, 1.0)], type: 'bedroom' },
  { name: 'Bedroom — Sunrise', ...N(14, 22), floor: 'carpet', wall: 0xd9c9b5, doors: [d('s', 0, 1.0)], type: 'bedroom' },
  { name: 'Bedroom — Corner Suite', ...N(22, 26.5), floor: 'carpet', wall: 0xbdc9c4, doors: [d('s', 0, 1.0)], type: 'bedroom' },
  { name: 'Bath — East Wing', ...N(26.5, 30), floor: 'tile', wall: 0xdde7ea, doors: [d('s', 0, 0.9)], type: 'bath' },

  { name: "James's Room", ...S(-18, -10), floor: 'carpet', wall: 0x3f6ea8, doors: [d('n', 0, 1.0), d('e', 0, 0.9)], type: 'bedroom', owner: 'james' },
  { name: 'Jack & Jill Bath', ...S(-10, -5.5), floor: 'tile', wall: 0xb9d3e6, doors: [d('n', 0, 0.9)], type: 'bath' },
  { name: "Chloie's Room", ...S(-5.5, 2), floor: 'carpet', wall: 0x8f6bb5, doors: [d('n', 0, 1.0), d('w', 0, 0.9)], type: 'bedroom', owner: 'chloie' },
  { name: 'Gaming Room', ...S(2, 12), floor: 'carpet', wall: 0x1e2430, doors: [d('n', 0, 1.4)], type: 'gaming' },
  { name: 'Bedroom — Garden View', ...S(12, 21), floor: 'carpet', wall: 0xcfc4b4, doors: [d('n', -3.5, 1.0)], type: 'bedroom' },
  { name: 'Bedroom — South Wing', ...S(21, 30), floor: 'carpet', wall: 0xc2cbbf, doors: [d('n', 0, 1.0)], type: 'bedroom' },
];

// ── THIRD ──────────────────────────────────────────────────────────────────
export const THIRD_ROOMS = [
  { name: 'Bedroom — Summit', ...N(-30, -20), floor: 'carpet', wall: 0xc9c2b6, doors: [d('s', 0, 1.0)], type: 'bedroom' },
  { name: 'Bedroom — Aspen', ...N(-20, -12), floor: 'carpet', wall: 0xbec8bd, doors: [d('s', 0, 1.0)], type: 'bedroom' },
  { name: 'Bath — North', ...N(-12, -7), floor: 'tile', wall: 0xd3e0e6, doors: [d('s', 0, 0.9)], type: 'bath' },
  { name: 'Bedroom — Cedar', ...N(-7, 1), floor: 'carpet', wall: 0xd2c6b3, doors: [d('s', 0, 1.0)], type: 'bedroom' },
  { name: 'Bedroom — Willow', ...N(1, 9), floor: 'carpet', wall: 0xc8bfc9, doors: [d('s', 0, 1.0)], type: 'bedroom' },
  { name: 'Bedroom — Juniper', ...N(9, 17), floor: 'carpet', wall: 0xbcc7cd, doors: [d('s', 0, 1.0)], type: 'bedroom' },
  { name: 'Bedroom — Larkspur', ...N(17, 24), floor: 'carpet', wall: 0xd6c8bb, doors: [d('s', 0, 1.0)], type: 'bedroom' },
  { name: 'Bedroom — Falcon', ...N(24, 30), floor: 'carpet', wall: 0xc4bfae, doors: [d('s', 0, 1.0)], type: 'bedroom' },

  { name: 'Bedroom — Meadow', ...S(-30, -22), floor: 'carpet', wall: 0xcdc3b2, doors: [d('n', 0, 1.0)], type: 'bedroom' },
  { name: 'Bedroom — Birch', ...S(-22, -14), floor: 'carpet', wall: 0xc0c9c2, doors: [d('n', 0, 1.0)], type: 'bedroom' },
  { name: 'Bath — South', ...S(-14, -9), floor: 'tile', wall: 0xdfe6e2, doors: [d('n', 0, 0.9)], type: 'bath' },
  { name: 'Bedroom — Quarry', ...S(-9, -1), floor: 'carpet', wall: 0xcac2ba, doors: [d('n', 0, 1.0)], type: 'bedroom' },
  { name: 'Loft Gaming Room', ...S(-1, 9), floor: 'carpet', wall: 0x151a24, doors: [d('n', 0, 1.4)], type: 'gaming' },
  { name: 'Bath — Loft', ...S(9, 13.5), floor: 'tile', wall: 0xd8e2e6, doors: [d('n', 0, 0.9)], type: 'bath' },
  { name: 'Bunk Room', ...S(13.5, 21), floor: 'carpet', wall: 0xbfd0d8, doors: [d('n', -2.5, 1.0)], type: 'bedroom' },
  { name: 'Bedroom — Skyline', ...S(21, 25.5), floor: 'carpet', wall: 0xcbc5b8, doors: [d('n', 0.75, 1.0)], type: 'bedroom' },
  { name: 'Bedroom — Lantern', ...S(25.5, 30), floor: 'carpet', wall: 0xc6bfae, doors: [d('n', 0, 1.0)], type: 'bedroom' },
];

// ── BASEMENT ───────────────────────────────────────────────────────────────
const BN = (x0, x1) => ({ x0, x1, z0: -13, z1: -1.6 });
const BS = (x0, x1) => ({ x0, x1, z0: 1.6, z1: 13 });

export const BASEMENT_ROOMS = [
  { name: 'Movie Theater', ...BN(-30, -8), floor: 'theaterCarpet', wall: 0x1a1216, doors: [d('s', 6, 1.6)], type: 'theater' },
  { name: 'Basketball Court', ...BN(-8, 30), floor: 'courtWood', wall: 0xe7e2d6, doors: [d('s', -12, 2.0), d('s', 10, 2.0)], type: 'court' },
  { name: 'Bowling Alley', ...BS(-30, -8), floor: 'laneWood', wall: 0x1d222b, doors: [d('n', 6, 1.6)], type: 'bowling' },
  { name: 'Home Gym', ...BS(-8, 3), floor: 'rubberFloor', wall: 0x2b3138, doors: [d('n', 0, 1.4)], type: 'gym' },
  { name: 'Laundry & Utility', ...BS(3, 12), floor: 'tile', wall: 0xd2d8dc, doors: [d('n', 0, 1.1)], type: 'laundry' },
  { name: 'Lower Bath', ...BS(12, 16), floor: 'tile', wall: 0xcfdde3, doors: [d('n', 0, 0.9)], type: 'bath' },
  { name: 'Workshop', ...BS(16, 23), floor: 'polishedConcrete', wall: 0xb9bfc4, doors: [d('n', 0, 1.1)], type: 'workshop' },
  { name: 'Mechanical & Storage', ...BS(23, 30), floor: 'polishedConcrete', wall: 0xa9b0b6, doors: [d('n', 0, 1.1)], type: 'storage' },
];

export const FLOOR_ROOMS = {
  basement: BASEMENT_ROOMS,
  ground: GROUND_ROOMS,
  second: SECOND_ROOMS,
  third: THIRD_ROOMS,
};

// Holes cut in each level's slab (stairwells, double-height voids).
export const SLAB_HOLES = {
  basement: [],
  ground: [
    { x0: -27.9, x1: -21.6, z0: -1.9, z1: 1.9 },        // flush with the first tread
  ],
  second: [
    { x0: -6, x1: 6, z0: HOUSE.z0, z1: -2.4 },          // foyer void + grand stair
    { x0: -30, x1: -18, z0: SOUTH.z0, z1: HOUSE.z1 },   // great room double height
  ],
  third: [
    { x0: 15.4, x1: 23.16, z0: 0.35, z1: 1.85 },        // flush with the service stair
  ],
};

// Curtain-wall spans (full height glass) on the south elevation, per floor.
export const GLASS_SPANS = {
  ground: [{ x0: -29, x1: -19 }, { x0: 4.4, x1: 8.4 }],
  second: [{ x0: -29, x1: -19 }],
  third: [],
  basement: [],
};

export const BEDROOM_COUNT = [...Object.values(FLOOR_ROOMS)].flat().filter((r) => r.type === 'bedroom').length;
export const BATH_COUNT = [...Object.values(FLOOR_ROOMS)].flat().filter((r) => r.type === 'bath').length;
