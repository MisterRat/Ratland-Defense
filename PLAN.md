<!-- CONTINUATION HEADER -->
> **Status:** Continued from `PLAN_03.md`
> **Archived History:** [`PLAN_01.md`, `PLAN_02.md`, `PLAN_03.md`]

### 📌 Handoff Summary
* **Completed Milestones:** Phases 1–37 (see archives). Phase 36: Switchback + Spiral generator templates, built-in "Switchback" renamed to "Zigzag". Phase 37: localStorage-only levels — the build step is gone; Create saves to the store, Export/Import on the generator page, `progress.js` floor counts the store.
* **Current Focus:** Phase 38 — per-level Export + Delete via a Stored Levels page.
---

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
