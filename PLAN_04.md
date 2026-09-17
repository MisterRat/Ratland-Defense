<!-- CONTINUATION HEADER -->
> **Status:** Continued from `PLAN_03.md`
> **Archived History:** [`PLAN_01.md`, `PLAN_02.md`, `PLAN_03.md`]

### 📌 Handoff Summary
* **Completed Milestones:** Phases 1–38 (see archives). Phase 36: Switchback + Spiral generator templates, built-in "Switchback" renamed to "Zigzag". Phase 37: localStorage-only levels — the build step is gone; Create saves to the store. Phase 38: Stored Levels page with per-level Export + Delete. Phase 41: single-file desktop build (compile.py/compile.bat, pywebview/WebView2); native file dialogs for export/import in the compiled app.
* **Current Focus:** Phase 48 — a second normal-mode song + random pick at music start. In progress.
---

## Phase 48: Six background songs — compose five more, pick one at random on Start (user request)

### Request
"Do we just have 1 piece of music; if so can you compose 5 more songs and choose
one of the 6 at random when the music is turned on?"

Confirmed: today there is exactly ONE normal-mode song (`PATTERNS.normal`, the
8-bar A-minor loop) plus the separate boss pattern (boss mode is a mode switch,
not part of the count). This phase composes five NEW normal-mode songs and
makes 🎵 Start pick one of the six uniformly at random.

### Design
**`js/music_songs.js` (new, ~240 lines)** — pure data + builders, no
AudioContext (testable headless, same style as music_patterns.js). The five new
songs reuse `NOTE`/`CHORDS`/`buildPattern` from music_patterns.js (loaded first):

| # | Name | Key / progression | Tempo | Character |
|---|------|-------------------|-------|-----------|
| 2 | Meadow | C major: C–G–Am–F (I–V–vi–IV) | 116 | Bright, bouncy octave-bounce bass, rising lead |
| 3 | Twilight | D minor: Dm–Bb–F–C (i–VI–III–VII) | 96 | Mellow, slow, fifth-answer bass, sparse arps |
| 4 | Ratland | A minor: Am–G–Em–F (i–VII–v–VI) | 124 | Playful, pulse arps, stepwise dance melody |
| 5 | Ember | E minor: Em–C–G–D (i–VI–III–VII) | 104 | Warm, roots bass, triad arps, soaring lead |
| 6 | Stormfront | A minor: Am–Am–F–E (i–i–VI–V) | 128 | Driving, off-beat stabs + light percussion (kick on beats 1&3, hats on off-eighths), aggressive call-and-response lead |

Each song = `{ name, bpm, bars }` where `bars` are per-bar data
`{ chord, bassRoot, bass, arp, melody, fill? }` in the exact shape
`buildPattern` expects. All six songs end on a dominant-cadence bar (V) so the
loop restart never sounds like a plain repeat.

**`js/music_patterns.js`** — small change: `PATTERNS.normal` becomes a getter
that returns `NORMAL_SONGS[Music.songIndex()]` (the randomly chosen song);
`NORMAL_BAR_DATA` becomes a getter over the SAME chosen song's bars so the pad
voice always matches the melody. Both read `Music.songIndex()` (see below).

**`js/music.js`** — `Music.start()` picks the song: `this.songIndex =
Math.floor(Math.random() * NORMAL_SONGS.length)` BEFORE the mode is set, and a
mode switch to normal re-reads the chosen index (boss→normal restart keeps the
same song for that session). New public field `songIndex` (-1 until Start).
Everything else (lookahead scheduler, pad/riser bar-boundary scheduling, mute
ducking) is unchanged.

