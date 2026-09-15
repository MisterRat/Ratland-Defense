<!-- CONTINUATION HEADER -->
> **Status:** Continued from `PLAN_03.md`
> **Archived History:** [`PLAN_01.md`, `PLAN_02.md`, `PLAN_03.md`]

### 📌 Handoff Summary
* **Completed Milestones:** Phases 1–38 (see archives). Phase 36: Switchback + Spiral generator templates, built-in "Switchback" renamed to "Zigzag". Phase 37: localStorage-only levels — the build step is gone; Create saves to the store. Phase 38: Stored Levels page with per-level Export + Delete. Phase 41: single-file desktop build (compile.py/compile.bat, pywebview/WebView2); native file dialogs for export/import in the compiled app.
* **Current Focus:** Phase 42 — fit the game on a 1920×1080 screen: grid 18→16 rows (canvas 1400×800), tower descriptions ≤ ~70 chars.
---

## Phase 42: Fit 1920×1080 — 16-row grid + shorter tower descriptions — IN PROGRESS

User request: the game is ~200px too tall for a 1080p screen and the right
column is wordy. Chosen fix (user-selected magnitude): shrink the grid by
**100px → 16 rows** (canvas 1400×900 → 1400×800) and cap every tower
description at **2 lines (~70 chars)**.

### Impact analysis (done before any edits)
- All 6 built-in levels use rows ≤15 → still valid on a 16-row grid, untouched.
- `levels/riverbend.json` max row 14 → untouched.
- Validator + renderer read `GRID.rows` dynamically → auto-adapt.
- Generator: only `tplSpiral` hardcodes `rB = rngInt(rng, 13, 15)` — on 16 rows
  the bottom corners' downward bow would exit the grid at row 15 → clamp to
  13..14 (re-roll on validation failure is the safety net either way).
- Stored custom levels using rows ≥16 fail validation and are silently skipped
  from the dropdown at boot (still in localStorage) — accepted caveat.
- Tests placing towers on rows 16/17: `smoke_tower_unlock.mjs` (4 spots) and
  `smoke_new_towers.mjs` (1 spot) → move to row 15 (verified clear of the
  Crossroads path: its rows are 4/12/2/10/6).

### Implementation steps
- [x] PLAN.md Phase 42 section written
- [x] js/config.js: GRID.rows 18→16, CANVAS_H comment, all 12 tower descs ≤70 chars
- [x] index.html: canvas height 900→800 (+ layout comment)
- [x] js/levelgen_paths.js: tplSpiral rB clamp (now `rngInt(rng, 13, LG_ROWS - 2)`) + comment
- [x] tests/smoke_tower_unlock.mjs: rows 17/16 → 15 (4 spots) + comment
- [x] tests/smoke_new_towers.mjs: row 16 → 15
- [x] tests/smoke_registry.mjs: good-def fixture bottom run row 15 → 14 (corner bow on the new 16-row edge would leave the grid — caught by regression, not by pre-analysis)
- [x] Stale 18-row comments fixed (js/levels.js, js/level_validate.js)
- [x] Full regression from tests/ — all 35 smoke tests pass
- [x] FILE_SUMMARY.md updated

### Result
DONE. Canvas is now 1400×800; all 6 built-in levels untouched (max row 15);
generator needs no other changes (all other templates are `LG_ROWS`-driven).
Compatibility caveat: stored custom levels using rows ≥16 fail validation and
are silently skipped from the dropdown at boot (they remain in localStorage).

## Phase 41: Single-file desktop build — native file dialogs — DONE

