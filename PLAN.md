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


Initial document containing Phases 1 - 12 has moved to PLAN1.md due to size.
This plan is a continuation.



## Phase 13: Uniform tower box widths in the right sidebar

### Requirements
User feedback: the left sidebar's enemy legend boxes are all the same width
(they are `<div>`s filling the column), but the right sidebar's tower shop
boxes and tower-panel buttons each size to their own content, so they come
out at different widths — looks unprofessional. Standardize the right-sidebar
tower box widths to match the uniform look of the left sidebar.

### Design
- Root cause: `.shop-item` and `.tower-btn` are `<button>` elements, which are
  `inline-block` by default, so each shrinks to fit its content instead of
  filling the 210px `#side` column.
- Fix in `index.html` CSS only (no JS change): scope a `display: block`
  override to the sidebar so every shop item and tower-panel button fills the
  full column width, exactly like the legend rows. Scoped to `#shop` /
  `#towerPanel` because `.tower-btn` is also used in the top HUD bar, where
  the buttons must stay inline.
- No changes to `js/ui.js`; headless smoke tests are unaffected (CSS only),
  but the full suite is re-run as a regression gate.

### Implementation steps
- [x] PLAN.md updated with Phase 11 (this section)
- [x] index.html: `#shop .shop-item, #towerPanel .tower-btn { display: block; }`
- [x] Run all smoke tests + node --check as regression gate (10/12 pass; the 2
      failures — smoke3.mjs and smoke_railgun.mjs — are pre-existing stale
      config assertions, e.g. railgun cost expected 400 vs current 300, and
      are unrelated to this CSS-only change; no smoke test reads index.html)

### Progress log
- Right-sidebar tower boxes now all fill the 210px column width (block-level
  buttons), matching the uniform left-sidebar legend boxes. HUD buttons keep
  their inline sizing because the rule is scoped to `#shop`/`#towerPanel`.

## Phase 14: Sound effects (Web Audio API, generated — no external files)

### Requirements
- Firing sounds per tower type: pew (Gun), boom (Cannon), crack (Sniper),
  zip (Railgun), whoosh (Frost), sizzle (Flame).
- Enemy death (pop), leak (thud), wave start (horn), victory fanfare,
  defeat sting.
- AudioContext + procedurally generated clips (oscillators + noise) — no
  external files, keeps the file:// constraint.
- Mute toggle in the HUD, persisted via localStorage.

### Design
- `js/sfx_sounds.js` — pure sound recipes: each is a function
  `(ctx, out, when) => ...` that schedules oscillators/noise/gain envelopes.
  Also exports `FIRE_SOUND` (tower key → sound name). No DOM, no AudioContext
  access at load time.
- `js/sfx.js` — the engine: lazy AudioContext (created on first user gesture
  to satisfy autoplay policy), `SFX.play(name)`, `SFX.toggleMute()`,
  mute persisted under `towerDefenseMuted.v1`. Headless-safe: if
  `AudioContext` is undefined (node smoke tests), `play` is a no-op.
- Wiring: firing in `game.js` tower loop; pop/thud in `onEnemyKilled` /
  `onEnemyLeaked`; horn where waves start (`startIfReady` + auto-start);
  fanfare/sting on status change in `main.js`; mute button in `index.html`
  HUD, bound in `ui.js`.
- All smoke bundles gain the two sfx files (they are headless-safe, no stubs
  needed); new `smoke_sfx.mjs` exercises the engine with a stub AudioContext.

