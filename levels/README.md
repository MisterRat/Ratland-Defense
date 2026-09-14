# Levels — the .json format (backup & sharing)

Levels **live in the browser's localStorage**, not in this folder. The game
loads them dynamically at startup from the store (`js/level_custom.js`), so a
created or imported level is playable immediately and survives reloads — no
build step, no generated files.

This folder holds `.json` level files as the **backup and sharing format**:

- **Export** (on the [level generator page](../levelgen.html)) downloads all of
  your stored levels as one `.json` array file — keep it here or send it to a
  friend.
- **Import** (same page) brings levels in from any `.json` file: an export
  file, or individual level files like `riverbend.json`. Every entry is
  validated with the game's own validator; duplicates (same uuid) are skipped;
  invalid entries are reported and skipped.

## To add a level

1. Open the [level generator page](../levelgen.html).
2. Generate candidates, check the ones you want, press **Create**. The levels
   are saved to this browser's store and appear in the game's dropdown — done.
3. (Optional) Press **Export** to keep a `.json` backup of everything in your
   store, or to share it.

## To get someone else's level

1. Get their `.json` file (an export file, or single files like this folder's).
2. On the generator page press **Import** and pick the file(s). New levels are
   added to your store and playable immediately; ones you already have (same
   uuid) are skipped.

## How the game loads them at startup

`js/level_custom.js` reads the localStorage store (`towerDefenseCustomLevels.v1`),
re-validates every def with `validateLevelDef`, and registers the survivors in
the level registry after the built-ins. The unlock floor counts stored levels,
so custom levels are always playable. A fresh browser (or a cleared
localStorage) starts with just the 6 built-in levels — import your backup to
get the rest back.

## File format

Each file is pure data — JSON, never code. Either:

- a **single level object** (like `riverbend.json`), or
- an **array of level objects** (what Export produces).

| Field | Type | Default | Meaning |
|---|---|---|---|
| `name` | string | **required** | Display name in the dropdown and banner (for humans). May repeat — it is not the level's identity. |
| `uuid` | string (v4) | auto-stamped on import if missing | The level's machine identity: a 128-bit v4 UUID. Importing a file whose uuid you already have is skipped (a shared level loaded twice). Not shown in the game UI. |
| `waypoints` | `[[x, y], ...]` | **required** | Grid coords on the 28×18 grid. `x=-1` = spawn, `x=28` = exit. The path is a **Catmull-Rom spline through the waypoint cell centers**: straight runs stay straight, corners become smooth rounded curves (centripetal form — no overshoot). Any non-zero segment shape is allowed (axis-aligned, diagonal, or angled); the curve bows between waypoints and may round into neighboring cells. Angled crossovers (a cell walked twice in different directions) are allowed; U-turns / double-back lanes (the same consecutive cells re-walked in the same direction) are rejected. |
| `difficulty` | string | `normal` | One of `easy, normal, hard, nightmare`. Scales procedural waves (HP/money multipliers) and sets the dropdown label. |
| `startMoney` | number | table default | Money on a fresh start of this level. |
| `totalWaves` | number | `12` | Waves to clear the level; drives "Wave n/N" and the win check (max 50). |
| `waves` | array, optional | procedural generator | Explicit per-wave enemy lists, e.g. `[["normal","tank"], ...]`. Wave *i* uses `waves[i-1]`; if the list is shorter than `totalWaves`, later waves fall back to the generator; extra entries are ignored (warned). Enemy type keys: `normal, tank, hot, wet, fast, camo, fission, spore, bolt, bulwark, mender, wisp, boss` — unknown keys are dropped with a console warning, never a crash. |
| `towers` | array, optional | all towers allowed | Tower **roster**: when present, ONLY these towers are buildable on the level (a restriction layer on top of the `unlockLevel` gate). Every entry must be a valid tower type key (`basic, frost, flame, cannon, sniper, railgun, tesla, venom, reaper, mint, warden, mortar`). Absent = every unlocked tower is buildable. The level generator page writes this field from its tower checkboxes. |

## Security notes

- Level files are parsed with `JSON.parse` only and validated with the game's
  own `validateLevelDef`, which includes a pure-data gate (only
  null/string/number/boolean/array/plain-object values, finite numbers,
  bounded nesting) — a level file **cannot** execute code.
- Every entry is re-validated at game boot when the store is loaded, so the
  runtime trust boundary holds even if a stored def were tampered with.

## Notes

- Enemy **availability** is not part of the level file — it stays driven by
  `unlockLevel` in `js/config.js`, keyed to the level's position (explicit
  `waves` lists are the exception: they spawn exactly what they list).
- Tower availability has two layers: the positional `unlockLevel` gate plus
  the optional per-level `towers` roster above. By level 7 everything is
  already unlocked, so later levels can use all types unless a roster
  restricts them.
- See `riverbend.json` for a complete working example (custom waves and a
  `uuid` included).