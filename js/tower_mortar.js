// Mortar: a lobbed shell that flies to a FIXED impact point (no homing) and
// detonates there. The blast deals the selected ammo tower's damage + effect
// to every enemy in the blast radius (splash falloff, same curve as Cannon).
// Resistance never applies to mortar payloads: blast damage is sourceType
// 'mortar' (no enemy resists it) and the DoTs are applied with ignoreResist.
// Tesla ammo adds visual-only lightning lines between ALL in-blast enemies —
// no chain hops outward. Every detonation pushes an 'explosion' effect
// (splash ring, colored by the ammo type) into game.effects.

class MortarShell {
  constructor(spec) {
    this.x = spec.x;
    this.y = spec.y;
    this.tx = spec.tx;
    this.ty = spec.ty;
    this.speed = spec.speed;
    this.ammo = spec.ammo;
    this.blastRadius = spec.blastRadius;
    this.damage = spec.damage;
    this.sourceType = spec.sourceType; // 'mortar' — no enemy resists mortar
    this.slow = spec.slow || null;
    this.burn = spec.burn || null;
    this.poison = spec.poison || null;
    this.color = spec.color;
    this.alive = true;
    // Cosmetic lob: the shell rises in an arc while traveling.
    const d0 = Math.hypot(this.tx - this.x, this.ty - this.y);
    this.totalDist = d0 || 1;
    this.traveled = 0;
  }

  // Parabolic height offset (0 at launch and impact, peak mid-flight).
  get arc() {
    const t = Math.min(1, this.traveled / this.totalDist);
    return Math.sin(t * Math.PI) * 60;
  }

  // Returns the detonation spec on arrival, null while in flight.
  update(dt) {
    const dx = this.tx - this.x, dy = this.ty - this.y;
    const d = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (d <= step) {
      this.alive = false;
      return {
        x: this.tx, y: this.ty,
        blastRadius: this.blastRadius, damage: this.damage,
        sourceType: this.sourceType, ammo: this.ammo,
        slow: this.slow, burn: this.burn, poison: this.poison,
      };
    }
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    this.traveled += step;
    return null;
  }
}

// Detonate a mortar shell: splash-falloff damage to every enemy in the blast
// radius, then the ammo's effect on all of them. `game` provides onEnemyKilled.
function applyMortarBlast(impact, enemies, game) {
  if (!impact) return;
  const src = impact.sourceType; // 'mortar' — no enemy resists mortar payloads
  const inBlast = [];
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.pos.x - impact.x, e.pos.y - impact.y);
    if (d <= impact.blastRadius) {
      inBlast.push({ e, d });
      if (e.takeDamage(impact.damage * (1 - 0.4 * (d / impact.blastRadius)), src)) {
        game.onEnemyKilled(e);
      }
    }
  }

  // Effects apply to every survivor in the blast (not just a direct hit),
  // with ignoreResist — mortar payloads never respect enemy resistance.
  for (const { e } of inBlast) {
    if (!e.alive) continue;
    if (impact.slow) e.applySlow(true);
    if (impact.burn) e.applyBurn(impact.burn.dps, impact.burn.duration, true);
    if (impact.poison) {
      const p = impact.poison;
      e.applyPoison(p.addStacks, p.maxStacks, p.dpsPerStack, p.duration);
    }
  }

  // Visible splash: an explosion ring at the impact point, colored by the
  // ammo type (TOWER_TYPES[ammo].color). Sized to the blast radius.
  game.effects.push({
    type: 'explosion',
    x: impact.x, y: impact.y,
    radius: impact.blastRadius,
    color: TOWER_TYPES[impact.ammo].color,
    timer: 0.35, duration: 0.35,
  });

  // Tesla ammo: lightning lines between ALL in-blast enemies (visual only —
  // the damage was already dealt by the blast; no chain hops outward).
  if (impact.ammo === 'tesla' && inBlast.length >= 2) {
    const segments = [];
    for (let i = 0; i < inBlast.length - 1; i++) {
      const a = inBlast[i].e, b = inBlast[i + 1].e;
      segments.push({ x1: a.pos.x, y1: a.pos.y, x2: b.pos.x, y2: b.pos.y });
    }
    game.effects.push({ type: 'chain', segments, timer: 0.15 });
  }
}
