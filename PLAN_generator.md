# PLAN_generator.md — Auto Level Generator (secondary page)

## Goal

A standalone secondary page (`levelgen.html`, NOT the main game screen) where the
user configures a level (enemy checkboxes, difficulty dropdown, starting money,
wave count, name) and gets **4 generated preview diagrams** with checkboxes.
The user checks the ones they want and presses **Create** (levels are added to
the registry and persist), or checks none and presses **Try Again** (fresh 4).

Generated paths are Bloons-inspired: crossovers, switchbacks, combs/snakes,
ring shapes — not just simple snakes. All generated levels must pass the game's
own `validateLevelDef` (axis-aligned, spawn x=-1, exit x=28, no U-turns/loops;
perpendicular 90° crossovers allowed).

## Success criteria

1. `index.html` gets a "🎲 Level Generator" button linking to `levelgen.html`;
   the main game screen is otherwise untouched.
2. On `levelgen.html`: enemy checkboxes (all 7 types), difficulty dropdown
   (Easy/Normal/Hard/Nightmare), starting-money text box, waves text box,
   name text box, Generate button.
3. Generate renders 4 preview cards: small canvas diagram of the path on the
   28×18 grid (spawn/exit markers, crossover cells highlighted), stats line
   (path length, waves, money), and a checkbox per card.
4. Create (≥1 checked) saves each selected level as a real `levels/NN_name.json`
   file via the **File System Access API** (`showSaveFilePicker`, default name
   `NN_name.json` — user picks the location, typically the `levels/` folder).
   Fallback when the API is unavailable (Firefox/Safari/file://): a Blob
   download with the same filename. After saving, the page runs registration
   itself — re-validate + `registerLevel()` in memory — so the level is playable
   immediately without the user running the build tool. A localStorage mirror
   keeps created levels alive across reloads (the generated `js/levels_external.js`
   only updates when the build tool runs; boot dedupes by name so a later build
   never double-registers). Try Again regenerates 4 new candidates with the same options.
5. Created levels appear in `index.html`'s dropdown after reload (and are
   always playable — not gated by campaign unlock), and work end-to-end
   (waves spawn only from the selected enemy set).
6. Every new file ≤ 300 lines; headless smoke test covers generator + store.

## Architecture (new files, each ≤ 300 lines)

| File | Responsibility |
|---|---|
| `js/levelgen_paths.js` | Seeded RNG + path templates (snake, comb, switchback, crossroads, weave) + `generatePathCandidates(seed)` → 4 validated waypoint sets with stats (length, crossovers, buildable). Every candidate passes `hasSelfIntersection` + bounds. |
| `js/levelgen_waves.js` | `buildGeneratedWaves(opts)` → explicit per-wave enemy lists from checked enemies + difficulty (count scaling, boss cadence) + wave count. |
| `js/level_custom.js` | localStorage mirror for created levels (`towerDefenseCustomLevels.v1`): `getCustomLevels()`, `saveCustomLevel(def)`, boot-time registration of saved defs via `registerLevel()` (validated at boot, same model as external levels; deduped by name against the registry). Loaded in BOTH index.html and levelgen.html after path.js. |
| `js/levelgen_save.js` | Save flow for Create: build pure-data JSON defs (name, waypoints, startMoney, totalWaves, waves), pick `NN_name.json` filenames, save via File System Access API with download fallback, then register in-memory + mirror to localStorage. |
| `js/levelgen_ui.js` | Page UI: options form (enemy checkboxes, difficulty select, money/waves/name inputs), Generate → 4 preview cards (canvas diagram + stats + checkbox), Create / Try Again buttons. |
| `levelgen.html` | Secondary page shell: styles + script tags in dependency order. |

## Small edits to existing files

- `index.html`: add "🎲 Level Generator" button (link to levelgen.html) in HUD; load `js/level_custom.js` after `js/levels_external.js`.
- `js/level_registry.js`: `normalizeLevelDef` keeps a `custom: true` flag when present.
- `js/ui.js` + `js/main.js`: custom levels are always playable (bypass `progress.unlocked` gate).
- `FILE_SUMMARY.md`: entries for all new files.

## Design notes

- **Crossovers**: the game allows perpendicular 90° crossovers (a cell walked exactly
  twice, once per direction) but rejects U-turns/same-direction overlaps/loops
  (`hasSelfIntersection`). Templates are built to produce crossovers naturally
  (vertical legs crossing earlier horizontal runs — Bloons "crossroads" style);
  every candidate is validated and re-rolled on failure (bounded retries).
