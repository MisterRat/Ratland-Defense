# Plan: Importable Levels (External Level Files)

## Goal
Let new levels be added as **external files in a `levels/` subfolder** without touching game code.
The first 6 levels stay hard-coded in `js/levels.js` exactly as they are today.

## Hard constraints (from project rules)
- Game must keep working when `index.html` is opened directly from disk (`file://`) —
  no local web server, no build step, no dependencies.
- Every file ≤ 300 lines; each concern in its own module.
- No breaking changes to levels 1–6 (waypoints, money, waves, unlocks all unchanged).

## Format decision: self-registering JS files (not JSON)
Chosen after weighing the options against the `file://` constraint:

| Option | Works from file://? | Verdict |
|---|---|---|
| Plain JSON + `fetch()` | **No** — fetch is blocked on file:// | Rejected |
| ES modules (`import`) | **No** — modules are CORS-blocked on file:// | Rejected |
| Self-registering JS files loaded via `<script>` tags | **Yes** — classic scripts work fine on file:// | **Chosen** |

Each external level is a small JS file that calls one global function:

```js
// levels/07_riverbend.js
registerLevel({
  name: 'Riverbend',
  waypoints: [
    [-1, 1], [6, 1], [6, 8], [2, 8], [2, 15], [14, 15], [14, 5],
    [21, 5], [21, 12], [28, 12],
  ],
});
```

A manifest file (`levels/index.js`) lists which level files exist, in play order:

```js
// levels/index.js — the only file you edit to add/remove external levels
const LEVEL_MANIFEST = [
  '07_riverbend.js',
];
```

Adding a level = drop one new file in `levels/` + add one line to the manifest.
No game code changes, no renumbering, no server.

## Level schema
Every level — built-in or external — normalizes to this shape (the built-in
6 get the same treatment via defaults, so the rest of the game sees one type):

| Field | Type | Default | Meaning |
|---|---|---|---|
| `name` | string | required | Display name in the dropdown and banner. |
| `waypoints` | `[[x, y], …]` | required | Grid coords; x=-1 spawn, x=cols exit (28×18 grid). Axis-aligned segments only. |
| `startMoney` | number | `levelStartMoney(index)` — current table logic | Money on a fresh start of this level. |
| `totalWaves` | number | `TOTAL_WAVES` (12) | Waves to clear the level. Drives HUD "Wave n/N" and the win check. |
| `waves` | array, optional | procedural (`buildWave`) | Explicit per-wave enemy lists, e.g. `[[ 'normal','normal','tank' ], …]`. When present, wave i uses `waves[i-1]` instead of the generator. Each entry is a list of enemy type keys; types are still gated by `unlockLevel` (see below). |

Optional fields keep existing levels 1–6 byte-for-byte identical in behavior:
their defaults reproduce today's exact values (`LEVEL_START_MONEY` table,
12 waves, procedural composition).

### Rules for external level authors
- `name` and `waypoints` are required; everything else is optional.
- Waypoint rules are the same as today's levels (validated, see Phase 3):
  spawn at x=-1, exit at x=cols, axis-aligned, no U-turns/loops —
  perpendicular 90° crossovers allowed.
- Enemy type keys in `waves` must exist in `ENEMY_TYPES`; unknown keys are
  dropped with a console warning (never crash the game on a bad level file).
- Tower/enemy **availability is NOT part of the level file**: it stays driven
  by the existing `unlockLevel` fields in `config.js`, keyed to the level's
  position in the combined list. External level 7 = "level 7" for unlock
  purposes (all towers/enemies already unlocked). This keeps balance rules in
  one place and prevents level files from silently redefining enemy stats.

## How levels combine: one ordered list
- Built-in levels 1–6 come first, in their current order (unchanged).
- External levels follow, in manifest order.
- The combined list is the single source of truth for: the dropdown,
  `levelIndex` (0-based), unlock progression, per-level best scores,
  carry-over money, and auto-advance.

