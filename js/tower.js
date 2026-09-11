// Tower entity: targeting, firing cooldowns, upgrades, sell value.

let towerNextId = 1;

class Tower {
  constructor(typeName, cx, cy) {
    this.id = towerNextId++;
    this.type = typeName;
    this.def = TOWER_TYPES[typeName];
    this.cx = cx;
    this.cy = cy;
    this.level = 1;
    this.cooldown = 0;
    this.invested = this.def.cost; // total money spent (for sell refund)
    this.angle = 0;                // barrel angle, for rendering
    this.targetId = null;
    this.targetMode = 'first';     // key into TARGET_MODES
  }

  get x() { return (this.cx + 0.5) * GRID.cell; }
  get y() { return (this.cy + 0.5) * GRID.cell; }

  get range() { return this.def.range * LEVEL_SCALE.range[this.level - 1]; }
  get damage() { return this.def.damage * LEVEL_SCALE.damage[this.level - 1]; }
  get fireRate() { return this.def.fireRate * LEVEL_SCALE.fireRate[this.level - 1]; }

  upgradeCost() {
    if (this.level >= UPGRADE_COST_FACTOR.length + 1) return null;
    return Math.round(this.def.cost * UPGRADE_COST_FACTOR[this.level - 1]);
  }

  sellValue() {
    return Math.floor(this.invested * SELL_REFUND);
  }

  // Pick the best target within range according to this.targetMode.
  acquireTarget(enemies, pathTotal) {
    let best = null, bestScore = null;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (!e.targetable) continue; // wisp while phased: splash/burn still hit it
      if (dist(this.x, this.y, e.pos.x, e.pos.y) > this.range) continue;
      const score = this.scoreFor(e, pathTotal);
      if (bestScore === null || score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  // Higher score wins; ties keep the first candidate found.
  scoreFor(e, pathTotal) {
    switch (this.targetMode) {
      case 'last':      return -e.progress(pathTotal);
      case 'closest':   return -dist(this.x, this.y, e.pos.x, e.pos.y);
      case 'strongest': return e.hp;
      default:          return e.progress(pathTotal); // first
    }
  }

  // Returns a projectile spec {x, y, targetId, damage, ...} or null.
  update(dt, enemies, pathTotal) {
    if (this.cooldown > 0) this.cooldown -= dt;
    const target = this.acquireTarget(enemies, pathTotal);
    if (!target) return null;
    this.angle = Math.atan2(target.pos.y - this.y, target.pos.x - this.x);
    if (this.cooldown > 0) return null;
    this.cooldown = 1 / this.fireRate;
    // Piercing towers (Railgun) fire a fast straight slug instead of a homing
    // projectile: aim direction comes from the target at fire time.
    if (this.def.pierce) {
      return {
        x: this.x, y: this.y,
        targetId: target.id,
        tx: target.pos.x, ty: target.pos.y, // aim direction (no homing in flight)
        len: this.range,                    // slug flies the full tower range
        sourceType: this.type, // for enemy resistance checks
        speed: this.def.projSpeed,
        damage: this.damage,
        pierce: this.def.pierce,
        color: this.def.color,
      };
    }
    return {
      x: this.x, y: this.y,
      targetId: target.id,
      sourceType: this.type, // for enemy resistance checks
      speed: this.def.projSpeed,
      damage: this.damage,
      splash: this.def.splash,
      slow: this.def.slow > 0,
      burn: this.def.burn ? {
        dps: this.def.burn.dps * LEVEL_SCALE.damage[this.level - 1],
        duration: this.def.burn.duration,
      } : null,
      color: this.def.color,
    };
  }
}
