# Tower Defense Game — Plan

## Goal
A browser-based tower defense game (HTML5 canvas, classic JS scripts sharing global scope, no build step, no dependencies).
Play by opening `index.html` in a browser — works directly from `file://`.

## Hard rules
- Every file ≤ 300 lines.
- No single "kitchen sink" module: each concern lives in its own file.
- Save progress to disk after every file; PLAN.md updated as items complete.

## Architecture (file map)
| File | Responsibility | Est. lines |
|---|---|---|
| `index.html` | Shell: canvas + HUD DOM, loads modules | ~40 |
| `js/config.js` | Grid size, waypoints, tower/enemy/wave definitions | ~130 |
| `js/progress.js` | Persistent level-unlock progression (localStorage + fallback) | ~35 |
| `js/utils.js` | Math/vector helpers, clamp, lerp, distance | ~50 |
| `js/path.js` | Waypoints → pixel path, set of path cells | ~70 |
| `js/enemy.js` | Enemy entity: movement along path, HP, slow, death | ~130 |
| `js/tower.js` | Tower entity: targeting, cooldown, upgrade/sell stats | ~150 |
| `js/projectile.js` | Projectile: homing flight, impact (damage/splash/slow) | ~90 |
| `js/wave.js` | Wave scheduler: spawn queue, composition per wave | ~80 |
| `js/game.js` | Game state (menu/playing/won/lost), money/lives, update orchestration | ~160 |
| `js/render.js` | All canvas drawing: grid, path, entities, preview | ~220 |
| `js/ui.js` | DOM HUD: money/lives/wave, shop, tower panel, buttons | ~150 |
| `js/input.js` | Mouse handling: hover, place/sell/upgrade clicks | ~110 |
| `js/main.js` | Boot, fixed-timestep game loop wiring everything | ~60 |

## Gameplay design
- Grid 28×18, 50px cells (1400×900 canvas). 5 levels with distinct left-to-right paths
  (see Phase 2); level 1 is the classic snake shape.
- Towers placed on non-path cells only. Sell refunds 70% of total invested.
- Tower types:
  - **Gun** — cheap, fast single-target.
  - **Cannon** — slow, splash damage.
  - **Frost** — low damage, slows target.
  - **Sniper** — long range, high damage, slow rate.
  - **Flame** — low hit damage + burn DoT; fire spreads to enemies in contact.
- Upgrades: 3 levels each; cost and stats scale per level.
- Enemies: normal, fast, tank, boss (every 5th wave). HP scales with wave number.
- Waves: 20 total. Auto-start after short delay; "Send Next Wave" button grants bonus money for early send.
- Lives: 20; leaked enemy costs lives (boss = 5). 0 lives = game over. Clear wave 20 = victory.

## Progress log
- [x] PLAN.md created
- [x] index.html (47 lines)
- [x] js/config.js (58 lines)
- [x] js/utils.js (36 lines)
- [x] js/path.js (61 lines)
- [x] js/enemy.js (64 lines)
- [x] js/tower.js (68 lines)
- [x] js/projectile.js (74 lines)
- [x] js/wave.js (86 lines)
- [x] js/game.js (126 lines)
- [x] js/render.js (129 lines)
- [x] js/ui.js (111 lines)
- [x] js/input.js (60 lines)
- [x] js/main.js (106 lines)
- [x] Syntax check: all 12 JS modules pass `node --check`
- [x] Headless simulation: placement/upgrade/sell rules, wave spawning, kill/leak economy verified
- [x] Balance tuning: fixed missing damage fields on projectile impact (NaN HP bug);
      full 20-wave scripted run reaches wave 20 and loses late-game (hard but winnable)
- [x] Message system: transient in-game messages with expiry; win/lose banners persist
- [x] Phase 2: 1400×900 maps (28×18 grid @ 50px), 5 hand-crafted levels in js/levels.js,
      level selector in HUD, loadLevel() switching, headless validation of all levels
- [x] Flame tower: burn DoT on direct hit (dps/duration scale with level), fire spreads
      from burning enemies to any living enemy within FLAME_SPREAD_RADIUS (26px);
      flame visuals on burning enemies; `smoke_flame.mjs` verifies DoT kill, spread, and no-spread
- [x] Fix: selected tower's Upgrade button now re-syncs with current money every frame
      (`ui.updateHUD`), and the panel re-renders after a successful upgrade
      (`smoke_ui.mjs` verifies enable/disable transitions and max-level/deselect cleanup)
- [x] Per-tower targeting modes (First/Last/Closest/Strongest): `TARGET_MODES` in config,
      `tower.targetMode` + score-based `acquireTarget()`, mode selector in the tower panel;
      `smoke_targeting.mjs` verifies each mode picks the right enemy from a mixed set.
      (Fix: dropdown value was assigned before its option existed — a no-op on real
      `<select>`s — so it always showed "First"; now set after options are appended,
      verified by `smoke_ui.mjs` with a spec-accurate select stub.)
