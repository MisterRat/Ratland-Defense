# PLAN_towers — 5 New Tower Types

Status: **APPROVED & IMPLEMENTED** (review settled 2026-09-11).

Five new towers shipped (Glacier dropped as too similar to Frost): Tesla,
Venom, Reaper, Mint, Warden. All unlock at level 7 (registry index ≥ 7,
external/custom levels only). Review decisions: all five at L7; Mint income is
excluded from `stats.moneyEarned` and explained in its shop desc; Warden uses a
dynamic cost ($300 first, +$100 per existing Warden) instead of a flat $170.

Each fills a role gap in the previous six-tower set (no chain multi-hit, no
stacking DoT, no execute, no economy, no support aura), and each has a clear
counter against at least one Phase-19 enemy behavior (split, dash, regen, heal
aura, phasing) — except Mint, which is pure economy.

## Roster at a glance

| key | name | role | cost | range | dmg | rate | mechanic | unlockLevel |
|---|---|---|---|---|---|---|---|---|
| `tesla` | Tesla | chain multi-hit | $200 | 130 | 18 | 1.8/s | chains to 4 foes, ×0.8 per hop, r90 | 7 |
| `venom` | Venom | stacking poison | $110 | 135 | 4 | 2.2/s | 5 stacks × 6 dps, 3s refresh | 7 |
| `reaper` | Reaper | execute finisher | $180 | 150 | 20 | 1.4/s | ×2.5 dmg below 30% HP | 7 |
| `mint` | Mint | economy income | $150 | — | — | 1/8s | +$10 per tick, upgrade-scaled | 7 |
| `warden` | Warden | damage aura | $300 first, +$100 each | 100 (aura) | — | — | +25% dmg to towers in radius | 7 |

All five unlock at **level 7**: the built-in campaign has six maps, so they gate
on **registry index ≥ 7** (external/custom levels) exactly like the Phase-19
enemies. Built-in maps and their existing smoke-test expectations are untouched.
Shop, lock labels (`🔒 Name — Lv 7`) and targeting UI adapt automatically
(`buildShop` iterates `TOWER_TYPES`).

---

## 1. Tesla — "chain lightning"

**Def:** `tesla: { name:'Tesla', cost:200, color:'#ffe14d', unlockLevel:7, img:'assets/tesla.png', range:130, damage:18, fireRate:1.8, projSpeed:0, chain:{ count:4, falloff:0.8, radius:90 }, slow:0, splash:0, desc:'Instant bolt chains to 4 nearby foes, −20% per hop.' }`

**Mechanic:** fires an *instant* bolt (no flight time) at the acquired target for
full damage, then jumps to up to `count−1` additional living enemies within
`radius` px of the previous hit, each taking `damage × falloff^hop`. A jumped-to
enemy is not re-hit in the same chain. No projectile object: `Tower.update()`
returns a spec with `chain`, and `game.js` applies it immediately (a short-lived
visual polyline goes into a small `effects` list, like `shots`).

**Counterplay:**
- **Mender:** the chain kills the Mender *and* its two nearest dependents in one
  bolt — the heal aura dies with its cluster.
- **Spore swarms:** clustered split-children get hit by the same chain; one shot
  can take 3–4 spores (18 → 14.4 → 11.5 → 9.2 vs 14-hp wave-1 spores).
- **Wisp:** the *initial* target must be solid (normal targeting), but chain
  hops are positional, not targeted — a phased Wisp standing near a hit enemy
  still takes chain damage. Same rule as splash/burn.

**Implementation:** `config.js` (def); `tower.js` — new branch in `update()`:
if `this.def.chain`, return the chain spec (~10 lines, no target homing);
`game.js` — apply chain hits inline + push a visual effect (~25 lines, new
`applyChain(game, spec, enemies)` helper lives in a new `js/tower_tesla.js`
module to keep game.js under 300 lines); `sfx_sounds.js` — `FIRE_SOUND.tesla =
'crack'` (reuse) or a new `zap` synth; `assets/tesla.png`; legend entry in
`js/ui.js` order array.