### Implementation steps
- [x] PLAN.md updated with Phase 14
- [x] js/sfx_sounds.js — sound recipes + FIRE_SOUND map (node --check, 131 lines)
- [x] js/sfx.js — engine: lazy ctx, play, mute + persistence (node --check, 61 lines)
- [x] smoke_sfx.mjs — stub AudioContext, verify scheduling/mute/persistence (passing)
- [x] game.js wiring: fire/death/leak/horn; added sfx files to all smoke bundles (smoke3 needed a manual fix — its bundle line didn't match the sed pattern)
- [x] main.js victory/defeat sounds; index.html + ui.js mute button
- [x] Full regression run: 12/14 pass; the 2 failures (smoke3, smoke_railgun)
      are the same pre-existing stale assertions from Phase 13

### Progress log
- `js/sfx_sounds.js` (131 lines): 11 generated sound recipes (pew/boom/crack/
  zip/whoosh/sizzle/pop/thud/horn/fanfare/sting) built from oscillator + noise
  envelopes, plus the `FIRE_SOUND` tower→sound map.
- `js/sfx.js` (61 lines): lazy AudioContext engine (created on first user
  gesture), `SFX.play(name)`, mute toggle persisted under
  `towerDefenseMuted.v1`; headless-safe no-op without AudioContext.
- `smoke_sfx.mjs`: stub AudioContext verifies scheduling, mute suppression +
  persistence, unknown-name safety, and FIRE_SOUND coverage — passing.
- Wiring: fire sounds in the game tower loop; pop/thud in onEnemyKilled /
  onEnemyLeaked; horn at all three wave-start paths (first tower, auto,
  manual send); fanfare/sting on won/lost in main.js.
- HUD: 🔊 Sound / 🔇 Muted button (index.html + ui.js), which also unlocks the
  AudioContext as a user gesture.

## Phase 15: Score & High Scores

### Requirements
- Track per level run: total kills, lives remaining, money earned (total
  income, not current balance), waves survived.
- Compute a score at level end: `kills × 10 + lives × 50 + moneyEarned × 1`.
- Persist per-level best scores in localStorage alongside existing progress
  (separate key `towerDefenseScores.v1`, same try/catch fallback pattern as
  progress.js).
- Show "Best: 12,450" on the victory/defeat banner; also show the live score
  in the HUD so the player can see it building up.

### Design
- `js/score.js` — pure scoring module:
  - `SCORE_WEIGHTS = { kills: 10, lives: 50, money: 1 }`.
  - `computeScore({kills, lives, moneyEarned})` → integer score.
  - `loadScores()` / `saveScores(s)` / `recordScore(levelIndex, score)` —
    per-level bests keyed by 0-based level index; `recordScore` returns the
    new best (and persists it). Same localStorage + try/catch fallback as
    progress.js. Shape: `{ best: { "0": 12450, ... } }`.
- `js/game.js` — stat tracking on the Game instance (reset in `reset()`):
  - `stats = { kills: 0, moneyEarned: 0, wavesSurvived: 0 }`.
  - `onEnemyKilled` increments kills; money-earning paths (`onEnemyKilled`,
    early-send bonus) add to `moneyEarned`; `waves.startNext` success bumps
    `wavesSurvived` (a wave counts as survived when it is started — the
    banner shows at end-of-level, so "waves survived" = waves reached).
  - `get score()` → `computeScore(this.stats)` live; `endScore()` snapshots
    `{kills, lives, moneyEarned, wavesSurvived, score}` at level end.
- `js/ui.js` — HUD: add `🏆 <b id="score">0</b>` to the HUD (index.html) and
  update it in `updateHUD()`. Banner: `setBanner(text)` helper appends
  ` — Best: 12,450` (formatted with thousands separators) when a best exists.
- `js/main.js` — on won/lost status change: call `recordScore(levelIndex,
  game.score)`, then set the banner message with the new best included.
- Load order: `js/score.js` after `js/progress.js` (both are storage modules;
  score.js needs nothing from the others).

### Implementation steps
- [x] PLAN.md updated with Phase 15 (this section)
- [x] js/score.js — weights, computeScore, load/save/record (node --check, 65 lines)
- [x] game.js — stats tracking + score getter (node --check, 209 lines)
- [x] index.html — HUD score element + script tag for score.js
- [x] ui.js — live score in updateHUD; banner best formatting (main.js builds the
      banner text with the Best line)
- [x] main.js — recordScore on won/lost + banner with Score + Best line
- [x] smoke_score.mjs — headless: computeScore math, persistence, recordScore
      best-replacement, game stats tracking through kills/leaks/waves (passing)
- [x] Full regression run (node --check + all smoke tests): 13/15 pass; the 2
      failures (smoke3, smoke_railgun) are the same pre-existing stale config
      assertions documented in Phases 13–14, unrelated to this change

### Progress log
- `js/score.js` (65 lines): `SCORE_WEIGHTS`, `computeScore`, and per-level best
  persistence under `towerDefenseScores.v1` (load/save/record/bestScore), same
  try/catch localStorage fallback as progress.js.
- `js/game.js`: `stats {kills, moneyEarned, wavesSurvived}` reset per level;
  kills + reward income tracked in `onEnemyKilled`; early-send bonus tracked via
  new `sendNextWave()` (used by the HUD button); wavesSurvived bumped at all
  three wave-start paths. `game.score` is live; `endScore()` snapshots for the
  banner.
- HUD: `🏆 <score>` element updated every frame with thousands separators.
- Banner: on won/lost, main.js records the per-level best and shows
  "Score: X — Best: Y" (Best line only when a best exists).
- `smoke_ui.mjs` DOM stub gained the `score` element id; all smoke bundles now
  include `js/score.js`.

## Phase 16: First-time Tutorial Overlay

### Requirements
- First-time players get a 3-step overlay: (1) pick a tower from the shop,
  (2) click a grass tile to build, (3) send waves and defend.
- Dismissable at any time; stored in localStorage so it only shows once.

### Design
- `js/tutorial.js` — new module (~90 lines):
  - `TUTORIAL_KEY = 'towerDefenseTutorial.v1'`; `tutorialDone()` /
    `markTutorialDone()` with the same try/catch localStorage fallback as
    progress.js.
  - `class Tutorial` — builds a floating instruction card (top-center,
    non-blocking: pointer-events only on the card, so the player can still
    click the shop/canvas while reading). Steps advance automatically from
    game state via `update(view, game)` called each frame: step 1 → 2 when
    `view.placingType` is set; step 2 → 3 when `game.towers.size > 0`;
    step 3 → done when `game.waves.current >= 1`. A "Next" button advances
    manually; "✕ Skip" dismisses and persists.
- `index.html` — CSS for the card + script tag (after ui.js, before main.js).
- `js/main.js` — construct `new Tutorial()` at boot when `!tutorialDone()`,
  call `tutorial.update(view, game)` in the frame loop. No changes to
  input.js/game.js — state is observed, not hooked.
- `smoke_tutorial.mjs` — headless: flag persistence, step advancement from
  stub view/game state, manual Next, dismiss.

### Implementation steps
- [x] PLAN.md updated with Phase 16
- [x] js/tutorial.js (node --check, 95 lines)
- [x] smoke_tutorial.mjs (passing)
- [x] index.html: CSS + script tag
- [x] main.js: boot + per-frame update
- [x] Full regression run: 14/16 pass; the 2 failures (smoke3, smoke_railgun)
      are the same pre-existing stale config assertions from Phases 13–15

### Progress log
- `js/tutorial.js` (95 lines): `tutorialDone()` / `markTutorialDone()` under
  `towerDefenseTutorial.v1` (try/catch fallback like progress.js);
  `TUTORIAL_STEPS` (3 steps); `class Tutorial` builds a floating top-center
  card (outer wrapper `pointer-events:none`, inner `.tut-card` interactive —
  never blocks the canvas/shop). Steps auto-advance from observed state in
  `update(view, game)`: step 1→2 when `view.placingType` is set, 2→3 when a
  tower exists, 3→done when wave 1 is fully cleared (`waveCleared()`).
  "Next →" advances manually; "✕ Skip tutorial" dismisses; both persist the
  done flag.
- `index.html`: `#tutorial` / `.tut-card` CSS + script tag (after ui.js).
- `js/main.js`: `const tutorial = tutorialDone() ? null : new Tutorial()` at
  boot; `if (tutorial) tutorial.update(view, game)` in the frame loop. No
  changes to input.js/game.js — state is observed, not hooked.
- `smoke_tutorial.mjs` (108 lines): persistence round-trip, auto-advance
  pick→build→wave-cleared (incl. "still in progress" guard), manual Next ×2,
  Skip dismissal + persistence — passing.

### Milestone: relocate smoke tests to tests/ (run-from-subfolder + gitignored)
- [x] Moved all 19 root-level `smoke*.mjs` files into `tests/`.
- [x] Each test now defines `ROOT` = parent of `tests/` (via `import.meta.url`) and
      resolves game-relative paths against it; child_process calls to
      `tools/build_levels.mjs` pass `cwd: ROOT`. Tests run from any cwd.
- [x] Regression: 19/19 pass from both `tests/` and the project root.
- [x] `.gitignore` created with `/tests/` so the smoke folder is never committed.

## Phase 17: Built-in level difficulty (same model as the generator)

### Requirements
- L1 Snake & L2 Serpentine = easy; L3 Comb & L4 Switchback = normal ("medium");
  L5 The Gauntlet & L6 Crossroads = hard.
- Difficulty must mean the SAME thing for built-in and generated levels:
  both use the generator's `LG_DIFFICULTY` table (base + floor(ramp*w) wave
  size, tank share, boss every 5th wave).
