// Static game configuration: grid, path, towers, enemies, waves.

const GRID = { cols: 28, rows: 18, cell: 50 };
const CANVAS_W = GRID.cols * GRID.cell; // 1400
const CANVAS_H = GRID.rows * GRID.cell; // 900

// Path waypoints in grid coordinates. x=-1 / x=cols means off-screen spawn/exit.
// Level 1 (classic snake, rescaled to the bigger grid). See js/levels.js for
// the full LEVELS list and the generator.
const WAYPOINTS = [
  [-1, 3], [5, 3], [5, 14], [12, 14], [12, 3], [19, 3], [19, 14], [28, 14],
];

// Default starting money per map level (0-based). Winning a level carries the
// unspent balance OVER to the next level, where it is ADDED to that level's
// default — the defaults are the floor, carry-over is extra.
const LEVEL_START_MONEY = [100, 100, 200, 200, 300, 350];
// Bonus money per retry attempt after a loss (stacks: +$50, then +$100, …).
const RETRY_BONUS = 50;
const START_LIVES = 20;

// Default starting money for a 0-based map level index (clamped to the table).
function levelStartMoney(levelIndex) {
  const i = Math.max(0, Math.min(LEVEL_START_MONEY.length - 1, levelIndex | 0));
  return LEVEL_START_MONEY[i];
}
const SELL_REFUND = 0.7;
const MAX_LEVEL = 3;
const TOTAL_WAVES = 12;
const WAVE_DELAY = 6;          // seconds between auto wave starts
const EARLY_SEND_BONUS_PER_SEC = 1; // money per second of delay skipped
const WIN_ADVANCE_DELAY = 3.5;  // seconds to show the victory banner before auto-advancing

// Tower definitions. range/damage are level-1 values; upgrades scale them.
// unlockLevel = 1-based map level at which the tower becomes buildable.
const TOWER_TYPES = {
  basic: {
    name: 'Gun', cost: 50, color: '#4fa3ff', unlockLevel: 1, img: 'assets/gun.png',
    range: 150, damage: 12, fireRate: 2.5, projSpeed: 460, splash: 0, slow: 0,
    desc: 'Cheap, fast single-target.',
  },
  frost: {
    name: 'Frost', cost: 80, color: '#7fe3ff', unlockLevel: 2, img: 'assets/frost.png',
    range: 120, damage: 4, fireRate: 1.6, projSpeed: 420, splash: 0, slow: 0.5,
    desc: 'Slows enemies by 50% for 1.5s.',
  },
  flame: {
    name: 'Flame', cost: 100, color: '#ff6b35', unlockLevel: 3, img: 'assets/flame.png',
    range: 140, damage: 6, fireRate: 2.0, projSpeed: 420, splash: 0, slow: 0,
    burn: { dps: 10, duration: 2.5 },
    desc: 'Burns targets over time; fire spreads to enemies in contact.',
  },
  cannon: {
    name: 'Cannon', cost: 120, color: '#ff8c42', unlockLevel: 4, img: 'assets/cannon.png',
    range: 130, damage: 26, fireRate: 0.9, projSpeed: 340, splash: 55, slow: 0,
    desc: 'Slow, area splash damage.',
  },
  sniper: {
    name: 'Sniper', cost: 160, color: '#c792ea', unlockLevel: 5, img: 'assets/sniper.png',
    range: 260, damage: 70, fireRate: 0.45, projSpeed: 900, splash: 0, slow: 0,
    desc: 'Long range, heavy single hit.',
  },
  railgun: {
    name: 'Railgun', cost: 300, color: '#69f0ff', unlockLevel: 6, img: 'assets/railgun.png',
    range: 260, damage: 70, fireRate: 0.35, projSpeed: 1600, splash: 0, slow: 0,
    pierce: 5,
    desc: 'Piercing slug: hits up to 5 enemies in a line; damage halves per enemy.',
  },
};

// Is this tower buildable on the given 0-based map level?
function isTowerAvailable(type, levelIndex) {
  const def = TOWER_TYPES[type];
  return !!def && (levelIndex + 1) >= def.unlockLevel;
}

// Targeting modes a tower can use (set per tower after placement).
const TARGET_MODES = {
  first:     'First',      // furthest along the path
  last:      'Last',       // closest to the start
  closest:   'Closest',    // nearest to the tower
  strongest: 'Strongest',  // highest current HP
};

// Per-level multipliers: [level1, level2, level3]
const LEVEL_SCALE = { damage: [1, 1.6, 2.5], range: [1, 1.12, 1.25], fireRate: [1, 1.2, 1.45] };
// Upgrade cost = base cost * factor[level-1]
const UPGRADE_COST_FACTOR = [1, 1.5]; // to level 2, to level 3

