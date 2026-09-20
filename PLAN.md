<!-- CONTINUATION HEADER -->
> **Status:** Continued from `PLAN_05.md`
> **Archived History:** [`PLAN_01.md`, `PLAN_02.md`, `PLAN_03.md`, `PLAN_04.md`, `PLAN_05.md`]

### 📌 Handoff Summary
* **Completed Milestones:** Phases 1–59 (see archives). Phase 58: tower base-plate
  removal. Phase 59: speed-based income bonus (1x/2x = ×1.2 / 3x = ×1.4). All
  smoke tests passing at end of Phase 59 (45/45).
* **Current Focus:** Phase 60 — real audio files replace the synthesized
  chiptune music; 🔊 button repurposed to SFX-only mute. Phase 61 — new random
  song per level.
---

## Phase 60 — Real audio files + SFX-only mute button

**Request:** replace the existing (synthesized) music with actual sound files
the user has — nine normal-mode tracks + one boss track, each ~2 minutes long,
looping if a level runs longer than that. Files placed in `assets/music/`:
`Ashes_&_Armor.ogg`, `Desperate_Perimeter.ogg`, `Frontline_Engagement.ogg`,
`Iron_&_Anvil.ogg`, `Mud_&_Iron.ogg`, `Silent_Advance.ogg`,
`Stained_Victory.ogg`, `Tactical_Recon.ogg`, `Wall_Breakers.ogg`, `boss.ogg`.
Mid-run addition: a button to silence sound effects WITHOUT silencing music.

**Decisions (user-confirmed):**
1. Mapping = "Normal tracks + a boss track" — keep the current two-mode
   behavior (random normal pick per Start, boss track while a Colossus is on
   screen), fully replaced by real audio. No fallback to synthesized music.
2. Mute scheme = "🔊 = SFX only, 🎵 = music" — repurpose the existing 🔊 Sound
   button to mute ONLY sound effects; music is controlled solely by the 🎵
   Start/Stop button. No new button.

**Design:**
- `HTMLAudioElement` per track instead of Web Audio buffers: an `<audio>`
  element loads local files from `file://` without fetch/XHR (the old
  `decodeAudioData` path was impossible under `file://`), loops natively via
  `loop = true`, and its `play()` is allowed because the 🎵 Start click is a
  user gesture (sticky activation covers all later non-gesture `play()` calls
  — boss switches, per-level repicks).
- The Music API surface is preserved exactly: `Music.start()` (returns bool),
  `Music.stop()`, `Music.update(dt, boss)` (called every frame from main.js
  with the REAL dt — unaffected by pause/speed), fields `playing`, `mode`,
  `songIndex`. Random normal pick on Start, never the same twice in a row.
- Mode switching is guarded by `mode !== desired`: normal→boss pauses the
  normal element and starts the boss loop; boss→normal RESUMES the same normal
  element from its current position (not restarted).
- Missing file ⇒ that song is marked unavailable (`_failed` Set) and the next
  available one starts instead; if every file fails, `start()` returns false
  (silent rather than chiptunes).
- The 🔊/🎵 split: `SFX.muted` (persisted via `towerDefenseMuted.v1`) gates
  only `SFX.play()`; the music engine no longer reads it — the old ducking
  coupling is removed. Music is OFF by default and not persisted; 🎵 Start is
  the only audio unlock.

**Implementation:**
- `js/music_files.js` (NEW): pure-data roster — `MUSIC_SONGS` (9 entries
  `{name, src}`) + `BOSS_MUSIC_SRC` (`'assets/music/boss.ogg'`).
- `js/music.js` (REWRITTEN, ~150 lines): file-based engine. Deleted: `padNote`,
  `padChord`, `leadTone`, `riser`, `scheduleStep`, the lookahead scheduler.
  Kept: `MUSIC_LEVEL` as the single volume knob (user-tuned to 0.15 — real files are
  much louder than the old synth). `start()` is
  headless-safe (`typeof Audio === 'undefined'` → false); makes the picked
  song's element (`loop = true`, `volume = MUSIC_LEVEL`) and plays it (play()
  Promise refusals swallowed). `stop()` pauses both elements, clears their
  `src`, resets state. `update(dt, boss)` no-op when not playing, guarded mode
  switch as designed above. NO `SFX.muted` coupling.