- Display each level's difficulty in the player UI (level dropdown).

### Design
- `js/levels.js`: add `difficulty: 'easy'|'normal'|'hard'` to each built-in.
- `js/wave.js`: procedural path of `buildWave(wave, levelIndex)` reads the
  level's difficulty from the registry (`getLevel(levelIndex).difficulty`,
  default 'normal') and composes waves with the SAME formula as
  `buildGeneratedWaves`: `n = base + floor(ramp*w)`, tank share
  `floor(n*tank)`, boss wave every 5th (boss + escorts), deterministic rotate
  interleave. Enemy pool stays gated by `unlockLevel` (map content, not
  difficulty). Boss escorts: available non-boss types; if only 'normal' is
  available, escorts are 'normal'.
- `js/levelgen_waves.js`: export a shared helper
  `composeWaveList(wave, d, pool)` used by BOTH `buildGeneratedWaves` and the
  built-in procedural path (same file, no duplication). Loaded by index.html
  BEFORE wave.js (new script tag; levelgen.html already loads it).
- `js/level_registry.js`: `normalizeLevelDef` passes through `difficulty`
  (default 'normal').
- `js/level_validate.js`: optional `difficulty` field, must be a key of
  `LG_DIFFICULTY` (validated against the known set; validator stays pure-data).
