# Security Audit — Tower Defense

Static audit of the whole codebase (28 `js/` files, 2 HTML pages, `tools/`,
`levels/`). Read-only analysis; no code was modified. Findings are proposals
only — nothing here has been changed.

## Scope & threat model

- The game is a **static client-side app**: two HTML pages loading classic
  `<script>` tags in dependency order, designed to run from `file://`. There is
  **no server, no network access, no fetch/XHR, no external resources** — so
  there is no remote attack vector. The practical threat model is:
  1. **Attacker-supplied level files**: a malicious `levels/*.json` dropped
     into the repo (shared levels are the documented use case) and run through
     `tools/build_levels.mjs`, or hand-edited `js/levels_external.js`.
  2. **Hand-crafted localStorage**: an attacker who can write to the victim's
     browser profile (or a "level share" pasted into devtools) planting
     entries in `towerDefenseCustomLevels.v1`, re-registered at boot by
     `js/level_custom.js` (auto-runs at script load, L67–69).
  3. **Malicious level-generator output** saved via the File System Access API
     (same shape as #2 once mirrored to localStorage).
- Worst case under this model is a **self-inflicted hang of the victim's own
  tab or build process** (DoS), not remote compromise. Severity below is
  framed accordingly.
- The effective trust boundary for all untrusted input is
  `validateLevelDef` (`js/level_validate.js`): a pure-data gate
  (`checkPureData`) plus field checks, applied at **build time** (vm realm in
  `tools/build_levels.mjs`, so build and runtime rules can't drift) and again
  **at boot** (generated glue + `registerCustomLevels`). This matches the
  intended model documented in `PLAN_Levels.md` ("Result" section) and
  `levels/README.md` ("Security notes"). UI clamps on the generator page
  (`lgMoney` ≥ 0, `lgWaves` 1..50) are convenience only — hand-crafted JSON
  bypasses them, which is where the gaps below live.

## Findings

### M-1 (Medium) — Unbounded waypoint count → quadratic validation cost (DoS)

**Where:** `js/level_validate.js` (`validateWaypoints`) imposes no cap on the
number of waypoints; `js/path.js` does the expensive work.

**Why it matters:** validation cost grows super-linearly in waypoint count n:
- `sampleSpline` emits `max(8, ceil(segLen/5px))` samples per segment
  (`js/path.js` L31–50). The grid is 28×18 at 50 px/cell, so the longest
  possible segment (spawn corner → exit corner, ~1680 px) yields ~340 samples.
  Total spline work is O(n · 340).
- `hasSelfIntersection` (`js/path.js` L105–139) walks every sample into a
  per-cell visit list, then does **pairwise** same-direction comparison per
  cell: a path re-entering one cell k times costs O(k²). A zig-zag packed into
  a few cells makes k ≈ n.

A hand-crafted level with ~100k waypoints (≈1 MB of JSON — the build tool's
`MAX_BYTES` cap limits input size, not the quadratic work) hangs:
- **the browser tab at boot** — `registerCustomLevels()` runs automatically
  when `js/level_custom.js` loads, before any UI; localStorage allows ~5 MB,
  so even larger payloads fit;
- **the Node build process** — `tools/build_levels.mjs` has no timeout on the
  validation step.

**Impact:** DoS of the victim's own tab (unresponsive page) or build machine.
No code execution, no data loss.

**Fix (proposal):** cap waypoint count in `validateWaypoints` — a sane path on
a 28×18 grid needs far fewer than 200 waypoints; reject with a clear problem
message. Optionally add a per-cell visit cap in `hasSelfIntersection` as
defense in depth.

### L-1 (Low) — `totalWaves` has no upper bound

**Where:** `js/level_validate.js` L97: only `isInt && >= 1`.

**Why it's low, not medium:** waves are built **lazily** per wave in
`WaveManager.startNext` (`js/wave.js` L66) — there is no pre-allocation of all
waves, so a huge `totalWaves` costs memory O(1). Worst case is an
effectively-unwinnable level (procedural fallback keeps generating waves with
ever-scaling HP), not a crash. Still, the validator should cap it (e.g. ≤ 50,
matching the generator's own UI clamp) so hand-crafted defs can't smuggle in
nonsense values.

### L-2 (Low) — Enemy keys in `waves` not whitelisted by the validator

**Where:** `js/level_validate.js` L106: each `waves[w]` entry is checked only
as `typeof k === 'string'`, not against the `ENEMY_TYPES` keys.

**Why it's low:** at runtime `buildWave` **drops** unknown keys with a
`console.warn` (`js/wave.js` L21–24) — never a crash, never an `Enemy`
constructed with a bad type (the procedural fallback also only emits known
keys from `Object.keys(ENEMY_TYPES)`). So the behavior is safe but
suboptimal: a level file with typos like `"norma1"` silently loses enemies at
play time instead of failing at import/build. Whitelisting the keys in
`validateLevelDef` would fail fast with a readable problem list, and keeps the
build-time and runtime gates honest (same-realm vm check already exists).

### I-1 (Info) — No CSP meta tag

Neither HTML page declares a Content-Security-Policy. Given the app loads only
local classic scripts and zero external resources, this is hardening, not a
vulnerability: there is no network sink to constrain. A strict local-only CSP
(`script-src 'self'; object-src 'none'`) would be cheap insurance if the game
ever moves to http(s) hosting.

### I-2 (Info) — Save-before-validate ordering in the generator

`lgCreateLevels` (`js/levelgen_save.js` L72–75) calls `saveCustomLevel(def)`
**before** `registerLevel(def, …)` validates. A def that fails validation is
still persisted to localStorage; at boot it is rejected by
`registerCustomLevels` (validation gate), so there is **no execution risk** —
but garbage accumulates in storage and the save path can diverge from what the
game actually plays. Swapping the order (or removing the mirror entry when
registration fails) would keep the store clean.

### I-3 (Info) — Unguarded `ENEMY_TYPES[typeName]` in the Enemy constructor

`js/enemy.js` L7 does `def = ENEMY_TYPES[typeName]` with no guard; an unknown
type would throw. Unreachable today because both spawn sources
(`buildWave`, `composeWaveList`) only emit known keys (see L-2). A one-line
guard (warn + skip, or fall back to `'normal'`) would make the constructor
robust on its own — defense in depth.

### I-4 (Info) — `startMoney` unbounded

`js/level_validate.js` checks `startMoney` as a non-negative integer with no
upper bound. A hand-crafted level can grant any amount of money; this is a
gameplay balance issue, not a security one (no overflow path — JS numbers,
money only feeds into cost comparisons). A cap would match the generator UI.

## Positive controls (verified solid)

- **No code execution from level data.** `tools/build_levels.mjs` parses with
  `JSON.parse` only, then re-serializes with `JSON.stringify` into a data-only
  generated script — no `eval`, no `Function`, no raw text copy. Grep confirms
  the only `innerHTML` sinks in `js/` are fed by static config (`TOWER_TYPES`,
  `ENEMY_TYPES`, `formatMoney`) or hex colors; level names render via
  `textContent`; `js/render.js` is canvas-only.
- **Double validation at the trust boundary.** Every external/custom def passes
  `validateLevelDef` at build time (in a vm realm, so prototype checks match
  the runtime) and again at boot — tampering with `levels/*.json` after a
  build still fails at boot.
- **Pure-data gate.** `checkPureData` rejects anything but
  null/string/finite-number/boolean/array/plain-object with nesting ≤ 64 —
  hostile hand-built defs (Date, NaN, exotic prototypes) are rejected before
  any field check runs.
- **Atomic build.** Any validation failure in any file aborts the whole build
  with all problems listed and leaves the previous generated file untouched;
  1 MB per-file cap; duplicate uuid/name → build error; missing uuid auto-
  backfilled after full validation.
- **Defensive persistence.** All five localStorage stores
  (`towerDefenseProgress.v1`, `towerDefenseScores.v1`, `towerDefenseTutorial.v1`,
  `towerDefenseMuted.v1`, `towerDefenseCustomLevels.v1`) are parsed in
  try/catch with normalization/clamping (`normalizeProgress` clamps
  `unlocked` to 1..levelCount; `normalizeScores` filters non-finite values) —
  corrupt storage degrades to defaults, never throws.
- **No network surface.** No fetch/XHR/WebSocket/external URLs anywhere;
  `file://`-only design; AudioContext is created lazily on user gesture.
- **Safe unknown-key handling at runtime** (L-2): dropped with a warning,
  never a crash; extra explicit waves beyond `totalWaves` warned + ignored.
- **UUID dedupe** across registry entries warns on duplicate identity.

## Recommended fixes (priority order)

1. Cap waypoint count in `validateWaypoints` (fixes M-1 — the only real DoS).
2. Whitelist enemy keys in `waves` against `ENEMY_TYPES` (L-2, fail-fast).
3. Cap `totalWaves` (≤ 50) and `startMoney` in `validateOptionalFields` (L-1, I-4).
4. Reorder save-after-validate in `lgCreateLevels` (I-2).
5. Optional hardening: per-cell visit cap in `hasSelfIntersection`, one-line
   guard in `Enemy` constructor (I-3), CSP meta tag if ever hosted (I-1).

All items are proposals — apply only on request.
