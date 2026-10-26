// Static game configuration: grid, path, towers, enemies, waves.

// App version shown to the player (bottom bar on every page). Bump policy:
// the MINOR number is bumped automatically by .git/hooks/post-commit after
// every commit; the MAJOR number is bumped manually (by the user) for big
// releases. Format: "MAJOR.MINOR".
const GAME_VERSION = '1.20';

const GRID = { cols: 28, rows: 16, cell: 50 };
const CANVAS_W = GRID.cols * GRID.cell; // 1400
const CANVAS_H = GRID.rows * GRID.cell; // 800

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

// Win carry-over fraction by the TARGET level's difficulty (the level being
// entered decides — not the one just won): easy keeps 100%, normal 75%,
// hard 50%, nightmare 25%. Unknown/missing keys fall back to 0.75 (normal).
const CARRYOVER_FRACTION = { easy: 1.0, normal: 0.75, hard: 0.5, nightmare: 0.25 };
function carryoverFactor(difficultyKey) {
  return CARRYOVER_FRACTION[difficultyKey] ?? 0.75;
}

// Phase 59: speed-based income bonus — playing faster earns more money per
// kill / Mint tick / early-send bonus (+20% at 2x, +40% at 3x). NOT applied to
// sell refunds, starting money, carry-over or the retry bonus — those are
// level-entry economics, not gameplay earnings.
const SPEED_MONEY_MULT = { 1: 1.0, 2: 1.2, 3: 1.4 };
function speedMoneyMult(speed) {
  return SPEED_MONEY_MULT[speed] || 1.0; // unknown/missing → normal (1.0)
}
const START_LIVES = 20;

// Phase 44: per-level difficulty overrides. The player can replay any level at
// a different intensity (easy/normal/hard/nightmare); the choice is persisted
// per level index in localStorage and falls back to the level's built-in
// `difficulty` key when absent. LG_DIFFICULTY (js/levelgen_waves.js) loads
// after this file — every lookup below is late-bound, called at runtime only.
const DIFF_KEY = 'towerDefenseDifficulty.v1';
// The valid keys are DIFFICULTY_KEYS from js/level_validate.js (loaded later —
// every use below is at runtime, so the late binding is safe).

