// Phase 60: background music engine — plays REAL audio files
// (assets/music/*.ogg, roster in js/music_files.js) via HTMLAudioElement.
// Replaces the Phase-46 synthesized chiptune engine; the pattern/song data
// modules are gone.
//
// Why HTMLAudioElement instead of Web Audio buffers: decoding files with
// decodeAudioData needs fetch/XHR, which file:// blocks. An <audio> element
// loads local files fine from file://, loops natively (loop = true), and its
// play() is permitted because the 🎵 Start click is a user gesture (sticky
// activation covers the later boss-mode switches too).
//
// Headless-safe: without the Audio constructor (node smoke tests) everything
// is a silent no-op.
//
// Behavior (unchanged from the synthesized engine):
// - Music is OFF by default and NOT persisted. The 🎵 button is the only
//   place playback starts; update() never starts playback on its own — it
//   only switches modes while playing.
// - A random normal song is picked per Start (never the same twice in a row,
//   same rule as the old roster). While a Colossus is on screen the boss
//   track plays; when it leaves, the normal track RESUMES from where it was
//   paused (not restarted).
// - update(dt, boss) is called every frame with the REAL dt (unaffected by
//   pause/speed). The 🔊 button mutes SFX only (Phase 60) — music is not
//   ducked by it; 🎵 Stop is the only way to silence music.
// - A normal file that fails to load is marked unavailable and the next
//   available song starts instead (retries until one plays or all fail).

// Master music volume (0..1) for both elements. Real files are much louder
// than the old synth — if it's too loud/quiet, adjust THIS number first.
const MUSIC_LEVEL = 0.15;

const Music = {
  playing: false,      // true from start() until stop()
  mode: 'normal',      // 'normal' | 'boss' — which element is (or should be) audible
  songIndex: -1,       // index into MUSIC_SONGS of the current normal track
  lastSong: -1,        // previous pick (no immediate repeats)
  elNormal: null,      // HTMLAudioElement for the picked normal track
  elBoss: null,        // HTMLAudioElement for the boss track

  _failed: null,       // Set of song indices that failed to load this session
  _retrying: false,    // guard against re-entrant onerror retries

  // Pick a random available normal song, never the same twice in a row.
  // Returns -1 when every song is unavailable.
  pickSong() {
    const n = MUSIC_SONGS.length;
    if (n === 0) return -1;
    const ok = [];
    for (let i = 0; i < n; i++) if (!this._failed || !this._failed.has(i)) ok.push(i);
    if (ok.length === 0) return -1;
    let idx;
    do { idx = ok[Math.floor(Math.random() * ok.length)]; }
    while (ok.length > 1 && idx === this.lastSong);
    this.lastSong = idx;
    return idx;
  },

  // One looping element at the master volume, with an optional error hook.
  _make(src, onerror) {
    const el = new Audio(src);
    el.loop = true;
    el.volume = MUSIC_LEVEL;
    if (onerror) el.onerror = onerror;
    return el;
  },

  // play() returns a Promise in real browsers; swallow autoplay refusals.
  _play(el) {
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  },

  // Start (or restart) the music with a fresh random song. Returns false when
  // Audio is unavailable (headless) or no file could load. Only called from
  // the 🎵 click handler (a user gesture) or from the onerror retry path.
  start() {
    if (typeof Audio === 'undefined') return false;
    this.stop();
    if (!this._failed) this._failed = new Set();
    const idx = this.pickSong();
    if (idx < 0) return false; // every file failed to load
    this.songIndex = idx;
    this.elNormal = this._make(MUSIC_SONGS[idx].src, () => {
      // File missing/unplayable: mark it and start the next available song.
      if (!this.playing || this.mode !== 'normal' || this._retrying) return;
      this._failed.add(idx);
      this._retrying = true;
      const ok = this.start();
      this._retrying = false;
      if (!ok) this.playing = false;
    });
    this.mode = 'normal';
    this.playing = true;
    this._play(this.elNormal);
    return true;
  },

  // Stop and release both elements. A later Start makes fresh ones.
  stop() {
    [this.elNormal, this.elBoss].forEach(el => {
      if (!el) return;
      el.pause();
      el.onerror = null;
      el.removeAttribute('src'); // release the decoder
      try { el.load(); } catch (err) { /* stubs without load() */ }
    });
    this.elNormal = null;
    this.elBoss = null;
    this.playing = false;
    this.mode = 'normal';
    this.songIndex = -1;
  },

  // Called from main.js loadLevel() on every level entry (fresh start AND
  // retry): while playing in normal mode, swap to a different random track
  // (same no-immediate-repeat rule as Start). No-op when not playing or while
  // the boss track is active — a later boss exit resumes the NEW track.
  repick() {
    if (!this.playing || this.mode !== 'normal') return;
    const idx = this.pickSong();
    if (idx < 0) return; // every file failed to load
    if (this.elNormal) {
      this.elNormal.pause();
      this.elNormal.onerror = null;
      this.elNormal.removeAttribute('src');
      try { this.elNormal.load(); } catch (err) { /* stubs without load() */ }
    }
    this.songIndex = idx;
    this.elNormal = this._make(MUSIC_SONGS[idx].src, () => {
      // Same re-pick-on-error path as start().
      if (!this.playing || this.mode !== 'normal' || this._retrying) return;
      this._failed.add(idx);
      this._retrying = true;
      const ok = this.start();
      this._retrying = false;
      if (!ok) this.playing = false;
    });
    this._play(this.elNormal);
  },

  // Called every frame from main.js with the real dt. `boss` is true while a
  // Colossus is on screen. No-op when not playing; mode switches are guarded
  // so rapid boss in/out doesn't re-trigger play().
  update(dt, boss) {
    if (!this.playing) return;
    const want = boss ? 'boss' : 'normal';
    if (want === this.mode) return;
    this.mode = want;
    if (want === 'boss') {
      if (this.elNormal) this.elNormal.pause();
      if (!this.elBoss) this.elBoss = this._make(BOSS_MUSIC_SRC);
      this._play(this.elBoss);
    } else {
      if (this.elBoss) this.elBoss.pause();
      if (this.elNormal) this._play(this.elNormal); // resume from where paused
    }
  },
};