- **Difficulty** (Easy/Normal/Hard/Nightmare): scales enemy counts per wave and
  tank/boss share; boss waves only if the boss checkbox is on (every 5th wave).
- **Persistence**: created levels live in localStorage as pure-data defs; both
  pages register them at boot, so they survive reloads and appear in the main
  dropdown. Create never mutates `levels/*.json` (that stays the file-based flow).
- **RNG**: mulberry32 seeded from a random 32-bit int per Generate press;
  "Try Again" = new seed, same options.

## Build order (increments)

1. ✅ PLAN_generator.md
2. `js/levelgen_paths.js` + quick node check in `tests/`
3. `js/levelgen_waves.js` + quick node check
4. `js/level_custom.js`
5. `js/levelgen_ui.js` + `levelgen.html`
6. Wire `index.html` + unlock bypass edits
7. `tests/smoke_levelgen.mjs` (full headless coverage) + run all smoke tests
8. Update `FILE_SUMMARY.md`, mark milestones here

## Milestones

- [x] Paths module validated headlessly (200 seeds × 4 candidates, all validate; crossovers appear)
- [x] Waves module validated headlessly (counts, keys, boss cadence)
- [x] Custom-level store + boot registration (save/register/dedupe tested)
- [x] levelgen.html page works (form → 4 previews → create/try again)
- [x] Created levels playable from index.html dropdown (custom flag bypasses unlock gate in ui.js + main.js)
- [x] smoke_levelgen passes; existing smoke tests still pass (all 20 green)

## Phase 2 — Curved paths (Bloons / Kingdom Rush inspired), 2026-07-14

### Goal

The generator's snake/comb/switchback templates are near-duplicates and boring.
Replace them with **curved** path templates built from **45° diagonal segments**
(Bloons-style organic routing on the grid) so generated levels look hand-made,
while keeping the change contained to the path layer. The 6 built-in training
levels in `js/levels.js` are untouched (they stay axis-aligned).

### Chosen approach (user-confirmed)

- **45° diagonal grid curves** — waypoints may now join with a diagonal step
  (`|dx| == |dy| == 1`) in addition to the existing axis-aligned steps.
  Diagonals are grid-corner "curves": they read as bends, keep every waypoint an
  integer cell, and need no new geometry (pixel points, cumulative distance,
  `pointAtDistance`, rendering, placement, targeting all work unchanged).
- **Remove** `tplSnake`, `tplComb`, `tplSwitchback` from the generator pool.
  Keep `weave` + `crossroads` (they have crossovers) and add the curved set.

### Why only the path layer changes (verified by reading the engine)

| Consumer | Current behavior | Change needed |
|---|---|---|
| `buildPath` (path.js) | pixel points + cumulative distance from waypoints | none (hypot handles diagonals) |
| `pointAtDistance` | linear interpolation between points | none — enemies move smoothly along diagonal segments |
| `walkPathCells` (path.js) | steps x-then-y per segment → **L-shape bug on diagonals** (marks the corner cell, misses the true diagonal cells) | **fix**: step both axes together (`cx += dx; cy += dy`) when both differ |
| `hasSelfIntersection` (path.js) | direction dot product == 0 → "90° crossover allowed" | **relax**: reject only same-direction re-walks and U-turns (`dot === -1`); allow perpendicular (0) and diagonal (±0.5, ±1, 0) crossings; keep the 3+ visits loop rule |
| `validateWaypoints` (level_validate.js) | rejects any non-axis-aligned segment as "diagonal" | **allow** `|dx|==|dy|==1`; still reject steeper diagonals and zero-length segments |
| `lgPathStats` / `lgCrossoverCells` | add dx AND dy each step → already diagonal-safe | none |
| `lgDrawDiagram` (levelgen_ui.js) | straight lines through cell centers | none — diagonal segments render as the curve |
| `render.drawPath`, placement (`canPlace`), targeting, waves | geometry-agnostic | none |

### New curved templates (js/levelgen_paths.js, all validated + re-rolled)

1. **S-Curve** — a long diagonal spine with two axis-aligned end runs; the
   Bloons "curved highway" feel. No crossovers.
2. **Loop-de-Serpent** — an S-curve plus one perpendicular leg that crosses the
   spine (single 90° crossover), so curved paths also exercise the crossover
   highlight in previews.
3. **Double Bend** — two opposing diagonal bends (a loose Z) with randomized
   bend columns/rows; longer path, more buildable cells around the bends.

The pool becomes: `scurve`, `loopserpent`, `doublebend`, `weave`, `crossroads`
(5 templates, 4 drawn per Generate as today).

### Build order (increments)