User built `compile.py` + `compile.bat`: PyInstaller `--onefile --windowed`
bundles a stdlib HTTP server (serving index.html/js/assets) plus a pywebview
window (EdgeChromium/WebView2 on Windows = embedded Chromium) into one exe.
Bug report: in the compiled build, Export did nothing (WebView2 silently
swallows the Blob + `a.download` + click trick) and Import "opened Explorer"
(hidden `<input type=file>` triggers WebView2's own file pick).

### Design
- `compile.py` (productionized from the user's draft): loopback-only server
  (`127.0.0.1`, ephemeral port via `TCPServer((HOST, 0))`; bound port
  published to the main thread through a `threading.Event` with a 5 s
  timeout + clean error exit); maximized resizable window; `Api` bridge
  exposed as `window.pywebview.api`:
  - `save_file(content, default_filename)` — native Save dialog via
    `window.create_file_dialog(webview.SAVE_DIALOG, ...)`; normalizes the
    backend's string/tuple result, writes UTF-8, returns True/False (cancel
    or write error → False).
  - `open_files()` — native multi-file Open dialog
    (`webview.OPEN_DIALOG, allow_multiple=True`); reads each file in Python
    and returns `[{name, content}]` (the page never touches disk); cancel →
    `[]`.
- `js/levels_store_ui.js`: `lsBridge()` helper; `lsExportOne` / `lsExportAll`
  / `lsImport` become async — bridge present → native dialogs
  (cancel → "Export cancelled." / silent no-op), absent → the original
  blob-download / hidden-input paths unchanged (file:// + dev servers keep
  working; existing smoke assertions untouched).
- `compile.bat`: unchanged (native Win32 dialogs — no tkinter to bundle).
- Test: `tests/smoke_stored_levels.mjs` section 6 (async IIFE — the script's
  completion value is its promise, awaited by the host): stubbed
  `window.pywebview.api` asserts save_file gets exact JSON + filename,
  open_files pairs flow through validate/dedupe/report, cancelled dialogs
  behave.

### Implementation steps
- [x] compile.py: ephemeral loopback server + Api (save_file, open_files) + maximized window
- [x] js/levels_store_ui.js: lsBridge + async export-one/export-all/import with browser fallbacks
- [x] tests/smoke_stored_levels.mjs: section 6 bridge checks
- [x] Full regression from tests/ — all 35 pass
- [x] FILE_SUMMARY.md updated (compile.py, compile.bat, levels_store_ui, smoke_stored_levels)

## Phase 40: Generator creates only — management moves to Stored Levels — DONE

User request: "The generator should only make the levels and add them to
localstorage. Management (Import, Export, and Delete) of levels should be
handled on the Stored Levels page."

### Design
- `js/levelgen_ui.js`: drop `lgExport` / `lgImport` / `lgImportReport` (moved
  verbatim to `levels_store_ui.js` as `lsExportAll` / `lsImport` /
  `lsImportReport`, with the import now re-rendering the list on success);
  `lgInit` no longer wires the Export/Import buttons; Create's success message
  points to the Stored Levels page for management.
- `js/levels_store_ui.js`: gains `lsExportAll()` (whole store →
  `tower-defense-levels.json`), `lsImport()` (multi-file `.json` input →
  `importLevelDefs` → re-render + report) and `lsImportReport(...)`; each list
  row gains a small inline path **mini-map** (`lsDrawMiniMap`, same spline
  diagram style as the generator's preview cards, 6px/cell).
- `levels.html`: header gains **📂 Import levels** + **💾 Export all** buttons;
  list widened to 920px for the mini-maps; default message updated.
- `levelgen.html`: Export/Import button row removed; "How levels work here"
  now says this page only creates and links to the Stored Levels page for
  management; a "📦 Stored Levels" link joins the back link.
- Tests: `tests/smoke_lgenemies.mjs` stubs drop the gone `lgExport`/`lgImport`
  ids; new `tests/smoke_stored_levels.mjs` boots the real levels.html bundle —
  render (mini-map + name + uuid + buttons), export-all blob, import
  (add / uuid-dedupe skip / corrupt-file report), delete (store + live
  registry), and empty-store export.

### Implementation steps
- [x] js/levels_store_ui.js: lsExportAll / lsImport / lsImportReport + lsDrawMiniMap rows
- [x] levels.html: Import + Export all buttons, wider list, mini-map CSS
- [x] js/levelgen_ui.js: drop lgExport/lgImport/lgImportReport + button wiring; new Create message
- [x] levelgen.html: remove button row, update instructions, add Stored Levels link
- [x] tests/smoke_lgenemies.mjs: stub ids updated
- [x] tests/smoke_stored_levels.mjs: new (5 checks)
- [x] Full regression from tests/ — all 35 pass
- [x] FILE_SUMMARY.md updated

## Phase 39: Rename the game to "Ratland Defense" — DONE

User request: "Let's rename the game to 'Ratland Defense'". Scope confirmed as
**visible titles only** (the 3 page `<title>`s) — internal localStorage keys
(`towerDefense*.v1`) and the export filename stay, so existing players keep
their saved progress/scores/levels.

- [x] index.html: `<title>Ratland Defense</title>`
- [x] levelgen.html: `<title>Ratland Defense — Level Generator</title>`
- [x] levels.html: `<title>Ratland Defense — Stored Levels</title>`
- [x] Full regression from tests/ — all 34 pass

## Phase 38: Per-level export + delete (Stored Levels page) — IN PROGRESS

User request: "can i not export individual levels?" + "i also need a way to delete
levels if i decide i dont like a specific level" → a **Stored Levels page**
(`levels.html`) that lists every level in the localStorage store with per-row
**Export** (single `.json` file named after the level) and **Delete** buttons.

### Design
- `js/level_custom.js` gains:
  - `lgFilename(name)` — moved here from `levelgen_save.js` (shared by the
    single-level export paths; sanitized name + `.json`).
  - `findCustomLevel(id)` — match by uuid, store id (`name:<n>` for legacy), or bare name.
  - `exportLevelDef(id)` — one stored level as pretty JSON (single-file export).
  - `deleteCustomLevel(id)` — removes from the store AND splices the live
    registry (the dropdown shrinks immediately); returns the removed def or null.
- `js/levels_store_ui.js` (new): `lsRender()` (one row per stored level: name,
  difficulty/waves/money meta, short uuid with full on hover, Export + Delete
  buttons), `lsExportOne(def)` (Blob download named `lgFilename(def.name)`),
  `lsDelete(def)` (confirm → `deleteCustomLevel` → re-render).
- `levels.html` (new): minimal shell in the levelgen.html style — count header,
  Generator link, list, message line. Loads config/utils/levels/level_validate/
  level_registry/path/level_custom + levels_store_ui (works from `file://`).
- `index.html`: "📦 Stored Levels" link in the HUD next to the generator link.
- Delete is destructive by design: confirm dialog warns to Export first.
  Progress/scores for deleted levels become orphaned keys (harmless — they are
  keyed by level index and the floor only counts built-ins + store size).

### Implementation steps
- [x] PLAN.md Phase 38 section written (post-rotation)
- [x] js/level_custom.js: lgFilename (moved), findCustomLevel, exportLevelDef, deleteCustomLevel
- [x] js/levelgen_save.js: drop lgFilename (now in level_custom.js)
- [x] js/levels_store_ui.js: list + per-level Export/Delete
- [x] levels.html: new page shell
- [x] index.html: HUD link to levels.html
- [x] tests/smoke_levelgen.mjs: section 6 (single-level export by uuid/name, delete removes store + registry, re-import after delete)
- [x] Full regression from tests/ — all 34 pass
- [x] FILE_SUMMARY.md updated