```
index:  0    1    2    3    4    5   |  6      7      8 ...
        Snake … Crossroads          | Riverbend … (manifest order)
        (js/levels.js, unchanged)   | (levels/*.js via registerLevel)
```

Consequences that fall out automatically:
- Unlock chain continues: beating Crossroads unlocks the first external level.
- `beatenAll` fires only after the last level in the combined list is beaten.
- Per-level best scores keep working: they're keyed by index, and indices of
  built-in levels never shift (externals are always appended).

## Architecture: files touched

### New files
| File | Responsibility | Est. lines |
|---|---|---|
| `js/level_registry.js` | `registerLevel(def)`: validates + normalizes a level def, appends to the combined list. Also `getLevels()` (combined list), `levelCount()`. Loaded right after `js/levels.js`; seeds the list from the built-in `LEVELS`. | ~90 |
| `js/level_validate.js` | Pure validation: waypoint shape (array of 2-int arrays, spawn/exit rules, axis-aligned), name, optional fields. Returns `{ok, problems[]}`. Shared by the registry (console warnings) and smoke tests. | ~70 |
| `levels/index.js` | Manifest: `LEVEL_MANIFEST = [ '07_....js', … ]`. Data only. | ~10 |
| `levels/07_example.js` | First external level + living documentation of the format. | ~15 |

### Modified files (all small, surgical)
| File | Change |
|---|---|
| `index.html` | Add `<script src="js/level_registry.js">` after `js/levels.js`, and `<script src="levels/index.js">` + one script tag per manifest entry **after** the registry. (Manifest entries are static `<script>` tags — see "Loading" below.) |
| `js/main.js` | Replace direct `LEVELS` reads with registry access: `getLevels()` for bounds/dropdown count, `getLevel(i)` for name/waypoints/money/waves in `loadLevel`, `onWin`, auto-advance. `levelWaypoints(i)` stays as a thin wrapper over the registry so existing smoke tests keep working. |
| `js/ui.js` | `buildLevelSelect()` iterates `getLevels()` instead of `LEVELS`. `waveMax` is set from the *current* level's `totalWaves` (in `syncLevelSelect`), not the global `TOTAL_WAVES`. |
| `js/game.js` / `js/wave.js` | Win check and wave cap use the level's `totalWaves` (passed in at construction) instead of the global `TOTAL_WAVES`; `buildWave` accepts an explicit wave list override. Global `TOTAL_WAVES` remains as the default. |
| `js/progress.js` | `normalizeProgress` clamps against `getLevels().length` instead of `LEVELS.length`. |
| `smoke_levels.mjs` | Extend: (a) existing 6 levels still validate and simulate identically; (b) a synthetic external level registered at runtime passes validation and plays wave 1; (c) a deliberately broken level file is rejected with problems, not a crash. |

### Loading model (why static script tags)
The manifest (`levels/index.js`) declares filenames, but `file://` can't fetch
them dynamically. So the manifest is the *authoring* list, and `index.html`
contains the matching `<script src="levels/NN_name.js">` tags in the same
order. To add a level: drop the file, add its line to `levels/index.js`
(documentation of intent), and add the one script tag to `index.html`.
The registry cross-checks at boot: if a manifest entry has no matching
registered level (script tag missing) or vice versa, it logs a clear warning.
This keeps zero runtime file I/O — the browser's own script loading does the
work, which is exactly what makes file:// work.

(If a local server ever becomes acceptable, a `fetch`-based loader could read
the manifest dynamically and replace the static tags; the registry API would
not change.)

## Progress log
- **Phase 1 DONE** (smoke_registry.mjs PASS): `js/level_validate.js` +
  `js/level_registry.js` created and loaded in index.html; registry seeds from
  built-in LEVELS unchanged; registerLevel normalizes/rejects correctly
  (17 bad-def modes rejected, crossover accepted). Bug found+fixed: diagonal
  waypoints made `hasSelfIntersection` loop forever (it assumes axis-aligned) —
  validator now early-returns on a diagonal before calling it.
