# File Summary

One entry per file: path, a 1-sentence purpose, and its functions (classes listed as `ClassName` with their methods).

## Core game

### `js/config.js`
Static game configuration: grid size, path waypoints, starting money/lives, 12 tower definitions (incl. the 5 Phase-26 additions — Tesla chain, Venom poison, Reaper execute, Mint income, Warden aura — and the Phase-27 Mortar, an area-effect artillery tower with `ammoDefault`/`ammoTypes` payload selection; all L7+) and 13 enemy types (incl. the 5 Phase-19 additions, all `unlockLevel: 7`; resist-less types carry a 2-word `desc` for the legend), targeting modes, upgrade/resistance scaling. Phase-28: Bolt dash timing retuned to walk 2.5s → dash 1.0s per 3.5s period (`burst.dashDur` 0.8 → 1.0). Phase-31: Colossus `resist` list drops `'mortar'` (11 entries) — the Mortar is the one tower it does NOT resist, and no enemy resists the `'mortar'` sourceType at all.
- Constants: `GRID`, `CANVAS_W/H`, `WAYPOINTS`, `LEVEL_START_MONEY`, `RETRY_BONUS`, `START_LIVES`, `SELL_REFUND`, `MAX_LEVEL`, `TOTAL_WAVES`, `WAVE_DELAY`, `EARLY_SEND_BONUS_PER_SEC`, `WIN_ADVANCE_DELAY`, `TOWER_TYPES`, `TARGET_MODES`, `LEVEL_SCALE`, `UPGRADE_COST_FACTOR`, `RESISTANCE_PER_LEVEL`, `RESISTANCE_CAP`, `ENEMY_TYPES`, `SLOW`, `FLAME_SPREAD_RADIUS`
- Functions: `levelStartMoney(levelIndex)`, `isTowerAvailable(type, levelIndex)`, `isTowerAllowedOnLevel(type, levelIndex)` (Phase 29: the per-level `towers` roster layer on top of `isTowerAvailable`; reads `getLevel(levelIndex).towers`, absent = all unlocked allowed), `resistanceFactor(levelIndex)`, `isEnemyAvailable(type, levelIndex)`, `wardenPlacementCost(existingCount)` (Phase 26: $300 + $100 × existing Wardens)

