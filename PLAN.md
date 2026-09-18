<!-- CONTINUATION HEADER -->
> **Status:** Continued from `PLAN_04.md`
> **Archived History:** [`PLAN_01.md`, `PLAN_02.md`, `PLAN_03.md`, `PLAN_04.md`]

### 📌 Handoff Summary
* **Completed Milestones:** Phases 1–48 (see archives). Phase 46: rich chiptune
  music (chords, melody, variation; separate boss pattern). Phase 47: terrain /
  pond sprites. Phase 48: six normal-mode background songs — five new songs
  composed in `js/music_songs.js` (Home/Meadow/Twilight/Ratland/Ember/Stormfront),
  🎵 Start now picks one of the six uniformly at random (`Music.songIndex`), and
  `tests/smoke_music.mjs` gained section M with song-relative H–L. All smoke
  tests pass.
* **Current Focus:** No active phase — awaiting the next user request.
---

## Phase 49 — Fix exe cold-boot blank page

**Bug:** Compiled Windows exe opens with empty game area / dropdowns; navigating
away and back (full reload in same WebView2) fixes it. Regular browsers fine.

**Root cause (confirmed by user-run exe + DevTools):** `ERR_CONNECTION_REFUSED`
on every `js/*.js` request while index.html itself loaded. The old server was a
single-threaded `socketserver.TCPServer`: WebView2 fetches the document and all
~30 scripts in parallel; the server handled the first (keep-alive) connection
and blocked on it, so every subsequent script connection was refused. Reloads
worked because navigating away closed the stuck socket and freed the server.

**Fix (this commit):**
- `compile.py`: multi-threaded server (`socketserver.ThreadingMixIn`,
  `daemon_threads = True`, `allow_reuse_address`) — each request gets its own
  thread, parallel script fetches all succeed.
- `compile.py`: `webview.start(debug=False)` — no auto-opened DevTools window
  on launch (it was a debugging aid; remove once the bug is confirmed fixed if
  desired — kept off for now).

**Constraints:** no behavior change in regular browsers; all smoke tests pass;
files ≤ 500 lines.

## Phase 50 — Smoke test: song-count-agnostic roster checks

**Context:** the user added five more normal-mode songs (roster is now 11),
which broke `tests/smoke_music.mjs` — section M hard-coded a 6-song roster
(count, name→cadence map, fixed pick indices, `CHORDS.Am` pad assumption).

**Fix:** make the music smoke test assert only SHAPE invariants, never a fixed
song list or count:
- M: nonempty roster; distinct names/BPMs == n; every song's bar 8 is a
  cadence fill with a chord defined in CHORDS; stubbed random 0→index 0 and
  0.999→index n-1; pad check uses each picked song's OWN bar-1 chord; unstubbed
  pick in [0,n); no-repeat across 12 picks.
- B: force the pick (stubbed random) — percussion-free song schedules no
  kick/hat noise across the full loop; when the roster has a percussive song,
  it DOES schedule hat/snare noise (some normal songs carry light percussion,
  so the old random-pick assertion was flaky).
- L: loop-coverage advance is data-driven off the slowest song's stepDur.

**Status:** done — 25-run sweep of `smoke_music.mjs` clean (random picks vary
per run), full regression 38/38 smoke tests pass.

## Phase 51 — Balance pass: enemy × tower matrix across difficulties

**Goal:** measure, not guess. A headless simulator (`tests/balance_sim.mjs`)
bundles the real game scripts and plays all 12 waves of every level at each of
the four difficulties with a deterministic reference strategy (greedy
best-coverage placement; build order cannon→basic→frost→sniper→flame→railgun→
tesla→venom→reaper→mortar→warden→mint; upgrade-cheapest policy). A synthetic
full-roster level (index 6) is registered so the L7+ types (fission/bolt/
bulwark/mender/wisp) are exercised — they never appear on built-ins.

**Matrix (W=win, L=loss; lv=lives left, w=waves survived):**