- `js/music_patterns.js` + `js/music_songs.js` (DELETED): the synthesized
  pattern/song data is gone.
- `index.html`: removed the two old script tags (+ comments); added
  `<script src="js/music_files.js"></script>` just before `js/music.js`.
- `js/main.js`: `onMusic()` message now names the picked track from
  `MUSIC_SONGS` (was `NORMAL_SONGS`). The per-frame `Music.update(dt, boss)`
  call is unchanged.
- `js/ui.js`: comment-only update on `bindMuteButton()` (🔊 = SFX only); the
  toggle already set only `SFX.muted`, and persistence already exists via
  `towerDefenseMuted.v1`.
- `compile.bat` / `compile.py`: NO changes — `--add-data "assets;assets"`
  already bundles the whole assets folder, so the ogg files ship in the exe.

**Tests:**
- `tests/smoke_music.mjs` (REWRITTEN, 7 sections) with a stub `Audio` class
  that records every element instance and its play/pause calls: A = headless
  (no `Audio`) → `start()` false, update no-op; B = start makes one looping
  element (loop=true, played once, volume=MUSIC_LEVEL, src in roster), index in
  range, 12 stop/start cycles never repeat a pick; C = boss switch (pause
  normal + play boss, stable across frames; back resumes the SAME normal
  element with play count +1, no duplicate element); D = SFX mute does NOT
  duck music (inverted from the old ducking check) while `SFX.muted` is true;
  E = stop pauses + releases (`onerror` cleared), silent while stopped, fresh
  boot silent; F = a failing file's `onerror` marks it unavailable and starts
  the next available track (cascade skips both failed indices; all-nine-failed
  → `start()` false); G = Phase 61 repick checks.
- `tests/smoke_difficulty_select.mjs` section 6 updated for the new engine:
  the AudioContext stub is replaced by a recording `Audio` class on the
  sandbox (top-level, not `window.`); checks are now element-based — silent at
  boot (frames alone never create an element), start makes one looping element
  and plays it, stop pauses + releases, stopped stays silent, boss mode
  switches to the boss file then resumes the same normal element.
- Full regression: all 45 smoke tests pass.

**Notes:** `MUSIC_LEVEL = 0.15` (user-tuned) is the single volume knob — the
ogg tracks are not uniformly mastered, so per-track loudness varies. The
desktop exe needs no build change. GAME_VERSION auto-bumps via
hooks/post-commit on commit.

## Phase 62 — Type-based targeting ("Prefer" dropdown) + Weakest mode

**Request:** "The towers have a Target dropdown that lets the player target by
position of enemy. It would be nice to allow the player to target by Type of
enemy also." User rejected a single grouped 17-option dropdown as
overwhelming; approved **two focused dropdowns**. Also requested: add
**"Weakest"** as an additional Target mode (lowest current HP).

**Decisions (user-confirmed):**
1. UI = two dropdowns in the tower panel: **Target:** (position mode, now 5
   options incl. Weakest) + **Prefer:** (Any + only the types ACTIVE on the
   current level via `levelActiveEnemies()` — short list per level).
2. Semantics: a preferred type in range is the ONLY candidate pool; when none
   is in range the tower FALLS BACK to the position mode among all enemies —
   a preference never leaves the tower idle. "Any" = no preference (legacy
   behavior).

**Implementation:**
- `js/config.js`: `TARGET_MODES.weakest` ('Weakest' — lowest current HP).
- `js/tower.js`: `Tower.preferType` field (default null); `acquireTarget()`
  filters the candidate pool to the preferred type when at least one such
  enemy is alive + targetable + in range, else uses the full list;
  `scoreFor()` gains `case 'weakest': return -e.hp`.
