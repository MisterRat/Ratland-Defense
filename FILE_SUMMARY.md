# File Summary

One entry per file: path, a 1-sentence purpose, and its functions (classes listed as `ClassName` with their methods).

## Core game

### `js/config.js`
Static game configuration: grid size, path waypoints, starting money/lives, 13 tower definitions (incl. the 5 Phase-26 additions — Tesla chain, Venom poison, Reaper execute, Mint income, Warden aura — the Phase-27 Mortar, an area-effect artillery tower with `ammoDefault`/`ammoTypes` payload selection (Phase 43: blast radius 100 → 112 and the impact point may be ANY in-bounds cell, not just path cells), and the Phase-55 Cruiser, a water-only lock-on missile tower; all L7+) and 13 enemy types (incl. the 5 Phase-19 additions, all `unlockLevel: 7`; resist-less types carry a 2-word `desc` for the legend), targeting modes, upgrade/resistance scaling. Phase 42: grid shrank to 28×16 (`CANVAS_H` = 800) to fit a 1920×1080 screen, and every tower `desc` is capped at ≤70 chars (2 lines in the shop column). Phase-28: Bolt dash timing retuned to walk 2.5s → dash 1.0s per 3.5s period (`burst.dashDur` 0.8 → 1.0). Phase-31: Colossus `resist` list drops `'mortar'` (11 entries) — the Mortar is the one tower it does NOT resist, and no enemy resists the `'mortar'` sourceType at all.
- Constants: `GRID`, `CANVAS_W/H`, `WAYPOINTS`, `LEVEL_START_MONEY`, `RETRY_BONUS`, `START_LIVES`, `SELL_REFUND`, `TOTAL_WAVES`, `WAVE_DELAY`, `WIN_ADVANCE_DELAY`, `TOWER_TYPES`, `TARGET_MODES`, `LEVEL_SCALE`, `UPGRADE_COST_FACTOR`, `RESISTANCE_PER_LEVEL`, `RESISTANCE_CAP`, `ENEMY_TYPES`, `SLOW` (single source of slow stats — read by `Enemy.applySlow`, so Frost + Mortar-frost payloads both follow a retune), `FLAME_SPREAD_RADIUS`, Phase 55: `TOWER_TYPES.cruiser` (13th tower — $400, damage 225 ≈ ¼ Colossus, fireRate 0.25, range 700 = half the map width, projSpeed 500, L7, `waterOnly: true`). Phase 32: dead constants removed (`MAX_LEVEL` — derived from `UPGRADE_COST_FACTOR.length + 1` in tower.js; `EARLY_SEND_BONUS_PER_SEC` — actual bonus is `Math.floor(waitTimer)` in wave.js). Phase 33: `CARRYOVER_FRACTION` (win carry-over by TARGET level difficulty: easy 1.0 / normal 0.75 / hard 0.5 / nightmare 0.25). Phase 44: `DIFF_KEY` (`towerDefenseDifficulty.v1` — the per-level override store; the valid keys are `DIFFICULTY_KEYS` from level_validate.js). Phase 54: `TOWER_HP_PER_COST` (2 — tower maxHp = invested × 2) and `TOWER_HIT_RADIUS` (22px, matches the base plate in render.js — friendly-fire hit test). Phase 55: `TOWER_TYPES.cruiser` (13th tower — $400, damage 225 ≈ ¼ Colossus, fireRate 0.25, range 700 = half the map width, projSpeed 500, L7, `waterOnly: true` → pond-cell placement) and the boss `resist` list gains no entry for it (Colossus's third weakness after mortar + reaper).
- Functions: `levelStartMoney(levelIndex)`, `isTowerAvailable(type, levelIndex)`, `isTowerAllowedOnLevel(type, levelIndex)` (Phase 29: the per-level `towers` roster layer on top of `isTowerAvailable`; reads `getLevel(levelIndex).towers`, absent = all unlocked allowed), `resistanceFactor(levelIndex)`, `isEnemyAvailable(type, levelIndex)`, `wardenPlacementCost(existingCount)` (Phase 26: $300 + $100 × existing Wardens), Phase 33: `carryoverFactor(difficultyKey)` (unknown/missing key → 0.75 fallback), Phase 44: `loadDifficultyOverrides()` / `saveDifficultyOverrides(o)` (per-level difficulty overrides in localStorage, corrupt values dropped) + `setLevelDifficulty(levelIndex, key)` (null deletes the entry) + `effectiveDifficulty(levelIndex)` — THE single resolution point: the stored override for that level else the level's built-in `difficulty` key (read by enemy HP, wave building, starting lives and the HUD)

### `js/main.js`
Entry point that wires game, renderer, UI and input together and runs the fixed-timestep loop with speed/pause control (each frame calls `ui.syncEnemyLegend()`, `ui.syncWavePreview()`, `ui.syncTotalStats()` (Phase 52) and `ui.syncShowRangesBtn()`; Phase 44: also `Music.update(dt, bossOnScreen)` every frame with the REAL dt — the music clock ignores pause/speed, boss mode = any live enemy with type `'boss'`). Phase 44: no global audio unlock — SFX creates its context lazily inside click handlers, and the music context is created ONLY by the 🎵 Start button (`onMusic()` calls `Music.start()`/`Music.stop()` + updates the label; Phase 48: the "Music started" notification names the randomly picked song, e.g. `Music started: Meadow.`); the page loads silent with zero autoplay-policy warnings. Phase-21: every level entry starts PAUSED (`paused` true at boot; `restart()` re-pauses); the player begins with ▶ Resume or Space. Phase 33: win carry-over is scaled by the TARGET level's difficulty via `carryoverFactor` in `loadLevel`; `view` gains a `showRanges` toggle field. Phase 34: persistent game speed — `SPEED_KEY = 'towerDefenseSpeed.v1'`, `loadSpeed()`/`saveSpeed(s)` (try/catch, value validated ∈ {1,2,3} else 1); `speed` initialized from storage and the button label synced at boot; `onSpeed()` saves after each cycle. Phase 54: `frame()` clears `view.selectedTower` (and re-renders the tower panel) when a selected tower dies to friendly fire.
- Functions: `restart(retry)`, `loadLevel(i, carryOver)`, `onWin()`, `defName(tower)`, `setPaused(p)`, `frame(now)`, `ensureRestartButton()`, Phase 34: `loadSpeed()`, `saveSpeed(s)`
- Object: `handlers` (`onLevelChange`, `onPickType` (Phase 29: rejects towers outside the level's `towers` roster with a "not available on this level" message, distinct from the unlock-level message), `onSendWave`, Phase 33: `onShowRanges` toggles `view.showRanges` + syncs the button label, `onSpeed`, `onPause`, `onUpgrade`, `onSell`, `onTargetMode`, Phase-27: `onAmmo(tower, ammo)` validates against `def.ammoTypes` and reloads the Mortar, `onMortarRetarget(tower)` re-enters aim mode — Phase 43: its message says "click any tile" (any in-bounds cell is a valid impact point), Phase 44: `onDifficulty(key)` persists the per-level override via `setLevelDifficulty` and reloads the level (lives + enemy HP rescale, dropdown labels refresh), `onMusic()` calls `Music.start()`/`Music.stop()` + updates the 🎵 Start/Stop button label, and Phase 52: `onResetTotalStats()` — confirm → `resetTotalStats()` → "All-time stats cleared." message. The win/loss status-transition block in `frame()` also calls `foldTotalStats(game.stats, game.status === 'won')` once per level end (after `endScore()`/`recordScore`)

### `js/game.js`
Holds the core game state (money, lives, entity lists) and orchestrates per-tick updates of waves, enemies, towers, projectiles and win/lose conditions. Starting lives come from the level's difficulty row (`LG_DIFFICULTY`, fallback `START_LIVES`; Phase 44: the row key resolves via `effectiveDifficulty(levelIndex)` — a player-selected per-level override beats the built-in key). Phase-19: `onEnemyKilled` spawns split children (Fission → 2 Spore) at the parent's path position using the game's wave/level for HP scaling; `update(dt)` calls `mendAura(enemies, dt)` after `spreadFire`. Phase-26: tower loop passes each tower the Warden aura multiplier (`wardenAuraMultiplier`); spec dispatch handles `income` (money only — NOT `stats.moneyEarned`) and `chain` (`applyChainLightning`) before the projectile branch; Phase-27: `mortar` specs spawn a `MortarShell` and its detonation routes to `applyMortarBlast` instead of `applyImpact`; `placeTower` special-cases `def.dynamicCost` (Warden) and records `tower.invested`; `reset()` clears `this.effects`. Phase 29: `placeTower` gates on `isTowerAllowedOnLevel` (unlock level AND the level's `towers` roster) — defense in depth alongside the shop lock. Phase 34: death animation — `DEATH_ANIM = 0.15` s; killed enemies (every non-leak cause funnels through `onEnemyKilled`) push a corpse record `{x, y, radius, color, timer}` onto a SEPARATE `game.corpses` list (kept out of `game.effects` so exact-length effect assertions stay valid); `update(dt)` ticks + filters corpses alongside the effects (they freeze during pause/build like everything else); leaks get no corpse; the win check only reads `enemies`, so corpses never block a win. Phase 35: `stats` grows tracking fields — `damageDealt` (credited by enemies via their `game` ref, set at spawn and for split children), `towersBuilt` (`placeTower`), `towersSold` (`sellTower`), `leaked` (`onEnemyLeaked`), and the DoT-vs-direct kill split in `onEnemyKilled` (DoT when `burnTimer > 0 || poisonTimer > 0`; invariant `dotKills + directKills === kills`). Phase 54: `stats` gains `towersDestroyed`; the homing-projectile loop passes `game` into `p.update(...)` so shells can hit towers (friendly fire); `damageTower(tower, amount)` applies a flat HP hit — on ≤0 the tower is removed from `this.towers`, marked dead, counted in stats, and gets a death disc + boom SFX + message. Phase 55: `canPlace(cx, cy, typeName)` is type-aware for water — `waterOnly` towers (Cruiser) REQUIRE a pond cell, every other tower is rejected on water, and the legacy no-typeName call keeps rejecting water; `placeTower` passes its `typeName` through, and the spec dispatch gains a `cruiser` branch that spawns a `CruiserMissile(spec, tower)` (live tower ref for range checks).
Phase 47: `reset()` builds `this.ponds` via `buildPonds(levelIndex, effectiveDiffKey(), path)` (terrain.js — rebuilt on every level entry/retry/difficulty change so the layout always matches the EFFECTIVE difficulty), and `canPlace` rejects water cells (`isWaterCell` guard, absent in legacy smoke bundles).
- Class `Game`: `constructor(path, levelIndex)`, `levelDef()`, `startMoney()`, `startingLives()`, Phase 47: `effectiveDiffKey()` (defensive 'normal' fallback), `enterLevel(base)`, `retry()`, `reset()`, `score` (getter), `endScore()`, `setMessage(text, seconds)`, `enemiesById` (getter), `canPlace(cx, cy, typeName)` (path + water; Phase 55: type-aware — `waterOnly` towers require a pond cell), `placeTower(typeName, cx, cy)`, `wardenCost()`, `startIfReady()`, `sendNextWave()`, `upgradeTower(tower)`, `sellTower(tower)`, `onEnemyKilled(enemy)`, `onEnemyLeaked(enemy)`, Phase 54: `damageTower(tower, amount)` (flat HP hit from friendly fire — on ≤0: removed from `this.towers`, `alive=false`, `stats.towersDestroyed++`, death disc + boom SFX + message), `update(dt)`
- Constants: `TOWER_COSTS`, Phase 34: `DEATH_ANIM` (0.15 s corpse lifetime)

### `js/enemy.js`
The enemy entity that walks the path, takes damage with per-tower resistance, and can be slowed, burned or poisoned. Max HP scales with wave number AND the level's difficulty row `hpMul` (from `LG_DIFFICULTY`, defensive `'normal'` fallback; Phase 44: the row key resolves via `effectiveDifficulty(levelIndex)` — a player-selected per-level override beats the built-in key). Phase-19 behaviors: flat regen (Bulwark) applied before burn each tick; Bolt dash-burst via `burstTimer` (dash at END of period, both speeds slowable); Wisp phasing via `phaseTimer` (untargetable while phased, cycle paused by Frost slow — see `targetable`). Phase-26: stacking poison (`poisonStacks`/`poisonDpsPerStack`/`poisonTimer`) ticks in `update()` and reports kills as `'burned'` to reuse the DoT kill path; Phase-30 adds a `poisoned` getter (true while `poisonTimer > 0`) used by the renderer's green tint. Phase 35: damage tracking — a `game` ref (set at spawn, null for test enemies) lets `takeDamage` and the burn/poison DoT ticks credit the HP actually absorbed (effective post-resistance amount, clamped to `Math.min(tick, hp)` so overkill is never counted) into `game.stats.damageDealt` via `creditDamage()`.
- Class `Enemy`: `constructor(typeName, wave, levelIndex)`, `burning` (getter), `targetable` (getter), `currentSpeed` (getter), `update(dt, path)`, `damageMultiplier(sourceType)`, `takeDamage(amount, sourceType)`, Phase 35: `creditDamage(amount)`, `applySlow(ignoreResist = false)` (Phase 31: skips frost resistance when set — Mortar payloads), `applyBurn(dps, duration, ignoreResist = false)` (same for flame), `applyPoison(addStacks, maxStacks, dpsPerStack, duration)`, `progress(pathTotal)`

### `js/tower.js`
The tower entity handling target acquisition by mode, firing cooldowns, upgrade costs and sell value. Phase-19: `acquireTarget` skips untargetable enemies (Wisp while phased) — splash/burn still hit it. Phase-26: `update(dt, enemies, pathTotal, auraMult)` scales damage/burn/poison by the Warden aura multiplier; Mint returns an `income` spec instead of a projectile; Tesla returns a `chain` spec; `invested` records the actual (dynamic) cost for sell refunds. Phase-27: towers with `def.ammoTypes` (Mortar) skip target acquisition entirely — they fire a `{type:'mortar'}` spec at the player-set `targetPoint` on cooldown, payload = the selected ammo tower's own damage/slow/burn/poison × level scale × aura multiplier. Phase-31: the mortar spec's `sourceType` is `'mortar'` (not the ammo key) — no enemy resists it, so mortar payloads never take resistance; blast radius stays the Mortar's own `range` × level scale. Phase 54: towers have health — `hp`/`alive` fields + `maxHp` getter (invested × `TOWER_HP_PER_COST`, so upgrades and Warden dynamic cost raise durability); both fire specs (railgun pierce + default homing) carry `sourceId: this.id` so friendly fire never self-hits. Phase 55: `def.waterOnly` towers (Cruiser) return a `{type:'cruiser', sourceId, targetId, maxRange: this.range, ...}` spec after target acquisition — the missile re-checks the tower's LIVE range every frame (upgrades extend tracking), and the self-destruct rules live in `js/tower_cruiser.js`.
- Class `Tower`: `constructor(typeName, cx, cy)`, `x`/`y` (getters), `range`/`damage`/`fireRate` (getters), `upgradeCost()`, `sellValue()`, `acquireTarget(enemies, pathTotal)`, `scoreFor(e, pathTotal)`, `update(dt, enemies, pathTotal, auraMult)`
- Phase 32: the mortar spec's `slow` field uses the same boolean convention as the homing path (`tp.slow > 0`) — `Enemy.applySlow` reads stats from `SLOW`, so a Frost retune now flows through Mortar-frost payloads too (no more hardcoded `{ factor, duration }` copy).

### `js/tower_tesla.js`
Phase-26 Tesla chain-lightning: `applyChainLightning(game, spec)` deals instant damage to the primary target plus up to N hops (nearest un-hit enemy within `hopRadius`, ×`falloff` per hop), hits phased enemies, and pushes a fading `{type:'chain', segments}` entry onto `game.effects`.

### `js/tower_warden.js`
Phase-26 Warden aura: `wardenAuraMultiplier(towers, tower)` returns ×1.25 per other Warden whose range reaches the tower (multiplicative; a Warden never buffs itself).

### `js/tower_mortar.js`
Phase-27 Mortar: `MortarShell` flies a fixed-point lobbed shell (no homing; cosmetic `arc` getter) and returns a detonation spec on arrival; `applyMortarBlast(impact, enemies, game)` deals splash-falloff damage (`dmg × (1 − 0.4·d/r)`) to every enemy in the blast radius via `takeDamage(dmg, 'mortar')` — Phase-31: no enemy resists the `'mortar'` sourceType, and slow/burn apply with `ignoreResist`, so mortar payloads never take resistance (the ammo still sets the DoT type/stats), pushes an `{type:'explosion', x, y, radius, color, timer, duration}` splash effect on every detonation (Phase-31: ring sized to the blast radius, colored by `TOWER_TYPES[ammo].color`), and for Tesla ammo with ≥2 in-blast enemies pushes a fading `{type:'chain', segments, timer: 0.35, duration: 0.35}` effect connecting consecutive in-blast enemies (lines only — no outward hops; lifetime matches the explosion splash so the lines stay visible for the whole detonation).

### `js/tower_cruiser.js`
Phase 55 Cruiser missile: `CruiserMissile(spec, sourceTower)` — a lock-on homing missile that tracks its target every frame; if the target dies OR moves beyond the tower's LIVE range (`sourceTower.range`, so upgrades extend it) before impact, it self-destructs with no damage (small `{type:'explosion'}` puff). On intercept it returns an impact spec handled by `applyImpact` (splash 0 → direct hit only). Friendly fire (Phase 54) applies: a tower crossed mid-flight (≤ `TOWER_HIT_RADIUS`, never the firing tower via `sourceId`) consumes the missile and damages that tower.
- Class `CruiserMissile`: `constructor(spec, sourceTower)`, `update(dt, enemiesById, game)` (impact spec | null), `selfDestruct(game)`

### `js/projectile.js`
Projectile flight and impact logic: homing projectiles with splash/slow/burn, fire spread between burning enemies, the railgun's straight piercing slug, `mendAura(enemies, dt)` — the Mender's heal aura (heals living allies within radius at `hps*dt`, capped at maxHp, skips dead/self) — and Phase-26 impact extras: Reaper execute (×multiplier damage when the direct target is alive below `threshold` HP fraction) and Venom poison (`e.applyPoison(...)` on hit). Phase 54 friendly fire: homing `Projectile.update(dt, enemiesById, game)` takes an optional `game` — a tower crossed mid-flight (segment distance ≤ `TOWER_HIT_RADIUS`, never the firing tower via `sourceId`) stops the shell: flat damage via `game.damageTower`, consumed with NO enemy impact/splash/DoT; `PiercingShot` PENETRATES towers instead (flat base damage per new tower, tracked in `hitTowerIds`, no pierce-count consumption or halving — enemy DPS unchanged).
- Class `Projectile`: `constructor(spec)`, `update(dt, enemiesById, game)`
- Class `PiercingShot`: `constructor(spec)`, `update(dt, enemies, game)`
- Functions: `applyImpact(impact, enemies, game)`, `spreadFire(enemies, game)`, `mendAura(enemies, dt)`, `segDist(px, py, x1, y1, x2, y2)`
- Constant: `PIERCING_HIT_RADIUS`

## Waves & path

### `js/wave.js`
Wave scheduler that builds each wave's enemy list and times spawning plus auto-start between waves. Procedural waves use the SAME difficulty model as generated levels: the level's difficulty row from `LG_DIFFICULTY` drives wave size/tank share/boss cadence via the shared `composeWaveList`, with the enemy pool gated by `unlockLevel` AND excluding `childOnly` types (Spore is only ever spawned by Fission death). Spawn pacing uses the difficulty row's `spawnGap` (seconds between spawns, defensive `'normal'` fallback). Phase 44: the row key resolves through `effectiveDifficulty(levelIndex)` — a player-selected per-level override beats the built-in key.
- Class `WaveManager`: `constructor(levelIndex, totalWaves, explicitWaves)`, `inProgress` (getter), `startNext(game, auto)`, `update(dt)`, `reset()`
- Functions: `buildWave(wave, levelIndex, explicitWaves)`, `levelActiveEnemies(levelIndex)` (Phase 24: the active-enemy set for the legend — explicit-wave levels derive it from their own `waves` lists plus split children; procedural levels use the `unlockLevel` gate)

### `js/path.js`
Path construction and geometry: the path is a **centripetal Catmull-Rom spline** through waypoint cell centers (straight runs stay straight, corners round inside their cells), sampled to a dense pixel polyline; blocked cells come from sample-based cell walking. Any segment shape is allowed; re-walking two consecutive cells in the same direction (U-turn/double-back lane) is rejected, angled crossovers pass.
- Functions: `crPoint(p0, p1, p2, p3, u)` (centripetal CR, alpha=0.5), `sampleSpline(waypoints, cell)`, `buildPath(waypoints)`, `key(cx, cy)`, `walkPathCells(waypoints)` (sample-based: marks every cell a spline sample falls in), `hasSelfIntersection(waypoints)` (sample-based cell-walk direction test), `pointAtDistance(path, d)`, `isPathCell(path, cx, cy)`
- Constant: `SPLINE_STEP_PX` (max px between samples)

## Levels

### `js/terrain.js`
Phase 47: difficulty-scaled water ponds — `POND_SIZE = 4` (4×4-cell blocks), `PONDS_BY_DIFFICULTY` (easy 0 / normal 1 / hard 2 / nightmare 4), and `buildPonds(levelIndex, difficultyKey, path)` → `{ cells: Set<'cx,cy'>, rects: [{cx, cy}] }`. Seeded rejection sampling (local mulberry32 copy + FNV-1a hash of the difficulty key) makes each layout DETERMINISTIC per (level, effective difficulty) — stable across retries/reloads, reshuffled when the difficulty dropdown changes; a pond is rejected if its block touches a path cell or another pond (`POND_MAX_ATTEMPTS = 200` per pond, place-fewer-never-fail). Self-contained: does NOT depend on levelgen_paths.js (the game page never loads it).
- Functions: `buildPonds(levelIndex, difficultyKey, path)`, `pondCollides(cx, cy, pathCells, existingCells)`, `isWaterCell(ponds, cx, cy)`, `pondRng(seed)`, `pondHash(str)`
- Constants: `POND_SIZE`, `PONDS_BY_DIFFICULTY`, `POND_MAX_ATTEMPTS`

### `js/levels.js`
Hard-coded definitions of the six built-in levels (Snake, Serpentine, Comb, Zigzag, The Gauntlet, Crossroads) as grid-coordinate waypoint lists, each with a `difficulty` key (L1–L2 easy, L3–L4 normal, L5–L6 hard) that drives procedural wave scaling exactly like the generator's. Level 4 was renamed "Switchback" → "Zigzag" in Phase 36 to free the name for the new generator switchback template. Phase 45: levels 2 & 5 bottom lanes moved row 15 → 14 — on the 16-row grid (Phase 42) a row-15 lane's spline corners bow ~45px past the lane center and off the 800px canvas (only the path's top edge was visible); row 14 keeps the sampled spline at y ≤ ~769.
- Constant: `LEVELS`
- Functions: `levelWaypoints(i)`

### `js/level_validate.js`
Pure level-def validation shared by the registry, the build tool and smoke tests: a pure-data security gate plus waypoint and optional-field schema checks. Waypoints may use **any non-zero segment shape** (the path is a Catmull-Rom spline through them); spawn x=-1, exit x=cols, integer in-bounds coords, no self-intersection, and a sampled-spline grid-bounds check (corners must not bow off the map) are enforced. Optional `uuid` field must be a lowercase v4 UUID string when present. Phase 29: optional `towers` roster field — when present (and not null) it must be a non-empty array of valid `TOWER_TYPES` keys; absent/null = all towers allowed. Phase 32 (security hardening): waypoint count capped at `MAX_WAYPOINTS` (200, checked before any spline work — M-1 DoS guard), `totalWaves` capped at `MAX_TOTAL_WAVES` (50, matching the generator UI clamp — L-1), and `waves` enemy keys whitelisted against `ENEMY_TYPES` with a specific "unknown enemy type key(s)" problem (L-2 fail-fast).
- Functions: `isPlainObject(v)`, `checkPureData(value, depth, path, problems)`, `validateWaypoints(wps, problems)`, `validateOptionalFields(def, problems)` (incl. optional `difficulty` enum + `uuid` v4 pattern + `towers` roster checks), `validateLevelDef(def)`
- Constants: `isInt`, `MAX_DEPTH`, `DIFFICULTY_KEYS`, `UUID_RE`, `MAX_WAYPOINTS`, `MAX_TOTAL_WAVES`

### `js/level_registry.js`
The single ordered registry of all playable levels: seeds the built-in levels and registers validated custom ones (from the localStorage store, `js/level_custom.js`) behind a uniform normalized shape (incl. `difficulty`, default 'normal', pass-through `uuid` — the level's machine identity used for duplicate detection; names are cosmetic — and Phase-29 pass-through `towers` roster, absent = all towers allowed).
- Functions: `normalizeLevelDef(def, index)`, `registerLevel(def, sourceFile)` (warns on duplicate uuid), `getLevels()`, `getLevel(i)`, `levelCount()`
- Constant: `_levels`

### `js/level_custom.js`
The localStorage level store (`towerDefenseCustomLevels.v1`) — the single source of truth for every non-built-in level: levels created on the generator page and levels imported from `.json` files (the `levels/` folder format or a friend's export). Boot-time re-registration into the registry (validated, deduped by **uuid** — legacy defs without a uuid fall back to name) so custom levels survive reloads in both pages. Import validates each entry with the game's own validator, stamps missing uuids (via `lgUuid` when loaded, else a built-in v4 fallback), and dedupes against both the store and the registry (uuid, or name for uuid-less files); export serializes the whole store as a pretty JSON array; single-level export/delete serve the Stored Levels page.
- Functions: `getCustomLevels()`, `saveCustomLevel(def)` (replaces same-uuid entry), `registerCustomLevels()`, `isCustomLevel(i)`, `customLevelId(def)`, `registryHasLevel(def)`, `importLevelDefs(defs)` (array or single def → `{added, skipped, problems}`; persists + re-registers on change), `exportCustomLevels()` (pretty JSON array of the whole store), `lgFilename(name)` (sanitized name + `.json` for single-level exports), `findCustomLevel(id)`, `exportLevelDef(id)` (one stored level as pretty JSON; id = uuid, store id, or bare name), `deleteCustomLevel(id)` (removes from store AND splices the live registry), `customUuid()` (v4 fallback when `lgUuid` is absent — index.html never loads levelgen_names.js)
- Constant: `CUSTOM_LEVELS_KEY`; auto-runs `registerCustomLevels()` at load (guarded)

### `js/levelgen_paths.js`
Seeded RNG (mulberry32) plus Bloons/Kingdom-Rush-inspired path templates that produce validated waypoint candidates with stats (length, crossovers, buildable). Templates emit axis-aligned control points that the Catmull-Rom spline bows into real curves: `tplArc` (one wide offset bend), `tplSBend` (two opposing offsets, smooth S), `tplLoop` (hairpin with offset lane + crossover); crossover shapes: `tplWeave`, `tplCrossroads`; Phase 36 long-path shapes: `tplSwitchback` (four lanes alternating direction — a true switchback, zero crossovers) and `tplSpiral` (a rectangular ring spiraling inward to an inner lane that exits crossing the right column once; lane spacing >=3 rows keeps corner bows off parallel runs). Each candidate carries its own `_seed` so callers can derive stable per-candidate extras (e.g. the silly name). Stats use the shared sample-based walker from path.js. Row ranges are clamped off the boundary rows (1..rows-2) so spline corners cannot bow off the map edges. Phase 42: `tplSpiral`'s bottom row is now `rngInt(rng, 13, LG_ROWS - 2)` (was hardcoded 13..15) — on the 16-row grid a row-15 run would bow off the bottom edge.
- Functions: `mulberry32(seed)`, `rngInt`, `rngPick`, `rngShuffle`, `tplArc(rng)`, `tplSBend(rng)`, `tplLoop(rng)`, `tplWeave(rng)`, `tplCrossroads(rng)`, `tplSwitchback(rng)`, `tplSpiral(rng)`, `lgPathStats(waypoints)`, `generatePathCandidates(seed, count, maxTries)`
- Constant: `LG_TEMPLATES` (7 templates; 4 candidates drawn per Generate)

### `js/levelgen_names.js`
Identity + naming helpers for generated levels: `lgUuid()` produces a 128-bit v4 UUID (the level's identifier for the code — stored in the JSON, never shown in the UI) and `lgSillyName(rng)` produces a silly randomized 2-word human name (adjective + noun) from a seeded RNG.
- Functions: `lgUuid()`, `lgSillyName(rng)`
- Constants: `LG_ADJ` (20 adjectives), `LG_NOUN` (20 nouns)

### `js/levelgen_waves.js`
The shared difficulty model: the `LG_DIFFICULTY` table (easy/normal/hard/nightmare — base, ramp, tank share, plus the visible levers `spawnGap`, `hpMul`, `lives`, `bossEvery`, label) and `composeWaveList(wave, d, pool)`, which both the generator (`buildGeneratedWaves`) and the built-in procedural waves (`js/wave.js`) use, so difficulty means the same thing everywhere. Regular-wave tanks land on evenly spread fair-share slots (no clumping); boss waves come every `d.bossEvery`-th wave with the boss first.
- Functions: `composeWaveList(wave, d, pool)`, `buildGeneratedWaves({enemies, difficulty, waves})`
- Constant: `LG_DIFFICULTY` (easy/normal/hard/nightmare)

### `js/levelgen_save.js`
Create flow for the generator page: builds pure-data JSON defs (incl. `difficulty`, the Phase-29 `towers` roster from the checked tower checkboxes, and a fresh v4 `uuid` — the level's machine identity) and saves them straight to the localStorage custom-level store (`saveCustomLevel`), registering each in memory — no files are written (Export is how levels leave the browser).
- Functions: `lgBuildDef(candidate, opts)` (stamps `uuid`; writes `towers` when `opts.towers` is a non-empty array), `lgCreateLevels(candidates, opts)` (sync — per-candidate save + register; returns `[{def, registered}]`)

### `js/levels_store_ui.js`
Stored Levels page logic (`levels.html`) — the single place for level **management**: lists every level in the localStorage custom-level store with a small inline path mini-map (spline diagram, 6px/cell) per row plus name, difficulty/waves/money meta and a short uuid (full on hover), and per-row **Export** (single `.json` file named after the level via `lgFilename` + `exportLevelDef`) and **Delete** (confirm → `deleteCustomLevel`, which also splices the live registry) buttons; Phase 40 adds whole-store management — **Import** (multi-file `.json` input → `importLevelDefs` → re-render + report) and **Export all** (whole store as `tower-defense-levels.json`) — since the generator page now only creates levels. Phase 41: inside the compiled desktop app (`window.pywebview.api` present, see `compile.py`) Export one / Export all / Import go through the NATIVE dialog bridge (`save_file` / `open_files`) because WebView2 swallows blob downloads; in a regular browser the original blob-download / hidden-input paths run unchanged.
- Functions: `lsDrawMiniMap(canvas, waypoints)`, `lsRender()`, Phase 41: `lsBridge()` (the pywebview api or null), `lsExportOne(def)` (async — bridge save or blob fallback), `lsDelete(def)`, `lsExportAll()` (async — same pattern), `lsImport()` (async — bridge open-files or hidden-input fallback), `lsImportReport(fileCount, added, skipped, problems)`, `lsInit()`

### `js/levelgen_ui.js`
Generator page UI logic: small-canvas path diagrams (checkerboard, the actual spline drawn via `sampleSpline`, spawn/exit markers, crossover highlighting from the shared sample-based walker), enemy-checkbox builder (rows use `index.html`'s `.legend-item` style — swatch + name + desc — with a checkbox prepended) + Select All/Clear toggle, Phase-29 tower-roster checkbox builder (rows use `index.html`'s `.shop-item` style — name + cost + desc — with a checkbox prepended; all towers checked by default, unchecking removes a tower from the level) + its own Select All/Clear toggle, options form reader (incl. `towers`), 4 preview cards each with an **editable silly-name input** + stats (incl. difficulty label and tower count) + checkbox, Create / Try Again handlers (both require ≥1 enemy AND ≥1 tower). Phase 40: this page ONLY creates levels — `lgExport`/`lgImport`/`lgImportReport` are gone (management moved to the Stored Levels page); Create's success message points there.
- Functions: `lgCrossoverCells(waypoints)`, `lgDrawDiagram(canvas, waypoints)`, `lgBuildEnemyCheckboxes(wrap, enemyTypes)` (excludes `childOnly`; Minion+Colossus default), `lgSelectAllEnemies(wrap, on)`, `lgBuildTowerCheckboxes(wrap, towerTypes)` (Phase 29; all checked by default), `lgSelectAllTowers(wrap, on)`, `lgReadOptions()` (returns `{enemies, towers, difficulty, startMoney, waves}`), `lgGenerate()` (assigns a silly name per candidate; guards ≥1 enemy + ≥1 tower), `lgRenderCards(opts)`, `lgCreate()` (sync — localStorage save + register; same guards), `lgTryAgain()`, `lgInit()` (wires BOTH Select All buttons — auto-flip to Clear when all checked)
- Constants: `LG_DIAGRAM_CELL`, `lgState`

### `levelgen.html`
Secondary page shell for the level generator (title "Ratland Defense — Level Generator" since Phase 39): a **three-column flex row copied from `index.html`'s `#wrap`** — left = enemy legend (the exact `#legend` / `.legend-item` style: swatch + name + desc, with a checkbox prepended to each row and a **☑ Select All** auto-flip button in the header), center = everything else (difficulty/money/waves form, Generate/Create/Try Again buttons, message line, preview-card area, and a "How levels work here" instructions box — Phase 40: this page only CREATES levels (Create saves to the browser's localStorage store); Import/Export/Delete management is on the Stored Levels page, which the instructions link to), right = tower shop (the exact `#side` / `.shop-item` style: name + cost + desc, with a checkbox prepended to each row and its own **☑ Select All** auto-flip button). Header links back to the game AND to the Stored Levels page. All generator scripts loaded in dependency order. No global name field; names are per-candidate on the cards.
- Inline IIFE: calls `lgBuildEnemyCheckboxes(...)` + `lgBuildTowerCheckboxes(...)` and boots with `registerCustomLevels()` + `lgInit()`

## Persistence, scoring & sound

### `js/progress.js`
Persistent level-unlock progression stored in localStorage (with an in-memory fallback) that survives reloads. Custom levels (the localStorage store) are always unlocked: the unlock floor is built-ins + `customCount()` (counted from the store via `getCustomLevels`), and stale saved values below the floor are lifted up.
- Functions: `loadProgress()`, `saveProgress(p)`, `normalizeProgress(data)`, `customCount()`
- Constant: `PROGRESS_KEY`

### `js/score.js`
Score calculation and per-level best scores persisted in localStorage with the same try/catch fallback pattern as progress.
- Functions: `computeScore({kills, lives, moneyEarned})`, `loadScores()`, `saveScores(s)`, `normalizeScores(data)`, `recordScore(levelIndex, score)`, `bestScore(levelIndex)`
- Constants: `SCORES_KEY`, `SCORE_WEIGHTS`

### `js/totalstats.js`
Phase 52: all-time (of all time) stats persisted in localStorage — the same try/catch + normalize pattern as score.js (corrupt/missing → fresh zeros), cached in memory after first load. A finished level's `game.stats` is folded in ONCE at level end (win OR loss — main.js's status transition) via `foldTotalStats(s, won)`; the bottom bar shows the stored totals as-is (not live-updated), and a level that never reaches a win/loss transition simply never folds.
- Functions: `emptyTotalStats()`, `loadTotalStats()`, `saveTotalStats(t)`, `normalizeTotalStats(data)` (finite ≥0 → floor; drops junk keys), `getTotalStats()` (lazy cached load), `foldTotalStats(s, won)` (damageDealt rounded, others floored; `levelsWon` only via `won`; persists), `resetTotalStats()` (zero + persist)
- Constants: `TOTAL_STATS_KEY` (`towerDefenseTotalStats.v1`), `TOTAL_STAT_FIELDS` (kills, moneyEarned, wavesSurvived, damageDealt, towersBuilt, towersSold, leaked, dotKills, directKills, levelsWon)

### `js/sfx.js`
SFX engine that lazily owns the AudioContext (created on a user gesture for autoplay policy), plays generated sound recipes, and persists mute state.
- Object `SFX`: `ensure()`, `play(name)`, `toggleMute()`, `setMuted(muted)`; fields `ctx`, `master`, `muted`
- Functions: `loadMuted()`, `saveMuted(muted)`
- Constant: `MUTE_KEY`

### `js/sfx_sounds.js`
Web Audio sound recipes — oscillators and filtered white-noise bursts shaped by gain envelopes — for tower fire sounds and game events, all generated at play time (no audio files).
- Functions: `tone(ctx, out, when, opts)`, `noise(ctx, out, when, opts)`, `sfxPew`, `sfxBoom`, `sfxCrack`, `sfxZip`, `sfxWhoosh`, `sfxSizzle`, `sfxPop`, `sfxThud`, `sfxHorn`, `sfxFanfare`, `sfxSting` (all `(ctx, out, when)`)
- Constants: `SOUNDS` (name → recipe), `FIRE_SOUND` (tower key → sound name)

### `js/music_patterns.js`
Phase 46: background-music pattern data + builders (pure — no AudioContext, fully testable headless). Two loops built from per-bar data: `normal` = an 8-bar (128 sixteenth-step) A-minor loop with real chords (pad chord per bar, a different bass pattern per bar — roots / octave bounce / fifth answer / pickup walk — a different arpeggio figure per bar, and a lead melody that develops over the loop: motif → sequence → cadence answer → climax → resolution; the final E-major bar is a dominant cadence so the loop never sounds like a plain repeat, and its arp drops out as a fill); `boss` = a 4-bar (64-step) Am–Am–F–E loop with driving square eighth bass, off-beat root+fifth power-chord stabs on the F/E bars, a call-and-response melody, kick on every beat + a bar-3 fill, snare on beats 2 & 4, off-eighth hats + an extra 16th into the last bar.
- Functions: `NOTE(midi)` (MIDI → Hz), `buildPattern(bpm, bars, opts)` (assembles the per-step voice arrays from per-bar data)
- Constants: `CHORDS` (Am/F/C/G/E triads as MIDI arrays; Phase 48 adds Em/Bb/A/B/Dm/D for the new songs), `NORMAL_BASS_ROOTS`, `BASS_PATTERNS` (`roots`/`bounce`/`fifth`/`walk`; Phase 48 adds `drive` — driving eighths with octave accents, used by Stormfront), `ARP_PATTERNS` (`up`/`down`/`triad`/`pulse`), `NORMAL_BARS` (8 bars: chord/bass/arp/melody/fill per bar — the original "Home" song's data, now consumed by music_songs.js), `BOSS_BARS` (4 bars: chord/bass/stab/melody per bar), `PATTERNS` (`{normal, boss}` — prebuilt per-step bass/arp/lead/kick/hat/snare arrays; normal 128 steps @ 108 BPM, boss 64 @ 132 BPM), `NORMAL_BAR_DATA` (per-bar pad chord tones + root). Phase 48: also exports the shared `buildPattern(bpm, bars, opts)` builder and `NOTE`/`midiToFreq`, which `js/music_songs.js` reuses to build its six songs.

### `js/music_songs.js`
Phase 48: the six normal-mode songs + the `NORMAL_SONGS` roster (pure data + builders — no AudioContext, testable headless; reuses `buildPattern`/`CHORDS`/`NOTE`/`midiToFreq` and the original `NORMAL_BARS`/`NORMAL_BASS_ROOTS` from `js/music_patterns.js`, which must load first). Song 1 "Home" wraps the original Phase-46 A-minor loop; the five new songs are all 8-bar (128-step) loops ending on a dominant-cadence bar (V, arp dropped as a fill): "Meadow" (C major C–G–Am–F | C–Am–F–G, 116 BPM, bright), "Twilight" (D minor Dm–Bb–F–C | Dm–C–F–A, 96 BPM, mellow), "Ratland" (A minor Am–G–Em–F | Am–Em–F–E, 124 BPM, playful), "Ember" (E minor Em–C–G–D | Em–G–D–B, 104 BPM, warm), "Stormfront" (A minor Am–F–Am–G | Am–Em–C–E, 128 BPM, driving — the only normal song with light percussion: kick on beats 1 & 3, off-eighth hats). Each song object carries `name`, `bpm`, `bars` (per-bar chord/bassRoot/bass/arp/melody/fill), a prebuilt `pattern` (per-step voice arrays) and `barData` (per-bar pad chord tones + rootMidi for the pad voice). The engine picks one uniformly at random in `Music.start()`.
- Functions: `buildSong(song)` (assembles `{name, bpm, bars, pattern, barData}` via the shared `buildPattern`)
- Constants: `SONG_HOME`, `SONG_MEADOW`, `SONG_TWILIGHT`, `SONG_RATLAND`, `SONG_EMBER`, `SONG_STORMFRONT`, `NORMAL_SONGS` (the six-song roster, index 0 = the original song)

### `js/music.js`
Phase 44/46/48: background music engine — a looping chiptune generated with Web Audio (no audio files, so `file://` keeps working); headless-safe (silent no-op without an AudioContext). Phase 46 made it richer: pattern data moved to `js/music_patterns.js` and the engine gained real voices — normal mode = one PAD chord per bar (two detuned triangles per chord tone, slow attack) + per-bar triangle BASS patterns + a triangle ARPEGGIO with a different figure per bar + a sawtooth-through-lowpass LEAD melody that develops over the loop; `boss` (132 BPM, 4-bar loop) = driving square BASS eighths, off-beat power-chord STABS, a LEAD melody, kick on every beat + a bar-3 fill, SNARE on beats 2 & 4, off-eighth hats, and a noise RISER swelling into the final E bar (switches while a Colossus is on screen). Phase 48: normal mode plays one of the six songs in `NORMAL_SONGS` (js/music_songs.js) — `start()` picks a random `songIndex`, `update()` schedules that song's pattern + pad chord (boss keeps `PATTERNS.boss`). A lookahead scheduler (`update(dt, boss)` fills 16th-note steps up to 0.35 s ahead of `ctx.currentTime`) drives it; sustained voices (pad, riser) are scheduled on bar boundaries. The 🔊 Sound button mutes everything — the music gain ducks to 0 while `SFX.muted`. Autoplay policy: music is OFF at boot and NOT persisted — the 🎵 Start/Stop button click is the ONLY place an AudioContext is created (a real user gesture, so the browser allows it with zero console warnings); `update()` never creates or resumes contexts itself. Volume: `MUSIC_LEVEL` master gain (1.0) + per-note peaks are the two knobs — if the user says too quiet/too loud, tune those first.
- Object `Music`: `start()` (MUST be called from the click handler — creates the context + gain at `MUSIC_LEVEL`, then picks a random normal-mode song via `pickSong()`, which never repeats the previous pick), `stop()` (stops scheduling and closes the context; a later Start makes a fresh one), `update(dt, boss)` (no-op unless playing with a running context), `scheduleStep(pat, i, when)`, `pickSong()`; fields `playing`, `ctx`, `gain`, `mode`, `songIndex` (-1 until Start), `lastSong` (previous pick), `step`, `nextTime`, `LOOKAHEAD`
- Functions: `padNote(ctx, out, when, freq, dur, peak)` (two detuned triangles, slow attack), `padChord(...)` (one chord tone each, peaks split), `leadTone(...)` (sawtooth + lowpass 2400 Hz, 20 ms attack), `riser(...)` (bandpass noise swell 500→3500 Hz)
- Constants: `MUSIC_LEVEL` (master music gain — the volume knob); normal-mode songs come from `js/music_songs.js` (`NORMAL_SONGS`), boss from `js/music_patterns.js` (`PATTERNS.boss`)

### `js/assets.js`
file://-safe tower sprite loading via `new Image()` with relative paths; the renderer falls back to procedural circles when a sprite is missing. Phase 47: also loads the terrain pond sprite (`'pond'` → `assets/pond.png`, guarded on `POND_SIZE` being defined — terrain.js must load first in index.html).
- Object `TowerAssets`: `init()`, `load(type, src)`, `get(type)`; fields `images`, `loaded`

### `js/utils.js`
Small shared math/vector helpers: clamping, lerp, distance, move-toward, grid↔pixel conversion, money formatting, and Phase-31 `hexA(hex, alpha)` (`'#rrggbb'` + 0..1 alpha → `rgba(...)` string for fading effect colors).
- Functions: `clamp(v, lo, hi)`, `lerp(a, b, t)`, `dist(x1, y1, x2, y2)`, `moveToward(px, py, tx, ty, step)`, `cellOf(x, y, cell)`, `cellCenter(cx, cy, cell)`, `formatMoney(n)`, `hexA(hex, a)`

## Rendering & UI

### `js/render.js`
All canvas drawing: checkerboard grid, path, towers (sprite or procedural fallback with level pips), enemies (HP bars, burn flames, hover tooltips; Phase-28: phased/untargetable wisps render as an unfilled ring instead of a filled disc; Phase-30: poisoned enemies tint green `#9fff8f`, mirroring the Frost slow's blue `#9fd8ff` — poison wins when both are active), projectiles (incl. Phase-27 lobbed MortarShell — ground shadow + arcing ball with colored rim), railgun slugs, placement/range previews, and effects — fading Tesla chain-lightning polylines AND Phase-31 mortar explosion splashes (expanding ring + soft flash, `hexA`-faded, ammo-colored; `drawEffects`), the gold Warden aura ring on a selected Warden, and Phase-27 Mortar aim UI: gold crosshair at each targeted mortar's `targetPoint`, green blast circle / red X preview while aiming, and range circles drawn at the target point instead of the tower. Phase-31: chain-line alpha reads `fx.duration || 0.15` (mortar lines now live 0.35s), and the placement/aim previews null-guard `view.hoverCell` (no pageerror before the mouse enters the canvas). Phase 33: "Show Ranges" toggle — when `view.showRanges` is on, `draw()` circles EVERY placed tower via `drawTowerRange` (per-tower rules: Warden gold aura, Mortar blast circle at its target point, others blue range); when off, only the selected tower shows its range. Phase 43: the mortar aim preview is always a green blast circle (any in-bounds cell is valid; the red-X invalid state is gone). Phase 34: death animation — `drawCorpses(ctx, corpses)` renders each corpse as a filled disc that scales down and fades out over its remaining life (alpha = scale = timer/DEATH_ANIM), drawn in `draw()` right after the enemy loop. Phase 47: grass theme — `drawGrid` fills the two alternating light-green shades (`#9ed08a` / `#92c67e`); `drawPonds(ctx, ponds)` draws one `assets/pond.png` sprite (200×200 px = exactly a 4×4-cell block) per pond rect, with a procedural rounded-rect blue fallback (`roundRectPath`) when the sprite is missing — called between grid and path in `draw()`. Phase 54: damaged towers draw an HP bar (width 40, above the base plate; green/yellow/red by fraction, mirroring `drawEnemy`). Phase 55: `drawProjectile` gains a `CruiserMissile` branch — an elongated dart with exhaust tail rotated to its heading (`p.angle`) and a colored nose — and `drawPlacementPreview` passes `view.placingType` to `game.canPlace` so the water-only rule shows green on pond cells while placing a Cruiser.
- Class `Renderer`: `constructor(canvas)`, `draw(game, view)`, `hoverPixel(view)`, `drawGrid(ctx)` (light-green grass), Phase 47: `drawPonds(ctx, ponds)` + `roundRectPath(ctx, x, y, w, h, r)` (sprite or procedural fallback), `drawPath(ctx, path)`, `drawTower(ctx, t, selected)`, `drawEnemy(ctx, e, hoverPx)`, `drawFlames(ctx, e)`, `drawProjectile(ctx, p)`, `drawShots(ctx, shots)`, `drawEffects(ctx, game)`, `drawRange(ctx, x, y, range)`, `drawPlacementPreview(ctx, game, view)`, Phase 33: `drawTowerRange(ctx, t)` (one tower's range indicator — Warden aura / Mortar blast-at-target / blue range; used by the "Show Ranges" toggle for every tower when `view.showRanges` is on, else only the selected tower), Phase 34: `drawCorpses(ctx, corpses)` (scaled/faded death disc per corpse)

### `js/ui.js`
DOM UI layer: HUD values (money/lives/wave/score), enemy legend (13 rows in fixed order — resist text from each def's `resist` list or the 2-word `desc` blurb; inactive types dimmed via `syncEnemyLegend()`), tower shop with lock states, selected-tower panel (targeting mode, upgrade, sell), control buttons, and the level dropdown (difficulty labels; external levels always open). Phase 44: a difficulty dropdown (`#diffSelect` — the four `LG_DIFFICULTY` rows, current selection = the level's EFFECTIVE difficulty) + a 🎵 Music on/off button (label reflects the persisted state); both null-guarded for stub-DOM smoke tests. Phase-21: paused-start message. Phase-26: the Warden shop card shows the live next price via `wardenCost()` (`def.dynamicCost`), and the tower panel renders aura/income stat lines (`+25% dmg · rng N`, `+$N / 8s`) instead of damage/rate. Phase-27: the Mortar panel replaces the target-mode select with an Ammo dropdown (options from `def.ammoTypes`) plus a "Set/Change Target" button that re-enters aim mode (Phase 43: label says "click any tile"). Phase 29: shop lock state uses `isTowerAllowedOnLevel` — towers outside the level's `towers` roster lock with a distinct `🔒 <name> — not on this level` label (unlocked-but-restricted) vs `— Lv N` (not yet unlocked). Phase 33: next-wave preview (`#wavePreview` — full-width bottom bar below the message line; swatch + count chips per enemy type, built from `buildWave()` so it always matches the spawn queue) and the "◎ Ranges" toggle button (label/class track `view.showRanges`). Phase 35: the bar is ALWAYS visible — between waves it shows the wave-composition chips, otherwise (`renderStatsBar`) a Game Stats readout ("Stats:" label + chips for damage dealt, towers built/sold, leaked, DoT kills, direct kills) keyed on the values so the DOM only rebuilds when something moves. Phase 34: upgrade preview tooltip — `upgradePreview(tower)` computes the NEXT level's stats from `LEVEL_SCALE` (same formula as the Tower getters, per-tower-type branches mirroring the panel stat lines: Gun-style dmg/rng/rate, Warden aura %, Mint income, Mortar blast + payload) and `renderTowerPanel` sets it on the Upgrade button's `title` (native hover tooltip, zero CSS).
- Class `UI`: `constructor(game, view, handlers, progress)`, `buildEnemyLegend()`, `syncEnemyLegend()`, `buildLevelSelect()`, `syncLevelSelect()`, `refreshLevelSelect()`, `buildShop()`, `bindMuteButton()`, `bindButtons()`, `setPaused(paused)`, `updateHUD()`, `set(field, value)`, `syncShopSelection()`, `renderTowerPanel(tower)`, `setMessage(text)`, Phase 33: `syncWavePreview()` (per-wave DOM rebuild keyed on the composition; Phase 35: always visible, falls back to stats), Phase 35: `renderStatsBar(box)` (stats-fallback chips, value-keyed rebuild), `syncShowRangesBtn()`, Phase 44: `buildDiffSelect()` / `syncDiffSelect()` (dropdown options + current effective difficulty) and `bindMusicButton()` (label from `Music.enabled`; click = `SFX.ensure()` gesture + `handlers.onMusic()`), Phase 52: `syncTotalStats()` (right zone `#wpTotal` — the STORED all-time totals as-is, not live; "All-time:" label + chips for levels won / damage / kills / built / sold / leaked + the "↺ Reset" button bound to `handlers.onResetTotalStats()`, value-keyed rebuild)
- Constant: `DEFAULT_MSG`

### `js/input.js`
Mouse/keyboard input handling: hover-cell tracking, tower placement, tower selection, and cancel via right-click or Esc (Space toggles pause). Phase-27: Mortar aim mode — a click while `view.aimingMortar` is set stores `cellCenter` as the tower's `targetPoint`; Phase 43: ANY in-bounds cell is valid (no longer path cells only), so a shell can land between two switchback lanes; placing a Mortar auto-enters aim mode; `cancel()` clears aim state first.
- Class `Input`: `constructor(canvas, game, view, ui)`, `cellFromEvent(e)`, `onMove(e)`, `onDown(e)`, `cancel()`

### `js/tutorial.js`
First-time 3-step tutorial overlay that auto-advances as the player performs each action, is dismissable, and persists its "seen" flag in localStorage. Phase-21: step 3 instructs the player to press ▶ Resume (levels start paused).
- Class `Tutorial`: `constructor()`, `build()`, `advance()`, `dismiss()`, `update(view, game)`
- Functions: `tutorialDone()`, `markTutorialDone()`, `waveCleared(game)`
- Constants: `TUTORIAL_KEY`, `TUTORIAL_STEPS`

### `js/fit.js`
Phase 53: windowed-mode fit — scales the whole game page DOWN (never up) so the fixed ~1844×900 layout fits any smaller browser window with no scrollbars. CSS transform on `document.body` (`transform-origin: top center`; scale = `min(1, viewportW/scrollWidth, viewportH/scrollHeight)` — layout sizes are transform-invariant, no feedback loop); a transformed ancestor becomes the containing block for `position:fixed`, so the tutorial card scales with the page. Re-fits on `window.resize` + `ResizeObserver` (tower panel growing the row). Headless-safe: no-ops when `document`/`window` are undefined or `documentElement` client sizes are missing, so every vm-stub smoke boot is untouched. No input changes needed — input.js already maps clicks through `getBoundingClientRect()` ratios (rendered size).
- IIFE: `fit()` (reads viewport + body scroll sizes, writes `body.style.transform`)

## Entry point

### `index.html`
The single-page shell (page title "Ratland Defense" since Phase 39 — internal localStorage keys still use the `towerDefense*` prefix): dark-themed layout with HUD bar (incl. a "🎲 Level Generator" link to levelgen.html and a "📦 Stored Levels" link to levels.html), enemy legend (incl. `.legend-item.inactive` dimming for types not active on the current map), 1400×800 game canvas (Phase 42: grid shrank to 28×16 to fit a 1920×1080 screen), shop/tower side panel, and all classic scripts loaded in dependency order so the game runs directly from `file://`. Phase-21: the pause button boots as `▶ Resume` and the initial `#msg` tells the player to build then press ▶ Resume. Phase-31: the canvas gets `align-self: flex-start` so the flex row's default stretch can no longer grow the playfield taller when the tower panel opens (playfield-grow bug). Phase 33: next-wave preview as a full-width `#wavePreview` bar at the BOTTOM of the page, below the `#msg` line (`.wp-chip`/`.swatch` styles; reserves its space permanently so the layout never shifts), plus the "◎ Ranges" toggle button (`#showRangesBtn`) in the HUD. Phase 35: the bar is always visible — wave-composition chips between waves, Game Stats readout otherwise (no visibility toggling anymore). Phase 44: the HUD gains a 🎵 Start/Stop music button (`#musicBtn`) and a difficulty dropdown (`#diffSelect`) next to the Sound button. Phase 52: `#wavePreview` is a flex row — `#wpLeft` (the existing content, left) + `#wpTotal` (all-time stats chips + "↺ Reset" button, right-aligned via `margin-left:auto`; dark-red `#wpResetBtn` styling). Phase 53: `html { overflow: hidden; }` (no scrollbars while js/fit.js scales the body down to fit smaller windows) and `js/fit.js` loaded as the LAST script.
- No functions — static HTML + inline CSS; loads the 33 `js/*.js` scripts (incl. Phase 47's `terrain.js` right after `config.js` and BEFORE `assets.js` — assets' auto-init loads the pond sprite only when `POND_SIZE` is defined — `level_custom.js` after `path.js` and before `progress.js` — its boot registration needs the validator's spline helpers and the unlock floor counts stored levels — Phase 52's `totalstats.js` right after `score.js` and before `enemy.js`, `levelgen_waves.js` before `wave.js`, Phase-26/27's `tower_tesla.js`/`tower_warden.js`/`tower_mortar.js` after `tower.js`, Phase 55's `tower_cruiser.js` right after `tower_mortar.js`, Phase 44/46/48's `music_patterns.js` then `music_songs.js` then `music.js` after `sfx.js` — music_songs.js reuses the patterns' builders, and music.js reads `SFX.muted`, `NORMAL_SONGS` and reuses sfx_sounds' `tone`/`noise` helpers — and Phase 53's `fit.js` dead last, after main.js).

### `levels.html`
Stored Levels page shell (title "Ratland Defense — Stored Levels" since Phase 39) — the level-management hub: lists every level in the localStorage custom-level store (count in the header) with a path mini-map, per-row Export (single `.json` file) and Delete buttons, plus whole-store **Import** and **Export all** buttons in the header (Phase 40 — management moved here from the generator page); links back to the game and to the generator. Loads config/utils/levels/level_validate/level_registry/path/level_custom + `js/levels_store_ui.js` in dependency order (works from `file://`).
- Inline IIFE: re-runs `registerCustomLevels()` then `lsInit()`.

## Desktop build (single-file exe)

### `compile.py`
Single-file desktop launcher (Phase 41): serves the game over a loopback HTTP server on an **ephemeral port** (`127.0.0.1:0`, bound port published via a `threading.Event`) in a daemon thread, then opens it maximized in a pywebview window — on Windows that is EdgeChromium/WebView2, an embedded Chromium. Phase 49: the server is **multi-threaded** (`socketserver.ThreadingMixIn` + `daemon_threads = True` + `allow_reuse_address`) — WebView2 fetches index.html and all ~30 `js/*.js` in parallel, and the old single-threaded `TCPServer` blocked on the first (keep-alive) connection while every script request got `ERR_CONNECTION_REFUSED` (blank-page cold boot; a reload worked because the page unload closed the stuck socket); `webview.start(debug=False)` — no auto-opened DevTools window. Exposes an `Api` bridge as `window.pywebview.api` so the Stored Levels page uses NATIVE file dialogs (WebView2 silently swallows the in-page blob-download trick): `save_file(content, default_filename)` (native Save dialog via `window.create_file_dialog(SAVE_DIALOG)`, returns True/False) and `open_files()` (native multi-file Open dialog, reads the files and returns `[{name, content}]`); both normalize the backend's string/tuple return shapes and treat cancel as falsy/empty.
- Functions: `get_base_dir()` (`sys._MEIPASS` in the PyInstaller bundle, else the script dir), `_start_server(base_dir, port_container)`, `main()`
- Class `Api`: `set_window(window)`, `save_file(content, default_filename)`, `open_files()`
- Constants: `HOST` ('127.0.0.1'), `PORT_WAIT_TIMEOUT` (5 s)

### `compile.bat`
One-line PyInstaller build for the Windows exe: `--onefile --windowed`, bundling `*.html`, `js/` and `assets/` next to `compile.py` → `dist\Ratland Defense.exe` (gitignored build output; requires `pip install pywebview pyinstaller` on a Windows machine).

## Level data (backup & sharing format)

### `levels/riverbend.json`
Example level ("Riverbend"): a 9-waypoint path with 6 explicit per-wave enemy lists, `"difficulty": "normal"` and a `uuid`, used as the reference for the `.json` level-file schema — importable through the generator page's Import button (kept under its bare name).

### `levels/README.md`
Documentation for the `.json` level format: levels live in the browser's localStorage store (created on the generator page or imported), this folder is the backup/sharing format, the pure-data security model, and the full JSON schema (incl. the `difficulty` and `uuid` fields; waypoints are spline control points — any segment shape allowed, corners round; angled crossovers allowed, U-turns/double-backs rejected).

## Smoke tests (headless, run with `node`, all in `tests/`)

Each test defines `ROOT` as the parent of `tests/` so it runs from any cwd; game-relative paths are resolved against `ROOT`.

Each smoke test bundles the relevant classic scripts into a `vm` context and asserts one behavior without a browser.

### `tests/smoke_boot.mjs`
Verifies boot order: every script from `index.html` loads in HTML order into one shared scope, the registry boots with built-in + external levels, and no warnings appear.

### `tests/smoke3.mjs`
Legacy wave-1 simulation on level 1 with Guns (ported to the vm-bundle style).

### `tests/smoke_assets.mjs`
Tower sprite wiring: config `img` paths exist on disk, `TowerAssets` loads via a mock `Image`, and `drawTower` prefers the sprite with procedural fallback.

### `tests/smoke_build.mjs`
Build-tool behavior: happy path (generated file registers the level), failure modes (bad JSON / duplicate name / duplicate uuid → exit 1, no output, **no .json mutation**), uuid auto-add for files missing one (written back with all other fields intact), an empty directory, and Phase-23 ordering (scrambled-filename fixtures sort by difficulty then name in the generated file, which also carries `EXTERNAL_COUNT`).

### `tests/smoke_burst.mjs`
Bolt dash-burst: one full period covers the expected cycle distance (Phase-28 timing: walk 2.5s @50 + dash 1.0s @170 = 295px), speed switches at the period boundary (dash at END of period, window starts at 2.5s), Frost slow halves both walk and dash speeds, and Sniper resistance applies (0.88 at level index 2).

### `tests/smoke_difficulty.mjs`
"Difficulty" means the same thing for built-in and generated levels: procedural `buildWave` output deep-equals the generator's `composeWaveList` for every level × wave, difficulty ordering (easy < normal ≤ hard < nightmare), per-difficulty boss cadence (`bossEvery` 5/5/4/3), exact difficulty-row lever values (spawnGap/hpMul/lives/bossEvery) with monotonic ordering, fair-share tank interleave (reserved spread slots always filled, count never below the reserved share), and the built-in easy/easy/normal/normal/hard/hard mapping.

### `tests/smoke_difficulty_select.mjs`
Phase 44: difficulty selector for built-in levels. Boots the REAL js/main.js (full index.html script list, DOM stub with a Map-backed localStorage and a spec-accurate `<select>`): default = the level's built-in key (L1 easy / L5 hard) with the dropdown label showing it; selecting Hard persists per-level (`{"0":"hard"}`), rescales lives to 15, updates the option label + dropdown value; a spawned wave-1 Minion carries the override's hpMul (46 = round(40×1.15)); switching levels keeps per-level selections independent (L1 stays hard, L2 uses its built-in easy → 20 lives); corrupt stored values are dropped (unknown key falls back to built-in, valid ones kept). Section 6 doubles as the music start/stop check: headless (no AudioContext) stays silent, a fresh boot is silent until `start()` (frames alone never create a context), `start()` creates one context + schedules nodes, `stop()` closes it + silences, and boss mode activates with `boss=true`.

### `tests/smoke_enemy_unlock.mjs`
Per-level enemy availability: Minion on L1, +Tanked L2, +Singed L3, +Soused L4, +Skitterer L5, +Prowler L6, +Fission/Spore/Bolt/Bulwark/Mender/Wisp L7 (all Phase-19 types gate at level 7), plus a section asserting Spore (`childOnly`) never appears in any procedural wave list for levels 6–11.

### `tests/smoke_flame.mjs`
Flame tower: burn DoT kills and fire spreads from a burning enemy to enemies in contact (even out of tower range).

### `tests/smoke_fit.mjs`
Phase 53 windowed-mode fit: boots the REAL full index.html script list (fit.js last) in a DOM stub with `documentElement` client sizes + body scroll sizes, and asserts — small window scales by the binding constraint (width- and height-bound cases), large window stays unscaled (never upscale), live resize re-fits both directions via the captured `resize` handler, a headless stub (no client sizes) boots untouched, and scale-invariant input — a click at the SCALED canvas position of cell (14,8) maps to cell (14,8) via `Input.cellFromEvent` (the reason no input change was needed).

### `tests/smoke_levels.mjs`
Loads all classic scripts browser-like (Phase 47: incl. `terrain.js` — game.js builds ponds in `reset()`), validates every level's path, and simulates wave 1 on a couple of levels.

### `tests/smoke_levelgen.mjs`
Level generator coverage: all path candidates validate over 60 seeds (template pool asserted, spline bow away from the waypoint polyline required), spline walking checks (straight stays straight, corners round, perpendicular crossover allowed, U-turn double-walk rejected), wave lists respect options (counts/keys/boss cadence driven by the difficulty row's `bossEvery`), custom-level store save/register/dedupe, save-flow def helpers, Phase-37 import/export (validate, uuid stamping, name-dedupe for uuid-less files, export round-trip), and single-level export + delete (store removal, live-registry splice, re-import after delete).

### `tests/smoke_levelselect.mjs`
The level dropdown always matches the map the game actually runs.

### `tests/smoke_lgenemies.mjs`
Generator enemy checkboxes: box count = selectable types (Spore excluded), Minion+Colossus defaults, Select All / Clear toggle verified through `lgReadOptions`, single manual pick survives, other form fields intact.

### `tests/smoke_mend.mjs`
Mender heal aura: heals living allies within 90px at 8 hp/s, caps at maxHp, never self-heals, leaves enemies outside the radius untouched, a dead Mender's aura is inert, and multiple allies are all healed.

### `tests/smoke_money.mjs`
Per-level starting money, win carry-over scaled by the TARGET level's difficulty (Phase 33: easy 100% / normal 75% / hard 50% / nightmare 25%, floored; fraction table + unknown-key fallback asserted), and stacking retry bonus (+$50/attempt).

### `tests/smoke_mortar.mjs`
Phase-27 Mortar suite (7 checks; Phase 43: blast radius expectations updated to 112): config shape ($400 max cost, L7, blast 112, slowest fireRate 0.25/s, ammo list); unlock gate; firing rule (no targetPoint → never fires; with one → fires at the stored point even with zero enemies, no double-fire on cooldown, refires after 4s); blast falloff `[26, 21.36, 16.71, 0]` at 0/50/100/150px (real `MortarShell` flight, r=112); per-ammo payloads — flame burn on all in-blast, frost slow, venom poison stacks, Tesla damage incl. a phased Wisp + chain segments between in-blast enemies only (none for a solo blast), cannon pure damage; per-flavor resistance via the ammo key as `sourceType` (Soused vs flame at 28%); level scaling (L3 = ×2.5 dmg, ×1.25 blast) and Warden aura ×1.25 on the payload; retarget moves the impact point. Phase 55: the Colossus-resist check now expects `TOWER_TYPES.length − 3` (cruiser is a third boss weakness alongside mortar + reaper).

### `tests/smoke_cruiser.mjs`
Phase-55 Cruiser suite (7 checks): config shape ($400, damage 225, fireRate 0.25, range 700 = half the map width, projSpeed 500, L7, `waterOnly`); water-only placement (land rejected, pond cell accepted, a normal tower still rejected on the same pond cell); firing spec (lock-on within 700px → `{type:'cruiser', maxRange: tower.range}` spec, none beyond); intercept — a manually-stepped `CruiserMissile` deals exactly 225 to a Bulwark (which survives one hit); self-destruct on target death mid-flight (no impact, puff effect); self-destruct on the target escaping the tower's live range (no impact, target unharmed); and full 225 damage vs the Colossus boss (cruiser not in its resist list).

### `tests/smoke_music.mjs`
Phase 44/46/48: background music engine (js/music.js + js/music_patterns.js + js/music_songs.js) with a stub AudioContext that records scheduled nodes (oscillators keep type/freq/start-time; filters keep type): headless (no AudioContext) is a silent no-op; a fresh boot stays SILENT — frames alone never create a context (autoplay policy); `start()` creates exactly one context and normal mode schedules bass+arpeggio oscillators with NO percussion and gain = `MUSIC_LEVEL`; boss mode switches on `boss=true`, adds kick/hat noise, and runs faster (stepDur 0.1136 s vs the slowest song's 0.1563 s); the step counter advances across calls and wraps at 64; `SFX.setMuted(true)` ducks the music gain to 0 (unmute restores `MUSIC_LEVEL`); `stop()` closes the context + silences, and a later `start()` makes a FRESH context that schedules again. Phase 46 adds H–L (Phase 48 made H–L song-relative — they read the chosen song's data, and J/L check EVERY song in the roster): H = real chords (bar-1 pad chord within ±2 Hz detune, two triangles per tone, bass root, sawtooth lead melody[0]); I = melody develops (≥6 distinct lead pitches across the loop; the cadence bar 8 has no arp — the fill); J = variation (every song: ≥6 of 8 bars have distinct bass/arp/lead signatures; bar 8 ≠ bar 4); K = boss power stabs (A3+E4), snare (bandpass noise) + riser, lead voice present; L = pattern shape (all six songs 128 steps + boss 64, every voice array full, no empty eighth slots in bars 1–7, a lead note in every bar of every song, boss faster than the slowest song). Phase 48 adds M: the NORMAL_SONGS roster and deterministic random selection. **M is song-count-agnostic** (the roster grew to 11 songs without touching this test): it asserts only SHAPE invariants — nonempty roster, distinct names + BPMs, every song's final bar is a cadence FILL with a chord defined in CHORDS, stubbed `Math.random` maps 0→index 0 and 0.999→index n-1 (the last song), the scheduled pad matches each picked song's OWN bar-1 chord, an unstubbed pick lands in [0,n), and 12 consecutive stop/start picks never repeat the same song twice in a row. B is also count-agnostic: it FORCES the pick (stubbed random) to a percussion-free song (asserts no kick/hat noise across the full loop) and, when the roster has one, to a percussive song (asserts its hat/snare noise IS scheduled — some normal songs like Stormfront/Neon Drift/Skyline Run/Clockwork Citadel carry light percussion, so the old random-pick assertion was flaky). L's loop-coverage advance is data-driven off the slowest song's stepDur.

### `tests/smoke_new_towers.mjs`
Phase-26 new-tower suite (7 checks): config shape + all five at L7 + `wardenPlacementCost` curve; Tesla chain falloff `[18, 14.4, 11.52]` incl. a phased Wisp as hop 1 + 3 effect segments; Venom 6 hits → 5-stack cap at 30 dps/s; Reaper ×2.5 below the 30% HP threshold vs plain above; Mint +$10 (L1) / +$25 (L3) with `stats.moneyEarned` staying 0 (deterministic forced ticks); Warden multiplier unit checks (two=1.5625, one=1.25, self=1, none=1); Warden e2e — a Gun inside the aura deals exactly 12 × 1.25 = 15 per hit (damage measured as `maxHp − hp`). Phase 42: Mint placement row moved 16 → 15 (grid shrank to 16 rows).

### `tests/gen_tower_sprites.py`
Pure-stdlib PNG writer that generated the Phase-26/27 tower sprites (`assets/{tesla,venom,reaper,mint,warden,mortar}.png`, 128×128 RGBA) in the style of the existing six. Phase 55: adds `cruiser` (blue-grey warship hull with twin missile tubes → `assets/cruiser.png`). NOTE: re-running it regenerates ALL sprites byte-differently from the committed ones — run it once for a new sprite, then restore the untouched files with `git checkout`.

### `tests/smoke_paused_start.mjs`
Phase-21 paused start: boots the REAL `main.js` (full index.html script list) in a DOM stub with a spec-accurate `<select>` and Proxy 2D context, then asserts every level entry starts paused — boot, pause-button round-trip, Space key, dropdown switch (`loadLevel`), retry (`restart(true)`), and win auto-advance (unpaused frame loop counts the victory timer down; the next level lands paused with `▶ Resume`). Phase 44: the stub's window captures ALL keydown handlers (there may be more than input.js's toggle) and Space presses fire every one.

### `tests/smoke_phase.mjs`
Wisp phasing: `targetable` flips at the 2.5s solid / 3.7s cycle boundaries, the phase timer freezes while slowed (Frost pauses the cycle), `Tower.acquireTarget` skips a phased wisp but picks a solid one, non-phasing enemies are always targetable, and Phase-28 adds a render check — a phased wisp draws no body fill (unfilled ring) while a solid one fills its disc.

### `tests/smoke_phase34.mjs`
Phase 34: death animation + upgrade preview. A burn-DoT kill pushes exactly one corpse with the enemy's death position/radius/color and a live timer; a leak produces none; corpses tick down and are removed after their 0.15 s lifetime; `drawCorpses` renders one arc per corpse scaled/faded by remaining life (full → r 11 α 1, half → r 5.5 α 0.5) and nothing for an empty list; a lingering corpse never blocks the win check; and `UI.upgradePreview` returns the exact tooltip strings for Gun L1/L2, Warden, Mint and Mortar (plus null upgradeCost at max level).

### `tests/smoke_ponds.mjs`
Phase 47: difficulty-scaled water ponds (js/terrain.js) — pond count per difficulty for a fixed level (easy 0 / normal 1 / hard 2 / nightmare 4), determinism (same (level, difficulty) → identical layout; different difficulty → different layout), invariants across all 6 built-in levels × all 4 difficulties (every pond is a 4×4 block, in-bounds, no two ponds overlap, ZERO pond cells on the path), and Game integration (`canPlace` false on a water cell, true on a plain grass cell; `isWaterCell` sanity) — 148 checks.

### `tests/smoke_progress.mjs`
Level progression: fresh levels pause until the first tower, winning unlocks + persists the next level, locked levels can't be loaded; Phase-23 adds the external-unlock floor (fresh `unlocked === LEVELS.length`, and with `EXTERNAL_COUNT` set, fresh/stale saves lift to built-ins + externals).

### `tests/smoke_railgun.mjs`
Railgun: config values, level-6 unlock gate, 1/2ⁿ pierce falloff, pierce cap, per-enemy resistance, and the straight-slug flight. Enemy HP expectations are computed from `ENEMY_TYPES.tank.hp × LG_DIFFICULTY[hard].hpMul` (map level 6 is 'hard').

### `tests/smoke_ranges.mjs`
Phase-33 "Show Ranges" toggle: with it off only the selected tower draws a range circle; with it on every placed tower is circled (one arc per tower, at its cell center with its current range), no duplicate circle when a tower is also selected, and the per-tower rules hold under the toggle (Warden → gold aura ring, Mortar → blue blast circle at its `targetPoint`).

### `tests/smoke_regen.mjs`
Bulwark flat regen (6 hp/s): exact per-second restore, cap at maxHp, a sustained flame burn (10 dps re-applied) still kills it, and a weak burn (4 dps) is outpaced so hp holds at the maxHp − burnDps·dt floor.

### `tests/smoke_registry.mjs`
Level registry: built-ins seed unchanged (no `towers` roster); `registerLevel` normalizes good defs and rejects bad ones. Phase 29: a `towers` roster is kept through normalization, and malformed rosters (non-array, empty, non-string entry, unknown key) are all rejected. Phase 32: the security caps (M-1 waypoint count / L-1 totalWaves / L-2 enemy-key whitelist) are in the bad-def table AND asserted as specific rejection messages; a hostile 100k-waypoint def is rejected in <500ms (DoS guard short-circuits before spline work) and the 200-waypoint boundary does not trip the cap. Phase 42: the good-def fixture's bottom run moved from row 15 to row 14 (on the 16-row grid a row-15 corner bow leaves the grid).

### `tests/smoke_resist.mjs`
Per-level enemy resistance: 4% on level 1, +4% per map level, capped at 80%.

### `tests/smoke_score.mjs`
Score math (kills×10 + lives×50 + moneyEarned×1), per-level persistence, corrupt-data normalization, and record-only-on-beat.

### `tests/smoke_split.mjs`
Fission death splits into exactly 2 Spore children at the parent's path position, children inherit the game's wave/level for HP scaling, spore children survive the same-frame alive-filter in `Game.update`, and non-splitting types die without spawning anything.

### `tests/smoke_sfx.mjs`
SFX engine with a stub AudioContext: `play()` routes through recipes, mute suppresses + persists, headless stays silent.

### `tests/smoke_speed.mjs`
Phase 34: persistent game speed. Boots the REAL js/main.js (full index.html script list, DOM stub with a Map-backed localStorage): a pre-seeded `towerDefenseSpeed.v1` of '2' loads as speed 2 + label "Speed: 2x"; absent, out-of-range ('7') and garbage values all fall back to 1x; `handlers.onSpeed()` cycles 2→3 persisting "3", then 3→1 persisting "1".

### `tests/smoke_stats.mjs`
Phase 35 game-stats tracking: fresh stats all zero; towersBuilt/towersSold (failed placements don't count); damageDealt credits effective post-resistance damage and never counts overkill (clamped to HP absorbed), dead enemies credit nothing; DoT-vs-direct split across kill causes (direct hit, burn-active kill, poison-only kill) with the invariant `dotKills + directKills === kills`; leaked counter (leaks are not kills); and an end-to-end flame burn DoT kill that credits damageDealt and classifies as a DoT kill.

### `tests/smoke_stored_levels.mjs`
Phase 40 Stored Levels page: boots the REAL levels.html script bundle in a DOM stub with a pre-seeded store and asserts render (one row per level — mini-map canvas, name, short uuid, Export + Delete buttons; header count), whole-store Export all (anchor filename + blob content + message), Import (new `.json` level added and listed immediately, same file re-imported → uuid-dedupe skip, corrupt file → skipped with a named problem), Delete (removed from store AND live registry, re-rendered), and Export all on an empty store ("Nothing to export"). Phase 41 section 6 (async IIFE — the script's completion value is its promise): with a stubbed `window.pywebview.api`, Export one/all call `save_file` with the exact JSON + filename (no blob/anchor fallback), Import consumes `open_files()` `{name, content}` pairs (valid added, existing uuid dedupe-skipped, corrupt reported), and cancelled dialogs behave (save → "Export cancelled.", open → no-op message change).

### `tests/smoke_targeting.mjs`
Each targeting mode (first/last/closest/strongest) picks the correct enemy from a fixed set in range.

### `tests/smoke_totalstats.mjs`
Phase 52 all-time stats + reset: store load/normalize (junk keys / non-numeric / negative values dropped), `foldTotalStats` accumulation (damageDealt rounded, `levelsWon` only via `won=true`) + persistence, `resetTotalStats` zeroes + persists; Game integration (kills/leaks/builds accumulate in `game.stats` mid-level while the all-time store stays untouched until the level-end fold, mirroring main.js); UI bar (left zone = this level's "Stats:" fallback, right zone = "All-time:" chips with the stored values + a wired "↺ Reset" button) and a simulated reset click with `confirm` stubbed both ways (declined leaves the store; accepted clears it and the bar re-renders zeros).

### `tests/smoke_tower_hp.mjs`
Phase 54 tower health + friendly fire (7 checks): fresh tower hp === maxHp === invested × TOWER_HP_PER_COST; Warden #2 durability tracks its REAL cost ($400 → 800, not def.cost); upgrade raises maxHp by upgradeCost × 2 and a damaged tower heals by exactly that delta; homing shell consumed on tower impact (enemy untouched, blocker loses one flat hit, no splash); destruction removes the tower from `game.towers`, sets alive=false, counts `stats.towersDestroyed`; railgun slug penetrates towers — blocker Mint takes full base 70 while the tank beyond still takes un-halved 70 (pierce count/halving untouched by tower hits); mortar shell detonating exactly on a tower center never damages it.

### `tests/smoke_tower_unlock.mjs`
Tower availability is gated by map level. Phase-26: the availability table expects all 11 towers at index 6 (level 7), the level-7 placement test places all 11, and a Warden dynamic-cost check asserts $300 first / $400 second. Phase-27: the roster is 12 (Mortar added) — availability table and placement count updated to 12. Phase 42: placement rows moved from 16/17 to 15 (the grid shrank to 16 rows). Phase 55: the roster is 13 (Cruiser added) — availability table + placement count updated, the bundle gains `terrain.js` (the level-7 map's ponds), and the level-7 placement test places the Cruiser on a real pond cell from `g.ponds.cells` while asserting it is rejected on land.

### `tests/smoke_tutorial.mjs`
Tutorial flag persistence plus step auto-advance/dismiss.

### `tests/smoke_ui.mjs`
The selected tower's upgrade button re-enables when money rises and disables when it falls; the target-mode dropdown survives deselect/reselect; the pause button reflects state and is wired to `onPause`; the enemy legend renders all 13 rows in the fixed design order with correct swatches, names, and resistance text (Phase-19 types included); and Phase-24 checks the 2-word `desc` blurb under resist-less names plus `syncEnemyLegend()` grey-out (L1: 11 rows dimmed, Minion+Colossus lit; L7: all lit; external explicit-wave level greys everything absent from its own wave lists — Minion/Fission/Spore stay lit).

### `tests/smoke_venom_visual.mjs`
Phase-30 venom tint: a plain enemy keeps its def color, a poisoned enemy's body disc fills green `#9fff8f`, poison wins over the Frost slow's blue when both are active, the tint clears once `poisonTimer` expires, and a poisoned PHASED wisp still renders as an unfilled ring (no body fill).

### `tests/smoke_wave_preview.mjs`
Phase-33 HUD next-wave preview: between waves it shows the upcoming wave's composition as swatch + count chips that exactly match `buildWave()` output (counts, colors, label); and an external level with explicit wave lists previews its own composition. Phase 35: the bar is always visible — during the build phase, while a wave is in progress, and after the final wave it shows the "Stats:" fallback instead of hiding. Phase 52: the stub DOM gains `#wpLeft`/`#wpTotal` and the preview/stats checks read from `#wpLeft` (the left zone).

### `tests/balance_sim.mjs`
Phase 51 balance pass: headless full-level simulation bundling the real game scripts; a deterministic reference strategy (greedy best-coverage placement, fixed build order, upgrade-cheapest policy) plays all 12 waves of every level at each difficulty (forced via `setLevelDifficulty`, with an in-memory localStorage stub) plus a synthetic full-roster level so the L7+ enemy types are exercised; prints a level × difficulty W/L matrix and asserts termination within the sim cap, run-to-run determinism, and the easy-mode playability floor on all built-in levels. Phase 55: the bundle gains `tower_cruiser.js`, `cruiser` joins `BUILD_ORDER` after mortar, and the placement picker special-cases `def.waterOnly` towers (first free pond cell from `game.ponds.cells`) — easy runs have no ponds, so the Cruiser simply never places there.

### `tests/smoke_winloss.mjs`
Phase 51 regression for the win-at-0-lives bug: the last enemy of the final wave leaking while it drains the final life must end the game `lost` (0 lives), never `won`; a normal kill-based win still ends `won`; and a settled loss is not overwritten by later `update()` ticks.

### `tests/scratch_spline.mjs`
Scratch check for the spline core: straight stays straight, L-shape corner cell set sane (curve bows ≤2 cells off runs), U-turn double-back detected, clean crossover not flagged, `buildPath` contract + `pointAtDistance` intact.

### `tests/scratch_templates.mjs`
Scratch check for the generator templates: 200 seeds × all 5 templates produce validated candidates with sane stats; prints one example per template.

### `tests/heartbeat.txt`
Progress heartbeat (last write time + status note), updated as work lands.

### `.gitignore`
Excludes the temporary `tests/` folder (all smoke files) from Git.

## Documentation

### `AGENTS.md`
Agent directives: modular code with a strict 300-line file limit, plan-first workflow via `PLAN.md`, and frequent saves to disk.

### `PLAN.md`
Active continuation (part 5) of the main implementation plan: Phase 40 (generator creates only — Import/Export/Delete management moved to the Stored Levels page — DONE), Phase 39 (rename to "Ratland Defense" — DONE, titles only), Phase 38 (Stored Levels page — DONE), Phases 49–51 (exe cold-boot fix, song-count-agnostic music test, balance pass — all DONE), Phase 52 (all-time stats + reset on the bottom bar — DONE: fold-at-level-end design, not live) and Phase 53 (windowed screen scaling — DONE: js/fit.js scales the body down to fit small windows, never up, no scrollbars).

### `PLAN_01.md`
Main implementation plan, part 1 (early phases).

### `PLAN_02.md`
Main implementation plan, part 2 (Phases through 24, all done; rotated from PLAN.md when it hit the line limit).

### `PLAN_Levels.md`
Plan for importable external levels: JSON files in `levels/`, generated `js/levels_external.js`, and the security model.

### `PLAN_generator.md`
Plan for the level generator page: phases 1–3 (page + templates, 45° diagonals, Catmull-Rom spline curves with sample-based validation) — all done, smoke tests green.

### `PLAN_enemies.md`
Design proposal for 5 new enemy types (split, dash-burst, regen, heal aura, phasing) with stats, counterplay, implementation notes, test plan. **Implemented in Phase 19** (all five `unlockLevel: 7`); see PLAN.md.

### `SECURITY_AUDIT.md`
Security audit of the whole codebase: threat model (local-only app; untrusted inputs = attacker level files + hand-crafted localStorage), findings by severity (1 medium, 2 low, 4 info), verified positive controls, and a prioritized fix list (proposals only — no code changed).

### `PLAN_towers.md`
Design + implementation record for the 5 new tower types (Glacier dropped in review) — Tesla (chain lightning), Venom (stacking poison), Reaper (execute), Mint (economy income), Warden (damage aura, dynamic cost $300/+$100) — with stats, counterplay vs Phase-19 enemies, implementation notes, test plan, and settled review decisions. **APPROVED & IMPLEMENTED in Phase 26** (all five `unlockLevel: 7`); see PLAN.md.

### `REVIEW_REPORT.md`
Full codebase review report: current-state metrics, open security findings (M-1/L-1/L-2), dead-code list, balance observations, prioritized feature recommendations (Tiers 1–4), architecture notes, and proposed Phases 32–36.