1. [x] PLAN_generator.md phase-2 section
2. [x] `walkPathCells` diagonal fix + quick node check in `tests/`
3. [x] validator + `hasSelfIntersection` relaxation + quick node check
4. [x] new templates + pool swap in `levelgen_paths.js`
5. [x] `levels/README.md` schema note (diagonals allowed, same crossover rules)
6. [x] extend `tests/smoke_levelgen.mjs`: assert the new pool contains diagonals
   and all candidates still validate over 60 seeds; run ALL smoke tests
7. [x] update `FILE_SUMMARY.md`, mark milestones

### Milestones (phase 2)

- [x] Diagonal cell-walking fixed (path cells match the drawn line)
- [x] Validator accepts 45° diagonals, still rejects U-turns/loops/steep diagonals
- [x] snake/comb/switchback removed from generator; 3 curved templates added
- [x] smoke_levelgen green + all 20 smoke tests green

## Phase 3 — Real curved paths (spline engine), 2026-07-14

### Goal

Phase 2's 45° diagonals were rejected: "diagonals suck. they are not curves",
"these diagonals mostly look like snake and comb". Phase 3 makes paths **genuinely
smooth**: a Catmull-Rom spline through the integer waypoints, sampled to a dense
pixel polyline. Scope (user-confirmed): **round everything** — the spline applies
to ALL levels including the 6 built-in training levels (Snake, Serpentine, Comb,
Switchback, The Gauntlet, Crossroads); their right-angle corners become smooth
rounded bends. The waypoint data format is unchanged (integers, same schema), so
external `levels/*.json` files and localStorage customs stay compatible.

### Chosen approach

- One shared sampler in `js/path.js`: `sampleSpline(waypoints)` → dense pixel
  points. `buildPath` keeps its exact contract `{points, cells, cum, total}`;
  `points` become the samples, `cells` come from sample-based walking, and
  `cum`/`total` are recomputed over the samples.
- **Straight stays straight**: Catmull-Rom with collinear control points yields a
  straight line, so spawn/exit runs and long straights stay crisp; only corners
  bow out.
- Sampling density: subdivide each waypoint segment so sample spacing is ≤ ~5 px
  (e.g. `steps = max(8, ceil(segPx / 5))`). At cell = 50 px a corner bend is
  sampled ~20+ times — smooth at both game scale (50 px) and preview scale (10 px).
- `pointAtDistance` works unchanged on the dense polyline (linear interpolation
  between samples); enemy motion and tower targeting need no edits.

### Consumer impact (verified by reading the engine)

| File / function | Current | Phase 3 change |
|---|---|---|
| `js/path.js` `buildPath` | pixel points from waypoints, grid-step `walkPathCells` for cells | **rewrite**: `points` = spline samples; `cells` from new sample-based walker; `cum`/`total` over samples |
| `js/path.js` `walkPathCells` | grid-step walker (diagonal-safe) | **reimplement** on the sampled polyline: mark every cell a sample falls in (and both cells of a crossing sample step). Signature stays `walkPathCells(waypoints)` → `{cells, length, seq}` so `smoke_levels.mjs` keeps passing; it now samples internally |
| `js/path.js` `hasSelfIntersection` | cross-product rule on grid segments | **reimplement** as segment-segment intersection over non-adjacent sample pairs (with a small epsilon), same boolean return. Adjacent samples are skipped; the 3+ visits rule is replaced by the geometric test (a true loop always crosses) |
| `js/level_validate.js` `validateWaypoints` | rejects non-axis/45° segments | **relax**: drop the segment-shape check entirely (any non-zero segment OK — curves bow between waypoints); keep spawn x=-1, exit x=28, integer bounds, pure-data checks; self-intersection via the new sampled check |
| `js/levelgen_paths.js` `lgPathStats` | own inline grid walker (visits/crossovers/buildable) | **replace** with shared sample-based helpers from path.js (delete the inline walker) |
| `js/levelgen_ui.js` `lgCrossoverCells` | third inline grid walker | **replace** with the shared sample-based crossover test |
| `js/levelgen_ui.js` `lgDrawDiagram` | straight `lineTo` through cell centers at 10 px | draw the sampled spline (reuse `sampleSpline` scaled to 10 px) — previews show real curves |
| `js/render.js` `drawPath` | strokes `path.points` with round join/cap | **none** — dense samples already render smooth |
| `js/main.js`, `js/enemy.js`, `js/game.js`, `js/tower.js` | consume `buildPath` shape / `pointAtDistance` / `isPathCell` / `path.total` | **none** — contract preserved |
| `js/levels.js` (6 built-ins) | axis-aligned waypoint data | **none** as data; visually rounded via the spline |

