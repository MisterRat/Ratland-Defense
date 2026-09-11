// Enemy entity: walks the path, takes damage, can be slowed.

let nextId = 1;

class Enemy {
  constructor(typeName, wave, levelIndex = 0) {
    const def = ENEMY_TYPES[typeName];
    this.id = nextId++;
    this.type = typeName;
    this.def = def;
    this.levelIndex = levelIndex; // 0-based map level (drives resistance scaling)
    // HP scales with wave number (1-based) and the level's difficulty hpMul
    // (visible lever; defensive lookup — some test bundles lack getLevel).
    const lvl = (typeof getLevel === 'function') ? getLevel(levelIndex) : null;
    const diffKey = (lvl && LG_DIFFICULTY[lvl.difficulty]) ? lvl.difficulty : 'normal';
    const hpMul = (LG_DIFFICULTY[diffKey] && LG_DIFFICULTY[diffKey].hpMul) || 1;
    const scale = (1 + (wave - 1) * 0.22) * hpMul;
    this.maxHp = Math.round(def.hp * scale);
    this.hp = this.maxHp;
    this.distance = 0;          // distance travelled along the path
    this.speed = def.speed;
    this.slowTimer = 0;         // seconds of slow remaining
    this.burnDps = 0;           // burn damage per second (0 = not burning)
    this.burnTimer = 0;         // seconds of burn remaining
    this.burstTimer = 0;        // time within the bolt walk->dash cycle
    this.phaseTimer = 0;        // time within the wisp solid->phased cycle
    this.pos = { x: -999, y: -999 }; // set on first update
    this.alive = true;
    this.leaked = false;
  }

  get burning() { return this.burnTimer > 0; }

  // Wisp only: true while solid (targetable). Frost slow pauses the cycle,
  // so a slowed wisp stays in whatever phase it was in.
  get targetable() {
    if (!this.def.phase) return true;
    const p = this.def.phase;
    return (this.phaseTimer % (p.solid + p.phased)) < p.solid;
  }

  get currentSpeed() {
    let s = this.speed;
    // Bolt: dash phase of the walk->dash cycle (independent of slow). The
    // cycle starts walking and dashes at the end of each period.
    if (this.def.burst) {
      const b = this.def.burst;
      if ((this.burstTimer % b.period) > b.period - b.dashDur) s = b.dashSpeed;
    }
    return this.slowTimer > 0 ? s * SLOW.factor : s;
  }

  // Returns 'alive' | 'leaked' | 'burned' (killed by burn DoT)
  update(dt, path) {
    if (!this.alive) return 'dead';
    if (this.slowTimer > 0) this.slowTimer -= dt;
    // Bulwark: flat regen per second, capped at maxHp (ticks even while burning).
    if (this.def.regen) {
      this.hp = Math.min(this.maxHp, this.hp + this.def.regen * dt);
    }
    if (this.burnTimer > 0) {
      this.burnTimer -= dt;
      this.hp -= this.burnDps * dt;
      if (this.hp <= 0) {
        this.hp = 0;
        this.alive = false;
        return 'burned';
      }
    }
    // Bolt: advance the walk->dash cycle. Wisp: advance the phase cycle only
    // while not slowed (a slowed wisp is frozen in its current phase).
    if (this.def.burst) this.burstTimer += dt;
    if (this.def.phase && this.slowTimer <= 0) this.phaseTimer += dt;
    this.distance += this.currentSpeed * dt;
    const p = pointAtDistance(path, this.distance);
    if (!p) {
      this.alive = false;
      this.leaked = true;
      return 'leaked';
    }
    this.pos = p;
    return 'alive';
  }

  // Damage multiplier vs a tower type: reduced by the level-scaled resistance
  // (4% per map level, capped at 80%) if this enemy resists that tower.
  damageMultiplier(sourceType) {
    if (this.def.resist && this.def.resist.includes(sourceType)) {
      return 1 - resistanceFactor(this.levelIndex);
    }
    return 1;
  }

  // Returns true if this hit killed the enemy. `sourceType` is the tower key
  // that dealt the damage (undefined for unattributed damage, e.g. spread burn).
  takeDamage(amount, sourceType) {
    if (!this.alive) return false;
    this.hp -= amount * this.damageMultiplier(sourceType);
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return true;
    }
    return false;
  }

  applySlow() {
    this.slowTimer = SLOW.duration * this.damageMultiplier('frost');
  }

  // Ignite or refresh the burn (stronger DoT wins, duration refreshed).
  // Flame resistance scales both the dps and the duration.
  applyBurn(dps, duration) {
    if (!this.alive) return;
    const m = this.damageMultiplier('flame');
    this.burnDps = Math.max(this.burnDps, dps * m);
    this.burnTimer = Math.max(this.burnTimer, duration * m);
  }

  // Fraction of the path travelled (0..1) — used for "furthest" targeting.
  progress(pathTotal) {
    return Math.min(1, this.distance / pathTotal);
  }
}
