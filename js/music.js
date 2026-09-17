// Phase 44: background music engine. A looping chiptune generated with Web
// Audio — the SAME lazy-AudioContext pattern as the SFX engine (no audio
// files, so file:// keeps working). Headless-safe: without an AudioContext
// (node smoke tests) everything is a silent no-op.
//
// Design:
// - Two modes: `normal` (calm Am–F–C–G arpeggio + bass, 108 BPM) and `boss`
//   (driving square-wave bass + kick/hat percussion, 132 BPM). The game loop
//   switches to boss mode while a Colossus is on screen.
// - A lookahead scheduler: update(dt) is called every frame from main.js with
//   the REAL dt (unaffected by pause/speed), and schedules 16th-note steps up
//   to LOOKAHEAD seconds ahead of ctx.currentTime.
// - Muting: the 🔊 Sound button mutes everything — update() forces the music
//   gain to 0 while SFX.muted is true.
// - Start/stop: music is OFF by default and is NOT persisted. The 🎵 button
//   ("🎵 Start" / "🎵 Stop") is the ONLY place the AudioContext is created —
//   and it's a click, i.e. a user gesture, so the browser allows it. update()
//   never creates or resumes the context on its own (that runs from
//   requestAnimationFrame, which is not a gesture and would be blocked).

// --- patterns ---------------------------------------------------------------
// Each pattern: steps = total 16th-note steps in the loop, stepDur (seconds),
// and per-step event arrays. bass[i] = {freq,type,dur,peak} | null; arp[i] =
// frequency | null; kick[i]/hat[i] = boolean. Built once at load time.

const PATTERNS = (function () {
  // normal: Am – F – C – G, one bar each (16 sixteenth steps per bar).
  const barsN = [
    { root: 110.0,   arp: [440.0, 523.25, 659.25, 880.0] },   // Am
    { root: 87.31,   arp: [349.23, 440.0, 523.25, 698.46] },  // F
    { root: 130.81,  arp: [523.25, 659.25, 783.99, 1046.5] }, // C
    { root: 98.0,    arp: [392.0, 493.88, 587.33, 783.99] },  // G
  ];
  const arpIdx = [0,1,2,1, 0,1,2,1, 2,1,2,3, 2,1,0,1];
  const normal = { stepDur: 60 / 108 / 4, steps: 64, bass: [], arp: [], kick: [], hat: [] };
  barsN.forEach((bar, b) => {
    for (let s = 0; s < 16; s++) {
      const i = b * 16 + s;
      normal.bass[i] = null;
      if (s === 0) normal.bass[i] = { freq: bar.root, type: 'triangle', dur: 0.42, peak: 0.15 };
      else if (s === 8) normal.bass[i] = { freq: bar.root, type: 'triangle', dur: 0.30, peak: 0.12 };
      else if (s === 12) normal.bass[i] = { freq: bar.root * 1.5, type: 'triangle', dur: 0.30, peak: 0.10 };
      normal.arp[i] = bar.arp[arpIdx[s]];
      normal.kick[i] = false;
      normal.hat[i] = false;
    }
  });

  // boss: Am – Am – F – G, driving eighth-note square bass + kick on the beat
  // and hats on the off-beats.
  const barsB = [110.0, 110.0, 87.31, 98.0];
  const boss = { stepDur: 60 / 132 / 4, steps: 64, bass: [], arp: [], kick: [], hat: [] };
  barsB.forEach((root, b) => {
    for (let s = 0; s < 16; s++) {
      const i = b * 16 + s;
      boss.bass[i] = (s % 2 === 0) ? { freq: root, type: 'square', dur: 0.10, peak: 0.11 } : null;
      boss.arp[i] = null;
      boss.kick[i] = s % 4 === 0;
      boss.hat[i] = s % 4 === 2;
    }
  });

  return { normal, boss };
})();

// --- engine -----------------------------------------------------------------

const Music = {
  playing: false,              // true between Start and Stop (NOT persisted)
  ctx: null,                   // AudioContext — created ONLY by start() (a click)
  gain: null,                  // music master gain (kept below SFX level)
  mode: null,                  // 'normal' | 'boss' | null (stopped)
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
    this.gain.gain.value = 0.5; // music sits under the SFX master
    this.gain.connect(this.ctx.destination);
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.playing = true;
    this.mode = null;
    this.step = 0;
    return true;
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
    if (this.gain) this.gain.gain.value = SFX.muted ? 0 : 0.5;
    const mode = boss ? 'boss' : 'normal';
    if (mode !== this.mode) {
      // Mode switch: restart the loop cleanly from step 0.
      this.mode = mode;
      this.step = 0;
      this.nextTime = ctx.currentTime + 0.15;
    }
    const pat = PATTERNS[mode];
    while (this.nextTime < ctx.currentTime + this.LOOKAHEAD) {
      this.scheduleStep(pat, this.step % pat.steps, this.nextTime);
      this.step++;
      this.nextTime += pat.stepDur;
    }
  },

  // Schedule one 16th-note step of the pattern at absolute time `when`.
  scheduleStep(pat, i, when) {
    const b = pat.bass[i];
    if (b) tone(this.ctx, this.gain, when, { type: b.type, freq: b.freq, dur: b.dur, peak: b.peak });
    const a = pat.arp[i];
    if (a != null) tone(this.ctx, this.gain, when, { type: 'triangle', freq: a, dur: pat.stepDur * 0.95, peak: 0.045 });
    if (pat.kick[i]) tone(this.ctx, this.gain, when, { type: 'sine', freq: 110, freqEnd: 42, dur: 0.12, peak: 0.22 });
    if (pat.hat[i]) noise(this.ctx, this.gain, when, { dur: 0.05, peak: 0.07, type: 'highpass', freq: 6000 });
  },
};
