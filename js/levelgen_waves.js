// Level generator — waves module. Builds explicit per-wave enemy lists from
// the user's options: checked enemy types, difficulty (Easy/Normal/Hard/
// Nightmare), and wave count. Boss waves (every d.bossEvery-th) only when
// boss is checked.

// Difficulty levers (all visible to the player, none touch path length or
// economy): spawnGap = seconds between spawns, hpMul = enemy HP multiplier,
// lives = starting lives for the level, bossEvery = boss wave cadence.
const LG_DIFFICULTY = {
  easy:     { base: 4,  ramp: 0.6,  tank: 0.10, spawnGap: 0.7, hpMul: 1.00, lives: 20, bossEvery: 5, label: 'Easy' },
  normal:   { base: 6,  ramp: 1.0,  tank: 0.18, spawnGap: 0.7, hpMul: 1.05, lives: 20, bossEvery: 5, label: 'Normal' }, // Phase 51: 1.00→1.05
  hard:     { base: 8,  ramp: 1.4,  tank: 0.28, spawnGap: 0.5, hpMul: 1.10, lives: 15, bossEvery: 4, label: 'Hard' }, // Phase 51: 1.15→1.10
  nightmare:{ base: 10, ramp: 1.9,  tank: 0.38, spawnGap: 0.4, hpMul: 1.35, lives: 10, bossEvery: 3, label: 'Nightmare' },
};

// Compose ONE wave's enemy list from a difficulty row and an enemy pool.
// Shared by the generator (buildGeneratedWaves) and the built-in procedural
// waves (js/wave.js) so "difficulty" means the same thing everywhere:
//   regular wave: n = base + floor(ramp*wave) enemies, tank share floor(n*tank)
//                 (tanks only if the pool has them), rest round-robin the pool;
//   boss wave (every d.bossEvery-th, only when the pool has a boss): 1 boss + n escorts.
// Tank slots are evenly spread across the wave so types mix rather than clump.
function composeWaveList(wave, d, pool) {
  const hasBoss = pool.includes('boss');
  let list;
  if (hasBoss && wave % d.bossEvery === 0) {
    // Boss wave: boss + escorts from the pool (boss excluded).
    const escorts = pool.filter(k => k !== 'boss');
    const n = d.base + Math.floor(d.ramp * wave);
    list = ['boss'];
    for (let i = 0; i < n; i++) list.push(escorts.length ? escorts[i % escorts.length] : 'boss');
  } else {
    // Regular wave: count scales with wave number + difficulty; the tank
    // share is filled with tank if checked, else spread across the pool.
    const n = Math.max(2, d.base + Math.floor(d.ramp * wave));
    const nonBoss = pool.filter(k => k !== 'boss');
    const tankN = pool.includes('tank') ? Math.floor(n * d.tank) : 0;
    list = [];
    for (let i = 0; i < n; i++) {
      // Evenly spread tank slots: slot i is a tank when the fair-share
      // boundary floor((i+1)*tankN/n) > floor(i*tankN/n) is crossed.
      if (tankN > 0 && Math.floor(((i + 1) * tankN) / n) > Math.floor((i * tankN) / n)) list.push('tank');
      else list.push(nonBoss[i % nonBoss.length]);
    }
  }
  return list;
}

// opts: { enemies: [keys], difficulty: key, waves: int } -> array of per-wave lists.
function buildGeneratedWaves(opts) {
  const d = LG_DIFFICULTY[opts.difficulty] || LG_DIFFICULTY.normal;
  const pool = (opts.enemies || []).filter(k => ENEMY_TYPES[k]);
  if (!pool.length) return [];
  const out = [];
  for (let w = 1; w <= opts.waves; w++) {
    out.push(composeWaveList(w, d, pool));
  }
  return out;
}
