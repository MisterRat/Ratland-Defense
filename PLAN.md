<!-- CONTINUATION HEADER -->
> **Status:** Continued from `PLAN_04.md`
> **Archived History:** [`PLAN_01.md`, `PLAN_02.md`, `PLAN_03.md`, `PLAN_04.md`]

### 📌 Handoff Summary
* **Completed Milestones:** Phases 1–48 (see archives). Phase 46: rich chiptune
  music (chords, melody, variation; separate boss pattern). Phase 47: terrain /
  pond sprites. Phase 48: six normal-mode background songs — five new songs
  composed in `js/music_songs.js` (Home/Meadow/Twilight/Ratland/Ember/Stormfront),
  🎵 Start now picks one of the six uniformly at random (`Music.songIndex`), and
  `tests/smoke_music.mjs` gained section M with song-relative H–L. All smoke
  tests pass.
* **Current Focus:** No active phase — awaiting the next user request.
---

## Phase 49 — Fix exe cold-boot blank page

**Bug:** Compiled Windows exe opens with empty game area / dropdowns; navigating
away and back (full reload in same WebView2) fixes it. Regular browsers fine.

**Root cause (confirmed by user-run exe + DevTools):** `ERR_CONNECTION_REFUSED`
on every `js/*.js` request while index.html itself loaded. The old server was a
single-threaded `socketserver.TCPServer`: WebView2 fetches the document and all
~30 scripts in parallel; the server handled the first (keep-alive) connection
and blocked on it, so every subsequent script connection was refused. Reloads
worked because navigating away closed the stuck socket and freed the server.

**Fix (this commit):**
- `compile.py`: multi-threaded server (`socketserver.ThreadingMixIn`,
  `daemon_threads = True`, `allow_reuse_address`) — each request gets its own
  thread, parallel script fetches all succeed.
- `compile.py`: `webview.start(debug=False)` — no auto-opened DevTools window
  on launch (it was a debugging aid; remove once the bug is confirmed fixed if
  desired — kept off for now).

**Constraints:** no behavior change in regular browsers; all smoke tests pass;
files ≤ 500 lines.

## Phase 50 — Smoke test: song-count-agnostic roster checks

**Context:** the user added five more normal-mode songs (roster is now 11),
which broke `tests/smoke_music.mjs` — section M hard-coded a 6-song roster
(count, name→cadence map, fixed pick indices, `CHORDS.Am` pad assumption).

**Fix:** make the music smoke test assert only SHAPE invariants, never a fixed
song list or count:
- M: nonempty roster; distinct names/BPMs == n; every song's bar 8 is a
  cadence fill with a chord defined in CHORDS; stubbed random 0→index 0 and
  0.999→index n-1; pad check uses each picked song's OWN bar-1 chord; unstubbed
  pick in [0,n); no-repeat across 12 picks.
- B: force the pick (stubbed random) — percussion-free song schedules no
  kick/hat noise across the full loop; when the roster has a percussive song,
  it DOES schedule hat/snare noise (some normal songs carry light percussion,
  so the old random-pick assertion was flaky).
- L: loop-coverage advance is data-driven off the slowest song's stepDur.

**Status:** done — 25-run sweep of `smoke_music.mjs` clean (random picks vary
per run), full regression 38/38 smoke tests pass.
