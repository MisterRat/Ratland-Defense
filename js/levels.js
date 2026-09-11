// Level definitions. Each level is a set of waypoints in grid coordinates
// (grid is 28x18, see config.js). x=-1 = off-screen spawn, x=cols = exit.
// All segments are axis-aligned. Perpendicular 90° crossovers are allowed
// (e.g. "Crossroads"); walking the same cell twice in the same direction
// (U-turns/loops) is not.
// `difficulty` uses the generator's keys (see LG_DIFFICULTY in
// js/levelgen_waves.js): easy = L1–L2, normal = L3–L4, hard = L5–L6.
// Procedural waves scale with it exactly like generated levels do.

const LEVELS = [
  {
    name: 'Snake',
    difficulty: 'easy',
    waypoints: [
      [-1, 3], [5, 3], [5, 14], [12, 14], [12, 3], [19, 3], [19, 14], [28, 14],
    ],
  },
  {
    name: 'Serpentine',
    difficulty: 'easy',
    waypoints: [
      [-1, 8], [4, 8], [4, 2], [10, 2], [10, 15], [16, 15], [16, 2], [22, 2], [22, 15], [28, 15],
    ],
  },
  {
    name: 'Comb',
    difficulty: 'normal',
    waypoints: [
      [-1, 4], [6, 4], [6, 13], [12, 13], [12, 4], [18, 4], [18, 13], [24, 13], [24, 4], [28, 4],
    ],
  },
  {
    name: 'Switchback',
    difficulty: 'normal',
    waypoints: [
      [-1, 9], [8, 9], [8, 3], [15, 3], [15, 14], [21, 14], [21, 6], [28, 6],
    ],
  },
  {
    name: 'The Gauntlet',
    difficulty: 'hard',
    waypoints: [
      [-1, 2], [7, 2], [7, 15], [13, 15], [13, 2], [19, 2], [19, 15], [25, 15], [25, 8], [28, 8],
    ],
  },
  {
    name: 'Crossroads',
    difficulty: 'hard',
    // Two perpendicular crossovers: (4,4) where col 4 crosses row 4, and
    // (20,6) where col 20 crosses row 6. No other segment intersections.
    waypoints: [
      [-1, 4], [12, 4], [12, 12], [4, 12], [4, 2], [20, 2], [20, 10], [16, 10], [16, 6], [28, 6],
    ],
  },
];

function levelWaypoints(i) {
  return LEVELS[i].waypoints;
}