- [x] Tower unlock progression (Phase 6): Gun lvl1, +Frost lvl2, +Flame lvl3,
      +Cannon lvl4, +Sniper lvl5 (map levels); locked towers disabled in the shop
      with a 🔒 label; `smoke_tower_unlock.mjs` verifies table, placement gate, and
      shop re-sync. All 9 smoke tests pass.
- [x] Level progression: levels start **paused** (building phase) until the first tower is
      placed, then wave 1 starts immediately. Beating a level unlocks the next one (persisted
      via localStorage in `js/progress.js`, in-memory fallback) and auto-advances after
      `WIN_ADVANCE_DELAY` (3.5s) with the victory banner showing. Locked levels show 🔒 in the
      selector and can't be loaded; beating the last level sets `beatenAll`.
      `smoke_progress.mjs` verifies pause-until-first-tower, persistence/clamping, win + advance timer
- [x] Level dropdown drift fix: `UI` constructor now calls `syncLevelSelect()` after
      `buildLevelSelect()`, and `refreshLevelSelect()` (win-time rebuild) re-syncs too, so the
      selector always points at `game.levelIndex`. `smoke_levelselect.mjs` (147 lines) verifies
      with a spec-accurate `<select>` stub (setting `.value` to a value with no matching option
      is a no-op): S1 boot with saved progress (unlocked=4) shows "3" not "0"; S2 dropdown
      follows `loadLevel()` for indices 0/1/2; S3 win + `refreshLevelSelect()` re-syncs a
      deliberately stale "0" back to "2", newly unlocked option exists and is enabled, then
      auto-advance to level 3 shows "3"; S4 change-handler wiring passes the right index and
      switches the game. Test proven to catch the pre-fix code (S1 fails with dropdown "").
      All other smoke tests still pass.

## Phase 1 

## How to run
Double-click `index.html` (works from `file://` — scripts are classic, loaded in dependency order).
Optionally serve it: `python3 -m http.server 8080` → http://localhost:8080

## Revision notes
- r1: ES modules (`type="module"`) — Chrome blocks these on `file://`, causing a blank canvas.
- r2 (current): converted to classic scripts sharing global scope; renamed `nextId` in
  tower.js → `towerNextId` to avoid a global collision with enemy.js. Verified by running
  all 11 library scripts + a wave-1 simulation in one shared JS context.

## Known issues / next steps
- [ ] Browser smoke test (open `index.html`, verify rendering, input, HUD) — needs a browser
- [ ] Balance pass: late waves (15+) are punishing; consider +reward scaling or slower HP curve
- [x] Optional: pause button (see below)
- [ ] Optional: sound effects, wave preview list

## Pause button
- [x] `index.html`: `⏸ Pause` button in the HUD (next to Speed)
- [x] `js/main.js`: `paused` flag + `setPaused()`; while paused the fixed-timestep sim
      and the win auto-advance timer are frozen, but rendering/HUD keep running
- [x] `js/ui.js`: `setPaused()` swaps button text ⏸ Pause ↔ ▶ Resume; click bound to
      `handlers.onPause`
- [x] `js/input.js`: Space toggles pause (ignored while typing in a form control)
- [x] `smoke_ui.mjs`: verifies button text swap and click→onPause wiring

## Enemy renames + hover tooltip
- [x] `js/config.js`: each `ENEMY_TYPES` entry gains a display `name`:
      Minion, Skitterer, Tanked, Soused, Singed, Prowler, Colossus (keys unchanged)
- [x] `js/render.js`: hovering an enemy shows a tooltip with its name and the tower
      types it resists (e.g. "Tanked / resists Gun"); drawn above the HP bar
- [x] `smoke_resist.mjs` check 8: verifies all seven display names

## Enemy legend (left panel)
- [x] `index.html`: `<div id="legend">` added inside `#wrap`, left of the canvas;
      reuses existing `.legend-item`/`.swatch` styles (190px column)
- [x] `js/ui.js`: `buildEnemyLegend()` — one row per enemy in the intentional order
      Minion, Tanked, Singed, Soused, Skitterer, Prowler, Colossus; each row shows a
      color swatch + name, plus resistance text ("resists Gun", …, "resists all towers"
      for Colossus). No tooltip needed — all seven colors are unique.
- [x] `smoke_ui.mjs`: legend check verifies 7 rows, exact order, swatch colors match
      `ENEMY_TYPES`, and the resistance text per row (incl. "resists all towers")

## Phase 2: Multi-level support + bigger maps (1400×900)

### Requirements
- Every map is **1400×900 px**. Grid becomes 28×18 with 50px cells (exact fit).
- Five levels; each level is a distinct hand-crafted map (different path layout).
  (Generator idea dropped per user request — levels are plain data in `js/levels.js`,
  easy to add more by appending an entry.)