Note: three separate inline grid walkers exist today (path.js, `lgPathStats`,
`lgCrossoverCells`). Phase 3 consolidates all into shared sample-based helpers in
`js/path.js`; forgetting a UI-side copy would break previews/stats silently.

### New generator templates (true curves)

Diagonal-era templates (`tplSCurve`, `tplDoubleBend`, `tplLoopSerpent`) become
control-point shapes that the spline bows into real arcs:

1. **Arc** — a long run with one wide offset bend (spine + single far waypoint):
   the spline renders a smooth highway curve. No crossover.
2. **S-Bend** — two opposing offsets in opposite rows: a smooth S through the
   grid. No crossover.
3. **Loop** — waypoints that make the polyline double back with an offset lane,
   producing a rounded hairpin/loop; the sampled self-intersection test still
   guards against accidental true crossings.
4. Keep `weave` + `crossroads` (crossover shapes) — their right angles become
   rounded too, and the crossover highlight must work on samples.

Pool: `arc`, `sbend`, `loop`, `weave`, `crossroads` (5 templates, 4 per Generate).

### Build order (increments)

1. [x] PLAN_generator.md phase-3 section (this file)
2. [x] `sampleSpline` + sample-based `walkPathCells`/`hasSelfIntersection` in
   `js/path.js`; scratch check in `tests/` (`tests/scratch_spline.mjs` PASS)
3. [x] validator relaxation in `js/level_validate.js`; scratch check
4. [x] consolidate `lgPathStats` + `lgCrossoverCells` onto shared helpers;
   `lgDrawDiagram` draws the spline
5. [x] new templates in `js/levelgen_paths.js` (arc/sbend/loop), pool swap;
   `tests/scratch_templates.mjs`: 200 seeds × 5 templates all validate
6. [x] update smoke tests (`smoke_levelgen.mjs` diagonal assertions → curve
   assertions: spline bow measured, straight/rounded/crossover/U-turn checks;
   `smoke_registry.mjs` diagonal-rejection case removed since diagonals are now
   legal spline control points; all bundles that load path.js now include
   utils.js for `cellCenter`); ALL 19 smoke tests green + both scratch tests
7. [x] `levels/README.md` wording (curves through waypoints) +
   `FILE_SUMMARY.md` updates, mark milestones

### Implementation notes (deviations from the original plan, all measured)

- **Centripetal Catmull-Rom (alpha = 0.5)**, not the uniform form. Uniform CR
  overshoots corners badly: on the Crossroads vertical branch it reaches
  min x=148 px (cell 2 — two cells outside the intended col 4); centripetal
  stays at x=225 px (cell 4). `crPoint(p0,p1,p2,p3,u)` in path.js implements
  the standard centripetal weights (a,b,c = sqrt of control-span lengths).
- **`hasSelfIntersection` is a sample-based cell-walk direction test**, not
  segment-segment intersection: each maximal run of samples inside one cell is
  a "visit" with its travel direction and next cell; the path is rejected only
  when two consecutive cells are each visited twice in (nearly) the same
  direction (dot > 0.9) — a real U-turn/double-back lane. Rounded corners that
  dip one cell sideways (single-cell wiggle) and angled crossovers pass.
  Verified: Serpentine/Gauntlet corner wiggles are single-cell only; true
  collinear double-walks are still caught.
- **`smoke_levelgen.mjs` bug found**: its bundle list omitted `js/utils.js`, so
  `cellCenter` is undefined once path.js calls it → crash on first
  `validateLevelDef`. Fix: add utils.js to the file list (in progress).

### Milestones (phase 3)

- [x] Spline sampling in path.js; `buildPath` contract unchanged
- [x] All three grid walkers consolidated onto sample-based helpers
- [x] Validator accepts arbitrary segment shapes; loops still rejected
- [x] Generator templates are true curves; previews render the spline
- [ ] Built-in levels visually rounded, data untouched (data already untouched;
      visual check in browser)
- [ ] smoke_levelgen + all 20 smoke tests green

## Phase 4 — UUID identity + silly names, no generator numbering, 2026-07-19

### Requirements (user)

1. Every level file the generator produces carries a **unique 128-bit UUID**
   (v4). The UUID is the identifier for the code; the name is for humans.
   Levels are shared between users, and the UUID is what keeps a shared level
   from being loaded twice as a duplicate.
2. The generator must **not** add level numbers to order saved files — ordering
   levels is not the generator's job. Drop the `NN_` filename prefix entirely.