function loadDifficultyOverrides() {
  try {
    const raw = localStorage.getItem(DIFF_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const out = {};
    for (const [k, v] of Object.entries(data)) {
      if (DIFFICULTY_KEYS.includes(v)) out[k] = v; // drop corrupt/unknown values
    }
    return out;
  } catch (err) { return {}; }
}

function saveDifficultyOverrides(overrides) {
  try { localStorage.setItem(DIFF_KEY, JSON.stringify(overrides)); } catch (err) { /* no storage */ }
}

// Persist a per-level difficulty override (or clear it when key is null).
function setLevelDifficulty(levelIndex, key) {
  const overrides = loadDifficultyOverrides();
  if (key === null || !DIFFICULTY_KEYS.includes(key)) delete overrides[String(levelIndex)];
  else overrides[String(levelIndex)] = key;
  saveDifficultyOverrides(overrides);
}

// The level's EFFECTIVE difficulty: the player's per-level override if set,
// else the level's built-in `difficulty` key ('normal' fallback). This is the
// single place every system resolves a difficulty key from a level — enemy HP
// (enemy.js), spawn pacing + procedural waves (wave.js), starting lives
// (game.js) all read through here.
function effectiveDifficulty(levelIndex) {
  const lvl = (typeof getLevel === 'function') ? getLevel(levelIndex) : null;
  const base = (lvl && typeof LG_DIFFICULTY !== 'undefined' && LG_DIFFICULTY[lvl.difficulty])
    ? lvl.difficulty : 'normal';
  return loadDifficultyOverrides()[String(levelIndex)] || base;
}

// Default starting money for a 0-based map level index (clamped to the table).
function levelStartMoney(levelIndex) {
  const i = Math.max(0, Math.min(LEVEL_START_MONEY.length - 1, levelIndex | 0));
  return LEVEL_START_MONEY[i];
}
const SELL_REFUND = 0.7;
// Phase 54: tower durability. maxHp = invested × this (upgrades raise it via
// invested), and TOWER_HIT_RADIUS is the friendly-fire hit box — it matches the
// base-plate arc drawn in render.js drawTower() so a projectile "hits" exactly
// what looks like the tower's body.
const TOWER_HP_PER_COST = 2;
const TOWER_HIT_RADIUS = GRID.cell * 0.36 + 4;
const TOTAL_WAVES = 12;
const WAVE_DELAY = 6;          // seconds between auto wave starts
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
    burn: { dps: 14, duration: 2.5 }, // Phase 51: 10→14 (beats Bulwark's 6/s regen at L1)
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
    desc: 'Piercing slug: up to 5 enemies in a line; damage halves per enemy.',
  },
  // Phase 26: five new towers, all unlock at level 7 (external levels only).
  tesla: {
    name: 'Tesla', cost: 200, color: '#69f0ff', unlockLevel: 7, img: 'assets/tesla.png',
    range: 140, damage: 18, fireRate: 1.8, projSpeed: 0, splash: 0, slow: 0,
    chain: { hops: 3, hopRadius: 90, falloff: 0.8 },
    desc: 'Chain lightning: bolt + 3 hops (×0.8 each). Also hits phased enemies.',
  },
  venom: {
    name: 'Venom', cost: 110, color: '#9be15d', unlockLevel: 7, img: 'assets/venom.png',
    range: 130, damage: 4, fireRate: 1.2, projSpeed: 380, splash: 0, slow: 0,
    poison: { stacks: 5, dpsPerStack: 6, duration: 3 },
    desc: 'Stacking poison: up to 5 stacks × 6 dps (30 dps cap), 3s refresh.',
  },
  reaper: {
    name: 'Reaper', cost: 180, color: '#ff5da2', unlockLevel: 7, img: 'assets/reaper.png',
    range: 200, damage: 40, fireRate: 0.6, projSpeed: 700, splash: 0, slow: 0,
    execute: { threshold: 0.3, multiplier: 2.5 },
    desc: 'Execute: ×2.5 damage to targets below 30% HP at impact.',
  },
  mint: {
    name: 'Mint', cost: 150, color: '#4fd8a0', unlockLevel: 7, img: 'assets/mint.png',
    range: 0, damage: 0, fireRate: 0, projSpeed: 0, splash: 0, slow: 0,
    income: { amount: 10, interval: 8 },
    desc: 'Economy: +$10 every 8s (scales with level). Not counted in score.',
  },
  warden: {
    name: 'Warden', cost: 300, color: '#ffd76a', unlockLevel: 7, img: 'assets/warden.png',
    range: 100, damage: 0, fireRate: 0, projSpeed: 0, splash: 0, slow: 0,
    aura: { multiplier: 1.25 },
    dynamicCost: true,
    desc: 'Aura: +25% damage to towers in range. First $300, each next +$100.',
  },
  // Mortar: dumb artillery. No intrinsic damage — the shell carries the stats
  // of the selected ammo tower. `range` is the blast radius (not a targeting
  // range); the impact point is a player-chosen cell ANYWHERE on the map
  // (tower.targetPoint) — Phase 43: any in-bounds cell, so a shell can land
  // between two switchback lanes and cover parts of both.
  mortar: {
    name: 'Mortar', cost: 400, color: '#b08968', unlockLevel: 7, img: 'assets/mortar.png',
    range: 112, damage: 0, fireRate: 0.25, projSpeed: 350, splash: 0, slow: 0,
    ammoDefault: 'cannon',
    ammoTypes: ['cannon', 'flame', 'frost', 'tesla', 'venom'],
    desc: 'Lobs a shell at ANY map point every 4s. Pick ammo in the panel.',
  },
  // Cruiser (Phase 55): water-only missile tower. Fires a homing missile that
  // locks on and follows its target; if the target dies or leaves range
  // before impact, the missile self-destructs (no damage). Range = half the
  // map width (700px). Damage 225 ≈ 1/4 of the Colossus boss.
  cruiser: {
    name: 'Cruiser', cost: 400, color: '#4cc9f0', unlockLevel: 7, img: 'assets/cruiser.png',
    range: 700, damage: 225, fireRate: 0.25, projSpeed: 500, splash: 0, slow: 0,
    waterOnly: true,
    desc: 'Pond-only. Fires a lock-on missile (range = half the map). Self-destructs if the target dies or escapes.',
  },
};

// Warden dynamic placement cost: first $300, each additional +$100.
function wardenPlacementCost(existingCount) {
  return 300 + existingCount * 100;
}

// Is this tower buildable on the given 0-based map level?
function isTowerAvailable(type, levelIndex) {
  const def = TOWER_TYPES[type];
  return !!def && (levelIndex + 1) >= def.unlockLevel;
}

// Phase 29: per-level tower roster. A level may carry a `towers` array
// (set on the level generator page); when present, ONLY those towers are
// buildable there — a restriction layer on top of the unlockLevel gate.
// Levels without the field allow every unlocked tower (built-ins, older
// external/custom levels). getLevel comes from js/level_registry.js, which
// loads after this file; the call is late-bound and only happens at runtime.
function isTowerAllowedOnLevel(type, levelIndex) {
  if (!isTowerAvailable(type, levelIndex)) return false;
  const lvl = (typeof getLevel === 'function') ? getLevel(levelIndex) : null;
  if (!lvl || !lvl.towers) return true; // no roster = all unlocked towers allowed
  return lvl.towers.includes(type);
}

