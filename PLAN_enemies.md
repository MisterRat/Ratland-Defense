# PLAN_enemies — 5 New Enemy Types (design for review)

Status: **PROPOSAL — awaiting review, no code changed yet.**

Five new enemy designs that slot into the existing `ENEMY_TYPES` schema
(`js/config.js`) and the current tower set (Gun, Frost, Flame, Cannon, Sniper,
Railgun). Each design introduces a *behavioral* hook the current roster lacks
(regen, splitting, speed-burst, healing aura, phasing) rather than just another
resist swap, and each has a clear counter in the existing towers.

## Roster at a glance

| key | name | role | wave-1 HP | speed | reward | livesCost | radius | color | unlockLevel |
|---|---|---|---|---|---|---|---|---|---|
| `fission` | Fission | splits on death | 120 | 55 | 14 | 1 | 13 | `#9be15d` | 7 |
| `spore` | Spore | split child (childOnly) | 14 | 135 | 2 | 1 | 7 | `#d3f0a0` | 7 |
| `bolt` | Bolt | dash-burst runner | 30 | 50→170 | 9 | 1 | 9 | `#eef2ff` | 8 |
| `bulwark` | Bulwark | regenerating wall | 220 | 40 | 18 | 2 | 15 | `#8fa3bf` | 9 |
| `mender` | Mender | heal aura | 90 | 60 | 12 | 1 | 11 | `#e786c3` | 10 |
| `wisp` | Wisp | phases untargetable | 60 | 75 | 11 | 1 | 10 | `#c9b8ff` | 11 |

Stats are wave-1 baselines; the existing scale `(1 + 0.22·(wave−1)) × hpMul`
applies to HP exactly as it does today. Reward-per-HP follows the current
profiles (tanks pay ~0.08–0.12/hp, fast types ~0.30/hp).

Unlock levels 7–11: the built-in campaign has six maps, so these gate on
**registry index ≥ 7** (external/custom levels) and on **explicit per-wave
lists** in level files. The generator page exposes them immediately via its
enemy checkboxes (it iterates `ENEMY_TYPES`), so generated levels can use them
on day one regardless of unlockLevel.

---

## 1. Fission (+ Spore child) — "splits on death"

**Def:** `fission: { name:'Fission', hp:120, speed:55, reward:14, livesCost:1,
radius:13, color:'#9be15d', resist:[], unlockLevel:7, splits:{ key:'spore', count:2 } }`
and `spore: { name:'Spore', hp:14, speed:135, reward:2, livesCost:1, radius:7,
color:'#d3f0a0', resist:[], unlockLevel:7, childOnly:true }`.

