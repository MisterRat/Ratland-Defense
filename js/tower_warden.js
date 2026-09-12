// Warden aura: +25% damage to other towers within range (multiplicative).
// Never buffs itself. Computed per firing tower instance.

// Compute the combined Warden aura multiplier for a specific tower instance.
// `towers` = Map of all placed towers; `tower` = the tower that is firing.
function wardenAuraMultiplier(towers, tower) {
  let mult = 1;
  for (const t of towers.values()) {
    if (t === tower) continue; // never buffs itself
    if (t.type !== 'warden') continue;
    const d = Math.hypot(t.x - tower.x, t.y - tower.y);
    if (d <= t.range) mult *= TOWER_TYPES.warden.aura.multiplier;
  }
  return mult;
}