- **Phase 2 DONE** (full regression run): wave.js takes per-level
  `totalWaves` + optional explicit `waves` list (unknown enemy keys dropped
  with a warning; extra entries warned); game.js pulls money/waves from the
  registry (`startMoney()`, `WaveManager(levelIndex, totalWaves, waves)`);
  progress.js clamps to `levelCount()`; main.js + ui.js read `getLevels()`/
  `getLevel(i)`; waveMax now per current level. All smoke bundles include the
  registry. Regression: 13/14 pass — the only failure (smoke_railgun) is the
  known pre-existing stale config assertion (expects cost 400 vs current 300,
  documented in PLAN.md), unrelated to levels.
- **Phase 3 DONE** (smoke_levels.mjs PASS): `levels/` created with
  `index.js` (manifest) + `07_riverbend.js` (Riverbend: 10 waypoints, 6
  explicit waves incl. a boss wave); script tags in index.html; manifest
  cross-check verified in both drift directions (missing tag / missing
  manifest line → warning). smoke_levels.mjs now loads the real levels/ files:
  7 total levels, external level validates, wave-1 queue matches its explicit
  list. Found+fixed during this phase: external script tags must come AFTER
  js/path.js (validation reuses `hasSelfIntersection`) — moved them after
  js/game.js in index.html. New smoke_boot.mjs loads index.html's exact
  script order headlessly: PASS, no drift warnings.
- **Phase 4 DONE** (docs + final pass): `levels/README.md` written
  ("How to add a level" + schema table). Final regression: 15/16 smoke tests
  pass; the one failure is the pre-existing stale railgun config assertion.
  All files ≤ 300 lines (largest: ui.js 246). Built-in levels 1–6 unchanged
  (waypoints, money table, 12 procedural waves — verified by smoke_levels and
  smoke_money/smoke_progress passing unmodified in behavior).
- **Final regression (incl. legacy smoke3)**: 15/17 pass. game.js gained a
  `levelDef()` guard (`typeof getLevel === 'function'`) so bundles without the
  registry fall back to the old tables — behavior-identical. The 2 failures
  are the documented pre-existing ones (smoke3: places $200 of towers on a
  $100 start; smoke_railgun: expects cost 400 vs current 300) — both verified
  unrelated to this work.
- **Stale smoke assertions fixed** (follow-up): smoke_railgun's expected
  railgun cost updated 400 → 300 (config was rebalanced; the test's other
  assertions were already current). smoke3 now starts with the default $100
  plus a +$100 win carry-over (a legitimate in-game state) so all 4 Guns
  build, and asserts the exact post-build balance. Full regression:
  **18/18 smoke tests pass** (smoke_*.mjs + legacy smoke3.mjs).