- `js/ui.js`: tower panel (non-mortar branch) gains a `.prefer-row` with the
  Prefer dropdown — options = Any + active types (+ the stored preference if
  it names an inactive type, so the panel stays truthful); value set after
  options exist (same no-op rule as the Target select); change →
  `handlers.onPreferType(tower, value || null)`. Phase 62 refactor: bottom-bar
  rendering (`syncWavePreview`/`renderStatsBar`/`syncTotalStats` + their keys)
  moved to `js/ui_bottombar.js` (new `BottomBar` class, ~120 lines); ui.js
  keeps thin delegating methods so main.js's per-frame calls are unchanged
  (ui.js was at 533 lines — over the 500-line limit).
- `js/main.js`: `handlers.onPreferType(tower, type)` — validates against
  `ENEMY_TYPES`, stores null for Any, message names the fallback mode.
- `index.html`: loads `js/ui_bottombar.js` before `js/ui.js`.
- All six smoke bundles that load ui.js now include ui_bottombar.js.

**Tests:**
- `tests/smoke_targeting.mjs`: weakest picks the lowest-HP enemy; preferType
  picks the preferred type when in range, falls back to the position mode
  when none is in range, and skips a dead preferred enemy (pool empties →
  full-list fallback).
- `tests/smoke_ui.mjs`: Prefer dropdown options on L1 = ["", "normal", "boss"]
  (Any + level-active types only), defaults to Any, change fires the handler
  with the type key, re-render keeps the stored selection, "Any" passes null,
  and a stale preference for an inactive type stays selectable.
- Full regression: 45/45 smoke tests pass.

## Phase 61 — New song per level (addendum to Phase 60)

**Request:** "Can we make the music change which song it is playing with each
new level?" — every time a new level loads, the currently playing normal track
should switch to a different random one (never the same twice in a row).

**Autoplay safety (user question — confirmed safe):** by the time a per-level
switch happens, music is already playing, which only happens after the 🎵 Start
click (a user gesture). That click grants *sticky activation* for the whole
page/session, so any later `play()` on any element needs no fresh gesture —
exactly how the boss switch already works. `repick()` is a no-op unless
`playing === true`, so music-off stays silent and nothing ever autoplays.

**Design:** `Music.repick()`: no-op when not playing or already in boss mode;
otherwise release the current normal element, pick the next available song via
the existing `pickSong()` (same no-immediate-repeat rule), make + play its
looping element (with the same onerror re-pick path as `start()`). Called from
`main.js` `loadLevel()` at the end of every level entry — fresh start AND
retry (a retry is a new run of the level). If music is OFF, nothing happens.
While in boss mode repick is deferred by design: the boss track keeps playing,
and when it leaves, the CURRENT (already-swapped-on-entry) track resumes.

**Implementation:**
- `js/music.js`: `repick()` method (releases the old element, swaps the pick).
- `js/main.js`: `loadLevel()` calls `Music.repick()` after
  `ui.syncLevelSelect()`.
- `tests/smoke_music.mjs` section G: repick while playing swaps to a different
  song (new element, old released), 13 consecutive picks never repeat, no-op
  while stopped, no-op while in boss mode. Full regression: 45/45 pass.

## Phase 63 — Balance pass (enemy × tower audit across difficulties)

**Request:** "Do a balance pass. I don't know of any issues specifically but
check the possible enemy and tower combinations at different difficulties. We
made a lot of changes, your simulator may need to be updated."

**Sim was stale in one concrete way:** the bundle lacked `js/terrain.js`, so
`game.ponds === null` and the Cruiser (waterOnly) could never be placed — its
dedicated placement branch was dead code in every prior run. Fixed by adding
terrain.js to the bundle (index.html order: after config.js, before levels.js).

**Strategy improvements (reference player is "competent but not optimal"):**
- Cruiser picks the pond cell closest to the path centroid (range 700 ≈ half
  the map → central placement covers all lanes) instead of "first free pond".
- `pickCell` gained a minScore gate: combat towers must add ≥1 new coverage
  sample, wardens need ≥1 neighbor in aura range. Previously the strategy
  bought redundant towers until money ran out and starved on upgrades — this
  caused the Serpentine@hard anomaly (4 basic guns, 15 kills).