| level        | easy            | normal          | hard            | nightmare       |
|--------------|-----------------|-----------------|-----------------|-----------------|
| Snake        | W  lv10         | W  lv15         | **W  lv0** ⚠️   | L  w6           |
| Serpentine   | W  lv10         | W  lv15         | L  w8           | L  w7           |
| Comb         | W  lv10         | W  lv2          | L  w12 (lv0)    | L  w9           |
| Zigzag       | W  lv10         | W  lv10         | L  w9           | L  w6           |
| The Gauntlet | W  lv10         | W  lv15         | W  lv3          | L  w9           |
| Crossroads   | W  lv20 (no loss)| W  lv20        | W  lv15         | W  lv10         |
| BalanceFull  | W  lv10         | W  lv8          | L  w10          | L  w8           |

**Findings:**

1. **BUG (confirmed, reproduced on real level): a win can be recorded at 0
   lives.** `game.update()` checks loss (leak → `lives <= 0` → `status='lost'`)
   BEFORE the win check (`all waves done && no enemies alive`), which
   unconditionally overwrites `status='won'`. If the last enemy of the final
   wave leaks and drains the final life in the same tick, the player "wins" at
   0 lives. This is exactly what the Snake-hard "W lv=0" cell is — the sim
   lost the last life on the last wave's last leak. Fix: the win check must not
   overwrite a loss (e.g. `if (this.status === 'playing' && ...)`), or loss must
   be re-asserted after the win check. Needs a regression test.
2. **Crossroads is ~30% easier than its neighbors** — path length 4150px vs
   2700–3550px for the other five (and it's the only one the reference strategy
   wins on nightmare). Its hard/nightmare rows are therefore under-tested.
   Options: shorten a segment, or accept it as the "long-path" variant and
   note it.
3. **Hard mode is a cliff, not a step** — the reference strategy (which wins
   every easy AND normal level) dies on 4 of 6 hard levels; nightmare is
   unwinnable by it on all six. If the reference ≈ "competent casual", then
   hard is tuned for near-optimal play. Candidate levers: reduce `ramp`
   (hard 1.4→~1.2, nightmare 1.9→~1.6) or raise `hpMul` spread so difficulty
   scales enemy toughness rather than raw count.
4. **Easy ≈ Normal in HP** (`hpMul` 1.0 for both; only wave size differs).
   Easy could take `hpMul` 0.9 to widen the entry curve.
5. **Boss ↔ Mortar inversion (static analysis, untested by sim):** the boss
   resists every tower except the mortar, whose single-target DPS is the
   weakest in the roster (L3 cannon-ammo: ~131–176 s TTK vs 82–93 s on-screen).
   The one counter is the least effective. Candidate levers: drop one entry
   from the boss resist list, or raise mortar single-target damage.
6. **Bulwark regen vs Flame L1:** net burn 4 dps at tower level 1 (burn 10 −
   regen 6); consider flame `burn.dps` 10→~14 or bulwark `regen` 6→4.

**Fixes applied (user-approved, one at a time):**

1. **Win-at-0-lives bug** — `js/game.js` win check now guarded by
   `this.status === 'playing'`; regression test `tests/smoke_winloss.mjs`
   (verified to fail pre-fix, pass post-fix).
2. **Crossroads shortened** — 4150px → 3789px (waypoints tightened:
   `[-1,4],[9,4],[9,11],[3,11],[3,2],[20,2],[20,8],[16,8],[16,6],[28,6]`);
   still exactly 2 crossovers, all validation green.
3. **hard hpMul 1.15 → 1.10** (`js/levelgen_waves.js`).
4. **normal hpMul 1.00 → 1.05** (same file). Curve now 1.00/1.05/1.10/1.35.
5. **Boss resist: 'reaper' removed** (`js/config.js`) — Colossus now has two
   weaknesses: mortar and reaper.
6. **Flame burn dps 10 → 14** (`js/config.js`) — beats Bulwark's 6/s regen at
   tower level 1 (net +8 dps).

