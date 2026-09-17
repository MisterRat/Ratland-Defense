// Phase 46: background music engine (richer — chords, melody, variation).
// A looping chiptune generated with Web Audio — the SAME lazy-AudioContext
// pattern as the SFX engine (no audio files, so file:// keeps working).
// Headless-safe: without an AudioContext (node smoke tests) everything is a
// silent no-op.
//
// Voices (patterns live in js/music_patterns.js):
// - `normal` (108 BPM, 8-bar loop in A minor): one PAD chord per bar (two
//   detuned triangles per chord tone, slow attack), a per-bar BASS pattern
//   (roots / octave bounce / fifth answer / pickup walk), a triangle ARPEGGIO
//   with a different figure per bar, a sawtooth LEAD melody that develops
//   over the loop (motif → sequence → cadence answer → climax → resolution),
//   and a soft kick/hat pulse with a hat fill on the final bar. The E-major
//   cadence bar ends the loop so it never sounds like a plain repeat.
// - `boss` (132 BPM, 4-bar loop in A minor): driving square BASS eighths,
//   off-beat power-chord STABS on the F/E bars, a call-and-response LEAD
//   melody, kick on every beat + a bar-3 fill, snare on beats 2 & 4, hats on
//   the off-eighths, and a noise RISER swelling into the final E bar.
//
// Scheduling: a lookahead scheduler — update(dt) is called every frame from
// main.js with the REAL dt (unaffected by pause/speed) and schedules steps up
// to LOOKAHEAD seconds ahead of ctx.currentTime. Muting: the 🔊 Sound button
// mutes everything — update() forces the music gain to 0 while SFX.muted.
// Start/stop: music is OFF by default and is NOT persisted. The 🎵 button is
// the ONLY place an AudioContext is created (a click = user gesture);
// update() never creates or resumes the context on its own.

// Master music level (0..1). The per-note peaks below are tuned relative to
// this — if the user says "too quiet" or "too loud", adjust THIS number first.
const MUSIC_LEVEL = 0.3;

// --- voice helpers ----------------------------------------------------------
// (Local to this file: the SFX `tone`/`noise` helpers use a fixed peak→0
// envelope, which is wrong for sustained pad/lead/riser voices.)

// One pad note: two detuned triangles (±4 cents) with a slow attack and a
// long decay over `dur`.
function padNote(ctx, out, when, freq, dur, peak) {
  [1 - 4 / 1200, 1 + 4 / 1200].forEach(det => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq * det, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g).connect(out);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  });
}

// One pad chord: every tone of `tones` through padNote (peaks split so the
// sum stays around one note's loudness).
function padChord(ctx, out, when, tones, dur) {
  const peak = 0.16 / Math.max(1, tones.length);
  tones.forEach(f => padNote(ctx, out, when, f, dur, peak));
}