**Notes:** `projSpeed: 0` is the "instant" marker (Railgun uses high speed for
its slug). Chain hops respect `damageMultiplier(sourceType='tesla')`, so a
future resist list works with zero extra code. No `splash`/`slow` fields set —
hops are direct hits only.

## 2. Venom — "stacking poison"

**Def:** `venom: { name:'Venom', cost:110, color:'#7ed321', unlockLevel:7, img:'assets/venom.png', range:135, damage:4, fireRate:2.2, projSpeed:420, splash:0, slow:0, poison:{ stacks:5, dpsPerStack:6, duration:3 }, desc:'Each hit adds a poison stack (max 5): 6 dps/stack for 3s.' }`

**Mechanic:** every direct hit applies one poison stack (up to `stacks`). Each
stack deals `dpsPerStack` dps while the DoT is live; re-applying refreshes the
duration and adds a stack. Total at cap: 5 × 6 = 30 dps — triple Flame's flat
10, but it needs 2.2 hits/s to build (Flame deals damage immediately). Stacks
decay only when the timer expires (no per-stack expiry), same model as burn.

**Counterplay:**
- **Bulwark:** flat regen is 6 hp/s; a fully stacked Venom does 30 dps — net
  −24 hp/s even at wave 1, and the gap widens with wave scaling. Flame (10 dps)
  barely outpaces regen; Cannon's burst doesn't sustain. Venom is the *only*
  tower that reliably kills a full-HP Bulwark solo.
- **Wisp:** poison ticks through phasing like burn (DoT, not targeting).
- **Fission:** the parent dies with stacks on it; children spawn clean — no
  inheritance (same as burn today).

**Implementation:** `config.js` (def); `enemy.js` — `poisonStacks` /
`poisonTimer` fields, tick in `update()` right after burn (~8 lines), new
`applyPoison(stacks, dpsPerStack, duration)` that sets
`poisonDps = stacks × dpsPerStack` (max wins) and refreshes the timer;
`projectile.js` — impact spec carries `poison`, `applyImpact` calls
`e.applyPoison(...)` (~5 lines); `tower.js` — spec passes `poison` through with
dps scaled by `LEVEL_SCALE.damage` like burn (~4 lines); `sfx_sounds.js` —
`FIRE_SOUND.venom = 'pew'` (reuse) or new `hiss`; `assets/venom.png`.

**Notes:** flame resistance does NOT reduce poison (different sourceType).
Poison + burn can coexist on one enemy (independent timers, both tick).

## 3. Reaper — "execute finisher"

**Def:** `reaper: { name:'Reaper', cost:180, color:'#b967ff', unlockLevel:7, img:'assets/reaper.png', range:150, damage:20, fireRate:1.4, projSpeed:520, splash:0, slow:0, execute:{ threshold:0.3, multiplier:2.5 }, desc:'Deals ×2.5 damage to enemies below 30% HP.' }`

**Mechanic:** standard homing projectile; on impact, if the target's current HP
is below `threshold × maxHp`, the hit deals `damage × multiplier` instead of
`damage`. The check happens at impact time (post-flight), so a target that
drops below 30% mid-flight still gets executed.

**Counterplay:**
- **Bulwark:** regen makes "chipping down" slow — but once a Bulwark is under
  66 hp (30% of 220), Reaper's 50-dmg execute hits land before regen can
  recover them, ending the fight in one shot. Synergizes with Venom/Frost:
  bring it low, Reaper finishes.
- **Fission:** execute-killing a Fission still triggers its split (death is
  death) — the trap remains, but the parent dies in fewer shots.
- **Mender:** a Mender healed back above 30% escapes the multiplier; players
  must burst past the heal aura, not nibble.

