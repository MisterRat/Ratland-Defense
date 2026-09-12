# How to add a level (external level files)

Levels in this folder are **pure data** — JSON files, never code. A small
utility reads them all and generates `js/levels_external.js`, which the game
loads like any other script at boot. Nothing here is ever executed as written:
the utility parses each file with `JSON.parse`, validates it with the game's
own validator (which includes a pure-data gate), and re-serializes it with
`JSON.stringify` into a data-only script — so a malicious `.json` can never
inject code, and every entry is validated **again** at game boot.

The first 6 levels stay hard-coded in `js/levels.js`; external levels are
**appended** after them (external level 1 = "level 7" for best scores and the
dropdown). External levels are **always unlocked** — no winning required — and
play order is **by difficulty first** (easy → normal → hard → nightmare), then
**alphabetically by name**, so you meet the easier external levels before the
hard ones. No numbering or filename convention is needed (ordering levels is
not a level file's job).

Every level carries a **`uuid`** (a 128-bit v4 UUID) that is its identity for
the code — the name is for humans and may repeat. The uuid is what keeps a
level you received from someone else from loading twice as a duplicate: if two
files in this folder share a uuid, the build fails. If a file has no uuid, the
build tool generates one and writes it back into the file for you.

## To add a level

1. **Create a `.json` file** in this folder, e.g. `myname.json`:

    ```json
    {
      "name": "My Name",
      "waypoints": [
        [-1, 9], [4, 9], [4, 3], [10, 3], [10, 14], [16, 14],
        [16, 7], [22, 7], [22, 12], [28, 12]
      ]
    }
    ```

    (No `uuid` needed — the build tool adds one for you. If the file came
    from the level generator or from another player, it already has one.)

2. **Run the generator** — one of these:

    - **Windows (easiest): double-click `tools\build_levels.bat`.** It finds
      Node.js, runs the generator from the right folder, and keeps the window
      open so you can read the result.
    - **Any OS, from a terminal:** type this command in the project root —
      the folder that contains `index.html` (this game's top folder, *not*
      this `levels/` folder):

      ```
      node tools/build_levels.mjs
      ```

      The `.mjs` is just a plain-text program run by **Node.js**. If you don't
      have it: download the installer from <https://nodejs.org> and run it,
      then verify with `node --version`. (The Windows `.bat` checks this for
      you and tells you what to do if it's missing.)

    You should see a line like `build_levels: wrote levels_external.js —
    2 level(s): …`. If anything is wrong with a `.json` file, it lists every
    problem and changes nothing (a bad file never produces a half-generated
    output).

3. **Reload the game page** in your browser. Your new level appears in the
   dropdown. That's it — no game code changes, no renumbering, no editing
   index.html.

## Sharing levels

Send someone the `.json` file. They drop it into `levels/`, run the generator
(double-click `tools\build_levels.bat` on Windows, or `node tools/build_levels.mjs`
anywhere), and reload. The `.json` is the shareable artifact;
`js/levels_external.js` is a local build product (marked "do not edit" — hand
edits are overwritten on the next build).

If they already have that level (same `uuid`), the build fails with a
"duplicate level uuid" error — remove the extra copy. The uuid, not the name,
is what identifies a shared level.

## Security notes

- Level files are parsed with `JSON.parse` only, then re-serialized with
  `JSON.stringify` into the generated file. There is no `eval`, no `Function`,
  no raw text copy — a level file **cannot** execute code.
- Each file is checked: ≤ 1 MB, valid JSON, top level is an object, then the
  full schema validation (`js/level_validate.js`), which includes a pure-data
  gate (only null/string/number/boolean/array/plain-object values, finite
  numbers, bounded nesting).
- The build is atomic: any failure in any file aborts the whole build with a
  list of problems and leaves the previous generated file untouched.
- Every entry is validated at game boot by the generated file itself (using
  the game's own `validateLevelDef`), so the runtime trust boundary holds even
  if a `.json` file were tampered with after building.

## Schema

| Field | Type | Default | Meaning |
|---|---|---|---|
| `name` | string | **required** | Display name in the dropdown and banner (for humans). Must be unique across external files, but it is not the level's identity — that's the `uuid`. |
| `uuid` | string (v4) | auto-added by the build tool if missing | The level's machine identity: a 128-bit v4 UUID. Two files sharing a uuid = build failure (a shared level loaded twice). Not shown in the game UI. |
| `waypoints` | `[[x, y], …]` | **required** | Grid coords on the 28×18 grid. `x=-1` = spawn, `x=28` = exit. The path is a **Catmull-Rom spline through the waypoint cell centers**: straight runs stay straight, corners become smooth rounded curves (centripetal form — no overshoot). Any non-zero segment shape is allowed (axis-aligned, diagonal, or angled); the curve bows between waypoints and may round into neighboring cells. Angled crossovers (a cell walked twice in different directions) are allowed; U-turns / double-back lanes (the same consecutive cells re-walked in the same direction) are rejected. |
| `difficulty` | string | `normal` | One of `easy, normal, hard, nightmare`. Scales procedural waves (HP/money multipliers) and sets the dropdown label; also decides play order — easier difficulty sorts first. |
| `startMoney` | number | `levelStartMoney(index)` (table) | Money on a fresh start of this level. |
| `totalWaves` | number | `12` | Waves to clear the level; drives "Wave n/N" and the win check. |
| `waves` | array, optional | procedural generator | Explicit per-wave enemy lists, e.g. `[["normal","tank"], …]`. Wave *i* uses `waves[i-1]`; if the list is shorter than `totalWaves`, later waves fall back to the generator; extra entries are ignored (warned). Enemy type keys: `normal, tank, hot, wet, fast, camo, boss` — unknown keys are dropped with a console warning, never a crash. |
| `towers` | array, optional | all towers allowed | Tower **roster**: when present, ONLY these towers are buildable on the level (a restriction layer on top of the `unlockLevel` gate). Every entry must be a valid tower type key (`basic, frost, flame, cannon, sniper, railgun, tesla, venom, reaper, mint, warden, mortar`). Absent = every unlocked tower is buildable. The level generator page writes this field from its tower checkboxes. |

Notes:
- Enemy **availability** is not part of the level file — it stays driven by
  `unlockLevel` in `js/config.js`, keyed to the level's position (explicit
  `waves` lists are the exception: they spawn exactly what they list).
- Tower availability has two layers: the positional `unlockLevel` gate plus
  the optional per-level `towers` roster above. By level 7 everything is
  already unlocked, so external levels can use all types unless a roster
  restricts them.
- See `riverbend.json` for a complete working example (custom waves and a
  `uuid` included).