// One lead note: sawtooth through a lowpass (bright but not harsh) with a
// 20 ms attack.
function leadTone(ctx, out, when, { freq, dur, peak }) {
  const osc = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq, when);
  f.type = 'lowpass';
  f.frequency.value = 2400;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(peak, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(f).connect(g).connect(out);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

// Noise riser: `dur` seconds of bandpass noise swelling into the end of the
// bar (used once per boss loop, into the cadence bar).
function riser(ctx, out, when, dur) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(500, when);
  f.frequency.linearRampToValueAtTime(3500, when + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(0.10, when + dur * 0.9);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(f).connect(g).connect(out);
  src.start(when);
  src.stop(when + dur);
}

// --- engine -----------------------------------------------------------------

const Music = {
  playing: false,              // true between Start and Stop (NOT persisted)
  ctx: null,                   // AudioContext — created ONLY by start() (a click)
  gain: null,                  // music master gain
  mode: null,                  // 'normal' | 'boss' | null (stopped)
  songIndex: -1,               // Phase 48: chosen normal-mode song (-1 until Start)
  lastSong: -1,                // Phase 48: previous pick — never played twice in a row
  step: 0,                     // absolute step counter (loops via % steps)
  nextTime: 0,                 // ctx time of the next unscheduled step
  LOOKAHEAD: 0.35,             // seconds of scheduling ahead

  // The 🎵 Start button — MUST be called from the click handler (a user
  // gesture), which is why it's the only place a context is created.
  start() {
    if (this.playing) return true;
    const w = typeof window !== 'undefined' ? window : null;
    const AC = w && (w.AudioContext || w.webkitAudioContext);
    if (!AC) return false; // headless / unsupported: stay silent
    this.ctx = new AC();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = MUSIC_LEVEL;
    this.gain.connect(this.ctx.destination);
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.playing = true;
    this.mode = null;
    this.step = 0;
    // Phase 48: pick one of the six normal-mode songs at random, never the
    // same song twice in a row (avoids the "it's playing the same song" feel).
    this.songIndex = this.pickSong();
    return true;
  },

  // Phase 48: uniform random pick from the six songs, excluding the previous
  // pick (5 choices instead of 6 — still uniform over the allowed set).
  pickSong() {
    const n = NORMAL_SONGS.length;
    let i = Math.floor(Math.random() * n);
    if (i === this.lastSong) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
    this.lastSong = i;
    return i;
  },

  // The 🎵 Stop button: stops scheduling and closes the context (releases its
  // audio thread). A later Start creates a fresh one.
  stop() {
    this.playing = false;
    this.mode = null;
    this.step = 0;
    if (this.ctx) {
      const c = this.ctx;
      this.ctx = null;
      this.gain = null;
      c.close().catch(() => {});
    }
  },

  // Called every frame from main.js with the REAL dt and whether a boss is on
  // screen. No-op when not playing, headless, or while the context is
  // suspended (it can only be resumed by a gesture — Start does that).
  update(dt, boss) {
    if (!this.playing || !this.ctx) return;
    const ctx = this.ctx;
    if (ctx.state !== 'running') return;
    // The 🔊 Sound button mutes everything: duck the music gain while muted.
    if (this.gain) this.gain.gain.value = SFX.muted ? 0 : MUSIC_LEVEL;
    const mode = boss ? 'boss' : 'normal';
    if (mode !== this.mode) {
      // Mode switch: restart the loop cleanly from step 0.
      this.mode = mode;
      this.step = 0;
      this.nextTime = ctx.currentTime + 0.15;
    }
    // Phase 48: normal mode plays the randomly chosen song; boss keeps its own.
    const song = NORMAL_SONGS[this.songIndex];
    const pat = mode === 'boss' ? PATTERNS.boss : song.pattern;
    while (this.nextTime < ctx.currentTime + this.LOOKAHEAD) {
      const i = this.step % pat.steps;
      this.scheduleStep(pat, i, this.nextTime);
      // Sustained voices sit on bar boundaries.
      if (mode === 'normal' && i % 16 === 0) {
        const bar = song.barData[(i / 16) % song.barData.length];
        padChord(ctx, this.gain, this.nextTime, bar.tones, pat.stepDur * 16);
      }
      if (mode === 'boss' && i === 32) {
        riser(ctx, this.gain, this.nextTime, pat.stepDur * 16); // swell into the E bar
      }
      this.step++;
      this.nextTime += pat.stepDur;
    }
  },

  // Schedule one 16th-note step of the pattern at absolute time `when`.
  scheduleStep(pat, i, when) {
    const boss = this.mode === 'boss';
    const b = pat.bass[i];
    if (b) tone(this.ctx, this.gain, when, { type: b.type, freq: b.freq, dur: b.dur, peak: b.peak });
    const a = pat.arp[i];
    if (a) {
      // Boss stabs are short square power chords; normal arps are triangles.
      a.forEach(f => tone(this.ctx, this.gain, when, boss
        ? { type: 'square', freq: f, dur: pat.stepDur * 0.9, peak: 0.10 }
        : { type: 'triangle', freq: f, dur: pat.stepDur * 0.95, peak: 0.09 }));
    }
    const l = pat.lead[i];
    if (l) leadTone(this.ctx, this.gain, when, l);
    if (pat.kick[i]) tone(this.ctx, this.gain, when, { type: 'sine', freq: 110, freqEnd: 42, dur: 0.12, peak: 0.30 });
    if (pat.hat[i]) noise(this.ctx, this.gain, when, { dur: 0.05, peak: 0.10, type: 'highpass', freq: 6000 });
    if (pat.snare[i]) noise(this.ctx, this.gain, when, { dur: 0.12, peak: 0.18, type: 'bandpass', freq: 1800 });
  },
};
