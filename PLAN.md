# PLAN — Tower Defense (continuation, part 3)

Part 1: `PLAN_01.md` (Phases 1–12) · Part 2: `PLAN_02.md` (Phases 13–24). 
This file continues milestone tracking from Phase 25 onward. 
Hard rules per AGENTS.md: modular code, ≤500 lines per file, plan-first, frequent saves.

## Phase 25: Five new tower types (Tesla, Venom, Reaper, Mint, Warden) — DONE

Design + review record: `PLAN_towers.md` (**APPROVED & IMPLEMENTED**).
Review decisions: all five unlock at level 7 (external levels only, matching
the Phase-19 enemy cadence); Glacier dropped (too similar to Frost); Mint
income excluded from `stats.moneyEarned` (explained in its shop desc); Warden
uses a dynamic cost ($300 first, +$100 per existing Warden).

### Implementation steps
- [x] PLAN_towers.md approved by user (5 of 6; Glacier dropped)
- [x] js/config.js: five new `TOWER_TYPES` entries (unlockLevel 7) + `wardenPlacementCost(existingCount)`
- [x] js/tower.js: chain/income/aura branches in `update(dt, enemies, pathTotal, auraMult)`; spec pass-through for poison/execute; `invested` cost tracking
- [x] js/projectile.js: impact handling for poison (Venom) and execute (Reaper)
- [x] js/enemy.js: `poisonStacks`/`poisonDpsPerStack`/`poisonTimer` + tick in `update()`
- [x] js/game.js: chain dispatch, Mint income credit (money only), Warden aura multipliers via new helpers `js/tower_tesla.js` / `js/tower_warden.js`; `wardenCost()`; `placeTower` dynamic-cost special case; `effects` list
- [x] js/sfx_sounds.js: `FIRE_SOUND` entries for all five (Warden = benign, never triggered — smoke_sfx requires every type)
- [x] js/render.js: chain-lightning polylines + Warden gold aura ring
- [x] js/ui.js: Warden live next-price in shop; aura/income stat lines in tower panel
- [x] assets/: five new tower PNGs (via tests/gen_tower_sprites.py)
- [x] tests/smoke_tower_unlock.mjs: availability table → 11 towers at level 7, placement count 6 → 11, Warden dynamic-cost check
- [x] tests/smoke_new_towers.mjs: per-tower def shape, unlock gate, mechanic assertions (7 checks)
- [x] Full regression from tests/ (28 PASS / 0 FAIL)
- [x] FILE_SUMMARY.md updated

## Phase 27: Mortar tower (area-effect artillery, ammo-selectable payload) — DONE

Design + review record: `PLAN_mortar.md` (**IMPLEMENTED**). Review decisions:
$400 cost (most expensive), L7 unlock, slowest fire rate in the roster
(0.25/s = 4s cooldown), blast radius 100px base (×1/1.12/1.25 by level),
player picks a **path cell** as the fixed impact point ("Change Target"
re-enters aim mode), fires every cooldown even with no enemies in the area,
and carries no intrinsic damage — the payload is the selected ammo tower's own
stats (Cannon/Flame/Frost/Tesla/Venom) × level scale × Warden aura, with the
ammo key as `sourceType` so per-flavor resistance applies. Tesla ammo draws
chain lines between in-blast enemies only (no outward hops).

### Implementation steps
- [x] PLAN_mortar.md approved by user
- [x] js/config.js: `TOWER_TYPES.mortar` (cost 400, L7, `ammoDefault`/`ammoTypes`, `range` = blast radius); boss `resist` list → 12 entries
- [x] js/tower.js: mortar branch in `update()` — no target acquisition; fires `{type:'mortar'}` spec at stored `targetPoint` on cooldown; payload from ammo def × level scale × aura
- [x] js/tower_mortar.js (new): `MortarShell` fixed-point lobbed flight + `applyMortarBlast` (splash falloff, per-flavor DoTs on all in-blast survivors, Tesla chain lines)
- [x] js/game.js: `mortar` spec dispatch → `MortarShell`; detonation routes to `applyMortarBlast`
- [x] js/input.js + js/main.js: aim mode (path-cell validation, auto-aim after placement, "Change Target" handler, ammo reload handler)
- [x] js/ui.js: Ammo dropdown + target button in the Mortar panel; blast/ammo stat line
- [x] js/render.js: target crosshair, aim preview (green circle / red X), lobbed shell drawing
- [x] js/sfx_sounds.js: `FIRE_SOUND.mortar = 'boom'`; assets/mortar.png (via tests/gen_tower_sprites.py); index.html script tag
- [x] tests/smoke_mortar.mjs: 7 checks (config, unlock, firing rule, blast falloff, per-ammo payloads, per-flavor resistance, level scaling + Warden aura + retarget)
- [x] All game.js-bundling tests patched to include js/tower_mortar.js; smoke_tower_unlock → 12 towers; smoke_railgun "most expensive" assertion dropped
- [x] Full regression from tests/ (29 PASS / 0 FAIL)
- [x] FILE_SUMMARY.md updated

## Phase 28: Enemy tweaks — Wisp phased visual + Bolt dash timing — DONE