**Implementation:** `config.js` (def); `projectile.js` — `applyImpact` checks
`spec.execute` and multiplies before `takeDamage` (~6 lines); `tower.js` — spec
passes `execute` through with multiplier scaled by `LEVEL_SCALE.damage`
(multiplier itself is constant; base damage scales) (~3 lines);
`sfx_sounds.js` — `FIRE_SOUND.reaper = 'crack'` (reuse) or new `slash`;
`assets/reaper.png`.

**Notes:** execute does NOT stack with anything (no other tower has a
multiplier). A future `resist:['reaper']` works via the standard
`damageMultiplier` path.

## 4. Mint — "economy income"

**Def:** `mint: { name:'Mint', cost:150, color:'#ffd700', unlockLevel:7, img:'assets/mint.png', range:0, damage:10, fireRate:0.125, projSpeed:0, splash:0, slow:0, income:{ per:10, every:8 }, desc:'Generates +$10 every 8s (upgrade scales the payout).' }`

**Mechanic:** no targeting, no projectile. Every `every` seconds the Mint adds
`per × LEVEL_SCALE.damage[level−1]` money ($10 / $16 / $25 per 8 s). Payback:
$150 cost ÷ $10/8s = 2 min at L1; a full L3 Mint pays back in ~74 s. Range is
0 (cosmetic only — the tower renders its coin animation regardless of enemies).

**Counterplay:** none direct — this is the economy slot the roster lacks. It
funds the other five new towers earlier, which is how it indirectly answers
every Phase-19 behavior (more Venom stacks, more Wardens, etc.).

**Implementation:** `config.js` (def); `tower.js` — `update()` special-cases
`this.def.income`: no target needed, cooldown tick, return `{ income: amount }`
when it fires (~8 lines); `game.js` — `if (spec.income) this.money += spec.income`
before the projectile branch (~3 lines); `sfx_sounds.js` — `FIRE_SOUND.mint =
'pop'` (reuse, soft coin blip); `assets/mint.png`.

**Notes:** selling a Mint refunds 70% of invested (standard). Mint income is
NOT counted in `stats.moneyEarned` (score integrity — score rewards kills and
survival, not AFK income; review decision). The shop desc tells the player:
"Income does NOT count toward score."

## 5. Warden — "damage aura"

**Def:** `warden: { name:'Warden', cost:300, dynamicCost:true, color:'#ff5da2', unlockLevel:7, img:'assets/warden.png', range:100, damage:0, fireRate:0, projSpeed:0, splash:0, slow:0, aura:{ dmgBonus:0.25 }, desc:'+25% damage to all towers within 100px (stacks multiplicatively with other Wardens). First costs $300; each extra Warden costs $100 more.' }`

**Cost model (review decision):** the first Warden costs **$300** and every
additional one costs **$100 more than the previous** ($300 / $400 / $500 …) —
the roster's strongest support is deliberately expensive to stack. Implemented
as `wardenPlacementCost(existingCount)` in `config.js`; `Game.wardenCost()`
counts placed Wardens, `placeTower` special-cases `def.dynamicCost`, and
`tower.invested` records the real cost so the 70% sell refund tracks it. The
shop shows the live next price (`$300` → `$400` …) via `wardenCost()`.

**Mechanic:** pure support. Every tick, `game.js` computes each tower's
`auraMult = 1 + Σ(aura.dmgBonus of Wardens in range)` — applied multiplicatively
across Wardens (two Wardens: 1.25 × 1.25 = 1.5625). The multiplier feeds the
tower's `damage` getter, so it applies to direct hits, splash falloff, burn
dps, poison dps, and execute base damage — everything that scales off
`this.damage`.

**Counterplay:**
- **Bulwark walls:** a Warden next to a Venom pushes its 30 dps cap to 37.5 —
  enough to outpace regen even at higher waves where Bulwark HP scales up.
- **Mender clusters:** a Warden amplifying a Cannon or Tesla cluster-kill
  finishes the Mender + dependents before the aura heals them back.
