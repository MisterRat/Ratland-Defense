// Projectile: homes in on its target; applies damage, splash, and slow on impact.

class Projectile {
  constructor(spec) {
    this.x = spec.x;
    this.y = spec.y;
    this.targetId = spec.targetId;
    this.speed = spec.speed;
    this.damage = spec.damage;
    this.sourceType = spec.sourceType || null; // tower key that fired this
    this.splash = spec.splash;
    this.slow = spec.slow;
    this.burn = spec.burn || null; // {dps, duration} applied to direct hit
    this.poison = spec.poison || null; // {addStacks, maxStacks, dpsPerStack, duration}
    this.execute = spec.execute || null; // {threshold, multiplier} — Reaper
    this.color = spec.color;
    this.alive = true;
    this.lastTargetPos = null; // fallback if target dies mid-flight
  }

  // Returns impact {x, y, direct: enemy|null} on arrival, null while in flight.
  update(dt, enemiesById) {
    const target = enemiesById.get(this.targetId);
    let tx, ty;
    if (target && target.alive) {
      this.lastTargetPos = target.pos;
      tx = target.pos.x; ty = target.pos.y;
    } else if (this.lastTargetPos) {
      tx = this.lastTargetPos.x; ty = this.lastTargetPos.y;
    } else {
      this.alive = false; // no target ever existed
      return null;
    }

    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (d <= step) {
      this.alive = false;
      return {
        x: tx, y: ty,
        direct: (target && target.alive) ? target : null,
        damage: this.damage, sourceType: this.sourceType,
        splash: this.splash, slow: this.slow, burn: this.burn,
        poison: this.poison, execute: this.execute,
      };
    }
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    return null;
  }
}

// Apply an impact to the enemy list. `game` provides onEnemyKilled(e).
function applyImpact(impact, enemies, game) {
  if (!impact) return;
  const src = impact.sourceType; // tower key; resistance is checked per enemy
  const hit = (e, dmg) => {
    if (!e.alive) return;
    if (e.takeDamage(dmg, src)) game.onEnemyKilled(e);
  };

  // Reaper execute: at impact time, a direct target below the HP threshold
  // takes multiplied damage (finishes off regen/heal targets).
  let dmg = impact.damage;
  if (impact.execute && impact.direct && impact.direct.alive) {
    const ex = impact.execute;
    if (impact.direct.hp / impact.direct.maxHp < ex.threshold) dmg *= ex.multiplier;
  }

  if (impact.splash > 0) {
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - impact.x, e.pos.y - impact.y);
      if (d <= impact.splash) hit(e, dmg * (1 - 0.4 * (d / impact.splash)));
    }
  } else if (impact.direct) {
    hit(impact.direct, dmg);
  }

  if (impact.slow) {
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - impact.x, e.pos.y - impact.y);
      const radius = impact.splash > 0 ? impact.splash : 1;
      if (d <= radius) e.applySlow();
    }
  }

  if (impact.burn && impact.direct) {
    impact.direct.applyBurn(impact.burn.dps, impact.burn.duration);
  }

  // Venom: stacking poison on the direct hit (ticks through wisp phase).
  if (impact.poison && impact.direct && impact.direct.alive) {
    const p = impact.poison;
    impact.direct.applyPoison(p.addStacks, p.maxStacks, p.dpsPerStack, p.duration);
  }
}

// Fire spreads: each burning enemy ignites any living enemy in contact.
function spreadFire(enemies, game) {
  for (const e of enemies) {
    if (!e.alive || !e.burning) continue;
    for (const o of enemies) {
      if (o === e || !o.alive || o.burning) continue;
      const d = Math.hypot(o.pos.x - e.pos.x, o.pos.y - e.pos.y);
      if (d <= FLAME_SPREAD_RADIUS) o.applyBurn(e.burnDps, e.burnTimer);
    }
  }
}

// Mender aura: each living mender heals every OTHER living enemy within its
// heal radius (never itself), capped at the ally's maxHp. Mirrors spreadFire().
function mendAura(enemies, dt) {
  for (const e of enemies) {
    if (!e.alive || !e.def.heal) continue;
    const h = e.def.heal;
    for (const o of enemies) {
      if (o === e || !o.alive) continue;
      const d = Math.hypot(o.pos.x - e.pos.x, o.pos.y - e.pos.y);
      if (d <= h.radius) o.hp = Math.min(o.maxHp, o.hp + h.hps * dt);
    }
  }
}

// Railgun slug: a small fast projectile that flies straight along its aim
// direction (no homing) and pierces through enemies as it passes. Damage
// halves per penetration, in the order the slug reaches them.
const PIERCING_HIT_RADIUS = 14; // enemy center within this distance of the path

// Min distance from point (px,py) to segment (x1,y1)-(x2,y2).
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

class PiercingShot {
  constructor(spec) {
    this.x = spec.x;
    this.y = spec.y;
    const dx = spec.tx - spec.x, dy = spec.ty - spec.y;
    const d = Math.hypot(dx, dy);
    this.ux = d ? dx / d : 1; // aim direction (unit vector), fixed at fire time
    this.uy = d ? dy / d : 0;
    this.speed = spec.speed;
    this.len = spec.len || d;   // max travel distance
    this.damage = spec.damage;
    this.sourceType = spec.sourceType || null;
    this.pierce = spec.pierce || 1;
    this.color = spec.color;
    this.alive = true;
    this.traveled = 0;
    this.hitIds = new Set(); // enemies this slug has already hit
  }

  // Advance the slug; damage each newly pierced enemy. Segment-based distance
  // check so a fast slug can never skip an enemy between frames.
  update(dt, enemies, game) {
    const step = this.speed * dt;
    const px = this.x, py = this.y;
    this.x += this.ux * step;
    this.y += this.uy * step;
    this.traveled += step;

    const fresh = [];
    for (const e of enemies) {
      if (!e.alive || this.hitIds.has(e.id)) continue;
      if (segDist(e.pos.x, e.pos.y, px, py, this.x, this.y) <= PIERCING_HIT_RADIUS) {
        fresh.push(e);
      }
    }
    // Damage in the order the slug reaches them (distance along the ray).
    fresh.sort((a, b) =>
      (a.pos.x - px) * this.ux + (a.pos.y - py) * this.uy -
      ((b.pos.x - px) * this.ux + (b.pos.y - py) * this.uy));
    for (const e of fresh) {
      this.hitIds.add(e.id);
      const dmg = this.damage / Math.pow(2, this.hitIds.size - 1); // halves each time
      if (e.takeDamage(dmg, this.sourceType)) game.onEnemyKilled(e);
    }

    if (this.hitIds.size >= this.pierce || this.traveled >= this.len) {
      this.alive = false;
    }
  }
}