- `tools/build_levels.mjs`: generated glue passes `difficulty` through;
  regenerate `js/levels_external.js`.
- `js/levelgen_save.js`: `lgBuildDef` stores `difficulty` in saved defs.
- `levels/riverbend.json`: add `"difficulty": "normal"`.
- `js/ui.js`: dropdown options show the difficulty label, e.g.
  `1 — Snake · Easy`; locked entries keep their format.
- `index.html`: script tag for levelgen_waves.js (before wave.js).

### Implementation steps
- [x] PLAN.md Phase 17 written
- [x] js/levels.js: difficulty field per level
- [x] js/levelgen_waves.js: shared composeWaveList helper
- [x] js/wave.js: procedural path uses difficulty + shared helper
- [x] index.html: load levelgen_waves.js before wave.js
- [x] js/level_registry.js: normalizeLevelDef passes difficulty (default normal)
- [x] js/level_validate.js: optional difficulty enum check
- [x] tools/build_levels.mjs glue + levels/riverbend.json + regenerate
- [x] js/levelgen_save.js: store difficulty in defs
- [x] js/ui.js: dropdown shows difficulty label
- [x] Update smoke tests (registry, enemy_unlock, resist, smoke3, levelgen)
- [x] Full regression run from tests/

### Progress log
- `js/levels.js`: each built-in level carries `difficulty` — Snake/Serpentine
  easy, Comb/Switchback normal, The Gauntlet/Crossroads hard.