### `js/main.js`
Entry point that wires game, renderer, UI and input together and runs the fixed-timestep loop with speed/pause control (each frame calls `ui.syncEnemyLegend()`). Phase-21: every level entry starts PAUSED (`paused` true at boot; `restart()` re-pauses); the player begins with ▶ Resume or Space.
- Functions: `restart(retry)`, `loadLevel(i, carryOver)`, `onWin()`, `defName(tower)`, `setPaused(p)`, `frame(now)`, `ensureRestartButton()`
- Object: `handlers` (`onLevelChange`, `onPickType` (Phase 29: rejects towers outside the level's `towers` roster with a "not available on this level" message, distinct from the unlock-level message), `onSendWave`, `onSpeed`, `onPause`, `onUpgrade`, `onSell`, `onTargetMode`, Phase-27: `onAmmo(tower, ammo)` validates against `def.ammoTypes` and reloads the Mortar, `onMortarRetarget(tower)` re-enters aim mode)

### `js/game.js`
Holds the core game state (money, lives, entity lists) and orchestrates per-tick updates of waves, enemies, towers, projectiles and win/lose conditions. Starting lives come from the level's difficulty row (`LG_DIFFICULTY`, fallback `START_LIVES`). Phase-19: `onEnemyKilled` spawns split children (Fission → 2 Spore) at the parent's path position using the game's wave/level for HP scaling; `update(dt)` calls `mendAura(enemies, dt)` after `spreadFire`. Phase-26: tower loop passes each tower the Warden aura multiplier (`wardenAuraMultiplier`); spec dispatch handles `income` (money only — NOT `stats.moneyEarned`) and `chain` (`applyChainLightning`) before the projectile branch; Phase-27: `mortar` specs spawn a `MortarShell` and its detonation routes to `applyMortarBlast` instead of `applyImpact`; `placeTower` special-cases `def.dynamicCost` (Warden) and records `tower.invested`; `reset()` clears `this.effects`. Phase 29: `placeTower` gates on `isTowerAllowedOnLevel` (unlock level AND the level's `towers` roster) — defense in depth alongside the shop lock.
- Class `Game`: `constructor(path, levelIndex)`, `levelDef()`, `startMoney()`, `startingLives()`, `enterLevel(base)`, `retry()`, `reset()`, `score` (getter), `endScore()`, `setMessage(text, seconds)`, `enemiesById` (getter), `canPlace(cx, cy)`, `placeTower(typeName, cx, cy)`, `wardenCost()`, `startIfReady()`, `sendNextWave()`, `upgradeTower(tower)`, `sellTower(tower)`, `onEnemyKilled(enemy)`, `onEnemyLeaked(enemy)`, `update(dt)`
- Constant: `TOWER_COSTS`

### `js/enemy.js`
The enemy entity that walks the path, takes damage with per-tower resistance, and can be slowed, burned or poisoned. Max HP scales with wave number AND the level's difficulty row `hpMul` (from `LG_DIFFICULTY`, defensive `'normal'` fallback). Phase-19 behaviors: flat regen (Bulwark) applied before burn each tick; Bolt dash-burst via `burstTimer` (dash at END of period, both speeds slowable); Wisp phasing via `phaseTimer` (untargetable while phased, cycle paused by Frost slow — see `targetable`). Phase-26: stacking poison (`poisonStacks`/`poisonDpsPerStack`/`poisonTimer`) ticks in `update()` and reports kills as `'burned'` to reuse the DoT kill path; Phase-30 adds a `poisoned` getter (true while `poisonTimer > 0`) used by the renderer's green tint.
- Class `Enemy`: `constructor(typeName, wave, levelIndex)`, `burning` (getter), `targetable` (getter), `currentSpeed` (getter), `update(dt, path)`, `damageMultiplier(sourceType)`, `takeDamage(amount, sourceType)`, `applySlow(ignoreResist = false)` (Phase 31: skips frost resistance when set — Mortar payloads), `applyBurn(dps, duration, ignoreResist = false)` (same for flame), `applyPoison(addStacks, maxStacks, dpsPerStack, duration)`, `progress(pathTotal)`

### `js/tower.js`
The tower entity handling target acquisition by mode, firing cooldowns, upgrade costs and sell value. Phase-19: `acquireTarget` skips untargetable enemies (Wisp while phased) — splash/burn still hit it. Phase-26: `update(dt, enemies, pathTotal, auraMult)` scales damage/burn/poison by the Warden aura multiplier; Mint returns an `income` spec instead of a projectile; Tesla returns a `chain` spec; `invested` records the actual (dynamic) cost for sell refunds. Phase-27: towers with `def.ammoTypes` (Mortar) skip target acquisition entirely — they fire a `{type:'mortar'}` spec at the player-set `targetPoint` on cooldown, payload = the selected ammo tower's own damage/slow/burn/poison × level scale × aura multiplier. Phase-31: the mortar spec's `sourceType` is `'mortar'` (not the ammo key) — no enemy resists it, so mortar payloads never take resistance; blast radius stays the Mortar's own `range` × level scale.
- Class `Tower`: `constructor(typeName, cx, cy)`, `x`/`y` (getters), `range`/`damage`/`fireRate` (getters), `upgradeCost()`, `sellValue()`, `acquireTarget(enemies, pathTotal)`, `scoreFor(e, pathTotal)`, `update(dt, enemies, pathTotal, auraMult)`

### `js/tower_tesla.js`
Phase-26 Tesla chain-lightning: `applyChainLightning(game, spec)` deals instant damage to the primary target plus up to N hops (nearest un-hit enemy within `hopRadius`, ×`falloff` per hop), hits phased enemies, and pushes a fading `{type:'chain', segments}` entry onto `game.effects`.

### `js/tower_warden.js`
Phase-26 Warden aura: `wardenAuraMultiplier(towers, tower)` returns ×1.25 per other Warden whose range reaches the tower (multiplicative; a Warden never buffs itself).

### `js/tower_mortar.js`
Phase-27 Mortar: `MortarShell` flies a fixed-point lobbed shell (no homing; cosmetic `arc` getter) and returns a detonation spec on arrival; `applyMortarBlast(impact, enemies, game)` deals splash-falloff damage (`dmg × (1 − 0.4·d/r)`) to every enemy in the blast radius via `takeDamage(dmg, 'mortar')` — Phase-31: no enemy resists the `'mortar'` sourceType, and slow/burn apply with `ignoreResist`, so mortar payloads never take resistance (the ammo still sets the DoT type/stats), pushes an `{type:'explosion', x, y, radius, color, timer, duration}` splash effect on every detonation (Phase-31: ring sized to the blast radius, colored by `TOWER_TYPES[ammo].color`), and for Tesla ammo with ≥2 in-blast enemies pushes a fading `{type:'chain', segments}` effect connecting consecutive in-blast enemies (lines only — no outward hops).

### `js/projectile.js`
Projectile flight and impact logic: homing projectiles with splash/slow/burn, fire spread between burning enemies, the railgun's straight piercing slug, `mendAura(enemies, dt)` — the Mender's heal aura (heals living allies within radius at `hps*dt`, capped at maxHp, skips dead/self) — and Phase-26 impact extras: Reaper execute (×multiplier damage when the direct target is alive below `threshold` HP fraction) and Venom poison (`e.applyPoison(...)` on hit).
- Class `Projectile`: `constructor(spec)`, `update(dt, enemiesById)`
- Class `PiercingShot`: `constructor(spec)`, `update(dt, enemies, game)`
- Functions: `applyImpact(impact, enemies, game)`, `spreadFire(enemies, game)`, `mendAura(enemies, dt)`, `segDist(px, py, x1, y1, x2, y2)`
- Constant: `PIERCING_HIT_RADIUS`

## Waves & path

### `js/wave.js`
Wave scheduler that builds each wave's enemy list and times spawning plus auto-start between waves. Procedural waves use the SAME difficulty model as generated levels: the level's `difficulty` row from `LG_DIFFICULTY` drives wave size/tank share/boss cadence via the shared `composeWaveList`, with the enemy pool gated by `unlockLevel` AND excluding `childOnly` types (Spore is only ever spawned by Fission death). Spawn pacing uses the difficulty row's `spawnGap` (seconds between spawns, defensive `'normal'` fallback).
- Class `WaveManager`: `constructor(levelIndex, totalWaves, explicitWaves)`, `inProgress` (getter), `startNext(game, auto)`, `update(dt)`, `reset()`
- Functions: `buildWave(wave, levelIndex, explicitWaves)`, `levelActiveEnemies(levelIndex)` (Phase 24: the active-enemy set for the legend — explicit-wave levels derive it from their own `waves` lists plus split children; procedural levels use the `unlockLevel` gate)

### `js/path.js`
Path construction and geometry: the path is a **centripetal Catmull-Rom spline** through waypoint cell centers (straight runs stay straight, corners round inside their cells), sampled to a dense pixel polyline; blocked cells come from sample-based cell walking. Any segment shape is allowed; re-walking two consecutive cells in the same direction (U-turn/double-back lane) is rejected, angled crossovers pass.
- Functions: `crPoint(p0, p1, p2, p3, u)` (centripetal CR, alpha=0.5), `sampleSpline(waypoints, cell)`, `buildPath(waypoints)`, `key(cx, cy)`, `walkPathCells(waypoints)` (sample-based: marks every cell a spline sample falls in), `hasSelfIntersection(waypoints)` (sample-based cell-walk direction test), `pointAtDistance(path, d)`, `isPathCell(path, cx, cy)`
- Constant: `SPLINE_STEP_PX` (max px between samples)

## Levels

### `js/levels.js`
Hard-coded definitions of the six built-in levels (Snake, Serpentine, Comb, Switchback, The Gauntlet, Crossroads) as grid-coordinate waypoint lists, each with a `difficulty` key (L1–L2 easy, L3–L4 normal, L5–L6 hard) that drives procedural wave scaling exactly like the generator's.
- Constant: `LEVELS`
- Functions: `levelWaypoints(i)`

### `js/level_validate.js`
Pure level-def validation shared by the registry, the build tool and smoke tests: a pure-data security gate plus waypoint and optional-field schema checks. Waypoints may use **any non-zero segment shape** (the path is a Catmull-Rom spline through them); spawn x=-1, exit x=cols, integer in-bounds coords, no self-intersection, and a sampled-spline grid-bounds check (corners must not bow off the map) are enforced. Optional `uuid` field must be a lowercase v4 UUID string when present. Phase 29: optional `towers` roster field — when present (and not null) it must be a non-empty array of valid `TOWER_TYPES` keys; absent/null = all towers allowed.
- Functions: `isPlainObject(v)`, `checkPureData(value, depth, path, problems)`, `validateWaypoints(wps, problems)`, `validateOptionalFields(def, problems)` (incl. optional `difficulty` enum + `uuid` v4 pattern + `towers` roster checks), `validateLevelDef(def)`
- Constants: `isInt`, `MAX_DEPTH`, `DIFFICULTY_KEYS`, `UUID_RE`

### `js/level_registry.js`
The single ordered registry of all playable levels: seeds the built-in levels and registers validated external ones behind a uniform normalized shape (incl. `difficulty`, default 'normal', pass-through `uuid` — the level's machine identity used for duplicate detection; names are cosmetic — and Phase-29 pass-through `towers` roster, absent = all towers allowed).
- Functions: `normalizeLevelDef(def, index)`, `registerLevel(def, sourceFile)` (warns on duplicate uuid), `getLevels()`, `getLevel(i)`, `levelCount()`
- Constant: `_levels`

### `js/levels_external.js`
Auto-generated data-only script (from `tools/build_levels.mjs` over `levels/*.json`) that re-validates and appends external levels to the registry at boot. Entries are ordered by difficulty (easy → normal → hard → nightmare), then alphabetically by name, so players meet easier external levels first; all are added unlocked (see `EXTERNAL_COUNT`).
- Constants: `LEVELS_EXTERNAL` (currently one level: Riverbend from `riverbend.json`), `EXTERNAL_COUNT` (count of external levels — the unlock floor used by `progress.js`)
- Inline IIFE: validates each entry with `validateLevelDef` and pushes normalized defs onto `_levels` (incl. `difficulty`, default "normal", and pass-through `uuid`)

### `js/level_custom.js`
localStorage mirror (`towerDefenseCustomLevels.v1`) for levels created on the generator page, with boot-time re-registration into the registry (validated, deduped by **uuid** — legacy defs without a uuid fall back to name) so custom levels survive reloads in both pages.
- Functions: `getCustomLevels()`, `saveCustomLevel(def)` (replaces same-uuid entry), `registerCustomLevels()`, `isCustomLevel(i)`, `customLevelId(def)`, `registryHasLevel(def)`
- Constant: `CUSTOM_LEVELS_KEY`; auto-runs `registerCustomLevels()` at load (guarded)

### `js/levelgen_paths.js`
Seeded RNG (mulberry32) plus Bloons/Kingdom-Rush-inspired path templates that produce validated waypoint candidates with stats (length, crossovers, buildable). Templates emit axis-aligned control points that the Catmull-Rom spline bows into real curves: `tplArc` (one wide offset bend), `tplSBend` (two opposing offsets, smooth S), `tplLoop` (hairpin with offset lane + crossover); crossover shapes: `tplWeave`, `tplCrossroads`. Each candidate carries its own `_seed` so callers can derive stable per-candidate extras (e.g. the silly name). Stats use the shared sample-based walker from path.js. Row ranges are clamped off the boundary rows (1..rows-2) so spline corners cannot bow off the map edges.
- Functions: `mulberry32(seed)`, `rngInt`, `rngPick`, `rngShuffle`, `tplArc(rng)`, `tplSBend(rng)`, `tplLoop(rng)`, `tplWeave(rng)`, `tplCrossroads(rng)`, `lgPathStats(waypoints)`, `generatePathCandidates(seed, count, maxTries)`
- Constant: `LG_TEMPLATES` (5 templates; 4 candidates drawn per Generate)

### `js/levelgen_names.js`
Identity + naming helpers for generated levels: `lgUuid()` produces a 128-bit v4 UUID (the level's identifier for the code — stored in the JSON, never shown in the UI) and `lgSillyName(rng)` produces a silly randomized 2-word human name (adjective + noun) from a seeded RNG.
- Functions: `lgUuid()`, `lgSillyName(rng)`
- Constants: `LG_ADJ` (20 adjectives), `LG_NOUN` (20 nouns)

### `js/levelgen_waves.js`
The shared difficulty model: the `LG_DIFFICULTY` table (easy/normal/hard/nightmare — base, ramp, tank share, plus the visible levers `spawnGap`, `hpMul`, `lives`, `bossEvery`, label) and `composeWaveList(wave, d, pool)`, which both the generator (`buildGeneratedWaves`) and the built-in procedural waves (`js/wave.js`) use, so difficulty means the same thing everywhere. Regular-wave tanks land on evenly spread fair-share slots (no clumping); boss waves come every `d.bossEvery`-th wave with the boss first.
- Functions: `composeWaveList(wave, d, pool)`, `buildGeneratedWaves({enemies, difficulty, waves})`
- Constant: `LG_DIFFICULTY` (easy/normal/hard/nightmare)

### `js/levelgen_save.js`
Create flow for the generator page: builds pure-data JSON defs (incl. `difficulty`, the Phase-29 `towers` roster from the checked tower checkboxes, and a fresh v4 `uuid` — the level's machine identity), names files after the sanitized silly name with **no level-number prefix** (ordering is not the generator's job), saves via File System Access API with a Blob-download fallback, then mirrors to localStorage and registers in memory.
- Functions: `lgFilename(name)`, `lgBuildDef(candidate, opts)` (stamps `uuid`; writes `towers` when `opts.towers` is a non-empty array), `lgSaveFile(def, filename)` (async), `lgCreateLevels(candidates, opts)` (async)

### `js/levelgen_ui.js`
Generator page UI logic: small-canvas path diagrams (checkerboard, the actual spline drawn via `sampleSpline`, spawn/exit markers, crossover highlighting from the shared sample-based walker), enemy-checkbox builder (rows use `index.html`'s `.legend-item` style — swatch + name + desc — with a checkbox prepended) + Select All/Clear toggle, Phase-29 tower-roster checkbox builder (rows use `index.html`'s `.shop-item` style — name + cost + desc — with a checkbox prepended; all towers checked by default, unchecking removes a tower from the level) + its own Select All/Clear toggle, options form reader (incl. `towers`), 4 preview cards each with an **editable silly-name input** + stats (incl. difficulty label and tower count) + checkbox, Create / Try Again handlers (both require ≥1 enemy AND ≥1 tower).
- Functions: `lgCrossoverCells(waypoints)`, `lgDrawDiagram(canvas, waypoints)`, `lgBuildEnemyCheckboxes(wrap, enemyTypes)` (excludes `childOnly`; Minion+Colossus default), `lgSelectAllEnemies(wrap, on)`, `lgBuildTowerCheckboxes(wrap, towerTypes)` (Phase 29; all checked by default), `lgSelectAllTowers(wrap, on)`, `lgReadOptions()` (returns `{enemies, towers, difficulty, startMoney, waves}`), `lgGenerate()` (assigns a silly name per candidate; guards ≥1 enemy + ≥1 tower), `lgRenderCards(opts)`, `lgCreate()` (async; same guards), `lgTryAgain()`, `lgInit()` (wires BOTH Select All buttons — auto-flip to Clear when all checked)
- Constants: `LG_DIAGRAM_CELL`, `lgState`

### `levelgen.html`
Secondary page shell for the level generator: a **three-column flex row copied from `index.html`'s `#wrap`** — left = enemy legend (the exact `#legend` / `.legend-item` style: swatch + name + desc, with a checkbox prepended to each row and a **☑ Select All** auto-flip button in the header), center = everything else (difficulty/money/waves form, Generate/Create/Try Again buttons, message line, preview-card area, and a "How to add your levels" instructions box — save files into the `levels/` folder, then run `build_levels.bat` from `Tools/`), right = tower shop (the exact `#side` / `.shop-item` style: name + cost + desc, with a checkbox prepended to each row and its own **☑ Select All** auto-flip button). All generator scripts loaded in dependency order. No global name field; names are per-candidate on the cards.
- Inline IIFE: calls `lgBuildEnemyCheckboxes(...)` + `lgBuildTowerCheckboxes(...)` and boots with `registerCustomLevels()` + `lgInit()`

## Persistence, scoring & sound

### `js/progress.js`
Persistent level-unlock progression stored in localStorage (with an in-memory fallback) that survives reloads. External levels are always unlocked: the unlock floor is built-ins + `EXTERNAL_COUNT` (emitted by the generated `levels_external.js`), and stale saved values below the floor are lifted up.
- Functions: `loadProgress()`, `saveProgress(p)`, `normalizeProgress(data)`, `externalCount()`
- Constant: `PROGRESS_KEY`

### `js/score.js`
Score calculation and per-level best scores persisted in localStorage with the same try/catch fallback pattern as progress.
- Functions: `computeScore({kills, lives, moneyEarned})`, `loadScores()`, `saveScores(s)`, `normalizeScores(data)`, `recordScore(levelIndex, score)`, `bestScore(levelIndex)`
- Constants: `SCORES_KEY`, `SCORE_WEIGHTS`

### `js/sfx.js`
SFX engine that lazily owns the AudioContext (created on a user gesture for autoplay policy), plays generated sound recipes, and persists mute state.
- Object `SFX`: `ensure()`, `play(name)`, `toggleMute()`, `setMuted(muted)`; fields `ctx`, `master`, `muted`
- Functions: `loadMuted()`, `saveMuted(muted)`
- Constant: `MUTE_KEY`

### `js/sfx_sounds.js`
Web Audio sound recipes — oscillators and filtered white-noise bursts shaped by gain envelopes — for tower fire sounds and game events, all generated at play time (no audio files).
- Functions: `tone(ctx, out, when, opts)`, `noise(ctx, out, when, opts)`, `sfxPew`, `sfxBoom`, `sfxCrack`, `sfxZip`, `sfxWhoosh`, `sfxSizzle`, `sfxPop`, `sfxThud`, `sfxHorn`, `sfxFanfare`, `sfxSting` (all `(ctx, out, when)`)
- Constants: `SOUNDS` (name → recipe), `FIRE_SOUND` (tower key → sound name)

### `js/assets.js`
file://-safe tower sprite loading via `new Image()` with relative paths; the renderer falls back to procedural circles when a sprite is missing.
- Object `TowerAssets`: `init()`, `get(type)`; fields `images`, `loaded`

### `js/utils.js`
Small shared math/vector helpers: clamping, lerp, distance, move-toward, grid↔pixel conversion, money formatting, and Phase-31 `hexA(hex, alpha)` (`'#rrggbb'` + 0..1 alpha → `rgba(...)` string for fading effect colors).
- Functions: `clamp(v, lo, hi)`, `lerp(a, b, t)`, `dist(x1, y1, x2, y2)`, `moveToward(px, py, tx, ty, step)`, `cellOf(x, y, cell)`, `cellCenter(cx, cy, cell)`, `formatMoney(n)`, `hexA(hex, a)`

## Rendering & UI

### `js/render.js`
All canvas drawing: checkerboard grid, path, towers (sprite or procedural fallback with level pips), enemies (HP bars, burn flames, hover tooltips; Phase-28: phased/untargetable wisps render as an unfilled ring instead of a filled disc; Phase-30: poisoned enemies tint green `#9fff8f`, mirroring the Frost slow's blue `#9fd8ff` — poison wins when both are active), projectiles (incl. Phase-27 lobbed MortarShell — ground shadow + arcing ball with colored rim), railgun slugs, placement/range previews, and effects — fading Tesla chain-lightning polylines AND Phase-31 mortar explosion splashes (expanding ring + soft flash, `hexA`-faded, ammo-colored; `drawEffects`), the gold Warden aura ring on a selected Warden, and Phase-27 Mortar aim UI: gold crosshair at each targeted mortar's `targetPoint`, green blast circle / red X preview while aiming, and range circles drawn at the target point instead of the tower.
- Class `Renderer`: `constructor(canvas)`, `draw(game, view)`, `hoverPixel(view)`, `drawGrid(ctx)`, `drawPath(ctx, path)`, `drawTower(ctx, t, selected)`, `drawEnemy(ctx, e, hoverPx)`, `drawFlames(ctx, e)`, `drawProjectile(ctx, p)`, `drawShots(ctx, shots)`, `drawEffects(ctx, game)`, `drawRange(ctx, x, y, range)`, `drawPlacementPreview(ctx, game, view)`

### `js/ui.js`
DOM UI layer: HUD values (money/lives/wave/score), enemy legend (13 rows in fixed order — resist text from each def's `resist` list or the 2-word `desc` blurb; inactive types dimmed via `syncEnemyLegend()`), tower shop with lock states, selected-tower panel (targeting mode, upgrade, sell), control buttons, and the level dropdown (difficulty labels; external levels always open). Phase-21: paused-start message. Phase-26: the Warden shop card shows the live next price via `wardenCost()` (`def.dynamicCost`), and the tower panel renders aura/income stat lines (`+25% dmg · rng N`, `+$N / 8s`) instead of damage/rate. Phase-27: the Mortar panel replaces the target-mode select with an Ammo dropdown (options from `def.ammoTypes`) plus a "Set/Change Target" button that re-enters aim mode. Phase 29: shop lock state uses `isTowerAllowedOnLevel` — towers outside the level's `towers` roster lock with a distinct `🔒 <name> — not on this level` label (unlocked-but-restricted) vs `— Lv N` (not yet unlocked).
- Class `UI`: `constructor(game, view, handlers, progress)`, `buildEnemyLegend()`, `syncEnemyLegend()`, `buildLevelSelect()`, `syncLevelSelect()`, `refreshLevelSelect()`, `buildShop()`, `bindMuteButton()`, `bindButtons()`, `setPaused(paused)`, `updateHUD()`, `set(field, value)`, `syncShopSelection()`, `renderTowerPanel(tower)`, `setMessage(text)`
- Constant: `DEFAULT_MSG`

### `js/input.js`
Mouse/keyboard input handling: hover-cell tracking, tower placement, tower selection, and cancel via right-click or Esc (Space toggles pause). Phase-27: Mortar aim mode — a click while `view.aimingMortar` is set validates the cell against `isPathCell` and stores `cellCenter` as the tower's `targetPoint`; placing a Mortar auto-enters aim mode; `cancel()` clears aim state first.
- Class `Input`: `constructor(canvas, game, view, ui)`, `cellFromEvent(e)`, `onMove(e)`, `onDown(e)`, `cancel()`

### `js/tutorial.js`
First-time 3-step tutorial overlay that auto-advances as the player performs each action, is dismissable, and persists its "seen" flag in localStorage. Phase-21: step 3 instructs the player to press ▶ Resume (levels start paused).
- Class `Tutorial`: `constructor()`, `build()`, `advance()`, `dismiss()`, `update(view, game)`
- Functions: `tutorialDone()`, `markTutorialDone()`, `waveCleared(game)`
- Constants: `TUTORIAL_KEY`, `TUTORIAL_STEPS`

## Entry point

### `index.html`
The single-page shell: dark-themed layout with HUD bar (incl. a "🎲 Level Generator" link to levelgen.html), enemy legend (incl. `.legend-item.inactive` dimming for types not active on the current map), 1400×900 game canvas, shop/tower side panel, and all classic scripts loaded in dependency order so the game runs directly from `file://`. Phase-21: the pause button boots as `▶ Resume` and the initial `#msg` tells the player to build then press ▶ Resume.
- No functions — static HTML + inline CSS; loads the 27 `js/*.js` scripts (incl. `level_custom.js` after `levels_external.js`, `levelgen_waves.js` before `wave.js`, and Phase-26/27's `tower_tesla.js`/`tower_warden.js`/`tower_mortar.js` after `tower.js`).

## Tools & level data

### `tools/build_levels.mjs`
Build tool that reads every `levels/*.json`, validates it with the game's own validator inside a `vm` realm, and atomically generates the data-only `js/levels_external.js` (registration glue passes `difficulty` and `uuid` through). Entries are **sorted by difficulty (easy → normal → hard → nightmare) then alphabetically by name** before emission so players meet easier external levels first; the header also emits `var EXTERNAL_COUNT = N` (used by `progress.js` to keep all externals unlocked). Files missing a `uuid` get a fresh v4 uuid **written back to the .json** (only after the whole directory validates — a failing build never mutates files); two files sharing a uuid fail the build (shared-level dedupe).
- Functions: `validateText(text)`; top-level flow: collect/sort `.json` files → validate all (1 MB cap, duplicate-uuid check, duplicate-name check) → persist auto-added uuids → emit script or exit 1 without writing.

### `tools/build_levels.bat`
Windows double-clickable wrapper that checks for Node.js on PATH and runs `node tools/build_levels.mjs` from the project root.

### `levels/riverbend.json`
Example external level ("Riverbend"): a 9-waypoint path with 6 explicit per-wave enemy lists and `"difficulty": "normal"`, used as the reference for the level-file schema (kept under its bare name).

### `levels/README.md`
Documentation for adding/sharing external levels: the pure-data security model, the build workflow (`.bat` or `node tools/build_levels.mjs`), play order (easier difficulty first, then alphabetical — all externals unlocked), and the full JSON schema (incl. the `difficulty` field; waypoints are spline control points — any segment shape allowed, corners round; angled crossovers allowed, U-turns/double-backs rejected).

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

### `tests/smoke_enemy_unlock.mjs`
Per-level enemy availability: Minion on L1, +Tanked L2, +Singed L3, +Soused L4, +Skitterer L5, +Prowler L6, +Fission/Spore/Bolt/Bulwark/Mender/Wisp L7 (all Phase-19 types gate at level 7), plus a section asserting Spore (`childOnly`) never appears in any procedural wave list for levels 6–11.

### `tests/smoke_flame.mjs`
Flame tower: burn DoT kills and fire spreads from a burning enemy to enemies in contact (even out of tower range).

### `tests/smoke_levels.mjs`
Loads all classic scripts browser-like, validates every level's path, and simulates wave 1 on a couple of levels.

### `tests/smoke_levelgen.mjs`
Level generator coverage: all path candidates validate over 60 seeds (template pool asserted, spline bow away from the waypoint polyline required), spline walking checks (straight stays straight, corners round, perpendicular crossover allowed, U-turn double-walk rejected), wave lists respect options (counts/keys/boss cadence driven by the difficulty row's `bossEvery`), custom-level store save/register/dedupe, and save-flow filename/def helpers.

### `tests/smoke_levelselect.mjs`
The level dropdown always matches the map the game actually runs.

### `tests/smoke_lgenemies.mjs`
Generator enemy checkboxes: box count = selectable types (Spore excluded), Minion+Colossus defaults, Select All / Clear toggle verified through `lgReadOptions`, single manual pick survives, other form fields intact.

### `tests/smoke_mend.mjs`
Mender heal aura: heals living allies within 90px at 8 hp/s, caps at maxHp, never self-heals, leaves enemies outside the radius untouched, a dead Mender's aura is inert, and multiple allies are all healed.

### `tests/smoke_money.mjs`
Per-level starting money, win carry-over (added to next level's default), and stacking retry bonus (+$50/attempt).

### `tests/smoke_mortar.mjs`
Phase-27 Mortar suite (7 checks): config shape ($400 max cost, L7, blast 100, slowest fireRate 0.25/s, ammo list); unlock gate; firing rule (no targetPoint → never fires; with one → fires at the stored point even with zero enemies, no double-fire on cooldown, refires after 4s); blast falloff `[26, 20.8, 15.6, 0]` at 0/50/100/150px (real `MortarShell` flight); per-ammo payloads — flame burn on all in-blast, frost slow, venom poison stacks, Tesla damage incl. a phased Wisp + chain segments between in-blast enemies only (none for a solo blast), cannon pure damage; per-flavor resistance via the ammo key as `sourceType` (Soused vs flame at 28%); level scaling (L3 = ×2.5 dmg, ×1.25 blast) and Warden aura ×1.25 on the payload; retarget moves the impact point.

### `tests/smoke_new_towers.mjs`
Phase-26 new-tower suite (7 checks): config shape + all five at L7 + `wardenPlacementCost` curve; Tesla chain falloff `[18, 14.4, 11.52]` incl. a phased Wisp as hop 1 + 3 effect segments; Venom 6 hits → 5-stack cap at 30 dps/s; Reaper ×2.5 below the 30% HP threshold vs plain above; Mint +$10 (L1) / +$25 (L3) with `stats.moneyEarned` staying 0 (deterministic forced ticks); Warden multiplier unit checks (two=1.5625, one=1.25, self=1, none=1); Warden e2e — a Gun inside the aura deals exactly 12 × 1.25 = 15 per hit (damage measured as `maxHp − hp`).

### `tests/gen_tower_sprites.py`
Pure-stdlib PNG writer that generated the Phase-26/27 tower sprites (`assets/{tesla,venom,reaper,mint,warden,mortar}.png`, 128×128 RGBA) in the style of the existing six.

### `tests/smoke_paused_start.mjs`
Phase-21 paused start: boots the REAL `main.js` (full index.html script list) in a DOM stub with a spec-accurate `<select>` and Proxy 2D context, then asserts every level entry starts paused — boot, pause-button round-trip, Space key, dropdown switch (`loadLevel`), retry (`restart(true)`), and win auto-advance (unpaused frame loop counts the victory timer down; the next level lands paused with `▶ Resume`).

### `tests/smoke_phase.mjs`
Wisp phasing: `targetable` flips at the 2.5s solid / 3.7s cycle boundaries, the phase timer freezes while slowed (Frost pauses the cycle), `Tower.acquireTarget` skips a phased wisp but picks a solid one, non-phasing enemies are always targetable, and Phase-28 adds a render check — a phased wisp draws no body fill (unfilled ring) while a solid one fills its disc.

### `tests/smoke_progress.mjs`
Level progression: fresh levels pause until the first tower, winning unlocks + persists the next level, locked levels can't be loaded; Phase-23 adds the external-unlock floor (fresh `unlocked === LEVELS.length`, and with `EXTERNAL_COUNT` set, fresh/stale saves lift to built-ins + externals).

### `tests/smoke_railgun.mjs`
Railgun: config values, level-6 unlock gate, 1/2ⁿ pierce falloff, pierce cap, per-enemy resistance, and the straight-slug flight. Enemy HP expectations are computed from `ENEMY_TYPES.tank.hp × LG_DIFFICULTY[hard].hpMul` (map level 6 is 'hard').

### `tests/smoke_regen.mjs`
Bulwark flat regen (6 hp/s): exact per-second restore, cap at maxHp, a sustained flame burn (10 dps re-applied) still kills it, and a weak burn (4 dps) is outpaced so hp holds at the maxHp − burnDps·dt floor.

### `tests/smoke_registry.mjs`
Level registry: built-ins seed unchanged (no `towers` roster); `registerLevel` normalizes good defs and rejects bad ones. Phase 29: a `towers` roster is kept through normalization, and malformed rosters (non-array, empty, non-string entry, unknown key) are all rejected.

### `tests/smoke_resist.mjs`
Per-level enemy resistance: 4% on level 1, +4% per map level, capped at 80%.

### `tests/smoke_score.mjs`
Score math (kills×10 + lives×50 + moneyEarned×1), per-level persistence, corrupt-data normalization, and record-only-on-beat.

### `tests/smoke_split.mjs`
Fission death splits into exactly 2 Spore children at the parent's path position, children inherit the game's wave/level for HP scaling, spore children survive the same-frame alive-filter in `Game.update`, and non-splitting types die without spawning anything.

### `tests/smoke_sfx.mjs`
SFX engine with a stub AudioContext: `play()` routes through recipes, mute suppresses + persists, headless stays silent.

### `tests/smoke_targeting.mjs`
Each targeting mode (first/last/closest/strongest) picks the correct enemy from a fixed set in range.

### `tests/smoke_tower_unlock.mjs`
Tower availability is gated by map level. Phase-26: the availability table expects all 11 towers at index 6 (level 7), the level-7 placement test places all 11, and a Warden dynamic-cost check asserts $300 first / $400 second. Phase-27: the roster is 12 (Mortar added) — availability table and placement count updated to 12.

### `tests/smoke_tutorial.mjs`
Tutorial flag persistence plus step auto-advance/dismiss.

### `tests/smoke_ui.mjs`
The selected tower's upgrade button re-enables when money rises and disables when it falls; the target-mode dropdown survives deselect/reselect; the pause button reflects state and is wired to `onPause`; the enemy legend renders all 13 rows in the fixed design order with correct swatches, names, and resistance text (Phase-19 types included); and Phase-24 checks the 2-word `desc` blurb under resist-less names plus `syncEnemyLegend()` grey-out (L1: 11 rows dimmed, Minion+Colossus lit; L7: all lit; external explicit-wave level greys everything absent from its own wave lists — Minion/Fission/Spore stay lit).

### `tests/smoke_venom_visual.mjs`
Phase-30 venom tint: a plain enemy keeps its def color, a poisoned enemy's body disc fills green `#9fff8f`, poison wins over the Frost slow's blue when both are active, the tint clears once `poisonTimer` expires, and a poisoned PHASED wisp still renders as an unfilled ring (no body fill).

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
Active continuation (part 3) of the main implementation plan: Phase 25 (five new towers — DONE, all steps checked) plus unstarted follow-ups.

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