### Rules for a "working" level (checked headlessly)
1. Path enters off-screen left (`x = -1`) and exits off-screen right (`x = cols`).
2. Segments are axis-aligned; waypoints only at turns; all turn points inside the grid.
3. No self-intersection: no grid cell is visited twice (shared segment corners OK).
4. Path length ≥ 14 cells.
5. Buildable area: non-path visible cells ≥ 40% of the grid.

### Implementation steps
- [x] PLAN.md updated with Phase 2 (this section)
- [x] `js/config.js`: GRID → 28×18 @ 50px; CANVAS 1400×900; level-1 waypoints rescaled
- [x] `js/path.js`: `buildPath(waypoints)` takes a param; added `walkPathCells()` +
      `hasSelfIntersection()` helpers
- [x] New `js/levels.js`: LEVELS list (5 hand-crafted maps) + `levelWaypoints(i)`
- [x] `index.html`: canvas 1400×900 + level `<select>` in HUD + loads levels.js
- [x] `js/main.js`: `loadLevel(i)` — rebuild path for level, reset game/view/UI
- [x] `js/ui.js`: wire level `<select>` (one option per level)
- [x] Headless test (`smoke_levels.mjs`): all 5 levels pass validation; wave-1 sim on
      levels 1 and 5 completes with no leaks
- [x] Update PLAN.md progress log

### Notes
- Level switching reuses the existing `Game` instance: swap `game.path`, then `reset()`.
  All systems (enemy movement, tower range checks, placement rules) read `game.path`,
  so no per-system changes are needed.
- Adding a level = append `{ name, waypoints }` to LEVELS in `js/levels.js`; the HUD
  select and everything else pick it up automatically.

## Phase 3: Enemy resistances

### Requirements
Different enemies take reduced damage/effect (not immunity) from specific towers:
- **Tank** resists **Gun**
- **Fast** resists **Cannon**
- **Wet** resists **Flame** (new enemy type)
- **Hot** resists **Frost** (new enemy type)
- **Camo** resists **Sniper** (new enemy type)
- **Boss** resists all five (Gun, Cannon, Flame, Frost, Sniper)

### Design
- ~~`RESISTANCE = 0.5` — a resistant enemy takes 50% of the damage/effect from its listed tower types.~~
  Superseded by Phase 5: resistance now scales per map level (4% base, +4%/level, cap 80%).
- `ENEMY_TYPES`: new `wet`, `hot`, `camo` entries; each definition gets a `resist: [towerKey]`
  array; `boss` lists all five tower keys.
- Damage path: projectile specs carry `sourceType`; `Enemy.takeDamage(amount, sourceType)`
  scales by `damageMultiplier(sourceType)`. Burn DoT keeps applying unresisted (already scaled
  at ignition time).
- Effect paths: `applySlow()` scales slow duration; `applyBurn(dps, duration)` scales both —
  so fire spread into a wet enemy is resisted, and a wet enemy's own flames carry the reduced dps.
- Waves: wet/hot join from wave 3, camo from wave 4 (mixed into the normal composition).

### Implementation steps
- [x] PLAN.md updated with Phase 3
- [x] js/config.js: `RESISTANCE`, new enemy types + `resist` fields on tank/fast/boss
- [x] js/enemy.js: `damageMultiplier()`, source-aware `takeDamage`, resisted slow/burn
- [x] js/tower.js: projectile spec carries `sourceType`
- [x] js/projectile.js: impact applies damage with source type
- [x] js/wave.js: wet/hot/camo in wave composition
- [x] `smoke_resist.mjs`: headless checks (per-type resistance, boss all-five, wave composition)
- [x] PLAN.md progress log updated

### Progress log
- [x] Enemy resistances (Phase 3): `RESISTANCE = 0.5`; tank↔Gun, fast↔Cannon, wet↔Flame,
      hot↔Frost, camo↔Sniper, boss↔all five. Damage path carries `sourceType` (tower key)
      through spec → impact → `takeDamage`. Burn dps+duration and slow duration are also
      scaled by the enemy's resistance, so a wet enemy's own flames carry reduced dps and
      fire spread into it is resisted. New wet/hot/camo types join from wave 3/4.
      `smoke_resist.mjs` verifies per-type scaling, boss all-five, burn/slow reduction, and
      wave composition; existing smoke tests (flame, targeting, levels) still pass.

## Phase 4: 90° path crossovers + "Crossroads" level

### Requirements
- Paths may cross themselves at 90° angles (perpendicular crossovers). Same-direction
  overlap, opposite-direction U-turns, and cells walked 3+ times (loops) are still invalid.
- Add one new level containing exactly 2 crossovers.

### Implementation steps
- [x] PLAN.md updated with Phase 4
- [x] js/path.js: `hasSelfIntersection()` now records every pass (direction) per cell;
      flags a cell only if it is walked 3+ times or twice in non-perpendicular directions