- Stored levels (`levels/Free_For_All.json`, `riverbend.json`) are now
  registered and played through the same runner.
- Per-run progress logging (a mid-matrix segfault previously left no output).

**Result (9 levels × 4 difficulties, deterministic):**
- easy 6/6 built-in wins (playability floor holds)
- normal 6/6 built-in wins
- hard 5/6 (Serpentine loses at wave 8: shortest path + $100 start + highest
  HP scaling — a strategy weakness, not a balance bug)
- nightmare 1/6 built-in (Crossroads only) — by design
- Free For All (explicit waves, $1000 start): won at ALL four difficulties —
  the $1000 start money makes it a showcase level, consistent with its intent.
- Riverbend (6 waves, no explicit difficulty override → normal row): easy win
  everywhere; it's a short casual level.

**Enemy × tower audit:** every enemy type has ≥1 viable counter available at
its unlock level. Boss (Colossus) resists 10 towers — only mortar and reaper
deal full damage; intentional design that forces build decisions. Wisp is
countered by frost (pauses phase cycle), tesla (hits phased), splash, and
burn. Bulwark regen (6/s) is outpaced by flame burn (14 dps) and venom poison
(30 dps cap). No uncounterable enemy exists.

**Tower economy:** no tower is strictly dominated. Tesla is the DPS king
(53.9 solo), cannon the group workhorse, flame/venom the DoT/Bulwark
specialists, mortar/cruiser the boss counters, frost the utility slow.

**Verdict: no game-code stat changes recommended.** Balance is healthy; the
difficulty curve matches intent.

**Files:** `tests/balance_sim.mjs` updated (282 lines), `tests/balance_report.md`
new (full report). No js/ changes. Full smoke suite 46/46 pass.

## Phase 64 — UI redesign: constant-height tower-detail row + upward dropdowns

**Request:** the selected-tower detail box was too low, its dynamic height pushed
the message/stats rows down and made the canvas rescale on every selection; the
message box should span only the play area, and the tower detail should become a
full-width row above the stats bar with dropdowns that open UPWARD over the play
area.

**Layout (index.html):**
- `#towerPanel` moved OUT of `#side` (right column now holds only `#shop`) into
  its own full-width row between `#msg` and `#wavePreview`. It is a CONSTANT
  HEIGHT (36px), always-visible flex row — deselecting renders a placeholder
  span instead of hiding the bar, so body scrollHeight never changes → no
  fit.js rescale. No fit.js changes.
- `#msg` constrained to the 1400px play-area width (was full window width).
- New `.dd`/`.dd-btn`/`.dd-list` CSS: the list is absolutely positioned
  `bottom: calc(100% + 4px)` above its button (z-index 50).
- Follow-up: panel content right-aligned (`justify-content: flex-end`) and
  the dropdown list right-anchored (`right: 0`, grows leftward) so it stays
  over the play area.

**Code:**
- `js/ui_dropdown.js` (NEW, 120 lines): `Dropdown` class — custom dropdown that
  opens upward (native `<select>` popups can't be forced up). One open list at a
  time; outside-mousedown + Escape close it; document listeners attach only
  while open. Headless-safe guards for the smoke-test DOM stubs.
- `js/ui.js`: `renderTowerPanel` rewritten — placeholder when no tower; inline
  header (name/Lv/stats); mortar → custom Ammo dropdown + retarget button;
  others → custom Target + Prefer dropdowns (live refs on
  `this.ammoDd`/`targetDd`/`preferDd`). No native selects remain in the panel.
- `js/input.js`: Space-pause skipped while the event target is inside
  `#towerPanel` (a focused dropdown button must not also pause).

**Tests:** `smoke_ui.mjs` updated to the Dropdown API (`targetDd.value`,
`selectOption(...)`, `preferDd.options`) + placeholder-after-deselect check;
`smoke_towerrow.mjs` (NEW) asserts the static structure of index.html.
Full suite 46/46 pass.
