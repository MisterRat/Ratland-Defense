// Wave scheduler: builds per-wave spawn queues and times enemy spawns.

// Compose a wave's enemy list (1-based wave number, 0-based map level index).
// Procedural waves use the SAME difficulty model as generated levels: the
// level's `difficulty` (see LG_DIFFICULTY in js/levelgen_waves.js) drives
// wave size (base + floor(ramp*wave)), tank share, spawn pacing and the
// per-difficulty boss cadence via the shared composeWaveList(). The enemy
// POOL is still gated by
// each type's unlockLevel (map content, not difficulty): Minion from level 1,
// Tanked 2, Singed 3, Soused 4, Skitterer 5, Prowler 6; the boss appears on
// every level.
// Optional explicitWaves: a level's per-wave enemy lists (see PLAN_Levels.md).
// When present, wave i uses explicitWaves[i-1] instead of the generator —
// unknown enemy type keys are dropped with a warning (never crash on a bad
// level file). If the list is shorter than the level's totalWaves, later
// waves fall back to the generator.
function buildWave(wave, levelIndex = 0, explicitWaves = null) {
  if (explicitWaves && wave >= 1 && wave <= explicitWaves.length) {
    const list = [];
    for (const type of explicitWaves[wave - 1]) {
      if (!ENEMY_TYPES[type]) {
        console.warn(`[waves] level ${levelIndex + 1} wave ${wave}: unknown enemy type "${type}" dropped`);
        continue;
      }
      list.push(type);
    }
    return list;
  }
  const lvl = (typeof getLevel === 'function') ? getLevel(levelIndex) : null;
  const diffKey = (lvl && LG_DIFFICULTY[lvl.difficulty]) ? lvl.difficulty : 'normal';
  // childOnly types (spore) are never raw-spawned — only by a dying fission.
  const pool = Object.keys(ENEMY_TYPES).filter(k => isEnemyAvailable(k, levelIndex) && !ENEMY_TYPES[k].childOnly);
  return composeWaveList(wave, LG_DIFFICULTY[diffKey], pool);
}

class WaveManager {
  constructor(levelIndex = 0, totalWaves = TOTAL_WAVES, explicitWaves = null) {
    this.current = 0;          // waves started so far
    this.queue = [];           // enemy type names waiting to spawn
    this.spawnTimer = 0;
    this.betweenWaves = true;
    this.waitTimer = WAVE_DELAY; // countdown to next auto wave
    this.active = false;       // true while a wave is in progress
    this.levelIndex = levelIndex; // 0-based map (drives enemy availability)
    this.totalWaves = totalWaves; // waves to clear THIS level (per-level)
    this.explicitWaves = explicitWaves; // optional per-wave lists (level file)
    // Spawn pacing comes from the level's difficulty row (visible lever).
    const lvl = (typeof getLevel === 'function') ? getLevel(levelIndex) : null;
    const diffKey = (lvl && LG_DIFFICULTY[lvl.difficulty]) ? lvl.difficulty : 'normal';
    this.spawnGap = (LG_DIFFICULTY[diffKey] && LG_DIFFICULTY[diffKey].spawnGap) || 0.7;
    if (explicitWaves && explicitWaves.length > totalWaves) {
      console.warn(`[waves] level ${levelIndex + 1}: ${explicitWaves.length} waves listed but totalWaves is ${totalWaves}; extra entries ignored`);
    }
  }

  get inProgress() {
    return this.active || this.queue.length > 0;
  }

  // Called by the game: start (or force-start) the next wave.
  // Returns {bonus} money earned for sending early, or null if no wave pending.
  startNext(game, auto = false) {
    if (this.current >= this.totalWaves || this.inProgress) return null;
    let bonus = 0;
    if (!auto && this.waitTimer > 0) bonus = Math.floor(this.waitTimer);
    this.current++;
    this.queue = buildWave(this.current, this.levelIndex, this.explicitWaves);
    this.spawnTimer = 0;
    this.active = true;
    this.betweenWaves = false;
    return { wave: this.current, bonus };
  }

  // Returns enemy type names to spawn this frame (0..n).
  update(dt) {
    if (this.inProgress) {
      this.spawnTimer -= dt;
      const toSpawn = [];
      while (this.queue.length && this.spawnTimer <= 0) {
        toSpawn.push(this.queue.shift());
        this.spawnTimer += this.spawnGap; // seconds between spawns (difficulty lever)
      }
      if (!this.queue.length) {
        this.active = false;
        // Arm the auto-start countdown for the next wave (if any).
        if (this.current < this.totalWaves) this.waitTimer = WAVE_DELAY;
      }
      return toSpawn;
    }
    if (this.current < this.totalWaves) {
      this.waitTimer -= dt;
      if (this.waitTimer <= 0) return ['__auto__']; // signal: auto-start next
    }
    return [];
  }

  reset() {
    this.current = 0;
    this.queue = [];
    this.spawnTimer = 0;
    this.betweenWaves = true;
    this.waitTimer = 0;
    this.active = false;
  }
}