- [x] js/levels.js: new level 6 "Crossroads" — crossovers at (4,4) and (20,6), len 84
- [x] smoke_levels.mjs: `countCrossovers()` helper; asserts Crossroads has exactly 2
      crossovers and all levels still validate; wave-1 sim on the new level (no leaks)
- [x] PLAN.md progress log updated

### Progress log
- [x] Crossover support: `hasSelfIntersection()` rewritten to track per-cell visit
      directions; perpendicular 90° crossings allowed, collinear/U-turn/loop overlaps still
      rejected. New "Crossroads" level (index 5) with exactly 2 crossovers added to LEVELS;
      HUD level selector picks it up automatically. `smoke_levels.mjs` verifies all 6 levels
      and the crossover count; all other smoke tests still pass.

## Phase 6: Tower unlock progression (per map level)

### Requirements
Tower availability is gated by the **map level** being played (1-based):
- Level 1: Gun only
- Level 2: + Frost
- Level 3: + Flame
- Level 4: + Cannon
- Level 5: + Sniper
- Level 6+: all five

### Design
- `TOWER_TYPES` entries gain `unlockLevel` (1-based map level).
- `isTowerAvailable(type, levelIndex)` in config.js — single source of truth.
- `Game.placeTower()` rejects unavailable types (defense in depth; the UI also
  disables them, so this only fires for stale placement state).
- Shop: locked towers render as `🔒 Name — Lv N` and are disabled; `syncShopSelection`
  re-checks availability every frame alongside affordability.
- `onPickType` ignores locked types; `loadLevel` clears any active `placingType`
  (a tower unlocked on the new map may differ, and a stale selection would be
  confusing).

### Implementation steps
- [x] PLAN.md updated with Phase 6 (this section)
- [x] js/config.js: `unlockLevel` per tower + `isTowerAvailable()`
- [x] js/game.js: `placeTower()` availability gate
- [x] js/ui.js: locked shop buttons + `syncShopSelection` update
- [x] js/main.js: `onPickType` guard, `loadLevel` clears `placingType`
- [x] `smoke_tower_unlock.mjs`: per-level availability table, shop lock state,
      placement gate; all existing smoke tests still pass
- [x] PLAN.md progress log updated