3. Each generated level gets a **silly randomized 2-word name** (word + word,
   e.g. "Soggy Walrus"), and the user can change it before creating.
4. The UUID must **not be normally visible** to the user — it lives in the JSON
   for internal script use only (no UI display).
5. `tools/build_levels.mjs` must ensure **only unique levels are loaded**
   (duplicate UUID across files = build error), and if it finds a level file
   **without a uuid it adds one to the file**.

### Design

- **`js/levelgen_names.js`** (new, shared by generator page + smoke tests):
  - `lgUuid()` — RFC 4122 v4: `crypto.getRandomValues` when available,
    Math.random fallback (headless/file://). Lowercase hyphenated form.
  - `lgSillyName(rng)` — adjective + noun (2-word combos like "Gristly Pelican"),
    seeded from the candidate's RNG so names are stable per Generate press.
- **`js/level_validate.js`**: optional `uuid` field — must be a string matching
  the v4 pattern when present (pure-data gate already covers the type).
- **`js/levelgen_save.js`**: `lgBuildDef` stamps `uuid: lgUuid()` into every def;
  `lgFilename(name)` drops the index parameter and the `NN_` prefix
  (`Soggy_Walrus.json`); `lgCreateLevels` no longer reads `levelCount()`.
- **`js/levelgen_ui.js`**: on Generate each candidate gets a silly name
  (`cand._name = lgSillyName(cand._rng)`); preview cards show an editable text
  input prefilled with it (user can rename before Create). The old shared
  "Level name" form field and the manual `N 2`-suffix uniquification are gone —
  silly names are already distinct, and the UUID is the real identity.
- **`levelgen.html`**: removes the global name input; cards get the input style.
- **`js/level_custom.js`**: dedupe key switches from `name` to `uuid` —
  `saveCustomLevel` replaces an existing entry with the same uuid (legacy defs
  without a uuid fall back to name), `registerCustomLevels` skips registry
  levels whose uuid matches, and skips uuid-less defs already present by name.
- **`js/level_registry.js`**: `normalizeLevelDef` passes `uuid` through when
  present; the duplicate warning now fires on uuid (or name for legacy).
- **`tools/build_levels.mjs`**: after validation, any file lacking a `uuid`
  gets one generated (crypto.randomUUID) and is **written back to its .json
  file** (only that field is added — file order preserved via JSON round-trip);
  the build then rejects two files sharing a uuid (`duplicate level uuid`).
  The name-uniqueness error stays as a secondary check.
- **`levels/riverbend.json`**: gains its first uuid (written back by the build
  tool, committed). `js/levels_external.js` regenerated with the glue passing
  `uuid` through to the registry.
- **`levels/README.md`**: schema documents `uuid` (auto-added by the build tool
  if missing; the dedupe key when sharing), and play order is now just plain
  filename sort — no `NN_` prefix convention.

### What does NOT change

- The 6 built-in levels (`js/levels.js`) keep their hand-written names and gain
  no uuids — they are not files and are never shared; the registry dedupe only
  compares uuids when both sides have one.
- Progression/scores stay keyed by registry index (unchanged behavior).

### Build order (increments)

1. [x] PLAN_generator.md phase-4 section (this file)
2. [x] `js/levelgen_names.js` + validator uuid check; covered by smoke_levelgen
3. [x] `js/levelgen_save.js` + `js/levelgen_ui.js` + `levelgen.html`
4. [x] `js/level_custom.js` + `js/level_registry.js` dedupe by uuid
5. [x] `tools/build_levels.mjs` auto-uuid + uuid-dedupe; regenerated
   `levels_external.js` (riverbend.json got its uuid)
6. [x] smoke test updates (levelgen, build, registry, custom-store cases);
   full regression run — 23/23 green
7. [x] `levels/README.md` + `FILE_SUMMARY.md` updates, mark milestones

### Milestones (phase 4)

- [x] Generator files: uuid in JSON, no NN_ prefix, silly editable names
- [x] Build tool: missing uuids auto-added to .json files (only after the whole
      directory validates — a failing build never mutates files); duplicate uuid → exit 1
- [x] Runtime dedupe by uuid (localStorage + registry); legacy name fallback
- [x] All smoke tests green

### Implementation notes (deviations)

- `generatePathCandidates` now draws a per-candidate `_seed` from the master
  seed and builds each path with its own RNG (same output distribution, but
  each candidate has a stable seed for deriving extras like the silly name).
- The build tool's uuid write-back happens AFTER full-directory validation so
  an atomic failure never leaves a half-mutated `levels/` folder.