Two small balance/visual changes requested by the user:
1. **Wisp state visual:** while phased (untargetable) the Wisp is drawn as an
   unfilled circle (ring only) instead of a solid disc; solid phase unchanged.
2. **Bolt dash timing:** walk 2.5s → dash 1.0s, every 3.5s period
   (`burst: { dashSpeed: 170, dashDur: 1.0, period: 3.5 }`; was dashDur 0.8 /
   walk 2.7s). Dash still lands at the END of each period; slow scales both.

### Implementation steps
- [x] js/config.js: bolt `burst.dashDur` 0.8 → 1.0 (period stays 3.5)
- [x] js/render.js: `drawEnemy` draws phased wisps as an unfilled ring (no fill)
- [x] tests/smoke_burst.mjs: cycle distance 271 → 295 px, speed-switch cases for the new 2.5s/1.0s windows
- [x] tests/smoke_phase.mjs: new render check — phased wisp draws no fill (ring), solid wisp fills
- [x] Full regression from tests/
- [x] FILE_SUMMARY.md updated

## Phase 29: Per-level tower availability (generator selects the roster) — DONE

User request (two parts):
1. The level generator should let the user select **which towers are available
   on a level**, including a **Select All** button.
2. `levelgen.html` should be styled like `index.html`: a **left column for
   enemies** and a **right column for towers** (mirroring the legend/shop
   layout), with **checkboxes** to select each entry.

### Design
- **New optional level-def field `towers`**: an array of tower type keys
  (e.g. `["basic", "frost", "cannon"]`). Present = only those towers are
  buildable on that level; **absent = all towers allowed** (backward
  compatible: built-ins, existing external levels, and saved custom levels
  keep working unchanged). The positional `unlockLevel` gate still applies
  first — the roster is a restriction layer on top, exactly analogous to how
  explicit `waves` lists bypass the enemy `unlockLevel` gate.
- **Validation** (`js/level_validate.js`): when `towers` is present it must be
  an array of strings, each a valid `TOWER_TYPES` key. (The pure-data gate
  already accepts string arrays; only key-validity is new.)
- **Registry** (`js/level_registry.js`): `normalizeLevelDef` passes `towers`
  through (absent stays absent).
- **Availability helper** (`js/config.js`): `isTowerAllowedOnLevel(type,
  levelIndex)` = `isTowerAvailable(type, levelIndex)` AND (level has no
  `towers` field OR the field contains `type`). Single source of truth for the
  new layer; reads the registry via `getLevel(levelIndex)`.
- **Enforcement** (three sites, mirroring the existing unlock gate):
  - `js/game.js` `placeTower`: gate on `isTowerAllowedOnLevel` (defense in
    depth — the UI also disables the button).
  - `js/main.js` `onPickType`: message when a tower is not on the level's
    roster (distinct from the "unlocks on level N" message).
  - `js/ui.js` `syncShopSelection`: shop buttons for off-roster towers are
    disabled with a 🔒 label.
- **Generator UI** (`levelgen.html` + `js/levelgen_ui.js`):
  - Two-column options area mirroring `index.html`: left = enemy list
    (legend-style rows: swatch + name, each with a checkbox), right = tower
    list (shop-style rows: name + cost, each with a checkbox). Difficulty /
    money / waves inputs stay below.
  - New `lgBuildTowerCheckboxes(wrap, towerTypes)` — one checkbox per tower in
    config order; **all checked by default** (unchecking is the point of the
    feature).
  - New `#lgSelectAllTowers` button with the same auto-flip behavior as the
    enemy Select All (click = check all; when all are already checked, click
    = clear all).
  - `lgReadOptions()` gains `towers: [...]` (checked tower keys).
- **Save flow** (`js/levelgen_save.js`): `lgBuildDef` includes `towers` in the
  def (only when a subset is selected — an empty selection means "no towers"
  and must be rejected by the generator; all-selected writes the full list,
  which is equivalent to absent but keeps the intent explicit in the file).
  Actually: always write the checked list; the generator requires ≥1 tower
  (same as ≥1 enemy).
- **Build tool** (`tools/build_levels.mjs`): the generated glue in
  `js/levels_external.js` carries `towers: def.towers || null` so rosters from
  `levels/*.json` survive the build. (No .json file changes — the field is
  optional — so a rebuild is only needed to refresh the glue.)
- **Docs**: `levels/README.md` schema table + the "availability is not part of
  the level file" note; `FILE_SUMMARY.md` entries.