Tests updated in the same pass: `smoke_difficulty.mjs` (row values),
`smoke_difficulty_select.mjs` (data-driven hpMul), `smoke_split.mjs` /
`smoke_railgun.mjs` / `smoke_mortar.mjs` (stale comments + data-driven burn
dps), `smoke_mortar.mjs` 6b (two weaknesses), `smoke_ui.mjs` (legend text),
`smoke_regen.mjs` (real flame payload). Full suite: **39/39 pass**.

**Post-fix matrix (reference strategy):**

| level        | easy          | normal          | hard            | nightmare       |
|--------------|---------------|-----------------|-----------------|-----------------|
| Snake        | W  lv10       | W  lv10         | L  w12 (lv0)    | L  w6           |
| Serpentine   | W  lv10       | W  lv8          | L  w8           | L  w7           |
| Comb         | W  lv10       | **L  w12 (lv0)** ⚠️ | L  w12 (lv0)  | L  w9           |
| Zigzag       | W  lv10       | W  lv10         | L  w9           | L  w6           |
| The Gauntlet | W  lv10       | W  lv15         | W  lv3          | L  w9           |
| Crossroads   | W  lv20       | W  lv20         | W  lv15         | **W  lv3**      |
| BalanceFull  | W  lv10       | W  lv8          | L  w10          | L  w8           |

Crossroads nightmare went from a comfortable W (lv10) to a razor-thin W (lv3)
— matching "nightmare = barely beatable by experienced players". Snake hard's
former "W lv=0" is now correctly reported as a loss (and it IS a loss: the
reference strategy dies on wave 12 at 0 lives).

**Open question for discussion:** Comb normal flipped from W (lv2) to L (w12,
lv0) when normal hpMul rose 1.00→1.05 — a competent-casual reference now loses
it by a hair. Either accept it (humans upgrade better than the reference) or
reconsider the normal bump. Everything else landed as intended.

**Status:** all six fixes applied and verified; matrix re-measured; one open
question above.

## Phase 52 — All-time stats + reset on the bottom bar

**Request:** the bottom bar lists this level's stats on the LEFT (the existing
"Stats:" fallback). Add TOTAL (all-time) stats to the RIGHT side of the same
bar, plus a Reset button that clears the all-time history.

**Design (final — user-corrected: fold at level end, NOT live):**
- New module `js/totalstats.js` (loads after `score.js`, before `game.js`):
  - `TOTAL_STATS_KEY = 'towerDefenseTotalStats.v1'`; fields: kills, moneyEarned,
    wavesSurvived, damageDealt, towersBuilt, towersSold, leaked, dotKills,
    directKills, levelsWon.
  - `loadTotalStats()` / `saveTotalStats(t)` — same try/catch + normalize
    pattern as score.js (corrupt/missing → fresh zeros); in-memory cache after
    first load.
  - `foldTotalStats(s, won)` — fold ONE finished level's `game.stats` into the
    store (damageDealt rounded, others floored) and persist; `won` also
    increments `levelsWon`. `resetTotalStats()` — zero the store and persist.
- **No per-event crediting** (user: "fold current stats into historical at
  level end", "total doesn't need to be live", losing a crashed level's stats
  is acceptable): `js/game.js` is UNCHANGED; the fold happens exactly once per
  win/loss in `js/main.js`'s status-transition block (guarded by the existing
  `game.status !== lastStatus` check), via
  `foldTotalStats(game.stats, game.status === 'won')`.
- `js/main.js`: new handler `onResetTotalStats()` (confirm → reset → message).
- `index.html`: `#wavePreview` becomes a flex row — `#wpLeft` (existing content)
  + `#wpTotal` (all-time chips, right-aligned via margin-left:auto) with the
  "↺ Reset" button inside `#wpTotal`; CSS for the new ids.
- `js/ui.js`: `syncWavePreview`/`renderStatsBar` write into `#wpLeft` (fallback
  to the box for stub DOMs); new `syncTotalStats()` renders the STORED totals
  as-is (no live sums) + reset button, keyed on the values (DOM rebuild only
  when something moves); called each frame from main.js.

