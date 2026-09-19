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
  Kept: `MUSIC_LEVEL` as the single volume knob (set to 0.5 — real files are
  louder than the old synth; retune after the user hears it). `start()` is
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

**Notes:** `MUSIC_LEVEL = 0.5` is the single volume knob — ask the user how it
sounds after first listen and retune if needed. The desktop exe needs no build
change. GAME_VERSION auto-bumps via hooks/post-commit on commit.

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