// Resistance scales with the map level being played (1-based): +4% per level,
// capped at 80% so no enemy ever approaches immunity, however many levels exist.
const RESISTANCE_PER_LEVEL = 0.04;
const RESISTANCE_CAP = 0.8;

// Resistance fraction for a 0-based map level index (clamped to [0, RESISTANCE_CAP]).
function resistanceFactor(levelIndex) {
  const r = RESISTANCE_PER_LEVEL * (levelIndex + 1);
  return r < 0 ? 0 : (r > RESISTANCE_CAP ? RESISTANCE_CAP : r);
}

// Enemy definitions. hp is the wave-1 baseline; see wave.hpScale.
// `resist` lists tower keys whose damage/effect this enemy type reduces.
const ENEMY_TYPES = {
  normal: { name: 'Minion',    hp: 40, speed: 70, reward: 7, livesCost: 1, radius: 11, color: '#e5533d', resist: [], unlockLevel: 1 },
  tank:   { name: 'Tanked',    hp: 140, speed: 45, reward: 16, livesCost: 2, radius: 14, color: '#8e6bbf', resist: ['basic'], unlockLevel: 2 },
  hot:    { name: 'Singed',    hp: 45, speed: 70, reward: 10, livesCost: 1, radius: 11, color: '#ff8552', resist: ['frost'], unlockLevel: 3 },
  wet:    { name: 'Soused',    hp: 45, speed: 70, reward: 10, livesCost: 1, radius: 11, color: '#3fb6c9', resist: ['flame'], unlockLevel: 4 },
  fast:   { name: 'Skitterer', hp: 26, speed: 120, reward: 8, livesCost: 1, radius: 9, color: '#ffd76a', resist: ['cannon'], unlockLevel: 5 },
  camo:   { name: 'Prowler',   hp: 45, speed: 90, reward: 10, livesCost: 1, radius: 10, color: '#9aa77a', resist: ['sniper'], unlockLevel: 6 },
  boss:   { name: 'Colossus',  hp: 900, speed: 38, reward: 120, livesCost: 5, radius: 18, color: '#ff5da2',
            resist: ['basic', 'cannon', 'flame', 'frost', 'sniper', 'railgun'], unlockLevel: 1 },
  // New roster (Phase 19): behavioral enemies. All unlock after level 6.
  // fission splits into spore children on death (splits); spore is childOnly —
  // it is never spawned by waves, only by a dying fission.
  fission:{ name: 'Fission',   hp: 120, speed: 55, reward: 14, livesCost: 1, radius: 13, color: '#9be15d', resist: [], unlockLevel: 7,
            splits: { key: 'spore', count: 2 } },
  spore:  { name: 'Spore',     hp: 14, speed: 135, reward: 2, livesCost: 1, radius: 7, color: '#d3f0a0', resist: [], unlockLevel: 7, childOnly: true },
  // bolt cycles walk -> dash (burst); frost slow scales both phases.
  bolt:   { name: 'Bolt',      hp: 30, speed: 50, reward: 9, livesCost: 1, radius: 9, color: '#eef2ff', resist: ['sniper'], unlockLevel: 7,
            burst: { dashSpeed: 170, dashDur: 0.8, period: 3.5 } },
  // bulwark regenerates flat HP per second (capped at maxHp).
  bulwark:{ name: 'Bulwark',   hp: 220, speed: 40, reward: 18, livesCost: 2, radius: 15, color: '#8fa3bf', resist: [], unlockLevel: 7, regen: 6 },
  // mender heals other living enemies in radius (not itself), capped at maxHp.
  mender: { name: 'Mender',    hp: 90, speed: 60, reward: 12, livesCost: 1, radius: 11, color: '#e786c3', resist: [], unlockLevel: 7,
            heal: { radius: 90, hps: 8 } },
  // wisp alternates solid/phased; phased = untargetable (splash + burn still hit);
  // frost slow pauses the phase cycle.
  wisp:   { name: 'Wisp',      hp: 60, speed: 75, reward: 11, livesCost: 1, radius: 10, color: '#c9b8ff', resist: [], unlockLevel: 7,
            phase: { solid: 2.5, phased: 1.2 } },
};

// Is this enemy type available in waves on the given 0-based map level?
function isEnemyAvailable(type, levelIndex) {
  const def = ENEMY_TYPES[type];
  return !!def && (levelIndex + 1) >= def.unlockLevel;
}

// Slow effect applied by frost towers.
const SLOW = { factor: 0.5, duration: 1.5 };

// Fire spread: a burning enemy ignites any living enemy within this distance.
const FLAME_SPREAD_RADIUS = 26;