- **General:** it's the "build density" reward — clustering towers around a
  Warden beats spreading them out, which interacts with the grid's path
  geometry (tight corners near the spline are premium real estate).

**Implementation:** `config.js` (def); `game.js` — new `computeAuraMults()`
called once per tick before the tower loop: for each non-Warden tower, sum
`aura.dmgBonus` over Wardens within `warden.range` (~15 lines, O(towers²) —
fine at current tower counts); `tower.js` — `damage` getter multiplies by
`this.auraMult ?? 1` (Warden's own aura does NOT buff itself) (~2 lines);
`render.js` — draw the aura circle when a Warden is selected or hovered
(~5 lines, reuse the existing range-circle code); `sfx_sounds.js` —
`FIRE_SOUND.warden = 'pop'` (required by `smoke_sfx.mjs`; never triggered at
runtime since Warden never fires); `assets/warden.png`.

**Notes:** aura does NOT buff Mint income or Warden auras (only damage-based
output). Range upgrades scale the aura radius via `LEVEL_SCALE.range` like
every other tower's range.

---

## Shared implementation requirements (all five)

1. **Sprites:** `assets/{tesla,venom,reaper,mint,warden}.png` — each required
   by `tests/smoke_assets.mjs`. Generated with `tests/gen_tower_sprites.py`
   (pure-stdlib PNG writer).
2. **Fire sounds:** `FIRE_SOUND` entries for **all five** including Warden
   (`tests/smoke_sfx.mjs` asserts *every* `TOWER_TYPES` key maps to an existing
   `SOUNDS` name — no exemption for non-firing towers). Warden gets a benign
   entry that is never triggered at runtime.
3. **Shop / legend:** `buildShop()` and the lock labels iterate `TOWER_TYPES`
   — no change needed; the Warden card shows the live next price via
   `wardenCost()`.
4. **Tests that iterate generically** (`smoke_tower_unlock.mjs`, etc.) are safe:
   their level-1..6 availability expectations list explicit keys, and all five
   new towers unlock at 7, so `isTowerAvailable(t, idx)` for idx 0–5 is
   unchanged. The placement test now expects 11 at level 7 (done).
5. **File-size budget (300-line cap):** chain-hit helper in a new
   `js/tower_tesla.js`; aura computation in a new `js/tower_warden.js`;
   poison fields inline in `enemy.js`; execute inline in `projectile.js`.
   `index.html` script tags load the two new modules after `tower.js`.

## Test plan (as implemented)

- `tests/smoke_new_towers.mjs` (new, 7 checks): config shape + cost curve;
  Tesla falloff `[18, 14.4, 11.52]` incl. a phased Wisp as hop 1; Venom
  6 hits → 5 stacks cap at 30 dps/s; Reaper ×2.5 below 30% HP vs plain above;
  Mint +$10 (L1) / +$25 (L3) with `stats.moneyEarned` staying 0; Warden
  multiplier unit checks (two=1.5625, one=1.25, self=1, none=1); Warden e2e —
  a Gun inside the aura deals exactly 12 × 1.25 = 15 per hit.
- Regression: full `tests/` suite green (28/28), including
  `smoke_tower_unlock.mjs` (availability table row `6: [all 11]`, level-7
  placement count) and `smoke_assets.mjs` / `smoke_sfx.mjs` with the five new
  sprites/sounds.

## Review decisions (settled)

1. **Unlock spacing** — all five at level 7 (external levels only).
2. **Mint's role** — kept (economy gap is real).
3. **Mint and score** — income excluded from `stats.moneyEarned`; the shop desc
   tells the player ("Income does NOT count toward score.").
4. **Glacier** — dropped during review (too similar to Frost).
5. **Warden's fire-sound entry** — benign entry, never triggered at runtime.
6. **Warden cost & buff scope** — dynamic cost ($300 first, +$100 each); aura
   is damage-only, multiplicative across Wardens, never buffs itself.
