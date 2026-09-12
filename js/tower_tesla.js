// Tesla chain lightning: instant bolt + N hops with damage falloff.
// No projectile — damage is applied immediately on fire.

// Apply a chain lightning hit. `spec` = {x, y, targetId, damage, chain:{hops,hopRadius,falloff}, sourceType}.
// Damage in spec is already Warden-aura-multiplied. Hits phased enemies (no targetable check).
function applyChainLightning(game, spec) {
  const { hops, hopRadius, falloff } = spec.chain;
  const segments = [];
  const hitIds = new Set();
  let dmg = spec.damage;
  let fromX = spec.x, fromY = spec.y;
  let target = game.enemiesById.get(spec.targetId);

  // Primary hit (always hits, even if phased — chain ignores targetable check).
  if (target && target.alive) {
    hitIds.add(target.id);
    if (target.takeDamage(dmg, spec.sourceType)) game.onEnemyKilled(target);
    segments.push({ x1: fromX, y1: fromY, x2: target.pos.x, y2: target.pos.y });
    fromX = target.pos.x; fromY = target.pos.y;
  }

  // Hops: find nearest un-hit enemy within hopRadius of the last hit.
  for (let h = 0; h < hops; h++) {
    dmg *= falloff;
    let best = null, bestD = Infinity;
    for (const e of game.enemies) {
      if (!e.alive || hitIds.has(e.id)) continue;
      const d = Math.hypot(e.pos.x - fromX, e.pos.y - fromY);
      if (d <= hopRadius && d < bestD) { bestD = d; best = e; }
    }
    if (!best) break;
    hitIds.add(best.id);
    if (best.takeDamage(dmg, spec.sourceType)) game.onEnemyKilled(best);
    segments.push({ x1: fromX, y1: fromY, x2: best.pos.x, y2: best.pos.y });
    fromX = best.pos.x; fromY = best.pos.y;
  }

  // Push a short-lived visual effect for the renderer.
  game.effects.push({ type: 'chain', segments, timer: 0.15 });
}