- `js/levelgen_waves.js`: extracted shared `composeWaveList(wave, d, pool)`
  (regular wave n = base + floor(ramp*wave), tank share floor(n*tank), boss
  every 5th with escorts, deterministic rotate interleave);
  `buildGeneratedWaves` now loops over it — generator output unchanged.
- `js/wave.js`: procedural path of `buildWave` is now
  `composeWaveList(wave, LG_DIFFICULTY[level.difficulty], pool)` with the pool
  = unlockLevel-gated enemy set (map content stays per-level; difficulty
  drives scaling exactly like generated levels).
- `index.html`: loads `js/levelgen_waves.js` before `js/wave.js`.
- `js/level_registry.js`: `normalizeLevelDef` passes `difficulty` through
  (default 'normal').
- `js/level_validate.js`: optional `difficulty` field, enum-checked against
  the four generator keys (literal list keeps the file dependency-free).
- `tools/build_levels.mjs` glue + regenerated `js/levels_external.js`:
  `difficulty` passthrough (default "normal"); `levels/riverbend.json` now
  declares `"difficulty": "normal"`.
- `js/levelgen_save.js`: `lgBuildDef` stores `difficulty` in saved defs.
- `js/ui.js`: dropdown options show the difficulty label, e.g.
  `1 — Snake · Easy`; locked entries keep the same format.
- `js/levelgen_ui.js`: generator preview cards show the difficulty label.
- Tests: new `tests/smoke_difficulty.mjs` (procedural == generator output for
  every level × wave; easy<hard sizing; boss cadence; tank growth; mapping);
  `smoke_registry.mjs` asserts the L1–L6 mapping + default + bad-difficulty
  rejection; `smoke_levelgen.mjs` asserts `lgBuildDef` stores difficulty; all
  bundles loading wave.js also load levelgen_waves.js.
- Full regression: 20/20 pass from tests/.

## Phase 18: Difficulty levers (harder = visibly harder, no hidden nerfs)

### Requirements
- Easy/Normal must play exactly as before; Hard/Nightmare get real teeth.
- Levers are visible and skill-addressable: spawn gap, HP multiplier, lives,
  boss cadence. No path-length scaling (user enjoys long paths), no RNG nerfs,
  economy untouched.
- Fix the tank-clumping "interleave" bug: the rotate-shift only moved the
  contiguous tank block to the wave END; tanks must be spread across the wave.

### Design
- `LG_DIFFICULTY` rows gain `spawnGap`, `hpMul`, `lives`, `bossEvery`:
  easy {0.7, 1.00, 20, 5}, normal {0.7, 1.00, 20, 5} (unchanged),
  hard {0.5, 1.15, 15, 4}, nightmare {0.4, 1.35, 10, 3}.
- `composeWaveList`: boss wave when `wave % d.bossEvery === 0`; regular-wave
  tanks placed at evenly spread slots (`floor((i+1)*tankN/n) > floor(i*tankN/n)`),
  rest round-robin nonBoss; boss stays first on boss waves.
- `WaveManager` resolves its difficulty row (defensive getLevel/'normal'
  fallback, same pattern as buildWave) and stores `this.spawnGap`;
  `update(dt)` uses it instead of the hardcoded 0.7.
- `Enemy` multiplies maxHp by the level's difficulty `hpMul` (fallback 1).
- `Game.reset()` sets lives from the difficulty row (fallback START_LIVES).

### Implementation steps
- [x] PLAN.md phase entry
- [x] js/levelgen_waves.js: new row fields + bossEvery + true interleave
- [x] js/wave.js: WaveManager.spawnGap from difficulty row
- [x] js/enemy.js: hpMul into maxHp
- [x] js/game.js: lives from difficulty row
- [x] tests/smoke_difficulty.mjs: row values, hard/nightmare boss cadence, tank spread
- [x] Full regression run from tests/ (expect all green)
- [x] FILE_SUMMARY.md updated for changed files