### Progress log
- [x] Tower unlock progression (Phase 6): each `TOWER_TYPES` entry carries
      `unlockLevel` (1-based map level: Gun 1, Frost 2, Flame 3, Cannon 4,
      Sniper 5); `isTowerAvailable(type, levelIndex)` is the single source of
      truth. `Game.placeTower()` rejects locked types; the shop disables them
      with a `🔒 Name — Lv N` label (restored on unlock) and re-syncs every
      frame; `onPickType` ignores locked types with an explanatory message;
      `loadLevel` clears any active `placingType`. `smoke_tower_unlock.mjs`
      (175 lines) verifies the full availability table (incl. level 6+ = all
      five), placement gating, and shop lock/label re-sync across levels.
      Existing tests adjusted for the gate: `smoke_flame.mjs` runs on map
      level 3 (Flame's unlock level); `smoke3.mjs` rewritten to the current
      vm-bundle style (it predated levels.js and was already broken by the
      r2 classic-script conversion). All 9 smoke tests pass.

## Phase 5: Per-level resistance scaling

### Requirements
Enemies that have resistances start at **4% resistance on level 1** and gain the same
amount each map level, capped at **80%** (the cap matters only if many more levels are
added later). Level = the map level being played (1-based), not tower level or wave.

### Design
- `RESISTANCE_PER_LEVEL = 0.04`, `RESISTANCE_CAP = 0.8` in config.
- `resistanceFactor(levelIndex)`: clamp(0.04 × (levelIndex+1), 0, 0.8) — 4%, 8%, …, 80%.
- `Enemy` stores `levelIndex` (passed from `Game`, which already tracks it);
  `damageMultiplier()` returns `1 - resistanceFactor(levelIndex)` when the source is
  resisted. Burn dps/duration and slow duration scale through the same multiplier.

### Implementation steps
- [x] PLAN.md updated with Phase 5
- [x] js/config.js: `RESISTANCE_PER_LEVEL`, `RESISTANCE_CAP`, `resistanceFactor()`
- [x] js/enemy.js: store levelIndex; `damageMultiplier()` uses per-level factor
- [x] js/game.js: pass `this.levelIndex` to `new Enemy(...)`
- [x] smoke_resist.mjs: update expected values (4% at level 1) + level-scaling/cap checks
- [x] Run all smoke tests; PLAN.md progress log updated

### Progress log
- [x] Per-level resistance (Phase 5): `resistanceFactor(levelIndex) = clamp(0.04 ×
      (levelIndex+1), 0, 0.8)` — level 1 starts at 4%, +4% per map level, hard cap 80%
      no matter how many levels exist. Enemy stores `levelIndex` (passed by Game);
      damage, burn dps/duration, and slow duration all scale through it.
      `smoke_resist.mjs` (7 checks) verifies: factor table incl. cap at level 20+ and
      negative-index guard; takeDamage scaling across levels 1/2/5/10/51; boss all-five
      at level 5; wet burn dps+duration at level 3; hot slow at level 5; wave composition;
      end-to-end Game→Enemy levelIndex wiring (spawned tank on map 4 takes 88% Gun dmg).
      All other smoke tests (flame, levels, progress, targeting, ui) still pass.

## Phase 7: Per-level enemy availability (progression)

### Requirements
Enemy types unlock by map level (1-based): L1 Minion, L2 +Tanked, L3 +Singed,
L4 +Soused, L5 +Skitterer, L6 +Prowler. The Colossus boss keeps its every-5th-wave
role on every level; its escorts are filtered to types available on that level
(user-confirmed: keep boss on all levels).

### Implementation steps
- [x] PLAN.md updated with Phase 7 (this section)
- [x] `js/config.js`: `unlockLevel` added to every ENEMY_TYPES entry +
      `isEnemyAvailable(type, levelIndex)` helper (mirrors isTowerAvailable)
- [x] `js/wave.js`: `buildWave(wave, levelIndex)` — `push()` drops locked types;
      WaveManager takes `levelIndex` in its constructor and passes it to buildWave
- [x] `js/game.js`: `reset()` constructs `new WaveManager(this.levelIndex)`
- [x] New `smoke_enemy_unlock.mjs` (5 checks): unlockLevel table; isEnemyAvailable
      table incl. unknown-type guard; buildWave gating across all 6 levels x 20
      waves (no locked type ever spawns, no empty wave); level-1 boss wave is
      boss + Minions only; end-to-end Game→WaveManager level passing
- [x] `smoke_resist.mjs` check 6 updated for level-gated composition (L1 w3
      Minion-only; L2 w6 gains tank; L3 w3 gains hot; L4 w4 gains wet, no camo;
      L5 boss wave has fast escorts)
- [x] All smoke tests pass (enemy_unlock, resist, 3, levels, progress, targeting,
      flame, tower_unlock, levelselect, ui)

### Notes
- `buildWave(wave)` without a level defaults to level 1 — safe for any caller
  that doesn't know the map.
- Tower unlocks (Phase 6) and enemy unlocks are independent: e.g. Frost unlocks
  on L2 but its natural counter Singed only appears from L3.

## Phase 8: Tower sprite images

### Requirements
Towers render as PNG sprites from `assets/` instead of procedural circles.
User decision: no rotating barrels — the barrel-drawing code in `drawTower()`
is **commented out, not deleted** (may be reused later). `def.color` stays in
config for projectiles/UI.

### Assets (verified)
- 6 × 128×128 RGBA PNGs, non-interlaced, true alpha channel:
  `gun.png`, `cannon.png`, `frost.png`, `sniper.png`, `flame.png`, `railgun.png`.
- Transparency verified by pixel decode: all four corners + full outer border
  transparent (sniper has 7 stray opaque border px — ignorable), art centers
  fully opaque. No background keying needed.
- Mapping: gun→basic, cannon→cannon, frost→frost, sniper→sniper, flame→flame.
  **`railgun.png` has no matching tower type** (config has only 5 types) —
  flagged to user; not wired up unless a railgun tower is added.

### Implementation steps
- [x] PLAN.md updated with Phase 8 (this section)
- [x] New `js/assets.js`: preload sprites via `new Image()` + relative paths
      (file:// safe), keyed by tower type; exposes `TowerAssets.get(type)`
- [x] `js/config.js`: `img` field on each of the 5 TOWER_TYPES
- [x] `js/render.js` `drawTower()`: draw sprite centered in cell (~44px of the
      50px cell) when loaded; keep base plate, selection ring, level pips;
      **comment out** barrel block with reuse note; procedural fallback if
      image missing/failed so the game never breaks
- [x] `index.html`: load assets.js right after config.js
- [x] Headless smoke test (`smoke_assets.mjs`, 5 checks): img paths exist on
      disk, all 5 sprites load, sprite drawn via drawImage, procedural
      fallback on failed load, barrel code confirmed commented out
- [x] Full regression: all 12 smoke tests pass (assets, 3, enemy_unlock,
      flame, levels, levelselect, progress, resist, targeting, tower_unlock, ui)

### Notes
- `image-rendering: pixelated` is already on the canvas, so 128→44 downscale
  keeps a crisp look.
- Fallback path guarantees the game runs even if an image fails to load
  (e.g. missing file) — old procedural circle is drawn instead.

## Phase 9: Railgun tower (piercing beam)

### Requirements
A new **Railgun** tower, the most expensive in the game:
- Straight-line penetration: one shot pierces through **up to 5 enemies** in a line.
- **Same range as the Sniper** (260).
- As strong as the Sniper on the first enemy hit; **damage halves with each
  subsequent penetration** (1×, ½×, ¼×, ⅛×, 1/16×).
- **Unlocks on map level 6** (the "Crossroads" map) — the last tower to unlock.

### Design
- `TOWER_TYPES.railgun`: cost 400 (most expensive; Sniper is 160), range 260,
  damage 70 (= Sniper's base), fireRate 0.35 (slower than Sniper's 0.45 — the
  trade-off for hitting up to 5 targets per shot), `pierce: 5`,
  `unlockLevel: 6`, `img: 'assets/railgun.png'` (sprite already exists in assets).
- **Instant beam, not a homing projectile.** Piercing along a moving target's
  trajectory is ill-defined; the beam resolves at fire time against current
  enemy positions. New module `js/beam.js`:
  - `fireBeam(spec, enemies, game)` — ray from the tower through its target's
    position; hits every living enemy whose center is within a small radius
    (14px) of the ray, sorted by distance along the ray, capped at `pierce`.
    Damage to hit #n = `damage / 2^(n-1)`; each hit carries `sourceType`
    through `Enemy.takeDamage`, so resistances apply per enemy (Colossus
    resists it — its `resist` list gains `'railgun'`).
  - Returns `{x, y, x2, y2}` for the visual: a line from the tower to the last
    hit (or full range when nothing is hit).
- `Tower.update()`: pierce towers return a spec with `pierce` + `angle` instead
  of a projectile; `Game.update()` routes it through `fireBeam()` and pushes
  `{x, y, x2, y2, color, t: 0.15}` onto `game.beams`.
- Visual: `Renderer.drawBeams()` draws each beam as a glowing line with alpha
  fading over its ~0.15s lifetime; `game.update()` ages and culls beams.
- No wave changes (the tower only unlocks on level 6, where the full enemy
  roster already exists).

### Implementation steps
- [x] PLAN.md updated with Phase 9 (this section)
- [x] js/config.js: `railgun` entry + `boss.resist` gains `'railgun'`
- [x] New js/beam.js: `fireBeam()` ray-vs-enemy resolution with ½ falloff
- [x] js/tower.js: pierce towers emit a beam spec (no projectile)
- [x] js/game.js: `beams` list, beam application in the update loop
- [x] js/render.js: `drawBeams()` fading beam lines
- [x] index.html: load beam.js after projectile.js
- [x] New smoke_railgun.mjs: config values, level-6 unlock gate, falloff table,
      pierce cap, per-enemy resistance, beam visual lifecycle
- [x] Update smoke_tower_unlock.mjs (availability table now 6 towers),
      smoke_resist.mjs (boss resists all six), smoke_assets.mjs (comment)
- [x] Run node --check + all smoke tests; PLAN.md progress log updated

### Progress log
- Railgun implemented as an instant piercing beam. `TOWER_TYPES.railgun`
  (cost 400 — most expensive; range 260 = Sniper; damage 70 = Sniper;
  fireRate 0.35; pierce 5; unlockLevel 6). New `js/beam.js` resolves the ray
  at fire time: hits living enemies within 14px of the line, sorted by
  distance, capped at `pierce`, damage `damage / 2^(n-1)`, each hit routed
  through `Enemy.takeDamage` so resistances apply per enemy (boss resists it).
  `Tower.update()` returns a beam spec for pierce towers; `Game.update()`
  applies it via `fireBeam()` and stores the segment in `game.beams` with a
  0.15s fade (`Renderer.drawBeams()`); beams age out each frame.
- Tests: new `smoke_railgun.mjs` (config values, level-6 unlock gate, boss
  resistance, ½-falloff table + pierce cap + visual endpoint, end-to-end beam
  lifecycle). Updated `smoke_tower_unlock.mjs` (6-tower availability table,
  level-6 placement, shop labels), `smoke_resist.mjs` (boss resists all six),
  and added `js/beam.js` to every test bundle that loads `game.js`. All 11
  smoke tests pass; all modified js files pass `node --check`.

## Phase 10: Railgun projectile visual (thin fast slug, not a laser)

### Requirements
User feedback: the railgun currently looks like it fires a laser (a glowing
line spanning the whole range). It should instead look like it fires a **small,
thin, fast projectile** — a visible slug that travels down the line and hits
enemies as it passes.

### Design
- **Damage model unchanged**: same ray, same 14px hit radius, same ½ falloff,
  same pierce cap of 5, same per-enemy resistance routing. The only change is
  *when* damage lands: the slug flies at `projSpeed` and applies damage to each
  enemy as it crosses them (an enemy hit by the instant beam keeps taking the
  same total damage; a target that moves far off the line in the ~0.16s of
  flight can now dodge, which is acceptable — it reads as a real projectile).
- `TOWER_TYPES.railgun`: `projSpeed: 1600` (faster than Sniper's 900 — "fast");
  `desc` updated to "Piercing slug: …".
- `Tower.update()`: pierce specs now carry `targetId` + `speed` (aim direction
  is still derived from the target, but the shot flies straight — no homing).
- New `js/projectile.js` class `PiercingShot` (appended to the existing file,
  which stays under 300 lines):
  - Flies straight from the muzzle along its aim vector at `spec.speed`.
  - Keeps a per-enemy `hitIds` set; each frame, every living enemy within
    `PIERCING_HIT_RADIUS` (14px) of the current position that hasn't been hit
    yet takes `damage / 2^(hitsSoFar)` via `takeDamage(dmg, sourceType)` —
    resistance applies per enemy.
  - Dies when it has pierced `pierce` enemies or travelled `len` pixels.
- `Game.update()`: the `beams` list is replaced by a `shots` list of
  `PiercingShot`s, updated and culled alongside the normal projectiles.
- Visual: `Renderer.drawShots()` draws each slug as a short thin tracer line
  (2px wide, ~24px long, along the velocity) with a small bright head dot —
  reads as a fast dart, not a laser. No glow pass, no full-range line.
- `js/beam.js` is deleted (its ray logic is replaced by the moving slug);
  every test bundle and `index.html` drop the `js/beam.js` reference.

### Implementation steps
- [x] PLAN.md updated with Phase 10 (this section)
- [x] js/config.js: railgun `projSpeed: 1600`, new desc
- [x] js/tower.js: pierce spec emits projectile fields (targetId, speed)
- [x] js/projectile.js: new `PiercingShot` class (straight flight + multi-hit)
- [x] js/game.js: `shots` list replaces `beams`; update/cull loop
- [x] js/render.js: `drawShots()` tracer+dot; remove `drawBeams()`
- [x] Delete js/beam.js; index.html + all smoke bundles drop the reference
- [x] Update smoke_railgun.mjs: spec fields, slug flight, falloff while moving,
      pierce cap, e2e lifecycle
- [x] Run node --check + all smoke tests; PLAN.md progress log updated

### Progress log
- Railgun now fires a visible slug instead of an instant laser line.
  `TOWER_TYPES.railgun.projSpeed` = 1600 (faster than Sniper's 900).
  `Tower.update()` pierce specs carry `targetId` + `speed`; the shot flies
  straight along the aim direction captured at fire time (no homing). New
  `PiercingShot` class in `js/projectile.js`: advances `speed * dt` per frame,
  and each frame damages every living enemy within 14px of the segment just
  travelled (segment distance check — a fast slug can never skip an enemy),
  in order of distance along the ray, with the same `damage / 2^(n-1)` falloff
  and pierce cap as before; each hit routes through `Enemy.takeDamage` so
  per-enemy resistance still applies. The slug dies after `pierce` hits or
  `len` pixels of travel. `Game.update()` keeps a `shots` list (replacing
  `beams`) updated alongside the normal projectiles. `Renderer.drawShots()`
  draws each slug as a 2px tracer line (~24px back along the velocity) with a
  small white head dot — no glow, no full-range line. `js/beam.js` deleted;
  its reference removed from `index.html` and all 12 smoke bundles.
- Tests: `smoke_railgun.mjs` updated — config check now asserts
  `projSpeed === 1600`; test 4 steps a real `PiercingShot` through the six-tank
  line (dealt [70, 35, 17.5, 8.75, 4.375], 6th untouched, slug stops just past
  the 5th hit at ~213px); test 5 verifies the e2e lifecycle (`game.shots`
  populated during flight, tank killed by repeated slug hits, list clears).
  All 12 smoke tests pass; all js files pass `node --check`.

## Phase 11: Boot at level 1 + money carries over

### Requirements (user-reported)
1. A new game (opening the app) starts on **level 1**, not the highest unlocked level.
   Unlocked levels remain reachable via the level selector and post-win auto-advance.
2. Money earned carries over to the next level — switching levels (or retrying after a
   loss) must not reset money back to `START_MONEY`.

### Design
- `js/main.js`: boot uses `levelIndex = 0` unconditionally (saved progress only gates
  which maps the selector offers, never where the game starts).
- `js/game.js`: `reset()` no longer touches `money`; new `fullReset()` sets
  `money = START_MONEY` then calls `reset()`. The constructor uses `fullReset()`
  (fresh session), while `main.js restart()` — used by level switches and the
  Restart button — keeps calling `reset()`, so money survives within a session.
- Money is deliberately NOT persisted: a new browser session starts at level 1 with
  `START_MONEY` (progression store keeps only `unlocked`/`beatenAll`).

### Implementation steps
- [x] PLAN.md updated with Phase 10 (this section)
- [x] js/main.js: boot `levelIndex = 0`; comment on restart() documents carry-over
- [x] js/game.js: `reset()` money-free; new `fullReset()`; constructor uses it
- [x] smoke_levelselect.mjs: S1 now expects boot at level 1 (dropdown "0") with
      saved-progress lock count verified; S2 loadLevel mirrors restart() (reset())
- [x] New smoke_money.mjs (4 checks): fresh game = START_MONEY; reset() keeps money
      while restoring lives; fullReset() restores START_MONEY; level switch keeps
      money + WaveManager level; progress store contains no money field
- [x] All 13 smoke tests pass; all js files pass node --check

### Progress log
- [x] Boot-at-level-1 + money carry-over (Phase 10): opening the app always starts on
      level 1 regardless of saved unlocks; `Game.reset()` preserves money so level
      switches and retries keep earned funds, while `Game.fullReset()` (constructor
      only) restores `START_MONEY` for a fresh session. `smoke_levelselect.mjs` S1
      updated to the new boot expectation (and verifies lock gating still works);
      new `smoke_money.mjs` covers fresh/reset/fullReset/level-switch semantics and
      confirms money is never written to the progress store. All 13 smoke tests pass.

## Phase 12: Per-level starting money + carry-over + retry bonus

### Requirements (user-reported)
- Every level has its own **default starting money**. When a player **wins** a level,
  their unspent money carries over and is **added on top of** the next level's default
  (e.g. L1 default $260, win with $300 left → L2 starts at L2-default + $300).
- **Retrying a lost level** restores the amount the player first started that level
  with, **plus a $50 bonus per retry attempt** (the bonus stacks: 1st retry = start+$50,
  2nd = start+$100, …). A won level is never retried via this path — winning auto-advances.
- User decisions (confirmed): defaults escalate per level (I choose the numbers);
  manually switching to another unlocked level via the dropdown **resets money to that
  level's default** (abandons current money, not farmable by switching).

### Design
- `js/config.js`: `START_MONEY` replaced by `LEVEL_START_MONEY = [260, 300, 340, 380,
  420, 460]` (one default per level; clamped for unknown indices) + `levelStartMoney(i)`
  helper + `RETRY_BONUS = 50`.
- `js/game.js`: `fullReset()` replaced by `enterLevel(base)` — sets money to a given
  base, then resets the rest (towers, waves, lives, status). New `retry()` returns the
  retry target: `startMoney + RETRY_BONUS * retryCount` (no state change; main.js applies
  it via `enterLevel`). Constructor calls `enterLevel(levelStartMoney(levelIndex))`.
- `js/main.js`: `restart(retry)` — the Restart button (only shown after a loss) uses
  `retry()` and bumps `game.retryCount`; any other caller gets a fresh start
  (`enterLevel(default)`). `loadLevel(i, carryOver)` — `carryOver=true` only from the
  win auto-advance (money = target default + current unspent money); manual dropdown
  switches pass no flag → money resets to the target level's default.

### Implementation steps
- [x] PLAN.md updated with Phase 11 (this section)
- [x] js/config.js: LEVEL_START_MONEY table, levelStartMoney(), RETRY_BONUS
- [x] js/game.js: enterLevel(base), retry(); constructor uses enterLevel
- [x] js/main.js: restart(retry), loadLevel(i, carryOver), win-advance passes true
- [x] smoke_money.mjs rewritten for the new model (defaults table, carry-over math,
      stacking retry bonus, manual-switch reset, fresh boot)
- [x] smoke_levelselect.mjs: loadLevel replica updated to the new money semantics
- [x] node --check + all 12 smoke tests pass; progress log updated

### Progress log
- Per-level starting money (Phase 11): `LEVEL_START_MONEY = [260, 300, 340, 380, 420, 460]`
      replaces the single `START_MONEY`; `levelStartMoney(i)` clamps unknown indices.
      `Game.enterLevel(base)` sets money to an explicit base then resets state; the
      constructor enters level 1 with its default. `Game.retry()` returns
      `levelStartMoney(levelIndex) + RETRY_BONUS * retryCount` — the amount first
      started with plus $50 per consecutive loss (stacks: +$50, +$100, +$150, …).
      `main.js restart(true)` (Restart button, shown only after a loss) bumps
      `retryCount` and enters with the retry target; `loadLevel(i, carryOver)` is
      called with `carryOver=true` only by the win auto-advance — unspent money is
      captured, the level starts fresh at its default, then the carried amount is
      added on top. Manual dropdown switches pass no flag: money resets to that
      level's default (hoarded money abandoned, not farmable). `smoke_money.mjs`
      rewritten (defaults table + clamping, win carry-over incl. the user's
      $300-into-L2 example, chained carry-over, manual-switch reset, stacking retry
      bonus x3, retry-history reset on level change, no money in progress store);
      `smoke_levelselect.mjs` loadLevel replica updated to the new semantics.
      All 12 smoke tests pass; all js files pass node --check.