**Tests:** `tests/smoke_music.mjs` gains section M: all six normal songs exist
with distinct names/BPMs, each builds a full 8-bar (128-step) pattern with every
voice array populated, each song's final bar is a dominant-cadence chord
(asserted per-song), and `Music.start()` sets `songIndex` ∈ [0, 6) with the
scheduled pad matching that song's first-bar chord tones. Existing sections H–L
keep passing because they read whatever song `PATTERNS.normal` currently
resolves to — so their hardcoded Am assertions (H pad A3/C4/E4, I cadence fill
at steps 112–127, J bar-8 ≠ bar-4) are reworked to be song-relative (read the
chosen song's data instead of assuming Am). `smoke_difficulty_select.mjs` music
section is untouched (it only checks context lifecycle).

### Implementation steps
- [x] PLAN.md Phase 48 written
- [x] js/music_songs.js: five new songs (pure data + buildPattern)
- [x] js/music_patterns.js: CHORDS extended (Em/Bb/A/B/Dm/D) + `drive` bass pattern
- [x] js/music.js: Music.start() picks random songIndex; update() schedules the chosen song
- [x] index.html: load music_songs.js between music_patterns.js and music.js
- [x] tests/smoke_music.mjs: sections H–L song-relative + new section M
- [x] Full regression from tests/ — all pass
- [x] FILE_SUMMARY.md updated

### Notes (as built, differs slightly from the design above)
* Instead of turning `PATTERNS.normal` into a getter (which would create a
  circular dependency on Music), `js/music.js` reads `NORMAL_SONGS[Music.songIndex]`
  directly; `PATTERNS.normal` stays the original "Home" pattern (still used by
  tests as the reference). Each song prebuilds its `pattern` + `barData` at load.
* Twilight/Ratland/Ember/Stormfront progressions were finalized during
  composition to end on the dominant of their key (see music_songs.js).

## Phase 46: Richer background music — chords, melody, variation — DONE

User request: "make the music richer; chords, more melodic content and variation"
(+ "feel free to implement improvements you may have to the music").

### Problems with the Phase-44 music
1. **No chords** — every bar is a 4-note arpeggio + single-note bass; nothing
   ever sounds harmonic.
2. **Zero melodic content** — the arp index pattern is identical in all four
   bars; there is no phrase, no motif, no development.
3. **No variation** — a 64-step loop repeats verbatim forever; no section
   change, no fills, no cadence punctuation.
4. Boss mode has no melodic voice at all (bass + drums only).

### Design
Two new/changed files (engine stays <500 lines; patterns move to their own
module per the modularity rule):

**`js/music_patterns.js`** (new, ~230 lines) — pure data + builders, no
AudioContext needed (testable headless):
- `NOTE(n)` — MIDI note number → frequency (440·2^((n−69)/12)).
- `CHORDS` — triads as MIDI arrays: Am [57,60,64], F [53,57,60], C [48,52,55]
  (+60), G [55,59,62].
- `NORMAL_BARS` — 8-bar loop (128 sixteenth steps) with per-bar data:
  `{ chord, bassRoot, bassPattern, arpPattern, melody, fill }`.
  - **Chord progression (two 4-bar phrases):** A: Am–F–C–G (I–VI–III–VII),
    B: Am–G–F–E (i–VII–VI–V — the E major gives a dominant cadence into the
    loop restart). Bass roots: A2 F2 C3 G2 / A2 G2 F2 E2.
  - **Bass variation:** per-bar pattern over 8 eighths — root-only, octave
    bounce (×2), fifth answer (×1.5), and a pickup to the next bar's root
    (last eighth) on the final bar of each phrase.
  - **Arp/chord variation:** per-bar 8-eighth patterns from a small set
    (`arpUp` 0,1,2,3 / `arpDown` 3,2,1,0 / `triad` 0,1,2,0,1,2,0,1 /
    `pulse` 0,1,0,1,2,1,2,1), each bar picks a different one.
  - **Melody (lead voice):** per-bar 8-eighth phrases in the A4–E5 range —
    motif on bars 1–2, sequence up a step on bars 3–4, cadence answer on
    5–6, high-point climax on 7, resolution + pickup on 8; rests (null)
    shape the phrase. `fill` marks bar 8: the arp drops out so the melody
    closes the loop cleanly.
- `BOSS_BARS` — 4-bar loop (64 steps), Am–Am–F–E: driving eighth square bass
  with octave accents, off-beat power-chord stabs (root+5th) on bars 2 & 4,
  a simple call-and-response melody over the two F/E bars, kick on every beat
  + a bar-3 fill, hats on off-eighths + an extra 16th into bar 4.

**`js/music.js`** (rewritten engine, ~170 lines) — same public API
(`Music.start/stop/update`, `MUSIC_LEVEL`, `PATTERNS`) so main.js and the
smoke tests keep working:
- **Voices:** `pad` (two detuned triangles per chord tone, slow attack, one
  chord per bar), `bass`, `arp` (triangle), `lead` (sawtooth + lowpass —
  brighter, melodic), `snare` (bandpass noise) and `riser` (rising noise
  sweep into the cadence bar) in boss mode. Kick stays a pitch-drop sine.
- **Scheduler:** unchanged lookahead design; per-pattern `stepDur`/`steps`;
  mode switch still restarts from step 0. Normal = 108 BPM × 128 steps,
  boss = 132 BPM × 64 steps.
- Mute ducking + lazy-context rules unchanged.

**Tests:** `tests/smoke_music.mjs` — keep sections A–G (they still hold:
normal has no kick/hat noise, boss does; boss is faster), extend the stub
AudioContext to record oscillator freq/type and gain values, and add:
H normal-mode chords (a pad step schedules 3 chord tones + a bass root),
I melody content (lead oscillators present with distinct frequencies across
the loop; bar 8 fill = no arp events), J variation (not all 8 bars identical —
bass/arp/melody differ between bars), K boss stabs + snare + melody,
L pattern sanity (128/64 steps, every step fully populated).
`tests/smoke_difficulty_select.mjs` stub gains the new node factories
(`createStereoPanner`, `createDynamicsCompressor`) so the full bundle keeps
booting; its music section is untouched.

### Implementation steps
- [x] PLAN.md Phase 46 written
- [x] js/music_patterns.js: notes/chords/8-bar normal + 4-bar boss builders
- [x] js/music.js: pad/lead/snare/riser voices + per-voice scheduling
- [x] index.html: load music_patterns.js before music.js
- [x] tests/smoke_music.mjs: extended stub + sections H–L
- [x] tests/smoke_difficulty_select.mjs: stub node-factory additions
- [x] Full regression from tests/ — all 37 pass
- [x] FILE_SUMMARY.md updated

Note (post-implementation): normal mode keeps NO percussion (the calm voice is
pad + bass + arp + lead; the drums belong to boss mode — the contrast is the
point), so the original "soft kick/hat pulse" in the design was dropped and
section B's "no percussion in normal mode" check still holds.

## Phase 45: Levels 2 & 5 bottom lanes off-canvas — DONE

User report: after the Phase-42 shrink to a 16-row grid (canvas 800px),
levels 2 (Serpentine) and 5 (The Gauntlet) "go too far down" — at their
lowest point only the top edge of the path is visible.

**Root cause:** both levels run their bottom lanes on row 15 (the last row,
center y=775). The Catmull-Rom corners there bow ~45px past the lane center,
so the sampled spline reaches y≈820 — 20px below the 800px canvas. The
validator's "spline leaves the grid" check (`p.y >= H`) actually catches this
and reports `valid=false` for both — but built-in levels are seeded into the
registry WITHOUT validation (only stored/imported defs go through
`validateLevelDef`), so the broken bounds shipped silently.

**Fix:** move both bottom lanes from row 15 → row 14 (js/levels.js, one line
each). Sampled y now maxes at ≈769, inside the canvas with ~30px margin;
both pass `validateLevelDef` cleanly. Path lengths shift by ~2 cells each —
no other behavior touched.

- [x] js/levels.js: L2 Serpentine + L5 Gauntlet bottom lanes 15 → 14
- [x] Verified all six built-ins now pass the real validator (they should have
      always — future: consider validating built-ins at boot)
- [x] Smoke tests green (smoke_levels, smoke_boot, smoke_difficulty,
      smoke_enemy_unlock)
- [x] FILE_SUMMARY.md updated

## Phase 44: Difficulty selector for built-ins + background music — DONE

User request (gameplay improvements, no new enemies/towers): "Difficulty
selector for built-ins" and "Background music".

### Part A — Difficulty selector
Replay ANY level at easy/normal/hard/nightmare. The `LG_DIFFICULTY` rows
already drive every lever (hpMul, spawnGap, lives, bossEvery, wave size);
today only the level's own `difficulty` key is consulted.

- **Effective difficulty:** per-level override persisted in localStorage
  (`towerDefenseDifficulty.v1` → `{ [levelIndex]: 'easy'|... }`), falling back
  to the level's built-in `difficulty`. Helper `effectiveDifficulty(levelIndex)`
  in config.js (reads `getLevel` late-bound, like its siblings).
- **Threading:** every site that resolves a difficulty key from a level now
  calls the helper — `enemy.js` (hpMul), `wave.js` (spawnGap + procedural
  waves), `game.js` (startingLives). Explicit-wave levels keep their authored
  lists; the override still changes hpMul/spawnGap/lives (difficulty is an
  intensity dial, not a content edit).
- **UI:** "🎚 Difficulty" dropdown in the HUD (4 options, current selection
  highlighted), wired through `handlers.onDifficulty(key)` → persist + reload
  the current level (same path as a dropdown switch: paused start, message).
  The level dropdown's difficulty label shows the EFFECTIVE difficulty.
- **Tests:** `tests/smoke_difficulty_select.mjs` — boots the real main.js
  bundle: default = level's built-in; selecting Nightmare persists + reloads
  (lives 10, boss cadence 3, hpMul 1.35 on a spawned enemy); switching levels
  keeps per-level selections; invalid stored values fall back.

### Part B — Background music
A looping chiptune generated with Web Audio (same lazy-AudioContext pattern as
SFX — no audio files, file://-safe). New `js/music.js`:

- **Engine:** `Music` object with a scheduler driven by the game loop
  (`Music.update(dt, boss)` called from `frame()`), a lookahead scheduler
  (0.35 s) that schedules 16th-note steps ahead of `ctx.currentTime`, master
  gain through the same mute state as SFX (one 🔊 button mutes everything).
- **Two modes:** `normal` (calm minor-pentatonic bass + arpeggio, 108 BPM)
  and `boss` (faster 132 BPM, driving bass + off-beat percussion) — the game
  switches when a Colossus is on screen (checked each frame in main.js).
- **Start/Stop (autoplay policy):** music is OFF at boot and NOT persisted.
  The "🎵 Start"/"🎵 Stop" HUD button click is the ONLY place an AudioContext
  is created — it's a real user gesture, so the browser allows it with zero
  console warnings. `update()` never creates or resumes contexts itself (it
  runs from requestAnimationFrame, which is not a gesture). `stop()` closes
  the context; a later Start makes a fresh one.
- **Tests:** `tests/smoke_music.mjs` — stub AudioContext: fresh boot stays
  silent (frames never create a context), start() creates one + schedules per
  mode, boss mode changes tempo, stop() closes + silences, restart makes a
  fresh context, mute ducks the gain, headless stays silent.

### Implementation steps
- [x] PLAN.md Phase 44 section written
- [x] js/config.js: `effectiveDifficulty(levelIndex)` + persistence helpers
- [x] js/enemy.js / js/wave.js / js/game.js: resolve difficulty via the helper
- [x] js/main.js: `onDifficulty` handler + per-frame music update; index.html button
- [x] js/ui.js: difficulty dropdown build/sync; level labels use effective diff
- [x] tests/smoke_difficulty_select.mjs
- [x] js/music.js + index.html 🎵 button + ui wiring
- [x] tests/smoke_music.mjs
- [x] Full regression from tests/ — all 38 pass (scratch_phase36 fails pre-change, unrelated)
- [x] FILE_SUMMARY.md updated

### Result
DONE. Every level can be replayed at easy/normal/hard/nightmare via the 🎚 HUD
dropdown — the selection persists per level in localStorage and rescales lives,
enemy HP, spawn pacing and (procedural) wave size on reload; the level dropdown's
labels show each level's effective difficulty. Background music: a Web-Audio
chiptune loop (`js/music.js`) with a calm 108 BPM normal mode and a driving
132 BPM boss mode (auto-switches while a Colossus is on screen), started and
stopped by the 🎵 Start/Stop HUD button (not persisted — the page loads silent,
and the click is the user gesture the browser requires, so there are no
autoplay-policy warnings) independent of the 🔊 global mute. Volume: `MUSIC_LEVEL`
master gain (1.0) + per-note peaks — first thing to tune if too quiet/too loud
(first report "barely hear it" fixed by doubling the master gain 0.5 → 1.0 and
raising bass/arp/kick/hat peaks).

## Phase 43: Mortar targets anywhere + bigger blast — DONE

User request: "Allow Mortar to target any location on the map and make the AoE
slightly bigger. That would make it more effective against switchbacks by
allowing targeting in between 2 paths to cover parts of both."

### Design
- **Targeting:** drop the path-cell restriction — any in-bounds cell is a valid
  impact point (aim mode already clamps to the grid; out-of-canvas hovers are
  ignored). This lets a shell land in the gap between two switchback lanes and
  cover parts of both. `isPathCell` no longer referenced from input.js.
- **Blast radius:** 100 → **112 px** (~2.2 cells) — "slightly bigger". Upgrades
  scale it via the usual LEVEL_SCALE.range (L2 ≈ 125, L3 ≈ 140).
- **UI copy:** aim-mode messages and the Set Target button now say "any tile"
  instead of "path tile"; the red-X invalid preview is gone (aim preview is
  always a green blast circle at the hovered cell).

### Implementation steps
- [x] PLAN.md Phase 43 section written
- [x] js/config.js: mortar `range` 100→112 + comment + desc
- [x] js/input.js: aim click accepts any in-bounds cell
- [x] js/render.js: `drawMortarAimPreview` — always green blast circle
- [x] js/ui.js: Set Target button label; js/main.js: retarget message
- [x] tests/smoke_mortar.mjs + smoke_phase34.mjs: expectations at 112
- [x] Full regression from tests/ — all 36 pass
- [x] FILE_SUMMARY.md updated

### Result
DONE. The Mortar can now be aimed at any tile on the map (blast circle 112px,
~2.2 cells) — a shell dropped between two switchback lanes covers parts of both.
L2 blast ≈ 125px, L3 ≈ 140px via the usual LEVEL_SCALE.range.

## Phase 42: Fit 1920×1080 — 16-row grid + shorter tower descriptions — DONE

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

## Phase 38: Per-level export + delete (Stored Levels page) — DONE

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

## Phase 47 — Grass theme + difficulty-scaled water ponds (user request)

### Request
"grass and water, we make the map alternating shades of light green with randomly
placed (4 square sized) pools of blue water. Quantity based on difficulty: easy no
pools, medium 1 pool, hard 2 pools, nightmare 4 pools. No towers can be built on
water." User then supplied `assets/pond.png` (200×200 px — exactly one 4×4 pond
at 50px/cell) and renamed "pool" → "pond".

### Design
- **`js/terrain.js` (new, ~85 lines)**: `POND_SIZE = 4`,
  `PONDS_BY_DIFFICULTY = { easy: 0, normal: 1, hard: 2, nightmare: 4 }`,
  `buildPonds(levelIndex, difficultyKey, path)` → `{ cells: Set<'cx,cy'>, rects: [{cx, cy}] }`.
  Seeded rejection sampling (local mulberry32 copy + FNV-1a hash of the
  difficulty key; seed = `(levelIndex+1) * 0x9E3779B9 ^ hash(diff)`) — DETERMINISTIC
  per (level, effective difficulty): stable across retries/reloads, reshuffles when
  the difficulty dropdown changes. A pond is rejected if its 4×4 block touches a
  path cell or an already-placed pond; `POND_MAX_ATTEMPTS = 200` per pond (place
  fewer rather than fail). `isWaterCell(ponds, cx, cy)` helper. Self-contained —
  does NOT depend on levelgen_paths.js (game page never loads it).
- **`js/game.js`**: `reset()` builds `this.ponds` via `buildPonds(levelIndex,
  effectiveDiffKey(), path)` — rebuilt on every level entry/retry/difficulty change
  (all funnel through reset), so ponds always match the EFFECTIVE difficulty
  (player override included). New `effectiveDiffKey()` (defensive 'normal'
  fallback for legacy smoke bundles). `canPlace` rejects water cells
  (`typeof isWaterCell === 'function'` guard for bundles without terrain.js).
- **`js/render.js`**: grass = two alternating light greens (`#9ed08a` / `#92c67e`).
  `drawPonds(ctx, ponds)` — one `assets/pond.png` sprite per rect (200×200 px
  exact), procedural rounded-rect blue fallback (`roundRectPath` helper) when the
  sprite is missing. Called between `drawGrid` and `drawPath` in `draw()`.
- **`js/assets.js`**: `TowerAssets.init()` also loads `'pond'` → `assets/pond.png`
  (guarded on `typeof POND_SIZE !== 'undefined'`; `load(type, src)` extracted).
- **`index.html`**: `js/terrain.js` loads right after config.js, BEFORE assets.js
  (the pond-sprite guard needs POND_SIZE defined at auto-init time).

### Notes / non-goals
- Ponds are cosmetic + placement terrain only: NOT part of level defs, no JSON
  schema change, not shown in generator mini-maps.
- Mortar impact targeting unchanged — any in-bounds cell (water included) is a
  valid impact point.
- Quantities confirmed with user: easy 0 / normal 1 / hard 2 / nightmare 4.

### Implementation steps
- [x] js/terrain.js (buildPonds, pondCollides, isWaterCell, local RNG + hash)
- [x] js/game.js: effectiveDiffKey(), reset() builds ponds, canPlace water gate
- [x] js/render.js: grass colors, drawPonds + roundRectPath fallback
- [x] js/assets.js: pond sprite load
- [x] index.html: terrain.js script tag (after config.js, before assets.js)
- [x] tests/smoke_ponds.mjs (new): counts per difficulty, determinism, invariants
  across all 6 levels × 4 difficulties (in-bounds / no self-overlap / zero path
  overlap), canPlace rejects water + accepts grass — 148 checks
- [x] tests/smoke_levels.mjs: bundle gains terrain.js (game.js needs it)
- [x] Full regression from tests/ — all 38 pass
- [x] FILE_SUMMARY.md updated
