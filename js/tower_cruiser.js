// Cruiser missile (Phase 55): a lock-on homing missile fired from a pond.
// Unlike the generic Projectile it does NOT fall back to lastTargetPos — if
// its target dies, or moves beyond the tower's live range, before impact,
// the missile self-destructs with no damage (a small puff marks the loss).
// On a successful intercept it returns an impact spec handled by applyImpact
// (splash 0 → direct hit only). Friendly fire (Phase 54) applies: crossing
// another tower consumes the missile and damages that tower.

class CruiserMissile {
  constructor(spec, sourceTower) {
    this.x = spec.x;
    this.y = spec.y;
    this.targetId = spec.targetId;
    this.sourceId = spec.sourceId || null;
    this.tower = sourceTower; // live ref — range checks use t.range (upgrades extend it)
    this.speed = spec.speed;
    this.damage = spec.damage;
    this.sourceType = spec.sourceType || 'cruiser';
    this.color = spec.color;
    this.alive = true;
    this.angle = 0; // heading, for rendering
  }

  // Returns an impact spec on intercept, null while in flight or on
  // self-destruct. `game` provides towers (friendly fire) and effects.
  update(dt, enemiesById, game) {
    const target = enemiesById.get(this.targetId);
    if (!target || !target.alive) return this.selfDestruct(game);

    // Target escaped the tower's range → missile self-destructs. Live read:
    // an upgraded tower keeps tracking targets farther out.
    const t = this.tower;
    if (t && t.alive && dist(t.x, t.y, target.pos.x, target.pos.y) > t.range) {
      return this.selfDestruct(game);
    }

    const dx = target.pos.x - this.x, dy = target.pos.y - this.y;
    const d = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (d <= step) {
      this.alive = false;
      return {
        x: target.pos.x, y: target.pos.y,
        direct: target,
        damage: this.damage, sourceType: this.sourceType,
        splash: 0, slow: null, burn: null, poison: null, execute: null,
      };
    }

    // Friendly fire (Phase 54): a tower crossed mid-flight stops the missile.
    if (game) {
      const nx = this.x + (dx / d) * step;
      const ny = this.y + (dy / d) * step;
      let hitTower = null, bestAlong = Infinity;
      for (const tw of game.towers.values()) {
        if (!tw.alive || tw.id === this.sourceId) continue; // never self-hit
        if (tw.immuneToFriendlyFire) continue; // Phase 57: support towers
        if (segDist(tw.x, tw.y, this.x, this.y, nx, ny) > TOWER_HIT_RADIUS) continue;
        const along = ((tw.x - this.x) * dx + (tw.y - this.y) * dy) / d;
        if (along < bestAlong) { bestAlong = along; hitTower = tw; }
      }
      if (hitTower) {
        this.alive = false;
        game.damageTower(hitTower, this.damage);
        return null;
      }
    }

    this.angle = Math.atan2(dy, dx); // heading, for rendering
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    return null;
  }

  // Self-destruct: no damage anywhere, just a small puff where it dies.
  selfDestruct(game) {
    this.alive = false;
    if (game) {
      game.effects.push({
        type: 'explosion', x: this.x, y: this.y,
        radius: 14, color: this.color, timer: 0.25, duration: 0.25,
      });
    }
    return null;
  }
}