### Progress log
- [x] PLAN.md phase entry
- [x] js/levelgen_waves.js: new row fields + bossEvery + true interleave (verified tank spread on waves 1/4/7/12)
- [x] js/wave.js: WaveManager.spawnGap from difficulty row (defensive getLevel fallback)
- [x] js/enemy.js: hpMul into maxHp (defensive lookup)
- [x] js/game.js: startingLives() helper + reset() uses it (verified every bundle with game.js also has levelgen_waves.js)
- [x] tests/smoke_difficulty.mjs: new checks 6 (row values + lever ordering) and 7 (fair-share tank slots); check 3 now loops all four difficulties via d.bossEvery
- [x] tests/smoke_levelgen.mjs: boss-cadence assertion driven by LG_DIFFICULTY.hard.bossEvery (was hardcoded waves 5/10)
- [x] tests/smoke_railgun.mjs: checks 4/5 compute maxHp from ENEMY_TYPES.tank.hp * hpMul (level 6 is 'hard'); e2e sim window widened to 8s
- [x] tests/smoke_resist.mjs: check 6 L5 boss wave now uses the level's difficulty-row bossEvery (hard → wave 4)
- [x] Full regression from tests/: PASS=21 FAIL=0
- [x] FILE_SUMMARY.md: game.js/enemy.js/wave.js/levelgen_waves.js entries + smoke_difficulty entry added, smoke_levelgen/railgun/resist notes updated

## Phase 19: Five new enemy types (Fission/Spore, Bolt, Bulwark, Mender, Wisp)

### Requirements
- Implement all five designs from `PLAN_enemies.md` with no design changes.
- All five unlock at level 7 (user decision: "available after level 6").
- Spore is `childOnly`: never in wave pools or generator checkboxes; spawned only by Fission death.
- Wisp phased = untargetable only (splash/burn still hit); Frost slow pauses the phase cycle.
- Bolt dash at END of each period; resists Sniper.

### Implementation steps
- [x] js/config.js: 6 new ENEMY_TYPES entries (fission, spore, bolt, bulwark, mender, wisp), all `unlockLevel: 7`
- [x] js/enemy.js: `burstTimer`/`phaseTimer` fields, `targetable` getter, `currentSpeed` dash logic, regen-before-burn order, phase timer gated on slow
- [x] js/game.js: `onEnemyKilled` spawns split children at parent's distance/pos with game's wave/level
- [x] js/tower.js: `acquireTarget` skips untargetable enemies (wisp while phased)
- [x] js/projectile.js: `mendAura(enemies, dt)` global heal aura for Mender
- [x] js/wave.js: pool filter excludes `childOnly` types
- [x] js/ui.js: legend order extended to 13 rows (fission, spore, bolt, bulwark, mender, wisp between camo and boss)
- [x] levelgen.html: dynamic checkbox order includes new types (spore excluded via childOnly)
- [x] tests/smoke_enemy_unlock.mjs: extended with 6 new types + availability cases + spore-never-spawned section
- [x] tests/smoke_split.mjs: 4 checks (spawn count/position, HP inheritance, frame-filter survival, non-splitting types)
- [x] tests/smoke_burst.mjs: cycle distance, speed switch points, slow halves both speeds, sniper resist
- [x] tests/smoke_regen.mjs: 4 checks (regen rate, cap, sustained-burn death, weak-burn floor)
- [x] tests/smoke_mend.mjs: 6 checks (heal in radius, cap, no self-heal, outside untouched, dead inert, multiple allies)
- [x] tests/smoke_phase.mjs: 6 checks (targetable boundaries, phase frozen while slowed, phased skipped by acquireTarget, solid picked, non-phase always targetable)
- [x] tests/smoke_ui.mjs: legend `expected` extended to 13 rows
- [x] Full regression: PASS=25 FAIL=0
- [x] FILE_SUMMARY.md updated