**Tests:** `tests/smoke_totalstats.mjs` — store load/normalize/reset; fold()
accumulation + persistence + levelsWon-only-on-win; Game integration (level
stats accumulate mid-level, store stays untouched until the level-end fold);
UI bar renders left stats + right all-time chips + reset button, and a
simulated click (confirm stubbed both ways) resets. Updated
`tests/smoke_wave_preview.mjs` for the new `#wpLeft` nesting. Full suite green
(40/40).

**Status:** done — implemented, tested, FILE_SUMMARY updated.

**Constraints:** files ≤ 500 lines; no behavior change elsewhere; works from
`file://` (localStorage try/catch).

## Phase 53 — Windowed screen scaling (fit-to-window)

**Request:** "Scale everything down to fit when browser is running in windowed
mode" — no scrollbars on small windows.

**Design (final):** CSS transform scaling of `document.body` — no HTML
restructure:
- New `js/fit.js` (loaded LAST in index.html, after main.js; page chrome only,
  zero game dependencies). Scale factor `s = min(1, viewportW / body.scrollWidth,
  viewportH / body.scrollHeight)` — layout sizes are transform-invariant, so no
  feedback loop. `transform-origin: top center` keeps the centered column
  centered and pinned to the top. Never upscales (capped at 1) — large screens
  and the maximized desktop exe look pixel-identical to before.
- A transformed ancestor becomes the containing block for `position: fixed`
  elements — deliberately used: the tutorial card (fixed to the viewport) scales
  along with the page.
- Re-fits on `window.resize` AND via `ResizeObserver` on body (content height
  changes when the tower panel opens). Guarded `typeof ResizeObserver !==
  'undefined'`.
- Headless-safe: bails out when `document`/`window` are undefined (smoke_boot's
  bare sandbox) or when `documentElement` client sizes are missing (the other
  vm stubs), so every existing smoke test boots untouched.
- `index.html`: `html { overflow: hidden; }` — the unscaled layout box must not
  produce scrollbars while the body is scaled down (an app page, not a document).
- **No input changes needed:** `js/input.js` already maps clicks through
  `getBoundingClientRect()` ratios, which report the RENDERED (scaled) size —
  verified by test.

**Tests:** `tests/smoke_fit.mjs` (7 checks): small window scales by the binding
constraint (width- and height-bound cases), large window stays unscaled, live
resize re-fits both directions via the captured handler, headless stub boots
untouched, and scale-invariant input — a click at the scaled canvas position of
cell (14,8) maps to cell (14,8) at any display scale. Full suite: **42/42 pass**.

**Status:** done — implemented, tested, FILE_SUMMARY updated.

## Phase 54 — Tower health & friendly fire

**Request:** "Towers get health, should that be a multiple of cost? Towers take
damage from friendly fire. When friendly fire hits tower it stops; except for
the railgun which has penetration." + "Mortars are arcing weapons the go over
all towers and never hit them." + "Towers take No DoT or AoE effects, just flat
damage."

**Design (final):**
- `maxHp = invested × TOWER_HP_PER_COST` (2), derived — so upgrades and the
  Warden's dynamic cost raise durability automatically.
- Homing shells: a tower crossed mid-flight (segment distance ≤
  `TOWER_HIT_RADIUS`, never the firing tower via `sourceId`) stops the shell —
  flat damage, consumed, NO enemy impact/splash/DoT/slow/execute.
- Railgun slugs PENETRATE towers: flat base damage per new tower
  (`hitTowerIds`), no pierce-count consumption or halving — enemy DPS unchanged.
- Mortars are fully exempt: `MortarShell.update(dt)` takes no game ref and
  detonates only at its fixed point; the blast is enemy-only.
- Destruction: tower removed from `game.towers`, `alive=false`,
  `stats.towersDestroyed++`, death disc + boom SFX + message. No refund.
- UI: damaged towers draw an HP bar (green/yellow/red); `main.js` clears a
  selection that died to friendly fire.