// Targeting modes a tower can use (set per tower after placement).
const TARGET_MODES = {
  first:     'First',      // furthest along the path
  last:      'Last',       // closest to the start
  closest:   'Closest',    // nearest to the tower
  strongest: 'Strongest',  // highest current HP
  weakest:   'Weakest',    // lowest current HP
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
// `desc` is a short 2-word legend blurb, shown only when the type has no resist.
const ENEMY_TYPES = {
  normal: { name: 'Minion',    hp: 40, speed: 70, reward: 7, livesCost: 1, radius: 11, color: '#e5533d', resist: [], unlockLevel: 1, desc: 'basic fodder' },
  tank:   { name: 'Tanked',    hp: 140, speed: 45, reward: 16, livesCost: 2, radius: 14, color: '#8e6bbf', resist: ['basic'], unlockLevel: 2 },
  hot:    { name: 'Singed',    hp: 45, speed: 70, reward: 10, livesCost: 1, radius: 11, color: '#ff8552', resist: ['frost'], unlockLevel: 3 },
  wet:    { name: 'Soused',    hp: 45, speed: 70, reward: 10, livesCost: 1, radius: 11, color: '#3fb6c9', resist: ['flame'], unlockLevel: 4 },
  fast:   { name: 'Skitterer', hp: 26, speed: 120, reward: 8, livesCost: 1, radius: 9, color: '#ffd76a', resist: ['cannon'], unlockLevel: 5 },
  camo:   { name: 'Prowler',   hp: 45, speed: 90, reward: 10, livesCost: 1, radius: 10, color: '#9aa77a', resist: ['sniper'], unlockLevel: 6 },
  // Colossus resists every damage tower EXCEPT the Mortar and the Reaper —
  // its two weaknesses. (Mortar shells deal damage as sourceType 'mortar' and
  // their DoTs apply without resistance, so no enemy can resist a mortar
  // payload; Phase 51 dropped 'reaper' so execute pressure matters on bosses.)
  boss:   { name: 'Colossus',  hp: 900, speed: 38, reward: 120, livesCost: 5, radius: 18, color: '#ff5da2',
            resist: ['basic', 'cannon', 'flame', 'frost', 'sniper', 'railgun',
                      'tesla', 'venom', 'mint', 'warden'], unlockLevel: 1 },
  // New roster (Phase 19): behavioral enemies. All unlock after level 6.
  // fission splits into spore children on death (splits); spore is childOnly —
  // it is never spawned by waves, only by a dying fission.
  fission:{ name: 'Fission',   hp: 120, speed: 55, reward: 14, livesCost: 1, radius: 13, color: '#9be15d', resist: [], unlockLevel: 7, desc: 'splits on death',
            splits: { key: 'spore', count: 2 } },
  spore:  { name: 'Spore',     hp: 14, speed: 135, reward: 2, livesCost: 1, radius: 7, color: '#d3f0a0', resist: [], unlockLevel: 7, desc: 'fast split child', childOnly: true },
  // bolt cycles walk -> dash (burst); frost slow scales both phases.
  // Walks 2.5s, then dashes for the final 1.0s of each 3.5s period.
  bolt:   { name: 'Bolt',      hp: 30, speed: 50, reward: 9, livesCost: 1, radius: 9, color: '#eef2ff', resist: ['sniper'], unlockLevel: 7,
            burst: { dashSpeed: 170, dashDur: 1.0, period: 3.5 } },
  // bulwark regenerates flat HP per second (capped at maxHp).
  bulwark:{ name: 'Bulwark',   hp: 220, speed: 40, reward: 18, livesCost: 2, radius: 15, color: '#8fa3bf', resist: [], unlockLevel: 7, desc: 'regenerates hp', regen: 6 },
  // mender heals other living enemies in radius (not itself), capped at maxHp.
  mender: { name: 'Mender',    hp: 90, speed: 60, reward: 12, livesCost: 1, radius: 11, color: '#e786c3', resist: [], unlockLevel: 7, desc: 'heals nearby foes',
            heal: { radius: 90, hps: 8 } },
  // wisp alternates solid/phased; phased = untargetable (splash + burn still hit);
  // frost slow pauses the phase cycle.
  wisp:   { name: 'Wisp',      hp: 60, speed: 75, reward: 11, livesCost: 1, radius: 10, color: '#c9b8ff', resist: [], unlockLevel: 7, desc: 'phases untargetable',
            phase: { solid: 2.5, phased: 1.2 } },
};

// Is this enemy type available in waves on the given 0-based map level?
function isEnemyAvailable(type, levelIndex) {
  const def = ENEMY_TYPES[type];
  return !!def && (levelIndex + 1) >= def.unlockLevel;
}

// Slow effect applied by frost towers (and Frost ammo fired by the Mortar —
// Enemy.applySlow reads these stats, so a retune here flows through both).
const SLOW = { factor: 0.5, duration: 1.5 };

// Fire spread: a burning enemy ignites any living enemy within this distance.
const FLAME_SPREAD_RADIUS = 26;