## Phase 20: Level generator — Select All for enemy checkboxes

### Requirements
- One click toggles every enemy-type checkbox in the generator options form (Select All ↔ Clear).
- `childOnly` types (Spore) stay excluded from the checkbox set.
- Checkbox building moves out of levelgen.html's inline script into `js/levelgen_ui.js`.

### Implementation steps
- [x] PLAN.md phase entry
- [x] js/levelgen_ui.js: `lgBuildEnemyCheckboxes(wrap, enemyTypes)` + `lgSelectAllEnemies(wrap, on)`; `lgInit` wires the toggle button (auto-flips to uncheck-all when everything is checked)
- [x] levelgen.html: "☑ Select All" button next to the enemy checkboxes; inline IIFE reduced to calling `lgBuildEnemyCheckboxes` + boot
- [x] tests/smoke_lgenemies.mjs: box count = selectable types (spore excluded), defaults (Minion+Colossus), select-all on/off reflected through `lgReadOptions`, single pick intact
- [x] Full regression from tests/ (PASS=26 FAIL=0)
- [x] FILE_SUMMARY.md updated

## Phase 21: Levels start paused — Resume required to begin

### Requirements
- Every level entry (boot, manual level switch, retry after loss, win auto-advance) begins in the paused state; the player must press ▶ Resume (or Space) to start.
- The building phase is untouched: `game.building` (waves wait for the first tower) stays as-is; this is purely the UI-level pause gate.

### Implementation steps
- [x] PLAN.md phase entry
- [x] js/main.js: `paused` initializes to `true`; boot calls `setPaused(true)` after UI construction; fresh-start message mentions ▶ Resume
- [x] js/ui.js: `updateHUD` building fallback message mentions ▶ Resume
- [x] index.html: pause button starts as '▶ Resume'; initial #msg text mentions Resume
- [x] js/tutorial.js: step 3 text mentions pressing ▶ Resume
- [x] tests/smoke_paused_start.mjs: boots the real main.js in a DOM stub — paused at boot, pause-button + Space toggle round-trip, still paused after `loadLevel` (dropdown switch) and `restart(true)` (retry), win auto-advance lands on the next level paused with '▶ Resume' (6 checks PASS; supersedes the planned smoke_levelselect boot assertion)
- [x] Full regression from tests/ (27 PASS / 0 FAIL)
- [x] FILE_SUMMARY.md updated

## Phase 22: Fix generated levels bowing off the map edges

### Requirements
- Generated level paths must never render outside the 28x18 grid: Catmull-Rom corners can bow past the waypoint cells, and candidates that bow off-grid were passing validation.
- The fix must also catch hand-crafted / shared external levels with the same bug (the validator is shared).

### Implementation steps
- [x] PLAN.md phase entry
- [x] Reproduce headless: 317/1600 generated candidates bow outside the grid (worst bows: crossroads ~83px, loop ~57px, weave ~49px, arc ~44px past a boundary-row corner)
- [x] js/level_validate.js: `validateWaypoints` now samples the spline (`sampleSpline`) and rejects any path whose sampled curve leaves the grid rect (one cell of x-slack for the off-screen spawn/exit centers; y strictly inside) — problem string "waypoints: spline leaves the grid"
- [x] js/levelgen_paths.js: tighten template row ranges so candidates stay off boundary rows and re-rolls aren't wasted — arc room checks use `LG_ROWS-2`/`rA-1`; loop return lane `rD >= 1`; weave `r1 <= LG_ROWS-2`, `r2 >= 1`; crossroads `rB/rE <= LG_ROWS-2`, `rC >= 1`
- [x] Verify: 0/1600 candidates bow outside (scratch scan), all 7 built-in + external levels still pass validation, smoke_levelgen PASS, full regression from tests/ (27 PASS / 0 FAIL)
- [x] FILE_SUMMARY.md updated