### Implementation steps
- [x] PLAN.md: Phase 29 section (this); PLAN_01.md rotated → PLAN_01_01.md (622 > 500 lines)
- [x] js/level_validate.js: `towers` field validation (array of valid TOWER_TYPES keys)
- [x] js/level_registry.js: `normalizeLevelDef` passes `towers` through
- [x] js/config.js: `isTowerAllowedOnLevel(type, levelIndex)` helper
- [x] js/game.js: `placeTower` gate uses the new helper
- [x] js/main.js: `onPickType` roster message
- [x] js/ui.js: `syncShopSelection` locks off-roster towers (🔒 label)
- [x] levelgen.html: three-column flex row mirroring index.html's #wrap — left = enemy legend (.legend-item style + checkbox), center = form/buttons/cards/instructions, right = tower shop (.shop-item style + checkbox); both Select All buttons
- [x] js/levelgen_ui.js: `lgBuildTowerCheckboxes`, `lgSelectAllTowers` wiring, `lgReadOptions().towers`, ≥1-tower guard in lgGenerate/lgCreate
- [x] js/levelgen_save.js: `lgBuildDef` includes `towers`
- [x] tools/build_levels.mjs: glue emits `towers`; rebuild js/levels_external.js
- [x] tests: smoke_lgenemies (tower boxes + select-all), smoke_registry (bad `towers` shapes), smoke_levelgen (def carries `towers`), smoke_build (roster survives the build), tower-unlock smoke extended with roster placement + shop gating; full regression (29/29 pass)
- [x] levels/README.md + FILE_SUMMARY.md updated

## Phase 30: Venom visual — poisoned enemies tint green — DONE

User request: enemies affected by venom should turn a green similar to the
blue used for the Frost slow.

### Implementation steps
- [x] js/enemy.js: `poisoned` getter (true while `poisonTimer > 0`)
- [x] js/render.js: `drawEnemy` body fill — poisoned → `#9fff8f` green (wins over the Frost slow's `#9fd8ff` blue when both are active); phased wisps still draw no body fill
- [x] tests/smoke_venom_visual.mjs: 5 checks (plain color, poison tint, poison beats slow, tint expires, poisoned phased wisp stays a ring)
- [x] Full regression from tests/ (31 PASS / 0 FAIL)
- [x] FILE_SUMMARY.md updated

## Phase 31: Mortar fixes — no-resistance payloads, splash visual, Tesla lines — DONE

User-reported bugs + feature after first mortar playtest:
1. **Colossus vs mortar:** Colossus should NOT resist the Mortar — it is the
   only tower Colossus has no resistance to. Broader rule (user decision):
   **no enemy resists any ammo fired by the Mortar.** The blast's `sourceType`
   is now `'mortar'` (a sentinel no resist list contains), and DoTs/slow from
   a mortar apply with `ignoreResist` — the ammo flavor still sets the DoT
   TYPE and stats, just never the resistance. Blast radius stays the Mortar's
   own `range` × level scale (never the ammo tower's splash).
2. **Tesla lines:** lines must be drawn between the enemies affected by a
   tesla-ammo mortar blast (kept: consecutive in-blast pairs; verified via
   smoke + headless-browser screenshot). Their lifetime was extended from
   0.15s to 0.35s so they stay visible for the whole detonation, matching
   the splash (`fx.duration` is now read by the renderer instead of a
   hardcoded 0.15).
3. **Splash visual (feature):** every detonation pushes an `explosion` effect
   — an expanding ring + soft flash at the impact point, sized to the blast
   radius, colored by the ammo type (`TOWER_TYPES[ammo].color`).

 4. **Playfield "grows" while a tower is selected:** reproduced headlessly —
    the `#wrap` flex row uses the default `align-items: stretch`, so opening
    `#towerPanel` (taller than the canvas) stretched the canvas from 900 to
    ~959px. Fix: `canvas { align-self: flex-start }` in index.html — the row
    may grow, but the canvas stays pinned top-left at its intrinsic 1400×900.

### Implementation steps
- [x] js/config.js: boss `resist` list drops `'mortar'` (12 → 11 entries) + comment
- [x] js/tower.js: mortar spec `sourceType: 'mortar'` (was the ammo key)
- [x] js/enemy.js: `applySlow(ignoreResist)` / `applyBurn(dps, duration, ignoreResist)` — resistance skipped when set
- [x] js/tower_mortar.js: blast passes `'mortar'` + `ignoreResist` DoTs; pushes `{type:'explosion', x, y, radius, color, timer, duration}` on every detonation
- [x] js/render.js: `drawEffects` handles `explosion` (expanding ring + flash via new `hexA` helper); chain alpha now reads `fx.duration || 0.15`
- [x] index.html: `canvas { align-self: flex-start }` — stops the flex row stretching the canvas taller when the tower panel opens (playfield-grow bug)
- [x] js/render.js: null-guard `view.hoverCell` in the placement/aim previews (pageerror when the mouse hasn't entered the canvas yet)
- [x] js/utils.js: `hexA(hex, alpha)` helper
- [x] tests/smoke_mortar.mjs: check 6 rewritten (no-resistance rule: full damage vs Soused/Colossus, full-strength burn), 6b Colossus full-damage + resist-list shape, 6c explosion effect; 5d/5e updated for the always-present splash
- [x] tests/smoke_ui.mjs: Colossus legend row now expects the named 11-tower list (not "resists all towers")
- [x] Full regression from tests/
- [x] FILE_SUMMARY.md updated

## Next (unstarted)

- Playfield-grow bug FIXED in Phase 31 (item 4) — verified headlessly:
  canvas stays 1402×902 in every selection state. Candidate follow-ups:
  balance pass on the five new towers in real play.