**Mechanic:** when a Fission dies (any cause — direct hit, splash, burn), it
spawns 2 Spores at its exact path position. Spores are fast, fragile fodder;
they do not split further. Total payout if you clean up the spores: 14 + 2×2 =
18 (slightly above Tanked's 16, but only if you finish the follow-up).

**Counterplay:** Frost slows the whole swarm (the real threat is the spore
leak, not the parent); Cannon splash mops up clustered spores; high single-target
(Sniper) finishes spores before they reach the exit. The trap it sets: a Sniper
killing the parent "efficiently" is what creates the swarm — players must
budget for the follow-up.

**Implementation:** `config.js` (2 defs); `game.js onEnemyKilled()` — if
`enemy.def.splits`, push `count` new `Enemy(splits.key, wave, levelIndex)` at
`enemy.pos`/`enemy.distance` (~6 lines); one-line pool filter for `childOnly`
in `js/wave.js buildWave()` and the generator checkbox builder in
`levelgen.html` so Spore never appears as a selectable/raw-spawn type; add both
keys to the legend `order` array in `js/ui.js`.

**Notes:** spore children inherit the parent's wave/levelIndex for HP scaling.
No renderer change (circles + HP bar already generic).

## 2. Bolt — "dash-burst runner"

**Def:** `bolt: { name:'Bolt', hp:30, speed:50, reward:9, livesCost:1, radius:9,
color:'#eef2ff', resist:['sniper'], unlockLevel:8, burst:{ dashSpeed:170, dashDur:0.8, period:3.5 } }`.

**Mechanic:** cycles walk (50 px/s) → dash (170 px/s for 0.8 s) every 3.5 s.
The cycle is independent of slow; Frost's 50% factor applies to *both* phases
(slowed dash = 85, still faster than a normal Minion).

**Counterplay:** Sniper (2.2 s cooldown + projectile travel) frequently misses
the dash window — hence `resist:['sniper']` (level-scaled resistance on top of
the timing problem). Cannon splash doesn't need a lock-on; Railgun's instant
pierce slug hits mid-dash; Frost keeps it in range longer.

**Implementation:** `config.js` (def); `js/enemy.js` — a `burstTimer` field,
advance in `update()`, and `currentSpeed()` returns the dash speed while the
timer is inside the dash window (~10 lines). No other files touched.

**Notes:** reward 9 / 30 hp = 0.30/hp matches Skitterer's fast-pay profile.
Bolt is a *timing* enemy, not an armor enemy — its low HP means any decent
setup kills it; the dash only matters against sniper-heavy builds.

## 3. Bulwark — "regenerating wall"

**Def:** `bulwark: { name:'Bulwark', hp:220, speed:40, reward:18, livesCost:2,
radius:15, color:'#8fa3bf', resist:[], unlockLevel:9, regen:6 }`.

**Mechanic:** regenerates 6 HP/s (capped at maxHp), always. Net progress
requires sustained DPS above the regen; burst damage that falls below the regen
line between volleys is partially wasted.

**Counterplay:** Frost — slowing it keeps it in tower range longer, so total
damage taken rises while regen stays flat (regen is per-second of *life*, not
of path distance… correction: it ticks in real time, so slow *helps* by
increasing the overlap with towers' fire); Cannon keeps constant pressure on
it and its neighbors; Flame's burn (10 dps) outpaces the 6/s regen. The trap:
a single maxed Sniper feels like it's winning until the Bulwark shrugs off the
downtime between shots.

**Implementation:** `config.js` (def); `js/enemy.js update()` —
`if (this.def.regen) this.hp = Math.min(this.maxHp, this.hp + this.def.regen*dt)`
(~3 lines). Nothing else.

**Notes:** no resist list — the mechanic *is* the identity (like Minion's
blank slate). livesCost 2 matches its Tanked-tier threat. At high waves the
flat regen becomes less significant vs. scaled HP, which is fine: it's a
level-9+ enemy and later waves bring bigger numbers across the board.

## 4. Mender — "heal aura"

**Def:** `mender: { name:'Mender', hp:90, speed:60, reward:12, livesCost:1,
radius:11, color:'#e786c3', resist:[], unlockLevel:10, heal:{ radius:90, hps:8 } }`.

**Mechanic:** each tick, heals every *other* living enemy within 90 px by
8 hp/s (capped at their maxHp). It does not heal itself. With spawn gaps of
0.4–0.7 s, a Mender walking in the middle of a wave group keeps 2–5 neighbors
topped up — effectively adding ~8 hp/s of "tankiness" to the whole cluster.

**Counterplay:** AoE is the answer — Cannon splash kills the Mender and its
patients in one hit; 'first' targeting reaches it as it leads its pack; a
Sniper burst drops it before the aura matters. The trap: single-target
micro-management (killing one enemy at a time) stalls against the healed
cluster, and players who ignore it let the whole wave arrive fresh.

**Implementation:** `config.js` (def); a `mendAura(enemies)` pass modeled on
the existing `spreadFire()` in `js/projectile.js` (~12 lines: for each living
enemy with `def.heal`, heal allies in radius, skip self); one call in
`js/game.js update()` right after `spreadFire(...)` (1 line).

**Notes:** 8 hps vs. a level-1 Gun's 30 dps is meaningful but not dominant —
it extends fights rather than making enemies unkillable. If playtesting shows
it's too strong on Nightmare (dense packs, 0.4 s gaps), the lever is `hps`,
not the radius.

## 5. Wisp — "phases untargetable"

**Def:** `wisp: { name:'Wisp', hp:60, speed:75, reward:11, livesCost:1, radius:10,
color:'#c9b8ff', resist:[], unlockLevel:11, phase:{ solid:2.5, phased:1.2 } }`.

**Mechanic:** cycles 2.5 s solid → 1.2 s phased. While phased it is
**untargetable**: `Tower.acquireTarget()` skips it, so no direct hit can be
aimed at it. Splash damage (Cannon impact) and burn DoT (Flame) still apply —
they don't require targeting. Frost's slow **pauses the phase cycle** while
`slowTimer > 0` (frozen in place, frozen in phase).

**Counterplay:** Flame — burn ticks through the phase and often finishes the
Wisp mid-window; Cannon — splash hits it regardless of phase; Frost — a slowed
Wisp stays solid longer in absolute path terms. The trap: Gun/Sniper/Railgun
builds watch their aim pass *through* it during phase windows, and players who
over-rely on single-target DPS stall.

**Implementation:** `config.js` (def); `js/enemy.js` — `phaseTimer`, a
`targetable` getter, advance the timer in `update()` only when
`slowTimer <= 0` (~10 lines); `js/tower.js acquireTarget()` — one skip line
(`if (!e.targetable) continue;`). Splash (`applyImpact`) and burn paths are
untouched by design.

**Notes:** renderer can later tint phased Wisps at 40% alpha using the same
`targetable` getter (optional polish, out of scope for the core drop).

---

## Cross-cutting changes (all five together)

1. **`js/config.js`** — six new `ENEMY_TYPES` entries (5 designs; Fission's
   Spore child is the sixth entry). File stays well under the 300-line limit.
2. **`js/enemy.js`** — regen tick, burst timer, phase timer + `targetable`.
   Stays under 300 lines (~99 now, ~130 after).
3. **`js/game.js`** — split-on-death in `onEnemyKilled`; `mendAura` call in
   `update()`.
4. **`js/tower.js`** — one line: skip untargetable enemies.
5. **`js/projectile.js`** — `mendAura()` next to `spreadFire()`.
6. **`js/wave.js` + `levelgen.html`** — exclude `childOnly` types from the
   procedural pool and generator checkboxes (Spore is never a raw spawn).
7. **`js/ui.js`** — legend `order` array gains the new keys (legend rows,
   swatches and resist text are built automatically).
8. **No renderer changes required** for the core drop (generic circle + HP bar
   + burn flames already exist).

## Tests to add/update (per AGENTS.md: incremental, in `tests/`)

- `smoke_enemy_unlock.mjs` — extend the unlock table with the five new keys
  (7–11) and `isEnemyAvailable` cases; assert Spore is excluded from
  `buildWave` pools at every level.
- New `smoke_split.mjs` — Fission death spawns exactly 2 Spores at its
  position with correct wave-scaled HP; Spores don't re-split.
- New `smoke_burst.mjs` — Bolt speed alternates on schedule; Frost slow scales
  both phases.
- New `smoke_regen.mjs` — Bulwark regen caps at maxHp and ticks while burning.
- New `smoke_mend.mjs` — Mender heals allies in radius, not itself, capped at
  maxHp.
- New `smoke_phase.mjs` — Wisp untargetable while phased; splash + burn still
  apply; slow pauses the cycle.
- `smoke_difficulty.mjs` / `smoke_levelgen.mjs` — re-run; built-in levels
  (indices 0–5) are unaffected since all new types unlock at ≥ 7, and
  `composeWaveList` handles arbitrary pools.

## Open questions for review

1. **Unlock spacing** — 7→11 one-per-level matches the existing cadence but
   means none of these appear in the six built-in maps. Alternative: pull two
   (e.g. Fission at 6, Bolt at 5) into the campaign and rebalance those maps.
2. **Bulwark resist** — currently no resist list. If we want every non-boss
   enemy to resist exactly one tower (the current pattern), `resist:['sniper']`
   fits thematically (burst falls below the regen line between shots).
3. **Wisp + Frost interaction** — slow pauses the phase cycle (proposed) vs.
   slow is irrelevant to phasing (simpler, but makes Frost a non-counter).
4. **Mender heal strength** — 8 hps is tuned for Normal; Nightmare packs may
   want it re-tested before shipping.
