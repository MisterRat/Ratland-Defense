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
    this.hp = this.maxHp;          // Phase 54: destructible — friendly fire
    this.alive = true;
    this.angle = 0;                // barrel angle, for rendering
    this.targetId = null;
    this.targetMode = 'first';     // key into TARGET_MODES
    this.incomeTimer = this.def.income ? this.def.income.interval : 0;
    // Mortar: selected ammo flavor + player-chosen impact point (pixel coords).
    this.ammo = this.def.ammoDefault || null;
    this.targetPoint = null;
  }

  get x() { return (this.cx + 0.5) * GRID.cell; }
  get y() { return (this.cy + 0.5) * GRID.cell; }

  get range() { return this.def.range * LEVEL_SCALE.range[this.level - 1]; }
  get damage() { return this.def.damage * LEVEL_SCALE.damage[this.level - 1]; }
  get fireRate() { return this.def.fireRate * LEVEL_SCALE.fireRate[this.level - 1]; }

  // Phase 54: durability scales with total money invested, so upgrades make a
  // tower harder to destroy (and upgradeTower heals it by the delta).
  get maxHp() { return Math.round(this.invested * TOWER_HP_PER_COST); }

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

  // Returns a spec object or null. Spec types:
  //   {type:'chain', ...}   — Tesla chain lightning (instant, no projectile)
  //   {type:'income', ...}  — Mint economy tick
  //   {pierce: n, ...}      — Railgun slug
  //   {targetId, ...}       — homing projectile (default)
  update(dt, enemies, pathTotal, auraMult = 1) {
    if (this.cooldown > 0) this.cooldown -= dt;

    // Warden: passive aura tower, never fires.
    if (this.def.aura) return null;

    // Mint: economy tower — no target, ticks on its own timer.
    if (this.def.income) {
      this.incomeTimer -= dt;
      if (this.incomeTimer <= 0) {
        this.incomeTimer = this.def.income.interval;
        const amount = Math.round(this.def.income.amount * LEVEL_SCALE.damage[this.level - 1]);
        return { type: 'income', amount };
      }
      return null;
    }

    // Mortar: dumb artillery. No target acquisition — fires at the stored
    // impact point on every cooldown tick, even with no enemy there. Until a
    // targetPoint is chosen (after placement / via Retarget), it does not fire.
    if (this.def.ammoTypes) {
      if (!this.targetPoint) return null;
      if (this.cooldown > 0) return null;
      this.cooldown = 1 / this.fireRate;
      const tp = TOWER_TYPES[this.ammo]; // the ammo tower defines the payload
      const dmgScale = LEVEL_SCALE.damage[this.level - 1] * auraMult;
      return {
        type: 'mortar',
        x: this.x, y: this.y,
        tx: this.targetPoint.x, ty: this.targetPoint.y,
        ammo: this.ammo,
        blastRadius: this.def.range * LEVEL_SCALE.range[this.level - 1],
        damage: tp.damage * dmgScale,
        // Mortar payloads bypass resistance entirely: blast damage is
        // sourceType 'mortar' (no enemy resists it), and applyMortarBlast
        // applies the DoTs/slow with ignoreResist. The ammo still sets the
        // DoT TYPE (burn/poison/slow) and its stats — just no resistance.
        sourceType: 'mortar',
        speed: this.def.projSpeed,
        // Boolean convention (same as the homing path): Enemy.applySlow reads
        // the slow stats from SLOW, so a Frost retune flows through here too.
        slow: tp.slow > 0,
        burn: tp.burn ? { dps: tp.burn.dps * dmgScale, duration: tp.burn.duration } : null,
        poison: tp.poison ? {
          addStacks: 1, maxStacks: tp.poison.stacks,
          dpsPerStack: tp.poison.dpsPerStack * dmgScale, duration: tp.poison.duration,
        } : null,
        color: this.def.color,
      };
    }

    const target = this.acquireTarget(enemies, pathTotal);
    if (!target) return null;
    this.angle = Math.atan2(target.pos.y - this.y, target.pos.x - this.x);
    if (this.cooldown > 0) return null;
    this.cooldown = 1 / this.fireRate;

    // Tesla: chain lightning — instant bolt + hops, no projectile.
    if (this.def.chain) {
      return {
        type: 'chain',
        x: this.x, y: this.y,
        targetId: target.id,
        damage: this.damage * auraMult,
        chain: this.def.chain,
        sourceType: this.type,
        color: this.def.color,
      };
    }

    // Piercing towers (Railgun) fire a fast straight slug.
    if (this.def.pierce) {
      return {
        x: this.x, y: this.y,
        sourceId: this.id, // Phase 54: slugs never damage their own tower
        targetId: target.id,
        tx: target.pos.x, ty: target.pos.y,
        len: this.range,
        sourceType: this.type,
        speed: this.def.projSpeed,
        damage: this.damage * auraMult,
        pierce: this.def.pierce,
        color: this.def.color,
      };
    }

    // Homing projectile (default).
    return {
      x: this.x, y: this.y,
      sourceId: this.id, // Phase 54: friendly fire excludes the firing tower
      targetId: target.id,
      sourceType: this.type,
      speed: this.def.projSpeed,
      damage: this.damage * auraMult,
      splash: this.def.splash,
      slow: this.def.slow > 0,
      burn: this.def.burn ? {
        dps: this.def.burn.dps * LEVEL_SCALE.damage[this.level - 1] * auraMult,
        duration: this.def.burn.duration,
      } : null,
      poison: this.def.poison ? {
        addStacks: 1,
        maxStacks: this.def.poison.stacks,
        dpsPerStack: this.def.poison.dpsPerStack * LEVEL_SCALE.damage[this.level - 1] * auraMult,
        duration: this.def.poison.duration,
      } : null,
      execute: this.def.execute || null,
      color: this.def.color,
    };
  }
}