- **Security migration DONE — pure-data JSON levels** (full regression 19/19):
  level files are no longer executable `<script>` tags. `levels/index.js` is
  now the import engine: `importLevelText(text, filename)` (pure pipeline:
  ≤1 MB check → JSON.parse → registerLevel → duplicate-name skip) and
  `importLevelFiles(fileList, done)` (FileReader.readAsText batch, one bad
  file never blocks the rest). `levels/07_riverbend.js` → `levels/07_riverbend.json`
  (pure data; .js deleted). index.html: one `<script src="levels/index.js">`
  after level_registry.js, no per-level script tags; HUD gained 📂 Load Levels
  button + hidden file input (multiple, .json). ui.js `bindLoadLevels()`:
  picker → importLevelFiles → message-bar summary; on success unlocks the full
  list (imported = user-chosen, immediately playable) + refreshes dropdown.
  level_registry.js: checkManifest/LEVEL_MANIFEST removed (nothing to
  cross-check — no boot-time level loading). Tests: smoke_boot now expects 6
  levels at boot + import engine present; smoke_levels imports the real .json
  through importLevelText (same pipeline as the game); new smoke_import.mjs
  covers malformed JSON, non-object tops, oversize, invalid defs, duplicate
  skip, and batch isolation (1 good + 3 bad files). A malicious level file can
  at worst be rejected — JSON.parse produces only data; no eval/Function.
  Known limitation: imported levels do not persist across reloads (re-load the
  files); optional Phase 2 = localStorage persistence with try/catch guards.
 - **Generated-file migration DONE — auto-load at boot** (full regression 19/19):
   user removed the "no build step" constraint, so external levels now load
   automatically from a generated script instead of a Load Levels button.
   `tools/build_levels.mjs` (Node — already required for all smoke tests; no
   new runtime) reads `levels/*.json` sorted by filename, and for each:
   ≤1 MB → JSON.parse → top-level-object check → duplicate-name check →
   `validateLevelDef` (loaded in a vm realm so build-time and runtime rules
   can never drift — parsing happens INSIDE the realm because the pure-data
   gate compares prototypes, which only match same-realm). On any error it
   prints all problems and exits 1 WITHOUT writing (atomic). On success it
   emits `js/levels_external.js`: a fixed header + `var LEVELS_EXTERNAL = [ … ]`
   (JSON.stringify output, `_source` per entry) + a registration loop calling
   the existing `registerLevel`. index.html: one static `<script src=
   "js/levels_external.js">` after level_registry.js (never edited per level);
   Load Levels button + file input removed from HUD; `levels/index.js` runtime
   import engine and smoke_import.mjs deleted (dead code). ui.js lost
   `bindLoadLevels()` (274 → 245 lines). New security gate in
   `js/level_validate.js`: `checkPureData` — a def must be pure data only
   (null/string/finite number/boolean/array/plain object, nesting ≤ 64) before
   any field check runs; JSON.parse output always passes, but hostile
   hand-built defs (Date, NaN, prototypes) are rejected. smoke_boot now runs
   the build first and expects 7 levels at boot (Riverbend index 6, totalWaves
   6); smoke_levels bundles `js/levels_external.js` instead of importing; new
   smoke_build.mjs covers happy path, malformed JSON (exit 1 + no output),
   duplicate names, empty dir (valid empty array), and the pure-data gate.
   README rewritten: workflow = drop `.json` in `levels/` → run generator →
   reload; `.json` stays the shareable artifact, the generated file is a local
   build product ("do not edit").
 - **BUG FIXED — external level missing in browser** (full regression 19/19):
   user's browser console showed `ReferenceError: hasSelfIntersection is not
   defined` from levels_external.js. Root cause: the generated file was loaded
   BEFORE js/path.js (which defines hasSelfIntersection), and its registration
   glue called registerLevel → validateLevelDef → validateWaypoints →
   hasSelfIntersection. The smoke tests never caught it because they join all
   scripts into ONE blob before executing — top-level function declarations
   hoist across the whole blob, so path.js's functions were "already there".
   Separate `<script>` tags in a browser do NOT hoist across each other.
   Fix: (a) index.html now loads levels_external.js AFTER js/path.js (with a
   comment saying why); (b) the generator now emits SELF-CONTAINED glue — an
   IIFE that validates via validateLevelDef and pushes directly onto the
   registry's `_levels` (mirroring normalizeLevelDef), instead of calling
   registerLevel; (c) smoke_boot.mjs gained an ORDER GUARD asserting
   levels_external.js loads after level_validate.js, level_registry.js AND
   path.js in index.html — this is what should have caught the bug. Also added
   a browser-faithful check (each script tag executed as its own top-level
   script, in HTML order) confirming 7 levels with no throws. Follow-up (user is on Windows): added
   `tools/build_levels.bat` — double-clickable wrapper that cd's to the project
   root, checks Node.js is installed/on PATH (friendly error + pause if not),
   runs the generator and keeps the window open; README step 2 now leads with
   it and explains what a `.mjs`/Node.js is for first-time users.

## Result
Importable level files are implemented and **safe to share**: levels are pure
JSON data in `levels/`, compiled by `node tools/build_levels.mjs` into
`js/levels_external.js`, which auto-loads at boot (see levels/README.md).
Adding a level = create a `.json` file + run the generator. Built-in levels
1–6 unchanged; external levels append after them. No code execution is
possible from a level file: JSON.parse → pure-data gate → schema validation →
JSON.stringify re-serialization, validated again at boot.

## Implementation phases (small increments, tested after each)

### Phase 1 — Registry + validation core (no behavior change yet)
1. Create `js/level_validate.js`: pure `validateLevelDef(def)` → `{ok, problems}`.
   Checks: name (non-empty string), waypoints (≥2 points, ints, spawn x=-1,
   exit x=cols, axis-aligned segments, rows within 0..rows-1, no U-turn/loop —
   reuse `hasSelfIntersection` semantics), optional fields' types/ranges.
2. Create `js/level_registry.js`:
   - `registerLevel(def)`: validate → normalize (fill defaults from current
     tables) → push to internal list; on failure log problems and return null.
   - Seed: after the built-in `LEVELS` are loaded, the registry wraps them as
     normalized levels with their existing values (so indices 0–5 are identical
     to today).
   - `getLevels()`, `getLevel(i)`, `levelCount()`.
3. Load both scripts in `index.html` (registry after `levels.js`). **Nothing
   else changes yet** — the game still reads `LEVELS` directly.
4. Smoke test `smoke_registry.mjs`: register a good def, a bad one (each
   failure mode), confirm normalization defaults and that built-in levels 0–5
   are unchanged. Run it.

### Phase 2 — Switch the game to the registry
5. `js/main.js`: use `getLevel(i)`/`levelCount()` in `loadLevel`, `onWin`,
   auto-advance; keep `levelWaypoints(i)` as a wrapper.
6. `js/ui.js`: dropdown from `getLevels()`; `waveMax` per current level.
7. `js/game.js` + `js/wave.js`: per-level `totalWaves`; optional explicit
   `waves` list override in `buildWave` (unknown enemy keys dropped + warned).
8. `js/progress.js`: clamp to `levelCount()`.
9. Re-run ALL existing smoke tests (`smoke_levels`, `smoke_levelselect`,
   `smoke_money`, `smoke_progress`, …) — levels 1–6 must behave identically.
   Fix regressions before moving on.

### Phase 3 — External level files + manifest
10. Create `levels/` with `index.js` (manifest) and `07_example.js`
    (a valid, interesting path; include a small custom `waves` list to
    exercise the override).
11. Add the script tags to `index.html`; registry boot cross-check warns on
    manifest/tag mismatches.
12. Extend `smoke_levels.mjs`: load the real `levels/` files into the vm
    sandbox (same pattern as existing tests), validate every registered level,
    and simulate wave 1 on the external level. Run it.

### Phase 4 — Documentation + polish
13. Add a short "How to add a level" section to this file's top or a
    `levels/README.md` (one paragraph + the schema table).
14. Final pass: open `index.html` from disk, verify dropdown shows 7 levels,
    beat Crossroads → external level unlocks, wave counter matches its
    `totalWaves`, best score recorded for it.

## Risks & edge cases
- **Bad level file shipped**: registry validation + console warning; a broken
  file must never break built-in levels (registration failure is isolated).
- **Duplicate names**: allowed but warned (dropdown shows both, index is the
  real identity).
- **Manifest/tag drift** (file added, tag forgotten, or vice versa): boot-time
  cross-check logs which filename is missing where.
- **`waves` list shorter than `totalWaves`**: pad with procedural waves;
  longer: extra entries ignored (warned).
- **Progress saved with fewer levels**: `normalizeProgress` already clamps to
  the current count, so old saves keep working when externals are added.
- **300-line limit**: all new files are small; the largest touched file
  (`main.js`, 203 lines) only swaps a few `LEVELS[i]` reads for `getLevel(i)`
  calls — no growth expected.

## Out of scope (for now)
- Level editor UI (drawing paths in-browser) — could build on the same
  registry later.
- Per-level enemy/tower stat overrides (balance stays in `config.js`).
- Server-based dynamic loading (see Loading model note).