**Files:** config.js (2 constants), tower.js (hp/alive/maxHp, sourceId in both
fire specs), game.js (stats field, placeTower/upgradeTower hp handling,
`damageTower`, projectile loop passes game), projectile.js (homing consumption +
pierce penetration), render.js (HP bar), main.js (selection cleanup).

**Tests:** `tests/smoke_tower_hp.mjs` (7 checks): fresh hp === cost×2; Warden #2
durability tracks its REAL cost ($400 → 800); upgrade raises maxHp by
upgradeCost×2 and a damaged tower heals by that delta; homing shell consumed on
tower impact (enemy untouched, blocker loses one flat hit, no splash);
destruction bookkeeping (removed from map, alive=false, `towersDestroyed`);
railgun penetration — blocker Mint takes full 70 while the tank beyond still
takes un-halved 70; mortar shell detonating exactly on a tower center never
damages it. Full suite: **44/45 pass** (the one failure, `scratch_phase36.mjs`,
pre-exists on the clean tree — spiral-generator scratch, unrelated).

**Status:** done — implemented, tested, FILE_SUMMARY updated.

## Phase 55 — Cruiser (water-only missile tower)

**Request:** Water-based (pond only) tower firing missiles. Damage 225,
cost 400, fire rate 0.25, range = half the map. Locks on and follows; if the
target dies or leaves range before impact, the missile self-destructs
(no damage). Fire rate may be adjusted for balance.

**Design decisions:**
- `range: 700` (half of CANVAS_W=1400) — explicit interpretation of "half
  the map".
- `waterOnly: true` in config; `canPlace(cx, cy, typeName)` becomes
  type-aware: water cells rejected for all towers EXCEPT Cruiser, which is
  rejected on land. `placeTower`/preview pass the placing type.
- New `js/tower_cruiser.js`: `CruiserMissile` class. Spec from tower.js:
  `{type:'cruiser', x,y (origin), sourceId, targetId, speed, damage, maxRange}`.
  Self-destruct (no impact) when target is gone OR distance(tower→target) >
  maxRange (live read of tower range, so upgrades extend it). Impact reuses
  `applyImpact` with splash 0.
- Boss (Colossus) does NOT resist 'cruiser' — it already resists everything
  except mortar+reaper; keeping cruiser as a third boss threat is the point
  of "1/4 Colossus" damage. smoke_mortar boss-resist assertion uses
  `TOWER_TYPES.length - 2` → must become `- 3`.
- Easy difficulty has 0 ponds ⇒ Cruiser unplaceable on easy maps (accepted,
  documented; built-in levels are L1–L6 anyway).
- Fire rate: keep 0.25 as specified; validate with balance_sim after.

**Steps:**
1. config.js: add `cruiser` entry (cost 400, damage 225, fireRate 0.25,
   range 700, projSpeed 500, unlockLevel 7, waterOnly).
2. tower.js: cruiser branch in update() → cruiser spec (after mortar branch).
3. js/tower_cruiser.js: CruiserMissile (homing + self-destruct rules).
4. game.js: canPlace type-aware; dispatch `spec.type==='cruiser'` →
   new CruiserMissile(spec); include tower_cruiser.js in index.html order.
5. render.js: cruise missile visual branch; placement preview passes type.
6. sfx_sounds.js: FIRE_SOUND.cruiser; assets/cruiser.png via
   gen_tower_sprites.py extension.
7. Tests: new tests/smoke_cruiser.mjs (placement rules, lock-on, self-destruct
   on death + on out-of-range, impact damage); update smoke_tower_unlock
   (13 towers, L7 list) and smoke_mortar boss-resist count.
8. balance_sim: add cruiser to BUILD_ORDER with water-cell placement; run
   full suite; adjust fire rate only if a level breaks.

**Status:** done — implemented, tested (smoke_cruiser 7/7, full suite green,
balance matrix: all runs terminated + deterministic, easy floor holds; Cruiser
placed on hard/nightmare L7+ runs without breaking any outcome), FILE_SUMMARY
updated. Fire rate kept at 0.25 as specified — no balance adjustment needed.
